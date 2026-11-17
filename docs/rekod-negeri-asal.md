# Rekod Negeri Asal

Pengadil yang berpindah ke Pahang boleh membawa masuk sejarah perlawanan
berdasarkan buku log atau pengesahan PP negeri asal. Pengesahan asal dan
penerimaan Admin Pahang ialah dua perkara berasingan. PP Daerah tidak boleh
membuka akses, menerima, menolak, mengembalikan atau memadam rekod ini.

## Portal dan aplikasi

- Pengadil: menu **Rekod Negeri Asal** atau pautan dalam Rekod Perlawanan.
- Admin: **Lantikan & Perlawanan → Rekod Negeri Asal**.
- PP yang juga pengadil: **Rekod Negeri Asal Saya**, untuk rekod sendiri sahaja.
- Aplikasi Flutter menggunakan skrin asli dan API yang sama, termasuk fail
  PDF/JPG/PNG dan muat turun dokumen dengan sesi Bearer.

## Proses

1. Pengadil memohon akses, mengisi negeri asal, tarikh mula berdaftar di Pahang,
   julat tarikh sejarah, nama PP pengesah, dan bukti wajib maksimum 5 MB.
   Gabungkan halaman buku log dalam satu PDF untuk satu permohonan.
2. Admin menyemak bukti dan membuka julat tarikh sebelum perpindahan. Akses
   boleh diberi sehingga 90 hari; borang mencadangkan 30 hari. Tarikh tamat
   termasuk seluruh hari tersebut mengikut waktu Malaysia.
3. Pengadil mengisi penglibatan diri sendiri (R, AR1, AR2 atau Pengadil Ke-4).
   Pegawai lain tidak perlu mempunyai akaun RefPahang. Maksimum 500 rekod
   setiap permohonan. Draf boleh dipadam dan dimasukkan semula untuk pembetulan.
4. Pengadil menghantar senarai lengkap. Selepas dihantar, senarai dan bukti
   dikunci untuk semakan Admin. Tamat akses tidak menghalang Admin daripada
   membuat keputusan terhadap senarai yang sudah dihantar.
5. Admin menerima keseluruhan senarai selepas menyemak bukti, atau menolak
   dengan sebab. Catatan semakan wajib untuk penerimaan. Senarai ditolak
   boleh dibuka semula oleh Admin untuk pembetulan. Akses terbuka juga boleh
   ditutup oleh Admin, atau dipanjangkan apabila tamat.
6. Penerimaan mencipta rekod `perlawanan` yang disahkan dalam transaksi sama
   dengan keputusan, audit dan notifikasi. Rekod diterima serta bukti dikunci.

Hanya satu permohonan berstatus `requested`, `open` atau `submitted` dibenarkan
bagi setiap pengadil pada satu masa. Permohonan dan senarai terdahulu kekal
dalam sejarah. Membuka semula akses tidak menerima rekod secara automatik.
Notis permohonan/semakan dihantar kepada Admin; keputusan kepada pengadil,
melalui outbox rasmi dengan emel dahulu, kemudian Telegram/aplikasi.

## Kelayakan dan statistik

Rekod draf, ditolak dan menunggu semakan tidak masuk jadual `perlawanan` dan
tidak menambah kelayakan. Rekod diterima menggunakan tarikh perlawanan asal.
Permohonan sesi N mengira rekod disahkan tahun N−1 daripada kedua-dua sumber,
mengikut minimum tetapan Admin; syarat borang lain kekal berkuat kuasa.
Rekod tahun terdahulu kekal dalam sejarah tanpa dikira untuk sesi yang salah.

Senarai rekod peribadi menyatakan negeri asal dan penerimaan Admin.
Statistik peribadi memulangkan pecahan `pahang_verified_year` dan
`origin_verified_year`. Statistik perlawanan Pahang/daerah dan senarai
pengesahan biasa mengecualikan rekod negeri asal. Pengesahan PP dan kawalan
Admin biasa tidak boleh mengubah rekod yang diterima. Had biasa 14 hari kekal.

## Pelaksanaan dan pelepasan

- Migrasi: `cloudflare/migrations/0037_referee_origin_records.sql`.
- API: `/api/rekod-negeri-asal.php` (GET senarai/butiran/bukti; POST multipart
  permohonan/bukti; POST JSON akses, draf, penghantaran dan keputusan).
- Fail bukti di R2 `origin-records/`, dengan semakan pemilik/Admin sebelum
  muat turun dan `private, no-store`. Tiada pautan awam untuk bukti.
- Semua tindakan menggunakan revision untuk menolak paparan lapuk. Keputusan
  bertindih tidak menghasilkan rekod atau notifikasi berganda.
- Terapkan migrasi D1 sebelum Worker dan aset portal/aplikasi yang baharu.
  Rekod MySQL dump asal tidak diubah; pelaksanaan ini untuk Worker/D1 semasa.
- Sebelum keluaran mobile web atau Android, tambah nota Melayu bagi build dan
  nombor patch sebenar di `cloudflare/src/mobile-release-notes.json` mengikut
  `mobile/AGENTS.md` dan `docs/mobile-releases.md`. Nota tidak boleh diberi
  nombor patch rekaan. Membina kod tidak menerbitkan patch Android.

## Pengesahan

Jalankan dari direktori masing-masing dengan Node 22 / Flutter semasa projek:

```sh
# cloudflare/
npm run typecheck
npm run test:origin-records
npm run test:annual-match-year
npm run test:match-stats-current-year
npm run test:admin-match-filters
npm run test:match-conflicts
# Selepas build frontend, dengan ORIGIN_AXE_PATH menghala ke axe.min.js:
npm run test:origin-records-browser
# frontend/
npm run build:prod
# mobile/
flutter analyze --no-pub lib/screens/rekod_negeri_asal_screen.dart lib/screens/rekod_screen.dart lib/navigation.dart
flutter test --no-pub test/origin_records_test.dart test/update_notes_test.dart
```
