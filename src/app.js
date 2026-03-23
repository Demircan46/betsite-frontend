const API = 'http://localhost:3000/api';
let TOKEN = localStorage.getItem('bs_token');
let USER = JSON.parse(localStorage.getItem('bs_user') || 'null');
let betslip = [];
let allBets = [];
let currentSport = '';
let currentMatch = null;

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

async function api(path, opts = {}) {
  const res = await fetch(API + path, {
    headers: { 'Content-Type': 'application/json', ...(TOKEN ? { Authorization: 'Bearer ' + TOKEN } : {}) },
    ...opts,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

function initAuth() {
  document.getElementById('nav-right').classList.add('hidden');
  document.getElementById('nav-auth').classList.remove('hidden');
  document.getElementById('nav-username').textContent = USER.username;
  updateBalanceDisplay(USER.balance);
}

function updateBalanceDisplay(balance) {
  const b = parseFloat(balance || 0).toFixed(2);
  document.getElementById('balance-amount').textContent = b + ' USDT';
  document.getElementById('wallet-balance-amount').textContent = b + ' USDT';
}

async function doLogin() {
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  document.getElementById('login-error').textContent = '';
  try {
    const data = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    TOKEN = data.token; USER = data.user;
    localStorage.setItem('bs_token', TOKEN);
    localStorage.setItem('bs_user', JSON.stringify(USER));
    initAuth(); showPage('home');
    toast('Welcome back, ' + USER.username + '!', 'success');
  } catch (err) { document.getElementById('login-error').textContent = err.message; }
}

async function doRegister() {
  const username = document.getElementById('reg-username').value;
  const email = document.getElementById('reg-email').value;
  const password = document.getElementById('reg-password').value;
  document.getElementById('reg-error').textContent = '';
  try {
    const data = await api('/auth/register', { method: 'POST', body: JSON.stringify({ username, email, password }) });
    TOKEN = data.token; USER = data.user;
    localStorage.setItem('bs_token', TOKEN);
    localStorage.setItem('bs_user', JSON.stringify(USER));
    initAuth(); showPage('home');
    toast('Account created! Welcome, ' + USER.username, 'success');
  } catch (err) { document.getElementById('reg-error').textContent = err.message; }
}

function doLogout() {
  TOKEN = null; USER = null;
  localStorage.removeItem('bs_token'); localStorage.removeItem('bs_user');
  document.getElementById('nav-right').classList.remove('hidden');
  document.getElementById('nav-auth').classList.add('hidden');
  betslip = []; renderBetslip(); showPage('home'); toast('Logged out', 'info');
}

function toggleUserMenu() { document.getElementById('user-menu').classList.toggle('hidden'); }
document.addEventListener('click', e => {
  if (!e.target.closest('.nav-user')) document.getElementById('user-menu')?.classList.add('hidden');
});

function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  document.getElementById('user-menu')?.classList.add('hidden');
  if (name === 'wallet') loadWallet();
  if (name === 'mybets') loadMyBets();
  window.scrollTo(0, 0);
}

async function loadMatches() {
  const grid = document.getElementById('matches-grid');
  grid.innerHTML = '<div class="loading-state">Loading matches...</div>';
  try {
    const url = '/matches' + (currentSport ? '?sport=' + currentSport : '');
    const data = await api(url);
    const matches = data.matches || [];
    document.getElementById('hs-matches').textContent = matches.length;
    if (!matches.length) { grid.innerHTML = '<div class="loading-state">No matches available.</div>'; return; }
    grid.innerHTML = matches.map(m => renderMatchCard(m)).join('');
  } catch (err) { grid.innerHTML = '<div class="loading-state">Failed to load matches.</div>'; }
}

function leagueName(k) {
  const m = {'soccer_turkey_super_lig':'Super Lig','soccer_uefa_champs_league':'Champions League','soccer_epl':'Premier League','soccer_spain_la_liga':'La Liga'};
  return m[k] || k;
}

function renderMatchCard(m) {
  const time = new Date(m.commence_time).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
  const lg = leagueName(m.sport_key);
  const id = m.id;
  return '<div class="match-card" onclick="openMatch(\'' + id + '\')">' +
    '<div class="mc-header"><span class="mc-league">' + lg + '</span><span class="mc-time">' + time + '</span></div>' +
    '<div class="mc-teams"><div class="mc-team"><div class="mc-team-name">' + m.home_team + '</div></div><div class="mc-vs">VS</div><div class="mc-team"><div class="mc-team-name">' + m.away_team + '</div></div></div>' +
    '<div class="mc-odds" onclick="event.stopPropagation()">' +
    '<button class="odds-btn" id="ob-' + id + '-home" onclick="quickBet(event,\'' + id + '\',\'home\',\'' + m.home_team + '\',\'' + m.away_team + '\',' + m.odds_home + ',\'' + lg + '\')">' +
    '<span class="odds-label">1 Home</span><span class="odds-value">' + (m.odds_home||'—') + '</span></button>' +
    '<button class="odds-btn" id="ob-' + id + '-draw" onclick="quickBet(event,\'' + id + '\',\'draw\',\'' + m.home_team + '\',\'' + m.away_team + '\',' + m.odds_draw + ',\'' + lg + '\')">' +
    '<span class="odds-label">X Draw</span><span class="odds-value">' + (m.odds_draw||'—') + '</span></button>' +
    '<button class="odds-btn" id="ob-' + id + '-away" onclick="quickBet(event,\'' + id + '\',\'away\',\'' + m.home_team + '\',\'' + m.away_team + '\',' + m.odds_away + ',\'' + lg + '\')">' +
    '<span class="odds-label">2 Away</span><span class="odds-value">' + (m.odds_away||'—') + '</span></button></div>' +
    '<div class="mc-footer"><span class="mc-more">+ More markets</span></div></div>';
}

function quickBet(event, matchId, selection, home, away, odds, league) {
  event.stopPropagation();
  addToBetslip(matchId, selection, home, away, odds, league);
}

async function openMatch(matchId) {
  try {
    const m = await api('/matches/' + matchId);
    currentMatch = m;
    const lg = leagueName(m.sport_key);
    const time = new Date(m.commence_time).toLocaleString('en-GB',{weekday:'short',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
    document.getElementById('match-page-header').innerHTML =
      '<div class="mph-league">' + lg + '</div>' +
      '<div class="mph-teams"><div class="mph-team"><div class="mph-team-name">' + m.home_team + '</div></div>' +
      '<div class="mph-vs">VS</div>' +
      '<div class="mph-team away"><div class="mph-team-name">' + m.away_team + '</div></div></div>' +
      '<div class="mph-info"><span>⏰ ' + time + '</span><span>🏆 ' + lg + '</span></div>';
    document.getElementById('markets-wrap').innerHTML = generateMarkets(m, lg);
    showPage('match');
  } catch(err) { toast('Failed to load match','error'); }
}

function rand(min, max) { return (min + Math.random()*(max-min)).toFixed(2); }

function generateMarkets(m, lg) {
  const h = m.home_team, a = m.away_team, id = m.id;
  const oh = parseFloat(m.odds_home), od = parseFloat(m.odds_draw), oa = parseFloat(m.odds_away);
  const markets = [
    { title:'Match Winner', cols:'cols3', items:[
      {label:h, odds:oh.toFixed(2), key:id+'-home-mw'},
      {label:'Draw', odds:od.toFixed(2), key:id+'-draw-mw'},
      {label:a, odds:oa.toFixed(2), key:id+'-away-mw'},
    ]},
    { title:'Both Teams to Score', cols:'cols2', items:[
      {label:'Yes', odds:rand(1.6,2.0), key:id+'-yes-btts'},
      {label:'No', odds:rand(1.7,2.1), key:id+'-no-btts'},
    ]},
    { title:'Over / Under 2.5 Goals', cols:'cols2', items:[
      {label:'Over 2.5', odds:rand(1.5,1.9), key:id+'-o25-ou'},
      {label:'Under 2.5', odds:rand(1.8,2.2), key:id+'-u25-ou'},
    ]},
    { title:'Over / Under 3.5 Goals', cols:'cols2', items:[
      {label:'Over 3.5', odds:rand(1.9,2.5), key:id+'-o35-ou'},
      {label:'Under 3.5', odds:rand(1.5,1.9), key:id+'-u35-ou'},
    ]},
    { title:'Double Chance', cols:'cols3', items:[
      {label:h+' or Draw', odds:rand(1.1,1.4), key:id+'-1x-dc'},
      {label:h+' or '+a, odds:rand(1.2,1.5), key:id+'-12-dc'},
      {label:'Draw or '+a, odds:rand(1.2,1.6), key:id+'-x2-dc'},
    ]},
    { title:'Half Time Result', cols:'cols3', items:[
      {label:h, odds:(oh*1.5).toFixed(2), key:id+'-home-ht'},
      {label:'Draw', odds:rand(1.8,2.4), key:id+'-draw-ht'},
      {label:a, odds:(oa*1.5).toFixed(2), key:id+'-away-ht'},
    ]},
    { title:'Total Corners', cols:'cols2', items:[
      {label:'Under 8.5', odds:rand(1.7,2.0), key:id+'-u85-cor'},
      {label:'Over 8.5', odds:rand(1.7,2.0), key:id+'-o85-cor'},
      {label:'Under 10.5', odds:rand(1.6,1.9), key:id+'-u105-cor'},
      {label:'Over 10.5', odds:rand(1.8,2.2), key:id+'-o105-cor'},
    ]},
    { title:'First Goal Scorer Team', cols:'cols3', items:[
      {label:h, odds:rand(1.8,2.2), key:id+'-home-fgs'},
      {label:'No Goal', odds:rand(7,12), key:id+'-no-fgs'},
      {label:a, odds:rand(2.2,3.0), key:id+'-away-fgs'},
    ]},
  ];
  return markets.map(mk => {
    const btns = mk.items.map(item =>
      '<button class="market-btn" id="mb-'+item.key+'" onclick="selectMarket(this)" data-key="'+item.key+'" data-label="'+item.label+'" data-match="'+h+' vs '+a+'" data-odds="'+item.odds+'" data-league="'+lg+'">' +
      '<span class="mb-label">'+item.label+'</span><span class="mb-odds">'+item.odds+'</span></button>'
    ).join('');
    return '<div class="market-card"><div class="market-header"><span class="market-title">'+mk.title+'</span><span class="market-count">'+mk.items.length+' selections</span></div>' +
      '<div class="market-body"><div class="market-grid '+mk.cols+'">'+btns+'</div></div></div>';
  }).join('');
}

function selectMarket(el) {
  if (!TOKEN) { showPage('login'); toast('Please log in to bet','info'); return; }
  const key = el.dataset.key;
  const label = el.dataset.label;
  const match = el.dataset.match;
  const odds = parseFloat(el.dataset.odds);
  const league = el.dataset.league;
  const existing = betslip.findIndex(b => b.key === key);
  if (existing >= 0) {
    betslip.splice(existing, 1);
    el.classList.remove('selected');
  } else {
    betslip.push({ key, matchId: key.split('-')[0], label, match, odds, league, market:'extra' });
    el.classList.add('selected');
  }
  renderBetslip();
  if (betslip.length === 1) openBetslip();
}

function addToBetslip(matchId, selection, home, away, odds, league) {
  if (!TOKEN) { showPage('login'); toast('Please log in to bet','info'); return; }
  if (!odds || parseFloat(odds) <= 1) return;
  const key = matchId+'-'+selection+'-mw';
  const existing = betslip.findIndex(b => b.matchId === matchId && b.market === 'mw');
  if (existing >= 0) {
    if (betslip[existing].selection === selection) {
      betslip.splice(existing, 1);
      clearMainBtns(matchId);
    } else {
      betslip[existing] = { key, matchId, selection, home, away, odds:parseFloat(odds), league, market:'mw', label: selLabel(selection,home,away) };
      clearMainBtns(matchId);
      document.getElementById('ob-'+matchId+'-'+selection)?.classList.add('selected');
      document.getElementById('mb-'+matchId+'-'+selection+'-mw')?.classList.add('selected');
    }
  } else {
    betslip.push({ key, matchId, selection, home, away, odds:parseFloat(odds), league, market:'mw', label:selLabel(selection,home,away) });
    document.getElementById('ob-'+matchId+'-'+selection)?.classList.add('selected');
    document.getElementById('mb-'+matchId+'-'+selection+'-mw')?.classList.add('selected');
  }
  renderBetslip();
  if (betslip.length === 1) openBetslip();
}

function clearMainBtns(matchId) {
  ['home','draw','away'].forEach(s => {
    document.getElementById('ob-'+matchId+'-'+s)?.classList.remove('selected');
    document.getElementById('mb-'+matchId+'-'+s+'-mw')?.classList.remove('selected');
  });
}

function renderBetslip() {
  const count = betslip.length;
  document.getElementById('betslip-count').textContent = count;
  document.getElementById('fab-count').textContent = count;
  const itemsEl = document.getElementById('betslip-items');
  const footerEl = document.getElementById('betslip-footer');
  if (!count) {
    itemsEl.innerHTML = '<div class="betslip-empty">No selections yet.<br>Click on odds to add.</div>';
    footerEl.innerHTML = ''; return;
  }
  itemsEl.innerHTML = betslip.map((b,i) =>
    '<div class="slip-item"><button class="slip-remove" onclick="removeFromSlip('+i+')">×</button>' +
    '<div class="slip-match">'+(b.match||b.home+' vs '+b.away)+'</div>' +
    '<div class="slip-selection">'+(b.label||selLabel(b.selection,b.home,b.away))+'</div>' +
    '<div class="slip-odds">'+b.odds+'</div></div>'
  ).join('');
  const totalOdds = betslip.reduce((acc,b) => acc*b.odds, 1);
  footerEl.innerHTML =
    '<div class="stake-row"><label>Stake</label>' +
    '<input class="stake-input" type="number" id="stake-input" placeholder="0.00" min="1" step="0.01" oninput="updatePotential()">' +
    '<span style="font-size:13px;color:var(--muted)">USDT</span></div>' +
    '<div class="potential-win"><span>Odds: <strong style="color:var(--txt)">'+totalOdds.toFixed(2)+'</strong></span><strong id="potential-win">0.00 USDT</strong></div>' +
    '<button class="btn-place" onclick="placeBet()">Place Bet</button>';
}

function updatePotential() {
  const stake = parseFloat(document.getElementById('stake-input')?.value || 0);
  const totalOdds = betslip.reduce((acc,b) => acc*b.odds, 1);
  const el = document.getElementById('potential-win');
  if (el) el.textContent = (stake*totalOdds).toFixed(2)+' USDT';
}

function removeFromSlip(i) {
  const b = betslip[i];
  if (b.market === 'mw') clearMainBtns(b.matchId);
  else document.getElementById('mb-'+b.key)?.classList.remove('selected');
  betslip.splice(i,1); renderBetslip();
}

function toggleBetslip() {
  document.getElementById('betslip').classList.toggle('open');
  document.getElementById('betslip-overlay').classList.toggle('hidden');
}
function openBetslip() {
  document.getElementById('betslip').classList.add('open');
  document.getElementById('betslip-overlay').classList.remove('hidden');
}

async function placeBet() {
  if (!betslip.length) return;
  const stake = parseFloat(document.getElementById('stake-input')?.value);
  if (!stake || stake < 1) { toast('Minimum bet is 1 USDT','error'); return; }
  const mwBet = betslip.find(b => b.market === 'mw');
  if (!mwBet) { toast('Only Match Winner bets are live. Please select a 1X2 market.','info'); return; }
  try {
    const btn = document.querySelector('.btn-place');
    if (btn) { btn.textContent='Placing...'; btn.disabled=true; }
    await api('/bets/place',{method:'POST',body:JSON.stringify({matchId:mwBet.matchId,selection:mwBet.selection,stake})});
    USER.balance = parseFloat(USER.balance) - stake;
    localStorage.setItem('bs_user',JSON.stringify(USER));
    updateBalanceDisplay(USER.balance);
    clearMainBtns(mwBet.matchId);
    betslip=[]; renderBetslip(); toggleBetslip();
    toast('Bet placed successfully!','success');
  } catch(err) {
    toast(err.message,'error');
    const btn = document.querySelector('.btn-place');
    if (btn) { btn.textContent='Place Bet'; btn.disabled=false; }
  }
}

async function loadWallet() {
  if (!TOKEN) { showPage('login'); return; }
  try {
    const data = await api('/user/wallet');
    document.getElementById('deposit-address').textContent = data.depositAddress || 'Generating...';
    updateBalanceDisplay(data.balance);
    USER.balance = data.balance;
    localStorage.setItem('bs_user',JSON.stringify(USER));
  } catch(err) { document.getElementById('deposit-address').textContent='Error'; }
  loadTransactions();
}

async function loadTransactions() {
  const el = document.getElementById('tx-list');
  try {
    const rows = await api('/user/transactions');
    if (!rows.length) { el.innerHTML='<div class="loading-state">No transactions yet.</div>'; return; }
    el.innerHTML = rows.map(r =>
      '<div class="tx-item"><div><div class="tx-type">'+txLabel(r.type)+'</div><div class="tx-date">'+fmtDate(r.created_at)+'</div></div>' +
      '<div class="tx-amount '+(parseFloat(r.amount)>=0?'pos':'neg')+'">'+(parseFloat(r.amount)>=0?'+':'')+parseFloat(r.amount).toFixed(2)+' USDT</div></div>'
    ).join('');
  } catch(err) { el.innerHTML='<div class="loading-state">Failed.</div>'; }
}

function copyAddress() {
  const addr = document.getElementById('deposit-address').textContent;
  navigator.clipboard.writeText(addr).then(() => toast('Address copied!','success'));
}

async function notifyDeposit() {
  const txHash = document.getElementById('tx-hash-input').value.trim();
  const amount = document.getElementById('tx-amount-input').value;
  if (!txHash) { toast('Please enter TX hash','error'); return; }
  try {
    await api('/user/deposit/notify',{method:'POST',body:JSON.stringify({txHash,amount:parseFloat(amount)})});
    toast('Deposit notified! Awaiting admin approval.','success');
    document.getElementById('tx-hash-input').value='';
    document.getElementById('tx-amount-input').value='';
  } catch(err) { toast(err.message,'error'); }
}

async function doWithdraw() {
  const toAddress = document.getElementById('withdraw-address').value.trim();
  const amount = document.getElementById('withdraw-amount').value;
  if (!toAddress||!amount) { toast('Please fill all fields','error'); return; }
  try {
    await api('/user/withdraw',{method:'POST',body:JSON.stringify({toAddress,amount:parseFloat(amount)})});
    toast('Withdrawal requested!','success');
    document.getElementById('withdraw-address').value='';
    document.getElementById('withdraw-amount').value='';
  } catch(err) { toast(err.message,'error'); }
}

async function loadMyBets() {
  if (!TOKEN) { showPage('login'); return; }
  const el = document.getElementById('bets-list');
  el.innerHTML='<div class="loading-state">Loading...</div>';
  try {
    allBets = await api('/user/bets');
    renderBets('all');
  } catch(err) { el.innerHTML='<div class="loading-state">Failed.</div>'; }
}

function renderBets(filter) {
  const el = document.getElementById('bets-list');
  const filtered = filter==='all' ? allBets : allBets.filter(b => b.status===filter);
  if (!filtered.length) { el.innerHTML='<div class="loading-state">No bets found.</div>'; return; }
  el.innerHTML = filtered.map(b =>
    '<div class="bet-card '+b.status+'">' +
    '<div class="bc-top"><div class="bc-match">'+b.home_team+' vs '+b.away_team+'</div><span class="bc-status '+b.status+'">'+b.status+'</span></div>' +
    '<div class="bc-bottom">' +
    '<div class="bc-detail">Selection: <strong>'+selLabel(b.selection,b.home_team,b.away_team)+'</strong></div>' +
    '<div class="bc-detail">Odds: <strong>'+b.odds+'</strong></div>' +
    '<div class="bc-detail">Stake: <strong>'+parseFloat(b.stake).toFixed(2)+' USDT</strong></div>' +
    '<div class="bc-detail">To Win: <strong style="color:var(--green)">'+parseFloat(b.potential_win).toFixed(2)+' USDT</strong></div>' +
    '</div></div>'
  ).join('');
}

function filterBets(filter,btn) {
  document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active'); renderBets(filter);
}

function selLabel(sel,home,away) { if(sel==='home')return home; if(sel==='away')return away; return 'Draw'; }
function txLabel(t) { const m={deposit:'Deposit',withdraw:'Withdrawal',bet_place:'Bet Placed',bet_win:'Bet Won',bet_loss:'Bet Lost',manual_adjustment:'Adjustment'}; return m[t]||t; }
function fmtDate(d) { return new Date(d).toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}); }
function toast(msg,type='info') {
  const el=document.createElement('div'); el.className='toast '+type; el.textContent=msg;
  document.getElementById('toast-wrap').appendChild(el); setTimeout(()=>el.remove(),4000);
}
document.addEventListener('keydown',e=>{
  if(e.key==='Enter'){
    const active=document.querySelector('.page.active')?.id;
    if(active==='page-login')doLogin();
    if(active==='page-register')doRegister();
  }
});
