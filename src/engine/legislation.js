// Legislation: House -> Senate (or Senate -> House) -> President -> (veto override) -> law.
// Every seat votes. Players vote by hand; NPC members vote at the deadline based on their
// constituents, their party's platform, the whip, and any backroom deals.
const db = require('../db');
const R = require('../config/rules');
const { ISSUES, ISSUE_KEYS, ECONOMIC_EFFECTS, STATES } = require('../config/world');
const { constituency, policyBenefit, clamp } = require('./electorate');
const core = require('./core');

const CHAMBER_NAME = { house: 'House', senate: 'Senate' };

function describeBill(b) {
  if (b.kind === 'appropriation') return `$${Number(b.approp_amount).toLocaleString()} for ${STATES[b.approp_state]?.name}`;
  if (b.issue) return `${ISSUES[b.issue].name}: ${ISSUES[b.issue].labels[Number(b.target) + 3]}`;
  return '';
}

function pushHistory(bill, text) {
  return [...(bill.history || []), { at: new Date().toISOString(), text }];
}

async function chamberMembers(chamber) {
  const { rows } = await db.query(
    `SELECT p.*, s.state AS seat_state, s.district AS seat_district FROM seats s JOIN politicians p ON p.id = s.holder_id WHERE s.chamber = $1`,
    [chamber]
  );
  return rows;
}

function memberConstituency(m, chamber) {
  return constituency(m.seat_state, chamber === 'house' ? m.seat_district : null);
}

// 0..1: how well a yes/no vote serves this member's constituents.
function voteAlignment(bill, cons, memberState, vote, policy) {
  let yes;
  if (bill.kind === 'appropriation') {
    yes = bill.approp_state === memberState ? 1 : 0.45;
  } else {
    const from = policy[bill.issue], to = Number(bill.target);
    yes = 0.5 + clamp(policyBenefit(cons.prefs[bill.issue], 1, from, to) * 1.5, -0.5, 0.5);
  }
  return vote === 'yes' ? yes : 1 - yes;
}

// Raw inclination of a member toward a bill, before deals. > 0 leans yes.
function npcScore(m, chamber, bill, policy, platforms, whip) {
  const cons = memberConstituency(m, chamber);
  const plat = platforms[m.party];
  const consWeight = 0.55 + (50 - Number(m.approval)) / 200; // vulnerable members listen to voters more
  let s;
  if (bill.kind === 'appropriation') {
    const billions = Number(bill.approp_amount) / 1e9;
    s = bill.approp_state === m.seat_state ? 0.5 : 0.02 - 0.03 * billions - (plat ? 0.02 * Math.max(0, plat.taxes) : 0);
  } else {
    const from = policy[bill.issue], to = Number(bill.target);
    const bc = policyBenefit(cons.prefs[bill.issue], cons.salience[bill.issue], from, to);
    const bp = plat ? policyBenefit(plat[bill.issue], 1, from, to) : bc;
    s = consWeight * bc + (1 - consWeight) * bp;
  }
  const w = whip[`${m.party}:${chamber}`];
  if (w && w.line !== 'free') s += (w.line === 'yes' ? 1 : -1) * (w.hard ? 0.25 : 0.12);
  return s + core.rand(-0.04, 0.04);
}

