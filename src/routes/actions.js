const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { reconcilePower } = require('../engine/power');

const router = express.Router();

async function getMyPolitician(userId) {
  const { rows } = await db.query('SELECT id FROM politicians WHERE user_id = $1', [userId]);
  if (!rows.length) return null;
  return reconcilePower(rows[0].id);
}

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

async function logAction(politicianId, action_type, detail, power_cost, funds_cost) {
  await db.query(
    `INSERT INTO actions_log (politician_id, action_type, detail, power_cost, funds_cost) VALUES ($1,$2,$3,$4,$5)`,
    [politicianId, action_type, detail, power_cost, funds_cost]
  );
}

// Rally: costs power, cheap on funds, +1% state influence
router.post('/rally', requireAuth, async (req, res) => {
  const pol = await getMyPolitician(req.userId);
  if (!pol) return res.status(404).json({ error: 'No politician yet.' });
  const POWER_COST = 3, FUNDS_COST = 50;
  if (pol.power < POWER_COST) return res.status(400).json({ error: 'Not enough power.' });
  if (pol.funds < FUNDS_COST) return res.status(400).json({ error: 'Not enough funds.' });

  const newSI = clamp(Number(pol.state_influence) + 1, 0, 100);
  const { rows } = await db.query(
    `UPDATE politicians SET power = power - $1, funds = funds - $2, state_influence = $3 WHERE id = $4 RETURNING *`,
    [POWER_COST, FUNDS_COST, newSI, pol.id]
  );
  await logAction(pol.id, 'rally', 'Held a campaign rally', POWER_COST, FUNDS_COST);
  res.json({ politician: rows[0] });
});

// Marketing campaign / TV ad: costs funds, small power, +1% state influence
router.post('/ad', requireAuth, async (req, res) => {
  const pol = await getMyPolitician(req.userId);
  if (!pol) return res.status(404).json({ error: 'No politician yet.' });
  const POWER_COST = 1, FUNDS_COST = 200;
  if (pol.power < POWER_COST) return res.status(400).json({ error: 'Not enough power.' });
  if (pol.funds < FUNDS_COST) return res.status(400).json({ error: 'Not enough funds.' });

  const newSI = clamp(Number(pol.state_influence) + 1, 0, 100);
  const { rows } = await db.query(
    `UPDATE politicians SET power = power - $1, funds = funds - $2, state_influence = $3 WHERE id = $4 RETURNING *`,
    [POWER_COST, FUNDS_COST, newSI, pol.id]
  );
  await logAction(pol.id, 'ad', 'Ran a marketing campaign', POWER_COST, FUNDS_COST);
  res.json({ politician: rows[0] });
});

// Fundraise: spend power, gain funds (with some randomness)
router.post('/fundraise', requireAuth, async (req, res) => {
  const pol = await getMyPolitician(req.userId);
  if (!pol) return res.status(404).json({ error: 'No politician yet.' });
  const POWER_COST = 2;
  if (pol.power < POWER_COST) return res.status(400).json({ error: 'Not enough power.' });

  const gained = Math.round(150 + Math.random() * 150); // 150-300
  const { rows } = await db.query(
    `UPDATE politicians SET power = power - $1, funds = funds + $2 WHERE id = $3 RETURNING *`,
    [POWER_COST, gained, pol.id]
  );
  await logAction(pol.id, 'fundraise', `Raised $${gained}`, POWER_COST, 0);
  res.json({ politician: rows[0], gained });
});

// Attack ad: target another candidate in the same open race, risk of backfire
router.post('/attack-ad', requireAuth, async (req, res) => {
  const pol = await getMyPolitician(req.userId);
  if (!pol) return res.status(404).json({ error: 'No politician yet.' });
  const { targetPoliticianId, raceId } = req.body;
  if (!targetPoliticianId || !raceId) return res.status(400).json({ error: 'targetPoliticianId and raceId are required.' });

  const POWER_COST = 4, FUNDS_COST = 300;
  if (pol.power < POWER_COST) return res.status(400).json({ error: 'Not enough power.' });
  if (pol.funds < FUNDS_COST) return res.status(400).json({ error: 'Not enough funds.' });

  const raceCheck = await db.query(
    `SELECT c1.politician_id AS attacker, c2.politician_id AS target
     FROM candidates c1 JOIN candidates c2 ON c1.race_id = c2.race_id
     WHERE c1.race_id = $1 AND c1.politician_id = $2 AND c2.politician_id = $3`,
    [raceId, pol.id, targetPoliticianId]
  );
  if (!raceCheck.rows.length) {
    return res.status(400).json({ error: 'You and your target must both be candidates in that race.' });
  }

  await db.query('UPDATE politicians SET power = power - $1, funds = funds - $2 WHERE id = $3', [POWER_COST, FUNDS_COST, pol.id]);

  const backfire = Math.random() < 0.2; // 20% chance of blowback, per the old game's RNG
  if (backfire) {
    await db.query(
      `UPDATE politicians SET state_influence = GREATEST(0, state_influence - 2), reputation = reputation + 3 WHERE id = $1`,
      [pol.id]
    );
    await logAction(pol.id, 'attack_ad', `Attack ad on politician #${targetPoliticianId} backfired`, POWER_COST, FUNDS_COST);
    return res.json({ result: 'backfired', message: 'The attack ad backfired and hurt your own standing.' });
  }

  await db.query(
    `UPDATE politicians SET state_influence = GREATEST(0, state_influence - 3) WHERE id = $1`,
    [targetPoliticianId]
  );
  await db.query(
    `UPDATE politicians SET reputation = reputation + 5 WHERE id = $1`,
    [pol.id]
  );
  await logAction(pol.id, 'attack_ad', `Ran attack ad on politician #${targetPoliticianId}`, POWER_COST, FUNDS_COST);
  res.json({ result: 'success', message: "Your target's state influence took a hit. Your reputation rose too (that's not a good thing)." });
});

router.get('/log', requireAuth, async (req, res) => {
  const pol = await getMyPolitician(req.userId);
  if (!pol) return res.status(404).json({ error: 'No politician yet.' });
  const { rows } = await db.query(
    'SELECT * FROM actions_log WHERE politician_id = $1 ORDER BY created_at DESC LIMIT 50',
    [pol.id]
  );
  res.json({ log: rows });
});

module.exports = router;
