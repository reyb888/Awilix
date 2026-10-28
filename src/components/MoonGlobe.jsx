import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import sites from '../data/sites.json';

// Scale: Moon radius = 1 unit. Real ratios scaled for visibility.
// NASA: Earth radius = 6371km, Moon = 1737km → ratio 3.67
// NASA: Sun radius = 696000km → 400x Moon radius
// NASA: Earth-Moon distance = 384400km = 221 Moon radii
// NASA: Sun-Moon distance = 149.6M km = 86000 Moon radii
// Compressed for visibility:
const EARTH_RADIUS = 0.5;  // 3.67x scaled down for visibility (real ratio maintained visually)
const SUN_RADIUS = 1.2;     // Sun is 400x Moon, compressed to 1.2x for visibility
const EARTH_DIST = 6;       // Earth at 6 units (compressed from 221)
const SUN_DIST = 15;        // Sun at 15 units (compressed from 86000)

export default function MoonGlobe({ selectedSite, date, onSiteClick }) {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const sunLightRef = useRef(null);
  const modelRef = useRef(null);
  const [showRays, setShowRays] = useState(true);
  const [currentHour, setCurrentHour] = useState(12);
  const [selectedSiteId, setSelectedSiteId] = useState(selectedSite?.id || sites[0].id);
  const markersRef = useRef([]);
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());
  const sunSpriteRef = useRef(null);
  const earthSpriteRef = useRef(null);
  const sunRayRef = useRef(null);
  const earthRayRef = useRef(null);
  const earthMeshRef = useRef(null);
  const sunMeshRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000005);
    sceneRef.current = scene;

    // Stars
    const starGeo = new THREE.BufferGeometry();
    const starVerts = [];
    for (let i = 0; i < 3000; i++) {
      starVerts.push((Math.random() - 0.5) * 200, (Math.random() - 0.5) * 200, (Math.random() - 0.5) * 200);
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starVerts, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.15 })));

    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 500);
    camera.position.set(0, 0, 4);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 1.2;
    controls.maxDistance = 60;
    controlsRef.current = controls;

    const ambient = new THREE.AmbientLight(0x222222, 0.4);
    scene.add(ambient);

    const sunLight = new THREE.DirectionalLight(0xffffff, 1.5);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    scene.add(sunLight);
    sunLightRef.current = sunLight;

    // Sun sprite (2D, always faces camera)
    const sunCanvas = document.createElement('canvas');
    sunCanvas.width = 64; sunCanvas.height = 64;
    const sunCtx = sunCanvas.getContext('2d');
    const sunGrad = sunCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
    sunGrad.addColorStop(0, '#ffff88');
    sunGrad.addColorStop(0.3, '#ffcc00');
    sunGrad.addColorStop(0.7, '#ff8800');
    sunGrad.addColorStop(1, 'rgba(255,100,0,0)');
    sunCtx.fillStyle = sunGrad;
    sunCtx.fillRect(0, 0, 64, 64);
    const sunTexture = new THREE.CanvasTexture(sunCanvas);
    const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTexture, sizeAttenuation: false, depthTest: false }));
    sunSprite.scale.set(0.12, 0.12, 1);
    scene.add(sunSprite);
    sunSpriteRef.current = sunSprite;

    // Earth sprite (2D)
    const earthCanvas = document.createElement('canvas');
    earthCanvas.width = 64; earthCanvas.height = 64;
    const earthCtx = earthCanvas.getContext('2d');
    const earthGrad = earthCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
    earthGrad.addColorStop(0, '#88ccff');
    earthGrad.addColorStop(0.4, '#4488ff');
    earthGrad.addColorStop(0.8, '#2244aa');
    earthGrad.addColorStop(1, 'rgba(20,40,100,0)');
    earthCtx.fillStyle = earthGrad;
    earthCtx.fillRect(0, 0, 64, 64);
    const earthTexture = new THREE.CanvasTexture(earthCanvas);
    const earthSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: earthTexture, sizeAttenuation: false, depthTest: false }));
    earthSprite.scale.set(0.08, 0.08, 1);
    scene.add(earthSprite);
    earthSpriteRef.current = earthSprite;

    // Earth 3D sphere (scaled, visible when zoomed out)
    const earthGeo = new THREE.SphereGeometry(EARTH_RADIUS, 32, 32);
    const earthMat = new THREE.MeshStandardMaterial({ color: 0x2266cc });
    const earthTexLoader = new THREE.TextureLoader();
    earthTexLoader.load('/textures/earth_blue_marble.jpg', (tex) => {
      earthMat.map = tex;
      earthMat.needsUpdate = true;
    });
    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    earthMesh.visible = false;
    scene.add(earthMesh);
    earthMeshRef.current = earthMesh;

    // Sun 3D sphere (scaled, visible when zoomed out)
    const sunGeo = new THREE.SphereGeometry(SUN_RADIUS, 32, 32);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xffdd44 });
    const sunMesh = new THREE.Mesh(sunGeo, sunMat);
    sunMesh.visible = false;
    scene.add(sunMesh);
    sunMeshRef.current = sunMesh;

    // Load Moon model
    const loader = new GLTFLoader();
    loader.load('/models/moon_small.glb', (gltf) => {
      const model = gltf.scene;
      // Check model size and scale if needed
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      console.log('Moon model size:', size.x, size.y, size.z, 'center:', center.x, center.y, center.z);
      // Scale to radius 1 if needed
      const maxDim = Math.max(size.x, size.y, size.z);
      if (maxDim > 2 || maxDim < 0.5) {
        const scale = 2 / maxDim;
        model.scale.set(scale, scale, scale);
        console.log('Scaled Moon model by', scale);
      }
      scene.add(model);
      modelRef.current = model;
      addSiteMarkers(scene, markersRef);
    }, undefined, (error) => {
      console.error('Error loading Moon model:', error);
      const geometry = new THREE.SphereGeometry(1, 64, 64);
      const material = new THREE.MeshStandardMaterial({ color: 0xcccccc });
      const sphere = new THREE.Mesh(geometry, material);
      scene.add(sphere);
      modelRef.current = sphere;
      addSiteMarkers(scene, markersRef);
    });

    // Click handler for site markers
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
          if (clickedSite && onSiteClick) onSiteClick(clickedSite);
        }
      }
    };
    container.addEventListener('click', onClick);

    let animationId;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      controls.update();
      const zoomLevel = camera.position.length();
      const show3D = zoomLevel > 6;
      if (earthMeshRef.current) earthMeshRef.current.visible = show3D;
      if (sunMeshRef.current) sunMeshRef.current.visible = show3D;
      if (sunSpriteRef.current) sunSpriteRef.current.visible = !show3D;
      if (earthSpriteRef.current) earthSpriteRef.current.visible = !show3D;
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
  }, []);

  // Update positions based on date and showRays
  useEffect(() => {
    if (!sunLightRef.current) return;
    import('astronomy-engine').then((Astronomy) => {
      const time = new Date(date + 'T' + String(currentHour).padStart(2, '0') + ':00:00Z');
      const moonVec = Astronomy.GeoVector(Astronomy.Body.Moon, time, true);
      const sunVec = Astronomy.GeoVector(Astronomy.Body.Sun, time, true);

      const dSun = { x: sunVec.x - moonVec.x, y: sunVec.y - moonVec.y, z: sunVec.z - moonVec.z };
      const mag = Math.sqrt(dSun.x ** 2 + dSun.y ** 2 + dSun.z ** 2);
      const dir = { x: dSun.x / mag, y: dSun.y / mag, z: dSun.z / mag };

      sunLightRef.current.position.set(dir.x * 10, dir.y * 10, dir.z * 10);
      sunLightRef.current.target.position.set(0, 0, 0);
      sunLightRef.current.target.updateMatrixWorld();
      sunLightRef.current.intensity = showRays ? 1.5 : 0;

      // Sun sprite (further away to avoid overlapping Moon)
      const dist = 6.0;
      if (sunSpriteRef.current) {
        sunSpriteRef.current.position.set(dir.x * dist, dir.y * dist, dir.z * dist);
        sunSpriteRef.current.visible = showRays;
      }

      // Earth direction
      const dEarth = { x: -moonVec.x, y: -moonVec.y, z: -moonVec.z };
      const earthMag = Math.sqrt(dEarth.x ** 2 + dEarth.y ** 2 + dEarth.z ** 2);
      const eDir = { x: dEarth.x / earthMag, y: dEarth.y / earthMag, z: dEarth.z / earthMag };
      if (earthSpriteRef.current) {
        earthSpriteRef.current.position.set(eDir.x * dist, eDir.y * dist, eDir.z * dist);
        earthSpriteRef.current.visible = showRays;
      }

      // 3D Earth and Sun meshes
      if (earthMeshRef.current) {
        earthMeshRef.current.position.set(eDir.x * EARTH_DIST, eDir.y * EARTH_DIST, eDir.z * EARTH_DIST);
      }
      if (sunMeshRef.current) {
        sunMeshRef.current.position.set(dir.x * SUN_DIST, dir.y * SUN_DIST, dir.z * SUN_DIST);
      }

      // Light rays
      const scene = sceneRef.current;
      if (sunRayRef.current) { scene.remove(sunRayRef.current); sunRayRef.current = null; }
      if (earthRayRef.current) { scene.remove(earthRayRef.current); earthRayRef.current = null; }

      if (showRays) {
        const sunRayGeom = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(dir.x * dist, dir.y * dist, dir.z * dist),
        ]);
        const sunRay = new THREE.Line(sunRayGeom, new THREE.LineBasicMaterial({ color: 0xffff00, opacity: 0.5, transparent: true }));
        scene.add(sunRay);
        sunRayRef.current = sunRay;

        const earthRayGeom = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(eDir.x * dist, eDir.y * dist, eDir.z * dist),
        ]);
        const earthRay = new THREE.Line(earthRayGeom, new THREE.LineBasicMaterial({ color: 0x4488ff, opacity: 0.5, transparent: true }));
        scene.add(earthRay);
        earthRayRef.current = earthRay;
      }
    });
  }, [date, showRays, currentHour]);

  useEffect(() => {
    if (selectedSite?.id) setSelectedSiteId(selectedSite.id);
  }, [selectedSite]);

  useEffect(() => {
    markersRef.current.forEach((marker) => {
      if (marker.userData.siteId === selectedSiteId) {
        marker.material.color.set(0xff4444);
        marker.scale.set(1.5, 1.5, 1.5);
      } else {
        marker.material.color.set(0xffffff);
        marker.scale.set(1, 1, 1);
      }
    });
  }, [selectedSiteId]);

  const handleSiteClick = (siteId) => {
    setSelectedSiteId(siteId);
    if (onSiteClick) {
      const clickedSite = sites.find((s) => s.id === siteId);
      onSiteClick(clickedSite);
    }
  };

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full min-h-[400px] rounded-lg overflow-hidden border border-[#2a2a4a]" />
      
      <button
        onClick={() => setShowRays(!showRays)}
        className={`absolute top-2 right-2 px-3 py-1 rounded text-xs font-bold ${showRays ? 'bg-[#ffcc00] text-black' : 'bg-[#12122a] text-[#e0e0ff] border border-[#2a2a4a]'}`}
      >
        {showRays ? 'Rays ON' : 'Rays OFF'}
      </button>

      <div className="absolute bottom-2 left-2 bg-[#12122a]/80 rounded p-2 text-xs max-h-[200px] overflow-y-auto">
        <div className="text-[#a0a0cc] mb-1">Sites (click marker or name):</div>
        {sites.slice(0, 6).map((s) => (
          <div
            key={s.id}
            className={`cursor-pointer hover:text-[#ffcc00] ${selectedSiteId === s.id ? 'text-[#ffcc00] font-bold' : 'text-[#e0e0ff]'}`}
            onClick={() => handleSiteClick(s.id)}
          >
            {s.name}
          </div>
        ))}
      </div>

      {/* Time slider */}
      <div className="absolute bottom-2 right-2 bg-[#12122a]/80 rounded p-2 text-xs">
        <div className="text-[#a0a0cc] mb-1">Time: {String(currentHour).padStart(2, '0')}:00 UTC</div>
        <input
          type="range"
          min={0}
          max={23}
          value={currentHour}
          onChange={(e) => setCurrentHour(Number(e.target.value))}
          className="w-32 accent-[#ffcc00]"
        />
      </div>
    </div>
  );
}

function addSiteMarkers(scene, markersRef) {
  const markerGeometry = new THREE.SphereGeometry(0.05, 12, 12);
  const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xff4444 });

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
    // Add a glow ring
    const ringGeo = new THREE.RingGeometry(0.06, 0.08, 16);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xff4444, side: THREE.DoubleSide, transparent: true, opacity: 0.5 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.lookAt(new THREE.Vector3(x, y, z).normalize());
    ring.position.set(x, y, z);
    scene.add(ring);
    scene.add(marker);
    markersRef.current.push(marker);
  });
}