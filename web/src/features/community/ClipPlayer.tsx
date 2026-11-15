import { useEffect, useRef, useState } from 'react';
import type { Clip } from './types';
import { mediaEmbed } from './media';

/** Deferred media mounts; external players are removed offscreen so they stop playback. */
export function ClipPlayer({ clip }: { clip: Clip }) {
  const host=useRef<HTMLDivElement>(null), video=useRef<HTMLVideoElement>(null);
  const [near,setNear]=useState(false),[playing,setPlaying]=useState(false),[failed,setFailed]=useState(false);
  useEffect(()=>{setFailed(false);setPlaying(false);},[clip.blob_url]);
  useEffect(()=>{
    const element=host.current;if(!element)return;
    if(!('IntersectionObserver' in window)){setNear(true);return;}
    const preload=new IntersectionObserver(entries=>setNear(entries[0].isIntersecting),{rootMargin:'200px'});
    const visible=new IntersectionObserver(entries=>{if(!entries[0].isIntersecting){video.current?.pause();setPlaying(false);}},{threshold:.1});
    preload.observe(element);visible.observe(element);
    return()=>{preload.disconnect();visible.disconnect();video.current?.pause();};
  },[]);
  let source='';try{const url=new URL(clip.blob_url,location.origin);if(clip.blob_url&&['http:','https:'].includes(url.protocol))source=url.href;}catch{ /* unavailable media */ }
  const safe=Boolean(source);
  const external=safe?mediaEmbed(source,location.hostname):null;
  const poster=clip.thumbnail_url&&/^https?:\/\//i.test(clip.thumbnail_url)?clip.thumbnail_url:undefined;
  return <div className="cq-social-player" ref={host}>
    {!safe||failed?<div className="cq-social-placeholder"><span aria-hidden="true">▶</span><p>Playback unavailable</p>{clip.handle&&<a href={`/u/${encodeURIComponent(clip.handle)}`}>Creator profile →</a>}</div>:external?near&&playing?<iframe title={clip.title||'CS2 clip'} src={external.embed} allow="fullscreen; picture-in-picture; encrypted-media" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"/>:<button className="cq-social-play" onClick={()=>setPlaying(true)} aria-label={`Play ${clip.title||'clip'}`}>{poster&&<img src={poster} alt="" loading="lazy"/>}<span>▶</span><small>Play on {external.provider}</small></button>:near?<video ref={video} controls playsInline preload="none" poster={poster} src={source} aria-label={clip.title||'CS2 clip'} onError={()=>setFailed(true)} />:<div className="cq-social-placeholder">{poster?<img src={poster} alt="" loading="lazy"/>:<span aria-hidden="true">▶</span>}</div>}
  </div>;
}
