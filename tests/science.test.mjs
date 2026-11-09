import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {interpolateDirection,panelIncidence,positiveWindow} from '../src/lib/scienceMath.js';
import {bilinearGrid,gridToENU,enuToGrid,buildHorizon,horizonAt} from '../src/lib/terrainScience.js';
import {MOON_RADIUS_KM,computePath,topocentricAltAz,loadMoonInfo2026,getSubPoints,validateMoonInfo2026} from '../src/lib/ephemeris.js';
import {analyzeScenario} from '../src/lib/scenarioAnalysis.js';
import {answerProjectQuestion,coordinateText} from '../src/lib/mascotKnowledge.js';
const near=(a,b,e=1e-7)=>assert.ok(Math.abs(a-b)<e,`${a} ≠ ${b}`);
const sample=(hour,alt)=>({time:new Date(Date.UTC(2026,0,1)+hour*3600000),sun:{alt},earth:{alt},powerEfficiency:.5});
test('spherical interpolation crosses ±180 rather than zero',()=>{near(Math.abs(interpolateDirection({lat:0,lon:179},{lat:0,lon:-179},.5).lon),180);near(interpolateDirection({lat:0,lon:20},{lat:0,lon:20},.3).lon,20);assert.throws(()=>interpolateDirection({lat:0,lon:0},{lat:0,lon:180},.5));});
test('coordinate formatter labels signed lunar latitude and east-positive longitude',()=>{assert.equal(coordinateText({lat:-89.5,lon:-2}),'89.5°S, 2.0°W');assert.equal(coordinateText({lat:17,lon:59.1}),'17.0°N, 59.1°E');assert.equal(coordinateText({lat:0,lon:0}),'0.0°, 0.0°');});
test('Astra mission answers cite primary sources and distinguish regional markers',()=>{const c={site:{id:'mare-crisium',name:'Mare Crisium',lat:17,lon:59.1,targetRegion:'Crisium basin',mission:'Blue Ghost 1 regional marker'},date:'2026-11-09',timeWindow:'24h',activeTab:'compare',power:{hours:12},comm:{hours:24}};const answer=answerProjectQuestion('What is the Blue Ghost mission status?',c);assert.ok(answer.sources.some(s=>s.href?.includes('fireflys-first-moon-mission-concludes')));const siteAnswer=answerProjectQuestion('Tell me about this site',c);assert.match(siteAnswer.text,/regional comparison marker, not a surveyed touchdown coordinate/);assert.equal(siteAnswer.sources.at(-1).href,'https://www.nasa.gov/news-release/nasa-science-continues-after-fireflys-first-moon-mission-concludes/');});
test('elapsed duration integration handles irregular time samples and crossings',()=>{const p=[sample(0,-1),sample(1,1),sample(5,1),sample(6,-1)];const w=positiveWindow(p,p=>p.sun.alt,p=>p.sun.alt);near(w.exactHours,5);near(w.longestOutageHours,.5);near(w.intervals[0].start,+p[0].time+1800000);});
test('all visible, all blocked, empty and single samples have honest durations',()=>{for(const [path,hours] of [[[sample(0,1),sample(5,1)],5],[[sample(0,-1),sample(5,-1)],0],[[],0],[[sample(0,1)],0]])near(positiveWindow(path,p=>p.sun.alt,p=>p.sun.alt).exactHours,hours);});
test('missing telemetry is unknown, not a confirmed outage',()=>{const r=positiveWindow([sample(0,1),sample(1,NaN),sample(2,1)],p=>p.sun.alt,p=>p.sun.alt);near(r.unknownHours,2);near(r.longestOutageHours,0);});
test('fixed-panel incidence has clear physical limits',()=>{near(panelIncidence(0,0,0,0),0);near(panelIncidence(90,0,0,0),1);near(panelIncidence(0,0,90,0),1);near(panelIncidence(0,180,90,0),0);});
test('bilinear interpolation masks missing weighted taps and never extrapolates',()=>{near(bilinearGrid([1,2,3,4],2,.5,.5),2.5);assert.equal(bilinearGrid([1,null,3,4],2,.5,.5),null);near(bilinearGrid([1,null,3,4],2,0,0),1);assert.equal(bilinearGrid([1,2,3,4],2,-1,0),null);});
const terrain={id:'flat',lon:29,gridSize:21,rawElev:Array(441).fill(0),observerGrid:{x:10,y:10},spacingXM:100,spacingYM:100,projection:'legacy-south-polar',metadata:{sha256:'test'}};
test('polar raster and ENU transforms round trip for multiple meridians',()=>{for(const lon of [0,29,90,180,-60]){const t={...terrain,lon},v=gridToENU(t,13,6),g=enuToGrid(t,v.east,v.north);near(g.x,13);near(g.y,6);}});
test('flat horizon and synthetic ridge distinguish clear and blocked directions',()=>{const flat={...terrain,lon:0,projection:'legacy-equirectangular'},profile=buildHorizon(flat,2);near(horizonAt(profile,0),0);const z=[...flat.rawElev];for(let x=0;x<21;x++)z[5*21+x]=200;const ridge=buildHorizon({...flat,rawElev:z},2);assert.ok(horizonAt(ridge,0)>15);near(horizonAt(ridge,180),0);near(horizonAt(ridge,360),horizonAt(ridge,0));});
test('topocentric ENU yields zenith and near-horizontal geometry',()=>{near(topocentricAltAz(0,0,0,0,1e9).alt,90);const east=topocentricAltAz(0,0,0,90,1e9);near(east.az,90);assert.ok(Math.abs(east.alt)<.001);});
test('paths include exact end for a fractional step and reject invalid inputs',()=>{const p=computePath(0,0,new Date('2026-01-01Z'),1.5,60);assert.equal(p.length,3);near((+p.at(-1).time-+p[0].time)/3600000,1.5);assert.throws(()=>computePath(0,0,new Date(),-1));assert.throws(()=>computePath(0,0,new Date(),1,0));});
test('NASA table endpoints, worker scenario consistency and local terrain reduction',async()=>{
 const old=globalThis.fetch;globalThis.fetch=async()=>new Response(await fs.readFile(new URL('../public/data/mooninfo_2026.json',import.meta.url)));
 try{const d=await loadMoonInfo2026();assert.equal(d.length,8760);assert.match(getSubPoints(new Date('2026-12-31T23:00Z')).source,/NASA/);assert.match(getSubPoints(new Date('2027-01-01T00:00Z')).source,/fallback/);
 const site={id:'south-pole',name:'South Pole',lat:-90,lon:0},t=JSON.parse(await fs.readFile(new URL('../public/science-terrain/south-pole.json',import.meta.url)));
 const a=analyzeScenario({site,date:'2026-10-31',hours:24},t),b=analyzeScenario({site,date:'2026-10-31',hours:24,mode:'terrain'},t);
 near(a.power.totalHours,24);assert.ok(b.power.exactHours<=b.reference.power.exactHours+1e-7);assert.ok(b.comm.exactHours<=b.reference.comm.exactHours+1e-7);assert.ok(a.sources.every(s=>s.includes('NASA')));
 }finally{globalThis.fetch=old;}
});
test('hourly ephemeris validation rejects shifted, unordered and out-of-range rows',async()=>{
 const data=JSON.parse(await fs.readFile(new URL('../public/data/mooninfo_2026.json',import.meta.url)));
 assert.equal(validateMoonInfo2026(data),true);
 for(const mutate of [
  rows=>{rows[10]={...rows[10],time:rows[9].time};},
  rows=>{rows[0]={...rows[0],subsolar:{...rows[0].subsolar,lat:91}};},
  rows=>{rows[0]={...rows[0],subearth:{...rows[0].subearth,lon:181}};},
  rows=>{rows[0]={...rows[0],distance:MOON_RADIUS_KM};},
 ]){const bad=[...data];mutate(bad);assert.throws(()=>validateMoonInfo2026(bad));}
 assert.throws(()=>validateMoonInfo2026(data.slice(1)));
});
