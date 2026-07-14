# STATESMAN — a political simulation (v0.2)

A spiritual revival of the old *Power* browser game by Oppressive Games: run for House, Senate, or President, build State/National Influence, campaign with rallies and ads, pass bills through a full House → Senate → President pipeline, and track your career on a public profile page.

Node/Express API + Postgres backend, vanilla HTML/CSS/JS frontend (no build step), dark noir visual style with a landing page.

## What's new in this pass

- **New visual direction**, inspired directly by the original game's actual UI (dark top nav, light gray body, white cards, circular party badges, illustrated action cards, fixed bottom resource bar). No noir theme anymore. I couldn't use the real screenshots' photos or party logos (copyrighted/trademarked), so everything's rebuilt as original flat-illustration SVGs in the same spirit — Capitol illustrations, action-card art, generic circle-badge party marks.
- **Funds now accrue hourly too**, not just Power — same lazy-catch-up mechanism, faster while holding office.
- **Elections now run on a real cycle: every Tuesday and Thursday.** A daily check (admin-triggered manually, or via a once-a-day Vercel Cron job — Hobby-plan compatible) opens House and Senate races for any state with active politicians, and periodically opens a Presidential race, skipping seats that already have a recent/open race so it doesn't spam duplicates.
- Rebranded to Statesman, admin accounts with a protected race-seeding endpoint, and an Admin tab with both "run the cycle now" and "open a specific race" controls.

## Creating your admin account

Run this against whichever database `DATABASE_URL` points at (works the same locally or against Neon):

```bash
node scripts/create-admin.js you@example.com "choose-your-own-password"
```

Don't paste real passwords into chat with me going forward — run this locally/in your own terminal and I'll never see it. If you ever do paste a real credential anywhere, rotate it immediately.

This creates the account if it doesn't exist, or promotes + resets the password if it does. Once logged in with that account, you'll see an **Admin** tab in the app for opening new races.

## What's built

- **Auth** — email/password, JWT in an httpOnly cookie, admin flag on the user record.
- **Politicians** — one character per account: name, party, home state, bio, avatar URL, theme song link, public profile page with title history.
- **Resources** — Power (accrues over time, faster in office, soft cap at 50 like the original game), Funds, State Influence, National Influence, Reputation.
- **Campaign actions** — Rally, TV Ad, Fundraise, Attack Ad (with a chance of backfiring, like the original).
- **Elections** — House and Senate races are per-state/per-seat; President is national. Races auto-resolve when their close time passes — lazily on request, and via `/api/races/sweep`, which Vercel Cron hits every 5 minutes so races resolve even with zero traffic.
- **Congress** — sitting House members introduce bills; House votes; passing bills move to the Senate; passing Senate bills land on the President's desk to sign or veto.
- **Wire feed** — a scrolling ticker of recent election results and bill outcomes.
- **Admin tooling** — protected race-seeding, gated by an `is_admin` flag checked against the database on every request (so revoking admin takes effect immediately, not just on next login).

## What's not built yet

- The **stock market** / player-run corporations from the original game — still the biggest missing piece.
- Parties/caucuses as first-class objects (right now "party" is a text field).
- Multiple countries (original supported UK/Canada/Australia parliaments too).
- Cabinet appointments by the President.
- Auto-scheduled election cycles — races are currently opened manually via the Admin tab; there's no recurring "next term opens automatically" logic yet.
- Real avatar/audio hosting — avatar and theme song are just URL fields right now.

## Running it locally

Requirements: Node 18+, a Postgres database (local or hosted, e.g. Neon).

```bash
npm install
cp .env.example .env   # fill in your DATABASE_URL and a real JWT_SECRET
psql "$DATABASE_URL" -f src/schema.sql
node scripts/create-admin.js you@example.com "your-password"
npm start
```

Open `http://localhost:3001`.

## Deploying to Vercel

This is now set up to actually run correctly on Vercel (the earlier version used `app.listen()`, which doesn't behave as a normal server on serverless — that's fixed):

1. Push this code to your repo / redeploy your Vercel project from it.
2. Vercel → Project Settings → Environment Variables → add `DATABASE_URL` (your Neon pooled connection string) and `JWT_SECRET`.
3. Run `schema.sql` against your Neon database (Neon's SQL Editor, or `psql` from your machine) if you haven't already — and re-run it after this update, since it adds an `is_admin` column:
   ```sql
   ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;
   ```
4. Run `node scripts/create-admin.js you@example.com "your-password"` from your own machine, pointed at the same `DATABASE_URL`, to create your admin account.
5. Redeploy.

`vercel.json` is included and handles routing everything (API + static frontend) through the single Express app, plus a once-daily cron hitting `/api/races/cycle` at 14:00 UTC — this is within Vercel Hobby's once-per-day limit, and the handler itself no-ops unless it's actually Tuesday or Thursday, so it's safe to leave running every day.

## API shape

Everything lives under `/api`:

- `POST /api/auth/register`, `/api/auth/login`, `/api/auth/logout`, `GET /api/auth/me`
- `POST /api/politicians` (create), `GET /api/politicians/me`, `GET /api/politicians/:id` (public profile), `GET /api/politicians` (directory)
- `POST /api/actions/rally|ad|fundraise|attack-ad`, `GET /api/actions/log`
- `GET /api/races`, `GET /api/races/:id`, `POST /api/races/:id/enter`, `POST /api/races/seed` (**admin only**, opens one specific race), `GET|POST /api/races/sweep` (resolves expired races), `GET|POST /api/races/cycle` (runs the Tuesday/Thursday election cycle; no-ops on other days)
- `GET /api/congress/bills`, `GET /api/congress/bills/:id`, `POST /api/congress/bills`, `POST /api/congress/bills/:id/vote`, `POST /api/congress/bills/:id/decide`, `GET /api/congress/roster`
- `GET /api/feed`
