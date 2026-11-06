import {
  createContext, useContext, useEffect, useState, type ButtonHTMLAttributes,
  type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes,
} from 'react';
import { X, Check, AlertTriangle, Loader2, ChevronDown, Search } from 'lucide-react';
import { cx } from '../lib/format';

/* ================= Toasts ================= */
const ToastCtx = createContext<{ push: (msg: string, kind?: 'success' | 'error' | 'info') => void }>({ push: () => {} });
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<{ id: number; msg: string; kind: string }[]>([]);
  const push = (msg: string, kind: 'success' | 'error' | 'info' = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  };
  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="no-print fixed bottom-5 right-5 z-[100] flex flex-col gap-2 w-[min(92vw,380px)]">
        {toasts.map((t) => (
          <div key={t.id} className="anim-fade-up rounded-xl border border-line bg-white shadow-pop px-4 py-3 flex items-start gap-2.5">
            {t.kind === 'error' ? <AlertTriangle className="size-4.5 text-rose-500 mt-0.5 shrink-0" />
              : <Check className={cx('size-4.5 mt-0.5 shrink-0', t.kind === 'success' ? 'text-emerald-500' : 'text-sky-500')} />}
            <p className="text-sm text-slate-700 leading-snug">{t.msg}</p>
            <button onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))} className="ml-auto text-slate-300 hover:text-slate-500"><X className="size-4" /></button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ================= Button ================= */
