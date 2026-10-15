# Persediaan migrasi RefPahang ke Cloudflare

Tarikh audit: 13–14 Oktober 2026. Ini ialah inventori dan alat persediaan untuk
staging. DNS kini diurus oleh Cloudflare dan rekod hos emel telah dibetulkan;
aplikasi production masih berjalan pada pelayan PHP lama. Peti masuk kekal
pada pelayan lama. Domain telah didaftarkan untuk Cloudflare Email Sending,
tetapi penghantaran emel aplikasi belum dipindahkan ke Worker.

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
D1 staging jauh**. Binding Worker kini menggunakan `refpahan_pahang_staging`
di rantau APAC; nama ini merujuk pangkalan RefPahang penuh, bukan Hanafi sahaja.
Semakan terus pada D1 jauh membandingkan setiap satu daripada 40 jadual aplikasi
dengan salinan staging terdahulu `refpahang-staging-20261013-hanafi51`: semua
kiraan sepadan, sejumlah 58,657 baris. Sebanyak 51 ID perlawanan Hanafi 2026
adalah unik. Pangkalan terdahulu dikekalkan sebagai salinan sandaran sementara
dan tidak lagi diikat kepada Worker staging.
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
`BASE_URL` staging menunjuk ke URL Worker ini supaya pautan emel ujian tidak
tersalah menuju ke aplikasi PHP production.
`STAGING_AUTH_ENABLED=0` mengunci log masuk serta media ketika port API belum
lengkap. Endpoint yang sudah dipindahkan: pengumuman awam, status pendaftaran,
persatuan awam, log masuk/sesi/log keluar, daerah, profil pengguna, tetapan
permohonan, sejarah permohonan milik sendiri, senarai permohonan Admin,
senarai/kiraan/profil pengguna khusus Admin (tanpa hash kata laluan),
semakan penyelenggaraan, dan muat turun media terhad kepada pemilik/Admin.
Staging juga mempunyai bacaan perlawanan Pengadil, senarai permohonan milik
sendiri, notifikasi, pengumuman dan tugasan lantikan. Respons perlawanan
mengekalkan had 100 rekod setiap halaman seperti API PHP; salinan setempat
Hanafi mempunyai 51 perlawanan bertarikh 2026 (71 sepanjang tahun lain).
Carian pengadil aktif untuk pemilih lantikan kini membaca D1 dengan medan dan
syarat peranan yang sama seperti API PHP; salinan data mengandungi 369 akaun
aktif yang layak. Ia masih memerlukan sesi sebelum mengembalikan data peribadi.
Penandaan notifikasi sebagai dibaca sudah dipindahkan tetapi dikunci oleh
`STAGING_WRITES_ENABLED=0`. Bacaan tugasan tidak menjalankan auto-tolak
secara sampingan. Cron Worker menyemak tempoh lantikan dengan suis berasingan
yang masih ditutup. Worker berjadual kini memproses hanya tugas penghantaran
jawapan lantikan baharu yang dihasilkan oleh Worker, apabila tiga suis berkaitan
dibuka kelak; ia tidak memproses cubaan emel/Telegram PHP lama yang diimport.
Profil serta kiraan tugas/statistik papan pemuka Admin juga membaca D1.
Kiraan permohonan menunggu menggunakan `status_workflow`, iaitu medan yang
digunakan oleh aliran permohonan dan kiraan tugas sedia ada.
Papan pemuka RA dan gambaran keseluruhan PP Daerah kini mempunyai laluan
bacaan D1; senarai pengumuman PP juga tersedia. Kiraan PP masih mengikut
persatuan/daerah pegawai, termasuk pengelompokan rekod perlawanan yang sama.
Admin yang juga RA boleh membaca papan pemuka RA miliknya sendiri.
Tindakan Admin `delete_application` turut disediakan tetapi dikunci oleh
`STAGING_WRITES_ENABLED=0` pada Worker staging. Ujian tempatan D1 mengesahkan
pemadaman permohonan melepaskan `perlawanan.permohonan_id` dahulu dalam satu
batch transaksi, dan rekod perlawanan kekal. Akaun serta rekod sintetik ujian
telah dibuang. Keputusan Admin dan keputusan ujian kini mempunyai implementasi
D1 setempat seperti dihuraikan di bawah; penghantaran emel sebenar masih perlu
disahkan. Laluan API lain
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
Ujian setempat tambahan mengesahkan 51 perlawanan Hanafi untuk 2026, pagination
100 rekod maksimum, had peranan Pengadil, penolakan akses notifikasi silang
pengguna, tugasan mengikut pemilik, serta akses Admin yang juga RA kepada
permohonan dan tugasan sendiri. Rekod ujian notifikasi dan sesi telah dibuang.
Inventori `python3 cloudflare/endpoint_coverage.py` kini mendapati 62 daripada
67 endpoint PHP sebenar yang disebut oleh frontend sudah mempunyai laluan Worker;
5 masih tiada. Kiraan ini menunjukkan route wujud, bukan kesetaraan fungsi.
Laluan jawapan portal masih dikunci oleh tiga suis staging.
Daripada enam endpoint PHP awam tambahan yang tidak dipanggil terus oleh
frontend, tiga kini mempunyai route Worker. `download-borang-futsal.php`
memerlukan sesi Pengadil/PP Daerah/Admin dan membaca hanya permohonan Futsal
yang diluluskan milik akaun itu. Borang R3 dicetak daripada HTML dengan jenis
kandungan `text/html` yang betul; endpoint PHP lama memulangkan HTML tetapi
melabelkannya `application/pdf`. Tahun diambil daripada permohonan, dan alamat
panjang mengalir mengikut kandungan. Ujian sintetik mengesahkan kawalan akses,
escaping dan cetakan; pertanyaan SQL juga diuji pada salinan D1 setempat.
Dump staging belum mempunyai permohonan Futsal yang diluluskan, jadi paparan
berjaya untuk rekod sebenar masih perlu diuji apabila rekod yang sesuai wujud.
Ini belum menghasilkan fail PDF binari secara langsung; pengguna boleh memilih
“Cetak / Simpan PDF” dalam pelayar.
Laluan `lantikan-audit.php` kini menyediakan GET khusus Admin bagi ringkasan,
pautan aktif dan 100 peristiwa audit terakhir. Tindakan POST `record_copy` kini
merekodkan salinan pautan aktif bersama snapshot lantikan dan identiti Admin
dalam D1 apabila suis tulis diaktifkan. Ia menolak pautan tidak aktif atau
jenis pautan salah. `prepare_links` juga menjana token yang belum wujud tanpa
memulakan tempoh jawapan; selepas batch D1, ia membaca semula token sebenar
dan memulangkan pautan. Token dan audit ditulis dalam batch D1 yang sama.
`mark_manual_delivery` kini merekodkan penghantaran manual dan, bagi lantikan,
memulakan tempoh jawapan sekali sahaja dalam transaksi bersama audit. Tindakan
`admin_override_acceptance` kini mengemas kini penerimaan, sejarah KUP,
audit, notifikasi portal dan tugas penghantaran dalam satu batch D1. Ia hanya
menerima penolakan automatik atau penolakan KUP yang telah disahkan tersilap,
dan disekat lagi oleh suis `APPOINTMENT_DELIVERY_ENABLED`. Audit
`prepare_links` menyimpan pautan yang terhasil daripada token sebenar dalam
transaksi tersebut.
`kejohanan-pengesah-laporan.php` pula menyediakan GET khusus Admin untuk
kejohanan, calon RA, pengerusi semasa dan audit tanpa mendedahkan ID Telegram.
POST menetapkan pengerusi masih 503 kerana aliran itu juga perlu menyediakan
token, menghantar laporan RA yang menunggu dan merekodkan notifikasi.
`lantikan.php?jadual_id=...` kini menyediakan GET khusus Admin bagi slot
perlawanan dan pengadil dalam pool kejohanan, termasuk bilangan lantikan,
wilayah, ketersediaan emel serta status Telegram tanpa membocorkan token.
Ujian pada skema D1 import dan data sintetik lulus. Tamat tempoh jawapan dan
cubaan semula notifikasi dijalankan oleh Worker berkala apabila suis berkaitan
diaktifkan; GET sendiri tidak mengubah data. POST `assign` untuk slot kosong sebelum
sepak mula kini mempunyai transaksi D1 berpagar pool, jenis RA/KUP, pertindihan
masa, laporan sedia ada dan slot serentak. Lantikan, audit dan status jadual
ditulis dalam satu batch. Migrasi `0004_admin_appointment_create.sql` menambah
penanda unik bagi menghubungkan tiga tulisan itu. Penggantian slot, tindakan
notifikasi, pembatalan, PUT dan DELETE masih 503. Kedua-dua suis auth dan tulis
staging perlu diaktifkan untuk menggunakan POST; staging sedia ada kekal tertutup.
Pautan `/penilaian-borang.html` kini disertakan dalam aset Angular staging.
`penilaian-token.php` menyediakan GET bertoken bagi RA yang telah menerima
lantikan: butiran perlawanan, KUP diterima, draf sedia ada dan kriteria asal.
Endpoint ini memerlukan suis `STAGING_AUTH_ENABLED=1`. POST draf telah
dipindahkan tetapi hanya boleh digunakan apabila kedua-dua suis auth dan
tulis staging diaktifkan. Pilihan `hantar` kekal 503 sebelum sebarang data
ditulis kerana penghantaran kepada Pengerusi belum lengkap.
`laporan-penilaian.php` menyediakan semua mod GET bagi RA berlog masuk dan Admin:
senarai sendiri, butiran, laporan per perlawanan, KUP diterima dan kriteria.
Laporan pengguna lain ditapis di SQL; token Pengerusi tidak dipulangkan dan
`approval_url` sengaja kosong sehingga halaman semakan, PDF dan tindakan sahkan
siap. POST draf berkongsi teras transaksi dengan borang bertoken; PUT
hantar/override masih 503. Ujian sintetik dan bacaan
salinan D1 mengesahkan skema, skop RA, pemisahan peranan dan lampiran pengesahan.
Migrasi `0003_assessment_drafts.sql` menambah indeks unik lantikan laporan dan
`worker_revision` untuk menolak simpanan serentak yang menggunakan versi lama.
Teras draf mengunci identiti RA dan snapshot KUP diterima pada masa batch D1,
dan menulis ibu laporan serta tiga atau empat anak dalam satu transaksi.
Ujian draf pada salinan SQLite import yang berasingan berjaya menyimpan satu
laporan RA sebenar; salinan sumber tidak diubah. Sebelum pemasangan `0003` pada
D1 staging, eksport jauh disimpan secara private di
`output/cloudflare/refpahang_staging_before_0003_20261015.sql` (diabaikan Git).
Migrasi jauh memproses dua arahan; semakan selepas itu menunjukkan 370 pengguna,
91 laporan asal, 51 perlawanan Hanafi 2026, serta satu lajur revisi dan satu
indeks unik baharu. Kesemua suis staging masih `0`.
Skema `0001` hingga `0005` dipasang melalui `wrangler d1 execute`, bukan
ledger `wrangler d1 migrations apply`. Oleh itu, `migrations list` masih
menyenaraikannya sebagai belum dilaksana walaupun skemanya wujud. Jangan
jalankan `migrations apply` secara terus pada D1 staging ini tanpa menyelaraskan
ledger atau membuat pangkalan baharu; `ALTER TABLE` berulang akan gagal.
Kriteria JSON Worker dijana daripada `config/kriteria-penilaian.php` dan perlu
dikemas kini bersama fail PHP asal jika pilihan penilaian berubah.
Empat pertanyaan GET diuji terhadap skema D1 setempat; ujian sintetik mengesahkan
sekatan peranan, skop kejohanan dan penolakan POST. Inventori turut menandakan
`admin-applications.php` sebagai separa kerana tindakan blast emel Kelas 3
masih tiada, serta tiga laluan borang/jadual yang sekarang memberi HTML boleh
dicetak tetapi belum PDF binari.
Pautan Telegram tidak dibina pada staging tanpa `TELEGRAM_BOT_USERNAME` yang
ditetapkan secara nyata. Ujian `npm run test:appointment-audit` meliputi peranan,
pautan, butiran JSON dan penguncian POST.
Rujukan dalam komen kepada `config/kriteria-penilaian.php`
dikecualikan kerana ia bukan API. Dua laluan GET laporan penilaian turut
dipindahkan: Pengadil
boleh melihat laporan yang disahkan bagi lantikan sendiri, manakala PP Daerah
boleh melihat laporan yang melibatkan pengadil dari persatuannya. Ujian tempatan
mengesahkan butiran, senarai dan penolakan akses silang peranan/daerah. Laluan
GET senarai permohonan dan pengadil PP Daerah juga telah diuji mengikut
persatuan, termasuk statistik, sejarah perlawanan dan senarai RA. Respons
profil tidak membawa `users.password` atau `tg_link_token`. Modal profil GET
juga memaparkan sejarah perlawanan dan permohonan. Ujian setempat mengesahkan
51 perlawanan Hanafi pada 2026, sementara maklumat hubungan serta nota Admin
disembunyikan daripada pengguna luar daerah yang melihat profilnya.
Cetakan `download-jadual-lantikan.php` kini menggunakan data D1 yang sama
dengan laporan jadual Admin. HTML A4 landskap memaparkan lima jawatan, status,
statistik dan kod pengesahan. Ujian Worker tempatan mengesahkan respons 200
untuk Admin, 403 tanpa sesi, 400 bagi ID tiada dan 404 bagi kejohanan tidak
wujud; PDF cetakan tiga halaman turut diperiksa secara visual. Logo dokumen
dibaca melalui media private apabila sesi Admin sah.
Laluan lama `download-borang-ujian-kecergasan.php` kini menjana R4 HTML
untuk cetak/PDF daripada permohonan D1 milik Pengadil sendiri. Musim dibaca
daripada `tahun_permohonan`; deklarasi, kotak semakan dan ruang tandatangan
dikekalkan. Ujian setempat mengesahkan 200 bagi pemilik, 404 bagi pengguna
lain, 403 bagi peranan lain dan 400 bagi ID tidak sah;
cetakan A4 dua halaman diperiksa secara visual. Ini **bukan** PDF gabungan
R1/R2/R4 atau lampiran emel pendaftaran; laluan tersebut masih perlu dialih.
Gambar profil dalam `users` boleh dibaca oleh pengguna yang log masuk, selaras
dengan modal profil umum; resit permohonan pengguna lain tetap ditolak.
Eksport CSV `download-referees-excel.php` dan `pp-export-referees.php` kini
membaca D1. Ujian setempat mengesahkan 221 pengadil dan 39 RA bagi eksport
Admin tahun 2026, 26 pengadil bagi eksport persatuan PP Daerah yang diuji,
serta penolakan peranan silang (403), sesi tiada (401), dan tahun tidak sah
(422). Nilai CSV yang boleh dibaca sebagai formula oleh aplikasi spreadsheet
diapit dengan awalan teks.
Import jadual Excel `jadual-upload.php` juga menggunakan D1: sehingga 200
baris sekali import, baris tidak sah dilaporkan, dan semua baris sah bersama
padanan logo disimpan dalam satu transaksi. Ujian setempat memasukkan 2 baris
sah dengan 1 tarikh tidak sah, kemudian 200 baris sah; nombor perlawanan yang
terjana unik dan semua 202 rekod ujian telah dibuang. Berbeza daripada PHP,
tarikh import perlu dalam format ISO `YYYY-MM-DD`; pratonton Excel Angular
sedia ada menghantar format itu. Ralat pangkalan data menggagalkan keseluruhan
transaksi dan tidak meninggalkan import separa.
Import Excel pengadil luar `pengadil-luar-upload.php` menerima sehingga 500
baris, menormalkan negeri/gred, dan memadankan pengguna berdaftar mengikut
telefon, emel lalu nama sebelum menyimpan. Akaun Admin yang mempunyai
klasifikasi RA turut dicari supaya import tidak mewujudkan semula identiti
luar pendua. Ujian setempat mengesahkan satu rekod baharu, satu baris tidak
sah, padanan emel kepada Admin RA, serta import 500 baris; kesemua 501
rekod ujian kemudian dibuang. Kegagalan D1 menggagalkan keseluruhan batch.
Tetapan Admin
GET/POST/DELETE kini menggunakan D1; mod penyelenggaraan dibaca daripada D1
apabila staging dibuka, sementara `STAGING_AUTH_ENABLED=0` terus memaksa mod
penyelenggaraan. Ujian D1 setempat mengesahkan akses Admin sahaja, validasi
sebelum batch, simpanan dan reset, serta penolakan tulis oleh
`STAGING_WRITES_ENABLED=0`. API tukar kata laluan juga sudah dipindahkan;
ujian D1 setempat mengesahkan validasi, semakan bcrypt PHP lama, hash baharu
yang boleh dibaca PHP, penolakan kata laluan lama selepas tukar, kemas kini
`password_changed` pada sesi aktif, kawalan asal permintaan dan kunci tulis
staging. Togol taraf Pengadil Admin turut menggunakan D1 dan disekat oleh
kunci tulis staging; ujian setempat mengesahkan kawalan peranan, input,
deduplikasi ID dan tiga kolum taraf yang bebas. Laluan lupa/tetap semula kata
laluan kini menggunakan token rawak yang disimpan sebagai SHA-256 dalam D1,
had tiga token aktif sejam, emel template seragam, token sekali pakai dan
penamatan sesi aktif selepas kata laluan ditukar. Ujian D1 setempat mengesahkan
token sah/tamat tempoh/diguna semula, hash serasi PHP, had permintaan,
penyamaran kewujudan akaun dan emel yang ditangkap oleh Miniflare. **Tiada
emel production dihantar atau disahkan diterima.** Kedua-dua laluan ini kekal
503 apabila staging dikunci. API kejohanan Admin kini mempunyai senarai,
butiran, cipta, kemas kini, padam dan muat naik logo raster ke R2. Ujian D1
setempat mengesahkan akses peranan, validasi tarikh, bacaan semula logo private,
padam rekod pengesahan/pool pada kejohanan kosong, serta penolakan padam jika
ada jadual perlawanan atau rekod audit. Kiraan 51 perlawanan Hanafi kekal.
Logo SVG lama masih boleh dibaca daripada R2, tetapi muat naik SVG baharu
belum dibenarkan kerana fail aktif itu perlu disanitasi sebelum disiarkan.
Pool Pengadil Admin juga menggunakan D1 untuk senarai, tambah seorang atau
berkumpulan, dan buang ahli. Ujian setempat mengesahkan deduplikasi,
identiti wujud, pembatasan peranan, penyembunyian ID Telegram, serta sekatan
pembuangan jika pegawai masih mempunyai lantikan dalam kejohanan.
Aliran profil yang dipakai frontend kini boleh menyimpan maklumat sendiri
melalui D1 dan memuat naik PNG/JPEG/WebP ke R2. Ujian setempat mengesahkan
medan wajib, emel pendua, tiada perubahan role/klasifikasi oleh Pengadil,
notifikasi, dimensi imej, akses media dengan sesi dan 51 perlawanan Hanafi.
Muat naik terus melalui multipart `update-profile.php` lama belum dipindahkan;
frontend menggunakan `upload-profile-image.php` berasingan. Fail imej yang
berjaya dimuat naik kini terus direkod pada profil pengguna.
Pada 14 Oktober, laluan jadual perlawanan, laporan lantikan, pengadil berdaftar,
perlawanan Admin/PP Daerah dan pengadil luar turut mempunyai implementasi D1
setempat. Ujian terhadap salinan D1 mengesahkan kawalan peranan, transaksi
pukal, sekatan pemadaman rekod yang masih dirujuk, dan 51 perlawanan Hanafi
kekal selepas tindakan pada rekod sintetik. Butang padam pengadil dalam UI
kini menyahaktif akaun dan mengekalkan sejarahnya. Aliran ini belum diuji dengan
log masuk pengguna sebenar pada Worker jauh kerana staging masih dikunci.
Penolakan lantikan automatik semasa membaca jadual, ciptaan semula snapshot
sejarah lantikan yang hilang, dan ujian penerimaan antara modul masih perlu
disiapkan sebelum pertukaran domain.
Pendaftaran akaun awam, keputusan Admin, keputusan PP Daerah dan pautan
Telegram sendiri turut dipindahkan. Semakan setempat menggunakan akaun dan
permohonan sintetik: kelulusan Admin untuk pengadil sesi 2027 kekal `Pending`
dengan status `Admin Diluluskan`, manakala keputusan PP Daerah hanya boleh
dibuat bagi persatuan sendiri. Penghantaran emel sebenar masih belum disahkan.
Senarai permohonan ujian Admin serta keputusan lulus, tolak dan tidak hadir
kini menggunakan D1, bersama notifikasi dalam transaksi yang sama dan templat
emel seragam. Ujian setempat mengesahkan akses Admin, senarai, keputusan sekali
sahaja dan 51 perlawanan Hanafi 2026 kekal. Emel keputusan belum dibuktikan
diterima; Worker setempat tidak mempunyai binding penghantaran emel.
Rekod perlawanan Pengadil (`pengadil-match-manage.php`) juga kini menerima
tambah berkumpulan, sunting rekod tunggal dan padam rekod sendiri melalui D1.
Penambahan bersama notifikasi PP Daerah dibuat secara atomik; emel pengesahan
menggunakan templat seragam selepas transaksi. Ujian setempat membuktikan
penambahan/pemadaman sintetik, kawalan peranan, had 14 hari, pegawai aktif,
serta sekatan ubah/padam rekod rasmi atau yang telah disahkan. Sebagai
perlindungan integriti, suntingan rekod berkumpulan perlu melalui pentadbir.
Rekod sintetik dibersihkan dan 51 perlawanan Hanafi 2026 kekal.
Statistik Admin juga kini dijana daripada D1 untuk permohonan, Pengadil
Berdaftar, ujian, perlawanan, penilaian, Telegram, lantikan dan kejohanan.
Semakan setempat bagi tahun 2026, 2027 dan tahun kosong mengesahkan bentuk
respons serta jumlah pecahan yang konsisten. Kiraan perlawanan manual kini
memadankan role `Pengadil` tanpa peka huruf besar/kecil; kod PHP lama menggunakan
`pengadil` huruf kecil sahaja. Laluan ini belum diuji pada sesi Admin sebenar
di Worker jauh kerana staging masih berkunci.

