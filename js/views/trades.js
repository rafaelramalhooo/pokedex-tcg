/* Negociação: listas para vender/trocar ou procurar. Não afetam a coleção, a Dex nem os fichários. */
import {ensureCard, visibleSet,loadAllSetLists} from '../catalog.js';
import {COND, FIN_LABEL, finShort, finsOfCard} from '../constants.js';
import {flagHTML, langOf} from '../cardlabel.js';
import {S, refreshAll} from '../state.js';
import {closePanel, openPanel, renderPanel} from './panel.js';
import {imgTag, noteHTML, toast} from '../ui.js';
import {$, ICON, brl, esc, fmtN, live, nz} from '../util.js';
import {KINDS, addItem, bulkEdit, getTrade, hasPrice, imgOf, itemKey, newShareCode, newTrade, parsePrice, saveTrades, setQty, shareLink, shareSnapshot, snapOf, totalQty, tradeTotal, updateItem} from '../trades.js';
import {canShare, shareList, sharingMissing, unshareList} from '../cloud.js';
import {openExport} from '../exportimg.js';

const LANGS=[['pt','Português'],['en','Inglês'],['ja','Japonês'],['es','Espanhol'],['fr','Francês'],['de','Alemão'],['it','Italiano'],['ko','Coreano'],['zh','Chinês']];
const kindChip=k=>`<span class="ttag ${k==='want'?'want':'sell'}">${KINDS[k]}</span>`;

export function viewTrades(){
 S.cur={name:'trades',soft:renderTrades,refresh:renderTrades};
 $('#view').innerHTML=`<div class="top"><div><h1>Negociação</h1><p class="lead">Listas para vender, trocar ou procurar cartas. Elas ficam separadas da sua coleção, então nada aqui muda o que você já marcou.</p></div>
  <div class="tools"><button class="btn primary" type="button" data-act="trade-new">Nova lista</button></div></div><div id="tbody"></div>`;
 renderTrades();
}
export function renderTrades(){
 const el=live($('#tbody'));if(!el)return;
 if(!S.trades.length){
  el.innerHTML=`<div class="empty"><h3>Você ainda não tem listas de negociação</h3><p>Crie uma lista “Vendo / Troco” com o que você quer oferecer ou uma lista “Procuro” com o que está atrás. Depois é só exportar como imagem e compartilhar.</p><button class="btn primary" type="button" data-act="trade-new">Criar a primeira lista</button></div>`;
  return;
 }
 el.innerHTML=`<div class="binders">${S.trades.map(t=>`<a class="binder" href="#/negociacao/${esc(t.id)}"><div class="bmeta"><h3>${esc(t.name)}</h3>
  <div class="chips" style="margin:0">${kindChip(t.kind)}</div>
  <div class="count"><strong>${fmtN(t.items.length)}</strong><span>carta${t.items.length===1?'':'s'} · ${fmtN(totalQty(t))} unidade${totalQty(t)===1?'':'s'}</span></div></div></a>`).join('')}</div>`;
}

