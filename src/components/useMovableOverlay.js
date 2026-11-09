import { useEffect, useRef, useState } from 'react';
import { clampOverlayPosition } from '../lib/overlayPosition.js';

// Pointer capture keeps mouse, pen and touch gestures attached to their handle.
export default function useMovableOverlay(visible) {
  const ref = useRef(null), gesture = useRef(null), suppressClick = useRef(false);
  const [position, setPosition] = useState(null);
  const [dragging, setDragging] = useState(false);
  const clamp = (x,y,r) => clampOverlayPosition(x,y,r.width,r.height,window.innerWidth,window.innerHeight);
  useEffect(() => {
    const element = ref.current;
    if (!visible || !element) return;
    const keepVisible = () => {
      const r = element.getBoundingClientRect();
      const next = clamp(r.left,r.top,r);
      if (Math.abs(next.x-r.left)>.5 || Math.abs(next.y-r.top)>.5) setPosition(next);
    };
    window.addEventListener('resize',keepVisible);
    const observer = new ResizeObserver(keepVisible); observer.observe(element);
    return () => { observer.disconnect();window.removeEventListener('resize',keepVisible); };
  },[visible]);
  const handlers = {
    onPointerDown(event) {
      if (event.button !== 0 || event.target.closest('[data-no-drag]')) return;
      const r = ref.current.getBoundingClientRect();
      gesture.current = {id:event.pointerId,x:event.clientX,y:event.clientY,left:r.left,top:r.top,moved:false};
      suppressClick.current=false;
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove(event) {
      const g=gesture.current;if(!g||g.id!==event.pointerId)return;
      const dx=event.clientX-g.x,dy=event.clientY-g.y;
      if(!g.moved && Math.hypot(dx,dy)<5)return;
      g.moved=true;suppressClick.current=true;setDragging(true);
      setPosition(clamp(g.left+dx,g.top+dy,ref.current.getBoundingClientRect()));
    },
    onPointerUp(event) {
      if(gesture.current?.id!==event.pointerId)return;
      gesture.current=null;setDragging(false);
      if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
    },
    onPointerCancel() { gesture.current=null;suppressClick.current=false;setDragging(false); },
    onClickCapture(event) {
      if(suppressClick.current){event.preventDefault();event.stopPropagation();suppressClick.current=false;}
    },
    onKeyDown(event) {
      // Only the labelled move handle owns arrow keys, never chat input or tour controls.
      if(event.target.dataset.moveHandle!=='true')return;
      const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];
      if(event.key==='Home'){event.preventDefault();setPosition(null);return;}
      if(!delta)return;
      event.preventDefault();const r=ref.current.getBoundingClientRect(),step=event.shiftKey?40:16;
      setPosition(clamp(r.left+delta[0]*step,r.top+delta[1]*step,r));
    },
  };
  return {ref,handlers,dragging,position,place:(x,y,width,height)=>setPosition(clamp(x,y,{width,height})),style:position?{left:position.x,top:position.y,right:'auto',bottom:'auto'}:undefined};
}
