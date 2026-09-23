export interface PortalCapabilities {
  type: string;
  hasApi: boolean;
  hasScraping: boolean;
  hasExport: boolean;
  exportFormats: string[];
  endpoints: Array<{ type: string; url: string }>;
  rateLimit: { requestsPerSecond: number; delayMs: number };
  reachable?: boolean;
  diagnostics?: {
    dnsMs?: number;
    tcpMs?: number;
    tlsMs?: number;
    httpMs?: number;
    totalMs?: number;
    errorCode?: string;
  };
  notes?: string;
}

export interface CollectionOptions {
  year: number;
  months: number[];
  correlationId?: string;
  signal?: AbortSignal;
}

export interface PortalAdapter {
  name: string;
  canHandle(url: string): boolean;
  discover(): Promise<PortalCapabilities>;
  collectProcurements(
    municipality: { city: string; state: string; transparencyPortalUrl: string | null },
    options: CollectionOptions
  ): Promise<ProcurementData[]>;
  collectContracts(
    municipality: { city: string; state: string },
    options: CollectionOptions
  ): Promise<ContractData[]>;
  collectPayments(
    municipality: { city: string; state: string },
    options: CollectionOptions
  ): Promise<PaymentData[]>;
}

export interface ProcurementData {
  processNumber?: string;
  year?: number;
  month?: number;
  modality?: string;
  modalityCode?: string;
  organ?: string;
  object?: string;
  publicationDate?: Date;
  biddingDate?: Date;
  status?: string;
  estimatedValue?: number;
  awardedValue?: number;
  sourceUrl?: string;
  externalId?: string;
  rawData?: Record<string, unknown>;
}

export interface ContractData {
  contractNumber?: string;
  supplierId?: string;
  organ?: string;
  object?: string;
  initialValue?: number;
  currentValue?: number;
  startDate?: Date;
  endDate?: Date;
  status?: string;
  sourceUrl?: string;
  externalId?: string;
}

export interface PaymentData {
  supplierId?: string;
  contractId?: string;
  empenho?: string;
  paymentDate?: Date;
  description?: string;
  value?: number;
  organ?: string;
  externalId?: string;
}
