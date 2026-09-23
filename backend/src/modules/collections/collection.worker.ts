import { randomUUID } from 'crypto';
import { prisma } from '../../database/prisma';
import { env } from '../../config/env';
import { collectionQueue } from './collection.queue';
import { PortoDaFolhaAdapter } from '../../adapters/porto-da-folha.adapter';
import { GenericMunicipalAdapter } from '../../adapters/generic-municipal.adapter';
import { PortalError } from '../../lib/portal/portal-error';

export class CollectionWorker {
  private intervalId?: NodeJS.Timeout;
  private polling = false;

  constructor() {
    collectionQueue.onProcess(this.processCollection.bind(this));
  }

  start() {
    this.intervalId = setInterval(() => void this.poll(), env.collection.pollIntervalMs);
    console.log(
      `[COLLECTION_WORKER] iniciado concurrency=${env.collection.concurrency} pollIntervalMs=${env.collection.pollIntervalMs}`
    );
    void this.poll();
  }

  stop() {
    if (this.intervalId) clearInterval(this.intervalId);
    console.log('[COLLECTION_WORKER] parado');
  }

  private async poll() {
    if (this.polling) return;
    this.polling = true;
    try {
      const { running, pending, concurrency } = collectionQueue.stats();
      const slots = concurrency - running - pending;
      if (slots <= 0) return;

      const candidates = await prisma.collection.findMany({
        where: { status: 'pending' },
        orderBy: { createdAt: 'asc' },
        take: slots,
        select: { id: true },
      });

      for (const collection of candidates) {
        collectionQueue.add(collection.id);
      }
    } catch (err) {
      console.error('[COLLECTION_WORKER_ERROR] falha no poll:', err);
    } finally {
      this.polling = false;
    }
  }

  private async processCollection(collectionId: string) {
    const claimed = await prisma.collection.updateMany({
      where: { id: collectionId, status: 'pending' },
      data: { status: 'running', startedAt: new Date(), progress: 0, currentStep: 'Iniciando coleta...' },
    });

    if (claimed.count === 0) return;

    const collection = await prisma.collection.findUnique({
      where: { id: collectionId },
      include: { municipality: true },
    });

    if (!collection) return;

    const correlationId = randomUUID();

    await this.log(collectionId, 'info', `Iniciando coleta para ${collection.municipality.city}/${collection.municipality.state} (correlationId=${correlationId})`);
    await this.log(collectionId, 'info', `Período: ${collection.year} | Meses: ${collection.months.join(', ')}`);

    try {
      const adapter = this.selectAdapter(collection.municipality);

      await this.log(collectionId, 'info', `Adaptador selecionado: ${adapter.name}`);

      await this.updateProgress(collectionId, 5, 'Descobrindo capacidades do portal...');
      const capabilities = await adapter.discover();
      await this.log(collectionId, 'info', `Capacidades: ${JSON.stringify(capabilities)}`);

      await this.updateProgress(collectionId, 15, 'Coletando licitações...');
      const procurements = await adapter.collectProcurements(collection.municipality, {
        year: collection.year,
        months: collection.months,
        correlationId,
      });

      await this.log(collectionId, 'info', `${procurements.length} licitações encontradas`);

      let recordsNew = 0;
      let recordsUpdated = 0;
      let recordsError = 0;

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

      let contractsNew = 0;
      try {
        await this.updateProgress(collectionId, 60, 'Coletando contratos...');
        const contracts = await adapter.collectContracts(collection.municipality, {
          year: collection.year,
          months: collection.months,
          correlationId,
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
      const isPortal = err instanceof PortalError;
      const errorCode = isPortal ? err.code : 'INTERNAL_ERROR';
      const errorMessage = isPortal
        ? `${err.code}: ${err.message} (portal=${err.portal} endpoint=${err.endpoint} duration=${Math.round(err.durationMs)}ms attempt=${err.attempt})`
        : err instanceof Error
          ? err.message
          : String(err);

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
          data: {
            collectionId,
            correlationId,
            errorCode,
            error: errorMessage,
            ...(isPortal ? { portal: err.toJSON() } : {}),
          },
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
