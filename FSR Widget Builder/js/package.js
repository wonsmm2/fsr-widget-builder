"use strict";

/* ============================ TAR.GZ EXPORT ========================== */
function strBytes(s) { return new TextEncoder().encode(s); }

function tarHeader(name, size) {
  var buf = new Uint8Array(512);
  function put(str, off, len) {
    var b = strBytes(str);
    for (var i = 0; i < b.length && i < len; i++) buf[off + i] = b[i];
  }
  function octal(n, off, len) {
    // tar stores numbers as NUL-terminated octal, right-aligned with leading zeros
    var s = n.toString(8);
    while (s.length < len - 1) s = '0' + s;
    put(s, off, len - 1);
    buf[off + len - 1] = 0;
  }
  put(name, 0, 100);
  octal(0o644, 100, 8);
  octal(0, 108, 8);
  octal(0, 116, 8);
  octal(size, 124, 12);
  octal(Math.floor(Date.now() / 1000), 136, 12);
  for (var i = 148; i < 156; i++) buf[i] = 32;   // checksum field is spaces while summing
  buf[156] = '0'.charCodeAt(0);                  // typeflag: regular file
  put('ustar', 257, 6);
  buf[263] = '0'.charCodeAt(0);
  buf[264] = '0'.charCodeAt(0);

  var sum = 0;
  for (var j = 0; j < 512; j++) sum += buf[j];
  var cs = sum.toString(8);
  while (cs.length < 6) cs = '0' + cs;
  put(cs, 148, 6);
  buf[154] = 0;
  buf[155] = 32;
  return buf;
}

function buildTar(files) {
  var chunks = [];
  files.forEach(function (f) {
    var data = strBytes(f.c || '');
    chunks.push(tarHeader(f.n, data.length));
    chunks.push(data);
    var pad = (512 - (data.length % 512)) % 512;
    if (pad) chunks.push(new Uint8Array(pad));
  });
  chunks.push(new Uint8Array(1024));            // two empty blocks terminate the archive
  var total = chunks.reduce(function (s, c) { return s + c.length; }, 0);
  var out = new Uint8Array(total);
  var off = 0;
  chunks.forEach(function (c) { out.set(c, off); off += c.length; });
  return out;
}

function downloadBlob(blob, filename) {
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
}

function downloadTgz() {
  var folder = folderName();
  var files = fileList().map(function (f) { return { n: folder + '/' + f.n, c: f.c }; });
  var tar = buildTar(files);

  if (typeof CompressionStream === 'undefined') {
    downloadBlob(new Blob([tar], { type: 'application/x-tar' }), folder + '.tar');
    toast('Downloaded .tar (gzip unsupported in this browser)');
    return;
  }
  var cs = new CompressionStream('gzip');
  new Response(new Blob([tar]).stream().pipeThrough(cs)).blob().then(function (gz) {
    downloadBlob(gz, folder + '.tgz');
    toast('Downloaded ' + folder + '.tgz');
  });
}

