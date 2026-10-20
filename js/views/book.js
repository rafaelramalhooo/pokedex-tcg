/* Visual de fichário: páginas com grade (2x2 … 5x4 ou personalizada), setas, teclado, deslize e página dupla. */
import {saveSettings} from '../db.js';
import {S} from '../state.js';
import {sizeCtl} from '../ui.js';
import {$, $$} from '../util.js';

export const PRESETS=['2x2','3x3','3x4','4x4','5x4'];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,Math.round(+n)||a));
export const isBook=()=>S.settings.view==='book';
export function gridOf(){
 const g=S.settings.grid||{p:'3x3'};
 if(g.p==='custom')return{cols:clamp(g.cols,1,8),rows:clamp(g.rows,1,8)};
 const [c,r]=String(g.p).split('x').map(Number);
 return{cols:c||3,rows:r||3};
}
const wide=()=>typeof matchMedia==='function'&&matchMedia('(min-width:900px)').matches;
export const isSpread=()=>!!S.settings.spread&&wide();

/* Controles da barra: Lista/Fichário e, no modo fichário, grade e página dupla. */
export function bookCtlHTML(){
 const book=isBook();const g=S.settings.grid||{p:'3x3'};
 let h=`<div class="seg" role="group" aria-label="Forma de exibir"><button type="button" data-act="view" data-v="list" aria-pressed="${!book}">Lista</button><button type="button" data-act="view" data-v="book" aria-pressed="${book}">Fichário</button></div>`;
 if(!book)return h+sizeCtl();
 h+=`<label class="size">Grade <select class="field" data-bk="preset" aria-label="Grade da página">${PRESETS.map(p=>`<option value="${p}" ${g.p===p?'selected':''}>${p.replace('x',' × ')}</option>`).join('')}<option value="custom" ${g.p==='custom'?'selected':''}>Personalizada</option></select></label>`;
 if(g.p==='custom'){const {cols,rows}=gridOf();h+=`<label class="size">Colunas <input class="field mini" type="number" min="1" max="8" value="${cols}" data-bk="cols" aria-label="Colunas"></label><label class="size">Linhas <input class="field mini" type="number" min="1" max="8" value="${rows}" data-bk="rows" aria-label="Linhas"></label>`;}
 h+=`<label class="size wide-only"><input type="checkbox" data-bk="spread" ${S.settings.spread?'checked':''}> Página dupla</label>`;
 return h;
}
export function renderBookCtl(){const el=$('#bookctl');if(el)el.innerHTML=bookCtlHTML();}

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
  return`<div class="bpage" style="--cols:${cols}" role="group" aria-label="Página ${i+1} de ${total}">${cells.join('')}</div>`;
 };
 const label=sp&&p+1<total?`Páginas ${p+1} e ${p+2} de ${total}`:`Página ${p+1} de ${total}`;
 const last=sp?p+2>=total:p+1>=total;
 const nav=pos=>`<div class="booknav" aria-label="Navegar pelas páginas">
  <button type="button" class="btn small" data-act="book-go" data-d="-1" ${p<=0?'disabled':''} aria-label="Página anterior">‹ Anterior</button>
  <span class="booklbl" aria-live="polite">${label}</span>
  ${pos==='top'&&total>1?`<input class="bookrange" type="range" min="1" max="${total}" value="${p+1}" aria-label="Ir para a página">`:''}
  <button type="button" class="btn small" data-act="book-go" data-d="1" ${last?'disabled':''} aria-label="Próxima página">Próxima ›</button></div>`;
 return`<div class="bookwrap" tabindex="-1">${nav('top')}<div class="spread ${sp?'two':''}">${page(p)}${sp?page(p+1):''}</div>${total>1?nav('bottom'):''}</div>`;
}
export function bookGo(d){
 S.ui.page=Math.max(0,(S.ui.page||0)+d*(isSpread()?2:1));
 if(S.cur&&S.cur.refresh)S.cur.refresh();
}
export function bookTo(n){S.ui.page=Math.max(0,n-1);if(S.cur&&S.cur.refresh)S.cur.refresh();}
export function bookSetting(t){
 const k=t.dataset.bk;const g=S.settings.grid=S.settings.grid||{p:'3x3'};
 if(k==='preset'){g.p=t.value;if(t.value==='custom'){const c=gridOf();g.cols=g.cols||c.cols;g.rows=g.rows||c.rows;}}
 else if(k==='cols')g.cols=clamp(t.value,1,8);
 else if(k==='rows')g.rows=clamp(t.value,1,8);
 else if(k==='spread')S.settings.spread=t.checked;
 S.ui.page=0;saveSettings();
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
 if(!e.target.closest||!e.target.closest('.spread')||e.touches.length!==1)return;
 tx=e.touches[0].clientX;ty=e.touches[0].clientY;tt=Date.now();
},{passive:true});
document.addEventListener('touchend',e=>{
 if(!tt||!e.changedTouches.length)return;
 const dx=e.changedTouches[0].clientX-tx,dy=e.changedTouches[0].clientY-ty;const dt=Date.now()-tt;tt=0;
 if(Math.abs(dx)>55&&Math.abs(dy)<45&&dt<700&&isBook()&&!S.ui.panelId)bookGo(dx<0?1:-1);
},{passive:true});
let rz;
window.addEventListener('resize',()=>{clearTimeout(rz);rz=setTimeout(()=>{if(isBook()&&S.cur&&S.cur.refresh){renderBookCtl();S.cur.refresh();}},200);});
