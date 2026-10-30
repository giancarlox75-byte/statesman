// The electorate: who lives in each constituency, what they want, and how they'd vote.
// Pure functions only — no database access — so elections, NPC votes and approval all
// agree on the same model of the voters.
const { ISSUE_KEYS, BLOCS, BLOC_KEYS, PARTIES, STATES } = require('../config/world');

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
// Recenters the country so the nation as a whole is close to evenly split.
const LEAN_OFFSET = -0.07;

function blocWeights(params, urban) {
  const { religious, union, seniors } = params;
  return {
    urban_professionals: urban * urban * (1 - religious) * 1.2,
    working_class: 0.6 * (1 - 0.4 * urban) + union * 0.8,
    suburban: 0.9 * (1 - Math.abs(urban - 0.7)),
    rural: (1 - urban) * 1.4,
    small_business: 0.45,
    religious: religious,
    young: 0.35 + 0.3 * urban,
    seniors: 0.3 + seniors * 0.8,
  };
}

const cache = new Map();

// A constituency: a House district (state + district number), a whole state (district null),
// or the nation (state null). Returns bloc shares, per-bloc lean, and the aggregate preference.
function constituency(state, district = null) {
  const key = `${state || 'US'}:${district || 0}`;
  if (cache.has(key)) return cache.get(key);

  let result;
  if (!state) {
    result = combine(Object.values(STATES).map(s => [constituency(s.code), s.houseSeats]));
  } else if (district == null && STATES[state].houseSeats > 1) {
    const n = STATES[state].houseSeats;
    result = combine(Array.from({ length: n }, (_, i) => [constituency(state, i + 1), 1]));
  } else {
    const s = STATES[state];
    const n = s.houseSeats;
    // spread districts from most urban (district 1) to least urban
    const offset = n > 1 ? 0.25 - 0.5 * ((district || 1) - 1) / (n - 1) : 0;
    const urban = clamp(s.urban + offset, 0.05, 0.99);
    const w = blocWeights(s, urban);
    const total = Object.values(w).reduce((a, b) => a + b, 0);
    const shares = {}, lean = {};
    for (const b of BLOC_KEYS) {
      shares[b] = w[b] / total;
      lean[b] = clamp(BLOCS[b].lean * 0.7 + s.lean * 0.5 - offset * 0.6 + LEAN_OFFSET, -1, 1);
    }
    result = { shares, lean };
  }
  result.prefs = aggregatePrefs(result.shares);
  result.salience = aggregateSalience(result.shares);
  result.partisanLean = BLOC_KEYS.reduce((a, b) => a + result.shares[b] * result.lean[b], 0);
  cache.set(key, result);
  return result;
}

function combine(parts) {
  const shares = {}, lean = {};
  let total = 0;
  for (const [, w] of parts) total += w;
  for (const b of BLOC_KEYS) {
    let s = 0, l = 0;
    for (const [c, w] of parts) { s += c.shares[b] * w; l += c.shares[b] * c.lean[b] * w; }
    shares[b] = s / total;
    lean[b] = s ? l / s : BLOCS[b].lean;
  }
  return { shares, lean };
}

function sal(bloc, issue) { return BLOCS[bloc].salience[issue] || 1; }

function aggregatePrefs(shares) {
  const out = {};
  for (const i of ISSUE_KEYS) {
    let num = 0, den = 0;
    for (const b of BLOC_KEYS) { const w = shares[b] * sal(b, i); num += w * BLOCS[b].prefs[i]; den += w; }
    out[i] = num / den;
  }
  return out;
}

function aggregateSalience(shares) {
  const out = {};
  for (const i of ISSUE_KEYS) out[i] = BLOC_KEYS.reduce((a, b) => a + shares[b] * sal(b, i), 0);
  return out;
}

