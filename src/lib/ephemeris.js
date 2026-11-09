// Lunar ephemeris explorer. Independent precision validation is pending.
// NASA hourly directions are interpolated on the unit sphere; fallback is approximate.

import * as Astronomy from 'astronomy-engine';
import { interpolateDirection, panelIncidence, positiveWindow } from './scienceMath.js';

export const MOON_RADIUS_KM = 1737.4;
export const KM_PER_AU = 149597870.691;
const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

// In-memory cache for NASA SVS DE421 2026 hourly data
let moonInfo2026Cache = null;
let moonInfoLoadPromise = null;
const analyticalCache=new Map();
const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function expectedHourlyLabel(index){
  const date=new Date(Date.UTC(2026,0,1,index));
  return `${String(date.getUTCDate()).padStart(2,'0')} ${MONTHS[date.getUTCMonth()]} 2026 ${String(date.getUTCHours()).padStart(2,'0')}:00 UT`;
}

/** Validate record order, timestamps and coordinate ranges before interpolation. */
export function validateMoonInfo2026(data){
  if(!Array.isArray(data)||data.length!==8760)throw new Error('Expected 8760 hourly records for calendar year 2026');
  for(let i=0;i<data.length;i++){
    const p=data[i];
    if(!p||p.time!==expectedHourlyLabel(i))throw new Error(`Invalid or out-of-order timestamp at ephemeris row ${i+1}`);
    const directions=[p.subsolar,p.subearth];
    if(directions.some(point=>!point||!Number.isFinite(point.lat)||!Number.isFinite(point.lon)||Math.abs(point.lat)>90||Math.abs(point.lon)>180))throw new Error(`Invalid lunar direction at ephemeris row ${i+1}`);
    if(!Number.isFinite(p.distance)||p.distance<=MOON_RADIUS_KM||p.distance>500000||!Number.isFinite(p.phase)||p.phase<0||p.phase>360)throw new Error(`Invalid distance or phase at ephemeris row ${i+1}`);
  }
  return true;
}

/**
 * Preload and cache NASA SVS DE421 hourly ephemeris for 2026.
 */
export async function loadMoonInfo2026() {
  if (moonInfo2026Cache) return moonInfo2026Cache;
  if (moonInfoLoadPromise) return moonInfoLoadPromise;

  moonInfoLoadPromise = fetch('/data/mooninfo_2026.json')
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then((data) => {
      validateMoonInfo2026(data);
      moonInfo2026Cache = data;
      return data;
    })
    .catch((err) => {
      console.warn('Could not load mooninfo_2026.json, falling back to analytic model:', err);
      return null;
    });

  return moonInfoLoadPromise;
}

/**
 * Topocentric coordinate transformation from selenographic target vector to local East-North-Up (ENU).
 *
 * @param {number} obsLat - Observer latitude (degrees)
 * @param {number} obsLon - Observer longitude (degrees)
 * @param {number} tgtLat - Target sub-point latitude (degrees)
 * @param {number} tgtLon - Target sub-point longitude (degrees)
 * @param {number} tgtDistKm - Target distance from Moon center (km)
 * @returns {{alt: number, az: number, distanceKm: number}}
 */
