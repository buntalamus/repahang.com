-- ================================================================
-- FIX: INSERT permohonan kelas3_fam 2026 (users sudah wujud)
-- Jalankan sekali sahaja di phpMyAdmin
-- ================================================================

-- Betulkan IC dengan .0 dalam users dulu
UPDATE `users` SET no_ic = REGEXP_REPLACE(no_ic, '\\.0$', '') WHERE no_ic REGEXP '\\.0$';

START TRANSACTION;

-- [1] MUHAMMAD AHZA BIN AZLAN
INSERT INTO `permohonan` (user_id, district_id, persatuan_id, tahun_permohonan, jenis_permohonan, jenis_borang, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, persatuan_daerah, alamat1, alamat2, poskod, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, url_resit, status, status_workflow, mohon_ujian_bertulis, payment_amount, umur, declare1, declare2, declare3, tarikh_hantar)
SELECT u.id, 4, 4, 2026, 'kelas3_fam', 'kelas3_fam', 'MUHAMMAD AHZA BIN AZLAN', '030426080579', 'ahzaazlan2003@gmail.com', '0197766935', 'LELAKI', 'Kelas III FAM', 'Persatuan Bolasepak Daerah Jerantut', 'E2 RUMAH KAKITANGAN FELDA LEPAR UTARA 2/4 , 26400 BANDAR JENGKA PAHANG', '', '', 'Jerantut', 'Pahang', 'BEKERJA', 'PEMBANTU HAL EHWAL ISLAM FELDA', 'FELDA', 'PEJABAT FELDA LEPAR UTARA 2/4', 'HANISEZATUL HUSNA BINTI HAMAD', 'ISTERI', '0179470612', 'https://drive.google.com/open?id=1n4FbMe6V6WIR45T1-XFHBvSyN7uhqRH4', 'Pending', 'Menunggu Admin', 1, 80.00, 23, 1, 1, 1, NOW()
FROM `users` u
WHERE u.email = 'ahzaazlan2003@gmail.com'
AND NOT EXISTS (SELECT 1 FROM `permohonan` WHERE emel = 'ahzaazlan2003@gmail.com' AND tahun_permohonan = 2026 AND jenis_borang = 'kelas3_fam');

-- [2] ROSDI BIN ABDULLAH
INSERT INTO `permohonan` (user_id, district_id, persatuan_id, tahun_permohonan, jenis_permohonan, jenis_borang, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, persatuan_daerah, alamat1, alamat2, poskod, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, url_resit, status, status_workflow, mohon_ujian_bertulis, payment_amount, umur, declare1, declare2, declare3, tarikh_hantar)
SELECT u.id, 2, 2, 2026, 'kelas3_fam', 'kelas3_fam', 'ROSDI BIN ABDULLAH', '800524035253', 'rosdi5225@gmail.com', '0122300519', 'LELAKI', 'Kelas III FAM', 'Persatuan Bolasepak Daerah Bera', 'A-1-4 KIP. SK. KERAYONG , KG.PADANG LUAS, 28200 BANDAR BERA, BERA, PAHANG', '', '', 'Bera', 'Pahang', 'BEKERJA', 'PENOLONG JURUTERA', 'JURUTERA DAERAH', 'JKR DAERAH BERA, KOMPLEKS KERAJAAN DAERAH BERA, 28200 BANDAR BERA', 'SRI JUNITA BT MOHAMED', 'ISTERI', '0103839232', 'https://drive.google.com/open?id=1FXMpVBTIWpHWkBXR7XjdOkD_I9gfOAUb', 'Pending', 'Menunggu Admin', 1, 80.00, 46, 1, 1, 1, NOW()
FROM `users` u
WHERE u.email = 'rosdi5225@gmail.com'
AND NOT EXISTS (SELECT 1 FROM `permohonan` WHERE emel = 'rosdi5225@gmail.com' AND tahun_permohonan = 2026 AND jenis_borang = 'kelas3_fam');

-- [3] MOHD FAISAL KAMIL BIN MOHD ADNAN
INSERT INTO `permohonan` (user_id, district_id, persatuan_id, tahun_permohonan, jenis_permohonan, jenis_borang, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, persatuan_daerah, alamat1, alamat2, poskod, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, url_resit, status, status_workflow, mohon_ujian_bertulis, payment_amount, umur, declare1, declare2, declare3, tarikh_hantar)
SELECT u.id, 7, 7, 2026, 'kelas3_fam', 'kelas3_fam', 'MOHD FAISAL KAMIL BIN MOHD ADNAN', '090417060669', 'abdullahayue01@gmail.com', '01114275710', 'LELAKI', 'Kelas III FAM', 'Persatuan Bolasepak Daerah Maran', '119 FELDA SERI DAHLIA JENGKA 3,26400 BANDAR JENGKA PAHANG', '', '', 'Maran', 'Pahang', 'PELAJAR', 'PELAJAR', 'GURU BESAR', '-', 'MOHD ADNAN BIN AB GHANI', 'BAPA', '0179842955', 'https://drive.google.com/open?id=1JTi63speNR6N8egWmTif3DcELoFb8J1I', 'Pending', 'Menunggu Admin', 1, 80.00, 16, 1, 1, 1, NOW()
FROM `users` u
WHERE u.email = 'abdullahayue01@gmail.com'
AND NOT EXISTS (SELECT 1 FROM `permohonan` WHERE emel = 'abdullahayue01@gmail.com' AND tahun_permohonan = 2026 AND jenis_borang = 'kelas3_fam');

-- [4] MOHAMAD NAZMI FIRDAUS BIN HASSAN
INSERT INTO `permohonan` (user_id, district_id, persatuan_id, tahun_permohonan, jenis_permohonan, jenis_borang, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, persatuan_daerah, alamat1, alamat2, poskod, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, url_resit, status, status_workflow, mohon_ujian_bertulis, payment_amount, umur, declare1, declare2, declare3, tarikh_hantar)
SELECT u.id, 2, 2, 2026, 'kelas3_fam', 'kelas3_fam', 'MOHAMAD NAZMI FIRDAUS BIN HASSAN', '921201065561', 'mnazmifirdaus@gmail.com', '0132402515', 'LELAKI', 'Kelas III FAM', 'Persatuan Bolasepak Daerah Bera', 'L4 felda kg awah, 28030 Temerloh, Pahang', '', '', 'Bera', 'Pahang', 'BEKERJA', 'JURUTEKNIK', 'PEGAWAI DAERAH BERA', 'PEJABAT DAERAH DAN TANAH BERA, 28200 BANDAR BERA, PAHANG DARUL MAKMUR', 'KHAIRUNISA LIYANA BINTI SAMSUDIN', 'ISTERI', '0179562087', 'https://drive.google.com/open?id=1FLETBXGSt2genwq1UrFVYUCxN5VzWAdr', 'Pending', 'Menunggu Admin', 1, 80.00, 34, 1, 1, 1, NOW()
FROM `users` u
WHERE u.email = 'mnazmifirdaus@gmail.com'
AND NOT EXISTS (SELECT 1 FROM `permohonan` WHERE emel = 'mnazmifirdaus@gmail.com' AND tahun_permohonan = 2026 AND jenis_borang = 'kelas3_fam');

-- [5] NUR HAFIZAN BIN MOHAMMAD NOR
INSERT INTO `permohonan` (user_id, district_id, persatuan_id, tahun_permohonan, jenis_permohonan, jenis_borang, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, persatuan_daerah, alamat1, alamat2, poskod, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, url_resit, status, status_workflow, mohon_ujian_bertulis, payment_amount, umur, declare1, declare2, declare3, tarikh_hantar)
SELECT u.id, 5, 5, 2026, 'kelas3_fam', 'kelas3_fam', 'NUR HAFIZAN BIN MOHAMMAD NOR', '950815065091', 'pijang95@gmail.com', '0139621423', 'LELAKI', 'Kelas III FAM', 'Persatuan Bolasepak Daerah Kuantan', 'NO 111, LORONG LENGKOK KANAN 5, TANAH PUTIH BARU 25150, KUANTAN PAHANG', '', '', 'Kuantan', 'Pahang', 'BEKERJA', 'PEMBANTU KHIDMAT AM', 'PENGARAH', 'MAJLIS BANDARAYA KUANTAN, JALAN TANAH PUTIH 25100, KUANTAN PAHANG', 'MOHAMMAD NOR BIN MUSTAPHA', 'Bapa', '0169322448', 'https://drive.google.com/open?id=1RDj6-ACfidk1Ae2JBgpJ2reyeVO4u8qr', 'Pending', 'Menunggu Admin', 1, 80.00, 31, 1, 1, 1, NOW()
FROM `users` u
WHERE u.email = 'pijang95@gmail.com'
AND NOT EXISTS (SELECT 1 FROM `permohonan` WHERE emel = 'pijang95@gmail.com' AND tahun_permohonan = 2026 AND jenis_borang = 'kelas3_fam');

