-- Migration: Pengadil Luar + Pool Pengadil
-- Jalankan: mysql -u root refpahang < docs/migration_pool.sql

-- Pengadil Luar (unregistered referees from other states)
CREATE TABLE IF NOT EXISTS pengadil_luar (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nama VARCHAR(255) NOT NULL,
    negeri VARCHAR(100) NOT NULL,
    no_tel VARCHAR(20),
    emel VARCHAR(255),
    jenis_pengadil ENUM('Pengadil Negeri','Pengadil Kebangsaan') DEFAULT 'Pengadil Negeri',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Pool Pengadil - tag referees to a kejohanan
CREATE TABLE IF NOT EXISTS pool_pengadil (
    id INT AUTO_INCREMENT PRIMARY KEY,
    kejohanan_id INT NOT NULL,
    pengadil_id INT NULL,
    pengadil_luar_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (kejohanan_id) REFERENCES kejohanan(id) ON DELETE CASCADE,
    FOREIGN KEY (pengadil_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (pengadil_luar_id) REFERENCES pengadil_luar(id) ON DELETE CASCADE
);

ALTER TABLE pool_pengadil ADD UNIQUE KEY uq_pool_reg (kejohanan_id, pengadil_id);
ALTER TABLE pool_pengadil ADD UNIQUE KEY uq_pool_luar (kejohanan_id, pengadil_luar_id);

-- Modify lantikan_pengadil to support pengadil_luar
ALTER TABLE lantikan_pengadil MODIFY pengadil_id INT NULL;
ALTER TABLE lantikan_pengadil ADD COLUMN pengadil_luar_id INT NULL AFTER pengadil_id;
ALTER TABLE lantikan_pengadil ADD CONSTRAINT fk_lantikan_luar FOREIGN KEY (pengadil_luar_id) REFERENCES pengadil_luar(id) ON DELETE CASCADE;

SELECT 'Migration pengadil luar + pool complete' AS status;
