-- ================================================================
-- IMPORT KELAS III FAM 2026 — Permohonan Offline
-- Dijana: 2026-04-11
-- Jalankan SEKALI SAHAJA di phpMyAdmin
-- Rekod yang IC atau emel sudah wujud dalam sistem akan dilangkau
-- ================================================================

START TRANSACTION;

-- [1] MUHAMMAD AHZA BIN AZLAN (Jerantut)
SET @ic = '030426080579';
SET @em = 'ahzaazlan2003@gmail.com';
INSERT INTO `users` (email, password, role, district_id, persatuan_id, nama_penuh, no_ic, no_telefon, jantina, jenis_pengadil, alamat1, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, umur, aktif, password_changed, tg_link_token, created_at)
SELECT 'ahzaazlan2003@gmail.com', '$2b$10$CS4zu5XFtk5HaGV.HMOmy.LAySMNR..ohcCVUue/Oz0.zUCmgb5qe', 'Pengadil', 4, 4, 'MUHAMMAD AHZA BIN AZLAN', '030426080579', '0197766935', 'LELAKI', 'Kelas III FAM', 'E2 RUMAH KAKITANGAN FELDA LEPAR UTARA 2/4 , 26400 BANDAR JENGKA PAHANG', 'Jerantut', 'Pahang', 'BEKERJA', 'PEMBANTU HAL EHWAL ISLAM FELDA', 'FELDA', 'PEJABAT FELDA LEPAR UTARA 2/4', 'HANISEZATUL HUSNA BINTI HAMAD', 'ISTERI', '0179470612', 23, 1, 0, 'dfb38b09fff09ea2ca4abcbf7688b860', NOW()
WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE no_ic = @ic OR email = @em);
INSERT INTO `permohonan` (user_id, district_id, persatuan_id, tahun_permohonan, jenis_permohonan, jenis_borang, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, persatuan_daerah, alamat1, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, url_resit, status, status_workflow, mohon_ujian_bertulis, payment_amount, umur, declare1, declare2, declare3, tarikh_hantar)
SELECT u.id, 4, 4, 2026, 'kelas3_fam', 'kelas3_fam', 'MUHAMMAD AHZA BIN AZLAN', '030426080579', 'ahzaazlan2003@gmail.com', '0197766935', 'LELAKI', 'Kelas III FAM', 'Persatuan Bolasepak Daerah Jerantut', 'E2 RUMAH KAKITANGAN FELDA LEPAR UTARA 2/4 , 26400 BANDAR JENGKA PAHANG', 'Jerantut', 'Pahang', 'BEKERJA', 'PEMBANTU HAL EHWAL ISLAM FELDA', 'FELDA', 'PEJABAT FELDA LEPAR UTARA 2/4', 'HANISEZATUL HUSNA BINTI HAMAD', 'ISTERI', '0179470612', 'https://drive.google.com/open?id=1n4FbMe6V6WIR45T1-XFHBvSyN7uhqRH4', 'Pending', 'Menunggu Admin', 1, 80.00, 23, 1, 1, 1, NOW()
FROM `users` u WHERE u.no_ic = @ic
AND NOT EXISTS (SELECT 1 FROM `permohonan` WHERE no_kp = @ic AND tahun_permohonan = 2026 AND jenis_borang = 'kelas3_fam');

-- [2] ROSDI BIN ABDULLAH (Bera)
SET @ic = '800524035253';
SET @em = 'rosdi5225@gmail.com';
INSERT INTO `users` (email, password, role, district_id, persatuan_id, nama_penuh, no_ic, no_telefon, jantina, jenis_pengadil, alamat1, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, umur, aktif, password_changed, tg_link_token, created_at)
SELECT 'rosdi5225@gmail.com', '$2b$10$2WvQLjatTbfnV1XTshX7duCx4TcVHA0SGuULCoMEJmYcKdBmKpHVm', 'Pengadil', 2, 2, 'ROSDI BIN ABDULLAH', '800524035253', '0122300519', 'LELAKI', 'Kelas III FAM', 'A-1-4 KIP. SK. KERAYONG , KG.PADANG LUAS, 28200 BANDAR BERA, BERA, PAHANG', 'Bera', 'Pahang', 'BEKERJA', 'PENOLONG JURUTERA', 'JURUTERA DAERAH', 'JKR DAERAH BERA, KOMPLEKS KERAJAAN DAERAH BERA, 28200 BANDAR BERA', 'SRI JUNITA BT MOHAMED', 'ISTERI', '0103839232', 46, 1, 0, '00e081602f417f26fcc8827eb59262c7', NOW()
WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE no_ic = @ic OR email = @em);
INSERT INTO `permohonan` (user_id, district_id, persatuan_id, tahun_permohonan, jenis_permohonan, jenis_borang, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, persatuan_daerah, alamat1, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, url_resit, status, status_workflow, mohon_ujian_bertulis, payment_amount, umur, declare1, declare2, declare3, tarikh_hantar)
SELECT u.id, 2, 2, 2026, 'kelas3_fam', 'kelas3_fam', 'ROSDI BIN ABDULLAH', '800524035253', 'rosdi5225@gmail.com', '0122300519', 'LELAKI', 'Kelas III FAM', 'Persatuan Bolasepak Daerah Bera', 'A-1-4 KIP. SK. KERAYONG , KG.PADANG LUAS, 28200 BANDAR BERA, BERA, PAHANG', 'Bera', 'Pahang', 'BEKERJA', 'PENOLONG JURUTERA', 'JURUTERA DAERAH', 'JKR DAERAH BERA, KOMPLEKS KERAJAAN DAERAH BERA, 28200 BANDAR BERA', 'SRI JUNITA BT MOHAMED', 'ISTERI', '0103839232', 'https://drive.google.com/open?id=1FXMpVBTIWpHWkBXR7XjdOkD_I9gfOAUb', 'Pending', 'Menunggu Admin', 1, 80.00, 46, 1, 1, 1, NOW()
FROM `users` u WHERE u.no_ic = @ic
AND NOT EXISTS (SELECT 1 FROM `permohonan` WHERE no_kp = @ic AND tahun_permohonan = 2026 AND jenis_borang = 'kelas3_fam');

-- [3] MOHD FAISAL KAMIL BIN MOHD ADNAN (Maran)
SET @ic = '090417060669';
SET @em = 'abdullahayue01@gmail.com';
INSERT INTO `users` (email, password, role, district_id, persatuan_id, nama_penuh, no_ic, no_telefon, jantina, jenis_pengadil, alamat1, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, umur, aktif, password_changed, tg_link_token, created_at)
SELECT 'abdullahayue01@gmail.com', '$2b$10$n.HNoBzUxLxNOlz46DBdUuWfuKRoZdrWrTzPGloVU6O.gizJ2wKUi', 'Pengadil', 7, 7, 'MOHD FAISAL KAMIL BIN MOHD ADNAN', '090417060669', '01114275710', 'LELAKI', 'Kelas III FAM', '119 FELDA SERI DAHLIA JENGKA 3,26400 BANDAR JENGKA PAHANG', 'Maran', 'Pahang', 'PELAJAR', 'PELAJAR', 'GURU BESAR', '-', 'MOHD ADNAN BIN AB GHANI', 'BAPA', '0179842955', 16, 1, 0, '32d7bb342197f9e15bff08a0e427ca08', NOW()
WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE no_ic = @ic OR email = @em);
INSERT INTO `permohonan` (user_id, district_id, persatuan_id, tahun_permohonan, jenis_permohonan, jenis_borang, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, persatuan_daerah, alamat1, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, url_resit, status, status_workflow, mohon_ujian_bertulis, payment_amount, umur, declare1, declare2, declare3, tarikh_hantar)
SELECT u.id, 7, 7, 2026, 'kelas3_fam', 'kelas3_fam', 'MOHD FAISAL KAMIL BIN MOHD ADNAN', '090417060669', 'abdullahayue01@gmail.com', '01114275710', 'LELAKI', 'Kelas III FAM', 'Persatuan Bolasepak Daerah Maran', '119 FELDA SERI DAHLIA JENGKA 3,26400 BANDAR JENGKA PAHANG', 'Maran', 'Pahang', 'PELAJAR', 'PELAJAR', 'GURU BESAR', '-', 'MOHD ADNAN BIN AB GHANI', 'BAPA', '0179842955', 'https://drive.google.com/open?id=1JTi63speNR6N8egWmTif3DcELoFb8J1I', 'Pending', 'Menunggu Admin', 1, 80.00, 16, 1, 1, 1, NOW()
FROM `users` u WHERE u.no_ic = @ic
AND NOT EXISTS (SELECT 1 FROM `permohonan` WHERE no_kp = @ic AND tahun_permohonan = 2026 AND jenis_borang = 'kelas3_fam');

-- [4] MOHAMAD NAZMI FIRDAUS BIN HASSAN (Bera)
SET @ic = '921201065561';
SET @em = 'mnazmifirdaus@gmail.com';
INSERT INTO `users` (email, password, role, district_id, persatuan_id, nama_penuh, no_ic, no_telefon, jantina, jenis_pengadil, alamat1, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, umur, aktif, password_changed, tg_link_token, created_at)
SELECT 'mnazmifirdaus@gmail.com', '$2b$10$7/XRvUDxwk62qoM8r.3opumWMFVXrmnwhrFj8.bW4ZFl5lldXZ7b6', 'Pengadil', 2, 2, 'MOHAMAD NAZMI FIRDAUS BIN HASSAN', '921201065561', '0132402515', 'LELAKI', 'Kelas III FAM', 'L4 felda kg awah, 28030 Temerloh, Pahang', 'Bera', 'Pahang', 'BEKERJA', 'JURUTEKNIK', 'PEGAWAI DAERAH BERA', 'PEJABAT DAERAH DAN TANAH BERA, 28200 BANDAR BERA, PAHANG DARUL MAKMUR', 'KHAIRUNISA LIYANA BINTI SAMSUDIN', 'ISTERI', '0179562087', 34, 1, 0, '56d9e2fe1c15a8cae065b8d35b98cb33', NOW()
WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE no_ic = @ic OR email = @em);
INSERT INTO `permohonan` (user_id, district_id, persatuan_id, tahun_permohonan, jenis_permohonan, jenis_borang, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, persatuan_daerah, alamat1, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, url_resit, status, status_workflow, mohon_ujian_bertulis, payment_amount, umur, declare1, declare2, declare3, tarikh_hantar)
SELECT u.id, 2, 2, 2026, 'kelas3_fam', 'kelas3_fam', 'MOHAMAD NAZMI FIRDAUS BIN HASSAN', '921201065561', 'mnazmifirdaus@gmail.com', '0132402515', 'LELAKI', 'Kelas III FAM', 'Persatuan Bolasepak Daerah Bera', 'L4 felda kg awah, 28030 Temerloh, Pahang', 'Bera', 'Pahang', 'BEKERJA', 'JURUTEKNIK', 'PEGAWAI DAERAH BERA', 'PEJABAT DAERAH DAN TANAH BERA, 28200 BANDAR BERA, PAHANG DARUL MAKMUR', 'KHAIRUNISA LIYANA BINTI SAMSUDIN', 'ISTERI', '0179562087', 'https://drive.google.com/open?id=1FLETBXGSt2genwq1UrFVYUCxN5VzWAdr', 'Pending', 'Menunggu Admin', 1, 80.00, 34, 1, 1, 1, NOW()
FROM `users` u WHERE u.no_ic = @ic
AND NOT EXISTS (SELECT 1 FROM `permohonan` WHERE no_kp = @ic AND tahun_permohonan = 2026 AND jenis_borang = 'kelas3_fam');

-- [5] NUR HAFIZAN BIN MOHAMMAD NOR (Kuantan)
SET @ic = '950815065091';
SET @em = 'pijang95@gmail.com';
INSERT INTO `users` (email, password, role, district_id, persatuan_id, nama_penuh, no_ic, no_telefon, jantina, jenis_pengadil, alamat1, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, umur, aktif, password_changed, tg_link_token, created_at)
SELECT 'pijang95@gmail.com', '$2b$10$ZryLioEFTknQpHihWVprPeRga.rWGfB5XkSPxTSIIMGshABNfVg9y', 'Pengadil', 5, 5, 'NUR HAFIZAN BIN MOHAMMAD NOR', '950815065091', '0139621423', 'LELAKI', 'Kelas III FAM', 'NO 111, LORONG LENGKOK KANAN 5, TANAH PUTIH BARU 25150, KUANTAN PAHANG', 'Kuantan', 'Pahang', 'BEKERJA', 'PEMBANTU KHIDMAT AM', 'PENGARAH', 'MAJLIS BANDARAYA KUANTAN, JALAN TANAH PUTIH 25100, KUANTAN PAHANG', 'MOHAMMAD NOR BIN MUSTAPHA', 'Bapa', '0169322448', 31, 1, 0, 'c620021d75eae151bd109517bf956056', NOW()
WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE no_ic = @ic OR email = @em);
INSERT INTO `permohonan` (user_id, district_id, persatuan_id, tahun_permohonan, jenis_permohonan, jenis_borang, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, persatuan_daerah, alamat1, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, url_resit, status, status_workflow, mohon_ujian_bertulis, payment_amount, umur, declare1, declare2, declare3, tarikh_hantar)
SELECT u.id, 5, 5, 2026, 'kelas3_fam', 'kelas3_fam', 'NUR HAFIZAN BIN MOHAMMAD NOR', '950815065091', 'pijang95@gmail.com', '0139621423', 'LELAKI', 'Kelas III FAM', 'Persatuan Bolasepak Daerah Kuantan', 'NO 111, LORONG LENGKOK KANAN 5, TANAH PUTIH BARU 25150, KUANTAN PAHANG', 'Kuantan', 'Pahang', 'BEKERJA', 'PEMBANTU KHIDMAT AM', 'PENGARAH', 'MAJLIS BANDARAYA KUANTAN, JALAN TANAH PUTIH 25100, KUANTAN PAHANG', 'MOHAMMAD NOR BIN MUSTAPHA', 'Bapa', '0169322448', 'https://drive.google.com/open?id=1RDj6-ACfidk1Ae2JBgpJ2reyeVO4u8qr', 'Pending', 'Menunggu Admin', 1, 80.00, 31, 1, 1, 1, NOW()
FROM `users` u WHERE u.no_ic = @ic
AND NOT EXISTS (SELECT 1 FROM `permohonan` WHERE no_kp = @ic AND tahun_permohonan = 2026 AND jenis_borang = 'kelas3_fam');

