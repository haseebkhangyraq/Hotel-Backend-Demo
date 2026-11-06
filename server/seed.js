import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { run, get, all, nowISO, addDays, today, logActivity, notify } from './db.js';

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const iso = (d, time = '10:00:00') => `${d} ${time}`;
let seed = 42;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const pick = (arr) => arr[Math.floor(rnd() * arr.length) % arr.length];

export function seedDatabase({ reset = false } = {}) {
const isReset = reset;
const hasData = get('SELECT COUNT(*) c FROM users').c > 0;
if (hasData && !isReset) {
  console.log('Database already seeded. Use --reset to re-seed.');
  return;
}

console.log('Resetting database…');
for (const t of ['activity_log', 'notifications', 'maintenance_requests', 'housekeeping_tasks', 'payments', 'folio_items', 'reservations', 'guests', 'rooms', 'room_categories', 'users']) {
  run(`DELETE FROM ${t}`);
  try { run(`DELETE FROM sqlite_sequence WHERE name='${t}'`); } catch { /* noop */ }
}

/* ---------------- Users ---------------- */
const users = [
  ['Umar Farooq', 'umar.farooq@aurelia.pk', 'Administrator', '+92 300 111 2233'],
  ['Layla Ahmed', 'layla.ahmed@aurelia.pk', 'Manager', '+92 301 745 8890'],
  ['Ali Raza', 'ali.raza@aurelia.pk', 'Receptionist', '+92 302 445 1122'],
  ['Zainab Yusuf', 'zainab.yusuf@aurelia.pk', 'Receptionist', '+92 333 909 5544'],
  ['Sana Bibi', 'sana.bibi@aurelia.pk', 'Housekeeping', '+92 345 220 7788'],
  ['Rukhsana Kausar', 'rukhsana.kausar@aurelia.pk', 'Housekeeping', '+92 346 661 3311'],
  ['Fabeha Naveed', 'fabeha.naveed@aurelia.pk', 'Accountant', '+92 321 880 4466'],
];
const userIds = {};
for (const [name, email, role, phone] of users) {
  const r = run('INSERT INTO users (name,email,role,password_hash,phone) VALUES (?,?,?,?,?)', name, email, role, sha('demo123'), phone);
  userIds[role] ||= r.lastInsertRowid;
  userIds[name] = r.lastInsertRowid;
}

/* ---------------- Room categories ---------------- */
const cats = [
  ['Standard Room', 'standard-room', 'A calm, well-appointed room with garden-facing windows and all essential comforts.', 9500, 2, 28, '1 Queen bed', ['Wi-Fi', 'Air conditioning', 'Smart TV', 'Work desk', 'Coffee maker', 'Daily housekeeping']],
  ['Deluxe Room', 'deluxe-room', 'Generous comfort with a sitting nook, rainfall shower and Margalla-facing views.', 14500, 3, 36, '1 King bed + daybed', ['Wi-Fi', 'Air conditioning', 'Smart TV', 'Minibar', 'Rain shower', 'Bathtub', 'Coffee maker']],
  ['Executive Room', 'executive-room', 'Business-ready room with executive lounge access and a dedicated work suite.', 18500, 2, 40, '1 King bed', ['Lounge access', 'Wi-Fi 300 Mbps', 'Ergonomic desk', 'Nespresso machine', 'Soundproofing', 'Evening canapés']],
  ['Business Class Room', 'business-class-room', 'Extra space for the modern traveller — dual workspace, meeting corner and city views.', 22000, 3, 45, '1 King bed + sofa', ['Lounge access', 'Dual workspace', 'Meeting corner', 'Printer on request', 'Minibar', 'Late check-out 14:00']],
  ['Suite Room', 'suite-room', 'A separate living room, dining corner and wraparound terrace for gracious stays.', 32000, 4, 62, '1 King bed + sofa bed', ['Private terrace', 'Dining corner', 'Butler service', 'Minibar', 'DTV sound system', 'Spa credit']],
  ['Presidential Suite', 'presidential-suite', 'Grand Aurelia’s signature suite — panoramic views, private lounge and dedicated butler.', 72000, 6, 120, '1 Emperor bed + guest room', ['Private lounge', 'Butler 24/7', 'Panoramic terrace', 'Private dining', 'Jacuzzi', 'Chauffeur service']],
];
const catIds = {};
for (const [name, slug, description, base_rate, max_occupancy, size, bed, amenities] of cats) {
  const r = run('INSERT INTO room_categories (name,slug,description,base_rate,max_occupancy,size_sqm,bed,amenities) VALUES (?,?,?,?,?,?,?,?)',
    name, slug, description, base_rate, max_occupancy, size, bed, JSON.stringify(amenities));
  catIds[name] = r.lastInsertRowid;
}

/* ---------------- Rooms (32) ---------------- */
const rooms = [];
const pushRooms = (cat, floor, from, to) => { for (let n = from; n <= to; n++) rooms.push([cat, floor, String(n)]); };
pushRooms('Standard Room', 1, 101, 105);
pushRooms('Standard Room', 2, 201, 205);
pushRooms('Deluxe Room', 3, 301, 306);
pushRooms('Deluxe Room', 4, 401, 402);
pushRooms('Executive Room', 4, 403, 406);
pushRooms('Business Class Room', 5, 501, 504);
pushRooms('Suite Room', 6, 601, 604);
pushRooms('Presidential Suite', 7, 701, 702);

const roomIds = {};
for (const [cat, floor, number] of rooms) {
  const rate = get('SELECT base_rate FROM room_categories WHERE id=?', catIds[cat]).base_rate;
  const occ = get('SELECT max_occupancy FROM room_categories WHERE id=?', catIds[cat]).max_occupancy;
  const r = run('INSERT INTO rooms (number,category_id,floor,max_occupancy,rate,status,amenities) VALUES (?,?,?,?,?,?,?)',
    number, catIds[cat], floor, occ, rate, 'Available', JSON.stringify(['Wi-Fi', 'Air conditioning', 'Smart TV']));
  roomIds[number] = r.lastInsertRowid;
}

/* Room statuses without active guests */
run('UPDATE rooms SET status=? WHERE id=?', 'Dirty', roomIds['104']);
run('UPDATE rooms SET status=? WHERE id=?', 'Dirty', roomIds['305']);
run('UPDATE rooms SET status=? WHERE id=?', 'Dirty', roomIds['603']);
run('UPDATE rooms SET status=? WHERE id=?', 'Cleaning', roomIds['202']);
run('UPDATE rooms SET status=? WHERE id=?', 'Maintenance', roomIds['102']);
run('UPDATE rooms SET notes=? WHERE id=?', 'Window seal replaced on 24 Oct. Monitor lock mechanism.', roomIds['102']);
run('UPDATE rooms SET notes=? WHERE id=?', 'Corner room — extra quiet, guest favourite.', roomIds['702']);

/* ---------------- Guests (20) ---------------- */
const guests = [
  ['Aman Khan', '+92 345 512 8890', 'aman.khan@gmail.com', 'Pakistan', 'CNIC', '61101-8890321-7', 0, 'Late breakfast (09:00), high floor', ''],
  ['Sara Malik', '+92 300 766 1123', 'sara.malik@outlook.com', 'Pakistan', 'CNIC', '35202-1123990-8', 0, 'Feather-free pillows', ''],
  ['Tariq Jamil', '+92 321 902 4467', 'tariq.jamil@aurora-textiles.com', 'Pakistan', 'CNIC', '42201-4467112-1', 1, 'Corner suite, fresh orange juice on arrival', 'Chairman, Aurora Textiles. Regular bi-weekly stays.'],
  ['Farah Qureshi', '+92 333 120 9987', 'farah.q@gmail.com', 'Pakistan', 'CNIC', '61101-9987664-2', 0, 'Spa therapy preferred', ''],
  ['David Chen', '', 'd.chen@hutchintl.co.uk', 'United Kingdom', 'Passport', 'P7730119B', 0, 'Airport transfer (pick-up)', 'Visiting for trade fair — week-long stay pattern.'],
  ['Bilal Ahmed', '+92 308 554 2210', 'bilal.ahmed88@gmail.com', 'Pakistan', 'CNIC', '81303-2210554-9', 0, '', ''],
  ['Nadia Hassan', '+92 300 441 7862', 'nadia.hassan@hassancorp.pk', 'Pakistan', 'CNIC', '42000-7862123-4', 1, 'Firm mattress, no turmeric in room service', 'CEO Hassancorp. Books exclusively via phone with front office manager.'],
  ['Omar Sheikh', '+92 312 887 3319', 'omar.shkh@gmail.com', 'Pakistan', 'CNIC', '37405-3319120-5', 0, 'Family — kids welcome kit', ''],
  ['Imran Baig', '+92 301 008 5591', 'imran.baig@baigholdings.com', 'Pakistan', 'CNIC', '17301-5591334-9', 1, 'Chauffeur service, green tea twice daily', 'Baig Holdings — annual board stays.'],
  ['Hina Raza', '+92 334 209 8876', 'hina.raza@gmail.com', 'Pakistan', 'CNIC', '61101-8876552-3', 0, 'Quiet room away from lift', ''],
  ['Kamran Ali', '+92 345 700 2218', 'kamran.ali@hotmail.com', 'Pakistan', 'CNIC', '34101-2218876-0', 0, '', ''],
  ['Asma Tahir', '+92 302 990 5567', 'asma.tahir@tahirlaw.pk', 'Pakistan', 'CNIC', '61101-5567908-1', 1, 'Suite, personal fridge, late checkout 16:00', 'Senior partner Tahir Law — anniversary stays.'],
  ['Zeeshan Iqbal', '+92 316 442 1290', 'z.iqbal@iqbalconstruction.com', 'Pakistan', 'CNIC', '38401-1290887-2', 0, 'Meeting corner setup', ''],
  ['Maliha Tariq', '+92 340 556 7723', 'maliha.t@gmail.com', 'Pakistan', 'CNIC', '42201-7723221-6', 0, 'Extra blankets', ''],
  ['Ahmed Raza', '+92 305 812 3390', 'ahmed.raza@fastmail.com', 'Pakistan', 'CNIC', '81303-3390442-8', 0, '', ''],
  ['Julia Mendes', '', 'j.mendes@lyxaeu.com', 'Portugal', 'Passport', 'N4451992', 0, 'Vegetarian menu, airport drop-off', ''],
  ['Hassan Nawaz', '+92 335 670 9912', 'hassan.nawaz@nawazgroup.pk', 'Pakistan', 'CNIC', '35202-9912087-4', 1, 'Suite, top floor only', 'Nawaz Group board stays.'],
  ['Faisal Mirza', '+92 315 220 4431', 'faisal.mirza@gmail.com', 'Pakistan', 'CNIC', '33202-4431665-9', 0, '', ''],
  ['Ayesha Khan', '+92 302 118 7754', 'ayesha.k@outlook.com', 'Pakistan', 'CNIC', '42101-7754778-2', 0, 'High floor, no smoking', ''],
  ['Viktor Petrov', '', 'v.petrov@zenithsoft.io', 'Germany', 'Passport', 'C12KL98P', 0, 'Early check-in whenever possible', ''],
];
const guestIds = {};
let gi = 0;
for (const [full_name, phone, email, nationality, id_type, id_number, vip, preferences, notes] of guests) {
  const r = run('INSERT INTO guests (full_name,phone,email,nationality,id_type,id_number,vip,preferences,notes) VALUES (?,?,?,?,?,?,?,?,?)',
    full_name, phone, email, nationality, id_type, id_number, vip, preferences, notes);
  guestIds[gi++] = r.lastInsertRowid;
}

/* ---------------- Reservations ---------------- */
const T = today();
let resNo = 0;
const conf = (d) => `GA-${d.replaceAll('-', '')}-${String(1000 + Math.floor(rnd() * 8999)).slice(0, 4)}`;
const mkRes = (o) => {
  const nights = Math.max(1, Math.round((new Date(o.check_out + 'T12:00Z') - new Date(o.check_in + 'T12:00Z')) / 86400000));
  const r = run(`INSERT INTO reservations (confirmation_no,guest_id,category_id,room_id,check_in,check_out,adults,children,status,source,rate_per_night,discount,tax_rate,advance_payment,special_requests,notes,breakfast_plan,id_doc_type,id_doc_number,created_by,created_at,checked_in_at,checked_out_at,cancelled_at,cancel_reason,invoice_no)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    o.cn, o.guestId, o.catId, o.roomId || null, o.check_in, o.check_out, o.adults ?? 2, o.children ?? 0,
    o.status, o.source, o.rate, o.discount ?? 0, 0.17, o.advance ?? 0, o.requests ?? '', o.notes ?? '',
    o.breakfast ?? 'breakfast', o.idType ?? '', o.idNo ?? '', o.createdBy ?? 'Ali Raza',
    o.created ?? iso(o.check_in > T ? o.check_in : o.check_in),
    o.ciAt ?? null, o.coAt ?? null, o.cancelAt ?? null, o.cancelReason ?? null, o.invoice ?? null);
  return r.lastInsertRowid;
};

// Checked-in stays (5)
const R = {};
R.r1 = mkRes({ cn: conf(addDays(T, -1)), guestId: guestIds[0], catId: catIds['Standard Room'], roomId: roomIds['101'], check_in: T, check_out: addDays(T, 2), status: 'Checked-in', source: 'Website', rate: 9500, advance: 5000, idType: 'CNIC', idNo: '61101-8890321-7', ciAt: iso(T, '13:10:00'), created: iso(addDays(T, -6)), createdBy: 'Website' });
R.r2 = mkRes({ cn: conf(addDays(T, -1)), guestId: guestIds[1], catId: catIds['Deluxe Room'], roomId: roomIds['302'], check_in: addDays(T, -1), check_out: addDays(T, 2), adults: 2, children: 1, status: 'Checked-in', source: 'Phone', rate: 14500, advance: 8000, idType: 'CNIC', idNo: '35202-1123990-8', ciAt: iso(addDays(T, -1), '15:32:00'), created: iso(addDays(T, -4)), createdBy: 'Zainab Yusuf' });
R.r3 = mkRes({ cn: conf(addDays(T, -2)), guestId: guestIds[2], catId: catIds['Business Class Room'], roomId: roomIds['501'], check_in: T, check_out: addDays(T, 3), status: 'Checked-in', source: 'Walk-in', rate: 22000, discount: 2500, advance: 15000, idType: 'CNIC', idNo: '42201-4467112-1', ciAt: iso(T, '11:05:00'), created: iso(T, '10:40:00'), createdBy: 'Ali Raza', notes: 'Walk-in at 10:40. Corporate rate honoured with loyalty tier.' });
R.r4 = mkRes({ cn: conf(addDays(T, -1)), guestId: guestIds[3], catId: catIds['Suite Room'], roomId: roomIds['601'], check_in: addDays(T, -1), check_out: addDays(T, 1), status: 'Checked-in', source: 'Reception', rate: 32000, advance: 20000, idType: 'CNIC', idNo: '61101-9987664-2', ciAt: iso(addDays(T, -1), '16:15:00'), created: iso(addDays(T, -8)), createdBy: 'Zainab Yusuf' });
R.r5 = mkRes({ cn: conf(addDays(T, -2)), guestId: guestIds[4], catId: catIds['Executive Room'], roomId: roomIds['402'], check_in: T, check_out: addDays(T, 1), status: 'Checked-in', source: 'Website', rate: 18500, advance: 10000, idType: 'Passport', idNo: 'P7730119B', ciAt: iso(T, '09:48:00'), created: iso(addDays(T, -10)), createdBy: 'Website' });

// Arriving today (4 confirmed + reservations calendar)
R.r6 = mkRes({ cn: conf(addDays(T, -3)), guestId: guestIds[5], catId: catIds['Standard Room'], roomId: roomIds['201'], check_in: T, check_out: addDays(T, 2), status: 'Confirmed', source: 'Website', rate: 9500, advance: 10000, created: iso(addDays(T, -3)), createdBy: 'Website' });
R.r7 = mkRes({ cn: conf(addDays(T, -5)), guestId: guestIds[6], catId: catIds['Deluxe Room'], roomId: roomIds['303'], check_in: T, check_out: addDays(T, 3), adults: 2, children: 1, status: 'Confirmed', source: 'Phone', rate: 14500, advance: 12000, created: iso(addDays(T, -5)), createdBy: 'Ali Raza' });
R.r8 = mkRes({ cn: conf(addDays(T, -7)), guestId: guestIds[7], catId: catIds['Suite Room'], roomId: roomIds['602'], check_in: T, check_out: addDays(T, 2), adults: 2, children: 2, status: 'Confirmed', source: 'Website', rate: 32000, advance: 25000, requests: 'Kids club visit on day 2. Cot for the younger child.', created: iso(addDays(T, -7)), createdBy: 'Website' });
R.r9 = mkRes({ cn: conf(addDays(T, -1)), guestId: guestIds[8], catId: catIds['Presidential Suite'], roomId: roomIds['701'], check_in: addDays(T, 1), check_out: addDays(T, 4), adults: 2, children: 1, status: 'Confirmed', source: 'Website', rate: 72000, advance: 40000, breakfast: 'full_board', requests: 'Chauffeur service from the airport. Daily fresh flowers.', created: iso(addDays(T, -8)), createdBy: 'Website' });

// Pending (2, unassigned rooms)
R.r10 = mkRes({ cn: conf(addDays(T, 0)), guestId: guestIds[9], catId: catIds['Deluxe Room'], roomId: null, check_in: addDays(T, 2), check_out: addDays(T, 5), status: 'Pending', source: 'Website', rate: 14500, advance: 0, requests: 'Quiet room away from the lift, if possible.', created: iso(T, '08:22:00'), createdBy: 'Website' });
R.r11 = mkRes({ cn: conf(addDays(T, 0)), guestId: guestIds[10], catId: catIds['Standard Room'], roomId: null, check_in: addDays(T, 1), check_out: addDays(T, 3), status: 'Pending', source: 'Phone', rate: 9500, advance: 0, created: iso(T, '09:15:00'), createdBy: 'Zainab Yusuf' });

// Confirmed future (3)
R.r12 = mkRes({ cn: conf(addDays(T, -4)), guestId: guestIds[11], catId: catIds['Presidential Suite'], roomId: roomIds['702'], check_in: addDays(T, 5), check_out: addDays(T, 7), status: 'Confirmed', source: 'Website', rate: 72000, discount: 5000, advance: 30000, breakfast: 'half_board', created: iso(addDays(T, -4)), createdBy: 'Website' });
R.r13 = mkRes({ cn: conf(addDays(T, -2)), guestId: guestIds[12], catId: catIds['Business Class Room'], roomId: roomIds['503'], check_in: addDays(T, 4), check_out: addDays(T, 6), status: 'Confirmed', source: 'Reception', rate: 22000, advance: 10000, created: iso(addDays(T, -2)), createdBy: 'Ali Raza' });
R.r14 = mkRes({ cn: conf(addDays(T, -1)), guestId: guestIds[13], catId: catIds['Standard Room'], roomId: roomIds['205'], check_in: addDays(T, 2), check_out: addDays(T, 4), status: 'Confirmed', source: 'Phone', rate: 9500, advance: 0, created: iso(addDays(T, -1)), createdBy: 'Zainab Yusuf' });

// Checked-out (4)
R.r15 = mkRes({ cn: conf(addDays(T, -3)), guestId: guestIds[14], catId: catIds['Standard Room'], roomId: roomIds['104'], check_in: addDays(T, -3), check_out: addDays(T, -1), status: 'Checked-out', source: 'Reception', rate: 9500, advance: 8000, idType: 'CNIC', idNo: '81303-3390442-8', ciAt: iso(addDays(T, -3), '14:02:00'), coAt: iso(addDays(T, -1), '11:26:00'), invoice: 'GA-INV-0451', created: iso(addDays(T, -5)), createdBy: 'Ali Raza' });
R.r16 = mkRes({ cn: conf(addDays(T, -6)), guestId: guestIds[15], catId: catIds['Deluxe Room'], roomId: roomIds['305'], check_in: addDays(T, -2), check_out: addDays(T, -1), status: 'Checked-out', source: 'Website', rate: 14500, advance: 21000, idType: 'Passport', idNo: 'N4451992', ciAt: iso(addDays(T, -2), '13:44:00'), coAt: iso(addDays(T, -1), '12:08:00'), invoice: 'GA-INV-0452', created: iso(addDays(T, -9)), createdBy: 'Website' });
R.r17 = mkRes({ cn: conf(addDays(T, -8)), guestId: guestIds[16], catId: catIds['Suite Room'], roomId: roomIds['603'], check_in: addDays(T, -4), check_out: addDays(T, -2), status: 'Checked-out', source: 'Phone', rate: 32000, discount: 3200, advance: 50000, idType: 'CNIC', idNo: '35202-9912087-4', ciAt: iso(addDays(T, -4), '15:20:00'), coAt: iso(addDays(T, -2), '12:35:00'), invoice: 'GA-INV-0453', created: iso(addDays(T, -12)), createdBy: 'Layla Ahmed' });
R.r18 = mkRes({ cn: conf(addDays(T, -3)), guestId: guestIds[4], catId: catIds['Executive Room'], roomId: roomIds['404'], check_in: addDays(T, -3), check_out: addDays(T, -2), status: 'Checked-out', source: 'Website', rate: 18500, advance: 12000, idType: 'Passport', idNo: 'P7730119B', ciAt: iso(addDays(T, -3), '14:18:00'), coAt: iso(addDays(T, -2), '10:52:00'), invoice: 'GA-INV-0454', created: iso(addDays(T, -7)), createdBy: 'Website' });

// Cancelled / No-show (2 + 1)
R.r19 = mkRes({ cn: conf(addDays(T, -6)), guestId: guestIds[17], catId: catIds['Standard Room'], roomId: null, check_in: addDays(T, 3), check_out: addDays(T, 5), status: 'Cancelled', source: 'Website', rate: 9500, cancelAt: iso(addDays(T, -2), '17:40:00'), cancelReason: 'Travel plans changed by guest.', created: iso(addDays(T, -6)), createdBy: 'Website' });
R.r20 = mkRes({ cn: conf(addDays(T, -4)), guestId: guestIds[18], catId: catIds['Standard Room'], roomId: roomIds['202'], check_in: addDays(T, 2), check_out: addDays(T, 4), status: 'Cancelled', source: 'Phone', rate: 9500, advance: 4000, cancelAt: iso(addDays(T, -1), '11:05:00'), cancelReason: 'Cancel of company booking — refundable advance.', created: iso(addDays(T, -4)), createdBy: 'Ali Raza' });
R.r21 = mkRes({ cn: conf(addDays(T, -5)), guestId: guestIds[19], catId: catIds['Deluxe Room'], roomId: roomIds['304'], check_in: addDays(T, -1), check_out: T, status: 'No-show', source: 'Website', rate: 14500, advance: 0, cancelAt: iso(T, '02:00:00'), created: iso(addDays(T, -5)), createdBy: 'Website' });

// Sync room statuses to live reservations
const setStatus = (roomNo, status) => run('UPDATE rooms SET status=? WHERE id=?', status, roomIds[roomNo]);
setStatus('101', 'Occupied'); setStatus('302', 'Occupied'); setStatus('501', 'Occupied'); setStatus('601', 'Occupied'); setStatus('402', 'Occupied');
['201', '303', '602'].forEach((n) => setStatus(n, 'Reserved'));
setStatus('701', 'Reserved');

/* Folio: room charges for in-house stays + posted extras */
const postFolio = (resId, type, desc, qty, unit, at, by = 'Ali Raza') =>
  run('INSERT INTO folio_items (reservation_id,type,description,quantity,unit_price,amount,posted_at,posted_by) VALUES (?,?,?,?,?,?,?,?)',
    resId, type, desc, qty, unit, qty * unit, at, by);

const nightCharge = (resId, rate, nights, ciAt) => postFolio(resId, 'room', 'Room charges (accommodation)', nights, rate, iso(ciAt.slice(0, 10), '14:00:00'));
nightCharge(R.r1, 9500, 2, iso(T, '13:10:00'));
nightCharge(R.r2, 14500, 3, iso(addDays(T, -1), '15:32:00'));
nightCharge(R.r3, 22000, 3, iso(T, '11:05:00'));
nightCharge(R.r4, 32000, 2, iso(addDays(T, -1), '16:15:00'));
nightCharge(R.r5, 18500, 2, iso(T, '09:48:00'));
postFolio(R.r1, 'minibar', 'Minibar — sparkling water & nuts', 1, 1400, iso(T, '20:30:00'));
postFolio(R.r2, 'laundry', 'Laundry — 5 pieces, express', 5, 320, iso(T, '09:12:00'));
postFolio(R.r3, 'food', 'In-room dining — dinner for two', 1, 6400, iso(T, '21:05:00'));
postFolio(R.r4, 'spa', 'Aurelia Spa signature ritual', 1, 12500, iso(T, '17:40:00'));
postFolio(R.r17, 'food', 'Fine dining — Aurelia Signature Mocktails', 2, 1400, iso(addDays(T, -3), '20:10:00'));
postFolio(R.r17, 'minibar', 'Minibar restock', 1, 2300, iso(addDays(T, -3), '22:00:00'), 'Room Service');
postFolio(R.r17, 'room', 'Room charges (accommodation)', 2, 32000, iso(addDays(T, -4), '15:20:00'));
postFolio(R.r16, 'room', 'Room charges (accommodation)', 1, 14500, iso(addDays(T, -2), '13:44:00'));
postFolio(R.r16, 'food', 'Breakfast upgrades', 2, 2200, iso(addDays(T, -2), '08:30:00'));
postFolio(R.r15, 'room', 'Room charges (accommodation)', 2, 9500, iso(addDays(T, -3), '14:02:00'));
postFolio(R.r15, 'other', 'Airport drop-off transfer', 1, 6500, iso(addDays(T, -1), '11:00:00'));
postFolio(R.r18, 'room', 'Room charges (accommodation)', 1, 18500, iso(addDays(T, -3), '14:18:00'));

/* Payments */
const pay = (resId, amount, method, purpose, at, by = 'Ali Raza', note = '') =>
  run('INSERT INTO payments (reservation_id,amount,method,purpose,paid_at,received_by,note) VALUES (?,?,?,?,?,?,?)', resId, amount, method, purpose, at, by, note);
pay(R.r1, 5000, 'Online Payment', 'Advance', iso(addDays(T, -6), '18:24:00'), 'Website', 'Paid on website at booking time');
pay(R.r2, 8000, 'Credit Card', 'Advance', iso(addDays(T, -1), '15:35:00'), 'Zainab Yusuf');
pay(R.r3, 15000, 'Cash', 'Advance', iso(T, '11:08:00'));
pay(R.r4, 20000, 'Debit Card', 'Advance', iso(addDays(T, -1), '16:20:00'), 'Zainab Yusuf');
pay(R.r5, 10000, 'Online Payment', 'Advance', iso(addDays(T, -10), '12:00:00'), 'Website', 'Website booking partial prepayment');
pay(R.r6, 10000, 'Online Payment', 'Advance', iso(addDays(T, -3), '19:45:00'), 'Website', 'Paid in full online');
pay(R.r7, 12000, 'Bank Transfer', 'Advance', iso(addDays(T, -5), '10:15:00'), 'Ali Raza');
pay(R.r8, 25000, 'Online Payment', 'Advance', iso(addDays(T, -7), '21:10:00'), 'Website', 'Suite deposit');
pay(R.r9, 40000, 'Online Payment', 'Advance', iso(addDays(T, -8), '16:52:00'), 'Website', 'Presidential stay — online');
pay(R.r12, 30000, 'Credit Card', 'Advance', iso(addDays(T, -4), '09:31:00'), 'Website', 'Presidential stay — online');
pay(R.r13, 10000, 'Cash', 'Advance', iso(addDays(T, -2), '12:40:00'));
// Full settlements for past stays (folio totals incl. 17% tax)
pay(R.r15, 9500 * 2 * 1.17 + 6500 * 1.17 - 8000, 'Credit Card', 'Settlement', iso(addDays(T, -1), '11:26:00'), 'Ali Raza', 'Balance settled at check-out. Invoice GA-INV-0451');
pay(R.r16, 14500 * 1.17 + 4400 * 1.17 - 21000, 'Credit Card', 'Settlement', iso(addDays(T, -1), '12:08:00'), 'Zainab Yusuf', 'Balance settled at check-out. Invoice GA-INV-0452');
pay(R.r17, (64000 + 2800 + 2300) * 1.17 - 3200 * 1.17 - 50000, 'Bank Transfer', 'Settlement', iso(addDays(T, -2), '12:35:00'), 'Layla Ahmed', 'Corporate account transfer. Invoice GA-INV-0453');
pay(R.r18, 18500 * 1.17 - 12000, 'Cash', 'Settlement', iso(addDays(T, -2), '10:52:00'), 'Ali Raza', 'Invoice GA-INV-0454');

/* ---------------- Housekeeping & maintenance ---------------- */
const task = (roomNo, type, status, staffName, priority = 'Normal', notes = '', created = iso(T, '07:30:00')) =>
  run('INSERT INTO housekeeping_tasks (room_id,task_type,status,assigned_to,priority,notes,created_at,started_at,completed_at) VALUES (?,?,?,?,?,?,?,?,?)',
    roomIds[roomNo], type, status, staffName ? userIds[staffName] : null, priority, notes, created,
    status !== 'Pending' ? iso(T, '08:00:00') : null,
    status === 'Cleaned' || status === 'Inspected' ? iso(T, '09:40:00') : null);
task('104', 'Cleaning', 'Pending', null, 'High', 'Departure clean — VIP arrival expected tomorrow on floor 1.');
task('305', 'Cleaning', 'In Progress', 'Sana Bibi', 'Normal', 'Deep clean bathroom grout if time allows.');
task('603', 'Cleaning', 'Cleaned', 'Rukhsana Kausar', 'Normal', 'Awaiting inspection before releasing to Available.');
task('202', 'Deep Cleaning', 'In Progress', 'Sana Bibi', 'Normal', 'Post-stay refresh after cancelled booking.');

run('INSERT INTO housekeeping_tasks (room_id,task_type,status,assigned_to,priority,notes,created_at,started_at,completed_at) VALUES (?,?,?,?,?,?,?,?,?)',
  roomIds['404'], 'Cleaning', 'Inspected', userIds['Rukhsana Kausar'], 'Normal', 'Departure clean, inspected and released.', iso(addDays(T, -2), '12:50:00'), iso(addDays(T, -2), '13:10:00'), iso(addDays(T, -2), '14:05:00'));
run('INSERT INTO housekeeping_tasks (room_id,task_type,status,assigned_to,priority,notes,created_at,started_at,completed_at) VALUES (?,?,?,?,?,?,?,?,?)',
  roomIds['503'], 'Cleaning', 'Inspected', userIds['Sana Bibi'], 'Normal', 'Departure clean, inspected and released.', iso(addDays(T, -2), '11:15:00'), iso(addDays(T, -2), '11:30:00'), iso(addDays(T, -2), '12:20:00'));

run('INSERT INTO maintenance_requests (room_id,title,detail,status,reported_by,created_at) VALUES (?,?,?,?,?,?)',
  roomIds['102'], 'Air conditioning not cooling', 'Guest reported weak cooling during the night. HVAC technician notified.', 'Open', 'Sana Bibi', iso(T, '07:10:00'));
run('INSERT INTO housekeeping_tasks (room_id,task_type,status,assigned_to,priority,notes,created_at) VALUES (?,?,?,?,?,?,?)',
  roomIds['102'], 'Maintenance', 'In Progress', userIds['Rukhsana Kausar'], 'High', 'Room moved to Maintenance until HVAC is verified.', iso(T, '08:20:00'));
run('INSERT INTO maintenance_requests (room_id,title,detail,status,reported_by,created_at,resolved_at) VALUES (?,?,?,?,?,?,?)',
  roomIds['301'], 'Dripping bathroom tap', 'Replaced washer and reseated valve.', 'Resolved', 'Bilal (Engineering)', iso(addDays(T, -1), '09:00:00'), iso(addDays(T, -1), '13:30:00'));

/* Room status for Reserved rooms stays; 304 No-show room freed */
setStatus('304', 'Available');
/* 202 was cancelled: room in Cleaning already. 104/305/603 Dirty via tasks ✓ */

/* ---------------- Activity log & notifications ---------------- */
const act = (type, message, actor, at) => run('INSERT INTO activity_log (type,message,actor,reservation_id,created_at) VALUES (?,?,?,?,?)', type, message, actor, null, at);
act('checkin', `Aman Khan checked in to room 101 (GA website booking).`, 'Ali Raza', iso(T, '13:10:00'));
act('payment', 'Advance payment of ₨ 15,000 received from Tariq Jamil (cash).', 'Ali Raza', iso(T, '11:08:00'));
act('reservation', 'Walk-in reservation created for Tariq Jamil — Business Class Room.', 'Ali Raza', iso(T, '10:40:00'));
act('reservation', 'Website booking received — Presidential Suite request pending room assignment.', 'System', iso(T, '08:22:00'));
act('checkin', 'David Chen checked in to room 402 (express check-in).', 'Ali Raza', iso(T, '09:48:00'));
act('payment', 'Settlement payment received. Invoice GA-INV-0452 issued.', 'Zainab Yusuf', iso(addDays(T, -1), '12:08:00'));
act('reservation', 'Website booking GA reference cancelled by guest.', 'System', iso(addDays(T, -2), '17:40:00'));
act('room', 'Room 102 moved to Maintenance — HVAC fault reported.', 'Sana Bibi', iso(T, '08:20:00'));
act('guest', 'VIP guest Nadia Hassan room pre-blocked for arrival today.', 'Ali Raza', iso(T, '07:55:00'));

const notif = (type, title, message, link, unread = 0, at = iso(T, '08:00:00')) =>
  run('INSERT INTO notifications (type,title,message,link,read,created_at) VALUES (?,?,?,?,?,?)', type, title, message, link, unread, at);
notif('reservation', 'New website reservation — Hina Raza', 'Deluxe Room request for 2 nights, room selection pending.', '#/reservations', 1);
notif('arrival', '4 arrivals today', 'Aman Khan, Bilal Ahmed, Nadia Hassan, Omar Sheikh are expected.', '#/front-desk', 1);
notif('departure', '1 departure today', 'Farah Qureshi departs room 601.', '#/front-desk', 1);
notif('housekeeping', '3 rooms need cleaning', 'Rooms 104, 305 and 603 are awaiting housekeeping.', '#/housekeeping', 1);
notif('maintenance', 'Room 102 maintenance open', 'Air conditioning fault — HVAC technician notified.', '#/housekeeping', 1);
notif('payment', 'Pending payments', '2 guest folios exceed ₨ 20,000 unpaid.', '#/billing', 1);
notif('payment', 'Payment reminder', 'Tonight: corporate folio for Tariq Jamil pending settlement.', '', 0);
notif('info', 'Night audit reminder', 'Run the night audit at 23:00 to close the business day.', '', 0, iso(T, '07:00:00'));

console.log('Seed complete ✔');
console.log(`Rooms: ${all('SELECT COUNT(*) c FROM rooms')[0].c} | Guests: ${all('SELECT COUNT(*) c FROM guests')[0].c} | Reservations: ${all('SELECT COUNT(*) c FROM reservations')[0].c}`);
console.log('Demo logins use password: demo123');
}

/* ---------------- CLI entry: node seed.js [--reset] ---------------- */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  seedDatabase({ reset: process.argv.includes('--reset') });
}
