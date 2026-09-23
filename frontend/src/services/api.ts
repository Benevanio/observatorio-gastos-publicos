import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 404) return Promise.reject(new Error('Recurso não encontrado'));
    if (err.response?.status >= 500) return Promise.reject(new Error('Erro no servidor. Tente novamente.'));
    return Promise.reject(err);
  }
);

export const getMunicipalities = (params?: Record<string, string>) =>
  api.get('/municipalities', { params }).then((r) => r.data);

export const getMunicipality = (id: string) =>
  api.get(`/municipalities/${id}`).then((r) => r.data);

export const getMunicipalityStats = (id: string, year?: string) =>
  api.get(`/municipalities/${id}/stats`, { params: year ? { year } : {} }).then((r) => r.data);

export const createMunicipality = (data: Record<string, unknown>) =>
  api.post('/municipalities', data).then((r) => r.data);

export const detectPortal = (id: string) =>
  api.post(`/municipalities/${id}/detect`).then((r) => r.data);

export const getProcurements = (params?: Record<string, string>) =>
  api.get('/procurements', { params }).then((r) => r.data);

export const getProcurement = (id: string) =>
  api.get(`/procurements/${id}`).then((r) => r.data);

export const getProcurementModalities = (params?: Record<string, string>) =>
  api.get('/procurements/stats/modalities', { params }).then((r) => r.data);

export const getProcurementMonthly = (params?: Record<string, string>) =>
  api.get('/procurements/stats/monthly', { params }).then((r) => r.data);

export const getContracts = (params?: Record<string, string>) =>
  api.get('/contracts', { params }).then((r) => r.data);

export const getContract = (id: string) =>
  api.get(`/contracts/${id}`).then((r) => r.data);

export const getContractAmendments = (params?: Record<string, string>) =>
  api.get('/contracts/stats/amendments', { params }).then((r) => r.data);

export const getSuppliers = (params?: Record<string, string>) =>
  api.get('/suppliers', { params }).then((r) => r.data);

export const getSupplier = (id: string) =>
  api.get(`/suppliers/${id}`).then((r) => r.data);

export const getSupplierRanking = (municipalityId: string) =>
  api.get(`/suppliers/ranking/${municipalityId}`).then((r) => r.data);

export const getPayments = (params?: Record<string, string>) =>
  api.get('/payments', { params }).then((r) => r.data);

export const getFindings = (params?: Record<string, string>) =>
  api.get('/findings', { params }).then((r) => r.data);

export const getFindingsSummary = (params?: Record<string, string>) =>
  api.get('/findings/summary', { params }).then((r) => r.data);

export const dismissFinding = (id: string) =>
  api.patch(`/findings/${id}/dismiss`).then((r) => r.data);

export const getAnalyticsOverview = (params?: Record<string, string>) =>
  api.get('/analytics/overview', { params }).then((r) => r.data);

export const getAnalyticsSuppliers = (params?: Record<string, string>) =>
  api.get('/analytics/suppliers', { params }).then((r) => r.data);

export const getAnalyticsContracts = (params?: Record<string, string>) =>
  api.get('/analytics/contracts', { params }).then((r) => r.data);

export const runAnalysis = (municipalityId: string) =>
  api.post('/analytics/run', { municipalityId }).then((r) => r.data);

export const getComparison = (ids: string[]) =>
  api.get('/analytics/compare', { params: { ids: ids.join(',') } }).then((r) => r.data);

export const getCollections = (params?: Record<string, string>) =>
  api.get('/collections', { params }).then((r) => r.data);

export const getCollection = (id: string) =>
  api.get(`/collections/${id}`).then((r) => r.data);

export const createCollection = (data: { municipalityId: string; year: number; months: number[] }) =>
  api.post('/collections', data).then((r) => r.data);

export const getImports = (params?: Record<string, string>) =>
  api.get('/imports', { params }).then((r) => r.data);

export const getImport = (id: string) =>
  api.get(`/imports/${id}`).then((r) => r.data);

export const previewImport = (file: File) => {
  const fd = new FormData();
  fd.append('file', file);
  return api.post('/imports/preview', fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data);
};

export const executeImport = (
  file: File,
  municipalityId: string,
  entityType: string,
  columnMapping?: Record<string, string>
) => {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('municipalityId', municipalityId);
  fd.append('entityType', entityType);
  if (columnMapping) fd.append('columnMapping', JSON.stringify(columnMapping));
  return api.post('/imports', fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data);
};

export const exportProcurementsXLSX = (params: Record<string, string>) => {
  const qs = new URLSearchParams(params).toString();
  window.open(`/api/exports/procurements/xlsx?${qs}`, '_blank');
};

export const exportProcurementsCSV = (params: Record<string, string>) => {
  const qs = new URLSearchParams(params).toString();
  window.open(`/api/exports/procurements/csv?${qs}`, '_blank');
};

export const exportReportPDF = (params: Record<string, string>) => {
  const qs = new URLSearchParams(params).toString();
  window.open(`/api/exports/report/pdf?${qs}`, '_blank');
};

export const exportSuppliersXLSX = (params: Record<string, string>) => {
  const qs = new URLSearchParams(params).toString();
  window.open(`/api/exports/suppliers/xlsx?${qs}`, '_blank');
};

export const getLogs = (params?: Record<string, string>) =>
  api.get('/logs', { params }).then((r) => r.data);
