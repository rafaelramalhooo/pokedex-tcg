/* Tela de uma coleção. */
import {ensureSetCards, ensureSetd} from '../catalog.js';
import {groupBySet, isOfficialNo, isOwned, ownedQty, setStat} from '../collection.js';
import {FIN_LABEL, finShort, isReverseFin, patFin} from '../constants.js';
import {H, S, soft} from '../state.js';
import {logoImg} from '../logos.js';
import {customLogo} from '../custom.js';
import {imgTag, modeSeg, noteHTML, sizeCtl} from '../ui.js';
import {modeOf} from '../modes.js';
import {capRight} from '../cardlabel.js';
import {bookHTML, isBook, renderBookCtl} from './book.js';
import {saveSettings} from '../db.js';
import {$, $$, live, ICON, esc, fmtDate, fmtN, nz, pct} from '../util.js';
import {matchQuery, parseQuery} from './dex.js';

export async function viewSet(id){
 S.cur={name:'set',id,ready:false,soft:()=>{renderSetHero();renderSetGrid();},refresh:()=>{renderSetHero();renderSetGrid();}};
 S.ui.setFilter='all';S.ui.setQ='';
 $('#view').innerHTML=`<a class="back" href="#/">${ICON.back} Todas as coleções</a><div id="sethero"><div class="skel" style="height:130px"></div></div><div id="settools"></div><div id="grid"></div>`;
 try{await ensureSetd(id);}
 catch(e){
  $('#sethero').innerHTML=noteHTML('err',`Não consegui carregar esta coleção (${esc(e.message||'erro')}). <button class="btn small" data-act="reload-set" type="button">Tentar de novo</button>`);
  return;
 }
 if(!S.cur||S.cur.id!==id)return;
 $('#settools').innerHTML=`<div class="toolbar">${modeSeg()}
  <div class="seg" role="group" aria-label="Filtro"><button type="button" data-act="sfilter" data-v="all" aria-pressed="true">Todas</button><button type="button" data-act="sfilter" data-v="have" aria-pressed="false">Tenho</button><button type="button" data-act="sfilter" data-v="miss" aria-pressed="false">Faltam</button></div>
  <input class="field" id="sq" type="search" placeholder="Nome ou número. Ex.: charizard (006/165)" aria-label="Buscar carta"><span class="fullctl" id="fullctl"></span>
  <span class="grow"></span><span class="bookctl" id="bookctl"></span></div><div id="setnote"></div>`;
 renderBookCtl();
 renderSetHero();renderSetGrid();S.cur.ready=true;
 if(modeOf(id)==='master')ensureSetCards(id);
}
export function renderSetHero(){
 const el=live($('#sethero'));if(!el||!S.cur||S.cur.name!=='set')return;
 const id=S.cur.id;const set=S.setMap[id]||{id,name:id};const d=S.setd[id];if(!d)return;
 const st=setStat(set,groupBySet());
 const se=S.serieOf[id]||(d.serie&&{name:d.serie.name});
 const m=modeOf(id);
 const logo=logoImg({...d,...set,id,name:d.name,logo:d.logo||set.logo});
 const stat=(k,label,own,tot,part)=>`<button type="button" class="hstat ${m===k?'active':''}" data-act="mode" data-v="${k}" style="background:none;border:0;text-align:left;cursor:pointer;padding:0"><div class="lbl">${label}</div><div class="count"><strong>${fmtN(own)}</strong><span>${tot==null?'de …':'de '+fmtN(tot)+(part?'+':'')}</span></div><div class="bar ${tot>0&&own>=tot?'done':''}"><i style="width:${pct(own,tot)}%"></i></div></button>`;
 el.innerHTML=`<div class="hero">
  <div class="hlogo">${logo}</div>
  <div class="htext"><h1 style="font-size:clamp(26px,3vw,36px)">${esc(d.name)}</h1>
   <p class="lead" style="margin-top:4px">${se?esc(se.name)+'. ':''}${d.releaseDate?'Lançada em '+fmtDate(d.releaseDate)+'. ':''}${fmtN(st.total)} cartas no total, ${fmtN(st.tot)} numeradas.</p></div>
  <div class="hstats">${stat('set','Set (cartas numeradas)',st.own,st.tot)}${stat('master','Master Set',st.ownM,st.masterTot,st.masterPartial&&S.settings.masterPatterns!==false)}</div></div>`;
}
export function renderSetGrid(){
 const g=live($('#grid'));if(!g||!S.cur||S.cur.name!=='set')return;
 const id=S.cur.id;const d=S.setd[id];if(!d)return;
 const mode=modeOf(id);
 $$('[data-act=mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.v===mode)));
 $$('[data-act=sfilter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.v===S.ui.setFilter)));
 const official=(d.cardCount&&d.cardCount.official)||0;
 const q=parseQuery(S.ui.setQ);const hasQ=q.words.length||q.num!==null||q.tot!==null;
 const cards=(d.cards||[]).slice();
 const note=$('#setnote');
 const load=S.setLoad[id];
 if(note){
  if(mode==='master'&&load)note.innerHTML=noteHTML('',`Baixando os detalhes das cartas para montar o Master Set: ${load.done} de ${load.total}.`);
  else if(mode==='master'&&cards.some(c=>!S.cards[c.id]||(S.settings.masterPatterns!==false&&S.cards[c.id].rvp===undefined)))note.innerHTML=noteHTML('warn',`Algumas cartas ainda não têm detalhes de acabamento. <button class="btn small" data-act="load-set-cards" type="button">Baixar agora</button>`);
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
    if(S.settings.masterPatterns!==false)(full.rvp||[]).forEach(p=>fin.push(patFin(p)));
    if(!fin.length)fin.push('normal');
   }else fin.push('normal');
  }
  const sec=!isOfficialNo(String(c.localId),official);
  (mode==='master'?fin:[null]).forEach(f=>slots.push({c,f,sec}));
 });
 const filtered=slots.filter(({c,f})=>{
  if(hasQ&&!matchQuery({...c,setId:id},q))return false;
  const own=f?!!(S.collection[c.id]&&S.collection[c.id].f[f]&&S.collection[c.id].f[f].q>0):isOwned(c.id);
  if(S.ui.setFilter==='have'&&!own)return false;
  if(S.ui.setFilter==='miss'&&own)return false;
  return true;
 });
 if(!filtered.length){g.innerHTML=`<div class="empty"><h3>Nenhuma carta aqui</h3><p>${S.ui.setFilter==='have'?'Você ainda não marcou cartas desta coleção.':'Ajuste o filtro ou a busca.'}</p></div>`;return;}
 S.cur.nav=filtered.filter((x,i)=>!i||x.c.id!==filtered[i-1].c.id).map(x=>({id:x.c.id}));
 if(isBook()&&!hasQ){g.innerHTML=bookHTML(filtered.map(({c,f})=>slotHTML(c,f)),'set:'+id+':'+mode,setCover(id));return;}
 let html=`<div class="cards"${hasQ?' style="--tile:230px"':''}>`;let secShown=false;
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
 const chip=fin&&fin!=='normal'?`<span class="chip ${isReverseFin(fin)?'R':'H'}">${finShort(fin)}</span>`:'';
 return `<div class="slot ${on?'on':'off'}" data-act="open" data-id="${esc(c.id)}" role="button" tabindex="0" aria-label="${esc(c.name)}, número ${esc(c.localId)}${fin?', '+FIN_LABEL[fin]:''}, ${on?'tenho':'não tenho'}">
  <div class="pocket">${imgTag(c.image,'low',c.name,undefined,c.id)}${chip}${q>1?`<span class="qty">×${q}</span>`:''}
   <button type="button" class="tg" data-act="tog" data-id="${esc(c.id)}" ${fin?`data-fin="${fin}"`:''} aria-label="${on?'Remover da coleção':'Marcar como tenho'}">${ICON.check}</button></div>
  <div class="num"><b>${esc(c.name)}</b>${capRight(c)}</div></div>`;
}

