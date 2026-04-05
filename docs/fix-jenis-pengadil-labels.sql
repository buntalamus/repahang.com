-- Fix inconsistent jenis_pengadil labels
-- Normalize all UPPERCASE variants to Title Case
-- Target: Pengadil Negeri, Pengadil Kebangsaan, Penilai Pengadil, Pegawai Pembangunan
-- Date: 2026-04-05

-- ============ users table ============
UPDATE users SET jenis_pengadil = 'Pengadil Negeri' WHERE jenis_pengadil = 'PENGADIL NEGERI';
UPDATE users SET jenis_pengadil = 'Pengadil Kebangsaan' WHERE jenis_pengadil = 'PENGADIL KEBANGSAAN';
UPDATE users SET jenis_pengadil = 'Penilai Pengadil' WHERE jenis_pengadil = 'PENILAI PENGADIL';

-- ============ permohonan table ============
UPDATE permohonan SET jenis_pengadil = 'Pengadil Negeri' WHERE jenis_pengadil = 'PENGADIL NEGERI';
UPDATE permohonan SET jenis_pengadil = 'Pengadil Kebangsaan' WHERE jenis_pengadil = 'PENGADIL KEBANGSAAN';
UPDATE permohonan SET jenis_pengadil = 'Penilai Pengadil' WHERE jenis_pengadil = 'PENILAI PENGADIL';
