/* Neemba · Pilotage consolidé · maquette. Données fictives de démonstration. */
(function(){
"use strict";
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const MOISN=["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
const JOURS=["dimanche","lundi","mardi","mercredi","jeudi","vendredi","samedi"];
const nf=(x,d=0)=>x.toLocaleString("fr-FR",{minimumFractionDigits:d,maximumFractionDigits:d}).replace(/\u202f/g,"\u00a0");
const mont=x=>Math.abs(x)>=1000?nf(x/1000,1)+"\u00a0Md":nf(x,0)+"\u00a0M";            // en FCFA
const montF=x=>mont(x)+"\u00a0FCFA";
const pct=(x,d=1)=>nf(x*100,d)+"\u00a0%";
const sg=(x,d=1,u="\u00a0%")=>(x>=0?"+":"\u2212")+nf(Math.abs(x),d)+u;
const libMois=m=>MOISN[+m.slice(5)-1]+" "+m.slice(0,4);
const moisAvant=(m,k)=>{let y=+m.slice(0,4),n=+m.slice(5)-k;while(n<1){n+=12;y--}return y+"-"+String(n).padStart(2,"0")};

let D,GEO,VOIS,ST={mois:null,mode:"M",pays:"",act:"",ind:"bud"},PN={},AN={},map,layer,labels,gEvol,gEcart,MOIS=[];

const S=()=>({dso:+$("#s-dso").value||75,dispo:(+$("#s-dispo").value||88)/100,mg:(+$("#s-mg").value||2)/100,ca:(+$("#s-ca").value||10)/100});

/* ---------- agrégations ---------- */
function periode(m,mode){ if(mode==="M") return [m]; const y=m.slice(0,4); return MOIS.filter(x=>x.slice(0,4)===y&&x<=m); }
function agg({pays="",act="",mois}){
  const set=new Set(mois), fin=mois[mois.length-1], tri=new Set([fin,moisAvant(fin,1),moisAvant(fin,2)]);
  const r={ca:0,marge:0,bud:0,budm:0,carnet:0,cre:0,cr90:0,ca3:0,parc:0,dispoP:0,immo:0,n:0}, m3=new Set();
  for(const l of D.lignes){ const [mo,p,a,ca,mg,b,bm,car,cre,c90]=l;
    if(pays&&p!==pays) continue; if(act&&a!==act) continue;
    if(set.has(mo)){r.ca+=ca;r.marge+=mg;r.bud+=b;r.budm+=bm;r.n++}
    if(mo===fin){r.carnet+=car;r.cre+=cre;r.cr90+=c90}
    if(tri.has(mo)){r.ca3+=ca;m3.add(mo)}
  }
  for(const f of D.flotte){ const [mo,p,parc,d,im]=f; if(pays&&p!==pays) continue;
    if(mo===fin){r.parc+=parc;r.dispoP+=parc*d;r.immo+=im} }
  r.tx=r.ca?r.marge/r.ca:0; r.txb=r.bud?r.budm/r.bud:0; r.ecart=r.ca-r.bud; r.ecartP=r.bud?r.ca/r.bud-1:0;
  r.dispo=r.parc?r.dispoP/r.parc:0; r.dso=r.ca3?r.cre/(r.ca3/(m3.size*30.4)):0; r.p90=r.cre?r.cr90/r.cre:0;
  return r;
}
const moisN1=ms=>ms.map(m=>moisAvant(m,12)).filter(m=>MOIS.includes(m));

/* ---------- initialisation ---------- */
Promise.all(["data/donnees.json","data/pays.geojson","data/voisins.geojson"].map(u=>fetch(u).then(r=>r.json()))).then(([d,g,v])=>{
  D=d;GEO=g;VOIS=v;
  D.pays.forEach(p=>PN[p.code]=p.nom); D.activites.forEach(a=>AN[a.code]=a.nom);
  MOIS=[...new Set(D.lignes.map(l=>l[0]))].sort();
  $("#arrete").textContent="chiffres arrêtés au "+(()=>{const x=new Date(D.meta.arrete);return x.getDate()+" "+MOISN[x.getMonth()]+" "+x.getFullYear()})();
  $("#f-mois").innerHTML=MOIS.slice().reverse().map(m=>`<option value="${m}">${libMois(m)[0].toUpperCase()+libMois(m).slice(1)}</option>`).join("");
  $("#f-pays").innerHTML=`<option value="">Les 11 pays</option>`+D.pays.slice().sort((a,b)=>a.nom.localeCompare(b.nom,"fr")).map(p=>`<option value="${p.code}">${p.nom}</option>`).join("");
  $("#f-act").innerHTML=`<option value="">Toutes les activités</option>`+D.activites.map(a=>`<option value="${a.code}">${a.nom}</option>`).join("");
  ST.mois=MOIS[MOIS.length-1];
  lireHash();
  initCarte(); initGraphs(); bind(); rendre();
}).catch(e=>{document.querySelector("main").innerHTML='<p class="vide">Les données de démonstration n\'ont pas pu être chargées. Rechargez la page.</p>';console.error(e)});

function lireHash(){ const h=new URLSearchParams(location.hash.slice(1));
  if(MOIS.includes(h.get("mois"))) ST.mois=h.get("mois"); if(h.get("mode")==="C") ST.mode="C";
  if(PN[h.get("pays")]) ST.pays=h.get("pays"); if(AN[h.get("act")]) ST.act=h.get("act");
  if(["bud","mg","dso","dispo"].includes(h.get("carte"))) ST.ind=h.get("carte"); }
function ecrireHash(){ const h=new URLSearchParams(); h.set("mois",ST.mois); if(ST.mode==="C") h.set("mode","C");
  if(ST.pays) h.set("pays",ST.pays); if(ST.act) h.set("act",ST.act); if(ST.ind!=="bud") h.set("carte",ST.ind);
  history.replaceState(null,"","#"+h.toString()); }

function bind(){
  $("#f-mois").onchange=e=>{ST.mois=e.target.value;rendre()};
  $("#f-pays").onchange=e=>{ST.pays=e.target.value;rendre()};
  $("#f-act").onchange=e=>{ST.act=e.target.value;rendre()};
  $$("#f-mode button").forEach(b=>b.onclick=()=>{ST.mode=b.dataset.v;rendre()});
  $$("#m-ind button").forEach(b=>b.onclick=()=>{ST.ind=b.dataset.v;rendre()});
  $("#raz").onclick=()=>{ST.pays="";ST.act="";ST.mode="M";ST.mois=MOIS[MOIS.length-1];rendre()};
  ["#s-dso","#s-dispo","#s-mg","#s-ca"].forEach(s=>$(s).addEventListener("input",()=>rendre()));
  $("#b-export").onclick=exporter; $("#b-copier").onclick=copierNote;
}

/* ---------- rendu ---------- */
function rendre(){
  $("#f-mois").value=ST.mois; $("#f-pays").value=ST.pays; $("#f-act").value=ST.act;
  $$("#f-mode button").forEach(b=>b.classList.toggle("on",b.dataset.v===ST.mode));
  $$("#m-ind button").forEach(b=>b.classList.toggle("on",b.dataset.v===ST.ind));
  $("#raz").hidden=!(ST.pays||ST.act||ST.mode!=="M"||ST.mois!==MOIS[MOIS.length-1]);
  ecrireHash();
  const per=periode(ST.mois,ST.mode), F={pays:ST.pays,act:ST.act};
  const cur=agg({...F,mois:per}), n1=moisN1(per), prev=agg({...F,mois:[moisAvant(ST.mois,1)]});
  const old=n1.length===per.length?agg({...F,mois:n1}):null;
  const alertes=calculerAlertes(per);
  contexte(cur);
  kpis(cur,old,prev,per);
  note(cur,old,per,alertes);
  carte(per);
  graphEvol(); graphEcart(per);
  listeAlertes(alertes);
  tableau(per,alertes);
}
function perim(){ return (ST.pays?PN[ST.pays]:"les 11 pays")+(ST.act?", "+AN[ST.act].toLowerCase():""); }
function libPer(){ return ST.mode==="M"?libMois(ST.mois):"cumul janvier à "+libMois(ST.mois); }

function contexte(c){
  $("#contexte").innerHTML=`<b>${perim()[0].toUpperCase()+perim().slice(1)}</b>, ${libPer()} : ${montF(c.ca)} de chiffre d'affaires, `+
   `${c.ecart>=0?"au-dessus":"en dessous"} du budget de ${pct(Math.abs(c.ecartP))}, marge de ${pct(c.tx)}.`;
}

function kpis(c,o,p,per){
  const S0=S(); const out=[];
  const ev=(a,b)=>b?a/b-1:null, cls=x=>x==null?"neutre":x>=0?"up":"down";
  const caN1=o?ev(c.ca,o.ca):null;
  // Explication de l'écart CA par la dimension la plus parlante
  const dims=ecarts(per); const top=dims.slice().sort((a,b)=>b.e-a.e)[0], bas=dims.slice().sort((a,b)=>a.e-b.e)[0];
  let comCA=c.ecart>=0?`Au-dessus du budget, porté surtout par ${top.nom} (+${mont(top.e)}).`:`Sous le budget, l'écart vient d'abord de ${bas.nom} (\u2212${mont(-bas.e)}).`;
  if(c.ecart>=0&&bas.e<0) comCA+=` ${bas.nom} reste en retrait.`;
  const dmg=c.tx-c.txb;
  const pireMg=margesParCellule(per).sort((a,b)=>a.d-b.d)[0];
  const comMg=Math.abs(dmg)<.005?`Proche du budget (${sg(dmg*100,1," pt")}).`:(dmg<0?`${sg(dmg*100,1," pt")} sous le budget.`:`${sg(dmg*100,1," pt")} au-dessus du budget.`)+
     (pireMg&&pireMg.d<-.01?` Plus fort recul : ${pireMg.nom}, ${pct(pireMg.tx)} pour ${pct(pireMg.txb)} prévus.`:"");
  const dCar=p.carnet?c.carnet/p.carnet-1:0;
  const couv=c.ca3?c.carnet/(c.ca3/Math.max(1,Math.min(3,MOIS.indexOf(ST.mois)+1))):0;
  const comCar=`Couvre ${nf(couv,1)} mois de facturation. ${Math.abs(dCar)<.02?"Stable sur le mois.":(dCar>0?"En hausse":"En baisse")+" de "+pct(Math.abs(dCar),0)+" sur le mois."}`;
  const fl=flotteParPays(ST.mois).sort((a,b)=>a.d-b.d)[0];
  const comFl=(c.dispo<S0.dispo?`Sous le seuil de ${pct(S0.dispo,0)}. `:"")+`${nf(c.immo)} machines arrêtées plus de 7 jours.`+(!ST.pays&&fl?` Plus bas : ${fl.nom} (${pct(fl.d,0)}).`:"");
  const comCr=`Délai moyen de paiement ${nf(c.dso)} jours, ${pct(c.p90,0)} à plus de 90 jours.`+(p.dso&&Math.abs(c.dso-p.dso)>=2?` ${c.dso>p.dso?"Il s'allonge":"Il se réduit"} de ${nf(Math.abs(c.dso-p.dso))} jours sur le mois.`:"");
  out.push({n:"Chiffre d'affaires",v:mont(c.ca),u:"FCFA",d:[[sg(c.ecartP*100)+" vs budget",cls(c.ecartP)],caN1!=null?[sg(caN1*100)+" vs N-1",cls(caN1)]:null],c:comCA,k:c.ecartP<-S0.ca?"alerte":c.ecartP>0?"bien":""});
  out.push({n:"Marge brute",v:pct(c.tx),u:"",d:[[sg(dmg*100,1," pt")+" vs budget",cls(dmg)],[mont(c.marge)+" FCFA","neutre"]],c:comMg,k:dmg<-S0.mg?"alerte":""});
  out.push({n:"Carnet de commandes",v:mont(c.carnet),u:"FCFA",d:[[sg(dCar*100)+" sur le mois",cls(dCar)],["fin "+libMois(ST.mois).split(" ")[0],"neutre"]],c:comCar,k:""});
  out.push({n:"Disponibilité flotte",v:pct(c.dispo),u:"",d:[[p.dispo?sg((c.dispo-p.dispo)*100,1," pt")+" sur le mois":"",cls(c.dispo-p.dispo)],[nf(c.parc)+" machines suivies","neutre"]],c:comFl,k:c.dispo<S0.dispo?"alerte":""});
  out.push({n:"Créances clients",v:mont(c.cre),u:"FCFA",d:[[nf(c.dso)+" jours",c.dso>S0.dso?"down":"neutre"],[pct(c.p90,0)+" > 90 j",c.p90>.2?"down":"neutre"]],c:comCr,k:c.dso>S0.dso?"alerte":""});
  $("#kpis").innerHTML=out.map(k=>`<div class="kpi ${k.k}"><div class="n">${k.n}</div><div class="v">${k.v}${k.u?`<small>${k.u}</small>`:""}</div>
    <div class="d">${k.d.filter(Boolean).filter(x=>x[0]).map(x=>`<span class="${x[1]}">${x[0]}</span>`).join("")}</div><div class="c">${k.c}</div></div>`).join("");
}

function ecarts(per){ // écart au budget par pays (si tous les pays) sinon par activité
  if(!ST.pays) return D.pays.map(p=>{const a=agg({pays:p.code,act:ST.act,mois:per});return{code:p.code,nom:p.nom,e:a.ecart,ep:a.ecartP}});
  return D.activites.filter(a=>!ST.act||a.code===ST.act).map(x=>{const a=agg({pays:ST.pays,act:x.code,mois:per});return{code:x.code,nom:x.nom.toLowerCase(),e:a.ecart,ep:a.ecartP}});
}
function margesParCellule(per){ const r=[];
  for(const p of D.pays){ if(ST.pays&&p.code!==ST.pays) continue;
    for(const a of D.activites){ if(ST.act&&a.code!==ST.act) continue;
      const x=agg({pays:p.code,act:a.code,mois:per}); if(x.ca<300) continue;
      r.push({pays:p.code,act:a.code,nom:p.nom+", "+a.nom.toLowerCase(),tx:x.tx,txb:x.txb,d:x.tx-x.txb,ca:x.ca}); } }
  return r; }
function flotteParPays(m){ return D.flotte.filter(f=>f[0]===m&&(!ST.pays||f[1]===ST.pays)).map(f=>({code:f[1],nom:PN[f[1]],d:f[3],parc:f[2],immo:f[4]})); }

/* ---------- alertes ---------- */
function calculerAlertes(per){
  const S0=S(), A=[], fin=ST.mois, m3=moisAvant(fin,3);
  for(const p of D.pays){ if(ST.pays&&p.code!==ST.pays) continue;
    const x=agg({pays:p.code,mois:[fin]}), y=agg({pays:p.code,mois:[m3]});
    if(x.dso>S0.dso){ const rest=x.cre*(1-S0.dso/x.dso);
      A.push({type:"Créances",pays:p.code,poids:rest*1.2,niv:x.dso>S0.dso+15?"fort":"moyen",
        t:`${p.nom} : clients payés à ${nf(x.dso)} jours`,
        p:`${y.dso?`${sg(x.dso-y.dso,0," j")} en 3 mois, `:""}${pct(x.p90,0)} des créances à plus de 90 jours, ${montF(x.cr90)} concernés.`,
        a:"Revue des 10 plus gros encours avec le directeur pays avant vendredi."}); }
    const f=D.flotte.find(r=>r[0]===fin&&r[1]===p.code), f3=D.flotte.find(r=>r[0]===m3&&r[1]===p.code);
    if(f&&f[3]<S0.dispo){ A.push({type:"Flotte",pays:p.code,poids:(S0.dispo-f[3])*f[2]*60,niv:f[3]<S0.dispo-.04?"fort":"moyen",
        t:`${p.nom} : flotte disponible à ${pct(f[3],0)}`,
        p:`${f3?`${sg((f[3]-f3[3])*100,0," pt")} en 3 mois, `:""}${f[4]} machine${f[4]>1?"s":""} arrêtée${f[4]>1?"s":""} plus de 7 jours sur ${f[2]} suivies.`,
        a:"Lister les pièces en attente et leur date d'arrivée, appel atelier lundi."}); }
    for(const a of D.activites){ if(ST.act&&a.code!==ST.act) continue;
      const c=agg({pays:p.code,act:a.code,mois:per}); if(c.bud<250) continue;
      const d=c.tx-c.txb;
      if(d<-S0.mg){ const suite=[0,1,2].every(k=>{const z=agg({pays:p.code,act:a.code,mois:[moisAvant(fin,k)]});return z.tx-z.txb<-S0.mg/2});
        A.push({type:"Marge",pays:p.code,poids:-d*c.ca*3,niv:d<-2*S0.mg?"fort":"moyen",
          t:`${p.nom}, ${a.nom.toLowerCase()} : marge à ${pct(c.tx)}`,
          p:`${pct(c.txb)} au budget, soit ${montF(-d*c.ca)} de marge manquante${suite?", trois mois de suite":""}.`,
          a:a.code==="NEUF"?"Contrôler les remises accordées sur les dernières affaires.":"Vérifier les prix d'achat et les heures facturées."}); }
      if(c.ecartP<-S0.ca){ A.push({type:"Chiffre d'affaires",pays:p.code,poids:-c.ecart*.8,niv:c.ecartP<-2*S0.ca?"fort":"moyen",
          t:`${p.nom}, ${a.nom.toLowerCase()} : ${pct(-c.ecartP,0)} sous le budget`,
          p:`${montF(c.ca)} réalisés pour ${montF(c.bud)} prévus.`,
          a:a.code==="LOC"?"Faire le point sur les machines louées rendues et non relouées.":"Demander au directeur pays les affaires décalées et leur nouvelle date."}); }
    }
  }
  return A.sort((a,b)=>b.poids-a.poids);
}

/* ---------- note du lundi ---------- */
function lundiApres(m){ let y=+m.slice(0,4),n=+m.slice(5)+1; if(n>12){n=1;y++} const d=new Date(Date.UTC(y,n-1,1)); while(d.getUTCDay()!==1) d.setUTCDate(d.getUTCDate()+1); return d; }
function note(c,o,per,A){
  const d=lundiApres(ST.mois);
  $("#note-date").textContent=`Lundi ${d.getUTCDate()} ${MOISN[d.getUTCMonth()]} ${d.getUTCFullYear()} · ${perim()}, ${libPer()}`;
  const F=[], dims=ecarts(per).sort((a,b)=>b.e-a.e), ou=ST.pays?"":" ";
  // 1. le chiffre global et son moteur
  const t=dims[0];
  F.push({h:`${montF(c.ca)} de chiffre d'affaires, ${c.ecart>=0?"au-dessus":"en dessous"} du budget de ${pct(Math.abs(c.ecartP))}${o?`, ${sg((c.ca/o.ca-1)*100)} sur un an`:""}.`,
          a:t.e>Math.abs(c.bud)*.01?`Premier contributeur : ${t.nom} (${t.e>=0?"+":"\u2212"}${montF(Math.abs(t.e))} sur le budget).`:(c.ecart<0?`Le manque vient d'abord de ${dims[dims.length-1].nom} (\u2212${montF(-dims[dims.length-1].e)}).`:"Écart réparti sans contributeur dominant.")});
  // 2. plus forte progression sur un an (pays x activité)
  let best=null; if(o){ for(const p of D.pays){ if(ST.pays&&p.code!==ST.pays) continue; for(const a of D.activites){ if(ST.act&&a.code!==ST.act) continue;
      const x=agg({pays:p.code,act:a.code,mois:per}), y=agg({pays:p.code,act:a.code,mois:moisN1(per)}); if(y.ca<200) continue;
      const g=x.ca-y.ca; if(!best||g>best.g) best={g,r:x.ca/y.ca-1,nom:p.nom+", "+a.nom.toLowerCase(),act:a.code}; } } }
  if(best&&best.g>0) F.push({h:`${best.nom} : ${sg(best.r*100,0)} sur un an (${sg(best.g/1000,1," Md FCFA")}).`,
      a:best.act==="PIE"?"La demande de pièces suit l'activité des sites miniers : vérifier le stock de sécurité sur les références les plus vendues.":best.act==="NEUF"?"Préparer dès maintenant la mise en service et les contrats d'entretien associés.":"Tendance à confirmer sur le mois prochain."});
  // 3. carnet de commandes : plus forte hausse sur le mois
  let car=null; for(const p of D.pays){ if(ST.pays&&p.code!==ST.pays) continue; const x=agg({pays:p.code,act:ST.act,mois:[ST.mois]}), y=agg({pays:p.code,act:ST.act,mois:[moisAvant(ST.mois,1)]});
    const g=x.carnet-y.carnet; if(!car||g>car.g) car={g,r:y.carnet?x.carnet/y.carnet-1:0,nom:p.nom,v:x.carnet}; }
  if(car&&car.g>0) F.push({h:`Carnet de commandes${ST.pays?"":", "+car.nom+","} à ${montF(car.v)}, ${sg(car.r*100,0)} sur le mois.`,
      a:"Ce carnet se facturera sur les prochains mois : confirmer les dates de livraison avec le client."});
  // compléter si besoin
  if(F.length<3){ const fl=flotteParPays(ST.mois).sort((a,b)=>b.d-a.d)[0]; if(fl) F.push({h:`Meilleure disponibilité de flotte : ${fl.nom}, ${pct(fl.d,0)}.`,a:"Pratique à documenter pour les autres pays."}); }
  $("#faits").innerHTML=F.slice(0,3).map(f=>`<li><b>${f.h}</b><span class="act">${f.a}</span></li>`).join("");
  // 2 alertes de nature différente si possible : la plus lourde, puis la plus lourde d'un autre type
  const al=A.length?[A[0]]:[]; const autre=A.find(x=>x.type!==A[0].type)||A.find(x=>x.pays!==A[0].pays); if(autre) al.push(autre);
  $("#alertes").innerHTML=al.length?al.map(x=>`<li><b>${x.t}.</b> ${x.p}<span class="act">${x.a}</span></li>`).join(""):`<li><b>Aucune alerte au-dessus des seuils.</b><span class="act">Seuils réglables en bas de page.</span></li>`;
  $("#note-perim").textContent="Rédigée automatiquement, relue par un responsable avant diffusion.";
  NOTE={d,F:F.slice(0,3),al};
}
let NOTE=null;
function copierNote(){ if(!NOTE) return; const d=NOTE.d;
  const txt=`Note du comité de direction, lundi ${d.getUTCDate()} ${MOISN[d.getUTCMonth()]} ${d.getUTCFullYear()}\nPérimètre : ${perim()}, ${libPer()}\n\nFaits marquants\n`+
   NOTE.F.map((f,i)=>`${i+1}. ${f.h} ${f.a}`).join("\n")+"\n\nAlertes\n"+NOTE.al.map((x,i)=>`${i+1}. ${x.t}. ${x.p} Action : ${x.a}`).join("\n")+"\n\n(Données fictives de démonstration)";
  const ok=()=>toast("Note copiée, prête à coller dans un e-mail ou Teams");
  if(navigator.clipboard) navigator.clipboard.writeText(txt).then(ok,()=>fallback(txt,ok)); else fallback(txt,ok); }
function fallback(t,ok){ const a=document.createElement("textarea"); a.value=t; document.body.appendChild(a); a.select(); try{document.execCommand("copy");ok()}catch(e){} a.remove(); }
function toast(t){ const e=$("#toast"); e.textContent=t; e.classList.add("on"); setTimeout(()=>e.classList.remove("on"),2200); }

/* ---------- carte ---------- */
function initCarte(){
  map=L.map("carte",{zoomControl:false,scrollWheelZoom:false,attributionControl:false,zoomSnap:.25,dragging:!L.Browser.mobile,tap:false});
  L.geoJSON(VOIS,{interactive:false,style:{fillColor:"#FFFFFF",fillOpacity:.55,color:"#C9D3DA",weight:1}}).addTo(map);
  layer=L.geoJSON(GEO,{style:()=>({}),onEachFeature:(f,l)=>{ l.on("click",()=>{ST.pays=ST.pays===f.properties.code?"":f.properties.code;rendre()});
    l.on("mouseover",()=>l.setStyle({weight:2.5})); l.on("mouseout",()=>carteStyle()); }}).addTo(map);
  const BB=()=>innerWidth>760?layer.getBounds().extend([12,-20.6]):layer.getBounds().pad(-0.04);
  map.fitBounds(BB(),{padding:[6,6]});
  labels=L.layerGroup().addTo(map);
  window.addEventListener("resize",()=>{map.invalidateSize();map.fitBounds(BB(),{padding:[6,6]})});
}
let VALS={};
const POS={GMB:[13.5,-19.6],GNB:[11.3,-18.7],MRT:[20.2,-10.3],MLI:[17.0,-3.0],NER:[17.0,9.0],TGO:[8.6,1.0],BEN:[10.0,2.35],SEN:[15.3,-14.3],GIN:[10.3,-11.0],CIV:[7.6,-5.5],BFA:[12.3,-1.6]};
function couleur(v){ const i=ST.ind;
  if(i==="bud") return v>=.03?"#2E7D5B":v>=0?"#7FB89A":v>=-.05?"#E9C46A":v>=-.12?"#DE8A55":"#B23A3A";
  if(i==="mg") return v>=.27?"#143852":v>=.24?"#25455E":v>=.21?"#5C7B92":v>=.18?"#9BB1C1":"#D7E0E7";
  if(i==="dso") return v<=60?"#2E7D5B":v<=70?"#7FB89A":v<=S().dso?"#E9C46A":v<=S().dso+20?"#DE8A55":"#B23A3A";
  return v>=.92?"#2E7D5B":v>=.9?"#7FB89A":v>=S().dispo?"#E9C46A":v>=S().dispo-.04?"#DE8A55":"#B23A3A"; }
function fmtInd(v){ return ST.ind==="bud"?sg(v*100,0):ST.ind==="mg"?pct(v,0):ST.ind==="dso"?nf(v)+" j":pct(v,0); }
function carte(per){
  VALS={}; for(const p of D.pays){ const a=agg({pays:p.code,act:ST.act,mois:per});
    VALS[p.code]=ST.ind==="bud"?a.ecartP:ST.ind==="mg"?a.tx:ST.ind==="dso"?a.dso:a.dispo; }
  carteStyle(); labels.clearLayers();
  for(const p of D.pays){ const pos=POS[p.code]; const petit=["GMB","GNB","TGO","BEN"].includes(p.code);
    labels.addLayer(L.marker(pos,{interactive:false,icon:L.divIcon({className:"lbl",iconSize:[0,0],html:`<div class="${["GMB","GNB"].includes(p.code)?"mer":""} ${petit?"petit":""}">${p.nom}<b>${fmtInd(VALS[p.code])}</b></div>`})})); }
  // traits de rappel pour les deux pays trop petits pour porter leur étiquette
  [["GMB",[13.45,-16.6],[13.5,-18.2]],["GNB",[11.9,-15.3],[11.4,-17.3]]].forEach(([c,a,b])=>labels.addLayer(L.polyline([a,b],{color:"#25455E",weight:1,opacity:.6,interactive:false,className:"rappel"})));
  layer.eachLayer(l=>l.bindTooltip(`<b>${PN[l.feature.properties.code]}</b><br>${{bud:"Écart au budget",mg:"Taux de marge",dso:"Délai de paiement",dispo:"Disponibilité flotte"}[ST.ind]} : ${fmtInd(VALS[l.feature.properties.code])}`,{sticky:true}));
  const L1={bud:[["#2E7D5B","≥ +3 %"],["#7FB89A","0 à +3 %"],["#E9C46A","0 à −5 %"],["#DE8A55","−5 à −12 %"],["#B23A3A","< −12 %"]],
    mg:[["#143852","≥ 27 %"],["#25455E","24 à 27 %"],["#5C7B92","21 à 24 %"],["#9BB1C1","18 à 21 %"],["#D7E0E7","< 18 %"]],
    dso:[["#2E7D5B","≤ 60 j"],["#7FB89A","61 à 70 j"],["#E9C46A","jusqu'au seuil"],["#DE8A55","seuil + 20 j"],["#B23A3A","au-delà"]],
    dispo:[["#2E7D5B","≥ 92 %"],["#7FB89A","90 à 92 %"],["#E9C46A","jusqu'au seuil"],["#DE8A55","seuil − 4 pt"],["#B23A3A","en dessous"]]}[ST.ind];
  $("#legende").innerHTML=L1.map(x=>`<span><i style="background:${x[0]}"></i>${x[1]}</span>`).join("")+(ST.ind==="dispo"?`<span>flotte : toutes activités</span>`:"");
}
function carteStyle(){ layer.setStyle(f=>{ const c=f.properties.code, sel=ST.pays===c, aut=ST.pays&&!sel;
  return {fillColor:couleur(VALS[c]),fillOpacity:aut?.35:.88,color:sel?"#B39843":"#FFFFFF",weight:sel?3.5:1.3}; });
  if(ST.pays) layer.eachLayer(l=>{ if(l.feature.properties.code===ST.pays) l.bringToFront(); }); }

/* ---------- graphiques ---------- */
function initGraphs(){
  Chart.defaults.font.family="Barlow"; Chart.defaults.color="#5A6873";
  gEvol=new Chart($("#g-evol"),{data:{labels:[],datasets:[
    {type:"bar",label:"Chiffre d'affaires",data:[],backgroundColor:[],borderRadius:3,yAxisID:"y",order:2},
    {type:"line",label:"Budget",data:[],borderColor:"#B39843",borderDash:[5,4],pointRadius:0,borderWidth:2,yAxisID:"y",order:1},
    {type:"line",label:"Marge (%)",data:[],borderColor:"#003B83",backgroundColor:"#003B83",pointRadius:2.5,borderWidth:2,yAxisID:"y2",order:0}]},
    options:{maintainAspectRatio:false,interaction:{mode:"index",intersect:false},plugins:{legend:{position:"bottom",labels:{boxWidth:12,font:{size:12}}},
      tooltip:{callbacks:{label:c=>c.dataset.yAxisID==="y2"?` Marge : ${pct(c.raw/100)}`:` ${c.dataset.label} : ${montF(c.raw)}`}}},
      scales:{y:{beginAtZero:true,grid:{color:"#EEF0F2"},ticks:{callback:v=>v>=1000?nf(v/1000,0)+" Md":nf(v)}},y2:{position:"right",grid:{display:false},ticks:{callback:v=>v+" %"}},x:{grid:{display:false}}}}});
  gEcart=new Chart($("#g-ecart"),{type:"bar",data:{labels:[],datasets:[{data:[],backgroundColor:[],borderRadius:3}]},
    options:{indexAxis:"y",maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>` Écart au budget : ${sg(c.raw/1000,2," Md FCFA")}`}}},
      scales:{x:{grid:{color:"#EEF0F2"},ticks:{callback:v=>nf(v/1000,1)+" Md"}},y:{grid:{display:false}}},
      onClick:(e,el)=>{ if(!el.length) return; const k=ECK[el[0].index]; if(!ST.pays){ST.pays=k}else{ST.act=ST.act===k?"":k} rendre(); }}});
}
let ECK=[],TOUT=false;
function graphEvol(){
  const ms=[]; for(let k=11;k>=0;k--){ const m=moisAvant(ST.mois,k); if(MOIS.includes(m)) ms.push(m); }
  const rows=ms.map(m=>agg({pays:ST.pays,act:ST.act,mois:[m]}));
  gEvol.data.labels=ms.map(m=>MOISN[+m.slice(5)-1].slice(0,4).replace(/\.$/,"")+". "+m.slice(2,4));
  gEvol.data.datasets[0].data=rows.map(r=>Math.round(r.ca)); gEvol.data.datasets[0].backgroundColor=rows.map((r,i)=>i===rows.length-1?"#25455E":"#9BB1C1");
  gEvol.data.datasets[1].data=rows.map(r=>Math.round(r.bud)); gEvol.data.datasets[2].data=rows.map(r=>+(r.tx*100).toFixed(1));
  gEvol.update();
  const l3=rows.slice(-3), p3=rows.slice(-6,-3);
  const s=a=>a.reduce((t,r)=>t+r.ca,0), sb=a=>a.reduce((t,r)=>t+r.bud,0), mg=a=>a.reduce((t,r)=>t+r.marge,0)/s(a);
  let txt=`Sur les 3 derniers mois, ${montF(s(l3))} facturés, ${pct(Math.abs(s(l3)/sb(l3)-1))} ${s(l3)>=sb(l3)?"au-dessus":"en dessous"} du budget`;
  if(p3.length===3){ const dm=mg(l3)-mg(p3); txt+=`. La marge ${Math.abs(dm)<.003?"est stable":dm>0?"progresse de "+nf(dm*100,1)+" pt":"recule de "+nf(-dm*100,1)+" pt"} par rapport aux 3 mois précédents`; }
  $("#l-evol").textContent=txt+".";
}
function graphEcart(per){
  const e=ecarts(per).sort((a,b)=>b.e-a.e); ECK=e.map(x=>x.code);
  gEcart.data.labels=e.map(x=>x.nom[0].toUpperCase()+x.nom.slice(1)); gEcart.data.datasets[0].data=e.map(x=>Math.round(x.e));
  gEcart.data.datasets[0].backgroundColor=e.map(x=>x.e>=0?"#2E7D5B":"#B23A3A"); gEcart.update();
  $("#ecart-dim").textContent=ST.pays?"par activité, "+PN[ST.pays]:"par pays · touchez une barre";
  const pos=e.filter(x=>x.e>0).reduce((t,x)=>t+x.e,0), neg=e.filter(x=>x.e<0).reduce((t,x)=>t+x.e,0);
  const top=e[0], bas=e[e.length-1];
  $("#l-ecart").textContent=`Écart total ${sg((pos+neg)/1000,2," Md FCFA")} : ${sg(pos/1000,1," Md")} de gains, ${sg(neg/1000,1," Md")} de manques. `+
    (top.e>0?`${top.nom[0].toUpperCase()+top.nom.slice(1)} apporte le plus`:"")+(bas.e<0?`${top.e>0?", ":""}${bas.nom} pèse le plus.`:".");
}

