/* SAFE-HOME · facility.js
   소방시설 점검 화면: 관리자가 건물별로 발급하는 별도 링크(?role=facility&building=ID)로 접속해
   그 건물의 소방시설(AFP-Core/소화시설) 현황을 직접 갱신한다. 화재 신고와 무관하게, 정기 점검 시
   해당 아파트가 스스로 최신 설치 현황을 등록해두는 용도다. */
(function (SAFEHOME) {
  'use strict';

  var esc = SAFEHOME.escapeHtml;
  var root = null;
  var buildingId = null;

  function mount(container) {
    root = container;
    buildingId = SAFEHOME.urlBuildingId || null;
    render();
  }
  function unmount() { root = null; }

  function render() {
    if (!root) return;
    var base = buildingId ? SAFEHOME.BUILDINGS[buildingId] : null;
    if (!base) return renderInvalid();
    renderForm(base);
  }

  function renderInvalid() {
    root.innerHTML =
      '<div class="start-screen">' +
        '<div class="start-emoji">' + SAFEHOME.icon2('alert') + '</div>' +
        '<div class="start-title">잘못된 점검 링크입니다</div>' +
        '<div class="start-sub">관리자에게 올바른 소방시설 점검 링크를 다시 요청해주세요.</div>' +
      '</div>';
  }

  function renderForm(base) {
    var building = SAFEHOME.store.getEffectiveBuilding(buildingId);
    var ov = SAFEHOME.store.getState().buildingOverrides || {};
    var savedAt = ov[buildingId] && ov[buildingId].updatedAt;

    root.innerHTML =
      '<div class="start-screen" style="text-align:left;">' +
        '<div class="start-emoji" style="text-align:center;color:var(--blue);">' + SAFEHOME.icon2('drop') + '</div>' +
        '<div class="start-title" style="text-align:center;">소방시설 점검</div>' +
        '<div class="start-sub" style="text-align:center;">' + esc(building.apt) + ' ' + esc(building.dong) + '동의 소방시설 설치 현황을 점검·갱신합니다.</div>' +
        (savedAt ? '<div class="tag-ok" style="display:block;text-align:center;margin-bottom:14px;">' + SAFEHOME.icon2('check') + ' 마지막 저장: ' + SAFEHOME.fmtTime(savedAt) + '</div>' : '') +

        '<div class="home-box">' +
          '<div class="home-box-title">' + SAFEHOME.icon2('door') + ' 피난시설 (AFP-Core)</div>' +
          facilityFieldsHtml(SAFEHOME.AFP_CORE_FIELDS, building.core, 'core') +
        '</div>' +
        '<div class="home-box">' +
          '<div class="home-box-title">' + SAFEHOME.icon2('drop') + ' 소화시설</div>' +
          facilityFieldsHtml(SAFEHOME.AFP_SUPPRESSION_FIELDS, building.suppression, 'suppression') +
        '</div>' +

        '<div class="home-box"><h3>점검 근거</h3><label class="field-label">점검자<input id="fc-inspector" value="' + esc((ov[buildingId] || {}).inspector || '') + '"></label><label class="field-label">근거·확인 방법<textarea id="fc-evidence">' + esc((ov[buildingId] || {}).evidence || '') + '</textarea></label></div>' +
        '<div class="home-box"><h3>건물 특화 구조</h3>' + Object.keys(SAFEHOME.makeUnknownSearch()).map(function(key){
          var labels = {hoistRoomStructure:'권상기실 구조',roofAccessRoute:'옥상 접근 경로',hiddenStairs:'숨은 계단',midFireDoors:'방화문',duplexUnits:'복층 호수 — 쉼표로 구분',duplexNote:'복층 설명',refugeAreaNote:'피난안전구역',basementNote:'지하 구조'};
          return '<label class="field-label">' + labels[key] + '<textarea data-search-key="' + key + '">' + esc(Array.isArray(building.search[key]) ? building.search[key].join(',') : building.search[key]) + '</textarea></label>';
        }).join('') + '</div>' +
        '<button class="start-btn" id="fc-save">저장</button>' +
        '<div class="start-note">' + SAFEHOME.icon2('clock') + ' 새 사건부터 적용됩니다. 진행 사건은 확정 시점 정보와 세대 예외를 사용합니다.</div>' +
      '</div>';

    document.getElementById('fc-save').onclick = function () {
      var patch = { core: {}, suppression: {} };
      root.querySelectorAll('[data-fc-group]').forEach(function (sel) {
        var group = sel.getAttribute('data-fc-group');
        var key = sel.getAttribute('data-fc-key');
        patch[group][key] = sel.value === 'unknown' ? null : sel.value === 'true';
      });
      patch.inspector = document.getElementById('fc-inspector').value;
      patch.evidence = document.getElementById('fc-evidence').value; patch.search = {};
      root.querySelectorAll('[data-search-key]').forEach(function(el){
        var key = el.getAttribute('data-search-key');
        patch.search[key] = key === 'duplexUnits' ? el.value.split(',').map(function(v){return v.trim();}).filter(Boolean) : el.value;
      });
      if (!patch.inspector.trim() || !patch.evidence.trim()) { SAFEHOME.toast('점검자와 확인 근거를 입력해주세요.'); return; }
      if (!SAFEHOME.store.setBuildingFacility(buildingId, patch)) return;
      SAFEHOME.toast('소방시설 현황이 저장되었습니다.');
      render();
    };
  }

  function facilityFieldsHtml(fields, current, group) {
    return '<div class="facility-grid">' + fields.map(function (f) {
      var v = current[f.key];
      return '<div class="facility-field"><label>' + f.icon + ' ' + esc(f.label) + '</label>' +
        '<select data-fc-group="' + group + '" data-fc-key="' + f.key + '">' +
          '<option value="unknown"' + (v == null ? ' selected' : '') + '>확인 필요</option>' +
          '<option value="true"' + (v === true ? ' selected' : '') + '>' + esc(f.yes) + '</option>' +
          '<option value="false"' + (v === false ? ' selected' : '') + '>' + esc(f.no) + '</option>' +
        '</select></div>';
    }).join('') + '</div>';
  }

  SAFEHOME.FacilityEdit = { mount: mount, unmount: unmount };

}(window.SAFEHOME = window.SAFEHOME || {}));
