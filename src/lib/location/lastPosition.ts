/**
 * THE LAST KNOWN LOCATION (Clint, 7 Nov: a default, not a setting). When there is no live reading, with
 * location off, no fix indoors, or the phone's own memory of its last fix too old to use, the app still
 * has somewhere to measure from, so the directory keeps working. It is drawn faded, like any remembered
 * spot, and the first real reading replaces it.
 *
 * ONE POINT, ON THIS PHONE, OVERWRITTEN EACH TIME. Never a history, and no time-stamped trail: the spec's
 * rule against per-person location history stands. Ayoos has no server this goes to.
 */

export const LAST_POSITION_KEY = 'ayos.lastPosition.v1';

/** Worse than this is not worth remembering: it could be the next street over. */
export const SAVE_ACCURACY_M = 100;
/** A reading arrives about once a second; the disk does not need to hear about each one. */
export const SAVE_EVERY_MS = 30_000;
/** Standing still, there is nothing new to save. */
export const SAVE_MOVED_M = 50;

export type SavedPosition = { lng: number; lat: number; at: number };

function metres(a: SavedPosition, b: { lng: number; lat: number }): number {
  const k = 111_320;
  return Math.hypot((a.lng - b.lng) * k * Math.cos((a.lat * Math.PI) / 180), (a.lat - b.lat) * k);
}

/** Should this live reading replace the saved spot? A faked GPS position never does. */
export function shouldSave(
  saved: SavedPosition | null,
  next: { lng: number; lat: number; at: number },
  accuracyM: number | null,
  mocked: boolean,
): boolean {
  if (mocked || accuracyM === null || accuracyM > SAVE_ACCURACY_M) return false;
  if (!saved) return true;
  return next.at - saved.at >= SAVE_EVERY_MS && metres(saved, next) >= SAVE_MOVED_M;
}

/** What came off the disk, checked. Anything odd counts as nothing saved. */
export function parseSaved(raw: string | null): SavedPosition | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<SavedPosition>;
    const ok =
      typeof v.lng === 'number' &&
      typeof v.lat === 'number' &&
      typeof v.at === 'number' &&
      Math.abs(v.lng) <= 180 &&
      Math.abs(v.lat) <= 90;
    return ok ? { lng: v.lng as number, lat: v.lat as number, at: v.at as number } : null;
  } catch {
    return null;
  }
}
