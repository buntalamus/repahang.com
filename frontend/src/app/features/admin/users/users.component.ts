import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { ConfirmModalComponent } from '../../../shared/components/confirm-modal/confirm-modal.component';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [FormsModule, LoadingComponent, PaginationComponent, ConfirmModalComponent],
  templateUrl: './users.component.html',
})
export class AdminUsersComponent implements OnInit {
  loading = true;
  users: any[] = [];
  filtered: any[] = [];
  paged: any[] = [];
  searchQuery = '';
  roleFilter = 'all';
  currentPage = 1;
  pageSize = 10;
  showEditModal = false;
  showAddModal = false;
  editUser: any = {};
  newUser: any = {};
  persatuanList: any[] = [];

  showDeleteModal = false;
  deleteTargetId = 0;
  deleteTargetName = '';
  showConfirmModal = false;
  confirmTitle = '';
  confirmMessage = '';
  confirmAction: (() => void) | null = null;

  roles = ['Admin', 'PP Daerah', 'Pengadil', 'Penilai'];
  stats = { total: 0, pengadil: 0, pp: 0, staff: 0 };

  constructor(
    private api: ApiService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading = true;
    this.api.get<any>('admin-users.php').subscribe({
      next: (res) => {
        this.users = res.data || res.users || [];
        this.persatuanList = res.persatuan || [];
        this.applyFilter();
        this.updateStats();
        this.loading = false;
      },
      error: () => (this.loading = false),
    });
  }

  applyFilter(): void {
    let data = [...this.users];
    if (this.roleFilter !== 'all') {
      data = data.filter((u) => (u.user_role || u.role) === this.roleFilter);
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

  updateStats(): void {
    this.stats.total = this.users.length;
    this.stats.pengadil = this.users.filter(u => (u.user_role || u.role) === 'Pengadil').length;
    this.stats.pp = this.users.filter(u => (u.user_role || u.role) === 'PP Daerah').length;
    this.stats.staff = this.users.filter(u => ['Admin', 'Penilai'].includes(u.user_role || u.role)).length;
  }

  getRoleClass(role: string): string {
    if (role === 'Admin') return 'bg-rose-50 text-rose-700';
    if (role === 'PP Daerah') return 'bg-blue-50 text-blue-700';
    if (role === 'Pengadil') return 'bg-emerald-50 text-emerald-700';
    if (role === 'Penilai') return 'bg-purple-50 text-purple-700';
    return 'bg-slate-100 text-slate-700';
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
        this.editUser = { ...res.user, userId: res.user.id };
        this.editUser.user_role = this.editUser.role || this.editUser.user_role;
        this.showEditModal = true;
      },
      error: () => {
        this.editUser = { ...user, userId: user.id, user_role: user.user_role || user.role };
        this.showEditModal = true;
      },
    });
  }

  saveUser(): void {
    this.api.put<any>('admin-users.php', this.editUser).subscribe({
      next: (res) => {
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
    this.showDeleteModal = true;
  }

  onDeleteConfirmed(): void {
    const id = this.deleteTargetId;
    this.showDeleteModal = false;
    this.api.delete<any>(`admin-users.php?id=${id}`).subscribe({
      next: (res) => {
        if (!res.error) {
          this.toast.success('Pengguna dipadam.');
          this.loadUsers();
        } else {
          this.toast.error(res.message);
        }
      },
    });
  }

  resetPassword(user: any): void {
    this.confirmTitle = 'Reset Kata Laluan';
    this.confirmMessage = `Reset kata laluan untuk ${user.nama_penuh}?`;
    this.confirmAction = () => {
      this.api.patch<any>('admin-users.php', { userId: user.id, action: 'reset_password' }).subscribe({
        next: (res) => {
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
