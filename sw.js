const CACHE='samee3-static-v1';
const ASSETS=['./','./index.html','./src/styles.css','./src/app.js','./src/quran.js','./src/mp3quran.js','./src/content.js','./src/prayer.js','./src/storage.js','./src/firebase.js','./manifest.webmanifest'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(caches.match(e.request).then(c=>c||fetch(e.request).then(r=>{const u=new URL(e.request.url);if(u.origin===location.origin){const copy=r.clone();caches.open(CACHE).then(x=>x.put(e.request,copy));}return r}).catch(()=>c)));});
