-- Migration: audit kekal lantikan, penghantaran dan pautan pengadil luar
-- WAJIB dilaksanakan sebelum kod penghantaran baharu digunakan.

CREATE TABLE IF NOT EXISTS lantikan_audit_log (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    event_key VARCHAR(100) NULL,
    lantikan_id INT NULL,
    jadual_id INT NULL,
    kejohanan_id INT NULL,
    pengadil_id INT NULL,
    pengadil_luar_id INT NULL,
    jawatan VARCHAR(100) NULL,
    nama_pegawai VARCHAR(255) NULL,
    emel_pegawai VARCHAR(255) NULL,
    no_telefon_pegawai VARCHAR(50) NULL,
    event_type VARCHAR(100) NOT NULL,
    channel VARCHAR(30) NOT NULL DEFAULT 'system',
    event_status VARCHAR(30) NOT NULL DEFAULT 'info',
    link_url TEXT NULL,
    details_json LONGTEXT NULL,
    actor_type VARCHAR(50) NOT NULL DEFAULT 'system',
    actor_user_id INT NULL,
    ip_address VARCHAR(45) NULL,
    user_agent VARCHAR(255) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_lantikan_audit_event_key (event_key),
    KEY idx_lantikan_audit_lantikan (lantikan_id, created_at),
    KEY idx_lantikan_audit_jadual (jadual_id, created_at),
    KEY idx_lantikan_audit_external (pengadil_luar_id, created_at),
    KEY idx_lantikan_audit_event (event_type, event_status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Onboarding Telegram pengadil luar dibuat sebelum lantikan dihantar. Jadual
-- ini sengaja berasingan daripada lantikan_pengadil supaya blast onboarding
-- tidak mengubah notif_hantar/tarikh_notif atau memulakan tempoh jawapan.
CREATE TABLE IF NOT EXISTS telegram_onboarding_batch (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    batch_token CHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    kejohanan_id INT NOT NULL,
    kejohanan_nama VARCHAR(255) NOT NULL,
    attempt_mode ENUM('initial', 'resend') NOT NULL DEFAULT 'initial',
    total_pool INT UNSIGNED NOT NULL DEFAULT 0,
    targeted_count INT UNSIGNED NOT NULL DEFAULT 0,
    sent_count INT UNSIGNED NOT NULL DEFAULT 0,
    failed_count INT UNSIGNED NOT NULL DEFAULT 0,
    skipped_count INT UNSIGNED NOT NULL DEFAULT 0,
    status ENUM('processing', 'completed', 'partial', 'failed') NOT NULL DEFAULT 'processing',
    actor_user_id INT NULL,
    ip_address VARCHAR(45) NULL,
    user_agent VARCHAR(255) NULL,
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_telegram_onboarding_batch_token (batch_token),
    KEY idx_telegram_onboarding_batch_tournament (kejohanan_id, started_at),
    KEY idx_telegram_onboarding_batch_status (status, started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Keadaan penghantaran semasa digunakan untuk claim atomik dan mengelakkan
-- dua klik/permintaan serentak menghantar emel pertama kepada orang yang sama.
CREATE TABLE IF NOT EXISTS telegram_onboarding_state (
    kejohanan_id INT NOT NULL,
    pengadil_luar_id INT NOT NULL,
    attempts INT UNSIGNED NOT NULL DEFAULT 0,
    first_sent_at TIMESTAMP NULL,
    last_sent_at TIMESTAMP NULL,
    last_failed_at TIMESTAMP NULL,
    last_error TEXT NULL,
    claim_token CHAR(32) CHARACTER SET ascii COLLATE ascii_bin NULL,
    claimed_at TIMESTAMP NULL,
    last_batch_id BIGINT UNSIGNED NULL,
    linked_at TIMESTAMP NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (kejohanan_id, pengadil_luar_id),
    KEY idx_telegram_onboarding_state_external (pengadil_luar_id, updated_at),
    KEY idx_telegram_onboarding_state_claim (claim_token, claimed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Log penerima adalah append-only dan menyimpan snapshot penerima serta pautan
-- tepat untuk semakan Admin. Tiada FK cascade supaya bukti kekal jika pool,
-- kejohanan atau profil luar dibuang kemudian.
CREATE TABLE IF NOT EXISTS telegram_onboarding_log (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    batch_id BIGINT UNSIGNED NOT NULL,
    batch_token CHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    kejohanan_id INT NOT NULL,
    kejohanan_nama VARCHAR(255) NOT NULL,
    pengadil_luar_id INT NOT NULL,
    nama_pegawai VARCHAR(255) NOT NULL,
    emel_pegawai VARCHAR(255) NULL,
    attempt_mode ENUM('initial', 'resend') NOT NULL DEFAULT 'initial',
    event_status ENUM('processing', 'sent', 'failed', 'skipped', 'linked') NOT NULL,
    reason VARCHAR(100) NULL,
    link_url TEXT NULL,
    error_message TEXT NULL,
    actor_user_id INT NULL,
    ip_address VARCHAR(45) NULL,
    user_agent VARCHAR(255) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_telegram_onboarding_log_batch (batch_id, id),
    KEY idx_telegram_onboarding_log_tournament (kejohanan_id, created_at),
    KEY idx_telegram_onboarding_log_external (pengadil_luar_id, created_at),
    KEY idx_telegram_onboarding_log_status (event_status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tambahan audit kejayaan pemautan untuk pemasangan yang telah menjalankan
-- versi awal migrasi ini. Shared hosting lama tidak menyokong ADD COLUMN IF
-- NOT EXISTS, jadi semakan information_schema digunakan supaya selamat
-- dijalankan semula.
SET @telegram_onboarding_linked_at_sql = IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'telegram_onboarding_state'
       AND COLUMN_NAME = 'linked_at') = 0,
    'ALTER TABLE telegram_onboarding_state ADD COLUMN linked_at TIMESTAMP NULL AFTER last_batch_id',
    'DO 0'
);
PREPARE telegram_onboarding_linked_at_stmt FROM @telegram_onboarding_linked_at_sql;
EXECUTE telegram_onboarding_linked_at_stmt;
DEALLOCATE PREPARE telegram_onboarding_linked_at_stmt;

-- Tambah nilai linked pada ENUM log. MODIFY adalah idempotent dan turut
-- memastikan pemasangan baharu/lama menggunakan definisi yang sama.
ALTER TABLE telegram_onboarding_log
    MODIFY event_status ENUM('processing', 'sent', 'failed', 'skipped', 'linked') NOT NULL;

-- Rekod asas untuk lantikan yang sudah wujud sebelum migrasi. Ini tidak
-- menjana token dan tidak menghantar sebarang notifikasi.
INSERT INTO lantikan_audit_log (
    event_key, lantikan_id, jadual_id, kejohanan_id,
    pengadil_id, pengadil_luar_id, jawatan,
    nama_pegawai, emel_pegawai, no_telefon_pegawai,
    event_type, channel, event_status, details_json, actor_type, created_at
)
SELECT
    CONCAT('backfill-lantikan-', lp.id), lp.id, lp.jadual_id, jp.kejohanan_id,
    lp.pengadil_id, lp.pengadil_luar_id, lp.jawatan,
    COALESCE(u.nama_penuh, pl.nama), COALESCE(u.email, pl.emel),
    COALESCE(u.no_telefon, pl.no_tel),
    'appointment_backfilled', 'system', 'info',
    JSON_OBJECT(
        'status', lp.status,
        'notif_hantar', lp.notif_hantar,
        'tg_notif_hantar', lp.tg_notif_hantar,
        'tarikh_notif', lp.tarikh_notif,
        'tarikh_jawab', lp.tarikh_jawab
    ),
    'migration', COALESCE(lp.created_at, CURRENT_TIMESTAMP)
FROM lantikan_pengadil lp
JOIN jadual_perlawanan jp ON jp.id = lp.jadual_id
LEFT JOIN users u ON u.id = lp.pengadil_id
LEFT JOIN pengadil_luar pl ON pl.id = lp.pengadil_luar_id
WHERE NOT EXISTS (
    SELECT 1
    FROM lantikan_audit_log al
    WHERE al.event_key = CONCAT('backfill-lantikan-', lp.id)
);

-- Identiti pool dan lantikan mestilah tepat satu: akaun berdaftar ATAU luar.
SET @pool_check_sql = (
    SELECT IF(
        EXISTS (
            SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
            WHERE CONSTRAINT_SCHEMA = DATABASE()
              AND TABLE_NAME = 'pool_pengadil'
              AND CONSTRAINT_NAME = 'chk_pool_single_identity'
        ),
        'DO 0',
        'ALTER TABLE pool_pengadil ADD CONSTRAINT chk_pool_single_identity CHECK ((pengadil_id IS NULL) <> (pengadil_luar_id IS NULL))'
    )
);
PREPARE pool_check_stmt FROM @pool_check_sql;
EXECUTE pool_check_stmt;
DEALLOCATE PREPARE pool_check_stmt;

SET @lantikan_check_sql = (
    SELECT IF(
        EXISTS (
            SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
            WHERE CONSTRAINT_SCHEMA = DATABASE()
              AND TABLE_NAME = 'lantikan_pengadil'
              AND CONSTRAINT_NAME = 'chk_lantikan_single_identity'
        ),
        'DO 0',
        'ALTER TABLE lantikan_pengadil ADD CONSTRAINT chk_lantikan_single_identity CHECK ((pengadil_id IS NULL) <> (pengadil_luar_id IS NULL))'
    )
);
PREPARE lantikan_check_stmt FROM @lantikan_check_sql;
EXECUTE lantikan_check_stmt;
DEALLOCATE PREPARE lantikan_check_stmt;

-- Profil pengadil luar yang pernah digunakan tidak boleh menghapuskan
-- lantikan/laporan secara cascade. API juga mempunyai semakan yang lebih jelas.
SET @drop_external_fk_sql = (
    SELECT IF(
        EXISTS (
            SELECT 1 FROM information_schema.REFERENTIAL_CONSTRAINTS
            WHERE CONSTRAINT_SCHEMA = DATABASE()
              AND TABLE_NAME = 'lantikan_pengadil'
              AND CONSTRAINT_NAME = 'fk_lantikan_luar'
        ),
        'ALTER TABLE lantikan_pengadil DROP FOREIGN KEY fk_lantikan_luar',
        'DO 0'
    )
);
PREPARE drop_external_fk_stmt FROM @drop_external_fk_sql;
EXECUTE drop_external_fk_stmt;
DEALLOCATE PREPARE drop_external_fk_stmt;
ALTER TABLE lantikan_pengadil
    ADD CONSTRAINT fk_lantikan_luar
    FOREIGN KEY (pengadil_luar_id) REFERENCES pengadil_luar(id)
    ON DELETE RESTRICT;
