import { guardStatement, runGuarded } from './php/guard';
import { enqueueNoticeStatements } from './notify';
import { authorizeAppointmentResource, districtOf, localOfficialSql } from './appointment-access';
import { currentUser, json } from './auth';
import { mysqlTextOrder } from './php/mysql-order';
import { boundedJson } from './request';
import type { Env } from './types';

function positiveId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return value;
  if (typeof value === 'string' && /^[1-9]\d*$/.test(value)) {
    const number = Number(value);
    if (Number.isSafeInteger(number)) return number;
  }
  return null;
}

type PoolItem = { pengadil_id: number | null; pengadil_luar_id: number | null };

function parseItems(input: Record<string, unknown>): PoolItem[] | Response {
  const raw = Array.isArray(input.items) && input.items.length > 0 ? input.items : [input];
  if (raw.length > 200) return json({ error: true, message: 'Maksimum 200 pengadil bagi satu permintaan.' }, 400);
  const items: PoolItem[] = [];
  for (const [index, item] of raw.entries()) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return json({ error: true, message: `Item pool #${index + 1} tidak sah.` }, 400);
    }
    const record = item as Record<string, unknown>;
    const registered = positiveId(record.pengadil_id);
    const external = positiveId(record.pengadil_luar_id);
    if ((registered === null) === (external === null)) {
      return json({ error: true, message: `Item pool #${index + 1} mesti mempunyai tepat satu identiti pengadil.` }, 400);
    }
    items.push({ pengadil_id: registered, pengadil_luar_id: external });
  }
  return items;
}

