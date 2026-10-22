/* Catálogo: coleções, cartas, sincronização. */
import {getFB, getOrNull, pool} from './api.js';
import {groupBySet,isOwned} from './collection.js';
import {DB, saveKV} from './db.js';
import {C, S, soft, softNow, viewCache} from './state.js';
import {nz} from './util.js';
import {dexImage,extraCard,isExtraId,loadExtra,mergeExtra} from './extra.js';

export function indexSets(){
 S.setMap={};S.setIdx={};
 S.sets.forEach((s,i)=>{S.setMap[s.id]=s;S.setIdx[s.id]=i;});
}
export function indexSetd(d){
 (d.cards||[]).forEach(c=>{S.briefs[c.id]={id:c.id,localId:String(c.localId),name:c.name,image:c.image,setId:d.id,...(c.extra?{lang:'en',extra:true}:{})};});
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
  if(!pt&&!en)throw new Error('A TCGdex não devolveu a lista de coleções.');
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
/* A TCGdex em português costuma ter menos cartas que a versão em inglês (promos e cartas novas ainda sem tradução).
   Por isso toda coleção é completada com a lista em inglês, mantendo o nome em português onde existir.
   Depois entram as cartas do complemento (js/extra.js), que a TCGdex ainda não cadastrou. */
async function fetchSetFull(id){
 const path=`/sets/${encodeURIComponent(id)}`;
 const d=await getFB(path);
 const cc=d.cardCount||{};
 if(d.__lang!=='en'){
  const en=await getOrNull(path,'en');
  if(en&&(en.cards||[]).length){
   const pt=new Map((d.cards||[]).map(c=>[c.id,c]));
   const enIds=new Set(en.cards.map(c=>c.id));
   const missing=en.cards.some(c=>!pt.has(c.id));
   /* o nome vem do português; a imagem do inglês quando o português não tem */
   const noImg=en.cards.some(c=>{const p=pt.get(c.id);return p&&!p.image&&c.image;});
   if(missing||noImg){
    d.cards=[...en.cards.map(c=>{const p=pt.get(c.id);return p?(p.image||!c.image?p:{...p,image:c.image}):c;}),...(d.cards||[]).filter(c=>!enIds.has(c.id))];
    if(missing){
     const ec=en.cardCount||{};
     d.cardCount={...cc,total:Math.max(cc.total||0,ec.total||0,d.cards.length),official:cc.official||ec.official||0};
     d.completedFromEn=true;
    }
   }
  }
 }
 /* sem imagem na TCGdex: tenta a do Dex */
 (d.cards||[]).forEach(c=>{if(!c.image){const u=dexImage(d.id,c.localId);if(u)c.image=u;}});
 await mergeExtra(d);
 d.fullChecked=4;
 return d;
}
export async function ensureSetd(id,force){
 const old=S.setd[id];
 if(old&&old.fullChecked===4&&!force)return old;
 let d;
 try{d=await fetchSetFull(id);}
 catch(e){if(old)return old;throw e;}
 S.setd[id]=d;indexSetd(d);viewCache.clear();C.opt=null;
 await DB.put('setd',id,d);
 return d;
}
export async function preloadSetd(force){
 if(S.status.pre)return;
 const todo=mySets().filter(s=>force||!S.setd[s.id]||S.setd[s.id].fullChecked!==4);
 if(!todo.length){loadSelectedCards();return;}
 S.status.pre={done:0,total:todo.length};S.status.preErr=0;softNow();
 await pool(todo,6,async s=>{
  try{await ensureSetd(s.id,force);}catch(e){S.status.preErr++;}
  S.status.pre.done++;soft();
 });
 S.status.pre=null;softNow();
 loadSelectedCards();
}
/* Cartas que você tem (marcadas neste ou em outro aparelho) mas cujos detalhes ainda não foram baixados aqui.
   Sem os detalhes, o fichário de Pokédex e as regras não enxergam a carta. */
const ownedFail=new Set();
export const ownedMissing=()=>Object.keys(S.collection).filter(id=>isOwned(id)&&!S.cards[id]&&!ownedFail.has(id));
export async function loadOwnedCards(){
 if(S.status.own)return;
 const ids=ownedMissing();
 if(!ids.length)return;
 S.status.own={done:0,total:ids.length,fail:0};softNow();
 await pool(ids,8,async id=>{
  try{await ensureCard(id);}catch(e){S.status.own.fail++;ownedFail.add(id);}
  S.status.own.done++;if(S.status.own.done%10===0)soft();
 });
 S.status.own=null;viewCache.clear();softNow();
}
/* Baixa os detalhes de todas as cartas das coleções escolhidas (Master Set e regras dependem deles). */
export async function loadSelectedCards(){
 if(S.status.cl)return;
 const ids=[];
 mySets().forEach(s=>{const d=S.setd[s.id];if(d)(d.cards||[]).forEach(c=>{if(!S.cards[c.id])ids.push(c.id);});});
 if(!ids.length){loadOwnedCards();return;}
 S.status.cl={done:0,total:ids.length,fail:0};softNow();
 await pool(ids,8,async id=>{
  try{await ensureCard(id);}catch(e){S.status.cl.fail++;}
  S.status.cl.done++;if(S.status.cl.done%10===0)soft();
 });
 S.status.cl=null;viewCache.clear();softNow();
 loadOwnedCards();
}
/* Padrões do Reverse Holo. Na TCGdex em português o texto vem traduzido ("Reverse", "Poké Bola", "Energia"), em inglês vem "reverse"/"pokeball". */
const foilKey=f=>{let s=nz(String(f)).replace(/[^a-z0-9]/g,'');
 if(s==='energia')return'energy';if(s==='liga')return'league';if(/^(equipe|team)rocket$/.test(s))return'team-rocket';
 return s.replace(/bola$/,'ball');};
export const reversePatterns=c=>[...new Set((c.variants_detailed||[]).filter(v=>v&&nz(String(v.type))==='reverse'&&v.foil).map(v=>foilKey(v.foil)).filter(Boolean))];
export const trimCard=c=>({
 id:c.id,localId:String(c.localId),name:c.name,image:c.image,category:c.category,illustrator:c.illustrator,rarity:c.rarity,
 set:c.set&&c.set.id,
 variants:c.variants?{normal:!!c.variants.normal,holo:!!c.variants.holo,reverse:!!c.variants.reverse,firstEdition:!!c.variants.firstEdition}:null,
 rvp:reversePatterns(c),
 dexId:c.dexId,hp:c.hp,types:c.types,stage:c.stage,suffix:c.suffix,trainerType:c.trainerType,energyType:c.energyType,
 evolveFrom:c.evolveFrom,regulationMark:c.regulationMark,legal:c.legal,lang:c.__lang||'pt'
});
export const inflight=new Map();
export function ensureCard(id,force){
 if(S.cards[id]&&!force)return Promise.resolve(S.cards[id]);
 if(inflight.has(id))return inflight.get(id);
 const p=(async()=>{
  await loadExtra();
  const c=isExtraId(id)?{...extraCard(id)}:trimCard(await getFB(`/cards/${encodeURIComponent(id)}`));
  if(!c.image){const b=S.briefs[id];c.image=(b&&b.image)||dexImage(c.set,c.localId)||c.image;}
  S.cards[id]=c;viewCache.delete(id);C.opt=null;
  await DB.put('cards',id,c);
  return c;
 })().finally(()=>inflight.delete(id));
 inflight.set(id,p);
 return p;
}
export async function ensureSetCards(setId){
 const d=S.setd[setId];if(!d)return;
 const todo=(d.cards||[]).map(c=>c.id).filter(id=>!S.cards[id]||S.cards[id].rvp===undefined);
 if(!todo.length)return;
 if(S.setLoad[setId])return;
 S.setLoad[setId]={done:0,total:todo.length};soft();
 await pool(todo,8,async id=>{
  try{await ensureCard(id,!!S.cards[id]);}catch(e){}
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

/* Carrega a lista de cartas de todas as coleções (leve: um pedido por coleção), para achar um Pokémon em qualquer uma. */
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
