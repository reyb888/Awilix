// src/components/MoonGlobe.jsx
// Authentic 3D Moon Globe Simulation with NASA Cloud Earth & Solar Star Model
// Correct astronomical proportional scale: Moon (1.0), Earth (3.67), Sun (10.0)
// Features: Dual Lighting Mode (Physics Shadows vs Global Inspection Fill),
// Smooth Site Fly-To / Zoom Animation, Real-time Sun & Earth Ephemeris vectors.

import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import sites from '../data/sites.json';
import { getSubPoints } from '../lib/ephemeris.js';
import { Sun, Radio, Compass, Lightbulb, Sparkles, Navigation, Clock } from 'lucide-react';

// Physical astronomical ratios scaled for visual clarity:
// NASA Dimensions:
// Moon radius = 1737.4 km -> Scene Base Unit = 1.0
// Earth radius = 6371.0 km -> Ratio = 6371 / 1737.4 = 3.667 units!
// Sun radius = 696340 km -> Scaled to 10.0 units for realistic star presence
const MOON_RADIUS = 1.0;
const EARTH_RADIUS = 3.67; // Scientifically accurate 3.67x ratio to Moon
const SUN_RADIUS = 10.0;    // Prominent solar photosphere disk
const EARTH_DIST = 28.0;   // Visible orbital distance
const SUN_DIST = 85.0;     // Solar orbital distance

