import { useState } from 'react';
import { useScience } from './ScienceProvider.jsx';
import { coordinateText } from '../lib/mascotKnowledge.js';
import sites from '../data/sites.json';
import './Science.css';
export default function ScienceControls({scenario,site,onSelectSite}){
 const {loading,error,settings,setSettings,date,hours}=useScience();
 const [draft,setDraft]=useState(settings);
 const [collapsed,setCollapsed]=useState(false);
 function update(key,value){setDraft(s=>({...s,[key]:value}));}
 return <section className="science-console bento-plate" aria-label="Shared science settings">
  <div className="science-console-heading"><div><span className="science-kicker">MISSION WORKSPACE · LOCAL PREVIEW</span><h2>One scenario. Every view in sync.</h2></div><span className={`science-status ${loading?'pending':''}`} role="status">{loading?'Computing in background…':error?'Analysis unavailable':'Shared analysis ready'}</span><button className="btn-ghost text-xs" aria-expanded={!collapsed} onClick={()=>setCollapsed(v=>!v)}>{collapsed?'Expand settings':'Collapse settings'}</button></div>
  {collapsed?<p className="science-caption">{site.name} · {date} UTC · {hours}h · {settings.mode==='terrain'?'Experimental local terrain':'Reference sphere'}</p>:<>
  <div className="science-selection"><label>Landing region<select aria-label="Selected landing region" value={site.id} onChange={e=>onSelectSite(sites.find(s=>s.id===e.target.value))}>{sites.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select></label><label>Visibility model<select aria-label="Visibility model" value={settings.mode} onChange={e=>{const mode=e.target.value;setSettings(s=>({...s,mode}));setDraft(s=>({...s,mode}));}}><option value="reference">Reference sphere</option><option value="terrain">Local terrain estimate · experimental</option></select></label></div>
  <p className="science-caption">{coordinateText(site)} · {date} 00:00 UTC · {hours} hours · Sun/Earth centers · {settings.mode==='terrain'?'Local crop only; far-field obstructions are not modeled.':'Zero-degree tangent horizon; nearby terrain is excluded.'}</p>
  {error&&<p className="science-warning" role="alert">{error}</p>}
  {settings.mode==='terrain'&&<p className="science-warning">Experimental: legacy crop registration and original NoData masks are unverified. These results demonstrate terrain effects; they are not validated landing or radio-link predictions.</p>}
  <details className="science-details"><summary>Observer heights & solar array geometry</summary><form className="science-settings" onSubmit={e=>{e.preventDefault();setSettings({...draft,mode:settings.mode});}}>
   <label>Solar array height (m)<input type="number" min="0" max="100" step="0.5" value={draft.solarHeight} onChange={e=>update('solarHeight',Number(e.target.value))}/></label>
   <label>Antenna height (m)<input type="number" min="0" max="100" step="0.5" value={draft.antennaHeight} onChange={e=>update('antennaHeight',Number(e.target.value))}/></label>
   <label>Array tilt from horizontal (°)<input type="number" min="0" max="90" value={draft.panelTilt} onChange={e=>update('panelTilt',Number(e.target.value))}/></label>
   <label>Array normal azimuth (°)<input type="number" min="0" max="360" value={draft.panelAzimuth} onChange={e=>update('panelAzimuth',Number(e.target.value))}/></label>
   <button className="btn-primary" type="submit">Apply geometry</button><p className="science-caption">Fixed panel normal; no automatic Sun tracking. Incidence is a geometric factor, not electrical efficiency or generated watts.</p>
  </form></details>
  <details className="science-details"><summary>Data & accuracy · sources, coverage, limitations</summary><p className="science-caption"><a href="/DATA_SOURCES.md" target="_blank" rel="noreferrer">Open source, attribution and license notes ↗</a></p><div className="science-data-grid">
   <div><h3>Celestial data</h3><p>{scenario?.sources.join(' + ')??'Loading source information…'}</p><p>NASA table coverage: 1 Jan 2026 00:00 to 31 Dec 2026 23:00 UTC. Outside coverage, an approximate analytical orientation is used. Sun distance in the table path is approximated as 1 AU.</p><a href="https://svs.gsfc.nasa.gov/5587/" target="_blank" rel="noreferrer">NASA SVS 5587 ↗</a></div>
   <div><h3>Terrain evidence</h3><p>{scenario?.terrainMetadata?.sourceProduct??'Terrain unavailable'}</p><p>{scenario?.terrainMetadata?.nativeResolutionDescription}</p><p>Crop: {scenario?.terrainExtent?.widthKm.toFixed(2)} × {scenario?.terrainExtent?.heightKm.toFixed(2)} km between sample centers. Mesh subdivision does not add measured detail.</p><a href="https://pds-geosciences.wustl.edu/missions/lro/lola.htm" target="_blank" rel="noreferrer">LOLA archive documentation ↗</a></div>
   <div><h3>Registration & missing values</h3><p>{scenario?.terrainMetadata?.bodyFixedFrame}</p><p>{scenario?.terrainMetadata?.heightDatum}</p><p>{scenario?.terrainMetadata?.noDataPolicy}</p><p>{scenario?.terrainMetadata?.maskedSamples??'—'} masked samples. Catalog coordinates are comparison markers, not surveyed touchdown points; mission associations are labeled as such and should be checked against the linked primary sources.</p></div>
   <div><h3>Validation status</h3><p>{scenario?.validation??'Independent reference validation pending.'}</p><p>Crossings are bracket-refined to one second; this describes numerical refinement, not physical accuracy. Base sampling: {scenario?.stepMinutes??'—'} minutes; events shorter than the sampling step may be missed.</p><p>Terrain mask uses a curvature-corrected local crop and conservative ≥0° horizon. No refraction, solar-disk fractions, Earth station scheduling, link budget or far-field horizon model.</p><code className="science-hash">Derived input SHA-256: {scenario?.terrainMetadata?.sha256??'—'}</code></div>
  </div></details>
 </>}
  {scenario&&<p className="science-caption science-source-line">{scenario.sources.some(source=>source.includes('fallback'))?'Analytical fallback is in use for part or all of this window; lunar orientation is approximate.':'NASA SVS hourly directions · 2026 table coverage'}</p>}
  {settings.mode==='terrain'&&scenario&&!scenario.terrainMetadata&&<p className="science-warning" role="alert">Terrain is unavailable for this region. Terrain-mode visibility is unknown; switch to Reference sphere to inspect geometric visibility.</p>}
 </section>;
}
