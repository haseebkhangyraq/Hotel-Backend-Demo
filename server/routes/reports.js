import express from 'express';
import { all, get, today, addDays, nightsBetween } from '../db.js';

const router = express.Router();

/* occupancy per day */
router.get('/reports/occupancy', (req, res) => {
  const from = req.query.from || addDays(today(), -14);
  const to = req.query.to || today();
  const totalRooms = get('SELECT COUNT(*) c FROM rooms').c;
  const rows = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const sold = get(
      `SELECT COUNT(*) c FROM reservations WHERE status IN ('Checked-in','Checked-out','Confirmed') AND check_in <= ? AND check_out > ?`, d, d).c;
    const rev = get(`SELECT COALESCE(SUM(amount),0) v FROM payments WHERE date(paid_at)=?`, d).v;
    const adr = sold ? Math.round(rev / sold) : 0;
    rows.push({ date: d, roomsSold: sold, totalRooms, occupancy: totalRooms ? +(sold / totalRooms * 100).toFixed(1) : 0, revenue: rev, adr });
  }
  const avg = rows.length ? rows.reduce((s, r) => s + r.occupancy, 0) / rows.length : 0;
  res.json({ rows, summary: { avgOccupancy: +avg.toFixed(1), totalRevenue: rows.reduce((s, r) => s + r.revenue, 0), totalNights: rows.reduce((s, r) => s + r.roomsSold, 0) } });
});

/* revenue per day with payment method split */
router.get('/reports/revenue', (req, res) => {
  const from = req.query.from || addDays(today(), -29);
  const to = req.query.to || today();
  const byDay = all(`SELECT date(paid_at) d, SUM(amount) v, COUNT(*) c FROM payments WHERE date(paid_at) BETWEEN ? AND ? GROUP BY date(paid_at) ORDER BY d`, from, to);
  const byMethod = all(`SELECT method, SUM(amount) v, COUNT(*) c FROM payments WHERE date(paid_at) BETWEEN ? AND ? GROUP BY method`, from, to);
  const byPurpose = all(`SELECT purpose, SUM(amount) v FROM payments WHERE date(paid_at) BETWEEN ? AND ? GROUP BY purpose`, from, to);
  // revenue split by folio category for the period (approximation by posted date)
  const byService = all(`
    SELECT COALESCE(NULLIF(f.type,''),'other') t, COALESCE(SUM(f.amount),0) v FROM folio_items f
    WHERE date(f.posted_at) BETWEEN ? AND ? GROUP BY t`, from, to);
  const total = byDay.reduce((s, r) => s + r.v, 0);
  res.json({
    byDay: byDay.map((d) => ({ ...d, date: d.d, amount: d.v, payments: d.c })),
    byMethod, byPurpose, byService, total, count: byDay.reduce((s, r) => s + r.c, 0),
  });
});

/* arrivals / departures lists */
router.get('/reports/arrivals', (req, res) => {
  const date = req.query.date || today();
  const rows = all(`
    SELECT r.confirmation_no, g.full_name guest, g.nationality, c.name category, rm.number room,
           r.check_in, r.check_out, r.adults, r.children, r.status, r.source, r.created_at
    FROM reservations r JOIN guests g ON g.id=r.guest_id
    LEFT JOIN room_categories c ON c.id=r.category_id LEFT JOIN rooms rm ON rm.id=r.room_id
    WHERE r.check_in=? AND r.status IN ('Confirmed','Pending','Checked-in','No-show') ORDER BY rm.number`, date);
  res.json({ date, rows });
});
router.get('/reports/departures', (req, res) => {
  const date = req.query.date || today();
  const rows = all(`
    SELECT r.confirmation_no, g.full_name guest, c.name category, rm.number room,
           r.check_in, r.check_out, r.status, r.invoice_no,
           (SELECT COALESCE(SUM(amount),0) FROM payments p WHERE p.reservation_id=r.id) paid,
           r.checked_out_at
    FROM reservations r JOIN guests g ON g.id=r.guest_id
    LEFT JOIN room_categories c ON c.id=r.category_id LEFT JOIN rooms rm ON rm.id=r.room_id
    WHERE r.check_out=? AND r.status IN ('Checked-in','Checked-out') ORDER BY rm.number`, date);
  res.json({ date, rows });
});

