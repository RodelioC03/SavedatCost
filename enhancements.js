/* SavedatCost quality upgrades.
 * This file sits after the legacy view definitions so the improvements can be
 * added without disturbing existing local data or the calculation engine.
 */

let activeMonthKey=localStorage.getItem('savedatcost-active-month')||new Date().toISOString().slice(0,7);
let enhancementUndo=null;

function enhancementMonthLabel(){
  return new Date(`${activeMonthKey}-01T00:00:00`).toLocaleDateString('en-PH',{month:'long',year:'numeric'});
}
function enhancementAccountName(id){return state.accounts.find(item=>item.id===id)?.name||'—'}
function enhancementAccountOptions(){return state.accounts.length?state.accounts.map(item=>[item.id,item.name]):[['','No accounts available']];}
function enhancementCategoryOptions(){return[['budget','Budget'],['savings','Savings'],['investment','Investment'],['recurring','Recurring'],['other','Others']];}
function enhancementMonthTransactions(){return state.transactions.filter(item=>String(item.date||'').startsWith(activeMonthKey));}
function income(){return enhancementMonthTransactions().filter(item=>item.type==='income').reduce((sum,item)=>sum+Number(item.amount||0),0)}
function expenses(){return enhancementMonthTransactions().filter(item=>item.type==='expense').reduce((sum,item)=>sum+Number(item.amount||0),0)}
function budgetSpent(value){const category=typeof value==='string'?value:value?.category;return enhancementMonthTransactions().filter(item=>item.type==='expense'&&(item.category===category||item.budgetCategory===category)).reduce((sum,item)=>sum+Number(item.amount||0),0)}
function enhancementUnbudgetedSpent(){
  const categories=new Set(state.budgets.map(item=>item.category));
  return enhancementMonthTransactions().filter(item=>item.type==='expense'&&!categories.has(item.category)&&!['Savings','Investment','Reconciliation'].includes(item.category)).reduce((sum,item)=>sum+Number(item.amount||0),0);
}
function goalMonthContributions(goalId){
  return enhancementMonthTransactions().filter(item=>item.goalId===goalId&&item.category==='Savings'&&item.type==='expense').reduce((sum,item)=>sum+Number(item.amount||0),0);
}
function applyRecurring(id){
  const item=state.recurring.find(entry=>entry.id===id);
  if(!item)return;
  const date=`${activeMonthKey}-${String(item.day||1).padStart(2,'0')}`;
  if(state.transactions.some(entry=>entry.recurringId===id&&entry.date===date)){showToast('Already added','This recurring item is already in the selected month.');return}
  state.transactions.push({id:'t'+Date.now(),recurringId:id,date,description:item.description,category:item.category,account:item.account,type:item.type,direction:item.type==='transfer'?'out':undefined,amount:Number(item.amount||0)});
  save();current='Transactions';render();showToast('Recurring item added',`Added to ${enhancementMonthLabel()}.`);
}
function enhancementPercent(used,limit){return limit>0?Math.min(100,Math.max(0,used/limit*100)):0}
function enhancementStatus(used,limit,warning=80){
  if(limit>0&&used>limit)return{label:'Over budget',className:'budget-danger'};
  if(limit>0&&used>=limit*(Number(warning||80)/100))return{label:'Close to limit',className:'budget-warning'};
  return{label:'On track',className:'budget-good'};
}

function enhanceMonthPicker(){
  const actions=document.querySelector('.top-actions');
  if(!actions||document.getElementById('monthPicker'))return;
  const label=document.createElement('label');
  label.className='month-picker';
  label.innerHTML='<span>Month</span><input id="monthPicker" type="month" aria-label="Active month">';
  actions.insertBefore(label,actions.querySelector('#calculatorBtn')||actions.firstChild);
  const picker=document.getElementById('monthPicker');
  picker.value=activeMonthKey;
  picker.addEventListener('change',()=>{
    if(!picker.value)return;
    activeMonthKey=picker.value;
    localStorage.setItem('savedatcost-active-month',activeMonthKey);
    render();
  });
}

