import { json } from './auth';
import criteria from './kriteria-penilaian.json';
import type { Env } from './types';

type Row = Record<string,unknown>;

const KUP_ROLES = "'Pengadil','Penolong Pengadil 1','Penolong Pengadil 2','Pegawai ke4'";
const JSON_COLUMNS = [
  'kawalan_kekuatan','kawalan_kelemahan','fizikal_kekuatan','fizikal_kelemahan',
  'kerjasama_kekuatan','kerjasama_kelemahan',
] as const;

function sectionsFor(role: string): Array<{key:string;label:string;items:readonly string[]}> {
  const kind = role.includes('Penolong') || role.includes('Pembantu')
    ? 'Penolong Pengadil'
    : role.includes('ke4') || role.includes('Keempat') || role.includes('Ke 4') || role.includes('Ke-4')
      ? 'Pegawai ke4' : 'Pengadil';
  return Object.entries(criteria[kind]).map(([key,section]) => ({key,...section}));
}

function decodeOfficial(row: Row): Row {
  const copy = {...row};
  for (const column of JSON_COLUMNS) {
    try {
      const parsed: unknown = JSON.parse(String(copy[column] ?? ''));
      copy[column] = Array.isArray(parsed) ? parsed : [];
    } catch { copy[column] = []; }
  }
  return copy;
}

/** Purpose-bound RA report lookup. Submission remains gated until chair delivery is ported. */
export async function assessmentToken(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'POST') {
    return json({error:true,message:'Kaedah tidak disokong.'},405);
  }
  if (env.STAGING_AUTH_ENABLED !== '1') {
    return json({error:true,message:'Borang penilaian belum tersedia di staging.'},503);
  }
  if (request.method === 'POST') {
    return json({error:true,message:'Penghantaran laporan belum tersedia di staging.'},503);
  }
  const url = new URL(request.url);
  const token = url.searchParams.get('token') ?? '';
  if (url.searchParams.getAll('token').length !== 1 || !/^[a-fA-F0-9]{32,128}$/.test(token)) {
    return json({error:true,message:'Token tidak sah.'},401);
  }
  const appointment = await env.DB.prepare(`
    SELECT lp.id AS lantikan_id,lp.jadual_id,lp.pengadil_id,lp.pengadil_luar_id,
      jp.no_perlawanan,jp.tarikh,jp.masa,jp.hari,jp.pasukan_home,jp.pasukan_away,
      jp.tempat,jp.kumpulan_tahap,k.nama AS nama_kejohanan,k.anjuran,
      COALESCE(u.nama_penuh,pl.nama) AS nama_penilai
    FROM lantikan_pengadil lp
    JOIN jadual_perlawanan jp ON jp.id=lp.jadual_id
    JOIN kejohanan k ON k.id=jp.kejohanan_id
    LEFT JOIN users u ON u.id=lp.pengadil_id
    LEFT JOIN pengadil_luar pl ON pl.id=lp.pengadil_luar_id
    WHERE lp.penilaian_token=? AND lp.jawatan='Penilai Pengadil'
      AND lp.status='Diterima' LIMIT 1
  `).bind(token).first<Row>();
  if (!appointment) return json({error:true,message:'Token tidak sah atau tamat tempoh.'},401);
  const jadualId = Number(appointment.jadual_id);
  const officials = await env.DB.prepare(`
    SELECT lp.id AS lantikan_pengadil_id,lp.jawatan,
      COALESCE(NULLIF(trim(u.nama_penuh),''),NULLIF(trim(pl.nama),''),'Nama tidak direkodkan')
        AS nama_pengadil
    FROM lantikan_pengadil lp
    LEFT JOIN users u ON u.id=lp.pengadil_id
    LEFT JOIN pengadil_luar pl ON pl.id=lp.pengadil_luar_id
    WHERE lp.jadual_id=? AND lp.status='Diterima' AND lp.jawatan IN (${KUP_ROLES})
    ORDER BY CASE lp.jawatan WHEN 'Pengadil' THEN 1 WHEN 'Penolong Pengadil 1' THEN 2
      WHEN 'Penolong Pengadil 2' THEN 3 ELSE 4 END,lp.id
  `).bind(jadualId).all<{lantikan_pengadil_id:number;jawatan:string;nama_pengadil:string}>();
  const existing = await env.DB.prepare(`
    SELECT id,status,tahap_kesukaran,cuaca,ulasan_keseluruhan,
      skor_ht_home,skor_ht_away,skor_ft_home,skor_ft_away,
      skor_et_home,skor_et_away,skor_ps_home,skor_ps_away
    FROM laporan_penilaian WHERE lantikan_id=? ORDER BY id DESC LIMIT 1
  `).bind(appointment.lantikan_id).first<Row>();
  const saved = existing ? await env.DB.prepare(`
    SELECT * FROM laporan_penilaian_pegawai WHERE laporan_id=?
  `).bind(existing.id).all<Row>() : {results:[]};
  return json({
    error:false,
    match:{
      no_perlawanan:appointment.no_perlawanan,tarikh:appointment.tarikh,masa:appointment.masa,
      hari:appointment.hari,pasukan_home:appointment.pasukan_home,
      pasukan_away:appointment.pasukan_away,tempat:appointment.tempat,
      kejohanan:appointment.nama_kejohanan,kumpulan_tahap:appointment.kumpulan_tahap,
    },
    penilai_nama:appointment.nama_penilai,
    officials:officials.results.map((official) => ({
      ...official,lantikan_id:official.lantikan_pengadil_id,
      sections:sectionsFor(official.jawatan),
    })),
    existing:existing ? {...existing,pegawai:saved.results.map(decodeOfficial)} : null,
    kriteria:criteria,
  });
}
