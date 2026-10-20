/* Tela de entrada (login) e bloco da conta no menu. */
import {DB} from '../db.js';
import {S} from '../state.js';
import {$, esc} from '../util.js';
import {doSignOut, enabled, hasLocalData, onCloud, pendingCount, resetPassword, setNewPassword, signIn, signOut, signUp, startSession, syncNow} from '../cloud.js';
import {exportBackup} from './settings.js';
import {toast} from '../ui.js';

const STATE_TXT={idle:'Sincronizado',syncing:'Sincronizando…',offline:'Sem conexão. Alterações guardadas.',error:'Erro ao sincronizar',off:'Somente neste aparelho',out:''};
let mode='in';let onDone=null;

export function friendly(e){
 const m=String((e&&e.message)||e||'');
 if(/invalid login|invalid credentials/i.test(m))return'E-mail ou senha incorretos.';
 if(/not confirmed/i.test(m))return'Confirme seu e-mail primeiro: abra a mensagem que enviamos e clique no link.';
 if(/signups? (not allowed|are disabled|disabled)|signup_disabled/i.test(m))return'Novos cadastros estão desativados neste app.';
 if(/already registered|already been registered|user_already_exists/i.test(m))return'Este e-mail já tem conta. Use “Entrar”.';
 if(/rate limit|too many|over_email_send_rate_limit/i.test(m))return'Muitas tentativas. Aguarde um pouco e tente de novo.';
 if(/password.*(short|least|weak)/i.test(m))return'A senha é fraca. Use ao menos 8 caracteres.';
 if(/fetch|network|failed/i.test(m))return'Sem conexão com o servidor. Verifique a internet.';
 return'Não consegui concluir: '+m;
}

function host(){
 let el=$('#auth');
 if(!el){el=document.createElement('div');el.id='auth';el.className='auth';document.body.appendChild(el);}
 return el;
}
function formHTML(){
 const rec=S.cloud.recovery;
 if(rec)return`<h2>Nova senha</h2><p class="lead">Escolha a nova senha da sua conta.</p>
  <form data-auth-form="newpass" novalidate><label class="lbl2" for="au-pw">Nova senha (8 caracteres ou mais)</label>
  <input class="field" id="au-pw" type="password" autocomplete="new-password" required minlength="8">
  <div class="aerr" id="au-err" role="alert"></div><button class="btn primary" type="submit">Salvar nova senha</button></form>`;
 if(mode==='reset')return`<h2>Recuperar a senha</h2><p class="lead">Digite o e-mail da sua conta. Enviaremos um link para criar uma nova senha.</p>
  <form data-auth-form="reset" novalidate><label class="lbl2" for="au-em">E-mail</label>
  <input class="field" id="au-em" type="email" autocomplete="email" required>
  <div class="aerr" id="au-err" role="alert"></div><button class="btn primary" type="submit">Enviar link</button>
  <button class="linkbtn" type="button" data-auth-mode="in">Voltar para entrar</button></form>`;
 const up=mode==='up';
 return`<div class="atabs" role="tablist"><button type="button" role="tab" aria-selected="${!up}" data-auth-mode="in">Entrar</button><button type="button" role="tab" aria-selected="${up}" data-auth-mode="up">Criar conta</button></div>
  <form data-auth-form="${up?'signup':'signin'}" novalidate>
  <label class="lbl2" for="au-em">E-mail</label><input class="field" id="au-em" type="email" autocomplete="email" required>
  <label class="lbl2" for="au-pw">Senha${up?' (8 caracteres ou mais)':''}</label><input class="field" id="au-pw" type="password" autocomplete="${up?'new-password':'current-password'}" required ${up?'minlength="8"':''}>
  <div class="aerr" id="au-err" role="alert"></div>
  <button class="btn primary" type="submit">${up?'Criar conta':'Entrar'}</button>
  ${up?'':'<button class="linkbtn" type="button" data-auth-mode="reset">Esqueci minha senha</button>'}</form>`;
}
export function showAuth(done){
 if(done)onDone=done;
 const el=host();
 el.innerHTML=`<div class="acard"><img src="assets/logo-pokemon-tcg.png" alt="Pokémon Trading Card Game" width="260" height="133">
  <p class="asub">Minha coleção de cartas</p><div id="aform">${formHTML()}</div>
  <p class="afoot">App pessoal, não afiliado à The Pokémon Company.</p></div>`;
 el.classList.add('on');document.body.classList.add('locked');
 setTimeout(()=>{const f=$('#au-em')||$('#au-pw');if(f)f.focus();},30);
}
export function hideAuth(){const el=$('#auth');if(el){el.classList.remove('on');el.innerHTML='';}document.body.classList.remove('locked');}
function busyUI(on,text){
 const el=$('#aform');if(!el)return;
 el.querySelectorAll('button,input').forEach(x=>x.disabled=on);
 const b=el.querySelector('button[type=submit]');if(b&&text){b.dataset.t=b.dataset.t||b.textContent;b.textContent=on?text:b.dataset.t;}
}
function showErr(msg,ok){const e=$('#au-err');if(e){e.textContent=msg;e.classList.toggle('ok',!!ok);}}
function loading(msg){
 const el=host();el.classList.add('on');document.body.classList.add('locked');
 el.innerHTML=`<div class="acard"><img src="assets/logo-pokemon-tcg.png" alt="" width="260" height="133"><p class="asub" role="status">${esc(msg)}</p></div>`;
}

