// scripts/build-terrain-database.js
// Generates dual-surface terrain data (Raw LOLA Altimetry + Continuous Bicubic Spline Interpolated)
// for all candidate landing sites using NASA LOLA Digital Elevation Models.

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const SITES_FILE = 'src/data/sites.json';
const OUTPUT_DIR = 'public/terrain';
const GRID_SIZE = 128; // 128x128 vertex grid = 16,384 vertices
const R_MOON = 1737400; // meters

function cubicKernel(x) {
  x = Math.abs(x);
  if (x <= 1) return 1.5 * x * x * x - 2.5 * x * x + 1;
  if (x < 2) return -0.5 * x * x * x + 2.5 * x * x - 4 * x + 2;
  return 0;
}

function bicubicInterpolate(grid, w, h, x, y) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  let val = 0;
  let weightSum = 0;

  for (let j = -1; j <= 2; j++) {
    const py = Math.min(h - 1, Math.max(0, y0 + j));
    const wy = cubicKernel(y - (y0 + j));
    for (let i = -1; i <= 2; i++) {
      const px = Math.min(w - 1, Math.max(0, x0 + i));
      const wx = cubicKernel(x - (x0 + i));
      const wTotal = wx * wy;
      val += grid[py * w + px] * wTotal;
      weightSum += wTotal;
    }
  }
  return weightSum > 0 ? val / weightSum : grid[y0 * w + x0];
}

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const sites = JSON.parse(fs.readFileSync(SITES_FILE, 'utf8'));
  const meta = {};

  console.log(`Processing dual-surface terrain for ${sites.length} sites...`);

  for (const site of sites) {
    console.log(`\nProcessing site: ${site.name} (${site.id})`);

    // We extract a 64x64 raw sample window from NASA LDEM 16 (or polar DEM)
    // and interpolate it to 128x128 for smooth continuous rendering
    const px = Math.round((site.lon + 180) * 16);
    const py = Math.round((90 - site.lat) * 16);
    const halfWindow = 24; // 48x48 degrees/16 window = ~3 degrees = ~90 km patch
    const left = Math.min(5760 - halfWindow * 2, Math.max(0, px - halfWindow));
    const top = Math.min(2880 - halfWindow * 2, Math.max(0, py - halfWindow));

    const rawBuf = await sharp('public/terrain/ldem_16_uint.tif')
      .extract({ left, top, width: halfWindow * 2, height: halfWindow * 2 })
      .raw()
      .toBuffer();

    const u16 = new Uint16Array(rawBuf.buffer, rawBuf.byteOffset, rawBuf.length / 2);
    const srcW = halfWindow * 2;
    const srcH = halfWindow * 2;

    // Convert to meters
    const rawElevGrid = new Float32Array(srcW * srcH);
    let minM = Infinity, maxM = -Infinity;
    for (let i = 0; i < srcW * srcH; i++) {
      const elevM = (u16[i] - 20000) * 0.5;
      rawElevGrid[i] = elevM;
      if (elevM < minM) minM = elevM;
      if (elevM > maxM) maxM = elevM;
    }

    // Now produce 128x128 RAW (nearest neighbor) and 128x128 INTERPOLATED (bicubic continuous)
    const rawOut = new Float32Array(GRID_SIZE * GRID_SIZE);
    const interpOut = new Float32Array(GRID_SIZE * GRID_SIZE);

    for (let gy = 0; gy < GRID_SIZE; gy++) {
      const srcY = (gy / (GRID_SIZE - 1)) * (srcH - 1);
      const nearY = Math.min(srcH - 1, Math.round(srcY));
      for (let gx = 0; gx < GRID_SIZE; gx++) {
        const srcX = (gx / (GRID_SIZE - 1)) * (srcW - 1);
        const nearX = Math.min(srcW - 1, Math.round(srcX));

        // Raw: discrete step value
        rawOut[gy * GRID_SIZE + gx] = rawElevGrid[nearY * srcW + nearX];

        // Continuous: Bicubic spline surface interpolation
        interpOut[gy * GRID_SIZE + gx] = bicubicInterpolate(rawElevGrid, srcW, srcH, srcX, srcY);
      }
    }

    // Generate photographic surface texture using hillshade gradient
    // We compute normal illumination from light angle (azimuth 45 deg, elevation 30 deg)
    const textureCanvas = new Uint8Array(GRID_SIZE * GRID_SIZE * 4);
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const idx = y * GRID_SIZE + x;
        const z = interpOut[idx];

        // Slopes
        const zLeft = x > 0 ? interpOut[y * GRID_SIZE + (x - 1)] : z;
        const zRight = x < GRID_SIZE - 1 ? interpOut[y * GRID_SIZE + (x + 1)] : z;
        const zUp = y > 0 ? interpOut[(y - 1) * GRID_SIZE + x] : z;
        const zDown = y < GRID_SIZE - 1 ? interpOut[(y + 1) * GRID_SIZE + x] : z;

        const dzdx = (zRight - zLeft) / 200;
        const dzdy = (zDown - zUp) / 200;

        // Illumination dot product with sun vector (0.5, 0.5, 0.7)
        const dot = (-dzdx * 0.5 - dzdy * 0.5 + 0.7) / Math.sqrt(dzdx * dzdx + dzdy * dzdy + 1);
        const brightness = Math.max(0.15, Math.min(0.95, 0.45 + dot * 0.45));

        // Lunar regolith albedo: slate gray with subtle mineral tint
        const baseColor = [180, 185, 195];
        const r = Math.round(baseColor[0] * brightness);
        const g = Math.round(baseColor[1] * brightness);
        const b = Math.round(baseColor[2] * brightness);

        textureCanvas[idx * 4] = r;
        textureCanvas[idx * 4 + 1] = g;
        textureCanvas[idx * 4 + 2] = b;
        textureCanvas[idx * 4 + 3] = 255;
      }
    }

    const texturePath = path.join(OUTPUT_DIR, `${site.id}_texture.png`);
    await sharp(Buffer.from(textureCanvas.buffer), {
      raw: { width: GRID_SIZE, height: GRID_SIZE, channels: 4 }
    }).png().toFile(texturePath);

    // Save JSON data package with both Raw and Continuous elevation arrays
    const dataPackage = {
      id: site.id,
      name: site.name,
      lat: site.lat,
      lon: site.lon,
      gridSize: GRID_SIZE,
      minElevationM: Math.round(minM),
      maxElevationM: Math.round(maxM),
      elevationSpanM: Math.round(maxM - minM),
      widthKm: ((srcW / 16) * 30.3).toFixed(1),
      heightKm: ((srcH / 16) * 30.3).toFixed(1),
      textureUrl: `/terrain/${site.id}_texture.png`,
      rawElev: Array.from(rawOut).map(v => Math.round(v * 10) / 10),
      interpElev: Array.from(interpOut).map(v => Math.round(v * 10) / 10),
    };

    const jsonPath = path.join(OUTPUT_DIR, `${site.id}_terrain.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(dataPackage));

    meta[site.id] = {
      name: site.name,
      lat: site.lat,
      lon: site.lon,
      minElevationM: dataPackage.minElevationM,
      maxElevationM: dataPackage.maxElevationM,
      elevationSpanM: dataPackage.elevationSpanM,
      widthKm: dataPackage.widthKm,
      heightKm: dataPackage.heightKm,
      terrainDataUrl: `/terrain/${site.id}_terrain.json`,
      textureMap: `/terrain/${site.id}_texture.png`,
    };

    console.log(`  -> Saved ${site.id}: min ${minM.toFixed(1)}m, max ${maxM.toFixed(1)}m, span ${(maxM - minM).toFixed(1)}m`);
  }

  fs.writeFileSync(path.join(OUTPUT_DIR, 'sites-meta.json'), JSON.stringify(meta, null, 2));
  console.log('\nDual-surface terrain database generated successfully!');
}

main().catch(console.error);
