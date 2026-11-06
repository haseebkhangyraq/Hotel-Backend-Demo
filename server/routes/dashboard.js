import express from 'express';
import { all, get, today, addDays } from '../db.js';
import { folio, reservationSummary } from '../lib.js';

const router = express.Router();

router.get('/dashboard', (req, res) => {
  const T = today();
  const TOM = addDays(T, 1);

  const roomCounts = {};
  for (const r of all('SELECT status, COUNT(*) c FROM rooms GROUP BY status')) roomCounts[r.status] = r.c;
  const totalRooms = get('SELECT COUNT(*) c FROM rooms').c;
  const occupied = roomCounts['Occupied'] || 0;

  const counts = (status) => get('SELECT COUNT(*) c FROM reservations WHERE status=?', status).c;

  const arrivals = all(`
    SELECT r.*, g.full_name AS guest_name, g.vip, c.name AS category_name, rm.number AS room_number, rm.floor
    FROM reservations r LEFT JOIN guests g ON g.id=r.guest_id
    LEFT JOIN room_categories c ON c.id=r.category_id LEFT JOIN rooms rm ON rm.id=r.room_id
    WHERE r.check_in=? AND r.status IN ('Confirmed','Pending') ORDER BY g.vip DESC, rm.number`, T);

  const departures = all(`
    SELECT r.*, g.full_name AS guest_name, g.vip, c.name AS category_name, rm.number AS room_number, rm.floor
    FROM reservations r LEFT JOIN guests g ON g.id=r.guest_id
    LEFT JOIN room_categories c ON c.id=r.category_id LEFT JOIN rooms rm ON rm.id=r.room_id
    WHERE r.check_out=? AND r.status='Checked-in' ORDER BY rm.number`, T);

  const inHouse = all(`
    SELECT r.*, g.full_name AS guest_name, g.vip, c.name AS category_name, rm.number AS room_number
    FROM reservations r LEFT JOIN guests g ON g.id=r.guest_id
    LEFT JOIN room_categories c ON c.id=r.category_id LEFT JOIN rooms rm ON rm.id=r.room_id
    WHERE r.status='Checked-in' ORDER BY r.check_out, rm.number`);

  const recentReservations = all(`
    SELECT r.id, r.confirmation_no, r.check_in, r.check_out, r.status, r.source, r.adults, r.children,
           r.rate_per_night, g.full_name AS guest_name, g.vip, c.name AS category_name, rm.number AS room_number,
           r.created_at
    FROM reservations r LEFT JOIN guests g ON g.id=r.guest_id
    LEFT JOIN room_categories c ON c.id=r.category_id LEFT JOIN rooms rm ON rm.id=r.room_id
    ORDER BY r.created_at DESC LIMIT 8`);

  // Today's revenue: payments recorded today
  const todayRevenue = get(`SELECT COALESCE(SUM(amount),0) s FROM payments WHERE date(paid_at)=?`, T).s;

  // 14-day occupancy & revenue trend
  const from = addDays(T, -13);
  const revenueSeries = all(
    `SELECT date(paid_at) d, SUM(amount) v FROM payments WHERE date(paid_at) >= ? GROUP BY date(paid_at)`, from);
  const occSeries = [];
  for (let d = from; d <= T; d = addDays(d, 1)) {
    const sold = get(
      `SELECT COUNT(*) c FROM reservations WHERE status IN ('Checked-in','Checked-out') AND check_in <= ? AND check_out > ?`, d, d).c;
    const rev = revenueSeries.find((r) => r.d === d)?.v || 0;
    occSeries.push({ date: d.slice(5), occupancy: totalRooms ? Math.round((sold / totalRooms) * 100) : 0, revenue: rev });
  }

  const categoryMix = all(`
    SELECT c.name, COUNT(rm.id) c FROM room_categories c
    LEFT JOIN rooms rm ON rm.category_id = c.id AND rm.status='Occupied'
    GROUP BY c.id ORDER BY c.base_rate DESC`);

  const dirty = (roomCounts['Dirty'] || 0) + (roomCounts['Cleaning'] || 0);
  const housekeepingOpen = get(`SELECT COUNT(*) c FROM housekeeping_tasks WHERE status IN ('Pending','In Progress')`).c;
  const pendingFolios = all(`
    SELECT r.id, r.confirmation_no, g.full_name guest_name, rm.number room_number
    FROM reservations r JOIN guests g ON g.id=r.guest_id LEFT JOIN rooms rm ON rm.id=r.room_id
    WHERE r.status='Checked-in'
  `).map((r) => ({ ...r, balance: folio(get('SELECT * FROM reservations WHERE id=?', r.id)).balance }))
    .filter((r) => r.balance > 0).sort((a, b) => b.balance - a.balance);

  res.json({
    today: T,
    rooms: {
      total: totalRooms,
      available: roomCounts['Available'] || 0,
      occupied,
      reserved: roomCounts['Reserved'] || 0,
      dirty: roomCounts['Dirty'] || 0,
      cleaning: roomCounts['Cleaning'] || 0,
      maintenance: roomCounts['Maintenance'] || 0,
      occupancyRate: totalRooms ? Math.round((occupied / totalRooms) * 100) : 0,
    },
    reservations: {
      total: get('SELECT COUNT(*) c FROM reservations').c,
      checkedIn: counts('Checked-in'),
      checkedOut: counts('Checked-out'),
      confirmed: counts('Confirmed'),
      pending: counts('Pending'),
      cancelled: counts('Cancelled'),
      noShow: counts('No-show'),
    },
    arrivalsToday: arrivals.map((r) => reservationSummary(r.id)),
    departuresToday: departures.map((r) => reservationSummary(r.id)),
    inHouse,
    recentReservations,
    revenueToday: todayRevenue,
    occSeries,
    categoryMix,
    housekeepingOpen,
    pendingFolios,
  });
});

export default router;
