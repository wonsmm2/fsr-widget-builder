"use strict";

/* ========================= CODE GENERATION ========================== */
function prefix() { return 'fsw-' + camelSafe(design.widget.name).toLowerCase(); }
function ctrlName() { return camelSafe(design.widget.name) + verTag(design.widget.version) + 'Ctrl'; }
function editCtrlName() { return 'edit' + pascal(camelSafe(design.widget.name)) + verTag(design.widget.version) + 'Ctrl'; }
function folderName() { return camelSafe(design.widget.name) + '-' + design.widget.version; }
function formName() { return 'edit' + pascal(camelSafe(design.widget.name)) + 'Form'; }

function usesAny(fn) { return design.blocks.some(fn); }
function has(type) { return design.blocks.some(function (b) { return b.type === type; }); }
/* onlyOpen is now a runtime toggle, so the helper must exist whenever any block
 * exposes it - not just when it happens to be switched on in the current design. */
function needsNotClosed() {
  return has('gauge') || usesAny(function (b) { return editableKeys(b.type).indexOf('onlyOpen') >= 0; });
}
function needsAge() {
  return usesAny(function (b) { return (b.type === 'list' && b.showAge) || (b.type === 'stat' && b.metric === 'oldestAge'); });
}
function needsPaged() {
  return has('list') || has('table') || usesAny(function (b) { return b.type === 'stat' && b.metric === 'oldestAge'; });
}
function needsCount() {
  return has('trend') || has('delta') || has('gauge') || has('aging') ||
    usesAny(function (b) { return b.type === 'stat' && b.metric === 'count'; });
}
/* Entity + modelMetadatasService are only needed to resolve the module display field. */
function needsMetadata() { return has('list') || has('table'); }
/* Shared semantic palette helper, used by every grouped visual. */
function needsColorFor() { return has('bars') || has('donut') || has('stacked') || has('aging'); }
function needsSegments() { return has('stacked'); }
function needsMetricFmt() { return has('metric'); }
function needsQAll() { return has('trend') || has('delta') || has('gauge') || has('aging'); }

/*
 * Which per-block settings stay editable inside FortiSOAR's own Edit dialog.
 *
 * The block *list* (which blocks exist and in what order) is design-time - that is
 * what this tool is for. Everything below is runtime, so a SOC admin can retarget a
 * chart or retitle a tile without regenerating and reinstalling the widget.
 *
 * "field" style kinds render as real dropdowns in the Edit dialog because the widget
 * has Entity available at runtime - which is strictly better than typing a field name
 * here, where nothing can validate it.
 */
var SCOPE_CHOICES = [
  { v: 'period', l: 'Configured period' },
  { v: 'last24h', l: 'Last 24 hours' },
  { v: 'all', l: 'All time' }
];
var WIDTH_CHOICES = [
  { v: 3, l: 'Quarter' }, { v: 4, l: 'Third' }, { v: 6, l: 'Half' },
  { v: 8, l: 'Two-thirds' }, { v: 12, l: 'Full width' }
];
var KIND_CHOICES = [
  { v: 'picklist', l: 'Picklist' }, { v: 'reference', l: 'Lookup / reference' }, { v: 'plain', l: 'Plain value' }
];

var F_LABEL = { key: 'label', label: 'Label', kind: 'text' };
var F_SCOPE = { key: 'scope', label: 'Time scope', kind: 'select', options: SCOPE_CHOICES };
var F_OPEN = { key: 'onlyOpen', label: 'Only unresolved records', kind: 'bool' };
var F_WIDTH = { key: 'w', label: 'Width', kind: 'select', options: WIDTH_CHOICES };
var F_GROUP = [
  { key: 'field', label: 'Group by field', kind: 'anyField' },
  { key: 'kind', label: 'Field kind', kind: 'select', options: KIND_CHOICES },
  { key: 'refAttr', label: 'Display attribute', kind: 'text', showIf: 'reference' }
];

var EDITABLE_SPEC = {
  stat: [F_LABEL,
    { key: 'metric', label: 'Metric', kind: 'select', options: [{ v: 'count', l: 'Record count' }, { v: 'oldestAge', l: 'Age of oldest record' }] },
    F_SCOPE, F_OPEN,
    { key: 'onlyUnassigned', label: 'Only unassigned', kind: 'bool' },
    { key: 'ownerField', label: 'Owner field', kind: 'anyField' },
    { key: 'accent', label: 'Highlight tile', kind: 'bool' }, F_WIDTH],
  delta: [F_LABEL, F_OPEN,
    { key: 'goodDirection', label: 'Good direction', kind: 'select', options: [{ v: 'down', l: 'Down is good' }, { v: 'up', l: 'Up is good' }] }, F_WIDTH],
  metric: [F_LABEL,
    { key: 'field', label: 'Numeric field', kind: 'anyField' },
    { key: 'op', label: 'Aggregate', kind: 'select', options: [{ v: 'avg', l: 'Average' }, { v: 'median', l: 'Median' }, { v: 'sum', l: 'Sum' }, { v: 'max', l: 'Maximum' }, { v: 'min', l: 'Minimum' }] },
    { key: 'format', label: 'Format', kind: 'select', options: [{ v: 'number', l: 'Plain number' }, { v: 'seconds', l: 'Duration (seconds)' }, { v: 'minutes', l: 'Duration (minutes)' }, { v: 'hours', l: 'Duration (hours)' }, { v: 'percent', l: 'Percent' }] },
    { key: 'decimals', label: 'Decimals', kind: 'number' },
    F_SCOPE, F_OPEN, { key: 'accent', label: 'Highlight tile', kind: 'bool' }, F_WIDTH],
  gauge: [F_LABEL,
    { key: 'numerator', label: 'Numerator', kind: 'select', options: [{ v: 'resolved', l: 'Resolved / closed' }, { v: 'unresolved', l: 'Still open' }, { v: 'assigned', l: 'Assigned' }, { v: 'unassigned', l: 'Unassigned' }] },
    { key: 'ownerField', label: 'Owner field', kind: 'anyField' },
    { key: 'target', label: 'Target %', kind: 'number' },
    F_SCOPE, { key: 'accent', label: 'Highlight tile', kind: 'bool' }, F_WIDTH],
  bars: [F_LABEL].concat(F_GROUP, [F_SCOPE, F_OPEN,
    { key: 'maxRows', label: 'Max rows', kind: 'number' },
    { key: 'showRank', label: 'Show rank numbers', kind: 'bool' }, F_WIDTH]),
  stacked: [F_LABEL].concat(F_GROUP, [F_SCOPE, F_OPEN, F_WIDTH]),
  donut: [F_LABEL].concat(F_GROUP, [F_SCOPE, F_OPEN,
    { key: 'legend', label: 'Legend position', kind: 'select', options: [{ v: 'right', l: 'Right' }, { v: 'left', l: 'Left' }, { v: 'top', l: 'Top' }, { v: 'bottom', l: 'Bottom' }] }, F_WIDTH]),
  trend: [F_LABEL, { key: 'buckets', label: 'Buckets', kind: 'number' }, F_OPEN, F_WIDTH],
  aging: [F_LABEL, F_OPEN, F_WIDTH],
  list: [F_LABEL,
    { key: 'subtitle', label: 'Subtitle', kind: 'text' },
    { key: 'sortField', label: 'Sort field', kind: 'anyField' },
    { key: 'sortDir', label: 'Sort direction', kind: 'select', options: [{ v: 'ASC', l: 'Oldest first' }, { v: 'DESC', l: 'Newest first' }] },
    { key: 'limit', label: 'Row limit', kind: 'number' },
    { key: 'secondaryField', label: 'Secondary field', kind: 'anyField' },
    F_SCOPE, F_OPEN, { key: 'showAge', label: 'Show age + urgency', kind: 'bool' }, F_WIDTH],
  table: [F_LABEL,
    { key: 'columns', label: 'Columns (field:Label, ...)', kind: 'text' },
    { key: 'sortField', label: 'Sort field', kind: 'anyField' },
    { key: 'sortDir', label: 'Sort direction', kind: 'select', options: [{ v: 'DESC', l: 'Newest first' }, { v: 'ASC', l: 'Oldest first' }] },
    { key: 'limit', label: 'Row limit', kind: 'number' },
    F_SCOPE, F_OPEN, F_WIDTH],
  header: [{ key: 'text', label: 'Text', kind: 'text' }, F_WIDTH]
};

function editableKeys(type) {
  return (EDITABLE_SPEC[type] || []).map(function (f) { return f.key; });
}

/* Runtime settings object for one block, emitted into the saved config. */
function blockSettings(b) {
  var out = {};
  editableKeys(b.type).forEach(function (k) { out[k] = b[k]; });
  return out;
}

/* Filters are now assembled at runtime from the saved settings, so changing the
 * time scope or the "only unresolved" toggle in FortiSOAR takes effect immediately. */
function filtersExpr(b) {
  return '_blockFilters(settings)';
}

/* ------------------------------ info.json ------------------------------ */
function genInfoJson() {
  var w = design.widget;
  var o = {
    name: camelSafe(w.name),
    title: w.title,
    subTitle: w.subTitle,
    version: w.version,
    published_date: Math.floor(Date.now() / 1000),
    metadata: {
      description: w.subTitle,
      pages: w.pages,
      certified: 'No',
      publisher: w.publisher,
      compatibility: [w.compatibility],
      category: ['Charts']
    },
    development: true
  };
  return JSON.stringify(o, null, 4) + '\n';
}

