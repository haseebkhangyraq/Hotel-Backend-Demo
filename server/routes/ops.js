import express from 'express';
import { run, get, all, today, addDays, logActivity, notify } from '../db.js';
import { ApiError, folio, reservationDetail, reservationSummary, genInvoiceNo, isRoomBookable, refreshRoomStatus } from '../lib.js';

const router = express.Router();

/* ------------- front desk: today board ------------- */
router.get('/front-desk/today', (req, res) => {
  const T = today();
  const arrivals = all(`
    SELECT r.*, g.full_name AS guest_name, g.phone AS guest_phone, g.email AS guest_email, g.vip,
           g.nationality, g.preferences, c.name AS category_name, rm.number AS room_number, rm.floor
    FROM reservations r LEFT JOIN guests g ON g.id=r.guest_id
    LEFT JOIN room_categories c ON c.id=r.category_id LEFT JOIN rooms rm ON rm.id=r.room_id
    WHERE r.check_in=? AND r.status IN ('Confirmed','Pending')
    ORDER BY g.vip DESC, rm.number`, T);
  const departures = all(`
    SELECT r.*, g.full_name AS guest_name, g.vip, c.name AS category_name, rm.number AS room_number, rm.floor
    FROM reservations r LEFT JOIN guests g ON g.id=r.guest_id
    LEFT JOIN room_categories c ON c.id=r.category_id LEFT JOIN rooms rm ON rm.id=r.room_id
    WHERE r.check_out=? AND r.status='Checked-in' ORDER BY rm.number`, T);
  const inhouse = all(`
    SELECT r.*, g.full_name AS guest_name, g.vip, c.name AS category_name, rm.number AS room_number, rm.floor
    FROM reservations r LEFT JOIN guests g ON g.id=r.guest_id
    LEFT JOIN room_categories c ON c.id=r.category_id LEFT JOIN rooms rm ON rm.id=r.room_id
    WHERE r.status='Checked-in' ORDER BY r.check_out, rm.number`);
  const withBalance = (rows) => rows.map((r) => {
    const f = folio(r);
    return { ...r, nights: f.nights, balance: f.balance, total: f.total, paid: f.paid };
  });
  const unassigned = all(`
    SELECT r.*, g.full_name AS guest_name, g.vip, c.name AS category_name
    FROM reservations r LEFT JOIN guests g ON g.id=r.guest_id
    LEFT JOIN room_categories c ON c.id=r.category_id
    WHERE r.room_id IS NULL AND r.status IN ('Confirmed','Pending') AND r.check_in <= ?
    ORDER BY r.check_in`, addDays(T, 2));

  res.json({
    today: T,
    arrivals: withBalance(arrivals),
    departures: withBalance(departures),
    inHouse: withBalance(inhouse),
    unassigned,
  });
});

