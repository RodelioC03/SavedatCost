function unifiedTransactionFields(){
  const accountOptions=state.accounts.length?state.accounts.map(item=>[item.id,item.name]):[['','No account available — add one first']];
  return field('Date','date',today(),'date')+
    `<div class="field"><label>Category</label><select id="transactionPrimaryCategory" name="primaryCategory"><option value="budget">Budget</option><option value="savings">Savings</option><option value="investment">Investment</option><option value="recurring">Recurring</option><option value="other">Others</option></select></div>`+
    '<div id="transactionSubcategoryWrap" class="field full"></div>'+ 
    '<div id="transactionActionWrap" class="field full"></div>'+ 
    field('Description','description','','text',true)+
    field('Amount · PHP','amount','','number')+
    `<div class="field full"><label>Money leaves account</label><select name="account" ${state.accounts.length?'':'disabled'}>${accountOptions.map(item=>`<option value="${item[0]}">${item[1]}</option>`).join('')}</select><small class="field-hint">Money out will be deducted from this selected bank account or e-wallet.</small></div>`+
    '<div class="field full"><p class="help-copy">Choose one category, then choose the budget, goal, investment, recurring item, or custom category it belongs to.</p></div>';
}

function syncTransactionAccountField(form){
  const field=form?.elements?.account?.closest('.field');
  if(!field)return;
  const label=field.querySelector('label');
  const hint=field.querySelector('.field-hint');
  const type=String(form.elements.type?.value||'expense');
  if(type==='income'){
    if(label)label.textContent='Money enters account';
    if(hint)hint.textContent='Income will be added to this selected bank account or e-wallet.';
  }else if(type==='transfer'){
    if(label)label.textContent='Account involved';
    if(hint)hint.textContent='This transfer will use the selected account as the source or destination.';
  }else{
    if(label)label.textContent='Money leaves account';
    if(hint)hint.textContent='Money out will be deducted from this selected bank account or e-wallet.';
  }
}

function renderUnifiedTransactionCategory(form){
  const category=String(form.elements.primaryCategory?.value||'budget');
  const subcategoryWrap=document.getElementById('transactionSubcategoryWrap');
  const actionWrap=document.getElementById('transactionActionWrap');
  if(!subcategoryWrap||!actionWrap)return;
  const accountSelect=form.elements.account;
  let subcategory='';
  if(category==='budget'){
    subcategoryWrap.innerHTML=state.budgets.length?selectField('Budget category','subcategory',state.budgets.map(item=>[item.category,item.category]),state.budgets[0]?.category,true):'<div class="notice">No budget categories yet. Add a category from the Budget section first.</div>';
    actionWrap.innerHTML='<input type="hidden" name="type" value="expense"><div class="notice">Add payment · this will count as monthly money out and reduce the selected account.</div>';
    subcategory=state.budgets[0]?.category||'';
  }else if(category==='savings'){
    subcategoryWrap.innerHTML=state.goals.length?selectField('Savings goal','subcategory',state.goals.map(item=>[item.id,item.name]),state.goals[0]?.id,true):'<div class="notice">No savings goals yet. Add a goal from the Savings section first.</div>';
    actionWrap.innerHTML='<input type="hidden" name="type" value="expense"><div class="notice">Add money · this increases the goal, counts as monthly money out, and deducts from the selected account.</div>';
    subcategory=state.goals[0]?.id||'';
  }else if(category==='investment'){
    subcategoryWrap.innerHTML=state.investments.length?selectField('Investment holding','subcategory',state.investments.map(item=>[item.id,item.name]),state.investments[0]?.id,true):'<div class="notice">No investment holdings yet. Add a holding from the Investments section first.</div>';
    actionWrap.innerHTML='<input type="hidden" name="type" value="expense"><div class="notice">Add money · this increases the holding contribution and deducts from the selected account.</div>';
    subcategory=state.investments[0]?.id||'';
  }else if(category==='recurring'){
    subcategoryWrap.innerHTML=state.recurring.length?selectField('Recurring item','subcategory',state.recurring.map(item=>[item.id,item.description]),state.recurring[0]?.id,true):'<div class="notice">No recurring items yet. Add one from the Recurring section first.</div>';
    const recurring=state.recurring[0];
    actionWrap.innerHTML=`<input type="hidden" name="type" value="${recurring?.type||'expense'}"><div class="notice">Add payment · this records the selected recurring item using its transaction type.</div>`;
    subcategory=recurring?.id||'';
    if(recurring?.account&&accountSelect)accountSelect.value=recurring.account;
  }else{
    subcategoryWrap.innerHTML=field('Other category','category','','text',true);
    actionWrap.innerHTML=selectField('Transaction type','type',[['expense','Money out'],['income','Money in'],['transfer','Move between accounts']],'expense',true);
  }
  const description=form.elements.description;
  const subcategorySelect=form.elements.subcategory;
  if(subcategorySelect){
    subcategorySelect.onchange=()=>{
      const selected=String(subcategorySelect.value||'');
      if(category==='recurring'){
        const recurring=state.recurring.find(item=>item.id===selected);
        if(recurring?.account&&accountSelect)accountSelect.value=recurring.account;
        if(recurring&&description&&!description.value)description.value=recurring.description;
        const typeInput=form.elements.type;
        if(typeInput&&recurring)typeInput.value=recurring.type||'expense';
      }else if(category==='savings'){
        const goal=state.goals.find(item=>item.id===selected);
        if(goal&&description&&!description.value)description.value=`Savings contribution · ${goal.name}`;
      }else if(category==='investment'){
        const holding=state.investments.find(item=>item.id===selected);
        if(holding&&description&&!description.value)description.value=`Investment contribution · ${holding.name}`;
      }
    };
    subcategorySelect.dispatchEvent(new Event('change'));
  }
  syncTransactionAccountField(form);
  return subcategory;
}

