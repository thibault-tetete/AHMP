import React, { useState, useEffect, useRef, useCallback } from "react";

// ─── Supabase config ─────────────────────────────────────────────────────────
// Remplace ces deux valeurs par tes clés Supabase (Settings → API)
var SUPA_URL = "https://ycdptnmznauyzckqepuu.supabase.co";
var SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljZHB0bm16bmF1eXpja3FlcHV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyODE3OTYsImV4cCI6MjA4OTg1Nzc5Nn0.SDWgUox2BcLSQB0s4JcplemTuq-NuidS5wv0ro2P30s";

// Client Supabase léger (sans SDK, fetch natif)
var supa = {
  _h: function(){ return {"apikey":SUPA_KEY,"Authorization":"Bearer "+(_token||SUPA_KEY),"Content-Type":"application/json","Prefer":"return=representation"}; },
  from: function(table){
    var base=SUPA_URL+"/rest/v1/"+table;
    return {
      select: function(cols,opts){
        var url=base+"?select="+(cols||"*")+(opts||"");
        return fetch(url,{headers:supa._h()}).then(function(r){return r.json();});
      },
      upsert: function(data){
        return fetch(base,{method:"POST",headers:Object.assign({},supa._h(),{"Prefer":"resolution=merge-duplicates,return=representation"}),body:JSON.stringify(data)}).then(function(r){return r.json();});
      },
      delete: function(filter){
        return fetch(base+"?"+filter,{method:"DELETE",headers:supa._h()}).then(function(r){return r.ok;});
      },
      rpc: function(fn,params){
        return fetch(SUPA_URL+"/rest/v1/rpc/"+fn,{method:"POST",headers:supa._h(),body:JSON.stringify(params)}).then(function(r){return r.json();});
      }
    };
  },
  auth: {
    signIn: function(email,password){
      return fetch(SUPA_URL+"/auth/v1/token?grant_type=password",{method:"POST",headers:{"apikey":SUPA_KEY,"Content-Type":"application/json"},body:JSON.stringify({email:email,password:password})}).then(function(r){return r.json();});
    },
    signUp: function(email,password){
      return fetch(SUPA_URL+"/auth/v1/signup",{method:"POST",headers:{"apikey":SUPA_KEY,"Content-Type":"application/json"},body:JSON.stringify({email:email,password:password})}).then(function(r){return r.json();});
    },
    signOut: function(){
      return fetch(SUPA_URL+"/auth/v1/logout",{method:"POST",headers:supa._h()}).then(function(){_token=null;_userId=null;try{localStorage.removeItem("supa_session");}catch(e){}});
    },
    resetPassword: function(email){
      return fetch(SUPA_URL+"/auth/v1/recover",{method:"POST",headers:{"apikey":SUPA_KEY,"Content-Type":"application/json"},body:JSON.stringify({email:email})}).then(function(r){return r.ok;});
    },
    getSession: function(){
      try{var s=localStorage.getItem("supa_session");return s?JSON.parse(s):null;}catch(e){return null;}
    },
  },
};
var _token=null, _userId=null;

var WS=510,WE=960,JOB=30,GAP=15,PAUSE=30,PAUSE_AT=210,MIN_WORK=420;
var HOME_LAT=43.6047,HOME_LON=1.4442,GEOCODE_KEY="vmc_geocache";
function fmt(m){var t=Math.max(0,Math.round(m));return String(Math.floor(t/60)).padStart(2,"0")+":"+String(t%60).padStart(2,"0");}
function norm(s){return String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim();}

// S = storage hybride localStorage + Supabase
// localStorage = cache local immédiat, Supabase = source de vérité en ligne
var S={
  get:function(k){
    return new Promise(function(resolve){
      try{var v=localStorage.getItem("proplan_"+k);resolve(v?JSON.parse(v):null);}
      catch(e){resolve(null);}
    });
  },
  set:function(k,v){
    return new Promise(function(resolve){
      try{localStorage.setItem("proplan_"+k,JSON.stringify(v));resolve(true);}
      catch(e){resolve(null);}
    });
  },
  del:function(k){try{localStorage.removeItem("proplan_"+k);}catch(e){}},
};

function haversineKm(la1,lo1,la2,lo2){var R=6371,dLa=(la2-la1)*Math.PI/180,dLo=(lo2-lo1)*Math.PI/180;var a=Math.pow(Math.sin(dLa/2),2)+Math.cos(la1*Math.PI/180)*Math.cos(la2*Math.PI/180)*Math.pow(Math.sin(dLo/2),2);return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));}
var _zoneCache={};
function clearZoneCache(){_zoneCache={};}
function getZone(cp,ville,id,coords){if(coords&&id&&coords[id]){if(_zoneCache[id])return _zoneCache[id];var lat=coords[id].lat,lon=coords[id].lon,km=haversineKm(HOME_LAT,HOME_LON,lat,lon),t=Math.round(km/50*60);var col=t<5?"#1a3d6e":t<15?"#4a235a":t<25?"#1e8449":t<40?"#7d6608":t<55?"#d35400":"#c0392b";var z={t:t,cas:t>=80,nom:ville||"Zone",col:col};_zoneCache[id]=z;return z;}var c=String(cp||"").trim().replace(/\.0$/,""),v=String(ville||"").toUpperCase().trim();if(c.startsWith("3183"))return{t:18,cas:false,nom:"Plaisance",col:"#148f77"};if(c.startsWith("3114"))return{t:16,cas:false,nom:"Castelginest",col:"#1a5276"};if(c.startsWith("3127"))return{t:18,cas:false,nom:"Frouzins",col:"#154360"};if(c.startsWith("3133")||c.startsWith("3134"))return{t:22,cas:false,nom:"Launac",col:"#7d6608"};if(c.startsWith("3184"))return{t:20,cas:false,nom:"Aussonne",col:"#1e8449"};if(c.startsWith("326"))return{t:35,cas:false,nom:"Isle-Jourdain",col:"#b7770d"};if(c.startsWith("815"))return{t:42,cas:false,nom:"Lavaur",col:"#d35400"};if(c.startsWith("827"))return{t:48,cas:false,nom:"Bressol",col:"#c0392b"};if(c.startsWith("65"))return{t:90,cas:true,nom:"Bagneres",col:"#922b21"};return{t:0,cas:false,nom:"Toulouse",col:"#1a3d6e"};}
function nearestNeighbor(clients,coords){var withC=clients.filter(function(c){return coords&&coords[c.id];});var noC=clients.filter(function(c){return !coords||!coords[c.id];});if(withC.length<=1)return clients;var rem=withC.slice(),ord=[],cur={lat:HOME_LAT,lon:HOME_LON};while(rem.length>0){var bi=0,bd=Infinity;for(var i=0;i<rem.length;i++){var d=haversineKm(cur.lat,cur.lon,coords[rem[i].id].lat,coords[rem[i].id].lon);if(d<bd){bd=d;bi=i;}}var nx=rem.splice(bi,1)[0];ord.push(nx);cur=coords[nx.id];}return ord.concat(noC);}
function planifier(pending,otMin,jobFn,coords){var ot=(typeof otMin==="number"&&!isNaN(otMin))?otMin:30;var maxWork=MIN_WORK+ot;var durFn=function(c){return jobFn?jobFn(c):(c.nbrCaissons||1)*JOB;};var casAPart=pending.filter(function(c){return getZone(c.cp,c.ville,c.id,coords).cas;});var plannable=pending.filter(function(c){return !getZone(c.cp,c.ville,c.id,coords).cas;});if(!plannable.length)return{journees:[],casAPart:casAPart};var withAngle=plannable.map(function(c){var lat,lon;if(coords&&coords[c.id]){lat=coords[c.id].lat;lon=coords[c.id].lon;}else{var z=getZone(c.cp,c.ville,c.id,null);var r=z.t/60*0.45;var a=Math.random()*2*Math.PI;lat=HOME_LAT+r*Math.cos(a);lon=HOME_LON+r*Math.sin(a)/Math.cos(HOME_LAT*Math.PI/180);}var angle=(Math.atan2(lon-HOME_LON,lat-HOME_LAT)*180/Math.PI+360)%360;var dist=haversineKm(HOME_LAT,HOME_LON,lat,lon);return Object.assign({},c,{_lat:lat,_lon:lon,_angle:angle,_dist:dist});});withAngle.sort(function(a,b){var sA=Math.floor(a._angle/30),sB=Math.floor(b._angle/30);if(sA!==sB)return sA-sB;return a._dist-b._dist;});var groups=[],cur=[],work=0;for(var i=0;i<withAngle.length;i++){var c=withAngle[i],d=durFn(c);if(work+d>maxWork&&cur.length>0){groups.push(cur);cur=[];work=0;}cur.push(c);work+=d;}if(cur.length>0)groups.push(cur);var journees=groups.map(function(grp,ji){var ordered=(coords&&Object.keys(coords).length>0)?nearestNeighbor(grp,coords):grp;var avgDist=ordered.reduce(function(s,c){return s+(c._dist||0);},0)/ordered.length;var travelMin=Math.min(Math.round(avgDist/50*60),60);var cursor=WS,cumWork=0,pauseAt=null,pauseDone=false;var slots=ordered.map(function(c){var d=durFn(c);if(!pauseDone&&cumWork>=PAUSE_AT){cursor=cursor-GAP+PAUSE;pauseAt=cursor-PAUSE;pauseDone=true;}var s=cursor,e=cursor+d;cursor=e+GAP;cumWork+=d;return{clientId:c.id,startClock:fmt(s),endClock:fmt(e),startMin:s,dur:d,nbrCaissons:c.nbrCaissons||1,overtime:e>WE,zoneName:c.ville||"Toulouse",zoneCol:getZone(c.cp,c.ville,c.id,coords).col};});if(!pauseDone)pauseAt=cursor-GAP;var zones=[];slots.forEach(function(s){if(zones.indexOf(s.zoneName)<0)zones.push(s.zoneName);});var depMin=travelMin>0?WS-travelMin:null;var last=slots[slots.length-1];return{id:Math.random().toString(36).slice(2),num:ji+1,travelMin:travelMin,zonesLabel:zones.slice(0,3).join(" + "),zoneColor:getZone(grp[0].cp,grp[0].ville,grp[0].id,coords).col,departTime:depMin!==null?fmt(depMin):null,slots:slots,totalWork:cumWork,breakAt:pauseAt!==null?fmt(pauseAt):null,overtime:slots.some(function(s){return s.overtime;}),sousCharge:cumWork<MIN_WORK,finHeure:last?last.endClock:"16:00",multiZone:zones.length>1};});journees.sort(function(a,b){if(a.sousCharge!==b.sousCharge)return a.sousCharge?1:-1;return a.travelMin-b.travelMin;});journees.forEach(function(j,i){j.num=i+1;});return{journees:journees,casAPart:casAPart};}

function readExcelRaw(file){return new Promise(function(resolve,reject){if(typeof window.XLSX==="undefined")return reject("XLSX non charge");var reader=new FileReader();reader.onload=function(e){try{var wb=window.XLSX.read(e.target.result,{type:"binary"});var ws=wb.Sheets[wb.SheetNames[0]];var raw=window.XLSX.utils.sheet_to_json(ws,{header:1,defval:""});var hi=raw.findIndex(function(r){return r.some(function(v){return String(v).trim()!=="";});});if(hi<0)return reject("Fichier vide.");resolve({headers:raw[hi],rows:raw.slice(hi+1).filter(function(r){return r.some(function(v){return String(v).trim()!=="";});}),headerIdx:hi});}catch(e){reject("Erreur: "+e.message);}};reader.onerror=function(){reject("Lecture impossible.");};reader.readAsBinaryString(file);})}

function detectMapping(headers){
  var h=headers.map(function(h){return norm(String(h));});
  var find=function(){var keys=Array.from(arguments);var i=h.findIndex(function(x){return keys.some(function(k){return x.includes(k);});});return i>=0?i:null;};
  return{
    name:find("soci","client","nom du client","nom","raison","residence"),
    address:find("adresse","addr","rue","voie"),
    cp:find("code postal","postal","cp","zip"),
    ville:find("ville","commune","localite","city"),
    nbrCaissons:find("nbr caisson","nbre caisson","caisson","nombre","qte","quantite"),
    bon:find("bon d","n intervention","ref","numero","bon de commande"),
  };
}

function parseWithMapping(rows,mapping){
  return rows.map(function(r){
    var get=function(k){var i=mapping[k];return i!==null&&i!==undefined&&i>=0?String(r[i]||"").trim():"";};
    return{name:get("name"),address:get("address"),cp:get("cp").replace(/\.0$/,""),ville:get("ville"),nbrCaissons:Math.max(1,parseInt(get("nbrCaissons"))||1),bon:get("bon")};
  }).filter(function(r){return r.name||r.address;});
}
function cKey(n,a){return norm(n)+"||"+norm(a);}
function uid(){return Math.random().toString(36).slice(2);}
function today(){return new Date().toISOString().split("T")[0];}
function fusionner(existing,rows){var seen={},uniq=[],dups=[];rows.forEach(function(r){var k=cKey(r.name,r.address);if(seen[k])dups.push(r);else{seen[k]=true;uniq.push(r);}});var stats={added:0,reactivated:0,alreadyDone:0,pending:0,deactivated:0,dups:dups.length};var updated=existing.map(function(c){var k=cKey(c.name,c.address);var m=uniq.find(function(r){return cKey(r.name,r.address)===k;});var u=m?{cp:m.cp||c.cp,ville:m.ville||c.ville,nbrCaissons:m.nbrCaissons||c.nbrCaissons,bon:m.bon||c.bon}:{};if(seen[k]){if(c.status==="done"){stats.alreadyDone++;return Object.assign({},c,u);}if(c.status==="inactive"){stats.reactivated++;return Object.assign({},c,u,{status:"pending"});}stats.pending++;return Object.assign({},c,u);}else{var had=(c.history||[]).length>0||c.status==="done";if(c.status==="pending"&&!had){stats.deactivated++;return Object.assign({},c,{status:"inactive"});}return c;}});var ex={};updated.forEach(function(c){ex[cKey(c.name,c.address)]=true;});uniq.forEach(function(r){if(!ex[cKey(r.name,r.address)]){updated.push({id:uid(),name:r.name,address:r.address,cp:r.cp||"",ville:r.ville||"",nbrCaissons:r.nbrCaissons||1,bon:r.bon||"",status:"pending",year:new Date().getFullYear(),doneDate:null,history:[]});stats.added++;}});return{clients:updated,stats:stats,total:rows.length};}

