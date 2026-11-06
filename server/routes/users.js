import express from 'express';
import { run, get, all } from '../db.js';
import { ApiError, sha } from '../lib.js';

const router = express.Router();

router.get('/users', (req, res) => {
  res.json({
    users: all(`SELECT id, name, email, role, phone, active, created_at FROM users ORDER BY id`),
  });
});

router.post('/users', (req, res) => {
  const b = req.body || {};
  if (!b.name || !b.email || !b.role) throw new ApiError(422, 'Name, email and role are required.');
  if (get('SELECT id FROM users WHERE lower(email)=lower(?)', String(b.email).trim())) {
    throw new ApiError(409, 'A user with this email already exists.');
  }
  const r = run(`INSERT INTO users (name,email,role,password_hash,phone) VALUES (?,?,?,?,?)`,
    b.name.trim(), String(b.email).trim(), b.role, sha(b.password || 'demo123'), b.phone || '');
  res.status(201).json({ user: get('SELECT id,name,email,role,phone,active,created_at FROM users WHERE id=?', r.lastInsertRowid) });
});

router.put('/users/:id', (req, res) => {
  const u = get('SELECT * FROM users WHERE id=?', Number(req.params.id));
  if (!u) throw new ApiError(404, 'User not found.');
  const b = req.body || {};
  run(`UPDATE users SET name=?, email=?, role=?, phone=?, active=? WHERE id=?`,
    b.name ?? u.name, b.email ?? u.email, b.role ?? u.role, b.phone ?? u.phone,
    (b.active ?? u.active) ? 1 : 0, u.id);
  if (b.password) run('UPDATE users SET password_hash=? WHERE id=?', sha(b.password), u.id);
  res.json({ user: get('SELECT id,name,email,role,phone,active,created_at FROM users WHERE id=?', u.id) });
});

router.delete('/users/:id', (req, res) => {
  const u = get('SELECT * FROM users WHERE id=?', Number(req.params.id));
  if (!u) throw new ApiError(404, 'User not found.');
  if (u.role === 'Administrator' && get(`SELECT COUNT(*) c FROM users WHERE role='Administrator' AND active=1`).c <= 1) {
    throw new ApiError(409, 'At least one active Administrator is required.');
  }
  run('UPDATE users SET active=0 WHERE id=?', u.id);
  res.json({ ok: true });
});

export default router;
