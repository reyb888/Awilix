// scripts/build-ephemeris-database.js
// Precomputes high-precision ephemeris and telemetry for all landing sites and mission dates.

import fs from 'fs';
import { computePositions, computePath, powerWindow, commWindow, topocentricAltAz } from '../src/lib/ephemeris.js';

const SITES_FILE = 'src/data/sites.json';
const OUTPUT_FILE = 'src/data/precomputed_ephemeris_db.json';

const MISSION_DATES = [
  { key: 'artemis-3', date: '2026-09-15', label: 'Artemis III' },
  { key: 'im-1', date: '2024-02-22', label: 'IM-1 Odysseus Landing' },
  { key: 'im-2', date: '2025-02-15', label: 'IM-2 Athena Target' },
  { key: 'griffin-m1', date: '2026-11-15', label: 'Griffin M1 Target' },
  { key: 'blue-ghost-m1', date: '2025-01-20', label: 'Blue Ghost M1' },
  { key: 'benchmark-de421', date: '2026-02-15', label: 'NASA DE421 Benchmark' },
];

function main() {
  const sites = JSON.parse(fs.readFileSync(SITES_FILE, 'utf8'));
  const database = {
    generatedAt: new Date().toISOString(),
    engine: 'NASA DE421 + IAU Libration Ephemeris Engine',
    sites: {},
  };

  console.log(`Precomputing database for ${sites.length} sites...`);

  for (const site of sites) {
    database.sites[site.id] = {
      id: site.id,
      name: site.name,
      lat: site.lat,
      lon: site.lon,
      missions: {},
    };

    for (const m of MISSION_DATES) {
      const startTime = new Date(`${m.date}T12:00:00Z`);
      const posNow = computePositions(site.lat, site.lon, startTime);

      const path24h = computePath(site.lat, site.lon, startTime, 24, 60);
      const path7d = computePath(site.lat, site.lon, startTime, 168, 180);
      const pathMonth = computePath(site.lat, site.lon, startTime, 708, 360);

      const power24 = powerWindow(path24h);
      const comm24 = commWindow(path24h);

      const power7d = powerWindow(path7d);
      const comm7d = commWindow(path7d);

      const powerMonth = powerWindow(pathMonth);
      const commMonth = commWindow(pathMonth);

      database.sites[site.id].missions[m.key] = {
        date: m.date,
        label: m.label,
        telemetry: {
          sunAlt: Math.round(posNow.sun.alt * 100) / 100,
          sunAz: Math.round(posNow.sun.az * 100) / 100,
          earthAlt: Math.round(posNow.earth.alt * 100) / 100,
          earthAz: Math.round(posNow.earth.az * 100) / 100,
          phase: Math.round(posNow.phase * 10) / 10,
        },
        windows: {
          '24h': { power: power24, comm: comm24 },
          '7d': { power: power7d, comm: comm7d },
          'month': { power: powerMonth, comm: commMonth },
        },
        pathSample24h: path24h.map(p => ({
          timeStr: p.time.toISOString(),
          sunAlt: Math.round(p.sun.alt * 100) / 100,
          sunAz: Math.round(p.sun.az * 100) / 100,
          earthAlt: Math.round(p.earth.alt * 100) / 100,
          earthAz: Math.round(p.earth.az * 100) / 100,
        })),
      };
    }
    console.log(`  -> Completed ${site.name}`);
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(database, null, 2));
  console.log(`\nSuccessfully saved precomputed ephemeris database to ${OUTPUT_FILE}`);
}

main();