-- [6] MOHAMAD FAIZ BIN MAT RIFIN
INSERT INTO `permohonan` (user_id, district_id, persatuan_id, tahun_permohonan, jenis_permohonan, jenis_borang, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, persatuan_daerah, alamat1, alamat2, poskod, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, url_resit, status, status_workflow, mohon_ujian_bertulis, payment_amount, umur, declare1, declare2, declare3, tarikh_hantar)
SELECT u.id, 5, 5, 2026, 'kelas3_fam', 'kelas3_fam', 'MOHAMAD FAIZ BIN MAT RIFIN', '930318035053', 'fareast18393@gmail.com', '01121333453', 'LELAKI', 'Kelas III FAM', 'Persatuan Bolasepak Daerah Kuantan', 'G8-4-4 KUARTERS TENTERA KEM BATU 10,JALAN SG PANCHING 26010 KUANTAN PAHANG', '', '', 'Kuantan', 'Pahang', 'BEKERJA', 'TENTERA', 'MEJ BAMBANG ADI SUMANTRI BIN BOMBANG SUKOCHO', 'KOMPENI BANTUAN 12 RAMD(MEK) KEM BATU 10 25990 KUANTAN PAHANG', 'NUR FASLIANA BINTI OTHMAN', 'ISTERI', '0172428027', 'https://drive.google.com/open?id=1RF01rBvpeYEJv6Af7YVwjyN7M667pzsL', 'Pending', 'Menunggu Admin', 1, 80.00, 33, 1, 1, 1, NOW()
FROM `users` u
WHERE u.email = 'fareast18393@gmail.com'
AND NOT EXISTS (SELECT 1 FROM `permohonan` WHERE emel = 'fareast18393@gmail.com' AND tahun_permohonan = 2026 AND jenis_borang = 'kelas3_fam');

-- [7] MUHAMMAD ALIFF IKRAM BIN MUHAMAD
INSERT INTO `permohonan` (user_id, district_id, persatuan_id, tahun_permohonan, jenis_permohonan, jenis_borang, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, persatuan_daerah, alamat1, alamat2, poskod, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, url_resit, status, status_workflow, mohon_ujian_bertulis, payment_amount, umur, declare1, declare2, declare3, tarikh_hantar)
SELECT u.id, 5, 5, 2026, 'kelas3_fam', 'kelas3_fam', 'MUHAMMAD ALIFF IKRAM BIN MUHAMAD', '990203065505', 'aliffikram26@gmail.com', '0107680339', 'LELAKI', 'Kelas III FAM', 'Persatuan Bolasepak Daerah Kuantan', 'NO 13 LORONG BUKIT SETONGKOL MAJU 47 25200 KUANTAN PAHANG', '', '', 'Kuantan', 'Pahang', 'BEKERJA', 'MEKANIK', 'Azizul', 'KOMPLEK LKIM KUANTAN, JALAN SRI KEMUNTING 2 , 25100 KUANTAN PAHANG', 'zulkhairey', 'Abang', '0189424229', 'https://drive.google.com/open?id=1JPHSDSkXGnD_d7tujNlIS2KSUnVnwPXF', 'Pending', 'Menunggu Admin', 1, 80.00, 27, 1, 1, 1, NOW()
FROM `users` u
WHERE u.email = 'aliffikram26@gmail.com'
AND NOT EXISTS (SELECT 1 FROM `permohonan` WHERE emel = 'aliffikram26@gmail.com' AND tahun_permohonan = 2026 AND jenis_borang = 'kelas3_fam');

-- [8] AMIR ASRAF BIN MAZUKI
INSERT INTO `permohonan` (user_id, district_id, persatuan_id, tahun_permohonan, jenis_permohonan, jenis_borang, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, persatuan_daerah, alamat1, alamat2, poskod, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, url_resit, status, status_workflow, mohon_ujian_bertulis, payment_amount, umur, declare1, declare2, declare3, tarikh_hantar)
SELECT u.id, 2, 2, 2026, 'kelas3_fam', 'kelas3_fam', 'AMIR ASRAF BIN MAZUKI', '930815065173', 'amir.acap.93@gmail.com', '0179188651', 'LELAKI', 'Kelas III FAM', 'Persatuan Bolasepak Daerah Bera', 'NO 1 JALAN JERNA INDAH 3 TAMAN JERNA INDAH 28200 BERA PAHANG', '', '', 'Bera', 'Pahang', 'BEKERJA', 'TEKNIKAL INSPECTOR', 'ROADCARE SDN BHD', '14, Jalan Sudirman 5, 14, Jalan sudirman 5, Bandar Sri Semantan, 28000 Temerloh, Pahang', 'NADHIRAH HUSNA BT MOHD SHAARI', 'ISTERI', '0199712803', 'https://drive.google.com/open?id=1LcdbbGrg-svU5yhI2wch6fGr5HmJW78O', 'Pending', 'Menunggu Admin', 1, 80.00, 33, 1, 1, 1, NOW()
FROM `users` u
WHERE u.email = 'amir.acap.93@gmail.com'
AND NOT EXISTS (SELECT 1 FROM `permohonan` WHERE emel = 'amir.acap.93@gmail.com' AND tahun_permohonan = 2026 AND jenis_borang = 'kelas3_fam');

-- [9] MUHAMMAD AKMAL BIN ZAILAN
INSERT INTO `permohonan` (user_id, district_id, persatuan_id, tahun_permohonan, jenis_permohonan, jenis_borang, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, persatuan_daerah, alamat1, alamat2, poskod, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, url_resit, status, status_workflow, mohon_ujian_bertulis, payment_amount, umur, declare1, declare2, declare3, tarikh_hantar)
SELECT u.id, 2, 2, 2026, 'kelas3_fam', 'kelas3_fam', 'MUHAMMAD AKMAL BIN ZAILAN', '021114030631', 'akmalzailan151@gmail.com', '01136537980', 'LELAKI', 'Kelas III FAM', 'Persatuan Bolasepak Daerah Bera', 'NO 10 JALAN JATI 5 TAMAN JATI BERA PAHANG', '', '', 'Bera', 'Pahang', 'BEKERJA', 'GURU', 'GURU BESAR', 'SK KERAYONG BERA 28200 PAHANG', 'ZAILAN BIN MOHAMAD', 'BAPA', '0129006740', 'https://drive.google.com/open?id=1waUIVn0OfkCH0z5CYVJQA8lGCC95h3KV', 'Pending', 'Menunggu Admin', 1, 80.00, 24, 1, 1, 1, NOW()
FROM `users` u
WHERE u.email = 'akmalzailan151@gmail.com'
AND NOT EXISTS (SELECT 1 FROM `permohonan` WHERE emel = 'akmalzailan151@gmail.com' AND tahun_permohonan = 2026 AND jenis_borang = 'kelas3_fam');

-- [10] NOR HAFIZ AKMAL BIN RAZAK
INSERT INTO `permohonan` (user_id, district_id, persatuan_id, tahun_permohonan, jenis_permohonan, jenis_borang, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, persatuan_daerah, alamat1, alamat2, poskod, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, url_resit, status, status_workflow, mohon_ujian_bertulis, payment_amount, umur, declare1, declare2, declare3, tarikh_hantar)
SELECT u.id, 5, 5, 2026, 'kelas3_fam', 'kelas3_fam', 'NOR HAFIZ AKMAL BIN RAZAK', '930518065855', 'hafiz5855@gmail.com', '0196453694', 'LELAKI', 'Kelas III FAM', 'Persatuan Bolasepak Daerah Kuantan', 'No 16 Lorong 19 Taman Seri Mahkota Aman 26070 Kuantan Pahang', '', '', 'Kuantan', 'Pahang', 'BEKERJA', 'Guru', 'EN SAFRUL KAMALIZAM BIN SAFAR', 'SK SUNGAI ISAP MURNI', 'NOR SYAHIRAH BINTI NORDIN', 'ISTERI', '01111993068', 'https://drive.google.com/open?id=14do1zFR0iCq0tOSC2aIe_f03yyoWvnPR', 'Pending', 'Menunggu Admin', 1, 80.00, 33, 1, 1, 1, NOW()
FROM `users` u
WHERE u.email = 'hafiz5855@gmail.com'
AND NOT EXISTS (SELECT 1 FROM `permohonan` WHERE emel = 'hafiz5855@gmail.com' AND tahun_permohonan = 2026 AND jenis_borang = 'kelas3_fam');

