import express from 'express';
import { run, get, all, today, addDays, logActivity, notify } from '../db.js';
import { ApiError, refreshRoomStatus } from '../lib.js';

const router = express.Router();

router.get('/housekeeping', (req, res) => {
  const { status, staffId } = req.query;
  let sql = `
    SELECT t.*, rm.number AS room_number, rm.floor, rm.status AS room_status, c.name AS category_name, u.name AS staff_name
    FROM housekeeping_tasks t
    JOIN rooms rm ON rm.id=t.room_id
    JOIN room_categories c ON c.id=rm.category_id
    LEFT JOIN users u ON u.id=t.assigned_to
    WHERE 1=1`;
  const p = [];
  if (status) { sql += ' AND t.status=?'; p.push(status); }
  if (staffId) { sql += ' AND t.assigned_to=?'; p.push(Number(staffId)); }
  sql += ` ORDER BY CASE t.status WHEN 'Pending' THEN 0 WHEN 'In Progress' THEN 1 WHEN 'Cleaned' THEN 2 ELSE 3 END,
           CASE t.priority WHEN 'High' THEN 0 WHEN 'Normal' THEN 1 ELSE 2 END, t.created_at DESC`;
  const tasks = all(sql, ...p);

  const staff = all(`SELECT id, name, role FROM users WHERE role='Housekeeping' AND active=1 ORDER BY name`);
  const counts = Object.fromEntries(all(`SELECT status, COUNT(*) c FROM housekeeping_tasks GROUP BY status`).map((r) => [r.status, r.c]));
  const maintenance = all(`
    SELECT m.*, rm.number AS room_number FROM maintenance_requests m JOIN rooms rm ON rm.id=m.room_id
    WHERE m.status != 'Resolved' ORDER BY m.created_at DESC`);
  const dirtyRooms = all(`
    SELECT rm.*, c.name category_name FROM rooms rm JOIN room_categories c ON c.id=rm.category_id
    WHERE rm.status IN ('Dirty','Cleaning','Maintenance') ORDER BY rm.number`);
  res.json({ tasks, staff, counts, maintenance, dirtyRooms, today: today() });
});

router.post('/housekeeping', (req, res) => {
  const { room_id, task_type, assigned_to, priority, notes } = req.body || {};
  const room = get('SELECT * FROM rooms WHERE id=?', Number(room_id));
  if (!room) throw new ApiError(422, 'Room is required.');
  const r = run(`INSERT INTO housekeeping_tasks (room_id,task_type,status,assigned_to,priority,notes) VALUES (?,?,?,?,?,?)`,
    room.id, task_type || 'Cleaning', 'Pending', assigned_to ? Number(assigned_to) : null, priority || 'Normal', notes || '');
  logActivity('housekeeping', `${task_type || 'Cleaning'} task created for room ${room.number}.`, req.user.name);
  res.json({ task: get('SELECT * FROM housekeeping_tasks WHERE id=?', r.lastInsertRowid) });
});

router.put('/housekeeping/:id', (req, res) => {
  const t = get('SELECT * FROM housekeeping_tasks WHERE id=?', Number(req.params.id));
  if (!t) throw new ApiError(404, 'Task not found.');
  const b = req.body || {};
  const nextStatus = b.status || t.status;
  const assignedTo = b.assigned_to !== undefined ? (b.assigned_to ? Number(b.assigned_to) : null) : t.assigned_to;

  run(`UPDATE housekeeping_tasks SET status=?, assigned_to=?, notes=?, priority=?,
         started_at=COALESCE(started_at, CASE WHEN ?='In Progress' THEN datetime('now') END),
         completed_at=CASE WHEN ? IN ('Cleaned','Inspected') THEN COALESCE(completed_at, datetime('now')) ELSE completed_at END
       WHERE id=?`,
    nextStatus, assignedTo, b.notes ?? t.notes, b.priority ?? t.priority, nextStatus, nextStatus, t.id);

  // release room to Available on inspection, if no conflicting active reservation
  if (nextStatus === 'Inspected' && t.status !== 'Inspected') {
    const room = get('SELECT * FROM rooms WHERE id=?', t.room_id);
    const reserved = get(`SELECT COUNT(*) c FROM reservations WHERE room_id=? AND status IN ('Confirmed','Pending') AND check_in <= date('now','+7 day')`, t.room_id).c;
    if (!reserved) {
      run(`UPDATE rooms SET status='Available' WHERE id=?`, t.room_id);
    } else {
      run(`UPDATE rooms SET status='Reserved' WHERE id=?`, t.room_id);
    }
    logActivity('housekeeping', `Room ${room.number} inspected and released to ${reserved ? 'Reserved' : 'Available'}.`, req.user.name);
  } else if (['Cleaning', 'Maintenance'].includes(nextStatus) && t.status === 'Pending') {
    const room = get('SELECT * FROM rooms WHERE id=?', t.room_id);
    if (room && !['Occupied', 'Reserved'].includes(room.status)) run(`UPDATE rooms SET status='Cleaning' WHERE id=?`, t.room_id);
  }
  res.json({ task: get('SELECT * FROM housekeeping_tasks WHERE id=?', t.id) });
});

