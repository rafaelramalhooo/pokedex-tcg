/* Armazenamento local (IndexedDB). Ponto único de persistência: será trocado/complementado pelo Supabase. */
import {S} from './state.js';

/* O sincronizador (cloud.js) se registra aqui para saber quando algo mudou. */
export const hooks={change:null};
const WATCH=(s,k)=>s==='coll'||(s==='kv'&&(k==='binders'||k==='settings'||k==='custom'));
const ping=(s,k)=>{if(!WATCH(s,k))return;try{if(hooks.change)hooks.change();}catch(e){}};

export const DB=(()=>{
 let db=null;
 const open=()=>new Promise((res,rej)=>{
  if(!window.indexedDB)return rej(new Error('sem IndexedDB'));
  const r=indexedDB.open('pokedex-tcg',1);
  r.onupgradeneeded=()=>{['kv','setd','cards','coll'].forEach(n=>r.result.createObjectStore(n));};
  r.onsuccess=()=>{db=r.result;res();};
  r.onerror=()=>rej(r.error);
 });
 const st=(s,m='readonly')=>db.transaction(s,m).objectStore(s);
 const w=r=>new Promise((res,rej)=>{r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});
 return{
  open,
  get:async(s,k)=>db?w(st(s).get(k)):undefined,
  put:async(s,k,v)=>{if(db)try{await w(st(s,'readwrite').put(v,k));}catch(e){}ping(s,k);},
  del:async(s,k)=>{if(db)try{await w(st(s,'readwrite').delete(k));}catch(e){}ping(s,k);},
  clear:async s=>{if(db)try{await w(st(s,'readwrite').clear());}catch(e){}ping(s,null);},
  all:s=>new Promise(res=>{
   if(!db)return res({});
   const out={};const r=st(s).openCursor();
   r.onsuccess=()=>{const c=r.result;if(c){out[c.key]=c.value;c.continue();}else res(out);};
   r.onerror=()=>res(out);
  })
 };
})();
export const saveKV=(k,v)=>DB.put('kv',k,v);
export const saveSettings=()=>saveKV('settings',S.settings);
export const saveBinders=()=>saveKV('binders',S.binders);
