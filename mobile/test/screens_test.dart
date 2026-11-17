// Renders the main screens with sample data to PNGs for visual review:
// `flutter test --update-goldens test/screens_test.dart` writes test/goldens/.
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:refpahang/api.dart';
import 'package:refpahang/main.dart';
import 'package:refpahang/screens/admin_pengguna_screen.dart';
import 'package:refpahang/screens/admin_screens.dart';
import 'package:refpahang/screens/admin_statistik_screen.dart';
import 'package:refpahang/screens/admin_tetapan_screen.dart';
import 'package:refpahang/screens/chat_screen.dart';
import 'package:refpahang/screens/daerah_screens.dart';
import 'package:refpahang/screens/notifikasi_screen.dart';
import 'package:refpahang/screens/permohonan_form_screen.dart';
import 'package:refpahang/screens/statistik_screen.dart';
import 'package:refpahang/theme.dart';

final _today = DateTime.now();
String _day(int offset) => _today.add(Duration(days: offset)).toIso8601String().substring(0, 10);
String _notif(int offsetHours) =>
    _today.toUtc().add(const Duration(hours: 8)).add(Duration(hours: offsetHours)).toIso8601String().substring(0, 19).replaceFirst('T', ' ');

final Map<String, Object> _responses = {
  '/api/statistics.php': {
    'error': false,
    'data': {
      'year': 2026, 'total': 62, 'telegram': {'total': 95, 'linked': 90},
      'lantikan': {'total': 120, 'diterima': 110, 'ditolak': 8, 'belum': 2},
      'matches': {'uniqueMatches': 227, 'total': 241, 'topPengadil': [{'name': 'SHAHRUL HAKIMI', 'count': 9}, {'name': 'KAMAL SALLEH', 'count': 7}]},
      'ratings': {'average': 8.3, 'total': 72, 'distribution': {'10': 0, '1-3': 0, '4-5': 1, '6-7': 20, '8-9': 51}, 'rankings': []},
      'annualRegistration': {'fitness': {'lulus': 40, 'tidak_lulus': 3, 'tidak_hadir': 2, 'belum': 17}, 'seminar': {'hadir': 50, 'tidak_hadir': 2, 'belum': 10}, 'patch_eligible': 38},
      'applications': {'byType': {
        'pengadil_berdaftar': {'total': 62, 'pending': 4, 'approved': 55, 'rejected': 3,
          'monthlyTrend': {'1': 30, '2': 22, '3': 6, '4': 4},
          'byDistrict': [{'daerah': 'Kuantan', 'total': 20, 'approved': 18, 'rejected': 1, 'pending': 1}, {'daerah': 'Temerloh', 'total': 12, 'approved': 11, 'rejected': 0, 'pending': 1}]},
        'penilai_berdaftar': {'total': 9, 'pending': 1, 'approved': 8, 'rejected': 0, 'monthlyTrend': {}, 'byDistrict': []},
      }},
    },
  },
  '/api/admin-users.php': {
    'error': false,
    'persatuan': [{'id': 3, 'nama_persatuan': 'PB Daerah Kuantan'}],
    'users': [
      {'id': 5, 'nama_penuh': 'KAMAL BIN SALLEH', 'email': 'kamal@example.com', 'user_role': 'Pengadil', 'persatuan_nama': 'PB Daerah Kuantan', 'is_active': 1},
      {'id': 6, 'nama_penuh': 'ROSLAN BIN ISA', 'email': 'roslan@example.com', 'user_role': 'Penilai', 'persatuan_nama': 'PB Daerah Kuantan', 'is_active': 1},
      {'id': 7, 'nama_penuh': 'AZMAN BIN YUSOF', 'email': 'azman@example.com', 'user_role': 'PP Daerah', 'persatuan_nama': 'PB Daerah Kuantan', 'is_active': 1},
    ],
  },
  '/api/admin-settings.php': {
    'error': false,
    'settings': {'maintenance_mode': '0', 'demo_enabled': '1', 'registration_open': '1', 'berdaftar_open': '1', 'berdaftar_open_date': '2026-10-01',
      'berdaftar_close_date': '2026-12-31', 'bertulis_open': '0', 'kelas1_open': '0', 'penilai_open': '1', 'application_year': '2027',
      'payment_amount': '80.00', 'min_verified_matches': '20', 'require_profile_complete': '1', 'auto_link_matches': '1'},
  },
  '/api/admin-telegram-blast.php': {'error': false, 'total': 95, 'linked': 90, 'not_linked': 5, 'active_not_linked': 5, 'inactive_not_linked': 0, 'batch': null},
  '/api/admin-matches.php': {
    'error': false,
    'statistics': {'total': 1486, 'pending': 68, 'verified': 1418, 'rejected': 0},
    'pagination': {'page': 1, 'per_page': 25, 'total_pages': 3, 'total_items': 68},
    'matches': [
      {'id': 41, 'match_group_id': 'g41', 'tarikh': '2026-10-24', 'masa': '16:30', 'jenis': 'Liga', 'nama_kejohanan': 'Liga Pahang 2026',
        'tempat': 'Padang Gambang', 'home_team': 'GAMBANG FC', 'away_team': 'SRI DAMAI', 'status_pp': null,
        'daerah_perlawanan_nama': 'Kuantan', 'submitter_name': 'MOHD HAFIZ',
        'officials': [{'jawatan': 'Pengadil', 'nama': 'MOHD HAFIZ'}, {'jawatan': 'Penolong Pengadil 1', 'nama': 'ALI BIN ABU'}]},
    ],
  },
  '/api/support-chat.php': {
    'error': false,
    'has_more': false,
    'data': [
      {'id': 1, 'body': 'Assalamualaikum, saya tidak dapat memuat naik resit bayaran.', 'is_admin': 0, 'created_at': '2026-10-29 09:12:00', 'sender_name': 'MOHD HAFIZ'},
      {'id': 2, 'body': 'Waalaikumsalam. Sila pastikan saiz fail kurang daripada 5MB dan cuba sekali lagi.', 'is_admin': 1, 'created_at': '2026-10-29 09:20:00', 'sender_name': 'Admin'},
    ],
  },
  '/api/pp-referees.php': {
    'error': false,
    'statistics': {'total': 86, 'active': 71, 'inactive': 15},
    'referees': [
      {'id': 5, 'nama_penuh': 'KAMAL BIN SALLEH', 'jenis_pengadil': 'Pengadil Negeri', 'no_telefon': '0131112222', 'aktif': 1},
      {'id': 6, 'nama_penuh': 'NUR AINA BINTI ZAKARIA', 'jenis_pengadil': 'Pengadil Baharu', 'no_telefon': '0145556666', 'aktif': 1},
      {'id': 7, 'nama_penuh': 'RAZAK BIN OTHMAN', 'jenis_pengadil': 'Pengadil Kebangsaan', 'no_telefon': '0198887777', 'aktif': 0},
    ],
  },
  '/api/pp-penilaian.php': {
    'error': false,
    'data': [
      {'id': 3, 'tarikh': '2026-10-12', 'pasukan_home': 'KUANTAN FC', 'pasukan_away': 'BERA UTD', 'nama_kejohanan': 'Liga Pahang 2026',
        'nama_penilai': 'ROSLAN BIN ISA', 'pegawai': [
          {'jawatan': 'Pengadil', 'nama_pengadil': 'KAMAL BIN SALLEH', 'markah': '8.4', 'prestasi': 'Sangat Baik'},
          {'jawatan': 'Penolong Pengadil 1', 'nama_pengadil': 'ALI BIN ABU', 'markah': '7.2', 'prestasi': 'Baik'},
        ]},
    ],
  },
  '/api/application-settings.php': {
    'error': false,
    'settings': {'application_year': '2028', 'payment_amount': '80.00', 'payment_bank_name': 'Maybank',
      'payment_account_name': 'Persatuan Bolasepak Negeri Pahang', 'payment_account_no': '5060 1234 5678'},
    'windows': {'berdaftar': {'state': 'open', 'open_date': '', 'close_date': ''},
      'bertulis': {'state': 'not_yet', 'open_date': '2026-12-01', 'close_date': ''}},
  },
  '/api/registration-status.php': {'error': false, 'registration_open': true, 'registration_message': null},
  '/api/public-persatuan.php': {
    'error': false,
    'data': [
      {'id': 3, 'nama_persatuan': 'PB Daerah Kuantan', 'kod_persatuan': 'KTN', 'daerah': 'Kuantan'},
      {'id': 4, 'nama_persatuan': 'PB Daerah Temerloh', 'kod_persatuan': 'TML', 'daerah': 'Temerloh'},
    ],
  },
  '/api/portal-dashboard.php': {
    'error': false,
    'data': {
      'year': 2026, 'minimum_matches': 20,
      'totals': {'records': 24, 'verified': 18, 'pending': 5, 'rejected': 1, 'response': 1,
        'accepted': 9, 'no_report': 2, 'submitted': 3, 'confirmed': 4, 'needs_report': 2, 'drafts': 1,
        'registered': 86, 'licensed': 71, 'pending_units': 4, 'review_applications': 2},
      'monthly': [for (var m = 1; m <= 12; m++) {'month': m, 'total': m <= 10 ? (m * 7) % 5 + 1 : 0, 'verified': m <= 9 ? (m * 7) % 5 : 0}],
      'positions': [{'label': 'Pengadil', 'total': 9}, {'label': 'Penolong Pengadil 1', 'total': 11}, {'label': 'Pengadil Keempat', 'total': 4}],
      'upcoming': [
        {'id': 13, 'jawatan': 'Penolong Pengadil 2', 'status': 'Diterima', 'date': _day(5), 'time': '20:45:00',
          'subtitle': 'Padang MPT', 'tournament': 'Karnival B-18', 'title': 'TEMERLOH lwn LIPIS'},
      ],
    },
  },
  '/api/lantikan-perlu-tindakan.php': {
    'error': false,
    'data': [
      {'id': 60, 'nama_kejohanan': 'Liga Pahang 2026', 'no_perlawanan': 'A-07', 'tarikh': _day(1), 'masa': '17:00:00',
        'pasukan_home': 'ROMPIN FC', 'pasukan_away': 'MARAN UTD', 'tempat': 'Padang Rompin',
        'slot_kosong': ['Penolong Pengadil 1'], 'jumlah_ditolak': 1},
      {'id': 61, 'nama_kejohanan': 'Karnival B-18 Temerloh', 'no_perlawanan': 'B-02', 'tarikh': _day(6), 'masa': '09:00:00',
        'pasukan_home': 'TEMERLOH', 'pasukan_away': 'JERANTUT', 'tempat': 'Padang MPT',
        'slot_kosong': ['Pengadil', 'Penolong Pengadil 1', 'Penolong Pengadil 2'], 'jumlah_ditolak': 0},
    ],
  },
  '/api/laporan-penilaian.php?officials': {
    'error': false,
    'data': [
      {'lantikan_id': 21, 'jawatan': 'Pengadil', 'nama_pengadil': 'AHMAD FAIZAL BIN OMAR', 'sections': [
        {'key': 'kawalan', 'label': 'Kawalan Permainan', 'items': ['Mengenalpasti kesalahan', 'Aplikasi advantej']},
        {'key': 'fizikal', 'label': 'Kecergasan Fizikal & Posisi', 'items': ['Kepantasan', 'Posisi']},
        {'key': 'kerjasama', 'label': 'Kerjasama', 'items': ['Komunikasi dengan AR']},
      ]},
      {'lantikan_id': 22, 'jawatan': 'Penolong Pengadil 1', 'nama_pengadil': 'ALI BIN ABU', 'sections': [
        {'key': 'kawalan', 'label': 'Penolong Pengadil', 'items': ['Ofsaid']},
      ]},
    ],
  },
  '/api/admin-dashboard-stats.php': {
    'error': false,
    'stats': {'total_pengadil': 412, 'year': 2026, 'pending_applications': 9, 'pending_reports': 4, 'matches_this_month': 87,
      'applications_by_type': {'pengadil_berdaftar': {'pending': 6}, 'kelas3_fam': {'pending': 3}, 'penilai_berdaftar': {'pending': 0}}},
  },
  '/api/admin-applications.php': {
    'error': false,
    'data': [
      {'id': 7, 'nama_penuh': 'AHMAD ZAKI BIN OMAR', 'jenis_permohonan': 'Pengadil Berdaftar', 'status': 'Menunggu Admin',
        'tahun_permohonan': 2027, 'tarikh_hantar': '2026-10-17 10:20:00', 'district_nama': 'PB Daerah Temerloh', 'total_matches': 22},
    ],
  },
  '/api/pp-applications.php': {
    'error': false,
    'applications': [
      {'id': 8, 'nama_penuh': 'SITI AISYAH BINTI RAHMAN', 'jenis_borang': 'pengadil_berdaftar', 'status_workflow': 'Menunggu PP Daerah',
        'tahun_permohonan': 2027, 'tarikh_hantar': '2026-10-16 09:00:00', 'district_name': 'PB Daerah Kuantan'},
    ],
  },
  '/api/pp-verify-match.php': {
    'error': false,
    'statistics': {'pending': 4, 'verified': 120, 'rejected': 3},
    'matches': [
      {'id': 30, 'home_team': 'GAMBANG FC', 'away_team': 'SRI DAMAI', 'tarikh': '2026-10-11', 'masa': '16:30', 'jenis': 'Liga',
        'tempat': 'Padang Gambang', 'daerah_perlawanan_nama': 'Kuantan', 'status_pp': null, 'submitter_name': 'MOHD HAFIZ',
        'officials': [{'jawatan': 'Pengadil', 'nama': 'MOHD HAFIZ'}, {'jawatan': 'Penolong Pengadil 1', 'nama': 'ALI BIN ABU'}],
        'pertindihan': [{'jenis': 'bertembung', 'home_team': 'X', 'away_team': 'Y', 'tarikh': '2026-10-11', 'tempat': 'Z', 'sumber': 'Rekod', 'status_pp': 'Disahkan', 'pegawai': ['ALI BIN ABU']}]},
    ],
  },
  '/api/lantikan.php': {
    'error': false,
    'region_label': 'Daerah',
    'data': [
      {'id': 1, 'jawatan': 'Pengadil', 'status': 'Diterima', 'nama_penuh': 'MOHD HAFIZ', 'no_telefon': '0139876543', 'telegram_linked': 1},
      {'id': 2, 'jawatan': 'Penolong Pengadil 1', 'status': 'Belum Jawab', 'nama_penuh': 'ALI BIN ABU', 'no_telefon': '0121112222', 'telegram_linked': 0},
    ],
    'referees': [
      {'pengadil_id': 5, 'nama_penuh': 'KAMAL BIN SALLEH', 'jenis_pengadil': 'Pengadil Negeri', 'wilayah': 'Kuantan', 'jumlah_lantikan_kejohanan': 3, 'jenis_sumber': 'Berdaftar'},
    ],
  },
  '/api/jadual-perlawanan.php': {
    'error': false,
    'data': [
      {'id': 50, 'no_perlawanan': 'A-01', 'kumpulan_tahap': 'Kumpulan A', 'pasukan_home': 'KUANTAN FC', 'pasukan_away': 'BERA UTD',
        'tarikh': '2026-10-21', 'hari': 'Rabu', 'masa': '17:00:00', 'tempat': 'Stadium Darul Makmur', 'jumlah_lantikan': 3, 'jumlah_terima': 2},
      {'id': 51, 'no_perlawanan': 'A-02', 'kumpulan_tahap': 'Kumpulan A', 'pasukan_home': 'TEMERLOH', 'pasukan_away': 'LIPIS',
        'tarikh': '2026-10-22', 'hari': 'Khamis', 'masa': '20:45:00', 'tempat': 'Padang MPT', 'jumlah_lantikan': 0, 'jumlah_terima': 0},
    ],
  },
  '/api/pengadil-penilaian.php': {
    'error': false,
    'data': [
      {'id': 9, 'pasukan_home': 'KUANTAN FC', 'pasukan_away': 'BERA UTD', 'nama_kejohanan': 'Liga Pahang 2026', 'tarikh': '2026-10-12',
        'my_jawatan': 'Pengadil', 'my_markah': '8.4', 'my_prestasi': 'Sangat Baik', 'nama_penilai': 'ROSLAN BIN ISA'},
    ],
  },
  '/api/laporan-penilaian.php': {'error': false, 'data': []},
  '/api/public-announcements.php': {
    'error': false,
    'data': [
      {'id': 1, 'title': 'Kursus Pengadil Kelas III 2027', 'content': 'Pendaftaran kursus dibuka sehingga 30 November 2026.', 'created_at_formatted': '18/10/2026'},
      {'id': 2, 'title': 'Notis 2', 'content': 'x', 'created_at_formatted': '17/10/2026'},
    ],
  },
  '/api/notifications.php': {
    'error': false,
    'unread_count': 3,
    'notifications': [
      {'id': 3, 'type': 'Lantikan', 'subject': 'Lantikan: KUANTAN FC lwn BERA UTD', 'message': 'Anda dilantik sebagai Pengadil. Sila jawab sebelum tarikh akhir.', 'is_read': 0, 'created_at': '2026-10-18 09:12:00'},
      {'id': 2, 'type': 'PP Disahkan', 'subject': 'Permohonan disahkan PP Daerah', 'message': 'Pendaftaran Tahunan (R1) anda telah disahkan.', 'is_read': 0, 'created_at': '2026-10-17 15:40:00'},
      {'id': 1, 'type': 'Sistem', 'subject': 'Profil Dikemaskini', 'message': 'Profil anda telah dikemaskini.', 'is_read': 1, 'created_at': '2026-10-15 10:00:00'},
    ],
  },
  '/api/tugasan.php': {
    'error': false,
    'stats': {'total': 3, 'belum_jawab': 2, 'diterima': 1, 'ditolak': 0, 'dibatalkan': 0, 'ditangguhkan': 0},
    'data': [
      {
        'id': 11, 'jawatan': 'Pengadil', 'status': 'Belum Jawab', 'tarikh_notif': _notif(-1), 'tarikh': _day(3), 'masa': '17:00:00',
        'hari': 'Rabu', 'no_perlawanan': 'A-12', 'kumpulan_tahap': 'Kumpulan A', 'pasukan_home': 'KUANTAN FC', 'pasukan_away': 'BERA UTD',
        'tempat': 'Stadium Darul Makmur', 'nama_kejohanan': 'Liga Pahang 2026', 'jenis_kejohanan': 'Liga', 'peringkat_kejohanan': 'Negeri',
        'rakan_tugasan': [
          {'id': 12, 'jawatan': 'Penolong Pengadil 1', 'nama': 'Ahmad Faizal', 'no_telefon': '0123456789', 'wilayah_label': 'Daerah', 'wilayah': 'Kuantan', 'status': 'Diterima'},
        ],
      },
      {
        'id': 13, 'jawatan': 'Penolong Pengadil 2', 'status': 'Diterima', 'tarikh': _day(5), 'masa': '20:45:00', 'hari': 'Jumaat',
        'no_perlawanan': 'B-03', 'kumpulan_tahap': 'B-18', 'pasukan_home': 'TEMERLOH', 'pasukan_away': 'LIPIS', 'tempat': 'Padang MPT',
        'nama_kejohanan': 'Karnival B-18', 'jenis_kejohanan': 'Karnival', 'peringkat_kejohanan': 'Daerah', 'rakan_tugasan': [],
      },
      {
        'id': 15, 'jadual_id': 70, 'jawatan': 'Penilai Pengadil', 'status': 'Diterima', 'tarikh': _day(-1), 'masa': '17:00:00',
        'no_perlawanan': 'D-01', 'pasukan_home': 'KUANTAN FC', 'pasukan_away': 'BERA UTD', 'tempat': 'Stadium Darul Makmur',
        'nama_kejohanan': 'Liga Pahang 2026', 'jenis_kejohanan': 'Liga', 'rakan_tugasan': [],
      },
      {
        'id': 14, 'jawatan': 'Penilai Pengadil', 'status': 'Belum Jawab', 'tarikh_notif': _notif(-60), 'tarikh': _day(-2), 'masa': '17:00',
        'hari': 'Jumaat', 'no_perlawanan': 'C-01', 'kumpulan_tahap': '', 'pasukan_home': 'PAIP BERA', 'pasukan_away': 'LADANG CHEEKAH',
        'tempat': 'Padang Bera', 'nama_kejohanan': 'Piala Daerah Bera', 'jenis_kejohanan': 'Persahabatan', 'peringkat_kejohanan': 'Daerah',
        'rakan_tugasan': [],
      },
    ],
  },
  '/api/pengadil-matches.php': {
    'error': false,
    'statistics': {'year': '2026', 'current_year': 24, 'verified_year': 18, 'pending_year': 5, 'rejected_year': 1},
    'pagination': {'total_pages': 1},
    'matches': [
      {'id': 1, 'home_team': 'KUANTAN FC', 'away_team': 'BERA UTD', 'lantikan_id': 11, 'match_group_id': null, 'skor_ft_home': 2, 'skor_ft_away': 1,
        'skor_ht_home': 1, 'skor_ht_away': 0, 'jenis': 'Liga', 'tarikh': '2026-10-12', 'masa': '17:00', 'tempat': 'Stadium Darul Makmur',
        'daerah_perlawanan_nama': 'Kuantan', 'jawatan': 'Pengadil', 'status_pp': 'Disahkan'},
      {'id': 2, 'home_team': 'TEMERLOH', 'away_team': 'LIPIS', 'lantikan_id': null, 'match_group_id': 4, 'skor_ft_home': null,
        'skor_ft_away': null, 'jenis': 'Persahabatan', 'tarikh': '2026-10-05', 'masa': '', 'tempat': 'Padang MPT', 'jawatan': 'Penolong Pengadil 1', 'status_pp': null},
    ],
  },
  '/api/pengadil-application-history.php': {
    'error': false,
    'data': [
      {'id': 2, 'jenis_borang': 'pengadil_berdaftar', 'tahun_permohonan': 2027, 'status_workflow': 'Menunggu PP Daerah', 'tarikh_hantar': '17/10/2026 10:20', 'pp_notes': null},
      {'id': 1, 'jenis_borang': 'kelas3_fam', 'tahun_permohonan': 2026, 'status_workflow': 'Lengkap', 'tarikh_hantar': '02/03/2026 09:00', 'admin_notes': 'Lulus kursus.'},
    ],
  },
  '/api/get-user-profile.php': {
    'error': false,
    'profile_missing_labels': ['Saiz baju'],
    'user': {'nama_penuh': 'MOHD HAFIZ BIN ISMAIL', 'email': 'hafiz@example.com', 'jenis_pengadil': 'Pengadil Negeri', 'no_telefon': '0139876543',
      'no_ic': '900101-06-1234', 'persatuan_bolasepak_daerah': 'PB Daerah Kuantan', 'alamat1': 'No 1 Jalan Bukit', 'poskod': '25000',
      'daerah': 'Kuantan', 'negeri': 'Pahang', 'tahun_mula_aktif': '2015', 'telegram_linked': 1, 'url_gambar_profil': '',
      'persatuan_id': 3, 'jantina': 'Lelaki', 'status_kerja': 'Bekerja (Swasta)', 'jawatan': 'Juruteknik',
      'nama_majikan': 'Syarikat ABC', 'nama_waris': 'AISYAH BINTI ALI', 'hubungan_waris': 'Pasangan', 'telefon_waris': '0123334444'},
  },
  '/api/kejohanan.php': {
    'error': false,
    'data': [
      {'id': 1, 'nama': 'Liga Pahang 2026', 'status': 'Aktif', 'jenis_kejohanan': 'Liga', 'peringkat_kejohanan': 'Negeri', 'tarikh_mula': '2026-08-01',
        'tarikh_akhir': '2026-12-20', 'tempat': 'Pahang', 'jumlah_perlawanan': 48, 'anjuran': 'PBNP'},
      {'id': 2, 'nama': 'Karnival B-18 Temerloh', 'status': 'Aktif', 'jenis_kejohanan': 'Karnival', 'peringkat_kejohanan': 'Daerah', 'tarikh_mula': '2026-10-20',
        'tarikh_akhir': '2026-10-22', 'tempat': 'Temerloh', 'jumlah_perlawanan': 12},
    ],
  },
};

