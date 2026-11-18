(function(){
"use strict";
const WA_NUM="33611552661",TEL_TXT="06 11 55 26 61";
const RM=matchMedia("(prefers-reduced-motion: reduce)").matches;
const EO="cubic-bezier(.16,1,.3,1)",EIO="cubic-bezier(.65,0,.35,1)",EI="cubic-bezier(.55,0,1,.45)";
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt=n=>Math.round(n).toLocaleString("fr-FR");
const dec=(n,d=1)=>Number(n).toLocaleString("fr-FR",{minimumFractionDigits:d,maximumFractionDigits:d});
const plural=(n,w,p)=>n+" "+(n>1?(p||w+"s"):w);
const JOURS=["L","M","M","J","V","S","D"],JOURS_L=["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche"];
const SLOTS=[["Petit-déjeuner","i-sunrise"],["Déjeuner","i-sun"],["Collation","i-apple"],["Dîner","i-moon"]];
const MAC_COL={p:"var(--prot)",g:"var(--carb)",l:"var(--fat)"};
const OBJ_TXT={muscle:"Apport plus élevé, calé sur la musculation",forme:"Apport stable pour l'énergie au quotidien",perte:"Apport ajusté, sans privation",perf:"Apport calé sur une grosse charge d'entraînement"};
const OBJ_MOD={muscle:1.10,forme:1.0,perte:0.85,perf:1.05};
const REG_TXT={omni:"Je mange de tout",sansporc:"Sans porc",pesce:"Pescétarien",vege:"Végétarien"};
const ALL_TXT={lactose:"Lactose",gluten:"Gluten",noix:"Fruits à coque",oeufs:"Œufs",poisson:"Poisson"};
const SALLES=["Bodyhit Versailles","My Big Bang Le Pecq","CrossFit Silver Montesson","Autre salle"];
const SPORTS=["Musculation","CrossFit","Cardio","Pilates","Sport de combat","Course à pied","Autre"];
const INT_TXT=["Légère","Modérée","Intense"];
const MOMENT_TXT={matin:"le matin",midi:"le midi",soir:"le soir"};

/* ───────── Dates ───────── */
const iso=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const todayIso=()=>iso(new Date());
const parse=s=>{const[y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d);};
const addDays=(s,n)=>{const d=parse(s);d.setDate(d.getDate()+n);return iso(d);};
const dow=s=>(parse(s).getDay()+6)%7;
const monday=s=>addDays(s,-dow(s));
const dayDiff=(a,b)=>Math.round((parse(a)-parse(b))/864e5);
const short=s=>parse(s).toLocaleDateString("fr-FR",{day:"numeric",month:"short"});

/* ───────── Stockage local (téléphone du client) ───────── */
const KEY="mbn.app.v3";
const PROFILE0={stepsGoal:8000,prenom:"",sexe:"h",age:30,taille:175,poids:75,objectif:"forme",seances:3,intensite:2,sport:"Musculation",moment:"soir",regime:"omni",allergies:[],salle:""};
const BLANK={mode:null,example:true,profile:structuredClone(PROFILE0),code:null,clientId:null,plan:null,log:{},water:{},shop:{},checkins:[],trainings:[],weights:[],steps:{},lastExport:null,
  health:{on:false},hr:{},sleep:{},active:{},fasts:[],foods:{},measures:[],progress:[],theme:"auto",msgSeen:null,
  shopAsk:{}, /* {iso: true|false} réponse à « Courses faites ? » */
  reminders:{seance:{on:false},courses:{on:false},repas:{on:false,t:"12:00"},eau:{on:false,t:"10:30"},pesee:{on:false,t:"07:30"},point:{on:false,t:"18:00"}}};
let S;
function load(){try{const v=JSON.parse(localStorage.getItem(KEY));if(v&&v.profile){const s=Object.assign(structuredClone(BLANK),v,{profile:Object.assign(structuredClone(PROFILE0),v.profile),reminders:Object.assign(structuredClone(BLANK.reminders),v.reminders)});fromRem(s);return s;}}catch(e){}return seedExample(structuredClone(BLANK));}
/* L'artifact d'une seule page gardait ses rappels d'agenda dans S.rem {days,time,shop,shopTime,log} : on les reprend dans S.reminders */
function fromRem(s){const o=s.rem;delete s.rem;if(!o||typeof o!=="object")return;const R=s.reminders,okT=t=>/^\d\d:\d\d$/.test(t||""),okD=a=>Array.isArray(a)?a.filter(d=>Number.isInteger(d)&&d>=0&&d<7):undefined;
  R.seance={on:true,days:okD(o.days),t:okT(o.time)?o.time:undefined};R.courses={on:true,days:okD(o.shop),t:okT(o.shopTime)?o.shopTime:undefined};if(okT(o.log))R.repas={on:true,t:o.log};}
function save(){try{localStorage.setItem(KEY,JSON.stringify(S));}catch(e){toast("Mémoire du téléphone pleine : certaines données ne sont pas enregistrées");}if(typeof acct!=="undefined"&&acct)pushSoon();}
function seedExample(s){ /* premier lancement : un état réaliste, marqué « exemple » */
  const t=todayIso(),d=dow(t);s.log[t]=WEEK[d].slice(0,2).map((id,i)=>Object.assign(entryFromMeal(id,i,s),{ex:true}));
  for(let k=1;k<=Math.min(d,3);k++){const day=addDays(t,-k);s.log[day]=WEEK[dow(day)].map((id,i)=>Object.assign(entryFromMeal(id,i,s),{ex:true}));}
  s.exDays=[0,1,2,3,4,5,6].map(k=>addDays(t,-k)); /* jours d'exemple pour eau, pas et Santé */
  s.water[t]=3;s.steps={[t]:4200,[addDays(t,-1)]:9100,[addDays(t,-2)]:7600,[addDays(t,-3)]:11200};
  s.checkins=[{date:addDays(t,-14),energie:3,sommeil:3,faim:3,respect:2,ex:true},{date:addDays(t,-7),energie:4,sommeil:3,faim:2,respect:3,ex:true}];
  s.trainings=[{id:"tx1",date:addDays(t,-2),sport:"Musculation",min:60,intensite:2,ex:true},{id:"tx2",date:addDays(t,-4),sport:"CrossFit",min:45,intensite:3,ex:true}];
  s.weights=[{date:addDays(t,-21),kg:76.4,ex:true},{date:addDays(t,-14),kg:76.0,ex:true},{date:addDays(t,-7),kg:75.6,ex:true}];
  /* Santé : fréquence cardiaque, sommeil, énergie active des 7 derniers jours (nuit 50-58, journée 65-95, séance au moment du profil un jour sur deux) */
  const now=new Date(),nowM=now.getHours()*60+now.getMinutes(),tS={matin:7,midi:12.5,soir:18}[s.profile.moment]||18;
  for(let k=0;k<7;k++){const day=addDays(t,-k),rest=52+(k*3)%5,pts=[];let r=k*977+13;const rnd=()=>(r=(r*16807)%2147483647)/2147483647;
    for(let m=0;m<=(k?1425:Math.max(30,nowM));m+=15){const h=m/60;let b;
      if(h<6.5||h>=23)b=rest-2+rnd()*6;
      else{b=68+rnd()*12;if(h<7.5)b=rest+(h-6.5)*14+rnd()*6;if((h>=8&&h<9)||(h>=12.5&&h<13.2)||(h>=17.3&&h<17.8))b+=10+rnd()*8;if(h>=21.5)b-=8;}
      const e=h-tS;if(k%2===0&&e>=0&&e<1)b=e<.15?100+e*200:138+rnd()*15;else if(k%2===0&&e>=1&&e<2)b=Math.max(b,72+60*Math.exp(-(e-1)*4));
      pts.push([m,Math.round(b)]);}
    const v=pts.map(p=>p[1]);s.hr[day]={avg:Math.round(v.reduce((a,b)=>a+b,0)/v.length),min:Math.min(...v),max:Math.max(...v),resting:rest,hrv:44+(k*7)%13,pts};
    s.sleep[day]=[442,401,465,388,476,430,452][k];s.active[day]=[310,520,460,610,380,540,290][k];}
  s.measures=[{date:addDays(t,-21),waist:86.5,hips:98,chest:101,arm:34,thigh:57,ex:true},{date:addDays(t,-10),waist:85.5,hips:97.5,chest:101,arm:34.5,thigh:56.5,ex:true},{date:addDays(t,-2),waist:84.5,hips:97,chest:101.5,arm:35,thigh:56.5,ex:true}];
  s.fasts=[3,2,1].map(k=>{const st=parse(addDays(t,-k-1));st.setHours(20,15);return{start:+st,end:+st+[16.1,15.2,16.4][k-1]*36e5,goalH:16,ex:true};});
  return s;
}

/* Photos des repas : IndexedDB sur le téléphone, compressées */
const PH={db:null,
  open(){return this.db||(this.db=new Promise((ok,ko)=>{try{const r=indexedDB.open("mbn-photos",1);r.onupgradeneeded=()=>r.result.createObjectStore("p");r.onsuccess=()=>ok(r.result);r.onerror=()=>ko(r.error);}catch(e){ko(e);}}));},
  async put(id,blob){const d=await this.open();return new Promise((ok,ko)=>{const t=d.transaction("p","readwrite");t.objectStore("p").put(blob,id);t.oncomplete=ok;t.onerror=()=>ko(t.error);});},
  async get(id){try{const d=await this.open();return await new Promise(ok=>{const r=d.transaction("p").objectStore("p").get(id);r.onsuccess=()=>ok(r.result||null);r.onerror=()=>ok(null);});}catch(e){return null;}},
  async del(id){try{const d=await this.open();d.transaction("p","readwrite").objectStore("p").delete(id);}catch(e){}}};
const urls={};async function photoUrl(id){if(urls[id])return urls[id];const b=await PH.get(id);if(!b)return null;return urls[id]=URL.createObjectURL(b);}
function compress(file,max=900,q=.78){return new Promise((ok,ko)=>{const img=new Image(),u=URL.createObjectURL(file);img.onload=()=>{const k=Math.min(1,max/Math.max(img.width,img.height)),c=document.createElement("canvas");c.width=Math.round(img.width*k);c.height=Math.round(img.height*k);c.getContext("2d").drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(u);c.toBlob(b=>b?ok(b):ko(new Error("photo")),"image/jpeg",q);};img.onerror=()=>{URL.revokeObjectURL(u);ko(new Error("photo"));};img.src=u;});}
async function hydratePhotos(root){for(const el of $$("[data-ph]",root)){const u=await photoUrl(el.dataset.ph);if(u)el.style.backgroundImage="url("+u+")";else el.remove();}}

/* ───────── Moteur nutritionnel ───────── */
const foodOf=f=>FOODS[f]||S.foods[f]; /* table Ciqual + produits scannés (S.foods, clés "x"+EAN) */
const macros=(food,g)=>{const F=foodOf(food),q=g/100;return{k:F.k*q,p:F.p*q,g:F.g*q,l:F.l*q};};
const sum=a=>a.reduce((t,x)=>({k:t.k+(x.k||0),p:t.p+(x.p||0),g:t.g+(x.g||0),l:t.l+(x.l||0)}),{k:0,p:0,g:0,l:0});
function subFor(food,s=S){const P=s.profile,L=[];
  const noFish=(P.allergies||[]).includes("poisson");
  if(P.regime==="vege"||(P.regime==="pesce"&&noFish))L.push("vege");else if(P.regime==="pesce")L.push("pesce");
  (P.allergies||[]).forEach(a=>L.push(a));
  let f=food,ch=false;for(const k of L){const m=SUBS[k];if(m&&m[f]){f=m[f];ch=true;}}return{f,changed:ch};}
/* Remplacements décidés par Melvin (espace coach) : appliqués après le régime, puis revérifiés contre le régime et les allergies */
function portion(food,g,factor,s){const sb=subFor(food,s);let f=sb.f,ch=sb.changed,ratio=ch?(SUB_RATIO[f]??1):1,coach=false;
  const w=s.plan&&s.plan.swap,to=w&&w[f];
  if(to&&FOODS[to]&&to!==f){const t2=subFor(to,s).f,a=FOODS[f],b=FOODS[t2];ratio*=(a.k<100&&b.k<100)?1:Math.max(.5,Math.min(2.5,a.k/b.k));if(t2!==f){f=t2;ch=true;coach=true;}}
  const grams=g*factor*ratio,F=FOODS[f];
  if(F.piece){const n=Math.max(1,Math.round(grams/F.piece));return{food:f,grams:n*F.piece,pieces:n,changed:ch,coach,from:food};}
  const st=grams<30?5:10;return{food:f,grams:Math.max(st,Math.round(grams/st)*st),changed:ch,coach,from:food};}
function rawMeal(id,factor,s){const M=MEALS[id],items=M.ing.map(([f,g])=>portion(f,g,factor,s));return{M,items,tot:sum(items.map(it=>macros(it.food,it.grams)))};}
function baseAvg(s=S){let t=0;for(let d=0;d<7;d++)t+=WEEK[d].reduce((a,id)=>a+rawMeal(id,1,s).tot.k,0);return t/7;}
function targetKcal(P){const bmr=10*P.poids+6.25*P.taille-5*P.age+(P.sexe==="f"?-161:5);
  const act=1.3+Math.min(.45,P.seances*.06*(.8+.2*P.intensite));return Math.max(P.sexe==="f"?1300:1600,Math.round(bmr*act*(OBJ_MOD[P.objectif]||1)/10)*10);}
const clampPct=x=>Math.max(70,Math.min(170,Math.round(x)));
const planKcal=(s=S)=>{const k=s.plan&&+s.plan.kcal;return k>=1000&&k<=6000?k:0;};
function pct(s=S){const pk=planKcal(s);if(pk)return clampPct(pk/baseAvg(s)*100);const m=s.code&&parseCode(s.code);if(m)return m.pct;if(s.example)return OBJECTIFS[s.profile.objectif]?.pct||115;
  return Math.max(70,Math.min(170,Math.round(targetKcal(s.profile)/baseAvg(s)*100/5)*5));}
function mealPlan(id,s=S){const{M,items,tot}=rawMeal(id,pct(s)/100,s);
  let t=M.t;items.forEach(it=>{if(it.changed&&TITLE_W[it.from])TITLE_W[it.from].forEach(re=>{t=t.replace(re,m=>{const r=TITLE_TO[it.food]||FOODS[it.food].n.toLowerCase();return m[0]===m[0].toUpperCase()?r[0].toUpperCase()+r.slice(1):r;});});});
  const steps=M.steps.map(st=>st.replace(/\{(\w+)\}/g,(_,k)=>{const it=items.find(i=>i.from===k);const f=it?it.food:k;return STEP_N[f]||FOODS[f].n.toLowerCase();}));
  return{id,...M,t,steps,items,tot};}
function dayPlan(i,s=S){const meals=WEEK[i].map(id=>mealPlan(id,s));return{meals,tot:sum(meals.map(m=>m.tot))};}
const uid=()=>Math.random().toString(36).slice(2,9);
function entryFromMeal(id,slot,s=S){const m=mealPlan(id,s);return{id:"e"+uid(),slot,kind:"meal",ref:id,name:m.t,k:m.tot.k,p:m.tot.p,g:m.tot.g,l:m.tot.l};}
function entryFromFood(f,g,slot){const F=foodOf(f);return{id:"e"+uid(),slot,kind:"food",ref:f,grams:g,name:F.n,...macros(f,g),...(F.ean?{ean:F.ean}:{})};}
const dayLog=d=>S.log[d]||[];
const eatenOf=d=>sum(dayLog(d));
const qty=it=>it.pieces?plural(it.pieces,FOODS[it.food].unit)+" · "+fmt(it.grams)+" g":fmt(it.grams)+" g";
function shopping(s=S){const agg={};for(let d=0;d<7;d++)dayPlan(d,s).meals.forEach(m=>m.items.forEach(it=>{const a=agg[it.food]||(agg[it.food]={g:0,p:0});a.g+=it.grams;a.p+=it.pieces||0;}));
  const by={};Object.entries(agg).forEach(([f,a])=>{const F=FOODS[f],w=a.g>=1000?dec(a.g/1000)+" kg":fmt(a.g)+" g",nb=F.buy?Math.ceil(a.g/F.buy):0;
    (by[F.r]=by[F.r]||[]).push({f,name:F.n,q:F.piece?plural(a.p,F.unit):(nb?plural(nb,F.unit)+" · "+w:w)});});
  const X=(s.plan&&s.plan.extra||[]).filter(x=>x&&x[0]);if(X.length)by["Ajouts de Melvin"]=X.map((x,i)=>({f:"x"+i+"_"+String(x[0]).slice(0,12),name:String(x[0]),q:String(x[1]||"")}));
  return["Ajouts de Melvin","Fruits et légumes","Protéines","Crèmerie","Boulangerie","Épicerie","Surgelés"].filter(r=>by[r]).map(r=>({r,items:r==="Ajouts de Melvin"?by[r]:by[r].sort((a,b)=>a.name.localeCompare(b.name,"fr"))}));}
function streak(){let n=0,d=todayIso();if(!dayLog(d).length)d=addDays(d,-1);while(dayLog(d).length){n++;d=addDays(d,-1);}return n;}
const weekTrainings=(mon=monday(todayIso()))=>S.trainings.filter(t=>t.date>=mon&&t.date<=addDays(mon,6));
const lastWeight=()=>S.weights.slice().sort((a,b)=>a.date<b.date?-1:1).slice(-1)[0];

/* Codes client : objectif, portions, identifiant et clé de contrôle (générés par l'espace coach) */
const B36="0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
function chk(s){let h=7;for(const c of s)h=(h*31+c.charCodeAt(0))%1000003;return B36[h%36];}
function makeCode(obj,p,id){const body="MB-"+OBJECTIFS[obj].code+"-"+p+"-"+id;return body+"-"+chk(body);}
function parseCode(c){const m=String(c||"").trim().toUpperCase().replace(/\s+/g,"").match(/^(MB-(MUSCLE|FORME|SECHE|PERF)-(\d{2,3})-([0-9A-Z]{4}))-([0-9A-Z])$/);
  if(!m||chk(m[1])!==m[5])return null;const p=+m[3];if(p<70||p>170)return null;return{obj:Object.keys(OBJECTIFS).find(k=>OBJECTIFS[k].code===m[2]),pct:p,id:m[4]};}

/* Suivi envoyé au coach : résumé lisible + code de données compact */
function exportCode(){const since=addDays(todayIso(),-27),days=[];
  for(let d=since;d<=todayIso();d=addDays(d,1)){const e=eatenOf(d);if(e.k)days.push([d,Math.round(e.k),Math.round(e.p),Math.round(dayPlan(dow(d)).tot.k),S.water[d]||0,dayLog(d).filter(x=>x.photo).length]);}
  const o={v:1,id:S.clientId,n:S.profile.prenom,at:todayIso(),t:targetKcal(S.profile),pc:pct(),r:S.profile.regime,a:S.profile.allergies,
    w:S.weights.filter(w=>!w.ex&&w.date>=addDays(todayIso(),-90)).map(w=>[w.date,w.kg]),
    s:S.trainings.filter(t=>!t.ex&&t.date>=since).map(t=>[t.date,t.sport,t.min,t.intensite]),
    p:Object.entries(S.steps||{}).filter(([d])=>d>=since).map(([d,n])=>[d,n]),c:S.checkins.filter(c=>!c.ex).slice(-6).map(c=>[c.date,c.energie,c.sommeil,c.faim,c.respect,c.note||""]),d:days,
    q:Object.entries(S.shopAsk||{}).filter(([d])=>d>=since)};
  return "MBN1:"+btoa(unescape(encodeURIComponent(JSON.stringify(o))));}
const b64=o=>btoa(unescape(encodeURIComponent(JSON.stringify(o))));
function readPlan(str){const m=String(str||"").match(/MBP1:([A-Za-z0-9+/=]+)/);if(!m)return null;try{const o=JSON.parse(decodeURIComponent(escape(atob(m[1]))));return o&&o.v===1?o:null;}catch(e){return null;}}
/* Un message de Melvin peut contenir un code client (MB-…) et/ou un plan (MBP1:…). Renvoie true si quelque chose a été appliqué. */
function applyInput(raw){const o=readPlan(raw);let msg=null;
  const cd=(o&&o.c)||String(raw||"").trim().toUpperCase().replace(/\s+/g,""),m=parseCode(cd);
  if(o&&S.clientId&&o.id&&String(o.id).toUpperCase()!==String(S.clientId).toUpperCase()&&!m){toast("Ce plan est destiné à un autre client");return false;}
  if(m){S.code=cd;S.clientId=m.id;S.profile.objectif=m.obj;S.mode="client";msg="Connecté";}
  if(o){S.plan={kcal:+o.k||0,swap:o.sw||{},extra:o.x||[],note:o.n||"",at:o.at||todayIso()};S.mode=S.mode||"client";msg=m?"Connecté · plan de Melvin appliqué":"Plan de Melvin appliqué";}
  if(!msg){toast("Code non reconnu. Vérifiez-le avec Melvin.");return false;}save();toast(msg);return true;}
function readExport(str){const m=String(str||"").match(/MBN1:([A-Za-z0-9+/=]+)/);if(!m)return null;try{const o=JSON.parse(decodeURIComponent(escape(atob(m[1]))));return o&&o.v===1?o:null;}catch(e){return null;}}

/* ───────── Mouvement ───────── */
function reveal(root){if(RM)return;[...root.children].forEach((el,i)=>{el.classList.remove("rv","heavy");void el.offsetWidth;el.classList.add("rv");if(i===0)el.classList.add("heavy");el.style.setProperty("--i",Math.min(i,12));});}
function slide(ind,target,parent,anim=true){if(!ind||!target||!parent||!target.offsetWidth)return;const x=target.offsetLeft,w=target.offsetWidth,cx=+ind.dataset.sx,cw=+ind.dataset.sw;
  ind.style.transform="translateX("+x+"px)";ind.style.width=w+"px";
  if(anim&&!RM&&ind.dataset.sw&&cx!==x){const mid=(cx+x)/2,mw=Math.max(cw,w)*1.12;ind.animate([{transform:"translateX("+cx+"px)",width:cw+"px"},{transform:"translateX("+(mid-mw/2+(cw+w)/4)+"px)",width:mw+"px",offset:.5},{transform:"translateX("+x+"px)",width:w+"px"}],{duration:320,easing:EIO});}
  ind.dataset.sx=x;ind.dataset.sw=w;}
function count(el,to,dur=900){if(!el)return;if(RM){el.textContent=fmt(to);return;}const from=+(el.dataset.v||0),t0=performance.now();el.dataset.v=to;const step=t=>{const k=Math.min(1,(t-t0)/dur),e=1-Math.pow(1-k,4);el.textContent=fmt(from+(to-from)*e);if(k<1)requestAnimationFrame(step);};requestAnimationFrame(step);}
function pulse(el){if(!el||RM)return;el.classList.remove("pulse");void el.offsetWidth;el.classList.add("pulse");}
let tT;function toast(msg,undo){$(".toast")?.remove();const t=document.createElement("div");t.className="toast";t.setAttribute("role","status");t.innerHTML="<span>"+esc(msg)+"</span>"+(undo?"<button>Annuler</button>":"");document.body.appendChild(t);
  if(undo)$("button",t).onclick=()=>{undo();t.remove();};if(!RM)t.animate([{opacity:0,transform:"translate(-50%,10px) scale(.95)"},{opacity:1,transform:"translate(-50%,0)"}],{duration:260,easing:EO});
  clearTimeout(tT);tT=setTimeout(()=>{if(RM)return t.remove();t.animate([{opacity:1},{opacity:0,transform:"translate(-50%,8px)"}],{duration:208,easing:EI}).onfinish=()=>t.remove();},undo?4500:2600);}
async function copy(text,btn){try{await navigator.clipboard.writeText(text);toast("Copié");pulse(btn);}catch(e){toast("Copie impossible ici : sélectionnez le texte");}}
const wa=t=>"https://wa.me/"+WA_NUM+"?text="+encodeURIComponent(t),waAny=t=>"https://wa.me/?text="+encodeURIComponent(t);
function sheet(html,mount){$(".sheet")?.remove();$(".sheet-back")?.remove();
  const app=$("#app"),tabs=$(".tabs"),back=document.createElement("div"),sh=document.createElement("div");back.className="sheet-back";sh.className="sheet";sh.setAttribute("role","dialog");sh.setAttribute("aria-modal","true");
  sh.innerHTML='<div class="grab"></div>'+html;document.body.append(back,sh);const opener=document.activeElement;
  let closed=false;const close=()=>{if(closed)return;closed=true;$(".fab")?.setAttribute("aria-expanded","false");
    const end=()=>{document.removeEventListener("keydown",escDoc);back.remove();sh.remove();if(opener&&document.contains(opener))opener.focus({preventScroll:true});};
    if(RM)return end();back.animate([{opacity:1},{opacity:0}],{duration:200,easing:EI,fill:"forwards"});sh.animate([{transform:"none"},{transform:"translateY(48px) scale(.97)",opacity:0}],{duration:200,easing:EI,fill:"forwards"}).onfinish=end;};
  /* Échap ferme aussi quand le focus a quitté la feuille (contenu redessiné) */
  const escDoc=e=>{if(e.key==="Escape"&&document.contains(sh)&&!sh.contains(e.target))close();};document.addEventListener("keydown",escDoc);
  back.onclick=close;sh.addEventListener("keydown",e=>{if(e.key==="Escape")return close();if(e.key==="Tab"){const f=$$("button,a[href],input,select,textarea",sh).filter(x=>!x.disabled&&x.offsetParent);if(!f.length)return;const a0=f[0],a1=f[f.length-1];if(e.shiftKey&&document.activeElement===a0){e.preventDefault();a1.focus();}else if(!e.shiftKey&&document.activeElement===a1){e.preventDefault();a0.focus();}}});
  if(!RM){back.animate([{opacity:0},{opacity:1}],{duration:250,easing:EO});sh.animate([{transform:"translateY(32px) scale(.95)",opacity:0},{transform:"none",opacity:1}],{duration:250,easing:EO});}
  mount&&mount(sh,close);sh.tabIndex=-1;setTimeout(()=>(sh.querySelector("input:not([type=file]),button")||sh).focus({preventScroll:true}),40);return close;}

/* ───────── Navigation ───────── */
function go(h){if(location.hash==="#"+h)route();else location.hash=h;}
let dl=null,coachOn=false,sample=null,canImg=false,last=null,selDate=todayIso();
const TABS=[["journal","Jour","i-ring"],["plan","Plan","i-plan"],null,["progres","Tendances","i-chart"],["profil","Moi","i-user"]];
function renderTabs(){$("#tabs").innerHTML=TABS.map(t=>t?'<a href="#'+t[0]+'" data-v="'+t[0]+'"><svg aria-hidden="true"><use href="#'+t[2]+'"/></svg>'+t[1]+'</a>':'<button class="fab" aria-label="Ajouter" aria-expanded="false"><svg aria-hidden="true"><use href="#i-plus"/></svg></button>').join("")+'<span class="ind" aria-hidden="true"></span>';$(".fab").onclick=quick;}
const ALL=["accueil","journal","plan","progres","profil","bilan","coach"];
function cur(){const h=location.hash.slice(1);if(!S.mode&&h!=="bilan"&&!(h==="coach"&&coachOn))return "accueil";return ALL.includes(h)&&(h!=="coach"||coachOn)?h:"journal";}
function route(){
  const v=cur(),bare=v==="accueil"||v==="bilan";$(".tabs").hidden=bare||v==="coach";$("#top").hidden=v==="accueil";
  $$("#tabs a").forEach(a=>a.dataset.v===v?a.setAttribute("aria-current","page"):a.removeAttribute("aria-current"));
  const tab=$('#tabs a[data-v="'+v+'"]'),ind=$("#tabs .ind");ind.style.opacity=tab?1:0;if(tab)slide(ind,tab,$("#tabs"),last!==null);
  $("#app").classList.toggle("wide",v==="coach");$("#app").classList.toggle("bare",bare);
  header(v);const view=$("#view"),dir=last&&ALL.indexOf(v)<ALL.indexOf(last)?-1:1;
  V[v](view);hydratePhotos(view);
  if(last!==null&&last!==v&&!RM){view.animate([{opacity:0,translate:(dir*24)+"px 0"},{opacity:1,translate:"0 0"}],{duration:280,easing:EO});const f0=view.firstElementChild;f0&&f0.animate([{transform:"translateY(10px)"},{transform:"none"}],{duration:280,easing:EIO});}
  if(last!==v){reveal(view);scrollTo({top:0,behavior:"instant"});}last=v;}
function header(v){const P=S.profile,st=streak();
  const mark='<span class="brandmark"><svg viewBox="0 0 100 100" aria-hidden="true"><path fill="currentColor" style="color:var(--ink)" d="M73 44 59.3 55.3 52.3 98.4 72.6 73.1Z M27.2 44 27.6 73.1 48 98.4 41.1 55.3Z M99.8.8 50.3 35.2.6.8.6 52.1 17.3 65.2 17.4 29 50.1 51.9 82.7 29 83.1 65.2 99.6 52.2Z"/></svg><span>MB NUTRITION</span></span>';
  const date=parse(selDate).toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"});
  const T={journal:selDate===todayIso()?"Aujourd'hui":JOURS_L[dow(selDate)],plan:"Plan",progres:"Tendances",profil:"Moi"};
  if(v==="coach"){$("#top").innerHTML=mark+'<a class="pill" href="#'+(S.mode?"journal":"accueil")+'">Quitter</a>';return;}
  if(v==="bilan"){$("#top").innerHTML=mark+'<span class="pill">Bilan</span>';return;}
  $("#top").innerHTML='<div class="ttl"><small>'+(v==="journal"?date:(S.example?"Exemple":esc(P.prenom)))+'</small><b>'+T[v]+'</b></div>'+
   (v==="journal"?'<span class="row" style="gap:8px">'+(online()&&acct.role!=="coach"?'<button class="hbtn" id="msgB" aria-label="Messages'+(unread?', nouveaux messages':'')+'"><svg aria-hidden="true"><use href="#i-chat"/></svg>'+(unread?'<span class="udot" aria-hidden="true"></span>':'')+'</button>':'')+(S.example?'<a class="pill warn" href="#bilan"><i></i>Bilan</a>':'')+'<span class="streak" title="Jours de suite"><svg aria-hidden="true"><use href="#i-flame"/></svg>'+st+'<span class="sr"> jours de suite</span></span></span>':
    S.example?'<a class="pill warn" href="#bilan"><i></i>Bilan</a>':S.code?'<span class="pill ok"><i></i>Coach</span>':'');
  $("#msgB")&&($("#msgB").onclick=()=>chatSheet());}
/* ───────── Écrans ───────── */
const V={};
const legal='<p class="legal">Valeurs estimées à partir de moyennes, à titre indicatif. MB NUTRITION est un accompagnement nutritionnel sportif : ce n\'est pas un suivi médical ni diététique et il ne remplace pas l\'avis d\'un médecin.</p>';
const ring=(r,ratio,cls="v",w=10)=>{const C=2*Math.PI*r;return '<circle class="t" cx="'+(r+w/2)+'" cy="'+(r+w/2)+'" r="'+r+'" fill="none" stroke-width="'+w+'"/><circle class="'+cls+'" cx="'+(r+w/2)+'" cy="'+(r+w/2)+'" r="'+r+'" fill="none" stroke-width="'+w+'" stroke-linecap="round" stroke-dasharray="'+C+'" stroke-dashoffset="'+C*(1-Math.min(1,Math.max(0,ratio)))+'"/>';};

/* Connexion : client (code de Melvin), découverte, ou coach */
V.accueil=v=>{
  v.innerHTML='<section class="login"><div class="login-mark"><svg viewBox="0 0 100 100" aria-hidden="true"><path fill="url(#ringGrad)" d="M73 44 59.3 55.3 52.3 98.4 72.6 73.1Z M27.2 44 27.6 73.1 48 98.4 41.1 55.3Z M99.8.8 50.3 35.2.6.8.6 52.1 17.3 65.2 17.4 29 50.1 51.9 82.7 29 83.1 65.2 99.6 52.2Z"/></svg><span>MB NUTRITION</span></div>'+
   '<h1>Votre nutrition, calée sur vos entraînements.</h1>'+
   '<div class="login-card card stack"><span class="eyebrow">Espace client</span>'+(syncOn()?'<p class="small mute">Melvin vous a invité ? Connectez-vous avec votre e-mail.</p><button class="btn gold block" id="em">Me connecter par e-mail</button><div class="or"><span>ou avec un code</span></div>':'')+'<form class="stack" id="lg"><label class="f" for="lc">Votre code client<input class="input" id="lc" placeholder="MB-FORME-115-K7Q2-X" autocomplete="off" spellcheck="false"></label><button class="btn '+(syncOn()?"line":"gold")+' block" type="submit">'+(syncOn()?"Valider le code":"Me connecter")+'</button></form>'+
   '<div class="or"><span>ou</span></div><a class="btn line block" href="#bilan">Faire mon bilan</a><button class="lnk" id="demo" style="justify-self:center">Voir un exemple</button></div>'+
   '<div id="coachIn">'+(coachOn?'<a class="card row between" href="#coach" style="text-decoration:none"><span class="row"><span class="ico"><svg aria-hidden="true"><use href="#i-coach"/></svg></span><span><b style="color:var(--ink)">Espace coach</b><br><span class="small mute">Connecté en tant que Melvin</span></span></span><svg class="chev" style="transform:rotate(-90deg)" aria-hidden="true"><use href="#i-chev"/></svg></a>':'')+'</div>'+
   '<p class="legal" style="text-align:center">'+(syncOn()?"Avec un compte, votre suivi est synchronisé de façon sécurisée pour Melvin. Sans compte, vos données restent sur ce téléphone.":"Vos données restent sur ce téléphone.")+'</p></section>';
  $("#lg").onsubmit=e=>{e.preventDefault();if(!applyInput($("#lc").value)){$("#lc").focus();pulse($("#lc"));return;}
    if(S.example){toast("Connecté. Faisons votre bilan.");go("bilan");}else go("journal");};
  $("#demo").onclick=()=>{S.mode="demo";save();go("journal");};$("#em")&&($("#em").onclick=loginSheet);};

function rings3(items,size=172){const W=16,G=4,C=size/2;return '<svg viewBox="0 0 '+size+' '+size+'" aria-hidden="true">'+items.map((it,i)=>{const r=C-W/2-i*(W+G),L=2*Math.PI*r,ratio=Math.min(1,Math.max(0,it.v));return '<circle class="t" cx="'+C+'" cy="'+C+'" r="'+r+'" fill="none" stroke="'+it.c+'" stroke-width="'+W+'"/><circle class="v" cx="'+C+'" cy="'+C+'" r="'+r+'" fill="none" stroke="'+it.c+'" stroke-width="'+W+'" stroke-linecap="round" stroke-dasharray="'+L+'" stroke-dashoffset="'+L*(1-ratio)+'"/>';}).join("")+'</svg>';}
V.journal=v=>{
  const mon=monday(todayIso()),di=dow(selDate),dp=dayPlan(di),eat=eatenOf(selDate),log=dayLog(selDate),steps=S.steps[selDate]||0,goal=S.profile.stepsGoal||8000;
  const water=S.water[selDate]||0,lastC=S.checkins.filter(c=>!c.ex).slice(-1)[0],due=!S.example&&(!lastC||dayDiff(todayIso(),lastC.date)>=7),tr=S.trainings.filter(t=>t.date===selDate),lw=lastWeight(),wk=weekTrainings().length;
  v.innerHTML='<div class="dates" role="group" aria-label="Semaine">'+[0,1,2,3,4,5,6].map(i=>{const d=addDays(mon,i),r=eatenOf(d).k/dayPlan(i).tot.k;return '<button data-d="'+d+'" aria-pressed="'+(d===selDate)+'" class="'+(d>todayIso()?"future":"")+'" aria-label="'+JOURS_L[i]+'"><span class="dl">'+JOURS[i]+'</span><span class="mini"><svg viewBox="0 0 34 34" aria-hidden="true">'+ring(13,r,"v",4)+'</svg><b>'+parse(d).getDate()+'</b></span>'+(S.trainings.some(t=>t.date===d)?'<span class="dot-t" aria-hidden="true"></span>':'')+'</button>'}).join("")+'<span class="sel" aria-hidden="true"></span></div>'+
   '<section class="card hero" aria-label="Résumé du jour"><div class="rings">'+rings3([{v:eat.k/dp.tot.k,c:"var(--kcal)"},{v:eat.p/dp.tot.p,c:"var(--prot)"},{v:steps/goal,c:"var(--steps)"}])+'</div>'+
   '<div class="legend3"><div class="lg"><span class="c-kcal">Calories</span><b><span data-c="'+eat.k+'">0</span><small> / '+fmt(dp.tot.k)+'</small></b></div><div class="lg"><span class="c-prot">Protéines</span><b><span data-c="'+eat.p+'">0</span><small> / '+fmt(dp.tot.p)+' g</small></b></div><div class="lg"><span class="c-steps">Pas</span><b><span data-c="'+steps+'">0</span><small> / '+fmt(goal)+'</small></b></div></div></section>'+
   '<section class="card meals" aria-label="Repas">'+SLOTS.map(([name,ic],i)=>{const es=log.filter(e=>e.slot===i),k=sum(es).k,pl=dp.meals[i];
     return '<div class="mrow'+(es.length?" done":"")+'"><span class="ico"><svg aria-hidden="true"><use href="#'+ic+'"/></svg></span><span><b>'+name+'</b>'+(es.length?'':'<span class="sub">'+esc(pl.t)+'</span>')+'</span><span class="k">'+fmt(es.length?k:pl.tot.k)+'<small> kcal</small></span>'+
      (es.length?'<button class="plus" data-add="'+i+'" aria-label="Ajouter : '+name.toLowerCase()+'"><svg aria-hidden="true"><use href="#i-plus"/></svg></button>':'<button class="plus" data-quick="'+i+'" aria-label="Noter le repas prévu : '+esc(pl.t)+'" title="Noter le repas prévu"><svg aria-hidden="true"><use href="#i-check"/></svg></button>')+
      (es.length?'<ul class="entries">'+es.map(e=>'<li class="entry'+(e.photo?" has-ph":"")+'">'+(e.photo?'<span class="thumb" data-ph="'+e.photo+'" role="img" aria-label="Photo"></span>':'')+'<span><b>'+esc(e.name)+'</b></span><span class="k">'+fmt(e.k)+'</span><button class="x" data-del="'+e.id+'" aria-label="Retirer '+esc(e.name)+'"><svg aria-hidden="true"><use href="#i-x"/></svg></button></li>').join("")+'</ul>':'')+'</div>';}).join("")+(!log.length&&selDate<=todayIso()&&dayLog(addDays(selDate,-1)).length?'<button class="hint" id="same" style="margin-top:6px"><svg aria-hidden="true"><use href="#i-copy"/></svg>Même chose qu\'hier</button>':'')+'</section>'+
   nudge()+'<div class="tiles">'+
    '<button class="tile" data-tile="water"><span class="tl c-water">Eau<svg aria-hidden="true"><use href="#i-drop"/></svg></span><span><span class="n">'+dec(water*.25,water%4?2:0)+'<small> / 2 L</small></span><span class="track" style="display:block;margin-top:8px"><i style="background:var(--water);transform:scaleX(0)" data-x="'+Math.min(1,water/8)+'"></i></span></span></button>'+
    '<button class="tile" data-tile="steps"><span class="tl c-steps">Pas<svg aria-hidden="true"><use href="#i-steps"/></svg></span><span><span class="n">'+fmt(steps)+'</span><span class="track" style="display:block;margin-top:8px"><i style="background:var(--steps);transform:scaleX(0)" data-x="'+Math.min(1,steps/goal)+'"></i></span>'+(S.health.on&&steps&&S.health.steps?.[selDate]===steps?'<span class="via">via Santé</span>':'')+'</span></button>'+
    (S.hr[selDate]?(x=>'<button class="tile" data-tile="hr"><span class="tl c-hr">Cœur<svg aria-hidden="true"><use href="#i-heart"/></svg></span><span><span class="n">'+(x.resting||x.avg||"–")+'<small> bpm</small></span><span class="sub">'+(x.resting?"au repos":"en moyenne")+(x.resting&&x.avg?" · moy. "+x.avg:"")+'</span></span></button>')(S.hr[selDate]):'')+
    (S.sleep[selDate]?(m=>'<button class="tile" data-tile="sleep"><span class="tl c-sleep">Sommeil<svg aria-hidden="true"><use href="#i-bed"/></svg></span><span><span class="n">'+Math.floor(m/60)+'<small> h </small>'+String(m%60).padStart(2,"0")+'</span><span class="sub">'+(S.active[selDate]?fmt(S.active[selDate])+" kcal actives":"cette nuit")+'</span></span></button>')(S.sleep[selDate]):'')+
    '<button class="tile" data-tile="train"><span class="tl c-train">Séance<svg aria-hidden="true"><use href="#i-dumbbell"/></svg></span><span><span class="n">'+(tr.length?fmt(tr.reduce((a,t)=>a+t.min,0))+'<small> min</small>':wk+'<small> / '+S.profile.seances+'</small>')+'</span><span class="sub">'+(tr.length?esc(tr.map(t=>t.sport).join(" · ")):"cette semaine")+'</span></span></button>'+
    '<button class="tile" data-tile="weight"><span class="tl c-weight">Poids<svg aria-hidden="true"><use href="#i-scale"/></svg></span><span><span class="n">'+(lw?dec(lw.kg):"–")+'<small> kg</small></span><span class="sub">'+(lw?short(lw.date):"à noter")+'</span></span></button>'+
    '<button class="tile wide" data-tile="fast">'+fastTileIn()+'</button>'+
    (due?'<button class="tile due" data-tile="ci" style="grid-column:1/-1;min-height:0"><span class="tl">Point de la semaine<svg aria-hidden="true"><use href="#i-pulse"/></svg></span></button>':'')+
   '</div>';
  const dates=$(".dates",v);requestAnimationFrame(()=>{slide($(".sel",dates),$('[aria-pressed="true"]',dates),dates,false);$$("[data-c]",v).forEach(el=>count(el,+el.dataset.c));$$(".track [data-x]",v).forEach(el=>requestAnimationFrame(()=>el.style.transform="scaleX("+el.dataset.x+")"));
    if(!RM)$$(".rings .v,.mini .v",v).forEach((c,i)=>c.animate([{strokeDashoffset:c.getAttribute("stroke-dasharray")},{strokeDashoffset:c.getAttribute("stroke-dashoffset")}],{duration:1100,delay:i<3?i*90:0,easing:EO,fill:"backwards"}));});
  const pick=d=>{if(d===selDate||d<mon||d>addDays(mon,6))return;const b=$('[data-d="'+d+'"]',dates),dir=d>selDate?1:-1;selDate=d;$$("[data-d]",dates).forEach(x=>x.setAttribute("aria-pressed",x===b));slide($(".sel",dates),b,dates);header("journal");
    const go2=()=>{V.journal(v);hydratePhotos(v);$('[data-d="'+selDate+'"]',v)?.focus({preventScroll:true});if(!RM){const h=$(".hero",v);h&&h.animate([{opacity:.4,transform:"translateX("+(dir*22)+"px)"},{opacity:1,transform:"none"}],{duration:260,easing:EO});}};
    if(RM)return go2();const h=$(".hero",v);h.animate([{opacity:1},{opacity:.3,transform:"translateX("+(-dir*16)+"px)"}],{duration:150,easing:EI}).onfinish=go2;};
  $$("[data-d]",dates).forEach(b=>b.onclick=()=>pick(b.dataset.d));
  /* balayage entre les jours, élastique en début et fin de semaine */
  const hero=$(".hero",v);let sx=null,sy=0,dx=0,lock=null;
  hero.addEventListener("touchstart",e=>{sx=e.touches[0].clientX;sy=e.touches[0].clientY;dx=0;lock=null;},{passive:true});
  hero.addEventListener("touchmove",e=>{if(sx===null)return;const mx=e.touches[0].clientX-sx,my=e.touches[0].clientY-sy;if(lock===null&&(Math.abs(mx)>10||Math.abs(my)>10))lock=Math.abs(mx)>Math.abs(my)*1.3?"x":"y";if(lock!=="x")return;
    const i=dow(selDate),edge=(mx>0&&i===0)||(mx<0&&i===6),w=hero.offsetWidth;dx=edge?(1-1/(Math.abs(mx)*.55/w+1))*w*Math.sign(mx):mx*.6;hero.style.transform="translateX("+dx+"px)";},{passive:true});
  hero.addEventListener("touchend",()=>{if(lock!=="x"){sx=null;return;}const i=dow(selDate),go3=Math.abs(dx)>hero.offsetWidth*.18?(dx<0?i+1:i-1):-1;hero.style.transform="";sx=null;
    if(go3>=0&&go3<=6)pick(addDays(mon,go3));else if(!RM)hero.animate([{transform:"translateX("+dx+"px)"},{transform:"none"}],{duration:340,easing:EO});});
  $$("[data-add]",v).forEach(b=>b.onclick=()=>addSheet(+b.dataset.add));
  $$("[data-quick]",v).forEach(b=>b.onclick=()=>addEntry(entryFromMeal(WEEK[dow(selDate)][+b.dataset.quick],+b.dataset.quick)));
  $$("[data-del]",v).forEach(b=>b.onclick=()=>{const day=selDate,L=S.log[day],i=L.findIndex(e=>e.id===b.dataset.del),e=L[i];let undone=false;L.splice(i,1);save();rerender();toast("Retiré",()=>{undone=true;(S.log[day]=S.log[day]||[]).splice(i,0,e);save();rerender();});if(e.photo)setTimeout(()=>{if(!undone)PH.del(e.photo);},6000);});
  bindNudge(v);$("#same",v)&&($("#same",v).onclick=()=>{const y=dayLog(addDays(selDate,-1)),day=selDate;S.log[day]=y.map(e=>{const c=Object.assign({},e,{id:"e"+uid()});delete c.photo;if(c.kind==="photo")c.kind="copy";return c;});save();rerender();$$(".mrow .ico",v).forEach((x,i)=>setTimeout(()=>pulse(x),i*30));toast("+ "+fmt(eatenOf(day).k)+" kcal",()=>{delete S.log[day];save();rerender();});});
  $$("[data-tile]",v).forEach(b=>b.onclick=()=>({water:()=>water1(1,b),steps:stepsSheet,train:trainingSheet,weight:weightSheet,ci:checkinSheet,hr:hrSheet,sleep:sleepSheet,fast:fastSheet})[b.dataset.tile]());};
function rerender(focusSel){const v=$("#view");header(cur());V[cur()](v);hydratePhotos(v);if(focusSel)$(focusSel,v)?.focus({preventScroll:true});}
function water1(n,btn){const w=Math.max(0,Math.min(16,(S.water[selDate]||0)+n));S.water[selDate]=w;save();if(cur()==="journal"){rerender('[data-tile="water"]');pulse($('[data-tile="water"]'));}toast(dec(w*.25,w%4?2:0)+" L"+(w===8?" · objectif atteint":""),()=>{S.water[selDate]=Math.max(0,w-n);save();if(cur()==="journal")rerender();});}
function stepsSheet(){let n=S.steps[selDate]||0;const goal=S.profile.stepsGoal||8000;
  sheet('<div class="stack"><span class="eyebrow c-steps">Pas · '+short(selDate)+'</span><div class="stepper"><button data-s="-500" aria-label="Moins 500">−</button><output id="sN"></output><button data-s="500" aria-label="Plus 500">+</button></div><label class="f" for="sI">Nombre exact<input class="input" id="sI" type="number" inputmode="numeric" min="0" max="80000" step="1"></label>'+(hOK?'<p class="small mute">Recopiez le total de l\'app Santé ou de votre montre. Objectif : '+fmt(goal)+'.</p>':'<button class="hint" id="sH"><svg aria-hidden="true" style="color:var(--steps)"><use href="#i-heart"/></svg>Importer depuis Santé</button><button class="lnk" id="sG" style="justify-self:start">Relier l\'app Santé</button>')+'<button class="btn block" id="sA">Enregistrer</button></div>',(sh,close)=>{
    /* Sans Santé native (navigateur, artifact) : un raccourci iPhone copie le total, on le colle ici */
    const imp=t=>{const r=parseSteps(t);if(!r)return false;if(r.date&&r.date!==selDate){S.steps[r.date]=r.n;save();close();toast(fmt(r.n)+" pas · "+short(r.date));if(cur()==="journal")rerender();return true;}n=r.n;$("#sI",sh).value=n;$("#sN",sh).textContent=fmt(n);pulse($("#sN",sh));toast(fmt(n)+" pas importés");return true;};
    $("#sH",sh)&&($("#sH",sh).onclick=async()=>{let t="";try{t=await navigator.clipboard.readText();}catch(e){}if(!t||!imp(t)){$("#sI",sh).focus();toast("Collez ici le nombre copié par le raccourci");}});
    $("#sG",sh)&&($("#sG",sh).onclick=()=>{close();setTimeout(healthSheet,240);});
    $("#sI",sh).addEventListener("paste",e=>{const t=(e.clipboardData||window.clipboardData)?.getData("text");if(t&&/\D/.test(t.trim())&&imp(t))e.preventDefault();});
    const upd=()=>{$("#sN",sh).textContent=fmt(n);$("#sI",sh).value=n;};upd();
    $$("[data-s]",sh).forEach(b=>b.onclick=()=>{n=Math.max(0,Math.min(80000,n+ +b.dataset.s));upd();});$("#sI",sh).oninput=e=>{const x=parseInt(e.target.value,10);if(x>=0&&x<=80000){n=x;$("#sN",sh).textContent=fmt(n);}};
    $("#sA",sh).onclick=()=>{S.steps[selDate]=n;save();close();rerender('[data-tile="steps"]');if(n>=goal)setTimeout(()=>pulse($('[data-tile="steps"]')),300);toast(fmt(n)+" pas"+(n>=goal?" · objectif atteint":""));};});}
/* « MBPAS 2026-11-18 8 421 » (raccourci) ou juste un nombre ; la date est facultative */
function parseSteps(t){t=String(t||"");const m=t.match(/MBPAS[:\s]*(\d{4}-\d{2}-\d{2})?[:\s]*([\d\s\u202f\u00a0.,]+)/i),raw=m?m[2]:(t.match(/\d[\d\s\u202f\u00a0.,]*/)||[""])[0];
  const n=Math.round(parseFloat(raw.replace(/[\s\u202f\u00a0]/g,"").replace(/[.,](?=\d{3}\b)/g,"").replace(",",".")));return n>=0&&n<200000?{n,date:m&&m[1]&&iso(parse(m[1]))===m[1]?m[1]:null}:null;}
function healthSheet(){sheet('<div class="stack"><span class="eyebrow c-steps">App Santé</span><h2>Relier vos pas</h2>'+
   '<p class="small mute">Une seule fois, sur iPhone, dans l\'app Raccourcis :</p><ol class="howto"><li>Touchez <b>+</b> et ajoutez <b>Rechercher des échantillons de santé</b> : type <b>Nombre de pas</b>, date de début <b>Aujourd\'hui</b>.</li><li>Ajoutez <b>Calculer des statistiques</b> : <b>Somme</b>.</li><li>Ajoutez <b>Copier dans le presse-papiers</b>.</li><li>Nommez-le <b>Pas MB</b> et autorisez l\'accès à Santé.</li></ol>'+
   '<p class="small mute">Ensuite : lancez <b>Pas MB</b>, puis ici Pas › <b>Importer depuis Santé</b>.</p><button class="btn block" id="hOk">Compris</button></div>',(sh,close)=>{$("#hOk",sh).onclick=close;});}
function addEntry(e){(S.log[selDate]=S.log[selDate]||[]).push(e);save();if(cur()==="journal"){rerender('[data-add="'+e.slot+'"]');const r=$$(".mrow")[e.slot];if(r)pulse($(".ico",r));}toast("+ "+fmt(e.k)+" kcal");}

/* Ajout : repas prévu, aliment au gramme, ou photo (analyse IA si disponible) */
function addSheet(slot,start="plan"){
  const di=dow(selDate),planned=WEEK[di][slot],alts=Object.keys(MEALS).filter(id=>MEALS[id].slot===SLOTS[slot][0]&&id!==planned);
  sheet('<div class="stack"><span class="eyebrow">'+SLOTS[slot][0]+' · '+JOURS_L[di]+'</span><h2>Ajouter</h2><div class="segs">'+[["plan","Repas"],["food","Aliment"],["scan","Scan"],["photo","Photo"]].map(([k,l])=>'<button data-t="'+k+'" aria-pressed="'+(k===start)+'">'+l+'</button>').join("")+'<span class="sel" aria-hidden="true"></span></div><div id="addB"></div></div>',(sh,close)=>{
    const segs=$(".segs",sh),B=$("#addB",sh);
    const drawPlan=()=>{B.innerHTML='<div class="stack">'+[planned,...alts].map((id,i)=>{const m=mealPlan(id);return '<button class="food'+(i?"":" hl")+'" data-m="'+id+'"><span><b>'+esc(m.t)+'</b><br><span>'+(i?"Autre idée":"Prévu dans votre plan")+' · '+fmt(m.tot.p)+' g prot.</span></span><span class="kc">'+fmt(m.tot.k)+' kcal</span></button>'}).join("")+'</div>';$$("[data-m]",B).forEach(b=>b.onclick=()=>{close();addEntry(entryFromMeal(b.dataset.m,slot));});};
    const drawFood=()=>{B.innerHTML='<div class="stack"><div class="search"><svg aria-hidden="true"><use href="#i-search"/></svg><label class="sr" for="fq">Rechercher un aliment</label><input class="input" id="fq" type="search" placeholder="Poulet, riz, banane…" autocomplete="off"></div><div class="foods" id="fl"></div></div>';
      const list=[...Object.keys(FOODS),...Object.keys(S.foods)].sort((a,b)=>foodOf(a).n.localeCompare(foodOf(b).n,"fr")),norm=s=>s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu,"");
      const draw=q=>{$("#fl",B).innerHTML=list.filter(f=>!q||norm(foodOf(f).n+" "+(foodOf(f).brand||"")).includes(norm(q))).map(f=>{const F=foodOf(f);return '<button class="food" data-f="'+esc(f)+'"><b>'+esc(F.n)+(F.brand?' <span>· '+esc(F.brand)+'</span>':'')+'</b><span>'+fmt(F.k)+' kcal / 100 g</span></button>';}).join("")||'<p class="small mute">Aucun aliment trouvé. Utilisez l\'onglet Photo, ou écrivez à Melvin.</p>';$$("[data-f]",B).forEach(b=>b.onclick=()=>grams(b.dataset.f));};
      draw("");$("#fq",B).oninput=e=>draw(e.target.value);$("#fq",B).focus();};
    const grams=(f,back=drawFood)=>{const F=foodOf(f);let g=F.piece||100;const st=F.piece||10;
      const img=/^https:\/\/[^"'\s<>]+$/.test(F.img||"")?'<img src="'+esc(F.img)+'" alt="" loading="lazy" onerror="this.style.visibility=\'hidden\'">':'<span class="ico"><svg aria-hidden="true"><use href="#i-barcode"/></svg></span>';
      B.innerHTML='<div class="stack"><button class="lnk" id="bk" style="justify-self:start">← Retour</button>'+(F.ean?'<div class="prod">'+img+'<span><h2 style="font-size:1.125rem">'+esc(F.n)+'</h2><span class="mute">'+esc(F.brand||"")+(F.brand?" · ":"")+'pour 100 g : '+fmt(F.k)+' kcal · P '+dec(F.p)+' · G '+dec(F.g)+' · L '+dec(F.l)+'</span></span>'+(/^[a-e]$/.test(F.ns||"")?'<span class="ns ns-'+F.ns+'" role="img" aria-label="Nutri-Score '+F.ns.toUpperCase()+'">'+F.ns.toUpperCase()+'</span>':'')+'</div>':'<h2 style="font-size:1.25rem">'+esc(F.n)+'</h2>')+'<div class="stepper"><button data-g="-1" aria-label="Moins">−</button><output id="gv"></output><button data-g="1" aria-label="Plus">+</button></div><div class="macline" id="gm"></div><button class="btn gold block" id="gA">Ajouter</button></div>';
      const upd=()=>{const m=macros(f,g);$("#gv",B).textContent=F.piece?plural(g/F.piece,F.unit):g+" g";$("#gm",B).innerHTML='<span><b>'+fmt(m.k)+' kcal</b></span>'+[["Prot.","p"],["Gluc.","g"],["Lip.","l"]].map(([n,k])=>'<span><i style="background:'+MAC_COL[k]+'"></i>'+n+' '+fmt(m[k])+' g</span>').join("");};
      upd();$$("[data-g]",B).forEach(b=>b.onclick=()=>{g=Math.max(st,Math.min(F.piece?F.piece*6:1000,g+ +b.dataset.g*st));upd();});$("#bk",B).onclick=()=>back();$("#gA",B).onclick=()=>{close();addEntry(entryFromFood(f,g,slot));};};
    const drawPhoto=()=>{let blob=null,ctl=null;
      B.innerHTML='<div class="stack"><label class="drop" for="pf"><span class="drop-in" id="pv"><svg aria-hidden="true"><use href="#i-camera"/></svg><b>Prendre ou choisir une photo</b><span class="small mute">Le repas vu du dessus, en entier</span></span><input id="pf" type="file" accept="image/*" capture="environment" class="sr"></label><div id="pr" class="stack"></div></div>';
      $("#pf",B).onchange=async e=>{const file=e.target.files[0];if(!file)return;try{blob=await compress(file);}catch(x){toast("Photo illisible, essayez une autre image");return;}
        const u=URL.createObjectURL(blob);$("#pv",B).innerHTML='<span class="preview" style="background-image:url('+u+')"></span>';form();};
      const form=(est)=>{est=est||{};$("#pr",B).innerHTML=((canImg||online())&&!est.done?'<button class="btn block" id="ai"><svg aria-hidden="true"><use href="#i-spark"/></svg>Analyser les calories avec l\'IA</button>':'')+(est.note?'<p class="small ai-note">'+esc(est.note)+'</p>':'')+
        '<label class="f" for="pn">Nom du repas<input class="input" id="pn" value="'+esc(est.nom||"")+'" placeholder="Ex. poulet, riz et légumes"></label><div class="grid2"><label class="f" for="pk">Calories (kcal)<input class="input" id="pk" type="number" inputmode="numeric" min="0" max="4000" value="'+(est.kcal??"")+'" placeholder="Estimation"></label><label class="f" for="pp">Protéines (g)<input class="input" id="pp" type="number" inputmode="numeric" min="0" max="300" value="'+(est.p??"")+'" placeholder="Facultatif"></label></div><button class="btn gold block" id="pA">Ajouter avec la photo</button>'+(canImg||online()?'':'<p class="small mute">Pas d\'estimation automatique ici : indiquez une estimation, Melvin la vérifiera avec la photo.</p>');
        $("#ai",B)&&($("#ai",B).onclick=async e=>{const b=e.currentTarget;b.disabled=true;b.innerHTML='<span class="spin" aria-hidden="true"></span>Analyse en cours…';ctl=new AbortController();
          try{const r=!canImg?await MBSync.analyzeMeal(blob):await sample.json("Tu es l'assistant d'un coach sportif. Estime le contenu nutritionnel du repas sur la photo, portion visible entière. Réponds uniquement en JSON : {\"nom\":\"nom court en français\",\"kcal\":nombre,\"p\":g de protéines,\"g\":g de glucides,\"l\":g de lipides,\"aliments\":[\"aliment et quantité estimée\"],\"confiance\":\"faible|moyenne|bonne\"}. Si ce n'est pas un repas, renvoie {\"nom\":\"\",\"kcal\":0}.",{images:[blob],signal:ctl.signal,modelTier:"default"});
            if(r==null)throw new Error("ai");if(!r.kcal){form({note:"Je ne reconnais pas de repas sur cette photo. Indiquez-le à la main."});return;}
            form({done:true,nom:r.nom,kcal:Math.round(r.kcal),p:Math.round(r.p||0),g:r.g,l:r.l,note:"Estimation de l'IA (confiance "+(r.confiance||"moyenne")+") : "+(r.aliments||[]).join(", ")+". Corrigez si besoin."});$("#pr",B).dataset.g=r.g||0;$("#pr",B).dataset.l=r.l||0;$("#pr",B).dataset.ai=1;}
          catch(x){form({note:x.code==="not_granted"?"Analyse refusée : indiquez une estimation à la main.":"L'analyse n'a pas abouti. Indiquez une estimation à la main."});}});
        $("#pA",B).onclick=async()=>{const k=+$("#pk",B).value,nom=$("#pn",B).value.trim()||"Repas en photo";if(!(k>0)){toast("Indiquez une estimation des calories");$("#pk",B).focus();return;}
          const id="p"+uid();try{await PH.put(id,blob);}catch(x){toast("Photo non enregistrée sur ce téléphone");}
          const pr=$("#pr",B);close();addEntry({id:"e"+uid(),slot,kind:"photo",photo:id,name:nom,k,p:+$("#pp",B)?.value||0,g:+(pr.dataset.g||0),l:+(pr.dataset.l||0),ai:!!pr.dataset.ai});};};
      };
    /* Scan : caméra (native.js) ou saisie du code, puis Open Food Facts ; produit gardé dans S.foods */
    const drawScan=()=>{const cam=!!window.MBNative?.scanBarcode;
      B.innerHTML='<div class="stack">'+(cam?'<button class="btn gold block" id="scB"><svg aria-hidden="true"><use href="#i-barcode"/></svg>Scanner un code-barres</button><div class="or"><span>ou</span></div>':'')+
       '<form class="row" id="scF" style="gap:8px"><label class="sr" for="scI">Code-barres (8 à 14 chiffres)</label><input class="input" id="scI" inputmode="numeric" autocomplete="off" placeholder="Code-barres, ex. 3017620422003" maxlength="14"><button class="btn soft" id="scG" type="submit">Chercher</button></form><div id="scR" class="stack" aria-live="polite"></div><p class="small mute">Valeurs d\'Open Food Facts, base collaborative : vérifiez l\'étiquette.</p></div>';
      const msg=t=>{$("#scR",B).innerHTML='<p class="small ai-note">'+t+'</p>';};
      const look=async raw=>{const ean=String(raw||"").replace(/\D/g,"");if(!/^\d{8,14}$/.test(ean)){msg("Code-barres invalide : 8 à 14 chiffres.");$("#scI",B)?.focus();return;}
        const key="x"+ean;if(S.foods[key])return grams(key,drawScan);
        $("#scR",B).innerHTML='<p class="small mute"><span class="spin" aria-hidden="true"></span> Recherche du produit…</p>';
        const ctl=new AbortController(),to=setTimeout(()=>ctl.abort(),10000);
        try{const r=await fetch("https://world.openfoodfacts.org/api/v2/product/"+ean+".json?fields=product_name,brands,nutriments,nutriscore_grade,image_front_small_url",{signal:ctl.signal});
          const o=r.status===404?null:await r.json();if(!B.isConnected)return;const P=o&&o.status!==0&&o.product,N=P&&P.nutriments||{};
          const num=k=>{const x=parseFloat(N[k]);return x>=0&&x<1e4?x:null;},k=num("energy-kcal_100g")??(num("energy_100g")!=null?num("energy_100g")/4.184:null);
          if(!P||k==null){msg(P?"Produit trouvé, mais sans valeurs nutritionnelles. Ajoutez-le avec l\'onglet Photo.":"Produit introuvable dans Open Food Facts. Essayez l\'onglet Aliment ou Photo.");return;}
          S.foods[key]={n:String(P.product_name||"Produit "+ean).slice(0,80),brand:String(P.brands||"").split(",")[0].trim().slice(0,40),k:Math.round(k),p:num("proteins_100g")||0,g:num("carbohydrates_100g")||0,l:num("fat_100g")||0,
            ns:String(P.nutriscore_grade||"").toLowerCase(),img:String(P.image_front_small_url||""),ean,r:"Produits scannés"};save();grams(key,drawScan);}
        catch(x){if(B.isConnected)msg(navigator.onLine===false?"Pas de connexion. Réessayez plus tard ou utilisez l\'onglet Aliment.":"Recherche impossible pour le moment. Réessayez.");}
        finally{clearTimeout(to);}};
      $("#scF",B).onsubmit=e=>{e.preventDefault();look($("#scI",B).value);};
      cam&&($("#scB",B).onclick=async e=>{const b=e.currentTarget;b.disabled=true;const c=await window.MBNative.scanBarcode();b.disabled=false;if(c)look(c);else{msg("Scan annulé ou caméra indisponible : saisissez le code.");$("#scI",B)?.focus();}});};
    const draw={plan:drawPlan,food:drawFood,scan:drawScan,photo:drawPhoto};
    requestAnimationFrame(()=>slide($(".sel",segs),$('[aria-pressed="true"]',segs),segs,false));
    $$("[data-t]",segs).forEach(b=>b.onclick=()=>{$$("[data-t]",segs).forEach(x=>x.setAttribute("aria-pressed",x===b));slide($(".sel",segs),b,segs);draw[b.dataset.t]();if(!RM)B.animate([{opacity:0,filter:"blur(3px)"},{opacity:1,filter:"blur(0)"}],{duration:220,easing:EO});});
    draw[start]();});}

function trainingSheet(){let sp=S.profile.sport||"Musculation",mn=60,it=S.profile.intensite||2,d=selDate>todayIso()?todayIso():selDate;
  sheet('<div class="stack"><span class="eyebrow">Entraînement · '+short(d)+'</span><h2>Noter une séance</h2><div class="chips wrap" id="tS">'+SPORTS.map(s=>'<button class="chip" data-s="'+s+'" aria-pressed="'+(s===sp)+'">'+s+'</button>').join("")+'</div><div class="stack" style="gap:8px"><b class="small" style="color:var(--ink)">Durée</b><div class="stepper"><button data-m="-15" aria-label="Moins 15 minutes">−</button><output id="tM">60 min</output><button data-m="15" aria-label="Plus 15 minutes">+</button></div></div><div class="stack" style="gap:8px"><b class="small" style="color:var(--ink)">Intensité</b><div class="segs" id="tI">'+INT_TXT.map((t,i)=>'<button data-i="'+(i+1)+'" aria-pressed="'+(i+1===it)+'">'+t+'</button>').join("")+'<span class="sel" aria-hidden="true"></span></div></div><button class="btn gold block" id="tA">Enregistrer la séance</button></div>',(sh,close)=>{
    $$("[data-s]",sh).forEach(b=>b.onclick=()=>{sp=b.dataset.s;$$("[data-s]",sh).forEach(x=>x.setAttribute("aria-pressed",x===b));});
    $$("[data-m]",sh).forEach(b=>b.onclick=()=>{mn=Math.max(15,Math.min(240,mn+ +b.dataset.m));$("#tM",sh).textContent=mn+" min";});
    const segs=$("#tI",sh);requestAnimationFrame(()=>slide($(".sel",segs),$('[aria-pressed="true"]',segs),segs,false));
    $$("[data-i]",sh).forEach(b=>b.onclick=()=>{it=+b.dataset.i;$$("[data-i]",sh).forEach(x=>x.setAttribute("aria-pressed",x===b));slide($(".sel",segs),b,segs);});
    $("#tA",sh).onclick=()=>{S.trainings=S.trainings.filter(t=>!t.ex);S.trainings.push({id:"t"+uid(),date:d,sport:sp,min:mn,intensite:it});save();close();if(cur()==="journal"||cur()==="progres")rerender();
      const n=weekTrainings().length;toast(n>=S.profile.seances?"Séance notée · objectif de la semaine atteint":"Séance notée · "+n+" / "+S.profile.seances+" cette semaine");};});}
function weightSheet(){const lw=lastWeight();let kg=lw?lw.kg:S.profile.poids;
  sheet('<div class="stack"><span class="eyebrow">Poids · '+short(todayIso())+'</span><h2>Noter mon poids</h2><div class="stepper"><button data-k="-0.1" aria-label="Moins 100 grammes">−</button><output id="wK"></output><button data-k="0.1" aria-label="Plus 100 grammes">+</button></div><label class="f" for="wI">Ou saisissez-le<input class="input" id="wI" type="number" inputmode="decimal" step="0.1" min="30" max="250" value="'+kg+'"></label><p class="small mute">Pesez-vous le matin, au réveil, pour comparer des choses comparables. Le poids n\'est qu\'un indicateur parmi d\'autres.</p><button class="btn gold block" id="wA">Enregistrer</button></div>',(sh,close)=>{
    const upd=()=>{$("#wK",sh).textContent=dec(kg)+" kg";$("#wI",sh).value=kg.toFixed(1);};upd();
    $$("[data-k]",sh).forEach(b=>b.onclick=()=>{kg=Math.round((kg+ +b.dataset.k)*10)/10;upd();});$("#wI",sh).oninput=e=>{const x=parseFloat(String(e.target.value).replace(",","."));if(x>=30&&x<=250){kg=x;$("#wK",sh).textContent=dec(kg)+" kg";}};
    $("#wA",sh).onclick=()=>{S.weights=S.weights.filter(w=>!w.ex&&w.date!==todayIso());S.weights.push({date:todayIso(),kg});S.profile.poids=kg;save();close();rerender();toast("Poids enregistré : "+dec(kg)+" kg");};});}

function quick(){$(".fab").setAttribute("aria-expanded","true");const h=new Date().getHours(),slot=h<10?0:h<15?1:h<18?2:3;
  sheet('<div class="stack"><div class="actions">'+
   [["meal",SLOTS[slot][1],"Repas","var(--kcal)"],["photo","i-camera","Photo","var(--ink)"],["water","i-drop","Eau","var(--water)"],["steps","i-steps","Pas","var(--steps)"],["train","i-dumbbell","Séance","var(--train)"],["weight","i-scale","Poids","var(--weight)"],["fast","i-timer","Jeûne","var(--fast)"],["scan","i-barcode","Scan","var(--ink)"],["measure","i-ruler","Mesures","var(--weight)"]].map(([k,ic,t,c])=>'<button class="act" data-a="'+k+'"><span class="ico" style="background:'+c+'"><svg aria-hidden="true"><use href="#'+ic+'"/></svg></span><b>'+t+'</b></button>').join("")+
   '</div><button class="btn line block" data-a="ci"><svg aria-hidden="true"><use href="#i-pulse"/></svg>Point de la semaine</button></div>',(sh,close)=>{
    $$("[data-a]",sh).forEach(b=>b.onclick=()=>{const a=b.dataset.a;close();selDate=todayIso();const go2=cur()!=="journal"&&["meal","water","fast"].includes(a);if(go2)go("journal");
      setTimeout(()=>({meal:()=>addSheet(slot),photo:()=>addSheet(slot,"photo"),steps:stepsSheet,train:trainingSheet,weight:weightSheet,water:()=>water1(1,$(".fab")),ci:checkinSheet,fast:fastSheet,scan:()=>addSheet(slot,"scan"),measure:measureSheet})[a](),go2?340:240);});});}
V.plan=v=>{let tab=V.plan.tab||"semaine",d=V.plan.day??dow(todayIso());
  v.innerHTML='<div class="segs" aria-label="Plan">'+[["semaine","Semaine"],["recettes","Recettes"],["courses","Courses"]].map(([k,l])=>'<button data-t="'+k+'" aria-pressed="'+(k===tab)+'">'+l+'</button>').join("")+'<span class="sel" aria-hidden="true"></span></div><div id="pB" class="stack"></div>';
  const segs=$(".segs",v),B=$("#pB",v),draw=()=>{if(tab==="semaine")semaine(B,d,n=>{d=V.plan.day=n;});else if(tab==="recettes")recettes(B);else courses(B);reveal(B);};
  requestAnimationFrame(()=>slide($(".sel",segs),$('[aria-pressed="true"]',segs),segs,false));
  $$("[data-t]",segs).forEach(b=>b.onclick=()=>{if(b.dataset.t===tab)return;tab=V.plan.tab=b.dataset.t;$$("[data-t]",segs).forEach(x=>x.setAttribute("aria-pressed",x===b));slide($(".sel",segs),b,segs);
    if(RM)return draw();B.animate([{opacity:1},{opacity:0,filter:"blur(3px)"}],{duration:140,easing:EI}).onfinish=()=>{draw();B.animate([{opacity:0},{opacity:1}],{duration:220,easing:EO});};});draw();};
function semaine(B,d,setD){const dp=dayPlan(d),P=S.profile;
  B.innerHTML='<div class="chips" aria-label="Jour">'+JOURS_L.map((j,i)=>'<button class="chip" data-d="'+i+'" aria-pressed="'+(i===d)+'">'+j.slice(0,3)+(i===dow(todayIso())?" ·":"")+'</button>').join("")+'</div>'+
   '<section class="card stack"><div class="day-h"><div><span class="eyebrow">'+JOURS_L[d]+' · portions '+pct()+' %</span><div style="margin-top:6px"><span class="n">'+fmt(dp.tot.k)+'</span> <span class="mute">kcal</span></div></div>'+(S.plan?'<span class="pill ok">Plan de Melvin</span>':S.code?'<span class="pill ok">Plan de Melvin</span>':'')+'</div><div class="macline">'+[["Protéines","p"],["Glucides","g"],["Lipides","l"]].map(([n,k])=>'<span><i style="background:'+MAC_COL[k]+'"></i>'+n+' <b>'+fmt(dp.tot[k])+' g</b></span>').join("")+'</div>'+(S.example?'':planKcal()?'<p class="small mute">Objectif fixé par Melvin : '+fmt(planKcal())+' kcal par jour.</p>':'')+(S.plan&&S.plan.note?'<p class="note">« '+esc(S.plan.note)+' »<small>Melvin</small></p>':'')+'</section>'+
   dp.meals.map((m,i)=>recipe(m,SLOTS[i][1])).join("")+'<p class="legal">Estimations indicatives. Pas un suivi médical.</p>';
  $$("[data-d]",B).forEach(b=>b.onclick=()=>{const n=+b.dataset.d;setD(n);semaine(B,n,setD);$('[data-d="'+n+'"]',B)?.focus({preventScroll:true});if(!RM)B.animate([{opacity:0,transform:"translateX("+(n>d?18:-18)+"px)"},{opacity:1,transform:"none"}],{duration:240,easing:EO});});bindRcp(B);}
function recipe(m,ic){return '<article class="rcp" data-open="false"><button aria-expanded="false"><span class="ico"><svg aria-hidden="true"><use href="#'+(ic||SLOTS.find(s=>s[0]===m.slot)[1])+'"/></svg></span><span><span class="meta">'+m.slot+' · '+m.min+' min</span><h3>'+esc(m.t)+'</h3></span><span class="row" style="gap:6px"><span class="kc">'+fmt(m.tot.k)+'<small>kcal</small></span><svg class="chev" aria-hidden="true"><use href="#i-chev"/></svg></span></button>'+
  '<div class="body"><div class="macline" style="margin-bottom:6px">'+[["Prot.","p"],["Gluc.","g"],["Lip.","l"]].map(([n,k])=>'<span><i style="background:'+MAC_COL[k]+'"></i>'+n+' '+fmt(m.tot[k])+' g</span>').join("")+'</div><ul class="ing">'+m.items.map(it=>'<li><span>'+esc(FOODS[it.food].n)+(it.changed?'<em>remplace '+esc(FOODS[it.from].n.toLowerCase())+(it.coach?' · choix de Melvin':'')+'</em>':'')+'</span><b>'+qty(it)+'</b></li>').join("")+'</ul><ol class="steps">'+m.steps.map(s=>'<li><span>'+esc(s[0].toUpperCase()+s.slice(1))+'</span></li>').join("")+'</ol></div></article>';}
function bindRcp(root){$$(".rcp>button",root).forEach(b=>b.onclick=()=>{const a=b.parentElement,body=$(".body",a),open=a.dataset.open!=="true";
  if(open){a.dataset.open="true";b.setAttribute("aria-expanded","true");if(!RM){const h=body.offsetHeight;body.style.overflow="hidden";body.animate([{height:"0px",opacity:0,transform:"translateY(-6px)"},{height:h+"px",opacity:1,transform:"none"}],{duration:220,easing:EO}).onfinish=()=>body.style.overflow="";}}
  else{const done=()=>{a.dataset.open="false";b.setAttribute("aria-expanded","false");body.style.overflow="";};if(RM)return done();const h=body.offsetHeight;body.style.overflow="hidden";body.animate([{height:h+"px",opacity:1},{height:"0px",opacity:0,transform:"translateY(-6px)"}],{duration:176,easing:EI}).onfinish=done;}});}
let rq="",rs="Tous";
function recettes(B){B.innerHTML='<div class="search"><svg aria-hidden="true"><use href="#i-search"/></svg><label class="sr" for="rq">Rechercher une recette</label><input class="input" id="rq" type="search" placeholder="Poulet, avoine, saumon…" value="'+esc(rq)+'"></div><div class="chips">'+["Tous",...SLOTS.map(s=>s[0])].map(s=>'<button class="chip" data-s="'+s+'" aria-pressed="'+(s===rs)+'">'+s+'</button>').join("")+'</div><div class="stack" id="rl"></div>';
  const norm=s=>s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu,"");
  const draw=()=>{const L=$("#rl",B),ms=Object.keys(MEALS).map(id=>mealPlan(id)).filter(m=>(rs==="Tous"||m.slot===rs)&&(!rq||norm(m.t+" "+m.items.map(i=>FOODS[i.food].n).join(" ")).includes(norm(rq))));
    L.innerHTML=ms.length?ms.map(m=>recipe(m)).join(""):'<div class="card"><p class="mute">Aucune recette ne correspond. Essayez un autre aliment.</p></div>';bindRcp(L);reveal(L);};
  draw();$("#rq",B).oninput=e=>{rq=e.target.value;draw();};$$("[data-s]",B).forEach(b=>b.onclick=()=>{rs=b.dataset.s;$$("[data-s]",B).forEach(x=>x.setAttribute("aria-pressed",x===b));draw();});}
function courses(B){const wk=monday(todayIso()),done=S.shop[wk]=S.shop[wk]||{},list=shopping(),total=list.reduce((a,r)=>a+r.items.length,0),cnt=()=>list.reduce((a,r)=>a+r.items.filter(i=>done[i.f]).length,0);
  B.innerHTML='<section class="card stack"><div class="row between"><div><span class="eyebrow">Semaine du '+parse(wk).toLocaleDateString("fr-FR",{day:"numeric",month:"long"})+'</span><div style="margin-top:6px"><span class="n" id="cN">'+cnt()+'</span> <span class="mute">/ '+total+' articles</span></div></div><div class="row" style="gap:8px"><button class="btn sm soft" id="cC"><svg aria-hidden="true"><use href="#i-copy"/></svg>Copier</button><button class="btn sm line" id="cR">Décocher</button></div></div><div class="prog"><i id="cP" style="transform:scaleX('+(cnt()/total)+')"></i></div></section>'+
   list.map(r=>'<section class="rayon"><h3>'+r.r+'</h3>'+r.items.map(it=>'<button class="item" data-f="'+esc(it.f)+'" aria-pressed="'+(!!done[it.f])+'"><span class="box" aria-hidden="true"><svg><use href="#i-check"/></svg></span><span class="nm">'+esc(it.name)+'</span><span class="q">'+esc(it.q)+'</span></button>').join("")+'</section>').join("");
  $$(".item",B).forEach(b=>b.onclick=()=>{const f=b.dataset.f;done[f]=!done[f];save();b.setAttribute("aria-pressed",done[f]);if(done[f])pulse($(".box",b));const n=cnt();$("#cN").textContent=n;$("#cP").style.transform="scaleX("+n/total+")";if(n===total)toast("Liste terminée, bonnes courses");});
  $("#cR").onclick=()=>{S.shop[wk]={};save();courses(B);reveal(B);};$("#cC").onclick=e=>copy("Courses MB NUTRITION\n"+list.map(r=>r.r.toUpperCase()+"\n"+r.items.map(i=>"- "+i.name+" : "+i.q).join("\n")).join("\n\n"),e.currentTarget);}

function sparkBars(vals,labels,color,goal,H=110){const W=330,n=vals.length,top=Math.max(goal||0,...vals)*1.12||1,bw=Math.min(30,(W-10)/n-6),step=(W-10)/n,x=i=>5+i*step+(step-bw)/2,y=k=>H-20-(k/top)*(H-30);
  return '<svg class="chart" viewBox="0 0 '+W+' '+H+'" role="img" aria-hidden="true">'+(goal?'<line class="tgt" x1="0" x2="'+W+'" y1="'+y(goal)+'" y2="'+y(goal)+'"/>':'')+vals.map((v,i)=>{const h=v?Math.max(3,(H-20)-y(v)):0;return '<rect x="'+x(i)+'" y="'+(H-20-((H-20)-y(top/1.12)))+'" width="'+bw+'" height="'+((H-20)-y(top/1.12))+'" rx="6" fill="var(--sunk)" opacity=".7"/>'+(h?'<rect class="bar" style="transform-origin:'+(x(i)+bw/2)+'px '+(H-20)+'px" x="'+x(i)+'" y="'+((H-20)-h)+'" width="'+bw+'" height="'+h+'" rx="6" fill="'+color+'"/>':'')+'<text x="'+(x(i)+bw/2)+'" y="'+(H-5)+'" text-anchor="middle"'+(labels[i].today?' class="today"':'')+'>'+labels[i].t+'</text>';}).join("")+'</svg>';}
function sparkLine(pts,color,H=110,fmtY=v=>v){if(pts.length<2)return '';const W=330,vals=pts.map(p=>p[1]),mn=Math.min(...vals),mx=Math.max(...vals),pad=(mx-mn)*.25||1,lo=mn-pad,hi=mx+pad,px=i=>8+i*(W-16)/(pts.length-1),py=v=>H-20-(v-lo)*(H-30)/(hi-lo),d=pts.map((p,i)=>(i?"L":"M")+px(i)+" "+py(p[1])).join(" ");
  return '<svg class="chart" viewBox="0 0 '+W+' '+H+'" role="img" aria-hidden="true"><path d="'+d+' L'+px(pts.length-1)+' '+(H-20)+' L'+px(0)+' '+(H-20)+' Z" fill="'+color+'" opacity=".08"/><path d="'+d+'" fill="none" stroke="'+color+'" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>'+pts.map((p,i)=>i===pts.length-1?'<circle cx="'+px(i)+'" cy="'+py(p[1])+'" r="4.5" fill="'+color+'" stroke="var(--card)" stroke-width="2"/>':'').join("")+'<text x="8" y="'+(H-5)+'">'+short(pts[0][0])+'</text><text x="'+(W-8)+'" y="'+(H-5)+'" text-anchor="end">'+short(pts[pts.length-1][0])+'</text></svg>';}
V.progres=v=>{const mon=monday(todayIso()),days=[0,1,2,3,4,5,6].map(i=>addDays(mon,i)),lab=days.map((d,i)=>({t:JOURS[i],today:d===todayIso()}));
  const kc=days.map(d=>eatenOf(d).k),tgt=dayPlan(0).tot.k,stp=days.map(d=>S.steps[d]||0),goal=S.profile.stepsGoal||8000,W=S.weights.slice().sort((a,b)=>a.date<b.date?-1:1),lw=W.slice(-1)[0],fw=W.find(w=>w.date>=addDays(todayIso(),-30))||W[0];
  const wks=[3,2,1,0].map(k=>{const m=addDays(mon,-7*k);return{m,n:weekTrainings(m).length,min:weekTrainings(m).reduce((a,t)=>a+t.min,0)};}),C=S.checkins,logged=days.filter((d,i)=>kc[i]>0),avg=logged.length?Math.round(logged.reduce((a,d)=>a+eatenOf(d).k,0)/logged.length):0;
  const photos=Object.entries(S.log).flatMap(([d,es])=>es.filter(e=>e.photo).map(e=>({d,e}))).sort((a,b)=>a.d<b.d?1:-1).slice(0,6);
  const card=(cls,label,val,unit,sub,chart,act)=>'<section class="card metric"><div class="head"><div><span class="eyebrow '+cls+'">'+label+'</span><div class="n" style="margin-top:6px">'+val+(unit?'<small> '+unit+'</small>':'')+'</div>'+(sub?'<span class="delta mute">'+sub+'</span>':'')+'</div>'+(act||'')+'</div>'+chart+'</section>';
  v.innerHTML=
   card("c-kcal","Calories",fmt(avg),"kcal / jour","moyenne de la semaine",sparkBars(kc,lab,"var(--kcal)",tgt))+
   card("c-weight","Poids",lw?dec(lw.kg):"–","kg",lw&&fw&&fw!==lw?((lw.kg-fw.kg<=0?"":"+")+dec(lw.kg-fw.kg)+" kg en 30 jours"):"",W.length>1?sparkLine(W.slice(-12).map(w=>[w.date,w.kg]),"var(--weight)"):'','<button class="btn sm soft" data-w>Noter</button>')+measureCard()+
   card("c-steps","Pas",fmt(stp.reduce((a,b)=>a+b,0)/Math.max(1,stp.filter(Boolean).length)),"/ jour","objectif "+fmt(goal),sparkBars(stp,lab,"var(--steps)",goal),'<button class="btn sm soft" data-s>Noter</button>')+
   (()=>{const d7=[6,5,4,3,2,1,0].map(k=>addDays(todayIso(),-k)),l7=d7.map(d=>({t:JOURS[dow(d)],today:d===todayIso()})),rp=d7.filter(d=>S.hr[d]?.resting).map(d=>[d,S.hr[d].resting]),sk=d7.filter(d=>S.sleep[d]),sa=sk.length?sk.reduce((a,d)=>a+S.sleep[d],0)/sk.length:0;
     return (rp.length?card("c-hr","Cœur au repos",rp[rp.length-1][1],"bpm","moyenne 7 jours : "+Math.round(rp.reduce((a,p)=>a+p[1],0)/rp.length)+" bpm",sparkLine(rp,"var(--hr,#FF3B6B)")):'')+
      (sk.length?card("c-sleep","Sommeil",hm(sa),"/ nuit","moyenne sur 7 jours",sparkBars(d7.map(d=>(S.sleep[d]||0)/60),l7,"var(--sleep,#5B5BD6)",8)):'');})()+
   card("c-train","Séances",wks[3].n+'<small> / '+S.profile.seances+'</small>',"",fmt(wks[3].min)+" min cette semaine",sparkBars(wks.map(w=>w.n),wks.map((w,i)=>({t:i===3?"Sem.":short(w.m),today:i===3})),"var(--train)",S.profile.seances),'<button class="btn sm soft" data-t>Noter</button>')+
   (C.length?card("","Énergie",C[C.length-1].energie+'<small> / 5</small>',"","sommeil "+C[C.length-1].sommeil+" / 5",sparkLine(C.slice(-8).map(c=>[c.date,c.energie]),"var(--ink)"),'<button class="btn sm soft" data-ci>Point</button>'):'')+
   (photos.length?'<section class="card stack"><span class="eyebrow">Photos</span><div class="gallery">'+photos.map(x=>'<figure><span class="thumb lg" data-ph="'+x.e.photo+'" role="img" aria-label="'+esc(x.e.name)+'"></span><figcaption>'+fmt(x.e.k)+' kcal · '+short(x.d)+'</figcaption></figure>').join("")+'</div></section>':'')+
   progressCard()+
   '<button class="btn block" data-ex><svg aria-hidden="true"><use href="#i-wa"/></svg>Envoyer à Melvin</button>'+(S.lastExport?'<p class="small mute" style="text-align:center">Dernier envoi : '+short(S.lastExport)+'</p>':'');
  requestAnimationFrame(()=>{if(!RM)$$(".chart .bar",v).forEach((r,i)=>r.animate([{transform:"scaleY(0)"},{transform:"none"}],{duration:600,delay:(i%7)*30,easing:EO,fill:"backwards"}));});
  $("[data-w]",v).onclick=weightSheet;$("[data-s]",v).onclick=()=>{selDate=todayIso();stepsSheet();};$("[data-t]",v).onclick=trainingSheet;$("[data-ci]",v)&&($("[data-ci]",v).onclick=checkinSheet);$("[data-ex]",v).onclick=exportSheet;bindProgress(v);};
function exportSheet(){if(S.example){toast("Faites d'abord votre bilan");go("bilan");return;}
  const code=exportCode(),wt=weekTrainings(),lw=lastWeight(),C=S.checkins.filter(c=>!c.ex).slice(-1)[0];
  const msg="Suivi MB NUTRITION – "+S.profile.prenom+" – "+parse(todayIso()).toLocaleDateString("fr-FR")+"\nSéances cette semaine : "+wt.length+" / "+S.profile.seances+(lw?"\nPoids : "+dec(lw.kg)+" kg":"")+(C?"\nDernier point : énergie "+C.energie+"/5, sommeil "+C.sommeil+"/5":"")+"\n\nCode de suivi (à importer dans l'espace coach) :\n"+code;
  S.lastExport=todayIso();save();
  sheet('<div class="stack"><span class="eyebrow">Envoyer mon suivi</span><h2>Prêt à partir</h2><p class="small mute">WhatsApp s\'ouvre avec le message écrit. Il ne reste qu\'à appuyer sur Envoyer.</p><pre class="code clip">'+esc(msg)+'</pre><a class="btn gold block" href="'+wa(msg)+'" target="_blank" rel="noopener"><svg aria-hidden="true"><use href="#i-wa"/></svg>Ouvrir WhatsApp</a><button class="btn line block" data-cp>Copier le message</button></div>',sh=>{$("[data-cp]",sh).onclick=e=>copy(msg,e.currentTarget);});}
function checkinSheet(){
  const q=(k,l,lo,hi)=>'<div class="stack" style="gap:8px"><div class="row between small"><b style="color:var(--ink)">'+l+'</b><span class="mute">'+lo+' → '+hi+'</span></div><div class="scale5" data-k="'+k+'" role="group" aria-label="'+l+'">'+[1,2,3,4,5].map(n=>'<button type="button" data-v="'+n+'" aria-pressed="'+(n===3)+'">'+n+'</button>').join("")+'</div></div>';
  sheet('<form class="stack" id="ci" novalidate><span class="eyebrow">Point hebdomadaire</span><h2>Comment s\'est passée la semaine ?</h2>'+q("energie","Énergie","Épuisé","En forme")+q("sommeil","Sommeil","Mauvais","Très bon")+q("faim","Faim dans la journée","Rarement","Souvent")+
   '<div class="stack" style="gap:8px"><b class="small" style="color:var(--ink)">Plan suivi</b><div class="chips wrap" data-k="respect">'+["Peu","Moyen","Bien","Très bien"].map((t,i)=>'<button type="button" class="chip" data-v="'+(i+1)+'" aria-pressed="'+(i===2)+'">'+t+'</button>').join("")+'</div></div>'+
   '<label class="f" for="ciN">Un mot pour Melvin<textarea class="input" id="ciN" placeholder="Ce qui a bien marché, ce qui a coincé…"></textarea></label><button class="btn gold block" type="submit">Enregistrer</button></form>',(sh,close)=>{
    $$(".scale5,[data-k=respect]",sh).forEach(g=>$$("button",g).forEach(b=>b.onclick=()=>$$("button",g).forEach(x=>x.setAttribute("aria-pressed",x===b))));
    $("#ci",sh).onsubmit=e=>{e.preventDefault();const val=k=>+($('[data-k="'+k+'"] [aria-pressed="true"]',sh)?.dataset.v||3);
      const c={date:todayIso(),energie:val("energie"),sommeil:val("sommeil"),faim:val("faim"),respect:val("respect"),note:$("#ciN",sh).value.trim()};
      S.checkins=S.checkins.filter(x=>!x.ex&&x.date!==c.date);S.checkins.push(c);save();close();rerender();
      setTimeout(()=>{if(S.example)return toast("Point enregistré");exportSheet();},260);};});}

/* Bilan en 6 étapes */
let wz=null;
V.bilan=v=>{if(!wz)wz={s:0,p:S.example?Object.assign(structuredClone(PROFILE0),{objectif:S.profile.objectif}):structuredClone(S.profile)};const p=wz.p,s=wz.s,N=6;
  const num=(id,l,val,min,max,step,unit)=>'<label class="f" for="'+id+'">'+l+'<span class="unit"><input class="input" id="'+id+'" type="number" inputmode="decimal" min="'+min+'" max="'+max+'" step="'+step+'" value="'+val+'"><span>'+unit+'</span></span></label>';
  const st=[
   ()=>'<h2>Faisons connaissance</h2><label class="f" for="bP">Votre prénom<input class="input" id="bP" autocomplete="given-name" value="'+esc(p.prenom)+'" placeholder="Prénom"></label><div class="stack" style="gap:8px"><b class="small" style="color:var(--ink)">Votre salle</b><div class="opts">'+SALLES.map(x=>'<button type="button" class="opt" data-sa="'+x+'" aria-pressed="'+(p.salle===x)+'"><span class="dot"></span><span><b>'+x+'</b></span><span></span></button>').join("")+'</div></div>',
   ()=>'<h2>Vos mensurations</h2><p class="small mute">Pour estimer vos besoins. '+(online()?"Partagées avec Melvin via votre compte.":"Ces données restent sur votre téléphone.")+'</p><div class="segs" id="bSx"><button data-x="h" aria-pressed="'+(p.sexe==="h")+'">Homme</button><button data-x="f" aria-pressed="'+(p.sexe==="f")+'">Femme</button><span class="sel" aria-hidden="true"></span></div><div class="grid3">'+num("bA","Âge",p.age,16,90,1,"ans")+num("bT","Taille",p.taille,130,220,1,"cm")+num("bW","Poids",p.poids,35,250,.1,"kg")+'</div>',
   ()=>'<h2>Votre objectif</h2><div class="opts">'+Object.entries(OBJECTIFS).map(([k,o])=>'<button type="button" class="opt" data-o="'+k+'" aria-pressed="'+(p.objectif===k)+'"><span class="dot"></span><span><b>'+o.label+'</b><span>'+OBJ_TXT[k]+'</span></span><span></span></button>').join("")+'</div>',
   ()=>'<h2>Vos entraînements</h2><div class="stack" style="gap:8px"><b class="small" style="color:var(--ink)">Sport principal</b><div class="chips wrap">'+SPORTS.map(x=>'<button type="button" class="chip" data-sp="'+x+'" aria-pressed="'+(p.sport===x)+'">'+x+'</button>').join("")+'</div></div><div class="stack" style="gap:8px"><b class="small" style="color:var(--ink)">Séances par semaine</b><div class="stepper"><button type="button" data-st="-1" aria-label="Moins">−</button><output id="bSe">'+p.seances+'</output><button type="button" data-st="1" aria-label="Plus">+</button></div></div><div class="stack" style="gap:8px"><b class="small" style="color:var(--ink)">Intensité habituelle</b><div class="segs" id="bIn">'+INT_TXT.map((t,i)=>'<button type="button" data-in="'+(i+1)+'" aria-pressed="'+(p.intensite===i+1)+'">'+t+'</button>').join("")+'<span class="sel" aria-hidden="true"></span></div></div><div class="stack" style="gap:8px"><b class="small" style="color:var(--ink)">Plutôt</b><div class="chips">'+Object.entries(MOMENT_TXT).map(([k,l])=>'<button type="button" class="chip" data-m="'+k+'" aria-pressed="'+(p.moment===k)+'">'+l[0].toUpperCase()+l.slice(1)+'</button>').join("")+'</div></div>',
   ()=>'<h2>Votre alimentation</h2><div class="opts">'+Object.entries(REG_TXT).map(([k,l])=>'<button type="button" class="opt" data-r="'+k+'" aria-pressed="'+(p.regime===k)+'"><span class="dot"></span><span><b>'+l+'</b></span><span></span></button>').join("")+'</div><div class="stack" style="gap:8px"><b class="small" style="color:var(--ink)">Allergies ou intolérances</b><div class="chips wrap">'+Object.entries(ALL_TXT).map(([k,l])=>'<button type="button" class="chip" data-a="'+k+'" aria-pressed="'+p.allergies.includes(k)+'">'+l+'</button>').join("")+'</div><p class="small mute">Allergie sévère : le plan remplace les aliments concernés, mais vérifiez toujours les étiquettes et parlez-en à votre médecin.</p></div>',
   ()=>{const t=targetKcal(p);return '<h2>Votre plan est prêt</h2><div class="target"><span class="n">'+fmt(t)+'</span><span>kcal par jour, estimation de départ</span></div><ul class="hist">'+[["Prénom",esc(p.prenom)],["Salle",esc(p.salle||"Non précisée")],["Profil",(p.sexe==="f"?"Femme":"Homme")+", "+p.age+" ans, "+p.taille+" cm, "+dec(p.poids)+" kg"],["Objectif",OBJECTIFS[p.objectif].label],["Entraînement",p.sport+", "+plural(p.seances,"séance")+" par semaine, "+INT_TXT[p.intensite-1].toLowerCase()+", "+MOMENT_TXT[p.moment]],["Alimentation",REG_TXT[p.regime]],["Allergies",p.allergies.map(a=>ALL_TXT[a]).join(", ")||"Aucune"]].map(([a,b])=>'<li><span class="mute">'+a+'</span><b>'+b+'</b></li>').join("")+'</ul><p class="small mute">Estimation par la formule de Mifflin-St Jeor. Melvin reçoit votre bilan et ajuste vos portions avec vous.</p>';}];
  v.innerHTML='<div class="stack" style="gap:6px;padding-top:4px"><span class="eyebrow">Bilan · étape '+(s+1)+' sur '+N+'</span><div class="wiz" style="grid-template-columns:repeat('+N+',minmax(0,1fr))" aria-hidden="true">'+Array.from({length:N},(_,i)=>'<i class="'+(i<=s?"on":"")+'"></i>').join("")+'</div></div><section class="card stack" id="wz">'+st[s]()+'</section><div class="row" style="gap:10px">'+(s?'<button class="btn soft" id="bB">Retour</button>':'<button class="btn soft" id="bL">Plus tard</button>')+'<button class="btn gold" style="flex:1" id="bN">'+(s<N-1?"Continuer":"Valider mon bilan")+'</button></div>';
  const w=$("#wz",v),one=(attr,key,num)=>$$("["+attr+"]",w).forEach(b=>b.onclick=()=>{p[key]=num?+b.getAttribute(attr):b.getAttribute(attr);$$("["+attr+"]",w).forEach(x=>x.setAttribute("aria-pressed",x===b));const sg=b.closest(".segs");if(sg)slide($(".sel",sg),b,sg);else pulse(b);});
  one("data-sa","salle");one("data-o","objectif");one("data-m","moment");one("data-r","regime");one("data-sp","sport");one("data-x","sexe");one("data-in","intensite",true);
  requestAnimationFrame(()=>$$(".segs",w).forEach(sg=>slide($(".sel",sg),$('[aria-pressed="true"]',sg),sg,false)));
  $$("[data-st]",w).forEach(b=>b.onclick=()=>{p.seances=Math.max(0,Math.min(14,p.seances+ +b.dataset.st));$("#bSe").textContent=p.seances;});
  $$("[data-a]",w).forEach(b=>b.onclick=()=>{const k=b.dataset.a;p.allergies=p.allergies.includes(k)?p.allergies.filter(x=>x!==k):[...p.allergies,k];b.setAttribute("aria-pressed",p.allergies.includes(k));});
  const keep=()=>{if($("#bP"))p.prenom=$("#bP").value.trim();const g=(id,mn,mx)=>{const e=$(id);if(!e)return null;const x=parseFloat(String(e.value).replace(",","."));return x>=mn&&x<=mx?x:NaN;};
    if($("#bA")){const a=g("#bA",16,90),t=g("#bT",130,220),k=g("#bW",35,250);if([a,t,k].some(Number.isNaN))return false;p.age=Math.round(a);p.taille=Math.round(t);p.poids=Math.round(k*10)/10;}return true;};
  $("#bB")&&($("#bB").onclick=()=>{keep();wz.s--;V.bilan(v);reveal(v);});$("#bL")&&($("#bL").onclick=()=>{wz=null;go(S.mode?"journal":"accueil");});
  $("#bN").onclick=()=>{if(!keep()){toast("Vérifiez l'âge (16-90), la taille (130-220 cm) et le poids (35-250 kg)");return;}if(s===0&&!p.prenom){$("#bP").focus();toast("Indiquez votre prénom");return;}
    if(s<N-1){wz.s++;V.bilan(v);reveal(v);return;}
    const wasEx=S.example;S.profile=structuredClone(p);S.example=false;S.mode=S.mode&&S.mode!=="demo"?S.mode:"client";S.shop={};
    if(wasEx){if(S.exDays){ /* ne retirer que l'exemple : ce que la personne a noté en mode découverte reste */
      for(const d in S.log){S.log[d]=S.log[d].filter(e=>!e.ex);if(!S.log[d].length)delete S.log[d];}
      S.exDays.forEach(d=>["water","steps","hr","sleep","active"].forEach(k=>delete S[k][d]));["checkins","trainings","weights","fasts","measures"].forEach(k=>S[k]=S[k].filter(x=>!x.ex));delete S.exDays;}
      else{S.log={};S.water={};S.checkins=[];S.trainings=[];S.weights=[];S.steps={};S.fasts=[];S.measures=[];S.hr={};S.sleep={};S.active={};}}S.weights=S.weights.filter(x=>x.date!==todayIso());S.weights.push({date:todayIso(),kg:p.poids});save();
    const msg="Bilan MB NUTRITION\nPrénom : "+p.prenom+"\nSalle : "+(p.salle||"non précisée")+"\nProfil : "+(p.sexe==="f"?"femme":"homme")+", "+p.age+" ans, "+p.taille+" cm, "+dec(p.poids)+" kg\nObjectif : "+OBJECTIFS[p.objectif].label+"\nEntraînement : "+p.sport+", "+plural(p.seances,"séance")+" par semaine, intensité "+INT_TXT[p.intensite-1].toLowerCase()+", "+MOMENT_TXT[p.moment]+"\nAlimentation : "+REG_TXT[p.regime].toLowerCase()+"\nAllergies : "+(p.allergies.map(a=>ALL_TXT[a].toLowerCase()).join(", ")||"aucune")+"\nBesoin estimé : "+fmt(targetKcal(p))+" kcal/jour"+(S.clientId?"\nCode client : "+S.code:"");
    wz=null;selDate=todayIso();go("journal");if(wasEx)healthPull();
    setTimeout(()=>sheet('<div class="stack"><span class="eyebrow">Bilan enregistré</span><h2>Envoyez votre bilan à Melvin</h2><p class="small mute">'+(S.clientId?"Il l'ajoutera à votre fiche.":"Il vous enverra votre code client pour valider vos portions.")+'</p><pre class="code clip">'+esc(msg)+'</pre><a class="btn gold block" href="'+wa(msg)+'" target="_blank" rel="noopener"><svg aria-hidden="true"><use href="#i-wa"/></svg>Envoyer sur WhatsApp</a><button class="btn line block" data-cp>Copier le bilan</button></div>',sh=>{$("[data-cp]",sh).onclick=e=>copy(msg,e.currentTarget);}),300);};};

V.profil=v=>{const P=S.profile,code=S.code&&parseCode(S.code);
  v.innerHTML='<section class="card stack" style="text-align:center;justify-items:center;padding:24px 18px"><span class="avatar" style="width:72px;height:72px;font-size:1.75rem">'+esc((P.prenom||"M")[0].toUpperCase())+'</span><h1 style="font-size:1.5rem">'+(S.example?"Votre espace":esc(P.prenom))+'</h1><p class="small mute">'+(S.example?"Faites votre bilan pour personnaliser l'appli":OBJECTIFS[P.objectif].label+" · "+esc(P.salle||"salle non précisée"))+'</p><a class="btn '+(S.example?"gold":"soft")+' sm" href="#bilan">'+(S.example?"Faire mon bilan":"Modifier mon bilan")+'</a></section>'+
   (S.example?'':'<section class="card stack"><div class="row between"><h2>Mon profil</h2><span class="pill">'+(planKcal()?fmt(planKcal())+' kcal/j · Melvin':fmt(targetKcal(P))+' kcal/j estimées')+'</span></div><ul class="hist">'+[["Profil",(P.sexe==="f"?"Femme":"Homme")+", "+P.age+" ans, "+P.taille+" cm"],["Entraînement",P.sport+", "+plural(P.seances,"séance")+" / sem., "+INT_TXT[P.intensite-1].toLowerCase()],["Alimentation",REG_TXT[P.regime]],["Allergies",P.allergies.map(a=>ALL_TXT[a]).join(", ")||"Aucune"]].map(([a,b])=>'<li><span class="mute">'+a+'</span><b>'+b+'</b></li>').join("")+'</ul></section>')+
   '<section class="card stack"><span class="eyebrow">Compte client</span><h2>'+(code?"Connecté avec votre code":"Vous avez reçu un code ?")+'</h2><p class="small mute">'+(code?"Portions réglées par Melvin à "+pct()+" % · objectif « "+OBJECTIFS[code.obj].label+" ».":"Code ou plan envoyé par Melvin.")+'</p>'+(code?'<span class="code">'+esc(S.code)+'</span><form class="row" id="cF" style="gap:8px"><label class="sr" for="cI">Nouveau plan de Melvin</label><input class="input" id="cI" placeholder="Coller un plan de Melvin" autocomplete="off" spellcheck="false"><button class="btn soft" type="submit">OK</button></form><button class="lnk" id="cX" style="justify-self:start">Me déconnecter de ce code</button>':'<form class="row" id="cF" style="gap:8px"><label class="sr" for="cI">Code client</label><input class="input" id="cI" placeholder="MB-FORME-115-K7Q2-X" autocomplete="off" spellcheck="false"><button class="btn gold" type="submit">Valider</button></form>')+'</section>'+
   (coachOn?'<a class="card row between" href="#coach" style="text-decoration:none"><span class="row"><span class="ico"><svg aria-hidden="true"><use href="#i-coach"/></svg></span><span><b style="color:var(--ink)">Espace coach</b><br><span class="small mute">Vos clients, leurs suivis, leurs codes</span></span></span><svg class="chev" style="transform:rotate(-90deg)" aria-hidden="true"><use href="#i-chev"/></svg></a>':'')+
   accountCard()+healthCard()+remindersCard()+themeCard()+
   '<section class="card stack"><span class="eyebrow">Contact</span><h2>Melvin BEGUE</h2><p class="small mute">Coach sportif · Master STAPS EOPS</p><div class="row" style="flex-wrap:wrap;gap:10px"><a class="btn" href="'+wa("Bonjour Melvin, ")+'" target="_blank" rel="noopener"><svg aria-hidden="true"><use href="#i-wa"/></svg>WhatsApp</a><button class="btn line" data-copy="'+TEL_TXT+'"><svg aria-hidden="true"><use href="#i-copy"/></svg>'+TEL_TXT+'</button></div></section>'+
   '<section class="card stack"><span class="eyebrow">Mes données</span><p class="small">'+(online()?"Journal, poids, séances, mensurations et points sont synchronisés avec votre compte pour Melvin. Les photos de repas restent sur ce téléphone.":"Journal, photos, poids et séances restent sur ce téléphone. Rien ne part chez Melvin sans que vous l\'envoyiez.")+'</p><div id="rz"><button class="btn line" id="rz1">Effacer mes données</button></div></section>'+legal;
  $$("[data-copy]",v).forEach(b=>b.onclick=()=>copy(b.dataset.copy,b));bindHealth(v);bindTheme(v);bindReminders(v);bindAccount(v);
  $("#cF")&&($("#cF").onsubmit=e=>{e.preventDefault();if(!applyInput($("#cI").value)){$("#cI").focus();return;}route();});
  $("#cX")&&($("#cX").onclick=()=>{S.code=null;S.clientId=null;S.plan=null;save();route();});
  $("#rz1").onclick=()=>{$("#rz").innerHTML='<div class="stack"><p class="small">Bilan, journal, photos, poids, séances et points seront effacés de ce téléphone.</p><div class="row" style="gap:8px"><button class="btn soft" id="rzN">Annuler</button><button class="btn danger" id="rzY">Tout effacer</button></div></div>';$("#rzN").focus();
    $("#rzN").onclick=()=>route();$("#rzY").onclick=async()=>{try{localStorage.removeItem(KEY);if(PH.db)(await PH.db).close();}catch(e){}PH.db=null;try{indexedDB.deleteDatabase("mbn-photos");}catch(e){}S=seedExample(structuredClone(BLANK));wz=null;applyTheme();toast("Données effacées");go("accueil");};};};

/* ───────── Espace coach : Melvin seulement (compte propriétaire), fiches dans la base de l'appli ───────── */
let db=null,clients=[],tarif=87,ready=false,openC=null;
const cidOf=c=>(c.cid||"").toUpperCase();
const codeOf=c=>makeCode(c.objectif||"forme",c.pct||OBJECTIFS[c.objectif||"forme"].pct,cidOf(c));
function newCid(){let x;do{x=Array.from({length:4},()=>B36[Math.floor(Math.random()*36)]).join("");}while(clients.some(c=>cidOf(c)===x));return x;}
V.coach=v=>{if(syncCoach)return syncCoachView(v);if(openC){const c=clients.find(x=>x.id===openC);if(c)return clientView(v,c);openC=null;}
  const act=clients.filter(c=>c.statut==="Actif"),late=c=>c.statut==="Actif"&&(!c.dernierPoint||dayDiff(todayIso(),c.dernierPoint)>7),due=act.filter(late);
  v.innerHTML='<div class="stack" style="gap:4px;padding-top:4px"><span class="eyebrow">Espace coach · visible par vous seul</span><h1 style="font-size:1.75rem">Vos clients</h1></div>'+
   '<section class="kpis"><div class="kpi"><span class="n">'+act.length+'</span><span>'+(act.length>1?"clients actifs":"client actif")+'</span></div><div class="kpi"><span class="n">'+fmt(act.length*tarif)+' €</span><span>par mois à '+tarif+' €</span></div><div class="kpi"><span class="n" style="color:'+(due.length?"var(--warn)":"var(--ok)")+'">'+due.length+'</span><span>'+(due.length>1?"suivis en retard":"suivi en retard")+'</span></div></section>'+
   '<div class="row" style="flex-wrap:wrap;gap:10px"><button class="btn gold" id="cA"><svg aria-hidden="true"><use href="#i-plus"/></svg>Nouveau client</button><button class="btn line" id="cI"><svg aria-hidden="true"><use href="#i-download"/></svg>Importer un suivi</button>'+(canImg?'<button class="btn line" id="cPh"><svg aria-hidden="true"><use href="#i-camera"/></svg>Analyser une photo</button>':'')+'<label class="row small mute" for="cT" style="gap:8px;margin-left:auto">Tarif<input class="input" id="cT" type="number" min="0" step="1" value="'+tarif+'" style="width:84px;min-height:42px"> €/mois</label></div>'+
   (!ready?'<div class="card"><p class="mute">Chargement de vos fiches…</p></div>':!clients.length?'<div class="card stack"><h2>Aucun client pour l\'instant</h2><p class="small mute">Créez une fiche avec « Nouveau client » : vous obtenez son code de connexion à lui envoyer. Quand il vous envoie son suivi par WhatsApp, collez-le avec « Importer un suivi ».</p></div>':'')+
   '<div class="clients">'+clients.slice().sort((a,b)=>(a.statut===b.statut?0:a.statut==="Actif"?-1:1)||String(a.prenom).localeCompare(b.prenom,"fr")).map(c=>{const sv=c.suivi||{},w=sv.w||[],lw=w[w.length-1],fw=w[0],wk=(sv.s||[]).filter(t=>t[0]>=monday(todayIso())).length,avg=(sv.d||[]).slice(-7);const ad=avg.length?Math.round(avg.reduce((a,x)=>a+x[1]/x[3],0)/avg.length*100):null;
     return '<button class="client" data-o="'+c.id+'"><div class="row between"><div class="row"><span class="avatar sm">'+esc((c.prenom||"?")[0].toUpperCase())+'</span><div style="text-align:left"><h3>'+esc(c.prenom)+'</h3><p class="small mute">'+esc(c.salle||"Salle non précisée")+' · '+esc(OBJECTIFS[c.objectif]?.label||"")+'</p></div></div><span class="pill '+(c.statut==="Actif"?(late(c)?"warn":"ok"):"")+'">'+esc(c.statut)+(late(c)?" · à relancer":"")+'</span></div>'+
      '<div class="mini-kpis"><span><b>'+(lw?dec(lw[1])+" kg":"–")+'</b>'+(lw&&fw&&lw!==fw?'<small>'+(lw[1]-fw[1]<=0?"":"+")+dec(lw[1]-fw[1])+' kg</small>':'<small>poids</small>')+'</span><span><b>'+(sv.s?wk:"–")+'</b><small>séances / sem.</small></span><span><b>'+(ad!=null?ad+" %":"–")+'</b><small>objectif kcal</small></span></div><p class="small mute" style="text-align:left">'+(sv.at?"Suivi reçu le "+short(sv.at):"Aucun suivi importé")+'</p></button>';}).join("")+'</div>'+
   '<p class="legal">Fiches enregistrées dans la base de cette appli, lisibles par vous seul. Vos clients gardent leurs données sur leur téléphone et vous envoient leur suivi par WhatsApp.</p>';
  $("#cA").onclick=()=>editClient(null);$("#cI").onclick=importSheet;$("#cPh")&&($("#cPh").onclick=coachPhoto);
  $("#cT").onchange=async e=>{tarif=Math.max(0,+e.target.value||0);try{await db.doc("coach/main").set({tarif});toast("Tarif enregistré");}catch(x){toast("Enregistrement impossible");}V.coach(v);};
  $$("[data-o]",v).forEach(b=>b.onclick=()=>{openC=b.dataset.o;V.coach(v);reveal(v);scrollTo({top:0});});};
function clientView(v,c){const sv=c.suivi||{},W=(sv.w||[]).map(([date,kg])=>({date,kg})),code=codeOf(c),D=sv.d||[],T=sv.s||[],C=(sv.c||[]).map(([date,energie,sommeil,faim,respect,note])=>({date,energie,sommeil,faim,respect,note}));
  const days7=D.slice(-7),ad=days7.length?Math.round(days7.reduce((a,x)=>a+x[1]/x[3],0)/days7.length*100):null,prot=days7.length?Math.round(days7.reduce((a,x)=>a+x[2],0)/days7.length):null;
  v.innerHTML='<button class="lnk" id="bk" style="justify-self:start">← Tous les clients</button><section class="card stack"><div class="row between"><div class="row"><span class="avatar">'+esc((c.prenom||"?")[0].toUpperCase())+'</span><div><h1 style="font-size:1.5rem">'+esc(c.prenom)+'</h1><p class="small mute">'+esc(c.salle||"Salle non précisée")+' · '+esc(OBJECTIFS[c.objectif]?.label||"")+' · portions '+pct(stateOf(c,planOf(c)))+' %</p></div></div><span class="pill '+(c.statut==="Actif"?"ok":"")+'">'+esc(c.statut)+'</span></div>'+
   '<div class="stack" style="gap:6px"><span class="small mute">Code de connexion à envoyer</span><div class="row" style="gap:8px;flex-wrap:wrap"><span class="code">'+code+'</span><button class="btn sm soft" data-cc><svg aria-hidden="true"><use href="#i-copy"/></svg>Copier</button><a class="btn sm" href="'+waAny(c.plan?planMsg(c):"Bonjour "+c.prenom+", voici votre code pour l'appli MB NUTRITION : "+code)+'" target="_blank" rel="noopener"><svg aria-hidden="true"><use href="#i-wa"/></svg>Envoyer</a></div></div><div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn sm line" data-ed>Modifier la fiche</button><button class="btn sm line" data-pt>Point fait aujourd\'hui</button><a class="btn sm line" href="'+waAny("Bonjour "+(c.prenom||"").split(" ")[0]+", petit point de la semaine ? Envoie-moi ton suivi depuis l'appli MB NUTRITION (Tendances, bouton WhatsApp).")+'" target="_blank" rel="noopener"><svg aria-hidden="true"><use href="#i-wa"/></svg>Relancer</a></div></section>'+planCard(c)+
   (sv.at?'<section class="kpis"><div class="kpi"><span class="n">'+(W.length?dec(W[W.length-1].kg):"–")+'</span><span>kg, dernière pesée</span></div><div class="kpi"><span class="n">'+(ad!=null?ad+"%":"–")+'</span><span>de l\'objectif kcal (7 j)</span></div><div class="kpi"><span class="n">'+(prot!=null?prot:"–")+'</span><span>g de protéines / jour</span></div></section>'+
    (W.length>1?'<section class="card stack"><h2>Poids</h2>'+sparkLine(W.slice(-12).map(w=>[w.date,w.kg]),"var(--weight)")+'</section>':'')+
    '<section class="card stack"><h2>Calories, 4 dernières semaines</h2>'+(D.length?daysChart(D):'<p class="small mute">Aucun repas noté.</p>')+'<div class="legend"><span><i style="background:var(--kcal)"></i>Mangé</span><span><i style="background:var(--sunk-2)"></i>Objectif</span></div></section>'+
    '<section class="card stack"><h2>Séances</h2>'+(T.length?'<ul class="entries">'+T.slice().reverse().slice(0,10).map(t=>'<li class="entry"><span><b>'+esc(t[1])+'</b><span class="mute">'+short(t[0])+' · '+(+t[2]||0)+' min</span></span><span class="k"><span class="int i'+(+t[3]||0)+'" aria-label="Intensité '+(INT_TXT[t[3]-1]||"–").toLowerCase()+'"><i></i><i></i><i></i></span></span><span></span></li>').join("")+'</ul>':'<p class="small mute">Aucune séance notée.</p>')+'</section>'+
    '<section class="card stack"><h2>Points hebdomadaires</h2>'+(C.length?sparkLine(C.slice(-8).map(x=>[x.date,x.energie]),"var(--ink)")+'<ul class="hist">'+C.slice().reverse().map(x=>'<li><span><b>'+short(x.date)+'</b></span><span class="mute">plan : '+(["peu","moyen","bien","très bien"][x.respect-1]||"–")+'</span><span class="mute" style="grid-column:1/-1">Énergie '+(+x.energie||"–")+'/5 · Sommeil '+(+x.sommeil||"–")+'/5 · Faim '+(+x.faim||"–")+'/5'+(x.note?'<br>« '+esc(x.note)+' »':'')+'</span></li>').join("")+'</ul>':'<p class="small mute">Aucun point reçu.</p>')+'</section>'+
    '<p class="small mute">Suivi importé le '+short(sv.at)+' · besoin estimé côté client : '+fmt(sv.t||0)+' kcal/j.</p>':'<section class="card stack"><h2>Pas encore de suivi</h2><p class="small mute">Envoyez le code à '+esc(c.prenom)+'. Quand il vous envoie son suivi par WhatsApp, utilisez « Importer un suivi ».</p><button class="btn gold" id="imp">Importer un suivi</button></section>')+
   (c.notes?'<section class="card stack"><h2>Notes</h2><p class="small" style="white-space:pre-wrap">'+esc(c.notes)+'</p></section>':'');
  $("#bk",v).onclick=()=>{openC=null;V.coach(v);reveal(v);};$("[data-cc]",v).onclick=e=>copy(code,e.currentTarget);$("[data-ed]",v).onclick=()=>editClient(c);$("#imp",v)&&($("#imp",v).onclick=importSheet);$("[data-pl]",v).onclick=()=>planSheet(c);$("[data-pc]",v).onclick=e=>copy(planMsg(c),e.currentTarget);
  $("[data-pt]",v).onclick=async e=>{try{await db.doc("coach/main/clients/"+c.id).update({dernierPoint:todayIso()});pulse(e.currentTarget);toast("Point noté");}catch(x){toast("Enregistrement impossible");}};}
function daysChart(D){const pts=D.slice(-28),W=330,H=150,top=Math.max(...pts.map(x=>Math.max(x[1],x[3])))*1.1,bw=Math.max(4,(W-30)/pts.length-3),x=i=>28+i*((W-30)/pts.length),y=k=>H-22-(k/top)*(H-34);
  return '<svg class="chart" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Calories notées par jour">'+[.5,1].map(f=>{const k=Math.round(top*f/100)*100;return '<line class="grid" x1="28" x2="'+W+'" y1="'+y(k)+'" y2="'+y(k)+'"/><text x="0" y="'+(y(k)+3)+'">'+dec(k/1000)+'k</text>';}).join("")+
   pts.map((d,i)=>'<rect x="'+x(i)+'" y="'+y(d[3])+'" width="'+bw+'" height="'+(H-22-y(d[3]))+'" rx="3" fill="var(--sunk)"/><rect class="bar" style="transform-origin:0 '+(H-22)+'px" x="'+x(i)+'" y="'+y(d[1])+'" width="'+bw+'" height="'+(H-22-y(d[1]))+'" rx="3" fill="var(--kcal)"/>').join("")+'<text x="28" y="'+(H-4)+'">'+short(pts[0][0])+'</text><text x="'+W+'" y="'+(H-4)+'" text-anchor="end">'+short(pts[pts.length-1][0])+'</text></svg>';}
function importSheet(){sheet('<div class="stack"><span class="eyebrow">Importer un suivi</span><h2>Collez le message du client</h2><p class="small mute">Copiez le message WhatsApp reçu (il contient un code qui commence par MBN1) et collez-le ici.</p><label class="sr" for="iT">Message du client</label><textarea class="input" id="iT" rows="6" placeholder="Suivi MB NUTRITION – …"></textarea><div id="iR"></div><button class="btn gold block" id="iG">Importer</button></div>',(sh,close)=>{
  $("#iG",sh).onclick=async()=>{const o=readExport($("#iT",sh).value);if(!o){$("#iR",sh).innerHTML='<p class="small" style="color:var(--bad)">Code de suivi introuvable dans ce texte. Collez le message complet.</p>';return;}
    let c=o.id&&clients.find(x=>cidOf(x)===String(o.id).toUpperCase());
    const data={suivi:{at:o.at,t:o.t,pc:o.pc,w:o.w||[],s:o.s||[],c:o.c||[],d:o.d||[],q:Array.isArray(o.q)?o.q:[]},maj:new Date().toISOString()};if(o.r)data.regime=o.r;if(Array.isArray(o.a))data.allergies=o.a;
    if(o.c&&o.c.length)data.dernierPoint=o.c[o.c.length-1][0];
    try{if(c){await db.doc("coach/main/clients/"+c.id).update(data);}else{const id="c"+Date.now().toString(36);await db.doc("coach/main/clients/"+id).set(Object.assign({prenom:o.n||"Client",salle:"",objectif:"forme",pct:115,statut:"Actif",debut:todayIso(),notes:"",cid:newCid(),dernierPoint:data.dernierPoint||""},data));c={id};}
      close();toast("Suivi de "+(o.n||"votre client")+" importé");openC=c.id;setTimeout(()=>{V.coach($("#view"));reveal($("#view"));},120);}catch(x){toast("Import impossible, réessayez");}};});}
function coachPhoto(){let blob=null;sheet('<div class="stack"><span class="eyebrow">Analyse de repas</span><h2>Photo envoyée par un client</h2><label class="drop" for="cf"><span class="drop-in" id="cv"><svg aria-hidden="true"><use href="#i-camera"/></svg><b>Choisir la photo</b></span><input id="cf" type="file" accept="image/*" class="sr"></label><div id="co" class="stack"></div></div>',sh=>{
  $("#cf",sh).onchange=async e=>{const f=e.target.files[0];if(!f)return;try{blob=await compress(f,1100,.8);}catch(x){toast("Photo illisible");return;}$("#cv",sh).innerHTML='<span class="preview" style="background-image:url('+URL.createObjectURL(blob)+')"></span>';
    $("#co",sh).innerHTML='<p class="mute small"><span class="spin" aria-hidden="true"></span> Analyse en cours…</p>';
    try{const r=await sample.json("Tu aides un coach sportif. Analyse ce repas (portion visible entière). Réponds uniquement en JSON : {\"nom\":\"…\",\"kcal\":n,\"p\":n,\"g\":n,\"l\":n,\"aliments\":[\"aliment – quantité estimée – kcal\"],\"remarques\":\"1 à 2 phrases factuelles pour le coach : équilibre, protéines, légumes\",\"confiance\":\"faible|moyenne|bonne\"}",{images:[blob],modelTier:"default"});
      $("#co",sh).innerHTML='<div class="card" style="box-shadow:inset 0 0 0 1.5px var(--line)"><h3>'+esc(r.nom||"Repas")+'</h3><div class="macline" style="margin:8px 0"><span><b>'+fmt(r.kcal||0)+' kcal</b></span><span><i style="background:var(--prot)"></i>Prot. '+fmt(r.p||0)+' g</span><span><i style="background:var(--carb)"></i>Gluc. '+fmt(r.g||0)+' g</span><span><i style="background:var(--fat)"></i>Lip. '+fmt(r.l||0)+' g</span></div><ul class="ing">'+(r.aliments||[]).map(a=>'<li><span>'+esc(a)+'</span></li>').join("")+'</ul><p class="small">'+esc(r.remarques||"")+'</p><p class="small mute">Estimation de l\'IA, confiance '+esc(r.confiance||"moyenne")+'. À vérifier.</p></div>';}
    catch(x){$("#co",sh).innerHTML='<p class="small" style="color:var(--bad)">'+(x.code==="not_granted"?"Analyse refusée.":"L'analyse n'a pas abouti. Réessayez dans un instant.")+'</p>';}};});}
/* ───────── Plan du client, réglé par Melvin : calories, remplacements, ajouts aux courses, mot ───────── */
const planOf=c=>Object.assign({kcal:0,swap:{},extra:[],note:""},structuredClone(c.plan||{}));
const stateOf=(c,plan)=>({profile:Object.assign(structuredClone(PROFILE0),{objectif:c.objectif||"forme",regime:c.regime||"omni",allergies:c.allergies||[]}),example:false,code:codeOf(c),plan});
function weekAvg(s){let t=0;for(let d=0;d<7;d++)t+=dayPlan(d,s).tot.k;return t/7;}
function planCode(c,p){return "MBP1:"+b64({v:1,id:cidOf(c),c:codeOf(c),at:todayIso(),k:+p.kcal||0,sw:p.swap||{},x:(p.extra||[]).filter(x=>x[0]),n:p.note||""});}
function planMsg(c){return "Bonjour "+(c.prenom||"").split(" ")[0]+", voici votre plan MB NUTRITION. Copiez tout ce message et collez-le dans l'appli (champ Code, ou Moi).\n\n"+planCode(c,planOf(c));}
function planCard(c){const q=(c.suivi&&Array.isArray(c.suivi.q)&&c.suivi.q)||[],qy=q.filter(x=>x&&x[1]).length,p=planOf(c),s=stateOf(c,p),k=Math.round(weekAvg(s)/10)*10,ns=Object.keys(p.swap).length,nx=p.extra.length;
  return '<section class="card stack"><div class="row between"><h2>Plan</h2><span class="pill">'+fmt(k)+' kcal/j</span></div>'+
   '<ul class="hist">'+(q.length?'<li><span class="mute">Courses faites</span><b>'+qy+' / '+q.length+'</b></li>':'')+'<li><span class="mute">Calories</span><b>'+(planKcal(s)?fmt(planKcal(s))+' kcal · fixé':'Auto · '+pct(s)+' %')+'</b></li><li><span class="mute">Remplacements</span><b>'+(ns||"–")+'</b></li><li><span class="mute">Ajouts courses</span><b>'+(nx||"–")+'</b></li>'+(p.note?'<li><span class="mute">Mot</span><b>'+esc(p.note.length>28?p.note.slice(0,27)+"…":p.note)+'</b></li>':'')+'</ul>'+
   '<div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn sm line" data-pl>Modifier le plan</button><a class="btn sm" href="'+waAny(planMsg(c))+'" target="_blank" rel="noopener"><svg aria-hidden="true"><use href="#i-wa"/></svg>Envoyer</a><button class="btn sm soft" data-pc><svg aria-hidden="true"><use href="#i-copy"/></svg>Copier</button></div></section>';}
function planSheet(c){const p=planOf(c),FK=Object.keys(FOODS).sort((x,y)=>FOODS[x].n.localeCompare(FOODS[y].n,"fr"));let showList=false;
  const opts=sel=>FK.map(k=>'<option value="'+k+'"'+(k===sel?" selected":"")+'>'+esc(FOODS[k].n)+'</option>').join("");
  sheet('<div class="stack"><span class="eyebrow">Plan · '+esc(c.prenom)+'</span><h2>Régler le plan</h2>'+
   '<div class="f"><span>Calories par jour</span><div class="row" style="gap:8px"><button type="button" class="btn soft" data-k="-50" aria-label="Moins 50 kcal">−</button><label class="sr" for="pK">Calories par jour</label><input class="input" id="pK" type="number" inputmode="numeric" min="1000" max="6000" step="50" placeholder="Auto" value="'+(p.kcal||"")+'" style="text-align:center"><button type="button" class="btn soft" data-k="50" aria-label="Plus 50 kcal">+</button></div></div>'+
   '<div class="target" id="pPrev"></div>'+
   '<div class="f"><span>Remplacer un aliment</span><div id="pSw" class="stack" style="gap:6px"></div><div class="grid2"><label class="sr" for="pA">Aliment</label><select class="input" id="pA">'+opts("poulet")+'</select><label class="sr" for="pB2">Remplacé par</label><select class="input" id="pB2">'+opts("dinde")+'</select></div><button type="button" class="btn sm soft" id="pSA">Remplacer</button></div>'+
   '<div class="f"><span>Ajouter aux courses</span><div id="pX" class="stack" style="gap:6px"></div><div class="grid2"><label class="sr" for="pXn">Article</label><input class="input" id="pXn" placeholder="Article" maxlength="40"><label class="sr" for="pXq">Quantité</label><input class="input" id="pXq" placeholder="Quantité" maxlength="20"></div><button type="button" class="btn sm soft" id="pXA">Ajouter</button></div>'+
   '<label class="f" for="pN">Mot pour '+esc((c.prenom||"").split(" ")[0])+'<textarea class="input" id="pN" rows="2" maxlength="140" placeholder="Optionnel">'+esc(p.note)+'</textarea></label>'+
   '<button type="button" class="lnk" id="pL" style="justify-self:start">Voir la liste de courses</button><div id="pLs" class="stack"></div>'+
   '<button class="btn gold block" id="pS">Enregistrer</button></div>',(sh,close)=>{
    const draw=()=>{const k=+$("#pK",sh).value;p.kcal=k>=1000&&k<=6000?k:0;const s=stateOf(c,p),avg=Math.round(weekAvg(s)/10)*10;
      $("#pPrev",sh).innerHTML='<span class="n">'+fmt(avg)+'</span><span>kcal/j en moyenne · portions '+pct(s)+' %</span>';
      $("#pSw",sh).innerHTML=Object.entries(p.swap).map(([f,t])=>'<div class="row between chiprow"><span class="small">'+esc(FOODS[f]?.n||f)+' → <b>'+esc(FOODS[t]?.n||t)+'</b></span><button type="button" class="lnk" data-rs="'+esc(f)+'" aria-label="Retirer">Retirer</button></div>').join("");
      $("#pX",sh).innerHTML=p.extra.map((x,i)=>'<div class="row between chiprow"><span class="small"><b>'+esc(x[0])+'</b>'+(x[1]?' · '+esc(x[1]):'')+'</span><button type="button" class="lnk" data-rx="'+i+'" aria-label="Retirer">Retirer</button></div>').join("");
      $$("[data-rs]",sh).forEach(b=>b.onclick=()=>{delete p.swap[b.dataset.rs];draw();});$$("[data-rx]",sh).forEach(b=>b.onclick=()=>{p.extra.splice(+b.dataset.rx,1);draw();});
      if(showList){const L=shopping(s);$("#pLs",sh).innerHTML=L.map(r=>'<section class="rayon"><h3>'+r.r+'</h3>'+r.items.map(it=>'<div class="item" style="grid-template-columns:minmax(0,1fr) auto"><span class="nm">'+esc(it.name)+'</span><span class="q">'+esc(it.q)+'</span></div>').join("")+'</section>').join("");}else $("#pLs",sh).innerHTML="";};
    $("#pK",sh).oninput=draw;$$("[data-k]",sh).forEach(b=>b.onclick=()=>{const cur0=+$("#pK",sh).value||Math.round(weekAvg(stateOf(c,p))/50)*50;$("#pK",sh).value=Math.max(1000,Math.min(6000,cur0+ +b.dataset.k));draw();});
    $("#pSA",sh).onclick=e=>{const f=$("#pA",sh).value,t=$("#pB2",sh).value;if(f===t){toast("Choisissez deux aliments différents");return;}p.swap[f]=t;Object.keys(p.swap).forEach(k=>{if(p.swap[k]===f&&k!==f)p.swap[k]=t;});pulse(e.currentTarget);draw();};
    $("#pXA",sh).onclick=e=>{const n=$("#pXn",sh).value.trim();if(!n){$("#pXn",sh).focus();return;}p.extra.push([n,$("#pXq",sh).value.trim()]);$("#pXn",sh).value="";$("#pXq",sh).value="";pulse(e.currentTarget);draw();$("#pXn",sh).focus();};
    $("#pL",sh).onclick=e=>{showList=!showList;e.currentTarget.textContent=showList?"Masquer la liste":"Voir la liste de courses";draw();};
    $("#pS",sh).onclick=async()=>{p.note=$("#pN",sh).value.trim();try{if(syncCoach){p.at=todayIso();if(!await MBSync.coach.update(c.id,{plan:p}))throw new Error("sync");}else await db.doc("coach/main/clients/"+c.id).update({plan:p,maj:new Date().toISOString()});c.plan=p;toast(syncCoach?"Plan enregistré · envoyé dans l'appli":"Plan enregistré · pensez à l'envoyer");close();setTimeout(()=>{if(cur()==="coach")V.coach($("#view"));},260);}catch(x){toast("Enregistrement impossible, réessayez");}};
    draw();});}
function editClient(c){const isNew=!c;c=c||{prenom:"",salle:"",objectif:"forme",pct:115,statut:"Actif",debut:todayIso(),dernierPoint:"",notes:"",cid:newCid()};if(!c.cid)c.cid=newCid();
  sheet('<form class="stack" id="ef"><span class="eyebrow">'+(isNew?"Nouveau client":"Fiche client")+'</span><h2>'+(isNew?"Ajouter un client":esc(c.prenom))+'</h2><label class="f" for="eP">Prénom et nom<input class="input" id="eP" value="'+esc(c.prenom)+'"></label>'+
   '<label class="f" for="eS">Salle<select class="input" id="eS"><option value="">Non précisée</option>'+SALLES.map(s=>'<option'+(s===c.salle?" selected":"")+'>'+s+'</option>').join("")+'</select></label>'+
   '<div class="grid2"><label class="f" for="eO">Objectif<select class="input" id="eO">'+Object.entries(OBJECTIFS).map(([k,o])=>'<option value="'+k+'"'+(k===c.objectif?" selected":"")+'>'+o.label+'</option>').join("")+'</select></label><label class="f" for="ePc">Portions (70-170 %)<input class="input" id="ePc" type="number" min="70" max="170" step="5" value="'+(c.pct||115)+'"></label></div>'+
   '<label class="f" for="eR">Alimentation<select class="input" id="eR">'+Object.entries(REG_TXT).map(([k,t])=>'<option value="'+k+'"'+(k===(c.regime||"omni")?" selected":"")+'>'+t+'</option>').join("")+'</select></label><div class="f"><span>Allergies</span><div class="chips wrap">'+Object.entries(ALL_TXT).map(([k,t])=>'<button type="button" class="chip" data-al="'+k+'" aria-pressed="'+(c.allergies||[]).includes(k)+'">'+t+'</button>').join("")+'</div></div>'+
   '<div class="grid2"><label class="f" for="eD">Début<input class="input" id="eD" type="date" value="'+esc(c.debut||"")+'"></label><label class="f" for="eSt">Statut<select class="input" id="eSt">'+["Actif","En pause","Terminé"].map(s=>'<option'+(s===c.statut?" selected":"")+'>'+s+'</option>').join("")+'</select></label></div>'+
   '<label class="f" for="eN">Notes<textarea class="input" id="eN" placeholder="Dernier point, ajustements…">'+esc(c.notes||"")+'</textarea></label><p class="small mute">Code de connexion : <span class="code" id="eC">'+codeOf(c)+'</span></p><button class="btn gold block" type="submit">Enregistrer</button>'+(isNew?'':'<div id="eDel"><button type="button" class="btn line block" id="eD1">Supprimer la fiche</button></div>')+'</form>',(sh,close)=>{
    const pc=()=>Math.max(70,Math.min(170,Math.round((+$("#ePc",sh).value||115)/5)*5)),upd=()=>$("#eC",sh).textContent=codeOf({objectif:$("#eO",sh).value,pct:pc(),cid:c.cid});
    $$("[data-al]",sh).forEach(b=>b.onclick=()=>b.setAttribute("aria-pressed",b.getAttribute("aria-pressed")!=="true"));
    $("#eO",sh).onchange=()=>{$("#ePc",sh).value=OBJECTIFS[$("#eO",sh).value].pct;upd();};$("#ePc",sh).oninput=upd;
    $("#ef",sh).onsubmit=async e=>{e.preventDefault();const prenom=$("#eP",sh).value.trim();if(!prenom){$("#eP",sh).focus();toast("Indiquez le prénom");return;}
      const data={prenom,salle:$("#eS",sh).value,objectif:$("#eO",sh).value,pct:pc(),debut:$("#eD",sh).value,statut:$("#eSt",sh).value,notes:$("#eN",sh).value.trim(),regime:$("#eR",sh).value,allergies:$$("[data-al]",sh).filter(b=>b.getAttribute("aria-pressed")==="true").map(b=>b.dataset.al),cid:c.cid,maj:new Date().toISOString()};
      try{if(isNew)await db.doc("coach/main/clients/c"+Date.now().toString(36)).set(Object.assign({dernierPoint:""},data));else await db.doc("coach/main/clients/"+c.id).update(data);toast(isNew?"Client ajouté":"Fiche enregistrée");close();setTimeout(()=>{if(cur()==="coach")V.coach($("#view"));},260);}catch(x){toast("Enregistrement impossible, réessayez");}};
    $("#eD1",sh)&&($("#eD1",sh).onclick=()=>{$("#eDel",sh).innerHTML='<p class="small">La fiche et le suivi importé seront supprimés.</p><div class="row" style="gap:8px"><button type="button" class="btn soft" id="eDn" style="flex:1">Garder</button><button type="button" class="btn danger" id="eDy" style="flex:1">Supprimer</button></div>';$("#eDn",sh).focus();
      $("#eDn",sh).onclick=()=>{$("#eDel",sh).innerHTML='';};$("#eDy",sh).onclick=async()=>{try{await db.doc("coach/main/clients/"+c.id).delete();openC=null;toast("Fiche supprimée");close();}catch(x){toast("Suppression impossible");}};});});}
async function initCaps(){if(!window.claude?.use)return;claude.use("downloads").then(d=>{dl=d;}).catch(()=>{});
  claude.use("sample").then(async s=>{if(!s)return;sample=s;try{canImg=!!(await s.limits?.())?.images;}catch(e){canImg=false;}if(cur()==="coach"&&!$(".sheet"))V.coach($("#view"));}).catch(()=>{});
  let user=null;try{user=await claude.use("user");}catch(e){}if(!user||!(await user.isOwner?.()))return;try{db=await claude.use("db");}catch(e){}if(!db)return;
  coachOn=true;if(["accueil","profil","coach"].includes(cur())||location.hash==="#coach")route();
  const t=setTimeout(()=>{ready=true;if(cur()==="coach")V.coach($("#view"));},10000);
  try{const s=await db.doc("coach/main").get();if(s.exists&&s.data().tarif!=null)tarif=+s.data().tarif;}catch(e){}
  db.collection("coach/main/clients").onSnapshot(snap=>{clearTimeout(t);ready=true;clients=snap.docs.map(d=>({id:d.id,...d.data()}));if(cur()==="coach"&&!$(".sheet"))V.coach($("#view"));},()=>{clearTimeout(t);ready=true;if(cur()==="coach")V.coach($("#view"));});}

/* ───────── Santé : Apple Santé / Health Connect via health.js (absent dans le navigateur) ───────── */
let hOK=false; /* available() est asynchrone : résultat mis en cache au démarrage */
const H=()=>hOK?window.MBHealth:null;
const hm=m=>Math.floor(m/60)+" h "+String(Math.round(m%60)).padStart(2,"0");
let hBusy=false;
async function healthPull(){const h=H();if(!h||!S.health.on||hBusy)return;hBusy=true;
  try{const t=todayIso(),hs=S.health.steps||(S.health.steps={});
    const takeSteps=(d,n)=>{n=Math.round(+n||0);if(n>0&&n>=(S.steps[d]||0)){S.steps[d]=n;hs[d]=n;}}; /* ne jamais écraser un total manuel plus grand */
    const r=await h.range(addDays(t,-6),t)||{};
    for(const[d,x]of Object.entries(r)){if(!x||!/^\d{4}-\d\d-\d\d$/.test(d))continue;takeSteps(d,x.steps);
      if(x.sleepMin>0)S.sleep[d]=Math.round(x.sleepMin);if(x.activeKcal>0)S.active[d]=Math.round(x.activeKcal);
      if(x.hrResting>0)S.hr[d]=Object.assign({},S.hr[d],{resting:Math.round(x.hrResting)});}
    const dy=await h.day(t);
    if(dy){takeSteps(t,dy.steps);if(dy.sleepMin>0)S.sleep[t]=Math.round(dy.sleepMin);if(dy.activeKcal>0)S.active[t]=Math.round(dy.activeKcal);
      const r0=n=>n>0?Math.round(n):null;
      if(dy.hrAvg||dy.hrResting)S.hr[t]={avg:r0(dy.hrAvg),min:r0(dy.hrMin),max:r0(dy.hrMax),resting:r0(dy.hrResting),hrv:r0(dy.hrv),pts:Array.isArray(dy.hr)?dy.hr.filter(p=>Array.isArray(p)&&p[1]>0).slice(0,96):[]};}
    const w=await h.latestWeight(),lw=lastWeight(),wd=w&&String(w.date||"").slice(0,10);
    if(w&&w.kg>=30&&w.kg<=250&&wd&&(!lw||lw.ex||wd>lw.date)){S.weights=S.weights.filter(x=>!x.ex&&x.date!==wd);S.weights.push({date:wd,kg:Math.round(w.kg*10)/10,src:"health"});}
    S.health.at=new Date().toISOString();save();
    if(!$(".sheet")&&["journal","progres","profil"].includes(cur()))rerender();
  }catch(e){}finally{hBusy=false;}}
function hrCurve(pts){if(!pts||pts.length<2)return '';const W=330,Ht=120,v=pts.map(p=>p[1]),lo=Math.min(...v)-5,hi=Math.max(...v)+5,px=m=>8+m*(W-16)/1440,py=b=>Ht-20-(b-lo)*(Ht-30)/(hi-lo),
  d=pts.map((p,i)=>(i?"L":"M")+px(p[0]).toFixed(1)+" "+py(p[1]).toFixed(1)).join(" "),c="var(--hr,#FF3B6B)",l=pts[pts.length-1];
  return '<svg class="chart" viewBox="0 0 '+W+' '+Ht+'" role="img" aria-label="Fréquence cardiaque au fil de la journée"><path d="'+d+'" fill="none" stroke="'+c+'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="'+px(l[0])+'" cy="'+py(l[1])+'" r="4" fill="'+c+'" stroke="var(--card)" stroke-width="2"/>'+
   [0,6,12,18,24].map(h=>'<text x="'+px(h*60)+'" y="'+(Ht-5)+'" text-anchor="'+(h===0?"start":h===24?"end":"middle")+'">'+h+' h</text>').join("")+'</svg>';}
function hrSheet(){const x=S.hr[selDate]||{};
  sheet('<div class="stack"><span class="eyebrow c-hr">Cœur · '+short(selDate)+'</span><h2>'+(x.resting?x.resting+' bpm au repos':'Fréquence cardiaque')+'</h2>'+(hrCurve(x.pts)||'<p class="small mute">Pas de courbe détaillée pour ce jour.</p>')+
   '<section class="kpis">'+[["min","Minimum"],["avg","Moyenne"],["max","Maximum"]].map(([k,l])=>'<div class="kpi"><span class="n">'+(x[k]?fmt(x[k]):"–")+'</span><span>'+l+' · bpm</span></div>').join("")+'</section>'+
   '<ul class="hist"><li><span class="mute">Au repos</span><b>'+(x.resting?x.resting+' bpm':'–')+'</b></li><li><span class="mute">Variabilité (VFC)</span><b>'+(x.hrv?x.hrv+' ms':'–')+'</b></li>'+(S.active[selDate]?'<li><span class="mute">Énergie active</span><b>'+fmt(S.active[selDate])+' kcal</b></li>':'')+'</ul>'+
   '<p class="small mute">'+(S.health.on?"Données de l'app Santé":"Données d'exemple")+', à titre indicatif. Ce n\'est pas un suivi médical.</p></div>');}
function sleepSheet(){const days=[6,5,4,3,2,1,0].map(k=>addDays(selDate,-k)),m=S.sleep[selDate]||0,kn=days.filter(d=>S.sleep[d]),avg=kn.length?kn.reduce((a,d)=>a+S.sleep[d],0)/kn.length:0;
  sheet('<div class="stack"><span class="eyebrow c-sleep">Sommeil · nuit du '+short(addDays(selDate,-1))+'</span><h2>'+(m?hm(m):"Pas de donnée")+'</h2>'+sparkBars(days.map(d=>(S.sleep[d]||0)/60),days.map(d=>({t:JOURS[dow(d)],today:d===selDate})),"var(--sleep,#5B5BD6)",8)+
   '<p class="small mute">Moyenne sur 7 jours : '+(avg?hm(avg):"–")+'. Visez 7 à 9 heures : la récupération en dépend.</p></div>');}
function healthCard(){const h=H();
  return '<section class="card stack"><div class="row between"><span class="eyebrow c-hr">Apple Santé · Health Connect</span>'+(S.health.on&&h?'<span class="pill ok"><i></i>Connecté</span>':'')+'</div>'+
   (!h?'<h2>Pas, cœur, sommeil et poids</h2><p class="small mute">Dans l\'appli MB NUTRITION sur iPhone ou Android, vos données Santé s\'ajoutent toutes seules. Ici, notez-les à la main ou importez vos pas avec un raccourci iPhone.</p><button class="btn sm soft" id="hR" style="justify-self:start"><svg aria-hidden="true"><use href="#i-heart"/></svg>Relier l\'app Santé</button>':
    S.health.on?'<p class="small mute">'+(S.health.at?"Dernière synchronisation : "+new Date(S.health.at).toLocaleString("fr-FR",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}):"Synchronisation…")+'. Lecture seule : rien n\'est modifié dans Santé.</p><div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn sm soft" id="hS">Synchroniser</button><button class="btn sm line" id="hX">Déconnecter</button></div>':
    '<h2>Connecter Santé</h2><p class="small mute">Pas, fréquence cardiaque, sommeil, énergie active et poids s\'ajoutent tout seuls. Lecture seule.</p><button class="btn gold block" id="hC"><svg aria-hidden="true"><use href="#i-heart"/></svg>Connecter Santé</button>')+'</section>';}
