<?php



declare(strict_types=1);



require_once __DIR__ . '/bootstrap.php';



$method = $_SERVER['REQUEST_METHOD'];



if ($method !== 'GET') {

    jsonResponse(['error' => true, 'message' => 'Kaedah tidak dibenarkan.'], 405);

}



handleStatistics();



function handleStatistics(): void

{

    requireAdmin();



    $year = isset($_GET['year']) ? (int) $_GET['year'] : (int) date('Y');



    try {

        $pdo = getDbConnection();



        // Get all approved referees for the year

        $sql = <<<'SQL'

            SELECT 

                a.id,

                a.jantina,

                a.daerah as alamat_daerah,

                p.nama_persatuan as persatuan,

                a.status_kerja,

                a.status_kemaskini,

                a.tarikh_hantar,

                COALESCE(a.status_kemaskini, a.tarikh_hantar) as approval_date

            FROM permohonan a

            LEFT JOIN persatuan_bolasepak_daerah p ON a.persatuan_id = p.id

            WHERE a.status = 'Approved'

            AND (

                (a.status_kemaskini IS NOT NULL AND YEAR(a.status_kemaskini) = :year)

                OR (a.status_kemaskini IS NULL AND YEAR(a.tarikh_hantar) = :year)

            )

        SQL;



        $stmt = $pdo->prepare($sql);

        $stmt->execute([':year' => $year]);

        $referees = $stmt->fetchAll();



        // Get all applications for the year

        $sqlApps = <<<'SQL'

            SELECT 

                id,

                status,

                status_workflow,

                tarikh_hantar,

                jenis_permohonan,

                jenis_borang

            FROM permohonan

            WHERE YEAR(tarikh_hantar) = :year

        SQL;



        $stmtApps = $pdo->prepare($sqlApps);

        $stmtApps->execute([':year' => $year]);

        $applications = $stmtApps->fetchAll();



        // Initialize applications statistics arrays

        $applicationStats = [

            'total' => 0,

            'approved' => 0,

            'types' => [

                'pengadil_berdaftar' => 0,

                'penilai_berdaftar' => 0,

                'ujian_bertulis' => 0,

                'ujian_kelas1_fam' => 0,

            ],

            'statusBreakdown' => [

                'Menunggu' => 0,

                'Lengkap' => 0,

                'Ditolak' => 0,

            ],

            'monthlyTrend' => array_fill(1, 12, 0), // Months 1-12

        ];



        // Process each application

        foreach ($applications as $app) {

            $applicationStats['total']++;



            // Status breakdown - use status_workflow or status

            $statusWorkflow = $app['status_workflow'] ?? '';
            if ($statusWorkflow === 'Lengkap' || $app['status'] === 'Approved') {
                $applicationStats['statusBreakdown']['Lengkap']++;
            } elseif ($statusWorkflow === 'Ditolak' || $app['status'] === 'Rejected') {
                $applicationStats['statusBreakdown']['Ditolak']++;
            } else {
                $applicationStats['statusBreakdown']['Menunggu']++;
            }



            // Types breakdown based on jenis_borang (reliable values)
            $jenisBorang = strtolower($app['jenis_borang'] ?? '');
            if (isset($applicationStats['types'][$jenisBorang])) {
                $applicationStats['types'][$jenisBorang]++;
            }



            // Monthly trend

            $tarikhHantar = $app['tarikh_hantar'];

            if ($tarikhHantar) {

                $month = (int) date('n', strtotime($tarikhHantar));

                if ($month >= 1 && $month <= 12) {

                    $applicationStats['monthlyTrend'][$month]++;

                }

            }

        }



        // Approved count

        $applicationStats['approved'] = $applicationStats['statusBreakdown']['Lengkap'];



        // ── Match Statistics ──
        // Unique matches count (by unique tarikh+tempat+jenis combination)
        $sqlUniqueMatches = <<<'SQL'
            SELECT COUNT(DISTINCT CONCAT(tarikh, tempat, jenis)) as total 
            FROM perlawanan WHERE YEAR(tarikh) = :year
        SQL;
        $stmtUnique = $pdo->prepare($sqlUniqueMatches);
        $stmtUnique->execute([':year' => $year]);
        $uniqueMatches = (int) $stmtUnique->fetch()['total'];

        // Get all match entries with jawatan info
        $sqlMatches = <<<'SQL'
            SELECT
                p.user_id,
                p.jawatan,
                u.nama_penuh as referee_name
            FROM perlawanan p
            LEFT JOIN users u ON p.user_id = u.id
            WHERE YEAR(p.tarikh) = :year
            AND p.user_id IS NOT NULL
            AND p.user_id != 0
        SQL;

        $stmtMatches = $pdo->prepare($sqlMatches);
        $stmtMatches->execute([':year' => $year]);
        $matches = $stmtMatches->fetchAll();

        // Separate counts: Pengadil vs RA/Penolong
        $pengadilMatchCount = []; // Pengadil / Pengadil Utama only
        $allMatchCount = [];      // All roles

        foreach ($matches as $match) {
            $userId = $match['user_id'];
            $jawatan = $match['jawatan'] ?? '';
            $name = $match['referee_name'] ?? 'Tidak Dinyatakan';

            // Track all
            if (!isset($allMatchCount[$userId])) {
                $allMatchCount[$userId] = ['name' => $name, 'count' => 0];
            }
            $allMatchCount[$userId]['count']++;

            // Track Pengadil only (not RA/Penolong/Pegawai ke 4)
            $isPengadil = ($jawatan === 'Pengadil');
            if ($isPengadil) {
                if (!isset($pengadilMatchCount[$userId])) {
                    $pengadilMatchCount[$userId] = ['name' => $name, 'count' => 0];
                }
                $pengadilMatchCount[$userId]['count']++;
            }
        }

        // Sort pengadil by count
        uasort($pengadilMatchCount, fn($a, $b) => $b['count'] <=> $a['count']);

        $mostActivePengadil = !empty($pengadilMatchCount) ? reset($pengadilMatchCount) : ['name' => null, 'count' => 0];
        $pengadilTotal = array_sum(array_column($pengadilMatchCount, 'count'));

        $matchStats = [
            'uniqueMatches' => $uniqueMatches,
            'total' => count($matches), // all role entries
            'pengadilTotal' => $pengadilTotal, // pengadil role entries only
            'pengadilUniqueCount' => count($pengadilMatchCount), // unique pengadil persons
            'mostActivePengadil' => $mostActivePengadil,
            'topPengadil' => array_values(array_slice($pengadilMatchCount, 0, 10)),
            // Keep legacy keys for backwards compat
            'officiated' => count($matches),
            'mostActive' => $mostActivePengadil,
            'topReferees' => array_values(array_slice($pengadilMatchCount, 0, 10)),
        ];

        // Initialize statistics arrays

        $genderBreakdown = [

            'Lelaki' => 0,

            'Perempuan' => 0,

        ];



        $persatuanBreakdown = [];

        $employmentBreakdown = [];

        $monthlyTrend = array_fill(1, 12, 0); // Months 1-12

        $districtAddressBreakdown = []; // Physical address district breakdown



        // Process each referee

        foreach ($referees as $referee) {

            // Gender breakdown

            $gender = $referee['jantina'] ?? 'Tidak Dinyatakan';

            $gender = ucwords(strtolower($gender)); // Normalize to title case

            if (isset($genderBreakdown[$gender])) {

                $genderBreakdown[$gender]++;

            }



            // Persatuan breakdown

            $persatuan = $referee['persatuan'] ?? 'Tidak Dinyatakan';

            if (!isset($persatuanBreakdown[$persatuan])) {

                $persatuanBreakdown[$persatuan] = 0;

            }

            $persatuanBreakdown[$persatuan]++;



            // Physical address district breakdown

            $alamatDaerah = $referee['alamat_daerah'] ?? 'Tidak Dinyatakan';

            if (!isset($districtAddressBreakdown[$alamatDaerah])) {

                $districtAddressBreakdown[$alamatDaerah] = 0;

            }

            $districtAddressBreakdown[$alamatDaerah]++;



            // Employment breakdown

            $employment = $referee['status_kerja'] ?? 'Tidak Dinyatakan';

            if (!isset($employmentBreakdown[$employment])) {

                $employmentBreakdown[$employment] = 0;

            }

            $employmentBreakdown[$employment]++;



            // Monthly trend

            $approvalDate = $referee['approval_date'];

            if ($approvalDate) {

                $month = (int) date('n', strtotime($approvalDate));

                if ($month >= 1 && $month <= 12) {

                    $monthlyTrend[$month]++;

                }

            }

        }



        // Sort breakdowns

        arsort($persatuanBreakdown);

        arsort($employmentBreakdown);

        arsort($districtAddressBreakdown);

        // ── Exam/Test Statistics ──
        // Use current year for exam stats
        $sqlExams = <<<'SQL'
            SELECT 
                p.id,
                p.jenis_borang,
                p.jenis_permohonan,
                p.status_ujian,
                p.workflow_status,
                p.status,
                p.tarikh_hantar,
                p.daerah,
                u.nama_penuh,
                pb.nama_persatuan
            FROM permohonan p
            LEFT JOIN users u ON p.user_id = u.id
            LEFT JOIN persatuan_bolasepak_daerah pb ON p.persatuan_id = pb.id
            WHERE (p.jenis_borang IN ('ujian_kecergasan', 'ujian_bertulis', 'ujian_kelas1_fam') 
                   OR p.jenis_permohonan IN ('ujian_kecergasan', 'ujian_bertulis', 'ujian_kelas1_fam'))
            AND (YEAR(p.tarikh_hantar) = :year OR p.tahun_permohonan = :year)
        SQL;

        $stmtExams = $pdo->prepare($sqlExams);
        $stmtExams->execute([':year' => $year]);
        $exams = $stmtExams->fetchAll();

        $examStats = [
            'ujian_kecergasan' => [
                'total' => 0,
                'lulus' => 0,
                'tidak_lulus' => 0,
                'tidak_hadir' => 0,
                'belum_diproses' => 0,
                'monthly' => array_fill(1, 12, 0),
                'by_district' => [],
            ],
            'ujian_bertulis' => [
                'total' => 0,
                'lulus' => 0,
                'tidak_lulus' => 0,
                'tidak_hadir' => 0,
                'belum_diproses' => 0,
                'monthly' => array_fill(1, 12, 0),
                'by_district' => [],
            ],
            'ujian_kelas1_fam' => [
                'total' => 0,
                'lulus' => 0,
                'tidak_lulus' => 0,
                'tidak_hadir' => 0,
                'belum_diproses' => 0,
                'monthly' => array_fill(1, 12, 0),
                'by_district' => [],
            ],
        ];

        foreach ($exams as $exam) {
            $jenis = $exam['jenis_borang'] ?? $exam['jenis_permohonan'] ?? '';
            if (!isset($examStats[$jenis])) continue;

            $examStats[$jenis]['total']++;

            $statusUjian = $exam['status_ujian'] ?? null;
            if ($statusUjian === 'Lulus') {
                $examStats[$jenis]['lulus']++;
            } elseif ($statusUjian === 'Tidak Lulus') {
                $examStats[$jenis]['tidak_lulus']++;
            } elseif ($statusUjian === 'Tidak Hadir') {
                $examStats[$jenis]['tidak_hadir']++;
            } else {
                $examStats[$jenis]['belum_diproses']++;
            }

            // Monthly trend
            if ($exam['tarikh_hantar']) {
                $m = (int) date('n', strtotime($exam['tarikh_hantar']));
                if ($m >= 1 && $m <= 12) {
                    $examStats[$jenis]['monthly'][$m]++;
                }
            }

            // By district
            $district = $exam['daerah'] ?? $exam['nama_persatuan'] ?? 'Tidak Dinyatakan';
            if (!isset($examStats[$jenis]['by_district'][$district])) {
                $examStats[$jenis]['by_district'][$district] = 0;
            }
            $examStats[$jenis]['by_district'][$district]++;
        }

        // Sort district data
        arsort($examStats['ujian_kecergasan']['by_district']);
        arsort($examStats['ujian_bertulis']['by_district']);
        arsort($examStats['ujian_kelas1_fam']['by_district']);

        // ── Penilaian / Assessment Rankings ──
        $sqlRatings = <<<'SQL'
            SELECT
                lpp.lantikan_pengadil_id,
                lpp.markah,
                lpp.prestasi,
                lpp.jawatan,
                lpp.nama_pengadil,
                lp2.jadual_id,
                lp2.status AS laporan_status,
                COALESCE(u2.nama_penuh, lpp.nama_pengadil) AS nama,
                lp_ref.pengadil_id AS ref_user_id,
                jp2.tarikh
            FROM laporan_penilaian_pegawai lpp
            JOIN laporan_penilaian lp2 ON lpp.laporan_id = lp2.id
            JOIN jadual_perlawanan jp2 ON lp2.jadual_id = jp2.id
            LEFT JOIN lantikan_pengadil lp_ref ON lpp.lantikan_pengadil_id = lp_ref.id
            LEFT JOIN users u2 ON lp_ref.pengadil_id = u2.id
            WHERE lpp.markah IS NOT NULL
              AND lp2.status IN ('Dihantar', 'Disahkan')
              AND YEAR(jp2.tarikh) = :year
        SQL;
        $stmtRatings = $pdo->prepare($sqlRatings);
        $stmtRatings->execute([':year' => $year]);
        $allRatings = $stmtRatings->fetchAll();

        // Aggregate per referee
        $refRatings = [];
        $totalMarkah = 0;
        $totalCount = 0;
        $distribution = ['1-3' => 0, '4-5' => 0, '6-7' => 0, '8-9' => 0, '10' => 0];

        foreach ($allRatings as $r) {
            $key = $r['ref_user_id'] ?? ('luar_' . ($r['lantikan_pengadil_id'] ?? 0));
            $nama = $r['nama'] ?: $r['nama_pengadil'];
            $m = (float) $r['markah'];

            if (!isset($refRatings[$key])) {
                $refRatings[$key] = ['nama' => $nama, 'total' => 0, 'count' => 0, 'scores' => []];
            }
            $refRatings[$key]['total'] += $m;
            $refRatings[$key]['count']++;
            $refRatings[$key]['scores'][] = $m;

            $totalMarkah += $m;
            $totalCount++;

            // Distribution (markah is 0-10 scale)
            if ($m >= 10) $distribution['10']++;
            elseif ($m >= 8) $distribution['8-9']++;
            elseif ($m >= 6) $distribution['6-7']++;
            elseif ($m >= 4) $distribution['4-5']++;
            else $distribution['1-3']++;
        }

        // Calculate averages and sort
        $rankings = [];
        foreach ($refRatings as $key => $rd) {
            $avg = $rd['count'] > 0 ? round($rd['total'] / $rd['count'], 1) : 0;
            $rankings[] = [
                'nama'   => $rd['nama'],
                'avg'    => $avg,
                'count'  => $rd['count'],
                'best'   => !empty($rd['scores']) ? max($rd['scores']) : 0,
            ];
        }
        usort($rankings, fn($a, $b) => $b['avg'] <=> $a['avg'] ?: $b['count'] <=> $a['count']);

        $ratingsData = [
            'average'      => $totalCount > 0 ? round($totalMarkah / $totalCount, 1) : 0,
            'total'        => $totalCount,
            'distribution' => $distribution,
            'rankings'     => array_slice($rankings, 0, 20),
        ];

        // ── Telegram Stats ──
        $tgTotal = (int) $pdo->query("SELECT COUNT(*) FROM users WHERE aktif = 1 AND email IS NOT NULL AND email != ''")->fetchColumn();
        $tgLinked = (int) $pdo->query("SELECT COUNT(*) FROM users WHERE aktif = 1 AND email IS NOT NULL AND email != '' AND telegram_chat_id IS NOT NULL AND telegram_chat_id != ''")->fetchColumn();

        // ── Lantikan (Jadual Perlawanan) Stats ──
        $sqlLantikan = <<<'SQL'
            SELECT COUNT(*) AS total,
                   SUM(CASE WHEN jp.status = 'Selesai' THEN 1 ELSE 0 END) AS selesai,
                   SUM(CASE WHEN jp.status = 'Disahkan' THEN 1 ELSE 0 END) AS disahkan,
                   SUM(CASE WHEN jp.status IN ('Belum Lantik','Menunggu Pengesahan') THEN 1 ELSE 0 END) AS belum
            FROM jadual_perlawanan jp
            JOIN kejohanan k ON jp.kejohanan_id = k.id
            WHERE YEAR(jp.tarikh) = :year
        SQL;
        $stmtLantikan = $pdo->prepare($sqlLantikan);
        $stmtLantikan->execute([':year' => $year]);
        $lantikanStats = $stmtLantikan->fetch();

        // ── Kejohanan Stats ──
        $sqlKejohanan = <<<'SQL'
            SELECT k.nama, k.status, k.anjuran, COUNT(jp.id) AS jum_perlawanan,
                   k.tarikh_mula, k.tarikh_akhir
            FROM kejohanan k
            LEFT JOIN jadual_perlawanan jp ON jp.kejohanan_id = k.id AND YEAR(jp.tarikh) = :year
            WHERE YEAR(k.tarikh_mula) = :year OR YEAR(k.tarikh_akhir) = :year
            GROUP BY k.id
            ORDER BY k.tarikh_mula DESC
        SQL;
        $stmtKejohanan = $pdo->prepare($sqlKejohanan);
        $stmtKejohanan->execute([':year' => $year]);
        $kejohananList = $stmtKejohanan->fetchAll();

        $statistics = [
            'year' => $year,
            'total' => count($referees),
            'genderBreakdown' => $genderBreakdown,
            'districtBreakdown' => $persatuanBreakdown,
            'districtAddressBreakdown' => $districtAddressBreakdown,
            'employmentBreakdown' => $employmentBreakdown,
            'monthlyTrend' => $monthlyTrend,
            'applications' => $applicationStats,
            'matches' => $matchStats,
            'exams' => $examStats,
            'ratings' => $ratingsData,
            'telegram' => ['total' => $tgTotal, 'linked' => $tgLinked],
            'lantikan' => [
                'total'    => (int) ($lantikanStats['total'] ?? 0),
                'selesai'  => (int) ($lantikanStats['selesai'] ?? 0),
                'disahkan' => (int) ($lantikanStats['disahkan'] ?? 0),
                'belum'    => (int) ($lantikanStats['belum'] ?? 0),
            ],
            'kejohanan' => $kejohananList,
        ];

        jsonResponse(['error' => false, 'data' => $statistics]);

    } catch (Throwable $e) {

        error_log('[statistics.php] handleStatistics: ' . $e->getMessage());

        $message = APP_DEBUG ? 'Ralat semasa memuatkan statistik: ' . $e->getMessage() : 'Ralat semasa memuatkan statistik.';

        jsonResponse(['error' => true, 'message' => $message], 500);

    }

}