/* --------------------------- view.controller.js -------------------------- */
function genViewController() {
  var w = design.widget;
  var L = [];
  var deps = ['$scope', 'config', '$resource', 'API', 'currentPermissionsService', '$interval', '_'];
  if (needsPaged()) { deps.splice(4, 0, 'Query', 'PagedCollection'); }
  if (needsMetadata()) { deps.push('Entity', 'modelMetadatasService', 'appModulesService', '$state', '$filter'); }
  if (needsQAll()) { deps.push('$q'); }

  L.push('"use strict";');
  L.push('(function () {');
  L.push('  angular');
  L.push('    .module("cybersponse")');
  L.push('    .controller(' + jsStr(ctrlName()) + ', ' + ctrlName() + ');');
  L.push('');
  L.push('  ' + ctrlName() + '.$inject = [');
  deps.forEach(function (d) { L.push('    ' + jsStr(d) + ','); });
  L.push('  ];');
  L.push('');
  L.push('  function ' + ctrlName() + '(');
  L.push('    ' + deps.join(',\n    '));
  L.push('  ) {');
  L.push('    var refreshTimer;');
  L.push('');
  L.push('    var PERIOD_MS = {');
  L.push('      "24h": 24 * 60 * 60 * 1000,');
  L.push('      "7d": 7 * 24 * 60 * 60 * 1000,');
  L.push('      "30d": 30 * 24 * 60 * 60 * 1000,');
  L.push('      "90d": 90 * 24 * 60 * 60 * 1000,');
  L.push('    };');
  L.push('    var PERIOD_LABELS = {');
  L.push('      "24h": "Last 24 Hours",');
  L.push('      "7d": "Last 7 Days",');
  L.push('      "30d": "Last 30 Days",');
  L.push('      "90d": "Last 90 Days",');
  L.push('      all: "All Time",');
  L.push('    };');

  if (needsNotClosed()) {
    L.push('    // A record counts as open unless its status/state itemValue matches one of');
    L.push('    // these keywords. Tune to match your tenant naming (e.g. "false positive").');
    L.push('    var CLOSED_STATE_KEYWORDS = ["closed", "resolved", "complete", "done", "remediated"];');
    L.push('    var STATUS_FIELD = "status";');
  }
  if (needsColorFor()) {
    L.push('    // Security dashboards should color by meaning, not by position: a bucket named');
    L.push('    // "Critical" is always red regardless of where it lands in the result set.');
    L.push('    // Unrecognised labels fall back to the categorical ramp below.');
    L.push('    var SEMANTIC_COLORS = {');
    Object.keys(SEMANTIC_COLORS).forEach(function (k) {
      L.push('      ' + (/[^a-z]/.test(k) ? jsStr(k) : k) + ': ' + jsStr(SEMANTIC_COLORS[k]) + ',');
    });
    L.push('    };');
    L.push('    var COLOR_PALETTE = [');
    L.push('      ' + PALETTE_COLORS.slice(0, 5).map(jsStr).join(', ') + ',');
    L.push('      ' + PALETTE_COLORS.slice(5).map(jsStr).join(', ') + ',');
    L.push('    ];');
  }
  if (has('aging')) {
    L.push('    // Age bands are measured against the Time Range Field and deliberately ignore');
    L.push('    // the search period, so an ageing backlog never silently drops out of view.');
    L.push('    var AGING_BANDS = [');
    L.push('      { label: "< 1h", fromH: 0, toH: 1, color: "#2ea043" },');
    L.push('      { label: "1-4h", fromH: 1, toH: 4, color: "#3fa7d6" },');
    L.push('      { label: "4-24h", fromH: 4, toH: 24, color: "#e3b341" },');
    L.push('      { label: "1-7d", fromH: 24, toH: 168, color: "#e8663d" },');
    L.push('      { label: "> 7d", fromH: 168, toH: null, color: "#d9364c" },');
    L.push('    ];');
  }
  if (has('donut')) {
    L.push('    var CENTER = 100;');
    L.push('    var OUTER_RADIUS = 90;');
    L.push('    var INNER_RADIUS = 56;');
    L.push('    var SEGMENT_GAP = 4;');
  }
  if (needsAge()) {
    L.push('    var URGENCY_MEDIUM_HOURS = 4;');
    L.push('    var URGENCY_HIGH_HOURS = 24;');
  }

  L.push('');
  L.push('    // Per-block settings the Edit dialog can change at runtime. Shipped defaults');
  L.push('    // are merged underneath whatever was saved, so a widget configured before a');
  L.push('    // new setting existed still gets a sane value instead of undefined.');
  L.push('    var BLOCK_DEFAULTS = {');
  design.blocks.forEach(function (b) {
    var s = blockSettings(b);
    var pairs = Object.keys(s).map(function (k) {
      var v = s[k];
      return k + ': ' + (typeof v === 'string' ? jsStr(v) : typeof v === 'boolean' ? String(v) : v === null || v === undefined ? 'null' : v);
    });
    L.push('      ' + b.id + ': { ' + pairs.join(', ') + ' },');
  });
  L.push('    };');
  L.push('');
  L.push('    $scope.config = angular.copy(config);');
  L.push('    if (!$scope.config.dateField) {');
  L.push('      $scope.config.dateField = ' + jsStr(w.dateField) + ';');
  L.push('    }');
  L.push('    $scope.config.blocks = $scope.config.blocks || {};');
  L.push('    angular.forEach(BLOCK_DEFAULTS, function (defaults, blockId) {');
  L.push('      $scope.config.blocks[blockId] = angular.extend({}, defaults, $scope.config.blocks[blockId]);');
  L.push('    });');
  L.push('    $scope.collapsed =');
  L.push('      $scope.page !== undefined &&');
  L.push('      $scope.page.toLowerCase() !== "dashboard" &&');
  L.push('      $scope.page.toLowerCase() !== "reporting";');
  L.push('    $scope.periodLabel = PERIOD_LABELS[$scope.config.period] || PERIOD_LABELS.all;');
  L.push('    $scope.blocks = {');
  design.blocks.forEach(function (b) {
    if (b.type === 'header') return;
    if (b.type === 'stat' || b.type === 'metric') L.push('      ' + b.id + ': { loading: false, value: null },');
    else if (b.type === 'delta') L.push('      ' + b.id + ': { loading: false, value: null, previous: null, changePercent: null, direction: "flat" },');
    else if (b.type === 'gauge') L.push('      ' + b.id + ': { loading: false, percent: null, matched: 0, total: 0, dash: "0 125.66", color: "#7d8b9e" },');
    else if (b.type === 'bars' || b.type === 'aging') L.push('      ' + b.id + ': { loading: false, rows: [] },');
    else if (b.type === 'stacked') L.push('      ' + b.id + ': { loading: false, segments: [], total: 0 },');
    else if (b.type === 'donut') L.push('      ' + b.id + ': { loading: false, slices: [], total: 0 },');
    else if (b.type === 'trend') L.push('      ' + b.id + ': { loading: false, path: null, buckets: [] },');
    else if (b.type === 'list' || b.type === 'table') L.push('      ' + b.id + ': { loading: false, rows: [] },');
  });
  L.push('    };');
  L.push('    $scope.refresh = _refreshAll;');
  if (needsMetadata()) {
    L.push('    $scope.titleField = "name";');
    L.push('    $scope.openRecord = openRecord;');
  }
  if (needsMetricFmt()) {
    L.push('    $scope.formatMetric = _formatMetric;');
  }
  if (has('donut')) {
    L.push('    $scope.ringMidRadius = (OUTER_RADIUS + INNER_RADIUS) / 2;');
    L.push('    $scope.ringThickness = OUTER_RADIUS - INNER_RADIUS;');
  }
  if (needsAge()) {
    L.push('    $scope.formatAge = _formatAge;');
    L.push('    $scope.ageUrgencyClass = _ageUrgencyClass;');
  }
  L.push('');
  L.push('    function init() {');
  L.push('      if (!$scope.config.module) {');
  L.push('        return;');
  L.push('      }');
  L.push('      $scope.modulePermissions = currentPermissionsService.getPermission($scope.config.module);');
  L.push('      if (!$scope.modulePermissions || !$scope.modulePermissions.read) {');
  L.push('        $scope.unauthorized = true;');
  L.push('        return;');
  L.push('      }');
  if (needsMetadata()) {
    L.push('      _loadMetadata();');
  } else {
    L.push('      _refreshAll();');
    L.push('      _applyAutoRefresh();');
  }
  L.push('    }');
  L.push('');

  if (needsMetadata()) {
    L.push('    // Resolves the module display attribute so list/table rows show the same title');
    L.push('    // column the platform grid would use.');
    L.push('    function _loadMetadata() {');
    L.push('      var entity = new Entity($scope.config.module);');
    L.push('      entity.loadFields().then(function () {');
    L.push('        var meta = modelMetadatasService.getMetadataByModuleType($scope.config.module);');
    L.push('        $scope.titleField = (meta && meta.displayName) || "name";');
    L.push('      }).finally(function () {');
    L.push('        _refreshAll();');
    L.push('        _applyAutoRefresh();');
    L.push('      });');
    L.push('    }');
    L.push('');
  }

  L.push('    // Records within the configured period, measured against the chosen Time Range');
  L.push('    // Field. Returns [] for period "all" (no lower bound).');
  L.push('    function _periodFilters() {');
  L.push('      var ms = PERIOD_MS[$scope.config.period];');
  L.push('      if (!ms) {');
  L.push('        return [];');
  L.push('      }');
  L.push('      var since = new Date(Date.now() - ms).toISOString();');
  L.push('      return [{ field: $scope.config.dateField, operator: "gte", value: since }];');
  L.push('    }');
  L.push('');
  L.push('    // Every block assembles its filters from its own saved settings, so retargeting');
  L.push('    // a block in the Edit dialog takes effect on the next refresh with no code change.');
  L.push('    function _blockFilters(settings) {');
  L.push('      var filters;');
  L.push('      if (settings.scope === "all") {');
  L.push('        filters = [];');
  L.push('      } else if (settings.scope === "last24h") {');
  L.push('        filters = [');
  L.push('          { field: $scope.config.dateField, operator: "gte", value: new Date(Date.now() - 86400000).toISOString() },');
  L.push('        ];');
  L.push('      } else {');
  L.push('        filters = _periodFilters();');
  L.push('      }');
  if (needsNotClosed()) {
    L.push('      if (settings.onlyOpen) {');
    L.push('        filters = filters.concat(_notClosedFilters());');
    L.push('      }');
  }
  L.push('      if (settings.onlyUnassigned && settings.ownerField) {');
  L.push('        filters = filters.concat([{ field: settings.ownerField, operator: "isnull", value: true }]);');
  L.push('      }');
  L.push('      return filters;');
  L.push('    }');
  L.push('');
  if (needsColorFor()) {
    L.push('    // Picklist and lookup fields store an IRI, so grouping targets a sub-attribute');
    L.push('    // to resolve the human-readable bucket.');
    L.push('    function _groupField(settings) {');
    L.push('      if (settings.kind === "picklist") {');
    L.push('        return settings.field + ".itemValue";');
    L.push('      }');
    L.push('      if (settings.kind === "reference") {');
    L.push('        return settings.field + "." + (settings.refAttr || "name");');
    L.push('      }');
    L.push('      return settings.field;');
    L.push('    }');
    L.push('');
  }

  if (needsNotClosed()) {
    L.push('    function _notClosedFilters() {');
    L.push('      return _.map(CLOSED_STATE_KEYWORDS, function (keyword) {');
    L.push('        return {');
    L.push('          field: STATUS_FIELD + ".itemValue",');
    L.push('          operator: "notlike",');
    L.push('          value: "%" + keyword + "%",');
    L.push('        };');
    L.push('      });');
    L.push('    }');
    L.push('');
  }

  if (needsCount()) {
    L.push('    function _countQuery(filters) {');
    L.push('      var payload = {');
    L.push('        logic: "AND",');
    L.push('        filters: filters,');
    L.push('        aggregates: [{ operator: "countdistinct", field: "uuid", alias: "count" }],');
    L.push('      };');
    L.push('      return $resource(API.QUERY + $scope.config.module)');
    L.push('        .save(payload)');
    L.push('        .$promise.then(function (result) {');
    L.push('          var rows = result["hydra:member"] || [];');
    L.push('          return (rows[0] && rows[0].count) || 0;');
    L.push('        });');
    L.push('    }');
    L.push('');
  }

  L.push('    function _refreshAll() {');
  design.blocks.forEach(function (b) {
    if (b.type === 'header') return;
    L.push('      _load_' + b.id + '();');
  });
  L.push('    }');
  L.push('');

  design.blocks.forEach(function (b) {
    if (b.type === 'header') return;
    L.push(genBlockLoader(b));
  });

  if (needsColorFor()) {
    L.push('    function _colorFor(label, index) {');
    L.push('      var key = String(label === undefined || label === null ? "" : label).toLowerCase().trim();');
    L.push('      return SEMANTIC_COLORS[key] || COLOR_PALETTE[index % COLOR_PALETTE.length];');
    L.push('    }');
    L.push('');
    L.push('    function _groupLabel(raw) {');
    L.push('      return raw === undefined || raw === null || raw === "" ? "(Empty)" : raw;');
    L.push('    }');
    L.push('');
  }

  if (has('bars')) {
    L.push('    // Bars are scaled against the largest bucket so the shape stays readable even');
    L.push('    // when one category dwarfs the rest.');
    L.push('    function _buildBars(rows, maxRows) {');
    L.push('      var present = _.filter(rows, function (row) {');
    L.push('        return row.rCount > 0;');
    L.push('      });');
    L.push('      var sorted = _.sortBy(present, function (row) {');
    L.push('        return -row.rCount;');
    L.push('      });');
    L.push('      if (maxRows) {');
    L.push('        sorted = sorted.slice(0, maxRows);');
    L.push('      }');
    L.push('      var maxCount = sorted.length ? sorted[0].rCount : 0;');
    L.push('      return _.map(sorted, function (row, index) {');
    L.push('        var label = _groupLabel(row.groupKey);');
    L.push('        return {');
    L.push('          label: label,');
    L.push('          value: row.rCount,');
    L.push('          barPercent: maxCount ? Math.round((row.rCount / maxCount) * 1000) / 10 : 0,');
    L.push('          color: _colorFor(label, index),');
    L.push('        };');
    L.push('      });');
    L.push('    }');
    L.push('');
  }

  if (needsSegments()) {
    L.push('    // Distribution bar: widths are share-of-total, not share-of-max.');
    L.push('    function _buildSegments(rows) {');
    L.push('      var present = _.filter(rows, function (row) {');
    L.push('        return row.rCount > 0;');
    L.push('      });');
    L.push('      var sorted = _.sortBy(present, function (row) {');
    L.push('        return -row.rCount;');
    L.push('      });');
    L.push('      var total = _.reduce(sorted, function (sum, row) { return sum + row.rCount; }, 0);');
    L.push('      return _.map(sorted, function (row, index) {');
    L.push('        var label = _groupLabel(row.groupKey);');
    L.push('        return {');
    L.push('          label: label,');
    L.push('          value: row.rCount,');
    L.push('          percent: total ? Math.round((row.rCount / total) * 1000) / 10 : 0,');
    L.push('          color: _colorFor(label, index),');
    L.push('        };');
    L.push('      });');
    L.push('    }');
    L.push('');
  }

  if (needsMetricFmt()) {
    L.push('    // Renders a raw aggregate as a human-readable duration when the underlying');
    L.push('    // field is a time span, otherwise as a plain fixed-decimal number.');
    L.push('    function _formatMetric(value, format, decimals) {');
    L.push('      if (value === null || value === undefined) {');
    L.push('        return "--";');
    L.push('      }');
    L.push('      var n = Number(value);');
    L.push('      if (isNaN(n)) {');
    L.push('        return "--";');
    L.push('      }');
    L.push('      var factor = { seconds: 1 / 60, minutes: 1, hours: 60 }[format];');
    L.push('      if (factor) {');
    L.push('        var mins = n * factor;');
    L.push('        if (mins >= 1440) {');
    L.push('          return (mins / 1440).toFixed(decimals) + "d";');
    L.push('        }');
    L.push('        if (mins >= 60) {');
    L.push('          return (mins / 60).toFixed(decimals) + "h";');
    L.push('        }');
    L.push('        return mins.toFixed(decimals) + "m";');
    L.push('      }');
    L.push('      return n.toFixed(decimals) + (format === "percent" ? "%" : "");');
    L.push('    }');
    L.push('');
  }

  if (has('table')) {
    L.push('    // "severity:Severity, status:Status" -> [{ field, label }, ...].');
    L.push('    // Parsed at runtime so the column list stays editable from the Edit dialog.');
    L.push('    function _parseColumns(spec) {');
    L.push('      return _.compact(');
    L.push('        _.map(String(spec || "").split(","), function (part) {');
    L.push('          var trimmed = part.trim();');
    L.push('          if (!trimmed) {');
    L.push('            return null;');
    L.push('          }');
    L.push('          var sep = trimmed.indexOf(":");');
    L.push('          return sep > 0');
    L.push('            ? { field: trimmed.slice(0, sep).trim(), label: trimmed.slice(sep + 1).trim() }');
    L.push('            : { field: trimmed, label: trimmed };');
    L.push('        })');
    L.push('      );');
    L.push('    }');
    L.push('');
  }

  if (has('donut')) {
    L.push('    function _buildSlices(rows) {');
    L.push('      var present = _.filter(rows, function (row) {');
    L.push('        return row.rCount > 0;');
    L.push('      });');
    L.push('      var slices = _.map(present, function (row, index) {');
    L.push('        var label = _groupLabel(row.groupKey);');
    L.push('        return {');
    L.push('          label: label,');
    L.push('          value: row.rCount,');
    L.push('          color: _colorFor(label, index),');
    L.push('        };');
    L.push('      });');
    L.push('      _computeArcs(slices);');
    L.push('      return slices;');
    L.push('    }');
    L.push('');
    L.push('    // A small angular gap is inset between segments. The template falls back to a');
    L.push('    // stroked ring when there is only one slice, since a 360-degree filled arc is a');
    L.push('    // degenerate path (start point === end point).');
    L.push('    function _computeArcs(slices) {');
    L.push('      var total = _.reduce(slices, function (sum, s) { return sum + s.value; }, 0);');
    L.push('      if (!total) {');
    L.push('        return;');
    L.push('      }');
    L.push('      var hasGap = slices.length > 1;');
    L.push('      var cursor = 0;');
    L.push('      angular.forEach(slices, function (slice) {');
    L.push('        var fraction = slice.value / total;');
    L.push('        var startAngle = cursor * 360;');
    L.push('        var endAngle = (cursor + fraction) * 360;');
    L.push('        var inset = hasGap ? Math.min(SEGMENT_GAP / 2, (endAngle - startAngle) / 4) : 0;');
    L.push('        slice.percent = Math.round(fraction * 1000) / 10;');
    L.push('        slice.path = _describeDonutSegment(startAngle + inset, endAngle - inset);');
    L.push('        cursor += fraction;');
    L.push('      });');
    L.push('    }');
    L.push('');
    L.push('    function _polarToCartesian(r, angleDeg) {');
    L.push('      var angleRad = ((angleDeg - 90) * Math.PI) / 180;');
    L.push('      return { x: CENTER + r * Math.cos(angleRad), y: CENTER + r * Math.sin(angleRad) };');
    L.push('    }');
    L.push('');
    L.push('    function _describeDonutSegment(startAngle, endAngle) {');
    L.push('      var largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";');
    L.push('      var outerStart = _polarToCartesian(OUTER_RADIUS, startAngle);');
    L.push('      var outerEnd = _polarToCartesian(OUTER_RADIUS, endAngle);');
    L.push('      var innerEnd = _polarToCartesian(INNER_RADIUS, endAngle);');
    L.push('      var innerStart = _polarToCartesian(INNER_RADIUS, startAngle);');
    L.push('      return [');
    L.push('        "M", outerStart.x, outerStart.y,');
    L.push('        "A", OUTER_RADIUS, OUTER_RADIUS, 0, largeArcFlag, 1, outerEnd.x, outerEnd.y,');
    L.push('        "L", innerEnd.x, innerEnd.y,');
    L.push('        "A", INNER_RADIUS, INNER_RADIUS, 0, largeArcFlag, 0, innerStart.x, innerStart.y,');
    L.push('        "Z",');
    L.push('      ].join(" ");');
    L.push('    }');
    L.push('');
  }

  if (has('trend')) {
    L.push('    function _buildTrendPath(buckets) {');
    L.push('      var width = 100;');
    L.push('      var height = 32;');
    L.push('      var pad = 3;');
    L.push('      var maxCount = _.reduce(buckets, function (m, b) { return Math.max(m, b.count); }, 0);');
    L.push('      var n = buckets.length;');
    L.push('      var points = _.map(buckets, function (b, i) {');
    L.push('        var x = n > 1 ? (i / (n - 1)) * width : width / 2;');
    L.push('        var y = maxCount ? height - pad - (b.count / maxCount) * (height - pad * 2) : height - pad;');
    L.push('        return { x: x, y: y, count: b.count, start: b.start };');
    L.push('      });');
    L.push('      var line = _.map(points, function (p) {');
    L.push('        return p.x.toFixed(2) + "," + p.y.toFixed(2);');
    L.push('      }).join(" ");');
    L.push('      var area = line + " " + width.toFixed(2) + "," + height.toFixed(2) + " 0.00," + height.toFixed(2);');
    L.push('      return { line: line, area: area, points: points, maxCount: maxCount };');
    L.push('    }');
    L.push('');
  }

  if (needsAge()) {
    L.push('    function _formatAge(ms) {');
    L.push('      if (ms === null || ms === undefined || ms < 0) {');
    L.push('        return "--";');
    L.push('      }');
    L.push('      var minutes = Math.floor(ms / 60000);');
    L.push('      var hours = Math.floor(minutes / 60);');
    L.push('      var days = Math.floor(hours / 24);');
    L.push('      if (days > 0) {');
    L.push('        return days + "d " + (hours % 24) + "h";');
    L.push('      }');
    L.push('      if (hours > 0) {');
    L.push('        return hours + "h " + (minutes % 60) + "m";');
    L.push('      }');
    L.push('      return minutes + "m";');
    L.push('    }');
    L.push('');
    L.push('    function _ageUrgencyClass(ms) {');
    L.push('      if (ms === null || ms === undefined) {');
    L.push('        return "";');
    L.push('      }');
    L.push('      var hours = ms / 3600000;');
    L.push('      if (hours >= URGENCY_HIGH_HOURS) {');
    L.push('        return "' + prefix() + '-u-high";');
    L.push('      }');
    L.push('      if (hours >= URGENCY_MEDIUM_HOURS) {');
    L.push('        return "' + prefix() + '-u-medium";');
    L.push('      }');
    L.push('      return "' + prefix() + '-u-low";');
    L.push('    }');
    L.push('');
  }

  if (needsMetadata()) {
    L.push('    function openRecord(id) {');
    L.push('      var state = appModulesService.getState($scope.config.module);');
    L.push('      $state.go(state, {');
    L.push('        module: $scope.config.module,');
    L.push('        id: $filter("getEndPathName")(id),');
    L.push('        previousState: $state.current.name,');
    L.push('        previousParams: JSON.stringify($state.params),');
    L.push('      });');
    L.push('    }');
    L.push('');
  }

  L.push('    function _applyAutoRefresh() {');
  L.push('      if (refreshTimer) {');
  L.push('        $interval.cancel(refreshTimer);');
  L.push('        refreshTimer = null;');
  L.push('      }');
  L.push('      if ($scope.config.autoRefresh && $scope.config.refreshInterval) {');
  L.push('        refreshTimer = $interval(_refreshAll, $scope.config.refreshInterval * 1000);');
  L.push('      }');
  L.push('    }');
  L.push('');
  L.push('    $scope.$on("$destroy", function () {');
  L.push('      if (refreshTimer) {');
  L.push('        $interval.cancel(refreshTimer);');
  L.push('      }');
  L.push('    });');
  L.push('');
  L.push('    init();');
  L.push('  }');
  L.push('})();');
  return L.join('\n') + '\n';
}

