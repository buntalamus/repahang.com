# Peti Emel Shinjiru dalam portal RefPahang

Peti Emel Admin menggabungkan mesej Cloudflare Email Routing sedia ada dengan
salinan folder IMAP Shinjiru bagi `admin`, `daftar`, `lantikan`, `support` dan
`pengesahan`. Paparan, balasan, muat turun EML dan penghantaran SMTP kekal di
menu **Admin → Peti Emel**. Buku alamat dikongsi antara Admin sahaja.

## Penggunaan

1. Pilih alamat dan folder. Folder sebenar Shinjiru disenaraikan selepas
   penyegerakan pertama, termasuk Draf, Spam, Sampah, Arkib dan folder tersuai.
   Peti Masuk turut mengandungi sejarah Cloudflare; Dihantar menggabungkan
   sejarah penghantaran portal dengan folder Sent pelayan.
2. **Muat semula** membaca salinan portal. **Segerak Shinjiru** membawa masuk
   kumpulan seterusnya bagi folder dipilih. Mesej terkini diberi keutamaan;
   sejarah lama dibawa masuk berperingkat.
3. **Tulis emel** atau **Balas** menggunakan SMTP Shinjiru sedia ada. Folder
   Dihantar portal menyimpan penghantaran portal; tiada IMAP APPEND ke Sent
   Shinjiru. Tiada penghantaran emel tambahan semasa penyegerakan IMAP.
4. **Buku alamat** membolehkan tambah, cari, sunting dan padam kenalan (maksimum
   2,000). Kenalan boleh dipilih pada medan Kepada atau melalui **Tulis emel**
   pada senarai kenalan. Penghantar mesej juga boleh disimpan sebagai kenalan.

## Semantik salinan

IMAP menggunakan TLS port 993, `EXAMINE` dan `BODY.PEEK[]`. Ia tidak memadam,
memindahkan atau mengubah status dibaca di Shinjiru. Status dibaca portal
berasingan. Mesej yang kemudian dipadam/dipindahkan di pelayan kekal sebagai
salinan portal. Draf pelayan boleh dibaca; penyuntingan draf, pemindahan folder,
pemadaman emel pelayan serta penyegerakan dua hala tidak termasuk perubahan ini.

MIME asal dan lampiran disimpan dalam R2 peribadi, indeks dalam D1. ID stabil
daripada alamat/folder/hash MIME mengelakkan salinan berulang semasa retry atau
UIDVALIDITY berubah. UIDVALIDITY dan cursor diasingkan mengikut akaun/folder.
Cursor hanya maju selepas R2 dan D1 berjaya; kegagalan boleh dicuba semula.
Mesej melebihi 25 MiB tidak dimuat turun dan status dipaparkan untuk dibaca
melalui webmail. Folder yang tiada lagi di pelayan masih mengekalkan sejarah
portal; penyegerakan manual folder itu akan melaporkan kegagalan.

## Konfigurasi dan pelepasan

- Jalankan **hanya** `cloudflare/migrations/0021_mailbox_imap.sql` untuk perubahan
  ini sebelum deploy. Ia menambah empat jadual, tanpa mengubah/memadam mesej lama.
  Jangan gunakan apply semua migration jika perubahan lain belum sedia.
- Production: `MAILBOX_IMAP_ENABLED=1` dan `STAGING_WRITES_ENABLED=1`.
- Hos menggunakan `IMAP_HOST` jika ditetapkan, selainnya secret `SMTP_HOST`.
  Lima `MAIL_*_USER/PASS` sedia ada dikongsi; kata laluan tidak dihantar ke UI.
- Cron lima minit menyemak Peti Masuk dan satu folder lain setiap akaun.
  Folder lain digilirkan mengikut masa semakan paling lama. Setiap folder
  membawa maksimum 10 mesej/kumpulan, range carian maksimum 1,000 UID.
- Lock 180 saat, jarak permintaan minimum 20 saat/folder, had sesi TLS 60 saat,
  had bacaan protokol 10 saat. Kegagalan satu akaun tidak menghentikan akaun lain.
- MX masuk Cloudflare dan SMTP keluar Shinjiru tidak diubah oleh integrasi ini.
- Hentikan sync: `MAILBOX_IMAP_ENABLED=0` dan deploy semula. Folder cache masih
  boleh dibaca dan kekal berasingan. Jangan padam jadual, objek R2 atau mailbox
  Shinjiru. Versi Worker sebelum integrasi tidak mengenali folder cache baharu,
  jadi gunakan suis ini untuk rollback sambungan selepas import bermula.

## Pengesahan

```sh
node --no-warnings cloudflare/tests/imap-mailbox.mjs
node --no-warnings cloudflare/tests/mailbox.mjs
node --no-warnings cloudflare/tests/legacy-smtp.mjs
npm run typecheck --prefix cloudflare
npm run build:prod --prefix frontend
```

Ujian TLS tempatan meliputi literal MIME/binari berpecah, metadata, folder,
penggunaan baca sahaja, penolakan autentikasi/saiz, cursor, kegagalan R2,
recovery tanpa pendua, UIDVALIDITY, pengasingan folder dan akses Admin,
serta CRUD buku alamat. Gunakan mesej ujian sedia ada untuk bukti langsung;
jangan hantar emel kepada penerima luar semata-mata untuk ujian ini.