export async function refereePool(request: Request, env: Env): Promise<Response> {
  if (!['GET', 'POST', 'DELETE'].includes(request.method)) {
    return json({ error: true, message: 'Kaedah tidak disokong.' }, 405);
  }
  const user = await currentUser(request, env);
  if (!user) return json({ error: true, message: 'Sesi tidak sah. Sila log masuk semula.' }, 401);
  const access=await authorizeAppointmentResource(request,env,user,'pool');
  if (access) return access;
  const url = new URL(request.url);

  if (request.method === 'GET') {
    const tournamentId = positiveId(url.searchParams.get('kejohanan_id'));
    if (!tournamentId) return json({ error: true, message: 'kejohanan_id diperlukan.' }, 400);
    const rows = await env.DB.prepare(`
      SELECT pp.id AS pool_id, pp.kejohanan_id, pp.pengadil_id, pp.pengadil_luar_id,
        CASE WHEN pp.pengadil_id IS NOT NULL THEN u.nama_penuh ELSE pl.nama END AS nama,
        CASE WHEN pp.pengadil_id IS NOT NULL THEN 'Berdaftar' ELSE 'Luar' END AS jenis_sumber,
        CASE WHEN pp.pengadil_id IS NOT NULL THEN u.daerah ELSE pl.daerah END AS daerah,
        CASE WHEN pp.pengadil_id IS NOT NULL THEN u.negeri ELSE pl.negeri END AS negeri,
        COALESCE(k.peringkat_kejohanan, 'Daerah') AS peringkat_kejohanan,
        CASE WHEN pp.pengadil_id IS NOT NULL THEN u.no_telefon ELSE pl.no_tel END AS no_tel,
        CASE WHEN pp.pengadil_id IS NOT NULL THEN u.email ELSE pl.emel END AS emel,
        CASE WHEN pp.pengadil_id IS NOT NULL THEN u.jenis_pengadil ELSE pl.jenis_pengadil END AS jenis_pengadil,
        CASE WHEN COALESCE(u.telegram_chat_id,pl.telegram_chat_id) IS NOT NULL
          AND COALESCE(u.telegram_chat_id,pl.telegram_chat_id) <> '' THEN 1 ELSE 0 END AS telegram_linked
      FROM pool_pengadil pp
      JOIN kejohanan k ON k.id=pp.kejohanan_id
      LEFT JOIN users u ON u.id=pp.pengadil_id
      LEFT JOIN pengadil_luar pl ON pl.id=pp.pengadil_luar_id
      WHERE pp.kejohanan_id=? ${user.role==='PP Daerah' ? `AND pp.pengadil_luar_id IS NULL AND ${localOfficialSql('u')}` : ''} ORDER BY nama COLLATE NOCASE ASC
    `).bind(tournamentId,...(user.role==='PP Daerah' ? [districtOf(user)] : [])).all();
    return json({ error: false, data: rows.results.sort((a, b) =>
      mysqlTextOrder(a.nama, b.nama)).map((item) => ({
      ...item,
      wilayah: item.peringkat_kejohanan === 'Negeri' ? (item.daerah || '-') : (item.negeri || '-'),
      telegram_linked: Boolean(item.telegram_linked),
    })) });
  }

  if (env.STAGING_WRITES_ENABLED !== '1') {
    return json({ error: true, message: 'Tindakan tulis belum tersedia di staging.' }, 503);
  }

  if (request.method === 'POST') {
    const body = await boundedJson(request, 32 * 1024);
    if (body instanceof Response) return body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return json({ error: true, message: 'Data pool tidak sah.' }, 400);
    }
    const input = body as Record<string, unknown>;
    const tournamentId = positiveId(input.kejohanan_id);
    if (!tournamentId) return json({ error: true, message: 'kejohanan_id diperlukan.' }, 400);
    const items = parseItems(input);
    if (items instanceof Response) return items;
    const tournament = await env.DB.prepare('SELECT 1 FROM kejohanan WHERE id=?').bind(tournamentId).first();
    if (!tournament) return json({ error: true, message: 'Kejohanan tidak dijumpai.' }, 404);
    for (const [table, ids] of [
      ['users', [...new Set(items.map((item) => item.pengadil_id).filter((id): id is number => id !== null))]],
      ['pengadil_luar', [...new Set(items.map((item) => item.pengadil_luar_id).filter((id): id is number => id !== null))]],
    ] as const) {
      for (let offset = 0; offset < ids.length; offset += 50) {
        const chunk = ids.slice(offset, offset + 50);
        const rows = await env.DB.prepare(`SELECT id FROM ${table} WHERE id IN (${chunk.map(() => '?').join(',')})`)
          .bind(...chunk).all<{ id: number }>();
        if (rows.results.length !== chunk.length) {
          return json({ error: true, message: 'Identiti pengadil dalam senarai tidak dijumpai.' }, 400);
        }
      }
    }
    const statements=items.map((item) => env.DB.prepare(`
      INSERT OR IGNORE INTO pool_pengadil(kejohanan_id,pengadil_id,pengadil_luar_id,created_at)
      VALUES(?,?,?,datetime('now','+8 hours'))
    `).bind(tournamentId, item.pengadil_id, item.pengadil_luar_id));
    let added=0;
    let insertResults: D1Result[];
    if (user.role==='PP Daerah') {
      const ids=[...new Set(items.map(item=>item.pengadil_id))];
      const done=await runGuarded(env,[guardStatement(env,'district_pool',
        `(SELECT COUNT(*) FROM users u WHERE u.id IN (SELECT value FROM json_each(?)) AND ${localOfficialSql('u')})=?`,
        [JSON.stringify(ids),districtOf(user),ids.length]),...statements]);
      if (!done) return json({error:true,message:'Kelolaan pengadil telah berubah. Muat semula dan cuba lagi.'},409);
      insertResults=done.slice(1);
    } else {
      insertResults=await env.DB.batch(statements);
    }
    added=insertResults.filter(result=>result.meta.changes>0).length;
    await queuePoolNotices(env, tournamentId, 'add',
      items.filter((_item, index) => Number(insertResults[index]?.meta.changes ?? 0) > 0));
    const skipped = items.length - added;
    const message = `${added} pengadil ditambah ke pool.${skipped ? ` ${skipped} sudah ada dalam pool.` : ''}`;
    return json({ error: false, message, added, skipped });
  }

  const id = positiveId(url.searchParams.get('id'));
  if (!id) return json({ error: true, message: 'ID diperlukan.' }, 400);
  const member = await env.DB.prepare('SELECT kejohanan_id,pengadil_id,pengadil_luar_id FROM pool_pengadil WHERE id=?')
    .bind(id).first<{ kejohanan_id: number; pengadil_id: number | null; pengadil_luar_id: number | null }>();
  const result = await env.DB.prepare(`
    DELETE FROM pool_pengadil WHERE id=? AND NOT EXISTS (
      SELECT 1 FROM jadual_perlawanan jp
      JOIN lantikan_pengadil lp ON lp.jadual_id=jp.id
      WHERE jp.kejohanan_id=pool_pengadil.kejohanan_id
        AND ((pool_pengadil.pengadil_id IS NOT NULL AND lp.pengadil_id=pool_pengadil.pengadil_id)
          OR (pool_pengadil.pengadil_luar_id IS NOT NULL AND lp.pengadil_luar_id=pool_pengadil.pengadil_luar_id))
    )
  `).bind(id).run();
  if (result.meta.changes === 0) {
    const exists = await env.DB.prepare('SELECT 1 FROM pool_pengadil WHERE id=?').bind(id).first();
    if (exists) return json({ error: true, message: 'Pengadil tidak boleh dibuang dari pool kerana mempunyai rekod lantikan dalam kejohanan ini.' }, 409);
    return json({ error: true, message: 'Rekod pool tidak dijumpai.' }, 404);
  }
  if (member) await queuePoolNotices(env, member.kejohanan_id, 'remove', [member]);
  return json({ error: false, message: 'Dibuang dari pool.' });
}

