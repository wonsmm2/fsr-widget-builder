"use strict";

/* ============================== TOOLBAR ============================== */
function setupToolbar() {
  document.getElementById('btnNew').addEventListener('click', function () {
    if (!confirm('Discard the current design and start over?')) return;
    design = blankDesign();
    selectedId = null;
    renderAll(); save();
    toast('New design');
  });

  var drawer = document.getElementById('drawer');
  document.getElementById('drawerHead').addEventListener('click', function (ev) {
    if (ev.target.id === 'btnCopy') return;
    drawer.classList.toggle('open');
  });
  document.getElementById('btnCode').addEventListener('click', function () {
    drawer.classList.add('open');
    document.getElementById('code').scrollIntoView({ block: 'nearest' });
  });

  document.getElementById('btnCopy').addEventListener('click', function (ev) {
    ev.stopPropagation();
    var cur = fileList().filter(function (f) { return f.n === activeTab; })[0];
    navigator.clipboard.writeText(cur.c || '').then(function () {
      toast('Copied ' + activeTab);
    }, function () {
      toast('Clipboard blocked by the browser');
    });
  });

  document.getElementById('btnDownload').addEventListener('click', downloadTgz);
}

/* ================================ BOOT =============================== */
load();
renderPalette();
setupCanvasDnd();
setupToolbar();
renderAll();
document.getElementById('drawer').classList.add('open');
