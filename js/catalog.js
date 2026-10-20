/* Catálogo: expansões, cartas, sincronização. */
import {getFB, getOrNull, pool} from './api.js';
import {groupBySet} from './collection.js';
import {DB, saveKV} from './db.js';
import {C, S, soft, softNow, viewCache} from './state.js';

export function indexSets(){
 S.setMap={};S.setIdx={};
 S.sets.forEach((s,i)=>{S.setMap[s.id]=s;S.setIdx[s.id]=i;});
}
export function indexSetd(d){
 (d.cards||[]).forEach(c=>{S.briefs[c.id]={id:c.id,localId:String(c.localId),name:c.name,image:c.image,setId:d.id};});
}
export const isPocket=id=>{const s=S.serieOf[id];return !!s&&(s.id==='tcgp'||/pocket/i.test(s.name||''));};
export const visibleSet=id=>S.settings.showPocket||!isPocket(id);
export const visibleSets=()=>S.sets.filter(s=>visibleSet(s.id));
export const mySetIds=()=>new Set(S.settings.mySets||[]);
export function mySets(){const ids=mySetIds();return visibleSets().filter(s=>ids.has(s.id));}

export async function fetchCatalog(){
 S.status.catalog='loading';S.status.err='';softNow();
 try{
  const [pt,en]=await Promise.all([getOrNull('/sets','pt'),getOrNull('/sets','en')]);
  if(!pt&&!en)throw new Error('A TCGdex não devolveu a lista de expansões.');
  const ptMap=new Map((pt||[]).map(s=>[s.id,s]));
  const out=[];const seen=new Set();
  (en||pt).forEach(s=>{const p=ptMap.get(s.id);out.push(p?{...p,lang:'pt',logoEn:s.logo}:{...s,lang:'en'});seen.add(s.id);});
  (pt||[]).forEach(s=>{if(!seen.has(s.id))out.push({...s,lang:'pt'});});
  const series=(await getOrNull('/series','pt'))||(await getOrNull('/series','en'))||[];
  const serieOf={};
  await pool(series,4,async s=>{
   const p=`/series/${encodeURIComponent(s.id)}`;
   const d=(await getOrNull(p,'pt'))||(await getOrNull(p,'en'));
   if(d)(d.sets||[]).forEach(x=>{serieOf[x.id]={id:d.id,name:d.name};});
  });
  S.sets=out;S.serieOf=serieOf;S.catalogAt=Date.now();indexSets();
  await saveKV('sets',out);await saveKV('serieOf',serieOf);await saveKV('catalogAt',S.catalogAt);
  S.status.catalog='ok';
 }catch(e){
  S.status.catalog='error';S.status.err=e&&e.message?e.message:'falha de rede';
 }
 softNow();
 if(S.status.catalog==='ok')preloadSetd();
}
/* A TCGdex às vezes devolve a expansão em português com a lista de cartas incompleta (tradução pela metade).
   Nesse caso completamos com a lista em inglês, mantendo o nome em português onde existir. */