function bindHealth(v){$("#hR",v)&&($("#hR",v).onclick=healthSheet);
  $("#hC",v)&&($("#hC",v).onclick=async e=>{const b=e.currentTarget;b.disabled=true;const ok=await H()?.request?.();if(!ok){b.disabled=false;toast("Autorisation refusée : activez-la dans les réglages Santé");return;}
    S.health={on:true,steps:{}};save();toast("Santé connectée");await healthPull();rerender();});
  $("#hS",v)&&($("#hS",v).onclick=async e=>{pulse(e.currentTarget);await healthPull();toast("Synchronisé");});
  $("#hX",v)&&($("#hX",v).onclick=()=>{S.health={on:false};save();rerender();toast("Santé déconnectée · données importées conservées");});}
function onResume(){healthPull();if(syncOn()&&!acct)MBSync.session().then(s=>{if(s&&!acct){acct=s;onLogin(false);}});if(online()){pullPlan();checkUnread();if(syncCoach)loadSyncClients();}}
/* Apparence : auto = réglage du téléphone */
function applyTheme(){const t=S.theme;if(t==="light"||t==="dark")document.documentElement.dataset.theme=t;else delete document.documentElement.dataset.theme;}
const themeCard=()=>'<section class="card stack"><span class="eyebrow">Apparence</span><div class="segs" id="thS" role="group" aria-label="Thème">'+[["auto","Automatique"],["light","Clair"],["dark","Sombre"]].map(([k,l])=>'<button data-th="'+k+'" aria-pressed="'+((S.theme||"auto")===k)+'">'+l+'</button>').join("")+'<span class="sel" aria-hidden="true"></span></div></section>';
function bindTheme(v){const sg=$("#thS",v);if(!sg)return;requestAnimationFrame(()=>slide($(".sel",sg),$('[aria-pressed="true"]',sg),sg,false));
  $$("[data-th]",sg).forEach(b=>b.onclick=()=>{S.theme=b.dataset.th;save();applyTheme();$$("[data-th]",sg).forEach(x=>x.setAttribute("aria-pressed",x===b));slide($(".sel",sg),b,sg);});}

