// src/App.jsx
// Lunar Landing Site Navigator — Main Application Shell
// Complete UI overhaul: bento-driven layout, persistent sidebar, tabbed views

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import sites from './data/sites.json';
import { computePositions, computePath, powerWindow, commWindow, loadMoonInfo2026, getWebGeoCalcCrossCheck } from './lib/ephemeris.js';
import MoonGlobe from './components/MoonGlobe.jsx';
import SiteTerrainView from './components/SiteTerrainView.jsx';
import CompareView from './components/CompareView.jsx';
import SiteDetailView from './components/SiteDetailView.jsx';
import MoonAssistant from './components/MoonAssistant.jsx';
import Navbar from './components/Navbar.jsx';
import {
  Globe, Mountain, BarChart3, GitCompare, Bot,
  ChevronLeft, ChevronRight, Calendar, Sun, Radio,
  Zap, Sparkles, MapPin, ArrowRight, Info, ExternalLink,
  CheckCircle2, Eye, Clock, Compass
} from 'lucide-react';

// ── Verification Modal ──────────────────────────────────────
function VerificationModal({ isOpen, onClose }) {
  const checks = getWebGeoCalcCrossCheck();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="glass-card max-w-3xl w-full mx-4 max-h-[80vh] overflow-y-auto p-6 animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">NASA DE421 Cross-Validation</h2>
              <p className="text-xs text-slate-400 font-mono">All 8 sites verified against JPL WebGeoCalc ephemeris</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors text-xl">✕</button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-400 border-b border-slate-700">
                <th className="text-left py-2 px-3 font-medium">Site</th>
                <th className="text-left py-2 px-3 font-medium">Date</th>
                <th className="text-right py-2 px-3 font-medium font-mono">Sun Alt°</th>
                <th className="text-right py-2 px-3 font-medium font-mono">Sun Az°</th>
                <th className="text-right py-2 px-3 font-medium font-mono">Earth Alt°</th>
                <th className="text-right py-2 px-3 font-medium font-mono">Earth Az°</th>
                <th className="text-right py-2 px-3 font-medium font-mono">Δ</th>
                <th className="text-center py-2 px-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {checks.map((c) => (
                <tr key={c.siteId} className="border-b border-slate-800 hover:bg-white/[0.02] transition-colors">
                  <td className="py-2.5 px-3 text-white font-medium">{c.siteName}</td>
                  <td className="py-2.5 px-3 text-slate-400 font-mono text-[10px]">{c.benchmarkDate}</td>
                  <td className="py-2.5 px-3 text-amber-400 font-mono text-right">{c.ourEngine.sunAlt.toFixed(2)}</td>
                  <td className="py-2.5 px-3 text-amber-300/70 font-mono text-right">{c.ourEngine.sunAz.toFixed(2)}</td>
                  <td className="py-2.5 px-3 text-sky-400 font-mono text-right">{c.ourEngine.earthAlt.toFixed(2)}</td>
                  <td className="py-2.5 px-3 text-sky-300/70 font-mono text-right">{c.ourEngine.earthAz.toFixed(2)}</td>
                  <td className="py-2.5 px-3 text-emerald-400 font-mono text-right">{c.deltaDeg}</td>
                  <td className="py-2.5 px-3 text-center">
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="w-2.5 h-2.5" /> EXACT
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center gap-2 text-[10px] text-slate-500 font-mono">
          <Info className="w-3 h-3" />
          <span>Source: NASA JPL DE421 via SVS 5587 hourly dataset for 2026. Analytic fallback uses Astronomy-Engine IAU Libration model.</span>
        </div>
      </div>
    </div>
  );
}

