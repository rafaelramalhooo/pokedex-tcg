/* Peças de interface compartilhadas: avisos, imagens, controles. */
import {S} from './state.js';
import {logoFail} from './logos.js';
import {$, esc} from './util.js';

let toastT=null;
export function toast(msg,label,fn){
 const t=$('#toast');
 t.innerHTML=`<span>${esc(msg)}</span>${label?`<button type="button">${esc(label)}</button>`:''}`;
 t.classList.add('on');
 const b=$('button',t);
 if(b)b.onclick=()=>{t.classList.remove('on');fn&&fn();};
 clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('on'),6500);
}

export function imgTag(base,q,name,role){
 if(!base)return `<div class="ph">${esc(name||'')}</div>`;
 return `<img loading="lazy" decoding="async" alt="" src="${esc(base)}/${q}.webp" data-b="${esc(base)}" data-q="${q}" data-name="${esc(name||'')}"${role?` data-role="${role}"`:''}>`;
}
document.addEventListener('error',e=>{
 const t=e.target;
 if(!t||t.tagName!=='IMG')return;
 if(t.dataset.role==='logo'){logoFail(t);return;}
 if(t.dataset.role==='sym'||t.dataset.role==='dexart'){t.remove();return;}
 const n=+t.dataset.t||0,b=t.dataset.b||'';
 if(n===0&&b.includes('/pt/')){t.dataset.t=1;t.src=`${b.replace('/pt/','/en/')}/${t.dataset.q}.webp`;return;}
 const d=document.createElement('div');d.className='ph';d.textContent=t.dataset.name||'';t.replaceWith(d);
},true);


export function modeSeg(){
 const m=S.settings.mode;
 return `<div class="seg" role="group" aria-label="Modo de contagem"><button type="button" data-act="mode" data-v="set" aria-pressed="${m==='set'}">Set</button><button type="button" data-act="mode" data-v="master" aria-pressed="${m==='master'}">Master Set</button></div>`;
}

export function noteHTML(kind,html){return `<div class="note ${kind||''}">${html}</div>`;}
export const sizeCtl=()=>`<label class="size">Tamanho<input type="range" id="tile" min="100" max="240" step="10" value="${S.settings.tile}"></label>`;
