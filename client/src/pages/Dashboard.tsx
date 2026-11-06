import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  BedDouble, DoorOpen, CalendarCheck2, UsersRound, Sparkles, Wrench, ArrowDownToLine, ArrowUpFromLine,
  ReceiptText, Percent, Plus, Zap, ClipboardList, ArrowRight, TrendingUp, Users, Wallet, UserPlus, Activity,
  ConciergeBell, CalendarRange,
} from 'lucide-react';
import { api } from '../lib/api';
import type { DashboardData, ActivityItem } from '../lib/types';
import { StatCard } from '../components/StatCard';
import { StatusDonut, OccupancyArea, RevenueBars } from '../components/charts';
import { ReservationFormModal, emptyDraft } from '../components/ReservationForm';
import { Badge, Button, Card, Loading, SectionTitle, Th, Td, useToast } from '../ui';
import { resStatusMeta } from '../lib/status';
import { money, compact, fmtDate, fmtTime, fmtRange, nights, cx, avatarTone, initials, plural } from '../lib/format';

export default function Dashboard() {
  const nav = useNavigate();
  const { push } = useToast();
  const [d, setD] = useState<DashboardData | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [formOpen, setFormOpen] = useState(false);

  const load = useCallback(() => {
    Promise.all([
      api.get<DashboardData>('/api/dashboard'),
      api.get<{ activity: ActivityItem[] }>('/api/activity?limit=10'),
    ]).then(([d0, a]) => { setD(d0); setActivity(a.activity); }).catch((e) => push(e.message, 'error'));
  }, [push]);
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);

  if (!d) return <Loading />;

  const r = d.rooms;
  const donut = [
    { name: 'Available', value: r.available }, { name: 'Reserved', value: r.reserved },
    { name: 'Occupied', value: r.occupied }, { name: 'Dirty', value: r.dirty },
    { name: 'Cleaning', value: r.cleaning }, { name: 'Maintenance', value: r.maintenance },
  ].filter((x) => x.value > 0);

  return (
    <div className="p-4 sm:p-6 pb-20 lg:pb-8 max-w-[1600px] mx-auto space-y-6 anim-fade-up">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-gold-600">Operations overview</p>
          <h1 className="text-[26px] font-extrabold text-ink-900 tracking-tight font-display">Front office, {fmtDate(d.today).slice(0, 6)}</h1>
          <p className="text-[13px] text-slate-400 mt-0.5">Everything happening across Grand Aurelia today{d.revenueToday ? ` — ₨ ${d.revenueToday.toLocaleString()} collected so far.` : '.'}</p>
        </div>
        <div className="flex gap-2 no-print">
          <Button variant="gold" onClick={() => setFormOpen(true)}><Plus className="size-4" /> New reservation</Button>
          <Button onClick={() => nav('/front-desk')}><ConciergeBell className="size-4" /> Front desk</Button>
          <Button variant="ghost" className="max-sm:hidden" onClick={() => nav('/calendar')}><CalendarRange className="size-4" /> Calendar</Button>
        </div>
      </div>

      {/* stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatCard icon={BedDouble} label="Total rooms" value={r.total} sub={`${plural(r.total - r.available, 'room', 'rooms')} committed`} />
        <StatCard icon={DoorOpen} label="Available" value={r.available} tone="green" accent={r.available === 0} sub={`${r.occupancyRate}% occupied`} />
        <StatCard icon={Users} label="Occupied" value={r.occupied} tone="sky" sub={`${d.inHouse.length} in-house stays`} />
        <StatCard icon={CalendarCheck2} label="Reserved" value={r.reserved} tone="indigo" sub={`${d.reservations.pending} pending booking${d.reservations.pending === 1 ? '' : 's'}`} />
        <StatCard icon={Sparkles} label="Dirty / cleaning" value={r.dirty + r.cleaning} tone="amber" sub={d.housekeepingOpen ? `${d.housekeepingOpen} open housekeeping tasks` : 'Housekeeping clear'} />
        <StatCard icon={Wrench} label="Maintenance" value={r.maintenance} tone="rose" sub={r.maintenance ? 'Response needed' : 'All systems normal'} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        <StatCard icon={ArrowDownToLine} label="Today's check-ins" value={d.arrivalsToday.length} tone="gold" sub={<Link to="/front-desk" className="hover:underline font-semibold">View arrivals →</Link>} />
        <StatCard icon={ArrowUpFromLine} label="Today's check-outs" value={d.departuresToday.length} tone="navy" sub={<Link to="/front-desk" className="hover:underline font-semibold">View departures →</Link>} />
        <StatCard icon={ReceiptText} label="Total reservations" value={d.reservations.total} sub={`${d.reservations.confirmed} confirmed · ${d.reservations.cancelled} cancelled`} />
        <StatCard icon={Wallet} label="Today's revenue" value={money(d.revenueToday)} tone="green" sub="Payments received today" />
        <StatCard icon={Percent} label="Occupancy rate" value={`${r.occupancyRate}%`} tone={r.occupancyRate > 70 ? 'rose' : 'sky'} sub={`${r.occupied} of ${r.total} rooms sold`} accent />
      </div>

      {/* charts row */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-2">
          <SectionTitle title="Revenue & occupancy — last 14 days" subtitle="Payments collected and rooms sold per day"
            action={<Badge tone="green"><TrendingUp className="size-3" /> Live</Badge>} />
          <OccupancyArea data={d.occSeries} dataKey="occupancy" height={200} color="#0D1B28" />
          <div className="mt-2 border-t border-line pt-3"><RevenueBars data={d.occSeries} moneyKey="revenue" height={150} /></div>
        </Card>
        <Card className="p-5">
          <SectionTitle title="Room status overview" subtitle="Live house-facing snapshot" />
          <StatusDonut data={donut} />
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-3 pt-3 border-t border-line">
            {d.categoryMix.map((c) => (
              <div key={c.name} className="flex items-center justify-between text-[12px]">
                <span className="text-slate-500 font-semibold truncate pr-2">{c.name.replace(' Room', '')}</span>
                <span className="font-bold text-ink-900 tabular-nums">{c.c}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* arrivals & departures */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <SectionTitle title="Today's arrivals" subtitle={plural(d.arrivalsToday.length, 'guest', 'guests')} action={<Link className="text-[12.5px] font-bold text-gold-600 hover:underline" to="/front-desk">Open front desk →</Link>} />
          <div className="space-y-2">
            {d.arrivalsToday.length === 0 && <p className="text-[13px] text-slate-400 py-4 text-center">No arrivals scheduled today.</p>}
            {d.arrivalsToday.map((a) => (
              <div key={a.id} className="flex items-center gap-3 rounded-xl border border-line bg-canvas/60 px-3.5 py-2.5 hover:border-gold-300 hover:bg-gold-50/40 transition">
                <div className={cx('size-9 rounded-lg grid place-items-center text-[11px] font-bold shrink-0', avatarTone(a.guest_name))}>{initials(a.guest_name)}</div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-bold text-ink-900 truncate">{a.guest_name} {a.guest_vip ? <span className="text-[9.5px] bg-ink-900 text-gold-300 rounded-full px-1.5 py-0.5">VIP</span> : ''}</p>
                  <p className="text-[12px] text-slate-400 truncate">Room {a.room_number ?? '—'} · {a.category_name} · {nights(a.check_in, a.check_out)} nights</p>
                </div>
                <Badge tone={a.status === 'Pending' ? 'amber' : 'green'}>{a.status}</Badge>
                <Button size="sm" variant="gold" onClick={() => nav(`/check-in/${a.id}`)} className="max-sm:!px-2">Check-in <ArrowRight className="size-3.5" /></Button>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle title="Today's departures" subtitle={plural(d.departuresToday.length, 'guest', 'guests')} action={<Link className="text-[12.5px] font-bold text-gold-600 hover:underline" to="/front-desk">Open front desk →</Link>} />
          <div className="space-y-2">
            {d.departuresToday.length === 0 && <p className="text-[13px] text-slate-400 py-4 text-center">No departures scheduled today.</p>}
            {d.departuresToday.map((a) => (
              <div key={a.id} className="flex items-center gap-3 rounded-xl border border-line bg-canvas/60 px-3.5 py-2.5 hover:border-gold-300 transition">
                <div className={cx('size-9 rounded-lg grid place-items-center text-[11px] font-bold shrink-0', avatarTone(a.guest_name))}>{initials(a.guest_name)}</div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-bold text-ink-900 truncate">{a.guest_name} {a.guest_vip ? <span className="text-[9.5px] bg-ink-900 text-gold-300 rounded-full px-1.5 py-0.5">VIP</span> : ''}</p>
                  <p className="text-[12px] text-slate-400 truncate">Room {a.room_number} · total {money(a.total)} {a.balance > 0 && <span className="text-rose-500 font-bold">· {money(a.balance)} due</span>}</p>
                </div>
                <Button size="sm" onClick={() => nav(`/check-out/${a.id}`)} className="max-sm:!px-2">Check-out <ArrowRight className="size-3.5" /></Button>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* bottom row */}
      <div className="grid xl:grid-cols-3 gap-4">
        <Card className="p-5 xl:col-span-2 overflow-hidden">
          <SectionTitle title="Recent reservations" subtitle="Latest bookings across all channels"
            action={<Link className="text-[12.5px] font-bold text-gold-600 hover:underline" to="/reservations">All reservations →</Link>} />
          <div className="-mx-5 -mb-5 overflow-x-auto">
            <table className="w-full text-[13px] min-w-[640px]">
              <thead><tr><Th>Guest</Th><Th>Dates</Th><Th>Room</Th><Th>Source</Th><Th>Status</Th><Th className="text-right">Total</Th></tr></thead>
              <tbody>
                {d.recentReservations.map((x) => (
                  <tr key={x.id} className="hover:bg-canvas/70 cursor-pointer" onClick={() => nav(`/reservations?q=${x.confirmation_no}`)}>
                    <Td><p className="font-bold text-ink-900">{x.guest_name}</p><p className="text-[11px] text-slate-400">{x.confirmation_no} · {fmtTime(x.created_at)}</p></Td>
                    <Td><p className="font-semibold">{fmtRange(x.check_in, x.check_out)}</p><p className="text-[11px] text-slate-400">{nights(x.check_in, x.check_out)} nights</p></Td>
                    <Td>{x.room_number ? `Room ${x.room_number}` : 'Unassigned'}<p className="text-[11px] text-slate-400">{x.category_name}</p></Td>
                    <Td><Badge tone={x.source === 'Website' ? 'blue' : x.source === 'Walk-in' ? 'gold' : 'slate'}>{x.source}</Badge></Td>
                    <Td><span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${resStatusMeta[x.status as keyof typeof resStatusMeta]?.chip}`}>{x.status}</span></Td>
                    <Td className="text-right font-bold tabular-nums text-ink-900">{x.total != null ? money(x.total) : money(x.rate_per_night * nights(x.check_in, x.check_out))}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle title="Activity timeline" subtitle="What your team did recently" />
          <ol className="relative space-y-4 pl-6">
            <span className="absolute left-[9px] top-1 bottom-1 w-px bg-line" />
            {activity.map((a) => (
              <li key={a.id} className="relative">
                <span className={cx('absolute -left-[calc(1.5rem-7px)] top-1 size-2.5 rounded-full ring-4 ring-white',
                  a.type === 'checkin' ? 'bg-sky-500' : a.type === 'checkout' ? 'bg-slate-400' : a.type === 'payment' ? 'bg-emerald-500' : a.type === 'room' ? 'bg-rose-400' : 'bg-gold-500')} />
                <p className="text-[13px] font-semibold text-ink-900 leading-snug">{a.message}</p>
                <p className="text-[11.5px] text-slate-400 mt-0.5">{a.actor} · {fmtDate(a.created_at)} {fmtTime(a.created_at) !== '—' && fmtTime(a.created_at)}</p>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      {/* pending folios strip */}
      {d.pendingFolios.length > 0 && (
        <Card className="p-5 border-rose-200/70">
          <SectionTitle title="Outstanding guest balances" subtitle="Checked-in guests with open folios — collect before departure"
            action={<Link className="text-[12.5px] font-bold text-rose-500 hover:underline" to="/billing">Billing centre →</Link>} />
          <div className="flex flex-wrap gap-2.5">
            {d.pendingFolios.map((f) => (
              <button key={f.id} onClick={() => nav(`/check-out/${f.id}`)}
                className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50/60 px-3.5 py-2 hover:bg-rose-100/60 transition text-left">
                <UsersRound className="size-4 text-rose-400" />
                <div>
                  <p className="text-[13px] font-bold text-ink-900">{f.guest_name} {f.room_number && `· Room ${f.room_number}`}</p>
                  <p className="text-[11.5px] text-rose-500 font-bold">{money(f.balance)} due</p>
                </div>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* quick actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: Zap, label: 'Express check-in', sub: 'Skip straight to arrival', onClick: () => nav('/front-desk'), tone: 'bg-ink-900 text-gold-300' },
          { icon: UserPlus, label: 'Walk-in guest', sub: 'Register on the spot', onClick: () => nav('/front-desk?walkin=1'), tone: 'ga-seal text-white' },
          { icon: ClipboardList, label: 'Housekeeping board', sub: `${d.housekeepingOpen} open tasks`, onClick: () => nav('/housekeeping'), tone: 'bg-amber-500/15 text-amber-600' },
          { icon: Activity, label: 'Night audit', sub: (() => { void compact; return 'Reports & exports'; })(), onClick: () => nav('/reports'), tone: 'bg-emerald-500/15 text-emerald-600' },
        ].map((qa) => (
          <button key={qa.label} onClick={qa.onClick} className="card p-4 flex items-center gap-3.5 hover:shadow-pop hover:-translate-y-px transition-all text-left">
            <span className={cx('size-10 rounded-xl grid place-items-center shrink-0', qa.tone)}><qa.icon className="size-5" /></span>
            <span className="min-w-0"><p className="text-[13.5px] font-bold text-ink-900">{qa.label}</p><p className="text-[11.5px] text-slate-400 truncate">{qa.sub}</p></span>
          </button>
        ))}
      </div>

      <ReservationFormModal open={formOpen} onClose={() => setFormOpen(false)} initial={{ ...emptyDraft(), source: 'Reception' }} onSaved={() => load()} />
    </div>
  );
}
