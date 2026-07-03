/* SAFE-HOME · firefighter.js
   현장 소방대원 화면: AFP-Search 기반 건물 특이사항, 구조 우선순위 리스트,
   현장 처치 결과를 store에 되먹임(피드백)한다. */
(function (SAFEHOME) {
  'use strict';

  var esc = SAFEHOME.escapeHtml;
  var root = null;
  var selectedHo = null;
  var unsubscribe = null;
  var floorplanOpenHo = null; // 세대 개략도를 펼쳐본 세대(호) — 한 번에 하나만 연다.
  var panelOpenState = {}; // 아코디언 패널별 접기/펼치기 상태 (렌더링 간 유지)
  var selectedIncidentId = null; // 이 소방대원 화면이 보고 있는 사건 — 119 상황실의 activeIncident와는 별개.

  var PRIORITY_ORDER = { danger: 0, unresponded: 1, moving: 2, waiting: 3, safe: 4 };

  function mount(container) {
    root = container;
    if (unsubscribe) unsubscribe();
    unsubscribe = SAFEHOME.store.subscribe(render);
    selectedHo = null;
    floorplanOpenHo = null;
    panelOpenState = {};
    // ?incident=ID 링크로 들어왔다면 그 사건으로 고정, 아니면 열려 있는 사건 중 가장 최근 것.
    selectedIncidentId = SAFEHOME.urlIncidentId || null;
    render();
  }
  function unmount() {
    if (unsubscribe) { unsubscribe(); unsubscribe = null; }
    root = null;
  }

  function openIncidents() {
    return SAFEHOME.store.listIncidents().filter(function (i) { return !i.closed; });
  }

  function resolveIncident() {
    var open = openIncidents();
    if (!open.length) return null;
    if (selectedIncidentId && open.some(function (i) { return i.id === selectedIncidentId; })) {
      return SAFEHOME.store.getIncident(selectedIncidentId);
    }
    return open[0];
  }

  function priorityUnits(incidentId) {
    return SAFEHOME.store.getUnits(incidentId)
      .filter(function (u) { return u.status !== 'safe'; })
      .sort(function (a, b) {
        var pa = PRIORITY_ORDER[a.status], pb = PRIORITY_ORDER[b.status];
        if (pa !== pb) return pa - pb;
        return (b.updatedAt || 0) - (a.updatedAt || 0);
      });
  }

  function incidentTabsHtml(open, active) {
    if (open.length <= 1) return '';
    var tabs = open.map(function (inc) {
      var urgentCount = SAFEHOME.store.getUnits(inc.id).filter(function (u) { return u.status === 'danger'; }).length;
      return '<button class="incident-tab' + (active && active.id === inc.id ? ' active' : '') + '" data-select-incident="' + inc.id + '">' +
        esc(inc.apt) + ' ' + esc(inc.dong) + '동' + (urgentCount ? ' <span class="badge">' + urgentCount + '</span>' : '') +
      '</button>';
    }).join('');
    return '<div class="incident-tabs">' + tabs + '</div>';
  }

  function render() {
    if (!root) return;
    var open = openIncidents();
    var active = resolveIncident();
    selectedIncidentId = active ? active.id : null;

    if (!active) {
      root.innerHTML =
        '<div class="dash-header ff">' +
          '<div class="dash-title">🚒 현장 소방대원 정보카드</div>' +
          '<div class="dash-sub">대기 중</div>' +
        '</div>' +
        '<div class="panel">' +
          '<div class="empty-note">🕒 119 상황실에서 아직 사건 위치를 확정하지 않았습니다.<br>위치가 확정되면 건물 특이사항과 세대 현황이 여기에 표시됩니다.</div>' +
        '</div>';
      return;
    }

    var building = SAFEHOME.BUILDINGS[active.buildingId];
    var units = SAFEHOME.store.getUnits(active.id);
    var priority = priorityUnits(active.id);

    root.innerHTML =
      '<div class="dash-header ff">' +
        '<div class="dash-title">🚒 현장 소방대원 정보카드</div>' +
        '<div class="dash-sub">' + esc(active.apt) + ' ' + esc(active.dong) + '동 · ' + (active.dispatch.dispatched ? '출동 지령 수신 (' + SAFEHOME.fmtTime(active.dispatch.dispatchedAt) + ')' : '대기 중') + '</div>' +
      '</div>' +
      incidentTabsHtml(open, active) +
      (active.dispatchNote ? '<div class="panel" style="border-color:#FFD180;background:#FFFBF2;"><h3 class="panel-title">📝 119 상황실 메모</h3><div style="font-size:13.5px;line-height:1.6;white-space:pre-line;">' + esc(active.dispatchNote) + '</div></div>' : '') +
      casualtyPanelHtml(active.casualties) +
      suppressionPanelHtml(building) +
      afpSearchHtml(building) +
      '<div class="panel">' +
        '<h3 class="panel-title">🎯 구조 우선순위 <span class="badge">' + priority.length + '</span></h3>' +
        priorityListHtml(priority, building) +
      '</div>' +
      SAFEHOME.detailsPanel('🗺️ 실시간 세대 현황',
        SAFEHOME.renderOccupancyGrid(units, { selected: selectedHo }) + SAFEHOME.renderStatusLegend(),
        { id: 'grid', openState: panelOpenState.grid });

    root.querySelectorAll('[data-select-incident]').forEach(function (el) {
      el.onclick = function () {
        selectedIncidentId = el.getAttribute('data-select-incident');
        selectedHo = null;
        render();
      };
    });
    root.querySelectorAll('[data-select-ho]').forEach(function (el) {
      el.onclick = function () { selectedHo = el.getAttribute('data-select-ho'); render(); };
    });
    root.querySelectorAll('[data-action]').forEach(function (el) {
      el.onclick = function () {
        var ho = el.getAttribute('data-ho');
        var action = el.getAttribute('data-action');
        SAFEHOME.store.firefighterSetStatus(ho, action, active.id);
        SAFEHOME.toast(ho + '호 상태를 "' + SAFEHOME.STATUS_META[action].label + '"(으)로 갱신했습니다.');
      };
    });
    root.querySelectorAll('[data-casualty-key]').forEach(function (el) {
      el.onclick = function () {
        var key = el.getAttribute('data-casualty-key');
        var delta = parseInt(el.getAttribute('data-casualty-adjust'), 10);
        SAFEHOME.store.adjustCasualty(key, delta, active.id);
      };
    });
    root.querySelectorAll('[data-floorplan-ho]').forEach(function (el) {
      el.onclick = function () {
        var ho = el.getAttribute('data-floorplan-ho');
        floorplanOpenHo = (floorplanOpenHo === ho) ? null : ho;
        render();
      };
    });
    SAFEHOME.bindPanelToggles(root, panelOpenState);
  }

  var CASUALTY_FIELDS = [
    { key: 'dead', label: '사망', icon: '⚫' },
    { key: 'severe', label: '중상', icon: '🔴' },
    { key: 'minor', label: '경상', icon: '🟡' },
    { key: 'guided', label: '피난유도 인원', icon: '🚶' },
    { key: 'selfEvacuated', label: '자력대피 인원', icon: '🏃' }
  ];

  function casualtyPanelHtml(c) {
    c = c || {};
    return '<div class="panel">' +
      '<h3 class="panel-title">🚑 환자 · 대피 현황</h3>' +
      '<div class="casualty-grid">' + CASUALTY_FIELDS.map(function (it) {
        return '<div class="casualty-item">' +
          '<div class="casualty-label">' + it.icon + ' ' + it.label + '</div>' +
          '<div class="casualty-controls">' +
            '<button data-casualty-key="' + it.key + '" data-casualty-adjust="-1">−</button>' +
            '<span class="casualty-count">' + (c[it.key] || 0) + '</span>' +
            '<button data-casualty-key="' + it.key + '" data-casualty-adjust="1">+</button>' +
          '</div>' +
        '</div>';
      }).join('') + '</div>' +
      '<div class="afp-note">※ 119 상황실 화면에도 그대로 표시됩니다.</div>' +
    '</div>';
  }

  function suppressionPanelHtml(b) {
    var body = SAFEHOME.renderAfpGrid(b.suppression, SAFEHOME.AFP_SUPPRESSION_FIELDS);
    return SAFEHOME.detailsPanel('🚰 소화시설 현황', body, { id: 'suppression', openState: panelOpenState.suppression });
  }

  function afpSearchHtml(b) {
    var s = b.search;
    var body = '<div class="search-grid">' +
        searchCard('🏗️', '권상기실 구조', s.hoistRoomStructure) +
        searchCard('🏢', '옥상 접근 방법', s.roofAccessRoute) +
        searchCard('🪜', '숨은 계단', s.hiddenStairs) +
        searchCard('🚪', '중간 방화문', s.midFireDoors) +
        searchCard('🏠', '복층·다락 세대', (s.duplexUnits.length ? s.duplexUnits.join(', ') + '호 — ' : '') + s.duplexNote) +
        searchCard('🧭', '피난안전구역', s.refugeAreaNote) +
        searchCard('🅿️', '지하·기계실', s.basementNote) +
        searchCard('🧱', '복도 형태', b.hallwayType + ' · 총 ' + b.floors + '층 · 세대당 ' + b.unitsPerFloor + '호') +
      '</div>';
    return SAFEHOME.detailsPanel('🔎 AFP-Search · 인명검색 특화 정보', body, { id: 'afpsearch', openState: panelOpenState.afpsearch });
  }
  function searchCard(icon, title, body) {
    return '<div class="search-card"><div class="search-card-title">' + icon + ' ' + esc(title) + '</div><div class="search-card-body">' + esc(body) + '</div></div>';
  }

  function groupByFloor(list) {
    var map = {};
    list.forEach(function (u) { (map[u.floor] = map[u.floor] || []).push(u); });
    return Object.keys(map).map(Number).sort(function (a, b) { return b - a; })
      .map(function (f) { return { floor: f, units: map[f].sort(function (a, b) { return a.unitIndex - b.unitIndex; }) }; });
  }

  function priorityListHtml(list, building) {
    if (!list.length) {
      return '<div class="empty-note">현재 구조 대기 중인 세대가 없습니다. 모든 세대가 대피를 완료했습니다.</div>';
    }
    var floorGroups = groupByFloor(list);
    return '<div class="ff-floors">' + floorGroups.map(function (g) {
      return '<div class="ff-floor-group">' +
        '<div class="ff-floor-label">' + g.floor + 'F</div>' +
        '<div class="ff-floor-row">' + g.units.map(function (u) { return ffCardHtml(u, building); }).join('') + '</div>' +
      '</div>';
    }).join('') + '</div>';
  }

  function ffCardHtml(u, building) {
    var meta = SAFEHOME.STATUS_META[u.status];
    var res = SAFEHOME.RESULTS[u.resultKey];
    var isDuplex = building.search.duplexUnits.indexOf(u.ho) !== -1;
    var open = floorplanOpenHo === u.ho;
    return '<div class="ff-card status-border-' + u.status + '">' +
      '<div class="ff-card-head">' +
        '<span class="ff-ho">' + (u.isFireOrigin ? '🔥 ' : '') + u.ho + '호' + (isDuplex ? ' 🪜' : '') + '</span>' +
        '<span class="ff-status" style="color:' + meta.color + '">' + meta.label + '</span>' +
      '</div>' +
      (u.hasVulnerable ? '<div class="tag-warn">⚠️ 거동 불편자 있음 · ' + u.occupants + '인 세대</div>' : '<div class="tag-info">' + u.occupants + '인 세대</div>') +
      (res ? '<div class="ff-plan">📋 입주민 안내: ' + res.icon + ' ' + esc(res.title) + '</div>' : '<div class="ff-plan">📋 아직 대피 판정 없음 · 직접 확인 필요</div>') +
      '<div class="ff-actions">' +
        '<button data-action="safe" data-ho="' + u.ho + '">✅ 구조·대피 완료</button>' +
        '<button data-action="moving" data-ho="' + u.ho + '">🚪 이동 유도 중</button>' +
        '<button data-action="danger" data-ho="' + u.ho + '" class="danger">🔴 위험 재확인</button>' +
      '</div>' +
      '<button class="ff-floorplan-toggle" data-floorplan-ho="' + u.ho + '">' + (open ? '▲ 세대 도면 닫기' : '🗺️ 세대 도면 보기') + '</button>' +
      (open ? '<div class="ff-floorplan-box">' + SAFEHOME.renderUnitFloorplan(SAFEHOME.store.getEffectiveAfp(u, building.core), isDuplex) + '</div>' : '') +
    '</div>';
  }

  SAFEHOME.Firefighter = { mount: mount, unmount: unmount };

}(window.SAFEHOME = window.SAFEHOME || {}));
