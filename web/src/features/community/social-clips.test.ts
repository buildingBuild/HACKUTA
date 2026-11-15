import {test} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {createCommunityRouter} from '../../../../server/src/routes/community';

test('clip social integration reuses threads, enforces owner publishing and deduplicates concurrent creation',async()=>{
  const app=express();app.use(express.json());app.use('/api',createCommunityRouter({pulseGenerate:false,demoClips:[{id:'clip-a',user_id:'demo-fan',game:'cs2',title:'Shared clutch',blob_url:'https://example.test/clip.mp4'}]}));
  const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.on('listening',resolve));const address=server.address();assert.ok(address&&typeof address!=='string');
  const call=async(path:string,body?:unknown,user='demo-fan')=>{const r=await fetch(`http://127.0.0.1:${address.port}/api${path}`,{method:body===undefined?'GET':'POST',headers:{'x-user-id':user,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:r.status,...await r.json()};};
  try{
    assert.equal((await call('/community/clip-threads?ids=clip-a')).data.length,0);
    assert.equal((await call('/community/clips/clip-a/discussion',{},'demo-prospect')).status,403);
    const published=await Promise.all(Array.from({length:8},()=>call('/community/clips/clip-a/discussion',{})));
    assert.equal(new Set(published.map(r=>r.data.id)).size,1);assert.equal(published.filter(r=>r.status===201).length,1);
    const thread=published[0].data;assert.equal(thread.author.id,'demo-fan');assert.equal(thread.clip.id,'clip-a');
    assert.equal((await call('/community/clips/clip-a/discussion',{},'demo-prospect')).data.id,thread.id);
    assert.equal((await call('/votes',{target_type:'thread',target_id:thread.id,value:-1},'demo-prospect')).data.score,-1);
    const comment=await call(`/threads/${thread.id}/comments`,{body:'Great team play'},'demo-prospect');
    const reply=await call(`/threads/${thread.id}/comments`,{body:'Thanks',parent_id:comment.data.id});assert.equal(reply.status,201);
    const feed=await call('/community/clip-threads?ids=clip-a,clip-a');assert.equal(feed.data.length,1);assert.equal(feed.data[0].comment_count,2);assert.equal(feed.data[0].score,-1);
    // Explicit additional discussions can reference a clip; the video feed still picks one canonical thread.
    await call('/communities/clips/threads',{title:'Another angle',body:'Follow-up',clip_id:'clip-a'});
    const canonical=await call('/community/clip-threads?ids=clip-a');assert.equal(canonical.data.length,1);assert.equal(canonical.data[0].id,thread.id);
    assert.equal((await call('/community/clips/missing/discussion',{})).status,404);
    assert.equal((await call('/community/clips/clip-a/discussion',{},'unknown')).status,401);
  }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
