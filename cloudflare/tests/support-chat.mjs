import assert from 'node:assert/strict';
import { bundle, openDatabase, sessionCookie } from './_harness.mjs';
const { supportChat } = await bundle("export {supportChat} from '../src/support-chat';");
const { db, DB, close } = openDatabase(['0001_worker_sessions', '0026_support_chat']);
const env = { DB, STAGING_AUTH_ENABLED: '1', STAGING_WRITES_ENABLED: '1' };
const create = (name, role, type) => Number(db.prepare(`INSERT INTO users(email,password,role,nama_penuh,jenis_pengadil,aktif,password_changed)
  VALUES(?,'unused',?,?,?,1,1)`).run(name+'@example.invalid', role, name, type).lastInsertRowid);
const ids = { ref: create('Chat Ref', 'Pengadil', 'Pengadil Baharu'), other: create('Other Ref', 'Pengadil', 'Pengadil Negeri'),
  ra: create('Chat RA', 'Penilai', 'Penilai Pengadil'), pp: create('Chat PP', 'PP Daerah', 'Pegawai Pembangunan'),
  ppRa: create('Chat PP RA', 'PP Daerah', 'Penilai Pengadil'), admin: create('Chat Admin', 'Admin', null),
  admin2: create('Chat Admin Two', 'Admin', null) };
const cookies = Object.fromEntries(await Promise.all(Object.entries(ids).map(async ([key, id]) => [key, await sessionCookie(db, id)])));
const call = (actor, query = '', body, method = body ? 'POST' : 'GET') => supportChat(new Request('https://chat.example/api/support-chat.php'+query,
  { method, headers: actor ? { Cookie: cookies[actor] } : {}, ...(body ? { body: JSON.stringify(body) } : {}) }), env);
