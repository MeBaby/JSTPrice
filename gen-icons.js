var fs = require('fs');

function createPNG(width, height) {
  var zlib = require('zlib');
  var pixels = [];
  var rawData = Buffer.alloc((width * 4 + 1) * height);
  
  var c1 = [79, 110, 246];
  var c2 = [124, 92, 252];

  for (var y = 0; y < height; y++) {
    rawData[y * (width * 4 + 1)] = 0;
    for (var x = 0; x < width; x++) {
      var t = (x + y) / (width + height);
      var r = Math.round(c1[0] * (1 - t) + c2[0] * t);
      var g = Math.round(c1[1] * (1 - t) + c2[1] * t);
      var b = Math.round(c1[2] * (1 - t) + c2[2] * t);
      var offset = y * (width * 4 + 1) + 1 + x * 4;
      rawData[offset] = r;
      rawData[offset + 1] = g;
      rawData[offset + 2] = b;
      rawData[offset + 3] = 255;
    }
  }

  var deflated = zlib.deflateSync(rawData);

  function crc32(buf) {
    var c;
    var table = [];
    for (var n = 0; n < 256; n++) {
      c = n;
      for (var k = 0; k < 8; k++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[n] = c;
    }
    c = 0xFFFFFFFF;
    for (var i = 0; i < buf.length; i++) {
      c = table[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    }
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function chunk(type, data) {
    var len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    var typeB = Buffer.from(type, 'ascii');
    var crcData = Buffer.concat([typeB, data]);
    var crcVal = Buffer.alloc(4);
    crcVal.writeUInt32BE(crc32(crcData), 0);
    return Buffer.concat([len, typeB, data, crcVal]);
  }

  var signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  var ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  var result = Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflated),
    chunk('IEND', Buffer.alloc(0))
  ]);

  return result;
}

fs.writeFileSync('icon16.png', createPNG(16, 16));
fs.writeFileSync('icon48.png', createPNG(48, 48));
fs.writeFileSync('icon128.png', createPNG(128, 128));
console.log('Icons generated: 16, 48, 128');