Future<void> _loadFonts() async {
  final inter = FontLoader('Inter');
  for (final weight in [300, 400, 500, 600, 700, 800]) {
    inter.addFont(rootBundle.load('assets/fonts/Inter-$weight.ttf'));
  }
  await inter.load();
  final icons = FontLoader('MaterialIcons');
  final file = File('${Platform.environment['FLUTTER_ROOT'] ?? '/opt/homebrew/share/flutter'}'
      '/bin/cache/artifacts/material_fonts/MaterialIcons-Regular.otf');
  icons.addFont(Future.value(ByteData.view(file.readAsBytesSync().buffer)));
  await icons.load();
}

void _login(String role) {
  Api.instance.user.value = SessionUser({
    'id': 1, 'email': 'hafiz@example.com', 'role': role, 'nama_penuh': 'MOHD HAFIZ',
    'can_referee': role == 'Admin' ? 0 : 1, 'can_ra': role == 'Penilai' ? 1 : 0,
  });
}

Future<void> _show(WidgetTester tester, String name, {Future<void> Function()? then}) async {
  await tester.runAsync(() async {
    for (final asset in ['assets/images/bg.jpg', 'assets/images/logo-pahang.png', 'assets/images/logo-outline.png']) {
      await precacheImage(AssetImage(asset), tester.element(find.byType(MaterialApp)));
    }
  });
  for (var i = 0; i < 6; i++) {
    await tester.pump(const Duration(milliseconds: 100));
  }
  if (then != null) {
    await then();
    for (var i = 0; i < 6; i++) {
      await tester.pump(const Duration(milliseconds: 100));
    }
  }
  await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/$name.png'));
}

