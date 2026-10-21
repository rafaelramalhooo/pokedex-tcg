/* Negociação: listas para vender/trocar ou procurar. Não afetam a coleção, a Dex nem os fichários. */
import {visibleSet} from '../catalog.js';
import {FIN_LABEL} from '../constants.js';
import {flagHTML, langOf} from '../cardlabel.js';
import {S, refreshAll} from '../state.js';
import {imgTag, noteHTML, toast} from '../ui.js';
import {$, ICON, esc, fmtN, live, nz} from '../util.js';
import {KINDS, addItem, getTrade, imgOf, itemKey, newTrade, saveTrades, setQty, snapOf, totalQty, updateItem} from '../trades.js';
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
  <div class="tools"><button class="btn" type="button" data-act="trade-add" data-id="${esc(id)}">Adicionar cartas</button>${t.kind==='sell'?`<button class="btn" type="button" data-act="trade-pull" data-id="${esc(id)}">Puxar das minhas cartas</button>`:''}<button class="btn primary" type="button" data-act="trade-export" data-id="${esc(id)}">Exportar imagem</button><button class="btn" type="button" data-act="trade-edit-list" data-id="${esc(id)}">Editar lista</button></div></div>
  <div id="tgrid"></div>`;
 renderTrade();
}
export function tradeTile(t,it){
 const key=itemKey(it);
 const tag=[it.f!=='normal'?(it.f==='reverse'?'Reverse':'Holo'):'',it.l&&it.l!=='xx'?it.l.toUpperCase():''].filter(Boolean).join(' · ');
 return`<div class="slot on tradeslot" data-act="trade-item" data-trade="${esc(t.id)}" data-key="${esc(key)}" role="button" tabindex="0" aria-label="${esc(it.n)}, ${it.q} unidade${it.q===1?'':'s'}. Editar">
  <div class="pocket">${imgTag(it.i,'low',it.n,undefined,it.id)}<span class="qty tq">×${it.q}</span></div>
  <div class="num"><b>${esc(it.n)}</b><span>${esc(it.no)} ${flagHTML(it.l||'xx')}</span></div>
  ${tag?`<div class="num"><span>${esc(tag)}</span></div>`:''}
  <div class="stepper"><button type="button" class="btn small" data-act="trade-dec" data-trade="${esc(t.id)}" data-key="${esc(key)}" aria-label="Diminuir">−</button><button type="button" class="btn small" data-act="trade-inc" data-trade="${esc(t.id)}" data-key="${esc(key)}" aria-label="Aumentar">+</button></div></div>`;
}
export function renderTrade(){
 if(!S.cur||S.cur.name!=='trade')return;
 const t=getTrade(S.cur.id);if(!t)return;
 $('#tname').textContent=t.name;$('#tchips').innerHTML=kindChip(t.kind)+` <span class="lead" style="margin:0">${fmtN(t.items.length)} carta${t.items.length===1?'':'s'} · ${fmtN(totalQty(t))} unidade${totalQty(t)===1?'':'s'}</span>`;
 const g=live($('#tgrid'));
 if(!t.items.length){
  g.innerHTML=`<div class="empty"><h3>Lista vazia</h3><p>Use “Adicionar cartas” para buscar pelo nome${t.kind==='sell'?' ou “Puxar das minhas cartas” para copiar o que você tem':''}.</p></div>`;
  return;
 }
 g.innerHTML=`<div class="cards">${t.items.map(it=>tradeTile(t,it)).join('')}</div>`;
}
const saveAndRefresh=()=>{saveTrades();if(S.cur&&S.cur.refresh)S.cur.refresh();};

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
export function renderAddTrade(){
 const st=S.ui.tradeAdd;const el=$('#tres');if(!st||!el)return;
 const t=getTrade(st.id);if(!t)return;
 const q=nz(st.q);
 if(q.length<2){el.innerHTML='<p class="lead">Digite ao menos 2 letras.</p>';return;}
 const res=[];
 for(const id in S.briefs){const c=S.briefs[id];if(!visibleSet(c.setId))continue;if(nz(c.name).includes(q)){res.push(id);if(res.length>=300)break;}}
 const list=res.slice(0,36);
 el.innerHTML=res.length?`<p class="lbl2">${fmtN(res.length)} resultados${res.length>list.length?', mostrando os primeiros '+list.length:''}. Toque na carta para adicionar.</p><div class="cards" style="--tile:110px">${list.map(id=>{
  const c=S.briefs[id];const set=S.setMap[c.setId];
  const n=t.items.filter(i=>i.id===id).reduce((a,i)=>a+i.q,0);
  return`<div class="slot ${n?'on':'off'}" data-act="tr-pick" data-id="${esc(id)}" role="button" tabindex="0" aria-label="${esc(c.name)}, ${esc(set?set.name:'')}, adicionar">
   <div class="pocket">${imgTag(c.image,'low',c.name)}${n?`<span class="qty">×${n}</span>`:''}</div>
   <div class="num"><b>${esc(c.name)}</b><span>${esc(c.localId)}</span></div><div class="num"><span>${esc(set?set.name:'')}</span></div></div>`;}).join('')}</div>`:'<p class="lead">Nenhuma carta com esse nome.</p>';
}
function addDialog(id){
 S.ui.tradeAdd={id,q:''};
 $('#dialog').innerHTML=`<h2>Adicionar cartas</h2>
  <div class="row" style="gap:10px;flex-wrap:wrap;align-items:flex-end">
   <div style="flex:1;min-width:200px"><label class="lbl2" for="tra">Buscar pelo nome da carta</label><input class="field" id="tra" type="search" style="width:100%" placeholder="Ex.: Pikachu"></div>
   <label class="size">Acabamento <select class="field" id="trf">${Object.entries(FIN_LABEL).map(([k,l])=>`<option value="${k}">${l}</option>`).join('')}</select></label>
   <label class="size">Idioma <select class="field" id="trl"><option value="">Da carta</option>${LANGS.map(([k,l])=>`<option value="${k}">${l}</option>`).join('')}</select></label></div>
  <div id="tres" style="margin-top:14px"></div>
  <div class="actions"><span></span><button class="btn primary" type="button" data-ed-act="cancel">Concluir</button></div>`;
 $('#modal').classList.add('on');setTimeout(()=>$('#tra').focus(),30);
 renderAddTrade();
}
function itemDialog(t,it){
 const key=itemKey(it);S.ui.tr={id:t.id,key};
 $('#dialog').innerHTML=`<h2>${esc(it.n)}</h2><p class="lead">${esc(it.no)}</p>
  <div class="row" style="gap:12px;flex-wrap:wrap">
   <label class="size">Quantidade <input class="field mini" id="tiq" type="number" min="1" max="999" value="${it.q}"></label>
   <label class="size">Acabamento <select class="field" id="tif">${Object.entries(FIN_LABEL).map(([k,l])=>`<option value="${k}" ${it.f===k?'selected':''}>${l}</option>`).join('')}</select></label>
   <label class="size">Idioma <select class="field" id="til">${LANGS.map(([k,l])=>`<option value="${k}" ${it.l===k?'selected':''}>${l}</option>`).join('')}</select></label></div>
  <div class="actions"><button class="btn" type="button" data-act="tr-remove">Remover da lista</button><span><button class="btn" type="button" data-ed-act="cancel">Cancelar</button> <button class="btn primary" type="button" data-act="tr-item-save">Salvar</button></span></div>`;
 $('#modal').classList.add('on');
}
export function tradeExport(id){
 const t=getTrade(id);if(!t)return;
 openExport({title:t.name,kindLabel:KINDS[t.kind],kindColor:t.kind==='want'?'#2F6FDE':'#D93A2B',scopes:null,build:()=>t.items.map(it=>({url:imgOf(it),n:it.n,no:it.no,q:it.q,f:it.f,l:it.l}))});
}

/* ---------- Puxar das minhas cartas, com seleção ---------- */
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
function pullDialog(id){
 const t=getTrade(id);if(!t)return;
 const rows=ownRows();
 if(!rows.length){toast('Você ainda não marcou cartas na sua coleção para copiar.');return;}
 S.ui.pull={id,q:'',set:'',rep:false,sel:{},rows};
 const sets=[...new Set(rows.map(r=>r.set).filter(Boolean))].map(sid=>({sid,name:(S.setMap[sid]&&S.setMap[sid].name)||sid})).sort((a,b)=>a.name.localeCompare(b.name,'pt'));
 $('#dialog').innerHTML=`<h2>Puxar das minhas cartas</h2><p class="lead">Marque as cartas que você quer copiar para “${esc(t.name)}”. Isso só copia: a sua coleção não muda.</p>
  <div class="row" style="gap:10px;flex-wrap:wrap;align-items:flex-end">
   <div style="flex:1;min-width:180px"><label class="lbl2" for="plq">Buscar pelo nome</label><input class="field" id="plq" type="search" style="width:100%" placeholder="Ex.: Pikachu"></div>
   <label class="size">Coleção <select class="field" data-pl="set"><option value="">Todas</option>${sets.map(x=>`<option value="${esc(x.sid)}">${esc(x.name)}</option>`).join('')}</select></label>
   <label class="size"><input type="checkbox" data-pl="rep"> Só repetidas (×2 ou mais)</label></div>
  <div class="row" style="gap:8px;margin-top:10px"><button class="btn small" type="button" data-act="pl-all">Marcar todas as visíveis</button><button class="btn small" type="button" data-act="pl-none">Limpar</button></div>
  <div id="pullres" style="margin-top:12px"></div>
  <div class="actions"><button class="btn" type="button" data-ed-act="cancel">Cancelar</button><button class="btn primary" type="button" data-act="pl-go" id="plgo">Copiar 0 cartas</button></div>`;
 $('#modal').classList.add('on');setTimeout(()=>$('#plq').focus(),30);
 renderPull();
}
function pullVisible(){
 const st=S.ui.pull;const t=getTrade(st.id);const q=nz(st.q);
 const inList=new Set(t.items.map(itemKey));
 return st.rows.filter(r=>(!st.set||r.set===st.set)&&(!st.rep||r.own>=2)&&(!q||nz(r.sn.n).includes(q))).map(r=>({...r,dup:inList.has(r.key)}));
}
export function renderPull(){
 const st=S.ui.pull;const el=$('#pullres');if(!st||!el)return;
 const vis=pullVisible();const list=vis.slice(0,PULL_MAX);
 el.innerHTML=vis.length?`<p class="lbl2">${fmtN(vis.length)} carta${vis.length===1?'':'s'}${vis.length>list.length?', mostrando as primeiras '+list.length+'. Use a busca ou o filtro para achar as outras':''}.</p><div class="cards" style="--tile:118px">${list.map(r=>{
  const on=!r.dup&&st.sel[r.key]!=null;const q=on?st.sel[r.key]:r.own;
  const tag=[r.f!=='normal'?(r.f==='reverse'?'Reverse':'Holo'):'',r.l&&r.l!=='xx'?r.l.toUpperCase():''].filter(Boolean).join(' · ');
  return`<div class="slot ${on?'on':'off'} plslot" ${r.dup?'':`data-act="pl-toggle" data-key="${esc(r.key)}"`} role="button" tabindex="0" aria-label="${esc(r.sn.n)}, você tem ${r.own}, ${r.dup?'já na lista':on?'marcada':'não marcada'}">
   <div class="pocket">${imgTag(r.sn.i,'low',r.sn.n,undefined,r.id)}${on?'<span class="tg on" aria-hidden="true">✓</span>':''}<span class="qty tq">${r.dup?'Já na lista':'×'+q}</span></div>
   <div class="num"><b>${esc(r.sn.n)}</b><span>${esc(r.sn.no)}</span></div>${tag?`<div class="num"><span>${esc(tag)}</span></div>`:''}
   ${on?`<div class="stepper"><button type="button" class="btn small" data-act="pl-dec" data-key="${esc(r.key)}" aria-label="Diminuir">−</button><button type="button" class="btn small" data-act="pl-inc" data-key="${esc(r.key)}" aria-label="Aumentar">+</button></div>`:`<div class="num"><span>Você tem ×${r.own}</span></div>`}</div>`;}).join('')}</div>`:'<p class="lead">Nenhuma carta com esse filtro.</p>';
 const n=Object.keys(st.sel).length;const b=$('#plgo');if(b){b.textContent=`Copiar ${n} carta${n===1?'':'s'}`;b.disabled=!n;}
}
export function pullFilter(k,v){const st=S.ui.pull;if(!st)return;st[k]=v;renderPull();}
function plToggle(key){
 const st=S.ui.pull;if(!st)return;
 const r=st.rows.find(x=>x.key===key);if(!r)return;
 if(st.sel[key]!=null)delete st.sel[key];else st.sel[key]=r.own;
 renderPull();
}
function plStep(key,d){
 const st=S.ui.pull;if(!st)return;const r=st.rows.find(x=>x.key===key);if(!r||st.sel[key]==null)return;
 st.sel[key]=Math.max(1,Math.min(r.own,st.sel[key]+d));renderPull();
}
function plAll(on){
 const st=S.ui.pull;if(!st)return;
 if(!on){st.sel={};}else pullVisible().forEach(r=>{if(!r.dup&&st.sel[r.key]==null)st.sel[r.key]=r.own;});
 renderPull();
}
function plGo(){
 const st=S.ui.pull;const t=st&&getTrade(st.id);if(!t)return;
 let n=0;
 for(const r of st.rows){const q=st.sel[r.key];if(q==null)continue;addItem(t,r.id,r.f,r.l,q);n++;}
 if(!n)return;
 saveTrades();closeDlg();S.ui.pull=null;
 if(S.cur&&S.cur.refresh)S.cur.refresh();
 toast(`Copiei ${n} carta${n===1?'':'s'} da sua coleção para a lista.`);
}

const closeDlg=()=>{$('#modal').classList.remove('on');S.ui.tr=null;S.ui.tradeAdd=null;S.ui.pull=null;};
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
  S.trades=S.trades.filter(y=>y.id!==x.id);saveTrades();closeDlg();location.hash='#/negociacao';
 },
 'trade-add':t=>addDialog(t.dataset.id),
 'tr-pick':t=>{
  const st=S.ui.tradeAdd;const x=st&&getTrade(st.id);if(!x)return;
  const f=($('#trf')||{}).value||'normal';const l=($('#trl')||{}).value||'';
  addItem(x,t.dataset.id,f,l||langOf(t.dataset.id),1);
  saveTrades();renderAddTrade();if(S.cur&&S.cur.refresh)S.cur.refresh();
 },
 'trade-pull':t=>pullDialog(t.dataset.id),
 'pl-toggle':t=>plToggle(t.dataset.key),
 'pl-inc':(t,e)=>{e&&e.stopPropagation();plStep(t.dataset.key,1);},
 'pl-dec':(t,e)=>{e&&e.stopPropagation();plStep(t.dataset.key,-1);},
 'pl-all':()=>plAll(true),
 'pl-none':()=>plAll(false),
 'pl-go':()=>plGo(),
 'trade-export':t=>tradeExport(t.dataset.id),
 'trade-inc':(t,e)=>{e&&e.stopPropagation();const x=getTrade(t.dataset.trade);const it=x&&x.items.find(i=>itemKey(i)===t.dataset.key);if(!it)return;setQty(x,t.dataset.key,it.q+1);saveAndRefresh();},
 'trade-dec':(t,e)=>{e&&e.stopPropagation();const x=getTrade(t.dataset.trade);const it=x&&x.items.find(i=>itemKey(i)===t.dataset.key);if(!it)return;setQty(x,t.dataset.key,it.q-1);saveAndRefresh();},
 'trade-item':t=>{const x=getTrade(t.dataset.trade);const it=x&&x.items.find(i=>itemKey(i)===t.dataset.key);if(it)itemDialog(x,it);},
 'tr-item-save':()=>{
  const st=S.ui.tr;const x=st&&getTrade(st.id);if(!x)return;
  const q=Math.max(1,Math.min(999,parseInt($('#tiq').value,10)||1));
  updateItem(x,st.key,{q,f:$('#tif').value,l:$('#til').value});
  closeDlg();saveAndRefresh();
 },
 'tr-remove':()=>{const st=S.ui.tr;const x=st&&getTrade(st.id);if(!x)return;setQty(x,st.key,0);closeDlg();saveAndRefresh();}
};
