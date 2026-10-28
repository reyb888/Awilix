// src/components/CompareView.jsx
import { useState, useMemo } from 'react';
import sites from '../data/sites.json';
import { computePath, powerWindow, commWindow } from '../lib/ephemeris.js';
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
} from 'lucide-react';

export default function CompareView({ date, onSelectSite, onVisitTerrain }) {
  const [selectedIds, setSelectedIds] = useState(sites.map((s) => s.id)); // default all selected
  const [timeRange, setTimeRange] = useState(24); // 24h or 168h (7d)

  // Toggle individual site selection
  const toggleSite = (id) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 1) return prev; // keep at least one
        return prev.filter((item) => item !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const selectAll = () => setSelectedIds(sites.map((s) => s.id));
  const selectPolarOnly = () => setSelectedIds(sites.filter((s) => s.lat <= -80).map((s) => s.id));

  // Compute metrics for each selected site
  const comparisonData = useMemo(() => {
    const startTime = new Date(`${date}T00:00:00Z`);
    const step = timeRange === 24 ? 60 : 180;

    return sites
      .filter((s) => selectedIds.includes(s.id))
      .map((site) => {
        const path = computePath(site.lat, site.lon, startTime, timeRange, step);
        const power = powerWindow(path);
        const comm = commWindow(path);

        return {
          id: site.id,
          name: site.name,
          shortName: site.name.split(' ')[0],
          lat: site.lat,
          lon: site.lon,
          mission: site.mission,
          contractor: site.contractor,
          elevationReliefM: site.elevationReliefM || 4000,
          powerHours: power.hours,
          sunAvgAlt: power.avgAlt,
          commHours: comm.hours,
          commPercent: comm.availabilityPercent,
          earthAvgAlt: comm.avgAlt,
        };
      });
  }, [selectedIds, date, timeRange]);

  // Find top winners
  const maxSun = useMemo(() => {
    return comparisonData.reduce((prev, curr) => (curr.powerHours > prev.powerHours ? curr : prev), comparisonData[0] || {});
  }, [comparisonData]);

  const maxComm = useMemo(() => {
    return comparisonData.reduce((prev, curr) => (curr.commHours > prev.commHours ? curr : prev), comparisonData[0] || {});
  }, [comparisonData]);

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header & Site Toggles Bar */}
      <div className="bg-[#0b1329]/90 backdrop-blur-md border border-[#1e293b] rounded-2xl p-5 shadow-2xl space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
              <GitCompare className="w-5 h-5 text-amber-400" />
              Candidate Landing Sites Comparison
            </h1>
            <p className="text-xs text-slate-400">
              Side-by-side illumination hours, direct-to-Earth communication windows, and crater relief.
            </p>
          </div>

          {/* Time Window Switcher */}
          <div className="flex items-center gap-2 bg-[#070d1e] p-1 rounded-xl border border-slate-700">
            <button
              onClick={() => setTimeRange(24)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                timeRange === 24 ? 'bg-amber-400 text-black font-semibold' : 'text-slate-400 hover:text-white'
              }`}
            >
              24h Window
            </button>
            <button
              onClick={() => setTimeRange(168)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                timeRange === 168 ? 'bg-amber-400 text-black font-semibold' : 'text-slate-400 hover:text-white'
              }`}
            >
              7-Day Mission
            </button>
          </div>
        </div>

        {/* Site Filter Pills */}
        <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 mr-2 text-xs text-slate-400">
            <button onClick={selectAll} className="hover:text-amber-400 underline">All ({sites.length})</button>
            <span>•</span>
            <button onClick={selectPolarOnly} className="hover:text-amber-400 underline">South Pole Only</button>
          </div>

          {sites.map((s) => {
            const isChecked = selectedIds.includes(s.id);
            return (
              <button
                key={s.id}
                onClick={() => toggleSite(s.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all border ${
                  isChecked
                    ? 'bg-amber-400/20 border-amber-400/50 text-amber-300'
                    : 'bg-[#070d1e] border-slate-800 text-slate-500 hover:border-slate-700'
                }`}
              >
                {isChecked ? <CheckSquare className="w-3 h-3 text-amber-400" /> : <Square className="w-3 h-3" />}
                <span>{s.name.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Leaderboard Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Sun Leader */}
        <div className="bg-[#070d1e]/80 border border-amber-500/30 rounded-2xl p-4 shadow-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center">
              <Sun className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase text-amber-400 font-semibold flex items-center gap-1">
                <Trophy className="w-3 h-3" /> Top Illumination Leader ({timeRange}h)
              </span>
              <h4 className="text-base font-bold text-white">{maxSun?.name}</h4>
              <p className="text-xs text-slate-400">{maxSun?.mission}</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-extrabold text-amber-400">{maxSun?.powerHours}h</div>
            <div className="text-[11px] text-slate-400">Avg Alt: {maxSun?.sunAvgAlt}°</div>
          </div>
        </div>

        {/* DTE Comm Leader */}
        <div className="bg-[#070d1e]/80 border border-sky-500/30 rounded-2xl p-4 shadow-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-400/10 border border-sky-400/30 flex items-center justify-center">
              <Radio className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase text-sky-400 font-semibold flex items-center gap-1">
                <Trophy className="w-3 h-3" /> Top Direct-to-Earth Comm ({timeRange}h)
              </span>
              <h4 className="text-base font-bold text-white">{maxComm?.name}</h4>
              <p className="text-xs text-slate-400">{maxComm?.mission}</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-extrabold text-sky-400">{maxComm?.commHours}h</div>
            <div className="text-[11px] text-slate-400">{maxComm?.commPercent}% Link Uptime</div>
          </div>
        </div>
      </div>

      {/* Comparative Bar Chart: Sunlight vs DTE Comm Hours */}
      <div className="bg-[#070d1e]/90 border border-[#1e293b] rounded-2xl p-5 shadow-2xl space-y-4">
        <div>
          <h3 className="text-base font-bold text-white">Solar Daylight vs Direct-to-Earth Window</h3>
          <p className="text-xs text-slate-400">Hours above the local horizon during {date} ({timeRange}h analysis)</p>
        </div>

        <div className="h-[320px] w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={comparisonData} margin={{ top: 10, right: 10, left: -10, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="shortName" stroke="#64748b" fontSize={11} interval={0} angle={-20} textAnchor="end" />
              <YAxis stroke="#64748b" fontSize={11} unit="h" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#070d1e',
                  borderColor: '#334155',
                  borderRadius: '0.75rem',
                  fontSize: '0.75rem',
                  color: '#f8fafc',
                }}
                formatter={(val, name) => [`${val} hours`, name === 'powerHours' ? 'Sunlight' : 'DTE Comm']}
              />
              <Legend wrapperStyle={{ fontSize: '0.75rem', paddingTop: '10px' }} />
              <Bar dataKey="powerHours" name="Sunlight Hours" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              <Bar dataKey="commHours" name="DTE Comm Hours" fill="#38bdf8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Comparative Data Matrix Table */}
      <div className="bg-[#070d1e]/90 border border-[#1e293b] rounded-2xl overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-slate-800">
          <h3 className="text-base font-bold text-white">Mission Metrics Matrix</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#0b1329] text-slate-400 font-mono text-[11px] uppercase border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Landing Site</th>
                <th className="py-3 px-4">Coordinates</th>
                <th className="py-3 px-4">Mission & Contractor</th>
                <th className="py-3 px-4 text-amber-400">Sun Hours ({timeRange}h)</th>
                <th className="py-3 px-4 text-sky-400">DTE Comm ({timeRange}h)</th>
                <th className="py-3 px-4">Elevation Relief</th>
                <th className="py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 font-mono">
              {comparisonData.map((s) => (
                <tr key={s.id} className="hover:bg-white/5 transition-colors">
                  <td className="py-3 px-4 font-bold text-white">
                    {s.name}
                  </td>
                  <td className="py-3 px-4 text-slate-400">
                    {s.lat}°, {s.lon}°
                  </td>
                  <td className="py-3 px-4 text-slate-300 font-sans text-xs">
                    <div>{s.mission}</div>
                    <div className="text-[10px] text-slate-500">{s.contractor}</div>
                  </td>
                  <td className="py-3 px-4 font-bold text-amber-400">
                    {s.powerHours}h <span className="text-[10px] text-slate-500">({s.sunAvgAlt}°)</span>
                  </td>
                  <td className="py-3 px-4 font-bold text-sky-400">
                    {s.commHours}h <span className="text-[10px] text-slate-500">({s.commPercent}%)</span>
                  </td>
                  <td className="py-3 px-4 text-purple-300">
                    {s.elevationReliefM.toLocaleString()} m
                  </td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => onVisitTerrain(sites.find((item) => item.id === s.id))}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-sans font-medium bg-amber-400/20 text-amber-300 hover:bg-amber-400 hover:text-black transition-all"
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