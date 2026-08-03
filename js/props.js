"use strict";

/* ========================== PROPERTIES UI =========================== */
function fld(label, inner, hint) {
  return '<div class="fld"><label>' + label + '</label>' + inner +
    (hint ? '<div class="hint">' + hint + '</div>' : '') + '</div>';
}
function txt(path, val, ph) {
  return '<input type="text" data-bind="' + path + '" value="' + esc(val) + '" placeholder="' + esc(ph || '') + '">';
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

var SCOPE_OPTS = [
  { v: 'period', l: 'Configured period' },
  { v: 'last24h', l: 'Last 24 hours (fixed)' },
  { v: 'all', l: 'All time (no date filter)' }
];
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
  h += fld('Widget Name (camelCase)', txt('widget.name', w.name, 'myWidget'),
    'Drives folder name, controller id and CSS prefix: ' + camelSafe(w.name) + '-' + w.version);
  h += fld('Title', txt('widget.title', w.title));
  h += fld('Subtitle', txt('widget.subTitle', w.subTitle));
  h += fld('Version', txt('widget.version', w.version, '1.0.0'));
  h += fld('Publisher', txt('widget.publisher', w.publisher));
  h += fld('FortiSOAR Compatibility', txt('widget.compatibility', w.compatibility, '7.6.2'));

  h += '<div class="divider"></div><div class="sub-head">Data</div>';
  h += fld('Module (data source)', txt('widget.module', w.module, 'alerts'),
    'Typed by hand - this builder never contacts a FortiSOAR instance.');
  h += fld('Time Range Field', txt('widget.dateField', w.dateField, 'createDate'),
    'Any Date/Time field: createDate, modifyDate, eventTimestamp, ...');
  h += fld('Default Period', sel('widget.period', w.period, [
    { v: '24h', l: 'Last 24 Hours' }, { v: '7d', l: 'Last 7 Days' },
    { v: '30d', l: 'Last 30 Days' }, { v: '90d', l: 'Last 90 Days' }, { v: 'all', l: 'All Time' }
  ]));

  h += '<div class="divider"></div><div class="sub-head">Runtime</div>';
  h += chk('widget.autoRefresh', w.autoRefresh, 'Enable auto refresh by default');
  if (w.autoRefresh) {
    h += fld('Refresh Interval', sel('widget.refreshInterval', w.refreshInterval, [
      { v: 60, l: '1 minute' }, { v: 300, l: '5 minutes' }, { v: 600, l: '10 minutes' },
      { v: 900, l: '15 minutes' }, { v: 1800, l: '30 minutes' }
    ]));
  }

  h += '<div class="divider"></div><div class="sub-head">Appearance</div>';
  h += '<div class="fld"><label>Accent Color</label><div class="swatches">' +
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
    h += fld('Metric', sel(p + 'metric', b.metric, [
      { v: 'count', l: 'Record count' },
      { v: 'oldestAge', l: 'Age of oldest record' }
    ]), b.metric === 'oldestAge' ? 'Shows how long the oldest matching record has been sitting, colored by urgency.' : '');
    h += fld('Time Scope', sel(p + 'scope', b.scope, SCOPE_OPTS));
    h += chk(p + 'onlyOpen', b.onlyOpen, 'Only unresolved records');
    if (b.metric === 'count') {
      h += chk(p + 'onlyUnassigned', b.onlyUnassigned, 'Only unassigned records');
      if (b.onlyUnassigned) h += fld('Owner Field', txt(p + 'ownerField', b.ownerField, 'owner'));
    }
    h += chk(p + 'accent', b.accent, 'Highlight tile (accent border)');
  }

  if (b.type === 'delta') {
    h += fld('Label', txt(p + 'label', b.label));
    h += chk(p + 'onlyOpen', b.onlyOpen, 'Only unresolved records');
    h += fld('Good Direction', sel(p + 'goodDirection', b.goodDirection, [
      { v: 'down', l: 'Down is good (volume, backlog)' },
      { v: 'up', l: 'Up is good (closed, automated)' }
    ]), 'Decides whether a rise is shown in red or green.');
    h += '<div class="hint" style="margin:-6px 0 12px">Compares the configured period against the immediately preceding window of the same length. Not available when the period is All Time.</div>';
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
    h += fld('Time Scope', sel(p + 'scope', b.scope, SCOPE_OPTS));
    h += chk(p + 'onlyOpen', b.onlyOpen, 'Only unresolved records');
    h += chk(p + 'accent', b.accent, 'Highlight tile');
  }

  if (b.type === 'gauge') {
    h += fld('Label', txt(p + 'label', b.label));
    h += fld('Numerator', sel(p + 'numerator', b.numerator, [
      { v: 'resolved', l: 'Resolved / closed' },
      { v: 'unresolved', l: 'Still open' },
      { v: 'assigned', l: 'Assigned to someone' },
      { v: 'unassigned', l: 'Unassigned' }
    ]), 'Shown as a percentage of all records in scope.');
    if (b.numerator === 'assigned' || b.numerator === 'unassigned') {
      h += fld('Owner Field', txt(p + 'ownerField', b.ownerField || 'owner', 'owner'));
    }
    h += fld('Target %', num(p + 'target', b.target, 0, 100), 'Draws a target tick and colors the value against it.');
    h += fld('Time Scope', sel(p + 'scope', b.scope, SCOPE_OPTS));
    h += chk(p + 'accent', b.accent, 'Highlight tile');
  }

  if (b.type === 'aging') {
    h += fld('Label', txt(p + 'label', b.label));
    h += chk(p + 'onlyOpen', b.onlyOpen, 'Only unresolved records');
    h += '<div class="hint" style="margin:-6px 0 12px">Buckets records into &lt;1h / 1-4h / 4-24h / 1-7d / &gt;7d by the Time Range Field. Ignores the search period so nothing ages out of view. Costs 5 queries.</div>';
  }

  if (b.type === 'table') {
    h += fld('Label', txt(p + 'label', b.label));
    h += fld('Columns', txt(p + 'columns', b.columns, 'severity:Severity, status:Status'),
      'Comma separated. Use field:Label to rename a header. The module display field is always the first column.');
    h += fld('Sort Field', txt(p + 'sortField', b.sortField, '(defaults to Time Range Field)'));
    h += fld('Sort Direction', sel(p + 'sortDir', b.sortDir, [
      { v: 'DESC', l: 'Descending (newest first)' },
      { v: 'ASC', l: 'Ascending (oldest first)' }
    ]));
    h += fld('Row Limit', num(p + 'limit', b.limit, 1, 50));
    h += fld('Time Scope', sel(p + 'scope', b.scope, SCOPE_OPTS));
    h += chk(p + 'onlyOpen', b.onlyOpen, 'Only unresolved records');
  }

  if (b.type === 'bars' || b.type === 'donut' || b.type === 'stacked') {
    h += fld('Label', txt(p + 'label', b.label));
    h += fld('Group By Field', txt(p + 'field', b.field, 'severity'));
    h += fld('Field Kind', sel(p + 'kind', b.kind, [
      { v: 'picklist', l: 'Picklist (.itemValue)' },
      { v: 'reference', l: 'Lookup / reference' },
      { v: 'plain', l: 'Plain value' }
    ]), 'Picklist and lookup fields store an IRI, so the query must group on a sub-attribute.');
    if (b.kind === 'reference') h += fld('Display Attribute', txt(p + 'refAttr', b.refAttr, 'name'));
    h += fld('Time Scope', sel(p + 'scope', b.scope, SCOPE_OPTS));
    h += chk(p + 'onlyOpen', b.onlyOpen, 'Only unresolved records');
    if (b.type === 'bars') {
      h += fld('Max Rows', num(p + 'maxRows', b.maxRows, 1, 20));
      h += chk(p + 'showRank', b.showRank, 'Show rank numbers (Top N style)');
    }
    if (b.type === 'donut') h += fld('Legend Position', sel(p + 'legend', b.legend, ['right', 'left', 'top', 'bottom']));
  }

  if (b.type === 'trend') {
    h += fld('Label', txt(p + 'label', b.label));
    h += fld('Buckets', num(p + 'buckets', b.buckets, 3, 24),
      'The Query API has no date-histogram operator, so the widget fires one count query per bucket. Higher = more requests per refresh.');
    h += chk(p + 'onlyOpen', b.onlyOpen, 'Only unresolved records');
  }

  if (b.type === 'list') {
    h += fld('Label', txt(p + 'label', b.label));
    h += fld('Subtitle', txt(p + 'subtitle', b.subtitle, 'optional'));
    h += fld('Sort Field', txt(p + 'sortField', b.sortField, '(defaults to Time Range Field)'));
    h += fld('Sort Direction', sel(p + 'sortDir', b.sortDir, [
      { v: 'ASC', l: 'Ascending (oldest first)' },
      { v: 'DESC', l: 'Descending (newest first)' }
    ]));
    h += fld('Row Limit', num(p + 'limit', b.limit, 1, 50));
    h += fld('Secondary Field', txt(p + 'secondaryField', b.secondaryField, 'status'), 'Shown on the right of each row. Leave blank to hide.');
    h += fld('Time Scope', sel(p + 'scope', b.scope, SCOPE_OPTS));
    h += chk(p + 'onlyOpen', b.onlyOpen, 'Only unresolved records');
    h += chk(p + 'showAge', b.showAge, 'Show age + urgency dot');
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

  host.querySelectorAll('[data-accent]').forEach(function (el) {
    el.addEventListener('click', function () {
      design.widget.accent = el.dataset.accent;
      renderAll(); save();
    });
  });

  var d = document.getElementById('btnDeselect');
  if (d) d.addEventListener('click', function () { selectedId = null; renderAll(); });
}

