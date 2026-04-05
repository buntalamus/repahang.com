/**
 * Kriteria Penilaian Pengadil — dropdown options per section per jawatan.
 * Mirror of config/kriteria-penilaian.php for Angular frontend.
 */

export interface KriteriaSection {
  key: string;
  label: string;
  items: string[];
}

const KAWALAN_PERMAINAN: KriteriaSection = {
  key: 'kawalan',
  label: 'Kawalan Permainan',
  items: [
    'Mengenalpasti kesalahan (e.g.. kicks, trips, strikes, handball, etc.)',
    'Membezakan di antara cuai, melulu dan penggunaan kuasa yang berlebihan',
    'Membezakan di antara bermain dengan amat kasar atau berkelakuan ganas',
    'Mengenalpasti penggunaan siku (illegal use of the arms) yang membahayakan keselamatan pemain lawan',
    'Mengenalpasti takel/cabaran yang boleh membahayakan keselamatan pemain lawan',
    'Mengenalpasti kesalahan mengganggu/menghentikan situasi serangan yang baik',
    'Mengenalpasti kesalahan menggagalkan suatu jaringan atau peluang jelas menjaringkan gol',
    'Mengenalpasti kesalahan memegang pemain lawan yang perlu diberikan amaran',
    'Mengenalpasti kesalahan memegang bola yang perlu diberikan amaran',
    'Mengenalpasti kesalahan melambat-lambatkan permulaan semula permainan',
    'Mengenalpasti kesalahan simulasi (simulation)',
    'Menguruskan situasi pemain membantah dengan perkataan atau perbuatan',
    "Menguruskan situasi 'mass confrontation'",
    'Menguruskan situasi meraikan jaringan gol',
    'Menguruskan permulaan semula permainan',
    'Menguruskan jarak pemain ketika permulaan semula permainan',
    'Menguruskan situasi sepakan penalti',
    'Membenarkan kelancaran pergerakan permainan',
    'Menjangka dan membuat bacaan permainan (anticipation and reading of the game)',
    'Personality (confident, calm, composed, courage, firm, …)',
    'Isyarat secara keseluruhan (signals in general)',
    'Bahasa badan (body language and gestures)',
    'Penggunaan wisel (usage of the whistle)',
    'Aplikasi advantej (application of advantage)',
    'Komunikasi lisan (verbal communication)',
    'Bersikap proaktif dan preventative (pencegahan)',
    'Berkeyakinan dalam membuat keputusan',
    'Pengurusan masa (time management)',
  ],
};

const FIZIKAL_POSISI: KriteriaSection = {
  key: 'fizikal',
  label: 'Kecergasan Fizikal Dan Posisi',
  items: [
    'Berhampiran dengan permainan setiap masa',
    'Sudut penglihatan (angle of view)',
    'Menjangka fasa permainan berikutnya',
    'Sistem kawalan pepenjuru yang sesuai dan fleksibel',
    'Memecut dengan laju dan mengubah kadar pecutan apabila diperlukan (explosive movement)',
    'Posisi semasa bola di luar permainan (cth: sepakan percuma, sepakan penjuru, dll.)',
    'Penggunaan kepelbagaian gaya larian (sideway, backwards, etc.).',
    'Penampilan fizikal',
    'Daya tahan kecergasan sepanjang masa permainan',
    'Bola berada pada posisi di antara pengadil dan penolong pengadil',
  ],
};

const KERJASAMA: KriteriaSection = {
  key: 'kerjasama',
  label: 'Kerjasama Berpasukan',
  items: [
    "Komunikasi melalui 'eye contact'",
    'Komunikasi melalui sistem radio (radio-communication system)',
    "Komunikasi dengan isyarat yang tidak ketara 'discrete signals'",
    'Komunikasi melalui isyarat bendera',
    'Pegawai yang bersesuaian bertindak membuat keputusan (best viewing position)',
    'Pengadil memperakui semua isyarat penolong pengadil',
    'Prosedur yang sesuai diambil setelah keputusan yang salah diberikan oleh penolong pengadil (overrule)',
    'Penolong pengadil memberikan maklumat yang sewajarnya apabila diperlukan',
    "Penolong pengadil membantu pengadil dalam situasi 'mass confrontation'",
    'Bahasa badan yang berkesan dengan penolong pengadil dan pegawai keempat',
    'Perkongsian tanggungjawab antara pengadil dan penolong pengadil',
    'Kerjasama dengan pegawai ke-Empat',
  ],
};

