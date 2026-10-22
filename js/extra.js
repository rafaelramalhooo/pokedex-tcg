/* Complemento de cartas que a TCGdex ainda não cadastrou (promos recentes, como a Nidorina MEP 101).
   Os dados factuais vêm de data/extra-cards.json (nome, número, raridade, ilustrador, Pokédex), lidos das páginas públicas
   do Dex (dextcg.com) em 21/10/2026. As imagens são carregadas direto do endereço do Dex; se não existirem ou falharem,
   aparece o espaço reservado. Quando a TCGdex passar a ter a carta, a da TCGdex vence e a daqui é ignorada. */
import {DEX_EXTRA} from './dex30.js';

const IMG='https://dextcg.com/cdn-cgi/image/q=75,f=auto/https://static.dextcg.com/cards/';
const pad3=n=>/^\d+$/.test(n)?n.padStart(3,'0'):n;
let EX=null,loading=null;

export const isExtraId=id=>!!EX&&!!EX.cards[id];
export const extraCard=id=>(EX&&EX.cards[id])||null;
export const extraSetIds=()=>EX?Object.keys(EX.sets):[];
/* O "#" no fim faz o app acrescentar /low.webp depois do fragmento, que o servidor ignora. */
const imageOf=(ds,n)=>`${IMG}${ds}%2F${encodeURIComponent(n)}.png#`;

export async function loadExtra(){
 if(EX)return EX;
 if(loading)return loading;
 loading=(async()=>{
  try{
   const r=await fetch('data/extra-cards.json');
   if(!r.ok)throw new Error('http');
   const j=await r.json();
   const out={sets:{},cards:{}};
   for(const [sid,s] of Object.entries(j.sets||{})){
    out.sets[sid]=[];
    (s.cards||[]).forEach(c=>{
     const n=String(c.n),id=`${sid}-${pad3(n)}`;
     const cat=c.cat==='Pokémon'?'Pokemon':c.cat;
     const card={
      id,localId:pad3(n),name:c.name,image:imageOf(s.ds,n),category:cat,illustrator:c.ill||undefined,rarity:c.rar||undefined,
      set:sid,variants:{normal:false,holo:true,reverse:false,firstEdition:false},rvp:[],
      dexId:c.dex?[c.dex]:undefined,types:c.type?[c.type]:undefined,trainerType:c.tt||undefined,
      energyType:cat==='Energy'?'Normal':undefined,regulationMark:c.reg||undefined,lang:'en',extra:true
     };
     out.cards[id]=card;out.sets[sid].push(id);
     if(c.dex)DEX_EXTRA[id]=[c.dex];
    });
   }
   EX=out;
  }catch(e){EX={sets:{},cards:{}};loading=null;}
  return EX;
 })();
 return loading;
}
/* Acrescenta à lista de cartas de uma coleção as que a TCGdex não tem. Devolve quantas entraram. */
export async function mergeExtra(d){
 const ex=await loadExtra();
 const ids=ex.sets[d.id];if(!ids||!ids.length)return 0;
 const have=new Set((d.cards||[]).map(c=>c.id));
 let n=0;
 ids.forEach(id=>{
  if(have.has(id))return;
  const c=ex.cards[id];
  d.cards=d.cards||[];
  d.cards.push({id,localId:c.localId,name:c.name,image:c.image,extra:true});n++;
 });
 if(n){
  d.extraCount=n;
  const cc=d.cardCount||{};
  d.cardCount={...cc,total:Math.max(cc.total||0,(d.cards||[]).length)};
 }
 return n;
}

/* Imagem do Dex para cartas que a TCGdex não tem (nem em português nem em inglês). Só monta o endereço; se o Dex não tiver,
   o app mostra o espaço reservado. Coleções que sabidamente não existem no Dex ficam de fora. */
const NO_DEX=/^(tk-|20\d\d|miscp|bog|exu|ex5\.5|mfb|ecard3|xya|bwp|hgssp|cel25cc|sve|P-|A\d|B\d)/;
export function dexSlug(setId){
 const id=String(setId||'');
 if(!id||NO_DEX.test(id))return'';
 if(id==='30th')return'me55';
 if(id==='30th-c')return'me55cc';
 if(id==='swsh12.5')return'swsh12pt5';
 if(id==='swsh12.5gg')return'swsh12pt5gg';
 return id.replace(/^(me|sv|swsh|sm|xy|bw|dp|pl|ex|hgss)0+(\d)/,'$1$2').replace('.','');
}
export function dexImage(setId,localId){
 const sl=dexSlug(setId);if(!sl||localId===undefined||localId==='')return'';
 const n=/^\d+$/.test(String(localId))?String(+localId):String(localId);
 return imageOf(sl,n);
}
