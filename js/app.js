/* SAFE-HOME · app.js
   역할(입주민/119 상황실/소방대원) 전환, 공통 크롬(상단바/진행바/SOS 버튼) 제어, 서비스워커 등록. */
(function (SAFEHOME) {
  'use strict';

  var currentRole = 'resident';
  var viewRoot, topbar, topbarLoc, progressWrap, progressFill, sosFab, roleTabs;

  // 링크(URL)에 담긴 role에 따라 접근 가능한 화면을 제한한다.
  // ?role=resident → 입주민 화면만 / ?role=situation → 상황실+소방대원 / ?role=firefighter → 소방대원만
  // role 파라미터가 없으면(기본 접속 주소) 가장 안전한 기본값인 입주민 화면만 허용한다.
  var ROLE_ACCESS = {
    resident: ['resident'],
    situation: ['situation', 'firefighter'],
    firefighter: ['firefighter'],
    admin: ['admin'],
    facility: ['facility']
  };
  var allowedRoles = ['resident'];

  var MODULES = {
    resident: { mount: function (el) { SAFEHOME.Resident.mount(el); }, unmount: function () {} },
    situation: { mount: function (el) { SAFEHOME.Situation.mount(el); }, unmount: function () { SAFEHOME.Situation.unmount(); } },
    firefighter: { mount: function (el) { SAFEHOME.Firefighter.mount(el); }, unmount: function () { SAFEHOME.Firefighter.unmount(); } },
    admin: { mount: function (el) { SAFEHOME.Admin.mount(el); }, unmount: function () { SAFEHOME.Admin.unmount(); } },
    facility: { mount: function (el) { SAFEHOME.FacilityEdit.mount(el); }, unmount: function () { SAFEHOME.FacilityEdit.unmount(); } }
  };

  function parseUrlParams() {
    var params = new URLSearchParams(location.search);
    return {
      role: params.get('role'), apt: params.get('apt'), dong: params.get('dong'),
      incident: params.get('incident'), building: params.get('building')
    };
  }

  // 보안: 링크 자체에 만료시각을 박아두지 않고, 그 링크가 가리키는 사건의 "현재" 유효시간을
  // 매번 store에서 조회해 판단한다. 그래야 관리자가 "유효시간 연장"을 누르면 이미 배포된
  // 같은 링크가 재발급 없이도 곧바로 다시 유효해진다.
  function isLinkExpired(urlParams) {
    var now = Date.now();
    if (urlParams.role === 'firefighter' && urlParams.incident) {
      var inc = SAFEHOME.store.getIncident(urlParams.incident);
      return !!inc && now > inc.firefighterLinkExp;
    }
    if (urlParams.role === 'resident' && urlParams.apt && urlParams.dong) {
      var building = SAFEHOME.findBuildingByAddress(urlParams.apt, urlParams.dong);
      var inc2 = building ? SAFEHOME.store.findOpenIncidentForBuilding(building.id) : null;
      return !!inc2 && now > inc2.residentLinkExp;
    }
    return false;
  }

  function init() {
    viewRoot = document.getElementById('view-root');
    topbar = document.getElementById('topbar');
    topbarLoc = document.getElementById('topbarLoc');
    progressWrap = document.getElementById('progressWrap');
    progressFill = document.getElementById('progressFill');
    sosFab = document.getElementById('sosFab');
    roleTabs = document.getElementById('roleTabs');

    var urlParams = parseUrlParams();

    if (isLinkExpired(urlParams)) {
      showExpiredScreen();
      return;
    }

    allowedRoles = ROLE_ACCESS[urlParams.role] || ['resident'];
    if (urlParams.apt || urlParams.dong) {
      // 관리자가 발급한 링크로 들어온 경우 — 아파트/동을 잠그고 세대(호)만 입력받는다.
      SAFEHOME.urlLockedAddress = { apt: urlParams.apt || '', dong: urlParams.dong || '' };
      SAFEHOME.store.setLocation({ apt: urlParams.apt || '', dong: urlParams.dong || '', ho: SAFEHOME.store.getState().location.ho });
    }
    if (urlParams.incident) SAFEHOME.urlIncidentId = urlParams.incident;
    if (urlParams.building) SAFEHOME.urlBuildingId = urlParams.building;

    roleTabs.querySelectorAll('.role-tab').forEach(function (btn) {
      var r = btn.getAttribute('data-role');
      if (allowedRoles.indexOf(r) === -1) {
        btn.parentNode.removeChild(btn);
      } else {
        btn.addEventListener('click', function () { switchRole(r); });
      }
    });
    // 접근 가능한 화면이 하나뿐이면 굳이 탭을 보여줄 필요가 없다.
    if (allowedRoles.length <= 1) roleTabs.style.display = 'none';

    var resetBtn = document.getElementById('resetDemoBtn');
    if (resetBtn) resetBtn.addEventListener('click', function () {
      if (confirm('데모 데이터를 초기 상태로 되돌릴까요? (모든 세대 상태가 초기화됩니다)')) {
        SAFEHOME.store.reset();
        SAFEHOME.toast('데모 데이터를 초기화했습니다.');
        switchRole(allowedRoles[0]);
      }
    });
    initTheme();

    SAFEHOME.store.subscribe(function () { refreshBadges(); updateChrome(); });
    switchRole(allowedRoles[0]);
    refreshBadges();
    registerServiceWorker();
  }

  function switchRole(role) {
    if (!MODULES[role] || allowedRoles.indexOf(role) === -1) role = allowedRoles[0];
    MODULES[currentRole].unmount();
    currentRole = role;
    document.getElementById('app').classList.toggle('wide', role !== 'resident');
    roleTabs.querySelectorAll('.role-tab').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-role') === role);
    });
    viewRoot.innerHTML = '';
    MODULES[role].mount(viewRoot);
    updateChrome();
  }

  function updateChrome() {
    var state = SAFEHOME.store.getState();
    if (currentRole === 'resident') {
      var loc = state.location;
      topbarLoc.textContent = (loc.apt || loc.dong || loc.ho) ? SAFEHOME.locText(loc) : '';
    } else {
      var openCount = SAFEHOME.store.listIncidents().filter(function (i) { return !i.closed; }).length;
      topbarLoc.textContent = openCount ? openCount + '건 진행 중' : '사건 위치 미확정';
    }
    if (currentRole === 'resident') {
      sosFab.style.display = 'block';
      topbar.style.display = 'flex';
    } else {
      sosFab.style.display = 'none';
      topbar.style.display = 'flex';
      progressWrap.style.display = 'none';
    }
  }

  // resident.js에서 질문 단계가 바뀔 때 호출 — 상단 진행바/타이틀을 갱신한다.
  function setResidentProgress(step) {
    if (currentRole !== 'resident') return;
    if (step === 0) {
      progressWrap.style.display = 'none';
    } else if (step === 'result') {
      progressWrap.style.display = 'block';
      progressFill.style.width = '100%';
    } else if (step === 'panic') {
      progressWrap.style.display = 'block';
      // 진행률은 그대로 유지 — 패닉 안내는 별도 단계로 치지 않는다.
    } else {
      progressWrap.style.display = 'block';
      progressFill.style.width = (((step - 1) / SAFEHOME.QUESTION_ORDER.length) * 100) + '%';
    }
    updateChrome();
  }

  function refreshBadges() {
    var incidents = SAFEHOME.store.listIncidents().filter(function (i) { return !i.closed; });
    var reported = 0, danger = 0;
    incidents.forEach(function (inc) {
      SAFEHOME.store.getUnits(inc.id).forEach(function (u) {
        if (u.status !== 'unresponded') reported++;
        if (u.status === 'danger') danger++;
      });
    });
    var pending = SAFEHOME.store.getPendingReports().length;
    setBadge('badge-situation', pending + reported);
    setBadge('badge-firefighter', danger);
  }
  function setBadge(id, n) {
    var el = document.getElementById(id);
    if (!el) return;
    if (n > 0) { el.textContent = n; el.style.display = 'inline-flex'; }
    else { el.style.display = 'none'; }
  }

  var THEME_KEY = 'safehome_theme';
  function initTheme() {
    var appEl = document.getElementById('app');
    var btn = document.getElementById('themeToggleBtn');
    var dark = localStorage.getItem(THEME_KEY) === 'dark';
    applyTheme(dark);
    if (btn) btn.addEventListener('click', function () {
      dark = !appEl.classList.contains('dark');
      applyTheme(dark);
      try { localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light'); } catch (e) {}
    });
  }
  function applyTheme(dark) {
    var appEl = document.getElementById('app');
    var btn = document.getElementById('themeToggleBtn');
    appEl.classList.toggle('dark', dark);
    if (btn) btn.textContent = dark ? '☀️' : '🌙';
  }

  function showExpiredScreen() {
    document.getElementById('roleTabs').style.display = 'none';
    document.getElementById('progressWrap').style.display = 'none';
    document.getElementById('sosFab').style.display = 'none';
    document.getElementById('topbar').style.display = 'flex';
    document.getElementById('topbarLoc').textContent = '';
    document.getElementById('view-root').innerHTML =
      '<div class="start-screen">' +
        '<div class="start-emoji">⏱</div>' +
        '<div class="start-title">이 링크는 만료되었습니다</div>' +
        '<div class="start-sub">보안을 위해 관리자가 발급한 링크는 일정 시간이 지나면 자동으로 접속이 차단됩니다.<br>관리자에게 유효시간 연장 또는 새 링크 발급을 요청해주세요.</div>' +
        '<a href="tel:119" class="start-btn" style="display:block;text-align:center;text-decoration:none;box-sizing:border-box;">📞 119로 전화하기</a>' +
      '</div>';
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
      navigator.serviceWorker.register('sw.js').catch(function () { /* 오프라인 지원은 선택 기능이므로 실패해도 무시 */ });
    }
  }

  SAFEHOME.app = { setResidentProgress: setResidentProgress, refreshBadges: refreshBadges, switchRole: switchRole };

  document.addEventListener('DOMContentLoaded', init);

}(window.SAFEHOME = window.SAFEHOME || {}));
