/* Decks: montagem de 60 cartas com validação do Standard. Não mexem na coleção. */
import {visibleSet} from '../catalog.js';
import {S} from '../state.js';
import {imgTag, toast} from '../ui.js';
import {$, ICON, esc, fmtN, live, nz} from '../util.js';
import {exportRows, importInto, tcgText} from '../decktext.js';
import {addItem, newTrade, saveTrades} from '../trades.js';
import {DECK_SIZE, MAX_COPIES, addCopy, ensureInfo, ensureReprint, getDeck, legalOf, nameKey, newDeck, ownByName, resolveDeck, saveDecks, setCopies, totalCards, validate, nameCounts, tradeFromDeck} from '../decks.js';

const FMT={standard:'Standard',livre:'Livre (sem validar o Standard)'};
const CATS=[['pokemon','Pokémon'],['treinador','Treinador'],['energia','Energia']];
const CHECK='<span class="plcheck" aria-hidden="true"><svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>';

/* ---------- lista de decks ---------- */
export function viewDecks(){
 S.cur={name:'decks',soft:renderDecks,refresh:renderDecks};
 $('#view').innerHTML=`<div class="top"><div><h1>Decks</h1><p class="lead">Monte decks de 60 cartas e confira as regras do Standard. Os decks ficam separados da sua coleção.</p></div>
  <div class="tools"><button class="btn" type="button" data-act="deck-import">Importar do TCG Live</button><button class="btn primary" type="button" data-act="deck-new">Novo deck</button></div></div><div id="dbody"></div>`;
 renderDecks();
}
export function renderDecks(){
 const el=live($('#dbody'));if(!el)return;
 if(!S.decks.length){
  el.innerHTML=`<div class="empty"><h3>Você ainda não tem decks</h3><p>Crie um deck, busque as cartas pelo nome (inclusive só as que você tem) e veja na hora se ele está dentro das regras.</p><button class="btn primary" type="button" data-act="deck-new">Criar o primeiro deck</button></div>`;
  return;
 }
 el.innerHTML=`<div class="binders">${S.decks.map(d=>{
  const v=validate(d);const n=v.total;
  const st=!n?'Vazio':v.pending?'Conferindo…':v.ok?'Válido':v.errs?'Com problemas':'Válido, com avisos';
  const cls=!n||v.pending?'':v.errs?'bad':'ok';
  return`<a class="binder" href="#/decks/${esc(d.id)}"><div class="bmeta"><h3>${esc(d.name)}</h3>
   <div class="chips" style="margin:0"><span class="ttag fmt">${d.format==='standard'?'Standard':'Livre'}</span> <span class="dstat ${cls}">${st}</span></div>
   <div class="count"><strong>${n}/${DECK_SIZE}</strong><span>cartas</span></div></div></a>`;}).join('')}</div>`;
}

