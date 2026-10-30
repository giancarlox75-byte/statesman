// Approval: how constituents judge their officeholders. This is where everything connects:
//  - how you voted vs. what your constituents wanted
//  - whether the laws on the books serve your constituents (and whether your party is to blame)
//  - the economy (the President owns it; the President's party shares it)
//  - money you brought home, missed votes, scandals, town halls, credibility
const db = require('../db');
const R = require('../config/rules');
const { STATES } = require('../config/world');
const { policySatisfaction, partyAffinity, clamp } = require('./electorate');
const core = require('./core');

function economyScore(w) {
  return clamp(0.5 + (Number(w.growth) - 2) / 4 - (Number(w.unemployment) - 4.5) / 6, 0, 1);
}

// Breakdown of an officeholder's approval target. Used by the daily update and shown to players.
function approvalBreakdown({ pol, seat, cons, voteAlign, missed, delivered, mods, policy, world, control, presParty }) {
  const parts = [];
  const add = (label, v) => parts.push({ label, value: Math.round(v * 10) / 10 });

  add('Partisan baseline', (partyAffinity(cons.partisanLean, pol.party) - 0.5) * 24);

  if (seat.chamber === 'house' || seat.chamber === 'senate') {
    add('Voting record vs. constituents', voteAlign == null ? 0 : (voteAlign - 0.5) * 44);
    if (missed) add('Missed votes', -missed * R.MISSED_VOTE_APPROVAL);
    if (delivered) add('Federal money brought home', Math.min(8, delivered * 3));
  }

  const sat = clamp((policySatisfaction(policy, cons) - 0.6) / 0.3, 0, 1);
  let resp;
  if (seat.chamber === 'president') resp = 1;
  else if (pol.party === control[seat.chamber]?.majority) resp = 0.6;
  else resp = -0.3; // the minority gets credit when the majority's laws are unpopular
  add(resp > 0 ? 'Current laws (you share the blame)' : 'Current laws (blamed on the majority)', (sat - 0.5) * 30 * resp);

  const econ = economyScore(world) - 0.5;
  if (seat.chamber === 'president') add('Economy', econ * 30);
  else if (pol.party === presParty) add('Economy (President\'s party)', econ * 8);
  else add('Economy (opposition)', -econ * 4);

  if (mods) add('News & events', mods);
  add('Credibility', (Number(pol.credibility) - 60) * 0.1);

  const target = clamp(50 + parts.reduce((a, p) => a + p.value, 0), 5, 95);
  return { target: Math.round(target * 10) / 10, parts };
}

async function loadContext() {
  const { rows: [world] } = await db.query('SELECT * FROM world WHERE id = 1');
  const policy = await core.getPolicy();
  const control = await core.chamberControl();
  const pres = await core.presidentSeat();
  return { world, policy, control, presParty: pres?.party };
}

async function memberStats(ids) {
  const since = new Date(Date.now() - 14 * R.DAY);
  const { rows: votes } = await db.query(
    `SELECT politician_id, avg(alignment) FILTER (WHERE vote <> 'missed') AS align, count(*) FILTER (WHERE vote = 'missed')::int AS missed
     FROM bill_votes WHERE politician_id = ANY($1) AND created_at >= $2 GROUP BY politician_id`, [ids, since]
  );
  const { rows: mods } = await db.query(
    `SELECT politician_id, sum(amount) AS total FROM approval_mods WHERE politician_id = ANY($1) AND expires_at > now() GROUP BY politician_id`, [ids]
  );
  const { rows: approps } = await db.query(
    `SELECT state, sum(amount) / 1e9 AS billions FROM appropriations WHERE created_at >= $1 GROUP BY state`, [since]
  );
  return { votes, mods, approps };
}

async function breakdownFor(pol, seat) {
  if (!seat || !['house', 'senate', 'president'].includes(seat.chamber)) return null;
  const ctx = await loadContext();
  const stats = await memberStats([pol.id]);
  const v = stats.votes[0];
  return approvalBreakdown({
    pol, seat, cons: core.seatConstituency(seat), ...ctx,
    voteAlign: v?.align != null ? Number(v.align) : null, missed: v?.missed || 0,
    delivered: Number(stats.approps.find(a => a.state === seat.state)?.billions || 0),
    mods: Number(stats.mods[0]?.total || 0),
  });
}

async function updateApprovals(elapsedDays) {
  const ctx = await loadContext();
  const { rows: holders } = await db.query(
    `SELECT p.*, s.chamber, s.state AS seat_state, s.district AS seat_district FROM seats s JOIN politicians p ON p.id = s.holder_id
     WHERE s.chamber IN ('house','senate','president')`
  );
  const stats = await memberStats(holders.map(h => h.id));
  const rate = Math.min(1, R.APPROVAL_DRIFT_PER_DAY * elapsedDays);
  const updates = [];
  for (const h of holders) {
    const seat = { chamber: h.chamber, state: h.seat_state, district: h.seat_district };
    const v = stats.votes.find(x => x.politician_id === h.id);
    const { target } = approvalBreakdown({
      pol: h, seat, cons: core.seatConstituency(seat), ...ctx,
      voteAlign: v?.align != null ? Number(v.align) : null, missed: v?.missed || 0,
      delivered: Number(stats.approps.find(a => a.state === seat.state)?.billions || 0),
      mods: Number(stats.mods.find(m => m.politician_id === h.id)?.total || 0),
    });
    updates.push([h.id, Number(h.approval) + (target - Number(h.approval)) * rate]);
  }
  if (updates.length) {
    await db.query(
      `UPDATE politicians p SET approval = u.a FROM unnest($1::int[], $2::float8[]) AS u(id, a) WHERE p.id = u.id`,
      [updates.map(u => u[0]), updates.map(u => u[1])]
    );
  }
  await db.query('DELETE FROM approval_mods WHERE expires_at <= now()');
}

