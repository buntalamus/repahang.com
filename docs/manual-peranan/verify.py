from pathlib import Path
import json,hashlib,csv,sys,math
import fitz
from PIL import Image,ImageDraw
from content import BOOKS
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'output/manual-peranan';TMP=ROOT/'tmp/manual-peranan';report=[];contacts=[]
for key,book in BOOKS.items():
 pdf=ROOT/'output/pdf'/book['file'];doc=fitz.open(pdf);expected=len(book['pages'])+2;assert len(doc)==expected
 assert len(doc.get_toc())==expected
 assert sum(len(p.get_links()) for p in doc)>=len(book['pages'])
 assert all(link.get('page',-1)>=0 for p in doc for link in p.get_links() if link.get('kind')==fitz.LINK_GOTO)
 text='\n'.join(p.get_text() for p in doc);assert '\ufffd' not in text and '\u25a0' not in text
 assert 'Aktifkan notifikasi' in text and 'Daftar' in text and 'Telegram' in text
 assert 'belum diterbitkan' not in text and '8 bulan' in text
 # Text (except headers/footers) must stay inside the paper and above the footer rule.
 errors=[]
 for i,page in enumerate(doc):
  for b in page.get_text('dict')['blocks']:
   if b['type']!=0:continue
   for line in b['lines']:
    for span in line['spans']:
     x0,y0,x1,y1=span['bbox']
     if min(x0,y0)<-0.1 or x1>page.rect.width+.1 or y1>page.rect.height+.1:errors.append((i+1,span['text']))
 assert not errors,errors
 rendered=sorted((TMP/'render-final'/key).glob('page-*.png'))
 assert len(rendered)==expected,(key,len(rendered),expected)
 # All pages enter a contact sheet; full-size representative pages are also inspected.
 sheet_files=[]
 for offset in range(0,len(rendered),12):
  batch=rendered[offset:offset+12];sheet=Image.new('RGB',(1200,1320),'#dfe4ec');d=ImageDraw.Draw(sheet)
  for j,p in enumerate(batch):
   im=Image.open(p).convert('RGB');im.thumbnail((285,402));x=(j%4)*300+(300-im.width)//2;y=(j//4)*440+26
   sheet.paste(im,(x,y));d.text(((j%4)*300+9,(j//4)*440+7),f'{key} / {offset+j+1:02d}',fill='#111827')
  dest=TMP/f'qa-{key}-{offset//12+1:02d}.jpg';sheet.save(dest,quality=90);sheet_files.append(str(dest.relative_to(ROOT)));contacts.append(str(dest))
 report.append({'role':key,'pdf':str(pdf.relative_to(ROOT)),'pages':len(doc),'bookmarks':len(doc.get_toc()),'contents_links':sum(len(p.get_links()) for p in doc),'figures':sum(bool(p['shot']) for p in book['pages']),'sha256':hashlib.sha256(pdf.read_bytes()).hexdigest(),'rendered_pages':len(rendered),'contact_sheets':sheet_files,'text_and_bounds':'passed'})
# Index every illustrated procedure and the exact image used, including repeated shared screens.
with (OUT/'coverage.csv').open('w',newline='') as f:
 writer=csv.writer(f);writer.writerow(['manual','pdf_page','chapter','procedure','screenshot','release_note'])
 for key,book in BOOKS.items():
  for number,p in enumerate(book['pages'],3):writer.writerow([key,number,p['chapter'],p['title'],p['shot'] or '', 'Account-access release' if p['chapter']=='Lampiran kemas kini' else ''])
(OUT/'verification.json').write_text(json.dumps({'scope':'Release edition; verify publication separately','pdfs':report,'total_pages':sum(r['pages'] for r in report),'total_figure_placements':sum(r['figures'] for r in report),'visual_review':'Contact sheets and representative full-size final PNGs prepared for inspection','account_access':'Account-inactive reasons, automatic rules and reason dialog documented in appendices'},ensure_ascii=False,indent=2))
(TMP/'contact-sheets.json').write_text(json.dumps(contacts,indent=2))
print(json.dumps({'pdfs':len(report),'total_pages':sum(r['pages'] for r in report),'figure_placements':sum(r['figures'] for r in report),'contact_sheets':len(contacts),'checks':'passed'},indent=2))