const send = (actor, text, owner, clientId = crypto.randomUUID()) => call(actor, '', { action: 'send', body: text, client_id: clientId, ...(owner ? { user_id: owner } : {}) });
const read = (actor, owner, through) => call(actor, '', { action: 'read', user_id: owner, through_id: through });
const summary = async actor => (await (await call(actor, '?action=summary')).json()).unread_count;
try {
  assert.equal((await call(null)).status, 401);
  assert.equal((await call('pp')).status, 403);
  assert.equal((await call('ref', '', undefined, 'DELETE')).status, 405);
  assert.equal((await call('ref', '?action=threads')).status, 403);
  assert.equal((await call('ref', '?user_id='+ids.other)).status, 403);
  assert.equal((await send('ref', 'Wrong owner', ids.other)).status, 403);
  assert.equal((await call('admin', '?user_id='+ids.ref)).status, 404);
  assert.equal((await send('admin', 'Unsolicited conversation', ids.ref)).status, 404);
  assert.deepEqual((await (await call('ref')).json()).data, []);
  for (const text of ['', '   ', 'x'.repeat(2001)]) assert.equal((await send('ref', text)).status, 400);
  assert.equal((await call('ref', '', { action: 'send', body: 'valid', client_id: 'bad' })).status, 400);
  assert.equal((await call('ref', '?after=1%20OR%201=1')).status, 400);
  assert.equal((await call('ref', '?after=1&before=3')).status, 400);
  assert.equal((await call('admin', '?action=threads&page=0')).status, 400);
  assert.equal((await call('admin', '?action=threads&search='+'a'.repeat(101))).status, 400);
  env.STAGING_WRITES_ENABLED = '0'; assert.equal((await send('ref', 'Blocked')).status, 503); env.STAGING_WRITES_ENABLED = '1';

  const clientId = crypto.randomUUID();
  const first = (await (await send('ref', 'Pertanyaan ujian <script>alert(1)</script>', undefined, clientId)).json()).message_id;
  assert.ok(first);
  const duplicate = await Promise.all([send('ref', 'Pertanyaan ujian <script>alert(1)</script>', undefined, clientId), send('ref', 'Pertanyaan ujian <script>alert(1)</script>', undefined, clientId)]);
  for (const response of duplicate) assert.equal((await response.json()).message_id, first);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM support_messages').get().n, 1);
  assert.equal((await send('ref', 'Changed retry body', undefined, clientId)).status, 409);
  assert.equal(await summary('admin'), 1);
  assert.equal(await summary('ref'), 0);
  const second = (await (await send('ref', 'Mesej baharu')).json()).message_id;
  assert.equal((await read('admin', ids.ref, first)).status, 200);
  assert.equal(await summary('admin2'), 1, 'reading a snapshot never consumes a later message');
  assert.equal((await read('admin', ids.ref, first + 9999)).status, 400);
  const reply = (await (await send('admin', 'Balasan Admin', ids.ref)).json()).message_id;
  assert.equal(await summary('ref'), 1);
  assert.equal(await summary('other'), 0);
  const history = (await (await call('ref')).json()).data;
  assert.deepEqual(history.map(row => row.id), [first, second, reply]);
  assert.equal(history.at(-1).sender_name, 'Admin');
  assert.equal(history[0].body, 'Pertanyaan ujian <script>alert(1)</script>');
  assert.ok(history.every(row => !('sender_id' in row) && !('email' in row)));
  assert.equal((await read('other', ids.ref, reply)).status, 403);
  assert.equal((await read('other', ids.other, reply)).status, 400);
  assert.equal((await read('ref', ids.ref, reply)).status, 200);
  assert.equal(await summary('ref'), 0);
  assert.equal((await read('ref', ids.ref, first)).status, 200);
  assert.equal(db.prepare('SELECT user_read_id FROM support_threads WHERE user_id=?').get(ids.ref).user_read_id, reply);
  assert.equal((await send('ra', 'Soalan penilai')).status, 200);
  assert.equal((await send('ppRa', 'Soalan PP yang juga RA')).status, 200);
  const list = await (await call('admin', '?action=threads')).json();
  assert.equal(list.total, 3);
  assert.equal(list.data.find(row => row.user_id === ids.ref).unread_count, 1);
  assert.equal((await (await call('admin', '?action=threads&search=Chat%20RA')).json()).total, 1);
  assert.equal((await (await call('admin', '?action=threads&search=%25')).json()).total, 0);
  const delta = await (await call('ref', '?after='+second)).json();
  assert.deepEqual(delta.data.map(row => row.id), [reply]);
  const older = await (await call('ref', '?before='+reply)).json();
  assert.deepEqual(older.data.map(row => row.id), [first, second]);

  // Server determines sender identity and role; supplied impersonation fields are ignored.
  await call('ra', '', { action: 'send', body: 'Identity test', client_id: crypto.randomUUID(), is_admin: 1, sender_id: ids.admin });
  assert.equal(db.prepare('SELECT is_admin,sender_id FROM support_messages ORDER BY id DESC LIMIT 1').get().sender_id, ids.ra);
  assert.equal(db.prepare('SELECT is_admin FROM support_messages ORDER BY id DESC LIMIT 1').get().is_admin, 0);
  for (let i = 0; i < 7; i++) assert.equal((await send('ref', 'Rate '+i)).status, 200);
  const raced = await Promise.all([send('ref', 'Rate concurrent A'), send('ref', 'Rate concurrent B')]);
  assert.deepEqual(raced.map(response => response.status).sort(), [200, 429]);
  assert.equal((await send('ref', 'Rate blocked')).status, 429);
  assert.equal((await send('ref', 'Pertanyaan ujian <script>alert(1)</script>', undefined, clientId)).status, 200, 'idempotent retries work even at rate limit');
  db.prepare("UPDATE support_messages SET created_at=datetime('now','-2 minutes') WHERE sender_id=?").run(ids.ref);
  assert.equal((await send('ref', 'Rate reset')).status, 200);
  db.prepare('INSERT INTO support_threads(user_id) VALUES(?)').run(ids.other);
  for (let i = 0; i < 65; i++) db.prepare(`INSERT INTO support_messages(user_id,sender_id,is_admin,client_id,body) VALUES(?,?,0,?,?)`)
    .run(ids.other, ids.other, crypto.randomUUID(), 'History '+i);
  const latest = await (await call('other')).json();
  assert.equal(latest.data.length, 50); assert.equal(latest.has_more, true);
  const previous = await (await call('other', '?before='+latest.data[0].id)).json();
  assert.equal(previous.data.length, 15); assert.equal(previous.has_more, false);
  assert.equal(new Set([...latest.data, ...previous.data].map(row => row.id)).size, 65);
  const incremental = await (await call('other', '?after='+previous.data[0].id)).json();
  assert.equal(incremental.data.length, 50); assert.equal(incremental.has_more, true);
} finally { close(); }
console.log('Support chat: private conversations, role/capability gates, admin replies, read watermarks, retries, rate limit and cursor validation passed');
