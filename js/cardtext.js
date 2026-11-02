/* Texto da carta (habilidades, ataques, efeito, fraqueza...), buscado na TCGdex quando a carta é aberta. Fica só na memória da sessão. */
import {getFB} from './api.js';
import {S} from './state.js';
import {rarityPt, typePt} from './constants.js';
import {esc} from './util.js';

const CATPT={pokemon:'Pokémon',trainer:'Treinador',energy:'Energia'};
const TRAINER={supporter:'Apoiador',item:'Item',stadium:'Estádio',tool:'Ferramenta Pokémon','pokémon tool':'Ferramenta Pokémon'};
export const texts=()=>S.ui.ctext||(S.ui.ctext={});
const keep=c=>({name:c.name,category:c.category,stage:c.stage,trainerType:c.trainerType,energyType:c.energyType,hp:c.hp,types:c.types||[],rarity:c.rarity,mark:c.regulationMark,illustrator:c.illustrator,
 effect:c.effect,description:c.description,abilities:c.abilities||[],attacks:c.attacks||[],weaknesses:c.weaknesses||[],resistances:c.resistances||[],retreat:c.retreat,evolveFrom:c.evolveFrom});
/* Carrega uma vez por carta e chama done() quando terminar. */
export async function loadText(id,done){
 if(!id||/^pub-/.test(id))return;
 if(texts()[id]){return;}
 texts()[id]='loading';
 try{texts()[id]=keep(await getFB(`/cards/${encodeURIComponent(id)}`));}catch(e){texts()[id]='err';}
 if(done)done();
}
const costTxt=a=>{const m=new Map();(a||[]).forEach(t=>m.set(typePt(t),(m.get(typePt(t))||0)+1));return[...m].map(([t,n])=>n>1?`${t} ×${n}`:t).join(', ');};
/* Bloco de texto da carta. `lines` (opcional) entra no fim, como "Expansão · carta 12". */
export function textHTML(id,lines){
 const c=texts()[id];
 if(!c||c==='loading')return'<div class="skel" style="height:90px;margin-top:10px"></div>';
 if(c==='err')return'<div class="note warn" style="margin-top:10px">Não consegui carregar o texto desta carta agora. Confira a conexão e abra de novo.</div>';
 const facts=[CATPT[String(c.category||'').toLowerCase()]||'',c.stage||'',c.trainerType?(TRAINER[String(c.trainerType).toLowerCase()]||c.trainerType):'',c.energyType||'',c.hp?c.hp+' PS':'',...(c.types||[]).map(typePt),c.rarity?rarityPt(c.rarity):'',c.mark?'Marca '+c.mark:''].filter(Boolean);
 const abil=(c.abilities||[]).map(x=>`<div class="ctx"><b>${esc(x.type||'Habilidade')} · ${esc(x.name||'')}</b><p>${esc(x.effect||'')}</p></div>`).join('');
 const atk=(c.attacks||[]).map(x=>`<div class="ctx"><b>${esc(x.name||'')}${x.damage?` <span class="dmg">${esc(x.damage)}</span>`:''}</b>${(x.cost||[]).length?`<small>${esc(costTxt(x.cost))}</small>`:''}${x.effect?`<p>${esc(x.effect)}</p>`:''}</div>`).join('');
 const wr=[];
 if((c.weaknesses||[]).length)wr.push('Fraqueza: '+c.weaknesses.map(w=>`${typePt(w.type)} ${w.value||''}`.trim()).join(', '));
 if((c.resistances||[]).length)wr.push('Resistência: '+c.resistances.map(w=>`${typePt(w.type)} ${w.value||''}`.trim()).join(', '));
 if(c.retreat!==undefined&&c.retreat!==null&&c.category&&/pok/i.test(c.category))wr.push('Recuo: '+c.retreat);
 return`<div class="facts">${facts.map(x=>`<span class="badge">${esc(x)}</span>`).join('')}</div>
  ${c.evolveFrom?`<p class="lead" style="margin:6px 0 0">Evolui de ${esc(c.evolveFrom)}</p>`:''}
  ${abil}${atk}
  ${c.effect?`<div class="ctx"><p>${esc(c.effect)}</p></div>`:''}
  ${wr.length?`<p class="lead" style="margin:8px 0 0">${wr.map(esc).join(' · ')}</p>`:''}
  ${c.description?`<p class="lead flav" style="margin:8px 0 0">${esc(c.description)}</p>`:''}
  ${lines?`<p class="lead" style="margin:8px 0 0">${lines}</p>`:''}${c.illustrator?`<p class="lead" style="margin:4px 0 0">Ilustração: ${esc(c.illustrator)}</p>`:''}`;
}
