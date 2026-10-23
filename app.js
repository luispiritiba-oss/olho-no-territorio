(function(){
"use strict";
const DATA_URL = "d/";
const X0 = -47, Y0 = -19;
const VIEW_BA = {w:-46.8, e:-37.2, s:-18.5, n:-8.4};
const KXf = lat => 111.32*Math.cos(lat*Math.PI/180), KY = 110.57;
let KX = KXf(12.5);

/* ---------- helpers ---------- */
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const fmtN = (n,dig=0) => Number(n||0).toLocaleString("pt-BR",{maximumFractionDigits:dig});
const fmtKm = d => d<1 ? Math.round(d*1000)+" m" : (d<10 ? d.toFixed(1).replace(".",",") : Math.round(d))+" km";
const pf = v => (v<1&&v>0 ? "<1" : Math.round(v))+"%";
function dec(s){ return s.split("|").map(part=>{const v=part.split(",");let x=0,y=0;const r=new Array(v.length/2);for(let i=0,k=0;i<v.length;i+=2,k++){x+=+v[i];y+=+v[i+1];r[k]=[X0+x/1e4,Y0+y/1e4];}return r;}); }
function bboxR(rings){let w=1e9,e=-1e9,s=1e9,n=-1e9;for(const r of rings)for(const [x,y] of r){if(x<w)w=x;if(x>e)e=x;if(y<s)s=y;if(y>n)n=y;}return {w,e,s,n};}
function inRing(x,y,r){let c=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const xi=r[i][0],yi=r[i][1],xj=r[j][0],yj=r[j][1];if(((yi>y)!==(yj>y))&&(x<(xj-xi)*(y-yi)/(yj-yi)+xi))c=!c;}return c;}
function inPoly(x,y,rings){let c=false;for(const r of rings)if(inRing(x,y,r))c=!c;return c;}
function segD(px,py,ax,ay,bx,by){const kx=KXf(py);const X=(px-ax)*kx,Y=(py-ay)*KY,U=(bx-ax)*kx,V=(by-ay)*KY;const L=U*U+V*V;let t=L?(X*U+Y*V)/L:0;t=Math.max(0,Math.min(1,t));return Math.hypot(X-t*U,Y-t*V);}
function lineD(x,y,paths){let m=1e9;for(const p of paths)for(let i=1;i<p.length;i++){const d=segD(x,y,p[i-1][0],p[i-1][1],p[i][0],p[i][1]);if(d<m)m=d;}return m;}
function polyD(x,y,rings){if(inPoly(x,y,rings))return 0;let m=1e9;for(const r of rings)for(let i=0;i<r.length;i++){const a=r[i],b=r[(i+1)%r.length];const d=segD(x,y,a[0],a[1],b[0],b[1]);if(d<m)m=d;}return m;}
function ptD(x,y,p){return Math.hypot((p[0]-x)*KXf(y),(p[1]-y)*KY);}
function bbD(bb,x,y){const dx=x<bb.w?bb.w-x:(x>bb.e?x-bb.e:0),dy=y<bb.s?bb.s-y:(y>bb.n?y-bb.n:0);return Math.hypot(dx*KXf(y),dy*KY);}
// lazy geometry: objects carry .g (encoded); rings decoded once on demand
function geo(o){ if(!o.r){o.r=dec(o.g);o.bb=o.bb||bboxR(o.r);} return o.r; }
function mkFeat(o){ o.r=dec(o.g); o.bb=bboxR(o.r); return o; }
function mkPt(o){ const p=dec(o.g)[0][0]; o.p=p; o.bb={w:p[0],e:p[0],s:p[1],n:p[1]}; return o; }

/* ---------- plain-language dictionaries ---------- */
const FASE = {
  "REQUERIMENTO DE PESQUISA":      {st:"pp", txt:"Pedido para pesquisar o subsolo. Ainda não foi autorizado."},
  "AUTORIZAÇÃO DE PESQUISA":       {st:"pe", txt:"Pesquisa autorizada. A empresa pode estudar o subsolo, fazer sondagens e abrir trilhas."},
  "DIREITO DE REQUERER A LAVRA":   {st:"px", txt:"A pesquisa foi aprovada. O titular pode pedir para começar a extrair."},
  "REQUERIMENTO DE LAVRA":         {st:"px", txt:"Pedido para começar a extrair o minério (abrir mina)."},
  "CONCESSÃO DE LAVRA":            {st:"ex", txt:"Mina autorizada a extrair o minério."},
  "REQUERIMENTO DE LAVRA GARIMPEIRA": {st:"px", txt:"Pedido para abrir garimpo."},
  "LAVRA GARIMPEIRA":              {st:"ex", txt:"Garimpo autorizado a extrair."},
  "REQUERIMENTO DE LICENCIAMENTO": {st:"px", txt:"Pedido para extrair material de construção (areia, brita, argila, pedra)."},
  "LICENCIAMENTO":                 {st:"ex", txt:"Extração de material de construção autorizada."},
  "REQUERIMENTO DE REGISTRO DE EXTRAÇÃO": {st:"px", txt:"Pedido de órgão público para extrair material de construção para obra pública."},
  "REGISTRO DE EXTRAÇÃO":          {st:"ex", txt:"Extração de material para obra pública autorizada."},
  "APTO PARA DISPONIBILIDADE":     {st:"di", txt:"Área devolvida à ANM. Pode ser oferecida a novos interessados."},
  "DISPONIBILIDADE":               {st:"di", txt:"Área em oferta pela ANM para novos interessados."}
};
const STAGE = { ex:{n:"Extração autorizada",c:"#9c0027"}, px:{n:"Pedido para extrair",c:"#e05a1c"}, pe:{n:"Pesquisa autorizada",c:"#d99a1e"}, pp:{n:"Pedido de pesquisa",c:"#b9a94a"}, di:{n:"Área em oferta (disponibilidade)",c:"#8b8f9a"} };
const stOf = f => (FASE[f]||{st:"pe"}).st;
const ENFASE = {
  "Operação":{c:"#1f4fbf",txt:"Em operação, gerando energia."},
  "Construção":{c:"#3d6ee0",txt:"Em construção."},
  "Construção não iniciada":{c:"#5d82f0",txt:"Já tem autorização (outorga), mas a obra ainda não começou."},
  "DRO":{c:"#9fb1f5",txt:"Fase inicial: o pedido de outorga foi registrado na ANEEL (DRO). Pode ou não virar projeto."},
  "Expansão planejada":{c:"#9fb1f5",txt:"Previsto no planejamento da EPE ou contratado em leilão; ainda não está operando."}
};
const enTxt = f => (ENFASE[f]||{txt:f||"Fase não informada."}).txt;
const enCol = f => (ENFASE[f]||{c:"#9fb1f5"}).c;
const titular = n => n==="#PF" ? "Pessoa física (nome não exibido)" : (n||"Não informado na base");
const TIPOS = ["Fundo e fecho de pasto","Quilombola","Indígena","Pescadores artesanais","Marisqueiras","Ribeirinha","Geraizeira","Extrativista","Assentamento","Outra comunidade tradicional"];
const REGTIPOS = ["Mineração ou garimpo","Parque eólico ou solar","Linha de transmissão","Desmatamento ou queimada","Cerca ou grilagem","Água (barragem, poço, rio secando)","Agrotóxico","Ameaça ou violência","Outro"];

/* ---------- state ---------- */
let B=null, LEG=null, LEGMAP=null;
let MUN=[],UF=[],UC=[],TI=[],QU=[],AS=[],SA=[],CARC=[],EOLP=[],ENP=[],LTE=[],LTP=[],SE=[];
const TILEIDX = new Map();
const TC = new Map();
let overviewImg=null;

/* ---------- loading ---------- */
async function loadBase(){
  const r = await fetch(DATA_URL+"base.json"); if(!r.ok) throw new Error("base "+r.status);
  B = await r.json();
  LEG = B.leg; LEGMAP = new Map(LEG.map((l,i)=>[parseInt(l[1],16),i]));
  UF = B.uf.map(g=>dec(g)).flat();
  MUN = B.mu.map(([n,g])=>mkFeat({name:n,g}));
  UC = B.uc.map(([n,tp,dom,ano,area,cnuc,g])=>mkFeat({name:n,tipo:tp,dom,ano,area,cnuc,g}));
  TI = B.ti.map(([n,sit,area,g])=>mkFeat({name:n,sit,area,g}));
  QU = B.qu.map(([n,proc,area,g])=>mkFeat({name:n,proc,area,g}));
  AS = B.as.map(([n,ano,sipra,g])=>mkFeat({name:n,ano,sipra,g}));
  SA = B.sa.map(([n,g])=>mkPt({name:n,g}));
  CARC = B.carc.map(r=>mkFeat({tipo:r[0],st:r[1],cond:r[2],mun:r[3],area:r[4],mf:r[5],criado:r[6],cod:r[7],g:r[8]}));
  EOLP = B.eolp.map(([n,mw,fase,g])=>mkFeat({name:n,mw,fase,tipo:"EOL",g}));
  ENP = B.enp.map(([n,tipo,fase,mw,extra,g])=>mkPt({name:n,tipo,fase,mw,extra,g}));
  LTE = B.lte.map(([n,ano,dono,kv,g])=>{const o={name:n,ano,dono,kv,g,plan:false};o.r=dec(g);o.bb=bboxR(o.r);return o;});
  LTP = B.ltp.map(([n,ano,dono,kv,g])=>{const o={name:n,ano,dono,kv,g,plan:true};o.r=dec(g);o.bb=bboxR(o.r);return o;});
  SE = B.see.map(([n,ano,dono,kv,g,plan])=>mkPt({name:n,ano,dono,kv,g,plan:!!plan}));
  B.tiles.forEach(([k,nmin,nbig,lu])=>TILEIDX.set(k,{nmin,nbig,lu}));
  overviewImg = await loadImg(DATA_URL+"lu/overview.png").catch(()=>null);
  const dl=$("munlist"); dl.innerHTML=[...new Set(MUN.map(m=>m.name))].sort((a,b)=>a.localeCompare(b,"pt")).map(n=>`<option value="${esc(n)}">`).join("");
}
function loadImg(src){return new Promise((res,rej)=>{const im=new Image();im.onload=()=>res(im);im.onerror=()=>rej(new Error("img "+src));im.src=src;});}
function imgData(im){const c=document.createElement("canvas");c.width=im.width;c.height=im.height;const g=c.getContext("2d",{willReadFrequently:true});g.drawImage(im,0,0);return g.getImageData(0,0,im.width,im.height).data;}
const tkey=(x,y)=>Math.floor(x)+"_"+Math.floor(y);
function loadTile(k){
  if(TC.has(k)) return TC.get(k).p;
  const info=TILEIDX.get(k); const t={k,ok:false,min:[],big:[],lu:null,car:null,luImg:null,carImg:null};
  t.p=(async()=>{
    if(!info){t.ok=true;return t;}
    const [tx,ty]=k.split("_").map(Number); t.tx=tx; t.ty=ty;
    const jr=fetch(DATA_URL+"t/"+k+".json").then(r=>r.ok?r.json():{min:[],nome:[],big:[]});
    const lr=info.lu?loadImg(DATA_URL+"lu/"+k+".png").catch(()=>null):null;
    const cr=info.lu?loadImg(DATA_URL+"car/"+k+".png").catch(()=>null):null;
    const [j,li,ci]=await Promise.all([jr,lr,cr]);
    t.min=j.min.map(r=>({proc:r[0],fase:B.fase[r[1]],st:stOf(B.fase[r[1]]),subs:B.subs[r[2]],uso:B.uso[r[3]],nome:j.nome[r[4]],area:r[5],ev:r[6],g:r[7],bb:null}));
    t.min.forEach(m=>geo(m));
    t.big=j.big.map(r=>({cod:r[0],mun:r[1],area:r[2],mf:r[3],criado:r[4],g:r[5]})); t.big.forEach(b=>geo(b));
    if(li){t.luImg=li;const d=imgData(li);const a=new Uint8Array(li.width*li.height);for(let i=0;i<a.length;i++){if(d[i*4+3]<128){a[i]=255;continue;}const v=LEGMAP.get((d[i*4]<<16)|(d[i*4+1]<<8)|d[i*4+2]);a[i]=v===undefined?254:v;}t.lu=a;t.luN=li.width;}
    if(ci){t.carImg=ci;const d=imgData(ci);const a=new Uint8Array(ci.width*ci.height);for(let i=0;i<a.length;i++)a[i]=d[i*4+3]>127?1:0;t.car=a;t.carN=ci.width;}
    t.ok=true; return t;
  })().catch(e=>{t.err=e;t.ok=true;return t;});
  TC.set(k,t); return t.p;
}
function tilesFor(w,s,e,n){const ks=[];for(let x=Math.floor(w);x<=Math.floor(e);x++)for(let y=Math.floor(s);y<=Math.floor(n);y++){const k=x+"_"+y;if(TILEIDX.has(k))ks.push(k);}return ks;}
async function ensure(w,s,e,n){const ks=tilesFor(w,s,e,n);await Promise.all(ks.map(loadTile));return ks.map(k=>TC.get(k));}
function loaded(k){const t=TC.get(k);return t&&t.ok?t:null;}
function rasterAt(field,x,y){const t=loaded(tkey(x,y));if(!t||!t[field])return null;const N=t[field+"N"];const i=Math.floor((x-t.tx)*N),j=Math.floor((t.ty+1-y)*N);if(i<0||j<0||i>=N||j>=N)return null;return t[field][j*N+i];}
function rasterStats(field,x,y,rkm){ // counts per value within circle
  const cnt=new Map();let tot=0;const kx=KXf(y);const dlon=rkm/kx,dlat=rkm/KY;
  for(const t of tilesFor(x-dlon,y-dlat,x+dlon,y+dlat).map(loaded)){if(!t||!t[field])continue;const N=t[field+"N"],c=1/N;
    const i0=Math.max(0,Math.floor((x-dlon-t.tx)*N)),i1=Math.min(N-1,Math.floor((x+dlon-t.tx)*N)),j0=Math.max(0,Math.floor((t.ty+1-(y+dlat))*N)),j1=Math.min(N-1,Math.floor((t.ty+1-(y-dlat))*N));
    for(let j=j0;j<=j1;j++){const cy=t.ty+1-(j+.5)*c;for(let i=i0;i<=i1;i++){const cx=t.tx+(i+.5)*c;if(Math.hypot((cx-x)*kx,(cy-y)*KY)>rkm)continue;const v=t[field][j*N+i];if(v>=250&&field==="lu")continue;tot++;cnt.set(v,(cnt.get(v)||0)+1);}}}
  return {tot,cnt};
}
function rasterInPoly(field,rings,bb){ // counts per value inside polygon
  const cnt=new Map();let tot=0;
  for(const t of tilesFor(bb.w,bb.s,bb.e,bb.n).map(loaded)){if(!t||!t[field])continue;const N=t[field+"N"],c=1/N;
    const i0=Math.max(0,Math.floor((bb.w-t.tx)*N)),i1=Math.min(N-1,Math.floor((bb.e-t.tx)*N)),j0=Math.max(0,Math.floor((t.ty+1-bb.n)*N)),j1=Math.min(N-1,Math.floor((t.ty+1-bb.s)*N));
    for(let j=j0;j<=j1;j++){const cy=t.ty+1-(j+.5)*c;for(let i=i0;i<=i1;i++){const cx=t.tx+(i+.5)*c;if(!inPoly(cx,cy,rings))continue;const v=t[field][j*N+i];if(v>=250&&field==="lu")continue;tot++;cnt.set(v,(cnt.get(v)||0)+1);}}}
  return {tot,cnt};
}
function luName(n){return n==="Formação Savânica"?"Vegetação nativa (formação savânica)":n==="Formação Florestal"?"Vegetação nativa (formação florestal)":n==="Formação Campestre"?"Vegetação nativa (formação campestre)":n;}
const inBahia=(x,y)=>{let c=false;for(const r of UF)if(inRing(x,y,r))c=!c;return c;};

/* ---------- point analysis ---------- */
async function analyze(x,y,R){
  const pad=R/100+0.15; const tiles=await ensure(x-pad,y-pad,x+pad,y+pad);
  const out={x,y,R,when:new Date()};
  out.inBA=inBahia(x,y);
  out.mun=(MUN.find(m=>bbD(m.bb,x,y)===0&&inPoly(x,y,m.r))||{}).name||null;
  const mi=[];
  for(const t of tiles)for(const m of t.min){if(bbD(m.bb,x,y)>R)continue;const d=polyD(x,y,m.r);if(d<=R)mi.push(Object.assign({d},m));}
  mi.sort((a,b)=>a.d-b.d); out.minIn=mi.filter(m=>m.d===0); out.minNear=mi.filter(m=>m.d>0);
  out.minStage={}; mi.forEach(m=>out.minStage[m.st]=(out.minStage[m.st]||0)+1);
  const bs={}; mi.forEach(m=>bs[m.subs]=(bs[m.subs]||0)+1); out.minSubs=Object.entries(bs).sort((a,b)=>b[1]-a[1]);
  const near=(arr,lim)=>arr.filter(o=>bbD(o.bb,x,y)<=lim).map(o=>Object.assign({d:polyD(x,y,o.r)},o)).sort((a,b)=>a.d-b.d);
  const nearest=(arr)=>{let best=null;for(const o of arr){const lb=bbD(o.bb,x,y);if(best&&lb>=best.d)continue;const d=polyD(x,y,o.r);if(!best||d<best.d)best=Object.assign({d},o);}return best;};
  out.terr=[...near(UC,R).map(o=>({...o,lab:"Unidade de conservação",info:`${o.tipo||""} · ${o.dom||""}${o.ano?" · criada em "+o.ano:""}`})),
            ...near(TI,R).map(o=>({...o,lab:"Terra indígena",info:o.sit||""})),
            ...near(QU,R).map(o=>({...o,lab:"Território quilombola",info:`Processo INCRA ${o.proc||"-"}${o.area?" · "+fmtN(o.area)+" ha":""}`})),
            ...near(AS,R).map(o=>({...o,lab:"Assentamento da reforma agrária (INCRA)",info:o.ano?"Criado em "+o.ano:""}))].filter(o=>o.d<=R).sort((a,b)=>a.d-b.d);
  if(!out.terr.length){const c=[["Unidade de conservação",nearest(UC)],["Terra indígena",nearest(TI)],["Território quilombola",nearest(QU)],["Assentamento (INCRA)",nearest(AS)]].filter(z=>z[1]).sort((a,b)=>a[1].d-b[1].d)[0];out.terrNearest=c?{lab:c[0],...c[1]}:null;}
  out.sa=SA.filter(s=>bbD(s.bb,x,y)<=R).map(s=>Object.assign({d:ptD(x,y,s.p)},s)).filter(s=>s.d<=R).sort((a,b)=>a.d-b.d);
  const en=[...EOLP.filter(e=>bbD(e.bb,x,y)<=R+30).map(e=>Object.assign({d:polyD(x,y,e.r)},e)),...ENP.filter(e=>bbD(e.bb,x,y)<=R+30).map(e=>Object.assign({d:ptD(x,y,e.p)},e))].sort((a,b)=>a.d-b.d);
  out.enR=en.filter(e=>e.d<=R); out.enNearest=en[0]||null;
  const lnear=arr=>{let best=null;for(const l of arr){const lb=bbD(l.bb,x,y);if(best&&lb>=best.d)continue;const d=lineD(x,y,l.r);if(!best||d<best.d)best=Object.assign({d},l);}return best;};
  out.lte=lnear(LTE); out.ltp=lnear(LTP);
  out.se=SE.filter(s=>!s.plan).map(s=>Object.assign({d:ptD(x,y,s.p)},s)).sort((a,b)=>a.d-b.d)[0]||null;
  out.luAt=rasterAt("lu",x,y);
  const ls=rasterStats("lu",x,y,R); out.lu={tot:ls.tot,cls:[...ls.cnt.entries()].filter(([k])=>k<250).map(([k,n])=>({k,pct:n/ls.tot*100})).sort((a,b)=>b.pct-a.pct)};
  const cs=rasterStats("car",x,y,R); out.car={at:rasterAt("car",x,y),p1:cs.tot?(cs.cnt.get(1)||0)/cs.tot*100:null,
    coll:CARC.filter(c=>bbD(c.bb,x,y)<=R).map(c=>Object.assign({d:polyD(x,y,c.r)},c)).filter(c=>c.d<=R).sort((a,b)=>a.d-b.d),
    big:tiles.flatMap(t=>t.big).filter(b=>bbD(b.bb,x,y)<=R).map(b=>Object.assign({d:polyD(x,y,b.r)},b)).filter(b=>b.d<=R).sort((a,b)=>a.d-b.d)};
  for(const c of out.car.coll){ if(c.tipo==="PCT"&&c.st!=="CA"){await ensure(c.bb.w,c.bb.s,c.bb.e,c.bb.n);const s=rasterInPoly("car",c.r,c.bb);c.ovPct=s.tot?(s.cnt.get(1)||0)/s.tot*100:0;} }
  return out;
}

/* ---------- map ---------- */
const cv=$("map"), ctx=cv.getContext("2d");
let view=Object.assign({},VIEW_BA), sel=null, R=5, W=0, H=0, DPR=1;
const LAYERS=[
  {id:"lu",n:"Uso da terra (MapBiomas)",sw:"linear-gradient(90deg,#7dc975 50%,#edde8e 50%)",on:true},
  {id:"car",n:"Imóveis no CAR",sw:"#7f95b3",on:false},
  {id:"min",n:"Mineração (ANM)",sw:STAGE.ex.c,on:true},
  {id:"en",n:"Eólicas e solares",sw:"#1f4fbf",on:true},
  {id:"lt",n:"Linhas e subestações",sw:"#222",on:true},
  {id:"pct",n:"CEFIR coletivo e assentamentos no CAR",sw:"#00897b",on:true},
  {id:"big",n:"Grandes imóveis no CAR",sw:"#37474f",on:true},
  {id:"ter",n:"Territórios e registros",sw:"#d81b60",on:true},
  {id:"uc",n:"Unidades de conservação",sw:"#2e7d32",on:true},
  {id:"ti",n:"Terras indígenas",sw:"#a0522d",on:true},
  {id:"qu",n:"Territórios quilombolas",sw:"#7b3fa0",on:true},
  {id:"as",n:"Assentamentos (INCRA)",sw:"#c27c0e",on:true},
  {id:"sa",n:"Sítios arqueológicos",sw:"#7a4b2a",on:true},
  {id:"mu",n:"Municípios",sw:"#8d958c",on:true}
];
const on=id=>LAYERS.find(l=>l.id===id).on;
const css=v=>getComputedStyle(document.documentElement).getPropertyValue(v).trim();
function resize(){DPR=Math.min(2,window.devicePixelRatio||1);const r=cv.getBoundingClientRect();W=r.width;H=r.height;cv.width=Math.round(W*DPR);cv.height=Math.round(H*DPR);fitAspect();draw();}
function clampView(){const cx=(view.w+view.e)/2,cy=(view.s+view.n)/2;const nx=Math.max(-46.7,Math.min(-37.3,cx)),ny=Math.max(-18.4,Math.min(-8.5,cy));const dx=nx-cx,dy=ny-cy;view.w+=dx;view.e+=dx;view.s+=dy;view.n+=dy;}
function fitAspect(){const cx=(view.w+view.e)/2,cy=(view.s+view.n)/2;KX=KXf(cy);let gw=(view.e-view.w)*KX,gh=(view.n-view.s)*KY;const ar=W/H;if(gw/gh>ar)gh=gw/ar;else gw=gh*ar;view={w:cx-gw/2/KX,e:cx+gw/2/KX,s:cy-gh/2/KY,n:cy+gh/2/KY};}
const px=x=>(x-view.w)/(view.e-view.w)*W, py=y=>(view.n-y)/(view.n-view.s)*H;
const gx=X=>view.w+X/W*(view.e-view.w), gy=Y=>view.n-Y/H*(view.n-view.s);
const vis=bb=>!(bb.e<view.w||bb.w>view.e||bb.n<view.s||bb.s>view.n);
function pathRings(c,rings){c.beginPath();for(const r of rings){for(let i=0;i<r.length;i++){const X=px(r[i][0]),Y=py(r[i][1]);i?c.lineTo(X,Y):c.moveTo(X,Y);}c.closePath();}}
function pathLines(c,paths){c.beginPath();for(const p of paths)for(let i=0;i<p.length;i++){const X=px(p[i][0]),Y=py(p[i][1]);i?c.lineTo(X,Y):c.moveTo(X,Y);}}
const vw=()=>view.e-view.w;
let drawQ=false; function draw(){ if(drawQ)return; drawQ=true; requestAnimationFrame(()=>{drawQ=false; drawNow(ctx,{});}); }
function drawNow(c,opts){
  const s=opts.scale||DPR; c.setTransform(s,0,0,s,0,0);
  c.fillStyle=opts.bg||css("--mapbg"); c.fillRect(0,0,W,H);
  if(!B){return;}
  const detail=vw()<=2.6;
  if(detail&&!opts.noLoad) requestTiles();
  const ink=opts.ink||css("--ink");
  // rasters
  if(on("lu")){c.save();c.globalAlpha=.55;c.imageSmoothingEnabled=false;
    if(!detail&&overviewImg) c.drawImage(overviewImg,px(-47),py(-8),px(-37)-px(-47),py(-19)-py(-8));
    else for(const t of visTiles()) if(t.luImg) c.drawImage(t.luImg,px(t.tx),py(t.ty+1),px(t.tx+1)-px(t.tx),py(t.ty)-py(t.ty+1));
    c.restore();}
  if(on("car")&&detail){c.save();c.globalAlpha=.35;c.imageSmoothingEnabled=false;for(const t of visTiles()) if(t.carImg) c.drawImage(t.carImg,px(t.tx),py(t.ty+1),px(t.tx+1)-px(t.tx),py(t.ty)-py(t.ty+1));c.restore();}
  if(on("mu")){c.save();pathRings(c,UF);c.clip("evenodd");c.strokeStyle=css("--mapline");c.lineWidth=detail?1.1:.6;for(const m of MUN){if(!vis(m.bb))continue;pathRings(c,m.r);c.stroke();}c.restore();}
  c.strokeStyle=ink;c.lineWidth=1.8;pathRings(c,UF);c.stroke();
  const fillPoly=(arr,fill,stroke,lw)=>{for(const t of arr){if(!vis(t.bb))continue;pathRings(c,t.r);c.fillStyle=fill;c.fill("evenodd");c.strokeStyle=stroke;c.lineWidth=lw;c.stroke();}};
  if(on("as")) fillPoly(AS,"rgba(194,124,14,.16)","#c27c0e",1.2);
  if(on("uc")) fillPoly(UC,"rgba(46,125,50,.14)","#2e7d32",1.4);
  if(on("ti")) fillPoly(TI,"rgba(160,82,45,.22)","#a0522d",1.8);
  if(on("qu")) fillPoly(QU,"rgba(123,63,160,.22)","#7b3fa0",1.8);
  if(on("big")&&detail){c.strokeStyle="#37474f";c.lineWidth=1.1;c.setLineDash([2,2]);for(const t of visTiles())for(const b of t.big){if(!vis(b.bb))continue;pathRings(c,b.r);c.stroke();}c.setLineDash([]);}
  if(on("pct")){for(const t of CARC){if(!vis(t.bb))continue;pathRings(c,t.r);const pct=t.tipo==="PCT";c.fillStyle=pct?(t.st==="CA"?"rgba(0,137,123,.06)":"rgba(0,137,123,.25)"):"rgba(141,110,99,.14)";c.fill("evenodd");c.strokeStyle=pct?"#00897b":"#8d6e63";c.lineWidth=pct?1.8:1.2;c.setLineDash(t.st==="CA"?[6,4]:[]);c.stroke();c.setLineDash([]);}}
  if(on("min")&&detail){for(const st of ["di","pp","pe","px","ex"]){c.fillStyle=STAGE[st].c+"30";c.strokeStyle=STAGE[st].c;c.lineWidth=1;for(const t of visTiles())for(const m of t.min){if(m.st!==st||!vis(m.bb))continue;pathRings(c,m.r);c.fill("evenodd");c.stroke();}}}
  if(on("en")){for(const e of EOLP){if(!vis(e.bb))continue;pathRings(c,e.r);c.fillStyle=enCol(e.fase)+"55";c.fill("evenodd");c.strokeStyle=enCol(e.fase);c.lineWidth=1.2;c.stroke();}
    for(const e of ENP){if(!vis(e.bb))continue;const X=px(e.p[0]),Y=py(e.p[1]),r=detail?6:3.5;c.beginPath();if(e.tipo==="UFV"){c.rect(X-r*.8,Y-r*.8,r*1.6,r*1.6);}else{c.moveTo(X,Y-r);c.lineTo(X+r*.85,Y+r*.7);c.lineTo(X-r*.85,Y+r*.7);c.closePath();}c.fillStyle=e.tipo==="UFV"?"#f2a900":enCol(e.fase);c.fill();if(detail){c.strokeStyle="#fff";c.lineWidth=1;c.stroke();}}}
  if(on("lt")){c.lineWidth=detail?2.2:1.2;c.strokeStyle=ink;for(const l of LTE){if(!vis(l.bb))continue;pathLines(c,l.r);c.stroke();}
    c.save();c.setLineDash([8,5]);c.strokeStyle="#7b2cbf";c.lineWidth=detail?2.6:1.4;for(const l of LTP){if(!vis(l.bb))continue;pathLines(c,l.r);c.stroke();}c.restore();
    if(detail)for(const s of SE){if(!vis(s.bb))continue;const X=px(s.p[0]),Y=py(s.p[1]);c.fillStyle=s.plan?"#7b2cbf":ink;c.fillRect(X-5,Y-5,10,10);c.strokeStyle="#fff";c.lineWidth=1.5;c.strokeRect(X-5,Y-5,10,10);}}
  if(on("sa")&&detail){for(const s of SA){if(!vis(s.bb))continue;const X=px(s.p[0]),Y=py(s.p[1]);c.beginPath();c.arc(X,Y,3.5,0,7);c.fillStyle="#7a4b2a";c.fill();c.strokeStyle="#fff";c.lineWidth=1;c.stroke();}}
  if(on("ter")){for(const t of [...TERRS,...(curT&&!curT.saved?[curT]:[])]){pathRings(c,t.rings);c.fillStyle="rgba(216,27,96,.12)";c.fill("evenodd");c.strokeStyle="#d81b60";c.lineWidth=t===curT?3.2:2.2;c.stroke();}
    for(const r of REGS){if(!(r.lon>=view.w&&r.lon<=view.e&&r.lat>=view.s&&r.lat<=view.n))continue;const X=px(r.lon),Y=py(r.lat);c.beginPath();c.moveTo(X,Y);c.arc(X,Y-11,6,Math.PI*0.8,Math.PI*2.2);c.closePath();c.fillStyle="#d81b60";c.fill();c.strokeStyle="#fff";c.lineWidth=1.5;c.stroke();}}
  if(drawPts){c.beginPath();drawPts.forEach(([x,y],i)=>i?c.lineTo(px(x),py(y)):c.moveTo(px(x),py(y)));if(drawPts.length>2)c.closePath();c.strokeStyle="#d81b60";c.lineWidth=2.5;c.stroke();if(drawPts.length>2){c.fillStyle="rgba(216,27,96,.15)";c.fill();}drawPts.forEach(([x,y])=>{c.beginPath();c.arc(px(x),py(y),5,0,7);c.fillStyle="#d81b60";c.fill();c.strokeStyle="#fff";c.lineWidth=2;c.stroke();});}
  if(CARLIST&&on("car")){c.strokeStyle="#5b6f8c";c.lineWidth=1;for(const k of CARLIST.list){if(!vis(k.bb))continue;pathRings(c,k.r);c.stroke();}}
  /* máscara: só a Bahia fica visível */
  if(!opts.noMask){c.save();c.beginPath();c.rect(-10,-10,W+20,H+20);for(const r of UF){for(let i=0;i<r.length;i++){const X=px(r[i][0]),Y=py(r[i][1]);i?c.lineTo(X,Y):c.moveTo(X,Y);}c.closePath();}
    c.fillStyle=opts.mask||css("--mapmask");c.fill("evenodd");c.restore();c.strokeStyle=ink;c.lineWidth=2;pathRings(c,UF);c.stroke();}
  if(on("mu")&&!opts.noLabels&&vw()<1.6){c.font="600 12px "+css("--f-body");c.textAlign="center";c.fillStyle=ink;c.globalAlpha=.75;
    for(const m of MUN){if(!vis(m.bb))continue;const cx=Math.max(view.w,Math.min(view.e,(m.bb.w+m.bb.e)/2)),cy=Math.max(view.s,Math.min(view.n,(m.bb.s+m.bb.n)/2));if(inPoly(cx,cy,m.r))c.fillText(m.name,px(cx),py(cy));}c.globalAlpha=1;}
  if(sel&&!opts.noSel){const X=px(sel.x),Y=py(sel.y);const rp=sel.R/KXf(sel.y)/(view.e-view.w)*W;c.beginPath();c.arc(X,Y,rp,0,7);c.strokeStyle=css("--accent");c.lineWidth=2;c.setLineDash([5,4]);c.stroke();c.setLineDash([]);c.fillStyle=css("--accent")+"14";c.fill();
    c.beginPath();c.arc(X,Y,8,0,7);c.fillStyle=css("--accent");c.fill();c.strokeStyle="#fff";c.lineWidth=3;c.stroke();}
}
function visTiles(){return tilesFor(view.w,view.s,view.e,view.n).map(loaded).filter(Boolean);}
let reqT=null;
function requestTiles(){clearTimeout(reqT);reqT=setTimeout(()=>{const ks=tilesFor(view.w,view.s,view.e,view.n).filter(k=>!TC.has(k));if(!ks.length)return;const ml=$("mapload");ml.hidden=false;ml.textContent=`Carregando ${ks.length} quadrícula${ks.length>1?"s":""}…`;
  Promise.all(ks.map(loadTile)).then(()=>{ml.hidden=true;draw();});},180);}
/* pan / zoom / tap */
const ptrs=new Map(); let moved=0,pinch0=null,last=null;
cv.addEventListener("pointerdown",e=>{cv.setPointerCapture(e.pointerId);ptrs.set(e.pointerId,{x:e.offsetX,y:e.offsetY});moved=0;last={x:e.offsetX,y:e.offsetY};if(ptrs.size===2){const [a,b]=[...ptrs.values()];pinch0={d:Math.hypot(a.x-b.x,a.y-b.y),v:Object.assign({},view),cx:(a.x+b.x)/2,cy:(a.y+b.y)/2};}});
cv.addEventListener("pointermove",e=>{if(!ptrs.has(e.pointerId))return;ptrs.set(e.pointerId,{x:e.offsetX,y:e.offsetY});
  if(ptrs.size===2&&pinch0){const [a,b]=[...ptrs.values()];const k=pinch0.d/Math.max(10,Math.hypot(a.x-b.x,a.y-b.y));view=Object.assign({},pinch0.v);zoomAt(pinch0.cx,pinch0.cy,k);moved=99;draw();return;}
  const dx=e.offsetX-last.x,dy=e.offsetY-last.y;moved+=Math.abs(dx)+Math.abs(dy);last={x:e.offsetX,y:e.offsetY};
  if(moved>6){const sx=(view.e-view.w)/W,sy=(view.n-view.s)/H;view.w-=dx*sx;view.e-=dx*sx;view.n+=dy*sy;view.s+=dy*sy;clampView();draw();}});
cv.addEventListener("pointerup",e=>{const wasTap=ptrs.size===1&&moved<=6;ptrs.delete(e.pointerId);if(ptrs.size<2)pinch0=null;if(!wasTap||!B)return;const x=gx(e.offsetX),y=gy(e.offsetY);
  if(drawPts){drawPts.push([x,y]);updDraw();draw();return;}
  if(!inBahia(x,y)){say("Este ponto fica fora da Bahia. Toque dentro do mapa do estado.",true);return;}
  choose(x,y,"mapa");});
cv.addEventListener("pointercancel",e=>{ptrs.delete(e.pointerId);pinch0=null;});
cv.addEventListener("wheel",e=>{e.preventDefault();zoomAt(e.offsetX,e.offsetY,e.deltaY>0?1.25:0.8);draw();},{passive:false});
function zoomAt(X,Y,k){const x=gx(X),y=gy(Y);const nw=(view.e-view.w)*k;if(nw<0.004||nw>12)return;const nh=(view.n-view.s)*k;view={w:x-(X/W)*nw,e:x+(1-X/W)*nw,n:y+(Y/H)*nh,s:y-(1-Y/H)*nh};clampView();}
$("zin").onclick=()=>{zoomAt(W/2,H/2,0.6);draw();};
$("zout").onclick=()=>{zoomAt(W/2,H/2,1.6);draw();};
$("zall").onclick=()=>{view=Object.assign({},VIEW_BA);fitAspect();draw();};
function fitTo(bb,m){const w=(bb.e-bb.w),h=(bb.n-bb.s);m=m==null?Math.max(w,h)*0.3+0.01:m;view={w:bb.w-m,e:bb.e+m,s:bb.s-m,n:bb.n+m};fitAspect();}
function centerOn(x,y,spanDeg){const h=spanDeg/2;view={w:x-h,e:x+h,s:y-h,n:y+h};fitAspect();}
const lgEl=$("legend");
LAYERS.forEach(l=>{const b=document.createElement("button");b.type="button";b.className="lg";b.setAttribute("aria-pressed",String(l.on));b.innerHTML=`<span class="sw" style="background:${l.sw}"></span>${l.n}`;b.onclick=()=>{l.on=!l.on;b.setAttribute("aria-pressed",String(l.on));draw();};lgEl.appendChild(b);});

/* ---------- location input ---------- */
const msg=$("msg"), coord=$("coord"), raio=$("raio");
function say(t,err){msg.textContent=t;msg.className="msg"+(err?" err":"");}
function utmToLL(E,N,zone,south){
  const a=6378137,f=1/298.257222101,k0=0.9996,e2=f*(2-f),ep2=e2/(1-e2);
  const x=E-500000,y=south?N-10000000:N;const M=y/k0;const mu=M/(a*(1-e2/4-3*e2*e2/64-5*e2*e2*e2/256));
  const e1=(1-Math.sqrt(1-e2))/(1+Math.sqrt(1-e2));
  const p1=mu+(3*e1/2-27*e1**3/32)*Math.sin(2*mu)+(21*e1*e1/16-55*e1**4/32)*Math.sin(4*mu)+(151*e1**3/96)*Math.sin(6*mu)+(1097*e1**4/512)*Math.sin(8*mu);
  const C1=ep2*Math.cos(p1)**2,T1=Math.tan(p1)**2,N1=a/Math.sqrt(1-e2*Math.sin(p1)**2),R1=a*(1-e2)/(1-e2*Math.sin(p1)**2)**1.5,D=x/(N1*k0);
  const lat=p1-(N1*Math.tan(p1)/R1)*(D*D/2-(5+3*T1+10*C1-4*C1*C1-9*ep2)*D**4/24+(61+90*T1+298*C1+45*T1*T1-252*ep2-3*C1*C1)*D**6/720);
  const lon=(D-(1+2*T1+C1)*D**3/6+(5-2*C1+28*T1-3*C1*C1+8*ep2+24*T1*T1)*D**5/120)/Math.cos(p1);
  return [((zone-1)*6-180+3)+lon*180/Math.PI, lat*180/Math.PI];
}
function parseLoc(raw){
  const s=String(raw||"").trim(); if(!s) return null;
  if(/maps\.app\.goo\.gl|goo\.gl\/maps/i.test(s)&&!/-?\d+\.\d+/.test(s)) return {err:"Esse link curto não traz as coordenadas. No mapa, toque e segure no local e copie os números que aparecem."};
  let m;
  if((m=s.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/))) return {lat:+m[1],lon:+m[2]};
  if((m=s.match(/@(-?\d+\.\d+),\s*(-?\d+\.\d+)/))) return {lat:+m[1],lon:+m[2]};
  if((m=s.match(/[?&](?:q|query|ll|center|destination|daddr)=(?:loc:)?(-?\d+\.\d+)(?:,|%2C)\s*(-?\d+\.\d+)/i))) return {lat:+m[1],lon:+m[2]};
  if((m=s.match(/geo:(-?\d+\.\d+),(-?\d+\.\d+)/i))) return {lat:+m[1],lon:+m[2]};
  // UTM: zone + easting + northing
  if((m=s.match(/\b(2[34])\s*[A-Za-z]?\b[^\d-]{0,12}(\d{6}(?:[.,]\d+)?)\s*(?:m\s*)?E?[^\d]{0,8}(\d{7}(?:[.,]\d+)?)/))){const [lon,lat]=utmToLL(+m[2].replace(",","."),+m[3].replace(",","."),+m[1],true);return {lat,lon,utm:true};}
  // DMS
  const dms=[...s.matchAll(/(\d{1,3})\s*[°º:]\s*(\d{1,2})\s*['’′:]\s*(\d{1,2}(?:[.,]\d+)?)?\s*(?:["”″]|'')?\s*([NSEWOLnsewol])?/g)];
  if(dms.length>=2){const v=dms.slice(0,2).map(d=>{let val=+d[1]+(+d[2])/60+(d[3]?+d[3].replace(",","."):0)/3600;const h=(d[4]||"").toUpperCase();if(h==="S"||h==="W"||h==="O")val=-val;return {val,h};});
    let lat,lon;if(v[0].h==="N"||v[0].h==="S"||(!v[0].h&&Math.abs(v[0].val)<=20)){lat=v[0].val;lon=v[1].val;}else{lon=v[0].val;lat=v[1].val;}
    if(lat>0)lat=-lat;if(lon>0)lon=-lon;return {lat,lon};}
  const nums=(s.match(/-?\d+(?:[.,]\d+)?/g)||[]).map(t=>+t.replace(",",".")).filter(v=>isFinite(v));
  // "-10,5445 -40,4047" with decimal commas becomes 4 numbers when split by comma: handle "a,b c,d"
  let a,b;
  if(/^-?\d+,\d+\s*[;\s]\s*-?\d+,\d+$/.test(s)){[a,b]=s.split(/[;\s]+/).map(t=>+t.replace(",","."));}
  else if(nums.length>=2){[a,b]=nums;}
  else return null;
  if(Math.abs(a)>Math.abs(b))[a,b]=[b,a];
  if(/S/i.test(s)||a>0)a=-Math.abs(a); if(/[WO]/i.test(s)||b>0)b=-Math.abs(b);
  return {lat:a,lon:b};
}
function goLoc(text,how){const c=parseLoc(text);if(!c){say("Não entendi a localização. Exemplos: -10.54, -40.40 · 10°32'S 40°24'W · 24L 353989 8819640 · link do Google Maps.",true);return false;}
  if(c.err){say(c.err,true);return false;}
  if(c.lat<-19.5||c.lat>-7.5||c.lon<-47.5||c.lon>-37){say(`O ponto ${c.lat.toFixed(4)}, ${c.lon.toFixed(4)} fica fora da Bahia. Confira se latitude e longitude estão na ordem certa.`,true);return false;}
  if(B&&!inBahia(c.lon,c.lat)){say(`O ponto ${c.lat.toFixed(4)}, ${c.lon.toFixed(4)} fica fora do território da Bahia. O aplicativo só mostra dados do estado.`,true);return false;}
  centerOn(c.lon,c.lat,0.25);choose(c.lon,c.lat,how);return true;}
$("go").onclick=()=>goLoc(coord.value,"coordenadas");
coord.addEventListener("keydown",e=>{if(e.key==="Enter")$("go").click();});
coord.addEventListener("paste",()=>setTimeout(()=>{if(parseLoc(coord.value)&&!parseLoc(coord.value).err)goLoc(coord.value,"coordenadas");},30));
raio.onchange=()=>{R=+raio.value;if(sel)choose(sel.x,sel.y,sel.how,true);};
function showLocHelp(why){const h=$("lochelp");h.hidden=false;h.innerHTML=`<strong>${esc(why)}</strong>
  <ol><li>Abra o aplicativo de mapas do celular (Google Maps ou outro) com a localização ligada.</li>
  <li>Toque e segure no ponto azul ou no local desejado até aparecer um alfinete.</li>
  <li>Copie as coordenadas (os números como -10.5445, -40.4047) ou o link de compartilhamento.</li>
  <li>Cole aqui embaixo. A consulta começa sozinha.</li></ol>
  <span>Também dá para tocar no ponto direto no mapa, ou buscar pelo número do CAR/CEFIR.</span>`;}
$("gps").onclick=()=>{
  if(!navigator.geolocation){showLocHelp("Este aparelho não informou a localização.");return;}
  say("Buscando sua localização…");
  let done=false;const fail=()=>{if(done)return;done=true;say("");showLocHelp("Não foi possível pegar o GPS. Confira se a localização do celular está ligada e se você permitiu o acesso a este aplicativo. Em lugar fechado o sinal pode demorar.");};
  const t=setTimeout(fail,30000);
  try{navigator.geolocation.getCurrentPosition(p=>{if(done)return;done=true;clearTimeout(t);gpsAcc=p.coords.accuracy;$("lochelp").hidden=true;say(`Localização com precisão de cerca de ${Math.round(p.coords.accuracy)} m.`);centerOn(p.coords.longitude,p.coords.latitude,0.25);choose(p.coords.longitude,p.coords.latitude,"GPS");},()=>{clearTimeout(t);fail();},{timeout:28000,enableHighAccuracy:true,maximumAge:30000});}catch(e){clearTimeout(t);fail();}
};
function exifGPS(buf){const v=new DataView(buf);if(v.getUint16(0)!==0xFFD8)return null;let o=2;
  while(o<v.byteLength-4){const mk=v.getUint16(o);if((mk&0xFF00)!==0xFF00)return null;const len=v.getUint16(o+2);
    if(mk===0xFFE1&&v.getUint32(o+4)===0x45786966){const t=o+10;const le=v.getUint16(t)===0x4949;const g16=p=>v.getUint16(p,le),g32=p=>v.getUint32(p,le);
      const ifd0=t+g32(t+4);const n=g16(ifd0);let gps=null;for(let i=0;i<n;i++){const e=ifd0+2+i*12;if(g16(e)===0x8825)gps=t+g32(e+8);}if(!gps)return null;
      const gn=g16(gps);const tags={};for(let i=0;i<gn;i++){const e=gps+2+i*12;const tag=g16(e),cnt=g32(e+4);if(tag===1||tag===3)tags[tag]=String.fromCharCode(v.getUint8(e+8));if(tag===2||tag===4){const p=t+g32(e+8);const r=k=>g32(p+k*8)/(g32(p+k*8+4)||1);tags[tag]=r(0)+r(1)/60+r(2)/3600;}}
      if(tags[2]==null||tags[4]==null)return null;let lat=tags[2],lon=tags[4];if(tags[1]==="S")lat=-lat;if(tags[3]==="W")lon=-lon;return {lat,lon};}
    o+=2+len;}return null;}
const carCodeNorm=v=>String(v||"").toUpperCase().replace(/[\s.]/g,"").replace(/–|—/g,"-");
async function carByCode(cod){const f=`cod_imovel='${cod.replace(/'/g,"")}'`;const r=await fetch(CAR_WFS+"&count=5&CQL_FILTER="+encodeURIComponent(f));if(!r.ok)throw new Error("O SICAR respondeu "+r.status+".");const j=await r.json();if(!j.features.length)return null;
  const ft=j.features[0],p=ft.properties||{},g=ft.geometry,rings=[];if(g&&g.type==="MultiPolygon")g.coordinates.forEach(pl=>pl.forEach(rg=>rings.push(rg.map(q=>[q[0],q[1]]))));else if(g&&g.type==="Polygon")g.coordinates.forEach(rg=>rings.push(rg.map(q=>[q[0],q[1]])));
  return {cod:p.cod_imovel,tipo:p.tipo_imovel,st:p.status_imovel,cond:p.condicao,mun:p.municipio,area:+p.area||0,mf:+p.m_fiscal||0,rings:cleanRings(rings)};}
async function goCar(){const m=$("carmsg");const cod=carCodeNorm($("carcod").value);m.className="msg";
  if(!/^[A-Z]{2}-\d{7}-[0-9A-F]{32}$/.test(cod)){m.textContent="Confira o número. Ele tem o formato BA-2924405-seguido de 32 letras e números (os pontos podem ser omitidos).";m.className="msg err";return;}
  if(!navigator.onLine){m.textContent="É preciso internet para buscar o perímetro no SICAR.";m.className="msg err";return;}
  m.textContent="Buscando o perímetro no SICAR…";const b=$("cargo");b.disabled=true;
  try{const c=await carByCode(cod);if(!c||!c.rings.length){m.textContent="Não encontrei esse número no SICAR da Bahia.";m.className="msg err";}
    else{m.textContent=`Encontrado: ${CTIPO[c.tipo]||c.tipo} em ${c.mun}, ${fmtN(c.area,1)} ha (${CST[c.st]||c.st}, ${String(c.cond||"").toLowerCase()}). Confira os dados abaixo e toque em Analisar.`;
      startTerritory({rings:c.rings,name:(c.tipo==="PCT"?"CEFIR coletivo":c.tipo==="AST"?"Assentamento":"Imóvel rural")+" · "+c.mun,cod:c.cod,origem:"SICAR",carInfo:c});}}
  catch(e){m.textContent="Não foi possível falar com o SICAR agora. Tente de novo em alguns minutos.";m.className="msg err";}b.disabled=false;}
$("cargo").onclick=goCar;$("carcod").addEventListener("keydown",e=>{if(e.key==="Enter")goCar();});
function dlText(txt,fname,type){const blob=new Blob([txt],{type});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=fname;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),60000);}
function fnameOf(t){return (t.cod||t.name||"perimetro").normalize("NFD").replace(/[^\w-]+/g,"_").replace(/^_|_$/g,"").slice(0,80)||"perimetro";}
function dlPerimeter(t,fmt){const nm=fnameOf(t);
  if(fmt==="kml"){const coords=r=>r.map(([x,y])=>x.toFixed(6)+","+y.toFixed(6)+",0").join(" ");
    const kml=`<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${esc(t.name||nm)}</name><Placemark><name>${esc(t.name||nm)}</name><description>${esc((t.cod?"CAR/CEFIR "+t.cod+". ":"")+"Gerado pelo app Olho no Território.")}</description><MultiGeometry>${t.rings.map(r=>`<Polygon><outerBoundaryIs><LinearRing><coordinates>${coords(r)}</coordinates></LinearRing></outerBoundaryIs></Polygon>`).join("")}</MultiGeometry></Placemark></Document></kml>`;
    dlText(kml,nm+".kml","application/vnd.google-earth.kml+xml");}
  else dlText(JSON.stringify({type:"FeatureCollection",features:[{type:"Feature",properties:{nome:t.name||"",cod_car:t.cod||"",tipo:t.tipo||"",origem:t.origem||""},geometry:{type:"MultiPolygon",coordinates:t.rings.map(r=>[r])}}]}),nm+".geojson","application/geo+json");}
$("foto").addEventListener("change",async e=>{const f=e.target.files[0];e.target.value="";if(!f)return;
  try{const g=exifGPS(await f.slice(0,262144).arrayBuffer());if(!g||(!g.lat&&!g.lon)){say("Essa foto não tem a localização gravada. No celular, ative a localização na câmera e tire uma foto nova, ou cole as coordenadas.",true);return;}
    coord.value=g.lat.toFixed(6)+", "+g.lon.toFixed(6);goLoc(coord.value,"foto");}
  catch(err){say("Não consegui ler a foto. Use uma foto JPG tirada pela câmera do celular.",true);}});
$("mun").addEventListener("change",()=>{const v=$("mun").value.trim().toLowerCase();const m=MUN.filter(x=>x.name.toLowerCase()===v);if(!m.length)return;
  const bb=m.reduce((a,x)=>({w:Math.min(a.w,x.bb.w),e:Math.max(a.e,x.bb.e),s:Math.min(a.s,x.bb.s),n:Math.max(a.n,x.bb.n)}),{w:1e9,e:-1e9,s:1e9,n:-1e9});fitTo(bb,0.05);draw();say(`Mapa centralizado em ${m[0].name}. Toque no mapa para consultar um ponto.`);});

/* ---------- report ---------- */
let busy=0,gpsAcc=null,CARLIST=null;
async function choose(x,y,how,keepView){
  sel={x,y,R,how,acc:how==="GPS"?gpsAcc:null}; coord.value=y.toFixed(5)+", "+x.toFixed(5);
  if(!keepView&&!(x>view.w&&x<view.e&&y>view.s&&y<view.n)){centerOn(x,y,Math.min(vw(),0.6));}
  if(vw()>2.6&&!keepView)centerOn(x,y,0.6);
  draw(); const my=++busy;
  $("out").innerHTML=`<div class="loading"><span class="spin"></span>Cruzando as bases para este ponto…</div>`;
  try{const a=await analyze(x,y,R); if(my!==busy)return; lastA=a; render(a); draw();
    say(a.inBA?"":"Atenção: este ponto está fora da Bahia. Os dados cobrem apenas o estado.", !a.inBA);
    $("hint").textContent="Ponto escolhido. Toque em outro lugar para mudar."; renderRegForm();}
  catch(e){$("out").innerHTML=`<div class="placeholder"><p><strong>Não foi possível carregar os dados desta área.</strong></p><p>Verifique a internet e tente de novo.</p></div>`;}
}
let lastA=null;
function tag(d){return d===0?'<span class="tag in">No ponto</span>':`<span class="tag near">${fmtKm(d)}</span>`;}
function summary(a){const S=[];
  const mc=a.minIn.length,mn=a.minNear.length;
  S.push({k:mc?"in":(mn?"near":"none"),b:mc||mn,t:mc?`processo${mc>1?"s":""} de mineração sobre o ponto`:(mn?`processo${mn>1?"s":""} de mineração no raio`:"sem mineração no raio")});
  const eIn=a.enR.filter(e=>e.d===0).length,eN=a.enR.length;
  S.push({k:eIn?"in":(eN?"near":"none"),b:eN,t:eIn?"parque eólico ou solar sobre o ponto":(eN?`projeto${eN>1?"s":""} de energia no raio`:"sem parque eólico ou solar no raio")});
  const lt=Math.min(a.lte?a.lte.d:1e9,a.ltp?a.ltp.d:1e9);
  S.push({k:lt<=a.R?"near":"none",b:fmtKm(lt),t:"até a linha de transmissão mais próxima"});
  const tIn=a.terr.filter(t=>t.d===0),tN=a.terr.filter(t=>t.d>0);
  S.push({k:tIn.length?"in":(tN.length?"near":"none"),b:tIn.length||tN.length,t:tIn.length?"área protegida ou território no ponto":(tN.length?"área protegida ou território no raio":"sem área protegida ou território no raio")});
  if(a.car.at!=null)S.push({k:a.car.at?"near":"none",b:a.car.at?"Sim":"Não",t:a.car.at?"há imóvel do CAR declarado no ponto":"nenhum imóvel do CAR declarado no ponto"});
  return S;}
function styleBlocks(root){root.querySelectorAll("section.blk").forEach(sec=>{const h=sec.querySelector("h3");const t=h?h.textContent:"";
  sec.classList.add(/Minera/.test(t)?"k-min":/Energia/.test(t)?"k-en":/protegidas|povos/.test(t)?"k-ter":/CAR/.test(t)?"k-car":/Uso e cobertura/.test(t)?"k-lu":"k-act");});}
function render(a){
  const out=$("out"), d=a.when.toLocaleDateString("pt-BR",{day:"2-digit",month:"long",year:"numeric"});
  let h=`<div class="rep"><div class="head"><h2>Resultado da consulta</h2>
    <div class="mono">${a.y.toFixed(5)}, ${a.x.toFixed(5)}</div>
    <div style="color:var(--mute);font-size:14px">${a.mun?"Município de "+esc(a.mun)+" (BA)":"Município não identificado"} · raio de ${a.R} km · ${d}</div></div>
    <div class="chips">${summary(a).map(s=>`<div class="chip ${s.k}"><b>${s.b}</b><span>${s.t}</span></div>`).join("")}</div>`;
  // mining
  h+=`<section class="blk"><h3>Mineração</h3>`;
  const all=[...a.minIn,...a.minNear];
  if(!all.length)h+=`<p class="empty">Nenhum processo minerário a até ${a.R} km.</p>`;
  else{h+=`<div class="bars">${Object.entries(STAGE).filter(([k])=>a.minStage[k]).map(([k,v])=>`<div class="bar"><span>${v.n}</span><div class="track"><div class="fill" style="width:${a.minStage[k]/all.length*100}%;background:${v.c}"></div></div><span class="v">${a.minStage[k]}</span></div>`).join("")}</div>
    <p style="margin:0;color:var(--mute);font-size:14px">Substâncias mais pedidas no raio: ${a.minSubs.slice(0,5).map(([s,n])=>esc(String(s).toLowerCase())+" ("+n+")").join(", ")}.</p>`;
    const list=[...a.minIn,...a.minNear.slice(0,Math.max(0,6-a.minIn.length))];
    h+=list.map(m=>`<div class="item">${tag(m.d)}<div><p class="what">${esc(m.subs.charAt(0)+m.subs.slice(1).toLowerCase())} · ${esc(m.fase.toLowerCase())}</p><p class="meta">Uso: ${esc(m.uso)} · Titular: ${esc(titular(m.nome))} · Processo ${esc(m.proc)} · ${fmtN(m.area)} ha</p><p class="plain">${esc((FASE[m.fase]||{}).txt||"")}</p></div></div>`).join("");
    if(all.length>list.length)h+=`<p class="empty">E mais ${all.length-list.length} processo${all.length-list.length>1?"s":""} no raio.</p>`;h+=minTableHTML(all);}
  h+=`</section>`;
  // energy
  h+=`<section class="blk"><h3>Energia</h3>`;
  if(a.enR.length){h+=a.enR.slice(0,6).map(e=>`<div class="item">${tag(e.d)}<div><p class="what">${e.tipo==="UFV"?"Usina solar":"Parque eólico"} ${esc(e.name)}${e.mw?" · "+fmtN(e.mw,1)+" MW":""}</p><p class="plain">${esc(enTxt(e.fase))}</p></div></div>`).join("");if(a.enR.length>6)h+=`<p class="empty">E mais ${a.enR.length-6} no raio.</p>`;}
  else h+=`<p class="empty">Nenhum parque eólico ou usina solar a até ${a.R} km.${a.enNearest?` O mais próximo: ${esc(a.enNearest.name)} (${a.enNearest.tipo==="UFV"?"solar":"eólico"}), a ${fmtKm(a.enNearest.d)}.`:""}</p>`;
  if(a.lte)h+=`<div class="item">${tag(a.lte.d)}<div><p class="what">Linha de transmissão existente mais próxima</p><p class="meta">${esc(a.lte.name)}${a.lte.ano?" · desde "+a.lte.ano:""}</p></div></div>`;
  if(a.ltp)h+=`<div class="item">${tag(a.ltp.d)}<div><p class="what">Linha de transmissão planejada mais próxima</p><p class="meta">${esc(a.ltp.name)}${a.ltp.ano?" · previsão "+a.ltp.ano:""}</p><p class="plain">Prevista no planejamento da EPE. O traçado ainda pode mudar e precisa passar por licenciamento ambiental.</p></div></div>`;
  if(a.se)h+=`<div class="item">${tag(a.se.d)}<div><p class="what">Subestação mais próxima</p><p class="meta">${esc(a.se.name)} · ${esc(a.se.kv)} kV</p></div></div>`;
  h+=`</section>`;
  // territories
  h+=`<section class="blk"><h3>Áreas protegidas, povos e comunidades</h3>`;
  if(a.terr.length)h+=a.terr.map(t=>`<div class="item">${tag(t.d)}<div><p class="what">${esc(t.name)}</p><p class="meta">${t.lab}${t.info?" · "+esc(t.info):""}</p></div></div>`).join("");
  else h+=`<p class="empty">Nenhuma a até ${a.R} km.${a.terrNearest?` A mais próxima: ${esc(a.terrNearest.name)} (${a.terrNearest.lab.toLowerCase()}), a ${fmtKm(a.terrNearest.d)}.`:""}</p>`;
  h+=`<p class="empty">${a.sa.length?`${a.sa.length} sítio${a.sa.length>1?"s":""} arqueológico${a.sa.length>1?"s":""} no raio. O mais próximo: ${esc(a.sa[0].name)}, a ${fmtKm(a.sa[0].d)}.`:"Nenhum sítio arqueológico cadastrado no raio."}</p></section>`;
  h+=carSection(a);
  // land use
  h+=`<section class="blk"><h3>Uso e cobertura da terra</h3><div id="lus"><div class="loading" style="padding:8px 0"><span class="spin"></span>Calculando a série histórica 1985–2025…</div></div>`;
  if(a.lu.tot){if(a.luAt!=null&&a.luAt<250)h+=`<p style="margin:0">No ponto: <strong>${esc(luName(LEG[a.luAt][0]))}</strong></p>`;
    h+=`<div class="bars">${a.lu.cls.slice(0,7).map(c=>`<div class="bar"><span>${esc(luName(LEG[c.k][0]))}</span><div class="track"><div class="fill" style="width:${c.pct}%;background:#${LEG[c.k][1]}"></div></div><span class="v">${pf(c.pct)}</span></div>`).join("")}</div><p class="empty" style="font-size:13px">Composição em 2025 (MapBiomas Coleção 11, células de cerca de 220 m). Na Caatinga, a formação savânica é a vegetação nativa de porte arbustivo e arbóreo.</p>`;}
  else h+=`<p class="empty">Sem dados do MapBiomas para este local.</p>`;
  h+=`</section>`;
  h+=`<section class="blk"><div class="row"><button type="button" class="btn primary" id="pdf">Gerar relatório em PDF</button><button type="button" class="btn" id="reg2">Registrar observação aqui</button></div><p class="msg" id="pdfmsg" role="status"></p></section>`;
  h+=`<section class="blk"><details><summary>Fontes e datas dos dados</summary><ul class="src">${SOURCES.map(s=>`<li>${s}</li>`).join("")}</ul></details></section></div>`;
  out.innerHTML=h;styleBlocks(out);
  $("pdf").onclick=()=>makePDF(a);
  $("reg2").onclick=()=>{$("regPanel").scrollIntoView({behavior:"smooth",block:"start"});const t=$("rtexto");if(t)t.focus();};
  out.querySelectorAll("[data-usepct]").forEach(b=>b.onclick=()=>useCarPct(CARC.find(c=>c.cod===b.dataset.usepct)));
  const my=busy;
  a.seriesP=seriesCircle(a.x,a.y,a.R).catch(()=>null).then(S=>{a.series=S;if(my!==busy||!$("lus"))return S;$("lus").innerHTML=seriesBlock(S,"chartPt");wireChart("chartPt",S);return S;});
  CARLIST=null;
  if(navigator.onLine){a.carP=carList(a.x,a.y,a.R).then(L=>{a.carL=L;if(my!==busy||!$("carfull"))return L;CARLIST=L;$("carfull").innerHTML=carListHTML(L);draw();return L;})
     .catch(e=>{if(my===busy&&$("carfull"))$("carfull").innerHTML=`<p class="warnbox">Não foi possível buscar a lista completa no SICAR agora (${esc(e.message||"sem resposta")}). Tente de novo mais tarde.</p>`;return null;});}
  else{a.carP=Promise.resolve(null);if($("carfull"))$("carfull").innerHTML=`<p class="warnbox">Sem internet: a lista completa do CAR é consultada no SICAR na hora. Abaixo estão os cadastros coletivos e os grandes imóveis guardados no celular.</p>`;}
}
function carSection(a){const C=a.car;let h=`<section class="blk"><h3>CAR / CEFIR</h3>`;
  if(C.at==null&&C.p1==null)return h+`<p class="empty">Sem dados do CAR para este local.</p></section>`;
  h+=`<p style="margin:0">${C.at?"Há imóvel rural do CAR declarado sobre este ponto.":"Nenhum imóvel rural do CAR declarado sobre este ponto."}</p><div id="carfull"><div class="loading" style="padding:8px 0"><span class="spin"></span>Buscando todos os cadastros do raio no SICAR…</div></div>`;
  if(C.p1!=null)h+=`<div class="bars"><div class="bar"><span>Área do raio com CAR</span><div class="track"><div class="fill" style="width:${C.p1}%;background:#7f95b3"></div></div><span class="v">${pf(C.p1)}</span></div></div>`;
  C.coll.forEach(c=>{h+=`<div class="item">${tag(c.d)}<div><p class="what">${c.tipo==="PCT"?"CEFIR coletivo de comunidade tradicional":"Assentamento no CAR"} · ${esc(c.mun)} · ${fmtN(c.area,1)} ha</p>
    <p class="meta">${esc(c.cod)} · ${c.st==="CA"?"cancelado":esc((c.cond||"").toLowerCase())} · cadastrado em ${esc((c.criado||"").split("-").reverse().join("/"))}</p>
    ${c.ovPct!=null?`<p class="plain">Cerca de ${pf(c.ovPct)} deste território também está declarado como imóvel rural individual no CAR.</p>`:""}
    ${c.tipo==="PCT"&&c.st!=="CA"?`<button type="button" class="btn sm" data-usepct="${esc(c.cod)}">Analisar este território</button>`:""}</div></div>`;});
  C.big.slice(0,5).forEach(b=>{h+=`<div class="item">${tag(b.d)}<div><p class="what">Grande imóvel rural · ${fmtN(b.area,0)} ha (${String(b.mf).replace(".",",")} módulos fiscais)</p><p class="meta">${esc(b.cod)} · ${esc(b.mun)} · cadastrado em ${esc((b.criado||"").split("-").reverse().join("/"))}</p></div></div>`;});
  if(C.big.length>5)h+=`<p class="empty">E mais ${C.big.length-5} grandes imóveis no raio.</p>`;
  h+=`<p class="plain">O CAR é autodeclarado: quem cadastra desenha o limite do imóvel, e a maioria dos cadastros aguarda análise do INEMA. Imóvel individual dentro de território coletivo pode ser lote de morador ou indicar conflito. Converse com a comunidade antes de concluir.</p></section>`;
  return h;}
const SOURCES=[
  "Mineração: ANM, SIGMINE (processos minerários ativos na Bahia), consultado em 23/10/2026.",
  "Unidades de conservação, terras indígenas, territórios quilombolas, assentamentos, sítios arqueológicos e limites: camadas de referência do SIGMINE (ANM), com origem em CNUC/MMA, FUNAI, INCRA, IPHAN e IBGE. Consultado em 23/10/2026.",
  "Energia: EPE (Webmap EPE: parques eólicos, usinas solares, linhas e subestações existentes e planejadas; projetos não operacionais 2025) e cadastro ANEEL/SIGA.",
  "Uso e cobertura da terra: MapBiomas Coleção 11 (mapas anuais de 1985 a 2025, resolução original de 30 m), lidos da Plataforma MapBiomas em 23/10/2026. A série histórica usa uma grade de cerca de 550 m e o mapa de 2025 uma grade de cerca de 220 m.",
  "CAR/CEFIR: SICAR (Serviço Florestal Brasileiro), camada pública da Bahia, que recebe os cadastros do CEFIR/INEMA, incluindo os coletivos de povos e comunidades tradicionais. A lista completa do raio é consultada no SICAR no momento da consulta; sem internet, o aplicativo usa a cópia de 23/10/2026 dos coletivos e grandes imóveis (mais de 15 módulos fiscais)."
];
$("foot").textContent="Versão de teste em campo. Os dados vêm de bases públicas oficiais e podem estar desatualizados ou incompletos. Estar perto de um processo ou projeto não significa que haverá obra ou mina: cada etapa explica o que já foi autorizado. Nomes de pessoas físicas são ocultados. Os dados pessoais, registros e territórios são enviados para uma pasta restrita da equipe no Google Drive; enquanto não há internet, ficam guardados neste celular. A leitura do relatório em áudio será incluída na fase final.";

/* ---------- PDF ---------- */
function snapshot(bb,selPt){const S=900,off=document.createElement("canvas");off.width=S;off.height=S;const c=off.getContext("2d");const keep={view,W,H,sel};W=S;H=S;
  const cx=(bb.w+bb.e)/2,cy=(bb.s+bb.n)/2,kx=KXf(cy),span=Math.max((bb.e-bb.w)*kx,(bb.n-bb.s)*KY);view={w:cx-span/2/kx,e:cx+span/2/kx,s:cy-span/2/KY,n:cy+span/2/KY};
  if(!selPt)sel=null;drawNow(c,{scale:1,bg:"#eef0e8",ink:"#1b211e",noLoad:true,noSel:!selPt});view=keep.view;W=keep.W;H=keep.H;sel=keep.sel;return off.toDataURL("image/jpeg",0.85);}
let BANNER=null;fetch("icons/campanha.jpg").then(r=>r.ok?r.blob():null).then(b=>{if(!b)return;const fr=new FileReader();fr.onload=()=>{BANNER=fr.result;};fr.readAsDataURL(b);}).catch(()=>{});
function pdfDoc(){const {jsPDF}=window.jspdf;const doc=new jsPDF({unit:"mm",format:"a4",compress:true});const M=16,PW=210-2*M;const st={y:18};
  if(BANNER){try{const w=52,h=w*463/554;doc.addImage(BANNER,"JPEG",(210-w)/2,8,w,h);st.y=8+h+8;}catch(e){}}
  const need=h=>{if(st.y+h>282){doc.addPage();st.y=18;}};
  const T=(s,sz=10,f="normal",col=[27,33,30])=>{doc.setFont("helvetica",f);doc.setFontSize(sz);doc.setTextColor(...col);const L=doc.splitTextToSize(String(s),PW);need(L.length*sz*0.42+1);doc.text(L,M,st.y);st.y+=L.length*sz*0.42+1.5;};
  const H2=s=>{st.y+=3;need(12);doc.setDrawColor(200);doc.line(M,st.y-2,M+PW,st.y-2);T(s,13,"bold",[13,106,82]);};
  const IMG=(img,cap)=>{need(PW*0.62+8);doc.addImage(img,"JPEG",M+PW*0.19,st.y,PW*0.62,PW*0.62);st.y+=PW*0.62+2;T(cap,8,"normal",[90,99,93]);};
  const FIN=(name)=>{const n=doc.getNumberOfPages();for(let i=1;i<=n;i++){doc.setPage(i);doc.setFontSize(8);doc.setTextColor(120);doc.text(`Olho no Território · versão de teste · página ${i} de ${n}`,M,290);}return doc.output("blob");};
  const IMG2=(img,cap)=>{const h=PW*0.4;need(h+12);doc.addImage(img,"JPEG",M,st.y,PW,h);st.y+=h+2;T(cap,8,"normal",[90,99,93]);};
  const TABLE=(head,body,o={})=>{if(!doc.autoTable){T("(tabela indisponível: o gerador de tabelas não carregou)",8);return;}const cs={};Object.entries(o.colW||{}).forEach(([k,v])=>cs[k]={cellWidth:v});
    doc.autoTable({startY:st.y,head:[head],body,margin:{left:M,right:M,top:16,bottom:14},styles:{fontSize:o.fontSize||7.5,cellPadding:1,overflow:"linebreak",lineColor:[211,216,205],lineWidth:0.1},headStyles:{fillColor:[13,106,82],textColor:255,fontStyle:"bold"},alternateRowStyles:{fillColor:[244,246,241]},columnStyles:cs});st.y=doc.lastAutoTable.finalY+4;};
  return {doc,T,H2,IMG,IMG2,TABLE,FIN};}
async function makePDF(a){const pm=$("pdfmsg");if(!window.jspdf){pm.textContent="Não foi possível carregar o gerador de PDF.";return;}
  pm.textContent="Juntando a série histórica e a lista do CAR…";const wait=(p,ms)=>Promise.race([p||Promise.resolve(null),new Promise(r=>setTimeout(()=>r(null),ms))]);
  const S=await wait(a.seriesP,20000),CL=await wait(a.carP,40000);
  const {T,H2,IMG,IMG2,TABLE,FIN}=pdfDoc();const P=v=>(v<1&&v>0?"menos de 1":v.toFixed(0))+"%";
  T("Olho no Território",20,"bold");T("Relatório de consulta por ponto · Bahia",10,"normal",[90,99,93]);
  T(`Coordenadas: ${a.y.toFixed(5)}, ${a.x.toFixed(5)}`,11,"bold");
  T(`${a.mun?"Município: "+a.mun+" (BA)":"Município não identificado"}   Raio: ${a.R} km   Data: ${a.when.toLocaleString("pt-BR")}   Origem do ponto: ${sel&&sel.how||""}`,10);
  const span=Math.max(a.R*3.2,6)/111;IMG(snapshot({w:a.x-span/2,e:a.x+span/2,s:a.y-span/2,n:a.y+span/2},true),"Mapa: o ponto consultado está no centro; o círculo tracejado mostra o raio de busca.");
  H2("Resumo");summary(a).forEach(s=>T(`• ${s.b} ${s.t}`,10.5));
  H2("Mineração (ANM/SIGMINE)");const all=[...a.minIn,...a.minNear];
  if(!all.length)T(`Nenhum processo minerário a até ${a.R} km.`);else{T("Processos por etapa: "+Object.entries(STAGE).filter(([k])=>a.minStage[k]).map(([k,v])=>`${v.n}: ${a.minStage[k]}`).join("; ")+".");
    T("Lista completa dos processos no raio, com os mesmos campos do SIGMINE:",9.5);minTablePDF(TABLE,all,false);
    T("O que significa cada fase:",9.5,"bold");[...new Set(all.map(m=>m.fase))].forEach(f=>T(`• ${f}: ${(FASE[f]||{}).txt||""}`,8.5));}
  H2("Energia (EPE/ANEEL)");if(a.enR.length)a.enR.forEach(e=>T(`${e.d===0?"NO PONTO":"a "+fmtKm(e.d)} | ${e.tipo==="UFV"?"Solar":"Eólica"} ${e.name}${e.mw?" | "+fmtN(e.mw,1)+" MW":""} | ${e.fase}: ${enTxt(e.fase)}`,9.5));
  else T(`Nenhum parque eólico ou usina solar a até ${a.R} km.${a.enNearest?` Mais próximo: ${a.enNearest.name}, a ${fmtKm(a.enNearest.d)}.`:""}`);
  if(a.lte)T(`Linha de transmissão existente mais próxima: ${a.lte.name}, a ${fmtKm(a.lte.d)}.`,9.5);
  if(a.ltp)T(`Linha planejada mais próxima: ${a.ltp.name}${a.ltp.ano?" (previsão "+a.ltp.ano+")":""}, a ${fmtKm(a.ltp.d)}. O traçado ainda pode mudar.`,9.5);
  if(a.se)T(`Subestação mais próxima: ${a.se.name} (${a.se.kv} kV), a ${fmtKm(a.se.d)}.`,9.5);
  H2("Áreas protegidas, povos e comunidades");if(a.terr.length)a.terr.forEach(t=>T(`${t.d===0?"NO PONTO":"a "+fmtKm(t.d)} | ${t.lab}: ${t.name}`,9.5,"bold"));else T(`Nenhuma a até ${a.R} km.${a.terrNearest?` Mais próxima: ${a.terrNearest.name} (${a.terrNearest.lab}), a ${fmtKm(a.terrNearest.d)}.`:""}`);
  T(a.sa.length?`Sítios arqueológicos no raio: ${a.sa.length} (mais próximo: ${a.sa[0].name}, a ${fmtKm(a.sa[0].d)}).`:"Nenhum sítio arqueológico cadastrado no raio.",9.5);
  H2("CAR / CEFIR (SICAR)");T(a.car.at?"Há imóvel rural do CAR declarado sobre o ponto.":"Nenhum imóvel rural do CAR declarado sobre o ponto.",10,"bold");
  if(a.car.p1!=null)T(`${P(a.car.p1)} da área do raio tem imóvel rural do CAR declarado.`,9.5);
  a.car.coll.forEach(c=>T(`${c.d===0?"NO PONTO":"a "+fmtKm(c.d)} | ${c.tipo==="PCT"?"CEFIR coletivo (PCT)":"Assentamento no CAR"} | ${c.mun} | ${fmtN(c.area,1)} ha | ${c.cod} | ${c.st==="CA"?"cancelado":c.cond}${c.ovPct!=null?` | ${P(c.ovPct)} da área também declarada como imóvel individual`:""}`,9));
  if(CL&&CL.list.length){T(`Lista completa: ${fmtN(CL.list.length)} cadastros do CAR encostam no raio (consulta ao SICAR em ${CL.when.toLocaleString("pt-BR")}).${CL.trunc?` O raio tem ${fmtN(CL.matched)} cadastros; a lista traz os primeiros ${fmtN(CL.list.length)}.`:""}`,9.5);carTablePDF(TABLE,CL);}
  else{T("A lista completa do CAR não pôde ser consultada (sem internet ou SICAR fora do ar). Cadastros coletivos e grandes imóveis guardados no aplicativo:",9);a.car.big.forEach(b=>T(`${b.d===0?"NO PONTO":"a "+fmtKm(b.d)} | Grande imóvel | ${fmtN(b.area)} ha (${b.mf} MF) | ${b.cod} | ${b.mun}`,9));}
  T("O CAR é autodeclarado e a maioria dos cadastros aguarda análise do INEMA. Confirme cada caso com a comunidade.",8.5,"italic",[70,78,72]);
  H2("Uso e cobertura da terra (MapBiomas, série 1985–2025)");seriesPDF(T,IMG2,TABLE,S,"área do raio");
  if(a.lu.tot){if(a.luAt!=null&&a.luAt<250)T(`No ponto: ${luName(LEG[a.luAt][0])}.`,10,"bold");}
  H2("Fontes");SOURCES.forEach(s=>T("• "+s,8.5));
  H2("Como ler este relatório");T("Este relatório cruza o ponto escolhido com bases públicas oficiais. Estar perto de um processo ou projeto não significa que haverá obra ou mina; a etapa de cada processo indica o que já foi autorizado. As bases podem estar desatualizadas. Para confirmar, procure a ANM, a EPE/ANEEL, o INEMA, a Defensoria ou o Ministério Público. Nomes de pessoas físicas foram ocultados.",9);
  const blob=FIN(),fname=`relatorio-ponto_${a.y.toFixed(4)}_${a.x.toFixed(4)}.pdf`;pm.textContent="Preparando o arquivo…";
  const sent=sendReport(blob,fname,consultaData(a,CL));savePDF(blob,fname).then(async r=>{pm.textContent=r+" "+(await sent);}).catch(async()=>pm.textContent="Não foi possível baixar o PDF. "+(await sent));}
async function savePDF(blob,fname){
  try{const f=new File([blob],fname,{type:"application/pdf"});if(navigator.canShare&&navigator.canShare({files:[f]})&&/Android|iPhone|iPad/i.test(navigator.userAgent)){try{await navigator.share({files:[f],title:fname});return "PDF pronto. Escolha onde guardar ou com quem compartilhar.";}catch(e){if(e&&e.name==="AbortError")return "Compartilhamento cancelado.";}}}catch(e){}
  try{const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=fname;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),60000);return "PDF baixado. Procure na pasta Downloads do celular.";}catch(e){return "Não foi possível baixar o PDF.";}
}

