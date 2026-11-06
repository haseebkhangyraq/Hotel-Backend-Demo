const nf = new Intl.NumberFormat('en-PK');

export const money = (n: number | undefined | null) => `₨ ${nf.format(Math.round(Number(n) || 0))}`;
export const compact = (n: number) => {
  if (n >= 1e6) return `₨ ${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `₨ ${(n / 1e3).toFixed(0)}k`;
  return `₨ ${n}`;
};

export const fmtDate = (d?: string | null) => {
  if (!d) return '—';
  const dt = d.includes(' ') ? d.slice(0, 10) : d;
  const [y, m, day] = dt.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
};
export const fmtTime = (d?: string | null) => {
  if (!d) return '—';
  const t = d.includes(' ') ? d.slice(11, 16) : '';
  return t || '—';
};
export const fmtRange = (a: string, b: string) => {
  const [, m1, d1] = a.split('-');
  const [, m2, d2] = b.split('-');
  const MO = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d1} ${MO[+m1]} – ${d2} ${MO[+m2]}`;
};
export const todayISO = () => new Date().toISOString().slice(0, 10);
export const addDaysISO = (iso: string, n: number) => {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export const nights = (a: string, b: string) =>
  Math.max(0, Math.round((Date.parse(b + 'T12:00Z') - Date.parse(a + 'T12:00Z')) / 86400000));

export const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`;

export const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');

const AVATAR_TONES = ['bg-amber-100 text-amber-800', 'bg-sky-100 text-sky-800', 'bg-emerald-100 text-emerald-800', 'bg-rose-100 text-rose-800', 'bg-violet-100 text-violet-800', 'bg-teal-100 text-teal-800'];
export const avatarTone = (name: string) => AVATAR_TONES[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % AVATAR_TONES.length];

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');
