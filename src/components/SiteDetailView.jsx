// src/components/SiteDetailView.jsx
import { useState, useEffect, useMemo } from 'react';
import { computePath, powerWindow, commWindow } from '../lib/ephemeris.js';
import sites from '../data/sites.json';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import {
  Sun,
  Radio,
  Zap,
  Clock,
  Compass,
  Sparkles,
  Layers,
  ThermometerSnowflake,
  ShieldAlert,
  Award,
  ChevronRight,
  Mountain,
  Globe2,
} from 'lucide-react';

export default function SiteDetailView({
  site,
  setSelectedSite,
  date,
  timeWindow = '24h',
  setTimeWindow,
  onVisitTerrain,
}) {
  const [timeRange, setTimeRange] = useState(() => {
    switch (timeWindow) {
      case '48h': return 48;
      case '7d': return 168;
      case '14d': return 336;
      case 'month': return 708;
      default: return 24;
    }
  });
  const [path, setPath] = useState([]);
  const [power, setPower] = useState({ hours: 0, avgAlt: 0, maxAlt: 0, avgEfficiency: 0 });
  const [comm, setComm] = useState({ hours: 0, avgAlt: 0, maxAlt: 0, availabilityPercent: 0 });
  const [hoverIndex, setHoverIndex] = useState(0);

  // Sync with external timeWindow prop
  useEffect(() => {
    switch (timeWindow) {
      case '24h': setTimeRange(24); break;
      case '48h': setTimeRange(48); break;
      case '7d': setTimeRange(168); break;
      case '14d': setTimeRange(336); break;
      case 'month': setTimeRange(708); break;
      default: setTimeRange(24); break;
    }
  }, [timeWindow]);

  // Compute ephemeris path over selected timeRange
  useEffect(() => {
    if (!site) return;
    const startTime = new Date(`${date}T00:00:00Z`);
    const step = timeRange <= 24 ? 60 : timeRange <= 48 ? 120 : timeRange <= 168 ? 180 : 360;
    const computed = computePath(site.lat, site.lon, startTime, timeRange, step);
    setPath(computed);
    setPower(powerWindow(computed));
    setComm(commWindow(computed));
    setHoverIndex(0);
  }, [site, date, timeRange]);

  // Chart data format
  const chartData = useMemo(() => {
    return path.map((p, idx) => {
      const dt = new Date(p.time);
      const label =
        timeRange === 24
          ? `${String(dt.getUTCHours()).padStart(2, '0')}:00`
          : `${dt.getUTCMonth() + 1}/${dt.getUTCDate()} ${String(dt.getUTCHours()).padStart(2, '0')}h`;

      return {
        idx,
        label,
        time: dt,
        sunAlt: Number(p.sun.alt.toFixed(2)),
        sunAz: Number(p.sun.az.toFixed(1)),
        earthAlt: Number(p.earth.alt.toFixed(2)),
        earthAz: Number(p.earth.az.toFixed(1)),
        powerEfficiency: Number((p.powerEfficiency * 100).toFixed(0)),
        commActive: p.commActive,
      };
    });
  }, [path, timeRange]);

  const activePoint = chartData[hoverIndex] || chartData[0] || {};

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Top Banner: Site Header & Quick Switcher */}
      <div className="bg-[#0b1329]/90 backdrop-blur-md border border-[#1e293b] rounded-2xl p-5 shadow-2xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-wide">{site.name}</h1>
            <span className="text-xs font-mono bg-amber-400/10 border border-amber-400/30 text-amber-300 px-2 py-0.5 rounded-full font-medium">
              {site.lat}°, {site.lon}°
            </span>
            <span className="text-xs font-mono bg-sky-500/10 border border-sky-500/30 text-sky-400 px-2 py-0.5 rounded-full">
              {site.mission}
            </span>
          </div>
          <p className="text-xs text-slate-300 max-w-2xl">{site.targetRegion} • {site.namedAfter}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-between lg:justify-end">
          {/* Site Selector Dropdown */}
          <select
            value={site.id}
            onChange={(e) => {
              const target = sites.find((s) => s.id === e.target.value);
              if (target) setSelectedSite(target);
            }}
            className="bg-[#070d1e] text-slate-200 text-xs border border-slate-700 rounded-xl px-3 py-2 font-medium focus:outline-none focus:border-amber-400 cursor-pointer"
          >
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.lat}°)
              </option>
            ))}
          </select>

          {/* Visit 3D Terrain Action */}
          <button
            onClick={() => onVisitTerrain(site)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-black font-semibold text-xs tracking-wide shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
          >
            <Mountain className="w-4 h-4" />
            <span>Launch 3D Terrain</span>
          </button>
        </div>
      </div>

      {/* BENTO GRID ROW 1: Hero Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Solar Illumination */}
        <div className="bg-[#070d1e]/80 border border-[#1e293b] rounded-2xl p-4 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
              <Sun className="w-4 h-4 text-amber-400" />
              Power Window
            </span>
            <span className="text-[10px] font-mono text-amber-400/80 bg-amber-400/10 px-2 py-0.5 rounded-full">
              {timeRange}h Period
            </span>
          </div>
          <div>
            <div className="text-3xl font-extrabold text-amber-400 tracking-tight">
              {power.hours}h
            </div>
            <div className="text-xs text-slate-400 mt-1 flex justify-between">
              <span>Avg Sun Alt: <strong className="text-white">{power.avgAlt}°</strong></span>
              <span>Max: <strong className="text-amber-300">{power.maxAlt}°</strong></span>
            </div>
          </div>
          <div className="w-full bg-slate-800/80 h-1.5 rounded-full overflow-hidden mt-3">
            <div
              className="bg-amber-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, (power.hours / timeRange) * 100)}%` }}
            />
          </div>
        </div>

        {/* Card 2: DTE Communications */}
        <div className="bg-[#070d1e]/80 border border-[#1e293b] rounded-2xl p-4 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
              <Radio className="w-4 h-4 text-sky-400" />
              DTE Comm Window
            </span>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
              comm.hours > 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
            }`}>
              {comm.availabilityPercent}% Uptime
            </span>
          </div>
          <div>
            <div className="text-3xl font-extrabold text-sky-400 tracking-tight">
              {comm.hours}h
            </div>
            <div className="text-xs text-slate-400 mt-1 flex justify-between">
              <span>Avg Earth Alt: <strong className="text-white">{comm.avgAlt}°</strong></span>
              <span>Status: <strong className="text-emerald-400">{comm.hours > 0 ? 'LINE OF SIGHT' : 'OCCULTED'}</strong></span>
            </div>
          </div>
          <div className="w-full bg-slate-800/80 h-1.5 rounded-full overflow-hidden mt-3">
            <div
              className="bg-sky-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, comm.availabilityPercent)}%` }}
            />
          </div>
        </div>

        {/* Card 3: Crater Dimensions */}
        <div className="bg-[#070d1e]/80 border border-[#1e293b] rounded-2xl p-4 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
              <Mountain className="w-4 h-4 text-purple-400" />
              Topography Relief
            </span>
            <span className="text-[10px] font-mono text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded-full">
              LOLA LDEM
            </span>
          </div>
          <div>
            <div className="text-3xl font-extrabold text-purple-300 tracking-tight">
              {site.elevationReliefM ? `${site.elevationReliefM.toLocaleString()} m` : '4,200 m'}
            </div>
            <div className="text-xs text-slate-400 mt-1 flex justify-between">
              <span>Diameter: <strong className="text-white">{site.craterDiameterKm} km</strong></span>
              <span>Depth: <strong className="text-white">{site.craterDepthKm} km</strong></span>
            </div>
          </div>
          <div className="text-[11px] text-slate-400 mt-2 truncate">
            {site.targetRegion}
          </div>
        </div>

        {/* Card 4: Mission Designation & Target */}
        <div className="bg-[#070d1e]/80 border border-[#1e293b] rounded-2xl p-4 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
              <Award className="w-4 h-4 text-cyan-400" />
              Mission Target
            </span>
            <span className="text-[10px] font-mono text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded-full">
              CLPS / Artemis
            </span>
          </div>
          <div>
            <div className="text-xl font-bold text-white tracking-tight truncate">
              {site.mission?.split('(')[0]?.trim() || site.mission}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Coordinates: {site.lat.toFixed(1)}°N, {site.lon.toFixed(1)}°E
            </div>
          </div>
          <div className="text-[11px] text-slate-400 mt-2 line-clamp-1">
            {site.namedAfter}
          </div>
        </div>
      </div>

      {/* BENTO GRID ROW 2: Primary Interactive Ephemeris Chart */}
      <div className="bg-[#070d1e]/90 border border-[#1e293b] rounded-2xl p-5 shadow-2xl space-y-4">
        {/* Chart Header & Controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Sun className="w-4 h-4 text-amber-400" />
              Sun & Earth Elevation Over Time
            </h2>
            <p className="text-xs text-slate-400">
              0° line denotes local lunar horizon. Sun above horizon powers solar arrays; Earth above horizon enables DTE telemetry.
            </p>
          </div>

          {/* Time Window Switcher (24h / 48h / 7d / 14d / 29.5d) */}
          <div className="flex flex-wrap items-center bg-[#0d1527] p-1 rounded-xl border border-slate-700">
            {[
              { id: '24h', label: '24 Hours', hours: 24 },
              { id: '48h', label: '48 Hours', hours: 48 },
              { id: '7d', label: '7 Days', hours: 168 },
              { id: '14d', label: '14 Days', hours: 336 },
              { id: 'month', label: '29.5d (Lunar Day)', hours: 708 },
            ].map((tw) => (
              <button
                key={tw.id}
                onClick={() => {
                  setTimeRange(tw.hours);
                  if (setTimeWindow) setTimeWindow(tw.id);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  timeRange === tw.hours
                    ? 'bg-amber-400 text-black font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tw.label}
              </button>
            ))}
          </div>
        </div>

        {/* Main Recharts Line Plot */}
        <div className="h-[340px] w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              onMouseMove={(e) => {
                if (e && e.activeTooltipIndex !== undefined) {
                  setHoverIndex(e.activeTooltipIndex);
                }
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="label"
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                minTickGap={25}
              />
              <YAxis
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                domain={[-15, 45]}
                tickFormatter={(v) => `${v}°`}
              />
              {/* 0° Local Horizon Threshold Line */}
              <ReferenceLine
                y={0}
                stroke="#ef4444"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{ value: '0° Horizon', fill: '#ef4444', fontSize: 10, position: 'right' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#070d1e',
                  borderColor: '#334155',
                  borderRadius: '0.75rem',
                  fontSize: '0.75rem',
                  color: '#f8fafc',
                }}
                formatter={(val, name) => [
                  `${val}°`,
                  name === 'sunAlt' ? 'Sun Altitude' : 'Earth Altitude',
                ]}
              />
              <Line
                type="monotone"
                dataKey="sunAlt"
                stroke="#f59e0b"
                strokeWidth={2.5}
                dot={false}
                name="sunAlt"
              />
              <Line
                type="monotone"
                dataKey="earthAlt"
                stroke="#38bdf8"
                strokeWidth={2.5}
                dot={false}
                name="earthAlt"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Live Hover Scrubber Telemetry Strip */}
        <div className="bg-[#0b1329] border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" />
            <span className="text-slate-300 font-bold">{activePoint.label || '00:00'}</span>
          </div>

          <div className="flex items-center gap-4">
            <div>
              <span className="text-slate-400 text-[10px] block">Sun Position:</span>
              <span className={`font-bold ${activePoint.sunAlt > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
                {activePoint.sunAlt}° alt, {activePoint.sunAz}° az
              </span>
            </div>

            <div>
              <span className="text-slate-400 text-[10px] block">Earth Position:</span>
              <span className={`font-bold ${activePoint.earthAlt > 0 ? 'text-sky-400' : 'text-rose-400'}`}>
                {activePoint.earthAlt}° alt, {activePoint.earthAz}° az
              </span>
            </div>

            <div>
              <span className="text-slate-400 text-[10px] block">Solar Efficiency:</span>
              <span className="text-amber-300 font-bold">{activePoint.powerEfficiency}%</span>
            </div>

            <div>
              <span className="text-slate-400 text-[10px] block">DTE Comm Link:</span>
              <span className={`font-bold ${activePoint.commActive ? 'text-emerald-400' : 'text-rose-400'}`}>
                {activePoint.commActive ? 'ACTIVE' : 'BLOCKED'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* BENTO GRID ROW 3: Science Lore, Facts, & Objectives */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Lore & Scientific Justification */}
        <div className="bg-[#070d1e]/90 border border-[#1e293b] rounded-2xl p-5 shadow-xl space-y-3">
          <h3 className="font-bold text-white text-sm flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            Why NASA Chose This Candidate Site
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            {site.whyNASAChose}
          </p>

          <div className="bg-[#0b1329] border border-slate-800 rounded-xl p-3.5 space-y-1.5 mt-2">
            <span className="text-amber-400 font-semibold text-xs flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5" />
              Fun Fact & Historical Lore
            </span>
            <p className="text-xs text-slate-300 italic">
              "{site.funFact}"
            </p>
          </div>
        </div>

        {/* Science Payload & Engineering Goals */}
        <div className="bg-[#070d1e]/90 border border-[#1e293b] rounded-2xl p-5 shadow-xl space-y-3">
          <h3 className="font-bold text-white text-sm flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-sky-400" />
            Primary Mission Objectives & Science Payloads
          </h3>
          <ul className="space-y-2 text-xs text-slate-300">
            {site.keyScienceGoals?.map((goal, i) => (
              <li key={i} className="flex items-start gap-2">
                <ChevronRight className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                <span>{goal}</span>
              </li>
            ))}
          </ul>

          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono">
            <span className="text-slate-400">Target Contractor:</span>
            <span className="text-white font-semibold">{site.contractor}</span>
          </div>
        </div>
      </div>
    </div>
  );
}