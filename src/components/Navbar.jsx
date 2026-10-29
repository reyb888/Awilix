// src/components/Navbar.jsx
// Classy Blue & Silver Header with View Mode Pills, Native Date Picker + Steppers,
// Mission Presets Dropdown, and Time Window Selector.

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
  { id: '24h', label: '24h', hours: 24 },
  { id: '48h', label: '48h', hours: 48 },
  { id: '7d', label: '7d', hours: 168 },
  { id: '14d', label: '14d', hours: 336 },
  { id: 'month', label: '29.5d', hours: 708 },
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
  const [presetOpen, setPresetOpen] = useState(false);

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
    <div className="flex flex-col w-full z-40">
      {/* ── Top Metadata Strip ───────────────────────────── */}
      <div className="meta-topbar">
        <div className="flex items-center gap-3">
          <span className="flex items-center">
            <span className="pulse-dot" />
            <b>Awilix</b>&nbsp;·&nbsp;Lunar Light & Comms Atlas
          </span>
          <span className="hidden md:inline text-[var(--ink-faint)]">|</span>
          <span className="hidden md:inline text-[var(--ink-faint)]">
            Datum: <b className="text-[var(--ink)]">NASA JPL DE421</b> · IAU Libration
          </span>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={onOpenVerification}
            className="flex items-center gap-1.5 text-[var(--ink-mute)] hover:text-[var(--coral)] transition-colors cursor-pointer"
          >
            <CheckCircle2 className="w-3 h-3 text-[var(--emerald)]" />
            <span className="underline">NASA Cross-Check: Verified</span>
          </button>
          <span className="text-[var(--ink-faint)] hidden sm:inline">89.9°S · 0.0°E</span>
        </div>
      </div>

      {/* ── Main Architectural Header ─────────────────────── */}
      <header className="nav-header">
        <div className="max-w-[1520px] mx-auto flex flex-col xl:flex-row items-center justify-between gap-3">
          {/* Brand & Identity */}
          <div className="flex items-center gap-3 w-full xl:w-auto justify-between xl:justify-start">
            <a href="#top" className="brand-mark">
              <span className="brand-icon-disc">☾</span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-sans font-bold text-base tracking-tight text-[var(--ink)]">
                    AWILIX
                  </span>
                  <span className="text-[9.5px] font-mono uppercase bg-[rgba(255,171,94,0.12)] border border-[rgba(255,171,94,0.3)] text-[var(--coral)] px-1.5 py-0.5 rounded">
                    Space Apps
                  </span>
                </div>
                <p className="text-[10px] text-[var(--ink-mute)] font-sans">
                  South Pole Sunlight & Earth-Windows
                </p>
              </div>
            </a>

            {/* Verification mobile button */}
            <button
              onClick={onOpenVerification}
              className="xl:hidden telemetry-chip terrain text-[10px]"
            >
              <CheckCircle2 className="w-3 h-3" />
              <span>Verified</span>
            </button>
          </div>

          {/* Navigation View Switcher Pills */}
          <nav className="flex items-center bg-[var(--bone)] p-1 rounded-xl border border-[var(--line)] overflow-x-auto max-w-full">
            <button
              onClick={() => setActiveTab('globe')}
              className={`nav-tab-pill ${activeTab === 'globe' ? 'active' : ''}`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span><b className="pill-num font-mono mr-1">01</b>Moon Globe</span>
            </button>

            <button
              onClick={() => setActiveTab('terrain')}
              className={`nav-tab-pill ${activeTab === 'terrain' ? 'active' : ''}`}
            >
              <Mountain className="w-3.5 h-3.5" />
              <span><b className="pill-num font-mono mr-1">02</b>3D Terrain</span>
            </button>

            <button
              onClick={() => setActiveTab('analytics')}
              className={`nav-tab-pill ${activeTab === 'analytics' ? 'active' : ''}`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span><b className="pill-num font-mono mr-1">03</b>Telemetry</span>
            </button>

            <button
              onClick={() => setActiveTab('compare')}
              className={`nav-tab-pill ${activeTab === 'compare' ? 'active' : ''}`}
            >
              <GitCompare className="w-3.5 h-3.5" />
              <span><b className="pill-num font-mono mr-1">04</b>Compare</span>
            </button>

            <button
              onClick={() => setActiveTab('assistant')}
              className={`nav-tab-pill ${activeTab === 'assistant' ? 'active' : ''}`}
            >
              <Bot className="w-3.5 h-3.5" />
              <span><b className="pill-num font-mono mr-1">05</b>Mission AI</span>
            </button>
          </nav>

          {/* Date Picker, Steppers & Time Window Controls */}
          <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto justify-end">
            {/* Mission Presets Dropdown */}
            <div className="relative">
              <button
                onClick={() => setPresetOpen(!presetOpen)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--bone)] hover:bg-[var(--bone-hover)] border border-[var(--line)] text-xs text-[var(--ink)] font-sans transition-colors cursor-pointer"
                title="Select a historic or upcoming lunar landing mission preset"
              >
                <Sparkles className="w-3.5 h-3.5 text-[var(--coral)]" />
                <span className="hidden sm:inline text-[11.5px]">Mission Presets</span>
                <ChevronDown className="w-3 h-3 text-[var(--ink-faint)]" />
              </button>

              {presetOpen && (
                <div
                  className="absolute right-0 mt-2 w-64 bg-[var(--bone)] border border-[var(--line)] rounded-xl shadow-2xl p-1.5 z-[100] animate-fade-in"
                  onClick={() => setPresetOpen(false)}
                >
                  <div className="text-[10px] font-mono uppercase text-[var(--ink-faint)] px-2.5 py-1 border-b border-[var(--line-soft)]">
                    Target Timelines
                  </div>
                  {MISSION_PRESETS.map((p, idx) => (
                    <button
                      key={idx}
                      onClick={() => setDate(p.date)}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-[var(--ink-soft)] hover:text-[var(--ink)] hover:bg-[rgba(238,241,247,0.06)] flex items-center justify-between transition-colors"
                    >
                      <span>{p.label}</span>
                      <span className="font-mono text-[10px] text-[var(--coral)]">{p.date}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Native Calendar Input with Day Steppers */}
            <div className="flex items-center bg-[var(--bone)] rounded-lg border border-[var(--line)] p-0.5">
              <button
                onClick={handlePrevDay}
                className="p-1.5 text-[var(--ink-mute)] hover:text-[var(--ink)] hover:bg-[rgba(238,241,247,0.06)] rounded transition-colors"
                title="Previous Day"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="bg-transparent text-xs font-mono text-[var(--ink)] px-2 py-0.5 focus:outline-none cursor-pointer"
              />

              <button
                onClick={handleNextDay}
                className="p-1.5 text-[var(--ink-mute)] hover:text-[var(--ink)] hover:bg-[rgba(238,241,247,0.06)] rounded transition-colors"
                title="Next Day"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Time Window Selector Pills */}
            <div className="flex items-center bg-[var(--bone)] rounded-lg border border-[var(--line)] p-0.5">
              {TIME_WINDOWS.map((tw) => (
                <button
                  key={tw.id}
                  onClick={() => setTimeWindow(tw.id)}
                  className={`px-2 py-1 rounded text-xs font-mono transition-colors cursor-pointer ${
                    timeWindow === tw.id
                      ? 'bg-[var(--coral)] text-[#120e07] font-semibold'
                      : 'text-[var(--ink-mute)] hover:text-[var(--ink)]'
                  }`}
                  title={`Analyze solar & DTE comm windows over ${tw.hours} hours`}
                >
                  {tw.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>
    </div>
  );
}
