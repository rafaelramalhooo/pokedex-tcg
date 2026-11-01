/* Cartas de jogo: estoque de cartas só para jogar, separado da coleção. Consulta rápida do que você tem por nome. */
import {visibleSet} from '../catalog.js';
import {S} from '../state.js';
import {imgTag, toast} from '../ui.js';
import {$, esc, fmtN, live, nz} from '../util.js';
import {importInto} from '../decktext.js';
import {ensureInfo, getDeck, nameKey, ownSplit, ownText, pool, tradeFromDeck} from '../decks.js';
import {addPlay, getPlay, playGroups, playText, playTotal, savePlay, setPlay} from '../play.js';
import {subTabs} from './decks.js';

const CATS=[['pokemon','Pokémon'],['treinador','Treinador'],['energia','Energia']];
const CHECK='<span class="plcheck" aria-hidden="true"><svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>';
const setName=sid=>(S.setMap[sid]&&S.setMap[sid].name)||sid||'';
const ui=()=>S.ui.pg||(S.ui.pg={q:'',cat:'',set:''});

/* ---------- tela principal ---------- */
export function viewPlay(){
 S.cur={name:'play',soft:renderPlay,refresh:renderPlay};
 const st=ui();st.q='';st.cat='';st.set='';
 $('#view').innerHTML=`${subTabs('play')}<div class="top"><div><h1>Cartas de jogo</h1><p class="lead">Cartas que você usa só para jogar. Elas ficam separadas da sua coleção e contam por nome: qualquer impressão serve. Use para saber quanto você tem antes de comprar.</p></div>
  <div class="tools"><button class="btn primary" type="button" data-act="pg-add">Adicionar cartas</button><button class="btn" type="button" data-act="pg-import">Importar lista</button><button class="btn" type="button" data-act="pg-fromdeck">Adicionar de um deck</button><button class="btn" type="button" data-act="pg-copy">Copiar lista</button></div></div>
  <div id="pgbar"></div><div id="pgbody"></div>`;
 renderPlay();
}
let infoBusy=false;
function needInfo(){
 if(infoBusy)return;
 const ids=[...new Set(S.play.map(e=>e.id))].filter(id=>!S.dinfo[id]);
 if(!ids.length)return;
 infoBusy=true;
 pool(ids,6,id=>ensureInfo(id)).finally(()=>{infoBusy=false;if(S.cur&&S.cur.name==='play')renderPlay();});
}
export function renderPlay(){
 if(!S.cur||S.cur.name!=='play')return;
 const st=ui();
 const bar=live($('#pgbar'));const body=live($('#pgbody'));if(!bar||!body)return;
 const all=playGroups();
 const sub=document.querySelector('.subtabs a[href="#/decks/cartas"] span');if(sub)sub.textContent=playTotal()||'';
 if(!all.length){
  bar.innerHTML='';
  body.innerHTML=`<div class="empty"><h3>Você ainda não tem cartas de jogo</h3><p>Adicione as cartas que você usa nos seus decks, uma a uma ou colando a lista do Pokémon TCG Live. Depois é só pesquisar pelo nome para ver quantas você tem.</p><button class="btn primary" type="button" data-act="pg-add">Adicionar cartas</button></div>`;
  return;
 }
 needInfo();
 const sets=[...new Set(S.play.map(e=>e.s).filter(Boolean))].map(sid=>({sid,name:setName(sid)})).sort((a,b)=>a.name.localeCompare(b.name,'pt'));
 const q=nz(st.q);
 const vis=all.filter(g=>(!q||nz(g.n).includes(q))&&(!st.cat||(g.cat||'pokemon')===st.cat)&&(!st.set||g.entries.some(e=>e.s===st.set)));
 const total=vis.reduce((a,g)=>a+g.q,0);
 if(!document.getElementById('pgq')){
  bar.innerHTML=`<div class="row" style="gap:10px;flex-wrap:wrap;align-items:flex-end;margin-bottom:12px">
   <div style="flex:1;min-width:200px"><label class="lbl2" for="pgq">Buscar pelo nome</label><input class="field" id="pgq" type="search" style="width:100%" placeholder="Ex.: Boss, Pikachu, Ultra Ball" value="${esc(st.q)}"></div>
   <div id="pgcats"></div>
   <label class="size">Expansão <select class="field" data-pg="set" id="pgset"></select></label></div><p class="lead" id="pgsum" style="margin:0 0 6px"></p>`;
 }
 const cats=$('#pgcats');if(cats)cats.innerHTML=`<div class="seg" role="group" aria-label="Categoria">${[['','Todas'],...CATS].map(([k,l])=>`<button type="button" data-act="pg-cat" data-v="${k}" aria-pressed="${st.cat===k}">${l}</button>`).join('')}</div>`;
 const sel=$('#pgset');if(sel){const h=`<option value="">Todas</option>${sets.map(x=>`<option value="${esc(x.sid)}" ${st.set===x.sid?'selected':''}>${esc(x.name)}</option>`).join('')}`;if(sel.innerHTML!==h)sel.innerHTML=h;}
 const sum=$('#pgsum');if(sum)sum.textContent=`${fmtN(total)} carta${total===1?'':'s'} · ${fmtN(vis.length)} nome${vis.length===1?'':'s'} diferente${vis.length===1?'':'s'}${vis.length<all.length?` (de ${fmtN(all.length)} no total)`:''}`;
 if(!vis.length){body.innerHTML='<p class="lead">Nenhuma carta com esse filtro.</p>';return;}
 const groups=st.cat?[[st.cat,(CATS.find(c=>c[0]===st.cat)||[])[1]]]:CATS;
 body.innerHTML=groups.map(([k,l])=>{
  const rows=vis.filter(g=>(g.cat||'pokemon')===k);if(!rows.length)return'';
  return`<h3 class="dsec">${l} <span>${rows.reduce((a,g)=>a+g.q,0)}</span></h3><div class="cards">${rows.map(tile).join('')}</div>`;
 }).join('');
}
function tile(g){
 const one=g.entries.length===1;
 const sub=one?`${esc(g.top.no)} · ${esc(setName(g.top.s))}`:`${g.entries.length} impressões`;
 return`<div class="slot on tradeslot pgslot" data-act="pg-open" data-k="${esc(g.k)}" role="button" tabindex="0" aria-label="${esc(g.n)}, você tem ${g.q}. Ver detalhes">
  <div class="pocket">${imgTag(g.i,'low',g.n,undefined,g.id)}<span class="qty tq">×${g.q}</span></div>
  <div class="num"><b>${esc(g.n)}</b><span>${esc(g.q)} na mão</span></div><div class="num"><span>${sub}</span></div>
  ${one?`<div class="stepper"><button type="button" class="btn small" data-act="pg-dec" data-id="${esc(g.top.id)}" aria-label="Diminuir">−</button><button type="button" class="btn small" data-act="pg-inc" data-id="${esc(g.top.id)}" aria-label="Aumentar">+</button></div>`:''}</div>`;
}
function change(id,d){
 const e=getPlay(id);if(!e)return;
 setPlay(id,e.q+d);savePlay();renderPlay();
 if(S.ui.pgd)paintDetail();
}

