"use strict";

/* ========================= CODE GENERATION ========================== */
function prefix() { return 'fsw-' + camelSafe(design.widget.name).toLowerCase(); }
function ctrlName() { return camelSafe(design.widget.name) + verTag(design.widget.version) + 'Ctrl'; }
function editCtrlName() { return 'edit' + pascal(camelSafe(design.widget.name)) + verTag(design.widget.version) + 'Ctrl'; }
function folderName() { return camelSafe(design.widget.name) + '-' + design.widget.version; }
function formName() { return 'edit' + pascal(camelSafe(design.widget.name)) + 'Form'; }

function usesAny(fn) { return design.blocks.some(fn); }
function has(type) { return design.blocks.some(function (b) { return b.type === type; }); }

/* Any block other than a static Section Title queries the module, so it needs the
 * Query service to turn its saved Filter Criteria into a request payload. */
function needsQuery() { return usesAny(function (b) { return b.type !== 'header'; }); }
function needsPaged() { return has('table'); }
/* Entity is used at runtime purely to auto-detect whether a Group By field is a
 * picklist or a lookup/reference, so the query can target the right sub-attribute -
 * this is never asked as a design-time question (see blocks.js). */
function needsEntity() { return has('bars') || has('donut') || has('stacked'); }
/* appModulesService/$state/$filter exist only to make table rows clickable. */
function needsOpenRecord() { return has('table'); }
function needsColorFor() { return has('bars') || has('donut') || has('stacked'); }
function needsSegments() { return has('stacked'); }
function needsMetricFmt() { return has('metric'); }
/* Only Ratio Gauge fires two queries in parallel (numerator + denominator). */
function needsQAll() { return has('gauge'); }
/* Every KPI/aggregate block (not table, which uses PagedCollection instead)
 * shares the same "apply Filter Criteria, then aggregate" helper. */
function needsAggregateHelper() {
  return has('stat') || has('metric') || has('gauge') || has('bars') || has('donut') || has('stacked');
}

/*
 * Which per-block settings stay editable inside FortiSOAR's own Edit dialog.
 *
 * The block *list* (which blocks exist and in what order) is design-time - that is
 * what this tool is for. Everything below is runtime, so a SOC admin can retarget,
 * relabel or refilter a panel without regenerating and reinstalling the widget.
 *
 * There is deliberately no "time scope" / "only unresolved" / "only unassigned"
 * setting anywhere: every block that queries records gets one "filter" kind field
 * instead - a real FortiSOAR Filter Criteria (cs-conditional, with datetime fields
 * switched to datetime.quick so Relative values like "Today" work). An admin who
 * wants "unresolved only" just adds that condition to the block's own filter, using
 * the platform's real filter UI instead of a heuristic this tool would have to guess.
 *
 * "anyField" kinds render as real dropdowns in the Edit dialog because the widget has
 * Entity available at runtime - strictly better than typing a field name here, where
 * nothing can validate it. Likewise, whether a Group By field is a picklist or a
 * lookup is auto-detected at runtime, never asked.
 */
var WIDTH_CHOICES = [
  { v: 3, l: '1/4' }, { v: 4, l: '1/3' }, { v: 6, l: '1/2' },
  { v: 8, l: '2/3' }, { v: 12, l: '전체 너비' }
];

var F_LABEL = { key: 'label', label: '제목', kind: 'text' };
var F_WIDTH = { key: 'w', label: '너비', kind: 'select', options: WIDTH_CHOICES };
function filterField(key, label) {
  return { key: key, label: label || '필터 정의', kind: 'filter' };
}

var EDITABLE_SPEC = {
  stat: [F_LABEL, filterField('query'), { key: 'accent', label: '강조 표시', kind: 'bool' }, F_WIDTH],
  metric: [F_LABEL,
    { key: 'field', label: '숫자 필드', kind: 'anyField' },
    { key: 'op', label: '집계 방식', kind: 'select', options: [{ v: 'avg', l: '평균' }, { v: 'median', l: '중앙값' }, { v: 'sum', l: '합계' }, { v: 'max', l: '최댓값' }, { v: 'min', l: '최솟값' }] },
    { key: 'format', label: '표시 형식', kind: 'select', options: [{ v: 'number', l: '일반 숫자' }, { v: 'seconds', l: '기간 (초)' }, { v: 'minutes', l: '기간 (분)' }, { v: 'hours', l: '기간 (시간)' }, { v: 'percent', l: '백분율' }] },
    { key: 'decimals', label: '소수점 자리수', kind: 'number' },
    filterField('query'),
    { key: 'accent', label: '강조 표시', kind: 'bool' }, F_WIDTH],
  gauge: [F_LABEL,
    filterField('denominatorQuery', '분모 필터 정의'),
    filterField('numeratorQuery', '분자 필터 정의'),
    { key: 'target', label: '목표 비율(%)', kind: 'number' },
    { key: 'accent', label: '강조 표시', kind: 'bool' }, F_WIDTH],
  bars: [F_LABEL,
    { key: 'field', label: '그룹 기준 필드', kind: 'anyField' },
    filterField('query'),
    { key: 'maxRows', label: '최대 표시 행 수', kind: 'number' }, F_WIDTH],
  stacked: [F_LABEL,
    { key: 'field', label: '그룹 기준 필드', kind: 'anyField' },
    filterField('query'), F_WIDTH],
  donut: [F_LABEL,
    { key: 'field', label: '그룹 기준 필드', kind: 'anyField' },
    filterField('query'),
    { key: 'legend', label: '범례 위치', kind: 'select', options: [{ v: 'right', l: '오른쪽' }, { v: 'left', l: '왼쪽' }, { v: 'top', l: '위' }, { v: 'bottom', l: '아래' }] }, F_WIDTH],
  table: [F_LABEL,
    { key: 'columns', label: '필드', kind: 'anyFieldMulti' },
    { key: 'sortField', label: '정렬 필드', kind: 'anyField' },
    { key: 'sortDir', label: '정렬 방향', kind: 'select', options: [{ v: 'DESC', l: '최신순' }, { v: 'ASC', l: '오래된순' }] },
    { key: 'limit', label: '행 수 제한', kind: 'number' },
    filterField('query'), F_WIDTH],
  header: [{ key: 'text', label: '텍스트', kind: 'text' }, F_WIDTH]
};