/* ---------- território da comunidade ---------- */
let TERRS=[],curT=null,drawPts=null,db=null,usr=null,myId=null,canAdmin=false,REGS=[];
const tmsgEl=$("tmsg"),tformEl=$("tform"),tlistEl=$("tlist");
function tsay(t,err){tmsgEl.textContent=t;tmsgEl.className="msg"+(err?" err":"");}
async function unzip(buf){const dv=new DataView(buf);let e=buf.byteLength-22;while(e>=0&&dv.getUint32(e,true)!==0x06054b50)e--;if(e<0)throw new Error("O arquivo .zip parece estar corrompido.");
  const n=dv.getUint16(e+10,true);let p=dv.getUint32(e+16,true);const out={};
  for(let i=0;i<n;i++){const comp=dv.getUint16(p+10,true),csize=dv.getUint32(p+20,true),nl=dv.getUint16(p+28,true),xl=dv.getUint16(p+30,true),cl=dv.getUint16(p+32,true),off=dv.getUint32(p+42,true);
    const name=new TextDecoder().decode(new Uint8Array(buf,p+46,nl));const lnl=dv.getUint16(off+26,true),lxl=dv.getUint16(off+28,true);const data=new Uint8Array(buf,off+30+lnl+lxl,csize);
    if(!name.endsWith("/")){if(comp===0)out[name]=data.slice().buffer;else if(comp===8){if(typeof DecompressionStream==="undefined")throw new Error("Este navegador não abre arquivos .zip. Extraia o arquivo e envie o .shp e o .prj.");out[name]=await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer();}}
    p+=46+nl+xl+cl;}return out;}