/* ---------- detalhe de uma carta (por impressão) ---------- */
const head=(title,sub,id)=>`<div class="tdhead"><div><h2>${title}</h2><span class="tdcount" ${id?`id="${id}"`:''}>${sub||''}</span></div><button class="btn primary" type="button" data-ed-act="cancel">Concluir</button></div>`;
function openDetail(k){
 S.ui.pgd={k};
 $('#dialog').innerHTML=`<div class="tdlg" id="pgdlg"></div>`;
 $('#modal').classList.add('on');
 paintDetail();
}
function paintDetail(){
 const st=S.ui.pgd;const el=$('#pgdlg');if(!st||!el)return;
 const g=playGroups().find(x=>x.k===st.k);
 if(!g){$('#modal').classList.remove('on');S.ui.pgd=null;return;}
 const own=ownSplit().get(g.k)||{c:0,p:0};
 el.innerHTML=`${head(esc(g.n),`${g.q} de jogo${own.c?` · ${own.c} na coleção`:''}`)}<div class="tdbody">
  ${g.entries.map(e=>`<div class="row pgrow" style="gap:12px;align-items:center;margin:8px 0"><div style="width:56px;flex:none">${imgTag(e.i,'low',e.n,undefined,e.id)}</div>
   <div style="flex:1;min-width:0"><b>${esc(e.n)}</b><div class="lead" style="margin:0">${esc(e.no)} · ${esc(setName(e.s))}</div></div>
   <div class="stepper" style="display:flex;gap:6px;align-items:center"><button type="button" class="btn small" data-act="pg-dec" data-id="${esc(e.id)}" aria-label="Diminuir">−</button><b style="min-width:30px;text-align:center">${e.q}</b><button type="button" class="btn small" data-act="pg-inc" data-id="${esc(e.id)}" aria-label="Aumentar">+</button></div>
   <button type="button" class="btn small" data-act="pg-rm" data-id="${esc(e.id)}">Remover</button></div>`).join('')}
  <div class="actions" style="margin-top:14px"><button class="btn" type="button" data-act="pg-more" data-n="${esc(g.n)}">Adicionar outra impressão</button><span></span></div></div>`;
}

