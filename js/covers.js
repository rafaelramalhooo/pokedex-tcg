/* Capa dos fichários: arte de um Pokémon, imagem enviada por você ou uma das imagens do app. */
import {S} from './state.js';
import {dexArt, dexName} from './views/dex.js';
import {nz, esc} from './util.js';

/* Três imagens genéricas, desenhadas para o app (não reproduzem cartas, personagens ou logos). */
export const PRESETS=[
 ['ball','Esfera',`<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Esfera vermelha e branca"><defs><linearGradient id="g1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFE3E3"/><stop offset="1" stop-color="#F6B8B8"/></linearGradient></defs><rect width="120" height="120" fill="url(#g1)"/><circle cx="60" cy="60" r="38" fill="#fff" stroke="#121A2B" stroke-width="5"/><path d="M22 60a38 38 0 0 1 76 0z" fill="#D8342C" stroke="#121A2B" stroke-width="5" stroke-linejoin="round"/><path d="M22 60h76" stroke="#121A2B" stroke-width="5"/><circle cx="60" cy="60" r="11" fill="#fff" stroke="#121A2B" stroke-width="5"/><circle cx="60" cy="60" r="4" fill="#121A2B"/></svg>`],
 ['cards','Cartas',`<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Três cartas em leque"><defs><linearGradient id="g2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#DCE8FF"/><stop offset="1" stop-color="#B8CDF2"/></linearGradient></defs><rect width="120" height="120" fill="url(#g2)"/><g stroke="#121A2B" stroke-width="3.5" stroke-linejoin="round"><rect x="30" y="26" width="42" height="60" rx="5" fill="#F7D56B" transform="rotate(-16 51 56)"/><rect x="39" y="22" width="42" height="60" rx="5" fill="#8FD39B" transform="rotate(-2 60 52)"/><rect x="48" y="26" width="42" height="60" rx="5" fill="#fff" transform="rotate(14 69 56)"/></g><rect x="52" y="34" width="34" height="22" rx="3" fill="#E9EEF8" stroke="#121A2B" stroke-width="2.5" transform="rotate(14 69 45)"/><circle cx="66" cy="72" r="5" fill="#D8342C" stroke="#121A2B" stroke-width="2.5" transform="rotate(14 69 56)"/></svg>`],
 ['energy','Energia',`<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Raio dentro de um círculo"><defs><linearGradient id="g3" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFF2B8"/><stop offset="1" stop-color="#FAD25C"/></linearGradient></defs><rect width="120" height="120" fill="url(#g3)"/><circle cx="60" cy="60" r="36" fill="#fff" stroke="#121A2B" stroke-width="5"/><path d="M66 28 46 64h14l-6 28 22-40H62z" fill="#F3B21B" stroke="#121A2B" stroke-width="4" stroke-linejoin="round"/></svg>`]
];
const presetSvg=k=>(PRESETS.find(p=>p[0]===k)||PRESETS[0])[2];

/* nome (inglês, da PokeAPI) ou número -> número da Pokédex */
export function dexFromInput(raw){
 const t=String(raw||'').trim();if(!t)return 0;
 if(/^\d+$/.test(t)){const n=+t;return n>=1&&n<=1025?n:0;}
 const k=nz(t);
 for(const [n,name] of Object.entries(S.dexNames||{}))if(nz(name)===k)return +n;
 return 0;
}
/* Capa automática: Pokédex -> esfera; regra com um Pokémon -> arte dele; senão cartas. */
function autoCover(b){
 if(b.mode==='rule'){
  const pc=(b.conds||[]).find(c=>c.f==='pokemon'&&String(c.v).trim());
  if(pc){const first=String(pc.v).split(/[,;|]/)[0];const n=dexFromInput(first);if(n)return{kind:'dex',dex:n};}
  const dc=(b.conds||[]).find(c=>c.f==='dexId'&&c.op==='eq'&&/^\d+$/.test(String(c.v)));
  if(dc)return{kind:'dex',dex:+dc.v};
 }
 return{kind:'preset',k:b.mode==='pokedex'?'ball':'cards'};
}
export function coverOf(b){return b.cover&&b.cover.kind&&b.cover.kind!=='auto'?b.cover:autoCover(b);}
export function coverHTML(b){
 const c=coverOf(b);
 if(c.kind==='img'&&S.custom.covers&&S.custom.covers[b.id])return`<img src="${esc(S.custom.covers[b.id])}" alt="" data-role="own">`;
 if(c.kind==='dex'&&c.dex)return`<img src="${dexArt(c.dex)}" alt="" loading="lazy" data-role="dexart" title="${esc(dexName(c.dex))}">${''}`;
 return presetSvg(c.k||'cards');
}

/* Capa grande, para a primeira página do fichário aberto em página dupla. */
export function bookCover(b){
 const c=coverOf(b);
 return{html:coverHTML(b),title:b.name,cls:c.kind==='img'?'cov-img':c.kind==='dex'?'cov-dex':'cov-svg'};
}
