/* Constantes: acabamentos, tipos, campos das regras dos fichários. */
import {api} from './api.js';

export const API='https://api.tcgdex.net/v2';
export const FIN=['normal','holo','reverse'];
export const FIN_LABEL={normal:'Normal',holo:'Holo',reverse:'Reverse holo'};
export const COND=[['M','Perfeita (M)'],['NM','Quase perfeita (NM)'],['LP','Levemente jogada (LP)'],['MP','Moderadamente jogada (MP)'],['HP','Muito jogada (HP)'],['DMG','Danificada (DMG)']];
export const LANGS=[['pt','Português'],['en','Inglês'],['ja','Japonês'],['es','Espanhol'],['fr','Francês'],['de','Alemão'],['it','Italiano'],['ko','Coreano'],['zh','Chinês'],['xx','Outro']];
export const TYPES=[['planta','Planta'],['fogo','Fogo'],['agua','Água'],['raios','Raios'],['luta','Luta'],['metal','Metal'],['psiquico','Psíquico'],['escuridao','Escuridão'],['incolor','Incolor'],['dragao','Dragão'],['fada','Fada']];
export const TYPE_ALIAS={grass:'planta',grama:'planta',planta:'planta',fire:'fogo',fogo:'fogo',water:'agua',agua:'agua',lightning:'raios',raios:'raios',raio:'raios',eletrico:'raios',fighting:'luta',luta:'luta',metal:'metal',steel:'metal',psychic:'psiquico',psiquico:'psiquico',darkness:'escuridao',dark:'escuridao',escuridao:'escuridao',colorless:'incolor',incolor:'incolor',dragon:'dragao',dragao:'dragao',fairy:'fada',fada:'fada'};
export const CATS=[['pokemon','Pokémon'],['treinador','Treinador'],['energia','Energia']];
export const CAT_ALIAS={pokemon:'pokemon',trainer:'treinador',treinador:'treinador',energy:'energia',energia:'energia'};
export const STAGES=[['basico','Básico'],['fase1','Fase 1'],['fase2','Fase 2']];
export const STAGE_ALIAS={basic:'basico',basico:'basico',stage1:'fase1',fase1:'fase1',stage2:'fase2',fase2:'fase2'};
export const VARS=[['normal','Normal'],['holo','Holo'],['reverse','Reverse holo']];
/* Gerações pelos números da Pokédex Nacional (faixas de conhecimento prévio, não conferidas em fonte oficial). */
export const GENS=[[1,1,151],[2,152,251],[3,252,386],[4,387,493],[5,494,649],[6,650,721],[7,722,809],[8,810,905],[9,906,1025]];
export const genOf=n=>{const g=GENS.find(([,a,b])=>n>=a&&n<=b);return g?g[0]:0;};
export const BOOL=[['sim','Sim'],['nao','Não']];
export const OPS={eq:'é igual a',ne:'é diferente de',contains:'contém',notcontains:'não contém',in:'está em (lista)',gt:'maior que',gte:'maior ou igual a',lt:'menor que',lte:'menor ou igual a'};
export const TEXT_OPS=['contains','eq','ne','notcontains','in'];
export const NUM_OPS=['eq','gte','lte','gt','lt','ne','in'];
/* d = precisa dos detalhes da carta (baixados na sincronização) */
export const FIELDS=[
 {k:'name',label:'Nome da carta',t:'text',d:false,def:'contains'},
 {k:'dexId',label:'Pokémon (nº da Pokédex)',t:'num',d:true,def:'eq',hint:'Agrupa todas as cartas do mesmo Pokémon, em qualquer forma.'},
 {k:'pokemon',label:'Pokémon (por nome)',t:'poke',d:false,def:'in',hint:'Um ou vários Pokémon, separados por vírgula. Pega todas as formas (ex, V, VMAX, Mega…) pelo nome da carta.'},
 {k:'generation',label:'Geração',t:'gen',d:true,def:'in',hint:'Pelo número da Pokédex Nacional (1ª: 1–151, 2ª: 152–251… 9ª: 906–1025). Faixas aplicadas de conhecimento prévio; não conferidas em fonte oficial.'},
 {k:'set',label:'Coleção',t:'text',d:false,def:'eq'},
 {k:'serie',label:'Série',t:'text',d:false,def:'eq'},
 {k:'types',label:'Tipo',t:'enum',opts:TYPES,d:true,def:'eq'},
 {k:'category',label:'Categoria',t:'enum',opts:CATS,d:true,def:'eq'},
 {k:'stage',label:'Estágio',t:'enum',opts:STAGES,d:true,def:'eq'},
 {k:'suffix',label:'Sufixo (ex, V, VMAX…)',t:'text',d:true,def:'eq'},
 {k:'trainerType',label:'Tipo de Treinador',t:'text',d:true,def:'contains'},
 {k:'illustrator',label:'Ilustrador',t:'text',d:true,def:'contains'},
 {k:'rarity',label:'Raridade',t:'text',d:true,def:'contains'},
 {k:'hp',label:'PS',t:'num',d:true,def:'gte'},
 {k:'regulationMark',label:'Marca de regulamentação',t:'text',d:true,def:'eq'},
 {k:'standard',label:'Legal no Standard',t:'bool',d:true,def:'eq',hint:'Calculado pela marca impressa na carta, usando as marcas legais dos Ajustes, mais as coleções liberadas por exceção (Celebração de 30 Anos). Reimpressões de cartas antigas não entram nos fichários; nos decks elas aparecem como aviso.'},
 {k:'variant',label:'Existe no acabamento',t:'enum',opts:VARS,d:true,def:'eq'},
 {k:'owned',label:'Eu tenho a carta',t:'bool',d:false,def:'eq'}
];
export const FM=Object.fromEntries(FIELDS.map(f=>[f.k,f]));

