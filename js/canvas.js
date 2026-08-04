"use strict";

/* ============================ CANVAS UI ============================= */
function mockBars(n, seedLabels) {
  var labels = seedLabels || ['Critical', 'High', 'Medium', 'Low', 'Informational', 'Other'];
  var vals = [42, 27, 15, 8, 4, 2];
  var out = [];
  var max = vals[0];
  for (var i = 0; i < Math.min(n, labels.length); i++) {
    out.push({ label: labels[i], value: vals[i], pct: Math.round((vals[i] / max) * 1000) / 10, color: colorFor(labels[i], i) });
  }
  return out;
}

function tileWrap(label, body, accent, right) {
  return '<div class="tile' + (accent ? ' accent' : '') + '">' +
    '<div class="tile-label"><span>' + esc(label) + '</span>' + (right || '') + '</div>' +
    '<div class="tile-body">' + body + '</div></div>';
}

/* Semicircular gauge: a 180-degree arc dashed to the value percentage. */
function gaugeSvg(pct, color, target) {
  var CIRC = Math.PI * 40;
  var on = (Math.max(0, Math.min(100, pct)) / 100) * CIRC;
  var tick = '';
  if (target != null) {
    var a = Math.PI - (target / 100) * Math.PI;
    var x1 = 48 + Math.cos(a) * 33, y1 = 48 - Math.sin(a) * 33;
    var x2 = 48 + Math.cos(a) * 47, y2 = 48 - Math.sin(a) * 47;
    tick = '<line x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + x2.toFixed(1) +
      '" y2="' + y2.toFixed(1) + '" stroke="#dce3ec" stroke-width="1.5"/>';
  }
  return '<svg viewBox="0 0 96 56" class="gauge-svg">' +
    '<path d="M 8 48 A 40 40 0 0 1 88 48" fill="none" stroke="#1c2532" stroke-width="8"/>' +
    '<path d="M 8 48 A 40 40 0 0 1 88 48" fill="none" stroke="' + color + '" stroke-width="8"' +
    ' stroke-dasharray="' + on.toFixed(2) + ' ' + CIRC.toFixed(2) + '"/>' + tick + '</svg>';
}

function donutPath(cx, cy, oR, iR, a0, a1) {
  function pt(r, a) { var rad = (a - 90) * Math.PI / 180; return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }; }
  var laf = (a1 - a0) <= 180 ? '0' : '1';
  var os = pt(oR, a0), oe = pt(oR, a1), ie = pt(iR, a1), is = pt(iR, a0);
  return ['M', os.x.toFixed(2), os.y.toFixed(2), 'A', oR, oR, 0, laf, 1, oe.x.toFixed(2), oe.y.toFixed(2),
          'L', ie.x.toFixed(2), ie.y.toFixed(2), 'A', iR, iR, 0, laf, 0, is.x.toFixed(2), is.y.toFixed(2), 'Z'].join(' ');
}

