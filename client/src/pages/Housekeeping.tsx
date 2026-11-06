import { useCallback, useEffect, useState } from 'react';
import {
  Sparkles, Wrench, ClipboardCheck, Plus, User, BrushCleaning, Search, Eye
} from 'lucide-react';
import { api } from '../lib/api';
import type { HousekeepingTask, MaintenanceRequest, Room, RoomStatus } from '../lib/types';
import { Badge, Button, Card, EmptyState, Input, Loading, Modal, Select, Textarea, useToast } from '../ui';
import { taskStatusMeta, roomStatusMeta } from '../lib/status';
import { fmtDate, fmtTime, cx, todayISO } from '../lib/format';

const COLUMNS: { id: HousekeepingTask['status']; label: string; hint: string }[] = [
  { id: 'Pending', label: 'Pending', hint: 'Awaiting start' },
  { id: 'In Progress', label: 'In progress', hint: 'Being cleaned' },
  { id: 'Cleaned', label: 'Cleaned', hint: 'Awaiting inspection' },
  { id: 'Inspected', label: 'Inspected', hint: 'Room released' },
];

export default function Housekeeping() {
  const { push } = useToast();
  const [data, setData] = useState<{ tasks: HousekeepingTask[]; staff: { id: number; name: string }[]; maintenance: MaintenanceRequest[]; dirtyRooms: Room[] } | null>(null);
  const [staffF, setStaffF] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [mntOpen, setMntOpen] = useState(false);
  const [draft, setDraft] = useState({ room_id: '', task_type: 'Cleaning', assigned_to: '', priority: 'Normal', notes: '' });
  const [mnt, setMnt] = useState({ room_id: '', title: '', detail: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    const q = staffF ? `?staffId=${staffF}` : '';
    api.get(`/api/housekeeping${q}`).then(setData).catch((e) => push(e.message, 'error'));
  }, [staffF, push]);
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);
  const [allRooms, setAllRooms] = useState<Room[]>([]);
  useEffect(() => { api.get<{ rooms: Room[] }>('/api/rooms').then((r) => setAllRooms(r.rooms)).catch(() => {}); }, []);

  if (!data) return <Loading />;

  const setTask = async (t: HousekeepingTask, patch: Record<string, unknown>) => {
    try {
      await api.put(`/api/housekeeping/${t.id}`, patch);
      load();
      if (patch.status) push(`Room ${t.room_number} task → ${patch.status}`, 'success');
    } catch (e) { push((e as Error).message, 'error'); }
  };

  const nextStatus = (s: string) =>
    s === 'Pending' ? 'In Progress' : s === 'In Progress' ? 'Cleaned' : s === 'Cleaned' ? 'Inspected' : null;

  const printBoard = () => window.print();

  return (
    <div className="p-4 sm:p-6 pb-24 lg:pb-8 max-w-[1600px] mx-auto space-y-5 anim-fade-up">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-gold-600">Housekeeping & engineering</p>
          <h1 className="text-[26px] font-extrabold text-ink-900 tracking-tight font-display">Cleaning board</h1>
          <p className="text-[13px] text-slate-400 mt-0.5">{fmtDate(todayISO())} · {data.tasks.filter((t) => t.status === 'Pending').length} pending · {data.dirtyRooms.length} rooms out of service</p>
        </div>
        <div className="flex gap-2 no-print">
          <Button onClick={printBoard}><BrushCleaning className="size-4" /> Print board</Button>
          <Button variant="outline" onClick={() => { setMnt({ room_id: '', title: '', detail: '' }); setMntOpen(true); }}><Wrench className="size-4" /> Maintenance request</Button>
          <Button variant="gold" onClick={() => { setDraft({ room_id: '', task_type: 'Cleaning', assigned_to: '', priority: 'Normal', notes: '' }); setCreateOpen(true); }}><Plus className="size-4" /> New task</Button>
        </div>
      </div>

      {/* dirty rooms strip */}
      <div className="flex flex-wrap gap-2.5">
        {data.dirtyRooms.map((r) => (
          <div key={r.id} className={cx('inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold', roomStatusMeta[r.status as RoomStatus].chip)}>
            <span className={cx('size-2 rounded-full', roomStatusMeta[r.status as RoomStatus].dot)} />
            Room {r.number} · {r.status}
          </div>
        ))}
        {data.dirtyRooms.length === 0 && <p className="text-[13px] text-slate-400">Every room is guest-ready — nothing out of service.</p>}
      </div>

      {/* kanban */}
      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
        {COLUMNS.map((col) => {
          const list = data.tasks.filter((t) => t.status === col.id);
          return (
            <div key={col.id} className="card !bg-canvas/60 border-line p-3 flex flex-col gap-2.5 min-h-[160px]" id={`hk-${col.id}`}>
              <div className="flex items-center justify-between px-1 pt-1">
                <div>
                  <p className="font-extrabold text-ink-900 text-[13.5px]">{col.label}</p>
                  <p className="text-[10.5px] text-slate-400">{col.hint}</p>
                </div>
                <span className={cx('rounded-full border px-2 py-0.5 text-[11px] font-bold', taskStatusMeta[col.id].chip)}>{list.length}</span>
              </div>
              {list.map((t) => (
                <div key={t.id} className="card !rounded-xl p-3.5 anim-fade-up">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-extrabold text-ink-900">Room {t.room_number}</p>
                    <Badge tone={t.priority === 'High' ? 'red' : t.priority === 'Low' ? 'slate' : 'slate'}>{t.priority}</Badge>
                  </div>
                  <p className="text-[11.5px] text-slate-400 mt-0.5">{t.task_type}{t.category_name ? ` · ${t.category_name.replace(' Room', '')}` : ''}</p>
                  {t.notes && <p className="text-[12px] text-slate-500 mt-2 line-clamp-2">{t.notes}</p>}
                  <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-slate-100">
                    <User className="size-3.5 text-slate-300" />
                    <Select value={t.assigned_to ?? ''} onChange={(e) => setTask(t, { assigned_to: e.target.value ? Number(e.target.value) : null })}
                      className="!py-1 !px-2 !text-[11.5px] flex-1 !bg-transparent">
                      <option value="">Unassigned</option>
                      {data.staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </Select>
                  </div>
                  <div className="flex gap-1.5 mt-2">
                    {nextStatus(t.status) && (
                      <Button size="sm" variant="soft" className="flex-1 !text-[11.5px]" onClick={() => setTask(t, { status: nextStatus(t.status) })}>
                        {nextStatus(t.status) === 'In Progress' ? 'Start' : nextStatus(t.status) === 'Cleaned' ? 'Mark cleaned' : <><Eye className="size-3" /> Approve & release</>}
                      </Button>
                    )}
                    {t.status !== 'Pending' && nextStatus(t.status) !== null && (
                      <Button size="sm" variant="ghost" className="!text-[11px] !px-2" onClick={() => setTask(t, { status: 'Pending' })}>Reset</Button>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-300 mt-2">
                    {t.started_at && `started ${fmtTime(t.started_at)}`} {t.completed_at && `· done ${fmtTime(t.completed_at)}`}
                  </p>
                </div>
              ))}
              {list.length === 0 && (
                <p className="text-[12px] text-slate-400 text-center py-6">Nothing here</p>
              )}
            </div>
          );
        })}
      </div>

      {/* maintenance requests */}
      <div className="grid lg:grid-cols-[1fr_320px] gap-4">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Wrench className="size-4.5 text-rose-500" />
              <h3 className="font-bold text-ink-900">Maintenance requests</h3>
            </div>
            <Button size="sm" variant="outline" onClick={() => setMntOpen(true)}>Open a request</Button>
          </div>
          {data.maintenance.length === 0 ? (
            <p className="text-[13px] text-slate-400 py-6 text-center">No open maintenance issues — engineering desk is clear.</p>
          ) : (
            <div className="space-y-2.5">
              {data.maintenance.map((m) => (
                <div key={m.id} className="flex items-start gap-3 rounded-xl border border-line px-3.5 py-3">
                  <div className="flex-1">
                    <p className="text-[13.5px] font-bold text-ink-900">Room {m.room_number} · {m.title}</p>
                    <p className="text-[12.5px] text-slate-400 mt-0.5">{m.detail}</p>
                    <p className="text-[10.5px] text-slate-400 mt-1">{m.reported_by} · {fmtDate(m.created_at)}</p>
                  </div>
                  {m.status === 'Open' ? (
                    <Button size="sm" variant="soft" onClick={async () => { await api.put(`/api/maintenance/${m.id}`, { status: 'In Progress' }); load(); }}>Mark in progress</Button>
                  ) : (
                    <Button size="sm" variant="gold" onClick={async () => {
                      try { await api.put(`/api/maintenance/${m.id}`, { status: 'Resolved' }); push(`Room ${m.room_number} request resolved — room released back to service`); load(); }
                      catch (e) { push((e as Error).message, 'error'); }
                    }}><Check className="size-3.5" /> Resolve</Button>
                  )}
                  {m.status !== 'Open' && <Badge tone="amber">{m.status}</Badge>}
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5 !bg-ink-900 border-0">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-gold-500 mb-3">How releases work</p>
          <ol className="space-y-3 text-[12.5px] text-slate-300 list-none">
            {[
              ['Pending', 'Task created (often automatically after check-out).'],
              ['In Progress', 'Assigned staff is cleaning — room shows "Cleaning".'],
              ['Cleaned', 'Staff marks the room clean and requests inspection.'],
              ['Inspected', 'Supervisor approves; room returns to Available (or Reserved if a stay starts within 7 days).'],
            ].map(([k, v], i) => (
              <li key={k} className="flex gap-3">
                <span className="ga-seal size-6 rounded-lg grid place-items-center text-white text-[10px] font-bold shrink-0">{i + 1}</span>
                <span><b className="text-gold-300">{k}</b> — {v}</span>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      {/* create task */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New housekeeping task" width="max-w-md"
        footer={<><Button onClick={() => setCreateOpen(false)}>Cancel</Button><Button variant="gold" loading={busy} onClick={async () => {
          if (!draft.room_id) { push('Pick a room', 'error'); return; }
          setBusy(true);
          try {
            await api.post('/api/housekeeping', draft);
            push('Task created'); setCreateOpen(false); load();
          } catch (e) { push((e as Error).message, 'error'); }
          setBusy(false);
        }}>Create task</Button></>}>
        <div className="space-y-4">
          <Select label="Room *" value={draft.room_id} onChange={(e) => setDraft({ ...draft, room_id: e.target.value })}>
            <option value="">Select room…</option>
            {allRooms.map((r) => <option key={r.id} value={r.id}>Room {r.number} · {r.category_name} · {r.status}</option>)}
          </Select>
          <Select label="Task type" value={draft.task_type} onChange={(e) => setDraft({ ...draft, task_type: e.target.value })}>
            {['Cleaning', 'Deep Cleaning', 'Maintenance', 'Inspection'].map((t) => <option key={t}>{t}</option>)}
          </Select>
          <div className="grid grid-cols-2 gap-4">
            <Select label="Assign to" value={draft.assigned_to} onChange={(e) => setDraft({ ...draft, assigned_to: e.target.value })}>
              <option value="">Unassigned</option>
              {data.staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
            <Select label="Priority" value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: e.target.value })}>
              {['Low', 'Normal', 'High'].map((t) => <option key={t}>{t}</option>)}
            </Select>
          </div>
          <Textarea label="Notes" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
        </div>
      </Modal>

      {/* maintenance request modal */}
      <Modal open={mntOpen} onClose={() => setMntOpen(false)} title="Report maintenance issue" subtitle="The room is flagged and engineering gets a task." width="max-w-md"
        footer={<><Button onClick={() => setMntOpen(false)}>Cancel</Button><Button variant="danger" loading={busy} onClick={async () => {
          if (!mnt.room_id || !mnt.title.trim()) { push('Pick a room and describe the issue', 'error'); return; }
          setBusy(true);
          try {
            await api.post('/api/maintenance', { room_id: mnt.room_id, title: mnt.title, detail: mnt.detail });
            push('Maintenance request opened'); setMntOpen(false); setMnt({ room_id: '', title: '', detail: '' }); load();
          } catch (e) { push((e as Error).message, 'error'); }
          setBusy(false);
        }}>Open request</Button></>}>
        <div className="space-y-4">
          <Select label="Room *" value={mnt.room_id} onChange={(e) => setMnt({ ...mnt, room_id: e.target.value })}>
            <option value="">Select room…</option>
            {allRooms.map((r) => <option key={r.id} value={r.id}>Room {r.number} · {r.category_name} · {r.status}</option>)}
          </Select>
          <Input label="Issue *" value={mnt.title} onChange={(e) => setMnt({ ...mnt, title: e.target.value })} placeholder="e.g. Air conditioning not cooling" />
          <Textarea label="Details" value={mnt.detail} onChange={(e) => setMnt({ ...mnt, detail: e.target.value })} />
        </div>
      </Modal>
    </div>
  );
}
