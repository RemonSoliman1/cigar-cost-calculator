const CACHE='cigar-calc-v3';
const APP_SHELL=['./','./index.html','./manifest.webmanifest'];

self.addEventListener('install',event=>{
  event.waitUntil(
    caches.open(CACHE).then(cache=>cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys().then(keys=>Promise.all(
      keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))
    )).then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(url.pathname.startsWith('/api/')) return;
  if(event.request.method!=='GET') return;

  // Always try the network first for the app itself so GitHub/Vercel updates
  // are reflected in the installed PWA instead of leaving users on an old UI.
  const isAppAsset=url.origin===self.location.origin &&
    (event.request.mode==='navigate' || /\.(html|js|css|webmanifest)$/.test(url.pathname));

  if(isAppAsset){
    event.respondWith(
      fetch(event.request,{cache:'no-store'})
        .then(response=>{
          const copy=response.clone();
          caches.open(CACHE).then(cache=>cache.put(event.request,copy));
          return response;
        })
        .catch(()=>caches.match(event.request).then(response=>response||caches.match('./index.html')))
    );
    return;
  }

  // Cache other GET requests after the first successful network response.
  event.respondWith(
    caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{
      const copy=response.clone();
      caches.open(CACHE).then(cache=>cache.put(event.request,copy));
      return response;
    }))
  );
});
