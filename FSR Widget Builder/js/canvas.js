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

/* "severity:Severity, status:Status" -> [{f:'severity',l:'Severity'}, ...] */
function parseColumns(str) {
  return String(str || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean).map(function (s) {
    var i = s.indexOf(':');
    return i > 0 ? { f: s.slice(0, i).trim(), l: s.slice(i + 1).trim() } : { f: s, l: s };
  });
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
    var val = b.metric === 'oldestAge' ? '6d 4h' : '128';
    var cls = (b.metric === 'oldestAge' || b.onlyUnassigned) ? ' u-high' : '';
    return tileWrap(b.label, '<div class="tile-value' + cls + '">' + val + '</div>', b.accent);
  }

  if (b.type === 'delta') {
    var up = b.goodDirection === 'down';
    return tileWrap(b.label,
      '<div class="tile-value">128</div>' +
      '<div class="tile-sub"><span class="' + (up ? 'delta-up' : 'delta-down') + '">&#9650; 18.5%</span> vs previous</div>', true);
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
        (b.showRank ? '<div class="bar-rank">' + (i + 1) + '</div>' : '') +
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

  if (b.type === 'aging') {
    var bands = [
      { l: '< 1h', v: 4, c: '#2ea043' }, { l: '1-4h', v: 9, c: '#3fa7d6' },
      { l: '4-24h', v: 14, c: '#e3b341' }, { l: '1-7d', v: 7, c: '#e8663d' }, { l: '> 7d', v: 3, c: '#d9364c' }
    ];
    var mx = 14;
    var ab = bands.map(function (r) {
      return '<div class="bar-row"><div class="bar-label">' + r.l + '</div>' +
        '<div class="bar-track"><div class="bar-fill" style="width:' + ((r.v / mx) * 100).toFixed(1) + '%;background:' + r.c + '"></div></div>' +
        '<div class="bar-value">' + r.v + '</div></div>';
    }).join('');
    return tileWrap(b.label, ab);
  }

  if (b.type === 'table') {
    var cols = parseColumns(b.columns);
    var mockVals = { severity: ['Critical', 'High', 'Medium'], status: ['Open', 'In Progress', 'Open'], createDate: ['08-03 14:22', '08-03 11:07', '08-02 23:41'] };
    var head = '<th>Name</th>' + cols.map(function (c) { return '<th>' + esc(c.l) + '</th>'; }).join('');
    var body = [0, 1, 2].slice(0, Math.max(1, Math.min(3, b.limit || 3))).map(function (i) {
      var names = ['Suspicious login from unknown IP', 'Malware on WKS-042', 'Phishing reported by user'];
      return '<tr><td style="color:#dce3ec">' + names[i] + '</td>' + cols.map(function (c) {
        var v = (mockVals[c.f] || ['-', '-', '-'])[i];
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

  if (b.type === 'trend') {
    var counts = [3, 4, 2, 5, 3, 6, 4, 8, 12, 20, 15, 9].slice(0, Math.max(3, Math.min(24, b.buckets || 12)));
    var mx = Math.max.apply(null, counts), n = counts.length;
    var pts = counts.map(function (c, i) {
      var x = n > 1 ? (i / (n - 1)) * 100 : 50;
      var y = mx ? 32 - 3 - (c / mx) * (32 - 6) : 29;
      return x.toFixed(2) + ',' + y.toFixed(2);
    });
    var line = pts.join(' ');
    var area = line + ' 100.00,32.00 0.00,32.00';
    var last = pts[pts.length - 1].split(',');
    var acc = design.widget.accent || '#2f81f7';
    return '<div><div class="sec-title">' + esc(b.label) + '</div>' +
      '<div class="trend-wrap"><svg viewBox="0 0 100 32" preserveAspectRatio="none" class="trend-svg">' +
      '<polyline points="0,10.67 100,10.67" fill="none" stroke="#1c2532" stroke-width="1" vector-effect="non-scaling-stroke"></polyline>' +
      '<polyline points="0,21.33 100,21.33" fill="none" stroke="#1c2532" stroke-width="1" vector-effect="non-scaling-stroke"></polyline>' +
      '<polygon points="' + area + '" fill="' + acc + '" fill-opacity=".14"></polygon>' +
      '<polyline points="' + line + '" fill="none" stroke="' + acc + '" stroke-width="1.5" vector-effect="non-scaling-stroke"></polyline>' +
      '<circle cx="' + last[0] + '" cy="' + last[1] + '" r="2" fill="' + acc + '"></circle>' +
      '</svg><div class="trend-range"><span>Jul 21, 09:00</span><span>now</span></div></div></div>';
  }

  if (b.type === 'list') {
    var mock = [
      { t: 'Suspicious login from unknown IP', s: 'Open', a: '6d 4h', c: '#d9364c' },
      { t: 'Malware detected on endpoint WKS-042', s: 'In Progress', a: '12h 3m', c: '#e3b341' },
      { t: 'Phishing email reported by user', s: 'Open', a: '22m', c: '#2ea043' }
    ].slice(0, Math.max(1, Math.min(3, b.limit || 3)));
    var rows = mock.map(function (m) {
      return '<div class="li">' +
        (b.showAge ? '<span class="li-dot" style="background:' + m.c + '"></span>' : '') +
        '<div class="li-title">' + m.t + '</div>' +
        '<div class="li-meta">' + (b.secondaryField ? '<span>' + m.s + '</span>' : '') +
        (b.showAge ? '<span style="color:' + m.c + '">' + m.a + '</span>' : '') + '</div></div>';
    }).join('');
    return '<div><div class="sec-title">' + esc(b.label) +
      (b.subtitle ? '<span class="sec-sub">' + esc(b.subtitle) + '</span>' : '') + '</div>' + rows + '</div>';
  }
  return '';
}

function renderCanvas() {
  var w = design.widget;
  document.getElementById('devTitle').textContent = w.title || w.name;
  document.getElementById('devMeta').textContent = (w.module || '(no module)') + ' · v' + w.version;
  document.getElementById('prevPeriod').textContent = (PERIOD_LABELS[w.period] || 'All Time') + ' · ' + (w.dateField || 'createDate');
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