/*
 * Loaders read their tunables from $scope.config.blocks.<id> rather than from baked
 * literals, so the Edit dialog can retarget them at runtime. Only the block's *type*
 * (and, for stat tiles, whether it counts records or measures age) is fixed here,
 * because those select which query engine runs.
 */
function genBlockLoader(b) {
  var L = [];
  var id = b.id;
  var open = [
    '    function _load_' + id + '() {',
    '      var block = $scope.blocks.' + id + ';',
    '      var settings = $scope.config.blocks.' + id + ';'
  ];

  if (b.type === 'stat' && b.metric === 'count') {
    L = L.concat(open);
    L.push('      block.loading = true;');
    L.push('      _countQuery(_blockFilters(settings))');
    L.push('        .then(');
    L.push('          function (count) { block.value = count; },');
    L.push('          function () { block.value = 0; }');
    L.push('        )');
    L.push('        .finally(function () { block.loading = false; });');
    L.push('    }');
  }

  if (b.type === 'stat' && b.metric === 'oldestAge') {
    L.push('    // Age of the single longest-waiting matching record.');
    L = L.concat(open);
    L.push('      block.loading = true;');
    L.push('      var pagedCollection = new PagedCollection($scope.config.module, null, { $limit: 1 });');
    L.push('      pagedCollection.query = new Query({');
    L.push('        logic: "AND",');
    L.push('        filters: _blockFilters(settings),');
    L.push('        sort: [{ field: $scope.config.dateField, direction: "ASC" }],');
    L.push('        limit: 1,');
    L.push('        __selectFields: [$scope.config.dateField],');
    L.push('      });');
    L.push('      pagedCollection');
    L.push('        .loadGridRecord()');
    L.push('        .then(');
    L.push('          function () {');
    L.push('            var row = pagedCollection.fieldRows[0];');
    L.push('            var raw = row && row[$scope.config.dateField] && row[$scope.config.dateField].value;');
    L.push('            block.value = raw ? Date.now() - new Date(raw).getTime() : null;');
    L.push('          },');
    L.push('          function () { block.value = null; }');
    L.push('        )');
    L.push('        .finally(function () { block.loading = false; });');
    L.push('    }');
  }

  if (b.type === 'delta') {
    L.push('    // Period-over-period comparison: the configured window against the window of');
    L.push('    // the same length immediately before it. Meaningless for period "all".');
    L = L.concat(open);
    L.push('      var totalMs = PERIOD_MS[$scope.config.period];');
    L.push('      if (!totalMs) {');
    L.push('        block.value = null;');
    L.push('        block.changePercent = null;');
    L.push('        return;');
    L.push('      }');
    L.push('      block.loading = true;');
    L.push('      var now = Date.now();');
    L.push('      var currentFrom = new Date(now - totalMs).toISOString();');
    L.push('      var previousFrom = new Date(now - totalMs * 2).toISOString();');
    L.push('      var extra = settings.onlyOpen ? _notClosedFilters() : [];');
    L.push('      var currentFilters = [');
    L.push('        { field: $scope.config.dateField, operator: "gte", value: currentFrom },');
    L.push('      ].concat(extra);');
    L.push('      var previousFilters = [');
    L.push('        { field: $scope.config.dateField, operator: "gte", value: previousFrom },');
    L.push('        { field: $scope.config.dateField, operator: "lt", value: currentFrom },');
    L.push('      ].concat(extra);');
    L.push('      $q.all([_countQuery(currentFilters), _countQuery(previousFilters)])');
    L.push('        .then(');
    L.push('          function (results) {');
    L.push('            block.value = results[0];');
    L.push('            block.previous = results[1];');
    L.push('            // With no baseline a percentage is undefined rather than "100% up".');
    L.push('            block.changePercent = results[1]');
    L.push('              ? Math.round(((results[0] - results[1]) / results[1]) * 1000) / 10');
    L.push('              : null;');
    L.push('            var delta = results[0] - results[1];');
    L.push('            block.direction = delta > 0 ? "up" : delta < 0 ? "down" : "flat";');
    L.push('            block.cssClass =');
    L.push('              block.direction === "flat"');
    L.push('                ? "' + prefix() + '-delta-flat"');
    L.push('                : block.direction === settings.goodDirection');
    L.push('                ? "' + prefix() + '-delta-good"');
    L.push('                : "' + prefix() + '-delta-bad";');
    L.push('            block.arrow = block.direction === "up" ? "\\u25B2" : block.direction === "down" ? "\\u25BC" : "\\u25AC";');
    L.push('          },');
    L.push('          function () { block.value = null; block.changePercent = null; }');
    L.push('        )');
    L.push('        .finally(function () { block.loading = false; });');
    L.push('    }');
  }

  if (b.type === 'metric') {
    L.push('    // Numeric aggregate (MTTR, dwell time, SLA hours ...). The Query API returns');
    L.push('    // the raw number; _formatMetric turns it into a duration when appropriate.');
    L = L.concat(open);
    L.push('      block.loading = true;');
    L.push('      var payload = {');
    L.push('        logic: "AND",');
    L.push('        filters: _blockFilters(settings),');
    L.push('        aggregates: [{ operator: settings.op, field: settings.field, alias: "value" }],');
    L.push('      };');
    L.push('      $resource(API.QUERY + $scope.config.module)');
    L.push('        .save(payload)');
    L.push('        .$promise.then(');
    L.push('          function (result) {');
    L.push('            var rows = result["hydra:member"] || [];');
    L.push('            block.value = rows[0] ? rows[0].value : null;');
    L.push('          },');
    L.push('          function () { block.value = null; }');
    L.push('        )');
    L.push('        .finally(function () { block.loading = false; });');
    L.push('    }');
  }

  if (b.type === 'gauge') {
    L.push('    // Ratio against every record in scope. "Resolved" is derived as total minus');
    L.push('    // still-open, because expressing it directly would need an OR group and the');
    L.push('    // filter list is a flat AND.');
    L = L.concat(open);
    L.push('      block.loading = true;');
    L.push('      var base = _blockFilters(settings);');
    L.push('      var numeratorFilters;');
    L.push('      if (settings.numerator === "unassigned" || settings.numerator === "assigned") {');
    L.push('        numeratorFilters = base.concat([');
    L.push('          { field: settings.ownerField, operator: "isnull", value: settings.numerator === "unassigned" },');
    L.push('        ]);');
    L.push('      } else {');
    L.push('        numeratorFilters = base.concat(_notClosedFilters());');
    L.push('      }');
    L.push('      var invert = settings.numerator === "resolved";');
    L.push('      $q.all([_countQuery(base), _countQuery(numeratorFilters)])');
    L.push('        .then(');
    L.push('          function (results) {');
    L.push('            var total = results[0];');
    L.push('            var matched = invert ? total - results[1] : results[1];');
    L.push('            block.total = total;');
    L.push('            block.matched = matched;');
    L.push('            block.percent = total ? Math.round((matched / total) * 1000) / 10 : null;');
    L.push('            var pct = block.percent || 0;');
    L.push('            var target = settings.target;');
    L.push('            block.color =');
    L.push('              target === null || target === undefined || pct >= target');
    L.push('                ? "#2ea043"');
    L.push('                : pct >= target * 0.8');
    L.push('                ? "#e3b341"');
    L.push('                : "#d9364c";');
    L.push('            // 180-degree arc of radius 40: the dash length encodes the percentage.');
    L.push('            var circumference = Math.PI * 40;');
    L.push('            block.dash = ((pct / 100) * circumference).toFixed(2) + " " + circumference.toFixed(2);');
    L.push('          },');
    L.push('          function () { block.percent = null; }');
    L.push('        )');
    L.push('        .finally(function () { block.loading = false; });');
    L.push('    }');
  }

  if (b.type === 'aging') {
    L.push('    // One count per age band. Bands are absolute ages, so this deliberately does');
    L.push('    // not apply the configured search period.');
    L = L.concat(open);
    L.push('      block.loading = true;');
    L.push('      var now = Date.now();');
    L.push('      var extra = settings.onlyOpen ? _notClosedFilters() : [];');
    L.push('      var results = new Array(AGING_BANDS.length);');
    L.push('      var promises = _.map(AGING_BANDS, function (band, index) {');
    L.push('        var filters = [');
    L.push('          { field: $scope.config.dateField, operator: "lte", value: new Date(now - band.fromH * 3600000).toISOString() },');
    L.push('        ];');
    L.push('        if (band.toH !== null) {');
    L.push('          filters.push({ field: $scope.config.dateField, operator: "gt", value: new Date(now - band.toH * 3600000).toISOString() });');
    L.push('        }');
    L.push('        return _countQuery(filters.concat(extra)).then(');
    L.push('          function (count) { results[index] = count; },');
    L.push('          function () { results[index] = 0; }');
    L.push('        );');
    L.push('      });');
    L.push('      $q.all(promises)');
    L.push('        .then(function () {');
    L.push('          var maxCount = _.reduce(results, function (m, c) { return Math.max(m, c); }, 0);');
    L.push('          block.rows = _.map(AGING_BANDS, function (band, index) {');
    L.push('            return {');
    L.push('              label: band.label,');
    L.push('              value: results[index],');
    L.push('              barPercent: maxCount ? Math.round((results[index] / maxCount) * 1000) / 10 : 0,');
    L.push('              color: band.color,');
    L.push('            };');
    L.push('          });');
    L.push('        })');
    L.push('        .finally(function () { block.loading = false; });');
    L.push('    }');
  }

  if (b.type === 'trend') {
    L.push('    // The Query API has no date-histogram operator, so this fans out one');
    L.push('    // countdistinct query per equal-width time slice and assembles a sparkline.');
    L.push('    // Skipped for period "all" (no fixed range to slice).');
    L = L.concat(open);
    L.push('      var totalMs = PERIOD_MS[$scope.config.period];');
    L.push('      if (!totalMs) {');
    L.push('        block.path = null;');
    L.push('        block.buckets = [];');
    L.push('        return;');
    L.push('      }');
    L.push('      block.loading = true;');
    L.push('      var bucketCount = Math.max(3, Math.min(24, settings.buckets || 12));');
    L.push('      var bucketMs = totalMs / bucketCount;');
    L.push('      var now = Date.now();');
    L.push('      var periodStart = now - totalMs;');
    L.push('      var extra = settings.onlyOpen ? _notClosedFilters() : [];');
    L.push('      var buckets = new Array(bucketCount);');
    L.push('      var promises = [];');
    L.push('');
    L.push('      var loadBucket = function (index) {');
    L.push('        var bucketStart = periodStart + index * bucketMs;');
    L.push('        var bucketEnd = index === bucketCount - 1 ? now : periodStart + (index + 1) * bucketMs;');
    L.push('        var filters = [');
    L.push('          { field: $scope.config.dateField, operator: "gte", value: new Date(bucketStart).toISOString() },');
    L.push('          { field: $scope.config.dateField, operator: "lt", value: new Date(bucketEnd).toISOString() },');
    L.push('        ].concat(extra);');
    L.push('        return _countQuery(filters).then(');
    L.push('          function (count) { buckets[index] = { start: bucketStart, count: count }; },');
    L.push('          function () { buckets[index] = { start: bucketStart, count: 0 }; }');
    L.push('        );');
    L.push('      };');
    L.push('');
    L.push('      for (var i = 0; i < bucketCount; i++) {');
    L.push('        promises.push(loadBucket(i));');
    L.push('      }');
    L.push('');
    L.push('      $q.all(promises)');
    L.push('        .then(function () {');
    L.push('          block.buckets = buckets;');
    L.push('          block.path = _buildTrendPath(buckets);');
    L.push('        })');
    L.push('        .finally(function () { block.loading = false; });');
    L.push('    }');
  }

  if (b.type === 'list') {
    L = L.concat(open);
    L.push('      block.loading = true;');
    L.push('      var selectFields = _.compact([');
    L.push('        $scope.titleField,');
    L.push('        settings.secondaryField,');
    L.push('        $scope.config.dateField,');
    L.push('      ]);');
    L.push('      var limit = settings.limit || 8;');
    L.push('      var pagedCollection = new PagedCollection($scope.config.module, null, { $limit: limit });');
    L.push('      pagedCollection.query = new Query({');
    L.push('        logic: "AND",');
    L.push('        filters: _blockFilters(settings),');
    L.push('        sort: [{ field: settings.sortField || $scope.config.dateField, direction: settings.sortDir }],');
    L.push('        limit: limit,');
    L.push('        __selectFields: selectFields,');
    L.push('      });');
    L.push('      pagedCollection');
    L.push('        .loadGridRecord()');
    L.push('        .then(');
    L.push('          function () {');
    L.push('            block.rows = _.map(pagedCollection.fieldRows, function (row) {');
    L.push('              if (settings.showAge) {');
    L.push('                var raw = row[$scope.config.dateField] && row[$scope.config.dateField].value;');
    L.push('                var ageMs = raw ? Date.now() - new Date(raw).getTime() : null;');
    L.push('                row.__ageLabel = _formatAge(ageMs);');
    L.push('                row.__urgency = _ageUrgencyClass(ageMs);');
    L.push('              }');
    L.push('              return row;');
    L.push('            });');
    L.push('          },');
    L.push('          function () { block.rows = []; }');
    L.push('        )');
    L.push('        .finally(function () { block.loading = false; });');
    L.push('    }');
  }

  if (b.type === 'table') {
    L = L.concat(open);
    L.push('      block.loading = true;');
    L.push('      block.columns = _parseColumns(settings.columns);');
    L.push('      var selectFields = _.compact([$scope.titleField].concat(');
    L.push('        _.map(block.columns, function (col) { return col.field; })');
    L.push('      ));');
    L.push('      var limit = settings.limit || 8;');
    L.push('      var pagedCollection = new PagedCollection($scope.config.module, null, { $limit: limit });');
    L.push('      pagedCollection.query = new Query({');
    L.push('        logic: "AND",');
    L.push('        filters: _blockFilters(settings),');
    L.push('        sort: [{ field: settings.sortField || $scope.config.dateField, direction: settings.sortDir }],');
    L.push('        limit: limit,');
    L.push('        __selectFields: selectFields,');
    L.push('      });');
    L.push('      pagedCollection');
    L.push('        .loadGridRecord()');
    L.push('        .then(');
    L.push('          function () { block.rows = pagedCollection.fieldRows; },');
    L.push('          function () { block.rows = []; }');
    L.push('        )');
    L.push('        .finally(function () { block.loading = false; });');
    L.push('    }');
  }

  if (b.type === 'bars' || b.type === 'donut' || b.type === 'stacked') {
    L = L.concat(open);
    L.push('      block.loading = true;');
    L.push('      var payload = {');
    L.push('        logic: "AND",');
    L.push('        filters: _blockFilters(settings),');
    L.push('        aggregates: [');
    L.push('          { operator: "groupby", field: _groupField(settings), alias: "groupKey" },');
    L.push('          { operator: "countdistinct", field: "uuid", alias: "rCount" },');
    L.push('        ],');
    L.push('      };');
    L.push('      $resource(API.QUERY + $scope.config.module)');
    L.push('        .save(payload)');
    L.push('        .$promise.then(');
    L.push('          function (result) {');
    if (b.type === 'bars') {
      L.push('            block.rows = _buildBars(result["hydra:member"] || [], settings.maxRows);');
    } else if (b.type === 'stacked') {
      L.push('            block.segments = _buildSegments(result["hydra:member"] || []);');
      L.push('            block.total = _.reduce(block.segments, function (sum, s) { return sum + s.value; }, 0);');
    } else {
      L.push('            block.slices = _buildSlices(result["hydra:member"] || []);');
      L.push('            block.total = _.reduce(block.slices, function (sum, s) { return sum + s.value; }, 0);');
    }
    L.push('          },');
    if (b.type === 'bars') {
      L.push('          function () { block.rows = []; }');
    } else if (b.type === 'stacked') {
      L.push('          function () { block.segments = []; block.total = 0; }');
    } else {
      L.push('          function () { block.slices = []; block.total = 0; }');
    }
    L.push('        )');
    L.push('        .finally(function () { block.loading = false; });');
    L.push('    }');
  }

  L.push('');
  return L.join('\n');
}

