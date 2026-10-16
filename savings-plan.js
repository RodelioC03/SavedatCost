/* Daily savings plans keep a target, deadline, source account, and destination account together. */
(function(){
  function dateNumber(value){
    const parts=String(value||'').split('-').map(Number);
    return parts.length===3&&parts.every(Number.isFinite)?Date.UTC(parts[0],parts[1]-1,parts[2]):NaN;
  }
  function daysBetween(from,to){
    const start=dateNumber(from),end=dateNumber(to);
    if(!Number.isFinite(start)||!Number.isFinite(end))return 1;
    return Math.max(1,Math.floor((end-start)/86400000)+1);
  }
  function planFor(goal){return goal?.savingsPlan||null}
  function planDailyAmount(goal,date=today()){
    const remaining=Math.max(0,Number(goal.target||0)-Number(goal.current||0));
    if(!remaining)return 0;
    const plan=planFor(goal);
    const start=plan?.startDate&&dateNumber(plan.startDate)>dateNumber(date)?plan.startDate:date;
    const days=daysBetween(start,goal.due||date);
    return Math.ceil(remaining/days*100)/100;
  }
  function savingsPlanStatus(goal){
    const plan=planFor(goal),date=today();
    if(Number(goal.current||0)>=Number(goal.target||0))return 'Goal reached';
    if(!plan?.active)return 'No daily plan yet';
    if(plan.startDate&&dateNumber(date)<dateNumber(plan.startDate))return `Starts ${dateFmt(plan.startDate)}`;
    if(goal.due&&dateNumber(date)>dateNumber(goal.due))return 'Past target date';
    const recorded=state.transactions.some(item=>item.type==='expense'&&item.goalId===goal.id&&item.savingsPlanId===plan.id&&item.date===date);
    return recorded?'Recorded today':'Due today';
  }
  function accountLabel(id){return state.accounts.find(item=>item.id===id)?.name||'Choose an account'}

  function recordSavingsContribution(goal,amount,sourceId,destinationId,date,planId,description){
    if(!goal||!state.accounts.some(item=>item.id===sourceId)||!state.accounts.some(item=>item.id===destinationId)){
      alert('Choose both the account the money leaves and the account where the savings will be placed.');
      return false;
    }
    const remaining=Math.max(0,Number(goal.target||0)-Number(goal.current||0));
    const value=Math.min(Number(amount||0),remaining);
    if(!Number.isFinite(value)||value<=0){showToast('Goal reached','This savings goal already has enough money.');return false}
    const id='t'+Date.now(),transferId='tr'+Date.now()+Math.random().toString(36).slice(2,6);
    goal.current=Number(goal.current||0)+value;
    state.transactions.push({id,date,description:description||`Savings contribution · ${goal.name}`,category:'Savings',goalId:goal.id,savingsPlanId:planId||undefined,account:sourceId,type:'expense',direction:'out',amount:value});
    if(sourceId!==destinationId){
      state.transactions.push({id:id+'-deposit',transferId,date,description:`Savings deposit · ${goal.name}`,category:'Savings deposit',goalId:goal.id,savingsPlanId:planId||undefined,account:destinationId,type:'transfer',direction:'in',amount:value});
    }
    if(planId){
      const plan=planFor(goal);
      if(plan){plan.lastRecordedDate=date;plan.nextDate=dateNumber(date)<dateNumber(goal.due)?new Date(dateNumber(date)+86400000).toISOString().slice(0,10):goal.due;}
    }
    save();closeModal();current='Savings';render();
    showToast('Savings updated',`${money(value)} moved from ${accountLabel(sourceId)} to ${accountLabel(destinationId)}.`);
    return true;
  }

  function openSavingsContributionModal(goalId){
    const goal=state.goals.find(item=>item.id===goalId);
    if(!goal)return;
    if(!state.accounts.length){showToast('Add an account first','Choose a bank account or e-wallet before adding money to a goal.');return}
    const accounts=state.accounts.map(item=>[item.id,item.name]);
    const plan=planFor(goal);
    const fields=selectField('Savings goal','goalId',state.goals.map(item=>[item.id,item.name]),goal.id,true)+
      field('Amount to add · PHP','amount','','number')+
      selectField('Pay from account','sourceAccount',accounts,plan?.sourceAccount||state.accounts[0]?.id,true)+
      selectField('Put savings into account','destinationAccount',accounts,plan?.destinationAccount||state.accounts[0]?.id,true)+
      field('Date','date',today(),'date',true)+
      '<div class="field full"><p class="help-copy">The source account is reduced. If the destination is different, SavedatCost also records the deposit there so both balances stay accurate.</p></div>';
    modalShell('Add money to savings','Record a one-time contribution to a goal and place it into a bank account.',fields,'savingsContributionForm');
    document.getElementById('savingsContributionForm').onsubmit=event=>{
      event.preventDefault();
      const data=new FormData(event.target),selectedGoal=state.goals.find(item=>item.id===String(data.get('goalId')));
      recordSavingsContribution(selectedGoal,Number(data.get('amount')),String(data.get('sourceAccount')||''),String(data.get('destinationAccount')||''),String(data.get('date')||today()),'',`Savings contribution · ${selectedGoal?.name||'goal'}`);
    };
  }

  function openSavingsPlanModal(goalId){
    const goal=state.goals.find(item=>item.id===goalId);
    if(!goal)return;
    if(!state.accounts.length){showToast('Add an account first','A daily plan needs a source and destination account.');return}
    const accounts=state.accounts.map(item=>[item.id,item.name]);
    const plan=planFor(goal);
    const fields=field('Target amount · PHP','target',goal.target||'','number')+
      field('Target date','due',goal.due||today(),'date')+
      selectField('Pay from account','sourceAccount',accounts,plan?.sourceAccount||state.accounts[0]?.id)+
      selectField('Put savings into account','destinationAccount',accounts,plan?.destinationAccount||state.accounts[0]?.id)+
      field('Start date','startDate',plan?.startDate||today(),'date')+
      `<div class="field full"><label class="savings-plan-toggle"><input name="active" type="checkbox" ${plan?.active===false?'':'checked'}><span><strong>Keep this daily plan active</strong><small>SavedatCost will show the daily amount and a Record today button until the target is reached.</small></span></label></div>`+
      '<div class="field full"><div class="savings-plan-explainer">Daily amount is calculated from target minus saved, divided across the remaining days until the target date. The app records the ledger entry when you choose Record today; it does not move real bank money automatically.</div></div>';
    modalShell(plan?'Edit daily savings plan':'Set daily savings plan','Choose the deadline and the accounts used for each contribution.',fields,'savingsPlanForm');
    document.getElementById('savingsPlanForm').onsubmit=event=>{
      event.preventDefault();
      const data=new FormData(event.target),target=Number(data.get('target')),due=String(data.get('due')||''),startDate=String(data.get('startDate')||today()),sourceAccount=String(data.get('sourceAccount')||''),destinationAccount=String(data.get('destinationAccount')||'');
      if(!Number.isFinite(target)||target<=0){alert('Enter a target greater than zero.');return}
      if(!due||!dateNumber(due)||!startDate||!dateNumber(startDate)){alert('Choose a valid target and start date.');return}
      if(dateNumber(due)<dateNumber(startDate)){alert('The target date must be on or after the start date.');return}
      if(!state.accounts.some(item=>item.id===sourceAccount)||!state.accounts.some(item=>item.id===destinationAccount)){alert('Choose both accounts for the daily plan.');return}
      goal.target=target;goal.due=due;goal.savingsPlan={id:plan?.id||'sp'+Date.now(),frequency:'daily',sourceAccount,destinationAccount,startDate,active:data.get('active')==='on',lastRecordedDate:plan?.lastRecordedDate||null,nextDate:plan?.nextDate||startDate};
      save();closeModal();current='Savings';render();showToast('Daily plan saved',`${money(planDailyAmount(goal))} suggested per day until ${dateFmt(goal.due)}.`);
    };
  }

  function savingsPlanView(){
    const goals=state.goals.map(goal=>{
      const target=Number(goal.target||0),current=Number(goal.current||0),remaining=Math.max(0,target-current),pct=target?Math.min(100,current/target*100):0,plan=planFor(goal),daily=plan?planDailyAmount(goal):0,status=savingsPlanStatus(goal),source=plan?accountLabel(plan.sourceAccount):'Not set',destination=plan?accountLabel(plan.destinationAccount):'Not set',addedThisMonth=goalMonthContributions(goal.id);
      return `<div class="panel savings-goal-card"><div class="panel-head"><div><h2>${goal.name}</h2><p class="help-copy">${plan?'Daily plan · '+status:'Set a daily contribution schedule for this goal.'}</p></div><span>${Math.round(pct)}%</span></div><div class="bar"><span style="width:${pct}%;background:var(--green)"></span></div><div class="metric-line"><span>Saved</span><strong>${money(current)}</strong></div><div class="metric-line"><span>Remaining</span><strong>${money(remaining)}</strong></div><div class="metric-line"><span>Added this month</span><strong>${money(addedThisMonth)}</strong></div><div class="metric-line"><span>Target</span><strong>${money(target)}</strong></div><div class="metric-line"><span>Target date</span><strong>${goal.due?dateFmt(goal.due):'—'}</strong></div>${plan?`<div class="savings-plan-summary"><div><span>Suggested each day</span><strong>${money(daily)}</strong></div><div><span>Pay from</span><strong>${source}</strong></div><div><span>Put into</span><strong>${destination}</strong></div></div>`:'<div class="savings-plan-empty">No daily plan yet. Set a target date and SavedatCost will calculate the amount per day.</div>'}<div class="savings-goal-actions">${plan&&status==='Due today'?`<button class="primary-button" onclick="recordDailySavings('${goal.id}')">＋ Record today’s payment</button>`:plan&&status==='Recorded today'?'<button class="ghost-button" disabled>✓ Recorded today</button>':plan&&status==='Goal reached'?'<button class="ghost-button" disabled>✓ Goal reached</button>':''}<button class="ghost-button" onclick="openSavingsPlanModal('${goal.id}')">${plan?'Edit daily plan':'Set daily plan'}</button><button class="ghost-button" onclick="openSavingsContributionModal('${goal.id}')">＋ Add money</button></div></div>`;
    }).join('');
    return `<div class="view-head"><div><div class="kicker">Build your buffer</div><h1>Savings goals</h1><p>Set a target, choose a deadline, and record the daily payment into the bank account you choose.</p></div><button class="primary-button" onclick="addGoal()">＋ Add goal</button></div><div class="notice savings-plan-notice">Daily plans calculate the exact suggested contribution from your target and remaining days. Each payment still needs your confirmation so the ledger never changes unexpectedly.</div><div class="grid grid-2 section-gap">${goals||'<div class="empty"><strong>No savings goals yet</strong>Create a goal first, then set a daily plan.</div>'}</div>`;
  }

  function recordDailySavings(goalId){
    const goal=state.goals.find(item=>item.id===goalId),plan=planFor(goal),date=today();
    if(!goal||!plan?.active)return;
    if(Number(goal.current||0)>=Number(goal.target||0)){showToast('Goal reached','No more daily payment is needed.');return}
    if(plan.startDate&&dateNumber(date)<dateNumber(plan.startDate)){showToast('Plan has not started',`Your first payment is due ${dateFmt(plan.startDate)}.`);return}
    if(state.transactions.some(item=>item.type==='expense'&&item.goalId===goal.id&&item.savingsPlanId===plan.id&&item.date===date)){showToast('Already recorded','Today’s payment is already in the ledger.');return}
    recordSavingsContribution(goal,planDailyAmount(goal,date),plan.sourceAccount,plan.destinationAccount,date,plan.id,`Daily savings · ${goal.name}`);
  }

  savings=savingsPlanView;
  window.savings=savingsPlanView;
  window.openSavingsContributionModal=openSavingsContributionModal;
  window.openSavingsPlanModal=openSavingsPlanModal;
  window.recordDailySavings=recordDailySavings;
  render();
})();
