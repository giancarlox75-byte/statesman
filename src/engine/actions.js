// Player actions: campaigning, fundraising, positions, opposition research, party operations.
const db = require('../db');
const R = require('../config/rules');
const { ISSUES, ISSUE_KEYS, BLOCS, BLOC_KEYS, STATES } = require('../config/world');
const { issueFit, clamp } = require('./electorate');
const core = require('./core');
const elections = require('./elections');

const { GameError } = core;
const fmt = n => `$${Math.round(n).toLocaleString()}`;

// ---------- Campaign ----------
async function campaignContext(pol, stateParam) {
  const race = await elections.currentRace(pol.id);
  if (!race) throw new GameError('You are not running in an active race.');
  const { rows: [seat] } = await db.query('SELECT * FROM seats WHERE id = $1', [race.seat_id]);
  const state = seat.chamber === 'president' ? (STATES[stateParam] ? stateParam : pol.state) : seat.state;
  return { race, seat, state };
}

async function campaignRow(race, seat, politicianId, state) {
  const { rows } = await db.query('SELECT * FROM campaign WHERE race_id = $1 AND politician_id = $2 AND state = $3', [race.id, politicianId, state]);
  if (rows.length) return rows[0];
  // Start from the candidate's current standing in that state.
  const [prof] = await elections.profiles(race, seat, [{ politician_id: politicianId, party: '' }], state);
  const { rows: [created] } = await db.query(
    `INSERT INTO campaign (race_id, politician_id, state, awareness) VALUES ($1,$2,$3,$4) RETURNING *`,
    [race.id, politicianId, state, prof.awareness]
  );
  return created;
}

const grow = (cur, delta) => clamp(cur + delta * (1 - cur / 100), 0, 100);

function adCost(seat, state) {
  return seat.chamber === 'house' ? 4000 : 3000 + 2500 * STATES[state].houseSeats;
}

async function campaignAction(pol, action, params = {}) {
  const { race, seat, state } = await campaignContext(pol, params.state);
  const row = await campaignRow(race, seat, pol.id, state);
  let awareness = Number(row.awareness), gotv = Number(row.gotv);
  const boost = { ...row.bloc_boost };
  let message;

  switch (action) {
    case 'rally':
      await core.spend(pol.id, { hours: 4, funds: 2000 });
      awareness = grow(awareness, 7);
      gotv = Math.min(0.4, gotv + 0.03);
      await core.addRecognition(pol.id, state, 3);
      message = `You hold a rally in ${STATES[state].name}. Awareness up, base energized.`;
      break;
    case 'tv_ad': {
      const cost = adCost(seat, state);
      await core.spend(pol.id, { hours: 1, funds: cost });
      awareness = grow(awareness, 8);
      await core.addRecognition(pol.id, state, 2);
      message = `Your ${fmt(cost)} TV buy blankets ${STATES[state].name}.`;
      break;
    }
    case 'targeted_ad': {
      const bloc = params.bloc;
      if (!BLOCS[bloc]) throw new GameError('Choose a voter bloc to target.');
      const cost = Math.round(adCost(seat, state) * 1.2);
      await core.spend(pol.id, { hours: 1, funds: cost });
      const fit = issueFit(pol.positions, bloc);
      boost[bloc] = Math.min(0.3, (boost[bloc] || 0) + 0.06 * (0.5 + fit));
      for (const b of BLOC_KEYS) if (b !== bloc && boost[b]) boost[b] = Math.max(0, boost[b] - 0.005);
      message = `Targeted ads reach ${BLOCS[bloc].name}. They respond ${fit > 0.7 ? 'strongly — you share their views' : fit > 0.5 ? 'moderately' : 'weakly — your positions don\'t match theirs'}.`;
      break;
    }
    case 'canvass':
      await core.spend(pol.id, { hours: 3, funds: 500 });
      gotv = Math.min(0.4, gotv + 0.06);
      message = 'Volunteers knock doors. Your turnout operation grows.';
      break;
    case 'attack_ad':
      return attackAd(pol, race, seat, state, params);
    case 'poll': {
      await core.spend(pol.id, { funds: 5000 });
      return { message: 'Poll results are in.', poll: await poll(race, seat, state) };
    }
    default:
      throw new GameError('Unknown campaign action.');
  }
  await db.query('UPDATE campaign SET awareness = $1, gotv = $2, bloc_boost = $3 WHERE race_id = $4 AND politician_id = $5 AND state = $6',
    [awareness, gotv, JSON.stringify(boost), race.id, pol.id, state]);
  await core.logAction(pol.id, action, `${elections.raceTitle(seat)} (${state})`);
  return { message };
}

