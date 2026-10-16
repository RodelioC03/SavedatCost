/* SavedatCost Coach
 * Local-first spending monitor. It reads the existing ledger, explains patterns,
 * and protects the user from accidental budget/account overspending before the
 * normal transaction handler is allowed to save an entry.
 */

const ASSISTANT_SETTINGS_KEY='savedatcost-coach-v1';
let assistantSettings=JSON.parse(localStorage.getItem(ASSISTANT_SETTINGS_KEY)||'null')||{guard:'block'};

function assistantSaveSettings(){localStorage.setItem(ASSISTANT_SETTINGS_KEY,JSON.stringify(assistantSettings))}
function assistantText(value){return String(value??'').replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]))}
function assistantMonthItems(){return state.transactions.filter(item=>String(item.date||'').startsWith(activeMonthKey))}
function assistantMoneyOut(items){return items.filter(item=>item.type==='expense').reduce((sum,item)=>sum+Number(item.amount||0),0)}
function assistantMoneyIn(items){return items.filter(item=>item.type==='income').reduce((sum,item)=>sum+Number(item.amount||0),0)}
function assistantLatestDate(){
  const monthDates=assistantMonthItems().map(item=>String(item.date||'')).filter(Boolean).sort();
  if(monthDates.length)return monthDates[monthDates.length-1];
  const now=today();
  if(now.startsWith(activeMonthKey))return now;
  const [year,monthNumber]=activeMonthKey.split('-').map(Number);
  return new Date(Date.UTC(year,monthNumber,0)).toISOString().slice(0,10);
}
function assistantShiftDate(date,days){const value=new Date(`${date}T00:00:00`);value.setDate(value.getDate()+days);return value.toISOString().slice(0,10)}
function assistantPeriodItems(endDate,days){
  const start=assistantShiftDate(endDate,-(days-1));
  return state.transactions.filter(item=>String(item.date||'')>=start&&String(item.date||'')<=endDate);
}
function assistantCategoryTotals(items){
  return Object.entries(items.filter(item=>item.type==='expense').reduce((totals,item)=>{const key=item.category||'Other';totals[key]=(totals[key]||0)+Number(item.amount||0);return totals},{})).sort((a,b)=>b[1]-a[1])
}
function assistantPercent(value,total){return total>0?Math.round(value/total*100):0}
function assistantBudgetRows(){
  return state.budgets.map(item=>{const used=Number(budgetSpent(item)||0),limit=Number(item.limit||0);return{category:item.category,used,limit,pct:limit?used/limit*100:0,remaining:limit-used}})
}
function assistantCurrentSignals(){
  const monthItems=assistantMonthItems(),monthOut=assistantMoneyOut(monthItems),monthIn=assistantMoneyIn(monthItems);
  const budgets=assistantBudgetRows(),over=budgets.filter(item=>item.limit>0&&item.used>item.limit),near=budgets.filter(item=>item.limit>0&&item.used>=item.limit*Number(state.budgets.find(b=>b.category===item.category)?.warning||80)/100&&item.used<=item.limit);
  const unbudgeted=monthItems.filter(item=>item.type==='expense'&&!state.budgets.some(b=>b.category===item.category)&&!['Savings','Investment','Reconciliation'].includes(item.category)).reduce((sum,item)=>sum+Number(item.amount||0),0);
  const selectedDay=assistantLatestDate(),dayOut=assistantMoneyOut(assistantPeriodItems(selectedDay,1));
  const planned=budgets.reduce((sum,item)=>sum+item.limit,0),goalOut=monthItems.filter(item=>item.type==='expense'&&item.category==='Savings').reduce((sum,item)=>sum+Number(item.amount||0),0);
  return{monthItems,monthOut,monthIn,net:monthIn-monthOut,budgets,over,near,unbudgeted,selectedDay,dayOut,planned,goalOut}
}
function assistantJudgement(signals){
  if(!state.transactions.length)return{tone:'calm',title:'Your Coach is ready.',body:'Start by recording one real transaction. The Coach will learn from your actual spending without adding any placeholder data.'};
  if(signals.over.length)return{tone:'danger',title:`${signals.over.length} budget${signals.over.length>1?'s are':' is'} over the limit.`,body:`Your biggest next move is to pause spending in ${signals.over[0].category} and review the remaining month before adding another payment.`};
  if(signals.monthIn>0&&signals.monthOut>signals.monthIn)return{tone:'danger',title:'Money out is ahead of money in.',body:'Your recorded spending is currently higher than your recorded income for this period. Pause non-essential spending and check the Accounts and Budget sections.'};
  if(signals.near.length)return{tone:'watch',title:`${signals.near[0].category} is close to its limit.`,body:`You have ${money(Math.max(0,signals.near[0].remaining))} left in that budget. Keep the next purchase intentional.`};
  if(signals.monthIn>0&&signals.net>0)return{tone:'good',title:'You are keeping money available.',body:`This period is positive by ${money(signals.net)}. Protect that margin by moving a deliberate amount to savings before discretionary spending.`};
  return{tone:'calm',title:'Keep recording consistently.',body:'The Coach needs a little more history before making a strong judgment. Daily entries will make the weekly and monthly patterns more useful.'}
}
function assistantFormatPeriod(items,label){
  const out=assistantMoneyOut(items),incoming=assistantMoneyIn(items),top=assistantCategoryTotals(items)[0],net=incoming-out;
  return `<div class="coach-summary-title"><strong>${label}</strong><span>${items.length} ledger ${items.length===1?'entry':'entries'}</span></div><div class="coach-summary-grid"><div><span>Money in</span><strong class="amount income">${money(incoming)}</strong></div><div><span>Money out</span><strong class="amount expense">${money(out)}</strong></div><div><span>Net movement</span><strong class="${net<0?'amount expense':''}">${money(net)}</strong></div></div>${top?`<p class="coach-summary-note">Largest spending area: <strong>${assistantText(top[0])}</strong> at ${money(top[1])}.</p>`:'<p class="coach-summary-note">No transactions recorded in this period yet.</p>'}`
}
function assistantAlertMarkup(signals){
  const alerts=[];
  signals.over.forEach(item=>alerts.push(`<div class="coach-alert danger"><span>!</span><div><strong>${assistantText(item.category)} is over by ${money(item.used-item.limit)}</strong><small>Budget ${money(item.limit)} · spent ${money(item.used)}. New spending in this category is blocked while protection is on.</small></div></div>`));
  signals.near.filter(item=>!signals.over.includes(item)).forEach(item=>alerts.push(`<div class="coach-alert watch"><span>!</span><div><strong>${assistantText(item.category)} is ${Math.round(item.pct)}% used</strong><small>${money(Math.max(0,item.remaining))} remains before the monthly limit.</small></div></div>`));
  if(signals.unbudgeted)alerts.push(`<div class="coach-alert calm"><span>i</span><div><strong>${money(signals.unbudgeted)} is unbudgeted</strong><small>Assign those expenses to a budget so the protection rules can understand them.</small></div></div>`);
  if(!alerts.length)alerts.push('<div class="coach-empty"><strong>No warnings right now.</strong><span>Your current budget and account activity look steady.</span></div>');
  return alerts.join('')
}
function assistantQuestionAnswer(question){
  const q=String(question||'').toLowerCase(),signals=assistantCurrentSignals(),weekItems=assistantPeriodItems(signals.selectedDay,7),monthItems=signals.monthItems;
  if(q.includes('today')||q.includes('daily'))return `On ${dateFmt(signals.selectedDay)}, you recorded ${money(signals.dayOut)} going out. ${signals.dayOut?'Keep the next purchase within your remaining budget limits.':'No money-out entry is recorded yet.'}`;
  if(q.includes('week')){const out=assistantMoneyOut(weekItems),top=assistantCategoryTotals(weekItems)[0];return `This week: ${money(out)} out and ${money(assistantMoneyIn(weekItems))} in.${top?` Your largest category was ${top[0]} at ${money(top[1])}.`:''}`}
  if(q.includes('month')||q.includes('monthly'))return `This period: ${money(signals.monthOut)} out, ${money(signals.monthIn)} in, and ${money(signals.net)} net. ${signals.over.length?'You have an over-budget category that needs attention.':'Your recorded spending is within the current budget limits.'}`;
  if(q.includes('save')||q.includes('goal'))return signals.goalOut?`You have moved ${money(signals.goalOut)} into savings this period. Keep that contribution visible as a money-out entry so your account balance stays accurate.`:'No savings contribution is recorded for this period yet. Add one through Quick add → Savings when you are ready.';
  if(q.includes('where')||q.includes('spend')||q.includes('category')){const top=assistantCategoryTotals(monthItems).slice(0,3);return top.length?`Your top spending areas are ${top.map(item=>`${item[0]} (${money(item[1])})`).join(', ')}.`:'There is not enough spending history to rank categories yet.'}
  return assistantJudgement(signals).body
}
function coachView(){
  const signals=assistantCurrentSignals(),judgement=assistantJudgement(signals),weekItems=assistantPeriodItems(signals.selectedDay,7);
  return `<div class="view-head coach-head"><div><div class="kicker">Local financial monitor · ${assistantText(enhancementMonthLabel())}</div><h1>Money Coach</h1><p>Daily awareness, honest summaries, and a guardrail before your budget gets away from you.</p></div><div class="view-actions"><button class="ghost-button" onclick="openModal()">＋ Record today</button><button class="primary-button" onclick="go('Budget')">Review budget →</button></div></div><div class="coach-judgement ${judgement.tone}"><div class="coach-orb">✦</div><div><span class="coach-label">Coach judgement</span><h2>${judgement.title}</h2><p>${judgement.body}</p></div><span class="coach-mode">${assistantSettings.guard==='block'?'PROTECTION ON':assistantSettings.guard==='warn'?'WARNINGS ON':'MONITORING'}</span></div><div class="grid grid-4 coach-stats">${stat('Today out',money(signals.dayOut),dateFmt(signals.selectedDay))}${stat('Last 7 days',money(assistantMoneyOut(weekItems)),'Money out',true)}${stat('This period',money(signals.monthOut),'Money out',true)}${stat('Savings added',money(signals.goalOut),'This period')}</div><div class="grid grid-2 section-gap"><div class="panel"><div class="panel-head"><div><h2>What needs your attention</h2><p class="help-copy">The Coach checks every saved expense against your rules.</p></div><span>Live from ledger</span></div><div class="coach-alert-list">${assistantAlertMarkup(signals)}</div></div><div class="panel"><div class="panel-head"><div><h2>Ask the Coach</h2><p class="help-copy">Try “How did I spend this week?” or “Where did my money go?”</p></div><span>Local answers</span></div><form class="coach-ask" id="coachAskForm"><input name="question" placeholder="Ask about your spending…" autocomplete="off"><button class="primary-button">Ask</button></form><div id="coachAnswer" class="coach-answer"><span>Ask a question to get a plain-language answer from your ledger.</span></div></div></div><div class="grid grid-2 section-gap"><div class="panel coach-period-panel">${assistantFormatPeriod(weekItems,'Last 7 days')}</div><div class="panel coach-period-panel">${assistantFormatPeriod(signals.monthItems,enhancementMonthLabel())}</div></div><div class="panel section-gap coach-settings"><div class="panel-head"><div><h2>Overspending protection</h2><p class="help-copy">This is a local rule, not financial advice. It can stop expenses that would exceed a budget or make an account negative.</p></div><span>Saved on this device</span></div><div class="coach-setting-row"><div><strong>When an expense is risky</strong><small>Choose how the app should respond before saving it.</small></div><select id="coachGuardMode"><option value="block" ${assistantSettings.guard==='block'?'selected':''}>Block overspending</option><option value="warn" ${assistantSettings.guard==='warn'?'selected':''}>Warn, then allow</option><option value="off" ${assistantSettings.guard==='off'?'selected':''}>Monitor only</option></select></div></div>`
}
function assistantBind(){
  const form=document.getElementById('coachAskForm');
  if(form)form.onsubmit=event=>{event.preventDefault();const answer=document.getElementById('coachAnswer');answer.innerHTML=`<strong>Coach says</strong><span>${assistantText(assistantQuestionAnswer(new FormData(form).get('question')))}</span>`};
  const mode=document.getElementById('coachGuardMode');
  if(mode)mode.onchange=()=>{assistantSettings.guard=mode.value;assistantSaveSettings();render();showToast('Coach updated',mode.value==='block'?'Overspending will be blocked before saving.':mode.value==='warn'?'You will see a warning before risky spending.':'The Coach will monitor without stopping entries.')}
}
function assistantOriginalSubmitGuard(event){
  if(event.target?.id!=='entityForm'||assistantSettings.guard==='off')return;
  const form=event.target,data=new FormData(form),type=String(data.get('type')||'expense');
  if(type!=='expense')return;
  const amount=Number(data.get('amount')||0),accountId=String(data.get('account')||''),account=state.accounts.find(item=>item.id===accountId),problems=[];
  if(account&&accountBalance(accountId)-amount< -0.005)problems.push(`${account.name} would go below zero by ${money(Math.abs(accountBalance(accountId)-amount))}.`);
  const primary=String(data.get('primaryCategory')||''),category=String(data.get('subcategory')||'');
  if(primary==='budget'&&category){const budget=state.budgets.find(item=>item.category===category),used=budget?Number(budgetSpent(budget)||0):0;if(budget&&used+amount>Number(budget.limit||0))problems.push(`${category} would exceed its budget by ${money(used+amount-Number(budget.limit||0))}.`)}
  if(!problems.length)return;
  const message=`SavedatCost Coach ${assistantSettings.guard==='block'?'stopped this expense':'warning'}:\n\n${problems.join('\n')}\n\n${assistantSettings.guard==='block'?'Review your budget or choose a smaller amount before saving.':'Do you want to continue anyway?'}`;
  if(assistantSettings.guard==='warn'){if(!confirm(message))event.preventDefault();return}
  event.preventDefault();event.stopImmediatePropagation();alert(message);
}
function assistantRender(){
  if(current==='Coach'){
    nav();enhanceMonthPicker();document.body.classList.toggle('review-mode',review);document.getElementById('eyebrow').textContent='Coach';document.getElementById('pageTitle').textContent='Money Coach';document.getElementById('app').innerHTML=coachView();assistantBind();return;
  }
  assistantBaseRender();
}

