import { useCallback, useEffect, useState } from 'react';
import {
  FileBarChart, Download, Printer, CalendarDays, BedDouble, Users, Wallet, TrendingUp, Ban, DoorOpen, ArrowDownToLine, ClipboardList,
} from 'lucide-react';
import { api } from '../lib/api';
import { Badge, Button, Card, EmptyState, Input, Loading, Tabs, Td, Th, useToast } from '../ui';
import { OccupancyArea, RevenueBars, StatusDonut } from '../components/charts';
import { StatusChip } from '../lib/status';
import { money, fmtDate, cx, todayISO, addDaysISO } from '../lib/format';

type TabId = 'occupancy' | 'revenue' | 'arrivals' | 'departures' | 'reservations' | 'rooms' | 'guests' | 'payments' | 'cancellations';

export default function Reports() {
  const { push } = useToast();
  const [tab, setTab] = useState<TabId>('occupancy');
  const [range, setRange] = useState({ from: addDaysISO(todayISO(), -13), to: todayISO() });
  const [date, setDate] = useState(todayISO());
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [busySpin, setBusySpin] = useState(true);

  const needsDate = tab === 'arrivals' || tab === 'departures';
  const needsRange = ['occupancy', 'revenue', 'reservations', 'payments'].includes(tab);

  const load = useCallback(async () => {
    setBusySpin(true);
    try {
      const qs = needsDate ? `?date=${date}` : `?from=${range.from}&to=${range.to}`;
      const r = await api.get<Record<string, unknown>>(`/api/reports/${tab}${qs}`);
      setData(r);
    } catch (e) { push((e as Error).message, 'error'); }
    setBusySpin(false);
  }, [tab, needsDate, needsRange, date, range, push]);
  useEffect(() => { load(); }, [load]);

  const exportCsv = () => {
    const d = data as { rows?: Record<string, unknown>[]; list?: Record<string, unknown>[]; byDay?: unknown[] };
    const rows = (d.rows || d.list) as Record<string, unknown>[] | undefined;
    if (!rows || !rows.length) return push('Nothing to export', 'info');
    const cols = Object.keys(rows[0]);
    const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => JSON.stringify(r[c] ?? '')).join(','))].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url; a.download = `grand-aurelia-${tab}-${needsDate ? date : range.from}_${range.to}.csv`; a.click();
    URL.revokeObjectURL(url);
    push('Report exported as CSV', 'success');
  };

  const TABS: { id: TabId; label: string; icon: typeof FileBarChart }[] = [
    { id: 'occupancy', label: 'Occupancy', icon: BedDouble },
    { id: 'revenue', label: 'Revenue', icon: TrendingUp },
    { id: 'arrivals', label: 'Daily arrivals', icon: ArrowDownToLine },
    { id: 'departures', label: 'Daily departures', icon: DoorOpen },
    { id: 'reservations', label: 'Reservations', icon: ClipboardList },
    { id: 'rooms', label: 'Room status', icon: BedDouble },
    { id: 'guests', label: 'Guest history', icon: Users },
    { id: 'payments', label: 'Payments', icon: Wallet },
    { id: 'cancellations', label: 'Cancellations', icon: Ban },
  ];

  return (
    <div className="p-4 sm:p-6 pb-24 lg:pb-8 max-w-[1600px] mx-auto space-y-5 anim-fade-up">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-gold-600">Insights</p>
          <h1 className="text-[26px] font-extrabold text-ink-900 tracking-tight font-display">Reports</h1>
          <p className="text-[13px] text-slate-400 mt-0.5">Operational and financial reporting with CSV export and print.</p>
        </div>
        <div className="flex gap-2 no-print">
          <Button onClick={exportCsv}><Download className="size-4" /> Export CSV</Button>
          <Button variant="primary" onClick={() => window.print()}><Printer className="size-4" /> Print report</Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 no-print">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cx('inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold transition',
              tab === t.id ? 'border-ink-900 bg-ink-900 text-gold-300' : 'border-line text-slate-500 hover:bg-slate-50')}>
            <t.icon className="size-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {/* filters */}
      <Card className="p-4 no-print">
        <div className="flex flex-wrap items-end gap-3">
          {needsDate ? (
            <Input type="date" label="Report date" value={date} onChange={(e) => setDate(e.target.value)} className="!w-[170px]" />
          ) : needsRange ? (
            <>
              <Input type="date" label="From" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} className="!w-[160px]" />
              <Input type="date" label="To" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} className="!w-[160px]" />
            </>
          ) : <p className="text-[12.5px] text-slate-400 font-semibold">Live snapshot — filters update the table below.</p>}
          <Button variant="gold" size="md" onClick={load}>Apply</Button>
        </div>
      </Card>

      {busySpin && !data ? <Loading /> : (
        <div>
          {tab === 'occupancy' && <OccupancyReport d={data} />}
          {tab === 'revenue' && <RevenueReport d={data} />}
          {tab === 'arrivals' && <ArrivalsReport d={data} />}
          {tab === 'departures' && <DeparturesReport d={data} />}
          {tab === 'reservations' && <ReservationsReport d={data} />}
          {tab === 'rooms' && <RoomsReport d={data} />}
          {tab === 'guests' && <GuestsReport d={data} />}
          {tab === 'payments' && <PaymentsReport d={data} />}
          {tab === 'cancellations' && <CancellationsReport d={data} />}
        </div>
      )}
    </div>
  );
}

