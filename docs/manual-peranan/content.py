"""Role-separated operator manuals. Labels checked against Angular and Worker source."""
BOOKS={}
def P(title,steps=(),shot=None,intro='',note='',chapter='Penggunaan',table=None,mobile=False):
 return dict(title=title,steps=list(steps),shot=shot,intro=intro,note=note,chapter=chapter,table=table,mobile=mobile)
def common(role,home):
 return [
 P('Cara menggunakan manual ini',intro=f'Manual ini khusus untuk {role}. Gunakan portal https://refpahang.com pada komputer atau telefon; aplikasi mobile menggunakan akaun yang sama.',steps=[
 'Cari tugas melalui Kandungan yang boleh diklik atau penanda buku PDF. Ikut nama menu dan butang yang dicetak tebal dalam arahan.',
 'Screenshot ialah antaramuka aplikasi sebenar dengan identiti dianonimkan dan keadaan contoh. Nama, jumlah, tarikh, keputusan dan butiran bayaran dalam rajah bukan data operasi semasa.',
 'Pada telefon, tekan butang menu untuk membuka navigasi. Jadual lebar boleh ditatal mendatar; tatal ke bawah untuk melihat dokumen, butang simpan dan halaman seterusnya.',
 'Selepas menghantar atau menyimpan, tunggu mesej berjaya dan semak semula status rekod. Jika gagal, kekalkan maklumat ralat untuk rujukan sokongan.',
 'Rujukan edisi: 20 Oktober 2026. Lampiran Akaun Tidak Aktif menerangkan sekatan akses dan pengaktifan semula oleh Admin.'],chapter='Mula di sini'),
 P('Peranan, pendaftaran dan status',intro='Empat perkara ini mempunyai maksud berbeza. Semak tahun atau sesi sebelum membuat kesimpulan tentang kelayakan seseorang.',table=[['Istilah','Maksud kepada pengguna'],['Peranan akaun','Admin, PP Daerah, Pengadil atau Penilai. Menentukan panel dan menu. RA ialah Penilai Pengadil.'],['Jenis Pengadil','Kategori atau kelayakan pengadil; bukan bukti pendaftaran tahun semasa.'],['Pendaftaran tahunan','Permohonan pengadil atau penilai untuk sesi tertentu; kelulusan tahun lalu tidak meliputi tahun baharu.'],['Status permohonan','Contohnya Menunggu PP Daerah, Menunggu Admin, Lengkap atau Ditolak.'],['Seminar / kecergasan','Rekod berasingan. Kecergasan menentukan kelayakan patch / lesen negeri; seminar tidak menggantikan keputusan kecergasan.'],['KUP dan RA','KUP: R, AR1, AR2 dan pegawai keempat. RA menilai KUP dan bukan salah satu daripada empat pegawai tersebut.']],chapter='Mula di sini'),
 P('Log masuk dan buka panel sendiri',shot='public-login',intro='Buka https://refpahang.com. Gunakan emel akaun yang didaftarkan dan kata laluan peribadi.',steps=[
 'Isi Emel dan Kata Laluan, kemudian tekan Log Masuk. Semak ejaan emel dan elakkan ruang kosong yang tersalin bersama kata laluan.',
 f'Pastikan panel yang dibuka ialah {home}. Jika sistem meminta pertukaran kata laluan kali pertama, lengkapkan proses itu dahulu.',
 'Jika maklumat salah, betulkan emel atau kata laluan dan cuba semula. Cubaan gagal yang terlalu banyak boleh dihadkan sementara.',
 'Jika akaun tidak aktif atau sistem dalam penyelenggaraan, baca mesej yang dipaparkan. Hubungi Admin jika akses memerlukan semakan.'],chapter='Akses dan akaun'),
 P('Lupa kata laluan dan log keluar',shot='public-forgot-password',steps=[
 'Pada halaman Log Masuk, tekan Lupa kata laluan?. Masukkan emel akaun dan hantar permintaan.',
 'Semak peti masuk serta folder Spam / Junk. Buka pautan pemulihan yang dihantar kepada emel sendiri dan tetapkan kata laluan baharu.',
 'Jika pautan tamat tempoh atau telah digunakan, minta pautan baharu. Jika tiada emel, semak alamat dengan Admin; jangan cipta akaun kedua untuk mengatasi masalah ini.',
 'Selepas selesai bekerja, tekan Log Keluar. Pada telefon atau komputer yang dikongsi, pastikan halaman log masuk muncul semula.'],note='Jangan kongsi kata laluan, pautan pemulihan, pautan jawapan lantikan atau pautan laporan peribadi kepada orang lain.',chapter='Akses dan akaun'),
 P('Tukar kata laluan sendiri',shot='common-password',steps=[
 'Buka Profil / Profil Saya dan cari bahagian Tukar Kata Laluan. Pada aplikasi, fungsi ini tersedia melalui Profil atau menu Lagi.',
 'Masukkan kata laluan semasa, kata laluan baharu dan pengesahan kata laluan seperti diminta.',
 'Patuhi syarat panjang dan pengesahan yang dipaparkan, kemudian tekan Tukar Kata Laluan.',
 'Tunggu pengesahan berjaya. Jika sesi tamat atau diminta log masuk semula, gunakan kata laluan baharu.'],chapter='Akses dan akaun'),
 P('Pasang aplikasi pada Android',shot='mobile-login',mobile=True,intro='Gunakan pautan Android pada halaman Log Masuk atau https://refpahang.com/app/refpahang.apk.',steps=[
 'Muat turun APK rasmi dan tunggu fail selesai dimuat turun. Buka fail melalui Downloads / Files.',
 'Jika diminta, benarkan Install unknown apps / Allow from this source untuk pelayar atau pengurus fail yang digunakan.',
 'Kembali ke pemasang, tekan Install / Pasang dan kemudian Open / Buka.',
 'Log masuk menggunakan akaun portal. Benarkan notifikasi apabila diminta dan semak panel peranan anda.',
 'Jika pemasangan disekat oleh dasar peranti, simpan mesej ralat dan hubungi sokongan. Gunakan aplikasi web sementara menunggu bantuan.'],note='Nama tetapan Android berbeza mengikut jenama. Screenshot ini menunjukkan skrin aplikasi, bukan skrin tetapan setiap jenama telefon.',chapter='Aplikasi dan notifikasi'),
 P('Pasang aplikasi pada iPhone',shot='mobile-notif-install',mobile=True,intro='iPhone menggunakan aplikasi web RefPahang yang ditambah ke skrin utama melalui Safari.',steps=[
 'Buka Safari dan pergi ke https://refpahang.com/app/.',
 'Tekan Kongsi / Share, pilih Add to Home Screen / Tambah ke Skrin Utama dan tekan Add / Tambah.',
 'Jika pilihan Open as Web App dipaparkan, hidupkannya. Buka RefPahang melalui ikon skrin utama.',
 'Log masuk, cari kad Aktifkan notifikasi pada Utama atau Profil, dan ikuti langkah pengaktifan pada halaman berikut.',
 'Jika kad menyatakan aplikasi perlu dipasang, tutup tab biasa dan buka semula melalui ikon skrin utama.'],note='Pemasangan ini tidak menggunakan fail APK Android. Rajah menunjukkan mesej bantuan dalam aplikasi; paparan Share Safari boleh berbeza mengikut versi iOS.',chapter='Aplikasi dan notifikasi'),
 P('Aktifkan notifikasi telefon',shot='mobile-notif-enable',mobile=True,steps=[
 'Buka RefPahang dan log masuk. Cari kad Aktifkan notifikasi pada Utama atau Profil.',
 'Tekan Aktifkan notifikasi, kemudian pilih Allow / Benarkan apabila pelayar atau telefon meminta kebenaran.',
 'Pada iPhone, lakukan langkah ini daripada aplikasi skrin utama. Pada Android APK, semak kebenaran notifikasi RefPahang dalam tetapan aplikasi.',
 'Pastikan status kad bertukar kepada Notifikasi aktif. Kembali ke Profil jika perlu untuk menyemak keadaan semasa.',
 'Buka ikon loceng dalam portal atau menu Notifikasi aplikasi untuk membaca butiran notis. Push, notis dalam portal, emel dan Telegram ialah saluran berasingan.'],note='Rajah kad kebenaran ialah render widget sebenar dengan keadaan contoh; ia bukan bukti kebenaran OS telah diberikan pada telefon anda.',chapter='Aplikasi dan notifikasi'),
 P('Notifikasi disekat atau tidak sampai',shot='mobile-notif-blocked',mobile=True,steps=[
 'Jika kad menunjukkan Disekat, buka tetapan laman / aplikasi pada telefon dan benarkan notifikasi untuk RefPahang.',
 'Semak Focus / Jangan Ganggu, mod senyap, sambungan internet dan had bateri. Buka semula aplikasi selepas mengubah tetapan.',
 'Pada iPhone, pastikan ikon skrin utama digunakan. Pada Android, semak Settings > Apps > RefPahang > Notifications mengikut jenama.',
 'Log masuk semula jika sesi telah tamat. Minta Admin menyemak bahawa notifikasi berkaitan benar-benar telah dihantar.',
 'Jika masih gagal, laporkan jenis telefon, versi aplikasi, status kad notifikasi dan masa kejadian. Semak notis dalam portal sementara menunggu bantuan.'],note='Status Notifikasi aktif menunjukkan langganan tersedia; ia tidak membuktikan setiap notis telah dibaca. Jangan terlepas tarikh tindakan kerana hanya menunggu popup telefon.',chapter='Aplikasi dan notifikasi'),
 P('Hubungkan akaun Telegram',shot='common-telegram',steps=[
 'Buka Profil / Profil Saya dan cari Pemautan Telegram. Semak sama ada status menyatakan Telegram belum dipaut atau berjaya dipaut.',
 'Tekan Hubungkan Telegram dan buka pautan peribadi dalam aplikasi Telegram.',
 'Tekan Mula / Start pada bot. Kembali ke RefPahang dan tekan Semak Status Pemautan jika status belum berubah.',
 'Pastikan status menunjukkan Telegram berjaya dipaut. Jika bot pernah disekat, nyahsekat bot dan mulakan semula pemautan.',
 'Jika akaun Telegram lama dinyahaktifkan atau pautan tamat tempoh, dapatkan pautan baharu melalui profil atau hubungi Admin.'],note='Jangan gunakan pautan pemautan milik orang lain. Pemautan Telegram tidak secara automatik memberikan kebenaran push telefon.',chapter='Aplikasi dan notifikasi'),
 P('Kemas kini aplikasi',shot='mobile-update',mobile=True,steps=[
 'Jika aplikasi memaklumkan versi baharu, baca maklumat kemas kini dan tekan pilihan kemas kini yang tersedia.',
 'Android: muat turun APK terkini daripada pautan rasmi dan pasang menindih aplikasi sedia ada. Lengkapkan pemasangan, kemudian buka semula.',
 'iPhone / aplikasi web: tutup aplikasi dan buka semula ketika bersambung internet. Jika masih paparan lama, muat semula laman dan cuba lagi.',
 'Log masuk semula jika diminta. Semak Profil, Tugasan dan notifikasi selepas kemas kini.',
 'Jika versi minimum diwajibkan oleh sistem, selesaikan kemas kini sebelum meneruskan penggunaan.'],note='Simpan bukti atau draf yang belum dihantar sebelum menutup aplikasi. Versi dan saiz muat turun berubah mengikut keluaran; gunakan maklumat pada aplikasi semasa.',chapter='Aplikasi dan notifikasi'),
 ]
