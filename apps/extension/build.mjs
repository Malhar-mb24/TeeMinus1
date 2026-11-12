import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const rootDir = import.meta.dirname;
const distDir = path.join(rootDir, "dist");
const iconsDir = path.join(distDir, "icons");

fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(iconsDir, { recursive: true });

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function createEmberPng(size) {
  const rawRows = Buffer.alloc((size * 4 + 1) * size);
  const cx = (size - 1) / 2;
  const cy = (size - 1) / 2;
  const radius = size * 0.44;

  for (let y = 0; y < size; y += 1) {
    const rowStart = y * (size * 4 + 1);
    rawRows[rowStart] = 0;
    for (let x = 0; x < size; x += 1) {
      const px = rowStart + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > radius) {
        rawRows[px] = 0;
        rawRows[px + 1] = 0;
        rawRows[px + 2] = 0;
        rawRows[px + 3] = 0;
        continue;
      }

      // Charcoal circular badge with Ember amber inner flame drop.
      const ny = (y - cy) / radius;
      const nx = (x - cx) / radius;
      const inFlame = nx * nx * 2.1 + Math.pow(ny - 0.15, 2) < 0.36 && ny < 0.58;
      if (inFlame) {
        rawRows[px] = 249; // #F97316 -> #F59E0B warm amber
        rawRows[px + 1] = ny < 0 ? 158 : 115;
        rawRows[px + 2] = 22;
        rawRows[px + 3] = 255;
      } else {
        rawRows[px] = 28;
        rawRows[px + 1] = 25;
        rawRows[px + 2] = 23;
        rawRows[px + 3] = 255;
      }
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const compressed = zlib.deflateSync(rawRows);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", compressed),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

for (const size of [16, 48, 128]) {
  fs.writeFileSync(path.join(iconsDir, `icon-${size}.png`), createEmberPng(size));
}

await build({
  entryPoints: [
    path.join(rootDir, "src/background.ts"),
    path.join(rootDir, "src/popup.ts"),
    path.join(rootDir, "src/options.ts"),
  ],
  outdir: distDir,
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "chrome120",
  sourcemap: true,
  minify: false,
});

for (const asset of ["manifest.json", "popup.html", "options.html", "styles.css"]) {
  fs.copyFileSync(path.join(rootDir, asset), path.join(distDir, asset));
}

console.log("Built @ember/extension MV3 bundle in apps/extension/dist");
