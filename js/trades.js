/* Listas de negociação: cartas para vender/trocar ou procurar. Ficam à parte da coleção e da Dex. */
import {S} from './state.js';
import {saveKV} from './db.js';
import {langOf} from './cardlabel.js';
import {derivedImage,tcgdexBase} from './reprints.js';
import {customCard} from './custom.js';
import {uid} from './util.js';

export const saveTrades=()=>saveKV('trades',S.trades);
export const KINDS={sell:'Vendo / Troco',want:'Procuro'};
export const itemKey=i=>i.id+'|'+i.f+'|'+i.l+(i.c?'|'+i.c:'');
export const newTrade=(name,kind)=>({id:uid(),name:name||'Nova lista',kind:kind==='want'?'want':'sell',items:[],created:Date.now()});
export const getTrade=id=>S.trades.find(t=>t.id===id);
export const totalQty=t=>t.items.reduce((a,i)=>a+i.q,0);

/* Dados mínimos da carta, guardados junto do item para a lista abrir mesmo sem o catálogo carregado. */
export function snapOf(id){
 const b=S.briefs[id]||{},c=S.cards[id]||{};
 let img=b.image||c.image||'';
 if(!img){const dv=derivedImage(id);if(dv)img=dv.url;}
 return{n:b.name||c.name||id,i:tcgdexBase(id,img),no:String(b.localId||c.localId||id.slice(id.lastIndexOf('-')+1)),s:b.setId||c.set||id.slice(0,id.lastIndexOf('-'))};
}
export function addItem(t,id,f,l,q,c){
 f=f||'normal';l=l||langOf(id);q=Math.max(1,q||1);c=c||'';
 const probe={id,f,l,c};const ex=t.items.find(x=>itemKey(x)===itemKey(probe));
 if(ex){ex.q+=q;return ex;}
 const it={id,f,l,q,...snapOf(id)};if(c)it.c=c;t.items.push(it);return it;
}
/* Muda a posição de uma carta na lista (índice de 0 a n-1). */
export function moveItemTo(t,key,to){
 const i=t.items.findIndex(x=>itemKey(x)===key);if(i<0)return false;
 const j=Math.max(0,Math.min(t.items.length-1,to));if(i===j)return false;
 const [it]=t.items.splice(i,1);t.items.splice(j,0,it);return true;
}
export function setQty(t,key,q){
 const i=t.items.findIndex(x=>itemKey(x)===key);if(i<0)return;
 if(q<=0)t.items.splice(i,1);else t.items[i].q=Math.min(999,q);
}
export function updateItem(t,key,patch){
 const it=t.items.find(x=>itemKey(x)===key);if(!it)return null;
 const old=it;const next={...it,...patch};if(next.lg!==true)delete next.lg;if(next.lg!==true||!(next.ld>0))delete next.ld;
 const clash=t.items.find(x=>x!==old&&itemKey(x)===itemKey(next));
 if(clash){clash.q=Math.min(999,clash.q+next.q);t.items.splice(t.items.indexOf(old),1);return clash;}
 Object.assign(it,patch);if(it.lg!==true)delete it.lg;if(it.lg!==true||!(it.ld>0))delete it.ld;return it;
}
/* ---------- valor e condição (listas Vendo/Troco) ---------- */
/* Lê um valor digitado em reais: "12,50", "1.250,00" ou "12.5". Vazio ou inválido vira null. */
export function parsePrice(s){
 s=String(s==null?'':s).trim().replace(/R\$|\s/g,'');if(!s)return null;
 s=s.includes(',')?s.replace(/\./g,'').replace(',','.'):s;
 const n=Number(s);if(!isFinite(n)||n<0)return null;
 return Math.round(Math.min(n,999999)*100)/100;
}
export const hasPrice=i=>typeof i.p==='number'&&isFinite(i.p);
/* “Menor da Liga”: o item não tem valor em reais; a etiqueta diz que o menor preço da Liga Pokémon é a referência. */
export const isLiga=i=>!!i&&i.lg===true;
/* desconto sobre o menor preço da Liga: 0 (sem desconto) ou de 1% a 90%, com uma casa decimal */
export function parseDisc(v){
 if(v===null||v===undefined)return 0;
 const n=Number(String(v).replace('%','').replace(',','.').trim());
 if(!isFinite(n)||n<=0)return 0;
 return Math.round(Math.min(90,Math.max(1,n))*10)/10;
}
export const discText=d=>String(d).replace('.',',');
export const ligaLabel=i=>'Menor da Liga'+(i&&i.ld>0?' −'+discText(i.ld)+'%':'');
export function tradeTotal(t){
 let sum=0,priced=0,missing=0,liga=0;
 for(const i of t.items){if(hasPrice(i)){sum+=i.p*i.q;priced++;}else if(isLiga(i))liga++;else missing++;}
 return{sum:Math.round(sum*100)/100,priced,missing,liga};
}
/* Edição em massa. o: {c: undefined|'__none'|código, qMode:''|'set'|'add'|'sub', qVal, pMode:''|'set'|'up'|'down'|'clear', pVal}. Devolve quantas cartas mudaram. */
export function bulkEdit(t,keys,o){
 let n=0;
 const items=t.items.filter(i=>keys.has(itemKey(i)));
 for(const it of items){
  if(!t.items.includes(it))continue;
  const patch={};
  if(o.c!==undefined&&o.c!==null&&o.c!=='')patch.c=o.c==='__none'?'':o.c;
  if(o.qMode){
   const v=Math.floor(Number(o.qVal));
   if(isFinite(v)&&v>=0){
    const q=o.qMode==='set'?v:o.qMode==='add'?it.q+v:it.q-v;
    patch.q=Math.max(1,Math.min(999,q));
   }
  }
  if(o.pMode==='clear'){patch.p=null;patch.lg=false;patch.ld=0;}
  else if(o.pMode==='liga'){patch.p=null;patch.lg=true;patch.ld=parseDisc(o.pVal);}
  else if(o.pMode==='set'){const p=parsePrice(o.pVal);if(p!==null){patch.p=p;patch.lg=false;patch.ld=0;}}
  else if((o.pMode==='up'||o.pMode==='down')&&hasPrice(it)){
   const pc=Number(String(o.pVal).replace(',','.'));
   if(isFinite(pc)&&pc>=0){const f=o.pMode==='up'?1+pc/100:Math.max(0,1-pc/100);patch.p=Math.round(Math.min(it.p*f,999999)*100)/100;}
  }
  if(Object.keys(patch).length){updateItem(t,itemKey(it),patch);n++;}
 }
 return n;
}
/* Copia as cartas que você tem para a lista (não mexe na coleção). */
export function pullMine(t){
 let n=0;
 for(const id in S.collection){
  const e=S.collection[id];
  for(const f in e.f){
   const x=e.f[f];if(!x||x.q<=0)continue;
   const l=x.l||langOf(id);
   if(t.items.some(i=>itemKey(i)===itemKey({id,f,l})))continue;
   addItem(t,id,f,l,x.q);n++;
  }
 }
 return n;
}
export const imgOf=it=>{const b=tcgdexBase(it.id,it.i);return customCard(it.id)||(b?b+'/high.webp':'');};

/* ---------- link público ---------- */
/* Código longo e aleatório (24 caracteres). Quem tem o código vê a cópia da lista; ele não dá acesso a mais nada. */
export function newShareCode(){
 const b=new Uint8Array(18);crypto.getRandomValues(b);
 let s='';for(const x of b)s+=String.fromCharCode(x);
 return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
export const shareLink=code=>`${location.origin}${location.pathname}#/v/${code}`;
/* A cópia leva só o que é visível: nome, tipo e cartas com quantidade, acabamento e idioma. Valor e condição só entram se você escolher (opts.v, opts.c) e só em listas Vendo/Troco. */
export const shareSnapshot=(t,opts)=>{
 const o=t.kind==='sell'?(opts||{}):{};
 return{v:1,name:t.name,kind:t.kind,at:Date.now(),items:t.items.map(i=>{
  const x={id:i.id,n:i.n,no:i.no,i:tcgdexBase(i.id,i.i),q:i.q,f:i.f,l:i.l};
  if(o.c&&i.c)x.c=i.c;
  if(o.v&&hasPrice(i))x.p=i.p;
  if(o.v&&isLiga(i)){x.lg=true;if(i.ld>0)x.ld=i.ld;}
  return x;
 })};
};
