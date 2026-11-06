import { useCallback, useEffect, useState } from 'react';
import {
  ReceiptText, Wallet, Plus, Download, Printer, Search, TrendingUp, Banknote, PiggyBank
} from 'lucide-react';
import { api } from '../lib/api';
import type { Reservation, Folio, PaymentRow, PaymentMethod } from '../lib/types';
import { Badge, Button, Card, EmptyState, Input, Loading, Modal, Select, Tabs, Td, Th, useToast } from '../ui';
import { RevenueBars, OccupancyArea } from '../components/charts';
import { money, fmtDate, cx, todayISO, addDaysISO } from '../lib/format';

type FolioRow = Reservation & { folio: Folio };

export default function Billing() {
  const { push } = useToast();
  const [tab, setTab] = useState<'folios' | 'payments' | 'summary'>('folios');
  const [folios, setFolios] = useState<FolioRow[] | null>(null);
  const [q, setQ] = useState('');
  const [payModal, setPayModal] = useState<{ res: Reservation; balance: number } | null>(null);
  const [pay, setPay] = useState({ amount: 0, method: 'Cash' as PaymentMethod, note: '' });
  const [range, setRange] = useState({ from: addDaysISO(todayISO(), -29), to: todayISO() });
  const [revenue, setRevenue] = useState<{ byDay: { date: string; amount: number }[]; byMethod: { method: string; v: number }[]; total: number; count: number } | null>(null);
  type PayLedgerRow = { id: number; date: string; room: string | null; confirmation_no: string | null; guest: string | null; amount: number; method: string; purpose: string; received_by: string; paid_at: string };
  const [payments, setPayments] = useState<PayLedgerRow[] | null>(null);
  const [busy, setBusy] = useState(false);

  const loadFolios = useCallback(async () => {
    const r = await api.get<{ reservations: Reservation[] }>('/api/reservations?status=Checked-in');
    const detailed = await Promise.all(
      r.reservations.map(async (x) => (await api.get<{ reservation: FolioRow }>(`/api/reservations/${x.id}`)).reservation));
    setFolios(detailed.filter((f) => f.folio));
  }, []);
  useEffect(() => { loadFolios().catch((e) => push(e.message, 'error')); }, [loadFolios, push]);

  const loadPayments = useCallback(async () => {
    const r = await api.get<{ rows: PayLedgerRow[] }>(`/api/reports/payments?from=${range.from}&to=${range.to}`);
    setPayments(r.rows);
    const rev = await api.get<{ byDay: { date: string; amount: number }[]; byMethod: { method: string; v: number }[]; total: number; count: number }>(`/api/reports/revenue?from=${range.from}&to=${range.to}`);
    setRevenue(rev);
  }, [range]);
  useEffect(() => { if (tab !== 'folios') loadPayments().catch((e) => push(e.message, 'error')); }, [tab, loadPayments, push]);

  const settle = async () => {
    if (!payModal) return;
    if (!(pay.amount > 0)) return push('Enter an amount', 'error');
    setBusy(true);
    try {
      await api.post('/api/payments', { reservation_id: payModal.res.id, amount: pay.amount, method: pay.method, note: pay.note || 'Reception payment' });
      push(`${money(pay.amount)} recorded for ${payModal.res.guest_name}`);
      setPayModal(null);
      await loadFolios();
    } catch (e) { push((e as Error).message, 'error'); }
    setBusy(false);
  };

  const exportCsv = (rows: Record<string, unknown>[], name: string) => {
    if (!rows.length) return push('Nothing to export', 'info');
    const cols = Object.keys(rows[0]);
    const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => JSON.stringify(r[c] ?? '')).join(','))].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url; a.download = `${name}-${todayISO()}.csv`; a.click();
    URL.revokeObjectURL(url);
    push('CSV exported', 'info');
  };

  if (!folios) return <Loading />;
  const totalOutstanding = folios.reduce((s, f) => s + Math.max(0, f.balance ?? 0), 0);

  return (
    <div className="p-4 sm:p-6 pb-24 lg:pb-8 max-w-[1600px] mx-auto space-y-5 anim-fade-up">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-gold-600">Finance</p>
          <h1 className="text-[26px] font-extrabold text-ink-900 tracking-tight font-display">Billing & Payments</h1>
          <p className="text-[13px] text-slate-400 mt-0.5">Guest folios, settlements and revenue performance. Demo mode — all payments are simulated.</p>
        </div>
        <div className="flex gap-2">
          <Badge tone="gold" className="text-[12px] px-3 py-1.5"><PiggyBank className="size-3.5" /> Outstanding: {money(totalOutstanding)}</Badge>
        </div>
      </div>

      <Tabs value={tab} onChange={setTab} tabs={[
        { id: 'folios', label: 'Guest folios', badge: folios.length },
        { id: 'payments', label: 'Transactions' },
        { id: 'summary', label: 'Revenue summary' },
      ]} />

      {tab === 'folios' && (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {folios.length === 0 && <Card className="col-span-full"><EmptyState icon={ReceiptText} title="No in-house guests" subtitle="Folios appear when guests are checked in." /></Card>}
          {folios.map((f) => (
            <Card key={f.id} className="p-5 flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-ink-900">{f.guest_name} {f.guest_vip ? <Badge tone="gold">VIP</Badge> : null}</p>
                  <p className="text-[12px] text-slate-400 mt-0.5">Room {f.room_number} · {f.confirmation_no}</p>
                </div>
                <span className={cx('text-[15px] font-extrabold tabular-nums', (f.balance ?? 0) > 0 ? 'text-rose-500' : 'text-emerald-600')}>{money(f.balance ?? 0)}</span>
              </div>
              <div className="flex gap-4 mt-3.5 pt-3 border-t border-line">
                {[[f.folio.roomTotal, 'Room'], [f.folio.extrasTotal, 'Extras'], [f.folio.tax, 'Tax']].map(([v, k]) => (
                  <div key={k as string}>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{k}</p>
                    <p className="text-[13px] font-bold tabular-nums text-slate-700">{money(Number(v))}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between mt-3">
                <p className="text-[11.5px] text-slate-400">Total folio: <b className="text-ink-900">{money(f.folio.total)}</b> · paid {money(f.folio.paid)}</p>
                <Button size="sm" variant="soft" onClick={() => { setPayModal({ res: f, balance: Math.max(0, f.balance ?? 0) }); setPay({ amount: Math.max(0, f.balance ?? 0), method: 'Cash', note: '' }); }}>
                  <Banknote className="size-3.5" /> Record payment
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === 'payments' && (
        <>
          <Card className="p-4">
            <div className="flex flex-wrap items-end gap-3">
              <Input type="date" label="From" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} className="!w-[160px]" />
              <Input type="date" label="To" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} className="!w-[160px]" />
              <div className="relative">
                <label className="label-base">Search</label>
                <Search className="size-4 text-slate-400 absolute left-9 top-[38px] -translate-y-1/2" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Guest, ref, staff…" className="input-base pl-9 w-[200px]" />
              </div>
              <Button variant="outline" onClick={() => exportCsv(payments || [], 'payments')}><Download className="size-4" /> Export CSV</Button>
            </div>
          </Card>
          <Card className="overflow-x-auto">
            <table className="w-full text-[13px] min-w-[860px]">
              <thead><tr><Th>Date</Th><Th>Guest / reference</Th><Th>Room</Th><Th>Method</Th><Th>Purpose</Th><Th>Received by</Th><Th className="text-right">Amount</Th></tr></thead>
              <tbody>
                {(payments || []).length === 0 && <tr><td colSpan={7}><EmptyState icon={Wallet} title="No payments in range" /></td></tr>}
                {(payments || []).filter((p) => !q.trim() || `${p.guest} ${p.confirmation_no ?? ''} ${p.received_by}`.toLowerCase().includes(q.toLowerCase())).map((p) => (
                  <tr key={p.id} className="hover:bg-canvas/60">
                    <Td>{fmtDate(p.paid_at)}<p className="text-[11px] text-slate-400">{p.paid_at?.slice(11, 16)}</p></Td>
                    <Td><p className="font-bold text-ink-900">{p.guest || '—'}</p><p className="font-mono text-[11px] text-slate-400">{p.confirmation_no || 'uncoded'}</p></Td>
                    <Td>{p.room ? `Room ${p.room}` : '—'}</Td>
                    <Td><Badge tone={p.method === 'Cash' ? 'green' : p.method === 'Online Payment' ? 'blue' : 'slate'}>{p.method}</Badge></Td>
                    <Td>{p.purpose}</Td>
                    <Td>{p.received_by}</Td>
                    <Td className="text-right font-bold tabular-nums text-emerald-700">{money(p.amount)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}

      {tab === 'summary' && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[['Total revenue', money(revenue?.total ?? 0)], ['Transactions', String(revenue?.count ?? 0)], ['Avg per day', money((revenue?.total ?? 0) / Math.max(1, (revenue?.byDay.length ?? 1)))], ['Top method', (revenue?.byMethod ?? []).sort((a, b) => b.v - a.v)[0]?.method || '—']].map(([k, v]) => (
              <Card key={k} className="p-4"><p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{k}</p><p className="text-[20px] font-extrabold text-ink-900 mt-0.5 truncate">{v}</p></Card>
            ))}
          </div>
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-ink-900 flex items-center gap-2"><TrendingUp className="size-4.5 text-gold-500" /> Daily revenue — {fmtDate(range.from)} → {fmtDate(range.to)}</h3>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setRange({ from: addDaysISO(todayISO(), -29), to: todayISO() })}>30 days</Button>
                <Button size="sm" variant="outline" onClick={() => setRange({ from: addDaysISO(todayISO(), -6), to: todayISO() })}>7 days</Button>
              </div>
            </div>
            <RevenueBars data={(revenue?.byDay ?? []).map((d) => ({ date: d.date.slice(5), amount: d.amount }))} moneyKey="amount" height={240} />
          </Card>
          <div className="grid lg:grid-cols-2 gap-4">
            <Card className="p-5">
              <h3 className="font-bold text-ink-900 mb-3">By payment method</h3>
              {(revenue?.byMethod ?? []).map((m) => (
                <div key={m.method} className="flex items-center gap-3 py-2">
                  <Badge tone="slate" className="w-fit min-w-[110px] justify-center">{m.method}</Badge>
                  <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full ga-seal rounded-full" style={{ width: `${(m.v / (revenue?.total || 1)) * 100}%` }} />
                  </div>
                  <span className="text-[12.5px] font-bold tabular-nums w-[90px] text-right">{money(m.v)}</span>
                </div>
              ))}
            </Card>
            <Card className="p-5">
              <h3 className="font-bold text-ink-900 mb-3 flex items-center gap-2"><Printer className="size-4 text-slate-400 no-print" /> Monthly management snapshot</h3>
              <p className="text-[13px] text-slate-500 mb-3">Print this revenue summary for the owner's pack.</p>
              <Button variant="primary" className="no-print" onClick={() => window.print()}><Printer className="size-4" /> Print revenue summary</Button>
              <div className="print-area mt-4">
                <div className="print-page">
                  <p className="font-display text-lg font-bold text-ink-900">Grand Aurelia Hotel & Resort — Revenue Summary</p>
                  <p className="text-[12px] text-slate-500 mb-2">{fmtDate(range.from)} → {fmtDate(range.to)}</p>
                  <p className="font-extrabold text-ink-900 text-2xl">{money(revenue?.total ?? 0)}</p>
                  <p className="text-[12px] text-slate-500">{revenue?.count ?? 0} payments received</p>
                </div>
              </div>
            </Card>
          </div>
        </>
      )}

      <Modal open={!!payModal} onClose={() => setPayModal(null)} width="max-w-md" title={`Record payment · ${payModal?.res.guest_name ?? ''}`}
        subtitle={`Folio balance ${money(payModal?.balance ?? 0)} · room ${payModal?.res.room_number ?? '—'}`}
        footer={<><Button onClick={() => setPayModal(null)}>Cancel</Button><Button variant="gold" loading={busy} onClick={settle}>Record payment</Button></>}>
        <div className="space-y-4">
          <Input type="number" min={0} label="Amount (₨) *" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: +e.target.value })} />
          <Select label="Method" value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value as PaymentMethod })}>
            {(['Cash', 'Credit Card', 'Debit Card', 'Bank Transfer', 'Online Payment'] as PaymentMethod[]).map((m) => <option key={m}>{m}</option>)}
          </Select>
          <Input label="Note (optional)" value={pay.note} onChange={(e) => setPay({ ...pay, note: e.target.value })} />
        </div>
      </Modal>
    </div>
  );
}
