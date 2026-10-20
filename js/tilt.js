/* Efeito de "mexer na carta": inclinação 3D e brilho que seguem o mouse ou o dedo. */
const reduce=()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
let active=null;
function aim(el,e){
 const r=el.getBoundingClientRect();
 const x=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y=Math.max(0,Math.min(1,(e.clientY-r.top)/r.height));
 el.style.setProperty('--rx',((0.5-y)*26).toFixed(2)+'deg');
 el.style.setProperty('--ry',((x-0.5)*26).toFixed(2)+'deg');
 el.style.setProperty('--mx',(x*100).toFixed(1)+'%');
 el.style.setProperty('--my',(y*100).toFixed(1)+'%');
 el.classList.add('hot');
}
function rest(el){
 el.classList.remove('hot');
 ['--rx','--ry','--mx','--my'].forEach(k=>el.style.removeProperty(k));
}
const tiltOf=e=>e.target&&e.target.closest?e.target.closest('.tilt'):null;
document.addEventListener('pointermove',e=>{
 if(reduce())return;
 if(e.pointerType==='mouse'){
  const el=tiltOf(e);
  document.querySelectorAll('.tilt.hot').forEach(h=>{if(h!==el)rest(h);});
  if(el)aim(el,e);
 }else if(active)aim(active,e);
});
document.addEventListener('pointerdown',e=>{
 if(reduce()||e.pointerType==='mouse')return;
 const el=tiltOf(e);if(el){active=el;aim(el,e);}
});
const end=()=>{if(active){rest(active);active=null;}};
document.addEventListener('pointerup',end);
document.addEventListener('pointercancel',end);
document.addEventListener('mouseleave',()=>document.querySelectorAll('.tilt.hot').forEach(rest));
