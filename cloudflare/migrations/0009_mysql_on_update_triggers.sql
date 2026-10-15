-- MySQL refreshed these columns with ON UPDATE CURRENT_TIMESTAMP whenever
-- another column actually changed and the statement did not set them itself.
-- The D1 import lost that clause, so these triggers restore the behaviour for
-- every Worker route. Generated from refpahan_refpahang-3.sql.

DROP TRIGGER IF EXISTS "mysql_on_update_announcements";
CREATE TRIGGER "mysql_on_update_announcements" AFTER UPDATE ON "announcements"
WHEN (NEW."updated_at" IS OLD."updated_at") AND (NEW."id" IS NOT OLD."id" OR NEW."title" IS NOT OLD."title" OR NEW."content" IS NOT OLD."content" OR NEW."created_by" IS NOT OLD."created_by" OR NEW."created_at" IS NOT OLD."created_at")
BEGIN
  UPDATE "announcements" SET "updated_at"=datetime('now','+8 hours') WHERE rowid=NEW.rowid;
END;

DROP TRIGGER IF EXISTS "mysql_on_update_application_settings";
CREATE TRIGGER "mysql_on_update_application_settings" AFTER UPDATE ON "application_settings"
WHEN (NEW."updated_at" IS OLD."updated_at") AND (NEW."setting_key" IS NOT OLD."setting_key" OR NEW."setting_value" IS NOT OLD."setting_value" OR NEW."setting_description" IS NOT OLD."setting_description" OR NEW."created_at" IS NOT OLD."created_at")
BEGIN
  UPDATE "application_settings" SET "updated_at"=datetime('now','+8 hours') WHERE rowid=NEW.rowid;
END;

DROP TRIGGER IF EXISTS "mysql_on_update_districts";
CREATE TRIGGER "mysql_on_update_districts" AFTER UPDATE ON "districts"
WHEN (NEW."updated_at" IS OLD."updated_at") AND (NEW."id" IS NOT OLD."id" OR NEW."nama" IS NOT OLD."nama" OR NEW."kod" IS NOT OLD."kod" OR NEW."aktif" IS NOT OLD."aktif" OR NEW."created_at" IS NOT OLD."created_at")
BEGIN
  UPDATE "districts" SET "updated_at"=datetime('now','+8 hours') WHERE rowid=NEW.rowid;
END;

DROP TRIGGER IF EXISTS "mysql_on_update_jadual_perlawanan";
CREATE TRIGGER "mysql_on_update_jadual_perlawanan" AFTER UPDATE ON "jadual_perlawanan"
WHEN (NEW."updated_at" IS OLD."updated_at") AND (NEW."id" IS NOT OLD."id" OR NEW."kejohanan_id" IS NOT OLD."kejohanan_id" OR NEW."no_perlawanan" IS NOT OLD."no_perlawanan" OR NEW."tarikh" IS NOT OLD."tarikh" OR NEW."masa" IS NOT OLD."masa" OR NEW."hari" IS NOT OLD."hari" OR NEW."kumpulan_tahap" IS NOT OLD."kumpulan_tahap" OR NEW."kategori" IS NOT OLD."kategori" OR NEW."peringkat" IS NOT OLD."peringkat" OR NEW."kumpulan" IS NOT OLD."kumpulan" OR NEW."pasukan_home" IS NOT OLD."pasukan_home" OR NEW."logo_home" IS NOT OLD."logo_home" OR NEW."pasukan_away" IS NOT OLD."pasukan_away" OR NEW."logo_away" IS NOT OLD."logo_away" OR NEW."tempat" IS NOT OLD."tempat" OR NEW."status" IS NOT OLD."status" OR NEW."sebab_status" IS NOT OLD."sebab_status" OR NEW."status_dikemaskini_at" IS NOT OLD."status_dikemaskini_at" OR NEW."created_at" IS NOT OLD."created_at")
BEGIN
  UPDATE "jadual_perlawanan" SET "updated_at"=datetime('now','+8 hours') WHERE rowid=NEW.rowid;
END;

DROP TRIGGER IF EXISTS "mysql_on_update_kejohanan";
CREATE TRIGGER "mysql_on_update_kejohanan" AFTER UPDATE ON "kejohanan"
WHEN (NEW."updated_at" IS OLD."updated_at") AND (NEW."id" IS NOT OLD."id" OR NEW."nama" IS NOT OLD."nama" OR NEW."jenis_kejohanan" IS NOT OLD."jenis_kejohanan" OR NEW."peringkat_kejohanan" IS NOT OLD."peringkat_kejohanan" OR NEW."tarikh_mula" IS NOT OLD."tarikh_mula" OR NEW."tarikh_akhir" IS NOT OLD."tarikh_akhir" OR NEW."tempat" IS NOT OLD."tempat" OR NEW."anjuran" IS NOT OLD."anjuran" OR NEW."logo_kiri" IS NOT OLD."logo_kiri" OR NEW."logo_kanan" IS NOT OLD."logo_kanan" OR NEW."status" IS NOT OLD."status" OR NEW."created_by" IS NOT OLD."created_by" OR NEW."created_at" IS NOT OLD."created_at")
BEGIN
  UPDATE "kejohanan" SET "updated_at"=datetime('now','+8 hours') WHERE rowid=NEW.rowid;