function openModal(){
  modalShell('Add transaction','Choose a category, then choose what this transaction updates.',unifiedTransactionFields());
  const form=document.getElementById('entityForm');
  const primary=form.elements.primaryCategory;
  const submit=form.querySelector('button.primary-button');
  if(submit)submit.textContent='Save transaction';
  const refresh=()=>renderUnifiedTransactionCategory(form);
  primary.onchange=refresh;
  refresh();
  form.addEventListener('change',e=>{
    if(e.target?.name==='type')syncTransactionAccountField(form);
  });
  form.onsubmit=e=>{
    e.preventDefault();
    const formData=new FormData(e.target);
    const primaryCategory=String(formData.get('primaryCategory')||'');
    const subcategory=String(formData.get('subcategory')||'');
    const accountId=String(formData.get('account')||'');
    const amount=Number(formData.get('amount'));
    if(!state.accounts.some(item=>item.id===accountId)){alert('Choose the bank account or e-wallet to use for this transaction.');return}
    if(!Number.isFinite(amount)||amount<=0){alert('Enter an amount greater than zero.');return}
    if(primaryCategory!=='other'&&!subcategory){alert('Choose the specific item this transaction belongs to.');return}
    const description=String(formData.get('description')||'').trim();
    const date=String(formData.get('date')||today());
    let transaction={id:'t'+Date.now(),date,description,account:accountId,type:String(formData.get('type')||'expense'),direction:String(formData.get('type')||'')==='transfer'?'out':undefined,amount};
    if(primaryCategory==='budget'){
      transaction={...transaction,type:'expense',category:subcategory,budgetCategory:subcategory,description:description||`${subcategory} payment`};
    }else if(primaryCategory==='savings'){
      const goal=state.goals.find(item=>item.id===subcategory);
      if(!goal){alert('Choose a valid savings goal.');return}
      goal.current=Number(goal.current||0)+amount;
      transaction={...transaction,type:'expense',category:'Savings',goalId:goal.id,description:description||`Savings contribution · ${goal.name}`};
    }else if(primaryCategory==='investment'){
      const holding=state.investments.find(item=>item.id===subcategory);
      if(!holding){alert('Choose a valid investment holding.');return}
      const price=Number(holding.price||0);
      holding.cost=Number(holding.cost||0)+amount;
      if(price>0)holding.units=Number(holding.units||0)+amount/price;
      transaction={...transaction,type:'expense',category:'Investment',investmentId:holding.id,description:description||`Investment contribution · ${holding.name}`};
    }else if(primaryCategory==='recurring'){
      const recurring=state.recurring.find(item=>item.id===subcategory);
      if(!recurring){alert('Choose a valid recurring item.');return}
      transaction={...transaction,type:recurring.type||'expense',category:recurring.category||'Recurring',recurringId:recurring.id,description:description||recurring.description,direction:recurring.type==='transfer'?'out':undefined};
    }else{
      const otherCategory=String(formData.get('category')||'').trim();
      if(!otherCategory||!description){alert('Enter a description and other category.');return}
      transaction={...transaction,category:otherCategory};
    }
    state.transactions.push(transaction);
    save();
    closeModal();
    current='Transactions';
    render();
    showToast('Transaction saved','The selected account and related section were updated.');
  };
}

// app.js wires the top-bar button before this enhancement file loads, so rebind it
// here to ensure Quick add opens the same unified transaction workflow.
const unifiedQuickAddButton=document.getElementById('quickAdd');
if(unifiedQuickAddButton)unifiedQuickAddButton.onclick=openModal;
