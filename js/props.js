"use strict";

/* ========================== PROPERTIES UI =========================== */
function fld(label, inner, hint) {
  return '<div class="fld"><label>' + label + '</label>' + inner +
    (hint ? '<div class="hint">' + hint + '</div>' : '') + '</div>';
}
function txt(path, val, ph) {
  return '<input type="text" data-bind="' + path + '" value="' + esc(val) + '" placeholder="' + esc(ph || '') + '">';
}
/* Comma-separated field-name editor for array-valued settings (e.g. table columns).
 * Runtime uses the real per-field ui-select once the widget is installed in
 * FortiSOAR (see codegen.js's genEditHtml "anyFieldMulti" kind); at design time
 * there's no live schema to pick from, so this is just typed field names. */
function csv(path, arr, ph) {
  return '<input type="text" data-bind-csv="' + path + '" value="' + esc((arr || []).join(', ')) + '" placeholder="' + esc(ph || '') + '">';
}
function num(path, val, min, max) {
  return '<input type="number" data-bind="' + path + '" value="' + esc(val) + '" min="' + (min == null ? 0 : min) + '" max="' + (max == null ? 999 : max) + '">';
}
function sel(path, val, opts) {
  return '<select data-bind="' + path + '">' + opts.map(function (o) {
    var v = o.v == null ? o : o.v, l = o.l == null ? o : o.l;
    return '<option value="' + esc(v) + '"' + (String(val) === String(v) ? ' selected' : '') + '>' + esc(l) + '</option>';
  }).join('') + '</select>';
}
function chk(path, val, label) {
  return '<div class="fld-check"><input type="checkbox" data-bind="' + path + '"' + (val ? ' checked' : '') +
    ' id="c_' + path.replace(/\W/g, '_') + '"><label for="c_' + path.replace(/\W/g, '_') + '">' + label + '</label></div>';
}
/* Filtering is never configured here - see the module-level note in blocks.js.
 * This just tells whoever is building the layout that the block will get a real
 * Filter Criteria control once the widget is installed and opened in FortiSOAR. */
function filterNote(text) {
  return '<div class="hint" style="margin:2px 0 12px">' + (text || 'Filter Criteria (with Relative date support) is configured per-panel inside FortiSOAR’s Edit dialog, not here.') + '</div>';
}

var WIDTH_OPTS = [
  { v: 3, l: 'Quarter (1/4)' }, { v: 4, l: 'Third (1/3)' }, { v: 6, l: 'Half (1/2)' },
  { v: 8, l: 'Two-thirds (2/3)' }, { v: 12, l: 'Full width' }
];

function renderProps() {
  var host = document.getElementById('props');
  var b = selectedId ? blockById(selectedId) : null;

  if (!b) {
    host.innerHTML = renderWidgetProps();
  } else {
    host.innerHTML = '<div class="prop-head"><span class="prop-kind">' + BLOCKS[b.type].name + '</span>' +
      '<button class="btn btn-danger" style="padding:3px 9px;font-size:12px" id="btnDeselect">Widget settings</button></div>' +
      renderBlockProps(b);
  }
  bindInputs();
}

function renderWidgetProps() {
  var w = design.widget;
  var h = '<div style="padding:12px 0 0">';
  h += fld('위젯 API Identifier* (영문만 지원)', txt('widget.name', w.name, 'myWidget'),
    '생성될 위젯 명: ' + camelSafe(w.name) + '-' + w.version);
  h += fld('위젯 제목 (한글 지원)', txt('widget.title', w.title));
  h += fld('부제목', txt('widget.subTitle', w.subTitle));
  h += fld('위젯 버전 (한글 미지원)', txt('widget.version', w.version, '1.0.0'));
  h += fld('Publisher', txt('widget.publisher', w.publisher));
  h += fld('지원되는 FortiSOAR 버전', txt('widget.compatibility', w.compatibility, '7.6.2'));

  h += '<div class="divider"></div><div class="sub-head">Data</div>';
  h += fld('Module 선택 (FortiSOAR 배포 후 변경 가능)', txt('widget.module', w.module, 'alerts'),
    '참고: FortiSOAR에 배포 후 각 위젯별로 필터를 적용하여 사용할 수 있습니다.');

  h += '<div class="divider"></div><div class="sub-head">자동 새로고침 (FortiSOAR에서 변경 가능)</div>';
  h += chk('widget.autoRefresh', w.autoRefresh, '자동 새로고침 켜기');
  if (w.autoRefresh) {
    h += fld('자동 새로고침 주기', sel('widget.refreshInterval', w.refreshInterval, [
      { v: 10, l: '10 초' }, { v: 30, l: '30 초' }, { v: 60, l: '1 분' }, { v: 300, l: '5 분' }, { v: 600, l: '10 분' },
      { v: 900, l: '15 분' }, { v: 1800, l: '30 분' }
    ]));
  }

  h += '<div class="divider"></div><div class="sub-head">강조 색상</div>';
  h += '<div class="fld"><label>강조 색상 선택</label><div class="swatches">' +
    ACCENTS.map(function (c) {
      return '<div class="swatch' + (w.accent === c ? ' on' : '') + '" data-accent="' + c + '" style="background:' + c + '"></div>';
    }).join('') + '</div></div>';

  h += '</div>';
  return h;
}

