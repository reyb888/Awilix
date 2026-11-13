import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { Sun, Radio, Clock, ShieldCheck } from 'lucide-react';

const formatNum = (n) => (Number.isFinite(n) ? n.toFixed(1) : '—');
const formatTime = (ms) => (ms ? new Date(ms).toISOString().replace('T', ' ').slice(0, 16) + ' UTC' : 'None in this window');

function WindowStrip({ stats, label, color, start, icon: Icon }) {
  const ranges = [
    ...stats.intervals.map((r) => ({ ...r, kind: 'visible' })),
    ...stats.blocked.map((r) => ({ ...r, kind: 'blocked' }))
  ].sort((a, b) => a.start - b.start);
  
  const origin = start;
  const total = stats.totalHours * 3600000;

  return (
    <div className="science-window space-y-1.5 py-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-[var(--ink)] flex items-center gap-1.5">
          {Icon && <Icon className="w-3.5 h-3.5" style={{ color }} />}
          {label}
        </span>
        <span className="font-mono text-[var(--ink-soft)]">
          <strong className="text-[var(--ink)]">{formatNum(stats.exactHours)}h</strong> clear /{' '}
          <span className="text-[var(--ink-mute)]">{formatNum(stats.longestOutageHours)}h longest interruption</span>
        </span>
      </div>

      <div
        className="science-strip h-3 rounded-full overflow-hidden relative bg-[var(--paper-dark)] border border-[var(--line-soft)]"
        role="img"
        aria-label={`${label}: ${formatNum(stats.exactHours)} hours`}
      >
        {ranges.map((r, i) => (
          <span
            key={i}
            style={{
              position: 'absolute',
              top: 0,
              height: '100%',
              left: `${((r.start - origin) / total) * 100}%`,
              width: `${Math.max(0.5, ((r.end - r.start) / total) * 100)}%`,
              backgroundColor: r.kind === 'visible' ? color : 'rgba(238, 241, 247, 0.08)',
            }}
            title={`${r.kind === 'visible' ? 'Active' : 'Blocked'}: ${new Date(r.start).toISOString().slice(11, 16)} → ${new Date(r.end).toISOString().slice(11, 16)} UTC`}
          />
        ))}
      </div>

      <div className="text-[10px] text-[var(--ink-mute)] flex justify-between font-mono">
        <span>Continuous coverage</span>
        <span>Next sunset/block: {formatTime(stats.nextSet)}</span>
      </div>
    </div>
  );
}

export default function ScenarioDiagnostics({ scenario }) {
  if (!scenario) return null;
  const { power, comm, solarProfile, earthProfile } = scenario;
  const horizon = solarProfile?.bins?.map((b, i) => ({
    az: b.az,
    solar: b.horizon,
    earth: earthProfile?.bins[i]?.horizon ?? null
  })) ?? [];
  const duration = scenario.hours * 3600000;
  const start = +scenario.path[0].time;

  return (
    <section className="science-diagnostics bento-plate p-4 space-y-3 mt-3" aria-label="Sun and Earth Coverage Intervals">
      <div className="flex items-center justify-between pb-2 border-b border-[var(--line-soft)]">
        <div>
          <h3 className="text-xs font-bold text-[var(--ink)] flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-[var(--coral)]" />
            Detailed Sunlight & Radio Windows
          </h3>
          <p className="text-[11px] text-[var(--ink-mute)]">
            Shows active sunlight and Earth contact across the mission timeline
          </p>
        </div>
        <span className="text-[10px] font-mono text-[var(--ink-faint)] px-2 py-0.5 rounded border border-[var(--line-soft)]">
          {scenario.mode === 'terrain' ? 'Crater Ridge Obstructions Included' : 'Standard Geometric Line-of-Sight'}
        </span>
      </div>

      <WindowStrip
        stats={{
          ...power,
          totalHours: scenario.hours,
          intervals: power.intervals.map((r) => ({ ...r })),
          blocked: power.blocked.map((r) => ({ ...r }))
        }}
        start={start}
        label="Sunlight (Solar Power)"
        color="#eac18b"
        icon={Sun}
      />

      <WindowStrip
        stats={{
          ...comm,
          totalHours: scenario.hours,
          intervals: comm.intervals.map((r) => ({ ...r })),
          blocked: comm.blocked.map((r) => ({ ...r }))
        }}
        start={start}
        label="Direct Earth Contact (Communications)"
        color="#91c6d4"
        icon={Radio}
      />

      <div className="flex justify-between font-mono text-[10px] text-[var(--ink-faint)] pt-1 border-t border-[var(--line-soft)]">
        <span>Timeline Start: {new Date(start).toISOString().slice(0, 16).replace('T', ' ')} UTC</span>
        <span>Duration: {duration / 3600000} Hours</span>
      </div>

      {horizon.length > 0 && (
        <details className="pt-2 text-xs text-[var(--ink-mute)]">
          <summary className="cursor-pointer text-[var(--coral)] hover:underline font-semibold text-[11px]">
            View Crater Horizon Obstruction Chart (Degrees above horizon)
          </summary>
          <div className="h-44 w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={horizon}>
                <CartesianGrid stroke="rgba(238, 241, 247, 0.08)" strokeDasharray="3 3" />
                <XAxis dataKey="az" tickFormatter={(v) => `${v}°`} stroke="#93a1ab" fontSize={10} />
                <YAxis unit="°" stroke="#93a1ab" fontSize={10} />
                <Tooltip formatter={(v, name) => [`${formatNum(v)}°`, name]} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Line name="Ridge Blocking Height" dataKey="solar" stroke="#eac18b" dot={false} connectNulls={false} />
                <Line name="Earth Horizon" dataKey="earth" stroke="#91c6d4" dot={false} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </details>
      )}
    </section>
  );
}
