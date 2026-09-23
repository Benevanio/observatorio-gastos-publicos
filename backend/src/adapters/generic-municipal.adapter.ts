import { PortalAdapter, PortalCapabilities, CollectionOptions } from './portal.adapter.interface';

export class GenericMunicipalAdapter implements PortalAdapter {
  name = 'GenericMunicipalAdapter';

  canHandle(_url: string): boolean {
    return true;
  }

  async discover(): Promise<PortalCapabilities> {
    return {
      type: 'generic',
      hasApi: false,
      hasScraping: false,
      hasExport: false,
      exportFormats: [],
      endpoints: [],
      rateLimit: { requestsPerSecond: 1, delayMs: 2000 },
      notes: 'Adaptador genérico. Configure manualmente o portal ou use importação via planilha.',
    };
  }

  async collectProcurements(_municipality: { city: string }, _options: CollectionOptions) {
    console.log('[GenericMunicipalAdapter] No automatic collection available. Use spreadsheet import.');
    return [];
  }

  async collectContracts(_municipality: { city: string }, _options: CollectionOptions) {
    return [];
  }

  async collectPayments(_municipality: { city: string }, _options: CollectionOptions) {
    return [];
  }
}