END;

DROP TRIGGER IF EXISTS "mysql_on_update_kejohanan_pengesah_laporan";
CREATE TRIGGER "mysql_on_update_kejohanan_pengesah_laporan" AFTER UPDATE ON "kejohanan_pengesah_laporan"
WHEN (NEW."updated_at" IS OLD."updated_at") AND (NEW."id" IS NOT OLD."id" OR NEW."kejohanan_id" IS NOT OLD."kejohanan_id" OR NEW."pengesah_user_id" IS NOT OLD."pengesah_user_id" OR NEW."pengesah_luar_id" IS NOT OLD."pengesah_luar_id" OR NEW."nama_snapshot" IS NOT OLD."nama_snapshot" OR NEW."jawatan_snapshot" IS NOT OLD."jawatan_snapshot" OR NEW."peringkat_snapshot" IS NOT OLD."peringkat_snapshot" OR NEW."aktif" IS NOT OLD."aktif" OR NEW."created_by" IS NOT OLD."created_by" OR NEW."created_at" IS NOT OLD."created_at")
BEGIN
  UPDATE "kejohanan_pengesah_laporan" SET "updated_at"=datetime('now','+8 hours') WHERE rowid=NEW.rowid;
END;

DROP TRIGGER IF EXISTS "mysql_on_update_kup_crew_notifications";
CREATE TRIGGER "mysql_on_update_kup_crew_notifications" AFTER UPDATE ON "kup_crew_notifications"
WHEN (NEW."updated_at" IS OLD."updated_at") AND (NEW."id" IS NOT OLD."id" OR NEW."jadual_id" IS NOT OLD."jadual_id" OR NEW."lantikan_id" IS NOT OLD."lantikan_id" OR NEW."crew_fingerprint" IS NOT OLD."crew_fingerprint" OR NEW."crew_signature" IS NOT OLD."crew_signature" OR NEW."telegram_applicable" IS NOT OLD."telegram_applicable" OR NEW."email_applicable" IS NOT OLD."email_applicable" OR NEW."telegram_sent_at" IS NOT OLD."telegram_sent_at" OR NEW."email_sent_at" IS NOT OLD."email_sent_at" OR NEW."telegram_claimed_at" IS NOT OLD."telegram_claimed_at" OR NEW."email_claimed_at" IS NOT OLD."email_claimed_at" OR NEW."telegram_next_attempt_at" IS NOT OLD."telegram_next_attempt_at" OR NEW."email_next_attempt_at" IS NOT OLD."email_next_attempt_at" OR NEW."telegram_attempts" IS NOT OLD."telegram_attempts" OR NEW."email_attempts" IS NOT OLD."email_attempts" OR NEW."telegram_last_error" IS NOT OLD."telegram_last_error" OR NEW."email_last_error" IS NOT OLD."email_last_error" OR NEW."completed_at" IS NOT OLD."completed_at" OR NEW."superseded_at" IS NOT OLD."superseded_at" OR NEW."created_at" IS NOT OLD."created_at")
BEGIN
  UPDATE "kup_crew_notifications" SET "updated_at"=datetime('now','+8 hours') WHERE rowid=NEW.rowid;
END;

DROP TRIGGER IF EXISTS "mysql_on_update_lantikan_pengadil";
CREATE TRIGGER "mysql_on_update_lantikan_pengadil" AFTER UPDATE ON "lantikan_pengadil"
WHEN (NEW."updated_at" IS OLD."updated_at") AND (NEW."id" IS NOT OLD."id" OR NEW."jadual_id" IS NOT OLD."jadual_id" OR NEW."pengadil_id" IS NOT OLD."pengadil_id" OR NEW."pengadil_luar_id" IS NOT OLD."pengadil_luar_id" OR NEW."jawatan" IS NOT OLD."jawatan" OR NEW."status" IS NOT OLD."status" OR NEW."komen" IS NOT OLD."komen" OR NEW."sebab_status" IS NOT OLD."sebab_status" OR NEW."tarikh_jawab" IS NOT OLD."tarikh_jawab" OR NEW."status_dikemaskini_at" IS NOT OLD."status_dikemaskini_at" OR NEW."notif_hantar" IS NOT OLD."notif_hantar" OR NEW."tg_token" IS NOT OLD."tg_token" OR NEW."email_token" IS NOT OLD."email_token" OR NEW."penilaian_token" IS NOT OLD."penilaian_token" OR NEW."tg_notif_hantar" IS NOT OLD."tg_notif_hantar" OR NEW."tarikh_notif" IS NOT OLD."tarikh_notif" OR NEW."created_by" IS NOT OLD."created_by" OR NEW."created_at" IS NOT OLD."created_at")
BEGIN
  UPDATE "lantikan_pengadil" SET "updated_at"=datetime('now','+8 hours') WHERE rowid=NEW.rowid;
