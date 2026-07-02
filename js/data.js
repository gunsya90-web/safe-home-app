/* SAFE-HOME · data.js
   질문 정의, AFP-Core/AFP-Search 목업 데이터베이스, 데모용 건물 세대 그리드를 정의한다.
   흐름도(공동주택 화재 발생 시 행동 안내 흐름도 2.0) 기준으로 선택지를 구성했다. */
(function (SAFEHOME) {
  'use strict';

  // ---------------------------------------------------------------------
  // 1. 대피 질문 (흐름도 1~5단계)
  // ---------------------------------------------------------------------
  SAFEHOME.QUESTIONS = {
    q1: {
      id: 'q1',
      step: '1단계 · 화재 위치 확인',
      title: '화재가 어디에서 발생했습니까?',
      sub: '현재 불이 난 위치를 선택해주세요.',
      options: [
        { value: '우리집', emoji: '🏠', label: '우리 집', desc: '내가 있는 세대 안에서 발생' },
        { value: '같은층', emoji: '↔️', label: '같은 층 다른 세대·복도', desc: '같은 층 이웃 세대 또는 복도에서 발생' },
        { value: '아래층', emoji: '⬇️', label: '아래층', desc: '우리 집보다 아래층에서 발생' },
        { value: '위층', emoji: '⬆️', label: '위층', desc: '우리 집보다 위층에서 발생' },
        { value: '공용부', emoji: '🅿️', label: '지하주차장 · 공용부', desc: '지하주차장, 기계실 등 공용 공간에서 발생' },
        { value: '모름', emoji: '❓', label: '모름', desc: '정확한 발화 위치를 알 수 없음' }
      ]
    },
    q2: {
      id: 'q2',
      step: '2단계 · 위험 상태 확인',
      title: '우리 집 안으로 연기나 화염이 들어오고 있습니까?',
      sub: '현재 내가 있는 공간의 상태를 확인해주세요.',
      options: [
        { value: '없음', emoji: '✅', label: '연기 없음', desc: '아직 집 안은 안전한 상태' },
        { value: '조금있음', emoji: '🌫️', label: '연기 조금 있음', desc: '옅은 연기 냄새 또는 흐릿한 연기' },
        { value: '많음', emoji: '💨', label: '연기 많음', desc: '시야 확보가 어려울 정도의 연기' },
        { value: '화염보임', emoji: '🔥', label: '화염 보임', desc: '집 안에서 불꽃이 직접 보임', danger: true },
        { value: '모르겠음', emoji: '❔', label: '모르겠음', desc: '정확한 상태를 판단하기 어려움' }
      ]
    },
    q3: {
      id: 'q3',
      step: '3단계 · 현관 대피 가능 여부',
      title: '현관문 밖으로 나갈 수 있습니까?',
      sub: '문을 열기 전 손잡이 온도를 확인하고, 문 밖 복도 상태를 살펴주세요.',
      options: [
        { value: '가능하다', emoji: '🚪', label: '가능하다', desc: '복도에 연기·화염이 없거나 적음' },
        { value: '문밖연기있음', emoji: '🌫️', label: '문 밖에 연기 있음', desc: '문을 열면 연기가 들어옴' },
        { value: '문밖화염있음', emoji: '🔥', label: '문 밖에 화염 있음', desc: '문 밖에서 불꽃이 보임', danger: true },
        { value: '문손잡이뜨겁다', emoji: '🌡️', label: '문 · 손잡이가 뜨겁다', desc: '문 반대편에 화염이 있을 가능성', danger: true },
        { value: '문을열수없다', emoji: '⛔', label: '문을 열 수 없다', desc: '변형되었거나 걸려서 열리지 않음', danger: true },
        { value: '모르겠다', emoji: '❔', label: '모르겠다', desc: '아직 확인하지 못함' }
      ]
    },
    q4: {
      id: 'q4',
      step: '4단계 · 복도/계단 안전 여부',
      title: '계단이나 복도에 연기·화염이 있습니까?',
      sub: '대피 경로의 안전 상태를 다시 한번 확인해주세요.',
      options: [
        { value: '없다', emoji: '✅', label: '없다', desc: '계단·복도가 비교적 깨끗함' },
        { value: '있다', emoji: '🌫️', label: '있다', desc: '연기 또는 화염으로 이동이 위험함', danger: true },
        { value: '잘모르겠다', emoji: '❔', label: '잘 모르겠다', desc: '아직 확인하지 못함' }
      ]
    },
    q5: {
      id: 'q5',
      step: '5단계 · 위치 관계 확인',
      title: '신고자는 화점층보다 어디에 위치해 있습니까?',
      sub: '화재 발생 지점을 기준으로 내 위치를 선택해주세요.',
      options: [
        { value: '위', emoji: '⬆️', label: '화재 층보다 위' },
        { value: '아래', emoji: '⬇️', label: '화재 층보다 아래' },
        { value: '같은층', emoji: '➡️', label: '화재 층과 같은 층' },
        { value: '모름', emoji: '❓', label: '모름' }
      ]
    }
  };
  SAFEHOME.QUESTION_ORDER = ['q1', 'q2', 'q3', 'q4', 'q5'];

  // ---------------------------------------------------------------------
  // 2. AFP-Core 항목 정의 (입주민 · 119가 즉시 쓰는 행동정보)
  // ---------------------------------------------------------------------
  SAFEHOME.AFP_CORE_FIELDS = [
    { key: 'downwardEvacuationHatch', label: '하향식 피난구', icon: '⬇️', yes: '설치', no: '미설치' },
    { key: 'inUnitShelter', label: '세대 내 대피공간', icon: '🛡️', yes: '설치', no: '미설치' },
    { key: 'lightPartition', label: '경량칸막이', icon: '🚪', yes: '설치', no: '미설치' },
    { key: 'roofEvacuation', label: '옥상 대피 가능 여부', icon: '🏢', yes: '가능', no: '불가능' },
    { key: 'roofAutoDoor', label: '옥상 차동개폐장치', icon: '⚙️', yes: '설치', no: '미설치' },
    { key: 'refugeArea', label: '피난안전구역', icon: '🧭', yes: '설치', no: '미설치' },
    { key: 'airSafetyMat', label: '공기안전매트', icon: '🛟', yes: '비치', no: '미비치' }
  ];

  function ynText(v, yes, no) {
    if (v === true) return yes;
    if (v === false) return no;
    return '확인 필요';
  }
  SAFEHOME.ynText = ynText;
  SAFEHOME.ynClass = function (v) {
    if (v === true) return 'ok';
    if (v === false) return 'no';
    return 'unknown';
  };

  // ---------------------------------------------------------------------
  // 3. 등록 건물 디렉터리 (여러 단지/동) — AFP-Core / AFP-Search 목업 DB
  //    실제 서비스에서는 K-apt 단지코드 API 및 소방청 AFP DB로 사전 등록되는 영역이며,
  //    입주민이 임의로 만드는 것이 아니라 관리사무소/소방시설관리사가 미리 등록해 둔다.
  //    119 상황실은 신고가 들어오면 이 디렉터리에서 해당 건물을 찾아 "사건 위치"로 확정한다.
  // ---------------------------------------------------------------------
  SAFEHOME.BUILDINGS = {
    'happy-101': {
      id: 'happy-101', apt: '행복아파트', dong: '101',
      floors: 9, unitsPerFloor: 4, hallwayType: '계단식',
      core: {
        downwardEvacuationHatch: true, inUnitShelter: false, lightPartition: false,
        roofEvacuation: true, roofAutoDoor: true, refugeArea: false, airSafetyMat: true
      },
      search: {
        hoistRoomStructure: '최상층(9층) 계단실 옆 권상기실 → 옥상문. 손전등 없이는 식별 어려운 철제 사다리 있음.',
        roofAccessRoute: '9층 계단실 → 권상기실 통과 → 옥상문(차동개폐장치 설치, 자동 개방). 옥상 면적 넓어 헬기 인명구조 가능.',
        hiddenStairs: '도면 미표기 계단 없음. 101동은 단일 계단실 구조.',
        midFireDoors: '5층·8층 계단실 진입부에 방화문 2개소 — 상시 닫힘, 손잡이형.',
        duplexUnits: ['801', '901'],
        duplexNote: '801호, 901호는 복층(다락) 구조. 다락 창문으로 2차 접근로 확보 가능.',
        refugeAreaNote: '피난안전구역 미설치 — 30층 이상 대상 규정으로 본 건물(9층)은 해당 없음.',
        basementNote: '지하 1층 기계실·주차장 있음. 화재 시 차량 진입 통제 필요.'
      }
    },
    'happy-102': {
      id: 'happy-102', apt: '행복아파트', dong: '102',
      floors: 12, unitsPerFloor: 2, hallwayType: '복도식',
      core: {
        downwardEvacuationHatch: false, inUnitShelter: true, lightPartition: true,
        roofEvacuation: false, roofAutoDoor: false, refugeArea: false, airSafetyMat: false
      },
      search: {
        hoistRoomStructure: '최상층(12층) 중앙 복도 끝 권상기실. 이중 잠금장치 있어 소방 마스터키 필요.',
        roofAccessRoute: '옥상 대피 불가 등록 건물 — 옥상문이 상시 시건 상태로 관리되며 자동개폐장치 없음.',
        hiddenStairs: '동 측면에 관리사무소 전용 비상계단 1개소 있음 (일반 입주민 도면 미표기).',
        midFireDoors: '각 층 복도 중앙에 방화문 1개소 — 자동폐쇄장치 설치.',
        duplexUnits: [],
        duplexNote: '복층 세대 없음 (전 세대 단층 구조).',
        refugeAreaNote: '피난안전구역 미설치.',
        basementNote: '지하 2층 규모 주차장. 화재 시 차량 진입 통제 및 지하 배연 확인 필요.'
      }
    },
    'mirae-205': {
      id: 'mirae-205', apt: '미래아파트', dong: '205',
      floors: 20, unitsPerFloor: 6, hallwayType: '복도식',
      core: {
        downwardEvacuationHatch: false, inUnitShelter: false, lightPartition: false,
        roofEvacuation: true, roofAutoDoor: false, refugeArea: true, airSafetyMat: false
      },
      search: {
        hoistRoomStructure: '최상층(20층) 권상기실 2개소(A/B 라인 분리). 옥상문 수동 개방(자동개폐장치 없음).',
        roofAccessRoute: '20층 각 라인 계단실 → 권상기실 통과 → 옥상문(수동). 고층 강풍 주의.',
        hiddenStairs: '없음. A/B 라인 계단실이 명확히 분리된 구조.',
        midFireDoors: '10층·15층 피난안전구역 진입부에 방화문 각 1개소.',
        duplexUnits: [],
        duplexNote: '복층 세대 없음.',
        refugeAreaNote: '10층·15층에 피난안전구역 설치 — 각 최대 80인 수용, 완강기·공기안전매트 비치.',
        basementNote: '지하 3층 대형 주차장. 화재 시 차량 우회 진입로(후면 게이트) 확보 필요.'
      }
    }
  };
  SAFEHOME.DEFAULT_BUILDING_ID = 'happy-101'; // 데모 시나리오 기본 건물
  SAFEHOME.DEFAULT_FIRE_ORIGIN_HO = '502';     // 데모 시나리오 기본 최초 신고 세대

  function normalizeAddr(s) {
    return String(s == null ? '' : s).replace(/\s+/g, '').toLowerCase();
  }
  SAFEHOME.normalizeAddr = normalizeAddr;

  SAFEHOME.addrEquals = function (apt1, dong1, apt2, dong2) {
    return normalizeAddr(apt1) === normalizeAddr(apt2) && normalizeAddr(dong1) === normalizeAddr(dong2);
  };

  // 입주민이 입력한 아파트명/동으로 등록된 건물을 찾는다. 실제 서비스라면 K-apt 단지코드 조회로 대체된다.
  SAFEHOME.findBuildingByAddress = function (apt, dong) {
    var na = normalizeAddr(apt), nd = normalizeAddr(dong);
    if (!na && !nd) return null;
    var ids = Object.keys(SAFEHOME.BUILDINGS);
    for (var i = 0; i < ids.length; i++) {
      var b = SAFEHOME.BUILDINGS[ids[i]];
      if (normalizeAddr(b.apt) === na && normalizeAddr(b.dong) === nd) return b;
    }
    if (!nd) {
      for (var j = 0; j < ids.length; j++) {
        var b2 = SAFEHOME.BUILDINGS[ids[j]];
        if (normalizeAddr(b2.apt) === na) return b2;
      }
    }
    return null;
  };

  // 세대 그리드 생성 (Live Occupancy Status 데모용) — 확정된 건물 기준으로 생성한다.
  function buildUnitId(floor, unitIdx) {
    return String(floor) + String(unitIdx).padStart(2, '0');
  }
  SAFEHOME.buildUnitId = buildUnitId;

  function generateUnits(building, fireOriginHo) {
    var units = {};
    for (var f = building.floors; f >= 1; f--) {
      for (var u = 1; u <= building.unitsPerFloor; u++) {
        var ho = buildUnitId(f, u);
        units[ho] = {
          ho: ho,
          floor: f,
          unitIndex: u,
          isFireOrigin: ho === fireOriginHo,
          status: ho === fireOriginHo ? 'danger' : 'unresponded',
          resultKey: null,
          answers: null,
          urgency: ho === fireOriginHo ? 'critical' : null,
          notes: [],
          updatedAt: null,
          occupants: (Math.random() > 0.7) ? 2 : 1,
          hasVulnerable: Math.random() > 0.85 // 고령자/영유아 등 거동취약자 여부(데모용 랜덤)
        };
      }
    }
    return units;
  }
  SAFEHOME.generateUnits = generateUnits;

  // 세대 상태 정의 (Live Occupancy Status)
  SAFEHOME.STATUS_META = {
    unresponded: { label: '미응답', color: '#9AA0A6', desc: '아직 응답이 없는 세대' },
    waiting: { label: '대피공간 · 세대 내 대기', color: '#1565C0', desc: '실내 대기 중' },
    moving: { label: '피난구 이용 · 이동 중', color: '#F0A500', desc: '대체 대피시설로 이동 중' },
    danger: { label: '연기 유입 · 대피 불가', color: '#D7263D', desc: '즉시 구조가 필요한 상태' },
    safe: { label: '대피 완료', color: '#2E7D32', desc: '안전하게 대피 완료' }
  };

}(window.SAFEHOME = window.SAFEHOME || {}));
