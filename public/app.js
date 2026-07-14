const api = async (path, opts = {}) => {
  const res = await fetch('/api' + path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
};

let state = { user: null, politician: null, mode: 'login', activeTab: 'profile' };

// ---------- Screens ----------
const landing = document.getElementById('landing');
const authOverlay = document.getElementById('authOverlay');
const appScreen = document.getElementById('app');

function showLanding() {
  landing.classList.remove('hidden');
  authOverlay.classList.add('hidden');
  appScreen.classList.add('hidden');
}
function openAuthModal(mode) {
  setAuthMode(mode);
  authOverlay.classList.remove('hidden');
}
function closeAuthModal() { authOverlay.classList.add('hidden'); }

document.getElementById('landingSignIn').onclick = () => openAuthModal('login');
document.getElementById('heroSignIn').onclick = () => openAuthModal('login');
document.getElementById('heroCreateAccount').onclick = () => openAuthModal('register');
document.getElementById('finalCreateAccount').onclick = () => openAuthModal('register');
document.getElementById('authClose').onclick = closeAuthModal;
authOverlay.addEventListener('click', (e) => { if (e.target === authOverlay) closeAuthModal(); });

const authForm = document.getElementById('authForm');
const authMsg = document.getElementById('authMsg');
const authSubmit = document.getElementById('authSubmit');

document.getElementById('showLogin').onclick = () => setAuthMode('login');
document.getElementById('showRegister').onclick = () => setAuthMode('register');
function setAuthMode(mode) {
  state.mode = mode;
  authSubmit.textContent = mode === 'login' ? 'Sign In' : 'Register';
  authMsg.innerHTML = '';
}

authForm.onsubmit = async (e) => {
  e.preventDefault();
  authMsg.innerHTML = '';
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  try {
    const data = await api(state.mode === 'login' ? '/auth/login' : '/auth/register', {
      method: 'POST', body: JSON.stringify({ email, password })
    });
    state.user = data.user;
    closeAuthModal();
    await boot();
  } catch (err) {
    authMsg.innerHTML = `<div class="msg error">${err.message}</div>`;
  }
};

document.getElementById('logoutBtn').onclick = async () => {
  await api('/auth/logout', { method: 'POST' });
  location.reload();
};

// ---------- Boot ----------
async function boot() {
  try {
    const me = await api('/politicians/me');
    state.politician = me.politician;
    state.titleHistory = me.titleHistory;
    document.getElementById('noPoliticianNotice').classList.add('hidden');
  } catch (err) {
    state.politician = null;
  }
  landing.classList.add('hidden');
  authOverlay.classList.add('hidden');
  appScreen.classList.remove('hidden');
  document.getElementById('whoami').textContent = state.user?.email || '';

  const adminTab = document.getElementById('adminTab');
  if (state.user?.is_admin) adminTab.classList.remove('hidden');
  else adminTab.classList.add('hidden');

  if (!state.politician) {
    document.getElementById('noPoliticianNotice').classList.remove('hidden');
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  } else {
    renderTab(state.activeTab);
  }
  loadTicker();
}

document.getElementById('createForm').onsubmit = async (e) => {
  e.preventDefault();
  const msg = document.getElementById('createMsg');
  msg.innerHTML = '';
  try {
    await api('/politicians', {
      method: 'POST',
      body: JSON.stringify({
        name: document.getElementById('cName').value.trim(),
        state: document.getElementById('cState').value.trim().toUpperCase(),
        party: document.getElementById('cParty').value,
        bio: document.getElementById('cBio').value.trim(),
        avatar_url: document.getElementById('cAvatar').value.trim(),
        theme_song: document.getElementById('cSong').value.trim(),
      })
    });
    await boot();
  } catch (err) {
    msg.innerHTML = `<div class="msg error">${err.message}</div>`;
  }
};

// ---------- Tabs ----------
document.getElementById('tabs').addEventListener('click', (e) => {
  const tab = e.target.closest('.tab');
  if (!tab || tab.classList.contains('hidden')) return;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  tab.classList.add('active');
  state.activeTab = tab.dataset.tab;
  renderTab(state.activeTab);
});

async function renderTab(name) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  const el = document.getElementById('tab-' + name);
  el.classList.remove('hidden');
  el.innerHTML = '<p class="muted">Loading&hellip;</p>';
  try {
    if (name === 'profile') await renderProfile(el);
    else if (name === 'actions') await renderActions(el);
    else if (name === 'elections') await renderElections(el);
    else if (name === 'congress') await renderCongress(el);
    else if (name === 'directory') await renderDirectory(el);
    else if (name === 'admin') await renderAdmin(el);
  } catch (err) {
    el.innerHTML = `<div class="msg error">${err.message}</div>`;
  }
}

