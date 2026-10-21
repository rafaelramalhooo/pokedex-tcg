/* Eventos, rotas e início do app. */
import {ensureSetCards, fetchCatalog, indexSetd, indexSets, loadAllSetLists, loadIds, preloadSetd, runSync} from './catalog.js';
import {scopeIds} from './rules.js';
import {viewTrade, viewTrades, TRADE_ACT, renderAddTrade, pullFilter, tradeSetFilter} from './views/trades.js';
import {viewDeck, viewDecks, DECK_ACT, renderAdd, deckAddFilter, deckExportLang} from './views/decks.js';
import {binderExport} from './views/binders.js';
import {exportScopeChanged, runExport, shareAgain} from './exportimg.js';
import {bookGo, bookKey, bookSetting, bookTo, renderBookCtl, setImmersive} from './views/book.js';
import {setCfg} from './modes.js';
import {checkLogos} from './logos.js';
import {pickImage, removeCustom} from './custom.js';
import './lazyimg.js';
import {initCloud, onCloud, startSession} from './cloud.js';
import {showAuth, updateAcct} from './views/auth.js';
import {pickSave, pickSerie, pickToggle, renderPicker, viewPicker} from './views/picker.js';
import {visibleSets} from './catalog.js';
import {saveNote, setFin, toggleOwn} from './collection.js';
import {FM} from './constants.js';
import {DB, saveBinders, saveSettings} from './db.js';
import {C, H, S, refreshAll, viewCache} from './state.js';
import {toast} from './ui.js';
import {$, $$, debounce} from './util.js';
import {renderBinderBody, setBinderSort, viewBinder, viewBinders} from './views/binders.js';
import {retryRemote} from './remote.js';
import {coverHTML, dexFromInput} from './covers.js';
import {evalBinder} from './rules.js';
import {closeModal, editorAct, openAddCards, openEditor, renderAddResults, renderEditor, updatePreviewSoon} from './views/editor.js';
import {renderHome, viewHome} from './views/home.js';
import {closePanel, openPanel, panelNav} from './views/panel.js';
import './tilt.js';
import {dexToggle, openDex, renderDex, renderDexGrid, retryDex} from './views/dex.js';
import {renderSetGrid, viewSet} from './views/set.js';
import {setSetMode} from './modes.js';
import {exportBackup, importBackup, renderSettings, viewSettings} from './views/settings.js';

