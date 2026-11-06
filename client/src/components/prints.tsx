import type { ReactNode } from 'react';

export function CompanyHead({ right }: { right?: ReactNode }) {
  return (
    <div className="hero-nights text-white px-8 py-7 flex items-center justify-between rounded-t-2xl">
      <div className="flex items-center gap-4">
        <div className="ga-seal size-12 rounded-2xl grid place-items-center"><span className="font-display text-[17px]">GA</span></div>
        <div>
          <p className="font-display text-xl font-semibold text-gold-300">Grand Aurelia Hotel & Resort</p>
          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400 font-bold">Islamabad · +92 51 111 200 300</p>
        </div>
      </div>
      {right}
    </div>
  );
}

export function ReservationPrint({ kind, reference, lines, totals, footer }: {
  kind: string; reference: string; lines: [string, string][]; totals?: [string, string][]; footer: string;
}) {
  return (
    <div className="print-page">
      <div className="card overflow-hidden">
        <CompanyHead right={
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wider font-bold text-slate-400">{kind}</p>
            <p className="font-mono text-[17px] font-bold text-gold-300">{reference}</p>
          </div>
        } />
        <div className="px-8 py-6 space-y-5">
          <dl className="divide-y divide-slate-100">
            {lines.map(([k, v]) => (
              <div key={k} className="flex justify-between py-2.5 text-[13.5px]">
                <dt className="text-slate-400 font-bold text-[12px] pt-0.5">{k}</dt>
                <dd className="font-bold text-ink-900 text-right max-w-[65%]">{v}</dd>
              </div>
            ))}
          </dl>
          {totals && (
            <div className="rounded-2xl bg-canvas p-5 space-y-0.5">
              {totals.map(([k, v], i) => (
                <div key={k} className={`flex justify-between py-0.5 ${i >= totals.length - 2 ? 'text-[15px] font-extrabold text-ink-900 border-t border-line pt-2' : 'text-[13px] font-semibold text-slate-600'}`}>
                  <span>{k}</span><span className="tabular-nums">{v}</span>
                </div>
              ))}
            </div>
          )}
          <p className="text-[11.5px] text-slate-400 leading-relaxed">{footer}</p>
        </div>
      </div>
    </div>
  );
}
