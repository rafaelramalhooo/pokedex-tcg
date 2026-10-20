/* Tela "Minhas expansões": escolher quais expansões carregar e mostrar. */
import {preloadSetd, visibleSets} from '../catalog.js';
import {groupBySet} from '../collection.js';
import {logoImg} from '../logos.js';
import {saveSettings} from '../db.js';
import {C, S, viewCache} from '../state.js';
import {noteHTML} from '../ui.js';
import {$, esc, fmtN, nz} from '../util.js';

const KB_PER_CARD=3;   /* estimativa grosseira do tamanho do detalhe de cada carta */

export function viewPicker(){
 S.cur={name:'picker',soft:renderPicker,refresh:renderPicker};
 S.ui.pick={q:'',draft:[...(S.settings.mySets||[])],groups:[]};
 $('#view').innerHTML=`<a class="back" href="#/">Voltar às expansões</a>
  <div class="top"><div><h1>Minhas expansões</h1><p class="lead">Escolha as expansões que você quer acompanhar. A tela inicial mostra só elas, e cada uma é carregada completa (Master Set e regras de fichário incluídos). O que não for escolhido não é baixado.</p></div>
  <div class="tools"><input class="field" id="pq" type="search" placeholder="Buscar expansão" aria-label="Buscar expansão"></div></div>
  <div id="pickbody"></div><div class="pickbar" id="pickbar"></div>`;
 renderPicker();
}
function groupsOf(sets){
 const groups=[];const gm={};
 sets.slice().reverse().forEach(s=>{
  const se=S.serieOf[s.id];const name=se?se.name:'Outras';
  if(!gm[name]){gm[name]={name,sets:[]};groups.push(gm[name]);}
  gm[name].sets.push(s);
 });
 return groups;
}
const cardsOf=s=>(s.cardCount&&(s.cardCount.total||s.cardCount.official))||0;
export function renderPicker(){
 const body=$('#pickbody');if(!body)return;
 const sets=visibleSets();
 if(!sets.length){
  body.innerHTML=S.status.catalog==='error'
   ?noteHTML('err',`Não consegui acessar a TCGdex (${esc(S.status.err)}). <button class="btn small" data-act="retry-catalog" type="button">Tentar de novo</button>`)
   :`<div class="sets">${'<div class="skel"></div>'.repeat(12)}</div>`;
  $('#pickbar').innerHTML='';return;
 }
 const draft=new Set(S.ui.pick.draft);const bySet=groupBySet();
 const groups=groupsOf(sets);S.ui.pick.groups=groups.map(g=>g.sets.map(s=>s.id));
 const q=nz(S.ui.pick.q);
 body.innerHTML=groups.map((g,gi)=>{
  const list=g.sets.filter(s=>!q||nz(s.name).includes(q)||nz(s.id).includes(q));
  if(!list.length)return '';
  const sel=g.sets.filter(s=>draft.has(s.id)).length;
  return `<section class="series"><div class="series-head"><h2>${esc(g.name)}</h2><small>${sel} de ${g.sets.length} selecionadas</small>
   <span class="grow"></span>
   <button class="btn small" type="button" data-act="pick-serie" data-gi="${gi}" data-on="1">Selecionar a série toda</button>
   <button class="btn small" type="button" data-act="pick-serie" data-gi="${gi}" data-on="0">Limpar série</button></div>
   <div class="sets pick">${list.map(s=>{
    const on=draft.has(s.id);const own=(bySet[s.id]||[]).length;
    return `<button type="button" class="pk ${on?'on':''}" data-act="pick-toggle" data-id="${esc(s.id)}" aria-pressed="${on}" aria-label="${esc(s.name)}, ${cardsOf(s)} cartas">
     <span class="tick" aria-hidden="true">${on?'✓':''}</span>
     <span class="logo">${logoImg(s)}</span>
     <span class="sname">${esc(s.name)}</span>
     <span class="sdate">${cardsOf(s)?fmtN(cardsOf(s))+' cartas':'—'}${s.lang==='en'?' · nome em inglês':''}</span>
     ${own?`<span class="badge gold">Você tem ${own} carta${own>1?'s':''}</span>`:''}
    </button>`;}).join('')}</div></section>`;
 }).join('')||`<div class="empty"><h3>Nenhuma expansão encontrada</h3><p>Tente outro nome.</p></div>`;
 updatePickBar();
}
export function updatePickBar(){
 const bar=$('#pickbar');if(!bar)return;
 const draft=new Set(S.ui.pick.draft);
 let cards=0;visibleSets().forEach(s=>{if(draft.has(s.id))cards+=cardsOf(s);});
 const mb=cards*KB_PER_CARD/1024;
 const changed=JSON.stringify([...draft].sort())!==JSON.stringify([...(S.settings.mySets||[])].sort());
 bar.innerHTML=`<div class="pickinfo"><b>${draft.size}</b> ${draft.size===1?'expansão':'expansões'} · <b>${fmtN(cards)}</b> cartas · cerca de <b>${mb<1?'menos de 1':fmtN(Math.round(mb))} MB</b> de dados <small>(estimativa; as imagens só carregam quando você olha)</small></div>
  <div class="row"><a class="btn" href="#/">Cancelar</a><button class="btn primary" type="button" data-act="pick-save" ${changed?'':'disabled'}>Salvar e carregar</button></div>`;
}
export function pickToggle(id){
 const d=S.ui.pick.draft;const i=d.indexOf(id);
 if(i>=0)d.splice(i,1);else d.push(id);
 renderPicker();
}
export function pickSerie(gi,on){
 const ids=S.ui.pick.groups[gi]||[];const d=new Set(S.ui.pick.draft);
 ids.forEach(id=>on?d.add(id):d.delete(id));
 S.ui.pick.draft=[...d];renderPicker();
}
export function pickSave(){
 const draft=S.ui.pick.draft;const old=S.settings.mySets||[];
 const removed=old.filter(id=>!draft.includes(id));
 const bySet=groupBySet();
 const withCards=removed.filter(id=>(bySet[id]||[]).length);
 if(withCards.length){
  const names=withCards.map(id=>(S.setMap[id]||{}).name||id).join(', ');
  if(!confirm(`Você está tirando da lista ${withCards.length===1?'uma expansão que tem':'expansões que têm'} cartas marcadas: ${names}.\n\nElas deixam de aparecer na tela inicial, mas as cartas continuam salvas e voltam se você escolher a expansão de novo. Continuar?`))return;
 }
 S.settings.mySets=[...draft];saveSettings();viewCache.clear();C.opt=null;
 location.hash='#/';
 setTimeout(()=>preloadSetd(),60);
}
