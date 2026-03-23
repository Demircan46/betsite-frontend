const API = 'https://betsite-backend.onrender.com/api';
let TOKEN = localStorage.getItem('bs_token');
let USER = JSON.parse(localStorage.getItem('bs_user') || 'null');
let betslip = [];
let allBets = [];
let currentSport = '';

document.addEventListener('DOMContentLoaded', () => {
  if (TOKEN && USER) initAuth();
  loadMatches();
  document.querySelectorAll('.sport-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sport-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentSport = btn.dataset.sport;
      loadMatches();
    });
  });
});

async function apiFetch(path, opts = {}) {
  const res = await fetch(API + path, {
    headers: { 'Content-Type': 'application/json', ...(TOKEN ? { Authorization: 'Bearer ' + TOKEN } : {}) },
    ...opts,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error');
  return data;
}

function initAuth() {
  document.getElementById('nav-right').classList.add('hidden');
  document.getElementById('nav-auth').classList.remove('hidden');
  const av = document.getElementById('nav-initials');
  if (av) av.textContent = USER.username.substring(0,2).toUpperCase();
  updateBalance(USER.balance);
}

function updateBalance(bal) {
  const b = parseFloat(bal || 0).toFixed(2);
  const el = document.getElementById('balance-amount');
  if (el) el.textContent = b + ' USDT';
  const wb = document.getElementById('wallet-balance');
  if (wb) wb.textContent = b + ' USDT';
}

async function doLogin() {
  const email = document.getElementById('login-email').value;
  const pass = document.getElementById('login-password').value;
  document.getElementById('login-err').textContent = '';
  try {
    const d = await apiFetch('/auth/login', { method:'POST', body: JSON.stringify({ email, password: pass }) });
    TOKEN = d.token; USER = d.user;
    localStorage.setItem('bs_token', TOKEN);
    localStorage.setItem('bs_user', JSON.stringify(USER));
    initAuth(); showPage('home'); toast('Welcome back!', 'success');
  } catch(e) { document.getElementById('login-err').textContent = e.message; }
}

async function doRegister() {
  const username = document.getElementById('reg-username').value;
  const email = document.getElementById('reg-email').value;
  const pass = document.getElementById('reg-password').value;
  document.getElementById('reg-err').textContent = '';
  try {
    const d = await apiFetch('/auth/register', { method:'POST', body: JSON.stringify({ username, email, password: pass }) });
    TOKEN = d.token; USER = d.user;
    localStorage.setItem('bs_token', TOKEN);
    localStorage.setItem('bs_user', JSON.stringify(USER));
    initAuth(); showPage('home'); toast('Account created!', 'success');
  } catch(e) { document.getElementById('reg-err').textContent = e.message; }
}

function doLogout() {
  TOKEN = null; USER = null;
  localStorage.removeItem('bs_token'); localStorage.removeItem('bs_user');
  document.getElementById('nav-right').classList.remove('hidden');
  document.getElementById('nav-auth').classList.add('hidden');
  betslip = []; renderBetslip(); showPage('home');
}

function toggleUserMenu() {
  document.getElementById('user-dropdown').classList.toggle('hidden');
}
document.addEventListener('click', e => {
  if (!e.target.closest('.nav-avatar')) document.getElementById('user-dropdown')?.classList.add('hidden');
});

function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  document.getElementById('user-dropdown')?.classList.add('hidden');
  if (name === 'wallet') loadWallet();
  if (name === 'mybets') loadMyBets();
  window.scrollTo(0, 0);
}

function leagueName(k) {
  const m = {
    'soccer_turkey_super_lig': 'Super Lig',
    'soccer_uefa_champs_league': 'Champions League',
    'soccer_epl': 'Premier League',
    'soccer_spain_la_liga': 'La Liga'
  };
  return m[k] || k;
}

async function loadMatches() {
  const grid = document.getElementById('matches-grid');
  if (!grid) return;
  grid.innerHTML = '<div class="loading-state"><div class="loading-spinner"></div>Loading matches...</div>';
  try {
    const url = '/matches' + (currentSport ? '?sport=' + currentSport : '');
    const data = await apiFetch(url);
    const matches = data.matches || [];
    const hsEl = document.getElementById('hs-matches');
    if (hsEl) hsEl.textContent = matches.length;
    const mcEl = document.getElementById('match-count');
    if (mcEl) mcEl.textContent = matches.length;
    if (!matches.length) {
      grid.innerHTML = '<div class="loading-state">No matches available.</div>';
      return;
    }
    grid.innerHTML = matches.map(m => buildMatchCard(m)).join('');
  } catch(e) {
    console.error('loadMatches error:', e);
    grid.innerHTML = '<div class="loading-state">Failed to load matches.</div>';
  }
}

function buildMatchCard(m) {
  const time = new Date(m.commence_time).toLocaleString('en-GB', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
  const lg = leagueName(m.sport_key);
  const id = m.id;
  const ht = (m.home_team || '').replace(/['"]/g, '');
  const at = (m.away_team || '').replace(/['"]/g, '');
  const oh = parseFloat(m.odds_home) || 0;
  const od = parseFloat(m.odds_draw) || 0;
  const oa = parseFloat(m.odds_away) || 0;

  return [
    '<div class="match-card" id="mc-' + id + '" onclick="openMatch(\`' + id + '\`)">',
    '<div class="mc-top">',
    '<span class="mc-league"><span class="mc-league-dot"></span>' + lg + '</span>',
    '<span class="mc-time">' + time + '</span>',
    '</div>',
    '<div class="mc-body">',
    '<div class="mc-teams-row">',
    '<div class="mc-team-info"><div class="mc-team-name">' + ht + '</div></div>',
    '<div class="mc-score-placeholder">VS</div>',
    '<div class="mc-team-info away"><div class="mc-team-name">' + at + '</div></div>',
    '</div>',
    '<div class="mc-odds-row" onclick="event.stopPropagation()">',
    '<button class="mc-odds-btn" id="ob-' + id + '-home" onclick="quickBet(event,\`' + id + '\`,\`home\`,\`' + ht + '\`,\`' + at + '\`,' + oh + ',\`' + lg + '\`)">',
    '<span class="mc-odds-label">1 Home</span><span class="mc-odds-val">' + (oh || '—') + '</span>',
    '</button>',
    '<button class="mc-odds-btn" id="ob-' + id + '-draw" onclick="quickBet(event,\`' + id + '\`,\`draw\`,\`' + ht + '\`,\`' + at + '\`,' + od + ',\`' + lg + '\`)">',
    '<span class="mc-odds-label">X Draw</span><span class="mc-odds-val">' + (od || '—') + '</span>',
    '</button>',
    '<button class="mc-odds-btn" id="ob-' + id + '-away" onclick="quickBet(event,\`' + id + '\`,\`away\`,\`' + ht + '\`,\`' + at + '\`,' + oa + ',\`' + lg + '\`)">',
    '<span class="mc-odds-label">2 Away</span><span class="mc-odds-val">' + (oa || '—') + '</span>',
    '</button>',
    '</div>',
    '</div>',
    '<div class="mc-footer"><span class="mc-more">+ <span>8</span> more markets</span></div>',
    '</div>'
  ].join('');
}

function quickBet(event, matchId, selection, home, away, odds, league) {
  event.stopPropagation();
  addToBetslip(matchId, selection, home, away, odds, league);
}

async function openMatch(matchId) {
  try {
    const m = await apiFetch('/matches/' + matchId);
    const lg = leagueName(m.sport_key);
    const time = new Date(m.commence_time).toLocaleString('en-GB', { weekday:'short', day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
    const ht = (m.home_team || '').replace(/['"]/g, '');
    const at = (m.away_team || '').replace(/['"]/g, '');

    document.getElementById('match-hero').innerHTML =
      '<div class="match-hero">' +
      '<div class="mh-league">' + lg + '</div>' +
      '<div class="mh-teams">' +
      '<div class="mh-team"><div class="mh-team-name">' + ht + '</div></div>' +
      '<div class="mh-vs">VS</div>' +
      '<div class="mh-team away"><div class="mh-team-name">' + at + '</div></div>' +
      '</div>' +
      '<div class="mh-meta">' +
      '<span class="mh-meta-item">' + time + '</span>' +
      '<span class="mh-meta-item">' + lg + '</span>' +
      '</div></div>';

    document.getElementById('markets-grid').innerHTML = buildMarkets(m, ht, at, lg);
    showPage('match');
  } catch(e) {
    toast('Failed to load match: ' + e.message, 'error');
  }
}

function rnd(min, max) { return (min + Math.random() * (max - min)).toFixed(2); }

function buildMarkets(m, ht, at, lg) {
  const id = m.id;
  const oh = parseFloat(m.odds_home) || 2;
  const od = parseFloat(m.odds_draw) || 3;
  const oa = parseFloat(m.odds_away) || 2.5;

  const markets = [
    { title: 'Match Winner', cols: 'c3', items: [
      { label: ht, odds: oh.toFixed(2), key: id+'-home-mw' },
      { label: 'Draw', odds: od.toFixed(2), key: id+'-draw-mw' },
      { label: at, odds: oa.toFixed(2), key: id+'-away-mw' },
    ]},
    { title: 'Both Teams to Score', cols: 'c2', items: [
      { label: 'Yes', odds: rnd(1.6, 2.0), key: id+'-yes-btts' },
      { label: 'No', odds: rnd(1.7, 2.1), key: id+'-no-btts' },
    ]},
    { title: 'Over / Under 2.5 Goals', cols: 'c2', items: [
      { label: 'Over 2.5', odds: rnd(1.5, 1.9), key: id+'-o25-ou' },
      { label: 'Under 2.5', odds: rnd(1.8, 2.2), key: id+'-u25-ou' },
    ]},
    { title: 'Over / Under 3.5 Goals', cols: 'c2', items: [
      { label: 'Over 3.5', odds: rnd(1.9, 2.5), key: id+'-o35-ou' },
      { label: 'Under 3.5', odds: rnd(1.5, 1.9), key: id+'-u35-ou' },
    ]},
    { title: 'Double Chance', cols: 'c3', items: [
      { label: ht + ' or Draw', odds: rnd(1.1, 1.4), key: id+'-1x-dc' },
      { label: ht + ' or ' + at, odds: rnd(1.2, 1.5), key: id+'-12-dc' },
      { label: 'Draw or ' + at, odds: rnd(1.2, 1.6), key: id+'-x2-dc' },
    ]},
    { title: 'Half Time Result', cols: 'c3', items: [
      { label: ht, odds: (oh * 1.5).toFixed(2), key: id+'-home-ht' },
      { label: 'Draw', odds: rnd(1.8, 2.4), key: id+'-draw-ht' },
      { label: at, odds: (oa * 1.5).toFixed(2), key: id+'-away-ht' },
    ]},
    { title: 'Total Corners', cols: 'c2', items: [
      { label: 'Under 8.5', odds: rnd(1.7, 2.0), key: id+'-u85-cor' },
      { label: 'Over 8.5', odds: rnd(1.7, 2.0), key: id+'-o85-cor' },
      { label: 'Under 10.5', odds: rnd(1.6, 1.9), key: id+'-u105-cor' },
      { label: 'Over 10.5', odds: rnd(1.8, 2.2), key: id+'-o105-cor' },
    ]},
    { title: 'First Goal Scorer Team', cols: 'c3', items: [
      { label: ht, odds: rnd(1.8, 2.2), key: id+'-home-fgs' },
      { label: 'No Goal', odds: rnd(7, 12), key: id+'-no-fgs' },
      { label: at, odds: rnd(2.2, 3.0), key: id+'-away-fgs' },
    ]},
  ];

  return markets.map(mk => {
    const btns = mk.items.map(item =>
      '<button class="mkt-btn" id="mb-' + item.key + '" ' +
      'data-key="' + item.key + '" ' +
      'data-label="' + item.label + '" ' +
      'data-match="' + ht + ' vs ' + at + '" ' +
      'data-odds="' + item.odds + '" ' +
      'data-league="' + lg + '" ' +
      'onclick="selectMarket(this)">' +
      '<span class="mkt-label">' + item.label + '</span>' +
      '<span class="mkt-odds">' + item.odds + '</span>' +
      '</button>'
    ).join('');
    return '<div class="market-card">' +
      '<div class="market-title-bar"><span class="market-name">' + mk.title + '</span><span class="market-sel-count">' + mk.items.length + ' selections</span></div>' +
      '<div class="market-body"><div class="mkt-grid ' + mk.cols + '">' + btns + '</div></div>' +
      '</div>';
  }).join('');
}

function selectMarket(el) {
  if (!TOKEN) { showPage('login'); toast('Please log in to bet', 'info'); return; }
  const key = el.dataset.key;
  const label = el.dataset.label;
  const match = el.dataset.match;
  const odds = parseFloat(el.dataset.odds);
  const league = el.dataset.league;
  const idx = betslip.findIndex(b => b.key === key);
  if (idx >= 0) {
    betslip.splice(idx, 1);
    el.classList.remove('selected');
  } else {
    betslip.push({ key, matchId: key.split('-')[0], label, match, odds, league, market: 'extra' });
    el.classList.add('selected');
  }
  renderBetslip();
  if (betslip.length === 1) openBetslip();
}

function addToBetslip(matchId, selection, home, away, odds, league) {
  if (!TOKEN) { showPage('login'); toast('Please log in to bet', 'info'); return; }
  if (!odds || odds <= 1) return;
  const key = matchId + '-' + selection + '-mw';
  const idx = betslip.findIndex(b => b.matchId === matchId && b.market === 'mw');
  if (idx >= 0) {
    if (betslip[idx].selection === selection) {
      betslip.splice(idx, 1);
      clearOdds(matchId);
    } else {
      betslip[idx] = { key, matchId, selection, home, away, odds, league, market: 'mw', label: selLabel(selection, home, away) };
      clearOdds(matchId);
      document.getElementById('ob-' + matchId + '-' + selection)?.classList.add('selected');
    }
  } else {
    betslip.push({ key, matchId, selection, home, away, odds, league, market: 'mw', label: selLabel(selection, home, away) });
    document.getElementById('ob-' + matchId + '-' + selection)?.classList.add('selected');
  }
  renderBetslip();
  if (betslip.length === 1) openBetslip();
}

function clearOdds(matchId) {
  ['home','draw','away'].forEach(s => document.getElementById('ob-'+matchId+'-'+s)?.classList.remove('selected'));
}

function renderBetslip() {
  const count = betslip.length;
  document.getElementById('bs-count').textContent = count;
  document.getElementById('fab-badge').textContent = count;
  const items = document.getElementById('bs-items');
  const footer = document.getElementById('bs-footer');
  if (!count) {
    items.innerHTML = '<div class="bs-empty"><div>No selections yet</div><div style="font-size:12px;margin-top:4px;color:var(--txt3)">Click on odds to add</div></div>';
    footer.innerHTML = ''; return;
  }
  items.innerHTML = betslip.map((b, i) =>
    '<div class="slip-card">' +
    '<button class="slip-remove" onclick="removeSlip(' + i + ')">✕</button>' +
    '<div class="slip-match">' + (b.match || b.home + ' vs ' + b.away) + '</div>' +
    '<div class="slip-sel">' + (b.label || selLabel(b.selection, b.home, b.away)) + '</div>' +
    '<div class="slip-odds">' + b.odds + '</div>' +
    '</div>'
  ).join('');
  const total = betslip.reduce((a, b) => a * b.odds, 1);
  footer.innerHTML =
    '<div class="stake-wrap"><label>Stake</label>' +
    '<input class="stake-input" type="number" id="stake-input" placeholder="0.00" min="1" step="0.01" oninput="updatePotential()">' +
    '<span class="stake-currency">USDT</span></div>' +
    '<div class="win-row"><span class="lbl">Total Odds: <strong>' + total.toFixed(2) + '</strong></span><span class="val" id="pot-win">0.00 USDT</span></div>' +
    '<button class="btn-place" onclick="placeBet()">Place Bet</button>';
}

function updatePotential() {
  const stake = parseFloat(document.getElementById('stake-input')?.value || 0);
  const total = betslip.reduce((a, b) => a * b.odds, 1);
  const el = document.getElementById('pot-win');
  if (el) el.textContent = (stake * total).toFixed(2) + ' USDT';
}

function removeSlip(i) {
  const b = betslip[i];
  if (b.market === 'mw') clearOdds(b.matchId);
  else document.getElementById('mb-' + b.key)?.classList.remove('selected');
  betslip.splice(i, 1); renderBetslip();
}

function toggleBetslip() {
  document.getElementById('betslip-panel').classList.toggle('open');
  document.getElementById('betslip-overlay').classList.toggle('hidden');
}
function openBetslip() {
  document.getElementById('betslip-panel').classList.add('open');
  document.getElementById('betslip-overlay').classList.remove('hidden');
}

async function placeBet() {
  const stake = parseFloat(document.getElementById('stake-input')?.value);
  if (!stake || stake < 1) { toast('Minimum bet is 1 USDT', 'error'); return; }
  const mwBet = betslip.find(b => b.market === 'mw');
  if (!mwBet) { toast('Please select a Match Winner (1X2) market', 'info'); return; }
  try {
    const btn = document.querySelector('.btn-place');
    if (btn) { btn.textContent = 'Placing...'; btn.disabled = true; }
    await apiFetch('/bets/place', { method: 'POST', body: JSON.stringify({ matchId: mwBet.matchId, selection: mwBet.selection, stake }) });
    USER.balance = parseFloat(USER.balance) - stake;
    localStorage.setItem('bs_user', JSON.stringify(USER));
    updateBalance(USER.balance);
    clearOdds(mwBet.matchId);
    betslip = []; renderBetslip(); toggleBetslip();
    toast('Bet placed!', 'success');
  } catch(e) {
    toast(e.message, 'error');
    const btn = document.querySelector('.btn-place');
    if (btn) { btn.textContent = 'Place Bet'; btn.disabled = false; }
  }
}

async function loadWallet() {
  if (!TOKEN) { showPage('login'); return; }
  try {
    const d = await apiFetch('/user/wallet');
    const addrEl = document.getElementById('deposit-addr');
    if (addrEl) addrEl.textContent = d.depositAddress || 'Generating...';
    updateBalance(d.balance);
    USER.balance = d.balance;
    localStorage.setItem('bs_user', JSON.stringify(USER));
  } catch(e) {}
  loadTx();
}

async function loadTx() {
  const el = document.getElementById('tx-list');
  if (!el) return;
  try {
    const rows = await apiFetch('/user/transactions');
    if (!rows.length) { el.innerHTML = '<div class="loading-state">No transactions yet.</div>'; return; }
    el.innerHTML = rows.map(r =>
      '<div class="tx-row">' +
      '<div class="tx-row-left"><div class="tx-type-label">' + txLabel(r.type) + '</div><div class="tx-date">' + fmtDate(r.created_at) + '</div></div>' +
      '<div class="tx-amount-val ' + (parseFloat(r.amount) >= 0 ? 'pos' : 'neg') + '">' + (parseFloat(r.amount) >= 0 ? '+' : '') + parseFloat(r.amount).toFixed(2) + ' USDT</div>' +
      '</div>'
    ).join('');
  } catch(e) { el.innerHTML = '<div class="loading-state">Failed to load.</div>'; }
}

function copyAddr() {
  const addr = document.getElementById('deposit-addr')?.textContent;
  if (addr) navigator.clipboard.writeText(addr).then(() => toast('Address copied!', 'success'));
}

async function notifyDeposit() {
  const txHash = document.getElementById('tx-hash')?.value.trim();
  const amount = document.getElementById('tx-amount')?.value;
  if (!txHash) { toast('Please enter TX hash', 'error'); return; }
  try {
    await apiFetch('/user/deposit/notify', { method: 'POST', body: JSON.stringify({ txHash, amount: parseFloat(amount) }) });
    toast('Deposit notified! Awaiting admin approval.', 'success');
    document.getElementById('tx-hash').value = '';
    document.getElementById('tx-amount').value = '';
  } catch(e) { toast(e.message, 'error'); }
}

async function doWithdraw() {
  const addr = document.getElementById('withdraw-addr')?.value.trim();
  const amt = document.getElementById('withdraw-amt')?.value;
  if (!addr || !amt) { toast('Please fill all fields', 'error'); return; }
  try {
    await apiFetch('/user/withdraw', { method: 'POST', body: JSON.stringify({ toAddress: addr, amount: parseFloat(amt) }) });
    toast('Withdrawal requested!', 'success');
    document.getElementById('withdraw-addr').value = '';
    document.getElementById('withdraw-amt').value = '';
  } catch(e) { toast(e.message, 'error'); }
}

async function loadMyBets() {
  if (!TOKEN) { showPage('login'); return; }
  const el = document.getElementById('bets-list');
  el.innerHTML = '<div class="loading-state"><div class="loading-spinner"></div>Loading...</div>';
  try {
    allBets = await apiFetch('/user/bets');
    renderBets('all');
  } catch(e) { el.innerHTML = '<div class="loading-state">Failed to load.</div>'; }
}

function renderBets(filter) {
  const el = document.getElementById('bets-list');
  const list = filter === 'all' ? allBets : allBets.filter(b => b.status === filter);
  if (!list.length) { el.innerHTML = '<div class="loading-state">No bets found.</div>'; return; }
  el.innerHTML = list.map(b =>
    '<div class="bet-row ' + b.status + '">' +
    '<div class="bet-row-top"><div class="bet-match">' + b.home_team + ' vs ' + b.away_team + '</div><span class="bet-badge ' + b.status + '">' + b.status + '</span></div>' +
    '<div class="bet-row-bottom">' +
    '<div class="bet-detail">Selection: <strong>' + selLabel(b.selection, b.home_team, b.away_team) + '</strong></div>' +
    '<div class="bet-detail">Odds: <strong>' + b.odds + '</strong></div>' +
    '<div class="bet-detail">Stake: <strong>' + parseFloat(b.stake).toFixed(2) + ' USDT</strong></div>' +
    '<div class="bet-detail">To Win: <strong style="color:var(--green)">' + parseFloat(b.potential_win).toFixed(2) + ' USDT</strong></div>' +
    '</div></div>'
  ).join('');
}

function filterBets(filter, btn) {
  document.querySelectorAll('.ftab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active'); renderBets(filter);
}

function selLabel(sel, home, away) { if(sel==='home') return home; if(sel==='away') return away; return 'Draw'; }
function txLabel(t) { const m = { deposit:'Deposit', withdraw:'Withdrawal', bet_place:'Bet Placed', bet_win:'Bet Won', manual_adjustment:'Adjustment' }; return m[t] || t; }
function fmtDate(d) { return new Date(d).toLocaleString('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }); }

function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  document.getElementById('toast-wrap').appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

document.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const p = document.querySelector('.page.active')?.id;
    if (p === 'page-login') doLogin();
    if (p === 'page-register') doRegister();
  }
});
