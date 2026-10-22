/* Pokédex: arte e nome dos Pokémon, e a janela com as cartas de um Pokémon para marcar as que você tem. */
import {getOrNull} from '../api.js';
import {ensureCard, ensureSetd, visibleSet} from '../catalog.js';
import {extraIdsFor} from '../dex30.js';
import {defaultFin, isOwned, ownedQty, persistEntry, toggleOwn} from '../collection.js';
import {saveKV} from '../db.js';
import {S, viewCache, refreshAll} from '../state.js';
import {imgTag} from '../ui.js';
import {dexModel} from '../rules.js';
import {flagHTML, langOf} from '../cardlabel.js';
import {saveBinders} from '../db.js';
import {$, esc, fmtN, natCmp, nz} from '../util.js';

export const pad4=n=>String(n).padStart(4,'0');
export const dexArt=n=>`https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon/other/official-artwork/${n}.png`;
export const dexName=n=>S.dexNames[n]||'';

/* ---------- nomes (PokeAPI, em inglês) ---------- */
const EXC={'nidoran-f':'Nidoran ♀','nidoran-m':'Nidoran ♂','mr-mime':'Mr. Mime','mime-jr':'Mime Jr.','mr-rime':'Mr. Rime','farfetchd':"Farfetch'd",'sirfetchd':"Sirfetch'd",'flabebe':'Flabébé','type-null':'Type: Null','porygon-z':'Porygon-Z','ho-oh':'Ho-Oh','jangmo-o':'Jangmo-o','hakamo-o':'Hakamo-o','kommo-o':'Kommo-o','wo-chien':'Wo-Chien','chien-pao':'Chien-Pao','ting-lu':'Ting-Lu','chi-yu':'Chi-Yu'};
const pretty=slug=>EXC[slug]||slug.split('-').map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(' ');
let namesTried=false;
export async function loadDexNames(){
 if(namesTried||Object.keys(S.dexNames).length)return;
 namesTried=true;
 try{
  const r=await fetch('https://pokeapi.co/api/v2/pokemon-species?limit=2000');
  if(!r.ok)throw new Error('http');
  const d=await r.json();const m={};
  (d.results||[]).forEach(x=>{const id=+((String(x.url).match(/species\/(\d+)/)||[])[1]);if(id)m[id]=pretty(x.name);});
  if(Object.keys(m).length){S.dexNames=m;saveKV('dexNames',m);if(S.cur&&S.cur.refresh)S.cur.refresh();}
 }catch(e){/* sem nomes: o espaço mostra só a arte e o número */}
}

