# Eksport borang calon Kelas I FAM

Admin → Permohonan Pengadil → Ujian Kelas I FAM → **Eksport Borang FAM (.xlsx)**.
Eksport mengambil semua permohonan selepas penapis tahun, status ujian, PBD dan carian,
termasuk rekod di halaman senarai yang lain. Jumlah calon dipaparkan di sebelah butang.
Penapis “Semua Status” menyertakan semua permohonan, termasuk yang ditolak.

Templat `frontend/public/templates/fam-calon-kelas1.xlsx` ialah salinan asal tanpa
perubahan daripada fail pengguna `1. Calon Exam Bolasepak kls 1 - 2026 (1).xlsx`.
SHA-256: `8795425e674ae65eef09273054c5a58101d9b1ff997ecbabd8786fd730ce5612`.

Eksport mengekalkan logo, tajuk, susunan lajur, lebar lajur, lajur tersembunyi E/F,
50 ruang calon dan pengesahan PB Negeri. Nama helaian dan PB Negeri menjadi Pahang.
Tahun tajuk mengikut tahun dipilih. Nama dan No. KP datang daripada permohonan,
bukan senarai pengadil berdaftar tahunan. No. KP disimpan sebagai teks.
Tarikh lahir dikira daripada MyKad yang sah; umur ialah tahun peperiksaan tolak
tahun lahir, mengikut kaedah umur dalam templat asal. MyKad tidak lengkap atau
tarikh tidak sah menghasilkan tarikh lahir/umur kosong. Formula asal yang
menghasilkan `#VALUE!` pada baris kosong tidak disalin ke eksport.

Angka giliran, tandatangan dan ruang pengesahan dibiarkan kosong. Setiap tambahan
50 calon menggunakan helaian baharu dengan logo dan format sama. Kawasan cetak
ditetapkan pada borang sebenar A1:G64, bukannya ratusan baris kosong dalam fail asal.

Tiada perubahan API, pangkalan data atau aliran kelulusan. Data menggunakan
senarai permohonan yang sudah dibekalkan oleh endpoint Admin yang sedia ada.

Semakan: `cd cloudflare && node tests/fam-class-one-export.mjs` dan
`cd frontend && npm run build:prod`.
