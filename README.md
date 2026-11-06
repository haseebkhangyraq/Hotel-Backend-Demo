# Grand Aurelia HMS — Hotel Management Backend & Dashboard

Full hotel-management system: REST API + staff dashboard for **Grand Aurelia Hotel & Resort**.
Covers reservations, front desk (check-in / check-out), rooms & categories, housekeeping,
guest CRM, billing & folios, reports, staff/user management and a public booking API for the hotel website.

> This is the internal management suite. The public hotel **website is a separate project** and is not
> part of this repo — it talks to the API documented at the bottom.

---

## Quick start

Requirements: Node.js 22+ (see Prerequisites section below).

Run the Windows launcher (installs nothing, uses the same scripts):

```
start-hms.bat          ->  option 1: start API + management suite
```

Or manually:

| Where            | Command             | Serves                                |
| ---------------- | ------------------- | ------------------------------------- |
| `server/`        | `node index.js`     | REST API on `http://localhost:4010`   |
| `client/`        | `npm install` once, then `npm run dev` | Management suite on `http://localhost:5173` (proxies `/api` → 4010) |
| `server/`        | `node seed.js --reset` | Re-seed / reset the demo database  |

## Prerequisites

Node **22** or newer is required for the built-in `node:sqlite` module — check with `node -v`.
On Windows, install from <https://nodejs.org>.

The database is a single SQLite file (`server/hms.db`), created automatically from `server/schema.sql`
on first run.

## Demo logins  (password for all: `demo123`)

| Role          | Email | Access |
| ------------- | ----- | ------ |
| Administrator | `umar.farooq@aurelia.pk` | Everything |
| Manager       | `layla.ahmed@aurelia.pk` | Everything |
| Receptionist  | `ali.raza@aurelia.pk` | Dashboard, reservations, front desk, rooms, guests, billing |
| Housekeeping  | `sana.bibi@aurelia.pk` | Housekeeping board, rooms |
| Accountant    | `fabeha.naveed@aurelia.pk` | Dashboard, billing, reports, reservations |

## Modules

- **Dashboard** — live occupancy, revenue/occupancy charts, today's arrivals & departures, activity timeline.
- **Reservations** — CRUD, filters, cancellation, no-show, printable confirmations.
- **Reservation Calendar** — month view per room/floor, colour-coded by status.
- **Front Desk** — arrivals board, departures, in-house list, walk-in registration.
- **Check-in wizard** — verify → assign room → ID scan → payment; prints a registration receipt.
- **Check-out** — folio, extra charges, settlement, printable invoice; room goes Dirty + auto housekeeping task.
- **Rooms & Suites** — grid/list, room CRUD, category CRUD with rates, availability checker.
- **Housekeeping** — Kanban board (Pending → In Progress → Cleaned → Inspected releases the room), maintenance requests.
- **Guests** — CRM profiles, VIP, stay history, lifetime value.
- **Billing** — in-house folios, payment ledger with CSV export, revenue summary.
- **Reports** — occupancy, revenue, arrivals/departures, reservations, rooms, guest history, payments, cancellations; CSV export + print.
- **Staff & Users** — user CRUD, roles and permission matrix.

## Data protection rules enforced by the API

- Double-booking: overlapping Confirmed/Checked-in reservations for the same room are rejected
  (server-side `isRoomBookable`, including on create, edit, and check-in room swaps).
- Fiscal: 17% GST is computed on `(room total − discount)`; balances never go negative in folio math.
- Housekeeping: rooms only return to service after an `Inspected` task; Maintenance blocks booking.
- No-show / cancellation releases the room immediately and logs the reason in the activity trail.

## Re-seeding demo data

```
cd server
node seed.js --reset
```

Seeds: 32 rooms across 6 categories (1–2 of each on each numbered floor), 20 guests, ~21 reservations
anchored to **today** (arrivals today, in-house, upcoming, past stays), housekeeping tasks,
daily payments for the last 14 days. Re-seed any time you demo on a new day so dates line up.

After a fresh seed, one sample **website booking** can be created through the public API (see below) —
re-run the `curl`/example from the section *Public booking API* to add Daniel Weber's booking back.

---

## Public booking API

For the hotel website (public, unauthenticated, but an API key is required). The website
only talks to the `/api/public/*` endpoints below.

Header: `x-api-key: ga_pk_web_demo_2026`

### `GET /api/public/availability`

Query: `?checkIn=2026-11-09&checkOut=2026-11-13` → 200 with availability per category.

### `GET /api/public/categories`

List of room categories with rates, description and amenities (currency is PKR).

### `POST /api/public/reservations`

Create a booking from the website. Body:

```json
{
  "guest": {
    "fullName":  "Daniel Weber",
    "email":     "d.weber@webmail.de",
    "phone":     "+49 170 555 0198",
    "nationality": "United States"
  },
  "categorySlug": "deluxe-room",
  "checkIn":  "2026-11-09",
  "checkOut": "2026-11-13",
  "adults": 2,
  "children": 0,
  "specialRequests": "High floor, quiet room. Late arrival 22:30.",
  "advancePayment": 15000,
  "paymentMethod": "Credit Card"
}
```

