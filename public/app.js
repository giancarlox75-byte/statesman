// Statesman client: a small hash-routed SPA. Views return HTML; clicks and form submits are
// handled by delegation through data-act / data-form attributes.
const S = { me: null, meta: null, route: '' };
const root = document.getElementById('root');

// ---------- Utilities ----------
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => '$' + Math.round(Number(n) || 0).toLocaleString();
const num1 = n => (Math.round(Number(n) * 10) / 10).toLocaleString();
const pct = n => `${num1(n)}%`;
const ago = t => {
  const s = (Date.now() - new Date(t)) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};
const until = t => {
  if (!t) return '';
  const s = (new Date(t) - Date.now()) / 1000;
  if (s <= 0) return 'closing';
  if (s < 3600) return `${Math.ceil(s / 60)} min`;
  if (s < 86400) return `${Math.round(s / 3600)} hours`;
  return `${Math.round(s / 86400)} days`;
};

async function api(path, body) {
  const res = await fetch('/api' + path, {
    method: body ? 'POST' : 'GET', credentials: 'include',
    headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

function toast(msg, isError) {
  const el = document.createElement('div');
  el.className = 'toast' + (isError ? ' error' : '');
  el.textContent = msg;
  document.getElementById('toast').appendChild(el);
  setTimeout(() => el.remove(), isError ? 6000 : 4500);
}

const partyDot = p => `<span class="party ${esc(p)}">${esc(p)}</span>`;
function avatar(p, lg) {
  const cls = 'avatar' + (lg ? ' lg' : '');
  if (p?.avatar_url) return `<img class="${cls}" src="${esc(p.avatar_url)}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'${cls}',textContent:'${esc((p.name || '?')[0])}'}))">`;
  return `<span class="${cls}">${esc((p?.name || '?')[0])}</span>`;
}
const who = (p, { npc = true } = {}) => p && p.id
  ? `<a class="who" href="#/p/${p.id}">${partyDot(p.party)}${esc(p.name)}${npc && (p.is_npc || p.npc) ? ' <span class="npc-tag">NPC</span>' : ''}</a>`
  : '<span class="muted">Vacant</span>';
const pill = (s, text) => `<span class="pill ${esc(s)}">${esc(text || String(s).replace(/_/g, ' '))}</span>`;
const stateName = c => S.meta?.states[c]?.name || c;
const issueLabel = (issue, v) => S.meta.issues[issue].labels[Math.round(Number(v)) + 3];
const STATUS_TEXT = { house_floor: 'House floor', senate_floor: 'Senate floor', president: "President's desk", override: 'Veto override vote', law: 'Law', failed: 'Failed', vetoed: 'Vetoed', tabled: 'Tabled', struck: 'Struck down' };

function spectrum(marks) {
  return `<div class="spectrum">${marks.map(m => `<span class="mark ${m.cls || ''}" style="left:${((Number(m.v) + 3) / 6 * 100).toFixed(1)}%" title="${esc(m.title || '')}"></span>`).join('')}</div>`;
}

// ---------- Shell ----------
function navMenu(label, items) {
  return `<div class="nav-item"><button class="nav-link" data-act="menu">${label} <span class="caret">▼</span></button>
    <div class="nav-menu">${items.map(i => i === '-' ? '<div class="sep"></div>' : `<a href="${i[1]}">${esc(i[0])}</a>`).join('')}</div></div>`;
}

function shell(content) {
  const me = S.me, p = me.politician;
  const home = p.state;
  const nav = `
    <nav class="topnav"><div class="inner">
      <a class="brand" href="#/">${Art.mark}<span>STATESMAN</span></a>
      <button class="nav-link nav-toggle" data-act="navtoggle">Menu ☰</button>
      <div class="nav-collapse">
        <a class="nav-link" href="#/">${esc(p.name)}</a>
        <a class="nav-link" href="#/actions">Actions</a>
        ${navMenu(esc(home), [[`${stateName(home)} overview`, `#/state/${home}`], ['Races & candidates', '#/races'], ['My campaign', '#/campaign']])}
        ${navMenu('USA', [['Current law & economy', '#/nation'], ['The White House', '#/executive'], ['Supreme Court', '#/court'], '-', ['All states', '#/states'], ['Directory', '#/directory']])}
        ${navMenu('Congress', [['The House', '#/house'], ['The Senate', '#/senate'], '-', ['Introduce a bill', '#/introduce'], ['Laws on the books', '#/laws']])}
        ${navMenu('Parties', [['Democratic Party', '#/party/D'], ['Republican Party', '#/party/R']])}
        <a class="nav-link" href="#/news">News</a>
        <a class="nav-link" href="#/inbox">Inbox ${me.unread ? `<span class="badge">${me.unread}</span>` : ''}</a>
        ${navMenu('Player', [['My positions', '#/positions'], ['Dossier', '#/dossier'], ['Public profile', `#/p/${p.id}`], ...(me.user.is_admin ? [['Admin', '#/admin']] : []), '-', ['Sign out', '#/logout']])}
      </div>
    </div></nav>`;
  const bar = `<div class="resource-bar">
    <span class="hours">HOURS: <b>${num1(p.hours)}</b>/${S.meta.rules.HOURS_CAP}</span>
    <span class="funds">FUNDS: <b>${money(p.funds)}</b></span>
    <span class="pc">CAPITAL: <b>${num1(p.pc)}</b></span>
    ${me.seat && ['house', 'senate', 'president'].includes(me.seat.chamber) ? `<span>APPROVAL: <b>${pct(p.approval)}</b></span>` : ''}
    <span>CREDIBILITY: <b>${Math.round(p.credibility)}</b></span>
  </div>`;
  return `${nav}<main class="page">${content}</main>${bar}`;
}

// ---------- Views ----------
const views = {};

views.landing = () => `
  <div class="landing"><div class="wrap">
    <div class="row" style="justify-content:space-between"><div class="brand">${Art.mark}<span>STATESMAN</span></div></div>
    <div class="hero">
      <div>
        <p class="eyebrow">A persistent political simulation</p>
        <h1>Every vote counts.<br><em>Every vote is remembered.</em></h1>
        <p class="lede">Win your district. Climb to the Senate and the White House. Whip votes, confirm a cabinet, fill the Supreme Court — and answer to voters who remember how you voted on the issues they care about.</p>
      </div>
      <div class="auth">
        <div class="tabs"><button class="btn" data-act="authmode" data-mode="login" id="tabLogin">Sign in</button><button class="btn ghost" data-act="authmode" data-mode="register" id="tabRegister">Create account</button></div>
        <form data-form="auth" data-mode="login">
          <div class="field"><label>Email</label><input name="email" type="email" required autocomplete="email"></div>
          <div class="field"><label>Password</label><input name="password" type="password" required minlength="6" autocomplete="current-password"></div>
          <button class="btn gold block" type="submit">Sign in</button>
        </form>
      </div>
    </div>
    <div class="features">
      <div class="feature"><h3>Voters with memories</h3><p>Eight voter blocs in every district, each with real priorities. Your votes and your flip-flops follow you to the ballot box.</p></div>
      <div class="feature"><h3>A working Congress</h3><p>Every seat votes on every bill. Whip your caucus, cut deals, filibuster, override vetoes.</p></div>
      <div class="feature"><h3>Three branches</h3><p>Presidents sign laws, issue orders, and nominate a cabinet and justices — who can strike your laws down.</p></div>
      <div class="feature"><h3>Dirty politics</h3><p>Dark money buys ads today and becomes a scandal tomorrow. Dig up dirt, leak it, or use it on air.</p></div>
    </div>
  </div></div>`;

views.create = () => {
  const m = S.meta;
  return `<div class="page" style="max-width:860px">
    <div class="page-head"><h1>Enter Politics</h1><p class="sub">Who are you, where are you from, and what do you believe? Your positions decide which voters you can win.</p></div>
    <form class="card" data-form="create">
      <div class="grid cols-2">
        <div class="field"><label>Name</label><input name="name" required maxlength="60" placeholder="e.g. Morgan Ellis"></div>
        <div class="field"><label>Party</label><select name="party">${Object.entries(m.parties).map(([k, p]) => `<option value="${k}">${esc(p.name)}</option>`).join('')}</select></div>
        <div class="field"><label>Home state</label><select name="state" data-act-change="createstate">${Object.values(m.states).map(s => `<option value="${s.code}" ${s.code === 'PA' ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></div>
        <div class="field"><label>Home district</label><select name="district" id="districtSel">${districtOptions('PA')}</select></div>
        <div class="field"><label>Portrait URL (optional)</label><input name="avatar_url" placeholder="https://..."></div>
        <div class="field"><label>Bio (optional)</label><input name="bio" maxlength="300"></div>
      </div>
      <h2 style="margin-top:8px">Your positions</h2>
      ${positionSliders({})}
      <h3 style="margin-top:16px">Who you appeal to</h3>
      <div id="fitBars" class="bloc-bars"></div>
      <button class="btn gold block" type="submit" style="margin-top:16px">Declare</button>
    </form></div>`;
};

function districtOptions(code) {
  const n = S.meta.states[code].houseSeats;
  return Array.from({ length: n }, (_, i) => `<option value="${i + 1}">${code}-${i + 1}</option>`).join('');
}

function positionSliders(positions) {
  return Object.entries(S.meta.issues).map(([k, iss]) => `
    <div class="slider-row"><label>${esc(iss.name)}</label><input type="range" min="-3" max="3" step="1" name="pos_${k}" value="${Math.round(positions[k] ?? 0)}" data-act-input="slider"></div>
    <div class="slider-label" id="lbl_${k}">${esc(iss.labels[Math.round(positions[k] ?? 0) + 3])}</div>`).join('');
}

// Mirror of the server's fit function so players see who they appeal to as they move sliders.
function blocFit(positions, prefs) {
  let s = 0;
  for (const k of Object.keys(S.meta.issues)) s += Math.abs((positions[k] ?? 0) - prefs[k]);
  return 1 - s / (6 * Object.keys(S.meta.issues).length);
}
function renderFitBars(form) {
  const el = document.getElementById('fitBars');
  if (!el) return;
  const positions = {};
  for (const k of Object.keys(S.meta.issues)) positions[k] = Number(form[`pos_${k}`].value);
  el.innerHTML = Object.values(S.meta.blocs).map(b => {
    const f = Math.max(0, (blocFit(positions, b.prefs) - 0.4) / 0.6) * 100;
    return `<div class="bar-row"><span>${esc(b.name)}</span><div class="meter"><span style="width:${f.toFixed(0)}%"></span></div><span class="mono small">${f.toFixed(0)}</span></div>`;
  }).join('');
}

views.dashboard = async () => {
  const me = S.me, p = me.politician;
  const { news } = await api('/news?limit=8');
  const ab = me.approvalBreakdown;
  const rec = me.recognition[p.state] || 0;
  return `
  <div class="grid side">
    <div class="stack">
      <div class="card"><div class="row" style="align-items:flex-start">
        ${avatar(p, true)}
        <div style="flex:1">
          <div class="eyebrow">${esc(S.meta.parties[p.party].name)} · ${esc(stateName(p.state))}</div>
          <h1 style="margin:2px 0">${esc(p.name)}</h1>
          <div><b>${esc(me.seat ? me.seat.title : 'Private Citizen')}</b>${me.roles.map(r => ` · ${esc(r.title)}`).join('')}</div>
          ${me.race ? `<div class="small" style="margin-top:6px">Running for <a href="#/race/${me.race.id}">${esc(me.race.title)}</a> ${pill(me.race.phase)}</div>` : ''}
        </div>
      </div>
      <div class="grid cols-3" style="margin-top:16px">
        <div class="stat"><div class="v">${pct(rec)}</div><div class="l">Recognition in ${esc(p.state)}</div></div>
        <div class="stat"><div class="v">${Math.round(p.party_standing)}</div><div class="l">Party standing</div></div>
        <div class="stat"><div class="v">${Math.round(p.credibility)}</div><div class="l">Credibility</div></div>
      </div></div>

      <div class="card"><h2>Needs your attention</h2>
        ${me.todo.length ? me.todo.map(t => `<div class="todo"><span>${esc(t.text)}${t.deadline ? ` <span class="muted small">· ${until(t.deadline)} left</span>` : ''}</span>
          <a class="btn sm" href="${t.billId ? `#/bill/${t.billId}` : t.kind === 'nomination' ? '#/executive' : '#/court'}">Open</a></div>`).join('')
        : `<p class="muted">${me.seat ? 'Nothing pending. Use your hours: hold a town hall, write a bill, or build your war chest.' : 'You hold no office yet. Build name recognition at home, raise money, and file for a race.'}</p>
           <div class="row">${me.race ? `<a class="btn" href="#/actions">Campaign</a>` : `<a class="btn" href="#/races">Find a race</a>`}<a class="btn ghost" href="#/actions">Actions</a></div>`}
      </div>

      ${ab ? `<div class="card"><div class="spread"><h2>Approval</h2><div class="stat"><div class="v">${pct(p.approval)}</div><div class="l">heading toward ${pct(ab.target)}</div></div></div>
        <p class="small muted">Approval drifts toward a target set by how you vote, what's law, the economy, money you bring home, and the headlines.</p>
        <table class="breakdown">${ab.parts.map(x => `<tr><td>${esc(x.label)}</td><td class="${x.value >= 0 ? 'pos' : 'neg'}">${x.value >= 0 ? '+' : ''}${x.value}</td></tr>`).join('')}</table></div>` : ''}
    </div>
    <div class="stack">
      <div class="card"><div class="spread"><h2>Wire</h2><a class="small" href="#/news">All news</a></div>${newsList(news)}</div>
    </div>
  </div>`;
};

function newsList(news) {
  if (!news.length) return '<p class="muted">Quiet day in Washington.</p>';
  return `<ul class="feed">${news.map(n => `<li><span class="kind ${esc(n.kind)}">${esc(n.kind)}</span>${esc(n.headline)} <div class="t">${ago(n.created_at)}${n.state ? ` · ${esc(n.state)}` : ''}</div></li>`).join('')}</ul>`;
}

// ---------- Actions ----------
function actionCard(key, title, text, cost, controls, button) {
  const art = Art.icons[key] || Art.icons.rally;
  return `<div class="action-card"><div class="art" style="background:${art.bg}">${art.svg}</div><div class="body">
    <h3>${title}</h3><p>${text}</p><div class="cost">${cost}</div>
    <form data-form="action" data-action="${key}">${controls || ''}<button class="btn block" type="submit">${button}</button></form></div></div>`;
}

views.actions = async () => {
  const me = S.me, p = me.politician;
  let race = null, opponents = [];
  if (me.race) {
    const d = await api(`/races/${me.race.id}`);
    race = d.race;
    opponents = d.candidates.filter(c => c.politician_id !== p.id && ['filed', 'nominee'].includes(c.status) && (race.phase === 'general' ? c.status === 'nominee' : true));
  }
  const { found } = await api('/me/dossier');
  const isPres = race?.chamber === 'president';
  const stateSel = isPres ? `<select name="state">${Object.values(S.meta.states).map(s => `<option value="${s.code}" ${s.code === p.state ? 'selected' : ''}>${esc(s.name)} (${s.electoralVotes} EV)</option>`).join('')}</select>` : '';
  const adCost = !race ? 0 : race.chamber === 'house' ? 4000 : 3000 + 2500 * (S.meta.states[race.state || p.state].houseSeats);
  const blocSel = `<select name="bloc">${Object.entries(S.meta.blocs).map(([k, b]) => `<option value="${k}">${esc(b.name)}</option>`).join('')}</select>`;
  const oppSel = `<select name="targetId">${opponents.map(o => `<option value="${o.politician_id}">${esc(o.name)} (${o.party})</option>`).join('')}</select>`;
  const evidenceSel = `<select name="skeletonId"><option value="">No evidence (risk of backfire)</option>${found.filter(f => !f.public).map(f => `<option value="${f.id}">${esc(f.target_name)}: ${esc(f.description.slice(0, 50))}</option>`).join('')}</select>`;
  const campaign = race ? `
    <div class="section-title"><h2>Campaign: ${esc(race.title)}</h2>${pill(race.phase)}</div>
    <div class="actions-grid">
      ${actionCard('rally', 'Rally', 'Fire up your base. Raises awareness and turnout among the voters who already like you.', '4 hours · $2,000', stateSel, 'Hold rally')}
      ${actionCard('tv_ad', 'TV Ad Buy', 'Blanket the airwaves. The fastest way to raise awareness — if you can pay for it.', `1 hour · ${isPres ? 'varies by state' : money(adCost)}`, stateSel, 'Buy airtime')}
      ${actionCard('targeted_ad', 'Targeted Ads', 'Speak to one voter bloc. Works best on voters whose views you already share.', `1 hour · ${isPres ? 'varies' : money(adCost * 1.2)}`, stateSel + blocSel, 'Run targeted ad')}
      ${actionCard('canvass', 'Canvass', 'Volunteers knock doors. Boosts turnout among your supporters on election day.', '3 hours · $500', stateSel, 'Knock doors')}
      ${actionCard('poll', 'Poll', 'Commission a poll for your race, broken down by voter bloc.', '$5,000', stateSel, 'Commission poll')}
      ${opponents.length ? actionCard('attack_ad', 'Attack Ad', 'Go negative. With evidence from your dossier it lands hard; without it, low credibility makes it likely to backfire.', '2 hours · $15,000', stateSel + oppSel + evidenceSel, 'Go negative') : ''}
    </div><div id="pollOut"></div>` : `<div class="card" style="margin-top:16px"><b>You are not running for anything.</b> <a href="#/races">Browse open races</a> to file.</div>`;

  const office = me.seat?.chamber;
  return `<div class="page-head"><h1>Actions</h1><p class="sub">Every action costs hours. You regain ${S.meta.rules.HOURS_PER_DAY} hours a day and can bank up to ${S.meta.rules.HOURS_CAP}.</p></div>
    ${campaign}
    <div class="section-title"><h2>Money & presence</h2></div>
    <div class="actions-grid">
      ${actionCard('fundraiser', 'Fundraiser', 'Work the phones and the donor dinners. Raises more the better known you are at home.', '3 hours', '', 'Raise money')}
      ${actionCard('dark_money', 'Dark Money', 'An outside group offers $30,000, no questions asked. It creates a secret someone may find.', '1 hour · creates a skeleton', '', 'Take the money')}
      ${actionCard('press_conference', 'Press Conference', 'Get in front of the cameras at home to build name recognition.', '2 hours · $1,000', '', 'Call the press')}
      ${['house', 'senate', 'president'].includes(office) ? actionCard('town_hall', 'Town Hall', 'Face your constituents. A temporary approval boost and a little credibility.', '3 hours', '', 'Hold town hall') : ''}
      ${office === 'cabinet' ? actionCard('department_initiative', 'Department Initiative', "Launch a program from your department. Boosts the President's approval.", '3 hours · 5 capital', '', 'Launch') : ''}
    </div>
    <div class="section-title"><h2>Opposition research</h2></div>
    <div class="actions-grid">
      ${actionCard('oppo_research', 'Opposition Research', 'Hire investigators to dig into a rival. Anything they find goes in your dossier.', '4 hours · $10,000', `<input name="targetName" placeholder="Rival's name" list="polList" data-act-input="polsearch" autocomplete="off"><input type="hidden" name="targetId"><datalist id="polList"></datalist>`, 'Dig')}
      ${office === 'cabinet' && me.seat.post === 'justice' ? actionCard('investigate', 'Federal Investigation', 'As Attorney General, open an investigation into anyone. Much more likely to find something.', '4 hours · 5 capital', `<input name="targetName" placeholder="Name" list="polList" data-act-input="polsearch" autocomplete="off"><input type="hidden" name="targetId">`, 'Investigate') : ''}
      ${actionCard('leak', 'Leak to the Press', 'Hand something from your dossier to a reporter. Usually anonymous.', '1 hour', `<select name="skeletonId">${found.filter(f => !f.public).map(f => `<option value="${f.id}">${esc(f.target_name)}: ${esc(f.description.slice(0, 60))}</option>`).join('') || '<option value="">Your dossier is empty</option>'}</select>`, 'Leak it')}
    </div>`;
};

function renderPoll(poll) {
  const el = document.getElementById('pollOut');
  if (!el) return;
  el.innerHTML = `<div class="card" style="margin-top:8px"><h2>Poll: ${poll.mode === 'primary' ? 'primary' : 'general election'} (${esc(stateName(poll.state))})</h2>
    <table><thead><tr><th>Candidate</th><th class="num">Overall</th>${poll.blocs.map(b => `<th class="num">${esc(b.bloc)}</th>`).join('')}</tr></thead>
    <tbody>${poll.overall.map(o => `<tr><td>${esc(o.name)}</td><td class="num">${o.share}%</td>${poll.blocs.map(b => `<td class="num">${b.shares.find(s => s.name === o.name)?.share ?? '-'}%</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  el.scrollIntoView({ behavior: 'smooth' });
}

// ---------- Races ----------
views.races = async () => {
  const p = S.me.politician;
  const { races } = await api(`/races?state=${p.state}`);
  const rows = races.map(r => `<tr><td><a href="#/race/${r.id}">${esc(r.title)}</a></td><td>${pill(r.phase)}</td>
    <td>${r.candidates.filter(c => !['lost_primary'].includes(c.status)).map(c => `${partyDot(c.party)} ${esc(c.name)}`).join('<br>') || '<span class="muted">No candidates yet</span>'}</td>
    <td class="small">${r.phase === 'filing' ? `Filing closes in ${until(r.filing_closes_at)}` : r.phase === 'primary' ? `Primary ends in ${until(r.primary_closes_at)}` : `Election in ${until(r.general_closes_at)}`}</td>
    <td>${r.phase === 'filing' ? `<button class="btn sm" data-act="file" data-id="${r.id}">File (${money(S.meta.rules.FILING_FEE[r.chamber])})</button>` : ''}</td></tr>`).join('');
  return `<div class="page-head"><h1>Races in ${esc(stateName(p.state))}</h1><p class="sub">Filing costs 2 hours plus the fee. Senate runs need 25% name recognition at home; the Presidency needs an office or 15% national recognition.</p></div>
    <div class="card flush"><div class="table-wrap"><table><thead><tr><th>Seat</th><th>Phase</th><th>Candidates</th><th>Timing</th><th></th></tr></thead>
    <tbody>${rows || '<tr><td colspan="5" class="empty">No open races right now. A new election cycle opens every 14 days.</td></tr>'}</tbody></table></div></div>`;
};

views.campaign = async () => {
  if (S.me.race) { location.hash = `#/race/${S.me.race.id}`; return ''; }
  return views.races();
};

views.race = async (id) => {
  const { race, candidates, endorsements } = await api(`/races/${id}`);
  const me = S.me.politician;
  const amChair = S.me.roles.some(r => r.role === `${me.party}:chair`);
  const results = race.results;
  const issues = Object.keys(S.meta.issues);
  const live = candidates.filter(c => c.status !== 'withdrawn');
  return `<div class="page-head"><div class="eyebrow">Cycle ${race.cycle}</div><h1>${esc(race.title)}</h1><div>${pill(race.phase)}</div></div>
    <div class="grid side">
      <div class="card flush"><div class="table-wrap"><table><thead><tr><th>Candidate</th><th>Status</th><th class="num">Primary</th><th class="num">General</th>${race.chamber === 'president' ? '<th class="num">EV</th>' : ''}<th></th></tr></thead><tbody>
        ${live.map(c => `<tr><td>${who({ id: c.politician_id, name: c.name, party: c.party, is_npc: c.is_npc })}${race.holder_id === c.politician_id ? ' <span class="npc-tag">Incumbent</span>' : ''}${endorsements.some(e => e.politician_id === c.politician_id) ? ' <span class="npc-tag">Party-endorsed</span>' : ''}</td>
          <td>${pill(c.status)}</td><td class="num">${c.primary_share != null ? pct(c.primary_share) : ''}</td><td class="num">${c.general_share != null ? pct(c.general_share) : ''}</td>
          ${race.chamber === 'president' ? `<td class="num">${c.electoral_votes ?? ''}</td>` : ''}
          <td>${c.politician_id === me.id && ['filed', 'nominee'].includes(c.status) && race.phase !== 'closed' ? `<button class="btn sm ghost" data-act="withdraw" data-id="${race.id}">Withdraw</button>` : ''}
              ${amChair && c.party === me.party && c.status === 'filed' && !c.is_npc ? `<button class="btn sm ghost" data-act="primaryEndorse" data-race="${race.id}" data-id="${c.politician_id}">Endorse</button>` : ''}</td></tr>`).join('')}
      </tbody></table></div></div>
      <div class="card"><h3>Timeline</h3><ul class="feed">
        <li>Filing closes <span class="t">${new Date(race.filing_closes_at).toLocaleString()}</span></li>
        <li>Primary ends <span class="t">${new Date(race.primary_closes_at).toLocaleString()}</span></li>
        <li>General election <span class="t">${new Date(race.general_closes_at).toLocaleString()}</span></li></ul>
        ${race.phase === 'filing' && !live.some(c => c.politician_id === me.id) ? `<button class="btn gold block" data-act="file" data-id="${race.id}">File to run (${money(S.meta.rules.FILING_FEE[race.chamber])})</button>` : ''}
      </div>
    </div>
    <div class="card" style="margin-top:16px"><h2>Where they stand</h2><div class="table-wrap"><table><thead><tr><th>Issue</th>${live.map(c => `<th>${esc(c.name)}</th>`).join('')}</tr></thead><tbody>
      ${issues.map(i => `<tr><td><b>${esc(S.meta.issues[i].name)}</b></td>${live.map(c => `<td class="small">${esc(issueLabel(i, c.positions[i]))}</td>`).join('')}</tr>`).join('')}
    </tbody></table></div></div>
    ${results?.byState ? `<div class="card" style="margin-top:16px"><h2>Electoral map</h2><div class="row small">${Object.entries(results.byState).map(([st, pid]) => {
      const c = live.find(x => x.politician_id === pid); return `<span class="pill" style="border-color:${c ? S.meta.parties[c.party].color : '#ccc'};color:${c ? S.meta.parties[c.party].color : '#888'}">${st}</span>`; }).join('')}</div></div>` : ''}`;
};

// ---------- Congress ----------
async function chamberView(chamber) {
  const [{ members }, { bills }, cong] = await Promise.all([api(`/congress/${chamber}/members`), api('/bills?status=active'), api('/congress')]);
  const order = { D: 0, I: 1, R: 2 };
  const seats = members.slice().sort((a, b) => order[a.party] - order[b.party]).map(m => ({ party: m.party, player: !m.is_npc, label: `${m.name} (${m.party}) ${m.state}${m.district ? '-' + m.district : ''}` }));
  const control = cong.control[chamber];
  const lead = cong.roles.filter(r => r.role.includes(`${chamber}_`));
  const leaderTitle = chamber === 'house' ? 'Speaker of the House' : 'Senate Majority Leader';
  const topRole = lead.find(r => r.role === (chamber === 'house' ? cong.speakerRole : cong.senateLeaderRole));
  const here = bills.filter(b => b.status === `${chamber}_floor` || b.status === 'override');
  const elsewhere = bills.filter(b => !here.includes(b));
  const live = (b, stage) => { const t = { yes: 0, no: 0 }; for (const l of b.live) if (l.stage === stage) t[l.vote] = (t[l.vote] || 0) + l.n; return t; };
  const billRows = list => list.map(b => {
    const stage = b.status === 'override' ? `override_${chamber}` : chamber;
    const t = live(b, stage);
    return `<tr><td><a href="#/bill/${b.id}">${esc(b.number)}: ${esc(b.title)}</a></td><td class="small">${esc(b.describe)}</td>
      <td class="num">${t.yes}</td><td class="num">${t.no}</td><td>${b.sponsor ? who(b.sponsor) : ''}</td>
      <td class="small">${STATUS_TEXT[b.status]}<br><span class="muted">${until(b.stage_deadline)}</span></td></tr>`;
  }).join('');
  return `<div class="page-head"><h1>The ${chamber === 'house' ? 'House of Representatives' : 'Senate'}</h1>
      <div class="chamber-head">${Art.hemicycle(seats, { width: 560 })}</div>
      <div class="legend"><span><i class="dot" style="background:var(--dem)"></i>Democrats ${control.D}</span><span><i class="dot" style="background:var(--rep)"></i>Republicans ${control.R}</span>${control.I ? `<span><i class="dot" style="background:var(--ind)"></i>Independents ${control.I}</span>` : ''}<span><i class="dot" style="background:#fff;border:2px solid var(--gold)"></i>Players</span></div>
      <div class="row" style="justify-content:center"><span>${leaderTitle}: <b>${topRole?.name ? esc(topRole.name) : 'NPC leadership'}</b></span> · <a class="btn sm" href="#/laws">Current Law</a> <a class="btn sm ghost" href="#/introduce">Introduce a bill</a></div></div>
    <div class="card flush"><div class="card-head"><h2>On the floor</h2><span class="muted small">Yeas/Nays show votes cast so far. NPC members vote when the window closes.</span></div><div class="table-wrap"><table>
      <thead><tr><th>Bill</th><th>Law</th><th class="num">Yeas</th><th class="num">Nays</th><th>Sponsor</th><th>Stage</th></tr></thead>
      <tbody>${billRows(here) || '<tr><td colspan="6" class="empty">Nothing on the floor.</td></tr>'}</tbody></table></div></div>
    ${elsewhere.length ? `<div class="card flush" style="margin-top:16px"><div class="card-head"><h3>Elsewhere in the process</h3></div><div class="table-wrap"><table><tbody>${elsewhere.map(b => `<tr><td><a href="#/bill/${b.id}">${esc(b.number)}: ${esc(b.title)}</a></td><td class="small">${esc(b.describe)}</td><td>${pill('active', STATUS_TEXT[b.status])}</td></tr>`).join('')}</tbody></table></div></div>` : ''}
    <div class="grid cols-2" style="margin-top:16px">
      <div class="card"><h3>Leadership</h3><table class="breakdown">${lead.map(r => `<tr><td>${esc(r.title)}</td><td>${r.name ? `<a href="#/p/${r.id}">${esc(r.name)}</a>` : '<span class="muted">NPC</span>'}</td></tr>`).join('')}</table>
        <p class="small muted">Caucus members choose leaders and whips on the party page.</p></div>
      <div class="card"><h3>Members</h3><div style="max-height:320px;overflow:auto"><table><tbody>${members.map(m => `<tr><td>${who(m)}</td><td class="small">${m.state}${m.district ? '-' + m.district : ''}</td><td class="num small">${pct(m.approval)}</td></tr>`).join('')}</tbody></table></div></div>
    </div>`;
}
views.house = () => chamberView('house');
views.senate = () => chamberView('senate');

views.bill = async (id) => {
  const { bill, votes, cases } = await api(`/bills/${id}`);
  const me = S.me, seat = me.seat;
  const chamber = seat?.chamber;
  const stage = bill.status === `${chamber}_floor` ? chamber : bill.status === 'override' && ['house', 'senate'].includes(chamber) ? `override_${chamber}` : null;
  const myVote = votes.find(v => v.id === me.politician.id && v.stage === stage);
  const isLeader = me.roles.some(r => r.role.startsWith(me.politician.party + ':' + chamber + '_'));
  const isMajLeader = me.roles.some(r => r.role.endsWith(`${chamber}_leader`));
  let whip = null;
  if ((isLeader || chamber === 'president') && ['house_floor', 'senate_floor', 'override'].includes(bill.status)) {
    try { whip = await api(`/bills/${id}/whipcount`); } catch { /* not allowed */ }
  }
  const t = bill.tally || {};
  const tallyRow = (label, x) => x ? `<tr><td>${label}</td><td class="num">${x.yes}</td><td class="num">${x.no}</td><td class="num">${x.missed || 0}</td></tr>` : '';
  const whipLines = Object.entries(bill.whip || {}).map(([k, w]) => `<div class="small">${partyDot(k.split(':')[0])} ${k.split(':')[1]} whip: <b>${w.line.toUpperCase()}</b>${w.hard ? ' (hard)' : ''} — ${esc(w.by)}</div>`).join('');
  return `<div class="page-head"><div class="eyebrow">${esc(bill.number)}</div><h1>${esc(bill.title)}</h1><div>${pill(bill.status === 'law' ? 'law' : ['failed', 'vetoed', 'tabled', 'struck'].includes(bill.status) ? bill.status : 'active', STATUS_TEXT[bill.status] || bill.status)}</div></div>
  <div class="grid side">
    <div class="stack">
      <div class="card"><h2>${esc(bill.describe)}</h2>
        ${bill.issue ? `<p class="small muted">${esc(S.meta.issues[bill.issue].name)} — moves national policy to: <b>${esc(issueLabel(bill.issue, bill.target))}</b>${bill.prev_position != null ? ` (from: ${esc(issueLabel(bill.issue, bill.prev_position))})` : ''}</p>` : ''}
        ${bill.summary ? `<p>${esc(bill.summary)}</p>` : ''}
        <div class="small">Sponsor: ${bill.sponsor ? who(bill.sponsor) : 'n/a'}${bill.stage_deadline ? ` · this stage closes in <b>${until(bill.stage_deadline)}</b>` : ''}</div>
        ${whipLines ? `<div style="margin-top:10px">${whipLines}</div>` : ''}
        ${bill.filibuster ? '<div class="small" style="margin-top:6px"><b>Filibuster in progress</b> — needs 60% for cloture.</div>' : ''}
      </div>
      ${stage ? `<div class="card"><h2>Your vote</h2>${myVote ? `<p>You voted <b>${myVote.vote.toUpperCase()}</b>.</p>` : `<div class="row"><button class="btn yes" data-act="vote" data-id="${bill.id}" data-vote="yes">Vote Yea</button><button class="btn no" data-act="vote" data-id="${bill.id}" data-vote="no">Vote Nay</button></div>
        <p class="small muted">Missing a vote hurts your approval and party standing. Your constituents will judge this vote against their own views.</p>`}
        ${isLeader && bill.status !== 'override' ? `<form class="row" data-form="whip" data-id="${bill.id}" style="margin-top:10px"><select name="line" style="width:auto"><option value="yes">Whip YES</option><option value="no">Whip NO</option><option value="free">Free vote</option></select><label class="row small" style="margin:0"><input type="checkbox" name="hard" style="width:auto"> Hard whip (3 capital)</label><button class="btn sm" type="submit">Set whip</button></form>` : ''}
        <div class="row" style="margin-top:10px">
          ${isMajLeader && bill.status === `${chamber}_floor` ? `<button class="btn sm ghost" data-act="table" data-id="${bill.id}">Table bill (5 capital)</button>` : ''}
          ${chamber === 'senate' && bill.status === 'senate_floor' && !bill.filibuster ? `<button class="btn sm ghost" data-act="filibuster" data-id="${bill.id}">Filibuster (6 hours)</button>` : ''}
        </div></div>` : ''}
      ${chamber === 'president' && bill.status === 'president' ? `<div class="card"><h2>On your desk</h2><div class="row"><button class="btn yes" data-act="decide" data-id="${bill.id}" data-d="sign">Sign into law</button><button class="btn no" data-act="decide" data-id="${bill.id}" data-d="veto">Veto</button></div><p class="small muted">If you take no action before the window closes, it becomes law without your signature.</p></div>` : ''}
      ${whip ? `<div class="card"><div class="spread"><h2>Whip count — ${whip.chamber}</h2><span class="mono">${whip.yes} yes · ${whip.no} no · ${whip.undecided} undecided</span></div>
        <p class="small muted">Projected votes. Cut a backroom deal ($15,000 + 3 capital) to lock in an NPC — it creates a skeleton.</p>
        <div style="max-height:360px;overflow:auto"><table><tbody>${whip.members.filter(m => m.npc && m.lean !== 'yes' && !m.voted).slice(0, 60).map(m => `<tr><td>${who(m)}</td><td class="small">${m.state}${m.district ? '-' + m.district : ''}</td><td>${pill(m.lean === 'no' ? 'failed' : 'pending', m.lean)}</td>
          <td><button class="btn sm ghost" data-act="deal" data-id="${bill.id}" data-npc="${m.id}">Deal for YES</button></td></tr>`).join('')}</tbody></table></div></div>` : ''}
      ${bill.status === 'law' && bill.kind !== 'appropriation' ? `<div class="card"><h2>Challenge in court</h2><p class="small muted">Officeholders and party chairs can ask the Supreme Court to strike this law (10 capital + $50,000).</p><button class="btn ghost" data-act="challenge" data-id="${bill.id}">File challenge</button></div>` : ''}
    </div>
    <div class="stack">
      <div class="card"><h3>History</h3><ul class="feed">${(bill.history || []).map(h => `<li>${esc(h.text)}<div class="t">${ago(h.at)}</div></li>`).join('')}</ul></div>
      ${t.house || t.senate || t.override ? `<div class="card flush"><table><thead><tr><th>Roll call</th><th class="num">Yea</th><th class="num">Nay</th><th class="num">Absent</th></tr></thead><tbody>
        ${tallyRow('House', t.house)}${tallyRow('Senate', t.senate)}${tallyRow('Override (House)', t.override?.house)}${tallyRow('Override (Senate)', t.override?.senate)}</tbody></table></div>` : ''}
      ${votes.filter(v => !v.is_npc).length ? `<div class="card"><h3>Player votes</h3><table class="breakdown">${votes.filter(v => !v.is_npc).map(v => `<tr><td>${who(v)}</td><td>${esc(v.stage.replace('_', ' '))}: <b>${v.vote}</b>${v.against_whip ? ' <span class="neg small">broke whip</span>' : ''}</td></tr>`).join('')}</table></div>` : ''}
      ${cases.length ? `<div class="card"><h3>Court</h3>${cases.map(c => `<div>${pill(c.status)} ${c.uphold}-${c.strike}</div>`).join('')}</div>` : ''}
    </div>
  </div>`;
};

views.introduce = async () => {
  const seat = S.me.seat;
  const { policy } = await api('/nation');
  if (!seat || !['house', 'senate'].includes(seat.chamber)) {
    return `<div class="page-head"><h1>Introduce a Bill</h1></div><div class="card empty">Only members of Congress can introduce legislation. Win a House or Senate seat first.</div>`;
  }
  return `<div class="page-head"><h1>Introduce a Bill</h1><p class="sub">Costs 2 hours and 2 capital. Spending bills must start in the House. You can have 3 active bills.</p></div>
    <form class="card" data-form="introduce" style="max-width:760px;margin:0 auto">
      <div class="field"><label>Title</label><input name="title" required maxlength="140" placeholder="e.g. The Fair Wages Act"></div>
      <div class="field"><label>Type</label><select name="kind" data-act-change="billkind"><option value="policy">Policy change</option>${seat.chamber === 'house' ? '<option value="appropriation">Spending for a state</option>' : ''}</select></div>
      <div id="policyFields">
        <div class="field"><label>Issue</label><select name="issue" data-act-change="billissue">${policy.map(p => `<option value="${p.issue}">${esc(p.name)}</option>`).join('')}</select></div>
        <div class="field"><label>New policy</label><select name="target" id="targetSel"></select><div class="small muted" id="currentLaw"></div></div>
      </div>
      <div id="appropFields" class="hidden"><div class="inline-fields">
        <div class="field"><label>State</label><select name="approp_state">${Object.values(S.meta.states).map(s => `<option value="${s.code}" ${s.code === seat.state ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></div>
        <div class="field"><label>Amount</label><select name="approp_amount">${[1e8, 2.5e8, 5e8, 1e9, 2e9, 5e9].map(v => `<option value="${v}">${money(v)}</option>`).join('')}</select></div></div>
        <p class="small muted">Members from other states are reluctant to fund yours. You will need the whip, or deals.</p></div>
      <div class="field"><label>Summary (optional)</label><textarea name="summary" maxlength="2000"></textarea></div>
      <button class="btn gold block" type="submit">Introduce</button>
    </form>`;
};

function fillTargets(form, policy) {
  const issue = form.issue.value;
  const cur = policy.find(p => p.issue === issue);
  form.target.innerHTML = S.meta.issues[issue].labels.map((l, i) => i - 3 === Number(cur.position) ? '' : `<option value="${i - 3}">${esc(l)}</option>`).join('');
  document.getElementById('currentLaw').textContent = `Current law: ${cur.label}`;
}

views.laws = async () => {
  const [{ policy }, { bills }] = await Promise.all([api('/nation'), api('/bills?status=law')]);
  return `<div class="page-head"><h1>Current Law</h1><p class="sub">Gold = current law. White = where the average American stands.</p></div>
    <div class="card flush"><div class="table-wrap"><table><thead><tr><th>Issue</th><th>Law of the land</th><th style="width:30%">Spectrum</th><th>Set by</th></tr></thead><tbody>
    ${policy.map(p => `<tr><td><b>${esc(p.name)}</b></td><td>${esc(p.label)}</td><td>${spectrum([{ v: p.publicPref, cls: 'public', title: 'Public' }, { v: p.position, cls: 'law', title: 'Law' }])}</td><td class="small">${p.number ? `<a href="#/bill/${p.law_id}">${esc(p.number)}</a>` : '<span class="muted">Longstanding</span>'}</td></tr>`).join('')}
    </tbody></table></div></div>
    <div class="card flush" style="margin-top:16px"><div class="card-head"><h2>Enacted</h2></div><div class="table-wrap"><table><tbody>
    ${bills.map(b => `<tr><td><a href="#/bill/${b.id}">${esc(b.number)}: ${esc(b.title)}</a></td><td class="small">${esc(b.describe)}</td><td>${b.sponsor ? who(b.sponsor) : ''}</td><td class="small muted">${ago(b.became_law_at)}</td></tr>`).join('') || '<tr><td class="empty">No laws passed yet.</td></tr>'}
    </tbody></table></div></div>`;
};

// ---------- Nation ----------
views.nation = async () => {
  const n = await api('/nation');
  const w = n.world;
  const envText = Object.entries(n.environment).map(([p, v]) => `${S.meta.parties[p].short}s ${v * (p === 'D' ? -1 : 1) >= 0 ? 'helped' : 'hurt'} by the President's approval`).join('') || 'Neutral';
  return `<div class="page-head"><div class="hero-art">${Art.capitol}</div><h1>The State of the Union</h1><p class="sub">Election cycle ${w.cycle} · next cycle opens in ${until(w.nextCycleAt)}</p></div>
    <div class="grid cols-3">
      <div class="card stat"><div class="v ${w.growth >= 2 ? 'pos' : 'neg'}">${num1(w.growth)}%</div><div class="l">GDP growth</div></div>
      <div class="card stat"><div class="v ${w.unemployment <= 4.5 ? 'pos' : 'neg'}">${num1(w.unemployment)}%</div><div class="l">Unemployment</div></div>
      <div class="card stat"><div class="v">${num1(w.deficit)}%</div><div class="l">Deficit (% GDP)</div></div>
    </div>
    <div class="grid cols-3" style="margin-top:16px">
      <div class="card"><h3>President</h3>${n.president ? `${who(n.president)}<div class="small">Approval ${pct(n.president.approval)}</div>` : 'Vacant'}<div class="small muted" style="margin-top:6px">${esc(envText)}</div></div>
      <div class="card"><h3>House</h3><div>${partyDot('D')} ${n.control.house.D} · ${partyDot('R')} ${n.control.house.R}</div><div class="small muted">${S.meta.parties[n.control.house.majority].short} majority</div></div>
      <div class="card"><h3>Senate</h3><div>${partyDot('D')} ${n.control.senate.D} · ${partyDot('R')} ${n.control.senate.R}</div><div class="small muted">${S.meta.parties[n.control.senate.majority].short} majority</div></div>
    </div>
    <div class="card flush" style="margin-top:16px"><div class="card-head"><h2>Policy</h2><a class="small" href="#/laws">All laws</a></div><div class="table-wrap"><table><tbody>
    ${n.policy.map(p => `<tr><td><b>${esc(p.name)}</b></td><td>${esc(p.label)}</td><td style="width:35%">${spectrum([{ v: p.publicPref, cls: 'public' }, { v: p.position, cls: 'law' }])}</td></tr>`).join('')}
    </tbody></table></div></div>`;
};

views.states = async () => `<div class="page-head"><h1>The States</h1></div><div class="card flush"><div class="table-wrap"><table>
  <thead><tr><th>State</th><th class="num">House seats</th><th class="num">Electoral votes</th></tr></thead><tbody>
  ${Object.values(S.meta.states).map(s => `<tr><td><a href="#/state/${s.code}">${esc(s.name)}</a></td><td class="num">${s.houseSeats}</td><td class="num">${s.electoralVotes}</td></tr>`).join('')}
  </tbody></table></div></div>`;

views.state = async (code) => {
  const d = await api(`/states/${code}`);
  const bars = shares => Object.entries(shares).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div class="bar-row"><span>${esc(S.meta.blocs[k].name)}</span><div class="meter"><span style="width:${(v * 250).toFixed(0)}%"></span></div><span class="mono small">${(v * 100).toFixed(0)}%</span></div>`).join('');
  const leanTxt = l => Math.abs(l) < 0.05 ? 'Toss-up' : `${l < 0 ? 'D' : 'R'}+${Math.round(Math.abs(l) * 30)}`;
  return `<div class="page-head"><h1>${esc(d.state.name)}</h1><p class="sub">${d.state.houseSeats} House seat${d.state.houseSeats > 1 ? 's' : ''} · ${d.state.electoralVotes} electoral votes · ${leanTxt(d.profile.lean)}${d.recentFunding ? ` · ${money(d.recentFunding * 1e9)} in federal funding (14 days)` : ''}</p></div>
    <div class="grid cols-2">
      <div class="card"><h2>Who lives here</h2><div class="bloc-bars">${bars(d.profile.shares)}</div></div>
      <div class="card"><h2>What they want</h2><table class="breakdown">${Object.entries(d.profile.prefs).map(([i, v]) => `<tr><td>${esc(S.meta.issues[i].name)}</td><td style="width:45%">${spectrum([{ v, cls: 'public' }])}</td></tr>`).join('')}</table></div>
    </div>
    <div class="grid cols-2" style="margin-top:16px">
      <div class="card flush"><div class="card-head"><h2>Officeholders</h2></div><table><tbody>${d.officials.map(o => `<tr><td>${who(o)}</td><td class="small">${o.chamber === 'house' ? `House, ${code}-${o.district}` : `Senate (Class ${o.senate_class})`}</td><td class="num small">${pct(o.approval)}</td></tr>`).join('')}</tbody></table></div>
      <div class="card flush"><div class="card-head"><h2>Districts</h2></div><table><thead><tr><th>District</th><th>Lean</th><th>Largest blocs</th></tr></thead><tbody>${d.districts.map(x => `<tr><td>${code}-${x.district}</td><td>${leanTxt(x.lean)}</td><td class="small">${Object.entries(x.shares).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => esc(S.meta.blocs[k].name)).join(', ')}</td></tr>`).join('')}</tbody></table></div>
    </div>
    <div class="grid cols-2" style="margin-top:16px">
      <div class="card"><h2>Players from ${esc(d.state.name)}</h2>${d.players.map(p => `<div>${who(p)}</div>`).join('') || '<p class="muted">None yet.</p>'}</div>
      <div class="card"><h2>Local news</h2>${newsList(d.news)}</div>
    </div>`;
};

// ---------- Executive & Court ----------
views.executive = async () => {
  const ex = await api('/executive');
  const me = S.me, isPres = me.seat?.chamber === 'president', isSenator = me.seat?.chamber === 'senate';
  const pending = ex.nominations.filter(n => n.status === 'pending');
  const { justices } = isPres ? await api('/court') : { justices: [] };
  const vacantCourt = justices.filter(j => !j.id);
  const nomineeInput = `<input name="nomineeName" placeholder="Player name (blank = career official)" list="polList" data-act-input="polsearch" autocomplete="off"><input type="hidden" name="nomineeId">`;
  return `<div class="page-head"><div class="hero-art">${Art.mansion}</div><h1>The White House</h1>
      <div>President ${ex.president ? who(ex.president) : 'vacant'} · approval ${ex.president ? pct(ex.president.approval) : '-'}</div></div>
    <datalist id="polList"></datalist>
    <div class="grid side">
      <div class="card flush"><div class="card-head"><h2>The Cabinet</h2></div><table><tbody>
        ${ex.cabinet.map(c => `<tr><td><b>${esc(c.title)}</b></td><td>${c.id ? who(c) : '<span class="muted">Vacant</span>'}</td>
          <td>${isPres ? `${c.id ? `<button class="btn sm ghost" data-act="fire" data-seat="${c.seat_id}">Dismiss</button>` : ''}
            <form class="row" data-form="nominate" data-seat="${c.seat_id}" style="margin-top:4px">${nomineeInput}<button class="btn sm" type="submit">Nominate</button></form>` : ''}</td></tr>`).join('')}
        ${isPres ? vacantCourt.map(j => `<tr><td><b>Supreme Court Seat ${j.post}</b></td><td class="muted">Vacant</td><td><form class="row" data-form="nominate" data-seat="${j.seat_id}">${nomineeInput}<button class="btn sm" type="submit">Nominate</button></form></td></tr>`).join('') : ''}
      </tbody></table></div>
      <div class="stack">
        <div class="card"><h2>Confirmations</h2>${pending.length ? pending.map(n => `<div class="todo"><span>${partyDot(n.nominee_party)} <b>${esc(n.nominee_name)}</b> for ${esc(n.post_name)} <span class="small muted">· ${until(n.deadline)}</span></span>
          ${isSenator ? `<span class="row"><button class="btn sm yes" data-act="confirm" data-id="${n.id}" data-vote="yes">Yea</button><button class="btn sm no" data-act="confirm" data-id="${n.id}" data-vote="no">Nay</button></span>` : ''}</div>`).join('') : '<p class="muted">No pending nominations.</p>'}
          ${ex.nominations.filter(n => n.status !== 'pending').slice(0, 6).map(n => `<div class="small">${pill(n.status)} ${esc(n.nominee_name)} — ${esc(n.post_name)} (${n.yes}-${n.no})</div>`).join('')}
        </div>
        ${isPres ? `<div class="card"><h2>Executive order</h2><p class="small muted">Move national policy one step without Congress (4 hours, 15 capital). The Court can strike it down.</p>
          <form data-form="order"><div class="field"><select name="issue">${Object.entries(S.meta.issues).map(([k, i]) => `<option value="${k}">${esc(i.name)}</option>`).join('')}</select></div>
          <div class="row"><button class="btn" name="direction" value="-1" type="submit">◀ Progressive</button><button class="btn" name="direction" value="1" type="submit">Conservative ▶</button></div></form></div>` : ''}
        <div class="card"><h3>Recent orders</h3>${ex.orders.map(o => `<div class="small"><a href="#/bill/${o.id}">${esc(o.number)}</a> ${esc(o.describe)} ${pill(o.status)}</div>`).join('') || '<p class="muted small">None.</p>'}</div>
      </div>
    </div>`;
};

views.court = async () => {
  const { justices, cases } = await api('/court');
  const isJustice = S.me.seat?.chamber === 'court';
  const ideology = pos => pos ? Object.values(pos).reduce((a, b) => a + Number(b), 0) / Object.keys(pos).length : 0;
  return `<div class="page-head"><div class="hero-art">${Art.court}</div><h1>The Supreme Court</h1><p class="sub">Nine justices, appointed for life. They strike laws that move policy away from their judicial philosophy.</p></div>
    <div class="grid cols-3">${justices.map(j => `<div class="card"><div class="eyebrow">Seat ${j.post}</div>${j.id ? `${who(j)}<div style="margin-top:10px">${spectrum([{ v: ideology(j.positions) }])}</div>` : '<span class="muted">Vacant — awaiting nomination</span>'}</div>`).join('')}</div>
    <div class="card flush" style="margin-top:16px"><div class="card-head"><h2>Docket</h2></div><div class="table-wrap"><table><thead><tr><th>Case</th><th>Law</th><th>Status</th><th class="num">Uphold</th><th class="num">Strike</th><th></th></tr></thead><tbody>
    ${cases.map(c => `<tr><td>${esc(c.filed_by_name || 'Petitioner')} v. United States</td><td><a href="#/bill/${c.bill_id}">${esc(c.number)}: ${esc(c.title)}</a></td><td>${pill(c.status)}${c.status === 'pending' ? ` <span class="small muted">${until(c.deadline)}</span>` : ''}</td>
      <td class="num">${c.uphold}</td><td class="num">${c.strike}</td>
      <td>${isJustice && c.status === 'pending' ? `<button class="btn sm yes" data-act="rule" data-id="${c.id}" data-vote="uphold">Uphold</button> <button class="btn sm no" data-act="rule" data-id="${c.id}" data-vote="strike">Strike</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">No cases.</td></tr>'}
    </tbody></table></div></div>`;
};

// ---------- Party ----------
views.party = async (code) => {
  const d = await api(`/parties/${code}`);
  const me = S.me.politician, mine = me.party === code;
  const amChair = S.me.roles.some(r => r.role === `${code}:chair`);
  const role = r => d.roles.find(x => x.role === `${code}:${r}`);
  const tallyFor = r => d.tallies.filter(t => t.role === `${code}:${r}`);
  const offices = ['chair', 'house_leader', 'house_whip', 'senate_leader', 'senate_whip'];
  const memberOpts = d.members.map(m => `<option value="${m.id}">${esc(m.name)}</option>`).join('');
  return `<div class="page-head"><h1>${esc(d.name)}</h1><p class="sub">${d.seats.house} House seats · ${d.seats.senate} Senate seats · Treasury ${money(d.treasury)} · Dues ${money(d.dues)}/day</p></div>
    <div class="grid side">
      <div class="stack">
        <div class="card flush"><div class="card-head"><h2>Party offices</h2>${mine ? '<span class="small muted">Members vote; votes are weighted by party standing.</span>' : ''}</div><table><tbody>
          ${offices.map(o => `<tr><td><b>${esc(role(o)?.title || o)}</b></td><td>${role(o)?.id ? `<a href="#/p/${role(o).id}">${esc(role(o).name)}</a>` : '<span class="muted">NPC</span>'}</td>
            <td class="small">${tallyFor(o).map(t => `${esc(t.name)}: ${Math.round(t.weight)}`).join(' · ')}</td>
            <td>${mine ? `<form class="row" data-form="endorse" data-role="${code}:${o}"><select name="candidateId" style="width:auto">${memberOpts}</select><button class="btn sm" type="submit">Vote</button></form>` : ''}</td></tr>`).join('')}
        </tbody></table></div>
        <div class="card flush"><div class="card-head"><h2>Members</h2></div><table><thead><tr><th>Member</th><th>Office</th><th class="num">Standing</th>${amChair ? '<th></th>' : ''}</tr></thead><tbody>
          ${d.members.map(m => `<tr><td>${who({ ...m, party: code })}</td><td class="small">${m.chamber ? `${m.chamber}${m.seat_state ? ' · ' + m.seat_state : ''}${m.district ? '-' + m.district : ''}` : 'Citizen'}</td><td class="num">${Math.round(m.party_standing)}</td>
            ${amChair ? `<td>${m.id !== me.id ? `<button class="btn sm ghost" data-act="expel" data-id="${m.id}">Expel</button>` : ''}</td>` : ''}</tr>`).join('') || '<tr><td class="empty">No players yet.</td></tr>'}
        </tbody></table></div>
      </div>
      <div class="stack">
        <div class="card"><h3>Platform</h3><p class="small muted">Pulled toward what active members believe. NPC members vote with it.</p>
          <table class="breakdown">${Object.entries(d.platform).map(([i, v]) => `<tr><td>${esc(S.meta.issues[i].name)}</td><td style="width:45%">${spectrum([{ v }])}</td></tr>`).join('')}</table></div>
        ${mine ? `<div class="card"><h3>Donate</h3><form class="row" data-form="donate"><input name="amount" type="number" min="1000" step="1000" value="5000" style="flex:1"><button class="btn" type="submit">Give</button></form><p class="small muted">Every $5,000 adds a point of party standing.</p></div>` : ''}
        ${amChair ? `<div class="card"><h3>Chair's office</h3>
          <form data-form="dues" class="row"><input name="dues" type="number" min="0" max="5000" value="${d.dues}" style="flex:1"><button class="btn sm" type="submit">Set daily dues</button></form>
          <form data-form="fund" style="margin-top:10px"><div class="inline-fields"><select name="candidateId">${memberOpts}</select><input name="amount" type="number" min="1000" step="1000" placeholder="Amount"></div><button class="btn sm" type="submit" style="margin-top:6px">Send treasury funds</button></form>
          <form data-form="mail" style="margin-top:10px"><input name="subject" placeholder="Subject" style="margin-bottom:6px"><textarea name="body" placeholder="Message to all members"></textarea><button class="btn sm" type="submit" style="margin-top:6px">Send to all members</button></form></div>` : ''}
        <div class="card"><h3>${mine ? 'Leave the party' : `Join the ${esc(d.name)}`}</h3><p class="small muted">Switching parties costs 20 credibility and resets your standing.</p>
          <button class="btn ghost" data-act="switch" data-party="${mine ? 'I' : code}">${mine ? 'Become an Independent' : 'Switch parties'}</button></div>
      </div>
    </div>`;
};

// ---------- People & player ----------
views.p = async (id) => {
  const d = await api(`/politicians/${id}`);
  const p = d.politician;
  return `<div class="grid side">
    <div class="stack">
      <div class="card"><div class="row" style="align-items:flex-start">${avatar(p, true)}<div style="flex:1">
        <div class="eyebrow">${esc(S.meta.parties[p.party].name)} · ${esc(stateName(p.state))}${p.is_npc ? ' · NPC' : ''}</div>
        <h1 style="margin:2px 0">${esc(p.name)}</h1><div><b>${esc(d.office || 'Private Citizen')}</b>${d.roles.map(r => ` · ${esc(r)}`).join('')}</div>
        ${p.bio ? `<p>${esc(p.bio)}</p>` : ''}
        <div class="row small" style="margin-top:6px"><span>Approval <b>${pct(p.approval)}</b></span><span>Credibility <b>${Math.round(p.credibility)}</b></span></div></div></div></div>
      <div class="card"><h2>Positions</h2><table class="breakdown">${Object.entries(p.positions).map(([i, v]) => `<tr><td>${esc(S.meta.issues[i].name)}</td><td class="small">${esc(issueLabel(i, v))}</td></tr>`).join('')}</table></div>
      <div class="card"><h2>Voting record</h2>${d.votes.map(v => `<div class="small"><a href="#/bill/${v.bill_id}">${esc(v.number)}: ${esc(v.title)}</a> — ${esc(v.stage.replace('_', ' '))}: <b>${v.vote}</b></div>`).join('') || '<p class="muted">No votes yet.</p>'}</div>
    </div>
    <div class="stack">
      ${d.scandals.length ? `<div class="card"><h2 class="neg">Scandals</h2>${d.scandals.map(s => `<div class="small">• ${esc(s.description)}</div>`).join('')}</div>` : ''}
      <div class="card"><h3>Flip-flops</h3>${d.record.map(r => `<div class="small">${esc(S.meta.issues[r.issue].name)}: ${esc(issueLabel(r.issue, r.from_pos))} → <b>${esc(issueLabel(r.issue, r.to_pos))}</b> <span class="muted">${ago(r.created_at)}</span></div>`).join('') || '<p class="muted small">A consistent record.</p>'}</div>
      <div class="card"><h3>Career</h3>${d.titles.map(t => `<div class="small"><b>${esc(t.title)}</b> <span class="muted">${new Date(t.term_start).toLocaleDateString()}${t.term_end ? ' – ' + new Date(t.term_end).toLocaleDateString() : ' – present'}</span></div>`).join('') || '<p class="muted small">No offices held yet.</p>'}</div>
    </div></div>`;
};

views.directory = async () => {
  const { politicians } = await api('/politicians');
  return `<div class="page-head"><h1>Directory</h1><p class="sub">Every player in the game.</p></div>
    <div class="card flush"><table><tbody>${politicians.map(p => `<tr><td>${who(p)}</td><td>${esc(stateName(p.state))}</td><td class="small">${p.chamber || 'Citizen'}</td></tr>`).join('')}</tbody></table></div>`;
};

views.positions = async () => {
  const p = S.me.politician;
  return `<div class="page-head"><h1>My Positions</h1><p class="sub">Each change costs 2 hours and credibility, scaled by how far you move. Changing the same issue twice within a week costs extra. Every change goes on your public record.</p></div>
    <form class="card" data-form="positions" style="max-width:860px;margin:0 auto">${positionSliders(p.positions)}
      <h3 style="margin-top:16px">Who you appeal to</h3><div id="fitBars" class="bloc-bars"></div>
      <button class="btn gold block" type="submit" style="margin-top:12px">Announce new positions</button></form>`;
};

views.inbox = async () => {
  const { messages } = await api('/me/inbox');
  S.me.unread = 0;
  return `<div class="page-head"><h1>Inbox</h1></div><div class="card"><ul class="feed">${messages.map(m => `<li><b>${esc(m.subject)}</b> <span class="muted small">— ${esc(m.sender)}</span>${m.body ? `<div class="small">${esc(m.body)}</div>` : ''}<div class="t">${ago(m.created_at)}</div></li>`).join('') || '<li class="muted">No messages.</li>'}</ul></div>`;
};

views.dossier = async () => {
  const { found, mine } = await api('/me/dossier');
  return `<div class="page-head"><h1>Dossier</h1><p class="sub">What you've dug up on others, and what others could dig up on you.</p></div>
    <div class="grid cols-2">
      <div class="card"><h2>On others</h2>${found.map(f => `<div class="todo"><span>${partyDot(f.target_party)} <b>${esc(f.target_name)}</b>: ${esc(f.description)} <span class="small muted">(severity ${f.severity})</span></span>${f.public ? pill('law', 'public') : ''}</div>`).join('') || '<p class="muted">Nothing yet. Commission opposition research from the Actions page.</p>'}</div>
      <div class="card"><h2>Your skeletons</h2>${mine.map(s => `<div class="todo"><span>${esc(s.description)} <span class="small muted">(severity ${s.severity})</span></span>${s.public ? pill('failed', 'exposed') : pill('pending', 'hidden')}</div>`).join('') || '<p class="muted">Clean as a whistle.</p>'}</div>
    </div>`;
};

views.news = async () => {
  const { news } = await api('/news?limit=100');
  return `<div class="page-head"><h1>The Wire</h1></div><div class="card">${newsList(news)}</div>`;
};

views.admin = async () => `<div class="page-head"><h1>Admin</h1><p class="sub">Push the clocks forward for testing and live events.</p></div>
  <div class="card"><div class="row">
    <button class="btn" data-act="advance" data-what="cycle">Open next election cycle</button>
    <button class="btn" data-act="advance" data-what="races">End current race phase</button>
    <button class="btn" data-act="advance" data-what="bills">Close all open votes</button>
    <button class="btn" data-act="advance" data-what="confirmations">Close confirmations</button>
    <button class="btn" data-act="advance" data-what="cases">Decide court cases</button>
    <button class="btn ghost" data-act="advance" data-what="tick">Run world tick</button>
  </div>
  <form data-form="grant" class="row" style="margin-top:16px"><input name="politicianId" placeholder="Politician ID" style="width:140px"><input name="hours" placeholder="Hours" style="width:100px"><input name="funds" placeholder="Funds" style="width:120px"><input name="pc" placeholder="Capital" style="width:100px"><button class="btn" type="submit">Grant</button></form>
  <pre id="adminOut" class="small mono"></pre></div>`;

// ---------- Router ----------
async function loadMe() {
  try { S.me = await api('/me'); } catch { S.me = null; }
}

async function render() {
  document.querySelectorAll('.nav-item.open').forEach(n => n.classList.remove('open'));
  const [name, arg] = (location.hash.replace(/^#\/?/, '') || '').split('/');
  if (name === 'logout') { await api('/auth/logout', {}); S.me = null; location.hash = ''; return; }
  if (!S.me) { root.innerHTML = views.landing(); return; }
  if (!S.me.politician) { root.innerHTML = views.create(); renderFitBars(root.querySelector('[data-form=create]')); return; }
  const view = views[name || 'dashboard'] || views.dashboard;
  try {
    const html = await view(arg);
    if (html === '') return;
    root.innerHTML = shell(html);
    const posForm = root.querySelector('[data-form=positions]');
    if (posForm) renderFitBars(posForm);
    const intro = root.querySelector('[data-form=introduce]');
    if (intro) { const { policy } = await api('/nation'); intro._policy = policy; fillTargets(intro, policy); }
  } catch (err) {
    root.innerHTML = shell(`<div class="card empty">${esc(err.message)}</div>`);
  }
  window.scrollTo(0, 0);
}

async function refresh() { await loadMe(); await render(); }
window.addEventListener('hashchange', render);

// ---------- Event handlers ----------
const acts = {
  menu: el => { const item = el.closest('.nav-item'); const open = item.classList.contains('open'); document.querySelectorAll('.nav-item.open').forEach(n => n.classList.remove('open')); if (!open) item.classList.add('open'); },
  navtoggle: () => document.querySelector('.topnav').classList.toggle('expanded'),
  authmode: el => {
    const mode = el.dataset.mode, f = root.querySelector('[data-form=auth]');
    f.dataset.mode = mode; f.querySelector('button[type=submit]').textContent = mode === 'login' ? 'Sign in' : 'Create account';
    document.getElementById('tabLogin').className = 'btn' + (mode === 'login' ? '' : ' ghost');
    document.getElementById('tabRegister').className = 'btn' + (mode === 'register' ? '' : ' ghost');
  },
  file: async el => { const r = await api(`/races/${el.dataset.id}/file`, {}); toast(r.message); await loadMe(); location.hash = `#/race/${el.dataset.id}`; },
  withdraw: async el => { if (!confirm('Withdraw from this race?')) return; toast((await api(`/races/${el.dataset.id}/withdraw`, {})).message); await refresh(); },
  primaryEndorse: async el => { toast((await api('/parties/primary-endorse', { raceId: el.dataset.race, candidateId: el.dataset.id })).message); await refresh(); },
  vote: async el => { await api(`/bills/${el.dataset.id}/vote`, { vote: el.dataset.vote }); toast(`You voted ${el.dataset.vote.toUpperCase()}.`); await refresh(); },
  table: async el => { if (!confirm('Table this bill? It will not get a vote.')) return; await api(`/bills/${el.dataset.id}/table`, {}); toast('Bill tabled.'); await refresh(); },
  filibuster: async el => { await api(`/bills/${el.dataset.id}/filibuster`, {}); toast('You take the floor. The filibuster is on.'); await refresh(); },
  deal: async el => { toast((await api(`/bills/${el.dataset.id}/deal`, { npcId: el.dataset.npc, vote: 'yes' })).message); await refresh(); },
  decide: async el => { await api(`/bills/${el.dataset.id}/decide`, { decision: el.dataset.d }); toast(el.dataset.d === 'sign' ? 'Signed into law.' : 'Vetoed.'); await refresh(); },
  challenge: async el => { await api(`/bills/${el.dataset.id}/challenge`, {}); toast('Challenge filed with the Supreme Court.'); location.hash = '#/court'; },
  confirm: async el => { await api(`/nominations/${el.dataset.id}/vote`, { vote: el.dataset.vote }); toast('Vote recorded.'); await refresh(); },
  rule: async el => { await api(`/court/cases/${el.dataset.id}/vote`, { vote: el.dataset.vote }); toast('Ruling recorded.'); await refresh(); },
  fire: async el => { if (!confirm('Dismiss this cabinet secretary?')) return; await api('/executive/fire', { seatId: el.dataset.seat }); await refresh(); },
  expel: async el => { if (!confirm('Expel this member? Costs 10 capital.')) return; toast((await api('/parties/expel', { memberId: el.dataset.id })).message); await refresh(); },
  switch: async el => { if (!confirm('Switch parties? This costs 20 credibility.')) return; toast((await api('/parties/switch', { party: el.dataset.party })).message); await refresh(); },
  advance: async el => {
    const out = el.dataset.what === 'tick' ? await api('/admin/tick', {}) : await api('/admin/advance', { what: el.dataset.what });
    document.getElementById('adminOut').textContent = JSON.stringify(out, null, 2); toast('Done.'); await loadMe();
  },
};

const forms = {
  auth: async (f, data) => {
    await api(f.dataset.mode === 'login' ? '/auth/login' : '/auth/register', { email: data.email, password: data.password });
    await refresh();
  },
  create: async (f, data) => {
    const positions = {};
    for (const k of Object.keys(S.meta.issues)) positions[k] = Number(data[`pos_${k}`]);
    await api('/me/politician', { ...data, positions });
    toast('Welcome to politics.');
    location.hash = '#/';
    await refresh();
  },
  positions: async (f, data) => {
    const changes = {};
    for (const k of Object.keys(S.meta.issues)) if (Number(data[`pos_${k}`]) !== Math.round(S.me.politician.positions[k])) changes[k] = Number(data[`pos_${k}`]);
    if (!Object.keys(changes).length) return toast('Nothing changed.');
    if (!confirm(`Change ${Object.keys(changes).length} position(s)? This goes on your public record.`)) return;
    toast((await api('/me/positions', { changes })).message);
    await refresh();
  },
  action: async (f, data) => {
    const body = { action: f.dataset.action, ...data };
    if ('targetName' in data && !data.targetId) throw new Error('Pick someone from the suggestions.');
    const r = await api('/me/action', body);
    toast(r.message, r.backfire);
    await loadMe();
    const bar = document.querySelector('.resource-bar');
    if (bar) bar.outerHTML = shell('').match(/<div class="resource-bar">[\s\S]*<\/div>$/)[0];
    if (r.poll) renderPoll(r.poll);
  },
  introduce: async (f, data) => {
    const r = await api('/bills', data);
    toast(`${r.bill.number} introduced.`);
    location.hash = `#/bill/${r.bill.id}`;
  },
  whip: async (f, data) => { await api(`/bills/${f.dataset.id}/whip`, { line: data.line, hard: !!data.hard }); toast('Whip notice sent.'); await refresh(); },
  nominate: async (f, data) => {
    if (data.nomineeName && !data.nomineeId) throw new Error('Pick a nominee from the suggestions, or leave it blank.');
    await api('/executive/nominate', { seatId: f.dataset.seat, nomineeId: data.nomineeId || null });
    toast('Nomination sent to the Senate.'); await refresh();
  },
  order: async (f, data, submitter) => {
    toast((await api('/executive/order', { issue: data.issue, direction: submitter?.value })).message); await refresh();
  },
  endorse: async (f, data) => { toast((await api('/parties/endorse', { role: f.dataset.role, candidateId: data.candidateId })).message); await refresh(); },
  donate: async (f, data) => { toast((await api('/parties/donate', data)).message); await refresh(); },
  dues: async (f, data) => { toast((await api('/parties/dues', data)).message); await refresh(); },
  fund: async (f, data) => { toast((await api('/parties/fund', data)).message); await refresh(); },
  mail: async (f, data) => { toast((await api('/parties/mail', data)).message); f.reset(); },
  grant: async (f, data) => { const r = await api('/admin/grant', data); document.getElementById('adminOut').textContent = JSON.stringify(r, null, 2); },
};

document.addEventListener('click', async e => {
  if (!e.target.closest('.nav-item')) document.querySelectorAll('.nav-item.open').forEach(n => n.classList.remove('open'));
  const el = e.target.closest('[data-act]');
  if (!el || !acts[el.dataset.act]) return;
  e.preventDefault();
  if (el.disabled) return;
  el.disabled = true;
  try { await acts[el.dataset.act](el); } catch (err) { toast(err.message, true); } finally { el.disabled = false; }
});

document.addEventListener('submit', async e => {
  const f = e.target.closest('[data-form]');
  if (!f) return;
  e.preventDefault();
  const data = {};
  for (const [k, v] of new FormData(f).entries()) if (v !== '') data[k] = v;
  const btns = f.querySelectorAll('button[type=submit]');
  btns.forEach(b => (b.disabled = true));
  try { await forms[f.dataset.form](f, data, e.submitter); } catch (err) { toast(err.message, true); } finally { btns.forEach(b => (b.disabled = false)); }
});

document.addEventListener('input', async e => {
  const el = e.target;
  if (el.dataset.actInput === 'slider') {
    const k = el.name.slice(4);
    document.getElementById(`lbl_${k}`).textContent = S.meta.issues[k].labels[Number(el.value) + 3];
    renderFitBars(el.form);
  }
  if (el.dataset.actInput === 'polsearch') {
    const hidden = el.form.querySelector(`[name=${el.name === 'nomineeName' ? 'nomineeId' : 'targetId'}]`);
    hidden.value = '';
    el._results = el._results || {};
    const match = el._results[el.value];
    if (match) { hidden.value = match; return; }
    if (el.value.length < 2) return;
    const { politicians } = await api(`/politicians?npc=${el.name === 'targetName' ? 1 : ''}&q=${encodeURIComponent(el.value)}`);
    const list = document.getElementById('polList');
    list.innerHTML = politicians.filter(p => p.id !== S.me.politician.id).map(p => `<option value="${esc(p.name)} (${p.party}-${p.state})"></option>`).join('');
    for (const p of politicians) el._results[`${p.name} (${p.party}-${p.state})`] = p.id;
  }
});

document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset.actChange === 'createstate') el.form.district.innerHTML = districtOptions(el.value);
  if (el.dataset.actChange === 'billkind') {
    document.getElementById('policyFields').classList.toggle('hidden', el.value !== 'policy');
    document.getElementById('appropFields').classList.toggle('hidden', el.value === 'policy');
  }
  if (el.dataset.actChange === 'billissue') fillTargets(el.form, el.form._policy);
});

// ---------- Boot ----------
(async () => {
  S.meta = await api('/meta');
  await loadMe();
  await render();
  // Keep resources and alerts fresh while the tab is open.
  setInterval(async () => { if (S.me?.politician && !document.hidden) { await loadMe(); const bar = document.querySelector('.resource-bar'); if (bar) bar.outerHTML = shell('').match(/<div class="resource-bar">[\s\S]*<\/div>$/)[0]; } }, 60000);
})();
