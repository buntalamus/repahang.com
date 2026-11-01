import {ChangeDetectionStrategy,Component,computed,inject,signal} from '@angular/core';
import {DatePipe} from '@angular/common';
import {ApiService} from '../../../core/services/api.service';

interface Report {id:string;match_id:string;recorded_at:number;referee_name:string;match_number:string;scheduled_start:number;tournament_name:string;home_name:string;away_name:string}

@Component({
  selector:'app-c13-reports',changeDetection:ChangeDetectionStrategy.OnPush,imports:[DatePipe],
  template:`<section class="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 space-y-4" aria-labelledby="c13-report-title">
    <div class="flex items-center justify-between gap-4 flex-wrap"><div><h2 id="c13-report-title" class="text-lg font-bold text-slate-900">Laporan perlawanan · C13</h2><p class="text-sm text-slate-600 mt-1">Salinan rasmi yang dihantar dan ditandatangani pengadil utama.</p></div><button type="button" (click)="load()" [disabled]="loading()" class="border border-slate-300 rounded-lg px-4 py-3 text-sm font-semibold text-slate-800">Muat semula</button></div>
    <label class="block text-sm font-semibold text-slate-700">Cari perlawanan, kejohanan atau pengadil<input class="mt-1 block w-full border border-slate-300 rounded-lg px-3 py-3" [value]="query()" (input)="query.set($any($event.target).value)" type="search" /></label>
    @if(loading()){<p role="status" class="text-slate-600">Memuatkan laporan perlawanan…</p>}
    @else if(error()){<p role="alert" class="text-red-800">{{error()}}</p>}
    @else {<div class="space-y-3">@for(report of filtered();track report.id){<article class="border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
      <div class="min-w-0"><p class="text-xs text-slate-600">{{report.tournament_name}} · {{report.scheduled_start*1000|date:'d MMM y, HH:mm'}}</p><h3 class="text-sm font-bold text-slate-900 mt-1">{{report.match_number}} · {{report.home_name}} lwn {{report.away_name}}</h3><p class="text-sm text-slate-700 mt-1">Pengadil: {{report.referee_name}}</p><p class="text-xs text-slate-600 mt-1">Dihantar {{report.recorded_at*1000|date:'d MMM y, HH:mm'}} · Selesai · Rasmi</p></div>
      <a [href]="pdf(report)" target="_blank" rel="noopener" class="bg-slate-900 text-white px-4 py-3 rounded-lg text-sm font-semibold">Muat turun PDF C13</a>
    </article>}@empty{<p class="text-sm text-slate-600 py-6">{{reports().length?'Tiada laporan sepadan dengan carian.':'Belum ada C13 rasmi dihantar.'}}</p>}</div>}
  </section>`,
})
export class C13ReportsComponent {
  private readonly api=inject(ApiService);
  readonly loading=signal(true);readonly error=signal('');readonly query=signal('');readonly reports=signal<Report[]>([]);
  readonly filtered=computed(()=>{const query=this.query().trim().toLocaleLowerCase('ms');return this.reports().filter(r=>[r.tournament_name,r.match_number,r.home_name,r.away_name,r.referee_name].join(' ').toLocaleLowerCase('ms').includes(query));});
  constructor(){this.load();}
  load(){this.loading.set(true);this.error.set('');this.api.get<{data:{records:Report[]}}>('jfa-c13.php',{view:'admin'}).subscribe({next:body=>{this.reports.set(body.data.records);this.loading.set(false);},error:()=>{this.error.set('Laporan C13 tidak dapat dimuatkan. Tekan Muat semula untuk mencuba lagi.');this.loading.set(false);}});}
  pdf(report:Report){return '/api/jfa-c13.php?view=admin&match='+encodeURIComponent(report.match_id)+'&record='+encodeURIComponent(report.id);}
}
