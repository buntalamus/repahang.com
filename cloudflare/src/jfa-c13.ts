import {currentUser,json} from './auth';
import type {Env} from './types';
import {c13BrowserAccess,c13BrowserRequest,c13BrowserRedirect,c13LaunchUrl} from './c13-browser';

interface AdminReport {fixture_id?:unknown;tournament_id?:unknown;venue_name?:string|null}
async function adminReportVenues(response:Response,env:Env):Promise<Response>{
  const payload=await response.json() as {data?:{records?:AdminReport[];c12Records?:AdminReport[]}};
  const reports=[...(payload.data?.records??[]),...(payload.data?.c12Records??[])];
  const ids=[...new Set(reports.map(r=>Number(r.fixture_id)).filter(id=>Number.isSafeInteger(id)&&id>0))];
  if(ids.length){
    const rows=await env.DB.prepare('SELECT id,kejohanan_id,tempat FROM jadual_perlawanan WHERE id IN (SELECT value FROM json_each(?))')
      .bind(JSON.stringify(ids)).all<{id:number;kejohanan_id:number;tempat:string|null}>();
    const venues=new Map(rows.results.map(row=>[`${row.kejohanan_id}:${row.id}`,row.tempat]));
    for(const report of reports)report.venue_name=venues.get(`${Number(report.tournament_id)}:${Number(report.fixture_id)}`)??null;
  }
  const headers=new Headers(response.headers);headers.delete('Content-Length');
  return new Response(JSON.stringify(payload),{status:response.status,headers});
}

/** Identity is taken from this portal's session, never a browser-supplied id.
 * The private JFA service independently verifies the current R appointment. */
export async function jfaC13(request:Request,env:Env):Promise<Response>{
  const incoming=new URL(request.url),view=incoming.searchParams.get('view');
  const session=view==='open'?null:await currentUser(request,env);
  const browser=session?null:await c13BrowserAccess(request,env);
  if(view==='open'&&!browser)return json({error:true,message:'Pautan C13 tamat tempoh atau tidak sah. Buka semula melalui aplikasi RefPahang.'},401);
  const authRequest=browser?c13BrowserRequest(request,browser):request;
  const user=session??await currentUser(authRequest,env);
  if(!user)return json({error:true,message:'Sesi tidak sah. Sila log masuk RefPahang semula.'},401);
  if(view==='admin'&&(user.role!=='Admin'||browser))return json({error:true,message:'Salinan C13 ini hanya untuk Admin RefPahang.'},403);
  if(view==='admin'&&request.method!=='GET')return json({error:true,message:'Salinan C13 Admin ialah bacaan sahaja.'},405);
  if(browser&&view!=='open'&&incoming.searchParams.get('match')!==browser.matchId)return json({error:true,message:'Akses ini hanya untuk C13 perlawanan yang dibuka melalui aplikasi.'},403);
  if(!env.JFA_C13_SERVICE)return json({error:true,message:'Sambungan C13 JFA belum tersedia.'},503);
  if(!['GET','POST'].includes(request.method))return json({error:true,message:'Kaedah tidak disokong.'},405);
  if(request.method==='POST'&&((request.headers.get('Origin')&&request.headers.get('Origin')!==new URL(request.url).origin)||request.headers.get('Sec-Fetch-Site')==='cross-site'))return json({error:true,message:'Permintaan mesti daripada portal RefPahang.'},403);
  if(request.method==='POST'&&env.STAGING_WRITES_ENABLED!=='1')return json({error:true,message:'Penghantaran laporan belum dibuka.'},403);
  if((view==='open'&&request.method!=='GET')||(view==='launch'&&request.method!=='POST'))return json({error:true,message:'Kaedah tidak disokong.'},405);
  const target=new URL('https://jfa-c13.internal/c13');target.search=incoming.search;
  if(view==='page')target.pathname='/c13/page';
  if(view==='links')target.pathname='/c13/links';
  if(view==='admin')target.pathname='/c13/admin';
  if(view==='open'){target.search='';target.searchParams.set('match',browser!.matchId);}
  const headers=new Headers({'X-RefPahang-User-Id':String(user.id)});
  if(browser)headers.set('X-C13-Match-Id',browser.matchId);
  for(const name of ['Content-Type','Idempotency-Key']){const value=request.headers.get(name);if(value)headers.set(name,value);}
  let body:ArrayBuffer|undefined;
  if(request.method==='POST'&&view!=='launch'){
    const reader=request.body?.getReader(),chunks:Uint8Array[]=[];let length=0;
    if(reader)while(true){const chunk=await reader.read();if(chunk.done)break;length+=chunk.value.byteLength;if(length>320000){await reader.cancel();return json({error:true,message:'Kandungan C13 terlalu besar.'},413);}chunks.push(chunk.value);}
    const combined=new Uint8Array(length);let offset=0;for(const chunk of chunks){combined.set(chunk,offset);offset+=chunk.byteLength;}body=combined.buffer;
  }
  try{
    const response=await env.JFA_C13_SERVICE.fetch(new Request(target,{method:view==='launch'?'GET':request.method,headers,...(body?{body}: {})}));
    if(!response.ok)return response;
    if(view==='open'){await response.body?.cancel();return c13BrowserRedirect(request,browser!);}
    if(view==='launch'){
      await response.body?.cancel();
      return json({error:false,url:await c13LaunchUrl(env,authRequest,incoming.searchParams.get('match')??'')});
    }
    const isAdminList=view==='admin'&&response.headers.get('Content-Type')?.includes('application/json')
      &&!incoming.searchParams.has('record')&&!incoming.searchParams.has('document');
    const result=isAdminList?await adminReportVenues(response,env):new Response(response.body,response);
    if(view==='admin'&&result.headers.get('Content-Type')?.includes('application/pdf')){
      const mode=incoming.searchParams.get('mode');
      if(mode==='preview'||mode==='download'){
        const disposition=(result.headers.get('Content-Disposition')??'').replace(/^(?:inline|attachment)\s*;?\s*/i,'');
        result.headers.set('Content-Disposition',`${mode==='preview'?'inline':'attachment'}; ${disposition||'filename="laporan-perlawanan.pdf"'}`);
      }
    }
    result.headers.set('Referrer-Policy','no-referrer');return result;
  }
  catch{return json({error:true,message:'Sambungan C13 JFA tidak dapat dicapai. Cuba semula.'},502);}
}