/* ---------- adicionar por busca ---------- */
function setOptions(){
 const ids=new Set();for(const id in S.briefs){const c=S.briefs[id];if(visibleSet(c.setId))ids.add(c.setId);}
 return[...ids].map(sid=>({sid,name:setName(sid)})).sort((a,b)=>a.name.localeCompare(b.name,'pt'));
}
function addDialog(prefill){
 S.ui.pa={q:prefill||'',set:''};
 const opts=setOptions();
 $('#dialog').innerHTML=`<div class="tdlg">${head('Adicionar cartas de jogo',`${playTotal()} cartas`,'pgcount')}<div class="tdbody">
  <div class="row" style="gap:10px;flex-wrap:wrap;align-items:flex-end">
   <div style="flex:1;min-width:200px"><label class="lbl2" for="pga">Buscar pelo nome da carta</label><input class="field" id="pga" type="search" style="width:100%" placeholder="Ex.: Ultra Ball" value="${esc(prefill||'')}"></div>
   <label class="size">Expansão <select class="field" data-pa="set"><option value="">Todas</option>${opts.map(x=>`<option value="${esc(x.sid)}">${esc(x.name)}</option>`).join('')}</select></label></div>
  <p class="lead" style="margin:8px 0 0">Toque numa carta para colocá-la nas cartas de jogo. Use − e + para a quantidade. Qualquer impressão serve para jogar.</p>
  <div id="pares" style="margin-top:12px"></div></div></div>`;
 $('#modal').classList.add('on');setTimeout(()=>{const i=$('#pga');if(i){i.focus();}},30);
 renderAdd();
}
let addPaint=0;
const addSoon=()=>{if(addPaint)return;addPaint=setTimeout(()=>{addPaint=0;renderAdd();},350);};
export function paFilter(k,v){const st=S.ui.pa;if(!st)return;st[k]=v;renderAdd();}
export function renderAdd(){
 const st=S.ui.pa;const el=$('#pares');if(!st||!el)return;
 live(el);
 const q=nz(st.q);
 if(q.length<2){el.innerHTML='<p class="lead">Digite ao menos 2 letras do nome.</p>';return;}
 const res=[];
 for(const id in S.briefs){
  const c=S.briefs[id];if(!visibleSet(c.setId))continue;if(st.set&&c.setId!==st.set)continue;
  const i=S.dinfo[id];if(!(nz(c.name).includes(q)||(i&&nz(i.ne).includes(q))))continue;
  res.push(id);if(res.length>=400)break;
 }
 res.sort((a,b)=>S.briefs[a].name.localeCompare(S.briefs[b].name,'pt'));
 const shown=res.slice(0,80);
 const need=shown.filter(id=>!S.dinfo[id]);
 if(need.length)Promise.all(need.map(id=>ensureInfo(id).catch(()=>null))).then(()=>addSoon());
 const split=ownSplit();
 el.innerHTML=shown.length?`<p class="lbl2">${fmtN(res.length)} resultado${res.length===1?'':'s'}${res.length>shown.length?', mostrando os primeiros '+shown.length:''}.</p><div class="cards" style="--tile:118px">${shown.map(id=>{
  const c=S.briefs[id];const e=getPlay(id);const n=e?e.q:0;const v=split.get(nameKey(c.name));
  return`<div class="slot on plslot ${n?'sel':''}" data-act="pa-pick" data-id="${esc(id)}" role="button" tabindex="0" aria-label="${esc(c.name)}, ${esc(setName(c.setId))}, ${n?'nas cartas de jogo ×'+n:'adicionar'}">
   <div class="pocket">${imgTag(c.image,'low',c.name,undefined,id)}${n?CHECK+`<span class="qty tq">×${n}</span>`:''}</div>
   <div class="num"><b>${esc(c.name)}</b><span>${esc(c.localId)}</span></div><div class="num"><span>${esc(setName(c.setId))}</span></div>
   <div class="num"><span>${v&&(v.c||v.p)?esc(ownText(v)):'Você não tem'}</span></div>
   ${n?`<div class="stepper"><button type="button" class="btn small" data-act="pa-dec" data-id="${esc(id)}" aria-label="Diminuir">−</button><button type="button" class="btn small" data-act="pa-inc" data-id="${esc(id)}" aria-label="Aumentar">+</button></div>`:''}</div>`;}).join('')}</div>`:'<p class="lead">Nenhuma carta encontrada.</p>';
 const c=$('#pgcount');if(c)c.textContent=`${playTotal()} cartas`;
}
function pick(id,d){
 const e=getPlay(id);
 if(!e){if(d<0)return;addPlay(id,1);ensureInfo(id).then(()=>S.cur&&S.cur.refresh&&S.cur.refresh()).catch(()=>{});}
 else setPlay(id,e.q+d);
 savePlay();renderAdd();if(S.cur&&S.cur.refresh)S.cur.refresh();
}

