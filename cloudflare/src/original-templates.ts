import type {Env} from './types';
import {plainTextFromHtml} from './php/format';

type Payload=Record<string,unknown>;
type RendererEnv=Pick<Env,'ORIGINAL_TEMPLATES'> & Partial<Pick<Env,'BASE_URL'|'TELEGRAM_BOT_USERNAME'>>;
export interface OriginalEmail {subject:string;html:string;type?:string}
interface Rendered {mime?:string;html?:string;base64?:string;email?:OriginalEmail}
type Renderer=(payload:Payload)=>Promise<Rendered>;
let testRenderer:Renderer|null=null;
/** Test seam; production always calls the private, un-routed service binding. */
export function setOriginalRendererForTests(renderer:Renderer|null):void {testRenderer=renderer;}
export async function originalTemplate(env:RendererEnv,payload:Payload):Promise<Rendered> {
  payload={...payload,context:{...(payload.context as Record<string,string> ?? {}),BASE_URL:env.BASE_URL || 'https://refpahang.com',TELEGRAM_BOT_USERNAME:env.TELEGRAM_BOT_USERNAME || 'refpahang_bot'}};
  if(testRenderer)return testRenderer(payload);
  if(!env.ORIGINAL_TEMPLATES)throw new Error('Original template service unavailable');
  const response=await env.ORIGINAL_TEMPLATES.fetch('https://original-templates/render',{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),
  });
  if(!response.ok)throw new Error('Original template rendering failed');
  return response.json<Rendered>();
}
export async function originalEmail(env:RendererEnv,template:string,
  args:unknown[],rows:unknown[]=[],context:Record<string,string>={}):Promise<OriginalEmail & {text:string}> {
  const result=await originalTemplate(env,{kind:'email',template,args,rows,context});
  if(!result.email?.html)throw new Error('Original email unavailable');
  return {...result.email,text:plainTextFromHtml(result.email.html)};
}
export async function originalHtml(env:RendererEnv,payload:Payload):Promise<string> {
  const result=await originalTemplate(env,payload);
  if(typeof result.html!=='string')throw new Error('Original document unavailable');
  return result.html;
}
export async function originalPdf(env:RendererEnv,payload:Payload):Promise<Uint8Array> {
  const result=await originalTemplate(env,payload);
  if(result.mime!=='application/pdf' || typeof result.base64!=='string' || result.base64.length>16_000_000)throw new Error('Original PDF unavailable');
  const bytes=Uint8Array.from(atob(result.base64),character=>character.charCodeAt(0));
  if(new TextDecoder().decode(bytes.subarray(0,5))!=='%PDF-')throw new Error('Original PDF invalid');
  return bytes;
}
