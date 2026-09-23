import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileCheck, Users, CreditCard } from 'lucide-react';
import { getContracts, getSuppliers, getPayments, getMunicipalities } from '../services/api';
import { PageHeader, LoadingPage, EmptyState, Pagination, StatusBadge, Currency, ValueChange } from '../components/ui';
import { Contract, Supplier, Payment, Municipality } from '../types';
import { formatDate, formatCurrency } from '../utils';

export function Contracts() {
  const [page, setPage] = useState(1);
  const [municipalityId, setMunicipalityId] = useState('');
  const [search, setSearch] = useState('');

  const params = { page: String(page), limit: '20', ...(municipalityId && { municipalityId }), ...(search && { search }) };
  const { data, isLoading } = useQuery({ queryKey: ['contracts', params], queryFn: () => getContracts(params) });
  const { data: municipalities } = useQuery({ queryKey: ['municipalities'], queryFn: () => getMunicipalities({ enabled: 'true' }) });

  const items: Contract[] = data?.items || [];

  return (
    <div className="space-y-6">
      <PageHeader title="Contratos" description="Contratos firmados pelos municípios" />
      <div className="card p-4 flex flex-wrap gap-3">
        <select value={municipalityId} onChange={(e) => { setMunicipalityId(e.target.value); setPage(1); }} className="input w-48">
          <option value="">Todos municípios</option>
          {(municipalities as Municipality[] | undefined)?.map((m) => (
            <option key={m.id} value={m.id}>{m.city}/{m.state}</option>
          ))}
        </select>
        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Buscar contrato, objeto..." className="input w-56" />
      </div>
      {isLoading ? <LoadingPage /> : (
        <div className="card overflow-hidden">
          <div className="px-4 py-2 text-xs text-gray-500 border-b dark:border-gray-700">{data?.total || 0} contrato(s)</div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="table-header">Contrato</th>
                  <th className="table-header">Fornecedor</th>
                  <th className="table-header">Objeto</th>
                  <th className="table-header">Vigência</th>
                  <th className="table-header">Status</th>
                  <th className="table-header text-right">V. Inicial</th>
                  <th className="table-header text-right">V. Atual</th>
                  <th className="table-header text-center">Aditivos</th>
                  <th className="table-header">Variação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {items.length === 0 ? (
                  <tr><td colSpan={9} className="py-12">
                    <EmptyState icon={FileCheck} title="Nenhum contrato encontrado" />
                  </td></tr>
                ) : items.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/20">
                    <td className="table-cell font-mono text-xs font-medium">{c.contractNumber || 'N/D'}</td>
                    <td className="table-cell text-xs max-w-[150px] truncate">{c.supplier?.name || 'N/D'}</td>
                    <td className="table-cell text-xs max-w-[200px]"><span title={c.object || ''} className="line-clamp-2">{c.object || 'N/D'}</span></td>
                    <td className="table-cell text-xs text-gray-500">
                      {formatDate(c.startDate)} → {formatDate(c.endDate)}
                    </td>
                    <td className="table-cell"><StatusBadge status={c.status} /></td>
                    <td className="table-cell text-right"><Currency value={c.initialValue} className="text-xs" /></td>
                    <td className="table-cell text-right"><Currency value={c.currentValue} className="text-xs font-semibold" /></td>
                    <td className="table-cell text-center">
                      {(c.amendmentCount || 0) > 0 ? (
                        <span className="badge-orange">{c.amendmentCount}</span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="table-cell"><ValueChange initial={c.initialValue} current={c.currentValue} /></td>
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

export function Suppliers() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const params = { page: String(page), limit: '20', ...(search && { search }) };
  const { data, isLoading } = useQuery({ queryKey: ['suppliers', params], queryFn: () => getSuppliers(params) });
  const items: Supplier[] = data?.items || [];

  return (
    <div className="space-y-6">
      <PageHeader title="Fornecedores" description="Empresas e fornecedores registrados" />
      <div className="card p-4">
        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Buscar por nome ou CNPJ..." className="input max-w-sm" />
      </div>
      {isLoading ? <LoadingPage /> : (
        <div className="card overflow-hidden">
          <div className="px-4 py-2 text-xs text-gray-500 border-b dark:border-gray-700">{data?.total || 0} fornecedor(es)</div>
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th className="table-header">Fornecedor</th>
                <th className="table-header">CNPJ</th>
                <th className="table-header">Cidade/UF</th>
                <th className="table-header text-center">Contratos</th>
                <th className="table-header text-center">Processos</th>
                <th className="table-header text-center">Pagamentos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {items.length === 0 ? (
                <tr><td colSpan={6} className="py-12"><EmptyState icon={Users} title="Nenhum fornecedor encontrado" /></td></tr>
              ) : items.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/20">
                  <td className="table-cell font-medium text-sm">{s.name}</td>
                  <td className="table-cell font-mono text-xs text-gray-500">{s.document || 'N/D'}</td>
                  <td className="table-cell text-xs text-gray-500">{[s.city, s.state].filter(Boolean).join('/') || 'N/D'}</td>
                  <td className="table-cell text-center font-semibold">{s._count?.contracts || 0}</td>
                  <td className="table-cell text-center">{s._count?.procurements || 0}</td>
                  <td className="table-cell text-center">{s._count?.payments || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} pages={data?.pages || 1} onChange={setPage} />
    </div>
  );
}

export function Payments() {
  const [page, setPage] = useState(1);
  const [municipalityId, setMunicipalityId] = useState('');

  const params = { page: String(page), limit: '20', ...(municipalityId && { municipalityId }) };
  const { data, isLoading } = useQuery({ queryKey: ['payments', params], queryFn: () => getPayments(params) });
  const { data: municipalities } = useQuery({ queryKey: ['municipalities'], queryFn: () => getMunicipalities({ enabled: 'true' }) });
  const items: Payment[] = data?.items || [];

  const total = items.reduce((s, p) => s + Number(p.value || 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Pagamentos" description="Registros de pagamentos efetuados" />
      <div className="card p-4 flex gap-3">
        <select value={municipalityId} onChange={(e) => { setMunicipalityId(e.target.value); setPage(1); }} className="input w-48">
          <option value="">Todos municípios</option>
          {(municipalities as Municipality[] | undefined)?.map((m) => (
            <option key={m.id} value={m.id}>{m.city}/{m.state}</option>
          ))}
        </select>
      </div>
      {items.length > 0 && (
        <div className="card p-4 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <div className="text-xs text-blue-600 dark:text-blue-400">Total pago (página atual)</div>
          <div className="text-xl font-bold text-blue-800 dark:text-blue-200">{formatCurrency(total)}</div>
        </div>
      )}
      {isLoading ? <LoadingPage /> : (
        <div className="card overflow-hidden">
          <div className="px-4 py-2 text-xs text-gray-500 border-b dark:border-gray-700">{data?.total || 0} pagamento(s)</div>
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th className="table-header">Empenho</th>
                <th className="table-header">Fornecedor</th>
                <th className="table-header">Descrição</th>
                <th className="table-header">Órgão</th>
                <th className="table-header">Data</th>
                <th className="table-header text-right">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {items.length === 0 ? (
                <tr><td colSpan={6} className="py-12"><EmptyState icon={CreditCard} title="Nenhum pagamento encontrado" /></td></tr>
              ) : items.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/20">
                  <td className="table-cell font-mono text-xs">{p.empenho || 'N/D'}</td>
                  <td className="table-cell text-sm">{p.supplier?.name || 'N/D'}</td>
                  <td className="table-cell text-xs max-w-[200px] truncate">{p.description || 'N/D'}</td>
                  <td className="table-cell text-xs text-gray-500">{p.organ || 'N/D'}</td>
                  <td className="table-cell text-xs text-gray-500">{formatDate(p.paymentDate)}</td>
                  <td className="table-cell text-right"><Currency value={p.value} className="text-sm font-semibold" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} pages={data?.pages || 1} onChange={setPage} />
    </div>
  );
}
