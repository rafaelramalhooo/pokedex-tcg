/* Regras dos fichários: avaliação e descrição. */
import {visibleSet} from './catalog.js';
import {isOwned, setIdOf} from './collection.js';
import {BOOL, CAT_ALIAS, FIN, FM, GENS, OPS, STAGE_ALIAS, TYPE_ALIAS, genOf} from './constants.js';
import {C, S, viewCache} from './state.js';
import {canon, esc, natCmp, nz} from './util.js';

export function viewOf(id){
 let v=viewCache.get(id);if(v)return v;
 const b=S.briefs[id]||{};const c=S.cards[id];
 const setId=b.setId||(c&&c.set)||'';
 const set=S.setMap[setId];const se=S.serieOf[setId];
 v={id,setId,localId:String(b.localId||(c&&c.localId)||''),nameRaw:b.name||(c&&c.name)||id,
  name:nz(b.name||(c&&c.name)),setName:nz(set?set.name:setId),setKey:nz(setId),serie:nz(se?se.name:''),full:!!c,
  dex:[],types:[],cat:'',stage:'',suffix:'',trainer:'',illus:'',rarity:'',hp:null,mark:'',vars:[]};
 if(c){
  v.dex=Array.isArray(c.dexId)?c.dexId.map(Number):[];
  v.types=(c.types||[]).map(t=>canon(TYPE_ALIAS,t));
  v.cat=canon(CAT_ALIAS,c.category);v.stage=canon(STAGE_ALIAS,c.stage||'');
  v.suffix=nz(c.suffix);v.trainer=nz(c.trainerType);v.illus=nz(c.illustrator);v.rarity=nz(c.rarity);
  v.hp=c.hp==null?null:Number(c.hp);v.mark=String(c.regulationMark||'').toUpperCase();
  if(c.variants)FIN.forEach(f=>{if(c.variants[f])v.vars.push(f);});
 }
 viewCache.set(id,v);return v;
}
export function valuesOf(v,k){
 switch(k){
  case 'name':return[v.name];
  case 'dexId':return v.dex;
  case 'generation':return[...new Set(v.dex.map(genOf).filter(Boolean))];
  case 'pokemon':return[v.name];
  case 'set':return[v.setName,v.setKey];
  case 'serie':return[v.serie];
  case 'types':return v.types;
  case 'category':return[v.cat];
  case 'stage':return[v.stage];
  case 'suffix':return[v.suffix];
  case 'trainerType':return[v.trainer];
  case 'illustrator':return[v.illus];
  case 'rarity':return[v.rarity];
  case 'hp':return v.hp==null?[]:[v.hp];
  case 'regulationMark':return[nz(v.mark)];
  case 'standard':return[S.settings.legalMarks.map(m=>m.toUpperCase()).includes(v.mark)?'sim':'nao'];
  case 'variant':return v.vars;
  case 'owned':return[isOwned(v.id)?'sim':'nao'];
 }
 return[];
}
export const pokeNames=raw=>String(raw||'').split(/[,;|]/).map(nz).filter(Boolean);
const wordRe=n=>new RegExp('(^|[^a-z0-9])'+n.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'($|[^a-z0-9])');
export function testCond(v,c){
 const F=FM[c.f];const vals=valuesOf(v,c.f);
 const raw=String(c.v).trim();
 if(F.t==='poke')return pokeNames(raw).some(n=>wordRe(n).test(v.name));
 if(F.t==='gen'){const want=raw.split(',').map(x=>x.trim()).filter(Boolean);return vals.some(g=>want.includes(String(g)));}
 if(F.t==='num'&&c.op!=='in'){
  const n=Number(raw);if(Number.isNaN(n))return false;
  const x=vals[0];
  switch(c.op){
   case 'eq':return vals.some(y=>y===n);
   case 'ne':return !vals.some(y=>y===n);
   case 'gt':return x!=null&&x>n;case 'gte':return x!=null&&x>=n;
   case 'lt':return x!=null&&x<n;case 'lte':return x!=null&&x<=n;
  }
  return false;
 }
 const want=nz(raw);
 const sv=vals.map(x=>typeof x==='number'?String(x):x);
 switch(c.op){
  case 'eq':return sv.includes(want);
  case 'ne':return !sv.includes(want);
  case 'contains':return sv.some(x=>x.includes(want));
  case 'notcontains':return !sv.some(x=>x.includes(want));
  case 'in':{const list=raw.split(/[,;|]/).map(nz).filter(Boolean);return sv.some(x=>list.includes(x));}
 }
 return false;
}
const SUF=/\b(ex|gx|v|vmax|vstar|v-union|break|lv\.?x|mega|radiante|radiant|alolan|galarian|hisuian|paldean|dark|light|shining)\b/gi;
export const cleanName=n=>String(n||'').replace(SUF,'').replace(/\s+/g,' ').trim();
/* Modo Pokédex: um espaço por número da Pokédex Nacional, na ordem. */
export function dexModel(b){
 const gens=(b.gens&&b.gens.length?b.gens:GENS.map(g=>g[0])).map(Number);
 const byDex=new Map();
 for(const id in S.cards){
  const c=S.cards[id];
  if(!Array.isArray(c.dexId)||!c.dexId.length)continue;
  const sid=c.set||(S.briefs[id]||{}).setId;if(sid&&!visibleSet(sid))continue;
  c.dexId.forEach(n=>{n=Number(n);if(!byDex.has(n))byDex.set(n,[]);byDex.get(n).push(id);});
 }
 const slots=[];
 GENS.filter(([g])=>gens.includes(g)).forEach(([g,a,z])=>{
  for(let n=a;n<=z;n++){
   const cand=sortIds((byDex.get(n)||[]).slice());
   let rep=null;
   if(b.pick&&b.pick[n]&&cand.includes(b.pick[n]))rep=b.pick[n];
   else{const ow=cand.filter(isOwned);rep=ow.length?ow[ow.length-1]:(cand.length?cand[cand.length-1]:null);}
   let name='';
   cand.forEach(id=>{const nm=cleanName((S.cards[id]||{}).name);if(nm&&(!name||nm.length<name.length))name=nm;});
   slots.push({dex:n,gen:g,name,rep,cand,owned:cand.some(isOwned)});
  }
 });
 return slots;
}
/* Cartas de um fichário por nome, antes de ter os detalhes (para baixar só o que precisa). */
export function scopeIds(b){
 const conds=(b.conds||[]).filter(c=>String(c.v).trim()!==''&&!FM[c.f].d);
 const out=[];
 if(!conds.length)return out;
 for(const id in S.briefs){
  if(S.cards[id]||!visibleSet(S.briefs[id].setId))continue;
  const v=viewOf(id);const res=conds.map(c=>testCond(v,c));
  if(b.match==='any'?res.some(Boolean):res.every(Boolean))out.push(id);
 }
 return out;
}
export function evalBinder(b){
 if(b.mode==='pokedex'){
  const dex=dexModel(b);
  return{ids:dex.filter(x=>x.rep).map(x=>x.rep),dex,pending:0,empty:false};
 }
 if(b.mode==='manual'){
  const ids=b.cardIds.filter(id=>S.briefs[id]||S.cards[id]);
  return{ids:sortIds(ids),pending:0,empty:false};
 }
 const conds=(b.conds||[]).filter(c=>String(c.v).trim()!=='');
 if(!conds.length)return{ids:[],pending:0,empty:true};
 const needD=conds.some(c=>FM[c.f].d);
 const ids=[];let pending=0;
 for(const id in S.briefs){
  if(!visibleSet(S.briefs[id].setId))continue;
  const v=viewOf(id);
  if(needD&&!v.full){pending++;continue;}
  const res=conds.map(c=>testCond(v,c));
  if(b.match==='any'?res.some(Boolean):res.every(Boolean))ids.push(id);
 }
 return{ids:sortIds(ids),pending,empty:false};
}
export function sortIds(ids){
 return ids.sort((a,b)=>{
  const sa=S.setIdx[setIdOf(a)]??1e9,sb=S.setIdx[setIdOf(b)]??1e9;
  if(sa!==sb)return sa-sb;
  return natCmp((S.briefs[a]||{}).localId||a,(S.briefs[b]||{}).localId||b);
 });
}
export function optionsFor(k){
 if(!C.opt){
  C.opt={illustrator:new Set(),rarity:new Set(),suffix:new Set(),trainerType:new Set(),regulationMark:new Set()};
  for(const id in S.cards){const c=S.cards[id];
   if(c.illustrator)C.opt.illustrator.add(c.illustrator);
   if(c.rarity)C.opt.rarity.add(c.rarity);
   if(c.suffix)C.opt.suffix.add(c.suffix);
   if(c.trainerType)C.opt.trainerType.add(c.trainerType);
   if(c.regulationMark)C.opt.regulationMark.add(String(c.regulationMark).toUpperCase());
  }
 }
 if(k==='pokemon'){
  const set=new Set();
  for(const id in S.briefs){const n=String(S.briefs[id].name||'').replace(/\b(ex|gx|v|vmax|vstar|v-union|break|lv\.?x|mega|radiante|radiant|alolan|galarian|hisuian|paldean|dark|light|shining|team .*?'s|[a-z]+'s)\b/gi,'').replace(/\s+/g,' ').trim();if(n&&n.length>2&&!/\d/.test(n))set.add(n);}
  return[...set].sort((a,b)=>a.localeCompare(b)).slice(0,2500);
 }
 if(k==='set')return S.sets.map(s=>s.name);
 if(k==='serie')return[...new Set(Object.values(S.serieOf).map(s=>s.name))];
 return C.opt[k]?[...C.opt[k]].sort((a,b)=>a.localeCompare(b)):[];
}
export function ruleChips(b){
 if(b.mode==='pokedex')return`<span class="badge">Pokédex${b.gens&&b.gens.length&&b.gens.length<GENS.length?', gerações '+b.gens.map(g=>g+'ª').join(', '):', todas as gerações'}</span>`;
 if(b.mode==='manual')return`<span class="badge">Escolha manual, ${b.cardIds.length} cartas</span>`;
 const cs=(b.conds||[]).filter(c=>String(c.v).trim()!=='');
 if(!cs.length)return'<span class="badge">Sem regras definidas</span>';
 return cs.map(c=>{
  const F=FM[c.f];let val=c.v;
  if(F.t==='gen'){const gl=String(c.v).split(',').filter(Boolean).map(x=>x+'ª').join(', ');return`<span class="badge">Geração: ${esc(gl)}</span>`;}
  if(F.t==='poke')return`<span class="badge">Pokémon: ${esc(pokeNames(c.v).map(n=>n.replace(/^./,m=>m.toUpperCase())).join(', '))}</span>`;
  const o=(F.opts||(F.t==='bool'?BOOL:null));
  if(o){const m=o.find(x=>x[0]===c.v);if(m)val=m[1];}
  const txt=(c.op==='eq'&&(F.t==='bool'||F.t==='enum'))?`${F.label}: ${val}`:`${F.label} ${OPS[c.op]} ${val}`;
  return`<span class="badge">${esc(txt)}</span>`;
 }).join('');
}
