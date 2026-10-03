/**
 * WHICH WAY IS THE RIDER GOING? Two answers, and which one to trust depends on speed.
 *
 * THE COMPASS reports where the phone's TOP EDGE points, and expo-location computes it
 * as though the phone lies flat (no `remapCoordinateSystem`). Held
 * upright, as people hold phones, or clipped to handlebars, it is noisy and can be
 * simply wrong. The proper fix needs `expo-sensors`, which is native and waits for the
 * 1.2.0 build.
 *
 * THE GPS COURSE is the direction the phone has actually been MOVING, worked out from
 * successive positions. It does not care how the phone is held at all. For a rider on a
 * moving bike it is the right answer; standing still it is meaningless.
 *
 * So: course while moving, compass while stopped. Plain TypeScript, no imports:
 * tests/course.test.ts runs it with `node --test`.
 */

/**
 * About 9 km/h. Below this, GPS course wanders (a walking pace or a stop at a light).
 * Also the guard against a quirk verified in expo-location's Android source
 * (`LocationResults.kt`): `heading` is filled from `location.bearing` without checking
 * that a bearing exists, so a phone with none reports 0, which would point the bike
 * north. A real speed means a real bearing.
 */
export const MOVING_MPS = 2.5;

/**
 * After the last moving fix, how long the compass stays ignored. Stopping at a light for
 * a few seconds should not swing the arrow to wherever the handlebar mount points.
 */
export const COURSE_HOLD_MS = 6000;

/** The direction of travel, 0-360, or null when the phone is not moving fast enough to know. */
export function courseIfMoving(speedMps: number | null | undefined, headingDeg: number | null | undefined): number | null {
  if (speedMps == null || headingDeg == null) return null;
  if (!Number.isFinite(speedMps) || !Number.isFinite(headingDeg)) return null;
  if (speedMps < MOVING_MPS || headingDeg < 0) return null;
  return headingDeg % 360;
}

/** True while a recent course should win over the compass. */
export function courseIsFresh(lastCourseAt: number | null, now: number): boolean {
  return lastCourseAt != null && now - lastCourseAt < COURSE_HOLD_MS;
}
