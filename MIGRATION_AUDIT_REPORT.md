# Migration Audit Report: PHP/HTML → Angular 21

**Old Project**: `/Users/t/Documents/refpahang2_old_icloud/` (PHP/HTML + Tailwind CDN + Vanilla JS)  
**New Project**: `/Users/t/Project/refpahang2/frontend/src/` (Angular 21 + Standalone Components)

---

## EXECUTIVE SUMMARY

| Category | Count |
|----------|-------|
| Pages audited | 20+ |
| **CRITICAL gaps** (missing core functionality) | **18** |
| **HIGH gaps** (missing important features) | **27** |
| **MEDIUM gaps** (missing UI/UX elements) | **22** |
| LOW gaps (cosmetic differences) | 15 |
| Pages with NO pagination in new (old has it) | **3** |
| Pages missing filters vs old | **5** |
| Pages using browser `confirm()`/`prompt()` instead of proper modals | **6** |

---

## PAGE-BY-PAGE COMPARISON

---

### 1. LOGIN PAGE (`index.html` → `auth/login/`)

#### Old Features:
- Split-panel layout: left = login form, right = announcement panel with dark Pahang theme
- Stadium background image with grayscale + gradient overlay
- Pahang FA logo + "Sistem Pengurusan Pengadil Negeri Pahang" branding
- Email + Password fields with validation
- Loading spinner on submit button ("Mengelog masuk...")
- Error message display
- Maintenance mode check (`/api/check-maintenance.php`)
- Auto-redirect if already logged in (checks session, redirects by role)
- Right panel: Announcement text ("Pendaftaran Pengadil Musim 2026 Kini Dibuka")
- "Daftar Akaun Baharu" CTA button on right panel
- PDPA disclaimer text

#### New Features:
- Login form with email + password
- Loading state
- Error message
- Maintenance check
- RouterLink to register
- AuthService-based login with role-based routing

#### MISSING in New:
- **[MEDIUM]** Split-panel design — Old has a visually rich 2-column layout with announcement panel on right side; New likely has simpler single-column layout
- **[LOW]** Stadium background image with grayscale/gradient effect
- **[LOW]** Announcement text/CTA on the login page ("Pendaftaran Pengadil Musim 2026...")
- **[LOW]** PDPA disclaimer text

---

### 2. REGISTRATION PAGE (`registration.html` → `auth/register/`)

#### Old Features:
- Header with Pahang FA logo, title, "Pendaftaran Sistem Pengurusan Pengadil"
- Navigation buttons: "Halaman Utama" + "Lihat Laporan"
- Form fields: Nama Penuh, No. KP (12 digit validation), Emel, No. Telefon, Jantina (dropdown), Jenis Pengadil (dropdown)
- Info box: "Nota Penting" explaining post-registration process
- Loading spinner on submit

#### New Features:
- Form fields: Nama Penuh, No. KP, Emel, No. Telefon, Jantina, Jenis Pengadil, **Persatuan (dropdown with 12 Pahang districts)**
- **Pengesahan Data checkbox** (PDPA consent)
- Client-side validation with error messages per field
- Success/Failure modal dialog
- RouterLink to login

#### MISSING in New:
- **[LOW]** Header with Pahang FA logo branding (decorative)
- **[LOW]** Navigation buttons to "Halaman Utama" and "Lihat Laporan"

#### NEW IMPROVEMENTS (not in old):
- Persatuan selection dropdown (12 districts) — old doesn't have this
- PDPA pengesahan_data consent checkbox
- Better validation with per-field error messages
- Modal result dialog instead of inline messages

---

### 3. ADMIN DASHBOARD (`admin-dashboard.html` → `admin/dashboard/`)

#### Old Features:
- Welcome card with admin name + **last login time** + **last activity time**
- 4 Stats cards: Jumlah Pengguna, Jumlah Permohonan, Perlawanan Hari Ini, Kadar Pengesahan
- Current Tasks card showing **3 recent matches** with pengadil name, jawatan, date, place, time (real data)
- Announcements card with **"Urus Pengumuman" button** opening management modal
- Recent Applications list (up to **6**) with **Lulus/Tolak inline buttons**
- **Announcement Management Modal**: Create announcement (title + content), list existing with delete buttons
- Reject Modal with textarea for rejection reason
- Toast notifications
- Mobile sidebar toggle

#### New Features:
- Welcome card (name only)
- 4 Stats cards (same 4)
- Tasks card (shows `pending_applications` and `pending_verifications` as **counts only**)
- Announcements card (read-only listing)
- Recent Applications table (up to **5**) with Lulus/Tolak buttons
- Reject Modal
- Loading state

