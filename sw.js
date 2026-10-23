/* Olho no Território – funcionamento sem internet */
const SHELL="ot-app-v2", DADOS="ot-dados-v1", EXT="ot-ext-v1";
const SHELL_FILES=["./","index.html","instalar.html","app.js","config.js","manifest.webmanifest","icons/icon-192.png","icons/icon-512.png","d/base.json","d/lu/overview.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(SHELL).then(c=>c.addAll(SHELL_FILES.filter(f=>!f.startsWith("d/")))).then(()=>caches.open(DADOS)).then(c=>c.addAll(["d/base.json","d/lu/overview.png"])).then(()=>self.skipWaiting()));});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>![SHELL,DADOS,EXT].includes(k)).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
async function cacheFirst(req,name){const c=await caches.open(name);const hit=await c.match(req,{ignoreSearch:true});if(hit)return hit;const r=await fetch(req);if(r&&(r.ok||r.type==="opaque"))c.put(req,r.clone());return r;}
async function networkFirst(req){const c=await caches.open(SHELL);try{const r=await fetch(req);if(r&&r.ok)c.put(req,r.clone());return r;}catch(e){const hit=await c.match(req,{ignoreSearch:true})||(req.mode==="navigate"?await c.match("index.html"):null);if(hit)return hit;throw e;}}
self.addEventListener("fetch",e=>{const req=e.request;if(req.method!=="GET")return;const u=new URL(req.url);
  if(u.hostname.endsWith("script.google.com")||u.hostname.endsWith("googleusercontent.com"))return;
  if(u.origin===location.origin){if(u.pathname.includes("/d/"))e.respondWith(cacheFirst(req,DADOS));else e.respondWith(networkFirst(req));return;}
  if(/cdnjs\.cloudflare\.com|fonts\.googleapis\.com|fonts\.gstatic\.com/.test(u.hostname))e.respondWith(cacheFirst(req,EXT));});
