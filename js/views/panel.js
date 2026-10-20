/* Painel de detalhes da carta. */
import {ensureCard} from '../catalog.js';
import {COND, FIN, FIN_LABEL, LANGS} from '../constants.js';
import {H, S} from '../state.js';
import {imgTag, noteHTML} from '../ui.js';
import {$, esc} from '../util.js';

export function openPanel(id,ctx){
 S.ui.panelId=id;S.ui.panelCtx=ctx||null;
 renderPanel();
 if(!S.cards[id])ensureCard(id).then(()=>{if(S.ui.panelId===id)renderPanel();if(S.cur&&S.cur.refresh)S.cur.refresh();}).catch(()=>{if(S.ui.panelId===id)renderPanel(true);});
}
export function closePanel(){S.ui.panelId=null;renderPanel();}
export function renderPanel(failed){
 const p=$('#panel'),sc=$('#scrim');
 const id=S.ui.panelId;
 if(!id){p.classList.remove('open');sc.classList.remove('on');return;}
 const act=document.activeElement;
 const keep=p.contains(act)&&act.dataset?{a:act.dataset.act,f:act.dataset.fin}:null;
 const b=S.briefs[id]||{};const c=S.cards[id];
 const name=(c&&c.name)||b.name||id;
 const setId=b.setId||(c&&c.set)||'';
 const set=S.setMap[setId]||{name:setId};
 const d=S.setd[setId];
 const official=(d&&d.cardCount&&d.cardCount.official)||'';
 const image=(c&&c.image)||b.image;
 const e=S.collection[id];
 let fins=null;
 if(c){
  fins=c.variants?FIN.filter(f=>c.variants[f]):[];
  if(!fins.length)fins=['normal'];
  if(e)Object.keys(e.f).forEach(f=>{if(!fins.includes(f))fins.push(f);});
 }
 const facts=[];
 if(c){
  if(c.rarity)facts.push(c.rarity);
  if(c.regulationMark)facts.push('Marca '+c.regulationMark);
  if(c.hp)facts.push(c.hp+' PS');
  (c.types||[]).forEach(t=>facts.push(t));
  if(c.category)facts.push(c.category);
  if(c.stage)facts.push(c.stage);
 }
 const rows=fins?fins.map(f=>{
  const cur=e&&e.f[f];const q=cur?cur.q:0;
  return `<div class="fin ${q?'has':''}"><div class="fin-head"><h3>${FIN_LABEL[f]}</h3>
   <div class="step"><button type="button" data-act="dec" data-id="${esc(id)}" data-fin="${f}" aria-label="Tirar um exemplar ${FIN_LABEL[f]}">−</button><output aria-live="polite">${q}</output><button type="button" data-act="inc" data-id="${esc(id)}" data-fin="${f}" aria-label="Adicionar um exemplar ${FIN_LABEL[f]}">+</button></div></div>
   ${q?`<div class="fin-opts"><label><span class="lbl2">Condição</span><select class="field" data-ch="c" data-id="${esc(id)}" data-fin="${f}">${COND.map(([k,l])=>`<option value="${k}" ${cur.c===k?'selected':''}>${l}</option>`).join('')}</select></label>
   <label><span class="lbl2">Idioma</span><select class="field" data-ch="l" data-id="${esc(id)}" data-fin="${f}">${LANGS.map(([k,l])=>`<option value="${k}" ${cur.l===k?'selected':''}>${l}</option>`).join('')}</select></label></div>`:''}</div>`;
 }).join(''):(failed?noteHTML('err','Não consegui carregar os detalhes desta carta. Verifique a conexão e abra de novo.'):'<div class="skel" style="height:90px;margin-top:10px"></div>');
 const ctx=S.ui.panelCtx;
 const manual=ctx&&ctx.binderId&&(S.binders.find(x=>x.id===ctx.binderId)||{}).mode==='manual';
 p.innerHTML=`<div class="inner"><button class="btn small close" type="button" data-act="close">Fechar</button>
  <div class="big">${imgTag(image,'high',name)}</div>
  <h2>${esc(name)}</h2>
  <p class="lead" style="margin-top:2px">${esc(set.name)}, carta ${esc(b.localId||'')}${official?' de '+official:''}</p>
  ${c&&c.illustrator?`<p class="lead" style="margin-top:2px">Ilustração: ${esc(c.illustrator)}</p>`:''}
  <div class="facts">${facts.map(x=>`<span class="badge">${esc(x)}</span>`).join('')}</div>
  ${rows}
  <div style="margin-top:14px"><label class="lbl2" for="note">Observações</label><textarea class="field" id="note" rows="3" data-id="${esc(id)}" placeholder="Ex.: comprada em feira, assinatura, ponto de dobra">${esc(e?e.n:'')}</textarea></div>
  ${manual?`<div style="margin-top:14px"><button class="btn danger" type="button" data-act="unbind" data-id="${esc(id)}">Tirar do fichário</button></div>`:''}</div>`;
 p.classList.add('open');sc.classList.add('on');
 if(keep){const t=$(`#panel [data-act="${keep.a}"]${keep.f?`[data-fin="${keep.f}"]`:''}`);if(t)t.focus();}
}


H.renderPanel=renderPanel;