END;

DROP TRIGGER IF EXISTS "mysql_on_update_laporan_pengesahan_pengerusi";
CREATE TRIGGER "mysql_on_update_laporan_pengesahan_pengerusi" AFTER UPDATE ON "laporan_pengesahan_pengerusi"
WHEN (NEW."updated_at" IS OLD."updated_at") AND (NEW."id" IS NOT OLD."id" OR NEW."laporan_id" IS NOT OLD."laporan_id" OR NEW."kejohanan_pengesah_id" IS NOT OLD."kejohanan_pengesah_id" OR NEW."pengesah_user_id" IS NOT OLD."pengesah_user_id" OR NEW."pengesah_luar_id" IS NOT OLD."pengesah_luar_id" OR NEW."pengesah_nama" IS NOT OLD."pengesah_nama" OR NEW."pengesah_jawatan" IS NOT OLD."pengesah_jawatan" OR NEW."pengesah_negeri" IS NOT OLD."pengesah_negeri" OR NEW."approval_token" IS NOT OLD."approval_token" OR NEW."status" IS NOT OLD."status" OR NEW."email_recipient" IS NOT OLD."email_recipient" OR NEW."email_sent_at" IS NOT OLD."email_sent_at" OR NEW."email_claimed_at" IS NOT OLD."email_claimed_at" OR NEW."email_attempts" IS NOT OLD."email_attempts" OR NEW."email_last_error" IS NOT OLD."email_last_error" OR NEW."telegram_chat_id" IS NOT OLD."telegram_chat_id" OR NEW."telegram_sent_at" IS NOT OLD."telegram_sent_at" OR NEW."telegram_claimed_at" IS NOT OLD."telegram_claimed_at" OR NEW."telegram_attempts" IS NOT OLD."telegram_attempts" OR NEW."telegram_last_error" IS NOT OLD."telegram_last_error" OR NEW."admin_copy_at" IS NOT OLD."admin_copy_at" OR NEW."catatan_pengerusi" IS NOT OLD."catatan_pengerusi" OR NEW."tarikh_sahkan" IS NOT OLD."tarikh_sahkan" OR NEW."admin_override_user_id" IS NOT OLD."admin_override_user_id" OR NEW."alasan_override" IS NOT OLD."alasan_override" OR NEW."created_at" IS NOT OLD."created_at")
BEGIN
  UPDATE "laporan_pengesahan_pengerusi" SET "updated_at"=datetime('now','+8 hours') WHERE rowid=NEW.rowid;
END;

DROP TRIGGER IF EXISTS "mysql_on_update_laporan_penilaian";
CREATE TRIGGER "mysql_on_update_laporan_penilaian" AFTER UPDATE ON "laporan_penilaian"
WHEN (NEW."updated_at" IS OLD."updated_at") AND (NEW."id" IS NOT OLD."id" OR NEW."jadual_id" IS NOT OLD."jadual_id" OR NEW."lantikan_id" IS NOT OLD."lantikan_id" OR NEW."penilai_id" IS NOT OLD."penilai_id" OR NEW."pengadil_id" IS NOT OLD."pengadil_id" OR NEW."markah" IS NOT OLD."markah" OR NEW."tahap_kesukaran" IS NOT OLD."tahap_kesukaran" OR NEW."skor_ht_home" IS NOT OLD."skor_ht_home" OR NEW."skor_ht_away" IS NOT OLD."skor_ht_away" OR NEW."skor_ft_home" IS NOT OLD."skor_ft_home" OR NEW."skor_ft_away" IS NOT OLD."skor_ft_away" OR NEW."skor_et_home" IS NOT OLD."skor_et_home" OR NEW."skor_et_away" IS NOT OLD."skor_et_away" OR NEW."skor_ps_home" IS NOT OLD."skor_ps_home" OR NEW."skor_ps_away" IS NOT OLD."skor_ps_away" OR NEW."cuaca" IS NOT OLD."cuaca" OR NEW."kawalan_kekuatan" IS NOT OLD."kawalan_kekuatan" OR NEW."kawalan_kelemahan" IS NOT OLD."kawalan_kelemahan" OR NEW."kawalan_nasihat" IS NOT OLD."kawalan_nasihat" OR NEW."fizikal_kekuatan" IS NOT OLD."fizikal_kekuatan" OR NEW."fizikal_kelemahan" IS NOT OLD."fizikal_kelemahan" OR NEW."fizikal_nasihat" IS NOT OLD."fizikal_nasihat" OR NEW."kerjasama_kekuatan" IS NOT OLD."kerjasama_kekuatan" OR NEW."kerjasama_kelemahan" IS NOT OLD."kerjasama_kelemahan" OR NEW."kerjasama_nasihat" IS NOT OLD."kerjasama_nasihat" OR NEW."ulasan_keseluruhan" IS NOT OLD."ulasan_keseluruhan" OR NEW."prestasi" IS NOT OLD."prestasi" OR NEW."status" IS NOT OLD."status" OR NEW."tarikh_hantar" IS NOT OLD."tarikh_hantar" OR NEW."catatan_admin" IS NOT OLD."catatan_admin" OR NEW."tarikh_sahkan" IS NOT OLD."tarikh_sahkan" OR NEW."created_at" IS NOT OLD."created_at")
BEGIN
  UPDATE "laporan_penilaian" SET "updated_at"=datetime('now','+8 hours') WHERE rowid=NEW.rowid;
