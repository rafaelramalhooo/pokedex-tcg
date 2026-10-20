/* Logos das expansões: cadeia de alternativas e diagnóstico. */
import {pool} from './api.js';
import {saveKV} from './db.js';
import {S, softNow} from './state.js';
import {debounce, esc} from './util.js';

const AS='https://assets.tcgdex.net';
const saveLogoOk=debounce(()=>saveKV('logoOk',S.logoOk),600);
const isSym=u=>/\/symbol(\.|$)/.test(u||'');

/* Endereços possíveis, do mais provável ao menos: o que já funcionou, o do catálogo (webp e png),
   o da versão em inglês, o montado pela série e, por último, o símbolo da expansão. */
export function logoCandidates(s){
 const out=[];const add=u=>{if(u&&!out.includes(u))out.push(u);};
 add(S.logoOk[s.id]);
 const both=b=>{if(b){add(b+'.webp');add(b+'.png');}};
 both(s.logo);both(s.logoEn);
 const se=S.serieOf[s.id];
 if(se)['pt','en'].forEach(l=>both(`${AS}/${l}/${se.id}/${s.id}/logo`));
 if(s.symbol)add(s.symbol+'.webp');
 return out;
}
export function logoImg(s){
 const c=logoCandidates(s);
 if(!c.length)return `<span class="noimg">${esc(s.name)}</span>`;
 return `<img alt="" decoding="async" loading="lazy" src="${esc(c[0])}" data-role="logo" data-sid="${esc(s.id)}" data-name="${esc(s.name)}" data-chain="${esc(c.join('|'))}" data-i="0">`;
}
/* Chamado quando uma imagem de logo falha: tenta a próxima; no fim, mostra o nome. */
export function logoFail(t){
 const chain=(t.dataset.chain||'').split('|');
 const i=(+t.dataset.i||0)+1;
 if(i<chain.length){t.dataset.i=i;t.src=chain[i];return;}
 const w=t.parentElement;if(w)w.innerHTML=`<span class="noimg">${esc(t.dataset.name||'')}</span>`;
}
document.addEventListener('load',e=>{
 const t=e.target;
 if(!t||t.tagName!=='IMG'||t.dataset.role!=='logo')return;
 const u=t.currentSrc||t.src;
 if(isSym(u)){t.classList.add('symlogo');return;}
 const id=t.dataset.sid;
 if(id&&S.logoOk[id]!==u){S.logoOk[id]=u;saveLogoOk();}
},true);

function probe(url){
 return new Promise(res=>{
  const im=new Image();
  im.onload=()=>res(true);im.onerror=()=>res(false);
  im.src=url;
 });
}
/* Diagnóstico: testa a cadeia de cada expansão e lista as que ficaram sem logo. */
export async function checkLogos(sets){
 if(S.logoDiag&&S.logoDiag.running)return;
 const d=S.logoDiag={running:true,done:0,total:sets.length,missing:[],viaAlt:0};
 softNow();
 await pool(sets,8,async s=>{
  const first=(s.logo?s.logo+'.webp':'');
  let found='';
  for(const u of logoCandidates(s)){
   if(isSym(u))continue;
   if(await probe(u)){found=u;break;}
  }
  if(found){S.logoOk[s.id]=found;if(found!==first)d.viaAlt++;}
  else d.missing.push({id:s.id,name:s.name,hasSymbol:!!s.symbol});
  d.done++;if(d.done%6===0)softNow();
 });
 d.running=false;d.missing.sort((a,b)=>a.name.localeCompare(b.name,'pt'));
 saveLogoOk();softNow();
}
