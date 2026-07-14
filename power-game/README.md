# POWER — a political simulation (v0.1)

A spiritual revival of the old *Power* browser game by Oppressive Games: run for House, Senate, or President, build State/National Influence, campaign with rallies and ads, pass bills through a full House → Senate → President pipeline, and track your career on a public profile page.

This is a working prototype: Node/Express API + Postgres, with a vanilla HTML/CSS/JS frontend (no build step).

## What's built

- **Auth** — email/password, JWT in an httpOnly cookie.
- **Politicians** — one character per account: name, party, home state, bio, avatar URL, theme song link, public profile page with title history.
- **Resources** — Power (accrues over time, faster in office, soft cap at 50 like the original game), Funds, State Influence, National Influence, Reputation.
- **Campaign actions** — Rally, TV Ad, Fundraise, Attack Ad (with a chance of backfiring, like the original).
- **Elections** — House and Senate races are per-state/per-seat; President is national. Races auto-resolve when their close time passes (both lazily, on request, and via a background sweep every 30s — no cron setup needed). Winners take the seat, past officeholders roll into title history.
- **Congress** — sitting House members introduce bills; House votes; passing bills move to the Senate; passing Senate bills land on the President's desk to sign or veto.
- **Wire feed** — a scrolling ticker of recent election results and bill outcomes.

## What's not built yet (ideas for next passes)

- The **stock market** / player-run corporations from the original game — this is the single biggest missing piece and probably the next thing to build.
- Parties/caucuses as first-class objects (right now "party" is just a text field).
- Multiple countries (the original supported UK/Canada/Australia parliaments too).
- Cabinet appointments by the President.
- A real "term" / re-election cycle — right now races are seeded manually via `/api/races/seed`; there's no auto-scheduling of the next cycle.
- Profile pictures/theme songs are just URLs right now, no upload/hosting.

## Running it locally

Requirements: Node 18+, a Postgres database (local or hosted, e.g. Neon — same setup you used for Northpeak).

```bash
cd power-game
npm install
cp .env.example .env   # fill in your DATABASE_URL and a real JWT_SECRET
psql "$DATABASE_URL" -f src/schema.sql
npm start
```

Then open `http://localhost:3001`.

### Scripts

Add this to `package.json` if you want a `npm start`:
```json
"scripts": { "start": "node src/server.js" }
```

## API shape

Everything lives under `/api`:

- `POST /api/auth/register`, `/api/auth/login`, `/api/auth/logout`, `GET /api/auth/me`
- `POST /api/politicians` (create), `GET /api/politicians/me`, `GET /api/politicians/:id` (public profile), `GET /api/politicians` (directory)
- `POST /api/actions/rally|ad|fundraise|attack-ad`, `GET /api/actions/log`
- `GET /api/races`, `GET /api/races/:id`, `POST /api/races/:id/enter`, `POST /api/races/seed` (dev helper — no auth wall yet, lock this down before going public)
- `GET /api/congress/bills`, `GET /api/congress/bills/:id`, `POST /api/congress/bills`, `POST /api/congress/bills/:id/vote`, `POST /api/congress/bills/:id/decide`, `GET /api/congress/roster`
- `GET /api/feed`

## A note on `/api/races/seed`

Right now anyone can hit this to create a race — it's there so you (or I) can test the loop without building an admin panel first. Before you show this to real players, put it behind an admin check or a scheduled job that opens new races automatically (e.g. new House races open every N days per state).

## Deploying

Same shape as Northpeak: push to Vercel (or wherever), point `DATABASE_URL` at a Neon Postgres instance, run `schema.sql` against it once, set a real `JWT_SECRET`. The frontend is static files served by Express, so no separate frontend deploy needed.
