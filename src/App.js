import React, { useState, useEffect, useRef, useCallback } from "react";

var SUPA_URL = "https://ycdptnmznauyzckqepuu.supabase.co";
var SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljZHB0bm16bmF1eXpja3FlcHV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyODE3OTYsImV4cCI6MjA4OTg1Nzc5Nn0.SDWgUox2BcLSQB0s4JcplemTuq-NuidS5wv0ro2P30s";

var supa = {
  _h: function(){ return {"apikey":SUPA_KEY,"Authorization":"Bearer "+(SUPA_KEY),"Content-Type":"application/json","Prefer":"return=representation"}; },
  from: function(table){
    var base=SUPA_URL+"/rest/v1/"+table;
    return {
      select: function(cols,opts){ var url=base+"?select="+(cols||"*")+(opts||""); return fetch(url,{headers:supa._h()}).then(function(r){return r.json();}); },
      upsert: function(data){ return fetch(base,{method:"POST",headers:Object.assign({},supa._h(),{"Prefer":"resolution=merge-duplicates,return=representation"}),body:JSON.stringify(data)}).then(function(r){return r.json();}); },
      delete: function(filter){ return fetch(base+"?"+filter,{method:"DELETE",headers:supa._h()}).then(function(r){return r.ok;}); },
      rpc: function(fn,params){ return fetch(SUPA_URL+"/rest/v1/rpc/"+fn,{method:"POST",headers:supa._h(),body:JSON.stringify(params)}).then(function(r){return r.json();}); }
    };
  },
  auth: {
    signIn: function(email,password){ return fetch(SUPA_URL+"/auth/v1/token?grant_type=password",{method:"POST",headers:{"apikey":SUPA_KEY,"Content-Type":"application/json"},body:JSON.stringify({email,password})}).then(function(r){return r.json();}); },
    signUp: function(email,password){ return fetch(SUPA_URL+"/auth/v1/signup",{method:"POST",headers:{"apikey":SUPA_KEY,"Content-Type":"application/json"},body:JSON.stringify({email,password})}).then(function(r){return r.json();}); },
    signOut: function(){ return fetch(SUPA_URL+"/auth/v1/logout",{method:"POST",headers:supa._h()}).then(function(){_token=null;_userId=null;try{localStorage.removeItem("supa_session");}catch(e){}}); },
    resetPassword: function(email){ return fetch(SUPA_URL+"/auth/v1/recover",{method:"POST",headers:{"apikey":SUPA_KEY,"Content-Type":"application/json"},body:JSON.stringify({email})}).then(function(r){return r.ok;}); },
    getSession: function(){ try{var s=localStorage.getItem("supa_session");return s?JSON.parse(s):null;}catch(e){return null;} },
  },
};
var _token=null, _userId=null;

var WS=510,WE=960,JOB=30,GAP=15,PAUSE=30,PAUSE_AT=210,MIN_WORK=420;
var HOME_LAT=43.6047,HOME_LON=1.4442,GEOCODE_KEY="vmc_geocache";
function fmt(m){var t=Math.max(0,Math.round(m));return String(Math.floor(t/60)).padStart(2,"0")+":"+String(t%60).padStart(2,"0");}
function norm(s){return String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim();}

var S={
  get:function(k){return new Promise(function(resolve){try{var v=localStorage.getItem("proplan_"+k);resolve(v?JSON.parse(v):null);}catch(e){resolve(null);}});},
  set:function(k,v){return new Promise(function(resolve){try{localStorage.setItem("proplan_"+k,JSON.stringify(v));resolve(true);}catch(e){resolve(null);}});},
  del:function(k){try{localStorage.removeItem("proplan_"+k);}catch(e){}},
};

function haversineKm(la1,lo1,la2,lo2){var R=6371,dLa=(la2-la1)*Math.PI/180,dLo=(lo2-lo1)*Math.PI/180;var a=Math.pow(Math.sin(dLa/2),2)+Math.cos(la1*Math.PI/180)*Math.cos(la2*Math.PI/180)*Math.pow(Math.sin(dLo/2),2);return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));}
var _zoneCache={};
function clearZoneCache(){_zoneCache={};}
function getZone(cp,ville,id,coords){if(coords&&id&&coords[id]){if(_zoneCache[id])return _zoneCache[id];var lat=coords[id].lat,lon=coords[id].lon,km=haversineKm(HOME_LAT,HOME_LON,lat,lon),t=Math.round(km/50*60);var col=t<5?"#6366f1":t<15?"#8b5cf6":t<25?"#06b6d4":t<40?"#f59e0b":t<55?"#f97316":"#ef4444";var z={t,cas:t>=80,nom:ville||"Zone",col};_zoneCache[id]=z;return z;}var c=String(cp||"").trim().replace(/\.0$/,""),v=String(ville||"").toUpperCase().trim();if(c.startsWith("3183"))return{t:18,cas:false,nom:"Plaisance",col:"#06b6d4"};if(c.startsWith("3114"))return{t:16,cas:false,nom:"Castelginest",col:"#6366f1"};if(c.startsWith("3127"))return{t:18,cas:false,nom:"Frouzins",col:"#6366f1"};if(c.startsWith("3133")||c.startsWith("3134"))return{t:22,cas:false,nom:"Launac",col:"#f59e0b"};if(c.startsWith("3184"))return{t:20,cas:false,nom:"Aussonne",col:"#06b6d4"};if(c.startsWith("326"))return{t:35,cas:false,nom:"Isle-Jourdain",col:"#f97316"};if(c.startsWith("815"))return{t:42,cas:false,nom:"Lavaur",col:"#f97316"};if(c.startsWith("827"))return{t:48,cas:false,nom:"Bressol",col:"#ef4444"};if(c.startsWith("65"))return{t:90,cas:true,nom:"Bagneres",col:"#ef4444"};return{t:0,cas:false,nom:"Toulouse",col:"#6366f1"};}

function nearestNeighbor(clients,coords){var withC=clients.filter(function(c){return coords&&coords[c.id];});var noC=clients.filter(function(c){return !coords||!coords[c.id];});if(withC.length<=1)return clients;var rem=withC.slice(),ord=[],cur={lat:HOME_LAT,lon:HOME_LON};while(rem.length>0){var bi=0,bd=Infinity;for(var i=0;i<rem.length;i++){var d=haversineKm(cur.lat,cur.lon,coords[rem[i].id].lat,coords[rem[i].id].lon);if(d<bd){bd=d;bi=i;}}var nx=rem.splice(bi,1)[0];ord.push(nx);cur=coords[nx.id];}return ord.concat(noC);}

function planifier(pending,otMin,jobFn,coords){var ot=(typeof otMin==="number"&&!isNaN(otMin))?otMin:30;var maxWork=MIN_WORK+ot;var durFn=function(c){return jobFn?jobFn(c):(c.nbrCaissons||1)*JOB;};var casAPart=pending.filter(function(c){return getZone(c.cp,c.ville,c.id,coords).cas;});var plannable=pending.filter(function(c){return !getZone(c.cp,c.ville,c.id,coords).cas;});if(!plannable.length)return{journees:[],casAPart};var withAngle=plannable.map(function(c){var lat,lon;if(coords&&coords[c.id]){lat=coords[c.id].lat;lon=coords[c.id].lon;}else{var z=getZone(c.cp,c.ville,c.id,null);var r=z.t/60*0.45;var a=Math.random()*2*Math.PI;lat=HOME_LAT+r*Math.cos(a);lon=HOME_LON+r*Math.sin(a)/Math.cos(HOME_LAT*Math.PI/180);}var angle=(Math.atan2(lon-HOME_LON,lat-HOME_LAT)*180/Math.PI+360)%360;var dist=haversineKm(HOME_LAT,HOME_LON,lat,lon);return Object.assign({},c,{_lat:lat,_lon:lon,_angle:angle,_dist:dist});});withAngle.sort(function(a,b){var sA=Math.floor(a._angle/30),sB=Math.floor(b._angle/30);if(sA!==sB)return sA-sB;return a._dist-b._dist;});var groups=[],cur=[],work=0;for(var i=0;i<withAngle.length;i++){var c=withAngle[i],d=durFn(c);if(work+d>maxWork&&cur.length>0){groups.push(cur);cur=[];work=0;}cur.push(c);work+=d;}if(cur.length>0)groups.push(cur);var journees=groups.map(function(grp,ji){var ordered=(coords&&Object.keys(coords).length>0)?nearestNeighbor(grp,coords):grp;var avgDist=ordered.reduce(function(s,c){return s+(c._dist||0);},0)/ordered.length;var travelMin=Math.min(Math.round(avgDist/50*60),60);var cursor=WS,cumWork=0,pauseAt=null,pauseDone=false;var slots=ordered.map(function(c){var d=durFn(c);if(!pauseDone&&cumWork>=PAUSE_AT){cursor=cursor-GAP+PAUSE;pauseAt=cursor-PAUSE;pauseDone=true;}var s=cursor,e=cursor+d;cursor=e+GAP;cumWork+=d;return{clientId:c.id,startClock:fmt(s),endClock:fmt(e),startMin:s,dur:d,nbrCaissons:c.nbrCaissons||1,overtime:e>WE,zoneName:c.ville||"Toulouse",zoneCol:getZone(c.cp,c.ville,c.id,coords).col};});if(!pauseDone)pauseAt=cursor-GAP;var zones=[];slots.forEach(function(s){if(zones.indexOf(s.zoneName)<0)zones.push(s.zoneName);});var depMin=travelMin>0?WS-travelMin:null;var last=slots[slots.length-1];return{id:Math.random().toString(36).slice(2),num:ji+1,travelMin,zonesLabel:zones.slice(0,3).join(" · "),zoneColor:getZone(grp[0].cp,grp[0].ville,grp[0].id,coords).col,departTime:depMin!==null?fmt(depMin):null,slots,totalWork:cumWork,breakAt:pauseAt!==null?fmt(pauseAt):null,overtime:slots.some(function(s){return s.overtime;}),sousCharge:cumWork<MIN_WORK,finHeure:last?last.endClock:"16:00",multiZone:zones.length>1};});journees.sort(function(a,b){if(a.sousCharge!==b.sousCharge)return a.sousCharge?1:-1;return a.travelMin-b.travelMin;});journees.forEach(function(j,i){j.num=i+1;});return{journees,casAPart};}

function readExcelRaw(file){return new Promise(function(resolve,reject){if(typeof window.XLSX==="undefined")return reject("XLSX non chargé");var reader=new FileReader();reader.onload=function(e){try{var wb=window.XLSX.read(e.target.result,{type:"binary"});var ws=wb.Sheets[wb.SheetNames[0]];var raw=window.XLSX.utils.sheet_to_json(ws,{header:1,defval:""});var hi=raw.findIndex(function(r){return r.some(function(v){return String(v).trim()!=="";});});if(hi<0)return reject("Fichier vide.");resolve({headers:raw[hi],rows:raw.slice(hi+1).filter(function(r){return r.some(function(v){return String(v).trim()!=="";});}),headerIdx:hi});}catch(e){reject("Erreur: "+e.message);}};reader.onerror=function(){reject("Lecture impossible.");};reader.readAsBinaryString(file);})}

function detectMapping(headers){var h=headers.map(function(h){return norm(String(h));});var find=function(){var keys=Array.from(arguments);var i=h.findIndex(function(x){return keys.some(function(k){return x.includes(k);});});return i>=0?i:null;};return{name:find("soci","client","nom du client","nom","raison","residence"),address:find("adresse","addr","rue","voie"),cp:find("code postal","postal","cp","zip"),ville:find("ville","commune","localite","city"),nbrCaissons:find("nbr caisson","nbre caisson","caisson","nombre","qte","quantite"),bon:find("bon d","n intervention","ref","numero","bon de commande"),};}

function parseWithMapping(rows,mapping){return rows.map(function(r){var get=function(k){var i=mapping[k];return i!==null&&i!==undefined&&i>=0?String(r[i]||"").trim():"";};return{name:get("name"),address:get("address"),cp:get("cp").replace(/\.0$/,""),ville:get("ville"),nbrCaissons:Math.max(1,parseInt(get("nbrCaissons"))||1),bon:get("bon")};}).filter(function(r){return r.name||r.address;});}

function cKey(n,a){return norm(n)+"||"+norm(a);}
function uid(){return Math.random().toString(36).slice(2);}
function today(){return new Date().toISOString().split("T")[0];}

function fusionner(existing,rows){var seen={},uniq=[],dups=[];rows.forEach(function(r){var k=cKey(r.name,r.address);if(seen[k])dups.push(r);else{seen[k]=true;uniq.push(r);}});var stats={added:0,reactivated:0,alreadyDone:0,pending:0,deactivated:0,dups:dups.length};var updated=existing.map(function(c){var k=cKey(c.name,c.address);var m=uniq.find(function(r){return cKey(r.name,r.address)===k;});var u=m?{cp:m.cp||c.cp,ville:m.ville||c.ville,nbrCaissons:m.nbrCaissons||c.nbrCaissons,bon:m.bon||c.bon}:{};if(seen[k]){if(c.status==="done"){stats.alreadyDone++;return Object.assign({},c,u);}if(c.status==="inactive"){stats.reactivated++;return Object.assign({},c,u,{status:"pending"});}stats.pending++;return Object.assign({},c,u);}else{var had=(c.history||[]).length>0||c.status==="done";if(c.status==="pending"&&!had){stats.deactivated++;return Object.assign({},c,{status:"inactive"});}return c;}});var ex={};updated.forEach(function(c){ex[cKey(c.name,c.address)]=true;});uniq.forEach(function(r){if(!ex[cKey(r.name,r.address)]){updated.push({id:uid(),name:r.name,address:r.address,cp:r.cp||"",ville:r.ville||"",nbrCaissons:r.nbrCaissons||1,bon:r.bon||"",status:"pending",year:new Date().getFullYear(),doneDate:null,history:[]});stats.added++;}});return{clients:updated,stats,total:rows.length};}

function geocodeWithAI(batch){var liste=batch.map(function(c){return{id:c.id,adr:[c.address,c.cp,c.ville].filter(Boolean).join(", ")};});var prompt="Coordonnees GPS France. JSON uniquement: {\"id1\":{\"lat\":43.6,\"lon\":1.44},...}. Adresses: "+JSON.stringify(liste);return fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,messages:[{role:"user",content:prompt}]})}).then(function(res){if(!res.ok)throw new Error("API "+res.status);return res.json();}).then(function(data){var raw=data.content&&data.content.map(function(b){return b.text||"";}).join("").trim();var m=raw.match(/\{[\s\S]*\}/);if(!m)throw new Error("No JSON");return JSON.parse(m[0]);});}

function buildGMapsUrl(slots,clients,coords){var cm={};clients.forEach(function(c){cm[c.id]=c;});var pts=slots.map(function(sl){var c=cm[sl.clientId];if(!c)return null;var p=coords[c.id];return p?p.lat+","+p.lon:c.address+" "+c.ville;}).filter(Boolean);if(!pts.length)return null;if(pts.length===1)return "https://www.google.com/maps/dir/?api=1&destination="+encodeURIComponent(pts[0]);var url="https://www.google.com/maps/dir/?api=1&origin="+encodeURIComponent(pts[0])+"&destination="+encodeURIComponent(pts[pts.length-1]);var wps=pts.slice(1,-1);if(wps.length)url+="&waypoints="+wps.map(encodeURIComponent).join("|");return url+"&travelmode=driving";}

function recalcSlotTimes(slots){var cursor=WS,cumWork=0,pauseDone=false;return slots.map(function(sl){var d=sl.dur;if(!pauseDone&&cumWork>=PAUSE_AT){cursor=cursor-GAP+PAUSE;pauseDone=true;}var s=cursor,e=cursor+d;cursor=e+GAP;cumWork+=d;return Object.assign({},sl,{startClock:fmt(s),endClock:fmt(e),startMin:s,overtime:e>WE});});}

function fmtDate(d){if(!d)return null;var dt=new Date(d);var days=["Dim","Lun","Mar","Mer","Jeu","Ven","Sam"];var months=["jan","fév","mar","avr","mai","juin","juil","août","sep","oct","nov","déc"];return days[dt.getDay()]+" "+dt.getDate()+" "+months[dt.getMonth()];}