/* Capa do fichário desta coleção: o logo (padrão) ou a arte de uma carta que você escolher. */
function setCover(id){
 const d=S.setd[id]||{};const set=S.setMap[id]||{id,name:id};
 const pick=S.settings.setCover&&S.settings.setCover[id];
 if(pick){
  const c=(d.cards||[]).find(x=>x.id===pick);const img=c&&(c.image||(S.cards[pick]&&S.cards[pick].image));
  if(img)return{html:imgTag(img,'high',c.name,undefined,pick),title:'',cls:'cov-card'};
 }
 return{html:`<div class="cvlogo">${logoImg({...d,...set,id,name:d.name||set.name,logo:d.logo||set.logo})}</div>`,title:'',cls:'cov-logo'};
}
export function openSetCover(){
 const id=S.cur&&S.cur.name==='set'&&S.cur.id;const d=id&&S.setd[id];if(!d)return;
 const pick=S.settings.setCover&&S.settings.setCover[id];
 const cards=(d.cards||[]).filter(c=>c.image);
 $('#dialog').innerHTML=`<h2>Capa do fichário</h2>
  <p class="lead">Por padrão a capa mostra o logo da coleção. Se preferir, escolha a arte de uma das cartas.</p>
  <div class="row" style="margin-bottom:10px"><button type="button" class="btn ${pick?'':'primary'}" data-act="set-cover-pick" data-id="">Usar o logo da coleção</button></div>
  <div class="covgrid">${cards.map(c=>`<button type="button" class="covc ${pick===c.id?'sel':''}" data-act="set-cover-pick" data-id="${esc(c.id)}" aria-label="${esc(c.name)}" aria-pressed="${pick===c.id}">${imgTag(c.image,'low',c.name,undefined,c.id)}</button>`).join('')||'<p class="lead">Esta coleção ainda não tem imagens de cartas.</p>'}</div>
  <div class="actions"><span></span><button class="btn" type="button" data-ed-act="cancel">Fechar</button></div>`;
 $('#modal').classList.add('on');
}
export function pickSetCover(cardId){
 const id=S.cur&&S.cur.name==='set'&&S.cur.id;if(!id)return;
 S.settings.setCover=S.settings.setCover||{};
 if(cardId)S.settings.setCover[id]=cardId;else delete S.settings.setCover[id];
 saveSettings();
 $('#modal').classList.remove('on');
 if(S.cur.refresh)S.cur.refresh();
}
