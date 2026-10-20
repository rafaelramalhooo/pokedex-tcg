/* Telas de fichários. */
import {catalogCoverage} from '../catalog.js';
import {isOwned} from '../collection.js';
import {evalBinder, ruleChips} from '../rules.js';
import {S, soft} from '../state.js';
import {noteHTML, sizeCtl} from '../ui.js';
import {$, $$, ICON, esc, fmtN, pct} from '../util.js';
import {slotHTML} from './set.js';

export function viewBinders(){
 S.cur={name:'binders',soft:renderBinders,refresh:renderBinders};
 $('#view').innerHTML=`<div class="top"><div><h1>Fichários</h1><p class="lead">Coleções suas, montadas por regras (tipo, Pokémon, ilustrador, raridade, expansão, Standard e outras) ou escolhidas carta a carta.</p></div>
  <div class="tools"><button class="btn primary" type="button" data-act="new-binder">Novo fichário</button></div></div><div id="bbody"></div>`;
 renderBinders();
}
export function renderBinders(){
 const el=$('#bbody');if(!el)return;
 if(!S.binders.length){
  el.innerHTML=`<div class="empty"><h3>Você ainda não tem fichários</h3><p>Crie o primeiro. Por exemplo: todas as cartas de Fogo ilustradas por um artista que você gosta, ou só as cartas legais no Standard.</p><button class="btn primary" type="button" data-act="new-binder">Criar fichário</button></div>`;
  return;
 }
 el.innerHTML=`<div class="binders">${S.binders.map(b=>{
  const r=evalBinder(b);const own=r.ids.filter(isOwned).length;const tot=r.ids.length;
  return`<a class="binder" href="#/binder/${esc(b.id)}"><div><h3>${esc(b.name)}</h3></div>
   <div class="chips" style="margin:0">${ruleChips(b)}</div>
   <div class="count"><strong>${fmtN(own)}</strong><span>de ${fmtN(tot)} cartas</span></div>
   <div class="bar ${tot>0&&own>=tot?'done':''}"><i style="width:${pct(own,tot)}%"></i></div>
   ${r.pending?`<p>${fmtN(r.pending)} cartas ainda sem detalhes baixados.</p>`:''}</a>`;
 }).join('')}</div>`;
}
export function viewBinder(id){
 const b=S.binders.find(x=>x.id===id);
 S.ui.binderFilter='all';S.ui.binderShown=240;
 if(!b){$('#view').innerHTML=`<a class="back" href="#/binders">${ICON.back} Fichários</a><div class="empty"><h3>Fichário não encontrado</h3></div>`;return;}
 S.cur={name:'binder',id,soft:renderBinderBody,refresh:renderBinderBody};
 $('#view').innerHTML=`<a class="back" href="#/binders">${ICON.back} Fichários</a>
  <div class="top"><div><h1 id="bname"></h1><div class="chips" id="bchips"></div></div>
  <div class="tools"><button class="btn" type="button" data-act="edit-binder" data-id="${esc(id)}">Editar regras</button>${b.mode==='manual'?`<button class="btn" type="button" data-act="add-cards" data-id="${esc(id)}">Adicionar cartas</button>`:''}<button class="btn danger" type="button" data-act="del-binder" data-id="${esc(id)}">Excluir</button></div></div>
  <div id="bsum"></div>
  <div class="toolbar"><div class="seg" role="group" aria-label="Filtro"><button type="button" data-act="bfilter" data-v="all" aria-pressed="true">Todas</button><button type="button" data-act="bfilter" data-v="have" aria-pressed="false">Tenho</button><button type="button" data-act="bfilter" data-v="miss" aria-pressed="false">Faltam</button></div><span class="grow"></span>${sizeCtl()}</div>
  <div id="bgrid"></div>`;
 renderBinderBody();
}
export function renderBinderBody(){
 if(!S.cur||S.cur.name!=='binder')return;
 const b=S.binders.find(x=>x.id===S.cur.id);if(!b)return;
 $('#bname').textContent=b.name;$('#bchips').innerHTML=ruleChips(b);
 $$('[data-act=bfilter]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.v===S.ui.binderFilter)));
 const r=evalBinder(b);
 const own=r.ids.filter(isOwned).length,tot=r.ids.length;
 const cov=catalogCoverage();
 let notes='';
 if(r.pending)notes+=noteHTML('warn',`${fmtN(r.pending)} cartas ainda não têm detalhes baixados e ficam de fora desta regra. <a href="#/ajustes"><strong>Sincronizar o catálogo</strong></a> para completar.`);
 if(cov.setsLoaded<cov.sets)notes+=noteHTML('',`Só ${cov.setsLoaded} de ${cov.sets} expansões foram carregadas até agora; o fichário cresce conforme chegam.`);
 $('#bsum').innerHTML=notes+`<div class="summary"><div><b>${fmtN(own)}</b><span>cartas que você tem</span></div><div><b>${fmtN(Math.max(0,tot-own))}</b><span>faltam</span></div><div><b>${pct(own,tot)}%</b><span>concluído</span></div></div>`;
 const list=r.ids.filter(id=>{const o=isOwned(id);return S.ui.binderFilter==='all'||(S.ui.binderFilter==='have'?o:!o);});
 const g=$('#bgrid');
 if(!list.length){
  g.innerHTML=r.empty?`<div class="empty"><h3>Defina ao menos uma regra</h3><p>Use “Editar regras” para escolher o que entra neste fichário.</p></div>`:
  `<div class="empty"><h3>${b.mode==='manual'?'Nenhuma carta no fichário':'Nenhuma carta combina'}</h3><p>${b.mode==='manual'?'Use “Adicionar cartas” para escolher.':'Revise as regras ou sincronize o catálogo.'}</p></div>`;
  return;
 }
 const shown=list.slice(0,S.ui.binderShown);
 g.innerHTML=`<div class="cards">${shown.map(id=>{
  const br=S.briefs[id]||{id,name:id,localId:''};
  return slotHTMLCtx(br,b.id);
 }).join('')}${list.length>shown.length?`<div class="more"><button class="btn" type="button" data-act="more">Mostrar mais (${fmtN(list.length-shown.length)} restantes)</button></div>`:''}</div>`;
}
export function slotHTMLCtx(c,binderId){
 return slotHTML(c,null).replace('data-act="open"',`data-act="open" data-binder="${esc(binderId)}"`);
}
