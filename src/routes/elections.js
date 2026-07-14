const express = require('express');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { reconcilePower } = require('../engine/power');

const router = express.Router();

const ENTRY_COST = { house: 5, senate: 10, president: 20 };

async function getMyPolitician(userId) {
  const { rows } = await db.query('SELECT id FROM politicians WHERE user_id = $1', [userId]);
  if (!rows.length) return null;
  return reconcilePower(rows[0].id);
}

// Resolve a race if its close time has passed and it hasn't been resolved yet.
async function resolveIfExpired(race) {
  if (race.status !== 'open' || new Date(race.closes_at) > new Date()) return race;

  const candidates = await db.query(
    `SELECT c.politician_id, p.state_influence, p.national_influence
     FROM candidates c JOIN politicians p ON p.id = c.politician_id
     WHERE c.race_id = $1`,
    [race.id]
  );

  if (!candidates.rows.length) {
    const { rows } = await db.query(
      `UPDATE races SET status = 'closed' WHERE id = $1 RETURNING *`, [race.id]
    );
    return rows[0];
  }

  const scored = candidates.rows.map(c => {
    const base = race.office_type === 'president' ? Number(c.national_influence) : Number(c.state_influence);
    const noise = Math.random() * 10;
    return { politicianId: c.politician_id, score: base + noise };
  });
  scored.sort((a, b) => b.score - a.score);
  const winnerId = scored[0].politicianId;

  // Vacate anyone currently holding this exact seat
  await db.query(
    `UPDATE politicians SET current_office = NULL, current_office_state = NULL, current_office_seat = NULL
     WHERE current_office = $1 AND (current_office_state = $2 OR $2 IS NULL) AND current_office_seat = $3`,
    [race.office_type, race.state, race.seat_number]
  );
  await db.query(
    `UPDATE title_history SET term_end = now()
     WHERE politician_id IN (
       SELECT id FROM politicians WHERE current_office = $1
     ) AND term_end IS NULL`,
    [race.office_type]
  );

  await db.query(
    `UPDATE politicians
     SET current_office = $1, current_office_state = $2, current_office_seat = $3,
         national_influence = national_influence + 5, reputation = GREATEST(0, reputation - 5)
     WHERE id = $4`,
    [race.office_type, race.state, race.seat_number, winnerId]
  );
  await db.query(
    `INSERT INTO title_history (politician_id, title, state, seat_number, term_start)
     VALUES ($1, $2, $3, $4, now())`,
    [winnerId, race.office_type, race.state, race.seat_number]
  );

  // record final vote shares
  const total = scored.reduce((s, c) => s + c.score, 0) || 1;
  for (const c of scored) {
    await db.query('UPDATE candidates SET vote_share = $1 WHERE race_id = $2 AND politician_id = $3',
      [(c.score / total) * 100, race.id, c.politicianId]);
  }

  const { rows } = await db.query(
    `UPDATE races SET status = 'closed', winner_id = $1 WHERE id = $2 RETURNING *`,
    [winnerId, race.id]
  );
  return rows[0];
}

router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM races ORDER BY closes_at DESC LIMIT 100');
    const resolved = [];
    for (const r of rows) resolved.push(await resolveIfExpired(r));
    res.json({ races: resolved });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load races.' });
  }
});

async function sweepExpiredRaces() {
  const { rows } = await db.query(`SELECT * FROM races WHERE status = 'open' AND closes_at <= now()`);
  for (const r of rows) {
    try { await resolveIfExpired(r); } catch (err) { console.error('Race sweep error:', err); }
  }
  return rows.length;
}

// Vercel Cron (or any external scheduler) hits this to resolve expired races.
// Lazy resolution on GET /api/races/:id already covers most cases; this is a backstop.
// Vercel Cron only sends GET requests, so this accepts both GET and POST.
// Registered before /:id so "sweep" isn't swallowed as a race id.
router.all('/sweep', async (req, res) => {
  try {
    const count = await sweepExpiredRaces();
    res.json({ resolved: count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sweep failed.' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM races WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Race not found.' });
    const race = await resolveIfExpired(rows[0]);
    const candidates = await db.query(
      `SELECT c.*, p.name, p.party, p.avatar_url FROM candidates c
       JOIN politicians p ON p.id = c.politician_id WHERE c.race_id = $1 ORDER BY c.vote_share DESC`,
      [race.id]
    );
    res.json({ race, candidates: candidates.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load race.' });
  }
});

// Enter a race
router.post('/:id/enter', requireAuth, async (req, res) => {
  try {
    const pol = await getMyPolitician(req.userId);
    if (!pol) return res.status(404).json({ error: 'No politician yet.' });

    const raceRes = await db.query('SELECT * FROM races WHERE id = $1', [req.params.id]);
    if (!raceRes.rows.length) return res.status(404).json({ error: 'Race not found.' });
    let race = raceRes.rows[0];
    race = await resolveIfExpired(race);
    if (race.status !== 'open') return res.status(400).json({ error: 'This race has closed.' });

    if (race.office_type !== 'president' && race.state !== pol.state) {
      return res.status(400).json({ error: `Only politicians based in ${race.state} can enter this race.` });
    }

    const cost = Number(race.entry_cost_power);
    if (pol.power < cost) return res.status(400).json({ error: `Not enough power. Entering costs ${cost}.` });

    const dup = await db.query('SELECT id FROM candidates WHERE race_id = $1 AND politician_id = $2', [race.id, pol.id]);
    if (dup.rows.length) return res.status(409).json({ error: "You're already in this race." });

    await db.query('UPDATE politicians SET power = power - $1 WHERE id = $2', [cost, pol.id]);
    await db.query('INSERT INTO candidates (race_id, politician_id) VALUES ($1, $2)', [race.id, pol.id]);

    res.json({ ok: true, race });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not enter race.' });
  }
});

// Seed / open a new race — admin only.
router.post('/seed', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { office_type, state, seat_number, days_open } = req.body;
    if (!['house', 'senate', 'president'].includes(office_type)) {
      return res.status(400).json({ error: 'office_type must be house, senate, or president.' });
    }
    if (office_type !== 'president' && !state) {
      return res.status(400).json({ error: 'state is required for house/senate races.' });
    }
    const daysOpen = days_open === undefined || days_open === null ? 7 : Number(days_open);
    const closesAt = new Date(Date.now() + daysOpen * 24 * 60 * 60 * 1000);
    const { rows } = await db.query(
      `INSERT INTO races (office_type, state, seat_number, entry_cost_power, closes_at)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [office_type, office_type === 'president' ? null : state, seat_number || 1, ENTRY_COST[office_type], closesAt]
    );
    res.json({ race: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not create race.' });
  }
});

module.exports = router;
module.exports.sweepExpiredRaces = sweepExpiredRaces;
