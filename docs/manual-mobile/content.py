"""Kandungan manual pengguna RefPahang dalam Bahasa Melayu.
Setiap entri ialah satu halaman tetap. Data contoh hanya digunakan untuk ilustrasi UI.
"""
PAGES=[]
def page(chapter,title,blocks,shot=None,shots=None,caption=None):
    PAGES.append(dict(chapter=chapter,title=title,blocks=blocks,shot=shot,shots=shots,caption=caption))
def h(s): return ('h',s)
def p(s): return ('p',s)
def s(s): return ('s',s)
def n(s): return ('n',s)
def table(headers,rows): return ('table',[headers]+rows)

page('Mula di sini','Panduan pantas pengguna baharu',[
 p('RefPahang menghubungkan urusan pengadil, penilai dan pengurusan PBNP melalui akaun yang sama seperti portal refpahang.com. Gunakan manual ini mengikut peranan akaun anda.'),
 h('Lima langkah pertama'),
 s('Pasang APK rasmi pada Android atau tambah https://refpahang.com/app/ ke skrin utama iPhone.'),
 s('Buka RefPahang dan log masuk menggunakan emel serta kata laluan akaun portal.'),
 s('Buka Profil. Semak Maklumat saya, gambar, nombor telefon, persatuan daerah dan maklumat waris. Lengkapkan profil melalui website apabila diminta.'),
 s('Aktifkan notifikasi telefon mengikut panduan khusus Android atau iPhone pada halaman 24 hingga 27. Hubungkan Telegram jika belum dipautkan.'),
 s('Semak Utama, kemudian buka Tugasan atau menu tindakan yang tersedia bagi peranan anda.'),
 h('Cara membaca manual'),
 p('Teks tebal menandakan menu atau butang aplikasi. “Website” bermaksud portal yang dibuka dalam pelayar. Sesi pelayar mungkin memerlukan log masuk berasingan walaupun menggunakan akaun yang sama.'),
 n('Tangkapan skrin akaun dalam manual ialah paparan aplikasi sebenar yang dirender dengan data contoh. Nama, angka, tarikh, notis dan status contoh bukan rekod operasi atau pengumuman rasmi.'),
 p('Simpan manual ini pada telefon. Semasa bekerja, ikut langkah pada halaman berkaitan dan pastikan mesej berjaya serta perubahan status dipaparkan sebelum beralih ke urusan lain.')])

page('Mula di sini','Peranan akaun dan skop capaian',[
 table(['Peranan','Menu bawah aplikasi','Urusan utama'],[
 ['Pengadil','Utama · Tugasan · Rekod · Permohonan · Profil','Jawab lantikan; lihat surat; rekod perlawanan; lihat penilaian dan status permohonan.'],
 ['Penilai','Utama · Tugasan · Laporan · Permohonan · Profil','Jawab lantikan RA; isi, simpan dan hantar laporan penilaian; semak permohonan sendiri.'],
 ['PP Daerah','Utama · Tugasan · Lantikan · Semakan · Profil','Urus lantikan daerah, sahkan rekod dan semak permohonan dalam skop daerah. Permohonan Saya ada di Profil > Lagi.'],
 ['Admin','Utama · Kelulusan · Lantikan · Profil','Kelulusan permohonan dan pengurusan lantikan. Pengurusan lanjutan melalui website.']]),
 h('Empat perkara yang berbeza'),
 p('<b>Peranan</b> menentukan portal dan menu. <b>Jenis Pengadil</b> menerangkan kategori pengadil. <b>Status permohonan</b> menerangkan proses sesuatu borang. <b>Pendaftaran tahunan</b> terikat kepada sesi atau tahun yang dipilih.'),
 p('Kelulusan pada tahun terdahulu tidak dengan sendirinya membuktikan pendaftaran tahun semasa. Seminar, ujian kecergasan dan kelayakan patch atau lesen perlu dirujuk pada status masing-masing.'),
 n('<b>KUP</b> ialah empat pegawai perlawanan: Pengadil (R), Penolong Pengadil 1 (AR1), Penolong Pengadil 2 (AR2) dan pegawai keempat. <b>RA</b> ialah Penilai Pengadil yang berasingan daripada KUP.'),
 p('Akaun PP Daerah yang diberi keupayaan RA boleh membuka <b>Profil > Lagi > Tugasan Penilai</b>. Jika menu tidak sepadan dengan tugasan anda, minta pentadbir menyemak peranan dan keupayaan akaun.')])

page('Pemasangan','Pasang pada telefon Android',[
 p('Muat turun daripada pautan rasmi berikut. Pautan yang sama digunakan apabila APK baharu dikeluarkan.'),
 ('qr',('https://refpahang.com/app/refpahang.apk','APK rasmi RefPahang')),
 s('Buka pautan di Chrome atau pelayar telefon. Tunggu muat turun <b>RefPahang.apk</b> selesai. Semasa semakan 20 Oktober 2026, saiz muat turun ialah kira-kira 64.7 MB; sediakan ruang tambahan untuk pemasangan.'),
 s('Buka fail melalui senarai Downloads atau aplikasi Files. Jika Android meminta kebenaran, tekan <b>Settings / Tetapan</b> pada mesej pemasangan.'),
 s('Pada <b>Install unknown apps</b>, benarkan <b>Allow from this source</b> untuk pelayar atau pengurus fail yang membuka APK tersebut. Nama laluan boleh berbeza mengikut jenama telefon.'),
 s('Kembali ke pemasang. Semak nama RefPahang, kemudian tekan <b>Install / Pasang</b>. Selepas selesai, tekan <b>Open / Buka</b>.'),
 s('Log masuk dan benarkan notifikasi apabila diminta. Pastikan ikon RefPahang boleh dibuka dari senarai aplikasi.'),
 n('Jika pemasangan ditolak oleh perlindungan keselamatan atau dasar organisasi, simpan mesej ralat dan hubungi sokongan. Gunakan aplikasi web sementara menunggu bantuan.'),
 p('Rujukan pemasangan APK: <link href="https://developer.android.com/distribute/marketing-tools/alternative-distribution" color="#2463A6">Android Developers</link>. Kebenaran sumber boleh ditutup semula selepas pemasangan melalui tetapan telefon.')])

page('Pemasangan','Pasang pada iPhone dan iPad',[
 p('Gunakan aplikasi web RefPahang melalui Safari dan tambah ke skrin utama. Pautan iOS native tidak disenaraikan oleh pelayan pada 20 Oktober 2026.'),
 ('qr',('https://refpahang.com/app/','Aplikasi web RefPahang')),
 s('Buka <b>Safari</b> dan pergi ke <b>https://refpahang.com/app/</b>. Tunggu skrin log masuk selesai dimuatkan.'),
 s('Tekan <b>Kongsi / Share</b>. Pilih <b>Add to Home Screen / Tambah ke Skrin Utama</b>. Tatal pilihan jika perlu.'),
 s('Pastikan nama RefPahang. Jika pilihan <b>Open as Web App</b> dipaparkan, hidupkannya. Tekan <b>Add / Tambah</b>.'),
 s('Kembali ke skrin utama telefon. Buka ikon <b>RefPahang</b> yang baru ditambah dan log masuk.'),
 s('Pada Utama atau Profil, cari kad <b>Aktifkan notifikasi</b>. Tekan <b>Aktifkan</b>, kemudian benarkan pemberitahuan.'),
 n('Web Push pada iPhone dan iPad memerlukan iOS atau iPadOS 16.4 ke atas serta aplikasi yang dibuka dari skrin utama. Jika kad meminta “Pasang ke skrin utama”, selesaikan langkah pemasangan dahulu.'),
 p('Rujukan: <link href="https://support.apple.com/en-mide/guide/iphone/iphea86e5236/ios" color="#2463A6">Panduan Safari Apple</link> dan <link href="https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/" color="#2463A6">WebKit Web Push</link>. Susunan menu telefon boleh berbeza mengikut versi sistem.')])

page('Akaun','Log masuk ke RefPahang',[
 h('Sebelum bermula'),p('Sediakan emel berdaftar, kata laluan dan sambungan internet. Gunakan akaun yang sama seperti portal website.'),
 s('Buka ikon <b>RefPahang</b>. Baca pengumuman yang dipaparkan di atas borang jika ada.'),
 s('Masukkan <b>Emel</b> dan <b>Kata laluan</b>. Tekan ikon mata untuk memeriksa ejaan jika perlu.'),
 s('Tekan <b>Log masuk</b> sekali dan tunggu. Jika diminta kebenaran pemberitahuan, benarkan supaya lantikan boleh dimaklumkan pada telefon.'),
 s('Pastikan halaman <b>Utama</b> terbuka dan menu bawah sepadan dengan peranan anda.'),
 h('Jika gagal'),p('Semak emel, huruf besar atau kecil kata laluan dan sambungan internet. Baca mesej ralat yang dipaparkan. Gunakan <b>Lupa kata laluan?</b> jika kata laluan tidak diketahui.'),
 n('Aplikasi memerlukan internet untuk mendapatkan maklumat terkini dan menghantar tindakan. Akaun yang masih dipaparkan semasa talian terputus bukan bukti data sudah disegerakkan.')],shot='login',caption='Skrin log masuk aplikasi dengan pengumuman contoh')

