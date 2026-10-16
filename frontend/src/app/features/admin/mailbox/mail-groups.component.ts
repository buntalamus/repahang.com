import { ChangeDetectionStrategy, Component, ElementRef, Injector, afterNextRender, viewChild, OnDestroy, OnInit, computed, inject, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiService } from '../../../core/services/api.service';

type Contact = { id:string; name:string; email:string; role:string; district_id:number|null; district:string|null; active:boolean; groups:string[] };
type Group = { id:string; label:string };
type Directory = { year:number; groups:Group[]; contacts:Contact[]; districts:{id:number;name:string}[]; invalid:number };
type Recipient = { email:string; name:string; status:string; error:string|null };
type Selection = {year:number;groups:string[];district_id:number|null;include_inactive:boolean;exclude:string[]};
type Campaign = {selection?:Selection; id:string; mailbox:string; subject:string; content?:string; status:string; total:number; created_at:string;
  created_by_name:string; sent:number; pending:number; processing:number; failed:number; uncertain:number; cancelled:number; recipients?:Recipient[] };
type Result<T> = { error:boolean; data:T; total?:number; enabled?:boolean };
const endpoint = 'admin-mail-campaigns.php';

@Component({
  selector: 'app-mail-groups',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './mail-groups.component.html',
})
export class MailGroupsComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly injector = inject(Injector);
  private readonly reviewHeading = viewChild<ElementRef<HTMLElement>>('reviewHeading');
  private focusReview():void { afterNextRender(()=>this.reviewHeading()?.nativeElement.focus(),{injector:this.injector}); }
  readonly writeTo = output<{name:string;email:string}>();
  readonly directory = signal<Directory|null>(null);
  readonly year = signal(new Date().getFullYear());
  readonly district = signal('');
  readonly includeInactive = signal(false);
  readonly groups = signal<string[]>([]);
  readonly excluded = signal<string[]>([]);
  readonly search = signal('');
  readonly page = signal(1);
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly review = signal<Campaign|null>(null);
  readonly jobs = signal<Campaign[]>([]);
  readonly job = signal<Campaign|null>(null);
  readonly jobsPage = signal(1);
  readonly jobsTotal = signal(0);
  readonly jobsEnabled = signal(false);
  readonly confirmCancel = signal('');
  private generation = 0;
  private jobsGeneration = 0;
  private jobGeneration = 0;
  private previewId = crypto.randomUUID();
  private timer?: ReturnType<typeof setInterval>;
  readonly mailboxes = ['admin','daftar','lantikan','support','pengesahan'].map(alias=>`${alias}@refpahang.com`);
  readonly form = new FormGroup({
    from: new FormControl('support@refpahang.com',{nonNullable:true,validators:[Validators.required]}),
    subject: new FormControl('',{nonNullable:true,validators:[Validators.required,Validators.maxLength(250)]}),
    text: new FormControl('',{nonNullable:true,validators:[Validators.required,Validators.maxLength(12000)]}),
  });
  readonly baseContacts = computed(() => (this.directory()?.contacts || []).filter(contact =>
    (this.includeInactive() || contact.active) && (!this.district() || String(contact.district_id) === this.district())));
  readonly groupCounts = computed(() => Object.fromEntries((this.directory()?.groups || []).map(group=>[
    group.id,new Set(this.baseContacts().filter(contact=>contact.groups.includes(group.id)).map(contact=>contact.email)).size,
  ])) as Record<string,number>);
  readonly matching = computed(() => {
    const emails = new Set<string>();
    return this.baseContacts().filter(contact => {
      if (!contact.groups.some(group=>this.groups().includes(group)) || emails.has(contact.email)) return false;
      emails.add(contact.email); return true;
    });
  });
  readonly recipients = computed(() => this.matching().filter(contact=>!this.excluded().includes(contact.email)));
  readonly visibleContacts = computed(() => {
    const search = this.search().trim().toLowerCase();
    return this.matching().filter(contact=>`${contact.name} ${contact.email} ${contact.district || ''}`.toLowerCase().includes(search));
  });
  readonly contactPage = computed(()=>this.visibleContacts().slice((this.page()-1)*25,this.page()*25));
  readonly contactPages = computed(()=>Math.max(1,Math.ceil(this.visibleContacts().length/25)));
  readonly snapshotPage = signal(1);
  readonly snapshotContacts = computed(()=>(this.review()?.recipients || this.job()?.recipients || []).slice((this.snapshotPage()-1)*25,this.snapshotPage()*25));
  readonly previousPage = (page:number) => Math.max(1,page-1);
  readonly nextPage = (page:number) => page+1;
  readonly snapshotPages = computed(()=>Math.max(1,Math.ceil(this.snapshotTotal()/25)));
  readonly snapshotTotal = computed(()=>this.review()?.total || this.job()?.total || 0);

  ngOnInit():void {
    this.loadDirectory(); this.loadJobs();
    // Poll only while this panel is open and visible, so queued mail keeps its progress readable.
    this.timer = setInterval(()=>{
      if (document.hidden || this.busy()) return;
      if (this.jobs().some(job=>job.status==='queued')) { this.loadJobs(); if (this.job()) this.openJob(this.job()!.id,false); }
    },30000);
  }
  ngOnDestroy():void { if (this.timer) clearInterval(this.timer); }
  value(event:Event):string { return (event.target as HTMLInputElement).value; }
  checked(event:Event):boolean { return (event.target as HTMLInputElement).checked; }
  private message(error:unknown):string {
    return error instanceof HttpErrorResponse && typeof error.error?.message==='string'
      ? error.error.message : 'Permintaan gagal. Muat semula atau cuba lagi.';
  }
  loadDirectory():void {
    const generation = ++this.generation;
    this.loading.set(true); this.directory.set(null); this.error.set(''); this.excluded.set([]); this.page.set(1);
    this.api.get<Result<Directory>>(endpoint,{view:'directory',year:String(this.year())}).subscribe({
      next:result=>{if(generation===this.generation){this.directory.set(result.data);this.loading.set(false);}},
      error:error=>{if(generation===this.generation){this.loading.set(false);this.error.set(this.message(error));}},
    });
  }
  changeYear(event:Event):void { this.year.set(Number(this.value(event))); this.loadDirectory(); }
  filterChanged():void { this.excluded.set([]); this.page.set(1); this.previewId=crypto.randomUUID(); }
  toggleGroup(id:string,checked:boolean):void {
    this.groups.update(groups=>checked?[...groups,id]:groups.filter(group=>group!==id)); this.filterChanged();
  }
  toggleRecipient(email:string,checked:boolean):void {
    this.excluded.update(emails=>checked?emails.filter(value=>value!==email):[...emails,email]); this.previewId=crypto.randomUUID();
  }
  preview():void {
    if(this.busy() || this.loading() || this.form.invalid || !this.recipients().length) return;
    this.busy.set(true); this.error.set(''); this.notice.set('');
    const payload = {action:'preview',id:this.previewId,year:this.year(),groups:this.groups(),district_id:this.district() || null,
      include_inactive:this.includeInactive(),exclude:this.excluded(),...this.form.getRawValue()};
    this.api.post<Result<Campaign>>(endpoint,payload).subscribe({
      next:result=>{this.review.set(result.data);this.job.set(null);this.snapshotPage.set(1);this.busy.set(false);this.focusReview();this.loadJobs();},
      error:error=>{this.busy.set(false);this.error.set(this.message(error));this.previewId=crypto.randomUUID();},
    });
  }
  edit():void {
    const review=this.review(); if(!review || this.busy()) return;
    this.form.setValue({from:review.mailbox,subject:review.subject,text:review.content || ''});
    const selection=review.selection;
    if(selection){this.year.set(selection.year);this.loadDirectory();this.groups.set(selection.groups);this.district.set(selection.district_id===null?'':String(selection.district_id));this.includeInactive.set(selection.include_inactive);this.excluded.set(selection.exclude);}
    this.action(review.id,'cancel',()=>{this.review.set(null);this.previewId=crypto.randomUUID();});
  }
  confirm():void {
    const review=this.review(); if(!review || this.busy()) return;
    this.action(review.id,'confirm',data=>{
      this.review.set(null);this.job.set(data);this.previewId=crypto.randomUUID();
      this.notice.set(`Blast ${data.total} penerima telah dijadualkan. Penghantaran dibuat berperingkat; anda boleh menutup halaman ini.`);
    });
  }
  action(id:string,action:string,done?:(data:Campaign)=>void):void {
    if(this.busy()) return;
    this.busy.set(true);this.error.set('');
    this.api.post<Result<Campaign>>(endpoint,{id,action}).subscribe({
      next:result=>{this.busy.set(false);this.confirmCancel.set('');if(action==='cancel')this.notice.set('Blast dibatalkan. Penerima yang masih menunggu tidak akan dihantar.');if(this.job()?.id===id)this.job.set(result.data);if(action==='cancel' && this.review()?.id===id)this.review.set(null);done?.(result.data);this.loadJobs();},
      error:error=>{this.busy.set(false);this.error.set(this.message(error));},
    });
  }
  loadJobs():void {
    const generation=++this.jobsGeneration;
    this.api.get<Result<Campaign[]>>(endpoint,{page:String(this.jobsPage())}).subscribe({
      next:result=>{if(generation===this.jobsGeneration){this.jobs.set(result.data);this.jobsTotal.set(result.total || 0);this.jobsEnabled.set(!!result.enabled);}},
      error:error=>this.error.set(this.message(error)),
    });
  }
  openJob(id:string,focus=true):void {
    const generation=++this.jobGeneration;
    this.api.get<Result<Campaign>>(endpoint,{id}).subscribe({
      next:result=>{if(generation===this.jobGeneration && !this.review()){if(this.job()?.id!==id)this.snapshotPage.set(1);if(result.data.status==='draft'){this.review.set(result.data);this.job.set(null);}else this.job.set(result.data);if(focus)this.focusReview();}},
      error:error=>this.error.set(this.message(error)),
    });
  }
  status(value:string):string {
    return ({draft:'Draf — belum dihantar',queued:'Dalam giliran',completed:'Selesai diproses',cancelled:'Dibatalkan',pending:'Menunggu',
      processing:'Sedang diproses',sent:'Diterima SMTP',failed:'Gagal / ditolak SMTP',uncertain:'Status belum pasti'} as Record<string,string>)[value] || value;
  }
  date(value:string):string { return new Date(value.replace(' ','T')+'Z').toLocaleString('ms-MY'); }
}
