import type {Env} from './types';

// A restricted browser handoff for the mobile app. The original session token
// is encrypted and never appears in a URL or browser script. Every request
// still validates that original session and the live accepted R appointment.
const lifetime=2*60*60;
const encoder=new TextEncoder();
const cookieName='refpahang_c13';
interface BrowserAccess {token:string;matchId:string;expires:number}
async function key(env:Env){
  const secret=env.APPOINTMENT_LETTER_SECRET??'';
  if(secret.length<32)throw Error('C13 browser handoff unavailable');
  const digest=await crypto.subtle.digest('SHA-256',encoder.encode('refpahang:c13-browser:v1:'+secret));
  return crypto.subtle.importKey('raw',digest,'AES-GCM',false,['encrypt','decrypt']);
}
const encode=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
function decode(raw:string){return Uint8Array.from(atob(raw.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));}
function sessionToken(request:Request){
  const cookie=request.headers.get('Cookie')?.split(';').map(c=>c.trim()).find(c=>c.startsWith('refpahang_session='))?.slice('refpahang_session='.length);
  return cookie??/^Bearer\s+(\S+)$/i.exec(request.headers.get('Authorization')??'')?.[1];
}
export async function c13LaunchUrl(env:Env,request:Request,matchId:string,now=Date.now()){
  const token=sessionToken(request);
  if(!token||!/^[A-Za-z0-9_-]{43}$/.test(token)||!/^[a-f0-9-]{36}$/i.test(matchId))throw Error('Invalid C13 launch');
  const access:BrowserAccess={token,matchId,expires:Math.floor(now/1000)+lifetime};
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv},await key(env),encoder.encode(JSON.stringify(access)));
  const ticket=encode(iv)+'.'+encode(new Uint8Array(encrypted));
  const url=new URL('/api/jfa-c13.php',request.url);url.searchParams.set('view','open');url.searchParams.set('ticket',ticket);
  return url.toString();
}
export async function c13BrowserAccess(request:Request,env:Env,now=Date.now()):Promise<(BrowserAccess&{ticket:string})|null>{
  const url=new URL(request.url);
  const ticket=url.searchParams.get('view')==='open'?url.searchParams.get('ticket'):
    request.headers.get('Cookie')?.split(';').map(c=>c.trim()).find(c=>c.startsWith(cookieName+'='))?.slice(cookieName.length+1);
  if(!ticket||ticket.length>1000||!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(ticket))return null;
  try {
    const [iv,data]=ticket.split('.').map(decode);
    if(iv.length!==12)return null;
    const plaintext=await crypto.subtle.decrypt({name:'AES-GCM',iv},await key(env),data);
    const value=JSON.parse(new TextDecoder().decode(plaintext)) as BrowserAccess;
    const seconds=Math.floor(now/1000);
    if(!/^[A-Za-z0-9_-]{43}$/.test(value.token)||!/^[a-f0-9-]{36}$/i.test(value.matchId)||!Number.isSafeInteger(value.expires)||value.expires<=seconds||value.expires>seconds+lifetime)return null;
    return {...value,ticket};
  } catch{return null;}
}
export function c13BrowserRequest(request:Request,access:BrowserAccess){
  // Keep all other headers, but never combine a browser's different account
  // with the mobile session used for this restricted form.
  const headers=new Headers(request.headers);headers.delete('Cookie');headers.set('Authorization','Bearer '+access.token);
  return new Request(request.url,{headers});
}
export function c13BrowserRedirect(request:Request,access:BrowserAccess&{ticket:string}){
  const target=new URL('/api/jfa-c13.php',request.url);target.searchParams.set('view','page');target.searchParams.set('match',access.matchId);
  return new Response(null,{status:303,headers:{Location:target.pathname+target.search,
    'Set-Cookie':`${cookieName}=${access.ticket}; Path=/api/jfa-c13.php; Max-Age=${Math.max(0,access.expires-Math.floor(Date.now()/1000))}; HttpOnly; SameSite=Lax; Secure`,
    'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}});
}
