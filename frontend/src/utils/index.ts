import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatCurrency(value?: number | null): string {
  if (value == null) return 'N/D';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatDate(date?: string | null): string {
  if (!date) return 'N/D';
  return new Date(date).toLocaleDateString('pt-BR');
}

export function formatDateTime(date?: string | null): string {
  if (!date) return 'N/D';
  return new Date(date).toLocaleString('pt-BR');
}

export function formatPercent(value?: number | string | null): string {
  if (value == null) return 'N/D';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return 'N/D';
  return `${num.toFixed(1)}%`;
}

export const MONTHS = [
  { value: 1, label: 'Janeiro' }, { value: 2, label: 'Fevereiro' },
  { value: 3, label: 'Março' }, { value: 4, label: 'Abril' },
  { value: 5, label: 'Maio' }, { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' }, { value: 8, label: 'Agosto' },
  { value: 9, label: 'Setembro' }, { value: 10, label: 'Outubro' },
  { value: 11, label: 'Novembro' }, { value: 12, label: 'Dezembro' },
];

export const SEVERITY_LABELS: Record<string, string> = {
  informative: 'Informativo',
  attention: 'Atenção',
  requires_analysis: 'Requer Análise',
  high_relevance: 'Alta Relevância',
};

export const SEVERITY_COLORS: Record<string, string> = {
  informative: 'badge-blue',
  attention: 'badge-yellow',
  requires_analysis: 'badge-orange',
  high_relevance: 'badge-red',
};

export const STATUS_COLORS: Record<string, string> = {
  Homologado: 'badge-green',
  'Em andamento': 'badge-blue',
  Concluído: 'badge-green',
  Revogado: 'badge-red',
  Cancelado: 'badge-red',
  pending: 'badge-gray',
  running: 'badge-blue',
  done: 'badge-green',
  error: 'badge-red',
  active: 'badge-green',
  expired: 'badge-red',
  processing: 'badge-blue',
};

export const BRAZIL_STATES = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS',
  'MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC',
  'SP','SE','TO',
];
