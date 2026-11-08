(function () {
'use strict';
const S = window.SAFEHOME, C = window.RESIDENT_DESIGN;
const paths = {
 shield:'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z"/><path d="m9 12 2 2 4-4"/>',
 home:'<path d="m3 10 9-7 9 7v10H3z"/><path d="M9 20v-7h6v7"/>',
 sliders:'<path d="M4 7h7m4 0h5M4 17h3m4 0h9"/><circle cx="13" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
 arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>', close:'<path d="m6 6 12 12M6 18 18 6"/>',
 info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>',
 help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4 2c-1 .5-1.5 1-1.5 2m0 3v1"/>',
 pin:'<path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
 search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
 phone:'<path d="m5 3 4 4-2 3c1 3 4 6 7 7l3-2 4 4-2 3C10 23 1 14 2 5z"/>',
 down:'<path d="M12 3v18m-7-7 7 7 7-7"/>',up:'<path d="M12 21V3M5 10l7-7 7 7"/>',
 layers:'<path d="m3 7 9-4 9 4-9 4zM3 12l9 4 9-4M3 17l9 4 9-4"/>',
 wind:'<path d="M3 8h12a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h5a3 3 0 1 1-3 3"/>',
 cloud:'<path d="M6 18a4 4 0 1 1 .5-8A6 6 0 0 1 18 8a5 5 0 1 1 0 10z"/>',
 flame:'<path d="M13 2c1 6-5 7-4 11 2 0 3-2 3-3 5 3 6 6 3 9-4 4-11 1-11-4 0-4 4-6 4-9 1 1 2 2 2 3 2-2 3-4 3-7Z"/>',
 door:'<path d="M5 21V3h14v18M3 21h18M9 3v18m6-10v2"/>',
 lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4m-4 5v2"/>',
 stairs:'<path d="M2 21h5v-5h5v-5h5V6h5M3 9l6-6m-6 0h6v6"/>',
 refresh:'<path d="M20 7a9 9 0 1 0 1 9M20 2v6h-6"/>',
 speaker:'<path d="M3 9h4l5-5v16l-5-5H3zm13-1a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
 save:'<path d="M4 3h13l4 4v14H3V3zm3 0v6h10V3M7 21v-7h10v7"/>'
};
const icon = name => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(paths[name]||paths.info)+'</svg>';
const esc = x => String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function icons(parent=document){parent.querySelectorAll('[data-icon]').forEach(e=>e.innerHTML=icon(e.dataset.icon));}
const state={ phase:0, step:0, answers:{}, loc:{apt:'',dong:'',ho:'',buildingId:null}, result:null, preview:false, details:{currentPlace:'',occupants:'',hasVulnerable:null}, lastSaved:null };
const screen=document.getElementById('screen');
let timer;
function toast(text){const e=document.getElementById('toast');e.textContent=text;e.classList.add('visible');clearTimeout(timer);timer=setTimeout(()=>e.classList.remove('visible'),4500);}
function safeRead(key){try{return JSON.parse(localStorage.getItem(key)||'null');}catch{return null;}}
function safeWrite(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{return false;}}
const previous=safeRead('safehome_resident_design_location');if(previous&&typeof previous.apt==='string')Object.assign(state.loc,previous);
const savedSummary=safeRead('safehome_resident_design_last_saved');
if(savedSummary&&typeof savedSummary.location==='string'&&typeof savedSummary.at==='number')state.lastSaved=savedSummary;
function showSaved(){
 const box=document.getElementById('resident-last-saved'), saved=state.lastSaved;
 if(!box)return;
 const report=saved?.reportKey?S.store.getReport(saved.reportKey):null,receipt=report?.readReceipt,read=receipt&&receipt.version===(report.version||report.updatedAt)&&saved.reportVersion===(report.version||report.updatedAt);
 box.textContent=saved?'마지막 브라우저 저장'+' · '+new Date(saved.at).toLocaleString('ko-KR')+' · '+saved.location+' · '+(saved.currentPlace||'세부 위치 미입력')+' · '+(saved.occupants==null?'인원 미확인':saved.occupants+'명')+' · 이동 도움 '+(saved.hasVulnerable===true?'필요':saved.hasVulnerable===false?'불필요':'미확인')+' · '+saved.action+' · '+(read?'상황실 열람 '+receipt.actor+' · '+new Date(receipt.at).toLocaleString('ko-KR'):'상황실 열람 미확인')+' — 당시 저장 내용입니다. 실제 119 접수·전송이 아닙니다.':'아직 저장한 상태가 없습니다. 실제 119 접수·전송이 아닙니다.';
}
S.store.subscribe(showSaved);
function captureDetails(){
 if(state.preview)return;
 const place=document.getElementById('current-place'),count=document.getElementById('resident-count'),help=document.getElementById('resident-help');
 if(place&&count&&help)state.details={currentPlace:place.value,occupants:count.value,hasVulnerable:help.value==='yes'?true:help.value==='no'?false:null};
}
function locationText(){return [state.loc.apt,state.loc.dong?state.loc.dong+'동':'',state.loc.ho?state.loc.ho+'호':''].filter(Boolean).join(' ')||'위치 미입력';}
function facility(){const i=S.store.listIncidents().find(i=>!i.closed&&i.buildingId===state.loc.buildingId);return S.store.getUnitFacility(state.loc.buildingId,state.loc.ho,i?.id)||null;}
function phone(extra=''){return '<a href="tel:119" class="button phone-button '+extra+'">'+icon('phone')+'119 전화 걸기<small>긴급할 땐 바로 전화하세요</small></a>';}
function render(){
 window.speechSynthesis?.cancel();
 document.querySelectorAll('[data-phase]').forEach(e=>e.classList.toggle('active',Number(e.dataset.phase)===state.phase));
 if(state.phase===0)start();else if(state.phase===1)question();else result();
 icons(screen);showSaved();
}
function focusHeading(){screen.querySelector('h2')?.focus({preventScroll:true});}
function move(){render();document.getElementById('app-shell').scrollIntoView({block:'start',behavior:'auto'});focusHeading();}
function start(){
 const l=state.loc;
 screen.innerHTML='<section class="screen-content"><div class="section-kicker">01 · 내 위치 확인</div><h2 class="screen-heading" tabindex="-1">지금 어디에 있나요?</h2><p class="screen-sub">아파트를 찾고 동·호수를 입력하세요.</p><div class="location-visual" aria-hidden="true"><div class="visual-copy"><strong>우리 집을 위한 안전 안내</strong>세대별 피난시설과 함께 확인해요.</div><div class="buildings"><span class="map-pin">'+icon('pin')+'</span>'+[0,1,2].map(()=>'<div class="building">'+Array(8).fill('<i></i>').join('')+'</div>').join('')+'</div></div><form id="location-form"><label class="field"><span>아파트 이름</span><div class="field-wrap">'+icon('search')+'<input id="apt" name="apt" placeholder="예: 센텀, 혁신 센텀힐즈" autocomplete="off" maxlength="80" value="'+esc(l.apt)+'" required></div></label><div id="suggestions" class="suggestions" aria-label="아파트 검색 결과"></div><div class="field-row"><label class="field"><span>동</span><input id="dong" name="dong" inputmode="numeric" placeholder="예: 101" maxlength="12" value="'+esc(l.dong)+'" required></label><label class="field"><span>호수</span><input id="ho" name="ho" inputmode="numeric" placeholder="예: 501" maxlength="12" value="'+esc(l.ho)+'" required></label></div><p id="form-error" class="form-error" role="alert" hidden></p><button class="button primary" type="submit">'+icon('pin')+'<span class="button-label">이 위치로 안내 시작</span>'+icon('arrow')+'</button></form>'+phone()+'<button class="text-button" id="skip-location">위치를 모르겠어요</button><p class="micro-note">'+icon('info')+'<span>아파트 시설정보는 마지막 안내에서 확인할 수 있어요.</span></p></section>';
 const apt=document.getElementById('apt'), dong=document.getElementById('dong');
 function updateStartLabel(){const d=dong.value.trim().replace(/동$/,''),h=document.getElementById('ho').value.trim().replace(/호$/,'');document.querySelector('#location-form .button-label').textContent=d&&h?d+'동 '+h+'호로 안내 시작':'동·호수 입력 후 안내 시작';}
 for(const id of ['apt','dong','ho'])document.getElementById(id).addEventListener('input',updateStartLabel);
 updateStartLabel();
 apt.addEventListener('input',()=>{
  const q=apt.value.trim(), box=document.getElementById('suggestions');
  state.loc.complexCode=null;
  const matches=S.ComplexInfo.search(q), demos=[...new Set(Object.values(S.BUILDINGS).map(b=>b.apt))].filter(n=>n.includes(q)&&!matches.some(c=>c.name===n));
  box.innerHTML=q?matches.map(c=>'<button type="button" data-code="'+esc(c.code)+'" data-apt="'+esc(c.name)+'">'+esc(c.name)+'<small>'+esc(c.address)+'</small></button>').join('')+demos.slice(0,3).map(n=>'<button type="button" data-apt="'+esc(n)+'">'+esc(n)+'</button>').join(''):'';
  box.querySelectorAll('button').forEach(b=>b.onclick=()=>{apt.value=b.dataset.apt;state.loc.complexCode=b.dataset.code||null;state.loc.apt=apt.value;updateStartLabel();box.innerHTML='';dong.focus();});
 });
 document.getElementById('location-form').onsubmit=e=>{e.preventDefault();
  const l={complexCode:state.loc.complexCode||null,apt:apt.value.trim(),dong:dong.value.trim().replace(/동$/,''),ho:document.getElementById('ho').value.trim().replace(/호$/,'')};
  if(!l.apt||!l.dong||!l.ho){const err=document.getElementById('form-error');err.textContent='아파트·동·호수를 확인해주세요.';err.hidden=false;return;}
  l.buildingId=Object.values(S.BUILDINGS).find(b=>b.apt===l.apt&&b.dong===l.dong&&(!l.complexCode||b.complexCode===l.complexCode))?.id||null;
  state.loc=l;safeWrite('safehome_resident_design_location',l);begin();
 };
 document.getElementById('skip-location').onclick=()=>{state.loc={apt:'',dong:'',ho:'',buildingId:null};begin();};
}
function begin(){state.phase=1;state.step=0;state.answers={};state.result=null;state.preview=false;move();}
function question(){
 const q=C.questions[state.step];
 screen.innerHTML='<section class="screen-content"><div class="question-tools"><button class="back" id="back">'+icon('arrow')+' 이전</button><span class="location-tag">'+esc(locationText())+'</span></div><div class="steps" aria-label="'+(state.step+1)+'번째 질문">'+C.questions.map((_,i)=>'<span class="'+(i<=state.step?'done':'')+'"></span>').join('')+'</div><div class="question-number">질문 '+(state.step+1)+' / '+C.questions.length+' <span> / '+q.label+'</span></div><div class="question-visual" aria-hidden="true">'+icon(['layers','cloud','door','stairs'][state.step])+'</div><h2 class="question-heading" tabindex="-1">'+esc(q.title)+'</h2><p class="question-hint">'+esc(q.hint)+'</p><div class="options">'+q.options.map(o=>'<button class="option" data-tone="'+(['cloud','flame','lock'].includes(o[2])?'hazard':o[2]==='help'?'unknown':'neutral')+'" data-answer="'+esc(o[0])+'">'+icon(o[2])+'<span>'+esc(o[1])+'</span>'+icon('arrow').replace('<svg ','<svg class="chevron" ')+'</button>').join('')+'</div>'+phone('question-phone')+'<p class="question-note">모르는 항목은 ‘모르겠어요’를 선택하세요.</p></section>';
 document.getElementById('back').onclick=()=>{state.preview=false;if(state.step===0)state.phase=0;else{state.step=state.step===2&&state.answers.q1==='우리집'?0:state.step-1;for(let i=state.step;i<C.questions.length;i++)delete state.answers[C.questions[i].id];}move();};
 screen.querySelectorAll('[data-answer]').forEach(b=>b.onclick=()=>{state.answers[q.id]=b.dataset.answer;state.preview=false;
  if(q.id==='q1'&&b.dataset.answer==='우리집')state.step=2;
  else if(q.id==='q2'&&b.dataset.answer==='없음'&&state.answers.q1!=='모름')return finish();
  else if(q.id==='q3'&&b.dataset.answer!=='가능하다')return finish();
  else if(state.step===C.questions.length-1)return finish();
  else state.step++;
  move();
 });
}
function finish(){
 const a={...state.answers};if(['많음','화염'].includes(a.q2))a.q2='많음또는화염';
 state.result=S.decide(a,facility()?.core||{});state.phase=2;move();
}
const content={
 A:{title:'계단으로 대피',icon:'stairs',sub:'답변한 이동 경로를 기준으로 한 안내입니다.',steps:[['엘리베이터 대신 계단을 이용하세요.','이동 중 연기·화염이 보이면 무리하게 통과하지 마세요.'],['대피하며 출입문을 닫으세요.','주변 사람에게 화재 사실을 알리세요.'],['안전한 곳에서 119에 위치를 알리세요.','방송과 현장대원의 안내를 따르세요.']]},
 B:{title:'세대 내 대기',icon:'home',tone:'wait',sub:'집 안으로 연기가 들어오지 않는다는 응답 기준입니다.',steps:[['현관문과 창문을 닫으세요.','연기가 집 안으로 들어오지 않도록 하세요.'],['화재 상황과 안내방송을 확인하세요.','연기 유입 등 상황이 달라지면 다시 안내를 확인하세요.'],['119에 현재 위치와 상황을 알리세요.','통화 중 안내에 따라 행동하세요.']]},
 C:{title:'대피공간으로 이동',icon:'shield',tone:'wait',sub:'등록된 세대 내 대피공간의 접근 가능 여부를 확인하세요.',steps:[['접근 가능한 대피공간으로 이동하세요.','이동 경로가 위험하면 무리하게 이동하지 마세요.'],['대피공간의 문을 닫으세요.','연기 유입을 막고 상황을 확인하세요.'],['119에 위치를 알리고 구조를 요청하세요.','현재 있는 공간과 함께 있는 인원을 알려주세요.']]},
 D:{title:'하향식 피난구 확인',icon:'down',tone:'danger',sub:'해당 세대에 등록된 피난시설입니다. 설치 정보만으로 현재 이용 가능 여부를 알 수 없습니다.',steps:[['피난구에 안전하게 접근할 수 있는지 확인하세요.','접근이 어렵거나 상태를 모르면 무리하게 사용하지 마세요.'],['아래 세대의 안전과 이용 가능 여부가 필요합니다.','연기·화염이 있거나 이용이 어려우면 이동하지 마세요.'],['119에 위치와 상황을 알리세요.','시설 이용과 구조에 관한 안내를 받으세요.']]},
 E:{title:'경량칸막이 확인',icon:'door',tone:'danger',sub:'해당 세대에 등록된 피난시설입니다. 현재 접근·이용 가능 여부가 필요합니다.',steps:[['등록된 경량칸막이 위치를 확인하세요.','일반 벽과 혼동하지 마세요.'],['이동할 곳의 상태를 모르면 무리하게 이동하지 마세요.','시설 설치 여부와 현재 경로의 안전은 다를 수 있어요.'],['119에 위치와 상황을 알리세요.','시설 이용과 구조에 관한 안내를 받으세요.']]},
 F:{title:'119에 구조 요청',icon:'phone',tone:'danger',sub:'대피 경로나 피난시설의 이용 가능 여부를 확인하지 못했습니다.',steps:[['무리하게 위험한 경로로 이동하지 마세요.','확인하려고 연기·화염이 있는 곳에 접근하지 마세요.'],['화염·연기에서 떨어진 곳에서 문을 닫으세요.','가능하면 문틈으로 들어오는 연기를 막으세요.'],['119에 현재 위치를 알리고 구조를 요청하세요.','동·호수, 연기 상태, 함께 있는 인원을 알려주세요.']]}
};
function residentFacilities(f){
 const c=S.ComplexInfo.resolve(state.loc),values=c?.fire?.fields||[],cards=[];
 const present=v=>typeof v==='string'&&/설치|가능|비치|해당/.test(v)&&!/^미|없|불가/.test(v.trim());
 const card=(title,value,source,ic)=>'<div class="resident-facility">'+icon(ic)+'<div><strong>'+esc(title)+'</strong><small>'+esc(value)+' · '+esc(source)+'</small></div></div>';
 for(const [key,label,index,ic]of [['lightPartition','경량칸막이',0,'door'],['inUnitShelter','대피공간',2,'shield'],['downwardEvacuationHatch','하향식 피난구',8,'down']]){
  const v=f?.core?.[key];if(v===true)cards.push(card(label,'설치','세대 등록',ic));
  else if(v!==false&&present(values[index]))cards.push(card(label,values[index],'단지 등록 · 내 세대 미확인',ic));
 }
 const roof=[];if(present(values[1]))roof.push('옥상 대피 '+values[1]);if(present(values[7]))roof.push('최상층 기계실 있음');if(present(values[3]))roof.push('옥상문 자동개폐');
 if(roof.length)cards.push(card('옥상 피난정보',roof.join(' / '),'단지 등록','up'));
 for(const [index,label,ic]of [[4,'피난안전구역','shield'],[6,'공기안전매트','layers']])if(present(values[index]))cards.push(card(label,values[index],'단지 등록',ic));
 return '<section class="resident-facilities"><h3>등록된 피난·소방시설</h3>'+(cards.length?'<div class="resident-facility-grid">'+cards.join('')+'</div><p>단지 등록은 내 세대 설치·현재 사용 가능을 뜻하지 않습니다.</p>':'<p>등록된 시설정보 없음 · 실제 설치 여부 미확인</p>')+'</section>';
}
function result(){
 const r=content[state.result.key]||content.F,f=facility();
 screen.innerHTML='<section class="screen-content compact-result"><div class="result-head"><h2 tabindex="-1">지금 필요한 행동</h2><button class="text-button" id="restart">위치·답변 수정</button></div>'+(state.preview?'<div class="alert-inline">디자인 확인용 결과 예시입니다. 실제 답변으로 판정한 결과가 아닙니다.</div>':'')+'<div class="result-card '+(r.tone||'')+'"><span class="result-label">현재 권장 행동 · 디자인 데모</span><span class="result-icon">'+icon(r.icon)+'</span><h3>'+r.title+'</h3><p>'+r.sub+'</p></div><div class="reason">'+icon('pin')+'<span>'+esc(locationText())+'<br>'+esc(state.preview?'예시 화면':state.result.notes[0])+'</span></div><section class="immediate-actions" aria-labelledby="immediate-title"><h3 class="action-title" id="immediate-title">지금 바로 할 일</h3><ol class="action-list">'+r.steps.map(x=>'<li><div><strong>'+x[0]+'</strong><small>'+x[1]+'</small></div></li>').join('')+'</ol></section>'+residentFacilities(f)+phone()+'<div class="utility-row"><button class="button secondary" id="update">'+icon('refresh')+'상황이 달라졌어요</button><button class="button secondary" id="voice">'+icon('speaker')+'음성으로 듣기</button></div><details class="facility-details"><summary>현재 위치 · 인원 · 이동 도움 (선택)</summary><label>현재 위치<input id="current-place" maxlength="100" placeholder="예: 안방, 발코니" value="'+esc(state.preview?'':state.details.currentPlace)+'"></label><label>본인을 포함한 현재 인원<input id="resident-count" type="number" min="1" max="999" step="1" placeholder="미확인" value="'+esc(state.preview?'':state.details.occupants)+'"></label><label class="field">혼자 이동하기 어려워 도움이 필요한 사람이 있나요?<select id="resident-help"><option value="unknown">미확인</option><option value="yes">있어요 · 이동 도움 필요</option><option value="no">없어요</option></select></label></details><button class="button secondary" id="save" '+(state.preview?'disabled':'')+'>'+icon('save')+'내 상태 저장 · 데모</button><p class="save-note">브라우저 내부 저장입니다. 실제 119 신고는 접수되지 않습니다.</p></section>';
 document.getElementById('resident-help').value=state.preview?'unknown':state.details.hasVulnerable===true?'yes':state.details.hasVulnerable===false?'no':'unknown';
 for(const id of ['current-place','resident-count','resident-help'])document.getElementById(id).addEventListener('input',captureDetails);
 document.getElementById('restart').onclick=()=>{captureDetails();state.phase=0;state.preview=false;move();};
 document.getElementById('update').onclick=()=>{captureDetails();begin();};
 document.getElementById('voice').onclick=()=>{if(!('speechSynthesis'in window)){toast('이 브라우저는 음성 안내를 지원하지 않습니다.');return;}window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance([r.title,...r.steps.map(s=>s.join(' '))].join('. '));u.lang='ko-KR';u.rate=.9;window.speechSynthesis.speak(u);toast('음성 안내를 시작합니다. 화면 이동 시 중지됩니다.');};
 document.getElementById('save').onclick=()=>{
  if(state.preview)return;
  if(!state.loc.apt||!state.loc.dong||!state.loc.ho){toast('위치가 없어 상태를 저장할 수 없습니다. 위치·답변 수정에서 입력해주세요.');return;}
  captureDetails();
  const count=document.getElementById('resident-count');if(!count.reportValidity())return;
  const details={...state.details,occupants:state.details.occupants===''?null:Number(state.details.occupants)};
  const key=S.store.submitReport({...state.loc,...details,answers:{...state.answers},resultKey:state.result.key,urgency:state.result.urgency,notes:[...state.result.notes,'입주민 디자인 데모 · 세대별 시설자료 '+(f?.verifiedAt||'미확인')]});
  if(key){state.lastSaved={reportKey:key,reportVersion:S.store.getReport(key).version||S.store.getReport(key).updatedAt,at:Date.now(),location:locationText(),...details,action:r.title};safeWrite('safehome_resident_design_last_saved',state.lastSaved);showSaved();}
  toast(key?'이 브라우저에 저장했습니다. 실제 119 신고는 접수되지 않습니다.':S.store.getError()||'저장에 실패했습니다.');
 };
}
const defaults={accent:'#3659c9',navy:'#26354b',radius:16,font:16};
let theme={...defaults};const saved=safeRead('safehome_resident_design_theme');
if(saved){for(const k of ['accent','navy'])if(/^#[0-9a-f]{6}$/i.test(saved[k]))theme[k]=saved[k];for(const [k,min,max]of [['radius',0,36],['font',15,20]])if(Number.isFinite(saved[k]))theme[k]=Math.min(max,Math.max(min,saved[k]));}
function applyTheme(){const root=document.documentElement;root.style.setProperty('--accent',theme.accent);root.style.setProperty('--navy',theme.navy);root.style.setProperty('--radius',theme.radius+'px');root.style.setProperty('--body-size',theme.font+'px');for(const k of Object.keys(defaults))document.getElementById(k+'-control').value=theme[k];document.getElementById('radius-value').value=theme.radius+'px';document.getElementById('font-value').value=theme.font+'px';}
const panel=document.getElementById('design-panel'),toggle=document.getElementById('design-toggle');
function close(){panel.hidden=true;toggle.setAttribute('aria-expanded','false');toggle.focus();}
toggle.onclick=()=>{panel.hidden=!panel.hidden;toggle.setAttribute('aria-expanded',String(!panel.hidden));if(!panel.hidden)document.getElementById('design-close').focus();};
document.getElementById('design-close').onclick=close;
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden)close();});
for(const k of Object.keys(defaults))document.getElementById(k+'-control').oninput=e=>{theme[k]=['radius','font'].includes(k)?Number(e.target.value):e.target.value;applyTheme();safeWrite('safehome_resident_design_theme',theme);};
document.getElementById('design-reset').onclick=()=>{theme={...defaults};applyTheme();safeWrite('safehome_resident_design_theme',theme);toast('기본 디자인으로 복원했습니다.');};
document.querySelectorAll('[data-preview]').forEach(b=>b.onclick=()=>{
 captureDetails();
 const p=b.dataset.preview;state.phase=p==='start'?0:p==='question'?1:2;state.step=0;state.answers={};state.preview=p==='result';
 if(state.preview)state.result={key:'B',notes:['디자인 예시'],urgency:'medium'};
 close();move();
});
icons();applyTheme();render();
})();
