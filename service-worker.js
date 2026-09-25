const CACHE_NAME="bestiariusz-v31";
const APP_SHELL=["./","./index.html","./style.css","./overrides.css?v=31","./app.js?v=31","./state.js?v=31","./heroes.js?v=31","./heroes.css?v=31","./map.js?v=31","./map.css?v=31","./vendor/Sortable.min.js","./manifest.webmanifest","./icons/icon.svg"];
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(APP_SHELL)).then(()=>self.skipWaiting())));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE_NAME).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET"||new URL(event.request.url).origin!==self.location.origin)return;
  event.respondWith(fetch(event.request).then(response=>{
    if(response.ok)caches.open(CACHE_NAME).then(cache=>cache.put(event.request,response.clone()));
    return response;
  }).catch(()=>caches.match(event.request).then(cached=>cached||(event.request.mode==="navigate"?caches.match("./"):Response.error()))));
});
