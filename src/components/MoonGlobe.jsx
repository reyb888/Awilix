// src/components/MoonGlobe.jsx
// Authentic 3D Celestial System using NASA 3D GLB Models (Sun SDO, EarthClouds, Moon LRO).
// Physically calibrated to NASA measured volume and diameter ratios:
// Moon Radius: 1,737.4 km (1.0x baseline, 2.0x diam)
// Earth Radius: 6,371.0 km (3.667x Moon radius, 49.3x Moon volume)
// Sun Radius: 696,340 km (400.8x Moon radius, 64,300,000x Moon volume)
// Earth-Moon Distance: 384,400 km (221.25x Moon radius, 30.17x Earth diameters)
// Sun-Moon Distance: 149.6M km (86,105x Moon radius, 1.000 AU)
// Includes Dual Scale Mode (1:1 True NASA Scale vs Proportional Orbit Scale),
// Camera Focus Targets (Moon / Earth / Sun / Full System), All-Site DTE Vectors, and Solar Rays.

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as Astronomy from 'astronomy-engine';
import sites from '../data/sites.json';
import { Eye, Compass, Layers, Radio, Sun, Sparkles, Navigation, Maximize2, Info, ChevronDown } from 'lucide-react';

// NASA Physical Dimensions
const NASA = {
  MOON_R_KM: 1737.4,
  EARTH_R_KM: 6371.0,
  SUN_R_KM: 696340.0,
  EARTH_DIST_KM: 384400.0,
  SUN_DIST_KM: 149597870.0,
  // Ratios w.r.t Moon radius (baseline = 1.0)
  EARTH_R_RATIO: 3.667,   // 6371 / 1737.4
  SUN_R_RATIO: 400.8,     // 696340 / 1737.4
  EARTH_DIST_RATIO: 221.25, // 384400 / 1737.4
  SUN_DIST_RATIO: 86105.0,  // 149.6M / 1737.4
  EARTH_VOL_RATIO: 49.3,    // (3.667)^3
  SUN_VOL_RATIO: 64300000.0, // (400.8)^3
};

