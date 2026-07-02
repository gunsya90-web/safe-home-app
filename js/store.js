/* SAFE-HOME · store.js
   입주민 / 119 상황실 / 소방대원 화면이 공유하는 중앙 상태 저장소.
   localStorage에 영속시키고, 같은 브라우저의 다른 탭에는 'storage' 이벤트와
   BroadcastChannel로 변경을 전파해 "실시간 공유"를 데모한다.
   (실제 서비스에서는 이 계층이 서버 WebSocket/파이어베이스 등으로 대체된다.) */
(function (SAFEHOME) {
  'use strict';

  var STORAGE_KEY = 'safehome_v2_state';
  var listeners = new Set();
  var channel = null;
  try { channel = new BroadcastChannel('safehome-sync'); } catch (e) { channel = null; }

  function defaultState() {
    return {
      location: { apt: SAFEHOME.BUILDING.apt, dong: SAFEHOME.BUILDING.dong, ho: '' },
      afp: Object.assign({}, SAFEHOME.AFP_CORE),
      units: SAFEHOME.generateUnits(),
      dispatch: { dispatched: false, dispatchedAt: null },
      updatedAt: Date.now()
    };
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && parsed.units && parsed.afp) return parsed;
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

  function ensureUnit(ho) {
    if (!state.units[ho]) {
      var floor = parseInt(ho.length > 2 ? ho.slice(0, -2) : ho, 10) || 0;
      state.units[ho] = {
        ho: ho, floor: floor, unitIndex: 0, isFireOrigin: false, status: 'unresponded',
        resultKey: null, answers: null, urgency: null, notes: [], updatedAt: null,
        occupants: 1, hasVulnerable: false
      };
    }
    return state.units[ho];
  }

  var store = {
    getState: function () { return state; },

    subscribe: function (fn) {
      listeners.add(fn);
      return function unsubscribe() { listeners.delete(fn); };
    },

    setLocation: function (loc) {
      state.location = Object.assign({}, state.location, loc);
      commit();
    },

    setAfp: function (afpPartial) {
      state.afp = Object.assign({}, state.afp, afpPartial);
      commit();
    },

    getUnit: function (ho) { return state.units[ho]; },
    getUnits: function () {
      return Object.keys(state.units)
        .map(function (ho) { return state.units[ho]; })
        .sort(function (a, b) { return b.floor - a.floor || (a.unitIndex - b.unitIndex); });
    },

    recordResidentResult: function (ho, payload) {
      var unit = ensureUnit(ho);
      unit.answers = payload.answers;
      unit.resultKey = payload.resultKey;
      unit.urgency = payload.urgency;
      unit.notes = payload.notes || [];
      unit.status = statusFromResultKey(payload.resultKey, unit.isFireOrigin);
      unit.updatedAt = Date.now();
      commit();
    },

    markUnitSafe: function (ho) {
      var unit = ensureUnit(ho);
      unit.status = 'safe';
      unit.updatedAt = Date.now();
      commit();
    },

    dispatch: function () {
      state.dispatch = { dispatched: true, dispatchedAt: Date.now() };
      commit();
    },

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