/* ---------- liste des alertes et tableau ---------- */
function listeAlertes(A){
  const MAX=8, plus=A.length-MAX;
  $("#liste-al").innerHTML=A.length?A.map((x,i)=>`<div class="al ${x.niv==="fort"?"":"moyen"} ${i>=MAX&&!TOUT?"cache":""}" data-p="${x.pays}"><span class="tag">${x.type} · ${x.niv==="fort"?"prioritaire":"à surveiller"}</span>
    <h4>${x.t}</h4><p>${x.p}</p><p class="act">Action proposée : ${x.a}</p></div>`).join("")+(plus>0&&!TOUT?`<button class="voir" id="voir-al">Voir les ${plus} autres alertes</button>`:""):`<p class="vide">Aucune alerte au-dessus des seuils pour ce périmètre.</p>`;
  const v=$("#voir-al"); if(v) v.onclick=()=>{TOUT=true;listeAlertes(A)};
  $$("#liste-al .al").forEach(e=>e.onclick=()=>{ST.pays=e.dataset.p;rendre();window.scrollTo({top:0,behavior:"smooth"})});
}
function tableau(per,A){
  const nb={}; A.forEach(x=>nb[x.pays]=(nb[x.pays]||0)+(x.niv==="fort"?2:1));
  const rows=D.pays.map(p=>({p,a:agg({pays:p.code,act:ST.act,mois:per})})).sort((x,y)=>y.a.ca-x.a.ca);
  $("#t-pays tbody").innerHTML=rows.map(({p,a})=>{ const n=nb[p.code]||0;
    return `<tr data-p="${p.code}" class="${ST.pays===p.code?"sel":""}"><td>${p.nom}</td><td>${mont(a.ca)}</td><td class="${a.ecartP>=0?"up":"down"}">${sg(a.ecartP*100)}</td>
    <td>${pct(a.tx)}</td><td>${mont(a.carnet)}</td><td>${pct(a.dispo,0)}</td><td>${nf(a.dso)} j</td>
    <td>${n>=2?'<span class="pastille p-al">alerte</span>':n===1?'<span class="pastille p-vig">à suivre</span>':'<span class="pastille p-ok">ok</span>'}</td></tr>`; }).join("");
  const t=agg({act:ST.act,mois:per});
  let tf=$("#t-pays tfoot"); if(!tf){tf=document.createElement("tfoot");$("#t-pays").appendChild(tf)}
  tf.innerHTML=`<tr><td>Groupe</td><td>${mont(t.ca)}</td><td>${sg(t.ecartP*100)}</td><td>${pct(t.tx)}</td><td>${mont(t.carnet)}</td><td>${pct(t.dispo,0)}</td><td>${nf(t.dso)} j</td><td></td></tr>`;
  $$("#t-pays tbody tr").forEach(r=>r.onclick=()=>{ST.pays=ST.pays===r.dataset.p?"":r.dataset.p;rendre()});
}

