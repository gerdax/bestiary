const CACHE_NAME="bestiariusz-v86";
const DICE_ASSETS=["./dice-roller.css?v=85","./dice-rules.js?v=78","./dice-engine.js?v=81","./dice-roller.js?v=86","./vendor/dice-box/Dice.js","./vendor/dice-box/assets/ammo/ammo.wasm.wasm","./vendor/dice-box/assets/themes/default/default.json","./vendor/dice-box/assets/themes/default/diffuse-dark.png","./vendor/dice-box/assets/themes/default/diffuse-light.png","./vendor/dice-box/assets/themes/default/normal.png","./vendor/dice-box/assets/themes/default/specular.jpg","./vendor/dice-box/assets/themes/default/theme.config.json","./vendor/dice-box/assets/themes/tor-enemy/symbols.png","./vendor/dice-box/assets/themes/tor-enemy/theme.config.json","./vendor/dice-box/assets/themes/tor-hero/symbols.png","./vendor/dice-box/assets/themes/tor-hero/theme.config.json","./vendor/dice-box/dice-box.es.js","./vendor/dice-box/world.none.js","./vendor/dice-box/world.offscreen.js","./vendor/dice-box/world.onscreen.js"];
const APP_SHELL=["./","./index.html","./style.css","./overrides.css?v=69","./app.js?v=72","./state.js?v=72","./heroes.js?v=63","./heroes.css?v=63","./map.js?v=73","./map.css?v=73","./vendor/Sortable.min.js","./manifest.webmanifest","./icons/icon.svg"];
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll([...APP_SHELL,...DICE_ASSETS])).then(()=>self.skipWaiting())));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE_NAME).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET"||new URL(event.request.url).origin!==self.location.origin)return;
  event.respondWith(fetch(event.request).then(response=>{
    if(response.ok)caches.open(CACHE_NAME).then(cache=>cache.put(event.request,response.clone()));
    return response;
  }).catch(()=>caches.match(event.request).then(cached=>cached||(event.request.mode==="navigate"?caches.match("./"):Response.error()))));
});