page('Akaun','Daftar akaun dan pulihkan akses',[
 h('Membuka akaun baharu'),
 s('Pada skrin log masuk, tekan <b>Daftar</b>. Borang pendaftaran akan dibuka pada website.'),
 s('Isi semua medan wajib dalam borang, termasuk maklumat diri, emel, telefon, alamat dan persatuan daerah seperti yang diminta.'),
 s('Pilih <b>Peranan</b>: Pengadil atau Penilai Pengadil. Jika memilih Pengadil, pilih <b>Jenis Pengadil</b> yang betul: Pengadil Baharu, Pengadil Negeri atau Pengadil Kebangsaan.'),
 s('Lengkapkan pengakuan dan hantar borang menggunakan butang pendaftaran di website. Betulkan medan yang ditandakan jika penghantaran ditolak.'),
 s('Semak emel pendaftaran termasuk Spam atau Junk untuk arahan akses. Kembali ke aplikasi dan log masuk. Tukar kata laluan awal selepas memperoleh akses.'),
 n('Pendaftaran akaun tidak sama dengan permohonan pendaftaran tahunan. Akaun Admin dan PP Daerah ditetapkan oleh pentadbir; kedua-duanya bukan pilihan pendaftaran awam.'),
 h('Lupa kata laluan'),
 p('Tekan <b>Lupa kata laluan?</b>, masukkan emel berdaftar dan hantar permintaan di website. Buka pautan dalam emel, isi kata laluan baharu serta pengesahan, kemudian simpan. Jika pautan telah digunakan atau tamat tempoh, minta pautan baharu. Log masuk aplikasi menggunakan kata laluan baharu.'),
 p('Jika emel tidak diterima atau akaun tidak dapat dipulihkan, hubungi <b>sokongan@pbnppahang.my</b> dengan emel berdaftar dan mesej ralat. Jangan sertakan kata laluan atau pautan pemulihan.')])

page('Penggunaan harian','Kenali halaman Utama',[
 s('Semak nama dan peranan pada bahagian atas. Ikon loceng membuka senarai notifikasi.'),
 s('Baca bahagian <b>Perlu jawapan anda</b>. Tekan <b>Jawab</b> untuk membuka lantikan yang memerlukan respons.'),
 s('Semak <b>Tugasan seterusnya</b>. Tekan kad atau <b>Semua</b> untuk melihat senarai tugasan.'),
 s('Bagi Pengadil, semak ringkasan <b>Perlawanan</b>. Tekan <b>Rekod</b> untuk melihat rekod dan status pengesahan.'),
 s('Buka <b>Notifikasi terkini</b> atau <b>Lihat semua</b> untuk membaca makluman penuh.'),
 h('Gerakan asas'),p('Tekan menu bawah untuk bertukar halaman. Tatal ke bawah untuk kandungan tambahan. Tarik senarai ke bawah untuk memuatkan semula pada halaman yang menyokongnya. Gunakan anak panah kembali untuk menutup halaman lanjutan.'),
 n('Kandungan Utama berubah mengikut peranan. Angka dalam tangkapan skrin ialah contoh; semak angka pada akaun anda sendiri.')],shot='pengadil_utama',caption='Halaman Utama bagi peranan Pengadil')

page('Tugasan','Cari dan tapis lantikan',[
 s('Buka menu <b>Tugasan</b>.'),
 s('Pilih <b>Perlu jawapan</b> untuk lantikan yang masih boleh dijawab. Bilangan dalam kurungan menunjukkan item yang dipaparkan oleh aplikasi.'),
 s('Pilih <b>Akan datang</b> untuk tugasan diterima yang belum bermula. Gunakan <b>Lepas</b> atau <b>Semua</b> untuk semakan lanjut; leret bar penapis jika pilihan berada di luar skrin.'),
 s('Semak jawatan, pasukan, tarikh, masa, tempat dan kejohanan sebelum membuat keputusan.'),
 s('Tekan kad untuk butiran atau tekan <b>Terima</b> / <b>Tolak</b> pada kad yang masih terbuka untuk jawapan.'),
 h('Tarikh akhir jawapan'),p('Ikut masa <b>Jawab sebelum</b> yang dipaparkan. Kaedah semasa menggunakan had 48 jam sebelum sepak mula bagi Liga dan 3 jam bagi jenis lain. Lantikan lewat atau pengganti boleh mempunyai had sehingga sepak mula.'),
 n('Had tersebut dikira berasaskan jadual perlawanan dan masa notifikasi; ia bukan tempoh tetap 48 atau 3 jam selepas menerima mesej. Jawab segera. Pelayan menentukan sama ada jawapan masih boleh diterima.')],shot='pengadil_tugasan',caption='Penapis tugasan dan lantikan yang memerlukan jawapan')

page('Tugasan','Semak butiran dan rakan bertugas',[
 s('Tekan kad perlawanan dalam <b>Tugasan</b>.'),
 s('Semak status, jenis kejohanan, jawatan anda, tarikh dan masa, tempat serta nombor perlawanan.'),
 s('Tekan baris <b>Tempat</b> atau ikon peta untuk membuka carian lokasi dalam Google Maps. Sahkan lokasi padang sebenar dengan penganjur jika nama tempat tidak jelas.'),
 s('Semak <b>Pegawai bertugas bersama</b>. Nama, jawatan, daerah atau wilayah dan nombor yang tersedia membantu penyelarasan sebelum bertugas.'),
 s('Tekan ikon telefon untuk membuka pendail. Semak nombor dan buat panggilan dari aplikasi telefon jika perlu.'),
 s('Tutup panel untuk kembali ke senarai, atau pilih tindakan jawapan yang masih tersedia.'),
 n('Butiran kontak digunakan bagi urusan tugasan. Jika jadual berubah, muatkan semula maklumat dan ikut makluman pengurusan yang terkini.')],shot='pengadil_tugasan_detail',caption='Panel butiran lantikan dan pegawai bertugas bersama')

page('Tugasan','Terima atau tolak lantikan',[
 s('Tekan <b>Terima</b> atau <b>Tolak</b> pada lantikan yang betul.'),
 s('Semak semula ringkasan perlawanan dalam panel pengesahan. Untuk menerima, catatan adalah pilihan. Untuk menolak, isi <b>Sebab penolakan</b>.'),
 s('Tekan <b>Sahkan terima</b> atau <b>Sahkan tolak</b>. Tekan <b>Batal</b> jika belum mahu menghantar keputusan.'),
 s('Tunggu mesej berjaya, kemudian pastikan status dalam senarai berubah kepada <b>Diterima</b> atau <b>Ditolak</b>.'),
 n('Jika ralat rangkaian berlaku, muatkan semula status sebelum mencuba lagi. Lantikan yang sudah bermula atau tamat tempoh mungkin tidak lagi boleh dijawab; hubungi pihak yang melantik.')],shots=['pengadil_terima','pengadil_tolak'],caption='Kiri: menerima lantikan. Kanan: menolak dengan sebab.')

page('Tugasan','Surat lantikan dan perubahan status',[
 s('Buka <b>Tugasan > Akan datang</b> dan cari lantikan berstatus <b>Diterima</b>.'),
 s('Tekan <b>Surat Lantikan (PDF)</b> pada kad atau panel butiran.'),
 s('Tunggu pelayar atau pembaca PDF membuka dokumen. Gunakan kawalan muat turun atau kongsi pada pembaca tersebut untuk menyimpan salinan.'),
 s('Pastikan nama, jawatan, pasukan, tarikh dan tempat sepadan dengan tugasan semasa.'),
 h('Maksud status lain'),p('<b>Belum Jawab</b>: jawapan belum direkodkan. <b>Ditolak</b>: lantikan ditolak; semak sebab atau makluman berkaitan. <b>Dibatalkan</b>: tugasan dibatalkan. <b>Ditangguhkan</b>: perlawanan ditangguhkan; tunggu pengesahan jadual baharu.'),
 n('Jika surat tidak boleh dibuka, semak internet dan cuba semula. Jangan berkongsi pautan dokumen peribadi. Status pada aplikasi yang sudah dimuatkan semula menjadi rujukan semasa.')],shot='pengadil_tugasan_diterima',caption='Butang Surat Lantikan PDF pada lantikan yang diterima')

page('Rekod Pengadil','Semak sejarah perlawanan',[
 s('Buka <b>Rekod > Perlawanan</b>.'),
 s('Semak ringkasan <b>Disahkan</b>, <b>Menunggu</b> dan <b>Ditolak</b> bagi tahun yang dipaparkan.'),
 s('Baca kad sejarah: jawatan, pasukan, jenis perlawanan, tempat, keputusan jika tersedia dan status PP Daerah.'),
 s('Kenal pasti label <b>Lantikan rasmi</b> jika dipaparkan. Elakkan menambah semula rekod yang sudah wujud.'),
 s('Tatal untuk memuatkan rekod seterusnya. Tarik ke bawah untuk memuatkan semula selepas perubahan.'),
 h('Rekod belum disahkan'),p('Rekod yang dihantar menunggu tindakan PP Daerah. Jika ditolak, semak catatan PP pada kad dan hubungi PP Daerah untuk pembetulan melalui aliran yang tersedia.'),
 n('Jumlah rekod keseluruhan dan jumlah yang disahkan boleh berbeza. Untuk syarat permohonan, rujuk kiraan serta syarat yang dipaparkan pada borang bagi sesi tersebut.')],shot='pengadil_rekod',caption='Sejarah perlawanan dan ringkasan pengesahan')

