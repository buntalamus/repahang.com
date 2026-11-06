/** Shared, user-facing error details. Request bodies are never printed in a toast. */
export interface ApiErrorContext {
  url: string;
  method: string;
  body?: unknown;
  requestId?: string | null;
  retryAfter?: string | null;
}

const contexts = new WeakMap<object, ApiErrorContext>();

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' ? value as Record<string, unknown> : {};
}

export function rememberApiError(error: unknown, context: ApiErrorContext): void {
  if (error !== null && typeof error === 'object') contexts.set(error, context);
}

function text(value: unknown): string {
  if (typeof value !== 'string') return '';
  const result = value.trim();
  // A proxy HTML page, SQL exception or stack trace is not an explanation for users.
  if (/<(?:!doctype|html|script|body)\b|SQLSTATE\[|SQLITE_\w+|\bat \S+ \([^\n]+:\d+:\d+\)/i.test(result)) return '';
  return result;
}

function payload(error: unknown): Record<string, unknown> {
  const outer = record(error);
  const body = outer['error'];
  if (body !== null && typeof body === 'object') return record(body);
  if (typeof body === 'string') {
    try { return record(JSON.parse(body)); } catch { return { message: text(body) }; }
  }
  return outer;
}

const subjects: Record<string, string> = {
  'admin-approve': 'permohonan', 'admin-applications': 'permohonan', 'pp-applications': 'permohonan daerah',
  'pp-verify': 'pengesahan permohonan daerah', 'admin-test-applications': 'permohonan ujian',
  'pengadil-application': 'permohonan pengadil', 'permohonan-history': 'sejarah permohonan',
  'submit-application': 'penghantaran permohonan', 'application-settings': 'tetapan permohonan',
  'admin-users': 'pengguna', 'admin-user-master-data': 'maklumat pengguna', 'admin-profile': 'profil Admin',
  'admin-users-master-data': 'eksport maklumat pengguna',
  'profil-pengadil': 'profil pengadil', 'update-profile': 'profil', 'upload-profile-image': 'gambar profil',
  'lantikan': 'lantikan pengadil', 'lantikan-audit': 'rekod lantikan', 'lantikan-jawab': 'jawapan lantikan',
  'tugasan': 'tugasan', 'jadual-perlawanan': 'jadual perlawanan', 'jadual-lantikan-report': 'laporan jadual lantikan',
  'jadual-upload': 'muat naik jadual', 'kejohanan': 'kejohanan', 'pengadil-luar': 'pengadil luar',
  'pengadil-luar-upload': 'muat naik pengadil luar', 'laporan-penilaian': 'laporan penilaian',
  'penilaian-token': 'laporan penilaian', 'pp-penilaian': 'laporan penilaian daerah',
  'pp-verify-match': 'pengesahan perlawanan', 'pengadil-match-manage': 'rekod perlawanan',
  'admin-matches': 'rekod perlawanan', 'statistics': 'statistik', 'admin-settings': 'tetapan sistem',
  'admin-mailbox': 'peti emel', 'admin-mail-campaigns': 'kumpulan emel', 'announcements': 'pengumuman',
  'notifications': 'notifikasi', 'telegram-link-self': 'pautan Telegram', 'support-chat': 'chat sokongan',
  'login': 'log masuk', 'register': 'pendaftaran akaun', 'change-password': 'penukaran kata laluan',
  'forgot-password': 'permintaan pautan kata laluan', 'reset-password': 'tetapan semula kata laluan',
  'download-referees-excel': 'muat turun senarai pengadil', 'jfa-c13': 'laporan C13',
  'admin-dashboard-stats': 'ringkasan Admin', 'admin-dashboard-tasks': 'tugasan Admin',
  'admin-demo-outbox': 'notifikasi demo', 'admin-telegram-blast': 'hebahan Telegram',
  'check-maintenance': 'status penyelenggaraan', 'districts': 'senarai daerah',
  'download-borang-pendaftaran': 'muat turun borang pendaftaran', 'get-active-referees': 'pengadil aktif',
  'get-user-profile': 'profil pengguna', 'kejohanan-pengesah-laporan': 'pengesah laporan kejohanan',
  'logout': 'log keluar', 'mobile-usage': 'statistik penggunaan app',
  'pengadil-application-history': 'sejarah permohonan pengadil', 'pengadil-luar-telegram-blast': 'hebahan Telegram pengadil luar',
  'pengadil-matches': 'rekod perlawanan pengadil', 'pengadil-penilaian': 'penilaian pengadil',
  'pengadil-taraf': 'taraf pengadil', 'pool-pengadil': 'senarai calon pengadil', 'portal-dashboard': 'ringkasan portal',
  'pp-referees': 'pengadil daerah', 'public-announcements': 'pengumuman awam', 'public-persatuan': 'senarai persatuan',
  'referees': 'senarai pengadil', 'registration-status': 'status pendaftaran', 'session': 'sesi log masuk',
  'webpush-key': 'tetapan notifikasi peranti', 'webpush-subscribe': 'langganan notifikasi peranti',
};

function requestDescription(context?: ApiErrorContext): { operation: string; reference: string } {
  if (!context) return { operation: 'Permintaan tidak berjaya.', reference: '' };
  const url = new URL(context.url, 'https://refpahang.com');
  const endpoint = url.pathname.split('/').pop()?.replace(/\.php$/, '') || '';
  const body = typeof FormData !== 'undefined' && context.body instanceof FormData
    ? Object.fromEntries(['action', 'id', 'permohonan_id', 'application_id', 'jadual_id'].map(key => [key, context.body instanceof FormData ? context.body.get(key) : null]))
    : record(context.body);
  const action = body['action'];
  let operation = ['GET', 'HEAD'].includes(context.method) ? 'Gagal memuatkan' : 'Gagal memproses';
  if (context.method === 'DELETE' || action === 'delete' || action === 'delete_application') operation = 'Gagal memadam';
  if (endpoint === 'admin-approve') operation = action === 'reject' ? 'Gagal menolak' : 'Gagal meluluskan';
  const subject = subjects[endpoint] || endpoint.replace(/^(admin|pp|pengadil)-/, '').replace(/-/g, ' ') || 'permintaan portal';
  const rawId = body['permohonan_id'] ?? body['application_id'] ?? body['id'] ?? body['jadual_id']
    ?? url.searchParams.get('id') ?? url.searchParams.get('application_id');
  const id = /^\d{1,10}$/.test(String(rawId ?? '')) ? String(rawId) : '';
  return { operation: `${operation} ${subject}.`, reference: id ? `${subject} #${id}` : '' };
}

const fields: Record<string, string> = {
  email: 'Emel', emel: 'Emel', nama_penuh: 'Nama penuh', no_ic: 'No. kad pengenalan',
  no_kp: 'No. kad pengenalan', no_telefon: 'No. telefon', notes: 'Catatan',
  permohonan_id: 'ID permohonan', persatuan_id: 'Persatuan daerah', url_resit: 'Resit bayaran', action: 'Tindakan',
};

function details(value: unknown, prefix = '', depth = 0): string[] {
  if (depth > 3 || value === null || value === undefined) return [];
  if (typeof value === 'string') {
    const message = text(value);
    return message ? [prefix ? `${prefix}: ${message}` : message] : [];
  }
  if (Array.isArray(value)) return value.flatMap(item => details(item, prefix, depth + 1));
  const item = record(value);
  const message = text(item['message']) || text(item['reason']);
  if (message) {
    const label = text(item['label']) || text(item['field']) || prefix;
    return [label ? `${fields[label] || label.replace(/_/g, ' ')}: ${message}` : message];
  }
  return Object.entries(item).flatMap(([key, child]) => details(child, fields[key] || key.replace(/_/g, ' '), depth + 1));
}

export function apiErrorMessage(error: unknown, operation?: string): string {
  const outer = record(error);
  const body = payload(error);
  const context = error !== null && typeof error === 'object' ? contexts.get(error) : undefined;
  const request = requestDescription(context);
  const status = typeof outer['status'] === 'number' ? outer['status'] : 0;
  const timedOut = outer['name'] === 'TimeoutError';
  const hasHttpStatus = typeof outer['status'] === 'number';
  const invalidResponse = hasHttpStatus && status >= 200 && status < 300 && outer['ok'] === false;
  let reason = text(body['message']) || text(body['reason']);
  const vagueReason = /^(?:ralat(?: pelayan(?: dalaman)?)?|permintaan gagal|parameter tidak sah|data tidak sah|gagal meluluskan permohonan)\.?$/i.test(reason);
  if (timedOut || invalidResponse || vagueReason || !reason || reason.startsWith('Http failure')) {
    reason = timedOut ? 'Pelayan belum memberi jawapan dalam masa yang ditetapkan.'
      : invalidResponse ? 'Jawapan pelayan tidak dapat dibaca kerana format data yang diterima tidak sah.'
      : hasHttpStatus && status === 0 ? 'Tiada respons diterima daripada pelayan; punca sambungan belum dapat dipastikan.'
      : status === 401 ? 'Sesi log masuk tidak sah atau telah tamat.'
      : status === 403 ? 'Pelayan menolak akses untuk akaun atau tindakan ini.'
      : status === 404 ? 'Rekod atau fungsi yang diminta tidak ditemui.'
      : status === 409 ? 'Tindakan bercanggah dengan keadaan semasa rekod.'
      : status === 413 ? 'Saiz fail atau data melebihi had yang dibenarkan.'
      : status === 429 ? 'Terlalu banyak permintaan diterima dalam tempoh singkat.'
      : status >= 500 ? 'Pelayan mengalami ralat dan tidak memberikan sebab terperinci.'
      : status === 400 || status === 422 ? 'Pelayan menolak data permintaan; medan yang bermasalah tidak dinyatakan.'
      : 'Sistem tidak memberikan sebab terperinci bagi kegagalan ini.';
  }
  const workflow = text(body['status_workflow']);
  const isWrite = context && !['GET', 'HEAD'].includes(context.method);
  const login = context && /\/login\.php(?:\?|$)/.test(context.url);
  const uncertain = timedOut || invalidResponse || (hasHttpStatus && (status === 0 || status >= 500));
  const nextAction = text(body['next_action']) || text(body['next_step'])
    || (workflow === 'Menunggu PP Daerah' ? 'Minta PP Daerah mengesahkan permohonan dahulu. Kemudian muat semula senarai sebelum Admin membuat keputusan.'
      : status === 401 && login ? 'Semak emel dan kata laluan. Gunakan Lupa Kata Laluan jika anda perlu menetapkan kata laluan baharu.'
      : status === 401 ? 'Log masuk semula, kemudian buka semula halaman ini.'
      : body['code'] === 'ACCOUNT_INACTIVE' ? 'Hubungi Admin untuk menyemak status akaun.'
      : status === 403 ? 'Semak peranan akaun dan kebenaran tindakan dengan Admin.'
      : status === 413 ? 'Kecilkan fail mengikut had yang dinyatakan pada borang, kemudian muat naik semula.'
      : status === 429 ? 'Tunggu sebentar sebelum mencuba semula.'
      : uncertain && isWrite ? 'Muat semula dan semak sama ada perubahan sudah direkodkan sebelum menghantar semula. Jika masih gagal, berikan rujukan ini kepada Admin.'
      : uncertain ? 'Semak sambungan dan cuba muat semula. Jika masih gagal, berikan rujukan ini kepada Admin.'
      : status === 409 || status === 404 ? 'Muat semula senarai dan semak status rekod sebelum meneruskan. Hubungi Admin jika maklumat masih tidak sepadan.'
      : 'Semak butiran yang dinyatakan dan betulkan borang. Jika punca tidak dinyatakan atau masih gagal, hubungi Admin dengan rujukan ini.');
  const heading = operation && !/^(?:ralat(?: pelayan)?\.?|tidak dapat menyambung ke pelayan\.?)$/i.test(operation)
    ? operation : request.operation;
  const lines = [heading, `Sebab: ${reason}`];
  const additionalReason = text(body['reason']);
  if (additionalReason && additionalReason !== reason) lines.push(`Butiran: ${additionalReason}`);
  if (workflow) lines.push(`Status semasa: ${workflow}.`);
  const extra = [...details(body['errors']), ...details(body['missing']), ...details(body['details'])];
  for (const item of new Set(extra)) if (item !== reason) lines.push(`• ${item}`);
  lines.push(`Tindakan: ${nextAction}`);
  const requestId = text(body['request_id']) || context?.requestId || '';
  const code = text(body['code']);
  const refs = [request.reference, status >= 400 ? `HTTP ${status}` : '', code, requestId].filter(Boolean);
  if (refs.length) lines.push(`Rujukan: ${refs.join(' · ')}`);
  return lines.join('\n');
}