var PAL=["#0f2d4a","#1a3d2b","#2a1a3d","#1a2e3d","#3d2a0f","#0d3d3a","#0f3020","#163050","#2d1f0a","#0a2a3d","#1a2a10","#2a0f3a"];
var ACC=["#f0a500","#5dbb7a","#c07ae0","#5ab8e0","#e0a84a","#5de0c0","#e0804a","#7ae05d","#e05d80","#a0b0ff","#d0e040","#a07ae0"];
var RCOLS=["#e74c3c","#3498db","#2ecc71","#9b59b6","#f39c12","#1abc9c","#e67e22","#e91e63","#00bcd4","#8bc34a","#ff5722","#673ab7"];

function Pill({status}){
  var map={pending:{l:"En attente",bg:"#fff3cd",c:"#856404"},done:{l:"Termine",bg:"#d1f0d8",c:"#155724"},inactive:{l:"Inactif",bg:"#f0f0f0",c:"#888"}};
  var s=map[status]||map.inactive;
  return <span style={{fontSize:11,fontFamily:"monospace",background:s.bg,color:s.c,borderRadius:5,padding:"2px 8px"}}>{s.l}</span>;
}
function Btn({children,onClick,v,sm,disabled,style:ext}){
  var cols={dark:["#111","white"],amber:["#f0a500","#111"],ghost:["#e8e4dc","#333"],green:["#1a3d2b","white"]};
  var [bg,fg]=(cols[v||"dark"]||cols.dark);
  return <button onClick={onClick} disabled={disabled} style={Object.assign({background:disabled?"#ccc":bg,color:fg,border:"none",borderRadius:8,cursor:disabled?"not-allowed":"pointer",fontFamily:"inherit",fontWeight:700,padding:sm?"6px 14px":"10px 20px",fontSize:sm?12:14},ext||{})} onMouseEnter={function(e){if(!disabled)e.currentTarget.style.opacity=".8";}} onMouseLeave={function(e){e.currentTarget.style.opacity="1";}}>{children}</button>;
}

function Dashboard({clients,planning,currentYear,onImport,onPlan,onNewYear,onCarte}){
  var p=clients.filter(function(c){return c.status==="pending";}),d=clients.filter(function(c){return c.status==="done";});
  var pct=(p.length+d.length)>0?Math.round(d.length/(p.length+d.length)*100):0;
  return (
    <div>
      <div style={{marginBottom:22}}>
        <div style={{fontSize:11,fontFamily:"monospace",color:"#f0a500",letterSpacing:2,textTransform:"uppercase",marginBottom:4}}>Annee {currentYear}</div>
        <h1 style={{fontSize:26,fontWeight:800,color:"#111"}}>Tableau de bord</h1>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:16}}>
        {[["En attente",p.length,"#f0a500"],["Termines",d.length,"#5dbb7a"],["Inactifs",clients.filter(function(c){return c.status==="inactive";}).length,"#bbb"]].map(function(item){
          return <div key={item[0]} style={{background:"white",borderRadius:12,padding:"14px 16px",borderLeft:"4px solid "+item[2]}}><div style={{fontSize:10,fontFamily:"monospace",color:"#999",textTransform:"uppercase",marginBottom:4}}>{item[0]}</div><div style={{fontSize:30,fontWeight:800,color:"#111",lineHeight:1}}>{item[1]}</div></div>;
        })}
      </div>
      {planning&&<div style={{background:"#1a3d2b",borderRadius:12,padding:"12px 16px",marginBottom:16,display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
        {[["Journees",planning.journees.length,"#5dbb7a"],["Incompletes",planning.journees.filter(function(j){return j.sousCharge;}).length,"#f0a500"],["Heures",Math.floor(planning.journees.reduce(function(s,j){return s+j.totalWork;},0)/60)+"h","#5ab8e0"]].map(function(item){
          return <div key={item[0]}><div style={{color:"rgba(255,255,255,.5)",fontSize:10,fontFamily:"monospace",textTransform:"uppercase",marginBottom:3}}>{item[0]}</div><div style={{color:item[2],fontWeight:800,fontSize:20}}>{item[1]}</div></div>;
        })}
      </div>}
      {(p.length+d.length)>0&&<div style={{background:"white",borderRadius:12,padding:"14px 16px",marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:8,fontSize:12,color:"#999",fontFamily:"monospace",textTransform:"uppercase"}}>
          <span>Progression {currentYear}</span>
          <span style={{color:"#111",fontWeight:700}}>{d.length}/{p.length+d.length} - {pct}%</span>
        </div>
        <div style={{height:10,background:"#f0ede6",borderRadius:5,overflow:"hidden"}}>
          <div style={{height:"100%",width:pct+"%",background:"linear-gradient(90deg,#1a3d2b,#5dbb7a)",borderRadius:5}}/>
        </div>
      </div>}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
        {[{icon:"📂",t:"Importer",d:"Excel",fn:onImport,c:"#f0a500",off:false},{icon:"⚡",t:"Generer",d:p.length+" chantiers",fn:onPlan,c:"#5ab8e0",off:p.length===0},{icon:"🗺️",t:"Carte",d:"Voir les clients",fn:onCarte,c:"#1e8449",off:false}].map(function(card){
          return <div key={card.t} onClick={card.off?null:card.fn} style={{background:"white",borderRadius:12,padding:"14px",cursor:card.off?"default":"pointer",opacity:card.off?0.6:1,borderTop:"3px solid "+card.c}} onMouseEnter={function(e){if(!card.off)e.currentTarget.style.transform="translateY(-2px)";}} onMouseLeave={function(e){e.currentTarget.style.transform="";}}>
            <div style={{fontSize:22,marginBottom:6}}>{card.icon}</div>
            <div style={{fontWeight:700,fontSize:13,color:"#111",marginBottom:2}}>{card.t}</div>
            <div style={{fontSize:12,color:"#999"}}>{card.d}</div>
          </div>;
        })}
      </div>
    </div>
  );
}

var FIELD_LABELS={name:"Nom client",address:"Adresse",cp:"Code postal",ville:"Ville",nbrCaissons:"Nb caissons",bon:"Bon / Ref"};
var FIELD_REQUIRED={name:true,address:true,cp:false,ville:false,nbrCaissons:false,bon:false};

function ImportView({onConfirm,fileRef,loading,error,result,onDrop,pending,onReset}){
  return (
    <div>
      <h2 style={{fontSize:22,fontWeight:800,color:"#111",marginBottom:14}}>Import Excel</h2>
      {!pending&&<div onDrop={onDrop} onDragOver={function(e){e.preventDefault();}} onClick={function(){fileRef.current.click();}}
        style={{border:"2px dashed #c8c3b8",borderRadius:14,padding:40,textAlign:"center",cursor:"pointer",background:"white",marginBottom:14}}
        onMouseEnter={function(e){e.currentTarget.style.borderColor="#f0a500";e.currentTarget.style.background="#fffaf0";}}
        onMouseLeave={function(e){e.currentTarget.style.borderColor="#c8c3b8";e.currentTarget.style.background="white";}}>
        <div style={{fontSize:32,marginBottom:8}}>{loading?"⏳":"📂"}</div>
        <div style={{fontWeight:700,fontSize:15,color:"#111",marginBottom:4}}>{loading?"Lecture...":"Glissez votre fichier Excel ici"}</div>
        <div style={{color:"#aaa",fontSize:13}}>ou cliquez - .xlsx .xls .csv</div>
        {error&&<div style={{marginTop:10,color:"#c0392b",fontWeight:600,fontSize:13}}>Erreur: {error}</div>}
      </div>}
      {pending&&<ColumnMapper headers={pending.headers} rows={pending.rows} initial={pending.mapping} onConfirm={onConfirm} onCancel={onReset}/>}
      {result&&!pending&&<div style={{background:"#1a3d2b",borderRadius:12,padding:16,marginTop:12}}>
        <div style={{color:"#5dbb7a",fontFamily:"monospace",fontSize:11,textTransform:"uppercase",marginBottom:12}}>Import termine - {result.total} lignes</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
          {[["Nouveaux",result.stats.added,"#5dbb7a"],["Reactives",result.stats.reactivated,"#5ab8e0"],["Termines",result.stats.alreadyDone,"#d97de8"],["Attente",result.stats.pending,"#f0a500"],["Desactives",result.stats.deactivated,"#e07070"],["Doublons",result.stats.dups,"#888"]].map(function(item){
            return <div key={item[0]} style={{background:"rgba(255,255,255,.07)",borderRadius:8,padding:"8px 12px"}}><div style={{color:item[2],fontWeight:800,fontSize:20}}>{item[1]}</div><div style={{color:"rgba(255,255,255,.55)",fontSize:11,marginTop:2}}>{item[0]}</div></div>;
          })}
        </div>
        <div style={{marginTop:10}}><Btn onClick={onReset} v="ghost" sm={true}>Nouvel import</Btn></div>
      </div>}
    </div>
  );
}