/* ---------- deck aberto ---------- */
export function viewDeck(id){
 const d=getDeck(id);
 if(!d){$('#view').innerHTML=`<a class="back" href="#/decks">${ICON.back} Decks</a><div class="empty"><h3>Deck não encontrado</h3></div>`;S.cur={name:'deck-missing'};return;}
 S.cur={name:'deck',id,soft:renderDeck,refresh:renderDeck};
 $('#view').innerHTML=`<a class="back" href="#/decks">${ICON.back} Decks</a>
  <div class="top"><div><h1 id="dname"></h1><div class="chips" id="dchips"></div></div>
  <div class="tools"><button class="btn primary" type="button" data-act="deck-add" data-id="${esc(id)}">Adicionar cartas</button><button class="btn" type="button" data-act="deck-export" data-id="${esc(id)}">Exportar</button><button class="btn" type="button" data-act="deck-trade" data-id="${esc(id)}">Criar lista de negociação</button><button class="btn" type="button" data-act="deck-edit" data-id="${esc(id)}">Editar deck</button></div></div>
  <div id="dvalid"></div><div id="dgrid"></div>`;
 renderDeck();
 resolveSoon(d);
}
let resolving=null;
function resolveSoon(d){
 if(resolving===d.id)return;resolving=d.id;
 resolveDeck(d,()=>{if(S.cur&&S.cur.name==='deck'&&S.cur.id===d.id)softPaint();}).finally(()=>{resolving=null;if(S.cur&&S.cur.name==='deck')renderDeck();});
}
let paint=0;
function softPaint(){if(paint)return;paint=setTimeout(()=>{paint=0;renderDeck();},400);}
const lglTag=l=>l==='no'?'<span class="lgl no">Fora do Standard</span>':l==='reprint'?'<span class="lgl rp">Reimpressão</span>':'';
function deckTile(d,it,own){
 const i=S.dinfo[it.id];const L=d.format==='standard'?legalOf(i):'ok';
 const k=i?i.nk:nameKey(it.n);const have=own.get(nameKey(it.n))||0;
 const over=!(i&&i.be)&&nameCounts(d).get(k)&&nameCounts(d).get(k).q>MAX_COPIES;
 return`<div class="slot on tradeslot dslot ${L==='no'?'illegal':''}" data-act="deck-card" data-id="${esc(it.id)}" role="button" tabindex="0" aria-label="${esc(it.n)}, ${it.q} cópia${it.q===1?'':'s'}">
  <div class="pocket">${imgTag(it.i,'low',it.n,undefined,it.id)}<span class="qty tq ${over?'over':''}">×${it.q}</span>${lglTag(L)}</div>
  <div class="num"><b>${esc(it.n)}</b><span>${esc(it.no)}</span></div>
  <div class="num"><span>${have?`Você tem ×${have}`:'Você não tem'}</span></div>
  <div class="stepper"><button type="button" class="btn small" data-act="deck-dec" data-id="${esc(it.id)}" aria-label="Diminuir">−</button><button type="button" class="btn small" data-act="deck-inc" data-id="${esc(it.id)}" aria-label="Aumentar">+</button></div></div>`;
}
export function renderDeck(){
 if(!S.cur||S.cur.name!=='deck')return;
 const d=getDeck(S.cur.id);if(!d)return;
 const v=validate(d);
 $('#dname').textContent=d.name;
 $('#dchips').innerHTML=`<span class="ttag fmt">${d.format==='standard'?'Standard':'Livre'}</span> <span class="dcount ${v.total===DECK_SIZE?'full':''}">${v.total}/${DECK_SIZE}</span> <span class="lead" style="margin:0">${CATS.map(([k,l])=>`${l} ${v.by[k]}`).join(' · ')}</span>`;
 const ok=v.ok;
 const list=v.issues.map(x=>`<li class="${x.lvl}">${esc(x.msg)}</li>`).join('');
 live($('#dvalid')).innerHTML=d.items.length?`<div class="dval ${ok?'ok':v.errs?'bad':'warn'}"><b>${ok?(d.format==='standard'?'Deck válido para o Standard':'Deck completo'):v.pending?'Conferindo as cartas…':v.errs?'O deck ainda tem problemas':'Deck válido, com avisos'}</b>${list?`<ul>${list}</ul>`:''}</div>`:'';
 const g=live($('#dgrid'));
 if(!d.items.length){g.innerHTML=`<div class="empty"><h3>Deck vazio</h3><p>Use “Adicionar cartas” para buscar pelo nome${S.collection&&Object.keys(S.collection).length?' ou marque “Só as que eu tenho”':''}.</p></div>`;return;}
 const own=ownByName();
 g.innerHTML=CATS.map(([k,l])=>{
  const rows=d.items.filter(it=>{const i=S.dinfo[it.id];return(i?i.cat:'pokemon')===k;}).sort((a,b)=>a.n.localeCompare(b.n,'pt'));
  if(!rows.length)return'';
  return`<h3 class="dsec">${l} <span>${rows.reduce((a,i)=>a+i.q,0)}</span></h3><div class="cards">${rows.map(it=>deckTile(d,it,own)).join('')}</div>`;
 }).join('');
}

