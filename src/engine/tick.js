// The world tick: advances every clock in the game. Runs lazily on API traffic (at most once per
// TICK_INTERVAL_MS), from a background interval in a long-running server, and from the Vercel cron.
const db = require('../db');
const R = require('../config/rules');
const elections = require('./elections');
const legislation = require('./legislation');
const executive = require('./executive');
const approval = require('./approval');

const DAILY_EVERY_MS = 10 * 60 * 1000 / R.SPEED; // slow-moving systems update every ~10 minutes

let running = null;

async function worldTick({ force = false } = {}) {
  if (running) return running;
  running = (async () => {
    const { rows } = await db.query(
      `UPDATE world SET last_tick_at = now() WHERE id = 1 AND ($1 OR last_tick_at < now() - $2 ::float8 * interval '1 millisecond') RETURNING *`,
      [force, R.TICK_INTERVAL_MS]
    );
    if (!rows.length) return { ran: false };
    const w = rows[0];
    const out = { ran: true };

    if (new Date(w.next_cycle_at) <= new Date()) {
      await db.query(`UPDATE world SET next_cycle_at = now() + $1 ::float8 * interval '1 millisecond'`, [R.CYCLE_LENGTH]);
      out.cycle = await elections.openCycle();
    }
    out.races = await elections.advanceRaces();
    out.bills = await legislation.advanceBills();
    out.nominations = await executive.resolveNominations();
    out.cases = await executive.resolveCases();

    const sinceDaily = Date.now() - new Date(w.last_daily_at).getTime();
    if (force || sinceDaily >= DAILY_EVERY_MS) {
      const elapsedDays = sinceDaily / R.DAY;
      await db.query('UPDATE world SET last_daily_at = now()');
      await approval.updateApprovals(elapsedDays);
      await approval.accrue(elapsedDays);
      await approval.driftEconomy(elapsedDays);
      await approval.recomputeRoles();
      await executive.justiceRetirements(elapsedDays);
      await executive.npcPresidentFillsVacancies();
      out.daily = true;
    }
    return out;
  })();
  try { return await running; } finally { running = null; }
}

module.exports = { worldTick };
