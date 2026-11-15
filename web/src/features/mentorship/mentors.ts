import type { Path } from './catalog';
export const mentors = [
 {id:'review',name:'jcobbb',specialty:'Focused reviews',description:'Example review-led offering for gameplay or content.',sessions:{gaming:['vod-review','fundamentals'],creator:['channel-audit','editing-feedback']},hours:[1,2]},
 {id:'workshop',name:'JBOEN',specialty:'Practice & planning',description:'Example workshop offering for teams or creators.',sessions:{gaming:['fundamentals','team-strategy'],creator:['editing-feedback','streaming']},hours:[2]},
] as const;
export type Mentor=typeof mentors[number];
export function mentorFor(id:string|undefined){return mentors.find(m=>m.id===id);}
export function firstMentor(path:Path,focus:string){return mentors.find(m=>(m.sessions[path] as readonly string[]).includes(focus))||mentors[0];}
export function supports(mentor:Mentor,focus:string,path:Path){return (mentor.sessions[path] as readonly string[]).includes(focus);}