/* ---------- janelas ---------- */
const dHead=(title,txt)=>`<div class="tdhead"><div><h2>${title}</h2><span class="tdcount" id="tdcount">${txt}</span></div><button class="btn primary" type="button" data-ed-act="cancel">Concluir</button></div>`;
const cntTxt=d=>`${totalCards(d)}/${DECK_SIZE} cartas`;
function deckDialog(d,isNew){
 S.ui.dk={d:{...d},isNew};
 $('#dialog').innerHTML=`<h2>${isNew?'Novo deck':'Editar deck'}</h2>
  <label class="lbl2" for="dkn">Nome do deck</label><input class="field" id="dkn" style="width:100%" maxlength="40" value="${esc(d.name==='Novo deck'?'':d.name)}" placeholder="Ex.: Lucario ex">
  <label class="lbl2" style="margin-top:12px">Formato</label>
  <div class="seg" role="group" aria-label="Formato"><button type="button" data-act="dk-fmt" data-v="standard" aria-pressed="${d.format==='standard'}">Standard</button><button type="button" data-act="dk-fmt" data-v="livre" aria-pressed="${d.format==='livre'}">Livre</button></div>
  <p class="lead" style="margin-top:8px">No Standard o app confere as marcas de regulamentação e as reimpressões. No formato Livre ele só confere 60 cartas e o limite de cópias.</p>
  <div class="actions">${isNew?'<span></span>':`<button class="btn" type="button" data-act="deck-del" data-id="${esc(d.id)}">Excluir deck</button>`}<span><button class="btn" type="button" data-ed-act="cancel">Cancelar</button> <button class="btn primary" type="button" data-act="dk-save">Salvar</button></span></div>`;
 $('#modal').classList.add('on');setTimeout(()=>{const n=$('#dkn');if(n)n.focus();},30);
}

