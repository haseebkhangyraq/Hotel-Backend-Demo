import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Star, Crown, UsersRound, Mail, Phone, Globe, IdCard, Heart, StickyNote, Pencil } from 'lucide-react';
import { api } from '../lib/api';
import type { Guest, Reservation } from '../lib/types';
import { Badge, Button, Card, Drawer, EmptyState, Input, Loading, Modal, Select, Td, Th, Textarea, FieldError, useToast } from '../ui';
import { money, fmtDate, fmtRange, nights, cx, avatarTone, initials } from '../lib/format';

export default function Guests() {
  const nav = useNavigate();
  const { push } = useToast();
  const [guests, setGuests] = useState<Guest[] | null>(null);
  const [q, setQ] = useState('');
  const [vipOnly, setVipOnly] = useState(false);
  const [profile, setProfile] = useState<{ guest: Guest; history: Reservation[]; stats: { stays: number; spend: number; reservations: number } } | null>(null);
  const [editing, setEditing] = useState<Partial<Guest> | null>(null);

  const load = useCallback(async () => {
    const ps = new URLSearchParams();
    if (q.trim()) ps.set('q', q.trim());
    if (vipOnly) ps.set('vip', '1');
    const r = await api.get<{ guests: Guest[] }>(`/api/guests?${ps}`);
    setGuests(r.guests);
  }, [q, vipOnly]);
  useEffect(() => { load().catch((e) => push(e.message, 'error')); }, [load, push]);

  const openProfile = async (g: Guest) => {
    const r = await api.get<{ guest: Guest; history: Reservation[]; stats: { stays: number; spend: number; reservations: number } }>(`/api/guests/${g.id}`);
    setProfile(r);
  };

  if (!guests) return <Loading />;
  const vipCount = guests.filter((g) => g.vip).length;

  return (
    <div className="p-4 sm:p-6 pb-24 lg:pb-8 max-w-[1600px] mx-auto space-y-5 anim-fade-up">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-gold-600">Guest relations</p>
          <h1 className="text-[26px] font-extrabold text-ink-900 tracking-tight font-display">Guest Profiles</h1>
          <p className="text-[13px] text-slate-400 mt-0.5">{guests.length} guests · {vipCount} VIP — history, preferences and lifetime value at a glance.</p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="size-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, phone, CNIC…" className="input-base pl-9 w-[230px]" />
          </div>
          <div className="inline-flex rounded-xl border border-line overflow-hidden">
            <button onClick={() => setVipOnly(false)} className={cx('px-3 py-2.5 text-[12.5px] font-bold', !vipOnly ? 'bg-ink-900 text-gold-300' : 'text-slate-400 hover:bg-slate-50')}>All</button>
            <button onClick={() => setVipOnly(true)} className={cx('px-3 py-2.5 text-[12.5px] font-bold inline-flex items-center gap-1.5', vipOnly ? 'bg-ink-900 text-gold-300' : 'text-slate-400 hover:bg-slate-50')}><Crown className="size-3.5" /> VIP</button>
          </div>
          <Button variant="gold" onClick={() => setEditing({ nationality: 'Pakistan', id_type: 'CNIC' })}><Plus className="size-4" /> New guest</Button>
        </div>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-[13px] min-w-[900px]">
          <thead><tr><Th>Guest</Th><Th>Contact</Th><Th>Nationality</Th><Th className="text-center">Stays</Th><Th className="text-right">Lifetime value</Th><Th>Last stay</Th><Th /></tr></thead>
          <tbody>
            {guests.length === 0 && <tr><td colSpan={7}><EmptyState icon={UsersRound} title="No guests found" subtitle="Try a different search." /></td></tr>}
            {guests.map((g) => (
              <tr key={g.id} className="hover:bg-canvas/60 cursor-pointer" onClick={() => openProfile(g)}>
                <Td>
                  <div className="flex items-center gap-2.5">
                    <div className={cx('size-9 rounded-lg grid place-items-center text-[11px] font-bold', avatarTone(g.full_name))}>{initials(g.full_name)}</div>
                    <div>
                      <p className="font-bold text-ink-900 flex items-center gap-1.5">{g.full_name}{!!g.vip && <Crown className="size-3.5 text-gold-500" />}</p>
                      <p className="text-[11px] text-slate-400">{g.id_type} {g.id_number}</p>
                    </div>
                  </div>
                </Td>
                <Td><p>{g.phone || '—'}</p><p className="text-[11px] text-slate-400">{g.email || '—'}</p></Td>
                <Td>{g.nationality || '—'}</Td>
                <Td className="text-center"><span className="font-bold text-ink-900">{g.completed_stays || 0}</span><span className="text-slate-400"> / {g.total_reservations || 0}</span></Td>
                <Td className="text-right font-bold tabular-nums">{money(g.lifetime_value || 0)}</Td>
                <Td>{g.last_stay ? fmtDate(g.last_stay) : <span className="text-slate-300">New</span>}</Td>
                <Td className="text-right">
                  <button onClick={(e) => { e.stopPropagation(); setEditing(g); }} className="p-1.5 rounded-lg text-slate-400 hover:text-ink-900 hover:bg-slate-100"><Pencil className="size-4" /></button>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* profile drawer */}
      <Drawer open={!!profile} onClose={() => setProfile(null)}
        title={profile ? profile.guest.full_name : ''}
        footer={profile && <Button variant="outline" onClick={() => setEditing(profile.guest)}><Pencil className="size-4" /> Edit profile</Button>}>
        {profile && (
          <div className="space-y-5">
            <div className="rounded-2xl hero-nights text-white p-5 flex items-center gap-4">
              <div className={cx('size-14 rounded-2xl grid place-items-center text-[16px] font-bold', avatarTone(profile.guest.full_name))}>{initials(profile.guest.full_name)}</div>
              <div>
                <p className="font-display text-xl font-semibold">{profile.guest.full_name} {profile.guest.vip ? <span className="ga-seal text-[10px] font-bold rounded-full px-2 py-1 align-middle">VIP</span> : null}</p>
                <p className="text-[12.5px] text-slate-400 mt-0.5">{profile.guest.nationality} · guest since {fmtDate(profile.guest.created_at)}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[['Completed stays', String(profile.stats.stays)], ['Total bookings', String(profile.stats.reservations)], ['Lifetime spend', money(profile.stats.spend)]].map(([k, v]) => (
                <div key={k} className="card p-3.5 text-center">
                  <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">{k}</p>
                  <p className="text-[18px] font-extrabold text-ink-900 mt-0.5">{v}</p>
                </div>
              ))}
            </div>

            <Card className="p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">Contact & identity</p>
              <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-[13px]">
                {[[<Phone className="size-3.5" />, profile.guest.phone || '—'], [<Mail className="size-3.5" />, profile.guest.email || '—'], [<Globe className="size-3.5" />, profile.guest.nationality || '—'], [<IdCard className="size-3.5" />, `${profile.guest.id_type || '—'} ${profile.guest.id_number}`]].map((x, i) => (
                  <div key={i} className="flex items-center gap-2">{x[0]}<span className="text-slate-500 font-semibold">{x[1]}</span></div>
                ))}
              </dl>
              {profile.guest.preferences && (
                <div className="mt-3.5 rounded-xl bg-gold-50 border border-gold-200 p-3 text-[12.5px] text-slate-600">
                  <p className="flex items-center gap-1.5 font-bold text-gold-600 mb-0.5"><Heart className="size-3.5" /> Preferences</p>
                  {profile.guest.preferences}
                </div>
              )}
              {profile.guest.notes && (
                <div className="mt-2.5 rounded-xl bg-slate-50 border border-line p-3 text-[12.5px] text-slate-600">
                  <p className="flex items-center gap-1.5 font-bold text-slate-500 mb-0.5"><StickyNote className="size-3.5" /> Notes</p>
                  {profile.guest.notes}
                </div>
              )}
            </Card>

            <Card className="p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">Stay history</p>
              <div className="space-y-2">
                {profile.history.length === 0 && <p className="text-[13px] text-slate-400 text-center py-4">First visit — no history yet.</p>}
                {profile.history.map((r) => (
                  <button key={r.id} onClick={() => nav(`/reservations?q=${r.confirmation_no}`)}
                    className="w-full flex items-center justify-between gap-3 rounded-xl border border-line px-3.5 py-2.5 hover:border-gold-300 hover:bg-gold-50/40 transition text-left">
                    <div>
                      <p className="text-[13px] font-bold text-ink-900">{fmtRange(r.check_in, r.check_out)} · {r.room_number ? `Room ${r.room_number}` : r.category_name}</p>
                      <p className="text-[11.5px] text-slate-400">{r.category_name} · {nights(r.check_in, r.check_out)} nights · {r.source}</p>
                    </div>
                    <span className="text-[11px] font-bold text-slate-500 shrink-0">{r.status}</span>
                  </button>
                ))}
              </div>
            </Card>
          </div>
        )}
      </Drawer>

      <GuestEditModal guest={editing} onClose={() => setEditing(null)} onSaved={() => { load(); if (profile) openProfile(profile.guest); }} />
    </div>
  );
}

function GuestEditModal({ guest, onClose, onSaved }: { guest: Partial<Guest> | null; onClose: () => void; onSaved: () => void }) {
  const { push } = useToast();
  const [f, setF] = useState<Partial<Guest>>({});
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => { setF(guest || {}); setErrs({}); }, [guest]);
  if (!guest) return null;
  const isNew = !guest.id;

  const save = async () => {
    const e: Record<string, string> = {};
    if (!f.full_name?.trim()) e.full_name = 'Name is required';
    if (f.email && !/^\S+@\S+\.\S+$/.test(f.email)) e.email = 'Valid email required';
    setErrs(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      if (isNew) await api.post('/api/guests', f);
      else await api.put(`/api/guests/${guest.id}`, f);
      push(isNew ? `${f.full_name} added` : 'Guest profile updated');
      onSaved(); onClose();
    } catch (er) { push((er as Error).message, 'error'); }
    setBusy(false);
  };

  return (
    <Modal open onClose={onClose} width="max-w-2xl" title={isNew ? 'Register guest' : `Edit ${guest.full_name}`}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="gold" loading={busy} onClick={save}>Save profile</Button></>}>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <Input label="Full name *" value={f.full_name || ''} onChange={(e) => setF({ ...f, full_name: e.target.value })} />
          <FieldError err={errs.full_name} />
        </div>
        <div><Input label="Phone" value={f.phone || ''} onChange={(e) => setF({ ...f, phone: e.target.value })} /><FieldError err={errs.phone} /></div>
        <div><Input label="Email" value={f.email || ''} onChange={(e) => setF({ ...f, email: e.target.value })} /><FieldError err={errs.email} /></div>
        <Select label="Nationality" value={f.nationality || ''} onChange={(e) => setF({ ...f, nationality: e.target.value })}>
          {['Pakistan', 'United Kingdom', 'United States', 'Germany', 'United Arab Emirates', 'Saudi Arabia', 'Canada', 'Australia', 'Portugal', 'Other'].map((n) => <option key={n}>{n}</option>)}
        </Select>
        <Select label="ID type" value={f.id_type || ''} onChange={(e) => setF({ ...f, id_type: e.target.value })}>
          {['CNIC', 'Passport', 'Driving Licence'].map((n) => <option key={n}>{n}</option>)}
        </Select>
        <div className="sm:col-span-2"><Input label="ID number" value={f.id_number || ''} onChange={(e) => setF({ ...f, id_number: e.target.value })} /></div>
        <div className="sm:col-span-2"><Textarea label="Preferences for the stay" value={f.preferences || ''} onChange={(e) => setF({ ...f, preferences: e.target.value })} placeholder="Room type, pillows, dietary, transfer…" /></div>
        <div className="sm:col-span-2"><Textarea label="Internal notes" value={f.notes || ''} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Anything the front desk should know…" /></div>
        <label className="sm:col-span-2 flex items-center gap-2.5 cursor-pointer select-none">
          <input type="checkbox" checked={!!f.vip} onChange={(e) => setF({ ...f, vip: e.target.checked })} className="size-4 accent-gold-500" />
          <span className="text-[13px] font-semibold text-slate-600 flex items-center gap-1.5"><Star className="size-4 text-gold-500" /> VIP guest</span>
        </label>
      </div>
    </Modal>
  );
}
