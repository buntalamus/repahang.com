#!/usr/bin/env python3
"""Build the fixed-page illustrated RefPahang user manual. Run from any cwd."""
from pathlib import Path
from xml.sax.saxutils import escape
import sys,json,re,hashlib
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph,Table,TableStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader
from reportlab.graphics.barcode import qr
from reportlab.graphics.shapes import Drawing
from reportlab.graphics import renderPDF
from PIL import Image
from content import PAGES
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'output/manual-mobile'; OUT.mkdir(parents=True,exist_ok=True)
SHOTS=OUT/'screenshots'
PDF=ROOT/'output/pdf/Manual_Lengkap_Aplikasi_Mobile_RefPahang.pdf'
PDF.parent.mkdir(parents=True,exist_ok=True)
for n,w in [('Inter',400),('Inter-Bold',700)]:
 pdfmetrics.registerFont(TTFont(n,str(ROOT/f'mobile/assets/fonts/Inter-{w}.ttf')))
pdfmetrics.registerFontFamily('Inter',normal='Inter',bold='Inter-Bold',italic='Inter',boldItalic='Inter-Bold')
W,H=A4; M=42; CW=W-2*M
INK=colors.HexColor('#111827'); MUTED=colors.HexColor('#536174'); YELLOW=colors.HexColor('#FADA00'); PALE=colors.HexColor('#F3F5F8')
styles={
'p':ParagraphStyle('p',fontName='Inter',fontSize=10.1,leading=14.6,textColor=INK,spaceAfter=9),
's':ParagraphStyle('s',fontName='Inter',fontSize=10.1,leading=14.6,textColor=INK,spaceAfter=10),
'h':ParagraphStyle('h',fontName='Inter-Bold',fontSize=12.3,leading=17,textColor=INK,spaceBefore=7,spaceAfter=7),
'n':ParagraphStyle('n',fontName='Inter',fontSize=9.2,leading=13.2,textColor=INK),
'cap':ParagraphStyle('cap',fontName='Inter',fontSize=8.1,leading=11.4,textColor=MUTED),
'toc':ParagraphStyle('toc',fontName='Inter',fontSize=8.2,leading=11.4,textColor=INK),
 'toch':ParagraphStyle('toch',fontName='Inter-Bold',fontSize=10.4,leading=14,textColor=INK,spaceAfter=5),
 'cell':ParagraphStyle('cell',fontName='Inter',fontSize=9.1,leading=13,textColor=INK),
'headcell':ParagraphStyle('headcell',fontName='Inter-Bold',fontSize=9.2,leading=13,textColor=INK),
}
c=canvas.Canvas(str(PDF),pagesize=A4,pageCompression=1)
c.setTitle('Manual Lengkap Aplikasi Mobile RefPahang')
c.setAuthor('RefPahang')
c.setSubject('Pemasangan penggunaan peranan kemas kini dan bantuan pengguna')
TOTAL=len(PAGES)+2
manifest=[]

def para(txt,x,y,w,sty='p'):
 obj=Paragraph(txt,styles[sty]); aw,ah=obj.wrap(w,H)
 if y-ah<58: raise ValueError(f'Text overflows on PDF page {c.getPageNumber()}: {txt[:90]} at {y-ah}')
 obj.drawOn(c,x,y-ah)
 return y-ah-(styles[sty].spaceAfter or 0)

def header(chapter,title,num):
 c.setFillColor(MUTED);c.setFont('Inter-Bold',8.2);c.drawString(M,H-39,'REFPAHANG   /   '+chapter.upper())
 c.setFillColor(INK)
 font=22
 while pdfmetrics.stringWidth(title,'Inter-Bold',font)>CW and font>17:font-=.25
 c.setFont('Inter-Bold',font);c.drawString(M,H-82,title)
 c.setFont('Inter',8.5);c.setFillColor(MUTED);c.drawString(M,31,'Manual aplikasi mobile  |  Edisi 20 Oktober 2026')
 c.drawRightString(W-M,31,f'{num:02d} / {TOTAL:02d}')
 c.bookmarkPage(f'p{num}')
 c.addOutlineEntry(title,f'p{num}',level=1,closed=False)


