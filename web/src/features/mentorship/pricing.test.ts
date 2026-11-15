import {test} from 'node:test';
import assert from 'node:assert/strict';
import {quotePrice} from './pricing';
import {readSelection,selectionSearch} from './selection';

test('illustrative prices apply one capped benefit at exact karma boundaries',()=>{
 for(const hours of [1,2] as const){
  const regular=hours===1?6000:11000;
  for(const [karma,percent] of [[-10,0],[0,0],[99,0],[100,5],[499,5],[500,10],[999999,10]]){
   const quote=quotePrice(hours,karma,true);
   assert.equal(quote.regularCents,regular);assert.equal(quote.discountPercent,percent);
   assert.equal(quote.totalCents,regular-Math.round(regular*percent/100));
   assert.ok(quote.totalCents>=0);assert.ok(quote.discountCents<=regular*.1);
  }
 }
});
test('missing, mock or malformed karma never grants actual eligibility',()=>{
 for(const karma of [null,NaN,Infinity,100.5])assert.equal(quotePrice(1,karma,true).discountPercent,0);
 assert.equal(quotePrice(2,500,false).totalCents,11000);
 assert.equal(quotePrice(1,100,false).karmaVerified,false);
 assert.throws(()=>quotePrice(0 as 1,null,false));assert.throws(()=>quotePrice(-2 as 1,500,true));
});
test('creator direct links, durations and browser history restore consistent selection',()=>{
 const value=readSelection('?session=channel-audit&duration=2');
 assert.equal(value.path,'creator');assert.equal(value.focus,'channel-audit');assert.equal(value.hours,2);
 assert.deepEqual(readSelection(selectionSearch(value)),value);
 const landing={...value,detail:null};assert.deepEqual(readSelection(selectionSearch(landing)),landing);
 assert.equal(readSelection('?category=creator&duration=-1').hours,1);
 assert.equal(readSelection('?category=creator&focus=invalid').focus,'channel-audit');
});

test('demo request snapshots remain account-scoped and retries do not duplicate drafts',async()=>{
 const {loadRequests,saveRequest}=await import('./api');
 const old=Object.getOwnPropertyDescriptor(globalThis,'sessionStorage');const memory=new Map<string,string>();
 Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:{getItem:(key:string)=>memory.get(key)??null,setItem:(key:string,value:string)=>memory.set(key,value)}});
 try{
  const draft={id:'request-1',userId:'fan-a',sessionId:'vod-review',goals:'Review my match decisions',link:'',clipId:'clip-a',notes:'',createdAt:new Date().toISOString(),category:'gaming' as const,mentor:'Gameplay mentor',quote:quotePrice(2,500,false)};
  saveRequest(draft);saveRequest(draft);
  assert.equal(loadRequests('fan-a').length,1);assert.equal(loadRequests('fan-b').length,0);
  assert.deepEqual(loadRequests('fan-a')[0].quote,draft.quote);assert.equal(loadRequests('fan-a')[0].quote?.totalCents,11000);
 }finally{if(old)Object.defineProperty(globalThis,'sessionStorage',old);else Reflect.deleteProperty(globalThis,'sessionStorage');}
});
