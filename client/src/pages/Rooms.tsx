import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  LayoutGrid, List, Plus, Search, Pencil, Trash2, Wrench, Sparkles, KeyRound, CalendarSearch, X, Check, DoorClosed, Users
} from 'lucide-react';
import { api } from '../lib/api';
import type { Room, RoomCategory, RoomStatus } from '../lib/types';
import { Badge, Button, Card, EmptyState, Input, Loading, Modal, Select, Tabs, Td, Th, Textarea, FieldError, useToast } from '../ui';
import { roomStatusMeta, StatusChip } from '../lib/status';
import { money, cx, avatarTone, initials, todayISO, addDaysISO, fmtRange } from '../lib/format';

const STATUSES: RoomStatus[] = ['Available', 'Reserved', 'Occupied', 'Dirty', 'Cleaning', 'Maintenance'];

export default function Rooms() {
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const { push } = useToast();
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [tab, setTab] = useState<'rooms' | 'categories' | 'availability'>('rooms');
  const [rooms, setRooms] = useState<Room[] | null>(null);
  const [cats, setCats] = useState<RoomCategory[]>([]);
  const [statusF, setStatusF] = useState('');
  const [catF, setCatF] = useState('');
  const [floorF, setFloorF] = useState('');
  const [q, setQ] = useState(params.get('q') || '');
  const [editRoom, setEditRoom] = useState<Partial<Room> | null>(null);
  const [editCat, setEditCat] = useState<Partial<RoomCategory> | null>(null);
  const [availability, setAvailability] = useState<{ checkIn: string; checkOut: string; categories: { category: RoomCategory; total: number; available: number }[] } | null>(null);
  const [avRange, setAvRange] = useState({ in: todayISO(), out: addDaysISO(todayISO(), 2) });

  const load = useCallback(async () => {
    const ps = new URLSearchParams();
    if (statusF) ps.set('status', statusF);
    if (catF) ps.set('category', catF);
    if (floorF) ps.set('floor', floorF);
    if (q.trim()) ps.set('q', q.trim());
    const [r, c] = await Promise.all([
      api.get<{ rooms: Room[] }>(`/api/rooms?${ps}`),
      api.get<{ categories: RoomCategory[] }>('/api/room-categories'),
    ]);
    setRooms(r.rooms);
    setCats(c.categories);
  }, [statusF, catF, floorF, q]);

  useEffect(() => { load().catch((e) => push(e.message, 'error')); }, [load, push]);
  useEffect(() => { if (q) setParams({ q }, { replace: true }); }, [q, setParams]);

  const checkAvail = async () => {
    const r = await api.get<NonNullable<typeof availability>>(`/api/rooms/availability?checkIn=${avRange.in}&checkOut=${avRange.out}`);
    setAvailability(r);
  };

  if (!rooms) return <Loading />;

  const counts = Object.fromEntries(STATUSES.map((s) => [s, rooms.filter((r) => r.status === s).length]));
  const floors = [...new Set(rooms.map((r) => r.floor))].sort();

  return (
    <div className="p-4 sm:p-6 pb-24 lg:pb-8 max-w-[1600px] mx-auto space-y-5 anim-fade-up">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-gold-600">Inventory</p>
          <h1 className="text-[26px] font-extrabold text-ink-900 tracking-tight font-display">Rooms & Suites</h1>
          <p className="text-[13px] text-slate-400 mt-0.5">{rooms.length} rooms shown · {cats.length} categories · status colours match house boards.</p>
        </div>
        <div className="flex gap-2">
          <div className="inline-flex rounded-xl border border-line overflow-hidden">
            <button onClick={() => setView('grid')} className={cx('px-3 py-2.5', view === 'grid' ? 'bg-ink-900 text-gold-300' : 'text-slate-400 hover:bg-slate-50')}><LayoutGrid className="size-4" /></button>
            <button onClick={() => setView('list')} className={cx('px-3 py-2.5', view === 'list' ? 'bg-ink-900 text-gold-300' : 'text-slate-400 hover:bg-slate-50')}><List className="size-4" /></button>
          </div>
          <Button variant="gold" onClick={() => setEditRoom({ status: 'Available', category_id: cats[0]?.id, floor: 1, max_occupancy: 2 })}><Plus className="size-4" /> Add room</Button>
        </div>
      </div>

      <Tabs value={tab} onChange={setTab} tabs={[
        { id: 'rooms', label: 'Rooms' },
        { id: 'categories', label: 'Categories & rates' },
        { id: 'availability', label: 'Availability check' },
      ]} />

      {tab === 'rooms' && (
        <>
          <Card className="p-4 no-print">
            <div className="flex flex-wrap gap-2.5">
              <div className="flex flex-wrap gap-1.5">
                <button onClick={() => setStatusF('')} className={cx('rounded-full border px-3 py-1.5 text-[12px] font-bold transition', !statusF ? 'border-ink-900 bg-ink-900 text-gold-300' : 'border-line text-slate-500 hover:bg-slate-50')}>
                  All ({rooms.length})
                </button>
                {STATUSES.map((s) => (
                  <button key={s} onClick={() => setStatusF(s === statusF ? '' : s)}
                    className={cx('inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-bold transition', statusF === s ? roomStatusMeta[s].chip : 'border-line text-slate-500 hover:bg-slate-50')}>
                    <span className={cx('size-2 rounded-full', roomStatusMeta[s].dot)} /> {s} {counts[s] ? `(${counts[s]})` : ''}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 ml-auto">
                <div className="relative">
                  <Search className="size-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Room number, category, note…" className="input-base pl-9 w-[210px]" />
                </div>
                <Select value={catF} onChange={(e) => setCatF(e.target.value)} className="!w-[170px] !py-1.5 self-center">
                  <option value="">All categories</option>
                  {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
                <Select value={floorF} onChange={(e) => setFloorF(e.target.value)} className="!w-[110px] !py-1.5 self-center">
                  <option value="">Floors</option>
                  {floors.map((f) => <option key={f} value={f}>Floor {f}</option>)}
                </Select>
              </div>
            </div>
          </Card>

          {view === 'grid' ? (
            <div className="space-y-4">
              {floors.map((floor) => (
                <div key={floor}>
                  <p className="text-[11.5px] font-extrabold uppercase tracking-[0.14em] text-slate-400 mb-2 px-1">Floor {floor}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                    {rooms.filter((r) => r.floor === floor).map((r) => <RoomCard key={r.id} r={r} onEdit={() => setEditRoom(r)} onDelete={async () => {
                      if (!confirm(`Delete room ${r.number}?`)) return;
                      try { await api.del(`/api/rooms/${r.id}`); push(`Room ${r.number} deleted`); load(); } catch (e) { push((e as Error).message, 'error'); }
                    }} />)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Card className="overflow-x-auto">
              <table className="w-full text-[13px] min-w-[880px]">
                <thead><tr><Th>Room</Th><Th>Category</Th><Th>Floor</Th><Th>Max occ.</Th><Th className="text-right">Rate</Th><Th>Status</Th><Th>Guest</Th><Th className="no-print" /></tr></thead>
                <tbody>
                  {rooms.map((r) => (
                    <tr key={r.id} className="hover:bg-canvas/60">
                      <Td><span className="font-extrabold text-ink-900">{r.number}</span></Td>
                      <Td>{r.category_name}</Td>
                      <Td>{r.floor}</Td>
                      <Td>{r.max_occupancy}</Td>
                      <Td className="text-right font-semibold tabular-nums">{money(r.rate ?? r.base_rate ?? 0)}</Td>
                      <Td><StatusChip status={r.status} /></Td>
                      <Td>{r.reservation ? <button className="font-semibold text-sky-700 hover:underline" onClick={() => nav(`/reservations?q=${r.reservation!.confirmation_no}`)}>{r.reservation.guest_name}</button> : <span className="text-slate-300">—</span>}</Td>
                      <Td className="no-print text-right">
                        <button onClick={() => setEditRoom(r)} className="p-1.5 rounded-lg text-slate-400 hover:text-ink-900 hover:bg-slate-100"><Pencil className="size-4" /></button>
                        <button onClick={async () => {
                          if (!confirm(`Delete room ${r.number}?`)) return;
                          try { await api.del(`/api/rooms/${r.id}`); push(`Room ${r.number} deleted`); load(); } catch (e) { push((e as Error).message, 'error'); }
                        }} className="p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50"><Trash2 className="size-4" /></button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </>
      )}

      {tab === 'categories' && (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {cats.map((c) => (
            <Card key={c.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-extrabold text-ink-900 text-[16px]">{c.name}</p>
                  <p className="text-[12.5px] text-slate-400 mt-0.5 line-clamp-2">{c.description}</p>
                </div>
                <Button size="sm" variant="soft" onClick={() => setEditCat(c)}><Pencil className="size-3.5" /> Edit</Button>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-4">
                <div className="rounded-xl bg-canvas px-3 py-2"><p className="text-[10px] font-bold uppercase text-slate-400">Rate</p><p className="font-extrabold text-ink-900 text-[14.5px] tabular-nums">{money(c.base_rate)}</p><p className="text-[10.5px] text-slate-400">per night</p></div>
                <div className="rounded-xl bg-canvas px-3 py-2"><p className="text-[10px] font-bold uppercase text-slate-400">Rooms</p><p className="font-extrabold text-ink-900 text-[14.5px]">{c.room_count}</p><p className="text-[10.5px] text-slate-400">{c.occupied_count} occupied</p></div>
                <div className="rounded-xl bg-canvas px-3 py-2"><p className="text-[10px] font-bold uppercase text-slate-400">Max guests</p><p className="font-extrabold text-ink-900 text-[14.5px]">{c.max_occupancy}</p><p className="text-[10.5px] text-slate-400">{c.bed}</p></div>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {c.amenities.slice(0, 6).map((a) => <span key={a} className="rounded-full bg-gold-50 border border-gold-200/60 text-gold-600 text-[11px] font-semibold px-2.5 py-0.5">{a}</span>)}
              </div>
            </Card>
          ))}
          <button onClick={() => setEditCat({ base_rate: 12000, max_occupancy: 2, size_sqm: 32, bed: 'King bed', amenities: [] })}
            className="rounded-2xl border-2 border-dashed border-line text-slate-400 hover:border-gold-400 hover:text-gold-600 transition-all flex flex-col items-center justify-center gap-2 min-h-[220px]">
            <Plus className="size-6" /><p className="font-bold text-[13.5px]">Add room category</p>
          </button>
        </div>
      )}

      {tab === 'availability' && (
        <Card className="p-5">
          <div className="flex flex-wrap items-end gap-3 mb-4">
            <div className="flex items-center gap-2 text-slate-500 font-bold text-[12.5px] uppercase tracking-wider"><CalendarSearch className="size-4" /> Check availability</div>
            <Input type="date" label="From" value={avRange.in} onChange={(e) => setAvRange({ ...avRange, in: e.target.value })} className="!w-[160px]" />
            <Input type="date" label="To" value={avRange.out} onChange={(e) => setAvRange({ ...avRange, out: e.target.value })} className="!w-[160px]" />
            <Button variant="gold" onClick={checkAvail}>Check {fmtRange(avRange.in, avRange.out)}</Button>
          </div>
          {availability ? (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {availability.categories.map((c) => (
                <div key={c.category.id} className={cx('rounded-2xl border p-4', c.available > 0 ? 'border-emerald-200 bg-emerald-50/40' : 'border-rose-200 bg-rose-50/40')}>
                  <div className="flex items-center justify-between">
                    <p className="font-extrabold text-ink-900">{c.category.name}</p>
                    {c.available >= c.total ? <Check className="size-4.5 text-emerald-500" /> : c.available > 0 ? <Badge tone="amber">limited</Badge> : <X className="size-4.5 text-rose-500" />}
                  </div>
                  <p className="text-[24px] font-extrabold text-ink-900 mt-2 tabular-nums">{c.available}<span className="text-[13px] text-slate-400 font-bold"> / {c.total} free</span></p>
                  <p className="text-[12px] text-slate-500 mt-1">{money(c.category.base_rate)} per night · up to {c.category.max_occupancy} guests</p>
                </div>
              ))}
            </div>
          ) : <p className="text-[13px] text-slate-400">Pick dates and press Check to see free rooms per category — the same engine the public website API uses.</p>}
        </Card>
      )}

      <RoomEditModal room={editRoom} onClose={() => setEditRoom(null)} onSaved={() => { load(); }} cats={cats} />
      <CatEditModal cat={editCat} onClose={() => setEditCat(null)} onSaved={() => load()} />
    </div>
  );
}

function RoomCard({ r, onEdit, onDelete }: { r: Room; onEdit: () => void; onDelete: () => void }) {
  const meta = roomStatusMeta[r.status];
  return (
    <div className={cx('card p-3.5 group hover:shadow-pop hover:-translate-y-px transition-all border-t-[3px] !rounded-xl', meta.card.replace('border-', 'border-t-'))}>
      <div className="flex items-center justify-between">
        <p className="font-extrabold text-ink-900 text-[16px]">{r.number}</p>
        <span className={cx('size-2.5 rounded-full', meta.dot)} />
      </div>
      <p className="text-[10.5px] text-slate-400 truncate mt-0.5">{r.category_name?.replace(' Room', '')}</p>
      <div className="flex items-center justify-between mt-2.5">
        <StatusChip status={r.status} />
        <button onClick={onEdit} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md text-slate-400 hover:bg-slate-100 hover:text-ink-900"><Pencil className="size-3.5" /></button>
      </div>
      {r.reservation && (
        <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center gap-2">
          <div className={cx('size-6 rounded-md grid place-items-center text-[9px] font-bold shrink-0', avatarTone(r.reservation.guest_name))}>{initials(r.reservation.guest_name)}</div>
          <p className="text-[11px] font-semibold text-slate-600 truncate">{r.reservation.guest_name}</p>
        </div>
      )}
      {r.status === 'Maintenance' && (
        <p className="text-[10.5px] text-rose-500 font-bold mt-1.5 flex items-center gap-1"><Wrench className="size-3" /> maintenance</p>
      )}
    </div>
  );
}

function RoomEditModal({ room, onClose, onSaved, cats }: {
  room: Partial<Room> | null; onClose: () => void; onSaved: () => void; cats: RoomCategory[];
}) {
  const { push } = useToast();
  const [f, setF] = useState<Partial<Room>>({});
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => { setF(room || {}); setErrs({}); }, [room]);
  if (!room) return null;
  const isNew = !room.id;

  const save = async () => {
    const e: Record<string, string> = {};
    if (!f.number?.trim()) e.number = 'Room number required';
    if (!f.category_id) e.category_id = 'Pick a category';
    setErrs(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      if (isNew) await api.post('/api/rooms', f);
      else await api.put(`/api/rooms/${room.id}`, { ...f, number: f.number, status: f.status });
      push(isNew ? `Room ${f.number} added` : `Room ${f.number} updated`);
      onSaved(); onClose();
    } catch (er) { push((er as Error).message, 'error'); }
    setBusy(false);
  };

  return (
    <Modal open onClose={onClose} width="max-w-lg" title={isNew ? 'Add room' : `Edit room ${room.number}`}
      subtitle="Rate left empty inherits the category rate."
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="gold" loading={busy} onClick={save}>{isNew ? 'Add room' : 'Save changes'}</Button></>}>
      <div className="grid sm:grid-cols-2 gap-4">
        <div><Input label="Room number *" value={f.number || ''} onChange={(e) => setF({ ...f, number: e.target.value })} placeholder="e.g. 407" /><FieldError err={errs.number} /></div>
        <Select label="Category *" value={f.category_id ?? ''} onChange={(e) => setF({ ...f, category_id: Number(e.target.value) })}>
          <option value="">Select…</option>
          {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <FieldError err={errs.category_id} />
        <Input type="number" label="Floor" value={f.floor ?? ''} onChange={(e) => setF({ ...f, floor: +e.target.value })} />
        <Input type="number" label="Max occupancy" value={f.max_occupancy ?? ''} onChange={(e) => setF({ ...f, max_occupancy: +e.target.value })} />
        <Input type="number" step={100} label="Rate per night (₨)" value={f.rate ?? ''} onChange={(e) => setF({ ...f, rate: e.target.value === '' ? undefined : +e.target.value })} placeholder="Inherit category rate" />
        <Select label="Status" value={f.status || 'Available'} onChange={(e) => setF({ ...f, status: e.target.value as RoomStatus })}>
          {STATUSES.map((s) => <option key={s}>{s}</option>)}
        </Select>
        <Textarea className="sm:col-span-2" label="Notes (maintenance, housekeeping context)" value={f.notes || ''} onChange={(e) => setF({ ...f, notes: e.target.value })} />
      </div>
    </Modal>
  );
}

function CatEditModal({ cat, onClose, onSaved }: { cat: Partial<RoomCategory> | null; onClose: () => void; onSaved: () => void }) {
  const { push } = useToast();
  const [f, setF] = useState<Partial<RoomCategory>>({});
  const [busy, setBusy] = useState(false);
  const [amenity, setAmenity] = useState('');
  useEffect(() => { setF(cat || {}); }, [cat]);
  if (!cat) return null;
  const isNew = !cat.id;

  const save = async () => {
    if (!f.name?.trim()) { push('Name is required', 'error'); return; }
    setBusy(true);
    try {
      if (isNew) await api.post('/api/room-categories', f);
      else await api.put(`/api/room-categories/${cat.id}`, f);
      push(isNew ? 'Category created' : 'Category updated');
      onSaved(); onClose();
    } catch { push('Save failed', 'error'); }
    setBusy(false);
  };

  return (
    <Modal open onClose={onClose} width="max-w-xl" title={isNew ? 'New room category' : `Edit ${cat.name}`}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="gold" loading={busy} onClick={save}>Save</Button></>}>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2"><Input label="Name *" value={f.name || ''} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Sky Lofts" /></div>
        <Textarea className="sm:col-span-2" label="Description" value={f.description || ''} onChange={(e) => setF({ ...f, description: e.target.value })} />
        <Input type="number" label="Base rate (₨ / night)" value={f.base_rate ?? ''} onChange={(e) => setF({ ...f, base_rate: +e.target.value })} />
        <Input type="number" label="Max occupancy" value={f.max_occupancy ?? ''} onChange={(e) => setF({ ...f, max_occupancy: +e.target.value })} />
        <Input type="number" label="Size (m²)" value={f.size_sqm ?? ''} onChange={(e) => setF({ ...f, size_sqm: +e.target.value })} />
        <Input label="Bed configuration" value={f.bed || ''} onChange={(e) => setF({ ...f, bed: e.target.value })} placeholder="1 King bed" />
        <div className="sm:col-span-2">
          <label className="label-base">Amenities</label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {(f.amenities || []).map((a) => (
              <button key={a} onClick={() => setF({ ...f, amenities: (f.amenities || []).filter((x) => x !== a) })}
                className="rounded-full bg-gold-50 border border-gold-200 text-gold-600 text-[12px] font-semibold px-2.5 py-1 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-500 transition-all">{a} ×</button>
            ))}
          </div>
          <div className="flex gap-2">
            <Input value={amenity} onChange={(e) => setAmenity(e.target.value)} placeholder="Add amenity and press Enter"
              onKeyDown={(e) => { if (e.key === 'Enter' && amenity.trim()) { e.preventDefault(); setF({ ...f, amenities: [...(f.amenities || []), amenity.trim()] }); setAmenity(''); } }} />
          </div>
        </div>
      </div>
    </Modal>
  );
}