/* ───────── Jeûne intermittent : S.fasts=[{start,end,goalH}], celui sans end est en cours ───────── */
const FAST_P=[14,16,18],fastLbl=h=>h+":"+(24-h),fastNow=()=>S.fasts.find(f=>!f.end);
const dur=ms=>{const m=Math.max(0,Math.floor(ms/6e4));return Math.floor(m/60)+" h "+String(m%60).padStart(2,"0");};
const hhmm=ms=>new Date(ms).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"});
function fastRing(f,lg){const el=f?Date.now()-f.start:0,goal=f?f.goalH*36e5:1,R=lg?84:26,w=lg?14:7;
  return '<span class="fring'+(lg?" big":"")+'"'+(lg?' role="img" aria-label="'+(f?"Écoulé "+dur(el)+" sur "+f.goalH+" heures":"Aucun jeûne en cours")+'"':' aria-hidden="true"')+'><svg viewBox="0 0 '+(2*R+w)+' '+(2*R+w)+'" aria-hidden="true">'+ring(R,el/goal,"v",w)+'</svg><span class="c">'+
   (lg?'<span class="n">'+(f?dur(el):"0 h 00")+'</span><small>'+(f?(el>=goal?"objectif atteint":"reste "+dur(goal-el)):"objectif "+(S.fasts.slice(-1)[0]?.goalH||16)+" h")+'</small>':(f?Math.min(100,Math.floor(el/goal*100))+" %":""))+'</span></span>';}
