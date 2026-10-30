// Builds the world on first run: every seat in Congress, the White House, the Cabinet and the
// Supreme Court is filled by an NPC, so the government works from day one and players take it over.
const fs = require('fs');
const path = require('path');
const db = require('../db');
const { STATES, ISSUE_KEYS, PARTIES, CABINET_POSTS, COURT_SEATS, STATE_CODES } = require('../config/world');
const { constituency, clamp } = require('./electorate');
const core = require('./core');

const STARTING_POLICY = { taxes: 0, healthcare: 0, guns: 1, immigration: 0, climate: 0, labor: 0, crime: 1, social: 0 };

function npcParty(lean) {
  const pR = 1 / (1 + Math.exp(-6 * lean));
  return Math.random() < pR ? 'R' : 'D';
}

async function applySchema() {
  const sql = fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8');
  await db.query(sql);
}

async function seatWithNpc(seat, party, opts = {}) {
  const npc = await core.createNpc({ party, state: opts.state || seat.state, district: seat.district, positions: opts.positions });
  const { rows: [s] } = await db.query(
    `INSERT INTO seats (chamber, state, district, senate_class, post, holder_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [seat.chamber, seat.state || null, seat.district || null, seat.senate_class || null, seat.post || null, npc.id]
  );
  await db.query('INSERT INTO title_history (politician_id, title) VALUES ($1,$2)', [npc.id, core.seatTitle(s)]);
  return s;
}

async function seedWorld() {
  await applySchema();
  const { rows } = await db.query('SELECT 1 FROM world WHERE id = 1');
  if (rows.length) return false;

  await db.query(`INSERT INTO world (id, last_tick_at) VALUES (1, now() - interval '1 day')`); // tick on the first request
  for (const i of ISSUE_KEYS) await db.query('INSERT INTO national_policy (issue, position) VALUES ($1,$2)', [i, STARTING_POLICY[i]]);
  for (const p of ['D', 'R']) {
    await db.query('INSERT INTO parties (code) VALUES ($1) ON CONFLICT DO NOTHING', [p]);
    for (const r of ['chair', 'house_leader', 'house_whip', 'senate_leader', 'senate_whip']) {
      await db.query('INSERT INTO party_roles (role) VALUES ($1) ON CONFLICT DO NOTHING', [`${p}:${r}`]);
    }
  }

  const codes = Object.keys(STATES);
  for (const [idx, code] of codes.entries()) {
    const s = STATES[code];
    for (let d = 1; d <= s.houseSeats; d++) {
      await seatWithNpc({ chamber: 'house', state: code, district: d }, npcParty(constituency(code, d).partisanLean));
    }
    const lean = constituency(code).partisanLean;
    await seatWithNpc({ chamber: 'senate', state: code, senate_class: (idx % 3) + 1 }, npcParty(lean));
    await seatWithNpc({ chamber: 'senate', state: code, senate_class: ((idx + 1) % 3) + 1 }, npcParty(lean));
  }

  const presParty = core.pick(['D', 'R']);
  await seatWithNpc({ chamber: 'president' }, presParty, { state: core.pick(STATE_CODES) });
  for (const post of Object.keys(CABINET_POSTS)) {
    await seatWithNpc({ chamber: 'cabinet', post }, presParty, { state: core.pick(STATE_CODES) });
  }
  // Court: a 5-4 split, leaning toward the sitting President's party.
  for (let n = 1; n <= COURT_SEATS; n++) {
    const party = n <= 5 ? presParty : (presParty === 'D' ? 'R' : 'D');
    const positions = {};
    for (const i of ISSUE_KEYS) positions[i] = Math.round(clamp(PARTIES[party].platform[i] * 0.8 + core.rand(-0.6, 0.6), -3, 3) * 10) / 10;
    await seatWithNpc({ chamber: 'court', post: String(n) }, party, { state: core.pick(STATE_CODES), positions });
  }
  await core.addNews('world', 'A new session of government begins. Every seat is up for grabs.');
  return true;
}

module.exports = { seedWorld, applySchema };
