/* Acesso à API da TCGdex. */
import {API} from './constants.js';
import {sleep} from './util.js';

export async function api(path,lang='pt',tries=3){
 let err;
 for(let t=0;t<tries;t++){
  try{
   const r=await fetch(`${API}/${lang}${path}`);
   if(r.ok)return await r.json();
   err=new Error('HTTP '+r.status);err.status=r.status;
   if(r.status<500&&r.status!==429)throw err;
  }catch(e){
   err=e;
   if(e.status&&e.status<500&&e.status!==429)throw e;
  }
  await sleep(500*(t+1));
 }
 throw err;
}
export async function getFB(path){
 try{return await api(path,'pt');}
 catch(e){
  if(e.status===404||e.status===400){const d=await api(path,'en');d.__lang='en';return d;}
  throw e;
 }
}
export async function getOrNull(path,lang){
 try{return await api(path,lang);}catch(e){if(e.status===404||e.status===400)return null;throw e;}
}
export async function pool(items,n,fn,stop){
 let i=0;
 await Promise.all(Array.from({length:n},async()=>{
  while(i<items.length){
   if(stop&&stop())return;
   const it=items[i++];
   try{await fn(it);}catch(e){}
  }
 }));
}