async function attackAd(pol, race, seat, state, { targetId, skeletonId }) {
  const { rows: [cand] } = await db.query(
    `SELECT c.*, p.name, p.is_npc FROM candidates c JOIN politicians p ON p.id = c.politician_id
     WHERE c.race_id = $1 AND c.politician_id = $2 AND c.status IN ('filed','nominee')`, [race.id, targetId]
  );
  if (!cand || cand.politician_id === pol.id) throw new GameError('Pick an opponent in your race.');
  let evidence = null;
  if (skeletonId) {
    ({ rows: [evidence] } = await db.query(
      `SELECT s.* FROM dossiers d JOIN skeletons s ON s.id = d.skeleton_id WHERE d.owner_id = $1 AND s.id = $2 AND s.politician_id = $3`,
      [pol.id, skeletonId, targetId]
    ));
    if (!evidence) throw new GameError('That evidence is not in your dossier.');
  }
  await core.spend(pol.id, { hours: 2, funds: 15000 });
  // make sure both sides have a campaign row in this state before adjusting them
  await campaignRow(race, seat, targetId, state);
  await campaignRow(race, seat, pol.id, state);

  if (evidence) {
    await db.query('UPDATE campaign SET awareness = GREATEST(0, awareness - 15) WHERE race_id = $1 AND politician_id = $2 AND state = $3', [race.id, targetId, state]);
    await revealSkeleton(evidence, pol);
    return { message: `Your ad exposes ${cand.name}: "${evidence.description}". It lands hard.` };
  }
  const backfire = Math.random() < (100 - Number(pol.credibility)) / 150 + 0.1;
  if (backfire) {
    await db.query('UPDATE campaign SET awareness = GREATEST(0, awareness - 6) WHERE race_id = $1 AND politician_id = $2 AND state = $3', [race.id, pol.id, state]);
    await db.query('UPDATE politicians SET credibility = GREATEST(0, credibility - 5) WHERE id = $1', [pol.id]);
    await core.addNews('campaign', `Fact-checkers pan ${pol.name}'s attack ad against ${cand.name}. The ad backfires.`, state);
    return { message: 'The attack ad backfired. Voters saw it as a cheap shot — your credibility took a hit.', backfire: true };
  }
  await db.query('UPDATE campaign SET awareness = GREATEST(0, awareness - 8) WHERE race_id = $1 AND politician_id = $2 AND state = $3', [race.id, targetId, state]);
  await db.query('UPDATE politicians SET credibility = GREATEST(0, credibility - 2) WHERE id = $1', [targetId]);
  return { message: `Your attack ad dents ${cand.name}'s standing in ${STATES[state].name}.` };
}

async function poll(race, seat, state) {
  const statuses = race.phase === 'general' ? ['nominee'] : ['filed', 'nominee'];
  const { cands } = await elections.seatAndCands(race, statuses);
  const myParty = race.cand_party;
  const field = race.phase === 'general' ? cands : cands.filter(c => c.party === myParty);
  const mode = race.phase === 'general' || myParty === 'I' ? 'general' : 'primary';
  const pollSeat = seat.chamber === 'president' ? { ...seat, chamber: 'senate', state } : seat;
  const res = await elections.project(race, pollSeat, field, { mode, party: myParty });
  const names = Object.fromEntries(res.profiles.map(p => [p.id, `${p.name} (${p.party})`]));
  return {
    mode, state,
    overall: Object.entries(res.shares).map(([id, v]) => ({ id: Number(id), name: names[id], share: Math.round(v * 1000) / 10 }))
      .sort((a, b) => b.share - a.share),
    blocs: Object.entries(res.perBloc).map(([b, m]) => ({
      bloc: BLOCS[b].name,
      shares: Object.entries(m).map(([id, v]) => ({ name: names[id], share: Math.round(v * 1000) / 10 })),
    })),
  };
}

// ---------- Money & presence ----------
async function fundraiser(pol) {
  await core.spend(pol.id, { hours: 3 });
  const rec = await core.getRecognition(pol.id);
  const seat = await core.seatOf(pol.id);
  const officeBonus = { house: 2000, senate: 4000, president: 10000, cabinet: 3000 }[seat?.chamber] || 0;
  const raised = Math.round((2500 + 60 * (rec[pol.state] || 0) + officeBonus) * core.rand(0.85, 1.15));
  await db.query('UPDATE politicians SET funds = funds + $1 WHERE id = $2', [raised, pol.id]);
  await core.logAction(pol.id, 'fundraiser', fmt(raised));
  return { message: `Your fundraiser brings in ${fmt(raised)}.` };
}

