/**
 * Is this shop open right now? Worked out from the hours collected on the shop visit.
 *
 * PLAIN TYPESCRIPT, NO IMPORTS, so `node --test` can run it directly (tests/hours.test.ts).
 *
 * Collected hours are treated as unreliable, so this file is conservative:
 * anything missing or unreadable is `unknown`, never `open`. Telling a rider a shop is
 * open when it is not sends them somewhere with a broken bike for nothing; "Unknown" is
 * the honest state.
 */

export type OpenStatus = 'open' | 'closed' | 'unknown';

/**
 * As written by scripts/import_shops.py. Times are "HH:MM", 24-hour, "24:00" allowed.
 * `closed` lists the days the shop does not open, 0 = Sunday ... 6 = Saturday.
 * An absent field means "not collected", which is different from an empty list.
 */
export type Hours = { open?: string; close?: string; closed?: number[] };

function minutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  const total = Number(m[1]) * 60 + Number(m[2]);
  return total <= 24 * 60 ? total : null;
}

/** "20:00" -> "8 PM", "07:30" -> "7:30 AM". The way the shop's own sign would say it. */
export function clockLabel(hhmm: string): string {
  const total = minutes(hhmm);
  if (total === null) return hhmm;
  const h24 = Math.floor(total / 60) % 24;
  const mm = total % 60;
  const suffix = h24 < 12 ? 'AM' : 'PM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return mm === 0 ? `${h12} ${suffix}` : `${h12}:${String(mm).padStart(2, '0')} ${suffix}`;
}

export function isAllDay(h: Hours | undefined): boolean {
  return !!h && h.open === '00:00' && h.close === '24:00';
}

/**
 * The status at a given moment, in the phone's own clock. Riders are in Manila, so the
 * phone's time is the shop's time.
 *
 * `until` is the closing time, for "Open now · until 8 PM". Omitted for all-day shops.
 */
export function statusAt(h: Hours | undefined, now: Date): { status: OpenStatus; until?: string } {
  if (!h) return { status: 'unknown' };
  if (h.closed?.includes(now.getDay())) return { status: 'closed' };
  if (!h.open || !h.close) return { status: 'unknown' };

  const open = minutes(h.open);
  const close = minutes(h.close);
  if (open === null || close === null) return { status: 'unknown' };
  if (isAllDay(h)) return { status: 'open' };

  const t = now.getHours() * 60 + now.getMinutes();
  /* A shop that closes after midnight: open from `open` until `close` the next morning. */
  const inside = close > open ? t >= open && t < close : t >= open || t < close;
  return inside ? { status: 'open', until: clockLabel(h.close) } : { status: 'closed' };
}