def blocks(items,x,y,w,small=False):
 step=0
 for kind,txt in items:
  if kind=='s':
   step+=1
   # Number has its own column for clear left alignment.
   c.setFillColor(INK);c.setFont('Inter-Bold',10.1);c.drawString(x,y-11,f'{step:02d}')
   y=para(txt,x+25,y,w-25,'s')
  elif kind=='n':
   obj=Paragraph(txt,styles['n']);_,hh=obj.wrap(w-24,H)
   if y-hh-24<58:raise ValueError(f'Note overflows PDF page {c.getPageNumber()}')
   c.setFillColor(colors.HexColor('#FFFBE6'));c.roundRect(x,y-hh-18,w,hh+12,7,fill=1,stroke=0)
   y=para(txt,x+12,y-9,w-24,'n')-19
  elif kind=='table':
   # Column sizes tuned for content, otherwise equally divided.
   count=len(txt[0])
   widths=([w*.29,w*.71] if count==2 else [w*.23,w*.37,w*.40])
   data=[[Paragraph(escape(str(cell)),styles['headcell' if i==0 else 'cell']) for cell in row] for i,row in enumerate(txt)]
   t=Table(data,colWidths=widths,hAlign='LEFT')
   t.setStyle(TableStyle([
    ('BACKGROUND',(0,0),(-1,0),YELLOW),('VALIGN',(0,0),(-1,-1),'TOP'),
    ('LEFTPADDING',(0,0),(-1,-1),10),('RIGHTPADDING',(0,0),(-1,-1),10),
    ('TOPPADDING',(0,0),(-1,-1),8),('BOTTOMPADDING',(0,0),(-1,-1),8),
    ('ROWBACKGROUNDS',(0,1),(-1,-1),[PALE,colors.white]),
   ]));_,hh=t.wrap(w,H)
   if y-hh<58:raise ValueError(f'Table overflows PDF page {c.getPageNumber()}: height {hh}, start {y}')
   t.drawOn(c,x,y-hh);y-=hh+15
  elif kind=='panel':
   name,caption=txt
   pw=min(w,320)
   y=shot(name,x+(w-pw)/2,y-13,pw,caption)-5
  elif kind=='qr':
   url,label=txt
   q=qr.QrCodeWidget(url,barLevel='M');bounds=q.getBounds();sz=82
   drawing=Drawing(sz,sz,transform=[sz/(bounds[2]-bounds[0]),0,0,sz/(bounds[3]-bounds[1]),0,0]);drawing.add(q)
   renderPDF.draw(drawing,c,x,y-sz)
   para('<b>'+label+'</b><br/><link href="'+url+'" color="#2463A6">'+url+'</link>',x+100,y-17,w-100)
   y-=sz+16
  else:y=para(txt,x,y,w,kind)
 return y

fig=0

def shot(name,x,top,w,caption,live=False,maxh=505):
 global fig
 file=SHOTS/(name+'.png');img=Image.open(file);h=w*img.height/img.width
 if h>maxh:w=w*maxh/h;h=maxh
 c.setFillColor(colors.white);c.setStrokeColor(colors.HexColor('#D6DCE4'));c.setLineWidth(.7)
 c.roundRect(x-4,top-h-4,w+8,h+8,9,fill=1,stroke=1)
 c.drawImage(str(file),x,top-h,width=w,height=h,mask='auto')
 fig+=1
 para(f'<b>Rajah {fig:02d}</b>  {caption}',x,top-h-15,w,'cap')
 badge='PAPARAN LANGSUNG' if live else 'DATA CONTOH'
 c.setFont('Inter-Bold',7);c.setFillColor(MUTED);c.drawString(x,top+11,badge)
 manifest.append({'figure':fig,'file':str(file.relative_to(ROOT)),'page':c.getPageNumber(),'sha256':hashlib.sha256(file.read_bytes()).hexdigest()})
 return top-h-52

# Cover
c.setFillColor(colors.HexColor('#101114'));c.rect(0,0,W,H,fill=1,stroke=0)
logo=ROOT/'mobile/assets/images/logo-pahang.png';c.drawImage(str(logo),M,H-158,width=100,height=100,mask='auto')
c.setFillColor(YELLOW);c.setFont('Inter-Bold',12);c.drawString(M,H-203,'SISTEM PENGURUSAN PENGADIL PBNP')
c.setFillColor(colors.white);c.setFont('Inter-Bold',37);c.drawString(M,H-266,'Manual Lengkap')
c.drawString(M,H-314,'Aplikasi Mobile')
c.setFillColor(YELLOW);c.setFont('Inter-Bold',45);c.drawString(M,H-378,'RefPahang')
c.setFillColor(colors.HexColor('#D5D9DF'));c.setFont('Inter',13)
for i,line in enumerate(['Pemasangan dan kemas kini','Penggunaan mengikut peranan','Tugasan permohonan rekod dan laporan','Tangkapan skrin serta penyelesaian masalah']):c.drawString(M,H-432-i*25,line)
c.setFillColor(YELLOW);c.roundRect(M,131,511,45,9,fill=1,stroke=0)
c.setFillColor(INK);c.setFont('Inter-Bold',10);c.drawString(M+15,149,'PENGADIL   /   PENILAI   /   PP DAERAH   /   ADMIN')
c.setFillColor(colors.HexColor('#D5D9DF'));c.setFont('Inter',10);c.drawString(M,95,'Edisi 20 Oktober 2026  |  Rujukan aplikasi 1.3.0')
c.setFont('Inter',9);c.drawString(M,73,'https://refpahang.com   •   sokongan@pbnppahang.my')
c.bookmarkPage('cover');c.addOutlineEntry('Manual Lengkap Aplikasi Mobile RefPahang','cover',0,False)
c.showPage()