function setOptions(){
 const ids=new Set();for(const id in S.briefs){const c=S.briefs[id];if(visibleSet(c.setId))ids.add(c.setId);}
 return[...ids].map(sid=>({sid,name:(S.setMap[sid]&&S.setMap[sid].name)||sid})).sort((a,b)=>a.name.localeCompare(b.name,'pt'));
}
function addDialog(id){
 const d=getDeck(id);if(!d)return;
 S.ui.deckAdd={id,q:'',set:'',own:false,legal:d.format==='standard'};
 const opts=setOptions();
 $('#dialog').innerHTML=`<div class="tdlg">${dHead('Adicionar cartas',cntTxt(d))}<div class="tdbody">
  <div class="row" style="gap:10px;flex-wrap:wrap;align-items:flex-end">
   <div style="flex:1;min-width:200px"><label class="lbl2" for="dka">Buscar pelo nome da carta</label><input class="field" id="dka" type="search" style="width:100%" placeholder="Ex.: Lucario"></div>
   <label class="size">Coleção <select class="field" data-dk="set"><option value="">Todas</option>${opts.map(x=>`<option value="${esc(x.sid)}">${esc(x.name)}</option>`).join('')}</select></label></div>
  <div class="row" style="gap:16px;margin-top:8px;flex-wrap:wrap"><label class="size"><input type="checkbox" data-dk="own"> Só as que eu tenho</label>${d.format==='standard'?'<label class="size"><input type="checkbox" data-dk="legal" checked> Esconder as fora do Standard</label>':''}</div>
  <p class="lead" id="dkhint" style="margin:8px 0 0">Toque numa carta para colocá-la no deck. Use − e + para a quantidade.</p>
  <div id="dkres" style="margin-top:12px"></div></div></div>`;
 $('#modal').classList.add('on');setTimeout(()=>{const i=$('#dka');if(i)i.focus();},30);
 renderAdd();
}
export function deckExportLang(v){const st=S.ui.dx;if(!st)return;st.lang=v;dxRefresh();}
export function deckAddFilter(k,v){const st=S.ui.deckAdd;if(!st)return;st[k]=v;renderAdd();}
let addPaint=0;
const addSoon=()=>{if(addPaint)return;addPaint=setTimeout(()=>{addPaint=0;renderAdd();},350);};
export function renderAdd(){
 const st=S.ui.deckAdd;const el=$('#dkres');const d=st&&getDeck(st.id);if(!st||!el||!d)return;
 live(el);
 const q=nz(st.q);const own=ownByName();
 if(q.length<2&&!st.own){el.innerHTML='<p class="lead">Digite ao menos 2 letras, ou marque “Só as que eu tenho”.</p>';return;}
 let res=[];
 for(const id in S.briefs){
  const c=S.briefs[id];if(!visibleSet(c.setId))continue;if(st.set&&c.setId!==st.set)continue;
  if(st.own&&!own.has(nameKey(c.name)))continue;
  if(q.length>=2){const i=S.dinfo[id];if(!(nz(c.name).includes(q)||(i&&nz(i.ne).includes(q))))continue;}
  res.push(id);if(res.length>=400)break;
 }
 res.sort((a,b)=>S.briefs[a].name.localeCompare(S.briefs[b].name,'pt'));
 const check=st.legal&&d.format==='standard';
 const shown=res.slice(0,80);
 const need=shown.filter(id=>!S.dinfo[id]);
 if(need.length)Promise.all(need.slice(0,80).map(id=>ensureInfo(id).catch(()=>null))).then(()=>addSoon());
 let list=shown;
 if(check){
  const needR=shown.map(id=>S.dinfo[id]).filter(i=>i&&!i.be&&!['ok','exc'].includes(legalOf(i))&&i.rp===undefined);
  if(needR.length)Promise.all(needR.slice(0,12).map(i=>ensureReprint(i))).then(()=>addSoon());
  list=shown.filter(id=>legalOf(S.dinfo[id])!=='no');
 }
 el.innerHTML=list.length?`<p class="lbl2">${fmtN(res.length)} resultado${res.length===1?'':'s'}${res.length>shown.length?', mostrando os primeiros '+shown.length:''}${check&&list.length<shown.length?` · ${shown.length-list.length} fora do Standard escondida${shown.length-list.length===1?'':'s'}`:''}.</p><div class="cards" style="--tile:118px">${list.map(id=>{
  const c=S.briefs[id];const set=S.setMap[c.setId];const it=d.items.find(x=>x.id===id);const n=it?it.q:0;
  const L=d.format==='standard'?legalOf(S.dinfo[id]):'ok';const have=own.get(nameKey(c.name))||0;
  return`<div class="slot on plslot ${n?'sel':''}" data-act="dk-pick" data-id="${esc(id)}" role="button" tabindex="0" aria-label="${esc(c.name)}, ${esc(set?set.name:'')}, ${n?'no deck ×'+n:'adicionar'}">
   <div class="pocket">${imgTag(c.image,'low',c.name,undefined,id)}${n?CHECK+`<span class="qty tq">×${n}</span>`:''}${lglTag(L)}</div>
   <div class="num"><b>${esc(c.name)}</b><span>${esc(c.localId)}</span></div><div class="num"><span>${esc(set?set.name:'')}</span></div><div class="num"><span>${have?`Você tem ×${have}`:'Você não tem'}</span></div>
   ${n?`<div class="stepper"><button type="button" class="btn small" data-act="dk-dec" data-id="${esc(id)}" aria-label="Diminuir">−</button><button type="button" class="btn small" data-act="dk-inc" data-id="${esc(id)}" aria-label="Aumentar">+</button></div>`:''}</div>`;}).join('')}</div>`:`<p class="lead">${shown.length?'Todas as cartas encontradas estão fora do Standard. Desmarque “Esconder as fora do Standard” para vê-las.':'Nenhuma carta encontrada.'}</p>`;
 const c=$('#tdcount');if(c)c.textContent=cntTxt(d);
}
function commit(d){
 saveDecks();
 const c=$('#tdcount');if(c)c.textContent=cntTxt(d);
 if(S.cur&&S.cur.refresh)S.cur.refresh();
 resolveSoon(d);
}
function pick(id,delta){
 const st=S.ui.deckAdd;const d=st&&getDeck(st.id);if(!d)return;
 const it=d.items.find(x=>x.id===id);
 if(!it){if(delta<0)return;addCopy(d,id,1);ensureInfo(id).then(()=>S.cur&&S.cur.refresh&&S.cur.refresh()).catch(()=>{});}
 else setCopies(d,id,it.q+delta);
 commit(d);renderAdd();
}