/* Serializes a field's showIf condition - either { key, truthy: true } (show when
 * another setting is truthy) or { key, value: x | [x, y] } (show when it equals one
 * of the given values) - into the object literal source emitted into blockMeta.
 * Nothing in EDITABLE_SPEC uses this today (the field-kind/scope questions it used
 * to gate are gone), but it costs nothing to leave in for future per-block options. */
function showIfExpr(showIf) {
  var parts = ['key: ' + jsStr(showIf.key)];
  if (showIf.truthy) {
    parts.push('truthy: true');
  } else if (Array.isArray(showIf.value)) {
    parts.push('value: [' + showIf.value.map(jsStr).join(', ') + ']');
  } else {
    parts.push('value: ' + jsStr(showIf.value));
  }
  return '{ ' + parts.join(', ') + ' }';
}

function editableKeys(type) {
  return (EDITABLE_SPEC[type] || []).map(function (f) { return f.key; });
}

/* Runtime settings object for one block, emitted into the saved config. */
function blockSettings(b) {
  var out = {};
  editableKeys(b.type).forEach(function (k) { out[k] = b[k]; });
  return out;
}

/* Any JS value (including nested objects/arrays, e.g. a Filter Criteria's default
 * { filters: [] }) as a literal expression - JSON's syntax is a valid JS literal, so
 * this covers every default value type without hand-rolling key/value pair joins. */
