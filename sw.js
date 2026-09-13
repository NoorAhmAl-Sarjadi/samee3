const STATIC='samee3-static-v1';
const AUDIO='samee3-audio-v1';
const APP_SHELL=['./','./index.html','./src/app.js','./src/styles.css','./src/firebase.js','./manifest.webmanifest','./icons/samee3-logo.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(STATIC).then(c=>c.addAll(APP_SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',e=>{
  const url=new URL(e.request.url);
  if(url.origin===location.origin){
    e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(res=>{const cp=res.clone();caches.open(STATIC).then(c=>c.put(e.request,cp));return res}).catch(()=>caches.match('./index.html'))));
    return;
  }
  if(url.hostname.includes('mp3quran.net') && /\.mp3(?:\?|$)/.test(url.pathname)){
    e.respondWith(caches.open(AUDIO).then(c=>c.match(e.request).then(r=>r||fetch(e.request).then(res=>{c.put(e.request,res.clone());return res}))));
  }
});
