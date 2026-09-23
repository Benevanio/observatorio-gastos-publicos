import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Play, CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react';
import { getCollections, createCollection, getCollection, getMunicipalities } from '../services/api';
import { PageHeader, LoadingPage, Pagination, ProgressBar, Modal } from '../components/ui';
import { Collection, Municipality } from '../types';
import { formatDateTime, MONTHS } from '../utils';
import toast from 'react-hot-toast';

const statusIcon = (s: string) => {
  if (s === 'done') return <CheckCircle size={14} className="text-green-500" />;
  if (s === 'error') return <XCircle size={14} className="text-red-500" />;
  if (s === 'running') return <Loader2 size={14} className="text-blue-500 animate-spin" />;
  return <Clock size={14} className="text-gray-400" />;
};

export function Collections() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState({ municipalityId: '', year: new Date().getFullYear(), months: [7] });

  const { data, isLoading } = useQuery({
    queryKey: ['collections', page],
    queryFn: () => getCollections({ page: String(page), limit: '20' }),
    refetchInterval: 5000, // Poll every 5s for running jobs
  });

  const { data: detail } = useQuery({
    queryKey: ['collection', selectedId],
    queryFn: () => getCollection(selectedId!),
    enabled: !!selectedId,
    refetchInterval: selectedId ? 3000 : false,
  });

  const { data: municipalities } = useQuery({
    queryKey: ['municipalities'],
    queryFn: () => getMunicipalities({ enabled: 'true' }),
  });

  const createMut = useMutation({
    mutationFn: createCollection,
    onSuccess: (col) => {
      qc.invalidateQueries({ queryKey: ['collections'] });
      setShowCreate(false);
      setSelectedId(col.id);
      toast.success('Coleta iniciada!');
    },
    onError: () => toast.error('Erro ao criar coleta'),
  });

  const items = data?.items || [];

  const toggleMonth = (m: number) => {
    setForm((f) => ({
      ...f,
      months: f.months.includes(m) ? f.months.filter((x) => x !== m) : [...f.months, m],
    }));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Coletas"
        description="Gerencie a coleta automática de dados dos portais"
        action={
          <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Nova Coleta
          </button>
        }
      />

      {isLoading ? <LoadingPage /> : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th className="table-header">Município</th>
                <th className="table-header">Período</th>
                <th className="table-header">Status</th>
                <th className="table-header">Progresso</th>
                <th className="table-header">Registros</th>
                <th className="table-header">Criada em</th>
                <th className="table-header">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {items.map((c: Collection) => (
                <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/20">
                  <td className="table-cell">
                    <span className="font-medium">{c.municipality?.city}/{c.municipality?.state}</span>
                  </td>
                  <td className="table-cell text-gray-500 text-xs">
                    {c.year} · Meses: {c.months.join(', ')}
                  </td>
                  <td className="table-cell">
                    <div className="flex items-center gap-1.5">
                      {statusIcon(c.status)}
                      <span className="capitalize text-xs">{c.status === 'pending' ? 'Aguardando' : c.status === 'running' ? 'Em andamento' : c.status === 'done' ? 'Concluído' : 'Erro'}</span>
                    </div>
                    {c.currentStep && c.status === 'running' && (
                      <div className="text-xs text-gray-400 mt-0.5 truncate max-w-[180px]">{c.currentStep}</div>
                    )}
                  </td>
                  <td className="table-cell w-36">
                    <ProgressBar value={c.progress} />
                  </td>
                  <td className="table-cell text-xs">
                    <div className="text-green-600">+{c.recordsNew} novos</div>
                    <div className="text-blue-500">{c.recordsUpdated} atualizados</div>
                    {c.recordsError > 0 && <div className="text-red-500">{c.recordsError} erros</div>}
                  </td>
                  <td className="table-cell text-xs text-gray-400">{formatDateTime(c.createdAt)}</td>
                  <td className="table-cell">
                    <button onClick={() => setSelectedId(c.id)} className="text-xs text-blue-600 hover:underline">Ver logs</button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={7} className="py-10 text-center text-gray-400">Nenhuma coleta encontrada</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} pages={data?.pages || 1} onChange={setPage} />

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nova Coleta de Dados">
        <form onSubmit={(e) => { e.preventDefault(); createMut.mutate(form); }} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Município *</label>
            <select value={form.municipalityId} onChange={(e) => setForm({ ...form, municipalityId: e.target.value })} className="input" required>
              <option value="">Selecione...</option>
              {(municipalities as Municipality[] | undefined)?.map((m) => (
                <option key={m.id} value={m.id}>{m.city}/{m.state}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Ano *</label>
            <select value={form.year} onChange={(e) => setForm({ ...form, year: parseInt(e.target.value) })} className="input">
              {[2026, 2025, 2024, 2023].map((y) => <option key={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Meses *</label>
            <div className="grid grid-cols-4 gap-2">
              {MONTHS.map((m) => (
                <button type="button" key={m.value}
                  onClick={() => toggleMonth(m.value)}
                  className={`text-xs px-2 py-1.5 rounded-lg border transition-colors ${
                    form.months.includes(m.value)
                      ? 'bg-brand-800 text-white border-brand-800'
                      : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {m.label.slice(0, 3)}
                </button>
              ))}
            </div>
            {form.months.length === 0 && <p className="text-xs text-red-500 mt-1">Selecione ao menos um mês</p>}
          </div>
          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 text-xs text-amber-700 dark:text-amber-300">
            A coleta irá consultar o portal da transparência do município selecionado e importar os dados automaticamente.
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={createMut.isPending || !form.municipalityId || !form.months.length} className="btn-primary flex items-center gap-2">
              <Play size={14} /> {createMut.isPending ? 'Criando...' : 'Iniciar Coleta'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Log detail modal */}
      <Modal open={!!selectedId} onClose={() => setSelectedId(null)} title="Detalhes da Coleta">
        {detail && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-xs">
              {[
                { label: 'Status', value: detail.status },
                { label: 'Progresso', value: `${detail.progress}%` },
                { label: 'Registros Novos', value: detail.recordsNew },
                { label: 'Atualizados', value: detail.recordsUpdated },
                { label: 'Erros', value: detail.recordsError },
                { label: 'Total Encontrado', value: detail.recordsFound },
              ].map((i) => (
                <div key={i.label} className="bg-gray-50 dark:bg-gray-900/40 rounded p-2">
                  <div className="text-gray-400">{i.label}</div>
                  <div className="font-semibold text-gray-900 dark:text-white">{i.value}</div>
                </div>
              ))}
            </div>
            <ProgressBar value={detail.progress} label="Progresso" color={detail.status === 'error' ? 'red' : detail.status === 'done' ? 'green' : 'blue'} />
            {detail.currentStep && (
              <div className="text-xs text-gray-500 italic">Passo atual: {detail.currentStep}</div>
            )}
            {detail.errorMessage && (
              <div className="bg-red-50 dark:bg-red-900/20 rounded p-3 text-xs text-red-700 dark:text-red-300">
                Erro: {detail.errorMessage}
              </div>
            )}
            <div>
              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Logs ({detail.logs?.length || 0})</div>
              <div className="bg-gray-900 rounded-lg p-3 max-h-64 overflow-y-auto font-mono text-xs space-y-1">
                {(detail.logs || []).slice().reverse().map((log: { id: string; level: string; message: string; createdAt: string }) => (
                  <div key={log.id} className={`${log.level === 'error' ? 'text-red-400' : log.level === 'warn' ? 'text-yellow-400' : 'text-green-400'}`}>
                    [{new Date(log.createdAt).toLocaleTimeString('pt-BR')}] {log.message}
                  </div>
                ))}
                {(!detail.logs || detail.logs.length === 0) && (
                  <div className="text-gray-500">Sem logs ainda...</div>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
