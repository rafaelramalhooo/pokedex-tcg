/* Estado global do app e atualização de telas. */
import {debounce} from './util.js';

export const S={
 persist:true,
 sets:[],setMap:{},setIdx:{},serieOf:{},catalogAt:0,
 setd:{},briefs:{},cards:{},
 collection:{},binders:[],
 settings:{legalMarks:['H','I','J'],masterReverse:true,showPocket:false,mode:'set',tile:150},
 ui:{q:'',serie:'all',setFilter:'all',setQ:'',binderFilter:'all',binderShown:240,panelId:null,panelCtx:null,edit:null},
 status:{catalog:'idle',pre:null,preErr:0,err:''},
 sync:{running:false,stop:false,done:0,total:0,fail:0},
 setLoad:{},
 cur:null
};
export const viewCache=new Map();
export const C={opt:null};
export const H={renderPanel:()=>{},route:()=>{}};


export const soft=debounce(()=>{if(S.cur&&S.cur.soft)S.cur.soft();},250);
export function softNow(){if(S.cur&&S.cur.soft)S.cur.soft();}
export function refreshAll(){
 if(S.cur&&S.cur.refresh)S.cur.refresh();
 H.renderPanel();
}