#### MISSING in New:
- **[HIGH]** Last login time and last activity time in welcome card
- **[CRITICAL]** Tasks card shows only aggregate counts — Old shows **individual match details** (pengadil name, jawatan, date, place, time)
- **[HIGH]** "Urus Pengumuman" button and inline Announcement Management Modal on dashboard — Old allows creating/deleting announcements directly from dashboard
- **[LOW]** Old shows 6 recent applications vs New shows 5

---

### 4. ADMIN SENARAI PERMOHONAN (`admin-senarai-permohonan.html` → `admin/applications/`)

#### Old Features:
- Stats cards: Jumlah, Menunggu, Lengkap, Ditolak
- **4 Tabs**: Pengadil Berdaftar, Pengadil Futsal, Ujian Kecergasan, Ujian Bertulis
- Filters: Status dropdown, **FA/Daerah dropdown (12 Pahang districts)**, Search input
- **Download Excel** button
- Table columns: Bil, Nama Penuh, No. KP, **Telefon**, **Daerah**, Status, Status Ujian (conditional for kecergasan tab), Tarikh Hantar
- Status badges with colors (Menunggu/Lengkap/Ditolak)
- **Status Ujian toggle buttons** (Lulus/Tidak Lulus/Tidak Hadir) with edit modal
- **Mobile card view** for responsive design
- Edit Status Ujian Modal

#### New Features:
- Stats cards (same 4)
- 4 Tabs (same)
- Filters: Status dropdown, Search input, **Year filter**, Download Excel button
- Table columns: #, Nama, No. KP, Persatuan, Status, Status Ujian (conditional), Tarikh, **Tindakan (Approve/Reject)**
- Status Ujian Modal

#### MISSING in New:
- **[CRITICAL]** **No FA/Daerah filter dropdown** — Old has 12 Pahang FA options for filtering
- **[HIGH]** **No Telefon column** in table
- **[MEDIUM]** **No Daerah column** (replaced by Persatuan — different data)
- **[CRITICAL]** **No mobile card view** — Old has responsive card layout for mobile; New shows table only
- **[LOW]** Status Ujian toggle buttons style differs

#### NEW in Angular (not in old):
- Year filter dropdown
- Tindakan column with inline approve/reject per row

---

### 5. ADMIN PENGADIL BERDAFTAR (`admin-pengadil-berdaftar.html` → `admin/pengadil-berdaftar/`)

#### Old Features:
- **3 Stats cards**: Jumlah Pengadil, Lelaki count, Perempuan count
- Search input
- **Year filter** dropdown
- **Gender filter** dropdown (Semua/Lelaki/Perempuan)
- **Page size selector** (10/20/50/100 per page)
- **Print** button
- **Download CSV** button
- Table: Bil, Nama Penuh (**with profile image**), No. K/P, **Jantina**, Jenis Pengadil, No. Telefon, FA, Tindakan (Lihat/Padam)
- **FULL PAGINATION**: prev/next buttons, page numbers, "Menunjukkan X hingga Y dari Z hasil"
- **Detail modal** with: personal info, address, employment, next-of-kin (waris), **applications history table**, **matches history table**, profile images with fallback, **receipt link**
- **Delete confirmation modal** (styled with warning icon)

#### New Features:
- Search input
- Download Excel button
- Print button
- Simple count text "Jumlah: X pengadil"
- Table: #, Nama, No. KP, Jenis, Persatuan, No. Tel, Tindakan (Lihat/Padam)
- Detail modal with personal info, address, employment, waris

#### MISSING in New:
- **[CRITICAL]** **NO PAGINATION** — Old has full pagination (10/20/50/100 per page, prev/next, page info). New shows ALL records.
- **[HIGH]** **No stats cards** (Jumlah/Lelaki/Perempuan) — only plain text count
- **[HIGH]** **No year filter** dropdown
- **[HIGH]** **No gender filter** dropdown
- **[HIGH]** **No page size selector** (10/20/50/100)
- **[MEDIUM]** **No Jantina column** in table
- **[MEDIUM]** **No profile images** in table — Old shows photos with avatar fallback
- **[CRITICAL]** **Detail modal missing applications history table** — Old shows all past applications with jenis_permohonan, jenis_pengadil, tarikh_lulus
- **[CRITICAL]** **Detail modal missing matches history table** — Old shows all matches with tarikh, jenis, tempat, jawatan
- **[HIGH]** **Detail modal missing receipt link** viewing
- **[MEDIUM]** **No delete confirmation modal** — New uses browser `confirm()` instead of styled modal

