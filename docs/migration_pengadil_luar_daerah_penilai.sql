-- Tambah daerah dan jenis Penilai Pengadil untuk pegawai yang tidak
-- berdaftar dengan RefPahang.
-- Serasi dengan MySQL lama pada shared hosting yang tidak menyokong
-- "ADD COLUMN IF NOT EXISTS".
-- Jalankan sekali pada pangkalan data production sebelum deploy kod baharu.

SET @sql = IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pengadil_luar' AND COLUMN_NAME = 'daerah') = 0,
    'ALTER TABLE pengadil_luar ADD COLUMN daerah VARCHAR(100) NULL AFTER nama',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

ALTER TABLE pengadil_luar
    MODIFY jenis_pengadil ENUM(
        'Pengadil Negeri',
        'Pengadil Kebangsaan',
        'Kelas 1',
        'Kelas 2',
        'Kelas 3',
        'Penilai Pengadil'
    ) NOT NULL DEFAULT 'Pengadil Negeri';

-- Rekod lama ini perlu dilengkapkan berdasarkan daerah sebenar.
-- Jangan salin nilai negeri ke daerah secara automatik.
SELECT id, nama, daerah, negeri, jenis_pengadil
FROM pengadil_luar
WHERE daerah IS NULL OR TRIM(daerah) = ''
ORDER BY nama;