/* ---------- importar do TCG Live ---------- */
function importDialog(){
 S.ui.pi={busy:false};
 $('#dialog').innerHTML=`<h2>Importar lista para as cartas de jogo</h2>
  <p class="lead">Cole a lista no formato do Pokémon TCG Live (“4 Riolu PRE 50”). As quantidades são <b>somadas</b> ao que você já tem; nada é apagado.</p>
  <label class="lbl2" for="pit">Lista de cartas</label><textarea class="field" id="pit" rows="14" style="width:100%;font-family:ui-monospace,Menlo,monospace;font-size:13px" placeholder="Pokémon: 12&#10;4 Riolu PRE 50&#10;..."></textarea>
  <p class="lead" id="pimsg" style="margin-top:8px"></p>
  <div class="actions"><button class="btn" type="button" data-ed-act="cancel">Cancelar</button><button class="btn primary" type="button" data-act="pi-go" id="pigo">Importar</button></div>`;
 $('#modal').classList.add('on');setTimeout(()=>{const n=$('#pit');if(n)n.focus();},30);
}
async function importGo(){
 const st=S.ui.pi;if(!st||st.busy)return;
 const text=$('#pit').value||'';if(!text.trim()){toast('Cole a lista de cartas.');return;}
 st.busy=true;$('#pigo').disabled=true;const msg=$('#pimsg');
 const tmp={items:S.play.map(e=>({...e}))};
 const r=await importInto(tmp,text,t=>{if(msg)msg.textContent=t;});
 st.busy=false;
 if(!r.ok){if(msg)msg.textContent='Não consegui reconhecer nenhuma carta. Confira se o texto está no formato “4 Nome SIGLA 123”.';$('#pigo').disabled=false;return;}
 S.play=tmp.items.map(e=>({...e,q:Math.min(999,e.q)}));savePlay();
 $('#dialog').innerHTML=`<h2>Cartas importadas</h2><p>${esc(`${r.ok} de ${r.total} linhas reconhecidas (${r.cards} cartas somadas).`)}</p>
  ${r.bad.length?`<div class="note err"><b>Não encontrei:</b><br>${r.bad.map(esc).join('<br>')}</div>`:''}
  ${r.notes.length?`<div class="note warn"><b>Confira:</b><br>${r.notes.map(esc).join('<br>')}</div>`:''}
  ${r.skipped.length?`<div class="note"><b>Linhas ignoradas:</b><br>${r.skipped.map(esc).join('<br>')}</div>`:''}
  <div class="actions"><span></span><button class="btn primary" type="button" data-ed-act="cancel">Concluir</button></div>`;
 S.ui.pi=null;if(S.cur&&S.cur.refresh)S.cur.refresh();
}

