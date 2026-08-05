# Changelog — Sistem Pengurusan Pengadil PBNP

Semua perubahan penting sejak **11 Julai 2026**.

---

## [5–6 Ogos 2026]

### 1. Menu Notifikasi Lantikan & Pasukan Pegawai Perlawanan

- Menu khusus **Notifikasi Lantikan** ditambah pada sidebar dan pautan pantas Dashboard Pengadil (`/pengadil/notifikasi-lantikan`). Laluan lama `/pengadil/tugasan` kekal berfungsi.
- Pengadil kini boleh melihat nama dan jawatan semua pegawai yang dilantik untuk perlawanan sama, termasuk Pengadil, Penolong Pengadil, Pegawai Keempat, dan Penilai.
- Paparan notifikasi kini mempunyai penapis serta kiraan untuk **Belum Jawab, Diterima, Ditolak, Dibatalkan,** dan **Ditangguhkan**.
- Maklumat rakan bertugas hanya memaparkan nama dan jawatan; nombor telefon serta maklumat peribadi tidak didedahkan.

**Fail:** `api/tugasan.php`, `frontend/src/app/app.routes.ts`, `frontend/src/app/shared/components/sidebar/nav-items.ts`, `frontend/src/app/features/pengadil/dashboard/`, `frontend/src/app/features/pengadil/tugasan/`

---

### 2. Pembatalan / Penangguhan Perlawanan Dengan Sebab & Rekod Kekal

**Masalah:** Membatalkan lantikan memadam rekod `lantikan_pengadil`, menyebabkan pengadil yang telah menerima tugasan tidak lagi melihat rekod itu dalam dashboard.

**Perubahan:**
- Admin kini boleh memilih **Batalkan** atau **Tangguhkan** perlawanan, secara individu atau pukal, dan wajib mengisi sebab (maksimum 500 aksara).
- Lantikan tidak lagi dipadam. Ia disimpan sebagai status `Dibatalkan` atau `Ditangguhkan`, bersama sebab dan masa kemaskini, untuk rekod dashboard dan audit.
- Status serta sebab yang sama turut direkod pada `jadual_perlawanan`.
- Semua pegawai dilantik menerima makluman melalui notifikasi portal, Telegram, dan e-mel. Mesej serta e-mel membezakan pembatalan daripada penangguhan dan memaparkan sebab admin.

**Fail:** `api/lantikan.php`, `config/email.php`, `config/telegram.php`, `frontend/src/app/features/admin/lantikan-pengadil/`, `docs/migration_status_perlawanan_lantikan.sql`

---

### 3. Laporan Penilaian RA Untuk Seluruh Pasukan KUP

- Setiap ahli KUP yang dilantik dalam perlawanan kini boleh melihat laporan penilaian RA penuh untuk semua pegawai dalam pasukan tersebut, dengan penanda jelas untuk penilaian sendiri.
- Kawalan akses server dikuatkuasakan: hanya ahli KUP yang tersenarai dalam laporan boleh melihat atau memuat turun laporan; pengadil daripada lantikan lain ditolak.
- Fail cetakan/muat turun laporan diperkemas dengan skala markah berwarna, tajuk jadual yang lebih jelas, dan nota tahap kesukaran.

**Fail:** `api/pengadil-penilaian.php`, `api/download-laporan-penilaian.php`, `frontend/src/app/features/pengadil/penilaian/`

---

### 4. Ketahanan Jawapan Lantikan & Rekod Auto-Tolak

- Jawapan melalui pautan e-mel kini tidak gagal hanya kerana notifikasi sampingan kepada admin, portal, atau PP Daerah mengalami ralat; jawapan lantikan kekal disimpan.
- Terima/tolak melalui pautan e-mel kini menghantar makluman kepada Admin, PP Daerah, dan portal pengadil secara setara dengan jawapan dari dashboard.
- Lantikan yang ditolak automatik direkod dengan tarikh jawapan pada deadline sebenar, untuk audit yang lebih tepat.

**Fail:** `api/lantikan-jawab-token.php`, `config/lantikan-helper.php`

---

## [12–13 Julai 2026]

### 1. Peraturan Lantikan: 48 Jam Selepas Notifikasi + Auto-Tolak

**Masalah:** Emel/Telegram menyatakan pengadil mesti jawab "48 jam **sebelum perlawanan bermula**" dan lantikan akan "**diterima** secara automatik". Peraturan itu salah, dan janji auto-terima itu **tidak wujud langsung dalam kod** — tiada cron atau logik yang menukar status.

**Perubahan:**
- Tempoh jawapan kini dikira dari **masa notifikasi dihantar** (`tarikh_notif + N jam`), bukan dari masa perlawanan. Liga = 48 jam, jenis lain = 3 jam.
- Lantikan yang **tidak dijawab dalam tempoh** kini **DITOLAK secara automatik** (bukan diterima). Dikuatkuasakan secara *lazy* — tiada cron server diperlukan; sweep berjalan bila mana-mana API berkaitan disentuh.
- Kuatkuasa di semua 4 saluran jawapan: pautan emel, dashboard, butang Telegram (webhook & poll).
- Teks dikemaskini di emel, Telegram, skrin Tugasan pengadil, dan kapsyen admin.