-- [11] MOHD AMIRUL ADLI BIN AHMAD ZAKI
INSERT INTO `permohonan` (user_id, district_id, persatuan_id, tahun_permohonan, jenis_permohonan, jenis_borang, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, persatuan_daerah, alamat1, alamat2, poskod, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, url_resit, status, status_workflow, mohon_ujian_bertulis, payment_amount, umur, declare1, declare2, declare3, tarikh_hantar)
SELECT u.id, 5, 5, 2026, 'kelas3_fam', 'kelas3_fam', 'MOHD AMIRUL ADLI BIN AHMAD ZAKI', '940902035289', 'amiruladli29@gmail.com', '0145168159', 'LELAKI', 'Kelas III FAM', 'Persatuan Bolasepak Daerah Kuantan', 'NO20 LORONG 9 TAMAN SERI DAMAI SEJAHTERA 25150 KUANTAN PAHANG', '', '', 'Kuantan', 'Pahang', 'BEKERJA', 'GURU', 'PENGETUA', 'SMK PAYA BESAR KM 7 JALAN GAMBANG 25150 KUANTAN PAHANG', 'NASIBAH BINTI HASSAN', 'ISTERI', '0129836367', 'https://drive.google.com/open?id=1uk8Fdjj38FvV8ZsaDRlEz3Z0RIIMKdLl', 'Pending', 'Menunggu Admin', 1, 80.00, 32, 1, 1, 1, NOW()
FROM `users` u
WHERE u.email = 'amiruladli29@gmail.com'
AND NOT EXISTS (SELECT 1 FROM `permohonan` WHERE emel = 'amiruladli29@gmail.com' AND tahun_permohonan = 2026 AND jenis_borang = 'kelas3_fam');

-- [12] ALIFF HARIZ BIN AMRAN
INSERT INTO `permohonan` (user_id, district_id, persatuan_id, tahun_permohonan, jenis_permohonan, jenis_borang, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, persatuan_daerah, alamat1, alamat2, poskod, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, url_resit, status, status_workflow, mohon_ujian_bertulis, payment_amount, umur, declare1, declare2, declare3, tarikh_hantar)
SELECT u.id, 6, 6, 2026, 'kelas3_fam', 'kelas3_fam', 'ALIFF HARIZ BIN AMRAN', '090102060541', 'entahlarh954@gmail.com', '01125428399', 'LELAKI', 'Kelas III FAM', 'Persatuan Bolasepak Daerah Lipis', 'no62 lorong bbkl 2/4/2 bandar baru kuala lipis pahang 27200', '', '', 'Lipis', 'Pahang', 'PELAJAR', 'PELAJAR', 'pelajar', 'SML CLIFFORD', 'AMRAN BIN MOHAMED YUNOS', 'BAPA', '0129811072', 'https://drive.google.com/open?id=1tyZELxRT8k53Q2J9UEZeAMO84ZteqLgK', 'Pending', 'Menunggu Admin', 1, 80.00, 17, 1, 1, 1, NOW()
FROM `users` u
WHERE u.email = 'entahlarh954@gmail.com'
AND NOT EXISTS (SELECT 1 FROM `permohonan` WHERE emel = 'entahlarh954@gmail.com' AND tahun_permohonan = 2026 AND jenis_borang = 'kelas3_fam');

-- [13] MOHD AZIZI BIN KAMARUDIN
INSERT INTO `permohonan` (user_id, district_id, persatuan_id, tahun_permohonan, jenis_permohonan, jenis_borang, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, persatuan_daerah, alamat1, alamat2, poskod, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, url_resit, status, status_workflow, mohon_ujian_bertulis, payment_amount, umur, declare1, declare2, declare3, tarikh_hantar)
SELECT u.id, 5, 5, 2026, 'kelas3_fam', 'kelas3_fam', 'MOHD AZIZI BIN KAMARUDIN', '950510115537', 'haidilarezz@gmail.com', '0149176641', 'LELAKI', 'Kelas III FAM', 'Persatuan Bolasepak Daerah Kuantan', 'NO 50 LORONG BALUK BARU 1/5, PERUMAHAN BALUK BARU 26100 KUANTAN PAHANG', '', '', 'Kuantan', 'Pahang', 'BEKERJA', 'GENERAL PURPOSE', 'TM GLOBAL', 'PELABUHAN KUANTAN', 'SITI HASNA HUSNA BIN AZMAN', 'ISTERI', '01121834951', 'https://drive.google.com/open?id=1CfYJlYRPXwPgNWbdU8OHSx5NQs1eYlDS', 'Pending', 'Menunggu Admin', 1, 80.00, 31, 1, 1, 1, NOW()
FROM `users` u
WHERE u.email = 'haidilarezz@gmail.com'
AND NOT EXISTS (SELECT 1 FROM `permohonan` WHERE emel = 'haidilarezz@gmail.com' AND tahun_permohonan = 2026 AND jenis_borang = 'kelas3_fam');

-- [14] RIDUAN BIN AWANG
INSERT INTO `permohonan` (user_id, district_id, persatuan_id, tahun_permohonan, jenis_permohonan, jenis_borang, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, persatuan_daerah, alamat1, alamat2, poskod, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, url_resit, status, status_workflow, mohon_ujian_bertulis, payment_amount, umur, declare1, declare2, declare3, tarikh_hantar)
SELECT u.id, 12, 12, 2026, 'kelas3_fam', 'kelas3_fam', 'RIDUAN BIN AWANG', '820729105725', 'riduankatak123@gmail.com', '0196321982', 'LELAKI', 'Kelas III FAM', 'Persatuan Bolasepak Daerah Muadzam Shah', 'U57 RPS Bukit serok 26900 Bandar tun Abdul Razak Pahang', '', '', 'Muadzam Shah', 'Pahang', 'Sendiri', 'Sediri', 'Sendiri', 'Tiada', 'Aslin BT apas', 'Isteri', '0135258414', 'https://drive.google.com/open?id=15__xbWGHG1RKuG-rauolBEZqZrNNIfZH', 'Pending', 'Menunggu Admin', 1, 80.00, 44, 1, 1, 1, NOW()
FROM `users` u
WHERE u.email = 'riduankatak123@gmail.com'
AND NOT EXISTS (SELECT 1 FROM `permohonan` WHERE emel = 'riduankatak123@gmail.com' AND tahun_permohonan = 2026 AND jenis_borang = 'kelas3_fam');

-- [15] MUHAMMAD ADLI B. SAMSUDIN
INSERT INTO `permohonan` (user_id, district_id, persatuan_id, tahun_permohonan, jenis_permohonan, jenis_borang, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, persatuan_daerah, alamat1, alamat2, poskod, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, url_resit, status, status_workflow, mohon_ujian_bertulis, payment_amount, umur, declare1, declare2, declare3, tarikh_hantar)
SELECT u.id, 7, 7, 2026, 'kelas3_fam', 'kelas3_fam', 'MUHAMMAD ADLI B. SAMSUDIN', '010914060499', 'adli.samsudin06@gmail.com', '01139140375', 'LELAKI', 'Kelas III FAM', 'Persatuan Bolasepak Daerah Maran', 'NO 431, BLOK 17, FELDA JENGKA 20, 26400 BANDAR JENGKA, PAHANG', '', '', 'Maran', 'Pahang', 'PELAJAR', '-', '-', '-', 'AHMAD KAMAL B. SAMSUDIN', 'ABANG', '0179575085', 'https://drive.google.com/open?id=1xP4qmWAU0mhZGzLL-irCslxF-dycRTa9', 'Pending', 'Menunggu Admin', 1, 80.00, 25, 1, 1, 1, NOW()
FROM `users` u
WHERE u.email = 'adli.samsudin06@gmail.com'
AND NOT EXISTS (SELECT 1 FROM `permohonan` WHERE emel = 'adli.samsudin06@gmail.com' AND tahun_permohonan = 2026 AND jenis_borang = 'kelas3_fam');

-- [16] MUHAMMAD RAZARIZAL BIN MOHAMMAD SAFIAN
INSERT INTO `permohonan` (user_id, district_id, persatuan_id, tahun_permohonan, jenis_permohonan, jenis_borang, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, persatuan_daerah, alamat1, alamat2, poskod, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, url_resit, status, status_workflow, mohon_ujian_bertulis, payment_amount, umur, declare1, declare2, declare3, tarikh_hantar)
SELECT u.id, 8, 8, 2026, 'kelas3_fam', 'kelas3_fam', 'MUHAMMAD RAZARIZAL BIN MOHAMMAD SAFIAN', '970430065865', 'razarizalsafian97@gmail.com', '0175764239', 'LELAKI', 'Kelas III FAM', 'Persatuan Bolasepak Daerah Pekan', 'NO149 LORONG 4/1 TAMAN PERDANA 26600, PEKAN , PAHANG', '', '', 'Pekan', 'Pahang', 'BEKERJA', 'JURUTEKNIK', 'CHARGEMAN', 'KUANTAN PAHANG', 'NOR ASYIKIN BINTI AZHAR', 'ISTERI', '0165775413', 'https://drive.google.com/open?id=1Iu6w3yDqENFaiqIGZghbV-_rm2EUX8G-', 'Pending', 'Menunggu Admin', 1, 80.00, 29, 1, 1, 1, NOW()
FROM `users` u
WHERE u.email = 'razarizalsafian97@gmail.com'
AND NOT EXISTS (SELECT 1 FROM `permohonan` WHERE emel = 'razarizalsafian97@gmail.com' AND tahun_permohonan = 2026 AND jenis_borang = 'kelas3_fam');

