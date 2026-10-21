/* Exportar imagem: monta uma folha com as cartas (até 10 colunas) para compartilhar em trocas e vendas. */
import {FIN_LABEL} from './constants.js';
import {toast} from './ui.js';
import {$, esc} from './util.js';

const TOUCH=()=>typeof matchMedia==='function'&&matchMedia('(pointer:coarse)').matches;
const limits=()=>TOUCH()?{area:16e6,dim:8192}:{area:64e6,dim:16000};
const NATIVE_W=600;           /* largura das imagens "high" da TCGdex */
const WIDTHS=[600,540,480,420,360];

export const autoCols=n=>Math.max(2,Math.min(10,Math.round(Math.sqrt(n*0.9))));

/* Medidas da folha para n cartas em cols colunas com cartas de largura cw. */
export function sheetSize(n,cols,cw,labels){
 const g=cw*0.045,pad=cw*0.07,ch=cw*1.375,lab=labels?cw*0.3:0,head=cw*0.62,foot=cw*0.26;
 const rows=Math.ceil(n/cols);
 return{g,pad,ch,lab,head,foot,rows,W:Math.round(pad*2+cols*cw+(cols-1)*g),H:Math.round(head+rows*(ch+lab+g)+foot+pad*0.5)};
}
/* Escolhe a maior largura de carta em que tudo cabe numa imagem; se não couber, divide em partes. */
export function planSheets(n,cols,labels){
 const L=limits();
 const fits=(m,cw)=>{const s=sheetSize(m,cols,cw,labels);return s.W*s.H<=L.area&&s.W<=L.dim&&s.H<=L.dim;};
 for(const cw of WIDTHS)if(fits(n,cw))return{cw,parts:[n]};
 const cw=WIDTHS[WIDTHS.length-1];
 let rows=1;while(fits((rows+1)*cols,cw))rows++;
 const per=Math.max(cols,rows*cols);const parts=[];
 for(let left=n;left>0;left-=per)parts.push(Math.min(per,left));
 return{cw,parts};
}

