/**
 * TILT-CORRECTED HEADING: which way the phone faces, however it is held (BACKLOG N9).
 *
 * The compass that expo-location provides works out where the phone's TOP EDGE points,
 * as if the phone lay flat. In an upright handlebar holder the top edge points at the sky,
 * so that answer shrinks to noise (about 2x the error at 60 degrees, 6x at 80). Google
 * Maps instead reads where the phone's BACK faces once it stands up.
 *
 * This does the same from the raw sensors:
 *   g  the accelerometer, which at rest reads "up" in the phone's own axes;
 *   e  the magnetometer, the Earth's field in the same axes.
 * East is e x g, north is g x east (Android's getRotationMatrix builds the same frame).
 * "Forward" is the level direction in the phone's top-to-back plane: (0, g.z, -g.y). It is
 * the top edge when the phone lies flat, the back when it stands upright, and level at every
 * angle in between, so one formula covers flat, tilted and upright.
 *
 * Returns MAGNETIC degrees (add declination for true north), or null when no direction is
 * meaningful: the phone on its side, or readings too weak to trust.
 *
 * Plain TypeScript, no imports: tests/tiltHeading.test.ts runs it with `node --test`.
 */
export type Vec3 = { x: number; y: number; z: number };

/** The phone on its side (top-to-back plane nearly level) gives no forward direction. */
const MIN_FORWARD = 0.35;

export function forwardHeading(g: Vec3, e: Vec3): number | null {
  const gn = Math.hypot(g.x, g.y, g.z);
  const en = Math.hypot(e.x, e.y, e.z);
  if (gn < 0.3 || en < 1) return null;
  const ax = g.x / gn;
  const ay = g.y / gn;
  const az = g.z / gn;
  /* east = e x up */
  let hx = e.y * az - e.z * ay;
  let hy = e.z * ax - e.x * az;
  let hz = e.x * ay - e.y * ax;
  const hn = Math.hypot(hx, hy, hz);
  /* Field nearly parallel to gravity (near a magnetic pole, or a magnet next to the phone). */
  if (hn < 0.1 * en) return null;
  hx /= hn;
  hy /= hn;
  hz /= hn;
  /* north = up x east */
  const my = az * hx - ax * hz;
  const mz = ax * hy - ay * hx;
  if (Math.hypot(ay, az) < MIN_FORWARD) return null;
  /* forward = (0, az, -ay); its east and north parts */
  const east = hy * az - hz * ay;
  const north = my * az - mz * ay;
  const deg = (Math.atan2(east, north) * 180) / Math.PI;
  return (deg + 360) % 360;
}

/** Eases a vector toward a new reading: sensor noise smoothed before the angle is taken. */
export function ease(prev: Vec3 | null, next: Vec3, k: number): Vec3 {
  if (!prev) return next;
  return { x: prev.x + (next.x - prev.x) * k, y: prev.y + (next.y - prev.y) * k, z: prev.z + (next.z - prev.z) * k };
}