const PENOLONG_PENGADIL: KriteriaSection = {
  key: 'penolong',
  label: 'Penilaian Penolong Pengadil',
  items: [
    'Penilaian keputusan ofsaid (Judgements of offside situations)',
    "Aplikasi teknik 'wait and see' untuk situasi ofsaid",
    "Aplikasi teknik 'wait and see' untuk kesalahan yang dikenal pasti",
    'Penolong pengadil memberikan kelebihan kepada pasukan menyerang ketika ada keraguan',
    'Mengenalpasti kesalahan apabila mempunyai pandangan yang lebih jelas berbanding pengadil',
    'Mengenalpasti kelakuan tidak sopan atau sebarang insiden yang diluar dari penglihatan pengadil',
    'Keputusan lontaran ke dalam',
    'Keputusan sepakan gol',
    'Keputusan sepakan penjuru',
    'Keputusan melibatkan situasi di garisan gol (gol atau tidak gol)',
    'Posisi dan pergerakan semasa bola dalam permainan',
    'Pecutan dengan kelajuan apabila diperlukan',
    'Posisi semasa bola di luar permainan',
    'Penggunaan bendera (flag technique)',
    'Isyarat dan bahasa badan (body language and gestures)',
    'Penampilan fizikal (Fitness condition/appearance/agility)',
    'Bantuan diberikan kepada pengadil apabila diperlukan',
    'Jangkaan permainan untuk fasa seterusnya',
    'Pengurusan pemain',
    'Pengurusan jarak 9.15 meter',
    'Pengurusan kawasan teknikal yang berhampiran apabila diperlukan',
    "Bantuan kepada pengadil dalam situasi 'mass confrontation'",
    'Pengurusan pertukaran pemain apabila diperlukan',
    'Membantu pengadil menguruskan sepakan penalti',
  ],
};

const PEGAWAI_KEEMPAT: KriteriaSection = {
  key: 'keempat',
  label: 'Penilaian Pegawai Keempat',
  items: [
    'Pengurusan kawasan teknikal secara umum',
    'Pendekatan terhadap pegawai-pegawai pasukan',
    'Pengurusan tatacara penggantian pemain',
    'Penggunaan papan elektronik (pertukaran pemain)',
    'Penggunaan papan elektronik (tambahan masa)',
    'Pengurusan pemain yang tercedera, kawalan pembawa stretcher dll.',
    'Penyeliaan penggantian bola',
    "Pengurusan pemain gantian yang melakukan 'warming up'",
    'Pengurusan tugas-tugas pentadbiran (kertas catatan) sebelum dan selepas permainan',
    'Bantuan kepada pengadil dalam mengawal permainan apabila diperlukan',
    'Pemeriksaan / Mengawal selia kelengkapan pemain gantian',
  ],
};

/**
 * Get criteria sections for a given jawatan.
 */
export function getSectionsForJawatan(jawatan: string): KriteriaSection[] {
  if (jawatan.includes('Penolong') || jawatan.includes('Pembantu')) {
    return [PENOLONG_PENGADIL];
  }
  if (jawatan.includes('ke4') || jawatan.includes('Keempat') || jawatan.includes('Ke 4') || jawatan.includes('Ke-4')) {
    return [PEGAWAI_KEEMPAT];
  }
  // Pengadil (R)
  return [KAWALAN_PERMAINAN, FIZIKAL_POSISI, KERJASAMA];
}

export const SKALA_PEMARKAHAN = [
  { range: '9.0 - 10', desc: 'Prestasi sangat baik dalam perlawanan dengan banyak keputusan sukar dibuat dengan betul' },
  { range: '8.5 - 8.9', desc: 'Prestasi sangat baik dalam perlawanan dengan banyak keputusan sukar dibuat dengan betul' },
  { range: '8.3 - 8.4', desc: 'Prestasi baik dalam perlawanan dengan banyak keputusan dijangka dibuat dengan betul' },
  { range: '8.0 - 8.2', desc: 'Prestasi baik dengan beberapa perkara untuk penambahbaikan' },
  { range: '7.9', desc: 'Prestasi tidak memuaskan melibatkan satu key match incident, jika tidak 8.3 atau ke atas' },
  { range: '7.8', desc: 'Prestasi tidak memuaskan melibatkan satu key match incident jika tidak 8.0 - 8.2' },
  { range: '7.5 - 7.7', desc: 'Prestasi tidak memuaskan melibatkan dua key match incident' },
  { range: '7.4', desc: 'Satu kesilapan key match incident yang telah mempengaruhi pemenang perlawanan' },
  { range: '7.0 - 7.4', desc: 'Prestasi yang buruk dengan tiga atau lebih key match incident' },
];

export const TAHAP_KESUKARAN = [
  { value: 'Normal', desc: 'Perlawanan normal, sedikit situasi mencabar' },
  { value: 'Susah', desc: 'Perlawanan sukar dengan beberapa keputusan sukar' },
  { value: 'Sangat Susah', desc: 'Perlawanan sangat sukar dengan banyak situasi sukar' },
];
