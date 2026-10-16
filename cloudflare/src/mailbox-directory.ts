import { usersOverviewStatement } from './admin-users';
import type { Env } from './types';

export const MAIL_GROUPS = [
  { id: 'all', label: 'Semua pengguna sistem' },
  { id: 'pp', label: 'PP Daerah sahaja' },
  { id: 'ra', label: 'RA / Penilai sahaja' },
  { id: 'registered', label: 'Pengadil berdaftar (tahun dipilih)' },
  { id: 'class3', label: 'Pengadil Kelas III FAM sahaja' },
  { id: 'class1', label: 'Pengadil Kelas I FAM sahaja' },
  { id: 'state', label: 'Pengadil Negeri sahaja' },
  { id: 'national', label: 'Pengadil Kebangsaan sahaja' },
  { id: 'referees', label: 'Semua pengadil' },
  { id: 'inactive-referees', label: 'Pengadil tidak aktif (pendaftaran tahunan)' },
  { id: 'pending', label: 'Memohon tahun dipilih, belum diluluskan' },
  { id: 'class3-passed', label: 'Lulus Kelas III FAM' },
  { id: 'class1-passed', label: 'Lulus Kelas I FAM' },
  { id: 'admin', label: 'Admin sahaja' },
  { id: 'contacts', label: 'Kenalan disimpan manual' },
] as const;
export type GroupId = typeof MAIL_GROUPS[number]['id'];
type Overview = {
  id: number; email: string; nama_penuh: string; user_role: string; jenis_pengadil: string | null;
  persatuan_id: number | null; persatuan_nama: string | null; is_active: number;
  current_approved: number; current_applied: number; prior_approved: number; is_referee: number;
  is_ra: number; class3_passed: number; class1_passed: number;
};
export type DirectoryContact = {
  id: string; name: string; email: string; role: string; district_id: number | null;
  district: string | null; active: boolean; groups: GroupId[];
};
export function validEmail(value: string): boolean {
  return value.length <= 254 && /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(value);
}
export function mailYear(value: unknown): number | null {
  const year = Number(value);
  return Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : null;
}
export async function mailboxDirectory(env: Env, year: number) {
  const [users, contacts, districts] = await Promise.all([
    usersOverviewStatement(env, year).all<Overview>(),
    env.DB.prepare('SELECT id,name,email FROM mailbox_contacts ORDER BY name').all<{id:string;name:string;email:string}>(),
    env.DB.prepare('SELECT id,nama_persatuan AS name FROM persatuan_bolasepak_daerah ORDER BY nama_persatuan').all<{id:number;name:string}>(),
  ]);
  let invalid = 0;
  const entries: DirectoryContact[] = [];
  for (const user of users.results) {
    const email = (user.email || '').trim().toLowerCase();
    if (!validEmail(email)) { invalid++; continue; }
    const groups: GroupId[] = ['all'];
    if (user.user_role === 'PP Daerah') groups.push('pp');
    if (user.is_ra === 1) groups.push('ra');
    if (user.user_role === 'Admin') groups.push('admin');
    if (user.is_referee === 1) groups.push('referees');
    if (user.current_approved === 1) groups.push('registered');
    if (user.prior_approved === 1 && user.current_approved === 0) groups.push('inactive-referees');
    if (user.current_applied === 1 && user.current_approved === 0) groups.push('pending');
    if (user.class3_passed === 1) groups.push('class3-passed');
    if (user.class1_passed === 1) groups.push('class1-passed');
    const grades: Record<string, GroupId> = { 'Kelas III FAM': 'class3', 'Kelas I FAM': 'class1', 'Pengadil Negeri': 'state', 'Pengadil Kebangsaan': 'national' };
    if (user.jenis_pengadil && grades[user.jenis_pengadil]) groups.push(grades[user.jenis_pengadil]);
    entries.push({ id: `user:${user.id}`, name: user.nama_penuh || email, email, role: user.user_role,
      district_id: user.persatuan_id, district: user.persatuan_nama, active: user.is_active === 1, groups });
  }
  for (const contact of contacts.results) {
    const email = contact.email.trim().toLowerCase();
    if (!validEmail(email)) { invalid++; continue; }
    entries.push({ id: `contact:${contact.id}`, name: contact.name, email, role: 'Kenalan manual',
      district_id: null, district: null, active: true, groups: ['contacts'] });
  }
  entries.sort((a,b) => a.name.localeCompare(b.name, 'ms') || a.email.localeCompare(b.email));
  return { year, groups: MAIL_GROUPS, contacts: entries, districts: districts.results, invalid };
}
export type RecipientFilter = { groups: GroupId[]; district_id: number | null; include_inactive: boolean; exclude: string[] };
export function recipientFilter(body: Record<string, unknown>): RecipientFilter | null {
  if (!Array.isArray(body.groups) || !body.groups.length || body.groups.length > MAIL_GROUPS.length ||
      !body.groups.every(id => MAIL_GROUPS.some(group => group.id === id))) return null;
  const district = body.district_id === null || body.district_id === '' || body.district_id === undefined ? null : Number(body.district_id);
  if (district !== null && (!Number.isSafeInteger(district) || district <= 0)) return null;
  if (body.include_inactive !== undefined && typeof body.include_inactive !== 'boolean') return null;
  const exclude = body.exclude ?? [];
  if (!Array.isArray(exclude) || exclude.length > 5000 || !exclude.every(value => typeof value === 'string' && validEmail(value))) return null;
  return { groups: [...new Set(body.groups as GroupId[])], district_id: district,
    include_inactive: body.include_inactive === true, exclude: exclude as string[] };
}
/** OR between selected groups; AND with district/account filter. Deduplicate after matching. */
export function directoryRecipients(contacts: DirectoryContact[], filter: RecipientFilter): DirectoryContact[] {
  const excluded = new Set(filter.exclude);
  const emails = new Set<string>();
  return contacts.filter(contact => {
    if ((!filter.include_inactive && !contact.active) || (filter.district_id !== null && contact.district_id !== filter.district_id) ||
        !contact.groups.some(group => filter.groups.includes(group)) || excluded.has(contact.email) || emails.has(contact.email)) return false;
    emails.add(contact.email); return true;
  });
}