function parseShp(buf){const dv=new DataView(buf);let p=100;const rings=[];while(p+12<=buf.byteLength){const len=dv.getInt32(p+4,false)*2;const t=dv.getInt32(p+8,true);
  if(t===5||t===15||t===25){const np=dv.getInt32(p+44,true),npt=dv.getInt32(p+48,true);const parts=[];for(let i=0;i<np;i++)parts.push(dv.getInt32(p+52+i*4,true));const base=p+52+np*4;
    for(let i=0;i<np;i++){const a=parts[i],b=i+1<np?parts[i+1]:npt;const r=[];for(let k=a;k<b;k++)r.push([dv.getFloat64(base+k*16,true),dv.getFloat64(base+k*16+8,true)]);rings.push(r);}}p+=8+len;}return rings;}
function parseKml(text){const doc=new DOMParser().parseFromString(text,"application/xml");const rings=[];const read=s=>s.trim().split(/\s+/).map(t=>t.split(",").map(Number)).filter(v=>v.length>=2&&isFinite(v[0])&&isFinite(v[1])).map(v=>[v[0],v[1]]);
  for(const pg of doc.getElementsByTagName("Polygon"))for(const c of pg.getElementsByTagName("coordinates"))rings.push(read(c.textContent));const nm=doc.getElementsByTagName("name")[0];return {rings,name:nm?nm.textContent.trim():""};}
