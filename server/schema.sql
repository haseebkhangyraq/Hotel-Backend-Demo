-- Grand Aurelia HMS database schema (SQLite)
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL,                -- Administrator | Manager | Receptionist | Housekeeping | Accountant
  password_hash TEXT NOT NULL,
  phone TEXT DEFAULT '',
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS room_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT DEFAULT '',
  base_rate REAL NOT NULL DEFAULT 0,
  max_occupancy INTEGER NOT NULL DEFAULT 2,
  size_sqm INTEGER DEFAULT 32,
  bed TEXT DEFAULT 'King bed',
  amenities TEXT DEFAULT '[]'         -- JSON array
);

CREATE TABLE IF NOT EXISTS rooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number TEXT UNIQUE NOT NULL,
  category_id INTEGER NOT NULL REFERENCES room_categories(id),
  floor INTEGER NOT NULL DEFAULT 1,
  max_occupancy INTEGER NOT NULL DEFAULT 2,
  rate REAL,                          -- optional override; falls back to category base_rate
  status TEXT NOT NULL DEFAULT 'Available', -- Available | Available | Reserved | Occupied | Dirty | Cleaning | Maintenance
  amenities TEXT DEFAULT '[]',
  notes TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS guests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  nationality TEXT DEFAULT '',
  id_type TEXT DEFAULT '',            -- CNIC | Passport | Driving Licence
  id_number TEXT DEFAULT '',
  vip INTEGER DEFAULT 0,
  preferences TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reservations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  confirmation_no TEXT UNIQUE NOT NULL,
  guest_id INTEGER NOT NULL REFERENCES guests(id),
  category_id INTEGER NOT NULL REFERENCES room_categories(id),
  room_id INTEGER REFERENCES rooms(id),
  check_in TEXT NOT NULL,             -- YYYY-MM-DD
  check_out TEXT NOT NULL,
  adults INTEGER DEFAULT 2,
  children INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Confirmed', -- Confirmed | Pending | Checked-in | Checked-out | Cancelled | No-show
  source TEXT NOT NULL DEFAULT 'Reception', -- Website | Reception | Phone | Walk-in
  rate_per_night REAL NOT NULL DEFAULT 0,
  discount REAL DEFAULT 0,
  tax_rate REAL DEFAULT 0.17,
  advance_payment REAL DEFAULT 0,
  special_requests TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  breakfast_plan TEXT DEFAULT 'none',
  id_doc_type TEXT DEFAULT '',
  id_doc_number TEXT DEFAULT '',
  created_by TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  checked_in_at TEXT,
  checked_out_at TEXT,
  cancelled_at TEXT,
  cancel_reason TEXT,
  invoice_no TEXT
);

CREATE TABLE IF NOT EXISTS folio_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reservation_id INTEGER NOT NULL REFERENCES reservations(id),
  type TEXT NOT NULL DEFAULT 'room',  -- room | food | laundry | minibar | spa | transfer | other
  description TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  unit_price REAL NOT NULL DEFAULT 0,
  amount REAL NOT NULL DEFAULT 0,
  posted_at TEXT DEFAULT (datetime('now')),
  posted_by TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reservation_id INTEGER REFERENCES reservations(id),
  amount REAL NOT NULL DEFAULT 0,
  method TEXT NOT NULL DEFAULT 'Cash', -- Cash | Credit Card | Debit Card | Bank Transfer | Online Payment
  purpose TEXT NOT NULL DEFAULT 'Settlement', -- Advance | Settlement | Extra Charges
  paid_at TEXT DEFAULT (datetime('now')),
  received_by TEXT DEFAULT '',
  note TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS housekeeping_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id INTEGER NOT NULL REFERENCES rooms(id),
  task_type TEXT NOT NULL DEFAULT 'Cleaning', -- Cleaning | Maintenance | Deep Cleaning | Inspection
  status TEXT NOT NULL DEFAULT 'Pending',     -- Pending | In Progress | Cleaned | Inspected
  assigned_to INTEGER REFERENCES users(id),
  priority TEXT DEFAULT 'Normal',             -- Low | Normal | High
  notes TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  started_at TEXT,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS maintenance_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id INTEGER NOT NULL REFERENCES rooms(id),
  title TEXT NOT NULL,
  detail TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Open',        -- Open | In Progress | Resolved
  reported_by TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  resolved_at TEXT
);

CREATE TABLE IF NOT EXISTS activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL DEFAULT 'info',          -- info | reservation | checkin | checkout | payment | housekeeping | room | guest
  message TEXT NOT NULL,
  actor TEXT DEFAULT 'System',
  reservation_id INTEGER REFERENCES reservations(id),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL DEFAULT 'info',          -- reservation | arrival | departure | payment | housekeeping | maintenance | info
  title TEXT NOT NULL,
  message TEXT DEFAULT '',
  link TEXT DEFAULT '',
  read INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_res_checkin ON reservations(check_in);
CREATE INDEX IF NOT EXISTS idx_res_status ON reservations(status);
CREATE INDEX IF NOT EXISTS idx_res_guest ON reservations(guest_id);
CREATE INDEX IF NOT EXISTS idx_folio_res ON folio_items(reservation_id);
CREATE INDEX IF NOT EXISTS idx_pay_res ON payments(reservation_id);