def closing():
 return [
 P('Penyelesaian masalah harian',table=[['Masalah','Tindakan pengguna'],['Menu tidak kelihatan','Semak peranan; buka menu telefon; fungsi tambahan PP memerlukan keupayaan yang diberikan.'],['Senarai kosong','Semak tahun, status, daerah, kata carian dan halaman senarai. Kosong tidak bermakna semua data telah dipadam.'],['Borang tidak boleh dihantar','Lengkapkan profil, dokumen dan perakuan; semak tempoh buka/tutup serta permohonan sedia ada untuk sesi sama.'],['Fail ditolak','Semak format dan saiz; resit JPG/PNG/PDF; gambar JPG/PNG yang berjaya diproses. Jangan sekadar menukar nama sambungan fail.'],['Sesi tamat','Log masuk semula. Semak dahulu sama ada tindakan terakhir berjaya sebelum menghantar semula.'],['Mesej rekod telah berubah','Muat semula butiran dan semak keadaan terkini. Elakkan mengulang tindakan daripada tab lama.'],['PDF tidak terbuka','Benarkan tab baharu / muat turun untuk portal; semak Downloads. Jangan kongsi PDF yang mengandungi data peribadi kepada umum.']],chapter='Bantuan dan rujukan'),
 P('Cara mendapatkan bantuan',intro='Hubungi Admin atau Pegawai Pembangunan Daerah untuk urusan rekod, kelayakan dan permohonan. Sokongan teknikal yang tertera pada portal: sokongan@pbnppahang.my.',steps=[
 'Sediakan nama peranan, menu yang digunakan, tahun / sesi, nombor permohonan atau nombor perlawanan dan masa masalah berlaku.',
 'Sertakan screenshot mesej ralat. Lindungi kata laluan, pautan peribadi, nombor akaun dan data sensitif sebelum berkongsi.',
 'Terangkan tindakan terakhir yang dibuat dan hasil yang dijangka. Nyatakan sama ada menggunakan web komputer, Android APK atau aplikasi skrin utama iPhone.',
 'Jika berkaitan transaksi simpan / hantar, semak status semasa dan maklumkan jika rekod telah muncul. Elakkan membuat akaun atau permohonan pendua.',
 'Selepas penyelesaian, buka semula rekod, sahkan status betul dan simpan nombor rujukan untuk susulan.'],note='Manual ini menerangkan tatacara pengguna. Ia tidak mengesahkan penghantaran emel/push pada setiap peranti atau memberi kuasa meluluskan di luar skop peranan.',chapter='Bantuan dan rujukan'),
 P('Lampiran: sebab Akaun Tidak Aktif',shot='common-inactive',intro='Akaun Tidak Aktif tidak boleh log masuk. Popup menerangkan sebab sekatan selepas kata laluan disahkan.',steps=[
 'Pendaftaran: bagi akaun Pengadil yang melalui dua tahun kalendar penuh, sistem memeriksa dua tahun lengkap sebelumnya. Untuk 2026, tahun rujukan ialah 2024 dan 2025.',
 'Permohonan yang telah dihantar sudah dikira walaupun belum diluluskan. Akaun baharu tidak dikenakan tahun sebelum melalui dua tahun penuh.',
 'Manual: Admin boleh menandakan akaun Tidak Aktif dengan sebab. Aktiviti: semua pengguna kecuali Admin disekat selepas 8 bulan tanpa aktiviti atau log masuk.',
 'Popup menunjukkan sebab apabila maklumat log masuk betul. Hanya Admin boleh mengaktifkan semula akaun; sejarah permohonan, perlawanan dan laporan dikekalkan.'],note='Pengaktifan semula memerlukan log masuk baharu. Tempoh 8 bulan bermula semula; semakan pendaftaran seterusnya berlaku pada tahun kalendar berikutnya.',chapter='Lampiran kemas kini'),
 ]

def registration(role):
 return [
 P('Daftar akaun baharu: pilih peranan',shot='public-registration-ra' if role=='RA' else 'public-registration-role',intro='Pendaftaran akaun dan permohonan pendaftaran tahunan ialah dua urusan berbeza. Akaun baharu belum bermaksud sudah menjadi pengadil atau penilai berdaftar bagi sesuatu tahun.',steps=[
 'Pada Log Masuk, tekan Daftar Akaun Baharu. Halaman hanya menerima pendaftaran ketika tempoh yang ditetapkan Admin dibuka.',
 'Isi nama seperti KP, nombor KP 12 digit tanpa tanda sengkang, emel, telefon, jantina dan persatuan daerah.',
 f'Pilih peranan {"Penilai Pengadil" if role=="RA" else "Pengadil"}. Pilihan awam hanya Pengadil dan Penilai; akaun Admin serta PP Daerah diwujudkan oleh pentadbir.',
 'Jika memilih Pengadil, pilih Jenis Pengadil yang sesuai: Pengadil Baharu, Pengadil Negeri atau Pengadil Kebangsaan. Jangan memilih kategori semata-mata untuk membuka menu lain.'],chapter='Pendaftaran akaun'),
 P('Daftar akaun: profil dan dokumen',shot='public-registration-ra-documents' if role=='RA' else 'public-registration-documents',steps=[
 'Lengkapkan alamat kediaman, poskod lima digit, daerah, negeri dan status pekerjaan.',
 'Jika status pekerjaan memerlukan maklumat majikan, lengkapkan jawatan, institusi, alamat dan poskod majikan. Isi maklumat waris dan telefon waris 10 atau 11 digit.',
 'Untuk Pengadil, isi saiz baju dan tahun mula aktif yang sah. Muat naik gambar profil JPG/PNG dan tunggu pemprosesan gambar selesai.',
 'Semak semula semua maklumat, tandakan pengesahan data dan tekan Hantar Pendaftaran. Betulkan medan merah jika pengesahan gagal.'],note='Gambar yang diproses perlu berada dalam julat 150-400 piksel dan maksimum 200KB. Sistem memproses gambar; jangan hanya menukar sambungan fail.',chapter='Pendaftaran akaun'),
 P('Selepas pendaftaran akaun berjaya',steps=[
 'Baca mesej Pendaftaran Berjaya dan semak emel untuk maklumat akses / kata laluan yang dihantar sistem.',
 'Jika pautan Telegram diberikan, buka pautan itu dengan akaun Telegram sendiri dan tekan Start. Jangan berkongsi pautan peribadi.',
 'Log masuk dan tukar kata laluan apabila diminta. Semak profil sebelum memulakan permohonan tahunan.',
 'Jika emel atau nombor KP sudah berdaftar, gunakan pemulihan kata laluan atau minta Admin menyemak akaun sedia ada.',
 'Jika pendaftaran berjaya tetapi emel tidak diterima, maklumkan kepada Admin. Jangan menghantar pendaftaran berulang dengan alamat lain.'],note='Kelulusan pendaftaran tahunan, keputusan ujian dan kelayakan lesen diproses melalui menu permohonan selepas akaun diwujudkan.',chapter='Pendaftaran akaun'),
 ]

def personal_assignments(shot):
 return [
 P('Semak dan jawab lantikan sendiri',shot=shot,steps=[
 'Buka Tugasan / Notifikasi Lantikan atau pautan tindakan pada Dashboard. Tapis Belum Jawab untuk mencari lantikan yang memerlukan keputusan.',
 'Semak kejohanan, nombor perlawanan, tarikh, masa, tempat dan jawatan. Semak juga tempoh jawapan yang dipaparkan.',
 'Jika bersedia, tekan Terima dan sahkan. Jika tidak dapat bertugas, tekan Tolak dan isi sebab penolakan sebelum menghantar.',
 'Tunggu mesej berjaya dan pastikan status berubah kepada Diterima atau Ditolak. Jika butang tiada, semak status dan hubungi pelantik.'],note='Pautan emel/Telegram boleh membuka halaman jawapan peribadi. Semak identiti dan perlawanan sebelum menjawab; jangan jawab bagi pihak pegawai lain.',chapter='Tugasan dan lantikan'),
 P('Tarikh akhir dan perubahan lantikan',table=[['Keadaan','Cara bertindak'],['Liga','Had biasa ialah 48 jam sebelum sepak mula, dikira daripada jadual perlawanan.'],['Selain Liga','Had biasa ialah 3 jam sebelum sepak mula.'],['Lantikan lewat','Jika notifikasi pertama dihantar selepas had biasa, pegawai boleh menjawab sehingga sepak mula. Baca tarikh sebenar pada pautan.'],['Belum Jawab','Semak sama ada notifikasi sudah dihantar. Lantikan biasa yang tidak dijawab boleh ditolak automatik pada had berkenaan.'],['Dibatalkan / Ditangguhkan','Jangan menganggap surat lama masih berkuat kuasa. Semak notis terbaru dan hubungi pelantik.'],['Sudah terima tetapi ada halangan','Maklumkan segera kepada Admin / PP Daerah. Pelantik perlu mengurus pembatalan atau penggantian; jangan hanya mengabaikan tugasan.']],note='Had ini bukan tempoh 48 jam atau 3 jam selepas emel diterima. Masa rujukan ialah waktu sepak mula dan notifikasi lantikan yang direkodkan.',chapter='Tugasan dan lantikan'),
 P('Surat lantikan dan butiran perlawanan',shot='mobile-assignment-detail',mobile=True,steps=[
 'Buka butiran tugasan yang berkenaan. Semak jawatan dan maklumat perlawanan pada kad atau senarai.',
 'Jika pautan Surat / Surat Lantikan disediakan, bukanya dan simpan PDF melalui fungsi muat turun / kongsi peranti.',
 'Semak status semasa sebelum menggunakan surat. Cetakan lama tidak menggantikan maklumat pembatalan atau penangguhan terbaru.',
 'Selepas bertugas, lakukan urusan peranan masing-masing: Pengadil menyemak rekod; RA menyediakan laporan; PP mengurus semakan daerah.'],note='Rajah ialah butiran tugasan pada aplikasi mobile. Pada portal, fungsi surat dan jawapan terletak pada baris lantikan atau pautan emel/Telegram.',chapter='Tugasan dan lantikan'),
 ]

