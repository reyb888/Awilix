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
import {bilinearGrid,gridToENU,sampleTerrain} from '../lib/terrainScience.js';
import { coordinateText } from '../lib/mascotKnowledge.js';
import sites from '../data/sites.json';
import {
  ArrowLeft, Sun, Radio, Compass, Mountain, Layers, Play,
  Pause, RefreshCw, Grid, Eye, Lightbulb, CheckCircle2,
  SlidersHorizontal, X
} from 'lucide-react';

// Global in-memory cache for instant 0ms site switching
const terrainDataCache = new Map();
const terrainPromiseCache = new Map();

// Display-only contrast stretch keeps the grayscale inspection rasters
// legible across sites whose baked textures have different source ranges.
// It changes no elevation samples or scientific calculations.
function normalizeInspectionTexture(sourceTexture) {
  try {
    const image = sourceTexture.image;
    const canvas = document.createElement('canvas');
    canvas.width = image.width || image.naturalWidth;
    canvas.height = image.height || image.naturalHeight;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!canvas.width || !canvas.height || !context) return sourceTexture;

    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    const histogram = new Uint32Array(256);
    let validCount = 0;
    for (let i = 0; i < pixels.data.length; i += 4) {
      if (pixels.data[i + 3] === 0) continue;
      const luminance = Math.round(
        0.2126 * pixels.data[i] + 0.7152 * pixels.data[i + 1] + 0.0722 * pixels.data[i + 2]
      );
      histogram[luminance] += 1;
      validCount += 1;
    }
    if (!validCount) return sourceTexture;

    const percentile = (fraction) => {
      const target = Math.ceil(validCount * fraction);
      let total = 0;
      for (let value = 0; value < histogram.length; value += 1) {
        total += histogram[value];
        if (total >= target) return value;
      }
      return 255;
    };
    const low = percentile(0.02);
    const high = percentile(0.98);
    const span = Math.max(1, high - low);

    for (let i = 0; i < pixels.data.length; i += 4) {
      if (pixels.data[i + 3] === 0) continue;
      const luminance = Math.round(
        0.2126 * pixels.data[i] + 0.7152 * pixels.data[i + 1] + 0.0722 * pixels.data[i + 2]
      );
      const stretched = Math.max(12, Math.min(244, 12 + ((luminance - low) / span) * 232));
      pixels.data[i] = stretched;
      pixels.data[i + 1] = stretched;
      pixels.data[i + 2] = stretched;
    }
    context.putImageData(pixels, 0, 0);

    const displayTexture = new THREE.CanvasTexture(canvas);
    displayTexture.colorSpace = THREE.SRGBColorSpace;
    displayTexture.anisotropy = 4;
    displayTexture.generateMipmaps = true;
    displayTexture.minFilter = THREE.LinearMipmapLinearFilter;
    displayTexture.magFilter = THREE.LinearFilter;
    sourceTexture.dispose();
    return displayTexture;
  } catch {
    // Keep the source imagery available if a browser blocks canvas access.
    return sourceTexture;
  }
}