/* ------------- check-in ------------- */
router.post('/reservations/:id/check-in', (req, res) => {
  const r = get('SELECT * FROM reservations WHERE id=?', Number(req.params.id));
  if (!r) throw new ApiError(404, 'Reservation not found.');
  if (!['Confirmed', 'Pending'].includes(r.status)) throw new ApiError(409, `Cannot check in a ${r.status} reservation.`);
  if (r.check_in > addDays(today(), 1)) throw new ApiError(409, 'Early check-in — reservation is not due yet.');

  const b = req.body || {};
  let roomId = b.roomId != null ? Number(b.roomId) : r.room_id;
  if (!roomId) throw new ApiError(422, 'A room must be assigned before check-in. Choose a room to continue.', { code: 'NO_ROOM' });
  if (roomId !== r.room_id) {
    const room = get('SELECT * FROM rooms WHERE id=?', roomId);
    if (!room) throw new ApiError(422, 'Unknown room.');
    if (room.category_id !== r.category_id) throw new ApiError(422, `Room ${room.number} is not a ${get('SELECT name FROM room_categories WHERE id=?', r.category_id).name}.`);
    if (!isRoomBookable(room, r.check_in, r.check_out, r.id)) throw new ApiError(409, `Room ${room.number} is booked for these dates — pick another room.`, { code: 'DOUBLE_BOOK' });
  }

  const payment = Number(b.paymentAmount) || 0;
  const guest = get('SELECT * FROM guests WHERE id=?', r.guest_id);
  const roomRow = get('SELECT * FROM rooms WHERE id=?', roomId);

  // post room charge for the entire stay, update reservation
  const nights = (new Date(r.check_out) - new Date(r.check_in)) / 86400000;
  run(`INSERT INTO folio_items (reservation_id,type,description,quantity,unit_price,amount,posted_by) VALUES (?,?,?,?,?,?,?)`,
    r.id, 'room', `Room charges (accommodation)`, Math.max(1, Math.round(nights)), r.rate_per_night,
    Math.max(1, Math.round(nights)) * r.rate_per_night, req.user.name);
  run(`UPDATE reservations SET status='Checked-in', room_id=?, checked_in_at=datetime('now'), id_doc_type=?, id_doc_number=? WHERE id=?`,
    roomId, b.idDocType ?? r.id_doc_type, b.idDocNumber ?? r.id_doc_number, r.id);
  if (payment > 0) {
    const purpose = ['Advance', 'Settlement'].includes(b.purpose) ? b.purpose : 'Advance';
    run(`INSERT INTO payments (reservation_id,amount,method,purpose,received_by,note) VALUES (?,?,?,?,?,?)`,
      r.id, payment, b.paymentMethod || 'Cash', purpose, req.user.name, b.paymentNote || 'Payment recorded at check-in');
  }
  run(`UPDATE rooms SET status='Occupied' WHERE id=?`, roomId);
  if (b.preferences && guest) run('UPDATE guests SET preferences=? WHERE id=?', b.preferences, guest.id);

  logActivity('checkin', `${guest?.full_name || 'Guest'} checked in to room ${roomRow.number} (${r.confirmation_no}).${b.express ? ' Express check-in.' : ''}`, req.user.name, r.id);
  notify('departure', `Departure ${r.check_out}`, `${guest?.full_name} departs room ${roomRow.number} on ${r.check_out}.`, '#/front-desk');

  res.json({ reservation: reservationSummary(r.id), receipt: checkinReceipt(r.id) });
});

function checkinReceipt(id) {
  const d = reservationDetail(id);
  return {
    hotel: 'Grand Aurelia Hotel & Resort',
    title: 'Registration Receipt',
    reservation: {
      confirmation_no: d.confirmation_no, guest_name: d.guest_name, room: `${d.room_number}`,
      category: d.category_name, check_in: d.check_in, check_out: d.check_out, adults: d.adults,
      children: d.children, id_doc_type: d.id_doc_type, id_doc_number: d.id_doc_number,
      rate: d.rate_per_night, nights: d.folio.nights, checked_in_at: d.checked_in_at,
      balance: d.folio.balance, paid: d.folio.paid,
    },
  };
}

/* ------------- folio ------------- */
router.get('/reservations/:id/folio', (req, res) => {
  const d = reservationDetail(Number(req.params.id));
  if (!d) throw new ApiError(404, 'Reservation not found.');
  res.json({ folio: { reservation: { ...d, folio: undefined }, ...d.folio } });
});

/* any remaining nights not yet posted (late charges preview) */
router.post('/reservations/:id/post-nights', (req, res) => {
  const r = get('SELECT * FROM reservations WHERE id=?', Number(req.params.id));
  if (!r) throw new ApiError(404, 'Reservation not found.');
  const posted = get(`SELECT COUNT(*) c FROM folio_items WHERE reservation_id=? AND type='room'`, r.id).c;
  if (posted > 0) throw new ApiError(409, 'Room charges are already posted for this stay.');
  const nights = Math.max(1, Math.round((new Date(r.check_out) - new Date(r.check_in)) / 86400000));
  run(`INSERT INTO folio_items (reservation_id,type,description,quantity,unit_price,amount,posted_by) VALUES (?,?,?,?,?,?,?)`,
    r.id, 'room', 'Room charges (accommodation)', nights, r.rate_per_night, nights * r.rate_per_night, req.user.name);
  res.json({ folio: folio(r) });
});