/* ---------- exportar: texto do TCG Live e página de impressão (PDF) ---------- */
const stamp=()=>new Date().toLocaleDateString('pt-BR');
const fileName=d=>(d.name||'deck').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^\w-]+/g,'-').replace(/^-|-$/g,'').toLowerCase()||'deck';
async function exportDialog(id){
 const d=getDeck(id);if(!d)return;
 S.ui.dx={id,lang:'pt',rows:null,text:''};
 $('#dialog').innerHTML=`<div class="tdlg">${dHead('Exportar deck',cntTxt(d))}<div class="tdbody">
  <p class="lead" id="dxmsg">Preparando a lista…</p>
  <label class="size">Títulos das seções <select class="field" data-dx="lang"><option value="pt">Português (Pokémon, Treinador, Energia)</option><option value="en">Inglês (Pokémon, Trainer, Energy)</option></select></label>
  <textarea class="field" id="dxtext" readonly rows="16" style="width:100%;margin-top:10px;font-family:ui-monospace,Menlo,monospace;font-size:13px" aria-label="Lista do deck"></textarea>
  <div class="row" style="gap:8px;margin-top:10px;flex-wrap:wrap"><button class="btn primary" type="button" data-act="dx-copy">Copiar texto</button><button class="btn" type="button" data-act="dx-txt">Baixar .txt</button><button class="btn" type="button" data-act="dx-print">Imprimir ou salvar em PDF</button></div>
  <p class="lead" style="margin-top:10px">Cole o texto em “Importar” no Pokémon TCG Live. Para o PDF, na janela de impressão escolha “Salvar como PDF” (no celular, use Compartilhar → Salvar em Arquivos).</p></div></div>`;
 $('#modal').classList.add('on');
 const st=S.ui.dx;
 st.rows=await exportRows(d,()=>{});
 if(S.ui.dx!==st)return;
 dxRefresh();
}
function dxRefresh(){
 const st=S.ui.dx;if(!st||!st.rows)return;
 st.text=tcgText(st.rows,st.lang);
 const t=$('#dxtext');if(t)t.value=st.text;
 const miss=st.rows.filter(r=>!r.ab).length;
 const m=$('#dxmsg');if(m)m.textContent=miss?`${miss} carta${miss===1?'':'s'} sem sigla de expansão na TCGdex (ficam só com o nome). Confira essas linhas no jogo.`:'Lista pronta no formato do Pokémon TCG Live.';
}
async function copyText(text){
 try{await navigator.clipboard.writeText(text);return true;}catch(e){}
 const t=$('#dxtext');if(!t)return false;t.select();try{return document.execCommand('copy');}catch(e){return false;}
}
function printSheet(d,rows){
 const sec=([k,l])=>{const part=rows.filter(r=>r.cat===k);if(!part.length)return'';
  return`<h2>${l} <span>${part.reduce((a,r)=>a+r.q,0)}</span></h2><table>${part.map(r=>`<tr><td class="q">${r.q}</td><td>${esc(r.name)}${r.namePt&&nz(r.namePt)!==nz(r.name)?` <small>${esc(r.namePt)}</small>`:''}</td><td class="c">${esc(r.ab)} ${esc(r.no)}</td></tr>`).join('')}</table>`;};
 const el=$('#printsheet');
 el.innerHTML=`<h1>${esc(d.name)}</h1><p class="meta">${d.format==='standard'?'Standard':'Livre'} · ${rows.reduce((a,r)=>a+r.q,0)} cartas · ${stamp()}</p>${CATS.map(sec).join('')}<p class="foot">Lista gerada pelo app pessoal Pokemon TCG Gestão de Coleção. Não afiliado à The Pokémon Company.</p>`;
}
function deckImportDialog(){
 S.ui.di={busy:false};
 $('#dialog').innerHTML=`<h2>Importar do Pokémon TCG Live</h2>
  <p class="lead">No jogo, abra o deck, use “Exportar” e cole o texto aqui. O app procura cada carta pela sigla da expansão e pelo número, e depois pelo nome.</p>
  <label class="lbl2" for="din">Nome do deck</label><input class="field" id="din" style="width:100%" maxlength="40" placeholder="Ex.: Lucario ex">
  <label class="lbl2" for="dit" style="margin-top:12px">Lista do deck</label><textarea class="field" id="dit" rows="14" style="width:100%;font-family:ui-monospace,Menlo,monospace;font-size:13px" placeholder="Pokémon: 12&#10;4 Riolu PRE 50&#10;..."></textarea>
  <p class="lead" id="dimsg" style="margin-top:8px"></p>
  <div class="actions"><button class="btn" type="button" data-ed-act="cancel">Cancelar</button><button class="btn primary" type="button" data-act="di-go" id="digo">Importar</button></div>`;
 $('#modal').classList.add('on');setTimeout(()=>{const n=$('#din');if(n)n.focus();},30);
}
async function deckImportGo(){
 const st=S.ui.di;if(!st||st.busy)return;
 const text=($('#dit').value||'');const name=($('#din').value||'').trim()||'Deck importado';
 if(!text.trim()){toast('Cole a lista do deck.');return;}
 st.busy=true;$('#digo').disabled=true;
 const d=newDeck(name);const msg=$('#dimsg');
 const r=await importInto(d,text,t=>{if(msg)msg.textContent=t;});
 st.busy=false;
 if(!r.ok){if(msg)msg.textContent='Não consegui reconhecer nenhuma carta. Confira se o texto está no formato “4 Nome SIGLA 123”.';$('#digo').disabled=false;return;}
 S.decks.push(d);saveDecks();
 const rep=[`${r.ok} de ${r.total} linhas reconhecidas (${r.cards} cartas).`];
 $('#dialog').innerHTML=`<h2>Deck importado</h2><p>${esc(rep[0])}</p>
  ${r.bad.length?`<div class="note err"><b>Não encontrei:</b><br>${r.bad.map(esc).join('<br>')}</div>`:''}
  ${r.notes.length?`<div class="note warn"><b>Confira:</b><br>${r.notes.map(esc).join('<br>')}</div>`:''}
  ${r.skipped.length?`<div class="note"><b>Linhas ignoradas:</b><br>${r.skipped.map(esc).join('<br>')}</div>`:''}
  <div class="actions"><span></span><button class="btn primary" type="button" data-act="di-open" data-id="${esc(d.id)}">Abrir o deck</button></div>`;
}

