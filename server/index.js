import express from 'express';
import cors from 'cors';
import { ApiError } from './lib.js';
import { today, get } from './db.js';
import { sessions } from './sessions.js';

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(cors({ origin: true, credentials: false }));

/* ---------- auth middleware ---------- */
export const auth = (req, res, next) => {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : (req.query.token || '');
  const user = sessions.get(token);
  if (!user) return res.status(401).json({ error: 'Session expired. Please sign in again.' });
  req.user = user;
  next();
};

/* ---------- error middleware (registered after all routes) ---------- */

/* ---------- Public reservation API (for the hotel website) ---------- */
const publicApi = (await import('./routes/public-api.js')).default;
app.use('/api/public', publicApi);

/* ---------- authenticated modules ---------- */
app.get('/api/health', (req, res) =>
  res.json({ ok: true, name: 'Grand Aurelia HMS API', time: new Date().toISOString(), today: today() }));
const MODULES = [
  'auth.js', 'dashboard.js', 'rooms.js', 'reservations.js',
  'ops.js', 'housekeeping.js', 'guests.js', 'reports.js', 'users.js',
];
for (const file of MODULES) {
  const mod = await import(`./routes/${file}`);
  // auth.js exposes public login/logout; everything else requires a session
  app.use('/api', file === 'auth.js' ? (req, res, next) => next() : auth, mod.default);
}

/* ---------- error middleware (must come last) ---------- */
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (!err?.status || err.status >= 500) console.error(err);
  if (err instanceof ApiError) return res.status(err.status).json({ error: err.message, details: err.details });
  if (String(err.message || '').includes('UNIQUE constraint failed: rooms.number')) {
    return res.status(409).json({ error: 'A room with this number already exists.' });
  }
  res.status(500).json({ error: err.message || 'Internal server error' });
});

/* ---------- bootstrap ---------- */
// Make sure the database exists and has its demo data. Used by the Vercel
// serverless entry (api/index.js) on cold start, and by local development.
export const ensureSeeded = async () => {
  try {
    if (get('SELECT COUNT(*) c FROM users').c > 0) return false;
    console.log('Empty database — seeding demo data…');
    const { seedDatabase } = await import('./seed.js');
    seedDatabase();
    return true;
  } catch (err) {
    console.error('ensureSeeded failed:', err);
    return false;
  }
};

export default app;

if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 4010;
  await ensureSeeded();
  app.listen(PORT, () => console.log(`Grand Aurelia HMS API ready → http://localhost:${PORT} (health: /api/health)`));
}
