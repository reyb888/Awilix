import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ChevronDown, Compass, ExternalLink, MessageCircle, GripHorizontal, MoveDiagonal2, Minus, Send, Sparkles, VolumeX, X } from 'lucide-react';
import { answerProjectQuestion, coordinateText, TOUR_STEPS, VIEW_NAMES } from '../lib/mascotKnowledge.js';
import './AstronautGuide.css';
import {answerGuideQuestion} from '../lib/projectGuideTools.js';
import useMovableOverlay from './useMovableOverlay.js';
import useResizableOverlay from './useResizableOverlay.js';

const ALLOWED_TABS = Object.keys(VIEW_NAMES);
const POSE_NAMES = { idle:'Ready to help', waving:'Hello, explorer', pointing:'Let me show you', thinking:'Checking project notes', celebrating:'One small leap!', puzzled:'Let’s check the evidence' };
const SUGGESTIONS = {
  globe:['What is this screen showing?', 'Explain the scale controls', 'What data does Awilix use?'],
  terrain:['Is this really 20 m elevation data?', 'How does interpolation work?', 'What makes a permanently shadowed region?'],
  analytics:['What do these graphs show?', 'Why is solar efficiency so high?', 'Is this a guaranteed DSN link?'],
  compare:['What if landing is delayed by 3 days?', 'Which landing site is best?', 'What are the accuracy limitations?'],
  assistant:['Are you connected to a cloud AI?', 'Explain the project', 'Show me the terrain'],
};

function Sprite({ pose, className='' }) {
  return <span className={`astra-sprite astra-sprite-${pose} ${className}`} aria-hidden="true" />;
}