export function viewTrade(id){
 const t=getTrade(id);
 if(!t){$('#view').innerHTML=`<a class="back" href="#/negociacao">${ICON.back} Negociação</a><div class="empty"><h3>Lista não encontrada</h3></div>`;S.cur={name:'trade-missing'};return;}
 S.cur={name:'trade',id,soft:renderTrade,refresh:renderTrade};
 $('#view').innerHTML=`<a class="back" href="#/negociacao">${ICON.back} Negociação</a>
  <div class="top"><div><h1 id="tname"></h1><div class="chips" id="tchips"></div></div>
  <div class="tools"><button class="btn" type="button" data-act="trade-add" data-id="${esc(id)}">Adicionar cartas</button>${t.kind==='sell'?`<button class="btn" type="button" data-act="trade-pull" data-id="${esc(id)}">Puxar das minhas cartas</button><button class="btn" type="button" data-act="trade-bulk" data-id="${esc(id)}">Editar em massa</button>`:''}<button class="btn primary" type="button" data-act="trade-export" data-id="${esc(id)}">Exportar imagem</button><button class="btn" type="button" data-act="trade-share" data-id="${esc(id)}">Compartilhar link</button><button class="btn" type="button" data-act="trade-edit-list" data-id="${esc(id)}">Editar lista</button></div></div>
  <div id="tgrid"></div>`;
 renderTrade();
}
export function tradeTile(t,it){
 const key=itemKey(it);
 const sell=t.kind==='sell';
 const tag=[finShort(it.f),it.l&&it.l!=='xx'?it.l.toUpperCase():'',sell&&it.c?it.c:''].filter(Boolean).join(' · ');
 return`<div class="slot on tradeslot" data-act="trade-item" data-trade="${esc(t.id)}" data-key="${esc(key)}" role="button" tabindex="0" aria-label="${esc(it.n)}, ${it.q} unidade${it.q===1?'':'s'}. Editar">
  <div class="pocket">${imgTag(it.i,'low',it.n,undefined,it.id)}<span class="qty tq">×${it.q}</span></div>
  <div class="num"><b>${esc(it.n)}</b><span>${esc(it.no)} ${flagHTML(it.l||'xx')}</span></div>
  ${tag?`<div class="num"><span>${esc(tag)}</span></div>`:''}
  ${sell?`<div class="num"><b class="tprice">${hasPrice(it)?esc(brl(it.p)):'<span class="tnop">Sem valor</span>'}</b></div>`:''}
  <div class="stepper"><button type="button" class="btn small" data-act="trade-dec" data-trade="${esc(t.id)}" data-key="${esc(key)}" aria-label="Diminuir">−</button><button type="button" class="btn small" data-act="trade-inc" data-trade="${esc(t.id)}" data-key="${esc(key)}" aria-label="Aumentar">+</button></div></div>`;
}
export function renderTrade(){
 if(!S.cur||S.cur.name!=='trade')return;
 const t=getTrade(S.cur.id);if(!t)return;
 const tt=t.kind==='sell'?tradeTotal(t):null;
 $('#tname').textContent=t.name;$('#tchips').innerHTML=kindChip(t.kind)+(t.share?' <span class="ttag fmt">Link ativo</span>':'')+` <span class="lead" style="margin:0">${fmtN(t.items.length)} carta${t.items.length===1?'':'s'} · ${fmtN(totalQty(t))} unidade${totalQty(t)===1?'':'s'}</span>`+(tt&&tt.priced?` <span class="ttag fmt" id="ttotal">Total ${esc(brl(tt.sum))}</span>`+(tt.missing?` <span class="lead" style="margin:0">${tt.missing} sem valor</span>`:''):'');
 const g=live($('#tgrid'));
 if(!t.items.length){
  g.innerHTML=`<div class="empty"><h3>Lista vazia</h3><p>Use “Adicionar cartas” para buscar pelo nome${t.kind==='sell'?' ou “Puxar das minhas cartas” para copiar o que você tem':''}.</p></div>`;
  return;
 }
 g.innerHTML=`<div class="cards">${t.items.map(it=>tradeTile(t,it)).join('')}</div>`;
 S.cur.nav=t.items.map(it=>({id:it.id,tkey:itemKey(it)}));
}
const saveAndRefresh=()=>{saveTrades();if(S.cur&&S.cur.refresh)S.cur.refresh();};
/* painel da carta aberto a partir de uma lista */
function tpStep(d){
 const c=S.ui.panelCtx;const x=c&&getTrade(c.tradeId);const it=x&&x.items.find(i=>itemKey(i)===c.tradeKey);if(!it)return;
 if(it.q+d<1)return;
 setQty(x,c.tradeKey,it.q+d);saveAndRefresh();renderPanel();
}
export function tradePanelChange(el){
 const c=S.ui.panelCtx;const x=c&&getTrade(c.tradeId);const it=x&&x.items.find(i=>itemKey(i)===c.tradeKey);if(!it)return;
 const k=el.dataset.tp,patch={};
 if(k==='p')patch.p=parsePrice(el.value);else patch[k]=el.value;
 const r=updateItem(x,c.tradeKey,patch);
 if(r)c.tradeKey=itemKey(r);
 saveAndRefresh();renderPanel();
}

/* ---------- janelas ---------- */
function listDialog(t,isNew){
 S.ui.tr={t:{...t},isNew};
 $('#dialog').innerHTML=`<h2>${isNew?'Nova lista':'Editar lista'}</h2>
  <label class="lbl2" for="trn">Nome da lista</label><input class="field" id="trn" style="width:100%" maxlength="40" value="${esc(t.name==='Nova lista'?'':t.name)}" placeholder="Ex.: Vendo – outubro">
  <label class="lbl2" style="margin-top:12px">Tipo</label>
  <div class="seg" role="group" aria-label="Tipo da lista"><button type="button" data-act="tr-kind" data-v="sell" aria-pressed="${t.kind==='sell'}">Vendo / Troco</button><button type="button" data-act="tr-kind" data-v="want" aria-pressed="${t.kind==='want'}">Procuro</button></div>
  <div class="actions">${isNew?'<span></span>':`<button class="btn" type="button" data-act="trade-del" data-id="${esc(t.id)}">Excluir lista</button>`}<span><button class="btn" type="button" data-ed-act="cancel">Cancelar</button> <button class="btn primary" type="button" data-act="tr-save">Salvar</button></span></div>`;
 $('#modal').classList.add('on');setTimeout(()=>{const n=$('#trn');if(n)n.focus();},30);
}
const countTxt=t=>`${t.items.length} carta${t.items.length===1?'':'s'} na lista`;
const tdHead=(title,t)=>`<div class="tdhead"><div><h2>${title}</h2><span class="tdcount" id="tdcount">${countTxt(t)}</span></div><button class="btn primary" type="button" data-ed-act="cancel">Concluir</button></div>`;
const commit=()=>{
 saveTrades();
 const st=S.ui.tradeAdd||S.ui.pull;const t=st&&getTrade(st.id);const el=$('#tdcount');
 if(t&&el)el.textContent=countTxt(t);
 if(S.cur&&S.cur.refresh)S.cur.refresh();
};
const CHECK='<span class="plcheck" aria-hidden="true"><svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>';
const setOptions=()=>{
 const ids=new Set();for(const id in S.briefs){const c=S.briefs[id];if(visibleSet(c.setId))ids.add(c.setId);}
 return[...ids].map(sid=>({sid,name:(S.setMap[sid]&&S.setMap[sid].name)||sid})).sort((a,b)=>a.name.localeCompare(b.name,'pt'));
};