/* ---------- adicionar a partir de um deck ---------- */
export function deckPick(id){deckDialog(id,S.ui.pdk&&S.ui.pdk.mode);}
function deckDialog(sel,mode){
 if(!S.decks.length){toast('Você ainda não tem decks.');return;}
 const d=getDeck(sel)||S.decks[0];mode=mode||'missing';
 S.ui.pdk={id:d.id,mode};
 const miss=tradeFromDeck(d,'want');const all=d.items.reduce((a,i)=>a+i.q,0);
 const txt=!d.items.length?'O deck está vazio.':mode==='missing'?(miss.cards?`Serão adicionadas ${miss.cards} carta${miss.cards===1?'':'s'} (o que falta para completar “${d.name}” com a coleção e as cartas de jogo que você já tem).`:'Você já tem tudo deste deck. Não falta nada.'):`Serão adicionadas as ${all} cartas do deck, somadas ao que você já tem de jogo.`;
 const can=d.items.length&&(mode==='all'||miss.cards);
 $('#dialog').innerHTML=`<h2>Adicionar de um deck</h2>
  <p class="lead">Use depois de comprar as cartas de um deck: elas passam a contar como cartas de jogo. O deck não muda.</p>
  <label class="lbl2" for="pdks">Deck</label><select class="field" id="pdks" data-pg="deck" style="width:100%">${S.decks.map(x=>`<option value="${esc(x.id)}" ${x.id===d.id?'selected':''}>${esc(x.name)}</option>`).join('')}</select>
  <label class="lbl2" style="margin-top:12px">O que adicionar</label>
  <div class="seg" role="group" aria-label="O que adicionar"><button type="button" data-act="pdk-mode" data-v="missing" aria-pressed="${mode==='missing'}">Só o que falta</button><button type="button" data-act="pdk-mode" data-v="all" aria-pressed="${mode==='all'}">Todas as cartas do deck</button></div>
  <p class="note ${can?'':'warn'}" style="margin-top:14px">${esc(txt)}</p>
  <div class="actions"><button class="btn" type="button" data-ed-act="cancel">Cancelar</button><button class="btn primary" type="button" data-act="pdk-go" ${can?'':'disabled'}>Adicionar</button></div>`;
 $('#modal').classList.add('on');
}
function deckGo(){
 const st=S.ui.pdk;const d=st&&getDeck(st.id);if(!d)return;
 let n=0;
 if(st.mode==='all'){for(const it of d.items){addPlay(it.id,it.q);n+=it.q;}}
 else{const r=tradeFromDeck(d,'want');for(const it of r.items){addPlay(it.id,it.q);n+=it.q;}}
 savePlay();S.ui.pdk=null;$('#modal').classList.remove('on');
 d.items.forEach(it=>{ensureInfo(it.id).catch(()=>null);});
 if(S.cur&&S.cur.refresh)S.cur.refresh();
 toast(`${n} carta${n===1?'':'s'} adicionada${n===1?'':'s'} às cartas de jogo.`);
}

async function copyList(){
 const text=playText();if(!text){toast('Não há cartas para copiar.');return;}
 let ok=false;try{await navigator.clipboard.writeText(text);ok=true;}catch(e){}
 toast(ok?'Lista copiada.':'Não consegui copiar neste navegador.');
}

export function pgFilter(k,v){const st=ui();st[k]=v;renderPlay();}
export const PLAY_ACT={
 'pg-add':()=>addDialog(''),
 'pg-more':t=>addDialog(t.dataset.n||''),
 'pg-import':()=>importDialog(),
 'pi-go':()=>importGo(),
 'pg-fromdeck':()=>deckDialog(),
 'pdk-mode':t=>deckDialog(S.ui.pdk&&S.ui.pdk.id,t.dataset.v),
 'pdk-go':()=>deckGo(),
 'pg-copy':()=>copyList(),
 'pg-cat':t=>pgFilter('cat',t.dataset.v),
 'pg-open':t=>openDetail(t.dataset.k),
 'pg-inc':(t,e)=>{e&&e.stopPropagation();change(t.dataset.id,1);},
 'pg-dec':(t,e)=>{e&&e.stopPropagation();change(t.dataset.id,-1);},
 'pg-rm':t=>{const e=getPlay(t.dataset.id);if(!e)return;setPlay(e.id,0);savePlay();renderPlay();paintDetail();},
 'pa-pick':t=>pick(t.dataset.id,1),
 'pa-inc':(t,e)=>{e&&e.stopPropagation();pick(t.dataset.id,1);},
 'pa-dec':(t,e)=>{e&&e.stopPropagation();pick(t.dataset.id,-1);}
};
