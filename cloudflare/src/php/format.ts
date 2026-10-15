/**
 * Ports of the PHP built-ins the notification templates depend on. PHP runs
 * with date_default_timezone_set('Asia/Kuala_Lumpur') (UTC+8, no DST), so
 * every timestamp here is rendered in that fixed offset.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const KL_OFFSET_MS = 8 * 3600_000;

/** htmlspecialchars() with PHP 8.1+ defaults (ENT_QUOTES | ENT_SUBSTITUTE). */
export function h(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  })[character] ?? character);
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** Unix milliseconds for a local KL date/time string, as strtotime() reads it. */
export function klTimestamp(value: string, nowMs = Date.now()): number | null {
  const text = value.trim();
  const full = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(text);
  if (full) {
    const [, y, m, d, hh = '0', mm = '0', ss = '0'] = full;
    return Date.UTC(+y, +m - 1, +d, +hh, +mm, +ss) - KL_OFFSET_MS;
  }
  const time = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(text);
  if (time) {
    const today = new Date(nowMs + KL_OFFSET_MS);
    return Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(),
      +time[1], +time[2], +(time[3] ?? 0)) - KL_OFFSET_MS;
  }
  return null;
}

/** PHP date() for the formats used by the templates: d M Y, H:i, d M Y, H:i, Y. */
export function phpDate(format: 'd M Y' | 'H:i' | 'd M Y, H:i' | 'Y', timestampMs: number | null): string {
  // strtotime() failure yields false, which date() renders as the Unix epoch.
  const local = new Date((timestampMs ?? 0) + KL_OFFSET_MS);
  const day = pad(local.getUTCDate());
  const month = MONTHS[local.getUTCMonth()];
  const year = String(local.getUTCFullYear());
  const time = `${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`;
  switch (format) {
    case 'd M Y': return `${day} ${month} ${year}`;
    case 'H:i': return time;
    case 'd M Y, H:i': return `${day} ${month} ${year}, ${time}`;
    case 'Y': return year;
  }
}

/** date('d M Y', strtotime($tarikh)) */
export function tarikhFmt(tarikh: string): string {
  return phpDate('d M Y', klTimestamp(tarikh));
}

/** $masa ? date('H:i', strtotime($masa)) : '-' */
export function masaFmt(masa: string | null | undefined): string {
  return masa ? phpDate('H:i', klTimestamp(masa)) : '-';
}

/** $noMatch ? 'P' . ltrim($noMatch, '0Pp') : $empty */
export function noMatchFmt(noMatch: string | null | undefined, empty = '-'): string {
  return noMatch ? `P${noMatch.replace(/^[0Pp]+/, '')}` : empty;
}

/** html_entity_decode() for the entities the PHP templates emit. */
function decodeEntities(value: string): string {
  const named: Record<string, string> = {
    amp: '&', lt: '<', gt: '>', quot: '"', nbsp: ' ', mdash: '—',
    bull: '•', copy: '©', apos: "'",
  };
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
    if (code[0] === '#') {
      const point = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(point) ? String.fromCodePoint(point) : entity;
    }
    return named[code.toLowerCase()] ?? entity;
  });
}

/** wordwrap($text, 76, "\r\n") without cutting long words. */
function wordwrap(text: string, width = 76): string {
  return text.split('\n').map((line) => {
    const words = line.split(' ');
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
      if (current === '') current = word;
      else if (current.length + 1 + word.length <= width) current += ` ${word}`;
      else { lines.push(current); current = word; }
    }
    lines.push(current);
    return lines.join('\r\n');
  }).join('\n');
}

/** Plain-text part as _smtpSend() builds it: strip_tags(html_entity_decode(html)). */
export function plainTextFromHtml(html: string): string {
  return wordwrap(decodeEntities(html).replace(/<[^>]*>/g, ''));
}