admin=[
 P('Skop kerja dan menu Admin',shot='admin-dashboard',intro='Admin mengurus seluruh sistem: pengguna, permohonan, pendaftaran, kejohanan, lantikan, laporan, komunikasi dan tetapan.',steps=[
 'Dashboard: lihat perkara menunggu tindakan dan pilih pautan untuk membuka senarai berkaitan.',
 'Permohonan: pilih Permohonan Pengadil atau Permohonan Penilai. Pengadil & Pegawai: buka senarai pengadil, penilai, PP Daerah dan Pengguna.',
 'Lantikan & Perlawanan: urus kejohanan, rekod perlawanan dan Pengadil Luar. Komunikasi: buka Chat Pengguna, Pengumuman dan Peti Emel.',
 'Pengurusan Sistem: buka Statistik, Tetapan dan Profil Saya. Pilih tahun atau sesi yang betul sebelum membuat semakan.'],chapter='Panduan Admin'),
 P('Tambah akaun Admin, PP dan pengguna',shot='admin-user-add',steps=[
 'Buka Pengadil & Pegawai > Pengguna, kemudian tekan Tambah Pengguna.',
 'Isi Nama Penuh, Emel dan No. Telefon. Pilih Peranan; jangan menganggap Jenis Pengadil menentukan kuasa panel.',
 'Pilih FA Daerah bagi peranan yang memerlukannya dan pilih Jenis Pengadil yang sepadan dengan rekod sebenar.',
 'Tekan Tambah. Sistem menjana kata laluan dan menghantar maklumat pendaftaran mengikut saluran yang tersedia.',
 'Semak pengguna muncul pada senarai. Minta pengguna menukar kata laluan dan melengkapkan profil sendiri.'],note='Akaun awam Pengadil/Penilai juga boleh didaftarkan melalui /daftar. Penciptaan akaun bukan kelulusan permohonan tahunan.',chapter='Pengguna dan pegawai'),
 P('Cari, tapis dan kemas kini pengguna',shot='admin-users',steps=[
 'Buka Pengguna. Gunakan carian nama/emel, penapis peranan, jenis/status pendaftaran dan tahun.',
 'Semak status tahunan pada tahun dipilih. Pengadil Tidak Aktif dalam penapis pendaftaran bukan semestinya akaun yang disekat log masuk.',
 'Tekan Edit Profil untuk membuka profil penuh. Betulkan medan yang berkenaan dan tekan Simpan.',
 'Jika menukar emel atau peranan, semak penerima dan akses selepas simpan. Pengguna mungkin perlu log masuk semula atau menggunakan emel baharu.',
 'Tekan Muat Turun Master Data apabila memerlukan fail Excel lengkap. Penapis tahun menentukan rujukan status tahunan; eksport master merangkumi sejarah.'],note='Fail master mengandungi maklumat peribadi. Simpan dalam lokasi terkawal dan kongsi hanya untuk urusan yang dibenarkan.',chapter='Pengguna dan pegawai'),
 P('Reset kata laluan dan hantar emel semula',shot='admin-users',steps=[
 'Cari pengguna melalui emel atau nama dan semak identitinya sebelum tindakan.',
 'Tekan Reset Kata Laluan. Baca dialog pengesahan dan sahkan hanya untuk akaun yang betul.',
 'Semak mesej hasil. Maklumkan pengguna supaya menyemak emel dan menukar kata laluan selepas boleh log masuk.',
 'Untuk mengulang emel pendaftaran, tekan Hantar Semula Emel pada pengguna berkenaan dan sahkan dialog.',
 'Jika emel masih gagal, semak alamat dan saluran penghantaran; tidak perlu mewujudkan akaun pendua.'],note='Jangan gunakan reset kata laluan untuk memintas akaun tidak aktif. Pengaktifan akses ialah tindakan berasingan.',chapter='Pengguna dan pegawai'),
 P('Senarai pengadil dan penilai berdaftar',shot='admin-registered',steps=[
 'Buka Pengadil & Pegawai > Pengadil Berdaftar atau Penilai Pengadil Berdaftar.',
 'Pilih tahun pendaftaran/ujian dan penapis yang berkaitan. Semak persatuan, jenis pengadil, keputusan ujian dan status tahun tersebut.',
 'Buka profil pegawai untuk menyemak permohonan, rekod perlawanan dan maklumat kelayakan yang disediakan.',
 'Gunakan Excel / Cetak bagi senarai yang diperlukan. Semak tahun dan penapis pada hasil eksport sebelum mengedarkan.',
 'Jika butiran profil perlu dibetulkan, gunakan tindakan kemas kini yang disediakan atau menu Pengguna.'],note='RA berdaftar dan Pengadil berdaftar ialah senarai berbeza. Kehadiran seminar, lulus kecergasan dan kelulusan pendaftaran perlu dibaca berasingan.',chapter='Pengguna dan pegawai'),
 P('Urus Pegawai Pembangunan Daerah',shot='admin-pp-list',steps=[
 'Buka Pengadil & Pegawai > Pegawai Pembangunan Daerah.',
 'Cari nama atau tapis persatuan/status. Semak daerah pentadbiran sebelum menyunting.',
 'Buka butiran untuk melihat profil. Gunakan tindakan edit untuk membetulkan maklumat akaun dan persatuan apabila diperlukan.',
 'Semak keupayaan tambahan Pengadil atau RA daripada bukti kelayakan/pendaftaran yang sah; peranan PP sahaja tidak membuktikan kedua-duanya.',
 'Minta PP log masuk semula untuk memastikan menu daerah dan tugasan sendiri sepadan.'],chapter='Pengguna dan pegawai'),
 P('Tetapkan tempoh pendaftaran dan permohonan',shot='admin-settings',steps=[
 'Buka Pengurusan Sistem > Tetapan. Cari Status Penerimaan Permohonan.',
 'Tetapkan pembukaan Daftar Akaun Baru secara berasingan daripada pendaftaran tahunan, Penilai, Kelas III FAM dan Kelas I FAM.',
 'Semak suis buka/tutup serta Tarikh Buka dan Tarikh Tutup setiap jenis. Tetapkan sesi/tahun permohonan yang betul.',
 'Simpan tetapan menggunakan butang simpan pada halaman. Semak badge dibuka, belum dibuka atau ditutup.',
 'Uji secara baca sahaja halaman pendaftaran / borang berkaitan untuk memastikan tempoh yang dipaparkan sepadan.'],note='Tarikh dan suis kedua-duanya penting. Perubahan satu jenis borang tidak semestinya membuka jenis borang lain.',chapter='Permohonan dan keputusan'),
 P('Tetapan bayaran, syarat dan penyelenggaraan',shot='admin-settings',steps=[
 'Tatal Tetapan untuk menyemak amaun yuran, maklumat akaun penerima, had umur, syarat Kelas I / III dan nilai kelayakan yang disediakan.',
 'Masukkan nilai berdasarkan arahan rasmi semasa, kemudian simpan. Semak paparan borang selepas perubahan.',
 'Untuk Mod Penyelenggaraan, semak suis pada bahagian atas. Apabila diaktifkan, akses pengguna bukan Admin dihadkan.',
 'Gunakan mod itu hanya ketika kerja penyelenggaraan yang dirancang. Selepas selesai, matikan dan semak pengguna boleh mengakses semula.'],note='Amaun, akaun bank dan had dalam screenshot ialah keadaan contoh. Pemohon mesti merujuk maklumat pada borang sesi semasa, bukan menyalin nombor daripada manual.',chapter='Permohonan dan keputusan'),
 P('Semak permohonan mengikut jenis dan tahun',shot='admin-applications',steps=[
 'Buka Permohonan > Permohonan Pengadil atau Permohonan Penilai. Pilih tab yang betul: Pengadil Berdaftar, Kelas III FAM, Ujian Kelas I FAM atau Penilai.',
 'Pilih tahun dan tapis status/persatuan. Cari nama atau nombor KP untuk mengelakkan tersalah pemohon.',
 'Tekan Butiran Lanjut. Semak profil, tahun, dokumen/resit, perakuan dan catatan pengesahan PP Daerah.',
 'Pastikan permohonan sudah berada pada Menunggu Admin sebelum meluluskan. Permohonan yang masih Menunggu PP Daerah perlu diselesaikan pada peringkat PP.'],chapter='Permohonan dan keputusan'),
 P('Luluskan atau tolak permohonan',shot='admin-application-approve',steps=[
 'Pada permohonan yang betul, tekan Ubah Status dan pilih Lulus. Semak nama pada dialog.',
 'Isi nota jika perlu dan tekan Luluskan. Semak mesej berjaya serta status selepas senarai dimuatkan semula.',
 'Jika tidak memenuhi syarat, pilih Tolak, masukkan sebab yang jelas dan lengkapkan pengesahan.',
 'Jika mesej menyatakan rekod telah diproses atau tidak ditemui, muat semula dan semak status terkini sebelum mengulang.'],note='Mulai sesi 2027 bagi pendaftaran Pengadil, kelulusan dokumen boleh menjadi Admin Diluluskan sementara menunggu kecergasan. Ini tetap pendaftaran diluluskan; kelayakan patch/lesen memerlukan keputusan kecergasan.',chapter='Permohonan dan keputusan'),
 P('Rekod seminar dan ujian kecergasan',shot='admin-seminar',steps=[
 'Pilih sesi dan permohonan Pengadil yang betul. Tekan Seminar untuk merekod Hadir, Tidak Hadir atau mengosongkan rekod jika pembetulan diperlukan.',
 'Gunakan Ujian pada permohonan yang dibenarkan untuk merekod Lulus, Tidak Lulus atau Tidak Hadir.',
 'Jika butang Ujian belum dibenarkan, semak kelulusan dokumen/status semasa dahulu. Jangan mengubah keputusan kategori borang lain.',
 'Semak senarai berdaftar dan kelayakan patch/lesen selepas kemas kini. Rekod seminar tidak menggantikan lulus kecergasan.'],note='Data sesi lama boleh mempunyai rekod kecergasan berasingan; sesi 2027 dan seterusnya menggunakan keputusan pada pendaftaran tahunan. Semak tahun sebelum membetulkan.',chapter='Permohonan dan keputusan'),
 P('Keputusan Kelas III dan Kelas I FAM',shot='admin-exams',steps=[
 'Pada Permohonan Pengadil, pilih Kelas III FAM atau Ujian Kelas I FAM dan tahun berkenaan.',
 'Semak butiran pemohon, kelayakan, resit dan aliran pengesahan sebelum memproses.',
 'Gunakan tindakan status/ujian yang disediakan untuk merekod keputusan atau Tidak Hadir berdasarkan keputusan rasmi.',
 'Semak semula status dan rekod kelayakan tahun selepas tindakan. Bezakan keputusan peperiksaan daripada pendaftaran tahunan.'],note='Halaman tambahan /admin/ujian memaparkan kumpulan ujian lama. Untuk kerja biasa, gunakan tab jenis permohonan dan tahun supaya rekod berkaitan tidak tersalah diproses.',chapter='Permohonan dan keputusan'),
 P('Padam permohonan dan semak laporan ringkasan',shot='admin-extra-reports',steps=[
 'Jika rekod permohonan benar-benar perlu dibuang, cari permohonan tepat melalui jenis, tahun, nama dan nombor rujukan.',
 'Tekan Padam, baca amaran dan sahkan hanya selepas semakan. Jangan gunakan pemadaman untuk menggantikan keputusan Tolak.',
 'Semak senarai selepas tindakan. Sejarah perlawanan pengguna perlu kekal walaupun pautan permohonan tidak lagi tersedia.',
 'Untuk ringkasan kategori, gunakan Statistik atau halaman tambahan /admin/laporan. Pilih tahun dan kategori sebelum membaca jumlah / mengeksport.'],note='Pemadaman mengubah rekod permohonan. Tindakan ini berbeza daripada menyekat akses akaun pengguna.',chapter='Permohonan dan keputusan'),
 P('Pengadil luar: maksud dan skop',shot='admin-external',intro='Pengadil Luar menyimpan pegawai yang tidak didaftarkan sebagai pengguna portal bagi tujuan pool dan lantikan, termasuk pegawai jemputan.',steps=[
 'Buka Lantikan & Perlawanan > Pengadil Luar. Cari nama, daerah, negeri, emel atau nombor telefon.',
 'Semak sama ada pegawai sebenarnya sudah mempunyai akaun pengguna RefPahang. Gunakan pegawai berdaftar dalam pool apabila identiti itu sudah wujud.',
 'Rekod pengadil luar bukan akaun log masuk Admin/PP/RA/Pengadil. Pautan lantikan, Telegram dan laporan peribadi digunakan mengikut tugas yang diberikan.',
 'Tapis daerah/negeri untuk menyemak senarai sebelum menambah, mengimport atau membetulkan maklumat.'],chapter='Pengadil luar'),
 P('Tambah, edit dan padam pengadil luar',shot='admin-external-add',steps=[
 'Pada Pengadil Luar, tekan Tambah. Isi Nama Penuh, Daerah dan Negeri yang diwajibkan.',
 'Pilih Jenis Pengadil dan isi nombor telefon serta emel yang sah. Semak saluran hubungan sebelum tekan Simpan.',
 'Untuk pembetulan, tekan Edit pada baris pegawai, kemas kini medan dan simpan.',
 'Untuk Padam atau Padam Pukal, semak pegawai terpilih dan baca dialog. Pegawai turut dikeluarkan daripada pool yang berkaitan.'],note='Padam pengadil luar ialah tindakan berbeza daripada Tidak Aktif pada akaun pengguna. Jangan memadam pegawai untuk membatalkan satu lantikan sahaja.',chapter='Pengadil luar'),
 P('Import Excel pengadil luar',shot='admin-external-upload',steps=[
 'Tekan Muat Naik Excel dan Muat Turun Template. Gunakan lajur Nama, Daerah dan Negeri; lajur telefon, emel serta jenis pengadil membantu pemadanan.',
 'Isi helaian pertama, semak ejaan negeri, nombor telefon dan emel. Pilih fail dalam dialog upload.',
 'Semak pratonton sebelum tekan Muat Naik. Betulkan fail jika header wajib atau baris data tidak sah.',
 'Baca keputusan inserted / skipped, senarai ralat dan padanan pengguna berdaftar. Sistem boleh memadankan telefon, emel atau nama dan mengelakkan rekod luar pendua.',
 'Semak semula senarai selepas import. Betulkan hanya baris gagal; jangan menganggap semua baris dimasukkan hanya kerana fail berjaya dibaca.'],note='Gunakan template yang dimuat turun daripada versi semasa. Semakan pratonton di pelayar dan keputusan penerimaan pelayan ialah dua peringkat berbeza.',chapter='Pengadil luar'),
 P('Cipta dan kemas kini kejohanan',shot='admin-tournament-add',steps=[
 'Buka Lantikan & Perlawanan > Lantikan Pengadil, tab 1 Kejohanan dan tekan Tambah.',
 'Isi Nama Kejohanan, Jenis Kejohanan, Peringkat, tarikh mula/akhir, tempat, anjuran dan status.',
 'Semak jenis Liga atau bukan Liga kerana ia mempengaruhi tarikh akhir jawapan lantikan. Simpan dan pilih kejohanan daripada senarai.',
 'Gunakan Edit untuk pembetulan dan kawalan logo jika diperlukan. Semak pemilik lantikan Admin atau PP Daerah sebelum mengurus rekod.',
 'Padam Kejohanan hanya selepas membaca amaran bahawa jadual dan lantikan berkaitan boleh terkesan.'],chapter='Kejohanan, pool dan jadual'),
 P('Tambah pegawai ke pool kejohanan',shot='admin-pool-add',steps=[
 'Pilih kejohanan, kembali ke tab 1 Kejohanan dan cari Pool Pengadil Kejohanan.',
 'Tekan Tambah ke Pool. Pilih tab Pengadil Berdaftar (Pahang) atau Pengadil Luar.',
 'Cari pegawai, tandakan pilihan yang betul dan tekan Tambah ke Pool. Semak nama, jenis, daerah/negeri serta saluran hubungan selepas ditambah.',
 'Jika menggunakan padanan Excel, muat turun template, isi Nama atau No IC serta butiran sokongan, kemudian semak padanan sebelum memilih.',
 'Buang daripada pool hanya jika pegawai tidak lagi perlu tersedia untuk kejohanan; semak lantikan sedia ada terlebih dahulu.'],note='Pool ialah senarai calon, bukan lantikan. Pegawai hanya mendapat tugas apabila dimasukkan ke slot perlawanan.',chapter='Kejohanan, pool dan jadual'),
 P('Pautan Telegram untuk pengadil luar dalam pool',shot='admin-pool',steps=[
 'Pastikan pengadil luar dimasukkan ke pool dan mempunyai butiran emel yang sesuai untuk penghantaran pautan.',
 'Pada Pool Pengadil Kejohanan, tekan Blast Pautan Telegram. Butang boleh tidak aktif jika pool tiada pengadil luar.',
 'Semak ringkasan penerima, status sudah/belum dipaut dan pilihan penghantaran awal atau percubaan semula yang disediakan.',
 'Sahkan penghantaran hanya selepas memeriksa sasaran. Pengadil luar perlu membuka pautan peribadi dan menekan Start pada bot.',
 'Pantau hasil penghantaran serta status pemautan. Kegagalan emel, bot disekat atau akaun Telegram tidak aktif memerlukan pembetulan saluran.'],note='Blast pautan Telegram ialah bantuan pemautan, bukan notifikasi lantikan perlawanan. Jangan menghantar berulang tanpa menyemak keputusan percubaan sebelumnya.',chapter='Kejohanan, pool dan jadual'),
 P('Tetapkan Pengerusi Pengadil',shot='admin-chair',steps=[
 'Pilih kejohanan dan buka tab 1 Kejohanan. Pada Pengerusi Pengadil, tekan Tetapkan Pengerusi.',
 'Cari calon daripada pegawai berdaftar atau pengadil luar yang dibenarkan; pilih calon yang tepat.',
 'Semak nama, jawatan dan butiran hubungan, kemudian lengkapkan pengesahan.',
 'Jika menukar Pengerusi, baca amaran tentang pautan laporan yang masih menunggu. Semak nama Pengerusi pada kejohanan selepas simpan.'],note='Tetapan Pengerusi menentukan penerima pengesahan laporan RA. Jika belum ditetapkan, laporan boleh menunggu tindakan pentadbir sebelum penghantaran pengesahan.',chapter='Kejohanan, pool dan jadual'),
 P('Tambah dan edit jadual perlawanan',shot='admin-schedule-add',steps=[
 'Pada kejohanan yang dipilih, buka tab 2 Jadual Perlawanan dan tekan Tambah Perlawanan.',
 'Isi tarikh, masa, pasukan tuan rumah/pelawat, tempat, kategori, peringkat dan kumpulan jika berkenaan.',
 'Isi daerah serta negeri pasukan apabila diperlukan untuk semakan pertindihan kawasan. Semak nombor perlawanan atau pilihan nombor automatik.',
 'Tekan Simpan. Gunakan Edit pada baris untuk pembetulan dan semak semula tarikh, masa dan tempat sebelum melantik pegawai.'],note='Menukar jadual tidak bermaksud semua pegawai sudah membaca perubahan. Gunakan proses notifikasi dan semak status selepas perubahan penting.',chapter='Kejohanan, pool dan jadual'),
 P('Muat naik jadual melalui Excel',shot='admin-schedule-upload',steps=[
 'Pada tab Jadual Perlawanan, tekan Muat Naik Excel dan muat turun Template.',
 'Isi No Perlawanan, Tarikh, Masa, Kategori, Peringkat, Kumpulan, Pasukan Home/Away, Padang serta Daerah/Negeri jika digunakan.',
 'Pilih fail. Semak pratonton dan baris ralat, khususnya format tarikh, masa, pasukan dan kategori.',
 'Hantar selepas betul dan baca keputusan import. Semak jumlah serta susunan jadual selepas dimuat naik.',
 'Jika fungsi Nombor Semula disediakan, semak amaran kerana nombor perlawanan sedia ada boleh berubah.'],note='Tarikh dan Masa ialah header wajib pada pembaca semasa. Gunakan template portal; jangan menukar format lajur secara rawak.',chapter='Kejohanan, pool dan jadual'),
 P('Lantik KUP dan RA bagi perlawanan',shot='admin-appointment-detail',steps=[
 'Buka tab 3 Lantikan Pengadil dan tekan Lantik pada perlawanan, atau Lantik Pengadil pada baris jadual.',
 'Semak identiti perlawanan. Pilih pegawai daripada pool untuk R, AR1 dan AR2; tambah Pegawai ke4 dan Penilai Pengadil jika diperlukan.',
 'Gunakan carian, daerah/negeri dan jumlah tugasan untuk menyemak calon. Semak amaran pertindihan sebelum mengesahkan.',
 'Sahkan setiap slot dan pastikan nama serta status dipaparkan. Jangan gunakan RA untuk menggantikan salah satu tiga jawatan KUP wajib.',
 'Lantikan disimpan belum bermaksud notifikasi sudah dihantar. Teruskan ke proses penghantaran dan audit.'],chapter='Lantikan dan penghantaran'),
 P('Hantar notifikasi dan semak jawapan',shot='admin-appointments',steps=[
 'Semak semua slot, alamat emel/Telegram, tarikh dan masa perlawanan sebelum menekan Hantar Notifikasi.',
 'Gunakan penghantaran per perlawanan atau pilihan pukal bagi perlawanan yang dipilih. Baca dialog sasaran sebelum mengesahkan.',
 'Semak hasil penghantaran dan status Belum Jawab, Diterima atau Ditolak. Memilih pegawai sahaja tidak membuktikan mereka sudah dimaklumkan.',
 'Jika Ditolak, gunakan Ganti untuk memilih pegawai pengganti, semak semula butiran dan hantar notifikasi yang berkaitan.',
 'Untuk kegagalan saluran, buka Pautan & Log, betulkan hubungan atau gunakan pautan peribadi mengikut tatacara audit.'],note='Notifikasi boleh dihantar melalui emel, Telegram dan saluran portal/aplikasi yang tersedia. Status penghantaran bukan bukti pegawai telah membaca atau menerima tugas.',chapter='Lantikan dan penghantaran'),
 P('Pautan peribadi, log dan penghantaran manual',shot='admin-appointment-audit',steps=[
 'Pada pegawai yang dilantik, buka Pautan & Log dan semak sejarah percubaan, saluran dan status jawapan.',
 'Jika perlu menghantar melalui saluran lain, gunakan pautan yang disediakan untuk pegawai/perlawanan tersebut.',
 'Selepas benar-benar menghantar pautan, rekod penghantaran manual mengikut butang yang disediakan. Menyalin pautan sahaja tidak sama dengan menghantar.',
 'Baca kesan pengesahan penghantaran pertama terhadap tarikh akhir jawapan. Simpan catatan yang boleh diaudit.',
 'Override penerimaan atau tindakan khas memerlukan justifikasi yang jelas. Semak sejarah selepas tindakan.'],note='Pautan lantikan/laporan ialah akses peribadi. Jangan tampal dalam kumpulan awam atau menggunakan pautan milik pegawai lain.',chapter='Lantikan dan penghantaran'),
 P('Batal, tangguh atau buang lantikan',shot='admin-schedule',steps=[
 'Cari perlawanan dan semak semua pegawai serta status sebelum membuka pilihan Status Perlawanan.',
 'Pilih Dibatalkan atau Ditangguhkan, isi sebab dan sahkan untuk satu perlawanan atau pilihan pukal yang betul.',
 'Semak status jadual dan lantikan selepas tindakan serta maklumkan pegawai melalui saluran yang disediakan.',
 'Buang satu lantikan hanya untuk pembetulan slot yang tepat. Untuk penggantian ditolak, gunakan aliran Ganti.',
 'Jika mahu memadam jadual, buang semua lantikannya dahulu. Perlawanan yang masih mempunyai lantikan atau laporan tidak boleh dipadam; rekod audit lantikan kekal sebagai sejarah.'],chapter='Lantikan dan penghantaran'),
 P('Jadual lantikan dan pengesahan dokumen',shot='admin-appointment-schedule',steps=[
 'Buka tab 4 Jadual Lantikan. Pilih kejohanan dan penapis Admin sahaja, PP sahaja atau Kedua-dua lantikan.',
 'Semak nama pegawai, jawatan, tarikh, masa dan nombor perlawanan dalam draf dokumen.',
 'Isi nama/jawatan pengesah pada bahagian Pengesahan Dokumen dan sahkan apabila maklumat lengkap.',
 'Gunakan Muat Turun PDF untuk dokumen. Jika pembetulan memerlukan Batal Pengesahan, semak amaran dan sahkan semula selepas membetulkan.',
 'Cetak / edarkan hanya versi terkini selepas memastikan status perlawanan dan lantikan masih sah.'],chapter='Lantikan dan penghantaran'),
 P('Semak laporan RA dan pengesahan Pengerusi',shot='admin-ra-reports',steps=[
 'Buka tab 5 Laporan Penilaian pada Lantikan Pengadil. Cari kejohanan, perlawanan, penilai atau status.',
 'Tekan Lihat untuk membaca laporan setiap pegawai, markah, kekuatan, kelemahan dan nasihat. Semak kelengkapan KUP.',
 'Bezakan Draf, Dihantar dan Disahkan. Hantar oleh RA menghantar proses kepada Pengerusi, dengan salinan kepada Admin.',
 'Jika pengesahan menunggu, semak Pengerusi kejohanan, log penghantaran, salin pautan atau cuba semula notifikasi Pengerusi mengikut keperluan.',
 'Override Admin untuk mengesahkan memerlukan alasan. Semak rekod audit serta gunakan PDF bagi laporan yang betul.'],note='Admin menerima salinan tidak bermaksud Pengerusi sudah mengesahkan. Semak status pengesahan dan tarikh pada laporan.',chapter='Rekod dan laporan'),
 P('Pantau dan betulkan rekod perlawanan',shot='admin-matches',steps=[
 'Buka Lantikan & Perlawanan > Rekod Perlawanan. Tapis tahun, status, daerah dan carian pasukan/pengadil/kejohanan.',
 'Buka butiran rekod untuk menyemak anggota kumpulan, tarikh, tempat, lantikan dan status pengesahan PP.',
 'Untuk override pengesahan, isi alasan yang boleh diaudit dan gunakan tindakan yang dibenarkan.',
 'Padam hanya apabila rekod tersalah dimasukkan dan telah disemak. Baca amaran serta isi justifikasi pemadaman.',
 'Semak senarai dan statistik selepas tindakan; satu perlawanan boleh mempunyai beberapa rekod pegawai.'],note='Jangan menyamakan jumlah rekod pegawai dengan jumlah perlawanan unik, khususnya rekod lama yang belum dipadankan.',chapter='Rekod dan laporan'),
 P('Pengumuman kepada pengguna',shot='admin-announcements',steps=[
 'Buka Komunikasi > Pengumuman dan tekan Tambah Pengumuman.',
 'Isi tajuk dan kandungan yang tepat. Semak pilihan paparan/keaktifan sebelum menyimpan.',
 'Gunakan Edit untuk pembetulan. Semak sama ada pengumuman muncul pada senarai dan paparan pengguna.',
 'Jika saluran penghantaran/Telegram disediakan, semak sasaran dan hasil. Paparan di dashboard tidak membuktikan semua penerima membaca.',
 'Padam pengumuman hanya selepas semakan dan pengesahan. Gunakan pembetulan yang jelas jika maklumat lama perlu diganti.'],chapter='Komunikasi'),
 P('Baca dan balas Chat Pengguna',shot='admin-chat',steps=[
 'Buka Komunikasi > Chat Pengguna. Cari nama dan pilih perbualan pada senarai.',
 'Baca konteks mesej; muatkan mesej lama jika diperlukan. Semak nama dan peranan pada panel perbualan.',
 'Taip jawapan dan tekan butang hantar. Pastikan mesej berjaya muncul sebelum menghantar semula.',
 'Jika sambungan terganggu, gunakan Muat semula. Simpan konteks kes tanpa meminta kata laluan atau pautan peribadi pengguna.',
 'Gunakan emel/sokongan formal jika memerlukan lampiran atau tindakan di luar keupayaan chat.'],note='Chat ialah komunikasi sokongan; ia tidak menggantikan tindakan kelulusan, pengesahan atau perubahan rekod pada modul berkaitan.',chapter='Komunikasi'),
 P('Baca, segerak dan balas peti emel',shot='admin-mailbox',steps=[
 'Buka Komunikasi > Peti Emel. Pilih alamat rasmi yang betul dan Folder Peti Masuk atau Dihantar.',
 'Tekan Muat semula untuk bacaan terkini. Jika tersedia, gunakan Segerak Shinjiru dan semak status penyegerakan.',
 'Pilih mesej untuk membaca penghantar, penerima, tajuk, kandungan dan senarai lampiran yang disediakan.',
 'Untuk membalas, gunakan tindakan balas yang dipaparkan dan semak semula alamat penerima serta tajuk.',
 'Semak folder Dihantar dan status penghantaran. Status dibaca pada portal tidak semestinya mengubah salinan asal di pelayan emel.'],chapter='Komunikasi'),
 P('Tulis emel dan urus kenalan manual',shot='admin-mail-compose',steps=[
 'Pada Peti Emel, tekan Tulis emel. Pilih Daripada, isi Kepada, Tajuk dan Mesej.',
 'Semak penerima dan kandungan sebelum menghantar. Gunakan alamat rasmi yang sesuai dengan urusan.',
 'Untuk menyimpan penerima, gunakan Tambah penerima ke buku alamat atau buka Buku alamat & blast > Kenalan manual.',
 'Isi Nama dan Alamat emel, tekan Simpan kenalan. Cari kenalan dan gunakan Tulis emel, Sunting atau pengesahan Padam apabila perlu.',
 'Selepas hantar, baca hasil penghantaran dan folder Dihantar. Jangan ulang terus jika hasil belum pasti.'],note='Simpan kenalan tidak menghantar emel. Satu tindakan hantar ialah urusan berasingan dan perlu semakan penerima.',chapter='Komunikasi'),
 P('Blast emel: pilih, pratonton dan sahkan',shot='admin-mail-groups',steps=[
 'Buka Buku alamat & blast. Pilih tahun, kumpulan peranan/pendaftaran, daerah dan pilihan akaun tidak aktif jika diperlukan.',
 'Semak senarai penerima unik. Cari atau nyahpilih penerima yang tidak berkaitan sebelum meneruskan.',
 'Isi alamat penghantar, tajuk dan kandungan. Tekan Pratonton untuk menyemak set penerima dan kandungan.',
 'Baca ringkasan akhir, kemudian sahkan penghantaran. Jika perlu ubah, batalkan pratonton dan bina semula pilihan.',
 'Pantau job/kempen: menunggu, berjaya, gagal atau dibatalkan. Gunakan cubaan semula hanya untuk kegagalan yang telah disemak.'],note='Membatalkan kempen menghentikan penerima yang belum dihantar; ia tidak menarik balik emel yang telah dihantar.',chapter='Komunikasi'),
 P('Statistik dan penggunaan aplikasi',shot='admin-statistics',steps=[
 'Buka Pengurusan Sistem > Statistik dan pilih tahun.',
 'Tukar tab Permohonan, Pengadil, Lantikan, Perlawanan, Penilaian & Merit, Peperiksaan, Kelayakan atau App Mobile.',
 'Tekan kad atau Buka senarai untuk meneliti rekod asal. Semak kategori sebelum membandingkan jumlah.',
 'Pada statistik aplikasi, bezakan notifikasi tersedia, sudah log masuk dan belum menggunakan aplikasi; semak versi lama apabila dipaparkan.',
 'Gunakan statistik untuk semakan susulan, bukan sebagai bukti bahawa semua notifikasi telah dihantar atau dibaca.'],note='Jumlah tahunan, sepanjang masa, rekod pegawai, perlawanan unik dan pegawai dinilai menggunakan unit berbeza. Baca label sebelum membuat laporan rasmi.',chapter='Statistik dan rutin'),
 P('Blast pautan Telegram pengguna berdaftar',shot='admin-telegram-blast',steps=[
 'Buka Tetapan dan tatal ke Pautan Telegram Pengguna. Semak jumlah sudah/belum dipaut serta akaun aktif/tidak aktif.',
 'Tekan Mulakan Blast Emel dan baca ringkasan penerima sebelum mengesahkan. Ini menghantar pautan pemautan melalui emel, bukan mesej Telegram terus.',
 'Pantau kemajuan Menunggu, Dihantar, Gagal, Belum Pasti, Dilangkau atau Dibatalkan. Halaman boleh ditutup ketika kerja beratur berjalan.',
 'Jika perlu, gunakan Batalkan Blast untuk penerima yang belum dihantar. Semak kegagalan sebelum Hantar Semula Gagal / Belum Pasti.',
 'Semak log dan salinan dalam folder Dihantar Peti Emel Admin. Pengguna masih perlu menekan Start pada bot.'],note='Kadar yang dipaparkan: 10 emel setiap 5 minit. Cubaan semula Belum Pasti boleh menyebabkan penerima menerima emel kedua. Pemautan Telegram tidak mengaktifkan semula akaun yang disekat.',chapter='Komunikasi'),
 P('App Mobile: versi dan status notifikasi',shot='admin-mobile-usage',steps=[
 'Buka Statistik, pilih tahun jika berkenaan dan tukar ke tab App Mobile.',
 'Semak ringkasan mengikut peranan dan cari pengguna yang perlu dibantu.',
 'Bezakan notifikasi tersedia, sesi aplikasi sudah log masuk tanpa push, dan belum menggunakan aplikasi.',
 'Jika Versi lama ditandakan pada Android, minta pengguna memasang keluaran terkini melalui pautan rasmi.',
 'Untuk notifikasi, minta pengguna mengaktifkan kebenaran pada telefon dan semak semula status.'],note='Sesi aplikasi, langganan push dan versi ialah petunjuk penggunaan; ia bukan bukti mesej diterima atau dibaca pada telefon.',chapter='Statistik dan rutin'),
 P('Profil Admin dan semakan kerja harian',shot='admin-profile',steps=[
 'Buka Profil Saya, semak maklumat peribadi, emel, telefon dan Telegram; gunakan Edit Profil untuk pembetulan yang dibenarkan.',
 'Setiap hari, semak permohonan Menunggu Admin, lantikan Belum Jawab/ditolak dan kegagalan saluran penghantaran.',
 'Semak laporan Dihantar yang menunggu Pengerusi, pertanyaan chat dan peti emel.',
 'Sebelum sesi baharu, semak tahun permohonan, tempoh buka/tutup, yuran, syarat dan senarai pegawai berdaftar.',
 'Selepas perubahan penting, semak hasil melalui senarai asal, simpan bukti rujukan dan log keluar.'],chapter='Statistik dan rutin'),
 P('Lampiran Admin: sekat dan aktifkan akaun',shot='admin-account-status',intro='Admin boleh menyekat akses akaun dengan sebab dan mengaktifkannya semula melalui senarai Pengguna.',steps=[
 'Buka Pengguna dan tekan Tidak Aktif pada akaun berkenaan. Isi sebab yang sesuai untuk dipaparkan kepada pengguna; maksimum 1000 aksara.',
 'Tekan Tandakan Tidak Aktif. Pengguna tidak boleh log masuk; sesi lama dan pendaftaran peranti push dibatalkan. Admin tidak boleh menyekat akaun sendiri.',
 'Tandakan Papar akaun tidak aktif untuk melihat sumber Admin atau Automatik serta sebab.',
 'Tekan Aktifkan dan sahkan nama akaun untuk memulihkan akses. Pengguna perlu log masuk semula; sejarah dikekalkan.'],note='Pengaktifan semula memulakan tempoh baharu 8 bulan dan mengakui semakan pendaftaran tahun semasa. Semakan pendaftaran berikutnya pada tahun kalendar baharu.',chapter='Lampiran kemas kini'),
]
BOOKS['Admin']=dict(title='Admin',subtitle='Pentadbiran negeri dan pengurusan sistem',file='Manual_Pengguna_Admin_RefPahang.pdf',pages=common('Admin','Dashboard Admin')+admin+closing())

