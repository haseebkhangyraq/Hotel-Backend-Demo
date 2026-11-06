import crypto from 'node:crypto';
import { run, get, all, nightsBetween, logActivity, notify, TAX_RATE } from './db.js';

/* ---------- helpers ---------- */
export const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
export const shaCmp = (s2, s1) => timingSafeCmp(sha(s), s1);
function timingSafeCmp(a, b) {
  const A = Buffer.from(a), B = Buffer.from(b);
  return A.length === B.length && crypto.timingSafeEqual(A, B);
}

export class ApiError extends Error {
  constructor(status, message, details) { super(message); this.status = status; this.details = details; }
}

export const genConfirmation = () => {
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `GA-${stamp}-${crypto.randomInt(1000, 9999)}`;
};
export const genInvoiceNo = () => {
  const last = get(`SELECT invoice_no FROM reservations WHERE invoice_no IS NOT NULL ORDER BY invoice_no DESC LIMIT 1`);
  const n = last ? parseInt(last.invoice_no.replace(/\D/g, ''), 10) : 450;
  return `GA-INV-${String((Number.isFinite(n) ? n : 450) + 1).padStart(4, '0')}`;
};

export const ACTIVE_STATUSES = ['Confirmed', 'Pending', 'Checked-in'];

/* ---------- money / folio ---------- */
export function folio(reservation) {
  const items = all('SELECT * FROM folio_items WHERE reservation_id=? ORDER BY posted_at, id', reservation.id);
  const roomTotal = items.filter((i) => i.type === 'room').reduce((s, i) => s + i.amount, 0) || 0;
  const extrasTotal = items.filter((i) => i.type !== 'room').reduce((s, i) => s + i.amount, 0) || 0;
  const postings = items.reduce((s, i) => s + i.amount, 0);
  const nights = nightsBetween(reservation.check_in, reservation.check_out);
  // Base for future (not yet posted) reservations = nights × rate; in-house uses posted folio
  const base = postings > 0 ? postings : nights * reservation.rate_per_night;
  const discount = Number(reservation.discount) || 0;
  const taxable = Math.max(0, base - discount);
  const tax = Math.round(taxable * Number(reservation.tax_rate || TAX_RATE));
  const total = taxable + tax;
  const pays = all('SELECT * FROM payments WHERE reservation_id=? ORDER BY paid_at', reservation.id);
  const paid = pays.reduce((s, p) => s + p.amount, 0);
  return {
    nights,
    ratePerNight: reservation.rate_per_night,
    items,
    payments: pays,
    roomTotal: postings > 0 ? roomTotal : nights * reservation.rate_per_night,
    extrasTotal,
    subtotal: base,
    discount,
    taxRate: Number(reservation.tax_rate || TAX_RATE),
    tax,
    total,
    paid,
    balance: total - paid,
  };
}

/* ---------- conflicts & availability ---------- */
function overlapping(roomId, checkIn, checkOut, excludeId = null) {
  return all(
    `SELECT r.*, g.full_name FROM reservations r JOIN guests g ON g.id = r.guest_id
     WHERE r.room_id = ? AND r.id != ? AND r.status IN ('Confirmed','Pending','Checked-in')
       AND r.check_in < ? AND r.check_out > ?`,
    roomId, excludeId ?? -1, checkOut, checkIn
  );
}

export function isRoomBookable(room, checkIn, checkOut, excludeReservationId = null) {
  if (!room) return false;
  if (['Occupied', 'Dirty', 'Cleaning', 'Maintenance'].includes(room.status) && excludeReservationId === null) return false;
  return overlapping(room.id, checkIn, checkOut, excludeReservationId).length === 0;
}

export function freeRooms(categoryId, checkIn, checkOut) {
  const rooms = all(`SELECT * FROM rooms WHERE category_id=? ORDER BY number`, categoryId);
  return rooms.filter((r) => isRoomBookable(r, checkIn, checkOut, null));
}

/* ---------- reservation create / update ---------- */
export function validateReservationInput(input, { partial = false } = {}) {
  const errors = {};
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRe.test(input.check_in || '')) errors.check_in = 'Check-in date is required.';
  if (!dateRe.test(input.check_out || '')) errors.check_out = 'Check-out date is required.';
  if (!errors.check_in && !errors.check_out) {
    if (input.check_out <= input.check_in) errors.check_out = 'Check-out must be after check-in.';
    if (input.check_in < new Date().toISOString().slice(0, 10)) errors.check_in = 'Check-in cannot be in the past.';
  }
  if (!partial || input.guest_id != null) {
    if (!input.guest_id) errors.guest_id = 'Guest is required.';
  }
  if (!partial || input.category_id != null) {
    if (!input.category_id) errors.category_id = 'Room category is required.';
  }
  const ad = Number(input.adults), ch = Number(input.children) || 0;
  if (!ad || ad < 1) errors.adults = 'At least one adult is required.';
  if (Object.keys(errors).length) throw new ApiError(422, 'Validation failed', errors);
}

