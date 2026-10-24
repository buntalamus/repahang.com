import { ModalFocusDirective } from '../../../shared/directives/modal-focus.directive';
import { ProfileFieldsComponent } from '../../../shared/components/profile-fields/profile-fields.component';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { ConfirmModalComponent } from '../../../shared/components/confirm-modal/confirm-modal.component';
import { ProfileModalService } from '../../../core/services/profile-modal.service';
import { UserMasterDataExportComponent } from './master-data-export.component';
import { jenisPengadilOptions } from '../../../shared/data/jenis-pengadil';

@Component({
  selector: 'app-admin-users',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModalFocusDirective, ProfileFieldsComponent, ReactiveFormsModule, FormsModule, LoadingComponent, PaginationComponent, ConfirmModalComponent, UserMasterDataExportComponent],
  templateUrl: './users.component.html',
})
export class AdminUsersComponent implements OnInit {
  private readonly cdr=inject(ChangeDetectorRef);
  readonly jenisPengadilOptions = jenisPengadilOptions;
  loading = true;
  users: any[] = [];
  filtered: any[] = [];
  paged: any[] = [];
  searchQuery = '';
  roleFilter = 'all';
  typeFilter = 'all';
  yearFilter = new Date().getFullYear();
  years = Array.from({ length: 7 }, (_, index) => new Date().getFullYear() + 1 - index);
  showInactive = false;
  currentPage = 1;
  pageSize = 10;
  showEditModal = false;
  showAddModal = false;
  editUser: any = {};
  newUser: any = {};
  persatuanList: any[] = [];

