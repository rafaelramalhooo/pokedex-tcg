/* Login e sincronização com o Supabase.
   Modelo: o banco do aparelho (IndexedDB) continua sendo a fonte da tela; a nuvem é uma cópia por usuário.
   O sincronizador compara o estado atual com um "retrato" da última sincronização (snap) e envia só o que mudou.
   Ao baixar, linhas que você alterou e ainda não foram enviadas valem mais que as da nuvem; o resto vem da nuvem. */
import {SUPABASE} from './config.js';
import {DB, hooks, saveBinders, saveKV, saveSettings} from './db.js';
import {S, refreshAll, viewCache} from './state.js';

export const enabled=!!(SUPABASE.url&&SUPABASE.key);
const LIB='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

let sb=null,user=null,meta={uid:null,snap:{}},pushT=null,busy=false,again=false,poll=null,booted=false;
const listeners=new Set();
export const onCloud=f=>{listeners.add(f);return()=>listeners.delete(f);};
function emit(){listeners.forEach(f=>{try{f(S.cloud);}catch(e){}});}
function setState(state,msg=''){S.cloud.state=state;S.cloud.msg=msg;emit();}

/* ---------- representação canônica (jsonb não guarda a ordem das chaves) ---------- */
export function canon(v){
 if(Array.isArray(v))return'['+v.map(canon).join(',')+']';
 if(v&&typeof v==='object')return'{'+Object.keys(v).sort().filter(k=>v[k]!==undefined).map(k=>JSON.stringify(k)+':'+canon(v[k])).join(',')+'}';
 return JSON.stringify(v===undefined?null:v);
}
const clone=v=>JSON.parse(JSON.stringify(v));

/* ---------- tabelas ---------- */
const TABLES={
 collection:{
  cols:'card_id,set_id,finishes,notes',ord:['card_id'],
  local(){const m=new Map();for(const id in S.collection){const e=S.collection[id];m.set(id,{card_id:id,set_id:e.s||'',finishes:e.f||{},notes:e.n||''});}return m;},
  key:r=>r.card_id,
  del:keys=>({col:'card_id',keys}),
  apply(changes,removed){
   changes.forEach(r=>{const e={s:r.set_id,f:clone(r.finishes||{}),n:r.notes||''};S.collection[r.card_id]=e;DB.put('coll',r.card_id,e);});
   removed.forEach(k=>{delete S.collection[k];DB.del('coll',k);});
  }
 },
 binders:{
  cols:'id,data',ord:['id'],
  local(){const m=new Map();S.binders.forEach(b=>m.set(b.id,{id:b.id,data:b}));return m;},
  key:r=>r.id,
  del:keys=>({col:'id',keys}),
  apply(changes,removed){
   const by=new Map(S.binders.map(b=>[b.id,b]));
   changes.forEach(r=>by.set(r.id,clone(r.data)));
   removed.forEach(k=>by.delete(k));
   const order=[];S.binders.forEach(b=>{if(by.has(b.id)){order.push(by.get(b.id));by.delete(b.id);}});
   by.forEach(b=>order.push(b));
   S.binders=order;saveBinders();
  }
 },
 user_settings:{
  cols:'data',ord:[],
  local(){return new Map([['me',{data:S.settings}]]);},
  key:()=>'me',
  del:()=>null,
  apply(changes){
   if(!changes.length)return;
   const remote=clone(changes[0].data||{});
   const mine=Array.isArray(S.settings.mySets)?S.settings.mySets:[];
   Object.assign(S.settings,remote);
   if(meta.first&&Array.isArray(remote.mySets))S.settings.mySets=[...new Set([...remote.mySets,...mine])];
   saveSettings();
  }
 },
 custom_images:{
  cols:'kind,id,data',ord:['kind','id'],
  local(){const m=new Map();['logos','cards','covers'].forEach(k=>{const o=(S.custom&&S.custom[k])||{};for(const id in o)m.set(k+'/'+id,{kind:k,id,data:o[id]});});return m;},
  key:r=>r.kind+'/'+r.id,
  del:keys=>({col:'kind',keys}),
  apply(changes,removed){
   S.custom=Object.assign({logos:{},cards:{},covers:{}},S.custom);
   changes.forEach(r=>{(S.custom[r.kind]=S.custom[r.kind]||{})[r.id]=r.data;});
   removed.forEach(k=>{const[kind,...rest]=k.split('/');if(S.custom[kind])delete S.custom[kind][rest.join('/')];});
   saveKV('custom',S.custom);
  }
 }
};
const NAMES=Object.keys(TABLES);
const rowStr=r=>canon(r);