function enhancedBudget(){
  const planned=state.budgets.reduce((sum,item)=>sum+Number(item.limit||0),0);
  const spent=expenses();
  const remaining=planned-spent;
  const over=state.budgets.filter(item=>budgetSpent(item)>Number(item.limit||0));
  const rows=state.budgets.length?state.budgets.map(item=>{
    const limit=Number(item.limit||0);
    const used=budgetSpent(item);
    const pct=enhancementPercent(used,limit);
    const status=enhancementStatus(used,limit,item.warning);
    return `<div class="budget-row budget-row-enhanced"><div class="budget-label"><div><strong>${item.category}</strong><span class="budget-status ${status.className}">${status.label}</span></div><span>${money(used)} spent · ${money(Math.max(0,limit-used))} left · ${Math.round(limit?used/limit*100:0)}%</span></div><div class="bar"><span style="width:${pct}%;background:${used>limit?'var(--red)':pct>=Number(item.warning||80)?'var(--amber)':'var(--accent)'}"></span></div><div class="budget-row-actions"><button class="edit-button" onclick="openExpenseForCategory(decodeURIComponent('${encodeURIComponent(item.category)}'))">Add expense</button><button class="edit-button" onclick="editRecord('budget','${state.budgets.indexOf(item)}')">Edit</button></div></div>`;
  }).join(''):'<div class="empty"><strong>No budget categories yet</strong>Add a category first, then record spending against the account it came from.</div>';
  const unbudgeted=enhancementUnbudgetedSpent();
  return `<div class="view-head"><div><div class="kicker">${enhancementMonthLabel()}</div><h1>Budget</h1><p>See what is planned, what has been used, and what remains before you overspend.</p></div><div class="view-actions"><button class="ghost-button" onclick="openModal()">＋ Add transaction</button><button class="primary-button" onclick="addBudget()">＋ Add category</button></div></div><div class="grid grid-4">${stat('Planned',money(planned),'Monthly limits')}${stat('Spent',money(spent),'Budgeted and unbudgeted money out',true)}${stat('Remaining',money(remaining),remaining<0?'Review overspending':'Available in planned budgets',remaining<0)}${stat('Savings rate',`${income()?Math.round((income()-expenses())/income()*100):0}%`,'Based on money in')}</div>${over.length?`<div class="notice budget-alert">${over.length} budget${over.length>1?'s are':' is'} over the limit. Review the highlighted rows below.</div>`:''}${unbudgeted?`<div class="notice budget-alert">${money(unbudgeted)} of this month’s spending is not assigned to a budget category yet.</div>`:''}<div class="panel section-gap">${rows}</div>`;
}

function enhancedAccounts(){
  const cards=state.accounts.length?state.accounts.map(account=>{
    const provider=typeof providerInfo==='function'?providerInfo(account.provider):{label:account.type||'Account',className:'provider-other',icon:'₱'};
    const reconciled=account.lastReconciledAt?`Last checked ${dateFmt(account.lastReconciledAt)} · ${money(account.lastReconciledAmount)}`:'Not reconciled yet';
    return `<div class="account-card"><div class="account-top"><div class="account-identity">${typeof accountBrand==='function'?accountBrand(account):`<span class="account-brand provider-other">₱</span>`}<div><h3>${account.name}</h3><small>${provider.label} · ${account.type}</small></div></div></div><div class="balance">${money(accountBalance(account.id))}</div><small>Opening ${money(account.opening)} · derived from ledger</small><small class="account-reconcile-note">${reconciled}</small><button class="ghost-button" style="margin-top:15px;width:100%" onclick="reconcileAccount('${account.id}')">Check actual balance</button></div>`;
  }).join(''):'<div class="empty"><strong>No accounts yet</strong>Add the bank account, e-wallet, or cash wallet you currently use.</div>';
  return `<div class="view-head"><div><div class="kicker">Where money lives</div><h1>Accounts</h1><p>Every money-in and money-out entry is connected to a real account.</p></div><button class="primary-button" onclick="addAccount()">＋ Add account</button></div><div class="grid grid-3">${cards}</div><div class="panel section-gap"><div class="panel-head"><div><h2>Balance integrity</h2><p class="help-copy">Reconcile an account when the balance in your bank or wallet does not match the ledger.</p></div><span>Local ledger</span></div><div class="metric-line"><span>Total across accounts</span><strong>${money(totalCash())}</strong></div><div class="metric-line"><span>Tracked accounts</span><strong>${state.accounts.length}</strong></div></div>`;
}

