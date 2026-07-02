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
  // 3. 데모 건물 / AFP-Core / AFP-Search 목업 DB
  //    실제 서비스에서는 K-apt 단지코드 API 및 소방청 AFP DB와 연동될 영역.
  // ---------------------------------------------------------------------
  var BUILDING = {
    apt: '행복아파트',
    dong: '101',
    floors: 9,          // 1층 ~ 9층
    unitsPerFloor: 4,   // 01호 ~ 04호
    hallwayType: '계단식',
    fireOriginHo: '502' // 데모 시나리오: 5층 2호에서 발화
  };
  SAFEHOME.BUILDING = BUILDING;

  SAFEHOME.AFP_CORE = {
    downwardEvacuationHatch: true,
    inUnitShelter: false,
    lightPartition: false,
    roofEvacuation: true,
    roofAutoDoor: true,
    refugeArea: false,
    airSafetyMat: true
  };

  SAFEHOME.AFP_SEARCH = {
    hoistRoomStructure: '최상층(9층) 계단실 옆 권상기실 → 옥상문. 손전등 없이는 식별 어려운 철제 사다리 있음.',
    roofAccessRoute: '9층 계단실 → 권상기실 통과 → 옥상문(차동개폐장치 설치, 자동 개방). 옥상 면적 넓어 헬기 인명구조 가능.',
    hiddenStairs: '도면 미표기 계단 없음. 101동은 단일 계단실 구조.',
    midFireDoors: '5층·8층 계단실 진입부에 방화문 2개소 — 상시 닫힘, 손잡이형.',
    duplexUnits: ['801', '901'],
    duplexNote: '801호, 901호는 복층(다락) 구조. 다락 창문으로 2차 접근로 확보 가능.',
    refugeAreaNote: '피난안전구역 미설치 — 30층 이상 대상 규정으로 본 건물(9층)은 해당 없음.',
    basementNote: '지하 1층 기계실·주차장 있음. 화재 시 차량 진입 통제 필요.'
  };

  // 세대 그리드 생성 (Live Occupancy Status 데모용)
  function buildUnitId(floor, unitIdx) {
    return String(floor) + String(unitIdx).padStart(2, '0');
  }
  SAFEHOME.buildUnitId = buildUnitId;

  function generateUnits() {
    var units = {};
    for (var f = BUILDING.floors; f >= 1; f--) {
      for (var u = 1; u <= BUILDING.unitsPerFloor; u++) {
        var ho = buildUnitId(f, u);
        units[ho] = {
          ho: ho,
          floor: f,
          unitIndex: u,
          isFireOrigin: ho === BUILDING.fireOriginHo,
          status: ho === BUILDING.fireOriginHo ? 'danger' : 'unresponded',
          resultKey: null,
          answers: null,
          urgency: ho === BUILDING.fireOriginHo ? 'critical' : null,
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
