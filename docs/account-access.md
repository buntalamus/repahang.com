# Status akses akaun

Status akses akaun berasingan daripada peranan (Admin, PP Daerah, Pengadil, Penilai), keputusan permohonan dan status pendaftaran tahunan. Menyekat akses tidak memadam pengguna atau sejarahnya.

## Tiga punca Tidak Aktif

1. **Pendaftaran dua tahun berturut-turut:** khusus akaun Pengadil yang sudah melalui dua tahun kalendar penuh. Pada 2026, sistem memeriksa 2024 dan 2025. Akaun disekat jika tiada permohonan `pengadil_berdaftar` dihantar dalam kedua-dua tahun tersebut. Permohonan dihantar yang masih menunggu atau ditolak tetap dikira; draf dan borang kecergasan tidak dikira. Akaun baharu tidak disekat atas tahun sebelum akaun melalui dua tahun penuh.
2. **Tindakan Admin:** Admin menandakan akaun Tidak Aktif dan mengisi sebab wajib, maksimum 1000 aksara. Admin tidak boleh menyekat akaun sendiri.
3. **Tiada aktiviti selama 8 bulan:** semua peranan kecuali Admin. Sistem menggunakan masa paling terkini antara log masuk, interaksi pengguna, rekod tindakan pengguna dan tarikh penciptaan akaun. Lapan bulan ialah bulan kalendar dalam zon Asia/Kuala_Lumpur, dengan tarikh hujung bulan dilaraskan. Polling notifikasi, penghantaran push dan suntingan profil oleh Admin tidak dianggap aktiviti pengguna sasaran.

Jika kedua-dua syarat automatik dipenuhi serentak, sebab pendaftaran dipaparkan dahulu. Sekatan sedia ada tidak dibatalkan secara automatik apabila data permohonan berubah.

## Tatacara Admin

1. Buka **Admin → Pengguna** (`/admin/pengguna`).
2. Tekan **Tidak Aktif** pada akaun aktif.
3. Isi sebab yang sesuai untuk dilihat oleh pengguna, kemudian tekan **Tandakan Tidak Aktif**.
4. Untuk melihat akaun disekat, tandakan **Papar akaun tidak aktif**. Kad/senarai memaparkan sumber **Admin** atau **Automatik** serta sebab.
5. Tekan **Aktifkan**, semak nama akaun dan sahkan. Pengguna perlu log masuk semula; sesi lama tidak dipulihkan.

Pengaktifan semula memulakan tempoh baharu 8 bulan. Bagi pendaftaran, pengaktifan semula mengakui semakan tahun semasa supaya akaun tidak disekat semula serta-merta; dua tahun lengkap sebelumnya dinilai semula apabila tahun kalendar berikutnya bermula. Kelulusan atau status pendaftaran tahunan tidak berubah.

## Semasa log masuk

Kata laluan mesti betul sebelum sebab sekatan didedahkan. Web dan aplikasi Flutter memaparkan popup **Akaun Tidak Aktif**, sebab khusus dan arahan menghubungi pentadbir. Tiada sesi baharu dikeluarkan. Sesi web/aplikasi serta pendaftaran peranti push sedia ada dibatalkan apabila akaun disekat. Semua permohonan, perlawanan dan laporan dikekalkan.

## Pelaksanaan dan pelepasan

- Migrasi `cloudflare/migrations/0031_account_inactive_reason.sql` mesti digunakan sebelum Worker baharu. Ia menambah sebab/sumber, masa aktiviti dan tahun semakan. Akaun tidak aktif lama menggunakan sumber Admin dengan mesej lalai jika sebab tidak direkodkan.
- Semakan dijalankan semasa log masuk, semasa sesi diterima dan dalam cron sedia ada setiap 5 minit. Cron memproses sehingga 25 akaun setiap pusingan; cubaan log masuk disemak serta-merta.
- `POST /api/account-activity.php` memerlukan sesi sah. Web dan Flutter menghantarnya selepas interaksi sebenar, dihadkan sekali setiap 5 minit. Peranti/aplikasi versi lama masih mempunyai rekod log masuk dan tindakan, tetapi memerlukan kemas kini untuk heartbeat interaksi dan popup baharu.
- `PATCH /api/admin-users.php`: `{ "action": "set_account_status", "userId": 123, "aktif": 0, "reason": "Sebab oleh Admin" }`; pengaktifan semula menggunakan `aktif: 1`.
- Semua perubahan status, audit dan pembatalan sesi/peranti berada dalam transaksi. Laluan lama nyahaktif dan kemas kini status profil menggunakan pengendali yang sama.
- Bina Angular, Flutter web dan keluaran Android baharu untuk pelepasan penuh. Ujian tempatan atau fail binaan tidak bermaksud perubahan sudah tersedia di produksi.

## Pengesahan

- Worker: `npm run typecheck` dan `npm run test:account-access` dari `cloudflare/`.
- Regresi: `tests/staging-auth.mjs`, `tests/admin-write-gaps.mjs`, `tests/referee-audit.mjs`, `tests/mobile-push.mjs`, `tests/web-push.mjs`.
- Flutter: `flutter test test/account_inactive_test.dart` dari `mobile/`.
- Bukti UI tempatan dengan data contoh: `output/account-access-qa/`. Dialog web diuji dengan axe WCAG A/AA, fokus, Escape dan paparan 320/393 piksel.
