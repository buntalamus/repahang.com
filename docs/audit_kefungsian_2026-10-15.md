# Audit kefungsian RefPahang — 15 Oktober 2026

## Asas data dan takrif

Semakan menggunakan salinan D1 produksi pada 15 Oktober 2026, kod Worker/Angular semasa dan semakan baca sahaja pada domain produksi. Tiada data peribadi disalin ke laporan ini.

- **PP Daerah** ialah peranan pentadbiran daerah. Akaun PP boleh juga menjadi pengadil atau RA melalui kelayakan akaunnya; PP sahaja tidak menjadikannya RA.
- **RA** ialah Penilai Pengadil, bukan automatik pengadil. Akses RA dan pengadil ditentukan secara berasingan.
- **Pengadil Berdaftar** bagi tahun pilihan ialah pemohon tahunan yang diluluskan sebagai pengadil. Bagi 2027 dan seterusnya, status ujian kecergasan mesti `Lulus`.
- **Pengadil Baharu** ialah pengguna pengadil yang belum pernah lulus pendaftaran tahunan dan belum lulus pada tahun pilihan.
- **Pengadil Tidak Aktif** ialah pengguna yang pernah lulus pada tahun terdahulu tetapi belum lulus pendaftaran tahunan pada tahun pilihan. Ini termasuk yang tidak memohon, masih menunggu, atau gagal pada tahun pilihan; status permohonan semasa dipaparkan berasingan.
- **Kelas III FAM** dan **Kelas I FAM** hanya diberi selepas keputusan ujian `Lulus`; kelulusan permohonan peperiksaan sahaja tidak mencukupi.
- **Pengguna** ialah akaun yang pernah diwujudkan, termasuk akaun yang dinyahaktifkan. Status akaun dan status pendaftaran tahunan ialah dua perkara berbeza.

Pada 2026, terdapat 370 akaun, 488 permohonan dan 11,608 rekod perlawanan dalam salinan D1. Daripada 244 permohonan tahunan `Approved`, 221 ialah pengadil dan 23 ialah RA/pegawai pembangunan. Statistik pengadil tahunan kini mengambil 221 pengguna pengadil unik, bukan semua 244 permohonan.

## Hasil audit dan pembaikan

| Aliran | Semakan / pembaikan | Bukti automatik |
| --- | --- | --- |
| Padam permohonan | Worker melepaskan pautan `perlawanan.permohonan_id` dalam transaksi sebelum memadam permohonan; PHP lama diselaraskan. Rekod perlawanan dan akaun kekal. | `test:referee-audit` memadam permohonan terpaut dalam salinan DB dan membandingkan bilangan perlawanan sebelum/selepas. |
| Nyahaktif pengadil | Endpoint Worker menyahaktif akaun dan membatalkan sesi, tidak memadam sejarah. | Semakan kod laluan `deactivateReferee`. |
| Senarai pengguna | Penapis tahun, pengadil berdaftar/baharu/tidak aktif, Kelas III/I, RA dan PP; akaun dinyahaktifkan boleh ditunjukkan. | `test:referee-audit` menyemak kelas gagal, pemohon tahun lepas dan PP dengan kelayakan berbeza. |
| Profil pengadil | Rekod perlawanan merentas tahun dikekalkan; penapis tahun dan bilangan rekod ditambah dalam modal serta butiran pengadil berdaftar. | Build Angular dan semakan sumber API yang memulangkan rekod penuh. |
| Statistik | Bilangan pengadil tahunan mengecualikan RA/pegawai; rekod perlawanan lantikan turut dikira; “Jumlah Lantikan” kini benar-benar mengira baris lantikan dengan status Diterima, Ditolak, Belum Jawab dan Dibatalkan. Metrik Telegram dilabel sebagai semua tahun kerana ia merangkumi semua akaun aktif. | `test:referee-audit` membandingkan hasil API dengan SQL pada salinan D1. |
| Akses PP/RA/pengadil | Keupayaan pengadil dan RA dihantar pada sesi. PP yang layak boleh membuka panel yang relevan; RA sahaja tidak boleh dipilih sebagai KUP perlawanan. | Ujian sesi PP pengadil, PP RA dan PP pegawai pembangunan. |
| Dashboard daerah | Pengadil berdaftar dan permohonan diluluskan dikira mengikut tahun semasa; rekod PP yang bertindak sebagai pengadil termasuk dalam skop daerah. | Typecheck Worker dan ujian peranan. |
| UI | Navigasi berkongsi tema hitam/kuning Pahang; warna hijau/merah/amber masih digunakan untuk menyampaikan status. Responsif Angular dibina untuk produksi. | `npm run build:prod`; paparan admin pengguna dan statistik disemak terus pada domain produksi. |

## Gerbang semakan

- 21 suite ujian Worker lulus, termasuk ujian aliran lantikan, laporan RA, pendaftaran dan audit khusus ini.
- `npm run typecheck` lulus.
- `npm run build:prod` lulus. Amaran saiz awal: kira-kira 514 kB, 14 kB melebihi had konfigurasi 500 kB; build tidak gagal.
- `endpoint_coverage.py` melaporkan 67/67 laluan frontend dan 6/6 laluan awam bukan frontend dipetakan; tiga laluan e-mel pukal hanya diuji dengan penghantaran palsu.
- Paparan pengguna produksi menunjukkan 370 akaun, 333 pengguna pengadil, 16 PP dan 28 RA. Statistik 2026 menunjukkan 221 pengadil berdaftar, 403 permohonan, 997 lantikan dan 5,842 rekod perlawanan.
- Semakan langsung bagi akaun PP, RA dan pengadil sebenar belum boleh dibuktikan tanpa sesi peranan tersebut. Ujian peranan dibuat pada salinan D1, bukan dengan mengubah data produksi.

## Integrasi pelepasan

Worker produksi menggunakan `cloudflare/wrangler.production.jsonc` dan domain `refpahang.com` serta `www.refpahang.com`. Sebelum audit ini, deployment Worker menunjukkan sumber `Upload`, belum `Git`. Sambungan Git asli Cloudflare memerlukan sambungan GitHub dalam dashboard dan token Builds yang sesuai. Jangan masukkan rahsia Worker ke Git.