// ---------- Introducing ----------
async function introduce(pol, input) {
  const seat = await core.seatOf(pol.id);
  if (!seat || !['house', 'senate'].includes(seat.chamber)) throw new core.GameError('Only members of Congress can introduce bills.', 403);
  const title = String(input.title || '').trim().slice(0, 140);
  const summary = String(input.summary || '').trim().slice(0, 2000);
  if (!title) throw new core.GameError('Give your bill a title.');

  const policy = await core.getPolicy();
  const kind = input.kind === 'appropriation' ? 'appropriation' : 'policy';
  let issue = null, target = null, apState = null, apAmount = null;
  if (kind === 'policy') {
    issue = input.issue;
    target = Number(input.target);
    if (!ISSUE_KEYS.includes(issue)) throw new core.GameError('Pick an issue.');
    if (!Number.isInteger(target) || target < -3 || target > 3) throw new core.GameError('Pick a policy position.');
    if (policy[issue] === target) throw new core.GameError('That is already the law.');
  } else {
    if (seat.chamber !== 'house') throw new core.GameError('Spending bills must originate in the House.');
    apState = input.approp_state;
    apAmount = Math.round(Number(input.approp_amount));
    if (!STATES[apState]) throw new core.GameError('Pick a state.');
    if (!(apAmount >= 1e8 && apAmount <= 5e9)) throw new core.GameError('Appropriations must be between $100 million and $5 billion.');
  }
  const { rows: [{ n }] } = await db.query(
    `SELECT count(*)::int AS n FROM bills WHERE sponsor_id = $1 AND status IN ('house_floor','senate_floor','president','override')`, [pol.id]
  );
  if (n >= R.MAX_ACTIVE_BILLS_PER_SPONSOR) throw new core.GameError(`You can have at most ${R.MAX_ACTIVE_BILLS_PER_SPONSOR} active bills.`);
  await core.spend(pol.id, R.BILL_COST);

  const { rows: [w] } = await db.query('UPDATE world SET bill_counter = bill_counter + 1 RETURNING bill_counter');
  const number = `${seat.chamber === 'house' ? 'H.R.' : 'S.'} ${w.bill_counter}`;
  const deadline = new Date(Date.now() + R.VOTE_WINDOW);
  const bill = { history: [] };
  const { rows: [created] } = await db.query(
    `INSERT INTO bills (number, title, summary, sponsor_id, origin, kind, issue, target, approp_state, approp_amount, status, stage_deadline, tally, history)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
    [number, title, summary, pol.id, seat.chamber, kind, issue, target, apState, apAmount, `${seat.chamber}_floor`, deadline,
      JSON.stringify({ passed: {} }), JSON.stringify(pushHistory(bill, `Introduced in the ${CHAMBER_NAME[seat.chamber]} by ${pol.name}.`))]
  );
  await core.addNews('bill', `${pol.name} introduces ${number}: "${title}" (${describeBill(created)}).`, pol.state);
  await core.logAction(pol.id, 'introduce_bill', number);
  return created;
}

// Which voting stage a member of `chamber` participates in for this bill, if any.
function stageFor(bill, chamber) {
  if (bill.status === `${chamber}_floor`) return chamber;
  if (bill.status === 'override') return `override_${chamber}`;
  return null;
}

// ---------- Player actions ----------
async function castVote(pol, billId, vote) {
  if (!['yes', 'no'].includes(vote)) throw new core.GameError('Vote yes or no.');
  const { rows: [bill] } = await db.query('SELECT * FROM bills WHERE id = $1', [billId]);
  if (!bill) throw new core.GameError('Bill not found.', 404);
  const seat = await core.seatOf(pol.id);
  const stage = seat && stageFor(bill, seat.chamber);
  if (!stage) throw new core.GameError('You cannot vote on this bill right now.', 403);

  const policy = await core.getPolicy();
  const cons = constituency(seat.state, seat.chamber === 'house' ? seat.district : null);
  const alignment = voteAlignment(bill, cons, seat.state, vote, policy);
  const w = bill.whip[`${pol.party}:${seat.chamber}`];
  const againstWhip = !!(w && w.line !== 'free' && w.line !== vote);

  const { rowCount } = await db.query(
    `INSERT INTO bill_votes (bill_id, politician_id, stage, vote, alignment, against_whip) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,
    [bill.id, pol.id, stage, vote, alignment, againstWhip]
  );
  if (!rowCount) throw new core.GameError('You already voted on this bill.');
  if (w && w.line !== 'free') {
    await db.query('UPDATE politicians SET party_standing = GREATEST(0, LEAST(100, party_standing + $1)) WHERE id = $2',
      [againstWhip ? -R.DEFY_WHIP_STANDING : R.FOLLOW_WHIP_STANDING, pol.id]);
  }
  return { stage, alignment, againstWhip };
}