-- [17] TI BIN YOK TAK
INSERT INTO `permohonan` (user_id, district_id, persatuan_id, tahun_permohonan, jenis_permohonan, jenis_borang, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, persatuan_daerah, alamat1, alamat2, poskod, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, url_resit, status, status_workflow, mohon_ujian_bertulis, payment_amount, umur, declare1, declare2, declare3, tarikh_hantar)
SELECT u.id, 6, 6, 2026, 'kelas3_fam', 'kelas3_fam', 'TI BIN YOK TAK', '911117065535', 'tibinyoktak@gmail.com', '0149064423', 'LELAKI', 'Kelas III FAM', 'Persatuan Bolasepak Daerah Lipis', 'KAMPUNG KUALA TUAL,RPS BETAU,27200,KUALA LIPIS,PAHANG', '', '', 'Lipis', 'Pahang', 'BEKERJA', 'Pekerja am', 'ONG WHEE KONG', 'No.107,Perniagaan Kenong,27200,Kuala Lipis,Pahang.', 'ZURINI A/P YOK TAK', 'KAKAK', '0194568370', 'https://drive.google.com/open?id=1QPu_3QjcKf9SuPRaxwAHcFqtzNuqmteR', 'Pending', 'Menunggu Admin', 1, 80.00, 35, 1, 1, 1, NOW()
FROM `users` u
WHERE u.email = 'tibinyoktak@gmail.com'
AND NOT EXISTS (SELECT 1 FROM `permohonan` WHERE emel = 'tibinyoktak@gmail.com' AND tahun_permohonan = 2026 AND jenis_borang = 'kelas3_fam');

-- [18] SYED ABDUL YUSUF BIN SYED JALILUDDIN
INSERT INTO `permohonan` (user_id, district_id, persatuan_id, tahun_permohonan, jenis_permohonan, jenis_borang, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, persatuan_daerah, alamat1, alamat2, poskod, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, url_resit, status, status_workflow, mohon_ujian_bertulis, payment_amount, umur, declare1, declare2, declare3, tarikh_hantar)
SELECT u.id, 7, 7, 2026, 'kelas3_fam', 'kelas3_fam', 'SYED ABDUL YUSUF BIN SYED JALILUDDIN', '090422060153', 'izzatiezamzuri2@gmail.com', '01133195636', 'LELAKI', 'Kelas III FAM', 'Persatuan Bolasepak Daerah Maran', 'NO 115 BLOK 6 ,FELDA JENGKA 13,26420 BANDAR PUSAT PAHANG', '', '', 'Maran', 'Pahang', 'PELAJAR', 'PELAJAR', 'PELAJAR', 'SMK JENGKA 12', 'SHARIFAH NORLAILA BINTI SYED MAHMUD', 'IBU', '01133195636', 'https://drive.google.com/open?id=1ExPk3-PizqY4MxT4x_I931K4FXPu5gAe', 'Pending', 'Menunggu Admin', 1, 80.00, 17, 1, 1, 1, NOW()
FROM `users` u
WHERE u.email = 'izzatiezamzuri2@gmail.com'
AND NOT EXISTS (SELECT 1 FROM `permohonan` WHERE emel = 'izzatiezamzuri2@gmail.com' AND tahun_permohonan = 2026 AND jenis_borang = 'kelas3_fam');

-- [19] MUHAMMAD HAFIZI BIN MOHD SALLEH
INSERT INTO `permohonan` (user_id, district_id, persatuan_id, tahun_permohonan, jenis_permohonan, jenis_borang, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, persatuan_daerah, alamat1, alamat2, poskod, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, url_resit, status, status_workflow, mohon_ujian_bertulis, payment_amount, umur, declare1, declare2, declare3, tarikh_hantar)
SELECT u.id, 1, 1, 2026, 'kelas3_fam', 'kelas3_fam', 'MUHAMMAD HAFIZI BIN MOHD SALLEH', '980217145929', 'hafiziesalleh98@gmail.com', '0182358110', 'LELAKI', 'Kelas III FAM', 'Persatuan Bolasepak Daerah Bentong', 'No. 203 Jalan Harmoni 8, Taman Harmoni 28700 Bentong Pahang', '', '', 'Bentong', 'Pahang', 'BEKERJA', 'GURU', 'GURU BESAR', 'SK SULAIMAN, BENTONG pahang', 'NORLISA SYUAIBAH BINTI SANIT', 'ISTERI', '0189540650', 'https://drive.google.com/open?id=1F6WM3jLCQInuoD8jZ4lEGZOnEs2B38_1', 'Pending', 'Menunggu Admin', 1, 80.00, 28, 1, 1, 1, NOW()
FROM `users` u
WHERE u.email = 'hafiziesalleh98@gmail.com'
AND NOT EXISTS (SELECT 1 FROM `permohonan` WHERE emel = 'hafiziesalleh98@gmail.com' AND tahun_permohonan = 2026 AND jenis_borang = 'kelas3_fam');

-- [20] AHMAD IQBAL RIEZKY BIN AHMAD NOR SHAHID
INSERT INTO `permohonan` (user_id, district_id, persatuan_id, tahun_permohonan, jenis_permohonan, jenis_borang, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, persatuan_daerah, alamat1, alamat2, poskod, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, url_resit, status, status_workflow, mohon_ujian_bertulis, payment_amount, umur, declare1, declare2, declare3, tarikh_hantar)
SELECT u.id, 11, 11, 2026, 'kelas3_fam', 'kelas3_fam', 'AHMAD IQBAL RIEZKY BIN AHMAD NOR SHAHID', '091011060217', 'iriezky602@gmail.com', '0198600314', 'LELAKI', 'Kelas III FAM', 'Persatuan Bolasepak Daerah Temerloh', 'NO 13 JALAN PAYA TARAM 2 TAMAN PAYA TARAM KERDAU 28010 TEMERLOH PAHANG', '', '', 'Temerloh', 'Pahang', 'PELAJAR', 'Pelajar Biasa', 'ZURAIDAH BINTI AWALUDDIN', 'SMK KERDAU', 'KASMINAH BINTI SAHARUDIN', 'IBU', '01140376828', 'https://drive.google.com/open?id=1BM2vDgYD_NSrAP9Sr4zKl86_MfQXJQpG', 'Pending', 'Menunggu Admin', 1, 80.00, 17, 1, 1, 1, NOW()
FROM `users` u
WHERE u.email = 'iriezky602@gmail.com'
AND NOT EXISTS (SELECT 1 FROM `permohonan` WHERE emel = 'iriezky602@gmail.com' AND tahun_permohonan = 2026 AND jenis_borang = 'kelas3_fam');

-- [21] MUHAMMAD KHAIRUL ANWAR BIN RAZALI
INSERT INTO `permohonan` (user_id, district_id, persatuan_id, tahun_permohonan, jenis_permohonan, jenis_borang, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, persatuan_daerah, alamat1, alamat2, poskod, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, url_resit, status, status_workflow, mohon_ujian_bertulis, payment_amount, umur, declare1, declare2, declare3, tarikh_hantar)
SELECT u.id, 11, 11, 2026, 'kelas3_fam', 'kelas3_fam', 'MUHAMMAD KHAIRUL ANWAR BIN RAZALI', '991208025339', 'kayrulvienna46@gmail.com', '0149364758', 'LELAKI', 'Kelas III FAM', 'Persatuan Bolasepak Daerah Temerloh', 'No 56 Kampung Bongsu 28500 Lanchang Pahang', '', '', 'Temerloh', 'Pahang', 'BEKERJA', 'TENTERA', 'Panglima', 'Markas Grup Artileri Pertahanan Udara Kem Bera 28200 Bandar Bera', 'Nuraswana binti Md Saleh', 'Isteri', '0179462590', 'https://drive.google.com/open?id=1obilUSyLq1z_jq96ItzGjSXInIJIRUpI', 'Pending', 'Menunggu Admin', 1, 80.00, 27, 1, 1, 1, NOW()
FROM `users` u
WHERE u.email = 'kayrulvienna46@gmail.com'
AND NOT EXISTS (SELECT 1 FROM `permohonan` WHERE emel = 'kayrulvienna46@gmail.com' AND tahun_permohonan = 2026 AND jenis_borang = 'kelas3_fam');

