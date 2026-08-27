-- Migration: Pengesahan laporan RA oleh Pengerusi Pengadil
--
-- Aliran baharu:
--   RA hantar laporan -> Pengerusi Pengadil sahkan melalui pautan unik
--   -> Admin menerima salinan dan hanya boleh override dengan sebab.
--
-- Selamat dijalankan semula. Jalankan pada production sebelum deploy kod
-- pengesahan Pengerusi Pengadil.

CREATE TABLE IF NOT EXISTS kejohanan_pengesah_laporan (
    id INT NOT NULL AUTO_INCREMENT,
    kejohanan_id INT NOT NULL,
    pengesah_user_id INT NULL,
    pengesah_luar_id INT NULL,
    nama_snapshot VARCHAR(150) NOT NULL,
    jawatan_snapshot VARCHAR(150) NOT NULL DEFAULT 'Pengerusi Pengadil',
    peringkat_snapshot VARCHAR(30) NULL,
    aktif TINYINT(1) NOT NULL DEFAULT 1,
    created_by INT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_kejohanan_pengesah_laporan (kejohanan_id),
    KEY idx_kejohanan_pengesah_user (pengesah_user_id),
    KEY idx_kejohanan_pengesah_luar (pengesah_luar_id),
    CONSTRAINT fk_kejohanan_pengesah_kejohanan
        FOREIGN KEY (kejohanan_id) REFERENCES kejohanan(id) ON DELETE CASCADE,
    CONSTRAINT fk_kejohanan_pengesah_user
        FOREIGN KEY (pengesah_user_id) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_kejohanan_pengesah_luar
        FOREIGN KEY (pengesah_luar_id) REFERENCES pengadil_luar(id) ON DELETE RESTRICT,
    CONSTRAINT fk_kejohanan_pengesah_created_by
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS laporan_pengesahan_pengerusi (
    id BIGINT NOT NULL AUTO_INCREMENT,
    laporan_id INT NOT NULL,
    kejohanan_pengesah_id INT NULL,
    pengesah_user_id INT NULL,
    pengesah_luar_id INT NULL,
    pengesah_nama VARCHAR(150) NULL,
    pengesah_jawatan VARCHAR(150) NULL,
    pengesah_negeri VARCHAR(100) NULL,
    approval_token CHAR(64) NULL,
    status ENUM('Menunggu','Disahkan','Override Admin') NOT NULL DEFAULT 'Menunggu',
    email_recipient VARCHAR(190) NULL,
    email_sent_at DATETIME NULL,
    email_claimed_at DATETIME NULL,
    email_attempts INT NOT NULL DEFAULT 0,
    email_last_error TEXT NULL,
    telegram_chat_id BIGINT NULL,
    telegram_sent_at DATETIME NULL,
    telegram_claimed_at DATETIME NULL,
    telegram_attempts INT NOT NULL DEFAULT 0,
    telegram_last_error TEXT NULL,
    admin_copy_at DATETIME NULL,
    catatan_pengerusi TEXT NULL,
    tarikh_sahkan DATETIME NULL,
    admin_override_user_id INT NULL,
    alasan_override TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_laporan_pengesahan_laporan (laporan_id),
    UNIQUE KEY uq_laporan_pengesahan_token (approval_token),
    KEY idx_laporan_pengesahan_status (status, created_at),
    KEY idx_laporan_pengesahan_mapping (kejohanan_pengesah_id),
    KEY idx_laporan_pengesahan_user (pengesah_user_id),
    KEY idx_laporan_pengesahan_luar (pengesah_luar_id),
    KEY idx_laporan_pengesahan_override (admin_override_user_id),
    CONSTRAINT fk_laporan_pengesahan_laporan
        FOREIGN KEY (laporan_id) REFERENCES laporan_penilaian(id) ON DELETE RESTRICT,
    CONSTRAINT fk_laporan_pengesahan_mapping
        FOREIGN KEY (kejohanan_pengesah_id) REFERENCES kejohanan_pengesah_laporan(id) ON DELETE SET NULL,
    CONSTRAINT fk_laporan_pengesahan_user
        FOREIGN KEY (pengesah_user_id) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_laporan_pengesahan_luar
        FOREIGN KEY (pengesah_luar_id) REFERENCES pengadil_luar(id) ON DELETE RESTRICT,
    CONSTRAINT fk_laporan_pengesahan_override
        FOREIGN KEY (admin_override_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS kejohanan_pengesah_laporan_audit (
    id BIGINT NOT NULL AUTO_INCREMENT,
    kejohanan_id INT NOT NULL,
    kejohanan_pengesah_id INT NULL,
    event_type VARCHAR(40) NOT NULL,
    old_identity_json LONGTEXT NULL,
    new_identity_json LONGTEXT NULL,
    actor_user_id INT NULL,
    ip_address VARCHAR(45) NULL,
    user_agent VARCHAR(255) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_kejohanan_pengesah_audit_tournament (kejohanan_id, id),
    KEY idx_kejohanan_pengesah_audit_mapping (kejohanan_pengesah_id, id),
    CONSTRAINT fk_kejohanan_pengesah_audit_tournament
        FOREIGN KEY (kejohanan_id) REFERENCES kejohanan(id) ON DELETE RESTRICT,
    CONSTRAINT fk_kejohanan_pengesah_audit_mapping
        FOREIGN KEY (kejohanan_pengesah_id) REFERENCES kejohanan_pengesah_laporan(id) ON DELETE SET NULL,
    CONSTRAINT fk_kejohanan_pengesah_audit_actor
        FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS laporan_pengesahan_audit (
    id BIGINT NOT NULL AUTO_INCREMENT,
    laporan_pengesahan_id BIGINT NOT NULL,
    laporan_id INT NOT NULL,
    event_type VARCHAR(60) NOT NULL,
    channel VARCHAR(30) NOT NULL DEFAULT 'system',
    event_status VARCHAR(30) NOT NULL,
    actor_type VARCHAR(30) NOT NULL DEFAULT 'system',
    actor_user_id INT NULL,
    actor_luar_id INT NULL,
    link_url VARCHAR(2048) NULL,
    details_json LONGTEXT NULL,
    ip_address VARCHAR(45) NULL,
    user_agent VARCHAR(255) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_laporan_pengesahan_audit_state (laporan_pengesahan_id, id),
    KEY idx_laporan_pengesahan_audit_report (laporan_id, id),
    KEY idx_laporan_pengesahan_audit_event (event_type, event_status, created_at),
    CONSTRAINT fk_laporan_pengesahan_audit_state
        FOREIGN KEY (laporan_pengesahan_id) REFERENCES laporan_pengesahan_pengerusi(id) ON DELETE RESTRICT,
    CONSTRAINT fk_laporan_pengesahan_audit_report
        FOREIGN KEY (laporan_id) REFERENCES laporan_penilaian(id) ON DELETE RESTRICT,
    CONSTRAINT fk_laporan_pengesahan_audit_user
        FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_laporan_pengesahan_audit_luar
        FOREIGN KEY (actor_luar_id) REFERENCES pengadil_luar(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Rekod autoritatif Pengerusi Pengadil MSSM 2026.
-- Padanan menggunakan emel, bukan nombor id tetap, supaya selamat antara
-- pangkalan data yang mempunyai urutan id berlainan.
SET @mssm_kejohanan_id = (
    SELECT id
    FROM kejohanan
    WHERE nama = 'KEJOHANAN BOLA SEPAK MSSM TAHUN 2026 - PULAU PINANG'
      AND peringkat_kejohanan = 'Kebangsaan'
    LIMIT 1
);

SET @suhaizi_luar_id = (
    SELECT id
    FROM pengadil_luar
    WHERE LOWER(TRIM(emel)) = 'suhaizishukri1979@gmail.com'
      AND jenis_pengadil = 'Penilai Pengadil'
    LIMIT 1
);

-- Selaraskan ejaan nama berdasarkan maklumat autoritatif pengguna.
UPDATE pengadil_luar
SET nama = 'SUHAIZI BIN SHUKRI',
    daerah = 'Gurun',
    negeri = 'Kedah',
    no_tel = '010-4040151',
    jenis_pengadil = 'Penilai Pengadil'
WHERE id = @suhaizi_luar_id;

INSERT INTO kejohanan_pengesah_laporan (
    kejohanan_id,
    pengesah_user_id,
    pengesah_luar_id,
    nama_snapshot,
    jawatan_snapshot,
    peringkat_snapshot,
    aktif
)
SELECT
    @mssm_kejohanan_id,
    NULL,
    @suhaizi_luar_id,
    'SUHAIZI BIN SHUKRI',
    'PENGERUSI PENGADIL MSSM',
    'Kebangsaan',
    1
FROM DUAL
WHERE @mssm_kejohanan_id IS NOT NULL
  AND @suhaizi_luar_id IS NOT NULL
ON DUPLICATE KEY UPDATE
    kejohanan_id = VALUES(kejohanan_id);

-- Selaraskan blok pengesahan jadual MSSM yang sedia ada.
UPDATE jadual_lantikan_pengesahan
SET nama_penyahkan = 'SUHAIZI BIN SHUKRI',
    jawatan_penyahkan = 'PENGERUSI PENGADIL MSSM'
WHERE kejohanan_id = @mssm_kejohanan_id;

-- Mesti memulangkan tepat satu baris dengan kedua-dua flag bernilai 1.
SELECT
    k.id AS kejohanan_id,
    k.nama AS kejohanan,
    k.peringkat_kejohanan,
    p.id AS konfigurasi_id,
    p.nama_snapshot AS pengerusi,
    p.jawatan_snapshot AS jawatan,
    pl.negeri,
    pl.no_tel,
    pl.emel,
    CASE WHEN p.id IS NOT NULL THEN 1 ELSE 0 END AS konfigurasi_sedia,
    CASE WHEN pl.id IS NOT NULL THEN 1 ELSE 0 END AS identiti_sedia
FROM kejohanan k
LEFT JOIN kejohanan_pengesah_laporan p ON p.kejohanan_id = k.id AND p.aktif = 1
LEFT JOIN pengadil_luar pl ON pl.id = p.pengesah_luar_id
WHERE k.id = @mssm_kejohanan_id;
