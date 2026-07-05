/* SAFE-HOME · admin.js
   관리자 모드: 3개 화면(입주민/119 상황실/소방대원)을 총괄한다.
   사건(화재) 생성·위치 확정/변경, 배포 링크 발급과 유효시간(TTL) 설정, 사건 종료를 관리자가 전담한다.
   119 상황실은 이 화면에서 만든 사건을 보고 대응하는 순수 모니터링/대응 화면으로 남는다. */
(function (SAFEHOME) {
  'use strict';

  var esc = SAFEHOME.escapeHtml;
  var root = null;
  var unsubscribe = null;

  var AUTH_KEY = 'safehome_admin_auth';
  var ADMIN_PASSWORD = '01190119';
  var authed = false;

  var activeAdminId = null;  // 관리자 화면 자체의 사건 탭 포인터 (119/소방대원 화면의 포인터와 독립적으로 유지)
  var formMode = null;       // null | 'new' | 'edit'
  var formBuildingId = '';
  var formHo = '';
  var formAptQuery = '';    // 등록 건물이 많을 때(대량 등록) 검색으로 좁혀서 고르기 위한 아파트명 입력값
  var panelOpenState = {};  // 아코디언 패널별 접기/펼치기 상태 (렌더링 간 유지)

  function mount(container) {
    root = container;
    authed = sessionStorage.getItem(AUTH_KEY) === '1';
    if (unsubscribe) unsubscribe();
    unsubscribe = SAFEHOME.store.subscribe(render);
    if (authed) ensureActiveAdminId();
    render();
  }
  function unmount() {
    if (unsubscribe) { unsubscribe(); unsubscribe = null; }
    root = null;
  }

  function ensureActiveAdminId() {
    var open = SAFEHOME.store.listIncidents().filter(function (i) { return !i.closed; });
    if (!activeAdminId || !open.some(function (i) { return i.id === activeAdminId; })) {
      activeAdminId = open.length ? open[0].id : null;
    }
    if (!activeAdminId && !open.length) formMode = 'new';
  }

  function render() {
    if (!root) return;
    if (!authed) return renderLogin();
    ensureActiveAdminId();
    renderDashboard();
  }

  // ---------------------------------------------------------------- LOGIN
  function renderLogin() {
    root.innerHTML =
      '<div class="start-screen">' +
        '<div class="start-emoji">🛠</div>' +
        '<div class="start-title">관리자 모드</div>' +
        '<div class="start-sub">비밀번호를 입력해주세요.<br>관리자는 화재 발생 위치 지정, 링크 발급·유효시간 설정을 담당합니다.</div>' +
        '<div class="home-box" style="align-items:stretch;">' +
          '<input id="ad-pw" type="password" placeholder="비밀번호" style="width:100%;box-sizing:border-box;border:1.5px solid var(--line);border-radius:10px;padding:12px;font-size:15px;text-align:center;letter-spacing:2px;">' +
        '</div>' +
        '<button class="start-btn" id="ad-login">입장하기</button>' +
      '</div>';
    var doLogin = function () {
      var v = document.getElementById('ad-pw').value;
      if (v === ADMIN_PASSWORD) {
        authed = true;
        try { sessionStorage.setItem(AUTH_KEY, '1'); } catch (e) {}
        ensureActiveAdminId();
        render();
      } else {
        SAFEHOME.toast('비밀번호가 일치하지 않습니다.');
      }
    };
    document.getElementById('ad-login').onclick = doLogin;
    document.getElementById('ad-pw').onkeydown = function (e) { if (e.key === 'Enter') doLogin(); };
  }

  // ------------------------------------------------------------ DASHBOARD
  function renderDashboard() {
    var incidents = SAFEHOME.store.listIncidents().filter(function (i) { return !i.closed; });
    var active = activeAdminId ? SAFEHOME.store.getIncident(activeAdminId) : null;
    var pending = SAFEHOME.store.getPendingReports();

    root.innerHTML =
      '<div class="dash-header">' +
        '<div class="dash-title">🛠 관리자 모드</div>' +
        '<div class="dash-sub">' + (incidents.length ? incidents.length + '건 진행 중' : '진행 중인 사건 없음') + '</div>' +
        '<button class="utility-btn secondary" id="ad-logout" style="margin-top:8px;">🔒 로그아웃</button>' +
      '</div>' +
      (incidents.length ? incidentTabsHtml(incidents, active) : addIncidentBarHtml()) +
      (formMode ? formPanelHtml(pending) : '') +
      (active && !formMode ? incidentManagePanelHtml(active) : '') +
      globalTtlPanelHtml() +
      facilityLinksPanelHtml() +
      buildingImportPanelHtml();

    bindEvents();
  }

  function incidentTabsHtml(incidents, active) {
    var tabs = incidents.map(function (inc) {
      var isActive = active && active.id === inc.id;
      return '<button class="incident-tab' + (isActive ? ' active' : '') + '" data-select-incident="' + inc.id + '">' +
        esc(inc.apt) + ' ' + esc(inc.dong) + '동' +
      '</button>';
    }).join('');
    return '<div class="incident-tabs">' + tabs +
      '<button class="incident-tab add" id="ad-add-incident">+ 새 화재 추가</button>' +
    '</div>';
  }
  function addIncidentBarHtml() {
    return '<div class="incident-tabs">' +
      '<button class="incident-tab add" id="ad-add-incident">+ 새 화재 등록</button>' +
    '</div>';
  }

  // 등록 건물이 대량(수백~수천 개 동)일 때 <select> 하나에 다 나열하면 찾기 힘들어서,
  // 아파트명을 먼저 검색으로 좁힌 뒤 그 아파트의 동만 골라 담은 짧은 select를 보여준다.
  function matchingBuildingIds(query) {
    var nq = SAFEHOME.normalizeAddr(query);
    return Object.keys(SAFEHOME.BUILDINGS).filter(function (id) {
      return !nq || SAFEHOME.normalizeAddr(SAFEHOME.BUILDINGS[id].apt).indexOf(nq) !== -1;
    });
  }
  function buildingSelectOptionsHtml(query, selectedId) {
    if (!query) return '<option value="">먼저 아파트명을 검색하세요</option>';
    var ids = matchingBuildingIds(query);
    if (!ids.length) return '<option value="">일치하는 아파트가 없습니다</option>';
    return '<option value="">동 선택</option>' + ids.map(function (id) {
      var b = SAFEHOME.BUILDINGS[id];
      return '<option value="' + id + '"' + (selectedId === id ? ' selected' : '') + '>' + esc(b.apt) + ' ' + esc(b.dong) + '동 (' + SAFEHOME.buildingUnitSummary(b) + ')</option>';
    }).join('');
  }

  // --------------------------------------------------------- 사건 생성/변경 폼
  function formPanelHtml(pending) {
    var isEdit = formMode === 'edit';
    var title = isEdit ? '🔁 화재 위치 변경 / 재확인' : '🚨 새 화재 등록';
    var note = isEdit
      ? '이 사건의 건물·최초 신고 세대를 다시 확인하거나 정정합니다.'
      : '00아파트 0동 0호에 화재가 발생했다면 여기서 건물과 최초 발화 세대를 지정하세요. 지정 즉시 입주민·119 상황실·소방대원 화면이 함께 갱신됩니다.';
    var aptNames = [];
    Object.keys(SAFEHOME.BUILDINGS).forEach(function (id) {
      var apt = SAFEHOME.BUILDINGS[id].apt;
      if (aptNames.indexOf(apt) === -1) aptNames.push(apt);
    });
    var aptOptionsHtml = '<datalist id="ad-apt-options">' +
      aptNames.map(function (n) { return '<option value="' + esc(n) + '">'; }).join('') +
      '</datalist>';
    var reportPicker = '';
    if (pending.length && formMode === 'new') {
      reportPicker = '<div class="facility-field" style="margin-bottom:10px;"><label>기준 신고 선택 (선택)</label>' +
        '<select id="ad-form-report"><option value="">— 직접 입력 —</option>' +
        pending.map(function (r) {
          return '<option value="' + esc(r.key) + '">' + esc(r.apt || '(위치 미상)') + ' ' + esc(r.dong ? r.dong + '동 ' : '') + esc(r.ho ? r.ho + '호' : '') + (r.auto ? ' · 자동감지' : '') + '</option>';
        }).join('') + '</select></div>';
    }
    return '<div class="panel" style="border-color:#FFD180;background:#FFFBF2;">' +
      '<h3 class="panel-title">' + title + '</h3>' +
      '<div class="empty-note" style="padding:4px 4px 12px;text-align:left;">' + esc(note) + '</div>' +
      '<div style="text-align:left;">' +
        reportPicker +
        '<div class="facility-grid">' +
          '<div class="facility-field"><label>아파트명 검색</label><input id="ad-form-apt-query" list="ad-apt-options" placeholder="🔎 아파트명 검색" value="' + esc(formAptQuery) + '" autocomplete="off" style="width:100%;border:1.5px solid var(--line);border-radius:9px;padding:9px 8px;font-size:13px;background:#FAFAF8;">' + aptOptionsHtml + '</div>' +
          '<div class="facility-field"><label>동 선택</label><select id="ad-form-building">' + buildingSelectOptionsHtml(formAptQuery, formBuildingId) + '</select></div>' +
          '<div class="facility-field"><label>최초 발화 세대(호)</label><input id="ad-form-ho" placeholder="예: 502" value="' + esc(formHo) + '" style="width:100%;border:1.5px solid var(--line);border-radius:9px;padding:9px 8px;font-size:13px;background:#FAFAF8;"></div>' +
        '</div>' +
        '<div class="kapt-actions" style="margin-top:12px;">' +
          '<button class="primary" id="ad-form-confirm">✅ 이 위치로 화재 확정</button>' +
          (isEdit ? '<button class="ghost" id="ad-form-cancel">취소</button>' : '') +
        '</div>' +
      '</div>' +
    '</div>';
  }

  // --------------------------------------------------------- 사건 관리 패널(선택된 사건)
  function incidentManagePanelHtml(inc) {
    var residentLink = location.origin + location.pathname + '?role=resident&apt=' + encodeURIComponent(inc.apt) + '&dong=' + encodeURIComponent(inc.dong);
    var firefighterLink = location.origin + location.pathname + '?role=firefighter&incident=' + encodeURIComponent(inc.id);
    var now = Date.now();
    var residentExpired = now > inc.residentLinkExp;
    var ffExpired = now > inc.firefighterLinkExp;
    return '<div class="panel" style="border-color:#A5D6A7;background:#F4FBF4;">' +
      '<h3 class="panel-title">🏢 화재 위치</h3>' +
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:4px;">' +
        '<div style="font-size:15px;font-weight:900;">' + esc(inc.apt) + ' ' + esc(inc.dong) + '동' + (inc.officialHo ? ' · 최초 신고 ' + esc(inc.officialHo) + '호' : '') + '</div>' +
        '<button class="utility-btn secondary" id="ad-reopen-form">🔁 위치 변경 / 재확인</button>' +
      '</div>' +
      '<div style="font-size:12px;color:var(--gray);margin-bottom:10px;">' + SAFEHOME.fmtTime(inc.confirmedAt) + ' 확정</div>' +
      '<button class="utility-btn secondary" style="width:100%;" id="ad-close-incident">🔚 이 사건 종료</button>' +
      '<div style="margin-top:14px;padding-top:14px;border-top:1px dashed var(--line);text-align:left;">' +
        '<div style="font-size:12px;font-weight:800;color:var(--gray);margin-bottom:6px;">🔗 이 동 입주민에게 배포할 링크 (아파트·동 자동 지정, 호만 입력)</div>' +
        '<input readonly value="' + esc(residentLink) + '" id="ad-resident-link" style="width:100%;border:1.5px solid var(--line);border-radius:9px;padding:9px 8px;font-size:12px;background:#fff;">' +
        '<div style="font-size:11px;margin:6px 0;color:' + (residentExpired ? 'var(--red)' : 'var(--gray)') + ';font-weight:800;">' + (residentExpired ? '⛔ 만료됨' : '⏱ ' + SAFEHOME.fmtTime(inc.residentLinkExp) + ' 까지 유효') + '</div>' +
        '<button class="utility-btn" style="width:100%;" id="ad-copy-link">📋 입주민 링크 복사</button>' +
        '<div style="font-size:12px;font-weight:800;color:var(--gray);margin:12px 0 6px;">🔗 이 사건 전담 소방대원에게 배포할 링크</div>' +
        '<input readonly value="' + esc(firefighterLink) + '" id="ad-firefighter-link" style="width:100%;border:1.5px solid var(--line);border-radius:9px;padding:9px 8px;font-size:12px;background:#fff;">' +
        '<div style="font-size:11px;margin:6px 0;color:' + (ffExpired ? 'var(--red)' : 'var(--gray)') + ';font-weight:800;">' + (ffExpired ? '⛔ 만료됨' : '⏱ ' + SAFEHOME.fmtTime(inc.firefighterLinkExp) + ' 까지 유효') + '</div>' +
        '<button class="utility-btn" style="width:100%;" id="ad-copy-ff-link">📋 소방대원 링크 복사</button>' +
        '<button class="utility-btn secondary" style="width:100%;margin-top:8px;" id="ad-regen-links">⏱ 두 링크 유효시간 연장 (같은 링크 계속 사용)</button>' +
      '</div>' +
    '</div>';
  }

  function globalTtlPanelHtml() {
    return '<div class="panel">' +
      '<h3 class="panel-title">⏱ 배포 링크 기본 유효시간</h3>' +
      '<div style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--gray);">' +
        '<span>기본 유효시간(시간):</span>' +
        '<input id="ad-link-ttl" type="number" min="1" step="1" value="' + SAFEHOME.store.getLinkTtlHours() + '" style="width:56px;border:1.5px solid var(--line);border-radius:8px;padding:4px 6px;font-size:12px;">' +
        '<button id="ad-save-ttl" style="border:none;border-radius:8px;padding:6px 10px;font-size:11px;font-weight:800;background:var(--ink);color:#fff;cursor:pointer;">저장</button>' +
        '<span style="font-size:10.5px;">(새로 발급되는 링크부터 적용)</span>' +
      '</div>' +
    '</div>';
  }

  // 사건(화재)과 무관하게, 등록된 모든 건물에 대해 소방시설 점검용 링크를 발급한다.
  // 아파트 관리사무소/소방시설관리사가 정기 점검 후 이 링크로 접속해 직접 현황을 갱신할 수 있다.
  function facilityLinksPanelHtml() {
    var rows = Object.keys(SAFEHOME.BUILDINGS).map(function (id) {
      var b = SAFEHOME.BUILDINGS[id];
      var link = location.origin + location.pathname + '?role=facility&building=' + encodeURIComponent(id);
      return '<div style="margin-bottom:14px;">' +
        '<div style="font-size:13px;font-weight:800;margin-bottom:6px;">' + esc(b.apt) + ' ' + esc(b.dong) + '동</div>' +
        '<input readonly value="' + esc(link) + '" id="ad-facility-link-' + id + '" style="width:100%;border:1.5px solid var(--line);border-radius:9px;padding:9px 8px;font-size:12px;background:#fff;">' +
        '<button class="utility-btn" style="width:100%;margin-top:6px;" data-copy-facility-link="ad-facility-link-' + id + '">📋 점검 링크 복사</button>' +
      '</div>';
    }).join('');
    var body = '<div class="afp-note" style="margin-bottom:12px;">화재 발생 여부와 무관하게 건물별로 발급되는 링크입니다. 소방시설 점검 시 해당 아파트가 이 링크로 접속해 설치 현황을 직접 갱신할 수 있습니다.</div>' + rows;
    return SAFEHOME.detailsPanel('🧯 소방시설 점검 링크 발급', body, { id: 'facility-links', closed: true, openState: panelOpenState['facility-links'] });
  }

  // 아파트명·동·호(평면도·소방시설현황 제외) 일괄 등록 — 공공데이터 등에서 받은 목록을 붙여넣어 등록한다.
  // 새로 등록된 건물의 소방시설 현황은 전부 "확인 필요" 상태이며, 위 점검 링크로 나중에 채워야 한다.
  function buildingImportPanelHtml() {
    var registeredCount = Object.keys(SAFEHOME.BUILDINGS).filter(function (id) {
      return SAFEHOME.BUILDINGS[id].source === 'import';
    }).length;
    var body =
      '<div class="afp-note" style="margin-bottom:10px;">한 줄에 "아파트명,동,호" 형식으로 붙여넣어주세요(콤마 또는 탭 구분, 엑셀에서 복사해도 됩니다). 같은 아파트명+동은 하나의 동으로 묶여 등록됩니다.<br>예) 대구행복타운,101,101</div>' +
      '<textarea id="ad-import-csv" rows="6" placeholder="대구행복타운,101,101&#10;대구행복타운,101,102&#10;대구행복타운,102,101" style="width:100%;box-sizing:border-box;border:1.5px solid var(--line);border-radius:10px;padding:10px;font-size:12.5px;font-family:inherit;resize:vertical;"></textarea>' +
      '<label style="display:flex;align-items:center;gap:6px;margin-top:8px;font-size:12px;color:var(--gray);"><input type="checkbox" id="ad-import-header">첫 줄은 제목행(헤더)이라 건너뜁니다</label>' +
      '<button class="start-btn" id="ad-import-buildings" style="margin-top:8px;">아파트 정보 가져오기</button>' +
      '<div class="afp-note" style="margin-top:10px;">현재 일괄 등록된 건물: ' + registeredCount + '개 동 · 소방시설 현황은 등록 직후 전부 "확인 필요" 상태이며, 위 "소방시설 점검 링크"로 채워야 합니다.</div>';
    return SAFEHOME.detailsPanel('🏢 아파트 정보 일괄 등록 (CSV)', body, { id: 'building-import', closed: true, openState: panelOpenState['building-import'] });
  }

  function parseBuildingCsv(text, skipHeader) {
    var lines = text.split(/\r?\n/).map(function (l) { return l.trim(); }).filter(function (l) { return l.length; });
    if (skipHeader) lines.shift();
    return lines.map(function (line) {
      var cols = line.split(/\t|,/).map(function (c) { return c.trim().replace(/^"|"$/g, ''); });
      return { apt: cols[0] || '', dong: cols[1] || '', ho: cols[2] || '' };
    }).filter(function (r) { return r.apt && r.dong && r.ho; });
  }

  function bindEvents() {
    SAFEHOME.bindPanelToggles(root, panelOpenState);
    var logoutBtn = document.getElementById('ad-logout');
    if (logoutBtn) logoutBtn.onclick = function () {
      authed = false;
      try { sessionStorage.removeItem(AUTH_KEY); } catch (e) {}
      render();
    };
    root.querySelectorAll('[data-copy-facility-link]').forEach(function (el) {
      el.onclick = function () { copyInputValue(el.getAttribute('data-copy-facility-link'), '점검 링크가 복사되었습니다.'); };
    });
    var importBtn = document.getElementById('ad-import-buildings');
    if (importBtn) importBtn.onclick = function () {
      var text = document.getElementById('ad-import-csv').value;
      var skipHeader = document.getElementById('ad-import-header').checked;
      var rows = parseBuildingCsv(text, skipHeader);
      if (!rows.length) { SAFEHOME.toast('가져올 데이터가 없습니다. "아파트명,동,호" 형식인지 확인해주세요.'); return; }
      var result = SAFEHOME.store.registerBuildings(rows);
      SAFEHOME.toast(result.added + '개 동 신규 등록, ' + result.updated + '개 동 갱신되었습니다. 소방시설 현황은 점검 링크로 채워주세요.');
      render();
    };
    root.querySelectorAll('[data-select-incident]').forEach(function (el) {
      el.onclick = function () {
        activeAdminId = el.getAttribute('data-select-incident');
        formMode = null;
        render();
      };
    });
    var addBtn = document.getElementById('ad-add-incident');
    if (addBtn) addBtn.onclick = function () {
      formBuildingId = ''; formHo = ''; formAptQuery = '';
      formMode = 'new';
      render();
    };
    var cancelBtn = document.getElementById('ad-form-cancel');
    if (cancelBtn) cancelBtn.onclick = function () { formMode = null; render(); };
    var reopenBtn = document.getElementById('ad-reopen-form');
    if (reopenBtn) reopenBtn.onclick = function () {
      var inc = activeAdminId ? SAFEHOME.store.getIncident(activeAdminId) : null;
      formBuildingId = inc ? inc.buildingId || '' : '';
      formHo = inc ? inc.officialHo || '' : '';
      var b = formBuildingId ? SAFEHOME.BUILDINGS[formBuildingId] : null;
      formAptQuery = b ? b.apt : '';
      formMode = 'edit';
      render();
    };
    var reportPicker = document.getElementById('ad-form-report');
    if (reportPicker) reportPicker.onchange = function () {
      var key = reportPicker.value;
      var r = key ? SAFEHOME.store.getReport(key) : null;
      if (r) {
        var b = SAFEHOME.findBuildingByAddress(r.apt, r.dong);
        formBuildingId = b ? b.id : '';
        formHo = r.ho || '';
        formAptQuery = b ? b.apt : (r.apt || '');
      } else {
        formBuildingId = ''; formHo = ''; formAptQuery = '';
      }
      render();
    };
    // 아파트명 검색은 입력할 때마다 전체를 다시 그리면 입력 포커스를 잃으므로,
    // "동 선택" select의 옵션만 직접 갱신한다(포커스 유지, situation.js의 기존 관례와 동일).
    var aptQueryEl = document.getElementById('ad-form-apt-query');
    if (aptQueryEl) aptQueryEl.oninput = function () {
      formAptQuery = aptQueryEl.value;
      formBuildingId = '';
      var sel = document.getElementById('ad-form-building');
      if (sel) sel.innerHTML = buildingSelectOptionsHtml(formAptQuery, formBuildingId);
    };
    var buildingSelectEl = document.getElementById('ad-form-building');
    if (buildingSelectEl) buildingSelectEl.onchange = function () { formBuildingId = buildingSelectEl.value; };
    var hoInputEl = document.getElementById('ad-form-ho');
    if (hoInputEl) hoInputEl.oninput = function () { formHo = hoInputEl.value; };
    var confirmBtn = document.getElementById('ad-form-confirm');
    if (confirmBtn) confirmBtn.onclick = function () {
      var buildingSel = document.getElementById('ad-form-building').value;
      var hoVal = document.getElementById('ad-form-ho').value.trim();
      if (!buildingSel) { SAFEHOME.toast('등록 건물을 선택해주세요.'); return; }
      formMode = null; // store.setIncidentBuilding()이 동기적으로 render()를 호출하므로 먼저 닫아둔다.
      SAFEHOME.store.setIncidentBuilding(buildingSel, hoVal || null);
      var b = SAFEHOME.BUILDINGS[buildingSel];
      var inc = SAFEHOME.store.findOpenIncidentForBuilding(buildingSel);
      activeAdminId = inc ? inc.id : activeAdminId;
      SAFEHOME.toast(b.apt + ' ' + b.dong + '동 화재로 확정되었습니다. 입주민·119 상황실·소방대원 화면에 반영됩니다.');
      render(); // store.commit()이 이미 한 번 그렸지만 activeAdminId를 방금 바꿨으므로 다시 그린다.
    };
    var closeBtn = document.getElementById('ad-close-incident');
    if (closeBtn) closeBtn.onclick = function () {
      if (!activeAdminId) return;
      if (confirm('이 사건을 종료할까요? 세대 현황판에서 제외되고 조치 이력에만 남습니다.')) {
        SAFEHOME.store.setActiveIncident(activeAdminId);
        SAFEHOME.store.closeActiveIncident();
        activeAdminId = null;
        SAFEHOME.toast('사건을 종료했습니다.');
      }
    };
    var copyLinkBtn = document.getElementById('ad-copy-link');
    if (copyLinkBtn) copyLinkBtn.onclick = function () { copyInputValue('ad-resident-link', '입주민 링크가 복사되었습니다.'); };
    var copyFfLinkBtn = document.getElementById('ad-copy-ff-link');
    if (copyFfLinkBtn) copyFfLinkBtn.onclick = function () { copyInputValue('ad-firefighter-link', '소방대원 링크가 복사되었습니다.'); };
    var regenBtn = document.getElementById('ad-regen-links');
    if (regenBtn) regenBtn.onclick = function () {
      if (!activeAdminId) return;
      SAFEHOME.store.regenerateIncidentLinks(activeAdminId);
      SAFEHOME.toast('두 링크의 유효시간이 지금부터 다시 ' + SAFEHOME.store.getLinkTtlHours() + '시간으로 연장되었습니다.');
    };
    var saveTtlBtn = document.getElementById('ad-save-ttl');
    if (saveTtlBtn) saveTtlBtn.onclick = function () {
      var hours = document.getElementById('ad-link-ttl').value;
      SAFEHOME.store.setLinkTtlHours(hours);
      SAFEHOME.toast('기본 유효시간이 ' + SAFEHOME.store.getLinkTtlHours() + '시간으로 저장되었습니다. (기존 발급 링크에는 소급 적용되지 않음)');
    };
  }

  function copyInputValue(inputId, successMsg) {
    var input = document.getElementById(inputId);
    var text = input.value;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { SAFEHOME.toast(successMsg); })
        .catch(function () { input.select(); SAFEHOME.toast('복사 실패 — 직접 선택해 복사해주세요.'); });
    } else {
      input.select();
    }
  }

  SAFEHOME.Admin = { mount: mount, unmount: unmount };

}(window.SAFEHOME = window.SAFEHOME || {}));
