/* Painel de detalhes da carta. */
import {ensureCard} from '../catalog.js';
import {COND, FIN, FIN_LABEL, LANGS, finsOfCard, rarityPt, typePt} from '../constants.js';
import {numLabel} from '../cardlabel.js';
import {H, S} from '../state.js';
import {imgTag, noteHTML} from '../ui.js';
import {dexModel} from '../rules.js';
import {customCard} from '../custom.js';
import {derivedImage} from '../reprints.js';
import {$, esc} from '../util.js';

export function openPanel(id,ctx){
 S.ui.panelId=id;S.ui.panelCtx=ctx||null;
 renderPanel();
 if(!S.cards[id]||S.cards[id].rvp===undefined)ensureCard(id,true).then(()=>{if(S.ui.panelId===id)renderPanel();if(S.cur&&S.cur.refresh)S.cur.refresh();}).catch(()=>{if(S.ui.panelId===id)renderPanel(true);});
}
export function closePanel(){S.ui.panelId=null;renderPanel();}
/* Carta anterior/seguinte dentro da lista que está na tela, sem fechar o popup. */
export function panelNav(d){
 const nav=(S.cur&&S.cur.nav)||[];if(!nav.length||!S.ui.panelId)return;
 const i=nav.findIndex(x=>x.id===S.ui.panelId);
 const j=i<0?0:i+d;if(j<0||j>=nav.length)return;
 const it=nav[j];const ctx=S.ui.panelCtx?{...S.ui.panelCtx,dex:it.dex||null}:null;
 openPanel(it.id,ctx);
}
export function renderPanel(failed){
 const p=$('#panel'),sc=$('#scrim');
 const id=S.ui.panelId;
 if(!id){p.classList.remove('open');sc.classList.remove('on');delete p.dataset.id;return;}
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
  fins=finsOfCard(c);
  if(!fins.length)fins=['normal'];
  if(e)Object.keys(e.f).forEach(f=>{if(!fins.includes(f))fins.push(f);});
 }
 const facts=[];
 if(c){
  if(c.rarity)facts.push(rarityPt(c.rarity));
  if(c.regulationMark)facts.push('Marca '+c.regulationMark);
  if(c.hp)facts.push(c.hp+' PS');
  (c.types||[]).forEach(t=>facts.push(typePt(t)));
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
 const nav=(S.cur&&S.cur.nav)||[];const ni=nav.findIndex(x=>x.id===id);
 const phead=`<div class="phead"><div class="pn"><button class="btn small" type="button" data-act="panel-nav" data-d="-1" ${ni<=0?'disabled':''} aria-label="Carta anterior">‹</button><span aria-live="polite">${ni>=0?`${ni+1} de ${nav.length}`:''}</span><button class="btn small" type="button" data-act="panel-nav" data-d="1" ${ni<0||ni>=nav.length-1?'disabled':''} aria-label="Próxima carta">›</button></div><button class="btn small close" type="button" data-act="close">Fechar</button></div>`;
 const info=`<h2>${esc(name)}</h2>
  <p class="lead" style="margin-top:2px">${esc(set.name)} · carta ${esc(numLabel({...b,id,setId:b.setId||(c&&c.set)||''}))}</p>
  ${c&&c.illustrator?`<p class="lead" style="margin-top:2px">Ilustração: ${esc(c.illustrator)}</p>`:''}
  <div class="facts">${facts.map(x=>`<span class="badge">${esc(x)}</span>`).join('')}</div>
  ${rows}
  <div style="margin-top:14px"><label class="lbl2" for="note">Observações</label><textarea class="field" id="note" rows="3" data-id="${esc(id)}" placeholder="Ex.: comprada em feira, assinatura, ponto de dobra">${esc(e?e.n:'')}</textarea></div>
  ${dexPick(ctx,id)}
  ${photoCtl(id,!!image)}
  ${manual?`<div style="margin-top:14px"><button class="btn danger" type="button" data-act="unbind" data-id="${esc(id)}">Tirar do fichário</button></div>`:''}`;
 if(p.dataset.id===id&&$('.pinfo',p)){
  $('.phead',p).outerHTML=phead;$('.pinfo',p).innerHTML=info;
 }else{
  p.dataset.id=id;
  p.innerHTML=`<div class="inner">${phead}<div class="pgrid"><div class="pcol"><div class="tilt" aria-label="Carta em destaque. Passe o mouse ou arraste para inclinar."><div class="tcard">${imgTag(image,'high',name,undefined,id)}<span class="glare"></span></div></div><p class="phint">Passe o mouse ou arraste a carta.</p></div><div class="pinfo">${info}</div></div></div>`;
  p.scrollTop=0;
 }
 p.classList.add('open');sc.classList.add('on');
 if(keep){const t=$(`#panel [data-act="${keep.a}"]${keep.f?`[data-fin="${keep.f}"]`:''}`);if(t)t.focus();}
}