END;

DROP TRIGGER IF EXISTS "mysql_on_update_pasukan_logo";
CREATE TRIGGER "mysql_on_update_pasukan_logo" AFTER UPDATE ON "pasukan_logo"
WHEN (NEW."updated_at" IS OLD."updated_at") AND (NEW."id" IS NOT OLD."id" OR NEW."nama" IS NOT OLD."nama" OR NEW."logo_path" IS NOT OLD."logo_path" OR NEW."created_at" IS NOT OLD."created_at")
BEGIN
  UPDATE "pasukan_logo" SET "updated_at"=datetime('now','+8 hours') WHERE rowid=NEW.rowid;
END;

DROP TRIGGER IF EXISTS "mysql_on_update_pengadil_luar";
CREATE TRIGGER "mysql_on_update_pengadil_luar" AFTER UPDATE ON "pengadil_luar"
WHEN (NEW."updated_at" IS OLD."updated_at") AND (NEW."id" IS NOT OLD."id" OR NEW."nama" IS NOT OLD."nama" OR NEW."daerah" IS NOT OLD."daerah" OR NEW."negeri" IS NOT OLD."negeri" OR NEW."no_tel" IS NOT OLD."no_tel" OR NEW."emel" IS NOT OLD."emel" OR NEW."telegram_chat_id" IS NOT OLD."telegram_chat_id" OR NEW."tg_link_token" IS NOT OLD."tg_link_token" OR NEW."jenis_pengadil" IS NOT OLD."jenis_pengadil" OR NEW."created_at" IS NOT OLD."created_at")
BEGIN
  UPDATE "pengadil_luar" SET "updated_at"=datetime('now','+8 hours') WHERE rowid=NEW.rowid;
END;

DROP TRIGGER IF EXISTS "mysql_on_update_penilai_permohonan";
CREATE TRIGGER "mysql_on_update_penilai_permohonan" AFTER UPDATE ON "penilai_permohonan"
WHEN (NEW."updated_at" IS OLD."updated_at") AND (NEW."id" IS NOT OLD."id" OR NEW."permohonan_id" IS NOT OLD."permohonan_id" OR NEW."jenis_penilai" IS NOT OLD."jenis_penilai" OR NEW."tahun_pengalaman" IS NOT OLD."tahun_pengalaman" OR NEW."kelayakan" IS NOT OLD."kelayakan" OR NEW."sijil_kursus_url" IS NOT OLD."sijil_kursus_url" OR NEW."sijil_kesihatan_url" IS NOT OLD."sijil_kesihatan_url" OR NEW."catatan" IS NOT OLD."catatan" OR NEW."created_at" IS NOT OLD."created_at")
BEGIN
  UPDATE "penilai_permohonan" SET "updated_at"=datetime('now','+8 hours') WHERE rowid=NEW.rowid;
END;

DROP TRIGGER IF EXISTS "mysql_on_update_penilaian";
CREATE TRIGGER "mysql_on_update_penilaian" AFTER UPDATE ON "penilaian"
WHEN (NEW."updated_at" IS OLD."updated_at") AND (NEW."id" IS NOT OLD."id" OR NEW."perlawanan_id" IS NOT OLD."perlawanan_id" OR NEW."pengadil_id" IS NOT OLD."pengadil_id" OR NEW."penilai_id" IS NOT OLD."penilai_id" OR NEW."skor_pengetahuan" IS NOT OLD."skor_pengetahuan" OR NEW."skor_kedudukan" IS NOT OLD."skor_kedudukan" OR NEW."skor_keputusan" IS NOT OLD."skor_keputusan" OR NEW."skor_kerjasama" IS NOT OLD."skor_kerjasama" OR NEW."skor_penampilan" IS NOT OLD."skor_penampilan" OR NEW."jumlah_skor" IS NOT OLD."jumlah_skor" OR NEW."catatan" IS NOT OLD."catatan" OR NEW."created_at" IS NOT OLD."created_at" OR NEW."score_teknikal" IS NOT OLD."score_teknikal" OR NEW."score_fizikal" IS NOT OLD."score_fizikal" OR NEW."score_mental" IS NOT OLD."score_mental" OR NEW."score_disiplin" IS NOT OLD."score_disiplin" OR NEW."status_penilaian" IS NOT OLD."status_penilaian" OR NEW."komen_penilai" IS NOT OLD."komen_penilai" OR NEW."tarikh_penilaian" IS NOT OLD."tarikh_penilaian")
BEGIN
  UPDATE "penilaian" SET "updated_at"=datetime('now','+8 hours') WHERE rowid=NEW.rowid;