const ACT={
 ...TRADE_ACT,
 ...DECK_ACT,
 'binder-export':t=>binderExport(t.dataset.id),
 'exp-go':()=>runExport(),
 'exp-share':()=>shareAgain(),
 mode:t=>{
  if(S.cur&&S.cur.name==='set'){setSetMode(S.cur.id,t.dataset.v);ensureSetCards(S.cur.id);}
  else{S.settings.mode=t.dataset.v;saveSettings();}
  refreshAll();},
 serie:t=>{S.ui.serie=t.dataset.v;renderHome();},
 scope:t=>{S.ui.scope=t.dataset.v;S.ui.serie='all';renderHome();},
 sfilter:t=>{S.ui.setFilter=t.dataset.v;renderSetGrid();},
 bfilter:t=>{S.ui.binderFilter=t.dataset.v;S.ui.binderShown=240;renderBinderBody();},
 more:()=>{S.ui.binderShown+=240;renderBinderBody();},
 open:t=>{openPanel(t.dataset.id,t.dataset.binder?{binderId:t.dataset.binder,dex:t.dataset.dex?+t.dataset.dex:null}:null);},
 view:t=>{setCfg({view:t.dataset.v});S.ui.page=0;renderBookCtl();if(S.cur&&S.cur.refresh)S.cur.refresh();},
 'dex-open':t=>openDex(+t.dataset.dex,t.dataset.binder),
 'dex-toggle':t=>dexToggle(t.dataset.id),
 'dex-close':()=>{closeModal();viewCache.clear();refreshAll();},
 'dex-retry':()=>retryDex(),
 'panel-nav':t=>panelNav(+t.dataset.d),
 'book-go':t=>bookGo(+t.dataset.d),
 'immerse':()=>setImmersive(!S.ui.immersive),
 'dex-pick':t=>{const b=S.binders.find(x=>x.id===t.dataset.binder);if(!b)return;b.pick=b.pick||{};if(t.dataset.id)b.pick[t.dataset.dex]=t.dataset.id;else delete b.pick[t.dataset.dex];saveBinders();viewCache.clear();refreshAll();},
 bsortdir:()=>{const b=S.cur&&S.binders.find(x=>x.id===S.cur.id);setBinderSort({dir:b&&b.sort&&b.sort.dir==='desc'?'asc':'desc'});},
 'retry-remote':()=>retryRemote(),
 'load-pending':t=>{const b=S.binders.find(x=>x.id===t.dataset.id);if(b)loadIds(evalBinder(b).pendingIds||[],'rule');},
 'load-all-lists':()=>loadAllSetLists(),
 'load-scope':t=>{const b=S.binders.find(x=>x.id===t.dataset.id);if(b)loadIds(scopeIds(b));},
 tog:t=>{toggleOwn(t.dataset.id,t.dataset.fin||null);},
 close:()=>closePanel(),
 inc:t=>{const e=S.collection[t.dataset.id];const q=e&&e.f[t.dataset.fin]?e.f[t.dataset.fin].q:0;setFin(t.dataset.id,t.dataset.fin,{q:q+1});},
 dec:t=>{const e=S.collection[t.dataset.id];const q=e&&e.f[t.dataset.fin]?e.f[t.dataset.fin].q:0;if(q>0)setFin(t.dataset.id,t.dataset.fin,{q:q-1});},
 unbind:t=>{const ctx=S.ui.panelCtx;const b=ctx&&S.binders.find(x=>x.id===ctx.binderId);if(!b)return;b.cardIds=b.cardIds.filter(x=>x!==t.dataset.id);saveBinders();closePanel();refreshAll();},
 'retry-catalog':()=>fetchCatalog(),
 'reload-set':()=>route(true),
 'load-set-cards':()=>{if(S.cur&&S.cur.name==='set')ensureSetCards(S.cur.id);},
 'new-binder':()=>openEditor(null),
 'edit-binder':t=>openEditor(t.dataset.id),
 'add-cards':t=>openAddCards(t.dataset.id),
 'del-binder':t=>{const b=S.binders.find(x=>x.id===t.dataset.id);if(b&&confirm(`Excluir o fichário “${b.name}”? As cartas da sua coleção não são afetadas.`)){S.binders=S.binders.filter(x=>x!==b);saveBinders();location.hash='#/binders';}},
 'pick-toggle':t=>pickToggle(t.dataset.id),
 'pick-serie':t=>pickSerie(+t.dataset.gi,t.dataset.on==='1'),
 'pick-save':()=>pickSave(),
 upload:t=>pickImage(t.dataset.kind,t.dataset.id,()=>imagesChanged(t.dataset.kind==='logo'?'Logo guardado.':'Foto guardada.'),()=>toast('Não consegui ler essa imagem. Tente um arquivo JPG, PNG ou WEBP.')),
 'upload-rm':async t=>{await removeCustom(t.dataset.kind,t.dataset.id);imagesChanged('Imagem removida.');},
 'check-logos':()=>checkLogos(visibleSets()),
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
  toast('Catálogo apagado. Atualizando a lista de coleções…');fetchCatalog();
 }
};
function imagesChanged(msg){
 if(S.ui.edit)renderEditor();
 viewCache.clear();const p=$('#panel');if(p)delete p.dataset.id;
 refreshAll();if(S.cur&&S.cur.soft)S.cur.soft();toast(msg);
}
document.addEventListener('click',e=>{
 const m=e.target.closest('#modal');
 if(m&&e.target===m){closeModal();return;}
 const ed=e.target.closest('[data-ed-act]');
 if(ed){editorAct(ed);return;}
 const t=e.target.closest('[data-act]');
 if(t&&ACT[t.dataset.act])ACT[t.dataset.act](t,e);
});
document.addEventListener('keydown',e=>{
 if(S.ui.panelId&&!$('#modal').classList.contains('on')&&(e.key==='ArrowLeft'||e.key==='ArrowRight')&&!(e.target.tagName&&/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName))){e.preventDefault();panelNav(e.key==='ArrowRight'?1:-1);return;}
 if(bookKey(e)){e.preventDefault();return;}
 if(e.key==='Escape'){
  if(S.ui.immersive&&!S.ui.panelId&&!$('#modal').classList.contains('on')){setImmersive(false);return;}
  if(S.ui.panelId)closePanel();else if($('#modal').classList.contains('on')){const was=!!S.ui.dexdlg;closeModal();if(was){viewCache.clear();refreshAll();}}
  return;
 }
 if((e.key==='Enter'||e.key===' ')&&e.target.classList&&(e.target.classList.contains('slot')||e.target.classList.contains('dtile'))){
  e.preventDefault();
  const a=e.target.dataset.edAct;
  if(a)editorAct(e.target);else if(ACT[e.target.dataset.act])ACT[e.target.dataset.act](e.target);else ACT.open(e.target);
 }
});
document.addEventListener('remote-done',()=>{if(S.ui.edit)updatePreviewSoon();});
document.addEventListener('change',e=>{
 const t=e.target;
 if(t.dataset.edcover&&S.ui.edit){const b=S.ui.edit.b;b.cover={...(b.cover||{kind:'dex'}),kind:'dex',q:t.value,dex:dexFromInput(t.value)};const th=$('#dialog .cover.sm');if(th)th.innerHTML=coverHTML(b);return;}
 if(t.dataset.bsort!==undefined){setBinderSort({f:t.value});return;}
 if(t.dataset.edsort&&S.ui.edit){S.ui.edit.b.sort={f:'default',dir:'asc',...(S.ui.edit.b.sort||{}),[t.dataset.edsort]:t.value};return;}
 if(t.dataset.dexonly!==undefined&&S.ui.dexdlg){S.ui.dexdlg.only=t.checked;renderDexGrid();return;}
 if(t.dataset.dx==='lang'){deckExportLang(t.value);return;}
 if(t.dataset.dk==='set'){deckAddFilter('set',t.value);return;}
 if(t.dataset.dk==='own'){deckAddFilter('own',t.checked);return;}
 if(t.dataset.dk==='legal'){deckAddFilter('legal',t.checked);return;}
 if(t.dataset.ta==='set'){tradeSetFilter(t.value);return;}
 if(t.dataset.pl==='set'){pullFilter('set',t.value);return;}
 if(t.dataset.pl==='rep'){pullFilter('rep',t.checked);return;}
 if(t.dataset.pl==='split'){pullFilter('split',t.checked);return;}
 if(t.dataset.exp==='scope'){exportScopeChanged(t.value);return;}
 if(t.dataset.bk){bookSetting(t);return;}
 if(t.classList&&t.classList.contains('bookrange')){bookTo(+t.value);return;}
 if(t.dataset.ch){setFin(t.dataset.id,t.dataset.fin,{[t.dataset.ch]:t.value});return;}
 if(t.dataset.set){S.settings[t.dataset.set]=t.checked;saveSettings();viewCache.clear();
  if(t.dataset.set==='showPocket'&&t.checked)toast('Coleções do Pocket incluídas na lista.');
  refreshAll();return;}
 if(t.id==='imp'&&t.files[0]){importBackup(t.files[0]);t.value='';return;}
 const ed=t.dataset.ed;
 if(ed&&S.ui.edit){
  const c=S.ui.edit.b.conds[+t.dataset.i];if(!c)return;
  if(ed==='f'){c.f=t.value;c.op=FM[c.f].def;c.v='';}
  else if(ed==='op'){c.op=t.value;if(FM[c.f].t==='num')c.v='';}
  else if(ed==='v'){c.v=t.value;if(t.tagName!=='SELECT'){updatePreviewSoon();return;}}
  S.ui.edit.b.name=($('#bn')||{}).value||'';
  renderEditor();
 }
});
document.addEventListener('input',e=>{
 const t=e.target;
 if(t.id==='dq'&&S.ui.dexdlg){S.ui.dexdlg.q=t.value;renderDexGrid();return;}
 if(t.id==='q'){S.ui.q=t.value;renderHome();return;}
 if(t.id==='pq'){S.ui.pick.q=t.value;renderPicker();return;}
 if(t.id==='bq'){S.ui.binderQ=t.value;S.ui.binderShown=240;S.ui.page=0;renderBinderBody();return;}
 if(t.id==='sq'){S.ui.setQ=t.value;renderSetGrid();return;}
 if(t.id==='plq'&&S.ui.pull){pullFilter('q',t.value);return;}
 if(t.id==='dka'&&S.ui.deckAdd){S.ui.deckAdd.q=t.value;renderAdd();return;}
 if(t.id==='tra'&&S.ui.tradeAdd){S.ui.tradeAdd.q=t.value;renderAddTrade();return;}
 if(t.id==='ac'&&S.ui.adding){S.ui.adding.q=t.value;renderAddResults();return;}
 if(t.id==='tile'){setCfg({tile:+t.value});document.documentElement.style.setProperty('--tile',t.value+'px');return;}
 if(t.id==='note'){const id=t.dataset.id,v=t.value;noteSoon(id,v);return;}
 if(t.dataset.ed==='v'&&S.ui.edit){
  const c=S.ui.edit.b.conds[+t.dataset.i];if(c){c.v=t.value;updatePreviewSoon();}
 }
});
const saveSettingsSoon=debounce(saveSettings,400);
const noteTimers={};
function noteSoon(id,v){clearTimeout(noteTimers[id]);noteTimers[id]=setTimeout(()=>saveNote(id,v),400);}
$('#scrim').addEventListener('click',()=>closePanel());


