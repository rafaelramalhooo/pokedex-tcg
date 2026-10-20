/* Funções de apoio e ícones. */

export const $=(s,r=document)=>r.querySelector(s);
export const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
export const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const nz=s=>String(s==null?'':s).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim();
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
