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
 *   - picklist / reference fields are grouped via dot notation
 *   - $interval refresh is always cancelled on $destroy
 * ===================================================================== */

/* ------------------------------ icons ------------------------------ */
function ico(path, stroke) {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="' + (stroke || '#7cb1ff') + '" stroke-width="1.8">' + path + '</svg>';
}
var ICONS = {
  stat:    ico('<path d="M4 20V10M12 20V4M20 20v-6"/>'),
  delta:   ico('<path d="M3 17l6-6 4 3 8-9"/><path d="M17 5h4v4"/>', '#2ea043'),
  metric:  ico('<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>', '#e3b341'),
  gauge:   ico('<path d="M4 18a8 8 0 1 1 16 0"/><path d="M12 18l4-5"/>', '#3fa7d6'),
  bars:    ico('<path d="M3 6h14M3 12h9M3 18h17"/>', '#e8663d'),
  stacked: ico('<rect x="3" y="9" width="18" height="6"/><path d="M10 9v6M15 9v6"/>', '#d9364c'),
  donut:   ico('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>'),
  trend:   ico('<path d="M3 17l5-6 4 3 5-8 4 5"/>', '#2ea043'),
  aging:   ico('<circle cx="12" cy="12" r="8"/><path d="M12 7v5l4 2"/><path d="M12 3v2"/>', '#e8663d'),
  list:    ico('<path d="M4 6h16M4 12h16M4 18h16"/>', '#93a1b3'),
  table:   ico('<rect x="3" y="5" width="18" height="14"/><path d="M3 10h18M9 10v9M15 10v9"/>', '#93a1b3'),
  header:  ico('<path d="M4 7h16M4 13h10"/>', '#65748a')
};

/* ------------------------- block definitions ------------------------ */
var BLOCKS = {
  stat:    { name: 'Stat Tile',       group: 'KPI',      desc: 'Single count or age' },
  delta:   { name: 'Trend KPI',       group: 'KPI',      desc: 'vs previous period' },
  metric:  { name: 'Metric (MTTR)',   group: 'KPI',      desc: 'avg/sum of a number' },
  gauge:   { name: 'Ratio Gauge',     group: 'KPI',      desc: 'SLA / closure rate' },
  bars:    { name: 'Breakdown Bars',  group: 'Analysis', desc: 'Group by -> ranked bars' },
  stacked: { name: 'Distribution',    group: 'Analysis', desc: 'One composition bar' },
  donut:   { name: 'Donut Chart',     group: 'Analysis', desc: 'Group by -> donut' },
  trend:   { name: 'Volume Timeline', group: 'Analysis', desc: 'Volume over time' },
  aging:   { name: 'Case Aging',      group: 'Analysis', desc: 'Backlog by age band' },
  list:    { name: 'Record List',     group: 'Records',  desc: 'Clickable rows + age' },
  table:   { name: 'Data Table',      group: 'Records',  desc: 'Multi-column table' },
  header:  { name: 'Section Title',   group: 'Layout',   desc: 'Static text divider' }
};

var PALETTE_GROUPS = ['KPI', 'Analysis', 'Records', 'Layout'];

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

function defaults(type) {
  var base = { type: type, id: 'b' + (Date.now().toString(36)) + Math.floor(Math.random() * 1e4).toString(36), w: 12 };
  if (type === 'stat')    return Object.assign(base, { w: 3, label: 'Total', metric: 'count', scope: 'period', onlyOpen: false, onlyUnassigned: false, ownerField: 'owner', accent: true });
  if (type === 'delta')   return Object.assign(base, { w: 3, label: 'Volume', onlyOpen: false, goodDirection: 'down' });
  if (type === 'metric')  return Object.assign(base, { w: 3, label: 'MTTR', field: 'dwellTime', op: 'avg', format: 'minutes', decimals: 1, scope: 'period', onlyOpen: false, accent: false });
  if (type === 'gauge')   return Object.assign(base, { w: 3, label: 'Closure Rate', numerator: 'resolved', target: 90, scope: 'period', accent: false });
  if (type === 'bars')    return Object.assign(base, { w: 6, label: 'By Severity', field: 'severity', kind: 'picklist', refAttr: 'name', scope: 'period', onlyOpen: false, maxRows: 6, showRank: false });
  if (type === 'stacked') return Object.assign(base, { w: 6, label: 'Severity Distribution', field: 'severity', kind: 'picklist', refAttr: 'name', scope: 'period', onlyOpen: false });
  if (type === 'donut')   return Object.assign(base, { w: 6, label: 'Status Split', field: 'status', kind: 'picklist', refAttr: 'name', scope: 'period', onlyOpen: false, legend: 'right' });
  if (type === 'trend')   return Object.assign(base, { w: 12, label: 'Alert Volume Timeline', buckets: 12, onlyOpen: false });
  if (type === 'aging')   return Object.assign(base, { w: 6, label: 'Case Aging', onlyOpen: true });
  if (type === 'list')    return Object.assign(base, { w: 12, label: 'Triage Queue', subtitle: 'oldest open first', sortField: '', sortDir: 'ASC', limit: 8, scope: 'period', onlyOpen: true, secondaryField: 'status', showAge: true });
  if (type === 'table')   return Object.assign(base, { w: 12, label: 'Recent Records', columns: 'severity:Severity, status:Status, createDate:Created', sortField: '', sortDir: 'DESC', limit: 8, scope: 'period', onlyOpen: false });
  if (type === 'header')  return Object.assign(base, { w: 12, text: 'Section' });
  return base;
}

