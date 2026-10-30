import assert from 'node:assert/strict';
import {mkdtempSync, rmSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';

// Use the real component and Angular injection, with delayed API responses.
const directory = mkdtempSync(new URL('../../frontend/node_modules/schedule-loading-', import.meta.url).pathname);
try {
  const file = join(directory, 'component.mjs');
  await build({stdin: {contents: `
    import '@angular/compiler';
    export {ChangeDetectorRef,createEnvironmentInjector,runInInjectionContext} from '@angular/core';
    export {Subject} from 'rxjs';
    export {AuthService} from './src/app/core/services/auth.service';
    export {ToastService} from './src/app/core/services/toast.service';
    export {HttpViewRefreshService} from './src/app/core/services/http-view-refresh.service';
    export {errorInterceptor} from './src/app/core/interceptors/error.interceptor';
    export {AdminLayoutComponent} from './src/app/layouts/admin-layout/admin-layout.component';
    export {Router} from '@angular/router';
    export {HttpRequest} from '@angular/common/http';
    export {LantikanPengadilComponent} from './src/app/features/admin/lantikan-pengadil/lantikan-pengadil.component';
  `, resolveDir: new URL('../../frontend', import.meta.url).pathname, loader: 'ts'},
    outfile: file, bundle: true, platform: 'node', format: 'esm',
    external: ['@angular/*', 'rxjs', 'rxjs/*', 'xlsx'],
    tsconfig: new URL('../../frontend/tsconfig.json', import.meta.url).pathname});
  const {ChangeDetectorRef,createEnvironmentInjector,runInInjectionContext,Subject,AuthService,LantikanPengadilComponent,
    ToastService,HttpViewRefreshService,errorInterceptor,AdminLayoutComponent,Router,HttpRequest} = await import(pathToFileURL(file));
  const requests = [];
  let renderNotifications = 0;
  const api = {get(endpoint, params) {
    const response = new Subject();
    requests.push({endpoint, params, response});
    return response;
  }};
  const injector = createEnvironmentInjector([
    {provide: AuthService, useValue: {currentUser: {role: 'Admin'}}},
    {provide: ChangeDetectorRef, useValue: {markForCheck() {renderNotifications++;}}},
    {provide: ToastService, useValue: {error() {}, warning() {}}},
    {provide: Router, useValue: {navigate() {}}},
    HttpViewRefreshService,
  ]);
  const component = runInInjectionContext(injector, () => new LantikanPengadilComponent(api, {}, {}));
  component.kejohananList = [{id: 1, nama: 'A'}, {id: 2, nama: 'B'}];
  const last = endpoint => requests.findLast(request => request.endpoint === endpoint);

  component.selectKejohanan(component.kejohananList[0]);
  const oldSchedule = last('jadual-perlawanan.php');
  assert.equal(component.loadingJadual, true);
  // Opening Jadual after selecting its row must retain that selection.
  component.viewKejohananJadual(component.kejohananList[0]);
  assert.equal(component.selectedKejohananId, 1);
  assert.equal(requests.length, 3);
  component.activeTab = 'jadual-lantikan';
  component.loadJadualLantikan();
  const oldReport = last('jadual-lantikan-report.php');

  component.selectReportTournament(2);
  assert.equal(oldSchedule.response.observed, false);
  assert.equal(oldReport.response.observed, false);
  oldSchedule.response.next({data: [{id: 10}]});
  oldReport.response.next({error: false, jadual: [{id: 10}]});
  assert.deepEqual(component.jadualList, []);
  assert.equal(component.jadualLantikanData, null);
  last('jadual-perlawanan.php').response.next({data: [{id: 20}]});
  last('jadual-lantikan-report.php').response.next({error: false, jadual: [{id: 20}]});
  assert.equal(component.jadualList[0].id, 20);
  assert.equal(component.jadualLantikanData.jadual[0].id, 20);
  assert.equal(component.loadingJadual, false);
  assert.equal(component.loadingJadualLantikan, false);
  assert.ok(renderNotifications >= 2, 'responses must notify Angular without another click');

  component.loadJadual(2);
  last('jadual-perlawanan.php').response.error({error: {message: 'Ralat pangkalan data.'}});
  assert.equal(component.jadualError(), 'Ralat pangkalan data.');
  assert.deepEqual(component.jadualList, []);
  component.loadJadual(2);
  assert.equal(component.jadualError(), '');
  component.loadJadualLantikan();
  last('jadual-lantikan-report.php').response.error({error: {message: 'Ralat pangkalan data.'}});
  assert.equal(component.jadualLantikanError(), 'Ralat pangkalan data.');
  assert.equal(component.loadingJadualLantikan, false);
  component.loadJadualLantikan();
  assert.equal(component.jadualLantikanError(), '');

  component.onKejohananSelect(null);
  assert.equal(component.selectedKejohananId, null);
  assert.equal(component.jadualLantikanData, null);
  assert.ok(requests.every(request => !request.response.observed));
  component.selectKejohanan(component.kejohananList[0]);
  component.ngOnDestroy();
  assert.ok(requests.every(request => !request.response.observed));

  // A shared layout refresh must happen after the consuming page has applied
  // the response, for both success and errors, without any DOM click.
  runInInjectionContext(injector, () => new AdminLayoutComponent());
  const success = new Subject();
  let pageState = 'loading';
  const beforeSuccess = renderNotifications;
  runInInjectionContext(injector, () => errorInterceptor(new HttpRequest('GET', '/api/admin-applications.php'), () => success))
    .subscribe({next() {pageState = 'loaded';}});
  success.next({data: []});
  success.complete();
  assert.equal(pageState, 'loaded');
  assert.equal(renderNotifications, beforeSuccess + 1);
  const failure = new Subject();
  const beforeFailure = renderNotifications;
  runInInjectionContext(injector, () => errorInterceptor(new HttpRequest('GET', '/api/jadual-lantikan-report.php'), () => failure))
    .subscribe({error() {pageState = 'error';}});
  failure.error({status: 500});
  assert.equal(pageState, 'error');
  assert.equal(renderNotifications, beforeFailure + 1);
  const refresh = injector.get(HttpViewRefreshService);
  injector.destroy();
  const afterDestroy = renderNotifications;
  refresh.notify();
  assert.equal(renderNotifications, afterDestroy);
  console.log('page loading: shared layout refresh on HTTP success/error, single selection, delayed rendering, stale responses, retry and cleanup passed');
} finally {
  rmSync(directory, {recursive: true, force: true});
}
