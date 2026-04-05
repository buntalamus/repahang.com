#!/usr/bin/env python3
"""Generate PDF Blueprint: Flow Penuh Permohonan - Sistem Pengadilan PBNP"""

from fpdf import FPDF
import os

class BlueprintPDF(FPDF):
    def __init__(self):
        super().__init__('P', 'mm', 'A4')
        self.set_auto_page_break(auto=True, margin=20)

    def header(self):
        if self.page_no() > 1:
            self.set_font('Helvetica', 'I', 8)
            self.set_text_color(120, 120, 120)
            self.cell(0, 6, 'Blueprint Flow Permohonan - Sistem Pengadilan PBNP', 0, 0, 'L')
            self.cell(0, 6, f'Muka Surat {self.page_no()}', 0, 1, 'R')
            self.line(10, 14, 200, 14)
            self.ln(4)

    def footer(self):
        self.set_y(-15)
        self.set_font('Helvetica', 'I', 7)
        self.set_text_color(150, 150, 150)
        self.cell(0, 10, 'Dokumen ini dijana secara automatik | Persatuan Bola Sepak Negeri Pahang (PBNP)', 0, 0, 'C')

    def cover_page(self):
        self.add_page()
        self.ln(50)
        # Title box
        self.set_fill_color(0, 51, 102)
        self.rect(15, 60, 180, 70, 'F')
        self.set_text_color(255, 255, 255)
        self.set_font('Helvetica', 'B', 28)
        self.set_y(70)
        self.cell(0, 15, 'BLUEPRINT', 0, 1, 'C')
        self.set_font('Helvetica', 'B', 18)
        self.cell(0, 10, 'Flow Penuh Permohonan', 0, 1, 'C')
        self.set_font('Helvetica', '', 14)
        self.cell(0, 10, 'Sistem Pengadilan PBNP', 0, 1, 'C')
        self.set_font('Helvetica', '', 11)
        self.cell(0, 8, 'Persatuan Bola Sepak Negeri Pahang', 0, 1, 'C')

        self.set_text_color(0, 0, 0)
        self.ln(50)
        self.set_font('Helvetica', '', 11)
        self.cell(0, 8, 'Versi: 1.0', 0, 1, 'C')
        self.cell(0, 8, 'Tahun: 2025', 0, 1, 'C')

    def section_title(self, title, color=(0, 51, 102)):
        self.ln(6)
        self.set_fill_color(*color)
        self.set_text_color(255, 255, 255)
        self.set_font('Helvetica', 'B', 14)
        self.cell(0, 10, f'  {title}', 0, 1, 'L', fill=True)
        self.set_text_color(0, 0, 0)
        self.ln(3)

    def sub_title(self, title, color=(41, 128, 185)):
        self.ln(3)
        self.set_text_color(*color)
        self.set_font('Helvetica', 'B', 12)
        self.cell(0, 8, title, 0, 1, 'L')
        self.set_text_color(0, 0, 0)
        self.ln(1)

    def body_text(self, text):
        self.set_font('Helvetica', '', 10)
        self.multi_cell(0, 5.5, text)
        self.ln(1)

    def bullet(self, text, indent=15):
        self.set_font('Helvetica', '', 10)
        self.set_x(self.l_margin + indent)
        w = self.w - self.l_margin - indent - self.r_margin
        self.multi_cell(w, 5.5, '- ' + text)

    def table_header(self, cols, widths):
        self.set_fill_color(0, 51, 102)
        self.set_text_color(255, 255, 255)
        self.set_font('Helvetica', 'B', 9)
        for i, col in enumerate(cols):
            self.cell(widths[i], 7, col, 1, 0, 'C', fill=True)
        self.ln()
        self.set_text_color(0, 0, 0)

    def table_row(self, cells, widths, fill=False):
        self.set_font('Helvetica', '', 9)
        if fill:
            self.set_fill_color(240, 245, 250)
        max_h = 7
        x_start = self.get_x()
        y_start = self.get_y()

        # Calculate row height
        heights = []
        for i, cell in enumerate(cells):
            n_lines = max(1, len(self.multi_cell(widths[i], 5.5, cell, split_only=True)))
            heights.append(n_lines * 5.5)
        max_h = max(max(heights), 7)

        # Check page break
        if y_start + max_h > self.h - 20:
            self.add_page()
            y_start = self.get_y()

        for i, cell in enumerate(cells):
            self.set_xy(x_start + sum(widths[:i]), y_start)
            self.multi_cell(widths[i], max_h / max(1, len(self.multi_cell(widths[i], 5.5, cell, split_only=True))),
                          cell, 1, 'L', fill=fill)
        self.set_xy(x_start, y_start + max_h)

    def flow_box(self, text, x, y, w=50, h=12, color=(0, 51, 102), text_color=(255, 255, 255)):
        self.set_fill_color(*color)
        self.set_draw_color(*color)
        self.rect(x, y, w, h, 'F')
        self.set_text_color(*text_color)
        self.set_font('Helvetica', 'B', 8)
        self.set_xy(x, y + (h - 5) / 2)
        self.cell(w, 5, text, 0, 0, 'C')

    def flow_arrow(self, x1, y1, x2, y2):
        self.set_draw_color(100, 100, 100)
        self.set_line_width(0.4)
        self.line(x1, y1, x2, y2)
        # arrow head
        self.line(x2 - 2, y2 - 2, x2, y2)
        self.line(x2 + 2, y2 - 2, x2, y2)

    def flow_arrow_h(self, x1, y, x2):
        self.set_draw_color(100, 100, 100)
        self.set_line_width(0.4)
        self.line(x1, y, x2, y)
        self.line(x2 - 2, y - 2, x2, y)
        self.line(x2 - 2, y + 2, x2, y)


