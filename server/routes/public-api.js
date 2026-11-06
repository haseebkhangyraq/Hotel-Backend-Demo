import express from 'express';
import { run, get, all, nightsBetween } from '../db.js';
import { ApiError, genConfirmation, isRoomBookable, reservationDetail } from '../lib.js';
import { logActivity, notify } from '../db.js';

const router = express.Router();

/* ---- Website API key check ---- */
const API_KEY = process.env.WEBSITE_API_KEY || 'ga_pk_web_demo_2026';
router.use((req, res, next) => {
  const key = req.headers['x-api-key'] || req.query.key;
  if (key !== API_KEY) return res.status(401).json({ error: 'Invalid or missing API key.' });
  next();
});

/* ---- categories & rates ---- */
router.get('/room-categories', (req, res) => {
  const cats = all(`SELECT c.*
      FROM room_categories c ORDER BY c.base_rate`).map((c) => ({
    ...c,
    amenities: JSON.parse(c.amenities || '[]'),
  }));
  res.json({ categories: cats });
});

/* ---- availability grid ---- */
router.get('/availability', (req, res) => {
  const { checkIn, checkOut, adults, children } = req.query;
  if (!checkIn || !checkOut) throw new ApiError(422, 'checkIn and checkOut are required.');
  if (checkOut <= checkIn) throw new ApiError(422, 'checkOut must be after checkIn.');
  const need = (Number(adults) || 0) + (Number(children) || 0);
  const cats = all('SELECT * FROM room_categories ORDER BY base_rate');
  const grid = cats.map((c) => {
    const rooms = all('SELECT * FROM rooms WHERE category_id=?', c.id);
    const free = rooms.filter((r) => isRoomBookable(r, checkIn, checkOut));
    const fits = need > 0 ? c.max_occupancy >= need : true;
    return {
      category: { id: c.id, name: c.name, slug: c.slug },
      slug: c.slug,
      name: c.name,
      rate: c.base_rate,
      maxOccupancy: c.max_occupancy,
      available: fits ? free.length : 0,
    };
  });
  res.json({ checkIn, checkOut, nights: nightsBetween(checkIn, checkOut), categories: grid });
});