END;

DROP TRIGGER IF EXISTS "mysql_on_update_perlawanan_pengadil";
CREATE TRIGGER "mysql_on_update_perlawanan_pengadil" AFTER UPDATE ON "perlawanan_pengadil"
WHEN (NEW."updated_at" IS OLD."updated_at") AND (NEW."id" IS NOT OLD."id" OR NEW."perlawanan_id" IS NOT OLD."perlawanan_id" OR NEW."pengadil_id" IS NOT OLD."pengadil_id" OR NEW."status_pp" IS NOT OLD."status_pp" OR NEW."status_pengadil" IS NOT OLD."status_pengadil" OR NEW."komen_pengadil" IS NOT OLD."komen_pengadil" OR NEW."tarikh_jawab" IS NOT OLD."tarikh_jawab" OR NEW."catatan_pp" IS NOT OLD."catatan_pp" OR NEW."created_at" IS NOT OLD."created_at")
BEGIN
  UPDATE "perlawanan_pengadil" SET "updated_at"=datetime('now','+8 hours') WHERE rowid=NEW.rowid;
END;

DROP TRIGGER IF EXISTS "mysql_on_update_permohonan";
CREATE TRIGGER "mysql_on_update_permohonan" AFTER UPDATE ON "permohonan"
WHEN (NEW."status_kemaskini" IS OLD."status_kemaskini" AND NEW."updated_at" IS OLD."updated_at") AND (NEW."id" IS NOT OLD."id" OR NEW."user_id" IS NOT OLD."user_id" OR NEW."district_id" IS NOT OLD."district_id" OR NEW."persatuan_id" IS NOT OLD."persatuan_id" OR NEW."tahun_permohonan" IS NOT OLD."tahun_permohonan" OR NEW."jenis_permohonan" IS NOT OLD."jenis_permohonan" OR NEW."jenis_borang" IS NOT OLD."jenis_borang" OR NEW."nama_penuh" IS NOT OLD."nama_penuh" OR NEW."no_kp" IS NOT OLD."no_kp" OR NEW."emel" IS NOT OLD."emel" OR NEW."no_telefon" IS NOT OLD."no_telefon" OR NEW."jantina" IS NOT OLD."jantina" OR NEW."jenis_pengadil" IS NOT OLD."jenis_pengadil" OR NEW."persatuan_daerah" IS NOT OLD."persatuan_daerah" OR NEW."saiz_baju" IS NOT OLD."saiz_baju" OR NEW."tahun_mula_aktif" IS NOT OLD."tahun_mula_aktif" OR NEW."alamat1" IS NOT OLD."alamat1" OR NEW."alamat2" IS NOT OLD."alamat2" OR NEW."poskod" IS NOT OLD."poskod" OR NEW."daerah" IS NOT OLD."daerah" OR NEW."negeri" IS NOT OLD."negeri" OR NEW."status_kerja" IS NOT OLD."status_kerja" OR NEW."jawatan" IS NOT OLD."jawatan" OR NEW."nama_majikan" IS NOT OLD."nama_majikan" OR NEW."alamat_majikan1" IS NOT OLD."alamat_majikan1" OR NEW."alamat_majikan2" IS NOT OLD."alamat_majikan2" OR NEW."poskod_majikan" IS NOT OLD."poskod_majikan" OR NEW."daerah_majikan" IS NOT OLD."daerah_majikan" OR NEW."negeri_majikan" IS NOT OLD."negeri_majikan" OR NEW."nama_waris" IS NOT OLD."nama_waris" OR NEW."hubungan_waris" IS NOT OLD."hubungan_waris" OR NEW."telefon_waris" IS NOT OLD."telefon_waris" OR NEW."url_resit" IS NOT OLD."url_resit" OR NEW."url_gambar_profil" IS NOT OLD."url_gambar_profil" OR NEW."status" IS NOT OLD."status" OR NEW."status_workflow" IS NOT OLD."status_workflow" OR NEW."pp_verified_at" IS NOT OLD."pp_verified_at" OR NEW."pp_verified_by" IS NOT OLD."pp_verified_by" OR NEW."pp_notes" IS NOT OLD."pp_notes" OR NEW."admin_approved_at" IS NOT OLD."admin_approved_at" OR NEW."admin_approved_by" IS NOT OLD."admin_approved_by" OR NEW."admin_notes" IS NOT OLD."admin_notes" OR NEW."payment_receipt_url" IS NOT OLD."payment_receipt_url" OR NEW."payment_amount" IS NOT OLD."payment_amount" OR NEW."payment_verified_at" IS NOT OLD."payment_verified_at" OR NEW."final_approved_at" IS NOT OLD."final_approved_at" OR NEW."tarikh_hantar" IS NOT OLD."tarikh_hantar" OR NEW."mohon_r1" IS NOT OLD."mohon_r1" OR NEW."mohon_r2" IS NOT OLD."mohon_r2" OR NEW."mohon_ujian_bertulis" IS NOT OLD."mohon_ujian_bertulis" OR NEW."mohon_ujian_kecergasan" IS NOT OLD."mohon_ujian_kecergasan" OR NEW."declare1" IS NOT OLD."declare1" OR NEW."declare2" IS NOT OLD."declare2" OR NEW."declare3" IS NOT OLD."declare3" OR NEW."declare4" IS NOT OLD."declare4" OR NEW."declare5" IS NOT OLD."declare5" OR NEW."umur" IS NOT OLD."umur" OR NEW."tarikh_lahir" IS NOT OLD."tarikh_lahir" OR NEW."tempat_lahir" IS NOT OLD."tempat_lahir" OR NEW."workflow_status" IS NOT OLD."workflow_status" OR NEW."status_ujian" IS NOT OLD."status_ujian")
BEGIN
  UPDATE "permohonan" SET "status_kemaskini"=datetime('now','+8 hours'), "updated_at"=datetime('now','+8 hours') WHERE rowid=NEW.rowid;
