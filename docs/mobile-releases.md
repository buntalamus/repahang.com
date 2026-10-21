# Changelog pengguna untuk setiap kemas kini mobile

Setiap keluaran mesti mempunyai catatan perubahan dalam Bahasa Melayu di `cloudflare/src/mobile-release-notes.json`. Ini sumber yang dipulangkan oleh `/api/mobile-version.php` dan dibaca oleh popup app. `docs/CHANGELOG.md` kekal sebagai rekod teknikal.

Setiap entri mempunyai `release_version` termasuk nombor build, `patch` (0 untuk APK native baharu), `date` dan senarai `changes`. Terangkan perubahan yang dapat dilihat pengguna. Simpan entri lama. Catatan bagi patch yang belum dimuat turun tidak ditunjukkan oleh app.

## Urutan keluaran

1. Semak nombor patch seterusnya dengan Shorebird. Tulis catatan tepat sebelum commit.
2. Jalankan `npm run test:mobile-release-notes` dan `npm run typecheck` dalam `cloudflare`, serta ujian `test/update_notes_test.dart` dalam `mobile`.
3. Commit/push dan deploy Worker yang membawa catatan tersebut.
4. Dalam `mobile`, jalankan `python3 tool/check_release_notes.py 1.3.0+7 --next-patch --live`. Ia berhenti jika catatan tiada atau belum sepadan dengan production. Untuk APK native gunakan versi sebenar dan `--patch 0 --live`.
5. Terbitkan patch melalui Shorebird, kemudian sahkan nombor patch dan saluran stable. Jangan terbitkan dua patch serentak untuk release yang sama.
6. Semak popup dan versi production. Mobile web menerima build baharu melalui deployment web.

`tool/publish_patch.sh` turut menghantar broadcast kepada pengguna. Tanpa arahan menghantar broadcast, jalankan pemeriksaan changelog dan arahan Shorebird secara berasingan.

## Paparan

Popup daripada sepanduk/notifikasi dan Profil menggunakan komponen changelog yang sama. Ia membaca nombor patch semasa dan patch yang benar-benar dimuat turun daripada Shorebird. Jika pengguna melangkau patch, entri yang tersedia dalam julat tersebut dipaparkan. Popup APK menggunakan catatan release native sasaran sahaja.

Jika rangkaian gagal atau catatan belum tersedia, popup menyatakan keadaan sebenar dan menyediakan **Cuba lagi**. Pengguna masih boleh mula semula. Senarai panjang boleh ditatal.

App yang masih menggunakan kod popup lama tidak boleh memaparkan changelog sebelum memasang kemas kini pertama yang menambah sokongan ini. Selepas sokongan dipasang, popup kemas kini seterusnya memaparkan catatan. Jangan mendakwa popup versi lama sudah berubah hanya kerana Worker telah dideploy.
