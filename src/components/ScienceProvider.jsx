import { createContext, useContext, useEffect, useState } from 'react';
import sites from '../data/sites.json';
import { WINDOW_HOURS } from '../lib/scenarioAnalysis.js';
import { requestScenarios } from '../lib/scienceClient.js';
const Context=createContext(null);
export function ScienceProvider({children,date,timeWindow}){
 const [settings,setSettings]=useState({mode:'reference',solarHeight:2,antennaHeight:2,panelTilt:0,panelAzimuth:0});
 const [state,setState]=useState({results:[],loading:true,error:null});
 const hours=WINDOW_HOURS[timeWindow]??24;
 const key=JSON.stringify({date,hours,settings});
 useEffect(()=>{
  let alive=true;const spec=JSON.parse(key);
  requestScenarios(sites.map(site=>({site,date:spec.date,hours:spec.hours,...spec.settings}))).then(results=>{if(alive)setState({results,loading:false,error:null,key});}).catch(error=>{if(alive)setState({results:[],loading:false,error:error.message,key});});
  return()=>{alive=false;};
 },[key]);
 const current=state.key===key?state:{results:[],loading:true,error:null};
 const value={...current,date,hours,timeWindow,settings,setSettings,byId:Object.fromEntries(current.results.map(r=>[r.site.id,r]))};
 return <Context.Provider value={value}>{children}</Context.Provider>;
}
export const useScience=()=>useContext(Context);
