# Penghantaran e-mel RefPahang melalui SMTP Shinjiru

Perubahan 16 Oktober 2026 mengembalikan e-mel keluar Worker kepada pelayan
Shinjiru sedia ada. Semua aliran berkongsi `sendRefpahangEmail()` dalam
`cloudflare/mail.ts`: lantikan, jawapan/pengesahan, laporan RA, pendaftaran
berserta PDF, tetapan semula kata laluan, onboarding dan Peti Emel Admin.

## Konfigurasi

- Production: `EMAIL_TRANSPORT=legacy-smtp` dalam `wrangler.production.jsonc`.
- SMTP: `mail.refpahang.com`, port `465`, TLS sejak permulaan sambungan.
- Lima identiti sedia ada: `admin`, `daftar`, `lantikan`, `support`, `pengesahan`.
- `SMTP_HOST`, `SMTP_PORT`, dan `MAIL_*_USER/NAME/PASS` ialah Worker secrets.
  Nilainya tidak boleh dimasukkan dalam source, log, laporan atau Git.
- Staging kekal menggunakan pengangkutan Cloudflare melainkan ditetapkan
  secara eksplisit; suis penghantaran staging dan pengalihan penerima ujian
  masih dihormati.

Tiada fallback automatik kepada Cloudflare apabila SMTP gagal. Respons akhir
`250` selepas `DATA` diperlukan sebelum penghantaran ditanda berjaya.
Ralat hanya memaparkan peringkat protokol dan kod respons, tanpa kata laluan
atau kandungan respons pelayan. Sambungan mempunyai had masa keseluruhan
30 saat dan ditutup selepas pengesahan penerimaan. MIME mengekalkan teks,
HTML, nama/subjek Unicode, logo CID dan lampiran PDF.

Peti Emel memberi permintaan penghantaran had masa 45 saat, melebihi had
SMTP 30 saat, supaya pelayan sempat merekodkan hasil sebelum UI berhenti
menunggu. Had lalai permintaan API lain kekal 20 saat.

## DNS

Pada 16 Oktober, hos SMTP yang tiada telah dipulihkan:

```text
A mail.refpahang.com -> 101.99.77.148 (DNS only)
TXT @ -> v=spf1 ip4:101.99.77.130 ip4:101.99.77.148 ip4:101.99.77.160 include:spf.mailsentinel.net include:_spf.mx.cloudflare.net ~all
```

SPF menggabungkan penghantar Shinjiru yang disahkan daripada konfigurasi
asal dengan Cloudflare. Kekalkan hanya satu SPF akar. DKIM lama
`default._domainkey.refpahang.com`, MX masuk Cloudflare dan DMARC sedia ada
dikekalkan. Pengembalian SMTP keluar tidak memindahkan e-mel dalam D1/R2
atau mengubah penghalaan e-mel masuk.

Pada 17 Oktober, SPF akar turut ditambah `ip4:101.99.77.162`, iaitu IP
keluar yang ditunjukkan oleh pemeriksaan Email Deliverability cPanel
(`baboon1.awedns.com`). Semua mekanisme SPF sedia ada dikekalkan.

Pelayan Shinjiru juga mempunyai peti masuk tempatan. E-mel yang dihantar
melalui SMTP kepada alamat dalam domain yang dianggap tempatan oleh cPanel
boleh dihantar ke peti masuk pelayan tersebut. Semak Email Routing cPanel
sebelum mengubah lokasi penerimaan; perubahan ini tidak mengubah tetapan itu.

## Had dan pengesahan

Pakej yang dipaparkan dalam dashboard Shinjiru ialah
`[LEV25A] ECO Premium Linux Plan`. Spesifikasi rasmi menyenaraikan
**200 e-mel sejam** untuk ECO Premium, bukan penghantaran tanpa had:
https://www.shinjiru.com.my/web-hosting/wordpress-web-hosting/

Ujian setempat:

```sh
node --no-warnings cloudflare/tests/legacy-smtp.mjs
npm run typecheck --prefix cloudflare
npm run test:staging-email-redirect --prefix cloudflare
node --no-warnings cloudflare/tests/mailbox.mjs
npm run test:external-telegram-blast --prefix cloudflare
```

Ujian TLS sebenar setempat mengesahkan protokol berbilang baris, lima
penghantar, MIME Unicode, PDF/CID/base64, pengalihan staging, ralat SMTP dan
penolakan suntikan header. Tiada e-mel luar dikirim oleh ujian setempat.

Ujian `application-submit.mjs` sedia ada gagal pada assertion penolakan
kegagalan DB (baris 60); kegagalan yang sama dihasilkan semula pada checkout
bersih `87c8d8a`, sebelum perubahan SMTP. Kod pendaftaran tidak diubah.

## Rollback

Binding `EMAIL` Cloudflare dikekalkan untuk rollback. Tetapkan
`EMAIL_TRANSPORT=cloudflare-email` dan deploy semula versi yang telah diuji
jika perlu. Jangan tukar MX masuk atau memadam secrets SMTP untuk rollback
pengangkutan. Had harian Cloudflare akan terpakai semula.
