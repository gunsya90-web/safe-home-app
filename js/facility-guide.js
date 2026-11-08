(function(S){'use strict';
const general='https://fire.gwd.go.kr/inje119/partici/partici_notice?articleSeq=11091770';
const manual='https://fire.gwd.go.kr/egf/bp/board/article/download?fileSeq=1221438';
const guides={
 '경량칸막이':{warning:'피난용 경량칸막이로 확인된 벽만 이용하세요. 일반 벽을 부수지 마세요.',steps:['발코니의 피난용 칸막이 위치와 접근 경로를 확인하세요.','옆 세대로 이동할 수 있을 때, 칸막이를 발이나 도구로 깨고 통로를 확보하세요.','파편에 주의해 옆 세대로 이동하고 119에 바뀐 위치를 알리세요.'],source:general},
 '대피공간':{warning:'일반 방·욕실과 다릅니다. 지정된 대피공간인지 확인하세요.',steps:['연기·화염을 통과하지 않고 접근 가능한 대피공간으로 이동하세요.','들어간 뒤 방화문을 닫아 연기 유입을 줄이세요.','119에 동·호수와 대피공간 위치를 알리고 구조 안내를 받으세요.'],source:general},
 '하향식 피난구':{warning:'아래쪽에 연기·화염이 있거나 장치 상태를 모르면 무리하게 내려가지 마세요.',steps:['바닥의 피난구와 제품에 표시된 사용 순서를 확인하세요.','덮개를 열고 제품 안내에 따라 사다리를 펼치세요. 아래쪽 이동 가능 여부가 확인돼야 합니다.','사다리를 이용해 한 명씩 이동하고 119에 이동한 위치를 알리세요.'],source:general},
 '옥상 피난정보':{warning:'옥상 등록정보만 보고 올라가지 마세요. 최상층 기계실은 대피장소가 아닙니다.',steps:['건물 피난안내도와 방송·현장대원 안내에서 이동 목적지를 확인하세요.','계단의 연기·화염, 옥상 출입문과 경로가 확인되지 않으면 무리하게 이동하지 마세요.','구조가 필요하면 119에 현재 층과 위치를 알리세요.'],source:manual},
 '피난안전구역':{warning:'지정된 피난안전구역과 접근 경로를 확인해야 합니다.',steps:['피난안내도·유도표지 또는 현장 안내에서 지정된 구역을 확인하세요.','연기·화염이 있는 경로를 통과하지 말고 방송과 대원의 안내를 따르세요.','도착한 층·구역과 인원을 119에 알리고 다음 안내를 받으세요.'],source:manual},
 '공기안전매트':{warning:'매트가 보이더라도 임의로 뛰어내리지 마세요.',steps:['119에 현재 위치를 알리고 구조를 요청하세요.','설치·고정·사용 가능 여부는 현장대원이 판단합니다.','현장대원의 직접 지시와 신호에만 따르세요.'],source:'https://www.daegu.go.kr/cmsh/daegu.go.kr/119/files/재난현장표준작전절차.pdf'}
};
let dialog,opener;
function open(title,context){const g=guides[title];if(!g)return;if(!dialog){dialog=document.createElement('dialog');dialog.className='facility-guide-dialog';dialog.setAttribute('aria-labelledby','facility-guide-title');document.body.append(dialog);dialog.addEventListener('close',()=>opener?.focus());}opener=document.activeElement;
 const e=S.escapeHtml;dialog.innerHTML='<header><h2 id="facility-guide-title">'+e(title)+' 사용 안내</h2><button type="button" class="guide-close" autofocus aria-label="사용 안내 닫기">닫기 ✕</button></header><p class="guide-context">'+e(context||'설치·이용 가능 여부는 별도 확인')+'</p><p class="guide-warning">'+e(g.warning)+'</p><ol>'+g.steps.map(x=>'<li>'+e(x)+'</li>').join('')+'</ol><p class="guide-context">단지 등록은 내 세대 설치를 보장하지 않습니다. 현장 상황과 제품 안내를 우선 확인하세요.</p><a class="guide-phone" href="tel:119">119 전화 걸기</a><a class="guide-source" href="'+e(g.source)+'" target="_blank" rel="noopener">공식 참고자료 ↗</a>';
 dialog.querySelector('.guide-close').onclick=()=>dialog.close();dialog.showModal();}
S.FacilityGuide={open,guides};
})(window.SAFEHOME);
