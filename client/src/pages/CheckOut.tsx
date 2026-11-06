import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, ReceiptText, Plus, Banknote, Minus, Printer,
} from 'lucide-react';
import { api } from '../lib/api';
import type { Folio, PaymentMethod, Reservation } from '../lib/types';
import { Badge, Button, Card, Input, Loading, Modal, Select, Td, Th, useToast } from '../ui';
import { money, fmtDate, fmtTime, fmtRange, nights, cx, avatarTone, initials, todayISO } from '../lib/format';
import { ReservationPrint } from '../components/prints';

const SERVICE_TYPES = ['food', 'laundry', 'minibar', 'spa', 'transfer', 'other'] as const;
const TYPE_LABEL: Record<string, string> = { room: 'Room', food: 'Restaurant', laundry: 'Laundry', minibar: 'Minibar', spa: 'Spa', transfer: 'Transfer', other: 'Other' };

export default function CheckOut() {
  const { id } = useParams();
  const nav = useNavigate();
  const { push } = useToast();
  const [res, setRes] = useState<Reservation | null>(null);
  const [folio, setFolio] = useState<Folio | null>(null);
  const [payMethod, setPayMethod] = useState<PaymentMethod>('Cash');
  const [chargeOpen, setChargeOpen] = useState(false);
  const [charge, setCharge] = useState({ type: 'food', description: '', quantity: 1, unit_price: 0 });
  const [busy, setBusy] = useState(false);
  const [invoice, setInvoice] = useState<{ invoice_no: string } | null>(null);

  const loadFolio = useCallback(async () => {
    const [f, r] = await Promise.all([
      api.get<{ folio: Folio }>(`/api/reservations/${id}/folio`),
      api.get<{ reservation: Reservation }>(`/api/reservations/${id}`),
    ]);
    setRes(r.reservation);
    setFolio(f.folio);
  }, [id]);
  useEffect(() => { loadFolio().catch((e) => push(e.message, 'error')); }, [loadFolio, push]);

  if (!res || !folio) return <Loading />;
  if (res.status !== 'Checked-in') {
    return (
      <div className="p-8 max-w-lg mx-auto card mt-10 text-center">
        <ReceiptText className="size-10 text-slate-400 mx-auto" />
        <p className="font-display text-xl font-bold text-ink-900 mt-3">{res.status === 'Checked-out' ? 'Already checked out' : 'Not checked in yet'}</p>
        <p className="text-[13px] text-slate-500 mt-1">{res.guest_name} · {res.confirmation_no} — status: {res.status}.{res.invoice_no ? ` Invoice ${res.invoice_no} was issued.` : ''}</p>
        <Button className="mt-5" onClick={() => nav('/front-desk')}>Back to front desk</Button>
      </div>
    );
  }

  const postCharge = async () => {
    if (!charge.description.trim() || !(charge.unit_price > 0)) { push('Enter a description and unit price', 'error'); return; }
    setBusy(true);
    try {
      await api.post(`/api/reservations/${res.id}/charges`, charge);
      setChargeOpen(false);
      setCharge({ type: 'food', description: '', quantity: 1, unit_price: 0 });
      await loadFolio();
      push('Charge posted to folio');
    } catch (e) { push((e as Error).message, 'error'); }
    setBusy(false);
  };

  const complete = async () => {
    setBusy(true);
    try {
      if (folio.balance > 0) {
        await api.post('/api/payments', { reservation_id: res.id, amount: folio.balance, method: payMethod, note: 'Final payment at check-out' });
      }
      const r = await api.post<{ invoice_no: string }>(`/api/reservations/${res.id}/check-out`, { payments: [] });
      setInvoice({ invoice_no: r.invoice_no });
      push(`${res.guest_name} checked out — room marked for cleaning`, 'success');
    } catch (e) { push((e as Error).message, 'error'); }
    setBusy(false);
  };

  if (invoice) {
    const d = new Date();
    return (
      <div className="p-4 sm:p-6 max-w-3xl mx-auto pb-24">
        <div className="no-print flex justify-between items-center mb-4">
          <Link to="/front-desk" className="text-[13px] font-bold text-slate-500 hover:text-ink-900 flex items-center gap-1.5"><ArrowLeft className="size-4" /> Front desk</Link>
          <div className="flex gap-2">
            <Button onClick={() => window.print()}><Printer className="size-4" /> Print invoice</Button>
            <Button variant="gold" onClick={() => nav('/front-desk')}>Done</Button>
          </div>
        </div>
        <ReservationPrint kind="Guest Invoice" reference={invoice.invoice_no} lines={[
          ['Guest', String(res.guest_name)],
          ['Room', `Room ${res.room_number} · ${res.category_name}`],
          ['Stay', `${fmtDate(res.check_in)} → ${fmtDate(res.check_out)} · ${folio.nights} nights`],
          ['Checked out', `${fmtDate(todayISO())} ${fmtTime(d.toISOString().slice(0, 19).replace('T', ' '))}`],
        ]} totals={[
          ['Room charges', money(folio.roomTotal)],
          ['Services (food, minibar, laundry…)', money(folio.extrasTotal)],
          ['Discount', `- ${money(folio.discount)}`],
          ['Taxes @ 17% GST', money(folio.tax)],
          ['Total folio', money(folio.total)],
          ['Payments received', `- ${money(folio.paid)}`],
          ['Settled today (₨ 0.00 outstanding)', money(0)],
        ]} footer="Thank you for staying with us. We look forward to welcoming you back to Grand Aurelia. For billing queries quote the invoice number above." />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-[1100px] mx-auto pb-24 anim-fade-up">
      <div className="no-print flex items-center justify-between mb-5">
        <button onClick={() => nav('/front-desk')} className="text-[13px] font-bold text-slate-500 hover:text-ink-900 flex items-center gap-1.5"><ArrowLeft className="size-4" /> Front desk</button>
        <Button variant="outline" onClick={() => window.print()}><Printer className="size-4" /> Print preview</Button>
      </div>

      <h1 className="text-[24px] font-extrabold text-ink-900 tracking-tight font-display">Check-out · {res.guest_name}</h1>
      <p className="text-[13px] text-slate-400 mb-4">Room {res.room_number} · {res.confirmation_no} · {fmtRange(res.check_in, res.check_out)} · {nights(res.check_in, res.check_out)} nights</p>

      <div className="grid lg:grid-cols-[1fr_300px] gap-4 items-start">
        {/* folio */}
        <Card className="overflow-hidden">
          <div className="px-5 py-4 border-b border-line flex items-center justify-between">
            <div>
              <h3 className="font-bold text-ink-900 flex items-center gap-2"><ReceiptText className="size-4.5 text-gold-500" /> Guest folio</h3>
              <p className="text-[12px] text-slate-400">Charges posted {folio.items.length ? `(${folio.items.length})` : '— none yet'}</p>
            </div>
            <Button size="sm" variant="soft" onClick={() => setChargeOpen(true)}><Plus className="size-4" /> Add charge</Button>
          </div>
          <table className="w-full text-[13px]">
            <thead><tr><Th>Service / item</Th><Th>Category</Th><Th className="text-right">Amount</Th><Th className="no-print" /></tr></thead>
            <tbody>
              {folio.items.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400 text-[13px]">No charges posted yet for this stay.</td></tr>}
              {folio.items.map((it) => (
                <tr key={it.id} className="hover:bg-canvas/60">
                  <Td><p className="font-semibold text-ink-900">{it.description}{it.type === 'room' ? ` (${it.quantity} × ${money(it.unit_price)})` : it.quantity > 1 ? ` × ${it.quantity}` : ''}</p><p className="text-[11px] text-slate-400">posted {fmtDate(it.posted_at)} · {it.posted_by || 'system'}</p></Td>
                  <Td>{<Badge tone={it.type === 'room' ? 'blue' : it.type === 'food' ? 'violet' : 'slate'}>{TYPE_LABEL[it.type]}</Badge>}</Td>
                  <Td className="text-right font-bold tabular-nums">{money(it.amount)}</Td>
                  <Td className="no-print text-right">
                    {it.type !== 'room' && (
                      <button title="Remove charge" onClick={async () => {
                        try { const r = await api.del<{ folio: Folio }>(`/api/charges/${it.id}`); setFolio(r.folio); push('Charge removed', 'info'); } catch (e) { push((e as Error).message, 'error'); }
                      }} className="p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50"><Minus className="size-3.5" /></button>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-5 py-4 border-t border-line space-y-1">
            {[
              ['Room charges', money(folio.roomTotal)],
              ['Services & extras', money(folio.extrasTotal)],
              ['Discount', `- ${money(folio.discount)}`],
              ['Taxes @ 17% GST', money(folio.tax)],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between text-[13px] font-semibold"><span className="text-slate-500">{k}</span><span className="tabular-nums">{v}</span></div>
            ))}
          </div>
        </Card>

        {/* settlement rail */}
        <Card className="p-5 !bg-ink-900 border-0 sticky top-2">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-gold-500 mb-3">Settlement</p>
          <div className="space-y-2 text-[12.5px] text-slate-300">
            <div className="flex justify-between"><span className="text-slate-500">Total folio</span><b className="text-gold-100">{money(folio.total)}</b></div>
            <div className="flex justify-between"><span className="text-slate-500">Payments received</span><b className="text-emerald-400">{money(folio.paid)}</b></div>
            <div className="flex justify-between text-[16px] pt-2 border-t border-white/10">
              <span className="text-slate-500">Outstanding</span>
              <b className={cx('font-extrabold', folio.balance > 0 ? 'text-gold-300' : 'text-emerald-400')}>{money(folio.balance)}</b>
            </div>
          </div>
          {folio.balance > 0 ? (
            <>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mt-4 mb-1.5">Accept final payment</p>
              <Select value={payMethod} onChange={(e) => setPayMethod(e.target.value as PaymentMethod)} className="!bg-white/5 !border-white/10 !text-slate-200">
                {(['Cash', 'Credit Card', 'Debit Card', 'Bank Transfer', 'Online Payment'] as PaymentMethod[]).map((m) => <option key={m} className="text-ink-900">{m}</option>)}
              </Select>
              <Button variant="gold" size="lg" className="w-full mt-3" loading={busy} onClick={complete}>
                <Banknote className="size-4.5" /> Take {money(folio.balance)} & check out
              </Button>
            </>
          ) : (
            <Button variant="gold" size="lg" className="w-full mt-4" loading={busy} onClick={complete}>
              <CheckIcon /> Settle folio & issue invoice
            </Button>
          )}
          <div className="mt-4 pt-3 border-t border-white/10 text-[11.5px] text-slate-500 leading-relaxed">
            After check-out the room is flagged <b className="text-gold-300">Dirty</b> and a cleaning task is raised to housekeeping automatically. Invoice becomes printable.
          </div>
          <Link to="/front-desk" className="block mt-3 text-[12px] font-bold text-slate-500 hover:text-gold-300">← Back to front desk</Link>
        </Card>
      </div>

      <Modal open={chargeOpen} onClose={() => setChargeOpen(false)} title="Post a charge to folio" subtitle="Restaurants, spa, transfers, laundry & more can be charged to the guest." width="max-w-md"
        footer={<><Button onClick={() => setChargeOpen(false)}>Cancel</Button><Button variant="gold" loading={busy} onClick={postCharge}>Post charge</Button></>}>
        <div className="space-y-4">
          <Select label="Charge category" value={charge.type} onChange={(e) => setCharge({ ...charge, type: e.target.value })}>
            {SERVICE_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
          </Select>
          <Input label="Description *" value={charge.description} onChange={(e) => setCharge({ ...charge, description: e.target.value })} placeholder="e.g. In-room dining — dinner for two" />
          <div className="grid grid-cols-2 gap-4">
            <Input type="number" min={1} label="Quantity" value={charge.quantity} onChange={(e) => setCharge({ ...charge, quantity: Math.max(1, +e.target.value) })} />
            <Input type="number" min={0} label="Unit price (₨) *" value={charge.unit_price} onChange={(e) => setCharge({ ...charge, unit_price: +e.target.value })} />
          </div>
          <div className="rounded-xl bg-canvas px-4 py-3 flex justify-between text-[13px]">
            <span className="text-slate-400 font-bold">Charge total</span><span className="font-extrabold text-ink-900 tabular-nums">{money(charge.quantity * charge.unit_price)}</span>
          </div>
        </div>
      </Modal>
    </div>
  );
}

const CheckIcon = () => <ReceiptText className="size-4.5" />;
