/* Eventos, rotas e início do app. */
import {ensureSetCards, fetchCatalog, indexSetd, indexSets, preloadSetd, runSync} from './catalog.js';
import {saveNote, setFin, toggleOwn} from './collection.js';
import {FM} from './constants.js';
import {DB, saveBinders, saveSettings} from './db.js';
import {C, H, S, refreshAll, viewCache} from './state.js';
import {toast} from './ui.js';
import {$, $$, debounce} from './util.js';
import {renderBinderBody, viewBinder, viewBinders} from './views/binders.js';
import {closeModal, editorAct, openAddCards, openEditor, renderAddResults, renderEditor, updatePreviewSoon} from './views/editor.js';
import {renderHome, viewHome} from './views/home.js';
import {closePanel, openPanel} from './views/panel.js';
import {renderSetGrid, viewSet} from './views/set.js';
import {exportBackup, importBackup, renderSettings, viewSettings} from './views/settings.js';

const ACT={
 mode:t=>{S.settings.mode=t.dataset.v;saveSettings();
  if(S.cur&&S.cur.name==='set'&&S.settings.mode==='master')ensureSetCards(S.cur.id);
  refreshAll();},
 serie:t=>{S.ui.serie=t.dataset.v;renderHome();},
 sfilter:t=>{S.ui.setFilter=t.dataset.v;renderSetGrid();},
 bfilter:t=>{S.ui.binderFilter=t.dataset.v;S.ui.binderShown=240;renderBinderBody();},
 more:()=>{S.ui.binderShown+=240;renderBinderBody();},
 open:t=>{openPanel(t.dataset.id,t.dataset.binder?{binderId:t.dataset.binder}:null);},
 tog:t=>{toggleOwn(t.dataset.id,t.dataset.fin||null);},
 close:()=>closePanel(),
 inc:t=>{const e=S.collection[t.dataset.id];const q=e&&e.f[t.dataset.fin]?e.f[t.dataset.fin].q:0;setFin(t.dataset.id,t.dataset.fin,{q:q+1});},
 dec:t=>{const e=S.collection[t.dataset.id];const q=e&&e.f[t.dataset.fin]?e.f[t.dataset.fin].q:0;if(q>0)setFin(t.dataset.id,t.dataset.fin,{q:q-1});},
 unbind:t=>{const ctx=S.ui.panelCtx;const b=ctx&&S.binders.find(x=>x.id===ctx.binderId);if(!b)return;b.cardIds=b.cardIds.filter(x=>x!==t.dataset.id);saveBinders();closePanel();refreshAll();},
 'retry-catalog':()=>fetchCatalog(),
 'reload-set':()=>route(),
 'load-set-cards':()=>{if(S.cur&&S.cur.name==='set')ensureSetCards(S.cur.id);},
 'new-binder':()=>openEditor(null),
 'edit-binder':t=>openEditor(t.dataset.id),
 'add-cards':t=>openAddCards(t.dataset.id),
 'del-binder':t=>{const b=S.binders.find(x=>x.id===t.dataset.id);if(b&&confirm(`Excluir o fichário “${b.name}”? As cartas da sua coleção não são afetadas.`)){S.binders=S.binders.filter(x=>x!==b);saveBinders();location.hash='#/binders';}},
 'sync-start':()=>runSync(),
 'sync-stop':()=>{S.sync.stop=true;},
 'reload-setd':()=>{viewCache.clear();preloadSetd(true);},
 'rm-mark':t=>{S.settings.legalMarks=S.settings.legalMarks.filter(m=>m!==t.dataset.v);saveSettings();renderSettings();},
 'add-mark':()=>{const i=$('#newmark');const m=(i.value||'').trim().toUpperCase();if(m&&!S.settings.legalMarks.includes(m)){S.settings.legalMarks.push(m);S.settings.legalMarks.sort();saveSettings();}i.value='';renderSettings();},
 export:()=>exportBackup(),
 'clear-cache':async()=>{
  if(!confirm('Apagar o catálogo baixado? A coleção e os fichários ficam.'))return;
  await DB.clear('setd');await DB.clear('cards');
  S.setd={};S.cards={};S.briefs={};viewCache.clear();C.opt=null;
  toast('Catálogo apagado. Atualizando a lista de expansões…');fetchCatalog();
 }
};
document.addEventListener('click',e=>{
 const m=e.target.closest('#modal');
 if(m&&e.target===m){closeModal();return;}
 const ed=e.target.closest('[data-ed-act]');
 if(ed){editorAct(ed);return;}
 const t=e.target.closest('[data-act]');
 if(t&&ACT[t.dataset.act])ACT[t.dataset.act](t,e);
});
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'){
  if($('#modal').classList.contains('on'))closeModal();else if(S.ui.panelId)closePanel();
  return;
 }
 if((e.key==='Enter'||e.key===' ')&&e.target.classList&&e.target.classList.contains('slot')){
  e.preventDefault();
  const a=e.target.dataset.edAct;
  if(a)editorAct(e.target);else ACT.open(e.target);
 }
});
document.addEventListener('change',e=>{
 const t=e.target;
 if(t.dataset.ch){setFin(t.dataset.id,t.dataset.fin,{[t.dataset.ch]:t.value});return;}
 if(t.dataset.set){S.settings[t.dataset.set]=t.checked;saveSettings();viewCache.clear();
  if(t.dataset.set==='showPocket'&&t.checked)toast('Expansões do Pocket incluídas na lista.');
  refreshAll();return;}
 if(t.id==='imp'&&t.files[0]){importBackup(t.files[0]);t.value='';return;}
 const ed=t.dataset.ed;
 if(ed&&S.ui.edit){
  const c=S.ui.edit.b.conds[+t.dataset.i];if(!c)return;
  if(ed==='f'){c.f=t.value;c.op=FM[c.f].def;c.v='';}
  else if(ed==='op'){c.op=t.value;if(FM[c.f].t==='num')c.v='';}
  else if(ed==='v'){c.v=t.value;}
  S.ui.edit.b.name=($('#bn')||{}).value||'';
  renderEditor();
 }
});
document.addEventListener('input',e=>{
 const t=e.target;
 if(t.id==='q'){S.ui.q=t.value;renderHome();return;}
 if(t.id==='sq'){S.ui.setQ=t.value;renderSetGrid();return;}
 if(t.id==='ac'&&S.ui.adding){S.ui.adding.q=t.value;renderAddResults();return;}
 if(t.id==='tile'){S.settings.tile=+t.value;document.documentElement.style.setProperty('--tile',t.value+'px');saveSettingsSoon();return;}
 if(t.id==='note'){const id=t.dataset.id,v=t.value;noteSoon(id,v);return;}
 if(t.dataset.ed==='v'&&S.ui.edit){
  const c=S.ui.edit.b.conds[+t.dataset.i];if(c){c.v=t.value;updatePreviewSoon();}
 }
});
const saveSettingsSoon=debounce(saveSettings,400);
const noteTimers={};
function noteSoon(id,v){clearTimeout(noteTimers[id]);noteTimers[id]=setTimeout(()=>saveNote(id,v),400);}
$('#scrim').addEventListener('click',()=>closePanel());


