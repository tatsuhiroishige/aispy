#!/usr/bin/env node
// Minimal Kitty graphics protocol test.
// Emits a pure red 100x100 image directly to stdout.
// If this shows an image in Ghostty, the protocol works.
// Run: node scripts/test-kitty-minimal.mjs

import sharp from 'sharp';

const img = await sharp({
  create: {
    width: 100,
    height: 100,
    channels: 4,
    background: { r: 255, g: 0, b: 0, alpha: 1 },
  },
})
  .raw()
  .toBuffer({ resolveWithObject: true });

const b64 = img.data.toString('base64');
const CHUNK = 4096;
const chunks = [];
for (let i = 0; i < b64.length; i += CHUNK) {
  chunks.push(b64.slice(i, i + CHUNK));
}

const ESC = '\x1b';
const ST = `${ESC}\\`;

process.stdout.write('BEFORE IMAGE\n');

for (let i = 0; i < chunks.length; i++) {
  const isFirst = i === 0;
  const isLast = i === chunks.length - 1;
  const parts = [];
  if (isFirst) {
    parts.push('a=T');
    parts.push('f=32');
    parts.push(`s=${img.info.width}`);
    parts.push(`v=${img.info.height}`);
  }
  parts.push(`m=${isLast ? 0 : 1}`);
  process.stdout.write(`${ESC}_G${parts.join(',')};${chunks[i]}${ST}`);
}
process.stdout.write('\nAFTER IMAGE\n');
process.stdout.write(`chunks=${chunks.length}, pixelBytes=${img.data.length}, dims=${img.info.width}x${img.info.height}, channels=${img.info.channels}\n`);
