const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const races = await db.query(
      `SELECT r.office_type, r.state, r.seat_number, p.name, p.party, r.created_at
       FROM races r JOIN politicians p ON p.id = r.winner_id
       WHERE r.status = 'closed' ORDER BY r.closes_at DESC LIMIT 10`
    );
    const bills = await db.query(
      `SELECT title, status, decided_at FROM bills WHERE status IN ('signed','vetoed','failed') ORDER BY decided_at DESC LIMIT 10`
    );
    res.json({ races: races.rows, bills: bills.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load feed.' });
  }
});

module.exports = router;