async function toBitmap(blob){
 try{return await createImageBitmap(blob);}
 catch(e){
  const u=URL.createObjectURL(blob);
  try{const im=new Image();im.src=u;await im.decode();return im;}finally{setTimeout(()=>URL.revokeObjectURL(u),2000);}
 }
}
async function loadBitmap(url){
 const get=async u=>{const r=await fetch(u,{mode:'cors'});if(!r.ok)throw new Error('http '+r.status);return toBitmap(await r.blob());};
 try{return{bmp:await get(url),fallback:false};}
 catch(e){
  if(/assets\.tcgdex\.net\/(?!en\/)[a-z-]+\//.test(url)){
   try{return{bmp:await get(url.replace(/(assets\.tcgdex\.net\/)[a-z-]+\//,'$1en/')),fallback:true};}catch(e2){}
  }
  return null;
 }
}
async function loadAll(items,onProgress){
 const out=new Array(items.length);let next=0,done=0,fb=0,miss=0;
 const worker=async()=>{
  while(next<items.length){
   const i=next++;const it=items[i];
   const r=it.url?await loadBitmap(it.url):null;
   if(r){out[i]=r.bmp;if(r.fallback)fb++;}else miss++;
   onProgress&&onProgress(++done,items.length);
  }
 };
 await Promise.all(Array.from({length:6},worker));
 return{bmps:out,fb,miss};
}
function rr(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
function fit(ctx,text,maxW){
 if(ctx.measureText(text).width<=maxW)return text;
 let t=text;while(t.length>1&&ctx.measureText(t+'…').width>maxW)t=t.slice(0,-1);
 return t+'…';
}
const finTxt=f=>f&&f!=='normal'?(f==='reverse'?'Reverse':f==='holo'?'Holo':(FIN_LABEL[f]||f)):'';

function drawSheet(items,bmps,o,cw,title,partNo,partTotal,totalCards,totalQty){
 const s=sheetSize(items.length,o.cols,cw,o.labels);
 const cv=document.createElement('canvas');cv.width=s.W;cv.height=s.H;
 const ctx=cv.getContext('2d');
 ctx.fillStyle='#F2F4F9';ctx.fillRect(0,0,s.W,s.H);
 const FONT='"Hanken Grotesk","Segoe UI",Roboto,Helvetica,Arial,sans-serif';
 ctx.textBaseline='alphabetic';
 /* cabeçalho */
 ctx.fillStyle='#121A2B';ctx.font=`800 ${cw*0.17}px ${FONT}`;ctx.textAlign='left';
 ctx.fillText(fit(ctx,title+(partTotal>1?` (parte ${partNo}/${partTotal})`:''),s.W-s.pad*2-cw*1.6),s.pad,s.pad+cw*0.2);
 ctx.fillStyle='#59647D';ctx.font=`600 ${cw*0.085}px ${FONT}`;
 ctx.fillText(`${totalCards} carta${totalCards===1?'':'s'}${totalQty!=null?' · '+totalQty+' unidade'+(totalQty===1?'':'s'):''}`,s.pad,s.pad+cw*0.38);
 ctx.textAlign='right';ctx.fillText(new Date().toLocaleDateString('pt-BR'),s.W-s.pad,s.pad+cw*0.2);
 ctx.textAlign='left';
 /* cartas */
 items.forEach((it,i)=>{
  const col=i%o.cols,row=Math.floor(i/o.cols);
  const x=s.pad+col*(cw+s.g),y=s.head+row*(s.ch+s.lab+s.g);
  const b=bmps[i];
  ctx.save();rr(ctx,x,y,cw,s.ch,cw*0.045);ctx.clip();
  if(b)ctx.drawImage(b,x,y,cw,s.ch);
  else{ctx.fillStyle='#CBD2E0';ctx.fillRect(x,y,cw,s.ch);ctx.fillStyle='#121A2B';ctx.font=`700 ${cw*0.085}px ${FONT}`;ctx.textAlign='center';ctx.fillText(fit(ctx,it.n,cw*0.86),x+cw/2,y+s.ch/2);ctx.textAlign='left';}
  ctx.restore();
  /* selo de quantidade: centralizado embaixo, sobre a carta */
  if(it.q>0){
   const txt='×'+it.q;ctx.font=`800 ${cw*0.115}px ${FONT}`;
   const bw=Math.max(cw*0.3,ctx.measureText(txt).width+cw*0.14),bh=cw*0.17;
   const bx=x+(cw-bw)/2,by=y+s.ch-bh-cw*0.04;
   rr(ctx,bx,by,bw,bh,bh/2);ctx.fillStyle='rgba(18,26,43,.94)';ctx.fill();
   ctx.lineWidth=Math.max(2,cw*0.008);ctx.strokeStyle='#fff';ctx.stroke();
   ctx.fillStyle='#fff';ctx.textAlign='center';ctx.fillText(txt,x+cw/2,by+bh*0.72);ctx.textAlign='left';
  }
  if(o.labels){
   ctx.fillStyle='#121A2B';ctx.font=`700 ${cw*0.075}px ${FONT}`;
   ctx.fillText(fit(ctx,it.n,cw),x,y+s.ch+cw*0.1);
   const meta=[it.no,finTxt(it.f),it.l&&it.l!=='xx'?it.l.toUpperCase():''].filter(Boolean).join(' · ');
   ctx.fillStyle='#59647D';ctx.font=`600 ${cw*0.065}px ${FONT}`;
   ctx.fillText(fit(ctx,meta,cw),x,y+s.ch+cw*0.2);
  }
 });
 /* rodapé */
 ctx.fillStyle='#8B94AB';ctx.font=`500 ${cw*0.05}px ${FONT}`;ctx.textAlign='center';
 ctx.fillText('Gerado pelo Pokédex TCG · app pessoal, não afiliado à The Pokémon Company · imagens: TCGdex',s.W/2,s.H-s.pad*0.9);
 return cv;
}
const toBlob=cv=>new Promise(res=>cv.toBlob(res,'image/jpeg',0.92));
const slug=t=>String(t||'cartas').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'cartas';

/* Gera as imagens. items: [{url,n,no,q,f,l}] */
export async function buildImages(items,o){
 const labels=o.labels!==false;
 const cols=Math.max(1,Math.min(10,items.length,o.cols||autoCols(items.length)));
 const plan=planSheets(items.length,cols,labels);
 const {bmps,fb,miss}=await loadAll(items,o.onProgress);
 const totalQty=items.reduce((a,i)=>a+(i.q||0),0);
 const files=[];let at=0;
 for(let p=0;p<plan.parts.length;p++){
  const n=plan.parts[p];
  const cv=drawSheet(items.slice(at,at+n),bmps.slice(at,at+n),{cols,labels},plan.cw,o.title,p+1,plan.parts.length,items.length,totalQty);
  const blob=await toBlob(cv);cv.width=cv.height=1;
  if(!blob)throw new Error('O navegador não conseguiu gerar a imagem (talvez seja grande demais).');
  files.push(new File([blob],slug(o.title)+(plan.parts.length>1?'-parte'+(p+1):'')+'.jpg',{type:'image/jpeg'}));
  at+=n;
 }
 bmps.forEach(b=>b&&b.close&&b.close());
 return{files,fb,miss,cw:plan.cw,cols};
}

/* Entrega: no celular abre o compartilhar; no computador, uma nova aba. Se o navegador impedir, mostra uma janela com botões. */
export async function deliver(files,title,tab){
 const urls=files.map(f=>URL.createObjectURL(f));
 const coarse=TOUCH();
 if(coarse&&navigator.canShare&&navigator.canShare({files})){
  try{await navigator.share({files,title});if(tab)tab.close();return;}
  catch(e){if(e&&e.name==='AbortError'){if(tab)tab.close();return;}}
 }
 if(!coarse&&tab&&files.length===1){tab.location.href=urls[0];return;}
 if(tab)tab.close();
 showResult(files,urls,title);
}
function showResult(files,urls,title){
 const canShare=navigator.canShare&&navigator.canShare({files});
 $('#dialog').innerHTML=`<h2>Imagem pronta</h2><p class="lead">${files.length>1?`A lista era grande e foi dividida em ${files.length} imagens.`:'Escolha o que fazer com a imagem.'}</p>
  <div class="exres">${files.map((f,i)=>`<div class="exitem"><img src="${urls[i]}" alt="Prévia ${i+1}"><div class="row">
   <a class="btn small" href="${urls[i]}" target="_blank" rel="noopener">Abrir em nova aba</a><a class="btn small" href="${urls[i]}" download="${esc(f.name)}">Baixar</a></div></div>`).join('')}</div>
  <div class="actions"><span></span>${canShare?'<button class="btn primary" type="button" data-act="exp-share">Compartilhar</button>':''}<button class="btn" type="button" data-ed-act="cancel">Fechar</button></div>`;
 $('#modal').classList.add('on');
 lastShare={files,title};
}
let lastShare=null;
export async function shareAgain(){
 if(!lastShare)return;
 try{await navigator.share(lastShare);}catch(e){}
}

/* ---------- janela de opções ---------- */
let cfg=null;
/* c: {title, scopes:[{v,l}]|null, build(scope)->items} */
export function openExport(c){
 cfg={...c,scope:c.scopes?c.scopes[0].v:null};
 const n0=c.build(cfg.scope).length;
 $('#dialog').innerHTML=`<h2>Exportar imagem</h2>
  <p class="lead">Gera uma imagem com as cartas desta lista, com a quantidade sobre cada carta, para você compartilhar.</p>
  ${c.scopes?`<label class="lbl2" for="exs" style="display:block;margin-top:8px">Quais cartas</label><select class="field" id="exs" data-exp="scope">${c.scopes.map(s=>`<option value="${s.v}">${esc(s.l)}</option>`).join('')}</select>`:''}
  <label class="lbl2" for="exc" style="margin-top:12px;display:block">Colunas (no máximo 10)</label>
  <select class="field" id="exc"><option value="0">Automático</option>${Array.from({length:10},(_,i)=>`<option value="${i+1}">${i+1}</option>`).join('')}</select>
  <label class="size" style="margin-top:12px;display:flex;gap:8px;align-items:center"><input type="checkbox" id="exl" checked> Mostrar nome, número, acabamento e idioma</label>
  <p class="lead" id="exn" style="margin-top:12px">${n0} carta${n0===1?'':'s'} na imagem.</p>
  <div class="actions"><button class="btn" type="button" data-ed-act="cancel">Cancelar</button><button class="btn primary" type="button" data-act="exp-go" id="exgo">Gerar imagem</button></div>`;
 $('#modal').classList.add('on');
}
export function exportScopeChanged(v){if(!cfg)return;cfg.scope=v;const n=cfg.build(v).length;const el=$('#exn');if(el)el.textContent=`${n} carta${n===1?'':'s'} na imagem.`;}
export async function runExport(){
 if(!cfg)return;
 const items=cfg.build(cfg.scope);
 if(!items.length){toast('Não há cartas para exportar nesta opção.');return;}
 const cols=+($('#exc')||{value:0}).value||0;const labels=!!($('#exl')||{checked:true}).checked;
 const title=cfg.title;
 let tab=null;
 if(!TOUCH()){try{tab=window.open('','_blank');if(tab)tab.document.title='Gerando imagem…';}catch(e){}}
 const btn=$('#exgo');if(btn){btn.disabled=true;btn.textContent='Gerando… 0%';}
 try{
  const r=await buildImages(items,{title,cols,labels,onProgress:(d,t)=>{const b=$('#exgo');if(b)b.textContent=`Gerando… ${Math.round(d/t*100)}%`;}});
  document.getElementById('modal').classList.remove('on');
  let msg='';
  if(r.miss)msg+=`${r.miss} carta(s) ficaram sem imagem. `;
  if(r.fb)msg+=`${r.fb} carta(s) usaram a imagem em inglês. `;
  if(msg)toast(msg.trim());
  await deliver(r.files,title,tab);
 }catch(e){
  if(tab)tab.close();
  const b=$('#exgo');if(b){b.disabled=false;b.textContent='Gerar imagem';}
  toast('Não consegui gerar a imagem: '+(e&&e.message||'erro')+'. Tente com menos cartas.');
 }
}
