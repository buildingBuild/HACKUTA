import type { SessionUser } from '../../components/session';
import type { DemoRequest } from './catalog';
export interface ClipChoice {id:string;title:string|null;user_id:string;game:string}
export async function loadContext(user:SessionUser,signal:AbortSignal){
  const [profile,clips]=await Promise.allSettled([
    fetch(`/api/profiles/${encodeURIComponent(user.handle)}`,{signal}).then(async r=>{if(!r.ok)throw Error();return {body:await r.json(),mock:(r.headers.get('X-FaZe-Data-Mode')||'').startsWith('mock')};}),
    fetch('/api/clips',{signal}).then(async r=>{if(!r.ok)throw Error();const body=await r.json();return (body.clips??[] as ClipChoice[]).filter((c:ClipChoice)=>c.user_id===user.id&&c.game==='cs2') as ClipChoice[];}),
  ]);
  return {karma:profile.status==='fulfilled'&&profile.value.body.user?.id===user.id&&typeof profile.value.body.karma==='number'&&Number.isSafeInteger(profile.value.body.karma)?profile.value.body.karma:null,mock:profile.status==='fulfilled'&&profile.value.mock,clips:clips.status==='fulfilled'?clips.value:[],profileError:profile.status==='rejected',clipsError:clips.status==='rejected'};
}
const key=(userId:string)=>`faze-mentorship-demo:${userId}`;
export function loadRequests(userId:string):DemoRequest[]{try{const raw=JSON.parse(sessionStorage.getItem(key(userId))||'[]');return Array.isArray(raw)?raw.filter(r=>r&&r.userId===userId&&typeof r.sessionId==='string'&&typeof r.createdAt==='string').slice(0,20):[];}catch{return [];}}
export function saveRequest(request:DemoRequest):DemoRequest[]{const previous=loadRequests(request.userId);if(previous.some(r=>r.id===request.id))return previous;const next=[request,...previous].slice(0,20);sessionStorage.setItem(key(request.userId),JSON.stringify(next));return next;}

export async function fetchQuote(sessionId:string,mentorId:string,hours:number,signal?:AbortSignal){
 const params=new URLSearchParams({sessionId,mentorId,hours:String(hours)});
 const response=await fetch('/api/mentorship/quote?'+params,{credentials:'same-origin',signal});
 const body=await response.json();if(!response.ok)throw Error(body.error||'Request service unavailable.');return body.quote as import('./pricing').PriceQuote;
}
export async function fetchRequests(){
 const response=await fetch('/api/mentorship/requests',{credentials:'same-origin'});if(!response.ok)throw Error('Request history unavailable.');return (await response.json()).requests as DemoRequest[];
}
export async function submitRequest(input:{requestId:string;sessionId:string;mentorId:string;hours:number;expectedTotalCents:number;goals:string;link:string;clipId:string|null;notes:string}){
 const response=await fetch('/api/mentorship/requests',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});
 const body=await response.json();if(!response.ok)throw Error(body.error||'Your request could not be recorded.');return body.request as DemoRequest;
}