function fastTileIn(){const f=fastNow(),last=S.fasts.filter(x=>x.end).slice(-1)[0];
  return fastRing(f)+'<span><span class="tl c-fast">'+(f?"Jeûne "+fastLbl(f.goalH):"Jeûne intermittent")+'<svg aria-hidden="true"><use href="#i-timer"/></svg></span>'+
   (f?'<span class="n">'+dur(Date.now()-f.start)+'<small> / '+f.goalH+' h</small></span><span class="sub">fin prévue à '+hhmm(f.start+f.goalH*36e5)+'</span>':
    '<span class="n" style="font-size:1.25rem">Démarrer</span><span class="sub">'+(last?"Dernier : "+dur(last.end-last.start)+(last.end-last.start>=last.goalH*36e5?" · objectif atteint":""):"14:10, 16:8 ou 18:6")+'</span>')+'</span>';}
function fastSheet(){let goal=S.fasts.slice(-1)[0]?.goalH||16;
  sheet('<div class="stack"><span class="eyebrow c-fast">Jeûne intermittent</span><h2 id="fH"></h2><div id="fLive" style="display:grid"></div><div id="fB" class="stack"></div><div id="fHi"></div><p class="small mute">Eau, thé et café sans sucre restent permis. Évitez le jeûne en cas de grossesse, de diabète ou de troubles alimentaires, et parlez-en à Melvin.</p></div>',(sh,close)=>{
    const draw=()=>{const f=fastNow(),done=S.fasts.filter(x=>x.end).slice(-5).reverse();
      $("#fH",sh).textContent=f?"Jeûne "+fastLbl(f.goalH)+" en cours":"Démarrer un jeûne";$("#fLive",sh).innerHTML=fastRing(f,true);
      $("#fB",sh).innerHTML=f?'<p class="small mute" style="text-align:center">Débuté à '+hhmm(f.start)+' · fin prévue à '+hhmm(f.start+f.goalH*36e5)+'</p><button class="btn block" id="fS">Arrêter le jeûne</button>':
        '<div class="segs" id="fP" role="group" aria-label="Rythme">'+FAST_P.map(h=>'<button data-h="'+h+'" aria-pressed="'+(h===goal)+'">'+fastLbl(h)+'</button>').join("")+'<span class="sel" aria-hidden="true"></span></div><button class="btn gold block" id="fS">Démarrer maintenant</button>';
      $("#fHi",sh).innerHTML=done.length?'<span class="eyebrow">Derniers jeûnes</span><ul class="hist">'+done.map(x=>'<li><span class="mute">'+short(iso(new Date(x.start)))+' · '+fastLbl(x.goalH)+'</span><b>'+dur(x.end-x.start)+(x.end-x.start>=x.goalH*36e5?" ✓":"")+'</b></li>').join("")+'</ul>':"";
      const sg=$("#fP",sh);if(sg){requestAnimationFrame(()=>slide($(".sel",sg),$('[aria-pressed="true"]',sg),sg,false));$$("[data-h]",sg).forEach(b=>b.onclick=()=>{goal=+b.dataset.h;$$("[data-h]",sg).forEach(x=>x.setAttribute("aria-pressed",x===b));slide($(".sel",sg),b,sg);});}
      $("#fS",sh).onclick=e=>{const f2=fastNow();if(f2){f2.end=Date.now();toast("Jeûne terminé : "+dur(f2.end-f2.start)+(f2.end-f2.start>=f2.goalH*36e5?" · objectif atteint":""));}
        else{S.fasts.push({start:Date.now(),goalH:goal});S.fasts=S.fasts.slice(-60);toast("Jeûne "+fastLbl(goal)+" démarré");}
        save();draw();$("#fS",sh).focus();pulse($(".fring",sh));if(cur()==="journal")rerender();};};
    draw();});}
