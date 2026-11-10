(function(S){'use strict';
const $=id=>document.getElementById(id),esc=S.escapeHtml;let selected='';
const actions={A:'계단 대피',B:'세대 내 대기',C:'대피공간 이동',D:'하향식 피난구 확인',E:'경량칸막이 확인',F:'119 구조 요청',G:'옥상 피난 확인'};
const facilities={inUnitShelter:'대피공간',lightPartition:'경량칸막이',downwardEvacuationHatch:'하향식 피난구'};
const date=t=>t?new Date(t).toLocaleString('ko-KR'):'시각 미기록';
function render(){const query=$('report-search').value.trim().replace(/\s/g,''),filter=$('report-filter').value;
const reports=Object.values(S.store.getState().reports).filter(r=>!r.fieldOnly&&(filter==='all'||!!r.archived===(filter==='archived'))&&[r.apt,r.dong+'동',r.ho+'호'].join('').replace(/\s/g,'').includes(query)).sort((a,b)=>b.updatedAt-a.updatedAt);
if(!reports.some(r=>r.key===selected))selected=reports[0]?.key||'';
$('resident-report-list').innerHTML=reports.map(r=>'<button data-report="'+esc(r.key)+'" aria-pressed="'+(r.key===selected)+'"><strong>'+esc(r.apt+' '+r.dong+'동 '+r.ho+'호')+'</strong><span>'+esc(r.archived?'종결':r.incidentId?'사건 연결':r.linkDecision==='hold'?'연결 보류':'연결 대기')+'</span><small>'+esc(date(r.updatedAt))+'</small></button>').join('')||'<p>저장된 입주민 신고가 없습니다.</p>';
$('resident-report-list').querySelectorAll('button').forEach(b=>b.onclick=()=>{selected=b.dataset.report;render();});
const r=reports.find(r=>r.key===selected);if(!r){$('resident-report-detail').innerHTML='<p>신고를 선택하면 질문별 답변이 표시됩니다.</p>';return;}
const a=r.answers||{},line=(q,v)=>'<div class="answer"><dt>'+esc(q)+'</dt><dd>'+esc(v)+'</dd></div>';
let answers=window.RESIDENT_DESIGN.questions.map(q=>line(q.title.replace(/\n/g,' '),a[q.id]?(q.options.find(o=>o[0]===a[q.id])?.[1]||a[q.id]):'응답 기록 없음 · 질문 생략 가능')).join('');
if(a.q5)answers+=line('층 관계',a.q5);
for(const [k,v] of Object.entries(a.facilityChecks||{}))answers+=line((facilities[k]||k)+' · 설치 및 안전한 접근 여부',({yes:'있고, 안전하게 접근 가능',no:'없거나 갈 수 없음',unknown:'모르겠음'})[v]||v);
$('resident-report-detail').innerHTML='<h2>'+esc(r.apt+' '+r.dong+'동 '+r.ho+'호')+'</h2><p>'+esc(date(r.updatedAt))+' · 입주민 응답</p><div class="reported-action">당시 안내: '+esc(actions[r.resultKey]||'기록 없음')+'</div><dl>'+line('현재 위치',r.currentPlace||'미입력')+line('현재 인원',r.occupants==null?'미입력':r.occupants+'명')+line('이동 도움',r.hasVulnerable===true?'필요':r.hasVulnerable===false?'필요 없음':'미입력')+answers+'</dl><p class="answer-note">접수 당시 답변입니다. 현재 현장 확인 기록과는 구분됩니다.</p>'+(r.archived?'': '<div class="report-links"><a href="situation.html?report='+encodeURIComponent(r.key)+'">상황실에서 보기</a><a href="field.html?report='+encodeURIComponent(r.key)+'">현장활동에서 보기</a></div>');
}
$('report-search').oninput=render;$('report-filter').onchange=render;S.store.subscribe(render);render();
})(window.SAFEHOME);
