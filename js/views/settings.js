/* Tela de catálogo e ajustes, backup. */
import {catalogCoverage} from '../catalog.js';
import {DB, saveBinders, saveSettings} from '../db.js';
import {H, S, soft} from '../state.js';
import {noteHTML, toast} from '../ui.js';
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
  <p>${fmtN(cov.setsLoaded)} de ${fmtN(cov.sets)} expansões carregadas. ${fmtN(cov.have)} de ${fmtN(cov.total)} cartas com detalhes (tipo, raridade, ilustrador, marca, acabamentos). Os fichários por regra e o Master Set precisam desses detalhes. Os dados vêm da TCGdex e ficam guardados neste navegador.</p>
  <div class="prog" role="progressbar" aria-valuenow="${pc}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pc}%"></i></div>
  <p style="margin:0 0 12px">${sy.running?`Baixando: ${fmtN(sy.done)} de ${fmtN(sy.total)}${sy.fail?`, ${sy.fail} falharam`:''}. Pode navegar pelo app, mas mantenha esta aba aberta.`:(cov.total&&cov.have>=cov.total?'Catálogo completo.':'A primeira sincronização completa envolve milhares de pedidos e leva um tempo. Ela pode ser pausada e retomada; o que já foi baixado fica salvo. As expansões em que você tem cartas vão primeiro.')}</p>
  <div class="row">
   ${sy.running?`<button class="btn" type="button" data-act="sync-stop">Pausar</button>`:`<button class="btn primary" type="button" data-act="sync-start" ${cov.total&&cov.have>=cov.total?'disabled':''}>${cov.have?'Continuar sincronização':'Baixar detalhes das cartas'}</button>`}
   <button class="btn" type="button" data-act="retry-catalog">Atualizar lista de expansões</button>
   <button class="btn" type="button" data-act="reload-setd" ${S.status.pre?'disabled':''}>Recarregar dados das expansões</button>
  </div>
  ${S.status.catalog==='error'?noteHTML('err',`Falha ao acessar a TCGdex: ${esc(S.status.err)}.`):''}
  <p class="lbl2" style="margin-top:12px">${S.catalogAt?'Lista de expansões atualizada em '+new Date(S.catalogAt).toLocaleString('pt-BR')+'.':'A lista de expansões ainda não foi baixada.'}</p>
 </section>
 <section class="panel-sec"><h2>Minhas expansões</h2>
  <p>${fmtN(cov.sets)} ${cov.sets===1?'expansão escolhida':'expansões escolhidas'}. Só elas são baixadas e aparecem na tela inicial.</p>
  <a class="btn" href="#/expansoes">Escolher expansões</a>
 </section>
 <section class="panel-sec"><h2>Logos das expansões</h2>
  <p>Cada logo é procurado em vários endereços (catálogo, versão em inglês, montado pela série) e, se nada servir, aparece o símbolo ou o nome. O diagnóstico testa todas as expansões e lista as que ficaram sem logo.</p>
  <div class="row"><button class="btn" type="button" data-act="check-logos" ${S.logoDiag&&S.logoDiag.running?'disabled':''}>${S.logoDiag&&S.logoDiag.running?`Verificando: ${S.logoDiag.done} de ${S.logoDiag.total}`:'Verificar logos'}</button></div>
  ${logoDiagHTML()}
 </section>
 <section class="panel-sec"><h2>Marcas legais no Standard</h2>
  <p>A legalidade é decidida pela marca impressa no canto inferior esquerdo de cada carta, nunca pela expansão. Edite a lista quando houver rotação; a regra “Legal no Standard” dos fichários passa a usar a nova lista na hora. Em 20/10/2026 valem H, I e J (e posteriores).</p>
  <div class="chips">${marks.map(m=>`<span class="mark">${esc(m)}<button type="button" data-act="rm-mark" data-v="${esc(m)}" aria-label="Remover marca ${esc(m)}">×</button></span>`).join('')||'<span class="lbl2">Nenhuma marca definida.</span>'}</div>
  <div class="row"><input class="field" id="newmark" maxlength="3" style="min-width:90px;width:90px" placeholder="Ex.: K" aria-label="Nova marca"><button class="btn" type="button" data-act="add-mark">Adicionar marca</button></div>
 </section>
 <section class="panel-sec"><h2>Contagem e exibição</h2>
  <label class="chk"><input type="checkbox" data-set="masterReverse" ${S.settings.masterReverse?'checked':''}> Master Set inclui o reverse holo de cada carta</label>
  <p style="margin:0 0 8px">Master Set aqui significa: todas as cartas da expansão, inclusive as secretas, em cada acabamento que existe (normal, holo e reverse holo). Promos e cartas com carimbo especial não entram.</p>
  <label class="chk"><input type="checkbox" data-set="showPocket" ${S.settings.showPocket?'checked':''}> Mostrar expansões do Pokémon TCG Pocket (jogo de celular)</label>
 </section>
 <section class="panel-sec"><h2>Backup da coleção</h2>
  <p>Sua coleção e seus fichários ficam guardados só neste navegador. Exporte um arquivo de tempos em tempos para não perdê-los se limpar os dados do navegador ou trocar de computador.</p>
  <div class="row"><button class="btn" type="button" data-act="export">Exportar backup</button><label class="btn" style="cursor:pointer">Importar backup<input type="file" accept="application/json" id="imp" class="sr"></label></div>
 </section>
 <section class="panel-sec"><h2>Limpeza</h2>
  <p>Apaga só o catálogo baixado (expansões e detalhes das cartas). Sua coleção e seus fichários não são tocados.</p>
  <button class="btn danger" type="button" data-act="clear-cache">Limpar catálogo baixado</button>
 </section>
 <section class="panel-sec"><h2>Sobre</h2>
  <p>Aplicativo pessoal de gestão de coleção, não afiliado à The Pokémon Company. Nomes, ilustrações, logos e marcas pertencem aos seus donos. Dados e imagens são carregados da <strong>TCGdex</strong> (tcgdex.dev). Confira as licenças de dados e imagens antes de qualquer uso público ou comercial. Preços não são exibidos.</p>
 </section>`;
}
function logoDiagHTML(){
 const d=S.logoDiag;if(!d||d.running||!d.total)return '';
 if(!d.missing.length)return noteHTML('',`Todos os ${d.total} logos foram encontrados${d.viaAlt?`; ${d.viaAlt} só por um endereço alternativo`:''}.`);
 return noteHTML('warn',`${d.missing.length} de ${d.total} expansões ficaram sem logo${d.viaAlt?` (${d.viaAlt} outras foram resolvidas por endereço alternativo)`:''}. Elas aparecem com o símbolo ou o nome:<br>${d.missing.map(m=>esc(m.name)+(m.hasSymbol?'':' (sem símbolo)')).join(' · ')}`);
}
export function exportBackup(){
 const data={app:'pokedex-tcg',version:1,exportedAt:new Date().toISOString(),collection:S.collection,binders:S.binders,settings:S.settings};
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
  Object.assign(S.settings,d.settings||{});await saveSettings();
  toast('Backup importado.');H.route();
 }catch(e){toast('Esse arquivo não parece ser um backup deste app.');}
}
