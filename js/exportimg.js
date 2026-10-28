/* Exportar imagem: monta uma folha com as cartas (até 10 colunas) para compartilhar em trocas e vendas. */
import {finShort} from './constants.js';
import {toast} from './ui.js';
import {$, esc} from './util.js';

const TOUCH=()=>typeof matchMedia==='function'&&matchMedia('(pointer:coarse)').matches;
const limits=()=>TOUCH()?{area:16e6,dim:8192}:{area:64e6,dim:16000};
const NATIVE_W=600;           /* largura das imagens "high" da TCGdex */
const WIDTHS=[600,540,480,420,360];

export const autoCols=n=>Math.max(2,Math.min(10,Math.round(Math.sqrt(n*0.9))));

/* Medidas da folha para n cartas em cols colunas com cartas de largura cw.
   A folha nunca fica mais estreita que MIN_COLS colunas, para o cabeçalho e o rodapé terem espaço. */
const MIN_COLS=4;
const SECH=0.36;   /* altura do cabeçalho de cada lista, em larguras de carta */
export function sheetSize(n,cols,cw,labels,lines,kind,extra,nSec=0,rowsOv=0){
 const g=cw*0.045,pad=cw*0.07,ch=cw*1.375,lab=labels?cw*(0.38+(extra?0.1:0)):0,head=cw*(0.07+(kind?0.185:0)+(lines||1)*0.165+0.25),foot=cw*0.42;
 const rows=rowsOv||Math.ceil(n/cols);const gc=Math.max(cols,MIN_COLS);
 const gridW=cols*cw+(cols-1)*g;
 return{g,pad,ch,lab,head,foot,rows,gc,gridW,W:Math.round(pad*2+gc*cw+(gc-1)*g),sec:cw*SECH,H:Math.round(head+rows*(ch+lab+g)+nSec*cw*SECH+foot+pad*0.5)};
}
/* Escolhe a maior largura de carta em que tudo cabe numa imagem; se não couber, divide em partes. */
export function planSheets(n,cols,labels,lines,kind,extra){
 const L=limits();
 const fits=(m,cw)=>{const s=sheetSize(m,cols,cw,labels,lines,kind,extra);return s.W*s.H<=L.area&&s.W<=L.dim&&s.H<=L.dim;};
 for(const cw of WIDTHS)if(fits(n,cw))return{cw,parts:[n]};
 const cw=WIDTHS[WIDTHS.length-1];
 let rows=1;while(fits((rows+1)*cols,cw))rows++;
 const per=Math.max(cols,rows*cols);const parts=[];
 for(let left=n;left>0;left-=per)parts.push(Math.min(per,left));
 return{cw,parts};
}

/* Linhas da grade quando há listas separadas: cada lista começa numa linha nova. sections: [{n}] */
export function layoutRows(sections,cols){
 const rows=[];let at=0;
 sections.forEach((sc,si)=>{for(let i=0;i<sc.n;i+=cols)rows.push({sec:si,from:at+i,to:at+Math.min(sc.n,i+cols)});at+=sc.n;});
 return rows;
}
const headersOf=rows=>{let h=0,prev=-1;rows.forEach(r=>{if(r.sec!==prev){h++;prev=r.sec;}});return h;};
export function planSections(rows,cols,labels,lines,kind,extra){
 const L=limits();
 const fits=(rs,cw)=>{const s=sheetSize(0,cols,cw,labels,lines,kind,extra,headersOf(rs),rs.length);return s.W*s.H<=L.area&&s.W<=L.dim&&s.H<=L.dim;};
 for(const cw of WIDTHS)if(fits(rows,cw))return{cw,parts:[rows]};
 const cw=WIDTHS[WIDTHS.length-1];
 const parts=[];let cur=[];
 rows.forEach(r=>{
  const next=cur.concat([r]);
  if(cur.length&&!fits(next,cw)){parts.push(cur);cur=[{...r,cont:true}];}else cur=next;
 });
 if(cur.length)parts.push(cur);
 /* a primeira linha de cada parte, quando continua uma lista, ganha o aviso de continuação */
 parts.forEach((pt,i)=>{if(i>0){const prevSec=parts[i-1][parts[i-1].length-1].sec;pt[0]={...pt[0],cont:pt[0].sec===prevSec};}});
 return{cw,parts};
}

