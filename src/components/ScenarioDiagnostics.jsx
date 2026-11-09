import { ResponsiveContainer,LineChart,Line,XAxis,YAxis,CartesianGrid,Tooltip,Legend } from 'recharts';
const number=n=>Number.isFinite(n)?n.toFixed(2):'—';
const event=(ms)=>ms?new Date(ms).toISOString().replace('T',' ').slice(0,16)+' UTC':'No set event in window';
function WindowStrip({stats,label,color,start}){
 const ranges=[...stats.intervals.map(r=>({...r,kind:'visible'})),...stats.blocked.map(r=>({...r,kind:'blocked'}))].sort((a,b)=>a.start-b.start);
 const origin=start,total=stats.totalHours*3600000;
 return <div className="science-window"><div><strong>{label}</strong><span>{number(stats.exactHours)} h visible · {number(stats.longestOutageHours)} h longest outage</span></div><div className="science-strip" role="img" aria-label={`${label}: ${number(stats.exactHours)} visible hours; ${number(stats.unknownHours)} unknown hours; longest outage ${number(stats.longestOutageHours)} hours`}>{ranges.map((r,i)=><span key={i} style={{left:`${(r.start-origin)/total*100}%`,width:`${(r.end-r.start)/total*100}%`,background:r.kind==='visible'?color:'#29343e'}} title={`${r.kind}: ${new Date(r.start).toISOString()} → ${new Date(r.end).toISOString()}`}/>)}</div><small>Next set: {event(stats.nextSet)} · Unknown: {number(stats.unknownHours)} h · Outages are clipped to the analysis window.</small></div>;
}
export default function ScenarioDiagnostics({scenario}){
 if(!scenario)return null;
 const {power,comm,solarProfile,earthProfile}=scenario;
 const horizon=solarProfile?.bins?.map((b,i)=>({az:b.az,solar:b.horizon,earth:earthProfile?.bins[i]?.horizon??null}))??[];
 const duration=scenario.hours*3600000,start=+scenario.path[0].time;
 return <section className="science-diagnostics bento-plate" aria-label="Visibility windows and terrain horizon">
  <div className="science-console-heading"><div><span className="science-kicker">OPERATING WINDOWS</span><h2>See the outages behind the totals.</h2></div><span className="science-mode-label">{scenario.mode==='terrain'?'LOCAL TERRAIN ESTIMATE':'REFERENCE HORIZON'}</span></div>
  <WindowStrip stats={{...power,totalHours:scenario.hours,intervals:power.intervals.map(r=>({...r})),blocked:power.blocked.map(r=>({...r}))}} start={start} label="Sun center" color="#eac18b"/>
  <WindowStrip stats={{...comm,totalHours:scenario.hours}} start={start} label="Earth center" color="#91c6d4"/>
  <div className="science-strip-axis"><span>{new Date(start).toISOString().slice(0,16).replace('T',' ')} UTC</span><span>+{duration/3600000}h</span></div>
  {scenario.reference&&<p className="science-caption">Without local terrain: {number(scenario.reference.power.exactHours)} h Sun / {number(scenario.reference.comm.exactHours)} h Earth. Both totals use the same sampled celestial path.</p>}
  <details className="science-details"><summary>Inspect terrain horizon by azimuth</summary><p className="science-caption">Mask estimated from the bundled crop at array / antenna height. Zero means no modeled ridge above the reference horizon. Terrain beyond the crop is excluded. Radial reach: {number((solarProfile?.minRangeM??0)/1000)}–{number((solarProfile?.maxRangeM??0)/1000)} km.</p><div className="science-chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={horizon}><CartesianGrid stroke="#29343e" strokeDasharray="3 3"/><XAxis dataKey="az" tickFormatter={v=>`${v}°`} stroke="#93a1ab"/><YAxis unit="°" stroke="#93a1ab"/><Tooltip formatter={(v,name)=>[`${number(v)}°`,name]}/><Legend/><Line name="Array horizon" dataKey="solar" stroke="#eac18b" dot={false} connectNulls={false}/><Line name="Antenna horizon" dataKey="earth" stroke="#91c6d4" dot={false} connectNulls={false}/></LineChart></ResponsiveContainer></div></details>
 </section>;
}
