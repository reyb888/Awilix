const D=Math.PI/180, R=1737400;
export function bilinearGrid(values,n,x,y){
  if(x<0||y<0||x>n-1||y>n-1)return null;
  const i=Math.min(n-2,Math.floor(x)),j=Math.min(n-2,Math.floor(y)),u=x-i,v=y-j;
  const taps=[[i,j,(1-u)*(1-v)],[i+1,j,u*(1-v)],[i,j+1,(1-u)*v],[i+1,j+1,u*v]];let sum=0;
  for(const [a,b,w] of taps){if(w<1e-12)continue;const z=values[b*n+a];if(!Number.isFinite(z))return null;sum+=w*z;}return sum;
}
export function gridToENU(terrain,x,y){
  const dx=(x-terrain.observerGrid.x)*terrain.spacingXM,dy=(y-terrain.observerGrid.y)*terrain.spacingYM;
  if(terrain.projection==='legacy-south-polar'){
    const a=terrain.lon*D;return {east:Math.cos(a)*dx-Math.sin(a)*dy,north:Math.sin(a)*dx+Math.cos(a)*dy};
  }return {east:dx,north:-dy};
}
export function enuToGrid(terrain,east,north){
  let dx=east,dy=-north;
  if(terrain.projection==='legacy-south-polar'){const a=terrain.lon*D;dx=Math.cos(a)*east+Math.sin(a)*north;dy=-Math.sin(a)*east+Math.cos(a)*north;}
  return {x:terrain.observerGrid.x+dx/terrain.spacingXM,y:terrain.observerGrid.y+dy/terrain.spacingYM};
}
export function sampleTerrain(terrain,east,north){const p=enuToGrid(terrain,east,north);return bilinearGrid(terrain.rawElev,terrain.gridSize,p.x,p.y);}
export function buildHorizon(terrain,heightM=2){
  const center=sampleTerrain(terrain,0,0);if(center===null)return {bins:[],status:'Observer elevation unavailable',heightM};
  const spacing=Math.min(terrain.spacingXM,terrain.spacingYM),bins=[];
  for(let az=0;az<360;az+=2){
    let horizon=0,rangeM=0,known=true;
    for(let distance=spacing/2;distance<100000;distance+=spacing/2){
      const east=distance*Math.sin(az*D),north=distance*Math.cos(az*D),p=enuToGrid(terrain,east,north);
      if(p.x<0||p.y<0||p.x>terrain.gridSize-1||p.y>terrain.gridSize-1)break;
      const z=sampleTerrain(terrain,east,north);rangeM=distance;
      if(z===null){known=false;continue;}
      const angle=Math.atan2(z-center-heightM-distance*distance/(2*R),distance)/D;
      horizon=Math.max(horizon,angle);
    }
    bins.push({az,horizon:known?horizon:null,rangeM,known});
  }
  return {bins,heightM,centerElevationM:center,status:'Local crop estimate · far-field terrain unmodeled',minRangeM:Math.min(...bins.map(b=>b.rangeM)),maxRangeM:Math.max(...bins.map(b=>b.rangeM))};
}
export function horizonAt(profile,az){
  if(!profile?.bins?.length)return null;
  const a=((az%360)+360)%360/2,i=Math.floor(a),t=a-i;
  const p=profile.bins[i],q=profile.bins[(i+1)%profile.bins.length];
  if(!Number.isFinite(p.horizon)||!Number.isFinite(q.horizon))return null;
  return p.horizon*(1-t)+q.horizon*t;
}