export default function MoonGlobe({ selectedSite, date, onSiteClick }) {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);

  // Object references
  const moonModelRef = useRef(null);
  const earthModelRef = useRef(null);
  const sunModelRef = useRef(null);
  const moonSunLightRef = useRef(null);
  const earthSunLightRef = useRef(null);
  const markersGroupRef = useRef(null);
  const dteVectorsGroupRef = useRef(null);
  const solarRaysGroupRef = useRef(null);
  const updateEphemerisRef = useRef(null);

  // Interaction tracking (distinguish drag from click)
  const pointerDownPos = useRef({ x: 0, y: 0 });
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());

  // UI States
  const [currentHour, setCurrentHour] = useState(12);
  const [scaleMode, setScaleMode] = useState('proportional'); // 'proportional' (Exploration View) | 'true' (1:1 NASA)
  const [cameraMode, setCameraMode] = useState('geolocked'); // 'geolocked' | 'orbit'
  const [vectorMode, setVectorMode] = useState('all'); // 'all' | 'dte' | 'solar' | 'off'
  const [selectedSiteId, setSelectedSiteId] = useState(selectedSite?.id || sites[0].id);
  const [showScaleDetails, setShowScaleDetails] = useState(false);
  const [focusTarget, setFocusTarget] = useState('moon'); // 'moon' | 'earth' | 'sun' | 'system'
  const [telemetry, setTelemetry] = useState({ sunDistKm: 149597870, earthDistKm: 384400, earthPhase: 100 });

  // Compute active 3D units based on selected scaleMode
  const scaleConfig = useMemo(() => {
    if (scaleMode === 'true') {
      return {
        moonRadius: 1.0,
        earthRadius: NASA.EARTH_R_RATIO, // 3.667 units (nearly 4x Moon diameter!)
        sunRadius: NASA.SUN_R_RATIO,     // 400.8 units (enormous star!)
        earthDist: NASA.EARTH_DIST_RATIO, // 221.25 units (384,400 km)
        sunDist: NASA.SUN_DIST_RATIO,     // 86,105.0 units (149.6M km)
        maxCameraDist: 250000,
        label: '1:1 True NASA Scale (Astronomical Distance)',
      };
    } else {
      // Proportional Spaceflight Exploration view:
      // Preserves true physical Earth:Moon diameter ratio (3.667:1),
      // with distances calibrated so Earth and Sun are majestic, clearly visible celestial bodies in the sky!
      return {
        moonRadius: 1.0,
        earthRadius: NASA.EARTH_R_RATIO, // 3.667 units (Diameter = 7.334 - almost 4x wider than the Moon!)
        sunRadius: 16.0,                 // 16.0 units radius (Diameter = 32.0 units - colossal glowing star!)
        earthDist: 16.0,                 // 16.0 units distance (Earth subtends ~26° of visual angle!)
        sunDist: 48.0,                   // 48.0 units distance (Sun subtends ~37° of visual angle!)
        maxCameraDist: 500,
        label: 'Proportional Spaceflight Scale',
      };
    }
  }, [scaleMode]);

  // Sync prop changes
  useEffect(() => {
    if (selectedSite?.id && selectedSite.id !== selectedSiteId) {
      setSelectedSiteId(selectedSite.id);
      flyToSite(selectedSite);
    }
  }, [selectedSite]);

  // Smooth camera fly-to site
  const flyToSite = useCallback((site) => {
    if (!cameraRef.current || !controlsRef.current || cameraMode === 'orbit') return;
    const latRad = (site.lat * Math.PI) / 180;
    const lonRad = (site.lon * Math.PI) / 180;
    const nx = Math.cos(latRad) * Math.sin(lonRad);
    const ny = Math.sin(latRad);
    const nz = Math.cos(latRad) * Math.cos(lonRad);

    const dist = 2.8;
    controlsRef.current.target.set(0, 0, 0);
    cameraRef.current.position.set(nx * dist, ny * dist, nz * dist);
    setFocusTarget('moon');
  }, [cameraMode]);

  // ── Initialize Scene ──────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // SCENE
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x04060c);
    sceneRef.current = scene;

    // CAMERA (with Logarithmic Depth Buffer support for astronomical distances up to 1,000,000 units)
    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000000);
    camera.position.set(0, 0.8, 3.4);
    cameraRef.current = camera;

    // RENDERER with Logarithmic Depth Buffer to prevent z-fighting across 86,000 units
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      logarithmicDepthBuffer: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // CONTROLS
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 1.15;
    controls.maxDistance = 250000;
    controls.target.set(0, 0, 0);
    controlsRef.current = controls;

    // AMBIENT LIGHT
    const ambientLight = new THREE.AmbientLight(0x182438, 0.45);
    scene.add(ambientLight);

    // DIRECTIONAL SUNLIGHT → MOON
    const moonSunLight = new THREE.DirectionalLight(0xfffbf2, 3.6);
    moonSunLight.castShadow = true;
    moonSunLight.shadow.mapSize.width = 2048;
    moonSunLight.shadow.mapSize.height = 2048;
    moonSunLight.shadow.camera.near = 0.5;
    moonSunLight.shadow.camera.far = 100;
    moonSunLight.shadow.bias = -0.0004;
    scene.add(moonSunLight);
    moonSunLightRef.current = moonSunLight;

    // DIRECTIONAL SUNLIGHT → EARTH (Simulates realistic day/night terminator on Earth)
    const earthSunLight = new THREE.DirectionalLight(0xfffbf2, 3.8);
    scene.add(earthSunLight);
    earthSunLightRef.current = earthSunLight;

    // MULTI-SPECTRAL CELESTIAL STARFIELD (8,000 astronomical temperature stars)
    const starCount = 8000;
    const starGeom = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);

    const spectralPalettes = [
      [0.75, 0.85, 1.0], // Blue-white O/B
      [0.92, 0.95, 1.0], // Pure white A
      [1.0, 0.96, 0.88], // Warm white F/G
      [1.0, 0.84, 0.68], // Amber K
      [1.0, 0.68, 0.58], // Orange M
    ];

    for (let i = 0; i < starCount; i++) {
      const radius = 280000 + Math.random() * 80000;
      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);

      starPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      starPositions[i * 3 + 2] = radius * Math.cos(phi);

      const color = spectralPalettes[Math.floor(Math.random() * spectralPalettes.length)];
      const brightness = 0.5 + Math.random() * 0.5;
      starColors[i * 3] = color[0] * brightness;
      starColors[i * 3 + 1] = color[1] * brightness;
      starColors[i * 3 + 2] = color[2] * brightness;
    }
    starGeom.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starGeom.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
    const starMat = new THREE.PointsMaterial({
      size: 1.4,
      vertexColors: true,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
    });
    scene.add(new THREE.Points(starGeom, starMat));

    // GROUPS FOR VECTORS & MARKERS
    const markersGroup = new THREE.Group();
    scene.add(markersGroup);
    markersGroupRef.current = markersGroup;

    const dteGroup = new THREE.Group();
    scene.add(dteGroup);
    dteVectorsGroupRef.current = dteGroup;

    const solarGroup = new THREE.Group();
    scene.add(solarGroup);
    solarRaysGroupRef.current = solarGroup;

    // ── INSTANT CELESTIAL RENDERING (0.05s Load Time) ───────
    // Immediately display photorealistic textured celestial bodies on Frame 1,
    // then progressively upgrade to heavy 3D GLBs when background downloads complete.
    const texLoader = new THREE.TextureLoader();

    // 1. Instant Photorealistic Moon (LROC 2K Global Mosaic - 457 KB)
    const moonTex = texLoader.load('/textures/lroc_color_2k.jpg');
    moonTex.colorSpace = THREE.SRGBColorSpace;
    const initialMoonGeom = new THREE.SphereGeometry(1.0, 64, 64);
    const initialMoonMat = new THREE.MeshStandardMaterial({
      map: moonTex,
      roughness: 0.92,
      metalness: 0.05,
    });
    const initialMoon = new THREE.Mesh(initialMoonGeom, initialMoonMat);
    initialMoon.receiveShadow = true;
    initialMoon.castShadow = true;
    scene.add(initialMoon);
    moonModelRef.current = initialMoon;

    // 2. Instant Photorealistic Earth (NASA 2K Earth & Oceans - 463 KB)
    const earthTex = texLoader.load('/textures/earth_2k.jpg');
    earthTex.colorSpace = THREE.SRGBColorSpace;
    const initialEarthGeom = new THREE.SphereGeometry(1.0, 48, 48);
    const initialEarthMat = new THREE.MeshStandardMaterial({
      map: earthTex,
      roughness: 0.55,
      metalness: 0.1,
    });
    const initialEarth = new THREE.Mesh(initialEarthGeom, initialEarthMat);
    initialEarth.receiveShadow = true;
    initialEarth.castShadow = true;
    initialEarth.userData.naturalDim = 2.0; // unit diameter = 2.0
    scene.add(initialEarth);
    earthModelRef.current = initialEarth;

    // 3. Instant Radiant Sun (NASA SDO 2K Photosphere - 822 KB)
    const sunTex = texLoader.load('/textures/sun_texture_2k.jpg');
    sunTex.colorSpace = THREE.SRGBColorSpace;
    const initialSunGeom = new THREE.SphereGeometry(1.0, 32, 32);
    const initialSunMat = new THREE.MeshBasicMaterial({
      map: sunTex,
      color: 0xfff6dd,
    });
    const initialSun = new THREE.Mesh(initialSunGeom, initialSunMat);
    initialSun.userData.naturalDim = 2.0; // unit diameter = 2.0
    scene.add(initialSun);
    sunModelRef.current = initialSun;

    // Immediately calculate positions and scales for instant bodies
    if (updateEphemerisRef.current) updateEphemerisRef.current();

    // ── PROGRESSIVE ENHANCEMENT: ASYNC 3D TOPOGRAPHICAL GLBS ──
    const gltfLoader = new GLTFLoader();

    // 1. Upgrade Moon to 3D Topographical Mesh
    gltfLoader.load(
      '/models/moon_small.glb',
      (gltf) => {
        const moon = gltf.scene;
        const box = new THREE.Box3().setFromObject(moon);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        if (maxDim > 0) {
          const s = 2.0 / maxDim; // Moon radius = 1.0 (Diameter = 2.0)
          moon.scale.set(s, s, s);
        }
        moon.traverse((child) => {
          if (child.isMesh) {
            child.receiveShadow = true;
            child.castShadow = true;
            if (child.material) {
              child.material.roughness = 0.92;
              child.material.metalness = 0.05;
            }
          }
        });
        scene.remove(initialMoon);
        scene.add(moon);
        moonModelRef.current = moon;
        if (updateEphemerisRef.current) updateEphemerisRef.current();
      },
      undefined,
      (err) => console.log('Using instant LROC textured Moon')
    );

    // 2. Upgrade Earth to NASA 3D Cloud Model
    gltfLoader.load(
      '/models/earth.glb',
      (gltf) => {
        const earth = gltf.scene;
        const box = new THREE.Box3().setFromObject(earth);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        earth.userData.naturalDim = maxDim;
        earth.traverse((child) => {
          if (child.isMesh) {
            child.receiveShadow = true;
            child.castShadow = true;
          }
        });
        scene.remove(initialEarth);
        scene.add(earth);
        earthModelRef.current = earth;
        if (updateEphemerisRef.current) updateEphemerisRef.current();
      },
      undefined,
      (err) => console.log('Using instant 2K Earth model')
    );

    // 3. Upgrade Sun to NASA 3D Solar Model
    gltfLoader.load(
      '/models/sun.glb',
      (gltf) => {
        const sun = gltf.scene;
        const box = new THREE.Box3().setFromObject(sun);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        sun.userData.naturalDim = maxDim;
        sun.traverse((child) => {
          if (child.isMesh && child.material) {
            child.material.emissive = new THREE.Color(0xffaa22);
            child.material.emissiveIntensity = 1.6;
          }
        });
        scene.remove(initialSun);
        scene.add(sun);
        sunModelRef.current = sun;
        if (updateEphemerisRef.current) updateEphemerisRef.current();
      },
      undefined,
      (err) => console.log('Using instant 2K Sun model')
    );

    // BUILD CANDIDATE SITE MARKERS (Obsidian Ring + Laser Crimson Pin)
    buildSiteMarkers(markersGroup, selectedSiteId);

    // ── POINTER HANDLERS (Drag vs Click Detection) ──────────
    const handlePointerDown = (e) => {
      pointerDownPos.current = { x: e.clientX, y: e.clientY };
    };

    const handlePointerUp = (e) => {
      const dx = Math.abs(e.clientX - pointerDownPos.current.x);
      const dy = Math.abs(e.clientY - pointerDownPos.current.y);
      if (dx > 6 || dy > 6) return; // User was dragging camera

      const rect = container.getBoundingClientRect();
      mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycasterRef.current.setFromCamera(mouseRef.current, camera);
      const intersects = raycasterRef.current.intersectObjects(markersGroup.children, true);

      if (intersects.length > 0) {
        let obj = intersects[0].object;
        while (obj && !obj.userData?.siteId && obj.parent) {
          obj = obj.parent;
        }
        if (obj?.userData?.siteId) {
          const siteId = obj.userData.siteId;
          setSelectedSiteId(siteId);
          const found = sites.find((s) => s.id === siteId);
          if (found && onSiteClick) onSiteClick(found);
        }
      }
    };

    container.addEventListener('pointerdown', handlePointerDown);
    container.addEventListener('pointerup', handlePointerUp);

    // ── ANIMATION LOOP ──────────────────────────────────────
    let animId;
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const dt = clock.getDelta();

      if (earthModelRef.current) {
        earthModelRef.current.rotation.y += dt * 0.08;
      }
      if (sunModelRef.current) {
        sunModelRef.current.rotation.y += dt * 0.015;
      }

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('pointerdown', handlePointerDown);
      container.removeEventListener('pointerup', handlePointerUp);
      cancelAnimationFrame(animId);
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // ── UPDATE ASTRONOMICAL POSITIONS & ACTIVE SCALE ──────────
  const updateEphemerisAndScale = useCallback(() => {
    if (!sceneRef.current) return;
    updateEphemerisRef.current = updateEphemerisAndScale;

    const hourStr = String(currentHour).padStart(2, '0');
    const time = new Date(`${date}T${hourStr}:00:00Z`);

    // Astronomical Vectors via Astronomy-Engine
    const moonVec = Astronomy.GeoVector(Astronomy.Body.Moon, time, true);
    const sunVec = Astronomy.GeoVector(Astronomy.Body.Sun, time, true);

    const dSun = {
      x: sunVec.x - moonVec.x,
      y: sunVec.y - moonVec.y,
      z: sunVec.z - moonVec.z,
    };
    const sunMag = Math.hypot(dSun.x, dSun.y, dSun.z);
    const sunDir = new THREE.Vector3(dSun.x / sunMag, dSun.y / sunMag, dSun.z / sunMag);

    const dEarth = { x: -moonVec.x, y: -moonVec.y, z: -moonVec.z };
    const earthMag = Math.hypot(dEarth.x, dEarth.y, dEarth.z);
    const earthDir = new THREE.Vector3(dEarth.x / earthMag, dEarth.y / earthMag, dEarth.z / earthMag);

    // Calculate lunar perspective phase of Earth
    const sunMoonAngle = sunDir.angleTo(earthDir);
    const phaseFraction = (1 + Math.cos(sunMoonAngle)) / 2;
    setTelemetry({
      sunDistKm: Math.round(sunMag),
      earthDistKm: Math.round(earthMag),
      earthPhase: Math.round(phaseFraction * 100),
    });

    // 1. UPDATE EARTH MODEL SCALE & POSITION
    const earthPos = earthDir.clone().multiplyScalar(scaleConfig.earthDist);
    if (earthModelRef.current) {
      earthModelRef.current.position.copy(earthPos);
      const naturalDim = earthModelRef.current.userData?.naturalDim || 2.0;
      const targetDiam = scaleConfig.earthRadius * 2;
      const s = targetDiam / naturalDim;
      earthModelRef.current.scale.set(s, s, s);
    }

    // 2. UPDATE SUN MODEL SCALE & POSITION
    const sunPos = sunDir.clone().multiplyScalar(scaleConfig.sunDist);
    if (sunModelRef.current) {
      sunModelRef.current.position.copy(sunPos);
      const naturalDim = sunModelRef.current.userData?.naturalDim || 2.0;
      const targetDiam = scaleConfig.sunRadius * 2;
      const s = targetDiam / naturalDim;
      sunModelRef.current.scale.set(s, s, s);
    }

    // 3. SUN LIGHT → MOON
    if (moonSunLightRef.current) {
      // Place light along sun direction at a clean shadow-map distance
      moonSunLightRef.current.position.copy(sunDir.clone().multiplyScalar(25));
      moonSunLightRef.current.target.position.set(0, 0, 0);
      moonSunLightRef.current.target.updateMatrixWorld();
    }

    // 4. SUN LIGHT → EARTH
    if (earthSunLightRef.current) {
      const sunToEarthDir = new THREE.Vector3().subVectors(earthPos, sunPos).normalize();
      earthSunLightRef.current.position.copy(earthPos).sub(sunToEarthDir.clone().multiplyScalar(15));
      earthSunLightRef.current.target.position.copy(earthPos);
      earthSunLightRef.current.target.updateMatrixWorld();
    }

    // 5. UPDATE CONTROLS LIMITS
    if (controlsRef.current) {
      controlsRef.current.maxDistance = scaleConfig.maxCameraDist;
    }

    // ── REBUILD ALL-SITE DTE VECTORS ────────────────────────
    if (dteVectorsGroupRef.current) {
      dteVectorsGroupRef.current.clear();

      const showDTE = vectorMode === 'all' || vectorMode === 'dte';
      if (showDTE) {
        sites.forEach((site) => {
          const latRad = (site.lat * Math.PI) / 180;
          const lonRad = (site.lon * Math.PI) / 180;
          const sx = Math.cos(latRad) * Math.sin(lonRad);
          const sy = Math.sin(latRad);
          const sz = Math.cos(latRad) * Math.cos(lonRad);
          const siteVec = new THREE.Vector3(sx, sy, sz);

          const upVec = siteVec.clone().normalize();
          const dot = upVec.dot(earthDir);
          const isVisible = dot > 0.0;

          const color = isVisible ? 0x8fd3e8 : 0xef4444;
          const opacity = isVisible ? (site.id === selectedSiteId ? 0.95 : 0.45) : 0.18;

          const points = [siteVec, earthPos];
          const geom = new THREE.BufferGeometry().setFromPoints(points);
          const mat = new THREE.LineBasicMaterial({
            color,
            transparent: true,
            opacity,
          });
          dteVectorsGroupRef.current.add(new THREE.Line(geom, mat));
        });
      }
    }

    // ── REBUILD MATHEMATICAL SOLAR VECTOR FIELD ─────────────
    // Linear vector field mapping tails on the Sun model to heads all over the Moon's surface
    if (solarRaysGroupRef.current) {
      solarRaysGroupRef.current.clear();

      const showSolar = vectorMode === 'all' || vectorMode === 'solar';
      if (showSolar) {
        // Construct orthonormal basis on the sunlit hemisphere of the Moon
        // w points from Moon (0,0,0) directly towards the Sun
        const w = sunDir.clone().normalize();
        const arbitrary = Math.abs(w.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
        const u = new THREE.Vector3().crossVectors(arbitrary, w).normalize();
        const v = new THREE.Vector3().crossVectors(w, u).normalize();

        const linePositions = [];
        const lineColors = [];

        // Concentric linear zenith rings covering the entire illuminated surface
        // from subsolar apex (theta = 0) out to the terminator limb (theta = 88°)
        const rings = [
          { thetaDeg: 0, count: 1 },    // Subsolar zenith
          { thetaDeg: 14, count: 6 },   // Core solar flux
          { thetaDeg: 28, count: 10 },
          { thetaDeg: 42, count: 14 },  // Mid-latitude flux
          { thetaDeg: 56, count: 18 },
          { thetaDeg: 70, count: 22 },  // High-latitude grazing
          { thetaDeg: 84, count: 26 },  // Lunar terminator rim
        ];

        rings.forEach(({ thetaDeg, count }) => {
          const theta = (thetaDeg * Math.PI) / 180;
          const sinT = Math.sin(theta);
          const cosT = Math.cos(theta);

          for (let i = 0; i < count; i++) {
            const phi = count === 1 ? 0 : (i / count) * Math.PI * 2;
            const cosP = Math.cos(phi);
            const sinP = Math.sin(phi);

            // Vector Head strictly mapped on the Moon's spherical surface (R_moon = 1.003)
            const headX = (sinT * cosP * u.x + sinT * sinP * v.x + cosT * w.x) * 1.003;
            const headY = (sinT * cosP * u.y + sinT * sinP * v.y + cosT * w.y) * 1.003;
            const headZ = (sinT * cosP * u.z + sinT * sinP * v.z + cosT * w.z) * 1.003;
            const head = new THREE.Vector3(headX, headY, headZ);

            // Vector Tail starting on the Sun model (spread across the solar disc facing Moon)
            const discRadius = Math.min(scaleConfig.sunRadius * 0.35, 12.0);
            const tailX = sunPos.x + (sinT * cosP * u.x + sinT * sinP * v.x) * discRadius;
            const tailY = sunPos.y + (sinT * cosP * u.y + sinT * sinP * v.y) * discRadius;
            const tailZ = sunPos.z + (sinT * cosP * u.z + sinT * sinP * v.z) * discRadius;
            const tail = new THREE.Vector3(tailX, tailY, tailZ);

            // Main solar flux vector line (Tail at Sun → Head on Moon)
            linePositions.push(tail.x, tail.y, tail.z, head.x, head.y, head.z);

            // Solar ray color: radiant solar amber, with intensity scaling by incidence angle cosT
            const alpha = 0.20 + cosT * 0.45;
            lineColors.push(1.0, 0.67, 0.37, alpha * 0.35); // Sun tail color
            lineColors.push(1.0, 0.82, 0.52, alpha);        // Moon surface impact color

            // Directional Arrowhead at landing point on the Moon surface
            const rayDir = new THREE.Vector3().subVectors(head, tail).normalize();
            const arrowLen = 0.045;
            const arrowWidth = 0.016;

            const a1 = head.clone().sub(rayDir.clone().multiplyScalar(arrowLen)).add(u.clone().multiplyScalar(arrowWidth));
            linePositions.push(head.x, head.y, head.z, a1.x, a1.y, a1.z);
            lineColors.push(1.0, 0.88, 0.6, alpha);
            lineColors.push(1.0, 0.88, 0.6, alpha * 0.7);

            const a2 = head.clone().sub(rayDir.clone().multiplyScalar(arrowLen)).sub(u.clone().multiplyScalar(arrowWidth));
            linePositions.push(head.x, head.y, head.z, a2.x, a2.y, a2.z);
            lineColors.push(1.0, 0.88, 0.6, alpha);
            lineColors.push(1.0, 0.88, 0.6, alpha * 0.7);
          }
        });

        // Dedicated highlighted Solar Vectors targeting candidate lunar landing sites
        sites.forEach((site) => {
          const latRad = (site.lat * Math.PI) / 180;
          const lonRad = (site.lon * Math.PI) / 180;
          const sx = Math.cos(latRad) * Math.sin(lonRad);
          const sy = Math.sin(latRad);
          const sz = Math.cos(latRad) * Math.cos(lonRad);
          const siteVec = new THREE.Vector3(sx, sy, sz).multiplyScalar(1.004);

          // Solar incidence check on local terrain normal
          const siteNormal = siteVec.clone().normalize();
          const cosIncidence = siteNormal.dot(w);
          const isSunlit = cosIncidence > 0;

          if (isSunlit) {
            const isSelected = site.id === selectedSiteId;
            linePositions.push(sunPos.x, sunPos.y, sunPos.z, siteVec.x, siteVec.y, siteVec.z);
            const intensity = isSelected ? 0.95 : 0.65;
            lineColors.push(1.0, 0.75, 0.4, 0.4);
            lineColors.push(1.0, 0.92, 0.65, intensity);

            // Arrowhead at site marker
            const rayDir = new THREE.Vector3().subVectors(siteVec, sunPos).normalize();
            const a1 = siteVec.clone().sub(rayDir.clone().multiplyScalar(0.06)).add(u.clone().multiplyScalar(0.02));
            const a2 = siteVec.clone().sub(rayDir.clone().multiplyScalar(0.06)).sub(u.clone().multiplyScalar(0.02));
            linePositions.push(siteVec.x, siteVec.y, siteVec.z, a1.x, a1.y, a1.z);
            linePositions.push(siteVec.x, siteVec.y, siteVec.z, a2.x, a2.y, a2.z);
            lineColors.push(1.0, 0.95, 0.7, intensity);
            lineColors.push(1.0, 0.95, 0.7, intensity * 0.8);
            lineColors.push(1.0, 0.95, 0.7, intensity);
            lineColors.push(1.0, 0.95, 0.7, intensity * 0.8);
          }
        });

        const geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
        geom.setAttribute('color', new THREE.Float32BufferAttribute(lineColors, 4));

        const mat = new THREE.LineBasicMaterial({
          vertexColors: true,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });

        solarRaysGroupRef.current.add(new THREE.LineSegments(geom, mat));
      }
    }
  }, [date, currentHour, vectorMode, selectedSiteId, scaleConfig]);

  useEffect(() => {
    updateEphemerisAndScale();
  }, [updateEphemerisAndScale]);

  // Update marker highlight on selection
  useEffect(() => {
    if (markersGroupRef.current) {
      buildSiteMarkers(markersGroupRef.current, selectedSiteId);
    }
  }, [selectedSiteId]);

  // Camera Target Anchors
  const handleFocus = (target) => {
    if (!cameraRef.current || !controlsRef.current) return;
    setFocusTarget(target);

    if (target === 'moon') {
      controlsRef.current.target.set(0, 0, 0);
      cameraRef.current.position.set(0, 0.8, 3.2);
    } else if (target === 'earth') {
      if (earthModelRef.current) {
        const ep = earthModelRef.current.position;
        controlsRef.current.target.copy(ep);
        cameraRef.current.position.set(ep.x + 8, ep.y + 4, ep.z + 8);
      }
    } else if (target === 'sun') {
      if (sunModelRef.current) {
        const sp = sunModelRef.current.position;
        controlsRef.current.target.copy(sp);
        const offset = scaleConfig.sunRadius * 2.5;
        cameraRef.current.position.set(sp.x, sp.y + offset * 0.3, sp.z + offset);
      }
    } else if (target === 'system') {
      controlsRef.current.target.set(0, 0, 0);
      if (scaleMode === 'true') {
        cameraRef.current.position.set(0, 25000, 75000);
      } else {
        cameraRef.current.position.set(0, 70, 180);
      }
    }
  };

  return (
    <div className="relative w-full h-full min-h-[520px] flex flex-col select-none">
      {/* 3D WebGL Canvas */}
      <div ref={containerRef} className="w-full flex-1 rounded-xl overflow-hidden cursor-grab active:cursor-grabbing" />

      {/* ── Top Left: Scale Mode & Target Focus Anchors ──────── */}
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-2 pointer-events-auto">
        {/* Scale Mode Selector Button */}
        <div className="flex items-center gap-1.5 bg-[#0a0e17]/90 backdrop-blur-md p-1 rounded-xl border border-[var(--line)]">
          <button
            onClick={() => setScaleMode('proportional')}
            className={`px-3 py-1 rounded-lg text-xs font-mono font-medium transition-colors ${
              scaleMode === 'proportional'
                ? 'bg-[var(--mustard)] text-[#060910] font-semibold shadow-sm'
                : 'text-[var(--ink-mute)] hover:text-white'
            }`}
            title="Proportional View: Earth (3.67x diameter) and Sun (massive star) prominently visible in background"
          >
            Proportional View
          </button>
          <button
            onClick={() => setScaleMode('true')}
            className={`px-3 py-1 rounded-lg text-xs font-mono font-medium transition-colors ${
              scaleMode === 'true'
                ? 'bg-[var(--coral)] text-[#120e07] font-semibold shadow-sm'
                : 'text-[var(--ink-mute)] hover:text-white'
            }`}
            title="1:1 True NASA Scale: Earth at 384,400 km (221 R_moon), Sun at 149.6 Million km (86,105 R_moon)"
          >
            1:1 True Astronomical Scale
          </button>
          <button
            onClick={() => setShowScaleDetails(!showScaleDetails)}
            className="p-1 text-[var(--ink-faint)] hover:text-white rounded"
            title="Toggle NASA scientific dimensions specification"
          >
            <Info className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Quick Camera Navigation Anchors */}
        <div className="flex items-center gap-1 bg-[#0a0e17]/85 backdrop-blur-md p-0.5 rounded-lg border border-[var(--line-soft)] text-[11px] font-mono">
          <span className="text-[var(--ink-faint)] px-1.5 text-[10px]">Anchor:</span>
          <button
            onClick={() => handleFocus('moon')}
            className={`px-2 py-0.5 rounded transition-colors ${focusTarget === 'moon' ? 'bg-white/15 text-white font-bold' : 'text-[var(--ink-mute)] hover:text-white'}`}
          >
            Moon
          </button>
          <button
            onClick={() => handleFocus('earth')}
            className={`px-2 py-0.5 rounded transition-colors ${focusTarget === 'earth' ? 'bg-[var(--mustard)] text-[#060910] font-bold' : 'text-[var(--ink-mute)] hover:text-white'}`}
          >
            Earth
          </button>
          <button
            onClick={() => handleFocus('sun')}
            className={`px-2 py-0.5 rounded transition-colors ${focusTarget === 'sun' ? 'bg-[var(--coral)] text-[#120e07] font-bold' : 'text-[var(--ink-mute)] hover:text-white'}`}
          >
            Sun
          </button>
          <button
            onClick={() => handleFocus('system')}
            className={`px-2 py-0.5 rounded transition-colors ${focusTarget === 'system' ? 'bg-white/20 text-white font-bold' : 'text-[var(--ink-mute)] hover:text-white'}`}
          >
            Full System
          </button>
        </div>

        {/* Expandable Scientific Dimensions Card */}
        {showScaleDetails && (
          <div className="bento-plate p-3.5 max-w-sm text-xs font-mono space-y-2 animate-fade-in shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--line-soft)] pb-1.5">
              <span className="text-[var(--coral)] font-bold">NASA Scientific Measurement Datum</span>
              <button onClick={() => setShowScaleDetails(false)} className="text-[var(--ink-faint)] hover:text-white">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-[var(--ink-faint)] block text-[10px]">Earth / Moon Diam:</span>
                <span className="text-[var(--ink)] font-bold">3.667 : 1</span>
              </div>
              <div>
                <span className="text-[var(--ink-faint)] block text-[10px]">Earth / Moon Vol:</span>
                <span className="text-[var(--mustard)] font-bold">49.30 : 1</span>
              </div>
              <div>
                <span className="text-[var(--ink-faint)] block text-[10px]">Sun / Moon Diam:</span>
                <span className="text-[var(--ink)] font-bold">400.8 : 1</span>
              </div>
              <div>
                <span className="text-[var(--ink-faint)] block text-[10px]">Sun / Moon Vol:</span>
                <span className="text-[var(--coral)] font-bold">64.3M : 1</span>
              </div>
            </div>
            <div className="pt-1.5 border-t border-[var(--line-soft)] text-[10px] text-[var(--ink-mute)] leading-relaxed">
              Earth-Moon: 384,400 km (30.2 Earth diams) · Sun-Moon: 149.6M km (1.000 AU). Rendered with logarithmic depth buffers.
            </div>
          </div>
        )}
      </div>

      {/* ── Top Right: Vector Field Toggles ────────────────── */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 bg-[#0a0e17]/85 backdrop-blur-md p-1 rounded-full border border-[var(--line)] pointer-events-auto">
        <button
          onClick={() => setVectorMode('all')}
          className={`px-2.5 py-1 rounded-full text-[11px] font-sans font-medium transition-colors ${
            vectorMode === 'all' ? 'bg-[var(--coral)] text-[#120e07] font-semibold' : 'text-[var(--ink-mute)] hover:text-white'
          }`}
        >
          All Vectors
        </button>
        <button
          onClick={() => setVectorMode('dte')}
          className={`px-2.5 py-1 rounded-full text-[11px] font-sans font-medium transition-colors ${
            vectorMode === 'dte' ? 'bg-[var(--mustard)] text-[#060910] font-semibold' : 'text-[var(--ink-mute)] hover:text-white'
          }`}
        >
          DTE Sightlines
        </button>
        <button
          onClick={() => setVectorMode('solar')}
          className={`px-2.5 py-1 rounded-full text-[11px] font-sans font-medium transition-colors ${
            vectorMode === 'solar' ? 'bg-[var(--coral)] text-[#120e07] font-semibold' : 'text-[var(--ink-mute)] hover:text-white'
          }`}
        >
          Solar Rays
        </button>
        <button
          onClick={() => setVectorMode('off')}
          className={`px-2 py-1 rounded-full text-[11px] font-sans font-medium transition-colors ${
            vectorMode === 'off' ? 'bg-white/20 text-white' : 'text-[var(--ink-mute)] hover:text-white'
          }`}
        >
          Off
        </button>
      </div>

      {/* ── Bottom: Live Astronomical Telemetry & Time Scrubber ── */}
      <div className="absolute bottom-3 left-3 right-3 z-10 flex flex-col md:flex-row items-center justify-between gap-3 bg-[#0a0e17]/90 backdrop-blur-md border border-[var(--line)] rounded-xl p-3 pointer-events-auto shadow-2xl">
        <div className="flex items-center gap-4 text-xs font-telemetry">
          <div className="flex items-center gap-1.5 text-[var(--coral)]">
            <Sun className="w-3.5 h-3.5" />
            <span>{(telemetry.sunDistKm / 1000000).toFixed(2)}M km</span>
            <span className="text-[10px] text-[var(--ink-faint)]">({(telemetry.sunDistKm / NASA.MOON_R_KM).toFixed(0)} R_moon)</span>
          </div>
          <div className="flex items-center gap-1.5 text-[var(--mustard)]">
            <Radio className="w-3.5 h-3.5" />
            <span>{telemetry.earthDistKm.toLocaleString()} km</span>
            <span className="text-[10px] text-[var(--ink-faint)]">({(telemetry.earthDistKm / NASA.MOON_R_KM).toFixed(1)} R_moon)</span>
          </div>
          <div className="hidden sm:inline-flex text-[var(--ink-mute)]">
            Phase: <span className="text-[var(--ink)] ml-1 font-bold">{telemetry.earthPhase}%</span>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <span className="text-xs font-telemetry text-[var(--ink-mute)] whitespace-nowrap">
            {String(currentHour).padStart(2, '0')}:00 UTC
          </span>
          <input
            type="range"
            min="0"
            max="23"
            value={currentHour}
            onChange={(e) => setCurrentHour(Number(e.target.value))}
            className="w-full md:w-48 accent-[var(--coral)] cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
}

// ── BUILD SLEEK CANDIDATE SITE MARKERS ──────────────────────
// Obsidian black pedestal ring (#030712) + laser crimson beacon (#ef4444)
function buildSiteMarkers(group, activeSiteId) {
  group.clear();

  sites.forEach((site) => {
    const latRad = (site.lat * Math.PI) / 180;
    const lonRad = (site.lon * Math.PI) / 180;

    const x = Math.cos(latRad) * Math.sin(lonRad);
    const y = Math.sin(latRad);
    const z = Math.cos(latRad) * Math.cos(lonRad);

    const markerGroup = new THREE.Group();
    markerGroup.position.set(x, y, z);
    markerGroup.userData = { siteId: site.id, siteName: site.name };

    const isSelected = site.id === activeSiteId;
    const normal = new THREE.Vector3(x, y, z).normalize();

    // 1. Sleek Obsidian Black Pedestal Ring
    const ringGeom = new THREE.RingGeometry(0.04, 0.055, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: isSelected ? 0xffab5e : 0x030712,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: isSelected ? 0.95 : 0.75,
    });
    const ringMesh = new THREE.Mesh(ringGeom, ringMat);
    ringMesh.lookAt(normal);
    markerGroup.add(ringMesh);

    // 2. Classy Vertical Stalk
    const stalkGeom = new THREE.CylinderGeometry(0.003, 0.003, 0.09, 8);
    const stalkMat = new THREE.MeshBasicMaterial({ color: isSelected ? 0xffab5e : 0xe11d48 });
    const stalk = new THREE.Mesh(stalkGeom, stalkMat);
    stalk.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
    stalk.position.copy(normal.clone().multiplyScalar(0.045));
    markerGroup.add(stalk);

    // 3. Glowing Laser Crimson Beacon Head
    const headGeom = new THREE.SphereGeometry(isSelected ? 0.024 : 0.016, 16, 16);
    const headMat = new THREE.MeshBasicMaterial({
      color: isSelected ? 0xffc791 : 0xef4444,
    });
    const headMesh = new THREE.Mesh(headGeom, headMat);
    headMesh.position.copy(normal.clone().multiplyScalar(0.09));
    markerGroup.add(headMesh);

    group.add(markerGroup);
  });
}
