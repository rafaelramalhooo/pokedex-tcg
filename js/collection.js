/* Coleção do usuário e contagem por expansão. */
import {FIN} from './constants.js';
import {DB} from './db.js';
import {S, refreshAll} from './state.js';
import {toast} from './ui.js';

export const ownedQty=id=>{const e=S.collection[id];if(!e)return 0;let q=0;for(const f in e.f)q+=e.f[f].q;return q;};
export const isOwned=id=>ownedQty(id)>0;
export function groupBySet(){
 const m={};
 for(const id in S.collection){const e=S.collection[id];if(!e.s)continue;(m[e.s]||(m[e.s]=[])).push(id);}
 return m;
}
export const setIdOf=id=>(S.briefs[id]&&S.briefs[id].setId)||(S.cards[id]&&S.cards[id].set)||id.slice(0,id.lastIndexOf('-'));
export function persistEntry(id){
 const e=S.collection[id];
 if(!e||(!Object.keys(e.f).length&&!e.n)){delete S.collection[id];DB.del('coll',id);}
 else DB.put('coll',id,e);
}
export function setFin(id,fin,patch){
 let e=S.collection[id];
 if(!e)e=S.collection[id]={s:setIdOf(id),f:{},n:''};
 const cur=e.f[fin]||{q:0,c:'NM',l:'pt'};
 const nxt={...cur,...patch};
 if(nxt.q<=0)delete e.f[fin];else e.f[fin]=nxt;
 persistEntry(id);refreshAll();
}
export function defaultFin(id){
 const c=S.cards[id];
 if(c&&c.variants){for(const f of FIN)if(c.variants[f])return f;}
 return 'normal';
}
export function toggleOwn(id,fin){
 const prev=S.collection[id]?JSON.parse(JSON.stringify(S.collection[id])):null;
 const e=S.collection[id];
 if(fin){
  if(e&&e.f[fin]&&e.f[fin].q>0)setFin(id,fin,{q:0});else setFin(id,fin,{q:1});
 }else if(isOwned(id)){
  e.f={};persistEntry(id);refreshAll();
 }else setFin(id,defaultFin(id),{q:1});
 const name=(S.briefs[id]&&S.briefs[id].name)||id;
 toast(isOwned(id)||(fin&&S.collection[id]&&S.collection[id].f[fin])?`${name} marcada como tenho`:`${name} removida da coleção`,'Desfazer',()=>{
  if(prev)S.collection[id]=prev;else delete S.collection[id];
  persistEntry(id);if(!prev)DB.del('coll',id);refreshAll();
 });
}
export function saveNote(id,text){
 let e=S.collection[id];
 if(!e){if(!text.trim())return;e=S.collection[id]={s:setIdOf(id),f:{},n:''};}
 e.n=text;persistEntry(id);
}

/* contagem por expansão */
export const isOfficialNo=(lid,official)=>/^\d+$/.test(lid)?parseInt(lid,10)<=official:true;
export function setStat(set,bySet){
 const d=S.setd[set.id];
 const cc=(d&&d.cardCount)||set.cardCount||{};
 const official=cc.official||cc.total||0;
 let own=0,ownM=0;
 for(const id of (bySet[set.id]||[])){
  const e=S.collection[id];const fins=Object.keys(e.f);
  if(!fins.length)continue;
  if(isOfficialNo(id.slice(set.id.length+1),official))own++;
  for(const f of fins){if(f==='reverse'&&!S.settings.masterReverse)continue;ownM++;}
 }
 let masterTot=null;
 if(d&&d.cardCount){
  const c=d.cardCount;
  let sum=(c.normal||0)+(c.holo||0)+(S.settings.masterReverse?(c.reverse||0):0);
  if(!sum)sum=c.total||official;
  masterTot=sum;
 }
 return{own,tot:official,ownM,masterTot,total:cc.total||official};
}