END;

DROP TRIGGER IF EXISTS "mysql_on_update_permohonan_pp";
CREATE TRIGGER "mysql_on_update_permohonan_pp" AFTER UPDATE ON "permohonan_pp"
WHEN (NEW."updated_at" IS OLD."updated_at") AND (NEW."id" IS NOT OLD."id" OR NEW."user_id" IS NOT OLD."user_id" OR NEW."persatuan_id" IS NOT OLD."persatuan_id" OR NEW."jenis_permohonan" IS NOT OLD."jenis_permohonan" OR NEW."nama_penuh" IS NOT OLD."nama_penuh" OR NEW."no_ic" IS NOT OLD."no_ic" OR NEW."email" IS NOT OLD."email" OR NEW."no_telefon" IS NOT OLD."no_telefon" OR NEW."tarikh_lahir" IS NOT OLD."tarikh_lahir" OR NEW."jantina" IS NOT OLD."jantina" OR NEW."alamat" IS NOT OLD."alamat" OR NEW."poskod" IS NOT OLD."poskod" OR NEW."daerah" IS NOT OLD."daerah" OR NEW."negeri" IS NOT OLD."negeri" OR NEW."status_kerja" IS NOT OLD."status_kerja" OR NEW."jawatan" IS NOT OLD."jawatan" OR NEW."nama_majikan" IS NOT OLD."nama_majikan" OR NEW."alamat_majikan1" IS NOT OLD."alamat_majikan1" OR NEW."alamat_majikan2" IS NOT OLD."alamat_majikan2" OR NEW."poskod_majikan" IS NOT OLD."poskod_majikan" OR NEW."daerah_majikan" IS NOT OLD."daerah_majikan" OR NEW."negeri_majikan" IS NOT OLD."negeri_majikan" OR NEW."nama_waris" IS NOT OLD."nama_waris" OR NEW."hubungan_waris" IS NOT OLD."hubungan_waris" OR NEW."telefon_waris" IS NOT OLD."telefon_waris" OR NEW."jenis_pengadil" IS NOT OLD."jenis_pengadil" OR NEW."tahun_mula_aktif" IS NOT OLD."tahun_mula_aktif" OR NEW."saiz_baju" IS NOT OLD."saiz_baju" OR NEW."resit_pembayaran_path" IS NOT OLD."resit_pembayaran_path" OR NEW."alamat1" IS NOT OLD."alamat1" OR NEW."alamat2" IS NOT OLD."alamat2" OR NEW."resit_path" IS NOT OLD."resit_path" OR NEW."status" IS NOT OLD."status" OR NEW."approved_at" IS NOT OLD."approved_at" OR NEW."created_at" IS NOT OLD."created_at")
BEGIN
  UPDATE "permohonan_pp" SET "updated_at"=datetime('now','+8 hours') WHERE rowid=NEW.rowid;
END;

DROP TRIGGER IF EXISTS "mysql_on_update_permohonan_ujian_bertulis";
CREATE TRIGGER "mysql_on_update_permohonan_ujian_bertulis" AFTER UPDATE ON "permohonan_ujian_bertulis"
WHEN (NEW."updated_at" IS OLD."updated_at") AND (NEW."id" IS NOT OLD."id" OR NEW."user_id" IS NOT OLD."user_id" OR NEW."persatuan_id" IS NOT OLD."persatuan_id" OR NEW."nama_penuh" IS NOT OLD."nama_penuh" OR NEW."no_ic" IS NOT OLD."no_ic" OR NEW."email" IS NOT OLD."email" OR NEW."no_telefon" IS NOT OLD."no_telefon" OR NEW."alamat" IS NOT OLD."alamat" OR NEW."jantina" IS NOT OLD."jantina" OR NEW."umur" IS NOT OLD."umur" OR NEW."status_kerja" IS NOT OLD."status_kerja" OR NEW."jawatan" IS NOT OLD."jawatan" OR NEW."nama_majikan" IS NOT OLD."nama_majikan" OR NEW."jenis_pengadil" IS NOT OLD."jenis_pengadil" OR NEW."tarikh_lahir" IS NOT OLD."tarikh_lahir" OR NEW."tempat_lahir" IS NOT OLD."tempat_lahir" OR NEW."status" IS NOT OLD."status" OR NEW."status_workflow" IS NOT OLD."status_workflow" OR NEW."tahun_permohonan" IS NOT OLD."tahun_permohonan" OR NEW."created_at" IS NOT OLD."created_at")
BEGIN
  UPDATE "permohonan_ujian_bertulis" SET "updated_at"=datetime('now','+8 hours') WHERE rowid=NEW.rowid;
