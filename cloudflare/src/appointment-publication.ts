/** Trusted SQL aliases only. Tokens prepared for manual delivery are still drafts. */
export const publishedAppointmentSql = (alias: string): string => `(
  ${alias}.published_at IS NOT NULL
  OR COALESCE(${alias}.notif_hantar,0)=1
  OR COALESCE(${alias}.tg_notif_hantar,0)=1
  OR ${alias}.tarikh_jawab IS NOT NULL
  OR ${alias}.status='Diterima')`;

export const DRAFT_APPOINTMENT_MESSAGE =
  'Lantikan ini masih draf dan belum dihantar oleh pentadbir. Sila tunggu notifikasi lantikan.';
