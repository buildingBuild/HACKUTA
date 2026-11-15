import { sessions,type Path } from './catalog';
import { firstMentor,mentorFor,supports } from './mentors';
import type { Hours } from './pricing';
export interface Selection {path:Path;focus:string;hours:Hours;detail:string|null;mentorId?:string}
export function readSelection(search:string):Selection {
  const params=new URLSearchParams(search),detail=params.get('session');
  const focus=sessions.find(s=>s.id===(detail||params.get('focus')));
  const path=focus?.path||(params.get('category')==='creator'?'creator':'gaming');
  const focusId=focus?.id||sessions.find(s=>s.path===path)!.id;
  const requested=mentorFor(params.get('mentor')||undefined);
  const mentor=requested&&supports(requested,focusId,path)?requested:firstMentor(path,focusId);
  const hours:Hours=mentor.id==='workshop'?2:params.get('duration')==='2'?2:1;
  return {path,focus:focusId,hours,detail,mentorId:mentor.id};
}
export function selectionSearch(value:Selection):string {
  const params=new URLSearchParams({category:value.path,focus:value.focus,duration:String(value.hours)});
  if(value.detail)params.set('session',value.detail);
  if(value.mentorId)params.set('mentor',value.mentorId);
  return '?'+params.toString();
}
