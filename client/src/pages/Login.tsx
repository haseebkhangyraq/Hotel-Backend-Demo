import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { LogIn, KeyRound, ShieldCheck, ConciergeBell, Sparkles, Calculator, Star } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { Button, Input, useToast } from '../ui';

const DEMO = [
  { role: 'Administrator', name: 'Umar Farooq', email: 'umar.farooq@aurelia.pk', icon: ShieldCheck, note: 'Full control' },
  { role: 'Manager', name: 'Layla Ahmed', email: 'layla.ahmed@aurelia.pk', icon: Star, note: 'Everything except user admin' },
  { role: 'Receptionist', name: 'Ali Raza', email: 'ali.raza@aurelia.pk', icon: ConciergeBell, note: 'Front desk focus' },
  { role: 'Housekeeping', name: 'Sana Bibi', email: 'sana.bibi@aurelia.pk', icon: Sparkles, note: 'Cleaning board only' },
  { role: 'Accountant', name: 'Fabeha Naveed', email: 'fabeha.naveed@aurelia.pk', icon: Calculator, note: 'Billing & reports' },
];

export default function Login() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const { push } = useToast();
  const [email, setEmail] = useState('umar.farooq@aurelia.pk');
  const [password, setPassword] = useState('demo123');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  if (user) return <Navigate to="/" replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try { await login(email, password); nav('/', { replace: true }); }
    catch (er) { setErr((er as Error).message); push((er as Error).message, 'error'); }
    finally { setBusy(false); }
  };

  return (
    <div className="min-h-full grid lg:grid-cols-[1.15fr_1fr]">
      {/* Brand panel */}
      <div className="hero-nights text-white relative overflow-hidden hidden lg:flex flex-col justify-between p-12">
        <div className="pointer-events-none absolute inset-0 opacity-[0.06]" style={{
          backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 14px, #C6A15B 14px, #C6A15B 15px)',
        }} />
        <div className="relative">
          <div className="flex items-center gap-3.5">
            <div className="ga-seal size-12 rounded-2xl grid place-items-center shadow-lg shadow-gold-500/20">
              <span className="font-display text-lg font-semibold text-white">GA</span>
            </div>
            <div>
              <p className="font-display text-xl font-semibold text-gold-300">Grand Aurelia</p>
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400 font-bold">Hotel & Resort · Islamabad</p>
            </div>
          </div>
        </div>

        <div className="relative max-w-lg">
          <h1 className="font-display text-[42px] leading-[1.12] font-semibold text-white">
            The management suite behind a flawless stay.
          </h1>
          <p className="mt-5 text-[15px] leading-relaxed text-slate-300/90">
            Reservations, front desk, housekeeping, billing and reporting — one calm, elegant control centre for the whole hotel.
          </p>
          <div className="mt-8 grid grid-cols-3 gap-3">
            {[['32', 'Rooms & suites'], ['6', 'Categories'], ['Portal', 'Website API']].map(([v, k]) => (
              <div key={k} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5">
                <p className="font-display text-[22px] font-semibold text-gold-300">{v}</p>
                <p className="text-[11px] uppercase tracking-wider text-slate-400 font-bold mt-0.5">{k}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-[12px] text-slate-500">© 2026 Grand Aurelia Hotel & Resort — internal management prototype</p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6 sm:p-12 bg-white">
        <div className="w-full max-w-[420px]">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="ga-seal size-10 rounded-xl grid place-items-center"><span className="font-display text-[14px] font-semibold text-white">GA</span></div>
            <div><p className="font-display font-semibold text-ink-900 text-[17px]">Grand Aurelia</p><p className="text-[10px] uppercase tracking-[0.18em] text-slate-400 font-bold">Management Suite</p></div>
          </div>

          <h2 className="text-[26px] font-extrabold text-ink-900 tracking-tight">Sign in</h2>
          <p className="text-[13.5px] text-slate-400 mt-1">Use a demo profile below, or the credentials your team was given.</p>

          <form onSubmit={submit} className="mt-7 space-y-4">
            <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
            <div>
              <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
              {err && <p className="text-[12.5px] text-rose-500 mt-1.5 font-medium">{err}</p>}
            </div>
            <Button type="submit" variant="primary" size="lg" loading={busy} className="w-full">
              <LogIn className="size-4.5" /> Sign in to the suite
            </Button>
          </form>

          <div className="mt-8">
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 mb-2.5">
              <KeyRound className="size-3.5" /> Demo profiles · password <code className="text-gold-600">demo123</code>
            </p>
            <div className="space-y-2">
              {DEMO.map((d) => (
                <button key={d.email} type="button"
                  onClick={() => { setEmail(d.email); setPassword('demo123'); }}
                  className={`w-full flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-all ${email === d.email ? 'border-gold-400 bg-gold-50/60 shadow-card' : 'border-line hover:border-gold-300 bg-white'}`}>
                  <div className="size-9 rounded-lg bg-ink-900 text-gold-300 grid place-items-center shrink-0"><d.icon className="size-4.5" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-bold text-ink-900">{d.role} <span className="font-medium text-slate-400">· {d.name}</span></p>
                    <p className="text-[11.5px] text-slate-400 truncate">{d.note}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
