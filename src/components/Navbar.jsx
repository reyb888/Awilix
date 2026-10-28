// src/components/Navbar.jsx
// Main Header with Navigation Tabs, Time Window Selector, and Dropdown Calendar Date Picker.

import { useState } from 'react';
import {
  Calendar, Globe, Mountain, BarChart3, GitCompare, Bot,
  CheckCircle2, ChevronLeft, ChevronRight, Clock, Sparkles, ChevronDown
} from 'lucide-react';

const MISSION_PRESETS = [
  { label: 'Today (Live Ephemeris)', date: new Date().toISOString().split('T')[0] },
  { label: 'Artemis III (Target Sep 2026)', date: '2026-09-15' },
  { label: 'IM-1 Odysseus Landing (Feb 2024)', date: '2024-02-22' },
  { label: 'IM-2 Athena Polar Target (Feb 2025)', date: '2025-02-15' },
  { label: 'Griffin M1 Polar Launch (Nov 2026)', date: '2026-11-15' },
  { label: 'Blue Ghost M1 (Jan 2025)', date: '2025-01-20' },
  { label: 'NASA DE421 Benchmark Date', date: '2026-02-15' },
];

const TIME_WINDOWS = [
  { id: '24h', label: '24 Hours', hours: 24 },
  { id: '48h', label: '48 Hours', hours: 48 },
  { id: '7d', label: '7 Days', hours: 168 },
  { id: '14d', label: '14 Days', hours: 336 },
  { id: 'month', label: '29.5d (Lunar Day)', hours: 708 },
];

export default function Navbar({
  activeTab,
  setActiveTab,
  date,
  setDate,
  timeWindow = '24h',
  setTimeWindow,
  selectedSite,
  onOpenVerification,
}) {
  const [calendarOpen, setCalendarOpen] = useState(false);

  const handlePrevDay = () => {
    const d = new Date(date + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() - 1);
    setDate(d.toISOString().split('T')[0]);
  };

  const handleNextDay = () => {
    const d = new Date(date + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + 1);
    setDate(d.toISOString().split('T')[0]);
  };

  return (
    <header className="sticky top-0 z-50 bg-[#060a14]/95 backdrop-blur-md border-b border-[#1e293b] px-4 py-2.5">
      <div className="max-w-7xl mx-auto flex flex-col xl:flex-row items-center justify-between gap-3">
        {/* Brand & Mission Badge */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Globe className="w-5 h-5 text-black" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base tracking-wider text-white">LUNAR NAVIGATOR</span>
              <span className="text-[10px] font-mono uppercase bg-amber-400/10 border border-amber-400/30 text-amber-300 px-1.5 py-0.5 rounded">
                NASA Space Apps
              </span>
            </div>
            <p className="text-[11px] text-slate-400">South Pole Illumination & DTE Comm Suite</p>
          </div>
        </div>

        {/* View Mode Navigation Tabs */}
        <nav className="flex items-center bg-[#0b1224] p-1 rounded-xl border border-[#1e293b] overflow-x-auto max-w-full">
          <button
            onClick={() => setActiveTab('globe')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'globe'
                ? 'bg-amber-400 text-black shadow-md shadow-amber-400/20 font-semibold'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Moon Globe</span>
          </button>

          <button
            onClick={() => setActiveTab('terrain')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'terrain'
                ? 'bg-amber-400 text-black shadow-md shadow-amber-400/20 font-semibold'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <Mountain className="w-3.5 h-3.5" />
            <span>3D Terrain</span>
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'analytics'
                ? 'bg-amber-400 text-black shadow-md shadow-amber-400/20 font-semibold'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Site Analytics</span>
          </button>

          <button
            onClick={() => setActiveTab('compare')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'compare'
                ? 'bg-amber-400 text-black shadow-md shadow-amber-400/20 font-semibold'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <GitCompare className="w-3.5 h-3.5" />
            <span>Compare Sites</span>
          </button>

          <button
            onClick={() => setActiveTab('assistant')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'assistant'
                ? 'bg-amber-400 text-black shadow-md shadow-amber-400/20 font-semibold'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            <span>Moon AI</span>
          </button>
        </nav>

        {/* Right Controls: Time Window Selector + Dropdown Calendar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Time Window Buttons */}
          <div className="flex items-center bg-[#0b1224] p-1 rounded-xl border border-[#1e293b]">
            <Clock className="w-3.5 h-3.5 text-slate-400 ml-1.5 mr-1" />
            {TIME_WINDOWS.map((tw) => (
              <button
                key={tw.id}
                onClick={() => setTimeWindow && setTimeWindow(tw.id)}
                className={`px-2 py-1 rounded-lg text-[11px] font-mono transition-all ${
                  timeWindow === tw.id
                    ? 'bg-amber-400 text-black font-bold shadow'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
                title={`Evaluate ephemeris over ${tw.label}`}
              >
                {tw.id}
              </button>
            ))}
          </div>

          {/* Direct Interactive Date Picker & Day Stepper */}
          <div className="flex items-center bg-[#0b1224] border border-[#1e293b] rounded-xl px-2 py-1 shadow-sm">
            <button
              onClick={handlePrevDay}
              title="Previous Day"
              className="p-1 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            <div className="flex items-center gap-1.5 mx-1 px-1.5 py-0.5">
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              <input
                type="date"
                value={date}
                onChange={(e) => {
                  if (e.target.value) setDate(e.target.value);
                }}
                className="bg-transparent text-xs text-white font-mono font-medium focus:outline-none cursor-pointer"
                title="Click to select any date from calendar"
              />
            </div>

            <button
              onClick={handleNextDay}
              title="Next Day"
              className="p-1 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Quick Mission Preset Dropdown */}
          <select
            onChange={(e) => {
              if (e.target.value) setDate(e.target.value);
            }}
            value=""
            className="bg-[#0b1224] text-slate-300 text-xs border border-[#1e293b] rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-amber-400 cursor-pointer hover:border-slate-600 transition-colors hidden sm:block font-sans"
          >
            <option value="" disabled>Mission Presets</option>
            {MISSION_PRESETS.map((m) => (
              <option key={m.label} value={m.date}>{m.label}</option>
            ))}
          </select>

          {/* NASA Verification Trigger */}
          <button
            onClick={onOpenVerification}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono bg-sky-500/10 border border-sky-500/30 text-sky-400 hover:bg-sky-500/20 transition-all shadow-sm"
            title="Verify against NASA WebGeoCalc / DE421"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden sm:inline">NASA DE421</span>
          </button>
        </div>
      </div>
    </header>
  );
}