async function fetchAll(table){
 const out=[];const step=500;
 for(let from=0;;from+=step){
  let q=sb.from(table).select(TABLES[table].cols);
  TABLES[table].ord.forEach(c=>{q=q.order(c,{ascending:true});});
  const {data,error}=await q.range(from,from+step-1);
  if(error)throw error;
  out.push(...(data||[]));
  if(!data||data.length<step)break;
 }
 return out;
}

/* ---------- baixar ---------- */
async function pull(){
 let changed=false;
 for(const name of NAMES){
  const T=TABLES[name];
  const remote=new Map((await fetchAll(name)).map(r=>[T.key(r),r]));
  const cur=T.local();
  const snap=meta.snap[name]||(meta.snap[name]={});
  const dirty=k=>{const c=cur.has(k)?rowStr(cur.get(k)):undefined;return c!==snap[k];};
  const changes=[],removed=[];
  for(const [k,r] of remote){
   const rs=rowStr(r);
   if(name==='user_settings'&&meta.first){
    /* aparelho novo: ajustes da nuvem valem, para não trocar tudo pelo padrão */
    changes.push(r);snap[k]=rs;changed=true;continue;
   }
   if(dirty(k))continue;
   const c=cur.has(k)?rowStr(cur.get(k)):undefined;
   if(c!==rs){changes.push(r);changed=true;}
   snap[k]=rs;
  }
  for(const k of Object.keys(snap)){
   if(remote.has(k))continue;
   if(!dirty(k)){if(cur.has(k)){removed.push(k);changed=true;}delete snap[k];}
  }
  if(changes.length||removed.length)T.apply(changes,removed);
 }
 return changed;
}

/* ---------- enviar ---------- */
async function push(){
 for(const name of NAMES){
  const T=TABLES[name];
  const cur=T.local();const snap=meta.snap[name]||(meta.snap[name]={});
  const ups=[];
  for(const [k,r] of cur){const s=rowStr(r);if(snap[k]!==s)ups.push([k,r,s]);}
  const dels=T.del?Object.keys(snap).filter(k=>!cur.has(k)):[];
  for(let i=0;i<ups.length;i+=200){
   const part=ups.slice(i,i+200);
   const {error}=await sb.from(name).upsert(part.map(x=>x[1]),{onConflict:name==='collection'?'user_id,card_id':name==='binders'?'user_id,id':name==='user_settings'?'user_id':'user_id,kind,id'});
   if(error)throw error;
   part.forEach(([k,,s])=>{snap[k]=s;});
  }
  const d=T.del&&T.del(dels);
  if(d&&dels.length){
   for(let i=0;i<dels.length;i+=100){
    const part=dels.slice(i,i+100);
    if(name==='custom_images'){
     for(const k of part){const[kind,...rest]=k.split('/');const {error}=await sb.from(name).delete().eq('kind',kind).eq('id',rest.join('/'));if(error)throw error;}
    }else{
     const {error}=await sb.from(name).delete().in(d.col,part);
     if(error)throw error;
    }
    part.forEach(k=>delete snap[k]);
   }
  }else if(dels.length&&!d){dels.forEach(k=>delete snap[k]);}
 }
}

async function saveMeta(){await saveKV('cloud',meta);}

/* ---------- ciclo de sincronização ---------- */
export async function syncNow(){
 if(!sb||!user||!booted)return;
 if(busy){again=true;return;}
 busy=true;
 try{
  setState('syncing');
  const changed=await pull();
  await push();
  meta.first=false;
  S.cloud.last=Date.now();
  await saveMeta();
  setState('idle');
  if(changed){viewCache.clear();refreshAll();}
 }catch(e){
  const off=!navigator.onLine||/fetch|network|Failed/i.test(String(e&&e.message));
  S.cloud.error=String(e&&e.message||e);
  setState(off?'offline':'error',S.cloud.error);
  clearTimeout(pushT);pushT=setTimeout(syncNow,20000);
 }finally{
  busy=false;
  if(again){again=false;schedule(500);}
 }
}
function schedule(ms=2000){
 if(!sb||!user||!booted)return;
 clearTimeout(pushT);pushT=setTimeout(syncNow,ms);
}