/* ------------------------------- view.html ------------------------------- */
function genViewHtml() {
  var w = design.widget;
  var P = prefix();
  var L = [];
  L.push('<link rel="stylesheet" type="text/css" href="' + folderName() + '/widgetAssets/css/' + camelSafe(w.name) + '.css" />');
  L.push('<div class="widget-container chart">');
  L.push('    <div class="display-flex-space-between margin-chart">');
  L.push('        <div class="padding-right-0 padding-left-0"');
  L.push('            data-ng-class="(page === \'dashboard\' || page === \'reporting\') ? \'widget-dashboard-title-width\' : \'widget-title-width\'">');
  L.push('            <h5 data-ng-if="config.title !== \'\'" class="padding-left-lg margin-top-0 margin-bottom-0 text-overflow">{{config.title}}</h5>');
  L.push('        </div>');
  L.push('        <div class="padding-right-0 padding-left-0"');
  L.push('            data-ng-class="(page === \'dashboard\' || page === \'reporting\') ? \'widget-dashboard-actions-width\' : \'widget-actions-width\'">');
  L.push('            <span class="icon icon-refresh btn btn-sm pull-right" data-ng-click="refresh()" data-uib-tooltip="Refresh"></span>');
  L.push('            <span class="fa btn widget-action-icon btn-sm pull-right" data-ng-click="collapsed = !collapsed"');
  L.push('                data-ng-class="{\'fa-caret-up\': !collapsed, \'fa-caret-down\': collapsed}"></span>');
  L.push('        </div>');
  L.push('    </div>');
  L.push('    <div data-ng-hide="collapsed">');
  L.push('        <div class="' + P + '">');
  L.push('            <div class="' + P + '-watermark" data-ng-if="!config.module">Open Edit and choose a Data Source to configure this widget.</div>');
  L.push('            <div data-ng-if="config.module && !unauthorized">');
  L.push('                <div class="' + P + '-period">');
  L.push('                    <span class="' + P + '-period-text">{{periodLabel}} <span class="' + P + '-sep">&middot;</span> {{config.dateField}}</span>');
  L.push('                    <span class="' + P + '-live" data-ng-if="config.autoRefresh">&#9679; LIVE</span>');
  L.push('                </div>');
  L.push('                <div class="' + P + '-grid">');
  design.blocks.forEach(function (b) {
    L.push(genBlockHtml(b, P));
  });
  L.push('                </div>');
  L.push('            </div>');
  L.push('        </div>');
  L.push('    </div>');
  L.push('    <div data-ng-show="unauthorized" class="unauthorized-message">');
  L.push('        <h6 class="text-center padding-top-lg padding-bottom-lg font200 font-size-15">You do not have necessary');
  L.push('            permission for {{ config.module | titlecase }}.</h6>');
  L.push('    </div>');
  L.push('</div>');
  return L.join('\n') + '\n';
}