/* post extra charge */
router.post('/reservations/:id/charges', (req, res) => {
  const r = get('SELECT * FROM reservations WHERE id=?', Number(req.params.id));
  if (!r) throw new ApiError(404, 'Reservation not found.');
  const { type, description, quantity, unit_price } = req.body || {};
  if (!description || !(unit_price > 0)) throw new ApiError(422, 'Description and a positive unit price are required.');
  run(`INSERT INTO folio_items (reservation_id,type,description,quantity,unit_price,amount,posted_by) VALUES (?,?,?,?,?,?,?)`,
    r.id, type || 'other', description, Number(quantity) || 1, Number(unit_price),
    (Number(quantity) || 1) * Number(unit_price), req.user.name);
  logActivity('payment', `Charge posted to ${r.confirmation_no}: ${description} (₨ ${(Number(quantity) || 1) * Number(unit_price)}).`, req.user.name, r.id);
  res.json({ folio: folio(r) });
});

router.delete('/charges/:chargeId', (req, res) => {
  const item = get('SELECT * FROM folio_items WHERE id=?', Number(req.params.chargeId));
  if (!item) throw new ApiError(404, 'Charge not found.');
  run('DELETE FROM folio_items WHERE id=?', item.id);
  res.json({ folio: folio(get('SELECT * FROM reservations WHERE id=?', item.reservation_id)) });
});

/* ------------- record payment ------------- */
router.post('/payments', (req, res) => {
  const { reservation_id, amount, method, note } = req.body || {};
  if (!(amount > 0)) throw new ApiError(422, 'Payment amount must be positive.');
  const r = reservation_id ? get('SELECT * FROM reservations WHERE id=?', Number(reservation_id)) : null;
  run(`INSERT INTO payments (reservation_id,amount,method,purpose,received_by,note) VALUES (?,?,?,?,?,?)`,
    r?.id ?? null, Number(amount), method || 'Cash', 'Settlement', req.user.name, note || '');
  if (r) logActivity('payment', `Payment of ₨ ${Number(amount)} received for ${r.confirmation_no} (${method}).`, req.user.name, r.id);
  res.json({ folio: r ? folio(r) : null });
});

/* ------------- check-out ------------- */
router.post('/reservations/:id/check-out', (req, res) => {
  const r = get('SELECT * FROM reservations WHERE id=?', Number(req.params.id));
  if (!r) throw new ApiError(404, 'Reservation not found.');
  if (r.status !== 'Checked-in') throw new ApiError(409, 'Only checked-in guests can be checked out.');

  const b = req.body || {};
  const payments = Array.isArray(b.payments) ? b.payments : (b.amount > 0 ? [{ amount: Number(b.amount), method: b.method || 'Cash' }] : []);
  for (const p of payments) {
    if (Number(p.amount) > 0) {
      run(`INSERT INTO payments (reservation_id,amount,method,purpose,received_by,note) VALUES (?,?,?,?,?,?)`,
        r.id, Number(p.amount), p.method || 'Cash', 'Settlement', req.user.name, 'Final payment at check-out');
    }
  }
  const invoice_no = r.invoice_no || genInvoiceNo();
  run(`UPDATE reservations SET status='Checked-out', checked_out_at=datetime('now'), invoice_no=? WHERE id=?`, invoice_no, r.id);

  const guest = get('SELECT * FROM guests WHERE id=?', r.guest_id);
  const room = get('SELECT * FROM rooms WHERE id=?', r.room_id);
  if (room) {
    run(`UPDATE rooms SET status='Dirty' WHERE id=?`, room.id);
    run(`INSERT INTO housekeeping_tasks (room_id,task_type,status,priority,notes) VALUES (?,?,?,?,?)`,
      room.id, 'Cleaning', 'Pending', 'Normal', `Departure clean — ${guest?.full_name || 'guest'} checked out of ${room.number}.`);
    notify('housekeeping', `Cleaning task — room ${room.number}`, `${guest?.full_name || 'A guest'} checked out. Room ${room.number} needs cleaning.`, '#/housekeeping');
  } else {
    refreshRoomStatus(r.room_id);
  }
  logActivity('checkout', `${guest?.full_name || 'Guest'} checked out of room ${room?.number || '—'}. Invoice ${invoice_no} issued.`, req.user.name, r.id);
  res.json({ reservation: reservationSummary(r.id), invoice_no });
});

export default router;
