import express from 'express';
import { run, get, all, nightsBetween } from '../db.js';
import { ApiError } from '../lib.js';

const router = express.Router();

router.get('/guests', (req, res) => {
  const { q, vip } = req.query;
  let sql = `
    SELECT g.*,
      (SELECT COUNT(*) FROM reservations r WHERE r.guest_id=g.id AND r.status IN ('Checked-in','Checked-out','Confirmed','Pending')) total_reservations,
      (SELECT COUNT(*) FROM reservations r WHERE r.guest_id=g.id AND r.status='Checked-out') completed_stays,
      (SELECT COALESCE(SUM(r.rate_per_night * (julianday(r.check_out)-julianday(r.check_in))),0)
         FROM reservations r WHERE r.guest_id=g.id AND r.status IN ('Checked-out','Checked-in')) lifetime_value,
      (SELECT MAX(r.check_out) FROM reservations r WHERE r.guest_id=g.id) last_stay
    FROM guests g WHERE 1=1`;
  const p = [];
  if (q) {
    sql += ` AND (g.full_name LIKE ? OR g.email LIKE ? OR g.phone LIKE ? OR g.id_number LIKE ?)`;
    p.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (vip === '1') sql += ' AND g.vip=1';
  sql += ' ORDER BY lifetime_value DESC, g.full_name';
  res.json({ guests: all(sql, ...p) });
});

router.get('/guests/:id', (req, res) => {
  const g = get('SELECT * FROM guests WHERE id=?', Number(req.params.id));
  if (!g) throw new ApiError(404, 'Guest not found.');
  const history = all(`
    SELECT r.*, c.name AS category_name, rm.number AS room_number
    FROM reservations r LEFT JOIN room_categories c ON c.id=r.category_id LEFT JOIN rooms rm ON rm.id=r.room_id
    WHERE r.guest_id=? ORDER BY r.check_in DESC`, g.id);
  const enriched = history.map((r) => ({ ...r, nights: nightsBetween(r.check_in, r.check_out) }));
  const stays = enriched.filter((r) => r.status === 'Checked-out').length;
  const spend = all('SELECT COALESCE(SUM(amount),0) s FROM payments WHERE reservation_id IN (SELECT id FROM reservations WHERE guest_id=?)', g.id)[0].s;
  res.json({ guest: { ...g }, history: enriched, stats: { stays, spend, reservations: enriched.length } });
});

router.post('/guests', (req, res) => {
  const b = req.body || {};
  if (!b.full_name) throw new ApiError(422, 'Guest name is required.', { full_name: 'Guest name is required.' });
  const r = run(`INSERT INTO guests (full_name,phone,email,nationality,id_type,id_number,vip,preferences,notes) VALUES (?,?,?,?,?,?,?,?,?)`,
    b.full_name.trim(), b.phone || '', b.email || '', b.nationality || '', b.id_type || '', b.id_number || '',
    b.vip ? 1 : 0, b.preferences || '', b.notes || '');
  res.status(201).json({ guest: get('SELECT * FROM guests WHERE id=?', r.lastInsertRowid) });
});

router.put('/guests/:id', (req, res) => {
  const g = get('SELECT * FROM guests WHERE id=?', Number(req.params.id));
  if (!g) throw new ApiError(404, 'Guest not found.');
  const b = req.body || {};
  run(`UPDATE guests SET full_name=?, phone=?, email=?, nationality=?, id_type=?, id_number=?, vip=?, preferences=?, notes=? WHERE id=?`,
    b.full_name ?? g.full_name, b.phone ?? g.phone, b.email ?? g.email, b.nationality ?? g.nationality,
    b.id_type ?? g.id_type, b.id_number ?? g.id_number, (b.vip ?? g.vip) ? 1 : 0,
    b.preferences ?? g.preferences, b.notes ?? g.notes, g.id);
  res.json({ guest: get('SELECT * FROM guests WHERE id=?', g.id) });
});

router.delete('/guests/:id', (req, res) => {
  const g = get('SELECT * FROM guests WHERE id=?', Number(req.params.id));
  if (!g) throw new ApiError(404, 'Guest not found.');
  const active = get(`SELECT COUNT(*) c FROM reservations WHERE guest_id=? AND status IN ('Confirmed','Pending','Checked-in')`, g.id).c;
  if (active > 0) throw new ApiError(409, 'Guest has active reservations and cannot be deleted.');
  run('DELETE FROM guests WHERE id=?', g.id);
  res.json({ ok: true });
});

export default router;