pp=[
 P('Skop dan susunan menu PP Daerah',shot='pp-dashboard',intro='PP Daerah mengurus rekod serta permohonan dalam skop daerah yang ditetapkan, di samping tugasan peribadi jika mempunyai kelayakan tambahan.',steps=[
 'Pengurusan daerah: buka pengesahan permohonan, pengesahan perlawanan, senarai Pengadil/RA, laporan, lantikan daerah dan statistik.',
 'Tugasan saya: buka Tugasan Lantikan Saya dan Profil Saya. Menu tambahan muncul mengikut keupayaan Pengadil atau RA pada akaun.',
 'Pilih tahun sebelum membaca jumlah. Buka kad Perlu Tindakan untuk pergi ke senarai yang menunggu semakan.',
 'Jika daerah salah atau menu tambahan tidak tersedia, minta Admin menyemak persatuan serta bukti kelayakan akaun.'],chapter='Panduan PP Daerah'),
 P('Semak pendaftaran akaun baharu',shot='public-registration-top',steps=[
 'Pemohon awam membuka Daftar Akaun Baharu dan memilih Pengadil atau Penilai, mengisi profil serta menghantar gambar.',
 'Semak persatuan daerah dan maklumat akaun jika pemohon memerlukan bantuan. Pendaftaran akaun tidak sama dengan permohonan tahunan.',
 'Akaun PP Daerah dan Admin disediakan oleh pentadbir. PP tidak perlu mendaftarkan akaun awam baharu untuk mendapatkan peranan pentadbiran.',
 'Jika pengguna sudah mempunyai emel/KP berdaftar, gunakan pemulihan akses atau minta Admin membetulkan akaun, bukannya mewujudkan pendua.'],note='Tiada tindakan “luluskan akaun baharu” yang menggantikan pengesahan permohonan tahunan. Semakan PP dibuat pada modul permohonan yang dihantar.',chapter='Permohonan daerah'),
 P('Tapis dan baca permohonan daerah',shot='pp-applications',steps=[
 'Buka Pengesahan Permohonan bagi permohonan yang menunggu tindakan PP. Gunakan carian dan penapis status.',
 'Untuk mengikut jenis, buka kumpulan Permohonan: Pengadil Berdaftar, Penilai Pengadil Berdaftar, Kelas III FAM atau Ujian Kelas I FAM.',
 'Semak nama, nombor KP, tahun, jenis borang, persatuan, dokumen dan maklumat pemohon sebelum membuat keputusan.',
 'Jika tiada rekod, semak jenis, status dan daerah pada akaun. Permohonan sendiri dikecualikan daripada senarai pengesahan PP.'],note='PP tidak boleh mengesahkan permohonan sendiri. Hubungi Admin untuk laluan pemprosesan yang sesuai.',chapter='Permohonan daerah'),
 P('Sahkan permohonan ke peringkat Admin',shot='pp-applications',steps=[
 'Buka permohonan yang berada pada Menunggu PP Daerah dan pastikan pemohon dalam daerah anda.',
 'Semak kelengkapan profil, borang, perakuan dan dokumen bayaran yang berkaitan.',
 'Tekan Sahkan dan baca dialog nama pemohon sebelum mengesahkan.',
 'Tunggu mesej berjaya. Pastikan status menjadi Menunggu Admin dan tidak lagi tersenarai sebagai kerja PP yang belum diproses.',
 'Maklumkan pemohon bahawa pengesahan PP bukan kelulusan akhir Admin atau keputusan ujian.'],chapter='Permohonan daerah'),
 P('Tolak permohonan dengan sebab',shot='pp-application-reject',steps=[
 'Pada permohonan yang memerlukan pembetulan atau tidak memenuhi syarat, tekan Tolak.',
 'Isi sebab penolakan yang khusus, contohnya dokumen tidak lengkap atau butiran yang perlu dibetulkan.',
 'Semak nama dan sebab pada dialog, kemudian sahkan penolakan.',
 'Pastikan status bertukar kepada Ditolak. Pemohon perlu membaca catatan dan menghubungi pihak berkaitan untuk tindakan lanjut.'],note='Jangan menganggap penolakan automatik membuka butang permohonan baharu untuk sesi sama. Sistem menyemak permohonan sedia ada; pemohon perlu rujuk arahan dalam portal.',chapter='Permohonan daerah'),
 P('Senarai Pengadil daerah dan profil',shot='pp-referees',steps=[
 'Buka Pengadil Berdaftar dan gunakan carian atau penapis yang tersedia.',
 'Buka profil pegawai untuk menyemak identiti, persatuan, permohonan, kelayakan dan rekod perlawanan.',
 'Jika tindakan kemas kini disediakan, betulkan maklumat dalam skop daerah dan simpan. Perubahan persatuan atau status akses perlu dirujuk kepada Admin.',
 'Semak semula rekod selepas simpan. Bezakan status akaun aktif daripada pendaftaran yang diluluskan bagi tahun tertentu.'],chapter='Pegawai dan rekod daerah'),
 P('Senarai RA dan laporan daerah',shot='pp-ra-list',steps=[
 'Buka Penilai Pengadil Berdaftar untuk melihat RA dalam skop daerah.',
 'Gunakan carian serta butiran profil untuk menyemak identiti, pendaftaran dan maklumat hubungan.',
 'Buka Laporan Penilaian untuk membaca laporan yang boleh dicapai dalam daerah. Semak perlawanan, penilai, tarikh dan status.',
 'Gunakan Lihat untuk membaca laporan atau ikon muat turun bagi dokumen yang diperlukan.'],note='Akses membaca laporan daerah tidak memberikan kuasa menulis laporan atas nama RA lain atau membuat pengesahan Pengerusi.',chapter='Pegawai dan rekod daerah'),
 P('Semak rekod perlawanan yang menunggu',shot='pp-verification',steps=[
 'Buka Pengesahan Perlawanan. Pilih tahun dan status Menunggu, Disahkan atau Ditolak.',
 'Cari pengadil, pasukan atau tempat. Buka baris perlawanan untuk menyemak maklumat terperinci.',
 'Semak tarikh, tempat, pasukan, tugas pegawai, kumpulan rekod dan sebarang pertindihan yang dipaparkan.',
 'Bandingkan dengan bukti tugas atau rekod kejohanan sebelum membuka tindakan pengesahan.'],note='Rekod kumpulan boleh mewakili beberapa pegawai bagi satu perlawanan. Baca unit senarai dan jumlah anggota sebelum memilih tindakan.',chapter='Pengesahan perlawanan'),
 P('Sahkan, tolak atau semak semula perlawanan',shot='pp-match-detail',steps=[
 'Dalam butiran rekod, buka tindakan dan isi catatan yang diperlukan.',
 'Jika pertindihan dipaparkan, semak butiran konflik, tandakan pengesahan semakan dan isi penjelasan sebelum Sahkan boleh digunakan.',
 'Tekan Sahkan atau Sahkan Semua untuk kumpulan yang telah disemak. Jika tidak sah, pilih Tolak dengan sebab yang jelas.',
 'Bagi rekod yang sudah disahkan, Edit Semula membolehkan pengesahan disemak mengikut tindakan yang tersedia.',
 'Pastikan status semua rekod sasaran berubah seperti dimaksudkan. Gunakan Padam hanya selepas semakan dan pengesahan, bukan untuk menggantikan penolakan.'],note='Tindakan berkumpulan boleh melibatkan beberapa rekod pegawai. Semak anggota kumpulan terlebih dahulu dan jangan menghantar semula daripada dialog lama.',chapter='Pengesahan perlawanan'),
 P('Baca laporan RA daerah',shot='pp-reports',steps=[
 'Buka Laporan Penilaian dan semak ringkasan jumlah, purata markah serta julat markah.',
 'Gunakan carian kejohanan, penilai atau pengadil untuk mendapatkan laporan yang diperlukan.',
 'Tekan Lihat / ikon mata untuk membaca markah, kriteria dan nasihat bagi setiap pegawai.',
 'Gunakan ikon muat turun apabila perlu menyimpan dokumen. Semak identiti perlawanan serta status sebelum menggunakannya.',
 'Jika laporan atau pemetaan daerah salah, rujuk RA / Admin dengan nombor perlawanan dan laporan.'],chapter='Pegawai dan rekod daerah'),
 P('Cipta kejohanan lantikan daerah',shot='pp-appointments',steps=[
 'Buka Lantikan Pengadil Daerah dan tab 1 Kejohanan. Tekan Tambah untuk mencipta kejohanan milik daerah.',
 'Isi nama, jenis, tarikh, tempat, anjuran dan status. Peringkat kejohanan daerah ditetapkan oleh skop PP.',
 'Simpan dan pilih kejohanan yang betul. PP mengurus lantikan milik daerahnya, sementara Admin mempunyai pengawasan negeri.',
 'Semak bahagian pool dan jadual sebelum memulakan pelantikan. Untuk perkara di luar kuasa daerah, hubungi Admin.'],chapter='Lantikan daerah'),
 P('Pool dan jadual lantikan daerah',shot='admin-schedule',intro='Struktur tab jadual digunakan bersama modul lantikan. Rajah menunjukkan komponen jadual yang sama dalam panel Admin; pilihan PP dihadkan kepada daerah.',steps=[
 'Pilih kejohanan dan Tambah ke Pool. Pilih Pengadil Kelolaan Daerah dan tandakan calon yang dibenarkan.',
 'Jika menggunakan fail nama, muat turun template pool, semak padanan dan pilih calon yang betul.',
 'Buka tab 2 Jadual Perlawanan. Tambah satu perlawanan atau gunakan Muat Naik Excel dan template jadual.',
 'Semak tarikh, masa, pasukan, kategori, tempat dan wilayah sebelum menyimpan atau menghantar import.'],note='PP tidak mendapat tab Pengadil Luar atau Blast Pautan Telegram pengadil luar seperti Admin. Rujuk Admin jika memerlukan pegawai luar skop daerah.',chapter='Lantikan daerah'),
 P('Lantik, hantar notifikasi dan ganti pegawai',shot='admin-appointment-detail',intro='Rajah menunjukkan komponen pemilihan pegawai yang sama. Dalam panel PP, senarai dan tindakan mengikut skop kejohanan daerah.',steps=[
 'Buka tab 3 Lantikan Pengadil atau Lantik pada perlawanan. Semak nombor, tarikh dan jawatan.',
 'Pilih R, AR1 dan AR2 daripada pool daerah, serta Pegawai ke4/RA jika tersedia dan diperlukan.',
 'Semak pertindihan serta amaran dan sahkan slot. Hantar notifikasi kepada pegawai yang Belum Jawab selepas semua butiran betul.',
 'Pantau Diterima/ Ditolak. Gunakan Ganti apabila perlu, dan semak semula notifikasi serta tarikh akhir jawapan pegawai pengganti.',
 'Gunakan Pautan & Log bagi semakan saluran dan penghantaran manual yang dibenarkan.'],note='Pelantikan disimpan, notifikasi dihantar dan jawapan diterima ialah tiga keadaan berbeza.',chapter='Lantikan daerah'),
 P('Dokumen, pembatalan dan sempadan kuasa',shot='admin-appointment-schedule',intro='Rajah ialah komponen Jadual Lantikan. Semak pemilik lantikan dan kejohanan daerah sebelum mencetak atau menukar status.',steps=[
 'Buka tab 4 Jadual Lantikan, pilih kejohanan dan semak pegawai serta tarikh perlawanan.',
 'Isi pengesahan dokumen apabila dibenarkan, kemudian muat turun PDF versi terkini.',
 'Jika perlawanan ditangguhkan atau dibatalkan, pilih status yang tepat dan isi sebab; pastikan pegawai dimaklumkan.',
 'Jangan padam rekod bersejarah untuk memintas sekatan. Hubungi Admin jika tindakan tidak tersedia atau melibatkan kejohanan pihak lain.',
 'Penetapan Pengerusi dan pengawasan pengesahan laporan RA diurus oleh Admin. Panel PP tidak memaparkan tab pengurusan laporan negeri yang sama.'],chapter='Lantikan daerah'),
 P('Statistik daerah: baca unit dengan betul',shot='pp-statistics',steps=[
 'Buka Statistik Daerah dan pilih tahun rujukan.',
 'Semak jumlah pengadil berdaftar, kelayakan lesen, rekod pegawai, perlawanan dikenal pasti dan perkara menunggu tindakan.',
 'Baca carta bulanan, pecahan permohonan dan senarai aktiviti/pegawai yang disediakan.',
 'Tekan kad tindakan untuk meneliti rekod sumber. Bandingkan unit yang sama sebelum menyediakan laporan.',
 'Bagi statistik aplikasi, gunakan status penggunaan/notifikasi untuk susulan pegawai daerah, bukan bukti notis sudah dibaca.'],note='Rekod lama yang belum dipadankan kekal sebagai rekod berasingan. Jumlah rekod pegawai tidak sama dengan jumlah perlawanan unik.',chapter='Statistik dan tugas sendiri'),
 P('PP yang turut menjadi Pengadil atau RA',shot='pp-own-ra',steps=[
 'Semak bahagian Tugasan saya pada menu. Tugasan Lantikan Saya dan Profil Saya tersedia untuk akaun PP.',
 'Jika mempunyai keupayaan Pengadil, menu Rekod Perlawanan Saya, Pendaftaran Pengadil Saya dan permohonan Kelas III / I boleh muncul.',
 'Jika mempunyai keupayaan RA, buka Panel Penilai Pengadil Saya dan Pendaftaran Penilai Saya (R1). Laporan yang ditulis tetap milik RA tersebut.',
 'Gunakan aliran Pengadil/RA untuk tugasan peribadi; kembali ke Pengurusan daerah apabila membuat pengesahan orang lain.',
 'Jika menu tidak sepadan dengan kelayakan, minta Admin menyemak rekod. Jangan memilih peranan atau kategori lain semata-mata untuk membuka menu.'],note='PP tidak boleh mengesahkan permohonan sendiri. Menu tambahan tidak menjadikan semua PP sebagai RA atau Pengadil secara automatik.',chapter='Statistik dan tugas sendiri'),
]+personal_assignments('pp-own-assignments')+[
 P('Profil PP dan senarai semak harian',shot='pp-profile',steps=[
 'Buka Profil Saya. Semak persatuan daerah, emel, telefon, Telegram dan gambar; gunakan Edit Profil apabila perlu.',
 'Semak Pengesahan Permohonan dan Pengesahan Perlawanan yang menunggu tindakan setiap hari.',
 'Pantau jawapan lantikan daerah dan urus penggantian sebelum tarikh akhir.',
 'Semak tugasan sendiri dan laporan RA peribadi secara berasingan daripada kerja pengesahan daerah.',
 'Simpan nombor rujukan kes yang perlu dirujuk kepada Admin dan log keluar selepas selesai.'],chapter='Statistik dan tugas sendiri'),
]
BOOKS['PP_Daerah']=dict(title='PP Daerah',subtitle='Pengurusan daerah dan tugasan sendiri',file='Manual_Pengguna_PP_Daerah_RefPahang.pdf',pages=common('Pegawai Pembangunan Daerah','Pengurusan daerah')+pp+closing())

