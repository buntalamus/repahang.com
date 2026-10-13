# Persediaan migrasi RefPahang ke Cloudflare

Tarikh audit: 13 Oktober 2026. Ini ialah inventori dan alat persediaan untuk
staging; aplikasi production, DNS, peti masuk dan penghantaran emel belum diubah.

## Sumber data yang dipilih

- Dump: `refpahan_refpahang-3.sql` (17,938,043 bait), SHA-256
  `e9b2919f76e3112037b6c94d725f1f7d37db1f6510b4fe0e0d941104de1d7575`.
- Dump phpMyAdmin bertarikh 13 Oktober 2026, MySQL 8.0.37. Salinan dump berjaya
  diimport ke MySQL tempatan terasing untuk audit; dump asal tidak diubah.
- 40 jadual, 58,606 baris, anggaran storan InnoDB 30 MB, 58 foreign key,
  38 lajur `ENUM`, enam lajur `JSON`. Ini ukuran dump, bukan ukuran production
  pada masa pertukaran kelak.
- Jadual utama: `notifications` 33,056, `perlawanan` 11,507,
  `lantikan_audit_log` 4,183, `activity_log` 2,828,
  `telegram_onboarding_log` 1,101, `lantikan_pengadil` 997,
  `permohonan` 488 dan `users` 370.
- Dump asal ini **tidak** mengandungi permohonan #535 atau 51 rekod perlawanan
  Hanafi tahun 2026 yang telah dipadam. Untuk salinan migrasi yang mengandungi
  51 perlawanan tersebut, gunakan fail gabungan `hanafi51` di bawah. Dump asal
  kekal tanpa perubahan. Permohonan #535 tidak dibina semula.
- Fail SQL ini mengandungi data peribadi. Ia diabaikan oleh Git dan tidak boleh
  dimuat naik sebagai aset Worker atau ke repositori awam.

## Aplikasi dan data fail

- Frontend sedia ada Angular 21 menghasilkan aset statik sekitar 2 MB dan API
  relatif `/api`. Ia boleh dijadikan aset Cloudflare tanpa menulis semula UI
  terlebih dahulu. Backend PHP (90 fail API) tidak boleh dijalankan terus
  dalam Workers; aliran API, sesi, akses peranan, transaksi, PDF, Telegram dan
  tugas berkala perlu dialih ke kod Worker.
- `uploads/` tempatan berukuran 328 MB dengan 763 fail. Audit silang dump
  mengenal pasti 584 laluan fail tempatan unik yang dirujuk, tetapi 74 tiada
  dalam salinan `uploads/` ini. Kesemua 74 kemudian diperoleh daripada
  pelayan production dan disimpan dalam R2 private. 42 pautan resit Google
  Drive kekal sebagai pautan luar; ia tidak termasuk dalam salinan R2.
- PDF TCPDF dan lampiran borang R1/R2/R4 perlu dibina semula dan diuji di
  Worker. Penghantaran borang berlampiran juga perlu ikut had penyedia emel.

## Pangkalan data sasaran: D1

Pengguna memilih D1 sepenuhnya. Dump MySQL **tidak boleh** diimport terus ke D1
kerana D1 memerlukan skema/SQL SQLite. Binaan staging terkini menggabungkan
dump pilihan dengan dua fail pemulihan Hanafi yang sudah disediakan:

```sh
python3 cloudflare/build_hanafi51_seed.py
```

Skrip ini mengesahkan SHA-256 ketiga-tiga sumber, mengimport dump asal ke
MySQL sementara yang terasing, menjalankan pemulihan 38 + 13, menguji import
semula dump gabungan ke pangkalan kosong, lalu menghasilkan salinan SQLite dan
SQL D1. Ia memerlukan `mysqld`, `mysql`, `mysqldump` dan modul Python
`mysql-connector-python`. Ia menolak output yang sudah wujud supaya data
peribadi tidak tertimpa secara senyap. Output baharu:

| Fail peribadi dalam `output/cloudflare/` | Tujuan |
| --- | --- |
| `refpahang_2026-10-13_hanafi51_mysql.sql` | Dump MySQL gabungan untuk rujukan/ujian |
| `refpahang_2026-10-13_hanafi51.sqlite` | Salinan SQLite yang telah diperiksa |
| `refpahang_2026-10-13_hanafi51_d1.sql` | SQL untuk import D1 staging |
| `refpahang_2026-10-13_hanafi51_manifest.json` | Hash sumber/output dan kiraan |
| `refpahang_2026-10-13_hanafi51_bundle.zip` | Pakej MySQL + D1 + manifest + audit 51 baris |

