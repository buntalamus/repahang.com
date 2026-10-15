import {currentUser,json} from './auth';
import {boundedJson} from './request';
import type {Env} from './types';

type Body = Record<string,unknown>;
type Official = {lantikan_pengadil_id:number;jawatan:string;nama_pengadil:string};
type Assignment = {id:number;jadual_id:number;pengadil_id:number|null;status:string};
type Existing = {id:number;status:string;worker_revision:string|null};

const scoreFields = ['skor_ht_home','skor_ht_away','skor_ft_home','skor_ft_away',
  'skor_et_home','skor_et_away','skor_ps_home','skor_ps_away'] as const;
const listFields = ['kawalan_kekuatan','kawalan_kelemahan','fizikal_kekuatan',
  'fizikal_kelemahan','kerjasama_kekuatan','kerjasama_kelemahan'] as const;
const textFields = ['kawalan_nasihat','fizikal_nasihat','kerjasama_nasihat'] as const;
const parentColumns = ['tahap_kesukaran','cuaca','ulasan_keseluruhan',...scoreFields] as const;
const childColumns = ['lantikan_pengadil_id','jawatan','nama_pengadil','markah','prestasi',
  'kawalan_kekuatan','kawalan_kelemahan','kawalan_nasihat',
  'fizikal_kekuatan','fizikal_kelemahan','fizikal_nasihat',
  'kerjasama_kekuatan','kerjasama_kelemahan','kerjasama_nasihat'] as const;

function positiveId(raw: unknown): number | null {
  if (typeof raw !== 'number' && typeof raw !== 'string') return null;
  const value = String(raw);
  const id = Number(value);
  return /^[1-9]\d*$/.test(value) && Number.isSafeInteger(id) ? id : null;
}

function invalid(message: string): Response { return json({error:true,message},400); }

function normalizeParent(body: Body): Record<string,string|number|null> | Response {
  const tahap = body.tahap_kesukaran ?? 'Normal';
  if (typeof tahap !== 'string' || !['Normal','Susah','Sangat Susah'].includes(tahap.trim())) {
    return invalid('Tahap kesukaran tidak sah.');
  }
  const weather = body.cuaca ?? '';
  if (typeof weather !== 'string' ||
      (weather.trim() && !['Cerah','Mendung','Hujan Renyai','Hujan Lebat','Panas Terik','Berangin']
        .includes(weather.trim()))) return invalid('Pilihan cuaca tidak sah.');
  const comment = body.ulasan_keseluruhan ?? '';
  if (typeof comment !== 'string' || new TextEncoder().encode(comment).length>65535) {
    return invalid('Ulasan keseluruhan tidak sah atau terlalu panjang.');
  }
  const parent: Record<string,string|number|null> = {
    tahap_kesukaran:tahap.trim(),cuaca:weather.trim() || null,ulasan_keseluruhan:comment,
  };
  for (const field of scoreFields) {
    const raw = body[field];
    if (raw === null || raw === undefined || raw === '') { parent[field]=null; continue; }
    const value = Number(raw);
    if ((typeof raw !== 'number' && (typeof raw !== 'string' || !/^\d+$/.test(raw))) ||
        !Number.isInteger(value) || value<0 || value>99) {
      return invalid('Skor perlawanan mesti nombor bulat antara 0 hingga 99.');
    }
    parent[field]=value;
  }
  return parent;
}

