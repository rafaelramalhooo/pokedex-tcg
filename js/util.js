/* Funções de apoio e ícones. */

export const $=(s,r=document)=>r.querySelector(s);
export const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
export const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
/* Sem acento, minúsculo; ♀ e ♂ viram " f" e " m" (Nidoran♀ = "nidoran f"). */
export const nz=s=>String(s==null?'':s).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/\s*♀/g,' f').replace(/\s*♂/g,' m').trim();
export const canon=(map,v)=>{const k=nz(v).replace(/\s+/g,'');return map[k]||k;};
export const sleep=ms=>new Promise(r=>setTimeout(r,ms));
export const uid=()=>Math.random().toString(36).slice(2,10);
export const debounce=(fn,ms)=>{let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms);};};
export const natCmp=(a,b)=>String(a).localeCompare(String(b),undefined,{numeric:true});
export const fmtDate=d=>d?String(d).split('-').reverse().join('/'):'';
export const pct=(a,b)=>b>0?Math.min(100,Math.round(a/b*100)):0;
export const fmtN=n=>Number(n||0).toLocaleString('pt-BR');
export const ICON={
 check:'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5l3.2 3.2L13 4.8"/></svg>',
 back:'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3L5 8l5 5"/></svg>',
 grid:'<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="6" height="6" rx="1.2"/><rect x="11" y="3" width="6" height="6" rx="1.2"/><rect x="3" y="11" width="6" height="6" rx="1.2"/><rect x="11" y="11" width="6" height="6" rx="1.2"/></svg>',
 binder:'<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="2.5" width="12.5" height="15" rx="2"/><path d="M4 6.5H2.5M4 10H2.5M4 13.5H2.5M9 7h4.5M9 10.5h4.5"/></svg>',
 gear:'<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="10" cy="10" r="2.6"/><path d="M10 2.5v2.2M10 15.3v2.2M2.5 10h2.2M15.3 10h2.2M4.7 4.7l1.6 1.6M13.7 13.7l1.6 1.6M15.3 4.7l-1.6 1.6M6.3 13.7l-1.6 1.6"/></svg>'
};

/* ---------- atualização sem recarregar ----------
   live(el) faz com que "el.innerHTML = html" troque só o que mudou. Elementos iguais (e as imagens já carregadas
   dentro deles) ficam onde estão; só os que mudaram são trocados. */
const NATIVE=Object.getOwnPropertyDescriptor(Element.prototype,'innerHTML');
const MAXD=4;
const LEAF=/^(INPUT|SELECT|TEXTAREA|BUTTON|SVG|svg)$/;
function tagSig(node,d){for(const c of node.children){c.__sig=c.outerHTML;if(d<MAXD)tagSig(c,d+1);}}
function syncAttrs(o,n){
 for(const a of Array.from(o.attributes))if(!n.hasAttribute(a.name))o.removeAttribute(a.name);
 for(const a of Array.from(n.attributes))if(o.getAttribute(a.name)!==a.value)o.setAttribute(a.name,a.value);
}
function morph(parent,frag,d){
 const olds=Array.from(parent.childNodes),news=Array.from(frag.childNodes);
 const len=Math.max(olds.length,news.length);
 for(let i=0;i<len;i++){
  const o=olds[i],n=news[i];
  if(!n){o.remove();continue;}
  if(!o){parent.appendChild(n);if(n.nodeType===1){n.__sig=n.outerHTML;if(d<MAXD)tagSig(n,d+1);}continue;}
  if(o.nodeType!==n.nodeType||(o.nodeType===1&&o.tagName!==n.tagName)){
   o.replaceWith(n);if(n.nodeType===1){n.__sig=n.outerHTML;if(d<MAXD)tagSig(n,d+1);}continue;
  }
  if(o.nodeType!==1){if(o.data!==n.data)o.data=n.data;continue;}
  const sig=n.outerHTML;
  if(o.__sig===sig)continue;
  if(d<MAXD&&!LEAF.test(o.tagName)&&o.children.length&&n.children.length){
   syncAttrs(o,n);morph(o,n,d+1);o.__sig=sig;
  }else{
   o.replaceWith(n);n.__sig=sig;if(d<MAXD)tagSig(n,d+1);
  }
 }
}
export function setHTML(el,html){
 if(!el.firstChild){NATIVE.set.call(el,html);tagSig(el,0);return;}
 const t=document.createElement('template');t.innerHTML=html;
 morph(el,t.content,0);
}
export function live(el){
 if(!el||el.__live)return el;
 el.__live=true;
 Object.defineProperty(el,'innerHTML',{configurable:true,get(){return NATIVE.get.call(this);},set(v){setHTML(this,v);}});
 return el;
}

export const brl=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
