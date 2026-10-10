function save(){
  const previous=localStorage.getItem(KEY);
  if(previous)localStorage.setItem(KEY+'-backup',previous);
  localStorage.setItem(KEY,JSON.stringify(state));
  const label=document.getElementById('backupLabel');
  if(label)label.textContent='Saving locally…';
  const persist=location.protocol!=='file:'
    ? fetch('/api/state',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(state)})
    : Promise.resolve({ok:true});
  return persist.then(response=>{
    if(!response.ok)throw new Error('database save failed');
    if(label)label.textContent='Database saved';
    showToast('Saved','Your changes are stored in the local database.');
    return typeof createServerBackup==='function'?createServerBackup():null;
  }).catch(()=>{
    if(label)label.textContent='Saved locally';
    showToast('Saved locally','Your changes are stored on this device.');
    return typeof createServerBackup==='function'?createServerBackup():null;
  });
}
