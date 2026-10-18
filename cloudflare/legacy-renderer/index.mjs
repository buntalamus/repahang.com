import {decode,encode,convertIndexedToRgb} from 'fast-png';
import {PhpCloudflare} from 'php-cloud-wasm/php8.3-cloudflare.mjs';
import archive from './bundle.generated.mjs';

// One interpreter per isolate, with serialized requests and request files cleared
// by PHP finally. Never instantiate concurrent 64 MiB PHP heaps in one isolate.
let php;
let ready;
let tail=Promise.resolve();
let waiting=0;
let stdout='';
let failed=false;
async function initialize() {
  php=new PhpCloudflare({ini:'display_errors=0\nlog_errors=1\nerror_reporting=22527\nmemory_limit=48M'});
  php.addEventListener('output',event=>{
    if(failed)return;
    stdout+=event.detail.join('');
    if(stdout.length>8_000_000) {failed=true;stdout='';}
  });
  php.addEventListener('error',()=>{failed=true;});
  await php.writeFile('/templates.zip',Uint8Array.from(atob(archive),character=>character.charCodeAt(0)));
  const code=await php.run(`<?php
    mkdir('/app');mkdir('/app/request');
    $zip=new ZipArchive();if($zip->open('/templates.zip')!==true)throw new RuntimeException('Archive');
    $zip->extractTo('/app');$zip->close();unlink('/templates.zip');
    require_once '/app/entry.php';
  `);
  if(code!==0 || failed)throw new Error('Original template initialization failed');
}
function alphaImages(url) {
  if(typeof url!=='string' || !url.startsWith('data:image/png;base64,'))return {};
  const bytes=Uint8Array.from(atob(url.slice(22)),c=>c.charCodeAt(0));
  const view=new DataView(bytes.buffer);const width=view.getUint32(16),height=view.getUint32(20);
  if(width*height>4_000_000)throw new Error('Image pixel limit');
  let image=decode(bytes);
  if(image.palette)image={...image,data:convertIndexedToRgb(image),channels:image.palette[0].length,depth:8};
  if(image.channels!==2 && image.channels!==4)return {};
  const max=image.depth===16?65535:255;
  const rgb=new Uint8Array(width*height*3),mask=new Uint8Array(width*height);
  for(let pixel=0;pixel<width*height;pixel++){
    const at=pixel*image.channels,alpha8=Math.floor(image.data[at+image.channels-1]/max*255);
    const coverage=(alpha8>>1)/127,gdAlpha=Math.floor(coverage*255);
    mask[pixel]=Math.floor(Math.pow(gdAlpha/255,2.2)*255);
    for(let channel=0;channel<3;channel++)rgb[pixel*3+channel]=Math.floor(image.data[at+(image.channels===2?0:channel)]/max*255*coverage);
  }
  const uri=(data,channels)=>{
    const encoded=encode({width,height,channels,depth:8,data});
    let binary='';for(let at=0;at<encoded.length;at+=8192)binary+=String.fromCharCode(...encoded.subarray(at,at+8192));
    return 'data:image/png;base64,'+btoa(binary);
  };
  return {photo_rgb:uri(rgb,3),photo_mask:uri(mask,1)};
}
async function render(payload) {
  if(payload.photo)Object.assign(payload,alphaImages(payload.photo));
  ready ??= initialize();await ready;
  stdout='';failed=false;
  await php.writeFile('/app/input.json',JSON.stringify(payload));
  const code=await php.run(`<?php
    try {
      $input=json_decode(file_get_contents('/app/input.json'),true,512,JSON_THROW_ON_ERROR);
      echo json_encode(renderOriginal($input),JSON_THROW_ON_ERROR|JSON_INVALID_UTF8_SUBSTITUTE);
    } catch (Throwable $error) { echo json_encode(['error'=>true]); }
    finally { @unlink('/app/input.json');unset($input,$error);gc_collect_cycles(); }
  `);
  const result=stdout;stdout='';
  if(code!==0 || failed)throw new Error('Original template rendering failed');
  const parsed=JSON.parse(result);if(parsed.error)throw new Error('Invalid original output');return parsed;
}
export default {
  async fetch(request) {
    if(request.method!=='POST' || new URL(request.url).pathname!=='/render')return new Response('Not found',{status:404});
    if(waiting>=8)return new Response('Renderer busy',{status:503});
    const body=await request.text();if(body.length>6_000_000)return new Response('Request too large',{status:413});
    let payload;
    try {payload=JSON.parse(body);}catch{return new Response('Invalid input',{status:400});}
    if(!payload || !['registration','assessment','schedule','fitness','futsal','email'].includes(payload.kind))return new Response('Invalid document',{status:400});
    waiting++;
    const current=tail.then(()=>render(payload));tail=current.catch(()=>{});
    try {return Response.json(await current,{headers:{'Cache-Control':'no-store'}});}
    catch {return Response.json({error:true,message:'Dokumen asal belum dapat dijana.'},{status:503});}
    finally {waiting--;}
  },
};