function renderBlockProps(b) {
  var p = 'block.' + b.id + '.';
  var h = '';

  if (b.type === 'header') {
    h += fld('Text', txt(p + 'text', b.text));
  }

  if (b.type === 'stat') {
    h += fld('Label', txt(p + 'label', b.label));
    h += filterNote();
    h += chk(p + 'accent', b.accent, 'Highlight tile (accent border)');
  }

  if (b.type === 'metric') {
    h += fld('Label', txt(p + 'label', b.label));
    h += fld('Numeric Field', txt(p + 'field', b.field, 'dwellTime'),
      'Must be a numeric field on the module (e.g. an SLA or duration field).');
    h += fld('Aggregate', sel(p + 'op', b.op, [
      { v: 'avg', l: 'Average' }, { v: 'median', l: 'Median' }, { v: 'sum', l: 'Sum' },
      { v: 'max', l: 'Maximum' }, { v: 'min', l: 'Minimum' }
    ]));
    h += fld('Format', sel(p + 'format', b.format, [
      { v: 'number', l: 'Plain number' }, { v: 'seconds', l: 'Duration (value is seconds)' },
      { v: 'minutes', l: 'Duration (value is minutes)' }, { v: 'hours', l: 'Duration (value is hours)' },
      { v: 'percent', l: 'Percent' }
    ]));
    h += fld('Decimals', num(p + 'decimals', b.decimals, 0, 4));
    h += filterNote();
    h += chk(p + 'accent', b.accent, 'Highlight tile');
  }

  if (b.type === 'gauge') {
    h += fld('Label', txt(p + 'label', b.label));
    h += fld('Target %', num(p + 'target', b.target, 0, 100), 'Draws a target tick and colors the value against it.');
    h += filterNote('The percentage is (records matching a Numerator Filter Criteria) / (records matching a Denominator Filter Criteria). Both are configured per-panel in FortiSOAR - e.g. denominator = everything, numerator = Status is Resolved.');
    h += chk(p + 'accent', b.accent, 'Highlight tile');
  }

  if (b.type === 'bars' || b.type === 'donut' || b.type === 'stacked') {
    h += fld('Label', txt(p + 'label', b.label));
    h += fld('Group By Field', txt(p + 'field', b.field, 'severity'),
      'Whether this is a picklist, a lookup, or a plain field is auto-detected from the module at runtime - not asked here.');
    h += filterNote();
    if (b.type === 'bars') h += fld('Max Rows', num(p + 'maxRows', b.maxRows, 1, 20));
    if (b.type === 'donut') h += fld('Legend Position', sel(p + 'legend', b.legend, ['right', 'left', 'top', 'bottom']));
  }

  if (b.type === 'table') {
    h += fld('Label', txt(p + 'label', b.label));
    h += fld('Columns', csv(p + 'columns', b.columns, 'severity, status, createDate'),
      'Comma separated field names. Headers show the real field title once the widget is installed in FortiSOAR - this is just which fields to include.');
    h += fld('Sort Field', txt(p + 'sortField', b.sortField, 'e.g. createDate'));
    h += fld('Sort Direction', sel(p + 'sortDir', b.sortDir, [
      { v: 'DESC', l: 'Descending (newest first)' },
      { v: 'ASC', l: 'Ascending (oldest first)' }
    ]));
    h += fld('Row Limit', num(p + 'limit', b.limit, 1, 50));
    h += filterNote();
  }

  h += '<div class="divider"></div>';
  h += fld('Width', sel(p + 'w', b.w, WIDTH_OPTS));
  return h;
}

function bindInputs() {
  var host = document.getElementById('props');

  host.querySelectorAll('[data-bind]').forEach(function (el) {
    var evt = (el.type === 'checkbox' || el.tagName === 'SELECT') ? 'change' : 'input';
    el.addEventListener(evt, function () {
      var path = el.dataset.bind;
      var val = el.type === 'checkbox' ? el.checked : (el.type === 'number' ? Number(el.value) : el.value);
      if (el.tagName === 'SELECT' && /^\d+$/.test(el.value)) val = Number(el.value);

      if (path.indexOf('widget.') === 0) {
        design.widget[path.slice(7)] = val;
      } else {
        var parts = path.split('.');           // block.<id>.<prop>
        var blk = blockById(parts[1]);
        if (blk) blk[parts[2]] = val;
      }
      // Selects/checkboxes can add or remove dependent fields, so re-render the
      // whole panel for those; text inputs re-render only the canvas to keep focus.
      if (evt === 'change') { renderAll(); }
      else { renderCanvas(); regen(); }
      save();
    });
  });

  host.querySelectorAll('[data-bind-csv]').forEach(function (el) {
    el.addEventListener('input', function () {
      var path = el.dataset.bindCsv;
      var val = el.value.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
      if (path.indexOf('widget.') === 0) {
        design.widget[path.slice(7)] = val;
      } else {
        var parts = path.split('.');           // block.<id>.<prop>
        var blk = blockById(parts[1]);
        if (blk) blk[parts[2]] = val;
      }
      renderCanvas(); regen();
      save();
    });
  });

  host.querySelectorAll('[data-accent]').forEach(function (el) {
    el.addEventListener('click', function () {
      design.widget.accent = el.dataset.accent;
      renderAll(); save();
    });
  });

  var d = document.getElementById('btnDeselect');
  if (d) d.addEventListener('click', function () { selectedId = null; renderAll(); });
}
