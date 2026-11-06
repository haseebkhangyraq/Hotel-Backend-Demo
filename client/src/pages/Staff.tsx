import { useEffect, useState } from 'react';
import { ShieldCheck, Plus, UserCog, Lock, Power, Mail } from 'lucide-react';
import { api } from '../lib/api';
import type { User, Role } from '../lib/types';
import { Badge, Button, Card, Input, Loading, Modal, Select, Td, Th, useToast } from '../ui';
import { fmtDate, cx, avatarTone, initials } from '../lib/format';

const ROLES: Role[] = ['Administrator', 'Manager', 'Receptionist', 'Housekeeping', 'Accountant'];

const MODULES = ['Dashboard', 'Reservations', 'Front desk', 'Rooms & suites', 'Housekeeping', 'Guests', 'Billing', 'Reports', 'Staff & users'];
const ROLE_MATRIX: Record<Role, string[]> = {
  Administrator: MODULES,
  Manager: MODULES,
  Receptionist: ['Dashboard', 'Reservations', 'Front desk', 'Rooms & suites', 'Guests', 'Billing'],
  Housekeeping: ['Rooms & suites', 'Housekeeping'],
  Accountant: ['Dashboard', 'Billing', 'Reservations', 'Reports'],
};

export default function Staff() {
  const { push } = useToast();
  const [users, setUsers] = useState<User[] | null>(null);
  const [editing, setEditing] = useState<Partial<User> & { password?: string } | null>(null);

  const load = () => api.get<{ users: User[] }>('/api/users').then((r) => setUsers(r.users)).catch((e) => push(e.message, 'error'));
  useEffect(() => { load(); }, []);

  if (!users) return <Loading />;

  return (
    <div className="p-4 sm:p-6 pb-24 lg:pb-8 max-w-[1400px] mx-auto space-y-5 anim-fade-up">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-gold-600">Administration</p>
          <h1 className="text-[26px] font-extrabold text-ink-900 tracking-tight font-display">Staff & Users</h1>
          <p className="text-[13px] text-slate-400 mt-0.5">{users.length} team accounts · role-based access enforced in navigation and the API.</p>
        </div>
        <Button variant="gold" onClick={() => setEditing({ role: 'Receptionist', active: 1, password: 'demo123' })}><Plus className="size-4" /> Add user</Button>
      </div>

      <div className="grid lg:grid-cols-[1fr_360px] gap-4 items-start">
        <Card className="overflow-x-auto">
          <table className="w-full text-[13px] min-w-[720px]">
            <thead><tr><Th>Team member</Th><Th>Role</Th><Th>Status</Th><Th>Since</Th><Th /></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-canvas/60">
                  <Td>
                    <div className="flex items-center gap-2.5">
                      <div className={cx('size-9 rounded-lg grid place-items-center text-[11px] font-bold', avatarTone(u.name))}>{initials(u.name)}</div>
                      <div>
                        <p className="font-bold text-ink-900">{u.name}</p>
                        <p className="text-[11px] text-slate-400 flex items-center gap-1"><Mail className="size-3" /> {u.email}</p>
                      </div>
                    </div>
                  </Td>
                  <Td><Badge tone={u.role === 'Administrator' ? 'gold' : u.role === 'Manager' ? 'violet' : u.role === 'Housekeeping' ? 'sky' : 'slate'}>{u.role}</Badge></Td>
                  <Td>{u.active ? <Badge tone="green">Active</Badge> : <Badge tone="red">Disabled</Badge>}</Td>
                  <Td>{fmtDate(u.created_at)}</Td>
                  <Td className="text-right">
                    <button onClick={() => setEditing({ ...u })} className="p-1.5 rounded-lg text-slate-400 hover:text-ink-900 hover:bg-slate-100"><UserCog className="size-4" /></button>
                    <button title="Disable" onClick={async () => {
                      if (!confirm(`Disable access for ${u.name}?`)) return;
                      try { await api.del(`/api/users/${u.id}`); push(`${u.name} disabled`, 'info'); load(); } catch (e) { push((e as Error).message, 'error'); }
                    }} className="p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50"><Power className="size-4" /></button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card className="p-5">
          <h3 className="font-bold text-ink-900 flex items-center gap-2 mb-3"><ShieldCheck className="size-4.5 text-gold-500" /> Role permissions</h3>
          <div className="space-y-3">
            {ROLES.map((r) => (
              <div key={r} className="rounded-xl border border-line p-3">
                <div className="flex items-center justify-between mb-2">
                  <Badge tone={r === 'Administrator' ? 'gold' : 'slate'}>{r}</Badge>
                  <span className="text-[10.5px] text-slate-400 font-bold">{ROLE_MATRIX[r].length} modules</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {MODULES.map((m) => (
                    <span key={m} className={cx('rounded-md px-2 py-0.5 text-[10.5px] font-bold border',
                      ROLE_MATRIX[r].includes(m) ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-300 border-slate-100')}>
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <UserModal user={editing} onClose={() => setEditing(null)} onSaved={load} />
    </div>
  );
}

function UserModal({ user, onClose, onSaved }: { user: (Partial<User> & { password?: string }) | null; onClose: () => void; onSaved: () => void }) {
  const { push } = useToast();
  const [f, setF] = useState<Partial<User> & { password?: string }>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => { setF(user || {}); }, [user]);
  if (!user) return null;
  const isNew = !user.id;

  const save = async () => {
    if (!f.name?.trim() || !f.email?.trim() || !f.role) return push('Name, email and role are required', 'error');
    setBusy(true);
    try {
      if (isNew) await api.post('/api/users', f);
      else await api.put(`/api/users/${user.id}`, f);
      push(isNew ? 'Team member added' : 'User updated');
      onSaved(); onClose();
    } catch (e) { push((e as Error).message, 'error'); }
    setBusy(false);
  };

  return (
    <Modal open onClose={onClose} width="max-w-lg" title={isNew ? 'Add team member' : `Edit ${user.name}`}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="gold" loading={busy} onClick={save}>Save user</Button></>}>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2"><Input label="Full name *" value={f.name || ''} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div className="sm:col-span-2"><Input label="Email *" type="email" value={f.email || ''} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
        <Select label="Role *" value={f.role || ''} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>
          {ROLES.map((r) => <option key={r}>{r}</option>)}
        </Select>
        <Input label="Phone" value={f.phone || ''} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        {isNew
          ? <div><Input label="Password (default demo123)" value={f.password || ''} onChange={(e) => setF({ ...f, password: e.target.value })} /><p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1"><Lock className="size-3" /> Stored as SHA-256 hash for the demo</p></div>
          : <div><Input label="Reset password (optional)" value={f.password || ''} onChange={(e) => setF({ ...f, password: e.target.value })} placeholder="Leave empty to keep" /></div>}
        {!isNew && (
          <div className="sm:col-span-2 flex items-center gap-2.5">
            <input type="checkbox" className="size-4 accent-gold-500" checked={!!f.active} onChange={(e) => setF({ ...f, active: e.target.checked ? 1 : 0 })} id="uactive" />
            <label htmlFor="uactive" className="text-[13px] font-semibold text-slate-600">Account active</label>
          </div>
        )}
      </div>
    </Modal>
  );
}
