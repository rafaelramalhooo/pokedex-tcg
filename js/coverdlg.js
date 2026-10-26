/* Janela "Capa…" (Coleções e Fichários): escolher a imagem e enquadrar arrastando e dando zoom. */
import {PRESETS, DEF_FIT, clampFit, coverMedia, coverOf, dexFromInput, fitOf, fitStyle} from './covers.js';
import {saveBinders, saveKV, saveSettings} from './db.js';
import {logoImg} from './logos.js';
import {shrinkImage} from './custom.js';
import {S, refreshAll, viewCache} from './state.js';
import {imgTag, toast} from './ui.js';
import {$, esc} from './util.js';
import {setCoverCfg} from './views/set.js';

let D=null;
const clone=v=>JSON.parse(JSON.stringify(v));
const SET_KINDS=[['logo','Logo da coleção'],['card','Arte de uma carta'],['img','Minha imagem']];
const BINDER_KINDS=[['auto','Automática'],['card','Arte de uma carta'],['dex','Arte de um Pokémon'],['img','Minha imagem'],['preset','Imagens do app']];
const FRAMED=['card','img','dex'];
const keyOf=t=>t.type==='set'?'set:'+t.id:t.id;

function target(){
 if(!S.cur)return null;
 if(S.cur.name==='set'&&S.cur.id)return{type:'set',id:S.cur.id};
 if(S.cur.name==='binder'&&S.cur.id){const b=S.binders.find(x=>x.id===S.cur.id);return b?{type:'binder',id:b.id}:null;}
 return null;
}
const nameOf=t=>t.type==='set'?((S.setd[t.id]||{}).name||(S.setMap[t.id]||{}).name||t.id):(S.binders.find(b=>b.id===t.id)||{}).name||'';
function candidates(t){
 if(t.type==='set')return((S.setd[t.id]||{}).cards||[]).filter(c=>c.image).map(c=>({id:c.id,name:c.name,image:c.image}));
 const nav=(S.cur&&S.cur.nav)||[];const seen=new Set();const out=[];
 nav.forEach(x=>{if(seen.has(x.id))return;seen.add(x.id);const c=S.cards[x.id]||S.briefs[x.id];if(c&&c.image)out.push({id:x.id,name:c.name||x.id,image:c.image});});
 return out;
}
function opts(){
 const t=D.t;const o={key:keyOf(t),draft:D.draft,name:nameOf(t)};
 if(t.type==='set'){const d=S.setd[t.id]||{},set=S.setMap[t.id]||{id:t.id,name:t.id};o.logo=logoImg({...d,...set,id:t.id,name:d.name||set.name,logo:d.logo||set.logo});}
 return o;
}
/* para "Automática", a prévia mostra o que a capa automática daria */
function effective(){
 if(D.cfg.kind!=='auto')return D.cfg;
 const b=S.binders.find(x=>x.id===D.t.id)||{};
 return coverOf({...b,cover:{kind:'auto'}});
}