-- [6] MOHAMAD FAIZ BIN MAT RIFIN (Kuantan)
SET @ic = '930318035053';
SET @em = 'fareast18393@gmail.com';
INSERT INTO `users` (email, password, role, district_id, persatuan_id, nama_penuh, no_ic, no_telefon, jantina, jenis_pengadil, alamat1, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, umur, aktif, password_changed, tg_link_token, created_at)
SELECT 'fareast18393@gmail.com', '$2b$10$HMFMuyfRkbgQtLPBL9OEsuj6GwMkeqpV.t0ylPP7Ta52g3fNrVpFK', 'Pengadil', 5, 5, 'MOHAMAD FAIZ BIN MAT RIFIN', '930318035053', '01121333453', 'LELAKI', 'Kelas III FAM', 'G8-4-4 KUARTERS TENTERA KEM BATU 10,JALAN SG PANCHING 26010 KUANTAN PAHANG', 'Kuantan', 'Pahang', 'BEKERJA', 'TENTERA', 'MEJ BAMBANG ADI SUMANTRI BIN BOMBANG SUKOCHO', 'KOMPENI BANTUAN 12 RAMD(MEK) KEM BATU 10 25990 KUANTAN PAHANG', 'NUR FASLIANA BINTI OTHMAN', 'ISTERI', '0172428027', 33, 1, 0, 'a1bb407881fc42d3417510cd39b687f7', NOW()
WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE no_ic = @ic OR email = @em);
INSERT INTO `permohonan` (user_id, district_id, persatuan_id, tahun_permohonan, jenis_permohonan, jenis_borang, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, persatuan_daerah, alamat1, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, url_resit, status, status_workflow, mohon_ujian_bertulis, payment_amount, umur, declare1, declare2, declare3, tarikh_hantar)
SELECT u.id, 5, 5, 2026, 'kelas3_fam', 'kelas3_fam', 'MOHAMAD FAIZ BIN MAT RIFIN', '930318035053', 'fareast18393@gmail.com', '01121333453', 'LELAKI', 'Kelas III FAM', 'Persatuan Bolasepak Daerah Kuantan', 'G8-4-4 KUARTERS TENTERA KEM BATU 10,JALAN SG PANCHING 26010 KUANTAN PAHANG', 'Kuantan', 'Pahang', 'BEKERJA', 'TENTERA', 'MEJ BAMBANG ADI SUMANTRI BIN BOMBANG SUKOCHO', 'KOMPENI BANTUAN 12 RAMD(MEK) KEM BATU 10 25990 KUANTAN PAHANG', 'NUR FASLIANA BINTI OTHMAN', 'ISTERI', '0172428027', 'https://drive.google.com/open?id=1RF01rBvpeYEJv6Af7YVwjyN7M667pzsL', 'Pending', 'Menunggu Admin', 1, 80.00, 33, 1, 1, 1, NOW()
FROM `users` u WHERE u.no_ic = @ic
AND NOT EXISTS (SELECT 1 FROM `permohonan` WHERE no_kp = @ic AND tahun_permohonan = 2026 AND jenis_borang = 'kelas3_fam');

-- [7] MUHAMMAD ALIFF IKRAM BIN MUHAMAD (Kuantan)
SET @ic = '990203065505';
SET @em = 'aliffikram26@gmail.com';
INSERT INTO `users` (email, password, role, district_id, persatuan_id, nama_penuh, no_ic, no_telefon, jantina, jenis_pengadil, alamat1, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, umur, aktif, password_changed, tg_link_token, created_at)
SELECT 'aliffikram26@gmail.com', '$2b$10$MpEzDiPloWaof7wiR/v4ROMXgjaWmih.mOvsnO6mnfjfzbNcVLowW', 'Pengadil', 5, 5, 'MUHAMMAD ALIFF IKRAM BIN MUHAMAD', '990203065505', '0107680339', 'LELAKI', 'Kelas III FAM', 'NO 13 LORONG BUKIT SETONGKOL MAJU 47 25200 KUANTAN PAHANG', 'Kuantan', 'Pahang', 'BEKERJA', 'MEKANIK', 'Azizul', 'KOMPLEK LKIM KUANTAN, JALAN SRI KEMUNTING 2 , 25100 KUANTAN PAHANG', 'zulkhairey', 'Abang', '0189424229', 27, 1, 0, '9b04bf8fd669cc6ddc66176aa7c2597d', NOW()
WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE no_ic = @ic OR email = @em);
INSERT INTO `permohonan` (user_id, district_id, persatuan_id, tahun_permohonan, jenis_permohonan, jenis_borang, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, persatuan_daerah, alamat1, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, url_resit, status, status_workflow, mohon_ujian_bertulis, payment_amount, umur, declare1, declare2, declare3, tarikh_hantar)
SELECT u.id, 5, 5, 2026, 'kelas3_fam', 'kelas3_fam', 'MUHAMMAD ALIFF IKRAM BIN MUHAMAD', '990203065505', 'aliffikram26@gmail.com', '0107680339', 'LELAKI', 'Kelas III FAM', 'Persatuan Bolasepak Daerah Kuantan', 'NO 13 LORONG BUKIT SETONGKOL MAJU 47 25200 KUANTAN PAHANG', 'Kuantan', 'Pahang', 'BEKERJA', 'MEKANIK', 'Azizul', 'KOMPLEK LKIM KUANTAN, JALAN SRI KEMUNTING 2 , 25100 KUANTAN PAHANG', 'zulkhairey', 'Abang', '0189424229', 'https://drive.google.com/open?id=1JPHSDSkXGnD_d7tujNlIS2KSUnVnwPXF', 'Pending', 'Menunggu Admin', 1, 80.00, 27, 1, 1, 1, NOW()
FROM `users` u WHERE u.no_ic = @ic
AND NOT EXISTS (SELECT 1 FROM `permohonan` WHERE no_kp = @ic AND tahun_permohonan = 2026 AND jenis_borang = 'kelas3_fam');

-- [8] AMIR ASRAF BIN MAZUKI (Bera)
SET @ic = '930815065173.0';
SET @em = 'amir.acap.93@gmail.com';
INSERT INTO `users` (email, password, role, district_id, persatuan_id, nama_penuh, no_ic, no_telefon, jantina, jenis_pengadil, alamat1, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, umur, aktif, password_changed, tg_link_token, created_at)
SELECT 'amir.acap.93@gmail.com', '$2b$10$DEnagcZ2VvKQTRMRMejV.ukKufMoO23hDAp2WSQklIFGmgiw/JOxW', 'Pengadil', 2, 2, 'AMIR ASRAF BIN MAZUKI', '930815065173.0', '0179188651', 'LELAKI', 'Kelas III FAM', 'NO 1 JALAN JERNA INDAH 3 TAMAN JERNA INDAH 28200 BERA PAHANG', 'Bera', 'Pahang', 'BEKERJA', 'TEKNIKAL INSPECTOR', 'ROADCARE SDN BHD', '14, Jalan Sudirman 5, 14, Jalan sudirman 5, Bandar Sri Semantan, 28000 Temerloh, Pahang', 'NADHIRAH HUSNA BT MOHD SHAARI', 'ISTERI', '0199712803', 33, 1, 0, '5151ae0aab265eb99219c52bb08f9b9c', NOW()
WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE no_ic = @ic OR email = @em);
INSERT INTO `permohonan` (user_id, district_id, persatuan_id, tahun_permohonan, jenis_permohonan, jenis_borang, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, persatuan_daerah, alamat1, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, url_resit, status, status_workflow, mohon_ujian_bertulis, payment_amount, umur, declare1, declare2, declare3, tarikh_hantar)
SELECT u.id, 2, 2, 2026, 'kelas3_fam', 'kelas3_fam', 'AMIR ASRAF BIN MAZUKI', '930815065173.0', 'amir.acap.93@gmail.com', '0179188651', 'LELAKI', 'Kelas III FAM', 'Persatuan Bolasepak Daerah Bera', 'NO 1 JALAN JERNA INDAH 3 TAMAN JERNA INDAH 28200 BERA PAHANG', 'Bera', 'Pahang', 'BEKERJA', 'TEKNIKAL INSPECTOR', 'ROADCARE SDN BHD', '14, Jalan Sudirman 5, 14, Jalan sudirman 5, Bandar Sri Semantan, 28000 Temerloh, Pahang', 'NADHIRAH HUSNA BT MOHD SHAARI', 'ISTERI', '0199712803', 'https://drive.google.com/open?id=1LcdbbGrg-svU5yhI2wch6fGr5HmJW78O', 'Pending', 'Menunggu Admin', 1, 80.00, 33, 1, 1, 1, NOW()
FROM `users` u WHERE u.no_ic = @ic
AND NOT EXISTS (SELECT 1 FROM `permohonan` WHERE no_kp = @ic AND tahun_permohonan = 2026 AND jenis_borang = 'kelas3_fam');

-- [9] MUHAMMAD AKMAL BIN ZAILAN (Bera)
SET @ic = '021114030631';
SET @em = 'akmalzailan151@gmail.com';
INSERT INTO `users` (email, password, role, district_id, persatuan_id, nama_penuh, no_ic, no_telefon, jantina, jenis_pengadil, alamat1, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, umur, aktif, password_changed, tg_link_token, created_at)
SELECT 'akmalzailan151@gmail.com', '$2b$10$9lPHGypzO4F2BsGCdFM9BuzfF38As.vwuZqlBGzO4LmMwunYi/i5C', 'Pengadil', 2, 2, 'MUHAMMAD AKMAL BIN ZAILAN', '021114030631', '01136537980', 'LELAKI', 'Kelas III FAM', 'NO 10 JALAN JATI 5 TAMAN JATI BERA PAHANG', 'Bera', 'Pahang', 'BEKERJA', 'GURU', 'GURU BESAR', 'SK KERAYONG BERA 28200 PAHANG', 'ZAILAN BIN MOHAMAD', 'BAPA', '0129006740', 24, 1, 0, 'a47abf03d9f1d6f086a99aaa7bd81595', NOW()
WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE no_ic = @ic OR email = @em);
INSERT INTO `permohonan` (user_id, district_id, persatuan_id, tahun_permohonan, jenis_permohonan, jenis_borang, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, persatuan_daerah, alamat1, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, url_resit, status, status_workflow, mohon_ujian_bertulis, payment_amount, umur, declare1, declare2, declare3, tarikh_hantar)
SELECT u.id, 2, 2, 2026, 'kelas3_fam', 'kelas3_fam', 'MUHAMMAD AKMAL BIN ZAILAN', '021114030631', 'akmalzailan151@gmail.com', '01136537980', 'LELAKI', 'Kelas III FAM', 'Persatuan Bolasepak Daerah Bera', 'NO 10 JALAN JATI 5 TAMAN JATI BERA PAHANG', 'Bera', 'Pahang', 'BEKERJA', 'GURU', 'GURU BESAR', 'SK KERAYONG BERA 28200 PAHANG', 'ZAILAN BIN MOHAMAD', 'BAPA', '0129006740', 'https://drive.google.com/open?id=1waUIVn0OfkCH0z5CYVJQA8lGCC95h3KV', 'Pending', 'Menunggu Admin', 1, 80.00, 24, 1, 1, 1, NOW()
FROM `users` u WHERE u.no_ic = @ic
AND NOT EXISTS (SELECT 1 FROM `permohonan` WHERE no_kp = @ic AND tahun_permohonan = 2026 AND jenis_borang = 'kelas3_fam');

-- [10] NOR HAFIZ AKMAL BIN RAZAK (Kuantan)
SET @ic = '930518065855.0';
SET @em = 'hafiz5855@gmail.com';
INSERT INTO `users` (email, password, role, district_id, persatuan_id, nama_penuh, no_ic, no_telefon, jantina, jenis_pengadil, alamat1, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, umur, aktif, password_changed, tg_link_token, created_at)
SELECT 'hafiz5855@gmail.com', '$2b$10$9sRcFPmUcq/xncu2pkTpfOrcqPXBTqNuAzKl5VrPGJa.g/SUVhANu', 'Pengadil', 5, 5, 'NOR HAFIZ AKMAL BIN RAZAK', '930518065855.0', '0196453694', 'LELAKI', 'Kelas III FAM', 'No 16 Lorong 19 Taman Seri Mahkota Aman 26070 Kuantan Pahang', 'Kuantan', 'Pahang', 'BEKERJA', 'Guru', 'EN SAFRUL KAMALIZAM BIN SAFAR', 'SK SUNGAI ISAP MURNI', 'NOR SYAHIRAH BINTI NORDIN', 'ISTERI', '01111993068', 33, 1, 0, '3e1c4891f665864676d3232beaef1bcd', NOW()
WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE no_ic = @ic OR email = @em);
INSERT INTO `permohonan` (user_id, district_id, persatuan_id, tahun_permohonan, jenis_permohonan, jenis_borang, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, persatuan_daerah, alamat1, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, url_resit, status, status_workflow, mohon_ujian_bertulis, payment_amount, umur, declare1, declare2, declare3, tarikh_hantar)
SELECT u.id, 5, 5, 2026, 'kelas3_fam', 'kelas3_fam', 'NOR HAFIZ AKMAL BIN RAZAK', '930518065855.0', 'hafiz5855@gmail.com', '0196453694', 'LELAKI', 'Kelas III FAM', 'Persatuan Bolasepak Daerah Kuantan', 'No 16 Lorong 19 Taman Seri Mahkota Aman 26070 Kuantan Pahang', 'Kuantan', 'Pahang', 'BEKERJA', 'Guru', 'EN SAFRUL KAMALIZAM BIN SAFAR', 'SK SUNGAI ISAP MURNI', 'NOR SYAHIRAH BINTI NORDIN', 'ISTERI', '01111993068', 'https://drive.google.com/open?id=14do1zFR0iCq0tOSC2aIe_f03yyoWvnPR', 'Pending', 'Menunggu Admin', 1, 80.00, 33, 1, 1, 1, NOW()
FROM `users` u WHERE u.no_ic = @ic
AND NOT EXISTS (SELECT 1 FROM `permohonan` WHERE no_kp = @ic AND tahun_permohonan = 2026 AND jenis_borang = 'kelas3_fam');