/* Mise à jour en direct de l'anneau (tuile et feuille), sans re-rendre la page */
setInterval(()=>{if(document.hidden||!S||!fastNow())return;const t=$('[data-tile="fast"]');if(t)t.innerHTML=fastTileIn();const L=$("#fLive");if(L)L.innerHTML=fastRing(fastNow(),true);},15000);

/* ───────── Mensurations et photos de progression (photos dans PH, sur le téléphone) ───────── */
let acct=null; /* session MBSync {userId,email,role} quand le compte en ligne est actif */
const online=()=>!!(acct&&window.MBSync?.enabled?.());
const MES=[["waist","Tour de taille"],["hips","Hanches"],["chest","Poitrine"],["arm","Bras"],["thigh","Cuisse"]],VIEWS=[["face","Face"],["profil","Profil"],["dos","Dos"]];
let pgView="face";
function measureCard(){const M=S.measures.slice().sort((a,b)=>a.date<b.date?-1:1),lm=M[M.length-1],wv=M.filter(m=>m.waist),fw=wv[0],lw=wv[wv.length-1];
  return '<section class="card metric"><div class="head"><div><span class="eyebrow c-weight">Mensurations · taille</span><div class="n" style="margin-top:6px">'+(lw?dec(lw.waist):"–")+'<small> cm</small></div>'+(lw&&fw&&fw!==lw?'<span class="delta mute">'+(lw.waist-fw.waist<=0?"":"+")+dec(lw.waist-fw.waist)+' cm depuis le '+short(fw.date)+'</span>':'<span class="delta mute">'+(lm?"le "+short(lm.date):"au mètre ruban, le matin")+'</span>')+'</div><button class="btn sm soft" data-ms>Noter</button></div>'+
   (wv.length>1?sparkLine(wv.slice(-12).map(m=>[m.date,m.waist]),"var(--weight)"):'')+
   (lm?'<div class="macline">'+MES.slice(1).filter(([k])=>lm[k]).map(([k,l])=>'<span>'+l+' <b>'+dec(lm[k])+' cm</b></span>').join("")+'</div>':'')+'</section>';}
