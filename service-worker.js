const CACHE='homebound-home-journey-v4-family-hero';
const ASSETS=['./','./index.html','./styles.css?v=5','./app.js?v=6','./manifest.webmanifest','./assets/homebound-icon-180.png','./assets/homebound-icon-192.png','./assets/homebound-icon-512.png','./assets/home-hero-static.jpg'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;event.respondWith(fetch(event.request).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));return response}).catch(()=>caches.match(event.request).then(hit=>hit||caches.match('./index.html'))))});