function route(){
 closePanel();
 const h=(location.hash||'#/').slice(1);const parts=h.split('/').filter(Boolean);
 const nav=parts[0]==='binders'||parts[0]==='binder'?'binders':parts[0]==='ajustes'?'ajustes':'home';
 $$('.rail a.nav').forEach(a=>a.classList.toggle('on',a.dataset.nav===nav));
 window.scrollTo(0,0);
 document.documentElement.style.setProperty('--tile',S.settings.tile+'px');
 if(parts[0]==='set'&&parts[1])viewSet(decodeURIComponent(parts[1]));
 else if(parts[0]==='binders')viewBinders();
 else if(parts[0]==='binder'&&parts[1])viewBinder(parts[1]);
 else if(parts[0]==='ajustes')viewSettings();
 else viewHome();
}
window.addEventListener('hashchange',route);
H.route=route;


async function boot(){
 try{await DB.open();}catch(e){S.persist=false;}
 if(S.persist){
  S.collection=await DB.all('coll');S.setd=await DB.all('setd');S.cards=await DB.all('cards');
  S.sets=(await DB.get('kv','sets'))||[];S.serieOf=(await DB.get('kv','serieOf'))||{};
  S.catalogAt=(await DB.get('kv','catalogAt'))||0;
  S.binders=(await DB.get('kv','binders'))||[];
  Object.assign(S.settings,(await DB.get('kv','settings'))||{});
  if(!Array.isArray(S.settings.legalMarks))S.settings.legalMarks=['H','I','J'];
 }
 indexSets();Object.values(S.setd).forEach(indexSetd);
 route();
 const stale=Date.now()-S.catalogAt>7*864e5;
 if(!S.sets.length||stale)fetchCatalog();
 else preloadSetd();
}
boot();
