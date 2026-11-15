import {Router,type Request} from 'express';
import {randomUUID} from 'node:crypto';
import {sessions,validateRequest,type DemoRequest} from '../../../web/src/features/mentorship/catalog.js';
import {mentorFor,supports} from '../../../web/src/features/mentorship/mentors.js';
import {quotePrice,type Hours} from '../../../web/src/features/mentorship/pricing.js';
interface Db {query(sql:string,values?:unknown[]):Promise<{rows:Record<string,unknown>[]}>}
interface Options {db?:Db;getUserId:(req:Request)=>string|undefined;getKarma?:(id:string)=>Promise<{karma:number|null;verified:boolean}>;ownsClip?:(clip:string,user:string)=>Promise<boolean>}
export function createMentorshipRouter(options:Options){
 const r=Router(),memory=new Map<string,DemoRequest>();
 async function quote(userId:string|undefined,input:Record<string,unknown>){
  const session=sessions.find(s=>s.id===input.sessionId),mentor=mentorFor(String(input.mentorId||''));
  if(!session||!mentor||!supports(mentor,session.id,session.path))throw Error('Choose an offered session and mentor.');
  const hours=Number(input.hours);if(hours!==1&&hours!==2)throw Error('Choose a supported duration.');
  let karma:number|null=null,verified=false;
  if(userId){try{
   if(options.getKarma){const result=await options.getKarma(userId);karma=result.karma;verified=result.verified;}
   else if(options.db){const result=await options.db.query('SELECT COALESCE((SELECT sum(score) FROM threads WHERE user_id = $1), 0) + COALESCE((SELECT sum(score) FROM comments WHERE user_id = $1), 0) AS karma',[userId]);karma=Number(result.rows[0]?.karma);verified=Number.isSafeInteger(karma);}
  }catch{/* Missing karma uses the regular rate. */}}
  return {session,mentor,quote:quotePrice(hours as Hours,karma,verified,mentor.id)};
 }
 r.get('/quote',async(req,res)=>{try{const result=await quote(options.getUserId(req),req.query);res.json({quote:result.quote,persistence:options.db?'database':'memory'});}catch(e){res.status(400).json({error:(e as Error).message});}});
 r.get('/requests',async(req,res)=>{const userId=options.getUserId(req);if(!userId)return res.status(401).json({error:'Sign in required.'});try{const requests=options.db?(await options.db.query('SELECT payload FROM mentorship_requests WHERE user_id=$1 ORDER BY created_at DESC LIMIT 20',[userId])).rows.map(row=>row.payload):[...memory.values()].filter(v=>v.userId===userId).slice(-20).reverse();return res.json({requests,persistence:options.db?'database':'memory'});}catch{return res.status(503).json({error:'Request storage is unavailable.'});}});
 r.post('/requests',async(req,res)=>{
  const userId=options.getUserId(req);if(!userId)return res.status(401).json({error:'Sign in required.'});
  const b=req.body;if(!b||typeof b!=='object')return res.status(400).json({error:'Invalid request.'});
  if(typeof b.requestId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(b.requestId))return res.status(400).json({error:'Invalid request key.'});
  if(typeof b.goals!=='string'||typeof b.link!=='string'||typeof b.notes!=='string'||(b.clipId!==null&&typeof b.clipId!=='string'))return res.status(400).json({error:'Invalid request fields.'});
  const error=validateRequest(b.goals,b.link,b.notes);if(error||b.link.length>2000)return res.status(400).json({error:error||'Link is too long.'});
  const key=userId+':'+b.requestId;
  try{
   // Retry lookup precedes repricing: an already recorded request retains its agreed quote.
   const existing=options.db?(await options.db.query('SELECT payload FROM mentorship_requests WHERE user_id=$1 AND request_key=$2',[userId,b.requestId])).rows[0]?.payload:memory.get(key);
   if(existing)return res.json({request:existing});
   let result;try{result=await quote(userId,b);}catch(e){return res.status(400).json({error:(e as Error).message});}
   if(!Number.isSafeInteger(b.expectedTotalCents)||b.expectedTotalCents!==result.quote.totalCents)return res.status(409).json({error:'The quote changed. Cancel and review the current price before submitting again.',quote:result.quote});
   if(b.clipId){const own=options.ownsClip?await options.ownsClip(b.clipId,userId):options.db?(await options.db.query("SELECT id FROM clips WHERE id=$1 AND user_id=$2 AND game='cs2'",[b.clipId,userId])).rows.length>0:false;if(!own)return res.status(403).json({error:'Select your own existing CS2 clip.'});}
   const request:DemoRequest={id:randomUUID(),userId,sessionId:result.session.id,mentorId:result.mentor.id,mentor:result.mentor.name,category:result.session.path,quote:result.quote,goals:b.goals.trim(),link:b.link.trim(),clipId:b.clipId||'',notes:b.notes.trim(),createdAt:new Date().toISOString(),status:'pending',persistence:options.db?'database':'memory'};
   if(options.db){const inserted=await options.db.query('INSERT INTO mentorship_requests (id,user_id,request_key,payload) VALUES($1,$2,$3,$4::jsonb) ON CONFLICT(user_id,request_key) DO UPDATE SET request_key=EXCLUDED.request_key RETURNING payload',[request.id,userId,b.requestId,JSON.stringify(request)]);return res.status(201).json({request:inserted.rows[0].payload});}
   // Recheck after asynchronous validation so concurrent retries create a single record.
   const winner=memory.get(key);if(winner)return res.json({request:winner});
   if([...memory.values()].filter(v=>v.userId===userId).length>=100)return res.status(429).json({error:'Preview request limit reached.'});
   memory.set(key,request);return res.status(201).json({request});
  }catch{return res.status(503).json({error:'Request storage is unavailable. No booking or payment was made.'});}
 });
 return r;
}
