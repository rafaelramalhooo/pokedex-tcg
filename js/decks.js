/* Decks: modelo, informações das cartas (em inglês, para o formato do TCG Live) e validação do Standard. */
import {S} from './state.js';
import {saveKV} from './db.js';
import {api} from './api.js';
import {snapOf} from './trades.js';
import {langOf} from './cardlabel.js';
import {debounce, nz, uid} from './util.js';

export const DECK_SIZE=60;
export const MAX_COPIES=4;
export const saveDecks=()=>saveKV('decks',S.decks);
export const getDeck=id=>S.decks.find(d=>d.id===id);
export const newDeck=name=>({id:uid(),name:name||'Novo deck',format:'standard',items:[],created:Date.now()});
export const totalCards=d=>d.items.reduce((a,i)=>a+i.q,0);

/* Nome-chave: sem acento, minúsculo e sem o complemento entre parênteses ("Boss's Orders (Giovanni)" = "Boss's Orders"). */
export const nameKey=n=>nz(String(n||'').replace(/[’‘]/g,"'").replace(/\s*\([^)]*\)\s*$/,'')).replace(/\s+/g,' ');
const BASIC_E=/^(basic\s+)?(grass|fire|water|lightning|psychic|fighting|darkness|metal)\s+energy$/;

/* ---------- informações da carta (cache local; vêm da TCGdex em inglês) ---------- */
export const saveInfoSoon=debounce(()=>saveKV('dinfo',S.dinfo),900);
const inflight=new Map();
const CAT={pokemon:'pokemon',trainer:'treinador',energy:'energia'};
export function infoFrom(c){
 const ne=String(c.name||'');const nk=nameKey(ne);
 const cat=CAT[nz(c.category)]||'pokemon';
 const sig=cat==='pokemon'?JSON.stringify([c.hp||0,(c.abilities||[]).map(a=>nz(a.name)),(c.attacks||[]).map(a=>[nz(a.name),String(a.damage||'')])]):'';
 return{id:c.id,ne,nk,cat,tt:c.trainerType||'',st:c.stage||'',mk:String(c.regulationMark||'').toUpperCase(),ra:c.rarity||'',
  be:cat==='energia'&&BASIC_E.test(nz(ne)),set:c.set&&c.set.id||'',no:String(c.localId||''),img:c.image||'',sig,
  ace:/ace\s*spec/i.test(c.rarity||''),rad:/radiant/i.test(c.rarity||'')};
}
export function ensureInfo(id){
 if(S.dinfo[id])return Promise.resolve(S.dinfo[id]);
 if(inflight.has(id))return inflight.get(id);
 const p=api(`/cards/${encodeURIComponent(id)}`,'en').then(c=>{const i=infoFrom(c);S.dinfo[id]=i;saveInfoSoon();return i;}).finally(()=>inflight.delete(id));
 inflight.set(id,p);return p;
}
export async function pool(ids,n,fn){let i=0;await Promise.all(Array.from({length:n},async()=>{while(i<ids.length){const x=ids[i++];try{await fn(x);}catch(e){}}}));}

/* Reimpressão: uma carta fora do Standard vale se existe, no Standard, uma carta com o mesmo nome e o mesmo texto.
   Para Treinador e Energia comparamos o nome; para Pokémon, nome, PS, habilidades e ataques. É uma inferência. */
