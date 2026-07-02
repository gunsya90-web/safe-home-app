/* SAFE-HOME · store.js
   입주민 / 119 상황실 / 소방대원 화면이 공유하는 중앙 상태 저장소.

   핵심 원칙: 입주민이 신고 화면에서 입력하는 아파트명·동·호는 "본인이 말한 위치(자기 신고)"일 뿐,
   그 자체가 곧바로 공식 사건 위치가 되지는 않는다. 신고는 우선 reports[]에 쌓이고,
   119 상황실이 등록된 건물 디렉터리(BUILDINGS)에서 해당 동을 찾아 "사건 위치로 확정"해야
   비로소 세대 현황판(units)과 건물 AFP 정보가 채워지고, 그 결과가 소방대원 화면에 노출된다.
   (실제 서비스에서는 이 계층이 서버 WebSocket/파이어베이스 등으로 대체된다.) */
(function (SAFEHOME) {
  'use strict';

  var STORAGE_KEY = 'safehome_v3_state';
  var listeners = new Set();
  var channel = null;
  try { channel = new BroadcastChannel('safehome-sync'); } catch (e) { channel = null; }

  function reportKey(apt, dong, ho) {
    return [apt || '', dong || '', ho || ''].join('|');
  }
  SAFEHOME.reportKey = reportKey;

  function statusFromResultKey(key, isFireOrigin) {
    if (isFireOrigin) return 'danger';
    switch (key) {
      case 'A': return 'moving';   // 계단 대피 중
      case 'B': return 'waiting';  // 세대 내 대기
      case 'C': return 'waiting';  // 대피공간 대기
      case 'D': return 'moving';   // 하향식 피난구 이동 중
      case 'E': return 'moving';   // 경량칸막이 이동 중
      case 'G': return 'moving';   // 옥상 이동 중
      case 'F': return 'danger';   // 구조 필요
      default: return 'waiting';
    }
  }

  function defaultState() {
    // 데모 시연을 위해 "자동화재탐지설비 신호"로 들어온 최초 미확정 신고 1건을 미리 채워둔다.
    var seedKey = reportKey('행복아파트', '101', SAFEHOME.DEFAULT_FIRE_ORIGIN_HO);
    var seedReports = {};
    seedReports[seedKey] = {
      key: seedKey, apt: '행복아파트', dong: '101', ho: SAFEHOME.DEFAULT_FIRE_ORIGIN_HO,
      answers: null, resultKey: null, urgency: 'critical',
      notes: ['자동화재탐지설비(스프링클러) 작동 신호 수신 — 입주민 미신고'],
      status: 'danger', occupants: 2, hasVulnerable: true,
      matched: false, auto: true, updatedAt: Date.now()
    };

    return {
      incident: { confirmed: false, buildingId: null, apt: '', dong: '', officialHo: null, confirmedAt: null },
      reports: seedReports,
      units: {},
      afp: {},
      location: { apt: '', dong: '', ho: '' },
      dispatch: { dispatched: false, dispatchedAt: null },
      dispatchNote: '',
      updatedAt: Date.now()
    };
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && parsed.incident && parsed.reports) return parsed;
      }
    } catch (e) { /* 저장된 값이 없거나 손상된 경우 기본값 사용 */ }
    return defaultState();
  }

  var state = load();

  function persist() {
    state.updatedAt = Date.now();
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* 용량 초과 등은 무시 */ }
  }

  function notify() {
    listeners.forEach(function (fn) {
      try { fn(state); } catch (e) { console.error('[SAFE-HOME store listener]', e); }
    });
  }

  function commit() {
    persist();
    notify();
    if (channel) { try { channel.postMessage({ type: 'sync', at: state.updatedAt }); } catch (e) {} }
  }

  window.addEventListener('storage', function (e) {
    if (e.key === STORAGE_KEY && e.newValue) {
      try { state = JSON.parse(e.newValue); notify(); } catch (err) { /* 무시 */ }
    }
  });
  if (channel) {
    channel.onmessage = function () { state = load(); notify(); };
  }

  function ensureUnit(ho, isFireOrigin) {
    if (!state.units[ho]) {
      var floor = parseInt(ho.length > 2 ? ho.slice(0, -2) : ho, 10) || 0;
      state.units[ho] = {
        ho: ho, floor: floor, unitIndex: 0, isFireOrigin: !!isFireOrigin,
        status: isFireOrigin ? 'danger' : 'unresponded',
        resultKey: null, answers: null, urgency: isFireOrigin ? 'critical' : null, notes: [], updatedAt: null,
        occupants: 1, hasVulnerable: false
      };
    }
    return state.units[ho];
  }

  // 신고 하나를 현재 확정된 사건(있다면)에 반영한다. 주소가 일치하지 않으면 세대 현황판에는 반영되지 않는다.
  function syncReportToUnit(key) {
    var r = state.reports[key];
    if (!r) return;
    var matched = state.incident.confirmed && SAFEHOME.addrEquals(r.apt, r.dong, state.incident.apt, state.incident.dong) && !!r.ho;
    r.matched = matched;
    if (!matched) return;
    var unit = ensureUnit(r.ho, r.ho === state.incident.officialHo);
    unit.answers = r.answers;
    unit.resultKey = r.resultKey;
    unit.urgency = r.urgency;
    unit.notes = r.notes || [];
    unit.occupants = r.occupants;
    unit.hasVulnerable = r.hasVulnerable;
    unit.updatedAt = r.updatedAt;
    unit.status = unit.isFireOrigin ? (r.status === 'safe' ? 'safe' : 'danger') : r.status;
  }

  var store = {
    getState: function () { return state; },

    subscribe: function (fn) {
      listeners.add(fn);
      return function unsubscribe() { listeners.delete(fn); };
    },

    // ---------------- 입주민 ----------------
    setLocation: function (loc) {
      state.location = Object.assign({}, state.location, loc);
      commit();
    },

    setAfp: function (afpPartial) {
      state.afp = Object.assign({}, state.afp, afpPartial);
      commit();
    },

    // 입주민의 신고/진행상황 제출. 등록된 사건과 주소가 일치할 때만 세대 현황판에 반영된다.
    submitReport: function (payload) {
      var key = reportKey(payload.apt, payload.dong, payload.ho);
      var existing = state.reports[key];
      var occupants = (existing && existing.occupants) || payload.occupants || ((Math.random() > 0.7) ? 2 : 1);
      var hasVulnerable = existing && existing.hasVulnerable !== undefined
        ? existing.hasVulnerable
        : (payload.hasVulnerable !== undefined ? payload.hasVulnerable : Math.random() > 0.85);
      state.reports[key] = {
        key: key, apt: payload.apt, dong: payload.dong, ho: payload.ho,
        answers: payload.answers, resultKey: payload.resultKey, urgency: payload.urgency, notes: payload.notes || [],
        status: statusFromResultKey(payload.resultKey, false),
        occupants: occupants, hasVulnerable: hasVulnerable,
        matched: false, auto: false, updatedAt: Date.now()
      };
      syncReportToUnit(key);
      commit();
      return key;
    },

    getReport: function (key) { return state.reports[key]; },
    getReportByAddress: function (apt, dong, ho) { return state.reports[reportKey(apt, dong, ho)]; },

    getPendingReports: function () {
      return Object.keys(state.reports).map(function (k) { return state.reports[k]; })
        .filter(function (r) { return !r.matched; })
        .sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });
    },

    // 신고자 자신이 "대피 완료"를 눌렀을 때 — 확정 여부와 무관하게 항상 동작해야 한다.
    markSafeByAddress: function (apt, dong, ho) {
      var key = reportKey(apt, dong, ho);
      var r = state.reports[key];
      if (r) { r.status = 'safe'; r.updatedAt = Date.now(); syncReportToUnit(key); }
      if (state.incident.confirmed && SAFEHOME.addrEquals(apt, dong, state.incident.apt, state.incident.dong) && ho) {
        var unit = ensureUnit(ho);
        unit.status = 'safe';
        unit.updatedAt = Date.now();
      }
      commit();
    },

    // ---------------- 119 종합상황실 ----------------
    // 신고 큐의 특정 신고를 근거로 등록된 건물을 찾아 사건 위치로 확정한다.
    confirmIncidentFromReport: function (key, buildingId) {
      var report = state.reports[key];
      var building = SAFEHOME.BUILDINGS[buildingId];
      if (!report || !building) return;
      store.setIncidentBuilding(buildingId, report.ho);
    },

    // 건물 + 최초 신고 세대를 직접 지정해 사건을 확정/재확정한다.
    setIncidentBuilding: function (buildingId, officialHo) {
      var building = SAFEHOME.BUILDINGS[buildingId];
      if (!building) return;
      state.incident = {
        confirmed: true, buildingId: buildingId, apt: building.apt, dong: building.dong,
        officialHo: officialHo || null, confirmedAt: Date.now()
      };
      state.units = SAFEHOME.generateUnits(building, officialHo || null);
      state.afp = Object.assign({}, building.core);
      Object.keys(state.reports).forEach(syncReportToUnit);
      commit();
    },

    // 오확정 정정용 — 사건을 다시 미확정 상태로 되돌린다.
    clearIncident: function () {
      state.incident = { confirmed: false, buildingId: null, apt: '', dong: '', officialHo: null, confirmedAt: null };
      state.units = {};
      Object.keys(state.reports).forEach(function (k) { state.reports[k].matched = false; });
      commit();
    },

    getUnit: function (ho) { return state.units[ho]; },
    getUnits: function () {
      return Object.keys(state.units)
        .map(function (ho) { return state.units[ho]; })
        .sort(function (a, b) { return b.floor - a.floor || (a.unitIndex - b.unitIndex); });
    },

    dispatch: function () {
      state.dispatch = { dispatched: true, dispatchedAt: Date.now() };
      commit();
    },

    setDispatchNote: function (text) {
      state.dispatchNote = text || '';
      commit();
    },

    // ---------------- 현장 소방대원 ----------------
    firefighterSetStatus: function (ho, status) {
      var unit = ensureUnit(ho);
      unit.status = status;
      unit.updatedAt = Date.now();
      unit.firefighterTouched = true;
      commit();
    },

    reset: function () {
      state = defaultState();
      commit();
    }
  };

  SAFEHOME.store = store;

}(window.SAFEHOME = window.SAFEHOME || {}));
