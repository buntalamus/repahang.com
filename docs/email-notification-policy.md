# Dasar saluran notifikasi RefPahang

## Emel dahulu

Kategori dipersetujui pada 20 Oktober 2026:

- Akaun baharu, akses pertama, reset/tukar kata laluan, perubahan emel log masuk atau peranan, dan sekatan manual akaun.
- Lantikan rasmi kepada pegawai, penggantian, pembatalan, penangguhan, perubahan tarikh/masa/tempat/pasukan dan pengesahan penerimaan oleh Admin. Penolakan automatik turut mengubah status lantikan dan menggunakan emel dahulu.
- Resit penghantaran permohonan dan keputusan rasmi permohonan/ujian.
- Pautan pengesahan laporan RA kepada Pengerusi. Keputusan laporan rasmi kepada pegawai yang dinilai kekal menggunakan emel.

Penghantar mencuba emel sebelum Telegram bagi penerima dan peristiwa yang sama. Ini tidak bermaksud menjamin mesej telah tiba dalam inbox atau sudah dibaca. Kegagalan emel direkodkan; Telegram/app tetap diteruskan. Jika alamat emel tiada, saluran yang tersedia digunakan tanpa mendakwa emel berjaya.

## Makluman rutin

Salinan pengurusan, perubahan profil biasa, pengesahan rekod, KUP lengkap dan peringatan biasa menggunakan Telegram/app dahulu. Emel hanya sebagai sandaran apabila laluan tersebut tidak tersedia atau cubaan Telegram gagal. Salinan daerah dihadkan kepada PP bagi penolakan; ringkasan mingguan kekal Isnin mulai 08:00 MYT, sekali seminggu apabila ada perkara memerlukan tindakan.

Kewujudan peranti/langganan push digunakan sebagai petunjuk saluran aplikasi bagi makluman rutin, bukan pengesahan penerimaan setiap push. Emel rasmi tidak digugurkan berdasarkan petunjuk ini. ID Telegram sahaja tidak dianggap penghantaran berjaya.

## Batas skop

Sekatan akaun automatik dan pengaktifan semula masih belum mempunyai notis emel khusus. Dua emel bagi aliran lulus kecergasan dan pendaftaran masih berasingan. Penambahan atau penggabungan tersebut ialah perubahan berasingan daripada tertib saluran ini.

## Ujian

`npm run typecheck`, `npm run test:email-policy`, serta `tests/lantikan-write.mjs`, `tests/notify-lantikan.mjs`, `tests/notify-laporan.mjs`, `tests/notify-akaun.mjs`, `tests/appointment-response.mjs`, `tests/appointment-expiry-policy.mjs`. Gunakan penghantar contoh dan salinan DB sementara; jangan menghantar notis sebenar sebagai ujian.