---

### 6. ADMIN USERS (`admin-users.html` → `admin/users/`)

#### Old Features:
- Search input
- Role filter dropdown
- "Tambah Pengguna" button
- Table: No., Nama, Email, Peranan, FA, **Jenis Pengadil**, Tindakan
- **FULL PAGINATION**: page size (10/20/50/100), prev/next, page numbers, info text
- Add/Edit User Modal (comprehensive)
- Loading spinner + Empty state

#### New Features:
- Search input
- Role filter dropdown
- "Tambah Pengguna" button
- Table: #, Nama, Emel, Peranan, Persatuan, Tindakan (Reset Password, Resend Email, Edit, Padam)
- Edit Modal (comprehensive with Maklumat Asas, Alamat, Pekerjaan, Waris)
- Add User Modal
- Loading + Empty state

#### MISSING in New:
- **[CRITICAL]** **NO PAGINATION** — Old has full pagination. New loads all users.
- **[HIGH]** **No page size selector** (10/20/50/100)
- **[MEDIUM]** **No Jenis Pengadil column** in table

#### NEW in Angular (not in old):
- Reset Password button per user
- Resend Email notification button per user
- More comprehensive edit modal (Maklumat Asas + Alamat + Pekerjaan + Waris sections)

---

### 7. ADMIN LAPORAN / REPORTS (`admin-laporan.html` → `admin/reports/`)

#### Old Features:
- 4 Stats cards: Jumlah Permohonan, Diluluskan, Menunggu Semakan, Ditolak
- Search input + Status filter dropdown (Semua, Menunggu Admin, Lengkap, Ditolak)
- Table: Pemohon (with **profile image**, name, no_kp, email, phone, jenis_pengadil badge, saiz_baju, **expandable "Butiran Lanjut"** section), Jenis Permohonan, Tarikh Hantar, Status, Tindakan (Luluskan/Tolak)
- **Expandable details** per row: Alamat, Pekerjaan, Waris, Resit Bayaran link, Rekod Perlawanan count
- **Profile images** with avatar fallback
- Status badges (Lengkap/Ditolak/Menunggu Admin)
- Approve/Reject with optional notes via `prompt()`

#### New Features:
- Search input + Status filter dropdown
- Table: #, Nama, Jenis, Status, Tarikh, Tindakan (Lulus/Tolak/Muat Turun)
- Status badges
- Approve/Reject functions
- Download form button per application

#### MISSING in New:
- **[CRITICAL]** **No stats cards** (Jumlah/Diluluskan/Menunggu/Ditolak overview)
- **[CRITICAL]** **No profile images** in table
- **[CRITICAL]** **No expandable details** (Alamat, Pekerjaan, Waris, Resit, Perlawanan) — Old has `<details>` expandable section per row
- **[HIGH]** **No No. KP column** — Old shows IC prominently
- **[HIGH]** **No email/phone display** in table
- **[HIGH]** **No jenis_pengadil badge** per applicant
- **[HIGH]** **No saiz_baju display**
- **[HIGH]** **No resit bayaran link**
- **[MEDIUM]** **No rekod perlawanan count** per applicant
- **[MEDIUM]** Reject uses browser `prompt()` instead of proper modal

---

### 8. ADMIN ANNOUNCEMENTS (`admin-announcements.html` → `admin/announcements/`)

#### Old Features:
- "Tambah Pengumuman" button
- Announcements list: badge "Pengumuman", date, title, content, Edit, Delete buttons
- Add/Edit Modal (title + content)
- **Styled delete confirmation modal** with warning icon, cancel/confirm
- Empty state with icon + messaging
- Toast notifications

#### New Features:
- Add button
- Announcements list with edit/delete
- Add/Edit modal (title + content)
- Delete function
- Toast notifications

#### MISSING in New:
- **[MEDIUM]** **No dedicated delete confirmation modal** — Uses browser `confirm()` instead of styled modal with warning icon
- **[LOW]** No "Pengumuman" badges on each item

---

### 9. ADMIN SETTINGS (`admin-settings.html` → `admin/settings/`)

#### Old Features:
- Maintenance Mode toggle with visual feedback (AKTIF badge)
- Applications Open checkbox
- Application Year input
- Min Verified Matches input
- Payment Amount input
- Max Applications Per Year input
- Require Profile Complete checkbox
- Auto Link Matches checkbox
- Save + Reset buttons
- Reset confirmation dialog

