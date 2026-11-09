import { loadMoonInfo2026 } from '../lib/ephemeris.js';
import { analyzeScenario } from '../lib/scenarioAnalysis.js';
const cache=new Map();
async function terrainFor(id){
 if(!cache.has(id))cache.set(id,fetch(`/science-terrain/${id}.json`).then(r=>{if(!r.ok)throw Error(`Terrain HTTP ${r.status}`);return r.json();}).catch(()=>null));
 return cache.get(id);
}
self.onmessage=async({data})=>{
 const {id,scenarios}=data;
 try{
  const ephemeris=await loadMoonInfo2026();
  const results=await Promise.all(scenarios.map(async s=>analyzeScenario(s,await terrainFor(s.site.id))));
  self.postMessage({id,results,ephemeris:ephemeris?'nasa':'fallback'});
 }catch(error){self.postMessage({id,error:error.message});}
};