page('Rekod Pengadil','Tambah rekod perlawanan',[
 s('Buka <b>Rekod > Perlawanan > Tambah</b>.'),
 s('Isi <b>Pasukan Tuan Rumah</b>, <b>Pasukan Pelawat</b> dan <b>Tarikh</b>. Pilihan tarikh ialah rekod lampau sehingga hari semasa dalam julat yang disediakan.'),
 s('Isi masa, jenis perlawanan, nama kejohanan dan tempat jika berkenaan.'),
 s('Pilih <b>Daerah Perlawanan</b> yang betul. Daerah ini diperlukan untuk semakan rekod; jangan keliru dengan daerah persatuan peribadi anda.'),
 s('Pilih cuaca jika berkenaan. Tatal untuk mengisi keputusan dan pegawai.'),
 n('Halaman ini merekodkan perlawanan yang telah berlangsung. Untuk menambah jadual kejohanan yang akan datang, Admin atau PP Daerah menggunakan menu Lantikan.')],shot='pengadil_tambah_rekod',caption='Bahagian maklumat asas borang rekod perlawanan')

page('Rekod Pengadil','Isi keputusan dan pegawai',[
 s('Isi keputusan <b>Separuh masa</b> dan <b>Penuh masa</b> jika diketahui. Isi masa tambahan dan sepakan penalti hanya apabila berkaitan. Gunakan 0 untuk keputusan sifar yang diketahui; ruang kosong bukan keputusan 0.'),
 s('Pada <b>Pegawai perlawanan</b>, tekan <b>Cari pegawai...</b> bagi jawatan yang betul.'),
 s('Taip sekurang-kurangnya dua huruf nama. Pilih individu yang tepat; semak kategori dan persatuan atau daerah. Pilihan pegawai yang sama dikecualikan daripada slot lain.'),
 s('Pilih sekurang-kurangnya seorang pegawai. Semak semua maklumat sebelum menekan <b>Hantar untuk pengesahan</b>.'),
 s('Tunggu mesej berjaya, kemudian semak rekod dalam senarai dan status pengesahannya.'),
 n('Satu rekod boleh melibatkan beberapa pegawai. Elakkan setiap pegawai mencipta salinan yang sama tanpa menyemak rekod sedia ada. Jika tersalah hantar, rujuk PP Daerah.')],shot='pengadil_tambah_rekod_bawah',caption='Keputusan, pilihan pegawai dan butang penghantaran rekod')

page('Rekod Pengadil','Lihat penilaian prestasi',[
 s('Buka <b>Rekod > Penilaian</b>.'),
 s('Semak bilangan <b>Laporan disahkan</b> dan <b>Purata markah</b> yang tersedia untuk akaun anda.'),
 s('Tekan laporan untuk melihat markah anda, prestasi, jawatan, nama penilai, tahap kesukaran dan ulasan berkaitan.'),
 s('Baca kekuatan, kelemahan dan nasihat bagi kawalan perlawanan, kecergasan fizikal serta kerjasama apabila dipaparkan.'),
 s('Untuk dokumen penuh, tekan <b>PDF di website</b>. Log masuk dalam pelayar jika diminta, kemudian buka laporan yang berkenaan.'),
 n('Paparan butiran mudah alih menumpukan entri anda. Akses laporan penuh di website tertakluk kepada kebenaran perlawanan: KUP hanya boleh melihat laporan RA bagi perlawanan yang sama, bukan perlawanan orang lain.')],shot='pengadil_penilaian',caption='Senarai penilaian yang tersedia kepada Pengadil')

page('Permohonan','Jejak permohonan sendiri',[
 s('Pengadil dan Penilai: buka <b>Permohonan</b> pada menu bawah. PP Daerah: buka <b>Profil > Lagi > Permohonan Saya</b>.'),
 s('Semak jenis borang, sesi atau tahun, tarikh hantar dan status bagi setiap permohonan.'),
 s('Tekan kad untuk melihat butiran serta catatan PP Daerah dan Admin apabila tersedia.'),
 s('Tarik senarai ke bawah selepas penghantaran atau semakan untuk mendapatkan status terkini.'),
 h('Pilih sesi yang betul'),p('Permohonan tahun terdahulu disimpan sebagai sejarah. Kewujudan permohonan lama tidak bermakna anda telah memohon untuk sesi baharu.'),
 n('Semakan, keputusan ujian, kecergasan, seminar dan bayaran boleh mempunyai maklumat berasingan. Baca butiran kad dan borang; jangan bergantung pada warna label sahaja.')],shot='pengadil_permohonan',caption='Sejarah permohonan mengikut jenis dan sesi')

page('Permohonan','Mulakan permohonan baharu',[
 s('Buka halaman permohonan sendiri dan tekan <b>Mohon</b>.'),
 s('Pilih jenis permohonan yang tersedia kepada peranan anda. Pengadil mempunyai pilihan Pendaftaran Tahunan (R1), Kelas III FAM dan Ujian Kelas I FAM.'),
 s('Penilai mempunyai pilihan pendaftaran tahunan penilai. PP Daerah mempunyai pilihan yang dipaparkan khusus kepada akaunnya.'),
 s('Pilihan akan membuka website. Log masuk jika diminta, kemudian semak jenis borang dan sesi pada tajuk.'),
 s('Baca syarat, tempoh permohonan dan arahan bayaran semasa sebelum mengisi borang.'),
 n('Borang lengkap dan muat naik dokumen dibuat di website. Jika borang ditutup, syarat tidak dipenuhi atau permohonan sesi itu sudah wujud, ikut mesej yang dipaparkan; jangan buat akaun kedua.')],shot='permohonan_baharu',caption='Pilihan permohonan yang membuka borang di website')

page('Permohonan','Lengkapkan borang dan dokumen',[
 h('Sediakan maklumat sebelum membuka borang'),
 p('Pastikan profil lengkap, maklumat waris tepat dan gambar terkini tersedia. Sediakan resit bayaran yang jelas apabila diminta oleh jenis borang tersebut.'),
 s('Baca tajuk sesi, syarat umur atau kelayakan, bilangan perlawanan dan status pendaftaran yang dipaparkan. Nilai syarat serta jumlah bayaran boleh berubah mengikut sesi.'),
 s('Semak maklumat profil yang ditarik ke borang. Jika salah, kemas kini profil dahulu. Lengkapkan nama waris, hubungan dan nombor telefon; pilih saiz baju apabila diminta.'),
 s('Buat bayaran mengikut arahan dan akaun penerima yang dipaparkan dalam borang semasa. Jangan menggunakan nombor akaun atau kadar bayaran daripada tangkapan skrin lama.'),
 s('Muat naik <b>Resit Bayaran</b> atau <b>Resit Bayaran FAM</b>. Format yang diterima ialah PDF, JPG atau PNG, maksimum 5 MB setiap fail. Gambar profil menggunakan JPG atau PNG, maksimum 5 MB sebelum pemprosesan.'),
 s('Baca dan tandakan pengakuan yang berkaitan. Tekan <b>Hantar Permohonan</b>, tunggu pengesahan dan semak permohonan yang terhasil.'),
 s('Kembali ke aplikasi, buka <b>Permohonan</b> dan muatkan semula. Pastikan sesi, tarikh hantar dan status telah direkodkan.'),
 n('Jika penghantaran terganggu, semak sejarah dahulu sebelum menghantar semula. Untuk PDF atau borang cetakan, gunakan kawalan dokumen pada website. Simpan resit asal untuk rujukan.')])

page('Permohonan','Fahami status dan tindakan susulan',[
 h('Baca butiran permohonan'),
 p('<b>Menunggu PP Daerah</b>: semakan daerah belum selesai. <b>Menunggu Admin</b>: permohonan menunggu keputusan pentadbiran.'),
 p('<b>Admin Diluluskan</b>: bagi aliran pendaftaran pengadil yang berkaitan, dokumen diluluskan sementara urusan kecergasan masih perlu dirujuk. Status ini tidak dengan sendirinya membuktikan kelayakan patch atau lesen.'),
 p('<b>Lengkap</b>: aliran permohonan direkodkan lengkap. <b>Ditolak</b>: baca catatan penolakan dan rujuk pihak yang memproses sebelum membetulkan atau memohon semula.'),
 s('Tekan kad permohonan dan semak sesi, catatan PP, catatan Admin serta status ujian, kecergasan dan seminar jika dipaparkan.'),
 s('Hubungi PP Daerah untuk isu semakan daerah; hubungi Admin bagi keputusan pentadbiran yang memerlukan penjelasan.'),
 n('Permohonan sendiri oleh PP Daerah dihantar kepada Admin; ia tidak disahkan sendiri melalui semakan daerah. Peranan portal kekal berasingan daripada keputusan pendaftaran tahunan.')],shot='permohonan_detail',caption='Panel butiran permohonan dan status aliran kerja')

page('Profil','Maklumat diri dan gambar profil',[
 s('Buka <b>Profil > Maklumat saya</b>. Semak emel, telefon, nombor KP, persatuan, alamat, tahun mula aktif, saiz baju dan waris yang dipaparkan.'),
 s('Tekan <b>Kemaskini di website</b> untuk mengubah maklumat. Log masuk jika diminta, isi medan yang perlu dan simpan di website.'),
 s('Jika terdapat kad <b>Profil belum lengkap</b>, tekan kad tersebut dan lengkapkan medan yang disenaraikan. Kembali ke aplikasi dan muatkan semula.'),
 s('Untuk gambar, tekan ikon kamera pada gambar profil. Pilih <b>Ambil gambar</b> atau <b>Pilih dari galeri</b>, kemudian benarkan akses apabila diminta.'),
 s('Pada Android, pangkas gambar dan sahkan pilihan. Aplikasi web mengecilkan gambar melalui pemilih fail tanpa skrin pangkas native yang sama.'),
 s('Tunggu mesej berjaya dan pastikan gambar baharu kelihatan.'),
 n('Label pada kad profil boleh menunjukkan Jenis Pengadil. Menu aplikasi ditentukan oleh peranan akaun, bukan label kategori itu sahaja.')],shot='pengadil_profil',caption='Profil, amaran kelengkapan dan akses urusan akaun')

