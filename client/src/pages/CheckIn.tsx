import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, IdCard, CheckCheck, ChevronRight, ChevronLeft, Zap, BedDouble, ClipboardCheck, CreditCard, Printer, X,
} from 'lucide-react';
import { api } from '../lib/api';
import type { Reservation, Room } from '../lib/types';
import { Badge, Button, Card, Input, Loading, Select, Td, Th, useToast } from '../ui';
import { money, fmtDate, fmtRange, nights, cx, avatarTone, initials, todayISO, addDaysISO } from '../lib/format';
import { ReservationPrint } from '../components/prints';

const STEPS = ['Verify', 'Room', 'Identity', 'Payment'] as const;

export default function CheckIn() {
  const { id } = useParams();
  const nav = useNavigate();
  const { push } = useToast();
  const [res, setRes] = useState<Reservation | null>(null);
  const [rooms, setRooms] = useState<(Room & { bookable: boolean })[]>([]);
  const [cats, setCats] = useState<{ id: number; name: string }[]>([]);
  const [step, setStep] = useState(0);
  const [roomId, setRoomId] = useState<number | null>(null);
  const [idType, setIdType] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [payAmount, setPayAmount] = useState(0);
  const [payMethod, setPayMethod] = useState('Cash');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ receipt: { reservation: Record<string, unknown> } } | null>(null);
  const [express, setExpress] = useState(false);

  useEffect(() => {
    let reservedRoomId: number | null = null;
    api.get<{ reservation: Reservation }>(`/api/reservations/${id}`).then((r) => {
      const resv = r.reservation;
      reservedRoomId = resv.room_id;
      setRes(resv);
      setRoomId(resv.room_id);
      setIdType(resv.id_doc_type || resv.guest_id_type || 'CNIC');
      setIdNumber(resv.id_doc_number || resv.guest_id_number || '');
      // pre-load availability of the reserved category
      return api.get<{ categories: { category: { id: number; name: string }; rooms: (Room & { bookable: boolean })[] }[] }>(
        `/api/rooms/availability?checkIn=${resv.check_in}&checkOut=${resv.check_out}`);
    }).then((a) => {
      if (!a) return;
      setCats(a.categories.map((c) => c.category));
      // the reservation's own pre-assigned room must stay selectable even though
      // the availability engine flags it as "booked" (by this reservation)
      const map = (r: Room & { bookable: boolean }) =>
        (r.bookable || r.id === reservedRoomId) && !['Occupied', 'Dirty', 'Cleaning', 'Maintenance'].includes(r.status)
          ? { ...r, bookable: true } : r;
      setRooms(a.categories.flatMap((c) => c.rooms.map(map)));
    }).catch((e) => push(e.message, 'error'));
  }, [id, push]);

  const room = useMemo(() => rooms.find((r) => r.id === roomId), [rooms, roomId]);
  const remaining = res ? Math.max(0, Math.round(res.rate_per_night * (res.folio?.nights ?? nights(res.check_in, res.check_out)) * 1.17) - (res.advance_payment ?? 0) - (res.paid ?? 0)) : 0;

  if (!res) return <Loading />;
  if (res.status === 'Checked-in') {
    return (
      <div className="p-8 max-w-lg mx-auto card mt-10 text-center">
        <CheckCheck className="size-10 text-emerald-500 mx-auto" />
        <p className="font-display text-xl font-bold text-ink-900 mt-3">Already checked in</p>
        <p className="text-[13px] text-slate-500 mt-1">{res.guest_name} occupies room {res.room_number}. Registration receipt can be reprinted below.</p>
        <div className="mt-5 flex justify-center gap-2"><Button onClick={() => nav('/front-desk')}>Back to front desk</Button></div>
      </div>
    );
  }

  const eligible = (r: Room & { bookable: boolean }) => r.bookable && !['Occupied', 'Dirty', 'Cleaning', 'Maintenance'].includes(r.status);

  const confirm = async () => {
    setBusy(true);
    try {
      const r = await api.post<{ receipt: { reservation: Record<string, unknown> } }>(`/api/reservations/${res.id}/check-in`, {
        roomId, idDocType: idType, idDocNumber: idNumber, express,
        paymentAmount: payAmount || 0, paymentMethod: payMethod, purpose: 'Advance',
      });
      setDone(r);
      push(`${res.guest_name} checked in to room ${room?.number}`, 'success');
    } catch (e) { push((e as Error).message, 'error'); }
    setBusy(false);
  };

  if (done) {
    const rr = done.receipt.reservation as Record<string, string | number>;
    return (
      <div className="p-4 sm:p-6 max-w-3xl mx-auto pb-24">
        <div className="no-print flex justify-between items-center mb-4">
          <Link to="/front-desk" className="text-[13px] font-bold text-slate-500 hover:text-ink-900 flex items-center gap-1.5"><ArrowLeft className="size-4" /> Front desk</Link>
          <div className="flex gap-2">
            <Button onClick={() => window.print()}><Printer className="size-4" /> Print registration receipt</Button>
            <Button variant="gold" onClick={() => nav('/front-desk')}>Done</Button>
          </div>
        </div>
        <ReservationPrint
          kind="Registration Receipt"
          lines={[
            ['Guest', String(rr.guest_name)],
            ['Room', `Room ${rr.room} · ${String(rr.category)}`],
            ['Stay', `${fmtDate(String(rr.check_in))} → ${fmtDate(String(rr.check_out))} · ${rr.nights} nights`],
            ['Guests', `${rr.adults} adults${Number(rr.children) ? `, ${rr.children} children` : ''}`],
            ['ID document', `${rr.id_doc_type || '—'} ${rr.id_doc_number || ''}`],
            ['Rate', `${money(Number(rr.rate))} / night`],
            ['Paid so far', money(Number(rr.paid))],
            ['Balance at check-out', money(Number(rr.balance))],
          ]}
          reference={String(rr.confirmation_no)}
          footer={`Room ${rr.room} registered at ${String(rr.checked_in_at || todayISO())}. Balance is settled at check-out. Thank you for choosing Grand Aurelia.`}
        />
      </div>
    );
  }

  const canNext = [
    true,
    !!roomId && !!room && eligible(room),
    !!(idType && idNumber.trim()),
    true,
  ][step];

  return (
    <div className="p-4 sm:p-6 max-w-[1100px] mx-auto pb-24 anim-fade-up">
      <div className="no-print flex items-center justify-between mb-5">
        <button onClick={() => nav('/front-desk')} className="text-[13px] font-bold text-slate-500 hover:text-ink-900 flex items-center gap-1.5"><ArrowLeft className="size-4" /> Front desk</button>
        <div className="flex items-center gap-2">
          <Button variant={express ? 'gold' : 'outline'} size="sm" onClick={() => setExpress((e) => !e)}><Zap className="size-4" /> Express check-in {express ? 'ON' : 'OFF'}</Button>
        </div>
      </div>

      <h1 className="text-[24px] font-extrabold text-ink-900 tracking-tight font-display">Check-in · {res.guest_name}</h1>
      <p className="text-[13px] text-slate-400 mb-4">Reservation {res.confirmation_no} · {res.category_name} · {fmtRange(res.check_in, res.check_out)}</p>

      {/* steps header */}
      <div className="flex items-center gap-1.5 mb-5 overflow-x-auto no-print">
        {STEPS.map((s, i) => (
          <button key={s} onClick={() => i < step && setStep(i)} className={cx('flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[12.5px] font-bold transition-all',
            i === step ? 'bg-ink-900 text-gold-300' : i < step ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400')}>
            {i < step ? <CheckCheck className="size-3.5" /> : <span className="rounded-full bg-white/20 grid place-items-center size-4 text-[10px]">{i + 1}</span>}
            {s}
            {i < STEPS.length - 1 && <ChevronRight className="size-3.5 opacity-40" />}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-[1fr_300px] gap-4 items-start">
        <Card className="p-5">
          {step === 0 && (
            <div className="space-y-4">
              <h3 className="font-bold text-ink-900 flex items-center gap-2"><ClipboardCheck className="size-4.5 text-gold-500" /> Verify guest & booking</h3>
              <div className="flex items-center gap-3.5">
                <div className={cx('size-12 rounded-xl grid place-items-center text-[14px] font-bold', avatarTone(res.guest_name))}>{initials(res.guest_name)}</div>
                <div>
                  <p className="font-bold text-ink-900 text-[15px]">{res.guest_name} {res.guest_vip ? <Badge tone="gold">VIP</Badge> : null}</p>
                  <p className="text-[12.5px] text-slate-400">{res.guest_nationality} · {res.guest_phone || 'no phone'} · {res.guest_email || 'no email'}</p>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-3 text-[13px]">
                {[
                  ['Arrival', fmtDate(res.check_in)], ['Departure', fmtDate(res.check_out)],
                  ['Nights', `${nights(res.check_in, res.check_out)} nights`], ['Guests', `${res.adults} adults${res.children ? ` · ${res.children} children` : ''}`],
                  ['Category', res.category_name], ['Assigned room', res.room_number ? `Room ${res.room_number}` : 'Not yet assigned'],
                  ['Rate', `${money(res.rate_per_night)} / night`], ['Advance paid', money(res.folio?.paid ?? res.advance_payment ?? 0)],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between rounded-xl bg-canvas px-3.5 py-2.5"><span className="text-slate-400 font-bold text-[12px]">{k}</span><span className="font-semibold">{v}</span></div>
                ))}
              </div>
              {res.special_requests && <div className="rounded-xl bg-gold-50 border border-gold-200 p-3.5 text-[12.5px] text-slate-600">{res.special_requests}</div>}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3">
              <h3 className="font-bold text-ink-900 flex items-center gap-2"><BedDouble className="size-4.5 text-gold-500" /> Assign room</h3>
              {rooms.length === 0 && <p className="text-[13px] text-slate-400">Loading availability…</p>}
              <div className="grid sm:grid-cols-2 gap-2.5 max-h-[380px] overflow-y-auto pr-1">
                {rooms.map((r) => {
                  const ok = eligible(r);
                  const cat = cats.find((c) => c.id === r.category_id);
                  const mismatch = cat && res && cat.id !== res.category_id;
                  return (
                    <button key={r.id} disabled={!ok || mismatch} onClick={() => setRoomId(r.id)}
                      className={cx('text-left rounded-xl border px-3.5 py-3 transition-all',
                        roomId === r.id ? 'border-gold-500 bg-gold-50/60 ring-2 ring-gold-500/20' : ok && !mismatch ? 'border-line hover:border-gold-300' : 'border-line opacity-45 cursor-not-allowed')}>
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-ink-900">Room {r.number}</span>
                        <Badge tone={r.status === 'Available' ? 'green' : 'slate'}>{r.status}</Badge>
                      </div>
                      <p className="text-[11.5px] text-slate-400 mt-0.5">{cat?.name} · floor {r.floor} · {money(r.rate || cat?.base_rate)}/night</p>
                      {!ok && <p className="text-[10.5px] text-rose-500 font-bold mt-1">Booked or unavailable</p>}
                      {mismatch && ok && <p className="text-[10.5px] text-amber-600 font-bold mt-1">Different category than booked</p>}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11.5px] text-slate-400">Only rooms free for {fmtRange(res.check_in, res.check_out)} are selectable — double-bookings are locked out by the system.</p>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h3 className="font-bold text-ink-900 flex items-center gap-2"><IdCard className="size-4.5 text-gold-500" /> Identification</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <Select label="Document type" value={idType} onChange={(e) => setIdType(e.target.value)}>
                  {['CNIC', 'Passport', 'Driving Licence'].map((t) => <option key={t}>{t}</option>)}
                </Select>
                <Input label="Document number *" value={idNumber} onChange={(e) => setIdNumber(e.target.value)} placeholder={idType === 'Passport' ? 'Passport number' : 'e.g. 61101-1234567-8'} />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h3 className="font-bold text-ink-900 flex items-center gap-2"><CreditCard className="size-4.5 text-gold-500" /> Payment or deposit</h3>
              <div className="rounded-xl bg-ink-900 text-gold-300 p-4">
                <div className="flex justify-between text-[13px] font-semibold py-0.5"><span>Room charges ({nights(res.check_in, res.check_out)} × {money(res.rate_per_night)})</span><span>{money(res.rate_per_night * nights(res.check_in, res.check_out))}</span></div>
                <div className="flex justify-between text-[13px] font-semibold py-0.5"><span>Advance already received</span><span>- {money(res.folio?.paid ?? res.advance_payment ?? 0)}</span></div>
                <div className="flex justify-between text-[15px] font-extrabold pt-2 mt-1 border-t border-white/10"><span>Estimated balance</span><span>{money(remaining)}</span></div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Input type="number" min={0} label="Collect now (₨, optional)" value={payAmount} onChange={(e) => setPayAmount(Math.max(0, +e.target.value))} />
                  <div className="flex gap-1.5 mt-2">
                    {[0, remaining, 25000].map((v, i) => (
                      <button key={i} onClick={() => setPayAmount(v)} className={cx('rounded-lg border px-2.5 py-1 text-[11.5px] font-bold', payAmount === v ? 'bg-ink-900 text-gold-300 border-ink-900' : 'border-line text-slate-500 hover:bg-slate-50')}>
                        {i === 0 ? 'Nothing' : i === 1 ? 'Full balance' : '₨ 25,000'}
                      </button>
                    ))}
                  </div>
                </div>
                <Select label="Payment method" value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                  {['Cash', 'Credit Card', 'Debit Card', 'Bank Transfer', 'Online Payment'].map((m) => <option key={m}>{m}</option>)}
                </Select>
              </div>
            </div>
          )}

          {/* nav */}
          <div className="flex justify-between mt-6 pt-4 border-t border-line no-print">
            <Button onClick={() => (step === 0 ? nav('/front-desk') : setStep(step - 1))} variant="ghost"><ChevronLeft className="size-4" /> {step === 0 ? 'Cancel' : 'Back'}</Button>
            {step < 3
              ? <Button variant="gold" disabled={!canNext} onClick={() => setStep(step + 1)}>Continue <ChevronRight className="size-4" /></Button>
              : <Button variant="gold" loading={busy} disabled={!roomId || !idNumber.trim()} onClick={confirm}><CheckCheck className="size-4.5" /> Confirm check-in</Button>}
          </div>
        </Card>

        {/* summary rail */}
        <Card className="p-5 !bg-ink-900 border-0">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-gold-500 mb-3">Arrival summary</p>
          <div className="space-y-2.5 text-[12.5px] text-slate-300">
            {[['Guest', res.guest_name], ['Reference', res.confirmation_no], ['Room', room ? `Room ${room.number}` : '—'], ['Dates', fmtRange(res.check_in, res.check_out)], ['Rate', `${money(res.rate_per_night)}/night`], ['Paying now', payAmount ? money(payAmount) : '—']].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4"><span className="text-slate-500">{k}</span><b className="text-gold-100 text-right truncate">{v}</b></div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-white/10 text-[11.5px] text-slate-500 leading-relaxed">
            On confirmation the reservation becomes <b className="text-gold-300">Checked-in</b>, the room turns <b className="text-gold-300">Occupied</b>, housekeeping receives in-stay notes and a registration receipt is issued.
            {express && <span className="text-emerald-400"> Express mode will skip intermediate confirmations on save.</span>}
          </div>
        </Card>
      </div>
    </div>
  );
}