ra=[
 P('Skop RA dan menu Penilai Pengadil',shot='ra-dashboard',intro='RA ialah Penilai Pengadil. Akaun portal menggunakan peranan Penilai; RA menilai KUP dan tidak menggantikan jawatan R, AR1, AR2 atau pegawai keempat.',steps=[
 'Dashboard menunjukkan tugasan, laporan perlu disiapkan dan status pendaftaran bagi tahun dipilih.',
 'Penilaian Pengadil membuka Perlu Dinilai dan Laporan Saya. Tugasan ialah tempat menyemak dan menjawab lantikan.',
 'Pendaftaran Tahunan (R1), Statistik dan Profil menyokong urusan peribadi RA.',
 'Jika anda PP yang turut menjadi RA, gunakan Panel Penilai Pengadil Saya; kuasa pengesahan daerah kekal berasingan.'],chapter='Panduan RA'),
]+registration('RA')+[
 P('Profil dan pendaftaran tahunan RA',shot='ra-registration',steps=[
 'Buka Profil dan semak identiti, emel, nombor telefon, persatuan, waris serta gambar. Betulkan profil sebelum memohon.',
 'Buka Pendaftaran Tahunan (R1). Semak sesi, tempoh pembukaan dan maklumat bayaran semasa.',
 'Lengkapkan maklumat tambahan, saiz baju, resit dan gambar yang diminta pada borang. Tandakan semua perakuan berkaitan.',
 'Tekan Hantar Permohonan dan semak status serta sejarah. Pendaftaran akaun sahaja tidak meluluskan R1 tahunan.'],note='Gunakan maklumat bayaran pada borang semasa. Screenshot mengandungi contoh; jangan menyalin butiran akaun daripada rajah.',chapter='Pendaftaran tahunan RA'),
 P('Status permohonan dan dokumen RA',steps=[
 'Buka Pendaftaran Tahunan dan tatal ke Sejarah Permohonan. Padankan tahun dan jenis Penilai Pengadil.',
 'Semak Menunggu PP Daerah, Menunggu Admin, diluluskan/Lengkap atau Ditolak serta catatan jika diberikan.',
 'Jika diminta pembetulan, semak catatan dan hubungi PP/Admin. Jangan menganggap boleh menghantar permohonan kedua bagi sesi sama.',
 'Gunakan pilihan muat turun borang/PDF yang disediakan pada rekod. Pastikan PDF merujuk sesi dan pemohon yang betul.',
 'Permohonan RA tidak sama dengan keputusan ujian kecergasan Pengadil; rujuk syarat bagi peranan dan borang yang dipilih.'],chapter='Pendaftaran tahunan RA'),
]+personal_assignments('ra-assignments')+[
 P('Pilih perlawanan yang perlu dinilai',shot='ra-assessments',steps=[
 'Buka Penilaian Pengadil > Perlu Dinilai. Semak tugasan RA yang telah Diterima.',
 'Padankan kejohanan, nombor perlawanan, tarikh, pasukan dan tempat dengan tugasan sebenar.',
 'Tekan Isi Laporan bagi tugasan baharu atau sambung draf yang belum dihantar.',
 'Jika hanya Lihat tersedia, semak status laporan sedia ada. Laporan yang sudah dihantar tidak boleh diedit semula sebagai draf.',
 'Jika lantikan tiada atau pegawai salah, hubungi pelantik sebelum mengisi laporan. Jangan memilih perlawanan lain untuk menggantikannya.'],chapter='Laporan penilaian'),
 P('Isi maklumat perlawanan dan pegawai',shot='ra-report-form',steps=[
 'Dalam Borang Penilaian Pengadil, semak identiti perlawanan serta pegawai KUP yang dimuatkan.',
 'Pilih Tahap Kesukaran dan Cuaca. Gunakan Normal, Susah atau Sangat Susah berdasarkan pemerhatian sebenar.',
 'Pilih tab setiap pegawai: R, AR1, AR2 dan P4 jika ada. Setiap tab mempunyai markah, prestasi dan kriteria sendiri.',
 'Semak nama/jawatan sebelum mengisi. Jika pegawai tidak lengkap atau salah, hentikan dan rujuk pelantik / Admin.',
 'Isi Ulasan Keseluruhan yang menerangkan konteks prestasi perlawanan.'],note='Sistem memerlukan pegawai KUP yang sah pada perlawanan tersebut. RA tidak dimasukkan sebagai salah satu pegawai yang dinilai.',chapter='Laporan penilaian'),
 P('Kriteria: kekuatan, kelemahan dan nasihat',shot='ra-criteria',steps=[
 'Pada pegawai yang dipilih, semak tiga kelompok: Kawalan Permainan, Kecergasan Fizikal/Posisi dan Kerjasama Berpasukan.',
 'Tekan Pilih kriteria kekuatan atau kelemahan dan tandakan item yang benar-benar diperhatikan. Pilihan berbeza mengikut jawatan pegawai.',
 'Isi Nasihat pada kelompok yang berkenaan untuk menerangkan pembaikan yang boleh dilaksanakan.',
 'Ulang bagi setiap tab pegawai. Jangan meninggalkan catatan AR1 pada tab AR2 atau menyalin ulasan tanpa menyemak konteks.',
 'Semak padanan markah dengan bukti dan ulasan sebelum menyimpan.'],note='Kriteria ialah penjelasan prestasi, bukan hanya senarai semak. Bezakan kekuatan, kelemahan dan cadangan supaya penerima boleh mengambil tindakan.',chapter='Laporan penilaian'),
 P('Rujukan skala pemarkahan pada borang',table=[['Julat','Penerangan ringkas paparan sistem'],['9.0-10 / 8.5-8.9','Prestasi sangat baik; banyak keputusan sukar dibuat dengan betul.'],['8.3-8.4','Prestasi baik; banyak keputusan dijangka dibuat dengan betul.'],['8.0-8.2','Prestasi baik dengan beberapa perkara untuk penambahbaikan.'],['7.9','Satu key match incident; jika tiada, prestasi pada 8.3 atau ke atas.'],['7.8','Satu key match incident; jika tiada, prestasi pada 8.0-8.2.'],['7.5-7.7','Prestasi tidak memuaskan melibatkan dua key match incident.'],['7.4','Satu key match incident yang mempengaruhi pemenang perlawanan.'],['7.0-7.4','Prestasi buruk dengan tiga atau lebih key match incident.']],note='Ini rujukan pilihan yang dipaparkan dalam aplikasi, bukan arahan menggantikan garis panduan penilaian rasmi. Gunakan skala dan arahan rasmi semasa ketika menilai.',chapter='Laporan penilaian'),
 P('Simpan draf dan sambung kemudian',shot='mobile-ra-draft',mobile=True,steps=[
 'Semak tab pegawai dan maklumat yang sudah diisi. Tekan Simpan Draf apabila mahu menyimpan kerja tanpa menghantar untuk pengesahan.',
 'Tunggu mesej Draf laporan disimpan. Jangan menganggap teks tersimpan hanya kerana borang masih kelihatan.',
 'Buka Laporan Saya atau tugasan berkenaan untuk menyambung draf. Semak data yang dimuatkan sebelum menambah catatan.',
 'Jika draf telah berubah atau simpanan gagal, muat semula dan semak versi terkini sebelum mengulangi simpanan.',
 'Elakkan mengedit laporan sama pada dua tab atau peranti serentak.'],note='Simpan Draf tidak menghantar laporan kepada Pengerusi. Gunakan Hantar Laporan selepas lengkap dan disemak.',chapter='Laporan penilaian'),
 P('Hantar laporan untuk pengesahan',shot='ra-report-form',steps=[
 'Semak maklumat perlawanan dan setiap pegawai. Semua markah pegawai yang diperlukan mesti diisi.',
 'Baca semula kekuatan, kelemahan, nasihat, prestasi dan ulasan keseluruhan. Pastikan catatan sesuai dikongsi dengan pegawai yang berhak.',
 'Tekan Hantar Laporan dan tunggu pengesahan berjaya. Semak rekod menjadi Dihantar.',
 'Laporan dihantar kepada Pengerusi Pengadil untuk pengesahan; Admin menerima salinan. Jika Pengerusi belum tersedia, penghantaran boleh menunggu tindakan Admin.',
 'Jika langkah simpan berjaya tetapi hantar gagal, semak draf/rekod sebelum menghantar semula.'],note='Laporan Dihantar belum semestinya Disahkan. Setelah dihantar, laporan tidak boleh diedit semula melalui aliran draf biasa.',chapter='Laporan penilaian'),
 P('Laporan Saya, PDF dan status pengesahan',shot='ra-report-view',steps=[
 'Buka Penilaian Pengadil > Laporan Saya. Cari perlawanan dan semak Draf, Dihantar atau Disahkan.',
 'Tekan Lihat untuk menyemak markah serta ulasan setiap pegawai. Semak butiran Pengerusi/catatan jika dipaparkan.',
 'Gunakan PDF / muat turun untuk laporan yang diperlukan dan pastikan perlawanan serta statusnya betul.',
 'Jika pengesahan menunggu terlalu lama atau pihak pengesah salah, maklumkan kepada Admin dengan nombor laporan.',
 'Jangan mengedarkan pautan pengesahan peribadi atau laporan pegawai lain di luar urusan yang dibenarkan.'],chapter='Laporan penilaian'),
 P('RA jemputan tanpa akaun portal',steps=[
 'Pengadil/RA luar boleh menerima lantikan melalui pautan peribadi emel atau Telegram tanpa menjadi pengguna portal.',
 'Semak nama, jawatan RA dan perlawanan pada pautan sebelum menjawab atau membuka borang laporan yang diberikan.',
 'Isi dan simpan/hantar melalui halaman pautan yang sah. Jangan cuba log masuk portal menggunakan emel rekod pengadil luar jika tiada akaun pengguna.',
 'Jika pautan tidak sah, tamat tempoh atau butiran tidak sepadan, minta Admin menyemak lantikan dan menghantar pautan yang betul.',
 'Jika kemudian mempunyai akaun portal, minta Admin menyemak padanan identiti agar sejarah tidak berpecah.'],note='Rekod Pengadil Luar, akaun portal Penilai dan pendaftaran tahunan RA ialah tiga perkara berasingan.',chapter='Laporan penilaian'),
 P('Statistik RA dan senarai semak harian',shot='ra-statistics',steps=[
 'Buka Statistik dan pilih tahun untuk menyemak tugasan, laporan draf, dihantar, disahkan dan pegawai dinilai.',
 'Gunakan perkara perlu tindakan untuk mencari tugasan diterima yang belum mempunyai laporan.',
 'Semak tugasan Belum Jawab dan selesaikan laporan selepas perlawanan mengikut arahan penganjur.',
 'Pantau status pengesahan, pendaftaran tahunan dan mesej dalam portal.',
 'Pastikan notifikasi aktif, Telegram dipaut dan maklumat hubungan terkini. Log keluar selepas selesai.'],note='Jumlah pegawai dinilai tidak semestinya sama dengan bilangan laporan: satu laporan boleh menilai beberapa KUP dan orang yang sama boleh dinilai berkali-kali.',chapter='Statistik dan rutin RA'),
]
BOOKS['RA']=dict(title='RA / Penilai Pengadil',subtitle='Lantikan, penilaian KUP dan laporan',file='Manual_Pengguna_RA_RefPahang.pdf',pages=common('RA / Penilai Pengadil','Dashboard Penilai')+ra+closing())

