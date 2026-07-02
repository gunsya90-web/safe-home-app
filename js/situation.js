/* SAFE-HOME · situation.js
   119 종합상황실 화면: 신고 큐, 사건 위치 확정, 세대 상세(체크리스트), 실시간 세대 현황, 출동 지령.

   신고는 입주민이 말한 위치일 뿐이다. 상황실이 등록된 건물 디렉터리에서 해당 동을 찾아
   "사건 위치로 확정"해야 비로소 세대 현황판/AFP 정보가 채워지고 소방대원 화면에 노출된다. */
(function (SAFEHOME) {
  'use strict';

  var esc = SAFEHOME.escapeHtml;
  var root = null;
  var selectedHo = null;
  var unsubscribe = null;

  // 사건 확정 폼의 로컬 UI 상태
  var confirmOpen = false;
  var confirmBuildingId = '';
  var confirmHo = '';
  var afpChecklistOpen = false; // 체크리스트의 "피난시설 존재 여부" 펼침 상태
  var noteDraft = null; // 상황실 메모 입력창 초안 (null이면 저장된 값을 그대로 표시)

  var URGENCY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
  var URGENCY_LABEL = { critical: '🔴 긴급', high: '🟠 위험', medium: '🟡 주의', low: '🟢 안전' };

  function mount(container) {
    root = container;
    if (unsubscribe) unsubscribe();
    unsubscribe = SAFEHOME.store.subscribe(render);
    selectedHo = pickDefaultSelection();
    confirmOpen = !SAFEHOME.store.getState().incident.confirmed;
    render();
  }
  function unmount() {
    if (unsubscribe) { unsubscribe(); unsubscribe = null; }
    root = null;
  }

  function reportedUnits() {
    return SAFEHOME.store.getUnits()
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
    var list = reportedUnits();
    return list.length ? list[0].ho : null;
  }

  function countStatuses(units) {
    var c = { unresponded: 0, waiting: 0, moving: 0, danger: 0, safe: 0 };
    units.forEach(function (u) { c[u.status] = (c[u.status] || 0) + 1; });
    return c;
  }

  function render() {
    if (!root) return;
    var state = SAFEHOME.store.getState();
    var units = SAFEHOME.store.getUnits();
    var pending = SAFEHOME.store.getPendingReports();
    var reported = reportedUnits();
    if (selectedHo && !state.units[selectedHo]) selectedHo = null;
    if (!selectedHo && reported.length) selectedHo = reported[0].ho;
    var counts = countStatuses(units);

    root.innerHTML =
      '<div class="dash-header">' +
        '<div class="dash-title">📞 119 종합상황실</div>' +
        '<div class="dash-sub">' + (state.incident.confirmed ? esc(state.incident.apt) + ' ' + esc(state.incident.dong) + '동 · 실시간 신고 접수 현황' : '사건 위치 미확정 · 신고 접수 대기') + '</div>' +
      '</div>' +
      incidentPanelHtml(state, pending) +
      // 확정된 사건 주소와 일치하지 않는 신고(다른 동/오신고 등)는 확정 여부와 무관하게 항상 눈에 띄게 표시한다.
      (pending.length && !confirmOpen ? pendingPanelHtml(pending, state.incident.confirmed) : '') +
      (state.incident.confirmed ? (
        statBarHtml(counts) +
        '<div class="dash-grid-2">' +
          facilityPanelHtml(SAFEHOME.BUILDINGS[state.incident.buildingId], state.afp) +
          specialStructureHtml(SAFEHOME.BUILDINGS[state.incident.buildingId]) +
        '</div>' +
        '<div class="dash-grid-2">' +
          '<div class="panel">' +
            '<h3 class="panel-title">🚨 신고 큐 <span class="badge">' + reported.length + '</span></h3>' +
            queueHtml(reported) +
          '</div>' +
          '<div class="panel">' + detailHtml(selectedHo, state) + '</div>' +
        '</div>' +
        noteFormHtml(state) +
        '<div class="panel">' +
          '<h3 class="panel-title">🗺️ 실시간 세대 현황 (Live Occupancy Status)</h3>' +
          SAFEHOME.renderOccupancyGrid(units, { selected: selectedHo }) +
          SAFEHOME.renderStatusLegend() +
        '</div>'
      ) : '');

    bindEvents(pending);
  }

  // --------------------------------------------------------- 사건 위치 확정
  function incidentPanelHtml(state, pending) {
    var inc = state.incident;
    if (inc.confirmed && !confirmOpen) {
      return '<div class="panel" style="border-color:#A5D6A7;background:#F4FBF4;">' +
        '<h3 class="panel-title">🏢 확정된 사건 위치</h3>' +
        '<div style="font-size:15px;font-weight:900;margin-bottom:4px;">' + esc(inc.apt) + ' ' + esc(inc.dong) + '동' + (inc.officialHo ? ' · 최초 신고 ' + esc(inc.officialHo) + '호' : '') + '</div>' +
        '<div style="font-size:12px;color:var(--gray);margin-bottom:10px;">' + SAFEHOME.fmtTime(inc.confirmedAt) + ' 확정</div>' +
        '<button class="utility-btn secondary" id="sh-reopen-confirm">🔁 위치 변경 / 재확인</button>' +
      '</div>';
    }
    return '<div class="panel" style="border-color:#FFD180;background:#FFFBF2;">' +
      '<h3 class="panel-title">⚠️ 사건 위치 확정 필요</h3>' +
      '<div class="empty-note" style="padding:4px 4px 12px;text-align:left;">신고자가 말한 위치는 참고 정보입니다. 등록된 건물 디렉터리에서 해당 동을 찾아 사건 위치로 확정해야 세대 현황판과 소방대원 화면이 활성화됩니다.</div>' +
      confirmFormHtml(pending) +
    '</div>';
  }

  function confirmFormHtml(pending) {
    var buildingOptions = Object.keys(SAFEHOME.BUILDINGS).map(function (id) {
      var b = SAFEHOME.BUILDINGS[id];
      return '<option value="' + id + '"' + (confirmBuildingId === id ? ' selected' : '') + '>' + esc(b.apt) + ' ' + esc(b.dong) + '동 (' + b.floors + '층 · ' + b.unitsPerFloor + '세대/층)</option>';
    }).join('');

    var reportPicker = '';
    if (pending.length) {
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
      '<div class="kapt-actions" style="margin-top:12px;"><button class="primary" id="sh-confirm-btn">✅ 이 위치로 사건 확정</button></div>' +
    '</div>';
  }

  function pendingPanelHtml(pending, mainIncidentConfirmed) {
    var title = mainIncidentConfirmed ? '🕒 다른 위치 신고 (확인 필요)' : '🕒 미확정 신고';
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

  // 건물 소방시설현황(AFP-Core) — 신고가 들어왔을 때 상황실이 바로 참고해 안내할 수 있도록 상시 노출한다.
  function facilityPanelHtml(building, afp) {
    return '<div class="panel">' +
      '<h3 class="panel-title">🧯 소방시설현황 (AFP-Core)</h3>' +
      SAFEHOME.renderAfpGrid(afp) +
      '<div class="afp-note">※ 신고자에게 안내할 대체 대피시설(대피공간·경량칸막이·하향식피난구 등)을 바로 확인할 수 있습니다.</div>' +
    '</div>';
  }

  // 특화구조 정보 — 복층/다락 세대, 옥상 대피(최상층 여부), 복도 형태 등 상황 판단에 필요한 건물 구조 요약.
  function specialStructureHtml(building) {
    var s = building.search;
    var roofOnTopFloor = building.core.roofEvacuation ? '최상층(' + building.floors + '층)에서 옥상으로 진입' : '옥상 대피 불가 등록 건물';
    return '<div class="panel">' +
      '<h3 class="panel-title">🏗️ 건물 특화 구조 정보</h3>' +
      '<div class="check-row"><span class="check-mark">🏠</span><span class="check-label">복층·다락 세대</span><span class="check-value">' + (s.duplexUnits.length ? s.duplexUnits.join(', ') + '호' : '없음') + '</span></div>' +
      '<div class="check-row"><span class="check-mark">🏢</span><span class="check-label">옥상 대피 · 최상층</span><span class="check-value">' + esc(roofOnTopFloor) + '</span></div>' +
      '<div class="check-row"><span class="check-mark">🧱</span><span class="check-label">복도 형태</span><span class="check-value">' + esc(building.hallwayType) + ' · 총 ' + building.floors + '층 · 세대당 ' + building.unitsPerFloor + '호</span></div>' +
      '<div class="afp-note" style="margin-top:8px;">' + esc(s.duplexNote) + '</div>' +
    '</div>';
  }

  // 119 상황실이 남기는 메모 — 소방대원 화면(dash-header 아래)에 그대로 노출된다.
  function noteFormHtml(state) {
    var value = noteDraft !== null ? noteDraft : state.dispatchNote;
    return '<div class="panel">' +
      '<h3 class="panel-title">📝 소방대원에게 메모 전달</h3>' +
      '<textarea id="sh-note-input" rows="2" placeholder="예: 903호 거동 불편 노약자 1인, 우선 구조 요망" ' +
        'style="width:100%;border:1.5px solid var(--line);border-radius:10px;padding:10px;font-size:13px;font-family:inherit;resize:vertical;">' + esc(value) + '</textarea>' +
      '<button class="utility-btn" style="width:100%;margin-top:8px;" id="sh-note-save">전달하기</button>' +
    '</div>';
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

  function detailHtml(ho, state) {
    if (!ho) {
      return '<h3 class="panel-title">🧾 상황관리 체크리스트</h3><div class="empty-note">왼쪽 신고 큐 또는 아래 현황판에서 세대를 선택하세요.</div>';
    }
    var unit = state.units[ho];
    var afp = state.afp;
    var res = SAFEHOME.RESULTS[unit.resultKey];
    var a = unit.answers || {};

    var afpCount = SAFEHOME.AFP_CORE_FIELDS.filter(function (f) { return afp[f.key] === true; }).length;
    var checklist =
      checklistRow('신고자 위치 확인', true, ho + '호') +
      checklistRow('연기·화염 유입 여부', !!a.q2, a.q2 || '미확인') +
      checklistRow('현관 대피 가능 여부', !!a.q3, a.q3 || '미확인') +
      checklistRow('복도·계단 안전 여부', !!a.q4, a.q4 || '미확인') +
      '<button class="check-row check-row-clickable done" id="sh-toggle-afp-checklist" style="width:100%;border:none;background:none;text-align:left;cursor:pointer;">' +
        '<span class="check-mark">✅</span><span class="check-label">피난시설 존재 여부(AFP) — 클릭해서 상세보기</span>' +
        '<span class="check-value">' + afpCount + '종 설치 ' + (afpChecklistOpen ? '▲' : '▼') + '</span>' +
      '</button>' +
      (afpChecklistOpen ? SAFEHOME.renderAfpGrid(afp) : '');

    var notes = (unit.notes || []).map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('');
    var vulnerable = unit.hasVulnerable ? '<div class="tag-warn">⚠️ 거동 불편자 있음 (' + unit.occupants + '인 세대)</div>' : '<div class="tag-info">' + unit.occupants + '인 세대</div>';

    var dispatchState = state.dispatch.dispatched
      ? '<div class="tag-ok">🚒 출동 지령 완료 (' + SAFEHOME.fmtTime(state.dispatch.dispatchedAt) + ')</div>'
      : '<button class="utility-btn" id="sh-dispatch-btn">🚒 출동 지령 내리기</button>';

    return '<h3 class="panel-title">🧾 ' + ho + '호 · 상황관리 체크리스트</h3>' +
      vulnerable +
      checklist +
      (res ? '<div class="action-card ' + res.cls + '" style="margin-top:12px;"><h3>' + res.icon + ' 판정 결과: ' + esc(res.title) + '</h3><ul>' + notes + '</ul></div>' : '<div class="empty-note">아직 대피 판정 전입니다.</div>') +
      '<div style="margin-top:12px;">' + dispatchState + '</div>';
  }

  function bindEvents(pending) {
    root.querySelectorAll('[data-select-ho]').forEach(function (el) {
      el.onclick = function () { selectedHo = el.getAttribute('data-select-ho'); render(); };
    });
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
    var reopenBtn = document.getElementById('sh-reopen-confirm');
    if (reopenBtn) reopenBtn.onclick = function () {
      var inc = SAFEHOME.store.getState().incident;
      confirmBuildingId = inc.buildingId || '';
      confirmHo = inc.officialHo || '';
      confirmOpen = true;
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
      confirmOpen = false; // store.setIncidentBuilding()이 동기적으로 render()를 호출하므로 먼저 닫아둔다.
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
