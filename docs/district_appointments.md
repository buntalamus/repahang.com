# Lantikan PP Daerah

## Aliran PP

1. Log masuk sebagai **PP Daerah** dan buka **Lantikan Pengadil Daerah**.
2. Dalam tab **Kejohanan**, pilih **Tambah**. Kejohanan PP menggunakan peringkat **Daerah** dan daerah kelolaan akaun ditetapkan oleh pelayan.
3. Pilih kejohanan, tambah pengadil ke **Pool Pengadil Kejohanan**. Senarai hanya memaparkan akaun aktif di bawah persatuan/daerah kelolaan PP. Tiada tab atau fungsi tambah pengadil luar.
4. Tambah jadual secara manual atau melalui pratonton Excel. Isi daerah dan negeri pasukan untuk amaran padanan wilayah.
5. Dalam **Lantikan Pengadil**, pilih perlawanan dan isi R, AR1, AR2; P4/RA mengikut keperluan. Peraturan Telegram, pertindihan masa, jawatan RA/KUP dan perlindungan laporan/sejarah sedia ada terus digunakan.
6. Hantar notifikasi apabila slot wajib lengkap. Pengadil menjawab melalui aliran sedia ada. **Jadual Lantikan** boleh dilihat, disahkan dan dicetak.

Kelolaan menggunakan `COALESCE(NULLIF(users.persatuan_id,0),users.district_id)`, sama dengan skop pengurusan daerah sedia ada. Ia tidak diteka daripada nama atau alamat daerah pengguna. Akaun PP mesti mempunyai persatuan yang sah.

## Pemantauan Admin

**Admin → Lantikan Pengadil** merangkumi kejohanan Admin dan semua PP. Penapis **Pemilik lantikan** membezakan Admin Negeri dengan persatuan daerah. Pencipta kejohanan turut dipaparkan. Admin menggunakan tindakan sedia ada untuk menukar jadual, pool dan lantikan PP, termasuk penggantian. Override penerimaan dan pautan jawapan/borang kekal khusus Admin. Laporan RA dan penetapan Pengerusi kekal dalam pengurusan Admin/penilai sedia ada.

Kejohanan lama kekal milik Admin. Tiada pemindahan kelolaan secara automatik apabila seseorang pencipta ditukar peranan. Daerah kejohanan PP ditetapkan semasa penciptaan dan tidak boleh dipindahkan melalui payload API. Semua PP aktif di bawah persatuan yang sama boleh mengurus kejohanan daerah itu.

## Tiga paparan Jadual Lantikan

Tab **Jadual Lantikan** mempunyai pilihan **Admin sahaja**, **PP sahaja** dan **Kedua-dua lantikan**. Senarai pilihan kejohanan mengikut kelolaan yang dipilih; jadual dan cetakan/PDF menggunakan pilihan yang sama. Pilih kejohanan terus dalam tab ini.

Kelolaan ditentukan oleh `kejohanan.lantikan_persatuan_id`, bukan pengguna yang terakhir mengedit. Semua lantikan kejohanan PP kekal dalam paparan PP walaupun Admin mengganti pengadil atau membuat override. Perubahan peranan pencipta juga tidak memindahkan kelolaan. Admin membetulkan kesilapan lantikan daerah melalui tindakan **Override**; pengurusan daerah kekal pada PP. Tiada pengadil disembunyikan daripada krew kejohanan yang sepadan, dan pengesahan dokumen sedia ada kekal merujuk jadual penuh kejohanan itu.

## Salinan emel

Peristiwa lantikan daerah (lantikan baharu, penggantian, penghantaran notifikasi, pembuangan/pembatalan, jawapan/penolakan automatik dan override penerimaan Admin) mewujudkan salinan makluman untuk **semua PP aktif daerah berkenaan dan semua Admin aktif** yang mempunyai emel. Setiap alamat menerima satu salinan bagi setiap peristiwa. Salinan mengandungi butiran perlawanan, pegawai, tindakan dan pautan portal; ia tidak mengandungi token Terima/Tolak atau token borang penilai.

Penciptaan barisan emel berlaku melalui trigger audit dalam transaksi yang sama. Penghantaran dicuba selepas tindakan API, dengan cron setiap 5 minit sebagai sandaran. Kegagalan dicuba semula dengan sela meningkat sehingga 60 minit. Lease mengelakkan dua pekerja menghantar baris sama serentak. Salinan yang berjaya tidak dihantar semula. Semakan peranan, daerah dan alamat penerima dibuat sekali lagi sebelum menghantar. Seperti SMTP biasa, kegagalan proses selepas pelayan menerima mesej tetapi sebelum rekod berjaya disimpan masih boleh menghasilkan pendua pada cubaan semula.

Penghantaran pengadil sedia ada dan salinan menggunakan SMTP Shinjiru yang telah dikonfigurasi. Salinan lama PP untuk pertandingan Admin kekal; pertandingan PP menggunakan barisan baharu supaya tiada salinan PP berganda daripada dua aliran.

## Penerbitan dan pengesahan

Pelaksanaan lantikan PP ini menyasarkan Worker produksi. PHP legasi tidak menambah akses PP; jangan gunakan pakej PHP sebagai pengganti keluaran Worker ini.

Migrasi tambahan: `0020_match_team_regions.sql` (wilayah pasukan), `0022_district_appointments.sql` (kelolaan dan barisan salinan). `0021_mailbox_imap.sql` bersifat idempoten jika struktur peti emel telah diwujudkan lebih awal.

Ujian: `district-appointments.mjs` menggunakan salinan DB peribadi dan sesi sebenar untuk aliran API, kelolaan tidak boleh dipalsukan, penolakan merentas daerah/bulk, sekatan pengadil luar, perubahan Admin, salinan jawapan, retry/claim serentak dan perubahan kelolaan semasa transaksi. Ujian regresi lantikan, jawapan, Telegram dan amaran wilayah dijalankan berasingan. Emel ujian menggunakan sender simulasi; ia tidak membuktikan salinan lantikan daerah telah sampai ke peti sebenar.

## Rekod perlawanan Admin

Carian kini dilaksanakan sebelum pagination SQL dan meliputi semua rekod. Penapis: daerah, status, tahun, jenis, kejohanan dan julat tarikh; 10/25/50/100 perlawanan setiap halaman. Carian nama/no. IC seorang pegawai memulangkan keseluruhan krew perlawanan. Kad statistik mengikut penapis semasa kecuali status, supaya Admin boleh membandingkan status bagi set yang sama. **Set semula** mengosongkan penapis. Ujian `admin-match-filters.mjs` meliputi carian global, gabungan penapis, krew lengkap dan pagination.
