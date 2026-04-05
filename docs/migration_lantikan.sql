-- Migration: Sistem Lantikan Pengadil
-- Jalankan: mysql -u root refpahang < docs/migration_lantikan.sql

CREATE TABLE IF NOT EXISTS kejohanan (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nama VARCHAR(255) NOT NULL,
    tarikh_mula DATE NOT NULL,
    tarikh_akhir DATE NOT NULL,
    tempat VARCHAR(255),
    anjuran VARCHAR(255),
    status ENUM('Draf','Aktif','Selesai') DEFAULT 'Draf',
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS jadual_perlawanan (
    id INT AUTO_INCREMENT PRIMARY KEY,
    kejohanan_id INT NOT NULL,
    no_perlawanan VARCHAR(20) NOT NULL,
    tarikh DATE NOT NULL,
    masa TIME NOT NULL,
    hari VARCHAR(20),
    kumpulan_tahap VARCHAR(100),
    pasukan_home VARCHAR(255),
    pasukan_away VARCHAR(255),
    tempat VARCHAR(255),
    status ENUM('Belum Lantik','Menunggu Pengesahan','Disahkan','Selesai') DEFAULT 'Belum Lantik',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (kejohanan_id) REFERENCES kejohanan(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS lantikan_pengadil (
    id INT AUTO_INCREMENT PRIMARY KEY,
    jadual_id INT NOT NULL,
    pengadil_id INT NOT NULL,
    jawatan ENUM('Pengadil Utama','Pembantu Pengadil 1','Pembantu Pengadil 2','Pengadil Keempat','Penilai Pengadil') NOT NULL,
    status ENUM('Belum Jawab','Diterima','Ditolak') DEFAULT 'Belum Jawab',
    komen TEXT,
    tarikh_jawab TIMESTAMP NULL,
    notif_hantar TINYINT(1) DEFAULT 0,
    tarikh_notif TIMESTAMP NULL,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (jadual_id) REFERENCES jadual_perlawanan(id) ON DELETE CASCADE,
    FOREIGN KEY (pengadil_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_match_role (jadual_id, jawatan)
);

CREATE TABLE IF NOT EXISTS laporan_penilaian (
    id INT AUTO_INCREMENT PRIMARY KEY,
    jadual_id INT NOT NULL,
    lantikan_id INT NOT NULL,
    penilai_id INT NULL,
    pengadil_id INT NULL,
    markah DECIMAL(4,1),
    tahap_kesukaran ENUM('Normal','Susah','Sangat Susah') DEFAULT 'Normal',
    kawalan_kekuatan TEXT,
    kawalan_kelemahan TEXT,
    kawalan_nasihat TEXT,
    fizikal_kekuatan TEXT,
    fizikal_kelemahan TEXT,
    fizikal_nasihat TEXT,
    kerjasama_kekuatan TEXT,
    kerjasama_kelemahan TEXT,
    kerjasama_nasihat TEXT,
    ulasan_keseluruhan TEXT,
    prestasi ENUM('Sangat Baik','Baik','Memuaskan','Tidak Memuaskan'),
    status ENUM('Draf','Dihantar','Disahkan') DEFAULT 'Draf',
    tarikh_hantar TIMESTAMP NULL,
    catatan_admin TEXT,
    tarikh_sahkan TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (jadual_id) REFERENCES jadual_perlawanan(id) ON DELETE CASCADE,
    FOREIGN KEY (lantikan_id) REFERENCES lantikan_pengadil(id) ON DELETE CASCADE
);

SELECT 'Migration complete' AS status;

-- Padang / Venue per Kejohanan
CREATE TABLE IF NOT EXISTS padang (
    id INT AUTO_INCREMENT PRIMARY KEY,
    kejohanan_id INT NOT NULL,
    nama VARCHAR(255) NOT NULL,
    alamat VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (kejohanan_id) REFERENCES kejohanan(id) ON DELETE CASCADE
);
