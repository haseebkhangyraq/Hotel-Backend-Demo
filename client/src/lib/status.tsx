import type { ReservationStatus, RoomStatus } from '../lib/types';

export const roomStatusMeta: Record<RoomStatus, { dot: string; chip: string; card: string }> = {
  Available: { dot: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-700 border-emerald-200', card: 'border-emerald-200' },
  Reserved: { dot: 'bg-indigo-500', chip: 'bg-indigo-50 text-indigo-700 border-indigo-200', card: 'border-indigo-200' },
  Occupied: { dot: 'bg-sky-600', chip: 'bg-sky-50 text-sky-700 border-sky-200', card: 'border-sky-200' },
  Dirty: { dot: 'bg-amber-500', chip: 'bg-amber-50 text-amber-700 border-amber-200', card: 'border-amber-200' },
  Cleaning: { dot: 'bg-cyan-500', chip: 'bg-cyan-50 text-cyan-700 border-cyan-200', card: 'border-cyan-200' },
  Maintenance: { dot: 'bg-rose-500', chip: 'bg-rose-50 text-rose-600 border-rose-200', card: 'border-rose-200' },
};

export const resStatusMeta: Record<ReservationStatus, { chip: string; bar: string }> = {
  Confirmed: { chip: 'bg-emerald-50 text-emerald-700 border-emerald-200', bar: 'bg-emerald-400' },
  Pending: { chip: 'bg-amber-50 text-amber-700 border-amber-200', bar: 'bg-amber-400' },
  'Checked-in': { chip: 'bg-sky-50 text-sky-700 border-sky-200', bar: 'bg-sky-500' },
  'Checked-out': { chip: 'bg-slate-100 text-slate-600 border-slate-200', bar: 'bg-slate-400' },
  Cancelled: { chip: 'bg-rose-50 text-rose-600 border-rose-200', bar: 'bg-rose-400' },
  'No-show': { chip: 'bg-violet-50 text-violet-700 border-violet-200', bar: 'bg-violet-400' },
};

export function StatusChip({ status }: { status: RoomStatus | ReservationStatus | string }) {
  const m = (roomStatusMeta as Record<string, { chip: string }>)[status] || (resStatusMeta as Record<string, { chip: string }>)[status] || { chip: 'bg-slate-100 text-slate-600 border-slate-200' };
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${m.chip}`}>{status}</span>;
}

export const taskStatusMeta: Record<string, { chip: string }> = {
  Pending: { chip: 'bg-amber-50 text-amber-700 border-amber-200' },
  'In Progress': { chip: 'bg-sky-50 text-sky-700 border-sky-200' },
  Cleaned: { chip: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  Inspected: { chip: 'bg-slate-100 text-slate-600 border-slate-200' },
};
