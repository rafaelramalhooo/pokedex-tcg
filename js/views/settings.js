/* Tela de catálogo e ajustes, backup. */
import {catalogCoverage} from '../catalog.js';
import {DB, saveBinders, saveKV, saveSettings} from '../db.js';
import {saveTrades} from '../trades.js';
import {saveDecks} from '../decks.js';
import {H, S, soft} from '../state.js';
import {noteHTML, toast} from '../ui.js';
import {cloudSection} from './auth.js';
import {$, esc, fmtN, pct} from '../util.js';

export function viewSettings(){
 S.cur={name:'settings',soft:renderSettings,refresh:renderSettings};
 $('#view').innerHTML=`<div class="top"><div><h1>Catálogo e ajustes</h1><p class="lead">Sincronização dos dados das cartas, regras do Standard, contagem do Master Set e backup da sua coleção.</p></div></div><div id="sbody"></div>`;
 renderSettings();
}
export function renderSettings(){
 const el=$('#sbody');if(!el)return;
 if(document.activeElement&&el.contains(document.activeElement)&&document.activeElement.id==='newmark')return;
 const cov=catalogCoverage();const sy=S.sync;
 const pc=sy.running?pct(sy.done,sy.total):pct(cov.have,cov.total);
 const marks=S.settings.legalMarks;
 el.innerHTML=`
 <section class="panel-sec"><h2>Catálogo de cartas</h2>
  <p>${fmtN(cov.setsLoaded)} de ${fmtN(cov.sets)} coleções carregadas. ${fmtN(cov.have)} de ${fmtN(cov.total)} cartas com detalhes (tipo, raridade, ilustrador, marca, acabamentos). Os fichários por regra e o Master Set precisam desses detalhes. Os dados vêm da TCGdex e ficam guardados neste navegador.</p>
  <div class="prog" role="progressbar" aria-valuenow="${pc}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pc}%"></i></div>
  <p style="margin:0 0 12px">${sy.running?`Baixando: ${fmtN(sy.done)} de ${fmtN(sy.total)}${sy.fail?`, ${sy.fail} falharam`:''}. Pode navegar pelo app, mas mantenha esta aba aberta.`:(cov.total&&cov.have>=cov.total?'Catálogo completo.':'A primeira sincronização completa envolve milhares de pedidos e leva um tempo. Ela pode ser pausada e retomada; o que já foi baixado fica salvo. As coleções em que você tem cartas vão primeiro.')}</p>
  <div class="row">
   ${sy.running?`<button class="btn" type="button" data-act="sync-stop">Pausar</button>`:`<button class="btn primary" type="button" data-act="sync-start" ${cov.total&&cov.have>=cov.total?'disabled':''}>${cov.have?'Continuar sincronização':'Baixar detalhes das cartas'}</button>`}
   <button class="btn" type="button" data-act="retry-catalog">Atualizar lista de coleções</button>
   <button class="btn" type="button" data-act="reload-setd" ${S.status.pre?'disabled':''}>Recarregar dados das coleções</button>
  </div>
  ${S.status.catalog==='error'?noteHTML('err',`Falha ao acessar a TCGdex: ${esc(S.status.err)}.`):''}
  <p class="lbl2" style="margin-top:12px">${S.catalogAt?'Lista de coleções atualizada em '+new Date(S.catalogAt).toLocaleString('pt-BR')+'.':'A lista de coleções ainda não foi baixada.'}</p>
 </section>
 <section class="panel-sec"><h2>Minhas coleções</h2>
  <p>${fmtN(cov.sets)} ${cov.sets===1?'coleção escolhida':'coleções escolhidas'}. Só elas são baixadas e aparecem na tela inicial.</p>
  <a class="btn" href="#/expansoes">Escolher coleções</a>
 </section>
 <section class="panel-sec"><h2>Logos das coleções</h2>
  <p>Cada logo é procurado em vários endereços (catálogo, versão em inglês, montado pela série) e, se nada servir, aparece um bloco com o nome. O diagnóstico testa todas as coleções e lista as que ficaram sem logo e as que têm cartas sem imagem.</p>
  <div class="row"><button class="btn" type="button" data-act="check-logos" ${S.logoDiag&&S.logoDiag.running?'disabled':''}>${S.logoDiag&&S.logoDiag.running?`Verificando: ${S.logoDiag.done} de ${S.logoDiag.total}`:'Verificar logos'}</button></div>
  ${logoDiagHTML()}
 </section>
 <section class="panel-sec"><h2>Marcas legais no Standard</h2>
  <p>A legalidade é decidida pela marca impressa no canto inferior esquerdo de cada carta, nunca pela coleção. Edite a lista quando houver rotação; a regra “Legal no Standard” dos fichários passa a usar a nova lista na hora. Em 20/10/2026 valem H, I e J (e posteriores).</p>
  <div class="chips">${marks.map(m=>`<span class="mark">${esc(m)}<button type="button" data-act="rm-mark" data-v="${esc(m)}" aria-label="Remover marca ${esc(m)}">×</button></span>`).join('')||'<span class="lbl2">Nenhuma marca definida.</span>'}</div>
  <div class="row"><input class="field" id="newmark" maxlength="3" style="min-width:90px;width:90px" placeholder="Ex.: K" aria-label="Nova marca"><button class="btn" type="button" data-act="add-mark">Adicionar marca</button></div>
 </section>
 <section class="panel-sec"><h2>Contagem e exibição</h2>
  <label class="chk"><input type="checkbox" data-set="masterReverse" ${S.settings.masterReverse?'checked':''}> Master Set inclui o reverse holo de cada carta</label>
  <p style="margin:0 0 8px">Master Set aqui significa: todas as cartas da coleção, inclusive as secretas, em cada acabamento que existe (normal, holo e reverse holo). Promos e cartas com carimbo especial não entram.</p>
  <label class="chk"><input type="checkbox" data-set="showPocket" ${S.settings.showPocket?'checked':''}> Mostrar coleções do Pokémon TCG Pocket (jogo de celular)</label>
 </section>
 <section class="panel-sec" id="cloudsec">${cloudSection()}</section>
 <section class="panel-sec"><h2>Backup da coleção</h2>
  <p>${S.cloud.enabled?'Sua coleção já fica guardada na nuvem. O backup em arquivo é uma segunda cópia, para guardar por conta própria.':'Sua coleção e seus fichários ficam guardados só neste navegador. Exporte um arquivo de tempos em tempos para não perdê-los se limpar os dados do navegador ou trocar de computador.'}</p>
  <div class="row"><button class="btn" type="button" data-act="export">Exportar backup</button><label class="btn" style="cursor:pointer">Importar backup<input type="file" accept="application/json" id="imp" class="sr"></label></div>
 </section>
 <section class="panel-sec"><h2>Limpeza</h2>
  <p>Apaga só o catálogo baixado (coleções e detalhes das cartas). Sua coleção e seus fichários não são tocados.</p>
  <button class="btn danger" type="button" data-act="clear-cache">Limpar catálogo baixado</button>
 </section>
 <section class="panel-sec"><h2>Sobre</h2>
  <p>Aplicativo pessoal de gestão de coleção, não afiliado à The Pokémon Company. Nomes, ilustrações, logos e marcas pertencem aos seus donos. Dados e imagens são carregados da <strong>TCGdex</strong> (tcgdex.dev). Confira as licenças de dados e imagens antes de qualquer uso público ou comercial. Preços não são exibidos.</p>
 </section>`;
}
function logoDiagHTML(){
 const d=S.logoDiag;if(!d||d.running||!d.total)return '';
 let h='';
 if(!d.missing.length)h+=noteHTML('',`Todos os ${d.total} logos foram encontrados${d.viaAlt?`; ${d.viaAlt} só por um endereço alternativo`:''}.`);
 else h+=noteHTML('warn',`${d.missing.length} de ${d.total} coleções ficaram sem logo${d.viaAlt?` (${d.viaAlt} outras foram resolvidas por endereço alternativo)`:''}. Elas aparecem como um bloco com o nome e a cor da série. Coleções afetadas:<br>${d.missing.map(m=>`<a href="#/set/${encodeURIComponent(m.id)}">${esc(m.name)}</a>`).join(' · ')}`);
 if(d.noCards&&d.noCards.length)h+=noteHTML('warn',`${d.noCards.length} ${d.noCards.length===1?'coleção tem':'coleções têm'} cartas sem imagem na TCGdex (a fonte não tem a arte). Elas aparecem como um cartão com nome e número; em cada carta, o painel de detalhes tem <strong>Enviar foto da carta</strong>:<br>${d.noCards.map(m=>`<a href="#/set/${encodeURIComponent(m.id)}">${esc(m.name)}</a> (${m.miss} de ${m.total})`).join(' · ')}`);
 else if(d.unknownCards===d.total)h+=noteHTML('',`Ainda não há listas de cartas baixadas para checar as imagens das cartas.`);
 if(d.unknownCards&&d.unknownCards<d.total)h+=noteHTML('',`As imagens das cartas só foram conferidas nas coleções já carregadas (${d.total-d.unknownCards} de ${d.total}).`);
 return h;
}
export function exportBackup(){
 const data={app:'pokedex-tcg',version:1,exportedAt:new Date().toISOString(),collection:S.collection,binders:S.binders,trades:S.trades,decks:S.decks,settings:S.settings,custom:S.custom};
 const a=document.createElement('a');
 a.href=URL.createObjectURL(new Blob([JSON.stringify(data)],{type:'application/json'}));
 a.download=`pokedex-backup-${new Date().toISOString().slice(0,10)}.json`;
 document.body.appendChild(a);a.click();a.remove();
}
export async function importBackup(file){
 try{
  const d=JSON.parse(await file.text());
  if(d.app!=='pokedex-tcg'||!d.collection)throw new Error('formato');
  if(!confirm(`Substituir a coleção atual pelo backup? O backup tem ${Object.keys(d.collection).length} cartas e ${(d.binders||[]).length} fichários.`))return;
  await DB.clear('coll');
  S.collection=d.collection;
  for(const id in S.collection)await DB.put('coll',id,S.collection[id]);
  S.binders=d.binders||[];await saveBinders();
  S.trades=d.trades||[];await saveTrades();
  S.decks=d.decks||[];await saveDecks();
  Object.assign(S.settings,d.settings||{});await saveSettings();
  if(d.custom){S.custom=Object.assign({logos:{},cards:{},covers:{}},d.custom);await saveKV('custom',S.custom);}
  toast('Backup importado.');H.route();
 }catch(e){toast('Esse arquivo não parece ser um backup deste app.');}
}
