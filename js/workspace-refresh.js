/* Presentation-only navigation. No report, incident, authentication or storage mutations. */
(function(){'use strict';
 const page=location.pathname.split('/').pop()||'index.html';
 const role=new URLSearchParams(location.search).get('role');
 const isResident=page==='resident.html';
 const workPages=['situation.html','field.html','facilities.html','data-review.html'];
 const isAdmin=page==='index.html'&&role==='admin';
 document.body.classList.add('sh-refresh');
 if(isResident){document.body.classList.add('sh-resident');return;}
 if(!workPages.includes(page)&&!isAdmin)return;
 document.body.classList.add('sh-workspace');
 if(isAdmin)document.body.classList.add('sh-admin');
 if(['facilities.html','data-review.html'].includes(page))document.body.classList.add('sh-data');
 const items=[['사건 운영',[['situation.html','상황실','▤'],['field.html','현장 활동','▦']]],['자료 · 관리',[['facilities.html','건물·시설 자료','⌂'],['data-review.html','공공자료 검토','≡'],['index.html?role=admin','사건·링크 관리','↗']]]];
 const aside=document.createElement('aside');aside.className='sh-sidebar';aside.id='sh-workspace-nav';aside.setAttribute('aria-label','업무용 앱 탐색');
 const logo=document.createElement('div');logo.innerHTML='<a class="sh-logo" href="situation.html"><span class="sh-monogram" aria-hidden="true">S</span>SAFEHOME</a><span class="sh-caption">운영 워크스페이스</span>';aside.append(logo);
 const nav=document.createElement('nav');nav.setAttribute('aria-label','업무 메뉴');
 items.forEach(([label,links])=>{const group=document.createElement('div');group.className='sh-group-label';group.textContent=label;nav.append(group);links.forEach(([href,text,mark])=>{const a=document.createElement('a');a.href=href;a.className='sh-link';const symbol=document.createElement('span');symbol.className='sh-nav-mark';symbol.setAttribute('aria-hidden','true');symbol.textContent=mark;a.append(symbol,document.createTextNode(text));if((href===page)||(isAdmin&&href.includes('role=admin')))a.setAttribute('aria-current','page');nav.append(a);});});
 aside.append(nav);const note=document.createElement('div');note.className='sh-side-note';note.textContent='로컬 데모 · 같은 브라우저 공유\n실제 119 접수와 연결되지 않습니다.';note.style.whiteSpace='pre-line';aside.append(note);
 const toggle=document.createElement('button');toggle.type='button';toggle.className='sh-menu-toggle';toggle.setAttribute('aria-controls',aside.id);toggle.setAttribute('aria-expanded','false');toggle.innerHTML='<strong>SAFEHOME</strong><span>업무 메뉴 ☰</span>';
 function close(){document.body.classList.remove('sh-menu-open');toggle.setAttribute('aria-expanded','false');}
 toggle.onclick=()=>{const open=document.body.classList.toggle('sh-menu-open');toggle.setAttribute('aria-expanded',String(open));};
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.classList.contains('sh-menu-open')){close();toggle.focus();}});
 document.body.prepend(aside,toggle);
})();