async function leaderRole(pol, chamber) {
  const { rows } = await db.query(
    `SELECT role FROM party_roles WHERE holder_id = $1 AND role IN ($2, $3)`,
    [pol.id, `${pol.party}:${chamber}_leader`, `${pol.party}:${chamber}_whip`]
  );
  return rows[0]?.role || null;
}

async function setWhip(pol, billId, line, hard) {
  if (!['yes', 'no', 'free'].includes(line)) throw new core.GameError('Whip line must be yes, no, or free.');
  const seat = await core.seatOf(pol.id);
  if (!seat || !['house', 'senate'].includes(seat.chamber)) throw new core.GameError('Only congressional leaders can whip votes.', 403);
  if (!await leaderRole(pol, seat.chamber)) throw new core.GameError('Only your party\'s leader or whip in this chamber can set the whip.', 403);
  const { rows: [bill] } = await db.query('SELECT * FROM bills WHERE id = $1', [billId]);
  if (!bill || !stageFor(bill, seat.chamber)) throw new core.GameError('This bill is not before your chamber.');
  if (hard) await core.spend(pol.id, { pc: 3 });
  const whip = { ...bill.whip, [`${pol.party}:${seat.chamber}`]: { line, hard: !!hard, by: pol.name } };
  await db.query('UPDATE bills SET whip = $1, history = $2 WHERE id = $3',
    [JSON.stringify(whip), JSON.stringify(pushHistory(bill, `${pol.name} whips ${pol.party} ${CHAMBER_NAME[seat.chamber]} members: ${line.toUpperCase()}${hard ? ' (hard whip)' : ''}.`)), bill.id]);
  const members = (await chamberMembers(seat.chamber)).filter(m => !m.is_npc && m.party === pol.party && m.id !== pol.id);
  for (const m of members) await core.sendInbox(m.id, `${pol.party} Whip`, `Whip notice on ${bill.number}: vote ${line.toUpperCase()}`, `${bill.title} — ${describeBill(bill)}`);
}

async function table(pol, billId) {
  const seat = await core.seatOf(pol.id);
  const control = await core.chamberControl();
  if (!seat || !['house', 'senate'].includes(seat.chamber)) throw new core.GameError('Only congressional leaders can table bills.', 403);
  const { rows } = await db.query('SELECT 1 FROM party_roles WHERE role = $1 AND holder_id = $2', [`${control[seat.chamber].majority}:${seat.chamber}_leader`, pol.id]);
  if (!rows.length) throw new core.GameError(`Only the ${seat.chamber === 'house' ? 'Speaker' : 'Majority Leader'} can table bills.`, 403);
  const { rows: [bill] } = await db.query('SELECT * FROM bills WHERE id = $1', [billId]);
  if (!bill || bill.status !== `${seat.chamber}_floor`) throw new core.GameError('This bill is not on your floor.');
  await core.spend(pol.id, { pc: 5 });
  await db.query(`UPDATE bills SET status = 'tabled', stage_deadline = NULL, history = $1 WHERE id = $2`,
    [JSON.stringify(pushHistory(bill, `Tabled by ${pol.name}.`)), bill.id]);
  await core.addNews('bill', `${pol.name} refuses to bring ${bill.number} "${bill.title}" to the floor.`);
}

async function filibuster(pol, billId) {
  const seat = await core.seatOf(pol.id);
  if (!seat || seat.chamber !== 'senate') throw new core.GameError('Only senators can filibuster.', 403);
  const { rows: [bill] } = await db.query('SELECT * FROM bills WHERE id = $1', [billId]);
  if (!bill || bill.status !== 'senate_floor') throw new core.GameError('This bill is not on the Senate floor.');
  if (bill.filibuster) throw new core.GameError('This bill is already being filibustered.');
  await core.spend(pol.id, { hours: 6 });
  await db.query(`UPDATE bills SET filibuster = true, history = $1 WHERE id = $2`,
    [JSON.stringify(pushHistory(bill, `${pol.name} launches a filibuster. Passage now needs ${Math.round(R.CLOTURE_SHARE * 100)} votes for cloture.`)), bill.id]);
  await core.addNews('bill', `Sen. ${pol.name} takes the floor to filibuster ${bill.number} "${bill.title}".`, pol.state);
}

