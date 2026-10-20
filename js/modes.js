/* Set / Master Set: cada coleção guarda o seu; a tela inicial tem o próprio (S.settings.mode). */
import {saveSettings} from './db.js';
import {S} from './state.js';

export const modeOf=id=>{
 const m=id&&S.settings.setMode&&S.settings.setMode[id];
 return m||S.settings.mode;
};
export function setSetMode(id,m){
 S.settings.setMode=S.settings.setMode||{};
 S.settings.setMode[id]=m;
 saveSettings();
}

/* Cada coleção e cada fichário guarda a sua própria forma de exibir (lista/fichário, grade, página dupla).
   Quem nunca foi ajustado usa o padrão geral (S.settings.view/grid/spread). */
export const ctxKey=()=>S.cur&&(S.cur.name==='set'||S.cur.name==='binder')&&S.cur.id?S.cur.name+':'+S.cur.id:'';
export function cfg(){
 const k=ctxKey();const own=(k&&S.settings.ctx&&S.settings.ctx[k])||{};
 return{view:own.view||S.settings.view,grid:own.grid||S.settings.grid||{p:'3x3'},spread:own.spread!==undefined?own.spread:!!S.settings.spread,tile:own.tile||S.settings.tile};
}
export function setCfg(patch){
 const k=ctxKey();
 if(!k){Object.assign(S.settings,patch);return saveSettings();}
 const all=S.settings.ctx=S.settings.ctx||{};
 all[k]={...(all[k]||{}),...patch};
 return saveSettings();
}
export const tileOf=()=>cfg().tile;