function saveSession(data){_token=data.access_token;_userId=data.user&&data.user.id;try{localStorage.setItem("supa_session",JSON.stringify({token:data.access_token,userId:_userId,email:data.user&&data.user.email,expires_at:data.expires_at}));}catch(e){}}
function loadSession(){var s=supa.auth.getSession();if(!s)return false;if(s.expires_at&&new Date(s.expires_at*1000)<new Date())return false;_token=s.token;_userId=s.userId;return true;}

function syncClientsToSupabase(clients,module,userId){if(!userId)return Promise.resolve();var rows=clients.map(function(c){return{id:c.id,user_id:userId,name:c.name,address:c.address,cp:c.cp||"",ville:c.ville||"",nbr_caissons:c.nbrCaissons||1,bon:c.bon||"",status:c.status,year:c.year||new Date().getFullYear(),done_date:c.doneDate||null,history:c.history||[],module};});return supa.from("clients").upsert(rows).catch(function(e){console.error("sync clients",e);});}
function loadClientsFromSupabase(module,userId){if(!userId)return Promise.resolve(null);return supa.from("clients").select("*","&user_id=eq."+userId+"&module=eq."+module).then(function(rows){if(!Array.isArray(rows))return null;return rows.map(function(r){return{id:r.id,name:r.name,address:r.address,cp:r.cp||"",ville:r.ville||"",nbrCaissons:r.nbr_caissons||1,bon:r.bon||"",status:r.status,year:r.year,doneDate:r.done_date,history:r.history||[]};});}).catch(function(e){console.error("load clients",e);return null;});}
function syncArchiveToSupabase(module,year,data,userId){if(!userId)return Promise.resolve();return supa.from("archives").upsert({user_id:userId,module,year,data}).catch(function(e){console.error("sync archive",e);});}

var MODULES={
  vmc:{id:"vmc",label:"VMC",emoji:"💨",accent:"#6366f1",dark:"#4338ca",desc:"Nettoyage ventilation"},
  era:{id:"era",label:"Éradication",emoji:"🐛",accent:"#10b981",dark:"#059669",desc:"Nuisibles",
    interventionTypes:[{id:"init",label:"Initial",min:60},{id:"ctrl",label:"Contrôle",min:30},{id:"choc",label:"Choc",min:45},{id:"fin",label:"Levée",min:20}]},
};

// ── Design Tokens ───────────────────────────────────────────────────────────
var T = {
  bg: "#0f0f13",
  bgCard: "#17171e",
  bgHover: "#1e1e28",
  border: "rgba(255,255,255,0.07)",
  borderHover: "rgba(255,255,255,0.14)",
  text: "#f0f0f5",
  muted: "#8888a0",
  faint: "#44445a",
};