page('Profil','Tukar kata laluan',[
 s('Buka <b>Profil > Tukar kata laluan</b>.'),
 s('Isi <b>Kata laluan semasa</b>.'),
 s('Isi <b>Kata laluan baharu</b>, kemudian ulang tepat pada <b>Sahkan kata laluan baharu</b>.'),
 s('Tekan <b>Simpan</b>. Tunggu mesej berjaya. Jika dipaparkan ralat, betulkan maklumat yang dinyatakan dan cuba semula.'),
 h('Keperluan kata laluan'),p('Gunakan sekurang-kurangnya 8 aksara. Kata laluan dan pengesahan mesti sepadan. Sistem juga menghadkan panjang kepada 72 bait; aksara bukan Latin boleh menggunakan lebih daripada satu bait.'),
 p('Jika tidak mengetahui kata laluan semasa, kembali ke skrin log masuk dan gunakan <b>Lupa kata laluan?</b> melalui website.'),
 n('Simpan kata laluan secara peribadi. Jangan menghantar kata laluan, kod pemulihan atau pautan tetapan semula kepada pihak lain, termasuk semasa meminta bantuan.')],shot='tukar_kata_laluan',caption='Borang perubahan kata laluan dalam aplikasi')

page('Notifikasi','Aktifkan notifikasi pada Android',[
 p('Panduan ini untuk RefPahang yang dipasang menggunakan APK. Semua peranan perlu membenarkan notifikasi pada telefon masing-masing.'),
 h('Semasa log masuk kali pertama'),
 s('Buka RefPahang dan log masuk. Apabila Android memaparkan permintaan kebenaran pemberitahuan untuk RefPahang, tekan <b>Allow / Benarkan</b>.'),
 s('Jika anda menekan Don\'t allow / Jangan benarkan, menutup permintaan atau tidak melihat dialog itu, gunakan langkah tetapan telefon di bawah. Dialog kebenaran ini bergantung pada versi Android.'),
 h('Aktifkan melalui tetapan telefon'),
 s('Buka <b>Tetapan / Settings > Pemberitahuan / Notifications > Pemberitahuan aplikasi / App notifications</b>. Pilih <b>RefPahang</b>. Jika tidak tersenarai, tukar penapis kepada Semua aplikasi / All apps.'),
 s('Cara lain: tekan lama ikon RefPahang, pilih <b>Maklumat aplikasi / App info</b>, kemudian buka <b>Notifikasi / Notifications</b>.'),
 s('Hidupkan <b>Benarkan notifikasi / Allow notifications</b> atau suis utama yang sepadan. Jika kategori <b>Notifikasi RefPahang</b> dipaparkan, pastikan kategori itu juga dibenarkan.'),
 s('Jika mahu bunyi dan sepanduk, pilih tetapan amaran yang sesuai seperti <b>Alerting</b> dan benarkan paparan skrin kunci atau pop-up apabila pilihan itu tersedia. Nama kawalan berbeza mengikut telefon.'),
 s('Simpan kerja dalam aplikasi. Tutup RefPahang sepenuhnya dan buka semula dengan internet. Jika masih bermasalah, log keluar dan log masuk semula selepas menyimpan draf supaya pendaftaran peranti dicuba semula.'),
 n('Android APK menggunakan kebenaran sistem telefon. Butang kad “Aktifkan” yang ditunjukkan pada halaman iPhone ialah untuk aplikasi web; jangan mencarinya sebagai syarat pengaktifan APK.'),
 p('Rujukan tetapan: <link href="https://support.google.com/android/answer/9079661?hl=en" color="#2463A6">Google Android Help - Control notifications on Android</link>. Selepas mengaktifkan, ikut halaman “Semak penerimaan notifikasi telefon”.')])

page('Notifikasi','Aktifkan notifikasi pada iPhone',[
 p('Gunakan RefPahang dari ikon skrin utama pada iOS atau iPadOS 16.4 ke atas. Selesaikan pemasangan Add to Home Screen dahulu.'),
 s('Buka ikon <b>RefPahang</b> pada skrin utama dan log masuk. Buka <b>Profil</b>; kad notifikasi juga boleh dipaparkan pada Utama apabila belum aktif.'),
 s('Cari kad <b>Aktifkan notifikasi</b>. Tekan butang hitam <b>Aktifkan</b> yang ditunjukkan di bawah.'),
 ('panel',('notifikasi_aktifkan','Kad pengaktifan aplikasi web dan butang Aktifkan')),
 s('Apabila iPhone meminta kebenaran pemberitahuan, pilih <b>Allow / Benarkan</b>. Tunggu proses selesai; jangan tutup aplikasi ketika “Mengaktifkan...” dipaparkan.'),
 s('Pastikan kad di <b>Profil</b> bertukar kepada <b>Notifikasi aktif</b>. Pada Utama, kad pengaktifan boleh hilang selepas berjaya; semak Profil untuk melihat statusnya semula.'),
 ('panel',('notifikasi_aktif','Kad Profil selepas kebenaran dan langganan contoh diaktifkan')),
 n('Gambar menunjukkan widget aplikasi dengan keadaan kebenaran contoh, bukan dialog sistem iPhone sebenar. Jangan tekan “Matikan pada telefon ini” jika masih mahu menerima notifikasi. Selepas log keluar atau bertukar peranti, semak dan aktifkan semula jika diperlukan.')])

page('Notifikasi','Pulihkan notifikasi iPhone yang disekat',[
 h('Jika kad meminta pemasangan'),
 ('panel',('notifikasi_perlu_pasang','Kad apabila aplikasi perlu dibuka dari skrin utama')),
 s('Dalam Safari, buka <b>https://refpahang.com/app/</b>. Tekan <b>Kongsi > Add to Home Screen > Add</b>. Kemudian buka ikon RefPahang dari skrin utama, log masuk dan tekan <b>Aktifkan</b> pada kad notifikasi.'),
 h('Jika kad menunjukkan Notifikasi disekat'),
 ('panel',('notifikasi_disekat','Kad apabila kebenaran pemberitahuan telah ditolak')),
 s('Buka <b>Tetapan / Settings > Pemberitahuan / Notifications > RefPahang</b>. Hidupkan <b>Allow Notifications / Benarkan Pemberitahuan</b>.'),
 s('Pilih paparan yang anda perlukan seperti <b>Lock Screen</b>, <b>Notification Centre</b>, <b>Banners</b> dan bunyi apabila tersedia. Semak tetapan <b>Focus / Do Not Disturb</b> jika amaran disenyapkan.'),
 s('Tutup dan buka semula RefPahang dari skrin utama. Buka Profil dan tekan <b>Aktifkan</b> jika butang itu dipaparkan. Semak bahawa kad menjadi <b>Notifikasi aktif</b>.'),
 n('Jika RefPahang tiada dalam senarai Pemberitahuan, semak pemasangan skrin utama dan versi iOS, kemudian cuba langkah pengaktifan dari aplikasi. Jika kad langsung tiada, rujuk sokongan dengan model telefon dan versi sistem.')])

page('Notifikasi','Semak penerimaan notifikasi telefon',[
 p('Kebenaran telefon, pendaftaran peranti dan penerimaan mesej ialah semakan yang berasingan. Gunakan langkah ini selepas mengaktifkan notifikasi atau menukar telefon.'),
 s('Pastikan RefPahang masih log masuk dan telefon mempunyai internet. Semak suis notifikasi pada Android atau kad <b>Notifikasi aktif</b> pada Profil aplikasi web iPhone.'),
 s('Kembali ke skrin utama telefon tanpa menekan Log keluar. Untuk semakan ini, biarkan aplikasi berjalan di latar belakang.'),
 s('Semak notifikasi urusan sebenar yang seterusnya, atau ujian terkawal yang dipersetujui dengan pentadbir. Anda sepatutnya melihat pemberitahuan RefPahang pada telefon jika kebenaran dan penghantaran berjaya.'),
 s('Tekan pemberitahuan tersebut. Pastikan RefPahang dibuka dan semak halaman berkaitan seperti Tugasan atau Permohonan. Semak mesej serta status semasa dalam aplikasi.'),
 table(['Apa yang anda lihat','Apa yang perlu difahami'],[
 ['Mesej ada dalam senarai Notifikasi aplikasi','Ini membuktikan makluman tersedia dalam portal; ia tidak dengan sendirinya membuktikan pemberitahuan sampai ke telefon.'],
 ['iPhone menunjukkan Notifikasi aktif','Langganan aplikasi web aktif pada pelayar atau peranti itu. Penerimaan mesej masih perlu disemak.'],
 ['Android Profil menyatakan Notifikasi telefon aktif','Paparan ini bukan ujian penghantaran. Semak kebenaran sistem dan penerimaan pemberitahuan sebenar.'],
 ['Telegram menerima mesej','Telegram ialah saluran berasingan. Ia tidak membuktikan notifikasi aplikasi telefon sudah diaktifkan.']]),
 h('Jika amaran masih tidak sampai'),
 p('Semak kebenaran, kategori notifikasi, bunyi atau Focus, internet dan akaun log masuk. Pada Android, semak sekatan bateri atau aktiviti latar belakang RefPahang jika telefon menyediakan kawalan itu. Berikan masa ujian, versi aplikasi, model telefon dan hasil semakan kepada sokongan.'),
 n('Aplikasi tidak mempunyai butang ujian notifikasi kendiri pada skrin ini. Jangan menganggap ikon loceng atau angka belum dibaca sebagai bukti pengaktifan pemberitahuan telefon.')])