export async function ensureReprint(info){
 if(info.rp!==undefined)return info.rp;
 let rp=false;
 try{
  const list=await api(`/cards?name=${encodeURIComponent(info.ne.replace(/\s*\([^)]*\)\s*$/,''))}&legal.standard=true`,'en');
  const cand=(list||[]).filter(c=>nameKey(c.name)===info.nk).slice(0,6);
  for(const c of cand){
   const ci=await ensureInfo(c.id);
   if(!S.settings.legalMarks.map(m=>m.toUpperCase()).includes(ci.mk))continue;
   if(info.cat!=='pokemon'||ci.sig===info.sig){rp=true;break;}
  }
 }catch(e){return undefined;}
 info.rp=rp;saveInfoSoon();return rp;
}
export const markTxt=i=>i&&i.mk?`letra ${i.mk}`:'sem letra na base';
export const legalMarks=()=>S.settings.legalMarks.map(m=>m.toUpperCase());
/* A letra (marca) impressa na carta decide. Só as cartas SEM letra nos dados, de coleções liberadas por exceção (a TCGdex não traz a marca da Celebração de 30 Anos), entram por exceção. A Coleção Clássica (30th-c) nunca entra: não vale em torneio. */
export const CLASSIC_30='30th-c';
export const legalSetOk=sid=>!!sid&&sid!==CLASSIC_30&&(S.settings.legalSets||[]).map(x=>String(x).toLowerCase()).includes(String(sid).toLowerCase());
/* 'ok' (marca legal ou energia básica), 'exc' (coleção liberada por exceção), 'reprint' (inferido), 'no', ou 'wait' (ainda sem dados) */
export function legalOf(info){
 if(!info)return'wait';
 if(info.be)return'ok';
 if(legalMarks().includes(info.mk))return'ok';
 if(info.set===CLASSIC_30)return'no';
 if(info.mk===''&&legalSetOk(info.set))return'exc';
 if(info.rp===true)return'reprint';
 if(info.rp===false)return'no';
 return info.mk===''&&info.rp===undefined?'wait':'wait';
}
/* Busca os dados e as reimpressões de todas as cartas do deck. */
export async function resolveDeck(d,onStep){
 const ids=[...new Set(d.items.map(i=>i.id))];
 await pool(ids,6,async id=>{await ensureInfo(id);if(onStep)onStep();});
 const need=ids.map(id=>S.dinfo[id]).filter(i=>i&&legalOf(i)==='wait'&&i.rp===undefined);
 await pool(need,4,async i=>{await ensureReprint(i);if(onStep)onStep();});
}

/* ---------- validação ---------- */
export function nameCounts(d){
 const m=new Map();
 for(const it of d.items){const i=S.dinfo[it.id];const k=i?i.nk:nameKey(it.n);const g=m.get(k)||{k,q:0,n:it.n,be:!!(i&&i.be),ids:[]};g.q+=it.q;g.ids.push(it.id);m.set(k,g);}
 return m;
}
export function validate(d){
 const issues=[];const total=totalCards(d);
 const by={pokemon:0,treinador:0,energia:0};let pending=0,basic=0,ace=0,rad=0;
 for(const it of d.items){
  const i=S.dinfo[it.id];if(!i){pending++;continue;}
  by[i.cat]+=it.q;if(i.cat==='pokemon'&&i.st==='Basic')basic+=it.q;
  if(i.ace)ace+=it.q;if(i.rad)rad+=it.q;
 }
 if(total!==DECK_SIZE)issues.push({lvl:'err',msg:total<DECK_SIZE?`Faltam ${DECK_SIZE-total} carta${DECK_SIZE-total===1?'':'s'} para chegar a ${DECK_SIZE}.`:`Há ${total-DECK_SIZE} carta${total-DECK_SIZE===1?'':'s'} a mais que ${DECK_SIZE}.`});
 for(const g of nameCounts(d).values())if(!g.be&&g.q>MAX_COPIES)issues.push({lvl:'err',msg:`${g.n}: ${g.q} cópias (o máximo é ${MAX_COPIES} por nome).`});
 if(!pending&&total&&basic===0)issues.push({lvl:'err',msg:'O deck precisa de pelo menos 1 Pokémon Básico.'});
 if(ace>1)issues.push({lvl:'err',msg:`ACE SPEC: ${ace} cartas (só 1 por deck).`});
 if(rad>1)issues.push({lvl:'err',msg:`Radiante: ${rad} cartas (só 1 por deck).`});
 if(d.format==='standard'){
  const bad=[],rep=[],cls=[];
  const seen=new Set();
  for(const it of d.items){
   const i=S.dinfo[it.id];const L=legalOf(i);if(seen.has(it.n+L))continue;seen.add(it.n+L);
   if(L==='no'){if(i&&i.set===CLASSIC_30)cls.push(i.ne);else bad.push(i?`${i.ne} (${markTxt(i)})`:it.n);}else if(L==='reprint')rep.push(`${i.ne} (${markTxt(i)})`);
  }
  if(cls.length)issues.push({lvl:'err',msg:`Coleção Clássica da Celebração de 30 Anos não vale em torneio: ${cls.join(', ')}.`});
  if(bad.length)issues.push({lvl:'err',msg:`Fora do Standard: ${bad.join(', ')}.`});
  if(rep.length)issues.push({lvl:'warn',msg:`A letra da carta está fora da lista de marcas legais, mas existe uma cópia idêntica legal (reimpressão, inferido pelo nome e texto; confira no jogo): ${rep.join(', ')}.`});
 }
 if(pending)issues.push({lvl:'info',msg:`Conferindo ${pending} carta${pending===1?'':'s'} na TCGdex…`});
 const errs=issues.filter(x=>x.lvl==='err').length;
 return{total,by,issues,ok:!errs&&!pending&&total===DECK_SIZE,pending,errs};
}

