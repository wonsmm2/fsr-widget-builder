"use strict";

/* ============================ PALETTE UI ============================ */
function renderPalette() {
  var host = document.getElementById('palette');
  var html = '';
  PALETTE_GROUPS.forEach(function (g) {
    html += '<div class="pal-group"><div class="pal-group-name">' + g + '</div>';
    Object.keys(BLOCKS).forEach(function (t) {
      if (BLOCKS[t].group !== g) return;
      html += '<div class="pal-item" draggable="true" data-new="' + t + '">' +
        '<div class="pal-ico">' + ICONS[t] + '</div>' +
        '<div><div class="pal-name">' + BLOCKS[t].name + '</div><div class="pal-desc">' + BLOCKS[t].desc + '</div></div>' +
        '</div>';
    });
    html += '</div>';
  });
  host.innerHTML = html;

  host.querySelectorAll('.pal-item').forEach(function (el) {
    el.addEventListener('dragstart', function (ev) {
      ev.dataTransfer.setData('text/plain', 'new:' + el.dataset.new);
      ev.dataTransfer.effectAllowed = 'copy';
    });
  });
}

