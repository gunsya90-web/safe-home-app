/* SAFE-HOME v5: 사건별 기록, 탭별 선택, 저장 오류 보호. */
(function (S) {
'use strict';
var KEY='safehome_v5_state', OLD='safehome_v4_state', listeners=new Set(), channel, error='', blocked=false, baseRaw=null;
var staticBuildings=JSON.parse(JSON.stringify(S.BUILDINGS)), location={apt:'',dong:'',ho:'',buildingId:null}, activeId=null;
var copy=function(x){return JSON.parse(JSON.stringify(x));}, has=function(x,k){return Object.prototype.hasOwnProperty.call(x,k);};
function fresh(){return {schemaVersion:5,revision:0,incidents:{},reports:{},buildingOverrides:{},importedBuildings:{},actionLog:[],linkTtlHours:2,updatedAt:Date.now()};}
function valid(x){return x && x.schemaVersion===5 && x.incidents && x.reports && x.importedBuildings && x.buildingOverrides && Array.isArray(x.actionLog);}
function read(){
 try {
  baseRaw=localStorage.getItem(KEY);
  if(baseRaw){var x=JSON.parse(baseRaw);if(!valid(x))throw Error();return x;}
  var raw=localStorage.getItem(OLD);if(!raw)return fresh();
  var old=JSON.parse(raw);if(!old || !old.incidents || !old.reports)throw Error();
  localStorage.setItem(OLD+'_backup',raw);
  var next=Object.assign(fresh(),old,{schemaVersion:5,revision:0});delete next.location;delete next.activeIncidentId;
  Object.values(next.incidents).forEach(function(i){i.closed=true;i.closedAt=i.closedAt||Date.now();i.migrated=true;Object.values(i.units||{}).forEach(function(u){u.occupants=null;u.hasVulnerable=null;});});
  Object.values(next.reports).forEach(function(r){r.archived=true;r.migrated=true;});
  next.actionLog.unshift({at:Date.now(),actor:'시스템',action:'이전 기록 백업·이력 전환. 진행 사건은 새로 확인해주세요.'});
  baseRaw=JSON.stringify(next);localStorage.setItem(KEY,baseRaw);return next;
 }catch(e){blocked=true;error='저장 기록을 읽을 수 없습니다. 원본은 보존했습니다. 관리자에서 백업 후 복구해주세요.';return fresh();}
}
var state=read(), snapshot=copy(state);
function rebuild(){S.BUILDINGS=Object.assign({},copy(staticBuildings),state.importedBuildings);}
rebuild();
function notify(){listeners.forEach(function(fn){try{fn(state);}catch(e){console.error(e);}});}
function fail(message){error=message;notify();return false;}
function commit(){
 try{
  if(blocked)throw Error(error);
  if(localStorage.getItem(KEY)!==baseRaw)throw Error('다른 탭에서 기록을 변경했습니다. 새로고침 후 다시 시도해주세요.');
  state.revision=(state.revision||0)+1;state.updatedAt=Date.now();
  var raw=JSON.stringify(state);localStorage.setItem(KEY,raw);baseRaw=raw;snapshot=copy(state);error='';rebuild();notify();
 }catch(e){state=copy(snapshot);rebuild();return fail(/다른 탭|원본/.test(e.message)?e.message:'저장하지 못했습니다. 공간 또는 저장소 접근을 확인해주세요.');}
 if(channel){try{channel.postMessage({revision:state.revision});}catch(e){}}
 return true;
}
function reload(){
 try{var raw=localStorage.getItem(KEY);if(raw===baseRaw)return;if(!raw)return fail('다른 탭에서 기록이 삭제되었습니다. 새로고침해주세요.');
 var x=JSON.parse(raw);if(!valid(x))throw Error();state=x;snapshot=copy(x);baseRaw=raw;error='';rebuild();notify();
 }catch(e){fail('다른 탭의 기록을 읽지 못했습니다. 현재 기록을 유지합니다.');}
}
window.addEventListener('focus',reload);
window.addEventListener('pageshow',reload);
if(typeof document!=='undefined')document.addEventListener('visibilitychange',function(){if(!document.hidden)reload();});
window.addEventListener('storage',function(e){if(e.key===KEY)reload();});
try{channel=new BroadcastChannel('safehome-v5');channel.onmessage=reload;}catch(e){}
function log(actor,action,id){state.actionLog.unshift({actor:actor,action:action,incidentId:id||null,at:Date.now()});}
function incident(id){return id && has(state.incidents,id)?state.incidents[id]:null;}
function selected(id){return incident(id===undefined?activeId:id);}
function writable(id){var i=selected(id);if(!i||i.closed){fail('대상 사건이 없거나 종료되었습니다. 다른 사건에는 반영하지 않았습니다.');return null;}return i;}
function uid(){return window.crypto&&window.crypto.randomUUID?window.crypto.randomUUID():Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);}
function norm(x){return {apt:String(x.apt||'').trim(),dong:S.normalizeDong(x.dong),ho:S.normalizeHo(x.ho),buildingId:x.buildingId||null,complexCode:String(x.complexCode||'').trim()||null};}
function buildingFor(x){if(x.buildingId){var b=S.BUILDINGS[x.buildingId];return b&&S.addrEquals(x.apt,x.dong,b.apt,b.dong)?b:null;}return x.complexCode?Object.values(S.BUILDINGS).find(function(b){return b.complexCode===x.complexCode&&S.addrEquals(x.apt,x.dong,b.apt,b.dong);})||null:S.findBuildingByAddress(x.apt,x.dong);}
function findOpen(id){return Object.values(state.incidents).find(function(i){return !i.closed&&i.buildingId===id;})||null;}
function target(x,id){if(id){var i=incident(id);return i&&!i.closed&&S.addrEquals(x.apt,x.dong,i.apt,i.dong)&&(!x.buildingId||x.buildingId===i.buildingId)?i:null;}var b=buildingFor(x);return b?findOpen(b.id):null;}
function reportKey(apt,dong,ho,id,bid){return JSON.stringify([id||'pending',bid||S.normalizeAddr(apt),S.normalizeDong(dong),S.normalizeHo(ho)]);}
S.reportKey=reportKey;
function unit(i,ho){return i&&has(i.units,S.normalizeHo(ho))?i.units[S.normalizeHo(ho)]:null;}
function fromResult(k){return ({A:'moving',B:'waiting',C:'waiting',D:'moving',E:'moving',F:'danger',G:'moving'})[k]||'unresponded';}
function applyReport(r,i){
 var u=unit(i,r.ho);if(!u)return false;if(u.searchRecord&&u.searchRecord.status==='completed'&&r.urgency==='critical'&&!r.fieldOnly)u.searchRecord.requiresReview=true;
 if(r.fieldOnly){u.fieldObservation=copy(r.fieldObservation);u.status=u.fieldStatus=r.fieldObservation.status;u.fieldConfirmedAt=u.updatedAt=r.fieldObservation.at;u.needsReview=false;r.matchedIncidentId=r.incidentId=i.id;r.buildingId=i.buildingId;return true;}
 Object.assign(u,{answers:copy(r.answers||{}),resultKey:r.resultKey,urgency:r.urgency,notes:r.notes||[],occupants:r.occupants,hasVulnerable:r.hasVulnerable,reportedStatus:r.status,reportedAt:r.updatedAt,updatedAt:r.updatedAt});
 if(r.fieldObservation&&!u.fieldObservation){u.fieldObservation=copy(r.fieldObservation);u.fieldStatus=r.fieldObservation.status;u.fieldConfirmedAt=r.fieldObservation.at;}
 if(u.fieldStatus){u.needsReview=u.fieldStatus!==r.status||r.urgency==='critical';u.status=u.needsReview&&(r.urgency==='critical'||r.status==='danger')?'danger':u.fieldStatus;}
 else u.status=u.isFireOrigin&&r.status!=='safe'?'danger':r.status;
 r.matchedIncidentId=r.incidentId=i.id;r.buildingId=i.buildingId;return true;
}

function newIncident(b){var bid=b.id,ho='',generated=S.generateUnits(b,null);var now=Date.now();var i={id:'inc-'+uid(),buildingId:bid,apt:b.apt,dong:b.dong,officialHo:ho||null,confirmedAt:now,closed:false,units:generated,afp:copy(b.core),unitFacilitiesSnapshot:copy(state.unitFacilities||{}),buildingSnapshot:copy(b),facilityVersion:b.facilityVersion,dispatchNote:'',casualties:{dead:0,severe:0,minor:0,guided:0,selfEvacuated:0},residentLinkExp:now+state.linkTtlHours*3600000,firefighterLinkExp:now+state.linkTtlHours*3600000};state.incidents[i.id]=i;return i;}

function reportedUnit(i,ho){if(!unit(i,ho)){var u=S.generateUnits({units:[ho]},null)[ho];u.unregistered=true;i.units[ho]=u;}}
function routedBuilding(x){var b=buildingFor(x);if(b)return store.getEffectiveBuilding(b.id);
 var id='reported-'+encodeURIComponent(JSON.stringify([x.complexCode||S.normalizeAddr(x.apt),x.dong]));
 b=state.importedBuildings[id]||{id:id,apt:x.apt,dong:x.dong,complexCode:x.complexCode,units:[],core:S.makeUnknownFacility(S.AFP_CORE_FIELDS),suppression:S.makeUnknownFacility(S.AFP_SUPPRESSION_FIELDS),search:S.makeUnknownSearch(),source:'resident-report',facilityVersion:null};
 if(b.units.indexOf(x.ho)<0)b.units.push(x.ho);state.importedBuildings[id]=b;return b;
}
function reportAt(apt,dong,ho,id,bid){
 var x=norm({apt:apt,dong:dong,ho:ho,buildingId:bid}), i=target(x,id);if(id&&!i)return null;
 return Object.values(state.reports).find(function(r){return !r.archived&&(r.incidentId||null)===(i?i.id:null)&&(!bid||r.buildingId===bid)&&S.addrEquals(r.apt,r.dong,x.apt,x.dong)&&r.ho===x.ho;})||null;
}
function tri(p,fields){var x={};fields.forEach(function(f){if(has(p||{},f.key)&&[true,false,null].indexOf(p[f.key])>=0)x[f.key]=p[f.key];});return x;}
var store={
 getState:function(){return Object.assign({},state,{location:copy(location),activeIncidentId:activeId});},
 getError:function(){return error;},
 subscribe:function(fn){listeners.add(fn);return function(){listeners.delete(fn);};},
 exportBackup:function(){return JSON.stringify({current:state,legacy:localStorage.getItem(OLD),raw:localStorage.getItem(KEY)},null,2);},
 restoreBackup:function(text){
  try {
   var backup=JSON.parse(text), next=backup.current||backup;
   if(!valid(next))return fail('이 버전에서 복구 가능한 SAFE-HOME 백업이 아닙니다.');
   var previous=localStorage.getItem(KEY);
   if(previous)localStorage.setItem(KEY+'_before_restore_'+Date.now(),previous);
   var wasBlocked=blocked;
   baseRaw=previous;state=copy(next);blocked=false;
   log('관리자','백업 복구 — 이전 원본 별도 보존');
   var restored=commit();if(!restored)blocked=wasBlocked;return restored;
  }catch(e){return fail('백업을 읽거나 원본을 보관하지 못했습니다. 현재 기록을 유지합니다.');}
 },
 setLocation:function(x){location=norm(Object.assign({},location,x));notify();return true;},
 getEffectiveBuilding:function(id){var b=S.BUILDINGS[id];if(!b)return null;var o=state.buildingOverrides[id]||{};return Object.assign({},b,{core:Object.assign({},b.core,o.core),suppression:Object.assign({},b.suppression,o.suppression),search:Object.assign({},b.search,o.search),facilityVersion:o.updatedAt||b.importedAt||0});},
 getIncidentBuilding:function(id){var i=incident(id);return i?(i.buildingSnapshot||store.getEffectiveBuilding(i.buildingId)):null;},
 getAfpForAddress:function(apt,dong,ho,id,bid){var x=norm({apt:apt,dong:dong,ho:ho,buildingId:bid}),i=target(x,id);if(id&&!i)return {};if(i)return store.getEffectiveAfp(unit(i,ho),i.afp);var b=buildingFor(x);return b?store.getEffectiveBuilding(b.id).core:{};},
 getEffectiveAfp:function(u,a){return Object.assign({},a,u&&u.afpOverride||{});},
 submitReport:function(p){
  var x=norm(p),i=target(x,p.incidentId),routing=p.routing==='first-auto',candidate=null,first=false;
  if(!x.apt||!x.dong||!x.ho)return fail('아파트·동·호수를 확인해주세요. 신고는 저장하지 않았습니다.');
  if(p.incidentId&&!i)return fail('신고 대상 사건이 유효하지 않습니다.');
  if(routing&&!p.incidentId){var rb=routedBuilding(x);x.buildingId=rb.id;candidate=findOpen(rb.id);first=!candidate;i=first?newIncident(rb):null;if(i){i.autoOpened=true;reportedUnit(i,x.ho);log('시스템','최초 신고로 사건 자동 시작',i.id);}}
  if(i&&Date.now()>i.residentLinkExp)return fail('입주민 링크가 만료되었습니다.');
  if(i&&!unit(i,x.ho))return fail('등록된 세대가 아닙니다. 호수를 확인해주세요.');
  var b=(routing?store.getEffectiveBuilding(x.buildingId)||state.importedBuildings[x.buildingId]:buildingFor(x)),existing=x.complexCode&&!i?Object.values(state.reports).find(function(r){return !r.archived&&!r.incidentId&&r.complexCode===x.complexCode&&r.dong===x.dong&&r.ho===x.ho;}):reportAt(x.apt,x.dong,x.ho,i&&i.id,b&&b.id);
  var key=routing?('report-'+uid()):existing?existing.key:reportKey(x.apt,x.dong,x.ho,i&&i.id,b&&b.id||x.complexCode),old=state.reports[key];
  var r=Object.assign({},x,{fieldObservation:old&&old.fieldObservation||null,version:uid(),readReceipt:null,key:key,buildingId:b&&b.id||null,incidentId:i&&i.id||null,matchedIncidentId:null,answers:copy(p.answers||{}),resultKey:p.resultKey,urgency:p.urgency,notes:p.notes||[],status:fromResult(p.resultKey),
   occupants:Number.isInteger(p.occupants)&&p.occupants>0?p.occupants:null,currentPlace:String(p.currentPlace||'').trim().slice(0,100),hasVulnerable:typeof p.hasVulnerable==='boolean'?p.hasVulnerable:null,
   ruleVersion:S.RULE_VERSION,facilityVersion:i?i.facilityVersion:(b?store.getEffectiveBuilding(b.id).facilityVersion:null),
   previous:old?(old.previous||[]).concat([{at:old.updatedAt,status:old.status,resultKey:old.resultKey}]):[],updatedAt:Date.now(),auto:false});
  if(routing){r.routing='first-auto';r.linkDecision=first?'automatic':'pending';r.candidateIncidentId=candidate?candidate.id:null;}
  state.reports[key]=r;if(i)applyReport(r,i);log('입주민',x.ho+'호 상태 접수',i&&i.id);Object.assign(state.actionLog[0],{reportKey:key,buildingId:r.buildingId,ho:r.ho,apt:r.apt,dong:r.dong});return commit()?key:false;
 },
 acknowledgeReport:function(p){
  var r=state.reports[p.reportKey],actor=String(p.actor||'').trim();
  if(!r||r.archived||r.fieldOnly||!actor||actor.length>40)return fail('대상 신고와 담당자를 확인해주세요.');
  if(r.incidentId&&!writable(r.incidentId))return false;
  if(p.reportVersion!==(r.version||r.updatedAt))return fail('신고 내용이 변경되었습니다. 최신 신고를 다시 확인해주세요.');
  if(r.readReceipt&&r.readReceipt.version===(r.version||r.updatedAt))return true;
  r.readReceipt={version:r.version||r.updatedAt,actor:actor,at:Date.now()};
  state.actionLog.unshift({actor:actor,action:'상황실 신고 열람 확인',reportKey:r.key,incidentId:r.incidentId||null,ho:r.ho,at:r.readReceipt.at,reportVersion:r.readReceipt.version});return commit();
 },
 getReport:function(k){return state.reports[k]||null;},getReportByAddress:reportAt,
 getPendingReports:function(){return Object.values(state.reports).filter(function(r){return !r.archived&&!r.incidentId&&!r.matchedIncidentId;}).sort(function(a,b){return b.updatedAt-a.updatedAt;});},
 markSafeByAddress:function(apt,dong,ho,id,bid){var r=reportAt(apt,dong,ho,id,bid);if(!r)return fail('해당 사건의 신고가 없습니다.');var i=r.incidentId?writable(r.incidentId):null;if(r.incidentId&&(!i||Date.now()>i.residentLinkExp))return fail('사건이 종료되었거나 링크가 만료되었습니다.');r.status='safe';r.updatedAt=Date.now();if(i)applyReport(r,i);log('입주민',S.normalizeHo(ho)+'호 대피 완료',r.incidentId);return commit();},
 getActionLog:function(){return state.actionLog;},
 setBuildingFacility:function(id,p){
  if(!S.BUILDINGS[id])return fail('등록 건물을 찾지 못했습니다.');var o=state.buildingOverrides[id]||{},search=Object.assign({},o.search);
  Object.keys(S.makeUnknownSearch()).forEach(function(k){if(p.search&&has(p.search,k))search[k]=k==='duplexUnits'?p.search[k].map(S.normalizeHo):String(p.search[k]).slice(0,2000);});
  state.buildingOverrides[id]={core:Object.assign({},o.core,tri(p.core,S.AFP_CORE_FIELDS)),suppression:Object.assign({},o.suppression,tri(p.suppression,S.AFP_SUPPRESSION_FIELDS)),search:search,inspector:String(p.inspector||'').trim(),evidence:String(p.evidence||'').trim(),updatedAt:Date.now()};
  log('시설 점검',S.BUILDINGS[id].apt+' '+S.BUILDINGS[id].dong+'동 시설·구조 정보 갱신');return commit();
 },
 registerBuildings:function(rows){
  var groups=Object.create(null),added=0,updated=0;
  for(var r of rows||[]){
   var x=norm(r),code=String(r.complexCode||'').trim(),address=String(r.address||'').trim();var scope=code?'code:'+code:address?'address:'+address:'';if(!x.apt||!x.dong||!x.ho||!scope)return fail('각 행에 아파트명·동·호·단지코드 또는 주소가 필요합니다.');
   var id='imp-'+encodeURIComponent(JSON.stringify([scope,x.dong]));
   if(!groups[id])groups[id]={id:id,apt:x.apt,dong:x.dong,complexCode:String(r.complexCode||''),address:String(r.address||''),units:[]};
   if(groups[id].apt!==x.apt)return fail('같은 단지코드에 다른 아파트명이 있습니다. 원본을 확인해주세요.');
   if(groups[id].units.indexOf(x.ho)<0)groups[id].units.push(x.ho);
  }
  if(!Object.keys(groups).length)return fail('등록할 행이 없습니다.');
  Object.keys(groups).forEach(function(id){var g=groups[id],old=state.importedBuildings[id];if(old)updated++;else added++;
   var floors=g.units.map(S.unitFloor).filter(function(n){return n!==null;});
   state.importedBuildings[id]=Object.assign({},old||{core:S.makeUnknownFacility(S.AFP_CORE_FIELDS),suppression:S.makeUnknownFacility(S.AFP_SUPPRESSION_FIELDS),search:S.makeUnknownSearch(),hallwayType:'미상'},g,{floors:floors.length?Math.max.apply(null,floors):null,unitsPerFloor:null,source:'import',importedAt:Date.now()});
  });log('관리자','건물 등록: 신규 '+added+', 갱신 '+updated);return commit()?{added:added,updated:updated}:false;
 },
 getLinkTtlHours:function(){return state.linkTtlHours;},
 setLinkTtlHours:function(h){h=Number(h);if(!Number.isFinite(h)||h<=0||h>168)return fail('유효시간은 0 초과 168시간 이하입니다.');state.linkTtlHours=h;return commit();},
 regenerateIncidentLinks:function(id){var i=writable(id);if(!i)return false;i.residentLinkExp=i.firefighterLinkExp=Date.now()+state.linkTtlHours*3600000;log('관리자','링크 유효시간 연장',i.id);return commit();},
 listIncidents:function(){return Object.values(state.incidents).sort(function(a,b){return b.confirmedAt-a.confirmedAt;});},
 getIncident:incident,getActiveIncident:function(){return incident(activeId);},
 setActiveIncident:function(id){if(!incident(id)||incident(id).closed)return false;activeId=id;notify();return true;},
 findOpenIncidentForBuilding:findOpen,
 confirmIncidentFromReport:function(k,bid){var r=state.reports[k];return r?store.setIncidentBuilding(bid,r.ho,undefined,k):false;},
 setIncidentBuilding:function(bid,officialHo,editId,reportId){
  var b=store.getEffectiveBuilding(bid),ho=S.normalizeHo(officialHo);if(!b)return fail('등록된 건물을 선택해주세요.');
  var generated=S.generateUnits(b,ho);if(ho&&!has(generated,ho))return fail('화재 호수가 등록된 세대 목록에 없습니다.');
  var i=editId?writable(editId):findOpen(bid);if(editId&&!i)return false;
  if(i&&i.buildingId!==bid)return fail('다른 건물로의 정정은 기존 사건 종료 후 새 사건으로 등록해주세요.');
  if(!i){var now=Date.now();i={id:'inc-'+uid(),buildingId:bid,apt:b.apt,dong:b.dong,officialHo:ho||null,confirmedAt:now,closed:false,units:generated,afp:copy(b.core),unitFacilitiesSnapshot:copy(state.unitFacilities||{}),buildingSnapshot:copy(b),facilityVersion:b.facilityVersion,dispatchNote:'',casualties:{dead:0,severe:0,minor:0,guided:0,selfEvacuated:0},residentLinkExp:now+state.linkTtlHours*3600000,firefighterLinkExp:now+state.linkTtlHours*3600000};state.incidents[i.id]=i;}
  else {i.officialHo=ho||null;Object.values(i.units).forEach(function(u){u.isFireOrigin=u.ho===ho;if(!u.fieldStatus)u.status=u.isFireOrigin?'danger':(u.reportedStatus||'unresponded');});}
  // 관리자가 선택한 미확정 신고만 연결. 과거 기록의 자동 재사용 금지.
  if(reportId){var r=state.reports[reportId];if(!r||r.archived||r.incidentId||!S.addrEquals(r.apt,r.dong,i.apt,i.dong)||(r.buildingId&&r.buildingId!==bid)||!applyReport(r,i)){state=copy(snapshot);return fail('선택한 신고와 사건의 대상이 일치하지 않습니다.');}}
  activeId=i.id;log('관리자',i.apt+' '+i.dong+'동 사건 확정·정정',i.id);return commit()?i.id:false;
 },
 decideReportConnection:function(key,id,decision,actor){
  var r=state.reports[key],i=incident(id),who=String(actor||'').trim();if(!who||!r||r.archived||r.incidentId||!i||i.closed||r.candidateIncidentId!==i.id||r.buildingId!==i.buildingId)return fail('신고 또는 진행 사건이 변경되었습니다. 다시 확인해주세요.');
  if(!['link','hold'].includes(decision))return fail('연결 여부를 선택해주세요.');
  if(decision==='link'){reportedUnit(i,r.ho);applyReport(r,i);}r.linkDecision=decision;r.linkDecidedBy=who;r.linkDecidedAt=Date.now();log(who,decision==='link'?'후속 신고 사건 연결':'후속 신고 별도 보관',i.id);state.actionLog[0].reportKey=key;return commit();
 },
 closeActiveIncident:function(id,actor){var i=writable(id);if(!i)return false;i.closed=true;i.closedAt=Date.now();Object.values(state.reports).forEach(function(r){if(r.incidentId===i.id)r.archived=true;});Object.values(state.reports).forEach(function(r){if(!r.incidentId&&r.candidateIncidentId===i.id){r.archived=true;r.closedWithIncidentId=i.id;}});log(actor||'관리자','사건 종료·기록 보관',i.id);if(activeId===i.id)activeId=null;return commit();},
 adjustCasualty:function(k,d,id){var i=writable(id);if(!i||!has(i.casualties,k)||!Number.isInteger(d))return false;i.casualties[k]=Math.max(0,i.casualties[k]+d);log('소방대원',k+' 집계 '+d,i.id);return commit();},
 getUnit:function(ho,id){return unit(selected(id),ho);},
 getUnits:function(id){var i=selected(id);return i?Object.values(i.units).sort(function(a,b){return (b.floor||0)-(a.floor||0)||String(a.ho).localeCompare(String(b.ho),'ko',{numeric:true});}):[];},
 setUnitAfpOverride:function(ho,o,id){var i=writable(id),u=unit(i,ho);if(!u)return false;u.afpOverride=tri(o,S.AFP_CORE_FIELDS);i.facilityVersion=Date.now();log('상황실',S.normalizeHo(ho)+'호 시설 예외 변경',i.id);return commit();},
 setDispatchNote:function(text,id){var i=writable(id);if(!i)return false;i.dispatchNote=String(text).slice(0,5000);i.noteUpdatedAt=Date.now();i.noteAcknowledgedAt=null;log('상황실','메모 전달',i.id);return commit();},
 acknowledgeNote:function(id){var i=writable(id);if(!i)return false;i.noteAcknowledgedAt=Date.now();log('소방대원','메모 수신 확인',i.id);return commit();},
 getUnitFacility:function(bid,ho,id){
  ho=S.normalizeHo(ho);var i=id?incident(id):null;if(id&&(!i||i.buildingId!==bid))return null;
  var records=i?i.unitFacilitiesSnapshot||{}:state.unitFacilities||{},record=records[JSON.stringify([bid,ho])];
  var u=i?unit(i,ho):null;if(!record&&!(u&&u.afpOverride))return null;
  var out=copy(record||{core:{},locations:{},source:'사건 세대별 등록',inspector:'',verifiedAt:''});if(u&&u.afpOverride)out.core=Object.assign({},out.core,u.afpOverride);return out;
 },
 setUnitFacility:function(p){
  if(p.expectedRevision!==state.revision)return fail('자료가 변경되었습니다. 최신 자료를 다시 불러와주세요.');
  var b=store.getEffectiveBuilding(p.buildingId),ho=S.normalizeHo(p.ho),actor=String(p.actor||'').trim();
  if(!b||!has(S.generateUnits(b,null),ho)||!actor||actor.length>40)return fail('등록 건물·세대·확인자를 선택해주세요.');
  var plan=String(p.plan||'');if(plan.length>2800000||plan&&!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(plan))return fail('평면도는 2MB 이하 PNG·JPG·WebP 파일로 등록해주세요.');
  var source=String(p.source||'').trim(),date=String(p.verifiedAt||'');if(!source||source.length>300||!/^\d{4}-\d{2}-\d{2}$/.test(date))return fail('확인일과 자료 출처를 입력해주세요.');
  var key=JSON.stringify([b.id,ho]),before=copy((state.unitFacilities||{})[key]||null),locations={};
  ['inUnitShelter','downwardEvacuationHatch','lightPartition'].forEach(function(k){locations[k]=String((p.locations||{})[k]||'').slice(0,200);});
  state.unitFacilities=state.unitFacilities||{};state.unitFacilities[key]={core:tri(p.core,S.AFP_CORE_FIELDS),locations:locations,plan:plan,source:source,inspector:actor,verifiedAt:date,updatedAt:Date.now()};
  state.actionLog.unshift({actor:actor,action:'세대 시설·평면도 갱신',buildingId:b.id,ho:ho,at:Date.now(),facilityBefore:before?{verifiedAt:before.verifiedAt,core:before.core}:null,facilityAfter:{verifiedAt:date,core:copy(state.unitFacilities[key].core)}});return commit();
 },
 updateUnitSearch:function(p){
  var i=writable(p.incidentId);if(!i)return false;var u=unit(i,p.ho),actor=String(p.actor||'').trim(),team=String(p.team||'').trim();
  if(!u||!actor||actor.length>40||team.length>40||['unstarted','searching','completed','recheck'].indexOf(p.status)<0)return fail('대상 세대·검색 상태·담당자를 확인해주세요.');
  if(p.expectedRevision!==state.revision)return fail('새 기록이 도착했습니다. 최신 정보를 다시 확인해주세요.');
  var spaces=String(p.spaces||'').trim(),note=String(p.note||'').trim();if(spaces.length>300||note.length>1000||p.status==='completed'&&!spaces)return fail('검색 완료는 확인한 공간을 입력해야 합니다.');
  var before=copy(u.searchRecord||null),at=Date.now();u.searchRecord={status:p.status,spaces:spaces,note:note,actor:actor,team:team,at:at,startedAt:p.status==='searching'?at:before&&before.startedAt||null,completedAt:p.status==='completed'?at:null,requiresReview:false};
  state.actionLog.unshift({actor:actor,team:team,action:'인명검색 '+({unstarted:'미착수',searching:'진행',completed:'완료',recheck:'재검색 필요'}[p.status]),incidentId:i.id,ho:u.ho,at:at,searchBefore:before,searchAfter:copy(u.searchRecord)});return commit();
 },
 getMessages:function(id){return Object.values(state.messages||{}).filter(function(m){return !id||m.incidentId===id;}).sort(function(a,b){return b.at-a.at;});},
 sendMessage:function(p){
  var i=writable(p.incidentId);if(!i)return false;var actor=String(p.actor||'').trim(),body=String(p.body||'').trim(),recipient=String(p.recipient||'현장 전체').trim(),ho=S.normalizeHo(p.ho);
  if(!actor||actor.length>40||!body||body.length>1000||!recipient||recipient.length>40)return fail('담당자·수신 대상·메시지(1~1000자)를 확인해주세요.');
  if(ho&&!unit(i,ho))return fail('메시지 대상 세대가 사건에 없습니다.');
  var id='msg-'+uid(),at=Date.now(),m={id:id,incidentId:i.id,buildingId:i.buildingId,ho:ho||null,actor:actor,recipient:recipient,body:body,urgent:p.urgent===true,status:'sent',at:at,history:[{status:'sent',actor:actor,at:at}]};
  state.messages=state.messages||{};state.messages[id]=m;state.actionLog.unshift({actor:actor,action:'현장 메시지 발신 · '+recipient,incidentId:i.id,ho:ho||null,messageId:id,at:at});return commit()?id:false;
 },
 updateMessage:function(p){
  var m=(state.messages||{})[p.id];if(!m||!writable(m.incidentId))return false;var actor=String(p.actor||'').trim(),team=String(p.team||'').trim();
  if(!actor||actor.length>40)return fail('대원 이름을 먼저 설정해주세요.');if(m.recipient!=='현장 전체'&&m.recipient!==team&&m.recipient!==actor)return fail('수신 대상인 대원 또는 팀만 응답할 수 있습니다.');
  var order=['sent','acknowledged','inprogress','done'];if(m.status!==p.expectedStatus||order.indexOf(p.status)!==order.indexOf(m.status)+1)return fail('메시지 상태가 변경되었습니다. 최신 상태를 확인해주세요.');
  var before=m.status,at=Date.now();m.status=p.status;m.history.push({status:p.status,actor:actor,team:team,at:at});state.actionLog.unshift({actor:actor,team:team,action:'현장 메시지 '+({acknowledged:'확인',inprogress:'조치 중',done:'완료'}[p.status]),incidentId:m.incidentId,ho:m.ho,messageId:m.id,at:at,messageBefore:before,messageAfter:m.status});return commit();
 },
 recordCall:function(p){
  var i=writable(p.incidentId);if(!i)return false;var actor=String(p.actor||'').trim(),ho=S.normalizeHo(p.ho),note=String(p.note||'').trim(),phone=String(p.phone||'').trim();
  if(!actor||actor.length>40||!unit(i,ho)||['connected','noanswer','callback'].indexOf(p.outcome)<0||!note||note.length>1000||phone.length>30)return fail('담당자·대상 호수·통화 결과·메모를 확인해주세요.');
  var at=Date.now(),r={id:'call-'+uid(),incidentId:i.id,ho:ho,actor:actor,phone:phone,outcome:p.outcome,note:note,at:at};state.calls=state.calls||[];state.calls.unshift(r);state.actionLog.unshift({actor:actor,action:'통화 기록 · '+({connected:'연결',noanswer:'부재',callback:'재연락 필요'}[p.outcome]),incidentId:i.id,ho:ho,callId:r.id,at:at});return commit();
 },
 getCalls:function(id){return (state.calls||[]).filter(function(r){return !id||r.incidentId===id;});},
 updateFieldObservation:function(p){
  var actor=String(p.actor||'').trim(), team=String(p.team||'').trim();
  if(!actor||actor.length>40||team.length>40)return fail('수정자 이름을 입력해주세요. 이름·팀은 40자 이내입니다.');
  if(p.expectedRevision!==state.revision)return fail('새 기록이 도착했습니다. 최신 정보를 다시 확인한 뒤 저장해주세요.');
  if(['danger','rescuing','waiting','moving','safe','unresponded'].indexOf(p.status)<0||['unknown','responded','unresponded','lost'].indexOf(p.contact)<0)return fail('현장 상태와 연락 상태를 확인해주세요.');
  var counts=['rescued','remaining'];for(var k of counts){if(p[k]!==null&&(!Number.isInteger(p[k])||p[k]<0||p[k]>999))return fail('인원은 미확인 또는 0~999명으로 입력해주세요.');}
  if(p.reviewResolution&&!String(p.verificationMethod||'').trim())return fail('재확인 방법과 근거를 입력해주세요.');
  if(p.status==='safe'&&p.remaining!==0)return fail('안전 확인은 잔류 인원 0명을 확인한 뒤 저장해주세요.');
  var i=null,r=null,u=null;
  if(p.incidentId){i=writable(p.incidentId);if(!i)return false;u=unit(i,p.ho);if(!u)return fail('대상 세대가 없습니다.');}
  else {r=state.reports[p.reportKey];
   if(!p.reportKey&&p.buildingId){var b=store.getEffectiveBuilding(p.buildingId),ho=S.normalizeHo(p.ho);if(!b||!has(S.generateUnits(b,null),ho))return fail('등록된 세대가 아닙니다.');if(findOpen(b.id))return fail('진행 사건을 선택한 뒤 수정해주세요.');var key=reportKey(b.apt,b.dong,ho,null,b.id);r=state.reports[key];if(!r){r={key:key,buildingId:b.id,apt:b.apt,dong:b.dong,ho:ho,incidentId:null,matchedIncidentId:null,fieldOnly:true,status:'unresponded',answers:{},updatedAt:Date.now()};state.reports[key]=r;}}
   if(!r||r.archived||r.incidentId||r.matchedIncidentId||S.normalizeHo(p.ho)!==r.ho)return fail('신고가 사건에 연결되었거나 유효하지 않습니다. 최신 정보를 확인해주세요.');}
  var t=u||r, before=copy(t.fieldObservation||null),at=Date.now();
  var source=p.source==='situation'||p.source==='field'?p.source:(team==='상황실'?'situation':'field');
  var after={source:source,verificationMethod:String(p.verificationMethod||'').trim().slice(0,200),status:p.status,contact:p.contact,rescued:p.rescued,remaining:p.remaining,note:String(p.note||'').trim().slice(0,1000),actor:actor,team:team,at:at};
  t.fieldObservation=after;
  if(u){u.status=u.fieldStatus=p.status;u.fieldConfirmedAt=u.updatedAt=at;u.needsReview=false;}
  state.actionLog.unshift({actor:actor,team:team,action:source==='situation'?'상황실 판단 수정':'현장 확인 수정',incidentId:i?i.id:null,reportKey:r?r.key:null,buildingId:i?i.buildingId:r.buildingId,apt:i?i.apt:r.apt,dong:i?i.dong:r.dong,ho:S.normalizeHo(p.ho||r.ho),at:at,before:before,after:copy(after)});
  return commit();
 },
 firefighterSetStatus:function(ho,status,id){var i=writable(id),u=unit(i,ho);if(!u||!has(S.STATUS_META,status))return false;u.status=u.fieldStatus=status;u.fieldConfirmedAt=u.updatedAt=Date.now();u.needsReview=false;log('소방대원',S.normalizeHo(ho)+'호 '+status,i.id);return commit();},
 reset:function(){if(blocked)return fail('원본 복구가 먼저 필요합니다. 자동 초기화하지 않았습니다.');state=fresh();location=norm({});activeId=null;return commit();}
};
S.store=store;
}(window.SAFEHOME=window.SAFEHOME||{}));
