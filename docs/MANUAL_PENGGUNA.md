# 📘 MANUAL PENGGUNA KOMPREHENSIF
## Sistem Pengurusan Pengadil Bola Sepak Pahang (RefPahang)
### Persatuan Bola Sepak Negeri Pahang (PBNP)

**Versi:** 3.0 | **Tarikh Kemaskini:** 5 April 2026

---

## KANDUNGAN

- [BAB 1: Pengenalan Sistem](#bab-1-pengenalan-sistem)
- [BAB 2: Panduan Umum (Semua Pengguna)](#bab-2-panduan-umum-semua-pengguna)
- [BAB 3: Manual Pengadil](#bab-3-manual-pengadil)
- [BAB 4: Manual PP Daerah](#bab-4-manual-pp-daerah)
- [BAB 5: Manual Penilai Pengadil (RA)](#bab-5-manual-penilai-pengadil-ra)
- [BAB 6: Manual Pentadbir (Admin)](#bab-6-manual-pentadbir-admin)
- [BAB 7: Carta Alir Proses](#bab-7-carta-alir-proses)
- [BAB 8: Penyelesaian Masalah (Troubleshoot)](#bab-8-penyelesaian-masalah-troubleshoot)

---

# BAB 1: Pengenalan Sistem

## 1.1 Apa Itu RefPahang?

RefPahang adalah sistem pengurusan pengadil bola sepak dalam talian yang dibangunkan khusus untuk Persatuan Bola Sepak Negeri Pahang (PBNP). Sistem ini menguruskan keseluruhan kitaran hayat pengadil — dari pendaftaran, permohonan tahunan, lantikan tugasan, rekod perlawanan, sehingga penilaian prestasi.

## 1.2 Peranan Pengguna

Sistem ini mempunyai **4 peranan** utama:

| Peranan | Singkatan | Tanggungjawab Utama |
|---------|-----------|---------------------|
| **Pentadbir** | Admin | Pengurusan keseluruhan sistem, kelulusan permohonan, lantikan pengadil, tetapan |
| **PP Daerah** | PP | Pegawai Pembangunan Daerah — pengesahan permohonan & perlawanan daerah masing-masing |
| **Pengadil** | - | Pengadil bola sepak — pendaftaran, permohonan tahunan, rekod perlawanan, terima lantikan |
| **Penilai Pengadil** | RA | Referee Assessor — menilai prestasi pengadil semasa perlawanan |

## 1.3 Akses Sistem

| Maklumat | Nilai |
|----------|-------|
| URL Sistem | `https://refpahang.com` |
| Pelayar Disokong | Google Chrome, Mozilla Firefox, Safari, Microsoft Edge (versi terkini) |
| Peranti | Desktop, tablet, dan telefon pintar (responsif) |

## 1.4 Saluran Notifikasi

Sistem menghantar notifikasi melalui **3 saluran**:

1. **Portal** — Notifikasi dalam sistem (ikon loceng di bahagian atas)
2. **Emel** — Dihantar ke emel berdaftar pengguna
3. **Telegram** — Dihantar melalui bot Telegram RefPahang (perlu dihubungkan terlebih dahulu)

---

# BAB 2: Panduan Umum (Semua Pengguna)

## 2.1 Pendaftaran Akaun Baharu

### Langkah-langkah:

1. Buka laman `https://refpahang.com` → klik **"Daftar Akaun Baharu"**
2. Isi borang pendaftaran:

| Medan | Penerangan | Wajib |
|-------|-----------|-------|
| Nama Penuh | Seperti dalam kad pengenalan | ✅ |
| No. Kad Pengenalan | 12 digit tanpa sengkang (cth: 900101065432) | ✅ |
| Emel | Emel aktif untuk menerima notifikasi | ✅ |
| No. Telefon | 10-11 digit (cth: 0123456789) | ✅ |
| Jantina | Lelaki / Perempuan | ✅ |
| Jenis Pengadil | Pengadil Kebangsaan / Pengadil Negeri / Penilai Pengadil / Pegawai Pembangunan | ✅ |
| Persatuan Bolasepak Daerah | Pilih daerah (12 daerah di Pahang) | ✅ |
| Pengesahan Data | Tandakan kotak persetujuan | ✅ |

3. Klik **"Daftar"**
4. **Kata laluan** akan dijana secara automatik dan dihantar ke emel anda
5. Modal kejayaan akan dipaparkan — klik **"Buka Telegram"** untuk menghubungkan akaun Telegram anda

> **⚠️ Penting:** Sila tukar kata laluan anda selepas log masuk pertama kali.

### 12 Persatuan Bolasepak Daerah (PBD):

| # | Daerah | # | Daerah |
|---|--------|---|--------|
| 1 | Bentong | 7 | Maran |
| 2 | Bera | 8 | Pekan |
| 3 | Cameron Highlands | 9 | Raub |
| 4 | Jerantut | 10 | Rompin |
| 5 | Kuantan | 11 | Temerloh |
| 6 | Lipis | 12 | Muadzam Shah |

### Penentuan Peranan:
- Pilih **"Pegawai Pembangunan"** → Akaun didaftarkan sebagai **PP Daerah**
- Pilih jenis lain → Akaun didaftarkan sebagai **Pengadil**

> **Nota:** Pendaftaran Penilai Pengadil (RA) dilakukan melalui jenis "Penilai Pengadil" tetapi peranan akaun tetap Pengadil. Admin akan menaikkan taraf ke peranan Penilai jika perlu.

---

## 2.2 Log Masuk

1. Buka `https://refpahang.com` → halaman log masuk
2. Masukkan **Emel** dan **Kata Laluan**
3. Klik **"Log Masuk"**
4. Sistem akan mengarahkan anda ke dashboard mengikut peranan:
   - Admin → `/admin`
   - PP Daerah → `/pp-daerah`
   - Pengadil → `/pengadil`
   - Penilai → `/penilai`

> **Nota:** Jika ini adalah log masuk pertama, anda akan diminta menukar kata laluan.

---

## 2.3 Lupa Kata Laluan

1. Di halaman log masuk, klik **"Lupa kata laluan?"**
2. Masukkan emel berdaftar anda
3. Klik **"Hantar"**
4. Pautan penetapan semula akan dihantar ke emel anda
5. Klik pautan dalam emel → tetapkan kata laluan baharu

> **Nota Keselamatan:** Mesej kejayaan sentiasa dipaparkan walaupun emel tidak wujud dalam sistem — ini untuk melindungi privasi pengguna.

---

## 2.4 Tukar Kata Laluan

1. Pergi ke **Profil Saya** → bahagian **Tukar Kata Laluan**
2. Masukkan:
   - **Kata Laluan Semasa** — kata laluan yang sedang digunakan
   - **Kata Laluan Baharu** — minimum 8 aksara
   - **Sahkan Kata Laluan Baharu** — mestilah sama dengan di atas
3. Klik **"Tukar Kata Laluan"**

---

## 2.5 Menghubungkan Telegram

Telegram membolehkan anda menerima notifikasi segera untuk lantikan, permohonan, dan maklumat penting.

### Langkah-langkah:
1. Pergi ke **Profil Saya**
2. Cari bahagian **Telegram** → klik **"Hubungkan Telegram"**
3. Sistem akan membuka aplikasi Telegram dengan bot RefPahang
4. Tekan **"Start"** atau hantar mesej `/start` kepada bot
5. Bot akan mengesahkan penyambungan — Status akan bertukar menjadi hijau **"Telegram Berjaya Dihubungkan"**

> **Tip:** Anda juga boleh menghubungkan Telegram sejurus selepas pendaftaran melalui modal kejayaan.

---

## 2.6 Notifikasi

### Melihat Notifikasi:
1. Klik ikon **🔔 (loceng)** di bahagian atas
2. Senarai 50 notifikasi terkini dipaparkan
3. Bilangan notifikasi belum dibaca ditunjukkan pada lencana merah

### Menanda Dibaca:
- Klik pada notifikasi individu → ditanda dibaca
- Klik **"Tanda Semua Dibaca"** → semua notifikasi ditanda

### Jenis Notifikasi:

| Jenis | Penerangan |
|-------|-----------|
| Pendaftaran Berjaya | Akaun baharu berjaya didaftarkan |
| Lantikan Baru | Tugasan lantikan baharu diterima |
| Permohonan Disahkan | Permohonan disahkan oleh PP / Admin |
| Permohonan Ditolak | Permohonan ditolak |
| Perlawanan Baru | Rekod perlawanan baharu perlu disahkan (untuk PP) |
| Pengesahan Perlawanan | Perlawanan disahkan/ditolak oleh PP |
| Rekod Perlawanan | Anda direkodkan dalam perlawanan oleh pengadil lain |
| Profil Dikemaskini | Profil berjaya dikemaskini |

---

## 2.7 Kemaskini Profil

Semua pengguna boleh mengemaskini maklumat profil mereka:

### Maklumat Yang Boleh Dikemaskini:

**Maklumat Peribadi:**
- Nama Penuh, No. Telefon, Saiz Baju, Tahun Mula Aktif
- Alamat Penuh (Alamat 1, Alamat 2, Poskod, Daerah)

**Maklumat Pekerjaan:**
- Status Kerja, Jawatan, Nama Majikan
- Alamat Majikan (Alamat 1, Alamat 2, Poskod, Daerah, Negeri)

**Maklumat Waris:**
- Nama Waris, Hubungan (Ibu Bapa/Pasangan/Anak/Adik-beradik/Lain-lain), No. Telefon Waris

**Gambar Profil:**
- Klik ikon kamera pada gambar profil → pilih gambar → potong (crop) → simpan
- Format diterima: JPEG, PNG, WebP
- Saiz maksimum: 5MB

### Langkah-langkah:
1. Pergi ke **Profil Saya**
2. Klik butang **"Edit"** (ikon pensel)
3. Kemaskini maklumat yang diperlukan
4. Klik **"Simpan"**

> **Maklumat yang TIDAK boleh diubah:** No. Kad Pengenalan, Emel, Jantina, Negeri (ditetapkan Pahang)

---

# BAB 3: Manual Pengadil

## 3.1 Menu Utama Pengadil

| # | Menu | Ikon | Fungsi |
|---|------|------|--------|
| 1 | Dashboard | 📊 | Paparan ringkasan dan statistik |
| 2 | Profil Saya | 👤 | Pengurusan maklumat peribadi |
| 3 | Tugasan Lantikan | 📋 | Senarai lantikan dari Admin |
| 4 | Rekod Perlawanan | ⚽ | Rekod perlawanan tidak rasmi |
| 5 | Penilaian Saya | ⭐ | Laporan penilaian prestasi |
| 6 | **Permohonan** | 📝 | — |
| 6a | → Pendaftaran Tahunan (R1) | 🏷️ | Borang pendaftaran tahunan |
| 6b | → Ujian Kecergasan | 💪 | Maklumat ujian kecergasan |
| 6c | → Ujian Kelas III FAM (R11) | 📝 | Permohonan ujian Kelas III |
| 6d | → Ujian Kelas I FAM (R11) | 🏅 | Permohonan ujian Kelas I |

---

## 3.2 Dashboard Pengadil

Dashboard memaparkan ringkasan maklumat penting:

### Kad Statistik (4 kad):

| Kad | Penerangan |
|-----|-----------|
| **Perlawanan (Tahun)** | Jumlah perlawanan tahun semasa |
| **Disahkan PP** | Bilangan perlawanan yang telah disahkan oleh PP Daerah |
| **Status Kelayakan** | "Layak" (≥20 perlawanan disahkan) / "Belum Layak" |
| **Lantikan Belum Jawab** | Bilangan tugasan lantikan yang belum dijawab |

### Pautan Pantas:
- Profil, Tugasan Lantikan, Rekod Perlawanan, Pengadil Berdaftar

### Bahagian Lain:
- **Notifikasi Terkini** — 5 notifikasi terbaru
- **Pengumuman** — Pengumuman dari PBNP
- **Perlawanan Terkini** — Jadual 5 perlawanan terakhir

---

## 3.3 Permohonan Pendaftaran Tahunan

### Tujuan:
Pengadil perlu membuat pendaftaran tahunan setiap tahun untuk kekal aktif. Pendaftaran ini mewajibkan bayaran yuran dan penyerahan dokumen.

### Syarat:
- Akaun sudah didaftarkan dalam sistem
- Profil telah dilengkapi (alamat, pekerjaan, waris)
- **Minimum 20 perlawanan disahkan** dalam tahun semasa (untuk pengadil sahaja)
- Tempoh pendaftaran dibuka oleh Admin

### Langkah-langkah:

**1. Buat Bayaran:**
- Buat bayaran ke akaun yang dipaparkan (nama bank, no. akaun, jumlah yuran)
- Simpan resit bayaran (PDF/gambar)

**2. Isi Borang:**
- Maklumat peribadi diisi secara automatik dari profil
- Isi/kemaskini **Maklumat Waris**:
  - Nama Waris (wajib)
  - Hubungan: Ibu Bapa / Pasangan / Anak / Adik-beradik / Lain-lain (wajib)
  - No. Telefon Waris (wajib)
- Pilih **Saiz Baju Rasmi**: XS, S, M, L, XL, XXL, XXXL (wajib)
- Muat naik **Resit Bayaran**: PDF/JPG/JPEG/PNG, maksimum 5MB (wajib)
- Muat naik **Gambar Profil Terbaru**: JPG/JPEG/PNG, maksimum 5MB (wajib)

**3. Deklarasi Kesihatan (5 item — semua wajib ditandakan):**
1. ☑ Status kesihatan fizikal dan mental baik
2. ☑ Telah melalui pemeriksaan perubatan dan disahkan layak
3. ☑ Memahami risiko dan melepaskan PBNP dari tuntutan
4. ☑ Bersetuju memaklumkan sebarang kondisi perubatan
5. ☑ Memberi kebenaran rawatan kecemasan

**4. Perakuan Umum (3 item — semua wajib ditandakan):**
1. ☑ Maklumat yang diberikan adalah benar dan tepat
2. ☑ Sekiranya maklumat palsu, permohonan akan dibatalkan
3. ☑ Bersetuju mematuhi peraturan dan undang-undang PBNP/FAM

**5. Klik "Hantar Permohonan"**

### Aliran Kelulusan:
```
Pengadil hantar → Menunggu PP Daerah → PP sahkan → Menunggu Admin → Admin luluskan → Lengkap
                                     → PP tolak → Ditolak (perlu hantar semula)
```

### Selepas Hantar:
- Status permohonan dipaparkan di halaman permohonan
- Notifikasi akan diterima melalui portal dan emel pada setiap perubahan status

---

## 3.4 Permohonan Ujian Kelas III FAM

### Tujuan:
Memohon untuk menduduki Ujian Kelas III FAM (ujian bertulis).

### Syarat Kelayakan:
- Umur: **15 hingga 40 tahun** (dikira dari No. KP)
- Yuran: **RM 50**
- Tempoh permohonan dibuka oleh Admin

### Langkah-langkah:
1. Buat bayaran RM 50 ke akaun FAM yang dipaparkan
2. Isi maklumat waris
3. Muat naik resit bayaran FAM
4. Tandakan 2 perakuan umum
5. Klik **"Hantar Permohonan"**

---

## 3.5 Permohonan Ujian Kelas I FAM

### Tujuan:
Memohon untuk menduduki Ujian Kelas I FAM (peningkatan taraf).

### Syarat Kelayakan:
- Umur: **Tidak melebihi 32 tahun**
- Telah **lulus Ujian Kelas III** sekurang-kurangnya **2 tahun** yang lalu
- Yuran: **RM 300**
- Tempoh permohonan dibuka oleh Admin

### Langkah-langkah:
1. Buat bayaran RM 300 ke akaun FAM
2. Isi maklumat waris
3. Muat naik resit bayaran FAM
4. Tandakan 2 perakuan umum
5. Klik **"Hantar Permohonan"**

> **⚠️ Nota:** Sistem akan menyemak secara automatik kelayakan umur dan tempoh lulus Kelas III.

---

## 3.6 Ujian Kecergasan

Halaman ini memaparkan maklumat bahawa ujian kecergasan **dibundel bersama** Pendaftaran Tahunan. Tiada borang berasingan perlu diisi — ia akan diuruskan secara fizikal semasa sesi ujian.

---

## 3.7 Sejarah Permohonan

Di setiap halaman permohonan, bahagian **"Sejarah Permohonan"** memaparkan:

| Lajur | Penerangan |
|-------|-----------|
| # | Bilangan |
| Tarikh Hantar | Tarikh permohonan dihantar |
| Sesi | Tahun permohonan |
| Status | Menunggu / Diluluskan / Ditolak / Lulus / Tidak Lulus / Tidak Hadir |
| Catatan | Nota dari PP Daerah atau Admin |
| Muat Turun | Pautan muat turun borang PDF (untuk permohonan yang diluluskan) |

---

## 3.8 Tugasan Lantikan

### Tujuan:
Menerima dan menjawab tugasan lantikan rasmi dari Admin untuk kejohanan/perlawanan.

### Maklumat Dipaparkan:

| Medan | Penerangan |
|-------|-----------|
| Kejohanan | Nama kejohanan |
| No. Perlawanan | Nombor perlawanan |
| Tarikh & Masa | Tarikh dan masa perlawanan |
| Pasukan | Pasukan tuan rumah vs tetamu |
| Tempat | Lokasi perlawanan |
| Jawatan | Pengadil / Penolong Pengadil 1 / Penolong Pengadil 2 / Pegawai Ke-4 |
| Pengadil Utama | Nama pengadil yang dilantik sebagai pengadil utama (untuk rujukan) |
| Status | Belum Jawab / Diterima / Ditolak |

### Statistik: 
4 kad — Jumlah tugasan, Belum Jawab, Diterima, Ditolak

### Menjawab Tugasan:

**Melalui Portal (dalam sistem):**
1. Pergi ke **Tugasan Lantikan**
2. Cari tugasan dengan status **"Belum Jawab"**
3. Klik **"Terima"** atau **"Tolak"**
   - Jika tolak: Wajib isi sebab penolakan
4. Status akan dikemaskini serta-merta

**Melalui Pautan Emel/Telegram (tanpa log masuk):**
1. Terima notifikasi melalui emel atau Telegram
2. Klik pautan **"Terima"** atau **"Tolak"** dalam mesej
3. Halaman pengesahan akan dipaparkan
4. Pautan adalah **sekali guna** — selepas digunakan, ia tamat tempoh

### Apa Yang Berlaku Selepas Terima:
- Rekod perlawanan **dicipta secara automatik** dengan status **"Disahkan"**
- Jika anda seorang Penilai Pengadil, **token borang penilaian** akan dijana dan dihantar
- Jika **semua pegawai** untuk perlawanan tersebut telah menerima, status jadual perlawanan bertukar kepada **"Disahkan"**

---

## 3.9 Rekod Perlawanan

### Tujuan:
Merekod perlawanan **tidak rasmi** (persahabatan, perlawanan luar kejohanan) sebagai minit perlawanan. Perlawanan rasmi dari lantikan dicipta secara automatik dan tidak perlu didaftar di sini.

### Kad Statistik (3 kad):

| Kad | Penerangan |
|-----|-----------|
| Jumlah Perlawanan | Semua perlawanan (rasmi + tidak rasmi) |
| Disahkan | Perlawanan yang telah disahkan oleh PP |
| Belum Disahkan | Perlawanan yang menunggu pengesahan |

### Jadual Perlawanan:

| Lajur | Penerangan |
|-------|-----------|
| # | Bilangan |
| Perlawanan | Pasukan tuan rumah vs tetamu + lencana (Lantikan Rasmi / Kumpulan) |
| Keputusan | Skor FT (tebal) + HT/ET/PS jika ada |
| Jenis | Liga / Piala / Persahabatan / Lain-lain |
| Tarikh | Tarikh + masa perlawanan |
| Tempat | Lokasi + nama daerah |
| Jawatan | Jawatan anda dalam perlawanan |
| Status PP | Belum Disahkan / Disahkan / Tidak Disahkan |
| Tindakan | Butang padam (jika bukan lantikan rasmi dan belum disahkan) |

### Menambah Perlawanan Baharu:

**Penting:** Hanya **seorang pengadil** perlu mengisi borang untuk **SEMUA pegawai** dalam perlawanan tersebut. Rekod akan dipaparkan kepada semua pegawai yang terlibat.

**Langkah-langkah:**

1. Klik **"Tambah Perlawanan"**
2. Isi **Maklumat Perlawanan:**

| Medan | Jenis | Wajib | Pilihan |
|-------|-------|-------|---------|
| Pasukan Tuan Rumah | Teks | ✅ | — |
| Pasukan Lawan | Teks | ✅ | — |
| Tarikh | Tarikh | ✅ | — |
| Masa | Masa | ❌ | — |
| Jenis | Pilihan | ❌ | Liga, Piala, Persahabatan, Lain-lain |
| Nama Kejohanan | Teks | ❌ | cth: Liga M-League 2026 |
| Tempat | Teks | ❌ | Lokasi perlawanan |
| Daerah Perlawanan | Pilihan | ✅ | Senarai 12 daerah Pahang |
| Cuaca | Pilihan | ❌ | Cerah, Mendung, Hujan Renyai, Hujan Lebat, Panas Terik, Berangin |

3. Isi **Keputusan Perlawanan** (boleh dikosongkan jika belum diketahui):

| Tempoh | Penerangan |
|--------|-----------|
| Separuh Masa (HT) | Skor home : away |
| Penuh Masa (FT) | Skor home : away |
| Masa Tambahan (ET) | Skor home : away (opsional — jika ada lanjutan) |
| Penalti (PS) | Skor home : away (opsional — jika ada penalti) |

4. Isi **Pegawai Perlawanan:**
   - Sistem menyediakan **4 slot** secara lalai: Pengadil, Penolong Pengadil 1, Penolong Pengadil 2, Pengadil Ke-4
   - Boleh tambah hingga **5 pegawai** (termasuk Pengadil Ke-5)
   - Untuk setiap pegawai:
     - Pilih **Jawatan** dari senarai
     - **Cari pengadil** menggunakan kotak carian (nama atau No. KP)
     - Pengadil yang sudah dipilih di slot lain akan dikecualikan dari carian
   - Klik **"+ Tambah Pegawai"** untuk menambah slot
   - Klik ikon ❌ untuk membuang slot (minimum 1 slot)

5. Klik **"Simpan"**

### Peraturan Penting:

| Peraturan | Penerangan |
|-----------|-----------|
| **Peraturan 14 Hari** | Perlawanan tidak boleh didaftarkan jika tarikh perlawanan melebihi 14 hari yang lalu |
| **Jawatan Unik** | Setiap jawatan hanya boleh diberikan kepada seorang pegawai |
| **Minimum 1 Pegawai** | Sekurang-kurangnya seorang pegawai perlu diisi |
| **Daerah Wajib** | Daerah perlawanan wajib dipilih — PP Daerah tersebut akan menerima notifikasi |
| **Tidak Boleh Padam Lantikan** | Rekod yang dicipta dari lantikan rasmi tidak boleh dipadamkan |

### Selepas Penghantaran:
- Rekod perlawanan dicipta untuk **setiap pegawai** yang dipilih (berkongsi `match_group_id`)
- **PP Daerah** bagi daerah perlawanan menerima notifikasi (portal + emel) untuk pengesahan
- **Semua pegawai lain** menerima notifikasi portal bahawa mereka telah direkodkan dalam perlawanan tersebut

### Lencana dalam Jadual:

| Lencana | Warna | Maksud |
|---------|-------|--------|
| **Lantikan Rasmi** | Biru | Rekod dicipta automatik dari sistem lantikan |
| **Kumpulan** | Ungu | Rekod berkumpulan — seorang pengadil mendaftar untuk semua pegawai |

---

## 3.10 Penilaian Saya

### Tujuan:
Melihat laporan penilaian prestasi yang telah disahkan oleh Admin. Penilaian dilakukan oleh Penilai Pengadil (RA) semasa perlawanan kejohanan.

### Kad Statistik:
- **Jumlah Penilaian** — Bilangan laporan yang telah disahkan
- **Purata Markah** — Purata markah keseluruhan anda

### Senarai Laporan:
Setiap kad laporan memaparkan:
- Jawatan anda dalam perlawanan
- Perlawanan (pasukan vs pasukan)
- Nama kejohanan
- Tarikh dan nama penilai
- **Markah** (daripada 10) dengan pengekodan warna:

| Julat | Warna | Penerangan |
|-------|-------|-----------|
| 8.3 – 10.0 | 🟢 Hijau | Prestasi baik hingga sangat baik |
| 8.0 – 8.2 | 🔵 Biru | Baik dengan penambahbaikan |
| 7.5 – 7.9 | 🟡 Kuning | Tidak memuaskan |
| < 7.5 | 🔴 Merah | Buruk |

### Butiran Laporan (klik untuk buka):
- Maklumat perlawanan penuh (kejohanan, pasukan, skor, tarikh, penilai)
- Jadual semua pegawai: Jawatan, Nama, Markah, Prestasi
- **Penilaian anda** — mengandungi:
  - Markah dan prestasi
  - **Kekuatan** (tag hijau) — aspek yang baik
  - **Kelemahan** (tag merah) — aspek yang perlu diperbaiki
  - **Nasihat** — saranan penilai
  - Bagi 3 bahagian (Pengadil): Kawalan Permainan, Kecergasan Fizikal, Kerjasama Berpasukan
  - Bagi 1 bahagian (Penolong Pengadil / Pegawai Ke-4): Penilaian umum
- **Ulasan Keseluruhan** — komen keseluruhan penilai
- **Catatan Admin** — nota dari pentadbir (jika ada)
- Butang **"Muat Turun PDF"** (untuk laporan yang disahkan)

---

# BAB 4: Manual PP Daerah

## 4.1 Menu Utama PP Daerah

| # | Menu | Fungsi |
|---|------|--------|
| 1 | Dashboard | Ringkasan daerah |
| 2 | **Permohonan Saya** | — |
| 2a | → Pendaftaran Tahunan Penilai (R4) | Permohonan sendiri |
| 2b | → Ujian Kelas III FAM (R11) | Permohonan sendiri |
| 2c | → Ujian Kelas I FAM (R11) | Permohonan sendiri |
| 3 | Pengesahan Permohonan | Sahkan/tolak permohonan daerah |
| 4 | Pengesahan Perlawanan | Sahkan/tolak perlawanan daerah |
| 5 | **Permohonan** | — |
| 5a | → Pendaftaran Tahunan Penilai (R4) | Senarai permohonan berdaftar daerah |
| 5b | → Ujian Kelas III FAM (R11) | Senarai permohonan bertulis daerah |
| 5c | → Ujian Kelas I FAM (R11) | Senarai permohonan kelas I daerah |
| 6 | Pengadil Berdaftar | Senarai pengadil daerah |
| 7 | RA Berdaftar | Senarai penilai daerah |
| 8 | Laporan Penilaian | Laporan penilaian pengadil daerah |
| 9 | Tugasan Lantikan | Tugasan lantikan sendiri (jika dilantik) |
| 10 | Profil | Pengurusan profil sendiri |

> **Skop Penting:** Semua data yang dipaparkan kepada PP Daerah **hanya melibatkan daerah sendiri**. PP Kuantan hanya nampak data Kuantan.

---

## 4.2 Dashboard PP Daerah

### Maklumat Dipaparkan:

**Kad Statistik (4 kad):**
| Kad | Penerangan |
|-----|-----------|
| Pengadil Berdaftar | Jumlah pengadil aktif dalam daerah |
| Menunggu Pengesahan | Permohonan yang perlu disahkan (animasi denyut jika > 0) |
| Diluluskan | Permohonan yang telah diluluskan |
| Perlawanan Bulan Ini | Jumlah perlawanan bulan semasa |

**Sepanduk CTA (Call-to-Action):**
- 🟠 Sepanduk ambar jika ada permohonan menunggu → pautan ke Pengesahan Permohonan
- 🔵 Sepanduk biru jika ada perlawanan menunggu → pautan ke Pengesahan Perlawanan

**Bahagian Lain:**
- **Top 5 Pengadil** — Pengadil paling aktif (berdasarkan jumlah perlawanan)
- **Perlawanan Akan Datang** — 10 perlawanan seterusnya dengan pegawai yang dilantik
- **Pautan Pantas** — Pendaftaran Tahunan, Ujian Kecergasan, Kelas III FAM, Kelas I FAM, Senarai Pengadil

---

## 4.3 Pengesahan Permohonan

### Tujuan:
PP Daerah berperanan sebagai pengesah peringkat pertama sebelum permohonan dihantar ke Admin.

### Aliran Proses:
```
Pengadil hantar → Status: "Menunggu PP Daerah"
        ↓
PP Daerah sahkan → Status: "Menunggu Admin" → Admin luluskan → "Lengkap"
PP Daerah tolak → Status: "Ditolak"
```

### Jadual Permohonan:

| Lajur | Penerangan |
|-------|-----------|
| # | Bilangan |
| Nama | Nama pemohon |
| No. KP | Nombor kad pengenalan |
| Jenis | Jenis borang permohonan |
| Resit | Pautan ke resit bayaran yang dimuat naik |
| Status | Status semasa permohonan |
| Tarikh | Tarikh permohonan |
| Tindakan | Butang Sahkan / Tolak |

### Carian & Tapis:
- Cari mengikut nama atau No. KP
- Tapis mengikut status: Semua / Menunggu / Disahkan / Ditolak

### Mengesahkan Permohonan:
1. Semak maklumat pengadil dan resit bayaran
2. Klik **"Sahkan"** → Dialog pengesahan dipaparkan → Klik **"Ya"**
3. Permohonan bertukar kepada status **"Menunggu Admin"**
4. **Emel dihantar kepada:**
   - Semua Admin aktif — memberitahu permohonan telah disahkan PP dan perlu tindakan
   - Pemohon — memberitahu permohonan telah disahkan PP, menunggu kelulusan Admin

### Menolak Permohonan:
1. Klik **"Tolak"** → Modal penolakan dipaparkan
2. **Wajib** isi sebab penolakan dalam kotak teks
3. Klik **"Hantar Penolakan"**
4. Permohonan bertukar kepada status **"Ditolak"**
5. **Emel dihantar kepada pemohon** — memberitahu permohonan ditolak beserta sebab

### Muat Turun:
- Klik **"Muat Turun Excel"** untuk mengeksport senarai permohonan dalam format Excel (tersedia untuk jenis berdaftar sahaja)

---

## 4.4 Pengesahan Perlawanan

### Tujuan:
PP Daerah mengesahkan atau menolak rekod perlawanan tidak rasmi yang didaftarkan oleh pengadil. Semua perlawanan yang berlangsung di dalam daerah PP akan dipaparkan di sini.

### Skop Pengesahan (Penting):
- **Perlawanan berkumpulan** → disenaraikan berdasarkan **daerah perlawanan** yang dipilih oleh pengadil (bukan daerah pengadil)
- **Perlawanan legasi** (tanpa kumpulan) → disenaraikan berdasarkan **persatuan pengadil**

> Ini bermakna: Jika pengadil dari daerah Kuantan mendaftar perlawanan yang berlaku di Pekan, PP Pekan yang perlu mengesahkan, bukan PP Kuantan.

### Kad Statistik (4 kad boleh diklik untuk tapis):
| Kad | Penerangan |
|-----|-----------|
| Jumlah | Semua perlawanan |
| Menunggu | Perlawanan menunggu pengesahan |
| Disahkan | Perlawanan telah disahkan |
| Ditolak | Perlawanan telah ditolak |

### Kad Perlawanan:
Setiap kad memaparkan:
- **Pasukan** tuan rumah vs tetamu
- **Lencana**: Lantikan Rasmi (biru) / Kumpulan (ungu + bilangan pegawai)
- **Maklumat**: Tarikh, Jenis, Tempat, Daerah, Kejohanan (jika ada)
- **Penghantar**: Nama pengadil yang menghantar rekod
- **Senarai Pegawai** (untuk perlawanan berkumpulan): Nama, Jenis Pengadil, Jawatan
- **Status**: Menunggu / Disahkan / Tidak Disahkan
- **Catatan PP** (jika ada catatan sebelumnya)

### Mengesahkan Perlawanan:
1. Semak maklumat perlawanan dan pegawai yang terlibat
2. Klik **"Sahkan"** (ikon ✅)
3. Masukkan catatan (opsional)
4. Klik **"Sahkan"**
5. **Untuk perlawanan berkumpulan**: Semua rekod pegawai dalam kumpulan yang sama akan disahkan sekaligus
6. **Notifikasi portal** dihantar kepada setiap pengadil yang terlibat

### Menolak Perlawanan:
1. Klik **"Tolak"** (ikon ❌)
2. Masukkan catatan (opsional tetapi digalakkan)
3. Klik **"Tolak"**
4. Notifikasi dihantar kepada semua pengadil terlibat

### Mengembalikan Status:
1. Untuk perlawanan yang sudah disahkan/ditolak, klik **"Edit Semula"** (ikon 🔄)
2. Status dikembalikan ke **"Belum Disahkan"**
3. Notifikasi dihantar kepada pengadil

### Memadam Perlawanan:
1. Klik **"Padam"** (ikon 🗑️) → **Amaran: Tindakan ini tidak boleh dibatalkan**
2. Untuk perlawanan berkumpulan: semua rekod dalam kumpulan yang sama dipadamkan

---

## 4.5 Senarai Pengadil Berdaftar

### Tujuan:
Melihat semua pengadil berdaftar dalam daerah.

### Jadual:
| Lajur | Penerangan |
|-------|-----------|
| # | Bilangan |
| Nama | Nama penuh pengadil |
| No. IC | Nombor kad pengenalan |
| Jenis Pengadil | Pengadil Kebangsaan / Pengadil Negeri |
| Telefon | No. telefon |
| Permohonan | Jumlah permohonan / Bilangan lulus |
| Status | Aktif / Tidak Aktif |

### Profil Pengadil (klik untuk buka):
Modal butiran penuh mengandungi:
- **Maklumat Peribadi**: Emel, No. Telefon, No. KP, Tarikh Daftar
- **Alamat**: Alamat penuh dengan poskod, daerah, negeri
- **Maklumat Pengadil**: Jenis, Persatuan, Tahun Mula Aktif, No. Pendaftaran FAM
- **Pekerjaan**: Status kerja, Jawatan, Majikan, Alamat Majikan
- **Waris**: Nama, Hubungan, No. Telefon
- **Statistik**: Jumlah permohonan, Lulus, Perlawanan
- **Rekod Perlawanan Terkini**: 10 perlawanan terakhir dengan pasukan, tarikh, jawatan, tempat, status

---

## 4.6 Senarai RA (Penilai) Berdaftar

Sama seperti Senarai Pengadil tetapi memaparkan pengguna dengan peranan **Penilai** dalam daerah.

---

## 4.7 Laporan Penilaian

### Tujuan:
Melihat laporan penilaian pengadil dalam daerah yang telah disahkan.

### Statistik (4 angka):
- Jumlah Laporan, Purata Markah, Markah Tertinggi, Markah Terendah

### Jadual Laporan:

| Lajur | Penerangan |
|-------|-----------|
| Perlawanan | Pasukan + No. Perlawanan |
| Kejohanan | Nama kejohanan |
| Tarikh | Tarikh perlawanan |
| Keputusan | Skor perlawanan |
| Penilai | Nama penilai |
| Pegawai & Markah | Chip per pegawai (nama + markah) |
| Tindakan | Lihat detail / Muat turun PDF |

### Butiran Laporan:
- Maklumat perlawanan penuh
- Keputusan perlawanan (HT, FT, ET, PS)
- Jadual semua pegawai: Jawatan, Nama, Markah, Prestasi
- Penilaian per pegawai: Kekuatan, Kelemahan, Nasihat (per bahagian)
- Ulasan Keseluruhan
- Butang **"Muat Turun PDF"**

### Pengekodan Warna Markah:
| Julat | Warna | Maksud |
|-------|-------|--------|
| ≥ 8.3 | 🟢 Hijau | Prestasi baik / sangat baik |
| ≥ 8.0 | 🔵 Biru | Baik dengan penambahbaikan |
| ≥ 7.5 | 🟡 Kuning | Tidak memuaskan |
| < 7.5 | 🔴 Merah | Buruk |

---

## 4.8 Permohonan Daerah

PP Daerah boleh melihat semua permohonan dalam daerah mereka mengikut jenis:
- **Pendaftaran Tahunan Penilai (R4)** — `/pp-daerah/permohonan/berdaftar`
- **Ujian Kelas III FAM** — `/pp-daerah/permohonan/bertulis`
- **Ujian Kelas I FAM** — `/pp-daerah/permohonan/kelas1`

Setiap halaman memaparkan jadual permohonan dengan carian dan penapis status.

---

## 4.9 Permohonan Sendiri PP

PP Daerah juga boleh membuat permohonan mereka sendiri:
- **Pendaftaran Tahunan Penilai** — kerana PP juga berperanan sebagai penilai
- **Ujian Kelas III / Kelas I FAM** — jika ingin meningkatkan taraf

Borang dan aliran adalah sama seperti pengadil, kecuali keperluan **minimum 20 perlawanan** tidak dikenakan kepada PP Daerah.

---

# BAB 5: Manual Penilai Pengadil (RA)

## 5.1 Menu Utama Penilai

| # | Menu | Fungsi |
|---|------|--------|
| 1 | Dashboard | Ringkasan tugasan dan statistik |
| 2 | Penilaian Pengadil | Isi dan hantar laporan penilaian |
| 3 | Pendaftaran Tahunan (R4) | Permohonan pendaftaran tahunan |
| 4 | Tugasan | Senarai tugasan lantikan |
| 5 | Statistik | Statistik penilaian |
| 6 | Profil | Pengurusan profil sendiri |

---

## 5.2 Dashboard Penilai

### Statistik:
| Kad | Penerangan |
|-----|-----------|
| Jumlah Tugasan | Semua tugasan sebagai Penilai Pengadil |
| Selesai | Laporan yang telah dihantar/disahkan |
| Belum Selesai | Laporan yang belum dilengkapi |
| Pengadil Dinilai | Bilangan pengadil unik yang telah dinilai |

### Tugasan Terkini:
5 tugasan terakhir dengan status dan butiran perlawanan.

---

## 5.3 Penilaian Pengadil

### Tujuan:
Ini adalah fungsi utama Penilai — menilai prestasi pengadil semasa perlawanan kejohanan.

### Dua Tab:

**Tab 1: Perlu Dinilai**
- Memaparkan senarai perlawanan yang penilai telah dilantik dan menerima tugasan
- Hanya perlawanan dengan status lantikan **"Diterima"** dan jawatan **"Penilai Pengadil"**
- Maklumat: Perlawanan (pasukan, no. perlawanan, kejohanan), Tarikh, Pengadil Utama, Status Laporan

**Tab 2: Laporan Saya**
- Senarai semua laporan yang telah dihantar/disahkan

### Status Laporan:

| Status | Penerangan | Warna |
|--------|-----------|-------|
| Belum Dilengkapi | Belum mula mengisi | 🔴 |
| Draf | Sudah mula, belum dihantar | 🟡 |
| Dihantar | Sudah dihantar ke Admin | 🔵 |
| Disahkan | Admin telah mengesahkan | 🟢 |

### Mengisi Borang Penilaian:

**Dua Kaedah Akses:**

**Kaedah 1: Melalui Portal (dalam sistem)**
1. Pergi ke **Penilaian Pengadil** → tab **"Perlu Dinilai"**
2. Klik **"Mula Penilaian"** atau **"Sambung Draf"**

**Kaedah 2: Melalui Pautan Token (tanpa log masuk)**
1. Terima pautan melalui emel/Telegram selepas menerima lantikan
2. Klik pautan → borang penilaian dibuka tanpa perlu log masuk
3. Sesuai untuk penilai luar (pengadil_luar) yang tidak mempunyai akaun

### Bahagian Borang Penilaian:

**1. Maklumat Perlawanan** (automatik dari jadual):
- Kejohanan, Pasukan, No. Perlawanan, Tarikh, Masa, Tempat, Nama Penilai

**2. Keputusan Perlawanan** (diisi oleh penilai):

| Tempoh | Medan |
|--------|-------|
| Separuh Masa (HT) | Skor Home : Away |
| Penuh Masa (FT) | Skor Home : Away |
| Masa Tambahan (ET) | Skor Home : Away (opsional) |
| Penalti (PS) | Skor Home : Away (opsional) |

**3. Tahap Kesukaran Perlawanan:**
- Normal / Susah / Sangat Susah

**4. Cuaca:**
- Cerah / Mendung / Hujan Renyai / Hujan Lebat / Panas Terik / Berangin

**5. Penilaian Per Pegawai** (satu tab untuk setiap pegawai):

Sistem memuatkan semua pegawai yang dilantik untuk perlawanan tersebut (R, AR1, AR2, P4).

Untuk setiap pegawai:

| Medan | Penerangan | Wajib |
|-------|-----------|-------|
| **Markah** | Skor 6.0 – 10.0 (selang 0.1) | ✅ (untuk hantar) |
| **Prestasi** | Sangat Baik / Baik / Memuaskan / Tidak Memuaskan | ❌ |

**Bahagian Kriteria (berbeza mengikut jawatan):**

Untuk **Pengadil (R)** — 3 bahagian:
| Bahagian | Bil. Kriteria | Contoh Kriteria |
|----------|--------------|-----------------|
| Kawalan Permainan | 28 item | Keputusan penalti, penggunaan kelebihan, kad kuning/merah, bola tangan, offside, dsb. |
| Kecergasan Fizikal & Posisi | 10 item | Kelajuan larian, penempatan sudut, jarak dari bola, stamina, dsb. |
| Kerjasama Berpasukan | 12 item | Komunikasi dengan penolong, konsistensi keputusan, pengurusan masa, dsb. |

Untuk **Penolong Pengadil (AR1/AR2)** — 1 bahagian:
| Bahagian | Bil. Kriteria |
|----------|--------------|
| Penilaian Penolong Pengadil | 24 item |

Untuk **Pegawai Ke-4 (P4)** — 1 bahagian:
| Bahagian | Bil. Kriteria |
|----------|--------------|
| Penilaian Pegawai Keempat | 11 item |

Untuk setiap bahagian:
- **Kekuatan** (pilih pelbagai) — tandakan kriteria yang pengadil lakukan dengan baik
- **Kelemahan** (pilih pelbagai) — tandakan kriteria yang perlu diperbaiki
- **Nasihat** (teks) — saranan khusus untuk penambahbaikan

**6. Ulasan Keseluruhan:**
- Teks bebas untuk ulasan menyeluruh tentang prestasi perlawanan

### Skala Pemarkahan (Rujukan):

| Julat Markah | Penerangan |
|-------------|-----------|
| 9.0 – 10.0 | Prestasi sangat baik, keputusan pada situasi sukar adalah betul |
| 8.5 – 8.9 | Prestasi sangat baik |
| 8.3 – 8.4 | Prestasi baik |
| 8.0 – 8.2 | Baik dengan penambahbaikan |
| 7.9 | Tidak memuaskan — 1 insiden penting (sepatutnya 8.3+) |
| 7.8 | Tidak memuaskan — 1 insiden penting (sepatutnya 8.0-8.2) |
| 7.5 – 7.7 | Tidak memuaskan — 2 insiden penting |
| 7.4 | Kesilapan mempengaruhi keputusan perlawanan |
| 7.0 – 7.4 | Buruk — 3 atau lebih insiden penting |

### Simpan & Hantar:

**Simpan Draf:**
- Klik **"Simpan Draf"** pada bila-bila masa
- Markah dan semua maklumat disimpan tetapi belum dihantar
- Boleh kembali dan menyambung kemudian

**Hantar Laporan:**
- Klik **"Hantar Laporan"** → Dialog pengesahan
- **Semua markah pegawai WAJIB diisi** sebelum boleh hantar
- Selepas dihantar: Status → **"Dihantar"** → menunggu Admin mengesahkan

### Selepas Admin Sahkan:
- Status bertukar kepada **"Disahkan"**
- **Emel diterima** oleh setiap pegawai yang dinilai — mengandungi:
  - Markah dan prestasi mereka
  - 5 kekuatan dan 5 kelemahan utama
  - Pautan ke laporan PDF
- **Mesej Telegram** dihantar kepada pegawai yang telah menghubungkan Telegram
- Laporan boleh dimuat turun sebagai PDF

---

# BAB 6: Manual Pentadbir (Admin)

## 6.1 Menu Utama Admin

| # | Menu | Fungsi |
|---|------|--------|
| 1 | Dashboard | Paparan ringkasan keseluruhan sistem |
| 2 | Permohonan Pengadil | Urus permohonan semua pengadil |
| 3 | Permohonan RA | Urus permohonan penilai |
| 4 | Pengadil Berdaftar | Senarai semua pengadil berdaftar |
| 5 | RA Berdaftar | Senarai semua penilai berdaftar |
| 6 | PP Daerah | Senarai semua PP Daerah |
| 7 | Pengguna | Pengurusan semua pengguna |
| 8 | Lantikan Pengadil | Pengurusan kejohanan, jadual & lantikan |
| 9 | Pengadil Luar | Urus pengadil dari negeri lain |
| 10 | Statistik | Analitik dan laporan |
| 11 | Pengumuman | Urus pengumuman awam |
| 12 | Tetapan | Tetapan sistem |
| 13 | Profil Saya | Pengurusan profil Admin |

---

## 6.2 Dashboard Admin

### Kad KPI (4 kad):
| Kad | Penerangan |
|-----|-----------|
| Pengadil Aktif | Jumlah pengadil aktif dalam sistem |
| Permohonan Baru | Permohonan yang menunggu tindakan (animasi denyut jika > 0) |
| Laporan Semakan | Laporan penilaian yang belum disahkan |
| Perlawanan Bulan Ini | Jumlah perlawanan dalam bulan semasa |

### Widget "Perhatian Segera":
- Bilangan permohonan tertunda
- Bilangan laporan yang perlu disemak

### Akses Pantas:
- Pengumuman, Statistik

### Permohonan Terkini:
- 5 permohonan terbaru yang menunggu Admin
- Butang **Luluskan** / **Tolak** terus dari dashboard

### Pengumuman:
- 4 pengumuman terkini

---

## 6.3 Permohonan Pengadil

### Tujuan:
Mengurus semua jenis permohonan pengadil dari seluruh negeri.

### Tab Permohonan:

| Tab | Fungsi |
|-----|--------|
| Pengadil Berdaftar | Pendaftaran tahunan pengadil |
| Ujian Kelas III FAM | Permohonan ujian bertulis Kelas III |
| Ujian Kelas I FAM | Permohonan ujian Kelas I |

### Kad Statistik (4 kad per tab):
| Kad | Penerangan |
|-----|-----------|
| Jumlah | Keseluruhan permohonan |
| Menunggu | Permohonan menunggu tindakan |
| Diluluskan / Lulus | Permohonan yang telah diluluskan |
| Ditolak / Tidak Lulus | Permohonan yang telah ditolak |

### Penapis & Carian:
- **Cari**: Nama, No. KP, emel
- **Status**: Menunggu / Diluluskan / Ditolak (atau Lulus / Tidak Lulus / Tidak Hadir untuk ujian)
- **Daerah**: Pilih PBD tertentu
- **Tahun**: Pilih tahun permohonan

### Jadual Permohonan:
| Lajur | Penerangan |
|-------|-----------|
| Gambar | Gambar profil pemohon |
| Nama | Nama penuh |
| No. KP | Nombor kad pengenalan |
| Telefon | No. telefon |
| Emel | Alamat emel |
| Jenis Pengadil | Kebangsaan / Negeri (dengan lencana warna) |
| Saiz Baju | Lencana saiz |
| Daerah | Nama PBD |
| Status | Menunggu / Diluluskan / Ditolak |
| Tarikh | Tarikh permohonan dihantar |

### Tindakan Permohonan:

**Meluluskan (Approve):**
1. Klik pada permohonan → butiran dipaparkan → klik **"Luluskan"**
2. Status bertukar kepada **"Lengkap"** / **"Admin Diluluskan"**
3. Emel pengesahan dihantar kepada pemohon

**Menolak (Reject):**
1. Klik **"Tolak"** → modal sebab penolakan
2. **Wajib** isi sebab penolakan
3. Status bertukar kepada **"Ditolak"**
4. Emel penolakan dihantar kepada pemohon (termasuk sebab)

**Untuk Tab Ujian (Kelas III / Kelas I):**
| Tindakan | Keterangan |
|----------|-----------|
| Lulus | Calon lulus ujian |
| Tidak Lulus | Calon tidak lulus ujian |
| Tidak Hadir | Calon tidak hadir ujian |

**Muat Turun:** Eksport data dalam format Excel

---

## 6.4 Pengadil Berdaftar / RA Berdaftar

### Tujuan:
Melihat dan mengurus senarai semua pengadil / penilai berdaftar.

### Kad Statistik:
| Kad | Penerangan |
|-----|-----------|
| Jumlah | Keseluruhan berdaftar |
| Lelaki | Bilangan lelaki |
| Perempuan | Bilangan perempuan |

### Penapis:
- Cari mengikut nama, No. KP, persatuan, jenis pengadil
- Tapis mengikut tahun (5 tahun terkini)
- Tapis mengikut jantina

### Tindakan:
- **Lihat Profil** — Modal butiran penuh (3 tab: Maklumat, Sejarah, Perlawanan)
- **Edit** — Kemaskini maklumat pengadil
- **Padam** — Padam rekod (dengan pengesahan)
- **Muat Turun Excel** — Eksport senarai
- **Cetak** — Susun atur mesra cetakan

---

## 6.5 Senarai PP Daerah

### Tujuan:
Melihat semua PP Daerah yang berdaftar.

### Kad Statistik:
| Kad | Penerangan |
|-----|-----------|
| Jumlah PP | Keseluruhan PP |
| Aktif | PP yang aktif |
| Tidak Aktif | PP yang tidak aktif |
| Ada Persatuan | PP yang mempunyai persatuan |

### Jadual:
- Nama, No. KP, Persatuan, No. Telefon, Status

---

## 6.6 Pengurusan Pengguna

### Tujuan:
Mengurus keseluruhan senarai pengguna sistem.

### Kad Statistik:
| Kad | Penerangan |
|-----|-----------|
| Jumlah Pengguna | Keseluruhan pengguna |
| Pengadil | Bilangan pengadil |
| PP Daerah | Bilangan PP |
| Pentadbir & Penilai | Bilangan admin + penilai |

### Tindakan:
| Tindakan | Penerangan |
|----------|-----------|
| Tambah Pengguna | Cipta akaun baharu |
| Edit Profil | Kemaskini maklumat pengguna |
| Reset Kata Laluan | Hantar pautan reset |
| Hantar Semula Emel | Hantar semula emel notifikasi |
| Padam Pengguna | Padam akaun pengguna |

---

## 6.7 Lantikan Pengadil (5 Tab)

Ini adalah modul paling kompleks dalam sistem — mengurus keseluruhan aliran lantikan dari kejohanan hingga penilaian.

### Tab 1: Kejohanan (Tournaments)

**Tujuan:** Mendaftar dan mengurus kejohanan bola sepak.

**Jadual:**
| Lajur | Penerangan |
|-------|-----------|
| Nama | Nama kejohanan |
| Logo | Logo kiri + kanan (boleh muat naik) |
| Tarikh | Tarikh mula – tarikh akhir |
| Anjuran | Penganjur |
| Jumlah Perlawanan | Bilangan perlawanan dalam kejohanan |
| Status | Draf / Aktif / Selesai |

**Tindakan:**
- **Tambah Kejohanan** — isi nama, tarikh mula/akhir, anjuran, muat naik logo
- **Edit** — kemaskini maklumat kejohanan
- **Padam** — padam kejohanan
- **Lihat Jadual** — pergi ke Tab 2 dengan kejohanan dipilih

---

### Tab 2: Jadual Perlawanan (Match Schedule)

**Tujuan:** Mengurus jadual perlawanan dalam kejohanan.

**Jadual:**
| Lajur | Penerangan |
|-------|-----------|
| No. Perlawanan | Nombor perlawanan |
| Tarikh | Tarikh perlawanan |
| Masa | Masa perlawanan |
| Kategori | B12 / B15 / B18 / dll. |
| Peringkat | Kumpulan / Separuh Akhir / Akhir / dll. |
| Kumpulan | Nama kumpulan (jika ada) |
| Pasukan | Tuan rumah vs Tetamu |
| Tempat | Lokasi perlawanan |

**Tindakan:**
- **Tambah Manual** — isi butiran per perlawanan
- **Edit** — kemaskini maklumat perlawanan
- **Padam** — padam perlawanan
- **Muat Naik Excel** — muat naik jadual secara pukal dari fail Excel
  - Sistem akan memaparkan pratonton data sebelum import
  - Pengesahan dilakukan: format tarikh, medan wajib

---

### Tab 3: Lantikan Pengadil (Referee Assignments)

**Tujuan:** Melantik pengadil dan pegawai ke perlawanan.

**Aliran Kerja:**

1. **Pilih perlawanan** dari senarai jadual
2. Sistem memaparkan **slot jawatan**:
   - Pengadil
   - Penolong Pengadil 1
   - Penolong Pengadil 2
   - Pegawai Ke-4
   - Penilai Pengadil (RA)
3. Lihat **Pool Pengadil** — senarai pengadil yang layak:
   - Pengadil berdaftar (dari sistem)
   - Pengadil luar (dari negeri lain)
   - Boleh cari dan tapis mengikut jenis pengadil
4. **Klik pengadil** dari pool → pilih slot jawatan → **Modal pengesahan**
5. Klik **"Lantik"** → Rekod lantikan dicipta
6. Pengadil menerima notifikasi melalui **3 saluran** (portal, emel, Telegram)

### Notifikasi Kepada Pengadil:
Selepas lantikan:
- **Portal**: Notifikasi "Lantikan Baru" dengan butiran perlawanan
- **Emel**: Emel rasmi dengan butiran + pautan terima/tolak
- **Telegram**: Mesej segera dengan butiran + pautan terima/tolak

### Notifikasi Kepada PP Daerah:
PP Daerah bagi daerah pengadil akan menerima notifikasi bahawa pengadil mereka telah dilantik.

---

### Tab 4: Jadual Lantikan (Assignment Schedule Report)

**Tujuan:** Melihat laporan penuh lantikan untuk keseluruhan kejohanan.

**Paparan:**
- Semua perlawanan dengan pegawai yang dilantik
- Status respons setiap pegawai (Belum Jawab / Diterima / Ditolak)

**Tindakan:**
- **Pengesahan Jadual**: Isi nama pengesah, jawatan, dan nota → simpan
- **Muat Turun PDF** — Muat turun laporan jadual lantikan dalam format PDF (A4)
- **Pilih Perlawanan** — Pilih perlawanan tertentu untuk pengesahan secara kelompok

---

### Tab 5: Laporan Penilaian

**Tujuan:** Melihat dan mengesahkan laporan penilaian daripada Penilai.

**Jadual:**
| Lajur | Penerangan |
|-------|-----------|
| Perlawanan | Pasukan + No. Perlawanan |
| Penilai | Nama penilai |
| Tarikh Hantar | Tarikh laporan dihantar |
| Status | Dihantar / Disahkan |

**Tindakan:**
- **Lihat Laporan** — papar butiran penuh penilaian
- **Sahkan Laporan** — menukar status kepada **"Disahkan"**:
  - Status jadual perlawanan → **"Selesai"**
  - **Emel dihantar** kepada setiap pegawai yang dinilai (markah, kekuatan, kelemahan, pautan PDF)
  - **Telegram dihantar** kepada pegawai yang telah menghubungkan Telegram
- **Muat Turun PDF** — laporan dalam format A4

---

## 6.8 Pengadil Luar

### Tujuan:
Mengurus senarai pengadil dari negeri lain yang boleh dilantik ke kejohanan di Pahang.

### Tindakan:
- **Tambah** — tambah pengadil luar secara manual
- **Muat Naik** — muat naik senarai dari fail
- **Edit / Padam** — urus rekod sedia ada

---

## 6.9 Statistik & Analitik

### Tujuan:
Memaparkan analisis visual mengenai aktiviti sistem.

### Penapis:
- Pilih tahun untuk tapis data

### 6 Kad Ringkasan (satu baris):
Klik pada mana-mana kad untuk terus ke halaman berkaitan.

### Tab Permohonan:
- **Kad Status**: Menunggu, Lengkap, Ditolak, Jumlah
- **Carta Bar**: Permohonan mengikut jenis borang
- **Carta Pai**: Taburan status permohonan
- **Carta Garisan**: Trend bulanan permohonan

### Tab Pengadil:
- **Carta Donat**: Taburan jantina
- **Carta Bar**: Status pekerjaan
- **Carta Bar**: Taburan mengikut daerah
- **Carta Garisan**: Trend pendaftaran bulanan

### Tab Lantikan:
- **Kad**: Jumlah, Selesai, Disahkan, Belum
- **Jadual**: Senarai kejohanan dengan statistik

---

## 6.10 Pengumuman

### Tujuan:
Mengurus pengumuman yang dipaparkan kepada semua pengguna.

### Kad Statistik:
| Kad | Penerangan |
|-----|-----------|
| Jumlah Pengumuman | Keseluruhan pengumuman |
| Bulan Ini | Pengumuman dalam bulan semasa |
| Terkini | Tajuk pengumuman terbaru |

### Tindakan:
| Tindakan | Penerangan |
|----------|-----------|
| Tambah | Modal borang: tajuk + kandungan |
| Lihat | Modal paparan penuh |
| Edit | Kemaskini tajuk / kandungan |
| Padam | Padam dengan pengesahan |

> **Nota:** Pengumuman dipaparkan di halaman log masuk (carousel), dashboard semua peranan, dan bahagian pengumuman portal.

---

## 6.11 Tetapan Sistem

### Tujuan:
Mengawal tetapan operasi sistem.

### 1. Mod Penyelenggaraan (Maintenance Mode):
- **Aktif**: Hanya Admin boleh akses sistem
- **Tidak Aktif**: Semua pengguna boleh akses
- Togol suis untuk tukar

### 2. Status Permohonan Per Jenis:

| Jenis | Kawalan |
|-------|--------|
| Daftar Akaun Baru | DIBUKA / DITUTUP + tarikh mula & akhir |
| Permohonan Pendaftaran Tahunan (R1+R2+R4) | DIBUKA / DITUTUP + tarikh mula & akhir |
| Ujian Kelas III FAM (R11 Bertulis) | DIBUKA / DITUTUP + tarikh mula & akhir |
| Ujian Kelas I FAM (R11 Kelas I) | DIBUKA / DITUTUP + tarikh mula & akhir |
| Pendaftaran Penilai (R4) | DIBUKA / DITUTUP + tarikh mula & akhir |

Setiap jenis mempunyai:
- Suis ON/OFF
- Tarikh mula pendaftaran
- Tarikh akhir pendaftaran

### 3. Maklumat Pembayaran:
- Nama Bank
- No. Akaun
- Jumlah Yuran

### 4. Peraturan Kelayakan FAM:
- Umur minimum/maksimum ujian
- Bilangan pusingan kecergasan

---

# BAB 7: Carta Alir Proses

## 7.1 Aliran Pendaftaran Akaun Baharu

```
Pengguna baru
    │
    ▼
Buka halaman pendaftaran
    │
    ▼
Isi borang (Nama, IC, Emel, Telefon, Jantina, Jenis, PBD)
    │
    ▼
Klik "Daftar"
    │
    ├── Jenis = Pegawai Pembangunan → Peranan: PP Daerah
    └── Jenis lain → Peranan: Pengadil
    │
    ▼
Kata laluan dijana automatik → dihantar ke emel
    │
    ▼
Modal kejayaan → Pilihan hubungkan Telegram
    │
    ▼
Log masuk → Tukar kata laluan (digalakkan)
    │
    ▼
Lengkapkan profil (alamat, pekerjaan, waris)
```

## 7.2 Aliran Permohonan Pendaftaran Tahunan

```
Pengadil / PP Daerah
    │
    ▼
Pastikan profil lengkap + ≥20 perlawanan disahkan (pengadil sahaja)
    │
    ▼
Buat bayaran yuran tahunan
    │
    ▼
Isi borang: Waris + Saiz Baju + Resit + Gambar + Deklarasi
    │
    ▼
Hantar permohonan
    │
    ▼
Status: "Menunggu PP Daerah"
    │
    ├── PP Daerah SAHKAN ───────────────────┐
    │                                        ▼
    │                          Status: "Menunggu Admin"
    │                                        │
    │                          ├── Admin LULUSKAN ──→ Status: "Lengkap" ✅
    │                          └── Admin TOLAK ──→ Status: "Ditolak" ❌
    │
    └── PP Daerah TOLAK ──→ Status: "Ditolak" ❌
```

## 7.3 Aliran Lantikan Pengadil

```
Admin
    │
    ▼
Cipta Kejohanan → Muat Naik Jadual Perlawanan
    │
    ▼
Pilih perlawanan → Lantik pengadil dari pool ke slot jawatan
    │
    ▼
Notifikasi dihantar: Portal + Emel + Telegram
    │
    ▼
Pengadil menerima notifikasi
    │
    ├── TERIMA (melalui portal atau pautan emel/Telegram)
    │       │
    │       ▼
    │   Rekod perlawanan dicipta automatik (status: "Disahkan")
    │       │
    │       ▼
    │   Token penilaian dijana untuk Penilai (jika berkenaan)
    │       │
    │       ▼
    │   Jika SEMUA pegawai terima → Jadual perlawanan: "Disahkan"
    │
    └── TOLAK (wajib isi sebab)
            │
            ▼
        Notifikasi kepada Admin + PP Daerah
```

## 7.4 Aliran Rekod Perlawanan (Tidak Rasmi)

```
Pengadil (seorang sahaja)
    │
    ▼
Klik "Tambah Perlawanan"
    │
    ▼
Isi: Pasukan, Tarikh, Masa, Jenis, Tempat, Daerah, Cuaca
    │
    ▼
Isi: Keputusan Perlawanan (HT, FT, ET, PS)
    │
    ▼
Pilih pegawai perlawanan (1-5 orang) + jawatan masing-masing
    │
    ▼
Klik "Simpan"
    │
    ▼
Rekod dicipta untuk SETIAP pegawai (berkongsi match_group_id)
    │
    ├── PP Daerah (daerah perlawanan) → Notifikasi portal + emel
    └── Pegawai lain → Notifikasi portal
    │
    ▼
PP Daerah mengesahkan
    │
    ├── SAHKAN → Semua rekod kumpulan: "Disahkan" ✅
    ├── TOLAK → Semua rekod kumpulan: "Tidak Disahkan" ❌
    └── KEMBALIKAN → Status dikembalikan ke "Belum Disahkan"
```

## 7.5 Aliran Penilaian Pengadil

```
Admin melantik Penilai Pengadil (RA) ke perlawanan
    │
    ▼
Penilai terima lantikan → Status: "Diterima"
    │
    ▼
Token penilaian dijana → Pautan dihantar via emel/Telegram
    │
    ▼
Penilai mengisi borang penilaian:
    │
    ├── Melalui portal (log masuk)
    └── Melalui pautan token (tanpa log masuk)
    │
    ▼
Isi: Keputusan, Tahap Kesukaran, Cuaca
    │
    ▼
Per pegawai: Markah (6-10), Prestasi, Kekuatan, Kelemahan, Nasihat
    │
    ▼
Ulasan Keseluruhan
    │
    ├── "Simpan Draf" → Boleh sambung kemudian
    └── "Hantar Laporan" → Status: "Dihantar"
    │
    ▼
Admin menyemak laporan
    │
    ▼
Admin "Sahkan" → Status: "Disahkan"
    │
    ▼
Emel + Telegram dihantar kepada setiap pengadil yang dinilai
    │
    ▼
Pengadil melihat markah di "Penilaian Saya" + boleh muat turun PDF
```

## 7.6 Aliran Pengesahan PP Daerah

```
        ┌─────────────────────────────┐
        │   PP DAERAH (Skop Daerah)   │
        └─────────────────────────────┘
                    │
        ┌───────────┼───────────┐
        ▼           ▼           ▼
   Pengesahan    Pengesahan   Senarai
   Permohonan   Perlawanan   Pengadil
        │           │           │
        ▼           ▼           ▼
   Permohonan   Perlawanan   Profil
   daerah ini   daerah ini   pengadil
        │           │        daerah ini
        │           │
    ┌───┴───┐   ┌───┴───┐
    ▼       ▼   ▼       ▼
 Sahkan   Tolak Sahkan  Tolak
    │       │     │       │
    ▼       ▼     ▼       ▼
 → Admin  Emel  Semua   Semua
         tolak  pegawai pegawai
                disahkan ditolak
```

---

# BAB 8: Penyelesaian Masalah (Troubleshoot)

## 8.1 Masalah Log Masuk

| Masalah | Punca Kemungkinan | Penyelesaian |
|---------|-------------------|-------------|
| "Emel atau kata laluan tidak sah" | Kata laluan salah atau emel tidak berdaftar | Semak ejaan emel. Guna fungsi "Lupa Kata Laluan" untuk tetapkan semula |
| Tidak boleh log masuk langsung | Akaun tidak aktif | Hubungi Admin untuk mengaktifkan semula akaun |
| Halaman "Sistem Dalam Penyelenggaraan" | Mod penyelenggaraan aktif | Hanya Admin boleh akses. Tunggu sehingga mod dimatikan |
| Selepas log masuk, kembali ke halaman log masuk | Sesi tamat atau cookies disekat | Pastikan cookies dibenarkan. Cuba pelayar lain. Buka dalam mod biasa (bukan incognito) |

## 8.2 Masalah Pendaftaran

| Masalah | Punca | Penyelesaian |
|---------|-------|-------------|
| "Pendaftaran Ditutup" | Admin telah menutup pendaftaran | Hubungi Admin atau tunggu sehingga pendaftaran dibuka |
| "No. KP sudah digunakan" | Akaun dengan IC yang sama sudah wujud | Gunakan fungsi "Lupa Kata Laluan" untuk mendapatkan akses |
| "Emel sudah digunakan" | Emel sudah berdaftar | Cuba emel lain atau guna "Lupa Kata Laluan" |
| Tidak terima emel kata laluan | Emel dalam folder spam/junk | Semak folder spam. Pastikan emel betul. Hubungi Admin jika perlu |

## 8.3 Masalah Permohonan

| Masalah | Punca | Penyelesaian |
|---------|-------|-------------|
| "Pendaftaran ditutup" | Tempoh permohonan sudah tamat | Hubungi Admin untuk maklumat tarikh pembukaan |
| "Minimum 20 perlawanan diperlukan" | Belum cukup perlawanan disahkan | Pastikan ≥20 perlawanan telah disahkan oleh PP. Daftarkan lagi jika perlu |
| "Umur tidak memenuhi syarat" | Umur di luar lingkungan (Kelas III: 15-40, Kelas I: ≤32) | Syarat umur adalah automatik berdasarkan No. KP |
| "Perlu lulus Kelas III sekurang-kurangnya 2 tahun" | Prasyarat Kelas I belum dipenuhi | Pastikan anda telah lulus Kelas III ≥2 tahun yang lalu |
| "Permohonan sudah dihantar tahun ini" | Hanya 1 permohonan per jenis per tahun | Tunggu sehingga permohonan semasa diproses |
| Fail tidak boleh dimuat naik | Format atau saiz tidak sesuai | Gunakan PDF/JPG/JPEG/PNG sahaja. Saiz maksimum 5MB |
| Status "Ditolak" | PP Daerah atau Admin menolak permohonan | Semak catatan penolakan. Perbaiki kekurangan dan hantar semula |

## 8.4 Masalah Perlawanan

| Masalah | Punca | Penyelesaian |
|---------|-------|-------------|
| "Rekod melebihi 14 hari" | Tarikh perlawanan > 14 hari yang lalu | Perlawanan mesti didaftarkan dalam tempoh 14 hari |
| "Jawatan sudah digunakan" | Dua pegawai dengan jawatan sama | Setiap jawatan hanya boleh diberikan kepada seorang pegawai |
| Tidak jumpa pengadil dalam carian | Pengadil belum berdaftar dalam sistem | Pastikan pengadil sudah mempunyai akaun aktif |
| "Sila pilih daerah perlawanan" | Daerah tidak dipilih | Pilih daerah tempat perlawanan berlangsung (bukan daerah pengadil) |
| Tidak boleh padam perlawanan | Rekod lantikan rasmi | Perlawanan dari lantikan rasmi tidak boleh dipadamkan |
| Perlawanan "Tidak Disahkan" | PP Daerah menolak rekod | Semak catatan PP. Betulkan maklumat dan hubungi PP Daerah |

## 8.5 Masalah Lantikan

| Masalah | Punca | Penyelesaian |
|---------|-------|-------------|
| Tidak terima notifikasi lantikan | Telegram tidak dihubungkan / emel dalam spam | 1) Hubungkan Telegram 2) Semak folder spam |
| Pautan terima/tolak "Pautan Tidak Sah" | Tugasan telah dijawab melalui saluran lain atau lantikan dikemaskini oleh pentadbir | Log masuk ke sistem dan semak melalui "Tugasan Lantikan" |
| "Tempoh Menjawab Telah Tamat" | Tidak menjawab dalam tempoh ditetapkan (Liga: 48 jam, lain: 3 jam selepas notifikasi) — lantikan ditolak secara automatik | Hubungi Admin jika masih boleh bertugas (Admin boleh lantik semula dan hantar notifikasi baru) |
| "Tugasan Sudah Dijawab" | Sudah menjawab melalui saluran lain | Tiada tindakan perlu — jawapan telah direkodkan |
| Ingin tukar jawapan selepas menjawab | Jawapan tidak boleh diubah | Hubungi Admin untuk bantuan |

## 8.6 Masalah Penilaian (Penilai)

| Masalah | Punca | Penyelesaian |
|---------|-------|-------------|
| Tiada perlawanan di tab "Perlu Dinilai" | Belum menerima lantikan atau belum menerimanya | Semak "Tugasan" dan pastikan telah menekan "Terima" |
| Tidak boleh hantar laporan | Markah belum diisi untuk semua pegawai | Pastikan setiap pegawai telah diberi markah |
| "Laporan Sudah Dihantar" (borang token) | Laporan telah dihantar melalui kaedah lain | Hubungi Admin jika perlu pindaan |
| Borang token tidak dapat dibuka | Token tidak sah atau tamat tempoh | Hubungi Admin untuk mendapatkan pautan baharu |

## 8.7 Masalah Profil

| Masalah | Punca | Penyelesaian |
|---------|-------|-------------|
| Gambar profil tidak bertukar | Cache pelayar | Cuba muat semula halaman (Ctrl+Shift+R / Cmd+Shift+R) |
| "Gagal memuat naik gambar" | Format tidak sesuai atau saiz besar | Gunakan JPEG/PNG/WebP sahaja. Maksimum 5MB |
| Maklumat tidak dapat disimpan | Maklumat wajib tidak lengkap | Pastikan alamat, pekerjaan, dan waris telah diisi |

## 8.8 Masalah Telegram

| Masalah | Punca | Penyelesaian |
|---------|-------|-------------|
| Bot tidak bertindak balas | Pautan token tamat | Pergi ke Profil → klik "Hubungkan Telegram" semula untuk jana pautan baru |
| Status masih "Tidak Dihubungkan" | Anda klik Start tetapi proses gagal | Cuba klik pautan sekali lagi. Pastikan anda menekan "Start" dalam Telegram |
| Tidak terima mesej Telegram | Anda mungkin telah menyekat bot | Buka semula perbualan dengan bot RefPahang dan pastikan tidak disekat |

## 8.9 Masalah Umum

| Masalah | Penyelesaian |
|---------|-------------|
| Halaman tidak dimuatkan | 1) Muat semula halaman 2) Kosongkan cache pelayar 3) Cuba pelayar lain |
| Data tidak dikemaskini | Muat semula halaman. Data mungkin mengambil masa untuk dikemaskini |
| Butang tidak berfungsi | 1) Pastikan JavaScript diaktifkan 2) Kosongkan cache pelayar |
| Ralat "500" atau "Ralat Pelayan" | Masalah sementara pelayan. Cuba lagi selepas beberapa minit. Jika berterusan, hubungi Admin |
| Paparan tidak kemas pada telefon | Pastikan pelayar dikemaskini. Cuba putar peranti ke mod landskap untuk jadual |

---

## Sokongan Teknikal

Jika masalah tidak dapat diselesaikan, sila hubungi:

| Saluran | Maklumat |
|---------|----------|
| Pentadbir Sistem | Hubungi melalui sistem (notifikasi) |
| Emel Sokongan | Hubungi Admin melalui emel rasmi PBNP |

---

> **Dokumen ini dijana secara automatik dari analisis sistem RefPahang versi 3.0**
> **Tarikh:** 5 April 2026