  readonly showDeleteModal = signal(false);
  readonly statusSaving = signal(false);
  readonly statusError = signal('');
  readonly inactiveReason = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(1000)] });
  deleteTargetId = 0;
  deleteTargetName = '';
  showConfirmModal = false;
  confirmTitle = '';
  confirmMessage = '';
  confirmAction: (() => void) | null = null;

  roles = ['Admin', 'PP Daerah', 'Pengadil', 'Penilai'];
  stats = { total: 0, pengadil: 0, pp: 0, ra: 0 };

  constructor(
    private api: ApiService,
    private toast: ToastService,
    public profileModal: ProfileModalService,
  ) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading = true;
    this.api.get<any>('admin-users.php', { year: String(this.yearFilter) }).subscribe({
      next: (res) => {
        this.cdr.markForCheck();
        this.users = res.data || res.users || [];
        this.persatuanList = res.persatuan || [];
        this.applyFilter();
        this.updateStats();
        this.loading = false;
      },
      error: () => {this.loading=false;this.cdr.markForCheck();},
    });
  }

  applyFilter(): void {
    let data = this.showInactive ? [...this.users] : this.users.filter((u) => this.isActive(u));
    if (this.roleFilter !== 'all') {
      data = data.filter((u) => (u.user_role || u.role) === this.roleFilter);
    }
    if (this.typeFilter !== 'all') {
      data = data.filter((u) => this.matchesType(u, this.typeFilter));
    }
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      data = data.filter((u) =>
        (u.nama_penuh || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q)
      );
    }
    this.filtered = data;
    this.currentPage = 1;
    this.updatePaged();
  }

  updatePaged(): void {
    const start = (this.currentPage - 1) * this.pageSize;
    this.paged = this.filtered.slice(start, start + this.pageSize);
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.updatePaged();
  }

  onPageSizeChange(size: number): void {
    this.pageSize = size;
    this.currentPage = 1;
    this.updatePaged();
  }

  isActive(user: any): boolean {
    return Number(user.is_active ?? user.aktif ?? 1) === 1;
  }

  get inactiveCount(): number {
    return this.users.filter((u) => !this.isActive(u)).length;
  }

  updateStats(): void {
    this.stats.total = this.users.length;
    this.stats.pengadil = this.users.filter(u => this.matchesType(u, 'pengguna_pengadil')).length;
    this.stats.pp = this.users.filter(u => (u.user_role || u.role) === 'PP Daerah').length;
    this.stats.ra = this.users.filter(u => Number(u.is_ra) === 1).length;
  }

  matchesType(user: any, type: string): boolean {
    const referee = Number(user.is_referee) === 1;
    switch (type) {
      case 'pengguna_pengadil': return referee;
      case 'berdaftar': return referee && Number(user.current_approved) === 1;
      case 'baharu': return referee && Number(user.current_applied) !== 1 && Number(user.prior_approved) !== 1;
      case 'tidak_aktif': return referee && Number(user.prior_approved) === 1 && Number(user.current_applied) !== 1;
      case 'menunggu': return referee && Number(user.current_applied) === 1 && Number(user.current_approved) !== 1;
      case 'kelas3': return referee && Number(user.class3_passed) === 1;
      case 'kelas1': return referee && Number(user.class1_passed) === 1;
      case 'ra': return Number(user.is_ra) === 1;
      case 'pp': return (user.user_role || user.role) === 'PP Daerah';
      default: return true;
    }
  }

  hasFlag(user: any, flag: 'current_applied' | 'current_approved' | 'current_license' | 'class3_passed' | 'class1_passed'): boolean {
    return Number(user[flag]) === 1;
  }

  registrationLabel(user: any): string {
    if (!this.matchesType(user, 'pengguna_pengadil')) return '-';
    if (Number(user.current_approved) === 1) return 'Pengadil Berdaftar';
    if (Number(user.current_applied) === 1) return 'Permohonan Belum Diluluskan';
    if (Number(user.prior_approved) === 1) return 'Pengadil Tidak Aktif';
    return 'Pengadil Baharu';
  }

  licenseLabel(user: any): string {
    if (Number(user.current_approved) !== 1) return '';
    if (Number(user.current_license) === 1) return `Layak patch / lesen negeri ${this.yearFilter}`;
    if (!user.current_fitness_status) return `Menunggu keputusan ujian kecergasan ${this.yearFilter}`;
    return `Tidak layak patch / lesen negeri ${this.yearFilter}`;
  }

  reactivate(user: any): void {
    this.confirmTitle = 'Aktifkan Semula Akaun';
    this.confirmMessage = `Aktifkan semula akaun ${user.nama_penuh}? Pengguna perlu log masuk semula. Tempoh 8 bulan bermula semula; semakan pendaftaran automatik seterusnya pada tahun hadapan.`;
    this.confirmAction = () => {
      this.api.patch<any>('admin-users.php', { userId: user.id, action: 'set_account_status', aktif: 1 }).subscribe({
        next: (res) => {
        this.cdr.markForCheck();
          if (!res.error) {
            this.toast.success('Akaun diaktifkan semula.');
            this.loadUsers();
          } else {
            this.toast.error(res.message);
          }
        },
      });
    };
    this.showConfirmModal = true;
  }

  getRoleClass(role: string): string {
    if (role === 'Admin') return 'bg-rose-50 text-rose-700';
    if (role === 'PP Daerah') return 'bg-blue-50 text-blue-700';
    if (role === 'Pengadil') return 'bg-emerald-50 text-emerald-700';
    if (role === 'Penilai') return 'bg-purple-50 text-purple-700';
    return 'bg-slate-100 text-slate-700';
  }

  displayRole(role: string | null | undefined): string {
    if (role === 'PP Daerah') return 'Pegawai Pembangunan Daerah';
    if (role === 'Penilai') return 'Penilai Pengadil';
    return role || '-';
  }

  getProfileImage(url: string | null): string {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    return url.startsWith('/') ? url : '/' + url;
  }

  titleCase(val: string | null | undefined): string {
    if (!val) return '-';
    return val.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  }

  getGlobalIndex(i: number): number {
    return (this.currentPage - 1) * this.pageSize + i + 1;
  }

  openEdit(user: any): void {
    // Load full user profile
    this.api.get<any>('admin-users.php', { id: user.id.toString() }).subscribe({
      next: (res) => {
        this.cdr.markForCheck();
        this.editUser = { ...res.user, userId: res.user.id };
        this.editUser.user_role = this.editUser.role || this.editUser.user_role;
        this.showEditModal = true;
      },
      error: () => {
        this.toast.error('Gagal membaca profil penuh. Sila cuba semula.');
      },
    });
  }

  saveUser(): void {
    this.api.put<any>('admin-users.php', this.editUser).subscribe({
      next: (res) => {
        this.cdr.markForCheck();
        if (!res.error) {
          this.toast.success('Pengguna dikemaskini.');
          this.showEditModal = false;
          this.loadUsers();
        } else {
          this.toast.error(res.message);
        }
      },
    });
  }

  deleteUser(id: number, name: string): void {
    this.deleteTargetId = id;
    this.deleteTargetName = name;
    this.inactiveReason.reset('');
    this.statusError.set('');
    this.showDeleteModal.set(true);
  }

  closeStatusDialog(): void {
    if (!this.statusSaving()) this.showDeleteModal.set(false);
  }

  onDeleteConfirmed(): void {
    const reason = this.inactiveReason.value.trim();
    if (this.statusSaving()) return;
    if (!reason || this.inactiveReason.invalid) {
      this.statusError.set('Sila isi sebab Tidak Aktif (maksimum 1000 aksara).');
      this.inactiveReason.markAsTouched();
      return;
    }
    this.statusSaving.set(true);
    this.statusError.set('');
    this.api.patch<{ error: boolean; message: string }>('admin-users.php', {
      userId: this.deleteTargetId, action: 'set_account_status', aktif: 0, reason,
    }).subscribe({
      next: (res) => {
        this.statusSaving.set(false);
        if (res.error) { this.statusError.set(res.message); return; }
        this.showDeleteModal.set(false);
        this.toast.success(res.message);
        this.loadUsers();
      },
      error: (err) => {
        this.statusSaving.set(false);
        this.statusError.set(err?.error?.message || 'Gagal menyimpan status akaun. Sila cuba lagi.');
      },
    });
  }

  revokeTelegram(user: any): void {
    this.confirmTitle = 'Batalkan Pautan Telegram';
    this.confirmMessage = `Batalkan pautan Telegram untuk ${user.nama_penuh}? Pengguna perlu memautkan semula akaun Telegram untuk menerima mesej melalui Telegram.`;
    this.confirmAction = () => {
      this.api.patch<{ error: boolean; message: string }>('admin-users.php', {
        userId: user.id, action: 'revoke_telegram',
      }).subscribe({
        next: (res) => {
          if (res.error) {
            this.toast.error(res.message);
            return;
          }
          this.editUser = { ...this.editUser, telegram_chat_id: null };
          this.toast.success(res.message);
          this.loadUsers();
        },
        error: (err) => this.toast.error(err?.error?.message || 'Gagal membatalkan pautan Telegram.'),
      });
    };
    this.showConfirmModal = true;
  }

  resetPassword(user: any): void {
    this.confirmTitle = 'Reset Kata Laluan';
    this.confirmMessage = `Reset kata laluan untuk ${user.nama_penuh}?`;
    this.confirmAction = () => {
      this.api.patch<any>('admin-users.php', { userId: user.id, action: 'reset_password' }).subscribe({
        next: (res) => {
        this.cdr.markForCheck();
          if (!res.error) {
            this.toast.success(res.message);
          } else {
            this.toast.error(res.message);
          }
        },
      });
    };
    this.showConfirmModal = true;
  }

  resendNotification(user: any): void {
    this.confirmTitle = 'Hantar Semula Emel';
    this.confirmMessage = `Hantar semula emel pendaftaran kepada ${user.nama_penuh}?`;
    this.confirmAction = () => {
      this.api.patch<any>('admin-users.php', { userId: user.id, action: 'resend_notification' }).subscribe({
        next: (res) => {
        this.cdr.markForCheck();
          if (!res.error) {
            this.toast.success(res.message);
          } else {
            this.toast.error(res.message);
          }
        },
      });
    };
    this.showConfirmModal = true;
  }

  onActionConfirmed(): void {
    this.showConfirmModal = false;
    if (this.confirmAction) this.confirmAction();
  }

  openAddUser(): void {
    this.newUser = { nama_penuh: '', email: '', no_telefon: '', user_role: 'Pengadil', persatuan_id: '', jenis_pengadil: '' };
    this.showAddModal = true;
  }

  addUser(): void {
    const formData = new FormData();
    formData.append('nama_penuh', this.newUser.nama_penuh);
    formData.append('email', this.newUser.email);
    formData.append('no_telefon', this.newUser.no_telefon || '');
    formData.append('user_role', this.newUser.user_role);
    formData.append('persatuan_id', this.newUser.persatuan_id || '');
    formData.append('jenis_pengadil', this.newUser.jenis_pengadil || '');

    this.api.postFormData<any>('admin-users.php', formData).subscribe({
      next: (res) => {
        this.cdr.markForCheck();
        if (!res.error) {
          this.toast.success(res.message + (res.generatedPassword ? ` Kata laluan: ${res.generatedPassword}` : ''));
          this.showAddModal = false;
          this.loadUsers();
        } else {
          this.toast.error(res.message);
        }
      },
    });
  }
}