function measureSheet(){const lm=S.measures.slice().sort((a,b)=>a.date<b.date?-1:1).slice(-1)[0]||{};
  sheet('<form class="stack" id="msF" novalidate><span class="eyebrow">Mensurations · '+short(todayIso())+'</span><h2>Noter mes mensurations</h2><div class="grid2">'+MES.map(([k,l])=>'<label class="f" for="ms_'+k+'">'+l+'<span class="unit"><input class="input" id="ms_'+k+'" type="number" inputmode="decimal" step="0.5" min="10" max="250" value="'+(lm[k]??"")+'" placeholder="–"><span>cm</span></span></label>').join("")+'</div><p class="small mute">Mesurez au même endroit, le matin à jeun. Laissez vide ce que vous ne mesurez pas.</p><button class="btn gold block" type="submit">Enregistrer</button></form>',(sh,close)=>{
    $("#msF",sh).onsubmit=e=>{e.preventDefault();const m={date:todayIso()};let bad=false;
      MES.forEach(([k])=>{const v=String($("#ms_"+k,sh).value).replace(",",".").trim();if(!v)return;const x=parseFloat(v);if(x>=10&&x<=250)m[k]=Math.round(x*10)/10;else bad=true;});
      if(bad){toast("Valeurs entre 10 et 250 cm");return;}if(Object.keys(m).length<2){toast("Indiquez au moins une mesure");return;}
      S.measures=S.measures.filter(x=>!x.ex&&x.date!==m.date);S.measures.push(m);save();if(online())MBSync.pushMeasure(Object.assign({waist:null,hips:null,chest:null,arm:null,thigh:null},m));
      close();if(cur()==="progres")rerender();toast("Mensurations enregistrées");};});}
