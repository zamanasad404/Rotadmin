self.addEventListener('install', e=>{
  e.waitUntil(
    caches.open('trp-v1').then(cache=>cache.addAll([
      './',
      './index.html',
      './styles.css',
      './app.js',
      './manifest.webmanifest',
      './icons/icon-192.png',
      './icons/icon-512.png'
    ]))
  );
});
self.addEventListener('activate', e=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(k=>!k.startsWith('trp-v1')).map(k=>caches.delete(k))))
  );
});
self.addEventListener('fetch', e=>{
  const req = e.request;
  if(req.method !== 'GET'){ return; }
  e.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(res=>{
      const copy = res.clone();
      caches.open('trp-v1').then(cache=>cache.put(req, copy));
      return res;
    }).catch(()=>caches.match('./index.html')))
  );
});