export default function SiteTerrainView({ site, date, onBack, ephemerisRevision }) {
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
  const [terrainData, setTerrainData] = useState(() => terrainDataCache.get(site.id) || null);
  const [loading, setLoading] = useState(() => !terrainDataCache.has(site.id));
  const [renderReady, setRenderReady] = useState(false);
  const [telemetry, setTelemetry] = useState(null);
  const [exaggeration, setExaggeration] = useState(1.0); // 1.0 = Real 1:1 Physical Aspect Ratio
  const [surfaceMode, setSurfaceMode] = useState('elevation');
  const [terrainError, setTerrainError] = useState(null);
  const [showInspector, setShowInspector] = useState(false);

  useEffect(() => {
    let alive = true;
    setRenderReady(false);
    setTerrainError(null);

    const cached = terrainDataCache.get(site.id);
    if (cached) {
      setTerrainData(cached);
      setLoading(false);
      return;
    }

    setLoading(true);
    setTerrainData(null);

    let promise = terrainPromiseCache.get(site.id);
    if (!promise) {
      promise = fetch(`/science-terrain/${site.id}.json`)
        .then((r) => {
          if (!r.ok) throw new Error(`Terrain HTTP ${r.status}`);
          return r.json();
        })
        .then((data) => {
          terrainDataCache.set(site.id, data);
          return data;
        })
        .catch((e) => {
          terrainPromiseCache.delete(site.id);
          throw e;
        });
      terrainPromiseCache.set(site.id, promise);
    }

    promise
      .then((data) => {
        if (alive) {
          setTerrainData(data);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (alive) {
          setTerrainError(e.message);
          setLoading(false);
        }
      });

    return () => {
      alive = false;
    };
  }, [site.id]);

  // Handle Lighting Mode toggle
  useEffect(() => {
    if (!ambientLightRef.current) return;
    if (lightingMode) {
      // Global Inspect Fill: Illuminates deep craters and night-side terrain in high clarity
      ambientLightRef.current.intensity = 2.4;
      ambientLightRef.current.color.setHex(0xffffff);
    } else {
      // Physical Solar Lighting: deep lunar shadows with earthshine fill so terrain is always clearly legible
      ambientLightRef.current.intensity = 0.9;
      ambientLightRef.current.color.setHex(0x283848);
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

    sunLightRef.current.position.set(sunGroundX, sunGroundY, sunGroundZ);
    sunLightRef.current.target.position.set(0, 0, 0);
    sunLightRef.current.target.updateMatrixWorld();

    // Directional Sun intensity (physical solar engine intact)
    if (pos.sun.alt > 0) {
      sunLightRef.current.intensity = 3.2;
    } else {
      sunLightRef.current.intensity = 0; // Inspection fill is separately controlled.
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
  }, [site.lat, site.lon, date, currentHour, ephemerisRevision]);

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
    scene.background = new THREE.Color(0x0b121a);
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

    // AMBIENT LIGHT (Realistic lunar earthshine & secondary sky bounce)
    const ambientLight = new THREE.AmbientLight(0x283848, 0.9);
    scene.add(ambientLight);
    ambientLightRef.current = ambientLight;

    // DIRECTIONAL SUN LIGHT (PHYSICAL SHADOW ENGINE)
    const sunLight = new THREE.DirectionalLight(0xfffbf2, 3.2);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 100;
    sunLight.shadow.camera.left = -12;
    sunLight.shadow.camera.right = 12;
    sunLight.shadow.camera.top = 12;
    sunLight.shadow.camera.bottom = -12;
    sunLight.shadow.bias = -0.0001;
    sunLight.shadow.normalBias = 0.04;
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

    // COMPASS ROSE (North / East pointers on ground, Red = North, Cyan = East)
    const compassGroup = new THREE.Group();
    const northArrow = new THREE.ArrowHelper(
      new THREE.Vector3(0, 0, -1),
      new THREE.Vector3(0, 0.02, 0),
      2.5,
      0xef4444,
      0.5,
      0.25
    );
    const eastArrow = new THREE.ArrowHelper(
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 0.02, 0),
      1.8,
      0x91c6d4,
      0.4,
      0.2
    );
    compassGroup.add(northArrow);
    compassGroup.add(eastArrow);
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
      if (!container || !renderer || !camera) return;
      const width = container.clientWidth;
      const height = container.clientHeight;
      if (width === 0 || height === 0) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(container);
    window.addEventListener('resize', handleResize);

    return () => {
      resizeObserver.disconnect();
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
    let cancelled = false;
    let readyFrame = 0;
    const markReadyAfterFrame = () => {
      cancelAnimationFrame(readyFrame);
      readyFrame = requestAnimationFrame(() => {
        if (!cancelled) setRenderReady(true);
      });
    };

    if (terrainMeshRef.current) {
      scene.remove(terrainMeshRef.current);
      if (terrainMeshRef.current.geometry) terrainMeshRef.current.geometry.dispose();
      if (terrainMeshRef.current.material) terrainMeshRef.current.material.dispose();
      terrainMeshRef.current = null;
    }

    if (terrainData.id !== site.id) return;
    const sourceSize = terrainData.gridSize;
    // Keep grid lightweight and snappy (native LOLA 128x128 grid)
    const gridSize = sourceSize;
    const geometry = new THREE.PlaneGeometry(1, 1, gridSize - 1, gridSize - 1);
    const posAttr = geometry.attributes.position;
    const center = sampleTerrain(terrainData, 0, 0) ?? terrainData.minElevationM;
    const valid = new Uint8Array(gridSize * gridSize);
    const colors = new Float32Array(gridSize * gridSize * 3);

    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const idx = y * gridSize + x;
        const gx = (x / (gridSize - 1)) * (sourceSize - 1);
        const gy = (y / (gridSize - 1)) * (sourceSize - 1);
        const z = useInterpolation
          ? bilinearGrid(terrainData.rawElev, sourceSize, gx, gy)
          : terrainData.rawElev[y * sourceSize + x];
        const enu = gridToENU(terrainData, gx, gy);
        valid[idx] = Number.isFinite(z) ? 1 : 0;
        const physical = (Number.isFinite(z) ? z : center) - center - (enu.east ** 2 + enu.north ** 2) / (2 * 1737400);
        posAttr.setXYZ(idx, enu.east / 1000, enu.north / 1000, (physical / 1000) * exaggeration);

        let t = Number.isFinite(z) ? (z - terrainData.minElevationM) / (terrainData.elevationSpanM || 1) : 0;
        if (surfaceMode === 'slope') {
          const a = bilinearGrid(terrainData.rawElev, sourceSize, Math.max(0, gx - 1), gy);
          const b = bilinearGrid(terrainData.rawElev, sourceSize, Math.min(sourceSize - 1, gx + 1), gy);
          const c = bilinearGrid(terrainData.rawElev, sourceSize, gx, Math.max(0, gy - 1));
          const d = bilinearGrid(terrainData.rawElev, sourceSize, gx, Math.min(sourceSize - 1, gy + 1));
          if ([a, b, c, d].every(Number.isFinite)) {
            const dx = (b - a) / ((Math.min(sourceSize - 1, gx + 1) - Math.max(0, gx - 1)) * terrainData.spacingXM);
            const dy = (d - c) / ((Math.min(sourceSize - 1, gy + 1) - Math.max(0, gy - 1)) * terrainData.spacingYM);
            t = Math.min(1, (Math.atan(Math.hypot(dx, dy)) * 180) / Math.PI / 30);
          } else {
            t = 0;
          }
        }
        // Crisp authentic lunar palette: deep basalt regolith (#22303c) to bright anorthosite peak (#f0ebe1)
        const color = new THREE.Color().lerpColors(
          new THREE.Color(surfaceMode === 'slope' ? '#7fbdca' : '#22303c'),
          new THREE.Color(surfaceMode === 'slope' ? '#e39d75' : '#f0ebe1'),
          Math.max(0, Math.min(1, t))
        );
        colors.set([color.r, color.g, color.b], idx * 3);
      }
    }

    // Missing elevation is a hole, never an artificial zero-height wall.
    const indices = geometry.index.array;
    const kept = [];
    for (let i = 0; i < indices.length; i += 3) {
      if (valid[indices[i]] && valid[indices[i + 1]] && valid[indices[i + 2]]) {
        kept.push(indices[i], indices[i + 1], indices[i + 2]);
      }
    }
    geometry.setIndex(kept);
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();

    // Lighting inspection uses the bundled 20 m/pixel raster texture. The
    // elevation grid remains at its native source resolution; image pixels
    // do not add elevation detail.
    const textureUrl = lightingMode
      ? `/terrain/${site.id}_texture_20mpp.png`
      : surfaceMode === 'texture'
        ? terrainData.textureUrl
        : null;
    // Inspection mode is deliberately unlit: it shows the baked image with
    // one consistent contrast treatment and cannot acquire a false cast shadow.
    const material = lightingMode
      ? new THREE.MeshBasicMaterial({
          color: 0xffffff,
          vertexColors: !textureUrl,
          wireframe,
          side: THREE.DoubleSide,
          toneMapped: false,
        })
      : new THREE.MeshStandardMaterial({
          vertexColors: !textureUrl,
          roughness: 0.88,
          metalness: 0.04,
          wireframe,
          flatShading: !useInterpolation,
          side: THREE.DoubleSide,
        });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.castShadow = !lightingMode;
    mesh.receiveShadow = !lightingMode;
    scene.add(mesh);
    terrainMeshRef.current = mesh;

    if (textureUrl) {
      new THREE.TextureLoader().load(
        textureUrl,
        (sourceTexture) => {
          if (cancelled) {
            sourceTexture.dispose();
            return;
          }
          const texture = lightingMode ? normalizeInspectionTexture(sourceTexture) : sourceTexture;
          texture.colorSpace = THREE.SRGBColorSpace;
          material.map = texture;
          material.vertexColors = false;
          material.needsUpdate = true;
          markReadyAfterFrame();
        },
        undefined,
        () => {
          if (cancelled) return;
          material.map = null;
          material.vertexColors = true;
          material.needsUpdate = true;
          setTerrainError('Terrain image could not load; showing elevation colors');
          markReadyAfterFrame();
        }
      );
    } else {
      markReadyAfterFrame();
    }

    // LANDER MODEL WITH GLOWING TARGET BEACON AT (0,0)
    const lander = new THREE.Group();
    lander.rotation.x = Math.PI / 2;
    lander.add(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.08, 8), new THREE.MeshStandardMaterial({ color: 0xeac18b, metalness: 0.3, roughness: 0.6 })));
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.25, 8), new THREE.MeshBasicMaterial({ color: 0x91c6d4 }));
    antenna.position.y = 0.125;
    lander.add(antenna);

    // Glowing target ring around lander base
    const targetRing = new THREE.Mesh(
      new THREE.RingGeometry(0.2, 0.26, 24),
      new THREE.MeshBasicMaterial({ color: 0xeac18b, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
    );
    targetRing.rotation.x = -Math.PI / 2;
    lander.add(targetRing);

    lander.position.set(0, 0, 0.04);
    mesh.add(lander);

    const extent = Math.max(terrainData.widthKm, terrainData.heightKm);
    controlsRef.current.maxDistance = extent * 8;
    if (cameraRef.current.userData.siteId !== site.id) {
      cameraRef.current.position.set(extent * 0.55, extent * 0.55, extent * 0.75);
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
      cameraRef.current.userData.siteId = site.id;
    }

    return () => {
      cancelled = true;
      cancelAnimationFrame(readyFrame);
      scene.remove(mesh);
      if (terrainMeshRef.current === mesh) terrainMeshRef.current = null;
      mesh.traverse((o) => {
        o.geometry?.dispose();
        if (o.material) {
          o.material.map?.dispose();
          o.material.dispose();
        }
      });
    };
  }, [terrainData, useInterpolation, wireframe, exaggeration, surfaceMode, lightingMode, site.id]);


  return (
    <div className="site-terrain-view relative w-full h-full min-h-[580px] bg-[var(--paper)] rounded-2xl overflow-hidden border border-[var(--line)] shadow-2xl flex flex-col">
      {/* 3D WebGL Canvas */}
      <div ref={containerRef} className="w-full flex-1 relative cursor-grab active:cursor-grabbing" />

      {/* High-Tech NASA Altimetry Acquisition HUD Overlay */}
      {(loading || (!terrainError && !renderReady)) && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#060910]/95 backdrop-blur-md animate-fade-in pointer-events-none">
          <div className="relative mb-3">
            <div className="w-12 h-12 rounded-full border-2 border-[var(--coral)] border-t-transparent animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center text-[10px] font-mono text-[var(--coral)] font-bold">
              DEM
            </div>
          </div>
          <div className="text-xs font-mono font-medium text-[var(--ink)]">
            {loading ? 'Loading terrain data' : 'Preparing 3D terrain'}
          </div>
          <div className="text-[11px] font-mono text-[var(--mustard)] mt-1 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--coral)]" />
            <span>{site.name} · ({coordinateText(site)})</span>
          </div>
          <div className="text-[10px] font-mono text-[var(--ink-faint)] mt-1.5">
            Waiting for terrain mesh and imagery to render
          </div>
        </div>
      )}

      {terrainError && (
        <div className="absolute top-16 left-4 right-4 z-30 science-warning" role="alert">
          {terrainError}. Return to the globe or choose another region.
        </div>
      )}

      {/* ── Top Unified Controls Bar ─────────────────── */}
      <div className="absolute top-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Top Left: Back Button & Site Identity */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={onBack}
            className="btn-ghost flex items-center gap-1.5 text-xs py-1.5 px-3 bg-[var(--paper)] cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Moon globe</span>
          </button>

          <div className="bento-plate px-3 py-1.5 flex items-center gap-2 bg-[var(--paper)]">
            <span className="w-2 h-2 rounded-full bg-[var(--coral)]" />
            <span className="text-xs font-medium text-[var(--ink)]">{site.name}</span>
            <span className="text-[10px] text-[var(--coral)] font-mono hidden sm:inline">({coordinateText(site)})</span>
          </div>
        </div>

        {/* Top Right: View Modes & Lighting Button */}
        <div className="flex items-center gap-2 pointer-events-auto" data-guide="terrain-controls">
          {/* LIGHTING BUTTON (Inspection fill) */}
          <button
            onClick={() => {
              setRenderReady(false);
              setLightingMode((value) => !value);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold backdrop-blur-md border transition-all cursor-pointer ${
              lightingMode
                ? 'bg-[var(--coral)] text-[var(--paper-dark)] border-[var(--coral)] shadow-lg shadow-[rgba(255,171,94,0.25)]'
                : 'btn-ghost bg-[var(--paper-warm)]/90 text-[var(--ink-soft)]'
            }`}
            title="View the 20 m/pixel inspection image without extra 3D shadows; source hillshade and permanent-shadow mask remain, and elevation stays at native sampling"
          >
            <Lightbulb className={`w-3.5 h-3.5 ${lightingMode ? 'text-[var(--paper-dark)] fill-current' : 'text-[var(--coral)]'}`} />
            <span>{lightingMode ? 'Lighting: ON' : 'Lighting: OFF'}</span>
          </button>

          {/* Dual Surface Toggle Button (Raw DEM vs Continuous Surface) */}
          <button
            onClick={() => setUseInterpolation(!useInterpolation)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold backdrop-blur-md border transition-all cursor-pointer ${
              useInterpolation
                ? 'btn-ghost bg-[var(--paper-warm)]/90 text-[var(--mustard)] border-[rgba(143,211,232,0.3)]'
                : 'btn-ghost bg-[var(--paper-warm)]/90 text-[var(--coral)] border-[rgba(255,171,94,0.3)]'
            }`}
            title="Switch between raw DEM grid and smooth bilinear mesh"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{useInterpolation ? 'Smooth Mesh' : 'Raw DEM'}</span>
          </button>

          {/* Inspector Panel Toggle Button */}
          <button
            onClick={() => setShowInspector(!showInspector)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold backdrop-blur-md border transition-all cursor-pointer ${
              showInspector
                ? 'bg-[var(--bone-active)] text-[var(--coral)] border-[var(--coral)]'
                : 'btn-ghost bg-[var(--paper-warm)]/90 text-[var(--ink-mute)]'
            }`}
            title="Adjust terrain vertical exaggeration and layer type"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Settings</span>
          </button>

          {/* Wireframe Mesh Toggle */}
          <button
            onClick={() => setWireframe(!wireframe)}
            className={`p-1.5 rounded-lg text-xs font-medium backdrop-blur-md border transition-all cursor-pointer ${
              wireframe
                ? 'bg-[var(--ink)] text-[var(--paper)] border-[var(--ink)]'
                : 'btn-ghost bg-[var(--paper-warm)]/90 text-[var(--ink-mute)]'
            }`}
            title="Toggle Wireframe Grid"
          >
            <Grid className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Floating Terrain Inspector (Tucked cleanly below top bar with backdrop click-catcher) */}
      {showInspector && (
        <>
          <div
            className="absolute inset-0 z-25 bg-black/35 backdrop-blur-[1px] transition-opacity cursor-pointer"
            onClick={() => setShowInspector(false)}
          />
          <div className="absolute top-14 right-4 z-30 bento-plate p-4 max-w-xs w-72 bg-[var(--paper-warm)]/98 backdrop-blur-md border border-[var(--line)] shadow-2xl animate-fade-in space-y-3 max-h-[calc(100%-140px)] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[var(--line-soft)] pb-2">
              <span className="text-xs font-bold text-[var(--ink)] flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5 text-[var(--coral)]" />
                Terrain Surface & Scale
              </span>
              <button
                onClick={() => setShowInspector(false)}
                className="text-[var(--ink-mute)] hover:text-white p-1 cursor-pointer transition-colors"
                title="Close settings"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <label className="text-xs block text-[var(--ink-mute)]">
              <span>Surface Layer:</span>
              <select
                aria-label="Terrain surface layer"
                value={surfaceMode}
                onChange={(e) => setSurfaceMode(e.target.value)}
                className="w-full bg-[#111820] border border-[#34434e] rounded-lg p-2 mt-1 text-xs text-[var(--ink)] cursor-pointer"
              >
                <option value="elevation">Elevation Color Map</option>
                <option value="slope">Slope Angle Estimate</option>
                <option value="texture">Hillshade Texture</option>
              </select>
            </label>
            {lightingMode && (
              <p className="text-[10px] text-[var(--ink-faint)]">
                20 m/pixel image contrast is stretched per crop for viewing; elevation remains at native resolution.
              </p>
            )}

            <label className="text-xs block text-[var(--ink-mute)]">
              <div className="flex justify-between">
                <span>Vertical Exaggeration:</span>
                <span className="font-mono text-[var(--coral)]">{exaggeration}×</span>
              </div>
              <input
                aria-label="Terrain vertical exaggeration"
                type="range"
                min="1"
                max="5"
                step="0.5"
                value={exaggeration}
                onChange={(e) => setExaggeration(Number(e.target.value))}
                className="w-full accent-[var(--coral)] mt-1 cursor-pointer"
              />
            </label>

            <div className="pt-2 border-t border-[var(--line-soft)] flex items-center justify-between">
              <button
                className="btn-ghost text-xs py-1 px-3 cursor-pointer"
                onClick={() => {
                  const extent = Math.max(terrainData?.widthKm ?? 10, terrainData?.heightKm ?? 10);
                  cameraRef.current.position.set(extent * 0.55, extent * 0.55, extent * 0.75);
                  controlsRef.current.target.set(0, 0, 0);
                  controlsRef.current.update();
                }}
              >
                Reset Camera
              </button>
              <span className="text-[10px] text-[var(--ink-faint)] font-mono">1 unit = 1 km</span>
            </div>
          </div>
        </>
      )}

      {/* ── Bottom Unified HUD Dashboard (Elevation + Timeline) ─────────────────── */}
      <div className="absolute bottom-3 left-3 right-3 z-20 bento-plate px-3 py-2 bg-[var(--paper)] border border-[var(--line)] flex flex-wrap items-center justify-between gap-3 overflow-hidden rounded-md">
        {/* Physical Terrain Elevation Metrics */}
        <div className="flex flex-wrap items-center gap-3 text-xs w-full lg:w-auto border-b lg:border-b-0 border-[var(--line-soft)] pb-2 lg:pb-0 min-w-0 font-mono tabular-nums">
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="text-[11px] text-[var(--ink-mute)]">Relief:</span>
            <span className="font-medium text-[var(--emerald)]">
              {terrainData?.elevationSpanM != null ? `${terrainData.elevationSpanM.toLocaleString()} m` : 'Loading...'}
            </span>
          </div>
          <span className="text-[var(--line)] hidden sm:inline">|</span>
          <div className="text-[11px] text-[var(--ink-mute)] flex items-center gap-2 whitespace-nowrap">
            <span>Min: <span className="text-[var(--ink)]">{terrainData?.minElevationM != null ? `${terrainData.minElevationM}m` : '…'}</span></span>
            <span>Max: <span className="text-[var(--ink)]">{terrainData?.maxElevationM != null ? `${terrainData.maxElevationM}m` : '…'}</span></span>
          </div>
          <span className="text-[var(--line)] hidden sm:inline">|</span>
          <div className="text-[10px] text-[var(--ink-faint)] whitespace-nowrap">
            Grid: <span className="text-[var(--coral)]">{terrainData?.widthKm != null ? `${terrainData.widthKm.toFixed(1)} × ${terrainData.heightKm.toFixed(1)} km` : '…'}</span>
          </div>
        </div>

        {/* Timeline Scrubber & Live Telemetry */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1 lg:flex-initial justify-end">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="btn-ghost text-xs font-mono px-2.5 py-1 text-[var(--coral)] border border-[var(--line)] hover:bg-[var(--bone)] cursor-pointer flex-shrink-0"
          >
            {isPlaying ? 'Pause' : 'Play'}
          </button>

          <span className="text-xs font-mono text-[var(--ink-soft)] whitespace-nowrap font-medium min-w-[65px]">
            {String(currentHour).padStart(2, '0')}:00 UTC
          </span>

          <input
            type="range"
            min="0"
            max="23"
            value={currentHour}
            onChange={(e) => setCurrentHour(Number(e.target.value))}
            className="w-20 sm:w-28 md:w-36 min-w-[60px] max-w-full accent-[var(--coral)] h-1.5 bg-[var(--bone)] rounded-lg cursor-pointer"
          />

          {telemetry && (
            <div className="hidden xl:flex items-center gap-3 text-xs font-mono pl-3 pr-2 border-l border-[var(--line-soft)] whitespace-nowrap">
              <span className="flex items-center gap-1 text-[var(--coral)]" title="Sun Elevation">
                <Sun className="w-3.5 h-3.5" />
                <span>{telemetry.sun.alt.toFixed(1)}°</span>
              </span>
              <span className="flex items-center gap-1 text-[var(--mustard)]" title="Earth Elevation">
                <Radio className="w-3.5 h-3.5" />
                <span>{telemetry.earth.alt.toFixed(1)}°</span>
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