async function fetchSetFull(id){
 const path=`/sets/${encodeURIComponent(id)}`;
 const d=await getFB(path);
 const cc=d.cardCount||{};
 const want=Math.max(cc.total||0,cc.official||0);
 if(d.__lang!=='en'&&(d.cards||[]).length<want){
  const en=await getOrNull(path,'en');
  if(en&&(en.cards||[]).length>(d.cards||[]).length){
   const pt=new Map((d.cards||[]).map(c=>[c.id,c]));
   d.cards=en.cards.map(c=>pt.get(c.id)||c);
   const ec=en.cardCount||{};
   d.cardCount={...cc,total:Math.max(cc.total||0,ec.total||0),official:cc.official||ec.official||0};
   d.completedFromEn=true;
  }
 }
 d.fullChecked=2;
 return d;
}
export async function ensureSetd(id,force){
 const old=S.setd[id];
 if(old&&old.fullChecked===2&&!force)return old;
 let d;
 try{d=await fetchSetFull(id);}
 catch(e){if(old)return old;throw e;}
 S.setd[id]=d;indexSetd(d);viewCache.clear();C.opt=null;
 await DB.put('setd',id,d);
 return d;
}
export async function preloadSetd(force){
 if(S.status.pre)return;
 const todo=mySets().filter(s=>force||!S.setd[s.id]||S.setd[s.id].fullChecked!==2);
 if(!todo.length){loadSelectedCards();return;}
 S.status.pre={done:0,total:todo.length};S.status.preErr=0;softNow();
 await pool(todo,6,async s=>{
  try{await ensureSetd(s.id,force);}catch(e){S.status.preErr++;}
  S.status.pre.done++;soft();
 });
 S.status.pre=null;softNow();
 loadSelectedCards();
}
/* Baixa os detalhes de todas as cartas das expansões escolhidas (Master Set e regras dependem deles). */
export async function loadSelectedCards(){
 if(S.status.cl)return;
 const ids=[];
 mySets().forEach(s=>{const d=S.setd[s.id];if(d)(d.cards||[]).forEach(c=>{if(!S.cards[c.id])ids.push(c.id);});});
 if(!ids.length)return;
 S.status.cl={done:0,total:ids.length,fail:0};softNow();
 await pool(ids,8,async id=>{
  try{await ensureCard(id);}catch(e){S.status.cl.fail++;}
  S.status.cl.done++;if(S.status.cl.done%10===0)soft();
 });
 S.status.cl=null;viewCache.clear();softNow();
}
export const trimCard=c=>({
 id:c.id,localId:String(c.localId),name:c.name,image:c.image,category:c.category,illustrator:c.illustrator,rarity:c.rarity,
 set:c.set&&c.set.id,
 variants:c.variants?{normal:!!c.variants.normal,holo:!!c.variants.holo,reverse:!!c.variants.reverse,firstEdition:!!c.variants.firstEdition}:null,
 dexId:c.dexId,hp:c.hp,types:c.types,stage:c.stage,suffix:c.suffix,trainerType:c.trainerType,energyType:c.energyType,
 evolveFrom:c.evolveFrom,regulationMark:c.regulationMark,legal:c.legal,lang:c.__lang||'pt'
});
export const inflight=new Map();
export function ensureCard(id){
 if(S.cards[id])return Promise.resolve(S.cards[id]);
 if(inflight.has(id))return inflight.get(id);
 const p=(async()=>{
  const raw=await getFB(`/cards/${encodeURIComponent(id)}`);
  const c=trimCard(raw);
  S.cards[id]=c;viewCache.delete(id);C.opt=null;
  await DB.put('cards',id,c);
  return c;
 })().finally(()=>inflight.delete(id));
 inflight.set(id,p);
 return p;
}
export async function ensureSetCards(setId){
 const d=S.setd[setId];if(!d)return;
 const todo=(d.cards||[]).map(c=>c.id).filter(id=>!S.cards[id]);
 if(!todo.length)return;
 if(S.setLoad[setId])return;
 S.setLoad[setId]={done:0,total:todo.length};soft();
 await pool(todo,8,async id=>{
  try{await ensureCard(id);}catch(e){}
  S.setLoad[setId].done++;soft();
 });
 delete S.setLoad[setId];viewCache.clear();softNow();
}
export function syncTargets(){
 const bySet=groupBySet();
 const sets=mySets().slice().reverse().sort((a,b)=>(bySet[b.id]?1:0)-(bySet[a.id]?1:0));
 const ids=[];
 sets.forEach(s=>{const d=S.setd[s.id];if(d)(d.cards||[]).forEach(c=>{if(!S.cards[c.id])ids.push(c.id);});});
 return ids;
}
export async function runSync(){
 if(S.sync.running)return;
 const todo=syncTargets();
 S.sync={running:true,stop:false,done:0,total:todo.length,fail:0};softNow();
 await pool(todo,6,async id=>{
  try{await ensureCard(id);}catch(e){S.sync.fail++;}
  S.sync.done++;if(S.sync.done%8===0)soft();
 },()=>S.sync.stop);
 S.sync.running=false;viewCache.clear();softNow();
}
export function catalogCoverage(){
 let total=0,have=0;
 mySets().forEach(s=>{const d=S.setd[s.id];if(d)(d.cards||[]).forEach(c=>{total++;if(S.cards[c.id])have++;});});
 const setsLoaded=mySets().filter(s=>S.setd[s.id]).length;
 return{total,have,setsLoaded,sets:mySets().length};
}

/* Carrega a lista de cartas de todas as expansões (leve: um pedido por expansão), para achar um Pokémon em qualquer uma. */
export async function loadAllSetLists(){
 if(S.status.all)return;
 const todo=visibleSets().filter(s=>!S.setd[s.id]);
 if(!todo.length)return;
 S.status.all={done:0,total:todo.length,fail:0};softNow();
 await pool(todo,6,async s=>{
  try{await ensureSetd(s.id);}catch(e){S.status.all.fail++;}
  S.status.all.done++;soft();
 });
 S.status.all=null;viewCache.clear();softNow();
}
export async function loadIds(ids,key='ids'){
 if(S.status[key]||!ids.length)return;
 S.status[key]={done:0,total:ids.length,fail:0};softNow();
 await pool(ids,8,async id=>{
  try{await ensureCard(id);}catch(e){S.status[key].fail++;}
  S.status[key].done++;if(S.status[key].done%10===0)soft();
 });
 S.status[key]=null;viewCache.clear();softNow();
}