async function backroomDeal(pol, billId, npcId, vote) {
  if (!['yes', 'no'].includes(vote)) throw new core.GameError('Choose yes or no.');
  const mySeat = await core.seatOf(pol.id);
  if (!mySeat) throw new core.GameError('You need to hold office to cut deals.', 403);
  const { rows: [bill] } = await db.query('SELECT * FROM bills WHERE id = $1', [billId]);
  const { rows: [npc] } = await db.query('SELECT p.*, s.chamber FROM politicians p JOIN seats s ON s.holder_id = p.id WHERE p.id = $1', [npcId]);
  if (!bill || !npc || !npc.is_npc || !stageFor(bill, npc.chamber)) throw new core.GameError('That member is not voting on this bill.');
  await core.spend(pol.id, { funds: 15000, pc: 3 });
  await db.query(
    `INSERT INTO vote_deals (bill_id, npc_id, by_id, vote) VALUES ($1,$2,$3,$4) ON CONFLICT (bill_id, npc_id) DO UPDATE SET by_id = $3, vote = $4`,
    [bill.id, npc.id, pol.id, vote]
  );
  await core.addSkeleton(pol.id, `Traded favors with ${npc.name} for a ${vote.toUpperCase()} vote on ${bill.number}`, 2);
  await core.logAction(pol.id, 'backroom_deal', `${npc.name} on ${bill.number}`);
}

async function presidentDecide(pol, billId, decision) {
  const seat = await core.seatOf(pol.id);
  if (!seat || seat.chamber !== 'president') throw new core.GameError('Only the President can sign or veto.', 403);
  const { rows: [bill] } = await db.query('SELECT * FROM bills WHERE id = $1', [billId]);
  if (!bill || bill.status !== 'president') throw new core.GameError('This bill is not on your desk.');
  if (decision === 'sign') await enact(bill, `Signed into law by President ${pol.name}.`);
  else if (decision === 'veto') await veto(bill, pol.name);
  else throw new core.GameError('Sign or veto.');
}

// ---------- Executive orders ----------
async function executiveOrder(pol, issue, direction) {
  const seat = await core.seatOf(pol.id);
  if (!seat || seat.chamber !== 'president') throw new core.GameError('Only the President can issue executive orders.', 403);
  if (!ISSUE_KEYS.includes(issue) || ![-1, 1].includes(Number(direction))) throw new core.GameError('Pick an issue and a direction.');
  const policy = await core.getPolicy();
  const target = clamp(policy[issue] + Number(direction), -3, 3);
  if (target === policy[issue]) throw new core.GameError('Policy cannot move further in that direction.');
  await core.spend(pol.id, { hours: 4, pc: 15 });
  const { rows: [w] } = await db.query('UPDATE world SET bill_counter = bill_counter + 1 RETURNING bill_counter');
  const { rows: [bill] } = await db.query(
    `INSERT INTO bills (number, title, sponsor_id, origin, kind, issue, target, status, tally, history)
     VALUES ($1,$2,$3,'executive','executive_order',$4,$5,'president','{}','[]') RETURNING *`,
    [`E.O. ${w.bill_counter}`, `Executive Order on ${ISSUES[issue].name}`, pol.id, issue, target]
  );
  await enact(bill, `Issued by President ${pol.name}.`);
}

// ---------- Becoming law ----------
async function applyPolicyChange(issue, from, to) {
  const e = ECONOMIC_EFFECTS[issue];
  const d = to - from;
  await db.query(
    `UPDATE world SET growth = growth + $1::float8, unemployment = GREATEST(2, unemployment + $2::float8), deficit = deficit + $3::float8`,
    [e.growth * d, e.unemployment * d, e.deficit * d]
  );
}

