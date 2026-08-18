CREATE TABLE IF NOT EXISTS kup_crew_notifications (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    jadual_id INT NOT NULL,
    lantikan_id INT NOT NULL,
    crew_fingerprint CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    crew_signature CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    telegram_applicable TINYINT(1) NOT NULL DEFAULT 0,
    email_applicable TINYINT(1) NOT NULL DEFAULT 0,
    telegram_sent_at DATETIME NULL,
    email_sent_at DATETIME NULL,
    telegram_claimed_at DATETIME NULL,
    email_claimed_at DATETIME NULL,
    telegram_next_attempt_at DATETIME NULL,
    email_next_attempt_at DATETIME NULL,
    telegram_attempts INT UNSIGNED NOT NULL DEFAULT 0,
    email_attempts INT UNSIGNED NOT NULL DEFAULT 0,
    telegram_last_error VARCHAR(500) NULL,
    email_last_error VARCHAR(500) NULL,
    completed_at DATETIME NULL,
    superseded_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_kup_crew_recipient (jadual_id, crew_signature, lantikan_id),
    KEY idx_kup_crew_pending (completed_at, superseded_at),
    KEY idx_kup_crew_match (jadual_id, crew_signature),
    KEY idx_kup_crew_fingerprint (jadual_id, crew_fingerprint, superseded_at),
    CONSTRAINT fk_kup_crew_notification_match
        FOREIGN KEY (jadual_id) REFERENCES jadual_perlawanan(id) ON DELETE CASCADE,
    CONSTRAINT fk_kup_crew_notification_appointment
        FOREIGN KEY (lantikan_id) REFERENCES lantikan_pengadil(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Rekod satu versi krew bagi setiap penerima. Setiap saluran dituntut secara
-- atomik sebelum dihantar, disimpan selepas berjaya, dan dicuba semula dengan
-- backoff jika gagal. Jalankan migrasi ini sebelum deploy kod 19 Ogos 2026.
