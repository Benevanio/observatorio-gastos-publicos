import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, ExternalLink } from 'lucide-react';
import { getProcurements, getMunicipalities, exportProcurementsXLSX, exportProcurementsCSV } from '../services/api';
import { PageHeader, LoadingPage, EmptyState, Pagination, StatusBadge, Currency } from '../components/ui';
import { Procurement, Municipality } from '../types';
import { formatDate } from '../utils';

export function Procurements() {
  const [page, setPage] = useState(1);
  const [municipalityId, setMunicipalityId] = useState('');
  const [year, setYear] = useState('');
  const [modality, setModality] = useState('');
  const [search, setSearch] = useState('');

  const params = {
    page: String(page), limit: '20',
    ...(municipalityId && { municipalityId }),
    ...(year && { year }),
    ...(modality && { modality }),
    ...(search && { search }),
  };

  const { data, isLoading } = useQuery({
    queryKey: ['procurements', params],
    queryFn: () => getProcurements(params),
  });

  const { data: municipalities } = useQuery({
    queryKey: ['municipalities'],
    queryFn: () => getMunicipalities({ enabled: 'true' }),
  });

  const items: Procurement[] = data?.items || [];

  return (
    <div className="space-y-6">
      <PageHeader title="Licitações" description="Processos licitatórios coletados"
        action={
          <div className="flex gap-2">
            <button onClick={() => exportProcurementsXLSX({ ...params })} className="btn-secondary text-xs">Excel</button>
            <button onClick={() => exportProcurementsCSV({ ...params })} className="btn-secondary text-xs">CSV</button>
          </div>
        }
      />

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3">
        <select value={municipalityId} onChange={(e) => { setMunicipalityId(e.target.value); setPage(1); }} className="input w-48">
          <option value="">Todos municípios</option>
          {(municipalities as Municipality[] | undefined)?.map((m) => (
            <option key={m.id} value={m.id}>{m.city}/{m.state}</option>
          ))}
        </select>
        <select value={year} onChange={(e) => { setYear(e.target.value); setPage(1); }} className="input w-28">
          <option value="">Todos os anos</option>
          {[2026, 2025, 2024, 2023].map((y) => <option key={y}>{y}</option>)}
        </select>
        <select value={modality} onChange={(e) => { setModality(e.target.value); setPage(1); }} className="input w-44">
          <option value="">Todas modalidades</option>
          {['Pregão Eletrônico', 'Pregão Presencial', 'Tomada de Preços', 'Concorrência', 'Dispensa de Licitação', 'Inexigibilidade', 'Chamamento Público'].map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Buscar objeto, processo..." className="input w-56" />
      </div>

      {isLoading ? <LoadingPage /> : (
        <div className="card overflow-hidden">
          <div className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400 border-b dark:border-gray-700">
            {data?.total || 0} registro(s) encontrado(s)
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="table-header">Processo</th>
                  <th className="table-header">Modalidade</th>
                  <th className="table-header">Órgão</th>
                  <th className="table-header">Objeto</th>
                  <th className="table-header">Data</th>
                  <th className="table-header">Situação</th>
                  <th className="table-header text-right">V. Estimado</th>
                  <th className="table-header text-right">V. Homologado</th>
                  <th className="table-header">Fonte</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {items.length === 0 ? (
                  <tr><td colSpan={9} className="py-12">
                    <EmptyState icon={FileText} title="Nenhuma licitação encontrada" description="Tente ajustar os filtros ou iniciar uma coleta" />
                  </td></tr>
                ) : items.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/20">
                    <td className="table-cell">
                      <div className="font-mono text-xs font-medium">{p.processNumber || 'N/D'}</div>
                      <div className="text-xs text-gray-400">{p.municipality?.city}/{p.municipality?.state}</div>
                    </td>
                    <td className="table-cell text-xs">{p.modality || 'N/D'}</td>
                    <td className="table-cell text-xs text-gray-600 dark:text-gray-400 max-w-[120px] truncate">{p.organ || 'N/D'}</td>
                    <td className="table-cell text-xs max-w-[200px]">
                      <span title={p.object || ''} className="line-clamp-2">{p.object || 'N/D'}</span>
                    </td>
                    <td className="table-cell text-xs text-gray-500">{formatDate(p.publicationDate)}</td>
                    <td className="table-cell"><StatusBadge status={p.status} /></td>
                    <td className="table-cell text-right"><Currency value={p.estimatedValue} className="text-xs" /></td>
                    <td className="table-cell text-right"><Currency value={p.awardedValue} className="text-xs font-semibold" /></td>
                    <td className="table-cell">
                      {p.sourceUrl && (
                        <a href={p.sourceUrl} target="_blank" rel="noreferrer" className="text-blue-500 hover:text-blue-700">
                          <ExternalLink size={13} />
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <Pagination page={page} pages={data?.pages || 1} onChange={setPage} />
    </div>
  );
}