**Kiraan laluan frontend tidak merangkumi semua aliran production.** Enam
endpoint dikenal pasti di luar kod Angular: tiga pautan bertoken dalam
emel (`lantikan-jawab-token.php`, `penilaian-token.php`,
`laporan-pengesahan-token.php`), webhook Telegram, dan dua borang lama yang
boleh dibuka melalui URL terus selepas log masuk. Dua daripada enam, iaitu
R4 ujian kecergasan dan pautan jawapan lantikan emel, kini mempunyai laluan
Worker; empat lagi belum.
Tugas CLI `kup-crew-notification-retry.php` kini mempunyai pengganti berjadual
untuk **jawapan baharu Worker sahaja**; 445 rekod baris gilir PHP yang diimport
tidak dihantar semula. Kitaran auto-tolak mempunyai implementasi cron berkunci;
notifikasi lantikan awal masih perlu dipindahkan;
`telegram-poll.php` ialah alat pembangunan, bukan webhook production. Oleh itu
60/67 ialah **kehadiran laluan frontend sahaja**, bukan bukti semua kaedah
GET/POST, peranan, emel atau pautan luaran sudah setara. Jangan buka log masuk
staging atau alih domain sehingga matriks fungsi ini dan ujian integrasi selesai.

Jawapan lantikan melalui portal, pautan emel dan Telegram berkongsi perubahan
status, sejarah `perlawanan`, audit dan notifikasi kru KUP. Port Worker mesti
mengekalkan kemas kini bersyarat sekali sahaja serta transaksi D1 sebelum
ketiga-tiga saluran dibuka; menyediakan salah satu saluran secara bersendirian
akan membolehkan keputusan bercanggah atau sejarah tidak selaras.