Pakej ZIP mengandungi data peribadi; simpan secara tertutup. Pilih **satu**
fail SQL yang sepadan dengan sasaran (MySQL atau D1). Fail SQLite berguna
untuk semakan tempatan dan tidak disertakan dalam ZIP.

Pengesahan salinan gabungan: 40 jadual, **58,657 baris**, termasuk
`perlawanan` **11,558**. Bagi `user_id=80` (identiti Hanafi yang disahkan oleh
skrip pemulihan), tahun 2026 mempunyai **51 ID perlawanan berlainan**, semua
`status_pp='Disahkan'` dan `permohonan_id=NULL`. 38 baris bersumber daripada
sandaran 27 Ogos; 13 lagi daripada PDF 13 Oktober. Pertanyaan semakan:

```sql
SELECT COUNT(*) AS perlawanan_hanafi_2026,
       COUNT(DISTINCT id) AS id_unik
FROM perlawanan
WHERE user_id=80 AND tarikh >= '2026-01-01' AND tarikh < '2027-01-01';
-- Kedua-duanya mesti 51.
```

SQL gabungan telah diimport melalui Wrangler 4.150.0 ke **D1 tempatan dan
D1 staging jauh** `refpahang-staging-20261013-hanafi51`. Kedua-duanya mempunyai
40 jadual aplikasi/58,657 baris dan 51 perlawanan Hanafi yang unik.
Migrasi `cloudflare/migrations/0001_worker_sessions.sql` menambah dua jadual
untuk sesi Worker tanpa mengubah baris aplikasi. `foreign_key_check=0` pada
salinan tempatan dan jauh; `integrity_check=ok` disahkan pada salinan tempatan.
API D1 jauh tidak membenarkan `PRAGMA integrity_check`, jadi semakan itu tidak
didakwa untuk D1 jauh. Ini masih belum membuktikan keserasian semua endpoint.

**Had sumber:** PDF tidak menyimpan semua ID asal, masa, pasukan, skor atau
butiran pengesahan bagi 13 perlawanan tambahan; medan yang tidak diketahui
tidak direka. Dua rujukan lantikan lama (347 dan 833) telah tiada dalam
sandaran. Rekod anak selepas sandaran dan permohonan #535 juga tidak boleh
dipulihkan daripada PDF. Fail gabungan ialah salinan staging berdasarkan dump
13 Oktober; ia bukan bukti keadaan production semasa. Sebelum cutover, ambil
sandaran production terkini dan rekonsiliasi semua rekod.

Alat asas untuk penukaran sendiri masih tersedia:

```sh
# Import dump ke pangkalan MySQL tempatan yang terasing dahulu.
mysql -e 'CREATE DATABASE refpahang_staging CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'
mysql --database=refpahang_staging < refpahan_refpahang-3.sql
python3 cloudflare/mysql_to_d1_snapshot.py \
  --database refpahang_staging \
  --output output/cloudflare/refpahang_staging.sqlite
python3 cloudflare/sqlite_to_d1_sql.py \
  --snapshot output/cloudflare/refpahang_staging.sqlite \
  --output output/cloudflare/refpahang_staging_d1.sql
```

Untuk MySQL melalui Unix socket tambah `--socket LALUAN_SOCKET` pada arahan
pertama Python. Kata laluan boleh diberikan melalui `MYSQL_PWD`; jangan letak
kata laluan dalam argumen shell atau dokumen. Alat ini menolak output sedia
ada, dan `output/cloudflare/` diabaikan Git kerana mengandungi data peribadi.

Percubaan terdahulu pada salinan tepat dump asal menghasilkan SQLite 20 MB dan SQL
SQLite 33,597,455 bait. Kedua-duanya mempunyai 40 jadual, 58,606 baris,
58 foreign key dan 128 indeks. Import semula SQL ke SQLite dengan foreign key
aktif berjaya. Fail SQL juga berjaya diimport melalui Wrangler 4.150.0 ke
**D1 tempatan**; selepas mengecualikan satu jadual metadata dalaman,
40 jadual/58,606 baris sepadan, `integrity_check=ok` dan
`foreign_key_check=0`. Sel terbesar 10,371 bait dan baris terbesar 11,052
bait. Import tempatan dan jauh gabungan Hanafi dibuktikan secara berasingan.
Penukaran ini ialah **salinan staging data**, belum skema aplikasi akhir:
`ENUM` menjadi teks, `DECIMAL` menjadi teks untuk mengekalkan digit tepat,
default MySQL belum dipindah, dan collation, transaksi serta semua pertanyaan
PHP mesti dipetakan dan diuji dalam API Worker.

## Media R2 staging

