import {currentUser,json} from './auth';
import type {Env} from './types';

/** Identity is taken from this portal's session, never a browser-supplied id.
 * The private JFA service independently verifies the current R appointment. */
export async function jfaC13(request:Request,env:Env):Promise<Response>{
  const user=await currentUser(request,env);
  if(!user)return json({error:true,message:'Sesi tidak sah. Sila log masuk RefPahang semula.'},401);
  if(!env.JFA_C13_SERVICE)return json({error:true,message:'Sambungan C13 JFA belum tersedia.'},503);
  if(!['GET','POST'].includes(request.method))return json({error:true,message:'Kaedah tidak disokong.'},405);
  if(request.method==='POST'&&((request.headers.get('Origin')&&request.headers.get('Origin')!==new URL(request.url).origin)||request.headers.get('Sec-Fetch-Site')==='cross-site'))return json({error:true,message:'Permintaan mesti daripada portal RefPahang.'},403);
  if(request.method==='POST'&&env.STAGING_WRITES_ENABLED!=='1')return json({error:true,message:'Penghantaran laporan belum dibuka.'},403);
  const incoming=new URL(request.url),target=new URL('https://jfa-c13.internal/c13');target.search=incoming.search;
  if(incoming.searchParams.get('view')==='page')target.pathname='/c13/page';
  const headers=new Headers({'X-RefPahang-User-Id':String(user.id)});
  for(const name of ['Content-Type','Idempotency-Key']){const value=request.headers.get(name);if(value)headers.set(name,value);}
  let body:ArrayBuffer|undefined;
  if(request.method==='POST'){
    const reader=request.body?.getReader(),chunks:Uint8Array[]=[];let length=0;
    if(reader)while(true){const chunk=await reader.read();if(chunk.done)break;length+=chunk.value.byteLength;if(length>320000){await reader.cancel();return json({error:true,message:'Kandungan C13 terlalu besar.'},413);}chunks.push(chunk.value);}
    const combined=new Uint8Array(length);let offset=0;for(const chunk of chunks){combined.set(chunk,offset);offset+=chunk.byteLength;}body=combined.buffer;
  }
  try{return await env.JFA_C13_SERVICE.fetch(new Request(target,{method:request.method,headers,...(body?{body}: {})}));}
  catch{return json({error:true,message:'Sambungan C13 JFA tidak dapat dicapai. Cuba semula.'},502);}
}
