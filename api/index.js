// Vercel serverless entry point for the Grand Aurelia HMS API.
// The Express app is exported directly so Vercel routes /api/* here.
import app, { ensureSeeded } from '../server/index.js';

// Cold start: create the SQLite database in /tmp (Vercel's only writable
// directory) and populate it with demo data if it is empty.
await ensureSeeded();

export default app;