function ColumnMapper({headers,rows,initial,onConfirm,onCancel}){
  var [mapping,setMapping]=useState(initial,[]);
  var preview=rows.slice(0,3);
  var selStyle={border:"1.5px solid #ddd",borderRadius:7,padding:"5px 8px",fontSize:12,fontFamily:"monospace",outline:"none",width:"100%",background:"white"};
  var setField=function(field,val){setMapping(function(m){return Object.assign({},m,{[field]:val===""?null:Number(val)});});};
  var ok=FIELD_REQUIRED.name?(mapping.name!==null&&mapping.name!==undefined):true;
  return (
    <div style={{background:"white",borderRadius:14,padding:18,marginBottom:14}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
        <div>
          <div style={{fontWeight:800,fontSize:16,color:"#111"}}>Verifier les colonnes detectees</div>
          <div style={{fontSize:12,color:"#888",marginTop:2}}>{headers.length} colonnes trouvees - {rows.length} lignes</div>
        </div>
        <button onClick={onCancel} style={{background:"none",border:"none",cursor:"pointer",fontSize:20,color:"#ccc"}}>x</button>
      </div>
      <div style={{display:"grid",gap:8,marginBottom:16}}>
        {Object.keys(FIELD_LABELS).map(function(field){
          var idx=mapping[field];
          var detected=idx!==null&&idx!==undefined&&idx>=0;
          var req=FIELD_REQUIRED[field];
          return <div key={field} style={{display:"grid",gridTemplateColumns:"140px 1fr 1fr",gap:10,alignItems:"center",padding:"8px 10px",borderRadius:8,background:detected?"#f0fdf4":"#fafafa",border:"1px solid "+( detected?"#86efac":"#e5e7eb")}}>
            <div style={{fontSize:12,fontWeight:700,color:"#333"}}>
              {FIELD_LABELS[field]}
              {req&&<span style={{color:"#e74c3c",marginLeft:4}}>*</span>}
              {detected?<span style={{marginLeft:6,fontSize:10,color:"#16a34a",fontFamily:"monospace"}}>OK</span>:<span style={{marginLeft:6,fontSize:10,color:"#f0a500",fontFamily:"monospace"}}>{req?"REQUIS":"optionnel"}</span>}
            </div>
            <select value={idx!==null&&idx!==undefined?idx:""} onChange={function(e){setField(field,e.target.value);}} style={selStyle}>
              <option value="">-- non detecte --</option>
              {headers.map(function(h,i){return <option key={i} value={i}>{h||"(colonne "+(i+1)+")"}</option>;})}
            </select>
            <div style={{fontSize:11,color:"#999",fontFamily:"monospace",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
              {idx!==null&&idx!==undefined&&idx>=0&&preview.length>0?preview.map(function(r){return String(r[idx]||"");}).filter(Boolean).slice(0,2).join(" / "):"—"}
            </div>
          </div>;
        })}
      </div>
      <div style={{background:"#f8f5ef",borderRadius:10,padding:"10px 12px",marginBottom:14}}>
        <div style={{fontSize:11,fontFamily:"monospace",color:"#999",textTransform:"uppercase",marginBottom:6}}>Apercu (3 premieres lignes)</div>
        <div style={{overflowX:"auto"}}>
          <table style={{fontSize:11,fontFamily:"monospace",borderCollapse:"collapse",width:"100%"}}>
            <thead><tr>{headers.map(function(h,i){return <th key={i} style={{padding:"3px 8px",background:"#111",color:"white",fontWeight:700,textAlign:"left",whiteSpace:"nowrap"}}>{h||"Col "+(i+1)}</th>;})}</tr></thead>
            <tbody>{preview.map(function(row,ri){return <tr key={ri} style={{background:ri%2===0?"white":"#f8f5ef"}}>{headers.map(function(h,ci){return <td key={ci} style={{padding:"3px 8px",borderBottom:"1px solid #f0ede6",whiteSpace:"nowrap",maxWidth:120,overflow:"hidden",textOverflow:"ellipsis"}}>{String(row[ci]||"")}</td>;})}</tr>;})}</tbody>
          </table>
        </div>
      </div>
      <div style={{display:"flex",gap:8}}>
        <Btn onClick={function(){onConfirm(mapping);}} v="amber" disabled={!ok}>Confirmer et importer</Btn>
        <Btn onClick={onCancel} v="ghost">Annuler</Btn>
      </div>
    </div>
  );
}

function ClientsView({clients,setClients}){
  var [filtre,setFiltre]=useState("pending",[]);
  var [search,setSearch]=useState("",[]);
  var [page,setPage]=useState(0,[]);
  var PER=50;
  var visible=clients.filter(function(c){
    if(filtre!=="all"&&c.status!==filtre)return false;
    if(search){var q=norm(search);return norm(c.name).includes(q)||norm(c.address).includes(q)||norm(c.ville||"").includes(q);}
    return true;
  });
  var paged=visible.slice(page*PER,(page+1)*PER),pages=Math.ceil(visible.length/PER);
  var setStatus=function(id,st){setClients(function(prev){return prev.map(function(c){return c.id===id?Object.assign({},c,{status:st,doneDate:st==="done"?today():c.doneDate}):c;});});};
  var counts={all:clients.length,pending:clients.filter(function(c){return c.status==="pending";}).length,done:clients.filter(function(c){return c.status==="done";}).length,inactive:clients.filter(function(c){return c.status==="inactive";}).length};
  return (
    <div>
      <h2 style={{fontSize:22,fontWeight:800,color:"#111",marginBottom:14}}>Clients ({clients.length})</h2>
      <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
        {[["pending","En attente"],["done","Termines"],["inactive","Inactifs"],["all","Tous"]].map(function(item){
          return <button key={item[0]} onClick={function(){setFiltre(item[0]);setPage(0);}} style={{border:"none",borderRadius:8,padding:"6px 14px",cursor:"pointer",fontFamily:"inherit",fontWeight:600,fontSize:13,background:filtre===item[0]?"#111":"#e8e4dc",color:filtre===item[0]?"white":"#555"}}>{item[1]} ({counts[item[0]]})</button>;
        })}
        <input type="text" placeholder="Rechercher..." value={search} onChange={function(e){setSearch(e.target.value);setPage(0);}} style={{marginLeft:"auto",border:"1.5px solid #ddd",borderRadius:8,padding:"6px 14px",fontSize:13,outline:"none",fontFamily:"inherit",width:200}}/>
      </div>
      <div style={{background:"white",borderRadius:12,overflow:"hidden"}}>
        {paged.length===0&&<div style={{padding:40,textAlign:"center",color:"#bbb"}}>Aucun client</div>}
        {paged.map(function(c,i){
          return <div key={c.id} style={{display:"grid",gridTemplateColumns:"1fr 1fr 100px 90px 80px",padding:"10px 16px",borderBottom:i<paged.length-1?"1px solid #f5f2ec":"none",alignItems:"center",opacity:c.status!=="pending"?0.65:1}}>
            <div>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <div style={{fontWeight:600,fontSize:13,color:"#111"}}>{c.name||"—"}</div>
              {c.history&&c.history.length>0&&<span title={c.history.map(function(h){return h.year+" ("+h.nbrCaissons+"c)";}).join(", ")} style={{fontSize:9,fontFamily:"monospace",background:"#1a3d2b",color:"#5dbb7a",borderRadius:3,padding:"1px 5px",cursor:"help"}}>{c.history.length}x</span>}
            </div>
            {c.bon&&<div style={{fontSize:10,color:"#aaa",fontFamily:"monospace"}}>{c.bon}</div>}
          </div>
            <div style={{fontSize:12,color:"#777",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",paddingRight:8}}>{c.address||"—"}</div>
            <div style={{fontSize:11,color:"#999",fontFamily:"monospace"}}>{c.ville}</div>
            <Pill status={c.status}/>
            <div style={{display:"flex",gap:4}}>
              {c.status==="pending"&&<Btn onClick={function(){setStatus(c.id,"done");}} v="green" sm={true}>OK</Btn>}
              {c.status==="done"&&<Btn onClick={function(){setStatus(c.id,"pending");}} v="ghost" sm={true}>Undo</Btn>}
              {c.status==="inactive"&&<Btn onClick={function(){setStatus(c.id,"pending");}} v="ghost" sm={true}>Act.</Btn>}
            </div>
          </div>;
        })}
      </div>
      {pages>1&&<div style={{display:"flex",justifyContent:"center",gap:8,marginTop:12}}>
        <Btn onClick={function(){setPage(function(p){return Math.max(0,p-1);});}} v="ghost" sm={true} disabled={page===0}>Prec.</Btn>
        <span style={{padding:"6px 12px",fontFamily:"monospace",fontSize:13,color:"#555"}}>{page+1}/{pages}</span>
        <Btn onClick={function(){setPage(function(p){return Math.min(pages-1,p+1);});}} v="ghost" sm={true} disabled={page===pages-1}>Suiv.</Btn>
      </div>}
    </div>
  );
}

function SlotRow({slot,client,onCheck,onPartial}){
  var [open,setOpen]=useState(false,[]);
  var [nb,setNb]=useState(slot.nbrCaissons,[]);
  if(!client)return null;
  var total=slot.nbrCaissons;
  var validate=function(){if(nb>=total)onCheck(client.id);else if(onPartial)onPartial(client.id,nb);setOpen(false);};
  return (
    <div style={{marginBottom:5}}>
      <div style={{display:"flex",alignItems:"center",gap:8,padding:"9px 12px",background:slot.overtime?"#fff5f5":"#f8f5ef",borderRadius:open?"10px 10px 0 0":8}}>
        <div onClick={function(){setOpen(function(o){return !o;});}} style={{width:22,height:22,border:"2px solid "+(open?"#1a3d2b":"#ccc"),borderRadius:5,cursor:"pointer",flexShrink:0,background:open?"#d1f0d8":"",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"#1a3d2b",fontWeight:700}}>{open?"X":"V"}</div>
        <div style={{minWidth:90,display:"flex",flexDirection:"column",alignItems:"flex-end"}}>
          <span style={{fontFamily:"monospace",fontSize:11,background:"#111",color:"#f8f5ef",borderRadius:4,padding:"2px 7px",fontWeight:700}}>{slot.startClock}</span>
          <span style={{fontFamily:"monospace",fontSize:9,color:"#aaa",marginTop:1}}>{slot.endClock}</span>
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontWeight:700,fontSize:13,color:"#111"}}>{client.name}</div>
          <div style={{fontSize:11,color:"#888",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{client.address}</div>
        </div>
        <span style={{fontSize:10,fontFamily:"monospace",background:slot.zoneCol+"22",color:slot.zoneCol,borderRadius:4,padding:"1px 6px",flexShrink:0}}>{slot.nbrCaissons}c/{slot.dur}m</span>
      </div>
      {open&&<div style={{background:"white",border:"1px solid #e0ddd5",borderTop:"none",borderRadius:"0 0 8px 8px",padding:"10px 12px",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
        <span style={{fontSize:13,color:"#555",fontWeight:600}}>Realises:</span>
        <div style={{display:"flex",gap:5}}>
          {Array.from({length:total},function(_,i){return i+1;}).map(function(n){
            return <button key={n} onClick={function(){setNb(n);}} style={{width:30,height:30,borderRadius:6,border:"none",cursor:"pointer",fontWeight:700,fontSize:13,fontFamily:"inherit",background:nb===n?(n===total?"#1a3d2b":"#f0a500"):"#f0ede6",color:nb===n?"white":"#555"}}>{n}</button>;
          })}
        </div>
        <div style={{display:"flex",gap:6,marginLeft:"auto"}}>
          <button onClick={validate} style={{background:nb<total?"#f0a500":"#1a3d2b",color:"white",border:"none",borderRadius:7,padding:"6px 14px",fontWeight:700,cursor:"pointer",fontSize:12,fontFamily:"inherit"}}>{nb<total?"Valider partiel":"Valider tout"}</button>
          <button onClick={function(){setOpen(false);}} style={{background:"#e8e4dc",color:"#555",border:"none",borderRadius:7,padding:"6px 10px",cursor:"pointer",fontSize:12,fontFamily:"inherit"}}>Annuler</button>
        </div>
      </div>}
    </div>
  );
}

function geocodeWithAI(batch){
  var liste=batch.map(function(c){return{id:c.id,adr:[c.address,c.cp,c.ville].filter(Boolean).join(", ")};});
  var prompt="Coordonnees GPS France. JSON uniquement: {\"id1\":{\"lat\":43.6,\"lon\":1.44},...}. Adresses: "+JSON.stringify(liste);
  return fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,messages:[{role:"user",content:prompt}]})})
  .then(function(res){if(!res.ok)throw new Error("API "+res.status);return res.json();})
  .then(function(data){var raw=data.content&&data.content.map(function(b){return b.text||"";}).join("").trim();var m=raw.match(/\{[\s\S]*\}/);if(!m)throw new Error("No JSON");return JSON.parse(m[0]);});
}

function buildGMapsUrl(slots,clients,coords){
  var cm={};clients.forEach(function(c){cm[c.id]=c;});
  var pts=slots.map(function(sl){var c=cm[sl.clientId];if(!c)return null;var p=coords[c.id];return p?p.lat+","+p.lon:c.address+" "+c.ville;}).filter(Boolean);
  if(!pts.length)return null;
  if(pts.length===1)return "https://www.google.com/maps/dir/?api=1&destination="+encodeURIComponent(pts[0]);
  var url="https://www.google.com/maps/dir/?api=1&origin="+encodeURIComponent(pts[0])+"&destination="+encodeURIComponent(pts[pts.length-1]);
  var wps=pts.slice(1,-1);if(wps.length)url+="&waypoints="+wps.map(encodeURIComponent).join("|");
  return url+"&travelmode=driving";
}

function GpsButton({journee,clients}){
  var [coords,setCoords]=useState({},[]);
  var [open,setOpen]=useState(false,[]);
  useEffect(function(){S.get(GEOCODE_KEY).then(function(c){if(c)setCoords(c);});},[]);
  var has=journee.slots.some(function(sl){var c=clients.find(function(cl){return cl.id===sl.clientId;});return c&&coords[c.id];});
  if(!has)return null;
  return (
    <div style={{position:"relative"}}>
      <button className="no-print" onClick={function(){setOpen(function(o){return !o;});}} style={{background:"#1a3d6e",color:"white",border:"none",borderRadius:8,padding:"6px 12px",fontFamily:"inherit",fontWeight:700,fontSize:12,cursor:"pointer"}}>GPS</button>
      {open&&<div style={{position:"absolute",top:"110%",right:0,background:"white",borderRadius:10,boxShadow:"0 4px 20px rgba(0,0,0,.2)",border:"1px solid #eee",zIndex:50,minWidth:160,overflow:"hidden"}}>
        <button onClick={function(){var u=buildGMapsUrl(journee.slots,clients,coords);if(u)window.open(u,"_blank");setOpen(false);}} style={{display:"block",width:"100%",padding:"12px 14px",border:"none",background:"white",cursor:"pointer",fontSize:13,fontFamily:"inherit",borderBottom:"1px solid #f0ede6",textAlign:"left"}} onMouseEnter={function(e){e.currentTarget.style.background="#f8f5ef";}} onMouseLeave={function(e){e.currentTarget.style.background="white";}}>Google Maps</button>
        <button onClick={function(){setOpen(false);}} style={{display:"block",width:"100%",padding:"7px",border:"none",background:"#f8f5ef",cursor:"pointer",fontSize:11,color:"#aaa",fontFamily:"inherit"}}>Fermer</button>
      </div>}
    </div>
  );
}

function recalcSlotTimes(slots){
  var cursor=WS,cumWork=0,pauseDone=false;
  return slots.map(function(sl){
    var d=sl.dur;
    if(!pauseDone&&cumWork>=PAUSE_AT){cursor=cursor-GAP+PAUSE;pauseDone=true;}
    var s=cursor,e=cursor+d;cursor=e+GAP;cumWork+=d;
    return Object.assign({},sl,{startClock:fmt(s),endClock:fmt(e),startMin:s,overtime:e>WE});
  });
}

function fmtDate(d){if(!d)return null;var dt=new Date(d);var days=["Dim","Lun","Mar","Mer","Jeu","Ven","Sam"];var months=["jan","fev","mar","avr","mai","juin","juil","aout","sep","oct","nov","dec"];return days[dt.getDay()]+" "+dt.getDate()+" "+months[dt.getMonth()];}

function TechManager({techs,setTechs}){
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
    fetch("https://forms.kizeo.com/rest/v3/users",{headers:{"Authorization":kizeoToken}})
    .then(function(r){if(!r.ok)throw new Error("HTTP "+r.status);return r.json();})
    .then(function(d){
      var kUsers=(d.users||[]).map(function(u){return{id:"kizeo_"+u.id,name:((u.first_name||"")+" "+(u.last_name||"")).trim()||u.login,kizeoId:u.id};});
      setTechs(function(prev){
        var existing={};prev.forEach(function(t){existing[t.id]=true;});
        var toAdd=kUsers.filter(function(u){return !existing[u.id];});
        return prev.concat(toAdd);
      });
    }).catch(function(e){setErr("Erreur Kizeo: "+e.message);})
    .then(function(){setLoading(false);});
  };
  return (
    <div style={{background:"white",borderRadius:12,padding:"14px 16px",marginBottom:10}}>
      <div style={{fontWeight:700,fontSize:13,color:"#111",marginBottom:10}}>Techniciens</div>
      <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap"}}>
        <input value={newName} onChange={function(e){setNewName(e.target.value);}} onKeyDown={function(e){if(e.key==="Enter")add();}} placeholder="Nom du technicien..." style={{border:"1.5px solid #ddd",borderRadius:7,padding:"6px 10px",fontSize:13,outline:"none",fontFamily:"inherit",flex:1,minWidth:140}}/>
        <Btn onClick={add} v="amber" sm={true} disabled={!newName.trim()}>+ Ajouter</Btn>
        <Btn onClick={syncKizeo} v="ghost" sm={true} disabled={loading}>{loading?"Sync...":"Sync Kizeo"}</Btn>
      </div>
      {err&&<div style={{fontSize:12,color:"#e74c3c",marginBottom:8}}>{err}</div>}
      {techs.length>0&&<div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
        {techs.map(function(t){return <div key={t.id} style={{display:"flex",alignItems:"center",gap:5,background:"#f8f5ef",borderRadius:7,padding:"4px 10px",fontSize:12,fontWeight:600}}>
          <span style={{width:22,height:22,borderRadius:"50%",background:"#1a3d2b",color:"white",display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,flexShrink:0}}>{t.name.charAt(0).toUpperCase()}</span>
          {t.name}
          {t.kizeoId&&<span style={{fontSize:9,color:"#5dbb7a",fontFamily:"monospace"}}>K</span>}
          <button onClick={function(){remove(t.id);}} style={{background:"none",border:"none",cursor:"pointer",color:"#ccc",fontSize:14,lineHeight:1,padding:0}}>x</button>
        </div>;})}
      </div>}
      {techs.length===0&&<div style={{fontSize:12,color:"#aaa"}}>Aucun technicien — ajoutez-en ou synchronisez depuis Kizeo</div>}
    </div>
  );
}

function PlanningView({clients,planning,setPlanning,otMin,setOtMin,onGenerate,onCheck,onPartial,techs,setTechs,journeeDates,setJourneeDate}){
  var cMap={};clients.forEach(function(c){cMap[c.id]=c;});
  var pending=clients.filter(function(c){return c.status==="pending";}).length;
  var [filtre,setFiltre]=useState("all",[]);
  var [dragSrc,setDragSrc]=useState(null);
  var [dragOver,setDragOver]=useState(null);
  var [ghostPos,setGhostPos]=useState({x:0,y:0});
  var dragSrcRef=useRef(null);
  var dragOverRef=useRef(null);
  var commitDrop=function(src,toJId,toSIdx){
    if(!src||!planning)return;
    var newJ=planning.journees.map(function(j){return Object.assign({},j,{slots:j.slots.slice()});});
    var fromJ=newJ.find(function(j){return j.id===src.jId;});
    var toJ=newJ.find(function(j){return j.id===toJId;});
    if(!fromJ||!toJ)return;
    var realToIdx=(src.jId===toJId&&src.sIdx<toSIdx)?toSIdx-1:toSIdx;
    var moved=fromJ.slots.splice(src.sIdx,1)[0];
    if(!moved)return;
    toJ.slots.splice(realToIdx,0,moved);
    newJ=newJ.filter(function(j){return j.slots.length>0;});
    newJ.forEach(function(j,i){
      j.num=i+1;
      j.slots=recalcSlotTimes(j.slots);
      j.totalWork=j.slots.reduce(function(s,sl){return s+sl.dur;},0);
      var last=j.slots[j.slots.length-1];
      j.finHeure=last?last.endClock:"16:00";
      j.sousCharge=j.totalWork<MIN_WORK;
      j.overtime=j.slots.some(function(sl){return sl.overtime;});
    });
    setPlanning(Object.assign({},planning,{journees:newJ}));
  };
  var renderSlot=function(sl,absIdx,j,ji){
    var c=cMap[sl.clientId];
    var isDragging=dragSrc&&dragSrc.jId===j.id&&dragSrc.sIdx===absIdx;
    var isOver=dragOver&&dragOver.jId===j.id&&dragOver.sIdx===absIdx;
    var showLine=isOver&&dragSrc&&!(dragSrc.jId===j.id&&dragSrc.sIdx===absIdx);
    var onHandleMouseDown=function(e){
      e.preventDefault();
      var src={jId:j.id,sIdx:absIdx,clientId:sl.clientId,label:c?c.name:"RDV"};
      dragSrcRef.current=src;
      dragOverRef.current=null;
      setDragSrc(src);
      setGhostPos({x:e.clientX+12,y:e.clientY-16});
      var onMove=function(ev){
        setGhostPos({x:ev.clientX+12,y:ev.clientY-16});
      };
      var onUp=function(ev){
        window.removeEventListener("mousemove",onMove);
        window.removeEventListener("mouseup",onUp);
        var over=dragOverRef.current;
        if(over&&dragSrcRef.current){
          commitDrop(dragSrcRef.current,over.jId,over.sIdx);
        }
        dragSrcRef.current=null;
        dragOverRef.current=null;
        setDragSrc(null);
        setDragOver(null);
      };
      window.addEventListener("mousemove",onMove);
      window.addEventListener("mouseup",onUp);
    };
    return <div key={j.id+"-"+absIdx} style={{position:"relative"}}
      onMouseEnter={function(){if(dragSrcRef.current){dragOverRef.current={jId:j.id,sIdx:absIdx};setDragOver({jId:j.id,sIdx:absIdx});}}}
      onMouseLeave={function(){if(dragSrcRef.current&&dragOverRef.current&&dragOverRef.current.jId===j.id&&dragOverRef.current.sIdx===absIdx){dragOverRef.current=null;setDragOver(null);}}}>
      {showLine&&<div style={{height:4,background:"linear-gradient(90deg,transparent,#f0a500,#ffd166,#f0a500,transparent)",borderRadius:3,margin:"3px 0",position:"relative",boxShadow:"0 0 10px #f0a50066",zIndex:10}}>
        <div style={{position:"absolute",left:0,top:-4,width:12,height:12,borderRadius:"50%",background:"#f0a500",border:"2px solid white",boxShadow:"0 0 6px #f0a500"}}/>
        <div style={{position:"absolute",right:0,top:-4,width:12,height:12,borderRadius:"50%",background:"#f0a500",border:"2px solid white",boxShadow:"0 0 6px #f0a500"}}/>
        <div style={{position:"absolute",left:"50%",transform:"translateX(-50%)",top:-14,background:"#f0a500",color:"#111",fontSize:10,fontWeight:800,fontFamily:"monospace",padding:"2px 10px",borderRadius:4,whiteSpace:"nowrap",boxShadow:"0 2px 6px rgba(0,0,0,.2)"}}>deposer ici</div>
      </div>}
      <div style={{display:"flex",alignItems:"stretch",opacity:isDragging?0.2:1,transition:"opacity .15s",marginBottom:1}}>
        <div onMouseDown={onHandleMouseDown}
          style={{display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"center",gap:3,padding:"0 7px",cursor:"grab",borderRadius:"8px 0 0 8px",background:"#eceae4",flexShrink:0,userSelect:"none"}}
          onMouseEnter={function(e){e.currentTarget.style.background="#f0a50033";e.currentTarget.style.cursor="grabbing";}}
          onMouseLeave={function(e){e.currentTarget.style.background="#eceae4";e.currentTarget.style.cursor="grab";}}>
          {[0,1,2].map(function(i){return <div key={i} style={{display:"flex",gap:3}}>{[0,1].map(function(k){return <div key={k} style={{width:3,height:3,borderRadius:"50%",background:"#bbb"}}/>;})}</div>;})}
        </div>
        <div style={{flex:1,minWidth:0}}>
          <SlotRow slot={sl} client={c} onCheck={onCheck} onPartial={onPartial}/>
        </div>
      </div>
    </div>;
  };
  var jours=(planning?planning.journees:[]).filter(function(j){if(filtre==="incomplet")return j.sousCharge;if(filtre==="overtime")return j.overtime;return true;});
  return (
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
        <div>
          <h2 style={{fontSize:22,fontWeight:800,color:"#111",marginBottom:2}}>Planning</h2>
          <p style={{color:"#888",fontSize:14}}>{planning?(planning.journees.length+" journees - "+planning.journees.reduce(function(s,j){return s+j.slots.length;},0)+" chantiers"):"Aucun planning"}</p>
        </div>
        {planning&&<Btn onClick={function(){window.print();}} v="ghost">Imprimer</Btn>}
      </div>
      <TechManager techs={techs||[]} setTechs={setTechs}/>
      <div style={{background:"white",borderRadius:12,padding:"14px 16px",marginBottom:10}}>
        <div style={{fontWeight:700,fontSize:13,color:"#111",marginBottom:8}}>Dates de debut de tournee</div>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          <div style={{fontSize:12,color:"#555"}}>Debut:</div>
          <input type="date" id="startDatePicker" style={{border:"1.5px solid #ddd",borderRadius:7,padding:"5px 10px",fontSize:12,outline:"none",fontFamily:"monospace"}}/>
          <Btn v="ghost" sm={true} onClick={function(){
            var sd=document.getElementById("startDatePicker").value;
            if(!sd||!planning)return;
            var dt=new Date(sd),newDates={};
            planning.journees.forEach(function(j){
              while(dt.getDay()===0||dt.getDay()===6){dt.setDate(dt.getDate()+1);}
              newDates[j.id]=dt.toISOString().split("T")[0];
              dt.setDate(dt.getDate()+1);
            });
            planning.journees.forEach(function(j){setJourneeDate(j.id,newDates[j.id]);});
          }}>Remplir auto (jours ouvrables)</Btn>
          <Btn v="ghost" sm={true} onClick={function(){if(planning)planning.journees.forEach(function(j){setJourneeDate(j.id,"");});}}>Effacer</Btn>
        </div>
      </div>
      <div style={{background:"white",borderRadius:12,padding:"14px 16px",marginBottom:12}}>
        <div style={{display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
          <div style={{flex:1,minWidth:200}}>
            <div style={{fontSize:13,color:"#555",marginBottom:5}}>Heures supp.: <strong style={{color:"#f0a500"}}>{otMin>0?"+"+otMin+"min":"Aucune"}</strong></div>
            <input type="range" min={0} max={90} step={15} value={otMin} onChange={function(e){setOtMin(Number(e.target.value));}} style={{width:"100%",accentColor:"#f0a500"}}/>
            <div style={{fontSize:11,color:"#aaa",marginTop:3}}>Sur site 08:30 - Fin 16:{String(otMin).padStart(2,"0")}</div>
          </div>
          <Btn onClick={onGenerate} v="amber" disabled={pending===0} style={{padding:"12px 26px",fontSize:15}}>Generer ({pending})</Btn>
        </div>
      </div>
      {planning&&planning.casAPart&&planning.casAPart.length>0&&<div style={{background:"#fff8f0",borderRadius:12,border:"1px solid #f0a500",padding:"12px 14px",marginBottom:12}}>
        <div style={{fontFamily:"monospace",fontSize:10,color:"#f0a500",textTransform:"uppercase",marginBottom:8}}>Cas a part</div>
        {planning.casAPart.map(function(c){return <div key={c.id} style={{padding:"7px 10px",background:"#fff3dc",borderRadius:8,marginBottom:5}}><strong>{c.name}</strong> - {c.address}</div>;})}
      </div>}
      {!planning&&<div style={{textAlign:"center",padding:50,background:"white",borderRadius:14}}>
        <div style={{fontSize:44,marginBottom:12}}>⚡</div>
        <div style={{fontWeight:700,fontSize:17,color:"#111",marginBottom:6}}>Pret a generer</div>
        <div style={{color:"#999",fontSize:14}}>Importez un Excel puis cliquez sur Generer</div>
      </div>}
      {planning&&<div>
        {dragSrc&&<div style={{position:"fixed",left:ghostPos.x,top:ghostPos.y,zIndex:9999,pointerEvents:"none",background:"#111",color:"white",borderRadius:8,padding:"6px 12px",fontSize:12,fontWeight:700,fontFamily:"monospace",boxShadow:"0 4px 20px rgba(0,0,0,.4)",whiteSpace:"nowrap",border:"2px solid #f0a500",transform:"rotate(-2deg)"}}>
        ✋ {dragSrc.label||"RDV"}
      </div>}
      {dragSrc&&<div style={{background:"linear-gradient(90deg,#111,#1a3d2b)",borderRadius:10,padding:"10px 16px",marginBottom:10,display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:10,height:10,borderRadius:"50%",background:"#f0a500",animation:"pulse 1s infinite"}}/>
          <span style={{color:"white",fontSize:12,fontFamily:"monospace",fontWeight:700}}>Glissez le rendez-vous vers sa nouvelle position</span>
          <span style={{color:"rgba(255,255,255,.5)",fontSize:11,marginLeft:"auto"}}>Relacher pour deposer</span>
        </div>}
        <div style={{display:"flex",gap:6,marginBottom:10}}>
          {[["all","Toutes"],["incomplet","Incompletes"],["overtime","Heures supp"]].map(function(item){
            return <button key={item[0]} onClick={function(){setFiltre(item[0]);}} style={{border:"none",borderRadius:8,padding:"5px 12px",cursor:"pointer",fontFamily:"inherit",fontWeight:600,fontSize:12,background:filtre===item[0]?"#111":"#e8e4dc",color:filtre===item[0]?"white":"#555"}}>{item[1]}</button>;
          })}
        </div>
        {jours.map(function(j,ji){
          var bg=PAL[ji%PAL.length],acc=ACC[ji%ACC.length];
          var tw=j.totalWork,hh=Math.floor(tw/60),mm=String(tw%60).padStart(2,"0");
          var nbc=j.slots.reduce(function(s,sl){return s+sl.nbrCaissons;},0);
          var cumW=0,pIdx=j.slots.length;
          for(var k=0;k<j.slots.length;k++){cumW+=j.slots[k].dur;if(cumW>=PAUSE_AT&&pIdx===j.slots.length){pIdx=k+1;break;}}
          var avant=j.slots.slice(0,pIdx),apres=j.slots.slice(pIdx);
          return <div key={j.id||ji} className="print-card" style={{background:"white",borderRadius:14,marginBottom:10,overflow:"hidden",boxShadow:"0 2px 10px rgba(0,0,0,.05)"}}>
            <div style={{background:bg,padding:"12px 16px"}}>
                  <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:10}}>
                <div style={{flex:1}}>
                  {j.sousCharge?<span style={{fontSize:10,background:"#f0a500",color:"#111",borderRadius:4,padding:"2px 8px",fontFamily:"monospace",fontWeight:700,marginBottom:4,display:"inline-block"}}>Incomplet {hh}h{mm}/7h</span>:null}
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,flexWrap:"wrap"}}>
                    <span style={{color:acc,fontFamily:"monospace",fontSize:10,letterSpacing:2,textTransform:"uppercase"}}>Journee {j.num}</span>
                    <input type="date" value={journeeDates&&journeeDates[j.id]||""} onChange={function(e){setJourneeDate(j.id,e.target.value);}}
                      style={{background:"rgba(255,255,255,.15)",border:"1px solid rgba(255,255,255,.25)",borderRadius:6,padding:"2px 8px",fontSize:11,color:"white",fontFamily:"monospace",outline:"none",cursor:"pointer"}}/>
                    {journeeDates&&journeeDates[j.id]&&<span style={{fontSize:11,color:acc,fontFamily:"monospace",fontWeight:700}}>{fmtDate(journeeDates[j.id])}</span>}
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                    <select value={(j.techId)||""} onChange={function(e){var tid=e.target.value;setPlanning(function(prev){if(!prev)return prev;return Object.assign({},prev,{journees:prev.journees.map(function(jj){return jj.id===j.id?Object.assign({},jj,{techId:tid,techName:techs.find(function(t){return t.id===tid;})?techs.find(function(t){return t.id===tid;}).name:""}):jj;})});});}}
                      style={{background:"rgba(255,255,255,.15)",border:"1px solid rgba(255,255,255,.25)",borderRadius:6,padding:"2px 8px",fontSize:11,color:"white",fontFamily:"monospace",outline:"none",cursor:"pointer",maxWidth:160}}>
                      <option value="" style={{color:"#111"}}>-- Technicien --</option>
                      {(techs||[]).map(function(t){return <option key={t.id} value={t.id} style={{color:"#111"}}>{t.name}</option>;}) }
                    </select>
                    {j.techName&&<span style={{fontSize:11,color:acc,fontWeight:700}}>👤 {j.techName}</span>}
                  </div>
                  <div style={{color:"white",fontWeight:700,fontSize:15}}>{j.zonesLabel}</div>
                  <div style={{color:"rgba(255,255,255,.55)",fontSize:11,fontFamily:"monospace",marginTop:2}}>{j.slots.length} chantiers - {nbc} caissons - <strong style={{color:j.sousCharge?"#f0a500":"rgba(255,255,255,.85)"}}>{hh}h{mm}</strong> - fin {j.finHeure}</div>
                </div>
                <div style={{display:"flex",gap:5,flexShrink:0}}>
                  <GpsButton journee={j} clients={clients}/>
                </div>
              </div>
              {j.travelMin>0&&<div style={{background:"rgba(255,255,255,.12)",borderRadius:8,padding:"8px 12px",marginTop:8,display:"flex",gap:16,alignItems:"center"}}>
                <div><div style={{color:"rgba(255,255,255,.5)",fontSize:9,fontFamily:"monospace"}}>Depart</div><div style={{color:"white",fontFamily:"monospace",fontSize:14,fontWeight:700}}>{j.departTime}</div></div>
                <div style={{flex:1,height:2,background:"rgba(255,255,255,.2)"}}/>
                <div><div style={{color:"rgba(255,255,255,.5)",fontSize:9,fontFamily:"monospace"}}>Sur site</div><div style={{color:acc,fontFamily:"monospace",fontSize:14,fontWeight:700}}>08:30</div></div>
              </div>}
            </div>
            <div style={{padding:"10px 16px 14px"}}>
              {avant.length>0&&<div>
                <div style={{fontFamily:"monospace",fontSize:9,color:acc,textTransform:"uppercase",marginBottom:7}}>Avant pause</div>
                {avant.map(function(sl,si){return renderSlot(sl,si,j,ji);})}
              </div>}
              {j.breakAt&&<div style={{display:"flex",alignItems:"center",gap:8,margin:"8px 0"}}>
                <div style={{flex:1,height:1,background:"#f0ede6"}}/>
                <div style={{fontSize:10,color:"#888",fontFamily:"monospace",padding:"3px 10px",background:"#f8f5ef",borderRadius:5}}>Pause - {j.breakAt}</div>
                <div style={{flex:1,height:1,background:"#f0ede6"}}/>
              </div>}
              {apres.length>0&&<div>
                <div style={{fontFamily:"monospace",fontSize:9,color:acc,textTransform:"uppercase",marginBottom:7}}>Apres pause</div>
                {apres.map(function(sl,si){return renderSlot(sl,pIdx+si,j,ji);})}
              </div>}
              {avant.length===0&&apres.length===0&&j.slots.map(function(sl,si){return renderSlot(sl,si,j,ji);})}
            {dragSrc&&dragSrc.jId!==j.id&&<div
              onMouseEnter={function(){if(dragSrcRef.current){var s=j.slots.length;dragOverRef.current={jId:j.id,sIdx:s};setDragOver({jId:j.id,sIdx:s});}}}
              onMouseLeave={function(){if(dragSrcRef.current){dragOverRef.current=null;setDragOver(null);}}}
              style={{height:44,borderRadius:10,border:"2px dashed "+(dragOver&&dragOver.jId===j.id?"#f0a500":"#ccc"),display:"flex",alignItems:"center",justifyContent:"center",gap:8,fontSize:12,color:dragOver&&dragOver.jId===j.id?"#f0a500":"#bbb",fontWeight:700,marginTop:8,transition:"all .15s",background:dragOver&&dragOver.jId===j.id?"#fff8f0":"transparent",transform:dragOver&&dragOver.jId===j.id?"scale(1.01)":"scale(1)"}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:dragOver&&dragOver.jId===j.id?"#f0a500":"#ccc",transition:"background .15s"}}/>
              {dragOver&&dragOver.jId===j.id?"Relacher pour deposer":"Deposer ici pour changer de journee"}
              <div style={{width:8,height:8,borderRadius:"50%",background:dragOver&&dragOver.jId===j.id?"#f0a500":"#ccc",transition:"background .15s"}}/>
            </div>}
            </div>
          </div>;
        })}
      </div>}
    </div>
  );
}

