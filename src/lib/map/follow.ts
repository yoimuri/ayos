/**
 * SHOULD THE CAMERA FOLLOW THE RIDER RIGHT NOW?
 *
 * Follow mode eases the camera to each new position. The bug it caused, and this fixes:
 * pressing "zoom to me" starts an 800 ms flight AND asks the GPS for a fresh reading. Once
 * the GPS is warm that reading lands mid-flight, follow mode eases to it, and the ease
 * REPLACES the flight. An ease that names no zoom keeps whatever zoom the flight had
 * reached, so the zoom stopped partway. Cold GPS answered too slowly to interfere, which
 * is why the first press worked and later ones did not.
 *
 * So any deliberate camera move marks the camera busy until it lands, and following waits.
 *
 * Plain TypeScript, no imports: tests/follow.test.ts runs it with `node --test`.
 */

/** Extra time after a flight's own duration, so the ease never clips its last frame. */
export const LANDING_MARGIN_MS = 150;

/** When a flight of `durationMs` that starts at `now` will have landed. */
export function busyUntil(now: number, durationMs: number): number {
  return now + durationMs + LANDING_MARGIN_MS;
}

export function shouldFollow(s: {
  /** Follow mode is on (not switched off by the rider dragging the map). */
  following: boolean;
  /** A shop is open, so the camera is framing the shop and the rider together. */
  hasFocus: boolean;
  /** The camera is busy with a deliberate flight until this time. */
  busyUntil: number;
  now: number;
}): boolean {
  return s.following && !s.hasFocus && s.now >= s.busyUntil;
}