function parseGeo(o){const rings=[];const add=g=>{if(!g)return;if(g.type==="Polygon")g.coordinates.forEach(r=>rings.push(r.map(p=>[p[0],p[1]])));else if(g.type==="MultiPolygon")g.coordinates.forEach(pl=>pl.forEach(r=>rings.push(r.map(p=>[p[0],p[1]]))));else if(g.type==="GeometryCollection")g.geometries.forEach(add);};
  if(o.type==="FeatureCollection")o.features.forEach(f=>add(f.geometry));else if(o.type==="Feature")add(o.geometry);else add(o);let name="";if(o.type==="FeatureCollection"&&o.features[0]&&o.features[0].properties)name=o.features[0].properties.nome||o.features[0].properties.name||"";return {rings,name};}
function rdp(pts,eps){if(pts.length<3)return pts;const keep=new Uint8Array(pts.length);keep[0]=keep[pts.length-1]=1;const st=[[0,pts.length-1]];while(st.length){const [a,b]=st.pop();let md=0,mi=-1;const [ax,ay]=pts[a],[bx,by]=pts[b];const dx=bx-ax,dy=by-ay,L=Math.hypot(dx,dy);for(let i=a+1;i<b;i++){const d=L?Math.abs(dy*pts[i][0]-dx*pts[i][1]+bx*ay-by*ax)/L:Math.hypot(pts[i][0]-ax,pts[i][1]-ay);if(d>md){md=d;mi=i;}}if(md>eps){keep[mi]=1;st.push([a,mi],[mi,b]);}}return pts.filter((p,i)=>keep[i]);}
function simpRing(r,eps){const p=r.slice(0,-1);let far=0,fd=0;p.forEach((q,i)=>{const d=Math.hypot(q[0]-p[0][0],q[1]-p[0][1]);if(d>fd){fd=d;far=i;}});const s=[...rdp(p.slice(0,far+1),eps),...rdp([...p.slice(far),p[0]],eps).slice(1)];return s.length>=4?s:r;}
function cleanRings(rings){rings=rings.map(r=>{r=r.filter(p=>isFinite(p[0])&&isFinite(p[1]));if(r.length&&(r[0][0]!==r[r.length-1][0]||r[0][1]!==r[r.length-1][1]))r.push(r[0].slice());return r;}).filter(r=>r.length>=4);
  let tot=rings.reduce((a,r)=>a+r.length,0),eps=0.00002;while(tot>4000&&eps<0.01){rings=rings.map(r=>simpRing(r,eps));tot=rings.reduce((a,r)=>a+r.length,0);eps*=2;}
  return rings.map(r=>r.map(([x,y])=>[+x.toFixed(6),+y.toFixed(6)]));}