function normalizeChildren(raw: unknown, officials: Official[]): Body[] | Response {
  if (!Array.isArray(raw) || raw.length===0) return invalid('Senarai pegawai diperlukan.');
  const roles = new Set(officials.map((official) => official.jawatan));
  if (officials.length<3 || officials.length>4 || roles.size!==officials.length ||
      !['Pengadil','Penolong Pengadil 1','Penolong Pengadil 2'].every((role) => roles.has(role))) {
    return invalid('Laporan memerlukan sekurang-kurangnya Pengadil, Penolong Pengadil 1 dan Penolong Pengadil 2 yang telah menerima lantikan.');
  }
  const submitted = new Map<number,Body>();
  for (const value of raw) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return invalid('Format senarai pegawai tidak sah.');
    }
    const item = value as Body;
    const id = positiveId(item.lantikan_pengadil_id);
    if (!id || submitted.has(id)) return invalid('Senarai pegawai mengandungi lantikan tidak sah atau berulang.');
    submitted.set(id,item);
  }
  if (submitted.size!==officials.length) {
    return invalid('Semua KUP yang menerima lantikan mesti dinilai tepat sekali.');
  }
  const children: Body[] = [];
  for (const official of officials) {
    const item = submitted.get(official.lantikan_pengadil_id);
    if (!item) return invalid('Senarai pegawai tidak sepadan dengan lantikan KUP perlawanan.');
    const markahRaw = item.markah;
    let markah: number|null = null;
    if (markahRaw !== null && markahRaw !== undefined && markahRaw !== '') {
      if (typeof markahRaw !== 'number' && (typeof markahRaw !== 'string' || !/^\d+(?:\.\d+)?$/.test(markahRaw))) {
        return invalid('Markah pegawai mesti nombor antara 6.0 hingga 10.0.');
      }
      markah=Number(markahRaw);
      if (!Number.isFinite(markah) || markah<6 || markah>10 ||
          Math.abs(markah*10-Math.round(markah*10))>0.000001) {
        return invalid('Markah pegawai mesti antara 6.0 hingga 10.0 dengan satu tempat perpuluhan.');
      }
    }
    const prestasi = item.prestasi ?? null;
    if (prestasi !== null && prestasi !== '' &&
        (typeof prestasi !== 'string' || !['Sangat Baik','Baik','Memuaskan','Tidak Memuaskan'].includes(prestasi))) {
      return invalid('Pilihan prestasi pegawai tidak sah.');
    }
    const child: Body = {
      lantikan_pengadil_id:official.lantikan_pengadil_id,
      jawatan:official.jawatan,nama_pengadil:official.nama_pengadil,
      markah,prestasi:prestasi || null,
    };
    for (const field of listFields) {
      const values = item[field] ?? [];
      if (!Array.isArray(values) || values.length>30 ||
          values.some((value) => typeof value!=='string' || value.length>500)) {
        return invalid('Senarai kriteria penilaian tidak sah.');
      }
      child[field]=JSON.stringify(values);
    }
    for (const field of textFields) {
      const value = item[field] ?? '';
      if (typeof value!=='string' || value.length>10000) {
        return invalid('Nasihat penilaian terlalu panjang atau tidak sah.');
      }
      child[field]=value;
    }
    children.push(child);
  }
  return children;
}

