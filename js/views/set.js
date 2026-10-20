/* Tela de uma expansão. */
import {ensureSetCards, ensureSetd} from '../catalog.js';
import {groupBySet, isOfficialNo, isOwned, ownedQty, setStat} from '../collection.js';
import {FIN_LABEL} from '../constants.js';
import {H, S, soft} from '../state.js';
import {logoImg} from '../logos.js';
import {imgTag, modeSeg, noteHTML, sizeCtl} from '../ui.js';
import {bookHTML, isBook, renderBookCtl} from './book.js';
import {$, $$, ICON, esc, fmtDate, fmtN, nz, pct} from '../util.js';

export async function viewSet(id){
 S.cur={name:'set',id,soft:()=>{renderSetHero();renderSetGrid();},refresh:()=>{renderSetHero();renderSetGrid();}};
 S.ui.setFilter='all';S.ui.setQ='';
 $('#view').innerHTML=`<a class="back" href="#/">${ICON.back} Todas as expansões</a><div id="sethero"><div class="skel" style="height:130px"></div></div><div id="settools"></div><div id="grid"></div>`;
 try{await ensureSetd(id);}
 catch(e){
  $('#sethero').innerHTML=noteHTML('err',`Não consegui carregar esta expansão (${esc(e.message||'erro')}). <button class="btn small" data-act="reload-set" type="button">Tentar de novo</button>`);
  return;
 }
 if(!S.cur||S.cur.id!==id)return;
 $('#settools').innerHTML=`<div class="toolbar">${modeSeg()}
  <div class="seg" role="group" aria-label="Filtro"><button type="button" data-act="sfilter" data-v="all" aria-pressed="true">Todas</button><button type="button" data-act="sfilter" data-v="have" aria-pressed="false">Tenho</button><button type="button" data-act="sfilter" data-v="miss" aria-pressed="false">Faltam</button></div>
  <input class="field" id="sq" type="search" placeholder="Nome ou número" aria-label="Buscar carta">
  <span class="grow"></span><span class="bookctl" id="bookctl"></span></div><div id="setnote"></div>`;
 renderBookCtl();
 renderSetHero();renderSetGrid();
 if(S.settings.mode==='master')ensureSetCards(id);
}
export function renderSetHero(){
 const el=$('#sethero');if(!el||!S.cur||S.cur.name!=='set')return;
 const id=S.cur.id;const set=S.setMap[id]||{id,name:id};const d=S.setd[id];if(!d)return;
 const st=setStat(set,groupBySet());
 const se=S.serieOf[id]||(d.serie&&{name:d.serie.name});
 const m=S.settings.mode;
 const logo=logoImg({...d,...set,id,name:d.name,logo:d.logo||set.logo});
 const stat=(k,label,own,tot)=>`<button type="button" class="hstat ${m===k?'active':''}" data-act="mode" data-v="${k}" style="background:none;border:0;text-align:left;cursor:pointer;padding:0"><div class="lbl">${label}</div><div class="count"><strong>${fmtN(own)}</strong><span>${tot==null?'de …':'de '+fmtN(tot)}</span></div><div class="bar ${tot>0&&own>=tot?'done':''}"><i style="width:${pct(own,tot)}%"></i></div></button>`;
 el.innerHTML=`<div class="hero">
  <div class="hlogo">${logo}</div>
  <div class="htext"><h1 style="font-size:clamp(26px,3vw,36px)">${esc(d.name)}</h1>
   <p class="lead" style="margin-top:4px">${se?esc(se.name)+'. ':''}${d.releaseDate?'Lançada em '+fmtDate(d.releaseDate)+'. ':''}${fmtN(st.total)} cartas no total, ${fmtN(st.tot)} numeradas.</p></div>
  <div class="hstats">${stat('set','Set (cartas numeradas)',st.own,st.tot)}${stat('master','Master Set',st.ownM,st.masterTot)}</div></div>`;
}
export function renderSetGrid(){
 const g=$('#grid');if(!g||!S.cur||S.cur.name!=='set')return;
 const id=S.cur.id;const d=S.setd[id];if(!d)return;
 const mode=S.settings.mode;
 $$('[data-act=mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.v===mode)));
 $$('[data-act=sfilter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.v===S.ui.setFilter)));
 const official=(d.cardCount&&d.cardCount.official)||0;
 const q=nz(S.ui.setQ);
 const cards=(d.cards||[]).slice();
 const note=$('#setnote');
 const load=S.setLoad[id];
 if(note){
  if(mode==='master'&&load)note.innerHTML=noteHTML('',`Baixando os detalhes das cartas para montar o Master Set: ${load.done} de ${load.total}.`);
  else if(mode==='master'&&cards.some(c=>!S.cards[c.id]))note.innerHTML=noteHTML('warn',`Algumas cartas ainda não têm detalhes de acabamento. <button class="btn small" data-act="load-set-cards" type="button">Baixar agora</button>`);
  else note.innerHTML='';
 }
 const slots=[];
 cards.forEach(c=>{
  const fin=[];
  if(mode==='master'){
   const full=S.cards[c.id];
   if(full&&full.variants){
    if(full.variants.normal)fin.push('normal');
    if(full.variants.holo)fin.push('holo');
    if(full.variants.reverse&&S.settings.masterReverse)fin.push('reverse');
    if(!fin.length)fin.push('normal');
   }else fin.push('normal');
  }
  const sec=!isOfficialNo(String(c.localId),official);
  (mode==='master'?fin:[null]).forEach(f=>slots.push({c,f,sec}));
 });
 const filtered=slots.filter(({c,f})=>{
  if(q&&!nz(c.name).includes(q)&&!nz(c.localId).includes(q))return false;
  const own=f?!!(S.collection[c.id]&&S.collection[c.id].f[f]&&S.collection[c.id].f[f].q>0):isOwned(c.id);
  if(S.ui.setFilter==='have'&&!own)return false;
  if(S.ui.setFilter==='miss'&&own)return false;
  return true;
 });
 if(!filtered.length){g.innerHTML=`<div class="empty"><h3>Nenhuma carta aqui</h3><p>${S.ui.setFilter==='have'?'Você ainda não marcou cartas desta expansão.':'Ajuste o filtro ou a busca.'}</p></div>`;return;}
 S.cur.nav=filtered.filter((x,i)=>!i||x.c.id!==filtered[i-1].c.id).map(x=>({id:x.c.id}));
 if(isBook()){g.innerHTML=bookHTML(filtered.map(({c,f})=>slotHTML(c,f)),'set:'+id+':'+mode);return;}
 let html='<div class="cards">';let secShown=false;
 filtered.forEach(({c,f,sec})=>{
  if(sec&&!secShown){secShown=true;html+=`<div class="divider">Cartas secretas, numeradas acima de ${official}</div>`;}
  html+=slotHTML(c,f);
 });
 g.innerHTML=html+'</div>';
}
export function slotHTML(c,fin){
 const e=S.collection[c.id];
 const q=fin?(e&&e.f[fin]?e.f[fin].q:0):ownedQty(c.id);
 const on=q>0;
 const chip=fin&&fin!=='normal'?`<span class="chip ${fin==='reverse'?'R':'H'}">${fin==='reverse'?'Reverse':'Holo'}</span>`:'';
 return `<div class="slot ${on?'on':'off'}" data-act="open" data-id="${esc(c.id)}" role="button" tabindex="0" aria-label="${esc(c.name)}, número ${esc(c.localId)}${fin?', '+FIN_LABEL[fin]:''}, ${on?'tenho':'não tenho'}">
  <div class="pocket">${imgTag(c.image,'low',c.name)}${chip}${q>1?`<span class="qty">×${q}</span>`:''}
   <button type="button" class="tg" data-act="tog" data-id="${esc(c.id)}" ${fin?`data-fin="${fin}"`:''} aria-label="${on?'Remover da coleção':'Marcar como tenho'}">${ICON.check}</button></div>
  <div class="num"><b>${esc(c.name)}</b><span>${esc(c.localId)}</span></div></div>`;
}