/* ---------- criar lista de negociação a partir do deck ---------- */
function tradeDialog(id,kind){
 const d=getDeck(id);if(!d)return;
 kind=kind||'want';
 S.ui.dt={id,kind};
 const r=tradeFromDeck(d,kind);
 const total=totalCards(d);
 const msg=!d.items.length?'O deck está vazio.':kind==='want'
  ?(r.cards?`Faltam ${r.cards} carta${r.cards===1?'':'s'} (${r.names} nome${r.names===1?'':'s'} diferente${r.names===1?'':'s'}) para você montar este deck com a sua coleção.`:'Você já tem todas as cartas deste deck. Não falta nada.')
  :(r.cards?`Você tem ${r.cards} das ${total} cartas do deck. A lista leva as impressões que estão na sua coleção.`:'Você não tem nenhuma carta deste deck na coleção.');
 $('#dialog').innerHTML=`<h2>Criar lista de negociação</h2>
  <p class="lead">A lista é criada na área Negociação a partir de “${esc(d.name)}”. A sua coleção e o deck não mudam.</p>
  <label class="lbl2">Tipo da lista</label>
  <div class="seg" role="group" aria-label="Tipo da lista"><button type="button" data-act="dt-kind" data-v="want" aria-pressed="${kind==='want'}">Procuro (o que falta)</button><button type="button" data-act="dt-kind" data-v="sell" aria-pressed="${kind==='sell'}">Vendo / Troco (o que eu tenho)</button></div>
  <p class="note ${r.cards?'':'warn'}" style="margin-top:14px">${esc(msg)}</p>
  <label class="lbl2" for="dtn">Nome da lista</label><input class="field" id="dtn" style="width:100%" maxlength="40" value="${esc((d.name+(kind==='want'?' – faltam':' – vendo')).slice(0,40))}">
  <div class="actions"><button class="btn" type="button" data-ed-act="cancel">Cancelar</button><button class="btn primary" type="button" data-act="dt-go" ${r.cards?'':'disabled'}>Criar lista</button></div>`;
 $('#modal').classList.add('on');
}
function tradeGo(){
 const st=S.ui.dt;const d=st&&getDeck(st.id);if(!d)return;
 const r=tradeFromDeck(d,st.kind);if(!r.cards)return;
 const name=($('#dtn').value||'').trim()||d.name;
 const t=newTrade(name,st.kind);
 r.items.forEach(x=>addItem(t,x.id,x.f,x.l,x.q));
 S.trades.push(t);saveTrades();S.ui.dt=null;$('#modal').classList.remove('on');
 location.hash='#/negociacao/'+t.id;
 toast(`Lista criada com ${r.cards} carta${r.cards===1?'':'s'}.`);
}