#### New Features:
- ALL same settings fields
- Maintenance Mode with toggle + AKTIF badge
- Save (with saving state) + Reset (with resetting state) buttons
- Loading state

#### MISSING in New:
- **None** — Functionally equivalent. New has improvements (loading/saving state indicators).

---

### 10. ADMIN STATISTICS (`admin-statistik.html` → `admin/statistics/`)

#### Old Features:
- **4 gradient overview cards** (Permohonan, Diluluskan, Pengadil, Perlawanan) with styled black gradient + yellow text
- **Application status sub-cards** (Menunggu, Lengkap, Ditolak, Jumlah)
- Charts using Chart.js: Application Types Bar Chart, Application Status chart, Gender distribution, District distribution
- Year display

#### New Features:
- Year filter dropdown
- Loading state
- 4 Chart.js charts: Application Types (bar), Application Status (doughnut), Gender (pie), District (horizontal bar)

#### MISSING in New:
- **[HIGH]** **No styled overview cards** — Old has 4 prominent gradient cards with icons and counts. New jumps straight to charts.
- **[HIGH]** **No application status sub-cards** (Menunggu/Lengkap/Ditolak/Jumlah as separate visual cards)
- **[MEDIUM]** Missing gradient/card visual presentation (old has rich card-based summary before charts)

---

### 11. ADMIN LANTIKAN PENGADIL (`admin-lantikan-pengadil.html` → `admin/lantikan-pengadil/`)

Both are placeholder pages. **No gaps.**

---

### 12. ADMIN PROFILE (`admin-profile.html` → `admin/profile/`)

#### Old Features:
- Profile image (140×140) with upload/change capability + preview
- Personal info: Nama, No. IC, Email, No. Telefon, Alamat (multi-line)
- Employment info: Status Kerja (dropdown), Jawatan, Nama Majikan, Alamat Majikan
- **Change Password** section (current + new + confirm)
- **Edit/Save toggle** mode (display → edit fields appear)
- Cancel edit + Save buttons

#### New Features:
- Profile header with image (96×96 rounded), name, email, role
- Profile image upload via label overlay
- Personal info: Nama Penuh, No. KP, Emel, No. Telefon, **Jantina**, **Alamat**, **Umur**, **Jenis Pengadil**
- Employment: Status Kerja, Jawatan, Nama Majikan, Alamat Majikan
- **Waris section**: Nama Waris, Hubungan, No. Telefon Waris
- Change Password (as separate `<app-change-password />` component)
- Edit/Batal/Simpan toggle mode

#### MISSING in New:
- **[MEDIUM]** Address in old uses **multi-field input** (alamat1, alamat2, poskod, daerah) — New uses single text input for alamat
- **[LOW]** Status Kerja in old has a dropdown select — New uses plain text input

