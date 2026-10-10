// Kalendertage als lokale Schlüssel „JJJJ-MM-TT“.

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function dayKey(d: Date | number = new Date()): string {
  const x = typeof d === 'number' ? new Date(d) : d;
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
}

export function parseDay(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

export function addDays(key: string, n: number): string {
  const d = parseDay(key);
  d.setDate(d.getDate() + n);
  return dayKey(d);
}

export function diffDays(a: string, b: string): number {
  return Math.round((parseDay(a).getTime() - parseDay(b).getTime()) / 86400000);
}

/** Montag der Woche als Schlüssel. */
export function weekKey(key: string): string {
  const d = parseDay(key);
  const wd = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - wd);
  return dayKey(d);
}

export function isoWeek(key: string): number {
  const d = parseDay(key);
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4, 12);
  const diff = (target.getTime() - firstThursday.getTime()) / 86400000;
  return 1 + Math.round((diff - 3 + ((firstThursday.getDay() + 6) % 7)) / 7);
}

const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const MONATE_KURZ = ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sept.', 'Okt.', 'Nov.', 'Dez.'];
const WOCHENTAGE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

export function monthName(m: number): string {
  return MONATE[m];
}

export function formatDay(key: string, kurz = false): string {
  const d = parseDay(key);
  return kurz ? `${d.getDate()}. ${MONATE_KURZ[d.getMonth()]}` : `${d.getDate()}. ${MONATE[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatDayNumeric(key: string): string {
  const d = parseDay(key);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

export function formatWeekday(key: string): string {
  const d = parseDay(key);
  return `${WOCHENTAGE[d.getDay()]}, ${d.getDate()}. ${MONATE[d.getMonth()]}`;
}

export function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatRelative(key: string, today = dayKey()): string {
  const n = diffDays(today, key);
  if (n === 0) return 'heute';
  if (n === 1) return 'gestern';
  if (n > 1 && n < 7) return `vor ${n} Tagen`;
  return formatDay(key, true);
}
