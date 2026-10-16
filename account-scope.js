/* Personal-vs-joint account scope.
 * Joint accounts stay in the ledger, but can be excluded from personal totals.
 */
(function(){
  const jointNamePattern=/\b(joint|shared|partner|couple)\b/i;

  function isPersonalAccount(account){
    if(!account)return false;
    return account.includeInPersonalTotal !== false;
  }

  function normalizeJointAccounts(){
    let changed=false;
    state.accounts.forEach(account=>{
      if(account.includeInPersonalTotal===undefined && /^joint savings$/i.test(String(account.name||'').trim())){
        account.includeInPersonalTotal=false;
        changed=true;
      }
    });
    return changed;
  }

  function allCashTotal(){
    return state.accounts.reduce((sum,account)=>sum+accountBalance(account.id),0);
  }

  function personalCashTotal(){
    normalizeJointAccounts();
    return state.accounts.filter(isPersonalAccount).reduce((sum,account)=>sum+accountBalance(account.id),0);
  }

  function accountScopeField(account){
    const included=account.includeInPersonalTotal!==false;
    return `<div class="field full account-scope-field"><label class="account-scope-toggle"><input name="includeInPersonalTotal" type="checkbox" ${included?'checked':''}><span><strong>Count this account in my personal balance</strong><small>Turn this off for joint or shared money. It will stay visible and fully tracked here.</small></span></label></div>`;
  }

  function jointSummary(){
    const joint=state.accounts.filter(account=>!isPersonalAccount(account));
    if(!joint.length)return '';
    return `<div class="account-scope-note"><strong>${joint.length===1?'Shared account kept separate':'Shared accounts kept separate'} from Current Balance</strong><span>${joint.map(account=>`${account.name} · ${money(accountBalance(account.id))}`).join(' · ')}</span></div>`;
  }

  normalizeJointAccounts();
  totalCash=personalCashTotal;
  totalTrackedCash=allCashTotal;

  const baseAccountModal=openEntityModal;
  openEntityModal=function(type,id=null){
    if(type!=='account')return baseAccountModal(type,id);
    const isNew=id===null;
    const account=isNew?{}:state.accounts.find(item=>item.id===id);
    if(!account)return;
    const fields=field('Account name','name',account.name||'','text',true)+
      bankProviderField(account.provider||'other')+
      selectField('Account type','type',[['Bank account','Bank account'],['E-wallet','E-wallet'],['Cash','Cash']],account.type||'Bank account')+
      field('Opening balance · PHP','opening',account.opening||0,'number')+
      accountScopeField(account);
    modalShell(isNew?'Add account':'Edit account','Choose whether this account belongs in your personal Current Balance.',fields);
    const form=document.getElementById('entityForm');
    form.onsubmit=event=>{
      event.preventDefault();
      const data=new FormData(form);
      const item=isNew?{id:'a'+Date.now()}:account;
      Object.assign(item,{name:String(data.get('name')||'').trim(),provider:String(data.get('provider')||'other'),type:String(data.get('type')||'Bank account'),opening:Number(data.get('opening')||0),includeInPersonalTotal:data.get('includeInPersonalTotal')==='on'});
      if(!item.name){alert('Enter an account name.');return}
      if(isNew)state.accounts.push(item);
      save();closeModal();current='Accounts';render();
    };
  };

  function personalAwareAccounts(){
    normalizeJointAccounts();
    const cards=state.accounts.length?state.accounts.map(account=>{
      const provider=typeof providerInfo==='function'?providerInfo(account.provider):{label:account.type||'Account',className:'provider-other'};
      const personal=isPersonalAccount(account);
      const status=personal?'Personal balance':'Shared · separate';
      return `<div class="account-card ${personal?'':'joint-account-card'}"><div class="account-top"><div class="account-identity">${typeof accountBrand==='function'?accountBrand(account):`<span class="account-brand provider-other">₱</span>`}<div><h3>${account.name}</h3><small>${provider.label} · ${account.type}</small></div></div><span class="account-scope-status ${personal?'personal':'joint'}">${status}</span></div><div class="balance">${money(accountBalance(account.id))}</div><small>Opening ${money(account.opening)} · derived from ledger</small><small class="account-reconcile-note">${personal?'Included in your personal balance.':'Visible here, but kept out of your personal balance.'}</small><div class="account-actions"><button class="ghost-button" onclick="reconcileAccount('${account.id}')">Check actual balance</button><button class="ghost-button" onclick="openEntityModal('account','${account.id}')">Edit account</button></div></div>`;
    }).join(''):'<div class="empty"><strong>No accounts yet</strong>Add the bank account, e-wallet, or cash wallet you currently use.</div>';
    return `<div class="view-head"><div><div class="kicker">Where money lives</div><h1>Accounts</h1><p>Keep personal and shared money visible—without mixing the totals.</p></div><button class="primary-button" onclick="addAccount()">＋ Add account</button></div><div class="grid grid-3">${cards}</div><div class="panel section-gap"><div class="panel-head"><div><h2>Balance integrity</h2><p class="help-copy">Check an account when the real bank or wallet balance does not match your ledger.</p></div><span>Local ledger</span></div><div class="metric-line"><span>Current Balance</span><strong>${money(totalCash())}</strong></div>${jointSummary()}<div class="metric-line"><span>All tracked accounts</span><strong>${money(totalTrackedCash())}</strong></div><div class="metric-line"><span>Tracked accounts</span><strong>${state.accounts.length}</strong></div></div>`;
  }

  accounts=personalAwareAccounts;
  const baseDashboard=dashboard;
  dashboard=function(){
    return baseDashboard().replace('Available across accounts','Current Balance').replace('All local accounts','Personal accounts only');
  };
  const baseReports=reports;
  reports=function(){
    return baseReports().replace('Available cash','Current Balance').replace('Cash accounts','Personal cash accounts');
  };
  render();
})();
