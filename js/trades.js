/* Listas de negociação: cartas para vender/trocar ou procurar. Ficam à parte da coleção e da Dex. */
import {S} from './state.js';
import {saveKV} from './db.js';
import {langOf} from './cardlabel.js';
import {derivedImage} from './reprints.js';
import {customCard} from './custom.js';
import {uid} from './util.js';

export const saveTrades=()=>saveKV('trades',S.trades);
export const KINDS={sell:'Vendo / Troco',want:'Procuro'};
export const itemKey=i=>i.id+'|'+i.f+'|'+i.l;
export const newTrade=(name,kind)=>({id:uid(),name:name||'Nova lista',kind:kind==='want'?'want':'sell',items:[],created:Date.now()});
export const getTrade=id=>S.trades.find(t=>t.id===id);
export const totalQty=t=>t.items.reduce((a,i)=>a+i.q,0);

/* Dados mínimos da carta, guardados junto do item para a lista abrir mesmo sem o catálogo carregado. */
export function snapOf(id){
 const b=S.briefs[id]||{},c=S.cards[id]||{};
 let img=b.image||c.image||'';
 if(!img){const dv=derivedImage(id);if(dv)img=dv.url;}
 return{n:b.name||c.name||id,i:img,no:String(b.localId||c.localId||id.slice(id.lastIndexOf('-')+1)),s:b.setId||c.set||id.slice(0,id.lastIndexOf('-'))};
}
export function addItem(t,id,f,l,q){
 f=f||'normal';l=l||langOf(id);q=Math.max(1,q||1);
 const probe={id,f,l};const ex=t.items.find(x=>itemKey(x)===itemKey(probe));
 if(ex){ex.q+=q;return ex;}
 const it={id,f,l,q,...snapOf(id)};t.items.push(it);return it;
}
export function setQty(t,key,q){
 const i=t.items.findIndex(x=>itemKey(x)===key);if(i<0)return;
 if(q<=0)t.items.splice(i,1);else t.items[i].q=Math.min(999,q);
}
export function updateItem(t,key,patch){
 const it=t.items.find(x=>itemKey(x)===key);if(!it)return null;
 const old=it;const next={...it,...patch};
 const clash=t.items.find(x=>x!==old&&itemKey(x)===itemKey(next));
 if(clash){clash.q=Math.min(999,clash.q+next.q);t.items.splice(t.items.indexOf(old),1);return clash;}
 Object.assign(it,patch);return it;
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
export const imgOf=it=>customCard(it.id)||(it.i?it.i+'/high.webp':'');

/* ---------- link público ---------- */
/* Código longo e aleatório (24 caracteres). Quem tem o código vê a cópia da lista; ele não dá acesso a mais nada. */
export function newShareCode(){
 const b=new Uint8Array(18);crypto.getRandomValues(b);
 let s='';for(const x of b)s+=String.fromCharCode(x);
 return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
export const shareLink=code=>`${location.origin}${location.pathname}#/v/${code}`;
/* A cópia leva só o que é visível: nome, tipo e cartas com quantidade, acabamento e idioma. */
export const shareSnapshot=t=>({v:1,name:t.name,kind:t.kind,at:Date.now(),items:t.items.map(i=>({n:i.n,no:i.no,i:i.i,q:i.q,f:i.f,l:i.l}))});
