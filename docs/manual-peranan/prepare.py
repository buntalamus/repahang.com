from pathlib import Path
import sqlite3,shutil,json,datetime
ROOT=Path(__file__).resolve().parents[2];TMP=ROOT/'tmp/manual-peranan'
TMP.mkdir(parents=True,exist_ok=True)
shutil.copy2(ROOT/'output/cloudflare/refpahang_2026-10-13_hanafi51_v2.sqlite',TMP/'contoh.sqlite')
c=sqlite3.connect(TMP/'contoh.sqlite');c.execute('PRAGMA foreign_keys=OFF')
for file in sorted((ROOT/'cloudflare/migrations').glob('*.sql')):
 sql=''
 for ch in file.read_text():
  sql+=ch
  if ch==';' and sqlite3.complete_statement(sql):
   try:c.execute(sql)
   except sqlite3.OperationalError as e:
    if not any(t in str(e).lower() for t in ['duplicate column','already exists']):raise RuntimeError(f'{file.name}: {e}')
   sql=''
 c.commit()
for (name,) in c.execute("SELECT name FROM sqlite_master WHERE type='trigger' AND tbl_name='perlawanan'").fetchall():
 c.execute(f'DROP TRIGGER "{name}"')
# This disposable copy is the only DB accessible by the documentation preview.
# Anonymise direct identity fields and narrative data across all imported tables.
for (table,) in c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").fetchall():
 cols=c.execute(f'PRAGMA table_info("{table}")').fetchall();names={r[1] for r in cols}
 sets=[]
 for _,name,typ,*_ in cols:
  low=name.lower()
  if low in ['nama_penuh','nama','nama_pengadil','nama_penilai','nama_waris','nama_pengerusi','nama_snapshot','pengesah_nama','nama_snapshot_pengadil','nama_majikan','nama_penjaga','name','display_name']:
   sets.append(f'"{name}"=\'CONTOH {table.upper()} \'||rowid')
  elif low in ['email','emel','emel_pengadil','emel_penilai','email_address']:
   sets.append(f'"{name}"=\'contoh-{table}-\'||rowid||\'@example.invalid\'')
  elif low in ['no_ic','no_kp','ic','no_kad_pengenalan']:
   sets.append(f'"{name}"=printf(\'90010106%04d\',rowid%10000)')
  elif 'telefon' in low or low in ['no_tel','phone','phone_number']:
   sets.append(f'"{name}"=\'0100000000\'')
  elif low.startswith('alamat') or low in ['address','text','message','content','description','subject','title','ip_address','user_agent'] or any(s in low for s in ['catatan','notes','komen','ulasan','kekuatan','kelemahan','nasihat']):
   if low.endswith(('kekuatan','kelemahan')):val='[]'
   elif low=='ip_address':val='127.0.0.1'
   elif low=='user_agent':val='Manual RefPahang'
   else:val='Contoh untuk rujukan manual RefPahang.'
   sets.append(f'"{name}"=CASE WHEN "{name}" IS NULL THEN NULL ELSE {json.dumps(val)} END')
  elif low in ['telegram_chat_id','tg_link_token','approval_token','url_gambar_profil','link_url']:
   sets.append(f'"{name}"=NULL')
  elif low=='password':sets.append('password=\'UNUSABLE-DOCUMENTATION-COPY\'')
 if sets:
  try:c.execute(f'UPDATE "{table}" SET '+','.join(sets))
  except sqlite3.IntegrityError as e:raise RuntimeError(f'Anonymisation {table}: {e}')
c.execute("UPDATE users SET nama_penuh=CASE role WHEN 'Admin' THEN 'ADMIN CONTOH ' WHEN 'PP Daerah' THEN 'PP DAERAH CONTOH ' WHEN 'Penilai' THEN 'PENILAI CONTOH ' ELSE 'PENGADIL CONTOH ' END||id,alamat1='Jalan Contoh',poskod='25000',daerah='Kuantan',negeri='Pahang',status_kerja='Tidak Bekerja',nama_waris='WARIS CONTOH',hubungan_waris='Ibu Bapa',telefon_waris='0100000000',saiz_baju='M',tahun_mula_aktif='2020',last_activity_at=unixepoch()")
for key in ['registration','berdaftar','penilai','bertulis','kelas1']:
 for suffix,val in [('open','1'),('open_date','2026-01-01'),('close_date','2026-12-31')]:
  c.execute('INSERT INTO application_settings(setting_key,setting_value) VALUES(?,?) ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value',(f'{key}_{suffix}',val))
