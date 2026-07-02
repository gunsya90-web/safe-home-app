/* SAFE-HOME · firefighter.js
   현장 소방대원 화면: AFP-Search 기반 건물 특이사항, 구조 우선순위 리스트,
   현장 처치 결과를 store에 되먹임(피드백)한다. */
(function (SAFEHOME) {
  'use strict';

  var esc = SAFEHOME.escapeHtml;
  var root = null;
  var selectedHo = null;
  var unsubscribe = null;

  var PRIORITY_ORDER = { danger: 0, unresponded: 1, moving: 2, waiting: 3, safe: 4 };

  function mount(container) {
    root = container;
    if (unsubscribe) unsubscribe();
    unsubscribe = SAFEHOME.store.subscribe(render);
    selectedHo = null;
    render();
  }
  function unmount() {
    if (unsubscribe) { unsubscribe(); unsubscribe = null; }
    root = null;
  }

  function priorityUnits() {
    return SAFEHOME.store.getUnits()
      .filter(function (u) { return u.status !== 'safe'; })
      .sort(function (a, b) {
        var pa = PRIORITY_ORDER[a.status], pb = PRIORITY_ORDER[b.status];
        if (pa !== pb) return pa - pb;
        return (b.updatedAt || 0) - (a.updatedAt || 0);
      });
  }

  function render() {
    if (!root) return;
    var state = SAFEHOME.store.getState();
    var units = SAFEHOME.store.getUnits();
    var priority = priorityUnits();

    root.innerHTML =
      '<div class="dash-header ff">' +
        '<div class="dash-title">🚒 현장 소방대원 정보카드</div>' +
        '<div class="dash-sub">' + esc(state.location.apt || SAFEHOME.BUILDING.apt) + ' ' + esc(state.location.dong || SAFEHOME.BUILDING.dong) + '동 · ' + (state.dispatch.dispatched ? '출동 지령 수신 (' + SAFEHOME.fmtTime(state.dispatch.dispatchedAt) + ')' : '대기 중') + '</div>' +
      '</div>' +
      afpSearchHtml() +
      '<div class="panel">' +
        '<h3 class="panel-title">🎯 구조 우선순위 <span class="badge">' + priority.length + '</span></h3>' +
        priorityListHtml(priority) +
      '</div>' +
      '<div class="panel">' +
        '<h3 class="panel-title">🗺️ 실시간 세대 현황</h3>' +
        SAFEHOME.renderOccupancyGrid(units, { selected: selectedHo }) +
        SAFEHOME.renderStatusLegend() +
      '</div>';

    root.querySelectorAll('[data-select-ho]').forEach(function (el) {
      el.onclick = function () { selectedHo = el.getAttribute('data-select-ho'); render(); };
    });
    root.querySelectorAll('[data-action]').forEach(function (el) {
      el.onclick = function () {
        var ho = el.getAttribute('data-ho');
        var action = el.getAttribute('data-action');
        SAFEHOME.store.firefighterSetStatus(ho, action);
        SAFEHOME.toast(ho + '호 상태를 "' + SAFEHOME.STATUS_META[action].label + '"(으)로 갱신했습니다.');
      };
    });
  }

  function afpSearchHtml() {
    var s = SAFEHOME.AFP_SEARCH;
    var b = SAFEHOME.BUILDING;
    return '<div class="panel">' +
      '<h3 class="panel-title">🔎 AFP-Search · 인명검색 특화 정보</h3>' +
      '<div class="search-grid">' +
        searchCard('🏗️', '권상기실 구조', s.hoistRoomStructure) +
        searchCard('🏢', '옥상 접근 방법', s.roofAccessRoute) +
        searchCard('🪜', '숨은 계단', s.hiddenStairs) +
        searchCard('🚪', '중간 방화문', s.midFireDoors) +
        searchCard('🏠', '복층·다락 세대', s.duplexUnits.join(', ') + '호 — ' + s.duplexNote) +
        searchCard('🧭', '피난안전구역', s.refugeAreaNote) +
        searchCard('🅿️', '지하·기계실', s.basementNote) +
        searchCard('🧱', '복도 형태', b.hallwayType + ' · 총 ' + b.floors + '층 · 세대당 ' + b.unitsPerFloor + '호') +
      '</div>' +
    '</div>';
  }
  function searchCard(icon, title, body) {
    return '<div class="search-card"><div class="search-card-title">' + icon + ' ' + esc(title) + '</div><div class="search-card-body">' + esc(body) + '</div></div>';
  }

  function priorityListHtml(list) {
    if (!list.length) {
      return '<div class="empty-note">현재 구조 대기 중인 세대가 없습니다. 모든 세대가 대피를 완료했습니다.</div>';
    }
    return '<div class="ff-list">' + list.map(function (u) {
      var meta = SAFEHOME.STATUS_META[u.status];
      var res = SAFEHOME.RESULTS[u.resultKey];
      return '<div class="ff-card status-border-' + u.status + '">' +
        '<div class="ff-card-head">' +
          '<span class="ff-ho">' + (u.isFireOrigin ? '🔥 ' : '') + u.ho + '호</span>' +
          '<span class="ff-status" style="color:' + meta.color + '">' + meta.label + '</span>' +
        '</div>' +
        (u.hasVulnerable ? '<div class="tag-warn">⚠️ 거동 불편자 있음 · ' + u.occupants + '인 세대</div>' : '<div class="tag-info">' + u.occupants + '인 세대</div>') +
        (res ? '<div class="ff-plan">📋 입주민 안내: ' + res.icon + ' ' + esc(res.title) + '</div>' : '<div class="ff-plan">📋 아직 대피 판정 없음 · 직접 확인 필요</div>') +
        '<div class="ff-actions">' +
          '<button data-action="safe" data-ho="' + u.ho + '">✅ 구조·대피 완료</button>' +
          '<button data-action="moving" data-ho="' + u.ho + '">🚪 이동 유도 중</button>' +
          '<button data-action="danger" data-ho="' + u.ho + '" class="danger">🔴 위험 재확인</button>' +
        '</div>' +
      '</div>';
    }).join('') + '</div>';
  }

  SAFEHOME.Firefighter = { mount: mount, unmount: unmount };

}(window.SAFEHOME = window.SAFEHOME || {}));
