// Shared engine helpers: resources, offices, NPCs, news, inbox, recognition.
const db = require('../db');
const R = require('../config/rules');
const { ISSUE_KEYS, PARTIES, CABINET_POSTS, FIRST_NAMES, LAST_NAMES, STATES } = require('../config/world');
const { constituency, clamp } = require('./electorate');

const rand = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const round1 = v => Math.round(v * 10) / 10;

// ---------- Offices ----------
function seatTitle(seat) {
  if (!seat) return 'Private Citizen';
  switch (seat.chamber) {
    case 'house': return `U.S. Representative, ${seat.state}-${seat.district}`;
    case 'senate': return `U.S. Senator, ${STATES[seat.state].name}`;
    case 'president': return 'President of the United States';
    case 'cabinet': return CABINET_POSTS[seat.post].name;
    case 'court': return 'Associate Justice of the Supreme Court';
    default: return seat.chamber;
  }
}

async function seatOf(politicianId) {
  const { rows } = await db.query('SELECT * FROM seats WHERE holder_id = $1 LIMIT 1', [politicianId]);
  return rows[0] || null;
}

async function presidentSeat() {
  const { rows } = await db.query(
    `SELECT s.*, p.name, p.party, p.is_npc, p.approval, p.positions FROM seats s
     LEFT JOIN politicians p ON p.id = s.holder_id WHERE s.chamber = 'president'`
  );
  return rows[0];
}

// The constituency an office answers to.
function seatConstituency(seat) {
  if (!seat) return null;
  if (seat.chamber === 'house') return constituency(seat.state, seat.district);
  if (seat.chamber === 'senate') return constituency(seat.state);
  if (seat.chamber === 'president' || seat.chamber === 'cabinet') return constituency(null);
  return null;
}

// Move a politician into a seat, vacating whatever they held before (filled by an NPC of the same party).
async function assignSeat(seatId, politicianId) {
  const { rows: [seat] } = await db.query('SELECT * FROM seats WHERE id = $1', [seatId]);
  const prevHolder = seat.holder_id;
  if (prevHolder && prevHolder !== politicianId) {
    await db.query(`UPDATE title_history SET term_end = now() WHERE politician_id = $1 AND term_end IS NULL`, [prevHolder]);
  }
  const old = await seatOf(politicianId);
  if (old && old.id !== seatId) {
    await db.query('UPDATE seats SET holder_id = NULL WHERE id = $1', [old.id]);
    await db.query(`UPDATE title_history SET term_end = now() WHERE politician_id = $1 AND term_end IS NULL`, [politicianId]);
    if (['house', 'senate'].includes(old.chamber)) {
      const { rows: [p] } = await db.query('SELECT party FROM politicians WHERE id = $1', [politicianId]);
      const npc = await createNpc({ party: p.party === 'I' ? pick(['D', 'R']) : p.party, state: old.state, district: old.district });
      await db.query('UPDATE seats SET holder_id = $1, since = now() WHERE id = $2', [npc.id, old.id]);
      await db.query('INSERT INTO title_history (politician_id, title) VALUES ($1, $2)', [npc.id, seatTitle(old)]);
      await addNews('appointment', `${npc.name} (${npc.party}) appointed to fill the vacant seat: ${seatTitle(old)}.`, old.state);
    }
  }
  if (prevHolder === politicianId) return seat;
  await db.query('UPDATE seats SET holder_id = $1, since = now() WHERE id = $2', [politicianId, seatId]);
  await db.query('INSERT INTO title_history (politician_id, title) VALUES ($1, $2)', [politicianId, seatTitle(seat)]);
  return seat;
}

// ---------- NPCs ----------
function npcPositions(party, cons) {
  const plat = PARTIES[party]?.platform;
  const out = {};
  for (const i of ISSUE_KEYS) {
    const base = plat ? 0.6 * plat[i] + 0.4 * cons.prefs[i] : cons.prefs[i];
    out[i] = round1(clamp(base + rand(-0.4, 0.4), -3, 3));
  }
  return out;
}

async function createNpc({ party, state, district = null, positions = null, approval = null }) {
  const cons = constituency(state, district);
  const name = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
  const { rows: [npc] } = await db.query(
    `INSERT INTO politicians (is_npc, name, party, state, district, positions, credibility, approval, funds)
     VALUES (true, $1, $2, $3, $4, $5, $6, $7, 0) RETURNING *`,
    [name, party, state, district, JSON.stringify(positions || npcPositions(party, cons)), rand(55, 85), approval ?? rand(42, 60)]
  );
  return npc;
}

// ---------- Resources ----------
// Lazily catch up a politician's Hours and Funds since their last update.
async function reconcile(politicianId) {
  const { rows } = await db.query('SELECT * FROM politicians WHERE id = $1', [politicianId]);
  const pol = rows[0];
  if (!pol || pol.is_npc) return pol;
  const now = Date.now();
  const elapsedDays = Math.max(0, (now - new Date(pol.last_update).getTime()) / R.DAY);
  if (elapsedDays < 1 / 1440) return pol;

  const seat = await seatOf(pol.id);
  const hours = Math.min(R.HOURS_CAP, Number(pol.hours) + elapsedDays * R.HOURS_PER_DAY);
  const income = R.BASE_FUNDS_PER_DAY + (seat ? R.OFFICE_FUNDS_PER_DAY[seat.chamber] || 0 : 0);
  const funds = Number(pol.funds) + elapsedDays * income;
  const { rows: [updated] } = await db.query(
    `UPDATE politicians SET hours = GREATEST(hours, $1), funds = $2, last_update = now() WHERE id = $3 RETURNING *`,
    [hours, funds, pol.id]
  );
  return updated;
}

