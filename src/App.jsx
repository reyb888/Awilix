// src/App.jsx
// Lunar Landing Site Navigator — Main Application Shell
// Architectural Blue & Silver Design System · Real NASA Ephemeris & Terrain Telemetry
// GSAP animated tab transitions and responsive layout

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import sites from './data/sites.json';
import {
  computePositions,
  loadMoonInfo2026,
} from './lib/ephemeris.js';
import MoonGlobe from './components/MoonGlobe.jsx';
import SiteTerrainView from './components/SiteTerrainView.jsx';
import CompareView from './components/CompareView.jsx';
import SiteDetailView from './components/SiteDetailView.jsx';
import MoonAssistant from './components/MoonAssistant.jsx';
import AstronautGuide from './components/AstronautGuide.jsx';
import Navbar, { MISSION_PRESETS } from './components/Navbar.jsx';
import { ScienceProvider, useScience } from './components/ScienceProvider.jsx';
import ScienceControls from './components/ScienceControls.jsx';
import { coordinateText } from './lib/mascotKnowledge.js';
import gsap from 'gsap';
import {
  Globe, Mountain, BarChart3, GitCompare, Bot,
  Sun, Radio, Zap, MapPin, ArrowRight,
  CheckCircle2, Eye, Clock, Compass, Layers, Award,
  X, ExternalLink
} from 'lucide-react';