/* ---- create a booking from the website ---- */
router.post('/reservations', (req, res) => {
  const b = req.body || {};
  if (!b.checkIn || !b.checkOut) throw new ApiError(422, 'checkIn and checkOut are required.');
  if (b.checkOut <= b.checkIn) throw new ApiError(422, 'checkOut must be after checkIn.');
  const cat = b.categoryId
    ? get('SELECT * FROM room_categories WHERE id=?', Number(b.categoryId))
    : get('SELECT * FROM room_categories WHERE slug=?', String(b.categorySlug || ''));
  if (!cat) throw new ApiError(422, 'Room category not found.');

  const guests = (Number(b.adults) || 2) + (Number(b.children) || 0);
  if (guests > cat.max_occupancy) {
    throw new ApiError(422, `${cat.name} accommodates up to ${cat.max_occupancy} guests.`);
  }

  // guest: find by email, else create
  let guest = b.guest?.email ? get('SELECT * FROM guests WHERE lower(email)=lower(?)', String(b.guest.email)) : null;
  if (!guest) {
    if (!b.guest?.fullName) throw new ApiError(422, 'Guest full name is required.');
    const g = run(`INSERT INTO guests (full_name,phone,email,nationality,id_type,id_number) VALUES (?,?,?,?,?,?)`,
      b.guest.fullName, b.guest?.phone || '', b.guest?.email || '', b.guest?.nationality || '', 'Passport', '');
    guest = get('SELECT * FROM guests WHERE id=?', g.lastInsertRowid);
  }

  // auto-assign a free room of the category
  const free = all('SELECT * FROM rooms WHERE category_id=? ORDER BY CAST(number AS INTEGER)', cat.id)
    .filter((r) => isRoomBookable(r, b.checkIn, b.checkOut));
  if (!free.length) throw new ApiError(409, `${cat.name} is fully booked for the selected dates.`, { code: 'SOLD_OUT' });
  const room = free[0];

  const rate = Number(b.rate) > 0 ? Number(b.rate) : cat.base_rate;
  const cn = genConfirmation();
  const rr = run(`
    INSERT INTO reservations (confirmation_no,guest_id,category_id,room_id,check_in,check_out,adults,children,status,source,rate_per_night,tax_rate,advance_payment,special_requests,breakfast_plan,created_by,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))`,
    cn, guest.id, cat.id, room.id, b.checkIn, b.checkOut, Number(b.adults) || 2, Number(b.children) || 0,
    Number(b.advancePayment) > 0 ? 'Confirmed' : 'Confirmed', 'Website', rate, 0.17,
    Number(b.advancePayment) || 0, b.specialRequests || '', b.breakfastPlan || 'none', 'Website');

  if (Number(b.advancePayment) > 0) {
    run(`INSERT INTO payments (reservation_id,amount,method,purpose,received_by,note) VALUES (?,?,?,?,?,?)`,
      rr.lastInsertRowid, Number(b.advancePayment), b.paymentMethod || 'Online Payment', 'Advance', 'Website',
      'Prepaid on website at booking time');
  }
  run(`UPDATE rooms SET status='Reserved' WHERE id=? AND status='Available'`, room.id);
  logActivity('reservation', `Website booking ${cn} received — ${cat.name}, room ${room.number} (${b.checkIn} → ${b.checkOut}).`, 'Website', rr.lastInsertRowid);
  notify('reservation', 'New website reservation', `${cn} · ${cat.name} · ${guest.full_name} · ${b.checkIn} → ${b.checkOut}`, '#/reservations');

  const d = reservationDetail(rr.lastInsertRowid);
  res.status(201).json({
    confirmationNo: d.confirmation_no,
    reservation: {
      confirmationNo: d.confirmation_no,
      status: d.status,
      guest: { name: guest.full_name, email: guest.email, phone: guest.phone },
      category: d.category_name,
      room: d.room_number,
      checkIn: d.check_in,
      checkOut: d.check_out,
      adults: d.adults,
      children: d.children,
      nights: d.folio.nights,
      ratePerNight: d.rate_per_night,
      roomTotal: d.folio.roomTotal,
      taxRate: d.folio.taxRate,
      totalDue: d.folio.total,
      advancePaid: d.folio.paid,
      balanceDue: d.folio.balance,
    },
  });
});

/* ---- fetch reservation by confirmation number ---- */
router.get('/reservations/:ref', (req, res) => {
  const d = get('SELECT * FROM reservations WHERE confirmation_no=?', req.params.ref);
  if (!d) throw new ApiError(404, 'Reservation not found.');
  const det = reservationDetail(d.id);
  res.json({
    reservation: {
      confirmationNo: det.confirmation_no,
      status: det.status,
      guestName: det.guest_name,
      category: det.category_name,
      room: det.room_number,
      checkIn: det.check_in,
      checkOut: det.check_out,
      adults: det.adults,
      children: det.children,
      nights: det.folio.nights,
      ratePerNight: det.rate_per_night,
      totalDue: det.folio.total,
      paid: det.folio.paid,
      balanceDue: det.folio.balance,
      specialRequests: det.special_requests,
    },
  });
});

/* ---- cancel by confirmation number ---- */
router.post('/reservations/:ref/cancel', (req, res) => {
  const d = get('SELECT * FROM reservations WHERE confirmation_no=?', req.params.ref);
  if (!d) throw new ApiError(404, 'Reservation not found.');
  if (!['Confirmed', 'Pending'].includes(d.status)) {
    throw new ApiError(409, `Reservation cannot be cancelled — status is ${d.status}.`);
  }
  run(`UPDATE reservations SET status='Cancelled', cancelled_at=datetime('now'), cancel_reason=? WHERE id=?`,
    req.body?.reason || 'Cancelled on website by guest.', d.id);
  if (d.room_id) {
    const still = get(`SELECT COUNT(*) c FROM reservations WHERE room_id=? AND status IN ('Confirmed','Pending','Checked-in')`, d.room_id).c;
    if (!still) run(`UPDATE rooms SET status='Available' WHERE id=?`, d.room_id);
  }
  logActivity('reservation', `Reservation ${d.confirmation_no} cancelled via website.`, 'Website', d.id);
  res.json({ confirmationNo: d.confirmation_no, status: 'Cancelled' });
});

export default router;
