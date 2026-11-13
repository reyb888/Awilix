// src/components/Navbar.jsx
// Classy Blue & Silver Header with View Mode Pills, Native Date Picker + Steppers,
// Mission Presets Dropdown, and Time Window Selector.
// Uses GSAP for smooth active tab switching animations.

import { useState, useRef, useEffect } from 'react';
import { coordinateText } from '../lib/mascotKnowledge.js';
import gsap from 'gsap';
import {
  Calendar, Globe, Mountain, BarChart3, GitCompare, Bot,
  CheckCircle2, ChevronLeft, ChevronRight, Clock, Sparkles, ChevronDown
} from 'lucide-react';

export const MISSION_PRESETS = [
  {
    id: 'today',
    label: 'Today (Calculated Geometry)',
    date: new Date().toISOString().split('T')[0],
    siteId: 'shackleton-rim',
    subtitle: 'Real-time solar & Earth geometry',
  },
  {
    id: 'im1',
    label: 'IM-1 Odysseus Landing (Feb 22, 2024)',
    date: '2024-02-22',
    siteId: 'malapert-a',
    subtitle: 'First commercial lunar touchdown · Malapert A',
  },
  {
    id: 'im2',
    label: 'IM-2 Athena Landing (Mar 6, 2025)',
    date: '2025-03-06',
    siteId: 'mons-mouton',
    subtitle: 'PRIME-1 ice drill mission · Mons Mouton Plateau',
  },
  {
    id: 'artemis3',
    label: 'Artemis III Polar Candidate (2027)',
    date: '2027-06-15',
    siteId: 'shackleton-ridge',
    subtitle: 'Peak sunlight ridge · Crewed exploration',
  },
  {
    id: 'benchmark2026',
    label: 'NASA 2026 Solar Benchmark (Feb 15, 2026)',
    date: '2026-02-15',
    siteId: 'shackleton-rim',
    subtitle: 'Optimal illumination window · Shackleton Rim',
  },
  {
    id: 'nobile-ice',
    label: 'Nobile Polar Ice Reconnaissance',
    date: '2026-04-10',
    siteId: 'nobile',
    subtitle: 'Permanently shadowed craters · Deep cold traps',
  },
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
  onSelectPreset,
}) {
  const [presetOpen, setPresetOpen] = useState(false);
  const navRef = useRef(null);
  const presetRef = useRef(null);

  // Close preset dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (presetRef.current && !presetRef.current.contains(e.target)) {
        setPresetOpen(false);
      }
    }
    if (presetOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [presetOpen]);

  // GSAP tab switch animation
  useEffect(() => {
    if (navRef.current) {
      const activeEl = navRef.current.querySelector('.nav-tab-pill.active');
      if (activeEl) {
        gsap.fromTo(
          activeEl,
          { scale: 0.94 },
          { scale: 1, duration: 0.25, ease: 'back.out(1.5)' }
        );
      }
    }
  }, [activeTab]);

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
            <b>Awilix</b>&nbsp;·&nbsp;Lunar South Pole Light & Radio Atlas
          </span>
          <span className="hidden md:inline text-[var(--ink-faint)]">|</span>
          <span className="hidden md:inline text-[var(--ink-faint)]">
            Data: <b className="text-[var(--ink)]">NASA LRO & 2026 Orbital Ephemeris</b>
          </span>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={onOpenVerification}
            className="flex items-center gap-1.5 text-[var(--ink-mute)] hover:text-[var(--coral)] transition-colors cursor-pointer"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-[var(--emerald)]" />
            <span className="underline">Data & Sources</span>
          </button>
          <span className="text-[var(--coral)] hidden sm:inline font-mono">{coordinateText(selectedSite)}</span>
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
                  <span className="text-[9.5px] font-mono uppercase bg-[rgba(234,193,139,0.12)] border border-[rgba(234,193,139,0.3)] text-[var(--coral)] px-1.5 py-0.5 rounded">
                    South Pole 2026
                  </span>
                </div>
                <p className="text-[10px] text-[var(--ink-mute)] font-sans">
                  Sunlight & Direct Earth Communications
                </p>
              </div>
            </a>

            {/* Verification mobile button */}
            <button
              onClick={onOpenVerification}
              className="xl:hidden telemetry-chip terrain text-[10px] cursor-pointer"
            >
              <CheckCircle2 className="w-3 h-3" />
              <span>Data</span>
            </button>
          </div>

          {/* Navigation View Switcher Pills */}
          <nav
            ref={navRef}
            className="flex items-center bg-[var(--bone)] p-1 rounded-xl border border-[var(--line)] overflow-x-auto max-w-full scrollbar-none"
          >
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
            <div className="relative" ref={presetRef}>
              <button
                onClick={() => setPresetOpen(!presetOpen)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--bone)] hover:bg-[var(--bone-hover)] border border-[var(--line)] text-xs text-[var(--ink)] font-sans transition-colors cursor-pointer"
                title="Select a mission date preset"
              >
                <Sparkles className="w-3.5 h-3.5 text-[var(--coral)]" />
                <span className="hidden sm:inline text-[11.5px]">Mission Presets</span>
                <ChevronDown className="w-3 h-3 text-[var(--ink-faint)]" />
              </button>

              {presetOpen && (
                <div
                  className="absolute left-0 mt-2 w-72 sm:w-80 max-w-[calc(100vw-32px)] bg-[var(--bone)] border border-[var(--line)] rounded-xl shadow-2xl p-1.5 z-[100] animate-fade-in"
                  onClick={() => setPresetOpen(false)}
                >
                  <div className="text-[10px] font-mono uppercase text-[var(--ink-faint)] px-2.5 py-1 border-b border-[var(--line-soft)]">
                    Historical & Planned Missions
                  </div>
                  {MISSION_PRESETS.map((p, idx) => (
                    <button
                      key={p.id || idx}
                      onClick={() => {
                        if (onSelectPreset) {
                          onSelectPreset(p);
                        } else {
                          setDate(p.date);
                        }
                      }}
                      className="w-full text-left px-2.5 py-2 rounded-lg text-xs text-[var(--ink-soft)] hover:text-[var(--ink)] hover:bg-[rgba(238,241,247,0.06)] flex items-center justify-between gap-2 transition-colors cursor-pointer"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{p.label}</div>
                        {p.subtitle && (
                          <div className="text-[10px] text-[var(--ink-mute)] truncate font-mono">
                            {p.subtitle}
                          </div>
                        )}
                      </div>
                      <span className="font-mono text-[11px] text-[var(--coral)] whitespace-nowrap flex-shrink-0">
                        {p.date}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Native Calendar Input with Day Steppers */}
            <div className="flex items-center bg-[var(--bone)] rounded-lg border border-[var(--line)] p-0.5">
              <button
                onClick={handlePrevDay}
                className="p-1.5 text-[var(--ink-mute)] hover:text-[var(--ink)] hover:bg-[rgba(238,241,247,0.06)] rounded transition-colors cursor-pointer"
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
                className="p-1.5 text-[var(--ink-mute)] hover:text-[var(--ink)] hover:bg-[rgba(238,241,247,0.06)] rounded transition-colors cursor-pointer"
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
                  title={`Analyze over ${tw.hours} hours`}
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
