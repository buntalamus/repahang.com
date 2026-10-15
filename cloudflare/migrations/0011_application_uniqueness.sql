-- A person may submit only one application of each form type per session.
-- The source snapshot was checked for duplicates before adding this guard.
CREATE UNIQUE INDEX IF NOT EXISTS uq_permohonan_user_form_year
  ON permohonan(user_id, jenis_borang, tahun_permohonan);