async function enact(bill, note) {
  if (bill.kind === 'appropriation') {
    await db.query('INSERT INTO appropriations (state, amount, bill_id) VALUES ($1,$2,$3)', [bill.approp_state, bill.approp_amount, bill.id]);
    await db.query('UPDATE world SET deficit = deficit + $1::float8', [Number(bill.approp_amount) / 1e9 * 0.02]);
  } else {
    const { rows: [cur] } = await db.query('SELECT position FROM national_policy WHERE issue = $1', [bill.issue]);
    const from = Number(cur.position);
    await db.query('UPDATE bills SET prev_position = $1 WHERE id = $2', [from, bill.id]);
    await db.query('UPDATE national_policy SET position = $1, law_id = $2 WHERE issue = $3', [bill.target, bill.id, bill.issue]);
    await applyPolicyChange(bill.issue, from, Number(bill.target));
  }
  await db.query(`UPDATE bills SET status = 'law', stage_deadline = NULL, became_law_at = now(), history = $1 WHERE id = $2`,
    [JSON.stringify(pushHistory(bill, note)), bill.id]);
  await core.addNews('law', `${bill.number} "${bill.title}" is now law — ${describeBill(bill)}.`, bill.approp_state || null);
  if (bill.sponsor_id) {
    await db.query('UPDATE politicians SET pc = pc + 5 WHERE id = $1 AND NOT is_npc', [bill.sponsor_id]);
    await core.sendInbox(bill.sponsor_id, 'Legislative Office', `${bill.number} is now law`, note);
  }
}

async function veto(bill, presidentName) {
  await db.query(`UPDATE bills SET status = 'override', stage_deadline = $1, history = $2 WHERE id = $3`,
    [new Date(Date.now() + R.OVERRIDE_WINDOW), JSON.stringify(pushHistory(bill, `Vetoed by President ${presidentName}. Congress may override with two-thirds of both chambers.`)), bill.id]);
  await core.addNews('veto', `President ${presidentName} vetoes ${bill.number} "${bill.title}". Override vote opens in both chambers.`);
}

// Struck down by the Supreme Court (or repealed): restore the previous position if this law still governs.
async function strike(bill, note) {
  if (bill.kind !== 'appropriation') {
    const { rows: [cur] } = await db.query('SELECT * FROM national_policy WHERE issue = $1', [bill.issue]);
    if (cur.law_id === bill.id && bill.prev_position != null) {
      await db.query('UPDATE national_policy SET position = $1, law_id = NULL WHERE issue = $2', [bill.prev_position, bill.issue]);
      await applyPolicyChange(bill.issue, Number(cur.position), Number(bill.prev_position));
    }
  }
  await db.query(`UPDATE bills SET status = 'struck', history = $1 WHERE id = $2`, [JSON.stringify(pushHistory(bill, note)), bill.id]);
}

// ---------- Deadlines ----------
async function npcVotesFor(bill, chamber, stage) {
  const members = await chamberMembers(chamber);
  const policy = await core.getPolicy();
  const platforms = await core.partyPlatforms();
  const { rows: deals } = await db.query('SELECT npc_id, vote FROM vote_deals WHERE bill_id = $1', [bill.id]);
  const { rows: cast } = await db.query('SELECT politician_id FROM bill_votes WHERE bill_id = $1 AND stage = $2', [bill.id, stage]);
  const already = new Set(cast.map(c => c.politician_id));
  const inserts = [];
  for (const m of members) {
    if (already.has(m.id)) continue;
    const cons = memberConstituency(m, chamber);
    let vote;
    if (m.is_npc) {
      const deal = deals.find(d => d.npc_id === m.id);
      vote = deal ? deal.vote : (npcScore(m, chamber, bill, policy, platforms, bill.whip) > 0 ? 'yes' : 'no');
    } else {
      vote = 'missed';
      await db.query('UPDATE politicians SET party_standing = GREATEST(0, party_standing - $1) WHERE id = $2', [R.MISSED_VOTE_STANDING, m.id]);
      await core.sendInbox(m.id, 'Legislative Office', `You missed the vote on ${bill.number}`, 'Missed votes hurt your approval with constituents and your standing in the party.');
    }
    const alignment = vote === 'missed' ? 0.2 : voteAlignment(bill, cons, m.seat_state, vote, policy);
    inserts.push([bill.id, m.id, stage, vote, alignment]);
  }
  if (inserts.length) {
    const params = inserts.flat();
    const values = inserts.map((_, i) => `($${i * 5 + 1},$${i * 5 + 2},$${i * 5 + 3},$${i * 5 + 4},$${i * 5 + 5})`).join(',');
    await db.query(`INSERT INTO bill_votes (bill_id, politician_id, stage, vote, alignment) VALUES ${values} ON CONFLICT DO NOTHING`, params);
  }
  const { rows } = await db.query(
    `SELECT vote, count(*)::int AS n FROM bill_votes WHERE bill_id = $1 AND stage = $2 GROUP BY vote`, [bill.id, stage]
  );
  const t = { yes: 0, no: 0, missed: 0 };
  for (const r of rows) t[r.vote] = r.n;
  return t;
}

