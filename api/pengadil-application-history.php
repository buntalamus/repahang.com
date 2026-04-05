<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(['error' => true, 'message' => 'Kaedah tidak dibenarkan.'], 405);
}

// Check if user is logged in
$user = requireAuth();

// Allow Pengadil, Penilai, and PP Daerah
$allowedRoles = ['Pengadil', 'Penilai', 'PP Daerah'];
if (!in_array($user['role'], $allowedRoles, true)) {
    jsonResponse(['error' => true, 'message' => 'Akses ditolak.'], 403);
}

try {
    $user_id = $user['id'];

    // Check if requesting a specific application
    $application_id = $_GET['application_id'] ?? null;

    if ($application_id) {
        // Fetch single application details - for applications owned by this pengadil
        $stmt = $pdo->prepare("
            SELECT
                p.*,
                u.nama_penuh,
                u.no_ic,
                u.email,
                u.no_telefon,
                u.alamat1,
                u.alamat2,
                u.poskod,
                u.daerah,
                u.negeri,
                u.status_kerja,
                u.jawatan,
                u.nama_majikan,
                u.alamat_majikan1,
                u.alamat_majikan2,
                u.poskod_majikan,
                u.daerah_majikan,
                u.negeri_majikan,
                u.nama_waris,
                u.hubungan_waris,
                u.telefon_waris,
                u.jenis_pengadil,
                u.tahun_mula_aktif,
                u.saiz_baju
            FROM permohonan p
            JOIN users u ON p.user_id = u.id
            WHERE p.id = ? AND p.user_id = ?
        ");

        $stmt->execute([$application_id, $user_id]);
        $application = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$application) {
            jsonResponse(['error' => true, 'message' => 'Permohonan tidak dijumpai atau akses ditolak.'], 404);
        }

        jsonResponse([
            'error' => false,
            'application' => $application
        ]);

    } else {
        // Map frontend type param to DB jenis_borang filter
        $typeParam = $_GET['type'] ?? '';
        $jenisBorangFilter = match($typeParam) {
            'berdaftar'        => 'pengadil_berdaftar',
            'kecergasan'       => 'pengadil_berdaftar',   // bundled with berdaftar
            'bertulis'         => 'ujian_bertulis',
            'kelas1'           => 'ujian_kelas1_fam',
            'penilai_berdaftar'=> 'penilai_berdaftar',
            'pp_berdaftar'     => 'pp_berdaftar',
            default            => null,
        };

        $whereClause = "WHERE p.user_id = ?";
        $params = [$user_id];
        if ($jenisBorangFilter) {
            $whereClause .= " AND p.jenis_borang = ?";
            $params[] = $jenisBorangFilter;
        }

        $stmt = $pdo->prepare("
            SELECT
                p.id,
                p.jenis_borang,
                p.tahun_permohonan,
                p.status,
                p.status_workflow,
                p.payment_amount,
                p.url_resit,
                p.pp_notes,
                p.admin_notes,
                p.mohon_ujian_kecergasan,
                DATE_FORMAT(p.tarikh_hantar, '%d/%m/%Y %H:%i') as tarikh_hantar,
                DATE_FORMAT(p.tarikh_hantar, '%Y-%m-%d') as tarikh_hantar_raw,
                IFNULL(pb.nama_persatuan, '') as district_name
            FROM permohonan p
            LEFT JOIN persatuan_bolasepak_daerah pb ON p.persatuan_id = pb.id
            {$whereClause}
            ORDER BY p.tarikh_hantar DESC
        ");

        $stmt->execute($params);
        $applications = $stmt->fetchAll(PDO::FETCH_ASSOC);

        jsonResponse([
            'error' => false,
            'data'  => $applications,
        ]);
    }

} catch (Exception $e) {
    jsonResponse([
        'error' => true,
        'message' => 'Ralat dalaman pelayan: ' . $e->getMessage()
    ], 500);
}