/* ---------- itens ---------- */
export function addCopy(d,id,q=1){
 const ex=d.items.find(i=>i.id===id);
 if(ex){ex.q=Math.min(99,ex.q+q);return ex;}
 const it={id,q:Math.max(1,q),...snapOf(id)};d.items.push(it);return it;
}
export function setCopies(d,id,q){
 const i=d.items.findIndex(x=>x.id===id);if(i<0)return;
 if(q<=0)d.items.splice(i,1);else d.items[i].q=Math.min(99,q);
}
/* Quanto você tem de uma carta pelo nome (todas as impressões da sua coleção). */
export function ownByName(){
 const m=new Map();
 for(const id in S.collection){
  const e=S.collection[id];let q=0;for(const f in e.f)q+=(e.f[f]&&e.f[f].q)||0;
  if(q<=0)continue;
  const k=nameKey(snapOf(id).n);m.set(k,(m.get(k)||0)+q);
 }
 return m;
}

/* ---------- lista de negociação a partir do deck ---------- */
/* Procuro: o que falta (por nome). Vendo/Troco: o que você tem do deck, usando as impressões que estão na sua coleção. */
export function tradeFromDeck(d,kind){
 const own=ownByName();
 const groups=new Map();
 for(const it of d.items){const k=nameKey(it.n);const g=groups.get(k)||{k,q:0,items:[]};g.q+=it.q;g.items.push(it);groups.set(k,g);}
 const items=[];let cards=0;const names=new Set();
 if(kind==='want'){
  for(const g of groups.values()){
   let miss=Math.max(0,g.q-(own.get(g.k)||0));
   for(const it of g.items){
    if(miss<=0)break;
    const take=Math.min(it.q,miss);miss-=take;
    items.push({id:it.id,f:'normal',l:langOf(it.id),q:take});cards+=take;names.add(g.k);
   }
  }
 }else{
  const rows=new Map();
  for(const id in S.collection){
   const e=S.collection[id];const k=nameKey(snapOf(id).n);if(!groups.has(k))continue;
   for(const f in e.f){const x=e.f[f];if(!x||x.q<=0)continue;(rows.get(k)||rows.set(k,[]).get(k)).push({id,f,l:x.l||langOf(id),q:x.q,pref:d.items.some(i=>i.id===id)?1:0});}
  }
  for(const g of groups.values()){
   let need=g.q;
   const list=(rows.get(g.k)||[]).sort((a,b)=>b.pref-a.pref||b.q-a.q);
   for(const r of list){
    if(need<=0)break;
    const take=Math.min(need,r.q);need-=take;
    items.push({id:r.id,f:r.f,l:r.l,q:take});cards+=take;names.add(g.k);
   }
  }
 }
 return{items,cards,names:names.size};
}
