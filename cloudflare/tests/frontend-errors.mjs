import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import ts from '../../frontend/node_modules/typescript/lib/typescript.js';

const frontend=new URL('../../frontend/',import.meta.url).pathname;
const directory=mkdtempSync(join(frontend,'node_modules/frontend-errors-'));
try {
  const file=join(directory,'errors.mjs');
  await build({stdin:{contents:`
    import '@angular/compiler';
    export {createEnvironmentInjector,runInInjectionContext} from '@angular/core';
    export {HttpRequest,HttpResponse,HttpErrorResponse,HttpHeaders,HttpContext} from '@angular/common/http';
    export {Router} from '@angular/router';
    export {Subject,map} from 'rxjs';
    export {errorInterceptor} from './src/app/core/interceptors/error.interceptor';
    export {ToastService} from './src/app/core/services/toast.service';
    export {ApiService} from './src/app/core/services/api.service';
    export {apiErrorMessage,rememberApiError} from './src/app/core/services/api-error';
    export {BACKGROUND_REQUEST,EXPECTED_ERROR_STATUSES,REQUEST_TIMEOUT_MS} from './src/app/core/services/background-request';
    export {HttpViewRefreshService} from './src/app/core/services/http-view-refresh.service';
    export {AdminApplicationsComponent} from './src/app/features/admin/applications/applications.component';
  `,resolveDir:frontend,loader:'ts'},outfile:file,bundle:true,platform:'node',format:'esm',
    external:['@angular/*','rxjs','rxjs/*'],tsconfig:join(frontend,'tsconfig.json')});
  const {createEnvironmentInjector,runInInjectionContext,HttpRequest,HttpResponse,HttpErrorResponse,HttpHeaders,HttpContext,
    Router,Subject,map,errorInterceptor,ToastService,ApiService,apiErrorMessage,rememberApiError,
    BACKGROUND_REQUEST,EXPECTED_ERROR_STATUSES,REQUEST_TIMEOUT_MS,HttpViewRefreshService,AdminApplicationsComponent}=await import(pathToFileURL(file));
  const toast=new ToastService();
  let current=[];
  const toastSubscription=toast.toasts$.subscribe(value=>{current=value;});
  const navigated=[];
  const injector=createEnvironmentInjector([
    {provide:ToastService,useValue:toast},{provide:Router,useValue:{navigate:path=>navigated.push(path)}},HttpViewRefreshService,
  ]);
  const flush=()=>new Promise(resolve=>setImmediate(resolve));
  const clear=()=>current.forEach(item=>toast.dismiss(item.id));
  const failure=(status,body,headers={})=>new HttpErrorResponse({status,error:body,headers:new HttpHeaders(headers)});
  function intercept(request,backend=new Subject()) {
    return {backend,stream:runInInjectionContext(injector,()=>errorInterceptor(request,()=>backend))};
  }
  async function reject(request,error,onError=()=>{}) {
    const call=intercept(request);
    call.stream.subscribe({error:onError});call.backend.error(error);await flush();
  }
  const approveRequest=()=>new HttpRequest('POST','/api/admin-approve.php',{permohonan_id:540,action:'approve'});
  const district={error:true,message:'Permohonan masih menunggu pengesahan PP Daerah sebelum boleh diluluskan oleh Admin.',
    status_workflow:'Menunggu PP Daerah',code:'APPLICATION_STATE_CONFLICT'};

  // Reproduce the reported Admin approval failure through the real component,
  // interceptor and ToastService rather than formatting a hard-coded toast.
  const approve=intercept(approveRequest());
  const api={post:()=>approve.stream.pipe(map(event=>event.body))};
  const component=new AdminApplicationsComponent(api,toast,{});
  component.approveTargetId=540;component.showApproveModal=true;component.confirmApprove();
  approve.backend.error(failure(409,district,{'X-Request-ID':'request-540'}));await flush();
  assert.equal(current.length,1,'page and interceptor must report one failure once');
  const displayed=current[0].message;
  for(const required of ['Gagal meluluskan permohonan','menunggu pengesahan PP Daerah','Status semasa: Menunggu PP Daerah',
    'Tindakan: Minta PP Daerah','permohonan #540','HTTP 409','request-540']) assert.ok(displayed.includes(required),required);
  assert.equal(component.showApproveModal,true,'a rejected approval must not close as a success');
  clear();

  // Preserve both review queues, their filters, total pending count and guards.
  component.activeTab='penilai';
  component.applications=[{id:540,status:'Menunggu PP Daerah'},{id:541,status:'Menunggu Admin'},{id:539,status:'Admin Diluluskan'}];
  for(const [filter,ids] of [['Menunggu PP Daerah',[540]],['Menunggu Admin',[541]],['Menunggu',[540,541]],['Diluluskan',[539]]]){
    component.statusFilter=filter;component.applyFilter();assert.deepEqual(component.filtered.map(item=>item.id),ids);
  }
  component.updateStats();assert.equal(component.stats.pending,2);
  assert.equal(component.applicationStatusLabel(component.applications[0]),'Menunggu PP Daerah');
  assert.equal(component.applicationStatusLabel(component.applications[1]),'Menunggu Admin');
  assert.equal(component.canDecideApplication(component.applications[0]),false);
  assert.equal(component.canDecideApplication(component.applications[1]),true);

  // Field errors and missing items must not disappear behind a generic sentence.
  await reject(approveRequest(),failure(422,{message:'Maklumat tidak lengkap.',errors:{email:'Alamat emel tidak sah.'},
    missing:[{field:'url_resit',message:'Muat naik resit bayaran.'}]}));
  assert.match(current[0].message,/Emel: Alamat emel tidak sah/);
  assert.match(current[0].message,/Resit bayaran: Muat naik resit bayaran/);clear();

  // Business errors still use the existing HTTP-200 response contract and keep
  // object identity through ApiService's legacy response normalisation.
  const business={error:true,message:'Borang sudah dihantar.',applications:[]};
  assert.equal(new ApiService({}).normalizeResponse(business),business);
  const logical=intercept(approveRequest());
  logical.stream.subscribe({next:event=>toast.apiError(event.body,'Penghantaran borang gagal.')});
  logical.backend.next(new HttpResponse({body:business}));logical.backend.complete();await flush();
  assert.equal(current.length,1);assert.match(current[0].message,/Borang sudah dihantar/);clear();

  // Unknown causes are stated honestly; write retries must first check whether
  // the original request has already been recorded.
  for(const status of [0,400,401,403,404,409,413,429,500,502,503]){
    await reject(approveRequest(),failure(status,null));
    assert.equal(current.length,1);assert.match(current[0].message,/Sebab:/);assert.match(current[0].message,/Tindakan:/);
    if(status===0||status>=500)assert.match(current[0].message,/semak sama ada perubahan sudah direkodkan/);
    clear();
  }
  assert.ok(navigated.length>=1,'expired authenticated sessions still return to login');
  const loginRequest=new HttpRequest('POST','/api/login.php',{email:'private@example.test',password:'NEVER_PRINT_THIS'});
  await reject(loginRequest,failure(401,{message:'Emel atau kata laluan tidak tepat.'}));
  assert.match(current[0].message,/Lupa Kata Laluan/);assert.doesNotMatch(current[0].message,/NEVER_PRINT_THIS|private@example/);clear();
  await reject(loginRequest,failure(403,{code:'ACCOUNT_INACTIVE',message:'Akaun tidak aktif.',reason:'Semakan Admin diperlukan.'}));
  assert.equal(current.length,0,'inactive-account login keeps its dedicated explanatory dialog');

  // A real RxJS timeout must pass through the reporter, with the original action.
  const timed=intercept(new HttpRequest('POST','/api/admin-approve.php',{permohonan_id:540,action:'approve'},
    {context:new HttpContext().set(REQUEST_TIMEOUT_MS,5)}));
  await new Promise(resolve=>timed.stream.subscribe({error:()=>resolve()}));await flush();
  assert.match(current[0].message,/masa yang ditetapkan/);assert.match(current[0].message,/semak sama ada perubahan sudah direkodkan/);clear();
  const background=new HttpRequest('GET','/api/notifications.php',{context:new HttpContext().set(BACKGROUND_REQUEST,true)});
  await reject(background,failure(503,{message:'Offline'}));assert.equal(current.length,0,'background transient errors must not spam toasts');
  const probe=new HttpRequest('GET','/api/demo-info.php',{context:new HttpContext().set(EXPECTED_ERROR_STATUSES,[404])});
  await reject(probe,failure(404,{message:'Tidak dijumpai.'}));assert.equal(current.length,0,'production demo probe is an expected 404');
  await reject(probe,failure(500,{message:'Ralat pelayan.'}));assert.equal(current.length,1,'a probe must not suppress unexpected errors');clear();
  await reject(approveRequest(),failure(200,{error:new SyntaxError('bad JSON'),text:'broken response'}));
  assert.match(current[0].message,/format data yang diterima tidak sah/);
  assert.match(current[0].message,/semak sama ada perubahan sudah direkodkan/);clear();

  // A download's JSON error can arrive as Blob or string, not just an object.
  await reject(approveRequest(),failure(400,new Blob([JSON.stringify({message:'Fail resit tidak sah.'})],{type:'application/json'})));
  assert.match(current[0].message,/Fail resit tidak sah/);clear();
  await reject(approveRequest(),failure(400,JSON.stringify({message:'Catatan terlalu panjang.'})));
  assert.match(current[0].message,/Catatan terlalu panjang/);clear();
  await reject(approveRequest(),failure(502,'<html><body>Proxy failed</body></html>'));
  assert.doesNotMatch(current[0].message,/<html>|Proxy failed/);clear();
  const databaseError=failure(500,{message:'SQLITE_CONSTRAINT: secret_table failed'});
  rememberApiError(databaseError,{url:'/api/admin-approve.php',method:'POST',body:{password:'NEVER_PRINT_THIS'}});
  assert.doesNotMatch(apiErrorMessage(databaseError),/secret_table|NEVER_PRINT_THIS|SQLITE/);

  // Audit every API endpoint used by the frontend. A page without an error
  // callback must still surface the server's reason, rather than fail silently.
  const files=execFileSync('rg',['--files',join(frontend,'src/app')],{encoding:'utf8'}).trim().split('\n').filter(file=>file.endsWith('.ts'));
  const endpoints=new Set();let handlers=0;
  for(const file of files){
    const source=readFileSync(file,'utf8');
    for(const match of source.matchAll(/['"]([\w-]+)\.php['"]/g))endpoints.add(match[1]);
    const sf=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true);
    function visit(node,inError=false){
      if(ts.isPropertyAssignment(node)&&node.name.getText(sf)==='error'&&ts.isArrowFunction(node.initializer)){
        handlers++;visit(node.initializer,true);return;
      }
      if(inError&&ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)
        &&['this.toast','this.toastService'].includes(node.expression.expression.getText(sf))){
        const name=node.expression.name.text;
        assert.ok(name!=='error'&&!(name==='show'&&node.arguments[1]?.getText(sf)==="'error'"),
          `Unstructured API error toast remains in ${file}:${sf.getLineAndCharacterOfPosition(node.pos).line+1}`);
      }
      ts.forEachChild(node,child=>visit(child,inError));
    }
    visit(sf);
  }
  for(const endpoint of endpoints){
    await reject(new HttpRequest('GET',`/api/${endpoint}.php`),failure(422,{message:`Sebab sebenar ${endpoint}`}));
    assert.equal(current.length,1);assert.ok(current[0].message.includes(`Sebab sebenar ${endpoint}`));clear();
  }
  // Repeated emissions of one error are deduplicated, but another record's
  // failure remains independently visible and can be dismissed individually.
  const first=failure(409,district),second=failure(409,district);
  rememberApiError(first,{url:'/api/admin-approve.php',method:'POST',body:{permohonan_id:540}});
  rememberApiError(second,{url:'/api/admin-approve.php',method:'POST',body:{permohonan_id:541}});
  toast.apiError(first);toast.apiError(first);toast.apiError(second);assert.equal(current.length,2);
  toast.dismiss(current[0].id);assert.equal(current.length,1);clear();
  toastSubscription.unsubscribe();injector.destroy();
  console.log(`PASS: shared errors across ${endpoints.size} endpoints and ${handlers} error handlers; actual Admin approval, labels/filters, HTTP/business errors, details, references, session/inactive login, network, timeout, Blob, deduplication and background polling.`);
} finally {rmSync(directory,{recursive:true,force:true});}