export const DECK_ACT={
 'deck-new':()=>deckDialog(newDeck(''),true),
 'dk-fmt':t=>{document.querySelectorAll('[data-act=dk-fmt]').forEach(b=>b.setAttribute('aria-pressed',String(b===t)));if(S.ui.dk)S.ui.dk.d.format=t.dataset.v;},
 'dk-save':()=>{
  const st=S.ui.dk;if(!st)return;
  const name=($('#dkn').value||'').trim();if(!name){toast('Dê um nome para o deck.');return;}
  st.d.name=name;
  const i=S.decks.findIndex(x=>x.id===st.d.id);
  if(i>=0)Object.assign(S.decks[i],{name:st.d.name,format:st.d.format});else S.decks.push(st.d);
  saveDecks();const isNew=st.isNew;S.ui.dk=null;$('#modal').classList.remove('on');
  if(isNew)location.hash='#/decks/'+st.d.id;else if(S.cur&&S.cur.refresh)S.cur.refresh();
 },
 'deck-edit':t=>{const d=getDeck(t.dataset.id);if(d)deckDialog(d,false);},
 'deck-del':t=>{
  const d=getDeck(t.dataset.id);if(!d)return;
  if(!confirm(`Excluir o deck “${d.name}”? Sua coleção não muda.`))return;
  S.decks=S.decks.filter(x=>x.id!==d.id);saveDecks();$('#modal').classList.remove('on');location.hash='#/decks';
 },
 'deck-add':t=>addDialog(t.dataset.id),
 'dk-pick':t=>pick(t.dataset.id,1),
 'dk-inc':(t,e)=>{e&&e.stopPropagation();pick(t.dataset.id,1);},
 'dk-dec':(t,e)=>{e&&e.stopPropagation();pick(t.dataset.id,-1);},
 'deck-card':()=>{},
 'deck-trade':t=>tradeDialog(t.dataset.id),
 'dt-kind':t=>tradeDialog(S.ui.dt.id,t.dataset.v),
 'dt-go':()=>tradeGo(),
 'deck-export':t=>exportDialog(t.dataset.id),
 'dx-copy':async()=>{const st=S.ui.dx;if(!st||!st.text)return;toast(await copyText(st.text)?'Lista copiada.':'Não consegui copiar; selecione o texto e copie.');},
 'dx-txt':()=>{const st=S.ui.dx;const d=st&&getDeck(st.id);if(!d||!st.text)return;const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([st.text],{type:'text/plain'}));a.download=fileName(d)+'.txt';document.body.appendChild(a);a.click();a.remove();},
 'dx-print':()=>{const st=S.ui.dx;const d=st&&getDeck(st.id);if(!d||!st.rows)return;printSheet(d,st.rows);document.title=d.name;setTimeout(()=>window.print(),80);},
 'deck-import':()=>deckImportDialog(),
 'di-go':()=>deckImportGo(),
 'di-open':t=>{$('#modal').classList.remove('on');location.hash='#/decks/'+t.dataset.id;},
 'deck-inc':(t,e)=>{e&&e.stopPropagation();const d=S.cur&&getDeck(S.cur.id);const it=d&&d.items.find(x=>x.id===t.dataset.id);if(!it)return;setCopies(d,it.id,it.q+1);commit(d);},
 'deck-dec':(t,e)=>{e&&e.stopPropagation();const d=S.cur&&getDeck(S.cur.id);const it=d&&d.items.find(x=>x.id===t.dataset.id);if(!it)return;setCopies(d,it.id,it.q-1);commit(d);}
};
