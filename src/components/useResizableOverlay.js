import { useEffect, useRef, useState } from 'react';
import { clampOverlaySize } from '../lib/overlaySize.js';

export default function useResizableOverlay(panelRef, place, visible) {
  const [size,setSize] = useState(null);
  const [resizing,setResizing] = useState(false);
  const gesture = useRef(null);
  const apply = (width,height,anchor) => {
    const next = clampOverlaySize(width,height,window.innerWidth,window.innerHeight);
    place(anchor.left,anchor.top,next.width,next.height);
    setSize(next);
  };
  const adjustHeight = delta => {
    const r = panelRef.current?.getBoundingClientRect();
    if(r)apply(r.width,r.height+delta,r);
  };
  useEffect(()=>{
    if(!visible)return;
    const fit=()=>setSize(previous=>{
      if(!previous)return previous;
      const next=clampOverlaySize(previous.width,previous.height,window.innerWidth,window.innerHeight);
      return next.width===previous.width&&next.height===previous.height?previous:next;
    });
    window.addEventListener('resize',fit);
    return()=>window.removeEventListener('resize',fit);
  },[visible]);
  const handlers={
    onPointerDown(event){
      if(event.button!==0)return;
      event.preventDefault();
      const r=panelRef.current.getBoundingClientRect();
      gesture.current={id:event.pointerId,x:event.clientX,y:event.clientY,width:r.width,height:r.height,left:r.left,top:r.top};
      event.currentTarget.setPointerCapture(event.pointerId);setResizing(true);
    },
    onPointerMove(event){
      const g=gesture.current;if(!g||g.id!==event.pointerId)return;
      apply(g.width+event.clientX-g.x,g.height+event.clientY-g.y,g);
    },
    onPointerUp(event){
      if(gesture.current?.id!==event.pointerId)return;
      gesture.current=null;setResizing(false);
      if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
    },
    onPointerCancel(){gesture.current=null;setResizing(false);},
    onKeyDown(event){
      const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];
      if(event.key==='Home'){event.preventDefault();setSize(null);return;}
      if(!delta)return;
      event.preventDefault();const r=panelRef.current.getBoundingClientRect(),step=event.shiftKey?64:24;
      apply(r.width+delta[0]*step,r.height+delta[1]*step,r);
    },
  };
  return {handlers,resizing,adjustHeight,reset:()=>setSize(null),style:size?{width:size.width,height:size.height,maxWidth:'calc(100vw - 16px)',maxHeight:'calc(100dvh - 16px)'}:undefined};
}
