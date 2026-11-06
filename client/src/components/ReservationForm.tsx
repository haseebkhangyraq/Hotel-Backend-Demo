import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import type { Guest, Room, RoomCategory, BookingSource, Reservation } from '../lib/types';
import { Modal, Button, Input, Select, Textarea, FieldError, useToast } from '../ui';
import { money, nights, todayISO, addDaysISO, fmtDate, cx, avatarTone, initials } from '../lib/format';
import { UserRoundPlus, Search, Check, AlertTriangle } from 'lucide-react';

export interface ReservationDraft {
  id?: number;
  guest_id: number | null;
  category_id: number | null;
  room_id: number | null;
  check_in: string;
  check_out: string;
  adults: number;
  children: number;
  rate_per_night: number;
  discount: number;
  advance_payment: number;
  payment_method: string;
  source: BookingSource;
  status: 'Confirmed' | 'Pending';
  breakfast_plan: string;
  special_requests: string;
  notes: string;
}

export function emptyDraft(): ReservationDraft {
  return {
    guest_id: null, category_id: null, room_id: null,
    check_in: todayISO(), check_out: addDaysISO(todayISO(), 2),
    adults: 2, children: 0, rate_per_night: 0, discount: 0, advance_payment: 0,
    payment_method: 'Cash', source: 'Reception', status: 'Confirmed', breakfast_plan: 'none',
    special_requests: '', notes: '',
  };
}

export function draftFromReservation(r: Reservation): ReservationDraft {
  return {
    id: r.id, guest_id: r.guest_id, category_id: r.category_id, room_id: r.room_id,
    check_in: r.check_in, check_out: r.check_out, adults: r.adults, children: r.children,
    rate_per_night: r.rate_per_night, discount: r.discount, advance_payment: r.advance_payment,
    payment_method: 'Cash', source: r.source, status: r.status === 'Pending' ? 'Pending' : 'Confirmed',
    breakfast_plan: r.breakfast_plan || 'none', special_requests: r.special_requests || '', notes: r.notes || '',
  };
}