/* Busca: tocar numa carta abre a tela de variações. */
export function renderAddTrade(){
 const st=S.ui.tradeAdd;const el=$('#tres');if(!st||!el||st.pick)return;
 const t=getTrade(st.id);if(!t)return;
 live(el);
 const q=nz(st.q);
 if(q.length<2){el.innerHTML='<p class="lead">Digite ao menos 2 letras.</p>';return;}
 const res=[];
 for(const id in S.briefs){const c=S.briefs[id];if(!visibleSet(c.setId))continue;if(st.set&&c.setId!==st.set)continue;if(nz(c.name).includes(q)){res.push(id);if(res.length>=300)break;}}
 const list=res.slice(0,40);
 el.innerHTML=res.length?`<p class="lbl2">${fmtN(res.length)} resultados${res.length>list.length?', mostrando os primeiros '+list.length:''}. Toque na carta para escolher a variação.</p><div class="cards" style="--tile:118px">${list.map(id=>{
  const c=S.briefs[id];const set=S.setMap[c.setId];
  const n=t.items.filter(i=>i.id===id).reduce((a,i)=>a+i.q,0);
  return`<div class="slot on plslot ${n?'sel':''}" data-act="tr-pick" data-id="${esc(id)}" role="button" tabindex="0" aria-label="${esc(c.name)}, ${esc(set?set.name:'')}, escolher variação">
   <div class="pocket">${imgTag(c.image,'low',c.name,undefined,id)}${n?CHECK+`<span class="qty tq">×${n}</span>`:''}</div>
   <div class="num"><b>${esc(c.name)}</b><span>${esc(c.localId)}</span></div><div class="num"><span>${esc(set?set.name:'')}</span></div></div>`;}).join('')}</div>`:'<p class="lead">Nenhuma carta com esse nome. Se ela é de uma coleção que você ainda não baixou, use “Procurar em todas as coleções”.</p>';
}
function allStatus(){
 const el=$('#taall');if(!el)return;
 const a=S.status.all;const st=S.ui.tradeAdd;
 if(a)el.textContent=`Baixando as coleções: ${a.done} de ${a.total}…`;
 else if(st&&st.loadedAll)el.textContent='Todas as coleções foram carregadas.';
 else el.textContent='';
}
function showSearch(){
 const st=S.ui.tradeAdd;const t=st&&getTrade(st.id);if(!t)return;st.pick=null;
 const opts=setOptions();
 $('#taview').innerHTML=`<div class="row" style="gap:10px;flex-wrap:wrap;align-items:flex-end">
   <div style="flex:1;min-width:200px"><label class="lbl2" for="tra">Buscar pelo nome da carta</label><input class="field" id="tra" type="search" style="width:100%" placeholder="Ex.: Pikachu" value="${esc(st.q)}"></div>
   <label class="size">Coleção <select class="field" data-ta="set"><option value="">Todas</option>${opts.map(x=>`<option value="${esc(x.sid)}" ${st.set===x.sid?'selected':''}>${esc(x.name)}</option>`).join('')}</select></label></div>
  <div class="row" style="gap:10px;margin-top:8px;align-items:center;flex-wrap:wrap"><button class="btn small" type="button" data-act="ta-all" id="taallbtn">Procurar em todas as coleções</button><span class="lead" id="taall" style="margin:0"></span></div>
  <div id="tres" style="margin-top:12px"></div>`;
 allStatus();renderAddTrade();
 if(!st.q)setTimeout(()=>{const i=$('#tra');if(i)i.focus();},30);
}
function addDialog(id){
 const t=getTrade(id);if(!t)return;
 S.ui.tradeAdd={id,q:'',set:'',pick:null,lang:null,fin:{normal:0,holo:0,reverse:0}};
 $('#dialog').innerHTML=`<div class="tdlg">${tdHead('Adicionar cartas',t)}<div class="tdbody" id="taview"></div></div>`;
 $('#modal').classList.add('on');
 showSearch();
}
export function tradeSetFilter(v){const st=S.ui.tradeAdd;if(!st)return;st.set=v;renderAddTrade();}
async function allCollections(){
 const st=S.ui.tradeAdd;if(!st)return;
 const b=$('#taallbtn');if(b)b.disabled=true;
 const tick=setInterval(allStatus,300);
 try{await loadAllSetLists();}catch(e){}
 clearInterval(tick);
 const cur=S.ui.tradeAdd;if(!cur)return;
 cur.loadedAll=true;
 if(!cur.pick){showSearch();}
}
/* Tela de variações: acabamento, idioma e quantidade da carta escolhida. */
function showVariation(){
 const st=S.ui.tradeAdd;const t=st&&getTrade(st.id);const id=st&&st.pick;if(!t||!id)return;
 const sn=snapOf(id);const v=S.cards[id]&&S.cards[id].variants;
 let fins=S.cards[id]&&S.cards[id].variants?finsOfCard(S.cards[id]):['normal','holo','reverse'];if(!fins.length)fins=['normal','holo','reverse'];
 const lang=st.lang||langOf(id);
 const inList=f=>t.items.filter(i=>i.id===id&&i.f===f&&i.l===lang).reduce((a,i)=>a+i.q,0);
 const sum=fins.reduce((a,f)=>a+(st.fin[f]||0),0);
 const set=S.setMap[sn.s];
 $('#taview').innerHTML=`<button class="btn small" type="button" data-act="tv-back">‹ Voltar à busca</button>
  <div class="tvgrid"><div class="tvimg"><div class="pocket">${imgTag(sn.i,'high',sn.n,undefined,id)}</div></div>
   <div class="tvinfo"><h3>${esc(sn.n)}</h3><p class="lead" style="margin:0">${esc(sn.no)}${set?' · '+esc(set.name):''}</p>
    <label class="lbl2" style="margin-top:12px;display:block">Idioma</label>
    <div class="seg tvlang" role="group" aria-label="Idioma">${LANGS.map(([k,l])=>`<button type="button" data-act="tv-lang" data-v="${k}" aria-pressed="${lang===k}" title="${l}">${flagHTML(k)} ${k.toUpperCase()}</button>`).join('')}</div>
    <label class="lbl2" style="margin-top:12px;display:block">Acabamento e quantidade</label>
    ${fins.map(f=>`<div class="tvrow"><div><b>${FIN_LABEL[f]}</b>${inList(f)?`<br><small>na lista ×${inList(f)}</small>`:''}</div>
     <div class="stepper"><button type="button" class="btn small" data-act="tv-dec" data-f="${f}" aria-label="Diminuir ${FIN_LABEL[f]}">−</button><span class="tvq">${st.fin[f]||0}</span><button type="button" class="btn small" data-act="tv-inc" data-f="${f}" aria-label="Aumentar ${FIN_LABEL[f]}">+</button></div></div>`).join('')}
    <div style="margin-top:14px"><button class="btn primary" type="button" data-act="tv-add" ${sum?'':'disabled'}>Adicionar à lista</button></div></div></div>`;
 const b=$('#taview');if(b)b.scrollTop=0;
}
function tvPick(id){
 const st=S.ui.tradeAdd;if(!st)return;
 st.pick=id;st.lang=langOf(id);st.fin={normal:0,holo:0,reverse:0};
 showVariation();
 if(!S.cards[id]||S.cards[id].rvp===undefined)ensureCard(id,true).then(()=>{if(st.pick===id)showVariation();}).catch(()=>{});
}
function tvStep(f,d){
 const st=S.ui.tradeAdd;if(!st||!st.pick)return;
 st.fin[f]=Math.max(0,Math.min(99,(st.fin[f]||0)+d));showVariation();
}
function tvAdd(){
 const st=S.ui.tradeAdd;const t=st&&getTrade(st.id);if(!t||!st.pick)return;
 let n=0;
 for(const f of Object.keys(st.fin)){const q=st.fin[f]||0;if(q>0){addItem(t,st.pick,f,st.lang||langOf(st.pick),q);n+=q;}}
 if(!n)return;
 commit();
 st.pick=null;st.fin={normal:0,holo:0,reverse:0};
 showSearch();
 toast(`Adicionei ${n} ${n===1?'cópia':'cópias'} à lista.`);
}
function itemDialog(t,it){
 const key=itemKey(it);S.ui.tr={id:t.id,key};
 $('#dialog').innerHTML=`<h2>${esc(it.n)}</h2><p class="lead">${esc(it.no)}</p>
  <div class="row" style="gap:12px;flex-wrap:wrap">
   <label class="size">Quantidade <input class="field mini" id="tiq" type="number" min="1" max="999" value="${it.q}"></label>
   <label class="size">Acabamento <select class="field" id="tif">${[...new Set(['normal','holo','reverse',...finsOfCard(S.cards[it.id]),it.f])].map(k=>`<option value="${k}" ${it.f===k?'selected':''}>${FIN_LABEL[k]}</option>`).join('')}</select></label>
   <label class="size">Idioma <select class="field" id="til">${LANGS.map(([k,l])=>`<option value="${k}" ${it.l===k?'selected':''}>${l}</option>`).join('')}</select></label>
   ${t.kind==='sell'?`<label class="size">Condição <select class="field" id="tic"><option value="">Não informada</option>${COND.map(([k,l])=>`<option value="${k}" ${it.c===k?'selected':''}>${l}</option>`).join('')}</select></label>
   <label class="size">Valor pedido (R$, por carta) <input class="field mini" id="tip" type="text" inputmode="decimal" placeholder="0,00" value="${hasPrice(it)?String(it.p).replace('.',','):''}" style="width:110px"></label>`:''}</div>
  <div class="actions"><button class="btn" type="button" data-act="tr-remove">Remover da lista</button><span><button class="btn" type="button" data-ed-act="cancel">Cancelar</button> <button class="btn primary" type="button" data-act="tr-item-save">Salvar</button></span></div>`;
 $('#modal').classList.add('on');
}
export function tradeExport(id){
 const t=getTrade(id);if(!t)return;
 const sell=t.kind==='sell';
 openExport({title:t.name,kindLabel:KINDS[t.kind],kindColor:t.kind==='want'?'#2F6FDE':'#D93A2B',scopes:null,extras:sell?{p:t.items.some(hasPrice),c:t.items.some(i=>i.c),on:false}:null,build:()=>t.items.map(it=>({url:imgOf(it),n:it.n,no:it.no,q:it.q,f:it.f,l:it.l,...(sell&&it.c?{c:it.c}:{}),...(sell&&hasPrice(it)?{p:it.p}:{})}))});
}

