function financeProviders(){return[
  {id:'bpi',label:'BPI',icon:'BPI',className:'provider-bpi',logo:'assets/bank-logos/bpi.png'},
  {id:'bdo',label:'BDO',icon:'BDO',className:'provider-bdo',logo:'assets/bank-logos/bdo.png'},
  {id:'aub',label:'AUB',icon:'AUB',className:'provider-aub',logo:'assets/bank-logos/aub.png'},
  {id:'metrobank',label:'Metrobank',icon:'MB',className:'provider-metrobank'},
  {id:'unionbank',label:'UnionBank / UB',icon:'UB',className:'provider-unionbank',logo:'assets/bank-logos/unionbank.png'},
  {id:'security-bank',label:'Security Bank',icon:'SB',className:'provider-security',logo:'assets/bank-logos/security-bank.png'},
  {id:'rcbc',label:'RCBC',icon:'RC',className:'provider-rcbc',logo:'assets/bank-logos/rcbc.png'},
  {id:'landbank',label:'LandBank',icon:'LB',className:'provider-landbank',logo:'assets/bank-logos/landbank.png'},
  {id:'pnb',label:'PNB',icon:'PNB',className:'provider-pnb',logo:'assets/bank-logos/pnb.png'},
  {id:'gcash',label:'GCash',icon:'G',className:'provider-gcash',logo:'assets/bank-logos/gcash.png'},
  {id:'maya',label:'Maya',icon:'M',className:'provider-maya',logo:'assets/bank-logos/maya.png'},
  {id:'maya-bank',label:'Maya Bank',icon:'M',className:'provider-maya-bank',logo:'assets/bank-logos/maya-bank.png'},
  {id:'gotyme',label:'GoTyme',icon:'GT',className:'provider-gotyme',logo:'assets/bank-logos/gotyme.png'},
  {id:'cimb',label:'CIMB',icon:'C',className:'provider-cimb',logo:'assets/bank-logos/cimb.png'},
  {id:'seabank',label:'MariBank',icon:'M',className:'provider-maribank',logo:'assets/bank-logos/maribank.png'},
  {id:'cash',label:'Cash',icon:'₱',className:'provider-cash'},
  {id:'other',label:'Other',icon:'₱',className:'provider-other'}
]}

function providerInfo(id){return financeProviders().find(p=>p.id===id)||financeProviders().find(p=>p.id==='other')}

function bankProviderField(selected='other'){return`<div class="field full"><label>Bank or e-wallet</label><select name="provider">${financeProviders().map(p=>`<option value="${p.id}" ${p.id===selected?'selected':''}>${p.icon} · ${p.label}</option>`).join('')}</select><small class="field-hint">Choose an icon so your accounts are easier to recognize.</small></div>`}

function providerIcon(id){const icons={
  bpi:'<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 12h8M12 8v8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  bdo:'<rect x="4" y="5" width="16" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M7 9h10M7 13h4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  metrobank:'<path d="M3 18V7l5 4 4-7 4 7 5-4v11" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  unionbank:'<path d="M5 6v7a7 7 0 0 0 14 0V6M8 6v7a4 4 0 0 0 8 0V6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  'security-bank':'<path d="M12 3l7 3v5c0 4.5-3 7.5-7 10-4-2.5-7-5.5-7-10V6l7-3z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M9 12l2 2 4-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  rcbc:'<path d="M12 3l8 8-8 10-8-10 8-8z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="11" r="2.5" fill="currentColor"/>',
  landbank:'<path d="M12 20C7 18 5 13 7 8c4 0 8 2 9 6-1 3-2 5-4 6z" fill="currentColor"/><path d="M12 19c0-5 2-9 6-12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  pnb:'<path d="M4 10h16L12 4 4 10zM6 12v6M10 12v6M14 12v6M18 12v6M4 20h16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  gcash:'<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/><text x="12" y="16" text-anchor="middle" font-size="11" font-weight="800" fill="currentColor">G</text>',
  maya:'<path d="M5 17c1-6 5-10 13-11-1 7-5 11-13 11z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M6 18c3-4 6-7 11-10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  gotyme:'<rect x="5" y="5" width="6" height="6" rx="1" fill="currentColor"/><rect x="13" y="5" width="6" height="6" rx="1" fill="currentColor" opacity=".65"/><rect x="5" y="13" width="6" height="6" rx="1" fill="currentColor" opacity=".65"/><rect x="13" y="13" width="6" height="6" rx="1" fill="currentColor"/>',
  cimb:'<circle cx="8" cy="8" r="3" fill="currentColor"/><circle cx="16" cy="8" r="3" fill="currentColor" opacity=".7"/><circle cx="8" cy="16" r="3" fill="currentColor" opacity=".7"/><circle cx="16" cy="16" r="3" fill="currentColor"/>',
  seabank:'<path d="M3 15c3-5 6 5 9 0s6 5 9 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M4 9c2-2 4-2 6 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  cash:'<text x="12" y="17" text-anchor="middle" font-size="16" font-weight="800" fill="currentColor">₱</text>',
  other:'<path d="M12 3v18M7 7h7a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
};return`<svg viewBox="0 0 24 24" aria-hidden="true">${icons[id]||icons.other}</svg>`}
function accountBrand(account){const p=providerInfo(account.provider);return p.logo?`<span class="account-brand has-logo ${p.className}" aria-label="${p.label}"><img src="${p.logo}" alt="${p.label} logo"></span>`:`<span class="account-brand ${p.className}" aria-label="${p.label}">${providerIcon(p.id)}</span>`}

function accounts(){return`<div class="view-head"><div><div class="kicker">Where money lives</div><h1>Accounts</h1><p>Bank accounts, e-wallets, and cash—kept visible and easy to check.</p></div><button class="primary-button" onclick="addAccount()">＋ Add account</button></div><div class="grid grid-3">${state.accounts.map(a=>{const p=providerInfo(a.provider);return`<div class="account-card"><div class="account-top"><div class="account-identity">${accountBrand(a)}<div><h3>${a.name}</h3><small>${p.label} · ${a.type}</small></div></div><span class="badge green">active</span></div><div class="balance">${money(accountBalance(a.id))}</div><small>Opening ${money(a.opening)} · derived from ledger</small><div class="account-actions"><button class="ghost-button" onclick="reconcileAccount('${a.id}')">Check actual balance</button><button class="ghost-button" onclick="openEntityModal('account','${a.id}')">Edit account</button></div></div>`}).join('')}</div><div class="panel section-gap"><div class="panel-head"><div><h2>Balance integrity</h2><p class="help-copy">Reconciliation helps catch missing entries without hiding the difference.</p></div><span>Local ledger</span></div><div class="metric-line"><span>Total across accounts</span><strong>${money(totalCash())}</strong></div><div class="metric-line"><span>Last local backup</span><strong>Just now</strong></div></div>`}