var TILE=256;
function ll2px(lat,lon,zoom){
  var n=Math.pow(2,zoom),x=((lon+180)/360)*n*TILE,s=Math.sin(lat*Math.PI/180),y=((1-Math.log((1+s)/(1-s))/(2*Math.PI))/2)*n*TILE;
  return{x:x,y:y};
}
function CarteView({clients,planning}){
  var W=820,H=520;
  var [coords,setCoords]=useState({},[]);
  var [loading,setLoading]=useState(false,[]);
  var [prog,setProg]=useState({done:0,total:0},[]);
  var [filtre,setFiltre]=useState("all",[]);
  var [dragSrc,setDragSrc]=useState(null);
  var [dragOver,setDragOver]=useState(null);
  var [ghostPos,setGhostPos]=useState({x:0,y:0});
  var dragSrcRef=useRef(null);
  var dragOverRef=useRef(null);
  var [sel,setSel]=useState(null,[]);
  var [view,setView]=useState({lat:43.6,lon:1.44,zoom:11},[]);
  var [showRoutes,setShowRoutes]=useState(false,[]);
  var [selJour,setSelJour]=useState(null,[]);
  var dragging=useRef(false),lastMouse=useRef(null),wheelAccum=useRef(0);
  var COL={pending:"#f0a500",done:"#5dbb7a",inactive:"#aaa"};

  useEffect(function(){S.get(GEOCODE_KEY).then(function(c){if(c)setCoords(c);});},[]);

  var handleGeocode=function(){
    var todo=clients.filter(function(c){return !coords[c.id]&&(c.address||c.ville);});
    if(!todo.length)return;
    setLoading(true);
    var nc=Object.assign({},coords);
    var doNext=function(i){
      if(i>=todo.length){
        setCoords(Object.assign({},nc));
        S.set(GEOCODE_KEY,nc);
        setProg({done:todo.length,total:todo.length});
        setLoading(false);
        handleFit();
        return;
      }
      var batch=todo.slice(i,i+50);
      setProg({done:i,total:todo.length});
      geocodeWithAI(batch).then(function(res){
        Object.assign(nc,res);
        setCoords(Object.assign({},nc));
        S.set(GEOCODE_KEY,nc);
      }).catch(function(e){console.error(e);}).then(function(){
        setTimeout(function(){doNext(i+50);},500);
      });
    };
    doNext(0);
  };

  var handleFit=function(){
    var pts=clients.filter(function(c){return coords[c.id]&&!isNaN(coords[c.id].lat);});
    if(!pts.length)return;
    var laMin=Infinity,laMax=-Infinity,loMin=Infinity,loMax=-Infinity;
    pts.forEach(function(c){var lat=coords[c.id].lat,lon=coords[c.id].lon;if(lat<laMin)laMin=lat;if(lat>laMax)laMax=lat;if(lon<loMin)loMin=lon;if(lon>loMax)loMax=lon;});
    var zoom=11;
    for(var z=13;z>=7;z--){var p1=ll2px(laMin,loMin,z),p2=ll2px(laMax,loMax,z);if(Math.abs(p2.x-p1.x)<W*0.8&&Math.abs(p1.y-p2.y)<H*0.8){zoom=z;break;}}
    setView({lat:(laMin+laMax)/2,lon:(loMin+loMax)/2,zoom:zoom});
    setSel(null);
  };

  var cp=ll2px(view.lat,view.lon,view.zoom),ox=cp.x-W/2,oy=cp.y-H/2;

  var tiles=React.useMemo(function(){
    var n=Math.pow(2,view.zoom),t=[];
    for(var tx=Math.floor(ox/TILE);tx<=Math.ceil((ox+W)/TILE);tx++){
      for(var ty=Math.floor(oy/TILE);ty<=Math.ceil((oy+H)/TILE);ty++){
        if(tx<0||ty<0||tx>=n||ty>=n)continue;
        var sub=["a","b","c"][(tx+ty)%3];
        t.push({key:view.zoom+"/"+tx+"/"+ty,url:"https://"+sub+".tile.openstreetmap.org/"+view.zoom+"/"+tx+"/"+ty+".png",left:tx*TILE-ox,top:ty*TILE-oy});
      }
    }
    return t;
  },[view.zoom,Math.round(ox),Math.round(oy)]);

  var toXY=function(lat,lon){var p=ll2px(lat,lon,view.zoom);return{x:p.x-ox,y:p.y-oy};};
  var geocoded=clients.filter(function(c){return coords[c.id];}).length;
  var missing=clients.filter(function(c){return !coords[c.id];}).length;
  var visible=clients.filter(function(c){return coords[c.id]&&!isNaN(coords[c.id].lat)&&(filtre==="all"||c.status===filtre);});
  var pct=prog.total>0?Math.round(prog.done/prog.total*100):0;

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
        <div><h2 style={{fontSize:22,fontWeight:800,color:"#111",marginBottom:2}}>Carte</h2><p style={{color:"#888",fontSize:14}}>{geocoded} geolocal. - {missing} restants</p></div>
        <div style={{display:"flex",gap:7}}>
          {missing>0&&!loading&&<Btn onClick={handleGeocode} v="amber">Localiser ({missing})</Btn>}
          {geocoded>0&&<Btn onClick={handleFit} v="ghost" sm={true}>Voir tout</Btn>}
          {geocoded>0&&<Btn onClick={function(){S.set(GEOCODE_KEY,{});setCoords({});setSel(null);}} v="ghost" sm={true}>Reset</Btn>}
        </div>
      </div>
      {loading&&<div style={{background:"#fff8f0",border:"1px solid #f0a500",borderRadius:10,padding:"10px 14px",marginBottom:10}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:5,fontSize:13,color:"#7a5000"}}><span>{prog.done}/{prog.total}</span><span style={{fontFamily:"monospace",fontWeight:700}}>{pct}%</span></div>
        <div style={{height:5,background:"#f0e0c0",borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:pct+"%",background:"#f0a500",borderRadius:3,transition:"width .3s"}}/></div>
      </div>}
      <div style={{background:"white",borderRadius:12,padding:"8px 12px",marginBottom:8,display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
        <div style={{display:"flex",gap:12}}>
          {[["pending","#f0a500","En attente"],["done","#5dbb7a","Termines"],["inactive","#aaa","Inactifs"]].map(function(item){
            return <div key={item[0]} style={{display:"flex",alignItems:"center",gap:4,fontSize:12,color:"#555"}}><div style={{width:12,height:12,borderRadius:"50%",background:item[1],border:"2px solid white",boxShadow:"0 1px 3px rgba(0,0,0,.3)",flexShrink:0}}/>{item[2]}</div>;
          })}
        </div>
        <div style={{marginLeft:"auto",display:"flex",gap:5,alignItems:"center",flexWrap:"wrap"}}>
          {[["all","Tous"],["pending","Attente"],["done","Termines"]].map(function(item){
            return <button key={item[0]} onClick={function(){setFiltre(item[0]);setSel(null);}} style={{border:"none",borderRadius:6,padding:"4px 10px",cursor:"pointer",fontFamily:"inherit",fontWeight:600,fontSize:11,background:filtre===item[0]?"#111":"#e8e4dc",color:filtre===item[0]?"white":"#555"}}>{item[1]}</button>;
          })}
          <button onClick={function(){setView(function(v){return{lat:v.lat,lon:v.lon,zoom:Math.min(17,v.zoom+1)};});}} style={{width:26,height:26,border:"1px solid #ddd",borderRadius:5,cursor:"pointer",fontWeight:700,fontSize:15,background:"white",lineHeight:1}}>+</button>
          <button onClick={function(){setView(function(v){return{lat:v.lat,lon:v.lon,zoom:Math.max(7,v.zoom-1)};});}} style={{width:26,height:26,border:"1px solid #ddd",borderRadius:5,cursor:"pointer",fontWeight:700,fontSize:15,background:"white",lineHeight:1}}>-</button>
          {planning&&planning.journees&&planning.journees.length>0&&<div style={{display:"flex",gap:4,borderLeft:"1px solid #eee",paddingLeft:6,flexWrap:"wrap"}}>
            <button onClick={function(){setShowRoutes(function(r){return !r;});}} style={{border:"1px solid #ddd",borderRadius:6,padding:"4px 10px",cursor:"pointer",fontFamily:"inherit",fontWeight:600,fontSize:11,background:showRoutes?"#111":"#e8e4dc",color:showRoutes?"white":"#555"}}>Tournees</button>
            {showRoutes&&<button onClick={function(){setSelJour(null);}} style={{border:"none",borderRadius:6,padding:"4px 10px",cursor:"pointer",fontFamily:"inherit",fontWeight:600,fontSize:11,background:selJour===null?"#f0a500":"#e8e4dc",color:selJour===null?"#111":"#555"}}>Toutes</button>}
            {showRoutes&&planning.journees.map(function(j,ji){var col=RCOLS[ji%RCOLS.length];return <button key={j.num} onClick={function(){setSelJour(selJour===j.num?null:j.num);}} style={{border:"2px solid "+col,borderRadius:6,padding:"3px 9px",cursor:"pointer",fontFamily:"monospace",fontWeight:700,fontSize:11,background:selJour===j.num?col:"white",color:selJour===j.num?"white":col}}>J{j.num}</button>;})}
          </div>}
        </div>
      </div>
      <div style={{position:"relative",width:"100%",height:H,borderRadius:14,overflow:"hidden",border:"1px solid #ddd",background:"#f2efe9",cursor:"grab",userSelect:"none"}}
        onClick={function(){setSel(null);}}
        onMouseDown={function(e){dragging.current=true;lastMouse.current={x:e.clientX,y:e.clientY};setSel(null);}}
        onMouseMove={function(e){
          if(!dragging.current||!lastMouse.current)return;
          var dx=e.clientX-lastMouse.current.x,dy=e.clientY-lastMouse.current.y;
          lastMouse.current={x:e.clientX,y:e.clientY};
          var n=Math.pow(2,view.zoom),dLon=(-dx/TILE)/n*360;
          var cPx=ll2px(view.lat,view.lon,view.zoom),newY=cPx.y+(-dy);
          var newLat=Math.atan(Math.sinh(Math.PI*(1-2*newY/(n*TILE))))*180/Math.PI;
          setView({lat:Math.max(-85,Math.min(85,newLat)),lon:view.lon+dLon,zoom:view.zoom});
        }}
        onMouseUp={function(){dragging.current=false;}}
        onMouseLeave={function(){dragging.current=false;}}
        onWheel={function(e){e.preventDefault();wheelAccum.current+=e.deltaY;if(Math.abs(wheelAccum.current)>=150){var nz=Math.max(7,Math.min(17,view.zoom+(wheelAccum.current<0?1:-1)));setView({lat:view.lat,lon:view.lon,zoom:nz});setSel(null);wheelAccum.current=0;}}}>
        {tiles.map(function(t){return <img key={t.key} src={t.url} alt="" draggable={false} style={{position:"absolute",left:Math.round(t.left),top:Math.round(t.top),width:TILE,height:TILE,display:"block"}} onError={function(e){e.currentTarget.style.display="none";}}/>;}) }
        {showRoutes&&planning&&planning.journees&&planning.journees.length>0&&<svg style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none",zIndex:8}}>
          <defs>
            {RCOLS.map(function(col,i){return <marker key={i} id={"arr"+i} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 z" fill={col} opacity="0.85"/></marker>;})}
          </defs>
          {planning.journees.filter(function(j){return selJour===null||j.num===selJour;}).map(function(j,ji){
            var col=RCOLS[ji%RCOLS.length];
            var pts=j.slots.map(function(sl){var c=clients.find(function(cl){return cl.id===sl.clientId;});if(!c||!coords[c.id])return null;return toXY(coords[c.id].lat,coords[c.id].lon);}).filter(Boolean);
            if(pts.length<2)return null;
            return <g key={j.id||ji}>
              {pts.slice(0,-1).map(function(p,k){return <line key={k} x1={Math.round(p.x)} y1={Math.round(p.y)} x2={Math.round(pts[k+1].x)} y2={Math.round(pts[k+1].y)} stroke={col} strokeWidth="2.5" strokeOpacity="0.85" markerEnd={"url(#arr"+ji%RCOLS.length+")"} strokeLinecap="round"/>;}) }
              {pts[0]&&<g><circle cx={Math.round(pts[0].x)} cy={Math.round(pts[0].y)} r="11" fill={col} opacity="0.92"/><text x={Math.round(pts[0].x)} y={Math.round(pts[0].y)+4} textAnchor="middle" fontSize="10" fontWeight="bold" fill="white">J{j.num}</text></g>}
            </g>;
          })}
        </svg>}
        <div style={{position:"absolute",bottom:4,right:6,fontSize:10,color:"#333",background:"rgba(255,255,255,.8)",padding:"2px 6px",borderRadius:4,zIndex:5,pointerEvents:"none"}}>OpenStreetMap</div>
        {geocoded===0&&!loading&&<div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:10,background:"rgba(242,239,233,.95)",zIndex:10}}>
          <div style={{fontSize:44}}>📍</div>
          <div style={{fontWeight:700,fontSize:17,color:"#333"}}>Aucun client geolocal.</div>
          <div style={{fontSize:13,color:"#777"}}>Cliquez sur Localiser</div>
          {missing>0&&<Btn onClick={handleGeocode} v="amber">Localiser ({missing})</Btn>}
        </div>}
        {visible.map(function(c){
          var xy=toXY(coords[c.id].lat,coords[c.id].lon);
          if(xy.x<-20||xy.x>W+20||xy.y<-20||xy.y>H+20)return null;
          var col=COL[c.status]||"#aaa",isSel=sel&&sel.id===c.id,sz=isSel?22:16;
          var inSel=selJour===null||!showRoutes||!planning||!planning.journees||planning.journees.some(function(j){return j.num===selJour&&j.slots.some(function(sl){return sl.clientId===c.id;});});
          return <div key={c.id} onClick={function(e){e.stopPropagation();setSel(isSel?null:c);}} title={c.name}
            style={{position:"absolute",left:Math.round(xy.x),top:Math.round(xy.y),transform:"translate(-50%,-50%)",width:sz,height:sz,borderRadius:"50%",background:col,border:(isSel?3:2)+"px solid white",boxShadow:isSel?"0 0 0 3px "+col+"55,0 4px 12px rgba(0,0,0,.5)":"0 2px 6px rgba(0,0,0,.4)",cursor:"pointer",zIndex:isSel?20:11,display:"flex",alignItems:"center",justifyContent:"center",opacity:inSel?1:0.2}}>
            {(c.nbrCaissons||1)>1&&<span style={{fontSize:8,fontWeight:800,color:"white",lineHeight:1,pointerEvents:"none"}}>{c.nbrCaissons}</span>}
          </div>;
        })}
        {sel&&coords[sel.id]&&(function(){
          var xy=toXY(coords[sel.id].lat,coords[sel.id].lon),col=COL[sel.status]||"#aaa";
          return <div onClick={function(e){e.stopPropagation();}} style={{position:"absolute",left:xy.x>W-250?xy.x-215:xy.x+16,top:Math.max(8,Math.min(xy.y-10,H-155)),background:"white",borderRadius:10,padding:"11px 13px",boxShadow:"0 4px 20px rgba(0,0,0,.3)",minWidth:180,maxWidth:225,border:"1px solid #ddd",zIndex:40}}>
            <button onClick={function(){setSel(null);}} style={{position:"absolute",top:5,right:7,background:"none",border:"none",cursor:"pointer",fontSize:17,color:"#bbb",lineHeight:1}}>x</button>
            <div style={{fontWeight:700,fontSize:13,color:"#111",marginBottom:3,paddingRight:16}}>{sel.name}</div>
            <div style={{fontSize:11,color:"#666",marginBottom:5,lineHeight:1.5}}>{sel.address} {sel.cp} {sel.ville}</div>
            <div style={{display:"flex",alignItems:"center",gap:7}}>
              <Pill status={sel.status}/>
              <span style={{fontSize:10,color:"#aaa"}}>{sel.nbrCaissons||1} caisson{(sel.nbrCaissons||1)>1?"s":""}</span>
            </div>
          </div>;
        })()}
      </div>
      <div style={{fontSize:11,color:"#aaa",marginTop:5,textAlign:"center"}}>Molette pour zoomer - Glisser pour deplacer - Clic pour details</div>
    </div>
  );
}

function AnneesView({currentYear,clients,onNewYear,onSetYear,modPre}){
  var done=clients.filter(function(c){return c.status==="done";}).length;
  var pending=clients.filter(function(c){return c.status==="pending";}).length;
  var total=done+pending,pct=total>0?Math.round(done/total*100):0;
  var [conf,setConf]=useState(null);
  var [archives,setArchives]=useState({});
  useEffect(function(){
    var allYears={};
    clients.forEach(function(c){(c.history||[]).forEach(function(h){allYears[h.year]=true;});});
    var years=Object.keys(allYears).map(Number);
    if(!years.length)return;
    var a={};
    years.forEach(function(yr){
      try{
        var v=localStorage.getItem("proplan_"+(modPre||"vmc_")+"archive_"+yr);
        a[yr]=v?JSON.parse(v):[];
      }catch(e){a[yr]=[];}
    });
    setArchives(a);
  },[clients.length]);
  return (
    <div>
      <h2 style={{fontSize:22,fontWeight:800,color:"#111",marginBottom:5}}>Annees</h2>
      <div style={{background:"white",borderRadius:12,padding:"14px 16px",marginBottom:10,display:"flex",alignItems:"center",justifyContent:"center",gap:18}}>
        <button onClick={function(){setConf(currentYear-1);}} style={{width:38,height:38,border:"1.5px solid #ddd",borderRadius:9,cursor:"pointer",background:"#f0ede6",fontWeight:700,fontSize:18}}>{"<"}</button>
        <div style={{textAlign:"center"}}><div style={{fontSize:10,fontFamily:"monospace",color:"#999",marginBottom:3}}>ANNEE ACTIVE</div><div style={{fontSize:38,fontWeight:800,color:"#111"}}>{currentYear}</div></div>
        <button onClick={function(){setConf(currentYear+1);}} style={{width:38,height:38,border:"1.5px solid #ddd",borderRadius:9,cursor:"pointer",background:"#f0ede6",fontWeight:700,fontSize:18}}>{">"}</button>
      </div>
      {conf&&<div style={{background:"#fff8f0",border:"2px solid #f0a500",borderRadius:11,padding:"13px 16px",marginBottom:12,display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
        <div style={{fontSize:14,color:"#7a5000"}}><strong>Passer a {conf}?</strong></div>
        <div style={{display:"flex",gap:7}}>
          <button onClick={function(){onSetYear(conf);setConf(null);}} style={{background:"#f0a500",color:"#111",border:"none",borderRadius:8,padding:"7px 16px",fontWeight:700,cursor:"pointer",fontSize:13,fontFamily:"inherit"}}>Confirmer</button>
          <button onClick={function(){setConf(null);}} style={{background:"#e8e4dc",color:"#555",border:"none",borderRadius:8,padding:"7px 12px",fontWeight:600,cursor:"pointer",fontSize:13,fontFamily:"inherit"}}>Annuler</button>
        </div>
      </div>}
      <div style={{background:"#0f2d4a",borderRadius:13,padding:20,color:"white",marginBottom:12}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:12}}>
          {[["En attente",pending,"#f0a500"],["Termines",done,"#5dbb7a"],["Inactifs",clients.filter(function(c){return c.status==="inactive";}).length,"#888"]].map(function(item){
            return <div key={item[0]} style={{background:"rgba(255,255,255,.08)",borderRadius:9,padding:"10px 12px"}}><div style={{color:item[2],fontSize:24,fontWeight:800}}>{item[1]}</div><div style={{color:"rgba(255,255,255,.5)",fontSize:11,marginTop:2}}>{item[0]}</div></div>;
          })}
        </div>
        <div style={{height:7,background:"rgba(255,255,255,.1)",borderRadius:3,overflow:"hidden",marginBottom:12}}><div style={{height:"100%",width:pct+"%",background:"linear-gradient(90deg,#1a3d2b,#5dbb7a)",borderRadius:3}}/></div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{color:"rgba(255,255,255,.6)",fontSize:13}}>{pct}% - {done}/{total}</span>
          <Btn onClick={onNewYear} v="amber">Commencer {currentYear+1}</Btn>
        </div>
      </div>
      {(function(){
        var allYears={};
        clients.forEach(function(c){
          (c.history||[]).forEach(function(h){
            if(!allYears[h.year])allYears[h.year]={count:0,caissons:0};
            allYears[h.year].count++;
            allYears[h.year].caissons+=h.nbrCaissons||1;
          });
          if(c.status==="done"){
            if(!allYears[currentYear])allYears[currentYear]={count:0,caissons:0};
            allYears[currentYear].count++;
            allYears[currentYear].caissons+=c.nbrCaissons||1;
          }
        });
        var years=Object.keys(allYears).map(Number).sort(function(a,b){return b-a;});
        if(!years.length)return null;
        return <div style={{background:"white",borderRadius:12,padding:"14px 16px"}}>
          <div style={{fontFamily:"monospace",fontSize:10,color:"#aaa",textTransform:"uppercase",marginBottom:10}}>Historique des annees</div>
          {years.map(function(yr){
            var d=allYears[yr];
            var isCur=yr===currentYear;
            var archData=archives[yr]||[];
            var maxCount=Math.max.apply(null,years.map(function(y){return allYears[y].count;}));
            return <div key={yr}>
              <div style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:"1px solid #f5f2ec",cursor:archData.length?"pointer":"default"}} onClick={function(){setConf(conf===yr?null:yr);}}>
                <div style={{fontWeight:800,fontSize:16,color:isCur?"#f0a500":"#111",minWidth:50}}>{yr}</div>
                <div style={{flex:1,height:8,background:"#f0ede6",borderRadius:4,overflow:"hidden"}}>
                  <div style={{height:"100%",width:Math.min(100,Math.round(d.count/(maxCount||1)*100))+"%",background:isCur?"#f0a500":"#1a3d2b",borderRadius:4,transition:"width .4s"}}/>
                </div>
                <div style={{fontFamily:"monospace",fontSize:12,color:"#555",minWidth:70,textAlign:"right",fontWeight:700}}>{d.count} clients</div>
                <div style={{fontFamily:"monospace",fontSize:12,color:"#888",minWidth:80,textAlign:"right"}}>{d.caissons} caissons</div>
                {isCur&&<span style={{fontSize:10,background:"#fff3cd",color:"#856404",borderRadius:4,padding:"2px 7px",fontFamily:"monospace",flexShrink:0}}>en cours</span>}
                {!isCur&&archData.length>0&&<span style={{fontSize:10,color:"#aaa",flexShrink:0}}>{conf===yr?"▲":"▼"}</span>}
              </div>
              {conf===yr&&!isCur&&archData.length>0&&<div style={{background:"#f8f5ef",borderRadius:8,padding:"10px 12px",marginBottom:6}}>
                <div style={{fontSize:10,fontFamily:"monospace",color:"#aaa",textTransform:"uppercase",marginBottom:8}}>Interventions {yr} ({archData.length})</div>
                <div style={{maxHeight:200,overflowY:"auto"}}>
                  {archData.map(function(c,ci){return <div key={ci} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 0",borderBottom:"1px solid #f0ede6",fontSize:12}}>
                    <span style={{color:"#5dbb7a",fontFamily:"monospace",fontSize:11,fontWeight:700,flexShrink:0}}>{c.doneDate||""}</span>
                    <span style={{fontWeight:600,color:"#111",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.name}</span>
                    <span style={{fontSize:11,color:"#888",flexShrink:0}}>{c.ville}</span>
                    <span style={{fontSize:10,fontFamily:"monospace",color:"#aaa",flexShrink:0}}>{c.nbrCaissons}c</span>
                  </div>;})}
                </div>
              </div>}
            </div>;
          })}
        </div>;
      })()}
    </div>
  );
}


