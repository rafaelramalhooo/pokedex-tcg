/* Carrega as imagens das cartas um pouco antes de aparecerem na tela (2 telas de folga) e as mostra com um fade,
   para não "piscar" ao rolar. As imagens são criadas com data-src e a classe "lz". */
const MARGIN='2200px 0px';
const io=typeof IntersectionObserver==='function'?new IntersectionObserver(es=>{
 es.forEach(e=>{if(e.isIntersecting){io.unobserve(e.target);start(e.target);}});
},{rootMargin:MARGIN}):null;
function start(img){
 const s=img.getAttribute('data-src');
 if(!s)return;
 img.removeAttribute('data-src');
 img.src=s;
 if(img.complete&&img.naturalWidth)img.classList.remove('lz');
}
function watch(img){if(io)io.observe(img);else start(img);}
function scan(n){
 if(n.nodeType!==1)return;
 if(n.matches('img[data-src]'))watch(n);
 n.querySelectorAll('img[data-src]').forEach(watch);
}
new MutationObserver(ms=>ms.forEach(m=>m.addedNodes.forEach(scan))).observe(document.documentElement,{childList:true,subtree:true});
document.addEventListener('load',e=>{const t=e.target;if(t&&t.tagName==='IMG')t.classList.remove('lz');},true);
document.addEventListener('error',e=>{const t=e.target;if(t&&t.tagName==='IMG')t.classList.remove('lz');},true);
scan(document.documentElement);
