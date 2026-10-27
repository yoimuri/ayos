/**
 * SPEED AND DIRECTION OF TRAVEL, EVEN ON PHONES THAT DO NOT REPORT THEM.
 *
 * The position filter and the map both decide "is this bike moving, and which way" from
 * the speed and heading the phone attaches to each reading. Many Android phones leave
 * those out (null), or report a speed of exactly 0 whatever is happening. On those
 * phones the filter took a moving bike for a still one and held the dot back: measured
 * on a simulated ride at 36 km/h, it fell 100 m behind and then advanced in jumps.
 *
 * So the phone's own figures are used when they are real, and otherwise both are worked
 * out from the readings themselves: how far the rider got over the last few seconds,
 * and in which direction.
 *
 * WHY A FEW SECONDS AND NOT ONE. Two readings a second apart differ mostly by noise; a
 * still phone's readings jitter 5-15 m. Over three or more seconds a moving bike has
 * covered real ground while the jitter has not grown, and the move must also be bigger
 * than the reading's own uncertainty before it counts as movement at all.
 *
 * Plain TypeScript, no imports: tests/motion.test.ts runs it with `node --test`.
 */

export type RawFix = {
  lng: number;
  lat: number;
  accuracy: number | null;
  timestamp: number;
  /** What the phone reported, m/s. Null, negative or NaN when it does not know. */
  speed?: number | null;
  /** What the phone reported, degrees from north. Negative when it does not know. */
  heading?: number | null;
};

export type Motion = {
  /** Metres per second: the phone's when real, otherwise measured. Null until there is evidence either way. */
  speed: number | null;
  /** Direction of travel in degrees from north, or null when not clearly moving. */
  course: number | null;
};

/** The same threshold the rest of the app uses for "moving": a brisk jog, never a still phone. */
export const MOVING_MPS = 2.5;
/** Look back at least this far before measuring, so jitter is small next to real progress. */
const BASELINE_MIN_MS = 3000;
/** And no further than this, so a turn shows up within seconds. */
const BASELINE_MAX_MS = 8000;
/** A measured move must beat both this and the reading's own uncertainty. */
const MIN_MOVE_M = 12;

export function metres(a: { lng: number; lat: number }, b: { lng: number; lat: number }): number {
  const mPerDegLng = 111_320 * Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180);
  return Math.hypot((b.lng - a.lng) * mPerDegLng, (b.lat - a.lat) * 111_320);
}

/** Compass bearing from a to b, 0-360, for points a few hundred metres apart. */
export function bearing(a: { lng: number; lat: number }, b: { lng: number; lat: number }): number {
  const mPerDegLng = 111_320 * Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180);
  const east = (b.lng - a.lng) * mPerDegLng;
  const north = (b.lat - a.lat) * 111_320;
  return ((Math.atan2(east, north) * 180) / Math.PI + 360) % 360;
}

/** Smallest difference between two bearings, 0-180. */
export function angleBetween(a: number, b: number): number {
  const d = Math.abs((((a - b) % 360) + 540) % 360 - 180);
  return d;
}

export function createMotion() {
  let history: RawFix[] = [];

  return {
    reset() {
      history = [];
    },

    push(fix: RawFix): Motion {
      history.push(fix);
      history = history.filter((h) => fix.timestamp - h.timestamp <= BASELINE_MAX_MS);

      const reported = fix.speed != null && Number.isFinite(fix.speed) && fix.speed > 0 ? fix.speed : null;
      const reportedCourse =
        fix.heading != null && Number.isFinite(fix.heading) && fix.heading >= 0 ? fix.heading % 360 : null;

      /* The oldest reading that is at least BASELINE_MIN_MS old. */
      const base = history.find((h) => fix.timestamp - h.timestamp >= BASELINE_MIN_MS);
      let measured: Motion | null = null;
      if (base) {
        const d = metres(base, fix);
        const dt = (fix.timestamp - base.timestamp) / 1000;
        const noise = Math.max(MIN_MOVE_M, fix.accuracy ?? 50);
        measured = d >= noise ? { speed: d / dt, course: bearing(base, fix) } : { speed: d / dt, course: null };
      }

      /*
        The phone's speed wins when it is real (above zero). An exact zero is only trusted
        when the readings agree the phone is still: a zero beside 50 m of progress is a
        phone that does not report speed, not a parked bike.
      */
      const movedFar = measured?.course != null;
      const speed = reported ?? (movedFar ? measured!.speed : (fix.speed === 0 ? 0 : (measured?.speed ?? null)));
      const moving = speed != null && speed >= MOVING_MPS;
      const course = !moving ? null : reported != null && reportedCourse != null ? reportedCourse : (measured?.course ?? null);
      return { speed, course };
    },
  };
}
