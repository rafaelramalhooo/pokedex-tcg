/* Imagens que a TCGdex tem guardadas, mas que a ficha da carta não aponta (ou que vêm de outra carta). */
import {S} from './state.js';

const AS='https://assets.tcgdex.net';
/* Coleção Clássica de 30 Anos: cada carta é a reimpressão de uma carta antiga. Número na coleção -> carta original (TCGdex).
   Conferido em 20/10/2026 contra a TCGdex (nome e número batem; a lista de origem vem de sites de cartas, não do site oficial). */
export const CLASSIC_30={
 '001':'base1-4','002':'ex1-5','003':'ex11-11','004':'bw10-11','005':'gym1-18','006':'ex7-19','007':'neo1-25','008':'sm9-33','009':'xy9-41','010':'dp6-43',
 '011':'pl1-47','012':'swsh4-50','013':'sm4-57','014':'base1-58','015':'gym2-69','016':'bw6-85','017':'sm1-89','018':'hgss4-94','019':'hgss4-99','020':'hgss4-100',
 '021':'bw3-101','022':'dp4-106','023':'xy5-106','024':'neo4-106','025':'ex10-108','026':'swsh8-114','027':'swsh9-123','028':'swsh1-138','029':'ecard2-149','030':'sv02-203'
};
const split=id=>{const i=id.lastIndexOf('-');return[id.slice(0,i),id.slice(i+1)];};
/* Endereço de imagem alternativo para uma carta sem `image`. kind: 'reprint' (arte da carta original) ou 'pattern' (mesmo padrão da TCGdex). */
export function derivedImage(id){
 const b=S.briefs[id];
 const [sid,lid]=split(id);
 const setId=b&&b.setId||sid,localId=String(b&&b.localId||lid);
 if(setId==='30th-c'&&CLASSIC_30[localId]){
  const [os,on]=split(CLASSIC_30[localId]);
  return{url:`${AS}/en/${os.replace(/\d+$/,'')}/${os}/${on}`,kind:'reprint',from:CLASSIC_30[localId]};
 }
 const se=S.serieOf[setId];
 if(se)return{url:`${AS}/en/${se.id}/${setId}/${localId}`,kind:'pattern'};
 return null;
}

/* O Dex (dextcg.com) não deixa outros sites exibirem as imagens dele. Para cartas que só têm imagem do Dex, usa a da TCGdex
   (arte da carta original ou mesmo padrão de endereço) quando existir; senão devolve o endereço recebido. */
export const isDexUrl=u=>typeof u==='string'&&u.includes('dextcg.com');
export function tcgdexBase(id,url){
 if(!isDexUrl(url)||!id)return url;
 const dv=derivedImage(id);
 return dv?dv.url:url;
}

/* Segunda alternativa de imagem: o servidor de imagens do pokemontcg.io (só cartas até onde ele tem; sem chave nem API).
   Código da coleção na TCGdex -> código no pokemontcg.io. Se não houver regra segura, devolve vazio e a carta não tenta essa fonte. */
const PTCG_PROMO=new Set(['svp','swshp','smp','xyp','bwp','dpp','mep']);
export function ptcgSet(setId){
 const id=String(setId||'').toLowerCase();
 if(PTCG_PROMO.has(id))return id;
 const m=/^(base|gym|neo|ecard|ex|dp|pl|hgss|bw|xy|sm|swsh|sv|me)0*(\d+)(?:\.(\d))?$/.exec(id);
 return m?m[1]+m[2]+(m[3]?'pt'+m[3]:''):'';
}
export function ptcgUrl(id,q){
 const b=S.briefs[id];const [sid,lid]=split(id);
 const sl=ptcgSet(b&&b.setId||sid);if(!sl)return'';
 const loc=String(b&&b.localId||lid);
 const n=/^\d+$/.test(loc)?String(+loc):loc;
 return`https://images.pokemontcg.io/${sl}/${n}${q==='high'?'_hires':''}.png`;
}
/* O pokemontcg.io devolve uma figura em branco de 640×892 para carta que não existe; isso conta como falha. */
export const isPtcgBlank=i=>!!i&&typeof i.src==='string'&&i.src.includes('images.pokemontcg.io')&&i.naturalWidth===640&&i.naturalHeight===892;
