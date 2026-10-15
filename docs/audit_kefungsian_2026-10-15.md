# Audit kefungsian RefPahang — 15 Oktober 2026

## Asas data dan takrif

Semakan menggunakan salinan D1 produksi pada 15 Oktober 2026, kod Worker/Angular semasa dan semakan baca sahaja pada domain produksi. Tiada data peribadi disalin ke laporan ini.

- **Pegawai Pembangunan Daerah** ialah peranan pentadbiran daerah yang masih disimpan sebagai kod `PP Daerah`. Akaunnya boleh juga layak sebagai pengadil atau Penilai Pengadil secara berasingan.
- **Penilai Pengadil (Referee Assessor)** ialah peranan penilaian, bukan automatik pengadil. Kod `RA` dalam data lama merujuk kepadanya.
- **Pengerusi Pengadil** ialah pelantikan berasingan untuk mengesahkan laporan penilaian kejohanan. Gelaran ini tidak disamakan dengan Pegawai Pembangunan Daerah.
- **Pengadil Berdaftar** bagi tahun pilihan ialah pemohon tahunan yang diluluskan sebagai pengadil. Bagi 2027 dan seterusnya, status ujian kecergasan mesti `Lulus`.
- **Pengadil Baharu** ialah pengguna pengadil yang belum pernah lulus pendaftaran tahunan dan belum lulus pada tahun pilihan.
- **Pengadil Tidak Aktif** ialah pengguna yang pernah lulus pada tahun terdahulu tetapi belum lulus pendaftaran tahunan pada tahun pilihan. Ini termasuk yang tidak memohon, masih menunggu, atau gagal pada tahun pilihan; status permohonan semasa dipaparkan berasingan.
- **Kelas III FAM** dan **Kelas I FAM** hanya diberi selepas keputusan ujian `Lulus`; kelulusan permohonan peperiksaan sahaja tidak mencukupi.
- **Pengguna** ialah akaun yang pernah diwujudkan, termasuk akaun yang dinyahaktifkan. Status akaun dan status pendaftaran tahunan ialah dua perkara berbeza.

Dalam salinan D1, terdapat 370 akaun, 488 permohonan dan 11,608 rekod perlawanan merentas tahun. Daripada 244 rekod `pengadil_berdaftar` yang diluluskan pada 2026, 219 ialah pengadil, 16 ialah Penilai Pengadil yang tersimpan di bawah kod borang lama, dan sembilan ialah Pegawai Pembangunan. Statistik pengadil tahunan mengambil 219 pengguna pengadil unik. Satu lagi permohonan Penilai Pengadil 2026 menggunakan kod `penilai_berdaftar`, menjadikan 17 permohonan Penilai Pengadil pada tahun itu.

Permohonan 2026 dipisahkan mengikut jenis sebenar:

| Jenis permohonan | Bilangan |
| --- | ---: |
| Pengadil Berdaftar | 219 |
| Penilai Pengadil Berdaftar | 17 |
| Kelas III FAM | 42 |
| Kelas I FAM | 0 |
| Ujian kecergasan lama | 116 |
| Pegawai pembangunan | 9 |

Jumlah 403 merangkumi semua jenis di atas, tetapi kad dan graf menggunakan angka mengikut jenis. Rekod ujian kecergasan lama dan pegawai pembangunan dikekalkan sebagai kategori berasingan.

## Hasil audit dan pembaikan