/* reservation source + status breakdown */
router.get('/reports/reservations', (req, res) => {
  const from = req.query.from || addDays(today(), -30);
  const to = req.query.to || today();
  void from; void to;
  const byStatus = all(`SELECT status, COUNT(*) c, SUM(rate_per_night*(julianday(check_out)-julianday(check_in))) value
    FROM reservations GROUP BY status`);
  const bySource = all(`SELECT source, COUNT(*) c FROM reservations GROUP BY source`);
  const byCategory = all(`
    SELECT c.name, COUNT(r.id) c,
           SUM(r.rate_per_night*(julianday(r.check_out)-julianday(r.check_in))) nights_value
    FROM room_categories c LEFT JOIN reservations r ON r.category_id=c.id
    GROUP BY c.id ORDER BY c.base_rate DESC`);
  const list = all(`
    SELECT r.confirmation_no, g.full_name guest, c.name category, rm.number room, r.check_in, r.check_out, r.status, r.source, r.created_at,
           r.rate_per_night*(julianday(r.check_out)-julianday(r.check_in)) stay_value
    FROM reservations r JOIN guests g ON g.id=r.guest_id
    LEFT JOIN room_categories c ON c.id=r.category_id LEFT JOIN rooms rm ON rm.id=r.room_id
    ORDER BY r.created_at DESC`);
  res.json({ byStatus, bySource, list });
});

/* room status snapshot */
router.get('/reports/rooms', (req, res) => {
  const rows = all(`
    SELECT rm.number, rm.floor, c.name category, rm.status, rm.max_occupancy, rm.rate,
           (SELECT g.full_name FROM reservations r JOIN guests g ON g.id=r.guest_id
             WHERE r.room_id=rm.id AND r.status='Checked-in' LIMIT 1) in_house_guest
    FROM rooms rm JOIN room_categories c ON c.id=rm.category_id ORDER BY CAST(rm.number AS INTEGER)`);
  const byStatus = Object.fromEntries(all('SELECT status, COUNT(*) c FROM rooms GROUP BY status').map((r) => [r.status, r.c]));
  res.json({ rows, byStatus });
});

/* guest history */
router.get('/reports/guests', (req, res) => {
  const from = req.query.from || '';
  const rows = all(`
    SELECT g.full_name guest, g.nationality, g.phone, g.email, g.vip,
      SUM(CASE WHEN r.status='Checked-out' THEN 1 ELSE 0 END) stays,
      COUNT(r.id) reservations,
      SUM(CASE WHEN r.status='Checked-out' THEN (julianday(r.check_out)-julianday(r.check_in)) ELSE 0 END) nights,
      (SELECT COALESCE(SUM(p.amount),0) FROM payments p JOIN reservations r2 ON r2.id=p.reservation_id WHERE r2.guest_id=g.id) spend
    FROM guests g LEFT JOIN reservations r ON r.guest_id=g.id ${from ? "WHERE r.check_out >= date('now','-365 day') OR r.id IS NULL" : ''}
    GROUP BY g.id ORDER BY stays DESC, spend DESC`);
  res.json({ rows });
});

/* payments ledger */
router.get('/reports/payments', (req, res) => {
  const from = req.query.from || addDays(today(), -30);
  const to = req.query.to || today();
  const rows = all(`
    SELECT p.id, date(p.paid_at) date, rm.number room, r.confirmation_no, g.full_name guest,
           p.amount, p.method, p.purpose, p.received_by
    FROM payments p LEFT JOIN reservations r ON r.id=p.reservation_id
    LEFT JOIN guests g ON g.id=r.guest_id LEFT JOIN rooms rm ON rm.id=r.room_id
    WHERE date(p.paid_at) BETWEEN ? AND ? ORDER BY p.paid_at DESC`, from, to);
  res.json({ rows, total: rows.reduce((s, r) => s + r.amount, 0) });
});

/* cancellations */
router.get('/reports/cancellations', (req, res) => {
  const rows = all(`
    SELECT r.confirmation_no, g.full_name guest, c.name category, r.check_in, r.check_out, r.status, r.source,
           r.created_at, r.cancelled_at, r.cancel_reason
    FROM reservations r JOIN guests g ON g.id=r.guest_id
    LEFT JOIN room_categories c ON c.id=r.category_id
    WHERE r.status IN ('Cancelled','No-show') ORDER BY r.cancelled_at DESC`);
  res.json({ rows });
});

export default router;
