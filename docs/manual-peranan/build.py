#!/usr/bin/env python3
from pathlib import Path
from xml.sax.saxutils import escape
import json,re,hashlib,math,sys
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph,Table,TableStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from PIL import Image
from content import BOOKS
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'output/manual-peranan';SHOTS=ROOT/'docs/manual-peranan/screenshots';PDFS=ROOT/'output/pdf'
PDFS.mkdir(parents=True,exist_ok=True)
for name,weight in [('Inter',400),('Inter-Bold',700)]:pdfmetrics.registerFont(TTFont(name,str(ROOT/f'mobile/assets/fonts/Inter-{weight}.ttf')))
pdfmetrics.registerFontFamily('Inter',normal='Inter',bold='Inter-Bold',italic='Inter',boldItalic='Inter-Bold')
W,H=A4;M=42;CW=W-2*M;BOTTOM=58
INK=colors.HexColor('#111827');GRAY=colors.HexColor('#566174');YELLOW=colors.HexColor('#FADA00');PALE=colors.HexColor('#F1F4F8')
ST={
 'body':ParagraphStyle('body',fontName='Inter',fontSize=10.2,leading=14.4,textColor=INK),
 'step':ParagraphStyle('step',fontName='Inter',fontSize=10.2,leading=14.4,textColor=INK),
 'note':ParagraphStyle('note',fontName='Inter',fontSize=9.1,leading=13,textColor=INK),
 'cap':ParagraphStyle('cap',fontName='Inter',fontSize=8.1,leading=11.2,textColor=GRAY),
 'title':ParagraphStyle('title',fontName='Inter-Bold',fontSize=21,leading=25,textColor=INK),
 'toc':ParagraphStyle('toc',fontName='Inter',fontSize=8.55,leading=11.3,textColor=INK),
 'toch':ParagraphStyle('toch',fontName='Inter-Bold',fontSize=8.9,leading=12.2,textColor=INK),
 'cell':ParagraphStyle('cell',fontName='Inter',fontSize=10,leading=14.2,textColor=INK),
 'cellh':ParagraphStyle('cellh',fontName='Inter-Bold',fontSize=10,leading=14.2,textColor=INK),
}
KEYWORDS=['Pengesahan Permohonan','Pengesahan Perlawanan','Pendaftaran Tahunan (R1)','Pendaftaran Tahunan','Pengadil Berdaftar','Penilai Pengadil Berdaftar','Notifikasi Lantikan','Tambah Pengguna','Tambah Perlawanan','Simpan Draf','Hantar Laporan','Hantar Permohonan','Hantar Pendaftaran','Muat Naik Excel','Muat Turun Template','Muat Turun PDF','Muat Turun Master Data','Edit Profil','Butiran Lanjut','Ubah Status','Luluskan','Menunggu PP Daerah','Menunggu Admin','Admin Diluluskan','Belum Jawab','Tidak Disahkan','Diterima','Ditolak','Disahkan','Dihantar','Tukar Kata Laluan','Pautan & Log','Tetapkan Pengerusi','Tambah ke Pool','Kemaskini','Statistik Saya','Tugasan Lantikan Saya','Profil Saya','Log Masuk','Log Keluar','Semak Status Pemautan','Hubungkan Telegram','Aktifkan notifikasi','Notifikasi aktif','Perlu Dinilai','Laporan Saya','Isi Laporan','Penilaian Saya','Kelas III FAM','Ujian Kelas I FAM','Pengadil Luar','Peti Emel','Buku alamat & blast','Tulis emel','Simpan kenalan','Segerak Shinjiru','Muat semula','Pratonton','Tandakan Tidak Aktif','Aktifkan','Sahkan Semua','Sahkan','Seminar','Ujian','Simpan','Tambah','Tolak','Terima','Ganti','Lihat','Padam','Tugasan','Permohonan','Dashboard','Profil','Tetapan','Statistik']
PAT=re.compile(r'(?<!\w)('+ '|'.join(re.escape(escape(v)) for v in sorted(KEYWORDS,key=len,reverse=True))+r')(?!\w)')
def fmt(t):return PAT.sub(lambda m:'<b>'+m[0]+'</b>',escape(str(t)))
def pobj(text,style='body',rich=False):return Paragraph(text if rich else fmt(text),ST[style])
def height(text,w,style='body'):return pobj(text,style).wrap(w,H)[1]
class Manual:
 def __init__(self,key,book):
  self.key=key;self.book=book;self.total=len(book['pages'])+2;self.figures=[];self.bounds=[]
  self.path=PDFS/book['file'];self.c=canvas.Canvas(str(self.path),pagesize=A4,pageCompression=1)
  self.c.setTitle('Manual Pengguna RefPahang - '+book['title']);self.c.setAuthor('RefPahang');self.c.setSubject(book['subtitle'])
 def text(self,text,x,y,w,style='body',gap=8,rich=False):
  p=pobj(text,style,rich);_,hh=p.wrap(w,H)
  if y-hh<BOTTOM:raise ValueError(f'{self.key} page {self.c.getPageNumber()} text overflow: {text[:70]} bottom={y-hh}')
  p.drawOn(self.c,x,y-hh);self.bounds.append((self.c.getPageNumber(),'text',x,y-hh,w,hh));return y-hh-gap
 def header(self,chapter,title):
  c=self.c;c.setFillColor(YELLOW);c.rect(M,H-51,26,3,fill=1,stroke=0)
  c.setFillColor(GRAY);c.setFont('Inter-Bold',8);c.drawString(M+36,H-52,'REFPAHANG / '+self.book['title'].upper())
  c.setFont('Inter',8);c.drawRightString(W-M,H-52,chapter.upper())
  self.text(title,M,H-73,CW,'title')
  c.setStrokeColor(colors.HexColor('#D9DFE6'));c.line(M,46,W-M,46)
  c.setFont('Inter',8);c.setFillColor(GRAY);c.drawString(M,31,'Manual pengguna / Edisi 20 Oktober 2026')
  c.drawRightString(W-M,31,f'{c.getPageNumber():02d} / {self.total:02d}')
 def cover(self):
  c=self.c;c.setFillColor(colors.HexColor('#101114'));c.rect(0,0,W,H,fill=1,stroke=0)
  c.drawImage(str(ROOT/'mobile/assets/images/logo-pahang.png'),M,H-160,100,100,mask='auto')
  c.setFillColor(YELLOW);c.setFont('Inter-Bold',11);c.drawString(M,H-202,'SISTEM PENGURUSAN PENGADIL PBNP')
  c.setFillColor(colors.white);c.setFont('Inter-Bold',34);c.drawString(M,H-263,'Manual Pengguna')
  roleStyle=ParagraphStyle('coverRole',fontName='Inter-Bold',fontSize=49,leading=56,textColor=YELLOW)
  role=Paragraph(escape(self.book['title']),roleStyle);_,rh=role.wrap(CW,H);role.drawOn(c,M,H-296-rh)
  sub=Paragraph(escape(self.book['subtitle']),ParagraphStyle('coverSub',fontName='Inter',fontSize=15,leading=22,textColor=colors.HexColor('#D5D9DF')))
  _,sh=sub.wrap(CW-20,H);sub.drawOn(c,M,H-325-rh-sh)
  for idx,line in enumerate(['Tatacara langkah demi langkah','Screenshot antaramuka sebenar dengan data contoh','Portal web, aplikasi mobile dan notifikasi']):
   c.setFillColor(colors.HexColor('#D5D9DF'));c.setFont('Inter',11);c.drawString(M,233-idx*23,line)
  c.setFillColor(YELLOW);c.roundRect(M,126,CW,39,8,fill=1,stroke=0)
  c.setFillColor(INK);c.setFont('Inter-Bold',10);c.drawString(M+14,141,'PANDUAN OPERASI / KHUSUS MENGIKUT PERANAN')
  c.setFont('Inter',9.6);c.setFillColor(colors.HexColor('#D5D9DF'));c.drawString(M,91,'Edisi 20 Oktober 2026 | https://refpahang.com')
  c.setFont('Inter',9);c.drawString(M,70,'Rujukan portal semasa dan aplikasi mobile 1.3.0')
  c.bookmarkPage('cover');c.addOutlineEntry('Manual Pengguna '+self.book['title'],'cover',0,False);c.showPage()
 def contents(self):
  c=self.c;self.header('Navigasi manual','Kandungan manual');c.bookmarkPage('contents');c.addOutlineEntry('Kandungan manual','contents',1,False)
  entries=list(enumerate(self.book['pages'],3));split=math.ceil(len(entries)/2)
  for col,batch in enumerate([entries[:split],entries[split:]]):
   x=M+col*(CW/2+9);w=CW/2-16;y=H-121;chapter=None
   for num,p in batch:
    if chapter!=p['chapter']:
     y-=5;chapter=p['chapter'];y=self.text(chapter,x,y,w,'toch',gap=5)
    par=Paragraph(f'<link href="#p{num}" color="#111827">{escape(p["title"])}</link>',ST['toc']);_,hh=par.wrap(w-22,H)
    if y-hh<BOTTOM:raise ValueError(f'{self.key} contents overflow column {col} at {p["title"]}')
    par.drawOn(c,x,y-hh);c.setFillColor(INK);c.setFont('Inter-Bold',8.4);c.drawRightString(x+w,y-9,str(num));y-=hh+3.1
  c.showPage()
 def body_height(self,p,w):
  total=sum(height(s,w-25,'step')+9 for s in p['steps'])
  if p['note']:total+=height(p['note'],w-24,'note')+28
  return total
 def body(self,p,x,y,w):
  for i,s in enumerate(p['steps'],1):
   self.c.setFillColor(INK);self.c.setFont('Inter-Bold',10);self.c.drawString(x,y-11,f'{i:02d}')
   y=self.text(s,x+25,y,w-25,'step',gap=9)
  if p['note']:
   nh=height(p['note'],w-24,'note')+20
   if y-nh<BOTTOM:raise ValueError(f'{self.key} page {self.c.getPageNumber()} note overflow')
   self.c.setFillColor(colors.HexColor('#FFF8D6'));self.c.roundRect(x,y-nh,w,nh,6,fill=1,stroke=0)
   self.text(p['note'],x+12,y-10,w-24,'note',gap=0);y-=nh+8
  return y
 def shot(self,name,x,y,w,maxh):
  file=SHOTS/(name+'.png');im=Image.open(file);ratio=min(w/im.width,maxh/im.height);iw,ih=im.width*ratio,im.height*ratio;x+=(w-iw)/2
  self.c.setStrokeColor(colors.HexColor('#D7DEE7'));self.c.setFillColor(colors.white);self.c.roundRect(x-3,y-ih-3,iw+6,ih+6,6,fill=1,stroke=1)
  self.c.drawImage(str(file),x,y-ih,width=iw,height=ih,mask='auto')
  figure=len(self.figures)+1;self.figures.append(dict(figure=figure,name=name,page=self.c.getPageNumber(),sha256=hashlib.sha256(file.read_bytes()).hexdigest(),image_px=[im.width,im.height],draw_size_pt=[round(iw,2),round(ih,2)]))
  self.bounds.append((self.c.getPageNumber(),'image',x,y-ih,iw,ih))
  caption=f'Rajah {figure:02d} | Data contoh - {self.current_title}'
  return self.text(caption,x,y-ih-9,iw,'cap',gap=12)
 def table(self,rows,x,y,w):
  data=[[pobj(v,'cellh' if i==0 else 'cell') for v in row] for i,row in enumerate(rows)]
  t=Table(data,colWidths=[w*.29,w*.71]);t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),YELLOW),('VALIGN',(0,0),(-1,-1),'TOP'),('ROWBACKGROUNDS',(0,1),(-1,-1),[PALE,colors.white]),('LEFTPADDING',(0,0),(-1,-1),10),('RIGHTPADDING',(0,0),(-1,-1),10),('TOPPADDING',(0,0),(-1,-1),9),('BOTTOMPADDING',(0,0),(-1,-1),9)]))
  _,hh=t.wrap(w,H)
  if y-hh<BOTTOM:raise ValueError(f'{self.key} table overflow page {self.c.getPageNumber()}')
  t.drawOn(self.c,x,y-hh);return y-hh-15
 def page(self,num,p):
  self.current_title=p['title'];self.header(p['chapter'],p['title']);self.c.bookmarkPage(f'p{num}');self.c.addOutlineEntry(p['title'],f'p{num}',1,False)
  y=H-125
  if p['intro']:y=self.text(p['intro'],M,y,CW,'body',gap=13)
  if p['table']:y=self.table(p['table'],M,y,CW)
  if p['shot'] and p['mobile']:
   sw=190;self.shot(p['shot'],M,y-8,sw,min(450,y-BOTTOM-55));self.body(p,M+sw+23,y,CW-sw-23)
  elif p['shot']:
   bodyh=self.body_height(p,CW);available=y-BOTTOM-bodyh-46
   if available<155:raise ValueError(f'{self.key} page {num}: not enough room for screenshot {available}')
   y=self.shot(p['shot'],M,y-3,CW,min(430,available));self.body(p,M,y,CW)
  else:self.body(p,M,y,CW)
  self.c.showPage()
 def build(self):
  self.cover();self.contents()
  for num,p in enumerate(self.book['pages'],3):self.page(num,p)
  self.c.save()
  md=[f'# Manual Pengguna RefPahang - {self.book["title"]}','',self.book['subtitle'],'','Edisi 20 Oktober 2026. Screenshot antaramuka sebenar dengan data contoh.','']
  for num,p in enumerate(self.book['pages'],3):
   md += [f'## {p["chapter"]}: {p["title"]}',f'Halaman PDF {num}','',p['intro'],'']
   if p['shot']:md += [f'![{p["title"]}](screenshots/{p["shot"]}.png)','']
   if p['table']:md += ['| '+' | '.join(p['table'][0])+' |','|---|---|']+['| '+' | '.join(r)+' |' for r in p['table'][1:]]+['']
   md += [f'{i}. {s}' for i,s in enumerate(p['steps'],1)]+['']
   if p['note']:md += ['> '+p['note'],'']
  (ROOT/f'docs/manual-peranan/Manual_{self.key}.md').write_text('\n'.join(md))
  return dict(role=self.key,pdf=str(self.path.relative_to(ROOT)),pages=self.total,figures=len(self.figures),size_mb=round(self.path.stat().st_size/1e6,2),sha256=hashlib.sha256(self.path.read_bytes()).hexdigest(),figures_index=self.figures,bounds=self.bounds)
if __name__=='__main__':
 report=[Manual(key,book).build() for key,book in BOOKS.items() if len(sys.argv)==1 or key in sys.argv[1:]]
 (OUT/'build-manifest.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
 for row in report:print(json.dumps({k:v for k,v in row.items() if k not in ['figures_index','bounds']},ensure_ascii=False))
