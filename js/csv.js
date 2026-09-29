(function(S) {
  'use strict';
  S.parseBuildingCsv = function(text, skipHeader) {
    var delimiter = text.split(/\r?\n/)[0].indexOf('\t') >= 0 ? '\t' : ',';
    var rows = [], row = [], field = '', quoted = false;
    for (var i = 0; i <= text.length; i++) {
      var c = text[i];
      if (c === '"') {
        if (quoted && text[i + 1] === '"') { field += '"'; i++; }
        else quoted = !quoted;
      } else if (!quoted && (c === delimiter || c === '\n' || c === undefined)) {
        row.push(field.trim()); field = '';
        if (c !== delimiter) { if (row.some(Boolean)) rows.push(row); row = []; }
      } else if (c !== '\r' && c !== undefined) field += c;
    }
    if (quoted) return [];
    if (skipHeader) rows.shift();
    return rows.map(function(c) { return {apt:c[0]||'',dong:c[1]||'',ho:c[2]||'',complexCode:c[3]||'',address:c[4]||''}; });
  };
}(window.SAFEHOME = window.SAFEHOME || {}));
