// news-image-20261126: sum up 26 November 2026's world news in one image.
//
// The entry is a program that writes one image to /output/entry.png.
// It ships the rendered front page (entry.png, drawn by render.py in the
// build session) and copies it to the output path after checking it is a
// whole, valid PNG: right signature, 1024x1024 RGB, at most 1 MiB. It runs
// with no network and writes the same bytes twice.
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "entry.png");
const OUT_DIR = process.env.MAKEFUN_OUTPUT_DIR || "/output";
const OUT = join(OUT_DIR, "entry.png");

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function fail(msg: string): never {
  throw new Error(`entry.png invalid: ${msg}`);
}

// CRC-32 (PNG polynomial) over chunk type + data, as the format requires.
function makeCrcTable(): Uint32Array {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
}
const CRC_TABLE = makeCrcTable();
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const data = readFileSync(SRC);
if (data.length > 1024 * 1024) fail(`too big: ${data.length} bytes`);
if (data.length < 8 || !data.subarray(0, 8).equals(PNG_SIG)) {
  fail("bad PNG signature");
}

// Walk the whole chunk chain: length (4) + type (4) + data + CRC (4).
// IHDR first, IDAT present, IEND last, no trailing bytes, every CRC valid.
let off = 8;
let chunks = 0;
let seenIdat = false;
let imageBytes = 0;
let first = true;
while (off < data.length) {
  if (off + 8 > data.length) fail("truncated chunk header");
  const len = data.readUInt32BE(off);
  const type = data.toString("latin1", off + 4, off + 8);
  if (off + 12 + len > data.length) fail(`truncated chunk ${type}`);
  const storedCrc = data.readUInt32BE(off + 8 + len);
  const actualCrc = crc32(data.subarray(off + 4, off + 8 + len));
  if (storedCrc !== actualCrc) fail(`bad CRC in chunk ${type}`);
  if (first && type !== "IHDR") fail("first chunk is not IHDR");
  first = false;
  if (type === "IDAT") {
    seenIdat = true;
    imageBytes += len;
  }
  if (type === "IEND") {
    if (len !== 0) fail("IEND must be empty");
    if (off + 12 + len !== data.length) fail("trailing bytes after IEND");
  }
  chunks++;
  off += 12 + len;
}
if (!seenIdat) fail("no IDAT chunk");
if (imageBytes === 0) fail("empty image data");
// IHDR: width/height at 16/20, bit depth at 24, colour type at 25.
const width = data.readUInt32BE(16);
const height = data.readUInt32BE(20);
const bitDepth = data[24];
const colourType = data[25];
if (width !== 1024 || height !== 1024) {
  fail(`dimensions ${width}x${height}, want 1024x1024`);
}
if (bitDepth !== 8 || colourType !== 2) {
  fail(`bit depth ${bitDepth}, colour type ${colourType}, want 8-bit RGB`);
}

mkdirSync(OUT_DIR, { recursive: true });
copyFileSync(SRC, OUT);

// Read back and byte-compare so the written file is exactly the shipped one.
const back = readFileSync(OUT);
if (!back.equals(data)) fail("read-back differs from source");
if (back.length !== data.length) fail("output size differs from source");
const sha = createHash("sha256").update(back).digest("hex");
console.log(`source ${SRC}: ${data.length} bytes`);
console.log(`wrote ${OUT}: ${back.length} bytes, sha256 ${sha}`);
console.log(`${chunks} PNG chunks verified, ${imageBytes} image bytes`);
console.log("entry.png OK: 1024x1024 RGB, deterministic copy");
