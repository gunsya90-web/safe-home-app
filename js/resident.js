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

  // 패닉 단축 경로 — 명백히 위험한 답을 고르면 나머지 질문을 다 마치기 전에 즉시 행동요령부터 보여준다.
  var PANIC_TIPS = {
    q2: { '화염보임': { icon: '🔥', text: '지금 집 안에 화염이 보입니다. 문이 뜨겁지 않다면 신속히 대피를 시도하고, 어렵다면 화장실로 이동해 문을 닫고 젖은 수건으로 틈을 막으세요.' } },
    q3: {
      '문밖화염있음': { icon: '⛔', text: '현관 밖에 화염이 있어 나갈 수 없습니다. 무리하게 문을 열지 말고, 대체 대피시설(대피공간·경량칸막이 등)을 확인하거나 창문에서 구조 신호를 보내세요.' },
      '문손잡이뜨겁다': { icon: '🌡️', text: '문 반대편에 화염이 있을 수 있습니다. 문을 열지 말고 대체 대피시설을 먼저 확인하세요.' },
      '문을열수없다': { icon: '⛔', text: '현관문을 열 수 없는 상황입니다. 화장실로 이동해 문을 닫고 구조를 요청하세요.' }
    },
    q4: { '있다': { icon: '🌫️', text: '복도·계단에 연기·화염이 있어 위험합니다. 무리하게 이동하지 말고 대체 경로를 먼저 확인하세요.' } }
  };

  function mount(container) {
    root = container;
    step = 0;
    answers = {};
    lastResult = null;
    pendingAfterPanic = null;
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

  // ---------------------------------------------------------------- START
  function renderStart() {
    var L = loc();
    var A = afp();
    var locked = SAFEHOME.urlLockedAddress; // 상황실이 발급한 링크로 들어온 경우 아파트/동이 고정된다.

    var addressHtml = locked
      ? '<div class="home-box-title">🏠 우리집 정보 <span style="font-size:11px;color:#6B6B6B;">동까지는 자동 지정되었습니다</span></div>' +
        '<div class="loc-pill" style="margin-bottom:10px;">📍 ' + esc(locked.apt) + ' ' + esc(locked.dong) + '동</div>' +
        '<div class="home-inputs" style="grid-template-columns:1fr;">' +
          '<input id="sh-ho" placeholder="호 (예: 902)" value="' + esc(L.ho) + '">' +
        '</div>' +
        '<button class="save-btn" id="sh-save-loc">호수 저장</button>'
      : '<div class="home-box-title">🏠 우리집 정보 <span style="font-size:11px;color:#6B6B6B;">신고 시 알려주는 위치입니다</span></div>' +
        '<div class="home-inputs">' +
          '<input id="sh-apt" placeholder="아파트명" value="' + esc(L.apt) + '">' +
          '<input id="sh-dong" placeholder="동" value="' + esc(L.dong) + '">' +
          '<input id="sh-ho" placeholder="호 (예: 902)" value="' + esc(L.ho) + '">' +
        '</div>' +
        '<button class="save-btn" id="sh-save-loc">위치 저장</button>';

    var afpDisplay = '<div class="facility-grid">' + SAFEHOME.AFP_CORE_FIELDS.map(function (f) {
      return '<div class="afp-item ' + SAFEHOME.ynClass(A[f.key]) + '" style="text-align:left;">' + f.icon + ' ' + esc(f.label) + '<br>' + esc(SAFEHOME.ynText(A[f.key], f.yes, f.no)) + '</div>';
    }).join('') + '</div>';

    root.innerHTML =
      '<div class="start-screen">' +
        '<div class="start-emoji">🚨</div>' +
        '<div class="start-title">화재 신고가 접수되었습니다</div>' +
        '<div class="start-sub">지금부터 상황에 따라 필요한 질문에 답해주세요.<br>신고자님의 상황에 맞는 <strong>가장 안전한 대피 방법</strong>을 안내해드립니다.</div>' +
        '<div class="mode-note"><strong>긴급모드</strong>: 상황별 질문에 답하면 현재 상황에 맞는 행동요령, 119 전달문, 가족 공유 문구를 바로 제공합니다. 이 신고는 119 상황실로 전달되며, <strong>정확한 사건 위치(동·호)는 상황실에서 확인 후 확정</strong>합니다.</div>' +

        '<div class="home-box">' + addressHtml + '</div>' +

        '<div class="kapt-card">' +
          '<h3>🏢 소방시설 현황 (조회 전용)</h3>' +
          '<p>소방시설 현황은 소방서가 사전 등록한 값입니다. 입주민은 직접 수정할 수 없고, 실제와 다르면 아래에서 수정 요청만 가능합니다.</p>' +
          afpDisplay +
          '<div class="kapt-actions"><button class="ghost" id="sh-lookup-afp">🔎 등록된 건물정보 다시 조회</button><button class="ghost" id="sh-request-correction">🛠 시설정보 수정 요청</button></div>' +
          '<div class="afp-note">※ 결과 안내에서 미설치·확인 필요 시설은 자동 제외하고, 가능한 대체 행동으로 판단합니다.</div>' +
        '</div>' +

        '<button class="start-btn" id="sh-start">긴급 안내 시작하기</button>' +
        '<div class="start-note">⏱ 약 30초 소요 · 언제든 119와 통화 가능</div>' +
      '</div>';

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
    document.getElementById('sh-lookup-afp').onclick = function () {
      var building = SAFEHOME.findBuildingByAddress(L.apt, L.dong);
      renderStart();
      if (building) {
        SAFEHOME.toast(building.apt + ' ' + building.dong + '동 등록 정보를 불러왔습니다.');
      } else {
        SAFEHOME.toast('등록된 건물 정보가 없습니다. 아파트명·동을 확인해주세요.');
      }
    };
    document.getElementById('sh-request-correction').onclick = function () {
      var text = prompt('실제와 다른 시설현황이 있다면 적어주세요. (예: 하향식 피난구가 실제로는 설치되어 있음)');
      if (text && text.trim()) {
        SAFEHOME.store.submitCorrectionRequest({ apt: L.apt, dong: L.dong, ho: L.ho, text: text.trim() });
        SAFEHOME.toast('수정 요청이 119 상황실로 전달되었습니다.');
      }
    };
    document.getElementById('sh-start').onclick = function () { goTo(1); };
  }

  // ------------------------------------------------------------- QUESTION
  function renderQuestion(n) {
    var q = SAFEHOME.QUESTIONS['q' + n];
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
      computeResult();
      return;
    }
    var next = parseInt(qid.slice(1), 10) + 1;
    if (next <= 5) goTo(next); else computeResult();
  }

  function renderPanicTip() {
    var qid = pendingAfterPanic;
    var tip = PANIC_TIPS[qid][answers[qid]];
    root.innerHTML =
      '<div class="start-screen">' +
        '<div class="result-icon r-danger" style="margin:0 auto 16px;">' + tip.icon + '</div>' +
        '<div class="start-title">지금 즉시 확인하세요</div>' +
        '<div class="start-sub">' + esc(tip.text) + '</div>' +
        '<a href="tel:119" class="start-btn" style="display:block;text-align:center;text-decoration:none;box-sizing:border-box;margin-bottom:10px;">📞 119 바로 전화하기</a>' +
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

    var locHtml = (L.apt || L.dong || L.ho) ? '<div class="loc-pill">📍 ' + esc(SAFEHOME.locText(L)) + '</div>' : '';

    var msg = SAFEHOME.make119Message(key, answers, A, L);
    var msgHtml = '<div class="message-box"><h3>📞 119 전달문</h3><div class="message-text">' + esc(msg) + '</div>' +
      '<div class="small-actions"><button id="sh-copy119">문구 복사</button><button id="sh-share">가족 공유</button></div></div>';

    var afpHtml = '<div class="afp-card"><h3>🏢 K-apt 기반 소방시설 현황</h3><div class="afp-grid">' +
      SAFEHOME.AFP_CORE_FIELDS.map(function (f) {
        return '<div class="afp-item ' + SAFEHOME.ynClass(A[f.key]) + '">' + f.icon + ' ' + esc(f.label) + ': ' + esc(SAFEHOME.ynText(A[f.key], f.yes, f.no)) + '</div>';
      }).join('') +
      '</div><div class="afp-note">※ 미설치/확인 필요 시설은 대피 판단에서 자동 제외됩니다.</div></div>';

    var report = L.ho ? SAFEHOME.store.getReportByAddress(L.apt, L.dong, L.ho) : null;
    var matchHtml = '';
    var doneHtml = '';
    if (report) {
      matchHtml = report.matchedIncidentId
        ? '<div class="tag-ok" style="display:block;text-align:center;margin-bottom:14px;">✅ 119 상황실에서 위치를 확인했습니다</div>'
        : '<div class="tag-warn" style="display:block;text-align:center;margin-bottom:14px;">🕒 119 상황실에서 신고 위치를 확인하는 중입니다</div>';
      if (report.status !== 'safe') {
        doneHtml = '<button class="utility-btn" style="width:100%;margin-bottom:14px;background:#2E7D32;" id="sh-mark-safe">🏁 대피를 완료했습니다 (상황실에 안전 알림)</button>';
      } else {
        doneHtml = '<div class="action-card safe"><h3>✅ 대피 완료로 표시되었습니다</h3><ul><li>119 상황실·소방대원 화면에 안전 상태로 반영되었습니다.</li></ul></div>';
      }
    }

    root.innerHTML =
      '<div class="result-header">' +
        '<div class="result-icon ' + r.cls + '">' + r.icon + '</div>' +
        '<div class="result-title">' + esc(r.title) + '</div>' +
        '<div class="result-sub">' + esc(r.sub) + '</div>' +
        locHtml +
      '</div>' +
      '<div class="utility-row"><button class="utility-btn" id="sh-speak">🔊 음성 안내</button><button class="utility-btn secondary" id="sh-copy119b">📋 119 문구</button></div>' +
      matchHtml + doneHtml + summaryHtml + cardsHtml + howtoHtml + msgHtml + afpHtml +
      '<button class="restart-btn" id="sh-restart">처음부터 다시 진행하기</button>';

    document.getElementById('sh-copy119').onclick = function () { copyMsg(msg); };
    document.getElementById('sh-copy119b').onclick = function () { copyMsg(msg); };
    document.getElementById('sh-share').onclick = function () { shareMsg(msg); };
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

  function copyMsg(msg) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(msg).then(function () { SAFEHOME.toast('119 전달문이 복사되었습니다.'); })
        .catch(function () { SAFEHOME.toast(msg); });
    } else {
      SAFEHOME.toast(msg);
    }
  }
  function shareMsg(msg) {
    var text = msg.replace('[SAFE-HOME 화재상황]', '[SAFE-HOME 가족 알림]');
    if (navigator.share) {
      navigator.share({ text: text }).catch(function () {});
    } else {
      copyMsg(text);
    }
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
