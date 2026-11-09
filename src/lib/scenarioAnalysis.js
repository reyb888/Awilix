import { computePositions, topocentricAltAz, powerWindow, commWindow } from './ephemeris.js';
import { panelIncidence } from './scienceMath.js';
import { buildHorizon, horizonAt } from './terrainScience.js';
export const WINDOW_HOURS={'24h':24,'48h':48,'7d':168,'14d':336,month:708};
const profiles=new Map();
function profileFor(terrain,height){const key=`${terrain.id}:${terrain.metadata.sha256}:${height}`;if(!profiles.has(key))profiles.set(key,buildHorizon(terrain,height));return profiles.get(key);}
export function analyzeScenario({site,date,hours=24,mode='reference',solarHeight=2,antennaHeight=2,panelTilt=0,panelAzimuth=0},terrain){
  const start=Date.parse(`${date}T00:00:00Z`);
  if(!Number.isFinite(start)||!Number.isFinite(hours)||hours<=0||hours>744)throw new RangeError('Invalid date or window');
  for(const [v,min,max] of [[solarHeight,0,100],[antennaHeight,0,100],[panelTilt,0,90],[panelAzimuth,0,360]])if(!Number.isFinite(v)||v<min||v>max)throw new RangeError('Invalid observer/panel settings');
  if(!['reference','terrain'].includes(mode))throw new RangeError('Unknown visibility mode');
  const solarProfile=terrain?profileFor(terrain,solarHeight):null,earthProfile=terrain?profileFor(terrain,antennaHeight):null;
  const local=mode==='terrain',ground=local?(solarProfile?.centerElevationM??0):0;
  const evaluate=ms=>{
    const p=computePositions(site.lat,site.lon,new Date(ms),{observerHeightM:ground+solarHeight});
    p.earth=topocentricAltAz(site.lat,site.lon,p.subearth.lat,p.subearth.lon,p.subearth.distKm,ground+antennaHeight);
    const solarMask=local?horizonAt(solarProfile,p.sun.az):0,earthMask=local?horizonAt(earthProfile,p.earth.az):0;
    p.sunHorizon=solarMask;p.earthHorizon=earthMask;
    p.sunMargin=solarMask===null?NaN:p.sun.alt-solarMask;p.earthMargin=earthMask===null?NaN:p.earth.alt-earthMask;
    p.powerEfficiency=p.sunMargin>0?panelIncidence(p.sun.alt,p.sun.az,panelTilt,panelAzimuth):0;
    p.commActive=Number.isFinite(p.earthMargin)?p.earthMargin>0:null;
    return p;
  };
  const stepMinutes=hours<=48?10:hours<=168?30:60,end=start+hours*3600000,base=[];
  for(let ms=start;ms<end;ms+=stepMinutes*60000)base.push(evaluate(ms));base.push(evaluate(end));
  // Bracketed crossings are refined against the same geometry to <= 1 second.
  const extra=[];
  for(let i=1;i<base.length;i++)for(const key of ['sunMargin','earthMargin']){
    const a=base[i-1],b=base[i];if(!Number.isFinite(a[key])||!Number.isFinite(b[key])||a[key]*b[key]>=0)continue;
    let lo=+a.time,hi=+b.time,sign=a[key];
    while(hi-lo>1000){const mid=(lo+hi)/2,p=evaluate(mid);if(!Number.isFinite(p[key]))break;if(sign*p[key]>0)lo=mid;else hi=mid;}
    extra.push(evaluate(lo),evaluate(hi));
  }
  const path=[...base,...extra].sort((a,b)=>+a.time-+b.time).filter((p,i,a)=>i===0||+p.time>+a[i-1].time);
  const power=powerWindow(path),comm=commWindow(path),reference=local?{power:powerWindow(path.map(p=>({...p,sunMargin:p.sun.alt}))),comm:commWindow(path.map(p=>({...p,earthMargin:p.earth.alt})))}:null;
  return {site,date,hours,mode,solarHeight,antennaHeight,panelTilt,panelAzimuth,path,power,comm,reference,solarProfile,earthProfile,terrainMetadata:terrain?.metadata??null,terrainExtent:terrain?{widthKm:terrain.widthKm,heightKm:terrain.heightKm}:null,sources:[...new Set(path.map(p=>p.source))],stepMinutes,method:local?'Local terrain crop + reference horizon · experimental':'Reference-sphere horizon · center-of-disk visibility',validation:'Independent SPICE/reference validation pending; numerical crossing refinement is not an accuracy guarantee'};
}