| Aliran | Semakan / pembaikan | Bukti automatik |
| --- | --- | --- |
| Padam permohonan | Worker melepaskan pautan `perlawanan.permohonan_id` dalam transaksi sebelum memadam permohonan; PHP lama diselaraskan. Rekod perlawanan dan akaun kekal. | `test:referee-audit` memadam permohonan terpaut dalam salinan DB dan membandingkan bilangan perlawanan sebelum/selepas. |
| Nyahaktif pengadil | Endpoint Worker menyahaktif akaun dan membatalkan sesi, tidak memadam sejarah. | Semakan kod laluan `deactivateReferee`. |
| Senarai pengguna | Penapis tahun, pengadil berdaftar/baharu/tidak aktif, Kelas III/I, Penilai Pengadil dan Pegawai Pembangunan; akaun dinyahaktifkan boleh ditunjukkan. | `test:referee-audit` menyemak kelas gagal, pemohon tahun lepas dan Pegawai Pembangunan dengan kelayakan berbeza. |
| Profil pengadil | Rekod perlawanan merentas tahun dikekalkan; penapis tahun dan bilangan rekod ditambah dalam modal serta butiran pengadil berdaftar. | Build Angular dan semakan sumber API yang memulangkan rekod penuh. |
| Statistik dan permohonan | Bilangan pengadil tahunan mengecualikan Penilai Pengadil/Pegawai Pembangunan; empat jenis permohonan mempunyai kad, status, graf dan senarai sendiri. Kod lama Penilai Pengadil dan Kelas III disatukan dengan jenis masing-masing. Rekod perlawanan lantikan turut dikira; “Jumlah Lantikan” mengira baris lantikan dengan status Diterima, Ditolak, Belum Jawab dan Dibatalkan. Metrik Telegram dilabel sebagai semua tahun kerana ia merangkumi semua akaun aktif. | `test:referee-audit` membandingkan hasil API dengan SQL pada salinan D1. |
| Akses Pegawai Pembangunan/Penilai Pengadil/pengadil | Keupayaan pengadil dan Penilai Pengadil dihantar pada sesi. Pegawai Pembangunan yang layak boleh membuka panel yang relevan; Penilai Pengadil sahaja tidak boleh dipilih sebagai KUP perlawanan. | Ujian sesi Pegawai Pembangunan dengan kelayakan pengadil, penilai dan pentadbiran sahaja. |
| Dashboard daerah | Pengadil berdaftar dan permohonan diluluskan dikira mengikut tahun semasa; rekod Pegawai Pembangunan yang bertindak sebagai pengadil termasuk dalam skop daerah. | Typecheck Worker dan ujian peranan. |
| UI | Navigasi berkongsi tema hitam/kuning Pahang; warna hijau/merah/amber masih digunakan untuk menyampaikan status. Responsif Angular dibina untuk produksi. | `npm run build:prod`; paparan admin pengguna dan statistik disemak terus pada domain produksi. |

## Gerbang semakan

- 21 suite ujian Worker lulus, termasuk ujian aliran lantikan, laporan RA, pendaftaran dan audit khusus ini.
- `npm run typecheck` lulus.
- `npm run build:prod` lulus. Amaran saiz awal: kira-kira 514 kB, 14 kB melebihi had konfigurasi 500 kB; build tidak gagal.
- `endpoint_coverage.py` melaporkan 67/67 laluan frontend dan 6/6 laluan awam bukan frontend dipetakan; tiga laluan e-mel pukal hanya diuji dengan penghantaran palsu.
- Paparan pengguna produksi sebelum pemisahan kategori menunjukkan 370 akaun, 333 pengguna pengadil, 16 PP dan 28 RA. Salinan D1 tahun 2026 menunjukkan 219 pengadil berdaftar, 403 permohonan daripada semua jenis, 997 lantikan dan 5,842 rekod perlawanan.
- Semakan langsung bagi akaun PP, RA dan pengadil sebenar belum boleh dibuktikan tanpa sesi peranan tersebut. Ujian peranan dibuat pada salinan D1, bukan dengan mengubah data produksi.

## Risiko dependensi yang ditemui

`npm audit --omit=dev` pada lockfile frontend melaporkan tujuh pakej produksi terjejas: lima tahap tinggi dan dua sederhana. Pakej Angular mempunyai versi pembetulan tersedia, manakala `xlsx` tidak mempunyai pembetulan melalui pakej npm semasa. Audit yang sama pada dependensi produksi Worker melaporkan sifar isu. Perubahan versi pustaka memerlukan semakan serasi dan ujian aliran import/eksport berasingan; penemuan ini tidak menandakan eksploitasi telah berlaku.

## Integrasi pelepasan

Worker produksi menggunakan `cloudflare/wrangler.production.jsonc` dan domain `refpahang.com` serta `www.refpahang.com`. Cloudflare Builds kini disambungkan kepada `buntalamus/repahang.com`, cabang produksi `main`. Arahan build memasang dependensi Worker dan frontend daripada lockfile masing-masing, kemudian membina Angular; arahan deploy menjalankan Wrangler dengan konfigurasi produksi. Preview builds dimatikan. Push baharu ke `main` mencetuskan binaan automatik. Binaan Git `ae41c9bb` berjaya menerbitkan versi Worker `c2cc4d34`; kedua-dua domain, endpoint kesihatan migrasi dan aset Angular disemak selepas deploy. Rahsia Worker kekal dalam Cloudflare dan tidak dimasukkan ke Git.
