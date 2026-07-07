/* SAFE-HOME · ui.js
   화면 공통으로 쓰는 작은 DOM/SVG 유틸리티. 프레임워크 없이 문자열 템플릿을 사용한다. */
(function (SAFEHOME) {
  'use strict';

  function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  SAFEHOME.escapeHtml = escapeHtml;

  function fmtTime(ts) {
    if (!ts) return '-';
    var d = new Date(ts);
    return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0') + ':' + d.getSeconds().toString().padStart(2, '0');
  }
  SAFEHOME.fmtTime = fmtTime;

  var ICONS = {
    step1: '<svg viewBox="0 0 64 64"><rect x="10" y="10" width="44" height="44" rx="6" fill="none" stroke="#D7263D" stroke-width="3"/><text x="32" y="40" font-size="22" text-anchor="middle" fill="#D7263D">①</text></svg>',
    step2: '<svg viewBox="0 0 64 64"><rect x="10" y="10" width="44" height="44" rx="6" fill="none" stroke="#2E7D32" stroke-width="3"/><text x="32" y="40" font-size="22" text-anchor="middle" fill="#2E7D32">②</text></svg>',
    shelter: '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="10" width="44" height="44" rx="6" fill="#F4F9FF" stroke="#1565C0" stroke-width="3"/><path d="M32 18l14 8v14a14 14 0 0 1-28 0V26z" fill="none" stroke="#1565C0" stroke-width="3"/></svg>',
    partition: '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><rect x="28" y="6" width="6" height="52" fill="#D7263D"/><rect x="34" y="6" width="22" height="52" fill="#F0E4D8" stroke="#C9BBA8" stroke-width="2" stroke-dasharray="3 3"/><circle cx="14" cy="24" r="6" fill="#FFC785"/><rect x="10" y="30" width="10" height="14" rx="3" fill="#2E7D32"/><line x1="18" y1="40" x2="30" y2="34" stroke="#2E7D32" stroke-width="4" stroke-linecap="round"/></svg>',
    roof: '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><polyline points="8,30 32,8 56,30" fill="none" stroke="#D7263D" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/><rect x="14" y="30" width="36" height="24" fill="#F0E4D8" stroke="#C9BBA8" stroke-width="2"/><circle cx="32" cy="38" r="5" fill="#FFC785"/><rect x="28" y="44" width="8" height="10" rx="3" fill="#1565C0"/></svg>',
    sos: '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><rect x="14" y="10" width="36" height="44" rx="4" fill="#FFF8E1" stroke="#F0A500" stroke-width="3"/><circle cx="32" cy="24" r="5" fill="#FFC785"/><rect x="27" y="30" width="10" height="14" rx="3" fill="#D7263D"/><path d="M40 16 L48 8 M44 12 L52 12 M44 12 L44 4" stroke="#F0A500" stroke-width="3" stroke-linecap="round" fill="none"/></svg>'
  };
  SAFEHOME.icon = function (name) { return ICONS[name] || ICONS.step1; };

  // 인라인 라인 아이콘 세트 — 이모지 대신 쓰는 작은 벡터 아이콘. currentColor를 써서 주변 글자색을
  // 그대로 물려받으므로(색상 배지 안에서도 흰색으로 자동 표시), 배경색과 별도로 관리할 필요가 없다.
  // 대부분은 Lucide(ISC 라이선스, lucide.dev)의 공식 아이콘 path를 그대로 가져와 24x24·획굵기2로
  // 통일했다 — 손으로 그린 것보다 균형이 잡혀 있다. running/walking/smoke처럼 Lucide에 없는
  // 픽토그램(사람이 뛰는 모양 등)만 같은 스타일(24x24, 획굵기 2)로 직접 그려 넣었다.
  var ICON_SVG_OPEN = '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-0.15em;">';
  function svgIcon(inner) { return ICON_SVG_OPEN + inner + '</svg>'; }

  var ICONS2 = {
    check: svgIcon('<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>'), // lucide: circle-check
    alert: svgIcon('<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>'), // lucide: triangle-alert
    running: svgIcon('<circle cx="14.5" cy="4.7" r="1.8" fill="currentColor" stroke="none"/><path d="M9 21l2.2-5 2-2-1-4 3 1 2 3.5 3 1.5M11.2 16l-4 1.5M13.2 14l3-4.5-3.5-1-2 3"/>'), // 손으로 그림 (lucide에 대응 아이콘 없음)
    home: svgIcon('<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'), // lucide: house
    help: svgIcon('<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>'), // lucide: circle-question-mark
    phone: svgIcon('<path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384"/>'), // lucide: phone
    search: svgIcon('<path d="m21 21-4.34-4.34"/><circle cx="11" cy="11" r="8"/>'), // lucide: search
    clock: svgIcon('<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>'), // lucide: clock
    link: svgIcon('<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>'), // lucide: link
    copy: svgIcon('<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>'), // lucide: copy
    note: svgIcon('<path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z"/>'), // lucide: square-pen
    lock: svgIcon('<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'), // lucide: lock
    wrench: svgIcon('<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z"/>'), // lucide: wrench
    building: svgIcon('<path d="M10 12h4"/><path d="M10 8h4"/><path d="M14 21v-3a2 2 0 0 0-4 0v3"/><path d="M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2"/><path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"/>'), // lucide: building-2
    siren: svgIcon('<path d="M7 18v-6a5 5 0 1 1 10 0v6"/><path d="M5 21a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-1a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2z"/><path d="M21 12h1"/><path d="M18.5 4.5 18 5"/><path d="M2 12h1"/><path d="M12 2v1"/><path d="m4.929 4.929.707.707"/><path d="M12 12v6"/>'), // lucide: siren
    flame: svgIcon('<path d="M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4"/>'), // lucide: flame
    grid: svgIcon('<path d="M12 3v18"/><path d="M3 12h18"/><rect x="3" y="3" width="18" height="18" rx="2"/>'), // lucide: grid-2x2
    dot: '<svg width="1em" height="1em" viewBox="0 0 24 24" style="vertical-align:-0.1em;"><circle cx="12" cy="12" r="10" fill="currentColor"/></svg>', // lucide: circle (채워서 사용)
    walking: svgIcon('<circle cx="12.5" cy="4.5" r="1.8" fill="currentColor" stroke="none"/><path d="M10 21l1-5 1.5-1.5-.5-3.5 2.5.5 1.5 3 2 1M11 15l-3.5 2M12.5 12l2-3-3-1-1.5 2.5"/>'), // 손으로 그림 (lucide에 대응 아이콘 없음)
    medkit: svgIcon('<path d="M12 11v4"/><path d="M14 13h-4"/><path d="M16 6V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><path d="M18 6v14"/><path d="M6 6v14"/><rect width="20" height="14" x="2" y="6" rx="2"/>'), // lucide: briefcase-medical
    door: svgIcon('<path d="M11 20H2"/><path d="M11 4.562v16.157a1 1 0 0 0 1.242.97L19 20V5.562a2 2 0 0 0-1.515-1.94l-4-1A2 2 0 0 0 11 4.561z"/><path d="M11 4H8a2 2 0 0 0-2 2v14"/><path d="M14 12h.01"/><path d="M22 20h-3"/>'), // lucide: door-open
    drop: svgIcon('<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>'), // lucide: droplet
    plus: svgIcon('<path d="M5 12h14"/><path d="M12 5v14"/>'), // lucide: plus
    circleOutline: svgIcon('<circle cx="12" cy="12" r="10"/>'), // lucide: circle
    shield: svgIcon('<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>'), // lucide: shield
    arrowDown: svgIcon('<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>'), // lucide: arrow-down
    signal: svgIcon('<path d="M12 20h.01"/><path d="M2 8.82a15 15 0 0 1 20 0"/><path d="M5 12.859a10 10 0 0 1 14 0"/><path d="M8.5 16.429a5 5 0 0 1 7 0"/>'), // lucide: wifi
    noEntry: svgIcon('<circle cx="12" cy="12" r="10"/><path d="M4.929 4.929 19.07 19.071"/>'), // lucide: ban
    pin: svgIcon('<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>'), // lucide: map-pin
    volume: svgIcon('<path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"/><path d="M16 9a5 5 0 0 1 0 6"/><path d="M19.364 18.364a9 9 0 0 0 0-12.728"/>'), // lucide: volume-2
    people: svgIcon('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><path d="M16 3.128a4 4 0 0 1 0 7.744"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><circle cx="9" cy="7" r="4"/>'), // lucide: users
    arrowUp: svgIcon('<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>'), // lucide: arrow-up
    arrowRight: svgIcon('<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>'), // lucide: arrow-right
    sameFloor: svgIcon('<path d="m18 8 4 4-4 4"/><path d="M2 12h20"/><path d="m6 8-4 4 4 4"/>'), // lucide: move-horizontal
    smoke: svgIcon('<path d="M5 19c1.5 0 1.5-2 3-2s1.5 2 3 2 1.5-2 3-2 1.5 2 3 2 1.5-2 3-2"/><path d="M6 13c1.2 0 1.2-2.2 3-3.5C11 8 10 5.5 8.5 4"/><path d="M12 14c1.5-.8 2-2.6 1.2-4.3C12.3 8 13 6 15 5"/>'), // 손으로 그림 (lucide에 대응 아이콘 없음)
    gear: svgIcon('<path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/><circle cx="12" cy="12" r="3"/>'), // lucide: settings
    compass: svgIcon('<circle cx="12" cy="12" r="10"/><path d="m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z"/>'), // lucide: compass
    refresh: svgIcon('<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>'), // lucide: rotate-cw
    stop: svgIcon('<rect width="18" height="18" x="3" y="3" rx="2"/>'), // lucide: square
    sun: svgIcon('<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>'), // lucide: sun
    moon: svgIcon('<path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"/>') // lucide: moon
  };
  SAFEHOME.icon2 = function (name) { return ICONS2[name] || ''; };

  // opts.filterStatus: 지정하면 해당 상태가 아닌 셀은 흐리게(dimmed) 표시 — 목업의 "필터" 기능.
  SAFEHOME.renderOccupancyGrid = function (units, opts) {
    opts = opts || {};
    var byFloor = {};
    units.forEach(function (u) { (byFloor[u.floor] = byFloor[u.floor] || []).push(u); });
    var floors = Object.keys(byFloor).map(Number).sort(function (a, b) { return b - a; });
    var rows = floors.map(function (f) {
      var cells = byFloor[f]
        .sort(function (a, b) { return a.unitIndex - b.unitIndex; })
        .map(function (u) {
          var meta = SAFEHOME.STATUS_META[u.status] || SAFEHOME.STATUS_META.unresponded;
          var cls = 'occ-cell status-' + u.status;
          if (opts.selected === u.ho) cls += ' selected';
          if (u.isFireOrigin) cls += ' fire-origin';
          if (opts.filterStatus && opts.filterStatus !== 'all' && opts.filterStatus !== u.status) cls += ' dimmed';
          return '<button class="' + cls + '" data-select-ho="' + u.ho + '" ' +
            'title="' + u.ho + '호 · ' + meta.label + '">' +
            '<span class="occ-icon">' + (u.isFireOrigin ? SAFEHOME.icon2('flame') : meta.icon) + '</span>' + '<span class="occ-ho">' + u.ho + '</span></button>';
        }).join('');
      return '<div class="occ-row"><div class="occ-floor">' + f + 'F</div><div class="occ-cells">' + cells + '</div></div>';
    }).join('');
    return '<div class="occ-grid">' + rows + '</div>';
  };

  // 접기/펼치기 가능한 패널(아코디언). 우선순위가 낮은 참고용 패널을 이걸로 감싸면
  // 기본은 펼쳐져 있되 사용자가 접어서 화면 스크롤 길이를 줄일 수 있다.
  SAFEHOME.detailsPanel = function (titleHtml, bodyHtml, opts) {
    opts = opts || {};
    var style = opts.style ? ' style="' + opts.style + '"' : '';
    var idAttr = opts.id ? ' data-panel-id="' + opts.id + '"' : '';
    var isOpen = opts.openState !== undefined ? opts.openState : !opts.closed;
    var openAttr = isOpen ? ' open' : '';
    return '<details class="panel"' + style + idAttr + openAttr + '><summary class="panel-title">' + titleHtml + '</summary>' +
      '<div class="panel-collapsible-body">' + bodyHtml + '</div></details>';
  };

  // <details class="panel" data-panel-id="..."> 들의 접기/펼치기 상태를 렌더링 간에 기억해두기 위한 헬퍼.
  // stateObj는 호출부(situation.js/firefighter.js)가 소유한 { [id]: boolean } 객체다.
  SAFEHOME.bindPanelToggles = function (root, stateObj) {
    root.querySelectorAll('details.panel[data-panel-id]').forEach(function (d) {
      d.addEventListener('toggle', function () { stateObj[d.getAttribute('data-panel-id')] = d.open; });
    });
  };

  // 시설 설치 현황을 표(그리드)로 렌더링 — 입주민/119 상황실/소방대원 화면에서 공용으로 쓴다.
  // fields를 생략하면 피난시설(AFP_CORE_FIELDS) 기준이고, AFP_SUPPRESSION_FIELDS를 넘기면 소화시설 그리드가 된다.
  SAFEHOME.renderAfpGrid = function (afp, fields) {
    fields = fields || SAFEHOME.AFP_CORE_FIELDS;
    return '<div class="afp-grid">' + fields.map(function (f) {
      return '<div class="afp-item ' + SAFEHOME.ynClass(afp[f.key]) + '">' + f.icon + ' ' + SAFEHOME.escapeHtml(f.label) + ': ' + SAFEHOME.escapeHtml(SAFEHOME.ynText(afp[f.key], f.yes, f.no)) + '</div>';
    }).join('') + '</div>';
  };

  // 세대 내부 개략도 — 실제 세대 도면이 아니라, 등록된 AFP-Core 정보를 바탕으로 그린 설명용 스케치다.
  SAFEHOME.renderUnitFloorplan = function (afp, isDuplex) {
    var shelter = afp.inUnitShelter === true;
    var partition = afp.lightPartition === true;
    var hatch = afp.downwardEvacuationHatch === true;
    return '' +
      '<svg viewBox="0 0 320 200" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;">' +
        '<rect x="4" y="4" width="312" height="192" fill="#FAFAF8" stroke="#C9BBA8" stroke-width="3"/>' +
        // 현관
        '<rect x="4" y="150" width="46" height="46" fill="#F1F0EC" stroke="#C9BBA8" stroke-width="2"/>' +
        '<text x="27" y="177" font-size="11" text-anchor="middle" fill="#6B6B6B">현관</text>' +
        // 거실/침실 구획
        '<line x1="150" y1="4" x2="150" y2="150" stroke="#C9BBA8" stroke-width="2" stroke-dasharray="4 3"/>' +
        '<text x="90" y="90" font-size="12" text-anchor="middle" fill="#1A1A1A" font-weight="700">거실</text>' +
        '<text x="230" y="90" font-size="12" text-anchor="middle" fill="#1A1A1A" font-weight="700">침실</text>' +
        (isDuplex ? '<text x="230" y="112" font-size="10" text-anchor="middle" fill="#1565C0">🪜 복층(다락) 구조</text>' : '') +
        // 발코니
        '<rect x="4" y="4" width="312" height="34" fill="' + (partition || shelter || hatch ? '#F4F9FF' : '#F1F0EC') + '" stroke="#C9BBA8" stroke-width="2"/>' +
        '<text x="16" y="24" font-size="11" fill="#6B6B6B">발코니</text>' +
        (partition ? '<line x1="300" y1="6" x2="300" y2="36" stroke="#D7263D" stroke-width="4" stroke-dasharray="3 3"/><text x="270" y="24" font-size="10" fill="#D7263D" font-weight="700">경량칸막이</text>' : '') +
        (shelter ? '<rect x="130" y="6" width="70" height="30" fill="#E3F2FD" stroke="#1565C0" stroke-width="2"/><text x="165" y="25" font-size="10" text-anchor="middle" fill="#1565C0" font-weight="700">대피공간</text>' : '') +
        (hatch ? '<rect x="55" y="10" width="26" height="22" fill="#E8F5E9" stroke="#2E7D32" stroke-width="2"/><text x="68" y="46" font-size="10" text-anchor="middle" fill="#2E7D32" font-weight="700">하향식피난구</text>' : '') +
        (!(partition || shelter || hatch) ? '<text x="160" y="24" font-size="10" text-anchor="middle" fill="#9AA0A6">등록된 대체 대피시설 없음</text>' : '') +
      '</svg>' +
      '<div style="font-size:11px;color:var(--gray);text-align:center;margin-top:4px;">※ 실제 세대 도면이 아닌, 등록된 AFP 정보 기반 개략도입니다.</div>';
  };

  SAFEHOME.renderStatusLegend = function () {
    return '<div class="legend-row">' + Object.keys(SAFEHOME.STATUS_META).map(function (k) {
      var m = SAFEHOME.STATUS_META[k];
      return '<span class="legend-item"><span class="legend-dot status-' + k + '"></span>' + m.icon + ' ' + m.label + '</span>';
    }).join('') + '</div>';
  };

  var toastTimer = null;
  SAFEHOME.toast = function (msg) {
    var el = document.getElementById('sh-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'sh-toast';
      el.className = 'sh-toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2200);
  };

}(window.SAFEHOME = window.SAFEHOME || {}));
