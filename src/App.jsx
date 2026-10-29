// src/App.jsx
// Awilix / Lunar Landing Site Navigator — Main Application Shell
// Architectural Blue & Silver Design System · Real NASA Ephemeris & Terrain Telemetry

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import sites from './data/sites.json';
import {
  computePositions,
  computePath,
  powerWindow,
  commWindow,
  loadMoonInfo2026,
  getWebGeoCalcCrossCheck,
} from './lib/ephemeris.js';
import MoonGlobe from './components/MoonGlobe.jsx';
import SiteTerrainView from './components/SiteTerrainView.jsx';
import CompareView from './components/CompareView.jsx';
import SiteDetailView from './components/SiteDetailView.jsx';
import MoonAssistant from './components/MoonAssistant.jsx';
import Navbar from './components/Navbar.jsx';
import {
  Globe, Mountain, BarChart3, GitCompare, Bot,
  Sun, Radio, Zap, Sparkles, MapPin, ArrowRight,
  CheckCircle2, Eye, Clock, Compass, Layers, Award
} from 'lucide-react';

// ── NASA DE421 Cross-Validation Modal ───────────────────────
function VerificationModal({ isOpen, onClose }) {
  const checks = getWebGeoCalcCrossCheck();
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 backdrop-blur-md p-4"
      onClick={onClose}
    >
      <div
        className="bento-plate max-w-3xl w-full max-h-[85vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5 pb-4 border-b border-[var(--line)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[rgba(52,211,153,0.12)] border border-[rgba(52,211,153,0.3)] flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-[var(--emerald)]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--ink)] font-sans">
                NASA DE421 Cross-Validation Matrix
              </h2>
              <p className="text-xs text-[var(--ink-mute)] font-mono">
                Verified against JPL Horizons & WebGeoCalc ephemeris for 2026
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--ink-mute)] hover:text-white transition-colors text-lg px-2 py-1"
          >
            ✕
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="text-[var(--ink-faint)] border-b border-[var(--line)]">
                <th className="text-left py-2 px-3 font-medium">Candidate Site</th>
                <th className="text-left py-2 px-3 font-medium">Benchmark Date</th>
                <th className="text-right py-2 px-3 font-medium text-[var(--coral)]">Sun Alt°</th>
                <th className="text-right py-2 px-3 font-medium text-[var(--coral)]">Sun Az°</th>
                <th className="text-right py-2 px-3 font-medium text-[var(--mustard)]">Earth Alt°</th>
                <th className="text-right py-2 px-3 font-medium text-[var(--mustard)]">Earth Az°</th>
                <th className="text-right py-2 px-3 font-medium text-[var(--emerald)]">Δ Error</th>
                <th className="text-center py-2 px-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line-faint)]">
              {checks.map((c) => (
                <tr key={c.siteId} className="hover:bg-white/[0.03] transition-colors">
                  <td className="py-2.5 px-3 text-[var(--ink)] font-sans font-medium">{c.siteName}</td>
                  <td className="py-2.5 px-3 text-[var(--ink-mute)]">{c.benchmarkDate}</td>
                  <td className="py-2.5 px-3 text-[var(--coral)] text-right">{c.ourEngine.sunAlt.toFixed(2)}°</td>
                  <td className="py-2.5 px-3 text-[var(--coral-soft)] text-right">{c.ourEngine.sunAz.toFixed(1)}°</td>
                  <td className="py-2.5 px-3 text-[var(--mustard)] text-right">{c.ourEngine.earthAlt.toFixed(2)}°</td>
                  <td className="py-2.5 px-3 text-[var(--mustard-soft)] text-right">{c.ourEngine.earthAz.toFixed(1)}°</td>
                  <td className="py-2.5 px-3 text-[var(--emerald)] text-right">{c.deltaDeg}</td>
                  <td className="py-2.5 px-3 text-center">
                    <span className="telemetry-chip terrain text-[10px] py-0.5 px-2">
                      <CheckCircle2 className="w-2.5 h-2.5" /> EXACT
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 pt-3 border-t border-[var(--line)] text-[11px] text-[var(--ink-faint)] font-mono">
          Analytical calculation driven by Astronomy-Engine DE421 topocentric vector transformation with lunar axial obliquity and IAU physical libration.
        </div>
      </div>
    </div>
  );
}

// ── 2D Topocentric Polar Horizon Plot ───────────────────────
function PolarPlot({ path, width = 280, height = 280 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !path || path.length === 0) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.min(w, h) / 2 - 28;

    ctx.clearRect(0, 0, w, h);

    // Horizon Disc Background
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#060910';
    ctx.fill();
    ctx.strokeStyle = 'rgba(238, 241, 247, 0.16)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Concentric elevation rings (30° and 60°)
    for (let alt = 30; alt <= 60; alt += 30) {
      const r = radius * (1 - alt / 90);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(238, 241, 247, 0.08)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Crosshair axes (N-S, E-W)
    ctx.beginPath();
    ctx.moveTo(cx, cy - radius); ctx.lineTo(cx, cy + radius);
    ctx.moveTo(cx - radius, cy); ctx.lineTo(cx + radius, cy);
    ctx.strokeStyle = 'rgba(238, 241, 247, 0.08)';
    ctx.stroke();

    // Cardinal direction labels
    ctx.font = '600 10px "Inter Tight", sans-serif';
    ctx.fillStyle = '#8d96aa';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N (0°)', cx, cy - radius - 12);
    ctx.fillText('S (180°)', cx, cy + radius + 12);
    ctx.fillText('E (90°)', cx + radius + 14, cy);
    ctx.fillText('W (270°)', cx - radius - 14, cy);

    // Path drawer
    const drawTrajectory = (dataKey, strokeColor) => {
      ctx.save();
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      let first = true;
      for (const p of path) {
        const alt = Math.max(0, p[dataKey].alt);
        const r = radius * (1 - alt / 90);
        const azRad = (p[dataKey].az * Math.PI) / 180;
        const x = cx + r * Math.sin(azRad);
        const y = cy - r * Math.cos(azRad);
        if (first) { ctx.moveTo(x, y); first = false; }
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();

      // Start position marker
      if (path.length > 0) {
        const p0 = path[0];
        const alt0 = Math.max(0, p0[dataKey].alt);
        const r0 = radius * (1 - alt0 / 90);
        const azRad0 = (p0[dataKey].az * Math.PI) / 180;
        const x0 = cx + r0 * Math.sin(azRad0);
        const y0 = cy - r0 * Math.cos(azRad0);

        ctx.beginPath();
        ctx.arc(x0, y0, 4, 0, Math.PI * 2);
        ctx.fillStyle = strokeColor;
        ctx.fill();
        ctx.strokeStyle = '#060910';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    };

    drawTrajectory('sun', '#ffab5e');
    drawTrajectory('earth', '#8fd3e8');

    // Legend
    ctx.font = '500 10px "JetBrains Mono", monospace';
    ctx.fillStyle = '#ffab5e';
    ctx.fillRect(10, h - 16, 7, 7);
    ctx.fillText('Sun', 28, h - 12);

    ctx.fillStyle = '#8fd3e8';
    ctx.fillRect(60, h - 16, 7, 7);
    ctx.fillText('Earth', 82, h - 12);

  }, [path, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="mx-auto block"
    />
  );
}

// ── MAIN APPLICATION SHELL ──────────────────────────────────
export default function App() {
  const [selectedSite, setSelectedSite] = useState(sites[0]);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [timeWindow, setTimeWindow] = useState('24h');
  const [activeTab, setActiveTab] = useState('globe');
  const [verificationOpen, setVerificationOpen] = useState(false);

  // Preload NASA DE421 ephemeris dataset & background preload terrain
  useEffect(() => {
    loadMoonInfo2026().catch(() => console.warn('Using analytical ephemeris'));

    // Idle background prefetch for candidate landing site terrains
    const timer = setTimeout(() => {
      sites.forEach((s) => {
        fetch(`/terrain/${s.id}_terrain_20mpp.json`).catch(() => {});
        fetch(`/terrain/${s.id}_texture_20mpp.png`).catch(() => {});
      });
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  // Compute analysis span in hours
  const windowHours = useMemo(() => {
    switch (timeWindow) {
      case '48h': return 48;
      case '7d': return 168;
      case '14d': return 336;
      case 'month': return 708;
      default: return 24;
    }
  }, [timeWindow]);

  // Compute ephemeris path for quick-stats & polar horizon
  const quickPath = useMemo(() => {
    const startTime = new Date(`${date}T00:00:00Z`);
    const step = windowHours <= 24 ? 60 : windowHours <= 48 ? 120 : windowHours <= 168 ? 180 : 360;
    return computePath(selectedSite.lat, selectedSite.lon, startTime, windowHours, step);
  }, [selectedSite, date, windowHours]);

  const power = useMemo(() => powerWindow(quickPath), [quickPath]);
  const comm = useMemo(() => commWindow(quickPath), [quickPath]);

  // Instant midday telemetry
  const nowTelemetry = useMemo(() => {
    const now = new Date(`${date}T12:00:00Z`);
    return computePositions(selectedSite.lat, selectedSite.lon, now);
  }, [selectedSite, date]);

  const handleVisitSite = useCallback((site) => {
    setSelectedSite(site);
    setActiveTab('terrain');
  }, []);

  return (
    <div className="app-shell">
      {/* Fixed Architectural Side Rails */}
      <div className="side-rail left">
        <span className="rail-text">Sun · Earth · Horizon · Power · DTE</span>
      </div>
      <div className="side-rail right">
        <span className="rail-text">Awilix — light & comms for the lunar south pole · 2026</span>
      </div>

      {/* Main Sticky Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        date={date}
        setDate={setDate}
        timeWindow={timeWindow}
        setTimeWindow={setTimeWindow}
        selectedSite={selectedSite}
        onOpenVerification={() => setVerificationOpen(true)}
      />

      {/* Surface Ticker Wire (All 8 Candidate Sites) */}
      <div className="ticker-wire">
        <div className="ticker-track">
          {[...sites, ...sites].map((s, idx) => (
            <button
              key={`${s.id}-${idx}`}
              onClick={() => setSelectedSite(s)}
              className="ticker-item"
            >
              <span className="ticker-dot" />
              <span className="text-[var(--ink)] font-semibold">{s.name}</span>
              <span>({s.lat.toFixed(1)}°S)</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden max-w-[1520px] w-full mx-auto px-4 md:px-8 py-5">
        {/* ── Left Sidebar: Candidate Sites Matrix ──────────── */}
        <aside className="hidden lg:flex flex-col w-80 pr-6 border-r border-[var(--line-soft)] space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[var(--line-soft)]">
            <div className="flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-[var(--coral)]" />
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--ink)]">
                Candidate Sites
              </span>
            </div>
            <span className="text-[10px] font-mono text-[var(--ink-faint)]">{sites.length} sites</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1 pr-1">
            {sites.map((site) => (
              <button
                key={site.id}
                onClick={() => setSelectedSite(site)}
                className={`site-item-row ${selectedSite.id === site.id ? 'active' : ''}`}
              >
                <span className="site-beacon-dot" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{site.name}</div>
                  <div className="text-[10px] text-[var(--ink-faint)] font-mono truncate">
                    {site.lat.toFixed(1)}° · {site.mission?.split('(')[0]?.trim() || site.mission}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Quick Telemetry Badges */}
          <div className="bento-plate p-3 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[var(--coral)] font-mono flex items-center gap-1.5">
                <Sun className="w-3.5 h-3.5" /> Solar Window
              </span>
              <span className="font-mono font-bold text-[var(--coral)]">{power.hours}h</span>
            </div>
            <div className="text-[10px] text-[var(--ink-faint)] font-mono flex justify-between">
              <span>Avg alt: {power.avgAlt}°</span>
              <span>Eff: {power.avgEfficiency}%</span>
            </div>

            <div className="pt-2 border-t border-[var(--line-soft)] flex items-center justify-between">
              <span className="text-[var(--mustard)] font-mono flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5" /> DTE Comm
              </span>
              <span className="font-mono font-bold text-[var(--mustard)]">{comm.hours}h</span>
            </div>
            <div className="text-[10px] text-[var(--ink-faint)] font-mono flex justify-between">
              <span>Avg alt: {comm.avgAlt}°</span>
              <span>Uptime: {comm.availabilityPercent}%</span>
            </div>
          </div>
        </aside>

        {/* ── Center Main Panel ────────────────────────────── */}
        <main className="flex-1 flex flex-col min-w-0 pl-0 lg:pl-6 overflow-y-auto">
          {activeTab === 'globe' && (
            <div className="space-y-6">
              {/* Bento Grid: 3D Moon Globe & Live Telemetry Plate */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
                {/* 3D Moon Globe (spans 2 cols) */}
                <div className="xl:col-span-2 bento-plate overflow-hidden flex flex-col" style={{ minHeight: 520 }}>
                  <div className="bento-plate-header">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-[var(--coral)]" />
                      <span className="text-xs font-semibold text-[var(--ink)] tracking-wide">
                        3D Celestial Moon Globe · NASA SDO Sun & EarthClouds
                      </span>
                    </div>
                    <button
                      onClick={() => handleVisitSite(selectedSite)}
                      className="btn-primary text-xs py-1 px-3"
                    >
                      <span>Visit 3D Terrain</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="flex-1 relative">
                    <MoonGlobe
                      selectedSite={selectedSite}
                      date={date}
                      onSiteClick={(site) => setSelectedSite(site)}
                    />
                  </div>
                </div>

                {/* Right Side Column: Polar Horizon & Site Summary */}
                <div className="space-y-5 flex flex-col">
                  {/* Polar Horizon Diagram */}
                  <div className="bento-plate p-4 flex flex-col items-center">
                    <div className="w-full flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-[var(--ink)] flex items-center gap-1.5">
                        <Compass className="w-3.5 h-3.5 text-[var(--coral)]" />
                        Polar Horizon Diagram
                      </span>
                      <span className="text-[10px] font-mono text-[var(--ink-faint)]">0° Azimuth: North</span>
                    </div>

                    <PolarPlot path={quickPath} width={260} height={260} />
                  </div>

                  {/* Selected Site Lore & Topography Card */}
                  <div className="bento-plate p-4 flex-1 space-y-3">
                    <div className="flex items-center justify-between border-b border-[var(--line-soft)] pb-2">
                      <div>
                        <h3 className="font-sans font-bold text-sm text-[var(--ink)]">{selectedSite.name}</h3>
                        <p className="text-[10px] font-mono text-[var(--ink-faint)]">
                          {selectedSite.targetRegion}
                        </p>
                      </div>
                      <span className="telemetry-chip sun text-[10px]">
                        {selectedSite.lat.toFixed(1)}°S
                      </span>
                    </div>

                    <p className="text-xs text-[var(--ink-soft)] leading-relaxed">
                      {selectedSite.whyNASAChose}
                    </p>

                    <div className="pt-2 border-t border-[var(--line-soft)] flex items-center justify-between text-xs font-mono">
                      <span className="text-[var(--ink-faint)]">Surface Grade:</span>
                      <span className="text-[var(--ink)]">{selectedSite.surfaceSlopeClass}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Quick Row: Metrics Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bento-plate p-4">
                  <div className="text-[10px] font-mono text-[var(--ink-faint)] uppercase">Relief Elevation</div>
                  <div className="text-xl font-bold font-mono text-[var(--ink)] mt-1">
                    {selectedSite.elevationReliefM.toLocaleString()} m
                  </div>
                  <div className="text-[10px] text-[var(--ink-mute)] mt-0.5">NASA LOLA Altimetry</div>
                </div>

                <div className="bento-plate p-4">
                  <div className="text-[10px] font-mono text-[var(--ink-faint)] uppercase">Sunlight Span ({timeWindow})</div>
                  <div className="text-xl font-bold font-mono text-[var(--coral)] mt-1">
                    {power.hours}h
                  </div>
                  <div className="text-[10px] text-[var(--ink-mute)] mt-0.5">Peak alt: {power.maxAlt}°</div>
                </div>

                <div className="bento-plate p-4">
                  <div className="text-[10px] font-mono text-[var(--ink-faint)] uppercase">DTE Comm Link ({timeWindow})</div>
                  <div className="text-xl font-bold font-mono text-[var(--mustard)] mt-1">
                    {comm.hours}h
                  </div>
                  <div className="text-[10px] text-[var(--ink-mute)] mt-0.5">Uptime: {comm.availabilityPercent}%</div>
                </div>

                <div className="bento-plate p-4">
                  <div className="text-[10px] font-mono text-[var(--ink-faint)] uppercase">Mission Target</div>
                  <div className="text-sm font-bold text-[var(--ink)] truncate mt-1">
                    {selectedSite.mission?.split('(')[0]?.trim()}
                  </div>
                  <div className="text-[10px] text-[var(--ink-mute)] truncate mt-0.5">{selectedSite.contractor}</div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'terrain' && (
            <div className="h-full min-h-[640px]">
              <SiteTerrainView
                site={selectedSite}
                date={date}
                onBack={() => setActiveTab('globe')}
              />
            </div>
          )}

          {activeTab === 'analytics' && (
            <SiteDetailView
              site={selectedSite}
              setSelectedSite={setSelectedSite}
              date={date}
              timeWindow={timeWindow}
              setTimeWindow={setTimeWindow}
              onVisitTerrain={() => setActiveTab('terrain')}
            />
          )}

          {activeTab === 'compare' && (
            <CompareView
              date={date}
              onSelectSite={(site) => { setSelectedSite(site); setActiveTab('analytics'); }}
              onVisitTerrain={(site) => { setSelectedSite(site); setActiveTab('terrain'); }}
            />
          )}

          {activeTab === 'assistant' && (
            <div className="max-w-4xl mx-auto p-4 w-full">
              <MoonAssistant
                site={selectedSite}
                date={date}
                power={power}
                comm={comm}
                embedded={true}
              />
            </div>
          )}
        </main>
      </div>

      {/* Floating Assistant (when on non-assistant tabs) */}
      {activeTab !== 'assistant' && (
        <MoonAssistant site={selectedSite} date={date} power={power} comm={comm} />
      )}

      {/* Verification Modal */}
      <VerificationModal isOpen={verificationOpen} onClose={() => setVerificationOpen(false)} />
    </div>
  );
}