const PACS = ['Americans for a Brighter Tomorrow', 'Citizens for Common Sense', 'The Heartland Prosperity Fund', 'Coalition for Working Families', 'Freedom & Opportunity Action', 'Future Forward Alliance'];

async function darkMoney(pol) {
  await core.spend(pol.id, { hours: 1 });
  const pac = core.pick(PACS);
  await db.query('UPDATE politicians SET funds = funds + 30000 WHERE id = $1', [pol.id]);
  await core.addSkeleton(pol.id, `Took $30,000 in undisclosed money from "${pac}"`, 2);
  await core.logAction(pol.id, 'dark_money', pac);
  return { message: `"${pac}" quietly wires $30,000. Nobody needs to know... for now.` };
}

async function townHall(pol) {
  const seat = await core.seatOf(pol.id);
  if (!seat || !['house', 'senate', 'president'].includes(seat.chamber)) throw new GameError('Only elected officials hold town halls.');
  await core.spend(pol.id, { hours: 3 });
  await core.addApprovalMod(pol.id, 3, 'Town hall', 5);
  await db.query('UPDATE politicians SET credibility = LEAST(100, credibility + 1) WHERE id = $1', [pol.id]);
  await core.addRecognition(pol.id, seat.state || pol.state, 2);
  return { message: 'You face your constituents at a town hall. They appreciate being heard.' };
}

async function pressConference(pol) {
  await core.spend(pol.id, { hours: 2, funds: 1000 });
  await core.addRecognition(pol.id, pol.state, 4);
  return { message: `Cameras roll in ${STATES[pol.state].name}. More voters know your name.` };
}

// ---------- Positions ----------
async function setPositions(pol, changes) {
  const positions = { ...pol.positions };
  const moved = [];
  for (const [issue, v] of Object.entries(changes || {})) {
    if (!ISSUE_KEYS.includes(issue)) continue;
    const to = clamp(Math.round(Number(v)), -3, 3);
    if (Number.isNaN(to) || to === Number(positions[issue])) continue;
    moved.push({ issue, from: Number(positions[issue]), to });
    positions[issue] = to;
  }
  if (!moved.length) throw new GameError('No positions changed.');
  await core.spend(pol.id, { hours: 2 * moved.length });
  const { rows: recent } = await db.query(
    `SELECT issue FROM position_record WHERE politician_id = $1 AND created_at > now() - $2 ::float8 * interval '1 millisecond'`, [pol.id, 7 * R.DAY]
  );
  let hit = 0;
  for (const m of moved) {
    hit += Math.abs(m.to - m.from) * 2 + (recent.some(r => r.issue === m.issue) ? 5 : 0);
    await db.query('INSERT INTO position_record (politician_id, issue, from_pos, to_pos) VALUES ($1,$2,$3,$4)', [pol.id, m.issue, m.from, m.to]);
  }
  await db.query('UPDATE politicians SET positions = $1, credibility = GREATEST(0, credibility - $2::float8) WHERE id = $3', [JSON.stringify(positions), hit, pol.id]);
  if (hit >= 8) await core.addNews('campaign', `${pol.name} accused of flip-flopping on ${moved.map(m => ISSUES[m.issue].name).join(', ')}.`, pol.state);
  return { message: `Positions updated. Credibility -${hit}.`, credibilityHit: hit };
}