**Fail:** `config/lantikan-helper.php` (`calcDeadlineFromNotif()`, `autoTolakLantikanTertunggak()`), `config/email.php`, `config/telegram.php`, `api/lantikan.php`, `api/lantikan-jawab.php`, `api/lantikan-jawab-token.php`, `api/telegram-webhook.php`, `api/telegram-poll.php`, `api/tugasan.php`, `api/jadual-lantikan-report.php`, `api/jadual-perlawanan.php`, komponen `pengadil/tugasan`, `admin/lantikan-pengadil`

---

### 2. Fix: Pautan Emel Mati Walaupun Belum Dijawab

**Masalah:** Pengadil klik pautan Terima/Tolak → "Pautan Sudah Tamat Tempoh", walaupun mereka belum ambil sebarang tindakan.

**Punca sebenar:** Tiada expiry berasaskan masa langsung dalam sistem. Setiap kali admin klik "Hantar Notifikasi" **semula**, token baharu dijana dan token lama ditulis ganti — pautan dalam emel pertama terus mati.

**Perubahan:**
- **Token diguna semula** pada hantar semula — pautan lama kekal sah selagi belum dijawab.
- Halaman ralat dibetulkan: token tak dijumpai → "Pautan Tidak Sah" (bukan "tamat tempoh"); tempoh benar-benar tamat → halaman baharu "⏰ Tempoh Menjawab Telah Tamat" yang papar deadline sebenar. Kedua-duanya ada butang ke dashboard.
- **Fix keselamatan:** bila admin ganti pengadil pada slot yang sama, token lama kini dikosongkan — sebelum ini pengadil lama masih boleh jawab lantikan pengadil baharu melalui pautan emel lamanya.

---

### 3. Modal Profil Pengadil/RA Global

Modal profil penuh yang boleh dibuka dari **mana-mana** nama pengadil/RA dalam sistem.

- **3 tab:** Maklumat (statistik tugasan, kelayakan, ujian kecergasan, maklumat peribadi, alamat, pekerjaan, waris) · Permohonan (sejarah penuh) · Perlawanan (sejarah penuh)
- **Nama boleh diklik** di: Lantikan Pengadil, Pengadil/RA Berdaftar, Pengguna, Statistik, Match Oversight, Penilaian (Penilai & PP Daerah), senarai PP Daerah
- Maklumat sensitif (IC, kontak, alamat, majikan, waris) hanya didedah kepada **Admin & PP Daerah**
- Tema cerah; dioptimumkan untuk mobile (jadual → kad pada telefon)

**Fail baharu:** `api/profil-pengadil.php`, `frontend/src/app/core/services/profile-modal.service.ts`, `frontend/src/app/shared/components/profil-pengadil-modal/`

---

### 4. Kemaskini Profil Dari Modal (Admin & PP Daerah)

- Butang **✎ Kemaskini** dalam modal profil dengan borang bertab: **Peribadi · Alamat · Pekerjaan · Waris · Kelayakan**
- **Admin** — boleh kemaskini semua pengadil (termasuk Persatuan PBD & status akaun)
- **PP Daerah** — hanya pengadil di bawah pentadbiran daerah mereka (dikuatkuasa di server, bukan hanya UI)
- Whitelist field; permintaan luar skop ditolak dengan 403

---

### 5. Taraf Pengadil (Kebangsaan / Negeri / Daerah)

- Kolum baharu `pengadil_kebangsaan`, `pengadil_negeri`, `pengadil_daerah` — **boleh aktif serentak**
- **Badge** dipaparkan dalam modal profil & senarai Pengadil Berdaftar
- **Toggle individu** dalam modal profil (Admin sahaja)
- **Toggle batch** di halaman Pengadil Berdaftar: pilih beberapa pengadil (checkbox) → Tetapkan/Buang taraf sekali gus
- Backfill automatik dari label `jenis_pengadil` sedia ada

**Fail baharu:** `api/pengadil-taraf.php`

---

### 6. Tahun Kelas 3 FAM Dalam Profil

- Kolum baharu `tahun_mohon_kelas3`, `tahun_lulus_kelas3`
- **Auto-isi:** hantar permohonan `kelas3_fam` → tahun mohon terisi; admin tetapkan keputusan **Lulus** → tahun lulus terisi. Keputusan dibetulkan dari Lulus → tahun lulus dikosongkan semula
- **Fix (13 Jul):** tahun kini diambil dari **tarikh permohonan dihantar sebenar**, bukan dari tetapan `application_year` (yang ditetapkan 2027 dan menyebabkan profil papar tahun hadapan)
- Sejarah permohonan kini papar **tarikh penuh** (bukan tahun sahaja) — banyak permohonan dalam tahun sama kini boleh dibezakan

