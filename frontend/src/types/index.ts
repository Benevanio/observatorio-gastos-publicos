export interface Municipality {
  id: string;
  state: string;
  city: string;
  ibgeCode?: string;
  cnpj?: string;
  transparencyPortalUrl?: string;
  apiUrl?: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { procurements: number; contracts: number; findings: number };
}

export interface Procurement {
  id: string;
  municipalityId: string;
  processNumber?: string;
  year?: number;
  month?: number;
  modality?: string;
  modalityCode?: string;
  organ?: string;
  object?: string;
  publicationDate?: string;
  biddingDate?: string;
  status?: string;
  estimatedValue?: number;
  awardedValue?: number;
  sourceUrl?: string;
  municipality?: { city: string; state: string };
  suppliers?: Array<{ supplier: { name: string; document?: string } }>;
}

export interface Supplier {
  id: string;
  name: string;
  document?: string;
  city?: string;
  state?: string;
  _count?: { contracts: number; procurements: number; payments: number };
  totalContractValue?: number;
  totalPayments?: number;
}

export interface Contract {
  id: string;
  municipalityId: string;
  contractNumber?: string;
  supplierId?: string;
  organ?: string;
  object?: string;
  initialValue?: number;
  currentValue?: number;
  startDate?: string;
  endDate?: string;
  status?: string;
  sourceUrl?: string;
  supplier?: { name: string; document?: string };
  municipality?: { city: string; state: string };
  amendments?: ContractAmendment[];
  amendmentCount?: number;
  increasePercentage?: string;
}

export interface ContractAmendment {
  id: string;
  contractId: string;
  type?: string;
  description?: string;
  originalValue?: number;
  amendmentValue?: number;
  currentValue?: number;
  date?: string;
}

export interface Payment {
  id: string;
  municipalityId: string;
  supplierId?: string;
  contractId?: string;
  empenho?: string;
  paymentDate?: string;
  description?: string;
  value?: number;
  organ?: string;
  supplier?: { name: string; document?: string };
  municipality?: { city: string; state: string };
}

export interface Finding {
  id: string;
  municipalityId: string;
  type: string;
  severity: 'informative' | 'attention' | 'requires_analysis' | 'high_relevance';
  title: string;
  description: string;
  rule?: string;
  evidence?: Record<string, unknown>;
  sourceUrl?: string;
  dismissed: boolean;
  createdAt: string;
  municipality?: { city: string; state: string };
}

export interface Collection {
  id: string;
  municipalityId: string;
  year: number;
  months: number[];
  status: 'pending' | 'running' | 'done' | 'error';
  progress: number;
  currentStep?: string;
  recordsFound: number;
  recordsNew: number;
  recordsUpdated: number;
  recordsIgnored: number;
  recordsError: number;
  errorMessage?: string;
  startedAt?: string;
  finishedAt?: string;
  createdAt: string;
  municipality?: { city: string; state: string };
  logs?: CollectionLog[];
}

export interface CollectionLog {
  id: string;
  collectionId: string;
  level: string;
  message: string;
  createdAt: string;
}

export interface DataImport {
  id: string;
  municipalityId: string;
  source?: string;
  filename: string;
  originalName?: string;
  importedAt: string;
  records: number;
  recordsNew: number;
  recordsUpdated: number;
  recordsError: number;
  status: string;
  errorMessage?: string;
  municipality?: { city: string; state: string };
}

export interface SystemLog {
  id: string;
  level: string;
  action: string;
  message: string;
  data?: Record<string, unknown>;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit?: number;
  pages: number;
}

export interface AnalyticsOverview {
  summary: {
    totalAnalyzed: number;
    procurements: number;
    totalEstimated: number;
    totalAwarded: number;
    contracts: number;
    payments: number;
    totalPayments: number;
    findings: number;
    suppliers: number;
  };
  modalityDistribution: Array<{ modality: string; count: number; value: number }>;
  monthlyProcurements: Array<{ month: number; year: number; label: string; count: number; value: number }>;
}

export interface SupplierRanking {
  supplierId: string;
  name: string;
  document?: string;
  contractCount: number;
  totalValue: number;
  percentage: number;
}