page('Notifikasi','Baca dan urus pemberitahuan',[
 s('Tekan ikon loceng pada Utama atau bahagian atas halaman. Anda juga boleh membuka <b>Profil > Notifikasi</b>.'),
 s('Tekan notifikasi untuk membaca mesej penuh. Item yang belum dibaca ditandakan dengan titik biru dan teks lebih tebal.'),
 s('Gunakan <b>Tandai dibaca</b> untuk menandakan semua item telah dibaca. Tarik senarai ke bawah untuk memuatkan semula.'),
 s('Jika menyentuh pemberitahuan telefon, aplikasi akan cuba membuka halaman berkaitan seperti Tugasan, Permohonan atau Rekod mengikut peranan.'),
 h('Aktifkan pemberitahuan telefon'),p('Ikut panduan khusus pengaktifan Android, iPhone, pemulihan kebenaran dan semakan penerimaan pada halaman 24 hingga 27. Membuka senarai ini sahaja tidak mengaktifkan notifikasi telefon.'),
 n('Membaca notifikasi tidak menerima lantikan secara automatik. Buka Tugasan dan sahkan jawapan. Jika pemberitahuan telefon tidak tiba, semak senarai notifikasi dan tugasan secara terus.')],shot='notifikasi',caption='Senarai notifikasi aplikasi dan tindakan Tandai dibaca')

page('Notifikasi','Hubungkan dan pulihkan Telegram',[
 h('Pautan kali pertama'),
 s('Pastikan Telegram dipasang dan akaun Telegram anda aktif.'),
 s('Buka <b>Profil > Telegram</b>. Jika tertera <b>Belum dihubungkan</b>, tekan baris tersebut.'),
 s('Buka pautan bot yang dijana oleh sistem dalam Telegram, kemudian tekan <b>Start / Mula</b> untuk melengkapkan pautan akaun.'),
 s('Kembali ke RefPahang dan muatkan semula Profil. Pastikan status bertukar kepada <b>Dihubungkan</b>.'),
 h('Jika tidak menerima mesej'),
 table(['Keadaan','Tindakan pengguna'],[
 ['Bot disekat','Buka @refpahang_bot dalam Telegram. Pilih Unblock jika ada, kemudian tekan Start. Semak status pautan di portal.'],
 ['Akaun Telegram dinyahaktifkan','Gunakan akaun Telegram yang aktif. Minta bantuan pentadbir untuk semakan atau pautan semula jika rekod lama masih ditandakan Dihubungkan.'],
 ['Status Dihubungkan tetapi tiada mesej','Semak chat bot, tetapan notifikasi Telegram dan sambungan internet. Minta pentadbir menyemak penghantaran sebenar jika masalah berterusan.']]),
 n('“Dihubungkan” bermaksud pautan disimpan dalam sistem. Ia bukan bukti Telegram menerima setiap mesej atau pengguna telah membaca mesej. Notifikasi telefon dan Telegram ialah saluran yang berasingan.'),
 p('Jangan berkongsi pautan pemautan peribadi. Untuk jawapan lantikan melalui mesej Telegram yang disediakan sistem, semak keputusan akhir pada Tugasan dalam aplikasi.')])

page('Kemas kini','Semak versi dan kemas kini automatik',[
 s('Sambungkan telefon ke internet. Selesaikan dan simpan borang atau draf yang sedang diisi.'),
 s('Buka <b>Profil</b>, kemudian tatal ke bahagian <b>App</b>.'),
 s('Semak baris versi di bawah <b>Semak kemas kini</b>. Jika ada nombor patch, sertakan nombor itu apabila melaporkan masalah.'),
 s('Tekan <b>Semak kemas kini</b>. Tunggu semakan dan muat turun selesai.'),
 s('Jika kemas kini sedia, pilih <b>Mula semula</b>. Jika mesej menyatakan versi terkini, teruskan penggunaan; semak juga sebarang arahan muat turun APK baharu pada permulaan aplikasi.'),
 h('Semakan latar belakang'),p('Pemasangan Android yang menyokong kemas kini automatik turut menyemak ketika aplikasi bermula dan kembali aktif. Semakan latar belakang dihadkan supaya tidak terlalu kerap; butang semakan meminta semakan terus.'),
 n('Jika “Kemas kini automatik tidak tersedia” dipaparkan, gunakan APK rasmi terkini apabila diarahkan. Aplikasi web tidak memaparkan menu kemas kini automatik native yang sama.')],shot='profil_bawah',caption='Bahagian App dalam Profil dan menu semakan kemas kini')

page('Kemas kini','Gunakan kemas kini yang sudah dimuat turun',[
 s('Apabila sepanduk <b>Versi baharu sedia digunakan</b> muncul, pastikan kerja semasa sudah disimpan.'),
 s('Tekan <b>Mula semula</b> pada sepanduk atau buka pemberitahuan kemas kini telefon.'),
 s('Dalam panel <b>Kemas kini sedia</b>, tekan <b>Mula semula sekarang</b>. Tekan <b>Batal</b> jika perlu menyimpan kerja dahulu.'),
 s('Selepas aplikasi dibuka semula, semak halaman yang berkaitan dan nombor versi atau patch di Profil.'),
 n('Menutup panel pengesahan tidak mengaktifkan patch. Aplikasi perlu dimulakan semula. Borang yang belum disimpan boleh hilang semasa mula semula.')],shots=['kemas_kini_banner','kemas_kini_sedia'],caption='Sepanduk kemas kini dan pengesahan mula semula')

page('Kemas kini','Pasang APK baharu dan kemas kini aplikasi web',[
 h('Apabila Android meminta versi baharu'),
 s('Jika panel <b>Versi baharu tersedia</b> muncul, tekan <b>Muat turun</b>. Jika versi lama tidak lagi disokong, panel meminta pemasangan versi terkini untuk meneruskan penggunaan.'),
 s('Buka APK rasmi yang dimuat turun dan pilih <b>Update / Kemas kini</b> apabila Android mengenal pasti pemasangan sedia ada.'),
 s('Tunggu pemasangan selesai, buka RefPahang semula dan log masuk jika diminta. Semak versi serta kebenaran notifikasi.'),
 p('Pautan rasmi: <link href="https://refpahang.com/app/refpahang.apk" color="#2463A6">https://refpahang.com/app/refpahang.apk</link>'),
 n('Jika Android melaporkan pakej bercanggah, tandatangan tidak sepadan atau pemasangan gagal, rekodkan ralat dan hubungi sokongan. Jangan terus membuang pemasangan kerana borang yang belum dihantar dan sesi tempatan boleh hilang.'),
 h('Kemas kini aplikasi web iPhone'),
 s('Simpan semua borang atau draf yang sedang diisi.'),
 s('Tutup RefPahang melalui penukar aplikasi, kemudian buka semula ikon dari skrin utama ketika internet tersedia. Aplikasi web memuatkan keluaran yang diterbitkan di pelayan.'),
 s('Jika paparan masih lama, cuba buka semula https://refpahang.com/app/ dalam Safari. Rujuk sokongan jika masalah berterusan sebelum memadam data laman.'),
 p('Versi sumber dan versi yang diumumkan pelayan pada 20 Oktober 2026 ialah <b>1.3.0</b>. Nombor ini ialah rujukan edisi manual, bukan jaminan versi terkini untuk tarikh selepas itu.')])

page('Penilai Pengadil','Menu dan tugasan RA',[
 p('Akaun Penilai menggunakan menu <b>Utama, Tugasan, Laporan, Permohonan, Profil</b>.'),
 s('Jawab lantikan <b>Penilai Pengadil</b> melalui <b>Tugasan</b> seperti prosedur menerima atau menolak lantikan.'),
 s('Buka <b>Laporan</b> untuk melihat tugasan penilaian yang telah diterima.'),
 s('Cari perlawanan yang betul. Tekan <b>Isi laporan</b> untuk laporan baharu atau <b>Sambung draf</b> untuk menyambung laporan yang disimpan.'),
 n('Senarai Laporan menggunakan lantikan Penilai Pengadil berstatus Diterima. Jika tiada tugasan, semak jawatan serta penerimaan lantikan. PP Daerah yang mempunyai keupayaan RA membuka Tugasan Penilai melalui Profil > Lagi.')],shots=['penilai_utama','penilai_laporan'],caption='Utama Penilai dan senarai tugasan penilaian')

page('Penilai Pengadil','Isi maklumat asas laporan',[
 s('Buka <b>Laporan > Isi laporan</b> pada perlawanan yang betul.'),
 s('Semak kejohanan, pasukan, tarikh, masa dan tempat pada kad atas.'),
 s('Pilih <b>Tahap kesukaran</b>: Normal, Susah atau Sangat Susah. Baca penerangan yang berubah mengikut pilihan.'),
 s('Pilih <b>Cuaca</b> yang berkaitan atau Tiada jika tiada pilihan yang berkenaan.'),
 s('Pada bahagian <b>Pegawai</b>, pilih R, AR1, AR2 atau pegawai keempat yang tersedia. Isi penilaian setiap pegawai yang disenaraikan.'),
 s('Gunakan <b>Simpan draf</b> semasa mengisi. Pastikan mesej berjaya diterima sebelum keluar atau bertukar peranti.'),
 n('RA ialah penilai bagi KUP. Jangan menggunakan nama atau markah pegawai lain. Senarai pegawai diambil daripada lantikan yang tersedia untuk perlawanan tersebut.')],shot='penilai_laporan_form',caption='Maklumat perlawanan, tahap kesukaran dan pilihan pegawai')