-- [11] MOHD AMIRUL ADLI BIN AHMAD ZAKI (Kuantan)
SET @ic = '940902035289';
SET @em = 'amiruladli29@gmail.com';
INSERT INTO `users` (email, password, role, district_id, persatuan_id, nama_penuh, no_ic, no_telefon, jantina, jenis_pengadil, alamat1, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, umur, aktif, password_changed, tg_link_token, created_at)
SELECT 'amiruladli29@gmail.com', '$2b$10$.MKdHmwsxRBm0/xa5KOrw.gqD4PjFowSxQvwYeFCpfuOUdgFWsQgu', 'Pengadil', 5, 5, 'MOHD AMIRUL ADLI BIN AHMAD ZAKI', '940902035289', '0145168159', 'LELAKI', 'Kelas III FAM', 'NO20 LORONG 9 TAMAN SERI DAMAI SEJAHTERA 25150 KUANTAN PAHANG', 'Kuantan', 'Pahang', 'BEKERJA', 'GURU', 'PENGETUA', 'SMK PAYA BESAR KM 7 JALAN GAMBANG 25150 KUANTAN PAHANG', 'NASIBAH BINTI HASSAN', 'ISTERI', '0129836367', 32, 1, 0, '8416ff5b0e8dbc44033b1c66a63d87f3', NOW()
WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE no_ic = @ic OR email = @em);
INSERT INTO `permohonan` (user_id, district_id, persatuan_id, tahun_permohonan, jenis_permohonan, jenis_borang, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, persatuan_daerah, alamat1, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, url_resit, status, status_workflow, mohon_ujian_bertulis, payment_amount, umur, declare1, declare2, declare3, tarikh_hantar)
SELECT u.id, 5, 5, 2026, 'kelas3_fam', 'kelas3_fam', 'MOHD AMIRUL ADLI BIN AHMAD ZAKI', '940902035289', 'amiruladli29@gmail.com', '0145168159', 'LELAKI', 'Kelas III FAM', 'Persatuan Bolasepak Daerah Kuantan', 'NO20 LORONG 9 TAMAN SERI DAMAI SEJAHTERA 25150 KUANTAN PAHANG', 'Kuantan', 'Pahang', 'BEKERJA', 'GURU', 'PENGETUA', 'SMK PAYA BESAR KM 7 JALAN GAMBANG 25150 KUANTAN PAHANG', 'NASIBAH BINTI HASSAN', 'ISTERI', '0129836367', 'https://drive.google.com/open?id=1uk8Fdjj38FvV8ZsaDRlEz3Z0RIIMKdLl', 'Pending', 'Menunggu Admin', 1, 80.00, 32, 1, 1, 1, NOW()
FROM `users` u WHERE u.no_ic = @ic
AND NOT EXISTS (SELECT 1 FROM `permohonan` WHERE no_kp = @ic AND tahun_permohonan = 2026 AND jenis_borang = 'kelas3_fam');

-- [12] ALIFF HARIZ BIN AMRAN (Lipis)
SET @ic = '090102060541';
SET @em = 'entahlarh954@gmail.com';
INSERT INTO `users` (email, password, role, district_id, persatuan_id, nama_penuh, no_ic, no_telefon, jantina, jenis_pengadil, alamat1, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, umur, aktif, password_changed, tg_link_token, created_at)
SELECT 'entahlarh954@gmail.com', '$2b$10$uVqsqWba70RtJ9HRjf9S7OlHEOcArRrtWm.X8.eWYi2OMHrYveYD.', 'Pengadil', 6, 6, 'ALIFF HARIZ BIN AMRAN', '090102060541', '01125428399', 'LELAKI', 'Kelas III FAM', 'no62 lorong bbkl 2/4/2 bandar baru kuala lipis pahang 27200', 'Lipis', 'Pahang', 'PELAJAR', 'PELAJAR', 'pelajar', 'SML CLIFFORD', 'AMRAN BIN MOHAMED YUNOS', 'BAPA', '0129811072', 17, 1, 0, '226897c312b0a89a604f64e4d8cb48f1', NOW()
WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE no_ic = @ic OR email = @em);
INSERT INTO `permohonan` (user_id, district_id, persatuan_id, tahun_permohonan, jenis_permohonan, jenis_borang, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, persatuan_daerah, alamat1, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, url_resit, status, status_workflow, mohon_ujian_bertulis, payment_amount, umur, declare1, declare2, declare3, tarikh_hantar)
SELECT u.id, 6, 6, 2026, 'kelas3_fam', 'kelas3_fam', 'ALIFF HARIZ BIN AMRAN', '090102060541', 'entahlarh954@gmail.com', '01125428399', 'LELAKI', 'Kelas III FAM', 'Persatuan Bolasepak Daerah Lipis', 'no62 lorong bbkl 2/4/2 bandar baru kuala lipis pahang 27200', 'Lipis', 'Pahang', 'PELAJAR', 'PELAJAR', 'pelajar', 'SML CLIFFORD', 'AMRAN BIN MOHAMED YUNOS', 'BAPA', '0129811072', 'https://drive.google.com/open?id=1tyZELxRT8k53Q2J9UEZeAMO84ZteqLgK', 'Pending', 'Menunggu Admin', 1, 80.00, 17, 1, 1, 1, NOW()
FROM `users` u WHERE u.no_ic = @ic
AND NOT EXISTS (SELECT 1 FROM `permohonan` WHERE no_kp = @ic AND tahun_permohonan = 2026 AND jenis_borang = 'kelas3_fam');

-- [13] MOHD AZIZI BIN KAMARUDIN (Kuantan)
SET @ic = '950510115537.0';
SET @em = 'haidilarezz@gmail.com';
INSERT INTO `users` (email, password, role, district_id, persatuan_id, nama_penuh, no_ic, no_telefon, jantina, jenis_pengadil, alamat1, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, umur, aktif, password_changed, tg_link_token, created_at)
SELECT 'haidilarezz@gmail.com', '$2b$10$2Yui6UC79yrkxTWFmm5rNeJ17dLP3gQPUBEfYjE4VUsQQIadKhvzO', 'Pengadil', 5, 5, 'MOHD AZIZI BIN KAMARUDIN', '950510115537.0', '0149176641', 'LELAKI', 'Kelas III FAM', 'NO 50 LORONG BALUK BARU 1/5, PERUMAHAN BALUK BARU 26100 KUANTAN PAHANG', 'Kuantan', 'Pahang', 'BEKERJA', 'GENERAL PURPOSE', 'TM GLOBAL', 'PELABUHAN KUANTAN', 'SITI HASNA HUSNA BIN AZMAN', 'ISTERI', '01121834951', 31, 1, 0, '388af17485b27e8a0099de9345f65ee5', NOW()
WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE no_ic = @ic OR email = @em);
INSERT INTO `permohonan` (user_id, district_id, persatuan_id, tahun_permohonan, jenis_permohonan, jenis_borang, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, persatuan_daerah, alamat1, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, url_resit, status, status_workflow, mohon_ujian_bertulis, payment_amount, umur, declare1, declare2, declare3, tarikh_hantar)
SELECT u.id, 5, 5, 2026, 'kelas3_fam', 'kelas3_fam', 'MOHD AZIZI BIN KAMARUDIN', '950510115537.0', 'haidilarezz@gmail.com', '0149176641', 'LELAKI', 'Kelas III FAM', 'Persatuan Bolasepak Daerah Kuantan', 'NO 50 LORONG BALUK BARU 1/5, PERUMAHAN BALUK BARU 26100 KUANTAN PAHANG', 'Kuantan', 'Pahang', 'BEKERJA', 'GENERAL PURPOSE', 'TM GLOBAL', 'PELABUHAN KUANTAN', 'SITI HASNA HUSNA BIN AZMAN', 'ISTERI', '01121834951', 'https://drive.google.com/open?id=1CfYJlYRPXwPgNWbdU8OHSx5NQs1eYlDS', 'Pending', 'Menunggu Admin', 1, 80.00, 31, 1, 1, 1, NOW()
FROM `users` u WHERE u.no_ic = @ic
AND NOT EXISTS (SELECT 1 FROM `permohonan` WHERE no_kp = @ic AND tahun_permohonan = 2026 AND jenis_borang = 'kelas3_fam');

-- [14] RIDUAN BIN AWANG (Muadzam Shah)
SET @ic = '820729105725.0';
SET @em = 'riduankatak123@gmail.com';
INSERT INTO `users` (email, password, role, district_id, persatuan_id, nama_penuh, no_ic, no_telefon, jantina, jenis_pengadil, alamat1, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, umur, aktif, password_changed, tg_link_token, created_at)
SELECT 'riduankatak123@gmail.com', '$2b$10$zbq.ld.7DReSLpeiano4EerNl9OJudupxt5frmPsqbL.8GL2Z9vhy', 'Pengadil', 12, 12, 'RIDUAN BIN AWANG', '820729105725.0', '0196321982', 'LELAKI', 'Kelas III FAM', 'U57 RPS Bukit serok 26900 Bandar tun Abdul Razak Pahang', 'Muadzam Shah', 'Pahang', 'Sendiri', 'Sediri', 'Sendiri', 'Tiada', 'Aslin BT apas', 'Isteri', '0135258414', 44, 1, 0, '158661afff95dc60872ad8b5658f9660', NOW()
WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE no_ic = @ic OR email = @em);
INSERT INTO `permohonan` (user_id, district_id, persatuan_id, tahun_permohonan, jenis_permohonan, jenis_borang, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, persatuan_daerah, alamat1, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, url_resit, status, status_workflow, mohon_ujian_bertulis, payment_amount, umur, declare1, declare2, declare3, tarikh_hantar)
SELECT u.id, 12, 12, 2026, 'kelas3_fam', 'kelas3_fam', 'RIDUAN BIN AWANG', '820729105725.0', 'riduankatak123@gmail.com', '0196321982', 'LELAKI', 'Kelas III FAM', 'Persatuan Bolasepak Daerah Muadzam Shah', 'U57 RPS Bukit serok 26900 Bandar tun Abdul Razak Pahang', 'Muadzam Shah', 'Pahang', 'Sendiri', 'Sediri', 'Sendiri', 'Tiada', 'Aslin BT apas', 'Isteri', '0135258414', 'https://drive.google.com/open?id=15__xbWGHG1RKuG-rauolBEZqZrNNIfZH', 'Pending', 'Menunggu Admin', 1, 80.00, 44, 1, 1, 1, NOW()
FROM `users` u WHERE u.no_ic = @ic
AND NOT EXISTS (SELECT 1 FROM `permohonan` WHERE no_kp = @ic AND tahun_permohonan = 2026 AND jenis_borang = 'kelas3_fam');

-- [15] MUHAMMAD ADLI B. SAMSUDIN (Maran)
SET @ic = '010914060499';
SET @em = 'adli.samsudin06@gmail.com';
INSERT INTO `users` (email, password, role, district_id, persatuan_id, nama_penuh, no_ic, no_telefon, jantina, jenis_pengadil, alamat1, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, umur, aktif, password_changed, tg_link_token, created_at)
SELECT 'adli.samsudin06@gmail.com', '$2b$10$4ePSIsmhXfxzl3bo/gD1W.bcVNKOSQ.9xgmx9i7gstIYy5Zo//48a', 'Pengadil', 7, 7, 'MUHAMMAD ADLI B. SAMSUDIN', '010914060499', '01139140375', 'LELAKI', 'Kelas III FAM', 'NO 431, BLOK 17, FELDA JENGKA 20, 26400 BANDAR JENGKA, PAHANG', 'Maran', 'Pahang', 'PELAJAR', '-', '-', '-', 'AHMAD KAMAL B. SAMSUDIN', 'ABANG', '0179575085', 25, 1, 0, 'ab278c9257948f57c34eb9fae3716320', NOW()
WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE no_ic = @ic OR email = @em);
INSERT INTO `permohonan` (user_id, district_id, persatuan_id, tahun_permohonan, jenis_permohonan, jenis_borang, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, persatuan_daerah, alamat1, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, url_resit, status, status_workflow, mohon_ujian_bertulis, payment_amount, umur, declare1, declare2, declare3, tarikh_hantar)
SELECT u.id, 7, 7, 2026, 'kelas3_fam', 'kelas3_fam', 'MUHAMMAD ADLI B. SAMSUDIN', '010914060499', 'adli.samsudin06@gmail.com', '01139140375', 'LELAKI', 'Kelas III FAM', 'Persatuan Bolasepak Daerah Maran', 'NO 431, BLOK 17, FELDA JENGKA 20, 26400 BANDAR JENGKA, PAHANG', 'Maran', 'Pahang', 'PELAJAR', '-', '-', '-', 'AHMAD KAMAL B. SAMSUDIN', 'ABANG', '0179575085', 'https://drive.google.com/open?id=1xP4qmWAU0mhZGzLL-irCslxF-dycRTa9', 'Pending', 'Menunggu Admin', 1, 80.00, 25, 1, 1, 1, NOW()
FROM `users` u WHERE u.no_ic = @ic
AND NOT EXISTS (SELECT 1 FROM `permohonan` WHERE no_kp = @ic AND tahun_permohonan = 2026 AND jenis_borang = 'kelas3_fam');

-- [16] MUHAMMAD RAZARIZAL BIN MOHAMMAD SAFIAN (Pekan)
SET @ic = '970430065865';
SET @em = 'razarizalsafian97@gmail.com';
INSERT INTO `users` (email, password, role, district_id, persatuan_id, nama_penuh, no_ic, no_telefon, jantina, jenis_pengadil, alamat1, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, umur, aktif, password_changed, tg_link_token, created_at)
SELECT 'razarizalsafian97@gmail.com', '$2b$10$iUy9RgXLadfONx7epjjlkOmF49UHiMTWQoodY2Roq0kKaABi.5lbe', 'Pengadil', 8, 8, 'MUHAMMAD RAZARIZAL BIN MOHAMMAD SAFIAN', '970430065865', '0175764239', 'LELAKI', 'Kelas III FAM', 'NO149 LORONG 4/1 TAMAN PERDANA 26600, PEKAN , PAHANG', 'Pekan', 'Pahang', 'BEKERJA', 'JURUTEKNIK', 'CHARGEMAN', 'KUANTAN PAHANG', 'NOR ASYIKIN BINTI AZHAR', 'ISTERI', '0165775413', 29, 1, 0, 'aa98736342da231729416942377c35ce', NOW()
WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE no_ic = @ic OR email = @em);
INSERT INTO `permohonan` (user_id, district_id, persatuan_id, tahun_permohonan, jenis_permohonan, jenis_borang, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, persatuan_daerah, alamat1, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, url_resit, status, status_workflow, mohon_ujian_bertulis, payment_amount, umur, declare1, declare2, declare3, tarikh_hantar)
SELECT u.id, 8, 8, 2026, 'kelas3_fam', 'kelas3_fam', 'MUHAMMAD RAZARIZAL BIN MOHAMMAD SAFIAN', '970430065865', 'razarizalsafian97@gmail.com', '0175764239', 'LELAKI', 'Kelas III FAM', 'Persatuan Bolasepak Daerah Pekan', 'NO149 LORONG 4/1 TAMAN PERDANA 26600, PEKAN , PAHANG', 'Pekan', 'Pahang', 'BEKERJA', 'JURUTEKNIK', 'CHARGEMAN', 'KUANTAN PAHANG', 'NOR ASYIKIN BINTI AZHAR', 'ISTERI', '0165775413', 'https://drive.google.com/open?id=1Iu6w3yDqENFaiqIGZghbV-_rm2EUX8G-', 'Pending', 'Menunggu Admin', 1, 80.00, 29, 1, 1, 1, NOW()
FROM `users` u WHERE u.no_ic = @ic
AND NOT EXISTS (SELECT 1 FROM `permohonan` WHERE no_kp = @ic AND tahun_permohonan = 2026 AND jenis_borang = 'kelas3_fam');