/* ------------------------------------------------ Quick guest create */
export function QuickGuestModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (g: Guest) => void }) {
  const { push } = useToast();
  const [f, setF] = useState({ full_name: '', phone: '', email: '', nationality: 'Pakistan', id_type: 'CNIC', id_number: '', vip: false } as Partial<Guest> & { vip?: boolean });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const e: Record<string, string> = {};
    if (!f.full_name?.trim()) e.full_name = 'Guest name is required';
    if (f.email && !/^\S+@\S+\.\S+$/.test(f.email)) e.email = 'Enter a valid email';
    setErrs(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const r = await api.post<{ guest: Guest }>('/api/guests', f);
      push(`${r.guest.full_name} added to guest profiles`, 'success');
      onCreated(r.guest);
      setF({ full_name: '', phone: '', email: '', nationality: 'Pakistan', id_type: 'CNIC', id_number: '', vip: false });
      onClose();
    } catch (err) { push((err as Error).message, 'error'); }
    setBusy(false);
  };
  return (
    <Modal open={open} onClose={onClose} title="Register guest" subtitle="A quick profile to attach to this reservation"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" loading={busy} onClick={save}>Save guest</Button></>}>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <Input label="Full name *" value={f.full_name || ''} onChange={(e) => setF({ ...f, full_name: e.target.value })} placeholder="e.g. Sara Malik" />
          <FieldError err={errs.full_name} />
        </div>
        <Input label="Phone" value={f.phone || ''} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="+92 3xx xxx xxxx" />
        <div>
          <Input label="Email" value={f.email || ''} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="guest@email.com" />
          <FieldError err={errs.email} />
        </div>
        <Select label="Nationality" value={f.nationality} onChange={(e) => setF({ ...f, nationality: e.target.value })}>
          {['Pakistan', 'United Kingdom', 'United States', 'Germany', 'United Arab Emirates', 'Saudi Arabia', 'Canada', 'Australia', 'Portugal', 'Other'].map((n) => <option key={n}>{n}</option>)}
        </Select>
        <Select label="ID type" value={f.id_type} onChange={(e) => setF({ ...f, id_type: e.target.value })}>
          {['CNIC', 'Passport', 'Driving Licence'].map((n) => <option key={n}>{n}</option>)}
        </Select>
        <div className="sm:col-span-2"><Input label={f.id_type === 'Passport' ? 'Passport number' : 'ID number'} value={f.id_number || ''} onChange={(e) => setF({ ...f, id_number: e.target.value })} /></div>
        <label className="sm:col-span-2 flex items-center gap-2.5 cursor-pointer select-none">
          <input type="checkbox" checked={!!f.vip} onChange={(e) => setF({ ...f, vip: e.target.checked })} className="size-4 accent-gold-500" />
          <span className="text-[13px] font-semibold text-slate-600">Mark as VIP guest</span>
        </label>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------ Guest picker */
function GuestPicker({ value, onChange, onQuickCreate }: { value: Guest | null; onChange: (g: Guest) => void; onQuickCreate: () => void }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Guest[]>([]);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (q.trim().length < 1) { setResults([]); return; }
    const t = setTimeout(() => {
      api.get<{ guests: Guest[] }>(`/api/guests?q=${encodeURIComponent(q)}`).then((r) => setResults(r.guests.slice(0, 6))).catch(() => {});
    }, 180);
    return () => clearTimeout(t);
  }, [q]);

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-gold-300/60 bg-gold-50/60 px-3.5 py-2.5">
        <div className={cx('size-9 rounded-lg grid place-items-center text-[12px] font-bold', avatarTone(value.full_name))}>{initials(value.full_name)}</div>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-bold text-ink-900 truncate">{value.full_name}{!!value.vip && <span className="ml-2 rounded-full bg-ink-900 text-gold-300 text-[9px] font-bold px-2 py-0.5 align-middle">VIP</span>}</p>
          <p className="text-[12px] text-slate-500 truncate">{value.phone || value.email || 'No contact details'}</p>
        </div>
        <button onClick={() => onChange(null as never)} className="text-[12px] font-bold text-slate-400 hover:text-rose-500 px-2">Change</button>
      </div>
    );
  }
  return (
    <div className="relative">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="size-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => setTimeout(() => setFocused(false), 150)}
            placeholder="Search guest by name, phone, email or CNIC…" className="input-base pl-9" />
          {focused && !results.length && q.trim() && <p className="absolute z-20 left-0 right-0 mt-1 card p-3 text-[12.5px] text-slate-400">No guests found — use “New guest”.</p>}
        </div>
        <Button variant="soft" onClick={onQuickCreate}><UserRoundPlus className="size-4" /> New guest</Button>
      </div>
      {focused && results.length > 0 && (
        <div className="absolute z-20 left-0 right-0 mt-1 card p-1.5 shadow-pop anim-fade-up">
          {results.map((g) => (
            <button key={g.id} onMouseDown={() => onChange(g)} className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-gold-50 text-left transition">
              <div className={cx('size-8 rounded-lg grid place-items-center text-[11px] font-bold shrink-0', avatarTone(g.full_name))}>{initials(g.full_name)}</div>
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-ink-900 truncate">{g.full_name} {!!g.vip && <span className="text-[9.5px] bg-ink-900 text-gold-300 rounded-full px-1.5 py-0.5 font-bold align-middle">VIP</span>}</p>
                <p className="text-[11.5px] text-slate-400 truncate">{g.phone} {g.email && `· ${g.email}`}</p>
              </div>
              <Check className="ml-auto size-4 text-gold-500 opacity-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------ Main reservation form */
export function ReservationFormModal({
  open, onClose, initial, onSaved, presetSource, title = 'New reservation',
}: {
  open: boolean; onClose: () => void; initial?: ReservationDraft; onSaved: (r: Reservation) => void;
  presetSource?: BookingSource; title?: string;
}) {
  const { push } = useToast();
  const [cats, setCats] = useState<RoomCategory[]>([]);
  const [avail, setAvail] = useState<Record<number, Room[]>>({});
  const [guestsQ, setGuestsQ] = useState<string>('');
  const [f, setF] = useState<ReservationDraft>(initial || emptyDraft());
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [quickGuest, setQuickGuest] = useState(false);
  const [pickedGuest, setPickedGuest] = useState<Guest | null>(null);

  const editing = !!initial?.id;
  const nights_ = nights(f.check_in, f.check_out);

  useEffect(() => {
    api.get<{ categories: RoomCategory[] }>('/api/room-categories').then((r) => setCats(r.categories)).catch(() => {});
  }, []);

  useEffect(() => {
    if (open) {
      const base = initial || { ...emptyDraft(), ...(presetSource ? { source: presetSource } : {}) };
      setF(base);
      setErrs({});
      setPickedGuest(null);
      if (base.guest_id) {
        api.get<{ guest: Guest }>(`/api/guests/${base.guest_id}`).then((r) => setPickedGuest(r.guest)).catch(() => {});
      }
    }
  }, [open, initial, presetSource]);

  // fetch availability when dates/category change
  useEffect(() => {
    if (!open || !f.check_in || !f.check_out || f.check_out <= f.check_in) return;
    api.get<{ categories: { category: RoomCategory; rooms: (Room & { bookable: boolean })[] }[] }>(
      `/api/rooms/availability?checkIn=${f.check_in}&checkOut=${f.check_out}`)
      .then((r) => setAvail(Object.fromEntries(r.categories.map((c) => [c.category.id, c.rooms.filter((x) => x.bookable || (editing && x.id === (initial?.room_id ?? null)))]))))
      .catch(() => {});
  }, [open, f.check_in, f.check_out, editing, initial?.room_id]);

  const cat = useMemo(() => cats.find((c) => c.id === f.category_id), [cats, f.category_id]);
  const roomList = f.category_id ? avail[f.category_id] || [] : [];
  const selectedRoom = roomList.find((r) => r.id === f.room_id);
  const effectiveRate = f.rate_per_night || cat?.base_rate || 0;
  const roomTotal = nights_ * effectiveRate;
  const taxable = Math.max(0, roomTotal - (f.discount || 0));
  const tax = Math.round(taxable * 0.17);
  const total = taxable + tax;
  const balance = Math.max(0, total - (f.advance_payment || 0));

  const save = async () => {
    const e: Record<string, string> = {};
    if (!pickedGuest) e.guest_id = 'Select or create a guest';
    if (!f.category_id) e.category_id = 'Select a room category';
    if (f.check_out <= f.check_in) e.check_out = 'Check-out must be after check-in';
    setErrs(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    const payload = { ...f, guest_id: pickedGuest?.id, room_id: f.room_id || null, rate_per_night: effectiveRate };
    try {
      const res = editing
        ? await api.put<{ reservation: Reservation }>(`/api/reservations/${initial!.id}`, payload)
        : await api.post<{ reservation: Reservation }>('/api/reservations', payload);
      push(editing ? `Reservation ${res.reservation.confirmation_no} updated` : `Reservation ${res.reservation.confirmation_no} created`);
      onSaved(res.reservation);
      onClose();
    } catch (err) {
      const er = err as Error & { details?: Record<string, string> };
      setErrs(er.details || {});
      push(er.message, 'error');
    } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} width="max-w-3xl" title={editing ? `Edit reservation · ${initial?.confirmation_no || ''}` : title}
      subtitle={editing ? 'Modify stay details — only Confirmed or Pending reservations can be edited.' : 'Guest, room selection, rate and payment details. Overlapping bookings are blocked automatically.'}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="gold" loading={busy} onClick={save}>{editing ? 'Save changes' : 'Create reservation'}</Button></>}>
      <div className="grid sm:grid-cols-2 gap-x-5 gap-y-4">
        <div className="sm:col-span-2">
          <label className="label-base">Guest profile *</label>
          <GuestPicker value={pickedGuest} onChange={(g) => setPickedGuest(g)} onQuickCreate={() => setQuickGuest(true)} />
          <FieldError err={errs.guest_id} />
        </div>

        <div className="relative">
          <Input type="date" label="Check-in date *" min={todayISO()} value={f.check_in} onChange={(e) => setF({ ...f, check_in: e.target.value, check_out: addDaysISO(e.target.value, Math.max(1, nights(f.check_in, f.check_out))) })} />
          <FieldError err={errs.check_in} />
        </div>
        <div>
          <Input type="date" label="Check-out date *" min={addDaysISO(f.check_in, 1)} value={f.check_out} onChange={(e) => setF({ ...f, check_out: e.target.value })} />
          <FieldError err={errs.check_out} />
        </div>
        <div className="flex items-end"><div className="w-full rounded-xl bg-ink-900 text-gold-300 px-3.5 py-2.5 text-sm font-bold">{nights_} night{nights_ === 1 ? '' : 's'} stay</div></div>

        <div>
          <Input type="number" min={1} label="Adults" value={f.adults} onChange={(e) => setF({ ...f, adults: Math.max(1, +e.target.value) })} />
          <FieldError err={errs.adults} />
        </div>
        <Input type="number" min={0} label="Children" value={f.children} onChange={(e) => setF({ ...f, children: Math.max(0, +e.target.value) })} />
        <div className="sm:col-span-2 grid sm:grid-cols-2 gap-x-5 gap-y-4">
          <div>
            <Select label="Room category *" value={f.category_id ?? ''} onChange={(e) => {
              const id = Number(e.target.value) || null;
              const c = cats.find((x) => x.id === id);
              setF((p) => ({ ...p, category_id: id, room_id: null, rate_per_night: c?.base_rate || 0 }));
            }}>
              <option value="">Select category…</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.name} — {money(c.base_rate)}/night</option>)}
            </Select>
            <FieldError err={errs.category_id} />
          </div>
          <Select label={`Room ${f.check_in && f.check_out ? `(available ${f.check_in} → ${f.check_out})` : ''}`} value={f.room_id ?? ''} onChange={(e) => setF({ ...f, room_id: Number(e.target.value) || null })}>
            <option value="">Leave unassigned (choose later)</option>
            {roomList.map((r) => <option key={r.id} value={r.id}>Room {r.number} · floor {r.floor} · {r.status}</option>)}
          </Select>
        </div>
        {f.category_id && !selectedRoom && roomList.length === 0 && (
          <div className="sm:col-span-2 flex items-center gap-2.5 rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-2.5 text-[13px] text-amber-700 font-semibold">
            <AlertTriangle className="size-4 shrink-0" /> No rooms of this category are free for the selected dates — pick other dates.
          </div>
        )}
        {cat && (
          <p className="sm:col-span-2 text-[12.5px] text-slate-400 -mt-1">{cat.bed} · up to {cat.max_occupancy} guests · {cat.size_sqm} m² · {cat.amenities.slice(0, 4).join(' · ')}</p>
        )}

        <Input type="number" min={0} step={100} label="Rate per night (₨)" value={f.rate_per_night} onChange={(e) => setF({ ...f, rate_per_night: Number(e.target.value) })} />
        <Input type="number" min={0} label="Discount (₨)" value={f.discount} onChange={(e) => setF({ ...f, discount: Number(e.target.value) })} />
        <Select label="Booking source" value={f.source} onChange={(e) => setF({ ...f, source: e.target.value as BookingSource })} disabled={editing}>
          {(['Website', 'Reception', 'Phone', 'Walk-in'] as BookingSource[]).map((s) => <option key={s}>{s}</option>)}
        </Select>
        <Select label="Status on save" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as 'Confirmed' | 'Pending' })}>
          <option>Confirmed</option><option>Pending</option>
        </Select>
        <div>
          <Select label="Advance payment method" value={f.payment_method} onChange={(e) => setF({ ...f, payment_method: e.target.value })}>
            {['Cash', 'Credit Card', 'Debit Card', 'Bank Transfer', 'Online Payment'].map((m) => <option key={m}>{m}</option>)}
          </Select>
        </div>
        <Input type="number" min={0} label="Advance payment (₨)" value={f.advance_payment} onChange={(e) => setF({ ...f, advance_payment: Number(e.target.value) })} />

        <Textarea className="sm:col-span-2" label="Special requests" value={f.special_requests} onChange={(e) => setF({ ...f, special_requests: e.target.value })} placeholder="High floor, airport transfer, allergies…" />
        <Textarea className="sm:col-span-2" label="Internal notes (staff only)" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />

        {/* price summary */}
        <div className="sm:col-span-2 rounded-2xl border border-gold-300/50 bg-gold-50/50 p-4">
          <p className="text-[11.5px] font-bold uppercase tracking-wider text-gold-600 mb-2.5">Charge summary</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[13px]">
            {[
              ['Room charges', money(roomTotal)],
              ['Discount', f.discount ? `− ${money(f.discount)}` : '—'],
              ['Taxes (17% GST)', money(tax)],
              ['Total stay', money(total)],
            ].map(([k, v]) => (
              <div key={k}>
                <p className="text-slate-400 text-[11px] font-bold uppercase tracking-wide">{k}</p>
                <p className={cx('font-bold tabular-nums', k === 'Total stay' ? 'text-ink-900 text-[15px]' : 'text-slate-700')}>{v}</p>
              </div>
            ))}
          </div>
          <div className="mt-2.5 pt-2.5 border-t border-gold-200 flex justify-between text-[13px]">
            <span className="font-semibold text-slate-500">Advance ₨ {new Intl.NumberFormat().format(f.advance_payment || 0)} · Remaining balance</span>
            <span className="font-extrabold text-ink-900 tabular-nums">{money(balance)}</span>
          </div>
        </div>
      </div>
      <QuickGuestModal open={quickGuest} onClose={() => setQuickGuest(false)} onCreated={(g) => { setPickedGuest(g); setGuestsQ(''); }} />
    </Modal>
  );
}

export function QuickAddDeposit(_f?: unknown) { /* placeholder retained for future room-swap flows */ }
