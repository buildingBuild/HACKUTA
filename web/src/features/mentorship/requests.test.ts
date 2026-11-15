import {test} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {randomUUID} from 'node:crypto';
import {createMentorshipRouter} from '../../../../server/src/routes/mentorship';
import {quotePrice} from './pricing';

test('server validates Community reward, mentor offerings, identity and pending request retries',async()=>{
 let karma:number|null=0,verified=true;
 const app=express();app.use(express.json());app.use('/api/mentorship',createMentorshipRouter({getUserId:req=>req.get('x-user-id'),getKarma:async()=>({karma,verified}),ownsClip:async(id,user)=>id==='clip-a'&&user==='alice'}));
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.on('listening',r));const address=server.address();assert.ok(address&&typeof address!=='string');
 const call=async(path:string,body?:unknown,user='alice')=>{const response=await fetch(`http://127.0.0.1:${address.port}/api/mentorship${path}`,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(user?{'x-user-id':user}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:response.status,...await response.json()};};
 const draft=()=>({requestId:randomUUID(),sessionId:'vod-review',mentorId:'review',hours:1,expectedTotalCents:6000,goals:'Review trading and utility decisions.',link:'',clipId:'clip-a',notes:''});
 try{
  for(const value of [0,99,100,499,500]){karma=value;const result=await call('/quote?sessionId=vod-review&mentorId=review&hours=1');assert.equal(result.quote.totalCents,quotePrice(1,value,true,'review').totalCents);}
  karma=500;verified=false;assert.equal((await call('/quote?sessionId=vod-review&mentorId=review&hours=1')).quote.totalCents,6000);
  verified=true;karma=null;assert.equal((await call('/quote?sessionId=vod-review&mentorId=review&hours=1')).quote.totalCents,6000);
  karma=0;assert.equal((await call('/requests',draft(),'')).status,401);
  assert.equal((await call('/requests',{...draft(),mentorId:'twistzz'})).status,400);
  assert.equal((await call('/requests',{...draft(),mentorId:'workshop',sessionId:'team-strategy'})).status,400);
  assert.equal((await call('/requests',{...draft(),expectedTotalCents:1,karma:500,discountPercent:10})).status,409);
  assert.equal((await call('/requests',{...draft(),clipId:'another-users-clip'})).status,403);
  const request=draft();const repeats=await Promise.all(Array.from({length:8},()=>call('/requests',{...request,userId:'bob'})));
  assert.equal(new Set(repeats.map(r=>r.request.id)).size,1);assert.equal(repeats[0].request.userId,'alice');assert.equal(repeats[0].request.status,'pending');assert.equal(repeats[0].request.persistence,'memory');assert.equal(repeats[0].request.quote.totalCents,6000);
  karma=500;assert.equal((await call('/requests',request)).request.quote.totalCents,6000,'retry retains recorded quote');
  assert.equal((await call('/requests')).requests.length,1);assert.equal((await call('/requests',undefined,'bob')).requests.length,0);
  const discounted=await call('/requests',{...draft(),requestId:randomUUID(),expectedTotalCents:5400});assert.equal(discounted.request.quote.totalCents,5400);assert.equal(discounted.request.quote.discountPercent,10);
  const workshop=await call('/requests',{...draft(),sessionId:'team-strategy',mentorId:'workshop',hours:2,expectedTotalCents:10800});assert.equal(workshop.request.quote.regularCents,12000);assert.equal(workshop.request.quote.totalCents,10800);
 }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