-- [17] TI BIN YOK TAK (Lipis)
SET @ic = '911117065535.0';
SET @em = 'tibinyoktak@gmail.com';
INSERT INTO `users` (email, password, role, district_id, persatuan_id, nama_penuh, no_ic, no_telefon, jantina, jenis_pengadil, alamat1, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, umur, aktif, password_changed, tg_link_token, created_at)
SELECT 'tibinyoktak@gmail.com', '$2b$10$qbf.Nj8VGmLzYEbbzJgDmuCClGQru3ymEgroTAwNvfnkO8wKgMm36', 'Pengadil', 6, 6, 'TI BIN YOK TAK', '911117065535.0', '0149064423', 'LELAKI', 'Kelas III FAM', 'KAMPUNG KUALA TUAL,RPS BETAU,27200,KUALA LIPIS,PAHANG', 'Lipis', 'Pahang', 'BEKERJA', 'Pekerja am', 'ONG WHEE KONG', 'No.107,Perniagaan Kenong,27200,Kuala Lipis,Pahang.', 'ZURINI A/P YOK TAK', 'KAKAK', '0194568370', 35, 1, 0, '8b7375a7d728d160323e81e00d0c627c', NOW()
WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE no_ic = @ic OR email = @em);
INSERT INTO `permohonan` (user_id, district_id, persatuan_id, tahun_permohonan, jenis_permohonan, jenis_borang, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, persatuan_daerah, alamat1, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, url_resit, status, status_workflow, mohon_ujian_bertulis, payment_amount, umur, declare1, declare2, declare3, tarikh_hantar)
SELECT u.id, 6, 6, 2026, 'kelas3_fam', 'kelas3_fam', 'TI BIN YOK TAK', '911117065535.0', 'tibinyoktak@gmail.com', '0149064423', 'LELAKI', 'Kelas III FAM', 'Persatuan Bolasepak Daerah Lipis', 'KAMPUNG KUALA TUAL,RPS BETAU,27200,KUALA LIPIS,PAHANG', 'Lipis', 'Pahang', 'BEKERJA', 'Pekerja am', 'ONG WHEE KONG', 'No.107,Perniagaan Kenong,27200,Kuala Lipis,Pahang.', 'ZURINI A/P YOK TAK', 'KAKAK', '0194568370', 'https://drive.google.com/open?id=1QPu_3QjcKf9SuPRaxwAHcFqtzNuqmteR', 'Pending', 'Menunggu Admin', 1, 80.00, 35, 1, 1, 1, NOW()
FROM `users` u WHERE u.no_ic = @ic
AND NOT EXISTS (SELECT 1 FROM `permohonan` WHERE no_kp = @ic AND tahun_permohonan = 2026 AND jenis_borang = 'kelas3_fam');

-- [18] SYED ABDUL YUSUF BIN SYED JALILUDDIN (Maran)
SET @ic = '090422060153';
SET @em = 'izzatiezamzuri2@gmail.com';
INSERT INTO `users` (email, password, role, district_id, persatuan_id, nama_penuh, no_ic, no_telefon, jantina, jenis_pengadil, alamat1, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, umur, aktif, password_changed, tg_link_token, created_at)
SELECT 'izzatiezamzuri2@gmail.com', '$2b$10$wwBautoAZtQf9PKqRaqN5OZ6mnBmNOtviA4VwQNCKwYAd1wCBR71K', 'Pengadil', 7, 7, 'SYED ABDUL YUSUF BIN SYED JALILUDDIN', '090422060153', '01133195636', 'LELAKI', 'Kelas III FAM', 'NO 115 BLOK 6 ,FELDA JENGKA 13,26420 BANDAR PUSAT PAHANG', 'Maran', 'Pahang', 'PELAJAR', 'PELAJAR', 'PELAJAR', 'SMK JENGKA 12', 'SHARIFAH NORLAILA BINTI SYED MAHMUD', 'IBU', '01133195636', 17, 1, 0, '307c5728c76c2bca1347a67b87227c0b', NOW()
WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE no_ic = @ic OR email = @em);
INSERT INTO `permohonan` (user_id, district_id, persatuan_id, tahun_permohonan, jenis_permohonan, jenis_borang, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, persatuan_daerah, alamat1, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, url_resit, status, status_workflow, mohon_ujian_bertulis, payment_amount, umur, declare1, declare2, declare3, tarikh_hantar)
SELECT u.id, 7, 7, 2026, 'kelas3_fam', 'kelas3_fam', 'SYED ABDUL YUSUF BIN SYED JALILUDDIN', '090422060153', 'izzatiezamzuri2@gmail.com', '01133195636', 'LELAKI', 'Kelas III FAM', 'Persatuan Bolasepak Daerah Maran', 'NO 115 BLOK 6 ,FELDA JENGKA 13,26420 BANDAR PUSAT PAHANG', 'Maran', 'Pahang', 'PELAJAR', 'PELAJAR', 'PELAJAR', 'SMK JENGKA 12', 'SHARIFAH NORLAILA BINTI SYED MAHMUD', 'IBU', '01133195636', 'https://drive.google.com/open?id=1ExPk3-PizqY4MxT4x_I931K4FXPu5gAe', 'Pending', 'Menunggu Admin', 1, 80.00, 17, 1, 1, 1, NOW()
FROM `users` u WHERE u.no_ic = @ic
AND NOT EXISTS (SELECT 1 FROM `permohonan` WHERE no_kp = @ic AND tahun_permohonan = 2026 AND jenis_borang = 'kelas3_fam');

-- [19] MUHAMMAD HAFIZI BIN MOHD SALLEH (Bentong)
SET @ic = '980217145929.0';
SET @em = 'hafiziesalleh98@gmail.com';
INSERT INTO `users` (email, password, role, district_id, persatuan_id, nama_penuh, no_ic, no_telefon, jantina, jenis_pengadil, alamat1, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, umur, aktif, password_changed, tg_link_token, created_at)
SELECT 'hafiziesalleh98@gmail.com', '$2b$10$LO3WVz.mpMUuF7IHKBjbWO1VqRPahPLu/A4cujwq.LmjYMmziIfEq', 'Pengadil', 1, 1, 'MUHAMMAD HAFIZI BIN MOHD SALLEH', '980217145929.0', '0182358110', 'LELAKI', 'Kelas III FAM', 'No. 203 Jalan Harmoni 8, Taman Harmoni 28700 Bentong Pahang', 'Bentong', 'Pahang', 'BEKERJA', 'GURU', 'GURU BESAR', 'SK SULAIMAN, BENTONG pahang', 'NORLISA SYUAIBAH BINTI SANIT', 'ISTERI', '0189540650', 28, 1, 0, '01bbfdc2fcd11fbd157349c923e393c8', NOW()
WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE no_ic = @ic OR email = @em);
INSERT INTO `permohonan` (user_id, district_id, persatuan_id, tahun_permohonan, jenis_permohonan, jenis_borang, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, persatuan_daerah, alamat1, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, url_resit, status, status_workflow, mohon_ujian_bertulis, payment_amount, umur, declare1, declare2, declare3, tarikh_hantar)
SELECT u.id, 1, 1, 2026, 'kelas3_fam', 'kelas3_fam', 'MUHAMMAD HAFIZI BIN MOHD SALLEH', '980217145929.0', 'hafiziesalleh98@gmail.com', '0182358110', 'LELAKI', 'Kelas III FAM', 'Persatuan Bolasepak Daerah Bentong', 'No. 203 Jalan Harmoni 8, Taman Harmoni 28700 Bentong Pahang', 'Bentong', 'Pahang', 'BEKERJA', 'GURU', 'GURU BESAR', 'SK SULAIMAN, BENTONG pahang', 'NORLISA SYUAIBAH BINTI SANIT', 'ISTERI', '0189540650', 'https://drive.google.com/open?id=1F6WM3jLCQInuoD8jZ4lEGZOnEs2B38_1', 'Pending', 'Menunggu Admin', 1, 80.00, 28, 1, 1, 1, NOW()
FROM `users` u WHERE u.no_ic = @ic
AND NOT EXISTS (SELECT 1 FROM `permohonan` WHERE no_kp = @ic AND tahun_permohonan = 2026 AND jenis_borang = 'kelas3_fam');

-- [20] AHMAD IQBAL RIEZKY BIN AHMAD NOR SHAHID (Temerloh)
SET @ic = '091011060217';
SET @em = 'iriezky602@gmail.com';
INSERT INTO `users` (email, password, role, district_id, persatuan_id, nama_penuh, no_ic, no_telefon, jantina, jenis_pengadil, alamat1, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, umur, aktif, password_changed, tg_link_token, created_at)
SELECT 'iriezky602@gmail.com', '$2b$10$6b8RA48NIje6RtF2seHp1O5ISRBZFrDNZ3DQ6sIXZoUXRNm2W6fTO', 'Pengadil', 11, 11, 'AHMAD IQBAL RIEZKY BIN AHMAD NOR SHAHID', '091011060217', '0198600314', 'LELAKI', 'Kelas III FAM', 'NO 13 JALAN PAYA TARAM 2 TAMAN PAYA TARAM KERDAU 28010 TEMERLOH PAHANG', 'Temerloh', 'Pahang', 'PELAJAR', 'Pelajar Biasa', 'ZURAIDAH BINTI AWALUDDIN', 'SMK KERDAU', 'KASMINAH BINTI SAHARUDIN', 'IBU', '01140376828', 17, 1, 0, 'e850440b6e62517a4a0a5e6acb2c9a31', NOW()
WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE no_ic = @ic OR email = @em);
INSERT INTO `permohonan` (user_id, district_id, persatuan_id, tahun_permohonan, jenis_permohonan, jenis_borang, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, persatuan_daerah, alamat1, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, url_resit, status, status_workflow, mohon_ujian_bertulis, payment_amount, umur, declare1, declare2, declare3, tarikh_hantar)
SELECT u.id, 11, 11, 2026, 'kelas3_fam', 'kelas3_fam', 'AHMAD IQBAL RIEZKY BIN AHMAD NOR SHAHID', '091011060217', 'iriezky602@gmail.com', '0198600314', 'LELAKI', 'Kelas III FAM', 'Persatuan Bolasepak Daerah Temerloh', 'NO 13 JALAN PAYA TARAM 2 TAMAN PAYA TARAM KERDAU 28010 TEMERLOH PAHANG', 'Temerloh', 'Pahang', 'PELAJAR', 'Pelajar Biasa', 'ZURAIDAH BINTI AWALUDDIN', 'SMK KERDAU', 'KASMINAH BINTI SAHARUDIN', 'IBU', '01140376828', 'https://drive.google.com/open?id=1BM2vDgYD_NSrAP9Sr4zKl86_MfQXJQpG', 'Pending', 'Menunggu Admin', 1, 80.00, 17, 1, 1, 1, NOW()
FROM `users` u WHERE u.no_ic = @ic
AND NOT EXISTS (SELECT 1 FROM `permohonan` WHERE no_kp = @ic AND tahun_permohonan = 2026 AND jenis_borang = 'kelas3_fam');

-- [21] MUHAMMAD KHAIRUL ANWAR BIN RAZALI (Temerloh)
SET @ic = '991208025339';
SET @em = 'kayrulvienna46@gmail.com';
INSERT INTO `users` (email, password, role, district_id, persatuan_id, nama_penuh, no_ic, no_telefon, jantina, jenis_pengadil, alamat1, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, umur, aktif, password_changed, tg_link_token, created_at)
SELECT 'kayrulvienna46@gmail.com', '$2b$10$WimxW/G8E.URgytjmfB7ju6dtSD8adSY7mv.ScHf/7Eys7C4DNrTC', 'Pengadil', 11, 11, 'MUHAMMAD KHAIRUL ANWAR BIN RAZALI', '991208025339', '0149364758', 'LELAKI', 'Kelas III FAM', 'No 56 Kampung Bongsu 28500 Lanchang Pahang', 'Temerloh', 'Pahang', 'BEKERJA', 'TENTERA', 'Panglima', 'Markas Grup Artileri Pertahanan Udara Kem Bera 28200 Bandar Bera', 'Nuraswana binti Md Saleh', 'Isteri', '0179462590', 27, 1, 0, '8d2432698ed4da6968c32f9e45abb9ff', NOW()
WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE no_ic = @ic OR email = @em);
INSERT INTO `permohonan` (user_id, district_id, persatuan_id, tahun_permohonan, jenis_permohonan, jenis_borang, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, persatuan_daerah, alamat1, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, url_resit, status, status_workflow, mohon_ujian_bertulis, payment_amount, umur, declare1, declare2, declare3, tarikh_hantar)
SELECT u.id, 11, 11, 2026, 'kelas3_fam', 'kelas3_fam', 'MUHAMMAD KHAIRUL ANWAR BIN RAZALI', '991208025339', 'kayrulvienna46@gmail.com', '0149364758', 'LELAKI', 'Kelas III FAM', 'Persatuan Bolasepak Daerah Temerloh', 'No 56 Kampung Bongsu 28500 Lanchang Pahang', 'Temerloh', 'Pahang', 'BEKERJA', 'TENTERA', 'Panglima', 'Markas Grup Artileri Pertahanan Udara Kem Bera 28200 Bandar Bera', 'Nuraswana binti Md Saleh', 'Isteri', '0179462590', 'https://drive.google.com/open?id=1obilUSyLq1z_jq96ItzGjSXInIJIRUpI', 'Pending', 'Menunggu Admin', 1, 80.00, 27, 1, 1, 1, NOW()
FROM `users` u WHERE u.no_ic = @ic
AND NOT EXISTS (SELECT 1 FROM `permohonan` WHERE no_kp = @ic AND tahun_permohonan = 2026 AND jenis_borang = 'kelas3_fam');