void main() {
  setUpAll(() async {
    await _loadFonts();
    Api.instance.dio.interceptors.add(InterceptorsWrapper(onRequest: (options, handler) {
      final key = options.path == '/api/laporan-penilaian.php' && options.queryParameters.containsKey('officials')
          ? '/api/laporan-penilaian.php?officials'
          : options.path;
      handler.resolve(Response(requestOptions: options, statusCode: 200, data: _responses[key] ?? {'error': false}));
    }));
  });

  setUp(() {
    final view = TestWidgetsFlutterBinding.instance.platformDispatcher.views.first;
    view.physicalSize = const Size(1080, 2340);
    view.devicePixelRatio = 2.75;
  });

  testWidgets('login', (tester) async {
    Api.instance.user.value = null;
    await tester.pumpWidget(const RefPahangApp());
    await _show(tester, 'login');
  });

  testWidgets('pengadil', (tester) async {
    _login('Pengadil');
    await tester.pumpWidget(const RefPahangApp());
    await _show(tester, 'pengadil_utama');
    await _show(tester, 'pengadil_tugasan', then: () => tester.tap(find.text('Tugasan').last));
    await _show(tester, 'pengadil_tugasan_detail', then: () => tester.tap(find.text('KUANTAN FC vs BERA UTD').first));
    await tester.tapAt(const Offset(20, 20));
    await tester.pump(const Duration(milliseconds: 400));
    await _show(tester, 'pengadil_terima', then: () => tester.tap(find.text('Terima').first));
    await tester.tap(find.text('Batal'));
    await tester.pump(const Duration(milliseconds: 400));
    await _show(tester, 'pengadil_tugasan_diterima', then: () => tester.tap(find.text('Akan datang')));
    await _show(tester, 'pengadil_rekod', then: () => tester.tap(find.text('Rekod').last));
    await _show(tester, 'pengadil_penilaian', then: () => tester.tap(find.text('Penilaian').last));
    await _show(tester, 'pengadil_permohonan', then: () => tester.tap(find.text('Permohonan').last));
    await _show(tester, 'pengadil_mohon', then: () async {
      await tester.tap(find.text('Mohon'));
      for (var i = 0; i < 8; i++) {
        await tester.pump(const Duration(milliseconds: 100));
      }
      await tester.tap(find.text('Pendaftaran Tahunan Pengadil (R1+R2+R4)'));
      for (var i = 0; i < 8; i++) {
        await tester.pump(const Duration(milliseconds: 100));
      }
    });
    await tester.pageBack();
    await tester.pump(const Duration(milliseconds: 500));
    await _show(tester, 'pengadil_profil', then: () => tester.tap(find.text('Profil').last));
    await _show(tester, 'pengadil_profil_edit', then: () => tester.tap(find.text('Kemaskini').first));
  });

  testWidgets('borang permohonan', (tester) async {
    _login('Pengadil');
    final profile = _responses['/api/get-user-profile.php']! as Map<String, Object>;
    _responses['/api/get-user-profile.php'] = {...profile, 'profile_missing_labels': <String>[]};
    addTearDown(() => _responses['/api/get-user-profile.php'] = profile);
    await tester.pumpWidget(MaterialApp(theme: buildTheme(), home: const PermohonanFormScreen(form: AppForm(
        'pengadil_berdaftar', 'Pendaftaran Tahunan Pengadil (R1+R2+R4)', '', Icons.badge_outlined, 'berdaftar', 'berdaftar'))));
    await _show(tester, 'borang_permohonan', then: () => tester.drag(find.byType(ListView).first, const Offset(0, -500)));
  });

  testWidgets('pp daerah senarai', (tester) async {
    _login('PP Daerah');
    await tester.pumpWidget(MaterialApp(theme: buildTheme(), home: const DaerahPegawaiScreen()));
    await _show(tester, 'pp_pengadil_berdaftar');
    await tester.pumpWidget(MaterialApp(theme: buildTheme(), home: const DaerahPenilaianScreen()));
    await _show(tester, 'pp_laporan_penilaian');
  });

  testWidgets('statistik', (tester) async {
    _login('Pengadil');
    await tester.pumpWidget(MaterialApp(theme: buildTheme(), home: const StatistikScreen()));
    await _show(tester, 'pengadil_statistik');
  });

  testWidgets('admin perlawanan dan chat', (tester) async {
    _login('Admin');
    await tester.pumpWidget(MaterialApp(theme: buildTheme(), home: const AdminPerlawananScreen()));
    await _show(tester, 'admin_perlawanan');
    _login('Pengadil');
    await tester.pumpWidget(MaterialApp(theme: buildTheme(), home: const ChatScreen()));
    await _show(tester, 'chat');
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('admin statistik pengguna tetapan', (tester) async {
    _login('Admin');
    await tester.pumpWidget(MaterialApp(theme: buildTheme(), home: const AdminStatistikScreen()));
    await _show(tester, 'admin_statistik');
    await tester.pumpWidget(MaterialApp(theme: buildTheme(), home: const AdminPenggunaScreen()));
    await _show(tester, 'admin_pengguna');
    await tester.pumpWidget(MaterialApp(theme: buildTheme(), home: const AdminTetapanScreen()));
    await _show(tester, 'admin_tetapan');
  });

  testWidgets('telefon sempit', (tester) async {
    // A 360dp-wide Android phone with a status bar and a larger system font.
    final view = tester.view;
    view.physicalSize = const Size(1080, 2340);
    view.devicePixelRatio = 3;
    view.padding = const FakeViewPadding(top: 72, bottom: 48);
    tester.platformDispatcher.textScaleFactorTestValue = 1.15;
    addTearDown(() {
      view.resetPadding();
      tester.platformDispatcher.clearTextScaleFactorTestValue();
    });
    _login('Admin');
    await tester.pumpWidget(const RefPahangApp());
    await _show(tester, 'sempit_admin_utama');
  });

  testWidgets('daftar', (tester) async {
    Api.instance.user.value = null;
    await tester.pumpWidget(const RefPahangApp());
    await tester.pump(const Duration(milliseconds: 300));
    await _show(tester, 'daftar', then: () async {
      await tester.ensureVisible(find.text('Daftar'));
      await tester.tap(find.text('Daftar'));
    });
  });

  testWidgets('tukar kata laluan', (tester) async {
    Api.instance.user.value = SessionUser({'id': 1, 'role': 'Pengadil', 'nama_penuh': 'MOHD HAFIZ', 'password_changed': 0});
    await tester.pumpWidget(const RefPahangApp());
    await _show(tester, 'tukar_kata_laluan');
  });

  testWidgets('admin', (tester) async {
    _login('Admin');
    await tester.pumpWidget(const RefPahangApp());
    await _show(tester, 'admin_utama');
    await _show(tester, 'admin_kelulusan', then: () => tester.tap(find.text('Kelulusan').last));
    await _show(tester, 'admin_lantikan', then: () => tester.tap(find.text('Lantikan').last));
    await _show(tester, 'admin_jadual', then: () => tester.tap(find.text('Liga Pahang 2026')));
    await _show(tester, 'admin_tambah_jadual', then: () => tester.tap(find.text('Tambah perlawanan')));
    await tester.pageBack();
    await tester.pump(const Duration(milliseconds: 400));
    await _show(tester, 'admin_padam_menu', then: () => tester.tap(find.byTooltip('Pilihan perlawanan')));
    await tester.tapAt(const Offset(10, 10));
    await tester.pump(const Duration(milliseconds: 400));
    await _show(tester, 'admin_lantik', then: () => tester.tap(find.text('KUANTAN FC vs BERA UTD')));
  });

  testWidgets('pp daerah', (tester) async {
    _login('PP Daerah');
    await tester.pumpWidget(const RefPahangApp());
    await _show(tester, 'pp_utama');
    await _show(tester, 'pp_perlu_tindakan', then: () => tester.tap(find.text('Semua').last));
    await _show(tester, 'pp_lantik_menu', then: () async {
      await tester.tap(find.text('ROMPIN FC vs MARAN UTD').last);
      await tester.pump(const Duration(milliseconds: 500));
      await tester.pump(const Duration(milliseconds: 500));
      await tester.tap(find.byType(PopupMenuButton<String>).last);
    });
  });

  testWidgets('pp daerah semakan', (tester) async {
    _login('PP Daerah');
    await tester.pumpWidget(const RefPahangApp());
    await tester.pump(const Duration(milliseconds: 600));
    await _show(tester, 'pp_semakan', then: () => tester.tap(find.text('Semakan').last));
    await _show(tester, 'pp_pengesahan_sheet', then: () => tester.tap(find.text('GAMBANG FC vs SRI DAMAI')));
  });

  testWidgets('penilai', (tester) async {
    _login('Penilai');
    await tester.pumpWidget(const RefPahangApp());
    await _show(tester, 'penilai_laporan', then: () => tester.tap(find.text('Laporan').last));
    await _show(tester, 'penilai_laporan_form', then: () => tester.tap(find.text('Isi laporan')));
  });

  testWidgets('notifikasi', (tester) async {
    _login('Pengadil');
    await tester.pumpWidget(MaterialApp(theme: buildTheme(), home: const NotifikasiScreen()));
    await _show(tester, 'notifikasi');
  });
}
