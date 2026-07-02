/* SAFE-HOME · app.js
   역할(입주민/119 상황실/소방대원) 전환, 공통 크롬(상단바/진행바/SOS 버튼) 제어, 서비스워커 등록. */
(function (SAFEHOME) {
  'use strict';

  var currentRole = 'resident';
  var viewRoot, topbar, topbarLoc, progressWrap, progressFill, sosFab, roleTabs;

  var MODULES = {
    resident: { mount: function (el) { SAFEHOME.Resident.mount(el); }, unmount: function () {} },
    situation: { mount: function (el) { SAFEHOME.Situation.mount(el); }, unmount: function () { SAFEHOME.Situation.unmount(); } },
    firefighter: { mount: function (el) { SAFEHOME.Firefighter.mount(el); }, unmount: function () { SAFEHOME.Firefighter.unmount(); } }
  };

  function init() {
    viewRoot = document.getElementById('view-root');
    topbar = document.getElementById('topbar');
    topbarLoc = document.getElementById('topbarLoc');
    progressWrap = document.getElementById('progressWrap');
    progressFill = document.getElementById('progressFill');
    sosFab = document.getElementById('sosFab');
    roleTabs = document.getElementById('roleTabs');

    roleTabs.querySelectorAll('.role-tab').forEach(function (btn) {
      btn.addEventListener('click', function () { switchRole(btn.getAttribute('data-role')); });
    });
    var resetBtn = document.getElementById('resetDemoBtn');
    if (resetBtn) resetBtn.addEventListener('click', function () {
      if (confirm('데모 데이터를 초기 상태로 되돌릴까요? (모든 세대 상태가 초기화됩니다)')) {
        SAFEHOME.store.reset();
        SAFEHOME.toast('데모 데이터를 초기화했습니다.');
        switchRole('resident');
      }
    });

    SAFEHOME.store.subscribe(refreshBadges);
    switchRole('resident');
    refreshBadges();
    registerServiceWorker();
  }

  function switchRole(role) {
    if (!MODULES[role]) role = 'resident';
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
    var loc = SAFEHOME.store.getState().location;
    topbarLoc.textContent = (loc.apt || loc.dong || loc.ho) ? SAFEHOME.locText(loc) : '';
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
    } else {
      progressWrap.style.display = 'block';
      progressFill.style.width = (((step - 1) / 5) * 100) + '%';
    }
    updateChrome();
  }

  function refreshBadges() {
    var units = SAFEHOME.store.getUnits();
    var reported = units.filter(function (u) { return u.status !== 'unresponded'; }).length;
    var danger = units.filter(function (u) { return u.status === 'danger'; }).length;
    setBadge('badge-situation', reported);
    setBadge('badge-firefighter', danger);
  }
  function setBadge(id, n) {
    var el = document.getElementById(id);
    if (!el) return;
    if (n > 0) { el.textContent = n; el.style.display = 'inline-flex'; }
    else { el.style.display = 'none'; }
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
      navigator.serviceWorker.register('sw.js').catch(function () { /* 오프라인 지원은 선택 기능이므로 실패해도 무시 */ });
    }
  }

  SAFEHOME.app = { setResidentProgress: setResidentProgress, refreshBadges: refreshBadges, switchRole: switchRole };

  document.addEventListener('DOMContentLoaded', init);

}(window.SAFEHOME = window.SAFEHOME || {}));
