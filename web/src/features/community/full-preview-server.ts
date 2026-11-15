/** Local visual integration preview only. No database, media storage, or real scouting. */
import express, { type Request, type Response, type NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createMentorshipRouter } from '../../../../server/src/routes/mentorship';
import { createCommunityRouter } from '../../../../server/src/routes/community';
import { mockStatus } from '../../../../server/src/lib/live/mock';
import type { Profile, Activity } from '../profile/types';
import type { ScoutProgress } from '../recruiting/types';

const now = new Date().toISOString();
const users = [
  { id: 'demo-fan', handle: 'smokecheck', display_name: 'SmokeCheck · MOCK', role: 'user', avatar_url: null },
  { id: 'demo-returning-fan', handle: 'rewind', display_name: 'Rewind · MOCK', role: 'user', avatar_url: null },
  { id: 'demo-prospect', handle: 'nextup', display_name: 'NextUp · MOCK', role: 'user', avatar_url: null },
  { id: 'demo-recruiter', handle: 'recruiter', display_name: 'Recruiter · MOCK', role: 'recruiter', avatar_url: null },
  { id: 'demo-admin', handle: 'admin', display_name: 'Admin · MOCK', role: 'admin', avatar_url: null },
];
const players = users.filter(u => u.role === 'user');
const clips = players.flatMap(u => [0, 1].map(j => ({
  id: `sample-${u.handle}-${j}`, user_id: u.id, game: 'cs2',
  // Metadata only. No fake gameplay footage or unrelated sample film passed off as CS2.
  blob_url: '/mock-footage-unavailable.mp4', thumbnail_url: null, map: j ? 'Inferno' : 'Mirage', side: j ? 'T' : 'CT',
  title: `MOCK ${j ? 'utility clip' : 'clutch clip'} · footage unavailable`, status: 'done', created_at: now,
  handle: u.handle, display_name: u.display_name, social_post_url: null,
})));
const metrics = (id: string) => ({ faceit_level: 10, elo: 2450 + Math.max(0, players.findIndex(u => u.id === id)) * 120,
  kd: 1.29, hs_pct: 54, adr: 89, win_rate: 62, matches: 32 });
const progress = (id: string): ScoutProgress => {
  const m = metrics(id);
  const criteria = Object.entries({ faceit_level: 10, elo: 2500, kd: 1.25, hs_pct: 50, adr: 85, matches: 20 })
    .map(([metric, value]) => ({ metric, op: '>=', value, actual: m[metric as keyof typeof m], pass: m[metric as keyof typeof m] >= value,
      progress: Math.min(1, m[metric as keyof typeof m] / value), label: metric.replaceAll('_', ' ') }));
  const primary = { rule_id: 'player_v1', track: 'player' as const, label: 'MOCK scouting preview', criteria,
    pass: criteria.every(c => c.pass), progress: criteria.reduce((a,c) => a+c.progress,0)/criteria.length, score: 87 };
  return { user_id: id, metrics: m, primary, rules: [primary] };
};
const trend = (id: string) => Array.from({length:30}, (_,i) => ({day:new Date(Date.now()-(29-i)*86400000).toISOString().slice(0,10),
  ...metrics(id), elo:metrics(id).elo-180+i*6, kd:1.1+i*.006, adr:78+i*.38, hs_pct:48+i*.2}));
const accounts = new Map(players.map(u => [u.id, {faceit_nickname:u.handle,faceit_player_id:null,region:'NA',faceit_level:10,faceit_elo:metrics(u.id).elo}]));
const prospects = players.slice(1).map((u,i) => ({...u,id:`mock-report-${i}`,user_id:u.id,track:'player',rule_id:'player_v1',
  summary:'MOCK PROSPECT — fabricated performance data for testing the recruiter UI. No real recruitment decision.',
  status:i?'new':'reviewing',created_at:now,score:87+i,metrics:metrics(u.id),region:'NA',faceit_level:10,
  faceit_elo:metrics(u.id).elo,faceit_nickname:u.handle}));
