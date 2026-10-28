// process-ldem.js — Convert LDEM TIFF displacement maps to 16-bit grayscale PNG for Three.js
// Uses 'tiff' to read 16-bit data, 'pngjs' to write 16-bit grayscale PNG.

import { decode } from 'tiff';
import { PNG } from 'pngjs';
import fs from 'fs';
import path from 'path';

const INPUT_DIR = 'public/terrain';
const OUTPUT_DIR = 'public/terrain';

function processLdem(inputFile, outputFile) {
  console.log(`Processing ${inputFile}...`);
  
  const buf = fs.readFileSync(inputFile);
  const ifds = decode(buf);
  const ifd = ifds[0];
  
  console.log(`  Input: ${ifd.width}x${ifd.height}, bitsPerSample: ${ifd.bitsPerSample}`);
  
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < ifd.data.length; i++) {
    if (ifd.data[i] < min) min = ifd.data[i];
    if (ifd.data[i] > max) max = ifd.data[i];
  }
  console.log(`  Value range: ${min} - ${max}`);
  console.log(`  Elevation range: ${((min - 20000) / 2).toFixed(1)}m to ${((max - 20000) / 2).toFixed(1)}m`);
  
  // Create 16-bit grayscale PNG
  const png = new PNG({
    width: ifd.width,
    height: ifd.height,
    colorType: 0, // grayscale
    bitDepth: 16,
    inputColorType: 0,
    inputHasAlpha: false
  });
  
  // Fill pixel data (16-bit grayscale, big-endian per PNG spec)
  const data = png.data;
  for (let i = 0; i < ifd.data.length; i++) {
    const val = ifd.data[i];
    data[i * 2] = (val >> 8) & 0xFF;     // high byte
    data[i * 2 + 1] = val & 0xFF;         // low byte
  }
  
  const buffer = PNG.sync.write(png, { colorType: 0, bitDepth: 16 });
  fs.writeFileSync(outputFile, buffer);
  
  const stat = fs.statSync(outputFile);
  console.log(`  Output: ${ifd.width}x${ifd.height}, 16-bit grayscale PNG`);
  console.log(`  File size: ${(stat.size / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  Saved: ${outputFile}`);
}

function main() {
  processLdem(
    path.join(INPUT_DIR, 'ldem_4_uint.tif'),
    path.join(OUTPUT_DIR, 'ldem_4_uint.png')
  );
  
  processLdem(
    path.join(INPUT_DIR, 'ldem_16_uint.tif'),
    path.join(OUTPUT_DIR, 'ldem_16_uint.png')
  );
  
  console.log('Done!');
}

main();