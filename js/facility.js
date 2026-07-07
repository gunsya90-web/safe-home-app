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

        '<button class="start-btn" id="fc-save">저장</button>' +
        '<div class="start-note">' + SAFEHOME.icon2('clock') + ' 저장 즉시 신규 사건·상황실·소방대원 화면에 반영됩니다</div>' +
      '</div>';

    document.getElementById('fc-save').onclick = function () {
      var patch = { core: {}, suppression: {} };
      root.querySelectorAll('[data-fc-group]').forEach(function (sel) {
        var group = sel.getAttribute('data-fc-group');
        var key = sel.getAttribute('data-fc-key');
        patch[group][key] = sel.value === 'true';
      });
      SAFEHOME.store.setBuildingFacility(buildingId, patch);
      SAFEHOME.toast('소방시설 현황이 저장되었습니다.');
      render();
    };
  }

  function facilityFieldsHtml(fields, current, group) {
    return '<div class="facility-grid">' + fields.map(function (f) {
      var v = current[f.key] === true;
      return '<div class="facility-field"><label>' + f.icon + ' ' + esc(f.label) + '</label>' +
        '<select data-fc-group="' + group + '" data-fc-key="' + f.key + '">' +
          '<option value="true"' + (v ? ' selected' : '') + '>' + esc(f.yes) + '</option>' +
          '<option value="false"' + (!v ? ' selected' : '') + '>' + esc(f.no) + '</option>' +
        '</select></div>';
    }).join('') + '</div>';
  }

  SAFEHOME.FacilityEdit = { mount: mount, unmount: unmount };

}(window.SAFEHOME = window.SAFEHOME || {}));