function fmt(n) { return Math.round(Number(n) * 10) / 10; }

function partyClass(party) {
  if (!party) return '';
  const p = party.toLowerCase();
  if (p.startsWith('dem')) return 'dem';
  if (p.startsWith('rep')) return 'rep';
  return '';
}

async function refreshPolitician() {
  const me = await api('/politicians/me');
  state.politician = me.politician;
  state.titleHistory = me.titleHistory;
  return me;
}

// ---------- Profile ----------
async function renderProfile(el) {
  const me = await refreshPolitician();
  const p = me.politician;
  const initials = p.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  el.innerHTML = `
    <h2 class="section-title">Politician Profile</h2>
    <div class="profile-card">
      <div class="avatar-wrap">${p.avatar_url ? `<img src="${p.avatar_url}" alt="">` : initials}</div>
      <div>
        <p class="pol-name">${p.name}</p>
        <p class="pol-meta"><span class="party-tag ${partyClass(p.party)}">${p.party}</span> &middot; ${p.state}${p.reputation > 0 ? ` &middot; Reputation ${fmt(p.reputation)}` : ''}</p>
        ${p.current_office ? `<span class="office-badge">${officeLabel(p)}</span>` : `<span class="muted">Not currently holding office</span>`}
        ${p.theme_song ? `<div style="margin-top:8px;"><a href="${p.theme_song}" target="_blank" class="muted">&#9835; Theme song</a></div>` : ''}
      </div>
    </div>
    ${p.bio ? `<p style="font-style:italic; color:var(--ink-dim);">"${escapeHtml(p.bio)}"</p>` : ''}

    <div class="stat-grid">
      <div class="stat"><div class="label">Power</div><div class="value">${fmt(p.power)}</div></div>
      <div class="stat"><div class="label">Funds</div><div class="value">$${fmt(p.funds)}</div></div>
      <div class="stat"><div class="label">State Influence</div><div class="value">${fmt(p.state_influence)}%</div></div>
      <div class="stat"><div class="label">National Influence</div><div class="value">${fmt(p.national_influence)}</div></div>
    </div>

    <h2 class="section-title" style="margin-top:26px;">Past Titles</h2>
    ${me.titleHistory.length === 0 ? '<p class="muted">No offices held yet. Enter a race to begin your career.</p>' :
      `<table><thead><tr><th>Title</th><th>Seat</th><th>Term Start</th><th>Term End</th></tr></thead><tbody>
        ${me.titleHistory.map(t => `<tr>
          <td style="text-transform:capitalize;">${t.title}</td>
          <td>${t.state ? t.state + (t.seat_number ? ' #' + t.seat_number : '') : 'National'}</td>
          <td>${new Date(t.term_start).toLocaleDateString()}</td>
          <td>${t.term_end ? new Date(t.term_end).toLocaleDateString() : 'Present'}</td>
        </tr>`).join('')}
      </tbody></table>`}
  `;
}

function officeLabel(p) {
  if (p.current_office === 'president') return 'President of the United States';
  if (p.current_office === 'senate') return `Senator — ${p.current_office_state} (Seat ${p.current_office_seat})`;
  if (p.current_office === 'house') return `Representative — ${p.current_office_state} (Seat ${p.current_office_seat})`;
  return p.current_office;
}

function escapeHtml(s) {
  const d = document.createElement('div'); d.textContent = s; return d.innerHTML;
}

// ---------- Actions ----------
async function renderActions(el) {
  const p = state.politician;
  el.innerHTML = `
    <h2 class="section-title">Campaign Actions</h2>
    <p class="section-sub">Spend Power and Funds to build State Influence, raise money, or go on the attack.</p>
    <div id="actionMsg"></div>
    <div class="stat-grid">
      <div class="stat"><div class="label">Power</div><div class="value">${fmt(p.power)}</div></div>
      <div class="stat"><div class="label">Funds</div><div class="value">$${fmt(p.funds)}</div></div>
      <div class="stat"><div class="label">State Influence</div><div class="value">${fmt(p.state_influence)}%</div></div>
    </div>
    <div class="btn-row">
      <button class="btn" data-action="rally">Hold a Rally <span class="muted">(3 power, $50 &rarr; +1% SI)</span></button>
      <button class="btn" data-action="ad">Run a TV Ad <span class="muted">(1 power, $200 &rarr; +1% SI)</span></button>
      <button class="btn secondary" data-action="fundraise">Fundraise <span class="muted">(2 power &rarr; ~$150&ndash;300)</span></button>
    </div>
    <h2 class="section-title" style="margin-top:24px;">Recent Actions</h2>
    <div id="actionLog"><p class="muted">Loading&hellip;</p></div>
  `;
  el.querySelectorAll('[data-action]').forEach(btn => {
    btn.onclick = async () => {
      const msg = document.getElementById('actionMsg');
      msg.innerHTML = '';
      try {
        const data = await api('/actions/' + btn.dataset.action, { method: 'POST' });
        state.politician = data.politician;
        msg.innerHTML = `<div class="msg success">Done. ${data.gained ? `Raised $${data.gained}.` : ''}</div>`;
        renderActions(el);
      } catch (err) {
        msg.innerHTML = `<div class="msg error">${err.message}</div>`;
      }
    };
  });
  const logData = await api('/actions/log');
  document.getElementById('actionLog').innerHTML = logData.log.length === 0
    ? '<p class="muted">No actions yet.</p>'
    : logData.log.map(l => `<div class="card"><div class="card-row">
        <span>${l.detail || l.action_type}</span>
        <span class="muted">${new Date(l.created_at).toLocaleString()}</span>
      </div></div>`).join('');
}

// ---------- Elections ----------
async function renderElections(el) {
  const p = state.politician;
  const { races } = await api('/races');
  const open = races.filter(r => r.status === 'open');
  const closed = races.filter(r => r.status === 'closed').slice(0, 8);

  el.innerHTML = `
    <h2 class="section-title">Open Races</h2>
    <p class="section-sub">You're based in <strong>${p.state}</strong>. You can enter House/Senate races there, or run for President from anywhere.</p>
    <div id="electionMsg"></div>
    <div id="openRaces">${open.length === 0 ? '<p class="muted">No open races right now.</p>' : ''}</div>
    <h2 class="section-title" style="margin-top:24px;">Recent Results</h2>
    <div id="closedRaces">${closed.length === 0 ? '<p class="muted">No races decided yet.</p>' : ''}</div>
  `;

  const openWrap = document.getElementById('openRaces');
  open.forEach(r => {
    const card = document.createElement('div');
    card.className = 'card';
    const eligible = r.office_type === 'president' || r.state === p.state;
    card.innerHTML = `
      <div class="card-row">
        <div>
          <h3>${raceTitle(r)}</h3>
          <div class="muted">Entry cost: ${r.entry_cost_power} power &middot; Closes ${new Date(r.closes_at).toLocaleString()}</div>
        </div>
        <button class="btn ${eligible ? '' : 'secondary'}" ${eligible ? '' : 'disabled'} data-enter="${r.id}">
          ${eligible ? 'Enter Race' : 'Not eligible'}
        </button>
      </div>`;
    openWrap.appendChild(card);
  });
  openWrap.querySelectorAll('[data-enter]').forEach(btn => {
    btn.onclick = async () => {
      const msg = document.getElementById('electionMsg');
      msg.innerHTML = '';
      try {
        await api(`/races/${btn.dataset.enter}/enter`, { method: 'POST' });
        msg.innerHTML = `<div class="msg success">You're in the race. Good luck.</div>`;
        await refreshPolitician();
        renderElections(el);
      } catch (err) {
        msg.innerHTML = `<div class="msg error">${err.message}</div>`;
      }
    };
  });

  const closedWrap = document.getElementById('closedRaces');
  closed.forEach(r => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `<div class="card-row">
      <div><h3>${raceTitle(r)}</h3><div class="muted">Closed ${new Date(r.closes_at).toLocaleDateString()}</div></div>
      <span class="office-badge">Winner: #${r.winner_id ?? '—'}</span>
    </div>`;
    closedWrap.appendChild(card);
  });
}