ref=[
 P('Menu dan rutin pertama Pengadil',shot='ref-dashboard',intro='Dashboard menghubungkan tugasan, rekod perlawanan, permohonan dan perkara yang perlu tindakan bagi akaun sendiri.',steps=[
 'Semak tahun pada Dashboard dan kad yang menunggu tindakan. Buka tugasan yang perlu dijawab atau rekod yang perlu dilengkapkan.',
 'Profil Saya: lengkapkan identiti, persatuan, waris, gambar dan hubungan. Rekod Perlawanan: tambah dan pantau pengesahan.',
 'Permohonan: pilih Pendaftaran Tahunan (R1), Kelas III FAM atau Ujian Kelas I FAM. Penilaian Saya: baca laporan yang dibenarkan.',
 'Gunakan Statistik Saya untuk ringkasan tahun. Semak loceng notifikasi serta mesej sokongan secara berkala.'],note='Menu Notifikasi Lantikan membuka senarai tugasan. Anda juga boleh membukanya melalui Dashboard atau https://refpahang.com/pengadil/tugasan.',chapter='Panduan Pengadil'),
]+registration('Pengadil')+[
 P('Lengkapkan dan kemas kini profil',shot='ref-profile',steps=[
 'Buka Profil Saya. Jika Profil belum lengkap dipaparkan, baca senarai medan yang perlu dilengkapkan.',
 'Tekan Kemaskini dan semak maklumat peribadi, alamat, pekerjaan, waris, persatuan dan maklumat kelayakan.',
 'Muat naik / tukar gambar jika perlu. Gunakan pemotongan gambar yang disediakan dan tunggu pemprosesan selesai.',
 'Semak emel, nombor telefon serta maklumat waris sebelum menyimpan. Bagi pekerjaan yang memerlukannya, lengkapkan maklumat majikan.',
 'Semak hasil selepas simpan. Perubahan persatuan atau jenis/kelayakan tertentu boleh dihadkan; rujuk Admin apabila diminta.'],note='Maklumat profil digunakan semula dalam permohonan. Membetulkan profil tidak dengan sendirinya mengubah dokumen permohonan lama.',chapter='Profil dan kelayakan'),
 P('Semak jenis, tahun kelayakan dan lesen',shot='ref-profile-edit',steps=[
 'Semak Jenis Pengadil dan tahun mula aktif berdasarkan rekod sebenar, bukan untuk mendapatkan laluan permohonan tertentu.',
 'Jika tahun mohon/lulus Kelas III atau Kelas I perlu dibetulkan, gunakan medan yang dibenarkan atau kemukakan bukti kepada Admin / PP.',
 'Buka Dashboard / status permohonan tahun semasa untuk membezakan pendaftaran diluluskan daripada kelayakan patch atau lesen.',
 'Jika belum lulus kecergasan bagi sesi yang berkaitan, jangan menganggap kelulusan dokumen membuktikan kelayakan patch/lesen.',
 'Semak seminar pada statusnya sendiri. Rekod seminar tidak menggantikan keputusan kecergasan.'],chapter='Profil dan kelayakan'),
]+personal_assignments('ref-assignments')+[
 P('Senarai rekod perlawanan sendiri',shot='ref-matches',steps=[
 'Buka Rekod Perlawanan. Semak tahun, jumlah Disahkan, Belum Disahkan dan Tidak Disahkan.',
 'Gunakan carian atau pautan statistik untuk meneliti perlawanan yang berkaitan.',
 'Baca tarikh, pasukan, tempat, jawatan dan status PP bagi setiap rekod. Semak catatan jika rekod ditolak.',
 'Jika perlawanan datang daripada lantikan sistem, semak dahulu sama ada rekod sudah wujud supaya tidak memasukkan pendua.',
 'Gunakan Tambah Perlawanan untuk rekod yang benar-benar perlu dilengkapkan mengikut tatacara sistem.'],note='Jumlah sepanjang masa dan jumlah tahun dipilih ialah ukuran berbeza. Status pengesahan rekod bukan status jawapan lantikan.',chapter='Rekod perlawanan'),
 P('Tambah perlawanan: butiran utama',shot='ref-match-add',steps=[
 'Pada Rekod Perlawanan, tekan Tambah Perlawanan. Semak borang dan isi tarikh, masa, jenis/kejohanan, kategori dan peringkat yang diminta.',
 'Isi pasukan tuan rumah/pelawat, tempat serta daerah perlawanan dengan tepat.',
 'Pilih jawatan sendiri dan pegawai KUP lain melalui pilihan yang disediakan; isi identiti/telefon yang diminta apabila berkenaan.',
 'Semak setiap pegawai dan elakkan orang sama diletakkan pada jawatan yang bercanggah. Rujuk sistem jika pegawai tidak dijumpai.',
 'Tatal ke bawah untuk semakan akhir dan butang simpan. Jangan anggap borang tersimpan ketika masih dibuka.'],chapter='Rekod perlawanan'),
 P('Simpan rekod dan pantau pengesahan PP',shot='mobile-match-add-bottom',mobile=True,steps=[
 'Baca semua maklumat perlawanan dan senarai pegawai sekali lagi sebelum menekan Simpan / Hantar.',
 'Tunggu mesej berjaya, kemudian semak rekod muncul dalam senarai dengan status Belum Disahkan atau status yang dipaparkan.',
 'PP Daerah akan menyemak rekod dalam skop pengesahannya. Jika terdapat pertindihan atau butiran tidak lengkap, rekod mungkin memerlukan penjelasan.',
 'Jika Tidak Disahkan, baca catatan PP dan gunakan tindakan pembetulan yang dibenarkan; hubungi PP jika tidak boleh diedit.',
 'Padam hanya rekod tersalah dimasukkan apabila tindakan itu tersedia. Jangan memadam rekod betul untuk menukar statistik.'],note='Satu rekod pegawai dan satu perlawanan berkumpulan tidak semestinya unit sama. Pastikan rekod semua KUP konsisten.',chapter='Rekod perlawanan'),
 P('Pendaftaran tahunan R1 + R2 + R4',shot='ref-registration',steps=[
 'Buka Permohonan > Pendaftaran Tahunan (R1). Baca nama borang, sesi dan tempoh penerimaan yang dipaparkan.',
 'Jika profil belum lengkap, lengkapkan melalui Profil Saya dan kembali ke borang.',
 'Semak profil praisi, waris dan maklumat bayaran untuk sesi berkenaan. Isi medan tambahan yang diperlukan.',
 'Sediakan resit bayaran, gambar terkini, saiz baju serta semua perakuan sebelum meneruskan.',
 'Jika permohonan sesi sama sudah wujud, semak status/sejarahnya; sistem tidak semestinya membenarkan permohonan kedua.'],note='Halaman boleh memaparkan belum dibuka atau ditutup berdasarkan tetapan Admin. Akaun aktif tidak bermakna semua borang sedang dibuka.',chapter='Permohonan dan pendaftaran tahunan'),
 P('Dokumen, kesihatan dan hantar permohonan',shot='ref-registration-documents',steps=[
 'Muat naik resit bayaran yang sah dalam format JPG, PNG atau PDF, maksimum 5MB. Pastikan bukti jelas dan sepadan dengan sesi.',
 'Pilih gambar JPG/PNG dan tunggu pemprosesan. Hasil gambar profil perlu memenuhi saiz/piksel yang dibenarkan oleh sistem.',
 'Isi saiz baju dan semak maklumat waris. Baca semua perakuan am serta perakuan kesihatan pada pendaftaran Pengadil.',
 'Tandakan hanya perakuan yang benar, kemudian tekan Hantar Permohonan. Betulkan ralat jika diminta.',
 'Selepas berjaya, semak sejarah permohonan dan tahun. Simpan nombor rujukan atau PDF yang disediakan.'],note='Jangan menyalin nombor akaun atau amaun daripada screenshot manual. Gunakan butiran semasa pada borang dan arahan rasmi.',chapter='Permohonan dan pendaftaran tahunan'),
 P('Baca perjalanan status permohonan',table=[['Status / peringkat','Tindakan Pengadil'],['Menunggu PP Daerah','Tunggu pengesahan daerah; hubungi PP jika dokumen atau maklumat perlu semakan.'],['Menunggu Admin','PP telah mengesahkan; tunggu keputusan Admin.'],['Approved / Lengkap','Pendaftaran/permohonan diluluskan mengikut jenis dan sesi. Semak syarat kecergasan secara berasingan.'],['Admin Diluluskan','Bagi pendaftaran Pengadil sesi 2027+, dokumen diluluskan; keputusan kecergasan menentukan patch/lesen.'],['Ditolak / Rejected','Baca sebab dan rujuk PP/Admin. Jangan menganggap boleh menghantar permohonan pendua sesi sama.'],['Lulus / Tidak Lulus / Tidak Hadir','Keputusan ujian; bukan peranan akaun atau bukti Telegram aktif.'],['Hadir / Tidak Hadir seminar','Rekod seminar berasingan daripada keputusan kecergasan.']],chapter='Permohonan dan pendaftaran tahunan'),
 P('Permohonan Kelas III FAM',shot='ref-class3',steps=[
 'Buka Permohonan > Kelas III FAM. Semak sesi, tempoh pembukaan, umur dan syarat yang dipaparkan.',
 'Semak profil dan waris. Rujuk arahan yuran / akaun FAM semasa dan muat naik resit yang diminta.',
 'Baca dan tandakan perakuan yang berkaitan, kemudian tekan Hantar Permohonan.',
 'Semak sejarah bagi status pengesahan PP/Admin serta keputusan peperiksaan selepas direkodkan.',
 'Jika tidak memenuhi umur atau dokumen ditolak, baca ralat dan rujuk pihak berkenaan; jangan menukar tarikh lahir untuk memintas syarat.'],chapter='Permohonan dan pendaftaran tahunan'),
 P('Permohonan Ujian Kelas I FAM',shot='ref-class1',steps=[
 'Buka Permohonan > Ujian Kelas I FAM dan baca syarat sesi semasa.',
 'Semak had umur dan rekod lulus Kelas III. Sistem memerlukan sijil Kelas III sekurang-kurangnya dua tahun sebelum sesi berkenaan.',
 'Jika rekod tahun kelayakan salah atau tiada, rujuk Admin / PP dengan bukti sebelum meneruskan.',
 'Lengkapkan waris, resit bayaran FAM dan perakuan, kemudian hantar apabila semua syarat dipenuhi.',
 'Pantau status dan keputusan pada sejarah permohonan. Had umur/yuran boleh berubah melalui tetapan sesi.'],note='Gunakan syarat yang dipaparkan serta keputusan pelayan. Paparan borang sahaja tidak membuktikan pemohon sudah layak.',chapter='Permohonan dan pendaftaran tahunan'),
 P('Muat turun borang dan sejarah permohonan',shot='mobile-application-detail',mobile=True,steps=[
 'Buka menu permohonan yang berkaitan dan tatal ke Sejarah Permohonan. Pada aplikasi, buka Permohonan dan pilih rekod.',
 'Semak jenis, tahun, status serta catatan sebelum membuka butiran.',
 'Gunakan pautan borang / PDF / muat turun yang tersedia pada rekod berkenaan.',
 'Semak nama, sesi dan jenis borang pada dokumen yang dibuka. Simpan dalam Downloads atau kongsi hanya untuk urusan rasmi.',
 'Jika dokumen tidak tersedia, semak status dan syarat penerbitan pada portal; hubungi Admin dengan nombor permohonan.'],chapter='Permohonan dan pendaftaran tahunan'),
 P('Penilaian Saya dan laporan KUP',shot='ref-assessment',steps=[
 'Buka Penilaian Saya dan semak senarai laporan yang boleh dicapai.',
 'Pilih perlawanan untuk membaca markah, prestasi, kekuatan, kelemahan dan nasihat penilai.',
 'KUP dalam perlawanan sama boleh membaca laporan pegawai KUP pada perlawanan tersebut mengikut akses sistem. Laporan perlawanan lain tidak termasuk.',
 'Baca status laporan/pengesahan dan catatan, kemudian gunakan nasihat untuk penambahbaikan prestasi.',
 'Jika pegawai atau perlawanan tidak sepadan, laporkan kepada Admin / RA dengan nombor rujukan.'],note='Akses membaca laporan tidak membenarkan Pengadil menulis, mengubah markah atau mengesahkan laporan RA.',chapter='Penilaian dan statistik'),
 P('Statistik Saya dan rutin selepas perlawanan',shot='ref-statistics',steps=[
 'Buka Statistik Saya dan pilih tahun. Semak rekod disahkan, menunggu, ditolak serta tugasan yang perlu tindakan.',
 'Gunakan pautan pada kad untuk menyemak rekod sumber. Semak unit tahunan berbanding sepanjang masa.',
 'Selepas menerima tugas, simpan maklumat rasmi. Selepas perlawanan, semak rekod dan butiran yang memerlukan kemas kini.',
 'Pantau pengesahan PP, penilaian RA serta pendaftaran tahunan. Semak Telegram dan notis portal tanpa hanya bergantung pada push.',
 'Pastikan profil dan waris terkini, kemudian log keluar selepas selesai.'],chapter='Penilaian dan statistik'),
 P('Pengadil luar dan bantuan kepada Admin',steps=[
 'Pengadil luar ialah pegawai dalam direktori jemputan yang diurus oleh Admin. Mereka tidak semestinya mempunyai akaun portal.',
 'Jika menerima pautan lantikan sebagai pengadil luar, semak nama/perlawanan dan jawab melalui pautan peribadi yang diberikan.',
 'Jika anda sudah mempunyai akaun RefPahang tetapi tersenarai sebagai luar, maklumkan kepada Admin untuk semakan padanan; jangan cipta identiti kedua.',
 'Jika memerlukan bantuan, gunakan Hubungi Admin / chat pada portal atau rujuk PP Daerah. Sertakan nombor perlawanan/permohonan dan mesej ralat.',
 'Pengadil tidak mempunyai menu untuk mencipta pegawai luar, meluluskan permohonan orang lain atau mengurus pool kejohanan.'],chapter='Penilaian dan statistik'),
]
BOOKS['Pengadil']=dict(title='Pengadil',subtitle='Akaun, tugasan, rekod dan permohonan',file='Manual_Pengguna_Pengadil_RefPahang.pdf',pages=common('Pengadil','Dashboard Pengadil')+ref+closing())