function prjZone(prj){if(!prj)return null;const m=prj.match(/UTM[ _]*zone[ _]*(\d{1,2})\s*([NS])?/i)||prj.match(/zone[ _]*(\d{1,2})\s*([NS])/i);if(!m)return null;return {zone:+m[1],south:(m[2]||"S").toUpperCase()==="S"};}
async function readFiles(files){const ents={};let base="";
  for(const f of files){const low=f.name.toLowerCase();if(low.endsWith(".zip")||low.endsWith(".kmz")){Object.assign(ents,await unzip(await f.arrayBuffer()));base=base||f.name.replace(/\.(zip|kmz)$/i,"");}else ents[f.name]=await f.arrayBuffer();}
  const names=Object.keys(ents),find=ext=>names.find(n=>n.toLowerCase().endsWith(ext));let rings=[],name="",note="";
  const shp=find(".shp"),kml=find(".kml"),gj=find(".geojson")||find(".json");
  if(shp){rings=parseShp(ents[shp]);const prjN=names.find(n=>n.toLowerCase()===shp.toLowerCase().replace(/\.shp$/,".prj"))||find(".prj");const prj=prjN?new TextDecoder().decode(ents[prjN]):"";
    if(rings.some(r=>r.some(p=>Math.abs(p[0])>180||Math.abs(p[1])>90))){let z=prjZone(prj);if(!z){const E=rings[0][0][0];z={zone:E<500000?24:24,south:true};note="O arquivo está em coordenadas UTM sem indicação de fuso. Consideramos o fuso 24 Sul. Se o território ficar no lugar errado, envie também o arquivo .prj.";}rings=rings.map(r=>r.map(([E,N])=>utmToLL(E,N,z.zone,z.south)));}
    if(/SAD[ _]?69|Corrego/i.test(prj))note=(note?note+" ":"")+"O arquivo usa um datum antigo (SAD69 ou Córrego Alegre). A posição pode variar algumas dezenas de metros.";
    name=shp.split("/").pop().replace(/\.shp$/i,"");}
  else if(kml){const k=parseKml(new TextDecoder().decode(ents[kml]));rings=k.rings;name=k.name;}
  else if(gj){const g=parseGeo(JSON.parse(new TextDecoder().decode(ents[gj])));rings=g.rings;name=g.name;}
  else throw new Error("Não encontrei um polígono. Envie o .zip do CEFIR/SICAR, um KML/KMZ ou um GeoJSON.");
  rings=cleanRings(rings);if(!rings.length)throw new Error("O arquivo não tem polígonos válidos.");return {rings,name:name||base||"Território",note};}
$("tfile").addEventListener("change",async e=>{const files=[...e.target.files];e.target.value="";if(!files.length)return;tsay("Lendo o arquivo…");
  try{const r=await readFiles(files);startTerritory({rings:r.rings,name:r.name,origem:"arquivo"});tsay(r.note||"");}catch(err){tsay(err.message||"Não foi possível ler o arquivo.",true);}});
const drawbar=$("tdrawbar"),drawinfo=$("tdrawinfo");
function updDraw(){drawinfo.textContent=drawPts.length<3?`Toque no mapa para marcar os cantos do território (${drawPts.length} marcado${drawPts.length===1?"":"s"}).`:`${drawPts.length} cantos marcados. Toque em Concluir quando fechar o contorno.`;}
$("tdraw").onclick=()=>{drawPts=[];drawbar.hidden=false;tformEl.hidden=true;updDraw();$("hint").textContent="Modo desenho: toque nos cantos do território";tsay("");if(vw()>0.5&&sel)centerOn(sel.x,sel.y,0.15);draw();$("map").scrollIntoView({behavior:"smooth",block:"start"});};
$("tundo").onclick=()=>{if(drawPts&&drawPts.length){drawPts.pop();updDraw();draw();}};
$("tcancel").onclick=()=>{drawPts=null;drawbar.hidden=true;$("hint").textContent="Toque no mapa para escolher um ponto";draw();};
$("tdone").onclick=()=>{if(!drawPts||drawPts.length<3){tsay("Marque pelo menos 3 cantos.",true);return;}const ring=[...drawPts,drawPts[0]].map(([x,y])=>[+x.toFixed(6),+y.toFixed(6)]);drawPts=null;drawbar.hidden=true;$("hint").textContent="Toque no mapa para escolher um ponto";startTerritory({rings:[ring],name:"",origem:"desenho"});};
function useCarPct(c){if(!c)return;startTerritory({rings:c.r,name:`CEFIR coletivo · ${c.mun}`,cod:c.cod,origem:"SICAR",tipo:""});}
function startTerritory(t){curT=Object.assign({saved:false},t);curT.bb=bboxR(curT.rings);fitTo(curT.bb);sel=null;draw();
  tformEl.hidden=false;tformEl.className="tform";
  tformEl.innerHTML=`<label>Nome do território<input id="tnome" value="${esc(t.name||"")}" placeholder="Ex.: Fundo de pasto Lagoa do Mato"></label>
    <label>Tipo de comunidade<select id="ttipo">${TIPOS.map(x=>`<option${x===t.tipo?" selected":""}>${x}</option>`).join("")}</select></label>
    <label>Número do CEFIR / CAR (se houver)<input id="tcod" value="${esc(t.cod||"")}" placeholder="BA-0000000-…"></label>
    <label>Nome do titular ou responsável pelo CAR (se souber)<input id="tdono" value="${esc(t.dono||"")}" maxlength="160" placeholder="Para controle em caso de sobreposição"></label>
    <div class="row"><button type="button" class="btn sm" id="tkml">Baixar perímetro (KML)</button><button type="button" class="btn sm" id="tgeo">Baixar perímetro (GeoJSON)</button></div>
    <label class="chk"><input type="checkbox" id="tsave" checked> <span>Guardar este território e enviar para o banco de dados do projeto.</span></label>
    <div class="row"><button type="button" class="btn primary" id="tgo">Analisar território</button><button type="button" class="btn" id="tdiscard">Descartar</button></div>`;
  $("tkml").onclick=()=>dlPerimeter(Object.assign({},curT,{name:$("tnome").value.trim()||curT.name}),"kml");$("tgeo").onclick=()=>dlPerimeter(Object.assign({},curT,{name:$("tnome").value.trim()||curT.name}),"geojson");
  $("tgo").onclick=async()=>{curT.name=$("tnome").value.trim()||"Território sem nome";curT.tipo=$("ttipo").value;curT.cod=$("tcod").value.trim();curT.dono=$("tdono").value.trim();
    const sv=$("tsave"),doSave=sv&&sv.checked;tformEl.hidden=true;$("out").innerHTML=`<div class="loading"><span class="spin"></span>Cruzando as bases com o território…</div>`;$("out").scrollIntoView({behavior:"smooth",block:"start"});
    try{const r=await analyzeTerritory(curT);if(doSave)await saveTerritory(curT,r);renderTerritory(r);}catch(e){$("out").innerHTML=`<div class="placeholder"><p><strong>Não foi possível analisar o território.</strong></p><p>${esc(e.message||"")}</p></div>`;}};
  $("tdiscard").onclick=()=>{curT=null;tformEl.hidden=true;draw();tsay("");};
  tsay(t.origem==="SICAR"?"Perímetro do CAR carregado. Confira o nome e o tipo de comunidade.":"Território carregado. Confira os dados abaixo.");
  $("terrPanel").scrollIntoView({behavior:"smooth",block:"nearest"});}
const bbOv=(a,b)=>!(a.e<b.w||a.w>b.e||a.n<b.s||a.s>b.n);
function areaHa(rings){let tot=0;const kx=KXf((bboxR(rings).s+bboxR(rings).n)/2);for(const r of rings){let s=0;for(let i=0;i<r.length-1;i++)s+=(r[i][0]*kx)*(r[i+1][1]*KY)-(r[i+1][0]*kx)*(r[i][1]*KY);tot+=s/2;}return Math.abs(tot)*100;}
function polyLineD(rings,paths){let m=1e9;for(const p of paths)for(const [x,y] of p){const d=polyD(x,y,rings);if(d<m)m=d;if(m===0)return 0;}for(const r of rings)for(const [x,y] of r){const d=lineD(x,y,paths);if(d<m)m=d;}return m;}
function polyPolyD(a,b){let m=1e9;for(const r of b)for(const [x,y] of r){const d=polyD(x,y,a);if(d<m)m=d;if(m===0)return 0;}for(const r of a)for(const [x,y] of r){const d=polyD(x,y,b);if(d<m)m=d;if(m===0)return 0;}return m;}
async function analyzeTerritory(t){
  const Rg=t.rings,bb=bboxR(Rg);if((bb.e-bb.w)>3||(bb.n-bb.s)>3)throw new Error("O território é grande demais para esta versão (mais de 3 graus).");
  const tiles=await ensure(bb.w-0.1,bb.s-0.1,bb.e+0.1,bb.n+0.1);
  const kx=KXf((bb.s+bb.n)/2),wkm=Math.max(.05,(bb.e-bb.w)*kx),hkm=Math.max(.05,(bb.n-bb.s)*KY);
  const step=Math.max(0.015,Math.sqrt(wkm*hkm/45000)),sx=step/kx,sy=step/KY,cellHa=step*step*100;
  const MINS=tiles.flatMap(x=>x.min),BIGS=tiles.flatMap(x=>x.big);
  const pick=arr=>arr.map((o,i)=>({o,i})).filter(({o})=>bbOv(o.bb,bb));
  const cMin=pick(MINS),cBig=pick(BIGS),cColl=pick(CARC).filter(({o})=>o.cod!==t.cod),cUC=pick(UC),cTI=pick(TI),cQU=pick(QU),cAS=pick(AS),cEP=pick(EOLP),cMU=pick(MUN);
  const cnt={tot:0,anyMin:0,stage:{}},by=(m,k)=>m.set(k,(m.get(k)||0)+1);
  const mMin=new Map(),mBig=new Map(),mColl=new Map(),mUC=new Map(),mTI=new Map(),mQU=new Map(),mAS=new Map(),mEP=new Map(),mMU=new Map();const rank={ex:5,px:4,pe:3,pp:2,di:1};
  for(let y=bb.s+sy/2;y<bb.n;y+=sy)for(let x=bb.w+sx/2;x<bb.e;x+=sx){if(!inPoly(x,y,Rg))continue;cnt.tot++;
    let best=null;for(const {o,i} of cMin){const b=o.bb;if(x<b.w||x>b.e||y<b.s||y>b.n)continue;if(inPoly(x,y,o.r)){by(mMin,i);if(!best||rank[o.st]>rank[best])best=o.st;}}
    if(best){cnt.anyMin++;cnt.stage[best]=(cnt.stage[best]||0)+1;}
    const test=(arr,m)=>{for(const {o,i} of arr){const b=o.bb;if(x<b.w||x>b.e||y<b.s||y>b.n)continue;if(inPoly(x,y,o.r))by(m,i);}};
    test(cBig,mBig);test(cColl,mColl);test(cUC,mUC);test(cTI,mTI);test(cQU,mQU);test(cAS,mAS);test(cEP,mEP);test(cMU,mMU);}
  const tot=Math.max(1,cnt.tot),pc=n=>n/tot*100,ha=n=>n*cellHa;
  const list=(m,arr)=>[...m.entries()].map(([i,n])=>Object.assign({n,pct:pc(n),ha:ha(n)},arr[i])).sort((a,b)=>b.n-a.n);
  const res={t,area:areaHa(Rg),samples:cnt.tot,stepM:Math.round(step*1000),when:new Date(),mun:list(mMU,MUN).map(m=>m.name),
    min:list(mMin,MINS),minPct:pc(cnt.anyMin),stage:Object.fromEntries(Object.entries(cnt.stage).map(([k,n])=>[k,pc(n)])),
    uc:list(mUC,UC),ti:list(mTI,TI),qu:list(mQU,QU),as:list(mAS,AS),eolIn:list(mEP,EOLP)};
  const cs=rasterInPoly("car",Rg,bb);res.car={pct:cs.tot?(cs.cnt.get(1)||0)/cs.tot*100:0,ha:cs.tot?(cs.cnt.get(1)||0)/cs.tot*res.area:0,big:list(mBig,BIGS),coll:list(mColl,CARC)};
  const ls=rasterInPoly("lu",Rg,bb);res.lu=[...ls.cnt.entries()].filter(([k])=>k<250).map(([k,n])=>({k,pct:n/ls.tot*100})).sort((a,b)=>b.pct-a.pct);
  const inE=new Set([...mEP.keys()].map(i=>EOLP[i]));
  res.enNear=[...EOLP.filter(e=>!inE.has(e)&&bbOv(e.bb,{w:bb.w-0.12,e:bb.e+0.12,s:bb.s-0.12,n:bb.n+0.12})).map(e=>Object.assign({d:polyPolyD(Rg,e.r)},e)),
    ...ENP.filter(e=>bbOv(e.bb,{w:bb.w-0.12,e:bb.e+0.12,s:bb.s-0.12,n:bb.n+0.12})).map(e=>Object.assign({d:polyD(e.p[0],e.p[1],Rg)},e))].filter(e=>e.d===0).sort((a,b)=>a.d-b.d);
  const near=(arr)=>{let best=null;const cx=(bb.w+bb.e)/2,cy=(bb.s+bb.n)/2;const cand=arr.map(l=>({l,lb:bbD(l.bb,cx,cy)})).sort((a,b)=>a.lb-b.lb).slice(0,25);for(const {l} of cand){const d=polyLineD(Rg,l.r);if(!best||d<best.d)best=Object.assign({d},l);}return best;};
  res.lte=near(LTE);res.ltp=near(LTP);
  res.sa=SA.filter(s=>bbOv(s.bb,bb)&&inPoly(s.p[0],s.p[1],Rg));res.inBA=[[bb.w,bb.s],[bb.e,bb.n],[(bb.w+bb.e)/2,(bb.s+bb.n)/2]].every(([x,y])=>inBahia(x,y));
  res.series=await seriesPoly(Rg,bb).catch(()=>null);
  res.carP=navigator.onLine?carListPoly(Rg,bb).catch(e=>({err:e.message||"sem resposta"})):Promise.resolve({err:"offline"});
  return res;}
function renderTerritory(r){const t=r.t,out=$("out"),d=r.when.toLocaleDateString("pt-BR",{day:"2-digit",month:"long",year:"numeric"});
  const ltIn=[r.lte,r.ltp].filter(l=>l&&l.d===0);
  const chips=[{k:r.car.pct>=30?"in":(r.car.pct>0?"near":"none"),b:pf(r.car.pct),t:"do território com imóvel individual do CAR declarado"},
    {k:r.min.length?(r.stage.ex||r.stage.px?"in":"near"):"none",b:r.min.length,t:r.min.length?`processo${r.min.length>1?"s":""} de mineração sobre ${pf(r.minPct)} do território`:"sem processo de mineração sobre o território"},
    {k:(r.eolIn.length+r.enNear.length)?"in":"none",b:r.eolIn.length+r.enNear.length,t:(r.eolIn.length+r.enNear.length)?"projeto eólico ou solar dentro do território":"sem projeto eólico ou solar dentro do território"},
    {k:ltIn.length?"in":"none",b:ltIn.length?"Sim":"Não",t:ltIn.length?"linha de transmissão cruza o território":"nenhuma linha de transmissão cruza o território"}];
  let h=`<div class="rep"><div class="head"><h2>${esc(t.name)}</h2><div style="color:var(--mute);font-size:14px">${esc(t.tipo||"")} · ${fmtN(r.area,1)} ha · ${r.mun.length?esc(r.mun.join(", "))+" (BA)":"município não identificado"}${t.cod?" · "+esc(t.cod):""} · ${d}</div>
    <div style="color:var(--mute);font-size:13px">Origem do limite: ${t.origem==="SICAR"?"cadastro coletivo no SICAR/CEFIR":t.origem==="desenho"?"desenhado no mapa":"arquivo enviado"}${t.saved?" · salvo no projeto":""}</div></div>
    ${r.inBA?"":`<p class="warnbox">Parte do território pode estar fora da Bahia. Os resultados valem só para a parte coberta pelos dados.</p>`}
    <div class="chips">${chips.map(s=>`<div class="chip ${s.k}"><b>${s.b}</b><span>${s.t}</span></div>`).join("")}</div>`;
  h+=`<section class="blk"><h3>CAR / CEFIR dentro do território</h3><div id="tcarfull"><div class="loading" style="padding:8px 0"><span class="spin"></span>Buscando no SICAR todos os cadastros que se sobrepõem ao território…</div></div><div class="bars"><div class="bar"><span>Com imóvel individual</span><div class="track"><div class="fill" style="width:${r.car.pct}%;background:#7f95b3"></div></div><span class="v">${pf(r.car.pct)}</span></div></div>
    <p style="margin:0;color:var(--mute);font-size:14px">Cerca de ${fmtN(r.car.ha)} ha do território estão declarados como imóveis rurais individuais no CAR.</p>`;
  r.car.big.forEach(b=>{h+=`<div class="item"><span class="tag in">${pf(b.pct)}</span><div><p class="what">Grande imóvel · ${fmtN(b.area)} ha no total (${String(b.mf).replace(".",",")} módulos fiscais)</p><p class="meta">${esc(b.cod)} · cobre cerca de ${fmtN(b.ha)} ha do território</p></div></div>`;});
  r.car.coll.forEach(c=>{h+=`<div class="item"><span class="tag near">${pf(c.pct)}</span><div><p class="what">${c.tipo==="PCT"?"Outro cadastro coletivo (PCT)":"Assentamento no CAR"}${c.st==="CA"?" · cancelado":""}</p><p class="meta">${esc(c.cod)} · ${esc(c.mun)} · ${fmtN(c.area,1)} ha</p></div></div>`;});
  h+=`<p class="plain">Imóvel individual dentro de território coletivo pode ser lote de morador ou indicar conflito ou grilagem. A comunidade deve conferir cada caso. Os cadastros são autodeclarados e a maioria aguarda análise do INEMA.</p></section>`;
  h+=`<section class="blk"><h3>Mineração</h3>`;
  if(!r.min.length)h+=`<p class="empty">Nenhum processo minerário sobre o território.</p>`;
  else{h+=`<div class="bars">${Object.entries(STAGE).filter(([k])=>r.stage[k]).map(([k,v])=>`<div class="bar"><span>${v.n}</span><div class="track"><div class="fill" style="width:${r.stage[k]}%;background:${v.c}"></div></div><span class="v">${pf(r.stage[k])}</span></div>`).join("")}</div><p style="margin:0;color:var(--mute);font-size:14px">Percentual da área do território coberta por processos em cada etapa (vale a etapa mais avançada).</p>`;
    h+=r.min.slice(0,8).map(m=>`<div class="item"><span class="tag in">${pf(m.pct)}</span><div><p class="what">${esc(m.subs.charAt(0)+m.subs.slice(1).toLowerCase())} · ${esc(m.fase.toLowerCase())}</p><p class="meta">Titular: ${esc(titular(m.nome))} · Processo ${esc(m.proc)} · cerca de ${fmtN(m.ha)} ha dentro do território</p><p class="plain">${esc((FASE[m.fase]||{}).txt||"")}</p></div></div>`).join("");
    if(r.min.length>8)h+=`<p class="empty">E mais ${r.min.length-8} processos.</p>`;h+=minTableHTML(r.min).replace("<th>Distância</th>","<th>% do território</th>").replace(/<td>(no ponto|[\d,.]+ (m|km))<\/td>/g,"<td>$1</td>");}
  h+=`</section><section class="blk"><h3>Energia</h3>`;
  r.eolIn.forEach(e=>{h+=`<div class="item"><span class="tag in">${pf(e.pct)}</span><div><p class="what">Parque eólico ${esc(e.name)} · ${fmtN(e.mw,1)} MW</p><p class="plain">${esc(enTxt(e.fase))}</p></div></div>`;});
  r.enNear.forEach(e=>{h+=`<div class="item"><span class="tag in">Dentro</span><div><p class="what">${e.tipo==="UFV"?"Usina solar":"Parque eólico"} ${esc(e.name)}${e.mw?" · "+fmtN(e.mw,1)+" MW":""}</p><p class="meta">${esc(enTxt(e.fase))}</p></div></div>`;});
  if(!r.eolIn.length&&!r.enNear.length)h+=`<p class="empty">Nenhum parque eólico ou usina solar dentro do território.</p>`;
  ltIn.forEach(l=>{h+=`<div class="item"><span class="tag in">Cruza</span><div><p class="what">${l.plan?"Linha de transmissão planejada":"Linha de transmissão existente"}</p><p class="meta">${esc(l.name)}${l.ano?(l.plan?" · previsão ":" · desde ")+l.ano:""}</p></div></div>`;});
  if(!ltIn.length)h+=`<p class="empty">Nenhuma linha de transmissão, existente ou planejada, cruza o território.</p>`;
  h+=`</section><section class="blk"><h3>Áreas protegidas, povos e comunidades</h3>`;
  const TT=[...r.uc.map(x=>["Unidade de conservação",x]),...r.ti.map(x=>["Terra indígena",x]),...r.qu.map(x=>["Território quilombola",x]),...r.as.map(x=>["Assentamento (INCRA)",x])];
  h+=TT.length?TT.map(([l,x])=>`<div class="item"><span class="tag in">${pf(x.pct)}</span><div><p class="what">${esc(x.name)}</p><p class="meta">${l} · cerca de ${fmtN(x.ha)} ha em comum</p></div></div>`).join(""):`<p class="empty">Nenhuma sobreposição com unidades de conservação, terras indígenas, territórios quilombolas ou assentamentos do INCRA.</p>`;
  h+=`<p class="empty">${r.sa.length?`${r.sa.length} sítio(s) arqueológico(s) dentro do território.`:"Nenhum sítio arqueológico cadastrado dentro do território."}</p></section>`;
  h+=`<section class="blk"><h3>Uso e cobertura da terra</h3>${seriesBlock(r.series,"chartT")}</section>`;
  if(false)h+=`<section class="blk"><h3>Uso e cobertura da terra</h3><div class="bars">${r.lu.slice(0,7).map(c=>`<div class="bar"><span>${esc(luName(LEG[c.k][0]))}</span><div class="track"><div class="fill" style="width:${c.pct}%;background:#${LEG[c.k][1]}"></div></div><span class="v">${pf(c.pct)}</span></div>`).join("")}</div><p class="empty" style="font-size:13px">MapBiomas 2024.</p></section>`;
  h+=`<section class="blk"><div class="row">${!t.saved?`<button type="button" class="btn" id="tsave2">Guardar e enviar</button>`:""}<button type="button" class="btn primary" id="tpdf">Gerar relatório do território em PDF</button></div><p class="msg" id="tpdfmsg" role="status"></p></section>
    <section class="blk"><details><summary>Como foi calculado</summary><p class="src">O território foi coberto por ${fmtN(r.samples)} pontos de amostra, um a cada ${r.stepM} m aproximadamente, e cada ponto foi cruzado com as bases. CAR e uso da terra usam células de cerca de 220 m. Áreas e percentuais são aproximados.</p></details></section></div>`;
  out.innerHTML=h;styleBlocks(out);wireChart("chartT",r.series);
  r.carP.then(L=>{r.carL=L&&!L.err?L:null;const el=$("tcarfull");if(!el)return;el.innerHTML=L&&!L.err?carListHTML({...L,list:L.list.filter(c=>c.cod!==t.cod)},true):`<p class="warnbox">${L&&L.err==="offline"?"Sem internet: a lista completa dos cadastros sobrepostos é consultada no SICAR. Abaixo estão os coletivos e os grandes imóveis guardados no celular.":"Não foi possível buscar a lista completa no SICAR agora. Tente de novo mais tarde."}</p>`;if(L&&!L.err){CARLIST=L;draw();}});
 $("tpdf").onclick=()=>makeTerrPDF(r);const s2=$("tsave2");if(s2)s2.onclick=async()=>{await saveTerritory(t,r);renderTerritory(r);};}