Response (200):

```json
{
  "confirmationNo": "GA-20261106-5202",
  "reservation": {
    "confirmationNo": "GA-20261106-5202",
    "status": "Confirmed",
    "guest":  { "name": "Daniel Weber", "email": "d.weber@webmail.de" },
    "category": "Deluxe Room",
    "room": "301",
    "checkIn": "2026-11-09",
    "checkOut": "2026-11-13",
    "nights": 4,
    "totalDue": 67860,
    "advancePaid": 15000,
    "balanceDue": 52860
  }
}
```

### `GET /api/public/reservations/:confirmationNo`

Fetch a booking by reference (e.g. `GA-20261106-5202`) — guest self-service view.

### `POST /api/public/reservations/:confirmationNo/cancel`

Guest-side cancellation with a reason.

## Authentication for the dashboard / internal API

`POST /api/auth/login` `{ email, password }` → `{ token, user }`.
Send the token on every internal call: `Authorization: Bearer <token>`.
Sessions expire; `POST /api/auth/logout` invalidates the token.

Role enforcement is both **UI-level** (which nav items render) and **API-level** (which routes answer).

---

## Project layout

```
server/           Express REST API (ESM, node:sqlite, no external DB)
  index.js        app bootstrap, middleware order, mountpoints
  db.js           sqlite singleton + helpers (get/all/run)
  lib.js          reservation + folio business logic
  schema.sql      full schema
  seed.js         demo data generator (--reset re-seeds)
  routes/         auth, dashboard, rooms, reservations, ops (front desk),
                  housekeeping, guests, reports, users, public-api
client/           Staff dashboard (React + TypeScript + Vite + Tailwind v4)
  src/pages/      one module per file
  src/ui/         in-house shadcn-style component kit
  src/lib/        api client, types, formatters
```

Internal API base URL is `/api`, same port as listed above.
For the ui Clear favour: pkr currency formatting (e.g. `₨ 14,500`), 17% GST everywhere.

---

## Troubleshooting

**`node:sqlite` errors or "not found"** → Node < 22. Upgrade Node.

**Port already in use** → stop the previous `node` processes, or change `PORT` in `server/index.js`,
and `server.port` in `client/vite.config.ts`.

**Data looks stale (arrivals = 0)** → run `npm run seed` (or `node server/seed.js --reset`).
Seed dates are relative to the run date, so re-seed on a new demo day.

---

## Deploy to Vercel

The project is fully serverless-ready: the Express API is exported as one Vercel
function and the dashboard is a static React build.

### 1. Push to a git repository

The machine this was developed on does not have Git installed. Install
Git for Windows (https://git-scm.com/download/win), then from the project root:

```powershell
git init
git add -A
git commit -m "Grand Aurelia HMS — initial commit"
git remote add origin https://github.com/<your-user>/<repo>.git
git push -u origin main
```

(Verify the local default branch is `main` before pushing: `git branch -M main`.)

### 2. Import into Vercel

1. In Vercel, **Add New → Project** and import the GitHub repository.
2. Framework preset: the included `vercel.json` handles everything
   (installs deps, builds `client/`, serves `client/dist`, routes `/api/*`
   to the serverless function, and rewrites the rest to `index.html` for
   the SPA). No manual overrides needed.
3. Set the environment variables below.

### 3. Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `SESSION_SECRET` | Recommended | Secret used to sign login tokens. Set a long random string in production — with the default demo secret, anyone can (only) forge demo sessions. |
| `DB_PATH` | Optional | Defaults to `/tmp/hms.db` on Vercel. |

### 4. Important: database persistence on Vercel

- On cold start the API automatically creates `/tmp/hms.db` and seeds it
  with the full demo dataset (`ensureSeeded` in `server/index.js`), so a
  deployed instance is instantly demo-able — no manual step required.
- **However, `/tmp` is ephemeral and per-instance**: every Lambda
  instance keeps its own copy, and data is lost when the platform starts
  a new one. Reservations stored through the deployed dashboard will not
  survive restarts or be shared between concurrent instances.
- For real production data, pair the API with a hosted database that has
  an HTTP/SQLite-compatible driver (e.g. Turso, or Postgres + a data
  client). The seed script can still be used to bootstrap the initial
  dataset once.

### 5. Local-vs-production parity

| | Local dev | Vercel |
| --- | --- | --- |
| Database | `server/../data/hms.db` (persistent) | `/tmp/hms.db` (ephemeral, auto-seeded) |
| Start | `start-hms.bat` or `npm run dev` + `npm run dev:client` | `vercel dev` or the deployed URL |
| Login sessions | In-memory + signed tokens | Signed tokens (work across instances) |
