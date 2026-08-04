"use strict";

/* =====================================================================
 * FortiSOAR Widget Designer - static code generator.
 *
 * Design-time only: it never talks to a FortiSOAR instance, so module and
 * field names are typed by hand. Everything it emits follows the conventions
 * of the certified widgets in this repo (cardTiles / picklistAsPhases /
 * userAssignments) plus the socCommandCenter patterns:
 *   - controller id = <name><version-without-dots>Ctrl
 *   - aggregates use the Query API "groupby" operator (not a top-level key)
 *   - picklist / reference fields are grouped via dot notation, detected at
 *     runtime from Entity - never asked as a design-time question
 *   - $interval refresh is always cancelled on $destroy
 *
 * Filtering is deliberately NOT a widget-level concept. Every block that
 * queries records gets its own real FortiSOAR Filter Criteria (cs-conditional,
 * with datetime fields switched to datetime.quick so Relative values like
 * "Today" work) inside the generated Edit dialog. There is no separate
 * Time Range Field / Search Period / "only unresolved" / "only unassigned"
 * toggle anywhere - an admin who wants that just adds the matching condition
 * to the block's own Filter Criteria, using the platform's real filter UI
 * instead of a heuristic this tool would have to guess at.
 * ===================================================================== */

/* ------------------------------ icons ------------------------------ */
function ico(path, stroke) {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="' + (stroke || '#7cb1ff') + '" stroke-width="1.8">' + path + '</svg>';
}
var ICONS = {
  stat:    ico('<path d="M4 20V10M12 20V4M20 20v-6"/>'),
  metric:  ico('<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>', '#e3b341'),
  gauge:   ico('<path d="M4 18a8 8 0 1 1 16 0"/><path d="M12 18l4-5"/>', '#3fa7d6'),
  bars:    ico('<path d="M3 6h14M3 12h9M3 18h17"/>', '#e8663d'),
  stacked: ico('<rect x="3" y="9" width="18" height="6"/><path d="M10 9v6M15 9v6"/>', '#d9364c'),
  donut:   ico('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>'),
  table:   ico('<rect x="3" y="5" width="18" height="14"/><path d="M3 10h18M9 10v9M15 10v9"/>', '#93a1b3'),
  header:  ico('<path d="M4 7h16M4 13h10"/>', '#65748a')
};

/* ------------------------- block definitions ------------------------ */
var BLOCKS = {
  stat:    { name: '레코드 카운트',   group: 'KPI',      desc: '필터링된 레코드의 수를 표시' },
  metric:  { name: 'MTTR',  group: 'KPI',      desc: '숫자 필드의 평균/합계' },
  gauge:   { name: '게이지',    group: 'KPI',      desc: '두 필터를 사용한 비율' },
  bars:    { name: '가로 막대', group: '분석', desc: '가로 막대 차트' },
  stacked: { name: '막대 분포',   group: '분석', desc: '막대 분포 차트' },
  donut:   { name: '도넛',    group: '분석', desc: '도넛 차트' },
  table:   { name: 'Grid',     group: '레코드',  desc: '레코드 Grid' },
  header:  { name: '가로 구역 나누기',  group: '레이아웃',   desc: '가로 구역 나누기' }
};

var PALETTE_GROUPS = ['KPI', '분석', '레코드', '레이아웃'];

var ACCENTS = ['#2f81f7', '#3fa7d6', '#2ea043', '#e3b341', '#d9364c', '#8b5cf6'];

/* Categorical fallback ramp - muted, print-safe, no neon. */
var PALETTE_COLORS = ['#3fa7d6','#8b5cf6','#e8663d','#2ea043','#e3b341','#2f81f7','#d9364c','#4bc0a8','#b07fd4','#7d8b9e'];

/* Security dashboards should color by meaning, not by position. */
var SEMANTIC_COLORS = {
  critical: '#d9364c', high: '#e8663d', medium: '#e3b341', moderate: '#e3b341',
  low: '#3fa7d6', informational: '#7d8b9e', info: '#7d8b9e', none: '#7d8b9e',
  open: '#e8663d', new: '#d9364c', 'in progress': '#e3b341', investigating: '#e3b341',
  pending: '#e3b341', 'on hold': '#8b5cf6', closed: '#2ea043', resolved: '#2ea043',
  contained: '#2ea043', mitigated: '#2ea043', 'false positive': '#7d8b9e', duplicate: '#7d8b9e'
};

function colorFor(label, index) {
  var key = String(label == null ? '' : label).toLowerCase().trim();
  return SEMANTIC_COLORS[key] || PALETTE_COLORS[index % PALETTE_COLORS.length];
}

/* An empty FortiSOAR Filter Criteria value - "no condition", i.e. every record
 * in the module matches. This is the shape cs-conditional's ng-model expects. */
function emptyQuery() {
  return { filters: [] };
}

function defaults(type) {
  var base = { type: type, id: 'b' + (Date.now().toString(36)) + Math.floor(Math.random() * 1e4).toString(36), w: 12 };
  if (type === 'stat')    return Object.assign(base, { w: 3, label: 'Total', query: emptyQuery(), accent: true });
  if (type === 'metric')  return Object.assign(base, { w: 3, label: 'MTTR', field: 'dwellTime', op: 'avg', format: 'minutes', decimals: 1, query: emptyQuery(), accent: false });
  if (type === 'gauge')   return Object.assign(base, { w: 3, label: 'Closure Rate', denominatorQuery: emptyQuery(), numeratorQuery: emptyQuery(), target: 90, accent: false });
  if (type === 'bars')    return Object.assign(base, { w: 6, label: 'By Severity', field: 'severity', query: emptyQuery(), maxRows: 6 });
  if (type === 'stacked') return Object.assign(base, { w: 6, label: 'Severity Distribution', field: 'severity', query: emptyQuery() });
  if (type === 'donut')   return Object.assign(base, { w: 6, label: 'Status Split', field: 'status', query: emptyQuery(), legend: 'right' });
  if (type === 'table')   return Object.assign(base, { w: 12, label: 'Recent Records', columns: ['severity', 'status', 'createDate'], query: emptyQuery(), sortField: '', sortDir: 'DESC', limit: 8 });
  if (type === 'header')  return Object.assign(base, { w: 12, text: 'Section' });
  return base;
}
