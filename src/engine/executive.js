// The executive and judicial branches: cabinet, Senate confirmations, the Supreme Court.
const db = require('../db');
const R = require('../config/rules');
const { ISSUES, ISSUE_KEYS, CABINET_POSTS, STATE_CODES } = require('../config/world');
const { clamp } = require('./electorate');
const core = require('./core');
const legislation = require('./legislation');

function seatName(seat) {
  return seat.chamber === 'court' ? `Supreme Court Seat ${seat.post}` : CABINET_POSTS[seat.post].name;
}

async function requirePresident(pol) {
  const seat = await core.seatOf(pol.id);
  if (!seat || seat.chamber !== 'president') throw new core.GameError('Only the President can do that.', 403);
}

// ---------- Nominations ----------
async function nominate(pol, seatId, nomineeId) {
  await requirePresident(pol);
  const { rows: [seat] } = await db.query(`SELECT * FROM seats WHERE id = $1 AND chamber IN ('cabinet','court')`, [seatId]);
  if (!seat) throw new core.GameError('No such post.', 404);
  if (seat.chamber === 'court' && seat.holder_id) throw new core.GameError('That Court seat is not vacant.');
  const { rows: pending } = await db.query(`SELECT 1 FROM nominations WHERE seat_id = $1 AND status = 'pending'`, [seat.id]);
  if (pending.length) throw new core.GameError('There is already a pending nomination for this post.');

  let nominee;
  if (nomineeId) {
    ({ rows: [nominee] } = await db.query('SELECT * FROM politicians WHERE id = $1 AND NOT is_npc AND NOT retired', [nomineeId]));
    if (!nominee) throw new core.GameError('Nominee not found.');
    if (nominee.id === pol.id) throw new core.GameError('You cannot nominate yourself.');
  } else {
    nominee = await core.createNpc({ party: pol.party === 'I' ? core.pick(['D', 'R']) : pol.party, state: core.pick(STATE_CODES) });
  }
  await core.spend(pol.id, { hours: 1, pc: 2 });
  const { rows: [nom] } = await db.query(
    `INSERT INTO nominations (kind, seat_id, nominee_id, president_id, deadline) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [seat.chamber, seat.id, nominee.id, pol.id, new Date(Date.now() + R.CONFIRMATION_WINDOW)]
  );
  await core.addNews('nomination', `President ${pol.name} nominates ${nominee.name} for ${seatName(seat)}. The Senate will vote on confirmation.`);
  if (!nominee.is_npc) await core.sendInbox(nominee.id, 'The White House', `You have been nominated: ${seatName(seat)}`, 'If the Senate confirms you, you will leave any seat you currently hold.');
  return nom;
}

async function fireCabinet(pol, seatId) {
  await requirePresident(pol);
  const { rows: [seat] } = await db.query(`SELECT * FROM seats WHERE id = $1 AND chamber = 'cabinet'`, [seatId]);
  if (!seat?.holder_id) throw new core.GameError('That post is already vacant.');
  const { rows: [h] } = await db.query('SELECT name, is_npc FROM politicians WHERE id = $1', [seat.holder_id]);
  await db.query(`UPDATE title_history SET term_end = now() WHERE politician_id = $1 AND term_end IS NULL`, [seat.holder_id]);
  await db.query('UPDATE seats SET holder_id = NULL WHERE id = $1', [seat.id]);
  if (h.is_npc) await db.query('UPDATE politicians SET retired = true WHERE id = $1', [seat.holder_id]);
  await core.addNews('cabinet', `President ${pol.name} dismisses ${h.name} as ${seatName(seat)}.`);
}

async function voteNomination(pol, nominationId, vote) {
  if (!['yes', 'no'].includes(vote)) throw new core.GameError('Vote yes or no.');
  const seat = await core.seatOf(pol.id);
  if (!seat || seat.chamber !== 'senate') throw new core.GameError('Only senators vote on confirmations.', 403);
  const { rows: [nom] } = await db.query(`SELECT * FROM nominations WHERE id = $1 AND status = 'pending'`, [nominationId]);
  if (!nom) throw new core.GameError('Nomination not pending.');
  const { rowCount } = await db.query('INSERT INTO nomination_votes VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [nom.id, pol.id, vote]);
  if (!rowCount) throw new core.GameError('You already voted.');
}

function distance(a, b) {
  return ISSUE_KEYS.reduce((s, i) => s + Math.abs((a[i] ?? 0) - (b[i] ?? 0)), 0) / ISSUE_KEYS.length;
}

async function resolveNominations() {
  const { rows: noms } = await db.query(`SELECT * FROM nominations WHERE status = 'pending' AND deadline <= now()`);
  if (!noms.length) return 0;
  const senators = await legislation.chamberMembers('senate');
  const platforms = await core.partyPlatforms();
  const pres = await core.presidentSeat();
  for (const nom of noms) {
    const { rows: [nominee] } = await db.query('SELECT * FROM politicians WHERE id = $1', [nom.nominee_id]);
    const { rows: [seat] } = await db.query('SELECT * FROM seats WHERE id = $1', [nom.seat_id]);
    const { rows: cast } = await db.query('SELECT * FROM nomination_votes WHERE nomination_id = $1', [nom.id]);
    let yes = 0, no = 0;
    for (const s of senators) {
      const c = cast.find(x => x.politician_id === s.id);
      let v;
      if (c) v = c.vote;
      else if (!s.is_npc) continue;
      else {
        const plat = platforms[s.party] || s.positions;
        const stakes = seat.chamber === 'court' ? 1.5 : 1;
        const score = (s.party === pres?.party ? 0.35 : -0.1) + (Number(pres?.approval || 50) - 50) / 150
          + (2 - distance(nominee.positions, plat)) * 0.12 * stakes + core.rand(-0.05, 0.05);
        v = score > 0 ? 'yes' : 'no';
      }
      v === 'yes' ? yes++ : no++;
    }
    const confirmed = yes > no;
    await db.query('UPDATE nominations SET status = $1, yes = $2, no = $3 WHERE id = $4', [confirmed ? 'confirmed' : 'rejected', yes, no, nom.id]);
    if (confirmed) {
      if (seat.chamber === 'cabinet' && seat.holder_id) {
        await db.query('UPDATE politicians SET retired = true WHERE id = $1 AND is_npc', [seat.holder_id]);
      }
      await core.assignSeat(seat.id, nominee.id);
      await core.addNews('nomination', `Senate confirms ${nominee.name} as ${seatName(seat)}, ${yes}-${no}.`);
      if (!nominee.is_npc) await core.sendInbox(nominee.id, 'U.S. Senate', `Confirmed: ${seatName(seat)}`, `The Senate voted ${yes}-${no}.`);
    } else {
      await core.addNews('nomination', `Senate rejects ${nominee.name} for ${seatName(seat)}, ${yes}-${no}.`);
      if (nominee.is_npc) await db.query('UPDATE politicians SET retired = true WHERE id = $1', [nominee.id]);
    }
  }
  return noms.length;
}

// An NPC president fills vacancies right away.
async function npcPresidentFillsVacancies() {
  const pres = await core.presidentSeat();
  if (!pres?.holder_id || !pres.is_npc) return;
  const { rows: vacant } = await db.query(
    `SELECT s.* FROM seats s WHERE s.chamber IN ('cabinet','court') AND s.holder_id IS NULL
     AND NOT EXISTS (SELECT 1 FROM nominations n WHERE n.seat_id = s.id AND n.status = 'pending')`
  );
  for (const seat of vacant) {
    const nominee = await core.createNpc({ party: pres.party, state: core.pick(STATE_CODES) });
    await db.query(`INSERT INTO nominations (kind, seat_id, nominee_id, president_id, deadline) VALUES ($1,$2,$3,$4,$5)`,
      [seat.chamber, seat.id, nominee.id, pres.holder_id, new Date(Date.now() + R.CONFIRMATION_WINDOW)]);
    await core.addNews('nomination', `President ${pres.name} nominates ${nominee.name} for ${seatName(seat)}.`);
  }
}

// ---------- Cabinet powers ----------
async function departmentInitiative(pol) {
  const seat = await core.seatOf(pol.id);
  if (!seat || seat.chamber !== 'cabinet') throw new core.GameError('Only cabinet secretaries can launch department initiatives.', 403);
  await core.spend(pol.id, { hours: 3, pc: 5 });
  const pres = await core.presidentSeat();
  if (pres?.holder_id) await core.addApprovalMod(pres.holder_id, 2, `${CABINET_POSTS[seat.post].name} initiative`, 7);
  await core.addRecognition(pol.id, pol.state, 3);
  if (seat.post === 'treasury') await db.query('UPDATE world SET growth = growth + 0.1');
  if (seat.post === 'labor') await db.query('UPDATE world SET unemployment = GREATEST(2, unemployment - 0.1)');
  await core.addNews('cabinet', `${CABINET_POSTS[seat.post].name} ${pol.name} announces a new department initiative.`);
}

// ---------- Supreme Court ----------
async function fileCase(pol, billId) {
  const seat = await core.seatOf(pol.id);
  const { rows: chair } = await db.query('SELECT 1 FROM party_roles WHERE role = $1 AND holder_id = $2', [`${pol.party}:chair`, pol.id]);
  if ((!seat || !['house', 'senate', 'president', 'cabinet'].includes(seat.chamber)) && !chair.length) {
    throw new core.GameError('Only officeholders and party chairs can bring a legal challenge.', 403);
  }
  const { rows: [bill] } = await db.query(`SELECT * FROM bills WHERE id = $1 AND status = 'law'`, [billId]);
  if (!bill) throw new core.GameError('Only laws in force can be challenged.');
  if (bill.kind === 'appropriation') throw new core.GameError('Spending laws cannot be challenged in court.');
  const { rows: pending } = await db.query(`SELECT 1 FROM court_cases WHERE bill_id = $1 AND status = 'pending'`, [bill.id]);
  if (pending.length) throw new core.GameError('This law is already before the Court.');
  await core.spend(pol.id, R.CASE_FILING);
  const { rows: [c] } = await db.query(
    `INSERT INTO court_cases (bill_id, filed_by, deadline) VALUES ($1,$2,$3) RETURNING *`,
    [bill.id, pol.id, new Date(Date.now() + R.CASE_WINDOW)]
  );
  await core.addNews('court', `${pol.name} v. United States: the Supreme Court will hear a challenge to ${bill.number} "${bill.title}".`);
  return c;
}

async function voteCase(pol, caseId, vote) {
  if (!['uphold', 'strike'].includes(vote)) throw new core.GameError('Vote to uphold or strike.');
  const seat = await core.seatOf(pol.id);
  if (!seat || seat.chamber !== 'court') throw new core.GameError('Only justices rule on cases.', 403);
  const { rows: [c] } = await db.query(`SELECT * FROM court_cases WHERE id = $1 AND status = 'pending'`, [caseId]);
  if (!c) throw new core.GameError('Case not pending.');
  const { rowCount } = await db.query('INSERT INTO case_votes VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [c.id, pol.id, vote]);
  if (!rowCount) throw new core.GameError('You already ruled on this case.');
}

// NPC justices strike laws that move policy away from their judicial philosophy and land far from it.
function npcJusticeVote(justice, bill) {
  const view = justice.positions[bill.issue] ?? 0;
  const to = Number(bill.target), from = Number(bill.prev_position ?? to);
  const movesAway = Math.abs(to - view) > Math.abs(from - view);
  return movesAway && Math.abs(to - view) >= 2.5 ? 'strike' : 'uphold';
}

async function resolveCases() {
  const { rows: cases } = await db.query(`SELECT * FROM court_cases WHERE status = 'pending' AND deadline <= now()`);
  if (!cases.length) return 0;
  const { rows: justices } = await db.query(`SELECT p.* FROM seats s JOIN politicians p ON p.id = s.holder_id WHERE s.chamber = 'court'`);
  for (const c of cases) {
    const { rows: [bill] } = await db.query('SELECT * FROM bills WHERE id = $1', [c.bill_id]);
    const { rows: cast } = await db.query('SELECT * FROM case_votes WHERE case_id = $1', [c.id]);
    let uphold = 0, strike = 0;
    for (const j of justices) {
      const v = cast.find(x => x.politician_id === j.id)?.vote || (j.is_npc ? npcJusticeVote(j, bill) : null);
      if (v === 'strike') strike++; else if (v === 'uphold') uphold++;
    }
    const struck = strike > uphold;
    await db.query('UPDATE court_cases SET status = $1, uphold = $2, strike = $3 WHERE id = $4', [struck ? 'struck' : 'upheld', uphold, strike, c.id]);
    if (struck && bill.status === 'law') {
      await legislation.strike(bill, `Struck down by the Supreme Court, ${strike}-${uphold}.`);
      await core.addNews('court', `Supreme Court strikes down ${bill.number} "${bill.title}", ${strike}-${uphold}. ${ISSUES[bill.issue].name} policy reverts.`);
    } else {
      await core.addNews('court', `Supreme Court upholds ${bill.number} "${bill.title}", ${uphold}-${strike}.`);
    }
  }
  return cases.length;
}

async function justiceRetirements(elapsedDays) {
  const { rows } = await db.query(`SELECT s.id AS seat_id, p.* FROM seats s JOIN politicians p ON p.id = s.holder_id WHERE s.chamber = 'court' AND p.is_npc`);
  for (const j of rows) {
    if (Math.random() < R.JUSTICE_RETIRE_CHANCE_PER_DAY * elapsedDays) {
      await db.query('UPDATE seats SET holder_id = NULL WHERE id = $1', [j.seat_id]);
      await db.query(`UPDATE title_history SET term_end = now() WHERE politician_id = $1 AND term_end IS NULL`, [j.id]);
      await db.query('UPDATE politicians SET retired = true WHERE id = $1', [j.id]);
      await core.addNews('court', `Justice ${j.name} announces retirement from the Supreme Court, opening a vacancy.`);
      const pres = await core.presidentSeat();
      if (pres?.holder_id && !pres.is_npc) await core.sendInbox(pres.holder_id, 'White House Counsel', 'Supreme Court vacancy', `Justice ${j.name} has retired. Nominate a successor from the Executive page.`);
    }
  }
}

module.exports = {
  nominate, fireCabinet, voteNomination, resolveNominations, npcPresidentFillsVacancies,
  departmentInitiative, fileCase, voteCase, resolveCases, justiceRetirements, seatName, clamp,
};
