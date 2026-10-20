/* Visual de fichário: páginas com grade (2x2 … 5x4 ou personalizada), setas, teclado, deslize e página dupla. */
import {saveSettings} from '../db.js';
import {S} from '../state.js';
import {sizeCtl, toast} from '../ui.js';
import {$, $$} from '../util.js';
import {cfg, ctxKey, setCfg, tileOf} from '../modes.js';

export const PRESETS=['2x2','3x3','3x4','4x4','5x4'];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,Math.round(+n)||a));
export const isBook=()=>cfg().view==='book';
export function gridOf(){
 const g=cfg().grid;
 if(g.p==='custom')return{cols:clamp(g.cols,1,8),rows:clamp(g.rows,1,8)};
 const [c,r]=String(g.p).split('x').map(Number);
 return{cols:c||3,rows:r||3};
}
const wide=()=>typeof matchMedia==='function'&&matchMedia('(min-width:900px)').matches;
export const isSpread=()=>!!cfg().spread&&wide();

/* Controles da barra: Lista/Fichário e, no modo fichário, grade e página dupla. */
export function bookCtlHTML(){
 const book=isBook();const g=cfg().grid;
 let h=`<div class="seg" role="group" aria-label="Forma de exibir"><button type="button" data-act="view" data-v="list" aria-pressed="${!book}">Lista</button><button type="button" data-act="view" data-v="book" aria-pressed="${book}">Fichário</button></div>`;
 if(!book)return h+sizeCtl();
 h+=`<label class="size">Grade <select class="field" data-bk="preset" aria-label="Grade da página">${PRESETS.map(p=>`<option value="${p}" ${g.p===p?'selected':''}>${p.replace('x',' × ')}</option>`).join('')}<option value="custom" ${g.p==='custom'?'selected':''}>Personalizada</option></select></label>`;
 if(g.p==='custom'){const {cols,rows}=gridOf();h+=`<label class="size">Colunas <input class="field mini" type="number" min="1" max="8" value="${cols}" data-bk="cols" aria-label="Colunas"></label><label class="size">Linhas <input class="field mini" type="number" min="1" max="8" value="${rows}" data-bk="rows" aria-label="Linhas"></label>`;}
 h+=`<button type="button" class="btn small" data-act="immerse" title="Mostra só as cartas, em tela cheia">Tela cheia</button>`;
 h+=`<label class="size wide-only"><input type="checkbox" data-bk="spread" ${cfg().spread?'checked':''}> Página dupla</label>`;
 return h;
}
export function renderBookCtl(){const el=$('#bookctl');if(el)el.innerHTML=bookCtlHTML();document.documentElement.style.setProperty('--tile',tileOf()+'px');}