---

### 7. Ujian Kecergasan Tahunan Dalam Profil

- Seksyen baharu dalam tab Maklumat: badge keputusan setiap tahun (Lulus / Tidak Lulus / Tidak Hadir / Belum Diproses)
- Nota rujukan: lulus = layak patch Pengadil Negeri

---

### 8. Analisis: Pecahan Tugasan & Perlawanan Mengikut Daerah

**Masalah:** Jumlah tugasan dicampur seluruh negeri Pahang — tiada perincian daerah.

**Perubahan:** Dua akordion baharu dalam Statistik:
- **Tab Lantikan** — pecahan tugasan ikut daerah → pengadil dalam daerah (jumlah/diterima/ditolak/belum jawab). Pengadil luar dikumpul berasingan
- **Tab Perlawanan** — pecahan perlawanan **didaftarkan** ikut daerah → pengadil dalam daerah (jumlah + disahkan)
- Nama pengadil dalam pecahan boleh diklik → modal profil

**Fail:** `api/statistics.php`, `frontend/src/app/features/admin/statistics/`

---

### 9. Logo Pasukan Auto-Match Mengikut Nama

**Masalah:** Logo perlu di-upload untuk **setiap perlawanan** — walaupun pasukan yang sama.

**Perubahan:**
- Jadual registri baharu **`pasukan_logo`** (nama pasukan → logo)
- **Upload sekali** → logo terus dipadankan ke **semua** perlawanan (kolum home & away) dengan nama pasukan sama
- Perlawanan baharu (tambah manual, edit nama, atau import Excel) **auto-dapat logo** dari registri
- Padanan tidak sensitif huruf besar/kecil; fail logo lama hanya dipadam bila tiada lagi rujukan

**Fail baharu:** `config/pasukan-logo-helper.php`

---

### 10. Fix: Masalah Token Telegram

**Penemuan:** **Tiada expiry berasaskan masa langsung** pada mana-mana token Telegram — tiada kolum tarikh luput, tiada semakan masa. Semua mesej "tamat tempoh" adalah salah label.

**Perubahan:**
- Pengadil yang **sudah terhubung** klik pautan `/start` lama → kini dapat *"✅ Akaun anda sudah dihubungkan"* (dulu: "Pautan tidak sah atau sudah tamat tempoh" — punca utama aduan pengguna)
- Token tak dijumpai & chat belum terhubung → mesej jujur: *"Pautan Pendaftaran Tidak Aktif — kemungkinan telah digunakan atau digantikan"*
- Butang Terima/Tolak pada notifikasi lapuk → mesej jelas + butang dibuang dari mesej
- **Blast reset password** tidak lagi menulis ganti `tg_link_token` — pautan `/start` dalam emel lama kekal berfungsi

---

### 11. Optimisasi Paparan Mobile

- **Modal profil:** hampir skrin penuh pada telefon; kad statistik 3 kolum; tab Permohonan & Perlawanan jadi **kad** (tiada skrol tepi); input borang bersaiz sentuh; butang Simpan/Batal lebar penuh
- **Statistik:** senarai pengadil dalam akordion daerah jadi kad pada mobile dengan kiraan ringkas
- **Pengadil Berdaftar:** checkbox batch & badge taraf pada kad mobile; bar tindakan batch **melekat di bawah skrin**

---

## Migrasi Pangkalan Data

Jalankan mengikut turutan:

| Fail | Tujuan | Status |
|---|---|---|
| `docs/migration_profil_taraf_pasukan_logo.sql` | Kolum tahun Kelas 3 + taraf pengadil + jadual `pasukan_logo` (termasuk backfill) | ✅ Sudah dijalankan |
| `docs/fix_tahun_kelas3_ikut_tarikh_hantar.sql` | Betulkan tahun Kelas 3 supaya ikut tarikh hantar sebenar | ⚠️ Perlu dijalankan |
| `docs/migration_status_perlawanan_lantikan.sql` | Status pembatalan/penangguhan + sebab bagi `lantikan_pengadil` dan `jadual_perlawanan` | ⚠️ Perlu dijalankan sebelum deploy |

Versi PHP CLI setara juga tersedia: `docs/migration_profil_taraf_pasukan_logo.php`.

---

## Nota Penting

1. **Tetapan `application_year` = 2027** — semak di Admin → Tetapan. Selagi ia 2027, permohonan baharu akan dicap tahun 2027 dalam DB walaupun dihantar pada 2026.
2. **Lantikan lama yang tergantung** — mana-mana lantikan `Belum Jawab` yang dinotifikasi lebih 48/3 jam lalu akan bertukar `Ditolak` pada sweep pertama selepas deploy. Untuk membuka semula: lantik semula pengadil + hantar notifikasi baharu.
3. **Mesej Telegram lama tidak berubah** — Telegram tidak boleh mengedit mesej yang sudah dihantar. Notifikasi baharu sahaja akan guna teks peraturan yang betul.
