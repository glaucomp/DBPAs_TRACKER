import { formatDate, isCompleted, todayISO } from '../model.js';

export const STATUS_STYLES = {
  'new job': 'bg-slate-100 text-slate-700',
  'in progress': 'bg-sky-100 text-sky-900',
  'on hold': 'bg-amber-100 text-amber-900',
  approved: 'bg-emerald-100 text-emerald-800',
  'for update / revision': 'bg-orange-100 text-orange-900',
  'waiting for approval': 'bg-violet-100 text-violet-900',
  'upcoming projects': 'bg-cyan-100 text-cyan-950',
  completed: 'bg-emerald-50 text-emerald-700',
};

export const STATUS_BAR_FILLS = {
  'new job': 'bg-slate-500',
  'in progress': 'bg-sky-500',
  'on hold': 'bg-amber-500',
  approved: 'bg-emerald-500',
  'for update / revision': 'bg-orange-500',
  'waiting for approval': 'bg-violet-500',
  'upcoming projects': 'bg-cyan-500',
  completed: 'bg-emerald-400',
};

export function statusBarFill(label) {
  if (!label) return 'bg-navy-800';
  return STATUS_BAR_FILLS[label.trim().toLowerCase()] || 'bg-navy-800';
}

const PRIORITY_STYLES = {
  low: 'bg-slate-100 text-slate-600',
  normal: 'bg-sky-50 text-sky-800',
  high: 'bg-amber-100 text-amber-900',
  urgent: 'bg-red-100 text-red-800',
};

export function StatusBadge({ value }) {
  if (!value) return <span className="text-muted">—</span>;
  const style = STATUS_STYLES[value.trim().toLowerCase()] || 'bg-slate-100 text-slate-700';
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${style}`}>{value}</span>;
}

export function PriorityBadge({ value }) {
  if (!value) return <span className="text-muted">—</span>;
  const style = PRIORITY_STYLES[value.trim().toLowerCase()] || 'bg-slate-100 text-slate-700';
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${style}`}>{value}</span>;
}

export function DueDate({ value, status }) {
  if (!value) return <span className="text-muted">—</span>;
  const settled = isCompleted(status) || (status || '').trim().toLowerCase() === 'approved';
  const overdue = !settled && value < todayISO();
  const soon = !overdue && !settled && value <= addSeven(todayISO());
  return (
    <span className={overdue ? 'font-semibold text-red-700' : soon ? 'font-semibold text-amber-800' : 'text-ink'}>
      {formatDate(value)}
      {overdue ? <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wide">Overdue</span> : null}
    </span>
  );
}

function addSeven(iso) {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(year, month - 1, day + 7);
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
