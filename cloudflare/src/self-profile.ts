import { currentUser, json } from "./auth";
import type { Env } from "./types";
import { missingRefereeProfile, profileLabels } from "./referee-profile";
import { qualificationYearsSql } from "./profile-years";

export async function userProfile(
  request: Request,
  env: Env,
): Promise<Response> {
  const user = await currentUser(request, env);
  if (!user)
    return json(
      { error: true, message: "Sesi tidak sah. Sila log masuk semula." },
      401,
    );
  const profile = await env.DB.prepare(
    `
    SELECT u.id, u.email, u.nama_penuh, u.no_ic, u.no_telefon, u.jantina,
           u.persatuan_id,
           u.alamat1, u.alamat2, u.poskod, u.daerah, u.negeri,
           u.status_kerja, u.jawatan, u.nama_majikan, u.alamat_majikan1,
           u.alamat_majikan2, u.poskod_majikan, u.daerah_majikan,
           u.negeri_majikan, u.nama_waris, u.hubungan_waris, u.telefon_waris,
           u.url_gambar_profil, u.umur, u.jenis_pengadil, NULLIF(NULLIF(trim(u.tahun_mula_aktif),''),'0000') AS tahun_mula_aktif,
           u.saiz_baju, u.telegram_chat_id, u.password_changed,
           CASE WHEN trim(COALESCE(u.telegram_chat_id,''))<>'' THEN 1 ELSE 0 END AS telegram_linked,
           CASE WHEN trim(COALESCE(u.telegram_chat_id,''))='' THEN 1 ELSE 0 END AS telegram_link_required,
           pbd.nama_persatuan AS persatuan_bolasepak_daerah,
           u.jenis_penilai, ${qualificationYearsSql()}
    FROM users u
    LEFT JOIN persatuan_bolasepak_daerah pbd
      ON pbd.id=COALESCE(u.persatuan_id,u.district_id)
    WHERE u.id=? LIMIT 1
  `,
  )
    .bind(user.id)
    .first();
  if (!profile)
    return json({ error: true, message: "Profil tidak dijumpai." }, 404);
  const missing = missingRefereeProfile(profile as Record<string, unknown>);
  return json({
    error: false,
    user: profile,
    profile_missing_fields: missing,
    profile_missing_labels: missing.map((key) => profileLabels[key]),
  });
}
