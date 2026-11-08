/* Both operation boards: zoom the complete board without changing unit data. */
(()=>{'use strict';
const board=document.getElementById('board')||document.getElementById('desk-board');if(!board)return;
const field=board.id==='board';let viewport=field?document.getElementById('board-viewport'):null;
if(!viewport){viewport=document.createElement('div');board.before(viewport);viewport.append(board);}
viewport.classList.add('tactical-viewport');board.classList.add('zoom-board');
const bar=document.createElement('div');bar.className='tactical-zoom';bar.setAttribute('aria-label','작전도 크기 조절');
bar.innerHTML='<button data-action="all">전체 보기</button><button data-action="out" aria-label="작전도 축소">−</button><output aria-live="polite">100%</output><button data-action="in" aria-label="작전도 확대">＋</button><button data-action="reset">기본 크기</button><small>전체로 확인 · 확대해서 세대 선택</small>';viewport.before(bar);
if(field)['zoom-in','zoom-out','zoom-value','fit'].forEach(id=>document.getElementById(id).hidden=true);
let scale=1,fitted=false;
function apply(n){scale=Math.max(.06,Math.min(2,n));board.style.zoom=scale;bar.querySelector('output').value=Math.round(scale*100)+'%';bar.querySelector('[data-action=all]').setAttribute('aria-pressed',String(fitted));}
function fit(){board.style.zoom=1;const w=board.scrollWidth,h=board.scrollHeight;apply(Math.min(1,(viewport.clientWidth-28)/Math.max(1,w),(viewport.clientHeight-28)/Math.max(1,h)));viewport.scrollTop=0;viewport.scrollLeft=0;}
bar.onclick=e=>{const action=e.target.closest('button')?.dataset.action;if(!action)return;fitted=action==='all';if(fitted){const select=document.getElementById(field?'floor-span':'desk-floor');if(select&&select.value!=='all'){select.value='all';select.dispatchEvent(new Event('change',{bubbles:true}));}fit();}else apply(action==='reset'?1:scale*(action==='in'?1.25:.8));};
new ResizeObserver(()=>{if(fitted)fit();}).observe(viewport);
new MutationObserver(()=>{if(fitted)fit();}).observe(board,{childList:true,subtree:true});
apply(1);
})();
