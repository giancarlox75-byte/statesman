const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { reconcilePower } = require('../engine/power');

const router = express.Router();

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA',
  'ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK',
  'OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'
];

// Create a politician (one active politician per user, for now)
router.post('/', requireAuth, async (req, res) => {
  try {
    const { name, party, state, bio, avatar_url, theme_song } = req.body;
    if (!name || !state) return res.status(400).json({ error: 'Name and state are required.' });
    if (!US_STATES.includes(state)) return res.status(400).json({ error: 'Invalid state code.' });

    const existing = await db.query('SELECT id FROM politicians WHERE user_id = $1', [req.userId]);
    if (existing.rows.length) return res.status(409).json({ error: 'You already have a politician. Play them!' });

    const { rows } = await db.query(
      `INSERT INTO politicians (user_id, name, party, state, bio, avatar_url, theme_song)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [req.userId, name, party || 'Independent', state, bio || '', avatar_url || '', theme_song || '']
    );
    res.json({ politician: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not create politician.' });
  }
});

// My politician (reconciles power first so the number is always current)
router.get('/me', requireAuth, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT id FROM politicians WHERE user_id = $1', [req.userId]);
    if (!rows.length) return res.status(404).json({ error: 'No politician yet.' });
    const pol = await reconcilePower(rows[0].id);
    const history = await db.query(
      'SELECT * FROM title_history WHERE politician_id = $1 ORDER BY term_start DESC',
      [pol.id]
    );
    res.json({ politician: pol, titleHistory: history.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load politician.' });
  }
});

// Public profile page: position, past titles, picture, song
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM politicians WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found.' });
    const history = await db.query(
      'SELECT * FROM title_history WHERE politician_id = $1 ORDER BY term_start DESC',
      [req.params.id]
    );
    const pol = rows[0];
    // public view: hide funds/exact power from prying eyes? Keep transparent for now, like the original game.
    res.json({ politician: pol, titleHistory: history.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load profile.' });
  }
});

// Leaderboard / directory
router.get('/', async (req, res) => {
  try {
    const { state, office } = req.query;
    let query = 'SELECT id, name, party, state, avatar_url, current_office, national_influence, state_influence FROM politicians WHERE 1=1';
    const params = [];
    if (state) { params.push(state); query += ` AND state = $${params.length}`; }
    if (office) { params.push(office); query += ` AND current_office = $${params.length}`; }
    query += ' ORDER BY national_influence DESC LIMIT 100';
    const { rows } = await db.query(query, params);
    res.json({ politicians: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load directory.' });
  }
});

module.exports = router;