-- [22] NIK MUHAMMAD MUNIR BIN NIK LAH
INSERT INTO `permohonan` (user_id, district_id, persatuan_id, tahun_permohonan, jenis_permohonan, jenis_borang, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, persatuan_daerah, alamat1, alamat2, poskod, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, url_resit, status, status_workflow, mohon_ujian_bertulis, payment_amount, umur, declare1, declare2, declare3, tarikh_hantar)
SELECT u.id, 2, 2, 2026, 'kelas3_fam', 'kelas3_fam', 'NIK MUHAMMAD MUNIR BIN NIK LAH', '011027060489', 'nikmunir4520@gmail.com', '01140663455', 'LELAKI', 'Kelas III FAM', 'Persatuan Bolasepak Daerah Bera', '347-P, RUMAH GURU SK TRIANG 2, FELDA TRIANG 1, 28300, TRIANG, PAHANG', '', '', 'Bera', 'Pahang', 'BEKERJA', 'GURU', 'GURU BESAR', 'SK (LKTP) TRIANG 2, FELDA TRIANG 1, 28300 TRIANG, PAHANG', 'NIK LAH BIN NIK MAT', 'BAPA', '0139515532', 'https://drive.google.com/open?id=1mPR1ydQu3ioUe35Cr8XrEYaT8q3g4FQr', 'Pending', 'Menunggu Admin', 1, 80.00, 25, 1, 1, 1, NOW()
FROM `users` u
WHERE u.email = 'nikmunir4520@gmail.com'
AND NOT EXISTS (SELECT 1 FROM `permohonan` WHERE emel = 'nikmunir4520@gmail.com' AND tahun_permohonan = 2026 AND jenis_borang = 'kelas3_fam');

-- [23] MUHAMMAD IZZUL ISLAM BIN MUHAMMAD NOOR
INSERT INTO `permohonan` (user_id, district_id, persatuan_id, tahun_permohonan, jenis_permohonan, jenis_borang, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, persatuan_daerah, alamat1, alamat2, poskod, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, url_resit, status, status_workflow, mohon_ujian_bertulis, payment_amount, umur, declare1, declare2, declare3, tarikh_hantar)
SELECT u.id, 9, 9, 2026, 'kelas3_fam', 'kelas3_fam', 'MUHAMMAD IZZUL ISLAM BIN MUHAMMAD NOOR', '030517060805', 'izl.islam0305@gmail.com', '0195885941', 'LELAKI', 'Kelas III FAM', 'Persatuan Bolasepak Daerah Raub', 'NO. 180,KG MELAYU CHEROH 3,27620,RAUB,PAHANG', '', '', 'Raub', 'Pahang', 'BEKERJA', 'PEMBANTU KHIDMAT AM', 'MAJLIS DAERAH RAUB', '27600,RAUB,PAHANG', 'MUHAMMAD NOOR BIN MUSA', 'BAPA', '0109866434', 'https://drive.google.com/open?id=1V3DY-hULaRsA6jlmAxMLt1-OiKOa9_mL', 'Pending', 'Menunggu Admin', 1, 80.00, 23, 1, 1, 1, NOW()
FROM `users` u
WHERE u.email = 'izl.islam0305@gmail.com'
AND NOT EXISTS (SELECT 1 FROM `permohonan` WHERE emel = 'izl.islam0305@gmail.com' AND tahun_permohonan = 2026 AND jenis_borang = 'kelas3_fam');

-- [24] MUHAMMAD IMAN AFIF BIN MOHD KAMIL
INSERT INTO `permohonan` (user_id, district_id, persatuan_id, tahun_permohonan, jenis_permohonan, jenis_borang, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, persatuan_daerah, alamat1, alamat2, poskod, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, url_resit, status, status_workflow, mohon_ujian_bertulis, payment_amount, umur, declare1, declare2, declare3, tarikh_hantar)
SELECT u.id, 11, 11, 2026, 'kelas3_fam', 'kelas3_fam', 'MUHAMMAD IMAN AFIF BIN MOHD KAMIL', '020617060213', 'imanafif2002@gmail.com', '01137939462', 'LELAKI', 'Kelas III FAM', 'Persatuan Bolasepak Daerah Temerloh', 'PT6338, RTK KG PAYA LAMAN,28500,LANCHANG, PAHANG DM', '', '', 'Temerloh', 'Pahang', 'BEKERJA', 'GURU', 'GURU BESAR', 'SK FELDA LAKUM, 28500, LANCHANG PAHANG DM', 'KHAIRUL RUSMA BT ISMAIL', 'IBU', '0199560892', 'https://drive.google.com/open?id=1wmQHWGWOOUyoGpnbvHp5x7P4X6-_VA_Q', 'Pending', 'Menunggu Admin', 1, 80.00, 24, 1, 1, 1, NOW()
FROM `users` u
WHERE u.email = 'imanafif2002@gmail.com'
AND NOT EXISTS (SELECT 1 FROM `permohonan` WHERE emel = 'imanafif2002@gmail.com' AND tahun_permohonan = 2026 AND jenis_borang = 'kelas3_fam');

-- [25] ANWARI IKHLAS BIN BAHARUM
INSERT INTO `permohonan` (user_id, district_id, persatuan_id, tahun_permohonan, jenis_permohonan, jenis_borang, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, persatuan_daerah, alamat1, alamat2, poskod, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, url_resit, status, status_workflow, mohon_ujian_bertulis, payment_amount, umur, declare1, declare2, declare3, tarikh_hantar)
SELECT u.id, 2, 2, 2026, 'kelas3_fam', 'kelas3_fam', 'ANWARI IKHLAS BIN BAHARUM', '920130065219', 'ikhguero10@gmail.com', '0145189357', 'LELAKI', 'Kelas III FAM', 'Persatuan Bolasepak Daerah Bera', 'NO 39, JALAN MERBAU IMPIAN 1, VILLA TAMAN MERBAU IMPIAN', '', '', 'Bera', 'Pahang', 'BEKERJA', 'GURU', 'GURU BESAR SJKC TRIANG 2', 'SJKC TRIANG 2', 'HUSNA FAIZAH BT RAHMAT', 'ISTERI', '01110553566', 'https://drive.google.com/open?id=17OWkXG2oIm9oUtyztFOI8GCCXW7b5NHu', 'Pending', 'Menunggu Admin', 1, 80.00, 34, 1, 1, 1, NOW()
FROM `users` u
WHERE u.email = 'ikhguero10@gmail.com'
AND NOT EXISTS (SELECT 1 FROM `permohonan` WHERE emel = 'ikhguero10@gmail.com' AND tahun_permohonan = 2026 AND jenis_borang = 'kelas3_fam');

-- [26] ZAFFRAN NURIMAN BIN ABDULLAH
INSERT INTO `permohonan` (user_id, district_id, persatuan_id, tahun_permohonan, jenis_permohonan, jenis_borang, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, persatuan_daerah, alamat1, alamat2, poskod, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, url_resit, status, status_workflow, mohon_ujian_bertulis, payment_amount, umur, declare1, declare2, declare3, tarikh_hantar)
SELECT u.id, 4, 4, 2026, 'kelas3_fam', 'kelas3_fam', 'ZAFFRAN NURIMAN BIN ABDULLAH', '090430060663', 'mommynuriman86@gmail.com', '01170062066', 'LELAKI', 'Kelas III FAM', 'Persatuan Bolasepak Daerah Jerantut', 'L. 240 FELDA MELUR JENGKA 12, 26420 BANDAR PUSAT JENGKA,  PAHANG', '', '', 'Jerantut', 'Pahang', 'PELAJAR', 'PELAJAR', 'PENGETUA', 'SEKOLAH MENENGAH TENGKU AMPUAN AFZAN CHENOR, 28100 MARAN, PAHANG', 'SALASIAH BINTI MOHAMED RAFLI', 'IBU', '1128963314', 'https://drive.google.com/open?id=1iMj-O7KHXvaPzz2-IWWoN-o-rX1wWv9m', 'Pending', 'Menunggu Admin', 1, 80.00, 17, 1, 1, 1, NOW()
FROM `users` u
WHERE u.email = 'mommynuriman86@gmail.com'
AND NOT EXISTS (SELECT 1 FROM `permohonan` WHERE emel = 'mommynuriman86@gmail.com' AND tahun_permohonan = 2026 AND jenis_borang = 'kelas3_fam');