Bucket private `refpahang-staging-20261013-media` telah menerima 761 fail
tempatan dengan jumlah 341,976,988 bait. Manifest per fail dalam
`output/cloudflare/r2-media-upload-manifest.json` menyimpan saiz dan SHA-256;
tiada ralat muat naik. Tiga objek R2 yang dimuat turun semula mempunyai SHA-256
sepadan dengan sumber. Sebanyak 74 fail tambahan (28,769,132 bait) yang tiada
dalam `uploads/` tempatan diperoleh daripada URL tepat dalam dump di
`https://refpahang.com/uploads/`, disahkan sebagai imej/PDF, lalu dimuat naik
ke R2. Tiga fail pemulihan yang dimuat turun semula juga sepadan SHA-256.
Sandaran private fail ini ialah
`output/cloudflare/refpahang_recovered_74_media.zip`; manifest berasingan
menyimpan checksum. Jumlah objek staging kini **835**. Jalankan semula
`python3 cloudflare/sync_media.py --bucket refpahang-staging-20261013-media`
untuk menyambung salinan tempatan, atau jalankan
`python3 cloudflare/recover_missing_media.py --snapshot output/cloudflare/refpahang_2026-10-13_hanafi51.sqlite --bucket refpahang-staging-20261013-media`
untuk salinan tambahan jika sumber production masih wujud. Fail luaran Google
Drive belum dipindahkan ke R2.

## Worker staging

`cloudflare/wrangler.jsonc` mengikat D1 staging, R2 private dan aset Angular.
Deployment staging berada di
`https://refpahang-staging-20261013.buntalamus2.workers.dev`.
`STAGING_AUTH_ENABLED=0` mengunci log masuk serta media ketika port API belum
lengkap. Endpoint yang sudah dipindahkan: pengumuman awam, status pendaftaran,
persatuan awam, log masuk/sesi/log keluar, daerah, profil pengguna, tetapan
permohonan, sejarah permohonan milik sendiri, senarai permohonan Admin,
semakan penyelenggaraan, dan muat turun media terhad kepada pemilik/Admin.
Laluan API lain
menjawab 503 secara jelas. Ini **bukan** pengganti production yang boleh
digunakan untuk permohonan, lantikan, PDF atau emel.

Ujian tempatan dengan pengguna sintetik membuktikan kata laluan bcrypt PHP,
sesi D1, profil, peranan Admin dan Pengadil, tetapan, sejarah milik sendiri,
senarai Admin, penolakan rekod/fail milik orang lain, log keluar dan had saiz
permintaan. Pengguna
sintetik sudah dipadam daripada D1 tempatan; ia tidak pernah diimport ke D1
jauh. Build Angular production dan typecheck Worker lulus. Semakan HTTP pada
Worker sebenar: aset dan API awam 200, API belum dipindahkan 503, media private
tanpa sesi 401, mod penyelenggaraan aktif. Pengesahan fungsi semua peranan dan
laluan belum selesai.

## Semua tetapan emel semasa

`config/email.php` menggunakan SMTP TLS tersirat dengan `SMTP_HOST` dan
`SMTP_PORT` (semakan semasa: `mail.refpahang.com:465`). Lima identiti penghantar
daripada `.env` telah disahkan hadir dan sepadan dengan nama/alamat awam dalam
`.env.example`:

| Jenis | Alamat penghantar | Nama penghantar | Kegunaan |
| --- | --- | --- | --- |
| `admin` | `admin@refpahang.com` | Admin RefPahang | Pentadbiran |
| `daftar` | `daftar@refpahang.com` | Pendaftaran Pengadil Pahang | Pendaftaran/kelulusan |
| `lantikan` | `lantikan@refpahang.com` | Lantikan Pengadil Pahang | Lantikan/notifikasi |
| `support` | `support@refpahang.com` | Sokongan Pengadil Pahang | Sokongan |
| `pengesahan` | `pengesahan@refpahang.com` | Pengesahan Perlawanan Pahang | Pengesahan |

Peti masuk kelima-lima alamat ini **kekal pada penyedia sedia ada**, seperti
yang diputuskan pengguna. Ini meliputi menerima dan menyimpan emel masuk;
memindahkan emel keluar ke Worker tidak memindahkan peti masuk.

Pautan dalam emel menggunakan `BASE_URL`; nilai production semasa telah
disahkan menunjuk ke `https://refpahang.com`. Templat PHP dan imej inline CID
masih perlu dipindahkan ke Worker, termasuk logo yang kini dibaca daripada
fail `uploads/`.

`cloudflare/prepare_email.py` menyemak semua lima identiti tanpa mencetak
nilai rahsia:

```sh
python3 cloudflare/prepare_email.py
python3 cloudflare/prepare_email.py --transport legacy-smtp
```

Apabila Worker staging sudah diwujudkan, arahan berikut boleh menghantar
tetapan terus dari `.env` ke **versi Worker baharu yang belum dideploy**:

