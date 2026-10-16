function goalMonthContributions(goalId){
  return state.transactions
    .filter(t=>t.type==='expense'&&t.category==='Savings'&&t.goalId===goalId&&t.date.startsWith(month))
    .reduce((sum,t)=>sum+Number(t.amount||0),0);
}

function openSavingsContributionModal(goalId){
  const goal=state.goals.find(item=>item.id===goalId);
  if(!goal)return;
  if(!state.accounts.length){
    showToast('Add an account first','Choose a bank account or e-wallet before adding money to a goal.');
    return;
  }
  const goalOptions=state.goals.map(item=>[item.id,item.name]);
  const accountOptions=state.accounts.map(item=>[item.id,item.name]);
  const fields=selectField('Savings goal','goalId',goalOptions,goal.id,true)+
    field('Amount to add · PHP','amount','','number')+
    selectField('Take from account','account',accountOptions,state.accounts[0]?.id,true)+
    field('Date','date',today(),'date',true)+
    '<div class="field full"><p class="help-copy">This adds to the goal, counts as monthly money out, and deducts from the selected bank account or e-wallet. It is not assigned to a regular spending budget.</p></div>';
  modalShell('Add money to savings','Move money into a goal and keep the account balance accurate.',fields,'savingsContributionForm');
  document.getElementById('savingsContributionForm').onsubmit=e=>{
    e.preventDefault();
    const formData=new FormData(e.target);
    const selectedGoal=state.goals.find(item=>item.id===String(formData.get('goalId')));
    const accountId=String(formData.get('account')||'');
    const amount=Number(formData.get('amount'));
    if(!selectedGoal||!state.accounts.some(item=>item.id===accountId)){
      alert('Choose a valid savings goal and source account.');
      return;
    }
    if(!Number.isFinite(amount)||amount<=0){
      alert('Enter an amount greater than zero.');
      return;
    }
    selectedGoal.current=Number(selectedGoal.current||0)+amount;
    state.transactions.push({
      id:'t'+Date.now(),
      date:String(formData.get('date')||today()),
      description:`Savings contribution · ${selectedGoal.name}`,
      category:'Savings',
      account:accountId,
      type:'expense',
      direction:'out',
      amount,
      goalId:selectedGoal.id
    });
    save();
    closeModal();
    current='Savings';
    render();
    const account=state.accounts.find(item=>item.id===accountId);
    showToast('Savings updated',`${money(amount)} added to ${selectedGoal.name} · ${money(accountBalance(accountId))} left in ${account?.name||'the account'}`);
  };
}

function savings(){
  const goals=state.goals.map(goal=>{
    const target=Number(goal.target||0);
    const current=Number(goal.current||0);
    const pct=target?Math.min(100,current/target*100):0;
    const due=new Date(goal.due);
    const months=Math.max(1,Math.ceil((due-new Date())/(30*86400000)));
    const monthly=Math.max(0,(target-current)/months);
    const addedThisMonth=goalMonthContributions(goal.id);
    return `<div class="panel"><div class="panel-head"><div><h2>${goal.name}</h2><p class="help-copy">Add money from any tracked account.</p></div><span>${Math.round(pct)}%</span></div><div class="bar"><span style="width:${pct}%;background:var(--green)"></span></div><div class="metric-line"><span>Saved</span><strong>${money(current)}</strong></div><div class="metric-line"><span>Added this month</span><strong>${money(addedThisMonth)}</strong></div><div class="metric-line"><span>Suggested monthly amount</span><strong>${money(monthly)}</strong></div><div class="metric-line"><span>Target</span><strong>${money(target)}</strong></div><div class="metric-line"><span>Target date</span><strong>${Number.isNaN(due.getTime())?'—':due.toLocaleDateString('en-PH',{month:'short',year:'numeric'})}</strong></div><div class="on-track">${pct>=50?'You are building momentum':'Start small and stay consistent'}</div><button class="primary-button" style="margin-top:16px;width:100%" onclick="openSavingsContributionModal('${goal.id}')">＋ Add money</button></div>`;
  }).join('');
  return `<div class="view-head"><div><div class="kicker">Build your buffer</div><h1>Savings goals</h1><p>Add money from a specific account and see your goal progress update immediately.</p></div><button class="primary-button" onclick="addGoal()">＋ Add goal</button></div><div class="grid grid-2">${goals||'<div class="empty"><strong>No savings goals yet</strong>Create a goal first, then use Add money to build it.</div>'}</div>`;
}