page('Penilai Pengadil','Markah prestasi dan ulasan',[
 s('Pilih pegawai dan semak nama serta jawatannya.'),
 s('Masukkan <b>Markah</b> menggunakan angka perpuluhan. Untuk penghantaran, aplikasi memerlukan markah antara <b>6.0 hingga 10</b> bagi setiap pegawai yang disenaraikan.'),
 s('Pilih kategori prestasi yang berkaitan: Sangat Baik, Baik, Memuaskan atau Tidak Memuaskan.'),
 s('Tekan <b>Panduan skala pemarkahan</b> untuk membaca penerangan skala dalam aplikasi. Gunakan panduan dan arahan penilaian semasa.'),
 s('Lengkapkan kekuatan, kelemahan dan nasihat bagi bahagian yang disediakan untuk jawatan tersebut.'),
 s('Ulang bagi setiap pegawai, kemudian isi <b>Ulasan keseluruhan</b> di bahagian bawah laporan.'),
 n('Pertukaran pilihan pegawai membolehkan anda melengkapkan satu laporan bagi perlawanan tersebut. Simpan draf secara berkala; jangan menganggap isi borang disimpan secara automatik.')],shot='penilai_markah',caption='Bahagian kriteria, nasihat dan akses panduan pemarkahan')

page('Penilai Pengadil','Pilih kriteria dan hantar laporan',[
 s('Tekan <b>Kekuatan</b> atau <b>Kelemahan</b> pada bahagian penilaian yang berkaitan.'),
 s('Tandakan kriteria yang berkenaan. Tekan <b>Siap</b> untuk kembali ke borang. Isi nasihat yang jelas dan khusus pada medan <b>Nasihat</b>.'),
 s('Semak semua pegawai, markah, kategori prestasi serta ulasan. Tekan <b>Simpan draf</b> jika belum selesai.'),
 s('Apabila lengkap, tekan <b>Hantar</b>. Baca panel <b>Hantar laporan?</b>, kemudian sahkan <b>Hantar laporan</b>.'),
 s('Pastikan mesej berjaya dan status laporan berubah daripada Draf kepada <b>Dihantar</b>. Tunggu pengesahan seterusnya.'),
 h('Selepas penghantaran'),p('Status boleh menunjukkan Dihantar, Disahkan atau Ditolak. Baca catatan Admin jika ada. Laporan yang dihantar tidak lagi dibuka sebagai draf dalam aplikasi; hubungi pengurusan jika memerlukan pembetulan.'),
 n('Simpan draf dan Hantar ialah dua tindakan berbeza. Draf belum dihantar untuk pengesahan. Jangan tutup aplikasi sebelum menerima mesej hasil simpan atau hantar.')],shot='penilai_kriteria',caption='Pemilihan kriteria kekuatan dan butang Siap')

page('PP Daerah','Utama dan perlawanan perlu tindakan',[
 p('PP Daerah mempunyai menu Tugasan sendiri, Lantikan Daerah dan Semakan. Capaian data tertakluk kepada skop daerah akaun.'),
 s('Pada <b>Utama</b>, semak tugasan sendiri serta bahagian <b>Perlu tindakan</b>.'),
 s('Tekan <b>Semua</b> pada Perlu tindakan untuk melihat perlawanan yang memerlukan pegawai pengganti atau pelengkap slot.'),
 s('Baca jawatan kosong atau ditolak yang ditandakan pada kad.'),
 s('Tekan perlawanan untuk membuka halaman lantikan. Isi atau ganti slot yang memerlukan tindakan, kemudian semak penghantaran notifikasi.'),
 n('Lantikan sendiri pada Tugasan dan urusan melantik pegawai daerah ialah dua fungsi berbeza. Permohonan sendiri serta Tugasan Penilai tambahan dibuka melalui Profil > Lagi apabila tersedia.')],shots=['pp_utama','pp_perlu_tindakan'],caption='Utama PP Daerah dan senarai perlawanan perlu tindakan')

page('PP Daerah','Semak rekod perlawanan',[
 s('Buka <b>Semakan > Perlawanan</b>.'),
 s('Pilih penapis <b>Menunggu</b>, <b>Disahkan</b> atau <b>Ditolak</b>.'),
 s('Tekan rekod untuk membaca butiran perlawanan, pengirim dan senarai pegawai.'),
 s('Bandingkan tarikh, masa, tempat, pasukan serta pegawai dengan bukti perlawanan yang berkaitan.'),
 s('Berikan perhatian kepada amaran rekod berganda atau pegawai bertembung sebelum mengesahkan.'),
 n('Semakan perlawanan ialah pengesahan rekod yang dihantar. Ia berasingan daripada semakan permohonan pendaftaran atau kelulusan lantikan kejohanan.')],shot='pp_semakan',caption='Penapis rekod perlawanan untuk semakan PP Daerah')

page('PP Daerah','Sahkan rekod dan semak pertindihan',[
 s('Buka rekod dalam senarai Semakan dan baca tarikh, tempat, keputusan jika ada serta pegawai.'),
 s('Jika amaran pertindihan dipaparkan, bandingkan rekod yang disenaraikan. Tentukan sama ada ia rekod berganda atau pertindihan sebenar yang memerlukan pembetulan.'),
 s('Untuk mengesahkan rekod yang mempunyai amaran, tandakan <b>Saya telah menyemak pertindihan ini</b> dan isi <b>Catatan</b>. Kedua-duanya diperlukan dalam keadaan ini.'),
 s('Tekan <b>Sahkan</b> atau <b>Tolak</b> berdasarkan semakan. Isi catatan yang menerangkan keputusan dan ikut sebarang validasi pelayan.'),
 s('Pastikan rekod berpindah kepada status yang betul. Untuk rekod yang sudah diproses, gunakan <b>Kembalikan ke Menunggu</b> jika tindakan itu dipaparkan dan pembetulan diperlukan.'),
 n('Jika pelayan mengesan pertindihan baharu semasa pengesahan, semak senarai amaran yang dikemas kini sebelum meneruskan. Jangan mengesahkan hanya untuk menghilangkan amaran.')],shot='pp_pengesahan_sheet',caption='Panel semakan pertindihan dan catatan pengesahan')

page('PP Daerah','Sahkan atau tolak permohonan',[
 s('Buka <b>Semakan > Permohonan</b> dan pilih pemohon yang perlu diproses.'),
 s('Tekan kad untuk semak maklumat serta rekod perlawanan. Gunakan <b>Dokumen penuh di website</b> untuk melihat dokumen lengkap sebelum membuat keputusan.'),
 s('Tekan <b>Sahkan</b> untuk permohonan yang memenuhi semakan. Dalam panel seterusnya, tekan <b>Sahkan</b> sekali lagi.'),
 s('Jika menolak, tekan <b>Tolak</b>, isi <b>Sebab penolakan</b> dan tekan <b>Sahkan tolak</b>.'),
 s('Semak mesej berjaya dan pastikan senarai dikemas kini. Permohonan yang disahkan PP diteruskan kepada Admin mengikut aliran borang.'),
 n('Sahkan PP Daerah bukan kelulusan akhir Admin. PP Daerah memproses permohonan dalam skopnya; permohonan sendiri dihantar kepada Admin.')],shots=['pp_semakan_permohonan','pp_sahkan_permohonan'],caption='Senarai permohonan daerah dan panel pengesahan')

page('Admin','Utama dan ringkasan pengurusan',[
 s('Pada <b>Utama</b>, semak bahagian <b>Perlu tindakan</b> untuk kekosongan atau pengganti pegawai.'),
 s('Semak ringkasan permohonan menunggu, akaun pengadil aktif, laporan RA menunggu dan perlawanan bulan ini.'),
 s('Buka <b>Kelulusan</b> untuk permohonan yang tersedia bagi keputusan Admin.'),
 s('Buka <b>Lantikan</b> untuk kejohanan, jadual serta pelantikan pegawai.'),
 s('Untuk pengguna, statistik dan pengumuman, buka <b>Profil > Di website</b> dan pilih menu berkaitan.'),
 n('Halaman mudah alih menyediakan tindakan utama. Jumlah pada Utama bukan senarai lengkap semua modul portal. Gunakan Dashboard penuh di website untuk pengurusan lanjutan.')],shot='admin_utama',caption='Utama Admin dengan tindakan dan ringkasan operasi')

page('Admin','Luluskan atau tolak permohonan',[
 s('Buka <b>Kelulusan</b>. Senarai memuatkan permohonan berstatus <b>Menunggu Admin</b> bagi tahun semasa.'),
 s('Tekan pemohon untuk semakan. Buka <b>Dokumen penuh di website</b> jika perlu melihat semua dokumen, bukti dan sejarah.'),
 s('Tekan <b>Luluskan</b>, isi catatan pilihan dan tekan <b>Sahkan lulus</b>.'),
 s('Untuk menolak, tekan <b>Tolak</b>, isi sebab penolakan dan tekan <b>Sahkan tolak</b>.'),
 s('Pastikan mesej berjaya dan rekod senarai dikemas kini. Untuk sesi lain atau urusan lanjutan, gunakan website.'),
 n('Kelulusan dokumen pengadil boleh menghasilkan Admin Diluluskan dengan urusan kecergasan seterusnya. Semak status pendaftaran, ujian, seminar, patch dan lesen secara berasingan.')],shots=['admin_kelulusan','admin_lulus'],caption='Senarai Kelulusan Admin dan panel pengesahan lulus')

