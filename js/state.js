"use strict";

/* ------------------------------ state ------------------------------ */
var LS_KEY = 'fsr-widget-designer-v1';

var design = null;
var selectedId = null;
var activeTab = 'view.html';
var generated = {};

function blankDesign() {
  return {
    widget: {
      name: 'myWidget',
      title: 'My Widget',
      subTitle: 'Custom FortiSOAR dashboard widget',
      version: '1.0.0',
      publisher: 'Custom',
      compatibility: '7.6.2',
      module: 'alerts',
      autoRefresh: true,
      refreshInterval: 300,
      accent: '#2f81f7',
      pages: ['Dashboard', 'Reporting']
    },
    blocks: [
      Object.assign(defaults('stat'), { label: 'Total', accent: true }),
      Object.assign(defaults('stat'), { label: 'Unassigned', accent: false }),
      Object.assign(defaults('bars'), {})
    ]
  };
}

/* Brings one block from an older save up to the current shape. Anything that
 * changes a setting's *type* has to be handled here: a stale value reaches the
 * canvas renderer directly, and one throw there takes down the whole canvas -
 * including drag and drop, which re-renders on drop. */
function migrateBlock(b) {
  // Table columns used to be a "field:Label, field2:Label2" spec string before the
  // multi-field picker replaced it (README 0.6.4a). Keep the field names, drop the
  // hand-written labels - real field titles come from the module schema now.
  if (b.type === 'table' && typeof b.columns === 'string') {
    b.columns = b.columns.split(',').map(function (part) {
      return part.split(':')[0].trim();
    }).filter(Boolean);
  }
  return b;
}

function load() {
  try {
    var raw = localStorage.getItem(LS_KEY);
    if (raw) {
      design = JSON.parse(raw);
      // Drop any block whose type no longer exists (e.g. a design saved before a
      // block type was retired) so an old save can't crash the current build.
      design.blocks = (design.blocks || [])
        .filter(function (b) { return !!BLOCKS[b.type]; })
        .map(migrateBlock);
      return;
    }
  } catch (e) { /* corrupt or unavailable storage: fall through to a blank design */ }
  design = blankDesign();
}

var saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(function () {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(design));
      var el = document.getElementById('saveState');
      el.textContent = 'saved ' + new Date().toLocaleTimeString();
    } catch (e) { /* storage full or blocked: autosave is best-effort only */ }
  }, 300);
}

function blockById(id) {
  for (var i = 0; i < design.blocks.length; i++) if (design.blocks[i].id === id) return design.blocks[i];
  return null;
}

/* ------------------------------ utils ------------------------------ */
function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function jsStr(s) {
  return '"' + String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}
function pascal(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
function camelSafe(s) {
  var v = String(s || '').replace(/[^A-Za-z0-9]+/g, ' ').trim().split(/\s+/).map(function (w, i) {
    return i === 0 ? w.charAt(0).toLowerCase() + w.slice(1) : w.charAt(0).toUpperCase() + w.slice(1);
  }).join('');
  return v || 'myWidget';
}
function verTag(v) { return String(v || '1.0.0').replace(/\./g, ''); }

function toast(msg) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._t);
  t._t = setTimeout(function () { t.classList.remove('show'); }, 1800);
}

