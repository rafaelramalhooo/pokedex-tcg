/* Peças de interface compartilhadas: avisos, imagens, controles. */
import {S} from './state.js';
import {logoFail} from './logos.js';
import {$, esc} from './util.js';
import {customCard} from './custom.js';
import {modeOf, tileOf} from './modes.js';
import {derivedImage} from './reprints.js';

let toastT=null;
export function toast(msg,label,fn){
 const t=$('#toast');
 t.innerHTML=`<span>${esc(msg)}</span>${label?`<button type="button">${esc(label)}</button>`:''}`;
 t.classList.add('on');
 const b=$('button',t);
 if(b)b.onclick=()=>{t.classList.remove('on');fn&&fn();};
 clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('on'),6500);
}

/* Imagem da carta. Sem imagem na TCGdex: usa a foto enviada por você (se houver) ou um cartão com nome e número. */
export function imgTag(base,q,name,role,id){
 const own=id&&customCard(id);
 if(own)return `<img decoding="async" alt="" src="${esc(own)}" data-role="own">`;
 if(!base&&id){
  const dv=derivedImage(id);
  if(dv)return `<img loading="lazy" decoding="async" alt="" src="${esc(dv.url)}/${q}.webp" data-b="${esc(dv.url)}" data-q="${q}" data-name="${esc(name||'')}" data-id="${esc(id)}" data-derived="${dv.kind}"${role?` data-role="${role}"`:''}>`;
 }
 if(!base){
  const b=id&&S.briefs[id];
  return `<div class="ph" data-noimg="1"><b>${esc(name||'')}</b>${b&&b.localId?`<small>${esc(b.localId)}</small>`:''}</div>`;
 }
 return `<img loading="lazy" decoding="async" alt="" src="${esc(base)}/${q}.webp" data-b="${esc(base)}" data-q="${q}" data-name="${esc(name||'')}"${id?` data-id="${esc(id)}"`:''}${role?` data-role="${role}"`:''}>`;
}
document.addEventListener('error',e=>{
 const t=e.target;
 if(!t||t.tagName!=='IMG')return;
 if(t.dataset.role==='logo'){logoFail(t);return;}
 if(t.dataset.role==='sym'||t.dataset.role==='dexart'){t.remove();return;}
 const n=+t.dataset.t||0,b=t.dataset.b||'';
 if(n===0&&b.includes('/pt/')){t.dataset.t=1;t.src=`${b.replace('/pt/','/en/')}/${t.dataset.q}.webp`;return;}
 if(t.dataset.role==='own')return;
 const d=document.createElement('div');d.className='ph';d.dataset.noimg='1';const bb=document.createElement('b');bb.textContent=t.dataset.name||'';d.appendChild(bb);t.replaceWith(d);
},true);


export function modeSeg(){
 const m=S.cur&&S.cur.name==='set'?modeOf(S.cur.id):S.settings.mode;
 return `<div class="seg" role="group" aria-label="Modo de contagem"><button type="button" data-act="mode" data-v="set" aria-pressed="${m==='set'}">Set</button><button type="button" data-act="mode" data-v="master" aria-pressed="${m==='master'}">Master Set</button></div>`;
}

export function noteHTML(kind,html){return `<div class="note ${kind||''}">${html}</div>`;}
export const sizeCtl=()=>`<label class="size">Tamanho<input type="range" id="tile" min="100" max="240" step="10" value="${tileOf()}"></label>`;
