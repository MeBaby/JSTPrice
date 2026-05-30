var fs = require('fs');
var zlib = require('zlib');

function crc32(buf) {
  var c = 0xFFFFFFFF;
  var table = [];
  for (var n = 0; n < 256; n++) {
    c = n;
    for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  for (var i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  var len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  var typeB = Buffer.from(type, 'ascii');
  var crcData = Buffer.concat([typeB, data]);
  var crcVal = Buffer.alloc(4); crcVal.writeUInt32BE(crc32(crcData), 0);
  return Buffer.concat([len, typeB, data, crcVal]);
}

function makeIcon(size) {
  var raw = Buffer.alloc((size * 4 + 1) * size);

  for (var y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (var x = 0; x < size; x++) {
      var t = (x + y) / (size * 2);
      var r = Math.round(79 * (1 - t) + 124 * t);
      var g = Math.round(110 * (1 - t) + 92 * t);
      var b = Math.round(246 * (1 - t) + 252 * t);
      var off = y * (size * 4 + 1) + 1 + x * 4;
      raw[off] = r; raw[off+1] = g; raw[off+2] = b; raw[off+3] = 255;
    }
  }

  var border = Math.max(1, Math.floor(size / 16));
  var fs2 = Math.max(4, Math.floor(size / 8));
  var fo = Math.floor(size * 0.22);

  function drawX(cx, cy, fsize, color) {
    var thick = Math.max(1, Math.floor(fsize / 5));
    var r = color[0], g2 = color[1], b = color[2];
    for (var dy = -fsize/2; dy < fsize/2; dy++) {
      for (var dx = -fsize/2; dx < fsize/2; dx++) {
        var ax = Math.abs(dx), ay = Math.abs(dy);
        var d1 = ax * fsize / 2 + ay * fsize / 2;
        var d2 = ax * fsize / 2 - ay * fsize / 2;
        var onLine = (d1 < fsize * 0.45 && d1 > fsize * 0.15) || (d2 > -fsize * 0.45 && d2 < -fsize * 0.15 && ax < fsize * 0.2);
        if (onLine) {
          var ix = Math.round(cx + dx), iy = Math.round(cy + dy);
          if (ix >= 0 && ix < size && iy >= 0 && iy < size) {
            var o = iy * (size * 4 + 1) + 1 + ix * 4;
            raw[o] = r; raw[o+1] = g2; raw[o+2] = b; raw[o+3] = 255;
          }
        }
      }
    }
  }

  function drawY(cx, cy, fsize, color) {
    var r = color[0], g2 = color[1], b = color[2];
    for (var dy = -fsize/2; dy < fsize/2; dy++) {
      for (var dx = -fsize/2; dx < fsize/2; dx++) {
        var ax = Math.abs(dx), ay = Math.abs(dy);
        var onLine = (ax < fsize * 0.18 && ay < fsize * 0.5) ||
                     (dy > 0 && ax < fsize * 0.18 && Math.sqrt(dx*dx + (dy-fsize*0.15)*(dy-fsize*0.15)) < fsize * 0.2);
        if (onLine) {
          var ix = Math.round(cx + dx), iy = Math.round(cy + dy);
          if (ix >= 0 && ix < size && iy >= 0 && iy < size) {
            var o = iy * (size * 4 + 1) + 1 + ix * 4;
            raw[o] = r; raw[o+1] = g2; raw[o+2] = b; raw[o+3] = 255;
          }
        }
      }
    }
  }

  drawX(fo, size/2, fs2, [255,255,255]);
  drawY(size - fo, size/2, fs2, [255,255,255]);

  var deflated = zlib.deflateSync(raw);

  var ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflated),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

fs.writeFileSync('icon16.png', makeIcon(16));
fs.writeFileSync('icon48.png', makeIcon(48));
fs.writeFileSync('icon128.png', makeIcon(128));
console.log('Icons with XY generated');