-- [27] AHMAD HAZREEF IZZUDIN BIN AHMAD TAZUDIN
INSERT INTO `permohonan` (user_id, district_id, persatuan_id, tahun_permohonan, jenis_permohonan, jenis_borang, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, persatuan_daerah, alamat1, alamat2, poskod, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, url_resit, status, status_workflow, mohon_ujian_bertulis, payment_amount, umur, declare1, declare2, declare3, tarikh_hantar)
SELECT u.id, 4, 4, 2026, 'kelas3_fam', 'kelas3_fam', 'AHMAD HAZREEF IZZUDIN BIN AHMAD TAZUDIN', '090822060785', 'hadeenafarisya@gmail.com', '01125733565', 'LELAKI', 'Kelas III FAM', 'Persatuan Bolasepak Daerah Jerantut', 'D251 FELDA MAWAR JENGKA 10, 26400, BANDAR PUSAT JENGKA  PAHANG', '', '', 'Jerantut', 'Pahang', 'PELAJAR', '-', '-', '-', 'AHMAD TAZUDIN BIN HASIM', 'BAPA', '0179352295', 'https://drive.google.com/open?id=1_uHS-ZwNYvBmqd3FOvKEGYavT2GUqXxW', 'Pending', 'Menunggu Admin', 1, 80.00, 17, 1, 1, 1, NOW()
FROM `users` u
WHERE u.email = 'hadeenafarisya@gmail.com'
AND NOT EXISTS (SELECT 1 FROM `permohonan` WHERE emel = 'hadeenafarisya@gmail.com' AND tahun_permohonan = 2026 AND jenis_borang = 'kelas3_fam');

-- [28] ALEX BIN JUNE
INSERT INTO `permohonan` (user_id, district_id, persatuan_id, tahun_permohonan, jenis_permohonan, jenis_borang, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, persatuan_daerah, alamat1, alamat2, poskod, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, url_resit, status, status_workflow, mohon_ujian_bertulis, payment_amount, umur, declare1, declare2, declare3, tarikh_hantar)
SELECT u.id, 2, 2, 2026, 'kelas3_fam', 'kelas3_fam', 'ALEX BIN JUNE', '990308126001', 'alexjune7196@gmail.com', '0143709155', 'LELAKI', 'Kelas III FAM', 'Persatuan Bolasepak Daerah Bera', 'REJIMEN KE 34 ARTILERI DIRAJA KEM BERA', '', '', 'Bera', 'Pahang', 'BEKERJA', 'TENTERA', 'MOHD ANDRIAN SHA BIN NADIM', 'REJIMEN KE 34 ARTILERI DIRAJA KEM BERA', 'JUNE BIN KALUR', 'BAPA', '01131447228', 'https://drive.google.com/open?id=1PJRbwU9eWeCsftV5U0_zijriAALxdkyi', 'Pending', 'Menunggu Admin', 1, 80.00, 27, 1, 1, 1, NOW()
FROM `users` u
WHERE u.email = 'alexjune7196@gmail.com'
AND NOT EXISTS (SELECT 1 FROM `permohonan` WHERE emel = 'alexjune7196@gmail.com' AND tahun_permohonan = 2026 AND jenis_borang = 'kelas3_fam');

-- [29] MUHAMMAD SYAZWAN BIN NAZRI
INSERT INTO `permohonan` (user_id, district_id, persatuan_id, tahun_permohonan, jenis_permohonan, jenis_borang, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, persatuan_daerah, alamat1, alamat2, poskod, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, url_resit, status, status_workflow, mohon_ujian_bertulis, payment_amount, umur, declare1, declare2, declare3, tarikh_hantar)
SELECT u.id, 5, 5, 2026, 'kelas3_fam', 'kelas3_fam', 'MUHAMMAD SYAZWAN BIN NAZRI', '920223065381', 'jjq2745@gmail.com', '0145175248', 'LELAKI', 'Kelas III FAM', 'Persatuan Bolasepak Daerah Kuantan', '109527-37, Jalan Gambang Kampung Padang Jaya, Jaya Gading 26070 Kuantan Pahang', '', '', 'Kuantan', 'Pahang', 'BEKERJA', 'TENTERA', 'ANGKATAN TENTERA MALAYSIA', 'Markas Tentera Darat Cawangan Sumber Manusia, Kementah Jalan Padang Tembak 50634, Kuala Lumpur, Wilayah Perseketuan (KL)', 'Noramirah binti Abd Aziz', 'Isteri', '01125646845', 'https://drive.google.com/open?id=1IaDy6c7LSPc0YWYlYoTvxpnX_AR5c3mw', 'Pending', 'Menunggu Admin', 1, 80.00, 34, 1, 1, 1, NOW()
FROM `users` u
WHERE u.email = 'jjq2745@gmail.com'
AND NOT EXISTS (SELECT 1 FROM `permohonan` WHERE emel = 'jjq2745@gmail.com' AND tahun_permohonan = 2026 AND jenis_borang = 'kelas3_fam');

-- [30] MUHAMMAD HAFIZULLAH BIN SU'AIMI
INSERT INTO `permohonan` (user_id, district_id, persatuan_id, tahun_permohonan, jenis_permohonan, jenis_borang, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, persatuan_daerah, alamat1, alamat2, poskod, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, url_resit, status, status_workflow, mohon_ujian_bertulis, payment_amount, umur, declare1, declare2, declare3, tarikh_hantar)
SELECT u.id, 10, 10, 2026, 'kelas3_fam', 'kelas3_fam', 'MUHAMMAD HAFIZULLAH BIN SU''AIMI', '000611060919', 'muhammadhafizullah323@gmail.com', '0196802400', 'LELAKI', 'Kelas III FAM', 'Persatuan Bolasepak Daerah Rompin', 'NO 92 PERUMAHAN DATO SHAHBANDAR 26600, PEKAN, PAHANG', '', '', 'Rompin', 'Pahang', 'BEKERJA', 'PEMBANTU KHIDMAT AM GRED H1', 'PEJABAT DAERAH DAN TANAH ROMPIN', 'TINGKAT BAWAH KOMPLEKS KERAJAAN BLOK B 26800 ROMPIN PAHANG', 'SU''AIMI BIN AHMAD', 'BAPA', '01140025767', 'https://drive.google.com/open?id=17_5JntzczjE3ZLfDJOaKY8pUMqz4GNDw', 'Pending', 'Menunggu Admin', 1, 80.00, 26, 1, 1, 1, NOW()
FROM `users` u
WHERE u.email = 'muhammadhafizullah323@gmail.com'
AND NOT EXISTS (SELECT 1 FROM `permohonan` WHERE emel = 'muhammadhafizullah323@gmail.com' AND tahun_permohonan = 2026 AND jenis_borang = 'kelas3_fam');

-- [31] MUHAMMAD AMAR SHAUQI BIN NIRRAHIM
INSERT INTO `permohonan` (user_id, district_id, persatuan_id, tahun_permohonan, jenis_permohonan, jenis_borang, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, persatuan_daerah, alamat1, alamat2, poskod, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, url_resit, status, status_workflow, mohon_ujian_bertulis, payment_amount, umur, declare1, declare2, declare3, tarikh_hantar)
SELECT u.id, 10, 10, 2026, 'kelas3_fam', 'kelas3_fam', 'MUHAMMAD AMAR SHAUQI BIN NIRRAHIM', '031104060561', 'amarkuki03@gmail.com', '0136268710', 'LELAKI', 'Kelas III FAM', 'Persatuan Bolasepak Daerah Rompin', 'F12,KAMPUNG LEBAN CHONDONG,KUALA ROMPIN,PAHANG 26810', '', '', 'Rompin', 'Pahang', 'BEKERJA', 'PEMBANTU KHIDMAT AM GRED H1', 'PEJABAT DAERAH DAN TANAH ROMPIN', 'KOMPLEKS PENTADBIRAN KERAJAAN DAERAH ROMPIN , BLOK A ,26800,KUALA ROMPIN,PAHANG', 'ROSMIDAR BINTI OTHMAN', 'IBU', '0139915208', 'https://drive.google.com/open?id=1E9sy2sFkejXpQIvtX9adsykaY3-pb6EO', 'Pending', 'Menunggu Admin', 1, 80.00, 23, 1, 1, 1, NOW()
FROM `users` u
WHERE u.email = 'amarkuki03@gmail.com'
AND NOT EXISTS (SELECT 1 FROM `permohonan` WHERE emel = 'amarkuki03@gmail.com' AND tahun_permohonan = 2026 AND jenis_borang = 'kelas3_fam');

-- [32] ZULKIFLI BIN ALIAS
INSERT INTO `permohonan` (user_id, district_id, persatuan_id, tahun_permohonan, jenis_permohonan, jenis_borang, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, persatuan_daerah, alamat1, alamat2, poskod, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, url_resit, status, status_workflow, mohon_ujian_bertulis, payment_amount, umur, declare1, declare2, declare3, tarikh_hantar)
SELECT u.id, 5, 5, 2026, 'kelas3_fam', 'kelas3_fam', 'ZULKIFLI BIN ALIAS', '930107036339', 'zulkiflialias6339@gmail.com', '0128357546', 'LELAKI', 'Kelas III FAM', 'Persatuan Bolasepak Daerah Kuantan', 'NO 38, LORONG KEMPADANG MAJU 1/10', '', '', 'Kuantan', 'Pahang', 'BEKERJA', 'GURU', 'PENGETUA', 'SEKOLAH SUKAN MALAYSIA, GAMBANG', 'NOR ALYAA BINTI YUSOFF', 'ISTERI', '0169849278', 'https://drive.google.com/open?id=1dTBYTAwC3SxUBx6uQpfXDsmI111V1DCp', 'Pending', 'Menunggu Admin', 1, 80.00, 33, 1, 1, 1, NOW()
FROM `users` u
WHERE u.email = 'zulkiflialias6339@gmail.com'
AND NOT EXISTS (SELECT 1 FROM `permohonan` WHERE emel = 'zulkiflialias6339@gmail.com' AND tahun_permohonan = 2026 AND jenis_borang = 'kelas3_fam');