# Each standalone manual also explains its own app navigation.
mobile_role_pages={
 'Admin':P('Menu Admin dalam aplikasi mobile',shot='mobile-admin-home',mobile=True,steps=[
 'Utama: semak ringkasan dan perkara yang memerlukan tindakan.',
 'Kelulusan: pilih jenis permohonan, buka butiran, kemudian semak tindakan Lulus / Tolak yang disediakan.',
 'Lantikan: pilih kejohanan, jadual dan perlawanan untuk mengurus slot serta status pegawai.',
 'Profil: semak akaun, Telegram, notifikasi dan menu Lagi / Website.',
 'Gunakan portal web untuk pengurusan lanjutan seperti pengguna, pengadil luar, import pukal, peti emel, tetapan dan analitik.'],chapter='Panduan Admin'),
 'PP_Daerah':P('Menu PP Daerah dalam aplikasi mobile',shot='mobile-pp-home',mobile=True,steps=[
 'Utama: semak perkara perlu tindakan bagi daerah.',
 'Tugasan: semak dan jawab lantikan sendiri. Lantikan: urus lantikan kejohanan daerah yang dibenarkan.',
 'Semakan: pilih permohonan atau rekod perlawanan, baca butiran dan lakukan pengesahan yang tersedia.',
 'Profil: semak identiti, notifikasi dan Telegram. Menu Lagi memberi akses tambahan seperti Permohonan Saya atau Tugasan Penilai apabila layak.',
 'Untuk semakan jadual lebar, import Excel dan pengurusan lanjut, gunakan Website.'],chapter='Panduan PP Daerah'),
 'RA':P('Menu RA dalam aplikasi mobile',shot='mobile-ra-home',mobile=True,steps=[
 'Utama: semak tugasan dan laporan yang perlu tindakan.',
 'Tugasan: terima atau tolak lantikan RA serta baca butiran dan surat.',
 'Laporan: pilih perlawanan, buka borang penilaian, simpan draf atau hantar laporan yang lengkap.',
 'Permohonan: lihat status / sejarah permohonan; gunakan Website apabila pautan borang membawa ke portal.',
 'Profil: semak akaun, Telegram, notifikasi dan menu bantuan.'],chapter='Panduan RA'),
 'Pengadil':P('Menu Pengadil dalam aplikasi mobile',shot='mobile-ref-home',mobile=True,steps=[
 'Utama: semak tugasan dan perkara yang memerlukan tindakan.',
 'Tugasan: baca butiran lantikan, jawab Terima / Tolak dan buka surat apabila tersedia.',
 'Rekod: semak perlawanan serta status PP dan tambah rekod mengikut pilihan yang disediakan.',
 'Permohonan: semak status, butiran dan sejarah; buka Website bagi borang baharu yang memerlukannya.',
 'Profil: kemas kini maklumat yang dibenarkan, pautkan Telegram, aktifkan notifikasi dan gunakan menu Lagi untuk fungsi tambahan.'],chapter='Panduan Pengadil'),
}
for key,p in mobile_role_pages.items():
 pages=BOOKS[key]['pages'];idx=next(i for i,x in enumerate(pages) if x['chapter']==p['chapter']);pages.insert(idx+1,p)