/*
 * Markup binds to config.blocks.<id>.* rather than to values baked in here, so a
 * label change or a width change made in the Edit dialog re-renders immediately
 * without touching the query layer.
 */
function genBlockHtml(b, P) {
  var I = '                    ';
  var C = 'config.blocks.' + b.id;
  var S = 'blocks.' + b.id;
  var L = [];
  var cell = I + '<div class="' + P + '-cell" data-ng-class="\'' + P + '-w\' + ' + C + '.w">';

  function tileOpen(right) {
    return [
      I + '    <div class="' + P + '-tile" data-ng-class="{\'' + P + '-tile-accent\': ' + C + '.accent}">',
      I + '        <div class="' + P + '-tile-label"><span>{{' + C + '.label}}</span>' + (right || '') + '</div>',
      I + '        <div class="' + P + '-tile-body">',
      I + '            <cs-spinner data-ng-if="' + S + '.loading"></cs-spinner>'
    ].join('\n');
  }
  var tileClose = I + '        </div>\n' + I + '    </div>\n' + I + '</div>';

  if (b.type === 'header') {
    L.push(cell);
    L.push(I + '    <div class="' + P + '-section-title">{{' + C + '.text}}</div>');
    L.push(I + '</div>');
    return L.join('\n');
  }

  if (b.type === 'stat') {
    L.push(cell);
    L.push(tileOpen());
    if (b.metric === 'oldestAge') {
      L.push(I + '            <div class="' + P + '-tile-value" data-ng-if="!' + S + '.loading"');
      L.push(I + '                data-ng-class="ageUrgencyClass(' + S + '.value)">{{formatAge(' + S + '.value)}}</div>');
    } else {
      L.push(I + '            <div class="' + P + '-tile-value" data-ng-if="!' + S + '.loading"');
      L.push(I + '                data-ng-class="{\'' + P + '-u-high\': ' + C + '.onlyUnassigned && ' + S + '.value > 0}">{{' + S + '.value | number}}</div>');
    }
    L.push(tileClose);
    return L.join('\n');
  }

  if (b.type === 'delta') {
    L.push(cell);
    L.push(tileOpen());
    L.push(I + '            <div data-ng-if="!' + S + '.loading">');
    L.push(I + '                <div class="' + P + '-tile-value">{{' + S + '.value | number}}</div>');
    L.push(I + '                <div class="' + P + '-tile-sub" data-ng-if="' + S + '.changePercent !== null">');
    L.push(I + '                    <span data-ng-class="' + S + '.cssClass">{{' + S + '.arrow}} {{' + S + '.changePercent | number:1}}%</span>');
    L.push(I + '                    <span>vs previous {{periodLabel | lowercase}}</span>');
    L.push(I + '                </div>');
    L.push(I + '                <div class="' + P + '-tile-sub" data-ng-if="' + S + '.changePercent === null">no prior baseline</div>');
    L.push(I + '            </div>');
    L.push(tileClose);
    return L.join('\n');
  }

  if (b.type === 'metric') {
    L.push(cell);
    L.push(tileOpen());
    L.push(I + '            <div data-ng-if="!' + S + '.loading">');
    L.push(I + '                <div class="' + P + '-tile-value">{{formatMetric(' + S + '.value, ' + C + '.format, ' + C + '.decimals)}}</div>');
    L.push(I + '                <div class="' + P + '-tile-sub">{{' + C + '.op | uppercase}} of {{' + C + '.field}}</div>');
    L.push(I + '            </div>');
    L.push(tileClose);
    return L.join('\n');
  }

  if (b.type === 'gauge') {
    L.push(cell);
    L.push(tileOpen());
    L.push(I + '            <div class="' + P + '-gauge-wrap" data-ng-if="!' + S + '.loading">');
    L.push(I + '                <svg viewBox="0 0 96 56" class="' + P + '-gauge-svg">');
    L.push(I + '                    <path d="M 8 48 A 40 40 0 0 1 88 48" fill="none" stroke="#1c2532" stroke-width="8"></path>');
    L.push(I + '                    <path d="M 8 48 A 40 40 0 0 1 88 48" fill="none" stroke-width="8"');
    L.push(I + '                        data-ng-attr-stroke="{{' + S + '.color}}" data-ng-attr-stroke-dasharray="{{' + S + '.dash}}"></path>');
    L.push(I + '                </svg>');
    L.push(I + '                <div>');
    L.push(I + '                    <div class="' + P + '-gauge-value" data-ng-style="{color: ' + S + '.color}">{{' + S +
      '.percent | number:1}}<span class="' + P + '-tile-unit">%</span></div>');
    L.push(I + '                    <div class="' + P + '-tile-sub">{{' + S + '.matched | number}} of {{' + S + '.total | number}}');
    L.push(I + '                        <span data-ng-if="' + C + '.target !== null">&middot; target {{' + C + '.target}}%</span></div>');
    L.push(I + '                </div>');
    L.push(I + '            </div>');
    L.push(tileClose);
    return L.join('\n');
  }

  if (b.type === 'bars' || b.type === 'aging') {
    L.push(cell);
    L.push(tileOpen());
    L.push(I + '            <div data-ng-if="!' + S + '.loading">');
    L.push(I + '                <div class="' + P + '-empty" data-ng-if="!' + S + '.rows.length">No data</div>');
    L.push(I + '                <div class="' + P + '-bar-row" data-ng-repeat="bar in ' + S + '.rows">');
    if (b.type === 'bars') {
      L.push(I + '                    <div class="' + P + '-bar-rank" data-ng-if="' + C + '.showRank">{{$index + 1}}</div>');
    }
    L.push(I + '                    <div class="' + P + '-bar-label text-overflow" title="{{bar.label}}">{{bar.label}}</div>');
    L.push(I + '                    <div class="' + P + '-bar-track">');
    L.push(I + '                        <div class="' + P + '-bar-fill"');
    L.push(I + '                            data-ng-style="{width: bar.barPercent + \'%\', \'background-color\': bar.color}"></div>');
    L.push(I + '                    </div>');
    L.push(I + '                    <div class="' + P + '-bar-value">{{bar.value}}</div>');
    L.push(I + '                </div>');
    L.push(I + '            </div>');
    L.push(tileClose);
    return L.join('\n');
  }

  if (b.type === 'stacked') {
    L.push(cell);
    L.push(tileOpen('<span class="' + P + '-tile-total">{{' + S + '.total | number}}</span>'));
    L.push(I + '            <div data-ng-if="!' + S + '.loading">');
    L.push(I + '                <div class="' + P + '-empty" data-ng-if="!' + S + '.segments.length">No data</div>');
    L.push(I + '                <div class="' + P + '-seg-bar" data-ng-if="' + S + '.segments.length">');
    L.push(I + '                    <div class="' + P + '-seg" data-ng-repeat="seg in ' + S + '.segments"');
    L.push(I + '                        data-ng-style="{width: seg.percent + \'%\', \'background-color\': seg.color}"');
    L.push(I + '                        title="{{seg.label}}: {{seg.value}} ({{seg.percent}}%)"></div>');
    L.push(I + '                </div>');
    L.push(I + '                <div class="' + P + '-seg-legend">');
    L.push(I + '                    <div class="' + P + '-seg-key" data-ng-repeat="seg in ' + S + '.segments">');
    L.push(I + '                        <span class="' + P + '-seg-swatch" data-ng-style="{\'background-color\': seg.color}"></span>');
    L.push(I + '                        <span>{{seg.label}}</span><b>{{seg.value}}</b>');
    L.push(I + '                    </div>');
    L.push(I + '                </div>');
    L.push(I + '            </div>');
    L.push(tileClose);
    return L.join('\n');
  }

  if (b.type === 'donut') {
    L.push(cell);
    L.push(tileOpen());
    L.push(I + '            <div data-ng-if="!' + S + '.loading">');
    L.push(I + '                <div class="' + P + '-empty" data-ng-if="!' + S + '.slices.length">No data</div>');
    L.push(I + '                <div class="' + P + '-donut-layout" data-ng-if="' + S + '.slices.length"');
    L.push(I + '                    data-ng-class="\'' + P + '-legend-\' + ' + C + '.legend">');
    L.push(I + '                    <div class="' + P + '-donut-wrap">');
    L.push(I + '                        <svg viewBox="0 0 200 200" class="' + P + '-donut-svg" data-ng-if="' + S + '.slices.length > 1">');
    L.push(I + '                            <path data-ng-repeat="slice in ' + S + '.slices" data-ng-attr-d="{{slice.path}}"');
    L.push(I + '                                data-ng-attr-fill="{{slice.color}}" class="' + P + '-slice">');
    L.push(I + '                                <title>{{slice.label}}: {{slice.value}} ({{slice.percent}}%)</title>');
    L.push(I + '                            </path>');
    L.push(I + '                        </svg>');
    L.push(I + '                        <svg viewBox="0 0 200 200" class="' + P + '-donut-svg" data-ng-if="' + S + '.slices.length === 1">');
    L.push(I + '                            <circle cx="100" cy="100" data-ng-attr-r="{{ringMidRadius}}" fill="none"');
    L.push(I + '                                data-ng-attr-stroke="{{' + S + '.slices[0].color}}"');
    L.push(I + '                                data-ng-attr-stroke-width="{{ringThickness}}" class="' + P + '-slice"></circle>');
    L.push(I + '                        </svg>');
    L.push(I + '                        <div class="' + P + '-donut-center">');
    L.push(I + '                            <div class="' + P + '-donut-total">{{' + S + '.total | number}}</div>');
    L.push(I + '                            <div class="' + P + '-donut-caption">Total</div>');
    L.push(I + '                        </div>');
    L.push(I + '                    </div>');
    L.push(I + '                    <ul class="' + P + '-legend">');
    L.push(I + '                        <li data-ng-repeat="slice in ' + S + '.slices" class="' + P + '-legend-item">');
    L.push(I + '                            <span class="' + P + '-legend-dot" data-ng-style="{\'background-color\': slice.color}"></span>');
    L.push(I + '                            <span class="' + P + '-legend-label text-overflow" title="{{slice.label}}">{{slice.label}}</span>');
    L.push(I + '                            <span class="' + P + '-legend-value">{{slice.value}}</span>');
    L.push(I + '                        </li>');
    L.push(I + '                    </ul>');
    L.push(I + '                </div>');
    L.push(I + '            </div>');
    L.push(tileClose);
    return L.join('\n');
  }

  if (b.type === 'trend') {
    L.push(cell);
    L.push(I + '    <div class="' + P + '-section-title">{{' + C + '.label}}</div>');
    L.push(I + '    <cs-spinner data-ng-if="' + S + '.loading"></cs-spinner>');
    L.push(I + '    <div class="' + P + '-trend-wrap" data-ng-if="!' + S + '.loading && ' + S + '.path">');
    L.push(I + '        <svg viewBox="0 0 100 32" preserveAspectRatio="none" class="' + P + '-trend-svg">');
    L.push(I + '            <polyline points="0,10.67 100,10.67" class="' + P + '-trend-grid"></polyline>');
    L.push(I + '            <polyline points="0,21.33 100,21.33" class="' + P + '-trend-grid"></polyline>');
    L.push(I + '            <polygon data-ng-attr-points="{{' + S + '.path.area}}" class="' + P + '-trend-area"></polygon>');
    L.push(I + '            <polyline data-ng-attr-points="{{' + S + '.path.line}}" class="' + P + '-trend-line"></polyline>');
    L.push(I + '            <circle data-ng-repeat="p in ' + S + '.path.points" data-ng-attr-cx="{{p.x}}" data-ng-attr-cy="{{p.y}}"');
    L.push(I + '                r="3" class="' + P + '-trend-hit"><title>{{p.count}} records</title></circle>');
    L.push(I + '        </svg>');
    L.push(I + '        <div class="' + P + '-trend-range">');
    L.push(I + '            <span>{{' + S + '.buckets[0].start | date:\'MMM d, HH:mm\'}}</span>');
    L.push(I + '            <span>now</span>');
    L.push(I + '        </div>');
    L.push(I + '    </div>');
    L.push(I + '</div>');
    return L.join('\n');
  }

  if (b.type === 'list') {
    L.push(cell);
    L.push(I + '    <div class="' + P + '-section-title">{{' + C + '.label}}');
    L.push(I + '        <span class="' + P + '-section-sub" data-ng-if="' + C + '.subtitle">{{' + C + '.subtitle}}</span></div>');
    L.push(I + '    <cs-spinner data-ng-if="' + S + '.loading"></cs-spinner>');
    L.push(I + '    <div data-ng-if="!' + S + '.loading">');
    L.push(I + '        <div class="' + P + '-watermark" data-ng-if="!' + S + '.rows.length">No matching records</div>');
    L.push(I + '        <div class="' + P + '-row" data-ng-repeat="record in ' + S + '.rows"');
    L.push(I + '            data-ng-click="openRecord(record[\'@id\'].value)" role="button" tabindex="0">');
    L.push(I + '            <span class="' + P + '-dot" data-ng-if="' + C + '.showAge" data-ng-class="record.__urgency"></span>');
    L.push(I + '            <div class="' + P + '-row-title text-overflow" data-cs-view-field="record[titleField]"></div>');
    L.push(I + '            <div class="' + P + '-row-meta">');
    L.push(I + '                <span data-ng-if="' + C + '.secondaryField" data-cs-view-field="record[' + C + '.secondaryField]"></span>');
    L.push(I + '                <span data-ng-if="' + C + '.showAge" data-ng-class="record.__urgency">{{record.__ageLabel}}</span>');
    L.push(I + '            </div>');
    L.push(I + '        </div>');
    L.push(I + '    </div>');
    L.push(I + '</div>');
    return L.join('\n');
  }

  if (b.type === 'table') {
    L.push(cell);
    L.push(I + '    <div class="' + P + '-section-title">{{' + C + '.label}}</div>');
    L.push(I + '    <cs-spinner data-ng-if="' + S + '.loading"></cs-spinner>');
    L.push(I + '    <div data-ng-if="!' + S + '.loading">');
    L.push(I + '        <div class="' + P + '-watermark" data-ng-if="!' + S + '.rows.length">No matching records</div>');
    L.push(I + '        <table class="' + P + '-table" data-ng-if="' + S + '.rows.length">');
    L.push(I + '            <thead>');
    L.push(I + '                <tr>');
    L.push(I + '                    <th>Name</th>');
    L.push(I + '                    <th data-ng-repeat="col in ' + S + '.columns">{{col.label}}</th>');
    L.push(I + '                </tr>');
    L.push(I + '            </thead>');
    L.push(I + '            <tbody>');
    L.push(I + '                <tr data-ng-repeat="record in ' + S + '.rows"');
    L.push(I + '                    data-ng-click="openRecord(record[\'@id\'].value)" role="button" tabindex="0">');
    L.push(I + '                    <td class="' + P + '-table-title" data-cs-view-field="record[titleField]"></td>');
    L.push(I + '                    <td data-ng-repeat="col in ' + S + '.columns" data-cs-view-field="record[col.field]"></td>');
    L.push(I + '                </tr>');
    L.push(I + '            </tbody>');
    L.push(I + '        </table>');
    L.push(I + '    </div>');
    L.push(I + '</div>');
    return L.join('\n');
  }
  return '';
}