function previewBlock(b) {
  if (b.type === 'header') {
    return '<div class="sec-title">' + esc(b.text || 'Section') + '</div>';
  }

  if (b.type === 'stat') {
    return tileWrap(b.label, '<div class="tile-value">128</div>', b.accent);
  }

  if (b.type === 'metric') {
    var unit = { seconds: 's', minutes: 'm', hours: 'h', percent: '%' }[b.format] || '';
    var shown = b.format === 'minutes' ? '42.6' : b.format === 'hours' ? '3.4' : '86.2';
    return tileWrap(b.label,
      '<div class="tile-value">' + shown + '<span class="tile-unit">' + unit + '</span></div>' +
      '<div class="tile-sub">' + esc(String(b.op || 'avg').toUpperCase()) + ' of ' + esc(b.field || '?') + '</div>', b.accent);
  }

  if (b.type === 'gauge') {
    var pct = 87;
    var col = pct >= (b.target || 90) ? '#2ea043' : (pct >= (b.target || 90) * 0.8 ? '#e3b341' : '#d9364c');
    return tileWrap(b.label,
      '<div class="gauge-wrap">' + gaugeSvg(pct, col, b.target) +
      '<div><div class="tile-value" style="font-size:24px;color:' + col + '">' + pct + '<span class="tile-unit">%</span></div>' +
      (b.target != null ? '<div class="tile-sub">target ' + esc(b.target) + '%</div>' : '') +
      '</div></div>', b.accent);
  }

  if (b.type === 'bars') {
    var rows = mockBars(b.maxRows || 6);
    var inner = rows.map(function (r, i) {
      return '<div class="bar-row">' +
        '<div class="bar-label">' + esc(r.label) + '</div>' +
        '<div class="bar-track"><div class="bar-fill" style="width:' + r.pct + '%;background:' + r.color + '"></div></div>' +
        '<div class="bar-value">' + r.value + '</div></div>';
    }).join('');
    return tileWrap(b.label, inner);
  }

  if (b.type === 'stacked') {
    var sr = mockBars(5);
    var tot = sr.reduce(function (s, r) { return s + r.value; }, 0);
    var segs = sr.map(function (r) {
      return '<div class="seg" style="width:' + ((r.value / tot) * 100).toFixed(2) + '%;background:' + r.color + '" title="' + esc(r.label) + '"></div>';
    }).join('');
    var keys = sr.map(function (r) {
      return '<div class="seg-key"><span class="seg-swatch" style="background:' + r.color + '"></span>' +
        esc(r.label) + ' <b style="color:#f0f4f9">' + r.value + '</b></div>';
    }).join('');
    return tileWrap(b.label, '<div class="seg-bar">' + segs + '</div><div class="seg-legend">' + keys + '</div>',
      false, '<span style="color:#f0f4f9;font-size:12px">' + tot + '</span>');
  }

  if (b.type === 'table') {
    // Mirrors the generated widget: no columns picked falls back to the id alone.
    var cols = Array.isArray(b.columns) && b.columns.length ? b.columns : ['id'];
    var mockVals = {
      id: ['1042', '1041', '1039'],
      severity: ['Critical', 'High', 'Medium'],
      status: ['Open', 'In Progress', 'Open'],
      createDate: ['08-03 14:22', '08-03 11:07', '08-02 23:41']
    };
    var head = cols.map(function (f) { return '<th>' + esc(f) + '</th>'; }).join('');
    var body = [0, 1, 2].slice(0, Math.max(1, Math.min(3, b.limit || 3))).map(function (i) {
      return '<tr>' + cols.map(function (f) {
        var v = (mockVals[f] || ['-', '-', '-'])[i];
        return '<td>' + esc(v) + '</td>';
      }).join('') + '</tr>';
    }).join('');
    return '<div><div class="sec-title">' + esc(b.label) + '</div>' +
      '<table class="tbl"><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table></div>';
  }

  if (b.type === 'donut') {
    var labs = ['Critical', 'High', 'Medium', 'Low'];
    var vals = [42, 27, 15, 8];
    var total = 92, cursor = 0, segs = '';
    vals.forEach(function (v, i) {
      var frac = v / total;
      var a0 = cursor * 360, a1 = (cursor + frac) * 360;
      var inset = Math.min(1.5, (a1 - a0) / 4);
      segs += '<path d="' + donutPath(100, 100, 88, 60, a0 + inset, a1 - inset) + '" fill="' + colorFor(labs[i], i) + '"></path>';
      cursor += frac;
    });
    var legend = labs.map(function (l, i) {
      return '<div class="seg-key" style="width:100%;margin-bottom:4px">' +
        '<span class="seg-swatch" style="background:' + colorFor(l, i) + '"></span>' +
        '<span style="flex:1 1 auto">' + l + '</span>' +
        '<span style="color:#f0f4f9;font-weight:600">' + vals[i] + '</span></div>';
    }).join('');
    var dir = b.legend === 'left' ? 'row-reverse' : b.legend === 'top' ? 'column-reverse' : b.legend === 'bottom' ? 'column' : 'row';
    return tileWrap(b.label,
      '<div style="display:flex;flex-direction:' + dir + ';align-items:center;gap:14px">' +
      '<div style="position:relative;flex:0 0 auto;width:118px;height:118px;margin:0 auto">' +
      '<svg viewBox="0 0 200 200" style="width:100%;height:100%">' + segs + '</svg>' +
      '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center">' +
      '<div style="font-size:20px;font-weight:600;color:#f0f4f9;font-variant-numeric:tabular-nums">92</div>' +
      '<div style="font-size:9px;color:#8b99ab;letter-spacing:.1em">TOTAL</div></div></div>' +
      '<div style="flex:1 1 90px;min-width:56px">' + legend + '</div></div>');
  }

  return '';
}

