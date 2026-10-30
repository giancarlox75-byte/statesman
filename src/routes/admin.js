// Admin tools: force the clock forward for testing and live ops.
const express = require('express');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { worldTick } = require('../engine/tick');

const router = express.Router();
router.use(requireAuth, requireAdmin);

router.post('/tick', async (req, res) => {
  try { res.json(await worldTick({ force: true })); }
  catch (err) { console.error(err); res.status(500).json({ error: 'Tick failed.' }); }
});

// Fast-forward one clock to "now" and tick: 'cycle' opens the next cycle, 'races' ends the
// current race phase, 'bills' ends every open vote, 'confirmations' and 'cases' likewise.
router.post('/advance', async (req, res) => {
  try {
    const what = req.body.what;
    if (what === 'cycle') await db.query('UPDATE world SET next_cycle_at = now()');
    else if (what === 'races') {
      await db.query(`UPDATE races SET filing_closes_at = now() WHERE phase = 'filing'`);
      await db.query(`UPDATE races SET primary_closes_at = now() WHERE phase = 'primary'`);
      await db.query(`UPDATE races SET general_closes_at = now() WHERE phase = 'general'`);
    } else if (what === 'bills') await db.query('UPDATE bills SET stage_deadline = now() WHERE stage_deadline IS NOT NULL');
    else if (what === 'confirmations') await db.query(`UPDATE nominations SET deadline = now() WHERE status = 'pending'`);
    else if (what === 'cases') await db.query(`UPDATE court_cases SET deadline = now() WHERE status = 'pending'`);
    else return res.status(400).json({ error: 'Unknown clock.' });
    res.json(await worldTick({ force: true }));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Advance failed.' }); }
});

// Grant resources to a politician (testing, events, refunds).
router.post('/grant', async (req, res) => {
  try {
    const { politicianId, hours = 0, funds = 0, pc = 0 } = req.body;
    const { rows } = await db.query(
      `UPDATE politicians SET hours = hours + $1::float8, funds = funds + $2::float8, pc = pc + $3::float8 WHERE id = $4 RETURNING id, name, hours, funds, pc`,
      [Number(hours), Number(funds), Number(pc), Number(politicianId)]
    );
    if (!rows.length) return res.status(404).json({ error: 'Politician not found.' });
    res.json({ politician: rows[0] });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Grant failed.' }); }
});

module.exports = router;