/* ------------------------------ edit files ------------------------------ */

/*
 * The Edit dialog is driven by a generated blockMeta array rather than by hand-written
 * markup per block, so edit.html stays the same length whether the widget has two
 * blocks or twenty - only the metadata grows (a few lines per block).
 */
function genEditController() {
  var w = design.widget;
  var L = [];
  L.push('"use strict";');
  L.push('(function () {');
  L.push('  angular');
  L.push('    .module("cybersponse")');
  L.push('    .controller(' + jsStr(editCtrlName()) + ', ' + editCtrlName() + ');');
  L.push('');
  L.push('  ' + editCtrlName() + '.$inject = [');
  L.push('    "$scope",');
  L.push('    "$uibModalInstance",');
  L.push('    "config",');
  L.push('    "appModulesService",');
  L.push('    "Entity",');
  L.push('    "_",');
  L.push('  ];');
  L.push('');
  L.push('  function ' + editCtrlName() + '($scope, $uibModalInstance, config, appModulesService, Entity, _) {');
  L.push('    $scope.cancel = cancel;');
  L.push('    $scope.save = save;');
  L.push('    $scope.onModuleChange = onModuleChange;');
  L.push('    $scope.toggleBlock = toggleBlock;');
  L.push('');
  L.push('    // Which per-block settings this widget exposes. Generated by the designer from');
  L.push('    // the block layout; the layout itself is fixed at build time.');
  L.push('    $scope.blockMeta = [');
  design.blocks.forEach(function (b) {
    var spec = EDITABLE_SPEC[b.type] || [];
    L.push('      {');
    L.push('        id: ' + jsStr(b.id) + ',');
    L.push('        title: ' + jsStr(BLOCKS[b.type].name) + ',');
    L.push('        open: false,');
    L.push('        fields: [');
    spec.forEach(function (f) {
      var parts = ['key: ' + jsStr(f.key), 'label: ' + jsStr(f.label), 'kind: ' + jsStr(f.kind)];
      if (f.options) {
        parts.push('options: [' + f.options.map(function (o) {
          return '{ value: ' + (typeof o.v === 'number' ? o.v : jsStr(o.v)) + ', label: ' + jsStr(o.l) + ' }';
        }).join(', ') + ']');
      }
      // Only shown when the block's "kind" setting equals this value (see refAttr).
      if (f.showIf) parts.push('showIf: ' + jsStr(f.showIf));
      L.push('          { ' + parts.join(', ') + ' },');
    });
    L.push('        ],');
    L.push('      },');
  });
  L.push('    ];');
  L.push('');
  L.push('    var BLOCK_DEFAULTS = {');
  design.blocks.forEach(function (b) {
    var s = blockSettings(b);
    var pairs = Object.keys(s).map(function (k) {
      var v = s[k];
      return k + ': ' + (typeof v === 'string' ? jsStr(v) : typeof v === 'boolean' ? String(v) : v === null || v === undefined ? 'null' : v);
    });
    L.push('      ' + b.id + ': { ' + pairs.join(', ') + ' },');
  });
  L.push('    };');
  L.push('');
  L.push('    function _init() {');
  L.push('      var _config = {');
  L.push('        title: ' + jsStr(w.title) + ',');
  L.push('        module: ' + jsStr(w.module) + ',');
  L.push('        dateField: ' + jsStr(w.dateField) + ',');
  L.push('        period: ' + jsStr(w.period) + ',');
  L.push('        autoRefresh: ' + (w.autoRefresh ? 'true' : 'false') + ',');
  L.push('        refreshInterval: ' + w.refreshInterval + ',');
  L.push('      };');
  L.push('      $scope.config = {};');
  L.push('      angular.extend($scope.config, _config, config);');
  L.push('      // Merge shipped defaults underneath anything already saved so a widget');
  L.push('      // configured before a setting existed still opens with a valid value.');
  L.push('      $scope.config.blocks = $scope.config.blocks || {};');
  L.push('      angular.forEach(BLOCK_DEFAULTS, function (defaults, blockId) {');
  L.push('        $scope.config.blocks[blockId] = angular.extend({}, defaults, $scope.config.blocks[blockId]);');
  L.push('      });');
  L.push('');
  L.push('      $scope.pageConfig = {');
  L.push('        periods: [');
  L.push('          { value: "24h", label: "Last 24 Hours" },');
  L.push('          { value: "7d", label: "Last 7 Days" },');
  L.push('          { value: "30d", label: "Last 30 Days" },');
  L.push('          { value: "90d", label: "Last 90 Days" },');
  L.push('          { value: "all", label: "All Time" },');
  L.push('        ],');
  L.push('        refreshIntervals: [');
  L.push('          { value: 60, label: "1 minute" },');
  L.push('          { value: 300, label: "5 minutes" },');
  L.push('          { value: 600, label: "10 minutes" },');
  L.push('          { value: 900, label: "15 minutes" },');
  L.push('          { value: 1800, label: "30 minutes" },');
  L.push('        ],');
  L.push('      };');
  L.push('');
  L.push('      appModulesService.load(true).then(function (modules) {');
  L.push('        $scope.modules = modules;');
  L.push('        if ($scope.config.module) {');
  L.push('          loadAttributes();');
  L.push('        }');
  L.push('      });');
  L.push('    }');
  L.push('');
  L.push('    function onModuleChange() {');
  L.push('      // Fields differ per module, so anything pointing at the previous module');
  L.push('      // rarely makes sense for the new one.');
  L.push('      $scope.config.dateField = null;');
  L.push('      loadAttributes();');
  L.push('    }');
  L.push('');
  L.push('    function toggleBlock(meta) {');
  L.push('      meta.open = !meta.open;');
  L.push('    }');
  L.push('');
  L.push('    function loadAttributes() {');
  L.push('      $scope.dateFields = [];');
  L.push('      $scope.allFields = [];');
  L.push('      var entity = new Entity($scope.config.module);');
  L.push('      entity.loadFields().then(function () {');
  L.push('        // Scan the raw field map (not just getFormFieldsArray()) so system/audit');
  L.push('        // fields such as createDate still appear as candidates.');
  L.push('        _.forEach(entity.fields, function (field, name) {');
  L.push('          var option = { name: name, title: field.title || name };');
  L.push('          $scope.allFields.push(option);');
  L.push('          if (field.type === "datetime") {');
  L.push('            $scope.dateFields.push(option);');
  L.push('          }');
  L.push('        });');
  L.push('        if (!$scope.config.dateField) {');
  L.push('          var preferred = _.find($scope.dateFields, { name: ' + jsStr(w.dateField) + ' });');
  L.push('          $scope.config.dateField = preferred');
  L.push('            ? preferred.name');
  L.push('            : ($scope.dateFields[0] && $scope.dateFields[0].name) || null;');
  L.push('        }');
  L.push('      });');
  L.push('    }');
  L.push('');
  L.push('    function cancel() {');
  L.push('      $uibModalInstance.dismiss("cancel");');
  L.push('    }');
  L.push('');
  L.push('    function save() {');
  L.push('      if ($scope.' + formName() + '.$invalid) {');
  L.push('        $scope.' + formName() + '.$setTouched();');
  L.push('        $scope.' + formName() + '.$focusOnFirstError();');
  L.push('        return;');
  L.push('      }');
  L.push('      $uibModalInstance.close($scope.config);');
  L.push('    }');
  L.push('');
  L.push('    _init();');
  L.push('  }');
  L.push('})();');
  return L.join('\n') + '\n';
}

