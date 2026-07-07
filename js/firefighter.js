/* SAFE-HOME · firefighter.js
   현장 소방대원 화면: AFP-Core(피난시설)·소화시설 현황, AFP-Search 건물 특이사항,
   실시간 세대 현황(그리드 통합형 — 세대 선택 시 옆에 상세·도면·상태변경 버튼 표시),
   현장 처치 결과를 store에 되먹임(피드백)한다. */
(function (SAFEHOME) {
  'use strict';

  var esc = SAFEHOME.escapeHtml;
  var root = null;
  var selectedHo = null;
  var unsubscribe = null;
  var panelOpenState = {}; // 아코디언 패널별 접기/펼치기 상태 (렌더링 간 유지)
  var selectedIncidentId = null; // 이 소방대원 화면이 보고 있는 사건 — 119 상황실의 activeIncident와는 별개.
  var gridFilter = 'all'; // 현황판 필터 — 상단 요약 숫자를 눌러 특정 상태만 볼 수 있다.

  var PRIORITY_ORDER = { danger: 0, unresponded: 1, moving: 2, waiting: 3, safe: 4 };

  function mount(container) {
    root = container;
    if (unsubscribe) unsubscribe();
    unsubscribe = SAFEHOME.store.subscribe(render);
    selectedHo = null;
    panelOpenState = {};
    gridFilter = 'all';
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
          '<div class="dash-title-row"><div class="dash-title">' + SAFEHOME.icon2('flame') + ' 현장 소방대원 정보카드</div>' + radioBtnHtml() + '</div>' +
          '<div class="dash-sub">대기 중</div>' +
        '</div>' +
        '<div class="panel">' +
          '<div class="empty-note">' + SAFEHOME.icon2('clock') + ' 119 상황실에서 아직 사건 위치를 확정하지 않았습니다.<br>위치가 확정되면 건물 특이사항과 세대 현황이 여기에 표시됩니다.</div>' +
        '</div>';
      return;
    }

    var building = SAFEHOME.store.getEffectiveBuilding(active.buildingId);
    var units = SAFEHOME.store.getUnits(active.id);
    if (selectedHo && !units.some(function (u) { return u.ho === selectedHo; })) selectedHo = null;
    if (!selectedHo) {
      var priority = priorityUnits(active.id);
      if (priority.length) selectedHo = priority[0].ho;
    }
    var counts = countStatuses(units);
    var activeCount = units.filter(function (u) { return u.status !== 'safe'; }).length;

    root.innerHTML =
      '<div class="dash-header ff">' +
        '<div class="dash-title-row"><div class="dash-title">' + SAFEHOME.icon2('flame') + ' 현장 소방대원 정보카드</div>' + radioBtnHtml() + '</div>' +
        '<div class="dash-sub">' + esc(active.apt) + ' ' + esc(active.dong) + '동 · ' + SAFEHOME.fmtTime(active.confirmedAt) + ' 확정</div>' +
      '</div>' +
      incidentTabsHtml(open, active) +
      (active.dispatchNote ? '<div class="panel" style="border-color:#FFD180;background:#FFFBF2;"><h3 class="panel-title">' + SAFEHOME.icon2('note') + ' 119 상황실 메모</h3><div style="font-size:13.5px;line-height:1.6;white-space:pre-line;">' + esc(active.dispatchNote) + '</div></div>' : '') +
      ffStatBarHtml(counts) +
      recentFeedPanelHtml(units) +
      casualtyPanelHtml(active.casualties) +
      '<div class="dash-grid-2">' +
        evacuationPanelHtml(active.afp) +
        suppressionPanelHtml(building) +
      '</div>' +
      afpSearchHtml(building) +
      '<div class="dash-grid-2 ff-grid-detail">' +
        '<div class="panel">' +
          '<h3 class="panel-title">' + SAFEHOME.icon2('grid') + ' 아파트 대피 현황판 <span class="badge">' + activeCount + '</span></h3>' +
          filterChipsHtml(counts) +
          '<div class="ff-grid-lg">' + SAFEHOME.renderOccupancyGrid(units, { selected: selectedHo, filterStatus: gridFilter }) + '</div>' +
          SAFEHOME.renderStatusLegend() +
        '</div>' +
        '<div class="panel">' + unitDetailHtml(selectedHo, active, building) + '</div>' +
      '</div>';

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
    root.querySelectorAll('[data-filter-status]').forEach(function (el) {
      el.onclick = function () {
        var v = el.getAttribute('data-filter-status');
        gridFilter = (gridFilter === v) ? 'all' : v;
        render();
      };
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
    SAFEHOME.bindPanelToggles(root, panelOpenState);
  }

  function radioBtnHtml() {
    return '<a class="radio-btn" href="tel:119">' + SAFEHOME.icon2('phone') + ' 119 무전 연결</a>';
  }

  function countStatuses(units) {
    var c = { unresponded: 0, waiting: 0, moving: 0, danger: 0, safe: 0 };
    units.forEach(function (u) { c[u.status] = (c[u.status] || 0) + 1; });
    return c;
  }

  // 통계바·피드에서 쓰는 짧은 상태 이름 (STATUS_META.label은 상세 설명이라 칩에 넣기엔 길다).
  var SHORT_STATUS_LABEL = {
    danger: '구조 필요', moving: '이동 중', waiting: '세대 내 대기', safe: '대피 완료', unresponded: '미응답'
  };

  // 상단 요약 숫자 — 목업의 "아파트 대피 현황 요약"에 해당. 숫자를 누르면 그 상태로 현황판이 필터링된다.
  function ffStatBarHtml(c) {
    var order = ['danger', 'moving', 'waiting', 'safe', 'unresponded'];
    return '<div class="stat-bar">' + order.map(function (k) {
      var m = SAFEHOME.STATUS_META[k];
      var active = gridFilter === k ? ' active' : '';
      return '<button class="stat-item stat-item-btn stat-item-status-' + k + active + '" data-filter-status="' + k + '">' +
        '<div class="stat-num">' + m.icon + ' ' + (c[k] || 0) + '</div><div class="stat-label">' + SHORT_STATUS_LABEL[k] + '</div></button>';
    }).join('') + '</div>';
  }

  // 현황판 위 필터 칩 — 전체보기 + 현재 필터 해제 버튼. 실제 필터 목록은 위 통계바 숫자로 고른다.
  function filterChipsHtml(c) {
    if (gridFilter === 'all') return '';
    var m = SAFEHOME.STATUS_META[gridFilter];
    return '<div class="ff-filter-active">' + SAFEHOME.icon2('search') + ' ' + m.icon + ' ' + SHORT_STATUS_LABEL[gridFilter] + '만 보기 <button data-filter-status="' + gridFilter + '">✕ 전체보기</button></div>';
  }

  // 최근 상태가 바뀐 세대를 시간순으로 — 목업의 "입주민 신고 현황(실시간)"에 해당.
  function recentFeedPanelHtml(units) {
    var recent = units.filter(function (u) { return u.updatedAt; })
      .sort(function (a, b) { return b.updatedAt - a.updatedAt; })
      .slice(0, 6);
    var body = recent.length
      ? '<div class="ff-feed">' + recent.map(function (u) {
          var m = SAFEHOME.STATUS_META[u.status];
          return '<button class="ff-feed-item" data-select-ho="' + u.ho + '">' +
            '<span class="ff-feed-icon">' + m.icon + '</span>' +
            '<span class="ff-feed-ho">' + u.ho + '호</span>' +
            '<span class="ff-feed-label" style="color:' + m.color + ';">' + m.label + '</span>' +
            '<span class="ff-feed-time">' + SAFEHOME.fmtTime(u.updatedAt) + '</span>' +
          '</button>';
        }).join('') + '</div>'
      : '<div class="empty-note">아직 접수·갱신된 세대 현황이 없습니다.</div>';
    return SAFEHOME.detailsPanel(SAFEHOME.icon2('clock') + ' 입주민 신고 현황 (실시간)', body, { id: 'recentfeed', openState: panelOpenState.recentfeed });
  }

  var CASUALTY_FIELDS = [
    { key: 'dead', label: '사망', icon: '<span style="color:#1A1A1A;">' + SAFEHOME.icon2('dot') + '</span>' },
    { key: 'severe', label: '중상', icon: '<span style="color:var(--red);">' + SAFEHOME.icon2('dot') + '</span>' },
    { key: 'minor', label: '경상', icon: '<span style="color:var(--amber);">' + SAFEHOME.icon2('dot') + '</span>' },
    { key: 'guided', label: '피난유도 인원', icon: SAFEHOME.icon2('walking') },
    { key: 'selfEvacuated', label: '자력대피 인원', icon: SAFEHOME.icon2('running') }
  ];

  function casualtyPanelHtml(c) {
    c = c || {};
    return '<div class="panel">' +
      '<h3 class="panel-title">' + SAFEHOME.icon2('medkit') + ' 환자 · 대피 현황</h3>' +
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

  function evacuationPanelHtml(afp) {
    var body = SAFEHOME.renderAfpGrid(afp, SAFEHOME.AFP_CORE_FIELDS);
    return SAFEHOME.detailsPanel(SAFEHOME.icon2('door') + ' 피난시설 현황 (AFP-Core)', body, { id: 'evacuation', openState: panelOpenState.evacuation });
  }

  function suppressionPanelHtml(b) {
    var body = SAFEHOME.renderAfpGrid(b.suppression, SAFEHOME.AFP_SUPPRESSION_FIELDS);
    return SAFEHOME.detailsPanel(SAFEHOME.icon2('drop') + ' 소화시설 현황', body, { id: 'suppression', openState: panelOpenState.suppression });
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
        searchCard('🧱', '복도 형태', b.hallwayType + ' · ' + SAFEHOME.buildingUnitSummary(b)) +
      '</div>';
    return SAFEHOME.detailsPanel(SAFEHOME.icon2('search') + ' AFP-Search · 인명검색 특화 정보', body, { id: 'afpsearch', openState: panelOpenState.afpsearch });
  }
  function searchCard(icon, title, body) {
    return '<div class="search-card"><div class="search-card-title">' + icon + ' ' + esc(title) + '</div><div class="search-card-body">' + esc(body) + '</div></div>';
  }

  // 그리드에서 선택한 세대의 상세 정보 — 상태변경 버튼(누르면 그리드 칸 색이 함께 바뀜)과 세대 도면을 그리드 옆에 보여준다.
  function unitDetailHtml(ho, incident, building) {
    if (!ho) {
      return '<h3 class="panel-title">' + SAFEHOME.icon2('note') + ' 세대 상세</h3><div class="empty-note">왼쪽 현황판에서 세대를 선택하세요.</div>';
    }
    var u = incident.units[ho];
    if (!u) return '<h3 class="panel-title">' + SAFEHOME.icon2('note') + ' 세대 상세</h3><div class="empty-note">세대 정보를 찾을 수 없습니다.</div>';
    var meta = SAFEHOME.STATUS_META[u.status];
    var res = SAFEHOME.RESULTS[u.resultKey];
    var isDuplex = building.search.duplexUnits.indexOf(u.ho) !== -1;
    return '<h3 class="panel-title">' + SAFEHOME.icon2('note') + ' ' + (u.isFireOrigin ? SAFEHOME.icon2('flame') + ' ' : '') + ho + '호' + (isDuplex ? ' 🪜' : '') + ' 상세 <span style="color:' + meta.color + ';font-size:12.5px;">' + meta.label + '</span></h3>' +
      (u.hasVulnerable ? '<div class="tag-warn">' + SAFEHOME.icon2('alert') + ' 거동 불편자 있음 · ' + u.occupants + '인 세대</div>' : '<div class="tag-info">' + u.occupants + '인 세대</div>') +
      (res ? '<div class="ff-plan">' + SAFEHOME.icon2('note') + ' 입주민 안내: ' + res.icon + ' ' + esc(res.title) + '</div>' : '<div class="ff-plan">' + SAFEHOME.icon2('note') + ' 아직 대피 판정 없음 · 직접 확인 필요</div>') +
      '<div class="ff-actions">' +
        '<button data-action="safe" data-ho="' + u.ho + '" class="safe">' + SAFEHOME.STATUS_META.safe.icon + ' 구조 완료<small>현황판 녹색 반영</small></button>' +
        '<button data-action="moving" data-ho="' + u.ho + '">' + SAFEHOME.STATUS_META.moving.icon + ' 이동 유도 중<small>대체 대피시설로 안내</small></button>' +
        '<button data-action="danger" data-ho="' + u.ho + '" class="danger">' + SAFEHOME.STATUS_META.danger.icon + ' 위험 재확인<small>연기유입·대피불가</small></button>' +
        '<button data-action="unresponded" data-ho="' + u.ho + '" class="muted">' + SAFEHOME.STATUS_META.unresponded.icon + ' 연락 두절<small>응답 없음으로 표시</small></button>' +
      '</div>' +
      '<div class="ff-floorplan-box">' + SAFEHOME.renderUnitFloorplan(SAFEHOME.store.getEffectiveAfp(u, building.core), isDuplex) + '</div>';
  }

  SAFEHOME.Firefighter = { mount: mount, unmount: unmount };

}(window.SAFEHOME = window.SAFEHOME || {}));
