/* Service worker simples: guarda o próprio app para abrir sem internet. Sempre tenta a rede primeiro,
   então atualizações publicadas aparecem na hora; o cache só serve quando a rede falha. */
const V='pokedex-shell-v26';
const LIB=/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@/;
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>{
 e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',e=>{
 const r=e.request;
 if(r.method!=='GET')return;
 const u=new URL(r.url);
 if(LIB.test(r.url)){
  e.respondWith(fetch(r).then(res=>{if(res.ok){const c=res.clone();caches.open(V).then(ca=>ca.put(r,c));}return res;}).catch(()=>caches.match(r)));
  return;
 }
 if(u.origin!==location.origin)return;
 e.respondWith(
  fetch(r).then(res=>{
   if(res.ok){const c=res.clone();caches.open(V).then(ca=>ca.put(r,c));}
   return res;
  }).catch(()=>caches.match(r).then(m=>m||caches.match('index.html')))
 );
});