-- [33] MOHAMAD AMIRUL DARWISY BIN ROSLI
INSERT INTO `permohonan` (user_id, district_id, persatuan_id, tahun_permohonan, jenis_permohonan, jenis_borang, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, persatuan_daerah, alamat1, alamat2, poskod, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, url_resit, status, status_workflow, mohon_ujian_bertulis, payment_amount, umur, declare1, declare2, declare3, tarikh_hantar)
SELECT u.id, 7, 7, 2026, 'kelas3_fam', 'kelas3_fam', 'MOHAMAD AMIRUL DARWISY BIN ROSLI', '090923060397', 'cikaa74@gmail.com', '0147679848', 'LELAKI', 'Kelas III FAM', 'Persatuan Bolasepak Daerah Maran', 'NO 1, LORONG PS2/4, TAMAN PERMATANG SHAHBANDAR 2, 26400 BANDAR PUSAT JENGKA, PAHANG', '', '', 'Maran', 'Pahang', 'PELAJAR', 'PELAJAR', 'PENGETUA', 'SMK JENGKA PUSAT, 26400 BANDAR PUSAT JENGKA, PAHANG', 'ROSLI BIN SAAD', 'BAPA', '0199972369', 'https://drive.google.com/open?id=1zM-bov31fDjaXcg1AmVXS8orp-abWBTj', 'Pending', 'Menunggu Admin', 1, 80.00, 17, 1, 1, 1, NOW()
FROM `users` u
WHERE u.email = 'cikaa74@gmail.com'
AND NOT EXISTS (SELECT 1 FROM `permohonan` WHERE emel = 'cikaa74@gmail.com' AND tahun_permohonan = 2026 AND jenis_borang = 'kelas3_fam');

-- [34] AHMAD FIRDAUS BIN AHMAD RADZI
INSERT INTO `permohonan` (user_id, district_id, persatuan_id, tahun_permohonan, jenis_permohonan, jenis_borang, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, persatuan_daerah, alamat1, alamat2, poskod, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, url_resit, status, status_workflow, mohon_ujian_bertulis, payment_amount, umur, declare1, declare2, declare3, tarikh_hantar)
SELECT u.id, 4, 4, 2026, 'kelas3_fam', 'kelas3_fam', 'AHMAD FIRDAUS BIN AHMAD RADZI', '990714066331', 'firdausradzi147@gmail.com', '0128990714', 'LELAKI', 'Kelas III FAM', 'Persatuan Bolasepak Daerah Jerantut', 'NO.31, JALAN PJ UTAMA, TAMAN PEDAH JAYA, 27000 JERANTUT, PAHANG', '', '', 'Jerantut', 'Pahang', 'BEKERJA', 'Guru Ganti', 'Guru Besar', '-', 'Ahmad Radzi Bin Abdul Rahman', 'Ayah', '0139841853', 'https://drive.google.com/open?id=1EDbXe3G2s2IdfdmZbX40IMI46xc5nN0Y', 'Pending', 'Menunggu Admin', 1, 80.00, 27, 1, 1, 1, NOW()
FROM `users` u
WHERE u.email = 'firdausradzi147@gmail.com'
AND NOT EXISTS (SELECT 1 FROM `permohonan` WHERE emel = 'firdausradzi147@gmail.com' AND tahun_permohonan = 2026 AND jenis_borang = 'kelas3_fam');

-- [35] MUHAMMAD ILHAN RAZIQ
INSERT INTO `permohonan` (user_id, district_id, persatuan_id, tahun_permohonan, jenis_permohonan, jenis_borang, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, persatuan_daerah, alamat1, alamat2, poskod, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, url_resit, status, status_workflow, mohon_ujian_bertulis, payment_amount, umur, declare1, declare2, declare3, tarikh_hantar)
SELECT u.id, 5, 5, 2026, 'kelas3_fam', 'kelas3_fam', 'MUHAMMAD ILHAN RAZIQ', '090627060405', 'nazruldell82@gmail.com', '01153338284', 'LELAKI', 'Kelas III FAM', 'Persatuan Bolasepak Daerah Kuantan', 'NO 19/27 IM 15,BANDAR INDERA MAHKOTA,25200,KUANTAN,PAHANG', '', '', 'Kuantan', 'Pahang', 'PELAJAR', 'PELAJAR', 'PELAJAR SEKOLAH', 'SMK IM2', 'MOHAMED NAZRUL BIN DAHALAN', 'BAPA', '0139071207', 'https://drive.google.com/open?id=1MPLkkM8H0LLCk_3a8Z9HA9U5XNeHTIBn', 'Pending', 'Menunggu Admin', 1, 80.00, 17, 1, 1, 1, NOW()
FROM `users` u
WHERE u.email = 'nazruldell82@gmail.com'
AND NOT EXISTS (SELECT 1 FROM `permohonan` WHERE emel = 'nazruldell82@gmail.com' AND tahun_permohonan = 2026 AND jenis_borang = 'kelas3_fam');

-- [36] MOHD BASAR BIN SERTI
INSERT INTO `permohonan` (user_id, district_id, persatuan_id, tahun_permohonan, jenis_permohonan, jenis_borang, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, persatuan_daerah, alamat1, alamat2, poskod, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, url_resit, status, status_workflow, mohon_ujian_bertulis, payment_amount, umur, declare1, declare2, declare3, tarikh_hantar)
SELECT u.id, 4, 4, 2026, 'kelas3_fam', 'kelas3_fam', 'MOHD BASAR BIN SERTI', '891218065539', 'mohdbasar.serti@gmail.com', '01116323643', 'LELAKI', 'Kelas III FAM', 'Persatuan Bolasepak Daerah Jerantut', 'NO.167 FELDA LEPAR UTARA 2,26400 BANDAR JENGKA,PAHANG', '', '', 'Jerantut', 'Pahang', 'BEKERJA', 'POLIS BANTUAN FELDA', 'FGV SECURITY SERVICES SDN BHD', 'FGV SECURITY SERVICES WILAYAH JENGKA,G-13-1 LORONG TARBP 6 TUN RAZAK BUSINESS PARK 26400 BANDAR JENGKA', 'NOOR FARHAN RIHA BINTI HARZRI', 'ISTERI', '0132454245', 'https://drive.google.com/open?id=1i8MJo1qfJSnpqO4Swvh0ep7yV-SkYDrk', 'Pending', 'Menunggu Admin', 1, 80.00, 37, 1, 1, 1, NOW()
FROM `users` u
WHERE u.email = 'mohdbasar.serti@gmail.com'
AND NOT EXISTS (SELECT 1 FROM `permohonan` WHERE emel = 'mohdbasar.serti@gmail.com' AND tahun_permohonan = 2026 AND jenis_borang = 'kelas3_fam');

-- [37] MUHAMAD HAMIMUDDIN BIN ISMAIL
INSERT INTO `permohonan` (user_id, district_id, persatuan_id, tahun_permohonan, jenis_permohonan, jenis_borang, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, persatuan_daerah, alamat1, alamat2, poskod, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, url_resit, status, status_workflow, mohon_ujian_bertulis, payment_amount, umur, declare1, declare2, declare3, tarikh_hantar)
SELECT u.id, 5, 5, 2026, 'kelas3_fam', 'kelas3_fam', 'MUHAMAD HAMIMUDDIN BIN ISMAIL', '921111065947', 'hamimuddin92@gmail.com', '0163689650', 'LELAKI', 'Kelas III FAM', 'Persatuan Bolasepak Daerah Kuantan', 'NO 125, FELDA SUNGAI PANCHING UTARA 26250, KUANTAN PAHANG', '', '', 'Kuantan', 'Pahang', 'BEKERJA', 'KERANI', 'MAJLIS AMANAH RAKYAT', 'PEJABAT MARA NEGERI PAHANG, TINGKAT 3, PLAZA GAMBUT, JALAN GAMBUT, 25000, KUANTAN PAHANG', 'SURAIZA BINTI AWANG', 'ISTERI', '0139714384', 'https://drive.google.com/open?id=1a0ugpWWoZjRWweMceDrFqBohpaYGgaBX', 'Pending', 'Menunggu Admin', 1, 80.00, 34, 1, 1, 1, NOW()
FROM `users` u
WHERE u.email = 'hamimuddin92@gmail.com'
AND NOT EXISTS (SELECT 1 FROM `permohonan` WHERE emel = 'hamimuddin92@gmail.com' AND tahun_permohonan = 2026 AND jenis_borang = 'kelas3_fam');