icons.Coach='✦';
const assistantBaseRender=render;
const assistantBaseNav=nav;
nav=function(){assistantBaseNav();const coachButton=document.querySelector('#nav button[data-view="Coach"]');if(coachButton)coachButton.setAttribute('aria-label','Money Coach');};
render=assistantRender;
document.addEventListener('submit',assistantOriginalSubmitGuard,true);
if(document.getElementById('nav'))render();

// Natural-language ledger entry. The local parser handles common finance phrases
// without sending private data anywhere. Each result becomes a reviewable plan;
// nothing is written until the user presses Apply to ledger.
let assistantPendingPlan=null;
function assistantParseAmount(text){
  const matches=String(text||'').match(/(?:₱|php|p)?\s*([0-9][0-9,]*(?:\.\d{1,2})?)/ig)||[];
  const values=matches.map(value=>Number(value.replace(/[^0-9.]/g,''))).filter(Number.isFinite);
  return values[0]||0;
}
function assistantMatchAccount(text){
  const normalized=String(text||'').toLowerCase();
  return state.accounts.find(account=>normalized.includes(String(account.name||'').toLowerCase()))||null;
}
function assistantMatchGoal(text){
  const normalized=String(text||'').toLowerCase();
  return state.goals.find(goal=>normalized.includes(String(goal.name||'').toLowerCase()))||null;
}
function assistantMatchHolding(text){
  const normalized=String(text||'').toLowerCase();
  return state.investments.find(item=>normalized.includes(String(item.name||'').toLowerCase()))||null;
}
function assistantMatchBudget(text){
  const normalized=String(text||'').toLowerCase();
  return state.budgets.find(item=>normalized.includes(String(item.category||'').toLowerCase()))||null;
}
function assistantSuggestedCategory(text){
  const value=String(text||'').toLowerCase();
  const matches=[['Food',['food','lunch','dinner','breakfast','meal','grocery','groceries','restaurant','snack']],['Transport',['transport','fare','jeep','jeepney','bus','train','taxi','grab','gas','fuel']],['Bills',['bill','electric','electricity','water','internet','rent','load','tuition']],['Wants',['shopping','game','games','movie','coffee','entertainment']],['Health',['medicine','medical','doctor','clinic','pharmacy']]];
  return matches.find(entry=>entry[1].some(word=>value.includes(word)))?.[0]||'';
}
function assistantCommandDate(text){
  const iso=String(text||'').match(/\b(20\d{2}-\d{2}-\d{2})\b/);if(iso)return iso[1];
  const currentDate=today(),anchor=assistantLatestDate();
  if(/\byesterday\b/i.test(text))return assistantShiftDate(currentDate,-1);
  if(/\btoday\b/i.test(text)||activeMonthKey===currentDate.slice(0,7))return currentDate;
  return anchor;
}
function assistantParseCommand(text){
  const raw=String(text||'').trim(),value=raw.toLowerCase(),amount=assistantParseAmount(raw);
  if(!raw)return{error:'Tell me what happened, for example: “I spent ₱180 on lunch from Maya today.”'};
  if(!amount)return{error:'I could not find an amount. Include a peso amount such as ₱180 or 180.'};
  const account=assistantMatchAccount(raw),goal=assistantMatchGoal(raw),holding=assistantMatchHolding(raw),budget=assistantMatchBudget(raw),date=assistantCommandDate(raw);
  if(value.includes('budget')||value.includes('limit')){
    const category=budget?.category||assistantSuggestedCategory(raw)||raw.match(/(?:for|on)\s+([a-z][a-z ]+)/i)?.[1]?.trim();
    if(!category)return{error:'Tell me the budget category too, such as “set my food budget to ₱3,000.”'};
    return{kind:'budget',category,limit:amount,summary:`Set the ${category} monthly budget to ${money(amount)}.`};
  }
  if(value.includes('save')||value.includes('savings')||value.includes('put aside')||value.includes('set aside')){
    if(!goal)return{error:state.goals.length?'Tell me which goal, such as “save ₱500 for Emergency Fund.”':'Create a savings goal first, then tell me how much to add to it.'};
    if(!account&&state.accounts.length!==1)return{error:'Tell me which account the savings should leave, such as “from Maya.”'};
    return{kind:'savings',goalId:goal.id,goalName:goal.name,amount,accountId:account?.id||state.accounts[0]?.id,date,description:`Savings contribution · ${goal.name}`,summary:`Add ${money(amount)} to ${goal.name} from ${account?.name||state.accounts[0]?.name}.`};
  }
  if(value.includes('invest')||value.includes('stock')||value.includes('fund')){
    if(!holding)return{error:state.investments.length?'Tell me which holding, such as “invest ₱1,000 in BPI Fund.”':'Add an investment holding first, then tell me how much to contribute.'};
    if(!account&&state.accounts.length!==1)return{error:'Tell me which account the investment should leave, such as “from BDO.”'};
    return{kind:'investment',holdingId:holding.id,holdingName:holding.name,amount,accountId:account?.id||state.accounts[0]?.id,date,description:`Investment contribution · ${holding.name}`,summary:`Add ${money(amount)} to ${holding.name} from ${account?.name||state.accounts[0]?.name}.`};
  }
  if(value.includes('received')||value.includes('earned')||value.includes('income')||value.includes('salary')||value.includes('allowance')){
    if(!account&&state.accounts.length!==1)return{error:'Tell me which account received the money, such as “salary ₱10,000 into BDO.”'};
    const description=raw.match(/(?:received|earned|income|salary|allowance)(.*?)(?:₱|php|p)?\s*[0-9]/i)?.[1]?.trim()||'Income';
    return{kind:'income',amount,accountId:account?.id||state.accounts[0]?.id,date,description:description||'Income',category:'Income',summary:`Add ${money(amount)} of income to ${account?.name||state.accounts[0]?.name}.`};
  }
  if(value.includes('spent')||value.includes('paid')||value.includes('bought')||value.includes('expense')||value.includes('purchase')){
    if(!account&&state.accounts.length!==1)return{error:'Tell me which account the expense should leave, such as “from Maya.”'};
    const category=budget?.category||assistantSuggestedCategory(raw)||'Other';
    const description=raw.match(/(?:spent|paid|bought)\s+(?:₱|php|p)?\s*[0-9][0-9,.]*\s+(?:on|for)\s+([^,]+?)(?:\s+from\s+|\s+today|\s+yesterday|$)/i)?.[1]?.trim()||category;
    return{kind:'expense',amount,accountId:account?.id||state.accounts[0]?.id,date,category,budgetCategory:budget?.category||state.budgets.some(item=>item.category===category)?category:undefined,description,summary:`Record ${money(amount)} for ${category} from ${account?.name||state.accounts[0]?.name}.`};
  }
  return{error:'I can record spending, savings, income, investments, or budget changes. Try “I spent ₱180 on lunch from Maya.”'};
}
function assistantClearPlan(){assistantPendingPlan=null;const target=document.getElementById('coachPlan');if(target)target.innerHTML='<div class="coach-answer"><span>I will show you the exact ledger change before anything is saved.</span></div>'}
function assistantPlanMarkup(plan){
  if(!plan)return'';
  if(plan.error)return`<div class="coach-command-error"><strong>I need one more detail</strong><span>${assistantText(plan.error)}</span></div>`;
  const action=plan.kind==='budget'?'Budget change':plan.kind==='savings'?'Savings contribution':plan.kind==='investment'?'Investment contribution':plan.kind==='income'?'Money in':'Expense';
  return`<div class="coach-plan"><div><span class="coach-label">Ready to review</span><h3>${assistantText(action)}</h3><p>${assistantText(plan.summary)}</p></div><div class="coach-plan-details"><span>${assistantText(plan.date||enhancementMonthLabel())}</span><strong>${money(plan.amount||plan.limit)}</strong></div><div class="coach-plan-actions"><button class="ghost-button" type="button" onclick="assistantPendingPlan=null;document.getElementById('coachPlan').innerHTML=''">Cancel</button><button class="primary-button" type="button" onclick="assistantApplyPlan()">Apply to ledger</button></div></div>`
}
function assistantApplyPlan(){
  const plan=assistantPendingPlan;if(!plan||plan.error)return;
  if(plan.kind!=='budget'&&plan.kind!=='income'){
    const problems=[],balance=accountBalance(plan.accountId),amount=Number(plan.amount||0);
    const account=state.accounts.find(item=>item.id===plan.accountId);
    if(account&&balance-amount< -0.005)problems.push(`${account.name} would go below zero by ${money(Math.abs(balance-amount))}.`);
    if(plan.kind==='expense'&&plan.budgetCategory){const budget=state.budgets.find(item=>item.category===plan.budgetCategory),used=budget?Number(budgetSpent(budget)||0):0;if(budget&&used+amount>Number(budget.limit||0))problems.push(`${plan.budgetCategory} would exceed its budget by ${money(used+amount-Number(budget.limit||0))}.`)}
    if(problems.length&&assistantSettings.guard==='block'){alert(`SavedatCost Coach stopped this change:\n\n${problems.join('\n')}\n\nReview the preview or adjust the amount before applying.`);return}
    if(problems.length&&assistantSettings.guard==='warn'&&!confirm(`SavedatCost Coach warning:\n\n${problems.join('\n')}\n\nApply it anyway?`))return;
  }
  if(plan.kind==='budget'){
    const existing=state.budgets.find(item=>item.category.toLowerCase()===String(plan.category).toLowerCase());
    if(existing)existing.limit=plan.limit;else state.budgets.push({category:plan.category,limit:plan.limit,warning:80});
  }else{
    const amount=Number(plan.amount||0);
    if(plan.kind==='savings'){
      const goal=state.goals.find(item=>item.id===plan.goalId);if(!goal){alert('That savings goal no longer exists.');return}goal.current=Number(goal.current||0)+amount;
      state.transactions.push({id:'t'+Date.now(),date:plan.date,description:plan.description,category:'Savings',goalId:goal.id,account:plan.accountId,type:'expense',amount});
    }else if(plan.kind==='investment'){
      const holding=state.investments.find(item=>item.id===plan.holdingId);if(!holding){alert('That investment holding no longer exists.');return}holding.cost=Number(holding.cost||0)+amount;const price=Number(holding.price||0);if(price>0)holding.units=Number(holding.units||0)+amount/price;
      state.transactions.push({id:'t'+Date.now(),date:plan.date,description:plan.description,category:'Investment',investmentId:holding.id,account:plan.accountId,type:'expense',amount});
    }else state.transactions.push({id:'t'+Date.now(),date:plan.date,description:plan.description,category:plan.category||'Income',budgetCategory:plan.budgetCategory,account:plan.accountId,type:plan.kind==='income'?'income':'expense',amount});
  }
  save();assistantPendingPlan=null;render();showToast('Ledger updated','Your confirmed assistant entry was saved locally.');
}
const assistantBaseCoachView=coachView;
function coachViewWithCommands(){
  const base=assistantBaseCoachView();
  const planMarkup=assistantPendingPlan?assistantPlanMarkup(assistantPendingPlan):'<div class="coach-answer"><span>I will show you the exact ledger change before anything is saved.</span></div>';
  return base.replace('<h2>Ask the Coach</h2><p class="help-copy">Try “How did I spend this week?” or “Where did my money go?”</p>','<h2>Tell the Coach what happened</h2><p class="help-copy">Describe a spending, saving, income, investment, or budget change in plain language.</p>').replace('<form class="coach-ask" id="coachAskForm"><input name="question" placeholder="Ask about your spending…" autocomplete="off"><button class="primary-button">Ask</button></form><div id="coachAnswer" class="coach-answer"><span>Ask a question to get a plain-language answer from your ledger.</span></div>','<form class="coach-ask" id="coachCommandForm"><input name="command" placeholder="I spent ₱180 on lunch from Maya…" autocomplete="off"><button class="primary-button">Review</button></form><div id="coachPlan" class="coach-plan-wrap">'+planMarkup+'</div>');
}
coachView=coachViewWithCommands;
assistantBind=function(){
  const form=document.getElementById('coachCommandForm');
  if(form)form.onsubmit=event=>{event.preventDefault();assistantPendingPlan=assistantParseCommand(new FormData(form).get('command'));document.getElementById('coachPlan').innerHTML=assistantPlanMarkup(assistantPendingPlan)};
  const mode=document.getElementById('coachGuardMode');
  if(mode)mode.onchange=()=>{assistantSettings.guard=mode.value;assistantSaveSettings();render();showToast('Coach updated',mode.value==='block'?'Overspending will be blocked before saving.':mode.value==='warn'?'You will see a warning before risky spending.':'The Coach will monitor without stopping entries.')}
};
const assistantBasePlanMarkup=assistantPlanMarkup;
assistantPlanMarkup=function(plan){return assistantBasePlanMarkup(plan).replace('assistantPendingPlan=null;document.getElementById(\'coachPlan\').innerHTML=\'\'','assistantClearPlan()')};
if(current==='Coach')render();