Pada 14 Oktober, `cloudflare/src/appointment-response-core.ts` menyediakan
teras transaksi D1 untuk tiga jenis pemilik (akaun, token emel, token Telegram).
Ia menukar status secara bersyarat, merekod audit, menyelaraskan sejarah KUP
tanpa membuang markah sedia ada, menjana token RA dan memasukkan notifikasi
portal dalam satu batch atomik. Migrasi `0002_appointment_outbox.sql` menambah
acara serta tugas khusus Worker bagi setiap penerima/saluran dalam transaksi
yang sama. Tugas meliputi Telegram Admin/PP Daerah, emel/Telegram borang RA,
dan senarai krew KUP melalui emel/Telegram apabila tiga jawatan wajib telah
menerima lantikan. Tugas KUP menyimpan versi krew dan digugurkan jika krew
berubah sebelum penghantaran. Worker berjadual setiap lima minit menggunakan
lease dan sela cuba semula; saluran yang berjaya tidak dicuba semula. Seperti
mana-mana penghantaran luaran dengan pangkalan data berasingan, gangguan tepat
selepas penyedia menerima mesej tetapi sebelum status D1 disimpan masih boleh
menyebabkan satu salinan tambahan semasa retry.

Ujian `npm run test:appointment-core` di
`cloudflare/` merangkumi akses salah, pemilikan chat Telegram, klik berulang,
penerimaan, penolakan, RA, tempoh tamat dan rollback apabila notifikasi gagal.
`npm run test:appointment-delivery` menguji suis berasingan, satu tugas bagi
setiap saluran, tidak menghantar semula tugas selesai, retry, krew lama dan
perubahan daerah PP. Laluan `lantikan-jawab.php` kini memanggil teras dengan
semakan sesi, peranan, ID dan sebab penolakan. Ujian
`npm run test:appointment-reply` meliputi suis, pemilikan dan respons.
Laluan pautan emel `lantikan-jawab-token.php` kini menyediakan halaman GET
yang tidak mengubah data dan borang POST yang memanggil teras transaksi sama.
Ujian `npm run test:appointment-email-link` meliputi pautan salah, HTML
terlepas, GET tanpa perubahan, keputusan POST dan suis staging. Telegram,
borang RA, dan webhook masih perlu dipindahkan serta diuji sebelum jawapan
lantikan Worker dibuka. Daripada enam laluan awam di luar frontend, dua kini
mempunyai route dan empat masih belum. `TELEGRAM_BOT_TOKEN` mesti
disimpan sebagai Worker secret sebelum penghantaran Telegram diaktifkan.
Cron auto-tolak menggunakan `appointment-expiry.ts` dan teras transaksi yang
sama. Ia hanya memilih lantikan yang sudah dihantar notifikasinya, melepasi
tempoh 48 jam bagi Liga atau tiga jam bagi kejohanan lain, dan mempunyai
tarikh akhir sebelum sepak mula. Teras menyemak semula syarat itu ketika
menulis; jawapan serentak tidak menghasilkan audit atau sejarah pendua.
Penolakan Pegawai ke4 yang pilihan boleh melengkapkan krew tiga jawatan wajib
dan memasukkan tugas notifikasi krew. Ujian `npm run test:appointment-expiry`
menyemak suis serta penapis calon; ujian teras menyemak kes krew ini.
`STAGING_AUTH_ENABLED=0`, `STAGING_WRITES_ENABLED=0`,
`APPOINTMENT_DELIVERY_ENABLED=0` dan `APPOINTMENT_AUTO_REJECT_ENABLED=0` kekal;
tiada emel/Telegram atau rekod sebenar
diubah oleh Worker ini.

