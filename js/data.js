/* SAFE-HOME · data.js
   질문 정의, AFP-Core/AFP-Search 목업 데이터베이스, 데모용 건물 세대 그리드를 정의한다.
   흐름도(공동주택 화재 발생 시 행동 안내 흐름도 2.0) 기준으로 선택지를 구성했다. */
(function (SAFEHOME) {
  'use strict';

  // ---------------------------------------------------------------------
  // 1. 대피 질문 (흐름도 1~5단계)
  // ---------------------------------------------------------------------
  // 1차 개선 반영: Q1에서 지하주차장·공용부 제거, Q2 연기많음/화염보임 통합,
  // Q3에서 문손잡이뜨겁다·문을열수없다 제거, Q4(복도/계단 안전여부) 전체 삭제.
  SAFEHOME.QUESTIONS = {
    q1: {
      id: 'q1',
      step: '1단계 · 화재 위치 확인',
      title: '화재가 어디에서 발생했습니까?',
      sub: '현재 불이 난 위치를 선택해주세요.',
      options: [
        { value: '우리집', emoji: SAFEHOME.icon2('home'), label: '우리 집', desc: '내가 있는 세대 안에서 발생' },
        { value: '같은층', emoji: SAFEHOME.icon2('sameFloor'), label: '같은 층 다른 세대·복도', desc: '같은 층 이웃 세대 또는 복도에서 발생' },
        { value: '아래층', emoji: SAFEHOME.icon2('arrowDown'), label: '아래층', desc: '우리 집보다 아래층에서 발생' },
        { value: '위층', emoji: SAFEHOME.icon2('arrowUp'), label: '위층', desc: '우리 집보다 위층에서 발생' },
        { value: '모름', emoji: SAFEHOME.icon2('help'), label: '모름', desc: '정확한 발화 위치를 알 수 없음' }
      ]
    },
    q2: {
      id: 'q2',
      step: '2단계 · 위험 상태 확인',
      title: '우리 집 안으로 연기나 화염이 들어오고 있습니까?',
      sub: '현재 내가 있는 공간의 상태를 확인해주세요.',
      options: [
        { value: '없음', emoji: SAFEHOME.icon2('check'), label: '연기 없음', desc: '아직 집 안은 안전한 상태' },
        { value: '조금있음', emoji: SAFEHOME.icon2('smoke'), label: '연기 조금 있음', desc: '옅은 연기 냄새 또는 흐릿한 연기' },
        { value: '많음또는화염', emoji: SAFEHOME.icon2('flame'), label: '연기 많음 · 화염 보임', desc: '시야 확보가 어렵거나 불꽃이 직접 보임', danger: true },
        { value: '모르겠음', emoji: SAFEHOME.icon2('help'), label: '모르겠음', desc: '정확한 상태를 판단하기 어려움' }
      ]
    },
    q3: {
      id: 'q3',
      step: '3단계 · 현관 대피 가능 여부',
      title: '현관문 밖으로 나갈 수 있습니까?',
      sub: '문을 열기 전 손잡이 온도를 확인하고, 문 밖 복도 상태를 살펴주세요.',
      options: [
        { value: '가능하다', emoji: SAFEHOME.icon2('door'), label: '가능하다', desc: '복도에 연기·화염이 없거나 적음' },
        { value: '문밖연기있음', emoji: SAFEHOME.icon2('smoke'), label: '문 밖에 연기 있음', desc: '문을 열면 연기가 들어옴' },
        { value: '문밖화염있음', emoji: SAFEHOME.icon2('flame'), label: '문 밖에 화염 있음', desc: '문 밖에서 불꽃이 보임', danger: true },
        { value: '모르겠다', emoji: SAFEHOME.icon2('help'), label: '모르겠다', desc: '아직 확인하지 못함' }
      ]
    },
    q5: {
      id: 'q5',
      step: '4단계 · 위치 관계 확인',
      title: '신고자는 화점층보다 어디에 위치해 있습니까?',
      sub: '화재 발생 지점을 기준으로 내 위치를 선택해주세요.',
      options: [
        { value: '위', emoji: SAFEHOME.icon2('arrowUp'), label: '화재 층보다 위' },
        { value: '아래', emoji: SAFEHOME.icon2('arrowDown'), label: '화재 층보다 아래' },
        { value: '같은층', emoji: SAFEHOME.icon2('arrowRight'), label: '화재 층과 같은 층' },
        { value: '모름', emoji: SAFEHOME.icon2('help'), label: '모름' }
      ]
    }
  };
  SAFEHOME.QUESTION_ORDER = ['q1', 'q2', 'q3', 'q5'];

  // ---------------------------------------------------------------------
  // 2. AFP-Core 항목 정의 (입주민 · 119가 즉시 쓰는 행동정보)
  // ---------------------------------------------------------------------
  SAFEHOME.AFP_CORE_FIELDS = [
    { key: 'downwardEvacuationHatch', label: '하향식 피난구', icon: SAFEHOME.icon2('arrowDown'), yes: '설치', no: '미설치' },
    { key: 'inUnitShelter', label: '세대 내 대피공간', icon: SAFEHOME.icon2('shield'), yes: '설치', no: '미설치' },
    { key: 'lightPartition', label: '경량칸막이', icon: SAFEHOME.icon2('door'), yes: '설치', no: '미설치' },
    { key: 'roofEvacuation', label: '옥상 대피 가능 여부', icon: SAFEHOME.icon2('building'), yes: '가능', no: '불가능' },
    { key: 'roofAutoDoor', label: '옥상 차동개폐장치', icon: SAFEHOME.icon2('gear'), yes: '설치', no: '미설치' },
    { key: 'refugeArea', label: '피난안전구역', icon: SAFEHOME.icon2('compass'), yes: '설치', no: '미설치' },
    { key: 'airSafetyMat', label: '공기안전매트', icon: SAFEHOME.icon2('shield'), yes: '비치', no: '미비치' }
  ];

  // ---------------------------------------------------------------------
  // 2-1. 소화시설 항목 정의 (초기 진압용 — 119 상황실 · 소방대원이 참고하는 정보)
  //      피난시설(AFP_CORE_FIELDS)과 달리 입주민의 대피 판정(rules.js decide())에는 관여하지 않는다.
  // ---------------------------------------------------------------------
  SAFEHOME.AFP_SUPPRESSION_FIELDS = [
    { key: 'indoorHydrant', label: '옥내소화전', icon: SAFEHOME.icon2('drop'), yes: '설치', no: '미설치' },
    { key: 'sprinkler', label: '스프링클러', icon: SAFEHOME.icon2('drop'), yes: '설치', no: '미설치' },
    { key: 'waterSprayConnection', label: '연결살수설비', icon: SAFEHOME.icon2('drop'), yes: '설치', no: '미설치' }
  ];

  // 실제 데이터(대구 등 지역 아파트 일괄 등록)를 들여올 때, 소방시설현황·평면도는 아직 없으므로
  // 각 필드를 "확인 필요"(null) 상태로 채워둔다. 이후 관리자가 발급하는 소방시설 점검 링크로 채워진다.
  SAFEHOME.makeUnknownFacility = function (fields) {
    var obj = {};
    fields.forEach(function (f) { obj[f.key] = null; });
    return obj;
  };
  SAFEHOME.makeUnknownSearch = function () {
    return {
      hoistRoomStructure: '', roofAccessRoute: '', hiddenStairs: '', midFireDoors: '',
      duplexUnits: [], duplexNote: '등록된 정보 없음 — 현장조사 필요',
      refugeAreaNote: '등록된 정보 없음', basementNote: '등록된 정보 없음'
    };
  };

  // 건물 요약 문구 — 균일 격자(층수×세대/층) 데모 건물과, 실제 호수 목록을 그대로 들여온
  // 일괄 등록 건물(building.units) 모두를 자연스럽게 표시한다.
  SAFEHOME.buildingUnitSummary = function (b) {
    if (b.units && b.units.length) return b.floors + '층 · 총 ' + b.units.length + '세대';
    return b.floors + '층 · 세대당 ' + b.unitsPerFloor + '호';
  };

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

  // 입주민 결과화면의 "시설별 사용법" 카드는 실제 세대별 설치 데이터베이스가 아직 없으므로,
  // 전 시설이 설치된 것으로 가정한 샘플 값을 쓴다. (대피 판정 자체에는 쓰이지 않음 — 그건 각 건물의 core 값을 그대로 사용)
  SAFEHOME.SAMPLE_ALL_INSTALLED_AFP = {
    downwardEvacuationHatch: true, inUnitShelter: true, lightPartition: true,
    roofEvacuation: true, roofAutoDoor: true, refugeArea: true, airSafetyMat: true
  };

  // 소방시설별 사용법 — 입주민 결과화면에서 각 시설 카드를 클릭하면 펼쳐진다.
  SAFEHOME.FACILITY_USAGE = {
    downwardEvacuationHatch: {
      title: '⬇️ 하향식 피난구 사용 방법',
      steps: [
        { icon: 'step1', desc: '발코니 또는 대피공간 바닥의 하향식 피난구 위치를 확인하세요' },
        { icon: 'step2', desc: '덮개를 열고 사다리(또는 피난 장치)를 아래 세대로 내려 안전하게 이동하세요' },
        { icon: 'sos', desc: '아래 세대로 이동한 뒤 119에 이동 위치를 다시 알리세요' }
      ]
    },
    inUnitShelter: {
      title: '🛡️ 대피공간 이용 방법',
      steps: [
        { icon: 'shelter', desc: '발코니 또는 별도 구획된 대피공간 문 위치를 확인하세요 (통상 내화구조로 별도 표시됨)' },
        { icon: 'step1', desc: '대피공간 안으로 들어가 문을 완전히 닫으세요' },
        { icon: 'sos', desc: '환기구 또는 창 쪽에서 119에 현재 위치를 다시 알리세요' }
      ]
    },
    lightPartition: {
      title: '🚪 경량칸막이 대피 방법',
      steps: [
        { icon: 'partition', desc: '발코니의 얇은 석고보드 칸막이 위치를 확인하세요 (보통 발코니 끝쪽에 있습니다)' },
        { icon: 'step1', desc: '발이나 둔탁한 물건으로 칸막이를 강하게 쳐서 구멍을 내세요' },
        { icon: 'step2', desc: '옆 세대 발코니로 이동한 후 그 집 현관을 통해 계단으로 대피하세요' }
      ]
    },
    roofEvacuation: {
      title: '🏢 옥상 대피 시 유의사항',
      steps: [
        { icon: 'roof', desc: '옥상 출입문이 평소 잠겨있지 않은지 확인하고, 옥상으로 이동 시에도 자세를 낮추세요' },
        { icon: 'step1', desc: '옥상에 도착하면 출입문을 닫아 연기 유입을 막고, 바람 방향의 반대편에서 대기하세요' },
        { icon: 'sos', desc: '밝은 옷가지나 손전등으로 신호를 보내 구조대가 위치를 확인할 수 있도록 하세요' }
      ]
    },
    roofAutoDoor: {
      title: '⚙️ 옥상 차동개폐장치 안내',
      steps: [
        { icon: 'roof', desc: '화재로 인한 열을 감지하면 옥상문이 자동으로 열리는 장치입니다 — 별도 조작이 필요 없습니다' },
        { icon: 'step1', desc: '옥상에 도착했는데 문이 닫혀 있다면 손잡이를 밀어 여세요 (자동개방 실패 대비)' }
      ]
    },
    refugeArea: {
      title: '🧭 피난안전구역 이용 방법',
      steps: [
        { icon: 'step1', desc: '해당 층의 피난안전구역(방화구획된 대피 전용 공간)으로 이동하세요' },
        { icon: 'shelter', desc: '진입 후 문을 닫고, 소방대원의 안내가 있을 때까지 대기하세요' },
        { icon: 'sos', desc: '119에 피난안전구역으로 이동했음을 알리세요' }
      ]
    },
    airSafetyMat: {
      title: '🛟 공기안전매트 안내',
      steps: [
        { icon: 'sos', desc: '공기안전매트는 소방대원이 건물 외부에 설치하는 장비로, 입주민이 직접 조작하지 않습니다' },
        { icon: 'step1', desc: '창문이나 베란다에서 밝은 천, 손전등으로 신호를 보내 위치를 알리세요' },
        { icon: 'step2', desc: '매트 설치가 끝나면 소방대원의 안내에 따라 행동하세요 — 안내 없이 임의로 뛰어내리지 마세요' }
      ]
    }
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
      suppression: { indoorHydrant: true, sprinkler: false, waterSprayConnection: false },
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
      suppression: { indoorHydrant: true, sprinkler: true, waterSprayConnection: false },
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
      suppression: { indoorHydrant: true, sprinkler: true, waterSprayConnection: true },
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

  // 등록 건물이 대량(수백~수천 개 동)일 때 <select> 하나에 다 나열하면 찾기 힘들어서,
  // 아파트명을 먼저 검색으로 좁힌 뒤 그 아파트의 동만 골라 담은 짧은 select를 보여준다.
  // 관리자 화면(새 화재 등록·소방시설 점검 링크)과 입주민 시작화면에서 공용으로 쓴다.
  function matchingBuildingIds(query) {
    var nq = normalizeAddr(query);
    return Object.keys(SAFEHOME.BUILDINGS).filter(function (id) {
      return !nq || normalizeAddr(SAFEHOME.BUILDINGS[id].apt).indexOf(nq) !== -1;
    });
  }
  SAFEHOME.matchingBuildingIds = matchingBuildingIds;

  function buildingSelectOptionsHtml(query, selectedId) {
    var esc = SAFEHOME.escapeHtml;
    if (!query) return '<option value="">먼저 아파트명을 검색하세요</option>';
    var ids = matchingBuildingIds(query);
    if (!ids.length) return '<option value="">일치하는 아파트가 없습니다</option>';
    return '<option value="">동 선택</option>' + ids.map(function (id) {
      var b = SAFEHOME.BUILDINGS[id];
      return '<option value="' + id + '"' + (selectedId === id ? ' selected' : '') + '>' + esc(b.apt) + ' ' + esc(b.dong) + '동 (' + SAFEHOME.buildingUnitSummary(b) + ')</option>';
    }).join('');
  }
  SAFEHOME.buildingSelectOptionsHtml = buildingSelectOptionsHtml;

  // 세대 그리드 생성 (Live Occupancy Status 데모용) — 확정된 건물 기준으로 생성한다.
  function buildUnitId(floor, unitIdx) {
    return String(floor) + String(unitIdx).padStart(2, '0');
  }
  SAFEHOME.buildUnitId = buildUnitId;

  function makeUnitRecord(ho, floor, unitIndex, fireOriginHo) {
    return {
      ho: ho,
      floor: floor,
      unitIndex: unitIndex,
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

  function generateUnits(building, fireOriginHo) {
    var units = {};
    // 실제 데이터를 일괄 등록한 건물은 층마다 세대수가 균일하지 않으므로, 실제 호수 목록(building.units)이
    // 있으면 그걸 그대로 쓰고, 없으면(데모 건물) 기존 균일 격자(층수×세대/층) 방식으로 생성한다.
    if (building.units && building.units.length) {
      building.units.forEach(function (ho) {
        var floor = parseInt(ho.length > 2 ? ho.slice(0, -2) : ho, 10) || 0;
        var unitIndex = parseInt(ho.slice(-2), 10) || 0;
        units[ho] = makeUnitRecord(ho, floor, unitIndex, fireOriginHo);
      });
      return units;
    }
    for (var f = building.floors; f >= 1; f--) {
      for (var u = 1; u <= building.unitsPerFloor; u++) {
        var gridHo = buildUnitId(f, u);
        units[gridHo] = makeUnitRecord(gridHo, f, u, fireOriginHo);
      }
    }
    return units;
  }
  SAFEHOME.generateUnits = generateUnits;

  // 세대 상태 정의 (Live Occupancy Status)
  SAFEHOME.STATUS_META = {
    unresponded: { label: '미응답', color: '#9AA0A6', desc: '아직 응답이 없는 세대', icon: SAFEHOME.icon2('help') },
    waiting: { label: '대피공간 · 세대 내 대기', color: '#1565C0', desc: '실내 대기 중', icon: SAFEHOME.icon2('home') },
    moving: { label: '피난구 이용 · 이동 중', color: '#F0A500', desc: '대체 대피시설로 이동 중', icon: SAFEHOME.icon2('running') },
    danger: { label: '연기 유입 · 대피 불가', color: '#D7263D', desc: '즉시 구조가 필요한 상태', icon: SAFEHOME.icon2('alert') },
    safe: { label: '대피 완료', color: '#2E7D32', desc: '안전하게 대피 완료', icon: SAFEHOME.icon2('check') }
  };

}(window.SAFEHOME = window.SAFEHOME || {}));
