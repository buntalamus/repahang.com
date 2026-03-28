<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

// Require Pengadil role or higher
requireRole(['Pengadil', 'Penilai', 'PP Daerah', 'Admin']);

try {
    $pdo = getDbConnection();

    // Fetch active referees
    // We get users with role 'Pengadil' or 'PP Daerah' who are active
    $stmt = $pdo->prepare("
        SELECT u.id, u.nama_penuh, u.role, u.no_ic as no_kp, u.jenis_pengadil,
               u.no_telefon, u.saiz_baju, u.email, u.url_gambar_profil,
               p.nama_persatuan as persatuan_nama
        FROM users u
        LEFT JOIN persatuan_bolasepak_daerah p ON u.persatuan_id = p.id
        WHERE u.role IN ('Pengadil', 'PP Daerah') 
        AND u.aktif = 1 
        ORDER BY u.nama_penuh ASC
    ");

    $stmt->execute();
    $referees = $stmt->fetchAll(PDO::FETCH_ASSOC);

    jsonResponse([
        'error' => false,
        'data' => $referees
    ]);

} catch (Throwable $e) {
    error_log('[get-active-referees.php] Error: ' . $e->getMessage());
    jsonResponse(['error' => true, 'message' => 'Gagal memuatkan senarai pengadil.'], 500);
}
