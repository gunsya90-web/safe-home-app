/* SAFE-HOME · resident.js
   입주민용 화면: 시작(우리집 정보/AFP 입력) → Q1~Q5 → 결과.
   store를 통해 119 상황실/소방대원 화면과 상태를 공유한다. */
(function (SAFEHOME) {
  'use strict';

  var esc = SAFEHOME.escapeHtml;
  var root = null;
  var step = 0;           // 0=start, 1~5=질문, 'result'=결과
  var answers = {};
  var lastResult = null;

  function mount(container) {
    root = container;
    step = 0;
    answers = {};
    lastResult = null;
    render();
  }

  function loc() { return SAFEHOME.store.getState().location; }
  function afp() { return SAFEHOME.store.getState().afp; }

  function render() {
    if (!root) return;
    if (step === 0) return renderStart();
    if (step === 'result') return renderResult();
    return renderQuestion(step);
  }

  // ---------------------------------------------------------------- START
  function renderStart() {
    var L = loc();
    var A = afp();
    var fields = SAFEHOME.AFP_CORE_FIELDS.map(function (f) {
      var v = A[f.key];
      var sel = v === true ? 'true' : (v === false ? 'false' : 'unknown');
      return '<div class="facility-field"><label>' + esc(f.label) + '</label>' +
        '<select data-afp-key="' + f.key + '">' +
        '<option value="unknown"' + (sel === 'unknown' ? ' selected' : '') + '>확인 필요</option>' +
        '<option value="true"' + (sel === 'true' ? ' selected' : '') + '>' + esc(f.yes) + '</option>' +
        '<option value="false"' + (sel === 'false' ? ' selected' : '') + '>' + esc(f.no) + '</option>' +
        '</select></div>';
    }).join('');

    root.innerHTML =
      '<div class="start-screen">' +
        '<div class="start-emoji">🚨</div>' +
        '<div class="start-title">화재 신고가 접수되었습니다</div>' +
        '<div class="start-sub">지금부터 상황에 따라 필요한 질문에 답해주세요.<br>신고자님의 상황에 맞는 <strong>가장 안전한 대피 방법</strong>을 안내해드립니다.</div>' +
        '<div class="mode-note"><strong>긴급모드</strong>: 상황별 질문에 답하면 현재 상황에 맞는 행동요령, 119 전달문, 가족 공유 문구를 바로 제공합니다. 이 신고는 119 상황실로 전달되며, <strong>정확한 사건 위치(동·호)는 상황실에서 확인 후 확정</strong>합니다.</div>' +

        '<div class="home-box">' +
          '<div class="home-box-title">🏠 우리집 정보 <span style="font-size:11px;color:#6B6B6B;">신고 시 알려주는 위치입니다</span></div>' +
          '<div class="home-inputs">' +
            '<input id="sh-apt" placeholder="아파트명" value="' + esc(L.apt) + '">' +
            '<input id="sh-dong" placeholder="동" value="' + esc(L.dong) + '">' +
            '<input id="sh-ho" placeholder="호 (예: 902)" value="' + esc(L.ho) + '">' +
          '</div>' +
          '<button class="save-btn" id="sh-save-loc">위치 저장</button>' +
        '</div>' +

        '<div class="kapt-card">' +
          '<h3>🏢 K-apt 소방시설 현황</h3>' +
          '<p>등록된 단지라면 아래 시설현황이 자동으로 조회됩니다. 등록되지 않았거나 값이 다르면 직접 수정해 저장할 수 있습니다.</p>' +
          '<div class="facility-grid">' + fields + '</div>' +
          '<div class="kapt-actions"><button class="primary" id="sh-save-afp">시설현황 저장</button><button class="ghost" id="sh-lookup-afp">🔎 등록된 건물정보 조회</button></div>' +
          '<div class="afp-note">※ 결과 안내에서 미설치·확인 필요 시설은 자동 제외하고, 가능한 대체 행동으로 판단합니다.</div>' +
        '</div>' +

        '<button class="start-btn" id="sh-start">긴급 안내 시작하기</button>' +
        '<div class="start-note">⏱ 약 30초 소요 · 언제든 119와 통화 가능</div>' +
      '</div>';

    document.getElementById('sh-save-loc').onclick = function () {
      var apt = document.getElementById('sh-apt').value.trim();
      var dong = document.getElementById('sh-dong').value.trim();
      var ho = document.getElementById('sh-ho').value.trim();
      SAFEHOME.store.setLocation({ apt: apt, dong: dong, ho: ho });
      var building = SAFEHOME.findBuildingByAddress(apt, dong);
      if (building) {
        SAFEHOME.store.setAfp(building.core);
        renderStart();
        SAFEHOME.toast('우리집 정보가 저장되었습니다. 등록된 건물정보를 불러왔습니다.');
      } else {
        SAFEHOME.toast('우리집 정보가 저장되었습니다. (등록된 건물정보 없음 — 직접 입력해주세요)');
      }
      SAFEHOME.app && SAFEHOME.app.refreshBadges && SAFEHOME.app.refreshBadges();
    };
    document.getElementById('sh-save-afp').onclick = function () {
      var patch = {};
      root.querySelectorAll('[data-afp-key]').forEach(function (sel) {
        var v = sel.value;
        patch[sel.getAttribute('data-afp-key')] = v === 'true' ? true : (v === 'false' ? false : null);
      });
      SAFEHOME.store.setAfp(patch);
      SAFEHOME.toast('K-apt 소방시설 현황이 저장되었습니다.');
    };
    document.getElementById('sh-lookup-afp').onclick = function () {
      var building = SAFEHOME.findBuildingByAddress(L.apt, L.dong);
      if (building) {
        SAFEHOME.store.setAfp(building.core);
        renderStart();
        SAFEHOME.toast(building.apt + ' ' + building.dong + '동 등록 정보를 불러왔습니다.');
      } else {
        SAFEHOME.toast('등록된 건물 정보가 없습니다. 아파트명·동을 확인하거나 직접 입력해주세요.');
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
    if (qid === 'q4' && answers.q1 === '우리집') {
      computeResult();
      return;
    }
    var next = parseInt(qid.slice(1), 10) + 1;
    if (next <= 5) goTo(next); else computeResult();
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
      matchHtml = report.matched
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
