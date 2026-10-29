/* Telas de fichários. */
import {catalogCoverage, visibleSets} from '../catalog.js';
import {isOwned} from '../collection.js';
import {SORTS, evalBinder, ruleChips, scopeIds} from '../rules.js';
import {AUTO_MAX, autoResolve} from '../remote.js';
import {bookCover, coverHTML} from '../covers.js';
import {saveBinders} from '../db.js';
import {S, soft} from '../state.js';
import {imgTag, noteHTML, sizeCtl} from '../ui.js';
import {customCard} from '../custom.js';
import {imgOf, snapOf} from '../trades.js';
import {openExport} from '../exportimg.js';
import {$, $$, live, ICON, esc, fmtN, pct} from '../util.js';
import {slotHTML} from './set.js';
import {dexArt, dexName, loadDexNames, matchQuery, pad4, parseQuery} from './dex.js';
import {nz} from '../util.js';
import {ffActive, ffMatch, ffReset, ffSig, renderBar} from '../filters.js';
import {capRight, numLabel} from '../cardlabel.js';
import {rarityPt, typePt} from '../constants.js';
import {bookHTML, isBook, renderBookCtl} from './book.js';

export function viewBinders(){
 S.cur={name:'binders',soft:renderBinders,refresh:renderBinders};
 $('#view').innerHTML=`<div class="top"><div><h1>Fichários</h1><p class="lead">Coleções suas, montadas por regras (tipo, Pokémon, ilustrador, raridade, coleção, Standard e outras) ou escolhidas carta a carta.</p></div>
  <div class="tools"><button class="btn primary" type="button" data-act="new-binder">Novo fichário</button></div></div><div id="bbody"></div>`;
 renderBinders();
}
export function renderBinders(){
 const el=live($('#bbody'));if(!el)return;
 if(!S.binders.length){
  el.innerHTML=`<div class="empty"><h3>Você ainda não tem fichários</h3><p>Crie o primeiro. Por exemplo: todas as cartas de Fogo ilustradas por um artista que você gosta, ou só as cartas legais no Standard.</p><button class="btn primary" type="button" data-act="new-binder">Criar fichário</button></div>`;
  return;
 }
 el.innerHTML=`<div class="binders">${S.binders.map(b=>{
  const r=evalBinder(b);const own=r.dex?r.dex.filter(x=>x.owned).length:r.ids.filter(isOwned).length;const tot=r.dex?r.dex.length:r.ids.length;
  return`<a class="binder" href="#/binder/${esc(b.id)}"><span class="cover">${coverHTML(b)}</span><div class="bmeta"><h3>${esc(b.name)}</h3>
   <div class="chips" style="margin:0">${ruleChips(b)}</div>
   <div class="count"><strong>${fmtN(own)}</strong><span>de ${fmtN(tot)} ${r.dex?'espaços':'cartas'}</span></div>
   <div class="bar ${tot>0&&own>=tot?'done':''}"><i style="width:${pct(own,tot)}%"></i></div></div></a>`;
 }).join('')}</div>`;
}
export function viewBinder(id){
 const b=S.binders.find(x=>x.id===id);
 S.ui.binderFilter='all';S.ui.binderShown=240;S.ui.binderQ='';ffReset();
 if(!b){$('#view').innerHTML=`<a class="back" href="#/binders">${ICON.back} Fichários</a><div class="empty"><h3>Fichário não encontrado</h3></div>`;return;}
 S.cur={name:'binder',id,soft:renderBinderBody,refresh:renderBinderBody};
 $('#view').innerHTML=`<a class="back" href="#/binders">${ICON.back} Fichários</a>
  <div class="top"><div><h1 id="bname"></h1><div class="chips" id="bchips"></div></div>
  <div class="tools"><button class="btn" type="button" data-act="binder-export" data-id="${esc(id)}">Exportar imagem</button><button class="btn" type="button" data-act="edit-binder" data-id="${esc(id)}">Editar regras</button>${b.mode==='manual'?`<button class="btn" type="button" data-act="add-cards" data-id="${esc(id)}">Adicionar cartas</button>`:''}<button class="btn danger" type="button" data-act="del-binder" data-id="${esc(id)}">Excluir</button></div></div>
  <div id="bsum"></div>
  <div class="toolbar"><div class="seg" role="group" aria-label="Filtro"><button type="button" data-act="bfilter" data-v="all" aria-pressed="true">Todas</button><button type="button" data-act="bfilter" data-v="have" aria-pressed="false">Tenho</button><button type="button" data-act="bfilter" data-v="miss" aria-pressed="false">Faltam</button></div><input class="field" id="bq" type="search" placeholder="Nome ou número. Ex.: charizard (006/165)" aria-label="Buscar no fichário"><span class="fullctl" id="fullctl"></span><span class="sortctl" id="bsortctl"></span><span class="grow"></span><span class="bookctl" id="bookctl"></span></div>
  <div id="ffbar"></div>
  <div id="bgrid"></div>`;
 renderBookCtl();
 renderSortCtl(b);
 renderBinderBody();
}
/* Cartões de resumo: progresso com anel e, quando há detalhes, divisão por tipo e por raridade. */
function breakdown(ids,keyFn,limit){
 const m=new Map();
 ids.forEach(id=>{const k=keyFn(id);if(!k)return;const e=m.get(k)||{own:0,tot:0};e.tot++;if(isOwned(id))e.own++;m.set(k,e);});
 return[...m.entries()].sort((a,b)=>b[1].tot-a[1].tot).slice(0,limit);
}
const barsHTML=rows=>rows.map(([k,e])=>`<div class="mini"><span class="mk">${esc(k)}</span><span class="mb"><i style="width:${pct(e.own,e.tot)}%"></i></span><span class="mv">${fmtN(e.own)}/${fmtN(e.tot)}</span></div>`).join('');
function statsHTML(r,own,tot){
 const p=pct(own,tot);
 let h=`<div class="stats"><div class="stat ring"><div class="rg" style="--p:${p}"><b>${p}%</b></div><div><b class="big">${fmtN(own)}</b><span>${r.dex?'espaços preenchidos':'tenho'} de ${fmtN(tot)}</span><span>${fmtN(Math.max(0,tot-own))} faltam</span></div></div>`;
 if(!r.dex&&r.ids.length){
  const tp=breakdown(r.ids,id=>{const c=S.cards[id];return c&&c.types&&typePt(c.types[0]);},6);
  const rr=breakdown(r.ids,id=>{const c=S.cards[id];return c&&rarityPt(c.rarity);},5);
  if(tp.length)h+=`<div class="stat"><span class="lbl2">Por tipo</span>${barsHTML(tp)}</div>`;
  if(rr.length)h+=`<div class="stat"><span class="lbl2">Por raridade</span>${barsHTML(rr)}</div>`;
 }
 return h+'</div>';
}
export function sortCtlHTML(b){
 if(b.mode==='pokedex')return'';
 const sp=b.sort||{f:'default',dir:'asc'};
 return`<label class="size">Ordenar <select class="field" data-bsort="f" aria-label="Ordenar por">${SORTS.map(([k,l])=>`<option value="${k}" ${sp.f===k||(!sp.f&&k==='default')?'selected':''}>${l}</option>`).join('')}</select></label><button type="button" class="btn small" data-act="bsortdir" aria-label="Direção: ${sp.dir==='desc'?'decrescente':'crescente'}" title="${sp.dir==='desc'?'Decrescente':'Crescente'}">${sp.dir==='desc'?'↓ Decrescente':'↑ Crescente'}</button>`;
}
export function renderSortCtl(b){const el=$('#bsortctl');if(el)el.innerHTML=sortCtlHTML(b);}
export function setBinderSort(patch){
 if(!S.cur||S.cur.name!=='binder')return;
 const b=S.binders.find(x=>x.id===S.cur.id);if(!b)return;
 b.sort={f:'default',dir:'asc',...(b.sort||{}),...patch};
 saveBinders();S.ui.page=0;renderSortCtl(b);renderBinderBody();
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
 if(b.mode==='rule'){
  autoResolve(r);
  if(r.loading)notes+=noteHTML('','Consultando a TCGdex para montar o fichário…');
  else if(r.failed)notes+=noteHTML('warn','Não consegui consultar a TCGdex agora, então algumas cartas podem faltar. <button class="btn small" type="button" data-act="retry-remote">Tentar de novo</button>');
  if(S.status.rule)notes+=noteHTML('',`Conferindo os detalhes de ${fmtN(S.status.rule.total)} cartas… ${fmtN(S.status.rule.done)} prontas.`);
  else if(r.pending>AUTO_MAX)notes+=noteHTML('warn',`Esta regra depende de detalhes que ainda não foram baixados para ${fmtN(r.pending)} cartas, e elas ficam de fora por enquanto. <button class="btn small" type="button" data-act="load-pending" data-id="${esc(b.id)}">Baixar esses detalhes</button>`);
 }
 if(hasPoke(b)){
  const all=S.status.all,ids=S.status.ids;
  const missingSets=visibleSets().filter(s=>!S.setd[s.id]).length;
  const need=scopeIds(b);
  if(all)notes+=noteHTML('',`Procurando em todas as coleções: ${all.done} de ${all.total}.`);
  else if(ids)notes+=noteHTML('',`Baixando os detalhes das cartas deste Pokémon: ${ids.done} de ${ids.total}.`);
  else{
   if(missingSets)notes+=noteHTML('warn',`Este fichário só enxerga as ${visibleSets().length-missingSets} coleções já carregadas. <button class="btn small" data-act="load-all-lists" type="button">Procurar em todas as coleções (${fmtN(missingSets)} pedidos leves)</button>`);
   if(need.length)notes+=noteHTML('warn',`${fmtN(need.length)} cartas deste Pokémon ainda não têm detalhes (acabamentos, ilustrador…). <button class="btn small" data-act="load-scope" data-id="${esc(b.id)}" type="button">Baixar só estas ${fmtN(need.length)}</button>`);
  }
 }else if(cov.setsLoaded<cov.sets&&!r.dex)notes+=noteHTML('',`Só ${cov.setsLoaded} de ${cov.sets} coleções foram carregadas até agora; o fichário cresce conforme chegam.`);
 if(r.dex)loadDexNames();
 if(r.dex&&S.status.own)notes+=noteHTML('',`Baixando os detalhes das cartas que você tem: ${S.status.own.done} de ${S.status.own.total}. Os espaços da Pokédex se completam à medida que chegam.`);
 if(r.dex&&S.status.cl)notes+=noteHTML('',`Baixando os detalhes das cartas das suas coleções: ${S.status.cl.done} de ${S.status.cl.total}. Os espaços da Pokédex se completam à medida que chegam.`);
 live($('#bsum')).innerHTML=notes+statsHTML(r,own,tot);
 const g=live($('#bgrid'));
 renderBar(r.dex?r.dex.filter(x=>x.rep).map(x=>x.rep):r.ids);
 if(r.dex){
  const q=parseQuery(S.ui.binderQ);
  /* no fichário de Pokédex só existem as cartas que você colocou nos espaços; o filtro olha para elas e nunca troca por outra */
  const dexSlots=ffActive()?r.dex.filter(x=>x.rep&&ffMatch(x.rep)):r.dex;
  const list=dexSlots.filter(x=>(S.ui.binderFilter==='all'||(S.ui.binderFilter==='have'?x.owned:!x.owned))&&slotMatches(x,q));
  S.cur.nav=list.filter(x=>x.rep).map(x=>({id:x.rep,dex:x.dex}));
  const shown=list.slice(0,S.ui.binderShown);
  if(list.length&&isBook()&&noQ(q)){g.innerHTML=bookHTML(list.map(x=>dexSlotHTML(x,b.id)),'binder:'+b.id+':'+S.ui.binderFilter+ffSig(),bookCover(b));return;}
  g.innerHTML=list.length?`<div class="cards"${noQ(q)?'':' style="--tile:230px"'}>${shown.map(x=>dexSlotHTML(x,b.id)).join('')}${list.length>shown.length?`<div class="more"><button class="btn" type="button" data-act="more">Mostrar mais (${fmtN(list.length-shown.length)} restantes)</button></div>`:''}</div>`
   :`<div class="empty"><h3>Nada por aqui</h3><p>${ffActive()?'Nenhuma carta combina com os filtros de raridade e tipo.':'Ajuste o filtro.'}</p></div>`;
  return;
 }
 const q=parseQuery(S.ui.binderQ);
 const list=r.ids.filter(id=>{const o=isOwned(id);if(!(S.ui.binderFilter==='all'||(S.ui.binderFilter==='have'?o:!o)))return false;return cardMatches(id,q)&&ffMatch(id);});
 if(!list.length){
  g.innerHTML=ffActive()&&!r.empty?`<div class="empty"><h3>Nenhuma carta combina</h3><p>Nenhuma carta combina com os filtros de raridade e tipo. Use “Limpar filtros” para ver tudo de novo.</p></div>`:r.empty?`<div class="empty"><h3>Defina ao menos uma regra</h3><p>Use “Editar regras” para escolher o que entra neste fichário.</p></div>`:
  `<div class="empty"><h3>${b.mode==='manual'?'Nenhuma carta no fichário':'Nenhuma carta combina'}</h3><p>${b.mode==='manual'?'Use “Adicionar cartas” para escolher.':'Revise as regras ou sincronize o catálogo.'}</p></div>`;
  return;
 }
 S.cur.nav=list.map(id=>({id}));
 if(isBook()&&noQ(q)){g.innerHTML=bookHTML(list.map(id=>slotHTMLCtx(S.briefs[id]||{id,name:id,localId:''},b.id)),'binder:'+b.id+':'+S.ui.binderFilter+ffSig(),bookCover(b));return;}
 const shown=list.slice(0,S.ui.binderShown);
 g.innerHTML=`<div class="cards"${noQ(q)?'':' style="--tile:230px"'}>${shown.map(id=>{
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
 if(!x.rep){
  const h=(x.have||[]).length;
  return`<div class="slot off dexempty ${h?'hashave':''}" ${attrs} aria-label="${esc(label)}, sem carta neste espaço${h?`. Você tem ${h} em outros fichários`:''}. Abrir a lista de cartas"><div class="pocket"><div class="dexph"><img alt="" loading="lazy" decoding="async" src="${dexArt(x.dex)}" data-role="dexart"><b>#${pad4(x.dex)}</b></div>${h?`<span class="qty havechip">Você tem ${h}</span>`:''}</div><div class="num dexname"><b>${esc(nm||'—')}</b></div></div>`;
 }
 const c=S.cards[x.rep]||{};const br=S.briefs[x.rep]||{id:x.rep,name:c.name||x.rep,image:c.image};
 const on=x.owned;
 return`<div class="slot ${on?'on':'off'}" ${attrs} aria-label="${esc(label)}, ${on?'tenho':'não tenho'}. Abrir a lista de cartas">
  <div class="pocket">${imgTag(br.image,'low',br.name,undefined,br.id||x.rep)}<span class="dexno">#${pad4(x.dex)}</span></div>
  <div class="num"><b>${esc(nm||br.name)}</b>${capRight({...br,id:br.id||x.rep})}</div></div>`;
}
export function slotHTMLCtx(c,binderId){
 return slotHTML(c,null).replace('data-act="open"',`data-act="open" data-binder="${esc(binderId)}"`);
}

