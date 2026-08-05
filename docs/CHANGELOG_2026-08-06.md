# Changelog - 6 Ogos 2026

## Notifikasi Lantikan Pengadil

- Menu baharu **Notifikasi Lantikan** ditambah pada sidebar dan Dashboard Pengadil.
- Laluan baharu: `/pengadil/notifikasi-lantikan`.
- Laluan lama `/pengadil/tugasan` masih disokong untuk pautan sedia ada.
- Pengadil boleh melihat nama dan jawatan pegawai lain yang dilantik dalam perlawanan sama, tanpa maklumat peribadi atau nombor telefon.
- Paparan menyokong status `Belum Jawab`, `Diterima`, `Ditolak`, `Dibatalkan`, dan `Ditangguhkan`.

## Pembatalan Dan Penangguhan Perlawanan

- Admin boleh membatalkan atau menangguhkan perlawanan secara individu atau pukal.
- Sebab pembatalan atau penangguhan adalah wajib dan dihadkan kepada 500 aksara.
- Rekod lantikan tidak lagi dipadam; status, sebab, dan masa kemaskini disimpan untuk rujukan dashboard dan audit.
- Semua pegawai dilantik menerima makluman melalui notifikasi portal, Telegram, dan e-mel.
- Mesej Telegram dan e-mel membezakan pembatalan daripada penangguhan serta memaparkan sebab yang diberi admin.

## Penilaian RA Untuk Pasukan KUP

- Ahli KUP dalam lantikan yang sama boleh melihat laporan RA lengkap untuk semua pegawai perlawanan.
- Kawalan akses server memastikan hanya pegawai KUP yang tersenarai boleh membuka atau memuat turun laporan.
- Cetakan laporan ditambah skala markah berwarna, tajuk jadual yang lebih jelas, dan nota tahap kesukaran.

## Kebolehpercayaan Jawapan Lantikan

- Jawapan melalui pautan e-mel kekal berjaya walaupun notifikasi sampingan gagal dihantar.
- Jawapan melalui pautan e-mel kini turut memaklumkan Admin, PP Daerah, dan portal pengadil.
- Tarikh jawapan lantikan auto-tolak direkod pada deadline sebenar untuk audit yang tepat.

## Migrasi Wajib

Jalankan sebelum deploy:

```bash
mysql -u USERNAME -p NAMA_DATABASE < docs/migration_status_perlawanan_lantikan.sql
```

Migrasi ini menambah status `Dibatalkan` dan `Ditangguhkan`, sebab status, serta masa kemaskini pada jadual `lantikan_pengadil` dan `jadual_perlawanan`.

## Build Deploy

Pakej deploy telah dibina:

`deploy/refpahang-deploy-20260806-002441.zip`

Build Angular berjaya. Amaran bajet bundle masih wujud: $506.52\text{ kB}$ berbanding had $500\text{ kB}$, tetapi tidak menghalang build atau deploy.