export function createReservation(input, actor = 'System') {
  validateReservationInput(input);
  const cat = get('SELECT * FROM room_categories WHERE id=?', input.category_id);
  if (!cat) throw new ApiError(422, 'Unknown room category.');
  const nights = nightsBetween(input.check_in, input.check_out);

  let room = null;
  if (input.room_id != null && input.room_id !== '') {
    room = get('SELECT * FROM rooms WHERE id=?', input.room_id);
    if (!room) throw new ApiError(422, 'Unknown room selected.');
    if (room.category_id !== cat.id && !input.ignoreCategory) throw new ApiError(422, `Room ${room.number} is not a ${cat.name}.`);
    if (!isRoomBookable(room, input.check_in, input.check_out)) {
      throw new ApiError(409, `Room ${room.number} is already booked or unavailable for the selected dates.`, { code: 'DOUBLE_BOOK' });
    }
  }

  const rate = Number(input.rate_per_night) > 0 ? Number(input.rate_per_night) : cat.base_rate;
  const cn = input.confirmation_no || genConfirmation();
  const status = input.status || 'Confirmed';
  const resInfo = run(
    `INSERT INTO reservations (confirmation_no,guest_id,category_id,room_id,check_in,check_out,adults,children,status,source,rate_per_night,discount,tax_rate,advance_payment,special_requests,notes,breakfast_plan,created_by)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    cn, input.guest_id, cat.id, room ? room.id : null, input.check_in, input.check_out,
    Number(input.adults) || 1, Number(input.children) || 0, status, input.source || 'Reception', rate,
    Number(input.discount) || 0, Number(input.tax_rate) || 0.17, Number(input.advance_payment) || 0,
    input.special_requests || '', input.notes || '', input.breakfast_plan || 'none', actor
  );

  if (Number(input.advance_payment) > 0) {
    run(`INSERT INTO payments (reservation_id,amount,method,purpose,received_by,note) VALUES (?,?,?,?,?,?)`,
      resInfo.lastInsertRowid, Number(input.advance_payment), input.payment_method || 'Cash', 'Advance', actor, 'Recorded at reservation creation');
  }
  if (room && status !== 'Cancelled' && status !== 'No-show') {
    reserveRoomStatus(room.id);
  }
  logActivity('reservation', `Reservation ${cn} created for ${cat.name}${room ? ` — room ${room.number}` : ' (room pending)'}${input.source ? ` via ${input.source}` : ''}.`, actor, resInfo.lastInsertRowid);
  if (input.source === 'Website') {
    notify('reservation', 'New website reservation', `${cn} · ${cat.name} · ${input.check_in} → ${input.check_out}`, '#/reservations');
  }
  return get('SELECT id FROM reservations WHERE id=?', resInfo.lastInsertRowid).id;
}

export function updateReservation(id, input, actor = 'System') {
  const existing = get('SELECT * FROM reservations WHERE id=?', id);
  if (!existing) throw new ApiError(404, 'Reservation not found.');
  validateReservationInput({ ...input }, { partial: true });
  const cat = get('SELECT * FROM room_categories WHERE id=?', input.category_id ?? existing.category_id);
  if (!cat) throw new ApiError(422, 'Unknown room category.');

  const checkIn = input.check_in || existing.check_in;
  const checkOut = input.check_out || existing.check_out;
  if (checkOut <= checkIn) throw new ApiError(422, 'Check-out must be after check-in.', { check_out: 'Check-out must be after check-in.' });

  const editableStatuses = ['Confirmed', 'Pending'];
  const newRoomId = input.room_id === null || input.room_id === '' ? null : (input.room_id ?? existing.room_id);
  let room = null;
  if (newRoomId != null) {
    room = get('SELECT * FROM rooms WHERE id=?', newRoomId);
    if (!room) throw new ApiError(422, 'Unknown room selected.');
    if (!isRoomBookable(room, checkIn, checkOut, id)) {
      throw new ApiError(409, `Room ${room.number} is already booked or unavailable for the selected dates.`, { code: 'DOUBLE_BOOK' });
    }
  }
  if (!editableStatuses.includes(existing.status)) throw new ApiError(409, `A ${existing.status} reservation cannot be edited.`, { code: 'LOCKED' });

  const rate = input.rate_per_night != null ? Number(input.rate_per_night) : existing.rate_per_night;
  run(`UPDATE reservations SET guest_id=?, category_id=?, room_id=?, check_in=?, check_out=?, adults=?, children=?, rate_per_night=?, discount=?, advance_payment=?, special_requests=?, notes=?, breakfast_plan=?, status=?
       WHERE id=?`,
    input.guest_id ?? existing.guest_id, cat.id, newRoomId, checkIn, checkOut,
    Number(input.adults ?? existing.adults) || 1, Number(input.children ?? existing.children) || 0,
    rate, Number(input.discount ?? existing.discount) || 0,
    input.advance_payment != null ? Number(input.advance_payment) : existing.advance_payment,
    input.special_requests ?? existing.special_requests, input.notes ?? existing.notes,
    input.breakfast_plan ?? existing.breakfast_plan,
    input.status ?? existing.status, id);

  // refresh room statuses: old room freed if no other active reservation
  if (newRoomId !== existing.room_id) {
    if (existing.room_id) refreshRoomStatus(existing.room_id);
    if (newRoomId && ['Confirmed', 'Pending', 'Checked-in'].includes(input.status ?? existing.status)) reserveRoomStatus(newRoomId);
  }
  logActivity('reservation', `Reservation ${existing.confirmation_no} updated.`, actor, id);
  return get('SELECT * FROM reservations WHERE id=?', id);
}

export function cancelReservation(id, reason, actor = 'System') {
  const res = get('SELECT * FROM reservations WHERE id=?', id);
  if (!res) throw new ApiError(404, 'Reservation not found.');
  if (!['Confirmed', 'Pending'].includes(res.status)) throw new ApiError(409, `Only Confirmed or Pending reservations can be cancelled (current: ${res.status}).`);
  run(`UPDATE reservations SET status='Cancelled', cancelled_at=datetime('now'), cancel_reason=? WHERE id=?`, reason || 'Cancelled by hotel.', id);
  if (res.room_id) refreshRoomStatus(res.room_id);
  logActivity('reservation', `Reservation ${res.confirmation_no} cancelled${reason ? ` — ${reason}` : ''}.`, actor, id);
  return get('SELECT * FROM reservations WHERE id=?', id);
}

export function refreshRoomStatus(roomId) {
  const active = get(
    `SELECT COUNT(*) c FROM reservations WHERE room_id=? AND status IN ('Confirmed','Pending','Checked-in') AND check_out > date('now')`, roomId);
  const room = get('SELECT * FROM rooms WHERE id=?', roomId);
  if (!room) return;
  let status = room.status;
  if (active.c === 0 && !['Dirty', 'Cleaning', 'Maintenance'].includes(room.status)) {
    status = 'Available';
  } else if (active.c > 0 && !('Occupied' === room.status)) {
    const hasInhouse = get(`SELECT COUNT(*) c FROM reservations WHERE room_id=? AND status='Checked-in'`, roomId).c;
    status = hasInhouse ? 'Occupied' : (['Dirty', 'Cleaning', 'Maintenance'].includes(room.status) ? room.status : 'Reserved');
  }
  if (status !== room.status) run('UPDATE rooms SET status=? WHERE id=?', status, roomId);
}

export function reserveRoomStatus(roomId) {
  const room = get('SELECT * FROM rooms WHERE id=?', roomId);
  if (room && !['Occupied', 'Dirty', 'Cleaning', 'Maintenance'].includes(room.status)) {
    run(`UPDATE rooms SET status='Reserved' WHERE id=?`, roomId);
  }
}

/* ---------- reservation full detail ---------- */
export function reservationDetail(id) {
  const res = get(
    `SELECT r.*, g.full_name AS guest_name, g.phone AS guest_phone, g.email AS guest_email, g.nationality AS guest_nationality,
            g.id_type AS guest_id_type, g.id_number AS guest_id_number, g.vip AS guest_vip, g.preferences AS guest_preferences,
            c.name AS category_name, rm.number AS room_number, rm.floor AS room_floor
     FROM reservations r LEFT JOIN guests g ON g.id=r.guest_id
     LEFT JOIN room_categories c ON c.id=r.category_id LEFT JOIN rooms rm ON rm.id=r.room_id
     WHERE r.id=?`, id);
  if (!res) return null;
  const f = folio(res);
  return { ...res, folio: f };
}
export function reservationSummary(id) {
  const res = get(
    `SELECT r.*, g.full_name AS guest_name, g.phone AS guest_phone, g.email AS guest_email, g.vip AS guest_vip,
            c.name AS category_name, rm.number AS room_number, rm.floor AS room_floor
     FROM reservations r LEFT JOIN guests g ON g.id=r.guest_id
     LEFT JOIN room_categories c ON c.id=r.category_id LEFT JOIN rooms rm ON rm.id=r.room_id
     WHERE r.id=?`, id);
  if (!res) return null;
  const f = folio(res);
  return { ...res, total: f.total, paid: f.paid, balance: f.balance, nights: f.nights };
}

export const RES_STATUSES = ['Confirmed', 'Pending', 'Checked-in', 'Checked-out', 'Cancelled', 'No-show'];
export const PAY_METHODS = ['Cash', 'Credit Card', 'Debit Card', 'Bank Transfer', 'Online Payment'];