/* Exportar imagem das cartas do fichário aberto (respeita a busca; o filtro vira a opção "Quais cartas"). */
export function binderExport(id){
 const b=S.binders.find(x=>x.id===id);if(!b)return;
 const r=evalBinder(b);const q=parseQuery(S.ui.binderQ);
 const entry=(cid,qty,f,l)=>{const sn=snapOf(cid);return{url:customCard(cid)||(sn.i?sn.i+'/high.webp':''),n:sn.n,no:sn.no,q:qty,f,l};};
 const ownedEntries=cid=>{
  const e=S.collection[cid];const out=[];
  if(e)for(const f in e.f){const x=e.f[f];if(x&&x.q>0)out.push(entry(cid,x.q,f,x.l||''));}
  return out;
 };
 let ids,scopes=null;
 if(r.dex){
  ids=r.dex.filter(x=>x.rep&&x.owned&&slotMatches(x,q)).map(x=>x.rep);
  return openExport({title:b.name,scopes:null,build:()=>ids.flatMap(ownedEntries)});
 }
 ids=r.ids.filter(cid=>cardMatches(cid,q));
 scopes=[{v:'own',l:'Só as que tenho'},{v:'miss',l:'Só as que faltam (×1 cada)'},{v:'all',l:'Todas'}];
 const view=S.ui.binderFilter;
 if(view==='miss')scopes.unshift(scopes.splice(1,1)[0]);
 openExport({title:b.name,scopes,build:sc=>{
  const out=[];
  for(const cid of ids){
   const own=isOwned(cid);
   if(own&&sc!=='miss')out.push(...ownedEntries(cid));
   else if(!own&&sc!=='own')out.push(entry(cid,sc==='miss'?1:0,'normal',''));
  }
  return out;
 }});
}
