// src/components/SiteTerrainView.jsx
// Authentic 3D Lunar Terrain Simulation using NASA LOLA 80m/pixel Digital Elevation Models.
// Zero glow blobs. Physically accurate 1:1 metric scale. Dual-Surface Mode (Raw DEM vs Continuous Surface).

import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { computePositions } from '../lib/ephemeris.js';
import {
  ArrowLeft, Sun, Radio, Compass, Mountain, Layers, Play,
  Pause, Sparkles, RefreshCw, Grid, Eye
} from 'lucide-react';

export default function SiteTerrainView({ site, date, onBack }) {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const sunLightRef = useRef(null);
  const earthMeshRef = useRef(null);
  const terrainMeshRef = useRef(null);
  const animFrameRef = useRef(null);

  // States
  const [currentHour, setCurrentHour] = useState(12);
  const [isPlaying, setIsPlaying] = useState(false);
  const [useInterpolation, setUseInterpolation] = useState(true); // Toggle: Raw DEM vs Continuous Surface
  const [wireframe, setWireframe] = useState(false);
  const [terrainData, setTerrainData] = useState(null);
  const [telemetry, setTelemetry] = useState(null);
  const [exaggeration, setExaggeration] = useState(1.0); // 1.0 = Real 1:1 Physical Aspect Ratio

  // Fetch site-specific authentic NASA LOLA dataset
  useEffect(() => {
    fetch(`/terrain/${site.id}_terrain.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setTerrainData(data);
      })
      .catch((err) => {
        console.warn('Could not load site terrain JSON:', err);
      });
  }, [site.id]);

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

    const sunDist = 30;
    const sunX = Math.cos(sunAltRad) * Math.sin(sunAzRad) * sunDist;
    const sunY = Math.sin(sunAltRad) * sunDist;
    const sunZ = -Math.cos(sunAltRad) * Math.cos(sunAzRad) * sunDist;

    sunLightRef.current.position.set(sunX, Math.max(0.05, sunY), sunZ);
    sunLightRef.current.target.position.set(0, 0, 0);
    sunLightRef.current.target.updateMatrixWorld();

    if (pos.sun.alt > 0) {
      sunLightRef.current.intensity = 3.2;
    } else {
      sunLightRef.current.intensity = 0.04; // night darkness on Moon
    }

    // 3D Earth position in the sky (No blobs, real 3D model)
    if (earthMeshRef.current) {
      const earthAltRad = (pos.earth.alt * Math.PI) / 180;
      const earthAzRad = (pos.earth.az * Math.PI) / 180;
      const earthDist = 25;

      const earthX = Math.cos(earthAltRad) * Math.sin(earthAzRad) * earthDist;
      const earthY = Math.sin(earthAltRad) * earthDist;
      const earthZ = -Math.cos(earthAltRad) * Math.cos(earthAzRad) * earthDist;

      earthMeshRef.current.position.set(earthX, earthY, earthZ);
      earthMeshRef.current.visible = pos.earth.alt > -1.0;
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
    controls.maxDistance = 50;
    controls.target.set(0, 0, 0);
    controlsRef.current = controls;

    // AMBIENT LIGHT
    const ambientLight = new THREE.AmbientLight(0x0a1020, 0.35);
    scene.add(ambientLight);

    // DIRECTIONAL SUN LIGHT (With Shadow Map)
    const sunLight = new THREE.DirectionalLight(0xfffbf2, 3.2);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 4096;
    sunLight.shadow.mapSize.height = 4096;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 60;
    sunLight.shadow.camera.left = -8;
    sunLight.shadow.camera.right = 8;
    sunLight.shadow.camera.top = 8;
    sunLight.shadow.camera.bottom = -8;
    sunLight.shadow.bias = -0.0004;
    scene.add(sunLight);
    sunLightRef.current = sunLight;

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

    // PHOTOREALISTIC 3D EARTH IN SKY (Loaded from GLB or NASA textured sphere)
    const gltfLoader = new GLTFLoader();
    gltfLoader.load(
      '/models/earth.glb',
      (gltf) => {
        const earthModel = gltf.scene;
        const box = new THREE.Box3().setFromObject(earthModel);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        if (maxDim > 0) {
          const s = 1.4 / maxDim;
          earthModel.scale.set(s, s, s);
        }
        scene.add(earthModel);
        earthMeshRef.current = earthModel;
      },
      undefined,
      () => {
        // Fallback: high-res textured sphere
        const textureLoader = new THREE.TextureLoader();
        const earthTex = textureLoader.load('/textures/earth_2k.jpg');
        earthTex.colorSpace = THREE.SRGBColorSpace;
        const earthGeom = new THREE.SphereGeometry(0.7, 32, 32);
        const earthMat = new THREE.MeshStandardMaterial({ map: earthTex, roughness: 0.6 });
        const earthMesh = new THREE.Mesh(earthGeom, earthMat);
        scene.add(earthMesh);
        earthMeshRef.current = earthMesh;
      }
    );

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

    const gridSize = terrainData.gridSize || 128;
    // 10 units wide = 10.24 km patch (1 Three.js unit = 1 km!)
    const patchUnits = 10.0;
    const geometry = new THREE.PlaneGeometry(patchUnits, patchUnits, gridSize - 1, gridSize - 1);
    const posAttr = geometry.attributes.position;

    // Select Raw Altimetry vs Continuous Interpolated Surface
    const elevArray = useInterpolation ? terrainData.interpElev : terrainData.rawElev;
    const minElev = terrainData.minElevationM;

    // Scale elevation to real physical kilometers: 1000m = 1.0 unit
    // Real 1:1 vertical-to-horizontal aspect ratio!
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

    // Photographic Lommel-Seeliger hillshade texture
    const textureLoader = new THREE.TextureLoader();
    const textureMap = textureLoader.load(terrainData.textureUrl || `/terrain/${site.id}_texture.png`);
    textureMap.colorSpace = THREE.SRGBColorSpace;

    const material = new THREE.MeshStandardMaterial({
      map: textureMap,
      roughness: 0.95,
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
    const landerMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.8, roughness: 0.2 });
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
    <div className="relative w-full h-full min-h-[580px] bg-[#010309] rounded-2xl overflow-hidden border border-[#1e293b] shadow-2xl flex flex-col">
      {/* 3D WebGL Canvas */}
      <div ref={containerRef} className="w-full flex-1 relative cursor-grab active:cursor-grabbing" />

      {/* Top Left: Back Button & Site Identity */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#070d1e]/90 hover:bg-white/10 text-white border border-[#1e293b] text-xs font-semibold backdrop-blur-md shadow-lg transition-all"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Moon Globe</span>
        </button>

        <div className="bg-[#070d1e]/90 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-[#1e293b] hidden sm:block">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            <span className="text-xs font-bold text-white tracking-wide">{site.name}</span>
            <span className="text-[10px] text-slate-400 font-mono">({site.lat}°, {site.lon}°)</span>
          </div>
        </div>
      </div>

      {/* Top Right: Interpolation Switch & View Modes */}
      <div className="absolute top-4 right-4 z-10 flex flex-wrap items-center gap-2">
        {/* Dual Surface Toggle Button (Raw DEM vs Continuous Surface) */}
        <button
          onClick={() => setUseInterpolation(!useInterpolation)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold backdrop-blur-md border transition-all ${
            useInterpolation
              ? 'bg-amber-400 text-black border-amber-400 shadow-lg shadow-amber-400/20'
              : 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-lg shadow-rose-500/10'
          }`}
          title="Toggle between continuous Gaussian-curvature surface and raw discrete altimetry"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${useInterpolation ? 'text-black' : 'text-rose-400'}`} />
          <span>{useInterpolation ? 'Continuous Surface (Gaussian Spline)' : 'Raw DEM (Discrete Altimetry)'}</span>
        </button>

        {/* Wireframe Mesh Toggle */}
        <button
          onClick={() => setWireframe(!wireframe)}
          className={`p-1.5 rounded-xl text-xs font-medium backdrop-blur-md border transition-all ${
            wireframe
              ? 'bg-white text-black border-white'
              : 'bg-[#070d1e]/90 text-slate-300 border-[#1e293b] hover:border-slate-500'
          }`}
          title="Toggle Wireframe Grid"
        >
          <Grid className="w-4 h-4" />
        </button>
      </div>

      {/* Bottom Left: Physical Terrain Metrics */}
      <div className="absolute bottom-16 left-4 z-10 bg-[#070d1e]/90 backdrop-blur-md p-3.5 rounded-xl border border-[#1e293b] max-w-xs text-xs space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase text-slate-400">Elevation Relief</span>
          <span className="font-mono font-bold text-emerald-400">
            {terrainData ? `${terrainData.elevationSpanM.toLocaleString()} m` : 'Loading...'}
          </span>
        </div>
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span>Min: <span className="font-mono text-white">{terrainData?.minElevationM}m</span></span>
          <span>Max: <span className="font-mono text-white">{terrainData?.maxElevationM}m</span></span>
        </div>
        <div className="pt-1.5 border-t border-[#1e293b] flex items-center justify-between text-[10px] text-slate-500">
          <span>Scale:</span>
          <span className="font-mono text-amber-300">
            10.24 km Patch · 80m/pixel (NASA LOLA)
          </span>
        </div>
      </div>

      {/* Bottom Timeline Scrubber */}
      <div className="absolute bottom-3 left-4 right-4 z-20 flex items-center gap-3 bg-[#070d1e]/90 backdrop-blur-md px-4 py-2 rounded-xl border border-[#1e293b]">
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className="text-amber-400 hover:text-white transition-colors text-xs font-mono font-bold px-2 py-0.5 rounded bg-white/5 border border-white/10"
        >
          {isPlaying ? 'PAUSE' : 'PLAY'}
        </button>

        <span className="text-xs font-mono text-slate-400 min-w-[70px]">
          {String(currentHour).padStart(2, '0')}:00 UTC
        </span>

        <input
          type="range"
          min="0"
          max="23"
          value={currentHour}
          onChange={(e) => setCurrentHour(Number(e.target.value))}
          className="flex-1 accent-amber-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
        />

        {telemetry && (
          <div className="hidden sm:flex items-center gap-4 text-xs font-mono">
            <span className="flex items-center gap-1.5 text-amber-400">
              <Sun className="w-3.5 h-3.5" />
              <span>Sun: {telemetry.sun.alt.toFixed(1)}°</span>
            </span>
            <span className="flex items-center gap-1.5 text-sky-400">
              <Radio className="w-3.5 h-3.5" />
              <span>Earth: {telemetry.earth.alt.toFixed(1)}°</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}