function enhancedInvestments(){
  const contributed=state.investments.reduce((sum,item)=>sum+Number(item.cost||0),0);
  const value=investmentValue();
  const gain=value-contributed;
  const gainPercent=contributed?gain/contributed*100:0;
  const rows=state.investments.length?state.investments.map(item=>{
    const cost=Number(item.cost||0),current=Number(item.units||0)*Number(item.price||0),delta=current-cost;
    return `<tr><td><strong>${item.name}</strong></td><td>${item.kind||'Investment'}</td><td>${Number(item.units||0).toFixed(4)}</td><td>${money(cost)}</td><td>${money(item.price)}</td><td class="${delta>=0?'amount income':'amount expense'}">${money(current)}<small class="table-subvalue">${delta>=0?'+':''}${money(delta)}</small></td><td><button class="edit-button" onclick="editRecord('investment','${item.id}')">Edit</button></td></tr>`;
  }).join(''):'<tr><td colspan="7"><div class="empty"><strong>No holdings yet</strong>Add a holding when you are ready to track long-term progress.</div></td></tr>';
  return `<div class="view-head"><div><div class="kicker">Long-term view</div><h1>Investments</h1><p>Track contributions, current value, and gain or loss without hiding the calculation.</p></div><button class="primary-button" onclick="addInvestment()">＋ Add holding</button></div><div class="grid grid-4">${stat('Current value',money(value),'Manual prices')}${stat('Contributed',money(contributed),'Total cost')}${stat('Gain / loss',money(gain),`${gainPercent>=0?'+':''}${gainPercent.toFixed(2)}%`,gain<0)}${stat('Holdings',state.investments.length,'Keep prices updated')}</div><div class="panel section-gap"><div class="panel-head"><h2>Holdings</h2><span>Values are calculated from units × current price</span></div><div class="table-wrap"><table class="table"><thead><tr><th>Holding</th><th>Type</th><th>Units</th><th>Cost basis</th><th>Current price</th><th>Value / gain</th><th></th></tr></thead><tbody>${rows}</tbody></table></div><div class="notice">This tracker records your entries and is not investment advice.</div></div>`;
}

function enhancedTransactionFields(options={}){
  return field('Date','date',options.date||today(),'date')+selectField('Category','primaryCategory',enhancementCategoryOptions(),options.primaryCategory||'budget')+'<div id="enhancedSubcategoryWrap" class="field full"></div><div id="enhancedActionWrap" class="field full"></div>'+field('Description','description',options.description||'','text',true)+field('Amount · PHP','amount',options.amount||'','number')+'<div id="enhancedAccountWrap" class="field full"></div><div class="field full"><p class="help-copy">Choose the account where money enters, leaves, or moves through. The selected section will update from this one transaction.</p></div>';
}

function enhancedAccountFields(form,type,options={}){
  const wrap=document.getElementById('enhancedAccountWrap');
  if(!wrap)return;
  const accountOptions=enhancementAccountOptions();
  if(type==='transfer'){
    const from=options.fromAccount||options.account||state.accounts[0]?.id||'';
    const to=options.toAccount||state.accounts.find(item=>item.id!==from)?.id||state.accounts[0]?.id||'';
    wrap.innerHTML=selectField('Money leaves account','fromAccount',accountOptions,from)+selectField('Money enters account','toAccount',accountOptions,to)+'<small class="field-hint">A transfer creates two linked ledger entries and does not count as income or spending.</small>';
  }else{
    const account=options.account||state.accounts[0]?.id||'';
    const label=type==='income'?'Money enters account':'Money leaves account';
    const hint=type==='income'?'Money in will be added to this selected bank account or e-wallet.':'Money out will be deducted from this selected bank account or e-wallet.';
    wrap.innerHTML=selectField(label,'account',accountOptions,account)+'<small class="field-hint">'+hint+'</small>';
  }
}