function raceTitle(r) {
  if (r.office_type === 'president') return 'President of the United States';
  if (r.office_type === 'senate') return `U.S. Senate — ${r.state} (Seat ${r.seat_number})`;
  return `U.S. House — ${r.state} (Seat ${r.seat_number})`;
}

// ---------- Congress ----------
async function renderCongress(el) {
  const p = state.politician;
  const [{ bills }, roster] = await Promise.all([api('/congress/bills'), api('/congress/roster')]);

  el.innerHTML = `
    <h2 class="section-title">Congress</h2>
    <div id="congressMsg"></div>

    ${p.current_office === 'house' ? `
      <div class="card">
        <h3>Introduce a Bill</h3>
        <label>Title</label><input id="billTitle" placeholder="e.g. Homeless Services Funding Act">
        <label>Description</label><textarea id="billDesc" rows="2"></textarea>
        <div class="btn-row"><button class="btn" id="introduceBillBtn">Introduce Bill</button></div>
      </div>` : ''}

    <div id="billsList"></div>

    <h2 class="section-title" style="margin-top:26px;">Current Roster</h2>
    <div style="display:flex; gap:24px; flex-wrap:wrap;">
      <div class="roster-col" style="flex:1; min-width:200px;">
        <h3>White House</h3>
        ${roster.president ? `<p><span class="party-tag ${partyClass(roster.president.party)}">${roster.president.name}</span> (${roster.president.party})</p>` : '<p class="muted">Vacant</p>'}
      </div>
      <div class="roster-col" style="flex:1; min-width:200px;">
        <h3>Senate</h3>
        ${roster.senate.length ? roster.senate.map(s => `<p><span class="party-tag ${partyClass(s.party)}">${s.name}</span> — ${s.current_office_state} #${s.current_office_seat}</p>`).join('') : '<p class="muted">Vacant</p>'}
      </div>
      <div class="roster-col" style="flex:1; min-width:200px;">
        <h3>House</h3>
        ${roster.house.length ? roster.house.map(h => `<p><span class="party-tag ${partyClass(h.party)}">${h.name}</span> — ${h.current_office_state} #${h.current_office_seat}</p>`).join('') : '<p class="muted">Vacant</p>'}
      </div>
    </div>
  `;

  if (p.current_office === 'house') {
    document.getElementById('introduceBillBtn').onclick = async () => {
      const msg = document.getElementById('congressMsg');
      try {
        await api('/congress/bills', {
          method: 'POST',
          body: JSON.stringify({
            title: document.getElementById('billTitle').value.trim(),
            description: document.getElementById('billDesc').value.trim(),
          })
        });
        msg.innerHTML = `<div class="msg success">Bill introduced.</div>`;
        renderCongress(el);
      } catch (err) {
        msg.innerHTML = `<div class="msg error">${err.message}</div>`;
      }
    };
  }

  const billsWrap = document.getElementById('billsList');
  bills.forEach(b => {
    const card = document.createElement('div');
    card.className = 'card';
    const stages = ['house_vote', 'senate_vote', 'president_desk'];
    const stageLabels = { house_vote: 'House', senate_vote: 'Senate', president_desk: 'President' };
    const isDone = ['signed', 'vetoed', 'failed'].includes(b.status);
    card.innerHTML = `
      <h3>${escapeHtml(b.title)}</h3>
      <p class="muted">${escapeHtml(b.description)}</p>
      <div class="pipeline">
        ${stages.map((s, i) => `
          <span class="pipe-stage ${b.status === s ? 'active' : (isDone || stages.indexOf(b.status) > i ? 'done' : '')}">${stageLabels[s]}</span>
          ${i < stages.length - 1 ? '<span class="pipe-arrow">&rarr;</span>' : ''}
        `).join('')}
        ${isDone ? `<span class="pipe-arrow">&rarr;</span><span class="pipe-stage ${b.status === 'signed' ? 'done' : 'failed'}">${b.status.toUpperCase()}</span>` : ''}
      </div>
      <div class="muted">House ${b.house_yes}-${b.house_no} &middot; Senate ${b.senate_yes}-${b.senate_no}</div>
      <div class="btn-row" data-vote-row="${b.id}"></div>
    `;
    billsWrap.appendChild(card);

    const row = card.querySelector('[data-vote-row]');
    if (b.status === 'house_vote' && p.current_office === 'house') {
      row.innerHTML = `<button class="btn" data-vote="${b.id}:yes">Vote Yes</button><button class="btn secondary" data-vote="${b.id}:no">Vote No</button>`;
    } else if (b.status === 'senate_vote' && p.current_office === 'senate') {
      row.innerHTML = `<button class="btn" data-vote="${b.id}:yes">Vote Yes</button><button class="btn secondary" data-vote="${b.id}:no">Vote No</button>`;
    } else if (b.status === 'president_desk' && p.current_office === 'president') {
      row.innerHTML = `<button class="btn" data-decide="${b.id}:sign">Sign</button><button class="btn secondary" data-decide="${b.id}:veto">Veto</button>`;
    }
  });

  billsWrap.querySelectorAll('[data-vote]').forEach(btn => {
    btn.onclick = async () => {
      const [id, vote] = btn.dataset.vote.split(':');
      const msg = document.getElementById('congressMsg');
      try {
        await api(`/congress/bills/${id}/vote`, { method: 'POST', body: JSON.stringify({ vote }) });
        msg.innerHTML = `<div class="msg success">Vote recorded.</div>`;
        renderCongress(el);
      } catch (err) {
        msg.innerHTML = `<div class="msg error">${err.message}</div>`;
      }
    };
  });
  billsWrap.querySelectorAll('[data-decide]').forEach(btn => {
    btn.onclick = async () => {
      const [id, decision] = btn.dataset.decide.split(':');
      const msg = document.getElementById('congressMsg');
      try {
        await api(`/congress/bills/${id}/decide`, { method: 'POST', body: JSON.stringify({ decision }) });
        msg.innerHTML = `<div class="msg success">Decision recorded.</div>`;
        await refreshPolitician();
        renderCongress(el);
      } catch (err) {
        msg.innerHTML = `<div class="msg error">${err.message}</div>`;
      }
    };
  });
}

// ---------- Directory ----------
async function renderDirectory(el) {
  const { politicians } = await api('/politicians');
  el.innerHTML = `
    <h2 class="section-title">Politician Directory</h2>
    <p class="section-sub">Ranked by National Influence.</p>
    <table>
      <thead><tr><th>Name</th><th>Party</th><th>State</th><th>Office</th><th>National Influence</th></tr></thead>
      <tbody>
        ${politicians.map(p => `<tr>
          <td>${p.name}</td><td><span class="party-tag ${partyClass(p.party)}">${p.party}</span></td><td>${p.state}</td>
          <td>${p.current_office ? officeLabel(p) : '—'}</td>
          <td>${fmt(p.national_influence)}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  `;
}

// ---------- Admin ----------
async function renderAdmin(el) {
  el.innerHTML = `
    <h2 class="section-title">Admin — Open a Race</h2>
    <p class="section-sub">Seeds a new House, Senate, or Presidential race. Visible only to admin accounts.</p>
    <div id="adminMsg"></div>
    <label>Office</label>
    <select id="aOffice">
      <option value="house">House</option>
      <option value="senate">Senate</option>
      <option value="president">President</option>
    </select>
    <label>State (2-letter code, leave blank for President)</label>
    <input id="aState" maxlength="2" placeholder="e.g. MI" style="text-transform:uppercase;">
    <label>Seat Number</label>
    <input id="aSeat" type="number" value="1" min="1">
    <label>Days Open</label>
    <input id="aDays" type="number" value="7" min="0" step="0.01">
    <div class="btn-row"><button class="btn" id="seedRaceBtn">Open Race</button></div>
  `;
  document.getElementById('seedRaceBtn').onclick = async () => {
    const msg = document.getElementById('adminMsg');
    msg.innerHTML = '';
    try {
      const office_type = document.getElementById('aOffice').value;
      const data = await api('/races/seed', {
        method: 'POST',
        body: JSON.stringify({
          office_type,
          state: document.getElementById('aState').value.trim().toUpperCase() || undefined,
          seat_number: Number(document.getElementById('aSeat').value) || 1,
          days_open: Number(document.getElementById('aDays').value),
        })
      });
      msg.innerHTML = `<div class="msg success">Race #${data.race.id} opened.</div>`;
    } catch (err) {
      msg.innerHTML = `<div class="msg error">${err.message}</div>`;
    }
  };
}

// ---------- Ticker ----------
async function loadTicker() {
  try {
    const { races, bills } = await api('/feed');
    const items = [];
    races.forEach(r => {
      const office = r.office_type === 'president' ? 'the White House' : `${r.office_type === 'senate' ? 'Senate' : 'House'} seat in ${r.state}`;
      items.push(`<span class="up">&#9650;</span> ${r.name} (${r.party}) wins ${office}`);
    });
    bills.forEach(b => {
      const cls = b.status === 'signed' ? 'up' : 'down';
      const verb = b.status === 'signed' ? 'signed into law' : b.status === 'vetoed' ? 'vetoed' : 'failed in Congress';
      items.push(`<span class="${cls}">${b.status === 'signed' ? '&#9650;' : '&#9660;'}</span> "${b.title}" ${verb}`);
    });
    document.getElementById('tickerTrack').innerHTML = items.length
      ? items.map(i => `<span>${i}</span>`).join('')
      : 'Welcome to Statesman. The wire is quiet — go make some news.';
  } catch (err) {
    document.getElementById('tickerTrack').textContent = 'Welcome to Statesman.';
  }
}

// ---------- Init ----------
(async function init() {
  try {
    const sess = await api('/auth/me');
    state.user = sess.user;
    await boot();
  } catch (err) {
    showLanding();
  }
})();
