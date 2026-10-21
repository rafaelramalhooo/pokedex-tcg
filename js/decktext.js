/* Decks: lista em texto no padrão do Pokémon TCG Live (importar e exportar). */
import {S} from './state.js';
import {api, pool} from './api.js';
import {saveKV} from './db.js';
import {ensureSetd} from './catalog.js';
import {addCopy, ensureInfo, nameKey} from './decks.js';

const LETTER={grass:'G',fire:'R',water:'W',lightning:'L',psychic:'P',fighting:'F',darkness:'D',metal:'M',fairy:'Y',dragon:'N'};
const WORD=Object.fromEntries(Object.entries(LETTER).map(([w,l])=>[l,w[0].toUpperCase()+w.slice(1)]));
const TYPE_RE=/\b(Grass|Fire|Water|Lightning|Psychic|Fighting|Darkness|Metal|Fairy|Dragon) Energy\b/g;
const HEAD={pt:{pokemon:'Pokémon',treinador:'Treinador',energia:'Energia',total:'Total de cartas'},en:{pokemon:'Pokémon',treinador:'Trainer',energia:'Energy',total:'Total Cards'}};

/* ---------- siglas das expansões ---------- */
export async function abbrOf(setId){
 if(!setId)return'';
 if(S.setab[setId]!==undefined)return S.setab[setId];
 const sd=S.setd[setId];
 if(sd&&sd.abbreviation&&sd.abbreviation.official){S.setab[setId]=sd.abbreviation.official;saveKV('setab',S.setab);return S.setab[setId];}
 try{const d=await api(`/sets/${encodeURIComponent(setId)}`,'en');S.setab[setId]=(d.abbreviation&&d.abbreviation.official)||'';saveKV('setab',S.setab);}
 catch(e){if(e&&e.status===404){S.setab[setId]='';}else return'';}
 return S.setab[setId];
}
export async function loadAllAbbr(onStep){
 const ids=S.sets.map(s=>s.id).filter(id=>S.setab[id]===undefined);
 let n=0;
 await pool(ids,8,async id=>{await abbrOf(id);n++;if(onStep)onStep(n,ids.length);});
}
const setsByAbbr=code=>Object.keys(S.setab).filter(id=>S.setab[id]&&S.setab[id].toUpperCase()===String(code).toUpperCase());

/* ---------- exportar ---------- */
const stripParen=n=>String(n||'').replace(/\s*\([^)]*\)\s*$/,'');
const numOut=no=>/^\d+$/.test(no)?String(Number(no)):no;
export function tcgName(info){
 let n=stripParen(info.ne);
 if(info.cat==='energia'){
  const m=n.match(/^(?:Basic\s+)?(Grass|Fire|Water|Lightning|Psychic|Fighting|Darkness|Metal|Fairy|Dragon) Energy$/);
  if(m&&info.be)return`Basic {${LETTER[m[1].toLowerCase()]}} Energy`;
  n=n.replace(TYPE_RE,(x,t)=>`{${LETTER[t.toLowerCase()]}} Energy`);
 }
 return n;
}
export async function exportRows(d,onStep){
 const out=[];
 for(const it of d.items){
  let info=S.dinfo[it.id];
  if(!info){try{info=await ensureInfo(it.id);}catch(e){info=null;}}
  const ab=info?await abbrOf(info.set):'';
  out.push({q:it.q,id:it.id,cat:info?info.cat:'pokemon',name:info?tcgName(info):it.n,namePt:it.n,ab,no:info?numOut(info.no):String(it.no||''),be:!!(info&&info.be)});
  if(onStep)onStep();
 }
 const order={pokemon:0,treinador:1,energia:2};
 out.sort((a,b)=>order[a.cat]-order[b.cat]||a.name.localeCompare(b.name,'en'));
 return out;
}
export function tcgText(rows,lang='pt'){
 const H=HEAD[lang]||HEAD.pt;const lines=[];
 for(const c of['pokemon','treinador','energia']){
  const part=rows.filter(r=>r.cat===c);if(!part.length)continue;
  if(lines.length)lines.push('');
  lines.push(`${H[c]}: ${part.reduce((a,r)=>a+r.q,0)}`);
  part.forEach(r=>lines.push(`${r.q} ${r.name}${r.ab?' '+r.ab:''}${r.ab&&r.no?' '+r.no:''}`));
 }
 lines.push('');lines.push(`${H.total}: ${rows.reduce((a,r)=>a+r.q,0)}`);
 return lines.join('\n');
}

