import express from 'express';
import { run, get, all } from '../db.js';
import { ApiError, isRoomBookable, freeRooms } from '../lib.js';
import { logActivity, nightsBetween } from '../db.js';

const router = express.Router();

const roomWithMeta = (r) => {
  const c = get('SELECT * FROM room_categories WHERE id=?', r.category_id);
  return {
    ...r,
    category_name: c?.name,
    base_rate: c?.base_rate,
    amenities: JSON.parse(r.amenities || '[]'),
  };
};

/* room list w/ filters */
router.get('/rooms', (req, res) => {
  const { status, category, q, floor } = req.query;
  let sql = `SELECT rm.*, c.name AS category_name, c.base_rate, rm.status FROM rooms rm JOIN room_categories c ON c.id=rm.category_id WHERE 1=1`;
  const p = [];
  if (status) { sql += ' AND rm.status=?'; p.push(status); }
  if (category) { sql += ' AND rm.category_id=?'; p.push(Number(category)); }
  if (floor) { sql += ' AND rm.floor=?'; p.push(Number(floor)); }
  if (q) { sql += ' AND (rm.number LIKE ? OR c.name LIKE ? OR rm.notes LIKE ?)'; p.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  const rooms = all(sql + ' ORDER BY CAST(rm.number AS INTEGER)', ...p);
  // current/next reservation info per room
  const withRes = rooms.map((r) => {
    const active = get(`
      SELECT r.id, r.confirmation_no, r.check_in, r.check_out, r.status, g.full_name guest_name
      FROM reservations r JOIN guests g ON g.id=r.guest_id
      WHERE r.room_id=? AND r.status IN ('Confirmed','Pending','Checked-in')
      ORDER BY r.check_in LIMIT 1`, r.id);
    return { ...r, reservation: active || null };
  });
  res.json({ rooms: withRes.map(roomWithMeta) });
});

router.get('/rooms/overview', (req, res) => {
  const byStatus = Object.fromEntries(all('SELECT status, COUNT(*) c FROM rooms GROUP BY status').map((r) => [r.status, r.c]));
  const floors = all('SELECT floor, COUNT(*) c, SUM(CASE WHEN status=\'Occupied\' THEN 1 ELSE 0 END) occ FROM rooms GROUP BY floor ORDER BY floor');
  res.json({ byStatus, floors });
});

/* availability for choosing room assignments */
router.get('/rooms/availability', (req, res) => {
  const { checkIn, checkOut, categoryId } = req.query;
  if (!checkIn || !checkOut) throw new ApiError(422, 'checkIn and checkOut are required.');
  if (checkOut <= checkIn) throw new ApiError(422, 'checkOut must be after checkIn.');
  const cats = categoryId ? [get('SELECT * FROM room_categories WHERE id=?', Number(categoryId))] : all('SELECT * FROM room_categories ORDER BY base_rate');
  const result = cats.filter(Boolean).map((c) => {
    const rooms = all('SELECT * FROM rooms WHERE category_id=? ORDER BY CAST(number AS INTEGER)', c.id)
      .map((r) => ({ ...roomWithMeta(r), bookable: isRoomBookable(r, checkIn, checkOut) }));
    return { category: c, total: rooms.length, available: rooms.filter((r) => r.bookable).length, rooms };
  });
  res.json({ checkIn, checkOut, nights: nightsBetween(checkIn, checkOut), categories: result });
});

/* CRUD */
router.post('/rooms', (req, res) => {
  const { number, category_id, floor, max_occupancy, rate, status, amenities, notes } = req.body || {};
  if (!number || !category_id) throw new ApiError(422, 'Room number and category are required.');
  const r = run(
    `INSERT INTO rooms (number,category_id,floor,max_occupancy,rate,status,amenities,notes) VALUES (?,?,?,?,?,?,?,?)`,
    String(number).trim(), Number(category_id), Number(floor) || 1, Number(max_occupancy) || 2,
    rate === '' || rate == null ? null : Number(rate), status || 'Available',
    JSON.stringify(amenities || []), notes || '');
  logActivity('room', `Room ${number} added to inventory.`, req.user.name);
  res.json({ room: roomWithMeta(get('SELECT * FROM rooms WHERE id=?', r.lastInsertRowid)) });
});

router.put('/rooms/:id', (req, res) => {
  const room = get('SELECT * FROM rooms WHERE id=?', Number(req.params.id));
  if (!room) throw new ApiError(404, 'Room not found.');
  const b = req.body || {};
  run(`UPDATE rooms SET number=?, category_id=?, floor=?, max_occupancy=?, rate=?, status=?, amenities=?, notes=? WHERE id=?`,
    (b.number ?? room.number).trim(), b.category_id ?? room.category_id, b.floor ?? room.floor,
    b.max_occupancy ?? room.max_occupancy,
    (b.rate === '' || b.rate == null) ? room.rate : Number(b.rate),
    b.status ?? room.status,
    b.amenities ? JSON.stringify(b.amenities) : room.amenities,
    b.notes ?? room.notes, room.id);
  if (b.status && b.status !== room.status) logActivity('room', `Room ${b.number ?? room.number} status set to ${b.status}.`, req.user.name);
  res.json({ room: roomWithMeta(get('SELECT * FROM rooms WHERE id=?', room.id)) });
});

router.delete('/rooms/:id', (req, res) => {
  const room = get('SELECT * FROM rooms WHERE id=?', Number(req.params.id));
  if (!room) throw new ApiError(404, 'Room not found.');
  const active = get(`SELECT COUNT(*) c FROM reservations WHERE room_id=? AND status IN ('Confirmed','Pending','Checked-in')`, room.id).c;
  if (active > 0) throw new ApiError(409, `Room ${room.number} has active reservations and cannot be deleted.`);
  run('DELETE FROM rooms WHERE id=?', room.id);
  logActivity('room', `Room ${room.number} removed from inventory.`, req.user.name);
  res.json({ ok: true });
});

/* categories */
router.get('/room-categories', (req, res) => {
  const cats = all(`
    SELECT c.*, (SELECT COUNT(*) FROM rooms rm WHERE rm.category_id=c.id) room_count,
           (SELECT COUNT(*) FROM rooms rm WHERE rm.category_id=c.id AND rm.status='Occupied') occupied_count
    FROM room_categories c ORDER BY c.base_rate DESC`).map((c) => ({ ...c, amenities: JSON.parse(c.amenities || '[]') }));
  res.json({ categories: cats });
});

router.post('/room-categories', (req, res) => {
  const b = req.body || {};
  if (!b.name) throw new ApiError(422, 'Category name is required.');
  const slug = String(b.slug || b.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `cat-${Date.now()}`;
  const r = run(`INSERT INTO room_categories (name,slug,description,base_rate,max_occupancy,size_sqm,bed,amenities) VALUES (?,?,?,?,?,?,?,?)`,
    b.name, slug, b.description || '', Number(b.base_rate) || 0, Number(b.max_occupancy) || 2,
    Number(b.size_sqm) || 30, b.bed || 'King bed', JSON.stringify(b.amenities || []));
  res.json({ category: get('SELECT * FROM room_categories WHERE id=?', r.lastInsertRowid) });
});

router.put('/room-categories/:id', (req, res) => {
  const cat = get('SELECT * FROM room_categories WHERE id=?', Number(req.params.id));
  if (!cat) throw new ApiError(404, 'Category not found.');
  const b = req.body || {};
  run(`UPDATE room_categories SET name=?, description=?, base_rate=?, max_occupancy=?, size_sqm=?, bed=?, amenities=? WHERE id=?`,
    b.name ?? cat.name, b.description ?? cat.description,
    b.base_rate != null ? Number(b.base_rate) : cat.base_rate,
    b.max_occupancy != null ? Number(b.max_occupancy) : cat.max_occupancy,
    b.size_sqm != null ? Number(b.size_sqm) : cat.size_sqm,
    b.bed ?? cat.bed, b.amenities ? JSON.stringify(b.amenities) : cat.amenities, cat.id);
  res.json({ category: get('SELECT * FROM room_categories WHERE id=?', cat.id) });
});

router.delete('/room-categories/:id', (req, res) => {
  const cat = get('SELECT * FROM room_categories WHERE id=?', Number(req.params.id));
  if (!cat) throw new ApiError(404, 'Category not found.');
  const rooms = get('SELECT COUNT(*) c FROM rooms WHERE category_id=?', cat.id).c;
  if (rooms > 0) throw new ApiError(409, `Cannot delete — ${rooms} room(s) still belong to this category.`);
  run('DELETE FROM room_categories WHERE id=?', cat.id);
  res.json({ ok: true });
});

export default router;
