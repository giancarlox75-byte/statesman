const db = require('../db');

const BASE_POWER_PER_HOUR = 2;
const OFFICE_BONUS_PER_HOUR = {
  house: 2,
  senate: 3,
  president: 5,
};
const SOFT_CAP = 50;
const SOFT_CAP_MULTIPLIER = 0.4; // slower gain once above the cap

const BASE_FUNDS_PER_HOUR = 40;
const OFFICE_FUNDS_BONUS_PER_HOUR = {
  house: 30,
  senate: 60,
  president: 150,
};

// Lazily "catches up" a politician's power AND funds based on elapsed time since last update.
// Called at the start of any request that reads/spends resources, so we never need a cron job
// just to keep numbers ticking up.
async function reconcilePower(politicianId) {
  const { rows } = await db.query(
    `SELECT * FROM politicians WHERE id = $1`,
    [politicianId]
  );
  if (!rows.length) return null;
  const pol = rows[0];

  const now = new Date();
  const last = new Date(pol.last_power_update);
  const elapsedHours = Math.max(0, (now - last) / (1000 * 60 * 60));

  if (elapsedHours < (1 / 60)) {
    // less than a minute has passed, don't bother writing
    return pol;
  }

  const powerRatePerHour = BASE_POWER_PER_HOUR + (OFFICE_BONUS_PER_HOUR[pol.current_office] || 0);
  const fundsRatePerHour = BASE_FUNDS_PER_HOUR + (OFFICE_FUNDS_BONUS_PER_HOUR[pol.current_office] || 0);

  let power = Number(pol.power);
  let remainingHours = elapsedHours;

  if (power >= SOFT_CAP) {
    power += remainingHours * powerRatePerHour * SOFT_CAP_MULTIPLIER;
  } else {
    // hours needed to hit the soft cap at full rate
    const hoursToCap = (SOFT_CAP - power) / powerRatePerHour;
    if (remainingHours <= hoursToCap) {
      power += remainingHours * powerRatePerHour;
    } else {
      power = SOFT_CAP;
      const leftover = remainingHours - hoursToCap;
      power += leftover * powerRatePerHour * SOFT_CAP_MULTIPLIER;
    }
  }

  const funds = Number(pol.funds) + elapsedHours * fundsRatePerHour;

  const { rows: updated } = await db.query(
    `UPDATE politicians SET power = $1, funds = $2, last_power_update = $3 WHERE id = $4 RETURNING *`,
    [power, funds, now, politicianId]
  );
  return updated[0];
}

module.exports = {
  reconcilePower,
  BASE_POWER_PER_HOUR, OFFICE_BONUS_PER_HOUR, SOFT_CAP,
  BASE_FUNDS_PER_HOUR, OFFICE_FUNDS_BONUS_PER_HOUR,
};