function exporter(){
  const per=periode(ST.mois,ST.mode), L=[["Pays","Activité","Période","Chiffre d'affaires (M FCFA)","Budget (M FCFA)","Écart budget (%)","Marge (M FCFA)","Taux de marge (%)","Carnet fin de période (M FCFA)","Créances (M FCFA)","Délai de paiement (jours)","Disponibilité flotte (%)"]];
  for(const p of D.pays){ if(ST.pays&&p.code!==ST.pays) continue; for(const a of D.activites){ if(ST.act&&a.code!==ST.act) continue;
    const x=agg({pays:p.code,act:a.code,mois:per});
    L.push([p.nom,a.nom,libPer(),x.ca.toFixed(1),x.bud.toFixed(1),(x.ecartP*100).toFixed(1),x.marge.toFixed(1),(x.tx*100).toFixed(1),x.carnet.toFixed(1),x.cre.toFixed(1),x.dso.toFixed(0),(x.dispo*100).toFixed(1)].map(String)); } }
  L.push(["Données fictives de démonstration"]);
  const csv="\ufeff"+L.map(r=>r.map(v=>/[;"\n]/.test(v)?`"${v.replace(/"/g,'""')}"`:v).join(";")).join("\n");
  const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
  a.download=`neemba_pilotage_${ST.mois}${ST.pays?"_"+ST.pays:""}${ST.act?"_"+ST.act:""}_fictif.csv`; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),2000);
}
})();
