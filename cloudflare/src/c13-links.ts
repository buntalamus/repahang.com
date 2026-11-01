import type {Env} from './types';

/** Match links come from JFA's current accepted R mapping, never a league name. */
export interface C13Link {match_id:string;appointment_id:number;label:string;submitted:boolean}
export async function c13Links(env:Env,userId:number):Promise<Map<number,C13Link>> {
  if(!env.JFA_C13_SERVICE)return new Map();
  try {
    const response=await env.JFA_C13_SERVICE.fetch(new Request('https://jfa-c13.internal/c13/links',{
      headers:{'X-RefPahang-User-Id':String(userId)},signal:AbortSignal.timeout(5000),
    }));
    if(!response.ok)return new Map();
    const body=await response.json() as {data?:C13Link[]};
    return new Map((Array.isArray(body.data)?body.data:[])
      .filter(link=>Number.isSafeInteger(link.appointment_id)&&link.appointment_id>0&&/^[a-f0-9-]{36}$/i.test(link.match_id)&&typeof link.label==='string'&&typeof link.submitted==='boolean')
      .map(link=>[link.appointment_id,link]));
  } catch {
    // The task list remains usable if the separate JFA service is unavailable.
    return new Map();
  }
}
