import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus, Filter, X, Printer, Ban, Search as SearchIcon, CalendarDays, Pencil,
  ArrowDownToLine, ArrowUpFromLine, ShieldAlert,
} from 'lucide-react';
import { api } from '../lib/api';
import type { Reservation, ReservationStatus, RoomCategory } from '../lib/types';
import { ReservationFormModal, emptyDraft, draftFromReservation } from '../components/ReservationForm';
import { Badge, Button, Card, Drawer, EmptyState, Loading, Modal, Select, Tabs, Td, Th, useToast } from '../ui';
import { StatusChip } from '../lib/status';
import { money, fmtDate, fmtRange, fmtTime, nights, cx, avatarTone, initials, todayISO, addDaysISO } from '../lib/format';

const STATUSES: (ReservationStatus | 'all')[] = ['all', 'Confirmed', 'Pending', 'Checked-in', 'Checked-out', 'Cancelled', 'No-show'];

export default function Reservations() {
  const nav = useNavigate();
  const { push } = useToast();
  const [params, setParams] = useSearchParams();
  const [rows, setRows] = useState<Reservation[] | null>(null);
  const [cats, setCats] = useState<RoomCategory[]>([]);
  const [statusTab, setStatusTab] = useState<string>(params.get('status') || 'all');
  const [q, setQ] = useState(params.get('q') || '');
  const [source, setSource] = useState('');
  const [catId, setCatId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(!!(params.get('status') || params.get('q')));
  const [detail, setDetail] = useState<Reservation | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Reservation | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Reservation | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [printTarget, setPrintTarget] = useState<Reservation | null>(null);

  const load = useCallback(async () => {
    const ps = new URLSearchParams();
    if (statusTab !== 'all') ps.set('status', statusTab);
    if (q.trim()) ps.set('q', q.trim());
    if (source) ps.set('source', source);
    if (catId) ps.set('categoryId', catId);
    if (dateFrom) ps.set('dateFrom', dateFrom);
    if (dateTo) ps.set('dateTo', dateTo);
    setParams((p) => { p.set('q', q); p.set('status', statusTab); return p; }, { replace: true });
    const r = await api.get<{ reservations: Reservation[] }>(`/api/reservations?${ps}`);
    setRows(r.reservations);
  }, [statusTab, q, source, catId, dateFrom, dateTo, setParams]);

  useEffect(() => { load().catch((e) => push(e.message, 'error')); }, [load, push]);
  useEffect(() => { api.get<{ categories: RoomCategory[] }>('/api/room-categories').then((r) => setCats(r.categories)); }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows?.length || 0 };
    for (const s of STATUSES.slice(1)) c[s] = rows?.filter((r) => r.status === s).length || 0;
    return c;
  }, [rows]);

  const openDetail = async (id: number) => {
    const r = await api.get<{ reservation: Reservation }>(`/api/reservations/${id}`);
    setDetail(r.reservation);
  };

  const doCancel = async () => {
    if (!cancelTarget) return;
    setBusy(true);
    try {
      await api.post(`/api/reservations/${cancelTarget.id}/cancel`, { reason: cancelReason });
      push(`Reservation ${cancelTarget.confirmation_no} cancelled`);
      setCancelTarget(null); setCancelReason('');
      await load();
      setDetail(null);
    } catch (e) { push((e as Error).message, 'error'); }
    setBusy(false);
  };

  const markNoShow = async (r: Reservation) => {
    try {
      await api.post(`/api/reservations/${r.id}/no-show`, { reason: 'Marked no-show at end of day.' });
      push(`${r.guest_name} marked No-show`, 'info');
      await load();
    } catch (e) { push((e as Error).message, 'error'); }
  };

  if (!rows) return <Loading />;

  return (
    <div className="p-4 sm:p-6 pb-24 lg:pb-8 max-w-[1600px] mx-auto space-y-5 anim-fade-up">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-gold-600">Stay bookings</p>
          <h1 className="text-[26px] font-extrabold text-ink-900 tracking-tight font-display">Reservations</h1>
          <p className="text-[13px] text-slate-400 mt-0.5">{rows.length} reservation{rows.length === 1 ? '' : 's'} in view — double-booking protection is always on.</p>
        </div>
        <div className="flex gap-2 no-print">
          <Button onClick={() => setShowFilters((s) => !s)}><Filter className="size-4" /> Filters</Button>
          <Button variant="gold" onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="size-4" /> New reservation</Button>
        </div>
      </div>

      {/* status tabs */}
      <Tabs value={statusTab as never} onChange={(v) => setStatusTab(v)}
        tabs={STATUSES.map((s) => ({ id: s, label: s === 'all' ? 'All' : s, badge: counts[s] }))} />

      {/* filters */}
      {showFilters && (
        <Card className="p-4 anim-fade-up no-print">
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <label className="label-base">Search</label>
              <div className="relative">
                <SearchIcon className="size-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Guest, ref, room…" className="input-base pl-9" />
              </div>
            </div>
            <Select label="Booking source" value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="">All sources</option>
              {['Website', 'Reception', 'Phone', 'Walk-in'].map((s) => <option key={s}>{s}</option>)}
            </Select>
            <Select label="Room category" value={catId} onChange={(e) => setCatId(e.target.value)}>
              <option value="">All categories</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <div><label className="label-base">From (check-in ≥)</label><input type="date" className="input-base" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></div>
            <div><label className="label-base">Until (check-in ≤)</label><input type="date" className="input-base" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></div>
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <Button variant="ghost" size="sm" onClick={() => { setQ(''); setSource(''); setCatId(''); setDateFrom(''); setDateTo(''); setStatusTab('all'); }}><X className="size-3.5" /> Reset</Button>
          </div>
        </Card>
      )}

      {/* table */}
      <Card className="overflow-x-auto">
        <table className="w-full text-[13px] min-w-[900px]">
          <thead>
            <tr>
              <Th>Confirmation</Th><Th>Guest</Th><Th>Stay dates</Th><Th>Room</Th><Th>Guests</Th><Th>Source</Th><Th className="text-right">Rate / night</Th><Th>Status</Th><Th />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={9}><EmptyState icon={CalendarDays} title="No reservations match" subtitle="Loosen the filters or create a new reservation." /></td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-canvas/70 cursor-pointer transition" onClick={() => openDetail(r.id)}>
                <Td>
                  <p className="font-bold text-ink-900 font-mono text-[12.5px]">{r.confirmation_no}</p>
                  <p className="text-[11px] text-slate-400">{fmtDate(r.created_at?.slice(0, 10))} · {r.created_by || 'system'}</p>
                </Td>
                <Td>
                  <div className="flex items-center gap-2.5">
                    <div className={cx('size-8 rounded-lg grid place-items-center text-[10.5px] font-bold shrink-0', avatarTone(r.guest_name))}>{initials(r.guest_name)}</div>
                    <div>
                      <p className="font-bold text-ink-900">{r.guest_name} {r.guest_vip ? <span className="text-[9px] bg-ink-900 text-gold-300 rounded-full px-1.5 py-0.5 font-bold">VIP</span> : ''}</p>
                      <p className="text-[11px] text-slate-400">{r.guest_phone}</p>
                    </div>
                  </div>
                </Td>
                <Td><p className="font-semibold">{fmtRange(r.check_in, r.check_out)}</p><p className="text-[11px] text-slate-400">{nights(r.check_in, r.check_out)} nights</p></Td>
                <Td>{r.room_number ? <span className="font-bold" onClick={(e) => { e.stopPropagation(); nav(`/rooms?q=${r.room_number}`); }}>Room {r.room_number}</span> : <span className="text-amber-600 font-semibold">Unassigned</span>}<p className="text-[11px] text-slate-400">{r.category_name}</p></Td>
                <Td><span className="font-semibold">{r.adults + r.children}</span><p className="text-[11px] text-slate-400">{r.adults} ad{r.children ? ` · ${r.children} kids` : ''}</p></Td>
                <Td><Badge tone={r.source === 'Website' ? 'blue' : r.source === 'Walk-in' ? 'gold' : 'slate'}>{r.source}</Badge></Td>
                <Td className="text-right font-semibold tabular-nums">{money(r.rate_per_night)}</Td>
                <Td><StatusChip status={r.status} /></Td>
                <Td className="no-print text-right">
                  <button onClick={(e) => { e.stopPropagation(); setPrintTarget(r); }} title="Print confirmation" className="p-1.5 rounded-lg text-slate-400 hover:text-ink-900 hover:bg-slate-100"><Printer className="size-4" /></button>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* -------- detail drawer -------- */}
      <Drawer open={!!detail} onClose={() => setDetail(null)}
        title={detail ? `${detail.guest_name} · ${detail.confirmation_no}` : ''}
        footer={detail && detail.folio ? (
          <>
            <Button variant="ghost" onClick={() => setPrintTarget(detail)}><Printer className="size-4" /> Print confirmation</Button>
            {['Confirmed', 'Pending'].includes(detail.status) && (
              <>
                {detail.check_in <= addDaysISO(todayISO(), 1)
                  ? <Button variant="gold" onClick={() => nav(`/check-in/${detail.id}`)}><ArrowDownToLine className="size-4" /> Check in{detail.room_id ? '' : ' & assign room'}</Button>
                  : null}
                <Button variant="danger" onClick={() => { setCancelTarget(detail); setCancelReason(''); }}><Ban className="size-4" /> Cancel</Button>
              </>
            )}
            {detail.status === 'Checked-in' && (
              <>
                <Button variant="soft" onClick={() => nav(`/check-out/${detail.id}`)}><ArrowUpFromLine className="size-4" /> Check out · {money(detail.folio.balance)} due</Button>
              </>
            )}
          </>
        ) : null}>
        {detail && (
          <div className="space-y-5">
            {/* status banner */}
            <div className={cx('rounded-2xl border p-4 flex items-center justify-between', detail.status === 'Checked-in' ? 'bg-sky-50/60 border-sky-200' : detail.status === 'Checked-out' ? 'bg-slate-50 border-slate-200' : ['Cancelled', 'No-show'].includes(detail.status) ? 'bg-rose-50/60 border-rose-200' : 'bg-emerald-50/50 border-emerald-200')}>
              <div>
                <StatusChip status={detail.status} />
                <p className="text-[12px] text-slate-500 mt-1.5">
                  {detail.checked_in_at && `Checked in ${fmtDate(detail.checked_in_at)} ${fmtTime(detail.checked_in_at)}`}
                  {detail.checked_out_at && ` · checked out ${fmtTime(detail.checked_out_at)}`}
                  {detail.cancel_reason && <span className="font-semibold text-rose-500"> · {detail.cancel_reason}</span>}
                </p>
              </div>
              {['Confirmed', 'Pending'].includes(detail.status) && (
                <Button size="sm" variant="outline" onClick={() => { setEditing(detail); setFormOpen(true); }}><Pencil className="size-3.5" /> Edit</Button>
              )}
            </div>

            {/* guest & stay */}
            <div className="grid sm:grid-cols-2 gap-4">
              <Card className="p-4 !bg-white">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">Guest</p>
                <div className="flex items-center gap-3 mb-3">
                  <div className={cx('size-11 rounded-xl grid place-items-center text-[13px] font-bold', avatarTone(detail.guest_name))}>{initials(detail.guest_name)}</div>
                  <div>
                    <p className="font-bold text-ink-900">{detail.guest_name} {detail.guest_vip ? <Badge tone="gold">VIP</Badge> : null}</p>
                    <p className="text-[12px] text-slate-400">{detail.guest_nationality}</p>
                  </div>
                </div>
                <dl className="space-y-1.5 text-[12.5px]">
                  <div className="flex justify-between"><dt className="text-slate-400">Phone</dt><dd className="font-semibold">{detail.guest_phone || '—'}</dd></div>
                  <div className="flex justify-between"><dt className="text-slate-400">Email</dt><dd className="font-semibold">{detail.guest_email || '—'}</dd></div>
                  <div className="flex justify-between"><dt className="text-slate-400">ID document</dt><dd className="font-semibold">{detail.id_doc_type || detail.guest_id_type || '—'} {detail.id_doc_number || detail.guest_id_number || ''}</dd></div>
                  <div className="flex justify-between gap-6"><dt className="text-slate-400 shrink-0">Preferences</dt><dd className="text-right font-semibold">{detail.guest_preferences || '—'}</dd></div>
                </dl>
              </Card>
              <Card className="p-4 !bg-white">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">Stay</p>
                <dl className="space-y-1.5 text-[12.5px]">
                  {[
                    ['Dates', `${fmtDate(detail.check_in)} → ${fmtDate(detail.check_out)}`],
                    ['Nights', String(nights(detail.check_in, detail.check_out))],
                    ['Room', detail.room_number ? `Room ${detail.room_number} (floor ${detail.room_floor})` : 'Unassigned'],
                    ['Category', detail.category_name],
                    ['Guests', `${detail.adults} adults${detail.children ? ` · ${detail.children} children` : ''}`],
                    ['Booking source', detail.source],
                    ['Rate / night', money(detail.rate_per_night)],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-6"><dt className="text-slate-400 shrink-0">{k}</dt><dd className="font-semibold text-right">{v}</dd></div>
                  ))}
                </dl>
              </Card>
            </div>

            {detail.special_requests && (
              <Card className="p-4 !bg-gold-50/50 !border-gold-200">
                <p className="text-[11px] font-bold uppercase tracking-wider text-gold-600 mb-1">Special requests</p>
                <p className="text-[13px] text-slate-700">{detail.special_requests}</p>
              </Card>
            )}
            {detail.notes && (
              <Card className="p-4 !bg-white">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Internal notes</p>
                <p className="text-[13px] text-slate-700">{detail.notes}</p>
              </Card>
            )}

            {/* folio preview */}
            {detail.folio && (
              <Card className="p-4 !bg-white">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">Charges & payments</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  {[['Subtotal', detail.folio.subtotal], ['Discount', -detail.folio.discount], ['Tax @ 17%', detail.folio.tax], ['Total', detail.folio.total]].map(([k, v], i) => (
                    <div key={i} className="rounded-xl bg-canvas px-3 py-2.5">
                      <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">{k}</p>
                      <p className="font-extrabold text-ink-900 tabular-nums text-[14px]">{money(Number(v))}</p>
                    </div>
                  ))}
                </div>
                {detail.folio.items.length > 0 && (
                  <table className="w-full text-[12.5px] mb-3">
                    <thead><tr className="text-left"><Th className="!px-0">Charge</Th><Th className="!px-0">Type</Th><Th className="text-right !px-0">Amount</Th></tr></thead>
                    <tbody>
                      {detail.folio.items.map((it) => (
                        <tr key={it.id}>
                          <Td className="!px-0">{it.description}<span className="block text-[10.5px] text-slate-400">{it.quantity} × {money(it.unit_price)}</span></Td>
                          <Td className="!px-0"><Badge tone="slate">{it.type}</Badge></Td>
                          <Td className="text-right !px-0 font-semibold">{money(it.amount)}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {detail.folio.payments.length > 0 && (
                  <table className="w-full text-[12.5px]">
                    <thead><tr className="text-left"><Th className="!px-0">Payment</Th><Th className="!px-0">Method</Th><Th className="text-right !px-0">Amount</Th></tr></thead>
                    <tbody>
                      {detail.folio.payments.map((p) => (
                        <tr key={p.id}><Td className="!px-0">{p.purpose} · {fmtDate(p.paid_at)}</Td><Td className="!px-0"><Badge tone="slate">{p.method}</Badge></Td><Td className="text-right !px-0 font-semibold text-emerald-600">{money(p.amount)}</Td></tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <div className="flex justify-between items-center mt-3 pt-3 border-t border-line">
                  <p className="text-[12px] text-slate-500">Paid {money(detail.folio.paid)} · Received from guest {money(detail.folio.paid)}</p>
                  <p className={cx('font-extrabold text-[15px] tabular-nums', detail.folio.balance > 0 ? 'text-rose-500' : 'text-emerald-600')}>
                    Balance: {money(detail.folio.balance)}
                  </p>
                </div>
              </Card>
            )}
          </div>
        )}
      </Drawer>

      {/* create / edit modal */}
      {formOpen && (
        <ReservationFormModal open onClose={() => { setFormOpen(false); setEditing(null); }}
          initial={editing ? draftFromReservation(editing) : undefined}
          onSaved={() => { push('Saved', 'info'); load(); }} />
      )}

      {/* cancel modal */}
      <Modal open={!!cancelTarget} onClose={() => setCancelTarget(null)} title={`Cancel ${cancelTarget?.confirmation_no}?`}
        subtitle="The room is released immediately and the guest is notified from the reception log."
        footer={<><Button onClick={() => setCancelTarget(null)}>Keep reservation</Button><Button variant="danger" loading={busy} onClick={doCancel}>Confirm cancellation</Button></>}>
        {cancelTarget && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl bg-rose-50 border border-rose-200 p-3.5">
              <ShieldAlert className="size-5 text-rose-500" />
              <p className="text-[13px] text-rose-700 font-semibold">{cancelTarget.guest_name} · {cancelTarget.category_name} · {fmtRange(cancelTarget.check_in, cancelTarget.check_out)}</p>
            </div>
            <div>
              <label className="label-base">Cancellation reason</label>
              <textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} className="input-base" placeholder="Reason recorded in the audit trail…" />
            </div>
          </div>
        )}
      </Modal>

      {/* print confirmation (hidden preview used by window.print) */}
      {printTarget && (
        <div className="fixed inset-0 z-[80] p-6 overflow-auto bg-slate-100 print:bg-white">
          <div className="no-print max-w-3xl mx-auto mb-4 flex justify-between items-center">
            <Button variant="outline" onClick={() => setPrintTarget(null)}><X className="size-4" /> Close</Button>
            <Button variant="primary" onClick={() => window.print()}><Printer className="size-4" /> Print / save PDF</Button>
          </div>
          <ConfirmationPrint reservation={printTarget} />
        </div>
      )}
    </div>
  );
}

/* printable reservation confirmation */
export function ConfirmationPrint({ reservation }: { reservation: Reservation }) {
  return (
    <div className="print-page max-w-3xl mx-auto">
      <div className="card overflow-hidden print:shadow-none print:border-0">
        <div className="hero-nights text-white px-8 py-7 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="ga-seal size-12 rounded-2xl grid place-items-center"><span className="font-display text-[17px]">GA</span></div>
            <div>
              <p className="font-display text-xl font-semibold text-gold-300">Grand Aurelia Hotel & Resort</p>
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400 font-bold">Islamabad · Pakistan</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wider font-bold text-slate-400">Reservation confirmation</p>
            <p className="font-mono text-[17px] font-bold text-gold-300">{reservation.confirmation_no}</p>
          </div>
        </div>
        <div className="px-8 py-6 space-y-6">
          <div className="grid sm:grid-cols-2 gap-x-10 gap-y-5">
            <div>
              <p className="label-base">Booked for</p>
              <p className="font-bold text-ink-900 text-[16px]">{reservation.guest_name}</p>
              <p className="text-[13px] text-slate-500">{reservation.guest_phone}</p>
            </div>
            <div>
              <p className="label-base">Stay</p>
              <p className="font-bold text-ink-900">{fmtRange(reservation.check_in, reservation.check_out)} · {nights(reservation.check_in, reservation.check_out)} nights</p>
              <p className="text-[13px] text-slate-500">{reservation.adults} adult{reservation.children ? `, ${reservation.children} children` : ''}</p>
            </div>
            <div>
              <p className="label-base">Room</p>
              <p className="font-bold text-ink-900">{reservation.room_number ? `Room ${reservation.room_number}` : 'To be assigned at arrival'}</p>
              <p className="text-[13px] text-slate-500">{reservation.category_name}</p>
            </div>
            <div>
              <p className="label-base">Status</p>
              <p className="font-bold text-ink-900">{reservation.status}</p>
              <p className="text-[13px] text-slate-500">Booked via {reservation.source}</p>
            </div>
          </div>
          <div className="rounded-2xl bg-canvas p-5">
            <div className="flex justify-between text-[13px] font-semibold py-0.5"><span className="text-slate-500">Nights</span><span>{nights(reservation.check_in, reservation.check_out)} × {money(reservation.rate_per_night)}</span></div>
            {(reservation.discount ?? 0) > 0 && (
              <div className="flex justify-between text-[13px] font-semibold py-0.5"><span className="text-slate-500">Discount</span><span>− {money(reservation.discount)}</span></div>
            )}
            {reservation.total != null && (
              <>
                <div className="flex justify-between text-[13px] font-semibold py-0.5"><span className="text-slate-500">Taxes (17%)</span><span>included</span></div>
                <div className="flex justify-between text-[13px] font-semibold py-0.5"><span className="text-slate-500">Total stay</span><span>{money(reservation.total)}</span></div>
              </>
            )}
            <div className="flex justify-between text-[13px] font-semibold py-0.5"><span className="text-slate-500">Advance already paid</span><span className="text-emerald-600">{money(reservation.advance_payment || 0)}</span></div>
            <div className="flex justify-between text-[15px] font-extrabold pt-2 mt-1 border-t border-line"><span>Balance at hotel</span><span>{money(Math.max(0, (reservation.total ?? Math.round(reservation.rate_per_night * nights(reservation.check_in, reservation.check_out) * 1.17)) - (reservation.advance_payment || 0)))}</span></div>
          </div>
          <p className="text-[11.5px] text-slate-400 leading-relaxed">
            Present this confirmation at reception at check-in. A valid CNIC/passport matching the reservation name is required.
            For changes call +92 51 111 200 300 quoting {reservation.confirmation_no}.
          </p>
        </div>
      </div>
    </div>
  );
}