// ── NASA Data & Accuracy Modal ──────────────────────────────
function VerificationModal({ isOpen, onClose }) {
  const science = useScience();
  if (!isOpen) return null;
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in"
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="NASA Data Sources and Validation"
        className="bento-plate p-6 max-w-2xl w-full max-h-[85vh] overflow-y-auto shadow-2xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-[var(--line-soft)]">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-[var(--coral)]" />
            <h2 className="text-lg font-bold font-sans text-[var(--ink)]">
              Data Sources & Validation
            </h2>
          </div>
          <button
            className="p-1 rounded-lg text-[var(--ink-mute)] hover:text-white transition-colors cursor-pointer"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-[var(--ink-soft)] leading-relaxed">
          Awilix computes accurate solar illumination and Earth line-of-sight communications using NASA’s official 2026 lunar ephemeris tables and high-resolution LOLA altimetry models from the Lunar Reconnaissance Orbiter (LRO).
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-[var(--paper-dark)] border border-[var(--line-soft)] space-y-1">
            <h3 className="font-bold text-[var(--coral)] flex items-center gap-1.5">
              <Sun className="w-3.5 h-3.5" /> Solar Illumination
            </h3>
            <p className="text-[11px] text-[var(--ink-mute)]">
              Calculates direct sunlight on lander solar panels based on real 2026 sun angles along the south polar horizon.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-[var(--paper-dark)] border border-[var(--line-soft)] space-y-1">
            <h3 className="font-bold text-[var(--mustard)] flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5" /> Direct Earth Contact
            </h3>
            <p className="text-[11px] text-[var(--ink-mute)]">
              Determines continuous line-of-sight to NASA’s Deep Space Network dishes, accounting for lunar libration wobbles.
            </p>
          </div>
        </div>

        <div className="space-y-2 pt-2">
          <h3 className="text-xs font-bold text-[var(--ink)]">Candidate South Pole Sites Status</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
            {science.results.map((s) => (
              <div
                key={s.site.id}
                className="p-2.5 rounded-lg bg-[var(--paper-dark)] border border-[var(--line-soft)] flex justify-between items-center"
              >
                <div>
                  <div className="font-bold text-[var(--ink)] font-sans">{s.site.name}</div>
                  <div className="text-[10px] text-[var(--ink-mute)]">
                    Sun: {s.power.exactHours.toFixed(1)}h · Earth: {s.comm.exactHours.toFixed(1)}h
                  </div>
                </div>
                <span className="text-[10px] text-[var(--emerald)] bg-[rgba(164,194,172,0.1)] px-2 py-0.5 rounded">
                  Calculated
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-3 border-t border-[var(--line-soft)] flex justify-end">
          <button className="btn-primary text-xs py-1.5 px-4" onClick={onClose}>
            Done
          </button>
        </div>
      </section>
    </div>
  );
}

// ── 2D Sky Chart: Horizon View ──────────────────────────────
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
    ctx.fillStyle = '#0b1015';
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
    ctx.moveTo(cx, cy - radius);
    ctx.lineTo(cx, cy + radius);
    ctx.moveTo(cx - radius, cy);
    ctx.lineTo(cx + radius, cy);
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
        if (p[dataKey].alt < 0) {
          first = true;
          continue;
        }
        const alt = p[dataKey].alt;
        const r = radius * (1 - alt / 90);
        const azRad = (p[dataKey].az * Math.PI) / 180;
        const x = cx + r * Math.sin(azRad);
        const y = cy - r * Math.cos(azRad);
        if (first) {
          ctx.moveTo(x, y);
          first = false;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      ctx.restore();

      // Start position marker
      if (path.length > 0 && path[0][dataKey].alt >= 0) {
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
        ctx.strokeStyle = '#0b1015';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    };

    drawTrajectory('sun', '#eac18b');
    drawTrajectory('earth', '#91c6d4');

    // Legend
    ctx.font = '500 10px "JetBrains Mono", monospace';
    ctx.fillStyle = '#eac18b';
    ctx.fillRect(10, h - 16, 7, 7);
    ctx.fillText('Sun', 28, h - 12);

    ctx.fillStyle = '#91c6d4';
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

// ── MAIN APPLICATION CONTENT ────────────────────────────────
function AppContent({ date, setDate, timeWindow, setTimeWindow }) {
  const science = useScience();
  const [selectedSite, setSelectedSite] = useState(sites[0]);
  const [activeTab, setActiveTab] = useState('globe');
  const [verificationOpen, setVerificationOpen] = useState(false);
  const [activePreset, setActivePreset] = useState(null);
  const siteInfoRef = useRef(null);
  const [comparisonPins, setComparisonPins] = useState(() => [
    { siteId: sites[0].id, date },
    { siteId: sites[1].id, date },
  ]);

  const [ephemerisRevision, setEphemerisRevision] = useState(0);
  useEffect(() => {
    loadMoonInfo2026().then(() => setEphemerisRevision((v) => v + 1));
  }, []);

  const current = science.byId[selectedSite.id];
  const quickPath = current?.path ?? [];
  const empty = { hours: 0, avgAlt: 0, maxAlt: 0, avgEfficiency: 0, availabilityPercent: 0 };
  const power = current?.power ?? empty;
  const comm = current?.comm ?? empty;

  const handleVisitSite = useCallback((site) => {
    setSelectedSite(site);
    setActiveTab('terrain');
  }, []);

  const handleSelectPreset = useCallback((preset) => {
    setActivePreset(preset);
    setDate(preset.date);
    if (preset.siteId) {
      const s = sites.find((item) => item.id === preset.siteId);
      if (s) {
        setSelectedSite(s);
      }
    }
  }, [setDate]);

  // GSAP animation when selected site or date changes
  useEffect(() => {
    if (siteInfoRef.current) {
      gsap.fromTo(
        siteInfoRef.current,
        { opacity: 0.7, y: 8 },
        { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' }
      );
    }
  }, [selectedSite, date]);

  // GSAP Tab Switching Animation
  const tabViewRef = useRef(null);
  useEffect(() => {
    if (tabViewRef.current) {
      gsap.fromTo(
        tabViewRef.current,
        { opacity: 0, y: 16, scale: 0.995 },
        { opacity: 1, y: 0, scale: 1, duration: 0.35, ease: 'power2.out' }
      );
    }
  }, [activeTab]);

  return (
    <div className="app-shell" aria-busy={science.loading}>
      {/* Main Sticky Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        date={date}
        setDate={(value) => {
          if (/^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value))) setDate(value);
        }}
        timeWindow={timeWindow}
        setTimeWindow={setTimeWindow}
        selectedSite={selectedSite}
        onOpenVerification={() => setVerificationOpen(true)}
        onSelectPreset={handleSelectPreset}
      />

      {/* Mobile / Tablet Horizontal Site Selector (shown when sidebar is hidden) */}
      <div className="lg:hidden px-4 py-2 border-b border-[var(--line-soft)] bg-[var(--paper)] flex items-center gap-2 overflow-x-auto max-w-full">
        <span className="text-[11px] font-mono text-[var(--coral)] whitespace-nowrap">
          Site:
        </span>
        {sites.map((s) => (
          <button
            key={s.id}
            onClick={() => setSelectedSite(s)}
            className={`px-2.5 py-1 rounded text-xs font-sans whitespace-nowrap transition-colors cursor-pointer border ${
              selectedSite.id === s.id
                ? 'bg-[var(--bone-hover)] border-[var(--coral)] text-[var(--coral)] font-medium'
                : 'bg-transparent border-transparent text-[var(--ink-mute)] hover:text-white'
            }`}
          >
            {s.name.split(' ')[0]}
          </button>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex max-w-[1520px] w-full mx-auto px-4 md:px-8 py-5 gap-6 min-h-0">
        {/* ── Left Sidebar: Candidate Sites Matrix (Contained, Fits in Viewport) ──────────── */}
        <aside className="hidden lg:flex flex-col w-72 flex-shrink-0 sticky top-24 self-start max-h-[calc(100vh-140px)] space-y-3 pb-2">
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-[var(--line-soft)] flex-shrink-0">
            <div className="flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-[var(--coral)]" />
              <span className="text-xs font-medium text-[var(--ink)]">
                South pole sites
              </span>
            </div>
            <span className="text-[10px] font-mono tabular-nums text-[var(--coral)]">{sites.length} sites</span>
          </div>

          {/* Scrollable Sites List */}
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 min-h-0">
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
                    {coordinateText(site)}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Quick Telemetry Badges (Pinned at bottom, compact, never overflows viewport) */}
          <div className="bento-plate p-3 space-y-2 text-xs flex-shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-[var(--coral)] font-mono flex items-center gap-1.5 text-[11px]">
                <Sun className="w-3.5 h-3.5" /> Sunlight ({timeWindow})
              </span>
              <span className="font-mono font-bold text-[var(--coral)]">
                {current ? `${power.hours}h` : '…'}
              </span>
            </div>
            <div className="text-[10px] text-[var(--ink-faint)] font-mono flex justify-between">
              <span>Avg elevation: {power.avgAlt}°</span>
              <span>Lit: {timeWindow === '24h' ? Math.round((power.hours / 24) * 100) : Math.round((power.hours / 168) * 100)}%</span>
            </div>

            <div className="pt-2 border-t border-[var(--line-soft)] flex items-center justify-between">
              <span className="text-[var(--mustard)] font-mono flex items-center gap-1.5 text-[11px]">
                <Radio className="w-3.5 h-3.5" /> Earth Contact
              </span>
              <span className="font-mono font-bold text-[var(--mustard)]">
                {current ? `${comm.hours}h` : '…'}
              </span>
            </div>
            <div className="text-[10px] text-[var(--ink-faint)] font-mono flex justify-between">
              <span>Avg elevation: {comm.avgAlt}°</span>
              <span>Visible: {comm.availabilityPercent}%</span>
            </div>
          </div>
        </aside>

        {/* ── Center Main Panel ────────────────────────────── */}
        <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          <ScienceControls scenario={current} site={selectedSite} onSelectSite={setSelectedSite} />

          <div ref={tabViewRef}>
            {activeTab === 'globe' && (
              <div className="space-y-6" data-guide="globe">
                {/* Bento Grid: 3D Moon Globe & Live Telemetry Plate */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
                  {/* 3D Moon Globe (spans 2 cols) */}
                  <div className="xl:col-span-2 bento-plate overflow-hidden flex flex-col" style={{ minHeight: 520 }}>
                    <div className="bento-plate-header">
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-[var(--coral)]" />
                        <span className="text-xs font-medium text-[var(--ink)]">
                          3D Moon globe · Local illumination and Earth line of sight
                        </span>
                      </div>
                      <button
                        onClick={() => handleVisitSite(selectedSite)}
                        className="btn-primary text-xs py-1.5 px-3"
                      >
                        <span>Launch 3D terrain</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="flex-1 relative">
                      <MoonGlobe
                        selectedSite={selectedSite}
                        date={date}
                        ephemerisRevision={ephemerisRevision}
                        onSiteClick={(site) => setSelectedSite(site)}
                      />
                    </div>
                  </div>

                  {/* Right Side Column: Sky Map & Site Summary */}
                  <div className="space-y-5 flex flex-col">
                    {/* Sky Map: Horizon View */}
                    <div className="bento-plate p-4 flex flex-col items-center">
                      <div className="w-full flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-[var(--ink)] flex items-center gap-1.5">
                          <Compass className="w-3.5 h-3.5 text-[var(--coral)]" />
                          Local Sky Chart (Horizon View)
                        </span>
                        <span className="text-[10px] font-mono text-[var(--ink-faint)]">0° Azimuth: North</span>
                      </div>

                      <PolarPlot path={quickPath} width={260} height={260} />
                    </div>

                    {/* Selected Site Information Card */}
                    <div ref={siteInfoRef} className="bento-plate p-4 flex-1 space-y-3">
                      <div className="flex items-center justify-between border-b border-[var(--line-soft)] pb-2">
                        <div>
                          <h3 className="font-sans font-bold text-sm text-[var(--ink)] flex items-center gap-2">
                            <span>{selectedSite.name}</span>
                          </h3>
                          <p className="text-[10px] font-mono text-[var(--ink-faint)]">
                            {selectedSite.targetRegion}
                          </p>
                        </div>
                        <span className="telemetry-chip sun text-[10px]">
                          {coordinateText(selectedSite)}
                        </span>
                      </div>

                      {/* Active Mission / Context Badge */}
                      <div className="p-2.5 rounded-md bg-[var(--paper)] border border-[var(--line)] text-xs text-[var(--ink-soft)] flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-[var(--coral)] leading-snug">
                            {selectedSite.mission?.split('(')[0]?.trim() || selectedSite.mission}
                          </div>
                          <div className="text-[10px] text-[var(--ink-mute)] font-mono tabular-nums mt-0.5">
                            Target: <strong className="text-[var(--ink)] font-normal">{date} UTC</strong> · {selectedSite.contractor}
                          </div>
                        </div>
                      </div>

                      <p className="text-xs text-[var(--ink-soft)] leading-relaxed">
                        {selectedSite.whyNASAChose}
                      </p>

                      {selectedSite.funFact && (
                        <div className="p-2.5 rounded-md bg-[var(--paper)] border border-[var(--line-soft)] text-xs text-[var(--ink-mute)] leading-relaxed">
                          {selectedSite.funFact}
                        </div>
                      )}

                      <div className="pt-2 border-t border-[var(--line-soft)] flex items-center justify-between text-xs font-mono tabular-nums">
                        <span className="text-[var(--ink-faint)]">Water ice potential:</span>
                        <span className="text-[var(--coral)] font-medium">{selectedSite.waterIcePotential?.split('(')[0]?.trim() || 'High'}</span>
                      </div>

                      {selectedSite.keyScienceGoals?.length > 0 && (
                        <div className="pt-2 border-t border-[var(--line-soft)] text-xs">
                          <span className="text-[10px] font-mono text-[var(--ink-faint)] block mb-1.5">
                            Key scientific payloads:
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {selectedSite.keyScienceGoals.map((goal, i) => (
                              <span
                                key={i}
                                className="text-[10px] px-2 py-0.5 rounded bg-[var(--paper)] text-[var(--ink-soft)] border border-[var(--line-soft)]"
                              >
                                {goal}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bottom Quick Row: Key Site Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bento-plate p-4">
                    <div className="text-[11px] font-mono text-[var(--ink-mute)]">Mountain relief</div>
                    <div className="text-xl font-medium font-mono tabular-nums text-[var(--ink)] mt-1">
                      {selectedSite.elevationReliefM.toLocaleString()} m
                    </div>
                    <div className="text-[10px] text-[var(--ink-faint)] mt-0.5">NASA LOLA altimetry</div>
                  </div>

                  <div className="bento-plate p-4">
                    <div className="text-[11px] font-mono text-[var(--ink-mute)]">Sunlight duration ({timeWindow})</div>
                    <div className="text-xl font-medium font-mono tabular-nums text-[var(--coral)] mt-1">
                      {current ? `${power.hours}h` : '…'}
                    </div>
                    <div className="text-[10px] text-[var(--ink-faint)] mt-0.5">Peak angle: {power.maxAlt}°</div>
                  </div>

                  <div className="bento-plate p-4">
                    <div className="text-[11px] font-mono text-[var(--ink-mute)]">Direct Earth contact ({timeWindow})</div>
                    <div className="text-xl font-medium font-mono tabular-nums text-[var(--mustard)] mt-1">
                      {current ? `${comm.hours}h` : '…'}
                    </div>
                    <div className="text-[10px] text-[var(--ink-faint)] mt-0.5">Direct link: {comm.availabilityPercent}%</div>
                  </div>

                  <div className="bento-plate p-4">
                    <div className="text-[11px] font-mono text-[var(--ink-mute)]">Mission context</div>
                    <div className="text-sm font-medium text-[var(--ink)] truncate mt-1">
                      {selectedSite.mission?.split('(')[0]?.trim()}
                    </div>
                    <div className="text-[10px] text-[var(--ink-faint)] truncate mt-0.5">{selectedSite.contractor}</div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'terrain' && (
              <div className="h-full min-h-[640px]">
                <SiteTerrainView
                  site={selectedSite}
                  date={date}
                  ephemerisRevision={ephemerisRevision}
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
                onVisitTerrain={(targetSite) => handleVisitSite(targetSite || selectedSite)}
              />
            )}

            {activeTab === 'compare' && (
              <CompareView
                date={date}
                setTimeWindow={setTimeWindow}
                pins={comparisonPins}
                onChangePins={setComparisonPins}
                onSelectSite={(site) => {
                  setSelectedSite(site);
                  setActiveTab('analytics');
                }}
                onVisitTerrain={(site) => {
                  setSelectedSite(site);
                  setActiveTab('terrain');
                }}
              />
            )}

            {activeTab === 'assistant' && (
              <div className="max-w-4xl mx-auto p-4 w-full" data-guide="assistant-view">
                <MoonAssistant
                  site={selectedSite}
                  date={date}
                  power={power}
                  comm={comm}
                  embedded={true}
                  scenario={current}
                  timeWindow={timeWindow}
                  onNavigate={setActiveTab}
                  onComparePins={setComparisonPins}
                />
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Local Astronaut Guide (Astra) */}
      <AstronautGuide
        site={selectedSite}
        date={date}
        timeWindow={timeWindow}
        power={power}
        comm={comm}
        activeTab={activeTab}
        scenario={current}
        onComparePins={setComparisonPins}
        onNavigate={setActiveTab}
      />

      {/* Validation & Data Modal */}
      <VerificationModal isOpen={verificationOpen} onClose={() => setVerificationOpen(false)} />
    </div>
  );
}

export default function App() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [timeWindow, setTimeWindow] = useState('24h');
  return (
    <ScienceProvider date={date} timeWindow={timeWindow}>
      <AppContent date={date} setDate={setDate} timeWindow={timeWindow} setTimeWindow={setTimeWindow} />
    </ScienceProvider>
  );
}
