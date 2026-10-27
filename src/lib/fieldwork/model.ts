/**
 * FIELD SURVEY MODE: corrections and new shops collected on foot. DEVELOPER FEATURE,
 * removed before the official launch.
 *
 * HOW IT STORES THINGS: as a LOG. Every edit is one entry, "this column of this shop went
 * from this to that, at this time". The shop's current details are simply the newest
 * entry for each column, laid over the original data. So:
 *
 *   - the original is never overwritten (restore = remove entries),
 *   - the team gets "what changed vs before" for free (the log IS that list),
 *   - a wrong entry can be corrected or deleted, and everything recomputes.
 *
 * Values are kept as the spreadsheet writes them ("0917 123 4567, 0918 ...",
 * "9:00 - 20:00", "Sunday"), so an exported file pastes straight into the sheet. The
 * parse functions below turn them into what the app draws, with the same rules as
 * scripts/import_shops.py.
 *
 * Plain TypeScript, no imports: tests/fieldwork.test.ts runs it with `node --test`.
 */

export const FIELDS = ['name', 'address', 'services', 'contact', 'social', 'email', 'time', 'closed', 'note'] as const;
export type Field = (typeof FIELDS)[number];

/**
 * What the log can record: the typed columns, plus the shop's map position. The
 * position is set by dragging a pin, never typed, and is stored as one value,
 * "latitude, longitude", so one move is one entry in the log.
 */
export const LOG_FIELDS = [...FIELDS, 'location'] as const;
export type LogField = (typeof LOG_FIELDS)[number];

/** Column names exactly as the field spreadsheet heads them (plus Note). */
export const FIELD_LABEL: Record<LogField, string> = {
  name: 'Name',
  address: 'Address',
  services: 'Services',
  contact: 'Contact No.',
  social: 'Social Media',
  email: 'Email',
  time: 'Time',
  closed: 'Day Closed',
  note: 'Note',
  location: 'Latitude, Longitude',
};

/** A map position as the sheet writes it: "14.6531200, 121.0345600" (latitude first). */
export function locationText(lat: number, lng: number): string {
  return `${lat.toFixed(7)}, ${lng.toFixed(7)}`;
}

