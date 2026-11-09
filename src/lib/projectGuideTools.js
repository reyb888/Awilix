import {answerProjectQuestion} from './mascotKnowledge.js';
import {requestScenarios} from './scienceClient.js';
export async function answerGuideQuestion(question,context){
 if(!context.scenario&&/showing|current.*scenario|outage|power|sunlight|earth.*visib/i.test(question))return {topic:'pending',reaction:'thinking',text:'The selected scenario is still loading. Please wait for Shared analysis ready before asking for numerical results.',sources:[{label:'Local scenario tools'}],actions:[]};
 const match=question.match(/(?:delay(?:ed)?(?:\s+by)?|later|slip(?:s)?(?:\s+by)?)\D{0,12}(\d{1,2})\s*days?|(?:\b(\d{1,2})\s*days?\s*(?:later|delay))/i);
 if(!match)return answerProjectQuestion(question,context);
 const days=Number(match[1]??match[2]),s=context.scenario;
 if(!s||days<1||days>14)return {topic:'delay',reaction:'puzzled',text:'Wait for the current analysis to finish, then request a delay between 1 and 14 days.',sources:[{label:'Local scenario tools'}],actions:[]};
 const date=new Date(Date.parse(`${s.date}T00:00Z`)+days*86400000).toISOString().slice(0,10);
 const [b]=await requestScenarios([{site:s.site,date,hours:s.hours,mode:s.mode,solarHeight:s.solarHeight,antennaHeight:s.antennaHeight,panelTilt:s.panelTilt,panelAzimuth:s.panelAzimuth}]);
 const f=n=>n.toFixed(2);
 return {topic:'delay',reaction:'pointing',text:`Calculated locally for ${s.site.name}: delay ${s.date} → ${date} (+${days} days), ${s.hours}h window, ${s.mode==='terrain'?'experimental local terrain':'reference sphere'} model. Sun visibility changes ${f(s.power.exactHours)}h → ${f(b.power.exactHours)}h (${f(b.power.exactHours-s.power.exactHours)}h). Earth visibility: ${f(s.comm.exactHours)}h → ${f(b.comm.exactHours)}h. Longest darkness: ${f(s.power.longestOutageHours)}h → ${f(b.power.longestOutageHours)}h. These are model outputs, not guaranteed operational windows. The A/B lab is now pinned to these dates.`,sources:[{label:'Local worker · shared calculation engine'}],actions:[{label:'Open A/B lab',tab:'compare'}],navigateTo:'compare',pins:[{siteId:s.site.id,date:s.date},{siteId:s.site.id,date}]};
}
