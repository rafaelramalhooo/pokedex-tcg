/* Cartas de jogo: cartas que você usa só para jogar. Ficam separadas da coleção (não entram em fichários nem no progresso das coleções).
   Para jogar, qualquer impressão da carta serve, então a consulta é agrupada pelo nome. */
import {S} from './state.js';
import {saveKV} from './db.js';
import {snapOf} from './trades.js';
import {nameKey} from './decks.js';

export const MAX_PLAY=999;
export const savePlay=()=>saveKV('play',S.play);
export const getPlay=id=>S.play.find(x=>x.id===id);
export const playTotal=()=>S.play.reduce((a,e)=>a+e.q,0);
export function addPlay(id,q=1){
 const ex=getPlay(id);
 if(ex){ex.q=Math.min(MAX_PLAY,ex.q+q);return ex;}
 const e={id,q:Math.max(1,Math.min(MAX_PLAY,q)),...snapOf(id)};S.play.push(e);return e;
}
export function setPlay(id,q){
 const i=S.play.findIndex(x=>x.id===id);if(i<0)return;
 if(q<=0)S.play.splice(i,1);else S.play[i].q=Math.min(MAX_PLAY,q);
}
/* Uma linha por nome de carta, com as impressões que você tem. */
export function playGroups(){
 const by=new Map();
 for(const e of S.play){
  if(!(e.q>0))continue;
  const k=nameKey(e.n);const g=by.get(k)||{k,n:e.n,q:0,entries:[]};
  g.q+=e.q;g.entries.push(e);by.set(k,g);
 }
 for(const g of by.values()){
  g.entries.sort((a,b)=>b.q-a.q);
  const top=g.entries[0];g.top=top;g.i=top.i;g.id=top.id;
  const inf=S.dinfo[top.id];g.cat=inf?inf.cat:'';
 }
 return[...by.values()].sort((a,b)=>a.n.localeCompare(b.n,'pt',{numeric:true}));
}
/* Texto simples para consultar ou colar em outro lugar: "4 Nome". */
export function playText(groups){return(groups||playGroups()).map(g=>`${g.q} ${g.n}`).join('\n');}