export default function MoonGlobe({ selectedSite, date, onSiteClick }) {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const sunLightRef = useRef(null);
  const ambientLightRef = useRef(null);
  const inspectLightRef = useRef(null);
  const modelRef = useRef(null);

  // States
  const [showRays, setShowRays] = useState(true);
  const [lightingMode, setLightingMode] = useState(false); // Global inspect fill toggle
  const [currentHour, setCurrentHour] = useState(12);
  const [selectedSiteId, setSelectedSiteId] = useState(selectedSite?.id || sites[0].id);

  // References
  const markersRef = useRef([]);
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());
  const sunRayRef = useRef(null);
  const earthRayRef = useRef(null);
  const earthMeshRef = useRef(null);
  const sunMeshRef = useRef(null);

  // Body-frame celestial direction vectors (Moon body frame: X=East, Y=North, Z=Prime Meridian)
  const dirEarthRef = useRef(new THREE.Vector3(0, 0, 1));
  const dirSunRef = useRef(new THREE.Vector3(1, 0, 0));

  // Camera Fly-to Animation Ref
  const flyTargetRef = useRef({
    active: false,
    position: new THREE.Vector3(),
    lookAt: new THREE.Vector3(),
  });

  // Trigger smooth camera zoom to landing site
  const flyToSite = useCallback((site) => {
    if (!site || !cameraRef.current || !controlsRef.current) return;
    const latRad = (site.lat * Math.PI) / 180;
    const lonRad = (site.lon * Math.PI) / 180;
    const nx = Math.cos(latRad) * Math.sin(lonRad);
    const ny = Math.sin(latRad);
    const nz = Math.cos(latRad) * Math.cos(lonRad);

    const normal = new THREE.Vector3(nx, ny, nz).normalize();
    // Hover camera 1.2 units above surface (distance 2.2 from origin)
    const targetPos = normal.clone().multiplyScalar(2.2);
    const targetLookAt = normal.clone().multiplyScalar(0.4);

    flyTargetRef.current = {
      active: true,
      position: targetPos,
      lookAt: targetLookAt,
    };
  }, []);

  // When selectedSite prop changes (e.g. from left sidebar), trigger fly-to zoom
  useEffect(() => {
    if (selectedSite?.id) {
      setSelectedSiteId(selectedSite.id);
      flyToSite(selectedSite);
    }
  }, [selectedSite, flyToSite]);

  // Handle Lighting Mode toggle
  useEffect(() => {
    if (!ambientLightRef.current || !inspectLightRef.current) return;
    if (lightingMode) {
      // Global Inspect Fill: lights up the entire space so you can see all sides of Moon, Earth, and Sun!
      ambientLightRef.current.intensity = 2.2;
      ambientLightRef.current.color.setHex(0xffffff);
      inspectLightRef.current.intensity = 1.2;
    } else {
      // Physical Solar Lighting: deep space darkness on shadow sides
      ambientLightRef.current.intensity = 0.4;
      ambientLightRef.current.color.setHex(0x222222);
      inspectLightRef.current.intensity = 0.0;
    }
  }, [lightingMode]);

  // Initialize Three.js Scene
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000005);
    sceneRef.current = scene;

    // Realistic Starfield
    const starGeo = new THREE.BufferGeometry();
    const starVerts = [];
    for (let i = 0; i < 4000; i++) {
      starVerts.push(
        (Math.random() - 0.5) * 400,
        (Math.random() - 0.5) * 400,
        (Math.random() - 0.5) * 400
      );
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starVerts, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.18 })));

    // Camera with deep frustum to view Sun and Earth
    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 2000);
    camera.position.set(0, 0, 4.2);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 1.15;
    controls.maxDistance = 250;
    controlsRef.current = controls;

    // Disable fly animation on manual user drag
    controls.addEventListener('start', () => {
      flyTargetRef.current.active = false;
    });

    // Ambient Space Light
    const ambient = new THREE.AmbientLight(0x222222, 0.4);
    scene.add(ambient);
    ambientLightRef.current = ambient;

    // Inspection Omni Fill Light (Used when Lighting mode is ON)
    const inspectLight = new THREE.DirectionalLight(0xffffff, 0.0);
    inspectLight.position.set(0, 20, 20);
    scene.add(inspectLight);
    inspectLightRef.current = inspectLight;

    // Directional Sun Light (PHYSICAL SHADOW ENGINE — 100% UNTOUCHED)
    const sunLight = new THREE.DirectionalLight(0xfffdf2, 2.0);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 120;
    sunLight.shadow.camera.left = -4;
    sunLight.shadow.camera.right = 4;
    sunLight.shadow.camera.top = 4;
    sunLight.shadow.camera.bottom = -4;
    sunLight.shadow.bias = -0.0005;
    scene.add(sunLight);
    sunLightRef.current = sunLight;

    const gltfLoader = new GLTFLoader();

    // ── 1. LOAD AUTHENTIC NASA CLOUD EARTH MODEL ────────────────
    // Primary path: downloaded folder /earth,sun,moon textures and models/EarthClouds_1_12756.glb
    const earthUrls = [
      '/earth,sun,moon textures and models/EarthClouds_1_12756.glb',
      '/models/earth.glb',
    ];

    const loadEarth = (index = 0) => {
      if (index >= earthUrls.length) return;
      gltfLoader.load(
        earthUrls[index],
        (gltf) => {
          const earthScene = gltf.scene;
          const box = new THREE.Box3().setFromObject(earthScene);
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);

          // Scaled to real 3.67x Moon ratio! (Radius = 3.67, Diameter = 7.34)
          if (maxDim > 0) {
            const scale = (EARTH_RADIUS * 2) / maxDim;
            earthScene.scale.set(scale, scale, scale);
          }

          earthScene.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
              if (child.material) {
                child.material.depthTest = true;
                child.material.depthWrite = true;
              }
            }
          });

          // IMMEDIATELY position at deep orbital distance — NEVER allow sitting at (0, 0, 0)
          earthScene.position.set(
            dirEarthRef.current.x * EARTH_DIST,
            dirEarthRef.current.y * EARTH_DIST,
            dirEarthRef.current.z * EARTH_DIST
          );

          scene.add(earthScene);
          earthMeshRef.current = earthScene;
          console.log('✓ NASA Cloud Earth model loaded and positioned in orbit');
        },
        undefined,
        (err) => {
          console.warn(`Could not load Earth from ${earthUrls[index]}, trying fallback:`, err);
          loadEarth(index + 1);
        }
      );
    };
    loadEarth(0);

    // ── 2. LOAD AUTHENTIC NASA SUN MODEL ────────────────────────
    // Primary path: /earth,sun,moon textures and models/Sun_1_1391000.glb
    const sunUrls = [
      '/earth,sun,moon textures and models/Sun_1_1391000.glb',
      '/models/sun.glb',
    ];

    const loadSun = (index = 0) => {
      if (index >= sunUrls.length) return;
      gltfLoader.load(
        sunUrls[index],
        (gltf) => {
          const sunScene = gltf.scene;
          const box = new THREE.Box3().setFromObject(sunScene);
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);

          // Scaled to prominent solar star disk (Radius = 10.0, Diameter = 20.0)
          if (maxDim > 0) {
            const scale = (SUN_RADIUS * 2) / maxDim;
            sunScene.scale.set(scale, scale, scale);
          }

          // Solar star emissive glow material setup
          sunScene.traverse((child) => {
            if (child.isMesh && child.material) {
              child.material.emissive = new THREE.Color(0xffaa22);
              child.material.emissiveIntensity = 0.9;
              child.material.toneMapped = false;
              child.material.depthTest = true;
              child.material.depthWrite = true;
            }
          });

          // IMMEDIATELY position in deep solar space — NEVER allow sitting at (0, 0, 0)
          sunScene.position.set(
            dirSunRef.current.x * SUN_DIST,
            dirSunRef.current.y * SUN_DIST,
            dirSunRef.current.z * SUN_DIST
          );

          scene.add(sunScene);
          sunMeshRef.current = sunScene;
          console.log('✓ NASA Sun model loaded and positioned in solar space');
        },
        undefined,
        (err) => {
          console.warn(`Could not load Sun from ${sunUrls[index]}, trying fallback:`, err);
          loadSun(index + 1);
        }
      );
    };
    loadSun(0);

    // ── 3. LOAD MOON MODEL ──────────────────────────────────────
    gltfLoader.load(
      '/models/moon_small.glb',
      (gltf) => {
        const model = gltf.scene;
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        if (maxDim > 0) {
          const scale = 2.0 / maxDim; // Normalized to radius 1.0
          model.scale.set(scale, scale, scale);
        }
        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        scene.add(model);
        modelRef.current = model;
        addSiteMarkers(scene, markersRef);
      },
      undefined,
      (error) => {
        console.error('Error loading Moon model:', error);
        const geometry = new THREE.SphereGeometry(1, 64, 64);
        const material = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.9 });
        const sphere = new THREE.Mesh(geometry, material);
        sphere.castShadow = true;
        sphere.receiveShadow = true;
        scene.add(sphere);
        modelRef.current = sphere;
        addSiteMarkers(scene, markersRef);
      }
    );

    // Click handler for site markers on globe
    const onClick = (event) => {
      const rect = container.getBoundingClientRect();
      mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycasterRef.current.setFromCamera(mouseRef.current, camera);
      const intersects = raycasterRef.current.intersectObjects(markersRef.current);
      if (intersects.length > 0) {
        const siteId = intersects[0].object.userData.siteId;
        if (siteId) {
          setSelectedSiteId(siteId);
          const clickedSite = sites.find((s) => s.id === siteId);
          if (clickedSite) {
            flyToSite(clickedSite);
            if (onSiteClick) onSiteClick(clickedSite);
          }
        }
      }
    };
    container.addEventListener('click', onClick);

    // Animation Loop
    let animationId;
    const animate = () => {
      animationId = requestAnimationFrame(animate);

      // Smooth camera fly-to interpolation when zooming to site
      if (flyTargetRef.current.active) {
        camera.position.lerp(flyTargetRef.current.position, 0.05);
        controls.target.lerp(flyTargetRef.current.lookAt, 0.05);
        if (camera.position.distanceTo(flyTargetRef.current.position) < 0.03) {
          flyTargetRef.current.active = false;
        }
      }

      controls.update();

      // Earth slow diurnal spin
      if (earthMeshRef.current) {
        earthMeshRef.current.rotation.y += 0.0008;
      }
      // Sun slow rotation
      if (sunMeshRef.current) {
        sunMeshRef.current.rotation.y += 0.0003;
      }

      if (earthMeshRef.current) earthMeshRef.current.visible = true;
      if (sunMeshRef.current) sunMeshRef.current.visible = true;

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
      container.removeEventListener('click', onClick);
      cancelAnimationFrame(animationId);
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [flyToSite]);

  // Update Sun & Earth ephemeris vectors based on date and time
  const updateEphemerisPositions = useCallback(() => {
    try {
      const hourStr = String(currentHour).padStart(2, '0');
      const time = new Date(`${date}T${hourStr}:00:00Z`);
      const { subsolar, subearth } = getSubPoints(time);

      // Selenographic coordinates to 3D Cartesian (matching Moon body frame and site markers):
      // X = East (+lon 90°), Y = North (+lat 90°), Z = Prime Meridian (lat 0, lon 0)
      const eLat = (subearth.lat * Math.PI) / 180;
      const eLon = (subearth.lon * Math.PI) / 180;
      const dirEarth = new THREE.Vector3(
        Math.cos(eLat) * Math.sin(eLon),
        Math.sin(eLat),
        Math.cos(eLat) * Math.cos(eLon)
      ).normalize();
      dirEarthRef.current.copy(dirEarth);

      const sLat = (subsolar.lat * Math.PI) / 180;
      const sLon = (subsolar.lon * Math.PI) / 180;
      const dirSun = new THREE.Vector3(
        Math.cos(sLat) * Math.sin(sLon),
        Math.sin(sLat),
        Math.cos(sLat) * Math.cos(sLon)
      ).normalize();
      dirSunRef.current.copy(dirSun);

      // 1. Sun Directional Light
      if (sunLightRef.current) {
        sunLightRef.current.position.set(dirSun.x * 30, dirSun.y * 30, dirSun.z * 30);
        sunLightRef.current.target.position.set(0, 0, 0);
        sunLightRef.current.target.updateMatrixWorld();
      }

      // 2. NASA Sun 3D Model in deep space
      if (sunMeshRef.current) {
        sunMeshRef.current.position.set(dirSun.x * SUN_DIST, dirSun.y * SUN_DIST, dirSun.z * SUN_DIST);
      }

      // 3. NASA Cloud Earth 3D Model in deep orbital distance
      if (earthMeshRef.current) {
        earthMeshRef.current.position.set(dirEarth.x * EARTH_DIST, dirEarth.y * EARTH_DIST, dirEarth.z * EARTH_DIST);
      }

      // 4. Light Rays
      const scene = sceneRef.current;
      if (scene) {
        if (sunRayRef.current) { scene.remove(sunRayRef.current); sunRayRef.current = null; }
        if (earthRayRef.current) { scene.remove(earthRayRef.current); earthRayRef.current = null; }

        if (showRays) {
          const sunRayGeom = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(dirSun.x * SUN_DIST, dirSun.y * SUN_DIST, dirSun.z * SUN_DIST),
          ]);
          const sunRay = new THREE.Line(
            sunRayGeom,
            new THREE.LineBasicMaterial({ color: 0xfbbf24, opacity: 0.45, transparent: true })
          );
          scene.add(sunRay);
          sunRayRef.current = sunRay;

          const earthRayGeom = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(dirEarth.x * EARTH_DIST, dirEarth.y * EARTH_DIST, dirEarth.z * EARTH_DIST),
          ]);
          const earthRay = new THREE.Line(
            earthRayGeom,
            new THREE.LineBasicMaterial({ color: 0x38bdf8, opacity: 0.45, transparent: true })
          );
          scene.add(earthRay);
          earthRayRef.current = earthRay;
        }
      }
    } catch (err) {
      console.warn('Ephemeris update error:', err);
    }
  }, [currentHour, date, showRays]);

  useEffect(() => {
    updateEphemerisPositions();
  }, [updateEphemerisPositions]);

  // Update site marker selection highlights
  useEffect(() => {
    markersRef.current.forEach((marker) => {
      if (marker.userData.siteId === selectedSiteId) {
        marker.material.color.set(0xf59e0b);
        marker.scale.set(1.6, 1.6, 1.6);
      } else {
        marker.material.color.set(0xffffff);
        marker.scale.set(1.0, 1.0, 1.0);
      }
    });
  }, [selectedSiteId]);

  const handleSiteSelect = (site) => {
    setSelectedSiteId(site.id);
    flyToSite(site);
    if (onSiteClick) onSiteClick(site);
  };

  return (
    <div className="relative w-full h-full min-h-[500px]">
      {/* 3D Canvas */}
      <div ref={containerRef} className="w-full h-full min-h-[500px] rounded-xl overflow-hidden border border-[#1e293b]" />

      {/* Top Controls Toolbar */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
        {/* LIGHTING BUTTON (Requested by user) */}
        <button
          onClick={() => setLightingMode(!lightingMode)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold backdrop-blur-md border transition-all ${
            lightingMode
              ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-lg shadow-amber-400/25 ring-2 ring-amber-400/30'
              : 'bg-[#0b1120]/80 text-slate-300 border-slate-700 hover:border-slate-500 hover:text-white'
          }`}
          title="Lights up the entire space so you can see all sides of Earth, Moon and Sun"
        >
          <Lightbulb className={`w-3.5 h-3.5 ${lightingMode ? 'text-slate-950 fill-current' : 'text-amber-400'}`} />
          <span>{lightingMode ? 'Lighting: ON' : 'Lighting: OFF'}</span>
        </button>

        {/* Light Rays Toggle */}
        <button
          onClick={() => setShowRays(!showRays)}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold backdrop-blur-md border transition-all ${
            showRays
              ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
              : 'bg-[#0b1120]/80 text-slate-400 border-slate-700 hover:border-slate-500'
          }`}
        >
          {showRays ? 'Vectors ON' : 'Vectors OFF'}
        </button>
      </div>

      {/* Top Left: Proportional Scale Badge */}
      <div className="absolute top-3 left-3 z-10 hidden sm:flex items-center gap-2 bg-[#0b1120]/85 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-700/60 text-[11px] font-mono text-slate-300">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span>NASA 3.67:1 Scale · Cloud Earth & Sun Model Active</span>
      </div>

      {/* Bottom Left: Site Fly-to Navigation Chips */}
      <div className="absolute bottom-3 left-3 z-10 bg-[#0b1120]/85 backdrop-blur-md p-2.5 rounded-xl border border-slate-700/60 max-w-xs text-xs">
        <div className="flex items-center gap-1.5 text-slate-400 mb-2 font-mono text-[10px] uppercase tracking-wider">
          <Navigation className="w-3 h-3 text-amber-400" />
          <span>Zoom to Landing Site</span>
        </div>
        <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto pr-1">
          {sites.map((s) => (
            <button
              key={s.id}
              onClick={() => handleSiteSelect(s)}
              className={`px-2 py-1 rounded text-[11px] font-medium transition-all ${
                selectedSiteId === s.id
                  ? 'bg-amber-400 text-slate-950 font-bold shadow-md shadow-amber-400/20'
                  : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              {s.name.split('(')[0].trim()}
            </button>
          ))}
        </div>
      </div>

      {/* Bottom Right: Timeline Scrubber */}
      <div className="absolute bottom-3 right-3 z-10 bg-[#0b1120]/85 backdrop-blur-md p-3 rounded-xl border border-slate-700/60 text-xs">
        <div className="flex items-center justify-between text-slate-300 mb-1.5 font-mono text-[11px]">
          <span className="flex items-center gap-1 text-amber-400">
            <Clock className="w-3 h-3" />
            <span>Time:</span>
          </span>
          <span className="font-bold text-white">{String(currentHour).padStart(2, '0')}:00 UTC</span>
        </div>
        <input
          type="range"
          min={0}
          max={23}
          value={currentHour}
          onChange={(e) => setCurrentHour(Number(e.target.value))}
          className="w-36 accent-amber-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
        />
      </div>
    </div>
  );
}

function addSiteMarkers(scene, markersRef) {
  const markerGeometry = new THREE.SphereGeometry(0.04, 16, 16);
  const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });

  sites.forEach((site) => {
    const latRad = (site.lat * Math.PI) / 180;
    const lonRad = (site.lon * Math.PI) / 180;
    const x = Math.cos(latRad) * Math.sin(lonRad);
    const y = Math.sin(latRad);
    const z = Math.cos(latRad) * Math.cos(lonRad);

    const marker = new THREE.Mesh(markerGeometry, markerMaterial.clone());
    marker.position.set(x, y, z);
    marker.userData.siteId = site.id;
    marker.userData.siteName = site.name;

    // Glowing target ring around site
    const ringGeo = new THREE.RingGeometry(0.05, 0.07, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.65,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.lookAt(new THREE.Vector3(x, y, z).normalize());
    ring.position.set(x, y, z);

    scene.add(ring);
    scene.add(marker);
    markersRef.current.push(marker);
  });
}