/* Telas guardadas: ao sair de uma tela com cartas, o app guarda a tela pronta (com as imagens
   já carregadas) e a posição da rolagem, e a recoloca na hora quando você volta. */
const KEEP=new Map();const KEEP_MAX=6;const KEEP_UI=['page','pageKey','q','serie','scope','setFilter','setQ','binderFilter','binderShown','binderQ'];
let curKey=null;
function keepLeave(){
 if(curKey===null)return;
 const v=$('#view');const c=S.cur;
 if(!c||c.ready===false||!['home','set','binders','binder'].includes(c.name)||!v.firstChild){KEEP.delete(curKey);return;}
 const y=window.scrollY;const frag=document.createDocumentFragment();
 while(v.firstChild)frag.appendChild(v.firstChild);
 const ui={};KEEP_UI.forEach(k=>ui[k]=S.ui[k]);
 KEEP.delete(curKey);KEEP.set(curKey,{frag,cur:c,y,ui});
 while(KEEP.size>KEEP_MAX)KEEP.delete(KEEP.keys().next().value);
}
function keepEnter(key){
 const e=KEEP.get(key);if(!e)return false;
 KEEP.delete(key);
 const v=$('#view');v.textContent='';v.appendChild(e.frag);
 S.cur=e.cur;KEEP_UI.forEach(k=>{S.ui[k]=e.ui[k];});
 try{if(S.cur.refresh)S.cur.refresh();}catch(err){return false;}
 window.scrollTo(0,e.y);
 return true;
}
H.keepClear=()=>KEEP.clear();
function route(fresh){
 closePanel();
 const h=(location.hash||'#/').slice(1);const parts=h.split('/').filter(Boolean);
 const key=h||'/';
 if(fresh===true)KEEP.clear();
 if(key!==curKey&&S.ui.immersive)setImmersive(false,true);
 if(key!==curKey)keepLeave();
 const same=key===curKey;
 curKey=key;
 const nav=parts[0]==='binders'||parts[0]==='binder'?'binders':parts[0]==='negociacao'?'negociacao':parts[0]==='decks'?'decks':parts[0]==='ajustes'?'ajustes':'home';
 $$('.rail a.nav').forEach(a=>a.classList.toggle('on',a.dataset.nav===nav));
 document.documentElement.style.setProperty('--tile',S.settings.tile+'px');
 if(!same&&keepEnter(key))return;
 window.scrollTo(0,0);
 if(parts[0]==='set'&&parts[1])viewSet(decodeURIComponent(parts[1]));
 else if(parts[0]==='decks'&&parts[1])viewDeck(parts[1]);
 else if(parts[0]==='decks')viewDecks();
 else if(parts[0]==='negociacao'&&parts[1])viewTrade(parts[1]);
 else if(parts[0]==='negociacao')viewTrades();
 else if(parts[0]==='binders')viewBinders();
 else if(parts[0]==='binder'&&parts[1])viewBinder(parts[1]);
 else if(parts[0]==='expansoes')viewPicker();
 else if(parts[0]==='ajustes')viewSettings();
 else viewHome();
}
window.addEventListener('hashchange',()=>route());
H.route=()=>route(true);
H.renderDex=()=>{if(S.ui.dexdlg)renderDexGrid();};


