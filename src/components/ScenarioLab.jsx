import {useEffect,useState} from 'react';
import {ResponsiveContainer,LineChart,Line,XAxis,YAxis,CartesianGrid,Tooltip,Legend,ReferenceLine} from 'recharts';
import sites from '../data/sites.json';
import {useScience} from './ScienceProvider.jsx';
import {requestScenarios} from '../lib/scienceClient.js';
import ScenarioDiagnostics from './ScenarioDiagnostics.jsx';
const shift=(date,days)=>new Date(Date.parse(`${date}T00:00Z`)+days*86400000).toISOString().slice(0,10);
export default function ScenarioLab({pins,setPins}){
 const {date,hours,settings}=useScience();
 const [state,setState]=useState({results:[],loading:true,error:null});
 const key=JSON.stringify({pins,hours,settings});
 useEffect(()=>{
  let alive=true;const spec=JSON.parse(key);
  const timer=setTimeout(()=>{
   requestScenarios(spec.pins.map(pin=>({site:sites.find(s=>s.id===pin.siteId),date:pin.date,hours:spec.hours,...spec.settings}))).then(results=>{if(alive)setState({results,loading:false,error:null,key});}).catch(e=>{if(alive)setState({results:[],loading:false,error:e.message,key});});
  },180);
  return()=>{alive=false;clearTimeout(timer);};
 },[key]);
 const update=(i,patch)=>setPins(prev=>prev.map((p,j)=>i===j?{...p,...patch}:p));
 const current=state.key===key?state:{results:[],loading:true,error:null};
 const [a,b]=current.results;
 const delay=Math.round((Date.parse(pins[1].date)-Date.parse(pins[0].date))/86400000);
 const findValue=(scenario,elapsed)=>{
  const path=scenario.path,start=+path[0].time,target=start+elapsed*3600000;
  let i=1;while(i<path.length&&+path[i].time<target)i++;
  const p=path[Math.max(0,i-1)],q=path[Math.min(i,path.length-1)],t=+q.time===+p.time?0:(target-+p.time)/(+q.time-+p.time);
  return Number.isFinite(p.sunMargin)&&Number.isFinite(q.sunMargin)?p.sunMargin+(q.sunMargin-p.sunMargin)*t:null;
 };
 const chart=a&&b?Array.from({length:Math.ceil(hours/(a.stepMinutes/60))+1},(_,i)=>{const elapsed=Math.min(hours,i*a.stepMinutes/60);return {elapsed,A:findValue(a,elapsed),B:findValue(b,elapsed)};}):[];
 return <section className="scenario-lab bento-plate" data-guide="scenario-lab" aria-label="Pinned A/B scenario comparison">
  <div className="science-console-heading"><div><span className="science-kicker">SCHEDULE CHANGE LAB</span><h2>Same mission. Different possibilities.</h2></div><span className="science-mode-label">{hours}h · {settings.mode==='terrain'?'LOCAL TERRAIN':'REFERENCE SPHERE'}</span></div>
  <p className="science-caption">Pin independent site/date combinations. Both use the shared window, observer heights, visibility model and fixed panel geometry. Changing the global date does not move your pins.</p>
  <div className="scenario-pins">{pins.map((pin,i)=><div key={i} className="scenario-pin"><h3>Scenario {i===0?'A':'B'}</h3><label>Landing region {i===0?'A':'B'}<select value={pin.siteId} onChange={e=>update(i,{siteId:e.target.value})}>{sites.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label>Landing date {i===0?'A':'B'} (UTC)<input type="date" required value={pin.date} onChange={e=>{if(e.target.value&&/^\d{4}-\d{2}-\d{2}$/.test(e.target.value))update(i,{date:e.target.value});}}/></label><button className="btn-ghost text-xs" onClick={()=>update(i,{date})}>Use global date</button></div>)}</div>
  <label>Delay B relative to A: {delay} days<input aria-label="Delay scenario B relative to A" type="range" min="-14" max="14" value={Math.max(-14,Math.min(14,Number.isFinite(delay)?delay:0))} onChange={e=>update(1,{date:shift(pins[0].date,Number(e.target.value))})}/></label>
  <div className="scenario-actions"><button className="btn-ghost text-xs" onClick={()=>update(1,{siteId:pins[0].siteId,date:shift(pins[0].date,3)})}>Same site, +3 days</button><button className="btn-ghost text-xs" onClick={()=>update(1,{date:pins[0].date})}>Match dates</button></div>
  {current.loading&&<p className="science-caption" role="status">Computing pinned scenarios…</p>}{current.error&&<p className="science-warning" role="alert">{current.error}</p>}
  {a&&b&&<><div className="scenario-deltas"><div>Sunlight change · B − A<strong>{(b.power.exactHours-a.power.exactHours).toFixed(2)} h</strong></div><div>Earth visibility change · B − A<strong>{(b.comm.exactHours-a.comm.exactHours).toFixed(2)} h</strong></div><div>Longest darkness change · B − A<strong>{(b.power.longestOutageHours-a.power.longestOutageHours).toFixed(2)} h</strong></div></div><h3 className="text-sm">Solar clearance above the modeled horizon</h3><p className="science-caption">Aligned by hours since each scenario starts. Negative values indicate the Sun center is blocked by the chosen model.</p><div className="science-chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={chart}><CartesianGrid stroke="#29343e" strokeDasharray="3 3"/><XAxis dataKey="elapsed" type="number" domain={[0,hours]} unit="h" stroke="#93a1ab"/><YAxis unit="°" stroke="#93a1ab" domain={[(min)=>Math.min(0,Math.floor(min)),(max)=>Math.max(0,Math.ceil(max))]}/><ReferenceLine y={0} stroke="#d78f82" strokeDasharray="4 4"/><Tooltip formatter={(v,name)=>[`${Number(v).toFixed(2)}°`,name]}/><Legend/><Line name="Scenario A · solar clearance" dataKey="A" stroke="#eac18b" dot={false}/><Line name="Scenario B · solar clearance" dataKey="B" stroke="#91c6d4" dot={false}/></LineChart></ResponsiveContainer></div><details className="science-details"><summary>Scenario A · windows and outages</summary><ScenarioDiagnostics scenario={a}/></details><details className="science-details"><summary>Scenario B · windows and outages</summary><ScenarioDiagnostics scenario={b}/></details></>}
 </section>;
}