async function afterSignIn(session){
 loading('Sincronizando sua coleção…');
 /* primeiro vínculo neste aparelho com dados locais: guarda um backup antes de juntar */
 try{
  const m=await DB.get('kv','cloud');
  if((!m||m.uid!==session.user.id)&&hasLocalData()){exportBackup();toast('Baixei um backup do que estava neste aparelho, por segurança.');}
 }catch(e){}
 await startSession(session);
 hideAuth();
 if(onDone)onDone();
}

document.addEventListener('submit',async e=>{
 const f=e.target.closest&&e.target.closest('[data-auth-form]');if(!f)return;
 e.preventDefault();
 const kind=f.dataset.authForm;
 const email=(($('#au-em')||{}).value||'').trim();const pw=($('#au-pw')||{}).value||'';
 showErr('');
 try{
  if(kind==='newpass'){
   if(pw.length<8)return showErr('Use ao menos 8 caracteres.');
   busyUI(true,'Salvando…');await setNewPassword(pw);
   busyUI(false);showErr('Senha alterada. Você já pode usar o app.',true);
   setTimeout(()=>{S.cloud.recovery=false;location.hash='#/';location.reload();},900);return;
  }
  if(kind==='reset'){
   if(!email)return showErr('Digite o seu e-mail.');
   busyUI(true,'Enviando…');await resetPassword(email);busyUI(false);
   showErr('Se este e-mail tem conta, o link chegará em instantes. Veja também a caixa de spam.',true);return;
  }
  if(!email||!pw)return showErr('Preencha o e-mail e a senha.');
  if(kind==='signup'&&pw.length<8)return showErr('Use ao menos 8 caracteres na senha.');
  busyUI(true,kind==='signup'?'Criando…':'Entrando…');
  if(kind==='signup'){
   const session=await signUp(email,pw);
   if(session){await afterSignIn(session);return;}
   busyUI(false);showErr('Conta criada. Enviamos um e-mail de confirmação: abra a mensagem, clique no link e depois volte para entrar.',true);return;
  }
  const session=await signIn(email,pw);
  await afterSignIn(session);
 }catch(err){busyUI(false);showErr(friendly(err));}
});
document.addEventListener('click',async e=>{
 const m=e.target.closest&&e.target.closest('[data-auth-mode]');
 if(m){mode=m.dataset.authMode;const af=$('#aform');if(af){af.innerHTML=formHTML();const f=$('#au-em');if(f)f.focus();}return;}
 const c=e.target.closest&&e.target.closest('[data-cloud]');if(!c)return;
 const a=c.dataset.cloud;
 if(a==='sync'){syncNow();return;}
 if(a==='out'){
  if(!confirm('Sair desta conta?\n\nOs dados deste aparelho serão apagados (eles continuam guardados na nuvem). Você poderá entrar de novo quando quiser.'))return;
  const r=await signOut();
  if(!r.ok){
   if(!confirm(`Ainda há ${r.pending} alteração(ões) que não foram enviadas (talvez sem internet). Se sair agora, elas serão perdidas.\n\nSair mesmo assim?`))return;
   await doSignOut();
  }
  location.hash='#/';location.reload();
 }
});

/* ---------- bloco da conta no menu e em Ajustes ---------- */
export function acctHTML(){
 const c=S.cloud;
 return`<div class="acct-mail" title="${esc(c.email)}">${esc(c.email)}</div>
  <div class="acct-st ${c.state}"><i class="dot"></i><span>${esc(STATE_TXT[c.state]||'')}</span></div>
  <button class="btn small" type="button" data-cloud="out">Sair</button>`;
}
export function updateAcct(){
 const a=$('#acct');
 const show=S.cloud.enabled&&S.cloud.email&&S.cloud.state!=='out';
 if(a){a.hidden=!show;if(show)a.innerHTML=acctHTML();}
 const s=$('#cloudsec');
 if(s)s.innerHTML=cloudSection();
}
export function cloudSection(){
 const c=S.cloud;
 if(!c.enabled)return`<h2>Conta e sincronização</h2><p>A sincronização na nuvem ainda não está ligada neste app. Seus dados ficam só neste navegador; use o backup abaixo.</p>`;
 const last=c.last?new Date(c.last).toLocaleString('pt-BR'):'ainda não';
 return`<h2>Conta e sincronização</h2>
  <p>Conectado como <strong>${esc(c.email)}</strong>. Sua coleção, seus fichários, seus ajustes e suas imagens ficam guardados na sua conta e aparecem em qualquer aparelho em que você entrar.</p>
  <p class="acct-st ${c.state}" style="margin:0 0 10px"><i class="dot"></i><span>${esc(STATE_TXT[c.state]||'')}</span> <small style="color:var(--ink-3)">Última sincronização: ${esc(last)}</small></p>
  ${c.state==='error'?`<div class="note err">${esc(c.error||'')}</div>`:''}
  <div class="row"><button class="btn" type="button" data-cloud="sync">Sincronizar agora</button><button class="btn" type="button" data-cloud="out">Sair da conta</button></div>`;
}
onCloud(updateAcct);

export {enabled,pendingCount};
