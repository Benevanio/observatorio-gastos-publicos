import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, EyeOff } from 'lucide-react';
import { getFindings, dismissFinding, getMunicipalities } from '../services/api';
import { PageHeader, LoadingPage, EmptyState, Pagination, SeverityBadge, EvidencePanel, Disclaimer, Modal } from '../components/ui';
import { Finding, Municipality } from '../types';
import { formatDate, SEVERITY_LABELS } from '../utils';
import toast from 'react-hot-toast';

const TYPE_LABELS: Record<string, string> = {
  supplier_concentration: 'Concentração de Fornecedor',
  excessive_amendments: 'Aditivos Excessivos',
  inexigibilidade_panel: 'Painel de Inexigibilidades',
  dispensa_frequency: 'Frequência de Dispensas',
  similar_dispensas: 'Dispensas com Objetos Semelhantes',
  expired_contracts: 'Contratos Vencidos',
  near_expiry_contracts: 'Contratos Próximos do Vencimento',
  data_quality: 'Inconsistência de Dados',
  repeated_procurements: 'Contratações Recorrentes',
  recurring_supplier: 'Fornecedor Recorrente',
};

export function Findings() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [municipalityId, setMunicipalityId] = useState('');
  const [severity, setSeverity] = useState('');
  const [type, setType] = useState('');
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);

  const params = {
    page: String(page), limit: '20',
    ...(municipalityId && { municipalityId }),
    ...(severity && { severity }),
    ...(type && { type }),
  };

  const { data, isLoading } = useQuery({ queryKey: ['findings', params], queryFn: () => getFindings(params) });
  const { data: municipalities } = useQuery({ queryKey: ['municipalities'], queryFn: () => getMunicipalities({ enabled: 'true' }) });

  const dismissMut = useMutation({
    mutationFn: dismissFinding,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['findings'] });
      toast.success('Indicador arquivado');
      setSelectedFinding(null);
    },
  });

  const items: Finding[] = data?.items || [];

  const severityOrder = ['high_relevance', 'requires_analysis', 'attention', 'informative'];
  const sortedItems = [...items].sort(
    (a, b) => severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity)
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Achados e Indicadores" description="Situações identificadas automaticamente para análise" />

      <Disclaimer />

      {}
      <div className="card p-4 flex flex-wrap gap-3">
        <select value={municipalityId} onChange={(e) => { setMunicipalityId(e.target.value); setPage(1); }} className="input w-48">
          <option value="">Todos municípios</option>
          {(municipalities as Municipality[] | undefined)?.map((m) => (
            <option key={m.id} value={m.id}>{m.city}/{m.state}</option>
          ))}
        </select>
        <select value={severity} onChange={(e) => { setSeverity(e.target.value); setPage(1); }} className="input w-44">
          <option value="">Todas as classificações</option>
          {Object.entries(SEVERITY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} className="input w-52">
          <option value="">Todos os tipos</option>
          {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      {isLoading ? <LoadingPage /> : (
        <>
          <div className="text-xs text-gray-500 dark:text-gray-400 px-1">
            {data?.total || 0} indicador(es) encontrado(s)
          </div>

          {sortedItems.length === 0 ? (
            <EmptyState icon={AlertTriangle} title="Nenhum indicador encontrado"
              description="Execute uma análise para identificar situações de interesse" />
          ) : (
            <div className="space-y-3">
              {sortedItems.map((f) => (
                <div
                  key={f.id}
                  className={`card p-5 cursor-pointer hover:shadow-md transition-shadow border-l-4 ${
                    f.severity === 'high_relevance' ? 'border-l-red-500' :
                    f.severity === 'requires_analysis' ? 'border-l-orange-500' :
                    f.severity === 'attention' ? 'border-l-yellow-500' : 'border-l-blue-400'
                  }`}
                  onClick={() => setSelectedFinding(f)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <SeverityBadge severity={f.severity} />
                        <span className="badge badge-gray">{TYPE_LABELS[f.type] || f.type}</span>
                        {f.municipality && (
                          <span className="text-xs text-gray-400">{f.municipality.city}/{f.municipality.state}</span>
                        )}
                      </div>
                      <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{f.title}</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{f.description}</p>
                    </div>
                    <div className="flex-shrink-0 text-xs text-gray-400">{formatDate(f.createdAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      <Pagination page={page} pages={data?.pages || 1} onChange={setPage} />

      {}
      <Modal open={!!selectedFinding} onClose={() => setSelectedFinding(null)} title="Detalhes do Indicador">
        {selectedFinding && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <SeverityBadge severity={selectedFinding.severity} />
              <span className="badge badge-gray">{TYPE_LABELS[selectedFinding.type] || selectedFinding.type}</span>
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white">{selectedFinding.title}</h3>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{selectedFinding.description}</p>

            {selectedFinding.rule && (
              <div className="text-xs text-gray-500 dark:text-gray-400 font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                Regra: {selectedFinding.rule}
              </div>
            )}

            {selectedFinding.evidence && Object.keys(selectedFinding.evidence).length > 0 && (
              <div>
                <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Evidências</div>
                <EvidencePanel evidence={selectedFinding.evidence} />
              </div>
            )}

            {selectedFinding.sourceUrl && (
              <div>
                <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Fonte Original</div>
                <a href={selectedFinding.sourceUrl} target="_blank" rel="noreferrer"
                  className="text-xs text-blue-600 hover:underline break-all">{selectedFinding.sourceUrl}</a>
              </div>
            )}

            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 text-xs text-amber-700 dark:text-amber-300">
              ⚠️ Este indicador foi gerado automaticamente e <strong>não constitui prova de irregularidade</strong>.
              A interpretação e conclusão são de responsabilidade do usuário.
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t dark:border-gray-700">
              <button
                onClick={() => dismissMut.mutate(selectedFinding.id)}
                disabled={dismissMut.isPending}
                className="btn-secondary flex items-center gap-2 text-xs"
              >
                <EyeOff size={13} /> Arquivar indicador
              </button>
              <button onClick={() => setSelectedFinding(null)} className="btn-primary text-xs">Fechar</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