H.renderPanel=renderPanel;

/* No fichário Pokédex: o espaço só tem a carta que você colocou nele. */
function dexPick(ctx,id){
 if(!ctx||!ctx.dex||!ctx.binderId)return'';
 const b=S.binders.find(x=>x.id===ctx.binderId);
 if(!b||b.mode!=='pokedex')return'';
 const slot=dexModel(b).find(x=>x.dex===ctx.dex);
 if(!slot||!slot.have.length)return'';
 const picked=!!slot.rep;
 return`<div class="fin" style="margin-top:14px"><div class="fin-head"><h3>Carta deste espaço</h3><button type="button" class="btn small" data-act="dex-pick" data-binder="${esc(b.id)}" data-dex="${ctx.dex}" ${picked?'':'disabled'}>Tirar do espaço</button></div>
  <p class="lbl2" style="margin:0 0 8px">${picked?'Tirar do espaço não apaga a carta da sua coleção. ':'Este espaço está vazio. '}Toque numa das cartas que você tem para colocá-la aqui.</p>
  <div class="dexcand">${slot.have.slice(0,36).map(cid=>{const c=S.cards[cid]||S.briefs[cid]||{};const sel=cid===slot.rep;return`<button type="button" class="cand ${sel?'sel':''}" data-act="dex-pick" data-binder="${esc(b.id)}" data-dex="${ctx.dex}" data-id="${esc(cid)}" aria-pressed="${sel}" aria-label="${esc(c.name||cid)}">${imgTag(c.image,'low',c.name,undefined,cid)}</button>`;}).join('')}</div></div>`;
}

/* Foto própria da carta: aparece sempre, mas com destaque quando a TCGdex não tem imagem. */
function photoCtl(id,hasImg){
 const own=customCard(id);
 const dv=!hasImg&&derivedImage(id);
 return`<div class="fin" style="margin-top:14px"><div class="fin-head"><h3>Foto da carta</h3></div>
  <p class="lbl2" style="margin:0 0 8px">${own?'Você enviou uma foto para esta carta. Ela fica guardada só neste navegador.':dv&&dv.kind==='reprint'?'Esta carta é uma reimpressão. A imagem mostrada é a da carta original. Se a sua tiver outra moldura, envie uma foto sua.':hasImg?'A imagem vem da TCGdex. Se preferir, envie uma foto sua para ocupar o lugar dela.':'A TCGdex não tem imagem desta carta. Envie uma foto da sua carta para ela aparecer no app.'}</p>
  <div class="row"><button type="button" class="btn small ${!hasImg&&!own?'primary':''}" data-act="upload" data-kind="card" data-id="${esc(id)}">${own?'Trocar foto':'Enviar foto da carta'}</button>${own?`<button type="button" class="btn small" data-act="upload-rm" data-kind="card" data-id="${esc(id)}">Remover minha foto</button>`:''}</div></div>`;
}
