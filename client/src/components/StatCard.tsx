import type { LucideIcon } from 'lucide-react';
import { cx } from '../lib/format';
import type { ReactNode } from 'react';

export function StatCard({ icon: Icon, label, value, sub, tone = 'navy', accent, className }: {
  icon: LucideIcon; label: string; value: string | number; sub?: ReactNode; tone?: 'navy' | 'gold' | 'green' | 'sky' | 'rose' | 'amber' | 'indigo'; accent?: boolean; className?: string;
}) {
  const tones: Record<string, string> = {
    navy: 'bg-ink-900 text-gold-300',
    gold: 'ga-seal text-white',
    green: 'bg-emerald-500/12 text-emerald-600',
    sky: 'bg-sky-500/12 text-sky-600',
    rose: 'bg-rose-500/12 text-rose-500',
    amber: 'bg-amber-500/12 text-amber-600',
    indigo: 'bg-indigo-500/12 text-indigo-600',
  };
  return (
    <div className={cx('card p-4 flex gap-3.5 items-start hover:shadow-pop hover:-translate-y-px transition-all duration-200 group', accent && 'border-gold-300/60', className)}>
      <div className={cx('size-10 rounded-xl grid place-items-center shrink-0 transition group-hover:scale-105', tones[tone])}>
        <Icon className="size-5" strokeWidth={2} />
      </div>
      <div className="min-w-0">
        <p className="text-[11.5px] font-bold text-slate-400 uppercase tracking-wider leading-tight">{label}</p>
        <p className="text-[22px] font-extrabold text-ink-900 leading-tight font-display tabular-nums">{value}</p>
        {sub && <div className="text-[12px] text-slate-500 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}