var css = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=DM+Sans:wght@400;500;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: ${T.bg}; font-family: 'DM Sans', sans-serif; color: ${T.text}; }
  ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:.4; } }
  @media print { .no-print { display:none!important; } body { background: white!important; color: #111!important; } .print-card { break-inside:avoid; } }
`;

// ── Reusable Components ─────────────────────────────────────────────────────
function Badge({children, color="#6366f1", size="sm"}) {
  var fs = size === "xs" ? 10 : 11;
  return <span style={{display:"inline-flex",alignItems:"center",background:color+"22",color:color,borderRadius:4,padding:size==="xs"?"1px 5px":"2px 8px",fontSize:fs,fontWeight:600,letterSpacing:"0.02em",lineHeight:1.6}}>{children}</span>;
}

function Btn({children, onClick, variant="primary", size="md", disabled, icon, style:ext}) {
  var variants = {
    primary: {bg:"#6366f1",color:"white",border:"none"},
    secondary: {bg:"#17171e",color:T.text,border:"1px solid rgba(255,255,255,0.1)"},
    ghost: {bg:"transparent",color:T.muted,border:"1px solid rgba(255,255,255,0.07)"},
    danger: {bg:"#ef444420",color:"#ef4444",border:"1px solid #ef444430"},
    success: {bg:"#10b98120",color:"#10b981",border:"1px solid #10b98130"},
  };
  var sizes = {sm:{padding:"5px 12px",fontSize:12},md:{padding:"8px 16px",fontSize:13},lg:{padding:"11px 22px",fontSize:14}};
  var v = variants[variant]||variants.primary, s = sizes[size]||sizes.md;
  return <button onClick={onClick} disabled={disabled} style={Object.assign({},v,s,{borderRadius:8,cursor:disabled?"not-allowed":"pointer",fontFamily:"inherit",fontWeight:600,opacity:disabled?0.4:1,display:"inline-flex",alignItems:"center",gap:6,transition:"all 0.15s",whiteSpace:"nowrap"},ext||{})}
    onMouseEnter={function(e){if(!disabled&&variant!=="primary")e.currentTarget.style.background=T.bgHover;if(!disabled&&variant==="primary")e.currentTarget.style.background="#4f46e5";}}
    onMouseLeave={function(e){e.currentTarget.style.background=v.bg;}}>
    {icon&&<span style={{fontSize:14}}>{icon}</span>}{children}
  </button>;
}

function Card({children, style:ext, padding="16px 20px"}) {
  return <div style={Object.assign({background:T.bgCard,border:"1px solid "+T.border,borderRadius:12,padding},ext||{})}>{children}</div>;
}

function StatCard({label, value, color="#6366f1", icon}) {
  return <Card padding="16px 20px" style={{display:"flex",alignItems:"center",gap:14}}>
    <div style={{width:44,height:44,borderRadius:10,background:color+"18",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{icon}</div>
    <div>
      <div style={{fontSize:11,color:T.muted,fontWeight:500,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:3}}>{label}</div>
      <div style={{fontSize:26,fontWeight:700,color:T.text,lineHeight:1}}>{value}</div>
    </div>
  </Card>;
}

function Input({value, onChange, placeholder, type="text", style:ext}) {
  return <input type={type} value={value} onChange={onChange} placeholder={placeholder}
    style={Object.assign({background:T.bgCard,border:"1px solid "+T.border,borderRadius:8,padding:"8px 12px",fontSize:13,color:T.text,outline:"none",fontFamily:"inherit",width:"100%"},ext||{})}
    onFocus={function(e){e.currentTarget.style.borderColor="rgba(99,102,241,0.5)";}}
    onBlur={function(e){e.currentTarget.style.borderColor=T.border;}}/>;
}

function Select({value, onChange, children, style:ext}) {
  return <select value={value} onChange={onChange}
    style={Object.assign({background:T.bgCard,border:"1px solid "+T.border,borderRadius:8,padding:"7px 10px",fontSize:12,color:T.text,outline:"none",fontFamily:"inherit"},ext||{})}>
    {children}
  </select>;
}

function ProgressBar({value, max, color="#6366f1", height=6}) {
  var pct = max > 0 ? Math.min(100, Math.round(value/max*100)) : 0;
  return <div style={{height,background:"rgba(255,255,255,0.06)",borderRadius:height}}>
    <div style={{height:"100%",width:pct+"%",background:color,borderRadius:height,transition:"width 0.4s ease"}}/>
  </div>;
}

function StatusPill({status}) {
  var map = {pending:{l:"En attente",c:"#f59e0b"},done:{l:"Terminé",c:"#10b981"},inactive:{l:"Inactif",c:"#6b7280"}};
  var s = map[status]||map.inactive;
  return <Badge color={s.c}>{s.l}</Badge>;
}

function Divider({label}) {
  return <div style={{display:"flex",alignItems:"center",gap:10,margin:"8px 0"}}>
    <div style={{flex:1,height:"1px",background:T.border}}/>
    {label&&<span style={{fontSize:10,color:T.muted,fontWeight:500,textTransform:"uppercase",letterSpacing:"0.05em",whiteSpace:"nowrap"}}>{label}</span>}
    {label&&<div style={{flex:1,height:"1px",background:T.border}}/>}
  </div>;
}

// ── Login Screen ────────────────────────────────────────────────────────────
function LoginScreen({onLogin}) {
  var [email,setEmail]=useState("");
  var [pass,setPass]=useState("");
  var [mode,setMode]=useState("login");
  var [loading,setLoading]=useState(false);
  var [err,setErr]=useState("");
  var [msg,setMsg]=useState("");

  var handle=function(){
    if(!email.trim()){setErr("Email requis");return;}
    if(mode!=="reset"&&!pass.trim()){setErr("Mot de passe requis");return;}
    setLoading(true);setErr("");setMsg("");
    if(mode==="reset"){supa.auth.resetPassword(email).then(function(ok){if(ok)setMsg("Email envoyé !");else setErr("Erreur.");}).catch(function(e){setErr(e.message);}).then(function(){setLoading(false);});return;}
    var fn=mode==="login"?supa.auth.signIn:supa.auth.signUp;
    fn(email,pass).then(function(data){
      if(data.error||data.error_description){setErr(data.error_description||data.error||"Erreur");return;}
      if(mode==="signup"&&!data.access_token){setMsg("Vérifiez votre email.");return;}
      saveSession(data);onLogin({email:data.user&&data.user.email,id:data.user&&data.user.id});
    }).catch(function(e){setErr(e.message);}).then(function(){setLoading(false);});
  };

  return <div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
    <div style={{width:"100%",maxWidth:380,animation:"fadeIn 0.4s ease"}}>
      <div style={{textAlign:"center",marginBottom:36}}>
        <div style={{width:56,height:56,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",borderRadius:16,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,color:"white",fontSize:26,margin:"0 auto 16px",boxShadow:"0 8px 32px rgba(99,102,241,0.4)"}}>A</div>
        <div style={{fontWeight:700,fontSize:24,color:T.text,letterSpacing:"-0.02em"}}>AHMP</div>
        <div style={{color:T.muted,fontSize:13,marginTop:4}}>Planification professionnelle</div>
      </div>
      <Card padding="28px 28px">
        <div style={{fontWeight:600,fontSize:16,marginBottom:22,color:T.text}}>{mode==="login"?"Connexion":mode==="signup"?"Créer un compte":"Réinitialiser"}</div>
        <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:20}}>
          <Input value={email} onChange={function(e){setEmail(e.target.value);}} placeholder="Email" type="email"/>
          {mode!=="reset"&&<Input value={pass} onChange={function(e){setPass(e.target.value);}} placeholder="Mot de passe" type="password"/>}
        </div>
        {err&&<div style={{background:"#ef444415",border:"1px solid #ef444430",borderRadius:8,padding:"8px 12px",fontSize:12,color:"#ef4444",marginBottom:12}}>{err}</div>}
        {msg&&<div style={{background:"#10b98115",border:"1px solid #10b98130",borderRadius:8,padding:"8px 12px",fontSize:12,color:"#10b981",marginBottom:12}}>{msg}</div>}
        <button onClick={handle} disabled={loading} style={{width:"100%",background:"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"white",border:"none",borderRadius:9,padding:"12px",fontWeight:700,fontSize:14,cursor:loading?"not-allowed":"pointer",fontFamily:"inherit",opacity:loading?0.7:1,marginBottom:16,boxShadow:"0 4px 16px rgba(99,102,241,0.35)"}}>
          {loading?"…":mode==="login"?"Se connecter":mode==="signup"?"Créer le compte":"Envoyer"}
        </button>
        <div style={{display:"flex",justifyContent:"center",gap:14,fontSize:12}}>
          {mode!=="login"&&<button onClick={function(){setMode("login");setErr("");setMsg("");}} style={{background:"none",border:"none",color:"#6366f1",cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>Connexion</button>}
          {mode!=="signup"&&<button onClick={function(){setMode("signup");setErr("");setMsg("");}} style={{background:"none",border:"none",color:T.muted,cursor:"pointer",fontFamily:"inherit"}}>Créer un compte</button>}
          {mode!=="reset"&&<button onClick={function(){setMode("reset");setErr("");setMsg("");}} style={{background:"none",border:"none",color:T.muted,cursor:"pointer",fontFamily:"inherit"}}>Mot de passe oublié</button>}
        </div>
      </Card>
    </div>
  </div>;
}

// ── Dashboard ───────────────────────────────────────────────────────────────
function Dashboard({clients, planning, currentYear, onImport, onPlan, onNewYear, onCarte}) {
  var p=clients.filter(function(c){return c.status==="pending";}),d=clients.filter(function(c){return c.status==="done";});
  var pct=(p.length+d.length)>0?Math.round(d.length/(p.length+d.length)*100):0;
  var actions=[
    {icon:"📂",label:"Importer",desc:"Fichier Excel",fn:onImport,color:"#6366f1",off:false},
    {icon:"⚡",label:"Générer",desc:p.length+" chantiers en attente",fn:onPlan,color:"#f59e0b",off:p.length===0},
    {icon:"🗺️",label:"Carte",desc:"Visualiser les clients",fn:onCarte,color:"#10b981",off:false},
  ];
  return <div style={{animation:"fadeIn 0.3s ease"}}>
    <div style={{marginBottom:28}}>
      <div style={{fontSize:11,color:"#6366f1",fontWeight:600,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:6}}>Année {currentYear}</div>
      <div style={{fontSize:28,fontWeight:700,color:T.text,letterSpacing:"-0.02em"}}>Tableau de bord</div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:16}}>
      <StatCard label="En attente" value={p.length} color="#f59e0b" icon="⏳"/>
      <StatCard label="Terminés" value={d.length} color="#10b981" icon="✅"/>
      <StatCard label="Inactifs" value={clients.filter(function(c){return c.status==="inactive";}).length} color="#6b7280" icon="💤"/>
    </div>
    {(p.length+d.length)>0&&<Card padding="18px 20px" style={{marginBottom:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <span style={{fontSize:12,color:T.muted,fontWeight:500}}>Progression {currentYear}</span>
        <span style={{fontSize:13,fontWeight:700,color:T.text}}>{d.length}/{p.length+d.length} — {pct}%</span>
      </div>
      <ProgressBar value={d.length} max={p.length+d.length} color="#6366f1"/>
    </Card>}
    {planning&&<Card padding="18px 20px" style={{marginBottom:16,background:"rgba(99,102,241,0.08)",border:"1px solid rgba(99,102,241,0.2)"}}>
      <div style={{fontSize:11,color:"#6366f1",fontWeight:600,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:12}}>Planning actif</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
        {[["Journées",planning.journees.length,"#6366f1"],["Incomplètes",planning.journees.filter(function(j){return j.sousCharge;}).length,"#f59e0b"],["Heures",Math.floor(planning.journees.reduce(function(s,j){return s+j.totalWork;},0)/60)+"h","#10b981"]].map(function(item){return <div key={item[0]}>
          <div style={{fontSize:11,color:T.muted,marginBottom:3}}>{item[0]}</div>
          <div style={{fontSize:22,fontWeight:700,color:item[2]}}>{item[1]}</div>
        </div>;})}
      </div>
    </Card>}
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
      {actions.map(function(a){return <button key={a.label} onClick={a.off?null:a.fn} disabled={a.off}
        style={{background:T.bgCard,border:"1px solid "+T.border,borderRadius:12,padding:"18px 16px",cursor:a.off?"default":"pointer",opacity:a.off?0.4:1,textAlign:"left",transition:"all 0.2s",fontFamily:"inherit"}}
        onMouseEnter={function(e){if(!a.off){e.currentTarget.style.background=T.bgHover;e.currentTarget.style.borderColor=a.color+"40";e.currentTarget.style.transform="translateY(-2px)";}}}
        onMouseLeave={function(e){e.currentTarget.style.background=T.bgCard;e.currentTarget.style.borderColor=T.border;e.currentTarget.style.transform="";}}>
        <div style={{fontSize:24,marginBottom:10}}>{a.icon}</div>
        <div style={{fontWeight:600,fontSize:13,color:T.text,marginBottom:3}}>{a.label}</div>
        <div style={{fontSize:11,color:T.muted}}>{a.desc}</div>
      </button>;})}
    </div>
  </div>;
}

// ── Column Mapper ───────────────────────────────────────────────────────────
var FIELD_LABELS={name:"Nom client",address:"Adresse",cp:"Code postal",ville:"Ville",nbrCaissons:"Nb caissons",bon:"Bon / Réf"};
var FIELD_REQUIRED={name:true,address:true,cp:false,ville:false,nbrCaissons:false,bon:false};

function ColumnMapper({headers, rows, initial, onConfirm, onCancel}) {
  var [mapping,setMapping]=useState(initial);
  var preview=rows.slice(0,3);
  var setField=function(field,val){setMapping(function(m){return Object.assign({},m,{[field]:val===""?null:Number(val)});});};
  var ok=mapping.name!==null&&mapping.name!==undefined;
  return <Card padding="20px">
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:18}}>
      <div>
        <div style={{fontWeight:600,fontSize:15,color:T.text,marginBottom:3}}>Vérifier la détection des colonnes</div>
        <div style={{fontSize:12,color:T.muted}}>{headers.length} colonnes · {rows.length} lignes</div>
      </div>
      <button onClick={onCancel} style={{background:"none",border:"none",cursor:"pointer",color:T.muted,fontSize:18,lineHeight:1}}>×</button>
    </div>
    <div style={{display:"grid",gap:6,marginBottom:16}}>
      {Object.keys(FIELD_LABELS).map(function(field){
        var idx=mapping[field];var detected=idx!==null&&idx!==undefined&&idx>=0;var req=FIELD_REQUIRED[field];
        return <div key={field} style={{display:"grid",gridTemplateColumns:"150px 1fr 1fr",gap:10,alignItems:"center",padding:"8px 12px",borderRadius:8,background:detected?"rgba(16,185,129,0.06)":"rgba(255,255,255,0.02)",border:"1px solid "+(detected?"rgba(16,185,129,0.2)":T.border)}}>
          <div style={{fontSize:12,fontWeight:600,color:T.text,display:"flex",alignItems:"center",gap:6}}>
            {FIELD_LABELS[field]}{req&&<span style={{color:"#ef4444"}}>*</span>}
            {detected?<Badge color="#10b981" size="xs">OK</Badge>:<Badge color={req?"#ef4444":"#6b7280"} size="xs">{req?"requis":"opt."}</Badge>}
          </div>
          <Select value={idx!==null&&idx!==undefined?idx:""} onChange={function(e){setField(field,e.target.value);}}>
            <option value="">— non détecté —</option>
            {headers.map(function(h,i){return <option key={i} value={i}>{h||"(colonne "+(i+1)+")"}</option>;})}
          </Select>
          <div style={{fontSize:11,color:T.muted,fontFamily:"'Inter',monospace",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
            {idx!==null&&idx!==undefined&&idx>=0?preview.map(function(r){return String(r[idx]||"");}).filter(Boolean).slice(0,2).join(" / "):"—"}
          </div>
        </div>;
      })}
    </div>
    <div style={{background:"rgba(255,255,255,0.02)",borderRadius:8,padding:"10px 12px",marginBottom:16,overflowX:"auto"}}>
      <div style={{fontSize:10,color:T.muted,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:8}}>Aperçu</div>
      <table style={{fontSize:11,fontFamily:"'Inter',monospace",borderCollapse:"collapse",width:"100%"}}>
        <thead><tr>{headers.map(function(h,i){return <th key={i} style={{padding:"3px 8px",background:"rgba(255,255,255,0.06)",color:T.text,fontWeight:600,textAlign:"left",whiteSpace:"nowrap",fontSize:11}}>{h||"Col "+(i+1)}</th>;})}</tr></thead>
        <tbody>{preview.map(function(row,ri){return <tr key={ri}>{headers.map(function(h,ci){return <td key={ci} style={{padding:"3px 8px",borderTop:"1px solid "+T.border,color:T.muted,whiteSpace:"nowrap",maxWidth:120,overflow:"hidden",textOverflow:"ellipsis"}}>{String(row[ci]||"")}</td>;})}</tr>;})}</tbody>
      </table>
    </div>
    <div style={{display:"flex",gap:8}}>
      <Btn onClick={function(){onConfirm(mapping);}} variant="primary" disabled={!ok}>Confirmer l'import</Btn>
      <Btn onClick={onCancel} variant="ghost">Annuler</Btn>
    </div>
  </Card>;
}

// ── Import View ─────────────────────────────────────────────────────────────
function ImportView({onConfirm, fileRef, loading, error, result, onDrop, pending, onReset}) {
  return <div style={{animation:"fadeIn 0.3s ease"}}>
    <div style={{marginBottom:22}}>
      <div style={{fontSize:11,color:"#6366f1",fontWeight:600,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:6}}>Import</div>
      <div style={{fontSize:28,fontWeight:700,color:T.text,letterSpacing:"-0.02em"}}>Fichier Excel</div>
    </div>
    {!pending&&<div onDrop={onDrop} onDragOver={function(e){e.preventDefault();}} onClick={function(){fileRef.current.click();}}
      style={{border:"1.5px dashed "+T.border,borderRadius:14,padding:48,textAlign:"center",cursor:"pointer",background:T.bgCard,marginBottom:16,transition:"all 0.2s"}}
      onMouseEnter={function(e){e.currentTarget.style.borderColor="rgba(99,102,241,0.5)";e.currentTarget.style.background=T.bgHover;}}
      onMouseLeave={function(e){e.currentTarget.style.borderColor=T.border;e.currentTarget.style.background=T.bgCard;}}>
      <div style={{fontSize:36,marginBottom:12}}>{loading?"⏳":"📂"}</div>
      <div style={{fontWeight:600,fontSize:15,color:T.text,marginBottom:6}}>{loading?"Lecture en cours…":"Glissez votre fichier ici"}</div>
      <div style={{color:T.muted,fontSize:13}}>ou cliquez · .xlsx .xls .csv</div>
      {error&&<div style={{marginTop:12,color:"#ef4444",fontSize:13,fontWeight:500}}>Erreur : {error}</div>}
    </div>}
    {pending&&<ColumnMapper headers={pending.headers} rows={pending.rows} initial={pending.mapping} onConfirm={onConfirm} onCancel={onReset}/>}
    {result&&!pending&&<Card style={{marginTop:12}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
        <div>
          <div style={{fontSize:11,color:"#10b981",fontWeight:600,letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:3}}>Import terminé</div>
          <div style={{fontSize:14,color:T.text,fontWeight:600}}>{result.total} lignes traitées</div>
        </div>
        <Btn onClick={onReset} variant="ghost" size="sm">Nouvel import</Btn>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
        {[["Nouveaux",result.stats.added,"#10b981"],["Réactivés",result.stats.reactivated,"#6366f1"],["Terminés",result.stats.alreadyDone,"#8b5cf6"],["En attente",result.stats.pending,"#f59e0b"],["Désactivés",result.stats.deactivated,"#ef4444"],["Doublons",result.stats.dups,"#6b7280"]].map(function(item){
          return <div key={item[0]} style={{background:"rgba(255,255,255,0.03)",borderRadius:8,padding:"10px 12px"}}>
            <div style={{fontSize:22,fontWeight:700,color:item[2]}}>{item[1]}</div>
            <div style={{fontSize:11,color:T.muted,marginTop:3}}>{item[0]}</div>
          </div>;
        })}
      </div>
    </Card>}
  </div>;
}

// ── Clients View ─────────────────────────────────────────────────────────────
function ClientsView({clients, setClients}) {
  var [filtre,setFiltre]=useState("pending");
  var [search,setSearch]=useState("");
  var [page,setPage]=useState(0);
  var PER=50;
  var visible=clients.filter(function(c){if(filtre!=="all"&&c.status!==filtre)return false;if(search){var q=norm(search);return norm(c.name).includes(q)||norm(c.address).includes(q)||norm(c.ville||"").includes(q);}return true;});
  var paged=visible.slice(page*PER,(page+1)*PER),pages=Math.ceil(visible.length/PER);
  var setStatus=function(id,st){setClients(function(prev){return prev.map(function(c){return c.id===id?Object.assign({},c,{status:st,doneDate:st==="done"?today():c.doneDate}):c;});});};
  var counts={all:clients.length,pending:clients.filter(function(c){return c.status==="pending";}).length,done:clients.filter(function(c){return c.status==="done";}).length,inactive:clients.filter(function(c){return c.status==="inactive";}).length};
  return <div style={{animation:"fadeIn 0.3s ease"}}>
    <div style={{marginBottom:22}}>
      <div style={{fontSize:11,color:"#6366f1",fontWeight:600,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:6}}>Base de données</div>
      <div style={{fontSize:28,fontWeight:700,color:T.text,letterSpacing:"-0.02em"}}>Clients ({clients.length})</div>
    </div>
    <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
      <div style={{display:"flex",gap:4,background:T.bgCard,padding:3,borderRadius:8,border:"1px solid "+T.border}}>
        {[["pending","En attente"],["done","Terminés"],["inactive","Inactifs"],["all","Tous"]].map(function(item){
          return <button key={item[0]} onClick={function(){setFiltre(item[0]);setPage(0);}}
            style={{border:"none",borderRadius:6,padding:"5px 12px",cursor:"pointer",fontFamily:"inherit",fontWeight:500,fontSize:12,background:filtre===item[0]?"rgba(99,102,241,0.9)":"transparent",color:filtre===item[0]?"white":T.muted,transition:"all 0.15s"}}>
            {item[1]} <span style={{opacity:0.7}}>({counts[item[0]]})</span>
          </button>;
        })}
      </div>
      <Input value={search} onChange={function(e){setSearch(e.target.value);setPage(0);}} placeholder="Rechercher…" style={{marginLeft:"auto",width:200}}/>
    </div>
    <Card padding="0">
      {paged.length===0&&<div style={{padding:48,textAlign:"center",color:T.muted}}>Aucun client</div>}
      {paged.map(function(c,i){
        return <div key={c.id} style={{display:"grid",gridTemplateColumns:"1fr 1fr 110px 100px 90px",padding:"11px 18px",borderBottom:i<paged.length-1?"1px solid "+T.border:"none",alignItems:"center",opacity:c.status!=="pending"?0.6:1,transition:"background 0.15s"}}
          onMouseEnter={function(e){e.currentTarget.style.background=T.bgHover;}}
          onMouseLeave={function(e){e.currentTarget.style.background="";}}>
          <div>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:1}}>
              <span style={{fontWeight:600,fontSize:13,color:T.text}}>{c.name||"—"}</span>
              {c.history&&c.history.length>0&&<Badge color="#6366f1" size="xs">{c.history.length}x</Badge>}
            </div>
            {c.bon&&<div style={{fontSize:10,color:T.muted,fontFamily:"monospace"}}>{c.bon}</div>}
          </div>
          <div style={{fontSize:12,color:T.muted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",paddingRight:8}}>{c.address||"—"}</div>
          <div style={{fontSize:11,color:T.muted}}>{c.ville}</div>
          <StatusPill status={c.status}/>
          <div style={{display:"flex",gap:4}}>
            {c.status==="pending"&&<Btn onClick={function(){setStatus(c.id,"done");}} variant="success" size="sm">✓</Btn>}
            {c.status==="done"&&<Btn onClick={function(){setStatus(c.id,"pending");}} variant="ghost" size="sm">Annuler</Btn>}
            {c.status==="inactive"&&<Btn onClick={function(){setStatus(c.id,"pending");}} variant="ghost" size="sm">Activer</Btn>}
          </div>
        </div>;
      })}
    </Card>
    {pages>1&&<div style={{display:"flex",justifyContent:"center",alignItems:"center",gap:8,marginTop:12}}>
      <Btn onClick={function(){setPage(function(p){return Math.max(0,p-1);});}} variant="ghost" size="sm" disabled={page===0}>←</Btn>
      <span style={{fontSize:12,color:T.muted,fontFamily:"monospace"}}>{page+1} / {pages}</span>
      <Btn onClick={function(){setPage(function(p){return Math.min(pages-1,p+1);});}} variant="ghost" size="sm" disabled={page===pages-1}>→</Btn>
    </div>}
  </div>;
}

// ── Modals Planning ──────────────────────────────────────────────────────────
function SlotEditModal({slot, client, onSave, onClose, onRemove}) {
  var [startH, setStartH] = useState(slot.startClock.split(":")[0]);
  var [startM, setStartM] = useState(slot.startClock.split(":")[1]);
  var [caissons, setCaissons] = useState(slot.nbrCaissons);
  var [name, setName] = useState(client ? client.name : "");
  var [address, setAddress] = useState(client ? client.address : "");
  var [ville, setVille] = useState(client ? client.ville : "");
  var [bon, setBon] = useState(client ? (client.bon||"") : "");

  var handleSave = function() {
    var startMin = parseInt(startH)*60 + parseInt(startM);
    var dur = caissons * JOB;
    var endMin = startMin + dur;
    onSave({
      slot: Object.assign({}, slot, {
        startClock: fmt(startMin), endClock: fmt(endMin),
        startMin: startMin, dur: dur, nbrCaissons: caissons,
        overtime: endMin > WE
      }),
      clientPatch: {name, address, ville, bon}
    });
  };

  var iStyle = {background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:7,padding:"7px 10px",fontSize:13,color:T.text,outline:"none",fontFamily:"inherit",width:"100%"};

  return <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={onClose}>
    <div style={{background:"#1a1a24",border:"1px solid rgba(255,255,255,0.12)",borderRadius:16,padding:24,width:"100%",maxWidth:480,boxShadow:"0 24px 64px rgba(0,0,0,0.6)",animation:"fadeIn 0.2s ease"}} onClick={function(e){e.stopPropagation();}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <div style={{fontWeight:700,fontSize:15,color:T.text}}>Modifier le chantier</div>
        <button onClick={onClose} style={{background:"none",border:"none",color:T.muted,cursor:"pointer",fontSize:20,lineHeight:1}}>×</button>
      </div>
      <div style={{display:"grid",gap:12}}>
        <div>
          <div style={{fontSize:11,color:T.muted,fontWeight:500,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:5}}>Client</div>
          <input value={name} onChange={function(e){setName(e.target.value);}} placeholder="Nom du client" style={iStyle}/>
        </div>
        <div>
          <div style={{fontSize:11,color:T.muted,fontWeight:500,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:5}}>Adresse</div>
          <input value={address} onChange={function(e){setAddress(e.target.value);}} placeholder="Adresse" style={iStyle}/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div>
            <div style={{fontSize:11,color:T.muted,fontWeight:500,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:5}}>Ville</div>
            <input value={ville} onChange={function(e){setVille(e.target.value);}} placeholder="Ville" style={iStyle}/>
          </div>
          <div>
            <div style={{fontSize:11,color:T.muted,fontWeight:500,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:5}}>Bon / Réf</div>
            <input value={bon} onChange={function(e){setBon(e.target.value);}} placeholder="Réf…" style={iStyle}/>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div>
            <div style={{fontSize:11,color:T.muted,fontWeight:500,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:5}}>Heure de début</div>
            <div style={{display:"flex",gap:6,alignItems:"center"}}>
              <input type="number" min="7" max="18" value={startH} onChange={function(e){setStartH(String(e.target.value).padStart(2,"0"));}} style={Object.assign({},iStyle,{width:60,textAlign:"center"})}/>
              <span style={{color:T.muted}}>:</span>
              <select value={startM} onChange={function(e){setStartM(e.target.value);}} style={Object.assign({},iStyle,{width:70})}>
                {["00","15","30","45"].map(function(m){return <option key={m} value={m} style={{background:"#1a1a24"}}>{m}</option>;})}
              </select>
            </div>
          </div>
          <div>
            <div style={{fontSize:11,color:T.muted,fontWeight:500,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:5}}>Nb caissons</div>
            <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
              {[1,2,3,4,5,6].map(function(n){return <button key={n} onClick={function(){setCaissons(n);}} style={{width:34,height:34,borderRadius:7,border:"1px solid "+(caissons===n?"transparent":T.border),cursor:"pointer",fontWeight:600,fontSize:13,background:caissons===n?"#6366f1":"rgba(255,255,255,0.04)",color:caissons===n?"white":T.text,fontFamily:"inherit"}}>{n}</button>;})}
            </div>
          </div>
        </div>
      </div>
      <div style={{display:"flex",gap:8,marginTop:20,justifyContent:"space-between"}}>
        <Btn onClick={onRemove} variant="danger" size="sm">🗑 Retirer</Btn>
        <div style={{display:"flex",gap:8}}>
          <Btn onClick={onClose} variant="ghost" size="sm">Annuler</Btn>
          <Btn onClick={handleSave} variant="primary" size="sm">Sauvegarder</Btn>
        </div>
      </div>
    </div>
  </div>;
}

function AddSlotModal({clients, planning, onAdd, onClose}) {
  var [search, setSearch] = useState("");
  var [selected, setSelected] = useState(null);
  var usedIds = new Set();
  if(planning) planning.journees.forEach(function(j){j.slots.forEach(function(sl){usedIds.add(sl.clientId);});});
  var available = clients.filter(function(c){return c.status==="pending"&&!usedIds.has(c.id);});
  var filtered = search ? available.filter(function(c){var q=norm(search);return norm(c.name).includes(q)||norm(c.ville||"").includes(q);}) : available;

  return <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={onClose}>
    <div style={{background:"#1a1a24",border:"1px solid rgba(255,255,255,0.12)",borderRadius:16,padding:24,width:"100%",maxWidth:480,boxShadow:"0 24px 64px rgba(0,0,0,0.6)",animation:"fadeIn 0.2s ease"}} onClick={function(e){e.stopPropagation();}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div style={{fontWeight:700,fontSize:15,color:T.text}}>Ajouter un chantier</div>
        <button onClick={onClose} style={{background:"none",border:"none",color:T.muted,cursor:"pointer",fontSize:20,lineHeight:1}}>×</button>
      </div>
      <Input value={search} onChange={function(e){setSearch(e.target.value);}} placeholder="Rechercher un client…" style={{marginBottom:12}}/>
      <div style={{maxHeight:280,overflowY:"auto",display:"flex",flexDirection:"column",gap:4}}>
        {filtered.length===0&&<div style={{padding:20,textAlign:"center",color:T.muted,fontSize:13}}>Aucun client disponible</div>}
        {filtered.slice(0,20).map(function(c){
          var isSel=selected&&selected.id===c.id;
          return <div key={c.id} onClick={function(){setSelected(isSel?null:c);}} style={{padding:"9px 12px",borderRadius:8,border:"1px solid "+(isSel?"rgba(99,102,241,0.5)":T.border),background:isSel?"rgba(99,102,241,0.1)":"rgba(255,255,255,0.02)",cursor:"pointer",transition:"all 0.15s"}}>
            <div style={{fontWeight:600,fontSize:13,color:T.text}}>{c.name}</div>
            <div style={{fontSize:11,color:T.muted}}>{c.address} · {c.ville} · {c.nbrCaissons}c</div>
          </div>;
        })}
      </div>
      <div style={{display:"flex",gap:8,marginTop:16,justifyContent:"flex-end"}}>
        <Btn onClick={onClose} variant="ghost" size="sm">Annuler</Btn>
        <Btn onClick={function(){if(selected)onAdd(selected);}} variant="primary" size="sm" disabled={!selected}>Ajouter</Btn>
      </div>
    </div>
  </div>;
}

function SlotRow({slot, client, onCheck, onPartial, onEdit}) {
  var [open,setOpen]=useState(false);
  var [nb,setNb]=useState(slot.nbrCaissons);
  if(!client)return null;
  var total=slot.nbrCaissons;
  var validate=function(){if(nb>=total)onCheck(client.id);else if(onPartial)onPartial(client.id,nb);setOpen(false);};
  return <div style={{marginBottom:4}}>
    <div style={{display:"flex",alignItems:"center",gap:8,padding:"9px 12px",background:open?"rgba(99,102,241,0.08)":slot.overtime?"rgba(239,68,68,0.06)":"rgba(255,255,255,0.03)",borderRadius:open?"8px 8px 0 0":8,border:"1px solid "+(open?"rgba(99,102,241,0.2)":T.border),transition:"all 0.15s"}}>
      <div onClick={function(){setOpen(function(o){return !o;});}} style={{width:22,height:22,border:"1.5px solid "+(open?"#6366f1":T.faint),borderRadius:6,flexShrink:0,background:open?"rgba(99,102,241,0.2)":"",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"#6366f1",fontWeight:700,cursor:"pointer",transition:"all 0.15s"}}>
        {open?"×":"✓"}
      </div>
      <div style={{minWidth:80,textAlign:"right"}}>
        <div style={{fontFamily:"monospace",fontSize:11,fontWeight:600,color:T.text,background:"rgba(255,255,255,0.06)",borderRadius:4,padding:"2px 7px",display:"inline-block"}}>{slot.startClock}</div>
        <div style={{fontFamily:"monospace",fontSize:9,color:T.muted,marginTop:1}}>{slot.endClock}</div>
      </div>
      <div onClick={function(){setOpen(function(o){return !o;});}} style={{flex:1,minWidth:0,cursor:"pointer"}}>
        <div style={{fontWeight:600,fontSize:13,color:T.text}}>{client.name}</div>
        <div style={{fontSize:11,color:T.muted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{client.address}</div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
        {slot.overtime&&<Badge color="#ef4444" size="xs">HS</Badge>}
        <span style={{fontSize:10,color:slot.zoneCol,background:slot.zoneCol+"15",borderRadius:4,padding:"1px 6px",fontWeight:600}}>{slot.nbrCaissons}c · {slot.dur}m</span>
        <button onClick={function(e){e.stopPropagation();onEdit();}} title="Modifier" style={{background:"rgba(255,255,255,0.05)",border:"1px solid "+T.border,borderRadius:5,width:24,height:24,cursor:"pointer",fontSize:11,color:T.muted,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}
          onMouseEnter={function(e){e.currentTarget.style.background="rgba(99,102,241,0.15)";e.currentTarget.style.color="#a5b4fc";}}
          onMouseLeave={function(e){e.currentTarget.style.background="rgba(255,255,255,0.05)";e.currentTarget.style.color=T.muted;}}>✎</button>
      </div>
    </div>
    {open&&<div style={{background:T.bgCard,border:"1px solid rgba(99,102,241,0.2)",borderTop:"none",borderRadius:"0 0 8px 8px",padding:"10px 12px",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
      <span style={{fontSize:12,color:T.muted,fontWeight:500}}>Caissons réalisés :</span>
      <div style={{display:"flex",gap:5}}>
        {Array.from({length:total},function(_,i){return i+1;}).map(function(n){
          return <button key={n} onClick={function(){setNb(n);}} style={{width:30,height:30,borderRadius:6,border:"1px solid "+(nb===n?"transparent":T.border),cursor:"pointer",fontWeight:600,fontSize:13,fontFamily:"inherit",background:nb===n?(n===total?"#10b981":"#f59e0b"):"rgba(255,255,255,0.04)",color:nb===n?"white":T.text,transition:"all 0.15s"}}>{n}</button>;
        })}
      </div>
      <div style={{display:"flex",gap:6,marginLeft:"auto"}}>
        <Btn onClick={validate} variant={nb<total?"secondary":"success"} size="sm">{nb<total?"Valider partiel":"Valider tout"}</Btn>
        <Btn onClick={function(){setOpen(false);}} variant="ghost" size="sm">Annuler</Btn>
      </div>
    </div>}
  </div>;
}

function TechManager({techs, setTechs}) {
  var [newName,setNewName]=useState("");
  var [loading,setLoading]=useState(false);
  var [err,setErr]=useState("");
  var [kizeoToken,setKizeoToken]=useState("");
  useEffect(function(){S.get("kizeo_config").then(function(c){if(c&&c.token)setKizeoToken(c.token);});},[]);
  var add=function(){var n=newName.trim();if(!n)return;setTechs(function(t){return t.concat({id:uid(),name:n});});setNewName("");};
  var remove=function(id){setTechs(function(t){return t.filter(function(x){return x.id!==id;});});};
  var syncKizeo=function(){
    if(!kizeoToken){setErr("Token Kizeo manquant");return;}
    setLoading(true);setErr("");
    fetch("https://forms.kizeo.com/rest/v3/users",{headers:{"Authorization":kizeoToken}}).then(function(r){if(!r.ok)throw new Error("HTTP "+r.status);return r.json();}).then(function(d){
      var kUsers=(d.users||[]).map(function(u){return{id:"kizeo_"+u.id,name:((u.first_name||"")+" "+(u.last_name||"")).trim()||u.login,kizeoId:u.id};});
      setTechs(function(prev){var existing={};prev.forEach(function(t){existing[t.id]=true;});return prev.concat(kUsers.filter(function(u){return !existing[u.id];}));});
    }).catch(function(e){setErr("Erreur Kizeo: "+e.message);}).then(function(){setLoading(false);});
  };
  return <Card padding="14px 16px" style={{marginBottom:10}}>
    <div style={{fontWeight:600,fontSize:12,color:T.muted,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:10}}>Techniciens</div>
    <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap"}}>
      <Input value={newName} onChange={function(e){setNewName(e.target.value);}} onKeyDown={function(e){if(e.key==="Enter")add();}} placeholder="Nom du technicien…" style={{flex:1,minWidth:140}}/>
      <Btn onClick={add} variant="secondary" size="sm" disabled={!newName.trim()}>+ Ajouter</Btn>
      <Btn onClick={syncKizeo} variant="ghost" size="sm" disabled={loading}>{loading?"…":"Sync Kizeo"}</Btn>
    </div>
    {err&&<div style={{fontSize:11,color:"#ef4444",marginBottom:8}}>{err}</div>}
    {techs.length>0&&<div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
      {techs.map(function(t){return <div key={t.id} style={{display:"flex",alignItems:"center",gap:6,background:"rgba(255,255,255,0.04)",border:"1px solid "+T.border,borderRadius:7,padding:"4px 10px",fontSize:12,fontWeight:500,color:T.text}}>
        <div style={{width:22,height:22,borderRadius:"50%",background:"rgba(99,102,241,0.2)",color:"#6366f1",display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,flexShrink:0}}>{t.name.charAt(0).toUpperCase()}</div>
        {t.name}
        {t.kizeoId&&<Badge color="#10b981" size="xs">K</Badge>}
        <button onClick={function(){remove(t.id);}} style={{background:"none",border:"none",cursor:"pointer",color:T.faint,fontSize:14,lineHeight:1,padding:0,marginLeft:2}}>×</button>
      </div>;})}
    </div>}
    {techs.length===0&&<div style={{fontSize:12,color:T.muted}}>Aucun technicien</div>}
  </Card>;
}

function GpsButton({journee, clients}) {
  var [coords,setCoords]=useState({});
  var [open,setOpen]=useState(false);
  useEffect(function(){S.get(GEOCODE_KEY).then(function(c){if(c)setCoords(c);});},[]);
  var has=journee.slots.some(function(sl){var c=clients.find(function(cl){return cl.id===sl.clientId;});return c&&coords[c.id];});
  if(!has)return null;
  return <div style={{position:"relative"}}>
    <Btn onClick={function(){setOpen(function(o){return !o;});}} variant="ghost" size="sm" className="no-print">GPS</Btn>
    {open&&<div style={{position:"absolute",top:"110%",right:0,background:T.bgCard,borderRadius:10,boxShadow:"0 8px 32px rgba(0,0,0,0.4)",border:"1px solid "+T.border,zIndex:50,minWidth:160,overflow:"hidden"}}>
      <button onClick={function(){var u=buildGMapsUrl(journee.slots,clients,coords);if(u)window.open(u,"_blank");setOpen(false);}} style={{display:"block",width:"100%",padding:"11px 14px",border:"none",background:"transparent",cursor:"pointer",fontSize:13,fontFamily:"inherit",borderBottom:"1px solid "+T.border,textAlign:"left",color:T.text}}
        onMouseEnter={function(e){e.currentTarget.style.background=T.bgHover;}} onMouseLeave={function(e){e.currentTarget.style.background="transparent";}}>Google Maps</button>
      <button onClick={function(){setOpen(false);}} style={{display:"block",width:"100%",padding:"7px",border:"none",background:"transparent",cursor:"pointer",fontSize:11,color:T.muted,fontFamily:"inherit"}}>Fermer</button>
    </div>}
  </div>;
}

function PlanningView({clients, setClients, planning, setPlanning, otMin, setOtMin, onGenerate, onCheck, onPartial, techs, setTechs, journeeDates, setJourneeDate}) {
  var cMap={};clients.forEach(function(c){cMap[c.id]=c;});
  var pending=clients.filter(function(c){return c.status==="pending";}).length;
  var [filtre,setFiltre]=useState("all");
  var [dragSrc,setDragSrc]=useState(null);
  var [dragOver,setDragOver]=useState(null);
  var [ghostPos,setGhostPos]=useState({x:0,y:0});
  var dragSrcRef=useRef(null);
  var dragOverRef=useRef(null);
  var [editModal,setEditModal]=useState(null); // {slot, jId, sIdx}
  var [addModal,setAddModal]=useState(null);   // jId
  var [collapsed,setCollapsed]=useState({});

  var updatePlanning = function(fn) { setPlanning(function(prev){ if(!prev)return null; var next=fn(prev); return next; }); };

  var rebuildJournee = function(journees) {
    return journees.filter(function(j){return j.slots.length>0;}).map(function(j,i){
      var slots=recalcSlotTimes(j.slots);
      var tw=slots.reduce(function(s,sl){return s+sl.dur;},0);
      var last=slots[slots.length-1];
      var zones=[];slots.forEach(function(s){if(zones.indexOf(s.zoneName)<0)zones.push(s.zoneName);});
      return Object.assign({},j,{num:i+1,slots:slots,totalWork:tw,finHeure:last?last.endClock:"16:00",sousCharge:tw<MIN_WORK,overtime:slots.some(function(sl){return sl.overtime;}),zonesLabel:zones.slice(0,3).join(" · ")});
    });
  };

  var commitDrop=function(src,toJId,toSIdx){
    if(!src||!planning)return;
    updatePlanning(function(prev){
      var newJ=prev.journees.map(function(j){return Object.assign({},j,{slots:j.slots.slice()});});
      var fromJ=newJ.find(function(j){return j.id===src.jId;}),toJ=newJ.find(function(j){return j.id===toJId;});
      if(!fromJ||!toJ)return prev;
      var realToIdx=(src.jId===toJId&&src.sIdx<toSIdx)?toSIdx-1:toSIdx;
      var moved=fromJ.slots.splice(src.sIdx,1)[0];
      if(!moved)return prev;
      toJ.slots.splice(realToIdx,0,moved);
      return Object.assign({},prev,{journees:rebuildJournee(newJ)});
    });
  };

  // Supprimer un slot du planning (remet le client en pending)
  var removeSlot = function(jId, sIdx) {
    updatePlanning(function(prev){
      var newJ=prev.journees.map(function(j){
        if(j.id!==jId)return j;
        var slots=j.slots.filter(function(_,i){return i!==sIdx;});
        return Object.assign({},j,{slots:slots});
      });
      return Object.assign({},prev,{journees:rebuildJournee(newJ)});
    });
  };

  // Sauvegarder les modifs d'un slot (heure, caissons, infos client)
  var saveSlotEdit = function(jId, sIdx, slotPatch, clientPatch) {
    // Mettre à jour le slot dans le planning
    updatePlanning(function(prev){
      var newJ=prev.journees.map(function(j){
        if(j.id!==jId)return j;
        var slots=j.slots.map(function(sl,i){return i===sIdx?Object.assign({},sl,slotPatch):sl;});
        return Object.assign({},j,{slots:slots});
      });
      return Object.assign({},prev,{journees:rebuildJournee(newJ)});
    });
    // Mettre à jour le client (nom, adresse, ville, bon)
    if(clientPatch && slotPatch && slotPatch.clientId) {
      setClients(function(prev){
        return prev.map(function(c){
          return c.id===slotPatch.clientId ? Object.assign({},c,clientPatch) : c;
        });
      });
    } else if(clientPatch) {
      // Trouver le clientId depuis le slot original
      var j = planning.journees.find(function(j){return j.id===jId;});
      if(j && j.slots[sIdx]) {
        var cid = j.slots[sIdx].clientId;
        setClients(function(prev){
          return prev.map(function(c){
            return c.id===cid ? Object.assign({},c,clientPatch) : c;
          });
        });
      }
    }
    setEditModal(null);
  };

  // Ajouter un client existant à une journée
  var addClientToJournee = function(jId, client) {
    updatePlanning(function(prev){
      var newJ=prev.journees.map(function(j){
        if(j.id!==jId)return j;
        var newSlot={clientId:client.id,startClock:"08:30",endClock:"09:00",startMin:WS,dur:(client.nbrCaissons||1)*JOB,nbrCaissons:client.nbrCaissons||1,overtime:false,zoneName:client.ville||"Toulouse",zoneCol:getZone(client.cp,client.ville,client.id,null).col};
        return Object.assign({},j,{slots:j.slots.concat([newSlot])});
      });
      return Object.assign({},prev,{journees:rebuildJournee(newJ)});
    });
    setAddModal(null);
  };

  // Créer une journée vide
  var addJournee = function() {
    updatePlanning(function(prev){
      var newJournee={id:uid(),num:(prev.journees.length+1),slots:[],totalWork:0,travelMin:0,zonesLabel:"Nouvelle journée",zoneColor:"#6366f1",departTime:null,breakAt:null,overtime:false,sousCharge:true,finHeure:"16:00",multiZone:false};
      return Object.assign({},prev,{journees:prev.journees.concat([newJournee])});
    });
  };

  // Supprimer une journée entière
  var deleteJournee = function(jId) {
    updatePlanning(function(prev){
      var newJ=prev.journees.filter(function(j){return j.id!==jId;}).map(function(j,i){return Object.assign({},j,{num:i+1});});
      return Object.assign({},prev,{journees:newJ});
    });
  };

  // Changer le technicien d'une journée
  var setTechForJournee = function(jId, techId) {
    updatePlanning(function(prev){
      return Object.assign({},prev,{journees:prev.journees.map(function(j){
        if(j.id!==jId)return j;
        var tech=(techs||[]).find(function(t){return t.id===techId;});
        return Object.assign({},j,{techId:techId,techName:tech?tech.name:""});
      })});
    });
  };

  var toggleCollapse = function(jId) {
    setCollapsed(function(prev){ return Object.assign({},prev,{[jId]:!prev[jId]}); });
  };

  var renderSlot=function(sl,absIdx,j){
    var c=cMap[sl.clientId];
    var isDragging=dragSrc&&dragSrc.jId===j.id&&dragSrc.sIdx===absIdx;
    var isOver=dragOver&&dragOver.jId===j.id&&dragOver.sIdx===absIdx;
    var showLine=isOver&&dragSrc&&!(dragSrc.jId===j.id&&dragSrc.sIdx===absIdx);
    var onHandleMouseDown=function(e){
      e.preventDefault();
      var src={jId:j.id,sIdx:absIdx,clientId:sl.clientId,label:c?c.name:"RDV"};
      dragSrcRef.current=src;dragOverRef.current=null;setDragSrc(src);setGhostPos({x:e.clientX+12,y:e.clientY-16});
      var onMove=function(ev){setGhostPos({x:ev.clientX+12,y:ev.clientY-16});};
      var onUp=function(){window.removeEventListener("mousemove",onMove);window.removeEventListener("mouseup",onUp);var over=dragOverRef.current;if(over&&dragSrcRef.current)commitDrop(dragSrcRef.current,over.jId,over.sIdx);dragSrcRef.current=null;dragOverRef.current=null;setDragSrc(null);setDragOver(null);};
      window.addEventListener("mousemove",onMove);window.addEventListener("mouseup",onUp);
    };
    return <div key={j.id+"-"+absIdx} style={{position:"relative"}}
      onMouseEnter={function(){if(dragSrcRef.current){dragOverRef.current={jId:j.id,sIdx:absIdx};setDragOver({jId:j.id,sIdx:absIdx});}}}
      onMouseLeave={function(){if(dragSrcRef.current&&dragOverRef.current&&dragOverRef.current.jId===j.id&&dragOverRef.current.sIdx===absIdx){dragOverRef.current=null;setDragOver(null);}}}>
      {showLine&&<div style={{height:3,background:"#6366f1",borderRadius:2,margin:"3px 0",zIndex:10,boxShadow:"0 0 8px rgba(99,102,241,0.6)"}}/>}
      <div style={{display:"flex",alignItems:"stretch",opacity:isDragging?0.2:1,transition:"opacity .15s",marginBottom:2}}>
        <div onMouseDown={onHandleMouseDown} style={{display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"center",gap:3,padding:"0 8px",cursor:"grab",borderRadius:"8px 0 0 8px",background:"rgba(255,255,255,0.03)",flexShrink:0,userSelect:"none",border:"1px solid "+T.border,borderRight:"none"}}
          onMouseEnter={function(e){e.currentTarget.style.background="rgba(99,102,241,0.08)";}}
          onMouseLeave={function(e){e.currentTarget.style.background="rgba(255,255,255,0.03)";}}>
          {[0,1,2].map(function(i){return <div key={i} style={{display:"flex",gap:2}}>{[0,1].map(function(k){return <div key={k} style={{width:3,height:3,borderRadius:"50%",background:T.faint}}/>;})}</div>;})}
        </div>
        <div style={{flex:1,minWidth:0}}>
          <SlotRow slot={sl} client={c} onCheck={onCheck} onPartial={onPartial} onEdit={function(){setEditModal({slot:sl,jId:j.id,sIdx:absIdx,client:c});}}/>
        </div>
      </div>
    </div>;
  };

  var jours=(planning?planning.journees:[]).filter(function(j){if(filtre==="incomplet")return j.sousCharge;if(filtre==="overtime")return j.overtime;return true;});
  var JOUR_COLORS=["#6366f1","#8b5cf6","#06b6d4","#10b981","#f59e0b","#f97316","#ef4444","#ec4899"];

  return <div style={{animation:"fadeIn 0.3s ease"}}>
    {editModal&&<SlotEditModal
      slot={editModal.slot} client={editModal.client}
      onSave={function(res){
        // patch client
        if(res.clientPatch&&editModal.client){
          var cp=res.clientPatch;
          setPlanning(function(prev){
            var newClients=null; // we'll update via parent later
            return prev;
          });
          // Direct update via clients setter passed down would be ideal; here we patch the slot zoneName
        }
        saveSlotEdit(editModal.jId, editModal.sIdx, res.slot, res.clientPatch);
      }}
      onClose={function(){setEditModal(null);}}
      onRemove={function(){removeSlot(editModal.jId, editModal.sIdx);setEditModal(null);}}
    />}
    {addModal&&<AddSlotModal
      clients={clients} planning={planning}
      onAdd={function(client){addClientToJournee(addModal,client);}}
      onClose={function(){setAddModal(null);}}
    />}
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:22}}>
      <div>
        <div style={{fontSize:11,color:"#6366f1",fontWeight:600,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:6}}>Planification</div>
        <div style={{fontSize:28,fontWeight:700,color:T.text,letterSpacing:"-0.02em"}}>Planning</div>
        {planning&&<div style={{fontSize:13,color:T.muted,marginTop:4}}>{planning.journees.length} journées · {planning.journees.reduce(function(s,j){return s+j.slots.length;},0)} chantiers</div>}
      </div>
      <div style={{display:"flex",gap:8}}>
        {planning&&<Btn onClick={addJournee} variant="secondary" size="sm">+ Journée vide</Btn>}
        {planning&&<Btn onClick={function(){window.print();}} variant="ghost" size="sm" className="no-print">Imprimer</Btn>}
      </div>
    </div>
    <TechManager techs={techs||[]} setTechs={setTechs}/>
    <Card padding="16px 18px" style={{marginBottom:10}}>
      <div style={{fontSize:11,color:T.muted,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:10}}>Dates de tournée</div>
      <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
        <span style={{fontSize:12,color:T.muted}}>Début :</span>
        <input type="date" id="startDatePicker" style={{background:T.bgCard,border:"1px solid "+T.border,borderRadius:7,padding:"5px 10px",fontSize:12,color:T.text,outline:"none",fontFamily:"monospace"}}/>
        <Btn variant="ghost" size="sm" onClick={function(){var sd=document.getElementById("startDatePicker").value;if(!sd||!planning)return;var dt=new Date(sd),newDates={};planning.journees.forEach(function(j){while(dt.getDay()===0||dt.getDay()===6){dt.setDate(dt.getDate()+1);}newDates[j.id]=dt.toISOString().split("T")[0];dt.setDate(dt.getDate()+1);});planning.journees.forEach(function(j){setJourneeDate(j.id,newDates[j.id]);});}}>Remplir (jours ouvrables)</Btn>
        <Btn variant="ghost" size="sm" onClick={function(){if(planning)planning.journees.forEach(function(j){setJourneeDate(j.id,"");});}}>Effacer</Btn>
      </div>
    </Card>
    <Card padding="16px 18px" style={{marginBottom:14}}>
      <div style={{display:"flex",alignItems:"center",gap:18,flexWrap:"wrap"}}>
        <div style={{flex:1,minWidth:200}}>
          <div style={{fontSize:12,color:T.muted,marginBottom:8}}>Heures supp. : <strong style={{color:"#f59e0b"}}>{otMin>0?"+"+otMin+"min":"Aucune"}</strong></div>
          <input type="range" min={0} max={90} step={15} value={otMin} onChange={function(e){setOtMin(Number(e.target.value));}} style={{width:"100%",accentColor:"#6366f1"}}/>
          <div style={{fontSize:10,color:T.faint,marginTop:4}}>Sur site 08:30 → Fin 16:{String(otMin).padStart(2,"0")}</div>
        </div>
        <Btn onClick={onGenerate} variant="primary" size="lg" disabled={pending===0} style={{boxShadow:"0 4px 16px rgba(99,102,241,0.35)"}}>Générer ({pending})</Btn>
      </div>
    </Card>
    {planning&&planning.casAPart&&planning.casAPart.length>0&&<Card padding="14px 16px" style={{marginBottom:12,border:"1px solid rgba(245,158,11,0.3)",background:"rgba(245,158,11,0.06)"}}>
      <div style={{fontSize:10,color:"#f59e0b",fontWeight:600,letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:8}}>Cas à part (trop éloignés)</div>
      {planning.casAPart.map(function(c){return <div key={c.id} style={{padding:"7px 10px",background:"rgba(245,158,11,0.08)",borderRadius:8,marginBottom:4,fontSize:13,color:T.text}}><strong>{c.name}</strong> — {c.address}</div>;})}
    </Card>}
    {!planning&&<Card padding="48px" style={{textAlign:"center"}}>
      <div style={{fontSize:48,marginBottom:14}}>⚡</div>
      <div style={{fontWeight:600,fontSize:17,color:T.text,marginBottom:6}}>Prêt à générer</div>
      <div style={{color:T.muted,fontSize:13}}>Importez un Excel puis cliquez sur Générer</div>
    </Card>}
    {planning&&<div>
      {dragSrc&&<div style={{position:"fixed",left:ghostPos.x,top:ghostPos.y,zIndex:9999,pointerEvents:"none",background:"#6366f1",color:"white",borderRadius:8,padding:"6px 12px",fontSize:12,fontWeight:600,fontFamily:"monospace",boxShadow:"0 4px 20px rgba(99,102,241,0.5)",whiteSpace:"nowrap",transform:"rotate(-2deg)"}}>✋ {dragSrc.label}</div>}
      <div style={{display:"flex",gap:5,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
        {[["all","Toutes"],["incomplet","Incomplètes"],["overtime","Heures supp"]].map(function(item){
          return <button key={item[0]} onClick={function(){setFiltre(item[0]);}} style={{border:"1px solid "+(filtre===item[0]?"rgba(99,102,241,0.5)":T.border),borderRadius:7,padding:"5px 12px",cursor:"pointer",fontFamily:"inherit",fontWeight:500,fontSize:12,background:filtre===item[0]?"rgba(99,102,241,0.15)":T.bgCard,color:filtre===item[0]?"#a5b4fc":T.muted}}>
            {item[1]}
          </button>;
        })}
        <span style={{marginLeft:"auto",fontSize:12,color:T.muted}}>
          {jours.length} journée{jours.length>1?"s":""} · {jours.reduce(function(s,j){return s+j.slots.length;},0)} chantiers
        </span>
      </div>
      {jours.map(function(j,ji){
        var color=JOUR_COLORS[ji%JOUR_COLORS.length];
        var tw=j.totalWork,hh=Math.floor(tw/60),mm=String(tw%60).padStart(2,"0");
        var nbc=j.slots.reduce(function(s,sl){return s+sl.nbrCaissons;},0);
        var cumW=0,pIdx=j.slots.length;
        for(var k=0;k<j.slots.length;k++){cumW+=j.slots[k].dur;if(cumW>=PAUSE_AT&&pIdx===j.slots.length){pIdx=k+1;break;}}
        var avant=j.slots.slice(0,pIdx),apres=j.slots.slice(pIdx);
        var isCollapsed=collapsed[j.id];
        return <div key={j.id||ji} className="print-card" style={{background:T.bgCard,border:"1px solid "+T.border,borderRadius:14,marginBottom:10,overflow:"hidden"}}>
          {/* Header de la journée */}
          <div style={{padding:"14px 18px",borderBottom:isCollapsed?"none":"1px solid "+T.border,background:"rgba(255,255,255,0.02)"}}>
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:10}}>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,flexWrap:"wrap"}}>
                  <div style={{width:3,height:24,background:color,borderRadius:2,flexShrink:0}}/>
                  <span style={{fontWeight:700,fontSize:14,color:T.text}}>Journée {j.num}</span>
                  {j.sousCharge&&<Badge color="#f59e0b">Incomplet {hh}h{mm}/7h</Badge>}
                  {j.overtime&&<Badge color="#ef4444">Heures supp.</Badge>}
                  <input type="date" value={journeeDates&&journeeDates[j.id]||""} onChange={function(e){setJourneeDate(j.id,e.target.value);}}
                    style={{background:"rgba(255,255,255,0.06)",border:"1px solid "+T.border,borderRadius:6,padding:"2px 8px",fontSize:11,color:T.text,fontFamily:"monospace",outline:"none"}}/>
                  {journeeDates&&journeeDates[j.id]&&<Badge color={color}>{fmtDate(journeeDates[j.id])}</Badge>}
                </div>
                <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                  {/* Technicien */}
                  <select value={j.techId||""} onChange={function(e){setTechForJournee(j.id,e.target.value);}}
                    style={{background:"rgba(255,255,255,0.06)",border:"1px solid "+T.border,borderRadius:6,padding:"4px 10px",fontSize:12,color:T.text,fontFamily:"inherit",outline:"none",maxWidth:180}}>
                    <option value="" style={{background:"#1e1e28"}}>— Technicien —</option>
                    {(techs||[]).map(function(t){return <option key={t.id} value={t.id} style={{background:"#1e1e28"}}>{t.name}</option>;})}
                  </select>
                  {j.techName&&<span style={{fontSize:12,color:color,fontWeight:500}}>👤 {j.techName}</span>}
                  <span style={{fontSize:12,color:T.muted}}>{j.zonesLabel}</span>
                </div>
                <div style={{fontSize:11,color:T.muted,marginTop:6,fontFamily:"monospace"}}>
                  {j.slots.length} chantiers · {nbc} caissons · <strong style={{color:j.sousCharge?"#f59e0b":T.text}}>{hh}h{mm}</strong> · fin {j.finHeure}
                  {j.departTime&&<> · départ {j.departTime}</>}
                </div>
              </div>
              <div style={{display:"flex",gap:5,flexShrink:0,alignItems:"center"}}>
                <GpsButton journee={j} clients={clients}/>
                <Btn onClick={function(){setAddModal(j.id);}} variant="secondary" size="sm" title="Ajouter un chantier">+ Chantier</Btn>
                <button onClick={function(){toggleCollapse(j.id);}} title={isCollapsed?"Déplier":"Replier"} style={{background:"rgba(255,255,255,0.05)",border:"1px solid "+T.border,borderRadius:6,width:28,height:28,cursor:"pointer",color:T.muted,fontSize:13,display:"flex",alignItems:"center",justifyContent:"center"}}>
                  {isCollapsed?"▼":"▲"}
                </button>
                <button onClick={function(){if(window.confirm("Supprimer la journée "+j.num+" ?"))deleteJournee(j.id);}} title="Supprimer la journée" style={{background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:6,width:28,height:28,cursor:"pointer",color:"#ef4444",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center"}}>🗑</button>
              </div>
            </div>
          </div>
          {/* Slots */}
          {!isCollapsed&&<div style={{padding:"12px 16px 14px"}}>
            {j.slots.length===0&&<div style={{padding:"20px",textAlign:"center",color:T.muted,fontSize:13,border:"1.5px dashed "+T.border,borderRadius:8}}>
              Journée vide — <button onClick={function(){setAddModal(j.id);}} style={{background:"none",border:"none",color:"#6366f1",cursor:"pointer",fontFamily:"inherit",fontWeight:600,fontSize:13}}>Ajouter un chantier</button>
            </div>}
            {avant.length>0&&<div>{avant.map(function(sl,si){return renderSlot(sl,si,j);})}</div>}
            {j.breakAt&&j.slots.length>0&&<Divider label={"Pause · "+j.breakAt}/>}
            {apres.length>0&&<div>{apres.map(function(sl,si){return renderSlot(sl,pIdx+si,j);})}</div>}
            {avant.length===0&&apres.length===0&&j.slots.length>0&&j.slots.map(function(sl,si){return renderSlot(sl,si,j);})}
            {dragSrc&&dragSrc.jId!==j.id&&<div
              onMouseEnter={function(){if(dragSrcRef.current){var s=j.slots.length;dragOverRef.current={jId:j.id,sIdx:s};setDragOver({jId:j.id,sIdx:s});}}}
              onMouseLeave={function(){if(dragSrcRef.current){dragOverRef.current=null;setDragOver(null);}}}
              style={{height:40,borderRadius:8,border:"1.5px dashed "+(dragOver&&dragOver.jId===j.id?"#6366f1":T.border),display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:dragOver&&dragOver.jId===j.id?"#6366f1":T.muted,fontWeight:500,marginTop:8,transition:"all .15s",background:dragOver&&dragOver.jId===j.id?"rgba(99,102,241,0.06)":"transparent"}}>
              {dragOver&&dragOver.jId===j.id?"Déposer ici":"Changer de journée"}
            </div>}
            {/* Bouton ajouter en bas */}
            <button onClick={function(){setAddModal(j.id);}} style={{width:"100%",marginTop:8,padding:"7px",background:"transparent",border:"1px dashed "+T.border,borderRadius:8,cursor:"pointer",fontSize:12,color:T.muted,fontFamily:"inherit",transition:"all 0.15s"}}
              onMouseEnter={function(e){e.currentTarget.style.borderColor="rgba(99,102,241,0.4)";e.currentTarget.style.color="#a5b4fc";}}
              onMouseLeave={function(e){e.currentTarget.style.borderColor=T.border;e.currentTarget.style.color=T.muted;}}>
              + Ajouter un chantier
            </button>
          </div>}
        </div>;
      })}
      {/* Bouton créer nouvelle journée */}
      <button onClick={addJournee} style={{width:"100%",padding:"12px",background:"transparent",border:"1.5px dashed "+T.border,borderRadius:12,cursor:"pointer",fontSize:13,color:T.muted,fontFamily:"inherit",fontWeight:500,transition:"all 0.15s",marginTop:4}}
        onMouseEnter={function(e){e.currentTarget.style.borderColor="rgba(99,102,241,0.4)";e.currentTarget.style.color="#a5b4fc";}}
        onMouseLeave={function(e){e.currentTarget.style.borderColor=T.border;e.currentTarget.style.color=T.muted;}}>
        + Créer une nouvelle journée
      </button>
    </div>}
  </div>;
}

// ── Map View ──────────────────────────────────────────────────────────────────
var TILE=256;
function ll2px(lat,lon,zoom){var n=Math.pow(2,zoom),x=((lon+180)/360)*n*TILE,s=Math.sin(lat*Math.PI/180),y=((1-Math.log((1+s)/(1-s))/(2*Math.PI))/2)*n*TILE;return{x,y};}
var RCOLS=["#6366f1","#8b5cf6","#06b6d4","#10b981","#f59e0b","#f97316","#ef4444","#ec4899"];

function CarteView({clients, planning}) {
  var W=820,H=500;
  var [coords,setCoords]=useState({});
  var [loading,setLoading]=useState(false);
  var [prog,setProg]=useState({done:0,total:0});
  var [filtre,setFiltre]=useState("all");
  var [sel,setSel]=useState(null);
  var [view,setView]=useState({lat:43.6,lon:1.44,zoom:11});
  var [showRoutes,setShowRoutes]=useState(false);
  var [selJour,setSelJour]=useState(null);
  var dragging=useRef(false),lastMouse=useRef(null),wheelAccum=useRef(0);
  var COL={pending:"#f59e0b",done:"#10b981",inactive:"#6b7280"};
  useEffect(function(){S.get(GEOCODE_KEY).then(function(c){if(c)setCoords(c);});},[]);
  var handleGeocode=function(){
    var todo=clients.filter(function(c){return !coords[c.id]&&(c.address||c.ville);});
    if(!todo.length)return;
    setLoading(true);
    var nc=Object.assign({},coords);
    var doNext=function(i){
      if(i>=todo.length){setCoords(Object.assign({},nc));S.set(GEOCODE_KEY,nc);setProg({done:todo.length,total:todo.length});setLoading(false);handleFit();return;}
      var batch=todo.slice(i,i+50);setProg({done:i,total:todo.length});
      geocodeWithAI(batch).then(function(res){Object.assign(nc,res);setCoords(Object.assign({},nc));S.set(GEOCODE_KEY,nc);}).catch(function(e){console.error(e);}).then(function(){setTimeout(function(){doNext(i+50);},500);});
    };doNext(0);
  };
  var handleFit=function(){
    var pts=clients.filter(function(c){return coords[c.id]&&!isNaN(coords[c.id].lat);});
    if(!pts.length)return;
    var laMin=Infinity,laMax=-Infinity,loMin=Infinity,loMax=-Infinity;
    pts.forEach(function(c){var lat=coords[c.id].lat,lon=coords[c.id].lon;if(lat<laMin)laMin=lat;if(lat>laMax)laMax=lat;if(lon<loMin)loMin=lon;if(lon>loMax)loMax=lon;});
    var zoom=11;for(var z=13;z>=7;z--){var p1=ll2px(laMin,loMin,z),p2=ll2px(laMax,loMax,z);if(Math.abs(p2.x-p1.x)<W*0.8&&Math.abs(p1.y-p2.y)<H*0.8){zoom=z;break;}}
    setView({lat:(laMin+laMax)/2,lon:(loMin+loMax)/2,zoom});setSel(null);
  };
  var cp=ll2px(view.lat,view.lon,view.zoom),ox=cp.x-W/2,oy=cp.y-H/2;
  var tiles=React.useMemo(function(){
    var n=Math.pow(2,view.zoom),t=[];
    for(var tx=Math.floor(ox/TILE);tx<=Math.ceil((ox+W)/TILE);tx++){for(var ty=Math.floor(oy/TILE);ty<=Math.ceil((oy+H)/TILE);ty++){if(tx<0||ty<0||tx>=n||ty>=n)continue;var sub=["a","b","c"][(tx+ty)%3];t.push({key:view.zoom+"/"+tx+"/"+ty,url:"https://"+sub+".tile.openstreetmap.org/"+view.zoom+"/"+tx+"/"+ty+".png",left:tx*TILE-ox,top:ty*TILE-oy});}}return t;
  },[view.zoom,Math.round(ox),Math.round(oy)]);
  var toXY=function(lat,lon){var p=ll2px(lat,lon,view.zoom);return{x:p.x-ox,y:p.y-oy};};
  var geocoded=clients.filter(function(c){return coords[c.id];}).length;
  var missing=clients.filter(function(c){return !coords[c.id];}).length;
  var visible=clients.filter(function(c){return coords[c.id]&&!isNaN(coords[c.id].lat)&&(filtre==="all"||c.status===filtre);});
  var pct=prog.total>0?Math.round(prog.done/prog.total*100):0;
  return <div style={{animation:"fadeIn 0.3s ease"}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
      <div>
        <div style={{fontSize:11,color:"#6366f1",fontWeight:600,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:6}}>Géolocalisation</div>
        <div style={{fontSize:28,fontWeight:700,color:T.text,letterSpacing:"-0.02em"}}>Carte</div>
        <div style={{fontSize:13,color:T.muted,marginTop:4}}>{geocoded} géolocalisés · {missing} restants</div>
      </div>
      <div style={{display:"flex",gap:7}}>
        {missing>0&&!loading&&<Btn onClick={handleGeocode} variant="primary">Localiser ({missing})</Btn>}
        {geocoded>0&&<Btn onClick={handleFit} variant="ghost" size="sm">Voir tout</Btn>}
        {geocoded>0&&<Btn onClick={function(){S.set(GEOCODE_KEY,{});setCoords({});setSel(null);}} variant="ghost" size="sm">Reset</Btn>}
      </div>
    </div>
    {loading&&<Card padding="12px 16px" style={{marginBottom:10,background:"rgba(245,158,11,0.06)",border:"1px solid rgba(245,158,11,0.2)"}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:6,fontSize:12,color:"#f59e0b"}}><span>Géolocalisation en cours…</span><span style={{fontFamily:"monospace",fontWeight:600}}>{pct}%</span></div>
      <ProgressBar value={prog.done} max={prog.total} color="#f59e0b"/>
    </Card>}
    <Card padding="8px 12px" style={{marginBottom:8,display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
      <div style={{display:"flex",gap:10}}>
        {[["pending","#f59e0b","En attente"],["done","#10b981","Terminés"],["inactive","#6b7280","Inactifs"]].map(function(item){
          return <div key={item[0]} style={{display:"flex",alignItems:"center",gap:5,fontSize:12,color:T.muted}}>
            <div style={{width:10,height:10,borderRadius:"50%",background:item[1],flexShrink:0}}/>{item[2]}
          </div>;
        })}
      </div>
      <div style={{marginLeft:"auto",display:"flex",gap:5,alignItems:"center",flexWrap:"wrap"}}>
        {[["all","Tous"],["pending","Attente"],["done","Terminés"]].map(function(item){
          return <button key={item[0]} onClick={function(){setFiltre(item[0]);setSel(null);}} style={{border:"1px solid "+(filtre===item[0]?"rgba(99,102,241,0.4)":T.border),borderRadius:6,padding:"4px 10px",cursor:"pointer",fontFamily:"inherit",fontWeight:500,fontSize:11,background:filtre===item[0]?"rgba(99,102,241,0.15)":"transparent",color:filtre===item[0]?"#a5b4fc":T.muted}}>{item[1]}</button>;
        })}
        <button onClick={function(){setView(function(v){return{lat:v.lat,lon:v.lon,zoom:Math.min(17,v.zoom+1)};});}} style={{width:26,height:26,border:"1px solid "+T.border,borderRadius:5,cursor:"pointer",fontWeight:700,fontSize:15,background:"transparent",color:T.text,lineHeight:1}}>+</button>
        <button onClick={function(){setView(function(v){return{lat:v.lat,lon:v.lon,zoom:Math.max(7,v.zoom-1)};});}} style={{width:26,height:26,border:"1px solid "+T.border,borderRadius:5,cursor:"pointer",fontWeight:700,fontSize:15,background:"transparent",color:T.text,lineHeight:1}}>−</button>
        {planning&&planning.journees&&planning.journees.length>0&&<div style={{display:"flex",gap:4,borderLeft:"1px solid "+T.border,paddingLeft:6,flexWrap:"wrap"}}>
          <button onClick={function(){setShowRoutes(function(r){return !r;});}} style={{border:"1px solid "+(showRoutes?"rgba(99,102,241,0.4)":T.border),borderRadius:6,padding:"4px 10px",cursor:"pointer",fontFamily:"inherit",fontWeight:500,fontSize:11,background:showRoutes?"rgba(99,102,241,0.15)":"transparent",color:showRoutes?"#a5b4fc":T.muted}}>Tournées</button>
          {showRoutes&&planning.journees.map(function(j,ji){var col=RCOLS[ji%RCOLS.length];return <button key={j.num} onClick={function(){setSelJour(selJour===j.num?null:j.num);}} style={{border:"1px solid "+col+"60",borderRadius:5,padding:"3px 9px",cursor:"pointer",fontFamily:"monospace",fontWeight:700,fontSize:11,background:selJour===j.num?col+"25":"transparent",color:col}}>J{j.num}</button>;})}
        </div>}
      </div>
    </Card>
    <div style={{position:"relative",width:"100%",height:H,borderRadius:14,overflow:"hidden",border:"1px solid "+T.border,background:"#1a1a2e",cursor:"grab",userSelect:"none"}}
      onClick={function(){setSel(null);}}
      onMouseDown={function(e){dragging.current=true;lastMouse.current={x:e.clientX,y:e.clientY};setSel(null);}}
      onMouseMove={function(e){if(!dragging.current||!lastMouse.current)return;var dx=e.clientX-lastMouse.current.x,dy=e.clientY-lastMouse.current.y;lastMouse.current={x:e.clientX,y:e.clientY};var n=Math.pow(2,view.zoom),dLon=(-dx/TILE)/n*360;var cPx=ll2px(view.lat,view.lon,view.zoom),newY=cPx.y+(-dy);var newLat=Math.atan(Math.sinh(Math.PI*(1-2*newY/(n*TILE))))*180/Math.PI;setView({lat:Math.max(-85,Math.min(85,newLat)),lon:view.lon+dLon,zoom:view.zoom});}}
      onMouseUp={function(){dragging.current=false;}} onMouseLeave={function(){dragging.current=false;}}
      onWheel={function(e){e.preventDefault();wheelAccum.current+=e.deltaY;if(Math.abs(wheelAccum.current)>=150){var nz=Math.max(7,Math.min(17,view.zoom+(wheelAccum.current<0?1:-1)));setView({lat:view.lat,lon:view.lon,zoom:nz});setSel(null);wheelAccum.current=0;}}}>
      {tiles.map(function(t){return <img key={t.key} src={t.url} alt="" draggable={false} style={{position:"absolute",left:Math.round(t.left),top:Math.round(t.top),width:TILE,height:TILE,display:"block",opacity:0.85}} onError={function(e){e.currentTarget.style.display="none";}}/>;}) }
      {showRoutes&&planning&&planning.journees&&planning.journees.length>0&&<svg style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none",zIndex:8}}>
        <defs>{RCOLS.map(function(col,i){return <marker key={i} id={"arr"+i} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 z" fill={col}/></marker>;})}</defs>
        {planning.journees.filter(function(j){return selJour===null||j.num===selJour;}).map(function(j,ji){
          var col=RCOLS[ji%RCOLS.length];
          var pts=j.slots.map(function(sl){var c=clients.find(function(cl){return cl.id===sl.clientId;});if(!c||!coords[c.id])return null;return toXY(coords[c.id].lat,coords[c.id].lon);}).filter(Boolean);
          if(pts.length<2)return null;
          return <g key={j.id||ji}>
            {pts.slice(0,-1).map(function(p,k){return <line key={k} x1={Math.round(p.x)} y1={Math.round(p.y)} x2={Math.round(pts[k+1].x)} y2={Math.round(pts[k+1].y)} stroke={col} strokeWidth="2.5" strokeOpacity="0.9" markerEnd={"url(#arr"+ji%RCOLS.length+")"} strokeLinecap="round"/>;}) }
            {pts[0]&&<g><circle cx={Math.round(pts[0].x)} cy={Math.round(pts[0].y)} r="11" fill={col} opacity="0.95"/><text x={Math.round(pts[0].x)} y={Math.round(pts[0].y)+4} textAnchor="middle" fontSize="10" fontWeight="bold" fill="white">J{j.num}</text></g>}
          </g>;
        })}
      </svg>}
      <div style={{position:"absolute",bottom:6,right:8,fontSize:10,color:"#333",background:"rgba(255,255,255,0.85)",padding:"2px 6px",borderRadius:4,zIndex:5,pointerEvents:"none"}}>© OpenStreetMap</div>
      {geocoded===0&&!loading&&<div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12,background:"rgba(15,15,19,0.95)",zIndex:10}}>
        <div style={{fontSize:44}}>📍</div>
        <div style={{fontWeight:600,fontSize:17,color:T.text}}>Aucun client géolocalisé</div>
        <div style={{fontSize:13,color:T.muted}}>Cliquez sur Localiser pour commencer</div>
        {missing>0&&<Btn onClick={handleGeocode} variant="primary">Localiser ({missing})</Btn>}
      </div>}
      {visible.map(function(c){
        var xy=toXY(coords[c.id].lat,coords[c.id].lon);
        if(xy.x<-20||xy.x>W+20||xy.y<-20||xy.y>H+20)return null;
        var col=COL[c.status]||"#6b7280",isSel=sel&&sel.id===c.id,sz=isSel?22:14;
        var inSel=selJour===null||!showRoutes||!planning||!planning.journees||planning.journees.some(function(j){return j.num===selJour&&j.slots.some(function(sl){return sl.clientId===c.id;});});
        return <div key={c.id} onClick={function(e){e.stopPropagation();setSel(isSel?null:c);}}
          style={{position:"absolute",left:Math.round(xy.x),top:Math.round(xy.y),transform:"translate(-50%,-50%)",width:sz,height:sz,borderRadius:"50%",background:col,border:(isSel?3:2)+"px solid rgba(255,255,255,"+(isSel?"0.9":"0.7")+")",boxShadow:isSel?"0 0 0 4px "+col+"40,0 4px 12px rgba(0,0,0,.5)":"0 2px 6px rgba(0,0,0,.4)",cursor:"pointer",zIndex:isSel?20:11,display:"flex",alignItems:"center",justifyContent:"center",opacity:inSel?1:0.2,transition:"all 0.15s"}}>
          {(c.nbrCaissons||1)>1&&<span style={{fontSize:8,fontWeight:700,color:"white",lineHeight:1}}>{c.nbrCaissons}</span>}
        </div>;
      })}
      {sel&&coords[sel.id]&&(function(){
        var xy=toXY(coords[sel.id].lat,coords[sel.id].lon),col=COL[sel.status]||"#6b7280";
        return <div onClick={function(e){e.stopPropagation();}} style={{position:"absolute",left:xy.x>W-250?xy.x-215:xy.x+16,top:Math.max(8,Math.min(xy.y-10,H-155)),background:T.bgCard,borderRadius:10,padding:"12px 14px",boxShadow:"0 8px 32px rgba(0,0,0,.5)",minWidth:185,maxWidth:225,border:"1px solid "+T.border,zIndex:40}}>
          <button onClick={function(){setSel(null);}} style={{position:"absolute",top:7,right:9,background:"none",border:"none",cursor:"pointer",fontSize:17,color:T.muted,lineHeight:1}}>×</button>
          <div style={{fontWeight:600,fontSize:13,color:T.text,marginBottom:4,paddingRight:16}}>{sel.name}</div>
          <div style={{fontSize:11,color:T.muted,marginBottom:8,lineHeight:1.6}}>{sel.address} {sel.cp} {sel.ville}</div>
          <div style={{display:"flex",alignItems:"center",gap:7}}>
            <StatusPill status={sel.status}/>
            <span style={{fontSize:10,color:T.muted}}>{sel.nbrCaissons||1} caisson{(sel.nbrCaissons||1)>1?"s":""}</span>
          </div>
        </div>;
      })()}
    </div>
    <div style={{fontSize:11,color:T.muted,marginTop:6,textAlign:"center"}}>Molette pour zoomer · Glisser pour se déplacer · Clic pour détails</div>
  </div>;
}

// ── Années View ───────────────────────────────────────────────────────────────
function AnneesView({currentYear, clients, onNewYear, onSetYear, modPre}) {
  var done=clients.filter(function(c){return c.status==="done";}).length;
  var pending=clients.filter(function(c){return c.status==="pending";}).length;
  var total=done+pending,pct=total>0?Math.round(done/total*100):0;
  var [conf,setConf]=useState(null);
  var [archives,setArchives]=useState({});
  useEffect(function(){
    var allYears={};clients.forEach(function(c){(c.history||[]).forEach(function(h){allYears[h.year]=true;});});
    var years=Object.keys(allYears).map(Number);if(!years.length)return;
    var a={};years.forEach(function(yr){try{var v=localStorage.getItem("proplan_"+(modPre||"vmc_")+"archive_"+yr);a[yr]=v?JSON.parse(v):[];}catch(e){a[yr]=[];}});
    setArchives(a);
  },[clients.length]);
  return <div style={{animation:"fadeIn 0.3s ease"}}>
    <div style={{marginBottom:22}}>
      <div style={{fontSize:11,color:"#6366f1",fontWeight:600,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:6}}>Historique</div>
      <div style={{fontSize:28,fontWeight:700,color:T.text,letterSpacing:"-0.02em"}}>Années</div>
    </div>
    <Card padding="20px" style={{marginBottom:14,textAlign:"center"}}>
      <div style={{fontSize:11,color:T.muted,fontWeight:500,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:8}}>Année active</div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:20}}>
        <button onClick={function(){setConf(currentYear-1);}} style={{width:36,height:36,border:"1px solid "+T.border,borderRadius:8,cursor:"pointer",background:"transparent",color:T.text,fontSize:18,display:"flex",alignItems:"center",justifyContent:"center"}}>‹</button>
        <div style={{fontSize:48,fontWeight:800,color:T.text,letterSpacing:"-0.04em"}}>{currentYear}</div>
        <button onClick={function(){setConf(currentYear+1);}} style={{width:36,height:36,border:"1px solid "+T.border,borderRadius:8,cursor:"pointer",background:"transparent",color:T.text,fontSize:18,display:"flex",alignItems:"center",justifyContent:"center"}}>›</button>
      </div>
    </Card>
    {conf&&<Card padding="14px 16px" style={{marginBottom:12,background:"rgba(245,158,11,0.06)",border:"1px solid rgba(245,158,11,0.3)"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
        <span style={{fontSize:14,color:T.text,fontWeight:500}}>Passer à <strong>{conf}</strong> ?</span>
        <div style={{display:"flex",gap:7}}>
          <Btn onClick={function(){onSetYear(conf);setConf(null);}} variant="secondary" size="sm">Confirmer</Btn>
          <Btn onClick={function(){setConf(null);}} variant="ghost" size="sm">Annuler</Btn>
        </div>
      </div>
    </Card>}
    <Card padding="18px 20px" style={{marginBottom:14,background:"rgba(99,102,241,0.06)",border:"1px solid rgba(99,102,241,0.2)"}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:14}}>
        {[["En attente",pending,"#f59e0b"],["Terminés",done,"#10b981"],["Inactifs",clients.filter(function(c){return c.status==="inactive";}).length,"#6b7280"]].map(function(item){
          return <div key={item[0]} style={{textAlign:"center"}}>
            <div style={{fontSize:26,fontWeight:700,color:item[2]}}>{item[1]}</div>
            <div style={{fontSize:11,color:T.muted,marginTop:2}}>{item[0]}</div>
          </div>;
        })}
      </div>
      <ProgressBar value={done} max={total} color="#6366f1" height={6}/>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:10}}>
        <span style={{fontSize:12,color:T.muted}}>{pct}% · {done}/{total}</span>
        <Btn onClick={onNewYear} variant="primary" size="sm" style={{boxShadow:"0 4px 16px rgba(99,102,241,0.3)"}}>Commencer {currentYear+1}</Btn>
      </div>
    </Card>
    {(function(){
      var allYears={};
      clients.forEach(function(c){(c.history||[]).forEach(function(h){if(!allYears[h.year])allYears[h.year]={count:0,caissons:0};allYears[h.year].count++;allYears[h.year].caissons+=h.nbrCaissons||1;});if(c.status==="done"){if(!allYears[currentYear])allYears[currentYear]={count:0,caissons:0};allYears[currentYear].count++;allYears[currentYear].caissons+=c.nbrCaissons||1;}});
      var years=Object.keys(allYears).map(Number).sort(function(a,b){return b-a;});
      if(!years.length)return null;
      return <Card padding="18px 20px">
        <div style={{fontSize:11,color:T.muted,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:14}}>Historique des années</div>
        {years.map(function(yr){
          var d=allYears[yr],isCur=yr===currentYear;
          var archData=archives[yr]||[];
          var maxCount=Math.max.apply(null,years.map(function(y){return allYears[y].count;}));
          return <div key={yr}>
            <div style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:"1px solid "+T.border}}>
              <div style={{fontWeight:700,fontSize:16,color:isCur?"#6366f1":T.text,minWidth:50}}>{yr}</div>
              <div style={{flex:1}}>
                <ProgressBar value={d.count} max={maxCount} color={isCur?"#6366f1":"rgba(255,255,255,0.2)"} height={5}/>
              </div>
              <div style={{fontFamily:"monospace",fontSize:12,color:T.muted,minWidth:80,textAlign:"right"}}>{d.count} clients</div>
              <div style={{fontFamily:"monospace",fontSize:11,color:T.faint,minWidth:75,textAlign:"right"}}>{d.caissons} caissons</div>
              {isCur&&<Badge color="#6366f1">en cours</Badge>}
            </div>
          </div>;
        })}
      </Card>;
    })()}
  </div>;
}

// ── Kizeo View ────────────────────────────────────────────────────────────────
var KIZEO_BASE="https://forms.kizeo.com/rest/v3";
function kizeoGet(token,path){return fetch(KIZEO_BASE+path,{headers:{"Authorization":token,"Content-Type":"application/json"}}).then(function(r){if(!r.ok)throw new Error("HTTP "+r.status);return r.json();});}
function kizeoPost(token,path,body){return fetch(KIZEO_BASE+path,{method:"POST",headers:{"Authorization":token,"Content-Type":"application/json"},body:JSON.stringify(body)}).then(function(r){if(!r.ok)throw new Error("HTTP "+r.status);return r.json();});}

function KizeoView({clients, planning, onCheck}) {
  var [token,setToken]=useState("");
  var [formId,setFormId]=useState("");
  var [saved,setSaved]=useState(false);
  var [kUsers,setKUsers]=useState([]);
  var [loadingUsers,setLoadingUsers]=useState(false);
  var [userErr,setUserErr]=useState("");
  var [mapping,setMapping]=useState({});
  var [pushing,setPushing]=useState(false);
  var [pushLog,setPushLog]=useState([]);
  var [syncing,setSyncing]=useState(false);
  var [syncLog,setSyncLog]=useState([]);
  useEffect(function(){S.get("kizeo_config").then(function(c){if(c){setToken(c.token||"");setFormId(c.formId||"");setMapping(c.mapping||{});setSaved(true);}});},[]);
  var saveConfig=function(){S.set("kizeo_config",{token,formId,mapping});setSaved(true);setPushLog([]);setSyncLog([]);};
  var loadUsers=function(){if(!token){setUserErr("Token requis");return;}setLoadingUsers(true);setUserErr("");kizeoGet(token,"/users").then(function(d){setKUsers((d.users||[]).map(function(u){return{id:String(u.id),name:(u.first_name||"")+" "+(u.last_name||""),login:u.login||""};}));}).catch(function(e){setUserErr("Erreur: "+e.message);}).then(function(){setLoadingUsers(false);});};
  var pushPlanning=function(){
    if(!token||!formId){setPushLog(["Token et ID formulaire requis"]);return;}
    if(!planning||!planning.journees||!planning.journees.length){setPushLog(["Aucun planning"]);return;}
    var cMap={};clients.forEach(function(c){cMap[c.id]=c;});
    setPushing(true);setPushLog(["Démarrage…"]);
    var logs=[],done=0;
    var journeesWithUser=planning.journees.filter(function(j){return mapping["J"+j.num];});
    if(!journeesWithUser.length){setPushLog(["Aucun technicien assigné"]);setPushing(false);return;}
    var total=journeesWithUser.reduce(function(s,j){return s+j.slots.length;},0);
    var pushSlots=function(jIdx,sIdx){
      if(jIdx>=journeesWithUser.length){setPushLog(logs.concat("Terminé: "+done+"/"+total));setPushing(false);return;}
      var j=journeesWithUser[jIdx];if(sIdx>=j.slots.length){pushSlots(jIdx+1,0);return;}
      var sl=j.slots[sIdx],c=cMap[sl.clientId];if(!c){pushSlots(jIdx,sIdx+1);return;}
      var userId=mapping["J"+j.num];
      var body={recipient_user_id:parseInt(userId),fields:{client_name:{value:c.name||""},address:{value:(c.address||"")+" "+(c.ville||"")},scheduled_time:{value:sl.startClock+" - "+sl.endClock},nb_caissons:{value:String(c.nbrCaissons||1)},bon:{value:c.bon||""},journee:{value:"J"+j.num}}};
      kizeoPost(token,"/forms/"+formId+"/push",body).then(function(){done++;logs=logs.concat("✓ J"+j.num+": "+c.name);setPushLog(logs.slice());}).catch(function(e){logs=logs.concat("✗ J"+j.num+" "+c.name+": "+e.message);setPushLog(logs.slice());}).then(function(){setTimeout(function(){pushSlots(jIdx,sIdx+1);},300);});
    };pushSlots(0,0);
  };
  var syncData=function(){
    if(!token||!formId){setSyncLog(["Token requis"]);return;}
    setSyncing(true);setSyncLog(["Récupération…"]);
    kizeoGet(token,"/forms/"+formId+"/data/unread/test/100?includeupdated").then(function(d){
      var datas=d.data||[];setSyncLog(["Trouvés: "+datas.length+" formulaires"]);
      if(!datas.length){setSyncing(false);return;}
      var cMap={};clients.forEach(function(c){var k=norm(c.name);cMap[k]=c;});
      var matched=[],ids=[];
      datas.forEach(function(entry){var rawName=((entry.fields||{}).client_name||{}).value||"";var found=cMap[norm(rawName)];if(found&&found.status==="pending"){matched.push(found);ids.push(entry.id);}});
      setSyncLog(["Trouvés: "+datas.length+" · Correspondances: "+matched.length]);
      if(matched.length>0){matched.forEach(function(c){onCheck(c.id);});kizeoPost(token,"/forms/"+formId+"/markasreadbyaction/test",{data_ids:ids}).catch(function(){});setSyncLog(["✓ "+matched.length+" clients marqués Terminés"]);}
      else setSyncLog(["Aucune correspondance"]);
      setSyncing(false);
    }).catch(function(e){setSyncLog(["Erreur: "+e.message]);setSyncing(false);});
  };
  var logStyle={background:"#0a0a0f",borderRadius:8,padding:"10px 12px",fontFamily:"'Inter',monospace",fontSize:11,color:"#10b981",maxHeight:160,overflowY:"auto",marginTop:10,border:"1px solid "+T.border};
  return <div style={{animation:"fadeIn 0.3s ease"}}>
    <div style={{marginBottom:22}}>
      <div style={{fontSize:11,color:"#6366f1",fontWeight:600,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:6}}>Intégration</div>
      <div style={{fontSize:28,fontWeight:700,color:T.text,letterSpacing:"-0.02em"}}>Kizeo Forms</div>
    </div>
    <Card padding="18px 20px" style={{marginBottom:12}}>
      <div style={{fontWeight:600,fontSize:13,color:T.text,marginBottom:14}}>1. Configuration</div>
      <div style={{display:"grid",gap:10,marginBottom:14}}>
        <div><div style={{fontSize:11,color:T.muted,marginBottom:4,fontWeight:500,textTransform:"uppercase",letterSpacing:"0.05em"}}>Token API</div><Input type="password" value={token} onChange={function(e){setToken(e.target.value);setSaved(false);}} placeholder="Votre token Kizeo"/></div>
        <div><div style={{fontSize:11,color:T.muted,marginBottom:4,fontWeight:500,textTransform:"uppercase",letterSpacing:"0.05em"}}>ID formulaire</div><Input value={formId} onChange={function(e){setFormId(e.target.value);setSaved(false);}} placeholder="Ex: 12345"/></div>
      </div>
      <div style={{display:"flex",gap:8,alignItems:"center"}}>
        <Btn onClick={saveConfig} variant="primary" size="sm" disabled={!token||!formId}>Sauvegarder</Btn>
        {saved&&<Badge color="#10b981">Sauvegardé</Badge>}
      </div>
    </Card>
    <Card padding="18px 20px" style={{marginBottom:12}}>
      <div style={{fontWeight:600,fontSize:13,color:T.text,marginBottom:4}}>2. Techniciens</div>
      <div style={{fontSize:12,color:T.muted,marginBottom:12}}>Associer chaque journée à un technicien Kizeo</div>
      <div style={{display:"flex",gap:8,marginBottom:12}}>
        <Btn onClick={loadUsers} variant="secondary" size="sm" disabled={!token||loadingUsers}>{loadingUsers?"…":"Charger les techniciens"}</Btn>
        {userErr&&<span style={{fontSize:11,color:"#ef4444"}}>{userErr}</span>}
      </div>
      {planning&&planning.journees&&planning.journees.length>0&&kUsers.length>0&&<div style={{display:"grid",gap:6}}>
        {planning.journees.map(function(j){return <div key={j.num} style={{display:"flex",alignItems:"center",gap:12,padding:"8px 12px",background:"rgba(255,255,255,0.03)",borderRadius:8,border:"1px solid "+T.border}}>
          <div style={{minWidth:50,fontFamily:"monospace",fontWeight:700,fontSize:13,color:RCOLS[j.num%RCOLS.length]}}>J{j.num}</div>
          <div style={{flex:1,fontSize:12,color:T.muted}}>{j.zonesLabel} · {j.slots.length} chantiers</div>
          <Select value={mapping["J"+j.num]||""} onChange={function(e){var v=e.target.value;setMapping(function(m){var n=Object.assign({},m);n["J"+j.num]=v;return n;});setSaved(false);}}>
            <option value="" style={{background:"#17171e"}}>— Technicien —</option>
            {kUsers.map(function(u){return <option key={u.id} value={u.id} style={{background:"#17171e"}}>{u.name||u.login}</option>;})}
          </Select>
        </div>;})}
      </div>}
    </Card>
    <Card padding="18px 20px" style={{marginBottom:12}}>
      <div style={{fontWeight:600,fontSize:13,color:T.text,marginBottom:4}}>3. Envoyer le planning</div>
      <div style={{fontSize:12,color:T.muted,marginBottom:12}}>Pousser chaque chantier aux techniciens Kizeo</div>
      <Btn onClick={pushPlanning} variant="primary" size="sm" disabled={pushing||!saved||!planning}>{pushing?"Envoi…":"Envoyer"}</Btn>
      {pushLog.length>0&&<div style={logStyle}>{pushLog.map(function(l,i){return <div key={i}>{l}</div>;})}</div>}
    </Card>
    <Card padding="18px 20px">
      <div style={{fontWeight:600,fontSize:13,color:T.text,marginBottom:4}}>4. Synchroniser les retours</div>
      <div style={{fontSize:12,color:T.muted,marginBottom:12}}>Récupérer les formulaires complétés</div>
      <Btn onClick={syncData} variant="success" size="sm" disabled={syncing||!saved}>{syncing?"Sync…":"Synchroniser"}</Btn>
      {syncLog.length>0&&<div style={logStyle}>{syncLog.map(function(l,i){return <div key={i}>{l}</div>;})}</div>}
    </Card>
  </div>;
}

// ── Module App ────────────────────────────────────────────────────────────────
function ModuleApp({mod, userId}) {
  var cfg=MODULES[mod],PRE=mod+"_";
  var [clients,setClients]=useState([]);
  var [currentYear,setCurrentYear]=useState(new Date().getFullYear());
  var [planning,setPlanning]=useState(null);
  var [otMin,setOtMin]=useState(30);
  var [view,setView]=useState("dashboard");
  var [loaded,setLoaded]=useState(false);
  var [xlsxReady,setXlsxReady]=useState(false);
  var [impResult,setImpResult]=useState(null);
  var [impError,setImpError]=useState("");
  var [impLoading,setImpLoading]=useState(false);
  var [impPending,setImpPending]=useState(null);
  var [techs,setTechs]=useState([]);
  var [journeeDates,setJourneeDates]=useState({});
  var fileRef=useRef();

  useEffect(function(){if(window.XLSX){setXlsxReady(true);return;}var s=document.createElement("script");s.src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";s.onload=function(){setXlsxReady(true);};document.head.appendChild(s);},[]);

  useEffect(function(){
    // Charger d'abord depuis localStorage (rapide), puis Supabase (source de vérité)
    Promise.all([S.get(PRE+"clients"),S.get(PRE+"year"),S.get(PRE+"ot"),S.get(PRE+"techs"),S.get(PRE+"jdates"),S.get(PRE+"planning"),S.get(PRE+"view")])
    .then(function(vals){
      if(vals[0])setClients(vals[0]);
      if(vals[1])setCurrentYear(vals[1]);
      if(vals[2]!==null)setOtMin(vals[2]);
      if(vals[3])setTechs(vals[3]);
      if(vals[4])setJourneeDates(vals[4]);
      if(vals[5])setPlanning(vals[5]);
      if(vals[6])setView(vals[6]);
      setLoaded(true);
      // Ensuite tenter Supabase (peut écraser localStorage si données plus récentes)
      return loadClientsFromSupabase(mod, userId);
    })
    .then(function(supaClients){
      if(supaClients&&supaClients.length>0){
        setClients(supaClients);
        try{localStorage.setItem("proplan_"+PRE+"clients",JSON.stringify(supaClients));}catch(e){}
      }
    })
    .catch(function(e){console.warn("Supabase load:",e);});
  },[mod]);

  useEffect(function(){if(!loaded)return;try{localStorage.setItem("proplan_"+PRE+"clients",JSON.stringify(clients));}catch(e){}syncClientsToSupabase(clients,mod,userId);},[clients,loaded]);
  useEffect(function(){if(!loaded)return;try{localStorage.setItem("proplan_"+PRE+"year",JSON.stringify(currentYear));}catch(e){};},[currentYear,loaded]);
  useEffect(function(){if(!loaded)return;try{localStorage.setItem("proplan_"+PRE+"ot",JSON.stringify(otMin));}catch(e){};},[otMin,loaded]);
  useEffect(function(){if(!loaded)return;try{localStorage.setItem("proplan_"+PRE+"techs",JSON.stringify(techs));}catch(e){};},[techs,loaded]);
  useEffect(function(){if(!loaded)return;try{localStorage.setItem("proplan_"+PRE+"jdates",JSON.stringify(journeeDates));}catch(e){};},[journeeDates,loaded]);
  useEffect(function(){if(!loaded)return;try{localStorage.setItem("proplan_"+PRE+"planning",JSON.stringify(planning));}catch(e){};},[planning,loaded]);
  useEffect(function(){if(!loaded)return;try{localStorage.setItem("proplan_"+PRE+"view",JSON.stringify(view));}catch(e){};},[view,loaded]);

  var handleFile=function(file){if(!xlsxReady){setImpError("XLSX pas prêt, réessayez.");return;}setImpLoading(true);setImpError("");setImpResult(null);setImpPending(null);readExcelRaw(file).then(function(data){var mapping=detectMapping(data.headers);setImpPending({headers:data.headers,rows:data.rows,mapping});}).catch(function(e){setImpError(String(e));}).then(function(){setImpLoading(false);});};
  var handleConfirmImport=function(mapping){if(!impPending)return;var rows=parseWithMapping(impPending.rows,mapping);var res=fusionner(clients,rows);setClients(res.clients);setImpResult({stats:res.stats,total:res.total});setImpPending(null);setPlanning(null);};
  var handleResetImport=function(){setImpPending(null);setImpResult(null);setImpError("");};
  var handleGenerate=function(){var pend=clients.filter(function(c){return c.status==="pending";});if(!pend.length)return;S.get(GEOCODE_KEY).then(function(coords){coords=coords||{};var jobFn=mod==="era"?function(c){var types=cfg.interventionTypes||[];var t=types.find(function(t){return t.id===c.interventionType;});return t?t.min:45;}:null;clearZoneCache();try{setPlanning(planifier(pend,otMin,jobFn,coords));setView("planning");}catch(err){alert("Erreur: "+err.message);}});};
  var handleCheck=function(id){setClients(function(prev){return prev.map(function(c){return c.id===id?Object.assign({},c,{status:"done",doneDate:today()}):c;});});setPlanning(function(prev){if(!prev)return null;return Object.assign({},prev,{journees:prev.journees.map(function(j){var sl=j.slots.filter(function(s){return s.clientId!==id;});return Object.assign({},j,{slots:sl,totalWork:sl.reduce(function(s2,s){return s2+s.dur;},0)});}).filter(function(j){return j.slots.length>0;})});});};
  var handlePartial=function(id,nbDone){setClients(function(prev){return prev.map(function(c){if(c.id!==id)return c;return Object.assign({},c,{nbrCaissons:Math.max(1,(c.nbrCaissons||1)-nbDone),status:"pending"});});});setPlanning(function(prev){if(!prev)return null;return Object.assign({},prev,{journees:prev.journees.map(function(j){var sl=j.slots.filter(function(s){return s.clientId!==id;});return Object.assign({},j,{slots:sl,totalWork:sl.reduce(function(s2,s){return s2+s.dur;},0)});}).filter(function(j){return j.slots.length>0;})});});};
  var handleSetYear=function(y){if(y===currentYear)return;var cls=clients.map(function(c){var hist=(c.history||[]).slice();if(c.status==="done"){var already=hist.some(function(h){return h.year===currentYear;});if(!already)hist.push({year:currentYear,doneDate:c.doneDate||today(),nbrCaissons:c.nbrCaissons||1});}return Object.assign({},c,{status:c.status==="done"?"pending":c.status,doneDate:null,history:hist});});var snap=clients.filter(function(c){return c.status==="done";}).map(function(c){return{id:c.id,name:c.name,address:c.address,ville:c.ville,nbrCaissons:c.nbrCaissons||1,doneDate:c.doneDate};});try{localStorage.setItem("proplan_"+PRE+"archive_"+currentYear,JSON.stringify(snap));}catch(e){}syncArchiveToSupabase(mod,currentYear,snap,userId);syncClientsToSupabase(cls,mod,userId);setClients(cls);setCurrentYear(y);setPlanning(null);};

  var pend=clients.filter(function(c){return c.status==="pending";}).length;
  var NAV=[["dashboard","Dashboard"],["import","Import"],["clients","Clients"],["planning","Planning"],["carte","Carte"],["annees","Années"],["kizeo","Kizeo"]];

  if(!loaded)return <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"60vh",color:T.muted,fontSize:14,fontFamily:"monospace"}}>Chargement…</div>;

  return <React.Fragment>
    <nav className="no-print" style={{background:"rgba(15,15,19,0.95)",backdropFilter:"blur(10px)",borderBottom:"1px solid "+T.border,display:"flex",alignItems:"center",padding:"0 18px",height:44,gap:2,position:"sticky",top:0,zIndex:100}}>
      {NAV.map(function(item){
        var active=view===item[0];
        return <button key={item[0]} onClick={function(){setView(item[0]);}} style={{background:active?"rgba(99,102,241,0.15)":"transparent",color:active?"#a5b4fc":T.muted,border:"none",borderRadius:6,padding:"4px 12px",cursor:"pointer",fontSize:12,fontFamily:"inherit",fontWeight:active?600:400,transition:"all 0.15s",position:"relative"}}>
          {item[1]}
          {active&&<div style={{position:"absolute",bottom:0,left:"50%",transform:"translateX(-50%)",width:16,height:2,background:"#6366f1",borderRadius:1}}/>}
        </button>;
      })}
      {pend>0&&<div style={{marginLeft:"auto",background:"rgba(99,102,241,0.2)",color:"#a5b4fc",borderRadius:6,padding:"2px 9px",fontFamily:"monospace",fontSize:11,fontWeight:600}}>{pend}</div>}
    </nav>
    <div style={{maxWidth:900,margin:"0 auto",padding:"28px 20px"}}>
      {view==="dashboard"&&<Dashboard clients={clients} planning={planning} currentYear={currentYear} onImport={function(){setView("import");}} onPlan={handleGenerate} onNewYear={function(){handleSetYear(currentYear+1);}} onCarte={function(){setView("carte");}}/>}
      {view==="import"&&<ImportView onConfirm={handleConfirmImport} fileRef={fileRef} loading={impLoading} error={impError} result={impResult} pending={impPending} onReset={handleResetImport} onDrop={function(e){e.preventDefault();var f=e.dataTransfer.files[0];if(f)handleFile(f);}}/>}
      {view==="clients"&&<ClientsView clients={clients} setClients={setClients}/>}
      {view==="planning"&&<PlanningView clients={clients} setClients={setClients} planning={planning} setPlanning={setPlanning} otMin={otMin} setOtMin={setOtMin} onGenerate={handleGenerate} onCheck={handleCheck} onPartial={handlePartial} techs={techs} setTechs={setTechs} journeeDates={journeeDates} setJourneeDate={function(jId,date){setJourneeDates(function(prev){var n=Object.assign({},prev);n[jId]=date;return n;});}}/>}
      {view==="carte"&&<CarteView clients={clients} planning={planning}/>}
      {view==="annees"&&<AnneesView currentYear={currentYear} clients={clients} onNewYear={function(){handleSetYear(currentYear+1);}} onSetYear={handleSetYear} modPre={PRE}/>}
      {view==="kizeo"&&<KizeoView clients={clients} planning={planning} onCheck={handleCheck}/>}
    </div>
    <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{display:"none"}} onChange={function(e){if(e.target.files[0])handleFile(e.target.files[0]);}}/>
  </React.Fragment>;
}

// ── Root App ──────────────────────────────────────────────────────────────────
var GUEST_USER = (function(){
  var k = "proplan_guest_id";
  try {
    var existing = localStorage.getItem(k);
    if(existing) return {email:"local", id:existing};
    var newId = "guest_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(k, newId);
    return {email:"local", id:newId};
  } catch(e) { return {email:"local", id:"guest_default"}; }
})();

export default function App() {
  var [mod,setMod]=useState("vmc");

  return <div style={{fontFamily:"'DM Sans',sans-serif",minHeight:"100vh",background:T.bg}}>
    <style>{css}</style>
    <header className="no-print" style={{background:"rgba(15,15,19,0.98)",borderBottom:"1px solid "+T.border,display:"flex",alignItems:"center",padding:"0 20px",height:52,position:"sticky",top:0,zIndex:200}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginRight:24}}>
        <div style={{width:30,height:30,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,color:"white",fontSize:14,boxShadow:"0 2px 12px rgba(99,102,241,0.4)"}}>A</div>
        <div style={{fontWeight:700,fontSize:15,color:T.text,letterSpacing:"-0.01em"}}>AHMP</div>
        <div style={{width:"1px",height:16,background:T.border,margin:"0 4px"}}/>
      </div>
      <div style={{display:"flex",gap:2}}>
        {Object.values(MODULES).map(function(m){
          return <button key={m.id} onClick={function(){setMod(m.id);}} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 14px",border:"none",borderRadius:7,cursor:"pointer",fontFamily:"inherit",fontWeight:500,fontSize:13,background:mod===m.id?"rgba(99,102,241,0.15)":"transparent",color:mod===m.id?"#a5b4fc":T.muted,transition:"all 0.2s"}}>
            <span style={{fontSize:14}}>{m.emoji}</span>{m.label}
          </button>;
        })}
      </div>
    </header>
    <ModuleApp key={mod} mod={mod} userId={GUEST_USER.id}/>
  </div>;
}