function enhancedTransactionCategory(form,options={}){
  const category=String(form.elements.primaryCategory?.value||options.primaryCategory||'budget');
  const subWrap=document.getElementById('enhancedSubcategoryWrap');
  const actionWrap=document.getElementById('enhancedActionWrap');
  if(!subWrap||!actionWrap)return;
  let defaultSub=options.subcategory||'';
  if(category==='budget'){
    defaultSub=defaultSub||state.budgets[0]?.category||'';
    subWrap.innerHTML=state.budgets.length?selectField('Budget category','subcategory',state.budgets.map(item=>[item.category,item.category]),defaultSub,true):'<div class="notice">No budget categories yet. Add one from Budget first.</div>';
    actionWrap.innerHTML='<input type="hidden" name="type" value="expense"><div class="notice">Add payment · this will update the selected budget and reduce the selected account.</div>';
  }else if(category==='savings'){
    defaultSub=defaultSub||state.goals[0]?.id||'';
    subWrap.innerHTML=state.goals.length?selectField('Savings goal','subcategory',state.goals.map(item=>[item.id,item.name]),defaultSub,true):'<div class="notice">No savings goals yet. Add one from Savings first.</div>';
    actionWrap.innerHTML='<input type="hidden" name="type" value="expense"><div class="notice">Add money · this increases the goal and deducts from the selected account.</div>';
  }else if(category==='investment'){
    defaultSub=defaultSub||state.investments[0]?.id||'';
    subWrap.innerHTML=state.investments.length?selectField('Investment holding','subcategory',state.investments.map(item=>[item.id,item.name]),defaultSub,true):'<div class="notice">No investment holdings yet. Add one from Investments first.</div>';
    actionWrap.innerHTML='<input type="hidden" name="type" value="expense"><div class="notice">Add money · this increases contributed cost and deducts from the selected account.</div>';
  }else if(category==='recurring'){
    defaultSub=defaultSub||state.recurring[0]?.id||'';
    const recurring=state.recurring.find(item=>item.id===defaultSub)||state.recurring[0];
    subWrap.innerHTML=state.recurring.length?selectField('Recurring item','subcategory',state.recurring.map(item=>[item.id,item.description]),defaultSub,true):'<div class="notice">No recurring items yet. Add one from Recurring first.</div>';
    actionWrap.innerHTML=`<input type="hidden" name="type" value="${recurring?.type||'expense'}"><div class="notice">Add payment · this records the selected recurring item now.</div>`;
  }else{
    subWrap.innerHTML=field('Other category','category',options.category||'','text',true);
    actionWrap.innerHTML=selectField('Transaction type','type',[['expense','Money out'],['income','Money in'],['transfer','Move between accounts']],options.type||'expense',true);
  }
  const subcategory=form.elements.subcategory;
  if(subcategory){
    subcategory.onchange=()=>{
      const selected=String(subcategory.value||'');
      const description=form.elements.description;
      if(category==='recurring'){
        const item=state.recurring.find(entry=>entry.id===selected);
        const typeInput=form.elements.type;
        if(typeInput&&item)typeInput.value=item.type||'expense';
        if(item&&description&&!description.value)description.value=item.description||'';
        if(item&&item.account)options.account=item.account;
      }else if(category==='savings'){
        const item=state.goals.find(entry=>entry.id===selected);
        if(item&&description&&!description.value)description.value=`Savings contribution · ${item.name}`;
      }else if(category==='investment'){
        const item=state.investments.find(entry=>entry.id===selected);
        if(item&&description&&!description.value)description.value=`Investment contribution · ${item.name}`;
      }
      enhancedAccountFields(form,String(form.elements.type?.value||'expense'),options);
    };
    subcategory.dispatchEvent(new Event('change'));
  }
  enhancedAccountFields(form,String(form.elements.type?.value||'expense'),options);
}

function enhancedTransferRecords(values){
  const transferId='tr'+Date.now()+Math.random().toString(36).slice(2,7);
  return [{id:'t'+transferId+'-out',transferId,date:values.date,description:values.description||'Transfer',category:'Transfer',account:values.fromAccount,type:'transfer',direction:'out',amount:values.amount},{id:'t'+transferId+'-in',transferId,date:values.date,description:values.description||'Transfer',category:'Transfer',account:values.toAccount,type:'transfer',direction:'in',amount:values.amount}];
}

