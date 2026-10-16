# Buku alamat sistem dan blast emel

Peti Emel → **Buku alamat & blast** membaca pengguna dan kenalan manual
secara automatik apabila dibuka. **Imbas semula alamat** mengambil perubahan
terkini tanpa menyalin alamat pengguna ke jadual kenalan manual.

## Kumpulan

- Semua pengguna sistem; akaun dinyahaktif dikecualikan secara lalai dan boleh disertakan.
- PP Daerah; RA/Penilai; Admin. Seseorang boleh memenuhi lebih daripada satu peranan.
- Pengadil berdaftar: permohonan tahunan pengadil diluluskan untuk tahun dipilih.
- Semua pengadil; profil Kelas III FAM, Kelas I FAM, Negeri, Kebangsaan.
- Lulus Kelas III / Kelas I: keputusan ujian, berasingan daripada kelas profil.
- Pengadil tidak aktif: pernah diluluskan tahun terdahulu, belum diluluskan tahun dipilih.
- Memohon tahun dipilih tetapi belum diluluskan. Ini termasuk permohonan ditolak;
  label ini tidak bermaksud semuanya masih menunggu tindakan.
- Kenalan disimpan manual, berasingan daripada semua pengguna sistem.

Tahun mempengaruhi status tahunan; kelas profil dan kelulusan ujian ialah
rekod profil/sejarah. Daerah mengikut persatuan pengguna. Daerah, status
akaun dan pengecualian individu digabungkan dengan pilihan kumpulan.
Kumpulan digabung menggunakan OR; alamat dinormal dan dinyahganda selepas
penapisan. Alamat tidak sah diketepikan. API hanya mendedahkan medan buku
alamat kepada Admin, tanpa IC, telefon, kata laluan atau token pengguna.

## Semakan dan penghantaran

1. Pilih kumpulan, tahun/daerah jika perlu, dan nyahpilih penerima tertentu.
2. Pilih satu daripada lima penghantar rasmi, isi tajuk dan mesej.
3. **Semak blast** menyimpan draf atomik bersama senarai penerima dan mesej.
   Maksimum 5,000 penerima; langkah ini tidak menghantar emel.
4. **Sahkan & jadualkan** hanya boleh dilakukan oleh Admin pencipta draf.
   Senarai semakan tidak dikembangkan semula jika data pengguna berubah.
5. Cron sedia ada setiap lima minit memproses sehingga 10 emel, berkongsi
   lease dan sela lima minit antara semua kempen. Maksimum giliran blast
   ialah 120/jam; penghantaran transaksi lain tidak menggunakan bajet ini
   dan masih tertakluk kepada had keseluruhan pembekal SMTP.
6. Setiap emel mempunyai satu penerima, tanpa CC/BCC; salinan EML disimpan
   dalam Dihantar. Semua Admin boleh memantau dan membatalkan giliran.

Pembatalan menghentikan penerima menunggu. Emel sedang diproses boleh selesai.
Draf boleh dibuka semula melalui **Semak draf**. **Ubah pilihan / kandungan**
membatalkan draf lama dan memerlukan semakan baharu.

Kejayaan bermaksud SMTP menerima emel, bukan bukti emel dibaca atau sampai
ke inbox. Penolakan SMTP jelas atau kegagalan sebelum SMTP ditanda gagal
untuk cubaan semula manual. Timeout/putus sambungan selepas penghantaran
bermula atau kegagalan merekod penerimaan ditanda belum pasti, tanpa cubaan
semula automatik. Proses terhenti ditanda belum pasti selepas 20 minit.
Jangan menghantar semula status belum pasti sebelum semakan pembekal.

## Operasi

- Migrasi `0023_mailbox_campaigns.sql` diperlukan sebelum Worker baharu.
- API: `/api/admin-mail-campaigns.php`, Admin sahaja; POST dilindungi
  same-origin, suis penulisan, `MAILBOX_SEND_ENABLED` dan `BULK_EMAIL_ENABLED`.
- Tetapan SMTP sedia ada kekal dalam secrets. Tiada kredensial baharu diperlukan.
- `mailbox_campaigns` menyimpan snapshot; `mailbox_campaign_recipients`
  menyimpan status setiap penerima; `mailbox_campaign_dispatch` mengawal lease.
- Ujian: `node --no-warnings cloudflare/tests/mailbox-campaigns.mjs`.
  Ujian menggunakan salinan pangkalan data persendirian dan penghantar olok-olok;
  tiada emel sebenar dihantar.