async function boot(){
 try{await DB.open();}catch(e){S.persist=false;}
 if(S.persist){
  S.collection=await DB.all('coll');S.setd=await DB.all('setd');S.cards=await DB.all('cards');
  S.sets=(await DB.get('kv','sets'))||[];S.serieOf=(await DB.get('kv','serieOf'))||{};
  S.catalogAt=(await DB.get('kv','catalogAt'))||0;
  S.binders=(await DB.get('kv','binders'))||[];
  S.trades=(await DB.get('kv','trades'))||[];
  S.decks=(await DB.get('kv','decks'))||[];S.dinfo=(await DB.get('kv','dinfo'))||{};S.setab=(await DB.get('kv','setab'))||{};
  Object.assign(S.settings,(await DB.get('kv','settings'))||{});
  if(!Array.isArray(S.settings.legalMarks))S.settings.legalMarks=['H','I','J'];
  S.logoOk=(await DB.get('kv','logoOk'))||{};
  S.dexNames=(await DB.get('kv','dexNames'))||{};
  S.custom=Object.assign({logos:{},cards:{},covers:{}},(await DB.get('kv','custom'))||{});
  /* primeira vez com a seleção de coleções: começa pelas que já têm cartas marcadas */
  if(!Array.isArray(S.settings.mySets)){
   S.settings.mySets=[...new Set(Object.values(S.collection).map(e=>e.s).filter(Boolean))];
   await saveSettings();
  }
 }else if(!Array.isArray(S.settings.mySets))S.settings.mySets=[];
 indexSets();Object.values(S.setd).forEach(indexSetd);
 const st=await initCloud();
 onCloud(c=>{if(c.recovery&&!document.querySelector('#auth.on'))showAuth();});
 if(S.cloud.recovery){showAuth(startApp);return;}
 if(st==='out'||(st==='offline'&&!(await DB.get('kv','cloud')))){showAuth(startApp);return;}
 if(st==='in'){
  await Promise.race([startSession(null),new Promise(r=>setTimeout(r,8000))]);
  /* a sincronização pode ter trazido seleção de coleções e ajustes */
  if(!Array.isArray(S.settings.mySets))S.settings.mySets=[];
 }
 startApp();
}
function startApp(){
 updateAcct();
 route();
 const stale=Date.now()-S.catalogAt>7*864e5;
 if(!S.sets.length||stale)fetchCatalog();
 else preloadSetd();
}
boot();

if('serviceWorker' in navigator&&(location.protocol==='https:'||location.hostname==='localhost'))navigator.serviceWorker.register('sw.js').catch(()=>{});
