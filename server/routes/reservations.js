import express from 'express';
import { run, get, all, today, addDays, nightsBetween } from '../db.js';
import { ApiError, createReservation, updateReservation, cancelReservation, reservationDetail, RES_STATUSES } from '../lib.js';

const router = express.Router();

const BASE_SELECT = `
  SELECT r.*, g.full_name AS guest_name, g.phone AS guest_phone, g.email AS guest_email, g.vip AS guest_vip,
         c.name AS category_name, rm.number AS room_number, rm.floor AS room_floor
  FROM reservations r
  LEFT JOIN guests g ON g.id=r.guest_id
  LEFT JOIN room_categories c ON c.id=r.category_id
  LEFT JOIN rooms rm ON rm.id=r.room_id`;

/* list + filters */
router.get('/reservations', (req, res) => {
  const { q, status, source, categoryId, date, dateFrom, dateTo, guestId, limit } = req.query;
  let sql = BASE_SELECT + ` WHERE 1=1`;
  const p = [];
  if (q) {
    sql += ` AND (r.confirmation_no LIKE ? OR g.full_name LIKE ? OR g.email LIKE ? OR g.phone LIKE ? OR rm.number LIKE ?)`;
    p.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (status) {
    const list = String(status).split(',');
    sql += ` AND r.status IN (${list.map(() => '?').join(',')})`;
    p.push(...list);
  }
  if (source) { sql += ' AND r.source=?'; p.push(source); }
  if (categoryId) { sql += ' AND r.category_id=?'; p.push(Number(categoryId)); }
  if (guestId) { sql += ' AND r.guest_id=?'; p.push(Number(guestId)); }
  if (date) { sql += ' AND (? >= r.check_in AND ? < r.check_out)'; p.push(date, date); }
  if (dateFrom) { sql += ' AND r.check_out >= ?'; p.push(dateFrom); }
  if (dateTo) { sql += ' AND r.check_in <= ?'; p.push(dateTo); }
  sql += ` ORDER BY r.check_in DESC, r.id DESC`;
  const withTotals = all(sql, ...p).map((r) => ({ ...r, nights: nightsBetween(r.check_in, r.check_out) }));
  res.json({ reservations: limit ? withTotals.slice(0, Number(limit)) : withTotals, today: today() });
});

router.get('/reservations/:id', (req, res) => {
  const detail = reservationDetail(Number(req.params.id));
  if (!detail) throw new ApiError(404, 'Reservation not found.');
  res.json({ reservation: detail });
});

/* walk-in / new reservation */
router.post('/reservations', (req, res) => {
  const input = req.body || {};
  input.source = input.source || 'Reception';
  const already = input.confirmation_no ? get('SELECT id FROM reservations WHERE confirmation_no=?', input.confirmation_no) : null;
  if (already) throw new ApiError(409, 'A reservation with this confirmation number already exists.');
  const id = createReservation(input, req.user.name);
  run('UPDATE reservations SET created_by=? WHERE id=?', req.user.name, id);
  res.status(201).json({ reservation: reservationDetail(id) });
});

router.put('/reservations/:id', (req, res) => {
  const updated = updateReservation(Number(req.params.id), req.body || {}, req.user.name);
  res.json({ reservation: reservationDetail(updated.id) });
});

router.post('/reservations/:id/cancel', (req, res) => {
  const r = cancelReservation(Number(req.params.id), req.body?.reason || '', req.user.name);
  res.json({ reservation: reservationDetail(r.id) });
});

router.post('/reservations/:id/no-show', (req, res) => {
  const res0 = get('SELECT * FROM reservations WHERE id=?', Number(req.params.id));
  if (!res0) throw new ApiError(404, 'Reservation not found.');
  if (!['Confirmed', 'Pending'].includes(res0.status)) throw new ApiError(409, 'Only upcoming reservations can be marked no-show.');
  run(`UPDATE reservations SET status='No-show', cancelled_at=datetime('now'), cancel_reason=? WHERE id=?`,
    req.body?.reason || 'Guest did not arrive.', res0.id);
  res.json({ reservation: reservationDetail(res0.id) });
});

/* month calendar: rooms x days grid data */
router.get('/reservations-calendar', (req, res) => {
  const base = req.query.month || today().slice(0, 7);
  const [y, m] = base.split('-').map(Number);
  const monthStart = `${y}-${String(m).padStart(2, '0')}-01`;
  const monthEnd = addDays(`${new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10)}`, -1); // last day of month
  const rows = all(`SELECT r.*, g.full_name AS guest_name, g.vip, c.name AS category_name, rm.number AS room_number
    FROM reservations r LEFT JOIN guests g ON g.id=r.guest_id
    LEFT JOIN room_categories c ON c.id=r.category_id LEFT JOIN rooms rm ON rm.id=r.room_id
    WHERE r.status IN ('Confirmed','Pending','Checked-in','Checked-out')
      AND r.check_in <= ? AND r.check_out >= ?
    ORDER BY CAST(rm.number AS INTEGER), r.check_in`, monthEnd, monthStart);

  const rooms = all(`SELECT rm.id, rm.number, rm.floor, rm.status, c.name AS category_name
    FROM rooms rm JOIN room_categories c ON c.id=rm.category_id ORDER BY CAST(rm.number AS INTEGER)`);
  const roomIds = rooms.map((r) => r.id);
  const byRoom = new Map();
  for (const r of rows) {
    if (r.room_id && roomIds.includes(r.room_id)) {
      if (!byRoom.has(r.room_id)) byRoom.set(r.room_id, []);
      byRoom.get(r.room_id).push(r);
    }
  }
  res.json({ month: base, rooms, reservations: rows, assignments: Object.fromEntries(byRoom), monthStart, monthEnd });
});

export default router;