/** The reverse of `locationText`. Null for anything that is not a Metro Manila-sized number pair. */
export function parseLocation(text: string): { lat: number; lng: number } | null {
  const m = text.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

export type FieldEdit = {
  id: string;
  shopId: string;
  field: LogField;
  /** What it was when this edit was made. */
  before: string;
  after: string;
  at: number;
};

/** A shop the surveyor found that is not on the list yet, pinned on the map. */
export type NewShop = {
  id: string;
  lat: number;
  lng: number;
  /**
   * How precise the phone said its position was, metres, when the pin was left where
   * the GPS put it. Null once the pin was placed by hand: then the surveyor's eye is
   * the accuracy, and a GPS figure would be misleading.
   */
  accuracy: number | null;
  createdAt: number;
  values: Partial<Record<Field, string>>;
};

export type FieldworkData = {
  log: FieldEdit[];
  added: NewShop[];
  lastExportAt: number | null;
};

export const EMPTY_FIELDWORK: FieldworkData = { log: [], added: [], lastExportAt: null };

/* ------------------------------------------------------------------ the log */

/** Adds one edit. Typing back exactly what is already there records nothing. */
export function recordEdit(d: FieldworkData, e: FieldEdit): FieldworkData {
  const now = currentValues(d, e.shopId)[e.field] ?? e.before;
  if (now === e.after) return d;
  return { ...d, log: [...d.log, e] };
}

/** The newest value for each edited column of one shop. Unedited columns are absent. */
export function currentValues(d: FieldworkData, shopId: string): Partial<Record<LogField, string>> {
  const out: Partial<Record<LogField, string>> = {};
  for (const e of d.log) if (e.shopId === shopId) out[e.field] = e.after;
  return out;
}

/** Correct a mistaken entry's new value. */
export function editEntry(d: FieldworkData, id: string, after: string): FieldworkData {
  return { ...d, log: d.log.map((e) => (e.id === id ? { ...e, after } : e)) };
}

/** Remove one entry; the column falls back to the previous entry, or the original. */
export function deleteEntry(d: FieldworkData, id: string): FieldworkData {
  return { ...d, log: d.log.filter((e) => e.id !== id) };
}

/** Back to the original for one column of one shop. */
export function restoreField(d: FieldworkData, shopId: string, field: LogField): FieldworkData {
  return { ...d, log: d.log.filter((e) => !(e.shopId === shopId && e.field === field)) };
}

/** Back to the original for every column of one shop. */
export function restoreShop(d: FieldworkData, shopId: string): FieldworkData {
  return { ...d, log: d.log.filter((e) => e.shopId !== shopId) };
}

export function addShop(d: FieldworkData, s: NewShop): FieldworkData {
  return { ...d, added: [...d.added, s] };
}

export function updateNewShop(d: FieldworkData, id: string, values: Partial<Record<Field, string>>): FieldworkData {
  return { ...d, added: d.added.map((s) => (s.id === id ? { ...s, values: { ...s.values, ...values } } : s)) };
}

/** Moves an added shop's pin. Its GPS accuracy no longer applies, so it is cleared. */
export function moveNewShop(d: FieldworkData, id: string, lat: number, lng: number): FieldworkData {
  return { ...d, added: d.added.map((s) => (s.id === id ? { ...s, lat, lng, accuracy: null } : s)) };
}

export function deleteNewShop(d: FieldworkData, id: string): FieldworkData {
  return { ...d, added: d.added.filter((s) => s.id !== id) };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * True when there is work on this phone that has not been exported for a day. The phone
 * copy alone is lost if the app is uninstalled, so the app nudges.
 */
export function needsExportReminder(d: FieldworkData, now: number): boolean {
  const since = d.lastExportAt ?? 0;
  const unexported =
    d.log.some((e) => e.at > since) || d.added.some((s) => s.createdAt > since);
  return unexported && now - since > DAY_MS;
}

/* ------------------------------------------------------------------ the export */

/*
  THE EXPORT IS ONE SPREADSHEET with three tabs, built from the rows below (xlsx.ts turns
  them into the file):

    New shops     one row per added shop, in the field sheet's own columns
    Edited shops  one COMPLETE row per corrected shop, new values filled in, the changed
                  cells marked, and a "What changed" column saying from what to what
    Changes       every edit, one per line, with its before and after. This is the tab
                  scripts/import_shops.py --survey reads to merge the work into the sheet.
*/

/** "2026-10-11 14:05", in the phone's own time. */
export function stamp(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** A spreadsheet cell: text, a number (coordinates), or empty. */
export type Cell = string | number | null;
/** How a cell is marked in the export: a changed value, a new shop's value, or neither. */
export type Mark = 'changed' | 'added' | null;
export type SheetRows = { header: string[]; rows: Cell[][]; marks: Mark[][] };

/** The field sheet's columns, in its order (plus Note), for new shops. */
export const SHEET_COLUMNS = ['Name', 'Address', 'Latitude', 'Longitude', 'Services', 'Contact No.', 'Social Media', 'Email', 'Time', 'Day Closed', 'Image', 'Note'];

/** What this module needs from a shop. A shape, not an import, so the file stays dependency-free. */
export type SheetSource = {
  name: string;
  address?: string;
  tags: string[];
  phones: string[];
  links: { url: string }[];
  hours?: { open?: string; close?: string; closed?: number[] };
  lat: number;
  lng: number;
};

/** A shop's details written the way the field sheet writes them. */
export function sheetValues(shop: SheetSource | undefined): Record<Field, string> {
  return {
    name: shop?.name ?? '',
    address: shop?.address ?? '',
    services: shop ? tagsText(shop.tags) : '',
    contact: shop ? phonesText(shop.phones) : '',
    social: shop ? shop.links.map((l) => l.url).join(', ') : '',
    /* Shop emails are not kept in the app, so the sheet's value is unknown here. */
    email: '',
    time: timeText(shop?.hours),
    closed: closedText(shop?.hours?.closed),
    note: '',
  };
}

/** Coordinates as numbers, so the spreadsheet treats them as numbers. Empty when unreadable. */
function latLngCells(text: string | undefined): [Cell, Cell] {
  const p = text ? parseLocation(text) : null;
  return p ? [Number(p.lat.toFixed(7)), Number(p.lng.toFixed(7))] : [null, null];
}

export function newShopRows(d: FieldworkData): SheetRows {
  const header = [...SHEET_COLUMNS, 'Added on'];
  const rows: Cell[][] = d.added.map((s) => {
    const v = s.values;
    return [
      v.name ?? '', v.address ?? '', Number(s.lat.toFixed(7)), Number(s.lng.toFixed(7)), v.services ?? '',
      v.contact ?? '', v.social ?? '', v.email ?? '', v.time ?? '', v.closed ?? '', '', v.note ?? '',
      stamp(s.createdAt),
    ];
  });
  return { header, rows, marks: rows.map((r) => r.map((_, i) => (i < SHEET_COLUMNS.length ? 'added' : null))) };
}

/**
 * One complete row per corrected shop. "Before" for each column is the value before the
 * FIRST edit to it, "after" the newest, so a column edited three times reads as one change.
 */
export function editedShopRows(d: FieldworkData, originalOf: (shopId: string) => SheetSource | undefined): SheetRows {
  const header = ['Shop ID', 'Name', 'Address', 'Latitude', 'Longitude', 'Services', 'Contact No.', 'Social Media', 'Email', 'Time', 'Day Closed', 'Note', 'What changed'];
  const order: string[] = [];
  const first = new Map<string, FieldEdit>();
  for (const e of [...d.log].sort((a, b) => a.at - b.at)) {
    if (!order.includes(e.shopId)) order.push(e.shopId);
    const key = `${e.shopId}|${e.field}`;
    if (!first.has(key)) first.set(key, e);
  }
  const rows: Cell[][] = [];
  const marks: Mark[][] = [];
  for (const id of order) {
    const original = originalOf(id);
    const now = currentValues(d, id);
    const v = { ...sheetValues(original), ...now };
    const loc = now.location ?? (original ? locationText(original.lat, original.lng) : undefined);
    const [lat, lng] = latLngCells(loc);
    const changes = (Object.keys(now) as LogField[]).map((f) => {
      const before = first.get(`${id}|${f}`)?.before ?? '';
      return `${FIELD_LABEL[f]}: ${before || '(blank)'} -> ${now[f] || '(blank)'}`;
    });
    rows.push([id, v.name, v.address, lat, lng, v.services, v.contact, v.social, v.email, v.time, v.closed, v.note, changes.join('; ')]);
    const edited = (f: LogField) => (now[f] !== undefined ? 'changed' : null);
    marks.push([
      null, edited('name'), edited('address'), edited('location'), edited('location'), edited('services'),
      edited('contact'), edited('social'), edited('email'), edited('time'), edited('closed'), edited('note'), null,
    ]);
  }
  return { header, rows, marks };
}

/** Every edit, oldest first: the tab the import script merges from. */
export function changeRows(d: FieldworkData, nameOf: (shopId: string) => string): SheetRows {
  const header = ['Date', 'Shop ID', 'Shop name', 'Column', 'Before', 'After'];
  const rows: Cell[][] = [...d.log]
    .sort((a, b) => a.at - b.at)
    .map((e) => [stamp(e.at), e.shopId, nameOf(e.shopId), FIELD_LABEL[e.field], e.before, e.after]);
  return { header, rows, marks: rows.map((r) => r.map(() => null)) };
}

/** The full backup: everything, exactly, so a restore loses nothing. */
export function toBackup(d: FieldworkData, now: number): string {
  return JSON.stringify({ app: 'ayos', kind: 'field-survey-backup', version: 1, exportedAt: now, data: d });
}

/** Reads a backup file. Null when it is not one, so a wrong file can never wipe the survey. */
export function parseBackup(text: string): FieldworkData | null {
  try {
    const v = JSON.parse(text);
    if (v?.app !== 'ayos' || v?.kind !== 'field-survey-backup' || !v.data) return null;
    const { log, added, lastExportAt } = v.data;
    if (!Array.isArray(log) || !Array.isArray(added)) return null;
    const okEdit = (e: FieldEdit) =>
      typeof e?.id === 'string' && typeof e.shopId === 'string' && (LOG_FIELDS as readonly string[]).includes(e.field) &&
      typeof e.after === 'string' && typeof e.at === 'number';
    const okShop = (s: NewShop) =>
      typeof s?.id === 'string' && typeof s.lat === 'number' && typeof s.lng === 'number' && typeof s.values === 'object';
    if (!log.every(okEdit) || !added.every(okShop)) return null;
    return { log, added, lastExportAt: typeof lastExportAt === 'number' ? lastExportAt : null };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ sheet text <-> app data */

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** One phone number to "0917-123-4567" or "(02) 8537-6900"; null when it is not dialable. */
export function formatPhone(raw: string): string | null {
  let digits = raw.split(/\b(?:loc|local|ext)\b\.?/i)[0].replace(/\D/g, '');
  if (digits.startsWith('63')) digits = '0' + digits.slice(2);
  if (digits.length === 10 && digits.startsWith('9')) digits = '0' + digits;
  if (digits.length === 11 && digits.startsWith('09')) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10 && digits.startsWith('02')) digits = digits.slice(2);
  if (digits.length === 9 && digits.startsWith('2')) digits = digits.slice(1);
  if (digits.length === 8 && digits[0] !== '0') return `(02) ${digits.slice(0, 4)}-${digits.slice(4)}`;
  return null;
}

export function parsePhones(text: string): string[] {
  const out: string[] = [];
  for (const piece of text.split(/[,/;]|\bor\b/)) {
    if (!/\d/.test(piece)) continue;
    const p = formatPhone(piece.trim());
    if (p && !out.includes(p)) out.push(p);
  }
  return out;
}

export function parseLinks(text: string): string[] {
  return text
    .split(/[\s,]+/)
    .map((t) => t.replace(/[,;]+$/, ''))
    .filter((t, i, all) => /^https?:\/\/\S+\.\S+/.test(t) && all.indexOf(t) === i);
}

/** "9:00 - 20:00" -> { open: "09:00", close: "20:00" }; null when unreadable. */
export function parseTime(text: string): { open: string; close: string } | null {
  const m = /^\s*(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})\s*$/.exec(text);
  if (!m) return null;
  const [oh, om, ch, cm] = m.slice(1).map(Number);
  if (oh > 24 || ch > 24 || om > 59 || cm > 59) return null;
  const p = (n: number) => String(n).padStart(2, '0');
  return { open: `${p(oh)}:${p(om)}`, close: `${p(ch)}:${p(cm)}` };
}

/** The Day Closed column into day numbers (0 = Sunday). Null when unreadable: unknown, not "always open". */
export function parseClosed(text: string): number[] | null {
  const low = text.trim().toLowerCase();
  if (!low) return null;
  if (['everyday open', 'open everyday', 'open every day', 'everyday'].includes(low)) return [];
  if (low === 'weekdays') return [1, 2, 3, 4, 5];
  if (low === 'weekends') return [0, 6];
  const only = /^only open on (\w+)$/.exec(low);
  const days = DAYS.map((d) => d.toLowerCase());
  if (only && days.includes(only[1])) return [0, 1, 2, 3, 4, 5, 6].filter((d) => d !== days.indexOf(only[1]));
  const words = low.split(/[\s,/&]+|\band\b/).filter(Boolean);
  if (words.length && words.every((w) => days.includes(w))) {
    return [...new Set(words.map((w) => days.indexOf(w)))].sort((a, b) => a - b);
  }
  return null;
}

const TAGS = ['dealer', 'repair', 'parts', 'accessories'];
export function parseTags(text: string): string[] {
  return [...new Set(text.split(/[,/;]/).map((t) => t.trim().toLowerCase()).filter((t) => TAGS.includes(t)))].sort();
}

/* The app's data back into sheet text, for the "before" side and the form's starting values. */

export function phonesText(phones: string[]): string {
  return phones.join(', ');
}

export function timeText(h: { open?: string; close?: string } | undefined): string {
  if (!h?.open || !h.close) return '';
  const strip = (t: string) => t.replace(/^0(\d):/, '$1:');
  return `${strip(h.open)} - ${strip(h.close)}`;
}

export function closedText(closed: number[] | undefined): string {
  if (!closed) return '';
  if (closed.length === 0) return 'Everyday Open';
  const names = closed.map((d) => DAYS[d]);
  return names.length === 2 ? names.join(' and ') : names.join(', ');
}

export function tagsText(tags: string[]): string {
  return tags.map((t) => t[0].toUpperCase() + t.slice(1)).join(', ');
}
