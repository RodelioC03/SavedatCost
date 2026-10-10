const http = require('http');
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const root = __dirname;
const port = Number(process.env.PORT || 5173);
const backupDir = path.join(root,'backups');
const dataDir = path.join(root,'data');
fs.mkdirSync(dataDir,{recursive:true});
const database = new DatabaseSync(path.join(dataDir,'savedatcost.sqlite'));
database.exec('CREATE TABLE IF NOT EXISTS app_state (id INTEGER PRIMARY KEY CHECK (id = 1), saved_at TEXT NOT NULL, state_json TEXT NOT NULL)');
const clients = new Set();
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.md':'text/plain; charset=utf-8'};
const watched = new Set(['index.html','app.js','styles.css']);

function sendReload(){for(const res of clients){res.write('data: reload\n\n')}}
function safeFile(urlPath){const clean=decodeURIComponent(urlPath.split('?')[0]);const requested=clean==='/'?'/index.html':clean;const absolute=path.resolve(root,'.'+requested);return absolute.startsWith(root+path.sep)?absolute:null}
function backupName(){const d=new Date();const stamp=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0'),'-',String(d.getHours()).padStart(2,'0'),String(d.getMinutes()).padStart(2,'0'),String(d.getSeconds()).padStart(2,'0')].join('');return`savedatcost-${stamp}.json`}
function createBackup(req,res){let body='';req.on('data',chunk=>{body+=chunk;if(body.length>6*1024*1024)req.destroy()});req.on('end',()=>{let data;try{data=JSON.parse(body);if(!data||!Array.isArray(data.accounts)||!Array.isArray(data.transactions))throw new Error('invalid')}catch{res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:false,error:'Invalid SavedatCost data'}));return}fs.mkdir(backupDir,{recursive:true},error=>{if(error){res.writeHead(500);res.end(JSON.stringify({ok:false,error:'Could not create backup folder'}));return}const file=path.join(backupDir,backupName());fs.writeFile(file,JSON.stringify({savedAt:new Date().toISOString(),data},null,2),'utf8',writeError=>{if(writeError){res.writeHead(500);res.end(JSON.stringify({ok:false,error:'Could not write backup'}));return}fs.readdir(backupDir,(readError,names)=>{const files=readError?[]:names.filter(name=>name.startsWith('savedatcost-')&&name.endsWith('.json')).sort().reverse();for(const old of files.slice(20))fs.unlink(path.join(backupDir,old),()=>{});res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:true,file:path.basename(file),kept:Math.min(files.length,20)}))})})})})}
function validState(data){return data&&Array.isArray(data.accounts)&&Array.isArray(data.transactions)&&Array.isArray(data.budgets)&&Array.isArray(data.goals)&&Array.isArray(data.investments)}
function saveDatabaseState(data){const statement=database.prepare('INSERT INTO app_state (id,saved_at,state_json) VALUES (1,?,?) ON CONFLICT(id) DO UPDATE SET saved_at=excluded.saved_at,state_json=excluded.state_json');statement.run(new Date().toISOString(),JSON.stringify(data))}
function readDatabaseState(){const row=database.prepare('SELECT saved_at,state_json FROM app_state WHERE id=1').get();return row?{savedAt:row.saved_at,state:JSON.parse(row.state_json)}:null}
function readRequestBody(req,done){let body='';req.on('data',chunk=>{body+=chunk;if(body.length>8*1024*1024)req.destroy()});req.on('end',()=>{try{done(null,JSON.parse(body))}catch{done(new Error('invalid'))}})}

const server=http.createServer((req,res)=>{
  if(req.url==='/api/state'&&req.method==='GET'){const payload=readDatabaseState();res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(payload||{state:null}));return}
  if(req.url==='/api/state'&&req.method==='POST'){readRequestBody(req,(error,data)=>{if(error||!validState(data)){res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:false,error:'Invalid SavedatCost state'}));return}try{saveDatabaseState(data);res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:true,savedAt:new Date().toISOString()}))}catch{res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:false,error:'Could not save the SQLite database'}))}});return}
  if(req.url==='/api/backup'&&req.method==='POST'){createBackup(req,res);return}
  if(req.url==='/__live.js'){res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-store'});res.end("const live=new EventSource('/__events');live.onmessage=event=>{if(event.data==='reload')location.reload()};");return}
  if(req.url==='/__events'){res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive','Access-Control-Allow-Origin':'*'});res.write(': connected\n\n');clients.add(res);req.on('close',()=>clients.delete(res));return}
  const file=safeFile(req.url||'/');if(!file){res.writeHead(403);res.end('Forbidden');return}
  fs.readFile(file,(error,data)=>{if(error){res.writeHead(error.code==='ENOENT'?404:500);res.end(error.code==='ENOENT'?'Not found':'Server error');return}res.writeHead(200,{'Content-Type':mime[path.extname(file).toLowerCase()]||'application/octet-stream','Cache-Control':'no-store'});res.end(data)})
});

fs.watch(root,{persistent:true},(_event,filename)=>{if(filename&&watched.has(filename.toString()))setTimeout(sendReload,120)});
server.listen(port,()=>console.log(`SavedatCost is running at http://localhost:${port}`));
process.on('SIGINT',()=>{for(const res of clients)res.end();database.close();server.close(()=>process.exit(0))});
