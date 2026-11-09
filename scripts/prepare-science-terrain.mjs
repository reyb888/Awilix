// Reproducible normalization of the bundled legacy products. No claim of verified georegistration.
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const sites=JSON.parse(await fs.readFile('src/data/sites.json'));
const target='public/science-terrain';await fs.mkdir(target,{recursive:true});const manifest=[];
for(const site of sites){
 const file=`public/terrain/${site.id}_terrain.json`,bytes=await fs.readFile(file),old=JSON.parse(bytes),polar=site.lat<=-80,n=old.gridSize;
 const rawElev=old.rawElev.map(z=>Number.isFinite(z)&&z>=-15000&&z<=15000&&z!==0?z:null);
 const pxPerDeg=16,metersPerDegree=1737400*Math.PI/180;
 // Polar source grid is 128 native 80m samples; equatorial file is 32 pixels resampled to 128.
 const spacingYM=polar?80:31*metersPerDegree/pxPerDeg/(n-1),spacingXM=polar?80:spacingYM*Math.cos(site.lat*Math.PI/180);
 const observerGrid=polar?{x:64,y:64}:{x:16/31*(n-1),y:16/31*(n-1)};
 const elevations=rawElev.filter(Number.isFinite);
 const data={id:site.id,name:site.name,lat:site.lat,lon:site.lon,gridSize:n,rawElev,observerGrid,spacingXM,spacingYM,projection:polar?'legacy-south-polar':'legacy-equirectangular',widthKm:spacingXM*(n-1)/1000,heightKm:spacingYM*(n-1)/1000,patchKm:spacingXM*(n-1)/1000,minElevationM:Math.min(...elevations),maxElevationM:Math.max(...elevations),elevationSpanM:Math.max(...elevations)-Math.min(...elevations),textureUrl:old.textureUrl,
 metadata:{sourceFile:file.replace('public/',''),sha256:crypto.createHash('sha256').update(bytes).digest('hex'),sourceProduct:polar?'LOLA LDEM 80S · legacy derived crop':'LDEM16 · legacy 32×32 crop resampled to 128×128',nativeResolutionM:polar?80:null,nativeResolutionDescription:polar?'80 m elevation; 20 m mask is a separate product':'16 pixels/degree (~1.90 km north-south)',displaySamplingM:[spacingXM,spacingYM],coordinateConvention:'Planetocentric latitude; east-positive longitude',bodyFixedFrame:'Unspecified in legacy export; independent registration pending',heightDatum:'Assumed metres relative to 1737.4 km reference radius; source labels missing',projectionStatus:'Reconstructed from repository builder; not verified against original PDS labels',noDataPolicy:'Non-finite, out-of-range and legacy zero-filled values masked; original validity cannot be recovered',maskedSamples:rawElev.length-elevations.length,quality:'Experimental legacy-derived terrain',catalogStatus:'Regional example coordinates; mission status and exact touchdown positions unverified',sourceUrl:'https://pds-geosciences.wustl.edu/missions/lro/lola.htm'}};
 await fs.writeFile(`${target}/${site.id}.json`,JSON.stringify(data));manifest.push({id:site.id,...data.metadata,widthKm:data.widthKm,heightKm:data.heightKm});
}
await fs.writeFile(`${target}/manifest.json`,JSON.stringify(manifest,null,2));console.log(`Prepared ${manifest.length} masked terrain crops with source hashes and reconstructed dimensions.`);
