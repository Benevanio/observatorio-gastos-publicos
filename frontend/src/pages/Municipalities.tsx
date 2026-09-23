import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Building2, CheckCircle, XCircle, Zap } from 'lucide-react';
import { getMunicipalities, createMunicipality, detectPortal } from '../services/api';
import { PageHeader, LoadingPage, EmptyState, StatusBadge, Modal } from '../components/ui';
import { Municipality } from '../types';
import { BRAZIL_STATES } from '../utils';
import toast from 'react-hot-toast';

export function Municipalities() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    state: 'SE', city: '', ibgeCode: '', cnpj: '',
    transparencyPortalUrl: '', enabled: true,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['municipalities'],
    queryFn: () => getMunicipalities(),
  });

  const createMut = useMutation({
    mutationFn: createMunicipality,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['municipalities'] });
      setShowCreate(false);
      toast.success('Município adicionado!');
    },
    onError: () => toast.error('Erro ao criar município'),
  });

  const detectMut = useMutation({
    mutationFn: detectPortal,
    onSuccess: (data) => {
      toast.success(`Portal detectado: ${data.adapterType}`);
    },
    onError: () => toast.error('Não foi possível detectar o portal'),
  });

  const municipalities = (data as Municipality[] | undefined) || [];
  const filtered = municipalities.filter(
    (m) => !search || `${m.city} ${m.state}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Municípios"
        description="Gerencie os municípios monitorados"
        action={
          <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Adicionar município
          </button>
        }
      />

      {}
      <div className="relative max-w-xs">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar município..." className="input pl-9" />
      </div>

      {isLoading ? <LoadingPage /> : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th className="table-header">Município</th>
                <th className="table-header">IBGE</th>
                <th className="table-header">Portal</th>
                <th className="table-header">Licitações</th>
                <th className="table-header">Status</th>
                <th className="table-header">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="py-10">
                  <EmptyState icon={Building2} title="Nenhum município cadastrado"
                    description="Adicione um município para começar a monitorar"
                    action={<button onClick={() => setShowCreate(true)} className="btn-primary">+ Adicionar</button>} />
                </td></tr>
              ) : filtered.map((m) => (
                <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/20">
                  <td className="table-cell">
                    <div className="font-medium text-gray-900 dark:text-white">{m.city}</div>
                    <div className="text-xs text-gray-400">{m.state}</div>
                  </td>
                  <td className="table-cell text-gray-500 font-mono text-xs">{m.ibgeCode || 'N/D'}</td>
                  <td className="table-cell">
                    {m.transparencyPortalUrl ? (
                      <a href={m.transparencyPortalUrl} target="_blank" rel="noreferrer"
                        className="text-blue-600 hover:underline text-xs truncate block max-w-[200px]">
                        {m.transparencyPortalUrl.replace('https://', '')}
                      </a>
                    ) : <span className="text-gray-400 text-xs">Não configurado</span>}
                  </td>
                  <td className="table-cell text-center">{m._count?.procurements ?? 0}</td>
                  <td className="table-cell">
                    {m.enabled
                      ? <span className="flex items-center gap-1 text-green-600 text-xs"><CheckCircle size={12} />Ativo</span>
                      : <span className="flex items-center gap-1 text-gray-400 text-xs"><XCircle size={12} />Inativo</span>}
                  </td>
                  <td className="table-cell">
                    <button
                      onClick={() => detectMut.mutate(m.id)}
                      disabled={detectMut.isPending}
                      className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-800"
                    >
                      <Zap size={12} /> Detectar portal
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Adicionar Município">
        <form onSubmit={(e) => { e.preventDefault(); createMut.mutate(form); }} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Estado *</label>
              <select value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} className="input">
                {BRAZIL_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Município *</label>
              <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="input" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Código IBGE</label>
              <input value={form.ibgeCode} onChange={(e) => setForm({ ...form, ibgeCode: e.target.value })} className="input" placeholder="0000000" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">CNPJ</label>
              <input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} className="input" placeholder="00.000.000/0001-00" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">URL Portal da Transparência</label>
            <input value={form.transparencyPortalUrl} onChange={(e) => setForm({ ...form, transparencyPortalUrl: e.target.value })} className="input" placeholder="https://municipio.se.gov.br/portal/licitacoes" type="url" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={createMut.isPending} className="btn-primary">
              {createMut.isPending ? 'Salvando...' : 'Adicionar'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