function genEditHtml() {
  var w = design.widget;
  var F = formName();
  var L = [];
  L.push('<form data-ng-submit="save()" class="noMargin" name="' + F + '" novalidate>');
  L.push('  <div class="modal-header">');
  L.push('    <h3 class="modal-title col-md-9">' + esc(w.title) + ' Edit View</h3>');
  L.push('    <button type="button" class="close" data-ng-click="cancel()" data-dismiss="modal" aria-label="Close"');
  L.push('      id="close-edit-widget-form-btn">');
  L.push('      <div aria-hidden="true" class="version-button">+</div>');
  L.push('    </button>');
  L.push('  </div>');
  L.push('  <div class="modal-body">');
  L.push('    <div class="form-group" data-ng-class="{ \'has-error\': ' + F + '.title.$invalid && ' + F + '.title.$touched }">');
  L.push('      <label for="title" class="control-label">Title <span class="text-danger">*</span></label>');
  L.push('      <input id="title" name="title" type="text" class="form-control" data-ng-model="config.title" required>');
  L.push('      <div data-cs-messages="' + F + '.title"></div>');
  L.push('    </div>');
  L.push('');
  L.push('    <div class="form-group" data-ng-class="{ \'has-error\': ' + F + '.wModule.$invalid && ' + F + '.wModule.$touched }"');
  L.push('      data-ng-if="modules">');
  L.push('      <label for="wModule" class="control-label">Data Source<span class="text-danger">*</span></label>');
  L.push('      <select name="wModule" id="wModule" class="form-control"');
  L.push('        data-ng-options="module.type as module.name for module in modules | playbookModules"');
  L.push('        data-ng-model="config.module" data-ng-change="onModuleChange()" required>');
  L.push('        <option value="">Select an Option</option>');
  L.push('      </select>');
  L.push('      <div data-cs-messages="' + F + '.wModule"></div>');
  L.push('    </div>');
  L.push('');
  L.push('    <div class="form-group" data-ng-class="{ \'has-error\': ' + F + '.wDateField.$invalid && ' + F + '.wDateField.$touched }"');
  L.push('      data-ng-if="config.module">');
  L.push('      <label for="wDateField" class="control-label">Time Range Field <span class="text-danger">*</span>');
  L.push('        <span data-uib-tooltip="Which Date/Time field the Search Period measures against."');
  L.push('          data-tooltip-append-to-body="true"><i class="margin-left-sm icon icon-information font-Size-13"></i></span>');
  L.push('      </label>');
  L.push('      <select id="wDateField" name="wDateField" class="form-control" data-ng-model="config.dateField"');
  L.push('        data-ng-options="field.name as field.title for field in dateFields | orderBy: \'title\'" required>');
  L.push('        <option value="">Select a field</option>');
  L.push('      </select>');
  L.push('      <div data-cs-messages="' + F + '.wDateField"></div>');
  L.push('    </div>');
  L.push('');
  L.push('    <div class="form-group" data-ng-if="config.module">');
  L.push('      <label for="wPeriod" class="control-label">Search Period <span class="text-danger">*</span></label>');
  L.push('      <select id="wPeriod" name="wPeriod" class="form-control" style="width:50%"');
  L.push('        data-ng-options="opt.value as opt.label for opt in pageConfig.periods"');
  L.push('        data-ng-model="config.period" required>');
  L.push('      </select>');
  L.push('    </div>');
  L.push('');
  L.push('    <div class="mertics-widget-border padding-top-md padding-bottom-md" data-ng-if="config.module"></div>');
  L.push('    <div class="margin-top-md margin-bottom-md" data-ng-if="config.module"><h6>Auto Refresh</h6></div>');
  L.push('    <div class="checkbox" data-ng-if="config.module">');
  L.push('      <label for="autoRefresh">');
  L.push('        <input id="autoRefresh" type="checkbox" name="autoRefresh" data-ng-model="config.autoRefresh">Automatically refresh this widget</label>');
  L.push('    </div>');
  L.push('    <div class="form-group" data-ng-if="config.module && config.autoRefresh">');
  L.push('      <label for="refreshInterval" class="control-label">Refresh Interval</label>');
  L.push('      <select name="refreshInterval" id="refreshInterval" class="form-control" style="width:40%"');
  L.push('        data-ng-options="opt.value as opt.label for opt in pageConfig.refreshIntervals"');
  L.push('        data-ng-model="config.refreshInterval" required>');
  L.push('      </select>');
  L.push('    </div>');
  L.push('');
  L.push('    <div class="mertics-widget-border padding-top-md padding-bottom-md" data-ng-if="config.module"></div>');
  L.push('    <div class="margin-top-md margin-bottom-md" data-ng-if="config.module">');
  L.push('      <h6>Panels');
  L.push('        <span data-uib-tooltip="Retarget or relabel each panel. The set of panels and their order are fixed by the widget package."');
  L.push('          data-tooltip-append-to-body="true"><i class="margin-left-sm icon icon-information font-Size-13"></i></span>');
  L.push('      </h6>');
  L.push('    </div>');
  L.push('');
  L.push('    <!-- One generic renderer for every panel: the shape of each form comes from');
  L.push('         blockMeta, so adding panels never lengthens this template. -->');
  L.push('    <div data-ng-if="config.module" data-ng-repeat="meta in blockMeta" class="margin-bottom-sm">');
  L.push('      <div class="cursor-pointer padding-sm" data-ng-click="toggleBlock(meta)"');
  L.push('        style="border: 1px solid rgba(128,128,128,0.25); border-radius: 2px;">');
  L.push('        <i class="fa" data-ng-class="{\'fa-caret-down\': meta.open, \'fa-caret-right\': !meta.open}"></i>');
  L.push('        <strong class="margin-left-sm">{{config.blocks[meta.id].label || config.blocks[meta.id].text || meta.title}}</strong>');
  L.push('        <span class="muted margin-left-sm font-size-12">{{meta.title}}</span>');
  L.push('      </div>');
  L.push('');
  L.push('      <div data-ng-if="meta.open" class="padding-md"');
  L.push('        style="border: 1px solid rgba(128,128,128,0.18); border-top: none;">');
  L.push('        <div data-ng-repeat="f in meta.fields"');
  L.push('          data-ng-if="!f.showIf || config.blocks[meta.id].kind === f.showIf">');
  L.push('');
  L.push('          <div class="checkbox" data-ng-if="f.kind === \'bool\'">');
  L.push('            <label>');
  L.push('              <input type="checkbox" data-ng-model="config.blocks[meta.id][f.key]">{{f.label}}</label>');
  L.push('          </div>');
  L.push('');
  L.push('          <div class="form-group" data-ng-if="f.kind !== \'bool\'">');
  L.push('            <label class="control-label">{{f.label}}</label>');
  L.push('');
  L.push('            <input type="text" class="form-control" data-ng-if="f.kind === \'text\'"');
  L.push('              data-ng-model="config.blocks[meta.id][f.key]">');
  L.push('');
  L.push('            <input type="number" class="form-control" style="width:40%" data-ng-if="f.kind === \'number\'"');
  L.push('              data-ng-model="config.blocks[meta.id][f.key]">');
  L.push('');
  L.push('            <select class="form-control" data-ng-if="f.kind === \'select\'"');
  L.push('              data-ng-options="opt.value as opt.label for opt in f.options"');
  L.push('              data-ng-model="config.blocks[meta.id][f.key]"></select>');
  L.push('');
  L.push('            <!-- Real field dropdown: the widget has Entity at runtime, so unlike the');
  L.push('                 designer this cannot be given a field name that does not exist. -->');
  L.push('            <select class="form-control" data-ng-if="f.kind === \'anyField\'"');
  L.push('              data-ng-options="field.name as field.title for field in allFields | orderBy: \'title\'"');
  L.push('              data-ng-model="config.blocks[meta.id][f.key]">');
  L.push('              <option value="">Select a field</option>');
  L.push('            </select>');
  L.push('          </div>');
  L.push('        </div>');
  L.push('      </div>');
  L.push('    </div>');
  L.push('  </div>');
  L.push('  <div class="modal-footer">');
  L.push('    <button id="edit-widget-save" type="submit" class="btn btn-sm btn-primary"><i');
  L.push('        class="icon icon-check margin-right-sm"></i>Save</button>');
  L.push('    <button id="edit-widget-cancel" type="button" class="btn btn-sm btn-default" data-ng-click="cancel()"><i');
  L.push('        class="icon icon-close margin-right-sm"></i>Close</button>');
  L.push('  </div>');
  L.push('</form>');
  return L.join('\n') + '\n';
}

/* --------------------------------- CSS ---------------------------------- */
function hexToRgb(hex) {
  var m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '#00e5ff');
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [0, 229, 255];
}