var KIZEO_BASE="https://forms.kizeo.com/rest/v3";

function kizeoGet(token,path){
  return fetch(KIZEO_BASE+path,{headers:{"Authorization":token,"Content-Type":"application/json"}}).then(function(r){if(!r.ok)throw new Error("HTTP "+r.status);return r.json();});
}
function kizeoPost(token,path,body){
  return fetch(KIZEO_BASE+path,{method:"POST",headers:{"Authorization":token,"Content-Type":"application/json"},body:JSON.stringify(body)}).then(function(r){if(!r.ok)throw new Error("HTTP "+r.status);return r.json();});
}

function KizeoView({clients,planning,onCheck}){
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

  useEffect(function(){
    S.get("kizeo_config").then(function(c){
      if(c){setToken(c.token||"");setFormId(c.formId||"");setMapping(c.mapping||{});setSaved(true);}
    });
  },[]);

  var saveConfig=function(){
    S.set("kizeo_config",{token:token,formId:formId,mapping:mapping});
    setSaved(true);setPushLog([]);setSyncLog([]);
  };

  var loadUsers=function(){
    if(!token){setUserErr("Token requis");return;}
    setLoadingUsers(true);setUserErr("");
    kizeoGet(token,"/users").then(function(d){
      var users=(d.users||[]).map(function(u){return{id:String(u.id),name:(u.first_name||"")+" "+(u.last_name||""),login:u.login||""};});
      setKUsers(users);
    }).catch(function(e){setUserErr("Erreur: "+e.message);}).then(function(){setLoadingUsers(false);});
  };

  var pushPlanning=function(){
    if(!token||!formId){setPushLog(["Token et ID formulaire requis"]);return;}
    if(!planning||!planning.journees||!planning.journees.length){setPushLog(["Aucun planning genere"]);return;}
    var cMap={};clients.forEach(function(c){cMap[c.id]=c;});
    setPushing(true);setPushLog(["Demarrage..."]);
    var logs=[];
    var journeesWithUser=planning.journees.filter(function(j){return mapping["J"+j.num];});
    if(!journeesWithUser.length){setPushLog(["Aucune journee n a de technicien assigne"]);setPushing(false);return;}
    var total=journeesWithUser.reduce(function(s,j){return s+j.slots.length;},0);
    var done=0;
    var pushSlots=function(jIdx,sIdx){
      if(jIdx>=journeesWithUser.length){setPushLog(logs.concat("Termine: "+done+"/"+total+" pousses"));setPushing(false);return;}
      var j=journeesWithUser[jIdx];
      if(sIdx>=j.slots.length){pushSlots(jIdx+1,0);return;}
      var sl=j.slots[sIdx];
      var c=cMap[sl.clientId];
      if(!c){pushSlots(jIdx,sIdx+1);return;}
      var userId=mapping["J"+j.num];
      var body={
        recipient_user_id:parseInt(userId),
        fields:{
          client_name:{value:c.name||""},
          address:{value:(c.address||"")+" "+(c.ville||"")},
          scheduled_time:{value:sl.startClock+" - "+sl.endClock},
          nb_caissons:{value:String(c.nbrCaissons||1)},
          bon:{value:c.bon||""},
          journee:{value:"J"+j.num}
        }
      };
      kizeoPost(token,"/forms/"+formId+"/push",body).then(function(){
        done++;
        logs=logs.concat("OK J"+j.num+": "+c.name+" -> "+sl.startClock);
        setPushLog(logs.slice());
      }).catch(function(e){
        logs=logs.concat("ERREUR J"+j.num+" "+c.name+": "+e.message);
        setPushLog(logs.slice());
      }).then(function(){
        setTimeout(function(){pushSlots(jIdx,sIdx+1);},300);
      });
    };
    pushSlots(0,0);
  };

  var syncData=function(){
    if(!token||!formId){setSyncLog(["Token et ID formulaire requis"]);return;}
    setSyncing(true);setSyncLog(["Recuperation des formulaires..."]);
    kizeoGet(token,"/forms/"+formId+"/data/unread/test/100?includeupdated").then(function(d){
      var datas=d.data||[];
      setSyncLog(["Trouves: "+datas.length+" formulaires non lus"]);
      if(!datas.length){setSyncing(false);return;}
      var cMap={};clients.forEach(function(c){var k=norm(c.name);cMap[k]=c;});
      var matched=[],ids=[];
      datas.forEach(function(entry){
        var fields=entry.fields||{};
        var rawName=fields.client_name&&fields.client_name.value||"";
        var k=norm(rawName);
        var found=cMap[k];
        if(found&&found.status==="pending"){matched.push(found);ids.push(entry.id);}
      });
      setSyncLog(["Trouves: "+datas.length+" - Correspondances: "+matched.length]);
      if(matched.length>0){
        matched.forEach(function(c){onCheck(c.id);});
        kizeoPost(token,"/forms/"+formId+"/markasreadbyaction/test",{data_ids:ids}).catch(function(){});
        setSyncLog(["OK: "+matched.length+" clients marques Termines"]);
      } else {
        setSyncLog(["Aucune correspondance trouvee dans les formulaires"]);
      }
      setSyncing(false);
    }).catch(function(e){
      setSyncLog(["Erreur: "+e.message]);
      setSyncing(false);
    });
  };

  var rows=[];
  var inputStyle={border:"1.5px solid #ddd",borderRadius:8,padding:"8px 12px",fontSize:13,outline:"none",fontFamily:"monospace",width:"100%",boxSizing:"border-box"};
  var sectionStyle={background:"white",borderRadius:12,padding:"16px 18px",marginBottom:12};
  var logStyle={background:"#111",borderRadius:8,padding:"10px 12px",fontFamily:"monospace",fontSize:11,color:"#5dbb7a",maxHeight:160,overflowY:"auto",marginTop:10};

  return (
    <div>
      <div style={{marginBottom:18}}>
        <div style={{fontSize:11,fontFamily:"monospace",color:"#f0a500",letterSpacing:2,textTransform:"uppercase",marginBottom:4}}>Integration</div>
        <h2 style={{fontSize:22,fontWeight:800,color:"#111"}}>Kizeo Forms</h2>
      </div>

      <div style={sectionStyle}>
        <div style={{fontWeight:700,fontSize:14,color:"#111",marginBottom:12}}>1. Configuration</div>
        <div style={{display:"grid",gap:10,marginBottom:12}}>
          <div>
            <div style={{fontSize:11,color:"#999",marginBottom:4,fontFamily:"monospace",textTransform:"uppercase"}}>Token API</div>
            <input type="password" value={token} onChange={function(e){setToken(e.target.value);setSaved(false);}} placeholder="Votre token Kizeo (support@kizeo.com)" style={inputStyle}/>
          </div>
          <div>
            <div style={{fontSize:11,color:"#999",marginBottom:4,fontFamily:"monospace",textTransform:"uppercase"}}>ID du formulaire</div>
            <input type="text" value={formId} onChange={function(e){setFormId(e.target.value);setSaved(false);}} placeholder="Ex: 12345" style={inputStyle}/>
            <div style={{fontSize:11,color:"#aaa",marginTop:4}}>Visible dans l URL du formulaire sur Kizeo</div>
          </div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <Btn onClick={saveConfig} v="amber" disabled={!token||!formId}>Sauvegarder</Btn>
          {saved&&<span style={{fontSize:12,color:"#5dbb7a",fontFamily:"monospace"}}>Configuration sauvegardee</span>}
        </div>
        {!token&&<div style={{marginTop:10,background:"#fff8f0",border:"1px solid #f0a500",borderRadius:8,padding:"10px 12px",fontSize:12,color:"#7a5000"}}>
          Pour obtenir votre token, envoyez un email a <strong>support@kizeo.com</strong> depuis votre adresse administrateur Kizeo.
        </div>}
      </div>

      <div style={sectionStyle}>
        <div style={{fontWeight:700,fontSize:14,color:"#111",marginBottom:4}}>2. Assigner les techniciens</div>
        <div style={{fontSize:12,color:"#888",marginBottom:12}}>Associe chaque journee du planning a un technicien Kizeo</div>
        <div style={{display:"flex",gap:8,marginBottom:12}}>
          <Btn onClick={loadUsers} v="ghost" disabled={!token||loadingUsers}>{loadingUsers?"Chargement...":"Charger les techniciens"}</Btn>
          {userErr&&<span style={{fontSize:12,color:"#e74c3c",fontFamily:"monospace"}}>{userErr}</span>}
        </div>
        {planning&&planning.journees&&planning.journees.length>0&&kUsers.length>0&&(
          <div style={{display:"grid",gap:8}}>
            {planning.journees.map(function(j){
              return <div key={j.num} style={{display:"flex",alignItems:"center",gap:12,padding:"8px 12px",background:"#f8f5ef",borderRadius:8}}>
                <div style={{minWidth:60,fontFamily:"monospace",fontWeight:700,fontSize:13,color:RCOLS[j.num%RCOLS.length]}}>J{j.num}</div>
                <div style={{flex:1,fontSize:12,color:"#777"}}>{j.zonesLabel} - {j.slots.length} chantiers</div>
                <select value={mapping["J"+j.num]||""} onChange={function(e){var v=e.target.value;setMapping(function(m){var n=Object.assign({},m);n["J"+j.num]=v;return n;});setSaved(false);}}
                  style={{border:"1.5px solid #ddd",borderRadius:7,padding:"5px 10px",fontSize:12,fontFamily:"inherit",outline:"none",minWidth:180}}>
                  <option value="">-- Choisir technicien --</option>
                  {kUsers.map(function(u){return <option key={u.id} value={u.id}>{u.name||u.login}</option>;})}
                </select>
              </div>;
            })}
          </div>
        )}
        {(!planning||!planning.journees||!planning.journees.length)&&<div style={{fontSize:13,color:"#aaa",padding:"10px 0"}}>Generez un planning d abord</div>}
        {kUsers.length===0&&!loadingUsers&&<div style={{fontSize:13,color:"#aaa",padding:"4px 0"}}>Cliquez sur "Charger les techniciens" pour voir la liste</div>}
      </div>

      <div style={sectionStyle}>
        <div style={{fontWeight:700,fontSize:14,color:"#111",marginBottom:4}}>3. Envoyer le planning</div>
        <div style={{fontSize:12,color:"#888",marginBottom:12}}>Pousse chaque chantier aux techniciens assignes via Kizeo</div>
        <Btn onClick={pushPlanning} v="amber" disabled={pushing||!saved||!planning}>
          {pushing?"Envoi en cours...":"Envoyer aux techniciens"}
        </Btn>
        {pushLog.length>0&&<div style={logStyle}>{pushLog.map(function(l,i){return <div key={i}>{l}</div>;})}</div>}
      </div>

      <div style={sectionStyle}>
        <div style={{fontWeight:700,fontSize:14,color:"#111",marginBottom:4}}>4. Synchroniser les retours</div>
        <div style={{fontSize:12,color:"#888",marginBottom:12}}>Recupere les formulaires completes et marque les clients comme Termines</div>
        <Btn onClick={syncData} v="green" disabled={syncing||!saved}>
          {syncing?"Synchronisation...":"Synchroniser"}
        </Btn>
        {syncLog.length>0&&<div style={logStyle}>{syncLog.map(function(l,i){return <div key={i}>{l}</div>;})}</div>}
      </div>
    </div>
  );
}