let rules = JSON.parse(readFileSync(new URL('../../../../server/src/config/scouting-rules.json', import.meta.url), 'utf8'));
const app = express();
app.use(express.json({limit:'64kb'}));
app.use((_req,res,next) => {res.set('X-FaZe-Data-Mode','mock-memory-only');next();});
const viewer = (req: Request) => {
  const cookie=req.headers.cookie?.split(';').map(v=>v.trim()).find(v=>v.startsWith('fazehq_user='))?.slice('fazehq_user='.length);
  const id=cookie?decodeURIComponent(cookie):req.get('x-user-id');
  return users.find(u=>u.id===id);
};
const auth = (req:Request,res:Response,next:NextFunction) => viewer(req) ? next() : res.status(401).json({error:'Choose a mock account'});
const staff = (req:Request,res:Response,next:NextFunction) => ['admin','recruiter'].includes(viewer(req)?.role ?? '') ? next() : res.status(403).json({error:'Choose Recruiter · MOCK or Admin · MOCK'});
app.get('/api/health',(_req,res)=>res.json({ok:true,mode:'mock',database:false}));
app.get('/api/auth/demo-users',(_req,res)=>res.json({users,mode:'demo'}));
app.post('/api/auth/login',(req,res)=>{const user=users.find(u=>u.id===req.body.userId);if(!user)return res.status(404).json({error:'Unknown mock account'});res.cookie('fazehq_user',user.id,{httpOnly:true,sameSite:'lax',path:'/'});return res.json({user,mode:'demo'});});
app.post('/api/auth/logout',(_req,res)=>{res.clearCookie('fazehq_user',{path:'/'});return res.json({ok:true});});
app.get('/api/live',(_req,res)=>res.json({status:mockStatus(),counters:{pixelsToday:0,setupsSynced:0,guessersToday:0,fansOnline:0}}));
app.get('/api/admin/overview',staff,(req,res)=>viewer(req)?.role==='admin'?res.json({counts:{users:users.length,staff:users.filter(u=>u.role!=='user').length,threads:0,comments:0,new_prospects:prospects.filter(p=>p.status==='new').length,live_events:0,pixels:0,guessr_puzzles:0},mode:'mock'}):res.status(403).json({error:'Admin only'}));
app.get('/api/auth/me',(req,res)=>res.json({user:viewer(req)??null,mode:'demo'}));
app.get('/api/clips',(req,res)=>res.json({clips:clips.filter(c=>!req.query.userId||c.user_id===req.query.userId),mode:'demo'}));
app.get('/api/clips/external',(_req,res)=>res.json({items:JSON.parse(readFileSync(new URL('../../../../server/src/lib/social/snapshot.json',import.meta.url),'utf8')),mode:'snapshot',fetched_at:null}));
app.get('/api/clips/:id',(req,res)=>{const c=clips.find(c=>c.id===req.params.id);return c?res.json(c):res.status(404).json({error:'Clip not found'});});
app.post('/api/clips',auth,(req,res)=>{
  let url:URL;try{url=new URL(req.body.blob_url);if(!['http:','https:'].includes(url.protocol))throw Error();}catch{return res.status(400).json({error:'Use an existing HTTP(S) clip URL; this preview does not upload video'});}
  const u=viewer(req)!;
  const clip={...clips[0],id:randomUUID(),user_id:u.id,handle:u.handle,display_name:u.display_name,blob_url:url.href,
    title:`MOCK · ${String(req.body.title||'Linked clip').slice(0,160)}`,map:req.body.map||'Mirage',side:req.body.side||'CT',status:'uploaded',created_at:new Date().toISOString()};
  clips.push(clip);return res.status(201).json(clip);
});
app.get('/api/players/:id/stats',(req,res)=>res.json({user_id:req.params.id,latest:metrics(req.params.id),trend:trend(req.params.id)}));
app.get('/api/players/:id/account',(req,res)=>res.json({account:accounts.get(req.params.id)??null}));
app.put('/api/players/:id/faceit',auth,(req,res)=>{if(viewer(req)!.id!==req.params.id)return res.sendStatus(403);const account={...accounts.get(req.params.id)!,faceit_nickname:String(req.body.nickname||'sample')};accounts.set(req.params.id,account);return res.json({account});});
app.post('/api/players/:id/sync',auth,(req,res)=>{if(viewer(req)!.id!==req.params.id)return res.sendStatus(403);return res.json({source:'mock',nickname:accounts.get(req.params.id)?.faceit_nickname,stats:metrics(req.params.id),new_matches:0,scouting:{created:[],primary:progress(req.params.id).primary}});});
app.get('/api/scouting/progress/:id',staff,(req,res)=>res.json(progress(req.params.id)));
app.get('/api/scouting/rules',staff,(_req,res)=>res.json(rules));
app.put('/api/scouting/rules',staff,(req,res)=>{if(viewer(req)?.role!=='admin')return res.sendStatus(403);if(!Array.isArray(req.body.rules))return res.sendStatus(400);rules={...rules,rules:req.body.rules};return res.json(rules);});
app.get('/api/scouting/prospects',staff,(req,res)=>res.json({prospects:prospects.filter(p=>(!req.query.track||p.track===req.query.track)&&(!req.query.status||p.status===req.query.status)&&(!req.query.region||p.region===req.query.region)&&(!req.query.minLevel||p.faceit_level>=Number(req.query.minLevel)))}));
app.get('/api/scouting/prospects/:id',staff,(req,res)=>{const p=prospects.find(p=>p.id===req.params.id);return p?res.json({report:{...p,evidence:{score:p.score,criteria:progress(p.user_id).primary!.criteria,summary_source:'mock'}},trend:trend(p.user_id),recentClips:clips.filter(c=>c.user_id===p.user_id),progress:progress(p.user_id)}):res.sendStatus(404);});
app.patch('/api/scouting/prospects/:id',staff,(req,res)=>{const p=prospects.find(p=>p.id===req.params.id);if(!p)return res.sendStatus(404);if(!['new','reviewing','contacted','passed'].includes(req.body.status))return res.sendStatus(400);p.status=req.body.status;return res.json({id:p.id,status:p.status});});
app.get('/api/handles/:handle',(req,res)=>res.json({handle:req.params.handle,available:!users.some(u=>u.handle===req.params.handle),mine:viewer(req)?.handle===req.params.handle}));
app.post('/api/profiles',(req,res)=>{
  const handle=String(req.body.gamertag||'').trim().toLowerCase().replace(/[^a-z0-9_-]/g,'');
  if(!handle||handle.length>32)return res.status(400).json({error:'Use a gamertag of 1–32 letters, numbers, underscores or hyphens'});
  const existing=users.find(u=>u.handle===handle);
  if(existing&&existing.id!==viewer(req)?.id)return res.status(409).json({error:'This mock handle is taken'});
  const user=existing??{id:randomUUID(),handle,display_name:handle+' · MOCK',role:'user',avatar_url:null};
  if(!existing){users.push(user);players.push(user);accounts.set(user.id,{faceit_nickname:handle,faceit_player_id:null,region:'NA',faceit_level:10,faceit_elo:2450});}
  return res.status(existing?200:201).json({user,created:!existing,profile_url:'/u/'+handle,mode:'mock'});
});
app.put('/api/profiles/:handle/faceit',auth,(req,res)=>{
  const user=users.find(u=>u.handle===req.params.handle);
  if(!user)return res.sendStatus(404);if(user.id!==viewer(req)?.id)return res.sendStatus(403);
  accounts.set(user.id,{...accounts.get(user.id)!,faceit_nickname:String(req.body.faceit_nickname||'sample')});
  return res.json({user_id:user.id,mode:'mock'});
});
const bios=new Map<string,string>();
async function activityFor(userId:string):Promise<Activity>{
  const base=`http://127.0.0.1:${Number(process.env.PORT||3001)}/api`;
  const boardResponse=await fetch(base+'/communities');const boards=(await boardResponse.json()).data;
  const feeds=await Promise.all(boards.map(async(board:{id:string;slug:string;name:string})=>{const r=await fetch(base+'/communities/'+board.slug+'/threads?sort=new');return (await r.json()).data.map((thread:Record<string,unknown>)=>({...thread,board:board.slug,board_name:board.name}));}));
  const threads=feeds.flat();
  const comments=(await Promise.all(threads.map(async(thread:{id:string;title:string})=>{const r=await fetch(base+'/threads/'+thread.id+'/comments');return (await r.json()).data.map((comment:Record<string,unknown>)=>({...comment,thread_title:thread.title}));}))).flat();
  const ownThreads=threads.filter(t=>t.user_id===userId),ownComments=comments.filter(c=>c.user_id===userId);
  return {thread_count:ownThreads.length,comment_count:ownComments.length,threads:ownThreads.slice(0,8),comments:ownComments.slice(-8).reverse()};
}
app.patch('/api/profiles/:handle',auth,(req,res)=>{const user=users.find(u=>u.handle===req.params.handle);if(!user)return res.sendStatus(404);if(user.id!==viewer(req)?.id)return res.sendStatus(403);if(typeof req.body.bio!=='string'||req.body.bio.length>280)return res.status(400).json({error:'Bio must be at most 280 characters'});bios.set(user.id,req.body.bio);return res.json({bio:req.body.bio||null});});
app.get('/api/profiles/:handle',async(req,res)=>{try {
  const u=users.find(u=>u.handle===req.params.handle);if(!u)return res.status(404).json({error:'Mock profile not found'});
  const m=metrics(u.id), p=progress(u.id), own=clips.filter(c=>c.user_id===u.id);
  const profile:Profile={user:{...u,bio:bios.get(u.id)??'MOCK PROFILE · sample data for visual testing. Changes reset on restart.',created_at:now},game:{...accounts.get(u.id)!,premier_rating:null},linked_accounts:[],
    stats:Object.fromEntries(['elo','kd','hs_pct','adr','win_rate'].map(key=>[key,{value:m[key as keyof typeof m],delta_30d:key==='elo'?180:3,updated_at:now}])),
    trends:Object.fromEntries(['elo','kd','hs_pct','adr','win_rate'].map(key=>[key,trend(u.id).map(t=>({t:t.day,v:Number(t[key as keyof typeof t])}))])),
    social:[{platform:'youtube',followers:1200,views:24500,engagement_rate:.058,followers_growth_30d:.12}],
    clips:own,clip_count:own.length,karma:0,elo_rank:{rank:1,total:3},
    scout:['admin','recruiter'].includes(viewer(req)?.role??'')?{status:'in_progress',progress:p.primary!.progress,rule_id:'player_v1',criteria:p.primary!.criteria.map(c=>({metric:c.metric,label:c.label!,current:c.actual,target:c.value,met:c.pass})),report:null}:{status:'unavailable',progress:null,rule_id:null,criteria:[],report:null},
    dossier:['admin','recruiter'].includes(viewer(req)?.role??'')?{percentiles:[],form:{days_tracked:30,elo_delta:180,kd_delta:.18,adr_delta:11,hs_delta:6,consistency:'steady',consistency_cv:.08}}:null,activity:await activityFor(u.id)};
  return res.json(profile);
  }catch{ return res.status(503).json({error:'Mock profile activity is unavailable'}); }
});
app.get('/api/leaderboards/:type',(req,res)=>{
  const labels:Record<string,[string,string]>={elo:['FACEIT ELO','ELO'],improvement:['Most improved','ELO gained'],'creator-growth':['Creator growth','followers'],karma:['Community karma','karma']};
  const meta=labels[req.params.type];if(!meta)return res.sendStatus(404);
  const entries=players.map((u,i)=>({...u,faceit_level:10,value:req.params.type==='elo'?metrics(u.id).elo:120+i*40})).sort((a,b)=>b.value-a.value).map((u,i)=>({...u,rank:i+1}));
  return res.json({type:req.params.type,label:'MOCK · '+meta[0],unit:meta[1],window_days:30,entries});
});
app.use('/api/mentorship',createMentorshipRouter({getUserId:req=>viewer(req)?.id,ownsClip:async(id,userId)=>clips.some(c=>c.id===id&&c.user_id===userId&&c.game==='cs2')}));
app.use('/api',createCommunityRouter({demoUsers:users,demoClips:clips,pulseGenerate:false,getUserId:req=>viewer(req)?.id}));
app.use('/api',(_req,res)=>res.status(404).json({error:'This integration is not implemented in the local MOCK preview'}));
const server=app.listen(Number(process.env.PORT||3001),'127.0.0.1',()=>console.log('FULL APP MOCK PREVIEW · memory only · no database/storage · http://127.0.0.1:3001'));
process.on('SIGTERM',()=>server.close());
