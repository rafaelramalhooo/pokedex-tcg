/* Página pública de uma lista compartilhada: só leitura, sem login e sem nada do app. */
import {H, S} from '../state.js';
import {imgTag} from '../ui.js';
import {$, brl, esc, fmtN} from '../util.js';
import {flagHTML} from '../cardlabel.js';
import {fetchShared, sharingMissing} from '../cloud.js';
import {openExport} from '../exportimg.js';
import {finShort} from '../constants.js';
import {openPanel, setPublicItems} from './panel.js';
import {ensureCard} from '../catalog.js';
import {api} from '../api.js';

/* Links antigos não guardam o código da carta: ele sai do endereço da imagem da TCGdex. */
const pubId=it=>{
 if(it.id)return it.id;
 const m=/assets\.tcgdex\.net\/\w+\/[^/]+\/([^/]+)\/([^/#?]+)/.exec(it.i||'');
 return m?`${m[1]}-${m[2]}`:'';
};
function openPub(i){
 const it=cur&&cur.items[i];if(!it)return;
 const real=pubId(it);const id=real||'pub-'+i;
 if(!S.briefs[id])S.briefs[id]={id,name:it.n,image:it.i,localId:it.no,setId:real?real.slice(0,real.lastIndexOf('-')):''};
 if(!real&&!S.cards[id])S.cards[id]={id,name:it.n,image:it.i,localId:it.no,rvp:null};
 S.cur.nav=cur.items.map((x,k)=>({id:pubId(x)||'pub-'+k,tkey:'p'+k}));
 openPanel(id,{tradeId:'__pub',tradeKey:'p'+i,pub:true});
 if(real)ensureCard(id).then(async c=>{
  const sid=c&&c.set;
  if(sid&&!S.setMap[sid]){try{const d=await api('/sets/'+encodeURIComponent(sid),it.l==='en'?'en':'pt');S.setMap[sid]={id:sid,name:d.name||sid};}catch(e){S.setMap[sid]={id:sid,name:sid};}}
  if(S.ui.panelId===id&&H.renderPanel)H.renderPanel();
 }).catch(()=>{});
}
const KIND={sell:'Vendo / Troco',want:'Procuro'};
let cur=null;
const shell=inner=>`<div class="pubwrap">${inner}<p class="pubfoot">Lista compartilhada pelo app pessoal Pokemon TCG Gestão de Coleção. Dados e imagens: TCGdex. Não afiliado à The Pokémon Company.</p></div>`;
export async function viewShared(code){
 S.cur={name:'shared'};
 $('#view').innerHTML=shell('<h1>Lista compartilhada</h1><p class="lead">Carregando…</p>');
 let data=null,err='';
 try{data=await fetchShared(code);}
 catch(e){err=sharingMissing(e)?'Este endereço não está disponível.':'Não consegui abrir agora. Confira a conexão e tente de novo.';}
 if(!data||!Array.isArray(data.items)){
  $('#view').innerHTML=shell(`<h1>Lista não encontrada</h1><p class="lead">${esc(err||'Este link não existe ou a pessoa deixou de compartilhar a lista.')}</p>`);
  return;
 }
 cur=data;setPublicItems(data.items);
 const kind=data.kind==='want'?'want':'sell';
 const total=data.items.reduce((a,i)=>a+(+i.q||0),0);
 const priced=data.items.filter(i=>typeof i.p==='number');
 const sum=priced.reduce((a,i)=>a+i.p*(+i.q||0),0);
 document.title=`${data.name||'Lista'} · lista compartilhada`;
 $('#view').innerHTML=shell(`<div class="top"><div><h1>${esc(data.name||'Lista')}</h1>
  <div class="chips"><span class="ttag ${kind}">${KIND[kind]}</span> <span class="lead" style="margin:0">${fmtN(data.items.length)} carta${data.items.length===1?'':'s'} · ${fmtN(total)} unidade${total===1?'':'s'}</span>${priced.length?` <span class="ttag fmt">Total ${esc(brl(Math.round(sum*100)/100))}</span>`:''}</div></div>
  <div class="tools"><button class="btn primary" type="button" data-act="pub-export">Salvar como imagem</button></div></div>
  <div class="cards">${data.items.map((it,idx)=>{
   const tag=[finShort(it.f),it.l&&it.l!=='xx'?String(it.l).toUpperCase():'',it.c?String(it.c):''].filter(Boolean).join(' · ');
   return`<div class="slot on tradeslot" data-act="pub-open" data-i="${idx}" role="button" tabindex="0" aria-label="${esc(it.n)}. Ver detalhes"><div class="pocket">${imgTag(it.i,'low',it.n)}<span class="qty tq">×${esc(it.q)}</span></div>
    <div class="num"><b>${esc(it.n)}</b><span>${esc(it.no)} ${flagHTML(it.l||'xx')}</span></div>${tag?`<div class="num"><span>${esc(tag)}</span></div>`:''}${typeof it.p==='number'?`<div class="num"><b class="tprice">${esc(brl(it.p))}</b></div>`:''}</div>`;}).join('')}</div>`);
}
export const SHARED_ACT={
 'pub-open':t=>openPub(+t.dataset.i),
 'pub-export':()=>{
  if(!cur)return;
  openExport({title:cur.name||'Lista',kindLabel:KIND[cur.kind==='want'?'want':'sell'],kindColor:cur.kind==='want'?'#2F6FDE':'#D93A2B',scopes:null,extras:{p:cur.items.some(i=>typeof i.p==='number'),c:cur.items.some(i=>i.c),on:true},
   build:()=>cur.items.map(it=>({url:it.i?it.i+'/high.webp':'',n:it.n,no:it.no,q:it.q,f:it.f,l:it.l,...(it.c?{c:it.c}:{}),...(typeof it.p==='number'?{p:it.p}:{})}))});
 }
};
