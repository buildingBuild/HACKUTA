import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createCommunityRouter } from '../../../../server/src/routes/community';
import { mediaEmbed } from './media';

test('official embeds reject unsafe sources and construct Twitch parent',()=>{
  assert.equal(mediaEmbed('javascript:alert(1)','localhost'),null);
  assert.equal(mediaEmbed('https://youtube.com.evil.test/watch?v=BteTeTpmBAo','localhost'),null);
  assert.equal(mediaEmbed('https://www.youtube.com/watch?v=bad','localhost'),null);
  assert.equal(mediaEmbed('https://www.youtube.com/watch?v=BteTeTpmBAo','localhost')?.embed,'https://www.youtube-nocookie.com/embed/BteTeTpmBAo?rel=0');
  assert.match(mediaEmbed('https://www.twitch.tv/videos/123456','localhost')!.embed,/video=v123456&parent=localhost/);
  assert.equal(mediaEmbed('https://www.twitch.tv/faze','bad&channel=evil'),null);
});

test('Pulse fallback, room isolation, persistent conversation, questions and exclusive poll ballots',async()=>{
  const app=express();app.use(express.json());app.use('/api',createCommunityRouter({pulseGenerate:false}));
  const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.on('listening',r));
  const address=server.address();assert.ok(address&&typeof address!=='string');
  const request=async(path:string,body?:unknown,user='demo-fan')=>{
    const response=await fetch(`http://127.0.0.1:${address.port}/api${path}`,{method:body===undefined?'GET':'POST',headers:{'x-user-id':user,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:response.status,...await response.json()};
  };
  try {
    const rooms=(await request('/community/watch/rooms')).data;assert.equal(rooms.length,4);
    const [first,second]=rooms;
    const initial=(await request('/community/pulse')).data;assert.equal(initial.provider,'deterministic');assert.ok(initial.highlights.every((h:{thread_id:string})=>h.thread_id));
    assert.equal((await request('/community/pulse')).data.generated_at,initial.generated_at);
    const msg=await request(`/threads/${first.thread_id}/comments`,{body:'A careful flash makes the entry easier.'});assert.equal(msg.status,201);
    assert.ok((await request(`/threads/${first.thread_id}/comments`)).data.some((c:{id:string})=>c.id===msg.data.id));
    assert.ok(!(await request(`/threads/${second.thread_id}/comments`)).data.some((c:{id:string})=>c.id===msg.data.id));
    const question=await request(`/threads/${second.thread_id}/comments`,{body:'[Question] How do you practice communication?'});assert.equal(question.status,201);
    assert.equal((await request('/votes',{target_type:'comment',target_id:question.data.id,value:1},'demo-prospect')).data.score,1);
    const pollPath=`/community/watch/rooms/${first.id}/poll`;
    assert.equal((await request(pollPath,{option:0})).data.total,1);
    const repeat=await request(pollPath,{option:0});assert.equal(repeat.data.total,1);assert.equal(repeat.data.options[0].votes,1);
    const changed=await request(pollPath,{option:1});assert.equal(changed.data.options[0].votes,0);assert.equal(changed.data.options[1].votes,1);
    await Promise.all(Array.from({length:8},()=>request(pollPath,{option:2},'demo-prospect')));
    const room=(await request(`/community/watch/rooms/${first.id}`)).data;assert.equal(room.poll_result.total,2);assert.equal(room.poll_result.selection,1);
    assert.equal((await request(`/community/watch/rooms/${second.id}`)).data.poll_result.total,0);
    const conversation=(await request(`/threads/${first.thread_id}/comments`)).data;assert.ok(conversation.every((c:{body:string})=>!c.body.startsWith('[watch-ballot] ')));
    assert.equal((await request(`/threads/${first.thread_id}`)).data.comment_count,1);
    assert.equal((await request(pollPath,{option:100})).status,400);
    assert.equal((await request(pollPath,{option:1},'unknown')).status,401);
    assert.equal((await request('/community/watch/rooms/unknown')).status,404);
    assert.equal((await request(`/threads/${first.thread_id}/comments`,{body:'[watch-ballot] 2'})).status,400);
    const pulse=(await request('/community/pulse')).data;assert.ok(pulse.overview.includes('retrieved comments'));assert.ok(pulse.perspectives.every((p:{excerpt:string})=>!p.excerpt.startsWith('[watch-ballot] ')));
    assert.ok(pulse.highlights.every((h:{thread_id:string})=>h.thread_id));
  } finally {server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
});

test('Pulse accepts only existing curator-selected source IDs and caches failed-provider fallback',async()=>{
  for(const valid of [true,false]) {
    let calls=0;
    const app=express();app.use(express.json());app.use('/api',createCommunityRouter({pulseGenerate:async prompt=>{
      calls++;
      const data=JSON.parse(prompt.slice(prompt.indexOf('DATA: ')+6));
      return JSON.stringify({thread_ids:[valid?data.threads[0].id:'fabricated-source'],comment_ids:valid?[data.comments[0].id]:[]});
    }}));
    const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.on('listening',resolve));
    const address=server.address();assert.ok(address&&typeof address!=='string');
    try {
      const url=`http://127.0.0.1:${address.port}/api/community/pulse`;
      const first=(await (await fetch(url)).json()).data;
      assert.equal(first.provider,valid?'curated':'deterministic');
      assert.ok(first.highlights.every((h:{thread_id:string})=>h.thread_id!=='fabricated-source'));
      assert.equal((await (await fetch(url)).json()).data.generated_at,first.generated_at);
      assert.equal(calls,1);
    } finally {server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
  }
});
