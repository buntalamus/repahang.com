# Muat turun Master Data Pengguna

Menu **Admin → Pengguna → Muat Turun Master Data** menghasilkan fail XLSX
bertarikh daripada data semasa. Carian, penapis peranan/jenis dan halaman
senarai tidak mengehadkan eksport. Semua akaun aktif dan tidak aktif termasuk.
Tahun pada menu hanya menentukan lajur status tahunan dalam Master Pengguna;
rekod sejarah tetap merangkumi semua tahun.

## Kandungan dan bentuk jadual

- **Master Pengguna:** satu baris setiap akaun, identiti, hubungan, peranan,
  persatuan/daerah pentadbiran, alamat, pekerjaan, waris, kelayakan, saiz baju,
  Telegram, rujukan gambar, tarikh akaun/log masuk dan status tahunan.
- **Pendaftaran:** semua permohonan dan jenis borang, termasuk keputusan ujian,
  kehadiran seminar, bayaran/resit, pengakuan, semakan PP/Admin dan salinan profil
  dalam permohonan. Profil sejarah tidak digantikan dengan profil semasa.
- **Permohonan PP / ujian lama / butiran penilai:** rekod sumber berasingan,
  jika ada, tanpa menggabungkan atau membuang ID asal.
- **Rekod Perlawanan, Lantikan, Pool Kejohanan:** semua rekod berkaitan akaun
  pengguna, termasuk status/jawapan dan konteks perlawanan bagi lantikan.
- **Laporan RA, Markah Pegawai, Pengesahan Laporan, Pengesah Kejohanan:** rekod
  laporan dan setiap pegawai berasingan. RA ialah penyedia laporan; pegawai
  dinilai ialah rekod lain. KUP kekal R/AR1/AR2/Pegawai Keempat.
- **Penilaian/krew perlawanan lama:** disertakan apabila sumber lama berisi.
- **Panduan:** skop, masa jana, tahun status, jumlah rekod dan maksud setiap
  helaian. Sumber kosong disenaraikan dengan jumlah sifar, tanpa helaian kosong.
- **Kamus Medan:** butiran, kumpulan dan jenis data, termasuk medan sumber kosong
  supaya format rujukan lengkap boleh disemak.

Setiap helaian data menggunakan Excel Table sebenar dengan penapis, jalur
baris, tajuk hitam/putih, aksen kuning Pahang, fon Arial dan lebar lajur yang
ditetapkan. Lima baris atas dan tiga lajur identiti dibekukan. ID Pengguna
menghubungkan helaian; ID rekod asal dikekalkan. Nilai sifar berbeza daripada
sel kosong. IC, telefon, poskod, Telegram dan ID menggunakan teks; nilai yang
bermula `=`/`+`/`@` tidak dijadikan formula. Tarikh sah ialah nilai Excel,
amaun RM dua perpuluhan. Tarikh tanpa zon masa mengekalkan jam asal; tarikh
berzon nyata ditukar ke Malaysia. Nilai tarikh tidak sah kekal sebagai teks.

## Skop akses dan ketepatan

Endpoint `GET /api/admin-users-master-data.php?year=2026` hanya untuk Admin.
Profil/rekod perniagaan dipilih melalui allowlist. Kata laluan, token
Telegram/lantikan/reset, sesi, kunci Worker, rekod penghantaran semula dan log
teknikal tidak dieksport. Pengadil luar tanpa akaun pengguna kekal di modul
Pengadil Luar; pegawai luar dalam laporan RA boleh muncul sebagai rekod berkaitan
tanpa ID Pengguna. Rekod sejarah yang merujuk pengguna tiada lagi dikekalkan
dengan ID asal dan nama profil semasa kosong.

API tidak menyimpan salinan eksport. Respons `private, no-store`. Klasifikasi
status tahunan menggunakan SQL yang sama dengan menu Pengguna. Data utama,
klasifikasi dan rekod anak dibaca dalam satu D1 batch transaksi. Tiada query
berulang bagi setiap pengguna. Semakan jumlah awal dan had 60,000 rekod/40 MiB
JSON membatalkan eksport jika terlalu besar; tiada pemotongan senyap.
Had satu sel Excel 32,767 aksara juga membatalkan fail dengan mesej jelas.

ExcelJS dimuatkan hanya apabila pengguna menekan muat turun, kemudian fail
dijana dalam pelayar. Tiada emel dihantar dan tiada perubahan rekod pengguna.
Sumber kosong tidak direka menjadi data contoh. Ujian fail menggunakan salinan
snapshot peribadi; bukti production mesti daripada butang dan data langsung.

## Validasi dan pelepasan

```sh
node --no-warnings cloudflare/tests/user-master-data.mjs
node --no-warnings cloudflare/tests/user-master-workbook.mjs
node --no-warnings cloudflare/tests/referee-audit.mjs
node --no-warnings cloudflare/tests/annual-licensing.mjs
npm run typecheck --prefix cloudflare
npm run build:prod --prefix frontend
```

Ujian API mengesahkan 401/403, semua akaun/tahun, sumber sejarah, kebebasan
penapis, tiada kolum rahsia dan padanan status tahunan. Ujian XLSX membaca
semula fail, memeriksa baris pertama/tengah/akhir bagi setiap medan, jadual,
penapis, freeze panes, gaya, jenis sel, sifar awal dan teks seperti formula.
Ia juga menguji pengguna kosong, tarikh tidak sah/berzon dan teks terlebih had.

Tiada migration DB diperlukan. Lepaskan hanya fail ciri ini daripada checkout
bersih; perubahan daerah/negeri pasukan yang masih belum dilepaskan tidak
termasuk. Cloudflare Builds menggunakan lockfile frontend yang dikemas kini.
Build mungkin memaparkan amaran bajet bundle awal sedia ada dan amaran CommonJS
ExcelJS; library Excel berada dalam chunk yang hanya dimuatkan untuk eksport.

Hasil semakan peribadi diletakkan dalam `output/cloudflare/master-data-qa/`
(Git-ignored). Jangan commit fail XLSX/JSON yang mengandungi data pengguna.