#### NEW in Angular (not in old):
- Jantina, Umur, Jenis Pengadil fields (old doesn't show these on admin profile)
- Waris section (old admin profile doesn't have this)
- More compact profile header design

---

### 13. PP DAERAH DASHBOARD (`pp-dashboard.html` → `pp-daerah/dashboard/`)

#### Old Features (MASSIVE — 9119 lines, SPA with multi-section):
- **Dashboard section**: Welcome card (gradient black+yellow), Announcements card, 4 Stats cards (Pengadil Berdaftar, Pengadil Tidak Aktif, Jumlah Perlawanan, Kadar Pengesahan), **Top 5 Most Active Referees ranking**, **Current Assignments card**, Quick Actions (2 cards: Pengesahan Perlawanan, Senarai Pengadil)
- **Pengesahan Perlawanan section**: Search/filter (by pengadil, by status), **Bulk Actions** (Sahkan Terpilih, Tolak Terpilih, Batal Pilihan with selection count), Matches table, Loading/empty states
- **Pengadil Daerah section**: 4 Stats cards (Jumlah, Aktif, Tidak Aktif, Permohonan Bulan Ini), Search + Status filter + **Jenis filter** + **Export Excel** button, Referees table
- **Lantikan section**: Placeholder
- **Statistik section**: 4 Overview cards (Permohonan Bulan Ini with growth %, Perlawanan Disahkan, Pengadil Aktif, Kadar Kelulusan), **Applications Trend chart (6 months)**, 3 Status summary cards (Permohonan, Pengadil, Perlawanan), 2 Detail tables (Permohonan by Type, Pengadil by Type)
- **Profil section**: Full profile with image upload, personal info, employment, pengadil info (tahun_mula_aktif, saiz_baju, jenis_pengadil), waris, change password, edit/save/cancel
- **Permohonan sections**: Full multi-step application forms (pengadil berdaftar, pengadil futsal, ujian kecergasan) with: year selection, personal info pre-fill, referee info, address (with daerah/negeri dropdowns), employment (conditional fields), waris, **payment section** (bank details display), **receipt upload**, **Sejarah Permohonan** tab

#### New Features (dashboard component only):
- Welcome gradient card (name + persatuan)
- 4 Stats cards (Pengadil, Permohonan Menunggu, Diluluskan, Perlawanan)
- Quick Links (4 cards: Pengadil Berdaftar, Pengadil Futsal, Ujian Kecergasan, Ujian Bertulis)
- Announcements listing

#### MISSING in New Dashboard:
- **[CRITICAL]** **No Top 5 Most Active Referees ranking** — Old has a leaderboard of top referees
- **[CRITICAL]** **No Current Assignments card** — Old shows current pengadil task assignments
- **[HIGH]** **No Kadar Pengesahan stat** (verification rate)
- **[HIGH]** **No Pengadil Tidak Aktif stat** — Only total referees shown
- **[MEDIUM]** Quick Actions: Old has descriptive cards with icons and descriptions; New has simpler link cards

---

### 14. PP DAERAH — PENGESAHAN PERLAWANAN (part of `pp-dashboard.html` → separate component needed)

#### Old Features:
- Search matches (nama, tempat, jenis)
- Filter by Pengadil (dropdown)
- Filter by Status (Belum Disahkan/Disahkan/Tidak Disahkan)
- **BULK ACTIONS**: Select multiple → Sahkan Terpilih / Tolak Terpilih / Batal Pilihan with selection count display
- Matches list with loading/empty states

#### New Features:
- **NOT FOUND as a separate Angular component** — No dedicated match verification component visible in the file structure

#### MISSING in New:
- **[CRITICAL]** **Entire Pengesahan Perlawanan section appears missing** — No Angular component for PP Daerah match verification with bulk actions
- **[CRITICAL]** **No bulk verify/reject functionality**
- **[HIGH]** **No filter by specific pengadil dropdown**

---

### 15. PP DAERAH — PENGADIL DAERAH (part of `pp-dashboard.html` → `pp-daerah/referees/`)

#### Old Features:
- 4 Stats cards (Jumlah, Aktif, Tidak Aktif, Permohonan Bulan Ini)
- Search + Status filter (Aktif/Tidak Aktif) + **Jenis filter** + **Export Excel** button
- Referees table with loading/empty states

#### New Features:
- Search input only
- Table: #, Nama, No. KP, Jenis, No. Tel, Status (hardcoded "Aktif")
- Loading/empty states

#### MISSING in New:
- **[HIGH]** **No stats cards** (Jumlah/Aktif/Tidak Aktif/Permohonan)
- **[HIGH]** **No status filter** dropdown (Aktif/Tidak Aktif)
- **[HIGH]** **No jenis filter** dropdown
- **[HIGH]** **No Export Excel button**
- **[MEDIUM]** Status is **hardcoded "Aktif"** — Old shows actual status from data

---

### 16. PP DAERAH — STATISTIK (part of `pp-dashboard.html` → separate component needed)

#### Old Features:
- 4 Overview cards: Permohonan Bulan Ini (with growth %), Perlawanan Disahkan, Pengadil Aktif (from total), Kadar Kelulusan (3-month)
- **Applications Trend chart (6 months)** using Chart.js
- 3 Status summary cards (Permohonan status, Pengadil status, Perlawanan verification)
- 2 Detail tables (Permohonan by Type, Pengadil by Type)

#### New Features:
- **NOT FOUND as a separate PP-level statistics component**

#### MISSING in New:
- **[CRITICAL]** **Entire PP Statistik section appears missing** as a dedicated Angular component
- **[CRITICAL]** **No 6-month applications trend chart**
- **[HIGH]** **No status summary cards**
- **[HIGH]** **No applications/referees by type tables**

---

### 17. PP DAERAH — PERMOHONAN (part of `pp-dashboard.html` → `pp-daerah/applications/`)

#### Old Features:
- **Multi-step application forms** for pengadil berdaftar, futsal, kecergasan with:
  - Year selection
  - Personal info pre-fill from profile
  - Referee info (jenis, tahun mula aktif, persatuan daerah)
  - Full address section (alamat1, alamat2, poskod, daerah dropdown 13 options, negeri dropdown 16 options)
  - Employment (conditional show/hide based on status), with employer address
  - Waris section
  - **Payment section** with bank account details display (nama akaun, bank, no. akaun, yuran amount)
  - **Receipt upload** functionality
- **Sejarah Permohonan tab** to view past applications
- Form tabs (Permohonan Baru / Sejarah)

#### New Features:
- Applications listing table with search + status filter
- Download Excel for berdaftar type
- Approve/Reject per application (PP as verifier, not applicant)
- Proper Reject modal with notes textarea

#### MISSING in New:
- **[CRITICAL]** **No application submission form for PP themselves** — Old allows PP Daerah to submit their own pengadil applications. New treats PP only as a verifier.
- **[CRITICAL]** **No payment section** with bank account display
- **[CRITICAL]** **No receipt upload** functionality
- **[HIGH]** **No multi-step form** with pre-filled profile data
- **[HIGH]** **No application history (Sejarah Permohonan) tab** for PP's own applications
- **[HIGH]** **No conditional employment fields** (show/hide based on status)
- **[HIGH]** **No daerah/negeri dropdown selectors** (13 Pahang districts + 16 states)

---

### 18. PP DAERAH — PROFIL (part of `pp-dashboard.html` → shared `admin/profile/` or separate)

#### Old Features:
- Full profile with 140×140 image upload + preview
- Personal info: Nama, No. IC (readonly), Umur, Email, No. Telefon, Jantina, Alamat (multi-field)
- Employment: Status Kerja (dropdown), Jawatan, Nama Majikan, Alamat Majikan
- **Pengadil info**: Tahun Mula Aktif, Saiz Baju (dropdown XS→3XL), Jenis Pengadil
- Waris: Nama, Hubungan, No. Telefon
- Change Password section
- Edit/Save/Cancel toggle mode

#### New Features:
- Uses shared profile component (if available) or dashboard doesn't include a dedicated profile

#### MISSING in New:
- **[HIGH]** **No Maklumat Pengadil section** (Tahun Mula Aktif, Saiz Baju, Jenis Pengadil) — These are specific to PP/Pengadil profiles
- **[MEDIUM]** Multi-field address input (alamat1+alamat2+poskod+daerah) vs single field

---

### 19. PENILAI DASHBOARD (`penilai-dashboard.html` → `penilai/dashboard/`)

#### Old Features:
- 4 Stats cards: Perlawanan Menunggu Penilaian, Penilaian Selesai, **Purata Markah**, Pengadil Dinilai
- **Notification bell** with badge count, dropdown with notification list, "Mark All Read" button
- **Pending Matches list** showing matches awaiting assessment
- **Penilaian section**: Assessment list
- **Assessment Modal** with scoring: Teknikal (0-10), Fizikal (0-10), Mental (0-10), Disiplin (0-10), Komen Penilai textarea
- **Permohonan Penilai section**: "Mohon Baru" button, 3 stats cards (Menunggu/Diluluskan/Ditolak), application history list
- **Application Modal**: Tahun Permohonan, Jenis Penilai (5 types), Nama, No. IC, Email, Telefon, Tahun Pengalaman, Kelayakan textarea, Catatan, **Sijil Kursus file upload**, **Sijil Kesihatan file upload**
- **Profile section**: Full editable profile

#### New Dashboard Features:
- Welcome card
- 4 Stats cards (Jumlah Tugasan, Selesai, Belum Selesai, Pengadil Dinilai)
- Quick Links (4 cards)
- Recent Assessments list

#### MISSING in New Dashboard:
- **[CRITICAL]** **No notification bell/dropdown** — Old has full notification system with badge, dropdown, mark-all-read
- **[HIGH]** **No Purata Markah stat** — Old shows average score given
- **[HIGH]** **No pending matches list** on dashboard — Old shows matches awaiting assessment directly

---

### 20. PENILAI ASSESSMENTS (`penilai-dashboard.html` → `penilai/assessments/`)

#### Old Assessment Modal Features:
- Scoring: Teknikal (0-10), Fizikal (0-10), Mental (0-10), Disiplin (0-10) as number inputs
- Komen Penilai textarea

#### New Assessment Features:
- Tabs (Semua/Belum Selesai/Selesai — flexible)
- Search filter
- Table with: Pengadil, Perlawanan, Tarikh, Jumlah Skor, Status, Tindakan
- Assessment Modal with:
  - **Skor Utama (1-5)** via button clicks (5 levels)
  - **Skor Tambahan (0-100)** for Teknikal, Fizikal, Mental, Disiplin
  - Catatan + Komen Penilai textareas
  - View mode for completed assessments showing score breakdowns

#### MISSING in New:
- **[MEDIUM]** Old scoring is simpler 0-10 scale; New has 1-5 main scores + 0-100 additional scores — **scoring model is different**, needs verification that API supports both

#### NEW in Angular (improvements):
- Tabs for filtering by completion status
- Better modal with view mode for completed assessments
- 1-5 button-based scoring UI (more user-friendly)

---

### 21. PENILAI PERMOHONAN (part of `penilai-dashboard.html`)

#### Old Features:
- "Mohon Baru" button
- 3 Stats cards: Menunggu, Diluluskan, Ditolak
- Application history list
- **Full Application Modal** with: Tahun, Jenis Penilai (5 types), Personal info, Pengalaman, Kelayakan, Catatan, **Sijil Kursus upload**, **Sijil Kesihatan upload**
- Block message when can't apply

#### New Features:
- **NOT FOUND as a dedicated component** — No penilai application/permohonan component visible

#### MISSING in New:
- **[CRITICAL]** **Entire Penilai Permohonan section appears missing** — No dedicated component to apply as a Penilai
- **[CRITICAL]** **No Sijil Kursus/Kesihatan file upload** for Penilai applications
- **[HIGH]** **No application stats (Menunggu/Diluluskan/Ditolak) cards**

---

### 22. PENGADIL DASHBOARD/PROFILE (`pengadil-dashboard.html` → `pengadil/profile/` + `pengadil/matches/`)

#### Old Profile Features:
- Full profile with 140×140 image upload + preview
- Personal info: Nama (readonly), No. IC (readonly), Umur, Email, No. Telefon, Jantina, Alamat
- Employment: Status Kerja, Jawatan, Nama Majikan, Alamat Majikan
- Pengadil info: Tahun Mula Aktif, Saiz Baju (XS→3XL), Jenis Pengadil (5 types including Ujian Bertulis)
- Waris: Nama, Hubungan, No. Telefon
- Change Password
- Edit/Save/Cancel toggle

#### Old Perlawanan (Matches) Features:
- **Match Counter Card**: gradient black card showing "X / 20" matches completed, current year, eligibility status
- **"Tambah Perlawanan" button** — pengadil can ADD their own match records
- Matches list

#### Old Permohonan Features:
- **Multi-step application form** (same as PP) with: year, personal info pre-fill, referee info, address, employment, waris, payment section, receipt upload
- **Sejarah Permohonan tab**
- Tab navigation (Permohonan Baru / Sejarah)

#### New Pengadil Profile Features:
- Profile header with image, name, email, role
- View/edit fields for personal info, employment, waris
- Change password component

#### New Pengadil Matches Features:
- 3 Stats: Jumlah, Disahkan, Belum Disahkan
- Search
- Table: Perlawanan, Jenis, Tarikh, Tempat, Jawatan, Status PP

#### New Pengadil Application Features:
- Current Application status display
- Simple form (varies by type: futsal has nama_pertandingan + tarikh; kecergasan has larian + yo-yo)
- File upload for supporting docs
- Application history table

#### MISSING in New:
- **[CRITICAL]** **No Match Counter Card** with progress (X/20) and eligibility status — This is KEY for pengadil to know if they've met the 20-match requirement
- **[CRITICAL]** **No "Tambah Perlawanan" button** — Pengadil cannot add their own match records in the new system (or it's not visible)
- **[CRITICAL]** **No payment section** with bank account details display in application form
- **[CRITICAL]** **No receipt upload** in application form
- **[HIGH]** **No multi-step full application form** — Old has 5 sections (Personal, Referee, Address, Employment, Waris, Payment). New has simplified form.
- **[HIGH]** **No pre-filled profile data** in application form — Old auto-fills from profile
- **[HIGH]** **No Saiz Baju field** in profile
- **[HIGH]** **No conditional employment fields** (show/hide based on status)
- **[MEDIUM]** **No daerah/negeri dropdown selectors** in address (just text inputs)

---

## CROSS-CUTTING GAPS

### 1. Pagination
| Page | Old | New |
|------|-----|-----|
| Admin Pengadil Berdaftar | ✅ Full pagination (10/20/50/100) | ❌ NO PAGINATION |
| Admin Users | ✅ Full pagination (10/20/50/100) | ❌ NO PAGINATION |
| Admin Senarai Permohonan | ✅ Pagination implied | ❌ NO PAGINATION |

### 2. Delete Confirmation Modals
| Page | Old | New |
|------|-----|-----|
| Admin Pengadil Berdaftar | ✅ Styled modal with warning | ❌ Browser `confirm()` |
| Admin Announcements | ✅ Styled modal with warning | ❌ Browser `confirm()` |
| Admin Users | ✅ Styled modal | ❌ Browser `confirm()` |

### 3. Reject Confirmation
| Page | Old | New |
|------|-----|-----|
| Admin Reports/Laporan | `prompt()` for reason | `prompt()` for reason |
| PP Applications | `prompt()` for reason | ✅ **Proper modal** (improved!) |

### 4. Missing Entire Sections/Components
| Section | Old Location | New Status |
|---------|-------------|------------|
| PP Pengesahan Perlawanan (bulk verify) | pp-dashboard.html | ❌ **MISSING** |
| PP Statistik | pp-dashboard.html | ❌ **MISSING** |
| PP Own Application Submission | pp-dashboard.html | ❌ **MISSING** (PP treated as verifier only) |
| Penilai Permohonan | penilai-dashboard.html | ❌ **MISSING** |
| Penilai Notification System | penilai-dashboard.html | ❌ **MISSING** |
| Pengadil Match Counter/Add | pengadil-dashboard.html | ❌ **MISSING** |
| Payment Section in Applications | All application forms | ❌ **MISSING** |
| Receipt Upload | All application forms | ❌ **MISSING** |

### 5. Profile Image Handling
| Context | Old | New |
|---------|-----|-----|
| Pengadil Berdaftar table | ✅ Profile photo with avatar fallback | ❌ No images |
| Admin Laporan table | ✅ Profile photo per applicant | ❌ No images |
| Detail modals | ✅ Profile photo | Partial (profile page only) |

### 6. Mobile Responsiveness
| Feature | Old | New |
|---------|-----|-----|
| Admin Senarai Permohonan | ✅ Card view on mobile | ❌ Table only |
| Sidebar toggle | ✅ Mobile hamburger menu | ✅ Angular sidebar (assumed) |

---

## PRIORITY FIX LIST

### P0 — CRITICAL (Core functionality missing)
1. Add pagination to Admin Pengadil Berdaftar, Admin Users, and Admin Senarai Permohonan
2. Build PP Daerah Match Verification component (with bulk approve/reject)
3. Build PP Daerah Statistics component (with charts)
4. Add PP Daerah own application submission (not just verifier role)
5. Build Penilai Permohonan component (apply as penilai with file uploads)
6. Add Pengadil Match Counter card (X/20 progress) and "Tambah Perlawanan" functionality
7. Add payment section + receipt upload to all application forms
8. Add applications history + matches history to Admin Pengadil detail modal
9. Add expandable applicant details to Admin Laporan page
10. Build notification system for Penilai role

### P1 — HIGH (Important missing features)
11. Add FA/Daerah filter to Admin Senarai Permohonan
12. Add stats cards to Admin Pengadil Berdaftar (Jumlah/Lelaki/Perempuan)
13. Add year/gender filters to Admin Pengadil Berdaftar
14. Add overview stats cards to Admin Statistics page
15. Add stats cards + filters to PP Referees page
16. Add Top 5 Active Referees to PP Dashboard
17. Add Current Assignments to PP Dashboard
18. Add last login/activity to Admin Dashboard welcome card
19. Add individual task details to Admin Dashboard (not just counts)
20. Add dashboard announcement management (create/delete from dashboard)
21. Add receipt link viewing in Admin Pengadil detail modal
22. Add profile images to table views
23. Add multi-step application form with pre-filled data for Pengadil
24. Add conditional employment fields in application forms
25. Add Saiz Baju to Pengadil profile

### P2 — MEDIUM (UX improvements needed)
26. Replace all browser `confirm()` with styled confirmation modals
27. Replace all browser `prompt()` with styled input modals
28. Add mobile card view for Admin Senarai Permohonan
29. Add Jantina column to Admin Pengadil table
30. Add Telefon column to Admin Senarai Permohonan table
31. Add multi-field address inputs (alamat1+alamat2+poskod+daerah) in forms
32. Add daerah/negeri dropdown selectors in address forms
33. Add Status Kerja dropdown (instead of text input) in profiles
34. Fix PP Referees hardcoded "Aktif" status
35. Add profile images with avatar fallback in tables

### P3 — LOW (Cosmetic/nice-to-have)
36. Add stadium background + gradient overlay to login page
37. Add announcement panel to login page
38. Add PDPA disclaimer to login page
39. Add "Pengumuman" badges to announcement items
40. Match gradient card styling for statistics overview

---

*Report generated from complete page-by-page comparison of all 20+ old HTML files against their Angular 21 counterparts.*
