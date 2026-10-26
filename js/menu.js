/* Menu retrátil: em celular/tablet deitado, o menu lateral some e abre pelo botão ☰. */
const btn=document.getElementById('menubtn'),scrim=document.getElementById('menuscrim');
const set=on=>{
 document.body.classList.toggle('menu-open',on);
 if(btn){btn.setAttribute('aria-expanded',on?'true':'false');btn.setAttribute('aria-label',on?'Fechar o menu':'Abrir o menu');btn.textContent=on?'✕':'☰';}
};
if(btn){
 btn.addEventListener('click',()=>set(!document.body.classList.contains('menu-open')));
 scrim.addEventListener('click',()=>set(false));
 document.querySelector('.rail').addEventListener('click',e=>{if(e.target.closest('a.nav, .brand'))set(false);});
 addEventListener('hashchange',()=>set(false));
 addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.classList.contains('menu-open'))set(false);});
 /* ao voltar para a posição em pé, o menu normal reaparece e o estado de gaveta é desfeito */
 const mq=matchMedia('(orientation: portrait)');
 const off=()=>set(false);
 if(mq.addEventListener)mq.addEventListener('change',off);
}
