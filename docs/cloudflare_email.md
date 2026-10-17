# Emel RefPahang melalui Cloudflare

Mulai 17 Oktober 2026, Cloudflare ialah perkhidmatan emel utama untuk semua
aliran portal mengikut arahan pengguna. `cloudflare/wrangler.production.jsonc`
menetapkan `EMAIL_TRANSPORT=cloudflare-email` dan binding `EMAIL` membenarkan:

- `admin@refpahang.com`
- `daftar@refpahang.com`
- `lantikan@refpahang.com`
- `support@refpahang.com`
- `pengesahan@refpahang.com`

## Penghantaran

Semua laluan Worker menggunakan `sendRefpahangEmail()` dalam
`cloudflare/mail.ts`, termasuk pembalut `sendEmail()` dalam
`cloudflare/src/php/email.ts`. Ini meliputi lantikan dan jawapan pengadil,
salinan daerah, laporan RA, pendaftaran dan PDF, kelulusan, pengesahan rekod,
tetapan semula kata laluan, onboarding, kempen emel dan Peti Emel Admin.
Tiada fallback automatik kepada SMTP Shinjiru.

Dashboard Cloudflare pada 17 Oktober menunjukkan kuota akaun **1,500 emel
sehari**. Kuota ini dikongsi oleh domain dalam akaun tersebut; ia bukan
1,500 bagi setiap alamat RefPahang. Penghantaran kempen kekal berperingkat.
Semak dashboard untuk had semasa sebelum kempen besar.

Penerimaan penyedia dan penerimaan sebenar ialah dua perkara berbeza.
Peti Emel merekodkan hasil penyedia; ujian pemulihan perlu turut mengesahkan
mesej muncul di peti penerima luar, termasuk SPF, DKIM dan DMARC.
Permintaan penghantaran UI diberi 45 saat; permintaan API biasa kekal 20 saat.

## Penerimaan dan sejarah

MX domain menggunakan `route1/2/3.mx.cloudflare.net`. Lima alamat rasmi
dipautkan kepada Email Worker `refpahang`. MIME asal dan lampiran emel
masuk disimpan dalam R2 peribadi, dengan indeks dalam D1, dan dibaca melalui
Admin → Peti Emel.

Salinan sejarah Shinjiru dalam D1/R2 dikekalkan. Penyegerakan IMAP sedia ada
ialah bacaan sejarah sahaja dan tidak menghantar emel; ia tidak menentukan
pengangkutan emel baharu. Jangan memadam peti lama atau secrets IMAP ketika
sejarah lama masih diimport. Lihat `docs/mailbox_shinjiru.md` untuk semantik
salinan dan had import.

## Pengesahan produksi 17 Oktober 2026

Versi Worker aktif selepas pertukaran pengangkutan:
`b71ba42f-f5e9-43fd-8019-2cad2050324a`.

| Alamat | Penghantaran luar | SPF / DKIM / DMARC | Penerimaan portal |
| --- | --- | --- | --- |
| admin@refpahang.com | Gmail Inbox | pass / pass / pass | diterima |
| daftar@refpahang.com | Gmail Inbox | pass / pass / pass | diterima |
| lantikan@refpahang.com | Gmail Inbox | pass / pass / pass | diterima |
| support@refpahang.com | Gmail Inbox | pass / pass / pass | diterima |
| pengesahan@refpahang.com | Gmail Inbox | pass / pass / pass | diterima |

Lima mesej keluar menggunakan rujukan `CF20261017` dan dihantar kepada
peti Gmail pemilik sahaja. Gmail mengesahkan Return-Path
`bounces@cf-bounce.refpahang.com` dan tandatangan DKIM `cf-bounce` bagi domain
`refpahang.com`, serta DKIM Cloudflare. Mesej masuk
`CF20261017-INBOUND-05` direkodkan sebagai `received` untuk lima alamat
dalam D1, dengan MIME disimpan dalam R2. cPanel lama memaparkan
`No Cron Jobs`, jadi tiada cron cPanel yang perlu dipindahkan atau dihentikan.

Pemeriksaan setempat yang lulus: build produksi Angular, typecheck Worker,
ujian mailbox (termasuk idempotensi) dan pengalihan emel staging.

## Kejadian 17 Oktober

- Spamhaus mengesahkan pembuangan `refpahang.com` daripada DBL selepas
  pengesahan `admin@refpahang.com`, rujukan `ST7273340`.
- Relay Shinjiru masih memulangkan `451 Your account has been locked`
  dalam ujian sebenar. Kes sokongan telah dihantar kepada Shinjiru.
- SPF ditambah IP keluar Shinjiru yang ditunjukkan cPanel, `101.99.77.162`,
  sebelum pertukaran kekal. cPanel kemudian menandakan SPF, DKIM, DMARC dan
  PTR sebagai sah. Rekod sedia ada dipelihara untuk peralihan dan sejarah.
- Jangan menghantar semula notis lantikan lama secara pukal: semak status
  serta kesesuaian tarikh terlebih dahulu. Menukar pengangkutan tidak
  memindahkan atau membatalkan queue yang telah diterima pelayan Shinjiru.
