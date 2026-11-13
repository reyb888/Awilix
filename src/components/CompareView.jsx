// src/components/CompareView.jsx
// Multi-Site South Pole Comparison Matrix
// Analyzes all 6 South Pole candidate landing sites side-by-side with real astronomical telemetry.

import { useState, useMemo, useEffect, useRef } from 'react';
import sites from '../data/sites.json';
import { useScience } from './ScienceProvider.jsx';
import ScenarioLab from './ScenarioLab.jsx';
import { coordinateText } from '../lib/mascotKnowledge.js';
import gsap from 'gsap';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  GitCompare,
  Sun,
  Radio,
  CheckSquare,
  Square,
  Mountain,
  ArrowRight,
  Sparkles,
  Trophy,
  Compass,
  ArrowUpDown,
  Droplets,
  Info
} from 'lucide-react';

export default function CompareView({ date, setTimeWindow, pins, onChangePins, onSelectSite, onVisitTerrain }) {
  const science = useScience();
  const timeRange = science.hours;
  const [selectedIds, setSelectedIds] = useState(sites.map((s) => s.id));
  const [sortBy, setSortBy] = useState('sun'); // 'sun' | 'comm' | 'relief'

  const containerRef = useRef(null);
  const tableRef = useRef(null);
  const cardsRef = useRef(null);

  // GSAP Entrance & Scroll Animation
  useEffect(() => {
    if (cardsRef.current) {
      gsap.fromTo(
        cardsRef.current.children,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, stagger: 0.1, duration: 0.5, ease: 'power2.out' }
      );
    }
    if (tableRef.current) {
      gsap.fromTo(
        tableRef.current.querySelectorAll('tbody tr'),
        { opacity: 0, x: -10 },
        { opacity: 1, x: 0, stagger: 0.06, duration: 0.4, ease: 'power2.out', delay: 0.2 }
      );
    }
  }, [selectedIds, sortBy]);

  // Toggle individual site
  const toggleSite = (id) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 1) return prev;
        return prev.filter((item) => item !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const selectAll = () => setSelectedIds(sites.map((s) => s.id));

  // Compute ephemeris metrics for selected sites
  const comparisonData = useMemo(() => {
    const raw = sites
      .filter((s) => selectedIds.includes(s.id) && science.byId[s.id])
      .map((site) => {
        const { power, comm } = science.byId[site.id];

        // Specific badge tag for learning
        let highlightTag = 'Candidate Base';
        if (site.id === 'shackleton-rim') highlightTag = '☀️ Near-Constant Light';
        else if (site.id === 'shackleton-ridge') highlightTag = '⚡ Power Hub Ridge';
        else if (site.id === 'mons-mouton') highlightTag = '🚀 Smooth Rover Plateau';
        else if (site.id === 'malapert-a') highlightTag = '📡 High Earth Signal';
        else if (site.id === 'nobile') highlightTag = '🧊 Extreme Cold & Ice';
        else if (site.id === 'south-pole') highlightTag = '🌐 True South Pole';

        return {
          id: site.id,
          name: site.name,
          shortName: ({
            'shackleton-rim': 'Shack. Rim',
            'shackleton-ridge': 'Shack. Ridge',
            'mons-mouton': 'Mouton',
            'south-pole': 'S. Pole',
            'malapert-a': 'Malapert',
            'nobile': 'Nobile',
          })[site.id] || site.name.split(' ')[0],
          lat: site.lat,
          lon: site.lon,
          mission: site.mission,
          contractor: site.contractor,
          elevationReliefM: site.elevationReliefM || 4000,
          surfaceSlopeClass: site.surfaceSlopeClass,
          waterIcePotential: site.waterIcePotential,
          whyNASAChose: site.whyNASAChose,
          highlightTag,
          powerHours: power.hours,
          sunAvgAlt: power.avgAlt,
          commHours: comm.hours,
          commPercent: comm.availabilityPercent,
          earthAvgAlt: comm.avgAlt,
        };
      });

    // Sorting
    return raw.sort((a, b) => {
      if (sortBy === 'sun') return b.powerHours - a.powerHours;
      if (sortBy === 'comm') return b.commHours - a.commHours;
      if (sortBy === 'relief') return b.elevationReliefM - a.elevationReliefM;
      return 0;
    });
  }, [selectedIds, science.byId, sortBy]);

  // Leaders
  const maxSun = useMemo(() => {
    return comparisonData.reduce((prev, curr) => (curr.powerHours > prev.powerHours ? curr : prev), comparisonData[0] || {});
  }, [comparisonData]);

  const maxComm = useMemo(() => {
    return comparisonData.reduce((prev, curr) => (curr.commHours > prev.commHours ? curr : prev), comparisonData[0] || {});
  }, [comparisonData]);

  return (
    <div ref={containerRef} className="space-y-6 pb-12 animate-fade-in">
      {/* ── Top Header & Site Selection Bar ────────────── */}
      <div className="bento-plate p-5 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[var(--line-soft)] pb-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold font-sans text-[var(--ink)] flex items-center gap-2">
              <GitCompare className="w-5 h-5 text-[var(--coral)]" />
              Compare South Pole Landing Sites
            </h1>
            <p className="text-xs text-[var(--ink-mute)] font-sans mt-0.5">
              Side-by-side comparison of sunlight duration, direct radio contact with Earth, and terrain elevations.
            </p>
          </div>

          <div className="flex items-center bg-[var(--paper-dark)] p-0.5 rounded-lg border border-[var(--line-soft)]">
            <button
              onClick={() => setTimeWindow('24h')}
              className={`px-3 py-1 rounded text-xs font-mono transition-colors cursor-pointer ${
                timeRange === 24
                  ? 'bg-[var(--coral)] text-[#120e07] font-semibold'
                  : 'text-[var(--ink-mute)] hover:text-white'
              }`}
            >
              24-Hour Day
            </button>
            <button
              onClick={() => setTimeWindow('7d')}
              className={`px-3 py-1 rounded text-xs font-mono transition-colors cursor-pointer ${
                timeRange === 168
                  ? 'bg-[var(--coral)] text-[#120e07] font-semibold'
                  : 'text-[var(--ink-mute)] hover:text-white'
              }`}
            >
              7-Day Mission
            </button>
          </div>
        </div>

        {/* Site Toggles */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            onClick={selectAll}
            className="text-xs text-[var(--coral)] hover:underline font-mono mr-2 cursor-pointer"
          >
            Select All ({sites.length})
          </button>

          {sites.map((s) => {
            const isChecked = selectedIds.includes(s.id);
            return (
              <button
                key={s.id}
                onClick={() => toggleSite(s.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-sans transition-colors border cursor-pointer ${
                  isChecked
                    ? 'bg-[var(--bone)] border-[var(--line)] text-[var(--ink)] shadow-sm'
                    : 'bg-transparent border-transparent text-[var(--ink-faint)] hover:text-[var(--ink)]'
                }`}
              >
                {isChecked ? <CheckSquare className="w-3.5 h-3.5 text-[var(--coral)]" /> : <Square className="w-3.5 h-3.5 text-[var(--ink-faint)]" />}
                <span>{s.id === 'shackleton-rim' ? 'Shackleton Rim' : s.id === 'shackleton-ridge' ? 'Shackleton Ridge' : s.name.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Interactive Date & Delay Comparison ─────────── */}
      <ScenarioLab pins={pins} setPins={onChangePins} />

      {/* ── Top Leaderboard Cards ──────────────────────── */}
      <div ref={cardsRef} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Illumination Leader */}
        <div className="bento-plate p-4 flex items-center justify-between hover:border-[var(--coral)] transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[rgba(234,193,139,0.12)] border border-[rgba(234,193,139,0.3)] flex items-center justify-center">
              <Sun className="w-6 h-6 text-[var(--coral)]" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase text-[var(--coral)] font-semibold flex items-center gap-1">
                <Trophy className="w-3 h-3" /> Most Sunlight ({timeRange}h)
              </span>
              <h3 className="text-base font-bold text-[var(--ink)] font-sans">{maxSun?.name}</h3>
              <p className="text-xs text-[var(--ink-mute)]">{maxSun?.highlightTag}</p>
            </div>
          </div>
          <div className="text-right font-mono">
            <div className="text-2xl font-extrabold text-[var(--coral)]">{maxSun?.powerHours}h</div>
            <div className="text-[11px] text-[var(--ink-mute)]">Average height: {maxSun?.sunAvgAlt}°</div>
          </div>
        </div>

        {/* Earth Contact Leader */}
        <div className="bento-plate p-4 flex items-center justify-between hover:border-[var(--mustard)] transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[rgba(145,198,212,0.12)] border border-[rgba(145,198,212,0.3)] flex items-center justify-center">
              <Radio className="w-6 h-6 text-[var(--mustard)]" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase text-[var(--mustard)] font-semibold flex items-center gap-1">
                <Trophy className="w-3 h-3" /> Best Earth Radio Signal ({timeRange}h)
              </span>
              <h3 className="text-base font-bold text-[var(--ink)] font-sans">{maxComm?.name}</h3>
              <p className="text-xs text-[var(--ink-mute)]">{maxComm?.highlightTag}</p>
            </div>
          </div>
          <div className="text-right font-mono">
            <div className="text-2xl font-extrabold text-[var(--mustard)]">{maxComm?.commHours}h</div>
            <div className="text-[11px] text-[var(--ink-mute)]">{maxComm?.commPercent}% direct coverage</div>
          </div>
        </div>
      </div>

      {/* ── Comparative Bar Chart ──────────────────────── */}
      <div className="bento-plate p-5 space-y-4" data-guide="comparison-chart">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-[var(--ink)] font-sans">
              Solar Sunlight vs Earth Contact Window
            </h3>
            <p className="text-xs text-[var(--ink-mute)] font-sans">
              Compares hours of sunlight (for electricity) and hours of direct Earth line-of-sight (for communications)
            </p>
          </div>
          <span className="text-[11px] font-mono text-[var(--ink-faint)]">
            {date} · {timeRange}h window
          </span>
        </div>

        <div className="h-[280px] w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={comparisonData} margin={{ top: 10, right: 10, left: -10, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(238, 241, 247, 0.08)" />
              <XAxis dataKey="shortName" stroke="#93a1ab" fontSize={11} interval={0} angle={-15} textAnchor="end" />
              <YAxis stroke="#93a1ab" fontSize={11} unit="h" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#111820',
                  borderColor: 'rgba(238, 241, 247, 0.16)',
                  borderRadius: '10px',
                  fontSize: '11px',
                  color: '#eeeae1',
                }}
                formatter={(val, name) => [`${val} hours`, name]}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
              <Bar dataKey="powerHours" name="Sunlight Hours" fill="#eac18b" radius={[4, 4, 0, 0]} />
              <Bar dataKey="commHours" name="Earth Contact Hours" fill="#91c6d4" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Greatly Improved Comparison Matrix Table ───────────── */}
      <div ref={tableRef} className="bento-plate overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-[var(--line-soft)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-[var(--ink)] font-sans flex items-center gap-2">
              <span>Site Comparison Matrix</span>
              <span className="text-xs font-normal text-[var(--ink-mute)]">({comparisonData.length} Sites)</span>
            </h3>
            <p className="text-xs text-[var(--ink-mute)]">
              Compare daylight, radio links, and mountain heights to find the ideal landing location.
            </p>
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--ink-mute)] flex items-center gap-1">
              <ArrowUpDown className="w-3.5 h-3.5 text-[var(--coral)]" /> Sort:
            </span>
            <div className="flex items-center bg-[var(--paper-dark)] p-0.5 rounded-lg border border-[var(--line-soft)] text-xs">
              <button
                onClick={() => setSortBy('sun')}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                  sortBy === 'sun' ? 'bg-[var(--coral)] text-[#120e07] font-semibold' : 'text-[var(--ink-mute)] hover:text-white'
                }`}
              >
                Most Sun
              </button>
              <button
                onClick={() => setSortBy('comm')}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                  sortBy === 'comm' ? 'bg-[var(--mustard)] text-[#120e07] font-semibold' : 'text-[var(--ink-mute)] hover:text-white'
                }`}
              >
                Best Signal
              </button>
              <button
                onClick={() => setSortBy('relief')}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                  sortBy === 'relief' ? 'bg-white/20 text-white font-semibold' : 'text-[var(--ink-mute)] hover:text-white'
                }`}
              >
                High Mountains
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[var(--paper-dark)] text-[var(--ink-faint)] font-sans text-[11px] uppercase border-b border-[var(--line-soft)]">
              <tr>
                <th className="py-3 px-4 font-semibold">Landing Site</th>
                <th className="py-3 px-4 font-semibold text-[var(--coral)]">Sunlight & Power ({timeRange}h)</th>
                <th className="py-3 px-4 font-semibold text-[var(--mustard)]">Earth Radio Link ({timeRange}h)</th>
                <th className="py-3 px-4 font-semibold">Mountain / Crater Depth</th>
                <th className="py-3 px-4 font-semibold">Water Ice Likelihood</th>
                <th className="py-3 px-4 font-semibold text-right">Explore</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line-faint)]">
              {comparisonData.map((s) => {
                const sunPercent = Math.min(100, Math.round((s.powerHours / timeRange) * 100));
                return (
                  <tr key={s.id} className="hover:bg-white/[0.04] transition-colors">
                    {/* Site Name & Region */}
                    <td className="py-4 px-4 font-sans">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[var(--ink)]">{s.name}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[rgba(238,241,247,0.06)] border border-[var(--line-soft)] text-[var(--coral)]">
                          {s.highlightTag}
                        </span>
                      </div>
                      <div className="text-[11px] text-[var(--ink-mute)] font-mono mt-0.5">
                        {coordinateText(s)}
                      </div>
                    </td>

                    {/* Sunlight & Power with visual progress bar */}
                    <td className="py-4 px-4 font-mono">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-base font-bold text-[var(--coral)]">{s.powerHours}h</span>
                        <span className="text-[11px] text-[var(--ink-mute)]">({sunPercent}%)</span>
                      </div>
                      <div className="w-32 bg-[var(--paper-dark)] h-1.5 rounded-full overflow-hidden mt-1.5">
                        <div
                          className="bg-[var(--coral)] h-full rounded-full transition-all duration-300"
                          style={{ width: `${sunPercent}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-[var(--ink-faint)] mt-1">
                        Peak elevation: {s.sunAvgAlt}° above rim
                      </div>
                    </td>

                    {/* Direct Earth Contact */}
                    <td className="py-4 px-4 font-mono">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-base font-bold text-[var(--mustard)]">{s.commHours}h</span>
                        <span className="text-[11px] text-[var(--ink-mute)]">({s.commPercent}%)</span>
                      </div>
                      <div className="w-32 bg-[var(--paper-dark)] h-1.5 rounded-full overflow-hidden mt-1.5">
                        <div
                          className="bg-[var(--mustard)] h-full rounded-full transition-all duration-300"
                          style={{ width: `${s.commPercent}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-[var(--ink-faint)] mt-1">
                        Direct antenna connection
                      </div>
                    </td>

                    {/* Elevation Relief */}
                    <td className="py-4 px-4">
                      <div className="text-sm font-bold font-mono text-[var(--ink)]">
                        {s.elevationReliefM.toLocaleString()} meters
                      </div>
                      <div className="text-[10px] text-[var(--ink-mute)]">
                        {s.elevationReliefM > 4000 ? 'High towering peak' : s.elevationReliefM > 2000 ? 'Elevated plateau' : 'Low rolling slopes'}
                      </div>
                    </td>

                    {/* Water Ice Potential */}
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-1.5">
                        <Droplets className="w-3.5 h-3.5 text-[var(--mustard)] flex-shrink-0" />
                        <span className="text-xs text-[var(--ink-soft)] font-sans">
                          {s.waterIcePotential?.split('(')[0]?.trim() || 'Cold-trap deposits'}
                        </span>
                      </div>
                    </td>

                    {/* Action Buttons */}
                    <td className="py-4 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => onVisitTerrain(sites.find((item) => item.id === s.id))}
                          className="btn-primary text-xs py-1 px-2.5"
                          title="Open 3D Lunar Terrain"
                        >
                          <Mountain className="w-3 h-3" />
                          <span>3D Terrain</span>
                        </button>
                        <button
                          onClick={() => onSelectSite(sites.find((item) => item.id === s.id))}
                          className="btn-ghost text-xs py-1 px-2.5"
                          title="View Telemetry"
                        >
                          Telemetry
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Plain-English Learning Insights ──────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bento-plate p-4 space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-bold text-[var(--coral)]">
            <Sun className="w-4 h-4" />
            <span>Why Sunlight Hours Matter</span>
          </div>
          <p className="text-xs text-[var(--ink-mute)] leading-relaxed">
            The Moon has no atmosphere to scatter light. Solar panels only generate electricity when they have direct line-of-sight to the Sun. Sites with 80%+ sunlight provide continuous power without requiring large batteries.
          </p>
        </div>

        <div className="bento-plate p-4 space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-bold text-[var(--mustard)]">
            <Radio className="w-4 h-4" />
            <span>Why Direct Earth Contact Matters</span>
          </div>
          <p className="text-xs text-[var(--ink-mute)] leading-relaxed">
            Direct-to-Earth communication lets landers send high-definition video and science telemetry straight to NASA’s Deep Space Network dishes on Earth, avoiding the delay of satellite relays.
          </p>
        </div>

        <div className="bento-plate p-4 space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-bold text-[var(--emerald)]">
            <Droplets className="w-4 h-4" />
            <span>Why the South Pole is Special</span>
          </div>
          <p className="text-xs text-[var(--ink-mute)] leading-relaxed">
            Because the Moon has almost no axial tilt (1.5°), high rims catch horizontal sunlight year-round, while deep crater floors remain in pitch darkness at -240°C, preserving billions of tons of frozen water ice!
          </p>
        </div>
      </div>
    </div>
  );
}
