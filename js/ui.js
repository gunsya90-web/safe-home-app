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
          return '<button class="' + cls + '" data-select-ho="' + u.ho + '" ' +
            'title="' + u.ho + '호 · ' + meta.label + '">' +
            (u.isFireOrigin ? '🔥' : '') + '<span class="occ-ho">' + u.ho + '</span></button>';
        }).join('');
      return '<div class="occ-row"><div class="occ-floor">' + f + 'F</div><div class="occ-cells">' + cells + '</div></div>';
    }).join('');
    return '<div class="occ-grid">' + rows + '</div>';
  };

  SAFEHOME.renderStatusLegend = function () {
    return '<div class="legend-row">' + Object.keys(SAFEHOME.STATUS_META).map(function (k) {
      var m = SAFEHOME.STATUS_META[k];
      return '<span class="legend-item"><span class="legend-dot status-' + k + '"></span>' + m.label + '</span>';
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
