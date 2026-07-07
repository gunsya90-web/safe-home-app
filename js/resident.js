/* SAFE-HOME · resident.js
   입주민용 화면: 시작(우리집 정보/AFP 입력) → Q1~Q5 → 결과.
   store를 통해 119 상황실/소방대원 화면과 상태를 공유한다. */
(function (SAFEHOME) {
  'use strict';

  var esc = SAFEHOME.escapeHtml;
  var root = null;
  var step = 0;           // 0=start, 1~5=질문, 'panic'=위험응답 즉시안내, 'result'=결과
  var answers = {};
  var lastResult = null;
  var pendingAfterPanic = null;
  var startAptQuery = ''; // 시작화면 "아파트명 검색"에 입력한 값 — 등록된 건물 추천 목록을 필터링하는 데 쓴다

  // 패닉 단축 경로 — 명백히 위험한 답을 고르면 나머지 질문을 다 마치기 전에 즉시 행동요령부터 보여준다.
  var PANIC_TIPS = {
    q2: { '많음또는화염': { icon: SAFEHOME.icon2('flame'), text: '지금 집 안에 연기가 많거나 화염이 보입니다. 문이 뜨겁지 않다면 신속히 대피를 시도하고, 어렵다면 화장실로 이동해 문을 닫고 젖은 수건으로 틈을 막으세요.' } },
    q3: {
      '문밖화염있음': { icon: SAFEHOME.icon2('noEntry'), text: '현관 밖에 화염이 있어 나갈 수 없습니다. 무리하게 문을 열지 말고, 대체 대피시설(대피공간·경량칸막이 등)을 확인하거나 창문에서 구조 신호를 보내세요.' }
    }
  };

  function mount(container) {
    root = container;
    step = 0;
    answers = {};
    lastResult = null;
    pendingAfterPanic = null;
    startAptQuery = '';
    render();
  }

  function loc() { return SAFEHOME.store.getState().location; }
  function afp() { var L = loc(); return SAFEHOME.store.getAfpForAddress(L.apt, L.dong); }

  function render() {
    if (!root) return;
    if (step === 0) return renderStart();
    if (step === 'result') return renderResult();
    if (step === 'panic') return renderPanicTip();
    return renderQuestion(step);
  }

  // 아파트명을 입력하면 등록된 건물 중 일치하는 동을 클릭 가능한 추천 목록으로 보여준다.
  // 브라우저 네이티브 datalist는 한글 입력 필터링이 잘 안 돼(거의 전체 목록이 뜸) 직접 구현했다.
  // 목록에서 골라도 되고, 등록되지 않은 아파트라면 그냥 직접 입력해도 신고는 그대로 저장된다(강제 아님).
  function aptSuggestionsHtml(query) {
    if (!query) return '';
    var ids = SAFEHOME.matchingBuildingIds(query).slice(0, 8);
    if (!ids.length) return '<div class="afp-note" style="margin-top:6px;">일치하는 등록 아파트가 없습니다. 그대로 직접 입력해 저장할 수 있습니다.</div>';
    return '<div class="apt-suggest-list">' + ids.map(function (id) {
      var b = SAFEHOME.BUILDINGS[id];
      return '<button type="button" class="apt-suggest-item" data-suggest-id="' + id + '">' + esc(b.apt) + ' ' + esc(b.dong) + '동</button>';
    }).join('') + '</div>';
  }
  // 추천 목록에서 하나를 고르면 검색으로 애매하게 남기지 않고 아파트명·동을 정확히 채워 넣는다
  // (직접 입력했을 때 발생하던 "동" 표기 불일치 — 예: "101" vs "101동" — 문제를 원천적으로 없앤다).
  function bindAptSuggestionClicks() {
    var box = document.getElementById('sh-apt-suggestions');
    if (!box) return;
    box.querySelectorAll('.apt-suggest-item').forEach(function (btn) {
      btn.onclick = function () {
        var b = SAFEHOME.BUILDINGS[btn.getAttribute('data-suggest-id')];
        if (!b) return;
        startAptQuery = b.apt;
        document.getElementById('sh-apt').value = b.apt;
        document.getElementById('sh-dong').value = b.dong;
        box.innerHTML = '';
        document.getElementById('sh-ho').focus();
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
        '<div class="start-title">화재 신고가 접수되었습니다</div>' +
        '<div class="start-sub">질문에 답하면 가장 안전한 대피 방법을 안내해드립니다.</div>' +

        '<div class="home-box">' + addressHtml + '</div>' +

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

    var saveLocBtn = document.getElementById('sh-save-loc');
    if (saveLocBtn) saveLocBtn.onclick = function () {
      var apt = locked ? locked.apt : document.getElementById('sh-apt').value.trim();
      var dong = locked ? locked.dong : document.getElementById('sh-dong').value.trim();
      var ho = document.getElementById('sh-ho').value.trim();
      SAFEHOME.store.setLocation({ apt: apt, dong: dong, ho: ho });
      var building = SAFEHOME.findBuildingByAddress(apt, dong);
      renderStart();
      if (building) {
        SAFEHOME.toast('우리집 정보가 저장되었습니다. 등록된 건물정보를 불러왔습니다.');
      } else {
        SAFEHOME.toast('우리집 정보가 저장되었습니다. (등록된 건물정보 없음)');
      }
      SAFEHOME.app && SAFEHOME.app.refreshBadges && SAFEHOME.app.refreshBadges();
    };
    document.getElementById('sh-start').onclick = function () { goTo(1); };
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
    if (qid === 'q3' && answers.q1 === '우리집') {
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
    var res = SAFEHOME.decide(answers, A);
    var L = loc();
    if (L.ho) {
      SAFEHOME.store.submitReport({
        apt: L.apt, dong: L.dong, ho: L.ho,
        answers: Object.assign({}, answers), resultKey: res.key, urgency: res.urgency, notes: res.notes
      });
    }
    lastResult = res;
    step = 'result';
    render();
  }

  function renderResult() {
    var key = lastResult.key;
    var r = SAFEHOME.RESULTS[key] || SAFEHOME.RESULTS.B;
    var L = loc();
    var A = afp();

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

    // 결과 화면에서는 실제 배치용 데이터가 아직 없어, "전 시설 설치" 샘플로 우리 세대에 해당하는 시설만 보여준다.
    // (대피 판단 자체는 위에서 이미 실제 A(afp)로 계산이 끝났으므로 이 표시는 그 계산에 영향을 주지 않는다.)
    var sampleAfp = SAFEHOME.SAMPLE_ALL_INSTALLED_AFP;
    var afpHtml = '<div class="afp-card"><h3>' + SAFEHOME.icon2('building') + ' 우리 세대 소방시설 · 사용법</h3>' +
      '<p style="margin:0 0 12px;color:var(--gray);font-size:12px;line-height:1.5;">시설을 눌러보면 사용 방법을 바로 확인할 수 있습니다.</p>' +
      SAFEHOME.AFP_CORE_FIELDS.filter(function (f) { return sampleAfp[f.key]; }).map(function (f) {
        var usage = SAFEHOME.FACILITY_USAGE[f.key];
        var body = usage ? '<div class="howto-steps">' + usage.steps.map(function (s) {
          return '<div class="howto-step"><div class="svgbox">' + SAFEHOME.icon(s.icon) + '</div><div class="desc">' + esc(s.desc) + '</div></div>';
        }).join('') + '</div>' : '';
        return SAFEHOME.detailsPanel(f.icon + ' ' + esc(f.label) + ' <span class="tag-ok">설치</span>', body, { closed: true });
      }).join('') +
      '</div>';

    var report = L.ho ? SAFEHOME.store.getReportByAddress(L.apt, L.dong, L.ho) : null;
    var matchHtml = '';
    var doneHtml = '';
    if (report) {
      matchHtml = report.matchedIncidentId
        ? '<div class="tag-ok" style="display:block;text-align:center;margin-bottom:14px;">' + SAFEHOME.icon2('check') + ' 119 상황실에서 위치를 확인했습니다</div>'
        : '<div class="tag-warn" style="display:block;text-align:center;margin-bottom:14px;">' + SAFEHOME.icon2('clock') + ' 119 상황실에서 신고 위치를 확인하는 중입니다</div>';
      if (report.status !== 'safe') {
        doneHtml = '<button class="utility-btn" style="width:100%;margin-bottom:14px;background:#2E7D32;" id="sh-mark-safe">' + SAFEHOME.icon2('check') + ' 대피를 완료했습니다 (상황실에 안전 알림)</button>';
      } else {
        doneHtml = '<div class="action-card safe"><h3>' + SAFEHOME.icon2('check') + ' 대피 완료로 표시되었습니다</h3><ul><li>119 상황실·소방대원 화면에 안전 상태로 반영되었습니다.</li></ul></div>';
      }
    }

    root.innerHTML =
      '<div class="result-header">' +
        '<div class="result-icon ' + r.cls + '">' + r.icon + '</div>' +
        '<div class="result-title">' + esc(r.title) + '</div>' +
        '<div class="result-sub">' + esc(r.sub) + '</div>' +
        locHtml +
      '</div>' +
      '<div class="utility-row"><button class="utility-btn secondary" id="sh-speak">' + SAFEHOME.icon2('volume') + ' 음성 안내</button><button class="utility-btn secondary" id="sh-send119">' + SAFEHOME.icon2('signal') + ' 119로 현상황 전송</button></div>' +
      matchHtml + doneHtml + summaryHtml + cardsHtml + howtoHtml + afpHtml +
      '<button class="restart-btn" id="sh-restart">처음부터 다시 진행하기</button>';

    document.getElementById('sh-send119').onclick = function () {
      if (L.ho) {
        SAFEHOME.store.submitReport({
          apt: L.apt, dong: L.dong, ho: L.ho,
          answers: Object.assign({}, answers), resultKey: key, urgency: lastResult.urgency, notes: lastResult.notes
        });
      }
      SAFEHOME.toast('119 상황실로 현재 상황을 전송했습니다.');
    };
    document.getElementById('sh-speak').onclick = function () { speak(r); };
    document.getElementById('sh-restart').onclick = function () { mount(root); };
    var markSafeBtn = document.getElementById('sh-mark-safe');
    if (markSafeBtn) markSafeBtn.onclick = function () {
      SAFEHOME.store.markSafeByAddress(L.apt, L.dong, L.ho);
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

  SAFEHOME.Resident = { mount: mount, render: render, isActive: function () { return !!root; } };

}(window.SAFEHOME = window.SAFEHOME || {}));
