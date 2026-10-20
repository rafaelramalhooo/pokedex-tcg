/* Telas de fichários. */
import {catalogCoverage, visibleSets} from '../catalog.js';
import {isOwned} from '../collection.js';
import {evalBinder, ruleChips, scopeIds} from '../rules.js';
import {S, soft} from '../state.js';
import {imgTag, noteHTML, sizeCtl} from '../ui.js';
import {$, $$, ICON, esc, fmtN, pct} from '../util.js';
import {slotHTML} from './set.js';
import {dexArt, dexName, loadDexNames, matchQuery, pad4, parseQuery} from './dex.js';
import {nz} from '../util.js';
import {bookHTML, isBook, renderBookCtl} from './book.js';

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
  const r=evalBinder(b);const own=r.dex?r.dex.filter(x=>x.owned).length:r.ids.filter(isOwned).length;const tot=r.dex?r.dex.length:r.ids.length;
  return`<a class="binder" href="#/binder/${esc(b.id)}"><div><h3>${esc(b.name)}</h3></div>
   <div class="chips" style="margin:0">${ruleChips(b)}</div>
   <div class="count"><strong>${fmtN(own)}</strong><span>de ${fmtN(tot)} ${r.dex?'espaços':'cartas'}</span></div>
   <div class="bar ${tot>0&&own>=tot?'done':''}"><i style="width:${pct(own,tot)}%"></i></div>
   ${r.pending?`<p>${fmtN(r.pending)} cartas ainda sem detalhes baixados.</p>`:''}</a>`;
 }).join('')}</div>`;
}
export function viewBinder(id){
 const b=S.binders.find(x=>x.id===id);
 S.ui.binderFilter='all';S.ui.binderShown=240;S.ui.binderQ='';
 if(!b){$('#view').innerHTML=`<a class="back" href="#/binders">${ICON.back} Fichários</a><div class="empty"><h3>Fichário não encontrado</h3></div>`;return;}
 S.cur={name:'binder',id,soft:renderBinderBody,refresh:renderBinderBody};
 $('#view').innerHTML=`<a class="back" href="#/binders">${ICON.back} Fichários</a>
  <div class="top"><div><h1 id="bname"></h1><div class="chips" id="bchips"></div></div>
  <div class="tools"><button class="btn" type="button" data-act="edit-binder" data-id="${esc(id)}">Editar regras</button>${b.mode==='manual'?`<button class="btn" type="button" data-act="add-cards" data-id="${esc(id)}">Adicionar cartas</button>`:''}<button class="btn danger" type="button" data-act="del-binder" data-id="${esc(id)}">Excluir</button></div></div>
  <div id="bsum"></div>
  <div class="toolbar"><div class="seg" role="group" aria-label="Filtro"><button type="button" data-act="bfilter" data-v="all" aria-pressed="true">Todas</button><button type="button" data-act="bfilter" data-v="have" aria-pressed="false">Tenho</button><button type="button" data-act="bfilter" data-v="miss" aria-pressed="false">Faltam</button></div><input class="field" id="bq" type="search" placeholder="Nome ou número. Ex.: charizard (006/165)" aria-label="Buscar no fichário"><span class="grow"></span><span class="bookctl" id="bookctl"></span></div>
  <div id="bgrid"></div>`;
 renderBookCtl();
 renderBinderBody();
}
const hasPoke=b=>b.mode==='rule'&&(b.conds||[]).some(c=>c.f==='pokemon'&&String(c.v).trim());
export function renderBinderBody(){
 if(!S.cur||S.cur.name!=='binder')return;
 const b=S.binders.find(x=>x.id===S.cur.id);if(!b)return;
 $('#bname').textContent=b.name;$('#bchips').innerHTML=ruleChips(b);
 $$('[data-act=bfilter]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.v===S.ui.binderFilter)));
 const r=evalBinder(b);
 const own=r.dex?r.dex.filter(x=>x.owned).length:r.ids.filter(isOwned).length,tot=r.dex?r.dex.length:r.ids.length;
 const cov=catalogCoverage();
 let notes='';
 if(r.pending)notes+=noteHTML('warn',`${fmtN(r.pending)} cartas ainda não têm detalhes baixados e ficam de fora desta regra. <a href="#/ajustes"><strong>Sincronizar o catálogo</strong></a> para completar.`);
 if(hasPoke(b)){
  const all=S.status.all,ids=S.status.ids;
  const missingSets=visibleSets().filter(s=>!S.setd[s.id]).length;
  const need=scopeIds(b);
  if(all)notes+=noteHTML('',`Procurando em todas as expansões: ${all.done} de ${all.total}.`);
  else if(ids)notes+=noteHTML('',`Baixando os detalhes das cartas deste Pokémon: ${ids.done} de ${ids.total}.`);
  else{
   if(missingSets)notes+=noteHTML('warn',`Este fichário só enxerga as ${visibleSets().length-missingSets} expansões já carregadas. <button class="btn small" data-act="load-all-lists" type="button">Procurar em todas as expansões (${fmtN(missingSets)} pedidos leves)</button>`);
   if(need.length)notes+=noteHTML('warn',`${fmtN(need.length)} cartas deste Pokémon ainda não têm detalhes (acabamentos, ilustrador…). <button class="btn small" data-act="load-scope" data-id="${esc(b.id)}" type="button">Baixar só estas ${fmtN(need.length)}</button>`);
  }
 }else if(cov.setsLoaded<cov.sets&&!r.dex)notes+=noteHTML('',`Só ${cov.setsLoaded} de ${cov.sets} expansões foram carregadas até agora; o fichário cresce conforme chegam.`);
 if(r.dex)loadDexNames();
 if(r.dex&&S.status.cl)notes+=noteHTML('',`Baixando os detalhes das cartas das suas expansões: ${S.status.cl.done} de ${S.status.cl.total}. Os espaços da Pokédex se completam à medida que chegam.`);
 $('#bsum').innerHTML=notes+`<div class="summary"><div><b>${fmtN(own)}</b><span>${r.dex?'espaços preenchidos':'cartas que você tem'}</span></div><div><b>${fmtN(Math.max(0,tot-own))}</b><span>faltam</span></div><div><b>${pct(own,tot)}%</b><span>concluído</span></div></div>`;
 const g=$('#bgrid');
 if(r.dex){
  const q=parseQuery(S.ui.binderQ);
  const list=r.dex.filter(x=>(S.ui.binderFilter==='all'||(S.ui.binderFilter==='have'?x.owned:!x.owned))&&slotMatches(x,q));
  S.cur.nav=list.filter(x=>x.rep).map(x=>({id:x.rep,dex:x.dex}));
  const shown=list.slice(0,S.ui.binderShown);
  if(list.length&&isBook()){g.innerHTML=bookHTML(list.map(x=>dexSlotHTML(x,b.id)),'binder:'+b.id+':'+S.ui.binderFilter);return;}
  g.innerHTML=list.length?`<div class="cards">${shown.map(x=>dexSlotHTML(x,b.id)).join('')}${list.length>shown.length?`<div class="more"><button class="btn" type="button" data-act="more">Mostrar mais (${fmtN(list.length-shown.length)} restantes)</button></div>`:''}</div>`
   :`<div class="empty"><h3>Nada por aqui</h3><p>Ajuste o filtro.</p></div>`;
  return;
 }
 const q=parseQuery(S.ui.binderQ);
 const list=r.ids.filter(id=>{const o=isOwned(id);if(!(S.ui.binderFilter==='all'||(S.ui.binderFilter==='have'?o:!o)))return false;return cardMatches(id,q);});
 if(!list.length){
  g.innerHTML=r.empty?`<div class="empty"><h3>Defina ao menos uma regra</h3><p>Use “Editar regras” para escolher o que entra neste fichário.</p></div>`:
  `<div class="empty"><h3>${b.mode==='manual'?'Nenhuma carta no fichário':'Nenhuma carta combina'}</h3><p>${b.mode==='manual'?'Use “Adicionar cartas” para escolher.':'Revise as regras ou sincronize o catálogo.'}</p></div>`;
  return;
 }
 S.cur.nav=list.map(id=>({id}));
 if(isBook()){g.innerHTML=bookHTML(list.map(id=>slotHTMLCtx(S.briefs[id]||{id,name:id,localId:''},b.id)),'binder:'+b.id+':'+S.ui.binderFilter);return;}
 const shown=list.slice(0,S.ui.binderShown);
 g.innerHTML=`<div class="cards">${shown.map(id=>{
  const br=S.briefs[id]||{id,name:id,localId:''};
  return slotHTMLCtx(br,b.id);
 }).join('')}${list.length>shown.length?`<div class="more"><button class="btn" type="button" data-act="more">Mostrar mais (${fmtN(list.length-shown.length)} restantes)</button></div>`:''}</div>`;
}
const noQ=q=>!q.words.length&&q.num===null&&q.tot===null;
function cardMatches(id,q){
 if(noQ(q))return true;
 const b=S.briefs[id]||{};const c=S.cards[id]||{};
 return matchQuery({id,name:b.name||c.name||id,localId:b.localId||'',setId:b.setId||c.set||''},q);
}
/* Na Pokédex: o número buscado é o da Pokédex; o nome é o do Pokémon; "(001/132)" procura entre as cartas do espaço. */
function slotMatches(x,q){
 if(noQ(q))return true;
 if(q.tot!==null)return x.cand.some(id=>cardMatches(id,q));
 if(q.num!==null&&q.num!==x.dex)return false;
 const nm=nz((x.name||dexName(x.dex))+' '+x.cand.map(id=>(S.briefs[id]||{}).name||'').join(' '));
 return q.words.every(w=>nm.includes(w));
}
export function dexSlotHTML(x,binderId){
 const nm=x.name||dexName(x.dex);
 const label=`Pokédex ${pad4(x.dex)}${nm?', '+nm:''}`;
 const attrs=`data-act="dex-open" data-dex="${x.dex}" data-binder="${esc(binderId)}" role="button" tabindex="0"`;
 if(!x.rep)return`<div class="slot off dexempty" ${attrs} aria-label="${esc(label)}, sem carta. Abrir a lista de cartas"><div class="pocket"><div class="dexph"><img alt="" loading="lazy" decoding="async" src="${dexArt(x.dex)}" data-role="dexart"><b>#${pad4(x.dex)}</b></div></div><div class="num dexname"><b>${esc(nm||'—')}</b></div></div>`;
 const c=S.cards[x.rep]||{};const br=S.briefs[x.rep]||{id:x.rep,name:c.name||x.rep,image:c.image};
 const on=x.owned;
 return`<div class="slot ${on?'on':'off'}" ${attrs} aria-label="${esc(label)}, ${on?'tenho':'não tenho'}. Abrir a lista de cartas">
  <div class="pocket">${imgTag(br.image,'low',br.name,undefined,br.id||x.rep)}<span class="dexno">#${pad4(x.dex)}</span></div>
  <div class="num"><b>${esc(nm||br.name)}</b><span>#${pad4(x.dex)}</span></div></div>`;
}
export function slotHTMLCtx(c,binderId){
 return slotHTML(c,null).replace('data-act="open"',`data-act="open" data-binder="${esc(binderId)}"`);
}