-- [38] MUHAMMAD AZAM BIN ISMAIL
INSERT INTO `permohonan` (user_id, district_id, persatuan_id, tahun_permohonan, jenis_permohonan, jenis_borang, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, persatuan_daerah, alamat1, alamat2, poskod, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, url_resit, status, status_workflow, mohon_ujian_bertulis, payment_amount, umur, declare1, declare2, declare3, tarikh_hantar)
SELECT u.id, 9, 9, 2026, 'kelas3_fam', 'kelas3_fam', 'MUHAMMAD AZAM BIN ISMAIL', '100909030825', 'azimijimmy0585@gmail.com', '01137778801', 'LELAKI', 'Kelas III FAM', 'Persatuan Bolasepak Daerah Raub', '7331,Perumahan Rotan Tunggal 27600 Raub,Pahang', '', '', 'Raub', 'Pahang', 'PELAJAR', 'Pelajar sekolah', 'tiada', 'tiada', 'MUHAMMAD AZIMI BIN ISMAIL', 'Abang', '01169557599', 'https://drive.google.com/open?id=1HHgovd8CRSRLv_wZtMu542JrGmiuGZGK', 'Pending', 'Menunggu Admin', 1, 80.00, 16, 1, 1, 1, NOW()
FROM `users` u
WHERE u.email = 'azimijimmy0585@gmail.com'
AND NOT EXISTS (SELECT 1 FROM `permohonan` WHERE emel = 'azimijimmy0585@gmail.com' AND tahun_permohonan = 2026 AND jenis_borang = 'kelas3_fam');

-- [39] AFIQ IKHWAN BIN AMRAN
INSERT INTO `permohonan` (user_id, district_id, persatuan_id, tahun_permohonan, jenis_permohonan, jenis_borang, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, persatuan_daerah, alamat1, alamat2, poskod, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, url_resit, status, status_workflow, mohon_ujian_bertulis, payment_amount, umur, declare1, declare2, declare3, tarikh_hantar)
SELECT u.id, 5, 5, 2026, 'kelas3_fam', 'kelas3_fam', 'AFIQ IKHWAN BIN AMRAN', '070805110121', 'amranpolisas@gmail.com', '0104655161', 'LELAKI', 'Kelas III FAM', 'Persatuan Bolasepak Daerah Kuantan', 'LOT PT 33984 LORONG KEMBOJA, KAMPUNG MAHKOTA 26070 KUANTAN', '', '', 'Kuantan', 'Pahang', 'PELAJAR', 'PELAJAR POLISAS', 'PENGARAH POLISAS', 'POLISAS SEMAMBU 25350 KUANTAN', 'AMRAN BIN MD YUNUS', 'BAPA', '0199935161', 'https://drive.google.com/open?id=1PJZWUibl0N7WQToop9i_lTWZS23zSK41', 'Pending', 'Menunggu Admin', 1, 80.00, 19, 1, 1, 1, NOW()
FROM `users` u
WHERE u.email = 'amranpolisas@gmail.com'
AND NOT EXISTS (SELECT 1 FROM `permohonan` WHERE emel = 'amranpolisas@gmail.com' AND tahun_permohonan = 2026 AND jenis_borang = 'kelas3_fam');

-- [40] AHMAD KHAIROL BIN KELANA
INSERT INTO `permohonan` (user_id, district_id, persatuan_id, tahun_permohonan, jenis_permohonan, jenis_borang, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, persatuan_daerah, alamat1, alamat2, poskod, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, url_resit, status, status_workflow, mohon_ujian_bertulis, payment_amount, umur, declare1, declare2, declare3, tarikh_hantar)
SELECT u.id, 2, 2, 2026, 'kelas3_fam', 'kelas3_fam', 'AHMAD KHAIROL BIN KELANA', '960311135577', 'fakhruliqbalrefkel@gmail.com', '0109855537', 'LELAKI', 'Kelas III FAM', 'Persatuan Bolasepak Daerah Bera', 'NO 8,JALAN KEMPAS 6,KUARTES IPD BERA,28200 BERA PAHANG', '', '', 'Bera', 'Pahang', 'BEKERJA', 'POLIS', 'PDRM', 'IBU PEJABAT POLIS DAERAH BERA', 'NUR SHAMELIA BINTI CHE ROPA', 'Isteri', '0199309467', 'https://drive.google.com/open?id=1YMb9k_16d4oUETsRrg8Bu5mSiq5hK_Fz', 'Pending', 'Menunggu Admin', 1, 80.00, 30, 1, 1, 1, NOW()
FROM `users` u
WHERE u.email = 'fakhruliqbalrefkel@gmail.com'
AND NOT EXISTS (SELECT 1 FROM `permohonan` WHERE emel = 'fakhruliqbalrefkel@gmail.com' AND tahun_permohonan = 2026 AND jenis_borang = 'kelas3_fam');

-- [41] MUHAMAD AZHARI BIN ANISUTISNA
INSERT INTO `permohonan` (user_id, district_id, persatuan_id, tahun_permohonan, jenis_permohonan, jenis_borang, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, persatuan_daerah, alamat1, alamat2, poskod, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, url_resit, status, status_workflow, mohon_ujian_bertulis, payment_amount, umur, declare1, declare2, declare3, tarikh_hantar)
SELECT u.id, 1, 1, 2026, 'kelas3_fam', 'kelas3_fam', 'MUHAMAD AZHARI BIN ANISUTISNA', '900317065261', 'aidil179082@gmail.com', '0199654919', 'LELAKI', 'Kelas III FAM', 'Persatuan Bolasepak Daerah Bentong', 'M23 Jalan Mindef 2 Taman Desa Damai 28700 Bentong, Pahang.', '', '', 'Bentong', 'Pahang', 'BEKERJA', 'Tentera', 'Pegawai Memerintah', 'Kem Bentong, 28700 Bentong Pahang', 'Siti Nuraisyah binti Omar Sudi', 'Isteri', '0199656485', 'https://drive.google.com/open?id=1jjT1xh3QekmjOQJPIWfH31OcRVV1g2hN', 'Pending', 'Menunggu Admin', 1, 80.00, 36, 1, 1, 1, NOW()
FROM `users` u
WHERE u.email = 'aidil179082@gmail.com'
AND NOT EXISTS (SELECT 1 FROM `permohonan` WHERE emel = 'aidil179082@gmail.com' AND tahun_permohonan = 2026 AND jenis_borang = 'kelas3_fam');

-- [42] MUHAMMAD TOHIR BIN KHAIRUDDIN
INSERT INTO `permohonan` (user_id, district_id, persatuan_id, tahun_permohonan, jenis_permohonan, jenis_borang, nama_penuh, no_kp, emel, no_telefon, jantina, jenis_pengadil, persatuan_daerah, alamat1, alamat2, poskod, daerah, negeri, status_kerja, jawatan, nama_majikan, alamat_majikan1, nama_waris, hubungan_waris, telefon_waris, url_resit, status, status_workflow, mohon_ujian_bertulis, payment_amount, umur, declare1, declare2, declare3, tarikh_hantar)
SELECT u.id, 5, 5, 2026, 'kelas3_fam', 'kelas3_fam', 'MUHAMMAD TOHIR BIN KHAIRUDDIN', '921008065623', 'muhdtohir1992@gmail.com', '01125645673', 'LELAKI', 'Kelas III FAM', 'Persatuan Bolasepak Daerah Kuantan', 'Du 44-B JALAN ABDUL RASHID, KAMPUNG JAYA GADING,26070, KUANTAN,PAHANG', '', '', 'Kuantan', 'Pahang', 'BEKERJA', 'Penyelia operasi', 'FELDA', 'LOT 1863 KAWASAN PERUSAHAAN PELABUHAN KUANTAN, JALAN KEMAMAN,PELABUHAN KUANTAN,26080,KUANTAN,PAHANG', 'NURUL ATIQAH BINTI MOHD HASNI', 'ISTERI', '0198756865', 'https://drive.google.com/open?id=1w4V3QYPHMEPDnOGsx4JX0JIZhSP2xjji', 'Pending', 'Menunggu Admin', 1, 80.00, 34, 1, 1, 1, NOW()
FROM `users` u
WHERE u.email = 'muhdtohir1992@gmail.com'
AND NOT EXISTS (SELECT 1 FROM `permohonan` WHERE emel = 'muhdtohir1992@gmail.com' AND tahun_permohonan = 2026 AND jenis_borang = 'kelas3_fam');

COMMIT;

-- Verify:
-- SELECT u.nama_penuh, u.email, u.daerah, p.status_workflow
-- FROM users u JOIN permohonan p ON p.user_id = u.id
-- WHERE p.jenis_borang = 'kelas3_fam' AND p.tahun_permohonan = 2026
-- ORDER BY u.daerah, u.nama_penuh;