Deployment staging daripada commit `b95ade9`, versi
`7f0a7f4c-700d-4651-b607-c9257131c78d`, memasang jadual lima minit
dan migrasi `0002_appointment_outbox.sql` pada D1 jauh. Semakan selepas deploy:
health 200 dengan `api_complete:false`, POST jawapan lantikan 503, 370 pengguna,
445 baris notifikasi PHP yang diimport, sifar tugas Worker baharu, dan 51
perlawanan Hanafi 2026. Domain utama masih menggunakan LiteSpeed PHP.
Deployment susulan commit `c7e1e17`, versi
`769f507c-1499-4d0b-b629-0e537a9e777e`, menambah laluan jawapan portal
berkunci. Ujian HTTP jauh: POST 503 apabila suis ditutup, GET 405, health 200
dengan `api_complete:false`; D1 kekal 370 pengguna, sifar tugas baharu dan 51
perlawanan Hanafi 2026. Build dibuat daripada worktree bersih.
Deployment commit `e9c2b6b`, versi
`126d5579-0caf-4095-9b22-2a5e9fb84e49`, menambah halaman pengesahan emel
yang GET-nya tidak mengubah data. Selepas propagasi staging, GET menjawab 503
teks biasa kerana suis masih ditutup. Kesihatan 200 dengan
`api_complete:false`; D1 masih 370 pengguna, 445 baris baris gilir PHP lama,
sifar tugas Worker dan 51 perlawanan Hanafi 2026. Domain utama masih PHP
LiteSpeed. Cron auto-tolak baharu masih belum diaktifkan.
Commit `29e4e0f` menambah cron auto-tolak dengan suis keempat yang kekal `0`.
Deployment staging versi `ee0d6a1e-2121-4788-a252-f16f5462a362` lulus
typecheck dan binaan Angular; build masih memberi amaran bajet awal 11.42 KB.
Selepas deploy, health 200 (`api_complete:false`), POST jawapan 503, dan GET
pautan emel 503. Bacaan D1 jauh masih 370 pengguna, 445 baris gilir PHP lama,
sifar tugas Worker dan 51 perlawanan Hanafi 2026.
Commit `9fe0c20` menambah GET log lantikan Admin. Deployment staging versi
`d4cf0325-b554-4f57-b10f-36930b7690a5` lulus typecheck dan binaan
Angular. GET dan POST tanpa sesi akhirnya menjawab 401 selepas propagasi;
GET awal pada satu lokasi masih menjawab 503 versi lama sebelum propagasi
selesai. SQL skema bacaan disahkan pada D1 jauh tanpa memulangkan data.
D1 kekal 370 pengguna, sifar tugas Worker dan 51 perlawanan Hanafi 2026.
Empat suis staging masih `0`; domain utama masih PHP LiteSpeed.