def build_pdf():
    pdf = BlueprintPDF()

    # ==================== COVER PAGE ====================
    pdf.cover_page()

    # ==================== TABLE OF CONTENTS ====================
    pdf.add_page()
    pdf.section_title('ISI KANDUNGAN')
    toc = [
        ('1', 'Gambaran Keseluruhan Sistem', '3'),
        ('2', 'Peranan Pengguna (Roles)', '4'),
        ('3', 'Jenis Permohonan', '5'),
        ('4', 'Flow Permohonan: Pengadil Berdaftar (R1+R2)', '6'),
        ('5', 'Flow Permohonan: Ujian Kelas III FAM (R11)', '8'),
        ('6', 'Flow Permohonan: Ujian Kelas I FAM (R11)', '9'),
        ('7', 'Flow Permohonan: Penilai Berdaftar (R4)', '10'),
        ('8', 'Flow Permohonan: PP Daerah (Sama Seperti Pengadil)', '11'),
        ('9', 'Aliran Status Workflow', '12'),
        ('10', 'Tetapan Sistem (Application Settings)', '13'),
        ('11', 'Notifikasi & Email', '14'),
        ('12', 'Template PDF (Borang)', '15'),
    ]
    pdf.set_font('Helvetica', '', 11)
    for num, title, page in toc:
        pdf.cell(10, 8, num + '.', 0, 0, 'R')
        pdf.cell(5, 8, '', 0, 0)
        pdf.cell(140, 8, title, 0, 0, 'L')
        pdf.cell(0, 8, page, 0, 1, 'R')

    # ==================== SECTION 1: OVERVIEW ====================
    pdf.add_page()
    pdf.section_title('1. GAMBARAN KESELURUHAN SISTEM')

    pdf.body_text(
        'Sistem Pengadilan PBNP adalah platform digital untuk Persatuan Bola Sepak Negeri Pahang '
        'yang menguruskan pendaftaran tahunan dan peperiksaan FAM bagi pengadil, penilai, dan '
        'PP Daerah. Sistem ini merangkumi 5 jenis permohonan utama yang melibatkan 4 peranan pengguna.'
    )

    pdf.sub_title('Komponen Utama')
    pdf.bullet('Frontend: Angular (Single Page Application)')
    pdf.bullet('Backend: PHP REST API + MySQL')
    pdf.bullet('PDF: TCPDF Library (jana borang R1, R2, R4, R11)')
    pdf.bullet('Notifikasi: In-app + Email (PHPMailer)')

    pdf.sub_title('Flow Umum Permohonan')
    pdf.body_text(
        'Setiap permohonan melalui aliran yang sama:'
    )

    # Draw flow diagram
    y_start = pdf.get_y() + 5
    pdf.flow_box('Pemohon\nIsi Borang', 10, y_start, 35, 16, (41, 128, 185))
    pdf.flow_arrow_h(45, y_start + 8, 52)
    pdf.flow_box('Hantar\nPermohonan', 52, y_start, 35, 16, (39, 174, 96))
    pdf.flow_arrow_h(87, y_start + 8, 94)
    pdf.flow_box('PP Daerah\nSemak', 94, y_start, 35, 16, (243, 156, 18))
    pdf.flow_arrow_h(129, y_start + 8, 136)
    pdf.flow_box('Admin\nLulus/Tolak', 136, y_start, 35, 16, (231, 76, 60))
    pdf.flow_arrow_h(171, y_start + 8, 178)
    pdf.flow_box('Lengkap', 178, y_start, 25, 16, (0, 51, 102))

    pdf.set_y(y_start + 25)
    pdf.ln(5)

    pdf.body_text(
        'Pemohon mengisi maklumat, memuat naik dokumen, membuat bayaran, dan menghantar permohonan. '
        'PP Daerah mengesahkan permohonan dari daerah mereka. Admin membuat keputusan muktamad. '
        'Notifikasi dihantar pada setiap peringkat.'
    )

    # ==================== SECTION 2: ROLES ====================
    pdf.add_page()
    pdf.section_title('2. PERANAN PENGGUNA (ROLES)')

    roles = [
        ('Pengadil', 'Pengadil bola sepak berdaftar',
         'Hantar permohonan: Pendaftaran Tahunan (R1+R2), Ujian Kelas III FAM (R11), Ujian Kelas I FAM (R11)\n'
         'Lihat sejarah permohonan, perlawanan, penilaian, tugasan'),
        ('Penilai', 'Penilai Pengadil Negeri',
         'Hantar permohonan: Pendaftaran Tahunan Penilai (R4)\n'
         'Menilai pengadil, lihat tugasan penilaian'),
        ('PP Daerah', 'Penyelaras Pengadilan Daerah',
         'Hantar permohonan: Pendaftaran Tahunan (R1+R2), Ujian Kelas III (R11), Ujian Kelas I (R11)\n'
         'TANPA syarat minimum perlawanan untuk pendaftaran tahunan\n'
         'Sahkan/tolak permohonan dari pengadil daerah\n'
         'Muat turun borang PDF, lihat senarai pengadil daerah'),
        ('Admin', 'Pentadbir Sistem',
         'Lulus/tolak permohonan di peringkat admin\n'
         'Urus tetapan sistem, pengguna, pengumuman\n'
         'Lihat statistik, laporan, lantikan pengadil'),
    ]

    widths = [25, 40, 125]
    pdf.table_header(['Peranan', 'Deskripsi', 'Kebenaran / Fungsi'], widths)
    for i, (role, desc, perms) in enumerate(roles):
        pdf.table_row([role, desc, perms], widths, fill=(i % 2 == 0))

    # ==================== SECTION 3: APPLICATION TYPES ====================
    pdf.add_page()
    pdf.section_title('3. JENIS PERMOHONAN')

    types_data = [
        ('pengadil_berdaftar', 'Pendaftaran Tahunan\nPengadil', 'R1 + R2', 'Pengadil\nPP Daerah',
         'berdaftar_open', 'RM80\n(PBNP)'),
        ('ujian_bertulis', 'Ujian Kelas III\nFAM', 'R11', 'Pengadil\nPP Daerah',
         'bertulis_open', 'RM50\n(FAM)'),
        ('ujian_kelas1_fam', 'Ujian Kelas I\nFAM', 'R11', 'Pengadil\nPP Daerah',
         'kelas1_open', 'RM300\n(FAM)'),
        ('penilai_berdaftar', 'Pendaftaran Tahunan\nPenilai', 'R4', 'Penilai',
         'penilai_open', 'RM80\n(PBNP)'),
    ]

    widths = [35, 35, 18, 22, 30, 20]
    pdf.set_font('Helvetica', 'B', 9)
    pdf.table_header(['Jenis Borang', 'Nama', 'Template', 'Peranan', 'Setting Key', 'Bayaran'], widths)
    for i, row in enumerate(types_data):
        pdf.table_row(list(row), widths, fill=(i % 2 == 0))

    # ==================== SECTION 4: PENGADIL BERDAFTAR ====================
    pdf.add_page()
    pdf.section_title('4. FLOW: PENGADIL BERDAFTAR (R1+R2)')

    pdf.sub_title('4.1 Maklumat Asas')
    pdf.body_text('Jenis Borang: pengadil_berdaftar')
    pdf.body_text('Template PDF: R1 (Pendaftaran) + R2 (Kecergasan/Perubatan)')
    pdf.body_text('Peranan: Pengadil')
    pdf.body_text('Bayaran: RM80.00 ke akaun PBNP')

    pdf.sub_title('4.2 Syarat Kelayakan')
    pdf.bullet(f'Minimum perlawanan disahkan (min_verified_matches) dalam tahun semasa - default: 20')
    pdf.bullet('Hanya 1 permohonan per jenis borang per tahun')
    pdf.bullet('Tetapan berdaftar_open = 1 (aktif)')

    pdf.sub_title('4.3 Maklumat Diperlukan')
    pdf.ln(2)
    info_items = [
        ('Auto dari profil', 'Nama penuh, No IC, Email, No telefon, Jantina, Alamat penuh, Majikan, Jenis pengadil, Tahun mula aktif'),
        ('Diisi pengguna', 'Nama waris, Hubungan waris, Telefon waris, Saiz baju'),
        ('Muat naik', 'Resit bayaran (wajib), Gambar profil (wajib)'),
        ('Deklarasi', '5 deklarasi kesihatan + 3 deklarasi umum (semua wajib)'),
    ]
    widths2 = [40, 150]
    pdf.table_header(['Kategori', 'Butiran'], widths2)
    for i, (cat, detail) in enumerate(info_items):
        pdf.table_row([cat, detail], widths2, fill=(i % 2 == 0))

    pdf.sub_title('4.4 Langkah-langkah Flow')
    steps = [
        '1. Pengadil log masuk dan navigasi ke menu Permohonan > Pendaftaran Tahunan',
        '2. Sistem semak kelayakan: berdaftar_open=1, bilangan perlawanan >= minimum, belum mohon tahun ini',
        '3. Jika layak, borang dipaparkan dengan maklumat profil auto-isi',
        '4. Pengadil isi maklumat waris, saiz baju, muat naik resit + gambar',
        '5. Pengadil tandakan semua 8 deklarasi (5 kesihatan + 3 umum)',
        '6. Pengadil klik "Hantar Permohonan"',
        '7. Backend: Simpan permohonan (status=Pending, workflow=Menunggu PP Daerah)',
        '8. Backend: Set mohon_r1=1, mohon_ujian_kecergasan=1 pada user',
        '9. Backend: Kaitkan semua perlawanan disahkan (set permohonan_id)',
        '10. Notifikasi in-app ke semua Admin + email pengesahan ke pengadil',
        '11. PP Daerah semak dan sahkan/tolak',
        '12. Jika disahkan PP: workflow bertukar ke "Menunggu Admin"',
        '13. Admin semak dan lulus/tolak',
        '14. Jika diluluskan Admin: workflow = "Lengkap", status = "Approved"',
    ]
    for s in steps:
        pdf.bullet(s)

    # ==================== SECTION 5: UJIAN BERTULIS ====================
    pdf.add_page()
    pdf.section_title('5. FLOW: UJIAN KELAS III FAM (R11)')

    pdf.sub_title('5.1 Maklumat Asas')
    pdf.body_text('Jenis Borang: ujian_bertulis')
    pdf.body_text('Template PDF: R11')
    pdf.body_text('Peranan: Pengadil')
    pdf.body_text('Bayaran: RM50.00 ke akaun FAM (Bank Islam PBM - 1213 1010 0061 21)')

    pdf.sub_title('5.2 Syarat Kelayakan')
    pdf.bullet('Umur antara 15 hingga 40 tahun (berdasarkan No IC)')
    pdf.bullet('Hanya 1 permohonan per jenis borang per tahun')
    pdf.bullet('Tetapan bertulis_open = 1 (aktif)')
    pdf.bullet('TIADA syarat minimum perlawanan')

    pdf.sub_title('5.3 Maklumat Diperlukan')
    widths2 = [40, 150]
    info_items = [
        ('Auto dari profil', 'Nama penuh, No IC, Email, No telefon, Jantina, Alamat, Majikan'),
        ('Diisi pengguna', 'Nama waris, Hubungan waris, Telefon waris'),
        ('Muat naik', 'Resit bayaran FAM (wajib). Gambar TIDAK diperlukan'),
        ('Deklarasi', 'declare1 + declare2 (2 deklarasi umum sahaja)'),
    ]
    pdf.table_header(['Kategori', 'Butiran'], widths2)
    for i, (cat, detail) in enumerate(info_items):
        pdf.table_row([cat, detail], widths2, fill=(i % 2 == 0))

    pdf.sub_title('5.4 Langkah-langkah Flow')
    steps = [
        '1. Pengadil navigasi ke Permohonan > Ujian Kelas III',
        '2. Sistem semak: bertulis_open=1, umur 15-40, belum mohon tahun ini',
        '3. Borang R11 dipaparkan dengan maklumat profil',
        '4. Pengadil isi waris, muat naik resit bayaran FAM',
        '5. Tandakan 2 deklarasi',
        '6. Hantar permohonan (status=Pending, workflow=Menunggu PP Daerah)',
        '7. PP Daerah sahkan > Menunggu Admin',
        '8. Admin lulus > Lengkap (workflow_status=Approved)',
    ]
    for s in steps:
        pdf.bullet(s)

    # ==================== SECTION 6: KELAS I FAM ====================
    pdf.add_page()
    pdf.section_title('6. FLOW: UJIAN KELAS I FAM (R11)')

    pdf.sub_title('6.1 Maklumat Asas')
    pdf.body_text('Jenis Borang: ujian_kelas1_fam')
    pdf.body_text('Template PDF: R11')
    pdf.body_text('Peranan: Pengadil')
    pdf.body_text('Bayaran: RM300.00 ke akaun FAM')

    pdf.sub_title('6.2 Syarat Kelayakan')
    pdf.bullet('Umur tidak melebihi 32 tahun (berdasarkan No IC)')
    pdf.bullet('Telah lulus Ujian Kelas III FAM sekurang-kurangnya 2 tahun lalu')
    pdf.bullet('  - Perlu ada rekod ujian_bertulis yang diluluskan dengan tahun_permohonan <= (tahun_semasa - 2)')
    pdf.bullet('Hanya 1 permohonan per jenis borang per tahun')
    pdf.bullet('Tetapan kelas1_open = 1 (aktif)')

    pdf.sub_title('6.3 Maklumat Diperlukan')
    widths2 = [40, 150]
    info_items = [
        ('Auto dari profil', 'Nama penuh, No IC, Email, No telefon, Jantina, Alamat, Majikan'),
        ('Diisi pengguna', 'Nama waris, Hubungan waris, Telefon waris'),
        ('Muat naik', 'Resit bayaran FAM (wajib). Gambar TIDAK diperlukan'),
        ('Deklarasi', 'declare1 + declare2 (2 deklarasi umum sahaja)'),
    ]
    pdf.table_header(['Kategori', 'Butiran'], widths2)
    for i, (cat, detail) in enumerate(info_items):
        pdf.table_row([cat, detail], widths2, fill=(i % 2 == 0))

    pdf.sub_title('6.4 Langkah-langkah Flow')
    steps = [
        '1. Pengadil navigasi ke Permohonan > Ujian Kelas I',
        '2. Sistem semak: kelas1_open=1, umur <= 32, lulus Kelas III >= 2 tahun, belum mohon',
        '3. Borang R11 dipaparkan (berbeza daripada Kelas III dari segi bayaran)',
        '4. Pengadil isi waris, muat naik resit bayaran FAM RM300',
        '5. Tandakan 2 deklarasi, hantar',
        '6. Flow: Menunggu PP Daerah > Menunggu Admin > Lengkap',
    ]
    for s in steps:
        pdf.bullet(s)

    # ==================== SECTION 7: PENILAI BERDAFTAR ====================
    pdf.add_page()
    pdf.section_title('7. FLOW: PENILAI BERDAFTAR (R4)')

    pdf.sub_title('7.1 Maklumat Asas')
    pdf.body_text('Jenis Borang: penilai_berdaftar')
    pdf.body_text('Template PDF: R4')
    pdf.body_text('Peranan: Penilai')
    pdf.body_text('Bayaran: RM80.00 ke akaun PBNP')

    pdf.sub_title('7.2 Syarat Kelayakan')
    pdf.bullet('Hanya 1 permohonan per jenis borang per tahun')
    pdf.bullet('Tetapan penilai_open = 1 (aktif)')
    pdf.bullet('TIADA syarat minimum perlawanan atau umur')

    pdf.sub_title('7.3 Maklumat Diperlukan')
    widths2 = [40, 150]
    info_items = [
        ('Auto dari profil', 'Nama penuh, No IC, Email, No telefon, Jantina, Alamat, Majikan'),
        ('Diisi pengguna', 'Nama waris, Hubungan waris, Telefon waris, Saiz baju'),
        ('Muat naik', 'Resit bayaran (wajib), Gambar profil (wajib)'),
        ('Deklarasi', '5 deklarasi kesihatan + 3 deklarasi umum (semua wajib)'),
    ]
    pdf.table_header(['Kategori', 'Butiran'], widths2)
    for i, (cat, detail) in enumerate(info_items):
        pdf.table_row([cat, detail], widths2, fill=(i % 2 == 0))

    pdf.sub_title('7.4 Langkah-langkah Flow')
    steps = [
        '1. Penilai log masuk dan navigasi ke Permohonan > Pendaftaran Tahunan',
        '2. Sistem semak: penilai_open=1, belum mohon tahun ini',
        '3. Borang R4 dipaparkan dengan maklumat profil',
        '4. Penilai isi waris, saiz baju, muat naik resit + gambar',
        '5. Tandakan 8 deklarasi (5 kesihatan + 3 umum)',
        '6. Hantar (status=Pending, workflow=Menunggu PP Daerah)',
        '7. PP Daerah sahkan > Menunggu Admin > Admin lulus > Lengkap',
    ]
    for s in steps:
        pdf.bullet(s)

    # ==================== SECTION 8: PP DAERAH ====================
    pdf.add_page()
    pdf.section_title('8. FLOW: PP DAERAH')

    pdf.sub_title('8.1 Gambaran Keseluruhan')
    pdf.body_text(
        'PP Daerah mempunyai peranan dwi-fungsi: mereka boleh menghantar permohonan sendiri '
        '(sama seperti Pengadil) DAN juga mengesahkan/menolak permohonan dari pengadil daerah mereka.'
    )
    pdf.body_text(
        'PP Daerah boleh memohon jenis borang yang SAMA seperti Pengadil:'
    )
    pdf.bullet('Pendaftaran Tahunan Pengadil (R1+R2) - TANPA syarat minimum perlawanan')
    pdf.bullet('Ujian Kecergasan - dibundel dengan pendaftaran tahunan')
    pdf.bullet('Ujian Kelas III FAM (R11) - syarat sama seperti Pengadil')
    pdf.bullet('Ujian Kelas I FAM (R11) - syarat sama seperti Pengadil')

    pdf.sub_title('8.2 Perbezaan dengan Pengadil')
    widths2 = [60, 65, 65]
    pdf.table_header(['Aspek', 'Pengadil', 'PP Daerah'], widths2)
    diff_rows = [
        ('Min perlawanan\n(Pendaftaran Tahunan)', 'Wajib: 20 perlawanan\ndisahkan', 'TIDAK diperlukan'),
        ('Ujian Kelas III', 'Syarat umur 15-40', 'Syarat umur 15-40\n(Sama)'),
        ('Ujian Kelas I', 'Umur <= 32 + lulus\nKelas III >= 2 tahun', 'Umur <= 32 + lulus\nKelas III >= 2 tahun\n(Sama)'),
        ('Fungsi tambahan', 'Tiada', 'Sahkan/tolak permohonan\npengadil daerah'),
    ]
    for i, row in enumerate(diff_rows):
        pdf.table_row(list(row), widths2, fill=(i % 2 == 0))

    pdf.sub_title('8.3 Pendaftaran Tahunan PP Daerah (R1+R2)')
    pdf.body_text('Jenis Borang: pengadil_berdaftar (sama seperti Pengadil)')
    pdf.body_text('Template PDF: R1 + R2')
    pdf.body_text('Bayaran: RM80.00 ke akaun PBNP')
    pdf.body_text('Syarat: berdaftar_open=1, belum mohon tahun semasa. TIADA minimum perlawanan.')

    pdf.sub_title('8.4 Langkah-langkah Flow')
    steps = [
        '1. PP Daerah log masuk dan navigasi ke Permohonan Saya > Pendaftaran Tahunan',
        '2. Sistem semak: berdaftar_open=1, belum mohon tahun ini (TIADA semakan perlawanan)',
        '3. Borang R1+R2 dipaparkan dengan maklumat profil',
        '4. PP Daerah isi waris, saiz baju, muat naik resit + gambar',
        '5. Tandakan 8 deklarasi (5 kesihatan + 3 umum)',
        '6. Hantar (status=Pending, workflow=Menunggu PP Daerah)',
        '7. PP Daerah sahkan > Menunggu Admin > Admin lulus > Lengkap',
        '8. Untuk Kelas III dan Kelas I, flow sama seperti Pengadil (Bahagian 5 & 6)',
    ]
    for s in steps:
        pdf.bullet(s)

    # ==================== SECTION 9: STATUS WORKFLOW ====================
    pdf.add_page()
    pdf.section_title('9. ALIRAN STATUS WORKFLOW')

    pdf.sub_title('9.1 Nilai Status Workflow')
    widths3 = [45, 65, 80]
    pdf.table_header(['Status', 'Maksud', 'Set Oleh'], widths3)
    statuses = [
        ('Menunggu PP Daerah', 'Menunggu pengesahan PP Daerah', 'Sistem (pada hantar)'),
        ('Menunggu Admin', 'Menunggu kelulusan Admin', 'PP Daerah (pada sahkan)'),
        ('Lengkap', 'Diluluskan sepenuhnya', 'Admin (pada lulus)'),
        ('Ditolak', 'Permohonan ditolak', 'PP Daerah / Admin'),
        ('Draf', 'Draf (belum dihantar)', 'Frontend sahaja'),
    ]
    for i, row in enumerate(statuses):
        pdf.table_row(list(row), widths3, fill=(i % 2 == 0))

    pdf.sub_title('9.2 Dual Status System')
    pdf.body_text(
        'Sistem menggunakan 2 lajur status:'
    )
    pdf.bullet('status: Nilai generik (Pending / Approved / Rejected)')
    pdf.bullet('status_workflow: Langkah terperinci (Menunggu PP Daerah / Menunggu Admin / Lengkap / Ditolak)')
    pdf.bullet('workflow_status: Untuk jenis peperiksaan sahaja (set "Approved" apabila Admin lulus)')

    pdf.sub_title('9.3 Diagram Aliran')

    y = pdf.get_y() + 8

    # Row 1: Submit
    pdf.flow_box('Pemohon Hantar', 30, y, 45, 12, (41, 128, 185))
    pdf.flow_arrow_h(75, y + 6, 85)
    pdf.flow_box('Menunggu\nPP Daerah', 85, y, 45, 12, (243, 156, 18))

    # Branch: PP approve
    pdf.flow_arrow_h(130, y + 6, 140)
    pdf.flow_box('Menunggu\nAdmin', 140, y, 45, 12, (230, 126, 34))

    y2 = y + 20
    # Branch: Admin approve
    pdf.flow_arrow(162, y + 12, 162, y2)
    pdf.flow_box('Lengkap\n(Approved)', 120, y2, 40, 12, (39, 174, 96))

    # Branch: Admin reject
    pdf.flow_box('Ditolak', 170, y2, 35, 12, (192, 57, 43))
    pdf.flow_arrow(185, y + 12, 185, y2)

    # Branch: PP reject
    y3 = y + 20
    pdf.flow_arrow(107, y + 12, 107, y3)
    pdf.flow_box('Ditolak', 85, y3, 35, 12, (192, 57, 43))

    pdf.set_y(y3 + 20)

    # Labels
    pdf.set_font('Helvetica', 'I', 7)
    pdf.set_text_color(100, 100, 100)
    pdf.set_xy(130, y + 2)
    pdf.cell(10, 3, 'Sahkan', 0, 0, 'C')
    pdf.set_xy(85, y + 14)
    pdf.cell(10, 3, 'Tolak', 0, 0, 'C')
    pdf.set_xy(155, y + 14)
    pdf.cell(10, 3, 'Lulus', 0, 0, 'C')
    pdf.set_xy(183, y + 14)
    pdf.cell(10, 3, 'Tolak', 0, 0, 'C')
    pdf.set_text_color(0, 0, 0)

    # ==================== SECTION 10: SETTINGS ====================
    pdf.add_page()
    pdf.section_title('10. TETAPAN SISTEM (APPLICATION SETTINGS)')

    pdf.sub_title('10.1 Tetapan Buka/Tutup Permohonan')
    widths4 = [45, 75, 35]
    pdf.table_header(['Key', 'Penerangan', 'Default'], widths4)
    settings_oc = [
        ('berdaftar_open', 'Buka permohonan Pengadil & PP Berdaftar', '0'),
        ('berdaftar_open_date', 'Tarikh buka pendaftaran', '-'),
        ('berdaftar_close_date', 'Tarikh tutup pendaftaran', '-'),
        ('bertulis_open', 'Buka permohonan Ujian Kelas III', '0'),
        ('bertulis_open_date', 'Tarikh buka ujian bertulis', '-'),
        ('bertulis_close_date', 'Tarikh tutup ujian bertulis', '-'),
        ('kelas1_open', 'Buka permohonan Ujian Kelas I', '0'),
        ('kelas1_open_date', 'Tarikh buka kelas I', '-'),
        ('kelas1_close_date', 'Tarikh tutup kelas I', '-'),
        ('penilai_open', 'Buka permohonan Penilai Berdaftar', '0'),
        ('application_year', 'Tahun permohonan semasa', '2025'),
    ]
    for i, row in enumerate(settings_oc):
        pdf.table_row(list(row), widths4, fill=(i % 2 == 0))

    pdf.sub_title('10.2 Tetapan Bayaran')
    widths5 = [45, 75, 35]
    pdf.table_header(['Key', 'Penerangan', 'Default'], widths5)
    settings_pay = [
        ('payment_amount', 'Yuran pendaftaran tahunan (PBNP)', 'RM80'),
        ('payment_bank_name', 'Nama bank PBNP', '-'),
        ('payment_account_name', 'Nama akaun PBNP', '-'),
        ('payment_account_no', 'No akaun PBNP', '-'),
        ('fam_bank_name', 'Nama bank FAM', 'Bank Islam PBM'),
        ('fam_account_no', 'No akaun FAM', '1213 1010 0061 21'),
        ('bertulis_fee', 'Yuran Ujian Kelas III', 'RM50'),
        ('kelas1_fee', 'Yuran Ujian Kelas I', 'RM300'),
    ]
    for i, row in enumerate(settings_pay):
        pdf.table_row(list(row), widths5, fill=(i % 2 == 0))

    pdf.sub_title('10.3 Tetapan Kelayakan')
    widths6 = [55, 70, 30]
    pdf.table_header(['Key', 'Penerangan', 'Default'], widths6)
    settings_elig = [
        ('min_verified_matches', 'Min perlawanan disahkan (Pengadil Berdaftar)', '20'),
        ('bertulis_min_age', 'Umur minimum Ujian Kelas III', '15'),
        ('bertulis_max_age', 'Umur maksimum Ujian Kelas III', '40'),
        ('kelas1_max_age', 'Umur maksimum Ujian Kelas I', '32'),
        ('kelas1_min_fitness_rounds', 'Min pusingan kecergasan Kelas I', '7'),
    ]
    for i, row in enumerate(settings_elig):
        pdf.table_row(list(row), widths6, fill=(i % 2 == 0))

    # ==================== SECTION 11: NOTIFICATIONS ====================
    pdf.add_page()
    pdf.section_title('11. NOTIFIKASI & EMAIL')

    pdf.sub_title('11.1 Aliran Notifikasi')
    widths7 = [40, 35, 50, 65]
    pdf.table_header(['Peristiwa', 'Jenis', 'Penerima', 'Butiran'], widths7)
    notifs = [
        ('Permohonan dihantar', 'In-app + Email', 'Admin (in-app)\nPemohon (email)', 'Notifikasi "Permohonan Baru"\nEmail pengesahan'),
        ('PP sahkan', 'In-app + Email', 'Admin + Pemohon', 'Status bertukar ke\nMenunggu Admin'),
        ('PP tolak', 'In-app + Email', 'Pemohon', 'Notifikasi penolakan\ndengan sebab'),
        ('Admin lulus', 'In-app + Email', 'Pemohon', '"Pendaftaran Lengkap"\nEmail kelulusan'),
        ('Admin tolak', 'In-app + Email', 'Pemohon', '"Permohonan Ditolak"\nEmail penolakan'),
    ]
    for i, row in enumerate(notifs):
        pdf.table_row(list(row), widths7, fill=(i % 2 == 0))

    pdf.sub_title('11.2 Kaedah Penghantaran')
    pdf.bullet('In-app: Disimpan dalam jadual notifications, dipapar melalui API /api/notifications.php')
    pdf.bullet('Email: Dihantar menggunakan PHPMailer, konfigurasi di config/email.php')
    pdf.bullet('Fungsi: sendAdminNotification(), sendApplicantNotification(), sendApprovalEmail(), sendRejectionEmail()')

    # ==================== SECTION 12: PDF TEMPLATES ====================
    pdf.add_page()
    pdf.section_title('12. TEMPLATE PDF (BORANG)')

    pdf.sub_title('12.1 Senarai Template')
    widths8 = [25, 55, 55, 55]
    pdf.table_header(['Template', 'Nama Borang', 'Digunakan Untuk', 'Dijana Melalui'], widths8)
    templates = [
        ('R1', 'Borang Pendaftaran\nPengadil/PP', 'pengadil_berdaftar\npp_berdaftar', 'download-borang-\npendaftaran.php'),
        ('R2', 'Borang Kecergasan\n& Perubatan', 'pengadil_berdaftar\n(bundled dengan R1)', 'download-borang-\npendaftaran.php'),
        ('R4', 'Borang Penilai\nPengadil Negeri', 'penilai_berdaftar', 'download-borang-\npendaftaran.php'),
        ('R11', 'Borang Peperiksaan\nFAM', 'ujian_bertulis\nujian_kelas1_fam', 'download-borang-\npendaftaran.php'),
    ]
    for i, row in enumerate(templates):
        pdf.table_row(list(row), widths8, fill=(i % 2 == 0))

    pdf.sub_title('12.2 Teknologi')
    pdf.bullet('Library: TCPDF')
    pdf.bullet('Lokasi template: api/templates/ (r1.php, r2.php, r4.php, r11.php)')
    pdf.bullet('API endpoint: download-borang-pendaftaran.php?type={jenis}&id={permohonan_id}')

    # ==================== SUMMARY TABLE ====================
    pdf.add_page()
    pdf.section_title('RINGKASAN PERBANDINGAN')

    pdf.set_font('Helvetica', '', 8)
    widths9 = [38, 38, 38, 38, 38]
    pdf.set_fill_color(0, 51, 102)
    pdf.set_text_color(255, 255, 255)
    pdf.set_font('Helvetica', 'B', 7)
    headers = ['Aspek', 'Pengadil\nBerdaftar', 'Ujian\nKelas III', 'Ujian\nKelas I', 'Penilai\nBerdaftar']
    for i, h in enumerate(headers):
        pdf.cell(widths9[i], 10, h, 1, 0, 'C', fill=True)
    pdf.ln()
    pdf.set_text_color(0, 0, 0)
    pdf.set_font('Helvetica', '', 7)

    comparison = [
        ('Borang', 'R1+R2', 'R11', 'R11', 'R4'),
        ('Peranan', 'Pengadil\nPP Daerah', 'Pengadil\nPP Daerah', 'Pengadil\nPP Daerah', 'Penilai'),
        ('Bayaran', 'RM80 PBNP', 'RM50 FAM', 'RM300 FAM', 'RM80 PBNP'),
        ('Resit', 'Ya', 'Ya', 'Ya', 'Ya'),
        ('Gambar', 'Ya', 'Tidak', 'Tidak', 'Ya'),
        ('Saiz Baju', 'Ya', 'Tidak', 'Tidak', 'Ya'),
        ('Deklarasi', '8 (5+3)', '2', '2', '8 (5+3)'),
        ('Syarat Umur', 'Tiada', '15-40', '<= 32', 'Tiada'),
        ('Min Perlawanan', '20 (Pengadil)\nTiada (PP)', 'Tiada', 'Tiada', 'Tiada'),
        ('Prasyarat', 'Tiada', 'Tiada', 'Lulus Kelas III\n>= 2 tahun', 'Tiada'),
        ('Setting Key', 'berdaftar_open', 'bertulis_open', 'kelas1_open', 'penilai_open'),
    ]

    for idx, row in enumerate(comparison):
        fill = idx % 2 == 0
        if fill:
            pdf.set_fill_color(240, 245, 250)
        h = 7
        if any('\n' in c for c in row):
            h = 10
        for i, c in enumerate(row):
            if i == 0:
                pdf.set_font('Helvetica', 'B', 7)
            else:
                pdf.set_font('Helvetica', '', 7)
            pdf.cell(widths9[i], h, c, 1, 0, 'C', fill=fill)
        pdf.ln()

    # Output
    output_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'blueprint-flow-permohonan.pdf')
    pdf.output(output_path)
    print(f'PDF generated: {output_path}')


if __name__ == '__main__':
    build_pdf()
