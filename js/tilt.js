/* Efeito de "mexer na carta": inclinação 3D e brilho que seguem o mouse ou o dedo. */
const reduce=()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
let active=null;
function aim(el,e){
 const k=el.classList.contains('pocket')?0.5:1; /* cartas nas grades: inclinação mais suave */
 const r=el.getBoundingClientRect();
 const x=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y=Math.max(0,Math.min(1,(e.clientY-r.top)/r.height));
 el.style.setProperty('--rx',((0.5-y)*26*k).toFixed(2)+'deg');
 el.style.setProperty('--ry',((x-0.5)*26*k).toFixed(2)+'deg');
 el.style.setProperty('--mx',(x*100).toFixed(1)+'%');
 el.style.setProperty('--my',(y*100).toFixed(1)+'%');
 el.classList.add('hot');
}
function rest(el){
 el.classList.remove('hot');
 ['--rx','--ry','--mx','--my'].forEach(k=>el.style.removeProperty(k));
}
const tiltOf=e=>e.target&&e.target.closest?e.target.closest('.tilt,.pocket'):null;
document.addEventListener('pointermove',e=>{
 if(reduce())return;
 if(e.pointerType==='mouse'){
  const el=tiltOf(e);
  document.querySelectorAll('.tilt.hot,.pocket.hot').forEach(h=>{if(h!==el)rest(h);});
  if(el)aim(el,e);
 }else if(active)aim(active,e);
 else if(pend&&Math.hypot(e.clientX-pend.x,e.clientY-pend.y)>6){active=pend.el;pend=null;aim(active,e);}
});
let pend=null;
document.addEventListener('pointerdown',e=>{
 if(reduce()||e.pointerType==='mouse')return;
 const el=tiltOf(e);
 if(!el)return;
 /* nas grades, o dedo só inclina depois de arrastar um pouco; um toque simples não mexe na carta */
 if(el.classList.contains('pocket')){pend={el,x:e.clientX,y:e.clientY};return;}
 active=el;aim(el,e);
});
const end=()=>{pend=null;if(active){rest(active);active=null;}};
document.addEventListener('pointerup',end);
document.addEventListener('pointercancel',end);
document.addEventListener('mouseleave',()=>document.querySelectorAll('.tilt.hot,.pocket.hot').forEach(rest));