function progressCard(){return '<section class="card stack"><div class="row between"><span class="eyebrow">Photos de progression</span><button class="btn sm soft" data-pg>Ajouter</button></div><div class="chips" role="group" aria-label="Angle">'+VIEWS.map(([k,l])=>'<button class="chip" data-pv="'+k+'" aria-pressed="'+(k===pgView)+'">'+l+'</button>').join("")+'</div><div class="compare" id="pgC">'+compareIn()+'</div><p class="small mute">Photos gardées sur ce téléphone'+(online()?", copie privée pour Melvin":"")+'. Même lumière, même tenue, même angle.</p></section>';}
function compareIn(){const L=S.progress.filter(x=>x.view===pgView).sort((a,b)=>a.date<b.date?-1:1),a=L[0],b=L.length>1?L[L.length-1]:null,lab=VIEWS.find(v=>v[0]===pgView)[1].toLowerCase();
  const fig=(x,t)=>x?'<figure><span class="thumb lg" data-ph="'+esc(x.id)+'" role="img" aria-label="'+t+', '+lab+', '+short(x.date)+'"></span><figcaption>'+t+' · '+short(x.date)+'</figcaption></figure>':'<figure><span class="empty-ph">'+(t==="Avant"?"Première photo de "+lab:"Ajoutez-en une autre pour comparer")+'</span><figcaption>'+t+'</figcaption></figure>';
  return fig(a,"Avant")+fig(b,"Maintenant");}
function bindProgress(v){$("[data-pg]",v)&&($("[data-pg]",v).onclick=progressSheet);$("[data-ms]",v)&&($("[data-ms]",v).onclick=measureSheet);
  $$("[data-pv]",v).forEach(b=>b.onclick=()=>{pgView=b.dataset.pv;$$("[data-pv]",v).forEach(x=>x.setAttribute("aria-pressed",x===b));const C=$("#pgC",v);C.innerHTML=compareIn();hydratePhotos(C);});}
function progressSheet(){let blob=null,view=pgView;
  sheet('<div class="stack"><span class="eyebrow">Photo de progression · '+short(todayIso())+'</span><h2>Ajouter une photo</h2><div class="chips" role="group" aria-label="Angle">'+VIEWS.map(([k,l])=>'<button class="chip" data-v="'+k+'" aria-pressed="'+(k===view)+'">'+l+'</button>').join("")+'</div><label class="drop" for="pgF"><span class="drop-in" id="pgV"><svg aria-hidden="true"><use href="#i-camera"/></svg><b>Prendre ou choisir une photo</b><span class="small mute">En pied, bras le long du corps</span></span><input id="pgF" type="file" accept="image/*" class="sr"></label><button class="btn gold block" id="pgA" disabled>Enregistrer</button></div>',(sh,close)=>{
    $$("[data-v]",sh).forEach(b=>b.onclick=()=>{view=b.dataset.v;$$("[data-v]",sh).forEach(x=>x.setAttribute("aria-pressed",x===b));});
    $("#pgF",sh).onchange=async e=>{const f=e.target.files[0];if(!f)return;try{blob=await compress(f,1200,.8);}catch(x){toast("Photo illisible, essayez une autre image");return;}
      $("#pgV",sh).innerHTML='<span class="preview" style="aspect-ratio:3/4;background-image:url('+URL.createObjectURL(blob)+')"></span>';$("#pgA",sh).disabled=false;};
    $("#pgA",sh).onclick=async()=>{if(!blob)return;const id="g"+uid();try{await PH.put(id,blob);}catch(x){toast("Photo non enregistrée sur ce téléphone");return;}
      const rec={id,date:todayIso(),view};S.progress.push(rec);save();pgView=view;close();if(cur()==="progres")rerender();toast("Photo ajoutée");
      if(online()){const path=await MBSync.uploadPhoto(blob,"progress");if(path){rec.path=path;save();}}};});}

/* ───────── Rappels : notifications locales via native.js ; dans le navigateur, export vers l'agenda (.ics ou Google Agenda) ───────── */
/* [clé, libellé, quand, texte, jour (0 = lundi … 6 = dimanche ; absent = chaque jour)]. Séance et courses ont leurs propres jours (days). */
const REM=[["seance","Séance","Collation et départ"],["courses","Courses","Courses faites ?"],["repas","Repas","Chaque jour","Pensez à noter votre repas dans l'appli."],["eau","Eau","Chaque jour","Un verre d'eau ? Notez-le, objectif 2 L."],["pesee","Pesée","Le lundi","Pesée de la semaine : le matin, au réveil.",0],["point","Point hebdo","Le dimanche","Votre point de la semaine pour Melvin : 1 minute.",6]];
const native=()=>!!window.MBNative?.isNative?.();
const BYDAY=["MO","TU","WE","TH","FR","SA","SU"];
const t2m=t=>{const[h,m]=String(t||"").split(":").map(Number);return (h||0)*60+(m||0);},m2t=x=>{x=Math.max(0,Math.min(1439,x));return String(Math.floor(x/60)).padStart(2,"0")+":"+String(x%60).padStart(2,"0");};
/* Séance et courses : jours et heure tirés du bilan tant que rien n'est réglé */
function remOf(k){const r=S.reminders[k]||{},P=S.profile;
  if(k==="seance"){const n=Math.max(0,Math.min(7,P.seances||3)),pick={0:[],1:[2],2:[1,3],3:[0,2,4],4:[0,1,3,4],5:[0,1,2,3,4],6:[0,1,2,3,4,5],7:[0,1,2,3,4,5,6]}[n];
    return {on:!!r.on,days:r.days||pick,t:r.t||{matin:"07:00",midi:"12:30",soir:"18:30"}[P.moment]||"18:30"};}
  if(k==="courses")return {on:!!r.on,days:r.days||[0,3,5],t:r.t||"18:00"};
  return {on:!!r.on,t:r.t||"09:00"};}
const remSet=k=>{const r=S.reminders[k]=S.reminders[k]||{on:false},d=remOf(k);if(d.days&&!r.days)r.days=d.days.slice();if(!r.t)r.t=d.t;return r;};
/* Tous les rappels actifs ; day = null pour un rappel quotidien */
function remList(){const w=S.profile.prenom?S.profile.prenom.split(" ")[0]+", ":"",L=[];
  REM.forEach(([k,l,,body,day])=>{const r=remOf(k);if(!r.on)return;const T=t2m(r.t);
    if(k==="seance")r.days.forEach(d=>{L.push({id:"col"+d,day:d,min:Math.max(0,T-75),t:w+"collation : "+dayPlan(d).meals[2].t,dsc:"Séance à "+r.t+". Recette dans l'appli MB NUTRITION.",lab:JOURS_L[d]+" · collation"});L.push({id:"go"+d,day:d,min:Math.max(0,T-20),t:w+"en route pour l'entraînement",dsc:"Séance à "+r.t+". Bonne séance !",lab:JOURS_L[d]+" · en route"});});
    else if(k==="courses")r.days.forEach(d=>L.push({id:"shop"+d,day:d,min:T,t:w+"courses faites ?",dsc:"Votre liste est dans l'appli MB NUTRITION : Plan › Courses.",lab:JOURS_L[d]+" · courses"}));
    else L.push({id:k,day:day??null,min:T,t:"MB NUTRITION · "+l,dsc:body,lab:(day==null?"Chaque jour":JOURS_L[day])+" · "+l.toLowerCase()});});
  return L;}
async function scheduleReminders(){ /* weekday Capacitor : 1 = dimanche, 2 = lundi */
  const list=remList().map((x,i)=>Object.assign({id:i+1,title:x.t,body:x.dsc,hour:Math.floor(x.min/60),minute:x.min%60},x.day!=null?{weekday:(x.day+1)%7+1}:{}));
  try{return await window.MBNative?.notify?.schedule?.(list);}catch(e){return false;}}
const remSub=k=>{const r=remOf(k);return r.days.length?"Collation à "+m2t(t2m(r.t)-75)+" · départ à "+m2t(t2m(r.t)-20):"Aucun jour de séance";};
function remindersCard(){
  return '<section class="card stack"><div class="row between"><span class="eyebrow">Rappels</span><svg aria-hidden="true" style="width:20px;height:20px;color:var(--mute)"><use href="#i-bell"/></svg></div><div>'+REM.map(([k,l,when])=>{const r=remOf(k);
    return '<div class="rem"><span><b>'+l+'</b><span'+(k==="seance"?' id="rS"':'')+'>'+esc(k==="seance"?remSub(k):when)+'</span></span><label class="sr" for="rt_'+k+'">'+(k==="seance"?"Heure de séance":"Heure du rappel "+l.toLowerCase())+'</label><input class="input" type="time" id="rt_'+k+'" data-rt="'+k+'" value="'+esc(r.t)+'"><button class="sw" role="switch" data-rm="'+k+'" aria-checked="'+r.on+'" aria-label="Rappel '+l.toLowerCase()+'"></button>'+
     (r.days?'<div class="days7" role="group" aria-label="Jours · '+l.toLowerCase()+'">'+JOURS.map((j,i)=>'<button type="button" class="chip" data-rd="'+k+'" data-i="'+i+'" aria-pressed="'+r.days.includes(i)+'" aria-label="'+JOURS_L[i]+'">'+j+'</button>').join("")+'</div>':'')+'</div>';}).join("")+'</div>'+
   (native()?'':'<p class="small mute">Ici, les rappels ne sonnent pas : ajoutez ceux qui sont activés à l\'agenda de votre téléphone. Dans l\'appli MB NUTRITION, ils sonnent tout seuls.</p><button class="btn gold block" id="rG"><svg aria-hidden="true"><use href="#i-bell"/></svg>Ajouter à mon agenda</button><button class="lnk" id="rO" style="justify-self:center">Plutôt Google Agenda</button><div id="rL" class="stack"></div>')+'</section>';}
function bindReminders(v){const resched=k=>{const s=$("#rS",v);if(s)s.textContent=remSub("seance");if(S.reminders[k]?.on)scheduleReminders();$("#rL",v)&&($("#rL",v).innerHTML="");};
  $$("[data-rm]",v).forEach(b=>b.onclick=async()=>{const k=b.dataset.rm,r=remSet(k),on=!r.on;
    if(on&&native()&&!(await window.MBNative.notify.permission?.())){toast("Notifications refusées : activez-les dans les réglages du téléphone");return;}
    r.on=on;b.setAttribute("aria-checked",on);save();$("#rL",v)&&($("#rL",v).innerHTML="");const ok=await scheduleReminders();toast(on?(native()&&ok!==false?"Rappel activé à "+r.t:"Rappel enregistré"):"Rappel désactivé");});
  $$("[data-rt]",v).forEach(i=>i.onchange=()=>{if(!/^\d\d:\d\d$/.test(i.value))return;const k=i.dataset.rt;remSet(k).t=i.value;save();resched(k);});
  $$("[data-rd]",v).forEach(b=>b.onclick=()=>{const k=b.dataset.rd,i=+b.dataset.i,r=remSet(k),on=!r.days.includes(i);r.days=on?[...r.days,i].sort():r.days.filter(x=>x!==i);b.setAttribute("aria-pressed",on);if(on)pulse(b);save();resched(k);});
  $("#rG",v)&&($("#rG",v).onclick=()=>{if(!remList().length){toast("Activez au moins un rappel");return;}saveIcs();});
  $("#rO",v)&&($("#rO",v).onclick=()=>{const L=remList();if(!L.length){toast("Activez au moins un rappel");return;}$("#rL",v).innerHTML=L.map(x=>'<a class="hint" href="'+esc(gcal(x))+'" target="_blank" rel="noopener"><svg aria-hidden="true"><use href="#i-plus"/></svg>'+esc(x.lab)+'</a>').join("");reveal($("#rL",v));});}