const btnStyles = {
  primary: 'bg-ink-900 text-gold-50 hover:bg-ink-800 border border-ink-900',
  gold: 'ga-seal text-white hover:brightness-105 border border-gold-600/60',
  outline: 'bg-white text-slate-700 border border-line hover:border-slate-300 hover:bg-slate-50',
  ghost: 'text-slate-600 hover:bg-slate-100 border border-transparent',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 border border-rose-600',
  soft: 'bg-gold-50 text-gold-600 border border-gold-100 hover:bg-gold-100',
};
export function Button({ variant = 'outline', size = 'md', className, loading, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof btnStyles; size?: 'sm' | 'md' | 'lg'; loading?: boolean;
}) {
  return (
    <button
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-150 active:scale-[.98] disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap',
        size === 'sm' ? 'text-[13px] px-3 py-1.5' : size === 'lg' ? 'text-[15px] px-5 py-3' : 'text-sm px-4 py-2.5',
        btnStyles[variant], className)}
      disabled={props.disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

/* ================= Inputs ================= */
export function Input({ label, className, ...props }: InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <div>
      {label && <label className="label-base">{label}</label>}
      <input className={cx('input-base', className)} {...props} />
    </div>
  );
}
export function Textarea({ label, className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) {
  return (
    <div>
      {label && <label className="label-base">{label}</label>}
      <textarea className={cx('input-base min-h-[76px] resize-y', className)} {...props} />
    </div>
  );
}
export function Select({ label, className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  return (
    <div>
      {label && <label className="label-base">{label}</label>}
      <div className="relative">
        <select className={cx('input-base appearance-none pr-9', className)} {...props}>{children}</select>
        <ChevronDown className="size-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>
    </div>
  );
}

/* ================= Field error ================= */
export function FieldError({ err }: { err?: string }) {
  if (!err) return null;
  return <p className="text-[12.5px] text-rose-500 mt-1 font-medium">{err}</p>;
}

/* ================= Card ================= */
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('card', className)}>{children}</div>;
}
export function SectionTitle({ title, subtitle, action, className }: { title: string; subtitle?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cx('flex items-center justify-between gap-3 mb-4', className)}>
      <div>
        <h3 className="text-[15px] font-bold text-ink-900 tracking-tight">{title}</h3>
        {subtitle && <p className="text-[12.5px] text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/* ================= Badge ================= */
export function Badge({ tone = 'slate', className, children }: { tone?: 'gold' | 'green' | 'blue' | 'red' | 'slate' | 'amber' | 'violet' | 'sky'; className?: string; children: ReactNode }) {
  const tones = {
    gold: 'bg-gold-50 text-gold-600 border-gold-300/50',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    blue: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    red: 'bg-rose-50 text-rose-600 border-rose-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    violet: 'bg-violet-50 text-violet-700 border-violet-200',
    sky: 'bg-sky-50 text-sky-700 border-sky-200',
    slate: 'bg-slate-50 text-slate-600 border-slate-200',
  };
  return <span className={cx('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11.5px] font-semibold', tones[tone], className)}>{children}</span>;
}

/* ================= Modal ================= */
export function Modal({ open, onClose, title, subtitle, width = 'max-w-xl', children, footer }: {
  open: boolean; onClose: () => void; title?: string; subtitle?: string; width?: string; children: ReactNode; footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', h); document.body.style.overflow = ''; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8">
      <div className="absolute inset-0 bg-ink-950/45 backdrop-blur-[2px]" onClick={onClose} />
      <div className={cx('anim-modal relative bg-white rounded-2xl shadow-pop border border-line w-full flex flex-col max-h-[92vh]', width)}>
        {(title || subtitle) && (
          <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-line">
            <div>
              {title && <h2 className="text-lg font-bold text-ink-900 tracking-tight">{title}</h2>}
              {subtitle && <p className="text-[13px] text-slate-400 mt-0.5">{subtitle}</p>}
            </div>
            <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"><X className="size-4.5" /></button>
          </div>
        )}
        <div className="overflow-y-auto px-6 py-5 flex-1">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-line bg-slate-50/60 rounded-b-2xl flex justify-end gap-2.5">{footer}</div>}
      </div>
    </div>
  );
}

/* ================= Drawer (side panel) ================= */
export function Drawer({ open, onClose, title, children, footer, width = 'max-w-2xl' }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; width?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="no-print fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-ink-950/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className={cx('anim-drawer relative bg-canvas w-full h-full flex flex-col border-l border-line', width)}>
        <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-line">
          <h2 className="text-lg font-bold text-ink-900 tracking-tight">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"><X className="size-4.5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
        {footer && <div className="px-6 py-4 bg-white border-t border-line flex justify-end gap-2.5">{footer}</div>}
      </div>
    </div>
  );
}

/* ================= Tabs ================= */
export function Tabs<T extends string>({ tabs, value, onChange, className }: {
  tabs: { id: T; label: string; badge?: number | string }[]; value: T; onChange: (v: T) => void; className?: string;
}) {
  return (
    <div className={cx('inline-flex items-center gap-1 rounded-xl bg-slate-100 p-1', className)}>
      {tabs.map((t) => (
        <button key={t.id} onClick={() => onChange(t.id)}
          className={cx('rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition-all flex items-center gap-1.5',
            value === t.id ? 'bg-white text-ink-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
          {t.label}
          {t.badge != null && <span className={cx('rounded-full px-1.5 min-w-5 text-center text-[10.5px] font-bold', value === t.id ? 'bg-ink-900 text-gold-300' : 'bg-slate-200 text-slate-500')}>{t.badge}</span>}
        </button>
      ))}
    </div>
  );
}

/* ================= Table helpers ================= */
export const Th = ({ className, children }: { className?: string; children?: ReactNode }) =>
  <th className={cx('px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-line', className)}>{children}</th>;
export const Td = ({ className, children }: { className?: string; children?: ReactNode }) =>
  <td className={cx('px-4 py-3 text-sm text-slate-700 border-b border-slate-100', className)}>{children}</td>;

export function EmptyState({ icon: Icon, title, subtitle, action }: { icon: typeof Search; title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="text-center py-14 px-6">
      {Icon && <div className="mx-auto size-12 rounded-2xl bg-slate-100 grid place-items-center mb-3"><Icon className="size-5.5 text-slate-400" /></div>}
      <p className="font-bold text-slate-600">{title}</p>
      {subtitle && <p className="text-[13px] text-slate-400 mt-1 max-w-sm mx-auto">{subtitle}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ================= Spinner / loading ================= */
export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="grid place-items-center py-20 text-slate-400 gap-2">
      <Loader2 className="size-6 animate-spin text-gold-500" />
      <p className="text-[13px]">{label}</p>
    </div>
  );
}
