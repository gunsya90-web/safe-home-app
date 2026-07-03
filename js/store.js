/* SAFE-HOME · store.js
   입주민 / 119 상황실 / 소방대원 화면이 공유하는 중앙 상태 저장소.

   핵심 원칙 1: 입주민이 신고 화면에서 입력하는 아파트명·동·호는 "본인이 말한 위치(자기 신고)"일 뿐,
   그 자체가 곧바로 공식 사건 위치가 되지는 않는다. 신고는 우선 reports[]에 쌓이고,
   119 상황실이 등록된 건물 디렉터리(BUILDINGS)에서 해당 동을 찾아 "사건 위치로 확정"해야
   비로소 세대 현황판(units)과 건물 AFP 정보가 채워지고, 그 결과가 소방대원 화면에 노출된다.

   핵심 원칙 2: 사건은 동시에 여러 건 존재할 수 있다(incidents는 목록). 상황실은 여러 확정된 사건을
   전환하며 관리하고, 소방대원은 자신이 배정된 사건(또는 상황실이 지정한 사건)만 본다.
   (실제 서비스에서는 이 계층이 서버 WebSocket/파이어베이스 등으로 대체된다.) */
(function (SAFEHOME) {
  'use strict';

  var STORAGE_KEY = 'safehome_v4_state';
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

  function newIncidentId() {
    return 'inc-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
  }

  function makeCasualties() {
    return { dead: 0, severe: 0, minor: 0, guided: 0, selfEvacuated: 0 };
  }

  function makeIncident(building, officialHo) {
    return {
      id: newIncidentId(),
      buildingId: building.id, apt: building.apt, dong: building.dong,
      officialHo: officialHo || null, confirmedAt: Date.now(), closed: false,
      units: SAFEHOME.generateUnits(building, officialHo || null),
      afp: Object.assign({}, building.core),
      dispatch: { dispatched: false, dispatchedAt: null },
      dispatchNote: '',
      casualties: makeCasualties()
    };
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
      matchedIncidentId: null, auto: true, updatedAt: Date.now()
    };

    return {
      incidents: {},
      activeIncidentId: null,
      reports: seedReports,
      location: { apt: '', dong: '', ho: '' },
      correctionRequests: [],
      actionLog: [],
      updatedAt: Date.now()
    };
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && parsed.incidents && parsed.reports) return parsed;
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

  function logAction(actor, action) {
    state.actionLog = state.actionLog || [];
    state.actionLog.unshift({ actor: actor, action: action, at: Date.now() });
    if (state.actionLog.length > 200) state.actionLog.length = 200;
  }

  function getIncident(id) { return id ? state.incidents[id] : null; }
  function activeIncident() { return getIncident(state.activeIncidentId); }

  function ensureUnit(incident, ho, isFireOrigin) {
    if (!incident.units[ho]) {
      var floor = parseInt(ho.length > 2 ? ho.slice(0, -2) : ho, 10) || 0;
      incident.units[ho] = {
        ho: ho, floor: floor, unitIndex: 0, isFireOrigin: !!isFireOrigin,
        status: isFireOrigin ? 'danger' : 'unresponded',
        resultKey: null, answers: null, urgency: isFireOrigin ? 'critical' : null, notes: [], updatedAt: null,
        occupants: 1, hasVulnerable: false
      };
    }
    return incident.units[ho];
  }

  // 신고 하나를, 주소가 일치하는 확정된 사건(있다면)에 반영한다.
  // 여러 사건이 동시에 열려 있을 수 있으므로 apt+dong이 일치하는 첫 번째 사건을 찾는다.
  function syncReportToIncident(key) {
    var r = state.reports[key];
    if (!r) return;
    var matchedId = null;
    Object.keys(state.incidents).forEach(function (id) {
      if (matchedId) return;
      var inc = state.incidents[id];
      if (!inc.closed && SAFEHOME.addrEquals(r.apt, r.dong, inc.apt, inc.dong) && r.ho) matchedId = id;
    });
    r.matchedIncidentId = matchedId;
    if (!matchedId) return;
    var inc = state.incidents[matchedId];
    var unit = ensureUnit(inc, r.ho, r.ho === inc.officialHo);
    unit.answers = r.answers;
    unit.resultKey = r.resultKey;
    unit.urgency = r.urgency;
    unit.notes = r.notes || [];
    unit.occupants = r.occupants;
    unit.hasVulnerable = r.hasVulnerable;
    unit.updatedAt = r.updatedAt;
    unit.status = unit.isFireOrigin ? (r.status === 'safe' ? 'safe' : 'danger') : r.status;
  }

  function resyncAllReports() {
    Object.keys(state.reports).forEach(syncReportToIncident);
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

    // 입주민이 보는 "우리집" 기준 AFP는 그 주소와 일치하는 사건이 있으면 그 사건 값을, 없으면 건물 등록정보 기본값을 쓴다.
    // (입주민 화면은 store.setAfp를 직접 호출하지 않고, 결과 계산 시 이 값을 그대로 넘겨받아 쓴다.)
    getAfpForAddress: function (apt, dong) {
      var found = null;
      Object.keys(state.incidents).forEach(function (id) {
        var inc = state.incidents[id];
        if (!found && SAFEHOME.addrEquals(apt, dong, inc.apt, inc.dong)) found = inc.afp;
      });
      if (found) return found;
      var building = SAFEHOME.findBuildingByAddress(apt, dong);
      return building ? building.core : {};
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
        matchedIncidentId: null, auto: false, updatedAt: Date.now()
      };
      syncReportToIncident(key);
      commit();
      return key;
    },

    getReport: function (key) { return state.reports[key]; },
    getReportByAddress: function (apt, dong, ho) { return state.reports[reportKey(apt, dong, ho)]; },

    getPendingReports: function () {
      return Object.keys(state.reports).map(function (k) { return state.reports[k]; })
        .filter(function (r) { return !r.matchedIncidentId; })
        .sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });
    },

    // 신고자 자신이 "대피 완료"를 눌렀을 때 — 확정 여부와 무관하게 항상 동작해야 한다.
    markSafeByAddress: function (apt, dong, ho) {
      var key = reportKey(apt, dong, ho);
      var r = state.reports[key];
      if (r) { r.status = 'safe'; r.updatedAt = Date.now(); syncReportToIncident(key); }
      logAction('입주민', ho + '호 대피 완료 알림');
      commit();
    },

    // 소방시설 현황 수정 요청 — 입주민은 직접 수정할 수 없고 요청만 남긴다.
    submitCorrectionRequest: function (payload) {
      state.correctionRequests = state.correctionRequests || [];
      state.correctionRequests.push({
        id: 'cr-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        apt: payload.apt, dong: payload.dong, ho: payload.ho, text: payload.text,
        resolved: false, createdAt: Date.now()
      });
      logAction('입주민', (payload.ho || '') + '호에서 시설정보 수정 요청');
      commit();
    },
    getCorrectionRequests: function () { return (state.correctionRequests || []).slice().reverse(); },
    resolveCorrectionRequest: function (id) {
      var r = (state.correctionRequests || []).find(function (x) { return x.id === id; });
      if (r) { r.resolved = true; logAction('119 상황실', '수정 요청 처리: ' + r.text); commit(); }
    },

    getActionLog: function () { return state.actionLog || []; },

    // ---------------- 119 종합상황실 (다중 사건) ----------------
    listIncidents: function () {
      return Object.keys(state.incidents).map(function (id) { return state.incidents[id]; })
        .sort(function (a, b) { return (b.confirmedAt || 0) - (a.confirmedAt || 0); });
    },
    getIncident: function (id) { return getIncident(id); },
    getActiveIncident: function () { return activeIncident(); },
    setActiveIncident: function (id) {
      if (state.incidents[id]) { state.activeIncidentId = id; commit(); }
    },

    // 같은 건물(apt+dong)로 이미 열려있는(닫히지 않은) 사건이 있으면 그걸 재사용하고, 없으면 새로 만든다.
    findOpenIncidentForBuilding: function (buildingId) {
      var found = null;
      Object.keys(state.incidents).forEach(function (id) {
        var inc = state.incidents[id];
        if (!found && !inc.closed && inc.buildingId === buildingId) found = inc;
      });
      return found;
    },

    // 신고 큐의 특정 신고를 근거로 등록된 건물을 찾아 새 사건(또는 기존 열린 사건)을 확정한다.
    confirmIncidentFromReport: function (key, buildingId) {
      var report = state.reports[key];
      var building = SAFEHOME.BUILDINGS[buildingId];
      if (!report || !building) return;
      store.setIncidentBuilding(buildingId, report.ho);
    },

    // 건물 + 최초 신고 세대로 새 사건을 확정한다. 같은 건물의 열린 사건이 있으면 그 사건을 갱신한다.
    setIncidentBuilding: function (buildingId, officialHo) {
      var building = SAFEHOME.BUILDINGS[buildingId];
      if (!building) return;
      var existing = store.findOpenIncidentForBuilding(buildingId);
      var incident;
      if (existing) {
        incident = existing;
        if (officialHo) incident.officialHo = officialHo;
        incident.confirmedAt = Date.now();
      } else {
        incident = makeIncident(building, officialHo);
        state.incidents[incident.id] = incident;
      }
      state.activeIncidentId = incident.id;
      resyncAllReports();
      logAction('119 상황실', '사건 위치 확정: ' + building.apt + ' ' + building.dong + '동' + (officialHo ? ' (' + officialHo + '호 기준)' : '') + (existing ? ' (기존 사건 갱신)' : ' (신규 사건)'));
      commit();
    },

    // 오확정 정정용 — 활성 사건을 종료(닫음) 처리한다. 세대 기록은 이력으로 남기고 목록에서는 제외한다.
    closeActiveIncident: function () {
      var inc = activeIncident();
      if (!inc) return;
      inc.closed = true;
      Object.keys(state.reports).forEach(function (k) {
        if (state.reports[k].matchedIncidentId === inc.id) state.reports[k].matchedIncidentId = null;
      });
      var remaining = store.listIncidents().filter(function (i) { return !i.closed; });
      state.activeIncidentId = remaining.length ? remaining[0].id : null;
      logAction('119 상황실', inc.apt + ' ' + inc.dong + '동 사건 종료');
      commit();
    },

    adjustCasualty: function (key, delta, incidentId) {
      var inc = getIncident(incidentId) || activeIncident();
      if (!inc) return;
      inc.casualties = inc.casualties || makeCasualties();
      var cur = inc.casualties[key] || 0;
      inc.casualties[key] = Math.max(0, cur + delta);
      commit();
    },

    getUnit: function (ho, incidentId) {
      var inc = getIncident(incidentId) || activeIncident();
      return inc ? inc.units[ho] : null;
    },
    getUnits: function (incidentId) {
      var inc = getIncident(incidentId) || activeIncident();
      if (!inc) return [];
      return Object.keys(inc.units).map(function (ho) { return inc.units[ho]; })
        .sort(function (a, b) { return b.floor - a.floor || (a.unitIndex - b.unitIndex); });
    },

    // 세대(라인)별 AFP 예외 — 건물 전체 기본값과 다른 시설현황을 특정 세대에만 적용한다.
    // override는 전체 상태를 그대로 대체한다(부분 병합 아님) — 폼에서 "건물 기본값 사용"으로 되돌리면 그 필드는 사라져야 하기 때문.
    setUnitAfpOverride: function (ho, override, incidentId) {
      var inc = getIncident(incidentId) || activeIncident();
      if (!inc) return;
      var unit = ensureUnit(inc, ho);
      unit.afpOverride = override || {};
      logAction('119 상황실', ho + '호 시설현황 예외 ' + (Object.keys(unit.afpOverride).length ? '등록' : '해제'));
      commit();
    },
    getEffectiveAfp: function (unit, incidentAfp) {
      return Object.assign({}, incidentAfp, (unit && unit.afpOverride) || {});
    },

    dispatch: function (incidentId) {
      var inc = getIncident(incidentId) || activeIncident();
      if (!inc) return;
      inc.dispatch = { dispatched: true, dispatchedAt: Date.now() };
      logAction('119 상황실', inc.apt + ' ' + inc.dong + '동 출동 지령');
      commit();
    },

    setDispatchNote: function (text, incidentId) {
      var inc = getIncident(incidentId) || activeIncident();
      if (!inc) return;
      inc.dispatchNote = text || '';
      logAction('119 상황실', inc.apt + ' ' + inc.dong + '동 — 소방대원에게 메모 전달');
      commit();
    },

    // ---------------- 현장 소방대원 ----------------
    firefighterSetStatus: function (ho, status, incidentId) {
      var inc = getIncident(incidentId) || activeIncident();
      if (!inc) return;
      var unit = ensureUnit(inc, ho);
      unit.status = status;
      unit.updatedAt = Date.now();
      unit.firefighterTouched = true;
      logAction('소방대원', ho + '호 상태를 "' + (SAFEHOME.STATUS_META[status] ? SAFEHOME.STATUS_META[status].label : status) + '"(으)로 변경');
      commit();
    },

    reset: function () {
      state = defaultState();
      commit();
    }
  };

  SAFEHOME.store = store;

}(window.SAFEHOME = window.SAFEHOME || {}));