// 0..1 — how well a set of positions matches a bloc (optionally with shifted prefs).
function issueFit(positions, bloc, prefsOverride) {
  let num = 0, den = 0;
  for (const i of ISSUE_KEYS) {
    const pref = prefsOverride ? prefsOverride[i] : BLOCS[bloc].prefs[i];
    const s = sal(bloc, i);
    num += s * Math.abs((positions[i] ?? 0) - pref);
    den += s * 6;
  }
  return 1 - num / den;
}

// 0..1 — how well a set of positions (e.g. current national law) satisfies a constituency.
function policySatisfaction(policy, cons) {
  let num = 0, den = 0;
  for (const b of BLOC_KEYS) {
    for (const i of ISSUE_KEYS) {
      const w = cons.shares[b] * sal(b, i);
      num += w * Math.abs(policy[i] - BLOCS[b].prefs[i]);
      den += w * 6;
    }
  }
  return 1 - num / den;
}

function partyAffinity(blocLean, party, environment = {}) {
  if (party === 'I') return 0.35;
  const pl = PARTIES[party].lean + (environment[party] || 0);
  return clamp(1 - Math.abs(blocLean - pl) / 2, 0, 1);
}

// How a single constituency splits its vote between candidates.
// candidates: [{ id, party, positions, awareness (0-100), gotv (0-1), blocBoost {bloc: x}, incumbentApproval|null, credibility }]
// mode: 'general' or 'primary' (primary: party electorate only, preferences pulled toward the platform)
function voteShares(cons, candidates, { mode = 'general', party = null, environment = {} } = {}) {
  const perBloc = {};
  const totals = Object.fromEntries(candidates.map(c => [c.id, 0]));
  let turnoutTotal = 0;

  for (const b of BLOC_KEYS) {
    let weight = cons.shares[b] * BLOCS[b].turnout;
    let prefs = null;
    if (mode === 'primary') {
      const aff = partyAffinity(cons.lean[b], party);
      weight *= aff * aff;
      const plat = PARTIES[party].platform;
      prefs = {};
      for (const i of ISSUE_KEYS) prefs[i] = 0.5 * BLOCS[b].prefs[i] + 0.5 * plat[i];
    }
    if (weight <= 0) continue;

    const scores = candidates.map(c => {
      const fit = issueFit(c.positions, b, prefs);
      const party = mode === 'primary' ? 0.5 : partyAffinity(cons.lean[b], c.party, environment);
      const aware = clamp(c.awareness, 0, 100) / 100;
      let s = 0.45 * fit + 0.35 * party + 0.2 * aware;
      s *= 1 + (c.blocBoost?.[b] || 0);
      if (c.incumbentApproval != null) s += (c.incumbentApproval - 50) / 250;
      s *= 0.75 + 0.25 * clamp(c.credibility ?? 70, 0, 100) / 100;
      return s;
    });
    const max = Math.max(...scores);
    const exps = scores.map(s => Math.exp(9 * (s - max)));
    const sum = exps.reduce((a, b) => a + b, 0);
    perBloc[b] = {};
    candidates.forEach((c, k) => {
      const share = exps[k] / sum;
      perBloc[b][c.id] = share;
      const turnoutLift = 1 + (c.gotv || 0) * share; // GOTV pulls out your own supporters
      totals[c.id] += weight * share * turnoutLift;
    });
    turnoutTotal += weight;
  }
  const sum = Object.values(totals).reduce((a, b) => a + b, 0) || 1;
  const shares = Object.fromEntries(Object.entries(totals).map(([id, v]) => [id, v / sum]));
  return { shares, perBloc, turnout: turnoutTotal };
}

// Bills: how much a constituency (or a platform) gains from moving law on `issue` from `from` to `to`.
// Returns roughly -1..1, scaled by how much they care.
function policyBenefit(pref, salience, from, to) {
  return ((Math.abs(from - pref) - Math.abs(to - pref)) / 6) * salience;
}

module.exports = {
  constituency, voteShares, issueFit, policySatisfaction, partyAffinity, policyBenefit, clamp,
};
