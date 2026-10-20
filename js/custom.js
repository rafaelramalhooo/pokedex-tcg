/* Imagens enviadas por você (logo de expansão e foto de carta). Ficam neste navegador, reduzidas, e entram no backup. */
import {saveKV} from './db.js';
import {S} from './state.js';

export const customLogo=id=>S.custom.logos[id]||'';
export const customCard=id=>S.custom.cards[id]||'';

function readImage(file){
 return new Promise((res,rej)=>{
  const url=URL.createObjectURL(file);const im=new Image();
  im.onload=()=>{URL.revokeObjectURL(url);res(im);};
  im.onerror=()=>{URL.revokeObjectURL(url);rej(new Error('imagem'));};
  im.src=url;
 });
}
/* Reduz a imagem para caber em maxW x maxH e devolve um endereço de dados (webp, com transparência). */
export async function shrinkImage(file,maxW,maxH){
 const im=await readImage(file);
 const k=Math.min(1,maxW/im.naturalWidth,maxH/im.naturalHeight);
 const w=Math.max(1,Math.round(im.naturalWidth*k)),h=Math.max(1,Math.round(im.naturalHeight*k));
 const cv=document.createElement('canvas');cv.width=w;cv.height=h;
 cv.getContext('2d').drawImage(im,0,0,w,h);
 let out=cv.toDataURL('image/webp',0.88);
 if(!out.startsWith('data:image/webp'))out=cv.toDataURL('image/png');
 return out;
}
const save=()=>saveKV('custom',S.custom);
const store=kind=>kind==='logo'?S.custom.logos:kind==='cover'?(S.custom.covers=S.custom.covers||{}):S.custom.cards;
export function setCustom(kind,id,url){
 store(kind)[id]=url;
 return save();
}
export function removeCustom(kind,id){
 delete store(kind)[id];
 return save();
}
/* Abre o seletor de arquivo; ao escolher, reduz, guarda e chama done(). */
export function pickImage(kind,id,done,fail){
 const inp=document.createElement('input');
 inp.type='file';inp.accept='image/*';inp.style.display='none';
 inp.addEventListener('change',async()=>{
  const f=inp.files&&inp.files[0];inp.remove();
  if(!f)return;
  try{
   const url=await shrinkImage(f,...(kind==='logo'?[520,260]:kind==='cover'?[480,480]:[640,900]));
   await setCustom(kind,id,url);done&&done();
  }catch(e){fail&&fail(e);}
 });
 document.body.appendChild(inp);inp.click();
}
