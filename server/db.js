import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// On Vercel the filesystem is read-only except for /tmp, so default the
// SQLite file there when running as a serverless function.
export const DB_PATH = process.env.DB_PATH || (process.env.VERCEL
  ? '/tmp/hms.db'
  : path.join(__dirname, '..', 'data', 'hms.db'));
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');
db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));

export const run = (sql, ...params) => db.prepare(sql).run(...params);
export const get = (sql, ...params) => db.prepare(sql).get(...params);
export const all = (sql, ...params) => db.prepare(sql).all(...params);

export const logActivity = (type, message, actor = 'System', reservationId = null) => {
  run(
    'INSERT INTO activity_log (type, message, actor, reservation_id) VALUES (?,?,?,?)',
    type, message, actor, reservationId
  );
};

export const notify = (type, title, message, link = '') => {
  run(
    'INSERT INTO notifications (type, title, message, link) VALUES (?,?,?,?)',
    type, title, message, link
  );
};

export const today = () => new Date().toISOString().slice(0, 10);
export const nowISO = () => new Date().toISOString().replace('T', ' ').slice(0, 19);
export const addDays = (iso, n) => {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export const nightsBetween = (a, b) => {
  const d1 = new Date(a + 'T12:00:00Z').getTime();
  const d2 = new Date(b + 'T12:00:00Z').getTime();
  return Math.max(1, Math.round((d2 - d1) / 86400000));
};

export const TAX_RATE = 0.17;
export const HOTEL_NAME = 'Grand Aurelia Hotel & Resort';
export const API_KEY = process.env.WEBSITE_API_KEY || 'ga_pk_web_demo_2026';
export const CONF_PREFIX = 'GA';
