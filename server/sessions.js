// Session store: fast in-memory map PLUS stateless HMAC-signed tokens so that
// sessions survive across serverless instances (Vercel) and process restarts.
import crypto from 'node:crypto';

const SESSION_SECRET = process.env.SESSION_SECRET || 'grand-aurelia-demo-secret-2026';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const b64url = (buf) => buf.toString('base64url');
const hmac = (data) => crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');

/** Create a stateless, signed session token for a user. */
export const signSession = (user) => {
  const payload = { ...user, exp: Date.now() + SESSION_TTL_MS };
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  return `${body}.${hmac(body)}`;
};

/** Verify a signed token; returns the user payload or null. */
export const verifySession = (token) => {
  if (!token || typeof token !== 'string' || token.includes(';')) return null;
  const dot = token.lastIndexOf('.');
  if (dot < 1) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = hmac(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
};

// Map-like store. A hit = live local session; a miss falls back to verifying
// the token's signature so other instances / restarts accept the same token.
class SessionStore {
  #map = new Map();
  set(token, user) { this.#map.set(token, user); return this; }
  get(token) {
    if (token && this.#map.has(token)) {
      const cached = this.#map.get(token);
      if (typeof cached.exp !== 'number' || cached.exp >= Date.now()) return cached;
      this.#map.delete(token);
    }
    const verified = verifySession(token);
    if (verified) this.#map.set(token, verified);
    return verified ?? undefined;
  }
  has(token) { return this.get(token) !== undefined; }
  delete(token) { return this.#map.delete(token); }
  /** logout should also be safe on a tampered token — no-op */
  get size() { return this.#map.size; }
}

export const sessions = new SessionStore();
