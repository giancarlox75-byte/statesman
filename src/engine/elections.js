// Elections: cycles open races, candidates file, primaries pick nominees, generals pick winners.
const db = require('../db');
const R = require('../config/rules');
const { STATES, PARTIES, MAJOR_PARTIES } = require('../config/world');
const { constituency, voteShares } = require('./electorate');
const core = require('./core');

const NPC_AWARENESS = { incumbent: 55, challenger: 35, president: 50 };

function raceTitle(seat) {
  if (seat.chamber === 'president') return 'President of the United States';
  if (seat.chamber === 'senate') return `U.S. Senate — ${STATES[seat.state].name} (Class ${seat.senate_class})`;
  return `U.S. House — ${seat.state}-${seat.district}`;
}

// ---------- Opening a cycle ----------
async function openCycle() {
  const { rows: [w] } = await db.query('UPDATE world SET cycle_number = cycle_number + 1 RETURNING cycle_number');
  const n = w.cycle_number;
  const senateClass = ((n - 1) % 3) + 1;
  const withPresident = n % 2 === 1;

  const { rows: seats } = await db.query(
    `SELECT * FROM seats WHERE chamber = 'house' OR (chamber = 'senate' AND senate_class = $1) OR ($2 AND chamber = 'president')`,
    [senateClass, withPresident]
  );
  const now = Date.now();
  const t = ms => new Date(now + ms);
  for (const seat of seats) {
    const { rows: [race] } = await db.query(
      `INSERT INTO races (seat_id, cycle, filing_closes_at, primary_closes_at, general_closes_at)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [seat.id, n, t(R.FILING_LENGTH), t(R.FILING_LENGTH + R.PRIMARY_LENGTH), t(R.FILING_LENGTH + R.PRIMARY_LENGTH + R.GENERAL_LENGTH)]
    );
    // Incumbents are automatically on the ballot for re-election.
    if (seat.holder_id) {
      const { rows: [inc] } = await db.query('SELECT id, party, is_npc FROM politicians WHERE id = $1', [seat.holder_id]);
      const busy = !inc.is_npc && await currentRace(inc.id);
      if (!busy) {
        await db.query('INSERT INTO candidates (race_id, politician_id, party) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [race.id, inc.id, inc.party]);
        if (!inc.is_npc) await core.sendInbox(inc.id, 'Campaign Office', `Your re-election race is open: ${raceTitle(seat)}`, 'You have been placed on the ballot automatically. Withdraw from the Campaign page if you do not want to run.');
      }
    }
  }
  await core.addNews('election', `Election cycle ${n} is open: all House seats, Senate Class ${senateClass}${withPresident ? ', and the Presidency' : ''} are up. Filing closes in ${Math.round(R.FILING_LENGTH / R.HOUR)} hours.`);
  return { cycle: n, races: seats.length };
}

// The open race a politician is currently running in, if any.
async function currentRace(politicianId) {
  const { rows } = await db.query(
    `SELECT r.*, c.status AS cand_status, c.party AS cand_party FROM candidates c JOIN races r ON r.id = c.race_id
     WHERE c.politician_id = $1 AND r.phase <> 'closed' AND c.status IN ('filed','nominee') LIMIT 1`,
    [politicianId]
  );
  return rows[0] || null;
}

// ---------- Filing ----------
async function fileForRace(pol, raceId) {
  const { rows: [race] } = await db.query(`SELECT r.*, s.chamber, s.state, s.district FROM races r JOIN seats s ON s.id = r.seat_id WHERE r.id = $1`, [raceId]);
  if (!race) throw new core.GameError('Race not found.', 404);
  if (race.phase !== 'filing') throw new core.GameError('Filing for this race has closed.');
  if (race.chamber !== 'president' && race.state !== pol.state) throw new core.GameError('You can only run for seats in your home state.');

  const rec = await core.getRecognition(pol.id);
  if (race.chamber === 'senate' && (rec[pol.state] || 0) < R.SENATE_MIN_RECOGNITION) {
    throw new core.GameError(`Senate candidates need ${R.SENATE_MIN_RECOGNITION}% name recognition in their state.`);
  }
  if (race.chamber === 'president') {
    const seat = await core.seatOf(pol.id);
    if (!seat && core.nationalRecognition(rec) < R.PRESIDENT_MIN_RECOGNITION) {
      throw new core.GameError(`Presidential candidates need to hold office or have ${R.PRESIDENT_MIN_RECOGNITION}% national name recognition.`);
    }
  }
  const existing = await currentRace(pol.id);
  if (existing && existing.id === race.id) throw new core.GameError('You are already running in this race.');

  await core.spend(pol.id, { hours: R.FILING_HOURS, funds: R.FILING_FEE[race.chamber] });
  if (existing) {
    await db.query(`UPDATE candidates SET status = 'withdrawn' WHERE race_id = $1 AND politician_id = $2`, [existing.id, pol.id]);
  }
  await db.query(
    `INSERT INTO candidates (race_id, politician_id, party) VALUES ($1, $2, $3)
     ON CONFLICT (race_id, politician_id) DO UPDATE SET status = 'filed', party = $3`,
    [race.id, pol.id, pol.party]
  );
  await core.addNews('filing', `${pol.name} (${pol.party}) files to run for ${raceTitle(race)}.`, race.state);
  return race;
}

async function withdraw(pol, raceId) {
  const { rowCount } = await db.query(
    `UPDATE candidates SET status = 'withdrawn' WHERE race_id = $1 AND politician_id = $2 AND status IN ('filed','nominee')`,
    [raceId, pol.id]
  );
  if (!rowCount) throw new core.GameError('You are not running in that race.');
}

// ---------- Building candidate profiles for the vote model ----------
async function profiles(race, seat, cands, state) {
  const ids = cands.map(c => c.politician_id);
  if (!ids.length) return [];
  const { rows: pols } = await db.query('SELECT * FROM politicians WHERE id = ANY($1)', [ids]);
  const { rows: camp } = await db.query('SELECT * FROM campaign WHERE race_id = $1 AND state = $2', [race.id, state]);
  const { rows: recs } = await db.query('SELECT * FROM recognition WHERE politician_id = ANY($1) AND state = $2', [ids, state]);
  const { rows: endorsed } = await db.query('SELECT politician_id FROM party_endorsements WHERE race_id = $1', [race.id]);
  const endorsedIds = new Set(endorsed.map(e => e.politician_id));

  return cands.map(c => {
    const p = pols.find(x => x.id === c.politician_id);
    const cp = camp.find(x => x.politician_id === p.id);
    const isIncumbent = seat.holder_id === p.id;
    let awareness;
    if (cp) awareness = Number(cp.awareness);
    else if (p.is_npc) awareness = seat.chamber === 'president' ? NPC_AWARENESS.president : isIncumbent ? NPC_AWARENESS.incumbent : NPC_AWARENESS.challenger;
    else awareness = Number(recs.find(x => x.politician_id === p.id)?.value || 0);
    if (endorsedIds.has(p.id)) awareness += 10;
    return {
      id: p.id, name: p.name, party: c.party, positions: p.positions, isNpc: p.is_npc,
      awareness, gotv: cp ? Number(cp.gotv) : 0, blocBoost: cp ? cp.bloc_boost : {},
      incumbentApproval: isIncumbent ? Number(p.approval) : null,
      credibility: Number(p.credibility),
    };
  });
}

// Projected (or final, with noise) result of a race among `cands`.
async function project(race, seat, cands, { mode = 'general', party = null, noise = 0 } = {}) {
  const environment = mode === 'general' ? await core.nationalEnvironment() : {};
  const jitter = () => noise ? Math.exp((Math.random() * 2 - 1) * noise) : 1;

  if (seat.chamber !== 'president') {
    const cons = constituency(seat.state, seat.chamber === 'house' ? seat.district : null);
    const profs = await profiles(race, seat, cands, seat.state);
    const res = voteShares(cons, profs, { mode, party, environment });
    const raw = Object.fromEntries(Object.entries(res.shares).map(([id, v]) => [id, v * jitter()]));
    const sum = Object.values(raw).reduce((a, b) => a + b, 0);
    return { shares: Object.fromEntries(Object.entries(raw).map(([id, v]) => [id, v / sum])), perBloc: res.perBloc, profiles: profs };
  }

  // Presidency: state-by-state, Electoral College for the general, weighted popular vote for primaries.
  const shares = {}, ev = {}, byState = {};
  let profs = [];
  for (const c of cands) { shares[c.politician_id] = 0; ev[c.politician_id] = 0; }
  let weightTotal = 0;
  for (const s of Object.values(STATES)) {
    profs = await profiles(race, seat, cands, s.code);
    const res = voteShares(constituency(s.code), profs, { mode, party, environment });
    let best = null, bestV = -1;
    for (const [id, v0] of Object.entries(res.shares)) {
      const v = v0 * jitter();
      shares[id] += v * s.houseSeats;
      if (v > bestV) { bestV = v; best = id; }
    }
    weightTotal += s.houseSeats;
    ev[best] += s.electoralVotes;
    byState[s.code] = Number(best);
  }
  for (const id of Object.keys(shares)) shares[id] /= weightTotal;
  return { shares, ev, byState, profiles: profs };
}

// ---------- Phase transitions ----------
async function seatAndCands(race, statuses) {
  const { rows: [seat] } = await db.query('SELECT * FROM seats WHERE id = $1', [race.seat_id]);
  const { rows: cands } = await db.query(
    `SELECT * FROM candidates WHERE race_id = $1 AND status = ANY($2)`, [race.id, statuses]
  );
  return { seat, cands };
}

async function startPrimary(race) {
  const { seat, cands } = await seatAndCands(race, ['filed']);
  for (const party of MAJOR_PARTIES) {
    const inParty = cands.filter(c => c.party === party);
    if (inParty.length === 0) {
      const npc = await core.createNpc({
        party, state: seat.chamber === 'president' ? core.pick(Object.keys(STATES)) : seat.state,
        district: seat.chamber === 'house' ? seat.district : null,
      });
      await db.query(`INSERT INTO candidates (race_id, politician_id, party, status) VALUES ($1, $2, $3, 'nominee')`, [race.id, npc.id, party]);
    } else if (inParty.length === 1) {
      await db.query(`UPDATE candidates SET status = 'nominee' WHERE race_id = $1 AND politician_id = $2`, [race.id, inParty[0].politician_id]);
    }
  }
  await db.query(`UPDATE candidates SET status = 'nominee' WHERE race_id = $1 AND party = 'I' AND status = 'filed'`, [race.id]);
  await db.query(`UPDATE races SET phase = 'primary' WHERE id = $1`, [race.id]);
}

async function resolvePrimary(race) {
  const { seat, cands } = await seatAndCands(race, ['filed']);
  for (const party of MAJOR_PARTIES) {
    const inParty = cands.filter(c => c.party === party);
    if (inParty.length < 2) continue;
    const res = await project(race, seat, inParty, { mode: 'primary', party, noise: 0.04 });
    const ranked = Object.entries(res.shares).sort((a, b) => b[1] - a[1]);
    const winnerId = Number(ranked[0][0]);
    for (const [id, share] of ranked) {
      await db.query(`UPDATE candidates SET status = $1, primary_share = $2 WHERE race_id = $3 AND politician_id = $4`,
        [Number(id) === winnerId ? 'nominee' : 'lost_primary', share * 100, race.id, Number(id)]);
    }
    const winner = res.profiles.find(p => p.id === winnerId);
    await core.addNews('primary', `${winner.name} wins the ${PARTIES[party].short} primary for ${raceTitle(seat)} with ${(ranked[0][1] * 100).toFixed(1)}%.`, seat.state);
    for (const [id] of ranked.slice(1)) {
      const loser = res.profiles.find(p => p.id === Number(id));
      if (!loser.isNpc) await core.sendInbox(loser.id, 'Campaign Office', `You lost the ${PARTIES[party].short} primary for ${raceTitle(seat)}`, `${winner.name} is the nominee. Losing a primary keeps you off the general election ballot.`);
    }
  }
  await db.query(`UPDATE races SET phase = 'general' WHERE id = $1`, [race.id]);
}

async function resolveGeneral(race) {
  const { seat, cands } = await seatAndCands(race, ['nominee']);
  if (!cands.length) {
    await db.query(`UPDATE races SET phase = 'closed' WHERE id = $1`, [race.id]);
    return;
  }
  const res = await project(race, seat, cands, { noise: 0.05 });
  let winnerId;
  if (seat.chamber === 'president') {
    winnerId = Number(Object.entries(res.ev).sort((a, b) => b[1] - a[1])[0][0]);
  } else {
    winnerId = Number(Object.entries(res.shares).sort((a, b) => b[1] - a[1])[0][0]);
  }
  for (const c of cands) {
    await db.query(`UPDATE candidates SET status = $1, general_share = $2, electoral_votes = $3 WHERE race_id = $4 AND politician_id = $5`,
      [c.politician_id === winnerId ? 'won' : 'lost', (res.shares[c.politician_id] || 0) * 100, res.ev ? res.ev[c.politician_id] : null, race.id, c.politician_id]);
  }
  const winner = res.profiles.find(p => p.id === winnerId);
  const wasIncumbent = seat.holder_id === winnerId;
  const prevHolder = seat.holder_id;
  await core.assignSeat(seat.id, winnerId);
  await db.query(`UPDATE races SET phase = 'closed', winner_id = $1, results = $2 WHERE id = $3`,
    [winnerId, JSON.stringify({ shares: res.shares, ev: res.ev || null, byState: res.byState || null }), race.id]);

  const pct = (res.shares[winnerId] * 100).toFixed(1);
  const evText = res.ev ? ` with ${res.ev[winnerId]} electoral votes` : ` with ${pct}%`;
  const verb = wasIncumbent ? 're-elected as' : (prevHolder ? 'unseats the incumbent to become' : 'elected');
  await core.addNews('result', `${winner.name} (${winner.party}) ${verb} ${raceTitle(seat)}${evText}.`, seat.state);

  for (const c of cands) {
    const p = res.profiles.find(x => x.id === c.politician_id);
    if (p.isNpc) continue;
    if (p.id === winnerId) {
      await db.query('UPDATE politicians SET pc = pc + 10, approval = 55 WHERE id = $1', [p.id]);
      for (const st of seat.state ? [seat.state] : Object.keys(STATES)) await core.addRecognition(p.id, st, 10);
      await core.sendInbox(p.id, 'Campaign Office', `You won: ${raceTitle(seat)}`, `Final result${evText}. You take office immediately.`);
    } else {
      await core.sendInbox(p.id, 'Campaign Office', `You lost: ${raceTitle(seat)}`, `${winner.name} won${evText}. You received ${((res.shares[p.id] || 0) * 100).toFixed(1)}%.`);
    }
  }
  // A defeated player incumbent loses the seat (assignSeat already moved it). Losing NPC incumbents retire.
  if (prevHolder && prevHolder !== winnerId) {
    await db.query('UPDATE politicians SET retired = true WHERE id = $1 AND is_npc', [prevHolder]);
  }
  for (const c of cands) {
    if (c.politician_id !== winnerId) {
      await db.query(`UPDATE politicians SET retired = true WHERE id = $1 AND is_npc AND id NOT IN (SELECT holder_id FROM seats WHERE holder_id IS NOT NULL)`, [c.politician_id]);
    }
  }
}

async function advanceRaces() {
  const now = new Date();
  const { rows } = await db.query(
    `SELECT * FROM races WHERE (phase = 'filing' AND filing_closes_at <= $1)
       OR (phase = 'primary' AND primary_closes_at <= $1) OR (phase = 'general' AND general_closes_at <= $1)
     ORDER BY id`, [now]
  );
  for (const race of rows) {
    try {
      if (race.phase === 'filing') { await startPrimary(race); race.phase = 'primary'; }
      if (race.phase === 'primary' && new Date(race.primary_closes_at) <= now) { await resolvePrimary(race); race.phase = 'general'; }
      if (race.phase === 'general' && new Date(race.general_closes_at) <= now) await resolveGeneral(race);
    } catch (err) { console.error('Race advance failed', race.id, err); }
  }
  return rows.length;
}

module.exports = { openCycle, currentRace, fileForRace, withdraw, project, profiles, advanceRaces, raceTitle, seatAndCands };
