let worker,sequence=0;const pending=new Map();
export function requestScenarios(scenarios){
 if(!worker){
  worker=new Worker(new URL('../workers/science.worker.js',import.meta.url),{type:'module'});
  worker.onmessage=({data})=>{const waiter=pending.get(data.id);if(!waiter)return;pending.delete(data.id);clearTimeout(waiter.timer);data.error?waiter.reject(Error(data.error)):waiter.resolve(data.results);};
  worker.onerror=()=>{for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('Science worker failed; reload to retry.'));}pending.clear();worker.terminate();worker=null;};
 }
 return new Promise((resolve,reject)=>{const id=++sequence;const timer=setTimeout(()=>{pending.delete(id);reject(Error('Analysis timed out. Try a shorter window.'));},60000);pending.set(id,{resolve,reject,timer});worker.postMessage({id,scenarios});});
}
