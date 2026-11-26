// One image, one day: the front page for Thursday 26 November 2026.
//
// This program ships the rendered newspaper (entry.png, drawn by render.py
// during the build) beside it and places a validated copy at
// /output/entry.png. Before copying, the shipped file is checked end to
// end: it must be a whole PNG, 1024 by 1024 pixels, 8-bit RGB, no more
// than a mebibyte, with every chunk checksum intact. Nothing is fetched
// from the network, and two runs produce identical bytes.
import crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SHIPPED = path.join(ROOT, "entry.png");
const DEST_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
const DEST = path.join(DEST_DIR, "entry.png");

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const MAX_BYTES = 1024 * 1024;
const WANT_WIDTH = 1024;
const WANT_HEIGHT = 1024;

function die(why: string): never {
  throw new Error(`shipped entry.png failed validation: ${why}`);
}

// CRC-32, computed bit by bit (no lookup table) over a chunk's type + data.
function chunkCrc(kind: Buffer, payload: Buffer): number {
  let crc = 0xffffffff;
  const bytes = Buffer.concat([kind, payload]);
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// Read the shipped PNG, confirm its shape, and walk every chunk.
function inspect(png: Buffer): { chunks: number; idatBytes: number } {
  if (png.length > MAX_BYTES) {
    die(`${png.length} bytes, over the 1 MiB limit`);
  }
  if (png.length < 8) {
    die("shorter than a PNG signature");
  }
  for (let i = 0; i < SIGNATURE.length; i++) {
    if (png[i] !== SIGNATURE[i]) die(`signature byte ${i} is wrong`);
  }

  let pos = 8;
  let chunks = 0;
  let idatBytes = 0;
  let sawIdat = false;
  let sawIhdr = false;
  while (pos < png.length) {
    if (pos + 8 > png.length) die("chunk header runs past the end");
    const size = png.readUInt32BE(pos);
    const kind = png.subarray(pos + 4, pos + 8);
    const name = kind.toString("latin1");
    if (pos + 12 + size > png.length) die(`chunk ${name} runs past the end`);
    const payload = png.subarray(pos + 8, pos + 8 + size);
    const stored = png.readUInt32BE(pos + 8 + size);
    if (chunkCrc(kind, payload) !== stored) die(`checksum mismatch in ${name}`);
    if (chunks === 0) {
      if (name !== "IHDR") die("first chunk is not IHDR");
      sawIhdr = true;
    }
    if (name === "IDAT") {
      sawIdat = true;
      idatBytes += size;
    }
    if (name === "IEND") {
      if (size !== 0) die("IEND must be empty");
      if (pos + 12 + size !== png.length) die("bytes after IEND");
    }
    chunks += 1;
    pos += 12 + size;
  }
  if (!sawIhdr) die("no IHDR chunk");
  if (!sawIdat) die("no IDAT chunk");
  if (idatBytes === 0) die("no image data");

  // IHDR layout: width at 16, height at 20, bit depth at 24, colour at 25.
  const w = png.readUInt32BE(16);
  const h = png.readUInt32BE(20);
  if (w !== WANT_WIDTH || h !== WANT_HEIGHT) {
    die(`canvas is ${w}x${h}, want ${WANT_WIDTH}x${WANT_HEIGHT}`);
  }
  if (png[24] !== 8 || png[25] !== 2) {
    die(`bit depth ${png[24]}, colour type ${png[25]}; want 8-bit RGB`);
  }
  return { chunks, idatBytes };
}

const png = fs.readFileSync(SHIPPED);
const { chunks, idatBytes } = inspect(png);

fs.mkdirSync(DEST_DIR, { recursive: true });
fs.writeFileSync(DEST, png);

// Read the copy back and demand byte equality with the shipped file.
const written = fs.readFileSync(DEST);
if (Buffer.compare(written, png) !== 0) die("copy differs from the shipped file");
if (written.length !== png.length) die("copy size differs from the shipped file");
for (let i = 0; i < SIGNATURE.length; i++) {
  if (written[i] !== SIGNATURE[i]) die(`copy signature byte ${i} is wrong`);
}

const digest = crypto.createHash("sha256").update(written).digest("hex");
console.log(`shipped ${SHIPPED}: ${png.length} bytes`);
console.log(`wrote ${DEST}: ${written.length} bytes, sha256 ${digest}`);
console.log(`checked ${chunks} chunks, ${idatBytes} image bytes, all checksums good`);
console.log("entry.png OK: 1024x1024 RGB, deterministic copy");
