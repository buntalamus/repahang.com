import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { profileYearLabels, type ProfileRecord } from '../../../../../../shared/profile-fields';
import { jenisPengadilOptions } from '../../data/jenis-pengadil';
interface Field {
  key: string;
  label: string;
  type?: 'email' | 'tel' | 'number' | 'select';
  options?: string[];
}
const sections: { title: string; fields: Field[] }[] = [
  {
    title: 'Maklumat Peribadi',
    fields: [
      { key: 'nama_penuh', label: 'Nama Penuh' },
      { key: 'no_ic', label: 'No. Kad Pengenalan' },
      { key: 'email', label: 'Emel', type: 'email' },
      { key: 'no_telefon', label: 'No. Telefon', type: 'tel' },
      { key: 'jantina', label: 'Jantina', type: 'select', options: ['Lelaki', 'Perempuan'] },
      { key: 'umur', label: 'Umur', type: 'number' },
      { key: 'persatuan_id', label: 'Persatuan Bola Sepak Daerah', type: 'select' },
      {
        key: 'saiz_baju',
        label: 'Saiz Baju',
        type: 'select',
        options: ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'],
      },
    ],
  },
  {
    title: 'Alamat Kediaman',
    fields: ['alamat1', 'alamat2', 'poskod', 'daerah', 'negeri'].map((key, i) => ({
      key,
      label: ['Alamat 1', 'Alamat 2', 'Poskod', 'Daerah', 'Negeri'][i],
    })),
  },
  {
    title: 'Maklumat Pekerjaan',
    fields: [
      {
        key: 'status_kerja',
        label: 'Status Pekerjaan',
        type: 'select',
        options: [
          'Bekerja (Kerajaan)',
          'Bekerja (Swasta)',
          'Bekerja Sendiri',
          'Pelajar',
          'Tidak Bekerja',
          'Pesara',
        ],
      },
      ...[
        'jawatan',
        'nama_majikan',
        'alamat_majikan1',
        'alamat_majikan2',
        'poskod_majikan',
        'daerah_majikan',
        'negeri_majikan',
      ].map((key, i) => ({
        key,
        label: [
          'Jawatan',
          'Nama Majikan',
          'Alamat Majikan 1',
          'Alamat Majikan 2',
          'Poskod Majikan',
          'Daerah Majikan',
          'Negeri Majikan',
        ][i],
      })),
    ],
  },
  {
    title: 'Maklumat Waris',
    fields: [
      { key: 'nama_waris', label: 'Nama Waris' },
      { key: 'hubungan_waris', label: 'Hubungan Waris' },
      { key: 'telefon_waris', label: 'No. Telefon Waris', type: 'tel' },
    ],
  },
  {
    title: 'Kelayakan Pengadil',
    fields: [
      { key: 'jenis_pengadil', label: 'Jenis Pengadil', type: 'select' },
      { key: 'jenis_penilai', label: 'Jenis Penilai' },
      ...Object.entries(profileYearLabels).map(
        ([key, label]): Field => ({ key, label, type: 'number' }),
      ),
    ],
  },
];
let nextId = 0;
@Component({
  selector: 'app-profile-fields',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  template: `<div [formGroup]="form" class="space-y-6">
    @for (section of sections; track section.title) {
      <section [attr.aria-labelledby]="prefix + section.fields[0].key + '-title'">
        <h3
          [id]="prefix + section.fields[0].key + '-title'"
          class="text-sm font-semibold text-slate-900 border-l-4 border-pahang-yellow pl-3 mb-3"
        >
          {{ section.title }}
        </h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          @for (field of section.fields; track field.key) {
            <div class="min-w-0">
              @if (editing() && canEdit(field.key)) {
                <label
                  [for]="prefix + field.key"
                  class="block text-xs font-medium text-slate-700 mb-1"
                  >{{ field.label }}</label
                >
                @if (field.type === 'select') {
                  <select
                    [id]="prefix + field.key"
                    [formControlName]="field.key"
                    class="w-full min-w-0 px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white"
                  >
                    <option [ngValue]="null">— Pilih / belum berkenaan —</option>
                    @for (option of options(field); track option.value) {
                      <option [ngValue]="option.value">{{ option.label }}</option>
                    }
                  </select>
                } @else {
                  <input
                    [id]="prefix + field.key"
                    [type]="field.type || 'text'"
                    [formControlName]="field.key"
                    [attr.min]="field.type === 'number' ? (field.key === 'umur' ? 0 : 1900) : null"
                    [attr.max]="
                      field.type === 'number'
                        ? field.key === 'umur'
                          ? 120
                          : maximumYear(field.key)
                        : null
                    "
                    [attr.step]="field.type === 'number' ? 1 : null"
                    class="w-full min-w-0 px-3 py-2.5 border border-slate-300 rounded-lg text-sm"
                  />
                }
              } @else {
                <p class="text-xs font-medium text-slate-600 mb-1">{{ field.label }}</p>
                <p class="text-sm text-slate-900 break-words">{{ display(field.key) }}</p>
                @if (
                  editing() && (field.key === 'persatuan_id' || field.key === 'jenis_pengadil')
                ) {
                  <p class="text-xs text-slate-600 mt-1">
                    Hubungi Admin untuk menukar maklumat ini.
                  </p>
                }
              }
            </div>
          }
        </div>
      </section>
    }
    <p class="text-xs text-slate-600">
      Tahun mohon dan lulus boleh dikosongkan jika belum berkenaan. Tahun daripada sejarah
      permohonan akan dipaparkan jika maklumat profil belum diisi. Maklumat sejarah kelas tidak
      mengubah keputusan ujian tahunan atau kelulusan permohonan.
    </p>
  </div>`,
})
export class ProfileFieldsComponent {
  readonly record = input.required<ProfileRecord>();
  readonly editing = input(false);
  readonly adminMode = input(false);
  readonly managed = input(false);
  readonly memberRole = input('Pengadil');
  readonly associations = input<{ id: number; nama_persatuan: string }[]>([]);
  readonly sections = sections;
  readonly prefix = `profile-fields-${++nextId}-`;
  readonly form = new FormGroup(
    Object.fromEntries(
      sections
        .flatMap((section) => section.fields)
        .map((field) => [field.key, new FormControl<string | number | null>(null)]),
    ),
  );
  private readonly destroyRef = inject(DestroyRef);
  private lockedAssociation = false;
  private lockedKind = false;
  constructor() {
    effect(() => {
      const record = this.record();
      this.lockedAssociation = Boolean(record['persatuan_id']);
      this.lockedKind = Boolean(record['jenis_pengadil']);
      const values = Object.fromEntries(
        sections
          .flatMap((s) => s.fields)
          .map((field) => {
            const raw = record[field.key];
            return [
              field.key,
              raw === null || raw === undefined || raw === ''
                ? null
                : field.key === 'persatuan_id'
                  ? Number(raw)
                  : typeof raw === 'number'
                    ? raw
                    : String(raw),
            ];
          }),
      );
      this.form.reset(values, { emitEvent: false });
      for (const field of sections.flatMap((s) => s.fields)) {
        const control = this.form.controls[field.key];
        if (this.editing() && this.canEdit(field.key)) control.enable({ emitEvent: false });
        else control.disable({ emitEvent: false });
      }
    });
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((values) => {
      if (this.editing()) Object.assign(this.record(), values);
    });
  }
  maximumYear(key: string): number {
    return (
      Number(
        new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kuala_Lumpur', year: 'numeric' }).format(
          new Date(),
        ),
      ) + (key.includes('mohon') ? 1 : 0)
    );
  }
  canEdit(key: string): boolean {
    if (this.adminMode()) return true;
    if (key === 'persatuan_id')
      return !this.managed() && !this.lockedAssociation && this.memberRole() !== 'PP Daerah';
    if (key === 'jenis_pengadil') return this.managed() || !this.lockedKind;
    return true;
  }
  options(field: Field): { value: string | number; label: string }[] {
    if (field.key === 'persatuan_id') {
      const options = this.associations().map((row) => ({
        value: row.id,
        label: row.nama_persatuan,
      }));
      const current = Number(this.record()[field.key]);
      if (current && !options.some((row) => row.value === current))
        options.push({ value: current, label: this.display(field.key) });
      return options;
    }
    let values = field.options ?? [];
    if (field.key === 'jenis_pengadil')
      values =
        this.adminMode() || this.managed()
          ? jenisPengadilOptions(this.record()[field.key])
          : this.memberRole() === 'Penilai'
            ? ['Penilai Pengadil']
            : ['Pengadil Baharu', 'Pengadil Negeri', 'Pengadil Kebangsaan'];
    const current = String(this.record()[field.key] ?? '');
    if (current && !values.includes(current)) values = [current, ...values];
    return values.map((value) => ({ value, label: value }));
  }
  display(key: string): string {
    const record = this.record();
    const value = record[key];
    if (key === 'persatuan_id')
      return (
        this.associations().find((row) => row.id === Number(value))?.nama_persatuan ??
        String(
          record['nama_persatuan'] ??
            record['persatuan_nama'] ??
            record['persatuan_bolasepak_daerah'] ??
            '—',
        )
      );
    return value === null || value === undefined || value === '' ? '—' : String(value);
  }
}