-- [22] NIK MUHAMMAD MUNIR BIN NIK LAH (Bera)
SET @ic = '011027060489';
SET @em = 'nikmunir4520@gmail.com';
INSERT INTO `users` (email, password, role, district_id, persatuan_id, nama_penuh, no_ic, no_telefon, jantina, jenis_pengadil, alamat1, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, umur, aktif, password_changed, tg_link_token, created_at)
SELECT 'nikmunir4520@gmail.com', '$2b$10$zaDpMw6oy.d6Kzc4lLFX0ekUv5ht0wiUlDT0w8kImuu1dOPRWdFkS', 'Pengadil', 2, 2, 'NIK MUHAMMAD MUNIR BIN NIK LAH', '011027060489', '01140663455', 'LELAKI', 'Kelas III FAM', '347-P, RUMAH GURU SK TRIANG 2, FELDA TRIANG 1, 28300, TRIANG, PAHANG', 'Bera', 'Pahang', 'BEKERJA', 'GURU', 'GURU BESAR', 'SK (LKTP) TRIANG 2, FELDA TRIANG 1, 28300 TRIANG, PAHANG', 'NIK LAH BIN NIK MAT', 'BAPA', '0139515532', 25, 1, 0, '108a3a48a08b4adb3b5e647d8f2729f4', NOW()
WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE no_ic = @ic OR email = @em);
INSERT INTO `permohonan` (user_id, district_id, persatuan_id, tahun_permohonan, jenis_permohonan, jenis_borang, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, persatuan_daerah, alamat1, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, url_resit, status, status_workflow, mohon_ujian_bertulis, payment_amount, umur, declare1, declare2, declare3, tarikh_hantar)
SELECT u.id, 2, 2, 2026, 'kelas3_fam', 'kelas3_fam', 'NIK MUHAMMAD MUNIR BIN NIK LAH', '011027060489', 'nikmunir4520@gmail.com', '01140663455', 'LELAKI', 'Kelas III FAM', 'Persatuan Bolasepak Daerah Bera', '347-P, RUMAH GURU SK TRIANG 2, FELDA TRIANG 1, 28300, TRIANG, PAHANG', 'Bera', 'Pahang', 'BEKERJA', 'GURU', 'GURU BESAR', 'SK (LKTP) TRIANG 2, FELDA TRIANG 1, 28300 TRIANG, PAHANG', 'NIK LAH BIN NIK MAT', 'BAPA', '0139515532', 'https://drive.google.com/open?id=1mPR1ydQu3ioUe35Cr8XrEYaT8q3g4FQr', 'Pending', 'Menunggu Admin', 1, 80.00, 25, 1, 1, 1, NOW()
FROM `users` u WHERE u.no_ic = @ic
AND NOT EXISTS (SELECT 1 FROM `permohonan` WHERE no_kp = @ic AND tahun_permohonan = 2026 AND jenis_borang = 'kelas3_fam');

-- [23] MUHAMMAD IZZUL ISLAM BIN MUHAMMAD NOOR (Raub)
SET @ic = '030517060805';
SET @em = 'izl.islam0305@gmail.com';
INSERT INTO `users` (email, password, role, district_id, persatuan_id, nama_penuh, no_ic, no_telefon, jantina, jenis_pengadil, alamat1, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, umur, aktif, password_changed, tg_link_token, created_at)
SELECT 'izl.islam0305@gmail.com', '$2b$10$6CjXOeRcQFVHWEefK.3uCeH4PBV99EkPBbCa3B2bdbk4v3bBJIRt2', 'Pengadil', 9, 9, 'MUHAMMAD IZZUL ISLAM BIN MUHAMMAD NOOR', '030517060805', '0195885941', 'LELAKI', 'Kelas III FAM', 'NO. 180,KG MELAYU CHEROH 3,27620,RAUB,PAHANG', 'Raub', 'Pahang', 'BEKERJA', 'PEMBANTU KHIDMAT AM', 'MAJLIS DAERAH RAUB', '27600,RAUB,PAHANG', 'MUHAMMAD NOOR BIN MUSA', 'BAPA', '0109866434', 23, 1, 0, '7b205d759bd686071f4a9664ec5d3775', NOW()
WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE no_ic = @ic OR email = @em);
INSERT INTO `permohonan` (user_id, district_id, persatuan_id, tahun_permohonan, jenis_permohonan, jenis_borang, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, persatuan_daerah, alamat1, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, url_resit, status, status_workflow, mohon_ujian_bertulis, payment_amount, umur, declare1, declare2, declare3, tarikh_hantar)
SELECT u.id, 9, 9, 2026, 'kelas3_fam', 'kelas3_fam', 'MUHAMMAD IZZUL ISLAM BIN MUHAMMAD NOOR', '030517060805', 'izl.islam0305@gmail.com', '0195885941', 'LELAKI', 'Kelas III FAM', 'Persatuan Bolasepak Daerah Raub', 'NO. 180,KG MELAYU CHEROH 3,27620,RAUB,PAHANG', 'Raub', 'Pahang', 'BEKERJA', 'PEMBANTU KHIDMAT AM', 'MAJLIS DAERAH RAUB', '27600,RAUB,PAHANG', 'MUHAMMAD NOOR BIN MUSA', 'BAPA', '0109866434', 'https://drive.google.com/open?id=1V3DY-hULaRsA6jlmAxMLt1-OiKOa9_mL', 'Pending', 'Menunggu Admin', 1, 80.00, 23, 1, 1, 1, NOW()
FROM `users` u WHERE u.no_ic = @ic
AND NOT EXISTS (SELECT 1 FROM `permohonan` WHERE no_kp = @ic AND tahun_permohonan = 2026 AND jenis_borang = 'kelas3_fam');

-- [24] MUHAMMAD IMAN AFIF BIN MOHD KAMIL (Temerloh)
SET @ic = '020617060213';
SET @em = 'imanafif2002@gmail.com';
INSERT INTO `users` (email, password, role, district_id, persatuan_id, nama_penuh, no_ic, no_telefon, jantina, jenis_pengadil, alamat1, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, umur, aktif, password_changed, tg_link_token, created_at)
SELECT 'imanafif2002@gmail.com', '$2b$10$YrscVDlW42/dS0xAeg22NupKwpATlcg7lucPeyxzhjgeYwERb21SG', 'Pengadil', 11, 11, 'MUHAMMAD IMAN AFIF BIN MOHD KAMIL', '020617060213', '01137939462', 'LELAKI', 'Kelas III FAM', 'PT6338, RTK KG PAYA LAMAN,28500,LANCHANG, PAHANG DM', 'Temerloh', 'Pahang', 'BEKERJA', 'GURU', 'GURU BESAR', 'SK FELDA LAKUM, 28500, LANCHANG PAHANG DM', 'KHAIRUL RUSMA BT ISMAIL', 'IBU', '0199560892', 24, 1, 0, 'f51b73b62a92e133a915bd4e4aa27c1b', NOW()
WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE no_ic = @ic OR email = @em);
INSERT INTO `permohonan` (user_id, district_id, persatuan_id, tahun_permohonan, jenis_permohonan, jenis_borang, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, persatuan_daerah, alamat1, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, url_resit, status, status_workflow, mohon_ujian_bertulis, payment_amount, umur, declare1, declare2, declare3, tarikh_hantar)
SELECT u.id, 11, 11, 2026, 'kelas3_fam', 'kelas3_fam', 'MUHAMMAD IMAN AFIF BIN MOHD KAMIL', '020617060213', 'imanafif2002@gmail.com', '01137939462', 'LELAKI', 'Kelas III FAM', 'Persatuan Bolasepak Daerah Temerloh', 'PT6338, RTK KG PAYA LAMAN,28500,LANCHANG, PAHANG DM', 'Temerloh', 'Pahang', 'BEKERJA', 'GURU', 'GURU BESAR', 'SK FELDA LAKUM, 28500, LANCHANG PAHANG DM', 'KHAIRUL RUSMA BT ISMAIL', 'IBU', '0199560892', 'https://drive.google.com/open?id=1wmQHWGWOOUyoGpnbvHp5x7P4X6-_VA_Q', 'Pending', 'Menunggu Admin', 1, 80.00, 24, 1, 1, 1, NOW()
FROM `users` u WHERE u.no_ic = @ic
AND NOT EXISTS (SELECT 1 FROM `permohonan` WHERE no_kp = @ic AND tahun_permohonan = 2026 AND jenis_borang = 'kelas3_fam');

-- [25] ANWARI IKHLAS BIN BAHARUM (Bera)
SET @ic = '920130065219.0';
SET @em = 'ikhguero10@gmail.com';
INSERT INTO `users` (email, password, role, district_id, persatuan_id, nama_penuh, no_ic, no_telefon, jantina, jenis_pengadil, alamat1, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, umur, aktif, password_changed, tg_link_token, created_at)
SELECT 'ikhguero10@gmail.com', '$2b$10$IuKtb2lWHMWbGg2zLiLp1.tam5/j9hV6qMGAvpoQCsRQAt0pG5t8i', 'Pengadil', 2, 2, 'ANWARI IKHLAS BIN BAHARUM', '920130065219.0', '0145189357', 'LELAKI', 'Kelas III FAM', 'NO 39, JALAN MERBAU IMPIAN 1, VILLA TAMAN MERBAU IMPIAN', 'Bera', 'Pahang', 'BEKERJA', 'GURU', 'GURU BESAR SJKC TRIANG 2', 'SJKC TRIANG 2', 'HUSNA FAIZAH BT RAHMAT', 'ISTERI', '01110553566', 34, 1, 0, '20e9067d9ea0424c18ae77c7a1258cd4', NOW()
WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE no_ic = @ic OR email = @em);
INSERT INTO `permohonan` (user_id, district_id, persatuan_id, tahun_permohonan, jenis_permohonan, jenis_borang, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, persatuan_daerah, alamat1, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, url_resit, status, status_workflow, mohon_ujian_bertulis, payment_amount, umur, declare1, declare2, declare3, tarikh_hantar)
SELECT u.id, 2, 2, 2026, 'kelas3_fam', 'kelas3_fam', 'ANWARI IKHLAS BIN BAHARUM', '920130065219.0', 'ikhguero10@gmail.com', '0145189357', 'LELAKI', 'Kelas III FAM', 'Persatuan Bolasepak Daerah Bera', 'NO 39, JALAN MERBAU IMPIAN 1, VILLA TAMAN MERBAU IMPIAN', 'Bera', 'Pahang', 'BEKERJA', 'GURU', 'GURU BESAR SJKC TRIANG 2', 'SJKC TRIANG 2', 'HUSNA FAIZAH BT RAHMAT', 'ISTERI', '01110553566', 'https://drive.google.com/open?id=17OWkXG2oIm9oUtyztFOI8GCCXW7b5NHu', 'Pending', 'Menunggu Admin', 1, 80.00, 34, 1, 1, 1, NOW()
FROM `users` u WHERE u.no_ic = @ic
AND NOT EXISTS (SELECT 1 FROM `permohonan` WHERE no_kp = @ic AND tahun_permohonan = 2026 AND jenis_borang = 'kelas3_fam');

-- [26] ZAFFRAN NURIMAN BIN ABDULLAH (Jerantut)
SET @ic = '090430060663';
SET @em = 'mommynuriman86@gmail.com';
INSERT INTO `users` (email, password, role, district_id, persatuan_id, nama_penuh, no_ic, no_telefon, jantina, jenis_pengadil, alamat1, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, umur, aktif, password_changed, tg_link_token, created_at)
SELECT 'mommynuriman86@gmail.com', '$2b$10$yTb3S3CdDyPAuUvBgkL61usVGpo2qo4vp25Y/jgaTfvGM2WSmkZL.', 'Pengadil', 4, 4, 'ZAFFRAN NURIMAN BIN ABDULLAH', '090430060663', '01170062066', 'LELAKI', 'Kelas III FAM', 'L. 240 FELDA MELUR JENGKA 12, 26420 BANDAR PUSAT JENGKA,  PAHANG', 'Jerantut', 'Pahang', 'PELAJAR', 'PELAJAR', 'PENGETUA', 'SEKOLAH MENENGAH TENGKU AMPUAN AFZAN CHENOR, 28100 MARAN, PAHANG', 'SALASIAH BINTI MOHAMED RAFLI', 'IBU', '1128963314', 17, 1, 0, '0117ae1e2d46020738ec8bc1afd3b4f4', NOW()
WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE no_ic = @ic OR email = @em);
INSERT INTO `permohonan` (user_id, district_id, persatuan_id, tahun_permohonan, jenis_permohonan, jenis_borang, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, persatuan_daerah, alamat1, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, url_resit, status, status_workflow, mohon_ujian_bertulis, payment_amount, umur, declare1, declare2, declare3, tarikh_hantar)
SELECT u.id, 4, 4, 2026, 'kelas3_fam', 'kelas3_fam', 'ZAFFRAN NURIMAN BIN ABDULLAH', '090430060663', 'mommynuriman86@gmail.com', '01170062066', 'LELAKI', 'Kelas III FAM', 'Persatuan Bolasepak Daerah Jerantut', 'L. 240 FELDA MELUR JENGKA 12, 26420 BANDAR PUSAT JENGKA,  PAHANG', 'Jerantut', 'Pahang', 'PELAJAR', 'PELAJAR', 'PENGETUA', 'SEKOLAH MENENGAH TENGKU AMPUAN AFZAN CHENOR, 28100 MARAN, PAHANG', 'SALASIAH BINTI MOHAMED RAFLI', 'IBU', '1128963314', 'https://drive.google.com/open?id=1iMj-O7KHXvaPzz2-IWWoN-o-rX1wWv9m', 'Pending', 'Menunggu Admin', 1, 80.00, 17, 1, 1, 1, NOW()
FROM `users` u WHERE u.no_ic = @ic
AND NOT EXISTS (SELECT 1 FROM `permohonan` WHERE no_kp = @ic AND tahun_permohonan = 2026 AND jenis_borang = 'kelas3_fam');

