-- Rekod pembatalan / penangguhan perlawanan dan lantikan.
-- Serasi dengan MySQL lama pada shared hosting yang tidak menyokong
-- "ADD COLUMN IF NOT EXISTS".
-- Jalankan sekali pada pangkalan data production sebelum deploy.

ALTER TABLE lantikan_pengadil
    MODIFY status ENUM('Belum Jawab','Diterima','Ditolak','Dibatalkan','Ditangguhkan') NOT NULL DEFAULT 'Belum Jawab';

SET @sql = IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lantikan_pengadil' AND COLUMN_NAME = 'sebab_status') = 0,
    'ALTER TABLE lantikan_pengadil ADD COLUMN sebab_status TEXT NULL AFTER komen',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lantikan_pengadil' AND COLUMN_NAME = 'status_dikemaskini_at') = 0,
    'ALTER TABLE lantikan_pengadil ADD COLUMN status_dikemaskini_at TIMESTAMP NULL AFTER tarikh_jawab',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

ALTER TABLE jadual_perlawanan
    MODIFY status ENUM('Belum Lantik','Menunggu Pengesahan','Disahkan','Selesai','Dibatalkan','Ditangguhkan') NOT NULL DEFAULT 'Belum Lantik';

SET @sql = IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'jadual_perlawanan' AND COLUMN_NAME = 'sebab_status') = 0,
    'ALTER TABLE jadual_perlawanan ADD COLUMN sebab_status TEXT NULL AFTER status',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'jadual_perlawanan' AND COLUMN_NAME = 'status_dikemaskini_at') = 0,
    'ALTER TABLE jadual_perlawanan ADD COLUMN status_dikemaskini_at TIMESTAMP NULL AFTER sebab_status',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;