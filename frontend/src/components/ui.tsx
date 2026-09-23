import { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn, SEVERITY_LABELS, SEVERITY_COLORS, STATUS_COLORS, formatCurrency } from '../utils';

export function StatCard({
  title, value, sub, icon: Icon, color = 'blue',
}: {
  title: string; value: string | number; sub?: string;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  color?: 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'gray';
}) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    green: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    orange: 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    red: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    purple: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    gray: 'bg-gray-50 text-gray-700 dark:bg-gray-700/50 dark:text-gray-400',
  };
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{title}</div>
          <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
          {sub && <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{sub}</div>}
        </div>
        {Icon && (
          <div className={cn('p-2.5 rounded-lg', colors[color])}>
            <Icon size={20} />
          </div>
        )}
      </div>
    </div>
  );
}

export function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span className={SEVERITY_COLORS[severity] || 'badge-gray'}>
      {SEVERITY_LABELS[severity] || severity}
    </span>
  );
}

export function StatusBadge({ status }: { status?: string | null }) {
  if (!status) return <span className="badge-gray">N/D</span>;
  return <span className={STATUS_COLORS[status] || 'badge-gray'}>{status}</span>;
}

export function LoadingSpinner({ className }: { className?: string }) {
  return <Loader2 size={20} className={cn('animate-spin text-brand-600', className)} />;
}

export function LoadingPage() {
  return (
    <div className="flex items-center justify-center h-64">
      <LoadingSpinner className="w-8 h-8" />
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action }: {
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  title: string; description?: string; action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {Icon && <Icon size={40} className="text-gray-300 dark:text-gray-600 mb-4" />}
      <h3 className="text-base font-semibold text-gray-700 dark:text-gray-300">{title}</h3>
      {description && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Pagination({ page, pages, onChange }: { page: number; pages: number; onChange: (p: number) => void }) {
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-2 mt-4">
      <button disabled={page <= 1} onClick={() => onChange(page - 1)} className="btn-secondary disabled:opacity-40 px-3 py-1.5">←</button>
      <span className="text-sm text-gray-600 dark:text-gray-400">Página {page} de {pages}</span>
      <button disabled={page >= pages} onClick={() => onChange(page + 1)} className="btn-secondary disabled:opacity-40 px-3 py-1.5">→</button>
    </div>
  );
}

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h1>
        {description && <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

export function ValueChange({ initial, current }: { initial?: number; current?: number }) {
  if (!initial || !current) return <span className="text-gray-400">N/D</span>;
  const pct = ((current - initial) / initial) * 100;
  const color = pct > 0 ? 'text-orange-600' : pct < 0 ? 'text-green-600' : 'text-gray-500';
  return (
    <span className={cn('text-xs font-medium', color)}>
      {pct > 0 ? '▲' : pct < 0 ? '▼' : '='} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

export function Modal({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none">×</button>
        </div>
        <div className="overflow-y-auto p-6 flex-1">{children}</div>
      </div>
    </div>
  );
}

export function EvidencePanel({ evidence }: { evidence?: Record<string, unknown> }) {
  if (!evidence) return null;
  return (
    <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 text-xs font-mono space-y-1 max-h-48 overflow-y-auto">
      {Object.entries(evidence).map(([k, v]) => (
        <div key={k} className="flex gap-2">
          <span className="text-gray-500 dark:text-gray-400 min-w-[120px]">{k}:</span>
          <span className="text-gray-800 dark:text-gray-200 break-all">
            {typeof v === 'object' ? JSON.stringify(v, null, 2) : String(v ?? 'N/D')}
          </span>
        </div>
      ))}
    </div>
  );
}

export function Currency({ value, className }: { value?: number | null; className?: string }) {
  return <span className={cn('font-mono tabular-nums', className)}>{formatCurrency(value)}</span>;
}

export function Disclaimer() {
  return (
    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-xs text-amber-800 dark:text-amber-300 flex gap-2">
      <span className="text-base leading-none mt-0.5">⚠️</span>
      <span>
        <strong>Aviso:</strong> Os indicadores apresentados foram gerados automaticamente a partir de dados públicos.
        Eles <strong>não constituem prova de irregularidade</strong> e requerem análise documental para qualquer conclusão.
        A responsabilidade pela interpretação é do usuário.
      </span>
    </div>
  );
}

export function ProgressBar({ value, label, color = 'blue' }: { value: number; label?: string; color?: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-500', green: 'bg-green-500', orange: 'bg-orange-500', red: 'bg-red-500',
  };
  return (
    <div className="space-y-1">
      {label && (
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>{label}</span><span>{value}%</span>
        </div>
      )}
      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', colors[color] || 'bg-blue-500')}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </div>
  );
}