export default function AstronautGuide({ site, date, timeWindow, power, comm, activeTab, onNavigate, scenario, onComparePins }) {
  const [open,setOpen]=useState(false);
  const [minimized,setMinimized]=useState(false);
  const [pose,setPose]=useState('idle');
  const [jumpKey,setJumpKey]=useState(0);
  const [question,setQuestion]=useState('');
  const [busy,setBusy]=useState(false);
  const [messages,setMessages]=useState([]);
  const [tourIndex,setTourIndex]=useState(null);
  const [spotlight,setSpotlight]=useState(null);
  const [used,setUsed]=useState(false);
  const [motionPaused,setMotionPaused]=useState(()=>{try{return localStorage.getItem('awilix-astra-motion')==='paused';}catch{return false;}});
  const [systemReduced,setSystemReduced]=useState(()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const panelMove=useMovableOverlay(open);
  const panelSize=useResizableOverlay(panelMove.ref,panelMove.place,open);
  const dockMove=useMovableOverlay(minimized?'minimized':'dock');
  const conversationRef=useRef(null),launcherRef=useRef(null),answerTimer=useRef(null),poseTimer=useRef(null),inputRef=useRef(null);
  const motionOff=motionPaused||systemReduced;
  const step=tourIndex===null?null:TOUR_STEPS[tourIndex];
  const context={site,date,timeWindow,power,comm,activeTab,scenario};
  const contextLabel=`${site.name} · ${date} UTC · ${timeWindow}`;

  useEffect(()=>{
    const media=window.matchMedia('(prefers-reduced-motion: reduce)');
    const update=()=>setSystemReduced(media.matches);media.addEventListener('change',update);
    return()=>{media.removeEventListener('change',update);clearTimeout(answerTimer.current);clearTimeout(poseTimer.current);};
  },[]);
  useEffect(()=>{try{localStorage.setItem('awilix-astra-motion',motionPaused?'paused':'on');}catch{/* Optional preference storage. */}},[motionPaused]);
  useEffect(()=>{if(open&&!step){const log=conversationRef.current;log?.scrollTo({top:messages.length?log.scrollHeight:0,behavior:motionOff?'auto':'smooth'});}},[messages,busy,open,step,motionOff]);

  function react(next,duration=1800){
    clearTimeout(poseTimer.current);setPose(next);
    if(next==='celebrating')setJumpKey(v=>v+1);
    poseTimer.current=setTimeout(()=>setPose('idle'),duration);
  }
  function navigate(tab){if(ALLOWED_TABS.includes(tab))onNavigate(tab);}
  function reveal(){setOpen(true);setMinimized(false);setUsed(true);react('waving');}
  function close(){setOpen(false);setTourIndex(null);setSpotlight(null);react('idle');requestAnimationFrame(()=>launcherRef.current?.focus());}
  function minimize(){close();setMinimized(true);}
  function startTour(){
    clearTimeout(answerTimer.current);setBusy(false);setOpen(true);setUsed(true);setMinimized(false);setTourIndex(0);navigate(TOUR_STEPS[0].tab);react('waving');
  }
  function changeStep(index){
    if(index>=TOUR_STEPS.length){
      setTourIndex(null);setSpotlight(null);react('celebrating',2400);
      setMessages(m=>[...m,{id:crypto.randomUUID(),role:'assistant',text:'Tour complete. You have explored the globe, terrain, telemetry, comparison graphs, and Mission AI. Ask me what any calculation or dataset means, or where its limits are.',sources:[],actions:[]}]);
      return;
    }
    const next=TOUR_STEPS[index];setTourIndex(index);navigate(next.tab);react(next.pose,2200);
  }
  function stopTour(){setTourIndex(null);setSpotlight(null);react('waving');}

  useEffect(()=>{
    if(!open||tourIndex===null){setSpotlight(null);return;}
    const current=TOUR_STEPS[tourIndex];
    // Keep the tour and its selected view synchronized. A tab change may render
    // one frame after the step update, so do not cancel the tour on that frame.
    if(activeTab!==current.tab){setSpotlight(null);navigate(current.tab);return;}
    let target,observer,timer;
    const position=()=>{
      if(!target||!target.isConnected)return;
      const r=target.getBoundingClientRect();
      const top=Math.max(6,r.top-5),left=Math.max(6,r.left-5),right=Math.min(window.innerWidth-6,r.right+5),bottom=Math.min(window.innerHeight-6,r.bottom+5);
      setSpotlight(right>left&&bottom>top?{top,left,width:right-left,height:bottom-top}:null);
    };
    const startedAt=performance.now();
    const attach=()=>{
      target=document.querySelector(current.target);
      if(!target){
        setSpotlight(null);
        if(performance.now()-startedAt<3000)timer=setTimeout(attach,100);
        return;
      }
      target.scrollIntoView({block:'center',behavior:motionOff?'auto':'smooth'});
      position();observer=new ResizeObserver(position);observer.observe(target);
    };
    timer=setTimeout(attach,120);
    window.addEventListener('scroll',position,true);window.addEventListener('resize',position);
    return()=>{clearTimeout(timer);observer?.disconnect();window.removeEventListener('scroll',position,true);window.removeEventListener('resize',position);};
  },[open,tourIndex,activeTab,motionOff]);

  function ask(raw){
    const text=raw.trim().slice(0,1200);if(!text||busy)return;
    setTourIndex(null);setSpotlight(null);setUsed(true);setOpen(true);setQuestion('');
    setMessages(m=>[...m,{id:crypto.randomUUID(),role:'user',text}]);setBusy(true);clearTimeout(poseTimer.current);setPose('thinking');
    // Brief UI transition; the lookup itself is entirely local and deterministic.
    answerTimer.current=setTimeout(async()=>{
      try{
        const answer=await answerGuideQuestion(text,context);
        if(answer.pins)onComparePins?.(answer.pins);
        setMessages(m=>[...m,{id:crypto.randomUUID(),role:'assistant',...answer,contextLabel}]);
        if(answer.navigateTo)navigate(answer.navigateTo);
        react(answer.reaction||'waving',answer.reaction==='celebrating'?2400:1800);
      }catch{
        setMessages(m=>[...m,{id:crypto.randomUUID(),role:'assistant',text:'I could not read the local project context. Try again after the current view finishes loading. No question was sent to a cloud service.',sources:[],actions:[]}]);react('puzzled');
      }finally{setBusy(false);}
    },motionOff?0:380);
  }

  const greeting=<div className="astra-welcome">
    <div className="astra-welcome-art"><Sprite pose="waving" /></div>
    <div className="astra-eyebrow">ONE SMALL STEP. A CLEARER MISSION.</div>
    <h3>Hi, I’m Astra.</h3>
    <p>I’ll help you find your way around the Moon—and this website. Explore with me, or ask about the data behind your scenario.</p>
    <button className="astra-tour-start" onClick={startTour}><Compass size={15}/> Take the guided tour <ArrowRight size={14}/></button>
    <button className="astra-ask-start" onClick={()=>inputRef.current?.focus()}><MessageCircle size={13}/> I have a question</button>
  </div>;

  return <div className={`astra-root ${motionOff?'astra-motion-off':''}`} data-reaction={pose} onKeyDown={event=>{if(event.key==='Escape'&&open){event.stopPropagation();close();}}}>
    {spotlight&&<div className="astra-spotlight" style={spotlight} aria-hidden="true"/>}
    {open&&<section ref={panelMove.ref} style={{...panelMove.style,...panelSize.style,...(step?{width:'min(320px, calc(100vw - 24px))',height:'min(340px, calc(100dvh - 24px))',maxWidth:'calc(100vw - 24px)',maxHeight:'calc(100dvh - 24px)',right:12,bottom:12,left:'auto',top:'auto'}:{})}} className={`astra-panel ${step?'astra-panel-touring':''} ${panelMove.dragging||panelSize.resizing?'astra-dragging':''}`} role="dialog" aria-modal="false" aria-label="Astra astronaut guide">
      <header className="astra-header astra-drag-handle" {...panelMove.handlers}><div className="astra-avatar"><Sprite pose={pose}/></div><div className="astra-identity"><div><strong>Astra</strong><span className="astra-local">LOCAL GUIDE</span></div><p>Your lunar companion · drag header to move</p></div><button className="astra-move-handle" data-move-handle="true" aria-label="Move guide: drag or use arrow keys; Home resets position" title="Drag to move · arrow keys move · Home resets"><GripHorizontal size={17}/></button><div className="astra-header-tools" data-no-drag><button onClick={()=>setMotionPaused(v=>!v)} aria-label={motionPaused?'Enable mascot animation':'Pause mascot animation'} aria-pressed={motionPaused} title={systemReduced?'System reduced-motion preference is respected':motionPaused?'Enable animation':'Pause animation'}><VolumeX size={14}/></button><button onClick={minimize} aria-label="Minimize astronaut" title="Minimize astronaut"><Minus size={15}/></button><button onClick={close} aria-label="Close guide" title="Close guide"><X size={15}/></button></div></header>
      <div className="astra-context"><span className="astra-context-dot"/><span>{VIEW_NAMES[activeTab]} · {site.name}</span><small>{date} UTC · {timeWindow}</small></div>
      {step?<div className="astra-tour-body">
        <div className="astra-tour-progress" aria-label={`Tour step ${tourIndex+1} of ${TOUR_STEPS.length}`}>{TOUR_STEPS.map((_,i)=><span key={i} className={i<=tourIndex?'done':''}/>)}</div>
        <div className="astra-tour-art"><Sprite pose={step.pose}/></div>
        <div className="astra-eyebrow">STEP {String(tourIndex+1).padStart(2,'0')} / {String(TOUR_STEPS.length).padStart(2,'0')}</div>
        <h3>{step.title}</h3><p>{step.text}</p>
        <div className="astra-tour-actions"><button onClick={()=>changeStep(tourIndex-1)} disabled={tourIndex===0}><ArrowLeft size={14}/> Back</button><button className="astra-next" onClick={()=>changeStep(tourIndex+1)}>{tourIndex===TOUR_STEPS.length-1?'Finish tour':'Next stop'}{tourIndex===TOUR_STEPS.length-1?<Check size={14}/>:<ArrowRight size={14}/>}</button></div>
        <button className="astra-tour-skip" onClick={stopTour}>Skip tour · ask a question instead</button>
      </div>:<>
        <div ref={conversationRef} className="astra-conversation" role="log" aria-live="polite" aria-relevant="additions text">
          {messages.length===0?greeting:messages.map(message=><article key={message.id} className={`astra-message astra-message-${message.role}`}>
            {message.role==='assistant'&&<div className="astra-message-name"><Sparkles size={10}/> ASTRA <span>PROJECT KNOWLEDGE</span></div>}
            <p>{message.text}</p>
            {message.contextLabel&&<div className="astra-answer-context">Context: {message.contextLabel}</div>}
            {message.sources?.length>0&&<div className="astra-sources">{message.sources.map((source,index)=>source.href?<a key={index} href={source.href} target="_blank" rel="noreferrer">{source.label}<ExternalLink size={9}/></a>:<span key={index}>{source.label}</span>)}</div>}
            {message.actions?.length>0&&<div className="astra-answer-actions">{message.actions.map(a=><button key={a.tab} onClick={()=>{navigate(a.tab);react('pointing');}}>{a.label}<ArrowRight size={11}/></button>)}</div>}
          </article>)}
          {busy&&<div className="astra-thinking" role="status"><span/><span/><span/> Checking local project notes</div>}
        </div>
        <div className="astra-suggestions">{SUGGESTIONS[activeTab].slice(0,messages.length?2:3).map(s=><button key={s} onClick={()=>ask(s)} disabled={busy}>{s}<ArrowRight size={10}/></button>)}</div>
        <form className="astra-input-row" onSubmit={e=>{e.preventDefault();ask(question);}}><label className="astra-sr-only" htmlFor="astra-question">Ask Astra about Awilix</label><input ref={inputRef} id="astra-question" value={question} onChange={e=>setQuestion(e.target.value)} placeholder="Ask about this view, the data, or your mission…" maxLength={1200} autoComplete="off"/><button type="submit" disabled={!question.trim()||busy} aria-label="Send question"><Send size={15}/></button></form>
        <div className="astra-footer"><span>Local tools & knowledge · no cloud model</span><button onClick={()=>{setMessages([]);setQuestion('');react('waving');}} disabled={busy}>Clear</button><button onClick={startTour}>Tour <Compass size={10}/></button></div>
      </>}
      <div className="astra-resize-bar"><span>Panel size</span><button onClick={()=>panelSize.adjustHeight(-100)} aria-label="Make Astra panel shorter">Shorter</button><button onClick={()=>panelSize.adjustHeight(100)} aria-label="Make Astra panel taller">Taller</button><button onClick={panelSize.reset} aria-label="Reset Astra panel size">Reset</button><button {...panelSize.handlers} className="astra-resize-handle" aria-label="Resize Astra panel: drag corner or use arrow keys; Home resets size" title="Drag to resize · arrows adjust width/height · Home resets"><MoveDiagonal2 size={16}/></button></div>
    </section>}
    {minimized?<button className="astra-minimized astra-drag-handle" ref={dockMove.ref} style={dockMove.style} {...dockMove.handlers} data-move-handle="true" title="Drag to move · click to open · arrow keys move · Home resets" onClick={reveal} aria-label="Restore Astra astronaut guide"><Sprite pose="idle"/><span>Astra</span><ChevronDown size={12}/></button>:<div ref={dockMove.ref} style={dockMove.style} className={`astra-dock ${dockMove.dragging?'astra-dragging':''}`}>
      {!open&&!used&&!dockMove.position&&<button className="astra-greeting" onClick={reveal}><span>Need a hand, explorer?</span><small>I’m Astra. Let’s look around. <ArrowRight size={11}/></small></button>}
      <button key={jumpKey} {...dockMove.handlers} className={`astra-launcher astra-drag-handle astra-reaction-${pose}`} ref={launcherRef} onClick={()=>open?close():reveal()} aria-label={open?'Close Astra astronaut guide':'Open Astra astronaut guide'} aria-expanded={open} title={`${POSE_NAMES[pose]} · Drag to move · Click to chat`}><Sprite pose={pose}/><span className="astra-nameplate"><i/> ASTRA</span></button>
      <div className="astra-dock-controls"><button {...dockMove.handlers} data-move-handle="true" aria-label="Move astronaut: drag or use arrow keys; Home resets position" title="Drag to move · arrow keys move · Home resets"><GripHorizontal size={12}/></button><button onClick={()=>react('celebrating',2400)} aria-label="Make Astra jump" title="One small hop"><Sparkles size={12}/></button><button onClick={()=>setMotionPaused(v=>!v)} aria-label={motionPaused?'Enable mascot animation':'Pause mascot animation'} title={motionPaused?'Enable animation':'Pause animation'} aria-pressed={motionPaused}><VolumeX size={12}/></button><button onClick={minimize} aria-label="Minimize astronaut" title="Minimize astronaut"><Minus size={12}/></button></div>
    </div>}
    <span className="astra-sr-only">Current site: {coordinateText(site)}. {motionOff?'Mascot motion is paused.':''}</span>
  </div>;
}