async function toBitmap(blob){
 try{return await createImageBitmap(blob);}
 catch(e){
  const u=URL.createObjectURL(blob);
  try{const im=new Image();im.src=u;await im.decode();return im;}finally{setTimeout(()=>URL.revokeObjectURL(u),2000);}
 }
}
/* Endereços possíveis para a mesma imagem: webp e png, alta e baixa, no idioma da carta e depois em inglês. */
function candidates(url){
 const m=/^(https:\/\/assets\.tcgdex\.net\/)([a-z-]+)\/(.+)\/(high|low)\.webp$/.exec(url);
 if(!m)return[{u:url,fb:false}];
 const [,host,lang,path]=m;
 const langs=lang==='en'?['en']:[lang,'en'];
 const out=[];
 for(const q of ['high','low'])for(const l of langs)for(const ext of ['webp','png'])out.push({u:`${host}${l}/${path}/${q}.${ext}`,fb:l!==lang});
 return out;
}
async function loadBitmap(url){
 for(const c of candidates(url)){
  try{
   const r=await fetch(c.u,{mode:'cors'});if(!r.ok)continue;
   return{bmp:await toBitmap(await r.blob()),fallback:c.fb};
  }catch(e){}
 }
 return null;
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
const finTxt=f=>finShort(f);

/* Quebra o texto em até maxLines linhas; a última leva "…" se faltar espaço. */
function wrap(ctx,text,maxW,maxLines){
 const words=String(text).split(/\s+/).filter(Boolean);const lines=[];let cur='';
 for(let i=0;i<words.length;i++){
  const t=cur?cur+' '+words[i]:words[i];
  if(ctx.measureText(t).width<=maxW||!cur){cur=t;}
  else{lines.push(cur);cur=words[i];if(lines.length===maxLines-1){cur=words.slice(i).join(' ');break;}}
 }
 lines.push(cur);
 return lines.slice(0,maxLines).map((l,i,a)=>i===a.length-1?fit(ctx,l,maxW):fit(ctx,l,maxW));
}
const linesGuess=t=>String(t||'').length>22?2:1;

function drawSheet(items,bmps,o,cw,title,partNo,partTotal,totalCards,totalQty,rowsIn,secs){
 const full=title+(partTotal>1?` (parte ${partNo}/${partTotal})`:'');
 const probe=document.createElement('canvas').getContext('2d');
 probe.font=`800 ${cw*0.16}px "Hanken Grotesk","Segoe UI",Roboto,Helvetica,Arial,sans-serif`;
 const rowsL=rowsIn||Array.from({length:Math.ceil(items.length/o.cols)},(_,r)=>({sec:null,from:r*o.cols,to:Math.min(items.length,(r+1)*o.cols)}));
 const nSec=secs?headersOf(rowsL):0;
 const w0=sheetSize(items.length,o.cols,cw,o.labels,1,!!o.kindLabel,o.extra,nSec,rowsL.length);
 const nLines=wrap(probe,full,w0.W-w0.pad*2,2).length;
 const s=sheetSize(items.length,o.cols,cw,o.labels,nLines,!!o.kindLabel,o.extra,nSec,rowsL.length);
 const cv=document.createElement('canvas');cv.width=s.W;cv.height=s.H;
 const ctx=cv.getContext('2d');
 ctx.fillStyle='#F2F4F9';ctx.fillRect(0,0,s.W,s.H);
 const FONT='"Hanken Grotesk","Segoe UI",Roboto,Helvetica,Arial,sans-serif';
 const x0=(s.W-s.gridW)/2;            /* a grade fica centralizada na folha */
 const textW=s.W-s.pad*2;
 ctx.textBaseline='alphabetic';ctx.textAlign='left';
 /* cabeçalho: tipo da lista, título (até 2 linhas) e resumo */
 let y=s.pad;
 if(o.kindLabel){
  ctx.font=`800 ${cw*0.062}px ${FONT}`;const kt=o.kindLabel.toUpperCase();
  const kw=ctx.measureText(kt).width+cw*0.2,kh=cw*0.115;
  rr(ctx,s.pad,y,kw,kh,kh/2);ctx.fillStyle=o.kindColor||'#D93A2B';ctx.fill();
  ctx.fillStyle='#fff';ctx.fillText(kt,s.pad+cw*0.1,y+kh*0.72);
  y+=kh+cw*0.07;
 }
 ctx.fillStyle='#121A2B';ctx.font=`800 ${cw*0.16}px ${FONT}`;
 const tl=wrap(ctx,full,textW,2);
 tl.forEach((l,i)=>{y+=cw*0.165;ctx.fillText(l,s.pad,y);});
 y+=cw*0.11;
 ctx.fillStyle='#59647D';ctx.font=`600 ${cw*0.078}px ${FONT}`;
 ctx.fillText(fit(ctx,`${totalCards} carta${totalCards===1?'':'s'}${totalQty!=null?' · '+totalQty+' unidade'+(totalQty===1?'':'s'):''}  ·  ${new Date().toLocaleDateString('pt-BR')}`,textW),s.pad,y);
 /* cartas (cada lista começa na própria linha, com cabeçalho) */
 let off=0,prevSec=-1;
 rowsL.forEach((rw,ri)=>{
  if(secs&&rw.sec!==prevSec){
   prevSec=rw.sec;const sc=secs[rw.sec];const hy=s.head+off+ri*(s.ch+s.lab+s.g);
   ctx.textAlign='left';
   ctx.font=`800 ${cw*0.06}px ${FONT}`;const kt=(sc.kindLabel||'').toUpperCase();
   const kh=cw*0.115;let tx=x0;
   if(kt){const kw=ctx.measureText(kt).width+cw*0.2;rr(ctx,x0,hy+cw*0.02,kw,kh,kh/2);ctx.fillStyle=sc.color||'#D93A2B';ctx.fill();ctx.fillStyle='#fff';ctx.fillText(kt,x0+cw*0.1,hy+cw*0.02+kh*0.72);tx=x0+kw+cw*0.12;}
   ctx.font=`800 ${cw*0.1}px ${FONT}`;ctx.fillStyle='#121A2B';
   const lbl=sc.label+(rw.cont?' (continuação)':'');
   const stat=`${sc.n} carta${sc.n===1?'':'s'} · ${sc.q} unidade${sc.q===1?'':'s'}`;
   ctx.font=`600 ${cw*0.068}px ${FONT}`;const sw=ctx.measureText(stat).width;
   ctx.font=`800 ${cw*0.1}px ${FONT}`;
   ctx.fillText(fit(ctx,lbl,Math.max(cw,s.gridW-(tx-x0)-sw-cw*0.2)),tx,hy+cw*0.02+kh*0.82);
   ctx.font=`600 ${cw*0.068}px ${FONT}`;ctx.fillStyle='#59647D';ctx.textAlign='right';ctx.fillText(stat,x0+s.gridW,hy+cw*0.02+kh*0.8);ctx.textAlign='left';
   ctx.strokeStyle='#D8DDE9';ctx.lineWidth=Math.max(1,cw*0.004);ctx.beginPath();ctx.moveTo(x0,hy+cw*0.2);ctx.lineTo(x0+s.gridW,hy+cw*0.2);ctx.stroke();
   off+=s.sec;
  }
  for(let i=rw.from;i<rw.to;i++){
  const col=i-rw.from,row=ri;
  const x=x0+col*(cw+s.g),yy=s.head+off+row*(s.ch+s.lab+s.g);
  const it=items[i],b=bmps[i];
  ctx.save();rr(ctx,x,yy,cw,s.ch,cw*0.045);ctx.clip();
  if(b)ctx.drawImage(b,x,yy,cw,s.ch);
  else{ctx.fillStyle='#CBD2E0';ctx.fillRect(x,yy,cw,s.ch);ctx.fillStyle='#121A2B';ctx.font=`700 ${cw*0.085}px ${FONT}`;ctx.textAlign='center';ctx.fillText(fit(ctx,it.n,cw*0.86),x+cw/2,yy+s.ch/2);ctx.fillStyle='#59647D';ctx.font=`600 ${cw*0.06}px ${FONT}`;ctx.fillText('Imagem indisponível',x+cw/2,yy+s.ch/2+cw*0.1);ctx.textAlign='left';}
  ctx.restore();
  /* selo de quantidade: centralizado embaixo, sobre a carta */
  if(it.q>0){
   const txt='×'+it.q;ctx.font=`800 ${cw*0.1}px ${FONT}`;
   const bw=Math.max(cw*0.26,ctx.measureText(txt).width+cw*0.13),bh=cw*0.15;
   const bx=x+(cw-bw)/2,by=yy+s.ch-bh-cw*0.035;
   rr(ctx,bx,by,bw,bh,bh/2);ctx.fillStyle='#D63A2F';ctx.fill();
   ctx.lineWidth=Math.max(2,cw*0.008);ctx.strokeStyle='#fff';ctx.stroke();
   ctx.fillStyle='#fff';ctx.textAlign='center';ctx.fillText(txt,x+cw/2,by+bh*0.72);ctx.textAlign='left';
  }
  if(o.labels){
   ctx.fillStyle='#121A2B';ctx.font=`700 ${cw*0.072}px ${FONT}`;
   const nl=wrap(ctx,it.n,cw,2);let ly=yy+s.ch+cw*0.02;
   nl.forEach(l=>{ly+=cw*0.085;ctx.fillText(l,x,ly);});
   const meta=[it.no,finTxt(it.f),it.l&&it.l!=='xx'?it.l.toUpperCase():''].filter(Boolean).join(' · ');
   ctx.fillStyle='#59647D';ctx.font=`600 ${cw*0.062}px ${FONT}`;
   ctx.fillText(fit(ctx,meta,cw),x,ly+cw*0.085);
   if(o.extra){
    const ex=[it.c||'',typeof it.p==='number'?it.p.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):''].filter(Boolean);
    if(ex.length){ctx.fillStyle='#121A2B';ctx.font=`800 ${cw*0.068}px ${FONT}`;ctx.fillText(fit(ctx,ex.join(' · '),cw),x,ly+cw*0.17);}
   }
  }
   }
 });
 /* rodapé em duas linhas, com margem de segurança */
 ctx.strokeStyle='#D8DDE9';ctx.lineWidth=Math.max(1,cw*0.004);
 ctx.beginPath();ctx.moveTo(s.pad,s.H-s.foot*0.95);ctx.lineTo(s.W-s.pad,s.H-s.foot*0.95);ctx.stroke();
 ctx.fillStyle='#8B94AB';ctx.font=`500 ${cw*0.052}px ${FONT}`;ctx.textAlign='center';
 ctx.fillText(fit(ctx,'Gerado pelo TCG Collection · app pessoal',textW),s.W/2,s.H-s.foot*0.55);
 ctx.fillText(fit(ctx,'Não afiliado à The Pokémon Company · imagens: TCGdex',textW),s.W/2,s.H-s.foot*0.3);
 return cv;
}
const toBlob=cv=>new Promise(res=>cv.toBlob(res,'image/jpeg',0.92));
const slug=t=>String(t||'cartas').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'cartas';