// ---------- Opposition research ----------
async function oppoResearch(pol, targetId, { investigation = false } = {}) {
  const { rows: [target] } = await db.query('SELECT * FROM politicians WHERE id = $1', [targetId]);
  if (!target || target.id === pol.id) throw new GameError('Pick someone else to investigate.');
  if (investigation) {
    const seat = await core.seatOf(pol.id);
    if (seat?.chamber !== 'cabinet' || seat.post !== 'justice') throw new GameError('Only the Attorney General can open federal investigations.', 403);
    await core.spend(pol.id, { hours: 4, pc: 5 });
  } else {
    await core.spend(pol.id, { hours: 4, funds: 10000 });
  }
  const { rows: hidden } = await db.query(
    `SELECT * FROM skeletons s WHERE s.politician_id = $1 AND NOT s.public
     AND NOT EXISTS (SELECT 1 FROM dossiers d WHERE d.owner_id = $2 AND d.skeleton_id = s.id)`, [target.id, pol.id]
  );
  const chance = Math.min(0.85, (investigation ? 0.5 : 0.25) + 0.1 * hidden.length);
  await core.logAction(pol.id, investigation ? 'investigation' : 'oppo_research', target.name);
  if (!hidden.length || Math.random() > chance) {
    return { message: `Your researchers dig into ${target.name} and come up empty${hidden.length ? ' — this time' : ''}.` };
  }
  const found = core.pick(hidden);
  await db.query('INSERT INTO dossiers (owner_id, skeleton_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [pol.id, found.id]);
  return { message: `Found something on ${target.name}: "${found.description}" (severity ${found.severity}). It's in your dossier.`, found };
}

async function revealSkeleton(sk, by) {
  await db.query('UPDATE skeletons SET public = true WHERE id = $1', [sk.id]);
  await db.query('UPDATE politicians SET credibility = GREATEST(0, credibility - $1) WHERE id = $2', [sk.severity * 4, sk.politician_id]);
  await core.addApprovalMod(sk.politician_id, -sk.severity * 3, 'Scandal', 10);
  const { rows: [t] } = await db.query('SELECT name, state, is_npc FROM politicians WHERE id = $1', [sk.politician_id]);
  await core.addNews('scandal', `SCANDAL: ${t.name} ${sk.description.charAt(0).toLowerCase()}${sk.description.slice(1)}.`, t.state);
  if (!t.is_npc) await core.sendInbox(sk.politician_id, 'Press Office', 'A story about you just broke', `"${sk.description}" is now public${by ? ` — the leak traces back to ${by.name}'s camp` : ''}.`);
}

async function leak(pol, skeletonId) {
  const { rows: [sk] } = await db.query(
    `SELECT s.* FROM dossiers d JOIN skeletons s ON s.id = d.skeleton_id WHERE d.owner_id = $1 AND s.id = $2 AND NOT s.public`, [pol.id, skeletonId]
  );
  if (!sk) throw new GameError('That item is not in your dossier (or is already public).');
  await core.spend(pol.id, { hours: 1 });
  // Leaks are anonymous most of the time.
  await revealSkeleton(sk, Math.random() < 0.25 ? pol : null);
  return { message: 'The story is out.' };
}

// ---------- Party ----------
async function requireChair(pol) {
  const { rows } = await db.query('SELECT 1 FROM party_roles WHERE role = $1 AND holder_id = $2', [`${pol.party}:chair`, pol.id]);
  if (!rows.length) throw new GameError('Only the party chair can do that.', 403);
}

async function endorseRole(pol, role, candidateId) {
  const [party, office] = String(role).split(':');
  if (party !== pol.party || !['chair', 'house_leader', 'house_whip', 'senate_leader', 'senate_whip'].includes(office)) throw new GameError('You can only vote in your own party\'s elections.');
  const { rows: [c] } = await db.query('SELECT * FROM politicians WHERE id = $1 AND NOT is_npc', [candidateId]);
  if (!c || c.party !== pol.party) throw new GameError('Candidate must be a player in your party.');
  if (office !== 'chair') {
    const chamber = office.split('_')[0];
    const [mine, theirs] = [await core.seatOf(pol.id), await core.seatOf(c.id)];
    if (mine?.chamber !== chamber || theirs?.chamber !== chamber) throw new GameError(`Only members of the ${chamber === 'house' ? 'House' : 'Senate'} caucus vote for its leaders.`);
  }
  await db.query(`INSERT INTO role_endorsements (endorser_id, role, candidate_id) VALUES ($1,$2,$3)
    ON CONFLICT (endorser_id, role) DO UPDATE SET candidate_id = $3`, [pol.id, role, c.id]);
  return { message: `You back ${c.name}.` };
}

async function donateToParty(pol, amount) {
  amount = Math.round(Number(amount));
  if (!(amount >= 1000)) throw new GameError('Minimum donation is $1,000.');
  if (pol.party === 'I') throw new GameError('Independents have no party treasury.');
  await core.spend(pol.id, { funds: amount });
  await db.query('UPDATE parties SET treasury = treasury + $1 WHERE code = $2', [amount, pol.party]);
  await db.query('UPDATE politicians SET party_standing = LEAST(100, party_standing + $1::float8) WHERE id = $2', [amount / 5000, pol.id]);
  return { message: `You give ${fmt(amount)} to the party.` };
}

async function setDues(pol, dues) {
  await requireChair(pol);
  dues = clamp(Math.round(Number(dues) || 0), 0, 5000);
  await db.query('UPDATE parties SET dues = $1 WHERE code = $2', [dues, pol.party]);
  return { message: `Daily dues set to ${fmt(dues)}.` };
}

async function massMail(pol, subject, body) {
  await requireChair(pol);
  subject = String(subject || '').slice(0, 120); body = String(body || '').slice(0, 4000);
  if (!subject) throw new GameError('Add a subject.');
  const { rows } = await db.query('SELECT id FROM politicians WHERE party = $1 AND NOT is_npc AND NOT retired AND id <> $2', [pol.party, pol.id]);
  for (const r of rows) await core.sendInbox(r.id, `${pol.name} (Party Chair)`, subject, body);
  return { message: `Sent to ${rows.length} members.` };
}

async function fundCandidate(pol, candidateId, amount) {
  await requireChair(pol);
  amount = Math.round(Number(amount));
  const { rows: [c] } = await db.query('SELECT * FROM politicians WHERE id = $1 AND party = $2 AND NOT is_npc', [candidateId, pol.party]);
  if (!c || !(amount > 0)) throw new GameError('Pick a member and an amount.');
  const { rowCount } = await db.query('UPDATE parties SET treasury = treasury - $1::float8 WHERE code = $2 AND treasury >= $1::float8', [amount, pol.party]);
  if (!rowCount) throw new GameError('The treasury cannot cover that.');
  await db.query('UPDATE politicians SET funds = funds + $1 WHERE id = $2', [amount, c.id]);
  await core.sendInbox(c.id, `${pol.name} (Party Chair)`, `The party sent you ${fmt(amount)}`, '');
  return { message: `Sent ${fmt(amount)} to ${c.name}.` };
}

async function endorsePrimary(pol, raceId, candidateId) {
  await requireChair(pol);
  const { rows: [c] } = await db.query(
    `SELECT c.* FROM candidates c JOIN races r ON r.id = c.race_id WHERE c.race_id = $1 AND c.politician_id = $2 AND c.party = $3 AND r.phase IN ('filing','primary')`,
    [raceId, candidateId, pol.party]
  );
  if (!c) throw new GameError('That candidate is not in your party\'s primary.');
  await core.spend(pol.id, { pc: 3 });
  await db.query(`INSERT INTO party_endorsements (race_id, party, politician_id) VALUES ($1,$2,$3)
    ON CONFLICT (race_id, party) DO UPDATE SET politician_id = $3`, [raceId, pol.party, candidateId]);
  return { message: 'Endorsement issued.' };
}

async function expel(pol, memberId) {
  await requireChair(pol);
  const { rows: [m] } = await db.query('SELECT * FROM politicians WHERE id = $1 AND party = $2 AND NOT is_npc AND id <> $3', [memberId, pol.party, pol.id]);
  if (!m) throw new GameError('Not a member of your party.');
  await core.spend(pol.id, { pc: 10 });
  await leaveParty(m, 'I');
  await core.sendInbox(m.id, `${pol.name} (Party Chair)`, 'You have been expelled from the party', 'You now sit as an Independent.');
  await core.addNews('party', `${pol.name} expels ${m.name} from the ${pol.party === 'D' ? 'Democratic' : 'Republican'} Party.`);
  return { message: `${m.name} expelled.` };
}

async function leaveParty(pol, newParty) {
  await db.query('DELETE FROM role_endorsements WHERE endorser_id = $1 OR candidate_id = $1', [pol.id]);
  await db.query('UPDATE party_roles SET holder_id = NULL WHERE holder_id = $1', [pol.id]);
  await db.query('UPDATE politicians SET party = $1, party_standing = 10, credibility = GREATEST(0, credibility - 20) WHERE id = $2', [newParty, pol.id]);
}

async function switchParty(pol, newParty) {
  if (!['D', 'R', 'I'].includes(newParty) || newParty === pol.party) throw new GameError('Pick a different party.');
  if (await elections.currentRace(pol.id)) throw new GameError('You cannot switch parties in the middle of a race.');
  await leaveParty(pol, newParty);
  await core.addNews('party', `${pol.name} switches parties and now sits as a ${newParty === 'I' ? 'n Independent' : newParty === 'D' ? ' Democrat' : ' Republican'}.`, pol.state);
  return { message: 'You switched parties. Credibility -20.' };
}

module.exports = {
  campaignAction, poll, fundraiser, darkMoney, townHall, pressConference, setPositions,
  oppoResearch, leak, endorseRole, donateToParty, setDues, massMail, fundCandidate, endorsePrimary, expel, switchParty,
};