export function topocentricAltAz(obsLat, obsLon, tgtLat, tgtLon, tgtDistKm, observerHeightM = 0) {
  const observerRadius = MOON_RADIUS_KM + observerHeightM / 1000;
  const oLat = obsLat * D2R;
  const oLon = obsLon * D2R;
  const tLat = tgtLat * D2R;
  const tLon = tgtLon * D2R;

  // Observer Cartesian position in selenographic frame
  const Ox = Math.cos(oLat) * Math.cos(oLon);
  const Oy = Math.cos(oLat) * Math.sin(oLon);
  const Oz = Math.sin(oLat);

  // Target direction unit vector
  const Tx = Math.cos(tLat) * Math.cos(tLon);
  const Ty = Math.cos(tLat) * Math.sin(tLon);
  const Tz = Math.sin(tLat);

  // Topocentric vector from observer to target
  const Vx = tgtDistKm * Tx - observerRadius * Ox;
  const Vy = tgtDistKm * Ty - observerRadius * Oy;
  const Vz = tgtDistKm * Tz - observerRadius * Oz;
  const Vmag = Math.sqrt(Vx * Vx + Vy * Vy + Vz * Vz);

  // Local Up is outward normal along radial vector O
  const dotUp = (Vx * Ox + Vy * Oy + Vz * Oz) / Vmag;
  const alt = Math.asin(Math.max(-1, Math.min(1, dotUp))) * R2D;

  // Local East & North vectors in selenographic frame
  let Ex = -Math.sin(oLon);
  let Ey = Math.cos(oLon);
  let Ez = 0;

  // At the pole, longitude defines the chosen meridian for azimuth.
  // North = Up x East
  const Nx = Oy * Ez - Oz * Ey;
  const Ny = Oz * Ex - Ox * Ez;
  const Nz = Ox * Ey - Oy * Ex;

  const dotEast = (Vx * Ex + Vy * Ey + Vz * Ez) / Vmag;
  const dotNorth = (Vx * Nx + Vy * Ny + Vz * Nz) / Vmag;
  let az = Math.atan2(dotEast, dotNorth) * R2D;
  if (az < 0) az += 360;

  return { alt, az, distanceKm: Vmag };
}

/**
 * Get Sub-Solar and Sub-Earth coordinates for a given time.
 * Uses NASA JPL DE421 dataset if date is in 2026 and loaded; otherwise uses Astronomy.Libration.
 */
export function getSubPoints(time) {
  const year = time.getUTCFullYear();

  // If year is 2026 and cache is loaded, use exact NASA SVS DE421 record
  if (year === 2026 && moonInfo2026Cache) {
    const start2026 = new Date('2026-01-01T00:00:00Z').getTime();
    const hoursFromStart = (time.getTime() - start2026) / 3600000;
    const baseHour = Math.floor(hoursFromStart);
    const frac = hoursFromStart - baseHour;

    if (baseHour >= 0 && baseHour <= moonInfo2026Cache.length - 1 && (baseHour < moonInfo2026Cache.length - 1 || frac === 0)) {
      const p0 = moonInfo2026Cache[baseHour];
      const p1 = moonInfo2026Cache[Math.min(baseHour + 1, moonInfo2026Cache.length - 1)];

      const solar = interpolateDirection(p0.subsolar, p1.subsolar, frac);
      const earth = interpolateDirection(p0.subearth, p1.subearth, frac);
      const subsolarLon = solar.lon, subsolarLat = solar.lat;
      const subearthLon = earth.lon, subearthLat = earth.lat;
      const earthDist = p0.distance + (p1.distance - p0.distance) * frac;

      return {
        source: 'NASA SVS 5587 · hourly directions (2026)',
        subsolar: { lon: subsolarLon, lat: subsolarLat, distKm: 149597870.7 },
        subearth: { lon: subearthLon, lat: subearthLat, distKm: earthDist },
        phase: p0.phase + (p1.phase - p0.phase) * frac,
      };
    }
  }

  if(analyticalCache.has(+time))return analyticalCache.get(+time);

  // Analytic computation using Astronomy.Libration & geocentric vectors
  const lib = Astronomy.Libration(time);
  const moonVecAU = Astronomy.GeoVector(Astronomy.Body.Moon, time, true);
  const sunVecAU = Astronomy.GeoVector(Astronomy.Body.Sun, time, true);

  const moonKm = { x: moonVecAU.x * KM_PER_AU, y: moonVecAU.y * KM_PER_AU, z: moonVecAU.z * KM_PER_AU };
  const sunKm = { x: sunVecAU.x * KM_PER_AU, y: sunVecAU.y * KM_PER_AU, z: sunVecAU.z * KM_PER_AU };
  const sunFromMoon = { x: sunKm.x - moonKm.x, y: sunKm.y - moonKm.y, z: sunKm.z - moonKm.z };
  const sunDist = Math.sqrt(sunFromMoon.x ** 2 + sunFromMoon.y ** 2 + sunFromMoon.z ** 2);

  // Sub-Earth optical + physical libration coordinates
  const subearthLat = lib.elat;
  const subearthLon = lib.elon;
  const earthDist = lib.dist_km;

  // Exact sub-solar selenographic longitude & latitude from ecliptic vectors & lunar pole
  const sunEcl = Astronomy.SunPosition(time);
  let dLon = sunEcl.elon - lib.mlon;
  while (dLon < -180) dLon += 360;
  while (dLon > 180) dLon -= 360;

  let subsolarLon = lib.elon + 180 + dLon;
  while (subsolarLon < -180) subsolarLon += 360;
  while (subsolarLon > 180) subsolarLon -= 360;

  // Subsolar latitude relative to lunar equator (accounting for 1.543° obliquity to ecliptic)
  const t_century = Astronomy.MakeTime(time).tt / 36525.0;
  const node_long = (125.0445 - 1934.1363 * t_century) * D2R;
  const f_node = sunEcl.elon * D2R - node_long;
  const subsolarLat = 1.543 * Math.sin(f_node) - sunEcl.elat;

  const phase = Astronomy.MoonPhase(time);

  const result = {
    source: 'Analytical fallback · approximate lunar orientation',
    subsolar: { lon: subsolarLon, lat: subsolarLat, distKm: sunDist },
    subearth: { lon: subearthLon, lat: subearthLat, distKm: earthDist },
    phase: phase,
  };
  if(analyticalCache.size>=4096)analyticalCache.delete(analyticalCache.keys().next().value);
  analyticalCache.set(+time,result);
  return result;
}