function openModal(options={}){
  modalShell('Add transaction','One entry updates the right budget, goal, investment, recurring item, and account.',enhancedTransactionFields(options));
  const form=document.getElementById('entityForm');
  if(!form)return;
  const submit=form.querySelector('button.primary-button');
  if(submit)submit.textContent='Save transaction';
  const refresh=()=>enhancedTransactionCategory(form,options);
  form.elements.primaryCategory.onchange=refresh;
  form.addEventListener('change',event=>{if(event.target?.name==='type')enhancedAccountFields(form,event.target.value,options)});
  refresh();
  form.onsubmit=event=>{
    event.preventDefault();
    const data=new FormData(form);
    const type=String(data.get('type')||'expense');
    const amount=Number(data.get('amount'));
    if(!Number.isFinite(amount)||amount<=0){alert('Enter an amount greater than zero.');return}
    let accountId=String(data.get('account')||'');
    if(type==='transfer'){
      const fromAccount=String(data.get('fromAccount')||''),toAccount=String(data.get('toAccount')||'');
      if(!state.accounts.some(item=>item.id===fromAccount)||!state.accounts.some(item=>item.id===toAccount)){alert('Choose both the account money leaves and the account money enters.');return}
      if(fromAccount===toAccount){alert('Choose two different accounts for a transfer.');return}
      state.transactions.push(...enhancedTransferRecords({date:String(data.get('date')||today()),description:String(data.get('description')||'').trim(),amount,fromAccount,toAccount}));
    }else{
      if(!state.accounts.some(item=>item.id===accountId)){alert('Choose the bank account or e-wallet for this transaction.');return}
      const primary=String(data.get('primaryCategory')||'other');
      const subcategory=String(data.get('subcategory')||'');
      const description=String(data.get('description')||'').trim();
      const date=String(data.get('date')||today());
      let transaction={id:'t'+Date.now(),date,description,account:accountId,type,amount};
      if(primary==='budget'){
        if(!state.budgets.some(item=>item.category===subcategory)){alert('Choose a valid budget category.');return}
        transaction={...transaction,type:'expense',category:subcategory,budgetCategory:subcategory,description:description||`${subcategory} payment`};
      }else if(primary==='savings'){
        const goal=state.goals.find(item=>item.id===subcategory);
        if(!goal){alert('Choose a valid savings goal.');return}
        goal.current=Number(goal.current||0)+amount;
        transaction={...transaction,type:'expense',category:'Savings',goalId:goal.id,description:description||`Savings contribution · ${goal.name}`};
      }else if(primary==='investment'){
        const holding=state.investments.find(item=>item.id===subcategory);
        if(!holding){alert('Choose a valid investment holding.');return}
        const price=Number(holding.price||0);
        holding.cost=Number(holding.cost||0)+amount;
        if(price>0)holding.units=Number(holding.units||0)+amount/price;
        transaction={...transaction,type:'expense',category:'Investment',investmentId:holding.id,description:description||`Investment contribution · ${holding.name}`};
      }else if(primary==='recurring'){
        const item=state.recurring.find(entry=>entry.id===subcategory);
        if(!item){alert('Choose a valid recurring item.');return}
        transaction={...transaction,type:item.type||'expense',category:item.category||'Recurring',recurringId:item.id,description:description||item.description,direction:item.type==='transfer'?'out':undefined};
      }else{
        const category=String(data.get('category')||'').trim();
        if(!category){alert('Enter an other category.');return}
        transaction={...transaction,category,description:description||category};
      }
      state.transactions.push(transaction);
    }
    save();closeModal();current='Transactions';render();showToast('Transaction saved',type==='transfer'?'Both linked accounts were updated.':'The selected account and related section were updated.');
  };
}

function openExpenseForCategory(category){openModal({primaryCategory:'budget',subcategory:category})}

function openBudgetModal(id=null){
  const existing=id===null?{}:state.budgets[Number(id)];
  if(id!==null&&!existing)return;
  const fields=field('Category name','category',existing?.category||'','text',true)+field('Monthly limit · PHP','limit',existing?.limit||'','number')+field('Warn me at (%)','warning',existing?.warning||80,'number')+'<div class="field full"><p class="help-copy">The budget bar turns amber at this percentage and red after the limit is exceeded.</p></div>';
  modalShell(id===null?'Add budget category':'Edit budget category','Set a monthly limit and a warning point that fits your routine.',fields);
  document.getElementById('entityForm').onsubmit=event=>{
    event.preventDefault();
    const data=new FormData(event.target),category=String(data.get('category')||'').trim(),limit=Number(data.get('limit')),warning=Math.min(100,Math.max(1,Number(data.get('warning')||80)));
    if(!category||!Number.isFinite(limit)||limit<=0){alert('Enter a category and a monthly limit greater than zero.');return}
    if(state.budgets.some((item,index)=>item.category.toLowerCase()===category.toLowerCase()&&index!==Number(id))){alert('That budget category already exists.');return}
    if(id===null)state.budgets.push({category,limit,warning});else Object.assign(existing,{category,limit,warning});
    save();closeModal();current='Budget';render();
  };
}
function addBudget(){openBudgetModal()}