// Would the minority party's NPCs filibuster this bill on their own?
async function autoFilibuster(bill) {
  if (bill.kind === 'appropriation') return false;
  const control = await core.chamberControl();
  const minority = control.senate.majority === 'D' ? 'R' : 'D';
  if (control.senate[minority] < 41) return false;
  const platforms = await core.partyPlatforms();
  const policy = await core.getPolicy();
  return policyBenefit(platforms[minority][bill.issue], 1, policy[bill.issue], Number(bill.target)) < -0.25;
}

async function resolveFloor(bill, chamber) {
  const t = await npcVotesFor(bill, chamber, chamber);
  const tally = { ...bill.tally, [chamber]: t };
  let passed;
  let note;
  const filibuster = chamber === 'senate' && (bill.filibuster || await autoFilibuster(bill));
  if (filibuster) {
    passed = t.yes >= Math.ceil((t.yes + t.no + t.missed) * R.CLOTURE_SHARE);
    note = `Senate ${passed ? 'invokes cloture and passes' : 'fails to break the filibuster on'} the bill, ${t.yes}-${t.no}.`;
  } else {
    passed = t.yes > t.no;
    note = `${CHAMBER_NAME[chamber]} ${passed ? 'passes' : 'rejects'} the bill, ${t.yes}-${t.no}${t.missed ? ` (${t.missed} not voting)` : ''}.`;
  }
  let history = pushHistory(bill, note);
  if (!passed) {
    await db.query(`UPDATE bills SET status = 'failed', stage_deadline = NULL, tally = $1, history = $2 WHERE id = $3`, [JSON.stringify(tally), JSON.stringify(history), bill.id]);
    await core.addNews('bill', `${bill.number} "${bill.title}" dies in the ${CHAMBER_NAME[chamber]}, ${t.yes}-${t.no}.`);
    return;
  }
  tally.passed = { ...(bill.tally.passed || {}), [chamber]: true };
  const other = chamber === 'house' ? 'senate' : 'house';
  const next = tally.passed[other] ? 'president' : `${other}_floor`;
  const deadline = new Date(Date.now() + (next === 'president' ? R.PRESIDENT_WINDOW : R.VOTE_WINDOW));
  await db.query(`UPDATE bills SET status = $1, stage_deadline = $2, tally = $3, history = $4, whip = '{}' WHERE id = $5`,
    [next, deadline, JSON.stringify(tally), JSON.stringify(history), bill.id]);
  if (next === 'president') {
    const pres = await core.presidentSeat();
    if (pres?.holder_id && !pres.is_npc) await core.sendInbox(pres.holder_id, 'Office of Legislative Affairs', `${bill.number} is on your desk`, `${bill.title} — ${describeBill(bill)}. Sign or veto within the window, or it becomes law without your signature.`);
  }
}