/**
 * Compute Sun and Earth alt/az and telemetry for a specific site and time.
 */
export function computePositions(lat, lon, time, options = {}) {
  if(!Number.isFinite(lat)||Math.abs(lat)>90||!Number.isFinite(lon)||Math.abs(lon)>180||!Number.isFinite(+time))throw new RangeError('Invalid lunar coordinates or UTC time');
  const { subsolar, subearth, source, phase } = getSubPoints(time);

  const sun = topocentricAltAz(lat, lon, subsolar.lat, subsolar.lon, subsolar.distKm, options.observerHeightM ?? 0);
  const earth = topocentricAltAz(lat, lon, subearth.lat, subearth.lon, subearth.distKm, options.observerHeightM ?? 0);

  // One explicit panel geometry for every site: horizontal by default.
  const powerEfficiency = sun.alt > 0 ? panelIncidence(sun.alt,sun.az,options.panelTiltDeg??0,options.panelAzimuthDeg??0) : 0;

  // DTE line-of-sight status
  const commActive = earth.alt > 0;

  return {
    time,
    sun,
    earth,
    powerEfficiency: Math.max(0, Math.min(1, powerEfficiency)),
    commActive,
    source,
    phase,
    subsolar,
    subearth,
  };
}

/**
 * Compute Sun and Earth paths over an extended time range (e.g. 24h, 168h, 708h).
 */
export function computePath(lat, lon, startTime, hours = 24, stepMinutes = 60, options = {}) {
  if(!Number.isFinite(hours)||hours<=0||hours>744||!Number.isFinite(stepMinutes)||stepMinutes<=0)throw new RangeError('Invalid analysis duration or step');
  const path = [];
  const totalMinutes = hours * 60;
  const steps = Math.ceil(totalMinutes / stepMinutes);

  for (let i = 0; i <= steps; i++) {
    const time = new Date(startTime.getTime() + Math.min(totalMinutes, i * stepMinutes) * 60 * 1000);
    const pos = computePositions(lat, lon, time, options);
    path.push(pos);
  }

  return path;
}

/**
 * Compute Power Generation Window statistics.
 */
export function powerWindow(path, threshold = 0) {
  return positiveWindow(path ?? [],p=>p.sunMargin ?? p.sun.alt-threshold,p=>p.sun.alt);
}
export function commWindow(path, horizonElev = 0) {
  return positiveWindow(path ?? [],p=>p.earthMargin ?? p.earth.alt-horizonElev,p=>p.earth.alt);
}

