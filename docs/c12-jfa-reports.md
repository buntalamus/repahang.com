# C12 rasmi JFA dalam RefPahang

Tab Admin **Lantikan Pengadil → Laporan Perlawanan** memaparkan C12 dan C13 rasmi. Pengadil utama yang menerima lantikan mempunyai pautan C12 pada dashboard dan Tugasan. Halaman C13 yang dibuka melalui handoff aplikasi juga menyediakan C12 rasmi.

Paparan Admin menggunakan satu baris bagi setiap ID perlawanan dengan kolum **Bil, Nama perlawanan, Padang, Masa, C12, C13**. Semua salinan rasmi yang tersedia dikekalkan dalam kolum borang masing-masing; borang yang tiada ditanda **Belum tersedia**. Padang dipadankan daripada jadual RefPahang menggunakan kedua-dua `fixture_id` dan `tournament_id`. Masa dipaparkan mengikut Malaysia (UTC+8).

Pautan Admin menggunakan `mode=preview` untuk PDF inline di tab baharu dan `mode=download` untuk lampiran. Kedua-duanya mengekalkan kandungan serta nama fail PDF rasmi dan semakan akses sedia ada.

Kontrak sedia ada `/api/jfa-c13.php` dikekalkan bagi keserasian sesi web dan handoff aplikasi. Bacaan C12 menggunakan `form=C12&match=...&document=...`; Admin menambah `view=admin`. Semua permintaan melalui service binding `JFA_C13_SERVICE`. JFA menyemak semula kuasa Admin atau lantikan diterbitkan/diterima; mengetahui ID dokumen sahaja tidak memberi akses.

Respons senarai Admin menambah `data.c12Records`; pautan R menambah metadata `c12`. Draf kosong dan C12 yang tidak lagi sepadan dengan publication rasmi tidak dipaparkan. Tiada perubahan kepada borang/penghantaran C13, keputusan, jadual atau data lantikan RefPahang.

Penghantaran e-mel PDF dikendalikan oleh JFA daripada `urusetia@jerantut-fa.my`, kepada Admin aktif dan R berkenaan, dengan arkib, semakan akses semasa, cubaan semula dan edisi pembetulan. Pelaksanaan serta migrasi 0085 berada dalam repositori JerantutFA.

Pengesahan: Worker typecheck dan ujian `test:jfa-c13`; frontend production build; `tests/jfa-c13-browser.mjs` pada 390/1280px dengan axe. Fixture menguji kedua-dua pautan C12/C13 tanpa akaun atau penghantaran production.