-- [27] AHMAD HAZREEF IZZUDIN BIN AHMAD TAZUDIN (Jerantut)
SET @ic = '090822060785';
SET @em = 'hadeenafarisya@gmail.com';
INSERT INTO `users` (email, password, role, district_id, persatuan_id, nama_penuh, no_ic, no_telefon, jantina, jenis_pengadil, alamat1, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, umur, aktif, password_changed, tg_link_token, created_at)
SELECT 'hadeenafarisya@gmail.com', '$2b$10$Jq2q7YpoegfdfnOmGC0ic.aZ6OJ/sOBl5JNL94yMioVXNBhGYZTnO', 'Pengadil', 4, 4, 'AHMAD HAZREEF IZZUDIN BIN AHMAD TAZUDIN', '090822060785', '01125733565', 'LELAKI', 'Kelas III FAM', 'D251 FELDA MAWAR JENGKA 10, 26400, BANDAR PUSAT JENGKA  PAHANG', 'Jerantut', 'Pahang', 'PELAJAR', '-', '-', '-', 'AHMAD TAZUDIN BIN HASIM', 'BAPA', '0179352295', 17, 1, 0, '7789a635e067a7607838859a2d39f2c9', NOW()
WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE no_ic = @ic OR email = @em);
INSERT INTO `permohonan` (user_id, district_id, persatuan_id, tahun_permohonan, jenis_permohonan, jenis_borang, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, persatuan_daerah, alamat1, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, url_resit, status, status_workflow, mohon_ujian_bertulis, payment_amount, umur, declare1, declare2, declare3, tarikh_hantar)
SELECT u.id, 4, 4, 2026, 'kelas3_fam', 'kelas3_fam', 'AHMAD HAZREEF IZZUDIN BIN AHMAD TAZUDIN', '090822060785', 'hadeenafarisya@gmail.com', '01125733565', 'LELAKI', 'Kelas III FAM', 'Persatuan Bolasepak Daerah Jerantut', 'D251 FELDA MAWAR JENGKA 10, 26400, BANDAR PUSAT JENGKA  PAHANG', 'Jerantut', 'Pahang', 'PELAJAR', '-', '-', '-', 'AHMAD TAZUDIN BIN HASIM', 'BAPA', '0179352295', 'https://drive.google.com/open?id=1_uHS-ZwNYvBmqd3FOvKEGYavT2GUqXxW', 'Pending', 'Menunggu Admin', 1, 80.00, 17, 1, 1, 1, NOW()
FROM `users` u WHERE u.no_ic = @ic
AND NOT EXISTS (SELECT 1 FROM `permohonan` WHERE no_kp = @ic AND tahun_permohonan = 2026 AND jenis_borang = 'kelas3_fam');

-- [28] ALEX BIN JUNE (Bera)
SET @ic = '990308126001.0';
SET @em = 'alexjune7196@gmail.com';
INSERT INTO `users` (email, password, role, district_id, persatuan_id, nama_penuh, no_ic, no_telefon, jantina, jenis_pengadil, alamat1, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, umur, aktif, password_changed, tg_link_token, created_at)
SELECT 'alexjune7196@gmail.com', '$2b$10$oWUSNnMNqnpOU2kwxe83PeF4exqCHvu86CBOgA//Q14uXd/l2VV/6', 'Pengadil', 2, 2, 'ALEX BIN JUNE', '990308126001.0', '0143709155', 'LELAKI', 'Kelas III FAM', 'REJIMEN KE 34 ARTILERI DIRAJA KEM BERA', 'Bera', 'Pahang', 'BEKERJA', 'TENTERA', 'MOHD ANDRIAN SHA BIN NADIM', 'REJIMEN KE 34 ARTILERI DIRAJA KEM BERA', 'JUNE BIN KALUR', 'BAPA', '01131447228', 27, 1, 0, '5bc5fb26a6f5b184366961f1c5822c85', NOW()
WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE no_ic = @ic OR email = @em);
INSERT INTO `permohonan` (user_id, district_id, persatuan_id, tahun_permohonan, jenis_permohonan, jenis_borang, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, persatuan_daerah, alamat1, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, url_resit, status, status_workflow, mohon_ujian_bertulis, payment_amount, umur, declare1, declare2, declare3, tarikh_hantar)
SELECT u.id, 2, 2, 2026, 'kelas3_fam', 'kelas3_fam', 'ALEX BIN JUNE', '990308126001.0', 'alexjune7196@gmail.com', '0143709155', 'LELAKI', 'Kelas III FAM', 'Persatuan Bolasepak Daerah Bera', 'REJIMEN KE 34 ARTILERI DIRAJA KEM BERA', 'Bera', 'Pahang', 'BEKERJA', 'TENTERA', 'MOHD ANDRIAN SHA BIN NADIM', 'REJIMEN KE 34 ARTILERI DIRAJA KEM BERA', 'JUNE BIN KALUR', 'BAPA', '01131447228', 'https://drive.google.com/open?id=1PJRbwU9eWeCsftV5U0_zijriAALxdkyi', 'Pending', 'Menunggu Admin', 1, 80.00, 27, 1, 1, 1, NOW()
FROM `users` u WHERE u.no_ic = @ic
AND NOT EXISTS (SELECT 1 FROM `permohonan` WHERE no_kp = @ic AND tahun_permohonan = 2026 AND jenis_borang = 'kelas3_fam');

-- [29] MUHAMMAD SYAZWAN BIN NAZRI (Kuantan)
SET @ic = '920223065381';
SET @em = 'jjq2745@gmail.com';
INSERT INTO `users` (email, password, role, district_id, persatuan_id, nama_penuh, no_ic, no_telefon, jantina, jenis_pengadil, alamat1, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, umur, aktif, password_changed, tg_link_token, created_at)
SELECT 'jjq2745@gmail.com', '$2b$10$az7nGSvXvg1Cw/pI.y.wVuPXEjN8o4FpxuK4GAw6mfQO0m3RhorU2', 'Pengadil', 5, 5, 'MUHAMMAD SYAZWAN BIN NAZRI', '920223065381', '0145175248', 'LELAKI', 'Kelas III FAM', '109527-37, Jalan Gambang Kampung Padang Jaya, Jaya Gading 26070 Kuantan Pahang', 'Kuantan', 'Pahang', 'BEKERJA', 'TENTERA', 'ANGKATAN TENTERA MALAYSIA', 'Markas Tentera Darat Cawangan Sumber Manusia, Kementah Jalan Padang Tembak 50634, Kuala Lumpur, Wilayah Perseketuan (KL)', 'Noramirah binti Abd Aziz', 'Isteri', '01125646845', 34, 1, 0, '33f9d72ca7cc18af7be2518966fb6fee', NOW()
WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE no_ic = @ic OR email = @em);
INSERT INTO `permohonan` (user_id, district_id, persatuan_id, tahun_permohonan, jenis_permohonan, jenis_borang, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, persatuan_daerah, alamat1, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, url_resit, status, status_workflow, mohon_ujian_bertulis, payment_amount, umur, declare1, declare2, declare3, tarikh_hantar)
SELECT u.id, 5, 5, 2026, 'kelas3_fam', 'kelas3_fam', 'MUHAMMAD SYAZWAN BIN NAZRI', '920223065381', 'jjq2745@gmail.com', '0145175248', 'LELAKI', 'Kelas III FAM', 'Persatuan Bolasepak Daerah Kuantan', '109527-37, Jalan Gambang Kampung Padang Jaya, Jaya Gading 26070 Kuantan Pahang', 'Kuantan', 'Pahang', 'BEKERJA', 'TENTERA', 'ANGKATAN TENTERA MALAYSIA', 'Markas Tentera Darat Cawangan Sumber Manusia, Kementah Jalan Padang Tembak 50634, Kuala Lumpur, Wilayah Perseketuan (KL)', 'Noramirah binti Abd Aziz', 'Isteri', '01125646845', 'https://drive.google.com/open?id=1IaDy6c7LSPc0YWYlYoTvxpnX_AR5c3mw', 'Pending', 'Menunggu Admin', 1, 80.00, 34, 1, 1, 1, NOW()
FROM `users` u WHERE u.no_ic = @ic
AND NOT EXISTS (SELECT 1 FROM `permohonan` WHERE no_kp = @ic AND tahun_permohonan = 2026 AND jenis_borang = 'kelas3_fam');

-- [30] MUHAMMAD HAFIZULLAH BIN SU'AIMI (Rompin)
SET @ic = '000611060919';
SET @em = 'muhammadhafizullah323@gmail.com';
INSERT INTO `users` (email, password, role, district_id, persatuan_id, nama_penuh, no_ic, no_telefon, jantina, jenis_pengadil, alamat1, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, umur, aktif, password_changed, tg_link_token, created_at)
SELECT 'muhammadhafizullah323@gmail.com', '$2b$10$if3jtXfFnXWNvA134wm0Yu31zXyTiUrXoo5QanTHixOGInlMCr9Ry', 'Pengadil', 10, 10, 'MUHAMMAD HAFIZULLAH BIN SU''AIMI', '000611060919', '0196802400', 'LELAKI', 'Kelas III FAM', 'NO 92 PERUMAHAN DATO SHAHBANDAR 26600, PEKAN, PAHANG', 'Rompin', 'Pahang', 'BEKERJA', 'PEMBANTU KHIDMAT AM GRED H1', 'PEJABAT DAERAH DAN TANAH ROMPIN', 'TINGKAT BAWAH KOMPLEKS KERAJAAN BLOK B 26800 ROMPIN PAHANG', 'SU''AIMI BIN AHMAD', 'BAPA', '01140025767', 26, 1, 0, '8c12e35cfcca3e0de69ff15285eb5b76', NOW()
WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE no_ic = @ic OR email = @em);
INSERT INTO `permohonan` (user_id, district_id, persatuan_id, tahun_permohonan, jenis_permohonan, jenis_borang, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, persatuan_daerah, alamat1, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, url_resit, status, status_workflow, mohon_ujian_bertulis, payment_amount, umur, declare1, declare2, declare3, tarikh_hantar)
SELECT u.id, 10, 10, 2026, 'kelas3_fam', 'kelas3_fam', 'MUHAMMAD HAFIZULLAH BIN SU''AIMI', '000611060919', 'muhammadhafizullah323@gmail.com', '0196802400', 'LELAKI', 'Kelas III FAM', 'Persatuan Bolasepak Daerah Rompin', 'NO 92 PERUMAHAN DATO SHAHBANDAR 26600, PEKAN, PAHANG', 'Rompin', 'Pahang', 'BEKERJA', 'PEMBANTU KHIDMAT AM GRED H1', 'PEJABAT DAERAH DAN TANAH ROMPIN', 'TINGKAT BAWAH KOMPLEKS KERAJAAN BLOK B 26800 ROMPIN PAHANG', 'SU''AIMI BIN AHMAD', 'BAPA', '01140025767', 'https://drive.google.com/open?id=17_5JntzczjE3ZLfDJOaKY8pUMqz4GNDw', 'Pending', 'Menunggu Admin', 1, 80.00, 26, 1, 1, 1, NOW()
FROM `users` u WHERE u.no_ic = @ic
AND NOT EXISTS (SELECT 1 FROM `permohonan` WHERE no_kp = @ic AND tahun_permohonan = 2026 AND jenis_borang = 'kelas3_fam');

-- [31] MUHAMMAD AMAR SHAUQI BIN NIRRAHIM (Rompin)
SET @ic = '031104060561';
SET @em = 'amarkuki03@gmail.com';
INSERT INTO `users` (email, password, role, district_id, persatuan_id, nama_penuh, no_ic, no_telefon, jantina, jenis_pengadil, alamat1, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, umur, aktif, password_changed, tg_link_token, created_at)
SELECT 'amarkuki03@gmail.com', '$2b$10$6sj05r//7TX5cbIpi7VV3eMOFryD1svSea8Tg0m4KzGbyhL7lPhrG', 'Pengadil', 10, 10, 'MUHAMMAD AMAR SHAUQI BIN NIRRAHIM', '031104060561', '0136268710', 'LELAKI', 'Kelas III FAM', 'F12,KAMPUNG LEBAN CHONDONG,KUALA ROMPIN,PAHANG 26810', 'Rompin', 'Pahang', 'BEKERJA', 'PEMBANTU KHIDMAT AM GRED H1', 'PEJABAT DAERAH DAN TANAH ROMPIN', 'KOMPLEKS PENTADBIRAN KERAJAAN DAERAH ROMPIN , BLOK A ,26800,KUALA ROMPIN,PAHANG', 'ROSMIDAR BINTI OTHMAN', 'IBU', '0139915208', 23, 1, 0, 'da1597d63545f4f3f7fbb86523ab78f3', NOW()
WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE no_ic = @ic OR email = @em);
INSERT INTO `permohonan` (user_id, district_id, persatuan_id, tahun_permohonan, jenis_permohonan, jenis_borang, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, persatuan_daerah, alamat1, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, url_resit, status, status_workflow, mohon_ujian_bertulis, payment_amount, umur, declare1, declare2, declare3, tarikh_hantar)
SELECT u.id, 10, 10, 2026, 'kelas3_fam', 'kelas3_fam', 'MUHAMMAD AMAR SHAUQI BIN NIRRAHIM', '031104060561', 'amarkuki03@gmail.com', '0136268710', 'LELAKI', 'Kelas III FAM', 'Persatuan Bolasepak Daerah Rompin', 'F12,KAMPUNG LEBAN CHONDONG,KUALA ROMPIN,PAHANG 26810', 'Rompin', 'Pahang', 'BEKERJA', 'PEMBANTU KHIDMAT AM GRED H1', 'PEJABAT DAERAH DAN TANAH ROMPIN', 'KOMPLEKS PENTADBIRAN KERAJAAN DAERAH ROMPIN , BLOK A ,26800,KUALA ROMPIN,PAHANG', 'ROSMIDAR BINTI OTHMAN', 'IBU', '0139915208', 'https://drive.google.com/open?id=1E9sy2sFkejXpQIvtX9adsykaY3-pb6EO', 'Pending', 'Menunggu Admin', 1, 80.00, 23, 1, 1, 1, NOW()
FROM `users` u WHERE u.no_ic = @ic
AND NOT EXISTS (SELECT 1 FROM `permohonan` WHERE no_kp = @ic AND tahun_permohonan = 2026 AND jenis_borang = 'kelas3_fam');

-- [32] ZULKIFLI BIN ALIAS (Kuantan)
SET @ic = '930107036339';
SET @em = 'zulkiflialias6339@gmail.com';
INSERT INTO `users` (email, password, role, district_id, persatuan_id, nama_penuh, no_ic, no_telefon, jantina, jenis_pengadil, alamat1, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, umur, aktif, password_changed, tg_link_token, created_at)
SELECT 'zulkiflialias6339@gmail.com', '$2b$10$zunlUn9c14bj9dYrdIb8/.6mcSgTTpZRTRrCsc6zS.hsfHTXi/hxq', 'Pengadil', 5, 5, 'ZULKIFLI BIN ALIAS', '930107036339', '0128357546', 'LELAKI', 'Kelas III FAM', 'NO 38, LORONG KEMPADANG MAJU 1/10', 'Kuantan', 'Pahang', 'BEKERJA', 'GURU', 'PENGETUA', 'SEKOLAH SUKAN MALAYSIA, GAMBANG', 'NOR ALYAA BINTI YUSOFF', 'ISTERI', '0169849278', 33, 1, 0, 'df724ad3dbc41c5b41550bf6a7785eee', NOW()
WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE no_ic = @ic OR email = @em);
INSERT INTO `permohonan` (user_id, district_id, persatuan_id, tahun_permohonan, jenis_permohonan, jenis_borang, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, persatuan_daerah, alamat1, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, url_resit, status, status_workflow, mohon_ujian_bertulis, payment_amount, umur, declare1, declare2, declare3, tarikh_hantar)
SELECT u.id, 5, 5, 2026, 'kelas3_fam', 'kelas3_fam', 'ZULKIFLI BIN ALIAS', '930107036339', 'zulkiflialias6339@gmail.com', '0128357546', 'LELAKI', 'Kelas III FAM', 'Persatuan Bolasepak Daerah Kuantan', 'NO 38, LORONG KEMPADANG MAJU 1/10', 'Kuantan', 'Pahang', 'BEKERJA', 'GURU', 'PENGETUA', 'SEKOLAH SUKAN MALAYSIA, GAMBANG', 'NOR ALYAA BINTI YUSOFF', 'ISTERI', '0169849278', 'https://drive.google.com/open?id=1dTBYTAwC3SxUBx6uQpfXDsmI111V1DCp', 'Pending', 'Menunggu Admin', 1, 80.00, 33, 1, 1, 1, NOW()
FROM `users` u WHERE u.no_ic = @ic
AND NOT EXISTS (SELECT 1 FROM `permohonan` WHERE no_kp = @ic AND tahun_permohonan = 2026 AND jenis_borang = 'kelas3_fam');