/* ---------- cartas de um Pokémon (TCGdex, filtro por número da Pokédex) ---------- */
async function fetchDexCards(n){
 const p=`/cards?dexId=eq:${n}`;
 const [pt,en]=await Promise.all([getOrNull(p,'pt'),getOrNull(p,'en')]);
 const ptM=new Map((pt||[]).map(c=>[c.id,c]));
 const base=(en&&en.length>=(pt||[]).length)?en:(pt||[]);
 const seen=new Set();const out=[];
 [...base.map(c=>ptM.get(c.id)||c),...(pt||[])].forEach(c=>{
  if(seen.has(c.id))return;seen.add(c.id);
  const localId=String(c.localId);
  const setId=c.id.slice(0,c.id.length-localId.length-1);
  const b={id:c.id,localId,name:c.name,image:c.image,setId};
  if(!S.briefs[c.id])S.briefs[c.id]=b;
  out.push(b);
 });
 /* cartas sem dexId na TCGdex (Celebração de 30 Anos): vêm do mapa fixo */
 for(const id of extraIdsFor(n)){
  if(seen.has(id))continue;
  const sid=id.slice(0,id.lastIndexOf('-'));
  if(!S.briefs[id]){try{await ensureSetd(sid);}catch(e){}}
  const b=S.briefs[id];if(b){seen.add(id);out.push(b);}
 }
 /* mais nova primeiro (a lista de coleções vem da mais antiga para a mais nova) */
 out.sort((a,b)=>((S.setIdx[b.setId]??-1)-(S.setIdx[a.setId]??-1))||natCmp(a.localId,b.localId));
 return out;
}
export async function openDex(n,binderId){
 const bb=S.binders.find(x=>x.id===binderId);
 const slot=bb?dexModel(bb).find(x=>x.dex===n):null;
 S.ui.dexdlg={dex:n,binderId,q:'',only:!!(slot&&!slot.rep&&slot.have.length),err:false};
 $('#modal').classList.add('on');
 renderDex();
 if(!S.dexCards[n]){
  try{S.dexCards[n]=await fetchDexCards(n);}catch(e){if(S.ui.dexdlg&&S.ui.dexdlg.dex===n)S.ui.dexdlg.err=true;}
  if(S.ui.dexdlg&&S.ui.dexdlg.dex===n)renderDex();
 }
}
const titleOf=n=>dexName(n);
export function renderDex(){
 const st=S.ui.dexdlg;if(!st)return;
 const d=$('#dialog');
 const name=titleOf(st.dex);
 d.innerHTML=`<div class="dexhead"><div class="dexart"><img alt="" src="${dexArt(st.dex)}" data-role="dexart"></div><div><h2>${esc(name||'Pokémon')} <small>#${pad4(st.dex)}</small></h2><p class="lead" id="dexsum" style="margin:0"></p></div></div>
  <div class="row" style="margin:12px 0"><input class="field" id="dq" type="search" placeholder="Nome, número ou coleção. Ex.: bulbasaur (001/132)" aria-label="Buscar carta" value="${esc(st.q)}" style="flex:1 1 200px">
   <label class="size"><input type="checkbox" data-dexonly ${st.only?'checked':''}> Só as que tenho</label></div>
  <div id="dexgrid"></div>
  <div class="actions"><span class="lbl2">Toque numa carta para colocá-la neste espaço. Toque de novo para tirá-la; ela continua na sua coleção.</span><button class="btn primary" type="button" data-act="dex-close">Concluir</button></div>`;
 renderDexGrid();
}
export function renderDexGrid(){
 const st=S.ui.dexdlg;const g=$('#dexgrid');if(!st||!g)return;
 const all=S.dexCards[st.dex]&&S.dexCards[st.dex].filter(c=>visibleSet(c.setId));
 const sum=$('#dexsum');
 if(st.err){g.innerHTML=`<div class="note err">Não consegui buscar as cartas na TCGdex. <button class="btn small" type="button" data-act="dex-retry">Tentar de novo</button></div>`;if(sum)sum.textContent='';return;}
 if(!all){g.innerHTML='<p class="lead">Buscando as cartas na TCGdex…</p>';if(sum)sum.textContent='';return;}
 const own=all.filter(c=>isOwned(c.id)).length;
 if(sum)sum.textContent=`${fmtN(all.length)} cartas encontradas, você tem ${fmtN(own)}.`;
 const bnd=st.binderId?S.binders.find(x=>x.id===st.binderId):null;
 const q=parseQuery(st.q);
 const list=all.filter(c=>{
  if(st.only&&!isOwned(c.id))return false;
  return matchQuery(c,q);
 });
 if(!all.length){g.innerHTML='<div class="empty"><h3>Nenhuma carta encontrada</h3><p>A TCGdex não tem cartas catalogadas para este Pokémon.</p></div>';return;}
 if(!list.length){g.innerHTML='<div class="empty"><h3>Nada por aqui</h3><p>Ajuste a busca ou o filtro.</p></div>';return;}
 g.innerHTML=`<div class="dgrid">${list.map(c=>{
  const q2=ownedQty(c.id);const on=q2>0;const set=S.setMap[c.setId];
  const here=!!(bnd&&bnd.pick&&bnd.pick[st.dex]===c.id&&on);
  return`<div class="dtile ${here?'on here':on?'have':'off'}" data-act="dex-toggle" data-id="${esc(c.id)}" role="button" tabindex="0" aria-pressed="${here}" aria-label="${esc(c.name)}, ${esc(set?set.name:c.setId)}, ${here?'neste espaço':on?'tenho em outro fichário':'não tenho'}">
   <div class="pocket">${imgTag(c.image,'low',c.name,undefined,c.id)}${q2>1?`<span class="qty">×${q2}</span>`:''}${here?'<span class="qty here">Neste espaço</span>':on?'<span class="qty havechip">Tenho</span>':''}<span class="dchk" aria-hidden="true">✓</span></div>
   <div class="num"><b>${esc(c.name)}</b><span class="fl">${flagHTML(langOf(c.id))}</span></div><div class="num"><span>${esc(set?set.name:c.setId)} · ${esc(numLabel(c))}</span></div>
   <button type="button" class="btn small dd" data-act="open" data-id="${esc(c.id)}" data-binder="${esc(st.binderId)}" data-dex="${st.dex}">Detalhes</button></div>`;}).join('')}</div>`;
}