var MODULES={
  vmc:{id:"vmc",label:"VMC",emoji:"💨",color:"#f0a500",darkBg:"#111",desc:"Nettoyage"},
  era:{id:"era",label:"Eradication",emoji:"🐛",color:"#5dbb7a",darkBg:"#0d2b1a",desc:"Nuisibles",
    interventionTypes:[{id:"init",label:"Initial",min:60},{id:"ctrl",label:"Controle",min:30},{id:"choc",label:"Choc",min:45},{id:"fin",label:"Levee",min:20}]},
};


// ─── Auth helpers ─────────────────────────────────────────────────────────────
function saveSession(data){
  _token=data.access_token;
  _userId=data.user&&data.user.id;
  try{localStorage.setItem("supa_session",JSON.stringify({token:data.access_token,userId:_userId,email:data.user&&data.user.email,expires_at:data.expires_at}));}catch(e){}
}
function loadSession(){
  var s=supa.auth.getSession();
  if(!s)return false;
  if(s.expires_at&&new Date(s.expires_at*1000)<new Date())return false;
  _token=s.token;_userId=s.userId;
  return true;
}

// ─── LoginScreen ──────────────────────────────────────────────────────────────
function LoginScreen({onLogin}){
  var [email,setEmail]=useState("");
  var [pass,setPass]=useState("");
  var [mode,setMode]=useState("login"); // login | signup | reset
  var [loading,setLoading]=useState(false);
  var [err,setErr]=useState("");
  var [msg,setMsg]=useState("");

  var inputStyle={width:"100%",border:"1.5px solid #ddd",borderRadius:9,padding:"11px 14px",fontSize:14,outline:"none",fontFamily:"inherit",boxSizing:"border-box",background:"white",color:"#111"};

  var handleSubmit=function(){
    if(!email.trim()){setErr("Email requis");return;}
    if(mode!=="reset"&&!pass.trim()){setErr("Mot de passe requis");return;}
    setLoading(true);setErr("");setMsg("");

    if(mode==="reset"){
      supa.auth.resetPassword(email).then(function(ok){
        if(ok)setMsg("Email de réinitialisation envoyé !");
        else setErr("Erreur lors de l envoi");
      }).catch(function(e){setErr(e.message);}).then(function(){setLoading(false);});
      return;
    }
    var fn=mode==="login"?supa.auth.signIn:supa.auth.signUp;
    fn(email,pass).then(function(data){
      if(data.error||data.error_description){setErr(data.error_description||data.error||"Erreur");return;}
      if(mode==="signup"&&!data.access_token){setMsg("Vérifiez votre email pour confirmer le compte.");return;}
      saveSession(data);
      onLogin({email:data.user&&data.user.email,id:data.user&&data.user.id});
    }).catch(function(e){setErr(e.message);}).then(function(){setLoading(false);});
  };

  var configured=SUPA_URL!=="VOTRE_PROJECT_URL";

  return (
    <div style={{minHeight:"100vh",background:"#f0ede6",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{width:"100%",maxWidth:400}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{width:52,height:52,background:"linear-gradient(135deg,#f0a500,#5dbb7a)",borderRadius:14,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,color:"white",fontSize:24,margin:"0 auto 12px"}}>P</div>
          <div style={{fontWeight:800,fontSize:24,color:"#111"}}>ProPlan</div>
          <div style={{color:"#aaa",fontSize:13,fontFamily:"monospace"}}>AHMP</div>
        </div>
        {!configured&&<div style={{background:"#fff8f0",border:"2px solid #f0a500",borderRadius:10,padding:"12px 16px",marginBottom:16,fontSize:13,color:"#7a5000"}}>
          <strong>Configuration requise</strong><br/>
          Remplacez VOTRE_PROJECT_URL et VOTRE_ANON_KEY dans le code par vos clés Supabase.
        </div>}
        <div style={{background:"white",borderRadius:16,padding:28,boxShadow:"0 4px 24px rgba(0,0,0,.08)"}}>
          <div style={{fontWeight:800,fontSize:18,color:"#111",marginBottom:20,textAlign:"center"}}>
            {mode==="login"?"Connexion":mode==="signup"?"Créer un compte":"Mot de passe oublié"}
          </div>
          <div style={{marginBottom:14}}>
            <div style={{fontSize:12,color:"#888",marginBottom:5,fontWeight:600}}>Email</div>
            <input type="email" value={email} onChange={function(e){setEmail(e.target.value);}} onKeyDown={function(e){if(e.key==="Enter")handleSubmit();}} placeholder="vous@exemple.fr" style={inputStyle}/>
          </div>
          {mode!=="reset"&&<div style={{marginBottom:20}}>
            <div style={{fontSize:12,color:"#888",marginBottom:5,fontWeight:600}}>Mot de passe</div>
            <input type="password" value={pass} onChange={function(e){setPass(e.target.value);}} onKeyDown={function(e){if(e.key==="Enter")handleSubmit();}} placeholder="••••••••" style={inputStyle}/>
          </div>}
          {err&&<div style={{background:"#fef2f2",border:"1px solid #fca5a5",borderRadius:8,padding:"8px 12px",fontSize:13,color:"#b91c1c",marginBottom:12}}>{err}</div>}
          {msg&&<div style={{background:"#f0fdf4",border:"1px solid #86efac",borderRadius:8,padding:"8px 12px",fontSize:13,color:"#15803d",marginBottom:12}}>{msg}</div>}
          <button onClick={handleSubmit} disabled={loading||!configured} style={{width:"100%",background:loading?"#ccc":"#f0a500",color:"#111",border:"none",borderRadius:10,padding:"13px",fontWeight:800,fontSize:15,cursor:loading?"not-allowed":"pointer",fontFamily:"inherit",marginBottom:16}}>
            {loading?"Chargement...":mode==="login"?"Se connecter":mode==="signup"?"Créer le compte":"Envoyer le lien"}
          </button>
          <div style={{display:"flex",justifyContent:"center",gap:16,fontSize:13}}>
            {mode!=="login"&&<button onClick={function(){setMode("login");setErr("");setMsg("");}} style={{background:"none",border:"none",color:"#f0a500",cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>Connexion</button>}
            {mode!=="signup"&&<button onClick={function(){setMode("signup");setErr("");setMsg("");}} style={{background:"none",border:"none",color:"#888",cursor:"pointer",fontFamily:"inherit"}}>Créer un compte</button>}
            {mode!=="reset"&&<button onClick={function(){setMode("reset");setErr("");setMsg("");}} style={{background:"none",border:"none",color:"#888",cursor:"pointer",fontFamily:"inherit"}}>Mot de passe oublié</button>}
          </div>
        </div>
        <div style={{textAlign:"center",marginTop:16,fontSize:11,color:"#bbb",fontFamily:"monospace"}}>Données sécurisées via Supabase</div>
      </div>
    </div>
  );
}

// ─── Supabase sync helpers ────────────────────────────────────────────────────
function syncClientsToSupabase(clients,module,userId){
  if(!_token||!userId)return Promise.resolve();
  var rows=clients.map(function(c){
    return{id:c.id,user_id:userId,name:c.name,address:c.address,cp:c.cp||"",ville:c.ville||"",nbr_caissons:c.nbrCaissons||1,bon:c.bon||"",status:c.status,year:c.year||new Date().getFullYear(),done_date:c.doneDate||null,history:c.history||[],module:module};
  });
  return supa.from("clients").upsert(rows).catch(function(e){console.error("sync clients",e);});
}
function loadClientsFromSupabase(module,userId){
  if(!_token||!userId)return Promise.resolve(null);
  return supa.from("clients").select("*","&user_id=eq."+userId+"&module=eq."+module).then(function(rows){
    if(!Array.isArray(rows))return null;
    return rows.map(function(r){return{id:r.id,name:r.name,address:r.address,cp:r.cp||"",ville:r.ville||"",nbrCaissons:r.nbr_caissons||1,bon:r.bon||"",status:r.status,year:r.year,doneDate:r.done_date,history:r.history||[]};});
  }).catch(function(e){console.error("load clients",e);return null;});
}
function syncArchiveToSupabase(module,year,data,userId){
  if(!_token||!userId)return Promise.resolve();
  return supa.from("archives").upsert({user_id:userId,module:module,year:year,data:data}).catch(function(e){console.error("sync archive",e);});
}
function loadArchivesFromSupabase(module,userId){
  if(!_token||!userId)return Promise.resolve(null);
  return supa.from("archives").select("*","&user_id=eq."+userId+"&module=eq."+module).then(function(rows){
    if(!Array.isArray(rows))return null;
    var a={};rows.forEach(function(r){a[r.year]=r.data||[];});
    return a;
  }).catch(function(){return null;});
}

function ModuleApp({mod,userId}){
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

  useEffect(function(){
    if(window.XLSX){setXlsxReady(true);return;}
    var s=document.createElement("script");
    s.src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    s.onload=function(){setXlsxReady(true);};
    document.head.appendChild(s);
  },[]);

  useEffect(function(){
    Promise.all([S.get(PRE+"clients"),S.get(PRE+"year"),S.get(PRE+"ot")])
    .then(function(vals){
      if(vals[0])setClients(vals[0]);
      if(vals[1])setCurrentYear(vals[1]);
      if(vals[2]!==null)setOtMin(vals[2]);

    })
    .catch(function(e){console.error("load",e);})
    .then(function(){setLoaded(true);});
  },[mod]);

  useEffect(function(){
    if(!loaded)return;
    try{localStorage.setItem("proplan_"+PRE+"clients",JSON.stringify(clients));}catch(e){}
    syncClientsToSupabase(clients,mod,userId);
  },[clients,loaded]);
  useEffect(function(){
    if(!loaded)return;
    try{localStorage.setItem("proplan_"+PRE+"year",JSON.stringify(currentYear));}catch(e){}
  },[currentYear,loaded]);
  useEffect(function(){
    if(!loaded)return;
    try{localStorage.setItem("proplan_"+PRE+"ot",JSON.stringify(otMin));}catch(e){}
  },[otMin,loaded]);
  useEffect(function(){
    if(!loaded)return;
    try{localStorage.setItem("proplan_"+PRE+"techs",JSON.stringify(techs));}catch(e){}
  },[techs,loaded]);
  useEffect(function(){
    if(!loaded)return;
    try{localStorage.setItem("proplan_"+PRE+"jdates",JSON.stringify(journeeDates));}catch(e){}
  },[journeeDates,loaded]);

  var handleFile=function(file){
    if(!xlsxReady){setImpError("XLSX pas pret, reessayez.");return;}
    setImpLoading(true);setImpError("");setImpResult(null);setImpPending(null);
    readExcelRaw(file).then(function(data){
      var mapping=detectMapping(data.headers);
      setImpPending({headers:data.headers,rows:data.rows,mapping:mapping});
    }).catch(function(e){setImpError(String(e));}).then(function(){setImpLoading(false);});
  };
  var handleConfirmImport=function(mapping){
    if(!impPending)return;
    var rows=parseWithMapping(impPending.rows,mapping);
    var res=fusionner(clients,rows);
    setClients(res.clients);setImpResult({stats:res.stats,total:res.total});
    setImpPending(null);setPlanning(null);
  };
  var handleResetImport=function(){setImpPending(null);setImpResult(null);setImpError("");};

  var handleGenerate=function(){
    var pend=clients.filter(function(c){return c.status==="pending";});
    if(!pend.length)return;
    S.get(GEOCODE_KEY).then(function(coords){
      coords=coords||{};
      var jobFn=mod==="era"?function(c){var types=cfg.interventionTypes||[];var t=types.find(function(t){return t.id===c.interventionType;});return t?t.min:45;}:null;
      clearZoneCache();
      try{setPlanning(planifier(pend,otMin,jobFn,coords));setView("planning");}
      catch(err){alert("Erreur: "+err.message);}
    });
  };

  var handleCheck=function(id){
    setClients(function(prev){return prev.map(function(c){return c.id===id?Object.assign({},c,{status:"done",doneDate:today()}):c;});});
    setPlanning(function(prev){if(!prev)return null;return Object.assign({},prev,{journees:prev.journees.map(function(j){var sl=j.slots.filter(function(s){return s.clientId!==id;});return Object.assign({},j,{slots:sl,totalWork:sl.reduce(function(s2,s){return s2+s.dur;},0)});}).filter(function(j){return j.slots.length>0;})});});
  };

  var handlePartial=function(id,nbDone){
    setClients(function(prev){return prev.map(function(c){if(c.id!==id)return c;return Object.assign({},c,{nbrCaissons:Math.max(1,(c.nbrCaissons||1)-nbDone),status:"pending"});});});
    setPlanning(function(prev){if(!prev)return null;return Object.assign({},prev,{journees:prev.journees.map(function(j){var sl=j.slots.filter(function(s){return s.clientId!==id;});return Object.assign({},j,{slots:sl,totalWork:sl.reduce(function(s2,s){return s2+s.dur;},0)});}).filter(function(j){return j.slots.length>0;})});});
  };

  var handleSetYear=function(y){
    if(y===currentYear)return;
    var cls=clients.map(function(c){
      var hist=(c.history||[]).slice();
      if(c.status==="done"){
        var already=hist.some(function(h){return h.year===currentYear;});
        if(!already)hist.push({year:currentYear,doneDate:c.doneDate||today(),nbrCaissons:c.nbrCaissons||1});
      }
      return Object.assign({},c,{status:c.status==="done"?"pending":c.status,doneDate:null,history:hist});
    });
    // Save archive snapshot for current year (never overwritten)
    var snap=clients.filter(function(c){return c.status==="done";}).map(function(c){
      return{id:c.id,name:c.name,address:c.address,ville:c.ville,nbrCaissons:c.nbrCaissons||1,doneDate:c.doneDate};
    });
    try{localStorage.setItem("proplan_"+PRE+"archive_"+currentYear, JSON.stringify(snap));}catch(e){}
    try{localStorage.setItem("proplan_"+PRE+"clients", JSON.stringify(cls));}catch(e){}
    try{localStorage.setItem("proplan_"+PRE+"year", JSON.stringify(y));}catch(e){}
    syncArchiveToSupabase(mod,currentYear,snap,userId);
    syncClientsToSupabase(cls,mod,userId);
    setClients(cls);
    setCurrentYear(y);
    setPlanning(null);
  };

  var pend=clients.filter(function(c){return c.status==="pending";}).length;
  var NAV=[["dashboard","Dashboard"],["import","Import"],["clients","Clients ("+clients.length+")"],["planning","Planning"],["carte","Carte"],["annees","Annees"],["kizeo","Kizeo"]];

  if(!loaded)return <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"60vh",fontFamily:"monospace",color:"#aaa",fontSize:14}}>Chargement...</div>;

  return (
    <React.Fragment>
      <nav className="no-print" style={{background:cfg.darkBg,display:"flex",alignItems:"center",padding:"0 14px",height:44,gap:3}}>
        {NAV.map(function(item){return <button key={item[0]} onClick={function(){setView(item[0]);}} style={{background:view===item[0]?"rgba(255,255,255,.12)":"transparent",color:view===item[0]?"white":"rgba(255,255,255,.5)",border:"none",borderRadius:6,padding:"4px 11px",cursor:"pointer",fontSize:12,fontFamily:"sans-serif",fontWeight:600}}>{item[1]}</button>;})}
        {pend>0&&<div style={{marginLeft:"auto",background:cfg.color,color:cfg.id==="vmc"?"#111":"white",borderRadius:6,padding:"2px 9px",fontFamily:"monospace",fontSize:11,fontWeight:700}}>{pend}</div>}
      </nav>
      <div style={{maxWidth:880,margin:"0 auto",padding:"22px 18px"}}>
        {view==="dashboard"&&<Dashboard clients={clients} planning={planning} currentYear={currentYear} onImport={function(){setView("import");}} onPlan={handleGenerate} onNewYear={function(){handleSetYear(currentYear+1);}} onCarte={function(){setView("carte");}}/>}
        {view==="import"&&<ImportView onConfirm={handleConfirmImport} fileRef={fileRef} loading={impLoading} error={impError} result={impResult} pending={impPending} onReset={handleResetImport} onDrop={function(e){e.preventDefault();var f=e.dataTransfer.files[0];if(f)handleFile(f);}}/>}
        {view==="clients"&&<ClientsView clients={clients} setClients={setClients}/>}
        {view==="planning"&&<PlanningView clients={clients} planning={planning} setPlanning={setPlanning} otMin={otMin} setOtMin={setOtMin} onGenerate={handleGenerate} onCheck={handleCheck} onPartial={handlePartial} techs={techs} setTechs={setTechs} journeeDates={journeeDates} setJourneeDate={function(jId,date){setJourneeDates(function(prev){var n=Object.assign({},prev);n[jId]=date;return n;});}}/>}
        {view==="carte"&&<CarteView clients={clients} planning={planning}/>}
        {view==="annees"&&<AnneesView currentYear={currentYear} clients={clients} onNewYear={function(){handleSetYear(currentYear+1);}} onSetYear={handleSetYear} modPre={PRE}/>}
        {view==="kizeo"&&<KizeoView clients={clients} planning={planning} onCheck={handleCheck}/>}
      </div>
      <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{display:"none"}} onChange={function(e){if(e.target.files[0])handleFile(e.target.files[0]);}}/>
    </React.Fragment>
  );
}

