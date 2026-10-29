/* Filtros por Raridade e por Tipo (escolha múltipla) para Coleções e Fichários.
   Dentro de cada filtro vale "ou" (Fogo ou Água); entre filtros vale "e" (Rara Holo e Fogo).
   Tipo inclui Treinador e Energia. Precisa dos detalhes da carta, que são baixados sob demanda. */
import {S, soft, viewCache} from './state.js';
import {pool} from './api.js';
import {ensureCard} from './catalog.js';
import {CAT_ALIAS, TYPES, TYPE_ALIAS, rarityPt} from './constants.js';
import {canon, esc, fmtN} from './util.js';

const AUTO=300; /* até este tanto de cartas sem detalhes, baixa sozinho ao abrir o filtro */
let ctx=[];     /* cartas da tela atual */
let running=false;

const ff=()=>S.ui.ff||(S.ui.ff={rar:[],tipo:[],open:null,pending:null});
export function ffReset(){S.ui.ff={rar:[],tipo:[],open:null,pending:null};ctx=[];}
export const ffActive=()=>{const f=ff();return f.rar.length>0||f.tipo.length>0;};
export const ffSig=()=>{const f=ff();return f.rar.length||f.tipo.length?'|f:'+f.rar.join(',')+';'+f.tipo.join(','):'';};

/* Raridades como no quadro das cartas (símbolo e nome em português do Brasil) */
const RAR_SHOW=new Map([['Rara Dupla','Dupla Rara'],['Hiper rara','Hiper Rara'],['ACE SPEC Raro','Ace Spec Rara'],['Ilustração Rara Especial','Ilustração Especial Rara'],['Brilhante Ultra Rara','Shiny Ultra Rara'],['Shiny rara','Shiny Rara']]);
const RAR_ORDER=['Comum','Incomum','Rara','Dupla Rara','Ace Spec Rara','Ilustração Rara','Ultra Rara','Ilustração Especial Rara','Hiper Rara','Shiny Rara','Shiny Ultra Rara','Promo'];
const RAR_SYM={'Comum':'●','Incomum':'◆','Rara':'★','Dupla Rara':'★★','Ace Spec Rara':'★','Ilustração Rara':'★','Ultra Rara':'★★','Ilustração Especial Rara':'★★','Hiper Rara':'★★★','Shiny Rara':'☆','Shiny Ultra Rara':'☆☆'};
const TIPO_LBL=new Map([...TYPES,['treinador','Treinador'],['energia','Energia']]);
const TIPO_ORDER=[...TYPES.map(t=>t[0]),'treinador','energia'];

export function facets(id){
 const c=S.cards[id];if(!c)return null;
 const cat=canon(CAT_ALIAS,c.category);
 let tipos;
 if(cat==='treinador')tipos=['treinador'];
 else if(cat==='energia')tipos=['energia'];
 else tipos=[...new Set((c.types||[]).map(t=>canon(TYPE_ALIAS,t)).filter(Boolean))];
 const rp=c.rarity&&!/^(none|nenhuma|-)$/i.test(String(c.rarity).trim())?String(rarityPt(c.rarity)):'';
 return{rar:rp?(RAR_SHOW.get(rp)||rp):'Sem raridade',tipos};
}
export function ffMatch(id){
 if(!ffActive())return true;
 const f=ff(),x=facets(id);if(!x)return false;
 if(f.rar.length&&!f.rar.includes(x.rar))return false;
 if(f.tipo.length&&!x.tipos.some(t=>f.tipo.includes(t)))return false;
 return true;
}
function options(ids){
 const f=ff(),rar=new Map(),tipo=new Map();
 ids.forEach(id=>{const x=facets(id);if(!x)return;rar.set(x.rar,(rar.get(x.rar)||0)+1);x.tipos.forEach(t=>tipo.set(t,(tipo.get(t)||0)+1));});
 f.rar.forEach(r=>{if(!rar.has(r))rar.set(r,0);});
 f.tipo.forEach(t=>{if(!tipo.has(t))tipo.set(t,0);});
 return{
  rar:[...rar.entries()].sort((a,b)=>{const ia=RAR_ORDER.indexOf(a[0]),ib=RAR_ORDER.indexOf(b[0]);if(ia>=0||ib>=0)return(ia<0?99:ia)-(ib<0?99:ib);return b[1]-a[1]||a[0].localeCompare(b[0],'pt');}),
  tipo:[...tipo.entries()].sort((a,b)=>TIPO_ORDER.indexOf(a[0])-TIPO_ORDER.indexOf(b[0])).map(([k,n])=>[k,n,TIPO_LBL.get(k)||k])
 };
}
const missingOf=ids=>ids.filter(id=>!S.cards[id]);