-- [33] MOHAMAD AMIRUL DARWISY BIN ROSLI (Maran)
SET @ic = '090923060397';
SET @em = 'cikaa74@gmail.com';
INSERT INTO `users` (email, password, role, district_id, persatuan_id, nama_penuh, no_ic, no_telefon, jantina, jenis_pengadil, alamat1, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, umur, aktif, password_changed, tg_link_token, created_at)
SELECT 'cikaa74@gmail.com', '$2b$10$IM2p5JbmhedbGFDpLxxcke7r89YDrRo.dzbiXTeuK2QVH39P1rwNe', 'Pengadil', 7, 7, 'MOHAMAD AMIRUL DARWISY BIN ROSLI', '090923060397', '0147679848', 'LELAKI', 'Kelas III FAM', 'NO 1, LORONG PS2/4, TAMAN PERMATANG SHAHBANDAR 2, 26400 BANDAR PUSAT JENGKA, PAHANG', 'Maran', 'Pahang', 'PELAJAR', 'PELAJAR', 'PENGETUA', 'SMK JENGKA PUSAT, 26400 BANDAR PUSAT JENGKA, PAHANG', 'ROSLI BIN SAAD', 'BAPA', '0199972369', 17, 1, 0, '4a7b508161d77af4a156d8b269076aa5', NOW()
WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE no_ic = @ic OR email = @em);
INSERT INTO `permohonan` (user_id, district_id, persatuan_id, tahun_permohonan, jenis_permohonan, jenis_borang, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, persatuan_daerah, alamat1, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, url_resit, status, status_workflow, mohon_ujian_bertulis, payment_amount, umur, declare1, declare2, declare3, tarikh_hantar)
SELECT u.id, 7, 7, 2026, 'kelas3_fam', 'kelas3_fam', 'MOHAMAD AMIRUL DARWISY BIN ROSLI', '090923060397', 'cikaa74@gmail.com', '0147679848', 'LELAKI', 'Kelas III FAM', 'Persatuan Bolasepak Daerah Maran', 'NO 1, LORONG PS2/4, TAMAN PERMATANG SHAHBANDAR 2, 26400 BANDAR PUSAT JENGKA, PAHANG', 'Maran', 'Pahang', 'PELAJAR', 'PELAJAR', 'PENGETUA', 'SMK JENGKA PUSAT, 26400 BANDAR PUSAT JENGKA, PAHANG', 'ROSLI BIN SAAD', 'BAPA', '0199972369', 'https://drive.google.com/open?id=1zM-bov31fDjaXcg1AmVXS8orp-abWBTj', 'Pending', 'Menunggu Admin', 1, 80.00, 17, 1, 1, 1, NOW()
FROM `users` u WHERE u.no_ic = @ic
AND NOT EXISTS (SELECT 1 FROM `permohonan` WHERE no_kp = @ic AND tahun_permohonan = 2026 AND jenis_borang = 'kelas3_fam');

-- [34] AHMAD FIRDAUS BIN AHMAD RADZI (Jerantut)
SET @ic = '990714066331';
SET @em = 'firdausradzi147@gmail.com';
INSERT INTO `users` (email, password, role, district_id, persatuan_id, nama_penuh, no_ic, no_telefon, jantina, jenis_pengadil, alamat1, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, umur, aktif, password_changed, tg_link_token, created_at)
SELECT 'firdausradzi147@gmail.com', '$2b$10$sdDI72pA8g7aFaaqG0OI1uqE4DnzvcuNodPkwovAFmBLlKmHWGcN2', 'Pengadil', 4, 4, 'AHMAD FIRDAUS BIN AHMAD RADZI', '990714066331', '0128990714', 'LELAKI', 'Kelas III FAM', 'NO.31, JALAN PJ UTAMA, TAMAN PEDAH JAYA, 27000 JERANTUT, PAHANG', 'Jerantut', 'Pahang', 'BEKERJA', 'Guru Ganti', 'Guru Besar', '-', 'Ahmad Radzi Bin Abdul Rahman', 'Ayah', '0139841853', 27, 1, 0, 'f90b6110cf56740c2fb5485580dbd310', NOW()
WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE no_ic = @ic OR email = @em);
INSERT INTO `permohonan` (user_id, district_id, persatuan_id, tahun_permohonan, jenis_permohonan, jenis_borang, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, persatuan_daerah, alamat1, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, url_resit, status, status_workflow, mohon_ujian_bertulis, payment_amount, umur, declare1, declare2, declare3, tarikh_hantar)
SELECT u.id, 4, 4, 2026, 'kelas3_fam', 'kelas3_fam', 'AHMAD FIRDAUS BIN AHMAD RADZI', '990714066331', 'firdausradzi147@gmail.com', '0128990714', 'LELAKI', 'Kelas III FAM', 'Persatuan Bolasepak Daerah Jerantut', 'NO.31, JALAN PJ UTAMA, TAMAN PEDAH JAYA, 27000 JERANTUT, PAHANG', 'Jerantut', 'Pahang', 'BEKERJA', 'Guru Ganti', 'Guru Besar', '-', 'Ahmad Radzi Bin Abdul Rahman', 'Ayah', '0139841853', 'https://drive.google.com/open?id=1EDbXe3G2s2IdfdmZbX40IMI46xc5nN0Y', 'Pending', 'Menunggu Admin', 1, 80.00, 27, 1, 1, 1, NOW()
FROM `users` u WHERE u.no_ic = @ic
AND NOT EXISTS (SELECT 1 FROM `permohonan` WHERE no_kp = @ic AND tahun_permohonan = 2026 AND jenis_borang = 'kelas3_fam');

-- [35] MUHAMMAD ILHAN RAZIQ (Kuantan)
SET @ic = '090627060405';
SET @em = 'nazruldell82@gmail.com';
INSERT INTO `users` (email, password, role, district_id, persatuan_id, nama_penuh, no_ic, no_telefon, jantina, jenis_pengadil, alamat1, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, umur, aktif, password_changed, tg_link_token, created_at)
SELECT 'nazruldell82@gmail.com', '$2b$10$PHWFAw0vi1Guyuah7YolmOGJJ/65wPtJHIQECD0urs4fxiXptlGta', 'Pengadil', 5, 5, 'MUHAMMAD ILHAN RAZIQ', '090627060405', '01153338284', 'LELAKI', 'Kelas III FAM', 'NO 19/27 IM 15,BANDAR INDERA MAHKOTA,25200,KUANTAN,PAHANG', 'Kuantan', 'Pahang', 'PELAJAR', 'PELAJAR', 'PELAJAR SEKOLAH', 'SMK IM2', 'MOHAMED NAZRUL BIN DAHALAN', 'BAPA', '0139071207', 17, 1, 0, '6b5ce03e5c855d6317cf4ae1da89d0c1', NOW()
WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE no_ic = @ic OR email = @em);
INSERT INTO `permohonan` (user_id, district_id, persatuan_id, tahun_permohonan, jenis_permohonan, jenis_borang, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, persatuan_daerah, alamat1, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, url_resit, status, status_workflow, mohon_ujian_bertulis, payment_amount, umur, declare1, declare2, declare3, tarikh_hantar)
SELECT u.id, 5, 5, 2026, 'kelas3_fam', 'kelas3_fam', 'MUHAMMAD ILHAN RAZIQ', '090627060405', 'nazruldell82@gmail.com', '01153338284', 'LELAKI', 'Kelas III FAM', 'Persatuan Bolasepak Daerah Kuantan', 'NO 19/27 IM 15,BANDAR INDERA MAHKOTA,25200,KUANTAN,PAHANG', 'Kuantan', 'Pahang', 'PELAJAR', 'PELAJAR', 'PELAJAR SEKOLAH', 'SMK IM2', 'MOHAMED NAZRUL BIN DAHALAN', 'BAPA', '0139071207', 'https://drive.google.com/open?id=1MPLkkM8H0LLCk_3a8Z9HA9U5XNeHTIBn', 'Pending', 'Menunggu Admin', 1, 80.00, 17, 1, 1, 1, NOW()
FROM `users` u WHERE u.no_ic = @ic
AND NOT EXISTS (SELECT 1 FROM `permohonan` WHERE no_kp = @ic AND tahun_permohonan = 2026 AND jenis_borang = 'kelas3_fam');

-- [36] MOHD BASAR BIN SERTI (Jerantut)
SET @ic = '891218065539';
SET @em = 'mohdbasar.serti@gmail.com';
INSERT INTO `users` (email, password, role, district_id, persatuan_id, nama_penuh, no_ic, no_telefon, jantina, jenis_pengadil, alamat1, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, umur, aktif, password_changed, tg_link_token, created_at)
SELECT 'mohdbasar.serti@gmail.com', '$2b$10$o5WsxqqNnCuEuMXj8Mqo2O3vqT3iIWdbQRmwmwl6euHgtz2CVtytC', 'Pengadil', 4, 4, 'MOHD BASAR BIN SERTI', '891218065539', '01116323643', 'LELAKI', 'Kelas III FAM', 'NO.167 FELDA LEPAR UTARA 2,26400 BANDAR JENGKA,PAHANG', 'Jerantut', 'Pahang', 'BEKERJA', 'POLIS BANTUAN FELDA', 'FGV SECURITY SERVICES SDN BHD', 'FGV SECURITY SERVICES WILAYAH JENGKA,G-13-1 LORONG TARBP 6 TUN RAZAK BUSINESS PARK 26400 BANDAR JENGKA', 'NOOR FARHAN RIHA BINTI HARZRI', 'ISTERI', '0132454245', 37, 1, 0, '27c53dde9a5ed0a3eae6647fe0ce6d47', NOW()
WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE no_ic = @ic OR email = @em);
INSERT INTO `permohonan` (user_id, district_id, persatuan_id, tahun_permohonan, jenis_permohonan, jenis_borang, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, persatuan_daerah, alamat1, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, url_resit, status, status_workflow, mohon_ujian_bertulis, payment_amount, umur, declare1, declare2, declare3, tarikh_hantar)
SELECT u.id, 4, 4, 2026, 'kelas3_fam', 'kelas3_fam', 'MOHD BASAR BIN SERTI', '891218065539', 'mohdbasar.serti@gmail.com', '01116323643', 'LELAKI', 'Kelas III FAM', 'Persatuan Bolasepak Daerah Jerantut', 'NO.167 FELDA LEPAR UTARA 2,26400 BANDAR JENGKA,PAHANG', 'Jerantut', 'Pahang', 'BEKERJA', 'POLIS BANTUAN FELDA', 'FGV SECURITY SERVICES SDN BHD', 'FGV SECURITY SERVICES WILAYAH JENGKA,G-13-1 LORONG TARBP 6 TUN RAZAK BUSINESS PARK 26400 BANDAR JENGKA', 'NOOR FARHAN RIHA BINTI HARZRI', 'ISTERI', '0132454245', 'https://drive.google.com/open?id=1i8MJo1qfJSnpqO4Swvh0ep7yV-SkYDrk', 'Pending', 'Menunggu Admin', 1, 80.00, 37, 1, 1, 1, NOW()
FROM `users` u WHERE u.no_ic = @ic
AND NOT EXISTS (SELECT 1 FROM `permohonan` WHERE no_kp = @ic AND tahun_permohonan = 2026 AND jenis_borang = 'kelas3_fam');

-- [37] MUHAMAD HAMIMUDDIN BIN ISMAIL (Kuantan)
SET @ic = '921111065947';
SET @em = 'hamimuddin92@gmail.com';
INSERT INTO `users` (email, password, role, district_id, persatuan_id, nama_penuh, no_ic, no_telefon, jantina, jenis_pengadil, alamat1, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, umur, aktif, password_changed, tg_link_token, created_at)
SELECT 'hamimuddin92@gmail.com', '$2b$10$we/eZKSSRigS5a8P0BHpqeZCJUP/ZPmDssI8XcsNw2d9PsEsDSWvK', 'Pengadil', 5, 5, 'MUHAMAD HAMIMUDDIN BIN ISMAIL', '921111065947', '0163689650', 'LELAKI', 'Kelas III FAM', 'NO 125, FELDA SUNGAI PANCHING UTARA 26250, KUANTAN PAHANG', 'Kuantan', 'Pahang', 'BEKERJA', 'KERANI', 'MAJLIS AMANAH RAKYAT', 'PEJABAT MARA NEGERI PAHANG, TINGKAT 3, PLAZA GAMBUT, JALAN GAMBUT, 25000, KUANTAN PAHANG', 'SURAIZA BINTI AWANG', 'ISTERI', '0139714384', 34, 1, 0, 'f75d0e21d5b828ce54b24f748ed67e39', NOW()
WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE no_ic = @ic OR email = @em);
INSERT INTO `permohonan` (user_id, district_id, persatuan_id, tahun_permohonan, jenis_permohonan, jenis_borang, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, persatuan_daerah, alamat1, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, url_resit, status, status_workflow, mohon_ujian_bertulis, payment_amount, umur, declare1, declare2, declare3, tarikh_hantar)
SELECT u.id, 5, 5, 2026, 'kelas3_fam', 'kelas3_fam', 'MUHAMAD HAMIMUDDIN BIN ISMAIL', '921111065947', 'hamimuddin92@gmail.com', '0163689650', 'LELAKI', 'Kelas III FAM', 'Persatuan Bolasepak Daerah Kuantan', 'NO 125, FELDA SUNGAI PANCHING UTARA 26250, KUANTAN PAHANG', 'Kuantan', 'Pahang', 'BEKERJA', 'KERANI', 'MAJLIS AMANAH RAKYAT', 'PEJABAT MARA NEGERI PAHANG, TINGKAT 3, PLAZA GAMBUT, JALAN GAMBUT, 25000, KUANTAN PAHANG', 'SURAIZA BINTI AWANG', 'ISTERI', '0139714384', 'https://drive.google.com/open?id=1a0ugpWWoZjRWweMceDrFqBohpaYGgaBX', 'Pending', 'Menunggu Admin', 1, 80.00, 34, 1, 1, 1, NOW()
FROM `users` u WHERE u.no_ic = @ic
AND NOT EXISTS (SELECT 1 FROM `permohonan` WHERE no_kp = @ic AND tahun_permohonan = 2026 AND jenis_borang = 'kelas3_fam');