// Political capital, party standing, dues, recognition decay, credibility recovery.
async function accrue(elapsedDays) {
  const d = elapsedDays;
  for (const [chamber, perDay] of Object.entries(R.OFFICE_PC_PER_DAY)) {
    await db.query(
      `UPDATE politicians p SET pc = pc + $1::float8 * GREATEST(0.2, p.approval / 50) * $2::float8
       FROM seats s WHERE s.holder_id = p.id AND s.chamber = $3 AND NOT p.is_npc`, [perDay, d, chamber]
    );
  }
  await db.query(
    `UPDATE politicians p SET pc = pc + $1::float8 FROM party_roles r WHERE r.holder_id = p.id AND NOT p.is_npc`, [R.LEADERSHIP_PC_PER_DAY * d]
  );
  await db.query(
    `UPDATE politicians SET party_standing = LEAST(100, party_standing + $1::float8),
       credibility = CASE WHEN credibility < 70 THEN LEAST(70, credibility + $2::float8) ELSE credibility END
     WHERE NOT is_npc AND NOT retired`, [0.5 * d, 0.5 * d]
  );
  // Party dues flow to the treasury from members who can pay.
  const { rows: parties } = await db.query('SELECT * FROM parties WHERE dues > 0');
  for (const p of parties) {
    const amt = Number(p.dues) * d;
    const { rowCount } = await db.query(
      `UPDATE politicians SET funds = funds - $1::float8 WHERE party = $2 AND NOT is_npc AND NOT retired AND funds >= $1::float8`, [amt, p.code]
    );
    await db.query('UPDATE parties SET treasury = treasury + $1::float8 WHERE code = $2', [amt * rowCount, p.code]);
  }
  await db.query(
    `UPDATE recognition r SET value = value * (1 - $1::float8) FROM politicians p WHERE p.id = r.politician_id AND NOT p.is_npc`,
    [Math.min(1, R.RECOGNITION_DECAY_PER_DAY * d)]
  );
}

async function driftEconomy(elapsedDays) {
  const d = Math.min(elapsedDays, 2);
  const noise = () => (Math.random() * 2 - 1) * Math.sqrt(d);
  await db.query(
    `UPDATE world SET
       growth = growth + (2.0 - growth) * $1::float8 + $2::float8,
       unemployment = GREATEST(2, unemployment + (4.5 - unemployment) * $1::float8 - (growth - 2.0) * 0.05 * $3::float8 + $4::float8),
       deficit = deficit + (4.0 - deficit) * $1::float8 * 0.5`,
    [0.05 * d, noise() * 0.08, d, noise() * 0.04]
  );
}

// Recompute party offices from endorsements (weighted by the endorser's party standing).
async function recomputeRoles() {
  const roles = [];
  for (const p of ['D', 'R']) for (const r of ['chair', 'house_leader', 'house_whip', 'senate_leader', 'senate_whip']) roles.push(`${p}:${r}`);
  const { rows: tallies } = await db.query(
    `SELECT e.role, e.candidate_id, sum(GREATEST(1, en.party_standing)) AS weight
     FROM role_endorsements e JOIN politicians en ON en.id = e.endorser_id JOIN politicians c ON c.id = e.candidate_id
     WHERE en.party = split_part(e.role, ':', 1) AND c.party = split_part(e.role, ':', 1) AND NOT c.retired
     GROUP BY e.role, e.candidate_id`
  );
  const { rows: seats } = await db.query(`SELECT holder_id, chamber FROM seats WHERE chamber IN ('house','senate') AND holder_id IS NOT NULL`);
  const chamberOf = Object.fromEntries(seats.map(s => [s.holder_id, s.chamber]));
  const { rows: current } = await db.query('SELECT * FROM party_roles');
  for (const role of roles) {
    const [, office] = role.split(':');
    const chamber = office === 'chair' ? null : office.split('_')[0];
    const eligible = tallies.filter(t => t.role === role && (!chamber || chamberOf[t.candidate_id] === chamber))
      .sort((a, b) => Number(b.weight) - Number(a.weight));
    const holder = eligible[0]?.candidate_id || null;
    const prev = current.find(c => c.role === role)?.holder_id || null;
    if (holder !== prev) {
      await db.query('INSERT INTO party_roles (role, holder_id) VALUES ($1,$2) ON CONFLICT (role) DO UPDATE SET holder_id = $2', [role, holder]);
      if (holder) await core.sendInbox(holder, 'Party Caucus', `You are now ${roleTitle(role)}`, 'Your colleagues have chosen you.');
    }
  }
}

function roleTitle(role) {
  const [p, office] = role.split(':');
  const party = p === 'D' ? 'Democratic' : 'Republican';
  return {
    chair: `${party} Party Chair`,
    house_leader: `House ${party} Leader`, house_whip: `House ${party} Whip`,
    senate_leader: `Senate ${party} Leader`, senate_whip: `Senate ${party} Whip`,
  }[office];
}

module.exports = { approvalBreakdown, breakdownFor, updateApprovals, accrue, driftEconomy, recomputeRoles, roleTitle, economyScore, STATES };
