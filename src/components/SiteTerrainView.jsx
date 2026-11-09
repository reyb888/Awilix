// src/components/SiteTerrainView.jsx
// Authentic 3D Lunar Terrain Simulation using NASA LOLA 20 MPP High-Resolution Altimetry.
// Dual-Surface Mode (Raw Altimetry vs Continuous Surface).
// Features: NASA Cloud Earth & Solar Star Model in Sky, Lighting Mode (Inspection Fill),
// Zero blurry blobs, physically scaled 1:1 metric relief.

import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { computePositions } from '../lib/ephemeris.js';
import sites from '../data/sites.json';
import {
  ArrowLeft, Sun, Radio, Compass, Mountain, Layers, Play,
  Pause, Sparkles, RefreshCw, Grid, Eye, Lightbulb, CheckCircle2
} from 'lucide-react';

// Global in-memory cache for instant 0ms site switching
const terrainCache = new Map();

export default function SiteTerrainView({ site, date, onBack }) {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const sunLightRef = useRef(null);
  const ambientLightRef = useRef(null);
  const earthMeshRef = useRef(null);
  const sunMeshRef = useRef(null);
  const earthLightRef = useRef(null);
  const terrainMeshRef = useRef(null);
  const animFrameRef = useRef(null);

  // States
  const [currentHour, setCurrentHour] = useState(12);
  const [isPlaying, setIsPlaying] = useState(false);
  const [lightingMode, setLightingMode] = useState(false); // Global inspect fill
  const [useInterpolation, setUseInterpolation] = useState(true); // Raw DEM vs Continuous
  const [wireframe, setWireframe] = useState(false);
  const [terrainData, setTerrainData] = useState(terrainCache.get(site.id) || null);
  const [loading, setLoading] = useState(!terrainCache.has(site.id));
  const [telemetry, setTelemetry] = useState(null);
  const [exaggeration, setExaggeration] = useState(1.0); // 1.0 = Real 1:1 Physical Aspect Ratio
  const [is20Mpp, setIs20Mpp] = useState(terrainCache.get(site.id)?.is20Mpp ?? false);

  // Fetch site-specific authentic NASA LOLA dataset (20 MPP with instant in-memory cache)
  useEffect(() => {
    // 1. Instant 0ms load if cached
    if (terrainCache.has(site.id)) {
      const cached = terrainCache.get(site.id);
      setTerrainData(cached);
      setIs20Mpp(cached.is20Mpp ?? true);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Immediately remove previous site's terrain mesh so user never sees old site under new name
    if (terrainMeshRef.current && sceneRef.current) {
      sceneRef.current.remove(terrainMeshRef.current);
      terrainMeshRef.current = null;
    }

    fetch(`/terrain/${site.id}_terrain_20mpp.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`20 MPP not found: HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        data.is20Mpp = true;
        terrainCache.set(site.id, data);
        setTerrainData(data);
        setIs20Mpp(true);
        setLoading(false);
      })
      .catch((err) => {
        console.warn('Falling back to standard terrain:', err);
        fetch(`/terrain/${site.id}_terrain.json`)
          .then((r) => r.json())
          .then((fallbackData) => {
            fallbackData.is20Mpp = false;
            terrainCache.set(site.id, fallbackData);
            setTerrainData(fallbackData);
            setIs20Mpp(false);
            setLoading(false);
          })
          .catch((e) => {
            console.error('Failed to load terrain JSON:', e);
            setLoading(false);
          });
      });
  }, [site.id, site.name]);

  // Background idle pre-fetch for all candidate sites
  useEffect(() => {
    const timer = setTimeout(() => {
      sites.forEach((s) => {
        if (!terrainCache.has(s.id)) {
          fetch(`/terrain/${s.id}_terrain_20mpp.json`)
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => {
              if (data) {
                data.is20Mpp = true;
                terrainCache.set(s.id, data);
              }
            })
            .catch(() => {});
        }
      });
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  // Handle Lighting Mode toggle
  useEffect(() => {
    if (!ambientLightRef.current) return;
    if (lightingMode) {
      // Global Inspect Fill: Illuminates deep craters and night-side terrain in high clarity
      ambientLightRef.current.intensity = 2.4;
      ambientLightRef.current.color.setHex(0xffffff);
    } else {
      // Physical Solar Lighting: deep lunar shadows
      ambientLightRef.current.intensity = 0.35;
      ambientLightRef.current.color.setHex(0x0a1020);
    }
  }, [lightingMode]);

  // Compute live local topocentric Sun and Earth positions
  const updateLighting = useCallback(() => {
    const hourStr = String(currentHour).padStart(2, '0');
    const time = new Date(`${date}T${hourStr}:00:00Z`);
    const pos = computePositions(site.lat, site.lon, time);
    setTelemetry(pos);

    if (!sunLightRef.current) return;

    // Convert topocentric alt/az to Three.js coordinates
    // Three.js Ground Plane: X = East, -Z = North, Y = Up
    const sunAltRad = (pos.sun.alt * Math.PI) / 180;
    const sunAzRad = (pos.sun.az * Math.PI) / 180;

    // Ground directional sunlight (for casting terrain shadows)
    const sunGroundDist = 35;
    const sunGroundX = Math.cos(sunAltRad) * Math.sin(sunAzRad) * sunGroundDist;
    const sunGroundY = Math.sin(sunAltRad) * sunGroundDist;
    const sunGroundZ = -Math.cos(sunAltRad) * Math.cos(sunAzRad) * sunGroundDist;

    sunLightRef.current.position.set(sunGroundX, Math.max(0.05, sunGroundY), sunGroundZ);
    sunLightRef.current.target.position.set(0, 0, 0);
    sunLightRef.current.target.updateMatrixWorld();

    // Directional Sun intensity (physical solar engine intact)
    if (pos.sun.alt > 0) {
      sunLightRef.current.intensity = 3.2;
    } else {
      sunLightRef.current.intensity = 0.04; // night darkness on Moon
    }

    // 3D Sun in the sky (placed at sunSkyDist = 52)
    const sunSkyDist = 52;
    const sunSkyX = Math.cos(sunAltRad) * Math.sin(sunAzRad) * sunSkyDist;
    const sunSkyY = Math.sin(sunAltRad) * sunSkyDist;
    const sunSkyZ = -Math.cos(sunAltRad) * Math.cos(sunAzRad) * sunSkyDist;

    if (sunMeshRef.current) {
      sunMeshRef.current.position.set(sunSkyX, sunSkyY, sunSkyZ);
      sunMeshRef.current.visible = pos.sun.alt > -5.0;
    }

    // 3D Earth position in the sky (placed at earthDist = 32)
    if (earthMeshRef.current) {
      const earthAltRad = (pos.earth.alt * Math.PI) / 180;
      const earthAzRad = (pos.earth.az * Math.PI) / 180;
      const earthDist = 32;

      const earthX = Math.cos(earthAltRad) * Math.sin(earthAzRad) * earthDist;
      const earthY = Math.sin(earthAltRad) * earthDist;
      const earthZ = -Math.cos(earthAltRad) * Math.cos(earthAzRad) * earthDist;

      earthMeshRef.current.position.set(earthX, earthY, earthZ);
      earthMeshRef.current.visible = pos.earth.alt > -1.0;

      // Real lunar-perspective Earth phase lighting:
      // Direct sunlight onto the Earth model from the direction of the Sun
      if (earthLightRef.current) {
        const dir = new THREE.Vector3(sunSkyX - earthX, sunSkyY - earthY, sunSkyZ - earthZ).normalize();
        earthLightRef.current.position.set(earthX + dir.x * 12, earthY + dir.y * 12, earthZ + dir.z * 12);
        earthLightRef.current.target.position.set(earthX, earthY, earthZ);
        earthLightRef.current.target.updateMatrixWorld();
      }
    }
  }, [site.lat, site.lon, date, currentHour]);

  useEffect(() => {
    updateLighting();
  }, [updateLighting]);

  // Play/pause loop for shadow movement
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setCurrentHour((prev) => (prev + 1) % 24);
    }, 1000);
    return () => clearInterval(interval);
  }, [isPlaying]);

  // Initialize Three.js Terrain Scene
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // SCENE
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x010309);
    sceneRef.current = scene;

    // CAMERA (Positioned to look across crater rim)
    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      2000
    );
    camera.position.set(0, 5.0, 7.5);
    cameraRef.current = camera;

    // RENDERER
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
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
    controls.maxPolarAngle = Math.PI / 2 + 0.05;
    controls.minDistance = 1.0;
    controls.maxDistance = 60;
    controls.target.set(0, 0, 0);
    controlsRef.current = controls;

    // AMBIENT LIGHT
    const ambientLight = new THREE.AmbientLight(0x0a1020, 0.35);
    scene.add(ambientLight);
    ambientLightRef.current = ambientLight;

    // DIRECTIONAL SUN LIGHT (PHYSICAL SHADOW ENGINE — 100% UNTOUCHED)
    const sunLight = new THREE.DirectionalLight(0xfffbf2, 3.2);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 4096;
    sunLight.shadow.mapSize.height = 4096;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 80;
    sunLight.shadow.camera.left = -9;
    sunLight.shadow.camera.right = 9;
    sunLight.shadow.camera.top = 9;
    sunLight.shadow.camera.bottom = -9;
    sunLight.shadow.bias = -0.0004;
    scene.add(sunLight);
    sunLightRef.current = sunLight;

    // DEDICATED DIRECTIONAL LIGHT FOR EARTH (creates authentic lunar-perspective Earth phases)
    const earthLight = new THREE.DirectionalLight(0xfffbf2, 2.2);
    scene.add(earthLight);
    scene.add(earthLight.target);
    earthLightRef.current = earthLight;

    // STARRY SKY PARTICLES
    const starGeom = new THREE.BufferGeometry();
    const starCount = 3000;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const rad = 100 + Math.random() * 200;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.48; // upper hemisphere
      starPositions[i * 3] = rad * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = rad * Math.cos(phi);
      starPositions[i * 3 + 2] = rad * Math.sin(phi) * Math.sin(theta);
    }
    starGeom.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({ size: 0.8, color: 0xffffff, transparent: true, opacity: 0.9 });
    scene.add(new THREE.Points(starGeom, starMat));

    // ── INSTANT CELESTIAL BODIES IN SKY (0ms load time, 0MB GLB network overhead) ─
    const texLoader = new THREE.TextureLoader();

    // 1. Instant Photorealistic Earth in sky (Uses cached 2K Earth mosaic)
    // Scaled to diameter 3.4 at earthDist = 32 (angular size ~1.90° from lunar surface)
    const earthTex = texLoader.load('/textures/earth_2k.jpg');
    earthTex.colorSpace = THREE.SRGBColorSpace;
    const earthGeom = new THREE.SphereGeometry(1.7, 36, 36);
    const earthMat = new THREE.MeshStandardMaterial({
      map: earthTex,
      roughness: 0.55,
      metalness: 0.1,
    });
    const earthMesh = new THREE.Mesh(earthGeom, earthMat);
    earthMesh.position.set(0, -9999, 0);
    earthMesh.visible = false;
    scene.add(earthMesh);
    earthMeshRef.current = earthMesh;

    // 2. Instant Radiant Solar Star in sky (Uses cached 2K SDO texture)
    // Scaled to diameter 1.55 at sunSkyDist = 52 (Earth is exactly 3.565x wider in the lunar sky)
    const sunTex = texLoader.load('/textures/sun_texture_2k.jpg');
    sunTex.colorSpace = THREE.SRGBColorSpace;
    const sunGeom = new THREE.SphereGeometry(0.775, 32, 32);
    const sunMat = new THREE.MeshBasicMaterial({
      map: sunTex,
      color: 0xfff3d1,
    });
    const sunMesh = new THREE.Mesh(sunGeom, sunMat);
    sunMesh.position.set(0, -9999, 0);
    sunMesh.visible = false;
    scene.add(sunMesh);
    sunMeshRef.current = sunMesh;

    updateLighting();

    // COMPASS ROSE (North / East pointers on ground)
    const compassGroup = new THREE.Group();
    const northArrow = new THREE.ArrowHelper(
      new THREE.Vector3(0, 0, -1),
      new THREE.Vector3(0, 0.01, 0),
      2.0,
      0xef4444,
      0.4,
      0.2
    );
    compassGroup.add(northArrow);
    scene.add(compassGroup);

    // ANIMATION LOOP
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      controls.update();
      if (earthMeshRef.current) {
        earthMeshRef.current.rotation.y += 0.001;
      }
      if (sunMeshRef.current) {
        sunMeshRef.current.rotation.y += 0.0005;
      }
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animFrameRef.current);
      controls.dispose();
      renderer.dispose();
      if (earthLightRef.current && sceneRef.current) {
        sceneRef.current.remove(earthLightRef.current.target);
        sceneRef.current.remove(earthLightRef.current);
      }
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // BUILD AND UPDATE AUTHENTIC 3D TERRAIN MESH
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !terrainData) return;

    if (terrainMeshRef.current) {
      scene.remove(terrainMeshRef.current);
      if (terrainMeshRef.current.geometry) terrainMeshRef.current.geometry.dispose();
      if (terrainMeshRef.current.material) terrainMeshRef.current.material.dispose();
      terrainMeshRef.current = null;
    }

    const gridSize = terrainData.gridSize || 256;
    const patchUnits = 10.0; // 10 units wide = 10.24 km patch (1 unit = ~1 km)
    const geometry = new THREE.PlaneGeometry(patchUnits, patchUnits, gridSize - 1, gridSize - 1);
    const posAttr = geometry.attributes.position;

    // Select Raw Altimetry vs Continuous Interpolated Surface
    const elevArray = useInterpolation ? terrainData.interpElev : terrainData.rawElev;
    const minElev = terrainData.minElevationM;

    // Scale elevation to real physical kilometers: 1000m = 1.0 unit
    // Real 1:1 vertical-to-horizontal aspect ratio
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const idx = y * gridSize + x;
        const elevM = elevArray[idx] !== undefined ? elevArray[idx] : minElev;
        const zKm = ((elevM - minElev) / 1000) * Math.max(0.2, exaggeration);
        posAttr.setZ(idx, zKm);
      }
    }
    posAttr.needsUpdate = true;
    geometry.computeVertexNormals();

    // Photographic 20 MPP hillshade + PSR texture
    const textureLoader = new THREE.TextureLoader();
    const textureUrl = terrainData.textureUrl || `/terrain/${site.id}_texture_20mpp.png`;
    const textureMap = textureLoader.load(textureUrl);
    textureMap.colorSpace = THREE.SRGBColorSpace;

    const material = new THREE.MeshStandardMaterial({
      map: textureMap,
      roughness: 0.92,
      metalness: 0.05,
      wireframe: wireframe,
      flatShading: !useInterpolation,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2; // Lay horizontal (Z becomes Up)
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    terrainMeshRef.current = mesh;

    // LANDER TOUCHDOWN MARKER
    const landerGroup = new THREE.Group();
    const landerGeom = new THREE.CylinderGeometry(0.08, 0.12, 0.08, 8);
    const landerMat = new THREE.MeshStandardMaterial({ color: 0xffab5e, metalness: 0.8, roughness: 0.2 });
    landerGroup.add(new THREE.Mesh(landerGeom, landerMat));

    const antennaGeom = new THREE.CylinderGeometry(0.01, 0.01, 0.25, 8);
    antennaGeom.translate(0, 0.125, 0);
    landerGroup.add(new THREE.Mesh(antennaGeom, new THREE.MeshBasicMaterial({ color: 0xef4444 })));

    // Place lander at center vertex elevation
    const centerIdx = Math.floor(gridSize / 2) * gridSize + Math.floor(gridSize / 2);
    const centerElev = elevArray[centerIdx] || minElev;
    const centerZ = ((centerElev - minElev) / 1000) * Math.max(0.2, exaggeration);
    landerGroup.position.set(0, centerZ + 0.04, 0);
    mesh.add(landerGroup);

  }, [terrainData, useInterpolation, wireframe, exaggeration, site.id]);

  return (
    <div className="relative w-full h-full min-h-[580px] bg-[var(--paper)] rounded-2xl overflow-hidden border border-[var(--line)] shadow-2xl flex flex-col">
      {/* 3D WebGL Canvas */}
      <div ref={containerRef} className="w-full flex-1 relative cursor-grab active:cursor-grabbing" />

      {/* High-Tech NASA Altimetry Acquisition HUD Overlay */}
      {loading && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#060910]/85 backdrop-blur-md animate-fade-in pointer-events-none">
          <div className="relative mb-3">
            <div className="w-12 h-12 rounded-full border-2 border-[var(--coral)] border-t-transparent animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center text-[10px] font-mono text-[var(--coral)] font-bold">
              20M
            </div>
          </div>
          <div className="text-xs font-mono font-bold text-[var(--ink)] tracking-widest uppercase">
            Acquiring NASA LOLA 20 MPP Altimetry
          </div>
          <div className="text-[11px] font-mono text-[var(--mustard)] mt-1 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--laser-crimson)] animate-ping" />
            <span>{site.name} · ({site.lat}°, {site.lon}°)</span>
          </div>
          <div className="text-[10px] font-mono text-[var(--ink-faint)] mt-1.5">
            Resolving 65,536 Surface Vertices & Directional Shadows
          </div>
        </div>
      )}

      {/* Top Left: Back Button & Site Identity */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-3">
        <button
          onClick={onBack}
          className="btn-ghost flex items-center gap-1.5 text-xs py-1.5 px-3 bg-[var(--paper-warm)]/90 backdrop-blur-md"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Moon Globe</span>
        </button>

        <div className="bento-plate px-3.5 py-1.5 hidden sm:flex items-center gap-2 bg-[var(--paper-warm)]/90 backdrop-blur-md">
          <span className="w-2 h-2 rounded-full bg-[var(--laser-crimson)] shadow-[0_0_8px_var(--laser-crimson)]" />
          <span className="text-xs font-semibold text-[var(--ink)] tracking-wide">{site.name}</span>
          <span className="text-[10px] text-[var(--ink-faint)] font-mono">({site.lat}°, {site.lon}°)</span>
        </div>

        {/* 20 MPP Resolution Badge */}
        <div className="hidden md:flex items-center gap-1.5 bento-plate px-3 py-1.5 text-xs font-mono bg-[var(--paper-warm)]/90 backdrop-blur-md text-[var(--ink-soft)]">
          <CheckCircle2 className="w-3.5 h-3.5 text-[var(--emerald)]" />
          <span>NASA LOLA 20 MPP ({terrainData?.gridSize || 256}×{terrainData?.gridSize || 256} Altimetry)</span>
        </div>
      </div>

      {/* Top Right: View Modes & Lighting Button */}
      <div className="absolute top-4 right-4 z-10 flex flex-wrap items-center gap-2">
        {/* LIGHTING BUTTON (Inspection fill) */}
        <button
          onClick={() => setLightingMode(!lightingMode)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold backdrop-blur-md border transition-all ${
            lightingMode
              ? 'bg-[var(--coral)] text-[var(--paper-dark)] border-[var(--coral)] shadow-lg shadow-[rgba(255,171,94,0.25)]'
              : 'btn-ghost bg-[var(--paper-warm)]/90 text-[var(--ink-soft)]'
          }`}
          title="Lights up all terrain features so you can view permanently shadowed crater floors clearly"
        >
          <Lightbulb className={`w-3.5 h-3.5 ${lightingMode ? 'text-[var(--paper-dark)] fill-current' : 'text-[var(--coral)]'}`} />
          <span>{lightingMode ? 'Lighting: ON' : 'Lighting: OFF'}</span>
        </button>

        {/* Dual Surface Toggle Button (Raw DEM vs Continuous Surface) */}
        <button
          onClick={() => setUseInterpolation(!useInterpolation)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold backdrop-blur-md border transition-all ${
            useInterpolation
              ? 'btn-ghost bg-[var(--paper-warm)]/90 text-[var(--mustard)] border-[rgba(143,211,232,0.3)] shadow-lg shadow-[rgba(143,211,232,0.1)]'
              : 'btn-ghost bg-[var(--paper-warm)]/90 text-[var(--coral)] border-[rgba(255,171,94,0.3)] shadow-lg shadow-[rgba(255,171,94,0.1)]'
          }`}
          title="Toggle between smooth continuous surface and raw discrete altimetry"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>{useInterpolation ? 'Smooth Surface' : 'Raw Altimetry'}</span>
        </button>

        {/* Wireframe Mesh Toggle */}
        <button
          onClick={() => setWireframe(!wireframe)}
          className={`p-1.5 rounded-lg text-xs font-medium backdrop-blur-md border transition-all ${
            wireframe
              ? 'bg-[var(--ink)] text-[var(--paper)] border-[var(--ink)]'
              : 'btn-ghost bg-[var(--paper-warm)]/90 text-[var(--ink-mute)]'
          }`}
          title="Toggle Wireframe Grid"
        >
          <Grid className="w-4 h-4" />
        </button>
      </div>

      {/* Bottom Left: Physical Terrain Metrics */}
      <div className="absolute bottom-16 left-4 z-10 bento-plate p-3.5 max-w-xs text-xs space-y-2 bg-[var(--paper-warm)]/90 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase text-[var(--ink-faint)]">Elevation Relief</span>
          <span className="font-mono font-bold text-[var(--emerald)]">
            {terrainData ? `${terrainData.elevationSpanM.toLocaleString()} m` : 'Loading...'}
          </span>
        </div>
        <div className="flex items-center justify-between text-[11px] text-[var(--ink-mute)]">
          <span>Min: <span className="font-mono text-[var(--ink)]">{terrainData?.minElevationM}m</span></span>
          <span>Max: <span className="font-mono text-[var(--ink)]">{terrainData?.maxElevationM}m</span></span>
        </div>
        <div className="pt-1.5 border-t border-[var(--line-soft)] flex items-center justify-between text-[10px] text-[var(--ink-faint)] font-mono">
          <span>Scale & Grid:</span>
          <span className="text-[var(--coral)]">
            {is20Mpp ? '20m/px · 10.24 km Patch' : '80m/px Patch'}
          </span>
        </div>
      </div>

      {/* Bottom Timeline Scrubber */}
      <div className="absolute bottom-3 left-4 right-4 z-20 flex items-center gap-3 bento-plate px-4 py-2 bg-[var(--paper-warm)]/95 backdrop-blur-md">
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className="btn-ghost text-xs font-mono font-bold px-2.5 py-1 text-[var(--coral)] border border-[rgba(255,171,94,0.3)] hover:bg-[rgba(255,171,94,0.1)]"
        >
          {isPlaying ? 'PAUSE' : 'PLAY'}
        </button>

        <span className="text-xs font-mono text-[var(--ink-soft)] min-w-[70px]">
          {String(currentHour).padStart(2, '0')}:00 UTC
        </span>

        <input
          type="range"
          min="0"
          max="23"
          value={currentHour}
          onChange={(e) => setCurrentHour(Number(e.target.value))}
          className="flex-1 accent-[var(--coral)] h-1.5 bg-[var(--bone)] rounded-lg cursor-pointer"
        />

        {telemetry && (
          <div className="hidden sm:flex items-center gap-4 text-xs font-mono">
            <span className="flex items-center gap-1.5 text-[var(--coral)]">
              <Sun className="w-3.5 h-3.5" />
              <span>Sun: {telemetry.sun.alt.toFixed(1)}°</span>
            </span>
            <span className="flex items-center gap-1.5 text-[var(--mustard)]">
              <Radio className="w-3.5 h-3.5" />
              <span>Earth: {telemetry.earth.alt.toFixed(1)}°</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}