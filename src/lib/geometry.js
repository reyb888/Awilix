// geometry.js — Coordinate transforms for lunar surface observer
// Uses ecliptic-based Moon orientation (simplified, no libration/obliquity).
// All angles in radians unless noted. Distances in km.

const MOON_RADIUS_KM = 1737.4;
const KM_PER_AU = 149597870.691;

// Ecliptic north pole in J2000 equatorial coordinates
// RA = 18h (270°), Dec = 66.5° (approx ecliptic north)
const ECL_NORTH_RA = (270 * Math.PI) / 180;
const ECL_NORTH_DEC = (66.5 * Math.PI) / 180;
const MOON_NORTH_POLE = {
  x: Math.cos(ECL_NORTH_DEC) * Math.cos(ECL_NORTH_RA),
  y: Math.cos(ECL_NORTH_DEC) * Math.sin(ECL_NORTH_RA),
  z: Math.sin(ECL_NORTH_DEC),
};

/**
 * Normalize a vector to unit length.
 */
function normalize(v) {
  const mag = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  if (mag < 1e-15) return { x: 0, y: 0, z: 0 };
  return { x: v.x / mag, y: v.y / mag, z: v.z / mag };
}

/**
 * Cross product of two vectors.
 */
function cross(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

/**
 * Dot product of two vectors.
 */
function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

/**
 * Scale a vector by a scalar.
 */
function scale(v, s) {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

/**
 * Add two vectors.
 */
function add(a, b) {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

/**
 * Subtract vector b from vector a.
 */
function sub(a, b) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

/**
 * Compute observer position on Moon surface in J2000 equatorial frame.
 * Uses ecliptic-based orientation: Moon's north pole ≈ ecliptic north.
 * Prime meridian (0° lon) faces Earth (tidal lock).
 *
 * @param {number} lat - Latitude in degrees
 * @param {number} lon - Longitude in degrees
 * @param {{x,y,z}} earthDir - Unit vector from Moon center to Earth (J2000 equatorial)
 * @returns {{x, y, z}} Observer position in km (J2000 equatorial frame)
 */
export function observerPosition(lat, lon, earthDir) {
  const latRad = (lat * Math.PI) / 180;
  const lonRad = (lon * Math.PI) / 180;

  // Moon's north pole (z-axis of body frame)
  const n = MOON_NORTH_POLE;

  // Body x-axis: Earth direction projected onto Moon's equatorial plane
  // (component of earthDir perpendicular to n)
  const eDotN = dot(earthDir, n);
  const xBody = normalize(sub(earthDir, scale(n, eDotN)));

  // Body y-axis: n cross xBody
  const yBody = normalize(cross(n, xBody));

  // Body z-axis: n
  const zBody = n;

  // Observer position in body frame
  const cosLat = Math.cos(latRad);
  const sinLat = Math.sin(latRad);
  const cosLon = Math.cos(lonRad);
  const sinLon = Math.sin(lonRad);

  const bx = MOON_RADIUS_KM * cosLat * cosLon;
  const by = MOON_RADIUS_KM * cosLat * sinLon;
  const bz = MOON_RADIUS_KM * sinLat;

  // Transform to J2000: O = bx*xBody + by*yBody + bz*zBody
  return {
    x: bx * xBody.x + by * yBody.x + bz * zBody.x,
    y: bx * xBody.y + by * yBody.y + bz * zBody.y,
    z: bx * xBody.z + by * yBody.z + bz * zBody.z,
  };
}

/**
 * Compute local ENU (East-North-Up) basis vectors at observer position.
 * @param {{x, y, z}} obs - Observer position (J2000 equatorial)
 * @param {{x,y,z}} moonNorth - Moon's north pole direction (unit vector)
 * @returns {{up: {x,y,z}, east: {x,y,z}, north: {x,y,z}}}
 */
export function enuBasis(obs, moonNorth) {
  const r = Math.sqrt(obs.x * obs.x + obs.y * obs.y + obs.z * obs.z);
  const up = { x: obs.x / r, y: obs.y / r, z: obs.z / r };

  // East = moonNorth cross up (tangent to latitude circle)
  let east = cross(moonNorth, up);
  const eastMag = Math.sqrt(east.x * east.x + east.y * east.y + east.z * east.z);
  if (eastMag < 1e-10) {
    // At pole, use a different reference
    east = { x: 1, y: 0, z: 0 };
  } else {
    east = { x: east.x / eastMag, y: east.y / eastMag, z: east.z / eastMag };
  }

  // North = up cross east
  const north = normalize(cross(up, east));

  return { up, east, north };
}

/**
 * Compute altitude and azimuth from a topocentric vector and ENU basis.
 * @param {{x, y, z}} tVec - Topocentric vector (from observer to target)
 * @param {{up, east, north}} basis - ENU basis
 * @returns {{alt: number, az: number}} Altitude and azimuth in degrees
 */
export function altAz(tVec, basis) {
  const mag = Math.sqrt(tVec.x * tVec.x + tVec.y * tVec.y + tVec.z * tVec.z);
  if (mag < 1e-10) return { alt: 0, az: 0 };

  const dotUp = (tVec.x * basis.up.x + tVec.y * basis.up.y + tVec.z * basis.up.z) / mag;
  const alt = (Math.asin(Math.max(-1, Math.min(1, dotUp))) * 180) / Math.PI;

  const dotEast = (tVec.x * basis.east.x + tVec.y * basis.east.y + tVec.z * basis.east.z) / mag;
  const dotNorth = (tVec.x * basis.north.x + tVec.y * basis.north.y + tVec.z * basis.north.z) / mag;
  let az = (Math.atan2(dotEast, dotNorth) * 180) / Math.PI;
  if (az < 0) az += 360;

  return { alt, az };
}

export { MOON_RADIUS_KM, MOON_NORTH_POLE, KM_PER_AU };