async function loadMissing(){
 if(running)return;
 const todo=missingOf(ctx);if(!todo.length)return;
 running=true;const f=ff();f.pending={done:0,total:todo.length};
 try{
  await pool(todo,8,async id=>{
   try{await ensureCard(id);}catch(e){}
   f.pending.done++;
   if(f.pending.done%12===0)soft();
  });
 }finally{f.pending=null;running=false;viewCache.clear();soft();}
}

/* Barra de filtros: botões, quadro de opções e aviso de detalhes. */
export function renderBar(ids){
 const el=document.getElementById('ffbar');if(!el)return;
 ctx=ids;
 const f=ff(),o=options(ids),miss=missingOf(ids).length;
 const btn=(k,label,n)=>`<button type="button" class="btn small fbtn" data-act="ff-open" data-k="${k}" aria-expanded="${f.open===k}" aria-pressed="${n>0}">${label}${n?` · ${n}`:''} <span aria-hidden="true">${f.open===k?'▴':'▾'}</span></button>`;
 let h=`<div class="fbar"><span class="flab">Filtrar por</span>${btn('rar','Raridade',f.rar.length)}${btn('tipo','Tipo',f.tipo.length)}${ffActive()?'<button type="button" class="btn small ghost" data-act="ff-clear">Limpar filtros</button>':''}</div>`;
 if(f.open){
  const list=f.open==='rar'?o.rar.map(([k,n])=>[k,n,(RAR_SYM[k]?RAR_SYM[k]+' ':'')+k]):o.tipo;
  h+=`<div class="fpanel" role="group" aria-label="${f.open==='rar'?'Raridades':'Tipos'}">`+(list.length?list.map(([k,n,l])=>{
   const on=(f.open==='rar'?f.rar:f.tipo).includes(k);
   return`<button type="button" class="fchip" data-act="ff-tog" data-k="${f.open}" data-v="${esc(k)}" aria-pressed="${on}">${esc(l)} <small>${fmtN(n)}</small></button>`;
  }).join(''):'<span class="fempty">Ainda não há detalhes das cartas para listar as opções.</span>')+`</div>`;
 }
 if(f.pending)h+=`<p class="fnote" role="status">Carregando detalhes de ${fmtN(f.pending.total)} cartas: ${fmtN(f.pending.done)} prontas.</p>`;
 else if(miss&&(ffActive()||f.open))h+=`<p class="fnote">${fmtN(miss)} cartas ainda não têm detalhes e só entram no filtro depois de carregadas. <button type="button" class="btn small" data-act="ff-load">Baixar agora</button></p>`;
 el.innerHTML=h;
}
const toggle=(arr,v)=>{const i=arr.indexOf(v);if(i<0)arr.push(v);else arr.splice(i,1);};
const redraw=()=>{S.ui.binderShown=240;S.ui.page=0;if(S.cur&&S.cur.refresh)S.cur.refresh();};
export const FF_ACT={
 'ff-open':t=>{const f=ff();f.open=f.open===t.dataset.k?null:t.dataset.k;renderBar(ctx);if(f.open&&missingOf(ctx).length&&missingOf(ctx).length<=AUTO)loadMissing();},
 'ff-tog':t=>{const f=ff();toggle(t.dataset.k==='rar'?f.rar:f.tipo,t.dataset.v);redraw();if(missingOf(ctx).length&&missingOf(ctx).length<=AUTO)loadMissing();},
 'ff-clear':()=>{const f=ff();f.rar=[];f.tipo=[];redraw();},
 'ff-load':()=>{loadMissing();}
};