function renderCanvas() {
  var w = design.widget;
  document.getElementById('devTitle').textContent = w.title || w.name;
  document.getElementById('devMeta').textContent = (w.module || '(no module)') + ' · v' + w.version;
  document.getElementById('prevLive').style.display = w.autoRefresh ? '' : 'none';

  var grid = document.getElementById('grid');

  if (!design.blocks.length) {
    grid.innerHTML = '<div class="empty-canvas" style="grid-column:span 12"><b>Drag a block here</b>Pick one from the Blocks panel on the left.</div>';
    return;
  }

  grid.innerHTML = design.blocks.map(function (b) {
    return '<div class="blk' + (b.id === selectedId ? ' sel' : '') + '" data-id="' + b.id + '" draggable="true" style="grid-column:span ' + b.w + '">' +
      '<span class="blk-tag">' + BLOCKS[b.type].name + '</span>' +
      '<button class="blk-del" data-del="' + b.id + '" title="Remove">&times;</button>' +
      previewBlock(b) + '</div>';
  }).join('');

  grid.querySelectorAll('.blk').forEach(function (el) {
    el.addEventListener('click', function (ev) {
      if (ev.target.dataset.del) return;
      selectedId = el.dataset.id;
      renderAll();
    });
    el.addEventListener('dragstart', function (ev) {
      ev.dataTransfer.setData('text/plain', 'move:' + el.dataset.id);
      ev.dataTransfer.effectAllowed = 'move';
      setTimeout(function () { el.classList.add('drag'); }, 0);
    });
    el.addEventListener('dragend', function () { el.classList.remove('drag'); clearDrop(); });
  });

  grid.querySelectorAll('[data-del]').forEach(function (btn) {
    btn.addEventListener('click', function (ev) {
      ev.stopPropagation();
      var id = btn.dataset.del;
      design.blocks = design.blocks.filter(function (b) { return b.id !== id; });
      if (selectedId === id) selectedId = null;
      renderAll(); save();
    });
  });
}

/* --------------------------- drag & drop --------------------------- */
var dropIndex = null;

function clearDrop() {
  dropIndex = null;
  var g = document.getElementById('grid');
  g.classList.remove('canvas-over');
  var l = g.querySelector('.drop-line');
  if (l) l.remove();
}

function showDropLine(idx) {
  var g = document.getElementById('grid');
  var old = g.querySelector('.drop-line');
  if (old) old.remove();
  var line = document.createElement('div');
  line.className = 'drop-line';
  var kids = Array.prototype.filter.call(g.children, function (c) { return c.classList.contains('blk'); });
  if (idx >= kids.length) g.appendChild(line);
  else g.insertBefore(line, kids[idx]);
}

function setupCanvasDnd() {
  var g = document.getElementById('grid');

  g.addEventListener('dragover', function (ev) {
    ev.preventDefault();
    g.classList.add('canvas-over');
    var kids = Array.prototype.filter.call(g.children, function (c) { return c.classList.contains('blk'); });
    var idx = kids.length;
    for (var i = 0; i < kids.length; i++) {
      var r = kids[i].getBoundingClientRect();
      // Blocks sit in a 12-col grid, so decide by the pointer's position within
      // the hovered block: left/top half inserts before it, right/bottom after.
      var horizontallyInside = ev.clientX >= r.left && ev.clientX <= r.right;
      var verticallyInside = ev.clientY >= r.top && ev.clientY <= r.bottom;
      if (horizontallyInside && verticallyInside) {
        idx = (ev.clientX < r.left + r.width / 2) ? i : i + 1;
        break;
      }
      if (ev.clientY < r.top) { idx = i; break; }
    }
    dropIndex = idx;
    showDropLine(idx);
  });

  g.addEventListener('dragleave', function (ev) {
    if (!g.contains(ev.relatedTarget)) clearDrop();
  });

  g.addEventListener('drop', function (ev) {
    ev.preventDefault();
    var data = ev.dataTransfer.getData('text/plain') || '';
    var idx = dropIndex == null ? design.blocks.length : dropIndex;
    clearDrop();

    if (data.indexOf('new:') === 0) {
      var b = defaults(data.slice(4));
      design.blocks.splice(idx, 0, b);
      selectedId = b.id;
    } else if (data.indexOf('move:') === 0) {
      var id = data.slice(5);
      var from = design.blocks.findIndex(function (x) { return x.id === id; });
      if (from < 0) return;
      var moved = design.blocks.splice(from, 1)[0];
      if (from < idx) idx--;
      design.blocks.splice(idx, 0, moved);
      selectedId = id;
    }
    renderAll(); save();
  });
}