export default function App(){
  var [mod,setMod]=useState("vmc");
  var [user,setUser]=useState(null);
  var [authChecked,setAuthChecked]=useState(false);

  useEffect(function(){
    // Vérifier session existante au démarrage
    if(loadSession()){
      var s=supa.auth.getSession();
      if(s)setUser({email:s.email,id:s.userId});
    }
    setAuthChecked(true);
  },[]);

  var handleLogin=function(u){setUser(u);};
  var handleLogout=function(){
    supa.auth.signOut().then(function(){setUser(null);});
  };

  if(!authChecked)return <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#f0ede6",fontFamily:"monospace",color:"#aaa"}}>Chargement...</div>;
  if(!user)return <LoginScreen onLogin={handleLogin}/>;

  return (
    <div style={{fontFamily:"Segoe UI,sans-serif",minHeight:"100vh",background:"#f0ede6"}}>
      <style>{"*{box-sizing:border-box;margin:0;padding:0}@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.3)}}@media print{.no-print{display:none!important}body{background:white!important}.print-card{break-inside:avoid;margin-bottom:14px}}"}</style>
      <div className="no-print" style={{background:"#0a0a0a",display:"flex",alignItems:"center",padding:"0 18px",height:50,borderBottom:"1px solid #1a1a1a"}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginRight:18}}>
          <div style={{width:28,height:28,background:"linear-gradient(135deg,#f0a500,#5dbb7a)",borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,color:"white",fontSize:14}}>P</div>
          <div><div style={{color:"white",fontWeight:800,fontSize:14,lineHeight:1}}>ProPlan</div><div style={{color:"#555",fontFamily:"monospace",fontSize:9,marginTop:1}}>AHMP</div></div>
        </div>
        <div style={{display:"flex",gap:4}}>
          {Object.values(MODULES).map(function(m){
            return <button key={m.id} onClick={function(){setMod(m.id);}} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 16px",border:"none",borderRadius:7,cursor:"pointer",fontFamily:"sans-serif",fontWeight:700,fontSize:13,background:mod===m.id?m.color:"transparent",color:mod===m.id?(m.id==="vmc"?"#111":"white"):"#555",transition:"all .2s"}}>
              <span style={{fontSize:15}}>{m.emoji}</span>{m.label}
            </button>;
          })}
        </div>
        <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:10}}>
          <span style={{color:"#555",fontSize:12,fontFamily:"monospace"}}>{user.email}</span>
          <button onClick={handleLogout} style={{background:"#1a1a1a",border:"1px solid #333",borderRadius:7,padding:"4px 12px",color:"#888",cursor:"pointer",fontSize:12,fontFamily:"inherit"}}>Déconnexion</button>
        </div>
      </div>
      <ModuleApp key={mod+user.id} mod={mod} userId={user.id}/>
    </div>
  );
}