/** Both portal and token drafts use the same guarded, atomic D1 mutation. */
export async function assessmentDraft(request: Request,env: Env,source:'session'|'token'): Promise<Response> {
  if (request.method!=='POST') return json({error:true,message:'Kaedah tidak disokong.'},405);
  if (env.STAGING_AUTH_ENABLED!=='1' || env.STAGING_WRITES_ENABLED!=='1') {
    return json({error:true,message:'Simpanan laporan belum tersedia di staging.'},503);
  }
  const user = source==='session' ? await currentUser(request,env) : null;
  if (source==='session' && !user) return json({error:true,message:'Sila log masuk.'},401);
  if (user && !['Penilai','PP Daerah'].includes(user.role)) {
    return json({error:true,message:'Lantikan RA tidak sah atau bukan milik anda.'},403);
  }
  const input = await boundedJson(request,256*1024);
  if (input instanceof Response) return input;
  if (!input || typeof input!=='object' || Array.isArray(input)) return invalid('Data laporan tidak sah.');
  const body = input as Body;
  if (body.hantar) {
    return json({error:true,message:'Penghantaran kepada Pengerusi belum tersedia di staging.'},503);
  }
  const token = source==='token' && typeof body.token==='string' ? body.token : '';
  if (source==='token' && !/^[a-fA-F0-9]{64}$/.test(token)) return json({error:true,message:'Token tidak sah.'},401);
  const jadualId = source==='session' ? positiveId(body.jadual_id) : null;
  const lantikanId = source==='session' ? positiveId(body.lantikan_id) : null;
  if (source==='session' && (!jadualId || !lantikanId)) {
    return invalid('jadual_id dan lantikan_id diperlukan.');
  }
  const assignment = source==='token'
    ? await env.DB.prepare(`SELECT id,jadual_id,pengadil_id,status FROM lantikan_pengadil
        WHERE penilaian_token=? AND jawatan='Penilai Pengadil' AND status='Diterima' LIMIT 1`)
      .bind(token).first<Assignment>()
    : await env.DB.prepare(`SELECT id,jadual_id,pengadil_id,status FROM lantikan_pengadil
        WHERE id=? AND jadual_id=? AND pengadil_id=?
          AND jawatan='Penilai Pengadil' AND status='Diterima' LIMIT 1`)
      .bind(lantikanId,jadualId,user!.id).first<Assignment>();
  if (!assignment) {
    return source==='token'
      ? json({error:true,message:'Token tidak sah atau tamat tempoh.'},401)
      : json({error:true,message:'Lantikan RA tidak sah atau bukan milik anda.'},403);
  }
  const officials = await env.DB.prepare(`
    SELECT lp.id AS lantikan_pengadil_id,lp.jawatan,
      COALESCE(NULLIF(trim(u.nama_penuh),''),NULLIF(trim(pl.nama),''),'Nama tidak direkodkan') AS nama_pengadil
    FROM lantikan_pengadil lp
    LEFT JOIN users u ON u.id=lp.pengadil_id
    LEFT JOIN pengadil_luar pl ON pl.id=lp.pengadil_luar_id
    WHERE lp.jadual_id=? AND lp.status='Diterima'
      AND lp.jawatan IN ('Pengadil','Penolong Pengadil 1','Penolong Pengadil 2','Pegawai ke4')
    ORDER BY CASE lp.jawatan WHEN 'Pengadil' THEN 1 WHEN 'Penolong Pengadil 1' THEN 2
      WHEN 'Penolong Pengadil 2' THEN 3 ELSE 4 END,lp.id
  `).bind(assignment.jadual_id).all<Official>();
  const children = normalizeChildren(body.pegawai,officials.results);
  if (children instanceof Response) return children;
  const parent = normalizeParent(body);
  if (parent instanceof Response) return parent;
  const existing = await env.DB.prepare(`SELECT id,status,worker_revision FROM laporan_penilaian
    WHERE lantikan_id=? ORDER BY id LIMIT 2`).bind(assignment.id).all<Existing>();
  if (existing.results.length>1 || (existing.results[0] && existing.results[0].status!=='Draf')) {
    return json({error:true,message:'Laporan yang telah dihantar tidak boleh diedit semula.'},409);
  }
  const revision = crypto.randomUUID();
  const guard = source==='token' ? 'la.penilaian_token=?' : 'la.pengadil_id=?';
  const guardValue = source==='token' ? token : user!.id;
  const crewFingerprint = [...officials.results]
    .sort((a,b) => a.lantikan_pengadil_id-b.lantikan_pengadil_id)
    .map((official) => `${official.lantikan_pengadil_id}:${official.jawatan}`).join('|');
  const active = `EXISTS (SELECT 1 FROM lantikan_pengadil la WHERE la.id=?
    AND la.jadual_id=? AND la.jawatan='Penilai Pengadil' AND la.status='Diterima'
    AND ${guard}) AND (SELECT group_concat(id||':'||jawatan,'|') FROM (
      SELECT id,jawatan FROM lantikan_pengadil WHERE jadual_id=? AND status='Diterima'
        AND jawatan IN ('Pengadil','Penolong Pengadil 1','Penolong Pengadil 2','Pegawai ke4')
      ORDER BY id))=?`;
  const values = parentColumns.map((column) => parent[column]);
  let first: D1PreparedStatement;
  if (existing.results[0]) {
    first = env.DB.prepare(`UPDATE laporan_penilaian SET
      ${parentColumns.map((column) => `${column}=?`).join(',')},
      worker_revision=?,updated_at=datetime('now','+8 hours')
      WHERE id=? AND status='Draf' AND COALESCE(worker_revision,'')=? AND ${active}`)
      .bind(...values,revision,existing.results[0].id,
        existing.results[0].worker_revision ?? '',assignment.id,assignment.jadual_id,guardValue,
        assignment.jadual_id,crewFingerprint);
  } else {
    first = env.DB.prepare(`INSERT INTO laporan_penilaian
      (jadual_id,lantikan_id,penilai_id,status,${parentColumns.join(',')},worker_revision,created_at,updated_at)
      SELECT ?,?,?,'Draf',${parentColumns.map(() => '?').join(',')},?,
        datetime('now','+8 hours'),datetime('now','+8 hours')
      WHERE ${active} AND NOT EXISTS (SELECT 1 FROM laporan_penilaian WHERE lantikan_id=?)`)
      .bind(assignment.jadual_id,assignment.id,assignment.pengadil_id,
        ...values,revision,assignment.id,assignment.jadual_id,guardValue,
        assignment.jadual_id,crewFingerprint,assignment.id);
  }
  const statements = [first,
    env.DB.prepare(`DELETE FROM laporan_penilaian_pegawai WHERE laporan_id IN
      (SELECT id FROM laporan_penilaian WHERE lantikan_id=? AND worker_revision=?)`)
      .bind(assignment.id,revision)];
  for (const child of children) {
    statements.push(env.DB.prepare(`INSERT INTO laporan_penilaian_pegawai
      (laporan_id,${childColumns.join(',')})
      SELECT id,${childColumns.map(() => '?').join(',')} FROM laporan_penilaian
      WHERE lantikan_id=? AND worker_revision=? AND status='Draf'`)
      .bind(...childColumns.map((column) => child[column] as string|number|null),assignment.id,revision));
  }
  let results: D1Result[];
  try { results=await env.DB.batch(statements); }
  catch (error) {
    if (String(error).includes('UNIQUE constraint failed')) {
      return json({error:true,message:'Draf telah berubah. Muat semula sebelum menyimpan.'},409);
    }
    throw error;
  }
  if (Number(results[0]?.meta?.changes)!==1 ||
      results.slice(2).some((result) => Number(result.meta?.changes)!==1)) {
    return json({error:true,message:'Draf telah berubah. Muat semula sebelum menyimpan.'},409);
  }
  const saved = await env.DB.prepare(`SELECT id FROM laporan_penilaian
    WHERE lantikan_id=? AND worker_revision=? LIMIT 1`).bind(assignment.id,revision).first<{id:number}>();
  if (!saved) throw new Error('Assessment draft not visible after D1 batch');
  return json({error:false,message:'Draf laporan disimpan.',id:saved.id});
}
