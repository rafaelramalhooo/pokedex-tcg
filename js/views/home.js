/* Tela inicial: coleções. */
import {mySets} from '../catalog.js';
import {hueOf, logoImg} from '../logos.js';
import {groupBySet, ownedQty, setStat} from '../collection.js';
import {S, soft} from '../state.js';
import {modeSeg, noteHTML} from '../ui.js';
import {$, $$, esc, fmtDate, fmtN, nz, pct} from '../util.js';

export function viewHome(){
 S.cur={name:'home',soft:renderHome,refresh:renderHome};
 $('#view').innerHTML=`
  <div class="top">
   <div><h1>Coleções</h1><p class="lead">As coleções que você escolheu acompanhar. Abra uma para marcar as cartas que você tem.</p></div>
   <div class="tools"><input class="field" id="q" type="search" placeholder="Buscar coleção" aria-label="Buscar coleção" value="${esc(S.ui.q)}"><a class="btn" href="#/expansoes">Minhas coleções</a>${modeSeg()}</div>
  </div>
  <div id="homebody"></div>`;
 renderHome();
}
export function statusNotes(){
 let h='';
 if(!S.persist)h+=noteHTML('warn','Seu navegador não permitiu salvar dados neste modo de abertura. Abra o app por um servidor local (veja o LEIA-ME) para que a coleção fique guardada.');
 if(S.status.catalog==='error')h+=noteHTML('err',`Não consegui acessar a TCGdex (${esc(S.status.err)}). Verifique a conexão. <button class="btn small" data-act="retry-catalog" type="button">Tentar de novo</button>`);
 if(S.status.pre)h+=noteHTML('',`Carregando as coleções escolhidas: ${S.status.pre.done} de ${S.status.pre.total}.`);
 if(S.status.cl)h+=noteHTML('',`Baixando os detalhes das cartas das suas coleções: ${S.status.cl.done} de ${S.status.cl.total}. Você já pode navegar; o Master Set e as regras completam à medida que chegam.${S.status.cl.fail?` (${S.status.cl.fail} falharam; dá para retomar em Catálogo e ajustes.)`:''}`);
 return h;
}
export function renderHome(){
 const body=$('#homebody');if(!body)return;
 const mode=S.settings.mode;
 $$('[data-act=mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.v===mode)));
 const sets=mySets();
 if(S.sets.length&&!sets.length){
  body.innerHTML=statusNotes()+`<div class="empty"><h3>Escolha as coleções que você quer acompanhar</h3><p>Para não baixar o catálogo inteiro, o app carrega só as coleções que você escolher. Marque uma série inteira ou apenas algumas coleções.</p><a class="btn primary" href="#/expansoes">Escolher coleções</a></div>`;
  return;
 }
 if(!sets.length){
  body.innerHTML=statusNotes()+(S.status.catalog==='error'?'':`<div class="sets">${'<div class="skel"></div>'.repeat(12)}</div>`);
  return;
 }
 const bySet=groupBySet();
 const stats={};let diff=0,copies=0,done=0;
 sets.forEach(s=>{stats[s.id]=setStat(s,bySet);if(stats[s.id].tot>0&&stats[s.id].own>=stats[s.id].tot)done++;});
 for(const id in S.collection){const q=ownedQty(id);if(q>0){diff++;copies+=q;}}
 /* grupos por série, da mais nova para a mais antiga */
 const groups=[];const gm={};
 sets.slice().reverse().forEach(s=>{
  const se=S.serieOf[s.id];const name=se?se.name:'Outras';
  if(!gm[name]){gm[name]={name,sets:[]};groups.push(gm[name]);}
  gm[name].sets.push(s);
 });
 const q=nz(S.ui.q);
 const serieSel=S.ui.serie;
 const hasOwn=s=>{const t=stats[s.id];return t&&(t.own>0||t.ownM>0);};
 const anyOwn=sets.some(hasOwn);
 const scope=S.ui.scope==='auto'?(anyOwn?'mine':'all'):S.ui.scope;
 const pool=scope==='mine'?sets.filter(hasOwn):sets;
 const nHidden=sets.length-pool.length;
 const gl=[];const gmm={};
 sets.slice().reverse().forEach(s=>{if(!pool.includes(s))return;const se=S.serieOf[s.id];const name=se?se.name:'Outras';if(!gmm[name]){gmm[name]={name,sets:[]};gl.push(gmm[name]);}gmm[name].sets.push(s);});
 const shown=gl.filter(g=>serieSel==='all'||g.name===serieSel).map(g=>({name:g.name,sets:g.sets.filter(s=>!q||nz(s.name).includes(q)||nz(s.id).includes(q))})).filter(g=>g.sets.length);
 const scopeSeg=anyOwn?`<div class="tabs scope" role="group" aria-label="Quais coleções mostrar"><button type="button" data-act="scope" data-v="mine" aria-pressed="${scope==='mine'}">Com cartas minhas</button><button type="button" data-act="scope" data-v="all" aria-pressed="${scope==='all'}">Todas as escolhidas${nHidden&&scope==='mine'?` (+${nHidden})`:''}</button></div>`:'';
 const tabs=scopeSeg+`<div class="tabs" role="group" aria-label="Filtrar por série"><button type="button" data-act="serie" data-v="all" aria-pressed="${serieSel==='all'}">Todas</button>${gl.map(g=>`<button type="button" data-act="serie" data-v="${esc(g.name)}" aria-pressed="${serieSel===g.name}">${esc(g.name)}</button>`).join('')}</div>`;
 const summary=`<div class="summary"><div><b>${fmtN(diff)}</b><span>cartas diferentes</span></div><div><b>${fmtN(copies)}</b><span>exemplares</span></div><div><b>${fmtN(done)}</b><span>coleções completas (Set)</span></div></div>`;
 const grid=shown.length?shown.map(g=>`
  <section class="series"><div class="series-head"><h2>${esc(g.name)}</h2><small>${g.sets.length} ${g.sets.length===1?'coleção':'coleções'}</small></div>
  <div class="sets">${g.sets.map(s=>setTile(s,stats[s.id],mode)).join('')}</div></section>`).join('')
  :`<div class="empty"><h3>Nenhuma coleção encontrada</h3><p>Tente outro nome ou limpe o filtro de série.</p></div>`;
 body.innerHTML=statusNotes()+summary+tabs+grid;
}
export function setTile(s,st,mode){
 const d=S.setd[s.id];
 const logo=logoImg(s);
 const sym=s.symbol?`<img class="sym" loading="lazy" alt="" src="${esc(s.symbol)}.webp" data-role="sym">`:'';
 let main,sub,own,tot;
 if(mode==='master'){
  own=st.ownM;tot=st.masterTot;
  main=`<strong>${fmtN(own)}</strong><span>${tot==null?'de …':'de '+fmtN(tot)}</span>`;
  sub=`Set: ${st.own} de ${st.tot}`;
 }else{
  own=st.own;tot=st.tot;
  main=`<strong>${fmtN(own)}</strong><span>de ${fmtN(tot)}</span>`;
  sub=st.masterTot==null?'Master Set: …':`Master Set: ${st.ownM} de ${st.masterTot}`;
 }
 const complete=tot>0&&own>=tot;
 return `<a class="set ${complete?'done':''}" style="--h:${hueOf((S.serieOf[s.id]||{}).id||s.id)}" href="#/set/${encodeURIComponent(s.id)}" aria-label="${esc(s.name)}: ${own} de ${tot==null?'?':tot}">
  <div class="logo">${logo}</div>
  <div class="meta">${sym}<div><span class="sname">${esc(s.name)}</span><span class="sdate">${d&&d.releaseDate?fmtDate(d.releaseDate):''}${s.lang==='en'?(d&&d.releaseDate?' · ':'')+'nome em inglês':''}</span></div></div>
  <div class="count">${main}</div>
  <div class="bar ${complete?'done':''}"><i style="width:${pct(own,tot)}%"></i></div>
  <div class="sub">${esc(sub)}${complete?' <span class="badge gold">Completo</span>':''}</div>
 </a>`;
}