function openTransactionEdit(id){
  const record=state.transactions.find(item=>item.id===id);
  if(!record)return;
  const counterpart=record.transferId?state.transactions.find(item=>item.transferId===record.transferId&&item.id!==record.id):null;
  const isTransfer=record.type==='transfer'&&counterpart;
  const accountOptions=enhancementAccountOptions();
  const fields=isTransfer?field('Date','date',record.date,'date')+field('Description','description',record.description||'Transfer','text',true)+field('Amount · PHP','amount',record.amount,'number')+selectField('Money leaves account','fromAccount',accountOptions,record.direction==='out'?record.account:counterpart.account)+selectField('Money enters account','toAccount',accountOptions,record.direction==='in'?record.account:counterpart.account):field('Date','date',record.date,'date')+selectField('Transaction type','type',[['expense','Money out'],['income','Money in']],record.type)+field('Description','description',record.description||'','text',true)+field('Category','category',record.category||'','text',true)+field('Amount · PHP','amount',record.amount,'number')+selectField('Account','account',accountOptions,record.account,true);
  modalShell('Edit transaction',isTransfer?'Update both sides of this linked transfer.':'Correct this transaction and the totals will recalculate.',fields);
  document.getElementById('entityForm').onsubmit=event=>{
    event.preventDefault();
    const data=new FormData(event.target),amount=Number(data.get('amount'));
    if(!Number.isFinite(amount)||amount<=0){alert('Enter an amount greater than zero.');return}
    if(isTransfer){
      const from=String(data.get('fromAccount')||''),to=String(data.get('toAccount')||'');
      if(from===to){alert('Choose two different accounts for a transfer.');return}
      const out=record.direction==='out'?record:counterpart,incoming=record.direction==='in'?record:counterpart;
      Object.assign(out,{date:data.get('date'),description:String(data.get('description')||'Transfer'),account:from,type:'transfer',direction:'out',amount});
      Object.assign(incoming,{date:data.get('date'),description:String(data.get('description')||'Transfer'),account:to,type:'transfer',direction:'in',amount});
    }else{
      const type=String(data.get('type')),account=String(data.get('account')||'');
      if(!state.accounts.some(item=>item.id===account)){alert('Choose a valid account.');return}
      Object.assign(record,{date:data.get('date'),type,description:String(data.get('description')||''),category:String(data.get('category')||'Other'),account,amount});
      if(type!=='expense')delete record.budgetCategory;
    }
    save();closeModal();current='Transactions';render();showToast('Transaction updated','Balances and budget totals were recalculated.');
  };
}

function editRecord(type,id){
  if(type==='transaction'){openTransactionEdit(id);return}
  if(type==='budget'){openBudgetModal(Number(id));return}
  openEntityModal(type,type==='budget'?Number(id):id);
}

function showUndoToast(message,detail){
  clearTimeout(toastTimer);document.querySelector('.toast')?.remove();
  const el=document.createElement('div');el.className='toast undo-toast';el.innerHTML=`<span>${message}<small>${detail}</small></span><button type="button" onclick="undoLastDelete()">Undo</button>`;document.body.appendChild(el);toastTimer=setTimeout(()=>el.remove(),5000);
}
function undoLastDelete(){
  if(!enhancementUndo)return;
  state=JSON.parse(JSON.stringify(enhancementUndo));enhancementUndo=null;save();render();showToast('Restored','The deleted record was restored.');
}
function deleteRecord(type,id){
  if(type==='account'&&state.transactions.some(item=>item.account===id)){alert('This account has transactions. Edit or move those transactions before deleting the account.');return}
  if(!confirm('Delete this record? You can undo it for a few seconds after deletion.'))return;
  enhancementUndo=JSON.parse(JSON.stringify(state));
  if(type==='transaction'){
    const target=state.transactions.find(item=>item.id===id);
    state.transactions=state.transactions.filter(item=>item.id!==id&&(!target?.transferId||item.transferId!==target.transferId));
  }else if(type==='account')state.accounts=state.accounts.filter(item=>item.id!==id);
  else if(type==='budget')state.budgets.splice(Number(id),1);
  else if(type==='goal')state.goals=state.goals.filter(item=>item.id!==id);
  else if(type==='investment')state.investments=state.investments.filter(item=>item.id!==id);
  save();render();showUndoToast('Deleted','Undo is available for a few seconds.');
}

