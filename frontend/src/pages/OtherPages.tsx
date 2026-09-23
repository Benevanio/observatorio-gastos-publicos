import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Upload, FileBarChart, BarChart3 } from 'lucide-react';
import {
  getAnalyticsSuppliers, getAnalyticsContracts, getMunicipalities,
  getComparison, getImports, getLogs, previewImport, executeImport,
  exportReportPDF, exportProcurementsXLSX, exportSuppliersXLSX,
} from '../services/api';
import { PageHeader, LoadingPage, EmptyState, Disclaimer } from '../components/ui';
import { Municipality, DataImport, SystemLog, SupplierRanking } from '../types';
import { formatCurrency, formatDateTime } from '../utils';
import toast from 'react-hot-toast';

const COLORS = ['#1e3a5f', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

// ── Analytics ────────────────────────────────────────────────────────────────
export function Analytics() {
  const [municipalityId, setMunicipalityId] = useState('');
  const { data: municipalities } = useQuery({ queryKey: ['municipalities'], queryFn: () => getMunicipalities({ enabled: 'true' }) });

  const { data: suppliers, isLoading: suppliersLoading } = useQuery({
    queryKey: ['analytics-suppliers', municipalityId],
    queryFn: () => getAnalyticsSuppliers(municipalityId ? { municipalityId } : {}),
  });
  const { data: contracts, isLoading: contractsLoading } = useQuery({
    queryKey: ['analytics-contracts', municipalityId],
    queryFn: () => getAnalyticsContracts(municipalityId ? { municipalityId } : {}),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Análises" description="Análises automáticas dos dados coletados" />
      <Disclaimer />
      <div className="card p-4 flex gap-3">
        <select value={municipalityId} onChange={(e) => setMunicipalityId(e.target.value)} className="input w-52">
          <option value="">Todos municípios</option>
          {(municipalities as Municipality[] | undefined)?.map((m) => (
            <option key={m.id} value={m.id}>{m.city}/{m.state}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Supplier concentration chart */}
        <div className="card p-5">
          <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-1">Concentração por Fornecedor</h3>
          <p className="text-xs text-gray-500 mb-4">% do valor contratado por fornecedor</p>
          {suppliersLoading ? <LoadingPage /> : (suppliers?.ranking?.length ?? 0) > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={suppliers.ranking.slice(0, 8)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={(v: number) => `${v.toFixed(0)}%`} tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={120} />
                  <Tooltip formatter={(v: unknown) => `${Number(v).toFixed(1)}%`} />
                  <Bar dataKey="percentage" name="% do total">
                    {suppliers.ranking.slice(0, 8).map((_: unknown, i: number) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-3 space-y-1">
                {suppliers.ranking.slice(0, 5).map((s: SupplierRanking, i: number) => (
                  <div key={s.supplierId} className="flex items-center justify-between text-xs">
                    <span className="text-gray-600 dark:text-gray-400 flex items-center gap-1.5 min-w-0 truncate">
                      <span className="w-3 h-3 rounded-full inline-block flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                      {s.name}
                    </span>
                    <span className="font-semibold ml-2 flex-shrink-0">{s.percentage.toFixed(1)}% · {formatCurrency(s.totalValue)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : <EmptyState icon={BarChart3} title="Sem dados de contratos" description="Inicie uma coleta para ver os dados" />}
        </div>

        {/* Contract amendments */}
        <div className="card p-5">
          <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-1">Contratos com Aditivos</h3>
          <p className="text-xs text-gray-500 mb-4">Contratos que sofreram alteração de valor</p>
          {contractsLoading ? <LoadingPage /> : (contracts?.length ?? 0) > 0 ? (
            <div className="space-y-3 max-h-72 overflow-y-auto">
              {(contracts as Array<{ id: string; contractNumber: string; supplier: string; object: string; initialValue: number; currentValue: number; amendmentCount: number; increasePercentage: string }>).slice(0, 8).map((c) => (
                <div key={c.id} className="border dark:border-gray-700 rounded-lg p-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-xs text-gray-900 dark:text-white">{c.contractNumber || 'N/D'}</div>
                      <div className="text-xs text-gray-500 truncate">{c.supplier || 'N/D'}</div>
                    </div>
                    <span className="badge-orange ml-2 flex-shrink-0">{c.amendmentCount} aditivo(s)</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs">
                    <span className="text-gray-500">Inicial: <span className="font-medium text-gray-700 dark:text-gray-300">{formatCurrency(c.initialValue)}</span></span>
                    <span className="text-gray-500">Atual: <span className="font-medium text-orange-600">{formatCurrency(c.currentValue)}</span></span>
                    {c.increasePercentage && <span className="text-orange-600 font-bold">+{c.increasePercentage}%</span>}
                  </div>
                </div>
              ))}
            </div>
          ) : <EmptyState icon={BarChart3} title="Sem contratos com aditivos" />}
        </div>
      </div>
    </div>
  );
}

// ── Comparison ───────────────────────────────────────────────────────────────
export function Comparison() {
  const [selected, setSelected] = useState<string[]>([]);
  const { data: municipalities } = useQuery({ queryKey: ['municipalities'], queryFn: () => getMunicipalities({ enabled: 'true' }) });
  const { data: comparison, isLoading } = useQuery({
    queryKey: ['comparison', ...selected],
    queryFn: () => getComparison(selected),
    enabled: selected.length >= 2,
  });

  const toggle = (id: string) => setSelected((s) =>
    s.includes(id) ? s.filter((x) => x !== id) : s.length < 3 ? [...s, id] : s
  );

  const metrics = [
    { key: 'totalAwarded', label: 'Valor Total Licitado', fmt: (v: number) => formatCurrency(v) },
    { key: 'procurementCount', label: 'Licitações', fmt: (v: number) => String(v) },
    { key: 'contractCount', label: 'Contratos', fmt: (v: number) => String(v) },
    { key: 'supplierCount', label: 'Fornecedores únicos', fmt: (v: number) => String(v) },
    { key: 'totalPayments', label: 'Total Pago', fmt: (v: number) => formatCurrency(v) },
    { key: 'dispensas', label: 'Dispensas', fmt: (v: number) => String(v) },
    { key: 'inexigibilidades', label: 'Inexigibilidades', fmt: (v: number) => String(v) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Comparação" description="Compare indicadores entre municípios" />
      <Disclaimer />
      <div className="card p-5">
        <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-3">Selecione até 3 municípios para comparar</h3>
        <div className="flex flex-wrap gap-2">
          {(municipalities as Municipality[] | undefined)?.map((m) => (
            <button key={m.id} onClick={() => toggle(m.id)}
              className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
                selected.includes(m.id)
                  ? 'bg-brand-800 text-white border-brand-800'
                  : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-brand-400'
              }`}
            >
              {m.city}/{m.state}
            </button>
          ))}
        </div>
        {selected.length < 2 && <p className="text-xs text-gray-400 mt-2">Selecione pelo menos 2 municípios</p>}
      </div>

      {isLoading && selected.length >= 2 && <LoadingPage />}

      {Array.isArray(comparison) && comparison.length >= 2 && (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th className="table-header">Indicador</th>
                {comparison.map((c: { municipality: Municipality }) => (
                  <th key={c.municipality.id} className="table-header text-center">
                    {c.municipality.city}/{c.municipality.state}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {metrics.map((m) => (
                <tr key={m.key} className="hover:bg-gray-50 dark:hover:bg-gray-900/20">
                  <td className="table-cell font-medium text-sm">{m.label}</td>
                  {comparison.map((c: Record<string, unknown> & { municipality: Municipality }) => (
                    <td key={c.municipality.id} className="table-cell text-center font-semibold">
                      {m.fmt(Number(c[m.key] ?? 0))}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-2 border-t dark:border-gray-700 text-xs text-gray-400">
            Fonte: portais públicos de transparência. Período e cobertura podem variar entre municípios.
          </div>
        </div>
      )}
    </div>
  );
}

// ── Imports ──────────────────────────────────────────────────────────────────
export function Imports() {
  const [municipalityId, setMunicipalityId] = useState('');
  const [entityType, setEntityType] = useState('procurement');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: municipalities } = useQuery({ queryKey: ['municipalities'], queryFn: () => getMunicipalities({ enabled: 'true' }) });
  const { data: imports, isLoading, refetch } = useQuery({ queryKey: ['imports'], queryFn: () => getImports() });

  const handleFileSelect = async (f: File) => {
    setFile(f);
    try {
      const p = await previewImport(f);
      setPreview(p);
    } catch { toast.error('Erro ao ler o arquivo. Verifique se é um XLSX ou CSV válido.'); }
  };

  const handleImport = async () => {
    if (!file || !municipalityId) { toast.error('Selecione o município e o arquivo'); return; }
    setImporting(true);
    try {
      await executeImport(file, municipalityId, entityType);
      toast.success('Importação iniciada! Acompanhe o status abaixo.');
      setFile(null); setPreview(null);
      if (fileRef.current) fileRef.current.value = '';
      setTimeout(() => refetch(), 2000);
    } catch { toast.error('Erro ao importar arquivo.'); }
    finally { setImporting(false); }
  };

  const items: DataImport[] = imports?.items || [];

  return (
    <div className="space-y-6">
      <PageHeader title="Importações" description="Importe dados de planilhas XLSX ou CSV" />

      <div className="card p-5 space-y-4">
        <h3 className="font-semibold text-gray-800 dark:text-gray-200">Nova Importação</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Município *</label>
            <select value={municipalityId} onChange={(e) => setMunicipalityId(e.target.value)} className="input">
              <option value="">Selecione...</option>
              {(municipalities as Municipality[] | undefined)?.map((m) => (
                <option key={m.id} value={m.id}>{m.city}/{m.state}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Tipo de dado</label>
            <select value={entityType} onChange={(e) => setEntityType(e.target.value)} className="input">
              <option value="procurement">Licitações</option>
              <option value="contract">Contratos</option>
              <option value="payment">Pagamentos</option>
            </select>
          </div>
        </div>

        <div
          className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center cursor-pointer hover:border-brand-400 transition-colors"
          onClick={() => fileRef.current?.click()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFileSelect(f); }}
          onDragOver={(e) => e.preventDefault()}
        >
          <Upload size={32} className="mx-auto text-gray-300 dark:text-gray-500 mb-2" />
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {file
              ? <span className="text-green-600 font-medium">✓ {file.name}</span>
              : 'Clique ou arraste um arquivo .xlsx ou .csv'}
          </div>
          <div className="text-xs text-gray-400 mt-1">Máximo: 50 MB</div>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }} />
        </div>

        {preview && (
          <div className="space-y-2">
            <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              Preview — {String(preview.totalRows ?? 0)} linha(s) encontrada(s)
            </div>
            <div className="text-xs text-gray-500">
              Colunas: <span className="font-mono">{(preview.columns as string[] ?? []).join(', ')}</span>
            </div>
            {(preview.suggestedMapping as Record<string, string>) && (
              <div className="text-xs text-gray-500">
                Mapeamento sugerido: <span className="font-mono text-green-600">
                  {Object.entries(preview.suggestedMapping as Record<string, string>).map(([k, v]) => `${k}→${v}`).join(', ')}
                </span>
              </div>
            )}
            <div className="bg-gray-50 dark:bg-gray-900/40 rounded-lg p-3 overflow-x-auto">
              <table className="text-xs w-full">
                <thead>
                  <tr>{(preview.columns as string[] ?? []).map((c) => (
                    <th key={c} className="text-left px-2 py-1 font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap">{c}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {(preview.preview as Record<string, unknown>[] ?? []).slice(0, 3).map((row, i) => (
                    <tr key={i}>{(preview.columns as string[] ?? []).map((c) => (
                      <td key={c} className="px-2 py-1 text-gray-700 dark:text-gray-300 truncate max-w-[120px]">
                        {String(row[c] ?? '')}
                      </td>
                    ))}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={handleImport} disabled={importing || !file || !municipalityId} className="btn-primary flex items-center gap-2">
            <Upload size={14} /> {importing ? 'Importando...' : 'Importar dados'}
          </button>
          {file && <button onClick={() => { setFile(null); setPreview(null); if (fileRef.current) fileRef.current.value = ''; }} className="btn-secondary text-xs">Limpar</button>}
        </div>
      </div>

      {/* History */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b dark:border-gray-700 font-semibold text-sm text-gray-800 dark:text-gray-200">Histórico de Importações</div>
        {isLoading ? <LoadingPage /> : (
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th className="table-header">Arquivo</th>
                <th className="table-header">Município</th>
                <th className="table-header">Data</th>
                <th className="table-header text-center">Novos</th>
                <th className="table-header text-center">Erros</th>
                <th className="table-header">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {items.length === 0 ? (
                <tr><td colSpan={6} className="py-8 text-center text-gray-400 text-sm">Nenhuma importação realizada ainda</td></tr>
              ) : items.map((imp) => (
                <tr key={imp.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/20">
                  <td className="table-cell text-sm font-medium">{imp.originalName || imp.filename}</td>
                  <td className="table-cell text-xs text-gray-500">{imp.municipality?.city}/{imp.municipality?.state}</td>
                  <td className="table-cell text-xs text-gray-500">{formatDateTime(imp.importedAt)}</td>
                  <td className="table-cell text-center text-xs font-semibold text-green-600">+{imp.recordsNew}</td>
                  <td className="table-cell text-center text-xs text-red-500">{imp.recordsError || 0}</td>
                  <td className="table-cell">
                    <span className={`badge ${imp.status === 'done' ? 'badge-green' : imp.status === 'error' ? 'badge-red' : 'badge-blue'}`}>
                      {imp.status === 'done' ? 'Concluído' : imp.status === 'error' ? 'Erro' : 'Processando'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Reports ──────────────────────────────────────────────────────────────────
export function Reports() {
  const [municipalityId, setMunicipalityId] = useState('');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const { data: municipalities } = useQuery({ queryKey: ['municipalities'], queryFn: () => getMunicipalities({ enabled: 'true' }) });
  const params = { ...(municipalityId && { municipalityId }), ...(year && { year }) };

  const reports = [
    { title: 'Relatório Completo (PDF)', desc: 'Resumo executivo, indicadores, metodologia e avisos legais', type: 'PDF', action: () => exportReportPDF(params) },
    { title: 'Licitações — Excel (.xlsx)', desc: 'Planilha com todos os processos do período selecionado', type: 'XLSX', action: () => exportProcurementsXLSX(params) },
    { title: 'Licitações — CSV', desc: 'Formato aberto para uso em qualquer software de análise', type: 'CSV', action: () => exportProcurementsXLSX(params) },
    { title: 'Ranking de Fornecedores (Excel)', desc: 'Concentração de contratos e valores por fornecedor', type: 'XLSX', action: () => exportSuppliersXLSX(params) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Relatórios" description="Exporte dados e análises em diferentes formatos" />

      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 text-sm text-amber-800 dark:text-amber-300">
        Todos os relatórios incluem o aviso: <em>"Este relatório apresenta indicadores identificados automaticamente a partir de dados públicos. Os resultados não constituem, por si só, prova de irregularidade."</em>
      </div>

      <div className="card p-4 flex flex-wrap gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Município</label>
          <select value={municipalityId} onChange={(e) => setMunicipalityId(e.target.value)} className="input w-48">
            <option value="">Todos os municípios</option>
            {(municipalities as Municipality[] | undefined)?.map((m) => (
              <option key={m.id} value={m.id}>{m.city}/{m.state}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Ano</label>
          <select value={year} onChange={(e) => setYear(e.target.value)} className="input w-28">
            {[2026, 2025, 2024, 2023].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reports.map((r) => (
          <div key={r.title} className="card p-5 flex items-start gap-4 hover:shadow-md transition-shadow">
            <div className="bg-brand-50 dark:bg-brand-900/30 p-3 rounded-lg flex-shrink-0">
              <FileBarChart size={20} className="text-brand-700 dark:text-brand-400" />
            </div>
            <div className="flex-1">
              <div className="font-semibold text-gray-900 dark:text-white text-sm">{r.title}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{r.desc}</div>
              <button onClick={r.action} className="btn-secondary text-xs mt-3 flex items-center gap-1.5">
                ↓ Baixar {r.type}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Logs ─────────────────────────────────────────────────────────────────────
export function Logs() {
  const [page, setPage] = useState(1);
  const [level, setLevel] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['logs', page, level],
    queryFn: () => getLogs({ page: String(page), limit: '50', ...(level && { level }) }),
    refetchInterval: 10000,
  });

  const items: SystemLog[] = data?.items || [];

  const levelColor: Record<string, string> = {
    error: 'text-red-400',
    warn: 'text-yellow-400',
    info: 'text-green-400',
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Logs do Sistema" description="Auditoria de eventos, coletas e operações" />

      <div className="card p-4 flex gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Nível</label>
          <select value={level} onChange={(e) => { setLevel(e.target.value); setPage(1); }} className="input w-36">
            <option value="">Todos os níveis</option>
            <option value="info">Info</option>
            <option value="warn">Aviso</option>
            <option value="error">Erro</option>
          </select>
        </div>
        <div className="text-xs text-gray-400">Atualiza a cada 10s</div>
      </div>

      {isLoading ? <LoadingPage /> : (
        <div className="card overflow-hidden">
          <div className="bg-gray-900 rounded-b-xl font-mono text-xs divide-y divide-gray-800">
            {items.length === 0 ? (
              <div className="py-8 text-center text-gray-500">Nenhum log encontrado</div>
            ) : items.map((log) => (
              <div key={log.id} className="flex items-start gap-3 px-4 py-2 hover:bg-gray-800/50">
                <span className={`flex-shrink-0 font-bold uppercase text-[10px] w-10 mt-0.5 ${levelColor[log.level] || 'text-gray-400'}`}>
                  {log.level}
                </span>
                <span className="text-gray-500 flex-shrink-0 w-36">{formatDateTime(log.createdAt)}</span>
                <span className="text-blue-400 flex-shrink-0 font-medium w-40 truncate">{log.action}</span>
                <span className="text-gray-300 flex-1 break-all">{log.message}</span>
              </div>
            ))}
          </div>
          {data?.pages > 1 && (
            <div className="flex justify-center gap-2 p-3 bg-gray-900 border-t border-gray-800">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="text-xs text-gray-400 hover:text-white disabled:opacity-40">← Anterior</button>
              <span className="text-xs text-gray-500">Pág {page}/{data.pages}</span>
              <button disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)} className="text-xs text-gray-400 hover:text-white disabled:opacity-40">Próxima →</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
