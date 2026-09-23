import { prisma } from '../../database/prisma';
import { CollectionQueue } from './collection.queue';
import { PortoDaFolhaAdapter } from '../../adapters/porto-da-folha.adapter';
import { GenericMunicipalAdapter } from '../../adapters/generic-municipal.adapter';

export class CollectionWorker {
  private queue: CollectionQueue;
  private intervalId?: NodeJS.Timeout;

  constructor() {
    this.queue = new CollectionQueue();
    this.queue.onProcess(this.processCollection.bind(this));
  }

  start() {
    // Check for pending collections every 10 seconds
    this.intervalId = setInterval(async () => {
      const pending = await prisma.collection.findMany({
        where: { status: 'pending' },
        orderBy: { createdAt: 'asc' },
        take: 1,
      });

      for (const collection of pending) {
        this.queue.add(collection.id);
      }
    }, 10000);

    console.log('Collection worker started');
  }

  stop() {
    if (this.intervalId) clearInterval(this.intervalId);
  }

  private async processCollection(collectionId: string) {
    const collection = await prisma.collection.findUnique({
      where: { id: collectionId },
      include: { municipality: true },
    });

    if (!collection || collection.status !== 'pending') return;

    // Mark as running
    await prisma.collection.update({
      where: { id: collectionId },
      data: { status: 'running', startedAt: new Date(), progress: 0, currentStep: 'Iniciando coleta...' },
    });

    await this.log(collectionId, 'info', `Iniciando coleta para ${collection.municipality.city}/${collection.municipality.state}`);
    await this.log(collectionId, 'info', `Período: ${collection.year} | Meses: ${collection.months.join(', ')}`);

    try {
      // Select adapter based on portal URL
      const adapter = this.selectAdapter(collection.municipality);

      await this.log(collectionId, 'info', `Adaptador selecionado: ${adapter.name}`);

      // Discover capabilities
      await this.updateProgress(collectionId, 5, 'Descobrindo capacidades do portal...');
      const capabilities = await adapter.discover();
      await this.log(collectionId, 'info', `Capacidades: ${JSON.stringify(capabilities)}`);

      // Collect procurements
      await this.updateProgress(collectionId, 15, 'Coletando licitações...');
      const procurements = await adapter.collectProcurements(collection.municipality, {
        year: collection.year,
        months: collection.months,
      });

      await this.log(collectionId, 'info', `${procurements.length} licitações encontradas`);

      let recordsNew = 0;
      let recordsUpdated = 0;
      let recordsError = 0;

      // Save procurements
      await this.updateProgress(collectionId, 40, `Salvando ${procurements.length} licitações...`);
      for (const proc of procurements) {
        try {
          const existing = proc.externalId
            ? await prisma.procurement.findFirst({
                where: { municipalityId: collection.municipalityId, externalId: proc.externalId },
              })
            : null;

          if (existing) {
            await prisma.procurement.update({ where: { id: existing.id }, data: proc });
            recordsUpdated++;
          } else {
            await prisma.procurement.create({ data: { ...proc, municipalityId: collection.municipalityId } });
            recordsNew++;
          }
        } catch (err) {
          recordsError++;
          await this.log(collectionId, 'error', `Erro ao salvar licitação: ${err}`);
        }
      }

      // Try to collect contracts if supported
      let contractsNew = 0;
      try {
        await this.updateProgress(collectionId, 60, 'Coletando contratos...');
        const contracts = await adapter.collectContracts(collection.municipality, {
          year: collection.year,
          months: collection.months,
        });

        await this.log(collectionId, 'info', `${contracts.length} contratos encontrados`);

        for (const contract of contracts) {
          try {
            const existing = contract.externalId
              ? await prisma.contract.findFirst({
                  where: { municipalityId: collection.municipalityId, externalId: contract.externalId },
                })
              : null;

            if (!existing) {
              await prisma.contract.create({
                data: { ...contract, municipalityId: collection.municipalityId },
              });
              contractsNew++;
              recordsNew++;
            } else {
              recordsUpdated++;
            }
          } catch {
            recordsError++;
          }
        }
      } catch (err) {
        await this.log(collectionId, 'warn', `Coleta de contratos não disponível: ${err}`);
      }

      // Create source record
      await prisma.source.create({
        data: {
          municipalityId: collection.municipalityId,
          type: capabilities.type,
          url: collection.municipality.transparencyPortalUrl,
          collectedAt: new Date(),
          status: 'success',
          metadata: {
            procurements: procurements.length,
            contracts: contractsNew,
            year: collection.year,
            months: collection.months,
          },
        },
      });

      await this.updateProgress(collectionId, 90, 'Finalizando...');

      const totalFound = procurements.length;

      await prisma.collection.update({
        where: { id: collectionId },
        data: {
          status: 'done',
          progress: 100,
          currentStep: 'Concluído',
          recordsFound: totalFound,
          recordsNew,
          recordsUpdated,
          recordsError,
          finishedAt: new Date(),
        },
      });

      await this.log(collectionId, 'info', `Coleta concluída. Novos: ${recordsNew}, Atualizados: ${recordsUpdated}, Erros: ${recordsError}`);

      await prisma.systemLog.create({
        data: {
          level: 'info',
          action: 'COLLECTION_DONE',
          message: `Collection completed for ${collection.municipality.city}`,
          data: { collectionId, recordsFound: totalFound, recordsNew, recordsUpdated, recordsError },
        },
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      await this.log(collectionId, 'error', `Erro fatal: ${errorMessage}`);

      await prisma.collection.update({
        where: { id: collectionId },
        data: {
          status: 'error',
          progress: 0,
          errorMessage,
          finishedAt: new Date(),
        },
      });

      await prisma.systemLog.create({
        data: {
          level: 'error',
          action: 'COLLECTION_ERROR',
          message: `Collection failed for municipality ${collection.municipalityId}`,
          data: { collectionId, error: errorMessage },
        },
      });
    }
  }

  private selectAdapter(municipality: { transparencyPortalUrl: string | null; city: string }) {
    const url = municipality.transparencyPortalUrl || '';

    if (url.includes('portodafolha.se.gov.br')) {
      return new PortoDaFolhaAdapter();
    }

    return new GenericMunicipalAdapter();
  }

  private async updateProgress(collectionId: string, progress: number, step: string) {
    await prisma.collection.update({
      where: { id: collectionId },
      data: { progress, currentStep: step },
    });
  }

  private async log(collectionId: string, level: string, message: string) {
    await prisma.collectionLog.create({
      data: { collectionId, level, message },
    });
    console.log(`[Collection ${collectionId.slice(0, 8)}] [${level.toUpperCase()}] ${message}`);
  }
}
