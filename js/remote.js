/* Regras que precisam de detalhes da carta (tipo, ilustrador, marca, PS…): em vez de exigir o catálogo inteiro baixado,
   perguntamos ao servidor da TCGdex quais cartas combinam e cruzamos com a lista que já temos. */
import {api} from './api.js';
import {loadIds} from './catalog.js';
import {S, soft} from './state.js';

const TYPE_EN={planta:'Grass',fogo:'Fire',agua:'Water',raios:'Lightning',luta:'Fighting',metal:'Metal',psiquico:'Psychic',escuridao:'Darkness',incolor:'Colorless',dragao:'Dragon',fada:'Fairy'};
const CAT_EN={pokemon:'Pokemon',treinador:'Trainer',energia:'Energy'};
const STAGE_EN={basico:'Basic',fase1:'Stage1',fase2:'Stage2'};
const enc=encodeURIComponent;
const list=raw=>String(raw).split(/[,;|]/).map(x=>x.trim()).filter(Boolean);

/* Traduz uma regra em consultas da TCGdex. Devolve {q:[consultas unidas], neg} ou null quando não dá para perguntar ao servidor. */
export function plan(c){
 const raw=String(c.v).trim();if(!raw)return null;
 const neg=c.op==='ne'||c.op==='notcontains';
 const eq=c.op==='eq'||c.op==='ne';
 switch(c.f){
  case 'types':return eq&&TYPE_EN[raw]?{q:[`types=eq:${TYPE_EN[raw]}`],neg}:null;
  case 'category':return eq&&CAT_EN[raw]?{q:[`category=eq:${CAT_EN[raw]}`],neg}:null;
  case 'stage':return eq&&STAGE_EN[raw]?{q:[`stage=eq:${STAGE_EN[raw]}`],neg}:null;
  case 'regulationMark':
   if(eq)return{q:[`regulationMark=eq:${enc(raw.toUpperCase())}`],neg};
   if(c.op==='in')return{q:list(raw).map(m=>`regulationMark=eq:${enc(m.toUpperCase())}`),neg:false};
   return null;
  case 'standard':{
   const marks=S.settings.legalMarks.map(m=>String(m).toUpperCase());
   if(!marks.length)return null;
   return{q:marks.map(m=>`regulationMark=eq:${enc(m)}`),neg:raw==='nao'};
  }
  case 'hp':{
   const n=Number(raw);if(Number.isNaN(n))return null;
   const m={eq:'eq',ne:'eq',gt:'gt',gte:'gte',lt:'lt',lte:'lte'}[c.op];
   return m?{q:[`hp=${m}:${n}`],neg:c.op==='ne'}:null;
  }
  case 'dexId':{
   if(c.op==='eq'||c.op==='ne'){const n=Number(raw);return Number.isNaN(n)?null:{q:[`dexId=eq:${n}`],neg:c.op==='ne'};}
   if(c.op==='in')return{q:list(raw).filter(x=>!Number.isNaN(Number(x))).map(n=>`dexId=eq:${Number(n)}`),neg:false};
   return null;
  }
  case 'illustrator':
   if(c.op==='contains'||c.op==='notcontains')return{q:[`illustrator=${enc(raw)}`],neg};
   if(eq)return{q:[`illustrator=eq:${enc(raw)}`],neg};
   if(c.op==='in')return{q:list(raw).map(x=>`illustrator=eq:${enc(x)}`),neg:false};
   return null;
  case 'suffix':
   /* o servidor diferencia maiúsculas (ex x EX): perguntamos pelas duas formas */
   return eq?{q:[...new Set([raw,raw.toUpperCase(),raw.toLowerCase()])].map(x=>`suffix=eq:${enc(x)}`),neg}:null;
  case 'variant':return c.op==='eq'&&['normal','holo','reverse'].includes(raw)?{q:[`variants.${raw}=true`],neg:false}:null;
 }
 return null;
}

/* fila com poucas consultas ao mesmo tempo (o servidor recusa rajadas) */
let running=0;const waiting=[];
const MAX=2;
function enqueue(fn){
 return new Promise((res,rej)=>{
  const go=()=>{running++;fn().then(res,rej).finally(()=>{running--;const n=waiting.shift();if(n)n();});};
  if(running<MAX)go();else waiting.push(go);
 });
}
function start(key,qs){
 const e=S.remote[key]={status:'loading',ids:new Set()};
 (async()=>{
  try{
   for(const q of qs){
    const rows=await enqueue(()=>api('/cards?'+q,'en',4));
    (rows||[]).forEach(r=>e.ids.add(r.id));
   }
   e.status='ok';
  }catch(err){e.status='err';}
  document.dispatchEvent(new Event('remote-done'));
  soft();
 })();
 return e;
}
/* Resultado do servidor para uma regra: {status:'loading'|'ok'|'err', ids, neg} ou null (regra sem consulta possível). */
export function remoteFor(c){
 const p=plan(c);if(!p||!p.q.length)return null;
 const key=p.q.join('&&');
 const e=S.remote[key]||start(key,p.q);
 return{status:e.status,ids:e.ids,neg:p.neg,key};
}
export function retryRemote(){
 Object.keys(S.remote).forEach(k=>{if(S.remote[k].status==='err')delete S.remote[k];});
 soft();
}

/* Detalhes que ainda faltam só para as cartas que passaram nas outras regras: baixa sozinho, sem aviso. */
export const AUTO_MAX=800;
const tried=new Set();
export function autoResolve(r){
 const ids=(r.pendingIds||[]).filter(id=>!tried.has(id));
 if(!ids.length||ids.length>AUTO_MAX||S.status.rule)return false;
 ids.forEach(id=>tried.add(id));
 loadIds(ids,'rule');
 return true;
}
export function resetTried(ids){(ids||[]).forEach(id=>tried.delete(id));}
