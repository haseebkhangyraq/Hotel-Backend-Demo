import express from 'express';
import { sha } from './../lib.js';
import { get, all } from './../db.js';
import { sessions, signSession } from '../sessions.js';

const router = express.Router();

router.post('/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(422).json({ error: 'Email and password are required.' });
  const user = get('SELECT * FROM users WHERE lower(email)=lower(?) AND active=1', String(email).trim());
  if (!user || user.password_hash !== sha(password)) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }
  const sessionUser = { id: user.id, name: user.name, email: user.email, role: user.role };
  const token = signSession(sessionUser);
  sessions.set(token, sessionUser);
  res.json({ token, user: sessionUser });
});

router.post('/auth/logout', (req, res) => {
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) sessions.delete(h.slice(7));
  res.json({ ok: true });
});

export default router;
