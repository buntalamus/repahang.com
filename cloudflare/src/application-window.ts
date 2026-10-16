/**
 * Opening windows from the Admin Settings page. A form is open only when its
 * switch is on and today (Malaysia time) falls between its open and close
 * dates, both inclusive. A blank date sets no limit on that side.
 */
export const WINDOWS = {
  registration: { label: 'Pendaftaran akaun baru', open: 'registration_open',
    from: 'registration_open_date', to: 'registration_close_date' },
  berdaftar: { label: 'Permohonan Pendaftaran Tahunan', open: 'berdaftar_open',
    from: 'berdaftar_open_date', to: 'berdaftar_close_date' },
  penilai: { label: 'Permohonan Pendaftaran Tahunan Penilai Pengadil', open: 'penilai_open',
    from: 'penilai_open_date', to: 'penilai_close_date' },
  bertulis: { label: 'Permohonan Kelas III FAM', open: 'bertulis_open',
    from: 'bertulis_open_date', to: 'bertulis_close_date' },
  kelas1: { label: 'Permohonan Ujian Kelas I FAM', open: 'kelas1_open',
    from: 'kelas1_open_date', to: 'kelas1_close_date' },
} as const;
export type WindowName = keyof typeof WINDOWS;
export type WindowState = 'open' | 'off' | 'not_yet' | 'closed';
export interface ApplicationWindow { state: WindowState; open_date: string; close_date: string }

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isSettingDate(value: string): boolean {
  if (!DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function klToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur',
    year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** `fallbackOpen` is the switch value when the setting row is missing. */
export function applicationWindow(settings: Record<string, string | undefined>, name: WindowName,
  today = klToday(), fallbackOpen = '0'): ApplicationWindow {
  const keys = WINDOWS[name];
  const date = (key: string) => {
    const value = (settings[key] ?? '').trim();
    return isSettingDate(value) ? value : '';
  };
  const open_date = date(keys.from);
  const close_date = date(keys.to);
  const state: WindowState = (settings[keys.open] ?? fallbackOpen) !== '1' ? 'off'
    : open_date && today < open_date ? 'not_yet'
      : close_date && today > close_date ? 'closed' : 'open';
  return { state, open_date, close_date };
}

export function displayDate(value: string): string {
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

/** Message for a window that is not open; `offMessage` covers a switched-off form. */
export function windowClosedMessage(name: WindowName, status: ApplicationWindow, offMessage: string): string {
  const label = WINDOWS[name].label;
  if (status.state === 'not_yet') return `${label} akan dibuka pada ${displayDate(status.open_date)}.`;
  if (status.state === 'closed') return `${label} telah ditutup pada ${displayDate(status.close_date)}.`;
  return offMessage;
}