/* ---------- Editar em massa (listas Vendo/Troco) ---------- */
const sel=(id,opts)=>`<select class="field" id="${id}">${opts.map(([k,l])=>`<option value="${k}">${l}</option>`).join('')}</select>`;
function bulkRows(t,st){
 return t.items.map(it=>{
  const key=itemKey(it),on=st.sel.has(key);
  const tag=[finShort(it.f),it.l&&it.l!=='xx'?it.l.toUpperCase():'',it.c||''].filter(Boolean).join(' · ');
  return`<button type="button" class="bkrow ${on?'on':''}" data-act="bk-toggle" data-key="${esc(key)}" aria-pressed="${on}"><span class="bkchk" aria-hidden="true">${on?'✓':''}</span><span class="bkname"><b>${esc(it.n)}</b> <small>${esc(it.no)}${tag?' · '+esc(tag):''}</small></span><span class="bkq">×${it.q}</span><span class="bkp">${hasPrice(it)?esc(brl(it.p)):'—'}</span></button>`;
 }).join('');
}
function bulkPaint(){
 const st=S.ui.bulk;const t=st&&getTrade(st.id);if(!t)return;
 const l=$('#bkl');if(l)l.innerHTML=bulkRows(t,st);
 const n=$('#bkn');if(n)n.textContent=`${st.sel.size} de ${t.items.length} selecionada${st.sel.size===1?'':'s'}`;
 const a=$('#bkgo');if(a)a.disabled=!st.sel.size;const r=$('#bkrm');if(r)r.disabled=!st.sel.size;
}
function bulkDialog(id){
 const t=getTrade(id);if(!t)return;
 if(!t.items.length){toast('A lista está vazia.');return;}
 S.ui.bulk={id,sel:new Set()};
 $('#dialog').innerHTML=`<div class="tdlg"><h2>Editar em massa</h2>
  <p class="lead">1. Marque as cartas. 2. Escolha o que mudar. 3. Aplique. O que ficar em “Não mudar” não é alterado.</p>
  <div class="row" style="gap:8px;flex-wrap:wrap;align-items:center"><button class="btn small" type="button" data-act="bk-all">Marcar todas</button><button class="btn small" type="button" data-act="bk-none">Desmarcar</button><span class="lead" id="bkn" style="margin:0"></span></div>
  <div class="tdbody bklist" id="bkl" style="max-height:34vh;margin:8px 0"></div>
  <div class="bkctl">
   <label class="size">Condição ${sel('bkc',[['','Não mudar'],['__none','Limpar a condição'],...COND])}</label>
   <label class="size">Quantidade ${sel('bkqm',[['','Não mudar'],['set','Definir como'],['add','Somar'],['sub','Subtrair']])} <input class="field mini" id="bkqv" type="number" min="0" max="999" placeholder="0"></label>
   <label class="size">Valor (R$) ${sel('bkpm',[['','Não mudar'],['set','Definir como'],['up','Aumentar em %'],['down','Diminuir em %'],['clear','Limpar o valor']])} <input class="field mini" id="bkpv" type="text" inputmode="decimal" placeholder="0,00" style="width:100px"></label>
  </div>
  <div class="actions"><button class="btn" type="button" data-act="bk-remove" id="bkrm">Remover marcadas</button><span><button class="btn" type="button" data-ed-act="cancel">Fechar</button> <button class="btn primary" type="button" data-act="bk-apply" id="bkgo">Aplicar às marcadas</button></span></div></div>`;
 $('#modal').classList.add('on');bulkPaint();
}
function bulkApply(){
 const st=S.ui.bulk;const t=st&&getTrade(st.id);if(!t||!st.sel.size)return;
 const o={c:$('#bkc').value,qMode:$('#bkqm').value,qVal:$('#bkqv').value,pMode:$('#bkpm').value,pVal:$('#bkpv').value};
 if(!o.c&&!o.qMode&&!o.pMode){toast('Escolha o que mudar: condição, quantidade ou valor.');return;}
 if(o.qMode&&!(Number($('#bkqv').value)>=0&&$('#bkqv').value!=='')){toast('Digite a quantidade.');return;}
 if((o.pMode==='set'||o.pMode==='up'||o.pMode==='down')&&!String(o.pVal).trim()){toast('Digite o valor ou o percentual.');return;}
 if(o.pMode==='set'&&parsePrice(o.pVal)===null){toast('Esse valor não é válido. Use, por exemplo, 12,50.');return;}
 if(!confirm(`Aplicar a ${st.sel.size} carta${st.sel.size===1?'':'s'} da lista “${t.name}”?`))return;
 const n=bulkEdit(t,st.sel,o);
 closeDlg();saveAndRefresh();toast(`${n} carta${n===1?'':'s'} atualizada${n===1?'':'s'}.`);
}
function bulkRemove(){
 const st=S.ui.bulk;const t=st&&getTrade(st.id);if(!t||!st.sel.size)return;
 if(!confirm(`Remover ${st.sel.size} carta${st.sel.size===1?'':'s'} da lista “${t.name}”? Sua coleção não muda.`))return;
 const n=st.sel.size;t.items=t.items.filter(i=>!st.sel.has(itemKey(i)));
 closeDlg();saveAndRefresh();toast(`${n} carta${n===1?'':'s'} removida${n===1?'':'s'}.`);
}

