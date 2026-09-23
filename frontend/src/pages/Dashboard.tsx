import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { FileText, FileCheck, Users, CreditCard, AlertTriangle, TrendingUp } from 'lucide-react';
import { getMunicipalities, getAnalyticsOverview, runAnalysis } from '../services/api';
import { StatCard, LoadingPage, Disclaimer, PageHeader } from '../components/ui';
import { formatCurrency } from '../utils';
import { Municipality } from '../types';
import toast from 'react-hot-toast';

const COLORS = ['#1e3a5f', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const fmtShort = (v: number) => {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}K`;
  return formatCurrency(v);
};

export function Dashboard() {
  const [selectedMunicipality, setSelectedMunicipality] = useState('');
  const [year, setYear] = useState(String(new Date().getFullYear()));

  const { data: municipalities } = useQuery({
    queryKey: ['municipalities'],
    queryFn: () => getMunicipalities({ enabled: 'true' }),
  });

  const { data: overview, isLoading } = useQuery({
    queryKey: ['analytics-overview', selectedMunicipality, year],
    queryFn: () => getAnalyticsOverview({
      ...(selectedMunicipality && { municipalityId: selectedMunicipality }),
      ...(year && { year }),
    }),
  });

  const analyzeMut = useMutation({
    mutationFn: () => runAnalysis(selectedMunicipality),
    onSuccess: (result) => toast.success(`Análise concluída: ${result.findingsGenerated} indicador(es)`),
    onError: () => toast.error('Erro ao executar análise'),
  });

  const s = overview?.summary;

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Visão geral dos gastos públicos municipais" />

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Município</label>
          <select value={selectedMunicipality} onChange={(e) => setSelectedMunicipality(e.target.value)} className="input w-52">
            <option value="">Todos os municípios</option>
            {(municipalities as Municipality[] | undefined)?.map((m) => (
              <option key={m.id} value={m.id}>{m.city}/{m.state}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Ano</label>
          <select value={year} onChange={(e) => setYear(e.target.value)} className="input w-32">
            {[2026, 2025, 2024, 2023].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <button
          onClick={() => { if (!selectedMunicipality) { toast.error('Selecione um município'); return; } analyzeMut.mutate(); }}
          disabled={analyzeMut.isPending || !selectedMunicipality}
          className="btn-primary flex items-center gap-2"
        >
          <TrendingUp size={16} />
          {analyzeMut.isPending ? 'Analisando...' : 'Executar Análise'}
        </button>
      </div>

      <Disclaimer />

      {isLoading ? <LoadingPage /> : (
        <>
          {/* Stats grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatCard title="Total Analisado" value={fmtShort(s?.totalAnalyzed || 0)} icon={TrendingUp} color="blue" />
            <StatCard title="Licitações" value={s?.procurements || 0} icon={FileText} color="purple" />
            <StatCard title="Contratos" value={s?.contracts || 0} icon={FileCheck} color="green" />
            <StatCard title="Fornecedores" value={s?.suppliers || 0} icon={Users} color="orange" />
            <StatCard title="Pagamentos" value={fmtShort(s?.totalPayments || 0)} icon={CreditCard} color="gray" />
            <StatCard title="Indicadores" value={s?.findings || 0} icon={AlertTriangle} color={s?.findings ? 'red' : 'gray'} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Monthly chart */}
            <div className="card p-5">
              <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">Licitações por Mês</h3>
              {(overview?.monthlyProcurements?.length ?? 0) > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={overview.monthlyProcurements}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v: number) => fmtShort(v)} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: unknown) => formatCurrency(v as number)} />
                    <Bar dataKey="value" name="Valor (R$)" fill="#1e3a5f" radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-56 flex items-center justify-center text-gray-400 text-sm">Sem dados para o período</div>
              )}
            </div>

            {/* Modality pie */}
            <div className="card p-5">
              <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">Por Modalidade</h3>
              {(overview?.modalityDistribution?.length ?? 0) > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={overview.modalityDistribution} cx="50%" cy="50%" outerRadius={80}
                      dataKey="value" nameKey="modality"
                      label={false}
                      labelLine={false}
                    >
                      {overview.modalityDistribution.map((_: unknown, i: number) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: unknown) => formatCurrency(v as number)} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-56 flex items-center justify-center text-gray-400 text-sm">Sem dados</div>
              )}
            </div>
          </div>

          {/* Financial summary */}
          {s && (
            <div className="card p-5">
              <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-3">Resumo Financeiro</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Valor Estimado Total', value: s.totalEstimated },
                  { label: 'Valor Homologado Total', value: s.totalAwarded },
                  { label: 'Total de Pagamentos', value: s.totalPayments },
                  { label: 'Diferença Est. vs Homologado', value: (s.totalEstimated || 0) - (s.totalAwarded || 0) },
                ].map((item) => (
                  <div key={item.label} className="bg-gray-50 dark:bg-gray-900/40 rounded-lg p-3">
                    <div className="text-xs text-gray-500 dark:text-gray-400">{item.label}</div>
                    <div className="text-base font-bold text-gray-900 dark:text-white mt-0.5">{formatCurrency(item.value || 0)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
