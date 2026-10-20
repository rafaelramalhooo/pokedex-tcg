/* Legenda da carta: número (025/108) e bandeira do idioma. */
import {S} from './state.js';

const FL={
 pt:'<rect width="20" height="14" fill="#009b3a"/><path d="M10 1.8 18 7 10 12.2 2 7z" fill="#fedf00"/><circle cx="10" cy="7" r="3" fill="#002776"/>',
 en:'<rect width="20" height="14" fill="#fff"/><path fill="#b22234" d="M0 0h20v2H0zM0 4h20v2H0zM0 8h20v2H0zM0 12h20v2H0z"/><rect width="9" height="8" fill="#3c3b6e"/>',
 ja:'<rect width="20" height="14" fill="#fff"/><circle cx="10" cy="7" r="3.6" fill="#bc002d"/>',
 es:'<rect width="20" height="14" fill="#c60b1e"/><rect y="3.5" width="20" height="7" fill="#ffc400"/>',
 fr:'<rect width="20" height="14" fill="#fff"/><rect width="6.7" height="14" fill="#0055a4"/><rect x="13.3" width="6.7" height="14" fill="#ef4135"/>',
 de:'<rect width="20" height="14" fill="#dd0000"/><rect width="20" height="4.7" fill="#000"/><rect y="9.3" width="20" height="4.7" fill="#ffce00"/>',
 it:'<rect width="20" height="14" fill="#fff"/><rect width="6.7" height="14" fill="#009246"/><rect x="13.3" width="6.7" height="14" fill="#ce2b37"/>',
 ko:'<rect width="20" height="14" fill="#fff"/><path d="M6.5 7a3.5 3.5 0 0 1 7 0z" fill="#cd2e3a"/><path d="M6.5 7a3.5 3.5 0 0 0 7 0z" fill="#0047a0"/>',
 zh:'<rect width="20" height="14" fill="#de2910"/><circle cx="4" cy="4" r="2" fill="#ffde00"/>',
 xx:'<rect width="20" height="14" fill="#cbd2e0"/><text x="10" y="10.5" font-size="9" text-anchor="middle" fill="#59647d" font-family="sans-serif" font-weight="700">?</text>'
};
const NAME={pt:'Português',en:'Inglês',ja:'Japonês',es:'Espanhol',fr:'Francês',de:'Alemão',it:'Italiano',ko:'Coreano',zh:'Chinês',xx:'Outro idioma'};
export function flagHTML(lang){
 const k=FL[lang]?lang:'xx';
 return `<svg class="flag" viewBox="0 0 20 14" width="18" height="12" role="img" aria-label="${NAME[k]}"><title>${NAME[k]}</title>${FL[k]}</svg>`;
}
/* idioma: o da cópia que você registrou; sem registro, o da carta no catálogo */
export function langOf(id){
 const e=S.collection[id];
 if(e){for(const f in e.f){if(e.f[f].q>0&&e.f[f].l)return e.f[f].l;}}
 const c=S.cards[id]||{},b=S.briefs[id]||{};
 if(c.lang||b.lang)return c.lang||b.lang;
 const sid=b.setId||c.set;const s=sid&&S.setMap[sid];
 return (s&&s.lang)||'pt';
}
export function officialOf(setId){
 const d=S.setd[setId]||{};const s=S.setMap[setId]||{};
 const cc=d.cardCount||s.cardCount||{};
 return cc.official||cc.total||0;
}
export function numLabel(c){
 const lid=String(c.localId==null?'':c.localId);
 const sid=c.setId||(S.briefs[c.id]||{}).setId||(S.cards[c.id]||{}).set;
 const o=sid?officialOf(sid):0;
 return o&&/^\d+$/.test(lid)?`${lid}/${String(o).padStart(lid.length,'0')}`:lid;
}
/* trecho da direita da legenda */
export function capRight(c){
 return `<span class="no">${numLabel(c)}${flagHTML(langOf(c.id))}</span>`;
}
