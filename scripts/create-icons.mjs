import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) { crc ^= byte; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const name = Buffer.from(type); const size = Buffer.alloc(4); size.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([size, name, data, crc]);
}
function icon(size) {
  const pixels = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = x / size - 0.5; const dy = y / size - 0.5;
    const face = dx * dx + dy * dy < 0.29 ** 2;
    const eye = (Math.abs(dx - 0.095) < 0.018 || Math.abs(dx + 0.095) < 0.018) && Math.abs(dy + 0.055) < 0.024;
    const smile = Math.abs(Math.hypot(dx, dy - 0.005) - 0.13) < 0.012 && dy > 0.055 && Math.abs(dx) < 0.12;
    const color = eye || smile ? [36, 62, 57] : face ? [240, 205, 115] : [52, 94, 80];
    const offset = y * (size * 4 + 1) + 1 + x * 4;
    pixels.set([...color, 255], offset);
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))]);
}
for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['icon-maskable.png', 512]]) writeFileSync(fileURLToPath(new URL(`../public/${name}`, import.meta.url)), icon(size));
