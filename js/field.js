/* 현장 지휘: 작전도 / 신고 원문 / 현장 확인 / 수정 이력.
   실제 배치자료는 building.tacticalLayout = {floors:[{label:'5F',cells:['501',null,'502']},...]}
   로 등록합니다. null은 공백, {label:'계단'}은 공용부 표시입니다. */
(function(){'use strict';
const S=window.SAFEHOME,$=id=>document.getElementById(id),esc=S.escapeHtml;
const labels={danger:'구조 필요',rescuing:'구조 중',waiting:'세대 대기',safe:'안전 확인',unresponded:'미응답'};
Object.defineProperties(labels,{blank:{value:''},moving:{value:'이전 이동 기록'}});
const symbols={danger:'!',rescuing:'↗',waiting:'⌂',moving:'↗',safe:'✓',unresponded:'—'};
const contacts={unknown:'미확인',responded:'응답',unresponded:'미응답',lost:'연락 두절'};
let resumeSave=false;
let activeView='board',floorTarget=null,floorSpan='all',compact=false;
let scopeId='',selected='',filter='',query='',zoom=86,dirty=false,editRevision=0,draftStatus='waiting',scope=null,units=[],operator={actor:'',team:''},toastTimer;
try{operator=Object.assign(operator,JSON.parse(sessionStorage.getItem('safehome_field_operator')||'{}'));}catch{}
function recordSource(f){return f?.source==='situation'||(!f?.source&&f?.team==='상황실')?'상황실 판단':'대원 현장 확인';}
function time(t){return t?new Date(t).toLocaleTimeString('ko-KR',{hour12:false,hour:'2-digit',minute:'2-digit',second:'2-digit'}):'기록 없음';}
function day(t){return new Date(t).toLocaleDateString('ko-KR',{month:'2-digit',day:'2-digit'})+' '+time(t);}
function toast(t){$('toast').textContent=t;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),4000);}
function reports(){return S.store.getPendingReports();}
function scopes(){const result=S.store.listIncidents().filter(i=>!i.closed).map(i=>({id:'i:'+i.id,incident:i,building:S.store.getIncidentBuilding(i.id),name:i.apt+' '+i.dong+'동 · 진행 사건'}));
Object.values(S.BUILDINGS).forEach(b=>result.push({id:'b:'+b.id,building:S.store.getEffectiveBuilding(b.id),name:b.apt+' '+b.dong+'동 · 미확정 신고'}));
reports().filter(r=>!r.buildingId).forEach(r=>result.push({id:'r:'+r.key,report:r,building:{apt:r.apt,dong:r.dong,units:[r.ho],source:'unregistered'},name:r.apt+' '+r.dong+'동 '+r.ho+'호 · 미등록 신고'}));return result;}
function getData(){const list=scopes();const requested=S.store.getReport(new URLSearchParams(location.search).get('report'));const latest=requested||reports().filter(r=>!r.fieldOnly).sort((a,b)=>b.updatedAt-a.updatedAt)[0];const preferred=latest?(latest.incidentId?'i:'+latest.incidentId:latest.buildingId?'b:'+latest.buildingId:'r:'+latest.key):'';scope=list.find(x=>x.id===scopeId)||list.find(x=>x.id===preferred)||list[0];if(!scope)return;scopeId=scope.id;
$('scope').innerHTML=list.map(x=>'<option value="'+esc(x.id)+'"'+(x.id===scopeId?' selected':'')+'>'+esc(x.name)+'</option>').join('');
if(scope.incident)units=S.store.getUnits(scope.incident.id).map(u=>({...u,report:Object.values(S.store.getState().reports).find(r=>!r.archived&&r.incidentId===scope.incident.id&&r.ho===u.ho)}));
else{const rows=scope.report?[scope.report]:reports().filter(r=>r.buildingId===scope.building.id);const generated=S.generateUnits(scope.building,null);rows.forEach(r=>{if(!generated[r.ho])generated[r.ho]={ho:r.ho,floor:S.unitFloor(r.ho),unitIndex:parseInt(r.ho.slice(-2),10)||0,unregistered:true};generated[r.ho]={...generated[r.ho],report:r,answers:r.answers,occupants:r.occupants,reportedAt:r.updatedAt,reportedStatus:r.status,fieldObservation:r.fieldObservation,updatedAt:r.updatedAt,status:r.fieldObservation?.status||r.status,needsReview:!!(r.fieldObservation&&!r.fieldOnly&&r.updatedAt>r.fieldObservation.at&&(r.status!==r.fieldObservation.status||r.urgency==='critical'))};if(generated[r.ho].needsReview&&r.urgency==='critical')generated[r.ho].status='danger';});units=Object.values(generated);}
units=units.map(u=>S.UnitDisplay.project(u,u.report));
if(selected&&!dirty&&!units.some(u=>u.ho===selected)){selected='';dirty=false;}
}
function scopedLogs(){const state=S.store.getActionLog();if(scope.incident){const keys=Object.values(S.store.getState().reports).filter(r=>r.incidentId===scope.incident.id).map(r=>r.key);return state.filter(l=>l.incidentId===scope.incident.id||l.reportKey&&keys.includes(l.reportKey));}if(scope.report)return state.filter(l=>l.reportKey===scope.report.key);return state.filter(l=>!l.incidentId&&l.buildingId===scope.building.id);}
function render(){getData();if(!scope)return;
let pendingButton=$('pending-reports-button');if(!pendingButton){pendingButton=document.createElement('button');pendingButton.id='pending-reports-button';pendingButton.className='outline';$('scope').parentElement.after(pendingButton);}
const incoming=reports().filter(r=>!r.fieldOnly).sort((a,b)=>b.updatedAt-a.updatedAt);pendingButton.hidden=!incoming.length;pendingButton.textContent='미확정 신고 '+incoming.length+'건 · 최신 신고 보기';pendingButton.onclick=()=>{if(dirty){toast('작성 중인 내용을 저장한 뒤 신고를 열어주세요.');return;}const r=incoming[0];scopeId=r.buildingId?'b:'+r.buildingId:'r:'+r.key;selected=r.ho;filter='';query='';$('search').value='';render();setView('board');};
const b=scope.building,i=scope.incident;$('building-title').textContent=b.apt+' '+b.dong+'동';
$('incident-meta').innerHTML=i?'최초 발화 확인 <strong>'+esc(i.officialHo?i.officialHo+'호':'미지정')+'</strong><br>사건 생성 '+time(i.confirmedAt):'<strong>미확정 신고 보기</strong><br>공식 사건 확정은 관리자 화면에서 진행';
$('updated').textContent='마지막 저장 '+time(S.store.getState().updatedAt);
const error=S.store.getError();$('error').hidden=!error;$('error').textContent=error;
$('metrics').innerHTML=Object.keys(labels).map(k=>'<button class="metric '+k+(filter===k?' active':'')+'" data-filter="'+k+'" aria-pressed="'+(filter===k)+'"><small>'+symbols[k]+' '+labels[k]+'</small><strong>'+units.filter(u=>u.status===k).length+'<em>세대</em></strong></button>').join('');
$('metrics').querySelectorAll('[data-filter]').forEach(e=>e.onclick=()=>{filter=filter===e.dataset.filter?'':e.dataset.filter;render();});
renderBoard();renderReports();renderLogs();if(!dirty)renderDetail();else{const stale=$('stale');if(stale){stale.hidden=false;stale.textContent='새 기록이 도착했습니다. 입력 중인 내용은 유지했습니다. 최신 정보 다시 불러오기를 누른 뒤 확인해주세요.';}}
}
function searchBadge(u){const r=u.searchRecord;if(!r)return '';return '<span class="search-mark '+(r.requiresReview?'recheck':'')+'">'+(r.requiresReview?'재검색':({searching:'검색 중',completed:'검색 완료',recheck:'재검색',unstarted:'미착수'}[r.status]))+'</span>';}
function renderBoard(){const b=scope.building,layout=b.tacticalLayout;$('unit-count').textContent=units.length+'세대';$('map-source').textContent=layout?'등록된 세대 배치자료 · 실제 위치는 현장 확인 필요':b.source==='import'?'등록 호수 기준 개략도 · 실제 좌우 배치 미등록':'데모 건물 · 호수 기준 개략도 · 실제 배치도 미등록';
const byHo=new Map(units.map(u=>[u.ho,u]));
function cell(ho){const u=byHo.get(String(ho));if(!u)return '<div class="unit-empty">등록 세대 없음</div>';const match=(!filter||u.status===filter)&&(!query||u.ho.includes(query));const f=u.fieldObservation;
return '<button class="unit '+esc(u.status||'blank')+(u.received?' received':'')+(u.ho===selected?' active':'')+(!match?' dimmed':'')+(u.isFireOrigin?' origin':'')+(u.needsReview?' review':'')+'" data-ho="'+esc(u.ho)+'" aria-label="'+esc(u.ho+'호 '+labels[u.status]+(u.isFireOrigin?' 최초 발화':''))+'" aria-pressed="'+(u.ho===selected)+'"><strong>'+esc(u.ho)+'</strong><span class="unit-status">'+(symbols[u.status]||'')+' '+labels[u.status]+'</span><small>'+(f?.remaining!==null&&f?.remaining!==undefined?'잔류 '+f.remaining+'명':u.occupants!=null?'신고 '+u.occupants+'명':u.received?'신고 접수':'')+'</small>'+(u.isFireOrigin?'<span class="marker" title="최초 발화 세대">🔥</span>':'')+'</button>';}
let rows=[];
if(layout?.floors){const seen=new Set();rows=layout.floors.map(row=>'<div class="board-row"><span class="floor-label">'+esc(row.label)+'</span>'+row.cells.map(c=>{if(c===null)return '<div class="unit-empty" aria-label="빈 공간"></div>';if(typeof c==='object')return '<div class="unit-empty">'+esc(c.label)+'</div>';seen.add(String(c));return cell(c);}).join('')+'</div>');const missing=units.filter(u=>!seen.has(u.ho));if(missing.length)rows.push('<div class="board-row"><span class="floor-label">미배치</span>'+missing.map(u=>cell(u.ho)).join('')+'</div>');}
else{const lines=[...new Set(units.map(u=>u.unitIndex))].sort((a,b)=>a-b),floors=[...new Set(units.map(u=>u.floor))].sort((a,b)=>(b??-1)-(a??-1));rows=floors.map(f=>'<div class="board-row"><span class="floor-label">'+(f===null?'미상':esc(f)+'F')+'</span>'+lines.map(line=>{const u=units.find(u=>u.floor===f&&u.unitIndex===line);return u?cell(u.ho):'<div class="unit-empty">—</div>';}).join('')+'</div>');}
$('board').innerHTML=rows.join('')||'<div class="empty">등록된 세대가 없습니다.</div>';
setupFloors();
$('board').querySelectorAll('[data-ho]').forEach(e=>{const u=units.find(u=>u.ho===e.dataset.ho);if(u)e.insertAdjacentHTML('beforeend',searchBadge(u));});
$('board').querySelectorAll('[data-ho]').forEach(e=>e.onclick=()=>{if(dirty&&!confirm('입력 중인 변경을 버리고 다른 세대를 열까요?'))return;dirty=false;selected=e.dataset.ho;render();$('detail').classList.add('mobile-open');$('detail').scrollTop=0;});
}
function setupFloors(){
 const floors=[...new Set(units.map(u=>u.floor).filter(f=>f!==null&&f!==undefined))].sort((a,b)=>b-a);
 if(!floors.includes(floorTarget))floorTarget=scope.incident?.officialHo?S.unitFloor(scope.incident.officialHo):floors[0];
 if(!floors.includes(floorTarget))floorTarget=floors[0];
 $('floor-jump').innerHTML=floors.map(f=>'<option value="'+f+'"'+(f===floorTarget?' selected':'')+'>'+f+'층</option>').join('');
 $('board').querySelectorAll('.board-row').forEach(row=>{const ho=row.querySelector('[data-ho]')?.dataset.ho;const f=units.find(u=>u.ho===ho)?.floor;row.dataset.floor=f??'unknown';});
 applyFloorRange();
}
function applyFloorRange(){
 const floors=[...new Set(units.map(u=>u.floor).filter(f=>f!==null&&f!==undefined))].sort((a,b)=>b-a),index=Math.max(0,floors.indexOf(floorTarget)),n=floorSpan==='all'?floors.length:Number(floorSpan),start=Math.min(Math.max(0,index-Math.floor(n/2)),Math.max(0,floors.length-n)),visible=new Set(floors.slice(start,start+n));
 $('board').querySelectorAll('.board-row').forEach(row=>{row.hidden=floorSpan!=='all'&&row.dataset.floor!=='unknown'&&!visible.has(Number(row.dataset.floor));});
 $('floor-summary').textContent=floors.length?'전체 '+floors.length+'개 층 · '+(floorSpan==='all'?'전체 표시':Math.min(n,floors.length)+'개 층 표시'):'';
}
function jumpFloor(f){floorTarget=Number(f);$('floor-jump').value=String(floorTarget);applyFloorRange();const row=[...$('board').querySelectorAll('.board-row')].find(r=>Number(r.dataset.floor)===floorTarget);if(row){const v=$('board-viewport');v.scrollTop+=row.getBoundingClientRect().top-v.getBoundingClientRect().top-12;}}
$('floor-jump').onchange=e=>jumpFloor(e.target.value);
$('floor-span').onchange=e=>{floorSpan=e.target.value;applyFloorRange();jumpFloor(floorTarget);};
$('origin-jump').onclick=()=>{const ho=scope.incident?.officialHo;if(!ho){toast('최초 발화 세대가 확정되지 않았습니다.');return;}jumpFloor(S.unitFloor(ho));};
$('density').onclick=()=>{compact=!compact;$('board').classList.toggle('compact',compact);$('density').setAttribute('aria-pressed',String(compact));$('density').textContent=compact?'상세 보기':'압축 보기';};
document.addEventListener('safehome-unit-dirty',e=>{dirty=e.detail;});
document.addEventListener('safehome-open-unit',e=>{if(e.detail?.incidentId!==scope.incident?.id)return;selectUnit(e.detail.ho);if(selected===e.detail.ho)e.detail.opened=true;});
// Right-click changes use the existing validation, identity and audit-log save path.
const statusMenu=document.createElement('div');statusMenu.id='field-status-menu';statusMenu.hidden=true;statusMenu.setAttribute('role','menu');statusMenu.setAttribute('aria-label','세대 상태 변경');document.body.append(statusMenu);
let menuTrigger=null;
function closeStatusMenu(focus=false){statusMenu.hidden=true;if(focus&&menuTrigger?.isConnected)menuTrigger.focus();}
function openStatusMenu(button,x,y){
 closeStatusMenu();const target=button.dataset.ho;if(!selectUnit(target))return;
 const targetScope=scopeId;menuTrigger=$('board').querySelector('[data-ho="'+CSS.escape(target)+'"]');
 statusMenu.innerHTML='<strong>'+esc(target)+'호 · 상태 변경</strong>'+Object.keys(labels).map(k=>'<button type="button" role="menuitem" data-menu-status="'+k+'">'+symbols[k]+' '+labels[k]+'</button>').join('')+'<small>입력자·시각·변경 전후 상태가 자동 기록됩니다.</small>';
 statusMenu.hidden=false;statusMenu.style.left='0px';statusMenu.style.top='0px';const rect=statusMenu.getBoundingClientRect();statusMenu.style.left=Math.max(8,Math.min(x,innerWidth-rect.width-8))+'px';statusMenu.style.top=Math.max(8,Math.min(y,innerHeight-rect.height-8))+'px';
 statusMenu.querySelectorAll('button').forEach(b=>b.onclick=()=>{closeStatusMenu();if(scopeId!==targetScope||selected!==target){toast('선택 세대가 변경되었습니다. 다시 선택해주세요.');return;}const save=$('save-field');if(!save||save.disabled){toast('현재 세대는 상태를 저장할 수 없습니다. 상세정보를 확인해주세요.');return;}const choice=$('detail').querySelector('[data-status="'+b.dataset.menuStatus+'"]');if(!choice)return;if(b.dataset.menuStatus==='safe'){if(!confirm(target+'호의 안전과 잔류 인원 0명을 확인했습니까?\n확인하면 입력자와 시각을 기록하고 안전 상태로 저장합니다.'))return;$('remaining').value='0';$('verification-method').value='우클릭 상태 변경 · 입력자가 안전 및 잔류 0명 확인';}else{$('verification-method').value='우클릭 상태 변경 · 입력자 기록';}choice.click();$('field-form').requestSubmit();});
 statusMenu.querySelector('button').focus();
}
$('board').addEventListener('contextmenu',e=>{const button=e.target.closest('[data-ho]');if(!button)return;e.preventDefault();openStatusMenu(button,e.clientX,e.clientY);});
$('board').addEventListener('keydown',e=>{if(e.key!=='ContextMenu'&&!(e.shiftKey&&e.key==='F10'))return;const button=e.target.closest('[data-ho]');if(!button)return;e.preventDefault();const r=button.getBoundingClientRect();openStatusMenu(button,r.left,r.bottom);});
statusMenu.addEventListener('keydown',e=>{const buttons=[...statusMenu.querySelectorAll('button')],i=buttons.indexOf(document.activeElement);if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeStatusMenu(true);}else if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();const n=e.key==='Home'?0:e.key==='End'?buttons.length-1:(i+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length;buttons[n].focus();}else if(e.key==='Tab')closeStatusMenu();});
document.addEventListener('pointerdown',e=>{if(!statusMenu.contains(e.target))closeStatusMenu();});
window.addEventListener('resize',()=>closeStatusMenu());
$('board-viewport').addEventListener('scroll',()=>closeStatusMenu());
function selectUnit(ho){if(dirty&&!confirm('입력 중인 변경을 버리고 다른 세대를 열까요?'))return false;dirty=false;selected=ho;render();$('detail').classList.add('mobile-open');$('detail').scrollTop=0;return true;}
function renderReports(){
 const rows=units.filter(u=>(u.report||u.fieldObservation||u.isFireOrigin)&&(!filter||u.status===filter)).sort((a,b)=>({danger:0,rescuing:0.5,moving:1,waiting:2,unresponded:3,safe:4}[a.status]-{danger:0,rescuing:0.5,moving:1,waiting:2,unresponded:3,safe:4}[b.status])||((b.reportedAt||0)-(a.reportedAt||0)));
 $('report-count').textContent=units.filter(u=>u.report&&!u.report.fieldOnly).length;
 $('report-list').innerHTML=rows.length?rows.map(u=>'<button class="report-row '+(u.ho===selected?'selected':'')+'" data-report-ho="'+esc(u.ho)+'"><span class="report-signal '+u.status+'">'+(symbols[u.status]||'')+'</span><span class="report-main"><strong>'+esc(scope.building.dong)+'동 '+esc(u.ho)+'호</strong><small>'+esc(answerText(u.report?.answers||u.answers))+'</small><span>'+(u.fieldObservation?recordSource(u.fieldObservation)+' · '+esc(u.fieldObservation.actor):'현장 미확인')+(u.needsReview?' · ◈ 재확인':'')+'</span></span><span class="report-end"><b class="'+u.status+'">'+labels[u.status]+'</b><time>'+time(u.report?.updatedAt||u.updatedAt)+'</time></span></button>').join(''):'<div class="empty"><strong>접수된 신고가 없습니다.</strong>입주민 앱에서 현재 상태를 저장하면<br>이 목록과 작전도에 함께 반영됩니다.</div>';
 $('report-list').querySelectorAll('[data-report-ho]').forEach(b=>b.onclick=()=>selectUnit(b.dataset.reportHo));
}
function setView(view){activeView=view;$('map-panel').hidden=view!=='board';$('reports-panel').hidden=view!=='reports';$('activity-panel').hidden=view!=='history';document.querySelectorAll('[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===view);b.setAttribute('aria-pressed',String(b.dataset.view===view));});}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));
function changes(before,after){const fields={status:'현장 상태',contact:'연락 상태',rescued:'구조 인원',remaining:'잔류 인원',note:'메모',source:'확인 출처',verificationMethod:'확인 방법·근거'};function val(k,v){if(v===undefined||v===null)return '미확인';if(k==='source')return v==='situation'?'상황실 판단':v==='field'?'대원 현장 확인':'출처 미확인';if(k==='status')return labels[v]||v;if(k==='contact')return contacts[v]||v;return String(v)||'없음';}return Object.keys(fields).filter(k=>before?.[k]!==after?.[k]).map(k=>'<span>'+fields[k]+': '+esc(val(k,before?.[k]))+' → <b>'+esc(val(k,after?.[k]))+'</b></span>').join('')||'<span>내용 재확인 · 수정자와 시각 갱신</span>';}
function logHtml(l){if(l.searchAfter)return '<article class="log-entry"><b>'+esc(l.actor)+' · '+esc(l.team||'')+' · '+esc(l.ho)+'호</b><time>'+day(l.at)+'</time><p>'+esc(l.action)+'</p><p>'+esc(l.searchBefore?.status||'unstarted')+' → '+esc(l.searchAfter.status)+'<br>'+esc(l.searchAfter.spaces)+'<br>'+esc(l.searchAfter.note)+'</p></article>';return '<article class="log-entry"><div class="log-top"><b>'+esc(l.actor)+(l.team?' · '+esc(l.team):'')+'</b>'+(l.ho?'<span>'+esc(l.ho)+'호</span>':'')+'<time>'+day(l.at)+'</time></div><p>'+esc(l.action)+'</p>'+(l.after?.status?'<p class="status-change-log">'+esc(labels[l.before?.status]||'미확인')+' → <strong>'+esc(labels[l.after.status]||l.after.status)+'</strong></p>':'')+(l.after?'<details><summary>변경 전후 보기</summary><div class="diff">'+changes(l.before,l.after)+'</div>'+(l.after.note?'<p>메모: '+esc(l.after.note)+'</p>':'')+'</details>':'')+'</article>';}
function renderLogs(){const q=$('log-search').value.trim(),logs=scopedLogs().filter(l=>!q||[l.actor,l.team,l.ho,l.action].some(x=>String(x||'').includes(q)));$('log-count').textContent=logs.length+'건';$('logs').innerHTML=logs.length?'<div class="log-list">'+logs.slice(0,100).map(logHtml).join('')+'</div>':'<div class="empty">아직 현장 활동 기록이 없습니다.<br>현장 확인을 저장하면 수정자와 변경 내용이 여기에 표시됩니다.</div>';}
function answerText(a){if(!a)return '응답 없음';return Object.entries(a).filter(([k])=>/^q[1-5]$/.test(k)).map(([k,v])=>({q1:'화재 위치',q2:'실내 연기',q3:'현관',q4:'경로',q5:'층 관계'}[k])+': '+v).join(' · ')||'상세 응답 없음';}
// 현장 화면에서 선택지를 펼치되 기존 저장·충돌 검증을 유지합니다.
function exposeFieldChoices(select, label){
 if(!select)return;
 const group=document.createElement('div');group.className='field-direct-choices';group.setAttribute('role','group');group.setAttribute('aria-label',label);
 const sync=()=>group.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.value===select.value)));
 for(const option of select.options){const b=document.createElement('button');b.type='button';b.dataset.value=option.value;b.textContent=option.textContent;b.onclick=()=>{select.value=option.value;sync();select.dispatchEvent(new Event('input',{bubbles:true}));select.dispatchEvent(new Event('change',{bubbles:true}));};group.append(b);}
 select.hidden=true;select.insertAdjacentElement('afterend',group);sync();
}
function simplifyFieldDetail(){
 const detail=$('detail'),tools=$('unit-tools');
 tools.querySelectorAll('details.unit-tool').forEach(d=>d.open=true);
 exposeFieldChoices($('contact'),'연락 상태');
 exposeFieldChoices(tools.querySelector('[name="searchStatus"]'),'인명검색 상태');
 const nav=document.createElement('nav');nav.className='field-section-jumps';nav.setAttribute('aria-label','세대 작업 바로가기');
 const targets=[['현장 상태',$('field-form')],['인명검색',tools.querySelector('.search-tool')],['신고 정보',detail.querySelector('.report-card')],['시설·평면도',tools.querySelectorAll('.unit-tool')[1]],['특이구조',tools.querySelectorAll('.unit-tool')[2]],['수정 이력',$('unit-logs')]];
 targets.forEach(([label,target])=>{if(!target)return;const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=()=>{if(target.tagName==='DETAILS')target.open=true;target.scrollIntoView({block:'start',behavior:'auto'});};nav.append(b);});
 detail.querySelector('.detail-head').after(nav);
}
function renderDetail(){const u=units.find(u=>u.ho===selected);if(!u){$('detail').innerHTML='<div class="initial-detail"><span class="cross">⌖</span><span class="eyebrow">UNIT INSPECTION</span><h2>작전도에서 세대를 선택하세요.</h2><p>입주민 신고와 현장 확인을 나란히 보고<br>수정자와 변경 이력을 기록할 수 있습니다.</p><a href="resident.html" target="_blank" rel="noopener" class="outline">입주민 앱 열기 ↗</a><p>같은 주소·브라우저에서 저장한 신고가<br>작전도에 반영됩니다.</p></div>';return;}
editRevision=S.store.getState().revision;const f=u.fieldObservation,r=u.report,canEdit=!!scope.incident||!!r||!!scope.building.id;draftStatus=(f?.status==='moving'?'':f?.status)||(['danger','rescuing','waiting','safe','unresponded'].includes(u.status)?u.status:'');
const raw=scope.incident?u.afpOverride:null; // 세대 예외만 세대별 확인 자료로 표시. 동 공통값은 상속하지 않음.
const fields=[['inUnitShelter','대피공간'],['downwardEvacuationHatch','하향식 피난구'],['lightPartition','경량칸막이']];
$('detail').innerHTML='<div class="detail-head"><button class="detail-mobile-close" id="detail-close">닫기 ✕</button><span class="eyebrow">UNIT DETAILS / '+esc(scope.building.dong)+'D</span><div class="detail-title"><h2>'+esc(u.ho)+'<span style="font-size:15px">호</span></h2><span class="status-badge">'+(symbols[u.status]||'')+' '+labels[u.status]+'</span></div><p>'+esc(scope.building.apt)+' '+esc(scope.building.dong)+'동'+(u.isFireOrigin?' · 🔥 최초 발화 확인 세대':'')+'<br>'+(f?recordSource(f)+' '+day(f.at)+' · '+esc(f.actor):'현장 확인 기록 없음')+'</p></div><div class="detail-body">'+(u.needsReview?'<div class="review-banner">◈ 입주민 신고와 현장 확인이 다릅니다. 최신 신고를 다시 확인해주세요.</div>':'')+'<h3 class="section-title">입주민 신고 <small>원문 보존</small></h3><div class="report-card"><dl><dt>신고 상태</dt><dd>'+esc(r&&!r.fieldOnly?labels[r.status]||r.status:'미접수')+'</dd><dt>현재 위치</dt><dd>'+esc(r?.currentPlace||'미확인')+'</dd><dt>인원</dt><dd>'+(r?.occupants==null?'미확인':r.occupants+'명')+'</dd><dt>이동 지원</dt><dd>'+esc(r?.hasVulnerable===true?'도움 필요':r?.hasVulnerable===false?'필요 없음':'미확인')+'</dd><dt>상황 응답</dt><dd>'+esc(answerText(r?.answers||u.answers))+'</dd></dl><div class="stamp">'+(r&&!r.fieldOnly?'입주민 · '+day(r.updatedAt):'신고가 저장되면 이곳에 표시됩니다.')+'</div></div><div class="section-separator"></div><div id="unit-tools"></div><div class="section-separator"></div><h3 class="section-title">현장 확인 수정 <small id="edit-actor">'+esc(operator.actor||'수정자 미설정')+'</small></h3><div id="stale" class="stale" hidden></div><button id="reload-detail" class="outline" style="width:100%;margin-bottom:12px">최신 정보 다시 불러오기</button>'+(canEdit?'':'<div class="review-banner">미확정 보기의 신고 없는 세대입니다. <a href="/?role=admin" target="_blank" rel="noopener"><u>관리자에서 사건을 확정</u></a>하면 현장 확인을 기록할 수 있습니다.</div>')+'<form id="field-form"><div class="status-options" role="group" aria-label="현장 상태">'+['danger','rescuing','waiting','safe','unresponded'].map(k=>'<button type="button" data-status="'+k+'" class="status-choice '+(draftStatus===k?'selected':'')+'" aria-pressed="'+(draftStatus===k)+'">'+symbols[k]+' '+labels[k]+'</button>').join('')+'</div><label>연락 상태<select id="contact">'+Object.keys(contacts).map(k=>'<option value="'+k+'"'+((f?.contact||'unknown')===k?' selected':'')+'>'+contacts[k]+'</option>').join('')+'</select></label><div class="form-row"><label>구조 인원<input id="rescued" type="number" min="0" max="999" inputmode="numeric" placeholder="미확인" value="'+(f?.rescued??'')+'"></label><label>잔류 인원<input id="remaining" type="number" min="0" max="999" inputmode="numeric" placeholder="미확인" value="'+(f?.remaining??'')+'"></label></div><label>확인 방법 · 근거<input id="verification-method" maxlength="200" placeholder="예: 직접 진입 확인, 상황실 통화 인계" value="'+esc(f?.verificationMethod||'')+'"></label><label>현장 메모<textarea id="field-note" maxlength="1000" placeholder="현재 위치, 진입 상황, 인계 내용을 기록하세요.">'+esc(f?.note||'')+'</textarea></label></form><div class="section-separator"></div><h3 class="section-title">이 세대 수정 이력</h3><div id="unit-logs">'+(scopedLogs().filter(l=>l.ho===u.ho).slice(0,20).map(logHtml).join('')||'<p class="facility-note">아직 수정 기록이 없습니다.</p>')+'</div></div><div class="save-area"><button id="save-field" form="field-form" class="solid" '+(!canEdit?'disabled':'')+'>현장 확인 저장</button><p>수정자 · 변경 전후 · 시각을 함께 기록합니다.</p></div>';
$('detail').querySelector('.report-card').insertAdjacentHTML('afterend',S.ComplexInfo.html(r||scope.building));
S.UnitTools.render($('unit-tools'),{incidentId:scope.incident?.id,buildingId:scope.building.id,ho:u.ho,actor:()=>operator,onRefresh:()=>{dirty=false;render();}});
const body=$('detail').querySelector('.detail-body'),form=$('field-form'),heading=$('edit-actor').parentElement;body.prepend(form);body.prepend(heading);simplifyFieldDetail();
$('detail-close').onclick=()=>$('detail').classList.remove('mobile-open');
$('reload-detail').onclick=()=>{if(dirty&&!confirm('입력 중인 변경을 버리고 최신 정보를 불러올까요?'))return;dirty=false;render();};
$('field-form').addEventListener('input',()=>{dirty=true;$('unit-tools').querySelector('.tool-save').disabled=true;});$('unit-tools').addEventListener('input',()=>{$('save-field').disabled=true;});
$('detail').querySelectorAll('[data-status]').forEach(b=>b.onclick=()=>{draftStatus=b.dataset.status;dirty=true;$('unit-tools').querySelector('.tool-save').disabled=true;$('detail').querySelectorAll('[data-status]').forEach(x=>{x.classList.toggle('selected',x===b);x.setAttribute('aria-pressed',String(x===b));});});
$('field-form').onsubmit=e=>{e.preventDefault();if(!canEdit)return;if(!operator.actor){resumeSave=true;$('identity-dialog').showModal();return;}
if(draftStatus==='safe'&&!$('verification-method').value.trim()){toast('안전 확인 방법·근거를 입력해주세요.');$('verification-method').focus();return;}
const count=id=>$(id).value===''?null:Number($(id).value);const ok=S.store.updateFieldObservation({actor:operator.actor,team:operator.team,source:'field',verificationMethod:$('verification-method').value,incidentId:scope.incident?.id,reportKey:r?.key,buildingId:scope.building.id,ho:u.ho,status:draftStatus,contact:$('contact').value,rescued:count('rescued'),remaining:count('remaining'),note:$('field-note').value,expectedRevision:editRevision});
if(ok){dirty=false;render();toast('현장 확인과 수정 이력을 저장했습니다.');}else toast(S.store.getError()||'저장하지 못했습니다.');};
}
$('scope').onchange=e=>{if(dirty&&!confirm('입력 중인 변경을 버리고 대상을 바꿀까요?')){e.target.value=scopeId;return;}dirty=false;selected='';scopeId=e.target.value;floorTarget=null;render();jumpFloor(floorTarget);};
$('search').oninput=e=>{query=e.target.value.trim();renderBoard();const match=units.find(u=>u.ho===query);if(match&&match.floor!==null)jumpFloor(match.floor);};$('log-search').oninput=renderLogs;
function size(){document.documentElement.style.setProperty('--cell',zoom+'px');$('zoom-value').value=Math.round(zoom/106*100)+'%';}
$('zoom-in').onclick=()=>{zoom=Math.min(180,zoom+12);size();};$('zoom-out').onclick=()=>{zoom=Math.max(58,zoom-12);size();};$('fit').onclick=()=>{const b=$('board'),columns=b.querySelector('.board-row')?.children.length-1||4;zoom=Math.min(150,Math.max(58,Math.floor(($('board-viewport').clientWidth-85-columns*9)/columns)));size();};
$('clear-filter').onclick=()=>{filter='';query='';$('search').value='';render();};
$('expand').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{toast('이 환경에서는 전체화면을 지원하지 않습니다. 브라우저 확대를 이용해주세요.');}};
function identityLabel(){$('identity-button').textContent=operator.actor?(operator.team?operator.team+' · ':'')+operator.actor:'수정자 설정';if($('edit-actor'))$('edit-actor').textContent=operator.actor||'수정자 미설정';}
$('identity-dialog').addEventListener('cancel',()=>resumeSave=false);
$('identity-button').onclick=()=>{$('actor').value=operator.actor;$('team').value=operator.team;$('identity-dialog').showModal();};$('identity-cancel').onclick=()=>{resumeSave=false;$('identity-dialog').close();};$('identity-form').onsubmit=e=>{e.preventDefault();const actor=$('actor').value.trim();if(!actor)return;operator={actor,team:$('team').value.trim()};try{sessionStorage.setItem('safehome_field_operator',JSON.stringify(operator));}catch{}$('identity-dialog').close();identityLabel();toast('수정자 정보를 적용했습니다.');if(resumeSave){resumeSave=false;$('field-form')?.requestSubmit();}};
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});document.addEventListener('keydown',e=>{if(e.key==='Escape')$('detail').classList.remove('mobile-open');});
$('load-sample').onclick=()=>{if(dirty&&!confirm('입력 중인 변경을 버리고 샘플을 열까요?'))return;const [floors,per]=String($('sample-size').value).split(',').map(Number),rows=[],code='FIELD-SAMPLE-'+floors+'-'+per;for(let f=1;f<=floors;f++)for(let h=1;h<=per;h++)rows.push({apt:'[샘플] '+floors+'층 아파트',dong:'101',ho:String(f)+String(h).padStart(2,'0'),complexCode:code});if(!S.store.registerBuildings(rows)){toast(S.store.getError());return;}const b=Object.values(S.BUILDINGS).find(x=>x.complexCode===code),id=S.store.setIncidentBuilding(b.id,'');if(!id){toast(S.store.getError());return;}dirty=false;selected='';scopeId='i:'+id;floorTarget=floors;filter='';query='';$('search').value='';render();size();setView('board');jumpFloor(floors);toast(floors+'층 · '+per+'세대/층 · 총 '+rows.length+'세대 샘플입니다. 모든 세대 상태를 수정할 수 있습니다.');};
S.store.subscribe(render);identityLabel();render();size();setView('board');
})();