function previewInner(){
 const m=coverMedia(effective(),opts());
 return{cls:m.cls,html:`<div class="covabs"><div class="covbody">${m.html}</div>${m.title?`<h2>${esc(m.title)}</h2>`:''}</div>`};
}
function paintPreview(){
 const el=$('#cvprev');if(!el)return;
 const p=previewInner();el.className='coverpage cvprev '+p.cls+(FRAMED.includes(D.cfg.kind)?' drag':'');
 el.innerHTML=p.html;
}
function sub(){
 const k=D.cfg.kind,t=D.t;
 if(k==='card'){
  const cs=candidates(t);
  return`<p class="lbl2">Toque numa carta e depois arraste e dê zoom para enquadrar a ilustração.</p><div class="covgrid">${cs.map(c=>`<button type="button" class="covc ${D.cfg.card===c.id?'sel':''}" data-act="cv-card" data-id="${esc(c.id)}" aria-label="${esc(c.name)}" aria-pressed="${D.cfg.card===c.id}">${imgTag(c.image,'low',c.name,undefined,c.id)}</button>`).join('')||'<p class="lead">Nenhuma carta com imagem por aqui ainda.</p>'}</div>`;
 }
 if(k==='dex')return`<label class="lbl2" for="cvq">Pokémon (nome em inglês ou número da Pokédex)</label><input class="field" id="cvq" data-cv="q" type="text" value="${esc(D.cfg.q||'')}" placeholder="Ex.: Gengar ou 94">`;
 if(k==='img'){
  const has=D.draft||(S.custom.covers&&S.custom.covers[keyOf(t)]);
  return`<p class="lbl2">Escolha uma imagem do seu aparelho (JPG, PNG ou WEBP). O ideal é uma imagem <b>vertical, proporção 3:4</b>, por exemplo 900 × 1200 px. Depois é só arrastar e dar zoom para enquadrar.</p>
   <div class="row"><button type="button" class="btn small primary" data-act="cv-upload">${has?'Trocar imagem':'Escolher imagem'}</button></div>`;
 }
 if(k==='preset')return`<span class="covpick">${PRESETS.map(([pk,l,svg])=>`<button type="button" class="covp" data-act="cv-preset" data-k="${pk}" aria-pressed="${D.cfg.k===pk}" aria-label="${l}">${svg}</button>`).join('')}</span>`;
 if(k==='logo')return`<p class="lbl2">A capa mostra o logo da coleção, grande, no centro.</p>`;
 return`<p class="lbl2">A capa é escolhida automaticamente (arte do Pokémon da regra, esfera ou cartas).</p>`;
}
function render(){
 const t=D.t;const kinds=t.type==='set'?SET_KINDS:BINDER_KINDS;const k=D.cfg.kind;
 const framed=FRAMED.includes(k);const f=fitOf(D.cfg);const p=previewInner();
 $('#dialog').innerHTML=`<h2>Capa do ${t.type==='set'?'fichário da coleção':'fichário'}</h2>
  <div class="cvwrap"><div class="cvleft"><div class="coverpage cvprev ${p.cls}${framed?' drag':''}" id="cvprev" role="img" aria-label="Prévia da capa">${p.html}</div>
   <p class="lbl2" style="text-align:center;margin:8px 0 0">${framed?'Arraste para enquadrar.':'Prévia da capa.'}</p></div>
  <div class="cvright"><div class="seg" role="group" aria-label="Tipo de capa">${kinds.map(([v,l])=>`<button type="button" data-act="cv-kind" data-v="${v}" aria-pressed="${k===v}">${l}</button>`).join('')}</div>
   <div class="cvsub">${sub()}</div>
   ${framed?`<div class="cvzoom"><label class="size">Zoom <input type="range" id="cvz" min="1" max="4" step="0.01" value="${f.z}" aria-label="Zoom da imagem"></label><button type="button" class="btn small" data-act="cv-center">Centralizar</button></div>`:''}</div></div>
  <div class="actions"><span></span><span><button class="btn" type="button" data-ed-act="cancel">Cancelar</button> <button class="btn primary" type="button" data-act="cv-save">Salvar capa</button></span></div>`;
 $('#modal').classList.add('on');
}
function setFit(f){D.cfg.fit=clampFit(f);const b=$('#cvprev .fitbox');if(b)b.setAttribute('style',fitStyle(D.cfg.fit));const z=$('#cvz');if(z)z.value=D.cfg.fit.z;}
function open(){
 const t=target();if(!t)return;
 let cfg=t.type==='set'?clone(setCoverCfg(t.id)):clone((S.binders.find(b=>b.id===t.id)||{}).cover||{kind:'auto'});
 if(!cfg.kind)cfg={kind:'auto'};
 D={t,cfg,draft:null};
 render();
}
function save(){
 if(!D)return;const t=D.t;const cfg=clone(D.cfg);
 if(cfg.kind==='card'&&!cfg.card){toast('Escolha uma carta para a capa.');return;}
 if(cfg.kind==='dex'){cfg.dex=dexFromInput(cfg.q);if(!cfg.dex){toast('Não achei esse Pokémon. Use o nome em inglês ou o número da Pokédex.');return;}}
 if(cfg.kind==='img'&&!D.draft&&!(S.custom.covers&&S.custom.covers[keyOf(t)])){toast('Escolha uma imagem primeiro.');return;}
 if(FRAMED.includes(cfg.kind)&&cfg.fit)cfg.fit=clampFit(cfg.fit);
 if(cfg.kind==='img'&&D.draft){S.custom.covers=S.custom.covers||{};S.custom.covers[keyOf(t)]=D.draft;saveKV('custom',S.custom);}
 if(t.type==='set'){
  S.settings.setCover=S.settings.setCover||{};
  if(cfg.kind==='logo')delete S.settings.setCover[t.id];else S.settings.setCover[t.id]=cfg;
  saveSettings();
 }else{
  const b=S.binders.find(x=>x.id===t.id);if(!b)return;
  b.cover=cfg;saveBinders();
 }
 D=null;$('#modal').classList.remove('on');
 viewCache.clear();refreshAll();if(S.cur&&S.cur.refresh)S.cur.refresh();
 toast('Capa salva.');
}
export function coverAct(a,el){
 if(a==='open')return open();
 if(!D)return;
 if(a==='kind'){const k=el.dataset.v;if(k===D.cfg.kind)return;D.cfg={kind:k,...(k==='preset'?{k:D.cfg.k||'ball'}:{}),...(k==='card'?{card:D.cfg.card}:{}),...(k==='dex'?{q:D.cfg.q,dex:D.cfg.dex}:{})};if(k==='card'&&!D.cfg.card){const c=candidates(D.t)[0];if(c)D.cfg.card=c.id;}render();return;}
 if(a==='card'){D.cfg.card=el.dataset.id;delete D.cfg.fit;render();return;}
 if(a==='preset'){D.cfg.k=el.dataset.k;render();return;}
 if(a==='center'){const f=fitOf(D.cfg);setFit({x:.5,y:DEF_FIT[D.cfg.kind]?(D.cfg.kind==='card'?DEF_FIT.card.y:.5):.5,z:f.z});return;}
 if(a==='upload'){
  const inp=document.createElement('input');inp.type='file';inp.accept='image/*';inp.style.display='none';
  inp.addEventListener('change',async()=>{
   const f=inp.files&&inp.files[0];inp.remove();if(!f||!D)return;
   try{D.draft=await shrinkImage(f,1400,1400);D.cfg={kind:'img'};render();}
   catch(e){toast('Não consegui ler essa imagem. Tente um arquivo JPG, PNG ou WEBP.');}
  });
  document.body.appendChild(inp);inp.click();return;
 }
 if(a==='save')return save();
}
export function coverChange(el){
 if(!D)return;
 if(el.dataset.cv==='q'){D.cfg.q=el.value;D.cfg.dex=dexFromInput(el.value);delete D.cfg.fit;paintPreview();}
}
/* arrastar, pinça e roda do mouse na prévia; zoom pelo controle */
const pts=new Map();let g=null;
document.addEventListener('pointerdown',e=>{
 const pv=e.target.closest&&e.target.closest('#cvprev.drag');if(!pv||!D)return;
 pv.setPointerCapture&&pv.setPointerCapture(e.pointerId);
 pts.set(e.pointerId,{x:e.clientX,y:e.clientY});
 g={f:fitOf(D.cfg),pv,d0:null};
});
document.addEventListener('pointermove',e=>{
 if(!D||!g||!pts.has(e.pointerId))return;
 const prev=pts.get(e.pointerId);const cur={x:e.clientX,y:e.clientY};pts.set(e.pointerId,cur);
 const f=fitOf(D.cfg);const W=g.pv.clientWidth||1,H=g.pv.clientHeight||1;
 if(pts.size>=2){
  const [a,b]=[...pts.values()];const d=Math.hypot(a.x-b.x,a.y-b.y);
  if(g.d0===null){g.d0=d;g.z0=f.z;return;}
  setFit({...f,z:g.z0*d/g.d0});return;
 }
 setFit({...f,x:f.x-(cur.x-prev.x)/(W*f.z),y:f.y-(cur.y-prev.y)/(H*f.z)});
});
const endp=e=>{pts.delete(e.pointerId);if(!pts.size)g=null;else if(g)g.d0=null;};
document.addEventListener('pointerup',endp);document.addEventListener('pointercancel',endp);
document.addEventListener('input',e=>{if(D&&e.target.id==='cvz'){const f=fitOf(D.cfg);setFit({...f,z:+e.target.value});}});
document.addEventListener('wheel',e=>{
 const pv=e.target.closest&&e.target.closest('#cvprev.drag');if(!pv||!D)return;
 e.preventDefault();const f=fitOf(D.cfg);setFit({...f,z:f.z*(e.deltaY<0?1.06:1/1.06)});
},{passive:false});