# Keep related chapters contiguous in the Admin edition.
a=BOOKS['Admin']['pages']
def move_before(title,before):
 item=next(p for p in a if p['title']==title);a.remove(item);a.insert(next(i for i,p in enumerate(a) if p['title']==before),item)
move_before('Blast pautan Telegram pengguna berdaftar','Statistik dan penggunaan aplikasi')
move_before('Lampiran Admin: sekat dan aktifkan akaun','Lampiran: sebab Akaun Tidak Aktif')
item=P('Admin yang turut berdaftar sebagai RA',shot='ra-registration',intro='Rajah menunjukkan borang R1 Penilai yang sama. Pilihan ini muncul untuk Admin dengan Jenis Pengadil Penilai Pengadil.',steps=[
 'Semak menu Pendaftaran Penilai Pengadil Saya (R1) jika ia tersedia pada akaun Admin anda.',
 'Buka borang dan semak sesi, profil, waris, dokumen, bayaran dan perakuan seperti pemohon Penilai.',
 'Hantar permohonan dan semak sejarah/status melalui borang tersebut. Jangan cipta akaun awam kedua untuk orang yang sama.',
 'Bezakan kuasa pentadbiran Admin daripada pendaftaran tahunan sebagai Penilai. Menu bersyarat tidak muncul untuk semua Admin.'],note='Jika kelayakan atau kategori akaun tidak sepadan dengan rekod rasmi, betulkan melalui pengurusan pengguna berdasarkan bukti yang sah.',chapter='Pengguna dan pegawai')
a.insert(next(i for i,p in enumerate(a) if p['title']=='Tetapkan tempoh pendaftaran dan permohonan'),item)