function reconcileAccount(id){
  const account=state.accounts.find(item=>item.id===id);
  if(!account)return;
  const ledger=accountBalance(id);
  modalShell(`Reconcile ${account.name}`,'Compare the ledger with the balance shown in your bank or wallet.',field('Ledger balance','ledger',ledger,'number',true)+field('Actual balance','actual',account.lastReconciledAmount??ledger,'number',true)+'<div class="field full"><p class="help-copy">Any difference becomes a visible adjustment entry. It will not be counted as income or spending.</p></div>');
  document.getElementById('entityForm').onsubmit=event=>{
    event.preventDefault();
    const data=new FormData(event.target),actual=Number(data.get('actual'));
    if(!Number.isFinite(actual)){alert('Enter the actual balance shown by the account.');return}
    const diff=actual-ledger;
    if(Math.abs(diff)>0.005)state.transactions.push({id:'t'+Date.now(),date:today(),description:'Reconciliation adjustment',category:'Reconciliation',account:id,type:'adjustment',direction:diff>0?'in':'out',amount:Math.abs(diff)});
    account.lastReconciledAmount=actual;account.lastReconciledAt=today();
    save();closeModal();current='Accounts';render();showToast(Math.abs(diff)>0.005?'Account reconciled':'Already matched',Math.abs(diff)>0.005?`Added a ${money(Math.abs(diff))} adjustment.`:'No adjustment was needed.');
  };
}

function transactions(){
  const all=state.transactions.filter(item=>!query||`${item.description} ${item.category} ${enhancementAccountName(item.account)}`.toLowerCase().includes(query.toLowerCase())).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  const list=all.filter(item=>!(item.type==='transfer'&&item.transferId&&item.direction==='in'));
  const rows=list.map(item=>{
    const destination=item.type==='transfer'&&item.transferId?state.transactions.find(other=>other.transferId===item.transferId&&other.direction==='in'):null;
    const sign=item.type==='income'?'+':item.type==='expense'?'−':'';
    return `<tr><td>${dateFmt(item.date)}</td><td><strong>${item.description||item.category}</strong></td><td>${item.category}</td><td>${item.type==='transfer'?`${enhancementAccountName(item.account)} → ${enhancementAccountName(destination?.account)}`:enhancementAccountName(item.account)}</td><td><span class="badge ${item.type==='income'?'green':item.type==='expense'?'orange':''}">${item.type==='transfer'?'Transfer':item.type}</span></td><td class="amount ${item.type==='income'?'income':item.type==='expense'?'expense':''}">${sign}${money(item.amount)}</td><td class="transaction-actions"><button class="edit-button" onclick="editRecord('transaction','${item.id}')">Edit</button><button class="edit-button danger" onclick="deleteRecord('transaction','${item.id}')">Delete</button></td></tr>`;
  }).join('');
  return `<div class="view-head"><div><div class="kicker">Ledger · ${enhancementMonthLabel()}</div><h1>Transactions</h1><p>Every entry explains where money came from, where it went, and what it updated.</p></div><button class="primary-button" onclick="openModal()">＋ Add transaction</button></div><div class="panel"><div class="panel-head"><h2>${list.length} recorded events</h2><span>Transfers are shown as one linked event</span></div><div class="table-wrap"><table class="table"><thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Account</th><th>Type</th><th>Amount</th><th></th></tr></thead><tbody>${rows||'<tr><td colspan="7"><div class="empty"><strong>No transactions yet</strong>Add one when money moves.</div></td></tr>'}</tbody></table></div></div>`;
}

// Replace the selected views after all legacy declarations have loaded.
budget=enhancedBudget;
accounts=enhancedAccounts;
investments=enhancedInvestments;

function enhancedRender(){
  const currentRenderer=enhancementBaseRender;
  currentRenderer();
  enhanceMonthPicker();
  const picker=document.getElementById('monthPicker');
  if(picker)picker.value=activeMonthKey;
}

const enhancementBaseRender=render;
render=enhancedRender;
const enhancementQuickAdd=document.getElementById('quickAdd');
if(enhancementQuickAdd)enhancementQuickAdd.onclick=openModal;
// Ensure the current view uses the enhanced functions immediately after load.
enhanceMonthPicker();
render();
