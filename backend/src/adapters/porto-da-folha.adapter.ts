import * as cheerio from 'cheerio';
import { portalHttp } from '../lib/portal/portal-http-client';
import { PortalError } from '../lib/portal/portal-error';
import { diagnosePortal } from '../lib/portal/portal-diagnostics';
import {
  PortalAdapter,
  PortalCapabilities,
  CollectionOptions,
  ProcurementData,
} from './portal.adapter.interface';

const BASE_URL = 'https://portodafolha.se.gov.br/portal';
const PORTAL_NAME = 'PortoDaFolha';

const MODALITY_MAP: Record<string, string> = {
  '1': 'Concorrência',
  '2': 'Tomada de Preços',
  '3': 'Convite',
  '4': 'Concurso',
  '5': 'Leilão',
  '6': 'Pregão Presencial',
  '7': 'Pregão Eletrônico',
  '8': 'Dispensa de Licitação',
  '9': 'Inexigibilidade',
  '10': 'RDC',
  '11': 'Chamamento Público',
  '12': 'Credenciamento',
};

const MODALITY_CODE_MAP: Record<string, string> = {
  'Concorrência': 'CC',
  'Tomada de Preços': 'TP',
  'Convite': 'CV',
  'Pregão Presencial': 'PP',
  'Pregão Eletrônico': 'PE',
  'Dispensa de Licitação': 'DL',
  'Inexigibilidade': 'IN',
  'Chamamento Público': 'CP',
  'Credenciamento': 'CR',
  'RDC': 'RDC',
};

export class PortoDaFolhaAdapter implements PortalAdapter {
  name = 'PortoDaFolhaAdapter';

  canHandle(url: string): boolean {
    return url.includes('portodafolha.se.gov.br');
  }

  async discover(): Promise<PortalCapabilities> {
    const probe = await diagnosePortal(`${BASE_URL}/licitacoes`);

    return {
      type: 'scraping_html',
      hasApi: false,
      hasScraping: true,
      hasExport: true,
      exportFormats: ['html'],
      endpoints: [{ type: 'procurements', url: `${BASE_URL}/licitacoes` }],
      rateLimit: { requestsPerSecond: 1, delayMs: 1500 },
      reachable: probe.reachable,
      diagnostics: {
        dnsMs: probe.phases.dns.durationMs,
        tcpMs: probe.phases.tcp.durationMs,
        tlsMs: probe.phases.tls?.durationMs,
        httpMs: probe.phases.http.durationMs,
        totalMs: probe.totalDurationMs,
        errorCode: probe.errorCode,
      },
      notes: probe.reachable
        ? `Portal HTML acessível. Resposta total em ${probe.totalDurationMs}ms.`
        : `Portal inacessível: ${probe.errorCode} — ${probe.errorMessage}`,
    };
  }

  async collectProcurements(
    municipality: { city: string; state: string; transparencyPortalUrl: string | null },
    options: CollectionOptions
  ): Promise<ProcurementData[]> {
    const results: ProcurementData[] = [];
    const { year, months, correlationId } = options;

    for (const month of months) {
      const response = await portalHttp.get({
        portal: PORTAL_NAME,
        url: `${BASE_URL}/licitacoes`,
        params: {
          filtrar: 'buscar',
          origem: 8,
          ano: year,
          mes: month,
          modalidade: '',
          situacao: '',
          f: '',
          lc: '',
          palavra: '',
        },
        headers: { Referer: 'https://portodafolha.se.gov.br/' },
        correlationId,
        signal: options.signal,
      });

      const parsed = this.parseHtmlPage(response.data, year, month);

      if (parsed.length === 0) {
        console.warn(
          `[PORTAL_EMPTY] portal=${PORTAL_NAME} endpoint=/licitacoes ano=${year} mes=${month} ` +
            `status=${response.status} bytes=${Buffer.byteLength(response.data)} correlationId=${response.correlationId}`
        );
      }

      results.push(...parsed);
    }

    return results;
  }

  async collectContracts() {
    return [];
  }

  async collectPayments() {
    return [];
  }

  private parseHtmlPage(html: string, year: number, month: number): ProcurementData[] {
    const $ = cheerio.load(html);
    const results: ProcurementData[] = [];

    $('table tbody tr, .licitacao-row, .procurement-item').each((_, el) => {
      const cells = $(el).find('td');
      if (cells.length < 3) return;

      const processNumber = $(cells[0]).text().trim();
      const object = $(cells[1]).text().trim() || $(cells[2]).text().trim();
      const modality = $(cells[2]).text().trim() || $(cells[1]).text().trim();
      const status = $(cells[cells.length - 1]).text().trim();
      const link = $(el).find('a').attr('href');

      if (!processNumber || !object) return;

      results.push(
        this.mapRowToProcurement({
          processNumber,
          object,
          modality,
          status,
          year,
          month,
          sourceUrl: link
            ? link.startsWith('http')
              ? link
              : `${BASE_URL}${link}`
            : `${BASE_URL}/licitacoes`,
        })
      );
    });

    return results;
  }

  private mapRowToProcurement(row: {
    processNumber: string;
    object: string;
    modality: string;
    status: string;
    year: number;
    month: number;
    sourceUrl: string;
  }): ProcurementData {
    const modalityName = MODALITY_MAP[row.modality] || row.modality;
    const modalityCode = MODALITY_CODE_MAP[modalityName] || 'OT';

    return {
      processNumber: row.processNumber,
      year: row.year,
      month: row.month,
      modality: modalityName,
      modalityCode,
      object: row.object,
      status: row.status || 'N/D',
      sourceUrl: row.sourceUrl,
      externalId: `PORTO-${row.year}-${row.processNumber}`.replace(/\s+/g, '-'),
    };
  }
}

export { PortalError };
