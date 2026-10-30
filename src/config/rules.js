// Tunable game rules. GAME_SPEED > 1 compresses every real-time duration (handy for testing).
const SPEED = Math.max(0.01, Number(process.env.GAME_SPEED) || 1);
const HOUR = 60 * 60 * 1000 / SPEED;
const DAY = 24 * HOUR;

module.exports = {
  SPEED, HOUR, DAY,

  // ---- Time budget ("Hours") ----
  HOURS_PER_DAY: 16,       // schedule hours regained per real day
  HOURS_CAP: 24,           // most you can bank
  STARTING_HOURS: 16,
  STARTING_FUNDS: 25000,
  STARTING_CREDIBILITY: 70,

  // Passive income per day (funds), by office
  BASE_FUNDS_PER_DAY: 1500,
  OFFICE_FUNDS_PER_DAY: { house: 4000, senate: 7000, president: 15000, cabinet: 5000, justice: 2000 },
  // Political Capital per day at 50% approval, by office
  OFFICE_PC_PER_DAY: { house: 3, senate: 5, president: 10, cabinet: 4, justice: 2 },
  LEADERSHIP_PC_PER_DAY: 3,

  // ---- Election calendar ----
  CYCLE_LENGTH: 14 * DAY,  // a new election cycle opens every 14 days
  FILING_LENGTH: 2 * DAY,
  PRIMARY_LENGTH: 2 * DAY,
  GENERAL_LENGTH: 3 * DAY,
  FILING_FEE: { house: 5000, senate: 20000, president: 100000 },
  FILING_HOURS: 2,
  SENATE_MIN_RECOGNITION: 25,     // home-state name recognition needed to file for Senate
  PRESIDENT_MIN_RECOGNITION: 15,  // national (avg) recognition needed to file for President

  // ---- Legislation ----
  VOTE_WINDOW: 24 * HOUR,         // each floor stage stays open this long
  PRESIDENT_WINDOW: 24 * HOUR,
  OVERRIDE_WINDOW: 24 * HOUR,
  CLOTURE_SHARE: 0.6,
  OVERRIDE_SHARE: 2 / 3,
  MAX_ACTIVE_BILLS_PER_SPONSOR: 3,
  BILL_COST: { hours: 2, pc: 2 },
  MISSED_VOTE_APPROVAL: 2.5,      // approval target penalty per missed vote (last 14 days)
  MISSED_VOTE_STANDING: 3,
  DEFY_WHIP_STANDING: 5,
  FOLLOW_WHIP_STANDING: 1,

  // ---- Nominations & court ----
  CONFIRMATION_WINDOW: 24 * HOUR,
  CASE_WINDOW: 48 * HOUR,
  JUSTICE_RETIRE_CHANCE_PER_DAY: 0.02,
  CASE_FILING: { pc: 10, funds: 50000 },

  // ---- World tick ----
  TICK_INTERVAL_MS: 30 * 1000,    // at most one world tick per 30s (real time)
  APPROVAL_DRIFT_PER_DAY: 0.25,   // approval moves 25% of the way to its target per day
  RECOGNITION_DECAY_PER_DAY: 0.01,
};