/* ---------- importar ---------- */
export function parseDeckText(text){
 const out=[],skipped=[];
 for(const raw of String(text||'').split(/\r?\n/)){
  const line=raw.replace(/ /g,' ').trim();if(!line)continue;
  if(/^(pok[eé]mon|trainers?|treinador(?:es)?|energy|energies|energias?)\b[^0-9]*:?\s*\d*\s*$/i.test(line))continue;
  if(/^(total|deck)\b.*$/i.test(line)&&!/^\d/.test(line))continue;
  const m=line.match(/^(\d+)\s*x?\s+(.+)$/i);
  if(!m){skipped.push(line);continue;}
  let rest=m[2].trim(),code='',num='';
  const c=rest.match(/^(.*\S)\s+([A-Z][A-Z0-9-]{1,5})\s+([A-Za-z]{0,4}\d+[A-Za-z]?)$/);
  if(c){rest=c[1];code=c[2];num=c[3];}
  out.push({line,q:Math.min(99,+m[1]),name:rest,code,num});
 }
 return{entries:out,skipped};
}
const unbrace=n=>String(n).replace(/\{([A-Za-z])\}/g,(m,x)=>WORD[x.toUpperCase()]||m);
const basicType=n=>{const m=unbrace(n).trim().match(/^(?:basic\s+)?(grass|fire|water|lightning|psychic|fighting|darkness|metal|fairy|dragon)\s+energy$/i);return m?m[1].toLowerCase():'';};
const numEq=(a,b)=>String(a).replace(/^0+(?=\d)/,'').toLowerCase()===String(b).replace(/^0+(?=\d)/,'').toLowerCase();
function ensureBrief(info){
 if(!S.briefs[info.id])S.briefs[info.id]={id:info.id,localId:info.no,name:info.ne,image:info.img||'',setId:info.set};
}
async function byName(name,type){
 const q=type?`${type[0].toUpperCase()+type.slice(1)} Energy`:stripParen(name);
 const nk=nameKey(q);
 for(const std of['&legal.standard=true','']){
  try{
   const list=await api(`/cards?name=${encodeURIComponent(q)}${std}`,'en');
   const hit=(list||[]).find(c=>nameKey(c.name)===nk&&!/^tk-|^tcgp|^[AB]\d/.test(c.id));
   if(hit)return hit.id;
  }catch(e){}
 }
 return'';
}
/* Acha a carta de uma linha: primeiro pela sigla e número, depois pelo nome. */
export async function resolveEntry(e){
 const bt=basicType(e.name);const nk=nameKey(unbrace(e.name));
 let mismatch='';
 if(e.code){
  for(const sid of setsByAbbr(e.code)){
   let d;try{d=await ensureSetd(sid);}catch(x){continue;}
   const cc=(d.cards||[]).find(c=>numEq(c.localId,e.num));if(!cc)continue;
   const info=await ensureInfo(cc.id).catch(()=>null);if(!info)continue;
   if(nameKey(info.ne)===nk||(bt&&info.be&&basicType(info.ne)===bt)){ensureBrief(info);return{id:cc.id};}
   if(!mismatch)mismatch=cc.id;
  }
 }
 const id=await byName(e.name,bt);
 if(id){const info=await ensureInfo(id).catch(()=>null);if(info){ensureBrief(info);return{id,note:e.code?'impressão trocada: a sigla e o número não bateram, usei outra impressão com o mesmo nome':'sem sigla: usei uma impressão com o mesmo nome'};}}
 if(mismatch){const info=await ensureInfo(mismatch).catch(()=>null);if(info){ensureBrief(info);return{id:mismatch,note:`o nome na TCGdex é “${info.ne}”`};}}
 return null;
}
export async function importInto(deck,text,onStep){
 const {entries,skipped}=parseDeckText(text);
 if(entries.some(e=>e.code)){await loadAllAbbr((n,t)=>{if(onStep)onStep(`Preparando as siglas das expansões (${n}/${t})…`);});}
 const bad=[],notes=[];let ok=0,cards=0;
 let i=0;
 for(const e of entries){
  i++;if(onStep)onStep(`Procurando as cartas (${i}/${entries.length})…`);
  let r=null;try{r=await resolveEntry(e);}catch(x){}
  if(!r){bad.push(e.line);continue;}
  addCopy(deck,r.id,e.q);ok++;cards+=e.q;
  if(r.note)notes.push(`${e.line}: ${r.note}`);
 }
 return{ok,cards,total:entries.length,bad,notes,skipped};
}
