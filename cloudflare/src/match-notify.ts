/** Self-recorded match (perlawanan) notices: verification decisions, deletions and edits by the referee. */
import type { Env } from './types';
import { baseUrl } from './php/email';
import { contactRecipient, districtPPs, notifyAll } from './notify';
import type { ContactRow, Notice } from './notify';

export type MatchDecision = 'verify' | 'reject' | 'revert' | 'delete';

export interface MatchSummary {
  home_team: string | null;
  away_team: string | null;
  tarikh: string;
  tempat?: string | null;
  jenis?: string | null;
}

function dayText(tarikh: string): string {
  return String(tarikh ?? '').split('-').reverse().join('/');
}

async function contacts(env: Env, userIds: Array<number | null>): Promise<ContactRow[]> {
  const ids = [...new Set(userIds.filter((id): id is number => Number(id) > 0))];
  if (ids.length === 0) return [];
  return (await env.DB.prepare(`SELECT id,nama_penuh,email,telegram_chat_id FROM users
    WHERE id IN (SELECT value FROM json_each(?)) AND aktif=1 ORDER BY id`).bind(JSON.stringify(ids))
    .all<ContactRow>()).results;
}

/**
 * Email + Telegram to every official on a match record after a PP Daerah or
 * Admin decision. The in-app notice is already written in the decision batch,
 * except for deletions, which had none.
 */
export async function notifyMatchDecision(env: Env, userIds: Array<number | null>, decision: MatchDecision,
  match: MatchSummary, actor: 'Admin' | 'Pegawai Pembangunan Daerah', note: string): Promise<number> {
  const recipients = await contacts(env, userIds);
  if (recipients.length === 0) return 0;
  const pasukan = `${match.home_team ?? ''} lwn ${match.away_team ?? ''}`;
  const day = dayText(match.tarikh);
  const titles: Record<MatchDecision, [string, string, string]> = {
    verify: ['Perlawanan Disahkan', '#16A34A', `telah disahkan oleh ${actor}`],
    reject: ['Perlawanan Tidak Disahkan', '#DC2626', `tidak disahkan oleh ${actor}`],
    revert: ['Perlawanan Dikembalikan', '#F59E0B', `telah dikembalikan untuk semakan semula oleh ${actor}`],
    delete: ['Rekod Perlawanan Dipadam', '#6B7280', `telah dipadam oleh ${actor}`],
  };
  const [title, accent, verb] = titles[decision];
  const rows: Array<[string, string]> = [['Perlawanan', pasukan], ['Tarikh', day]];
  if (match.tempat) rows.push(['Tempat', String(match.tempat)]);
  if (match.jenis) rows.push(['Kategori', String(match.jenis)]);
  if (note) rows.push([decision === 'verify' ? 'Catatan' : decision === 'delete' ? 'Justifikasi' : 'Sebab / Catatan', note]);
  const notice: Notice = {
    subject: `${title}: ${pasukan} (${day})`,
    title,
    accent,
    mailType: 'pengesahan',
    paragraphs: [`Rekod perlawanan anda ${verb}.`,
      decision === 'reject' ? 'Sila semak rekod tersebut dan hubungi Pegawai Pembangunan Daerah jika perlu.'
        : decision === 'delete' ? 'Rekod ini tidak lagi dikira dalam sejarah perlawanan anda.'
          : 'Sila log masuk untuk menyemak sejarah perlawanan anda.'],
    rows,
    actions: [{ label: 'Semak Sejarah Perlawanan', url: `${baseUrl(env)}/login` }],
    ...(decision === 'delete' ? { portal: { type: 'Pengesahan Perlawanan', subject: `Rekod Perlawanan Dipadam`,
      message: `Rekod perlawanan ${pasukan} pada ${day} ${verb}.${note ? ` Justifikasi: ${note}` : ''}` } } : {}),
  };
  return notifyAll(env, recipients.map(contactRecipient), notice);
}

/** The PP Daerah who verifies a referee's records hears when an unverified record is edited or deleted. */
export async function notifyVerifierOfRecordChange(env: Env, refereeId: number, change: 'edit' | 'delete',
  match: MatchSummary): Promise<number> {
  const referee = await env.DB.prepare(`SELECT nama_penuh,COALESCE(NULLIF(persatuan_id,0),district_id) AS district
    FROM users WHERE id=?`).bind(refereeId).first<{ nama_penuh: string; district: number | null }>();
  if (!referee?.district) return 0;
  const pps = await districtPPs(env, referee.district);
  const pasukan = `${match.home_team ?? ''} lwn ${match.away_team ?? ''}`;
  const day = dayText(match.tarikh);
  const verb = change === 'edit' ? 'dikemaskini' : 'dipadam';
  return notifyAll(env, pps.map((pp) => ({ ...contactRecipient(pp), telegramChatId: null })), {
    subject: `Rekod Perlawanan ${change === 'edit' ? 'Dikemaskini' : 'Dipadam'}: ${pasukan} (${day})`,
    title: `Rekod Perlawanan ${change === 'edit' ? 'Dikemaskini' : 'Dipadam'}`,
    mailType: 'pengesahan',
    paragraphs: [`${referee.nama_penuh} telah ${verb} rekod perlawanan yang belum disahkan.`,
      change === 'edit' ? 'Sila semak rekod terkini sebelum membuat pengesahan.'
        : 'Rekod ini tidak lagi memerlukan pengesahan anda.'],
    rows: [['Pengadil', referee.nama_penuh], ['Perlawanan', pasukan], ['Tarikh', day],
      ...(match.tempat ? [['Tempat', String(match.tempat)] as [string, string]] : [])],
    actions: change === 'edit' ? [{ label: 'Semak Pengesahan Perlawanan', url: `${baseUrl(env)}/login` }] : undefined,
    portal: { type: 'Pengesahan Perlawanan', subject: `Rekod perlawanan ${verb}: ${pasukan}`,
      message: `${referee.nama_penuh} telah ${verb} rekod perlawanan ${pasukan} pada ${day}.` },
  });
}