Commit `440a9f8` menambah cetakan borang Futsal R3. Deployment staging versi
`4f6df13f-cbd3-4cf9-9a0c-c45aeeb7ea80` lulus typecheck dan binaan
Angular. GET R3 tanpa sesi menjawab 403 dengan `text/html` dan `no-store`;
`/api/__migration-health` menjawab 200 dengan `api_complete:false`.
D1 jauh kekal 370 pengguna, sifar tugas Worker dan 51 perlawanan Hanafi 2026.
Empat suis staging masih `0`; domain utama masih PHP LiteSpeed.
Commit `5ac8d67` menambah bacaan konfigurasi Pengerusi khusus Admin. Deployment
staging versi `1612ab89-a7f9-48e0-95c9-dcce3d4ed19d` lulus typecheck dan
binaan Angular. GET dan POST tanpa sesi menjawab 401, manakala POST dengan
sesi Admin masih 503 mengikut ujian sintetik. Health kekal 200 dengan
`api_complete:false`; D1 jauh kekal 370 pengguna, tiga pemetaan Pengerusi,
sifar tugas Worker dan 51 perlawanan Hanafi 2026. Empat suis staging masih `0`.
Commit `13125bf` menambah tindakan Admin `record_copy` dalam audit lantikan.
Deployment staging versi `b7c5ce52-c8c6-4e5f-befc-e97278904b85` lulus
typecheck dan binaan Angular. SQL baca serta INSERT audit disahkan pada
salinan D1 setempat dalam transaksi yang dibatalkan selepas ujian. GET dan
POST tanpa sesi di Worker staging menjawab 401; suis tulis staging masih `0`,
jadi tiada log baharu daripada ujian HTTP. Health kekal 200 dengan
`api_complete:false`; D1 jauh masih 370 pengguna dan 51 perlawanan Hanafi
2026. Domain production masih PHP LiteSpeed.
Commit `07f6fa9` menambah `prepare_links` dalam audit lantikan. Deployment
staging versi `cc382436-0946-43d0-b0c6-56f3cb8ef539` lulus typecheck dan
binaan Angular. SQL kemas kini token dan INSERT audit diuji pada salinan D1
setempat dengan rollback. POST tanpa sesi di staging menjawab 401, health
menjawab 200 dengan `api_complete:false`, dan D1 jauh masih 370 pengguna
serta 51 perlawanan Hanafi 2026. Suis tulis kekal `0`.
Commit `415b620` menyatukan token dan audit `prepare_links` dalam satu batch
D1 dan menambah `mark_manual_delivery`. Ujian SQLite mengekalkan tempoh jawapan
daripada dimulakan dua kali. Deployment staging versi
`986767a4-19b4-4284-9719-f01ae9e5cd9e` lulus binaan Angular; GET/POST audit
tanpa sesi menjawab 401 dan health masih `api_complete:false`. D1 jauh kekal
370 pengguna dan 51 perlawanan Hanafi 2026. Empat suis staging masih `0`.
Commit `26d1163` menambah override penerimaan lantikan oleh Admin. Ujian SQLite
meliputi penolakan manual KUP, penolakan automatik, RA, audit, sejarah,
notifikasi dan rollback. Deployment staging versi
`abb12017-c417-49bb-b87c-d97768cc5d58` lulus binaan Angular. Health jauh
200, POST override tanpa sesi 401; D1 jauh masih 370 pengguna, 51 perlawanan
Hanafi 2026 dan sifar tugas penghantaran Worker. Empat suis staging kekal `0`,
dan domain production masih PHP LiteSpeed.

