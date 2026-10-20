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

export async function fetchCatalog(){
 S.status.catalog='loading';S.status.err='';softNow();
 try{
  const [pt,en]=await Promise.all([getOrNull('/sets','pt'),getOrNull('/sets','en')]);
  if(!pt&&!en)throw new Error('A TCGdex não devolveu a lista de expansões.');
  const ptMap=new Map((pt||[]).map(s=>[s.id,s]));
  const out=[];const seen=new Set();
  (en||pt).forEach(s=>{const p=ptMap.get(s.id);out.push(p?{...p,lang:'pt'}:{...s,lang:'en'});seen.add(s.id);});
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
export async function ensureSetd(id,force){
 if(S.setd[id]&&!force)return S.setd[id];
 const d=await getFB(`/sets/${encodeURIComponent(id)}`);
 S.setd[id]=d;indexSetd(d);viewCache.clear();C.opt=null;
 await DB.put('setd',id,d);
 return d;
}
export async function preloadSetd(force){
 if(S.status.pre)return;
 const todo=S.sets.filter(s=>force||!S.setd[s.id]);
 if(!todo.length)return;
 S.status.pre={done:0,total:todo.length};S.status.preErr=0;softNow();
 await pool(todo,6,async s=>{
  try{await ensureSetd(s.id,force);}catch(e){S.status.preErr++;}
  S.status.pre.done++;soft();
 });
 S.status.pre=null;softNow();
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
 const sets=visibleSets().slice().reverse().sort((a,b)=>(bySet[b.id]?1:0)-(bySet[a.id]?1:0));
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
 visibleSets().forEach(s=>{const d=S.setd[s.id];if(d)(d.cards||[]).forEach(c=>{total++;if(S.cards[c.id])have++;});});
 const setsLoaded=visibleSets().filter(s=>S.setd[s.id]).length;
 return{total,have,setsLoaded,sets:visibleSets().length};
}