/** Officials hear (through the outbox) when they are added to or removed from a tournament pool. */
async function queuePoolNotices(env: Env, tournamentId: number, change: 'add' | 'remove',
  members: Array<{ pengadil_id: number | null; pengadil_luar_id: number | null }>): Promise<void> {
  if (members.length === 0) return;
  try {
    const tournament = await env.DB.prepare('SELECT nama,tarikh_mula,tarikh_akhir,tempat FROM kejohanan WHERE id=?')
      .bind(tournamentId).first<{ nama: string; tarikh_mula: string | null; tarikh_akhir: string | null;
        tempat: string | null }>();
    if (!tournament) return;
    const userIds = members.map((m) => m.pengadil_id).filter((id): id is number => !!id);
    const luarIds = members.map((m) => m.pengadil_luar_id).filter((id): id is number => !!id);
    const contacts = [
      ...(userIds.length ? (await env.DB.prepare(`SELECT id AS pengadil_id,NULL AS pengadil_luar_id,nama_penuh AS nama,
          email,telegram_chat_id FROM users WHERE id IN (SELECT value FROM json_each(?)) AND aktif=1`)
        .bind(JSON.stringify(userIds)).all<PoolContact>()).results : []),
      ...(luarIds.length ? (await env.DB.prepare(`SELECT NULL AS pengadil_id,id AS pengadil_luar_id,nama,
          emel AS email,telegram_chat_id FROM pengadil_luar WHERE id IN (SELECT value FROM json_each(?))`)
        .bind(JSON.stringify(luarIds)).all<PoolContact>()).results : []),
    ];
    const batchKey = crypto.randomUUID();
    const added = change === 'add';
    const statements = contacts.flatMap((contact) => enqueueNoticeStatements(env,
      `pool_${change}:${tournamentId}:${contact.pengadil_id ?? `l${contact.pengadil_luar_id}`}:${batchKey}`,
      { userId: contact.pengadil_id, luarId: contact.pengadil_luar_id, name: contact.nama, email: contact.email,
        telegramChatId: contact.telegram_chat_id }, {
        subject: `${added ? 'Dimasukkan ke' : 'Dikeluarkan daripada'} Pool Pengadil: ${tournament.nama}`,
        title: added ? 'Pool Pengadil Kejohanan' : 'Dikeluarkan daripada Pool Pengadil',
        accent: added ? '#111827' : '#6B7280',
        mailType: 'lantikan',
        paragraphs: [added
          ? `Anda telah dimasukkan ke dalam pool pengadil bagi ${tournament.nama}. Lantikan perlawanan akan dimaklumkan secara berasingan.`
          : `Anda telah dikeluarkan daripada pool pengadil bagi ${tournament.nama}.`],
        rows: [['Kejohanan', tournament.nama],
          ['Tarikh', `${tournament.tarikh_mula ?? '-'} hingga ${tournament.tarikh_akhir ?? '-'}`],
          ['Tempat', tournament.tempat || '-']],
        portal: { type: 'Pool Pengadil', subject: `${added ? 'Dimasukkan ke' : 'Dikeluarkan daripada'} pool: ${tournament.nama}`,
          message: added ? `Anda telah dimasukkan ke dalam pool pengadil bagi ${tournament.nama}.`
            : `Anda telah dikeluarkan daripada pool pengadil bagi ${tournament.nama}.` },
      }, { kind: `pool_${change}` }));
    if (statements.length) await env.DB.batch(statements);
  } catch (error) {
    console.error('[pool-pengadil.php] pool notice failed', error instanceof Error ? error.message : error);
  }
}

interface PoolContact {
  pengadil_id: number | null;
  pengadil_luar_id: number | null;
  nama: string;
  email: string | null;
  telegram_chat_id: string | number | null;
}
