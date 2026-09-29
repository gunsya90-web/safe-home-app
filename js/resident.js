/* SAFE-HOME · resident.js
   입주민용 화면: 시작(우리집 정보/AFP 입력) → Q1~Q5 → 결과.
   store를 통해 119 상황실/소방대원 화면과 상태를 공유한다. */
(function (SAFEHOME) {
  'use strict';

  var esc = SAFEHOME.escapeHtml;
  var root = null;
  var unsubscribe = null;
  var step = 0;           // 0=start, 1~5=질문, 'panic'=위험응답 즉시안내, 'result'=결과
  var answers = {};
  var lastResult = null;
  var pendingAfterPanic = null;
  var resultAfp = {}, resultIncident = null, savedReportKey = null;
  var startAptQuery = ''; // 시작화면 "아파트명 검색"에 입력한 값 — 등록된 건물 추천 목록을 필터링하는 데 쓴다

  // 패닉 단축 경로 — 명백히 위험한 답을 고르면 나머지 질문을 다 마치기 전에 즉시 행동요령부터 보여준다.
  var PANIC_TIPS = {
    q2: { '많음또는화염': { icon: SAFEHOME.icon2('flame'), text: '집 안에 연기·화염이 있다는 응답입니다. 무리하게 이동하지 말고 119에 현재 위치와 상태를 알리세요. 이동 경로와 설치된 대피시설을 이어서 확인합니다.' } },
    q3: {
      '문밖화염있음': { icon: SAFEHOME.icon2('noEntry'), text: '현관 밖에 화염이 있어 나갈 수 없습니다. 무리하게 문을 열지 말고, 대체 대피시설(대피공간·경량칸막이 등)을 확인하거나 창문에서 구조 신호를 보내세요.' }
    }
  };

  function mount(container) {
    root = container;
    if (unsubscribe) unsubscribe();
    unsubscribe = SAFEHOME.store.subscribe(function () {
      if (!root || step !== 'result' || !lastResult) return;
      if (savedReportKey) { var r = SAFEHOME.store.getReport(savedReportKey); if (r && r.incidentId) resultIncident = r.incidentId; }
      renderResult();
    });
    step = 0;
    savedReportKey = null; resultIncident = SAFEHOME.urlIncidentId || null;
    answers = {};
    lastResult = null;
    pendingAfterPanic = null;
    startAptQuery = '';
    render();
  }

  function loc() { return SAFEHOME.store.getState().location; }
  function afp() { var L = loc(); return SAFEHOME.store.getAfpForAddress(L.apt, L.dong, L.ho, resultIncident, L.buildingId); }

  function render() {
    if (!root) return;
    if (step === 0) return renderStart();
    if (step === 'result') return renderResult();
    if (step === 'panic') return renderPanicTip();
    return renderQuestion(step);
  }

  // 아파트명을 입력하면 등록된 "단지명"만 클릭 가능한 추천 목록으로 보여준다(동·호는 옆 칸에 직접
  // 입력하는 게 원래 설계였다 — 단지 하나에 동이 여러 개인 경우가 많아 특정 동만 추천에 뜨면 안 된다).
  // 브라우저 네이티브 datalist는 한글 입력 필터링이 잘 안 돼(거의 전체 목록이 뜸) 직접 구현했다.
  // 목록에서 골라도 되고, 등록되지 않은 아파트라면 그냥 직접 입력해도 신고는 그대로 저장된다(강제 아님).
  function matchingAptNames(query) {
    var names = [];
    SAFEHOME.matchingBuildingIds(query).forEach(function (id) {
      var apt = SAFEHOME.BUILDINGS[id].apt;
      if (names.indexOf(apt) === -1) names.push(apt);
    });
    return names;
  }
  function aptSuggestionsHtml(query) {
    if (!query) return '';
    var names = matchingAptNames(query).slice(0, 8);
    if (!names.length) return '<div class="afp-note" style="margin-top:6px;">일치하는 등록 아파트가 없습니다. 그대로 직접 입력해 저장할 수 있습니다.</div>';
    return '<div class="apt-suggest-list">' + names.map(function (n) {
      return '<button type="button" class="apt-suggest-item" data-suggest-name="' + esc(n) + '">' + esc(n) + '</button>';
    }).join('') + '</div>';
  }
  // 추천 목록에서 단지명을 고르면 아파트명 칸만 정확히 채워지고, 동·호는 그대로 직접 입력한다.
  function bindAptSuggestionClicks() {
    var box = document.getElementById('sh-apt-suggestions');
    if (!box) return;
    box.querySelectorAll('.apt-suggest-item').forEach(function (btn) {
      btn.onclick = function () {
        var name = btn.getAttribute('data-suggest-name');
        startAptQuery = name;
        document.getElementById('sh-apt').value = name;
        box.innerHTML = '';
        document.getElementById('sh-dong').focus();
      };
    });
  }

  // ---------------------------------------------------------------- START
  function renderStart() {
    var L = loc();
    var locked = SAFEHOME.urlLockedAddress; // 상황실이 발급한 링크로 들어온 경우 아파트/동이 고정된다.

    var addressHtml = locked
      ? '<div class="home-box-title">' + SAFEHOME.icon2('home') + ' 우리집 정보 <span style="font-size:11px;color:#6B6B6B;">동까지는 자동 지정되었습니다</span></div>' +
        '<div class="loc-pill" style="margin-bottom:10px;">' + SAFEHOME.icon2('pin') + ' ' + esc(locked.apt) + ' ' + esc(locked.dong) + '동</div>' +
        '<div class="home-inputs" style="grid-template-columns:1fr;">' +
          '<input id="sh-ho" placeholder="호 (예: 902)" value="' + esc(L.ho) + '">' +
        '</div>' +
        '<button class="save-btn" id="sh-save-loc">호수 저장</button>'
      : '<div class="home-box-title">' + SAFEHOME.icon2('home') + ' 우리집 정보 <span style="font-size:11px;color:#6B6B6B;">신고 시 알려주는 위치입니다</span></div>' +
        '<div class="home-inputs">' +
          '<input id="sh-apt" placeholder="🔎 아파트명 검색" value="' + esc(startAptQuery || L.apt) + '" autocomplete="off">' +
          '<input id="sh-dong" placeholder="동" value="' + esc(L.dong) + '">' +
          '<input id="sh-ho" placeholder="호 (예: 902)" value="' + esc(L.ho) + '">' +
        '</div>' +
        '<div id="sh-apt-suggestions">' + aptSuggestionsHtml(startAptQuery) + '</div>' +
        '<button class="save-btn" id="sh-save-loc">위치 저장</button>';

    root.innerHTML =
      '<div class="start-screen">' +
        '<div class="start-emoji">' + SAFEHOME.icon2('siren') + '</div>' +
        '<div class="start-title">현재 상황을 확인합니다</div>' +
        '<div class="start-sub">상황과 등록된 시설정보를 바탕으로 행동 안내를 확인하세요.</div>' +

        '<div class="home-box">' + addressHtml +
        (!locked ? '<label class="field-label" for="sh-building">등록 건물 선택 <span>같은 이름의 단지를 구분하세요</span></label><select id="sh-building"><option value="">직접 입력 또는 건물 선택</option>' +
        Object.values(SAFEHOME.BUILDINGS).map(function(b){return '<option value="' + esc(b.id) + '"' + (L.buildingId === b.id ? ' selected' : '') + '>' + esc(b.apt + ' ' + b.dong + '동 · ' + (b.address || b.complexCode || '데모')) + '</option>';}).join('') + '</select>' : '') +
        '<div class="home-inputs"><label class="field-label">현재 인원<input id="sh-occupants" type="number" min="1" max="100" placeholder="미확인"></label><label class="field-label">이동 지원 필요<select id="sh-vulnerable"><option value="">미확인</option><option value="true">있음</option><option value="false">없음</option></select></label></div></div>' +

        '<button class="start-btn" id="sh-start">긴급 안내 시작하기</button>' +
        '<div class="start-note">' + SAFEHOME.icon2('clock') + ' 약 30초 소요 · 언제든 119와 통화 가능</div>' +
      '</div>';

    var aptInput = document.getElementById('sh-apt');
    if (aptInput) aptInput.oninput = function () {
      startAptQuery = aptInput.value;
      var box = document.getElementById('sh-apt-suggestions');
      if (box) box.innerHTML = aptSuggestionsHtml(startAptQuery);
      bindAptSuggestionClicks();
    };
    bindAptSuggestionClicks();

    function saveInputs() {
      var choice = document.getElementById('sh-building');
      var building = choice && SAFEHOME.BUILDINGS[choice.value];
      var apt = locked ? locked.apt : building ? building.apt : document.getElementById('sh-apt').value.trim();
      var dong = locked ? locked.dong : building ? building.dong : document.getElementById('sh-dong').value.trim();
      var ho = SAFEHOME.normalizeHo(document.getElementById('sh-ho').value);
      SAFEHOME.store.setLocation({ apt: apt, dong: dong, ho: ho, buildingId: locked ? locked.buildingId : building ? building.id : null });
      answers.occupants = document.getElementById('sh-occupants').value ? Number(document.getElementById('sh-occupants').value) : null;
      var vulnerable = document.getElementById('sh-vulnerable').value;
      answers.hasVulnerable = vulnerable === '' ? null : vulnerable === 'true';
    }
    document.getElementById('sh-save-loc').onclick = function () { saveInputs(); SAFEHOME.toast('이 화면의 위치를 저장했습니다.'); };
    var buildingSelect = document.getElementById('sh-building');
    if (buildingSelect) buildingSelect.onchange = function () {
      var b = SAFEHOME.BUILDINGS[buildingSelect.value];
      if (b) { document.getElementById('sh-apt').value = b.apt; document.getElementById('sh-dong').value = b.dong; document.getElementById('sh-ho').value = ''; }
    };
    [document.getElementById('sh-apt'), document.getElementById('sh-dong')].forEach(function(el){
      if(el) el.addEventListener('input', function(){ if(buildingSelect) buildingSelect.value = ''; });
    });
    document.getElementById('sh-start').onclick = function () { saveInputs(); goTo(1); };
  }

  // ------------------------------------------------------------- QUESTION
  function renderQuestion(n) {
    var q = SAFEHOME.QUESTIONS[SAFEHOME.QUESTION_ORDER[n - 1]];
    var choices = q.options.map(function (o) {
      return '<button class="choice-btn' + (o.danger ? ' danger' : '') + '" data-value="' + esc(o.value) + '">' +
        '<span class="choice-emoji">' + o.emoji + '</span>' +
        '<span class="choice-text">' + esc(o.label) + '<span class="choice-desc">' + esc(o.desc || '') + '</span></span>' +
        '</button>';
    }).join('');

    root.innerHTML =
      '<div class="back-row">' + (n > 1 ? '<button class="back-btn" id="sh-back">← 이전</button>' : '') + '</div>' +
      '<div class="step-tag">' + esc(q.step) + '</div>' +
      '<div class="question">' + esc(q.title) + '</div>' +
      '<div class="sub">' + esc(q.sub) + '</div>' +
      '<div class="choices">' + choices + '</div>';

    var backBtn = document.getElementById('sh-back');
    if (backBtn) backBtn.onclick = function () { goTo(n - 1); };

    root.querySelectorAll('.choice-btn').forEach(function (btn) {
      btn.onclick = function () { answer(q.id, btn.getAttribute('data-value')); };
    });

    updateChrome(n);
  }

  function answer(qid, value) {
    answers[qid] = value;
    if (qid === 'q1' && value === '우리집') {
      // 화재가 우리 집일 때는 '화점 대비 위치'를 물을 필요가 없다.
      answers.q5 = '같은층';
    }

    var tip = PANIC_TIPS[qid] && PANIC_TIPS[qid][value];
    if (tip) {
      pendingAfterPanic = qid;
      step = 'panic';
      render();
      window.scrollTo(0, 0);
      return;
    }
    proceedAfterAnswer(qid);
  }

  function proceedAfterAnswer(qid) {
    if (qid === 'q4' && answers.q1 === '우리집') {
      // 화재가 우리 집일 때는 '화점 대비 위치'를 물을 필요가 없다 (이미 '같은층'으로 고정됨).
      computeResult();
      return;
    }
    var order = SAFEHOME.QUESTION_ORDER;
    var nextIdx = order.indexOf(qid) + 1;
    if (nextIdx < order.length) goTo(nextIdx + 1); else computeResult();
  }

  function renderPanicTip() {
    var qid = pendingAfterPanic;
    var tip = PANIC_TIPS[qid][answers[qid]];
    root.innerHTML =
      '<div class="start-screen">' +
        '<div class="result-icon r-danger" style="margin:0 auto 16px;">' + tip.icon + '</div>' +
        '<div class="start-title">지금 즉시 확인하세요</div>' +
        '<div class="start-sub">' + esc(tip.text) + '</div>' +
        '<a href="tel:119" class="start-btn" style="display:block;text-align:center;text-decoration:none;box-sizing:border-box;margin-bottom:10px;">' + SAFEHOME.icon2('phone') + ' 119 바로 전화하기</a>' +
        '<button class="restart-btn" id="sh-panic-continue" style="width:100%;">나머지 질문 계속하기 →</button>' +
      '</div>';
    document.getElementById('sh-panic-continue').onclick = function () {
      var q = pendingAfterPanic;
      pendingAfterPanic = null;
      proceedAfterAnswer(q);
    };
    updateChrome('panic');
  }

  function goTo(n) {
    step = n;
    render();
    window.scrollTo(0, 0);
  }

  // --------------------------------------------------------------- RESULT
  function computeResult() {
    var A = afp();
    resultAfp = Object.assign({}, A);
    var res = SAFEHOME.decide(answers, A);
    var L = loc();
    if (L.apt && L.dong && L.ho) {
      savedReportKey = SAFEHOME.store.submitReport({
        apt: L.apt, dong: L.dong, ho: L.ho, buildingId: L.buildingId, incidentId: resultIncident, occupants: answers.occupants, hasVulnerable: answers.hasVulnerable,
        answers: Object.assign({}, answers), resultKey: res.key, urgency: res.urgency, notes: res.notes
      });
    }
    if (savedReportKey) { var saved = SAFEHOME.store.getReport(savedReportKey); resultIncident = saved.incidentId || null; }
    lastResult = res;
    step = 'result';
    render();
  }

  function renderResult() {
    var key = lastResult.key;
    var r = SAFEHOME.RESULTS[key] || SAFEHOME.RESULTS.B;
    var L = loc();
    var A = resultAfp;

    var summaryHtml = '<div class="summary-card"><h3>지금 해야 할 3가지</h3><ol>' +
      r.summary.map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') + '</ol></div>';

    var cardsHtml = r.cards.map(function (c) {
      return '<div class="action-card ' + c.type + '"><h3>' + c.h + '</h3><ul>' +
        c.items.map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') + '</ul></div>';
    }).join('');

    var howtoHtml = '';
    if (r.howto) {
      howtoHtml = '<div class="howto-card"><h3>' + r.howto.title + '</h3><div class="howto-steps">' +
        r.howto.steps.map(function (s) {
          return '<div class="howto-step"><div class="svgbox">' + SAFEHOME.icon(s.icon) + '</div><div class="desc">' + esc(s.desc) + '</div></div>';
        }).join('') + '</div></div>';
    }

    var locHtml = (L.apt || L.dong || L.ho) ? '<div class="loc-pill">' + SAFEHOME.icon2('pin') + ' ' + esc(SAFEHOME.locText(L)) + '</div>' : '';

    // 판정에 실제 사용한 시설 스냅샷을 표시한다. 변경 시 조용히 판정을 바꾸지 않는다.
    var sampleAfp = A;
    var afpHtml = '<div class="afp-card"><h3>' + SAFEHOME.icon2('building') + ' 우리 세대 소방시설 · 사용법</h3>' +
      '<p style="margin:0 0 12px;color:var(--gray);font-size:12px;line-height:1.5;">시설을 눌러보면 사용 방법을 바로 확인할 수 있습니다.</p>' +
      SAFEHOME.AFP_CORE_FIELDS.map(function (f) {
        var usage = SAFEHOME.FACILITY_USAGE[f.key];
        var body = usage && sampleAfp[f.key] === true ? '<div class="howto-steps">' + usage.steps.map(function (s) {
          return '<div class="howto-step"><div class="svgbox">' + SAFEHOME.icon(s.icon) + '</div><div class="desc">' + esc(s.desc) + '</div></div>';
        }).join('') + '</div>' : '';
        return SAFEHOME.detailsPanel(f.icon + ' ' + esc(f.label) + ' <span class="tag-' + (sampleAfp[f.key] === true ? 'ok' : 'warn') + '">' + esc(SAFEHOME.ynText(sampleAfp[f.key], f.yes, f.no)) + '</span>', body, { closed: true });
      }).join('') +
      '</div>';

    var report = L.ho ? SAFEHOME.store.getReportByAddress(L.apt, L.dong, L.ho, resultIncident, L.buildingId) : null;
    var matchHtml = '';
    var doneHtml = '';
    if (report) {
      matchHtml = report.matchedIncidentId
        ? '<div class="tag-ok" style="display:block;text-align:center;margin-bottom:14px;">' + SAFEHOME.icon2('check') + ' 관리자가 사건과 위치를 연결했습니다</div>'
        : '<div class="tag-warn" style="display:block;text-align:center;margin-bottom:14px;">' + SAFEHOME.icon2('clock') + ' 이 브라우저에 저장됨 · 관리자 위치 확인 전</div>';
      if (report.status !== 'safe') {
        doneHtml = '<button class="utility-btn" style="width:100%;margin-bottom:14px;background:#2E7D32;" id="sh-mark-safe">' + SAFEHOME.icon2('check') + ' 대피를 완료했습니다 (상황실에 안전 알림)</button>';
      } else {
        doneHtml = '<div class="action-card safe"><h3>' + SAFEHOME.icon2('check') + ' 대피 완료로 표시되었습니다</h3><ul><li>이 브라우저의 상황실·소방대원 화면에 알렸습니다. 현장 확인과 다르면 재확인이 필요합니다.</li></ul></div>';
      }
    }

    root.innerHTML =
      '<div class="result-header">' +
        '<div class="result-icon ' + r.cls + '">' + r.icon + '</div>' +
        '<div class="result-title">' + esc(r.title) + '</div>' +
        '<div class="result-sub">' + esc(r.sub) + '</div>' +
        locHtml +
      '</div>' +
      '<div class="utility-row"><button class="utility-btn secondary" id="sh-speak">' + SAFEHOME.icon2('volume') + ' 음성 안내</button><button class="utility-btn secondary" id="sh-send119">' + SAFEHOME.icon2('signal') + ' 이 브라우저에 상태 저장</button></div>' +
      '<div class="review-notice">판정 시점의 시설정보 기준입니다. 상황이 달라지면 질문을 다시 진행하세요. 실제 신고는 119 전화로 연결하세요.</div>' +
      (!savedReportKey ? '<div class="tag-warn">위치 미입력 또는 저장 실패로 신고가 저장되지 않았습니다.</div>' : '') +
      matchHtml + doneHtml + summaryHtml + cardsHtml + howtoHtml + afpHtml +
      '<button class="restart-btn" id="sh-restart">처음부터 다시 진행하기</button>';

    document.getElementById('sh-send119').onclick = function () {
      if (JSON.stringify(afp()) !== JSON.stringify(resultAfp)) { SAFEHOME.toast('시설정보가 변경되었습니다. 질문을 다시 진행해 현재 정보로 확인해주세요.'); return; }
      var saved = SAFEHOME.store.submitReport({
        apt: L.apt, dong: L.dong, ho: L.ho, buildingId: L.buildingId, incidentId: resultIncident,
        occupants: answers.occupants, hasVulnerable: answers.hasVulnerable,
        answers: Object.assign({}, answers), resultKey: key, urgency: lastResult.urgency, notes: lastResult.notes
      });
      if (saved) { savedReportKey = saved; resultIncident = SAFEHOME.store.getReport(saved).incidentId; SAFEHOME.toast('이 브라우저에 저장했습니다. 실제 119 신고는 전화로 해주세요.'); renderResult(); }
    };
    document.getElementById('sh-speak').onclick = function () { speak(r); };
    document.getElementById('sh-restart').onclick = function () { mount(root); };
    var markSafeBtn = document.getElementById('sh-mark-safe');
    if (markSafeBtn) markSafeBtn.onclick = function () {
      if (!SAFEHOME.store.markSafeByAddress(L.apt, L.dong, L.ho, resultIncident, L.buildingId)) return;
      renderResult();
      SAFEHOME.toast('대피 완료로 알려졌습니다. 수고하셨습니다.');
    };

    updateChrome('result');
  }

  function speak(r) {
    var text = r.title + '. ' + r.summary.join('. ');
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text);
      u.lang = 'ko-KR'; u.rate = 0.95;
      speechSynthesis.speak(u);
    } else {
      SAFEHOME.toast(text);
    }
  }

  // 상단 진행바 / SOS 버튼 표시 제어는 app.js가 담당하므로 상태만 전달
  function updateChrome(current) {
    if (SAFEHOME.app && SAFEHOME.app.setResidentProgress) {
      SAFEHOME.app.setResidentProgress(current);
    }
  }

  SAFEHOME.Resident = { mount: mount, unmount: function () { if (unsubscribe) unsubscribe(); root = null; }, render: render, isActive: function () { return !!root; } };

}(window.SAFEHOME = window.SAFEHOME || {}));
