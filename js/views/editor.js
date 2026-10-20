/* Editor de fichário e busca para fichário manual. */
import {visibleSet} from '../catalog.js';
import {isOwned} from '../collection.js';
import {BOOL, FIELDS, FM, GENS, NUM_OPS, OPS, TEXT_OPS} from '../constants.js';
import {saveBinders} from '../db.js';
import {SORTS, evalBinder, optionsFor, sortIds} from '../rules.js';
import {autoResolve, AUTO_MAX} from '../remote.js';
import {PRESETS, coverHTML, dexFromInput} from '../covers.js';
import {S, refreshAll} from '../state.js';
import {imgTag, toast} from '../ui.js';
import {$, debounce, esc, fmtN, nz, uid} from '../util.js';

export function newBinder(){return{id:uid(),name:'',mode:'rule',match:'all',conds:[{f:'types',op:'eq',v:''}],cardIds:[],gens:[],pick:{},created:Date.now()};}
export function openEditor(id){
 const b=id?JSON.parse(JSON.stringify(S.binders.find(x=>x.id===id))):newBinder();
 S.ui.edit={b,isNew:!id};
 renderEditor();
 $('#modal').classList.add('on');
 setTimeout(()=>{const n=$('#bn');if(n)n.focus();},30);
}
export function closeModal(){$('#modal').classList.remove('on');S.ui.edit=null;S.ui.adding=null;S.ui.dexdlg=null;}
const QUICK=[['pokemon','Pokémon'],['set','Expansão'],['types','Tipo'],['illustrator','Ilustrador'],['rarity','Raridade'],['standard','Standard'],['category','Categoria'],['generation','Geração']];
const ORD=['1ª','2ª','3ª','4ª','5ª','6ª','7ª','8ª','9ª'];
export function genChips(sel,attr){
 const set=new Set(sel.map(String));
 return`<div class="genchips" role="group" aria-label="Gerações">${GENS.map(([g,a,b])=>`<button type="button" class="gc" ${attr} data-g="${g}" aria-pressed="${set.has(String(g))}" title="Pokédex ${a} a ${b}">${ORD[g-1]}</button>`).join('')}<button type="button" class="gc all" ${attr} data-g="all" aria-pressed="${set.size===GENS.length}">Todas</button></div>`;
}
export function valueCtl(c,i){
 const F=FM[c.f];
 if(F.t==='gen')return genChips(String(c.v).split(','),`data-ed-act="gen" data-i="${i}"`);
 if(F.t==='poke')return`<input class="field" data-ed="v" data-i="${i}" type="text" list="dlp${i}" value="${esc(c.v)}" placeholder="Ex.: Gengar, Pikachu" aria-label="Pokémon"><datalist id="dlp${i}">${optionsFor('pokemon').map(x=>`<option value="${esc(x)}"></option>`).join('')}</datalist>`;
 if(F.t==='bool'||F.t==='enum'){
  const o=F.t==='bool'?BOOL:F.opts;
  return`<select class="field" data-ed="v" data-i="${i}" aria-label="Valor"><option value="">Escolha…</option>${o.map(([k,l])=>`<option value="${k}" ${c.v===k?'selected':''}>${l}</option>`).join('')}</select>`;
 }
 const dl=F.t==='text'?`list="dl${i}"`:'';
 const opts=F.t==='text'?`<datalist id="dl${i}">${optionsFor(c.f).slice(0,600).map(x=>`<option value="${esc(x)}"></option>`).join('')}</datalist>`:'';
 const type=(F.t==='num'&&c.op!=='in')?'number':'text';
 return`<input class="field" data-ed="v" data-i="${i}" type="${type}" ${dl} value="${esc(c.v)}" placeholder="${F.t==='num'&&c.op==='in'?'ex.: 25, 26':'Valor'}" aria-label="Valor">${opts}`;
}
export function opsFor(F){if(F.t==='gen'||F.t==='poke')return['in'];return F.t==='bool'||F.t==='enum'?['eq','ne'].slice(0,F.t==='bool'?1:2):(F.t==='num'?NUM_OPS:TEXT_OPS);}
function coverCtl(b){
 const cv=b.cover||{kind:'auto'};const k=cv.kind||'auto';
 const seg=[['auto','Automática'],['dex','Arte de um Pokémon'],['img','Minha imagem'],['preset','Imagens do app']];
 let sub='';
 if(k==='dex')sub=`<input class="field" data-edcover="q" type="text" value="${esc(cv.q||'')}" placeholder="Nome em inglês ou número da Pokédex. Ex.: Gengar ou 94" aria-label="Pokémon da capa" style="min-width:260px">${cv.dex?'':`<span class="lbl2">${cv.q?'Não achei esse Pokémon.':'Digite um nome ou número.'}</span>`}`;
 else if(k==='img')sub=`<button class="btn small" type="button" data-act="upload" data-kind="cover" data-id="${esc(b.id)}">${S.custom.covers&&S.custom.covers[b.id]?'Trocar imagem':'Enviar imagem'}</button>`;
 else if(k==='preset')sub=`<span class="covpick">${PRESETS.map(([pk,l,svg])=>`<button type="button" class="covp" data-ed-act="coverp" data-k="${pk}" aria-pressed="${cv.k===pk}" aria-label="${l}">${svg}</button>`).join('')}</span>`;
 return`<div class="row" style="margin-bottom:14px;align-items:center"><span class="cover sm">${coverHTML(b)}</span><span>Capa</span>
  <div class="seg" role="group" aria-label="Capa do fichário">${seg.map(([v,l])=>`<button type="button" data-ed-act="cover" data-v="${v}" aria-pressed="${k===v}">${l}</button>`).join('')}</div>${sub}</div>`;
}
export function renderEditor(){
 const st=S.ui.edit;if(!st)return;const b=st.b;
 const rules=b.mode==='rule'?`
  <div class="row" style="margin-bottom:10px"><span>Incluir cartas que combinam com</span>
   <div class="seg" role="group" aria-label="Combinar regras"><button type="button" data-ed-act="match" data-v="all" aria-pressed="${b.match==='all'}">todas as regras</button><button type="button" data-ed-act="match" data-v="any" aria-pressed="${b.match==='any'}">qualquer regra</button></div></div>
  <p class="lbl2" style="margin:-4px 0 10px">${b.match==='all'?'A carta precisa combinar com cada regra ao mesmo tempo. Ex.: Pokémon Pikachu e Expansão Celebração de 30 Anos.':'Basta a carta combinar com uma das regras. Ex.: Pokémon Pikachu ou Pokémon Raichu.'}</p>
  ${b.conds.map((c,i)=>{const F=FM[c.f];return`<div class="rule">
   <select class="field" data-ed="f" data-i="${i}" aria-label="Campo">${FIELDS.map(x=>`<option value="${x.k}" ${c.f===x.k?'selected':''}>${x.label}</option>`).join('')}</select>
   ${F.t==='gen'||F.t==='poke'?'<span class="opfix">'+(F.t==='gen'?'é uma de':'é um destes')+'</span>':`<select class="field" data-ed="op" data-i="${i}" aria-label="Condição">${opsFor(F).map(o=>`<option value="${o}" ${c.op===o?'selected':''}>${OPS[o]}</option>`).join('')}</select>`}
   ${valueCtl(c,i)}
   <button class="btn small danger" type="button" data-ed-act="rm" data-i="${i}" aria-label="Remover regra">Remover</button></div>${F.hint?`<p class="lbl2" style="margin:-2px 0 8px">${esc(F.hint)}</p>`:''}`;}).join('')}
  <div class="quickadd"><span class="lbl2">Adicionar regra:</span>${QUICK.map(([k,l])=>`<button class="btn small" type="button" data-ed-act="addf" data-f="${k}">+ ${l}</button>`).join('')}<button class="btn small" type="button" data-ed-act="add">+ Outro campo</button></div>
  <p class="preview" id="edprev" style="margin-top:14px"></p>`
  :b.mode==='pokedex'?`<p class="lead">Um espaço para cada Pokémon, na ordem da Pokédex Nacional. Cada espaço mostra a carta que você escolher para representá-lo ou, se não escolher, a melhor que você tiver. Espaços sem carta ficam cinza, com número e nome.</p>
  <label class="lbl2">Gerações incluídas (sem marcar nenhuma, entram todas)</label>${genChips(b.gens||[],'data-ed-act="bgen"')}
  <p class="lbl2" style="margin-top:8px">A lista usa as cartas das suas expansões carregadas; o nome do Pokémon aparece quando alguma carta dele já foi baixada.</p>`
  :`<p class="lead">Neste modo você escolhe as cartas uma a uma depois de salvar, com “Adicionar cartas”.</p>`;
 $('#dialog').innerHTML=`<h2>${st.isNew?'Novo fichário':'Editar fichário'}</h2>
  <label class="lbl2" for="bn">Nome do fichário</label>
  <input class="field" id="bn" style="width:100%;margin-bottom:14px" value="${esc(b.name)}" placeholder="Ex.: Pokémon de Fogo no Standard">
  <div class="row" style="margin-bottom:14px"><span>Como montar</span>
   <div class="seg" role="group" aria-label="Modo do fichário"><button type="button" data-ed-act="mode" data-v="rule" aria-pressed="${b.mode==='rule'}">Por regras</button><button type="button" data-ed-act="mode" data-v="manual" aria-pressed="${b.mode==='manual'}">Escolher cartas</button><button type="button" data-ed-act="mode" data-v="pokedex" aria-pressed="${b.mode==='pokedex'}">Pokédex</button></div></div>
  ${coverCtl(b)}
  ${rules}
  ${b.mode!=='pokedex'?`<div class="row" style="margin-top:14px"><span>Ordenar por</span><select class="field" data-edsort="f" aria-label="Ordenar por">${SORTS.map(([k,l])=>`<option value="${k}" ${(b.sort&&b.sort.f||'default')===k?'selected':''}>${l}</option>`).join('')}</select><select class="field" data-edsort="dir" aria-label="Direção"><option value="asc" ${(b.sort&&b.sort.dir)!=='desc'?'selected':''}>Crescente</option><option value="desc" ${(b.sort&&b.sort.dir)==='desc'?'selected':''}>Decrescente</option></select></div>`:''}
  <div class="actions"><button class="btn" type="button" data-ed-act="cancel">Cancelar</button><button class="btn primary" type="button" data-ed-act="save">Salvar fichário</button></div>`;
 updatePreview();
}
export function updatePreview(){
 const el=$('#edprev');if(!el||!S.ui.edit)return;
 const r=evalBinder(S.ui.edit.b);
 if(r.empty){el.textContent='Preencha ao menos um valor para ver quantas cartas combinam.';return;}
 if(S.ui.edit.b.mode==='rule')autoResolve(r);
 el.textContent=`${fmtN(r.ids.length)} cartas combinam, você tem ${fmtN(r.ids.filter(isOwned).length)}.${r.loading?' Consultando a TCGdex…':''}${!r.loading&&r.pending&&r.pending<=AUTO_MAX?' Conferindo mais algumas cartas…':''}${r.pending>AUTO_MAX?` Faltam detalhes de ${fmtN(r.pending)} cartas; o fichário oferece baixá-los depois de salvo.`:''}`;
}
export const updatePreviewSoon=debounce(updatePreview,250);
export function saveEditor(){
 const st=S.ui.edit;if(!st)return;
 const b=st.b;b.name=($('#bn').value||'').trim();
 if(!b.name){$('#bn').focus();toast('Dê um nome ao fichário.');return;}
 if(b.mode==='rule')b.conds=b.conds.filter(c=>String(c.v).trim()!=='');
 if(b.mode==='rule'&&!b.conds.length){toast('Defina ao menos uma regra com valor.');b.conds=[{f:'types',op:'eq',v:''}];renderEditor();return;}
 const i=S.binders.findIndex(x=>x.id===b.id);
 if(i>=0)S.binders[i]=b;else S.binders.push(b);
 saveBinders();closeModal();
 if(st.isNew)location.hash='#/binder/'+b.id;else refreshAll();
}
export function openAddCards(id){
 S.ui.adding={id,q:''};
 $('#dialog').innerHTML=`<h2>Adicionar cartas</h2><label class="lbl2" for="ac">Buscar pelo nome da carta</label>
  <input class="field" id="ac" type="search" style="width:100%" placeholder="Ex.: Pikachu">
  <div id="acres" style="margin-top:14px"></div>
  <div class="actions"><span></span><button class="btn primary" type="button" data-ed-act="cancel">Concluir</button></div>`;
 $('#modal').classList.add('on');setTimeout(()=>$('#ac').focus(),30);
 renderAddResults();
}
export function renderAddResults(){
 const st=S.ui.adding;const el=$('#acres');if(!st||!el)return;
 const b=S.binders.find(x=>x.id===st.id);if(!b)return;
 const q=nz(st.q);
 if(q.length<2){el.innerHTML='<p class="lead">Digite ao menos 2 letras.</p>';return;}
 const res=[];
 for(const id in S.briefs){const c=S.briefs[id];if(!visibleSet(c.setId))continue;if(nz(c.name).includes(q)){res.push(id);if(res.length>=600)break;}}
 sortIds(res);
 const list=res.slice(0,36);
 el.innerHTML=res.length?`<p class="lbl2">${fmtN(res.length)} resultados${res.length>list.length?', mostrando os primeiros '+list.length:''}.</p><div class="cards" style="--tile:110px">${list.map(id=>{
  const c=S.briefs[id];const inb=b.cardIds.includes(id);
  const set=S.setMap[c.setId];
  return`<div class="slot ${inb?'on':'off'}" data-ed-act="toggle-card" data-id="${esc(id)}" role="button" tabindex="0" aria-label="${esc(c.name)}, ${esc(set?set.name:'')}, ${inb?'no fichário':'adicionar'}">
   <div class="pocket">${imgTag(c.image,'low',c.name)}${inb?`<span class="qty">No fichário</span>`:''}</div>
   <div class="num"><b>${esc(c.name)}</b><span>${esc(c.localId)}</span></div><div class="num"><span>${esc(set?set.name:'')}</span></div></div>`;}).join('')}</div>`:'<p class="lead">Nenhuma carta com esse nome.</p>';
}


