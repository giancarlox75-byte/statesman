// Game API. Reads are public; anything that acts requires a signed-in player with a politician.
const express = require('express');
const db = require('../db');
const R = require('../config/rules');
const W = require('../config/world');
const { requireAuth } = require('../middleware/auth');
const { constituency } = require('../engine/electorate');
const core = require('../engine/core');
const elections = require('../engine/elections');
const legislation = require('../engine/legislation');
const executive = require('../engine/executive');
const approval = require('../engine/approval');
const actions = require('../engine/actions');

const router = express.Router();

// Wrap async handlers: GameErrors become 4xx JSON, everything else a 500.
const h = fn => async (req, res) => {
  try {
    const out = await fn(req, res);
    if (!res.headersSent) res.json(out ?? { ok: true });
  } catch (err) {
    if (err instanceof core.GameError) return res.status(err.status).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
};

async function myPolitician(req) {
  const { rows } = await db.query('SELECT id FROM politicians WHERE user_id = $1', [req.userId]);
  if (!rows.length) throw new core.GameError('Create your politician first.', 404);
  return core.reconcile(rows[0].id);
}
// For actions: load the caller's politician onto req.pol
const player = [requireAuth, async (req, res, next) => {
  try { req.pol = await myPolitician(req); next(); }
  catch (err) { res.status(err.status || 500).json({ error: err.message }); }
}];

// ---------- Static game data ----------
router.get('/meta', h(async () => ({
  issues: W.ISSUES, blocs: Object.fromEntries(Object.entries(W.BLOCS).map(([k, b]) => [k, { name: b.name, prefs: b.prefs }])),
  parties: W.PARTIES, states: W.STATES, cabinet: W.CABINET_POSTS,
  rules: { HOURS_PER_DAY: R.HOURS_PER_DAY, HOURS_CAP: R.HOURS_CAP, FILING_FEE: R.FILING_FEE, SPEED: R.SPEED },
})));

// ---------- Me ----------
router.get('/me', requireAuth, h(async (req) => {
  const { rows: [user] } = await db.query('SELECT id, email, is_admin FROM users WHERE id = $1', [req.userId]);
  const { rows } = await db.query('SELECT id FROM politicians WHERE user_id = $1', [req.userId]);
  if (!rows.length) return { user, politician: null };
  const pol = await core.reconcile(rows[0].id);
  const seat = await core.seatOf(pol.id);
  const race = await elections.currentRace(pol.id);
  const { rows: roles } = await db.query('SELECT role FROM party_roles WHERE holder_id = $1', [pol.id]);
  const { rows: [{ unread }] } = await db.query('SELECT count(*)::int AS unread FROM inbox WHERE politician_id = $1 AND NOT read', [pol.id]);
  const recognition = await core.getRecognition(pol.id);

  // Things that need the player's attention
  const todo = [];
  if (seat && ['house', 'senate'].includes(seat.chamber)) {
    const { rows: pending } = await db.query(
      `SELECT b.id, b.number, b.title, b.stage_deadline FROM bills b
       WHERE (b.status = $1 OR b.status = 'override')
       AND NOT EXISTS (SELECT 1 FROM bill_votes v WHERE v.bill_id = b.id AND v.politician_id = $2
         AND v.stage = CASE WHEN b.status = 'override' THEN 'override_' || $3 ELSE $3 END)
       ORDER BY b.stage_deadline`, [`${seat.chamber}_floor`, pol.id, seat.chamber]
    );
    for (const b of pending) todo.push({ kind: 'vote', billId: b.id, text: `Vote on ${b.number}: ${b.title}`, deadline: b.stage_deadline });
  }
  if (seat?.chamber === 'senate') {
    const { rows: noms } = await db.query(
      `SELECT n.id, p.name FROM nominations n JOIN politicians p ON p.id = n.nominee_id WHERE n.status = 'pending'
       AND NOT EXISTS (SELECT 1 FROM nomination_votes v WHERE v.nomination_id = n.id AND v.politician_id = $1)`, [pol.id]);
    for (const n of noms) todo.push({ kind: 'nomination', id: n.id, text: `Confirmation vote: ${n.name}` });
  }
  if (seat?.chamber === 'president') {
    const { rows: desk } = await db.query(`SELECT id, number, title, stage_deadline FROM bills WHERE status = 'president'`);
    for (const b of desk) todo.push({ kind: 'desk', billId: b.id, text: `Sign or veto ${b.number}: ${b.title}`, deadline: b.stage_deadline });
  }
  if (seat?.chamber === 'court') {
    const { rows: cases } = await db.query(
      `SELECT c.id, b.number FROM court_cases c JOIN bills b ON b.id = c.bill_id WHERE c.status = 'pending'
       AND NOT EXISTS (SELECT 1 FROM case_votes v WHERE v.case_id = c.id AND v.politician_id = $1)`, [pol.id]);
    for (const c of cases) todo.push({ kind: 'case', id: c.id, text: `Rule on the challenge to ${c.number}` });
  }

  return {
    user, politician: pol, seat: seat && { ...seat, title: core.seatTitle(seat) },
    race: race && { ...race, title: elections.raceTitle(await (await db.query('SELECT * FROM seats WHERE id = $1', [race.seat_id])).rows[0]) },
    roles: roles.map(r => ({ role: r.role, title: approval.roleTitle(r.role) })),
    unread, recognition, nationalRecognition: core.nationalRecognition(recognition),
    approvalBreakdown: await approval.breakdownFor(pol, seat),
    todo,
  };
}));

router.post('/me/politician', requireAuth, h(async (req) => {
  const { name, party, state, bio, avatar_url, positions } = req.body;
  const cleanName = String(name || '').trim().slice(0, 60);
  if (!cleanName) throw new core.GameError('Choose a name.');
  if (!['D', 'R', 'I'].includes(party)) throw new core.GameError('Choose a party.');
  if (!W.STATES[state]) throw new core.GameError('Choose a home state.');
  const district = Math.min(W.STATES[state].houseSeats, Math.max(1, Number(req.body.district) || 1));
  const pos = {};
  for (const i of W.ISSUE_KEYS) pos[i] = Math.max(-3, Math.min(3, Math.round(Number(positions?.[i]) || 0)));
  const { rows: existing } = await db.query('SELECT 1 FROM politicians WHERE user_id = $1', [req.userId]);
  if (existing.length) throw new core.GameError('You already have a politician.', 409);
  const { rows: [pol] } = await db.query(
    `INSERT INTO politicians (user_id, name, party, state, district, bio, avatar_url, positions, hours, funds, credibility, party_standing)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,10) RETURNING *`,
    [req.userId, cleanName, party, state, district, String(bio || '').slice(0, 1000), String(avatar_url || '').slice(0, 500),
      JSON.stringify(pos), R.STARTING_HOURS, R.STARTING_FUNDS, R.STARTING_CREDIBILITY]
  );
  await core.addRecognition(pol.id, state, 10);
  await core.addNews('player', `${pol.name} (${party}) enters politics in ${W.STATES[state].name}.`, state);
  await core.sendInbox(pol.id, 'Campaign Office', 'Welcome to Washington (almost)',
    'Build name recognition at home, raise money, and file for an open race. Your positions decide which voters you can win — and changing them later costs credibility.');
  return { politician: pol };
}));

router.post('/me/positions', ...player, h(req => actions.setPositions(req.pol, req.body.changes)));

const ACTIONS = {
  rally: (p, b) => actions.campaignAction(p, 'rally', b),
  tv_ad: (p, b) => actions.campaignAction(p, 'tv_ad', b),
  targeted_ad: (p, b) => actions.campaignAction(p, 'targeted_ad', b),
  canvass: (p, b) => actions.campaignAction(p, 'canvass', b),
  attack_ad: (p, b) => actions.campaignAction(p, 'attack_ad', b),
  poll: (p, b) => actions.campaignAction(p, 'poll', b),
  fundraiser: p => actions.fundraiser(p),
  dark_money: p => actions.darkMoney(p),
  town_hall: p => actions.townHall(p),
  press_conference: p => actions.pressConference(p),
  oppo_research: (p, b) => actions.oppoResearch(p, Number(b.targetId)),
  investigate: (p, b) => actions.oppoResearch(p, Number(b.targetId), { investigation: true }),
  leak: (p, b) => actions.leak(p, Number(b.skeletonId)),
  department_initiative: p => executive.departmentInitiative(p).then(() => ({ message: 'Initiative launched.' })),
};
router.post('/me/action', ...player, h(async (req) => {
  const fn = ACTIONS[req.body.action];
  if (!fn) throw new core.GameError('Unknown action.');
  return fn(req.pol, req.body);
}));

router.get('/me/inbox', ...player, h(async (req) => {
  const { rows } = await db.query('SELECT * FROM inbox WHERE politician_id = $1 ORDER BY created_at DESC LIMIT 100', [req.pol.id]);
  await db.query('UPDATE inbox SET read = true WHERE politician_id = $1 AND NOT read', [req.pol.id]);
  return { messages: rows };
}));

router.get('/me/dossier', ...player, h(async (req) => {
  const { rows: found } = await db.query(
    `SELECT s.*, p.name AS target_name, p.party AS target_party FROM dossiers d JOIN skeletons s ON s.id = d.skeleton_id
     JOIN politicians p ON p.id = s.politician_id WHERE d.owner_id = $1 ORDER BY d.found_at DESC`, [req.pol.id]);
  const { rows: mine } = await db.query('SELECT * FROM skeletons WHERE politician_id = $1 ORDER BY created_at DESC', [req.pol.id]);
  return { found, mine };
}));

// ---------- Races ----------
router.get('/races', h(async (req) => {
  const params = [];
  let where = `r.phase <> 'closed'`;
  if (req.query.closed) where = `r.phase = 'closed'`;
  if (req.query.state) { params.push(req.query.state); where += ` AND (s.state = $${params.length} OR s.chamber = 'president')`; }
  const { rows } = await db.query(
    `SELECT r.*, s.chamber, s.state, s.district, s.senate_class, s.holder_id FROM races r JOIN seats s ON s.id = r.seat_id
     WHERE ${where} ORDER BY r.id DESC LIMIT 300`, params);
  const ids = rows.map(r => r.id);
  const { rows: cands } = await db.query(
    `SELECT c.*, p.name, p.is_npc FROM candidates c JOIN politicians p ON p.id = c.politician_id
     WHERE c.race_id = ANY($1) AND c.status NOT IN ('withdrawn')`, [ids]);
  return { races: rows.map(r => ({ ...r, title: elections.raceTitle(r), candidates: cands.filter(c => c.race_id === r.id) })) };
}));

router.get('/races/:id', h(async (req) => {
  const { rows: [race] } = await db.query(
    `SELECT r.*, s.chamber, s.state, s.district, s.senate_class, s.holder_id FROM races r JOIN seats s ON s.id = r.seat_id WHERE r.id = $1`, [req.params.id]);
  if (!race) throw new core.GameError('Race not found.', 404);
  const { rows: cands } = await db.query(
    `SELECT c.*, p.name, p.is_npc, p.positions, p.approval, p.credibility, p.avatar_url FROM candidates c
     JOIN politicians p ON p.id = c.politician_id WHERE c.race_id = $1 ORDER BY c.status, p.name`, [race.id]);
  const { rows: endorsements } = await db.query('SELECT * FROM party_endorsements WHERE race_id = $1', [race.id]);
  return { race: { ...race, title: elections.raceTitle(race) }, candidates: cands, endorsements };
}));

router.post('/races/:id/file', ...player, h(async (req) => {
  await elections.fileForRace(req.pol, Number(req.params.id));
  return { message: 'You are on the ballot.' };
}));
router.post('/races/:id/withdraw', ...player, h(async (req) => {
  await elections.withdraw(req.pol, Number(req.params.id));
  return { message: 'You withdrew from the race.' };
}));

// ---------- Congress ----------
async function sponsorNames(bills) {
  const ids = [...new Set(bills.map(b => b.sponsor_id).filter(Boolean))];
  const { rows } = await db.query('SELECT id, name, party, avatar_url FROM politicians WHERE id = ANY($1)', [ids]);
  return bills.map(b => ({ ...b, describe: legislation.describeBill(b), sponsor: rows.find(r => r.id === b.sponsor_id) || null }));
}

router.get('/bills', h(async (req) => {
  const filter = {
    active: `status IN ('house_floor','senate_floor','president','override')`,
    law: `status = 'law'`,
    dead: `status IN ('failed','vetoed','tabled','struck')`,
  }[req.query.status] || 'true';
  const { rows } = await db.query(`SELECT * FROM bills WHERE ${filter} ORDER BY id DESC LIMIT 200`);
  const { rows: live } = await db.query(
    `SELECT bill_id, stage, vote, count(*)::int AS n FROM bill_votes WHERE bill_id = ANY($1) GROUP BY bill_id, stage, vote`, [rows.map(b => b.id)]);
  const withVotes = rows.map(b => ({ ...b, live: live.filter(l => l.bill_id === b.id) }));
  return { bills: await sponsorNames(withVotes) };
}));

router.get('/bills/:id', h(async (req) => {
  const { rows: [bill] } = await db.query('SELECT * FROM bills WHERE id = $1', [req.params.id]);
  if (!bill) throw new core.GameError('Bill not found.', 404);
  const { rows: votes } = await db.query(
    `SELECT v.stage, v.vote, v.against_whip, p.id, p.name, p.party, p.is_npc, s.state, s.district FROM bill_votes v
     JOIN politicians p ON p.id = v.politician_id LEFT JOIN seats s ON s.holder_id = p.id WHERE v.bill_id = $1 ORDER BY p.name`, [bill.id]);
  const { rows: cases } = await db.query('SELECT * FROM court_cases WHERE bill_id = $1 ORDER BY id DESC', [bill.id]);
  const [withSponsor] = await sponsorNames([bill]);
  return { bill: withSponsor, votes, cases };
}));

// The whip count is leadership-only intelligence.
router.get('/bills/:id/whipcount', ...player, h(async (req) => {
  const { rows: [bill] } = await db.query('SELECT * FROM bills WHERE id = $1', [req.params.id]);
  if (!bill) throw new core.GameError('Bill not found.', 404);
  const seat = await core.seatOf(req.pol.id);
  const { rows: roles } = await db.query('SELECT role FROM party_roles WHERE holder_id = $1', [req.pol.id]);
  const isLeader = roles.some(r => /_(leader|whip)$/.test(r.role)) || seat?.chamber === 'president';
  if (!isLeader) throw new core.GameError('Only party leaders, whips and the President get a whip count.', 403);
  const chamber = bill.status === 'senate_floor' ? 'senate' : bill.status === 'house_floor' ? 'house' : (seat?.chamber === 'senate' ? 'senate' : 'house');
  return { chamber, ...(await legislation.whipCount(bill, chamber)) };
}));

router.post('/bills', ...player, h(async (req) => ({ bill: await legislation.introduce(req.pol, req.body) })));
router.post('/bills/:id/vote', ...player, h(async (req) => legislation.castVote(req.pol, Number(req.params.id), req.body.vote)));
router.post('/bills/:id/whip', ...player, h(async (req) => { await legislation.setWhip(req.pol, Number(req.params.id), req.body.line, !!req.body.hard); }));
router.post('/bills/:id/table', ...player, h(async (req) => { await legislation.table(req.pol, Number(req.params.id)); }));
router.post('/bills/:id/filibuster', ...player, h(async (req) => { await legislation.filibuster(req.pol, Number(req.params.id)); }));
router.post('/bills/:id/deal', ...player, h(async (req) => { await legislation.backroomDeal(req.pol, Number(req.params.id), Number(req.body.npcId), req.body.vote); return { message: 'Deal struck. Keep it quiet.' }; }));
router.post('/bills/:id/decide', ...player, h(async (req) => { await legislation.presidentDecide(req.pol, Number(req.params.id), req.body.decision); }));
router.post('/bills/:id/challenge', ...player, h(async (req) => ({ case: await executive.fileCase(req.pol, Number(req.params.id)) })));

router.get('/congress', h(async () => {
  const control = await core.chamberControl();
  const { rows: roles } = await db.query(
    `SELECT r.role, p.id, p.name, p.party FROM party_roles r LEFT JOIN politicians p ON p.id = r.holder_id`);
  return {
    control,
    roles: roles.map(r => ({ ...r, title: approval.roleTitle(r.role) })),
    speakerRole: `${control.house.majority}:house_leader`,
    senateLeaderRole: `${control.senate.majority}:senate_leader`,
  };
}));

router.get('/congress/:chamber/members', h(async (req) => {
  if (!['house', 'senate'].includes(req.params.chamber)) throw new core.GameError('Unknown chamber.', 404);
  const { rows } = await db.query(
    `SELECT p.id, p.name, p.party, p.is_npc, p.approval, p.avatar_url, s.state, s.district, s.senate_class FROM seats s
     JOIN politicians p ON p.id = s.holder_id WHERE s.chamber = $1 ORDER BY s.state, s.district, s.senate_class`, [req.params.chamber]);
  return { members: rows };
}));

// ---------- Executive & Court ----------
router.get('/executive', h(async () => {
  const pres = await core.presidentSeat();
  const { rows: cabinet } = await db.query(
    `SELECT s.id AS seat_id, s.post, p.id, p.name, p.party, p.is_npc, p.avatar_url FROM seats s LEFT JOIN politicians p ON p.id = s.holder_id
     WHERE s.chamber = 'cabinet' ORDER BY s.id`);
  const { rows: noms } = await db.query(
    `SELECT n.*, p.name AS nominee_name, p.party AS nominee_party, p.is_npc AS nominee_npc, s.chamber, s.post FROM nominations n
     JOIN politicians p ON p.id = n.nominee_id JOIN seats s ON s.id = n.seat_id ORDER BY n.id DESC LIMIT 30`);
  const { rows: orders } = await db.query(`SELECT * FROM bills WHERE kind = 'executive_order' ORDER BY id DESC LIMIT 20`);
  return {
    president: pres && { id: pres.holder_id, name: pres.name, party: pres.party, npc: pres.is_npc, approval: pres.approval },
    cabinet: cabinet.map(c => ({ ...c, title: W.CABINET_POSTS[c.post].name })),
    nominations: noms.map(n => ({ ...n, post_name: n.chamber === 'court' ? `Supreme Court Seat ${n.post}` : W.CABINET_POSTS[n.post].name })),
    orders: await sponsorNames(orders),
  };
}));

router.post('/executive/nominate', ...player, h(async (req) => ({ nomination: await executive.nominate(req.pol, Number(req.body.seatId), req.body.nomineeId ? Number(req.body.nomineeId) : null) })));
router.post('/executive/fire', ...player, h(async (req) => { await executive.fireCabinet(req.pol, Number(req.body.seatId)); }));
router.post('/executive/order', ...player, h(async (req) => { await legislation.executiveOrder(req.pol, req.body.issue, Number(req.body.direction)); return { message: 'Executive order signed.' }; }));
router.post('/nominations/:id/vote', ...player, h(async (req) => { await executive.voteNomination(req.pol, Number(req.params.id), req.body.vote); }));

router.get('/court', h(async () => {
  const { rows: justices } = await db.query(
    `SELECT s.id AS seat_id, s.post, p.id, p.name, p.party, p.is_npc, p.positions, p.avatar_url FROM seats s
     LEFT JOIN politicians p ON p.id = s.holder_id WHERE s.chamber = 'court' ORDER BY s.post::int`);
  const { rows: cases } = await db.query(
    `SELECT c.*, b.number, b.title, b.issue, b.target, f.name AS filed_by_name FROM court_cases c JOIN bills b ON b.id = c.bill_id
     LEFT JOIN politicians f ON f.id = c.filed_by ORDER BY c.id DESC LIMIT 30`);
  return { justices, cases };
}));
router.post('/court/cases/:id/vote', ...player, h(async (req) => { await executive.voteCase(req.pol, Number(req.params.id), req.body.vote); }));

// ---------- Parties ----------
router.get('/parties/:code', h(async (req) => {
  const code = req.params.code;
  if (!['D', 'R'].includes(code)) throw new core.GameError('Unknown party.', 404);
  const { rows: [party] } = await db.query('SELECT * FROM parties WHERE code = $1', [code]);
  const { rows: roles } = await db.query(
    `SELECT r.role, p.id, p.name FROM party_roles r LEFT JOIN politicians p ON p.id = r.holder_id WHERE r.role LIKE $1`, [`${code}:%`]);
  const { rows: members } = await db.query(
    `SELECT p.id, p.name, p.state, p.party_standing, p.avatar_url, s.chamber, s.state AS seat_state, s.district FROM politicians p
     LEFT JOIN seats s ON s.holder_id = p.id WHERE p.party = $1 AND NOT p.is_npc AND NOT p.retired ORDER BY p.party_standing DESC`, [code]);
  const { rows: tallies } = await db.query(
    `SELECT e.role, e.candidate_id, c.name, sum(GREATEST(1, en.party_standing))::float8 AS weight, count(*)::int AS endorsers
     FROM role_endorsements e JOIN politicians en ON en.id = e.endorser_id JOIN politicians c ON c.id = e.candidate_id
     WHERE e.role LIKE $1 GROUP BY e.role, e.candidate_id, c.name ORDER BY weight DESC`, [`${code}:%`]);
  const platforms = await core.partyPlatforms();
  const control = await core.chamberControl();
  return {
    code, name: W.PARTIES[code].name, treasury: party.treasury, dues: party.dues,
    roles: roles.map(r => ({ ...r, title: approval.roleTitle(r.role) })), members, tallies,
    platform: platforms[code], seats: { house: control.house[code], senate: control.senate[code] },
  };
}));

router.post('/parties/endorse', ...player, h(req => actions.endorseRole(req.pol, req.body.role, Number(req.body.candidateId))));
router.post('/parties/donate', ...player, h(req => actions.donateToParty(req.pol, req.body.amount)));
router.post('/parties/dues', ...player, h(req => actions.setDues(req.pol, req.body.dues)));
router.post('/parties/mail', ...player, h(req => actions.massMail(req.pol, req.body.subject, req.body.body)));
router.post('/parties/fund', ...player, h(req => actions.fundCandidate(req.pol, Number(req.body.candidateId), req.body.amount)));
router.post('/parties/primary-endorse', ...player, h(req => actions.endorsePrimary(req.pol, Number(req.body.raceId), Number(req.body.candidateId))));
router.post('/parties/expel', ...player, h(req => actions.expel(req.pol, Number(req.body.memberId))));
router.post('/parties/switch', ...player, h(req => actions.switchParty(req.pol, req.body.party)));

// ---------- Nation, states, people, news ----------
router.get('/nation', h(async () => {
  const { rows: [w] } = await db.query('SELECT * FROM world WHERE id = 1');
  const { rows: policy } = await db.query(
    `SELECT np.*, b.number, b.title FROM national_policy np LEFT JOIN bills b ON b.id = np.law_id`);
  const control = await core.chamberControl();
  const pres = await core.presidentSeat();
  const nat = constituency(null);
  return {
    world: { cycle: w.cycle_number, nextCycleAt: w.next_cycle_at, growth: w.growth, unemployment: w.unemployment, deficit: w.deficit,
      economyScore: approval.economyScore(w) },
    policy: policy.map(p => ({ ...p, name: W.ISSUES[p.issue].name, label: W.ISSUES[p.issue].labels[Number(p.position) + 3], publicPref: nat.prefs[p.issue] })),
    control, president: pres && { id: pres.holder_id, name: pres.name, party: pres.party, approval: pres.approval },
    environment: await core.nationalEnvironment(),
  };
}));

router.get('/states/:code', h(async (req) => {
  const s = W.STATES[req.params.code];
  if (!s) throw new core.GameError('Unknown state.', 404);
  const cons = constituency(s.code);
  const districts = Array.from({ length: s.houseSeats }, (_, i) => {
    const c = constituency(s.code, i + 1);
    return { district: i + 1, shares: c.shares, prefs: c.prefs, lean: c.partisanLean };
  });
  const { rows: officials } = await db.query(
    `SELECT p.id, p.name, p.party, p.is_npc, p.approval, p.avatar_url, s.chamber, s.district, s.senate_class FROM seats s
     JOIN politicians p ON p.id = s.holder_id WHERE s.state = $1 ORDER BY s.chamber DESC, s.district`, [s.code]);
  const { rows: players } = await db.query(
    `SELECT id, name, party, avatar_url FROM politicians WHERE state = $1 AND NOT is_npc AND NOT retired ORDER BY name`, [s.code]);
  const { rows: news } = await db.query('SELECT * FROM news WHERE state = $1 ORDER BY id DESC LIMIT 20', [s.code]);
  const { rows: [{ billions }] } = await db.query(
    `SELECT COALESCE(sum(amount),0) / 1e9 AS billions FROM appropriations WHERE state = $1 AND created_at > now() - $2 ::float8 * interval '1 millisecond'`, [s.code, 14 * R.DAY]);
  return { state: s, profile: { shares: cons.shares, prefs: cons.prefs, lean: cons.partisanLean }, districts, officials, players, news, recentFunding: Number(billions) };
}));

router.get('/politicians', h(async (req) => {
  const q = `%${String(req.query.q || '').slice(0, 40)}%`;
  const { rows } = await db.query(
    `SELECT p.id, p.name, p.party, p.state, p.is_npc, p.avatar_url, s.chamber FROM politicians p LEFT JOIN seats s ON s.holder_id = p.id
     WHERE NOT p.retired AND p.name ILIKE $1 AND (NOT p.is_npc OR $2) ORDER BY p.is_npc, p.name LIMIT 50`, [q, !!req.query.npc]);
  return { politicians: rows };
}));

router.get('/politicians/:id', h(async (req) => {
  const { rows: [p] } = await db.query(
    `SELECT id, name, party, state, district, bio, avatar_url, positions, approval, credibility, party_standing, is_npc, retired, created_at
     FROM politicians WHERE id = $1`, [req.params.id]);
  if (!p) throw new core.GameError('Not found.', 404);
  const seat = await core.seatOf(p.id);
  const { rows: titles } = await db.query('SELECT * FROM title_history WHERE politician_id = $1 ORDER BY term_start DESC', [p.id]);
  const { rows: record } = await db.query('SELECT * FROM position_record WHERE politician_id = $1 ORDER BY created_at DESC LIMIT 30', [p.id]);
  const { rows: votes } = await db.query(
    `SELECT v.stage, v.vote, v.created_at, b.id AS bill_id, b.number, b.title FROM bill_votes v JOIN bills b ON b.id = v.bill_id
     WHERE v.politician_id = $1 ORDER BY v.created_at DESC LIMIT 30`, [p.id]);
  const { rows: scandals } = await db.query('SELECT description, severity, created_at FROM skeletons WHERE politician_id = $1 AND public ORDER BY id DESC', [p.id]);
  const { rows: roles } = await db.query('SELECT role FROM party_roles WHERE holder_id = $1', [p.id]);
  return {
    politician: p, office: seat ? core.seatTitle(seat) : null, roles: roles.map(r => approval.roleTitle(r.role)),
    titles, record, votes, scandals,
  };
}));

router.get('/news', h(async (req) => {
  const limit = Math.min(100, Number(req.query.limit) || 40);
  const { rows } = await db.query('SELECT * FROM news ORDER BY id DESC LIMIT $1', [limit]);
  return { news: rows };
}));

module.exports = router;