/* Prochaine date (iso) d'un rappel : aujourd'hui, ou le prochain jour de semaine voulu */
const remDay=x=>{let d=todayIso();if(x.day!=null)while(dow(d)!==x.day)d=addDays(d,1);return d;};
function icsText(){const stamp=new Date().toISOString().replace(/[-:]/g,"").slice(0,15)+"Z",out=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//MB NUTRITION//Rappels//FR","CALSCALE:GREGORIAN","X-WR-CALNAME:MB NUTRITION"];
  const e2=t=>String(t).replace(/\\/g,"\\\\").replace(/;/g,"\\;").replace(/,/g,"\\,").replace(/\n/g,"\\n");
  remList().forEach(x=>{const d=remDay(x);
    out.push("BEGIN:VEVENT","UID:mbn-"+x.id+"-"+(S.clientId||"x")+"@mb-nutrition","DTSTAMP:"+stamp,"DTSTART:"+d.replace(/-/g,"")+"T"+m2t(x.min).replace(":","")+"00","DURATION:PT10M",x.day==null?"RRULE:FREQ=DAILY":"RRULE:FREQ=WEEKLY;BYDAY="+BYDAY[x.day],"SUMMARY:"+e2(x.t),"DESCRIPTION:"+e2(x.dsc),"TRANSP:TRANSPARENT","BEGIN:VALARM","ACTION:DISPLAY","DESCRIPTION:"+e2(x.t),"TRIGGER:PT0M","END:VALARM","END:VEVENT");});
  out.push("END:VCALENDAR");return out.map(l=>{let s="",y=l;while(y.length>73){s+=y.slice(0,73)+"\r\n ";y=y.slice(73);}return s+y;}).join("\r\n")+"\r\n";}
async function saveIcs(){const txt=icsText(),fn="rappels-mb-nutrition.ics";
  if(dl){try{const r=await dl.save({filename:fn,data:txt});if(r&&r.status==="saved")toast("Ouvrez le fichier pour l'ajouter à votre agenda");return true;}catch(e){if(e&&e.code==="declined")return false;}}
  try{const u=URL.createObjectURL(new Blob([txt],{type:"text/calendar"})),A=document.createElement("a");A.href=u;A.download=fn;document.body.appendChild(A);A.click();A.remove();setTimeout(()=>URL.revokeObjectURL(u),4000);toast("Fichier d'agenda créé");return true;}catch(e){toast("Téléchargement impossible ici");return false;}}
function gcal(x){const D=remDay(x).replace(/-/g,""),s=D+"T"+m2t(x.min).replace(":","")+"00",e=D+"T"+m2t(x.min+10).replace(":","")+"00";
  return "https://calendar.google.com/calendar/render?action=TEMPLATE&text="+encodeURIComponent(x.t)+"&dates="+s+"/"+e+"&details="+encodeURIComponent(x.dsc)+"&recur="+encodeURIComponent(x.day==null?"RRULE:FREQ=DAILY":"RRULE:FREQ=WEEKLY;BYDAY="+BYDAY[x.day]);}

/* ───────── Coups de pouce du jour (séance, courses, journal) : un seul à la fois, entre les repas et les tuiles ───────── */
function nudge(){if(selDate!==todayIso())return"";const se=remOf("seance"),co=remOf("courses"),R=S.reminders.repas,d=dow(selDate),now=new Date(),mn=now.getHours()*60+now.getMinutes(),T=t2m(se.t),log=dayLog(selDate);
  if(se.days.includes(d)&&mn>=T-180&&mn<T+30&&!fastNow()&&!log.some(e=>e.slot===2)){const m=dayPlan(d).meals[2]; /* pas de collation proposée pendant un jeûne */
    return '<section class="card nudge"><span class="ico" style="background:var(--train)"><svg aria-hidden="true"><use href="#i-dumbbell"/></svg></span><span><b>Séance à '+esc(se.t)+'</b><span class="sub">Collation : '+esc(m.t)+'</span></span><div class="row"><button class="btn soft" data-nq>Collation prise</button></div></section>';}
  if(co.days.includes(d)&&mn>=600&&S.shopAsk[selDate]==null)
    return '<section class="card nudge"><span class="ico" style="background:var(--steps)"><svg aria-hidden="true"><use href="#i-check"/></svg></span><span><b>Courses faites ?</b><span class="sub">Liste dans Plan › Courses</span></span><div class="row"><button class="btn soft" data-ns="0">Pas encore</button><button class="btn" data-ns="1">Oui</button></div></section>';
  if(mn>=t2m(R&&R.on?R.t:"21:00")&&!log.length)
    return '<section class="card nudge"><span class="ico" style="background:var(--kcal)"><svg aria-hidden="true"><use href="#i-ring"/></svg></span><span><b>Journal vide</b><span class="sub">Notez vos repas du jour</span></span></section>';
  return "";}
function bindNudge(v){$("[data-nq]",v)&&($("[data-nq]",v).onclick=()=>addEntry(entryFromMeal(WEEK[dow(selDate)][2],2)));
  $$("[data-ns]",v).forEach(b=>b.onclick=()=>{const yes=b.dataset.ns==="1",day=selDate;S.shopAsk[day]=yes;save();const c=b.closest(".nudge"),done=()=>{rerender();toast(yes?"Parfait":"Pensez-y avant ce soir",()=>{delete S.shopAsk[day];save();rerender();});};
    if(yes)pulse($(".ico",c));if(RM)return done();c.animate([{opacity:1},{opacity:0,transform:"scale(.97)",filter:"blur(2px)"}],{duration:176,easing:EI,delay:yes?220:0,fill:"forwards"}).onfinish=done;});}

/* ───────── Compte en ligne (sync.js / Supabase) : connexion par code e-mail, envoi auto, plan, messages ───────── */
let syncCoach=false,pT=null,unread=false,unsub=null,msgs=[],chatFor=null,chatDraw=null;const pushed={};
const syncOn=()=>!!window.MBSync?.enabled?.();
function loginSheet(){let email="";
  sheet('<div class="stack"><span class="eyebrow">Compte MB NUTRITION</span><h2>Connexion par e-mail</h2><div id="lgB" class="stack"></div></div>',(sh,close)=>{const B=$("#lgB",sh);
    const step1=()=>{B.innerHTML='<form class="stack" id="lgE" novalidate><label class="f" for="lgM">Votre e-mail<input class="input" id="lgM" type="email" inputmode="email" autocomplete="email" value="'+esc(email)+'" placeholder="vous@exemple.fr"></label><button class="btn gold block" type="submit">Recevoir mon code</button><p class="small mute">Pas de mot de passe : vous recevez un code à 6 chiffres.</p></form>';
      $("#lgM",B).focus();$("#lgE",B).onsubmit=async e=>{e.preventDefault();email=$("#lgM",B).value.trim();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){toast("E-mail invalide");$("#lgM",B).focus();return;}
        const b=$("button",B);b.disabled=true;b.innerHTML='<span class="spin" aria-hidden="true"></span>Envoi…';if(await MBSync.signIn(email))step2();else{b.disabled=false;b.textContent="Recevoir mon code";toast(navigator.onLine===false?"Pas de connexion, réessayez":"E-mail inconnu : demandez à Melvin de vous inviter.");}};};
    const step2=()=>{B.innerHTML='<form class="stack" id="lgC" novalidate><p class="small mute">Code envoyé à <b>'+esc(email)+'</b>. Pensez aux courriers indésirables.</p><label class="f" for="lgK">Code à 6 chiffres<input class="input otp" id="lgK" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]*"></label><button class="btn gold block" type="submit">Me connecter</button><button type="button" class="lnk" id="lgR" style="justify-self:center">Changer d\'e-mail</button></form>';
      $("#lgK",B).focus();$("#lgR",B).onclick=step1;$("#lgC",B).onsubmit=async e=>{e.preventDefault();const k=$("#lgK",B).value.replace(/\D/g,"");if(k.length!==6){toast("Le code a 6 chiffres");return;}
        const b=$("button[type=submit]",B);b.disabled=true;const s=await MBSync.verify(email,k);if(!s){b.disabled=false;toast("Code incorrect ou expiré");$("#lgK",B).select();return;}
        acct=s;close();toast("Connecté : "+s.email);onLogin(true);};};
    step1();});}
async function onLogin(fresh){if(!acct)return;subscribeMsgs();
  if(acct.role==="coach"){syncCoach=coachOn=true;loadSyncClients();if(fresh||cur()==="accueil")go("coach");else if(["profil","accueil"].includes(cur()))route();return;}
  if(!S.mode||S.mode==="demo"){S.mode="client";save();}
  if(fresh)go(S.example?"bilan":"journal");else if(!$(".sheet"))rerender();
  pullPlan();pushSoon();checkUnread();}
async function signOut(){await MBSync.signOut();acct=null;unsub&&unsub();unsub=null;unread=false;if(syncCoach){syncCoach=coachOn=false;sClients=null;sOpen=null;}toast("Déconnecté de votre compte");route();}
/* Envoi en arrière-plan après chaque enregistrement (2 s de calme), seulement ce qui a changé */
function pushSoon(){if(!online()||acct.role==="coach"||S.example)return;clearTimeout(pT);pT=setTimeout(pushNow,2000);}
const dayPayload=d=>{const h=S.hr[d];return{log:S.log[d]||[],water:S.water[d]||0,steps:S.steps[d]||0,health:{hr:h?{avg:h.avg,min:h.min,max:h.max,resting:h.resting,hrv:h.hrv}:null,sleepMin:S.sleep[d]||null,activeKcal:S.active[d]||null},fasting:S.fasts.filter(f=>iso(new Date(f.start))===d)};};
async function pushNow(){if(!online()||S.example)return;const M=MBSync,once=(k,o,fn)=>{const j=JSON.stringify(o);if(pushed[k]===j)return;fn().then(ok=>{if(ok)pushed[k]=j;});};
  once("profile",S.profile,()=>M.pushProfile(S.profile));
  for(const d of new Set([0,1,2,3,4,5,6].map(k=>addDays(todayIso(),-k)).concat(selDate))){const p=dayPayload(d);once("day"+d,p,()=>M.pushDay(d,p));const tr=S.trainings.filter(x=>x.date===d&&!x.ex);once("tr"+d,tr,()=>M.pushTrainings(d,tr));}
  S.weights.filter(w=>!w.ex&&w.date>=addDays(todayIso(),-30)).forEach(w=>once("w"+w.date,w,()=>M.pushWeight({date:w.date,kg:w.kg})));
  const c=S.checkins.filter(x=>!x.ex).slice(-1)[0];if(c)once("c"+c.date,c,()=>M.pushCheckin(c));}
async function pullPlan(){if(!online()||acct.role==="coach")return;const p=await MBSync.pullPlan();if(!p||typeof p!=="object")return;
  const np={kcal:+p.kcal||0,swap:p.swap&&typeof p.swap==="object"?p.swap:{},extra:Array.isArray(p.extra)?p.extra:[],note:String(p.note||""),at:p.at||todayIso()};
  if(JSON.stringify(np)===JSON.stringify(S.plan))return;const first=!S.plan;S.plan=np;save();if(!$(".sheet"))rerender();if(!first||np.kcal)toast("Plan de Melvin mis à jour");}
/* Messages : bulles + temps réel ; pastille sur l'icône quand Melvin a écrit */
const msgTime=t=>{const d=new Date(t);return isNaN(d)?"":(iso(d)===todayIso()?"":short(iso(d))+" · ")+hhmm(+d);};
async function checkUnread(){if(!online()||acct.role==="coach")return;const L=await MBSync.messages.list();unread=!!(L||[]).some(m=>m.sender_id!==acct.userId&&!m.read_at);updateDot();}
function updateDot(){if(["journal","profil"].includes(cur()))header(cur());const d=$("#msgDot");if(d)d.hidden=!unread;}
function subscribeMsgs(){unsub&&unsub();unsub=MBSync.messages.subscribe(m=>{if(!m||!acct)return;const mine=m.sender_id===acct.userId;
  if(chatDraw&&$("#chL")&&m.client_id===chatFor){if(!msgs.some(x=>x.id===m.id))msgs.push(m);chatDraw();if(!mine)MBSync.messages.markRead(acct.role==="coach"?chatFor:undefined);}
  else if(!mine&&acct.role!=="coach"){unread=true;updateDot();toast("Nouveau message de Melvin");}});}
function chatSheet(cid,name){chatFor=cid||acct.userId;msgs=[];
  sheet('<div class="stack"><span class="eyebrow">Messages</span><h2>'+esc(name||"Melvin BEGUE")+'</h2><div class="chat" id="chL" aria-live="polite"><p class="small mute">Chargement…</p></div><form class="row" id="chF" style="gap:8px"><label class="sr" for="chI">Votre message</label><input class="input" id="chI" maxlength="4000" placeholder="Écrire un message…" autocomplete="off"><button class="btn" type="submit">Envoyer</button></form></div>',sh=>{
    const L=$("#chL",sh);chatDraw=()=>{L.innerHTML=msgs.length?msgs.map(m=>'<p class="bub'+(m.sender_id===acct.userId?" me":"")+'">'+esc(m.body)+'<small>'+msgTime(m.created_at)+'</small></p>').join(""):'<p class="small mute">Aucun message pour l\'instant.'+(cid?"":" Écrivez à Melvin : il vous répond ici.")+'</p>';L.scrollTop=L.scrollHeight;};
    MBSync.messages.list(cid).then(r=>{if(!sh.isConnected)return;if(r==null){L.innerHTML='<p class="small mute">Messages indisponibles hors connexion.</p>';return;}msgs=r;chatDraw();MBSync.messages.markRead(cid);if(!cid){unread=false;updateDot();}});
    $("#chF",sh).onsubmit=async e=>{e.preventDefault();const i=$("#chI",sh),t=i.value.trim();if(!t)return;i.value="";const m=await MBSync.messages.send(t,cid);
      if(!m){i.value=t;toast("Envoi impossible, vérifiez la connexion");return;}if(!msgs.some(x=>x.id===m.id))msgs.push(m);chatDraw();i.focus();};});}
function accountCard(){if(!syncOn())return '';
  return online()?'<section class="card stack"><div class="row between"><span class="eyebrow">Compte en ligne</span><span class="pill ok"><i></i>Synchronisé</span></div><p class="small mute">'+esc(acct.email)+'</p><div class="row" style="gap:8px;flex-wrap:wrap">'+(acct.role==="coach"?'':'<button class="btn sm" id="acM"><svg aria-hidden="true"><use href="#i-chat"/></svg>Messages<span class="udot" id="msgDot" style="position:static;margin-left:2px"'+(unread?'':' hidden')+'></span></button>')+'<button class="btn sm line" id="acX">Me déconnecter</button></div></section>':
   '<section class="card stack"><span class="eyebrow">Compte en ligne</span><h2>Suivi en direct avec Melvin</h2><p class="small mute">Melvin vous a invité ? Connectez-vous avec votre e-mail : votre journal part tout seul chez lui, son plan arrive dans l\'appli et vous échangez par messages.</p><button class="btn gold block" id="acL">Me connecter par e-mail</button></section>';}
function bindAccount(v){$("#acL",v)&&($("#acL",v).onclick=loginSheet);$("#acX",v)&&($("#acX",v).onclick=signOut);$("#acM",v)&&($("#acM",v).onclick=()=>chatSheet());}
/* Espace coach en ligne : fiches lues sur le serveur au lieu de la base de l'artifact */
let sClients=null,sOpen=null;
async function loadSyncClients(){sClients=await MBSync.coach.clients();if(cur()==="coach"&&!$(".sheet"))V.coach($("#view"));}
const syncC=c=>{const P=c.profile||{};return Object.assign({},c,{prenom:c.prenom||P.prenom||c.email||"Client",objectif:P.objectif||"forme",regime:P.regime||"omni",allergies:P.allergies||[],salle:P.salle||"",statut:c.statut||"Actif",cid:c.cid||""});};
function syncCoachView(v){if(sOpen)return syncClientView(v);const L=(sClients||[]).map(syncC),act=L.filter(c=>c.statut==="Actif");
  v.innerHTML='<div class="stack" style="gap:4px;padding-top:4px"><span class="eyebrow">Espace coach · '+esc(acct.email)+'</span><h1 style="font-size:1.75rem">Vos clients</h1></div>'+
   '<section class="kpis"><div class="kpi"><span class="n">'+act.length+'</span><span>'+(act.length>1?"clients actifs":"client actif")+'</span></div><div class="kpi"><span class="n">'+fmt(act.length*tarif)+' €</span><span>par mois à '+tarif+' €</span></div><div class="kpi"><span class="n">'+L.length+'</span><span>comptes</span></div></section>'+
   (sClients==null?'<div class="card"><p class="mute">Chargement de vos clients…</p></div>':!L.length?'<div class="card stack"><h2>Aucun client pour l\'instant</h2><p class="small mute">Vos clients apparaissent ici dès qu\'ils se connectent à l\'appli avec leur e-mail.</p></div>':'')+
   '<div class="clients">'+L.map(c=>'<button class="client" data-so="'+esc(c.id)+'"><div class="row between"><div class="row"><span class="avatar sm">'+esc(c.prenom[0].toUpperCase())+'</span><div style="text-align:left"><h3>'+esc(c.prenom)+'</h3><p class="small mute">'+esc(c.salle||"Salle non précisée")+' · '+esc(OBJECTIFS[c.objectif]?.label||"")+'</p></div></div><span class="pill '+(c.statut==="Actif"?"ok":"")+'">'+esc(c.statut)+'</span></div></button>').join("")+'</div>'+
   '<button class="lnk" id="scX" style="justify-self:start">Me déconnecter</button><p class="legal">Fiches et suivis lus sur le serveur MB NUTRITION, visibles par vous seul.</p>';
  $$("[data-so]",v).forEach(b=>b.onclick=()=>{sOpen=b.dataset.so;V.coach(v);reveal(v);scrollTo({top:0});});$("#scX",v).onclick=signOut;}
async function syncClientView(v){v.innerHTML='<button class="lnk" id="bk" style="justify-self:start">← Tous les clients</button><div class="card"><p class="mute">Chargement du suivi…</p></div>';$("#bk",v).onclick=()=>{sOpen=null;V.coach(v);};
  const id=sOpen,raw=await MBSync.coach.client(id);if(sOpen!==id||cur()!=="coach")return;
  if(!raw){v.innerHTML='<button class="lnk" id="bk" style="justify-self:start">← Tous les clients</button><div class="card"><p class="mute">Suivi indisponible, vérifiez la connexion.</p></div>';$("#bk",v).onclick=()=>{sOpen=null;V.coach(v);};return;}
  const c=syncC(raw),st={profile:Object.assign(structuredClone(PROFILE0),c.profile||{}),example:false,code:null,plan:c.plan||null},W=(c.weights||[]).map(w=>({date:w.date,kg:+w.kg})).filter(w=>w.kg>0),
    D=(c.days||[]).map(d=>{const L=(d.data&&d.data.log)||[],t=sum(L);return[d.date,Math.round(t.k),Math.round(t.p),Math.round(dayPlan(dow(d.date),st).tot.k)];}).filter(d=>d[1]>0),
    M=(c.measures||[]).slice(-1)[0],G=(c.photos||[]).filter(x=>x&&x.kind==="progress"&&x.path).slice(-6).reverse(),C=(c.checkins||[]).map(x=>Object.assign({date:x.date},x.data||{})),d7=D.slice(-7),ad=d7.length?Math.round(d7.reduce((a,x)=>a+x[1]/x[3],0)/d7.length*100):null;
  v.innerHTML='<button class="lnk" id="bk" style="justify-self:start">← Tous les clients</button><section class="card stack"><div class="row between"><div class="row"><span class="avatar">'+esc(c.prenom[0].toUpperCase())+'</span><div><h1 style="font-size:1.5rem">'+esc(c.prenom)+'</h1><p class="small mute">'+esc(c.email||"")+' · '+esc(OBJECTIFS[c.objectif]?.label||"")+'</p></div></div><span class="pill '+(c.statut==="Actif"?"ok":"")+'">'+esc(c.statut)+'</span></div><div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn sm" data-msg><svg aria-hidden="true"><use href="#i-chat"/></svg>Messages</button><button class="btn sm line" data-pl>Modifier le plan</button></div></section>'+
   '<section class="kpis"><div class="kpi"><span class="n">'+(W.length?dec(W[W.length-1].kg):"–")+'</span><span>kg, dernière pesée</span></div><div class="kpi"><span class="n">'+(ad!=null?ad+"%":"–")+'</span><span>de l\'objectif kcal (7 j)</span></div><div class="kpi"><span class="n">'+(M&&M.waist?dec(M.waist):"–")+'</span><span>cm de tour de taille</span></div></section>'+
   (W.length>1?'<section class="card stack"><h2>Poids</h2>'+sparkLine(W.slice(-12).map(w=>[w.date,w.kg]),"var(--weight)")+'</section>':'')+
   '<section class="card stack"><h2>Calories, 4 dernières semaines</h2>'+(D.length?daysChart(D):'<p class="small mute">Aucun repas noté.</p>')+'</section>'+
   (M?'<section class="card stack"><h2>Mensurations · '+short(M.date)+'</h2><div class="macline">'+MES.filter(([k])=>M[k]).map(([k,l])=>'<span>'+l+' <b>'+dec(M[k])+' cm</b></span>').join("")+'</div></section>':'')+
   (G.length?'<section class="card stack"><h2>Photos de progression</h2><div class="gallery">'+G.map(x=>'<figure><span class="thumb lg" data-sp="'+esc(x.path)+'" role="img" aria-label="Photo du '+short(x.date)+'"></span><figcaption>'+short(x.date)+'</figcaption></figure>').join("")+'</div></section>':'')+
   '<section class="card stack"><h2>Points hebdomadaires</h2>'+(C.length?'<ul class="hist">'+C.slice().reverse().map(x=>'<li><span><b>'+short(x.date)+'</b></span><span class="mute">Énergie '+(+x.energie||"–")+'/5 · Sommeil '+(+x.sommeil||"–")+'/5</span>'+(x.note?'<span class="mute" style="grid-column:1/-1">« '+esc(x.note)+' »</span>':'')+'</li>').join("")+'</ul>':'<p class="small mute">Aucun point reçu.</p>')+'</section>';
  $("#bk",v).onclick=()=>{sOpen=null;V.coach(v);reveal(v);};$$("[data-sp]",v).forEach(async el=>{const u=await MBSync.photoUrl(el.dataset.sp);if(u)el.style.backgroundImage='url("'+u+'")';});$("[data-msg]",v).onclick=()=>chatSheet(c.id,c.prenom);$("[data-pl]",v).onclick=()=>planSheet(c);}

/* ───────── Démarrage ───────── */
S=load();save();applyTheme();renderTabs();addEventListener("hashchange",route);
const realign=()=>{const a=$('#tabs a[aria-current="page"]');a&&slide($("#tabs .ind"),a,$("#tabs"),false);$$(".dates,.segs").forEach(p=>slide($(".sel",p),$('[aria-pressed="true"]',p),p,false));};
addEventListener("resize",realign);route();document.fonts?.ready.then(realign);initCaps();
Promise.resolve(window.MBHealth?.available?.()).then(ok=>{hOK=!!ok;if(!hOK)return;healthPull();if(cur()==="profil"&&!$(".sheet"))rerender();}).catch(()=>{});if(syncOn())MBSync.session().then(s=>{if(s){acct=s;onLogin(false);}});document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")onResume();});
})();