page('Pengurusan lantikan','Pilih kejohanan dan jadual',[
 s('Admin atau PP Daerah: buka <b>Lantikan</b>. Pilih <b>Aktif</b> atau <b>Semua</b> mengikut keperluan.'),
 s('Tekan kejohanan yang betul. Semak nama, jenis serta julat tarikh sebelum meneruskan.'),
 s('Pada jadual, baca nombor perlawanan, tarikh, masa, pasukan dan tempat. Semak ringkasan penerimaan pegawai pada kad.'),
 s('Tekan perlawanan untuk membuka <b>Lantik pegawai</b>. Gunakan <b>Tambah perlawanan</b> untuk jadual baharu dalam kejohanan tersebut.'),
 n('PP Daerah tertakluk kepada skop yang dibenarkan pelayan. Penciptaan atau pengurusan kejohanan dan kerja pukal dibuat melalui website apabila tidak disediakan dalam aplikasi.')],shots=['admin_lantikan','admin_jadual'],caption='Pilihan kejohanan dan senarai jadual perlawanan')

page('Pengurusan lantikan','Tambah perlawanan dalam jadual',[
 s('Buka <b>Lantikan > kejohanan > Tambah perlawanan</b>.'),
 s('Pilih <b>Tarikh</b> dan <b>Masa</b>. Kedua-duanya diperlukan.'),
 s('Isi <b>Pasukan tuan rumah</b> dan <b>Pasukan pelawat</b>. Isi tempat perlawanan yang tepat.'),
 s('Pilih kategori serta peringkat jika berkenaan. Isi kumpulan dan nombor perlawanan apabila diperlukan; tatal untuk medan tambahan.'),
 s('Semak semua butiran, kemudian tekan <b>Simpan perlawanan</b>.'),
 s('Tunggu mesej berjaya, semak nombor perlawanan jika diberikan dan pastikan kad jadual baharu muncul.'),
 n('Jadual baharu belum bermakna pegawai telah dilantik atau dimaklumkan. Selepas menyimpan jadual, buka perlawanan dan lengkapkan lantikan.')],shot='admin_tambah_jadual',caption='Borang jadual perlawanan dalam kejohanan yang dipilih')

page('Pengurusan lantikan','Lantik pegawai dan hantar notifikasi',[
 s('Buka perlawanan dari jadual. Semak pasukan, tarikh, masa dan tempat pada kad atas.'),
 s('Tekan slot kosong atau ikon tambah bagi jawatan yang hendak dilantik. Pilih pegawai daripada pool yang tersedia.'),
 s('Lengkapkan sekurang-kurangnya slot wajib <b>Pengadil</b>, <b>Penolong Pengadil 1</b> dan <b>Penolong Pengadil 2</b>. Isi pegawai keempat dan RA apabila berkenaan.'),
 s('Semak nama serta status setiap slot. <b>Belum Jawab</b> dan <b>Diterima</b> ialah lantikan aktif bagi pemeriksaan slot aplikasi.'),
 s('Tekan <b>Hantar notifikasi</b>, semak bilangan pegawai yang belum menjawab dan sahkan <b>Hantar</b>.'),
 s('Baca hasil penghantaran dan muatkan semula status. Pantau jawapan pegawai; isi pengganti apabila diperlukan.'),
 n('Memilih pegawai dan menghantar notifikasi ialah tindakan berbeza. Penghantaran kepada pegawai belum menjawab memerlukan slot wajib lengkap. Kejayaan menghantar bukan bukti pegawai telah membaca atau menerima lantikan.')],shot='admin_lantik',caption='Slot pegawai, status penerimaan dan butang notifikasi')

page('Pengurusan lantikan','Cari ganti dan buang lantikan',[
 s('Pada slot yang memerlukan pegawai, buka pemilih <b>Lantik</b>.'),
 s('Gunakan carian nama, daerah atau wilayah yang disediakan. Semak nama, kategori, sumber dan bilangan lantikan kejohanan yang dipaparkan.'),
 s('Tekan pegawai yang betul. Tunggu mesej berjaya dan semak nama pada slot selepas halaman dimuatkan semula.'),
 s('Jika perlu mengeluarkan pegawai daripada slot aktif, tekan ikon buang pada lantikan tersebut. Baca panel <b>Buang lantikan?</b> dan sahkan <b>Buang</b>.'),
 s('Lengkapkan pegawai pengganti dan hantar notifikasi mengikut keperluan. Jika pool kosong, rujuk pengurusan pool melalui website.'),
 n('Pelayan boleh menolak pilihan yang tidak layak, bertindih atau di luar skop capaian. Ikut mesej ralat. Jangan menggantikan pegawai hanya berdasarkan nama yang hampir sama.')],shot='admin_pilih_pegawai',caption='Carian dan pemilihan pegawai daripada pool perlawanan')

page('Pengurusan lantikan','Tangguh atau batal perlawanan',[
 s('Buka <b>Lantikan > kejohanan > perlawanan</b>.'),
 s('Tekan menu tiga titik di bahagian atas <b>Lantik pegawai</b>.'),
 s('Pilih <b>Tangguh perlawanan</b> atau <b>Batal perlawanan</b> mengikut keputusan pengurusan.'),
 s('Isi <b>Sebab</b>. Tekan <b>Sahkan tangguh</b> atau <b>Sahkan batal</b>. Gunakan <b>Kembali</b> jika tidak mahu meneruskan.'),
 s('Tunggu mesej berjaya dan semak semula status perlawanan serta makluman kepada pegawai.'),
 h('Selepas penangguhan'),p('Selaraskan jadual baharu dan urusan lantikan melalui aliran pengurusan yang tersedia di website. Maklumkan perubahan operasi kepada pihak yang berkaitan mengikut tatacara organisasi.'),
 n('Batal atau tangguh merekodkan perubahan status berserta sebab. Memadam perlawanan ialah tindakan berasingan yang perlu dibuat dengan tujuan yang tepat.')],shot='pp_lantik_menu',caption='Menu tangguh dan batal pada pengurusan lantikan')

page('Pengurusan lantikan','Padam jadual yang tersalah dibuat',[
 s('Buka jadual kejohanan. Cari perlawanan yang betul berdasarkan nombor, pasukan, tarikh dan masa.'),
 s('Tekan menu tiga titik pada <b>kad jadual</b>, kemudian pilih <b>Padam perlawanan</b>.'),
 s('Baca ringkasan dalam panel <b>Padam perlawanan?</b>. Pastikan ia rekod yang benar-benar perlu dibuang.'),
 s('Tekan <b>Padam</b> untuk mengesahkan atau <b>Batal</b> untuk kembali.'),
 s('Pastikan mesej berjaya dan perlawanan tidak lagi berada dalam jadual. Jika pelayan menolak tindakan, baca sebabnya dan rujuk Admin.'),
 n('Menu ini berada pada kad jadual, berbeza daripada menu batal atau tangguh dalam halaman Lantik pegawai. Untuk perlawanan yang telah dimaklumkan, pertimbangkan keperluan mengekalkan sejarah status dan sebab sebelum membuat pemadaman.')],shot='admin_padam_menu',caption='Menu pemadaman pada kad jadual perlawanan')

page('Portal website','Sambung urusan melalui pelayar',[
 p('Ikon buka di luar aplikasi menunjukkan urusan diteruskan pada website. Gunakan emel dan kata laluan yang sama jika pelayar meminta log masuk.'),
 table(['Peranan atau urusan','Laluan dalam aplikasi'],[
 ['Semua peranan','Profil > Maklumat saya > Kemaskini di website untuk maklumat profil.'],
 ['Pengadil','Permohonan > Mohon untuk borang; Rekod > Penilaian > laporan > PDF di website; Profil > Dashboard penuh atau Statistik saya.'],
 ['Penilai','Permohonan > Mohon untuk pendaftaran; Profil > Dashboard penuh atau Statistik.'],
 ['PP Daerah','Profil > Dashboard penuh atau Statistik daerah. Permohonan Saya dan Tugasan Penilai yang dibenarkan ada di bahagian Lagi.'],
 ['Admin','Profil > Dashboard penuh, Pengguna, Statistik atau Pengumuman.'],
 ['Pengurusan lantikan','Urusan pool, lantikan kumpulan, log audit dan pengurusan lanjutan dibuat melalui website.'],
 ['Semakan permohonan','Buka butiran pemohon > Dokumen penuh di website sebelum membuat keputusan.']]),
 h('Kembali ke aplikasi'),p('Selepas menyimpan di website, kembali ke RefPahang melalui penukar aplikasi atau ikon skrin utama. Muatkan semula senarai yang berkaitan dan semak hasilnya.'),
 n('Akaun adalah sama tetapi sesi aplikasi dan pelayar boleh berasingan. Log keluar daripada kedua-duanya jika menggunakan telefon berkongsi. Alamat rasmi portal ialah https://refpahang.com.')])