/* ---------- report bodies ---------- */
function OccupancyReport({ d }: { d: Record<string, unknown> | null }) {
  if (!d) return null;
  const rows = (d.rows || []) as { date: string; roomsSold: number; totalRooms: number; occupancy: number; revenue: number; adr: number }[];
  const s = d.summary as { avgOccupancy: number; totalRevenue: number; totalNights: number };
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[[('Avg occupancy'), `${s.avgOccupancy}%`], ['Total room-nights', String(s.totalNights)], ['Revenue (period)', money(s.totalRevenue)], ['ADR', money(rows.length ? s.totalRevenue / Math.max(1, s.totalNights) : 0)]].map(([k, v]) => (
          <Card key={k as string} className="p-4"><p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{k}</p><p className="text-[20px] font-extrabold text-ink-900 mt-0.5 tabular-nums">{v}</p></Card>
        ))}
      </div>
      <Card className="p-5">
        <h3 className="font-bold text-ink-900 mb-3">Occupancy trend</h3>
        <OccupancyArea data={(rows || []).map((r) => ({ date: r.date.slice(5), occupancy: r.occupancy }))} height={220} />
      </Card>
      <Card className="overflow-x-auto">
        <Table head={['Date', 'Rooms sold', 'Inventory', 'Occupancy', 'ADR', 'Revenue']}>
          {rows.map((r) => (
            <tr key={r.date} className="hover:bg-canvas/60">
              <Td>{fmtDate(r.date)}</Td><Td>{r.roomsSold}</Td><Td>{r.totalRooms}</Td>
              <Td><div className="flex items-center gap-2.5"><div className="w-24 h-1.5 rounded-full bg-slate-100"><div className="h-full rounded-full bg-ink-900" style={{ width: `${r.occupancy}%` }} /></div><b>{r.occupancy}%</b></div></Td>
              <Td className="tabular-nums">{r.adr ? money(r.adr) : '—'}</Td>
              <Td className="font-bold tabular-nums">{money(r.revenue)}</Td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}

function RevenueReport({ d }: { d: Record<string, unknown> | null }) {
  if (!d) return null;
  const byDay = (d.byDay || []) as { date: string; amount: number; payments: number }[];
  const byMethod = (d.byMethod || []) as { method: string; v: number; c: number }[];
  const byPurpose = (d.byPurpose || []) as { purpose: string; v: number }[];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[[ 'Total revenue', money(d.total) ], ['Transactions', String(d.count)], ['Avg transaction', money(Number(d.total) / Math.max(1, Number(d.count)))], ['Busiest method', byMethod.slice().sort((a, b) => b.v - a.v)[0]?.method || '—']].map(([k, v], i) => (
          <Card key={i} className="p-4"><p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{k}</p><p className="text-[20px] font-extrabold text-ink-900 mt-0.5 truncate">{v}</p></Card>
        ))}
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-5"><h3 className="font-bold text-ink-900 mb-3">Daily revenue</h3><RevenueBars data={(byDay || []).map((x) => ({ date: x.date.slice(5), amount: x.amount }))} moneyKey="amount" height={230} /></Card>
        <Card className="p-5">
          <h3 className="font-bold text-ink-900 mb-3">By method & purpose</h3>
          <div className="space-y-3">
            {byMethod.map((m) => (
              <div key={m.method} className="flex items-center gap-3">
                <Badge tone="slate" className="w-fit min-w-[110px] justify-center">{m.method}</Badge>
                <div className="flex-1 h-2 rounded-full bg-slate-100"><div className="h-full ga-seal rounded-full" style={{ width: `${(m.v / Number(d.total || 1)) * 100}%` }} /></div>
                <span className="text-[12.5px] font-bold tabular-nums w-[95px] text-right">{money(m.v)}</span>
              </div>
            ))}
            <div className="pt-3 border-t border-line grid grid-cols-2 gap-2">
              {byPurpose.map((p) => (
                <div key={p.purpose} className="rounded-xl bg-canvas px-3.5 py-2.5 flex justify-between items-center">
                  <span className="text-[12px] font-bold text-slate-500">{p.purpose}</span>
                  <span className="font-extrabold tabular-nums text-ink-900">{money(p.v)}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function ArrivalsReport({ d }: { d: Record<string, unknown> | null }) {
  if (!d) return null;
  const rows = (d.rows || []) as { confirmation_no: string; guest: string; nationality: string; category: string; room: string | null; check_out: string; adults: number; children: number; status: string; source: string }[];
  void rows[0];
  return (
    <Card className="overflow-x-auto">
      <Table head={['Reference', 'Guest', 'Room', 'Category', 'Departs', 'Guests', 'Source', 'Status']}>
        {rows.length === 0 && <EmptyTR span={8} icon={CalendarDays} label="No arrivals on this date" />}
        {rows.map((r) => (
          <tr key={r.confirmation_no} className="hover:bg-canvas/60">
            <Td><span className="font-mono text-[12px] font-bold">{r.confirmation_no}</span></Td>
            <Td className="font-bold text-ink-900">{r.guest}<p className="text-[11px] text-slate-400">{r.nationality}</p></Td>
            <Td>{r.room ? `Room ${r.room}` : '—'}</Td>
            <Td>{r.category}</Td>
            <Td>{fmtDate(r.check_out)}</Td>
            <Td>{r.adults + r.children}</Td>
            <Td><Badge tone={r.source === 'Website' ? 'blue' : 'slate'}>{r.source}</Badge></Td>
            <Td><StatusChip status={r.status} /></Td>
          </tr>
        ))}
      </Table>
    </Card>
  );
}

function DeparturesReport({ d }: { d: Record<string, unknown> | null }) {
  if (!d) return null;
  const rows = (d.rows || []) as { confirmation_no: string; guest: string; category: string; room: string | null; check_in: string; check_out: string; status: string; invoice_no: string | null; paid: number; checked_out_at: string | null }[];
  return (
    <Card className="overflow-x-auto">
      <Table head={['Reference', 'Guest', 'Room', 'Stay', 'Status', 'Invoice', 'Payments received']}>
        {rows.length === 0 && <EmptyTR span={7} icon={DoorOpen} label="No departures on this date" />}
        {rows.map((r) => (
          <tr key={r.confirmation_no} className="hover:bg-canvas/60">
            <Td><span className="font-mono text-[12px] font-bold">{r.confirmation_no}</span></Td>
            <Td className="font-bold text-ink-900">{r.guest}</Td>
            <Td>{r.room ? `Room ${r.room}` : '—'}</Td>
            <Td>{fmtDate(r.check_in)} → {fmtDate(r.check_out)}</Td>
            <Td><StatusChip status={r.status} /></Td>
            <Td>{r.invoice_no ? <span className="font-mono text-[12px]">{r.invoice_no}</span> : '—'}</Td>
            <Td className="font-bold tabular-nums">{money(r.paid)}</Td>
          </tr>
        ))}
      </Table>
    </Card>
  );
}

function ReservationsReport({ d }: { d: Record<string, unknown> | null }) {
  if (!d) return null;
  const byStatus = (d.byStatus || []) as { status: string; c: number; value: number }[];
  const bySource = (d.bySource || []) as { source: string; c: number }[];
  const byCategory = (d.byCategory || []) as { name: string; c: number; nights_value: number }[];
  const list = (d.list || []) as { confirmation_no: string; guest: string; category: string; room: string | null; check_in: string; check_out: string; status: string; source: string; created_at: string; stay_value: number }[];
  return (
    <div className="space-y-4">
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="p-5">
          <h3 className="font-bold text-ink-900 mb-3">By source</h3>
          <div className="space-y-2">
            {bySource.map((s) => (
              <div key={s.source} className="flex items-center gap-2.5">
                <Badge tone={s.source === 'Website' ? 'blue' : s.source === 'Walk-in' ? 'gold' : 'slate'}>{s.source}</Badge>
                <div className="flex-1 h-2 rounded-full bg-slate-100"><div className="h-full bg-ink-900 rounded-full" style={{ width: `${(s.c / Math.max(1, list.length)) * 100}%` }} /></div>
                <b className="text-[13px] tabular-nums">{s.c}</b>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-5 lg:col-span-2">
          <h3 className="font-bold text-ink-900 mb-3">Status breakdown & pipeline value</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {byStatus.map((s) => (
              <div key={s.status} className="rounded-xl bg-canvas px-3.5 py-2.5">
                <div className="flex items-center justify-between"><StatusChip status={s.status} /><b className="tabular-nums">{s.c}</b></div>
                <p className="text-[11px] text-slate-400 mt-1">{money(s.value || 0)} pipeline value</p>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-line text-[12.5px] text-slate-500 font-semibold">
            {byCategory.map((c) => `${c.name}: ${c.c}`).join('  ·  ')}
          </div>
        </Card>
      </div>
      <Card className="overflow-x-auto">
        <Table head={['Reference', 'Guest', 'Room', 'Category', 'Dates', 'Source', 'Status', 'Value']}>
          {list.map((r) => (
            <tr key={r.confirmation_no} className="hover:bg-canvas/60">
              <Td><span className="font-mono text-[12px] font-bold">{r.confirmation_no}</span></Td>
              <Td className="font-bold text-ink-900">{r.guest}</Td>
              <Td>{r.room ? `Room ${r.room}` : '—'}</Td>
              <Td>{r.category}</Td>
              <Td>{fmtDate(r.check_in)} → {fmtDate(r.check_out)}</Td>
              <Td><Badge tone={r.source === 'Website' ? 'blue' : 'slate'}>{r.source}</Badge></Td>
              <Td><StatusChip status={r.status} /></Td>
              <Td className="text-right font-bold tabular-nums">{money(r.stay_value || 0)}</Td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}

function RoomsReport({ d }: { d: Record<string, unknown> | null }) {
  if (!d) return null;
  const rows = (d.rows || []) as { number: string; floor: number; category: string; status: string; max_occupancy: number; rate: number; in_house_guest: string | null }[];
  const byStatus = (d.byStatus || {}) as Record<string, number>;
  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h3 className="font-bold text-ink-900 mb-3">Status distribution</h3>
        <StatusDonut data={Object.entries(byStatus).map(([name, value]) => ({ name, value: Number(value) }))} />
      </Card>
      <Card className="overflow-x-auto">
        <Table head={['Room', 'Floor', 'Category', 'Status', 'Max occupancy', 'Rate', 'In-house guest']}>
          {rows.map((r) => (
            <tr key={r.number} className="hover:bg-canvas/60">
              <Td className="font-extrabold text-ink-900">{r.number}</Td>
              <Td>{r.floor}</Td>
              <Td>{r.category}</Td>
              <Td><StatusChip status={r.status} /></Td>
              <Td>{r.max_occupancy}</Td>
              <Td className="tabular-nums">{money(r.rate || 0)}</Td>
              <Td>{r.in_house_guest || <span className="text-slate-300">—</span>}</Td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}

function GuestsReport({ d }: { d: Record<string, unknown> | null }) {
  if (!d) return null;
  const rows = (d.rows || []) as { guest: string; nationality: string; phone: string; email: string; vip: number; stays: number; reservations: number; nights: number; spend: number }[];
  return (
    <Card className="overflow-x-auto">
      <Table head={['Guest', 'Contact', 'Nationality', 'Completed stays', 'Nights', 'Spend']}>
        {rows.map((r) => (
          <tr key={r.guest} className="hover:bg-canvas/60">
            <Td><p className="font-bold text-ink-900">{r.guest} {r.vip ? <CrownIcon /> : null}</p><p className="text-[11px] text-slate-400">{r.email || r.phone || '—'}</p></Td>
            <Td>{r.phone || '—'}</Td>
            <Td>{r.nationality}</Td>
            <Td><b>{r.stays}</b> / {r.reservations}</Td>
            <Td>{r.nights}</Td>
            <Td className="font-bold tabular-nums">{money(r.spend)}</Td>
          </tr>
        ))}
      </Table>
    </Card>
  );
}

function PaymentsReport({ d }: { d: Record<string, unknown> | null }) {
  if (!d) return null;
  const rows = (d.rows || []) as { id: number; date: string; room: string | null; confirmation_no: string | null; guest: string | null; amount: number; method: string; purpose: string; received_by: string }[];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4"><p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total</p><p className="text-[20px] font-extrabold text-ink-900 mt-0.5">{money(d.total)}</p></Card>
        <Card className="p-4"><p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Payments</p><p className="text-[20px] font-extrabold text-ink-900 mt-0.5">{rows.length}</p></Card>
      </div>
      <Card className="overflow-x-auto">
        <Table head={['Date', 'Guest', 'Room', 'Ref', 'Method', 'Purpose', 'Received by', 'Amount']}>
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-canvas/60">
              <Td>{fmtDate(r.date)}</Td>
              <Td className="font-bold text-ink-900">{r.guest || '—'}</Td>
              <Td>{r.room ? `Room ${r.room}` : '—'}</Td>
              <Td><span className="font-mono text-[11.5px]">{r.confirmation_no || '—'}</span></Td>
              <Td><Badge tone="slate">{r.method}</Badge></Td>
              <Td>{r.purpose}</Td>
              <Td>{r.received_by}</Td>
              <Td className="text-right font-bold tabular-nums text-emerald-700">{money(r.amount)}</Td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}

function CancellationsReport({ d }: { d: Record<string, unknown> | null }) {
  if (!d) return null;
  const rows = (d.rows || []) as { confirmation_no: string; guest: string; category: string; check_in: string; check_out: string; status: string; source: string; cancelled_at: string | null; cancel_reason: string | null }[];
  return (
    <Card className="overflow-x-auto">
      <Table head={['Reference', 'Guest', 'Category', 'Dates', 'Status', 'Source', 'Cancelled at', 'Reason']}>
        {rows.length === 0 && <EmptyTR span={8} icon={FileBarChart} label="No cancellations or no-shows" />}
        {rows.map((r) => (
          <tr key={r.confirmation_no} className="hover:bg-canvas/60">
            <Td><span className="font-mono text-[12px] font-bold">{r.confirmation_no}</span></Td>
            <Td className="font-bold text-ink-900">{r.guest}</Td>
            <Td>{r.category}</Td>
            <Td>{fmtDate(r.check_in)} → {fmtDate(r.check_out)}</Td>
            <Td><StatusChip status={r.status} /></Td>
            <Td><Badge tone={r.source === 'Website' ? 'blue' : 'slate'}>{r.source}</Badge></Td>
            <Td>{r.cancelled_at ? fmtDate(r.cancelled_at) : '—'}</Td>
            <Td className="max-w-[280px]"><span className="line-clamp-2 text-slate-500">{r.cancel_reason || '—'}</span></Td>
          </tr>
        ))}
      </Table>
    </Card>
  );
}

/* shared bits */
function Table({ head, children, className }: { head: string[]; children: React.ReactNode; className?: string }) {
  return (
    <table className={cx('w-full text-[13px] min-w-[760px]', className)}>
      <thead><tr>{head.map((h) => <Th key={h} className={h === 'Amount' || h.startsWith('Revenue') || h.endsWith('Value') || h.endsWith('Spend') ? 'text-right' : ''}>{h}</Th>)}</tr></thead>
      <tbody>{children}</tbody>
    </table>
  );
}
function EmptyTR({ span, icon: I, label }: { span: number; icon: typeof FileBarChart; label: string }) {
  return <tr><td colSpan={span}><EmptyState icon={I} title={label} /></td></tr>;
}
const CrownIcon = () => <span className="ml-1 text-gold-500 text-[13px]">★</span>;
void Users; void Ban; void CalendarDays;
