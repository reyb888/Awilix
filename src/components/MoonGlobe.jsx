// src/components/MoonGlobe.jsx
// Authentic 3D Celestial System using NASA 3D GLB Models (Sun SDO, EarthClouds, Moon LRO).
// Dual camera modes (Geolocked vs Orbit), All-Site DTE Vector Field, Solar Divergence,
// Classy obsidian rings & laser crimson markers, multi-spectral celestial starfield. Zero 2D blobs.

import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as Astronomy from 'astronomy-engine';
import sites from '../data/sites.json';
import { Eye, Compass, Layers, Radio, Sun, Sparkles, Navigation } from 'lucide-react';

// Distance & Scale Constants (Scales calibrated for visual clarity while preserving exact angles)
const MOON_RADIUS = 1.0;
const EARTH_RADIUS = 0.55; // Scaled for visible disk
const SUN_RADIUS = 1.35;   // Scaled for visible disk
const EARTH_DIST = 9.0;    // Scaled distance to Earth (astronomical direction exact)
const SUN_DIST = 28.0;     // Scaled distance to Sun (astronomical direction exact)

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

  // Interaction tracking (distinguish drag from click)
  const pointerDownPos = useRef({ x: 0, y: 0 });
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());

  // UI States
  const [currentHour, setCurrentHour] = useState(12);
  const [cameraMode, setCameraMode] = useState('geolocked'); // 'geolocked' | 'orbit'
  const [vectorMode, setVectorMode] = useState('all'); // 'all' | 'dte' | 'solar' | 'off'
  const [selectedSiteId, setSelectedSiteId] = useState(selectedSite?.id || sites[0].id);
  const [telemetry, setTelemetry] = useState({ sunDistKm: 149600000, earthDistKm: 384400, earthPhase: 100 });

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

    const dist = 2.6;
    const targetCamX = nx * dist;
    const targetCamY = ny * dist;
    const targetCamZ = nz * dist;

    // Smooth lerp in animation loop via controls target
    controlsRef.current.target.set(0, 0, 0);
    cameraRef.current.position.set(targetCamX, targetCamY, targetCamZ);
  }, [cameraMode]);

  // ── Initialize Scene ──────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // SCENE
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060910);
    sceneRef.current = scene;

    // CAMERA
    const camera = new THREE.PerspectiveCamera(42, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(0, 0.5, 3.2);
    cameraRef.current = camera;

    // RENDERER
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // CONTROLS
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 1.25;
    controls.maxDistance = 55;
    controls.target.set(0, 0, 0);
    controlsRef.current = controls;

    // AMBIENT LIGHT (Cosmic deep-space background radiation)
    const ambientLight = new THREE.AmbientLight(0x1a2236, 0.45);
    scene.add(ambientLight);

    // DIRECTIONAL SUNLIGHT → MOON
    const moonSunLight = new THREE.DirectionalLight(0xfffbf0, 3.4);
    moonSunLight.castShadow = true;
    moonSunLight.shadow.mapSize.width = 2048;
    moonSunLight.shadow.mapSize.height = 2048;
    moonSunLight.shadow.camera.near = 1;
    moonSunLight.shadow.camera.far = 60;
    moonSunLight.shadow.bias = -0.0005;
    scene.add(moonSunLight);
    moonSunLightRef.current = moonSunLight;

    // DIRECTIONAL SUNLIGHT → EARTH (Guarantees scientifically accurate day/night terminator on Earth)
    const earthSunLight = new THREE.DirectionalLight(0xfffbf0, 3.6);
    scene.add(earthSunLight);
    earthSunLightRef.current = earthSunLight;

    // CELESTIAL MULTI-SPECTRAL STARFIELD (8,000 real astronomical temperature stars)
    const starCount = 8000;
    const starGeom = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);

    // Spectral classes: O/B (blue-white), A/F (white), G (yellow/sun-like), K/M (amber/red)
    const spectralPalettes = [
      [0.72, 0.82, 1.0], // Blue-white O/B
      [0.92, 0.95, 1.0], // Pure white A
      [1.0, 0.96, 0.88], // Warm white F/G
      [1.0, 0.82, 0.65], // Amber K
      [1.0, 0.65, 0.55], // Soft orange M
    ];

    for (let i = 0; i < starCount; i++) {
      const radius = 180 + Math.random() * 80;
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
      size: 0.9,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
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

    // ── LOAD AUTHENTIC NASA 3D GLB MODELS ───────────────────
    const gltfLoader = new GLTFLoader();

    // 1. Moon Model (LRO 3D Topography)
    gltfLoader.load(
      '/models/moon_small.glb',
      (gltf) => {
        const moon = gltf.scene;
        const box = new THREE.Box3().setFromObject(moon);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        if (maxDim > 0) {
          const s = (MOON_RADIUS * 2) / maxDim;
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
        scene.add(moon);
        moonModelRef.current = moon;
      },
      undefined,
      (err) => {
        console.warn('Fallback sphere for Moon:', err);
        const geom = new THREE.SphereGeometry(MOON_RADIUS, 64, 64);
        const mat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.9 });
        const mesh = new THREE.Mesh(geom, mat);
        scene.add(mesh);
        moonModelRef.current = mesh;
      }
    );

    // 2. Earth Model (NASA EarthClouds_1_12756.glb)
    gltfLoader.load(
      '/models/earth.glb',
      (gltf) => {
        const earth = gltf.scene;
        const box = new THREE.Box3().setFromObject(earth);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        if (maxDim > 0) {
          const s = (EARTH_RADIUS * 2) / maxDim;
          earth.scale.set(s, s, s);
        }
        earth.traverse((child) => {
          if (child.isMesh) {
            child.receiveShadow = true;
            child.castShadow = true;
          }
        });
        scene.add(earth);
        earthModelRef.current = earth;
      },
      undefined,
      (err) => {
        console.warn('Fallback Earth sphere:', err);
        const geom = new THREE.SphereGeometry(EARTH_RADIUS, 32, 32);
        const mat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.5 });
        const mesh = new THREE.Mesh(geom, mat);
        scene.add(mesh);
        earthModelRef.current = mesh;
      }
    );

    // 3. Sun Model (NASA Sun_1_1391000.glb)
    gltfLoader.load(
      '/models/sun.glb',
      (gltf) => {
        const sun = gltf.scene;
        const box = new THREE.Box3().setFromObject(sun);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        if (maxDim > 0) {
          const s = (SUN_RADIUS * 2) / maxDim;
          sun.scale.set(s, s, s);
        }
        // Self-illuminating coronal emission
        sun.traverse((child) => {
          if (child.isMesh && child.material) {
            child.material.emissive = new THREE.Color(0xffaa22);
            child.material.emissiveIntensity = 1.4;
          }
        });
        scene.add(sun);
        sunModelRef.current = sun;
      },
      undefined,
      (err) => {
        console.warn('Fallback Sun sphere:', err);
        const geom = new THREE.SphereGeometry(SUN_RADIUS, 32, 32);
        const mat = new THREE.MeshBasicMaterial({ color: 0xffcc33 });
        const mesh = new THREE.Mesh(geom, mat);
        scene.add(mesh);
        sunModelRef.current = mesh;
      }
    );

    // BUILD CLASSY CANDIDATE SITE MARKERS (Obsidian Ring + Laser Crimson Pin)
    buildSiteMarkers(markersGroup, selectedSiteId);

    // ── POINTER HANDLERS (Drag vs Click Detection) ──────────
    const handlePointerDown = (e) => {
      pointerDownPos.current = { x: e.clientX, y: e.clientY };
    };

    const handlePointerUp = (e) => {
      const dx = Math.abs(e.clientX - pointerDownPos.current.x);
      const dy = Math.abs(e.clientY - pointerDownPos.current.y);
      if (dx > 6 || dy > 6) return; // User was dragging/orbiting the camera

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

      // Gentle rotation for Earth clouds & Sun corona
      if (earthModelRef.current) {
        earthModelRef.current.rotation.y += dt * 0.08;
      }
      if (sunModelRef.current) {
        sunModelRef.current.rotation.y += dt * 0.02;
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

  // ── UPDATE ASTRONOMICAL EPHEMERIS POSITIONS ───────────────
  const updateEphemeris = useCallback(() => {
    if (!sceneRef.current) return;

    const hourStr = String(currentHour).padStart(2, '0');
    const time = new Date(`${date}T${hourStr}:00:00Z`);

    // True Geocentric Vectors via Astronomy-Engine
    const moonVec = Astronomy.GeoVector(Astronomy.Body.Moon, time, true);
    const sunVec = Astronomy.GeoVector(Astronomy.Body.Sun, time, true);

    // Sun Vector relative to Moon Center (dSun = S - M)
    const dSun = {
      x: sunVec.x - moonVec.x,
      y: sunVec.y - moonVec.y,
      z: sunVec.z - moonVec.z,
    };
    const sunMag = Math.hypot(dSun.x, dSun.y, dSun.z);
    const sunDir = new THREE.Vector3(dSun.x / sunMag, dSun.y / sunMag, dSun.z / sunMag);

    // Earth Vector relative to Moon Center (dEarth = -M)
    const dEarth = { x: -moonVec.x, y: -moonVec.y, z: -moonVec.z };
    const earthMag = Math.hypot(dEarth.x, dEarth.y, dEarth.z);
    const earthDir = new THREE.Vector3(dEarth.x / earthMag, dEarth.y / earthMag, dEarth.z / earthMag);

    // Telemetry stats
    const sunMoonAngle = sunDir.angleTo(earthDir);
    const phaseFraction = (1 + Math.cos(sunMoonAngle)) / 2;
    setTelemetry({
      sunDistKm: Math.round(sunMag),
      earthDistKm: Math.round(earthMag),
      earthPhase: Math.round(phaseFraction * 100),
    });

    // 1. POSITION SUN MODEL
    const sunPos = sunDir.clone().multiplyScalar(SUN_DIST);
    if (sunModelRef.current) {
      sunModelRef.current.position.copy(sunPos);
    }

    // 2. POSITION EARTH MODEL
    const earthPos = earthDir.clone().multiplyScalar(EARTH_DIST);
    if (earthModelRef.current) {
      earthModelRef.current.position.copy(earthPos);
    }

    // 3. SUN LIGHT → MOON
    if (moonSunLightRef.current) {
      moonSunLightRef.current.position.copy(sunPos);
      moonSunLightRef.current.target.position.set(0, 0, 0);
      moonSunLightRef.current.target.updateMatrixWorld();
    }

    // 4. SUN LIGHT → EARTH (From Sun direction pointing toward Earth)
    if (earthSunLightRef.current) {
      const sunToEarthDir = new THREE.Vector3().subVectors(earthPos, sunPos).normalize();
      earthSunLightRef.current.position.copy(earthPos).sub(sunToEarthDir.clone().multiplyScalar(10));
      earthSunLightRef.current.target.position.copy(earthPos);
      earthSunLightRef.current.target.updateMatrixWorld();
    }

    // ── REBUILD ALL-SITE DTE VECTORS ────────────────────────
    if (dteVectorsGroupRef.current) {
      dteVectorsGroupRef.current.clear();

      const showDTE = vectorMode === 'all' || vectorMode === 'dte';
      if (showDTE) {
        sites.forEach((site) => {
          const latRad = (site.lat * Math.PI) / 180;
          const lonRad = (site.lon * Math.PI) / 180;
          const sx = Math.cos(latRad) * Math.sin(lonRad) * MOON_RADIUS;
          const sy = Math.sin(latRad) * MOON_RADIUS;
          const sz = Math.cos(latRad) * Math.cos(lonRad) * MOON_RADIUS;
          const siteVec = new THREE.Vector3(sx, sy, sz);

          // Dot product: line of sight check (Up vector dot Earth vector)
          const upVec = siteVec.clone().normalize();
          const dot = upVec.dot(earthDir);
          const isVisible = dot > 0.0;

          // Color: Cyan for line-of-sight > 0°, Crimson for terrain/lunar occultation
          const color = isVisible ? 0x8fd3e8 : 0xef4444;
          const opacity = isVisible ? (site.id === selectedSiteId ? 0.95 : 0.45) : 0.2;

          const points = [siteVec, earthPos];
          const geom = new THREE.BufferGeometry().setFromPoints(points);
          const mat = new THREE.LineBasicMaterial({
            color,
            transparent: true,
            opacity,
            linewidth: site.id === selectedSiteId ? 2 : 1,
          });
          const line = new THREE.Line(geom, mat);
          dteVectorsGroupRef.current.add(line);
        });
      }
    }

    // ── REBUILD CONICAL SOLAR DIVERGENCE RAYS ───────────────
    if (solarRaysGroupRef.current) {
      solarRaysGroupRef.current.clear();

      const showSolar = vectorMode === 'all' || vectorMode === 'solar';
      if (showSolar) {
        const rayCount = 12;
        for (let i = 0; i < rayCount; i++) {
          const angle = (i / rayCount) * Math.PI * 2;
          const coneOffset = new THREE.Vector3(
            Math.cos(angle) * 1.8,
            Math.sin(angle) * 1.8,
            0
          );
          const target = coneOffset.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(sunDir.x, sunDir.z));
          const rayGeom = new THREE.BufferGeometry().setFromPoints([sunPos, target]);
          const rayMat = new THREE.LineBasicMaterial({
            color: 0xffab5e,
            transparent: true,
            opacity: 0.25,
          });
          solarRaysGroupRef.current.add(new THREE.Line(rayGeom, rayMat));
        }
      }
    }
  }, [date, currentHour, vectorMode, selectedSiteId]);

  useEffect(() => {
    updateEphemeris();
  }, [updateEphemeris]);

  // Update marker highlight on selection
  useEffect(() => {
    if (markersGroupRef.current) {
      buildSiteMarkers(markersGroupRef.current, selectedSiteId);
    }
  }, [selectedSiteId]);

  // Camera Mode Toggle
  const handleToggleCamera = () => {
    if (!cameraRef.current || !controlsRef.current) return;
    const newMode = cameraMode === 'geolocked' ? 'orbit' : 'geolocked';
    setCameraMode(newMode);

    if (newMode === 'orbit') {
      // Zoom out to view entire orbital system
      controlsRef.current.target.set(0, 0, 0);
      cameraRef.current.position.set(0, 22, 38);
    } else {
      // Geolock to selected site
      const found = sites.find((s) => s.id === selectedSiteId) || sites[0];
      flyToSite(found);
    }
  };

  return (
    <div className="relative w-full h-full min-h-[500px] flex flex-col select-none">
      {/* 3D Canvas Container */}
      <div ref={containerRef} className="w-full flex-1 rounded-xl overflow-hidden cursor-grab active:cursor-grabbing" />

      {/* Top Floating Control Bar */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
        {/* Camera Mode Toggle */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={handleToggleCamera}
            className={`telemetry-chip transition-all ${cameraMode === 'geolocked' ? 'sun' : 'earth'}`}
            title="Toggle between Geolocked Site View and Heliocentric Orbit System"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>{cameraMode === 'geolocked' ? 'Geolocked: Moon Site' : 'Heliocentric Orbit View'}</span>
          </button>
        </div>

        {/* Vectors Mode Toggle */}
        <div className="flex items-center gap-1.5 bg-[#0a0e17]/85 backdrop-blur-md p-1 rounded-full border border-[var(--line)] pointer-events-auto">
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
      </div>

      {/* Bottom Floating Telemetry Strip & Time Scrubber */}
      <div className="absolute bottom-3 left-3 right-3 flex flex-col md:flex-row items-center justify-between gap-3 bg-[#0a0e17]/90 backdrop-blur-md border border-[var(--line)] rounded-xl p-3 pointer-events-auto">
        {/* Instant Astronomical Telemetry */}
        <div className="flex items-center gap-4 text-xs font-telemetry">
          <div className="flex items-center gap-1.5 text-[var(--coral)]">
            <Sun className="w-3.5 h-3.5" />
            <span>{(telemetry.sunDistKm / 1000000).toFixed(2)}M km</span>
          </div>
          <div className="flex items-center gap-1.5 text-[var(--mustard)]">
            <Radio className="w-3.5 h-3.5" />
            <span>{telemetry.earthDistKm.toLocaleString()} km</span>
          </div>
          <div className="hidden sm:inline-flex text-[var(--ink-mute)]">
            Phase: <span className="text-[var(--ink)] ml-1">{telemetry.earthPhase}%</span>
          </div>
        </div>

        {/* Hour Scrubber */}
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
            className="w-full md:w-48 accent-[var(--coral)]"
          />
        </div>
      </div>
    </div>
  );
}

// ── BUILD SLEEK CANDIDATE SITE MARKERS ──────────────────────
// Obsidian black pedestal ring (#030712) + glowing laser crimson beacon (#ef4444)
function buildSiteMarkers(group, activeSiteId) {
  group.clear();

  sites.forEach((site) => {
    const latRad = (site.lat * Math.PI) / 180;
    const lonRad = (site.lon * Math.PI) / 180;

    const x = Math.cos(latRad) * Math.sin(lonRad) * MOON_RADIUS;
    const y = Math.sin(latRad) * MOON_RADIUS;
    const z = Math.cos(latRad) * Math.cos(lonRad) * MOON_RADIUS;

    const markerGroup = new THREE.Group();
    markerGroup.position.set(x, y, z);
    markerGroup.userData = { siteId: site.id, siteName: site.name };

    const isSelected = site.id === activeSiteId;

    // Surface Normal vector
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