/* ---------- Puxar das minhas cartas: tocar na carta já a coloca na lista ---------- */
const PULL_MAX=120;
function ownRows(){
 const rows=[];
 for(const id in S.collection){
  const e=S.collection[id];
  for(const f in e.f){
   const x=e.f[f];if(!x||x.q<=0)continue;
   const l=x.l||langOf(id);const sn=snapOf(id);
   rows.push({key:itemKey({id,f,l}),id,f,l,own:x.q,sn,set:e.s||sn.s});
  }
 }
 rows.sort((a,b)=>a.sn.n.localeCompare(b.sn.n,'pt',{numeric:true})||String(a.sn.no).localeCompare(String(b.sn.no),undefined,{numeric:true}));
 return rows;
}
/* Uma linha por carta: soma os acabamentos; ao adicionar, leva o acabamento e o idioma da versão que você mais tem. */
function groupRows(rows){
 const by=new Map();
 for(const r of rows){
  const g=by.get(r.id);
  if(!g)by.set(r.id,{...r,key:r.id,own:r.own,parts:1,top:r.own});
  else{g.own+=r.own;g.parts++;if(r.own>g.top){g.top=r.own;g.f=r.f;g.l=r.l;}}
 }
 return[...by.values()];
}
const viewRows=st=>st.split?st.all:groupRows(st.all);
/* Itens da lista que correspondem a uma linha da janela. */
const itemsOf=(t,st,r)=>st.split?t.items.filter(i=>itemKey(i)===r.key):t.items.filter(i=>i.id===r.id);
function pullDialog(id){
 const t=getTrade(id);if(!t)return;
 const rows=ownRows();
 if(!rows.length){toast('Você ainda não marcou cartas na sua coleção para copiar.');return;}
 S.ui.pull={id,q:'',set:'',rep:false,split:false,all:rows};
 const sets=[...new Set(rows.map(r=>r.set).filter(Boolean))].map(sid=>({sid,name:(S.setMap[sid]&&S.setMap[sid].name)||sid})).sort((a,b)=>a.name.localeCompare(b.name,'pt'));
 $('#dialog').innerHTML=`<div class="tdlg">${tdHead('Puxar das minhas cartas',t)}<div class="tdbody">
  <p class="lead">Toque numa carta para colocá-la em “${esc(t.name)}”; toque de novo para tirar. Isso só copia: a sua coleção não muda.</p>
  <div class="row" style="gap:10px;flex-wrap:wrap;align-items:flex-end">
   <div style="flex:1;min-width:180px"><label class="lbl2" for="plq">Buscar pelo nome</label><input class="field" id="plq" type="search" style="width:100%" placeholder="Ex.: Pikachu"></div>
   <label class="size">Coleção <select class="field" data-pl="set"><option value="">Todas</option>${sets.map(x=>`<option value="${esc(x.sid)}">${esc(x.name)}</option>`).join('')}</select></label>
   <label class="size"><input type="checkbox" data-pl="rep"> Só repetidas (×2 ou mais)</label>
   <label class="size"><input type="checkbox" data-pl="split"> Separar por acabamento</label></div>
  <div class="row" style="gap:8px;margin-top:10px"><button class="btn small" type="button" data-act="pl-all">Adicionar todas as visíveis</button><button class="btn small" type="button" data-act="pl-none">Remover as visíveis</button></div>
  <div id="pullres" style="margin-top:12px"></div></div></div>`;
 $('#modal').classList.add('on');setTimeout(()=>$('#plq').focus(),30);
 renderPull();
}
function pullVisible(){
 const st=S.ui.pull;const q=nz(st.q);
 return viewRows(st).filter(r=>(!st.set||r.set===st.set)&&(!st.rep||r.own>=2)&&(!q||nz(r.sn.n).includes(q)));
}
export function renderPull(){
 const st=S.ui.pull;const el=$('#pullres');const t=st&&getTrade(st.id);if(!st||!el||!t)return;
 live(el);
 const vis=pullVisible();const list=vis.slice(0,PULL_MAX);
 el.innerHTML=vis.length?`<p class="lbl2">${fmtN(vis.length)} carta${vis.length===1?'':'s'}${vis.length>list.length?', mostrando as primeiras '+list.length+'. Use a busca ou o filtro para achar as outras':''}.</p><div class="cards" style="--tile:118px">${list.map(r=>{
  const its=itemsOf(t,st,r);const on=its.length>0;const q=its.reduce((a,i)=>a+i.q,0);
  const tag=st.split?[finShort(r.f),r.l&&r.l!=='xx'?r.l.toUpperCase():''].filter(Boolean).join(' · '):(r.l&&r.l!=='xx'?r.l.toUpperCase():'');
  return`<div class="slot on plslot ${on?'sel':''}" data-act="pl-toggle" data-key="${esc(r.key)}" role="button" tabindex="0" aria-label="${esc(r.sn.n)}, você tem ${r.own}, ${on?'na lista, toque para tirar':'toque para adicionar'}">
   <div class="pocket">${imgTag(r.sn.i,'low',r.sn.n,undefined,r.id)}${on?CHECK:''}<span class="qty tq">×${on?q:r.own}</span></div>
   <div class="num"><b>${esc(r.sn.n)}</b><span>${esc(r.sn.no)}</span></div>${tag?`<div class="num"><span>${esc(tag)}</span></div>`:''}
   ${on?`<div class="stepper"><button type="button" class="btn small" data-act="pl-dec" data-key="${esc(r.key)}" aria-label="Diminuir">−</button><button type="button" class="btn small" data-act="pl-inc" data-key="${esc(r.key)}" aria-label="Aumentar">+</button></div>`:`<div class="num"><span>Você tem ×${r.own}</span></div>`}</div>`;}).join('')}</div>`:'<p class="lead">Nenhuma carta com esse filtro.</p>';
 const c=$('#tdcount');if(c)c.textContent=countTxt(t);
}
export function pullFilter(k,v){const st=S.ui.pull;if(!st)return;st[k]=v;renderPull();}
function plAddRow(t,st,r){addItem(t,r.id,r.f,r.l,r.own);}
function plToggle(key){
 const st=S.ui.pull;const t=st&&getTrade(st.id);if(!t)return;
 const r=viewRows(st).find(x=>x.key===key);if(!r)return;
 const its=itemsOf(t,st,r);
 if(its.length)its.forEach(i=>setQty(t,itemKey(i),0));else plAddRow(t,st,r);
 commit();renderPull();
}
function plStep(key,d){
 const st=S.ui.pull;const t=st&&getTrade(st.id);if(!t)return;
 const r=viewRows(st).find(x=>x.key===key);if(!r)return;
 const its=itemsOf(t,st,r);if(!its.length)return;
 const sum=its.reduce((a,i)=>a+i.q,0);
 if(d>0){if(sum>=r.own)return;const it=st.split?its[0]:(its.find(i=>i.f===r.f&&i.l===r.l)||its[0]);setQty(t,itemKey(it),it.q+1);}
 else{if(sum<=1)return;const it=[...its].reverse().find(i=>i.q>0);setQty(t,itemKey(it),it.q-1);}
 commit();renderPull();
}
function plAll(on){
 const st=S.ui.pull;const t=st&&getTrade(st.id);if(!t)return;
 for(const r of pullVisible()){
  const its=itemsOf(t,st,r);
  if(on){if(!its.length)plAddRow(t,st,r);}
  else its.forEach(i=>setQty(t,itemKey(i),0));
 }
 commit();renderPull();
}

