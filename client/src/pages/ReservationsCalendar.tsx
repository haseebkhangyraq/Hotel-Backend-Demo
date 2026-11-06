import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, User, CalendarDays, StickyNote } from 'lucide-react';
import { api } from '../lib/api';
import type { Reservation, Room } from '../lib/types';
import { Loading, Card, Button, Modal, Badge, useToast } from '../ui';
import { resStatusMeta } from '../lib/status';
import { fmtDate, fmtRange, nights, todayISO, cx } from '../lib/format';

type CalRow = Reservation & { room_number: string | null };

export default function ReservationsCalendar() {
  const nav = useNavigate();
  const { push } = useToast();
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const [data, setData] = useState<{ rooms: Room[]; reservations: CalRow[] } | null>(null);
  const [sel, setSel] = useState<CalRow | null>(null);

  const load = useCallback(() => {
    api.get<{ rooms: Room[]; reservations: CalRow[]; month: string }>(`/api/reservations-calendar?month=${month}`)
      .then(setData).catch((e) => push(e.message, 'error'));
  }, [month, push]);
  useEffect(() => { load(); }, [load]);

  const days = useMemo(() => {
    const [y, m] = month.split('-').map(Number);
    const n = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return Array.from({ length: n }, (_, i) => i + 1);
  }, [month]);

  const shiftMonth = (d: number) => {
    const [y, m] = month.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1 + d, 1));
    setMonth(dt.toISOString().slice(0, 7));
  };

  if (!data) return <Loading />;

  const floors = [...new Set(data.rooms.map((r) => r.floor))].sort();
  const byRoom = new Map<number, CalRow[]>();
  for (const r of data.reservations) {
    if (!r.room_id) continue;
    const list = byRoom.get(r.room_id) || [];
    list.push(r);
    byRoom.set(r.room_id, list);
  }

  const colW = 34; // px per day cell

  return (
    <div className="p-4 sm:p-6 pb-24 lg:pb-8 max-w-[1600px] mx-auto space-y-4 anim-fade-up">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-gold-600">Room-level view</p>
          <h1 className="text-[26px] font-extrabold text-ink-900 tracking-tight font-display">Reservation Calendar</h1>
          <p className="text-[13px] text-slate-400 mt-0.5">Every confirmed, in-house and recent stay across all 32 rooms.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => shiftMonth(-1)} className="!px-2.5"><ChevronLeft className="size-4" /></Button>
          <div className="min-w-[150px] text-center">
            <p className="text-[16px] font-extrabold text-ink-900 font-display">
              {new Date(month + '-01T12:00Z').toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })}
            </p>
          </div>
          <Button onClick={() => shiftMonth(1)} className="!px-2.5"><ChevronRight className="size-4" /></Button>
        </div>
      </div>

      {/* legend */}
      <div className="flex flex-wrap gap-3 text-[12px] font-semibold text-slate-500">
        {Object.entries(resStatusMeta).map(([k, v]) => (
          <span key={k} className="inline-flex items-center gap-1.5"><span className={cx('size-2.5 rounded-[4px]', v.bar)} /> {k}</span>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[900px]">
            {/* header */}
            <div className="flex sticky top-0 bg-white z-10 border-b border-line">
              <div className="w-[190px] shrink-0 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-r border-line">Room</div>
              <div className="flex flex-1 min-w-0">
                {days.map((d) => {
                  const dt = new Date(`${month}-${String(d).padStart(2, '0')}T12:00Z`);
                  const weekend = dt.getUTCDay() === 5 || dt.getUTCDay() === 6;
                  const isToday = month === todayISO().slice(0, 7) && d === +todayISO().slice(8, 10);
                  return (
                    <div key={d} style={{ width: colW }} className={cx('h-10 grid place-items-center text-[10.5px] font-bold border-r border-slate-100',
                      isToday ? 'bg-gold-50 text-gold-600' : weekend ? 'bg-slate-50 text-slate-400' : 'text-slate-400')}>
                      <span>{d}</span>
                      <span className="block text-[8.5px] font-semibold uppercase -mt-0.5">{dt.toLocaleDateString('en', { weekday: 'narrow', timeZone: 'UTC' })}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            {/* room rows grouped by floor */}
            {floors.flatMap((floor) => [
              <div key={`f${floor}`} className="flex bg-canvas/70 border-y border-line">
                <div className="w-[190px] shrink-0 px-4 py-1.5 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Floor {floor}</div>
                <div className="flex-1 border-r" />
              </div>,
              ...data.rooms.filter((r) => r.floor === floor).map((room) => {
                const rows = byRoom.get(room.id) || [];
                // group rows per month segment
                const [y, m] = month.split('-').map(Number);
                const segs = rows.flatMap((r) => {
                  const ci = new Date(r.check_in + 'T12:00Z'), co = new Date(r.check_out + 'T12:00Z');
                  const from = Math.max(1, ci.getUTCFullYear() === y && ci.getUTCMonth() + 1 === m ? ci.getUTCDate() : 1);
                  const to = Math.min(days.length, co.getUTCFullYear() === y && co.getUTCMonth() + 1 === m ? co.getUTCDate() - 1 : days.length);
                  if (to < from) return [];
                  return [{ r, from, to }];
                });
                return (
                  <div key={room.id} className="flex border-b border-slate-100 hover:bg-canvas/40 group">
                    <div className="w-[190px] shrink-0 px-4 py-2 border-r border-line flex items-center gap-2">
                      <span className="text-[13px] font-extrabold text-ink-900 w-9">{room.number}</span>
                      <span className="text-[10.5px] text-slate-400 truncate">{room.category_name?.replace(' Room', '')}</span>
                    </div>
                    <div className="relative flex-1 min-w-0" style={{ height: 34 }}>
                      <div className="absolute inset-0 flex pointer-events-none">
                        {days.map((d) => {
                          const dt = new Date(`${month}-${String(d).padStart(2, '0')}T12:00Z`);
                          return <span key={d} style={{ width: colW }} className={cx('border-r border-slate-100', (dt.getUTCDay() === 5 || dt.getUTCDay() === 6) && month + '-' + String(d).padStart(2, '0') === todayISO() ? '' : (dt.getUTCDay() === 5 || dt.getUTCDay() === 6) && 'bg-slate-50')} />;
                        })}
                      </div>
                      {segs.map(({ r, from, to }) => (
                        <button key={r.id} onClick={() => setSel(r)} title={`${r.guest_name} · ${fmtRange(r.check_in, r.check_out)}`}
                          style={{ left: (from - 1) * colW + 1, width: (to - from + 1) * colW - 3 }}
                          className={cx('absolute top-[4px] h-[26px] rounded-md text-white text-[10px] font-bold px-1.5 overflow-hidden text-left hover:brightness-110 transition-all z-10 flex items-center gap-1',
                            resStatusMeta[r.status as keyof typeof resStatusMeta]?.bar || 'bg-slate-400')}>
                          <span className="truncate">{r.guest_name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              }),
            ])}
          </div>
        </div>
      </Card>
      <p className="text-[12px] text-slate-400">Click any stay block for details. Rooms without blocks are free for the whole month.</p>

      <Modal open={!!sel} onClose={() => setSel(null)} title={sel ? `${sel.guest_name} · ${sel.confirmation_no}` : ''} subtitle={sel ? `${sel.category_name} · room ${sel.room_number ?? '—'}` : ''}
        footer={<><Button onClick={() => setSel(null)}>Close</Button><Button variant="gold" onClick={() => nav(`/reservations?q=${sel?.confirmation_no}`)}>Open in reservations</Button></>}>
        {sel && (
          <div className="space-y-3 text-[13.5px]">
            <div className="flex items-center gap-2">
              <Badge tone="slate">{sel.status}</Badge><Badge tone="blue">{sel.source}</Badge>
            </div>
            <div className="flex justify-between"><span className="text-slate-400 flex items-center gap-1.5"><CalendarDays className="size-4" /> Dates</span><b>{fmtRange(sel.check_in, sel.check_out)} · {nights(sel.check_in, sel.check_out)} nights</b></div>
            <div className="flex justify-between"><span className="text-slate-400 flex items-center gap-1.5"><User className="size-4" /> Guests</span><b>{sel.adults} adults{sel.children ? `, ${sel.children} children` : ''}</b></div>
            {sel.special_requests && (
              <div className="rounded-xl bg-gold-50 border border-gold-200 p-3 text-[12.5px] text-slate-600 flex gap-2">
                <StickyNote className="size-4 text-gold-600 shrink-0" />{sel.special_requests}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