```sh
python3 cloudflare/prepare_email.py \
  --sync-worker NAMA_WORKER_STAGING \
  --base-url https://staging.refpahang.com
```

Gunakan URL sebenar staging apabila ia tersedia; `--base-url` diwajibkan agar
emel staging tidak tersalah paut ke production. Mod lalai membawa sebelas
tetapan alamat, nama penghantar dan `BASE_URL` untuk Cloudflare
Email Service. Jika SMTP lama dipilih sebagai pengangkutan, tambah
`--transport legacy-smtp` pada arahan staging tadi untuk turut membawa
`SMTP_HOST`, `SMTP_PORT` dan kelima-lima kata laluan (18 tetapan semuanya).
Tambah `--activate` hanya selepas Worker staging wujud untuk menerbitkan
secret pada Worker staging aktif; tanpa pilihan ini, versi secret disediakan
tetapi belum dideploy. Tiada nilai rahsia ditulis ke fail atau argumen shell.
Pada 13 Oktober, semua **18 nama secret** SMTP lama termasuk lima identiti
penghantar telah dipasang pada Worker staging aktif dengan `BASE_URL` menunjuk
ke alamat `workers.dev` di atas. Nilai rahsia tidak dicatat dalam Git, log
atau dokumen. Penyimpanan ini belum menghidupkan penghantaran emel.
`cloudflare/mail.ts`
menyediakan pemetaan kelima-lima penghantar untuk API Email Service serta
lampiran dan imej inline. Ia belum disambung kepada endpoint Worker, maka
tiada emel akan terkirim oleh persediaan ini. Menyimpan tetapan pada Worker
belum mengalihkan peti masuk atau sejarah emel. Templat sedia ada masih perlu
dipindahkan dan diuji; Email Service mengehadkan jumlah mesej bersama lampiran
kepada 5 MiB untuk penerima biasa.

Email Service Cloudflare menggunakan binding `send_email` dan memerlukan domain
berada pada Cloudflare DNS. Semasa audit, NS masih `ns1.awedns.com` dan
`ns2.awedns.com`, MX `0 refpahang.com`, dan kedua-dua `refpahang.com` serta
`mail.refpahang.com` menunjuk `101.99.77.148`. Rekod SPF semasa mengizinkan
pelayan lama/mailsentinel; DMARC ialah `p=none`. Sebelum pertukaran DNS,
inventori DNS penuh termasuk DKIM perlu diambil. MX mesti kekal menuju pelayan
mel sedia ada melalui rekod DNS yang sesuai ketika laman web dialih; jangan
mematikan peti masuk lama. MX semasa menunjuk ke domain utama, jadi sasaran
MX perlu dipisahkan daripada hos web yang bakal diproksi sebelum cutover.

## Laluan staging hingga pertukaran domain

1. Salinan staging `hanafi51` sudah memasukkan 51 perlawanan Hanafi. Semak
   production dan ambil sandaran baharu sebelum migrasi sebenar; bandingkan
   kiraan/ID penting dengan fail gabungan ini.
2. Uji SQL yang telah ditukar pada D1 staging, kemudian lengkapkan skema dan
   pertanyaan Worker serta pengesahan setiap jadual, ID, hubungan dan transaksi.
   Jangan gunakan `refpahan_refpahang-3.sql` terus sebagai fail import D1.
3. Bina Worker API di staging dengan kontrak `/api` sedia ada. Uji login,
   peranan Admin/PP Daerah/Pengadil/RA, permohonan, lantikan tanpa konflik,
   audit, laporan, PDF, Telegram dan tugas berkala sebelum mengalihkan trafik.
4. Lengkapkan salinan media production ke R2 dan sahkan semua rujukan gambar,
   resit, logo serta lampiran. Uji lima kategori emel, templat, lampiran PDF,
   penolakan dan logging tanpa menghantar secara besar-besaran.
5. Apabila staging setara, bekukan tulis sebentar, ambil dump terkini,
   migrasikan delta, semak jumlah/ID dan jalankan ujian akhir. Sediakan laluan
   balik sebelum menukar DNS/domain. Matlamat operasi ialah `git`/IDE ->
   deploy Worker, tanpa ZIP cPanel.

Rujukan Cloudflare: [D1 import](https://developers.cloudflare.com/d1/best-practices/import-export-data/),
[had D1](https://developers.cloudflare.com/d1/platform/limits/),
[Email Service](https://developers.cloudflare.com/email-service/get-started/send-emails/),
[Workers Email API](https://developers.cloudflare.com/email-service/api/send-emails/workers-api/),
[versi Worker dan secret](https://developers.cloudflare.com/workers/wrangler/commands/workers/).
