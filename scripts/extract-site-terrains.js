// scripts/extract-site-terrains.js
// Extracts real NASA LDEM elevation displacement maps and hillshade textures for all sites.

import sharp from 'sharp';
import { PNG } from 'pngjs';
import fs from 'fs';
import path from 'path';

const SITES_FILE = 'src/data/sites.json';
const OUTPUT_DIR = 'public/terrain';
const R_MOON = 1737400; // meters

function latLonToPolarPx(lat, lon) {
  const d2r = Math.PI / 180;
  const colat = (90 + lat) * d2r;
  const rho = 2 * R_MOON * Math.tan(colat / 2);
  const x = rho * Math.sin(lon * d2r);
  const y = -rho * Math.cos(lon * d2r);
  const px = Math.round((x - (-304000)) / 80);
  const py = Math.round((304000 - y) / 80);
  return { px, py };
}

async function run() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const sites = JSON.parse(fs.readFileSync(SITES_FILE, 'utf8'));
  const meta = {};

  console.log(`Processing terrain for ${sites.length} sites...`);

  for (const site of sites) {
    console.log(`\nProcessing site: ${site.name} (${site.id})`);
    const isPolar = site.lat <= -80;
    const width = 256;
    const height = 256;

    if (isPolar) {
      const { px, py } = latLonToPolarPx(site.lat, site.lon);
      const left = Math.max(0, Math.min(7600 - width, px - Math.floor(width / 2)));
      const top = Math.max(0, Math.min(7600 - height, py - Math.floor(height / 2)));

      // Extract hillshade texture
      const texturePath = path.join(OUTPUT_DIR, `${site.id}_texture.png`);
      await sharp('public/LDEM,LDEC,LDE/LDEM_80S_80MPP_ADJ_HILL.tiff')
        .extract({ left, top, width, height })
        .png()
        .toFile(texturePath);

      // Extract float elevation from LDEM_80S
      const rawFloatBuf = await sharp('public/LDEM,LDEC,LDE/LDEM_80S_80MPP_ADJ.tiff')
        .extract({ left, top, width, height })
        .raw({ depth: 'float' })
        .toBuffer();

      const numFloats = rawFloatBuf.length / 4;
      const floatArr = new Float32Array(rawFloatBuf.buffer, rawFloatBuf.byteOffset, numFloats);
      const step = numFloats === width * height * 3 ? 3 : 1;

      let minElev = Infinity, maxElev = -Infinity;
      for (let i = 0; i < width * height; i++) {
        const val = floatArr[i * step];
        if (val > -100000 && val < 100000) {
          if (val < minElev) minElev = val;
          if (val > maxElev) maxElev = val;
        }
      }

      // Create 16-bit displacement PNG
      const png = new PNG({ width, height, colorType: 0, bitDepth: 16, inputColorType: 0 });
      const span = maxElev > minElev ? maxElev - minElev : 1;
      for (let i = 0; i < width * height; i++) {
        let val = floatArr[i * step];
        if (val < -100000 || val > 100000) val = minElev;
        const norm = Math.max(0, Math.min(1, (val - minElev) / span));
        const u16 = Math.round(norm * 65535);
        png.data[i * 2] = (u16 >> 8) & 0xFF;
        png.data[i * 2 + 1] = u16 & 0xFF;
      }

      const heightPath = path.join(OUTPUT_DIR, `${site.id}_height.png`);
      const pngBuf = PNG.sync.write(png, { colorType: 0, bitDepth: 16 });
      fs.writeFileSync(heightPath, pngBuf);

      meta[site.id] = {
        name: site.name,
        lat: site.lat,
        lon: site.lon,
        isPolar: true,
        source: 'NASA LOLA LDEM 80S (80m/pixel)',
        minElevationM: Math.round(minElev),
        maxElevationM: Math.round(maxElev),
        elevationSpanM: Math.round(span),
        widthKm: (width * 0.080).toFixed(1),
        heightKm: (height * 0.080).toFixed(1),
        heightMap: `/terrain/${site.id}_height.png`,
        textureMap: `/terrain/${site.id}_texture.png`
      };
      console.log(`  -> Saved polar DEM: span ${span.toFixed(1)}m (${minElev.toFixed(1)}m to ${maxElev.toFixed(1)}m)`);
    } else {
      // Equatorial sites
      const px = Math.round((site.lon + 180) * 16);
      const py = Math.round((90 - site.lat) * 16);
      const left = Math.max(0, Math.min(5760 - width, px - Math.floor(width / 2)));
      const top = Math.max(0, Math.min(2880 - height, py - Math.floor(height / 2)));

      const rawBuf = await sharp('public/terrain/ldem_16_uint.tif')
        .extract({ left, top, width, height })
        .raw()
        .toBuffer();

      const numU16 = rawBuf.length / 2;
      const u16Arr = new Uint16Array(rawBuf.buffer, rawBuf.byteOffset, numU16);
      const step = numU16 === width * height * 3 ? 3 : 1;

      let minVal = Infinity, maxVal = -Infinity;
      for (let i = 0; i < width * height; i++) {
        const val = u16Arr[i * step];
        if (val < minVal) minVal = val;
        if (val > maxVal) maxVal = val;
      }

      const minElev = (minVal - 20000) / 2;
      const maxElev = (maxVal - 20000) / 2;
      const span = maxElev - minElev;

      const png = new PNG({ width, height, colorType: 0, bitDepth: 16, inputColorType: 0 });
      const valSpan = maxVal > minVal ? maxVal - minVal : 1;
      for (let i = 0; i < width * height; i++) {
        const val = u16Arr[i * step];
        const norm = Math.max(0, Math.min(1, (val - minVal) / valSpan));
        const u16 = Math.round(norm * 65535);
        png.data[i * 2] = (u16 >> 8) & 0xFF;
        png.data[i * 2 + 1] = u16 & 0xFF;
      }

      const heightPath = path.join(OUTPUT_DIR, `${site.id}_height.png`);
      const pngBuf = PNG.sync.write(png, { colorType: 0, bitDepth: 16 });
      fs.writeFileSync(heightPath, pngBuf);

      const texturePath = path.join(OUTPUT_DIR, `${site.id}_texture.png`);
      await sharp(heightPath)
        .modulate({ brightness: 1.1, contrast: 1.4 })
        .png()
        .toFile(texturePath);

      meta[site.id] = {
        name: site.name,
        lat: site.lat,
        lon: site.lon,
        isPolar: false,
        source: 'NASA LOLA LDEM 16 (16 pixels/deg)',
        minElevationM: Math.round(minElev),
        maxElevationM: Math.round(maxElev),
        elevationSpanM: Math.round(span),
        widthKm: ((width / 16) * 30.3).toFixed(1),
        heightKm: ((height / 16) * 30.3).toFixed(1),
        heightMap: `/terrain/${site.id}_height.png`,
        textureMap: `/terrain/${site.id}_texture.png`
      };
      console.log(`  -> Saved equatorial DEM: span ${span.toFixed(1)}m (${minElev.toFixed(1)}m to ${maxElev.toFixed(1)}m)`);
    }
  }

  fs.writeFileSync(path.join(OUTPUT_DIR, 'sites-meta.json'), JSON.stringify(meta, null, 2));
  console.log('\nAll terrain files extracted and saved successfully!');
}

run().catch(console.error);