# Contents: group by chapter into two balanced columns.
header('Navigasi manual','Kandungan manual',2)
groups=[]
for idx,v in enumerate(PAGES,3):
 if not groups or groups[-1][0]!=v['chapter']:groups.append((v['chapter'],[]))
 groups[-1][1].append((idx,v['title']))
for col,gg in enumerate([groups[:9],groups[9:]]):
 x=M+col*(CW/2+8);ww=CW/2-13;y=H-122
 for chapter,entries in gg:
  y=para(chapter,x,y,ww,'toch')
  for no,title in entries:
   obj=Paragraph(f'<link href="#p{no}" color="#111827">{escape(title)}</link>',styles['toc']);_,hh=obj.wrap(ww-23,H)
   obj.drawOn(c,x,y-hh)
   c.setFillColor(INK);c.setFont('Inter-Bold',8);c.drawRightString(x+ww,y-9,str(no))
   y-=hh+4
  y-=6
 if y<70:raise ValueError(f'Contents too long col {col}: {y}')
c.showPage()

for no,v in enumerate(PAGES,3):
 header(v['chapter'],v['title'],no)
 top=H-122
 if v['shot']:
  sw=218
  shot(v['shot'],M,top,sw,v.get('caption') or v['title'])
  blocks(v['blocks'],M+sw+23,top+2,CW-sw-23)
 elif v['shots']:
  # Short instructions above two large parallel screenshots.
  y=blocks(v['blocks'],M,top,CW)
  sw=190
  cap=v.get('caption') or v['title']
  for i,name in enumerate(v['shots']):
   image=Image.open(SHOTS/(name+'.png'))
   available=y-125
   width=min(sw,available*image.width/image.height)
   x=M+(CW/2)*i+(CW/2-width)/2
   shot(name,x,y-15,width,cap.split('. ')[i] if '. ' in cap and len(cap.split('. '))==2 else ('Kiri' if i==0 else 'Kanan'),maxh=available)
 else:blocks(v['blocks'],M,top,CW)
 c.showPage()
c.save()
(OUT/'screenshot-index.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
# Editable Markdown source for non-Python readers.
md=['# Manual Lengkap Aplikasi Mobile RefPahang','', 'Edisi 20 Oktober 2026. Rujukan aplikasi 1.3.0.','']
for no,v in enumerate(PAGES,3):
 md.extend([f"## {v['chapter']} - {v['title']}",f'Halaman PDF {no}',''])
 step=0
 for k,t in v['blocks']:
  if k=='table':
   md+=['| '+' | '.join(t[0])+' |','| '+' | '.join(['---']*len(t[0]))+' |']+['| '+' | '.join(row)+' |' for row in t[1:]]
  elif k=='panel':md += [f'![{t[1]}](../../output/manual-mobile/screenshots/{t[0]}.png)']
  elif k=='qr':md += [t[0]]
  else:
   if k=='s':step+=1;t=f'{step}. '+t
   elif k=='h':t='### '+t
   elif k=='n':t='> '+t
   md += [re.sub(r'<[^>]+>','',t)]
  md+=['']
 for name in ([v['shot']] if v['shot'] else v['shots'] or []):md += [f'![Paparan contoh {v["title"]}](../../output/manual-mobile/screenshots/{name}.png)','']
(ROOT/'docs/manual-mobile/Manual_Aplikasi_Mobile_RefPahang.md').write_text('\n'.join(md))
print(json.dumps({'pdf':str(PDF),'pages':TOTAL,'figures':fig,'size_mb':round(PDF.stat().st_size/1e6,2)}))