/* ---------- link público ---------- */
const SQL_MSG='Falta rodar o arquivo supabase/atualizacao-link-publico.sql no Supabase (SQL Editor → New query → colar → Run).';
const fmtAt=ms=>new Date(ms).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
const shareOpts=t=>{const o=(t.share&&t.share.opts)||{};return t.kind==='sell'?`<div style="margin:10px 0"><label class="size" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="shv" ${o.v?'checked':''}> Mostrar os valores pedidos</label><label class="size" style="display:flex;gap:8px;align-items:center;margin-top:6px"><input type="checkbox" id="shc" ${o.c?'checked':''}> Mostrar as condições das cartas</label><p class="lead" style="margin:6px 0 0">Desligado, quem abre o link não vê valor nem condição.</p></div>`:'';};
const readShareOpts=t=>t.kind==='sell'?{v:!!($('#shv')&&$('#shv').checked),c:!!($('#shc')&&$('#shc').checked)}:{};
function shareDialog(id,msg){
 const t=getTrade(id);if(!t)return;
 S.ui.sh={id};
 let body;
 if(!canShare())body=`<p class="note warn">Para criar um link, entre na sua conta (menu Catálogo e ajustes). O link fica guardado na nuvem.</p>`;
 else if(!t.share)body=`<p>O link abre uma página <b>só de leitura</b> com o nome da lista, o tipo, as cartas e as quantidades. Quem abre não vê sua conta, sua coleção, seus fichários nem seus decks, e não precisa de login.</p>
  <p class="lead">O endereço é longo e aleatório, mas qualquer pessoa que receber o link consegue ver a lista. A página é uma cópia: ela só muda quando você usar “Atualizar o link”. Dá para parar de compartilhar a qualquer momento.</p>
  ${shareOpts(t)}
  <div class="actions"><button class="btn" type="button" data-ed-act="cancel">Cancelar</button><button class="btn primary" type="button" data-act="sh-create" data-id="${esc(id)}">Criar link</button></div>`;
 else body=`<label class="lbl2" for="shl">Link da lista</label><input class="field" id="shl" readonly style="width:100%" value="${esc(shareLink(t.share.code))}" onfocus="this.select()">
  <p class="lead" style="margin-top:8px">Última atualização do link: ${esc(fmtAt(t.share.at))}. ${t.items.length} carta${t.items.length===1?'':'s'} na lista agora.</p>
  ${shareOpts(t)}
  <div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn primary" type="button" data-act="sh-copy">Copiar link</button><button class="btn" type="button" data-act="sh-update" data-id="${esc(id)}">Atualizar o link com a lista atual</button><button class="btn" type="button" data-act="sh-stop" data-id="${esc(id)}">Parar de compartilhar</button></div>
  <div class="actions"><span></span><button class="btn" type="button" data-ed-act="cancel">Fechar</button></div>`;
 $('#dialog').innerHTML=`<h2>Compartilhar link</h2>${msg?`<p class="note err">${esc(msg)}</p>`:''}${body}`;
 $('#modal').classList.add('on');
}
async function shareGo(id,fresh){
 const t=getTrade(id);if(!t)return;
 const code=fresh||!t.share?newShareCode():t.share.code;
 const opts=readShareOpts(t);
 try{await shareList(code,shareSnapshot(t,opts));}
 catch(e){shareDialog(id,sharingMissing(e)?SQL_MSG:'Não consegui criar o link agora. Confira a conexão e tente de novo.');return;}
 t.share={code,at:Date.now(),opts};saveTrades();
 shareDialog(id);
 if(S.cur&&S.cur.refresh)S.cur.refresh();
}
async function shareStop(id){
 const t=getTrade(id);if(!t||!t.share)return;
 try{await unshareList(t.share.code);}
 catch(e){shareDialog(id,sharingMissing(e)?SQL_MSG:'Não consegui parar de compartilhar agora. Confira a conexão e tente de novo.');return;}
 delete t.share;saveTrades();shareDialog(id);toast('O link deixou de funcionar.');
}

