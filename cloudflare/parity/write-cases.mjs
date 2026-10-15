// Mutating PHP-vs-Worker cases for the endpoints ported on 15 Oct 2026. They
// run in order and change both database copies, so use throwaway copies.
// Admin user removal is compared on its refusals only: by owner decision the
// Worker deactivates where PHP deleted.
const req=(name,role,method,path,body)=>({name,role,method,path,body});

export const cases=[
  req('announcement create','Admin','POST','/api/announcements.php',{title:'Parity',content:'Isi ujian'}),
  req('announcement create empty','Admin','POST','/api/announcements.php',{title:'',content:'x'}),
  req('announcement create as PP','PP Daerah','POST','/api/announcements.php',{title:'A',content:'B'}),
  req('announcement edit','Admin','PUT','/api/announcements.php?id=21',{title:'Parity A',content:'Isi'}),
  req('announcement edit unchanged','Admin','PUT','/api/announcements.php?id=21',{title:'Parity A',content:'Isi'}),
  req('announcement edit no id','Admin','PUT','/api/announcements.php',{title:'A',content:'B'}),
  req('announcement delete missing','Admin','DELETE','/api/announcements.php?id=999999'),
  req('announcement delete','Admin','DELETE','/api/announcements.php?id=21'),
  req('announcement edit deleted','Admin','PUT','/api/announcements.php?id=21',{title:'X',content:'Y'}),

  req('user update bad email','Admin','PUT','/api/admin-users.php',
    {userId:55,nama_penuh:'A',email:'bukan-emel',user_role:'Pengadil',persatuan_id:1}),
  req('user update missing role','Admin','PUT','/api/admin-users.php',{userId:55,nama_penuh:'A',email:'a@example.invalid'}),
  req('user update no FA','Admin','PUT','/api/admin-users.php',
    {userId:55,nama_penuh:'A',email:'a@example.invalid',user_role:'Pengadil'}),
  req('user update bad role','Admin','PUT','/api/admin-users.php',
    {userId:55,nama_penuh:'A',email:'a@example.invalid',user_role:'Bos',persatuan_id:1}),
  req('user update no id','Admin','PUT','/api/admin-users.php',{nama_penuh:'A'}),
  req('user update','Admin','PUT','/api/admin-users.php',
    {userId:55,nama_penuh:'PARITY',email:'parity55@example.invalid',user_role:'Pengadil',persatuan_id:1,no_telefon:'0100'}),
  req('user update email taken','Admin','PUT','/api/admin-users.php',
    {userId:56,nama_penuh:'B',email:'parity55@example.invalid',user_role:'Pengadil',persatuan_id:1}),
  req('user update as PP','PP Daerah','PUT','/api/admin-users.php',{userId:55}),
  req('user patch no action','Admin','PATCH','/api/admin-users.php',{userId:55}),
  req('user patch bad action','Admin','PATCH','/api/admin-users.php',{userId:55,action:'lain'}),
  req('user patch missing user','Admin','PATCH','/api/admin-users.php',{userId:999999,action:'reset_password'}),
  req('user delete own','Admin','DELETE','/api/admin-users.php?id=1'),
  req('user delete missing','Admin','DELETE','/api/admin-users.php?id=999999'),
  req('user delete no id','Admin','DELETE','/api/admin-users.php'),

  req('profile no id','Admin','PUT','/api/profil-pengadil.php',{no_telefon:'1'}),
  req('profile as referee','Pengadil','PUT','/api/profil-pengadil.php',{id:55,no_telefon:'1'}),
  req('profile PP other district','PP Daerah','PUT','/api/profil-pengadil.php',{id:1,no_telefon:'1'}),
  req('profile missing user','Admin','PUT','/api/profil-pengadil.php',{id:999999,no_telefon:'1'}),
  req('profile no fields','Admin','PUT','/api/profil-pengadil.php',{id:55,tidak:'x'}),
  req('profile update','Admin','PUT','/api/profil-pengadil.php',{id:55,no_telefon:' 0199 ',saiz_baju:'',tahun_mula_aktif:'2019'}),
];