Commit `bd00cc3` menambah aset borang RA, GET bertoken dan GET laporan RA
berlog masuk. Ujian sintetik serta bacaan salinan D1 lulus; kriteria Worker
sepadan dengan PHP. Deployment staging versi
`5758e609-00e2-4d35-95cd-ef16b05d81de` dibina daripada worktree bersih.
Pautan `/penilaian-borang.html` mengalihkan ke URL kanonik tanpa `.html` dan
memulangkan HTML borang (200); kesihatan API 200 dengan `api_complete:false`.
GET laporan tanpa sesi 401, GET token RA 503 kerana suis auth `0`. D1 jauh
kekal 370 pengguna, 51 perlawanan Hanafi 2026 dan sifar tugas penghantaran
Worker. Domain production masih PHP LiteSpeed. Kesemua empat suis staging
kekal `0`; emel dan tulis laporan tidak diuji pada persekitaran jauh.
Commit `788b376` menambah draf RA atomik melalui sesi atau token. Migrasi
`0003_assessment_drafts.sql` telah dipasang pada D1 staging selepas eksport
sandaran. Deployment staging versi `07e9fbc6-21bf-4d81-894b-359cfcbc7059`
dibina daripada worktree bersih. Selepas propagasi, kedua-dua POST draf
memulangkan 503 seperti suis tulis `0`; health masih `api_complete:false`.
D1 jauh mengekalkan 370 pengguna, 91 laporan asal, 51 perlawanan Hanafi 2026
dan sifar draf Worker. Tiada penghantaran emel, tindakan Pengerusi atau
pertukaran domain production dilakukan.
Commit `a492da4` menambah GET `lantikan.php` khusus Admin dan mengemas kini
inventori kepada 63/67 laluan frontend berroute, dengan 9 laluan separa.
Deployment staging versi `b50f0398-afac-4f59-acce-244d360d3a8d` dibina
daripada worktree bersih. GET lantikan tanpa sesi memulangkan 401; health
memulangkan 200 dengan `api_complete:false`. Semakan D1 jauh menunjukkan
370 pengguna, 91 laporan RA dan 51 perlawanan Hanafi 2026. Empat suis staging
kekal `0`; domain production masih melalui LiteSpeed.

Commit `84ddb58` menambah POST `assign` untuk slot kosong sebelum sepak mula.
Ujian sintetik meliputi peranan, pool, jenis RA/KUP, pertindihan masa, laporan
sedia ada, audit, status jadual dan sisipan slot serentak. Migrasi `0004` lulus
pada salinan SQLite import (997 lantikan, `integrity_check=ok`), kemudian
dipasang pada D1 staging selepas eksport sandaran peribadi
`output/cloudflare/refpahang_staging_before_0004_20261015.sql`. Deploy daripada
worktree bersih menghasilkan versi `f4d7b862-861e-4410-ad26-31686ae97e51`.
Health jauh 200 dengan `api_complete:false`; POST tanpa sesi 401. Semakan
selepas deploy: 997 lantikan, 4183 audit, sifar lantikan Worker baharu,
370 pengguna dan 51 perlawanan Hanafi 2026. Empat suis staging kekal `0`;
domain production masih PHP LiteSpeed. Lantikan tulis jauh belum diuji kerana
suis auth/tulis staging sengaja tertutup.