function openOverspendingFix(){
  const signals=assistantCurrentSignals(),over=signals.over[0];
  if(!over){showToast('Nothing to reroute','Your current month has no over-budget category.');return}
  const entries=signals.monthItems.filter(item=>item.type==='expense'&&(item.category===over.category||item.budgetCategory===over.category));
  const targets=state.budgets.filter(item=>item.category!==over.category);
  if(!entries.length){showToast('No matching entries','There is no expense entry to correct in this category.');return}
  if(!targets.length){openBudgetModal(state.budgets.findIndex(item=>item.category===over.category));return}
  const fields=selectField('Expense to reroute','transactionId',entries.map(item=>[item.id,`${dateFmt(item.date)} · ${item.description||item.category} · ${money(item.amount)}`]),entries[0].id,true)+selectField('Move it to budget','targetCategory',targets.map(item=>[item.category,`${item.category} · ${money(Math.max(0,Number(item.limit||0)-Number(budgetSpent(item)||0)))} left`]),targets[0].category,true)+'<div class="field full"><p class="help-copy">This changes the budget category only. The amount and bank account stay exactly the same.</p></div>';
  modalShell('Fix overspending','Reroute the accidental entry without deleting your history.',fields,'coachFixForm');
  const form=document.getElementById('coachFixForm');
  const actions=form.querySelector('.modal-actions');
  actions.insertAdjacentHTML('afterbegin','<button type="button" class="ghost-button" id="coachEditSelected">Edit entry</button><button type="button" class="ghost-button danger-button" id="coachDeleteSelected">Delete entry</button>');
  const selectedId=()=>String(form.elements.transactionId.value||'');
  document.getElementById('coachEditSelected').onclick=()=>{const id=selectedId();closeModal();openTransactionEdit(id)};
  document.getElementById('coachDeleteSelected').onclick=()=>{const id=selectedId();closeModal();deleteRecord('transaction',id)};
  form.onsubmit=event=>{event.preventDefault();const data=new FormData(form),entry=state.transactions.find(item=>item.id===data.get('transactionId'));if(!entry)return;const category=String(data.get('targetCategory')||'');entry.category=category;entry.budgetCategory=category;save();closeModal();render();showToast('Expense rerouted',`Moved ${money(entry.amount)} to ${category}.`)};
}
function assistantAlertMarkupWithFix(signals){
  const alerts=[];
  signals.over.forEach(item=>alerts.push(`<div class="coach-alert danger"><span>!</span><div><strong>${assistantText(item.category)} is over by ${money(item.used-item.limit)}</strong><small>Budget ${money(item.limit)} · spent ${money(item.used)}. New spending in this category is blocked while protection is on.</small><button type="button" class="coach-fix-button" onclick="openOverspendingFix()">Fix overspending →</button></div></div>`));
  signals.near.filter(item=>!signals.over.includes(item)).forEach(item=>alerts.push(`<div class="coach-alert watch"><span>!</span><div><strong>${assistantText(item.category)} is ${Math.round(item.pct)}% used</strong><small>${money(Math.max(0,item.remaining))} remains before the monthly limit.</small></div></div>`));
  if(signals.unbudgeted)alerts.push(`<div class="coach-alert calm"><span>i</span><div><strong>${money(signals.unbudgeted)} is unbudgeted</strong><small>Assign those expenses to a budget so the protection rules can understand them.</small></div></div>`);
  if(!alerts.length)alerts.push('<div class="coach-empty"><strong>No warnings right now.</strong><span>Your current budget and account activity look steady.</span></div>');
  return alerts.join('')
}
assistantAlertMarkup=assistantAlertMarkupWithFix;
if(current==='Coach')render();