async function resolvePresident(bill) {
  const pres = await core.presidentSeat();
  if (pres?.holder_id && !pres.is_npc) {
    return enact(bill, `Became law without the President's signature.`);
  }
  // NPC president signs anything its party doesn't actively oppose.
  let sign = true;
  if (bill.kind !== 'appropriation' && pres?.party && pres.party !== 'I') {
    const platforms = await core.partyPlatforms();
    const policy = await core.getPolicy();
    sign = policyBenefit(platforms[pres.party][bill.issue], 1, policy[bill.issue], Number(bill.target)) >= -0.05;
  }
  if (sign) return enact(bill, `Signed into law by President ${pres?.name || ''}.`);
  return veto(bill, pres?.name || 'the President');
}

async function resolveOverride(bill) {
  const h = await npcVotesFor(bill, 'house', 'override_house');
  const s = await npcVotesFor(bill, 'senate', 'override_senate');
  const ok = t => t.yes >= Math.ceil((t.yes + t.no) * R.OVERRIDE_SHARE) && t.yes > 0;
  const tally = { ...bill.tally, override: { house: h, senate: s } };
  await db.query('UPDATE bills SET tally = $1 WHERE id = $2', [JSON.stringify(tally), bill.id]);
  if (ok(h) && ok(s)) {
    await enact({ ...bill, tally }, `Congress overrides the veto (House ${h.yes}-${h.no}, Senate ${s.yes}-${s.no}).`);
  } else {
    await db.query(`UPDATE bills SET status = 'vetoed', stage_deadline = NULL, history = $1 WHERE id = $2`,
      [JSON.stringify(pushHistory(bill, `Veto sustained (House ${h.yes}-${h.no}, Senate ${s.yes}-${s.no}).`)), bill.id]);
    await core.addNews('veto', `Veto of ${bill.number} sustained.`);
  }
}

async function advanceBills() {
  const { rows } = await db.query(`SELECT * FROM bills WHERE stage_deadline IS NOT NULL AND stage_deadline <= now() ORDER BY id`);
  for (const bill of rows) {
    try {
      if (bill.status === 'house_floor') await resolveFloor(bill, 'house');
      else if (bill.status === 'senate_floor') await resolveFloor(bill, 'senate');
      else if (bill.status === 'president') await resolvePresident(bill);
      else if (bill.status === 'override') await resolveOverride(bill);
    } catch (err) { console.error('Bill advance failed', bill.id, err); }
  }
  return rows.length;
}

// Projected NPC vote count for a bill in a chamber — the whip count. Visible to party leadership.
async function whipCount(bill, chamber) {
  const members = await chamberMembers(chamber);
  const policy = await core.getPolicy();
  const platforms = await core.partyPlatforms();
  const stage = stageFor(bill, chamber) || chamber;
  const { rows: cast } = await db.query('SELECT politician_id, vote FROM bill_votes WHERE bill_id = $1 AND stage = $2', [bill.id, stage]);
  const { rows: deals } = await db.query('SELECT npc_id, vote FROM vote_deals WHERE bill_id = $1', [bill.id]);
  const out = { yes: 0, no: 0, undecided: 0, members: [] };
  for (const m of members) {
    const c = cast.find(x => x.politician_id === m.id);
    let lean;
    if (c) lean = c.vote;
    else if (!m.is_npc) lean = 'undecided';
    else {
      const deal = deals.find(d => d.npc_id === m.id);
      const s = deal ? (deal.vote === 'yes' ? 1 : -1) : npcScore(m, chamber, bill, policy, platforms, bill.whip);
      lean = s > 0.06 ? 'yes' : s < -0.06 ? 'no' : 'undecided';
    }
    out[lean === 'missed' ? 'no' : lean]++;
    out.members.push({ id: m.id, name: m.name, party: m.party, state: m.seat_state, district: m.seat_district, npc: m.is_npc, lean, voted: !!c });
  }
  return out;
}

module.exports = {
  describeBill, introduce, castVote, setWhip, table, filibuster, backroomDeal, presidentDecide,
  executiveOrder, enact, strike, advanceBills, whipCount, chamberMembers, stageFor, voteAlignment,
};
