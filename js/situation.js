/* SAFE-HOME · situation.js
   119 종합상황실 화면: 신고 큐, 세대 상세(체크리스트), 실시간 세대 현황, 출동 지령. */
(function (SAFEHOME) {
  'use strict';

  var esc = SAFEHOME.escapeHtml;
  var root = null;
  var selectedHo = null;
  var unsubscribe = null;

  var URGENCY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
  var URGENCY_LABEL = { critical: '🔴 긴급', high: '🟠 위험', medium: '🟡 주의', low: '🟢 안전' };

  function mount(container) {
    root = container;
    if (unsubscribe) unsubscribe();
    unsubscribe = SAFEHOME.store.subscribe(render);
    selectedHo = pickDefaultSelection();
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
    var reported = reportedUnits();
    if (selectedHo && !state.units[selectedHo]) selectedHo = null;
    if (!selectedHo && reported.length) selectedHo = reported[0].ho;
    var counts = countStatuses(units);

    root.innerHTML =
      '<div class="dash-header">' +
        '<div class="dash-title">📞 119 종합상황실</div>' +
        '<div class="dash-sub">' + esc(state.location.apt || SAFEHOME.BUILDING.apt) + ' ' + esc(state.location.dong || SAFEHOME.BUILDING.dong) + '동 · 실시간 신고 접수 현황</div>' +
      '</div>' +
      statBarHtml(counts) +
      '<div class="dash-grid-2">' +
        '<div class="panel">' +
          '<h3 class="panel-title">🚨 신고 큐 <span class="badge">' + reported.length + '</span></h3>' +
          queueHtml(reported) +
        '</div>' +
        '<div class="panel">' + detailHtml(selectedHo, state) + '</div>' +
      '</div>' +
      '<div class="panel">' +
        '<h3 class="panel-title">🗺️ 실시간 세대 현황 (Live Occupancy Status)</h3>' +
        SAFEHOME.renderOccupancyGrid(units, { selected: selectedHo }) +
        SAFEHOME.renderStatusLegend() +
      '</div>';

    root.querySelectorAll('[data-select-ho]').forEach(function (el) {
      el.onclick = function () { selectedHo = el.getAttribute('data-select-ho'); render(); };
    });
    var dispatchBtn = document.getElementById('sh-dispatch-btn');
    if (dispatchBtn) dispatchBtn.onclick = function () {
      SAFEHOME.store.dispatch();
      SAFEHOME.toast('출동 지령이 현장 소방대원 화면으로 전달되었습니다.');
    };
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
      return '<div class="empty-note">아직 접수된 세대 신고가 없습니다. 입주민 화면에서 대피 안내를 진행하면 여기에 표시됩니다.</div>';
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

    var checklist =
      checklistRow('신고자 위치 확인', true, ho + '호') +
      checklistRow('연기·화염 유입 여부', !!a.q2, a.q2 || '미확인') +
      checklistRow('현관 대피 가능 여부', !!a.q3, a.q3 || '미확인') +
      checklistRow('복도·계단 안전 여부', !!a.q4, a.q4 || '미확인') +
      checklistRow('피난시설 존재 여부(AFP)', true, SAFEHOME.AFP_CORE_FIELDS.filter(function (f) { return afp[f.key] === true; }).length + '종 설치');

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

  SAFEHOME.Situation = { mount: mount, unmount: unmount };

}(window.SAFEHOME = window.SAFEHOME || {}));