/* Busca estilo Liga Pokémon: "bulbasaur (001/132)", "bulbasaur 1", "151/165", "mew ex", nome da coleção. */
export function parseQuery(raw){
 let t=String(raw||'');let num=null,tot=null;
 const m=t.match(/(\d+)\s*\/\s*(\d+)/);
 if(m){num=parseInt(m[1],10);tot=parseInt(m[2],10);t=t.replace(m[0],' ');}
 else{const n=t.match(/(?:^|[\s(#])(\d{1,4})(?=$|[\s)])/);if(n){num=parseInt(n[1],10);t=t.replace(n[0],' ');}}
 const words=nz(t.replace(/[()\[\]#,]/g,' ')).split(/\s+/).filter(Boolean);
 return{words,num,tot};
}
export function officialOf(setId){
 const d=S.setd[setId]||{};const s=S.setMap[setId]||{};
 const cc=d.cardCount||s.cardCount||{};
 return cc.official||cc.total||0;
}
export function matchQuery(c,q){
 if(q.num!==null){
  const ln=/^\d+$/.test(String(c.localId))?parseInt(c.localId,10):null;
  if(ln!==q.num)return false;
 }
 if(q.tot!==null){const o=officialOf(c.setId);if(o&&o!==q.tot)return false;}
 if(!q.words.length)return true;
 const set=S.setMap[c.setId];
 const hay=nz(c.name)+' '+nz(set?set.name:'')+' '+nz(c.setId);
 return q.words.every(w=>hay.includes(w));
}
const numLabel=c=>{const o=officialOf(c.setId);return o&&/^\d+$/.test(String(c.localId))?`${c.localId}/${String(o).padStart(String(c.localId).length,'0')}`:c.localId;};
export function dexToggle(id){
 const st=S.ui.dexdlg;
 const b=st&&st.binderId?S.binders.find(x=>x.id===st.binderId):null;
 if(!b){toggleOwn(id);return;}
 b.pick=b.pick||{};
 const here=b.pick[st.dex]===id&&isOwned(id);
 if(here){delete b.pick[st.dex];saveBinders();viewCache.clear();refreshAll();return;}
 /* colocar neste espaço; se ainda não tinha a carta, ela passa a fazer parte da coleção */
 const fill=()=>{b.pick[st.dex]=id;saveBinders();viewCache.clear();refreshAll();};
 if(isOwned(id)){fill();if(!S.cards[id])ensureCard(id).then(()=>{viewCache.clear();refreshAll();}).catch(()=>{});return;}
 toggleOwn(id);b.pick[st.dex]=id;saveBinders();
 ensureCard(id).then(c=>{
  const e=S.collection[id];
  if(e&&c&&c.variants){
   const fins=Object.keys(e.f);
   if(fins.length===1&&fins[0]==='normal'&&!c.variants.normal){const f=defaultFin(id);e.f={[f]:e.f.normal};persistEntry(id);}
  }
  viewCache.clear();refreshAll();
 }).catch(()=>{});
 viewCache.clear();refreshAll();
}
export function retryDex(){
 const st=S.ui.dexdlg;if(!st)return;
 st.err=false;delete S.dexCards[st.dex];openDex(st.dex,st.binderId);
}