END;

DROP TRIGGER IF EXISTS "mysql_on_update_permohonan_ujian_kecergasan";
CREATE TRIGGER "mysql_on_update_permohonan_ujian_kecergasan" AFTER UPDATE ON "permohonan_ujian_kecergasan"
WHEN (NEW."updated_at" IS OLD."updated_at") AND (NEW."id" IS NOT OLD."id" OR NEW."user_id" IS NOT OLD."user_id" OR NEW."jenis_permohonan" IS NOT OLD."jenis_permohonan" OR NEW."persatuan_id" IS NOT OLD."persatuan_id" OR NEW."nama_penuh" IS NOT OLD."nama_penuh" OR NEW."no_ic" IS NOT OLD."no_ic" OR NEW."email" IS NOT OLD."email" OR NEW."no_telefon" IS NOT OLD."no_telefon" OR NEW."nama_waris" IS NOT OLD."nama_waris" OR NEW."hubungan_waris" IS NOT OLD."hubungan_waris" OR NEW."telefon_waris" IS NOT OLD."telefon_waris" OR NEW."declare1" IS NOT OLD."declare1" OR NEW."declare2" IS NOT OLD."declare2" OR NEW."declare3" IS NOT OLD."declare3" OR NEW."declare4" IS NOT OLD."declare4" OR NEW."declare5" IS NOT OLD."declare5" OR NEW."alamat" IS NOT OLD."alamat" OR NEW."jantina" IS NOT OLD."jantina" OR NEW."umur" IS NOT OLD."umur" OR NEW."status_kerja" IS NOT OLD."status_kerja" OR NEW."jawatan" IS NOT OLD."jawatan" OR NEW."nama_majikan" IS NOT OLD."nama_majikan" OR NEW."jenis_pengadil" IS NOT OLD."jenis_pengadil" OR NEW."tarikh_lahir" IS NOT OLD."tarikh_lahir" OR NEW."tempat_lahir" IS NOT OLD."tempat_lahir" OR NEW."status" IS NOT OLD."status" OR NEW."workflow_status" IS NOT OLD."workflow_status" OR NEW."tahun_permohonan" IS NOT OLD."tahun_permohonan" OR NEW."created_at" IS NOT OLD."created_at")
BEGIN
  UPDATE "permohonan_ujian_kecergasan" SET "updated_at"=datetime('now','+8 hours') WHERE rowid=NEW.rowid;
END;

DROP TRIGGER IF EXISTS "mysql_on_update_persatuan_bolasepak_daerah";
CREATE TRIGGER "mysql_on_update_persatuan_bolasepak_daerah" AFTER UPDATE ON "persatuan_bolasepak_daerah"
WHEN (NEW."updated_at" IS OLD."updated_at") AND (NEW."id" IS NOT OLD."id" OR NEW."nama_persatuan" IS NOT OLD."nama_persatuan" OR NEW."kod_persatuan" IS NOT OLD."kod_persatuan" OR NEW."daerah" IS NOT OLD."daerah" OR NEW."alamat_penuh" IS NOT OLD."alamat_penuh" OR NEW."pegawai_pengarah" IS NOT OLD."pegawai_pengarah" OR NEW."no_telefon" IS NOT OLD."no_telefon" OR NEW."emel" IS NOT OLD."emel" OR NEW."aktif" IS NOT OLD."aktif" OR NEW."created_at" IS NOT OLD."created_at")
BEGIN
  UPDATE "persatuan_bolasepak_daerah" SET "updated_at"=datetime('now','+8 hours') WHERE rowid=NEW.rowid;
END;

DROP TRIGGER IF EXISTS "mysql_on_update_program_pembangunan";
CREATE TRIGGER "mysql_on_update_program_pembangunan" AFTER UPDATE ON "program_pembangunan"
WHEN (NEW."updated_at" IS OLD."updated_at") AND (NEW."id" IS NOT OLD."id" OR NEW."district_id" IS NOT OLD."district_id" OR NEW."persatuan_id" IS NOT OLD."persatuan_id" OR NEW."nama_program" IS NOT OLD."nama_program" OR NEW."tarikh_program" IS NOT OLD."tarikh_program" OR NEW."lokasi" IS NOT OLD."lokasi" OR NEW."keterangan" IS NOT OLD."keterangan" OR NEW."created_by" IS NOT OLD."created_by" OR NEW."created_at" IS NOT OLD."created_at")
BEGIN
  UPDATE "program_pembangunan" SET "updated_at"=datetime('now','+8 hours') WHERE rowid=NEW.rowid;