page('Penyelesaian masalah','Akses pemasangan dan kemas kini',[
 table(['Masalah','Tindakan mengikut turutan'],[
 ['APK tidak boleh dimuat turun','Semak internet dan ruang storan. Buka pautan rasmi menggunakan pelayar. Tunggu fail lengkap sebelum membukanya.'],
 ['Pemasangan meminta kebenaran sumber','Benarkan sumber khusus yang membuka APK melalui Install unknown apps, kemudian kembali ke pemasang. Nama menu berbeza mengikut telefon.'],
 ['App not installed atau pakej bercanggah','Muat turun semula APK rasmi. Rekodkan mesej penuh, model telefon, versi Android dan versi app. Rujuk sokongan jika masih gagal; jangan terus membuang app.'],
 ['Lupa kata laluan','Gunakan Lupa kata laluan? dan semak peti masuk serta Spam. Minta pautan baharu jika pautan lama tamat tempoh atau telah digunakan.'],
 ['Log masuk gagal atau sesi tamat','Semak emel dan kata laluan. Pastikan internet tersedia. Jika sesi tamat, log masuk semula dengan kata laluan terkini.'],
 ['Semak kemas kini tidak tersedia','Gunakan APK rasmi terkini apabila diarahkan. Pada aplikasi web, tutup dan buka semula dengan internet.'],
 ['Sepanduk kemas kini masih muncul','Simpan kerja, tekan Mula semula dan sahkan. Membatalkan panel tidak mengaktifkan patch.'],
 ['Paparan web lama atau tersekat','Tutup dan buka semula aplikasi. Cuba pautan /app/ dalam Safari. Hubungi sokongan sebelum memadam data laman atau memasang semula.']]),
 n('Sertakan tangkapan skrin ralat tanpa kata laluan, token atau butiran sensitif. Catat masa kejadian dalam waktu Malaysia supaya sokongan boleh menjejak rekod yang sepadan.')])

page('Penyelesaian masalah','Data tugasan laporan dan notifikasi',[
 table(['Masalah','Tindakan mengikut turutan'],[
 ['Tiada tugasan','Muatkan semula dan pilih Semua. Semak peranan akaun serta lantikan dengan pengurusan. Tiada tugasan bukan ralat jika belum dilantik.'],
 ['Butang jawapan tiada atau jawapan ditolak','Semak status, tarikh akhir dan masa sepak mula. Lantikan mungkin telah dijawab, dibatalkan atau tamat tempoh. Hubungi pelantik.'],
 ['Rekod tidak muncul atau kiraan berbeza','Semak tahun dan status pengesahan. Muatkan semula, tatal senarai dan semak sama ada rekod rasmi sudah wujud sebelum menambah.'],
 ['Laporan RA tiada','Pastikan jawatan Penilai Pengadil dan status Diterima. PP yang diberi keupayaan RA menggunakan Profil > Lagi > Tugasan Penilai.'],
 ['Hantar laporan gagal','Isi markah 6.0 hingga 10 bagi semua pegawai. Semak medan lain dan mesej pelayan. Pastikan draf disimpan sebelum cuba menghantar lagi.'],
 ['Permohonan tidak boleh dihantar','Semak sesi, tempoh dibuka, syarat, profil, waris, saiz baju, dokumen dan pengakuan. Betulkan medan yang ditandakan.'],
 ['PDF atau pautan website tidak terbuka','Semak internet, pelayar dan pembaca PDF. Log masuk pada website jika diminta. Jangan berkongsi pautan peribadi untuk mendapatkan bantuan.'],
 ['Notifikasi telefon tidak tiba','Semak kebenaran notifikasi, internet dan tetapan senyap atau Focus. Buka app dan semak Tugasan serta Notifikasi. Pada iPhone, buka dari ikon skrin utama dan aktifkan Web Push.'],
 ['Telegram Dihubungkan tetapi senyap','Semak bot disekat, akaun Telegram aktif dan tetapan chat. Minta sokongan menyemak penghantaran sebenar.']]),
 n('Jika tindakan menerima atau menghantar terputus, semak status pelayan terlebih dahulu. Elakkan menekan penghantaran berulang kali tanpa menyemak hasil terdahulu.')])

page('Peranti dan keselamatan','Log keluar tukar telefon dan pasang semula',[
 h('Log keluar dengan betul'),
 s('Simpan draf dan pastikan semua tindakan terakhir berjaya.'),
 s('Buka <b>Profil</b>, tatal ke bahagian App dan tekan <b>Log keluar</b>.'),
 s('Baca panel pengesahan, kemudian tekan <b>Log keluar</b>. Pastikan skrin log masuk dipaparkan.'),
 p('Notifikasi bagi sesi pada telefon ini dihentikan selepas log keluar. Jika portal dibuka dalam pelayar, log keluar sesi pelayar secara berasingan.'),
 h('Bertukar telefon'),
 p('Simpan kerja pada peranti lama. Log keluar jika masih boleh dicapai. Pasang APK rasmi atau aplikasi web pada telefon baharu, log masuk dengan akaun sedia ada, benarkan notifikasi dan semak tugas serta permohonan. Jangan mendaftar akaun kedua untuk tujuan bertukar peranti.'),
 h('Memadam atau memasang semula'),
 p('Pastikan anda mengetahui emel dan kata laluan. Tindakan membuang aplikasi atau data laman boleh menghapuskan sesi dan isi borang yang belum disimpan. Rekod yang sudah berjaya disimpan di pelayan perlu disemak semula selepas log masuk.'),
 n('Jika telefon hilang atau dicuri, tukar kata laluan melalui peranti dipercayai dan hubungi pentadbir untuk semakan serta penamatan sesi yang berkaitan.')],shot='log_keluar',caption='Pengesahan log keluar dan penghentian notifikasi sesi telefon')

page('Rujukan pantas','Semakan sebelum dan selepas urusan',[
 table(['Urusan','Semak sebelum','Bukti selepas'],[
 ['Jawab lantikan','Perlawanan, jawatan dan had jawapan.','Mesej berjaya dan status Diterima atau Ditolak.'],
 ['Tambah rekod','Tiada rekod sama; daerah, pasukan, tarikh dan pegawai betul.','Rekod muncul dengan status pengesahan.'],
 ['Hantar permohonan','Sesi, syarat, profil, resit serta pengakuan lengkap.','Permohonan muncul dengan sesi dan tarikh hantar.'],
 ['Hantar laporan RA','Semua pegawai dinilai; markah dan ulasan lengkap.','Status Dihantar; bukan hanya Draf.'],
 ['Sahkan rekod PP','Butiran dan pertindihan diperiksa.','Status serta catatan pengesahan dikemas kini.'],
 ['Lulus permohonan','Dokumen, skop dan tahap aliran kerja betul.','Mesej keputusan serta status permohonan.'],
 ['Hantar notifikasi lantikan','Slot wajib lengkap dan pegawai belum menjawab.','Hasil penghantaran; pantau jawapan berasingan.'],
 ['Kemas kini app','Borang dan draf sudah disimpan.','App dibuka semula; versi atau patch disemak.']]),
 h('Istilah ringkas'),
 p('<b>R</b> Pengadil; <b>AR1 / AR2</b> Penolong Pengadil 1 / 2; <b>KUP</b> empat pegawai perlawanan; <b>RA</b> Penilai Pengadil; <b>PP Daerah</b> Pegawai Pembangunan Daerah; <b>R1</b> pendaftaran tahunan; <b>APK</b> fail pemasangan Android; <b>patch</b> kemas kini aplikasi yang diaktifkan selepas mula semula.'),
 h('Hubungi sokongan'),p('<b>sokongan@pbnppahang.my</b><br/>Sertakan emel berdaftar, peranan, model telefon, versi sistem, versi app atau patch, masa kejadian, langkah yang dibuat dan mesej ralat. Elakkan menghantar kata laluan, token, resit penuh atau nombor KP penuh tanpa keperluan yang jelas.')])

page('Rujukan edisi','Versi manual dan sumber rujukan',[
 table(['Perkara','Rujukan edisi ini'],[
 ['Tarikh semakan','20 Oktober 2026, waktu Malaysia.'],
 ['Aplikasi Android','Versi sumber 1.3.0, build 7. Pelayan mengumumkan latest_version 1.3.0 dan min_version 1.2.0 semasa semakan.'],
 ['Pautan Android','https://refpahang.com/app/refpahang.apk - disahkan memberi respons HTTP 200 semasa semakan.'],
 ['Aplikasi web','https://refpahang.com/app/ - laman aplikasi disahkan tersedia semasa semakan.'],
 ['Portal','https://refpahang.com'],
 ['Saluran bantuan','sokongan@pbnppahang.my, seperti dipaparkan pada Profil.']]),
 h('Asas prosedur'),p('Menu dan tindakan dirujuk kepada skrin aplikasi RefPahang, borang website yang dibuka daripadanya dan peraturan semasa pada pelayan. Tangkapan skrin akaun dirender daripada kod aplikasi dengan data contoh pada 20 Oktober 2026. Tiada keputusan operasi sebenar dihantar untuk menghasilkan ilustrasi tersebut.'),
 p('Empat rajah tambahan notifikasi memaparkan widget kad aplikasi web dengan keadaan kebenaran contoh: belum aktif, aktif, perlu pemasangan dan disekat. Kad ini bukan tangkapan dialog kebenaran sistem telefon.'),
 p('Paparan tetapan pemasangan Android dan iPhone diterangkan melalui langkah bertulis kerana rupa menu berbeza mengikut model dan versi sistem. Gambar dalam manual menunjukkan aplikasi RefPahang, bukan tangkapan skrin tetapan semua jenama telefon.'),
 h('Dokumentasi platform'),
 p('<link href="https://developer.android.com/distribute/marketing-tools/alternative-distribution" color="#2463A6">Android Developers - pengedaran APK dan kebenaran sumber pemasangan</link>'),
 p('<link href="https://support.apple.com/en-mide/guide/iphone/iphea86e5236/ios" color="#2463A6">Apple Support - jadikan laman web sebagai aplikasi skrin utama</link>'),
 p('<link href="https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/" color="#2463A6">WebKit - Web Push untuk aplikasi skrin utama iOS dan iPadOS</link>'),
 n('Menu, syarat kelayakan, tarikh pendaftaran dan bayaran boleh berubah. Apabila terdapat perbezaan, rujuk paparan sistem serta arahan rasmi terkini bagi sesi yang berkenaan.')])
