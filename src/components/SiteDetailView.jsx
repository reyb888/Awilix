// src/components/SiteDetailView.jsx
// Classy Blue & Silver Telemetry and Science Detail View
// Real NASA ephemeris calculations, interactive Recharts time series, and verified site facts.

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
  Award,
  ChevronRight,
  Mountain,
  MapPin,
  ShieldCheck
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
    <div className="space-y-6 animate-fade-in pb-10">
      {/* ── Top Summary Header ─────────────────────────── */}
      <div className="bento-plate p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="telemetry-chip sun text-xs">
              {site.lat.toFixed(1)}°S · {site.lon.toFixed(1)}°E
            </span>
            <span className="text-[11px] font-mono text-[var(--ink-mute)]">
              {site.mission}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold font-sans text-[var(--ink)] mt-1">
            {site.name}
          </h1>
          <p className="text-xs text-[var(--ink-mute)] mt-0.5">
            Named after: {site.namedAfter}
          </p>
        </div>

        <button
          onClick={onVisitTerrain}
          className="btn-primary text-xs"
        >
          <Mountain className="w-3.5 h-3.5" />
          <span>Launch 3D Terrain Altimetry</span>
        </button>
      </div>

      {/* ── Row 1: KPI Metric Plates ───────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Solar Generation Span */}
        <div className="bento-plate p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--ink-soft)] flex items-center gap-1.5">
              <Sun className="w-4 h-4 text-[var(--coral)]" />
              Solar Span ({timeWindow})
            </span>
            <span className="telemetry-chip sun text-[10px]">Active</span>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold font-mono text-[var(--coral)]">
              {power.hours}h
            </div>
            <div className="text-[11px] font-mono text-[var(--ink-mute)] mt-1 flex justify-between">
              <span>Avg Alt: <strong className="text-[var(--ink)]">{power.avgAlt}°</strong></span>
              <span>Peak: <strong className="text-[var(--ink)]">{power.maxAlt}°</strong></span>
            </div>
          </div>
          <div className="w-full bg-[var(--paper-dark)] h-1.5 rounded-full overflow-hidden mt-3">
            <div
              className="bg-[var(--coral)] h-full rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, (power.hours / (timeRange || 24)) * 100)}%` }}
            />
          </div>
        </div>

        {/* DTE Comm Window */}
        <div className="bento-plate p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--ink-soft)] flex items-center gap-1.5">
              <Radio className="w-4 h-4 text-[var(--mustard)]" />
              DTE Comm Window
            </span>
            <span className="telemetry-chip earth text-[10px]">DSN Link</span>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold font-mono text-[var(--mustard)]">
              {comm.hours}h
            </div>
            <div className="text-[11px] font-mono text-[var(--ink-mute)] mt-1 flex justify-between">
              <span>Avg Alt: <strong className="text-[var(--ink)]">{comm.avgAlt}°</strong></span>
              <span>Uptime: <strong className="text-[var(--ink)]">{comm.availabilityPercent}%</strong></span>
            </div>
          </div>
          <div className="w-full bg-[var(--paper-dark)] h-1.5 rounded-full overflow-hidden mt-3">
            <div
              className="bg-[var(--mustard)] h-full rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, comm.availabilityPercent)}%` }}
            />
          </div>
        </div>

        {/* Topographic Relief */}
        <div className="bento-plate p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--ink-soft)] flex items-center gap-1.5">
              <Mountain className="w-4 h-4 text-[var(--olive)]" />
              Topographic Relief
            </span>
            <span className="text-[10px] font-mono text-[var(--ink-faint)]">NASA LOLA</span>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold font-mono text-[var(--ink)]">
              {site.elevationReliefM.toLocaleString()} m
            </div>
            <div className="text-[11px] font-mono text-[var(--ink-mute)] mt-1 flex justify-between">
              <span>Diameter: <strong className="text-[var(--ink)]">{site.craterDiameterKm} km</strong></span>
              <span>Depth: <strong className="text-[var(--ink)]">{site.craterDepthKm} km</strong></span>
            </div>
          </div>
          <div className="text-[11px] text-[var(--ink-faint)] mt-3 truncate font-mono">
            {site.surfaceSlopeClass}
          </div>
        </div>

        {/* Target Region */}
        <div className="bento-plate p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--ink-soft)] flex items-center gap-1.5">
              <Award className="w-4 h-4 text-[var(--coral)]" />
              Mission Target
            </span>
            <span className="text-[10px] font-mono text-[var(--coral)]">CLPS Program</span>
          </div>
          <div className="mt-3">
            <div className="text-sm font-bold text-[var(--ink)] truncate">
              {site.mission?.split('(')[0]?.trim()}
            </div>
            <div className="text-[11px] font-mono text-[var(--ink-mute)] mt-1">
              Contractor: <strong className="text-[var(--ink)]">{site.contractor}</strong>
            </div>
          </div>
          <div className="text-[11px] text-[var(--ink-faint)] mt-3 truncate font-mono">
            {site.targetRegion}
          </div>
        </div>
      </div>

      {/* ── Row 2: Recharts Ephemeris Trajectory Plot ───── */}
      <div className="bento-plate p-5 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[var(--line-soft)] pb-4">
          <div>
            <h2 className="text-base font-bold text-[var(--ink)] flex items-center gap-2">
              <Sun className="w-4 h-4 text-[var(--coral)]" />
              Sun & Earth Elevation vs Horizon Over Time
            </h2>
            <p className="text-xs text-[var(--ink-mute)] font-sans">
              Red dashed line denotes 0° local lunar horizon. Values above 0° enable solar conversion and direct Earth sightline.
            </p>
          </div>

          <div className="flex items-center bg-[var(--paper-dark)] p-0.5 rounded-lg border border-[var(--line-soft)]">
            {[
              { id: '24h', label: '24h', hours: 24 },
              { id: '48h', label: '48h', hours: 48 },
              { id: '7d', label: '7d', hours: 168 },
              { id: '14d', label: '14d', hours: 336 },
              { id: 'month', label: '29.5d', hours: 708 },
            ].map((tw) => (
              <button
                key={tw.id}
                onClick={() => {
                  setTimeRange(tw.hours);
                  if (setTimeWindow) setTimeWindow(tw.id);
                }}
                className={`px-2.5 py-1 rounded text-xs font-mono transition-colors ${timeRange === tw.hours
                    ? 'bg-[var(--coral)] text-[#120e07] font-semibold'
                    : 'text-[var(--ink-mute)] hover:text-white'
                  }`}
              >
                {tw.label}
              </button>
            ))}
          </div>
        </div>

        {/* Interactive Line Chart */}
        <div className="h-[320px] w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              onMouseMove={(e) => {
                if (e && e.activeTooltipIndex !== undefined) {
                  setHoverIndex(e.activeTooltipIndex);
                }
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(238, 241, 247, 0.08)" />
              <XAxis
                dataKey="label"
                stroke="#667085"
                fontSize={10}
                tickLine={false}
                minTickGap={30}
              />
              <YAxis
                stroke="#667085"
                fontSize={10}
                tickLine={false}
                domain={[-15, 45]}
                tickFormatter={(v) => `${v}°`}
              />
              <ReferenceLine
                y={0}
                stroke="#ef4444"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{ value: '0° Horizon', fill: '#ef4444', fontSize: 10, position: 'right' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0a0e17',
                  borderColor: 'rgba(238, 241, 247, 0.16)',
                  borderRadius: '10px',
                  fontSize: '11px',
                  color: '#eef1f7',
                }}
                formatter={(val, name) => [
                  `${val}°`,
                  name === 'sunAlt' ? 'Sun Elevation' : 'Earth Elevation',
                ]}
              />
              <Line
                type="monotone"
                dataKey="sunAlt"
                stroke="#ffab5e"
                strokeWidth={2.4}
                dot={false}
                name="sunAlt"
              />
              <Line
                type="monotone"
                dataKey="earthAlt"
                stroke="#8fd3e8"
                strokeWidth={2.4}
                dot={false}
                name="earthAlt"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Live Hover Scrubber Strip */}
        <div className="bg-[var(--paper-dark)] border border-[var(--line-soft)] rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-[var(--ink-mute)]" />
            <span className="text-[var(--ink)] font-bold">{activePoint.label || '00:00 UTC'}</span>
          </div>

          <div className="flex items-center gap-5">
            <div>
              <span className="text-[var(--ink-faint)] text-[10px] block">Sun Vector:</span>
              <span className="text-[var(--coral)] font-bold">
                {activePoint.sunAlt}° alt · {activePoint.sunAz}° az
              </span>
            </div>

            <div>
              <span className="text-[var(--ink-faint)] text-[10px] block">Earth Vector:</span>
              <span className="text-[var(--mustard)] font-bold">
                {activePoint.earthAlt}° alt · {activePoint.earthAz}° az
              </span>
            </div>

            <div>
              <span className="text-[var(--ink-faint)] text-[10px] block">Solar Incidence:</span>
              <span className="text-[var(--ink)] font-bold">{activePoint.powerEfficiency}%</span>
            </div>

            <div>
              <span className="text-[var(--ink-faint)] text-[10px] block">Direct Comm Link:</span>
              <span className={`font-bold ${activePoint.commActive ? 'text-[var(--emerald)]' : 'text-[var(--crimson)]'}`}>
                {activePoint.commActive ? 'ACTIVE' : 'OCCLUDED'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Row 3: Science Lore & Mission Goals ────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Why NASA Chose Site */}
        <div className="bento-plate p-5 space-y-3">
          <h3 className="font-bold text-[var(--ink)] text-sm flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[var(--coral)]" />
            Why NASA Chose This Candidate Site
          </h3>
          <p className="text-xs text-[var(--ink-soft)] leading-relaxed">
            {site.whyNASAChose}
          </p>

          <div className="bg-[var(--paper-dark)] border border-[var(--line-soft)] rounded-xl p-3.5 space-y-1 mt-2">
            <span className="text-[var(--coral)] font-semibold text-xs flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5" /> Historical Lore
            </span>
            <p className="text-xs text-[var(--ink-mute)] italic leading-relaxed">
              "{site.funFact}"
            </p>
          </div>
        </div>

        {/* Science Payload & Objectives */}
        <div className="bento-plate p-5 space-y-3">
          <h3 className="font-bold text-[var(--ink)] text-sm flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[var(--mustard)]" />
            Primary Mission Objectives & Science Payloads
          </h3>
          <ul className="space-y-2 text-xs text-[var(--ink-soft)]">
            {site.keyScienceGoals?.map((goal, i) => (
              <li key={i} className="flex items-start gap-2">
                <ChevronRight className="w-3.5 h-3.5 text-[var(--coral)] flex-shrink-0 mt-0.5" />
                <span>{goal}</span>
              </li>
            ))}
          </ul>

          <div className="pt-3 border-t border-[var(--line-soft)] flex items-center justify-between text-xs font-mono">
            <span className="text-[var(--ink-faint)]">Target Contractor:</span>
            <span className="text-[var(--ink)] font-semibold">{site.contractor}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