class GameError extends Error {
  constructor(msg, status = 400) { super(msg); this.status = status; }
}

// Atomically spend resources; throws a GameError if the politician can't afford it.
async function spend(politicianId, { hours = 0, funds = 0, pc = 0 }) {
  const { rows } = await db.query(
    `UPDATE politicians SET hours = hours - $1::float8, funds = funds - $2::float8, pc = pc - $3::float8
     WHERE id = $4 AND hours >= $1::float8 AND funds >= $2::float8 AND pc >= $3::float8 RETURNING *`,
    [hours, funds, pc, politicianId]
  );
  if (!rows.length) {
    const need = [hours && `${hours} hours`, funds && `$${Math.round(funds).toLocaleString()}`, pc && `${pc} political capital`].filter(Boolean).join(', ');
    throw new GameError(`Not enough resources (needs ${need}).`);
  }
  return rows[0];
}

async function getRecognition(politicianId) {
  const { rows } = await db.query('SELECT state, value FROM recognition WHERE politician_id = $1', [politicianId]);
  const map = Object.fromEntries(rows.map(r => [r.state, Number(r.value)]));
  return map;
}

function nationalRecognition(map) {
  let num = 0, den = 0;
  for (const s of Object.values(STATES)) { num += (map[s.code] || 0) * s.houseSeats; den += s.houseSeats; }
  return num / den;
}

// Diminishing returns: each gain closes `delta`% of the remaining gap to 100.
async function addRecognition(politicianId, state, delta) {
  await db.query(
    `INSERT INTO recognition (politician_id, state, value) VALUES ($1, $2, LEAST(100, GREATEST(0, $3::float8)))
     ON CONFLICT (politician_id, state) DO UPDATE
     SET value = LEAST(100, GREATEST(0, recognition.value + $3::float8 * (1 - recognition.value / 100)))`,
    [politicianId, state, delta]
  );
}

async function addApprovalMod(politicianId, amount, reason, days) {
  await db.query(
    `INSERT INTO approval_mods (politician_id, amount, reason, expires_at) VALUES ($1, $2, $3, now() + $4 ::float8 * interval '1 millisecond')`,
    [politicianId, amount, reason, days * R.DAY]
  );
}

async function addSkeleton(politicianId, description, severity) {
  await db.query('INSERT INTO skeletons (politician_id, description, severity) VALUES ($1, $2, $3)', [politicianId, description, severity]);
}

// ---------- Communication ----------
async function addNews(kind, headline, state = null) {
  await db.query('INSERT INTO news (kind, headline, state) VALUES ($1, $2, $3)', [kind, headline, state]);
}

async function sendInbox(politicianId, sender, subject, body = '') {
  await db.query('INSERT INTO inbox (politician_id, sender, subject, body) VALUES ($1, $2, $3, $4)', [politicianId, sender, subject, body]);
}

async function logAction(politicianId, action, detail) {
  await db.query('INSERT INTO actions_log (politician_id, action, detail) VALUES ($1, $2, $3)', [politicianId, action, detail]);
}

// ---------- Parties ----------
// A party's working platform: the base platform pulled toward its player members' positions,
// weighted by party standing. More active players = more say over where the party goes.
async function partyPlatforms() {
  const { rows } = await db.query(
    `SELECT party, positions, party_standing FROM politicians WHERE NOT is_npc AND NOT retired AND party IN ('D','R')`
  );
  const out = {};
  for (const code of ['D', 'R']) {
    const base = PARTIES[code].platform;
    const members = rows.filter(r => r.party === code);
    const totalStanding = members.reduce((a, m) => a + Number(m.party_standing), 0);
    const playerWeight = Math.min(0.5, totalStanding / 400);
    const plat = {};
    for (const i of ISSUE_KEYS) {
      const avg = totalStanding
        ? members.reduce((a, m) => a + (m.positions[i] ?? 0) * Number(m.party_standing), 0) / totalStanding
        : base[i];
      plat[i] = round1((1 - playerWeight) * base[i] + playerWeight * avg);
    }
    out[code] = plat;
  }
  return out;
}

// The national mood: the President's party is judged on the President's approval.
async function nationalEnvironment() {
  const pres = await presidentSeat();
  if (!pres || !pres.party || pres.party === 'I') return {};
  const swing = (Number(pres.approval) - 50) / 250; // ±0.2 at the extremes
  return { [pres.party]: pres.party === 'D' ? -swing : swing };
}

// Which party controls each chamber.
async function chamberControl() {
  const { rows } = await db.query(
    `SELECT s.chamber, p.party, count(*)::int AS n FROM seats s JOIN politicians p ON p.id = s.holder_id
     WHERE s.chamber IN ('house','senate') GROUP BY s.chamber, p.party`
  );
  const out = { house: { D: 0, R: 0, I: 0 }, senate: { D: 0, R: 0, I: 0 } };
  for (const r of rows) out[r.chamber][r.party] = r.n;
  for (const c of ['house', 'senate']) out[c].majority = out[c].D >= out[c].R ? 'D' : 'R';
  return out;
}

async function getPolicy() {
  const { rows } = await db.query('SELECT issue, position FROM national_policy');
  return Object.fromEntries(rows.map(r => [r.issue, Number(r.position)]));
}

module.exports = {
  rand, pick, round1, GameError,
  seatTitle, seatOf, presidentSeat, seatConstituency, assignSeat,
  npcPositions, createNpc,
  reconcile, spend, getRecognition, nationalRecognition, addRecognition, addApprovalMod, addSkeleton,
  addNews, sendInbox, logAction,
  partyPlatforms, nationalEnvironment, chamberControl, getPolicy,
};