async function makeTerrPDF(r){const pm=$("tpdfmsg");if(!window.jspdf){pm.textContent="Não foi possível carregar o gerador de PDF.";return;}
  pm.textContent="Juntando a lista do CAR…";if(r.carP&&!r.carL){const L=await Promise.race([r.carP,new Promise(z=>setTimeout(()=>z(null),40000))]);if(L&&!L.err)r.carL=L;}
  const t=r.t,{T,H2,IMG,IMG2,TABLE,FIN}=pdfDoc(),P=v=>(v<1&&v>0?"menos de 1":v.toFixed(0))+"%";
  T("Olho no Território",20,"bold");T("Relatório de sobreposições no território da comunidade · Bahia",10,"normal",[90,99,93]);
  T(t.name,14,"bold");T(`${t.tipo||""} · ${fmtN(r.area,1)} ha · ${r.mun.join(", ")||"município não identificado"} (BA)${t.cod?" · "+t.cod:""}`,10);
  T(`Origem do limite: ${t.origem==="SICAR"?"cadastro coletivo no SICAR/CEFIR":t.origem==="desenho"?"desenhado no mapa":"arquivo enviado pela comunidade"} · Data: ${r.when.toLocaleString("pt-BR")}`,9,"normal",[90,99,93]);
  const bb=bboxR(t.rings),m=Math.max(bb.e-bb.w,bb.n-bb.s)*0.25+0.01;IMG(snapshot({w:bb.w-m,e:bb.e+m,s:bb.s-m,n:bb.n+m},false),"Mapa: o território aparece em rosa. Grandes imóveis do CAR em linha tracejada escura; processos minerários em vermelho e laranja.");
  H2("CAR / CEFIR");if(t.cod)T(`CAR/CEFIR do território: ${t.cod}${t.dono?" · titular ou responsável informado: "+t.dono:""}`,10,"bold");else if(t.dono)T(`Titular ou responsável informado: ${t.dono}`,10,"bold");T(`${P(r.car.pct)} do território (cerca de ${fmtN(r.car.ha)} ha) tem imóvel rural individual declarado no CAR.`,10.5);
  if(r.carL&&r.carL.list.length){const L={...r.carL,list:r.carL.list.filter(c=>c.cod!==t.cod)};T(`${fmtN(L.list.length)} cadastro(s) do CAR se sobrepõem ao território (consulta ao SICAR em ${r.carL.when.toLocaleString("pt-BR")}). A coluna "% do território" mostra a parte do território coberta por cada um.`,9.5);carTablePDF(TABLE,L,true);}
  r.car.big.forEach(b=>T(`Grande imóvel ${b.cod} (${fmtN(b.area)} ha, ${b.mf} MF): cobre cerca de ${fmtN(b.ha)} ha (${P(b.pct)}) do território.`,9.5));
  r.car.coll.forEach(c=>T(`${c.tipo==="PCT"?"Outro cadastro coletivo":"Assentamento no CAR"} ${c.cod}${c.st==="CA"?" (cancelado)":""}: ${P(c.pct)} do território.`,9.5));
  T("O CAR é autodeclarado e a maioria dos cadastros aguarda análise do INEMA. Confira cada caso com a comunidade.",8.5,"italic",[70,78,72]);
  H2("Mineração (ANM/SIGMINE)");if(!r.min.length)T("Nenhum processo minerário sobre o território.");else{T(`${r.min.length} processo(s) sobre ${P(r.minPct)} do território. `+Object.entries(STAGE).filter(([k])=>r.stage[k]).map(([k,v])=>`${v.n}: ${P(r.stage[k])}`).join("; ")+".",10);
    minTablePDF(TABLE,r.min,true);T("O que significa cada fase:",9.5,"bold");[...new Set(r.min.map(m=>m.fase))].forEach(f=>T(`• ${f}: ${(FASE[f]||{}).txt||""}`,8.5));}
  H2("Energia (EPE/ANEEL)");r.eolIn.forEach(e=>T(`SOBRE O TERRITÓRIO (${P(e.pct)}): ${e.name}, ${fmtN(e.mw,1)} MW, ${e.fase}. ${enTxt(e.fase)}`,9.5));
  r.enNear.forEach(e=>T(`DENTRO DO TERRITÓRIO: ${e.tipo==="UFV"?"usina solar":"parque eólico"} ${e.name}${e.mw?", "+fmtN(e.mw,1)+" MW":""}, ${e.fase}.`,9.5));
  if(!r.eolIn.length&&!r.enNear.length)T("Nenhum parque eólico ou usina solar dentro do território.");
  const ltIn=[r.lte,r.ltp].filter(l=>l&&l.d===0);ltIn.forEach(l=>T(`${l.plan?"Linha planejada":"Linha de transmissão"} cruza o território: ${l.name}.`,9.5));if(!ltIn.length)T("Nenhuma linha de transmissão, existente ou planejada, cruza o território.",9.5);
  H2("Áreas protegidas, povos e comunidades");const TT=[...r.uc.map(x=>["Unidade de conservação",x]),...r.ti.map(x=>["Terra indígena",x]),...r.qu.map(x=>["Território quilombola",x]),...r.as.map(x=>["Assentamento (INCRA)",x])];
  if(TT.length)TT.forEach(([l,x])=>T(`${l}: ${x.name} (${P(x.pct)} do território)`,9.5));else T("Nenhuma sobreposição.");
  T(r.sa.length?`${r.sa.length} sítio(s) arqueológico(s) dentro do território.`:"Nenhum sítio arqueológico cadastrado dentro do território.",9.5);
  H2("Uso e cobertura da terra (MapBiomas, série 1985–2025)");seriesPDF(T,IMG2,TABLE,r.series,"área do território");
  H2("Fontes");SOURCES.forEach(s=>T("• "+s,8.5));T(`Cálculo por amostragem com ${fmtN(r.samples)} pontos dentro do território. Valores aproximados.`,8.5,"italic",[70,78,72]);
  const blob=FIN(),fname=`territorio_${t.name.normalize("NFD").replace(/[^\w]+/g,"-").replace(/^-|-$/g,"").toLowerCase()||"comunidade"}.pdf`;pm.textContent="Preparando o arquivo…";
  if(!t.saved)await saveTerritory(t,r);const sent=sendReport(blob,fname,{tipoRelatorio:"territorio",territorioId:t.id||"",nome:t.name,tipo:t.tipo||"",cod:t.cod||"",titularInformado:t.dono||"",areaHa:+r.area.toFixed(1),municipios:r.mun,resumo:terrSummary(r),carSobrepostos:r.carL?r.carL.list.filter(c=>c.cod!==t.cod).map(c=>c.cod+" ("+(c.pct<1?"<1":Math.round(c.pct))+"%)"):[]});
  savePDF(blob,fname).then(async m=>{pm.textContent=m+" "+(await sent);}).catch(async()=>pm.textContent="Não foi possível baixar o PDF. "+(await sent));}
/* ---------- cadastro da pessoa, banco local e envio para o Google Drive ---------- */
const VER="1.1.1";
const lsGet=k=>{try{return JSON.parse(localStorage.getItem(k)||"null");}catch(e){return null;}};
const lsSet=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true;}catch(e){return false;}};
const uid=()=>(crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2));
const CFG=Object.assign({endpoint:"",token:"",org:"equipe do projeto Olho no Território"},window.OT_CONFIG||{},lsGet("ot_cfg")||{});
let PESSOA=lsGet("ot_pessoa");
TERRS=lsGet("ot_terr")||[]; REGS=lsGet("ot_reg")||[];
const saveLists=()=>{const a=lsSet("ot_terr",TERRS),b=lsSet("ot_reg",REGS);return a&&b;};
const IDB=(()=>{let p=null;const open=()=>p||(p=new Promise((res,rej)=>{const r=indexedDB.open("olho-territorio",1);r.onupgradeneeded=()=>r.result.createObjectStore("fila",{keyPath:"id"});r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);}));
  const run=(mode,fn)=>open().then(d=>new Promise((res,rej)=>{const t=d.transaction("fila",mode);const q=fn(t.objectStore("fila"));t.oncomplete=()=>res(q&&q.result);t.onerror=()=>rej(t.error);t.onabort=()=>rej(t.error);}));
  return {put:v=>run("readwrite",s=>s.put(v)),del:k=>run("readwrite",s=>s.delete(k)),all:()=>run("readonly",s=>s.getAll())};})();

/* CPF */
const cpfDigits=s=>String(s||"").replace(/\D/g,"");
function cpfOk(s){const d=cpfDigits(s);if(d.length!==11||/^(\d)\1{10}$/.test(d))return false;const n=d.split("").map(Number);
  const dv=k=>{let sum=0;for(let i=0;i<k;i++)sum+=n[i]*(k+1-i);const r=(sum*10)%11;return r===10?0:r;};return dv(9)===n[9]&&dv(10)===n[10];}
const cpfFmt=s=>{const d=cpfDigits(s).slice(0,11);return d.replace(/^(\d{3})(\d)/,"$1.$2").replace(/^(\d{3})\.(\d{3})(\d)/,"$1.$2.$3").replace(/\.(\d{3})(\d{1,2})$/,".$1-$2");};
const cpfMask=s=>{const d=cpfDigits(s);return d.length===11?`***.${d.slice(3,6)}.***-**`:"";};
const normTxt=s=>String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().trim();

/* tela de cadastro */
const gate=$("gate"),app=$("app");
function showGate(novo){
  const p=novo?null:PESSOA;gate.hidden=false;app.hidden=true;window.scrollTo(0,0);
  $("gform").innerHTML=`
    <label>Nome completo<input id="pnome" autocomplete="name" maxlength="140" value="${esc(p&&p.nome||"")}" placeholder="Como está no documento"></label>
    <label>CPF<input id="pcpf" inputmode="numeric" autocomplete="off" maxlength="14" value="${esc(p?cpfFmt(p.cpf):"")}" placeholder="000.000.000-00"></label>
    <label>Data de nascimento<input id="pnasc" type="date" min="1900-01-01" max="${new Date().toISOString().slice(0,10)}" value="${esc(p&&p.nascimento||"")}"></label>
    <label>Nome da comunidade<input id="pcom" maxlength="140" value="${esc(p&&p.comunidade||"")}" placeholder="Ex.: Fundo de pasto Lagoa do Mato"></label>
    <label>Município<input id="pmun" list="munlist" autocomplete="off" maxlength="80" value="${esc(p&&p.municipio||"")}" placeholder="Comece a digitar e escolha da lista"></label>
    <div class="consent"><p><strong>Para que servem esses dados.</strong> Seu nome, CPF, data de nascimento, comunidade e município ficam guardados junto com as informações que você registrar neste aplicativo, para que a ${esc(CFG.org)} saiba quem fez cada registro e possa entrar em contato. Os dados vão para uma pasta de acesso restrito da equipe e não serão divulgados nem vendidos. Você pode pedir para corrigir ou apagar seus dados a qualquer momento.</p>
    <label class="chk"><input type="checkbox" id="pok"${p&&p.consentimento?" checked":""}> <span>Li e concordo com o uso dos meus dados para esse fim.</span></label></div>
    <div class="row"><button type="button" class="btn primary" id="psave">${p?"Salvar alterações":"Salvar e começar"}</button>${PESSOA?`<button type="button" class="btn" id="pcancel">Voltar</button>`:""}</div>
    <p class="msg" id="pmsg" role="status"></p>`;
  const cpf=$("pcpf");cpf.addEventListener("input",()=>{const c=cpf.selectionStart===cpf.value.length;cpf.value=cpfFmt(cpf.value);if(c)cpf.selectionStart=cpf.selectionEnd=cpf.value.length;});
  if($("pcancel"))$("pcancel").onclick=hideGate;
  $("psave").onclick=async()=>{const m=$("pmsg");const err=t=>{m.textContent=t;m.className="msg err";};
    const nome=$("pnome").value.trim().replace(/\s+/g," "),cpfv=cpfDigits($("pcpf").value),nasc=$("pnasc").value,com=$("pcom").value.trim(),munv=$("pmun").value.trim();
    if(nome.split(" ").filter(w=>w.length>1).length<2)return err("Escreva o nome completo (nome e sobrenome).");
    if(!cpfOk(cpfv))return err("O CPF não é válido. Confira os 11 números.");
    if(!nasc||nasc<"1900-01-01"||nasc>new Date().toISOString().slice(0,10))return err("Informe uma data de nascimento válida.");
    if(com.length<2)return err("Escreva o nome da comunidade.");
    const munOk=MUN.find(x=>normTxt(x.name)===normTxt(munv));if(!munOk)return err("Escolha o município da lista (municípios da Bahia).");
    if(!$("pok").checked)return err("Para continuar, é preciso concordar com o uso dos dados.");
    const changed=!PESSOA||PESSOA.cpf!==cpfv;
    PESSOA={id:changed?uid():PESSOA.id,nome,cpf:cpfv,nascimento:nasc,comunidade:com,municipio:munOk.name,consentimento:true,consentimentoEm:new Date().toISOString(),textoConsentimento:"v1"};
    lsSet("ot_pessoa",PESSOA);await enqueue("cadastro",{});hideGate();};
  setTimeout(()=>{const f=$("pnome");if(f&&!f.value)f.focus();},50);
}
function hideGate(){gate.hidden=true;app.hidden=false;renderWho();resize();}
function renderWho(){const w=$("who");if(!PESSOA){w.innerHTML="";return;}
  w.innerHTML=`<div class="nm"><b>${esc(PESSOA.nome)}</b><span>${esc(PESSOA.comunidade)} · ${esc(PESSOA.municipio)} · CPF ${cpfMask(PESSOA.cpf)}</span></div>
    <button type="button" class="btn sm" id="wedit">Editar</button><button type="button" class="btn sm" id="wnew">Outra pessoa</button>`;
  $("wedit").onclick=()=>showGate(false);$("wnew").onclick=()=>showGate(true);}

/* fila de envio */
let syncing=false,lastErr="",pend=0;
async function enqueue(tipo,dados){
  const item={id:uid(),tipo,criadoEm:new Date().toISOString(),app:VER,pessoa:PESSOA?{id:PESSOA.id,nome:PESSOA.nome,cpf:PESSOA.cpf,nascimento:PESSOA.nascimento,comunidade:PESSOA.comunidade,municipio:PESSOA.municipio,consentimentoEm:PESSOA.consentimentoEm}:null,dados};
  try{await IDB.put(item);}catch(e){const q=lsGet("ot_fila_ls")||[];q.push(item);if(!lsSet("ot_fila_ls",q))throw new Error("Sem espaço no celular para guardar o envio.");}
  updSync();sync();return item.id;}
async function pending(){let a=[];try{a=await IDB.all()||[];}catch(e){}return a.concat(lsGet("ot_fila_ls")||[]).sort((x,y)=>String(x.criadoEm).localeCompare(String(y.criadoEm)));}
async function dropItem(id){try{await IDB.del(id);}catch(e){}const q=lsGet("ot_fila_ls");if(q)lsSet("ot_fila_ls",q.filter(i=>i.id!==id));}
function markSent(it){const lid=it.dados&&it.dados.localId;if(!lid)return;const L=it.tipo==="territorio"?TERRS:it.tipo==="registro"?REGS:null;if(!L)return;const o=L.find(x=>x.id===lid);if(o){o.enviado=true;saveLists();}}
async function sync(){
  if(syncing)return;if(!CFG.endpoint){lastErr="semconfig";return updSync();}if(!navigator.onLine){lastErr="offline";return updSync();}
  syncing=true;updSync();let failed=0;
  try{for(const it of await pending()){
      const r=await fetch(CFG.endpoint,{method:"POST",body:JSON.stringify({token:CFG.token,item:it}),redirect:"follow"});
      let j=null;try{j=await r.json();}catch(e){throw new Error("resposta inválida do servidor");}
      if(j&&j.ok){await dropItem(it.id);markSent(it);}else{failed++;lastErr=(j&&j.erro)||"erro no servidor";if(/chave/.test(lastErr))break;}}
    if(!failed)lastErr="";}
  catch(e){lastErr=navigator.onLine?(e.message||"falha de conexão"):"offline";}
  syncing=false;updSync();renderTList();renderRList();}
async function updSync(){const el=$("sync");if(!el)return;pend=(await pending()).length;
  let t,k="ok";
  if(!CFG.endpoint){t="O envio para o Google Drive ainda não foi configurado. Os dados ficam guardados no celular.";k="warn";}
  else if(syncing)t="Enviando…";
  else if(!pend)t="Tudo enviado para o banco de dados.";
  else if(lastErr==="offline"){t=`Sem internet. ${pend} envio${pend>1?"s":""} guardado${pend>1?"s":""} no celular; vai sozinho quando a internet voltar.`;k="warn";}
  else if(lastErr){t=`${pend} envio${pend>1?"s":""} aguardando. Problema: ${lastErr}.`;k="err";}
  else{t=`${pend} envio${pend>1?"s":""} aguardando.`;k="warn";}
  el.className="sync "+k;el.innerHTML=`<span>${esc(t)}</span>${pend&&CFG.endpoint&&!syncing?`<button type="button" class="btn sm" id="syncnow">Enviar agora</button>`:""}`;
  const b=$("syncnow");if(b)b.onclick=sync;}
window.addEventListener("online",()=>{lastErr="";sync();});window.addEventListener("offline",()=>{lastErr="offline";updSync();});
setInterval(()=>{if(pend&&!syncing)sync();},60000);

/* configuração do envio */
function renderCfg(){const c=$("cfg");c.innerHTML=`<label>Endereço do script (termina em /exec)<input id="cend" value="${esc(CFG.endpoint)}" placeholder="https://script.google.com/macros/s/…/exec" autocomplete="off"></label>
  <label>Chave de acesso<input id="ctok" value="${esc(CFG.token)}" autocomplete="off"></label>
  <div class="row"><button type="button" class="btn sm" id="csv">Salvar e testar</button></div><p class="msg" id="cmsg" role="status"></p>`;
  $("csv").onclick=async()=>{const m=$("cmsg");CFG.endpoint=$("cend").value.trim();CFG.token=$("ctok").value.trim();lsSet("ot_cfg",{endpoint:CFG.endpoint,token:CFG.token});
    if(!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(CFG.endpoint)&&!/^https?:\/\/(localhost|127\.0\.0\.1)/.test(CFG.endpoint)){m.textContent="O endereço deve começar com https://script.google.com/macros/s/ e terminar em /exec.";m.className="msg err";return;}
    m.textContent="Testando…";m.className="msg";
    try{const r=await fetch(CFG.endpoint+"?teste=1&token="+encodeURIComponent(CFG.token));const j=await r.json();if(j.ok){m.textContent="Conexão funcionando. Planilha: "+(j.planilha||"ok");lastErr="";sync();}else{m.textContent="O script respondeu com erro: "+(j.erro||"");m.className="msg err";}}
    catch(e){m.textContent="Não consegui falar com o script. Confira o endereço e se ele foi implantado com acesso para 'Qualquer pessoa'.";m.className="msg err";}};}