/* Nomes que a TCGdex devolve em inglês ou português para a mesma coisa: tudo vira o nome em português.
   Raridades sem equivalente confirmado em português ficam com o nome original. */
const _nz=x=>String(x==null?'':x).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const RAR=[
 ['Comum','Common'],['Incomum','Uncommon'],['Rara','Rare'],['Rara Holo','Holo Rare','Rare Holo'],['Ultra Rara','Ultra Rare'],
 ['Rara Dupla','Double rare'],['Hiper rara','Hyper rare'],['Mega Hiper Raro','Mega Hyper Rare'],
 ['Ilustração Rara','Illustration rare'],['Ilustração Rara Especial','Special illustration rare'],
 ['Rara Secreta','Secret Rare','Rare Secreta'],['ACE SPEC Raro','ACE SPEC Rare'],
 ['Arte Completa de Treinador','Full Art Trainer'],['Rara Radiante','Radiant Rare'],['Raras Incríveis','Amazing Rare'],
 ['Rara Preto e Branco','Black White Rare'],['Brilhante Ultra Rara','Shiny Ultra Rare'],
 ['Shiny rara','Shiny rare'],['Shiny rara V','Shiny rare V'],['Shiny rara VMAX','Shiny rare VMAX'],
 ['Rara Holo V','Holo Rare V'],['Rara Holo VMAX','Holo Rare VMAX'],['Rara Holo VSTAR','Holo Rare VSTAR'],['Promo','Promo']
];
const RAR_PT=new Map(),RAR_EN=new Map();
RAR.forEach(([pt,en,...alt])=>{[pt,en,...alt].forEach(n=>RAR_PT.set(_nz(n),pt));RAR_EN.set(_nz(pt),en);});
export const rarityPt=r=>r?(RAR_PT.get(_nz(r))||r):r;
export const rarityEn=r=>{const p=rarityPt(r);return p?(RAR_EN.get(_nz(p))||p):p;};
export const typePt=t=>{if(!t)return t;const k=TYPE_ALIAS[_nz(t)];const e=k&&TYPES.find(x=>x[0]===k);return e?e[1]:t;};
