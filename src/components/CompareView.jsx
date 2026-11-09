// src/components/CompareView.jsx
// Classy Blue & Silver Multi-Site Comparison Matrix
// Analyzes all 8 candidate landing sites side-by-side with real astronomical telemetry.

import { useState, useMemo } from 'react';
import sites from '../data/sites.json';
import { useScience } from './ScienceProvider.jsx';
import ScenarioLab from './ScenarioLab.jsx';
import { coordinateText } from '../lib/mascotKnowledge.js';
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
  Compass
} from 'lucide-react';

export default function CompareView({ date, setTimeWindow, pins, onChangePins, onSelectSite, onVisitTerrain }) {
  const science=useScience();
  const timeRange=science.hours;
  const [selectedIds, setSelectedIds] = useState(sites.map((s) => s.id));


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
  const selectPolarOnly = () => setSelectedIds(sites.filter((s) => s.lat <= -80).map((s) => s.id));

  // Compute ephemeris metrics for selected sites
  const comparisonData = useMemo(() => {
    return sites
      .filter((s) => selectedIds.includes(s.id) && science.byId[s.id])
      .map((site) => {
        const {power,comm}=science.byId[site.id];

        return {
          id: site.id,
          name: site.name,
          shortName: ({'shackleton-rim':'Shack. Rim','shackleton-ridge':'Shack. Ridge','mons-mouton':'Mouton','south-pole':'S. Pole','reiner-gamma':'Reiner','mare-crisium':'Crisium','malapert-a':'Malapert','nobile':'Nobile'})[site.id],
          lat: site.lat,
          lon: site.lon,
          mission: site.mission,
          contractor: site.contractor,
          elevationReliefM: site.elevationReliefM || 4000,
          surfaceSlopeClass: site.surfaceSlopeClass,
          powerHours: power.hours,
          sunAvgAlt: power.avgAlt,
          commHours: comm.hours,
          commPercent: comm.availabilityPercent,
          earthAvgAlt: comm.avgAlt,
        };
      });
  }, [selectedIds, science.byId]);

  // Leaders
  const maxSun = useMemo(() => {
    return comparisonData.reduce((prev, curr) => (curr.powerHours > prev.powerHours ? curr : prev), comparisonData[0] || {});
  }, [comparisonData]);

  const maxComm = useMemo(() => {
    return comparisonData.reduce((prev, curr) => (curr.commHours > prev.commHours ? curr : prev), comparisonData[0] || {});
  }, [comparisonData]);

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* ── Top Header & Site Selection Bar ────────────── */}
      <div className="bento-plate p-5 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[var(--line-soft)] pb-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold font-sans text-[var(--ink)] flex items-center gap-2">
              <GitCompare className="w-5 h-5 text-[var(--coral)]" />
              Candidate Landing Sites Comparison
            </h1>
            <p className="text-xs text-[var(--ink-mute)] font-sans mt-0.5">
              Side-by-side illumination hours, direct-to-Earth communication windows, and crater relief.
            </p>
          </div>

          <div className="flex items-center bg-[var(--paper-dark)] p-0.5 rounded-lg border border-[var(--line-soft)]">
            <button
              onClick={() => setTimeWindow('24h')}
              className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
                timeRange === 24
                  ? 'bg-[var(--coral)] text-[#120e07] font-semibold'
                  : 'text-[var(--ink-mute)] hover:text-white'
              }`}
            >
              24h Window
            </button>
            <button
              onClick={() => setTimeWindow('7d')}
              className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
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
          <div className="flex items-center gap-2 mr-3 text-xs text-[var(--ink-faint)] font-mono">
            <button onClick={selectAll} className="hover:text-[var(--coral)] underline cursor-pointer">All ({sites.length})</button>
            <span>·</span>
            <button onClick={selectPolarOnly} className="hover:text-[var(--coral)] underline cursor-pointer">South Pole Only</button>
          </div>

          {sites.map((s) => {
            const isChecked = selectedIds.includes(s.id);
            return (
              <button
                key={s.id}
                onClick={() => toggleSite(s.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-sans transition-colors border cursor-pointer ${
                  isChecked
                    ? 'bg-[var(--bone)] border-[var(--line)] text-[var(--ink)] shadow-sm'
                    : 'bg-transparent border-transparent text-[var(--ink-faint)] hover:text-[var(--ink)]'
                }`}
              >
                {isChecked ? <CheckSquare className="w-3.5 h-3.5 text-[var(--coral)]" /> : <Square className="w-3.5 h-3.5" />}
                <span>{s.id==='shackleton-rim'?'Shackleton Rim':s.id==='shackleton-ridge'?'Shackleton Ridge':s.name.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>
      </div>

      <ScenarioLab pins={pins} setPins={onChangePins}/>

      {/* ── Top Leaderboard Cards ──────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Illumination Leader */}
        <div className="bento-plate p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[rgba(255,171,94,0.12)] border border-[rgba(255,171,94,0.3)] flex items-center justify-center">
              <Sun className="w-5 h-5 text-[var(--coral)]" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase text-[var(--coral)] font-semibold flex items-center gap-1">
                <Trophy className="w-3 h-3" /> Top Illumination ({timeRange}h)
              </span>
              <h4 className="text-base font-bold text-[var(--ink)] font-sans">{maxSun?.name}</h4>
              <p className="text-xs text-[var(--ink-mute)]">{maxSun?.mission}</p>
            </div>
          </div>
          <div className="text-right font-mono">
            <div className="text-2xl font-extrabold text-[var(--coral)]">{maxSun?.powerHours}h</div>
            <div className="text-[11px] text-[var(--ink-mute)]">Avg Alt: {maxSun?.sunAvgAlt}°</div>
          </div>
        </div>

        {/* DTE Comm Leader */}
        <div className="bento-plate p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[rgba(143,211,232,0.12)] border border-[rgba(143,211,232,0.3)] flex items-center justify-center">
              <Radio className="w-5 h-5 text-[var(--mustard)]" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase text-[var(--mustard)] font-semibold flex items-center gap-1">
                <Trophy className="w-3 h-3" /> Top Direct-to-Earth Comm ({timeRange}h)
              </span>
              <h4 className="text-base font-bold text-[var(--ink)] font-sans">{maxComm?.name}</h4>
              <p className="text-xs text-[var(--ink-mute)]">{maxComm?.mission}</p>
            </div>
          </div>
          <div className="text-right font-mono">
            <div className="text-2xl font-extrabold text-[var(--mustard)]">{maxComm?.commHours}h</div>
            <div className="text-[11px] text-[var(--ink-mute)]">{maxComm?.commPercent}% visible</div>
          </div>
        </div>
      </div>

      {/* ── Comparative Bar Chart ──────────────────────── */}
      <div className="bento-plate p-5 space-y-4" data-guide="comparison-chart">
        <div>
          <h3 className="text-base font-bold text-[var(--ink)] font-sans">
            Solar Daylight vs Direct-to-Earth Window Comparison
          </h3>
          <p className="text-xs text-[var(--ink-mute)] font-sans">
            Hours visible in the shared visibility model for {date} ({timeRange}h analysis window)
          </p>
        </div>

        <div className="h-[300px] w-full pt-2">
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
              <Bar dataKey="commHours" name="DTE Comm Hours" fill="#91c6d4" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Comparative Metrics Matrix Table ───────────── */}
      <div className="bento-plate overflow-hidden">
        <div className="p-4 border-b border-[var(--line-soft)]">
          <h3 className="text-base font-bold text-[var(--ink)] font-sans">Full Mission Specification Matrix</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[var(--paper-dark)] text-[var(--ink-faint)] font-mono text-[10px] uppercase border-b border-[var(--line-soft)]">
              <tr>
                <th className="py-3 px-4">Landing Site</th>
                <th className="py-3 px-4">Coordinates</th>
                <th className="py-3 px-4">Mission / Contractor</th>
                <th className="py-3 px-4 text-[var(--coral)]">Sun Hours ({timeRange}h)</th>
                <th className="py-3 px-4 text-[var(--mustard)]">DTE Comm ({timeRange}h)</th>
                <th className="py-3 px-4">Relief</th>
                <th className="py-3 px-4">Surface Grade</th>
                <th className="py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line-faint)] font-mono">
              {comparisonData.map((s) => (
                <tr key={s.id} className="hover:bg-white/[0.03] transition-colors">
                  <td className="py-3 px-4 font-bold text-[var(--ink)] font-sans">
                    {s.name}
                  </td>
                  <td className="py-3 px-4 text-[var(--ink-mute)]">
                    {coordinateText(s)}
                  </td>
                  <td className="py-3 px-4 text-[var(--ink-soft)] font-sans">
                    <div>{s.mission}</div>
                    <div className="text-[10px] text-[var(--ink-faint)]">{s.contractor}</div>
                  </td>
                  <td className="py-3 px-4 font-bold text-[var(--coral)]">
                    {s.powerHours}h <span className="text-[10px] text-[var(--ink-faint)]">({s.sunAvgAlt}°)</span>
                  </td>
                  <td className="py-3 px-4 font-bold text-[var(--mustard)]">
                    {s.commHours}h <span className="text-[10px] text-[var(--ink-faint)]">({s.commPercent}%)</span>
                  </td>
                  <td className="py-3 px-4 text-[var(--ink)]">
                    {s.elevationReliefM.toLocaleString()} m
                  </td>
                  <td className="py-3 px-4 text-[var(--ink-faint)] text-[11px] truncate max-w-[140px]">
                    {s.surfaceSlopeClass || 'Not cataloged'}
                  </td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => onVisitTerrain(sites.find((item) => item.id === s.id))}
                      className="btn-primary text-[11px] py-1 px-2.5"
                    >
                      <Mountain className="w-3 h-3" />
                      <span>3D Terrain</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
