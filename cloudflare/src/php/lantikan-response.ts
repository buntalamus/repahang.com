/**
 * The response transaction shared by lantikan-jawab.php, lantikan-jawab-token.php
 * and the Telegram callbacks: one guarded batch for the status, audit and
 * match history, then PHP's post-commit notifications.
 */
import type { Env } from '../types';
import { publishedAppointmentSql } from '../appointment-publication';
import { guardStatement, runGuarded } from './guard';
import type { AuditMeta } from './lantikan-audit';
import { NOW, getLantikanAuditSnapshot, lantikanAuditStatement } from './lantikan-audit';
import { historySyncStatements, isAcceptedKupCrewComplete, isKupPosition } from './lantikan-helper';
import { getMatchKickoffTimestamp } from './format';

export interface ResponseChange {
  lantikanId: number;
  jadualId: number;
  jawatan: string;
  newStatus: 'Diterima' | 'Ditolak';
  /** undefined keeps komen untouched (email link and Telegram accept). */
  komen?: string;
  channel: string;
  details: Record<string, unknown>;
  linkUrl: string | null;
  actorUserId: number | null;
}

/** false when the appointment was answered meanwhile (PHP rowCount() === 0). */
export async function applyAppointmentResponse(env: Env, change: ResponseChange,
  meta: AuditMeta): Promise<{ updated: boolean; shouldNotifyCompleteKup: boolean }> {
  const snapshot = await getLantikanAuditSnapshot(env, change.lantikanId);
  if (!snapshot) throw new Error('Snapshot audit jawapan lantikan tidak dijumpai.');
  if (change.actorUserId !== null && snapshot.pengadil_id !== change.actorUserId) {
    return { updated: false, shouldNotifyCompleteKup: false };
  }
  const kickoff = getMatchKickoffTimestamp(snapshot.tarikh, snapshot.masa ?? '');
  if (kickoff !== null && kickoff <= Date.now()) return { updated: false, shouldNotifyCompleteKup: false };
  const setKomen = change.komen !== undefined ? 'komen=?,' : '';
  const done = await runGuarded(env, [
    guardStatement(env, 'lantikan_response',
      `EXISTS(SELECT 1 FROM lantikan_pengadil lp WHERE lp.id=? AND lp.status='Belum Jawab'
        AND lp.pengadil_id IS ? AND lp.pengadil_luar_id IS ? AND ${publishedAppointmentSql('lp')})`,
      [change.lantikanId, snapshot.pengadil_id, snapshot.pengadil_luar_id]),
    env.DB.prepare(`UPDATE lantikan_pengadil SET status=?,${setKomen}tarikh_jawab=${NOW},
        status_dikemaskini_at=${NOW},tg_token=NULL,email_token=NULL
      WHERE id=? AND status='Belum Jawab'`)
      .bind(change.newStatus, ...(change.komen !== undefined ? [change.komen] : []), change.lantikanId),
    ...historySyncStatements(env, change.jadualId),
    lantikanAuditStatement(env, change.lantikanId, 'appointment_response', change.channel, 'success',
      change.details, change.linkUrl, 'official', change.actorUserId, snapshot, meta),
  ]);
  if (!done) return { updated: false, shouldNotifyCompleteKup: false };
  const shouldNotifyCompleteKup = isKupPosition(change.jawatan)
    && await isAcceptedKupCrewComplete(env, change.jadualId);
  return { updated: true, shouldNotifyCompleteKup };
}

/** ucfirst() for the portal notification type. */
export function ucfirst(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