/* mapa offline */
async function cacheAll(){const b=$("offbtn"),m=$("offmsg");if(!("caches" in window)){m.textContent="Este navegador não guarda o mapa para uso sem internet.";return;}
  const urls=[DATA_URL+"base.json",DATA_URL+"lu/overview.png"];B.tiles.forEach(([k,nm,nb,lu])=>{urls.push(DATA_URL+"t/"+k+".json");if(lu)urls.push(DATA_URL+"lu/"+k+".png",DATA_URL+"car/"+k+".png",DATA_URL+"s/"+k+".gz");});urls.push(DATA_URL+"s/index.json");
  b.disabled=true;let done=0,fail=0;const c=await caches.open("ot-dados-v2");
  const work=async()=>{while(urls.length){const u=urls.shift();try{if(!(await c.match(u))){const r=await fetch(u);if(r.ok)await c.put(u,r);else fail++;}}catch(e){fail++;}done++;m.textContent=`Baixando o mapa: ${Math.round(done/(done+urls.length)*100)}%`;}};
  await Promise.all([work(),work(),work(),work()]);b.disabled=false;
  m.textContent=fail?`Faltaram ${fail} arquivos. Tente de novo com internet melhor.`:"Mapa da Bahia guardado no celular. As consultas funcionam sem internet.";if(!fail)lsSet("ot_offline",new Date().toISOString());}

/* territórios */
async function saveTerritory(t,r){
  const id=t.id||uid();const feat={type:"Feature",properties:{nome:t.name,tipo:t.tipo||"",cod:t.cod||"",origem:t.origem,areaHa:+r.area.toFixed(1)},geometry:{type:"MultiPolygon",coordinates:t.rings.map(x=>[x])}};
  const resumo={carPct:+r.car.pct.toFixed(1),carHa:Math.round(r.car.ha),grandesImoveis:r.car.big.map(b=>b.cod+" ("+Math.round(b.pct)+"%)"),processosMinerarios:r.min.length,mineracaoPct:+r.minPct.toFixed(1),
    processos:r.min.slice(0,40).map(m=>`${m.proc} ${m.subs} – ${m.fase} (${Math.round(m.pct)}%)`),eolicasSobre:r.eolIn.map(e=>e.name),energiaAte10km:r.enNear.length,
    linhaMaisProximaKm:r.lte?+r.lte.d.toFixed(2):null,areasProtegidas:[...r.uc,...r.ti,...r.qu,...r.as].map(x=>x.name+" ("+Math.round(x.pct)+"%)"),usoTerra:r.lu.slice(0,6).map(c=>luName(LEG[c.k][0])+" "+Math.round(c.pct)+"%")};
  const rec={id,nome:t.name,tipo:t.tipo||"",cod:t.cod||"",origem:t.origem,areaHa:+r.area.toFixed(1),mun:r.mun,rings:t.rings,criadoEm:new Date().toISOString(),enviado:false};
  try{await enqueue("territorio",{localId:id,nome:rec.nome,tipo:rec.tipo,cod:rec.cod,origem:rec.origem,areaHa:rec.areaHa,municipios:r.mun,geojson:feat,resumo});}
  catch(e){tsay(e.message||"Não foi possível guardar.",true);return;}
  TERRS=TERRS.filter(x=>x.id!==id);TERRS.unshift(rec);if(!saveLists()){TERRS.shift();saveLists();tsay("O território foi para a fila de envio, mas é grande demais para ficar na lista do celular.",false);}
  t.saved=true;t.id=id;tsay(CFG.endpoint?"Território guardado e enviado para o banco de dados.":"Território guardado no celular. Será enviado quando o envio for configurado.");renderTList();draw();}
function delBtn(b,fn){if(b.dataset.confirm!=="1"){b.dataset.confirm="1";b.textContent="Confirmar";b.classList.add("primary");setTimeout(()=>{if(b.isConnected){b.dataset.confirm="";b.textContent="Tirar do celular";b.classList.remove("primary");}},5000);return;}fn();}
const stTag=o=>o.enviado?`<span class="tag ok">Enviado</span>`:`<span class="tag near">Aguardando envio</span>`;
function renderTList(){
  if(!TERRS.length){tlistEl.innerHTML=`<p class="hintsmall" style="margin-top:6px">Nenhum território guardado neste celular.</p>`;return;}
  tlistEl.innerHTML=`<div class="label" style="margin-top:6px">Territórios guardados neste celular</div>`+TERRS.map(t=>`<div class="titem"><div class="nm"><b>${esc(t.nome)}</b><span>${esc(t.tipo)} · ${fmtN(t.areaHa,1)} ha${t.mun&&t.mun.length?" · "+esc(t.mun.join(", ")):""}</span> ${stTag(t)}</div>
    <button type="button" class="btn sm" data-tv="${esc(t.id)}">Analisar</button>${t.enviado?`<button type="button" class="btn sm" data-td="${esc(t.id)}">Tirar do celular</button>`:""}</div>`).join("");
  tlistEl.querySelectorAll("[data-tv]").forEach(b=>b.onclick=async()=>{const t=TERRS.find(x=>x.id===b.dataset.tv);curT={rings:t.rings,name:t.nome,tipo:t.tipo,cod:t.cod,origem:t.origem,saved:true,id:t.id};curT.bb=bboxR(curT.rings);fitTo(curT.bb);sel=null;draw();
    $("out").innerHTML=`<div class="loading"><span class="spin"></span>Cruzando as bases com o território…</div>`;$("out").scrollIntoView({behavior:"smooth",block:"start"});renderTerritory(await analyzeTerritory(curT));});
  tlistEl.querySelectorAll("[data-td]").forEach(b=>b.onclick=()=>delBtn(b,()=>{TERRS=TERRS.filter(x=>x.id!==b.dataset.td);saveLists();renderTList();draw();tsay("Tirado da lista do celular. A cópia enviada continua no banco de dados.");}));}

/* registros de campo */
const rmsg=$("rmsg");function rsay(t,err){rmsg.textContent=t;rmsg.className="msg"+(err?" err":"");}
let regFoto=null;
async function shrinkPhoto(file){let src;try{src=await createImageBitmap(file,{imageOrientation:"from-image"});}catch(e){src=await loadImg(URL.createObjectURL(file));}
  const s=Math.min(1,1280/Math.max(src.width,src.height)),c=document.createElement("canvas");c.width=Math.round(src.width*s);c.height=Math.round(src.height*s);c.getContext("2d").drawImage(src,0,0,c.width,c.height);return c.toDataURL("image/jpeg",0.72);}
function renderRegForm(){const f=$("rform");
  if(!sel){f.innerHTML=`<p class="hintsmall">Primeiro escolha o ponto: use sua localização, toque no mapa ou cole coordenadas.</p>`;return;}
  regFoto=null;
  f.innerHTML=`<div class="tform"><div class="mono">${sel.y.toFixed(5)}, ${sel.x.toFixed(5)}${lastA&&lastA.mun?" · "+esc(lastA.mun):""}${sel.acc?" · precisão "+Math.round(sel.acc)+" m":""}</div>
    <label>O que foi visto<select id="rtipo">${REGTIPOS.map(x=>`<option>${x}</option>`).join("")}</select></label>
    <label>Descrição<textarea id="rtexto" maxlength="2000" placeholder="O que a equipe ou a comunidade relatou neste local"></textarea></label>
    <label>Nº do CAR envolvido (se houver)<input id="rcar" maxlength="60" placeholder="BA-0000000-…"></label>
    <label>Nome do titular do CAR (se souber)<input id="rdono" maxlength="160" placeholder="Para controle em caso de sobreposição"></label>
    <div class="row"><label class="btn sm" for="rfoto">Adicionar foto</label><input type="file" id="rfoto" accept="image/*" capture="environment" hidden><span id="rfotoinfo" class="hintsmall"></span></div>
    <img id="rprev" alt="Foto do registro" hidden style="max-width:100%;border-radius:10px">
    <div class="row"><button type="button" class="btn primary" id="rsave">Salvar registro</button></div></div>`;
  $("rfoto").addEventListener("change",async e=>{const fl=e.target.files[0];e.target.value="";if(!fl)return;$("rfotoinfo").textContent="Preparando a foto…";
    try{regFoto=await shrinkPhoto(fl);$("rprev").src=regFoto;$("rprev").hidden=false;$("rfotoinfo").textContent=`Foto pronta (${Math.round(regFoto.length*0.75/1024)} KB).`;}catch(err){regFoto=null;$("rfotoinfo").textContent="Não consegui abrir a foto.";}});
  $("rsave").onclick=async()=>{const texto=$("rtexto").value.trim();if(!texto){rsay("Escreva uma descrição curta.",true);return;}
    const b=$("rsave");b.disabled=true;const id=uid();
    const rec={id,lat:+sel.y.toFixed(6),lon:+sel.x.toFixed(6),mun:lastA&&lastA.mun||"",tipo:$("rtipo").value,texto,origem:sel.how||"",precisaoM:sel.acc?Math.round(sel.acc):null,temFoto:!!regFoto,criadoEm:new Date().toISOString(),enviado:false};
    try{await enqueue("registro",{localId:id,lat:rec.lat,lon:rec.lon,municipio:rec.mun,tipo:rec.tipo,texto,carEnvolvido:carCodeNorm($("rcar").value),titularCar:$("rdono").value.trim(),origemPonto:rec.origem,precisaoM:rec.precisaoM,foto:regFoto});
      REGS.unshift(rec);saveLists();rsay(CFG.endpoint?"Registro salvo. Enviando para o banco de dados.":"Registro guardado no celular.");renderRegForm();renderRList();draw();}
    catch(e){rsay(e.message||"Não foi possível salvar.",true);}b.disabled=false;};}
function renderRList(){const l=$("rlist");if(!REGS.length){l.innerHTML=`<p class="hintsmall">Nenhum registro neste celular ainda.</p>`;return;}
  const rs=REGS.slice(0,30);
  l.innerHTML=`<div class="label">Registros feitos neste celular</div>`+rs.map(r=>`<div class="titem"><div class="nm"><b>${esc(r.tipo)}</b><span>${esc(r.mun||"")} · ${esc(new Date(r.criadoEm).toLocaleDateString("pt-BR"))}${r.temFoto?" · com foto":""}</span> ${stTag(r)}<span style="display:block;color:var(--ink);font-size:14px">${esc(String(r.texto).slice(0,240))}</span></div>
    <button type="button" class="btn sm" data-rv="${esc(r.id)}">Ver no mapa</button>${r.enviado?`<button type="button" class="btn sm" data-rd="${esc(r.id)}">Tirar do celular</button>`:""}</div>`).join("");
  l.querySelectorAll("[data-rv]").forEach(b=>b.onclick=()=>{const r=REGS.find(x=>x.id===b.dataset.rv);centerOn(r.lon,r.lat,0.08);choose(r.lon,r.lat,"registro",true);$("map").scrollIntoView({behavior:"smooth",block:"start"});});
  l.querySelectorAll("[data-rd]").forEach(b=>b.onclick=()=>delBtn(b,()=>{REGS=REGS.filter(x=>x.id!==b.dataset.rd);saveLists();renderRList();draw();rsay("Tirado da lista do celular. A cópia enviada continua no banco de dados.");}));}
function consultaData(a,CL){CL=CL||a.carL;return {tipoRelatorio:"ponto",lat:+a.y.toFixed(6),lon:+a.x.toFixed(6),raioKm:a.R,municipio:a.mun||"",origemPonto:sel&&sel.how||"",resumo:summary(a).map(s=>s.b+" "+s.t),
    processosMinerarios:[...a.minIn,...a.minNear].slice(0,60).map(x=>`${x.proc} ${x.subs} – ${x.fase} (${x.d===0?"no ponto":fmtKm(x.d)})`),
    energia:a.enR.map(e=>`${e.name} (${e.fase}, ${fmtKm(e.d)})`),areasProtegidas:a.terr.map(t=>`${t.lab}: ${t.name} (${t.d===0?"no ponto":fmtKm(t.d)})`),
    car:{noPonto:!!a.car.at,pctRaio:a.car.p1!=null?Math.round(a.car.p1):null,coletivos:a.car.coll.map(c=>c.cod),grandes:a.car.big.length},
    usoNoPonto:a.luAt!=null&&a.luAt<250?luName(LEG[a.luAt][0]):"",
    carCompleto:CL&&CL.list?{total:CL.list.length,noPonto:CL.list.filter(c=>c.d===0).map(c=>c.cod),codigos:CL.list.slice(0,400).map(c=>c.cod+" ("+c.tipo+", "+Math.round(c.area)+" ha)")}:null,
    serie:a.series?a.series.byYear.filter(b=>b.yr%5===0).map(b=>`${b.yr}: nativa ${Math.round(b.g.nat)}%, agropecuária ${Math.round(b.g.agr)}%`):null};}
function terrSummary(r){return [`CAR individual: ${Math.round(r.car.pct)}% do território`,`Mineração: ${r.min.length} processo(s) sobre ${Math.round(r.minPct)}%`,
  `Energia dentro: ${r.eolIn.length+r.enNear.length}`,`Linha de transmissão cruza: ${[r.lte,r.ltp].some(l=>l&&l.d===0)?"sim":"não"}`,
  `Áreas protegidas/territórios sobrepostos: ${[...r.uc,...r.ti,...r.qu,...r.as].map(x=>x.name+" ("+Math.round(x.pct)+"%)").join("; ")||"nenhum"}`,
  ...(r.series?[`Vegetação nativa: ${Math.round(r.series.byYear[0].g.nat)}% em ${r.series.years[0]} e ${Math.round(r.series.byYear[r.series.byYear.length-1].g.nat)}% em ${r.series.years[r.series.years.length-1]}`]:[])];}
function blobToDataURL(b){return new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>res(fr.result);fr.onerror=()=>rej(fr.error);fr.readAsDataURL(b);});}
async function sendReport(blob,fname,dados){
  try{const pdf=await blobToDataURL(blob);await enqueue("relatorio",Object.assign({nomeArquivo:fname,pdf},dados));
    return CFG.endpoint?(navigator.onLine?"O relatório está sendo enviado para a pasta do projeto no Drive.":"Sem internet: o relatório foi guardado e vai para a pasta do Drive quando a internet voltar."):"O envio para o Drive ainda não foi configurado; o relatório ficou guardado no celular.";}
  catch(e){return "Não foi possível guardar o relatório para envio ("+(e.message||"erro")+").";}}
async function initDB(){renderWho();renderTList();renderRegForm();renderRList();renderCfg();updSync();sync();
  $("offbtn").onclick=cacheAll;const off=lsGet("ot_offline");if(off)$("offmsg").textContent="Mapa guardado no celular em "+new Date(off).toLocaleDateString("pt-BR")+".";
  if(!PESSOA)showGate(false);}

/* ---------- MapBiomas Coleção 11: série histórica 1985–2025 ---------- */
const MBC={"3": ["Formação Florestal", "1f8d49", "nat"], "6": ["Floresta Alagável", "007785", "nat"], "4": ["Formação Savânica", "7dc975", "nat"], "7": ["Savana Alagada (beta)", "228c70", "nat"], "5": ["Mangue", "04381d", "nat"], "49": ["Restinga Arbórea", "02d659", "nat"], "12": ["Formação Campestre", "d6bc74", "nat"], "77": ["Formação Herbáceo Arbustiva (beta)", "86b074", "nat"], "11": ["Campo Alagado e Área Pantanosa", "519799", "nat"], "84": ["Marisma (beta)", "81dbbf", "nat"], "50": ["Restinga Herbácea ou Arbustiva", "ffaa5f", "nat"], "32": ["Apicum", "fc8114", "nat"], "29": ["Afloramento Rochoso", "ad5100", "nat"], "15": ["Pastagem", "edde8e", "agr"], "39": ["Soja", "f5b3c8", "agr"], "20": ["Cana", "db7093", "agr"], "40": ["Arroz", "c71585", "agr"], "62": ["Algodão (beta)", "ff69b4", "agr"], "41": ["Outras Lavouras Temporárias", "f54ca9", "agr"], "46": ["Café", "d68fe2", "agr"], "47": ["Citrus", "9932cc", "agr"], "35": ["Dendê", "9065d0", "agr"], "48": ["Outras Lavouras Perenes", "e6ccff", "agr"], "9": ["Silvicultura", "7a5900", "agr"], "21": ["Mosaico de Usos", "ffefc3", "agr"], "23": ["Praia, Duna e Areal", "ffa07a", "nv"], "24": ["Área Urbanizada", "d4271e", "nv"], "30": ["Mineração", "9c0027", "nv"], "75": ["Usina Fotovoltaica", "757272", "nv"], "91": ["Parque eólico (beta)", "403d3e", "nv"], "25": ["Outras Áreas não Vegetadas", "db4d4f", "nv"], "33": ["Rio, Lago e Oceano", "2532e4", "agua"], "31": ["Aquicultura", "091077", "agua"]};
const mbName=c=>(MBC[c]||["Outra classe ("+c+")"])[0];
/* 4 grupos para o gráfico – cores da paleta categórica validada (slots 1–4) */
const GRP=[{id:"agua",n:"Água",s:"Água",c:"#2a78d6",cd:"#3987e5"},{id:"nv",n:"Área não vegetada (cidade, mineração, solar e outras)",s:"Área não vegetada",c:"#eb6834",cd:"#d95926"},
 {id:"nat",n:"Vegetação nativa (floresta, caatinga, cerrado, campos)",s:"Vegetação nativa",c:"#1baf7a",cd:"#199e70"},{id:"agr",n:"Agropecuária (pasto, lavouras, silvicultura, mosaico)",s:"Agropecuária",c:"#eda100",cd:"#c98500"}];
const dark=()=>matchMedia("(prefers-color-scheme: dark)").matches;
let SIDX=null;const SC=new Map();
async function seriesIndex(){if(SIDX)return SIDX;try{const r=await fetch(DATA_URL+"s/index.json");if(!r.ok)return null;SIDX=await r.json();}catch(e){return null;}return SIDX;}
async function gunzip(buf){return new Uint8Array(await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer());}
function loadSeriesTile(k){if(SC.has(k))return SC.get(k);const p=(async()=>{const I=await seriesIndex();if(!I||!I.tiles.includes(k))return null;const r=await fetch(DATA_URL+"s/"+k+".gz");if(!r.ok)return null;return await gunzip(await r.arrayBuffer());})().catch(()=>null);SC.set(k,p);return p;}
async function seriesCount(test,bb){const I=await seriesIndex();if(!I)return null;const N=I.N,NY=I.years.length,c=1/N;
  const keys=tilesFor(bb.w,bb.s,bb.e,bb.n);const arrs=await Promise.all(keys.map(loadSeriesTile));if(arrs.every(a=>!a))return null;
  const cnt=I.years.map(()=>new Map());let tot=0;
  keys.forEach((k,ti)=>{const A=arrs[ti];if(!A)return;const [tx,ty]=k.split("_").map(Number);
    const i0=Math.max(0,Math.floor((bb.w-tx)*N)),i1=Math.min(N-1,Math.floor((bb.e-tx)*N)),j0=Math.max(0,Math.floor((ty+1-bb.n)*N)),j1=Math.min(N-1,Math.floor((ty+1-bb.s)*N));
    for(let j=j0;j<=j1;j++){const cy=ty+1-(j+.5)*c;for(let i=i0;i<=i1;i++){const cx=tx+(i+.5)*c;if(!test(cx,cy))continue;const p=(j*N+i)*NY;if(A[p+NY-1]===0)continue;tot++;for(let y=0;y<NY;y++){const v=A[p+y];const m=cnt[y];m.set(v,(m.get(v)||0)+1);}}}});
  if(!tot)return null;
  const byYear=I.years.map((yr,yi)=>{const m=cnt[yi];const valid=[...m.entries()].filter(([v])=>v!==0&&v!==27).reduce((s,[,n])=>s+n,0)||1;const cls={};const g={nat:0,agr:0,nv:0,agua:0};
    for(const [v,n] of m){if(v===0||v===27)continue;cls[v]=n/valid*100;const gr=(MBC[v]||[0,0,"nv"])[2];if(g[gr]!=null)g[gr]+=n/valid*100;}return {yr,cls,g};});
  return {years:I.years,tot,byYear,cellM:Math.round(111320/N),col:I.col||"Coleção 11"};}