END;

DROP TRIGGER IF EXISTS "mysql_on_update_telegram_onboarding_state";
CREATE TRIGGER "mysql_on_update_telegram_onboarding_state" AFTER UPDATE ON "telegram_onboarding_state"
WHEN (NEW."updated_at" IS OLD."updated_at") AND (NEW."kejohanan_id" IS NOT OLD."kejohanan_id" OR NEW."pengadil_luar_id" IS NOT OLD."pengadil_luar_id" OR NEW."attempts" IS NOT OLD."attempts" OR NEW."first_sent_at" IS NOT OLD."first_sent_at" OR NEW."last_sent_at" IS NOT OLD."last_sent_at" OR NEW."last_failed_at" IS NOT OLD."last_failed_at" OR NEW."last_error" IS NOT OLD."last_error" OR NEW."claim_token" IS NOT OLD."claim_token" OR NEW."claimed_at" IS NOT OLD."claimed_at" OR NEW."last_batch_id" IS NOT OLD."last_batch_id" OR NEW."linked_at" IS NOT OLD."linked_at")
BEGIN
  UPDATE "telegram_onboarding_state" SET "updated_at"=datetime('now','+8 hours') WHERE rowid=NEW.rowid;
END;

DROP TRIGGER IF EXISTS "mysql_on_update_users";
CREATE TRIGGER "mysql_on_update_users" AFTER UPDATE ON "users"
WHEN (NEW."updated_at" IS OLD."updated_at") AND (NEW."id" IS NOT OLD."id" OR NEW."email" IS NOT OLD."email" OR NEW."password" IS NOT OLD."password" OR NEW."role" IS NOT OLD."role" OR NEW."district_id" IS NOT OLD."district_id" OR NEW."persatuan_id" IS NOT OLD."persatuan_id" OR NEW."nama_penuh" IS NOT OLD."nama_penuh" OR NEW."no_ic" IS NOT OLD."no_ic" OR NEW."no_telefon" IS NOT OLD."no_telefon" OR NEW."telegram_chat_id" IS NOT OLD."telegram_chat_id" OR NEW."tg_link_token" IS NOT OLD."tg_link_token" OR NEW."alamat1" IS NOT OLD."alamat1" OR NEW."alamat2" IS NOT OLD."alamat2" OR NEW."poskod" IS NOT OLD."poskod" OR NEW."daerah" IS NOT OLD."daerah" OR NEW."negeri" IS NOT OLD."negeri" OR NEW."status_kerja" IS NOT OLD."status_kerja" OR NEW."jawatan" IS NOT OLD."jawatan" OR NEW."nama_majikan" IS NOT OLD."nama_majikan" OR NEW."alamat_majikan1" IS NOT OLD."alamat_majikan1" OR NEW."alamat_majikan2" IS NOT OLD."alamat_majikan2" OR NEW."poskod_majikan" IS NOT OLD."poskod_majikan" OR NEW."daerah_majikan" IS NOT OLD."daerah_majikan" OR NEW."negeri_majikan" IS NOT OLD."negeri_majikan" OR NEW."nama_waris" IS NOT OLD."nama_waris" OR NEW."hubungan_waris" IS NOT OLD."hubungan_waris" OR NEW."telefon_waris" IS NOT OLD."telefon_waris" OR NEW."url_gambar_profil" IS NOT OLD."url_gambar_profil" OR NEW."jantina" IS NOT OLD."jantina" OR NEW."jenis_pengadil" IS NOT OLD."jenis_pengadil" OR NEW."jenis_penilai" IS NOT OLD."jenis_penilai" OR NEW."tahun_mula_aktif" IS NOT OLD."tahun_mula_aktif" OR NEW."saiz_baju" IS NOT OLD."saiz_baju" OR NEW."aktif" IS NOT OLD."aktif" OR NEW."password_changed" IS NOT OLD."password_changed" OR NEW."last_login" IS NOT OLD."last_login" OR NEW."created_at" IS NOT OLD."created_at" OR NEW."umur" IS NOT OLD."umur" OR NEW."tahun_mohon_kelas3" IS NOT OLD."tahun_mohon_kelas3" OR NEW."tahun_lulus_kelas3" IS NOT OLD."tahun_lulus_kelas3" OR NEW."pengadil_kebangsaan" IS NOT OLD."pengadil_kebangsaan" OR NEW."pengadil_negeri" IS NOT OLD."pengadil_negeri" OR NEW."pengadil_daerah" IS NOT OLD."pengadil_daerah")
BEGIN
  UPDATE "users" SET "updated_at"=datetime('now','+8 hours') WHERE rowid=NEW.rowid;
END;
