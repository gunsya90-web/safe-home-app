/* SAFE-HOME · situation.js
   119 종합상황실 화면: 신고 큐, 사건 위치 확정(다중 사건 지원), 세대 상세(체크리스트),
   실시간 세대 현황, 출동 지령.

   신고는 입주민이 말한 위치일 뿐이다. 상황실이 등록된 건물 디렉터리에서 해당 동을 찾아
   "사건 위치로 확정"해야 비로소 세대 현황판/AFP 정보가 채워지고 소방대원 화면에 노출된다.
   여러 동에서 동시에 화재가 발생하면 사건을 각각 확정해두고 상단 탭으로 전환하며 관리한다. */
(function (SAFEHOME) {
  'use strict';

  var esc = SAFEHOME.escapeHtml;
  var root = null;
  var selectedHo = null;
  var unsubscribe = null;

  // 사건 확정 폼의 로컬 UI 상태
  var confirmMode = null; // null | 'new' | 'edit'
  var confirmBuildingId = '';
  var confirmHo = '';
  var afpChecklistOpen = false; // 체크리스트의 "피난시설 존재 여부" 펼침 상태
  var afpOverrideOpen = false; // 세대별 AFP 예외 입력 폼 펼침 상태
  var noteDraft = null; // 상황실 메모 입력창 초안 (null이면 저장된 값을 그대로 표시)
  var panelOpenState = {}; // 아코디언 패널별 접기/펼치기 상태 (렌더링 간 유지)

  var URGENCY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
  var URGENCY_LABEL = { critical: '🔴 긴급', high: '🟠 위험', medium: '🟡 주의', low: '🟢 안전' };
  var knownCriticalKeys = null; // 새 긴급 신고 알림용 — 이미 알림을 준 신고 key 집합

  function mount(container) {
    root = container;
    if (unsubscribe) unsubscribe();
    unsubscribe = SAFEHOME.store.subscribe(render);
    ensureActiveIncident();
    selectedHo = pickDefaultSelection();
    confirmMode = SAFEHOME.store.listIncidents().filter(function (i) { return !i.closed; }).length ? null : 'new';
    panelOpenState = {};
    knownCriticalKeys = currentCriticalKeys(); // 처음 들어왔을 때 이미 있던 긴급 건은 알림 대상에서 제외
    render();
  }
  function unmount() {
    if (unsubscribe) { unsubscribe(); unsubscribe = null; }
    root = null;
  }

  // 활성 사건이 없거나 이미 종료된 사건을 가리키고 있으면, 열려 있는 사건 중 가장 최근 것으로 자동 전환한다.
  function ensureActiveIncident() {
    var active = SAFEHOME.store.getActiveIncident();
    if (active && !active.closed) return;
    var open = SAFEHOME.store.listIncidents().filter(function (i) { return !i.closed; });
    if (open.length) SAFEHOME.store.setActiveIncident(open[0].id);
  }

  function currentCriticalKeys() {
    var keys = SAFEHOME.store.getPendingReports()
      .filter(function (r) { return r.urgency === 'critical'; })
      .map(function (r) { return 'r:' + r.key; });
    SAFEHOME.store.listIncidents().forEach(function (inc) {
      SAFEHOME.store.getUnits(inc.id)
        .filter(function (u) { return u.urgency === 'critical' && u.status !== 'safe'; })
        .forEach(function (u) { keys.push('u:' + inc.id + ':' + u.ho); });
    });
    return keys;
  }

  function checkNewCriticalAlert() {
    if (!knownCriticalKeys) return;
    var nowKeys = currentCriticalKeys();
    var isNew = nowKeys.some(function (k) { return knownCriticalKeys.indexOf(k) === -1; });
    knownCriticalKeys = nowKeys;
    if (isNew) {
      playAlertBeep();
      var header = root && root.querySelector('.dash-header');
      if (header) {
        header.classList.add('alert-flash');
        setTimeout(function () { header.classList.remove('alert-flash'); }, 2400);
      }
    }
  }

  function playAlertBeep() {
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      var ctx = new Ctx();
      [0, 220].forEach(function (delay) {
        setTimeout(function () {
          var o = ctx.createOscillator(), g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.frequency.value = 880;
          g.gain.setValueAtTime(0.001, ctx.currentTime);
          g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
          g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
          o.start(); o.stop(ctx.currentTime + 0.2);
        }, delay);
      });
    } catch (e) { /* 오디오 재생 불가 환경은 조용히 무시 */ }
  }

  function reportedUnits(incidentId) {
    return SAFEHOME.store.getUnits(incidentId)
      .filter(function (u) { return u.status !== 'unresponded'; })
      .sort(byUrgencyThenTime);
  }
  function byUrgencyThenTime(a, b) {
    var ua = URGENCY_ORDER[a.urgency] !== undefined ? URGENCY_ORDER[a.urgency] : 9;
    var ub = URGENCY_ORDER[b.urgency] !== undefined ? URGENCY_ORDER[b.urgency] : 9;
    if (ua !== ub) return ua - ub;
    return (b.updatedAt || 0) - (a.updatedAt || 0);
  }
  function pickDefaultSelection() {
    var active = SAFEHOME.store.getActiveIncident();
    if (!active) return null;
    var list = reportedUnits(active.id);
    return list.length ? list[0].ho : null;
  }

  function countStatuses(units) {
    var c = { unresponded: 0, waiting: 0, moving: 0, danger: 0, safe: 0 };
    units.forEach(function (u) { c[u.status] = (c[u.status] || 0) + 1; });
    return c;
  }

  function render() {
    if (!root) return;
    ensureActiveIncident();
    var incidents = SAFEHOME.store.listIncidents().filter(function (i) { return !i.closed; });
    var active = SAFEHOME.store.getActiveIncident();
    var pending = SAFEHOME.store.getPendingReports();
    var corrections = SAFEHOME.store.getCorrectionRequests().filter(function (r) { return !r.resolved; });

    var units = active ? SAFEHOME.store.getUnits(active.id) : [];
    var reported = active ? reportedUnits(active.id) : [];
    if (selectedHo && !units.some(function (u) { return u.ho === selectedHo; })) selectedHo = null;
    if (!selectedHo && reported.length) selectedHo = reported[0].ho;
    var counts = countStatuses(units);

    root.innerHTML =
      '<div class="dash-header">' +
        '<div class="dash-title">📞 119 종합상황실</div>' +
        '<div class="dash-sub">' + (incidents.length ? incidents.length + '건 진행 중' : '사건 위치 미확정 · 신고 접수 대기') + '</div>' +
      '</div>' +
      (incidents.length ? incidentTabsHtml(incidents, active) : '') +
      (confirmMode ? confirmPanelHtml(pending) : '') +
      // 확정된 사건 주소와 일치하지 않는 신고(다른 동/오신고 등)는 상태와 무관하게 항상 눈에 띄게 표시한다.
      (pending.length ? pendingPanelHtml(pending, incidents.length > 0) : '') +
      (corrections.length ? correctionRequestsHtml(corrections) : '') +
      (active && !confirmMode ? (
        activeIncidentHeaderHtml(active) +
        statBarHtml(counts) +
        casualtySummaryHtml(active.casualties) +
        '<div class="dash-grid-2">' +
          facilityPanelHtml(SAFEHOME.BUILDINGS[active.buildingId], active.afp) +
          specialStructureHtml(SAFEHOME.BUILDINGS[active.buildingId]) +
        '</div>' +
        '<div class="dash-grid-2">' +
          '<div class="panel">' +
            '<h3 class="panel-title">🚨 신고 큐 <span class="badge">' + reported.length + '</span></h3>' +
            queueHtml(reported) +
          '</div>' +
          '<div class="panel">' + detailHtml(selectedHo, active) + '</div>' +
        '</div>' +
        noteFormHtml(active) +
        SAFEHOME.detailsPanel('🗺️ 실시간 세대 현황 (Live Occupancy Status)',
          SAFEHOME.renderOccupancyGrid(units, { selected: selectedHo }) + SAFEHOME.renderStatusLegend(),
          { id: 'grid', openState: panelOpenState.grid })
      ) : '') +
      actionLogHtml(SAFEHOME.store.getActionLog());

    bindEvents(pending);
    checkNewCriticalAlert();
  }

  // --------------------------------------------------------- 사건 탭 (다중 사건 전환)
  function incidentTabsHtml(incidents, active) {
    var tabs = incidents.map(function (inc) {
      var urgentCount = SAFEHOME.store.getUnits(inc.id).filter(function (u) { return u.status === 'danger'; }).length;
      var isActive = active && active.id === inc.id;
      return '<button class="incident-tab' + (isActive ? ' active' : '') + '" data-select-incident="' + inc.id + '">' +
        esc(inc.apt) + ' ' + esc(inc.dong) + '동' + (urgentCount ? ' <span class="badge">' + urgentCount + '</span>' : '') +
      '</button>';
    }).join('');
    return '<div class="incident-tabs">' + tabs +
      '<button class="incident-tab add" id="sh-add-incident">+ 새 사건</button>' +
    '</div>';
  }

  function activeIncidentHeaderHtml(inc) {
    var residentLink = location.origin + location.pathname + '?role=resident&apt=' + encodeURIComponent(inc.apt) + '&dong=' + encodeURIComponent(inc.dong) + '&exp=' + inc.residentLinkExp;
    var firefighterLink = location.origin + location.pathname + '?role=firefighter&incident=' + encodeURIComponent(inc.id) + '&exp=' + inc.firefighterLinkExp;
    var now = Date.now();
    var residentExpired = now > inc.residentLinkExp;
    var ffExpired = now > inc.firefighterLinkExp;
    return '<div class="panel" style="border-color:#A5D6A7;background:#F4FBF4;">' +
      '<h3 class="panel-title">🏢 확정된 사건 위치</h3>' +
      '<div style="font-size:15px;font-weight:900;margin-bottom:4px;">' + esc(inc.apt) + ' ' + esc(inc.dong) + '동' + (inc.officialHo ? ' · 최초 신고 ' + esc(inc.officialHo) + '호' : '') + '</div>' +
      '<div style="font-size:12px;color:var(--gray);margin-bottom:10px;">' + SAFEHOME.fmtTime(inc.confirmedAt) + ' 확정</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
        '<button class="utility-btn secondary" id="sh-reopen-confirm">🔁 위치 변경 / 재확인</button>' +
        '<button class="utility-btn secondary" id="sh-close-incident">🔚 이 사건 종료</button>' +
      '</div>' +
      '<div style="margin-top:14px;padding-top:14px;border-top:1px dashed var(--line);text-align:left;">' +
        '<div style="font-size:12px;font-weight:800;color:var(--gray);margin-bottom:6px;">🔗 이 동 입주민에게 배포할 링크 (아파트·동 자동 지정, 호만 입력)</div>' +
        '<input readonly value="' + esc(residentLink) + '" id="sh-resident-link" style="width:100%;border:1.5px solid var(--line);border-radius:9px;padding:9px 8px;font-size:12px;background:#fff;">' +
        '<div style="font-size:11px;margin:6px 0;color:' + (residentExpired ? 'var(--red)' : 'var(--gray)') + ';font-weight:800;">' + (residentExpired ? '⛔ 만료됨' : '⏱ ' + SAFEHOME.fmtTime(inc.residentLinkExp) + ' 까지 유효') + '</div>' +
        '<button class="utility-btn" style="width:100%;" id="sh-copy-link">📋 입주민 링크 복사</button>' +
        '<div style="font-size:12px;font-weight:800;color:var(--gray);margin:12px 0 6px;">🔗 이 사건 전담 소방대원에게 배포할 링크</div>' +
        '<input readonly value="' + esc(firefighterLink) + '" id="sh-firefighter-link" style="width:100%;border:1.5px solid var(--line);border-radius:9px;padding:9px 8px;font-size:12px;background:#fff;">' +
        '<div style="font-size:11px;margin:6px 0;color:' + (ffExpired ? 'var(--red)' : 'var(--gray)') + ';font-weight:800;">' + (ffExpired ? '⛔ 만료됨' : '⏱ ' + SAFEHOME.fmtTime(inc.firefighterLinkExp) + ' 까지 유효') + '</div>' +
        '<button class="utility-btn" style="width:100%;" id="sh-copy-ff-link">📋 소방대원 링크 복사</button>' +
        '<button class="utility-btn secondary" style="width:100%;margin-top:8px;" id="sh-regen-links">🔄 두 링크 모두 재발급 (유효시간 연장)</button>' +
        '<div style="display:flex;align-items:center;gap:8px;margin-top:12px;font-size:11.5px;color:var(--gray);">' +
          '<span>기본 유효시간(시간):</span>' +
          '<input id="sh-link-ttl" type="number" min="1" step="1" value="' + SAFEHOME.store.getLinkTtlHours() + '" style="width:56px;border:1.5px solid var(--line);border-radius:8px;padding:4px 6px;font-size:12px;">' +
          '<button id="sh-save-ttl" style="border:none;border-radius:8px;padding:6px 10px;font-size:11px;font-weight:800;background:var(--ink);color:#fff;cursor:pointer;">저장</button>' +
          '<span style="font-size:10.5px;">(새로 발급되는 링크부터 적용)</span>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  // --------------------------------------------------------- 사건 위치 확정 폼
  function confirmPanelHtml(pending) {
    var title = confirmMode === 'edit' ? '🔁 사건 위치 변경 / 재확인' : '⚠️ 사건 위치 확정 필요';
    var note = confirmMode === 'edit'
      ? '현재 사건의 건물·최초 신고 세대를 다시 확인하거나 정정합니다.'
      : '신고자가 말한 위치는 참고 정보입니다. 등록된 건물 디렉터리에서 해당 동을 찾아 사건 위치로 확정해야 세대 현황판과 소방대원 화면이 활성화됩니다.';
    return '<div class="panel" style="border-color:#FFD180;background:#FFFBF2;">' +
      '<h3 class="panel-title">' + title + '</h3>' +
      '<div class="empty-note" style="padding:4px 4px 12px;text-align:left;">' + esc(note) + '</div>' +
      confirmFormHtml(pending) +
    '</div>';
  }

  function confirmFormHtml(pending) {
    var buildingOptions = Object.keys(SAFEHOME.BUILDINGS).map(function (id) {
      var b = SAFEHOME.BUILDINGS[id];
      return '<option value="' + id + '"' + (confirmBuildingId === id ? ' selected' : '') + '>' + esc(b.apt) + ' ' + esc(b.dong) + '동 (' + b.floors + '층 · ' + b.unitsPerFloor + '세대/층)</option>';
    }).join('');

    var reportPicker = '';
    if (pending.length && confirmMode === 'new') {
      reportPicker = '<div class="facility-field" style="margin-bottom:10px;"><label>기준 신고 선택 (선택)</label>' +
        '<select id="sh-confirm-report"><option value="">— 직접 입력 —</option>' +
        pending.map(function (r) {
          return '<option value="' + esc(r.key) + '">' + esc(r.apt || '(위치 미상)') + ' ' + esc(r.dong ? r.dong + '동 ' : '') + esc(r.ho ? r.ho + '호' : '') + (r.auto ? ' · 자동감지' : '') + '</option>';
        }).join('') + '</select></div>';
    }

    return '<div style="text-align:left;">' +
      reportPicker +
      '<div class="facility-grid">' +
        '<div class="facility-field"><label>등록 건물</label><select id="sh-confirm-building"><option value="">건물 선택</option>' + buildingOptions + '</select></div>' +
        '<div class="facility-field"><label>최초 발화 세대(호)</label><input id="sh-confirm-ho" placeholder="예: 502" value="' + esc(confirmHo) + '" style="width:100%;border:1.5px solid var(--line);border-radius:9px;padding:9px 8px;font-size:13px;background:#FAFAF8;"></div>' +
      '</div>' +
      '<div class="kapt-actions" style="margin-top:12px;">' +
        '<button class="primary" id="sh-confirm-btn">✅ 이 위치로 사건 확정</button>' +
        (confirmMode === 'edit' ? '<button class="ghost" id="sh-cancel-confirm">취소</button>' : '') +
      '</div>' +
    '</div>';
  }

  function pendingPanelHtml(pending, hasIncidents) {
    var title = hasIncidents ? '🕒 다른 위치 신고 (확인 필요)' : '🕒 미확정 신고';
    return '<div class="panel" style="border-color:#FFD180;">' +
      '<h3 class="panel-title">' + title + ' <span class="badge">' + pending.length + '</span></h3>' +
      '<div class="queue-list">' + pending.map(function (r) {
        return '<div class="queue-item" style="cursor:default;">' +
          '<span class="queue-urgency">' + (URGENCY_LABEL[r.urgency] || '') + '</span>' +
          '<span class="queue-ho">' + esc(r.apt || '위치 미상') + ' ' + esc(r.dong ? r.dong + '동' : '') + ' ' + esc(r.ho ? r.ho + '호' : '') + '</span>' +
          '<span class="queue-status">' + (r.auto ? '자동감지 신호' : '입주민 신고') + '</span>' +
          '<span class="queue-result">' + (r.notes && r.notes[0] ? esc(r.notes[0]) : '') + '</span>' +
          '<span class="queue-time">' + SAFEHOME.fmtTime(r.updatedAt) + '</span>' +
        '</div>';
      }).join('') + '</div>' +
    '</div>';
  }

  function correctionRequestsHtml(list) {
    return '<div class="panel" style="border-color:#90CAF9;">' +
      '<h3 class="panel-title">🛠 시설정보 수정 요청 <span class="badge">' + list.length + '</span></h3>' +
      '<div class="queue-list">' + list.map(function (r) {
        return '<div class="queue-item" style="cursor:default;grid-template-columns:1fr auto;">' +
          '<span class="queue-ho">' + esc(r.apt || '') + ' ' + esc(r.dong ? r.dong + '동 ' : '') + esc(r.ho ? r.ho + '호' : '') + ' — ' + esc(r.text) + '</span>' +
          '<button data-resolve-correction="' + esc(r.id) + '" style="border:none;border-radius:8px;padding:6px 10px;font-size:11px;font-weight:800;background:var(--ink);color:#fff;cursor:pointer;">처리완료</button>' +
        '</div>';
      }).join('') + '</div>' +
    '</div>';
  }

  function actionLogHtml(log) {
    if (!log.length) return '';
    var body = '<div class="log-list">' + log.slice(0, 20).map(function (l) {
      return '<div class="log-row"><span class="log-time">' + SAFEHOME.fmtTime(l.at) + '</span><span class="log-actor">' + esc(l.actor) + '</span><span class="log-action">' + esc(l.action) + '</span></div>';
    }).join('') + '</div>';
    return SAFEHOME.detailsPanel('🧾 조치 이력', body, { id: 'log', closed: true, openState: panelOpenState.log });
  }

  // 건물 소방시설현황(피난시설 + 소화시설) — 신고가 들어왔을 때 상황실이 바로 참고해 안내할 수 있도록 상시 노출한다.
  function facilityPanelHtml(building, afp) {
    var body = '<div style="font-size:11.5px;font-weight:800;color:var(--gray);margin-bottom:6px;">피난시설 (AFP-Core)</div>' +
      SAFEHOME.renderAfpGrid(afp) +
      '<div style="font-size:11.5px;font-weight:800;color:var(--gray);margin:12px 0 6px;">소화시설</div>' +
      SAFEHOME.renderAfpGrid(building.suppression, SAFEHOME.AFP_SUPPRESSION_FIELDS) +
      '<div class="afp-note">※ 신고자에게 안내할 대체 대피시설과, 현장 초기 진압에 쓸 수 있는 소화설비를 함께 확인할 수 있습니다.</div>';
    return SAFEHOME.detailsPanel('🧯 소방시설현황', body, { id: 'facility', openState: panelOpenState.facility });
  }

  // 특화구조 정보 — 복층/다락 세대, 옥상 대피(최상층 여부), 복도 형태 등 상황 판단에 필요한 건물 구조 요약.
  function specialStructureHtml(building) {
    var s = building.search;
    var roofOnTopFloor = building.core.roofEvacuation ? '최상층(' + building.floors + '층)에서 옥상으로 진입' : '옥상 대피 불가 등록 건물';
    var body =
      '<div class="check-row"><span class="check-mark">🏠</span><span class="check-label">복층·다락 세대</span><span class="check-value">' + (s.duplexUnits.length ? s.duplexUnits.join(', ') + '호' : '없음') + '</span></div>' +
      '<div class="check-row"><span class="check-mark">🏢</span><span class="check-label">옥상 대피 · 최상층</span><span class="check-value">' + esc(roofOnTopFloor) + '</span></div>' +
      '<div class="check-row"><span class="check-mark">🧱</span><span class="check-label">복도 형태</span><span class="check-value">' + esc(building.hallwayType) + ' · 총 ' + building.floors + '층 · 세대당 ' + building.unitsPerFloor + '호</span></div>' +
      '<div class="afp-note" style="margin-top:8px;">' + esc(s.duplexNote) + '</div>';
    return SAFEHOME.detailsPanel('🏗️ 건물 특화 구조 정보', body, { id: 'structure', openState: panelOpenState.structure });
  }

  // 119 상황실이 남기는 메모 — 소방대원 화면(dash-header 아래)에 그대로 노출된다.
  function noteFormHtml(inc) {
    var value = noteDraft !== null ? noteDraft : inc.dispatchNote;
    var body = '<textarea id="sh-note-input" rows="2" placeholder="예: 903호 거동 불편 노약자 1인, 우선 구조 요망" ' +
        'style="width:100%;border:1.5px solid var(--line);border-radius:10px;padding:10px;font-size:13px;font-family:inherit;resize:vertical;">' + esc(value) + '</textarea>' +
      '<button class="utility-btn" style="width:100%;margin-top:8px;" id="sh-note-save">전달하기</button>';
    return SAFEHOME.detailsPanel('📝 소방대원에게 메모 전달', body, { id: 'note', closed: true, openState: panelOpenState.note });
  }

  var CASUALTY_LABELS = [
    { key: 'dead', label: '사망', icon: '⚫' },
    { key: 'severe', label: '중상', icon: '🔴' },
    { key: 'minor', label: '경상', icon: '🟡' },
    { key: 'guided', label: '피난유도', icon: '🚶' },
    { key: 'selfEvacuated', label: '자력대피', icon: '🏃' }
  ];

  // 현장 소방대원이 입력하는 값을 읽기 전용으로 보여준다 (입력은 소방대원 화면에서만 한다).
  function casualtySummaryHtml(c) {
    c = c || {};
    var body = '<div class="stat-bar">' + CASUALTY_LABELS.map(function (it) {
      return stat(it.icon, c[it.key] || 0, it.label);
    }).join('') + '</div>';
    return SAFEHOME.detailsPanel('🚑 환자 · 대피 현황 <span style="font-size:11px;color:var(--gray);font-weight:700;">(소방대원 입력)</span>', body, { id: 'casualty', openState: panelOpenState.casualty });
  }

  function statBarHtml(c) {
    return '<div class="stat-bar">' +
      stat('🔴', c.danger, '위험/구조필요') +
      stat('🟠', c.moving, '이동 중') +
      stat('🔵', c.waiting, '실내 대기') +
      stat('🟢', c.safe, '대피 완료') +
      stat('⚪', c.unresponded, '미응답') +
      '</div>';
  }
  function stat(emoji, n, label) {
    return '<div class="stat-item"><div class="stat-num">' + emoji + ' ' + n + '</div><div class="stat-label">' + label + '</div></div>';
  }

  function queueHtml(list) {
    if (!list.length) {
      return '<div class="empty-note">확정된 건물에서 아직 접수된 세대 신고가 없습니다.</div>';
    }
    return '<div class="queue-list">' + list.map(function (u) {
      var meta = SAFEHOME.STATUS_META[u.status];
      var res = SAFEHOME.RESULTS[u.resultKey];
      var urgencyBadge = u.status === 'safe' ? '🟢 완료' : (URGENCY_LABEL[u.urgency] || '');
      return '<button class="queue-item' + (selectedHo === u.ho ? ' selected' : '') + '" data-select-ho="' + u.ho + '">' +
        '<span class="queue-urgency">' + urgencyBadge + '</span>' +
        '<span class="queue-ho">' + u.ho + '호</span>' +
        '<span class="queue-status" style="color:' + meta.color + '">' + meta.label + '</span>' +
        '<span class="queue-result">' + (res ? res.icon + ' ' + res.title : '') + '</span>' +
        '<span class="queue-time">' + SAFEHOME.fmtTime(u.updatedAt) + '</span>' +
        '</button>';
    }).join('') + '</div>';
  }

  function checklistRow(label, done, value) {
    return '<div class="check-row ' + (done ? 'done' : '') + '"><span class="check-mark">' + (done ? '✅' : '⬜') + '</span>' +
      '<span class="check-label">' + esc(label) + '</span><span class="check-value">' + esc(value) + '</span></div>';
  }

  function detailHtml(ho, incident) {
    if (!ho) {
      return '<h3 class="panel-title">🧾 상황관리 체크리스트</h3><div class="empty-note">왼쪽 신고 큐 또는 아래 현황판에서 세대를 선택하세요.</div>';
    }
    var unit = incident.units[ho];
    var afp = SAFEHOME.store.getEffectiveAfp(unit, incident.afp);
    var hasOverride = unit.afpOverride && Object.keys(unit.afpOverride).length > 0;
    var res = SAFEHOME.RESULTS[unit.resultKey];
    var a = unit.answers || {};

    var afpCount = SAFEHOME.AFP_CORE_FIELDS.filter(function (f) { return afp[f.key] === true; }).length;
    var checklist =
      checklistRow('신고자 위치 확인', true, ho + '호') +
      checklistRow('연기·화염 유입 여부', !!a.q2, a.q2 || '미확인') +
      checklistRow('현관 대피 가능 여부', !!a.q3, a.q3 || '미확인') +
      checklistRow('복도·계단 안전 여부', !!a.q4, a.q4 || '미확인') +
      '<button class="check-row check-row-clickable done" id="sh-toggle-afp-checklist" style="width:100%;border:none;background:none;text-align:left;cursor:pointer;">' +
        '<span class="check-mark">✅</span><span class="check-label">피난시설 존재 여부(AFP)' + (hasOverride ? ' · 이 세대 예외 적용 중' : '') + ' — 클릭해서 상세보기</span>' +
        '<span class="check-value">' + afpCount + '종 설치 ' + (afpChecklistOpen ? '▲' : '▼') + '</span>' +
      '</button>' +
      (afpChecklistOpen ? SAFEHOME.renderAfpGrid(afp) + afpOverrideToggleHtml(hasOverride) + (afpOverrideOpen ? afpOverrideFormHtml(unit) : '') : '');

    var notes = (unit.notes || []).map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('');
    var vulnerable = unit.hasVulnerable ? '<div class="tag-warn">⚠️ 거동 불편자 있음 (' + unit.occupants + '인 세대)</div>' : '<div class="tag-info">' + unit.occupants + '인 세대</div>';

    var dispatchState = incident.dispatch.dispatched
      ? '<div class="tag-ok">🚒 출동 지령 완료 (' + SAFEHOME.fmtTime(incident.dispatch.dispatchedAt) + ')</div>'
      : '<button class="utility-btn" id="sh-dispatch-btn">🚒 출동 지령 내리기</button>';

    return '<h3 class="panel-title">🧾 ' + ho + '호 · 상황관리 체크리스트</h3>' +
      vulnerable +
      checklist +
      (res ? '<div class="action-card ' + res.cls + '" style="margin-top:12px;"><h3>' + res.icon + ' 판정 결과: ' + esc(res.title) + '</h3><ul>' + notes + '</ul></div>' : '<div class="empty-note">아직 대피 판정 전입니다.</div>') +
      '<div style="margin-top:12px;">' + dispatchState + '</div>';
  }

  function afpOverrideToggleHtml(hasOverride) {
    return '<button id="sh-toggle-afp-override" style="width:100%;margin-top:8px;border:1.5px dashed var(--line);background:#fff;border-radius:8px;padding:8px;font-size:11.5px;font-weight:800;color:var(--gray);cursor:pointer;">' +
      (hasOverride ? '✏️ 이 세대 예외 수정' : '➕ 이 세대만 시설현황이 다름 (예외 등록)') +
    '</button>';
  }

  function afpOverrideFormHtml(unit) {
    var ov = unit.afpOverride || {};
    var fields = SAFEHOME.AFP_CORE_FIELDS.map(function (f) {
      var v = ov[f.key];
      var sel = v === true ? 'true' : (v === false ? 'false' : 'default');
      return '<div class="facility-field"><label>' + esc(f.label) + '</label>' +
        '<select data-unit-afp-key="' + f.key + '">' +
        '<option value="default"' + (sel === 'default' ? ' selected' : '') + '>건물 기본값 사용</option>' +
        '<option value="true"' + (sel === 'true' ? ' selected' : '') + '>' + esc(f.yes) + '</option>' +
        '<option value="false"' + (sel === 'false' ? ' selected' : '') + '>' + esc(f.no) + '</option>' +
        '</select></div>';
    }).join('');
    return '<div class="facility-grid" style="margin-top:8px;">' + fields + '</div>' +
      '<button class="utility-btn" style="width:100%;margin-top:8px;" id="sh-save-unit-afp" data-unit-ho="' + esc(unit.ho) + '">이 세대 예외 저장</button>';
  }

  function bindEvents(pending) {
    SAFEHOME.bindPanelToggles(root, panelOpenState);
    root.querySelectorAll('[data-select-ho]').forEach(function (el) {
      el.onclick = function () {
        var ho = el.getAttribute('data-select-ho');
        if (ho !== selectedHo) afpOverrideOpen = false;
        selectedHo = ho;
        render();
      };
    });
    var afpOverrideToggle = document.getElementById('sh-toggle-afp-override');
    if (afpOverrideToggle) afpOverrideToggle.onclick = function () { afpOverrideOpen = !afpOverrideOpen; render(); };
    var saveUnitAfpBtn = document.getElementById('sh-save-unit-afp');
    if (saveUnitAfpBtn) saveUnitAfpBtn.onclick = function () {
      var ho = saveUnitAfpBtn.getAttribute('data-unit-ho');
      var override = {};
      root.querySelectorAll('[data-unit-afp-key]').forEach(function (sel) {
        var v = sel.value;
        if (v === 'true') override[sel.getAttribute('data-unit-afp-key')] = true;
        else if (v === 'false') override[sel.getAttribute('data-unit-afp-key')] = false;
      });
      SAFEHOME.store.setUnitAfpOverride(ho, override);
      afpOverrideOpen = false;
      SAFEHOME.toast(ho + '호 시설현황 예외가 저장되었습니다.');
    };
    root.querySelectorAll('[data-select-incident]').forEach(function (el) {
      el.onclick = function () {
        SAFEHOME.store.setActiveIncident(el.getAttribute('data-select-incident'));
        selectedHo = null;
        confirmMode = null;
        render();
      };
    });
    var addIncidentBtn = document.getElementById('sh-add-incident');
    if (addIncidentBtn) addIncidentBtn.onclick = function () {
      confirmBuildingId = ''; confirmHo = '';
      confirmMode = 'new';
      render();
    };
    var cancelBtn = document.getElementById('sh-cancel-confirm');
    if (cancelBtn) cancelBtn.onclick = function () { confirmMode = null; render(); };
    var closeIncidentBtn = document.getElementById('sh-close-incident');
    if (closeIncidentBtn) closeIncidentBtn.onclick = function () {
      if (confirm('이 사건을 종료할까요? 세대 현황판에서 제외되고 조치 이력에만 남습니다.')) {
        SAFEHOME.store.closeActiveIncident();
        selectedHo = null;
        SAFEHOME.toast('사건을 종료했습니다.');
      }
    };
    var dispatchBtn = document.getElementById('sh-dispatch-btn');
    if (dispatchBtn) dispatchBtn.onclick = function () {
      SAFEHOME.store.dispatch();
      SAFEHOME.toast('출동 지령이 현장 소방대원 화면으로 전달되었습니다.');
    };
    var afpToggle = document.getElementById('sh-toggle-afp-checklist');
    if (afpToggle) afpToggle.onclick = function () { afpChecklistOpen = !afpChecklistOpen; render(); };
    var noteInput = document.getElementById('sh-note-input');
    if (noteInput) noteInput.oninput = function () { noteDraft = noteInput.value; };
    var noteSaveBtn = document.getElementById('sh-note-save');
    if (noteSaveBtn) noteSaveBtn.onclick = function () {
      var text = document.getElementById('sh-note-input').value;
      noteDraft = null;
      SAFEHOME.store.setDispatchNote(text);
      SAFEHOME.toast('메모가 현장 소방대원 화면에 전달되었습니다.');
    };
    var copyLinkBtn = document.getElementById('sh-copy-link');
    if (copyLinkBtn) copyLinkBtn.onclick = function () {
      var input = document.getElementById('sh-resident-link');
      var text = input.value;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { SAFEHOME.toast('링크가 복사되었습니다.'); })
          .catch(function () { input.select(); SAFEHOME.toast('복사 실패 — 직접 선택해 복사해주세요.'); });
      } else {
        input.select();
      }
    };
    var copyFfLinkBtn = document.getElementById('sh-copy-ff-link');
    if (copyFfLinkBtn) copyFfLinkBtn.onclick = function () {
      var input = document.getElementById('sh-firefighter-link');
      var text = input.value;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { SAFEHOME.toast('소방대원 링크가 복사되었습니다.'); })
          .catch(function () { input.select(); SAFEHOME.toast('복사 실패 — 직접 선택해 복사해주세요.'); });
      } else {
        input.select();
      }
    };
    var regenLinksBtn = document.getElementById('sh-regen-links');
    if (regenLinksBtn) regenLinksBtn.onclick = function () {
      var active = SAFEHOME.store.getActiveIncident();
      if (!active) return;
      SAFEHOME.store.regenerateIncidentLinks(active.id);
      SAFEHOME.toast('두 링크의 유효시간이 지금부터 다시 ' + SAFEHOME.store.getLinkTtlHours() + '시간으로 연장되었습니다.');
    };
    var saveTtlBtn = document.getElementById('sh-save-ttl');
    if (saveTtlBtn) saveTtlBtn.onclick = function () {
      var hours = document.getElementById('sh-link-ttl').value;
      SAFEHOME.store.setLinkTtlHours(hours);
      SAFEHOME.toast('기본 유효시간이 ' + SAFEHOME.store.getLinkTtlHours() + '시간으로 저장되었습니다. (기존 발급 링크에는 소급 적용되지 않음)');
    };
    root.querySelectorAll('[data-resolve-correction]').forEach(function (el) {
      el.onclick = function () {
        SAFEHOME.store.resolveCorrectionRequest(el.getAttribute('data-resolve-correction'));
        SAFEHOME.toast('수정 요청을 처리 완료로 표시했습니다.');
      };
    });
    var reopenBtn = document.getElementById('sh-reopen-confirm');
    if (reopenBtn) reopenBtn.onclick = function () {
      var inc = SAFEHOME.store.getActiveIncident();
      confirmBuildingId = inc ? inc.buildingId || '' : '';
      confirmHo = inc ? inc.officialHo || '' : '';
      confirmMode = 'edit';
      render();
    };
    var reportPicker = document.getElementById('sh-confirm-report');
    if (reportPicker) reportPicker.onchange = function () {
      var key = reportPicker.value;
      var r = key ? SAFEHOME.store.getReport(key) : null;
      if (r) {
        var b = SAFEHOME.findBuildingByAddress(r.apt, r.dong);
        confirmBuildingId = b ? b.id : '';
        confirmHo = r.ho || '';
      } else {
        confirmBuildingId = ''; confirmHo = '';
      }
      render();
    };
    var confirmBtn = document.getElementById('sh-confirm-btn');
    if (confirmBtn) confirmBtn.onclick = function () {
      var buildingSel = document.getElementById('sh-confirm-building').value;
      var hoVal = document.getElementById('sh-confirm-ho').value.trim();
      if (!buildingSel) { SAFEHOME.toast('등록 건물을 선택해주세요.'); return; }
      confirmMode = null; // store.setIncidentBuilding()이 동기적으로 render()를 호출하므로 먼저 닫아둔다.
      SAFEHOME.store.setIncidentBuilding(buildingSel, hoVal || null);
      var b = SAFEHOME.BUILDINGS[buildingSel];
      SAFEHOME.toast(b.apt + ' ' + b.dong + '동으로 사건 위치가 확정되었습니다.');
    };
    // select/input 값 변경 시 화면 전체를 다시 그리지 않고 로컬 상태만 갱신(포커스 유지)
    var buildingSelectEl = document.getElementById('sh-confirm-building');
    if (buildingSelectEl) buildingSelectEl.onchange = function () { confirmBuildingId = buildingSelectEl.value; };
    var hoInputEl = document.getElementById('sh-confirm-ho');
    if (hoInputEl) hoInputEl.oninput = function () { confirmHo = hoInputEl.value; };
  }

  SAFEHOME.Situation = { mount: mount, unmount: unmount };

}(window.SAFEHOME = window.SAFEHOME || {}));