function genCss() {
  var P = prefix();
  var a = design.widget.accent || '#00e5ff';
  var rgb = hexToRgb(a).join(', ');
  var L = [];

  L.push('/*');
  L.push(' * Generated by the FortiSOAR Widget Designer.');
  L.push(' *');
  L.push(' * Enterprise security-console styling: flat surfaces, 1px rules, near-square');
  L.push(' * corners and tabular figures. Colour is reserved for severity/state meaning, so');
  L.push(' * nothing decorative competes with the data.');
  L.push(' *');
  L.push(' * Every rule is scoped under .' + P + ' so this fixed dark panel never bleeds into');
  L.push(' * the platform chrome (title bar, collapse arrow, unauthorized message) or into');
  L.push(' * other widgets sharing the dashboard, regardless of the host theme.');
  L.push(' */');
  L.push('.' + P + ' {');
  L.push('  position: relative;');
  L.push('  padding: 14px;');
  L.push('  color: #dce3ec;');
  L.push('  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Malgun Gothic", sans-serif;');
  L.push('  font-size: 13px;');
  L.push('  background-color: #0d1218;');
  L.push('  border: 1px solid #1c2532;');
  L.push('}');
  L.push('');
  L.push('/* Counts and durations line up column-wise when they update in place. */');
  L.push('.' + P + ' [class*="-value"],');
  L.push('.' + P + ' [class*="-total"] {');
  L.push('  font-variant-numeric: tabular-nums;');
  L.push('}');
  L.push('');
  L.push('.' + P + '-watermark {');
  L.push('  padding: 18px 4px;');
  L.push('  text-align: center;');
  L.push('  color: #65748a;');
  L.push('  font-size: 12px;');
  L.push('}');
  L.push('');
  L.push('.' + P + '-period {');
  L.push('  display: flex;');
  L.push('  align-items: center;');
  L.push('  justify-content: space-between;');
  L.push('  margin-bottom: 12px;');
  L.push('  padding-bottom: 8px;');
  L.push('  border-bottom: 1px solid #232c3a;');
  L.push('  font-size: 11px;');
  L.push('  text-transform: uppercase;');
  L.push('  letter-spacing: 0.09em;');
  L.push('  color: #8b99ab;');
  L.push('}');
  L.push('');
  L.push('.' + P + '-sep { opacity: 0.5; margin: 0 3px; }');
  L.push('');
  L.push('.' + P + '-live {');
  L.push('  color: #2ea043;');
  L.push('  font-weight: 600;');
  L.push('  font-size: 10px;');
  L.push('  letter-spacing: 0.09em;');
  L.push('  border: 1px solid rgba(46, 160, 67, 0.4);');
  L.push('  padding: 2px 7px;');
  L.push('  border-radius: 2px;');
  L.push('}');
  L.push('');
  L.push('/* 12-column grid; every block declares its span via a ' + P + '-wN class. */');
  L.push('.' + P + '-grid {');
  L.push('  position: relative;');
  L.push('  display: grid;');
  L.push('  grid-template-columns: repeat(12, 1fr);');
  L.push('  gap: 14px;');
  L.push('  align-items: start;');
  L.push('}');
  L.push('');
  L.push('/* Span defaults to full width so a cell is never zero-width if its saved');
  L.push('   width setting is missing or out of range. */');
  L.push('.' + P + '-cell { grid-column: span 12; }');
  L.push('');
  [3, 4, 6, 8, 12].forEach(function (n) {
    L.push('.' + P + '-w' + n + ' { grid-column: span ' + n + '; }');
  });
  L.push('');
  L.push('/* Below ~640px a 12-col grid turns every tile into an unreadable sliver, so');
  L.push('   collapse to a single column. */');
  L.push('@media (max-width: 640px) {');
  L.push('  .' + P + '-cell,');
  [3, 4, 6, 8, 12].forEach(function (n, i, arr) {
    L.push('  .' + P + '-w' + n + (i === arr.length - 1 ? ' { grid-column: span 12; }' : ','));
  });
  L.push('}');
  L.push('');
  L.push('.' + P + '-tile {');
  L.push('  height: 100%;');
  L.push('  background: #141b24;');
  L.push('  border: 1px solid #232c3a;');
  L.push('  border-radius: 2px;');
  L.push('}');
  L.push('');
  L.push('/* Emphasis comes from a top rule, not a glow. */');
  L.push('.' + P + '-tile-accent { border-top: 2px solid ' + a + '; }');
  L.push('');
  L.push('.' + P + '-tile-label {');
  L.push('  display: flex;');
  L.push('  align-items: center;');
  L.push('  justify-content: space-between;');
  L.push('  font-size: 10px;');
  L.push('  text-transform: uppercase;');
  L.push('  letter-spacing: 0.11em;');
  L.push('  color: #8b99ab;');
  L.push('  padding: 8px 12px;');
  L.push('  border-bottom: 1px solid #232c3a;');
  L.push('}');
  L.push('');
  L.push('.' + P + '-tile-body { padding: 12px; }');
  L.push('.' + P + '-tile-total { color: #f0f4f9; font-size: 12px; }');
  L.push('');
  L.push('.' + P + '-tile-value {');
  L.push('  font-size: 30px;');
  L.push('  font-weight: 600;');
  L.push('  line-height: 1.05;');
  L.push('  letter-spacing: -0.01em;');
  L.push('  color: #f0f4f9;');
  L.push('}');
  L.push('');
  L.push('.' + P + '-tile-unit { font-size: 13px; color: #8b99ab; margin-left: 3px; font-weight: 400; }');
  L.push('.' + P + '-tile-sub { font-size: 11px; color: #8b99ab; margin-top: 5px; }');
  L.push('.' + P + '-tile-sub span + span { margin-left: 5px; }');
  L.push('');
  L.push('/* Severity/urgency ramp - the only place strong colour is allowed. */');
  L.push('.' + P + '-u-low { color: #2ea043 !important; }');
  L.push('.' + P + '-u-medium { color: #e3b341 !important; }');
  L.push('.' + P + '-u-high { color: #d9364c !important; }');
  L.push('');
  L.push('.' + P + '-empty { font-size: 12px; padding: 4px 0; color: #65748a; }');
  L.push('');
  L.push('.' + P + '-section-title {');
  L.push('  font-size: 11px;');
  L.push('  font-weight: 600;');
  L.push('  text-transform: uppercase;');
  L.push('  letter-spacing: 0.11em;');
  L.push('  color: #8b99ab;');
  L.push('  margin-bottom: 9px;');
  L.push('  padding-bottom: 6px;');
  L.push('  border-bottom: 1px solid #232c3a;');
  L.push('}');
  L.push('');
  L.push('.' + P + '-section-sub {');
  L.push('  text-transform: none;');
  L.push('  font-weight: 400;');
  L.push('  letter-spacing: normal;');
  L.push('  font-size: 11px;');
  L.push('  opacity: 0.7;');
  L.push('  margin-left: 8px;');
  L.push('}');

  if (has('delta')) {
    L.push('');
    L.push('/* "Good" and "bad" are per-widget: for backlog a rise is bad, for closures it is good. */');
    L.push('.' + P + '-delta-good { color: #2ea043; }');
    L.push('.' + P + '-delta-bad { color: #d9364c; }');
    L.push('.' + P + '-delta-flat { color: #8b99ab; }');
  }

  if (has('gauge')) {
    L.push('');
    L.push('.' + P + '-gauge-wrap { display: flex; align-items: center; gap: 14px; }');
    L.push('.' + P + '-gauge-svg { width: 96px; height: 56px; flex: 0 0 auto; }');
    L.push('.' + P + '-gauge-value { font-size: 24px; font-weight: 600; line-height: 1; font-variant-numeric: tabular-nums; }');
  }

  if (has('stacked')) {
    L.push('');
    L.push('.' + P + '-seg-bar { display: flex; height: 22px; border: 1px solid #232c3a; overflow: hidden; }');
    L.push('.' + P + '-seg { height: 100%; }');
    L.push('.' + P + '-seg-legend { display: flex; flex-wrap: wrap; gap: 4px 14px; margin-top: 9px; }');
    L.push('.' + P + '-seg-key { display: flex; align-items: center; gap: 6px; font-size: 11px; color: #c3ccd8; }');
    L.push('.' + P + '-seg-key b { color: #f0f4f9; }');
    L.push('.' + P + '-seg-swatch { width: 8px; height: 8px; flex: 0 0 auto; }');
  }

  if (has('table')) {
    L.push('');
    L.push('.' + P + '-table { width: 100%; border-collapse: collapse; font-size: 12px; }');
    L.push('');
    L.push('.' + P + '-table th {');
    L.push('  text-align: left;');
    L.push('  font-size: 10px;');
    L.push('  text-transform: uppercase;');
    L.push('  letter-spacing: 0.09em;');
    L.push('  font-weight: 600;');
    L.push('  color: #8b99ab;');
    L.push('  padding: 6px 9px;');
    L.push('  background: #111720;');
    L.push('  border-bottom: 1px solid #2c3846;');
    L.push('}');
    L.push('');
    L.push('.' + P + '-table td { padding: 6px 9px; border-bottom: 1px solid #1c2532; color: #c3ccd8; }');
    L.push('.' + P + '-table tbody tr { cursor: pointer; }');
    L.push('.' + P + '-table tbody tr:hover td { background: #161d28; }');
    L.push('.' + P + '-table-title { color: #dce3ec; }');
  }

  if (has('bars') || has('aging')) {
    L.push('');
    L.push('.' + P + '-bar-row { display: flex; align-items: center; gap: 8px; margin-bottom: 7px; }');
    L.push('.' + P + '-bar-row:last-child { margin-bottom: 0; }');
    L.push('');
    L.push('.' + P + '-bar-rank { flex: 0 0 auto; width: 14px; font-size: 10px; color: #65748a; font-variant-numeric: tabular-nums; }');
    L.push('');
    L.push('.' + P + '-bar-label {');
    L.push('  flex: 0 0 32%;');
    L.push('  max-width: 32%;');
    L.push('  font-size: 12px;');
    L.push('  overflow: hidden;');
    L.push('  text-overflow: ellipsis;');
    L.push('  white-space: nowrap;');
    L.push('  color: #c3ccd8;');
    L.push('}');
    L.push('');
    L.push('.' + P + '-bar-track {');
    L.push('  flex: 1 1 auto;');
    L.push('  height: 6px;');
    L.push('  background-color: #1c2532;');
    L.push('  overflow: hidden;');
    L.push('}');
    L.push('');
    L.push('.' + P + '-bar-fill { height: 100%; transition: width 0.3s ease-out; }');
    L.push('');
    L.push('.' + P + '-bar-value {');
    L.push('  flex: 0 0 auto;');
    L.push('  font-size: 12px;');
    L.push('  font-weight: 600;');
    L.push('  min-width: 22px;');
    L.push('  text-align: right;');
    L.push('  color: #f0f4f9;');
    L.push('}');
  }

  if (has('donut')) {
    L.push('');
    L.push('/* flex-wrap stays "nowrap": with wrapping, a narrow dashboard column would push');
    L.push('   the legend below the chart regardless of the configured legend position. */');
    L.push('.' + P + '-donut-layout { display: flex; align-items: center; gap: 12px; flex-wrap: nowrap; }');
    L.push('.' + P + '-legend-right { flex-direction: row; }');
    L.push('.' + P + '-legend-left { flex-direction: row-reverse; }');
    L.push('.' + P + '-legend-bottom { flex-direction: column; align-items: stretch; }');
    L.push('.' + P + '-legend-top { flex-direction: column-reverse; align-items: stretch; }');
    L.push('');
    L.push('.' + P + '-donut-wrap { position: relative; flex: 0 0 auto; width: 118px; height: 118px; margin: 0 auto; }');
    L.push('.' + P + '-donut-svg { width: 100%; height: 100%; overflow: visible; }');
    L.push('.' + P + '-slice { fill-opacity: 1; }');
    L.push('');
    L.push('.' + P + '-donut-center {');
    L.push('  position: absolute;');
    L.push('  top: 50%;');
    L.push('  left: 50%;');
    L.push('  transform: translate(-50%, -50%);');
    L.push('  text-align: center;');
    L.push('  pointer-events: none;');
    L.push('  width: 62%;');
    L.push('}');
    L.push('');
    L.push('.' + P + '-donut-total { font-size: 20px; font-weight: 600; line-height: 1.1; color: #f0f4f9; }');
    L.push('.' + P + '-donut-caption { font-size: 9px; color: #8b99ab; letter-spacing: 0.1em; text-transform: uppercase; }');
    L.push('');
    L.push('.' + P + '-legend { list-style: none; margin: 0; padding: 0; flex: 1 1 90px; min-width: 56px; max-height: 150px; overflow-y: auto; }');
    L.push('.' + P + '-legend-bottom .' + P + '-legend,');
    L.push('.' + P + '-legend-top .' + P + '-legend { flex-basis: auto; min-width: 0; width: 100%; }');
    L.push('.' + P + '-legend-item { display: flex; align-items: center; gap: 8px; padding: 3px 0; font-size: 11px; color: #c3ccd8; }');
    L.push('.' + P + '-legend-dot { width: 8px; height: 8px; flex: 0 0 auto; }');
    L.push('.' + P + '-legend-label { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }');
    L.push('.' + P + '-legend-value { flex: 0 0 auto; font-weight: 700; }');
  }

  if (has('trend')) {
    L.push('');
    L.push('.' + P + '-trend-wrap {');
    L.push('  background: #141b24;');
    L.push('  border: 1px solid #232c3a;');
    L.push('  border-radius: 2px;');
    L.push('  padding: 10px 12px 6px;');
    L.push('}');
    L.push('');
    L.push('.' + P + '-trend-svg { width: 100%; height: 58px; overflow: visible; display: block; }');
    L.push('');
    L.push('.' + P + '-trend-line {');
    L.push('  fill: none;');
    L.push('  stroke: ' + a + ';');
    L.push('  stroke-width: 1.5;');
    L.push('  vector-effect: non-scaling-stroke;');
    L.push('}');
    L.push('');
    L.push('.' + P + '-trend-area { fill: rgba(' + rgb + ', 0.14); stroke: none; }');
    L.push('.' + P + '-trend-grid { stroke: #1c2532; stroke-width: 1; vector-effect: non-scaling-stroke; fill: none; }');
    L.push('.' + P + '-trend-hit { fill: rgba(0, 0, 0, 0.01); stroke: none; pointer-events: all; }');
    L.push('.' + P + '-trend-range { display: flex; justify-content: space-between; font-size: 10px; color: #65748a; margin-top: 3px; }');
  }

  if (has('list')) {
    L.push('');
    L.push('/* Rows share a single collapsed 1px rule so the list reads as one table body. */');
    L.push('.' + P + '-row {');
    L.push('  display: flex;');
    L.push('  align-items: center;');
    L.push('  justify-content: space-between;');
    L.push('  gap: 10px;');
    L.push('  padding: 7px 10px;');
    L.push('  background: #141b24;');
    L.push('  border: 1px solid #232c3a;');
    L.push('  border-top: none;');
    L.push('  cursor: pointer;');
    L.push('  transition: background-color 0.12s ease-out;');
    L.push('}');
    L.push('');
    L.push('.' + P + '-row:first-of-type { border-top: 1px solid #232c3a; }');
    L.push('.' + P + '-row:hover { background: #1a2230; }');
    L.push('');
    L.push('/* A flat severity bar reads faster than a dot at list density. */');
    L.push('.' + P + '-dot { flex: 0 0 auto; width: 3px; height: 22px; background-color: #2ea043; }');
    L.push('.' + P + '-dot.' + P + '-u-medium { background-color: #e3b341; }');
    L.push('.' + P + '-dot.' + P + '-u-high { background-color: #d9364c; }');
    L.push('');
    L.push('.' + P + '-row-title {');
    L.push('  flex: 1 1 auto;');
    L.push('  min-width: 0;');
    L.push('  overflow: hidden;');
    L.push('  text-overflow: ellipsis;');
    L.push('  white-space: nowrap;');
    L.push('  font-size: 13px;');
    L.push('  color: #dce3ec;');
    L.push('}');
    L.push('');
    L.push('.' + P + '-row-meta {');
    L.push('  flex: 0 0 auto;');
    L.push('  display: flex;');
    L.push('  align-items: center;');
    L.push('  gap: 12px;');
    L.push('  font-size: 11px;');
    L.push('  color: #8b99ab;');
    L.push('  white-space: nowrap;');
    L.push('  font-variant-numeric: tabular-nums;');
    L.push('}');
  }

  return L.join('\n') + '\n';
}

/* ------------------------- regenerate + render ------------------------- */
function fileList() {
  var w = design.widget;
  return [
    { n: 'info.json', c: generated['info.json'] },
    { n: 'view.html', c: generated['view.html'] },
    { n: 'view.controller.js', c: generated['view.controller.js'] },
    { n: 'edit.html', c: generated['edit.html'] },
    { n: 'edit.controller.js', c: generated['edit.controller.js'] },
    { n: 'widgetAssets/css/' + camelSafe(w.name) + '.css', c: generated['css'] }
  ];
}

function regen() {
  generated['info.json'] = genInfoJson();
  generated['view.html'] = genViewHtml();
  generated['view.controller.js'] = genViewController();
  generated['edit.html'] = genEditHtml();
  generated['edit.controller.js'] = genEditController();
  generated['css'] = genCss();
  renderCode();
}

function highlight(src, lang) {
  var out = esc(src);
  if (lang === 'js' || lang === 'json') {
    out = out.replace(/(\/\/[^\n]*)/g, '<span class="c">$1</span>');
    out = out.replace(/(&quot;(?:[^&\\]|\\.|&(?!quot;))*&quot;)/g, '<span class="s">$1</span>');
    out = out.replace(/\b(function|var|return|if|else|for|new|true|false|null|undefined)\b/g, '<span class="k">$1</span>');
  } else if (lang === 'html') {
    out = out.replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="c">$1</span>');
    out = out.replace(/(&quot;[^&]*?&quot;)/g, '<span class="s">$1</span>');
    out = out.replace(/(&lt;\/?[a-zA-Z0-9-]+)/g, '<span class="k">$1</span>');
  } else if (lang === 'css') {
    out = out.replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="c">$1</span>');
    out = out.replace(/(\.[a-zA-Z0-9_-]+)(?=[\s,{:])/g, '<span class="k">$1</span>');
  }
  return out;
}

function langOf(name) {
  if (/\.json$/.test(name)) return 'json';
  if (/\.js$/.test(name)) return 'js';
  if (/\.css$/.test(name)) return 'css';
  return 'html';
}

function renderCode() {
  var files = fileList();
  var tabsEl = document.getElementById('tabs');
  if (!files.some(function (f) { return f.n === activeTab; })) activeTab = files[0].n;

  tabsEl.innerHTML = files.map(function (f) {
    var short = f.n.indexOf('/') >= 0 ? f.n.split('/').pop() : f.n;
    return '<button class="tab' + (f.n === activeTab ? ' on' : '') + '" data-tab="' + esc(f.n) + '">' + esc(short) + '</button>';
  }).join('');

  tabsEl.querySelectorAll('[data-tab]').forEach(function (t) {
    t.addEventListener('click', function () { activeTab = t.dataset.tab; renderCode(); });
  });

  var cur = files.filter(function (f) { return f.n === activeTab; })[0];
  document.getElementById('code').innerHTML = highlight(cur.c || '', langOf(cur.n));

  // Surface design-time mistakes that would only show up as a broken widget on the
  // dashboard (empty field names, missing module, very chatty refresh settings).
  var warns = [];
  if (!design.widget.module) warns.push('No module set - the widget will render its "choose a Data Source" placeholder.');
  design.blocks.forEach(function (b) {
    if ((b.type === 'bars' || b.type === 'donut') && !b.field) {
      warns.push('"' + b.label + '" has no Group By field.');
    }
  });
  if (needsNotClosed()) {
    warns.push('Blocks filtered to "unresolved" assume a picklist field named "status". Edit STATUS_FIELD / CLOSED_STATE_KEYWORDS in view.controller.js if your module differs.');
  }
  // Rough per-refresh query cost, so a heavy board does not get an aggressive interval.
  var COST = { header: 0, trend: 12, aging: 5, gauge: 2, delta: 2 };
  var queries = design.blocks.reduce(function (s, b) {
    return s + (b.type === 'trend' ? (b.buckets || 12) : (COST[b.type] == null ? 1 : COST[b.type]));
  }, 0);
  if (queries > 12 && design.widget.autoRefresh && design.widget.refreshInterval < 300) {
    warns.push('This layout fires about ' + queries + ' queries per refresh; consider a 5 minute or slower interval.');
  }
  if (has('delta') && design.widget.period === 'all') {
    warns.push('Trend KPI blocks need a bounded period - they render "no prior baseline" while the period is All Time.');
  }
  design.blocks.forEach(function (b) {
    if (b.type === 'metric' && !b.field) warns.push('"' + b.label + '" has no numeric field set.');
  });
  document.getElementById('warnBox').innerHTML = warns.length
    ? '<div class="warn">' + warns.map(esc).join('<br>') + '</div>' : '';
}

function renderAll() {
  renderCanvas();
  renderProps();
  regen();
}