Semakan tambahan pada salinan skema import menemui `tg_notif_hantar NOT NULL`
yang tiada dalam fixture sintetik asal. Commit pembetulan `72411a9` menetapkan
nilai awal `0` dan mengukuhkan fixture. Sisipan lantikan, audit dan status
jadual kini lulus pada salinan D1 import sebenar yang diasingkan. Versi staging
terkini `42ce0249-240c-4617-9e47-a7aad46422b4` memulangkan health 200,
POST tanpa sesi 401; D1 jauh masih 997 lantikan, sifar lantikan Worker dan
51 perlawanan Hanafi 2026. Empat suis staging masih `0`.

GET `admin-telegram-blast.php` kini memulangkan jumlah akaun aktif yang ada
emel serta bilangan Telegram terpaut. GET `pengadil-luar-telegram-blast.php`
memulangkan kejohanan, pengadil luar dalam pool, status onboarding, kiraan
layak dihantar dan sepuluh batch terbaru. Kedua-duanya khusus Admin, tidak
mengubah lantikan atau menghantar emel. Ujian pada salinan D1 import menyemak
peranan, kiraan sebenar, bentuk respons dan POST yang masih 503. Inventori
laluan frontend kini 65/67 berroute; kedua-dua laluan blast masih separa
sehingga penghantaran, cuba semula dan log berjaya dipindahkan.
Commit `286f141` telah dipush dan dideploy ke staging versi
`31852497-d7f0-44bd-9ee4-baab8efcf242` daripada worktree bersih.
GET kedua-dua laluan tanpa sesi memulangkan 401, health 200 dengan
`api_complete:false`. D1 jauh kekal 997 lantikan, sifar lantikan Worker dan
51 perlawanan Hanafi 2026. Empat suis staging masih `0`.

`download-laporan-penilaian.php` kini menyediakan HTML A4 bercetak dengan
markah, butiran pegawai dan ulasan melalui tiga mod asal: sesi berperanan,
token bacaan KUP dan token semakan Pengerusi. Semakan pemilik RA, ahli KUP
perlawanan yang sama serta skop PP Daerah diuji pada salinan D1 import.
Token bacaan HMAC diuji terhadap format PHP. Contoh sintetik dengan nama dan
ulasan panjang dirender melalui Chrome kepada lima halaman A4 tanpa halaman
kosong; logo dan susun atur rasmi masih perlu dibandingkan secara visual
dengan hasil PHP. Laluan frontend kini 66/67 berroute, tetapi laluan ini masih
dikira separa sehingga semakan itu selesai.
`laporan-pengesahan-token.php` kini mempunyai GET baca sahaja bagi Pengerusi,
termasuk pautan semakan laporan penuh. POST pengesahan kekal 503 dan tiada
butang sahkan sehingga transaksi pengesahan, audit serta notifikasi kepada
pegawai dipindahkan. Ujian token sah/salah, status menunggu/sudah diproses
dan POST tanpa mutasi lulus pada salinan D1 import. Laluan awam kini 5/6
berroute; endpoint Pengerusi ini masih separa.
Commit `81365ad` telah dipush dan dideploy ke staging versi
`bcee9e2e-9fa2-4bcc-9168-a2fdf320c519` daripada worktree bersih.
Health jauh 200 dengan `api_complete:false`; kedua-dua laluan cetakan dan
pautan Pengerusi memulangkan 503 kerana suis auth staging masih `0`.
Semakan D1 jauh mengekalkan 91 laporan RA, 997 lantikan dan 51 perlawanan
Hanafi 2026. Domain production masih PHP LiteSpeed. Tiada pengesahan laporan
atau penghantaran emel dilakukan.

Aliran POST Pengerusi seterusnya dibina di Worker bersama migrasi
`0005_report_confirmation_outbox.sql`. Token perlu sepadan dengan laporan
`Dihantar`; KUP yang dinilai mesti 3 atau 4, berbeza jawatan, diterima dan
berada pada perlawanan yang sama. Batch D1 mengubah status pengesahan,
laporan dan perlawanan, mencatat audit, memastikan token paparan RA wujud,
dan memasukkan satu tugasan emel serta Telegram bagi setiap KUP. Semakan
integriti terakhir menggunakan kekangan `CHECK` untuk menggugurkan seluruh
batch jika salah satu komponen gagal. Giliran Worker memproses tugasan dengan
claim, cubaan semula, templat emel seragam, pautan HMAC baca sahaja dan audit
penghantaran. Ujian salinan D1 import meliputi pengesahan sekali sahaja,
rekod KUP tidak lengkap, semua tugasan penghantaran, token HMAC dan kegagalan
penyedia emel. Suis baharu `REPORT_DELIVERY_ENABLED` kekal `0` di staging;
POST dan giliran hanya boleh berjalan jika suis ini, auth dan writes semuanya
`1`. Penghantaran RA kepada Pengerusi dan override Admin masih belum dipindah,
jadi ini belum melengkapkan aliran laporan hujung ke hujung.
Sebelum migrasi skema `0005` pada D1 staging, eksport jauh disimpan secara
private di `output/cloudflare/refpahang_staging_before_0005_20261015.sql`.
Migrasi jauh selesai dengan tiga arahan; semakan selepasnya menunjukkan
370 pengguna, 997 lantikan, 91 laporan RA, sifar pengesahan/penghantaran
Worker baharu dan **51** rekod `perlawanan` Hanafi bagi 2026. Dump sandaran
dan data peribadi tidak dimasukkan ke Git.
Commit `e906fea` dipush dan dideploy daripada worktree bersih ke staging versi
`a5b29bef-663b-4265-ae7a-48e9372648fe`. Build frontend berjaya dengan
amaran bajet awal 511.80 kB berbanding 500 kB. Health jauh 200 dengan
`api_complete:false`; GET/POST Pengerusi masing-masing 503 kerana auth,
writes dan `REPORT_DELIVERY_ENABLED` masih `0`. Semakan D1 selepas deploy
mendapati 91 laporan, sifar pengesahan/penghantaran Worker dan 51 perlawanan
Hanafi 2026. Tiada emel/Telegram dihantar atau laporan disahkan di staging.

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
Pada 14 Oktober, `refpahang.com` telah diaktifkan untuk **Cloudflare Email
Sending**. Rekod SPF, DKIM dan MX khusus `cf-bounce.refpahang.com` telah
ditambah dan dashboard menunjukkan status Enabled/Configured. Worker staging
mempunyai binding `EMAIL` yang hanya membenarkan lima alamat penghantar dalam
jadual di atas. Akaun Cloudflare sudah melanggan Workers Paid; dashboard
menunjukkan had harian semasa 200 emel. Periksa had semasa sebelum menghantar
emel secara besar-besaran.