function litExpr(value) {
  return value === undefined ? 'null' : JSON.stringify(value);
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
  var L = [];
  var deps = ['$scope', 'config', '$resource', 'API', 'currentPermissionsService', '$interval', '_'];
  if (needsQuery()) { deps.push('Query'); }
  if (needsPaged()) { deps.push('PagedCollection'); }
  if (needsEntity() || needsOpenRecord()) { deps.push('Entity'); }
  if (needsOpenRecord()) { deps.push('appModulesService', '$state', '$filter'); }
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

  if (needsColorFor()) {
    L.push('');
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
  if (has('donut')) {
    L.push('    var CENTER = 100;');
    L.push('    var OUTER_RADIUS = 90;');
    L.push('    var INNER_RADIUS = 56;');
    L.push('    var SEGMENT_GAP = 4;');
  }
  L.push('');
  L.push('    // Per-block settings the Edit dialog can change at runtime. Shipped defaults');
  L.push('    // are merged underneath whatever was saved, so a widget configured before a');
  L.push('    // new setting existed still gets a sane value instead of undefined.');
  L.push('    var BLOCK_DEFAULTS = {');
  design.blocks.forEach(function (b) {
    L.push('      ' + b.id + ': ' + litExpr(blockSettings(b)) + ',');
  });
  L.push('    };');
  L.push('');
  L.push('    $scope.config = angular.copy(config);');
  L.push('    $scope.config.blocks = $scope.config.blocks || {};');
  L.push('    angular.forEach(BLOCK_DEFAULTS, function (defaults, blockId) {');
  L.push('      $scope.config.blocks[blockId] = angular.extend({}, defaults, $scope.config.blocks[blockId]);');
  L.push('    });');
  L.push('    $scope.collapsed =');
  L.push('      $scope.page !== undefined &&');
  L.push('      $scope.page.toLowerCase() !== "dashboard" &&');
  L.push('      $scope.page.toLowerCase() !== "reporting";');
  L.push('    $scope.blocks = {');
  design.blocks.forEach(function (b) {
    if (b.type === 'header') return;
    if (b.type === 'stat' || b.type === 'metric') L.push('      ' + b.id + ': { loading: false, value: null },');
    else if (b.type === 'gauge') L.push('      ' + b.id + ': { loading: false, percent: null, matched: 0, total: 0, dash: "0 125.66", color: "#7d8b9e" },');
    else if (b.type === 'bars') L.push('      ' + b.id + ': { loading: false, rows: [] },');
    else if (b.type === 'stacked') L.push('      ' + b.id + ': { loading: false, segments: [], total: 0 },');
    else if (b.type === 'donut') L.push('      ' + b.id + ': { loading: false, slices: [], total: 0 },');
    else if (b.type === 'table') L.push('      ' + b.id + ': { loading: false, rows: [] },');
  });
  L.push('    };');
  L.push('    $scope.refresh = _refreshAll;');
  if (needsOpenRecord()) {
    L.push('    $scope.openRecord = openRecord;');
  }
  if (needsMetricFmt()) { L.push('    $scope.formatMetric = _formatMetric;'); }
  if (has('donut')) {
    L.push('    $scope.ringMidRadius = (OUTER_RADIUS + INNER_RADIUS) / 2;');
    L.push('    $scope.ringThickness = OUTER_RADIUS - INNER_RADIUS;');
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
  if (needsEntity() || needsOpenRecord()) {
    L.push('      _loadMetadata();');
  } else {
    L.push('      _refreshAll();');
    L.push('      _applyAutoRefresh();');
  }
  L.push('    }');
  L.push('');

  if (needsEntity() || needsOpenRecord()) {
    L.push('    function _loadMetadata() {');
    L.push('      var entity = new Entity($scope.config.module);');
    L.push('      entity.loadFields().then(function () {');
    if (needsEntity()) {
      L.push('        // Picklist and lookup fields store an IRI as their raw value, so a Group By');
      L.push('        // query must target a sub-attribute to resolve the human-readable bucket.');
      L.push('        // Detected here from the module\'s real schema rather than asked up front.');
      L.push('        var relationshipFields = entity.getRelationshipFields();');
      L.push('        $scope.fieldSuffix = {};');
      L.push('        angular.forEach(entity.fields, function (field, name) {');
      L.push('          if (field.type === "picklist") {');
      L.push('            $scope.fieldSuffix[name] = "itemValue";');
      L.push('          } else if (relationshipFields[name]) {');
      L.push('            // Best-effort guess at the display attribute - verify against your');
      L.push('            // instance\'s schema if a lookup module doesn\'t use "name".');
      L.push('            $scope.fieldSuffix[name] = "name";');
      L.push('          }');
      L.push('        });');
    }
    if (has('table')) {
      L.push('        // Column headers show the field\'s real schema title, resolved here rather');
      L.push('        // than typed by hand - the Edit dialog only lets an admin pick field names.');
      L.push('        $scope.fieldTitle = {};');
      L.push('        angular.forEach(entity.fields, function (field, name) {');
      L.push('          $scope.fieldTitle[name] = field.title || name;');
      L.push('        });');
    }
    L.push('      }).finally(function () {');
    L.push('        _refreshAll();');
    L.push('        _applyAutoRefresh();');
    L.push('      });');
    L.push('    }');
    L.push('');
  }

  if (needsColorFor()) {
    L.push('    function _groupField(fieldName) {');
    L.push('      var suffix = $scope.fieldSuffix[fieldName];');
    L.push('      return suffix ? fieldName + "." + suffix : fieldName;');
    L.push('    }');
    L.push('');
  }

  if (needsAggregateHelper()) {
    L.push('    // Turns a block\'s saved Filter Criteria into a request payload and attaches');
    L.push('    // the given aggregates. This is the one place every KPI/chart block goes');
    L.push('    // through, so retargeting a block\'s filter in the Edit dialog just works.');
    L.push('    function _aggregateQuery(queryConfig, aggregates) {');
    L.push('      var payload = new Query(angular.copy(queryConfig || { filters: [] })).getQuery(true);');
    L.push('      payload.aggregates = aggregates;');
    L.push('      return $resource(API.QUERY + $scope.config.module).save(payload).$promise;');
    L.push('    }');
    L.push('');
    L.push('    function _countQuery(queryConfig) {');
    L.push('      return _aggregateQuery(queryConfig, [{ operator: "countdistinct", field: "uuid", alias: "count" }]).then(');
    L.push('        function (result) {');
    L.push('          var rows = result["hydra:member"] || [];');
    L.push('          return (rows[0] && rows[0].count) || 0;');
    L.push('        }');
    L.push('      );');
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

  if (needsOpenRecord()) {
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
 * Loaders read their tunables (including the Filter Criteria itself) from
 * $scope.config.blocks.<id> rather than from baked literals, so the Edit dialog can
 * retarget them at runtime with no code change. Only the block's *type* is fixed
 * here, because that selects which query engine runs.
 */
function genBlockLoader(b) {
  var L = [];
  var id = b.id;
  var open = [
    '    function _load_' + id + '() {',
    '      var block = $scope.blocks.' + id + ';',
    '      var settings = $scope.config.blocks.' + id + ';'
  ];

  if (b.type === 'stat') {
    L = L.concat(open);
    L.push('      block.loading = true;');
    L.push('      _countQuery(settings.query)');
    L.push('        .then(');
    L.push('          function (count) { block.value = count; },');
    L.push('          function () { block.value = 0; }');
    L.push('        )');
    L.push('        .finally(function () { block.loading = false; });');
    L.push('    }');
  }

  if (b.type === 'metric') {
    L.push('    // Numeric aggregate (MTTR, dwell time, SLA hours ...). The Query API returns');
    L.push('    // the raw number; _formatMetric turns it into a duration when appropriate.');
    L = L.concat(open);
    L.push('      block.loading = true;');
    L.push('      _aggregateQuery(settings.query, [{ operator: settings.op, field: settings.field, alias: "value" }])');
    L.push('        .then(');
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
    L.push('    // Percentage = (records matching Numerator Filter Criteria) / (records');
    L.push('    // matching Denominator Filter Criteria). Both are independent, admin-owned');
    L.push('    // filters - e.g. denominator = everything, numerator = Status is Resolved.');
    L = L.concat(open);
    L.push('      block.loading = true;');
    L.push('      $q.all([_countQuery(settings.denominatorQuery), _countQuery(settings.numeratorQuery)])');
    L.push('        .then(');
    L.push('          function (results) {');
    L.push('            var total = results[0];');
    L.push('            var matched = results[1];');
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

  if (b.type === 'bars' || b.type === 'donut' || b.type === 'stacked') {
    L = L.concat(open);
    L.push('      block.loading = true;');
    L.push('      _aggregateQuery(settings.query, [');
    L.push('        { operator: "groupby", field: _groupField(settings.field), alias: "groupKey" },');
    L.push('        { operator: "countdistinct", field: "uuid", alias: "rCount" },');
    L.push('      ])');
    L.push('        .then(');
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

  if (b.type === 'table') {
    L = L.concat(open);
    L.push('      block.loading = true;');
    L.push('      // Nothing picked in the Edit dialog: fall back to the record id alone,');
    L.push('      // rather than a table with no columns at all.');
    L.push('      block.columns = angular.isArray(settings.columns) && settings.columns.length');
    L.push('        ? _.map(settings.columns, function (name) {');
    L.push('            return { field: name, label: $scope.fieldTitle[name] || name };');
    L.push('          })');
    L.push('        : [{ field: "id", label: "ID" }];');
    L.push('      var selectFields = _.compact(_.map(block.columns, function (col) { return col.field; }));');
    L.push('      var limit = settings.limit || 8;');
    L.push('      var queryConfig = angular.extend({}, settings.query, {');
    L.push('        limit: limit,');
    L.push('        __selectFields: selectFields,');
    L.push('      });');
    L.push('      if (settings.sortField) {');
    L.push('        queryConfig.sort = [{ field: settings.sortField, direction: settings.sortDir }];');
    L.push('      }');
    L.push('      var pagedCollection = new PagedCollection($scope.config.module, null, { $limit: limit });');
    L.push('      pagedCollection.query = new Query(queryConfig);');
    L.push('      pagedCollection');
    L.push('        .loadGridRecord()');
    L.push('        .then(');
    L.push('          function () { block.rows = pagedCollection.fieldRows; },');
    L.push('          function () { block.rows = []; }');
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
  L.push('            <div class="' + P + '-watermark" data-ng-if="!config.module">위젯 설정에서 데이터 소스를 선택해 주세요.</div>');
  L.push('            <div data-ng-if="config.module && !unauthorized">');
  L.push('                <div class="' + P + '-status" data-ng-if="config.autoRefresh">');
  L.push('                    <span class="' + P + '-live">&#9679; LIVE</span>');
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
    L.push(I + '            <div class="' + P + '-tile-value" data-ng-if="!' + S + '.loading">{{' + S + '.value | number}}</div>');
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

  if (b.type === 'bars') {
    L.push(cell);
    L.push(tileOpen());
    L.push(I + '            <div data-ng-if="!' + S + '.loading">');
    L.push(I + '                <div class="' + P + '-empty" data-ng-if="!' + S + '.rows.length">No data</div>');
    L.push(I + '                <div class="' + P + '-bar-row" data-ng-repeat="bar in ' + S + '.rows">');
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

  if (b.type === 'table') {
    L.push(cell);
    L.push(I + '    <div class="' + P + '-section-title">{{' + C + '.label}}</div>');
    L.push(I + '    <cs-spinner data-ng-if="' + S + '.loading"></cs-spinner>');
    L.push(I + '    <div data-ng-if="!' + S + '.loading">');
    L.push(I + '        <div class="' + P + '-watermark" data-ng-if="!' + S + '.rows.length">No matching records</div>');
    L.push(I + '        <table class="' + P + '-table" data-ng-if="' + S + '.rows.length">');
    L.push(I + '            <thead>');
    L.push(I + '                <tr>');
    L.push(I + '                    <th data-ng-repeat="col in ' + S + '.columns">{{col.label}}</th>');
    L.push(I + '                </tr>');
    L.push(I + '            </thead>');
    L.push(I + '            <tbody>');
    L.push(I + '                <tr data-ng-repeat="record in ' + S + '.rows"');
    L.push(I + '                    data-ng-click="openRecord(record[\'@id\'].value)" role="button" tabindex="0">');
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
  L.push('    $scope.fieldVisible = fieldVisible;');
  L.push('');
  L.push('    // Which per-block settings this widget exposes, and the shape of each one\'s');
  L.push('    // input. Generated by the designer from the block layout; the layout itself');
  L.push('    // (which panels exist, and in what order) is fixed at build time.');
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
      if (f.showIf) parts.push('showIf: ' + showIfExpr(f.showIf));
      L.push('          { ' + parts.join(', ') + ' },');
    });
    L.push('        ],');
    L.push('      },');
  });
  L.push('    ];');
  L.push('');
  L.push('    var BLOCK_DEFAULTS = {');
  design.blocks.forEach(function (b) {
    L.push('      ' + b.id + ': ' + litExpr(blockSettings(b)) + ',');
  });
  L.push('    };');
  L.push('');
  L.push('    function _init() {');
  L.push('      var _config = {');
  L.push('        title: ' + jsStr(w.title) + ',');
  L.push('        module: ' + jsStr(w.module) + ',');
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
  L.push('        refreshIntervals: [');
  L.push('          { value: 60, label: "1 분" },');
  L.push('          { value: 300, label: "5 분" },');
  L.push('          { value: 600, label: "10 분" },');
  L.push('          { value: 900, label: "15 분" },');
  L.push('          { value: 1800, label: "30 분" },');
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
  L.push('      // Field names and Filter Criteria are module-specific, so anything pointing');
  L.push('      // at the previous module is reset rather than carried over silently wrong.');
  L.push('      angular.forEach($scope.blockMeta, function (meta) {');
  L.push('        angular.forEach(meta.fields, function (f) {');
  L.push('          if (f.kind === "anyField") {');
  L.push('            $scope.config.blocks[meta.id][f.key] = null;');
  L.push('          } else if (f.kind === "anyFieldMulti") {');
  L.push('            $scope.config.blocks[meta.id][f.key] = [];');
  L.push('          } else if (f.kind === "filter") {');
  L.push('            $scope.config.blocks[meta.id][f.key] = { filters: [] };');
  L.push('          }');
  L.push('        });');
  L.push('      });');
  L.push('      loadAttributes();');
  L.push('    }');
  L.push('');
  L.push('    function toggleBlock(meta) {');
  L.push('      meta.open = !meta.open;');
  L.push('    }');
  L.push('');
  L.push('    // Hides fields that only make sense alongside another setting on the same');
  L.push('    // block. Nothing in this widget\'s panels needs this today, but it costs');
  L.push('    // nothing to support for future per-block options.');
  L.push('    function fieldVisible(f, blockId) {');
  L.push('      if (!f.showIf) {');
  L.push('        return true;');
  L.push('      }');
  L.push('      var current = $scope.config.blocks[blockId][f.showIf.key];');
  L.push('      if (f.showIf.truthy) {');
  L.push('        return !!current;');
  L.push('      }');
  L.push('      return angular.isArray(f.showIf.value)');
  L.push('        ? f.showIf.value.indexOf(current) >= 0');
  L.push('        : current === f.showIf.value;');
  L.push('    }');
  L.push('');
  L.push('    function loadAttributes() {');
  L.push('      $scope.allFields = [];');
  L.push('      var entity = new Entity($scope.config.module);');
  L.push('      entity.loadFields().then(function () {');
  L.push('        // "datetime" fields default to an exact date/time picker in the filter');
  L.push('        // builder. Switching to "datetime.quick" is what makes every Filter Criteria');
  L.push('        // below offer the Relative option (Today, Last 7 Days, ...) for that field.');
  L.push('        for (var key in entity.fields) {');
  L.push('          if (entity.fields[key].type === "datetime") {');
  L.push('            entity.fields[key].type = "datetime.quick";');
  L.push('          }');
  L.push('        }');
  L.push('        $scope.fields = entity.getFormFields();');
  L.push('        angular.extend($scope.fields, entity.getRelationshipFields());');
  L.push('        // Scan the raw field map (not just getFormFieldsArray()) so system/audit');
  L.push('        // fields such as createDate still show up as Sort Field / Group By options.');
  L.push('        $scope.allFields = _.map(entity.fields, function (field, name) {');
  L.push('          return { name: name, title: field.title || name };');
  L.push('        });');
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
  L.push('    <h3 class="modal-title col-md-9">' + esc(w.title) + ' 위젯 구성</h3>');
  L.push('    <button type="button" class="close" data-ng-click="cancel()" data-dismiss="modal" aria-label="Close"');
  L.push('      id="close-edit-widget-form-btn">');
  L.push('      <div aria-hidden="true" class="version-button">+</div>');
  L.push('    </button>');
  L.push('  </div>');
  L.push('  <div class="modal-body">');
  L.push('    <div class="form-group" data-ng-class="{ \'has-error\': ' + F + '.title.$invalid && ' + F + '.title.$touched }">');
  L.push('      <label for="title" class="control-label">제목 <span class="text-danger">*</span></label>');
  L.push('      <input id="title" name="title" type="text" class="form-control" data-ng-model="config.title" required>');
  L.push('      <div data-cs-messages="' + F + '.title"></div>');
  L.push('    </div>');
  L.push('');
  L.push('    <div class="form-group" data-ng-class="{ \'has-error\': ' + F + '.wModule.$invalid && ' + F + '.wModule.$touched }"');
  L.push('      data-ng-if="modules">');
  L.push('      <label for="wModule" class="control-label">데이터 소스<span class="text-danger">*</span>');
  L.push('        <span data-uib-tooltip="아래의 모든 패널이 공통으로 사용하는 데이터소스이며, 각 패널은 여기에 자신만의 필터 정의를 추가로 적용합니다."');
  L.push('          data-tooltip-append-to-body="true"><i class="margin-left-sm icon icon-information font-Size-13"></i></span>');
  L.push('      </label>');
  L.push('      <select name="wModule" id="wModule" class="form-control"');
  L.push('        data-ng-options="module.type as module.name for module in modules | playbookModules"');
  L.push('        data-ng-model="config.module" data-ng-change="onModuleChange()" required>');
  L.push('        <option value="">옵션 선택</option>');
  L.push('      </select>');
  L.push('      <div data-cs-messages="' + F + '.wModule"></div>');
  L.push('    </div>');
  L.push('');
  L.push('    <div class="mertics-widget-border padding-top-md padding-bottom-md" data-ng-if="config.module"></div>');
  L.push('    <div class="margin-top-md margin-bottom-md" data-ng-if="config.module"><h6>자동 새로고침</h6></div>');
  L.push('    <div class="checkbox" data-ng-if="config.module">');
  L.push('      <label for="autoRefresh">');
  L.push('        <input id="autoRefresh" type="checkbox" name="autoRefresh" data-ng-model="config.autoRefresh">이 위젯을 자동으로 새로고침</label>');
  L.push('    </div>');
  L.push('    <div class="form-group" data-ng-if="config.module && config.autoRefresh">');
  L.push('      <label for="refreshInterval" class="control-label">새로고침 주기</label>');
  L.push('      <select name="refreshInterval" id="refreshInterval" class="form-control" style="width:40%"');
  L.push('        data-ng-options="opt.value as opt.label for opt in pageConfig.refreshIntervals"');
  L.push('        data-ng-model="config.refreshInterval" required>');
  L.push('      </select>');
  L.push('    </div>');
  L.push('');
  L.push('    <div class="mertics-widget-border padding-top-md padding-bottom-md" data-ng-if="config.module"></div>');
  L.push('    <div class="margin-top-md margin-bottom-md" data-ng-if="config.module">');
  L.push('      <h6>패널');
  L.push('        <span data-uib-tooltip="각 패널의 대상, 제목, 필터를 자유롭게 변경할 수 있습니다. 패널 구성과 순서는 위젯 패키지에 고정되어 있습니다."');
  L.push('          data-tooltip-append-to-body="true"><i class="margin-left-sm icon icon-information font-Size-13"></i></span>');
  L.push('      </h6>');
  L.push('    </div>');
  L.push('');
  L.push('    <!-- One generic renderer for every panel: the shape of each form comes from');
  L.push('         blockMeta, so adding panels never lengthens this template. "fields" and');
  L.push('         "config" below are read with no $parent prefix - neither name is shadowed');
  L.push('         by a repeat variable ("meta"/"f"), so normal scope inheritance finds the');
  L.push('         controller\'s $scope.fields / $scope.config regardless of nesting depth,');
  L.push('         and ng-model writes mutate a nested object property rather than rebinding');
  L.push('         a primitive, so there is nothing here for the usual ng-repeat scope trap');
  L.push('         to catch. -->');
  L.push('    <div data-ng-if="config.module" data-ng-repeat="meta in blockMeta" class="margin-bottom-sm">');
  L.push('      <div class="cursor-pointer padding-sm" data-ng-click="toggleBlock(meta)"');
  L.push('        style="border: 1px solid rgba(128,128,128,0.25); border-radius: 2px;">');
  L.push('        <i class="fa" data-ng-class="{\'fa-caret-down\': meta.open, \'fa-caret-right\': !meta.open}"></i>');
  L.push('        <strong class="margin-left-sm">{{config.blocks[meta.id].label || config.blocks[meta.id].text || meta.title}}</strong>');
  L.push('        <span class="muted margin-left-sm font-size-12">{{meta.title}}</span>');
  L.push('      </div>');
  L.push('');
  L.push('      <div data-ng-show="meta.open" class="padding-md"');
  L.push('        style="border: 1px solid rgba(128,128,128,0.18); border-top: none;">');
  L.push('        <div data-ng-repeat="f in meta.fields"');
  L.push('          data-ng-if="fieldVisible(f, meta.id)">');
  L.push('');
  L.push('          <div class="checkbox" data-ng-if="f.kind === \'bool\'">');
  L.push('            <label>');
  L.push('              <input type="checkbox" data-ng-model="config.blocks[meta.id][f.key]">{{f.label}}</label>');
  L.push('          </div>');
  L.push('');
  L.push('          <div class="form-group" data-ng-if="f.kind === \'filter\'">');
  L.push('            <label class="control-label">{{f.label}}</label>');
  L.push('            <div data-cs-conditional data-ng-if="fields" data-fields="fields"');
  L.push('              data-reset-field="fields" data-mode="\'queryFilters\'"');
  L.push('              data-ng-model="config.blocks[meta.id][f.key]"');
  L.push('              data-parent-form="' + F + '" data-enable-expression="true"');
  L.push('              data-show-uuid="true" data-form-name="\'' + F + '\'"></div>');
  L.push('          </div>');
  L.push('');
  L.push('          <!-- Multi-field picker, same ui-select widget userAssignments uses for its');
  L.push('               multi-module picker - "allFields as X" keeps the ng-model array holding');
  L.push('               plain field-name strings while $item in the match template stays the');
  L.push('               full { name, title } object. -->');
  L.push('          <div class="form-group" data-ng-if="f.kind === \'anyFieldMulti\'">');
  L.push('            <label class="control-label">{{f.label}}</label>');
  L.push('            <div class="cs-select">');
  L.push('              <ui-select data-ng-model="config.blocks[meta.id][f.key]" multiple class="custom-multi-select"');
  L.push('                tagging="undefined" tagging-label="false">');
  L.push('                <ui-select-match placeholder="필드 선택">{{$item.title}}</ui-select-match>');
  L.push('                <ui-select-choices repeat="field.name as field in allFields | orderBy: \'title\' | filter: $select.search">');
  L.push('                  <div ng-bind="field.title"></div>');
  L.push('                </ui-select-choices>');
  L.push('              </ui-select>');
  L.push('              <span class="fa fa-sort-desc"></span>');
  L.push('            </div>');
  L.push('          </div>');
  L.push('');
  L.push('          <div class="form-group" data-ng-if="f.kind !== \'bool\' && f.kind !== \'filter\' && f.kind !== \'anyFieldMulti\'">');
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
  L.push('              <option value="">필드 선택</option>');
  L.push('            </select>');
  L.push('          </div>');
  L.push('        </div>');
  L.push('      </div>');
  L.push('    </div>');
  L.push('  </div>');
  L.push('  <div class="modal-footer">');
  L.push('    <button id="edit-widget-save" type="submit" class="btn btn-sm btn-primary"><i');
  L.push('        class="icon icon-check margin-right-sm"></i>저장</button>');
  L.push('    <button id="edit-widget-cancel" type="button" class="btn btn-sm btn-default" data-ng-click="cancel()"><i');
  L.push('        class="icon icon-close margin-right-sm"></i>닫기</button>');
  L.push('  </div>');
  L.push('</form>');
  return L.join('\n') + '\n';
}

/* --------------------------------- CSS ---------------------------------- */
function hexToRgb(hex) {
  var m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '#2f81f7');
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [47, 129, 247];
}

function genCss() {
  var P = prefix();
  var a = design.widget.accent || '#2f81f7';
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
  L.push('  font-size: 16px;');
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
  L.push('  font-size: 14px;');
  L.push('}');
  L.push('');
  L.push('.' + P + '-status { display: flex; justify-content: flex-end; margin-bottom: 10px; }');
  L.push('');
  L.push('.' + P + '-live {');
  L.push('  color: #2ea043;');
  L.push('  font-weight: 600;');
  L.push('  font-size: 12px;');
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
  L.push('  font-size: 12px;');
  L.push('  text-transform: uppercase;');
  L.push('  letter-spacing: 0.11em;');
  L.push('  color: #8b99ab;');
  L.push('  padding: 8px 12px;');
  L.push('  border-bottom: 1px solid #232c3a;');
  L.push('}');
  L.push('');
  L.push('.' + P + '-tile-body { padding: 12px; }');
  L.push('.' + P + '-tile-total { color: #f0f4f9; font-size: 14px; }');
  L.push('');
  L.push('.' + P + '-tile-value {');
  L.push('  font-size: 36px;');
  L.push('  font-weight: 600;');
  L.push('  line-height: 1.05;');
  L.push('  letter-spacing: -0.01em;');
  L.push('  color: #f0f4f9;');
  L.push('}');
  L.push('');
  L.push('.' + P + '-tile-unit { font-size: 16px; color: #8b99ab; margin-left: 3px; font-weight: 400; }');
  L.push('.' + P + '-tile-sub { font-size: 14px; color: #8b99ab; margin-top: 5px; }');
  L.push('.' + P + '-tile-sub span + span { margin-left: 5px; }');
  L.push('');
  L.push('.' + P + '-empty { font-size: 14px; padding: 4px 0; color: #65748a; }');
  L.push('');
  L.push('.' + P + '-section-title {');
  L.push('  font-size: 14px;');
  L.push('  font-weight: 600;');
  L.push('  text-transform: uppercase;');
  L.push('  letter-spacing: 0.11em;');
  L.push('  color: #8b99ab;');
  L.push('  margin-bottom: 9px;');
  L.push('  padding-bottom: 6px;');
  L.push('  border-bottom: 1px solid #232c3a;');
  L.push('}');

  if (has('gauge')) {
    L.push('');
    L.push('.' + P + '-gauge-wrap { display: flex; align-items: center; gap: 14px; }');
    L.push('.' + P + '-gauge-svg { width: 96px; height: 56px; flex: 0 0 auto; }');
    L.push('.' + P + '-gauge-value { font-size: 29px; font-weight: 600; line-height: 1; font-variant-numeric: tabular-nums; }');
  }

  if (has('stacked')) {
    L.push('');
    L.push('.' + P + '-seg-bar { display: flex; height: 22px; border: 1px solid #232c3a; overflow: hidden; }');
    L.push('.' + P + '-seg { height: 100%; }');
    L.push('.' + P + '-seg-legend { display: flex; flex-wrap: wrap; gap: 4px 14px; margin-top: 9px; }');
    L.push('.' + P + '-seg-key { display: flex; align-items: center; gap: 6px; font-size: 14px; color: #c3ccd8; }');
    L.push('.' + P + '-seg-key b { color: #f0f4f9; }');
    L.push('.' + P + '-seg-swatch { width: 8px; height: 8px; flex: 0 0 auto; }');
  }

  if (has('table')) {
    L.push('');
    L.push('.' + P + '-table { width: 100%; border-collapse: collapse; font-size: 14px; }');
    L.push('');
    L.push('.' + P + '-table th {');
    L.push('  text-align: left;');
    L.push('  font-size: 12px;');
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
  }

  if (has('bars')) {
    L.push('');
    L.push('.' + P + '-bar-row { display: flex; align-items: center; gap: 8px; margin-bottom: 7px; }');
    L.push('.' + P + '-bar-row:last-child { margin-bottom: 0; }');
    L.push('');
    L.push('.' + P + '-bar-label {');
    L.push('  flex: 0 0 32%;');
    L.push('  max-width: 32%;');
    L.push('  font-size: 14px;');
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
    L.push('  font-size: 14px;');
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
    L.push('.' + P + '-donut-total { font-size: 24px; font-weight: 600; line-height: 1.1; color: #f0f4f9; }');
    L.push('.' + P + '-donut-caption { font-size: 11px; color: #8b99ab; letter-spacing: 0.1em; text-transform: uppercase; }');
    L.push('');
    L.push('.' + P + '-legend { list-style: none; margin: 0; padding: 0; flex: 1 1 90px; min-width: 56px; max-height: 150px; overflow-y: auto; }');
    L.push('.' + P + '-legend-bottom .' + P + '-legend,');
    L.push('.' + P + '-legend-top .' + P + '-legend { flex-basis: auto; min-width: 0; width: 100%; }');
    L.push('.' + P + '-legend-item { display: flex; align-items: center; gap: 8px; padding: 3px 0; font-size: 14px; color: #c3ccd8; }');
    L.push('.' + P + '-legend-dot { width: 8px; height: 8px; flex: 0 0 auto; }');
    L.push('.' + P + '-legend-label { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }');
    L.push('.' + P + '-legend-value { flex: 0 0 auto; font-weight: 700; }');
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
    if ((b.type === 'bars' || b.type === 'donut' || b.type === 'stacked') && !b.field) {
      warns.push('"' + b.label + '" has no Group By field.');
    }
    if (b.type === 'metric' && !b.field) {
      warns.push('"' + b.label + '" has no numeric field set.');
    }
  });
  // Rough per-refresh query cost, so a heavy board does not get an aggressive interval.
  var queries = design.blocks.reduce(function (s, b) {
    return s + (b.type === 'header' ? 0 : b.type === 'gauge' ? 2 : 1);
  }, 0);
  if (queries > 12 && design.widget.autoRefresh && design.widget.refreshInterval < 300) {
    warns.push('This layout fires about ' + queries + ' queries per refresh; consider a 5 minute or slower interval.');
  }
  document.getElementById('warnBox').innerHTML = warns.length
    ? '<div class="warn">' + warns.map(esc).join('<br>') + '</div>' : '';
}

function renderAll() {
  renderCanvas();
  renderProps();
  regen();
}