function seriesCircle(x,y,R){const kx=KXf(y),dlon=R/kx,dlat=R/KY;return seriesCount((cx,cy)=>Math.hypot((cx-x)*kx,(cy-y)*KY)<=R,{w:x-dlon,e:x+dlon,s:y-dlat,n:y+dlat});}
function seriesPoly(rings,bb){return seriesCount((cx,cy)=>inPoly(cx,cy,rings),bb);}
function seriesBlock(S,id){
  if(!S)return `<p class="empty">A série histórica do MapBiomas não está disponível neste local${navigator.onLine?"":" sem internet (baixe o mapa da Bahia com Wi-Fi para usar no campo)"}.</p>`;
  const f=S.byYear[0],l=S.byYear[S.byYear.length-1];const dn=l.g.nat-f.g.nat,da=l.g.agr-f.g.agr;
  const pp=v=>(v>0?"+":"")+v.toFixed(1).replace(".",",")+" pontos";
  let h=`<p style="margin:0"><strong>De ${f.yr} a ${l.yr}</strong>, a vegetação nativa passou de <strong>${pf(f.g.nat)}</strong> para <strong>${pf(l.g.nat)}</strong> da área (${pp(dn)}), e a agropecuária de <strong>${pf(f.g.agr)}</strong> para <strong>${pf(l.g.agr)}</strong> (${pp(da)}).</p>
  <figure class="chart" id="${id}"><figcaption>Uso e cobertura da terra, ${f.yr}–${l.yr} (% da área)</figcaption>
  <div class="ckeys">${GRP.slice().reverse().map(g=>`<span><i style="background:${dark()?g.cd:g.c}"></i>${g.s||g.n}</span>`).join("")}</div>
  <div class="cwrap">${chartSVG(S)}<div class="ctip" hidden></div></div></figure>
  <details><summary>Ver tabela por classe e ano</summary>${seriesTable(S)}</details>
  <p class="empty" style="font-size:13px">MapBiomas ${S.col}, mapas anuais 1985–2025, amostrados numa grade de cerca de ${S.cellM} m (${fmtN(S.tot)} células). Mineração e usinas solares aparecem no grupo "área não vegetada"; veja os valores na tabela.</p>`;
  return h;}
function chartSVG(S){const W0=400,H0=250,ml=46,mr=40,mt=10,mb=24,pw=W0-ml-mr,ph=H0-mt-mb;const n=S.years.length;
  const X=i=>ml+i/(n-1)*pw,Y=v=>mt+(1-v/100)*ph;let s=`<svg viewBox="0 0 ${W0} ${H0}" role="img" aria-label="Gráfico de linhas da série histórica de uso da terra">`;
  for(const v of [0,25,50,75,100])s+=`<line x1="${ml}" x2="${ml+pw}" y1="${Y(v)}" y2="${Y(v)}" class="cg"/><text x="${ml-6}" y="${Y(v)+4}" text-anchor="end" class="ct">${v}%</text>`;
  S.years.forEach((yr,i)=>{if(yr%10===5||yr===2025)s+=`<text x="${X(i)}" y="${H0-8}" text-anchor="middle" class="ct">${yr}</text>`;});
  const ends=[];
  for(const g of GRP){const col=dark()?g.cd:g.c;const pts=S.byYear.map((b,i)=>`${X(i).toFixed(1)},${Y(b.g[g.id]).toFixed(1)}`).join(" ");s+=`<polyline points="${pts}" fill="none" stroke="${col}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    const lv=S.byYear[n-1].g[g.id];s+=`<circle cx="${X(n-1)}" cy="${Y(lv)}" r="4" fill="${col}" class="cdot"/>`;ends.push({y:Y(lv),t:pf(lv)});}
  ends.sort((a,b)=>a.y-b.y);for(let i=1;i<ends.length;i++)if(ends[i].y-ends[i-1].y<13)ends[i].y=ends[i-1].y+13;
  for(let i=ends.length-1;i>0;i--)if(ends[i].y>mt+ph+4){ends[i].y=mt+ph+4;for(let k=i-1;k>=0;k--)if(ends[k+1].y-ends[k].y<13)ends[k].y=ends[k+1].y-13;}
  ends.forEach(e=>{s+=`<text x="${X(n-1)+8}" y="${e.y+4}" class="cl">${esc(e.t)}</text>`;});
  s+=`<line class="cx" x1="0" x2="0" y1="${mt}" y2="${mt+ph}" visibility="hidden"/><rect class="chit" x="${ml}" y="${mt}" width="${pw}" height="${ph}" fill="transparent"/></svg>`;return s;}
function wireChart(id,S){const fig=$(id);if(!fig||!S)return;const svg=fig.querySelector("svg"),tip=fig.querySelector(".ctip"),cx=svg.querySelector(".cx"),hit=svg.querySelector(".chit");
  const n=S.years.length,ml=46,pw=400-46-40;
  const move=e=>{const r=svg.getBoundingClientRect();const sx=(e.clientX-r.left)/r.width*400;const i=Math.max(0,Math.min(n-1,Math.round((sx-ml)/pw*(n-1))));const xx=ml+i/(n-1)*pw;cx.setAttribute("x1",xx);cx.setAttribute("x2",xx);cx.setAttribute("visibility","visible");
    const b=S.byYear[i];tip.hidden=false;tip.innerHTML=`<b>${b.yr}</b>`+GRP.slice().reverse().map(g=>`<span><i style="background:${dark()?g.cd:g.c}"></i>${g.s}: ${pf(b.g[g.id])}</span>`).join("")+(b.cls[30]?`<span>Mineração: ${b.cls[30]<0.1?"<0,1":b.cls[30].toFixed(1).replace(".",",")}%</span>`:"");
    const left=xx/400*r.width;tip.style.left=Math.min(r.width-170,Math.max(0,left-85))+"px";};
  hit.addEventListener("pointermove",move);hit.addEventListener("pointerdown",move);hit.addEventListener("pointerleave",()=>{tip.hidden=true;cx.setAttribute("visibility","hidden");});}
const KEYYEARS=S=>S.years.filter(y=>y%5===0);
function seriesTable(S){const ys=KEYYEARS(S);const idx=ys.map(y=>S.years.indexOf(y));const last=S.byYear[S.byYear.length-1];
  const codes=[...new Set(S.byYear.flatMap(b=>Object.keys(b.cls).map(Number)))].sort((a,b)=>(last.cls[b]||0)-(last.cls[a]||0));
  const v=x=>x==null||x===0?"–":(x<0.1?"<0,1":x.toFixed(1).replace(".",","));
  let h=`<div class="tscroll"><table class="tbl"><thead><tr><th>Classe</th>${ys.map(y=>`<th>${y}</th>`).join("")}</tr></thead><tbody>`;
  for(const g of GRP.slice().reverse()){h+=`<tr class="tg"><td>${g.s}</td>${idx.map(i=>`<td>${v(S.byYear[i].g[g.id])}</td>`).join("")}</tr>`;
    codes.filter(c=>(MBC[c]||[0,0,"nv"])[2]===g.id).forEach(c=>{h+=`<tr><td>${esc(mbName(c))}</td>${idx.map(i=>`<td>${v(S.byYear[i].cls[c])}</td>`).join("")}</tr>`;});}
  return h+`</tbody></table></div><p class="empty" style="font-size:13px">Valores em % da área analisada.</p>`;}
function chartPNG(S){const c=document.createElement("canvas");const W0=1400,H0=560,ml=80,mr=300,mt=24,mb=50,pw=W0-ml-mr,ph=H0-mt-mb,n=S.years.length;c.width=W0;c.height=H0;const g=c.getContext("2d");
  g.fillStyle="#fff";g.fillRect(0,0,W0,H0);const X=i=>ml+i/(n-1)*pw,Y=v=>mt+(1-v/100)*ph;g.font="22px Helvetica, Arial";g.fillStyle="#5a635d";g.strokeStyle="#e2e5dd";g.lineWidth=2;
  for(const v of [0,25,50,75,100]){g.beginPath();g.moveTo(ml,Y(v));g.lineTo(ml+pw,Y(v));g.stroke();g.textAlign="right";g.fillText(v+"%",ml-10,Y(v)+7);}
  g.textAlign="center";S.years.forEach((y,i)=>{if(y%5===0)g.fillText(y,X(i),H0-14);});
  const ends=[];for(const G of GRP){g.strokeStyle=G.c;g.lineWidth=4;g.lineJoin="round";g.beginPath();S.byYear.forEach((b,i)=>{const yy=Y(b.g[G.id]);i?g.lineTo(X(i),yy):g.moveTo(X(i),yy);});g.stroke();
    const lv=S.byYear[n-1].g[G.id];g.fillStyle=G.c;g.beginPath();g.arc(X(n-1),Y(lv),7,0,7);g.fill();ends.push({y:Y(lv),t:`${G.s} ${pf(lv)}`,c:G.c});}
  ends.sort((a,b)=>a.y-b.y);for(let i=1;i<ends.length;i++)if(ends[i].y-ends[i-1].y<28)ends[i].y=ends[i-1].y+28;
  for(let i=ends.length-1;i>=0;i--){const lim=H0-mb-4-(ends.length-1-i)*28;if(ends[i].y>lim)ends[i].y=lim;if(i<ends.length-1&&ends[i+1].y-ends[i].y<28)ends[i].y=ends[i+1].y-28;}
  g.textAlign="left";g.font="bold 22px Helvetica, Arial";ends.forEach(e=>{g.fillStyle=e.c;g.fillRect(X(n-1)+14,e.y-3,14,6);g.fillStyle="#1b211e";g.fillText(e.t,X(n-1)+34,e.y+7);});return c.toDataURL("image/jpeg",0.9);}
function seriesPDF(T,IMG2,TABLE,S,area){if(!S){T("Série histórica do MapBiomas indisponível para este local.",9.5);return;}
  const f=S.byYear[0],l=S.byYear[S.byYear.length-1];
  T(`De ${f.yr} a ${l.yr}, a vegetação nativa passou de ${pf(f.g.nat)} para ${pf(l.g.nat)} da ${area}, e a agropecuária de ${pf(f.g.agr)} para ${pf(l.g.agr)}.`,10);
  IMG2(chartPNG(S),`Gráfico: uso e cobertura da terra ${f.yr}–${l.yr}, em % da ${area}. Fonte: MapBiomas ${S.col}.`);
  const ys=KEYYEARS(S),idx=ys.map(y=>S.years.indexOf(y));const v=x=>x==null||x===0?"–":(x<0.1?"<0,1":x.toFixed(1).replace(".",","));
  const codes=[...new Set(S.byYear.flatMap(b=>Object.keys(b.cls).map(Number)))].sort((a,b)=>(l.cls[b]||0)-(l.cls[a]||0));const body=[];
  for(const g of GRP.slice().reverse()){body.push([{content:g.s,styles:{fontStyle:"bold"}},...idx.map(i=>({content:v(S.byYear[i].g[g.id]),styles:{fontStyle:"bold"}}))]);codes.filter(c=>(MBC[c]||[0,0,"nv"])[2]===g.id).forEach(c=>body.push(["   "+mbName(c),...idx.map(i=>v(S.byYear[i].cls[c]))]));}
  TABLE(["Classe (% da área)",...ys.map(String)],body,{fontSize:7.5});}

/* ---------- CAR completo no raio (consulta ao vivo no SICAR) ---------- */
const CAR_WFS="https://geoserver.car.gov.br/geoserver/sicar/wfs?service=WFS&version=2.0.0&request=GetFeature&typeNames=sicar:sicar_imoveis_ba&outputFormat=application/json&srsName=EPSG:4326&sortBy=cod_imovel";
const CTIPO={IRU:"Imóvel rural",AST:"Assentamento",PCT:"Povos e comunidades tradicionais (CEFIR coletivo)"};
const CST={AT:"Ativo",PE:"Pendente",SU:"Suspenso",CA:"Cancelado"};
const carCache=new Map();
async function carList(x,y,R){const key=[x.toFixed(5),y.toFixed(5),R].join();if(carCache.has(key))return carCache.get(key);
  const kx=KXf(y),pts=[];for(let i=0;i<=32;i++){const a=i/32*2*Math.PI;pts.push((x+Math.cos(a)*R/kx).toFixed(5)+" "+(y+Math.sin(a)*R/KY).toFixed(5));}
  const f=`INTERSECTS(geo_area_imovel,SRID=4326;POLYGON((${pts.join(",")})))`;const feats=[];let start=0,matched=null;
  while(true){const ctl=new AbortController();const to=setTimeout(()=>ctl.abort(),45000);
    const r=await fetch(CAR_WFS+`&count=2000&startIndex=${start}&CQL_FILTER=`+encodeURIComponent(f),{signal:ctl.signal});clearTimeout(to);
    if(!r.ok)throw new Error("SICAR respondeu "+r.status);const j=await r.json();matched=j.numberMatched;feats.push(...j.features);if(j.features.length<2000||feats.length>=12000)break;start+=2000;}
  const list=feats.map(ft=>{const p=ft.properties||{};const rings=[];const g=ft.geometry;if(g&&g.type==="MultiPolygon")g.coordinates.forEach(pl=>pl.forEach(rg=>rings.push(rg)));else if(g&&g.type==="Polygon")g.coordinates.forEach(rg=>rings.push(rg));
    const bb=rings.length?bboxR(rings):{w:x,e:x,s:y,n:y};return {cod:p.cod_imovel,tipo:p.tipo_imovel,st:p.status_imovel,cond:p.condicao,mun:p.municipio,area:+p.area||0,mf:+p.m_fiscal||0,criado:(p.dat_criacao||"").slice(0,10),atual:(p.data_atualizacao||"").slice(0,10),r:rings,bb,d:rings.length?polyD(x,y,rings):null};})
    .sort((a,b)=>(a.d??1e9)-(b.d??1e9)||b.area-a.area);
  const res={list,matched,trunc:matched!=null&&matched>list.length,when:new Date()};carCache.set(key,res);return res;}
const dBR=s=>s?s.split("-").reverse().join("/"):"";
async function carListPoly(Rg,bb){const feats=[];let start=0,matched=null;const f=`BBOX(geo_area_imovel,${bb.w},${bb.s},${bb.e},${bb.n},'EPSG:4326')`;
  while(true){const ctl=new AbortController();const to=setTimeout(()=>ctl.abort(),60000);
    const r=await fetch(CAR_WFS+`&count=2000&startIndex=${start}&CQL_FILTER=`+encodeURIComponent(f),{signal:ctl.signal});clearTimeout(to);
    if(!r.ok)throw new Error("SICAR respondeu "+r.status);const j=await r.json();matched=j.numberMatched;feats.push(...j.features);if(j.features.length<2000||feats.length>=12000)break;start+=2000;}
  const kx=KXf((bb.s+bb.n)/2),wkm=Math.max(.05,(bb.e-bb.w)*kx),hkm=Math.max(.05,(bb.n-bb.s)*KY),step=Math.max(0.01,Math.sqrt(wkm*hkm/6000)),sx=step/kx,sy=step/KY,pts=[];
  for(let y=bb.s+sy/2;y<bb.n;y+=sy)for(let x=bb.w+sx/2;x<bb.e;x+=sx)if(inPoly(x,y,Rg))pts.push([x,y]);
  const list=[];for(const ft of feats){const p=ft.properties||{};const rings=[];const g=ft.geometry;if(g&&g.type==="MultiPolygon")g.coordinates.forEach(pl=>pl.forEach(rg=>rings.push(rg)));else if(g&&g.type==="Polygon")g.coordinates.forEach(rg=>rings.push(rg));if(!rings.length)continue;
    const kb=bboxR(rings);let n=0;for(const [x,y] of pts){if(x<kb.w||x>kb.e||y<kb.s||y>kb.n)continue;if(inPoly(x,y,rings))n++;}
    if(!n&&polyPolyD(Rg,rings)>0)continue;
    list.push({cod:p.cod_imovel,tipo:p.tipo_imovel,st:p.status_imovel,cond:p.condicao,mun:p.municipio,area:+p.area||0,mf:+p.m_fiscal||0,criado:(p.dat_criacao||"").slice(0,10),atual:(p.data_atualizacao||"").slice(0,10),r:rings,bb:kb,d:0,pct:pts.length?n/pts.length*100:0});}
  list.sort((a,b)=>b.pct-a.pct||b.area-a.area);return {list,matched,trunc:false,when:new Date(),terr:true};}
const pctTxt=v=>v<1?"<1%":Math.round(v)+"%";
function carListHTML(L,terr){if(!L)return "";const n=L.list.length;const by={};L.list.forEach(c=>by[c.tipo]=(by[c.tipo]||0)+1);const inPt=L.list.filter(c=>c.d===0);
  let h=`<p style="margin:0"><strong>${fmtN(n)} cadastro${n===1?"":"s"} do CAR</strong> ${terr?"se sobrepõe"+(n===1?"":"m")+" ao território":"encostam no raio"}: ${Object.entries(by).map(([t,k])=>`${k} ${(CTIPO[t]||t).toLowerCase()}`).join(", ")}.${!terr&&inPt.length?` ${inPt.length} cobre${inPt.length>1?"m":""} o ponto escolhido.`:""}</p>`;
  if(L.trunc)h+=`<p class="warnbox">O raio tem ${fmtN(L.matched)} cadastros; a lista mostra os ${fmtN(n)} primeiros. Use um raio menor para ver todos.</p>`;
  h+=`<details class="full"><summary>Ver a lista completa (${fmtN(n)})</summary><div class="tscroll"><table class="tbl"><thead><tr><th>${terr?"% do território":"Distância"}</th><th>Código do imóvel</th><th>Tipo</th><th>Município</th><th>Área (ha)</th><th>Módulos fiscais</th><th>Situação</th><th>Condição</th><th>Cadastro</th></tr></thead><tbody>`+
    L.list.map(c=>`<tr><td>${terr?pctTxt(c.pct):c.d===0?"no ponto":c.d==null?"–":fmtKm(c.d)}</td><td class="mono">${esc(c.cod)}</td><td>${esc(CTIPO[c.tipo]||c.tipo)}</td><td>${esc(c.mun)}</td><td>${fmtN(c.area,2)}</td><td>${fmtN(c.mf,2)}</td><td>${esc(CST[c.st]||c.st)}</td><td>${esc(c.cond)}</td><td>${dBR(c.criado)}</td></tr>`).join("")+`</tbody></table></div></details>
  <p class="hintsmall">O SICAR público não informa o nome dos titulares (proteção de dados). Para controle de sobreposição, anote o nome do titular, se souber, no registro de campo ou no cadastro do território.</p>`;
  return h;}
/* ---------- lista completa de mineração (igual ao SIGMINE) ---------- */
function minTableHTML(all){if(!all.length)return "";return `<details class="full"><summary>Ver a lista completa (${all.length} processo${all.length>1?"s":""})</summary><div class="tscroll"><table class="tbl"><thead><tr><th>Distância</th><th>Processo</th><th>Número</th><th>Ano</th><th>Área (ha)</th><th>Fase</th><th>Último evento</th><th>Nome</th><th>Substância</th><th>Uso</th><th>UF</th></tr></thead><tbody>`+
  all.map(m=>{const [nu,an]=String(m.proc).split("/");return `<tr><td>${m.d===0?"no ponto":fmtKm(m.d)}</td><td class="mono">${esc(m.proc)}</td><td>${esc(nu)}</td><td>${esc(an)}</td><td>${fmtN(m.area,2)}</td><td>${esc(m.fase)}</td><td>${esc(m.ev)}</td><td>${esc(titular(m.nome))}</td><td>${esc(m.subs)}</td><td>${esc(m.uso)}</td><td>BA</td></tr>`;}).join("")+`</tbody></table></div></details>`;}
function minTablePDF(TABLE,all,terr){const body=all.map(m=>{const [nu,an]=String(m.proc).split("/");return [terr?(m.pct<1?"<1%":Math.round(m.pct)+"%"):(m.d===0?"no ponto":fmtKm(m.d)),m.proc,nu,an,fmtN(m.area,2),m.fase,m.ev,titular(m.nome),m.subs,m.uso,"BA"];});
  TABLE([terr?"% do território":"Distância","Processo","Número","Ano","Área (ha)","Fase","Último evento","Nome","Substância","Uso","UF"],body,{fontSize:6.5,landscapeHint:true,colW:{6:38,7:30}});}
function carTablePDF(TABLE,L,terr){if(!L||!L.list.length)return;TABLE([terr?"% do território":"Distância","Código do imóvel","Tipo","Município","Área (ha)","Mód. fiscais","Situação","Condição","Cadastro"],
  L.list.map(c=>[terr?pctTxt(c.pct):c.d===0?"no ponto":c.d==null?"–":fmtKm(c.d),c.cod,CTIPO[c.tipo]||c.tipo,c.mun,fmtN(c.area,2),fmtN(c.mf,2),CST[c.st]||c.st,c.cond,dBR(c.criado)]),{fontSize:6.5,colW:{1:52}});}

/* ---------- samples & boot ---------- */
const SAMPLES=[["Fundo de pasto, Pilão Arcado", -43.1144, -10.1696], ["Eólicas, Sento Sé", -41.2, -10.05], ["Ouro, Jacobina", -40.52, -11.18], ["Urânio e ferro, Caetité", -42.48, -14.06], ["Quilombo, Iguape (Cachoeira)", -38.8478, -12.6867], ["Oeste agrícola, São Desidério", -45.7, -12.5]];
function bootSamples(){const smp=$("samples");SAMPLES.forEach(([n,x,y])=>{const b=document.createElement("button");b.type="button";b.textContent=n;b.onclick=()=>{coord.value=y.toFixed(4)+", "+x.toFixed(4);goLoc(coord.value,"exemplo");};smp.appendChild(b);});}
window.addEventListener("resize",()=>resize());
resize();bootSamples();
loadBase().then(()=>{$("hint").textContent="Toque no mapa ou use sua localização";draw();initDB();window.__ready=true;}).catch(e=>{$("hint").textContent="Não foi possível carregar os dados. Verifique a internet e recarregue a página.";console.error(e);});
window.__t={analyze,analyzeTerritory,parseLoc,exifGPS,readFiles,ensure,rasterAt,summary,render,renderTerritory,carSection,get B(){return B},get CARC(){return CARC},get MUN(){return MUN},inPoly,utmToLL};
})();