-- [38] MUHAMMAD AZAM BIN ISMAIL (Raub)
SET @ic = '100909030825';
SET @em = 'azimijimmy0585@gmail.com';
INSERT INTO `users` (email, password, role, district_id, persatuan_id, nama_penuh, no_ic, no_telefon, jantina, jenis_pengadil, alamat1, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, umur, aktif, password_changed, tg_link_token, created_at)
SELECT 'azimijimmy0585@gmail.com', '$2b$10$gtgGnei8ZT0W7YrI0nEjLOyVbIF2xbfvOp19X3dZ9I4pGpnO0qILO', 'Pengadil', 9, 9, 'MUHAMMAD AZAM BIN ISMAIL', '100909030825', '01137778801', 'LELAKI', 'Kelas III FAM', '7331,Perumahan Rotan Tunggal 27600 Raub,Pahang', 'Raub', 'Pahang', 'PELAJAR', 'Pelajar sekolah', 'tiada', 'tiada', 'MUHAMMAD AZIMI BIN ISMAIL', 'Abang', '01169557599', 16, 1, 0, '8e739051df099449656a1d4c3583578b', NOW()
WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE no_ic = @ic OR email = @em);
INSERT INTO `permohonan` (user_id, district_id, persatuan_id, tahun_permohonan, jenis_permohonan, jenis_borang, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, persatuan_daerah, alamat1, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, url_resit, status, status_workflow, mohon_ujian_bertulis, payment_amount, umur, declare1, declare2, declare3, tarikh_hantar)
SELECT u.id, 9, 9, 2026, 'kelas3_fam', 'kelas3_fam', 'MUHAMMAD AZAM BIN ISMAIL', '100909030825', 'azimijimmy0585@gmail.com', '01137778801', 'LELAKI', 'Kelas III FAM', 'Persatuan Bolasepak Daerah Raub', '7331,Perumahan Rotan Tunggal 27600 Raub,Pahang', 'Raub', 'Pahang', 'PELAJAR', 'Pelajar sekolah', 'tiada', 'tiada', 'MUHAMMAD AZIMI BIN ISMAIL', 'Abang', '01169557599', 'https://drive.google.com/open?id=1HHgovd8CRSRLv_wZtMu542JrGmiuGZGK', 'Pending', 'Menunggu Admin', 1, 80.00, 16, 1, 1, 1, NOW()
FROM `users` u WHERE u.no_ic = @ic
AND NOT EXISTS (SELECT 1 FROM `permohonan` WHERE no_kp = @ic AND tahun_permohonan = 2026 AND jenis_borang = 'kelas3_fam');

-- [39] AFIQ IKHWAN BIN AMRAN (Kuantan)
SET @ic = '070805110121';
SET @em = 'amranpolisas@gmail.com';
INSERT INTO `users` (email, password, role, district_id, persatuan_id, nama_penuh, no_ic, no_telefon, jantina, jenis_pengadil, alamat1, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, umur, aktif, password_changed, tg_link_token, created_at)
SELECT 'amranpolisas@gmail.com', '$2b$10$n3TqfMlwV2WmHaXy7A/EaOb6S/bCupcyalEAJdX/PT8Ft6XgCjXnu', 'Pengadil', 5, 5, 'AFIQ IKHWAN BIN AMRAN', '070805110121', '0104655161', 'LELAKI', 'Kelas III FAM', 'LOT PT 33984 LORONG KEMBOJA, KAMPUNG MAHKOTA 26070 KUANTAN', 'Kuantan', 'Pahang', 'PELAJAR', 'PELAJAR POLISAS', 'PENGARAH POLISAS', 'POLISAS SEMAMBU 25350 KUANTAN', 'AMRAN BIN MD YUNUS', 'BAPA', '0199935161', 19, 1, 0, '276be19c7ae0573ad4fbb3fb464adeff', NOW()
WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE no_ic = @ic OR email = @em);
INSERT INTO `permohonan` (user_id, district_id, persatuan_id, tahun_permohonan, jenis_permohonan, jenis_borang, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, persatuan_daerah, alamat1, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, url_resit, status, status_workflow, mohon_ujian_bertulis, payment_amount, umur, declare1, declare2, declare3, tarikh_hantar)
SELECT u.id, 5, 5, 2026, 'kelas3_fam', 'kelas3_fam', 'AFIQ IKHWAN BIN AMRAN', '070805110121', 'amranpolisas@gmail.com', '0104655161', 'LELAKI', 'Kelas III FAM', 'Persatuan Bolasepak Daerah Kuantan', 'LOT PT 33984 LORONG KEMBOJA, KAMPUNG MAHKOTA 26070 KUANTAN', 'Kuantan', 'Pahang', 'PELAJAR', 'PELAJAR POLISAS', 'PENGARAH POLISAS', 'POLISAS SEMAMBU 25350 KUANTAN', 'AMRAN BIN MD YUNUS', 'BAPA', '0199935161', 'https://drive.google.com/open?id=1PJZWUibl0N7WQToop9i_lTWZS23zSK41', 'Pending', 'Menunggu Admin', 1, 80.00, 19, 1, 1, 1, NOW()
FROM `users` u WHERE u.no_ic = @ic
AND NOT EXISTS (SELECT 1 FROM `permohonan` WHERE no_kp = @ic AND tahun_permohonan = 2026 AND jenis_borang = 'kelas3_fam');

-- [40] AHMAD KHAIROL BIN KELANA (Bera)
SET @ic = '960311135577.0';
SET @em = 'fakhruliqbalrefkel@gmail.com';
INSERT INTO `users` (email, password, role, district_id, persatuan_id, nama_penuh, no_ic, no_telefon, jantina, jenis_pengadil, alamat1, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, umur, aktif, password_changed, tg_link_token, created_at)
SELECT 'fakhruliqbalrefkel@gmail.com', '$2b$10$oEHgkv02EblUzOME1tuth.2ojWjtGyGD4G//10enysAF3EFc7c5gi', 'Pengadil', 2, 2, 'AHMAD KHAIROL BIN KELANA', '960311135577.0', '0109855537', 'LELAKI', 'Kelas III FAM', 'NO 8,JALAN KEMPAS 6,KUARTES IPD BERA,28200 BERA PAHANG', 'Bera', 'Pahang', 'BEKERJA', 'POLIS', 'PDRM', 'IBU PEJABAT POLIS DAERAH BERA', 'NUR SHAMELIA BINTI CHE ROPA', 'Isteri', '0199309467', 30, 1, 0, 'adab6996bf99200b343f66555f0fe3dc', NOW()
WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE no_ic = @ic OR email = @em);
INSERT INTO `permohonan` (user_id, district_id, persatuan_id, tahun_permohonan, jenis_permohonan, jenis_borang, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, persatuan_daerah, alamat1, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, url_resit, status, status_workflow, mohon_ujian_bertulis, payment_amount, umur, declare1, declare2, declare3, tarikh_hantar)
SELECT u.id, 2, 2, 2026, 'kelas3_fam', 'kelas3_fam', 'AHMAD KHAIROL BIN KELANA', '960311135577.0', 'fakhruliqbalrefkel@gmail.com', '0109855537', 'LELAKI', 'Kelas III FAM', 'Persatuan Bolasepak Daerah Bera', 'NO 8,JALAN KEMPAS 6,KUARTES IPD BERA,28200 BERA PAHANG', 'Bera', 'Pahang', 'BEKERJA', 'POLIS', 'PDRM', 'IBU PEJABAT POLIS DAERAH BERA', 'NUR SHAMELIA BINTI CHE ROPA', 'Isteri', '0199309467', 'https://drive.google.com/open?id=1YMb9k_16d4oUETsRrg8Bu5mSiq5hK_Fz', 'Pending', 'Menunggu Admin', 1, 80.00, 30, 1, 1, 1, NOW()
FROM `users` u WHERE u.no_ic = @ic
AND NOT EXISTS (SELECT 1 FROM `permohonan` WHERE no_kp = @ic AND tahun_permohonan = 2026 AND jenis_borang = 'kelas3_fam');

-- [41] MUHAMAD AZHARI BIN ANISUTISNA (Bentong)
SET @ic = '900317065261';
SET @em = 'aidil179082@gmail.com';
INSERT INTO `users` (email, password, role, district_id, persatuan_id, nama_penuh, no_ic, no_telefon, jantina, jenis_pengadil, alamat1, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, umur, aktif, password_changed, tg_link_token, created_at)
SELECT 'aidil179082@gmail.com', '$2b$10$MOIlAxJi84LwI1WikHrc/OVBhepkVnDSsuOdu22Z0kHrhEXZgG3Si', 'Pengadil', 1, 1, 'MUHAMAD AZHARI BIN ANISUTISNA', '900317065261', '0199654919', 'LELAKI', 'Kelas III FAM', 'M23 Jalan Mindef 2 Taman Desa Damai 28700 Bentong, Pahang.', 'Bentong', 'Pahang', 'BEKERJA', 'Tentera', 'Pegawai Memerintah', 'Kem Bentong, 28700 Bentong Pahang', 'Siti Nuraisyah binti Omar Sudi', 'Isteri', '0199656485', 36, 1, 0, '5b7f6f0f52c2014afe8baaa875179098', NOW()
WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE no_ic = @ic OR email = @em);
INSERT INTO `permohonan` (user_id, district_id, persatuan_id, tahun_permohonan, jenis_permohonan, jenis_borang, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, persatuan_daerah, alamat1, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, url_resit, status, status_workflow, mohon_ujian_bertulis, payment_amount, umur, declare1, declare2, declare3, tarikh_hantar)
SELECT u.id, 1, 1, 2026, 'kelas3_fam', 'kelas3_fam', 'MUHAMAD AZHARI BIN ANISUTISNA', '900317065261', 'aidil179082@gmail.com', '0199654919', 'LELAKI', 'Kelas III FAM', 'Persatuan Bolasepak Daerah Bentong', 'M23 Jalan Mindef 2 Taman Desa Damai 28700 Bentong, Pahang.', 'Bentong', 'Pahang', 'BEKERJA', 'Tentera', 'Pegawai Memerintah', 'Kem Bentong, 28700 Bentong Pahang', 'Siti Nuraisyah binti Omar Sudi', 'Isteri', '0199656485', 'https://drive.google.com/open?id=1jjT1xh3QekmjOQJPIWfH31OcRVV1g2hN', 'Pending', 'Menunggu Admin', 1, 80.00, 36, 1, 1, 1, NOW()
FROM `users` u WHERE u.no_ic = @ic
AND NOT EXISTS (SELECT 1 FROM `permohonan` WHERE no_kp = @ic AND tahun_permohonan = 2026 AND jenis_borang = 'kelas3_fam');

-- [42] MUHAMMAD TOHIR BIN KHAIRUDDIN (Kuantan)
SET @ic = '921008065623.0';
SET @em = 'muhdtohir1992@gmail.com';
INSERT INTO `users` (email, password, role, district_id, persatuan_id, nama_penuh, no_ic, no_telefon, jantina, jenis_pengadil, alamat1, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, umur, aktif, password_changed, tg_link_token, created_at)
SELECT 'muhdtohir1992@gmail.com', '$2b$10$3E/IGt5tgkKedYxNfbf0R./2UyaCaxvRZ6k.kET32krxaFfPjaK0m', 'Pengadil', 5, 5, 'MUHAMMAD TOHIR BIN KHAIRUDDIN', '921008065623.0', '01125645673', 'LELAKI', 'Kelas III FAM', 'Du 44-B JALAN ABDUL RASHID, KAMPUNG JAYA GADING,26070, KUANTAN,PAHANG', 'Kuantan', 'Pahang', 'BEKERJA', 'Penyelia operasi', 'FELDA', 'LOT 1863 KAWASAN PERUSAHAAN PELABUHAN KUANTAN, JALAN KEMAMAN,PELABUHAN KUANTAN,26080,KUANTAN,PAHANG', 'NURUL ATIQAH BINTI MOHD HASNI', 'ISTERI', '0198756865', 34, 1, 0, '50fe155540950733956a7b13ede6a9b8', NOW()
WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE no_ic = @ic OR email = @em);
INSERT INTO `permohonan` (user_id, district_id, persatuan_id, tahun_permohonan, jenis_permohonan, jenis_borang, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, persatuan_daerah, alamat1, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, url_resit, status, status_workflow, mohon_ujian_bertulis, payment_amount, umur, declare1, declare2, declare3, tarikh_hantar)
SELECT u.id, 5, 5, 2026, 'kelas3_fam', 'kelas3_fam', 'MUHAMMAD TOHIR BIN KHAIRUDDIN', '921008065623.0', 'muhdtohir1992@gmail.com', '01125645673', 'LELAKI', 'Kelas III FAM', 'Persatuan Bolasepak Daerah Kuantan', 'Du 44-B JALAN ABDUL RASHID, KAMPUNG JAYA GADING,26070, KUANTAN,PAHANG', 'Kuantan', 'Pahang', 'BEKERJA', 'Penyelia operasi', 'FELDA', 'LOT 1863 KAWASAN PERUSAHAAN PELABUHAN KUANTAN, JALAN KEMAMAN,PELABUHAN KUANTAN,26080,KUANTAN,PAHANG', 'NURUL ATIQAH BINTI MOHD HASNI', 'ISTERI', '0198756865', 'https://drive.google.com/open?id=1w4V3QYPHMEPDnOGsx4JX0JIZhSP2xjji', 'Pending', 'Menunggu Admin', 1, 80.00, 34, 1, 1, 1, NOW()
FROM `users` u WHERE u.no_ic = @ic
AND NOT EXISTS (SELECT 1 FROM `permohonan` WHERE no_kp = @ic AND tahun_permohonan = 2026 AND jenis_borang = 'kelas3_fam');

COMMIT;

-- Semak selepas import:
-- SELECT u.id, u.nama_penuh, u.email, u.daerah, p.status_workflow, p.status_ujian
-- FROM users u JOIN permohonan p ON p.user_id = u.id
-- WHERE p.jenis_borang = 'kelas3_fam' AND p.tahun_permohonan = 2026
-- ORDER BY u.daerah, u.nama_penuh;