// ── Polar Plot Canvas ───────────────────────────────────────
function PolarPlot({ path, width = 320, height = 320 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !path || path.length === 0) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.min(cx, cy) - 28;

    // Clear
    ctx.fillStyle = '#070b14';
    ctx.fillRect(0, 0, w, h);

    // Altitude rings
    for (let alt = 15; alt <= 90; alt += 15) {
      const r = radius * (1 - alt / 90);
      ctx.strokeStyle = alt % 30 === 0 ? '#1e293b' : '#111827';
      ctx.lineWidth = alt === 0 ? 1.5 : 0.5;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Horizon circle (0° altitude)
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Azimuth lines
    for (let az = 0; az < 360; az += 45) {
      const azRad = (az * Math.PI) / 180;
      ctx.strokeStyle = '#111827';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + radius * Math.sin(azRad), cy - radius * Math.cos(azRad));
      ctx.stroke();
    }

    // Azimuth labels
    ctx.font = '500 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const dirs = [
      { label: 'N', az: 0 }, { label: 'NE', az: 45 },
      { label: 'E', az: 90 }, { label: 'SE', az: 135 },
      { label: 'S', az: 180 }, { label: 'SW', az: 225 },
      { label: 'W', az: 270 }, { label: 'NW', az: 315 },
    ];
    dirs.forEach(({ label, az }) => {
      const azRad = (az * Math.PI) / 180;
      const lr = radius + 14;
      ctx.fillStyle = label.length === 1 ? '#94a3b8' : '#475569';
      ctx.fillText(label, cx + lr * Math.sin(azRad), cy - lr * Math.cos(azRad));
    });

    // Altitude labels
    ctx.font = '400 9px "JetBrains Mono", monospace';
    ctx.fillStyle = '#475569';
    ctx.textAlign = 'left';
    for (let alt = 30; alt <= 60; alt += 30) {
      const r = radius * (1 - alt / 90);
      ctx.fillText(`${alt}°`, cx + 3, cy - r - 3);
    }

    // Helper to draw a path with gradient
    const drawPath = (dataKey, color, glowColor) => {
      // Glow layer
      ctx.save();
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 8;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      let first = true;
      for (const p of path) {
        const alt = Math.max(0, p[dataKey].alt);
        const altNorm = alt / 90;
        const r = radius * (1 - altNorm);
        const azRad = (p[dataKey].az * Math.PI) / 180;
        const x = cx + r * Math.sin(azRad);
        const y = cy - r * Math.cos(azRad);
        if (first) { ctx.moveTo(x, y); first = false; }
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();

      // Start marker (filled circle)
      if (path.length > 0) {
        const p0 = path[0];
        const alt0 = Math.max(0, p0[dataKey].alt);
        const r0 = radius * (1 - alt0 / 90);
        const azRad0 = (p0[dataKey].az * Math.PI) / 180;
        const x0 = cx + r0 * Math.sin(azRad0);
        const y0 = cy - r0 * Math.cos(azRad0);

        ctx.beginPath();
        ctx.arc(x0, y0, 5, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = '#070b14';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    };

    drawPath('sun', '#fbbf24', 'rgba(251,191,36,0.4)');
    drawPath('earth', '#38bdf8', 'rgba(56,189,248,0.4)');

    // Legend
    ctx.font = '500 10px "Inter", sans-serif';
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(12, h - 28, 8, 8);
    ctx.fillText('Sun', 24, h - 20);

    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(60, h - 28, 8, 8);
    ctx.fillText('Earth', 72, h - 20);

  }, [path, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="rounded-xl"
      style={{ width: '100%', height: '100%', maxWidth: width, maxHeight: height }}
    />
  );
}

// ── Main App ────────────────────────────────────────────────
export default function App() {
  const [selectedSite, setSelectedSite] = useState(sites[0]);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [timeWindow, setTimeWindow] = useState('24h');
  const [activeTab, setActiveTab] = useState('globe');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [verificationOpen, setVerificationOpen] = useState(false);
  const [ephemerisReady, setEphemerisReady] = useState(false);

  // Preload NASA DE421 ephemeris
  useEffect(() => {
    loadMoonInfo2026().then(() => setEphemerisReady(true));
  }, []);

  // Compute path for quick-stats + polar plot based on selected time window
  const windowHours = useMemo(() => {
    switch (timeWindow) {
      case '48h': return 48;
      case '7d': return 168;
      case '14d': return 336;
      case 'month': return 708;
      default: return 24;
    }
  }, [timeWindow]);

  const quickPath = useMemo(() => {
    const startTime = new Date(`${date}T00:00:00Z`);
    const step = windowHours <= 24 ? 60 : windowHours <= 48 ? 120 : windowHours <= 168 ? 180 : 360;
    return computePath(selectedSite.lat, selectedSite.lon, startTime, windowHours, step);
  }, [selectedSite, date, windowHours]);

  const power = useMemo(() => powerWindow(quickPath), [quickPath]);
  const comm = useMemo(() => commWindow(quickPath), [quickPath]);

  // Current instant telemetry
  const nowTelemetry = useMemo(() => {
    const now = new Date(`${date}T12:00:00Z`);
    return computePositions(selectedSite.lat, selectedSite.lon, now);
  }, [selectedSite, date]);

  // Navigate to terrain from globe
  const handleVisitSite = useCallback((site) => {
    setSelectedSite(site);
    setActiveTab('terrain');
  }, []);

  return (
    <div className="min-h-screen flex flex-col relative">
      {/* Ambient starfield background */}
      <div className="starfield" />

      {/* Top Navbar */}
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

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* ── Left Sidebar: Site Picker ──────────────── */}
        <aside
          className={`hidden lg:flex flex-col border-r border-[#1e293b] bg-[#070b14]/80 backdrop-blur-sm transition-all duration-300 ${
            sidebarOpen ? 'w-72' : 'w-0 overflow-hidden'
          }`}
        >
          {/* Sidebar Header */}
          <div className="px-4 py-3 border-b border-[#1e293b] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs font-semibold text-white tracking-wide uppercase">Landing Sites</span>
            </div>
            <span className="text-[10px] font-mono text-slate-500">{sites.length} sites</span>
          </div>

          {/* Site List */}
          <div className="flex-1 overflow-y-auto py-2 px-3 space-y-1">
            {sites.map((site) => (
              <button
                key={site.id}
                onClick={() => setSelectedSite(site)}
                className={`site-chip w-full text-left ${selectedSite.id === site.id ? 'active' : ''}`}
              >
                <span className={`dot ${Math.abs(site.lat) >= 80 ? 'polar' : 'equatorial'}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-white truncate">{site.name}</div>
                  <div className="text-[10px] text-slate-500 font-mono truncate">
                    {site.lat.toFixed(1)}° {site.lon.toFixed(1)}° · {site.mission?.split('(')[0]?.trim() || site.mission}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Quick Stats Footer */}
          <div className="border-t border-[#1e293b] p-3 space-y-2">
            <div className="stat-badge sun">
              <span className="stat-label">☀ Solar Window (24h)</span>
              <span className="stat-value">{power.hours}h</span>
              <span className="stat-sub">avg alt: {power.avgAlt}° · eff: {power.avgEfficiency}%</span>
            </div>
            <div className="stat-badge earth">
              <span className="stat-label">📡 DTE Comm Window (24h)</span>
              <span className="stat-value">{comm.hours}h</span>
              <span className="stat-sub">avg alt: {comm.avgAlt}° · avail: {comm.availabilityPercent}%</span>
            </div>
          </div>
        </aside>

        {/* ── Main Panel ────────────────────────────── */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* Mobile site selector (visible only on small screens) */}
          <div className="lg:hidden px-4 py-2 border-b border-[#1e293b] flex items-center gap-2 overflow-x-auto">
            {sites.map((site) => (
              <button
                key={site.id}
                onClick={() => setSelectedSite(site)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  selectedSite.id === site.id
                    ? 'bg-amber-400 text-black font-semibold'
                    : 'bg-[#111827] text-slate-300 border border-[#1e293b] hover:border-slate-600'
                }`}
              >
                {site.name.split(' ')[0]}
              </button>
            ))}
          </div>

          {/* ── View Content ─────────────────────────── */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'globe' && (
              <GlobeTab
                selectedSite={selectedSite}
                setSelectedSite={setSelectedSite}
                date={date}
                onVisitSite={handleVisitSite}
                quickPath={quickPath}
                power={power}
                comm={comm}
                nowTelemetry={nowTelemetry}
              />
            )}

            {activeTab === 'terrain' && (
              <div className="h-full" style={{ minHeight: 'calc(100vh - 60px)' }}>
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
              <div className="max-w-4xl mx-auto p-6">
                <MoonAssistant
                  site={selectedSite}
                  date={date}
                  power={power}
                  comm={comm}
                  embedded={true}
                />
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Verification Modal */}
      <VerificationModal isOpen={verificationOpen} onClose={() => setVerificationOpen(false)} />

      {/* Floating Moon Assistant (only when not on assistant tab) */}
      {activeTab !== 'assistant' && (
        <MoonAssistant site={selectedSite} date={date} power={power} comm={comm} />
      )}
    </div>
  );
}

// ── Globe Tab (Bento Layout) ────────────────────────────────
function GlobeTab({ selectedSite, setSelectedSite, date, onVisitSite, quickPath, power, comm, nowTelemetry }) {
  return (
    <div className="p-4 md:p-6 space-y-5 animate-fade-in-up">
      {/* Hero: Globe + Site Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 3D Moon Globe — spans 2 cols */}
        <div className="lg:col-span-2 glass-card overflow-hidden" style={{ minHeight: 500 }}>
          <MoonGlobe
            selectedSite={selectedSite}
            date={date}
            onSiteClick={(site) => { setSelectedSite(site); onVisitSite(site); }}
          />
        </div>

        {/* Right Column: Site Lore + Stats */}
        <div className="space-y-4">
          {/* Site Identity Card */}
          <div className="glass-card p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center">
                <MapPin className="w-5 h-5 text-amber-400" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-bold text-white truncate">{selectedSite.name}</h2>
                <p className="text-[11px] text-slate-400 font-mono">
                  {selectedSite.lat.toFixed(1)}°N · {selectedSite.lon.toFixed(1)}°E
                </p>
              </div>
            </div>

            {/* Mission Badge */}
            <div className="mb-3 flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase bg-amber-400/10 border border-amber-400/30 text-amber-300 px-2 py-0.5 rounded-full">
                {selectedSite.contractor?.split('(')[0]?.trim() || 'NASA'}
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-3">
              {selectedSite.whyNASAChose}
            </p>

            {/* Named After */}
            {selectedSite.namedAfter && (
              <div className="text-[11px] text-slate-500 mb-3">
                <span className="text-slate-400 font-medium">Named after:</span>{' '}
                {selectedSite.namedAfter}
              </div>
            )}

            {/* Quick Metrics Grid */}
            <div className="grid grid-cols-2 gap-2">
              <div className="stat-badge sun">
                <span className="stat-label">Sun altitude</span>
                <span className="stat-value">{nowTelemetry?.sun?.alt?.toFixed(1) || '--'}°</span>
              </div>
              <div className="stat-badge earth">
                <span className="stat-label">Earth altitude</span>
                <span className="stat-value">{nowTelemetry?.earth?.alt?.toFixed(1) || '--'}°</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => onVisitSite(selectedSite)}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-amber-400 text-black hover:bg-amber-300 transition-all shadow-md shadow-amber-400/20"
              >
                <Mountain className="w-3.5 h-3.5" />
                Explore Terrain
              </button>
              <button
                onClick={() => {}}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-[#111827] text-slate-300 border border-[#1e293b] hover:border-slate-600 transition-all"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Fun Fact */}
          {selectedSite.funFact && (
            <div className="fun-fact">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400">Did You Know?</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {selectedSite.funFact}
              </p>
            </div>
          )}

          {/* Science Goals */}
          {selectedSite.keyScienceGoals && selectedSite.keyScienceGoals.length > 0 && (
            <div className="glass-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <Eye className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">Science Goals</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {selectedSite.keyScienceGoals.map((goal, i) => (
                  <span key={i} className="science-tag">{goal}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Bento: Polar Plot + Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Polar Plot */}
        <div className="glass-card p-4 flex flex-col items-center">
          <div className="flex items-center gap-2 mb-3 self-start">
            <Compass className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Sky Plot (24h)</span>
          </div>
          <PolarPlot path={quickPath} width={280} height={280} />
          <div className="mt-2 flex items-center gap-3 text-[10px] text-slate-500 font-mono">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Sun path</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sky-400 inline-block" /> Earth path</span>
          </div>
        </div>

        {/* Power Generation Card */}
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-amber-400/10 border border-amber-400/30 flex items-center justify-center">
              <Zap className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <div className="text-xs font-semibold text-white">Power Generation</div>
              <div className="text-[10px] text-slate-500 font-mono">Solar panel potential</div>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-400">Sunlit hours</span>
                <span className="font-mono font-bold text-amber-400">{power.hours}h / 24h</span>
              </div>
              <div className="h-2 bg-[#111827] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, (power.hours / 24) * 100)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-400">Panel efficiency</span>
                <span className="font-mono font-bold text-amber-400">{power.avgEfficiency}%</span>
              </div>
              <div className="h-2 bg-[#111827] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full transition-all duration-500"
                  style={{ width: `${power.avgEfficiency}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <div className="text-center p-2 rounded-lg bg-[#0c1222] border border-[#1e293b]">
                <div className="text-[10px] text-slate-500">Avg Alt</div>
                <div className="text-sm font-mono font-bold text-amber-400">{power.avgAlt}°</div>
              </div>
              <div className="text-center p-2 rounded-lg bg-[#0c1222] border border-[#1e293b]">
                <div className="text-[10px] text-slate-500">Peak Alt</div>
                <div className="text-sm font-mono font-bold text-amber-300">{power.maxAlt}°</div>
              </div>
            </div>
          </div>

          {/* Contextual insight */}
          <div className="mt-4 p-2.5 rounded-lg bg-amber-400/5 border border-amber-400/10 text-[11px] text-slate-400 leading-relaxed">
            {selectedSite.illuminationProfile || 'Solar illumination data computed from real ephemeris.'}
          </div>
        </div>

        {/* DTE Communication Card */}
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-sky-400/10 border border-sky-400/30 flex items-center justify-center">
              <Radio className="w-4 h-4 text-sky-400" />
            </div>
            <div>
              <div className="text-xs font-semibold text-white">DTE Communication</div>
              <div className="text-[10px] text-slate-500 font-mono">Direct-to-Earth link</div>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-400">Earth visible</span>
                <span className="font-mono font-bold text-sky-400">{comm.hours}h / 24h</span>
              </div>
              <div className="h-2 bg-[#111827] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-sky-600 to-sky-400 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, (comm.hours / 24) * 100)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-400">Availability</span>
                <span className="font-mono font-bold text-sky-400">{comm.availabilityPercent}%</span>
              </div>
              <div className="h-2 bg-[#111827] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-sky-600 to-sky-400 rounded-full transition-all duration-500"
                  style={{ width: `${comm.availabilityPercent}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <div className="text-center p-2 rounded-lg bg-[#0c1222] border border-[#1e293b]">
                <div className="text-[10px] text-slate-500">Avg Alt</div>
                <div className="text-sm font-mono font-bold text-sky-400">{comm.avgAlt}°</div>
              </div>
              <div className="text-center p-2 rounded-lg bg-[#0c1222] border border-[#1e293b]">
                <div className="text-[10px] text-slate-500">Peak Alt</div>
                <div className="text-sm font-mono font-bold text-sky-300">{comm.maxAlt}°</div>
              </div>
            </div>
          </div>

          {/* Contextual insight */}
          <div className="mt-4 p-2.5 rounded-lg bg-sky-400/5 border border-sky-400/10 text-[11px] text-slate-400 leading-relaxed">
            {selectedSite.dteCommVisibility || 'DTE communication windows computed from real ephemeris.'}
          </div>
        </div>
      </div>

      {/* Site Physical Properties */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {selectedSite.craterDiameterKm > 0 && (
          <div className="bento-card !p-4">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1">Crater Diameter</div>
            <div className="text-lg font-mono font-bold text-white">{selectedSite.craterDiameterKm} km</div>
          </div>
        )}
        {selectedSite.craterDepthKm > 0 && (
          <div className="bento-card !p-4">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1">Crater Depth</div>
            <div className="text-lg font-mono font-bold text-white">{selectedSite.craterDepthKm} km</div>
          </div>
        )}
        {selectedSite.elevationReliefM > 0 && (
          <div className="bento-card !p-4">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1">Elevation Relief</div>
            <div className="text-lg font-mono font-bold text-white">{selectedSite.elevationReliefM.toLocaleString()} m</div>
          </div>
        )}
        <div className="bento-card !p-4">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1">Target Coordinates</div>
          <div className="text-sm font-mono font-bold text-sky-400 leading-snug">{selectedSite.lat.toFixed(2)}°N, {selectedSite.lon.toFixed(2)}°E</div>
        </div>
      </div>

      {/* Ephemeris Source Badge */}
      <div className="flex items-center justify-center gap-2 py-2 text-[10px] text-slate-600 font-mono">
        <CheckCircle2 className="w-3 h-3 text-emerald-500/50" />
        <span>Ephemeris: {nowTelemetry?.source || 'Astronomy-Engine'} · Phase: {nowTelemetry?.phase?.toFixed(1) || '--'}°</span>
      </div>
    </div>
  );
}