function startLoops(){
 hooks.change=()=>schedule(2000);
 addEventListener('online',()=>syncNow());
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')syncNow();});
 poll=setInterval(()=>{if(document.visibilityState==='visible')syncNow();},90000);
}

/* ---------- sessão ---------- */
export async function initCloud(){
 if(!enabled){S.cloud.enabled=false;return'off';}
 S.cloud.enabled=true;
 if(/type=recovery/.test(location.hash+location.search))S.cloud.recovery=true;
 try{
  const lib=await import(/* @vite-ignore */ LIB);
  sb=lib.createClient(SUPABASE.url,SUPABASE.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
 }catch(e){
  S.cloud.error='Não consegui carregar a biblioteca de login.';
  setState('offline',S.cloud.error);
  return'offline';
 }
 sb.auth.onAuthStateChange((ev)=>{if(ev==='PASSWORD_RECOVERY'){S.cloud.recovery=true;emit();}});
 meta=(await DB.get('kv','cloud'))||{uid:null,snap:{}};
 const {data}=await sb.auth.getSession();
 if(data&&data.session){user=data.session.user;S.cloud.email=user.email||'';return'in';}
 return'out';
}
export const hasLocalData=()=>Object.keys(S.collection).length>0||S.binders.length>0;

/* Chamado depois de entrar (ou ao abrir o app já com sessão). Faz a primeira junção, se for o caso. */
export async function startSession(session){
 if(session){user=session.user;S.cloud.email=user.email||'';}
 meta=(await DB.get('kv','cloud'))||{uid:null,snap:{}};
 let backupDone=false;
 if(meta.uid&&meta.uid!==user.id){
  /* outra conta neste aparelho: não misturar dados */
  await wipeLocal();meta={uid:null,snap:{}};
 }
 if(meta.uid!==user.id){
  meta={uid:user.id,snap:{},first:true};
  S.cloud.firstLink=true;
 }
 booted=true;
 await syncNow();
 if(!poll)startLoops();
 return {backupDone};
}

export async function signIn(email,password){
 if(!sb)throw new Error('fetch failed');
 const {data,error}=await sb.auth.signInWithPassword({email,password});
 if(error)throw error;
 return data.session;
}
export async function signUp(email,password){
 if(!sb)throw new Error('fetch failed');
 const {data,error}=await sb.auth.signUp({email,password,options:{emailRedirectTo:location.origin+location.pathname}});
 if(error)throw error;
 return data.session||null;
}
export async function resetPassword(email){
 if(!sb)throw new Error('fetch failed');
 const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});
 if(error)throw error;
}
export async function setNewPassword(password){
 const {error}=await sb.auth.updateUser({password});
 if(error)throw error;
 S.cloud.recovery=false;emit();
}

export async function wipeLocal(){
 await DB.clear('coll');S.collection={};
 S.binders=[];await saveBinders();
 S.custom={logos:{},cards:{},covers:{}};await saveKV('custom',S.custom);
 S.settings.mySets=null;S.settings.legalMarks=['H','I','J'];
 await saveSettings();
 await DB.del('kv','cloud');
}
export function pendingCount(){
 let n=0;
 for(const name of NAMES){const T=TABLES[name];const snap=meta.snap[name]||{};const cur=T.local();
  for(const [k,r] of cur)if(snap[k]!==rowStr(r))n++;
  if(T.del)for(const k of Object.keys(snap))if(!cur.has(k))n++;}
 return n;
}
/* Sair: confirma o envio do que falta e apaga os dados deste aparelho (eles continuam na nuvem). */
export async function signOut(){
 clearTimeout(pushT);
 try{await syncNow();}catch(e){}
 if(pendingCount()>0)return{ok:false,pending:pendingCount()};
 return doSignOut();
}
export async function doSignOut(){
 hooks.change=null;
 try{await sb.auth.signOut();}catch(e){}
 await wipeLocal();
 user=null;booted=false;
 return{ok:true};
}
export const isSignedIn=()=>!!user;