Rekod `MX @ -> mail.refpahang.com`, SPF akar dan DMARC akar `p=none` kekal
seperti sebelumnya selepas pengaktifan. Pratonton onboarding mencadangkan
`p=reject`, tetapi rekod sedia ada **tidak ditukar**; `dig` selepas pengaktifan
mengesahkan hanya satu DMARC akar `p=none`. Jangan aktifkan Email Routing kerana
ia akan menukar MX peti masuk. Cloudflare Email Sending hanya mengendalikan
emel keluar dan bounce pada subdomainnya sendiri.

`cloudflare/mail.ts` menyediakan pemetaan kelima-lima penghantar untuk API
Email Service serta lampiran dan imej inline. Endpoint lupa kata laluan kini
menggunakannya bersama template seragam dan pautan daripada `BASE_URL`.
Kedua-dua suis staging kekal `0`, jadi endpoint ini menjawab 503 dan belum
menghantar emel sebenar. Menyimpan tetapan dan binding pada Worker belum
mengalihkan peti masuk atau sejarah emel. Templat untuk aliran emel lain masih
perlu dipindahkan dan diuji; Email Service
mengehadkan jumlah mesej bersama lampiran kepada 5 MiB untuk penerima biasa.
Tiada emel sebenar dihantar semasa persediaan ini.

Email Service Cloudflare menggunakan binding `send_email` dan memerlukan domain
berada pada Cloudflare DNS. Pada 13 Oktober, NS aktif ialah
`odin.ns.cloudflare.com` dan `raegan.ns.cloudflare.com`. Import DNS asal
menjadikan `mail.refpahang.com` CNAME yang diproksi ke domain utama;
sambungan SMTP ke port 465 melalui nama hos itu gagal. Rekod tersebut telah
ditukar kepada `A mail -> 101.99.77.148` dengan status **DNS only**, dan
`MX @ -> mail.refpahang.com` (keutamaan 0). Kedua-dua nameserver autoritatif
dan resolver 1.1.1.1/8.8.8.8 mengembalikan sasaran MX baharu. Sambungan SMTP
465 serta pengesahan TLS untuk `mail.refpahang.com` berjaya. Login webmail
melalui port 2096 juga mengembalikan halaman `Webmail Login`.

Eksport zon sebelum dan selepas pembetulan disimpan secara private di
`output/cloudflare/refpahang_dns_before_mail_fix_2026-10-13.txt` dan
`output/cloudflare/refpahang_dns_after_mail_fix_2026-10-13.txt` (diabaikan
Git). Perbezaannya hanya perubahan hos `mail`, sasaran MX, dan metadata
eksport/SOA. Rekod SPF, DKIM dan DMARC kekal seperti sebelum ini. Ujian
sambungan dan DNS tidak membuktikan penghantaran serta penerimaan mesej
sebenar; ujian mesej terkawal diperlukan sebelum cutover aplikasi.

`https://refpahang.com` masih memulangkan laman PHP lama melalui proksi
Cloudflare (`x-turbo-charged-by: LiteSpeed`). Endpoint Worker
`/api/__migration-health` memulangkan 404 pada domain production tetapi 200
pada URL staging. Pemindahan nameserver **tidak** memasang route atau custom
domain Worker pada laman production. Jangan route trafik production ke Worker
staging yang masih mempunyai 5 endpoint frontend tanpa route dan beberapa
route separa yang belum selesai.

Deployment staging 14 Oktober daripada commit `edbc69a`, versi Worker
`437e71ab-2360-420c-80cf-58069c2bd9b1`, disahkan pada URL staging:
`/api/__migration-health` masih 200 dengan `api_complete:false`, laluan cetak
jadual menolak pengguna tanpa sesi (403), dan D1 jauh masih mempunyai 370
pengguna serta 51 perlawanan Hanafi 2026. Domain production masih memulangkan
pengepala LiteSpeed. Kedua-dua flag staging kekal `0`; tiada emel atau perubahan
data production dijalankan dalam deployment ini.
Deployment susulan daripada commit `a1c8dd3`, versi
`ee76e304-f0e5-4185-8a80-a78cf5dfa3c6`, menambah laluan R4 lama.
Semakan jauh mengesahkan 403 tanpa sesi, `api_complete:false`, 370 pengguna
dan 51 perlawanan Hanafi 2026. Domain production masih melalui LiteSpeed;
kedua-dua flag staging kekal `0`.
Deployment 14 Oktober daripada commit `80cc447`, versi
`d0520b3e-eb7d-40f9-b1ea-c5adf22f2519`, dibina daripada worktree bersih.
Ini membawa teras transaksi jawapan lantikan yang belum disambungkan ke HTTP.
Semakan jauh menunjukkan kesihatan staging 200 dengan `api_complete:false`,
POST `lantikan-jawab.php` masih 503, D1 jauh masih 370 pengguna dan 51
perlawanan Hanafi 2026, serta domain production masih melalui LiteSpeed.
`STAGING_AUTH_ENABLED=0` dan `STAGING_WRITES_ENABLED=0` kekal.

## Laluan staging hingga pertukaran domain

1. D1 staging `refpahan_pahang_staging` sudah memasukkan 51 perlawanan Hanafi. Semak
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
   balik sebelum menghalakan domain ke Worker. Matlamat operasi ialah `git`/IDE ->
   deploy Worker, tanpa ZIP cPanel.

Rujukan Cloudflare: [D1 import](https://developers.cloudflare.com/d1/best-practices/import-export-data/),
[transaksi batch D1](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch),
[had D1](https://developers.cloudflare.com/d1/platform/limits/),
[Email Service](https://developers.cloudflare.com/email-service/get-started/send-emails/),
[Workers Email API](https://developers.cloudflare.com/email-service/api/send-emails/workers-api/),
[versi Worker dan secret](https://developers.cloudflare.com/workers/wrangler/commands/workers/).