router.delete('/housekeeping/:id', (req, res) => {
  const t = get('SELECT * FROM housekeeping_tasks WHERE id=?', Number(req.params.id));
  if (!t) throw new ApiError(404, 'Task not found.');
  run('DELETE FROM housekeeping_tasks WHERE id=?', t.id);
  res.json({ ok: true });
});

/* maintenance requests */
router.post('/maintenance', (req, res) => {
  const { room_id, title, detail } = req.body || {};
  const room = get('SELECT * FROM rooms WHERE id=?', Number(room_id));
  if (!room || !title) throw new ApiError(422, 'Room and title are required.');
  run(`INSERT INTO maintenance_requests (room_id,title,detail,status,reported_by) VALUES (?,?,?,?,?)`,
    room.id, title, detail || '', 'Open', req.user.name);
  run(`INSERT INTO housekeeping_tasks (room_id,task_type,status,priority,notes) VALUES (?,?,?,?,?)`,
    room.id, 'Maintenance', 'Pending', 'High', title);
  if (room.status !== 'Occupied') run(`UPDATE rooms SET status='Maintenance' WHERE id=?`, room.id);
  logActivity('room', `Maintenance request — room ${room.number}: ${title}`, req.user.name);
  notify('maintenance', `Maintenance — room ${room.number}`, title, '#/housekeeping');
  res.json({ ok: true });
});

router.put('/maintenance/:id', (req, res) => {
  const m = get('SELECT * FROM maintenance_requests WHERE id=?', Number(req.params.id));
  if (!m) throw new ApiError(404, 'Request not found.');
  const status = req.body?.status || m.status;
  run(`UPDATE maintenance_requests SET status=?, resolved_at=CASE WHEN resolved_at IS NULL AND ?='Resolved' THEN datetime('now') ELSE resolved_at END WHERE id=?`,
    status, status, m.id);
  if (status === 'Resolved') {
    // release room back to Available if no open tasks remain
    const open = get(`SELECT COUNT(*) c FROM housekeeping_tasks WHERE room_id=? AND status IN ('Pending','In Progress')`, m.room_id).c;
    if (open === 0) refreshRoomStatus(m.room_id);
  }
  res.json({ ok: true });
});

/* ------------- activity feed & notifications ------------- */
router.get('/activity', (req, res) => {
  const limit = Number(req.query.limit) || 12;
  res.json({ activity: all(`SELECT * FROM activity_log ORDER BY id DESC LIMIT ?`, limit) });
});

router.get('/notifications', (req, res) => {
  const stored = all(`SELECT * FROM notifications ORDER BY created_at DESC, id DESC LIMIT 30`);
  // live computed notices
  const T = today();
  const soon = all(`
    SELECT r.confirmation_no, g.full_name, rm.number room_number, r.check_out
    FROM reservations r JOIN guests g ON g.id=r.guest_id LEFT JOIN rooms rm ON rm.id=r.room_id
    WHERE r.status='Checked-in' AND r.check_out BETWEEN ? AND ?`, T, addDays(T, 1));
  const vipInHouse = all(`
    SELECT r.confirmation_no, g.full_name, rm.number room_number
    FROM reservations r JOIN guests g ON g.id=r.guest_id LEFT JOIN rooms rm ON rm.id=r.room_id
    WHERE r.status='Checked-in' AND g.vip=1`);
  res.json({ notifications: stored, upcomingDepartures: soon, vipInHouse });
});

router.post('/notifications/:id/read', (req, res) => {
  run('UPDATE notifications SET read=1 WHERE id=?', Number(req.params.id));
  res.json({ ok: true });
});
router.post('/notifications/read-all', (req, res) => {
  run('UPDATE notifications SET read=1');
  res.json({ ok: true });
});

export default router;
