<?php

declare(strict_types=1);

if (!function_exists('ensurePenilaiPermohonanTable')) {
    function ensurePenilaiPermohonanTable(PDO $pdo): void
    {
        static $ensured = false;

        if ($ensured) {
            return;
        }

        $sql = <<<'SQL'
CREATE TABLE IF NOT EXISTS penilai_permohonan (
    id INT AUTO_INCREMENT PRIMARY KEY,
    permohonan_id INT NOT NULL,
    jenis_penilai VARCHAR(100) DEFAULT NULL,
    tahun_pengalaman INT DEFAULT NULL,
    kelayakan TEXT DEFAULT NULL,
    sijil_kursus_url VARCHAR(500) DEFAULT NULL,
    sijil_kesihatan_url VARCHAR(500) DEFAULT NULL,
    catatan TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_penilai_permohonan_permohonan FOREIGN KEY (permohonan_id) REFERENCES permohonan(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL;

        $pdo->exec($sql);
        $ensured = true;
    }
}