const closeDlg=()=>{$('#modal').classList.remove('on');S.ui.tr=null;S.ui.tradeAdd=null;S.ui.pull=null;S.ui.bulk=null;};
export const TRADE_ACT={
 'trade-new':()=>listDialog(newTrade('', 'sell'),true),
 'tr-kind':t=>{document.querySelectorAll('[data-act=tr-kind]').forEach(b=>b.setAttribute('aria-pressed',String(b===t)));if(S.ui.tr)S.ui.tr.t.kind=t.dataset.v;},
 'tr-save':()=>{
  const st=S.ui.tr;if(!st)return;
  const name=($('#trn').value||'').trim();if(!name){toast('Dê um nome para a lista.');return;}
  st.t.name=name;
  const i=S.trades.findIndex(x=>x.id===st.t.id);
  if(i>=0)Object.assign(S.trades[i],{name:st.t.name,kind:st.t.kind});else S.trades.push(st.t);
  saveTrades();const isNew=st.isNew;closeDlg();
  if(isNew)location.hash='#/negociacao/'+st.t.id;else refreshAll();
 },
 'trade-edit-list':t=>{const x=getTrade(t.dataset.id);if(x)listDialog(x,false);},
 'trade-del':t=>{
  const x=getTrade(t.dataset.id);if(!x)return;
  if(!confirm(`Excluir a lista “${x.name}”? Sua coleção e seus fichários não mudam.`))return;
  if(x.share&&canShare())unshareList(x.share.code).catch(()=>{});
  S.trades=S.trades.filter(y=>y.id!==x.id);saveTrades();closeDlg();location.hash='#/negociacao';
 },
 'trade-add':t=>addDialog(t.dataset.id),
 'tr-pick':t=>tvPick(t.dataset.id),
 'tv-back':()=>showSearch(),
 'tv-lang':t=>{const st=S.ui.tradeAdd;if(!st)return;st.lang=t.dataset.v;showVariation();},
 'tv-inc':t=>tvStep(t.dataset.f,1),
 'tv-dec':t=>tvStep(t.dataset.f,-1),
 'tv-add':()=>tvAdd(),
 'ta-all':()=>allCollections(),
 'trade-pull':t=>pullDialog(t.dataset.id),
 'pl-toggle':t=>plToggle(t.dataset.key),
 'pl-inc':(t,e)=>{e&&e.stopPropagation();plStep(t.dataset.key,1);},
 'pl-dec':(t,e)=>{e&&e.stopPropagation();plStep(t.dataset.key,-1);},
 'pl-all':()=>plAll(true),
 'pl-none':()=>plAll(false),
 'trade-export':t=>tradeExport(t.dataset.id),
 'trade-bulk':t=>bulkDialog(t.dataset.id),
 'bk-toggle':t=>{const st=S.ui.bulk;if(!st)return;const k=t.dataset.key;if(st.sel.has(k))st.sel.delete(k);else st.sel.add(k);bulkPaint();},
 'bk-all':()=>{const st=S.ui.bulk;const t=st&&getTrade(st.id);if(!t)return;t.items.forEach(i=>st.sel.add(itemKey(i)));bulkPaint();},
 'bk-none':()=>{const st=S.ui.bulk;if(!st)return;st.sel.clear();bulkPaint();},
 'bk-apply':()=>bulkApply(),
 'bk-remove':()=>bulkRemove(),
 'trade-share':t=>shareDialog(t.dataset.id),
 'sh-create':t=>shareGo(t.dataset.id,true),
 'sh-update':t=>shareGo(t.dataset.id,false),
 'sh-stop':t=>shareStop(t.dataset.id),
 'sh-copy':async()=>{const i=$('#shl');if(!i)return;let ok=false;try{await navigator.clipboard.writeText(i.value);ok=true;}catch(e){i.select();try{ok=document.execCommand('copy');}catch(x){}}toast(ok?'Link copiado.':'Selecione o link e copie.');},
 'trade-inc':(t,e)=>{e&&e.stopPropagation();const x=getTrade(t.dataset.trade);const it=x&&x.items.find(i=>itemKey(i)===t.dataset.key);if(!it)return;setQty(x,t.dataset.key,it.q+1);saveAndRefresh();},
 'trade-dec':(t,e)=>{e&&e.stopPropagation();const x=getTrade(t.dataset.trade);const it=x&&x.items.find(i=>itemKey(i)===t.dataset.key);if(!it)return;setQty(x,t.dataset.key,it.q-1);saveAndRefresh();},
 'trade-item':t=>{const x=getTrade(t.dataset.trade);const it=x&&x.items.find(i=>itemKey(i)===t.dataset.key);if(it)openPanel(it.id,{tradeId:x.id,tradeKey:t.dataset.key});},
 'tp-dec':()=>tpStep(-1),
 'tp-inc':()=>tpStep(1),
 'tp-remove':()=>{const c=S.ui.panelCtx;const x=c&&getTrade(c.tradeId);if(!x)return;setQty(x,c.tradeKey,0);saveAndRefresh();closePanel();},
 'tr-item-save':()=>{
  const st=S.ui.tr;const x=st&&getTrade(st.id);if(!x)return;
  const q=Math.max(1,Math.min(999,parseInt($('#tiq').value,10)||1));
  const patch={q,f:$('#tif').value,l:$('#til').value};
  if(x.kind==='sell'){patch.c=$('#tic').value;patch.p=parsePrice($('#tip').value);}
  updateItem(x,st.key,patch);
  closeDlg();saveAndRefresh();
 },
 'tr-remove':()=>{const st=S.ui.tr;const x=st&&getTrade(st.id);if(!x)return;setQty(x,st.key,0);closeDlg();saveAndRefresh();}
};
