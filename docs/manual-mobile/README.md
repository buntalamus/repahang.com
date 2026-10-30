# Manual aplikasi mobile RefPahang

Edisi 20 Oktober 2026. Manual PDF dalam Bahasa Melayu mempunyai 54 halaman, 46 tangkapan skrin, kod QR pemasangan, kandungan boleh klik dan penanda buku PDF.

## Fail

- PDF akhir: `output/pdf/Manual_Lengkap_Aplikasi_Mobile_RefPahang.pdf`
- Sumber bacaan dan suntingan: `docs/manual-mobile/Manual_Aplikasi_Mobile_RefPahang.md`
- Kandungan utama untuk penjanaan: `docs/manual-mobile/content.py`
- Penjana PDF dan Markdown: `docs/manual-mobile/build.py`
- Perakam tangkapan skrin: `mobile/tool/manual_capture.dart`
- Imej aplikasi dan indeks rajah: `output/manual-mobile/screenshots/` dan `output/manual-mobile/screenshot-index.json`
- Semakan penghasilan: `output/manual-mobile/verification.json`

Sunting `content.py` dan jana semula; Markdown ialah keluaran penjana. Fail PDF dan imej dalam `output/` diabaikan Git mengikut konfigurasi repositori sedia ada.

## Jana semula

Keperluan: Flutter repositori, Python dengan reportlab dan Pillow, serta Poppler untuk semakan visual.

Dari direktori `mobile`:

```sh
flutter test --update-goldens tool/manual_capture.dart
```

Untuk merakam empat keadaan kad notifikasi web (widget asal dengan keadaan kebenaran contoh), dari akar repositori jalankan `python3 docs/manual-mobile/prepare_notification_capture.py`, kemudian dari `mobile` jalankan `flutter test --update-goldens tool/_manual_notification_capture.dart`. Fail Dart terjana itu boleh dibuang selepas rakaman; ia tidak mengubah kod aplikasi.

Dari akar repositori:

```sh
python3 docs/manual-mobile/build.py
pdftoppm -scale-to 1400 -png output/pdf/Manual_Lengkap_Aplikasi_Mobile_RefPahang.pdf tmp/manual-mobile/render/page
```

Tarikh fixture ialah 20 Oktober 2026. Untuk edisi baharu, kemas kini tarikh data contoh, versi dan kandungan dahulu, kemudian rakam semula serta semak semua halaman. Render lama bukan bukti versi baharu.

## Asas ketepatan

Menu dan tindakan dirujuk terus kepada `mobile/lib/screens/`, pengesahan sesi dan peranan dalam `mobile/lib/api.dart`, `updater.dart`, `push.dart`, borang Angular dan pengendali Cloudflare yang berkaitan. Pautan APK, aplikasi web dan respons `/api/mobile-version.php` diperiksa secara baca sahaja pada produksi.

Semua 46 ilustrasi dalam PDF ialah render widget sebenar menggunakan respons API contoh. Interceptor ujian menyelesaikan setiap permintaan di dalam proses; ia tidak menerima lantikan, meluluskan pemohon, menghantar Telegram, mengubah rekod, atau menghantar laporan pada produksi. Label data contoh dicetak pada setiap rajah.

Prosedur pemasangan sistem operasi diterangkan melalui teks dan pautan dokumentasi primer Android, Apple dan WebKit. Manual tidak mendakwa mempunyai tangkapan tetapan iPhone atau semua jenama Android sebenar. Build iOS native tidak diiklankan oleh respons pelayan; panduan iPhone ialah aplikasi web di skrin utama.

## Semakan dan had

- 8 senario perakam asas lulus: login, Pengadil, Admin, PP Daerah, semakan PP, Penilai, borang rekod, dan notifikasi.
- 2 senario tambahan kad notifikasi lulus: Aktifkan bertukar kepada Notifikasi aktif, serta kad disekat dan perlu pemasangan. Pengawal web diaktifkan hanya dalam salinan widget untuk rakaman VM; respons kebenaran dan langganan ialah fixture. Ini bukan ujian pemberian kebenaran OS sebenar.
- 54 halaman dirender dan diperiksa secara visual; penjana menolak teks atau jadual yang melimpah ke footer.
- Nombor halaman, rajah, destinasi kandungan, pautan dan kedudukan objek diperiksa dalam fail akhir.
- Ini pengesahan dokumentasi dan paparan; bukan ujian penghantaran transaksi pada produksi atau ujian semua peranti.
- Semasa meneroka paparan, membuka borang Tambah perlawanan melalui HomeShell dalam ujian debug mencetuskan assertion tag Hero berganda pada FloatingActionButton. Paparan borang manual dirakam secara berdiri sendiri menggunakan widget yang sama. Tiada pembaikan kod aplikasi dibuat dalam tugasan manual ini. Tingkah laku release tidak disahkan daripada assertion debug tersebut.

Tiada commit, push atau penerbitan portal dilakukan untuk tugasan ini.

Pindaan selepas semakan pengguna: halaman 24 hingga 27 kini khusus kepada pengaktifan notifikasi dan semakan penerimaan. Empat tangkapan kad tambahan menyatakan keadaan contoh, bukan dialog sistem telefon.
