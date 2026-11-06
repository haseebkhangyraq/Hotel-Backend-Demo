import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowDownToLine, ArrowUpFromLine, BedDouble, DoorOpen, Users, UserPlus, Search, KeyRound, Coffee,
} from 'lucide-react';
import { api } from '../lib/api';
import type { Reservation } from '../lib/types';
import { Badge, Button, Card, EmptyState, Loading, SectionTitle, Tabs, Td, Th, useToast } from '../ui';
import { ReservationFormModal, emptyDraft } from '../components/ReservationForm';
import { money, fmtRange, nights, todayISO, cx, avatarTone, initials, plural, fmtDate } from '../lib/format';

type Board = { today: string; arrivals: Reservation[]; departures: Reservation[]; inHouse: Reservation[]; unassigned: Reservation[] };

export default function FrontDesk() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const { push } = useToast();
  const [tab, setTab] = useState<'arrivals' | 'departures' | 'inhouse'>('arrivals');
  const [data, setData] = useState<Board | null>(null);
  const [q, setQ] = useState('');
  const [formOpen, setFormOpen] = useState(!!params.get('walkin'));

  const load = useCallback(() => {
    api.get<Board>('/api/front-desk/today').then(setData).catch((e) => push(e.message, 'error'));
  }, [push]);
  useEffect(() => { load(); const t = setInterval(load, 25000); return () => clearInterval(t); }, [load]);

  if (!data) return <Loading />;

  const match = (r: Reservation) => !q.trim() || `${r.guest_name} ${r.room_number ?? ''} ${r.confirmation_no}`.toLowerCase().includes(q.toLowerCase());

  const arrivals = data.arrivals.filter(match);
  const departures = data.departures.filter(match);
  const inHouse = data.inHouse.filter(match);

  return (
    <div className="p-4 sm:p-6 pb-24 lg:pb-8 max-w-[1600px] mx-auto space-y-5 anim-fade-up">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-gold-600">Reception</p>
          <h1 className="text-[26px] font-extrabold text-ink-900 tracking-tight font-display">Front Desk</h1>
          <p className="text-[13px] text-slate-400 mt-0.5">{fmtDate(data.today)} · {data.arrivals.length} arrival{data.arrivals.length === 1 ? '' : 's'}, {data.departures.length} departure{data.departures.length === 1 ? '' : 's'}, {data.inHouse.length} in-house</p>
        </div>
        <div className="flex gap-2">
          <div className="relative hidden sm:block">
            <Search className="size-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search guest or room…" className="input-base pl-9 w-[230px]" />
          </div>
          <Button variant="gold" onClick={() => setFormOpen(true)}><UserPlus className="size-4" /> Walk-in registration</Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Tabs value={tab} onChange={setTab} tabs={[
          { id: 'arrivals', label: 'Arrivals', badge: data.arrivals.length },
          { id: 'departures', label: 'Departures', badge: data.departures.length },
          { id: 'inhouse', label: 'In-house guests', badge: data.inHouse.length },
        ]} />
      </div>

      {tab === 'arrivals' && (
        <div className="space-y-3">
          {arrivals.length === 0 && <Card><EmptyState icon={Users} title="No arrivals due today" subtitle="Walk-ins can be registered at any time." /></Card>}
          {arrivals.map((r) => (
            <ArrivalCard key={r.id} r={r} nav={nav} />
          ))}
        </div>
      )}

      {tab === 'departures' && (
        <Card className="overflow-x-auto">
          <table className="w-full text-[13px] min-w-[760px]">
            <thead><tr><Th>Guest</Th><Th>Room</Th><Th>Stay</Th><Th className="text-right">Folio</Th><Th /></tr></thead>
            <tbody>
              {departures.length === 0 && <tr><td colSpan={5}><EmptyState icon={ArrowUpFromLine} title="Departures clear" subtitle="No guests are leaving today." /></td></tr>}
              {departures.map((r) => (
                <tr key={r.id} className="hover:bg-canvas/60">
                  <Td><div className="flex items-center gap-2.5">
                    <span className={cx('size-8 rounded-lg grid place-items-center text-[10.5px] font-bold', avatarTone(r.guest_name))}>{initials(r.guest_name)}</span>
                    <div><p className="font-bold text-ink-900">{r.guest_name}</p><p className="text-[11px] text-slate-400">{r.confirmation_no}</p></div>
                  </div></Td>
                  <Td><span className="font-bold">Room {r.room_number}</span><p className="text-[11px] text-slate-400">floor {r.room_floor}</p></Td>
                  <Td><p className="font-semibold">{fmtRange(r.check_in, r.check_out)}</p><p className="text-[11px] text-slate-400">{nights(r.check_in, r.check_out)} nights</p></Td>
                  <Td className="text-right"><p className="font-bold tabular-nums">{money(r.total)}</p><p className={cx('text-[11px] font-bold', r.balance > 0 ? 'text-rose-500' : 'text-emerald-600')}>{r.balance > 0 ? `${money(r.balance)} due` : 'settled'}</p></Td>
                  <Td className="text-right"><Button size="sm" variant="gold" onClick={() => nav(`/check-out/${r.id}`)}>Check out <ArrowUpFromLine className="size-3.5" /></Button></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {tab === 'inhouse' && (
        <Card className="overflow-x-auto">
          <table className="w-full text-[13px] min-w-[820px]">
            <thead><tr><Th>Guest</Th><Th>Room</Th><Th>Dates</Th><Th>VIP</Th><Th className="text-right">Balance</Th><Th /></tr></thead>
            <tbody>
              {inHouse.map((r) => (
                <tr key={r.id} className="hover:bg-canvas/60">
                  <Td><div className="flex items-center gap-2.5">
                    <span className={cx('size-8 rounded-lg grid place-items-center text-[10.5px] font-bold', avatarTone(r.guest_name))}>{initials(r.guest_name)}</span>
                    <div><p className="font-bold text-ink-900">{r.guest_name}</p><p className="text-[11px] text-slate-400">{r.category_name}</p></div>
                  </div></Td>
                  <Td><span className="font-bold">Room {r.room_number}</span><p className="text-[11px] text-slate-400">{r.room_number && `floor ${r.room_floor}`}</p></Td>
                  <Td><span className="font-semibold">{fmtRange(r.check_in, r.check_out)}</span><p className={cx('text-[11px] font-bold', r.check_out === todayISO() ? 'text-amber-600' : 'text-slate-400')}>departs {r.check_out === todayISO() ? 'TODAY' : fmtDate(r.check_out)}</p></Td>
                  <Td>{r.vip ? <Badge tone="gold">VIP</Badge> : '—'}</Td>
                  <Td className="text-right font-bold tabular-nums">{r.balance > 0 ? <span className="text-rose-500">{money(r.balance)}</span> : <span className="text-emerald-600">Settled</span>}</Td>
                  <Td className="text-right"><Button size="sm" onClick={() => nav(`/check-out/${r.id}`)}>Folio / check-out</Button></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* preview strip of unassigned upcoming stays */}
      {data.unassigned.length > 0 && (
        <Card className="p-5 border-amber-200">
          <SectionTitle title="Upcoming stays without a room" subtitle="Assign rooms before the guest arrives to avoid check-in delays" />
          <div className="flex flex-wrap gap-2.5">
            {data.unassigned.map((r) => (
              <div key={r.id} className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50/60 px-3.5 py-2 text-left">
                <BedDouble className="size-4 text-amber-600" />
                <div>
                  <p className="text-[13px] font-bold text-ink-900">{r.guest_name} · {r.category_name}</p>
                  <p className="text-[11.5px] text-amber-700 font-semibold">{fmtRange(r.check_in, r.check_out)} · {r.status}</p>
                </div>
                <Button size="sm" variant="soft" onClick={() => nav(`/check-in/${r.id}`)}>Assign & check in</Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {formOpen && (
        <ReservationFormModal open onClose={() => setFormOpen(false)}
          initial={{ ...emptyDraft(), source: 'Walk-in', check_in: todayISO() }}
          title="Walk-in guest registration"
          onSaved={(r) => { push(`${r.confirmation_no} created for ${r.guest_name}`, 'success'); load(); }} />
      )}
    </div>
  );
}

function ArrivalCard({ r, nav }: { r: Reservation; nav: (to: string) => void }) {
  const dueToday = r.check_in === todayISO();
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className={cx('size-11 rounded-xl grid place-items-center text-[13px] font-bold shrink-0', avatarTone(r.guest_name))}>{initials(r.guest_name)}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-ink-900 text-[14.5px]">{r.guest_name}</p>
            {r.vip ? <Badge tone="gold">VIP</Badge> : null}
            <Badge tone={r.status === 'Pending' ? 'amber' : 'green'}>{r.status}</Badge>
            {dueToday ? <Badge tone="blue">Arriving today</Badge> : <Badge tone="slate">{fmtDate(r.check_in)}</Badge>}
          </div>
          <p className="text-[12.5px] text-slate-400 mt-0.5">
            {r.confirmation_no} · {r.category_name} · {fmtRange(r.check_in, r.check_out)} · {plural(nights(r.check_in, r.check_out), 'night')} · {r.adults + r.children} guest{r.adults + r.children === 1 ? '' : 's'}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Room</p>
          <p className={cx('font-extrabold text-[16px]', r.room_number ? 'text-ink-900' : 'text-amber-500')}>{r.room_number ?? 'Unassigned'}</p>
        </div>
        <Button variant={r.room_number ? 'gold' : 'outline'} onClick={() => nav(`/check-in/${r.id}`)}>
          <KeyRound className="size-4" /> {r.room_number ? 'Check in' : 'Assign & check in'}
        </Button>
      </div>
      {(r.special_requests || r.balance > 0) && (
        <div className="mt-3 pt-3 border-t border-line flex flex-wrap gap-x-5 gap-y-1 text-[12px]">
          {r.special_requests && <p className="text-slate-500"><Coffee className="inline size-3.5 mr-1 text-gold-500" />{r.special_requests}</p>}
          {r.balance > 0 && <p className="font-bold text-rose-500">Open balance: {money(r.balance)}</p>}
        </div>
      )}
    </Card>
  );
}
