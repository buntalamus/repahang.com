import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';

@Component({
  selector: 'app-admin-announcements',
  standalone: true,
  imports: [FormsModule, LoadingComponent],
  templateUrl: './announcements.component.html',
})
export class AdminAnnouncementsComponent implements OnInit {
  loading = true;
  announcements: any[] = [];
  showModal = false;
  editMode = false;
  form: any = { title: '', content: '' };

  constructor(
    private api: ApiService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.api.get<any>('announcements.php').subscribe({
      next: (res) => {
        this.announcements = res.data || res.announcements || [];
        this.loading = false;
      },
      error: () => (this.loading = false),
    });
  }

  openAdd(): void {
    this.form = { title: '', content: '' };
    this.editMode = false;
    this.showModal = true;
  }

  openEdit(ann: any): void {
    this.form = { ...ann };
    this.editMode = true;
    this.showModal = true;
  }

  save(): void {
    if (!this.form.title.trim() || !this.form.content.trim()) {
      this.toast.warning('Sila isi semua medan.');
      return;
    }
    const req = this.editMode
      ? this.api.put<any>(`announcements.php?id=${this.form.id}`, this.form)
      : this.api.post<any>('announcements.php', this.form);
    req.subscribe({
      next: (res) => {
        if (!res.error) {
          this.toast.success(this.editMode ? 'Pengumuman dikemaskini.' : 'Pengumuman ditambah.');
          this.showModal = false;
          this.load();
        } else {
          this.toast.error(res.message);
        }
      },
    });
  }

  deleteAnnouncement(id: number): void {
    if (!confirm('Padam pengumuman ini?')) return;
    this.api.delete<any>(`announcements.php?id=${id}`).subscribe({
      next: (res) => {
        if (!res.error) {
          this.toast.success('Pengumuman dipadam.');
          this.load();
        } else {
          this.toast.error(res.message);
        }
      },
    });
  }
}
