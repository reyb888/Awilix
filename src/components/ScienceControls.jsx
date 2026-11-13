import { useState } from 'react';
import { useScience } from './ScienceProvider.jsx';
import { coordinateText } from '../lib/mascotKnowledge.js';
import sites from '../data/sites.json';
import { Sun, Radio, Compass, Settings, CheckCircle2, SlidersHorizontal, Mountain } from 'lucide-react';
import './Science.css';

export default function ScienceControls({ scenario, site, onSelectSite }) {
  const { loading, error, settings, setSettings, date, hours } = useScience();
  const [draft, setDraft] = useState(settings);
  const [showSettings, setShowSettings] = useState(false);

  function update(key, value) {
    setDraft(s => ({ ...s, [key]: value }));
  }

  function handleSaveGeometry(e) {
    e.preventDefault();
    setSettings({ ...draft, mode: settings.mode });
    setShowSettings(false);
  }

  return (
    <section className="science-console bento-plate mb-5" aria-label="Simulation Settings">
      {/* Top compact bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[var(--line-soft)]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-[var(--paper)] border border-[var(--line)] flex items-center justify-center text-[var(--coral)]">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-medium font-sans text-[var(--ink)]">
                Lunar south pole simulation
              </h2>
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                loading 
                  ? 'border-[var(--coral)] text-[var(--coral)] bg-[var(--paper)]' 
                  : 'border-[var(--mustard)] text-[var(--mustard)] bg-[var(--paper)]'
              }`}>
                {loading ? 'Calculating…' : 'NASA ephemeris active'}
              </span>
            </div>
            <p className="text-[11px] text-[var(--ink-mute)] font-sans">
              Real sunlight hours and direct Earth radio visibility for {date} ({hours}h)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-[var(--line)] bg-[var(--bone)] hover:bg-[var(--bone-hover)] text-xs text-[var(--ink-soft)] transition-colors cursor-pointer"
          >
            <SlidersHorizontal className="w-3 h-3 text-[var(--coral)]" />
            <span>{showSettings ? 'Hide setup' : 'Lander equipment'}</span>
          </button>
        </div>
      </div>

      {/* Quick Selectors Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
        <label className="flex flex-col gap-1 text-xs text-[var(--ink-mute)]">
          <span className="font-semibold text-[var(--ink-soft)] flex items-center gap-1">
            <Compass className="w-3.5 h-3.5 text-[var(--coral)]" />
            Active Landing Region
          </span>
          <select
            aria-label="Selected landing region"
            className="w-full bg-[var(--paper-dark)] border border-[var(--line)] rounded-lg px-3 py-2 text-xs text-[var(--ink)] focus:outline-none focus:border-[var(--coral)]"
            value={site.id}
            onChange={(e) => onSelectSite(sites.find((s) => s.id === e.target.value))}
          >
            {sites.map((s) => (
              <option value={s.id} key={s.id}>
                {s.name} ({coordinateText(s)})
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-[var(--ink-mute)]">
          <span className="font-semibold text-[var(--ink-soft)] flex items-center gap-1">
            <Mountain className="w-3.5 h-3.5 text-[var(--mustard)]" />
            Horizon Obstruction Model
          </span>
          <select
            aria-label="Visibility model"
            className="w-full bg-[var(--paper-dark)] border border-[var(--line)] rounded-lg px-3 py-2 text-xs text-[var(--ink)] focus:outline-none focus:border-[var(--mustard)]"
            value={settings.mode}
            onChange={(e) => {
              const mode = e.target.value;
              setSettings((s) => ({ ...s, mode }));
              setDraft((s) => ({ ...s, mode }));
            }}
          >
            <option value="reference">Smooth Horizon (Ideal geometric visibility)</option>
            <option value="terrain">3D Crater & Ridge Terrain (Accounts for nearby hills)</option>
          </select>
        </label>
      </div>

      {error && (
        <div className="mt-3 p-2.5 rounded-lg bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.3)] text-xs text-[var(--crimson)]">
          {error}
        </div>
      )}

      {/* Collapsible Lander & Solar Panel Geometry */}
      {showSettings && (
        <form onSubmit={handleSaveGeometry} className="mt-4 pt-3 border-t border-[var(--line-soft)] space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-[var(--ink)]">
              Customize Lander & Antenna Heights
            </h3>
            <span className="text-[10px] text-[var(--ink-faint)]">
              Taller antennas see over crater ridges
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <label className="flex flex-col gap-1 text-[var(--ink-mute)]">
              <span>Solar panel height (m)</span>
              <input
                type="number"
                min="0"
                max="50"
                step="0.5"
                value={draft.solarHeight}
                onChange={(e) => update('solarHeight', Number(e.target.value))}
                className="bg-[var(--paper-dark)] border border-[var(--line)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--ink)]"
              />
            </label>

            <label className="flex flex-col gap-1 text-[var(--ink-mute)]">
              <span>Radio antenna height (m)</span>
              <input
                type="number"
                min="0"
                max="50"
                step="0.5"
                value={draft.antennaHeight}
                onChange={(e) => update('antennaHeight', Number(e.target.value))}
                className="bg-[var(--paper-dark)] border border-[var(--line)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--ink)]"
              />
            </label>

            <label className="flex flex-col gap-1 text-[var(--ink-mute)]">
              <span>Panel tilt angle (°)</span>
              <input
                type="number"
                min="0"
                max="90"
                value={draft.panelTilt}
                onChange={(e) => update('panelTilt', Number(e.target.value))}
                className="bg-[var(--paper-dark)] border border-[var(--line)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--ink)]"
              />
            </label>

            <label className="flex flex-col gap-1 text-[var(--ink-mute)]">
              <span>Panel facing direction (°)</span>
              <input
                type="number"
                min="0"
                max="360"
                value={draft.panelAzimuth}
                onChange={(e) => update('panelAzimuth', Number(e.target.value))}
                className="bg-[var(--paper-dark)] border border-[var(--line)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--ink)]"
              />
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowSettings(false)}
              className="btn-ghost text-xs py-1 px-3"
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary text-xs py-1 px-4">
              Apply Settings
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