for key,val in [('maintenance_mode','0'),('application_year','2026'),('payment_account_no','CONTOH SAHAJA'),('fam_account_no','CONTOH SAHAJA'),('payment_account_name','AKAUN CONTOH MANUAL')]:
 c.execute('INSERT INTO application_settings(setting_key,setting_value) VALUES(?,?) ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value',(key,val))
c.execute("UPDATE kejohanan SET nama='Kejohanan Contoh '||id")
c.execute("UPDATE jadual_perlawanan SET pasukan_home='PASUKAN A',pasukan_away='PASUKAN B',tempat='Padang Contoh'")
c.execute("UPDATE perlawanan SET home_team='PASUKAN A '||id,away_team='PASUKAN B '||id,tempat='Padang Contoh'")
for tab,col in [('permohonan','url_resit'),('permohonan','payment_receipt_url')]:
 c.execute(f'UPDATE {tab} SET {col}=NULL')
users={}
queries={
 'admin':"SELECT * FROM users WHERE role='Admin' AND aktif=1 ORDER BY id LIMIT 1",
 'pp':"SELECT u.* FROM users u WHERE role='PP Daerah' AND aktif=1 ORDER BY (SELECT count(*) FROM users x WHERE x.persatuan_id=u.persatuan_id) DESC LIMIT 1",
 'ra':"SELECT u.* FROM users u WHERE role='Penilai' AND aktif=1 ORDER BY (SELECT count(*) FROM lantikan_pengadil a WHERE a.pengadil_id=u.id AND a.jawatan='Penilai Pengadil' AND a.status='Diterima') DESC LIMIT 1",
 'pengadil':"SELECT u.* FROM users u WHERE role='Pengadil' AND aktif=1 ORDER BY (SELECT count(*) FROM perlawanan p WHERE p.user_id=u.id) DESC LIMIT 1"}
c.row_factory=sqlite3.Row
for key,q in queries.items():
 row=dict(c.execute(q).fetchone());row.pop('password',None);row['can_referee']=int(key in ['pengadil','pp']);row['can_ra']=int(key in ['ra','pp']);row['password_changed']=1
 row['persatuan_nama']='Persatuan Daerah Contoh';users[key]=row
c.execute("UPDATE users SET url_gambar_profil='/assets/images/logo-pahang.png'")
# Include one unresponded notified appointment in the referee's own assignment list.
ref=users['pengadil']['id'];a=c.execute('SELECT id,jadual_id FROM lantikan_pengadil WHERE pengadil_id=? ORDER BY id DESC LIMIT 1',(ref,)).fetchone()
if a:
 c.execute("UPDATE lantikan_pengadil SET status='Belum Jawab',notif_hantar=1,tarikh_notif=datetime('now','+8 hours') WHERE id=?",(a['id'],))
 c.execute("UPDATE jadual_perlawanan SET tarikh='2026-11-20',masa='17:00:00',status='Dijadualkan' WHERE id=?",(a['jadual_id'],))
# Seed illustrative review states, independently of production records.
for kind in ['pengadil_berdaftar','penilai_berdaftar','kelas3_fam']:
 ids=[r[0] for r in c.execute('SELECT id FROM permohonan WHERE jenis_borang=? AND tahun_permohonan=2026 ORDER BY id DESC LIMIT 2',(kind,))]
 if ids:c.execute("UPDATE permohonan SET status='Pending',status_workflow='Menunggu Admin',workflow_status='Pending',pp_verified_at='2026-10-19 09:00:00',pp_verified_by=?,admin_approved_at=NULL,admin_approved_by=NULL,final_approved_at=NULL WHERE id=?",(users['pp']['id'],ids[0]))
 if len(ids)>1:c.execute("UPDATE permohonan SET status='Rejected',status_workflow='Ditolak',workflow_status='Rejected',admin_notes='Dokumen contoh perlu disemak semula.' WHERE id=?",(ids[1],))
row=c.execute('SELECT p.id FROM permohonan p JOIN users x ON x.id=p.user_id WHERE x.persatuan_id=? AND p.user_id<>? AND p.tahun_permohonan=2026 ORDER BY p.id DESC LIMIT 1',(users['pp']['persatuan_id'],users['pp']['id'])).fetchone()
if row:c.execute("UPDATE permohonan SET status='Pending',status_workflow='Menunggu PP Daerah',workflow_status='Pending',pp_verified_at=NULL,pp_verified_by=NULL,final_approved_at=NULL WHERE id=?",(row[0],))
c.commit();c.close()
(TMP/'users.json').write_text(json.dumps(users,ensure_ascii=False,indent=2))
print('Disposable anonymised documentation database ready; four example roles.')
