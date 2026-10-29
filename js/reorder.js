/* Mudar a ordem das cartas numa lista de Negociação.
   Mouse: clicar e arrastar. Toque (iPad, celular): segurar a carta por um instante e arrastar.
   Teclado: com a carta em foco, Alt + setas ← → movem uma posição. A ordem fica salva e sincroniza como o resto da lista. */
import {S} from './state.js';
import {getTrade, itemKey, moveItemTo, saveTrades} from './trades.js';
import {toast} from './ui.js';

const HOLD=380;      /* ms de toque até o arrasto começar */
const SLOP=8;        /* px de tolerância enquanto espera o toque longo */
const MOUSE_MOVE=6;  /* px para começar a arrastar com o mouse */
let st=null;         /* gesto em andamento */
let suppressUntil=0; /* ignora o clique que o navegador gera ao soltar */

const tileOf=t=>t&&t.closest?t.closest('#tgrid .tradeslot[data-key]'):null;
const grid=()=>document.querySelector('#tgrid .cards');
const tid=()=>S.cur&&S.cur.name==='trade'?S.cur.id:null;

function startDrag(){
 if(!st||st.drag)return;
 st.drag=true;
 const r=st.tile.getBoundingClientRect();
 const g=st.tile.cloneNode(true);
 g.classList.add('dragghost');g.removeAttribute('data-act');g.removeAttribute('tabindex');g.setAttribute('aria-hidden','true');
 g.style.width=r.width+'px';g.style.height=r.height+'px';
 st.dx=st.x-r.left;st.dy=st.y-r.top;
 g.style.left=r.left+'px';g.style.top=r.top+'px';
 document.body.appendChild(g);
 st.ghost=g;
 st.tile.classList.add('dragging');
 document.body.classList.add('is-reordering');
 if(navigator.vibrate){try{navigator.vibrate(12);}catch(e){}}
 loopScroll();
}
function place(x,y){
 const g=st.ghost;if(!g)return;
 g.style.left=(x-st.dx)+'px';g.style.top=(y-st.dy)+'px';
 const el=document.elementFromPoint(x,y);
 const over=tileOf(el);
 if(!over||over===st.tile)return;
 const r=over.getBoundingClientRect();
 const after=(x-r.left)>r.width/2;
 const host=over.parentNode;
 if(after)host.insertBefore(st.tile,over.nextSibling);else host.insertBefore(st.tile,over);
}
function loopScroll(){
 if(!st||!st.drag)return;
 const h=window.innerHeight,y=st.y;
 let d=0;
 if(y<70)d=-Math.ceil((70-y)/6);else if(y>h-70)d=Math.ceil((y-(h-70))/6);
 if(d)window.scrollBy(0,d);
 st.raf=requestAnimationFrame(loopScroll);
}
function finish(commit){
 if(!st)return;
 clearTimeout(st.timer);cancelAnimationFrame(st.raf);
 const s=st;st=null;
 if(!s.drag)return;
 suppressUntil=Date.now()+350;
 if(s.ghost)s.ghost.remove();
 s.tile.classList.remove('dragging');
 document.body.classList.remove('is-reordering');
 const id=tid();const t=id&&getTrade(id);
 const g=grid();
 if(commit&&t&&g){
  const keys=[...g.querySelectorAll('.tradeslot[data-key]')].map(n=>n.dataset.key);
  const before=t.items.map(itemKey).join('\n');
  const byKey=new Map(t.items.map(i=>[itemKey(i),i]));
  const next=keys.map(k=>byKey.get(k)).filter(Boolean);
  if(next.length===t.items.length&&next.map(itemKey).join('\n')!==before){
   t.items=next;saveTrades();
   toast('Ordem da lista atualizada.');
  }
 }
 if(S.cur&&S.cur.refresh)S.cur.refresh();
}

document.addEventListener('pointerdown',e=>{
 if(e.button!==undefined&&e.button!==0)return;
 const tile=tileOf(e.target);
 if(!tile||e.target.closest('.stepper,button,a,input,select,label'))return;
 const g=grid();if(!g||g.querySelectorAll('.tradeslot').length<2)return;
 st={tile,x:e.clientX,y:e.clientY,sx:e.clientX,sy:e.clientY,type:e.pointerType,id:e.pointerId,drag:false};
 if(e.pointerType!=='mouse'){
  st.timer=setTimeout(()=>{if(st&&!st.drag)startDrag();},HOLD);
 }
},true);

document.addEventListener('pointermove',e=>{
 if(!st||e.pointerId!==st.id)return;
 st.x=e.clientX;st.y=e.clientY;
 if(!st.drag){
  const d=Math.hypot(st.x-st.sx,st.y-st.sy);
  if(st.type==='mouse'){if(d>MOUSE_MOVE)startDrag();}
  else if(d>SLOP){clearTimeout(st.timer);st=null;} /* o dedo andou antes do toque longo: é rolagem */
  if(!st||!st.drag)return;
 }
 e.preventDefault();
 place(st.x,st.y);
},true);

/* impede a rolagem da tela enquanto uma carta está sendo arrastada com o dedo */
document.addEventListener('touchmove',e=>{if(st&&st.drag)e.preventDefault();},{passive:false});
document.addEventListener('pointerup',e=>{if(st&&e.pointerId===st.id)finish(true);},true);
document.addEventListener('pointercancel',e=>{if(st&&e.pointerId===st.id)finish(false);},true);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&st&&st.drag){finish(false);e.stopPropagation();}},true);
document.addEventListener('dragstart',e=>{if(tileOf(e.target))e.preventDefault();},true);
document.addEventListener('contextmenu',e=>{if(st&&st.drag)e.preventDefault();},true);
/* o clique gerado ao soltar não deve abrir o painel da carta */
document.addEventListener('click',e=>{
 if(Date.now()<suppressUntil&&tileOf(e.target)){e.stopPropagation();e.preventDefault();}
},true);

/* Teclado: Alt + ← / → */
document.addEventListener('keydown',e=>{
 if(!e.altKey||(e.key!=='ArrowLeft'&&e.key!=='ArrowRight'))return;
 const tile=tileOf(document.activeElement);if(!tile)return;
 const id=tid();const t=id&&getTrade(id);if(!t)return;
 const key=tile.dataset.key;
 const i=t.items.findIndex(x=>itemKey(x)===key);if(i<0)return;
 const j=i+(e.key==='ArrowRight'?1:-1);
 if(j<0||j>=t.items.length){e.preventDefault();return;}
 e.preventDefault();
 moveItemTo(t,key,j);saveTrades();
 if(S.cur&&S.cur.refresh)S.cur.refresh();
 const again=[...document.querySelectorAll('#tgrid .tradeslot[data-key]')].find(n=>n.dataset.key===key);
 if(again)again.focus();
 toast(`Posição ${j+1} de ${t.items.length}.`);
});