/* Monta o livro com os itens (HTML de cada espaço) e guarda a página atual. */
export function bookHTML(items,key){
 if(S.ui.pageKey!==key){S.ui.pageKey=key;S.ui.page=0;}
 const {cols,rows}=gridOf();const per=cols*rows;
 const total=Math.max(1,Math.ceil(items.length/per));
 const sp=isSpread();
 let p=Math.max(0,Math.min(S.ui.page||0,total-1));if(sp)p-=p%2;S.ui.page=p;
 const page=i=>{
  if(i>=total)return'<div class="bpage ghost" aria-hidden="true"></div>';
  const cells=items.slice(i*per,(i+1)*per);
  while(cells.length<per)cells.push('<div class="bempty" aria-hidden="true"></div>');
  return`<div class="bpage" style="--cols:${cols};--rows:${rows}" role="group" aria-label="Página ${i+1} de ${total}">${cells.join('')}</div>`;
 };
 const label=sp&&p+1<total?`Páginas ${p+1} e ${p+2} de ${total}`:`Página ${p+1} de ${total}`;
 const last=sp?p+2>=total:p+1>=total;
 const im=!!S.ui.immersive;
 const nav=pos=>`<div class="booknav" aria-label="Navegar pelas páginas">
  <button type="button" class="btn small" data-act="book-go" data-d="-1" ${p<=0?'disabled':''} aria-label="Página anterior">‹ Anterior</button>
  <span class="booklbl" aria-live="polite">${label}</span>
  ${pos==='top'&&total>1?`<input class="bookrange" type="range" min="1" max="${total}" value="${p+1}" aria-label="Ir para a página">`:''}
  <button type="button" class="btn small" data-act="book-go" data-d="1" ${last?'disabled':''} aria-label="Próxima página">Próxima ›</button>
  ${im?`<select class="field imsel" data-bk="preset" aria-label="Grade da página">${PRESETS.map(q=>`<option value="${q}" ${cfg().grid.p===q?'selected':''}>${q.replace('x',' × ')}</option>`).join('')}${cfg().grid.p==='custom'?'<option value="custom" selected>Personalizada</option>':''}</select><button type="button" class="btn small" data-act="immerse" aria-label="Sair da tela cheia">✕ Sair</button>`:''}</div>`;
 const side=im?`<button type="button" class="bside l" data-act="book-go" data-d="-1" ${p<=0?'disabled':''} aria-label="Página anterior">‹</button><button type="button" class="bside r" data-act="book-go" data-d="1" ${last?'disabled':''} aria-label="Próxima página">›</button>`:'';
 return`<div class="bookwrap" tabindex="-1">${nav('top')}<div class="spread ${sp?'two':''}" style="--sp:${sp?2:1}">${page(p)}${sp?page(p+1):''}</div>${total>1&&!im?nav('bottom'):''}${side}</div>`;
}
export function bookGo(d){
 S.ui.page=Math.max(0,(S.ui.page||0)+d*(isSpread()?2:1));
 if(S.cur&&S.cur.refresh)S.cur.refresh();
}
export function bookTo(n){S.ui.page=Math.max(0,n-1);if(S.cur&&S.cur.refresh)S.cur.refresh();}
export function bookSetting(t){
 const k=t.dataset.bk;const g={...cfg().grid};
 if(k==='preset'){g.p=t.value;if(t.value==='custom'){const c=gridOf();g.cols=g.cols||c.cols;g.rows=g.rows||c.rows;}setCfg({grid:g});}
 else if(k==='cols'){g.cols=clamp(t.value,1,8);setCfg({grid:g});}
 else if(k==='rows'){g.rows=clamp(t.value,1,8);setCfg({grid:g});}
 else if(k==='spread')setCfg({spread:t.checked});
 S.ui.page=0;
 if(k==='preset'||k==='spread')renderBookCtl();
 if(S.cur&&S.cur.refresh)S.cur.refresh();
}
export function bookKey(e){
 if(!isBook()||!$('.bookwrap'))return false;
 if($('#modal').classList.contains('on')||S.ui.panelId)return false;
 const t=e.target;if(t&&(/^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName)&&t.type!=='range'))return false;
 if(e.key==='ArrowRight'){bookGo(1);return true;}
 if(e.key==='ArrowLeft'){bookGo(-1);return true;}
 return false;
}
/* Deslizar o dedo para virar a página. */
let tx=0,ty=0,tt=0;
document.addEventListener('touchstart',e=>{
 if(!e.target.closest||(!e.target.closest('.spread')&&!S.ui.immersive)||e.touches.length!==1)return;
 tx=e.touches[0].clientX;ty=e.touches[0].clientY;tt=Date.now();
},{passive:true});
document.addEventListener('touchend',e=>{
 if(!tt||!e.changedTouches.length)return;
 const dx=e.changedTouches[0].clientX-tx,dy=e.changedTouches[0].clientY-ty;const dt=Date.now()-tt;tt=0;
 if(Math.abs(dx)>55&&Math.abs(dy)<45&&dt<700&&isBook()&&!S.ui.panelId)bookGo(dx<0?1:-1);
},{passive:true});
let rz;
window.addEventListener('resize',()=>{clearTimeout(rz);rz=setTimeout(()=>{if(isBook()&&S.cur&&S.cur.refresh){renderBookCtl();S.cur.refresh();}},200);});

/* ---------- Tela cheia: só as cartas, como um fichário de verdade ---------- */
let hideT,savedY=0,toldTip=false;
function showBar(){document.body.classList.add('ui-on');clearTimeout(hideT);hideT=setTimeout(()=>document.body.classList.remove('ui-on'),3500);}
['pointermove','pointerdown','touchstart','keydown'].forEach(ev=>document.addEventListener(ev,()=>{if(S.ui.immersive)showBar();},{passive:true}));
export const canImmerse=()=>isBook()&&!!S.cur&&(S.cur.name==='set'||S.cur.name==='binder');
export function setImmersive(on,fromRoute){
 on=!!on&&canImmerse();
 if(on===!!S.ui.immersive)return;
 S.ui.immersive=on;document.body.classList.toggle('immersive',on);
 if(on){
  savedY=window.scrollY;window.scrollTo(0,0);showBar();
  try{const r=document.documentElement.requestFullscreen;if(r&&!matchMedia('(hover:none)').matches)r.call(document.documentElement).catch(()=>{});}catch(e){}
  if(!toldTip){toldTip=true;toast('Toque na tela para ver os controles. Lá você troca a grade (ex.: 2 × 2) se as cartas ficarem pequenas.');}
 }else{
  document.body.classList.remove('ui-on');
  try{if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});}catch(e){}
 }
 if(S.cur&&S.cur.refresh)S.cur.refresh();
 if(!on&&!fromRoute)window.scrollTo(0,savedY);
}
document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement&&S.ui.immersive)setImmersive(false);});
