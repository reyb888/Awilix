const D=Math.PI/180;
export function interpolateDirection(a,b,t){
  const vector=p=>[Math.cos(p.lat*D)*Math.cos(p.lon*D),Math.cos(p.lat*D)*Math.sin(p.lon*D),Math.sin(p.lat*D)];
  const u=vector(a),v=vector(b),dot=Math.max(-1,Math.min(1,u.reduce((s,x,i)=>s+x*v[i],0))),theta=Math.acos(dot);
  if(dot < -0.999999) throw new RangeError('Ambiguous antipodal direction interpolation');
  const w=theta<1e-7?u.map((x,i)=>x*(1-t)+v[i]*t):u.map((x,i)=>(x*Math.sin((1-t)*theta)+v[i]*Math.sin(t*theta))/Math.sin(theta));
  return {lon:Math.atan2(w[1],w[0])/D,lat:Math.atan2(w[2],Math.hypot(w[0],w[1]))/D};
}
export function panelIncidence(alt,az,tilt=0,panelAz=0){
  // Tilt from horizontal, normal azimuth clockwise from lunar north.
  return Math.max(0,Math.min(1,Math.sin(alt*D)*Math.cos(tilt*D)+Math.cos(alt*D)*Math.sin(tilt*D)*Math.cos((az-panelAz)*D)));
}
export function positiveWindow(path,margin,value){
  const intervals=[],unknown=[];let integral=0,altIntegral=0,effIntegral=0,knownMs=0,maxAlt=-Infinity;
  function append(list,start,end){if(end<=start)return;const last=list.at(-1);if(last&&Math.abs(last.end-start)<1)last.end=end;else list.push({start,end});}
  for(let i=1;i<path.length;i++){
    const a=path[i-1],b=path[i],start=+new Date(a.time),end=+new Date(b.time),dt=end-start;
    if(!Number.isFinite(dt)||dt<=0)throw new RangeError('Samples must have increasing timestamps');
    const x=margin(a),y=margin(b);
    if(!Number.isFinite(x)||!Number.isFinite(y)){append(unknown,start,end);continue;}
    knownMs+=dt;maxAlt=Math.max(maxAlt,value(a),value(b));
    let l=0,r=1;
    if(x<=0&&y<=0)continue;
    if(x<=0)l=-x/(y-x);else if(y<=0)r=x/(x-y);
    const span=(r-l)*dt,va=value(a),vb=value(b),effA=a.powerEfficiency??0,effB=b.powerEfficiency??0;
    integral+=span;altIntegral+=span*(va+(vb-va)*(l+r)/2);effIntegral+=span*(effA+(effB-effA)*(l+r)/2);
    append(intervals,start+l*dt,start+r*dt);
  }
  const start=path.length?+new Date(path[0].time):0,end=path.length?+new Date(path.at(-1).time):start;
  const blocked=[];
  // Unknown intervals are excluded rather than described as a confirmed outage.
  const exclusions=[...intervals,...unknown].sort((a,b)=>a.start-b.start);let cursor=start;
  for(const e of exclusions){if(e.start>cursor)append(blocked,cursor,e.start);cursor=Math.max(cursor,e.end);}if(cursor<end)append(blocked,cursor,end);
  return {hours:Math.round(integral/360000)/10,exactHours:integral/3600000,totalHours:(end-start)/3600000,knownHours:knownMs/3600000,unknownHours:((end-start)-knownMs)/3600000,avgAlt:integral?Math.round(altIntegral/integral*10)/10:0,maxAlt:Number.isFinite(maxAlt)?Math.round(maxAlt*10)/10:0,avgEfficiency:integral?Math.round(effIntegral/integral*100):0,availabilityPercent:end>start?Math.round(integral/(end-start)*1000)/10:0,intervals,blocked,longestOutageHours:blocked.reduce((v,r)=>Math.max(v,(r.end-r.start)/3600000),0),nextSet:intervals.find(r=>r.end<end)?.end??null};
}
