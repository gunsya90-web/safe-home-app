/* SAFE-HOME · rules.js
   입주민 답변 + AFP-Core 정보를 근거로 7가지 대피 행동(A~G)을 판정하는 규칙 엔진.
   판정 근거는 note[]에 남겨 119 상황실/소방대원 화면에서도 "왜 이 결론인지" 확인할 수 있게 한다. */
(function (SAFEHOME) {
  'use strict';

  // 1차 개선으로 복도/계단 안전여부(Q4)가 없어져, 현관 밖 상태(Q3)만으로 대피 경로 안전성을 판단한다.
  var DOOR_BLOCKED = ['문밖화염있음'];
  var DOOR_CAUTION = ['문밖연기있음', '모르겠다'];

  /**
   * @param {object} a 질문 답변 { q1, q2, q3, q5 }
   * @param {object} afp AFP-Core 정보 (true/false/null)
   * @returns {{key:string, urgency:string, notes:string[]}}
   */
  SAFEHOME.RULE_VERSION = '2026-09-review-1';
  function decide(a, afp) {
    afp = afp || {};
    var notes = [], severe = a.q2 === '많음또는화염';
    var unknown = a.q2 === '모르겠음' || a.q1 === '모름' || a.q4 === '모름';
    var urgency = severe || a.q3 === '문밖화염있음' ? 'critical' : 'medium';
    function result(key) { return { key: key, urgency: urgency, notes: notes, needsVerification: unknown }; }
    // 소방청 공동주택 매뉴얼: 다른 곳 화재·세대 내 연기/화염 없음은 상황을 살피며 대기.
    if (['같은층', '아래층', '위층'].indexOf(a.q1) >= 0 && a.q2 === '없음') {
      notes.push('다른 곳에서 화재 발생 · 세대 내 연기/화염 없음 → 방송과 상황 변화를 확인하며 대기');
      return result('B');
    }
    if (a.q3 === '가능하다' && a.q4 === '지상안전') {
      notes.push('현관 통과 가능 · 지상까지 복도/계단 경로가 안전하다고 응답');
      return result('A');
    }
    if (a.q5 === '위' && a.q3 === '가능하다' && a.q4 === '옥상안전' && afp.roofEvacuation === true) {
      notes.push('신고자가 화점층보다 위 · 옥상까지 경로와 출입 가능 확인 응답');
      return result('G');
    }
    notes.push('대피 경로 안전을 확인하지 못했거나 이동이 어려움');
    if (afp.inUnitShelter === true) { notes.push('등록정보: 세대 내 대피공간 설치'); return result('C'); }
    if (afp.downwardEvacuationHatch === true) { notes.push('등록정보: 하향식 피난구 설치 · 아래 세대 상태 확인 필요'); return result('D'); }
    if (afp.lightPartition === true) { notes.push('등록정보: 경량칸막이 설치 · 이동 가능 여부 확인 필요'); return result('E'); }
    var fields = ['inUnitShelter', 'downwardEvacuationHatch', 'lightPartition'];
    notes.push(fields.every(function(k){return afp[k] === false;}) ? '등록정보: 대체 시설 미설치' : '시설정보가 미확인입니다. 미설치로 단정하지 않습니다.');
    return result('F');
  }
  SAFEHOME.decide = decide;

  // ---------------------------------------------------------------------
  // 결과 콘텐츠 (A~G)
  // ---------------------------------------------------------------------
  SAFEHOME.RESULTS = {
    A: {
      icon: SAFEHOME.icon2('running'), cls: 'r-go', title: '즉시 계단으로 대피하세요',
      sub: '응답한 경로 상태를 기준으로 한 안내입니다. 이동 중 상황 변화와 현장 안내를 확인하세요.',
      summary: ['엘리베이터 금지, 계단 이용', '낮은 자세로 이동', '밖으로 나간 뒤 119에 위치 알림'],
      cards: [
        { type: 'safe', h: SAFEHOME.icon2('check') + ' 행동 요령', items: [
          '문을 열기 전, 손등으로 문 손잡이의 온도를 확인하세요',
          '연기를 피해 자세를 낮추고 코와 입을 젖은 천으로 막으세요',
          '엘리베이터는 절대 사용하지 말고 계단을 이용하세요',
          '대피 시 현관문은 닫되 잠그지 마세요',
          '건물 밖으로 나가면 지정된 대피 장소로 이동하세요'
        ]},
        { type: 'warn', h: SAFEHOME.icon2('alert') + ' 주의사항', items: [
          '이동 중 연기가 심해지면 가까운 세대나 대피공간으로 피신하세요',
          '낮은 자세를 유지하며 벽을 짚고 이동하세요'
        ]}
      ]
    },
    B: {
      icon: SAFEHOME.icon2('home'), cls: 'r-wait', title: '세대 내에서 대기하세요',
      sub: '집 안으로 연기·화염이 들어오지 않는다는 응답 기준입니다. 방송과 화재 상황 변화를 계속 확인하세요.',
      summary: ['현관문·창문 틈 막기', '창문 쪽에서 구조 요청', '119에 동·호수와 세대 내 대기 알림'],
      cards: [
        { type: 'safe', h: SAFEHOME.icon2('check') + ' 행동 요령', items: [
          '현관문과 창문 틈을 젖은 수건으로 막아 연기 유입을 차단하세요',
          '방문·창문을 닫고 연기 유입과 상황 변화를 확인하세요',
          '베란다나 창문 쪽에서 구조대에게 위치를 알리세요 (소리, 손전등, 밝은 천)',
          '낮은 자세를 유지하고 호흡을 안정시키세요'
        ]},
        { type: 'warn', h: SAFEHOME.icon2('phone') + ' 지금 바로', items: [
          '119에 전화하여 정확한 호실과 현재 상태를 다시 알려주세요',
          '아래 통화 버튼을 눌러 상황실과 연결하세요'
        ]}
      ]
    },
    C: {
      icon: SAFEHOME.icon2('shield'), cls: 'r-wait', title: '세대 내 대피공간으로 이동하세요',
      sub: '복도 이동이 위험할 수 있습니다. 방화구획된 대피공간을 우선 활용하세요.',
      summary: ['대피공간으로 이동', '문을 닫고 연기 차단', '119에 대피공간 위치 알림'],
      cards: [
        { type: 'safe', h: SAFEHOME.icon2('check') + ' 행동 요령', items: [
          '세대 내 대피공간(방화구획된 별도 공간)으로 이동해 문을 닫으세요',
          '대피공간 안에서는 외부와 연결된 환기구를 확인하고 그 앞에서 대기하세요',
          '연기가 잦아들거나 구조대가 도착하면 안내에 따라 이동하세요'
        ]},
        { type: 'info', h: SAFEHOME.icon2('phone') + ' 지금 바로', items: ['119에 대피공간으로 이동했음을 알려주세요'] }
      ],
      howto: {
        title: SAFEHOME.icon2('shield') + ' 대피공간 이용 방법',
        steps: [
          { icon: 'shelter', desc: '발코니 또는 별도 구획된 대피공간 문 위치를 확인하세요 (통상 내화구조로 별도 표시됨)' },
          { icon: 'step1', desc: '대피공간 안으로 들어가 문을 완전히 닫으세요' },
          { icon: 'sos', desc: '환기구 또는 창 쪽에서 119에 현재 위치를 다시 알리세요' }
        ]
      }
    },
    D: {
      icon: SAFEHOME.icon2('arrowDown'), cls: 'r-info', title: '하향식 피난구로 아래 세대로 이동하세요',
      sub: '세대 내 대피공간·경량칸막이가 없고, 하향식 피난구가 설치된 경우 사용할 수 있습니다.',
      summary: ['하향식 피난구 위치 확인', '아래 세대로 천천히 이동', '119에 이동 위치 알림'],
      cards: [
        { type: 'safe', h: SAFEHOME.icon2('check') + ' 행동 요령', items: [
          '하향식 피난구 덮개를 열고 사다리 또는 피난 장치를 확인하세요',
          '아래 세대 상황을 확인한 뒤 한 명씩 천천히 이동하세요',
          '이동 후 문을 닫고 119에 현재 위치를 다시 알리세요'
        ]},
        { type: 'warn', h: SAFEHOME.icon2('alert') + ' 주의사항', items: [
          '아래 세대에 연기·화염이 있으면 무리하게 사용하지 마세요',
          '영유아·노약자는 보호자 도움 없이 단독 사용하지 않도록 하세요'
        ]}
      ],
      howto: {
        title: SAFEHOME.icon2('arrowDown') + ' 하향식 피난구 사용 방법',
        steps: [
          { icon: 'step1', desc: '발코니 또는 대피공간 바닥의 하향식 피난구 위치를 확인하세요' },
          { icon: 'step2', desc: '덮개를 열고 사다리(또는 피난 장치)를 아래 세대로 내려 안전하게 이동하세요' },
          { icon: 'sos', desc: '아래 세대로 이동한 뒤 119에 이동 위치를 다시 알리세요' }
        ]
      }
    },
    E: {
      icon: SAFEHOME.icon2('door'), cls: 'r-wait', title: '경량칸막이로 옆 세대로 대피하세요',
      sub: '현관으로 나가기 어려운 상황입니다. 발코니 경량칸막이를 이용해 옆 세대로 이동하세요.',
      summary: ['발코니 경량칸막이 파괴', '옆 세대로 이동', '119에 이동 경로 알림'],
      cards: [
        { type: 'warn', h: SAFEHOME.icon2('alert') + ' 주의사항', items: [
          '경량칸막이가 없는 구조라면 대피공간에서 대기하며 구조를 요청하세요',
          '옆 세대로 이동 후에도 그 집 현관 상태를 먼저 확인하세요'
        ]}
      ],
      howto: {
        title: SAFEHOME.icon2('door') + ' 경량칸막이 대피 방법',
        steps: [
          { icon: 'partition', desc: '발코니의 얇은 석고보드 칸막이 위치를 확인하세요 (보통 발코니 끝쪽에 있습니다)' },
          { icon: 'step1', desc: '발이나 둔탁한 물건으로 칸막이를 강하게 쳐서 구멍을 내세요' },
          { icon: 'step2', desc: '옆 세대 발코니로 이동한 후 그 집 현관을 통해 계단으로 대피하세요' }
        ]
      }
    },
    F: {
      icon: SAFEHOME.icon2('signal'), cls: 'r-danger', title: '구조 요청 후 대기하세요',
      sub: '대피 경로가 매우 위험한 상황입니다. 위치를 정확히 알리고 구조를 기다리세요.',
      summary: ['화장실/창문 쪽으로 이동', '젖은 수건으로 문틈 차단', '119와 계속 통화하며 구조 대기'],
      cards: [
        { type: 'safe', h: SAFEHOME.icon2('check') + ' 행동 요령', items: [
          '화장실(욕실)로 이동해 문을 닫고 물을 틀어 두세요',
          '문틈을 젖은 수건으로 막아 연기 유입을 최소화하세요',
          '창문이나 베란다에서 밝은 천, 손전등으로 신호를 보내세요',
          '낮은 자세를 유지하며 침착하게 호흡하세요'
        ]},
        { type: 'warn', h: SAFEHOME.icon2('phone') + ' 지금 바로', items: [
          '119에 정확한 동·호수와 현재 상태를 다시 한번 알려주세요',
          '아래 통화 버튼으로 상황실과 직접 통화하세요'
        ]}
      ]
    },
    G: {
      icon: SAFEHOME.icon2('building'), cls: 'r-info', title: '상황에 따라 옥상 대피를 검토하세요',
      sub: '화재 지점이 더 낮은 층입니다. 아래로 대피가 어렵다면 옥상 대피도 고려할 수 있습니다.',
      summary: ['아래 대피가 가능한지 먼저 확인', '불가능하면 옥상 이동', '옥상에서 신호 보내기'],
      cards: [
        { type: 'safe', h: SAFEHOME.icon2('check') + ' 행동 요령', items: [
          '먼저 계단으로 아래층 대피가 가능한지 다시 확인하세요',
          '아래로 대피가 불가능할 때만 옥상으로 이동하세요',
          '옥상 이동 중에도 자세를 낮추고 연기를 피하세요'
        ]}
      ],
      howto: {
        title: SAFEHOME.icon2('building') + ' 옥상 대피 시 유의사항',
        steps: [
          { icon: 'roof', desc: '옥상 출입문이 평소 잠겨있지 않은지 확인하고, 옥상으로 이동 시에도 자세를 낮추세요' },
          { icon: 'step1', desc: '옥상에 도착하면 출입문을 닫아 연기 유입을 막고, 바람 방향의 반대편에서 대기하세요' },
          { icon: 'sos', desc: '밝은 옷가지나 손전등으로 신호를 보내 구조대가 위치를 확인할 수 있도록 하세요' }
        ]
      }
    }
  };

  // ---------------------------------------------------------------------
  // 119 전달문 / 가족 공유 문구 생성
  // ---------------------------------------------------------------------
  function locText(loc) {
    if (!loc) return '위치 미입력';
    var parts = [];
    if (loc.apt) parts.push(loc.apt);
    if (loc.dong) parts.push(String(loc.dong).replace(/동$/, '') + '동');
    if (loc.ho) parts.push(String(loc.ho).replace(/호$/, '') + '호');
    return parts.length ? parts.join(' ') : '위치 미입력';
  }
  SAFEHOME.locText = locText;

  function make119Message(key, answers, afp, loc) {
    var r = SAFEHOME.RESULTS[key] || SAFEHOME.RESULTS.B;
    var f = SAFEHOME.AFP_CORE_FIELDS;
    var afpLine = f.map(function (x) {
      return x.label + ' ' + ynTextSafe(afp, x);
    }).join(', ');
    return [
      '[SAFE-HOME 화재상황]',
      '위치: ' + locText(loc),
      '현재 판단: ' + r.title,
      'AFP: ' + afpLine,
      '화재위치: ' + (answers.q1 || '-'),
      '집 안 연기/화염: ' + (answers.q2 || '-'),
      '현관 대피: ' + (answers.q3 || '-'),
      '화점 대비 위치: ' + (answers.q5 || '-'),
      '구조 또는 안내가 필요합니다.'
    ].join('\n');
  }
  function ynTextSafe(afp, field) {
    var v = afp ? afp[field.key] : undefined;
    return SAFEHOME.ynText(v === undefined ? null : v, field.yes, field.no);
  }
  SAFEHOME.make119Message = make119Message;

}(window.SAFEHOME = window.SAFEHOME || {}));
