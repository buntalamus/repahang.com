# Manual pengguna RefPahang mengikut peranan

Empat manual PDF berasingan, Edisi 20 Oktober 2026. Ditulis dalam Bahasa Melayu dengan gaya hitam/kuning RefPahang, isi kandungan boleh klik, penanda buku, arahan bernombor, nota pengguna dan screenshot.

| Manual | PDF | Halaman | Penempatan rajah |
|---|---|---:|---:|
| Admin | `output/pdf/Manual_Pengguna_Admin_RefPahang.pdf` | 57 | 51 |
| PP Daerah | `output/pdf/Manual_Pengguna_PP_Daerah_RefPahang.pdf` | 37 | 30 |
| RA / Penilai Pengadil | `output/pdf/Manual_Pengguna_RA_RefPahang.pdf` | 35 | 24 |
| Pengadil | `output/pdf/Manual_Pengguna_Pengadil_RefPahang.pdf` | 38 | 28 |

Jumlah: 167 halaman dan 133 penempatan screenshot, menggunakan 93 imej unik. Rajah dikongsi apabila fungsi sama diterangkan dalam manual yang berdiri sendiri. Jumlah ini bukan bilangan screenshot unik.

## Skop kandungan

- Semua edisi: akses akaun, pemulihan/tukar kata laluan, Android/iPhone, pengaktifan dan masalah notifikasi, Telegram, kemas kini, bantuan dan lampiran Akaun Tidak Aktif.
- Admin: pengguna/peranan/master data, Pengadil/RA/PP, tempoh permohonan/yuran/syarat, kelulusan, seminar/ujian, pengadil luar dan import Excel, kejohanan/pool/jadual, KUP/RA, Pengerusi, notifikasi/audit/penggantian/pembatalan, dokumen, laporan, chat, emel/kenalan/blast, Telegram queue, statistik dan penggunaan aplikasi.
- PP Daerah: semakan permohonan, larangan semak permohonan sendiri, senarai pegawai, pengesahan/pertindihan perlawanan, laporan daerah, kejohanan/lantikan daerah, statistik serta keupayaan tambahan Pengadil/RA.
- RA: akaun awam peranan Penilai, R1 tahunan, jawapan lantikan, setiap KUP, kriteria, markah, draf/hantar, pengesahan Pengerusi/PDF, RA jemputan dan statistik.
- Pengadil: akaun awam, profil, jawapan lantikan, surat, rekod/pengesahan, R1+R2+R4, perakuan kesihatan, Kelas III/Kelas I, sejarah/PDF, penilaian KUP, statistik dan pengadil luar.

## Ketepatan dan batas versi

Kandungan disemak terhadap `frontend/src/app/app.routes.ts`, menu `shared/components/sidebar/nav-items.ts`, komponen ciri Angular, widget Flutter, pengendali `cloudflare/src/`, serta `shared/appointment-deadline.ts`.

Rujukan versi ialah keluaran 20 Oktober 2026, termasuk sebab akaun tidak aktif, automasi dua tahun/8 bulan serta popup baharu. Status pelepasan sebenar direkodkan berasingan dalam bukti deploy.

Istilah dijaga berasingan: peranan, kategori Pengadil, pendaftaran tahunan, keputusan permohonan, seminar dan kecergasan. RA ialah Penilai Pengadil; KUP ialah R/AR1/AR2/pegawai keempat. Pendaftaran akaun tidak menggantikan permohonan tahunan.

Pautan menu Pengadil `Notifikasi Lantikan` menggunakan laluan tugasan sah `/pengadil/tugasan`. Butang **Manual Pengguna** pada header portal membuka PDF khusus peranan pengguna.

## Screenshot dan privasi

Screenshot web diambil melalui browser daripada binaan Angular sebenar. Pratonton hanya mengakses salinan SQLite sementara dengan nama, emel, KP, telefon dan naratif dianonimkan. Keadaan menunggu/ditolak/baharu ditetapkan pada salinan contoh; ia bukan keputusan produksi semasa.

`prepare.py` menyediakan salinan data di `tmp/manual-peranan/contoh.sqlite`. `preview.mjs` menggunakan query Worker sebenar bagi bacaan, menggantikan identiti sesi, menolak tulis DB dan menyekat sambungan rangkaian. Mail/chat mempunyai respons contoh setempat. Tiada akaun produksi dilog masuk semula, tiada permohonan/lantikan diproses, dan tiada emel/Telegram dihantar untuk merakam rajah.

Rajah mobile dan kad kebenaran diambil semula daripada rakaman widget sebenar manual mobile terdahulu. Asal serta hash direkodkan dalam `output/manual-peranan/reused-screenshots.json`. Ia bukan screenshot dialog kebenaran OS sebenar setiap jenama telefon. Beberapa rajah PP menggunakan komponen lantikan yang sama dalam panel Admin; teks halaman menyatakan perbezaan itu serta sekatan PP.

## Fail sumber dan penghasilan semula

- `content.py`: kandungan utama dan pemetaan rajah mengikut peranan.
- `build.py`: penjana PDF/Markdown dengan semakan limpahan pada setiap teks, imej, nota dan jadual.
- `Manual_Admin.md`, `Manual_PP_Daerah.md`, `Manual_RA.md`, `Manual_Pengadil.md`: sumber bacaan/suntingan terjana. Sunting `content.py` untuk pembinaan semula.
- `prepare.py` dan `preview.mjs`: data serta pratonton screenshot setempat.
- `verify.py`: bilangan halaman, pautan, penanda buku, glyph, sempadan teks dan contact sheet akhir.
- `screenshots/`: 93 imej contoh yang digunakan dalam manual, disimpan bersama sumber.
- `frontend/public/documents/`: empat PDF terbitan yang dihantar bersama aset portal.
- `output/manual-peranan/`: manifest, indeks liputan dan laporan QA.

Jana PDF:

```sh
python3 docs/manual-peranan/build.py
```

Render setiap PDF akhir dengan Poppler, contohnya:

```sh
mkdir -p tmp/manual-peranan/render-final/Admin
pdftoppm -scale-to 1400 -png output/pdf/Manual_Pengguna_Admin_RefPahang.pdf tmp/manual-peranan/render-final/Admin/page
```

Ulang untuk `PP_Daerah`, `RA` dan `Pengadil`, kemudian:

```sh
python3 docs/manual-peranan/verify.py
```

Periksa semua contact sheet dan beberapa halaman PNG saiz penuh. Salin empat PDF akhir ke `frontend/public/documents/` sebelum binaan produksi. Fail di `output/` kekal diabaikan Git.