export function editorAct(t){
 const st=S.ui.edit;const a=t.dataset.edAct;
 if(a==='cancel'){closeModal();refreshAll();return;}
 if(a==='toggle-card'){
  const ad=S.ui.adding;const b=ad&&S.binders.find(x=>x.id===ad.id);if(!b)return;
  const id=t.dataset.id;
  b.cardIds=b.cardIds.includes(id)?b.cardIds.filter(x=>x!==id):[...b.cardIds,id];
  saveBinders();renderAddResults();return;
 }
 if(!st)return;const b=st.b;
 if(a==='save')return saveEditor();
 b.name=($('#bn')||{}).value||b.name;
 if(a==='mode'){b.mode=t.dataset.v;}
 else if(a==='match'){b.match=t.dataset.v;}
 else if(a==='gen'||a==='bgen'){
  const g=t.dataset.g;const cur=a==='gen'?String(b.conds[+t.dataset.i].v).split(',').filter(Boolean):(b.gens||[]).map(String);
  let next;
  if(g==='all')next=cur.length===GENS.length?[]:GENS.map(x=>String(x[0]));
  else next=cur.includes(g)?cur.filter(x=>x!==g):[...cur,g];
  next.sort((x,y)=>x-y);
  if(a==='gen')b.conds[+t.dataset.i].v=next.join(',');else b.gens=next.map(Number);
 }
 else if(a==='cover'){const v=t.dataset.v;b.cover=v==='auto'?{kind:'auto'}:{...(b.cover||{}),kind:v};if(v==='preset'&&!b.cover.k)b.cover.k='ball';}
 else if(a==='coverp'){b.cover={kind:'preset',k:t.dataset.k};}
 else if(a==='add'){b.conds.push({f:'name',op:'contains',v:''});}
 else if(a==='addf'){const f=t.dataset.f;const only=b.conds.length===1&&b.conds[0].f==='types'&&String(b.conds[0].v).trim()==='';const nc={f,op:FM[f].def,v:''};if(only)b.conds[0]=nc;else b.conds.push(nc);}
 else if(a==='rm'){b.conds.splice(+t.dataset.i,1);if(!b.conds.length)b.conds.push({f:'types',op:'eq',v:''});}
 renderEditor();
}