/* Gera as imagens. items: [{url,n,no,q,f,l}] */
export async function buildImages(items,o){
 const labels=o.labels!==false;
 const maxSec=o.sections&&o.sections.length?Math.max(...o.sections.map((_,si)=>items.filter(i=>i.sec===si).length)):items.length;
 const cols=Math.max(1,Math.min(10,Math.max(1,maxSec),o.cols||autoCols(maxSec)));
 const extra=!!o.extra&&labels&&items.some(i=>i.c||typeof i.p==='number');
 const secs=o.sections&&o.sections.length?o.sections.map((sc,si)=>{const its=items.filter(i=>i.sec===si);return{...sc,n:its.length,q:its.reduce((a,i)=>a+(i.q||0),0)};}):null;
 const {bmps,fb,miss}=await loadAll(items,o.onProgress);
 const totalQty=items.reduce((a,i)=>a+(i.q||0),0);
 const files=[];
 let plan,partsLayout;
 if(secs){
  const rows=layoutRows(secs,cols);
  plan=planSections(rows,cols,labels,linesGuess(o.title+' (parte 1/1)'),false,extra);
  partsLayout=plan.parts;
 }else{
  plan=planSheets(items.length,cols,labels,linesGuess(o.title+' (parte 1/1)'),!!o.kindLabel,extra);
 }
 const nParts=plan.parts.length;
 let at=0;
 for(let p=0;p<nParts;p++){
  let cv;
  if(secs){
   const rows=partsLayout[p];
   cv=drawSheet(items,bmps,{cols,labels,extra,kindLabel:null},plan.cw,o.title,p+1,nParts,items.length,totalQty,rows,secs);
  }else{
   const n=plan.parts[p];
   cv=drawSheet(items.slice(at,at+n),bmps.slice(at,at+n),{cols,labels,extra,kindLabel:o.kindLabel,kindColor:o.kindColor},plan.cw,o.title,p+1,nParts,items.length,totalQty);
   at+=n;
  }
  const blob=await toBlob(cv);cv.width=cv.height=1;
  if(!blob)throw new Error('O navegador não conseguiu gerar a imagem (talvez seja grande demais).');
  files.push(new File([blob],slug(o.title)+(nParts>1?'-parte'+(p+1):'')+'.jpg',{type:'image/jpeg'}));
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
  <p class="lead">${c.sections?`Gera uma imagem juntando ${c.sections.length} listas, cada uma na própria seção, com a quantidade sobre cada carta.`:'Gera uma imagem com as cartas desta lista, com a quantidade sobre cada carta, para você compartilhar.'}</p>
  ${c.scopes?`<label class="lbl2" for="exs" style="display:block;margin-top:8px">Quais cartas</label><select class="field" id="exs" data-exp="scope">${c.scopes.map(s=>`<option value="${s.v}">${esc(s.l)}</option>`).join('')}</select>`:''}
  ${c.sections?`<label class="lbl2" for="ext" style="margin-top:8px;display:block">Título da imagem</label><input class="field" id="ext" type="text" value="${esc(c.title)}" maxlength="120">`:''}
  <label class="lbl2" for="exc" style="margin-top:12px;display:block">Colunas (no máximo 10)</label>
  <select class="field" id="exc"><option value="0">Automático</option>${Array.from({length:10},(_,i)=>`<option value="${i+1}">${i+1}</option>`).join('')}</select>
  <label class="size" style="margin-top:12px;display:flex;gap:8px;align-items:center"><input type="checkbox" id="exl" checked> Mostrar nome, número, acabamento e idioma</label>
  ${c.extras&&c.extras.p?`<label class="size" style="margin-top:8px;display:flex;gap:8px;align-items:center"><input type="checkbox" id="exp" ${c.extras.on?'checked':''}> Mostrar o valor pedido</label>`:''}
  ${c.extras&&c.extras.c?`<label class="size" style="margin-top:8px;display:flex;gap:8px;align-items:center"><input type="checkbox" id="exk" ${c.extras.on?'checked':''}> Mostrar a condição</label>`:''}
  <p class="lead" id="exn" style="margin-top:12px">${n0} carta${n0===1?'':'s'} na imagem.</p>
  <div class="actions"><button class="btn" type="button" data-ed-act="cancel">Cancelar</button><button class="btn primary" type="button" data-act="exp-go" id="exgo">Gerar imagem</button></div>`;
 $('#modal').classList.add('on');
}
export function exportScopeChanged(v){if(!cfg)return;cfg.scope=v;const n=cfg.build(v).length;const el=$('#exn');if(el)el.textContent=`${n} carta${n===1?'':'s'} na imagem.`;}
export async function runExport(){
 if(!cfg)return;
 let items=cfg.build(cfg.scope);
 const showP=!!($('#exp')&&$('#exp').checked),showC=!!($('#exk')&&$('#exk').checked);
 items=items.map(i=>{const x={...i};if(!showP)delete x.p;if(!showC)delete x.c;return x;});
 if(!items.length){toast('Não há cartas para exportar nesta opção.');return;}
 const cols=+($('#exc')||{value:0}).value||0;const labels=!!($('#exl')||{checked:true}).checked;
 const title=(($('#ext')||{}).value||'').trim()||cfg.title;
 let tab=null;
 if(!TOUCH()){try{tab=window.open('','_blank');if(tab)tab.document.title='Gerando imagem…';}catch(e){}}
 const btn=$('#exgo');if(btn){btn.disabled=true;btn.textContent='Gerando… 0%';}
 try{
  const r=await buildImages(items,{title,cols,labels,extra:showP||showC,kindLabel:cfg.kindLabel,kindColor:cfg.kindColor,sections:cfg.sections,onProgress:(d,t)=>{const b=$('#exgo');if(b)b.textContent=`Gerando… ${Math.round(d/t*100)}%`;}});
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
