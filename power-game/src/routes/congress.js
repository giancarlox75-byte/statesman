const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const QUORUM = 3; // minimum votes cast before a chamber vote can be decided, kept low for a young game

async function getMyPolitician(userId) {
  const { rows } = await db.query('SELECT * FROM politicians WHERE user_id = $1', [userId]);
  return rows[0] || null;
}

router.get('/bills', async (req, res) => {
  const { rows } = await db.query('SELECT * FROM bills ORDER BY created_at DESC LIMIT 100');
  res.json({ bills: rows });
});

router.get('/bills/:id', async (req, res) => {
  const { rows } = await db.query('SELECT * FROM bills WHERE id = $1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Bill not found.' });
  const votes = await db.query(
    `SELECT v.*, p.name FROM votes v JOIN politicians p ON p.id = v.politician_id WHERE bill_id = $1`,
    [req.params.id]
  );
  res.json({ bill: rows[0], votes: votes.rows });
});

// Only sitting House members can introduce a bill
router.post('/bills', requireAuth, async (req, res) => {
  const pol = await getMyPolitician(req.userId);
  if (!pol) return res.status(404).json({ error: 'No politician yet.' });
  if (pol.current_office !== 'house') return res.status(403).json({ error: 'Only House members can introduce bills.' });

  const { title, description } = req.body;
  if (!title || !description) return res.status(400).json({ error: 'Title and description are required.' });

  const { rows } = await db.query(
    `INSERT INTO bills (title, description, sponsor_id, status) VALUES ($1, $2, $3, 'house_vote') RETURNING *`,
    [title, description, pol.id]
  );
  res.json({ bill: rows[0] });
});

async function tallyAndAdvance(billId) {
  const { rows } = await db.query('SELECT * FROM bills WHERE id = $1', [billId]);
  const bill = rows[0];
  if (!bill) return null;

  if (bill.status === 'house_vote') {
    const total = bill.house_yes + bill.house_no;
    if (total >= QUORUM) {
      if (bill.house_yes > bill.house_no) {
        return (await db.query(`UPDATE bills SET status = 'senate_vote' WHERE id = $1 RETURNING *`, [billId])).rows[0];
      } else {
        return (await db.query(`UPDATE bills SET status = 'failed', decided_at = now() WHERE id = $1 RETURNING *`, [billId])).rows[0];
      }
    }
  } else if (bill.status === 'senate_vote') {
    const total = bill.senate_yes + bill.senate_no;
    if (total >= QUORUM) {
      if (bill.senate_yes > bill.senate_no) {
        return (await db.query(`UPDATE bills SET status = 'president_desk' WHERE id = $1 RETURNING *`, [billId])).rows[0];
      } else {
        return (await db.query(`UPDATE bills SET status = 'failed', decided_at = now() WHERE id = $1 RETURNING *`, [billId])).rows[0];
      }
    }
  }
  return bill;
}

router.post('/bills/:id/vote', requireAuth, async (req, res) => {
  try {
    const pol = await getMyPolitician(req.userId);
    if (!pol) return res.status(404).json({ error: 'No politician yet.' });
    const { vote } = req.body; // 'yes' | 'no'
    if (!['yes', 'no'].includes(vote)) return res.status(400).json({ error: "vote must be 'yes' or 'no'." });

    const billRes = await db.query('SELECT * FROM bills WHERE id = $1', [req.params.id]);
    if (!billRes.rows.length) return res.status(404).json({ error: 'Bill not found.' });
    const bill = billRes.rows[0];

    let chamber;
    if (bill.status === 'house_vote') chamber = 'house';
    else if (bill.status === 'senate_vote') chamber = 'senate';
    else return res.status(400).json({ error: 'This bill is not currently up for a vote.' });

    if (pol.current_office !== chamber) {
      return res.status(403).json({ error: `Only sitting ${chamber} members can vote at this stage.` });
    }

    const dup = await db.query('SELECT id FROM votes WHERE bill_id = $1 AND politician_id = $2', [bill.id, pol.id]);
    if (dup.rows.length) return res.status(409).json({ error: 'You already voted on this bill.' });

    await db.query('INSERT INTO votes (bill_id, politician_id, chamber, vote) VALUES ($1,$2,$3,$4)', [bill.id, pol.id, chamber, vote]);

    const col = `${chamber}_${vote}`;
    await db.query(`UPDATE bills SET ${col} = ${col} + 1 WHERE id = $1`, [bill.id]);

    const updated = await tallyAndAdvance(bill.id);
    res.json({ bill: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not cast vote.' });
  }
});

// President signs or vetoes
router.post('/bills/:id/decide', requireAuth, async (req, res) => {
  try {
    const pol = await getMyPolitician(req.userId);
    if (!pol) return res.status(404).json({ error: 'No politician yet.' });
    if (pol.current_office !== 'president') return res.status(403).json({ error: 'Only the President can sign or veto.' });

    const { decision } = req.body; // 'sign' | 'veto'
    if (!['sign', 'veto'].includes(decision)) return res.status(400).json({ error: "decision must be 'sign' or 'veto'." });

    const billRes = await db.query('SELECT * FROM bills WHERE id = $1', [req.params.id]);
    if (!billRes.rows.length) return res.status(404).json({ error: 'Bill not found.' });
    const bill = billRes.rows[0];
    if (bill.status !== 'president_desk') return res.status(400).json({ error: 'This bill is not on the President\'s desk.' });

    const newStatus = decision === 'sign' ? 'signed' : 'vetoed';
    const { rows } = await db.query(
      `UPDATE bills SET status = $1, decided_at = now() WHERE id = $2 RETURNING *`,
      [newStatus, bill.id]
    );
    // A signature/veto is a National-Influence-moving act
    await db.query('UPDATE politicians SET national_influence = national_influence + 3 WHERE id = $1', [pol.id]);
    res.json({ bill: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not decide bill.' });
  }
});

// Who's currently in Congress / the White House
router.get('/roster', async (req, res) => {
  const house = await db.query(`SELECT id, name, party, current_office_state, current_office_seat FROM politicians WHERE current_office = 'house' ORDER BY current_office_state`);
  const senate = await db.query(`SELECT id, name, party, current_office_state, current_office_seat FROM politicians WHERE current_office = 'senate' ORDER BY current_office_state`);
  const president = await db.query(`SELECT id, name, party FROM politicians WHERE current_office = 'president' LIMIT 1`);
  res.json({ house: house.rows, senate: senate.rows, president: president.rows[0] || null });
});

module.exports = router;
