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
 * So: course while moving, compass while stopped. The course itself (the phone's own
 * bearing when real, otherwise measured from the track) comes from motion.ts; this file
 * only decides how long it keeps beating the compass. Plain TypeScript, no imports:
 * tests/course.test.ts runs it with `node --test`.
 */

/**
 * After the last moving fix, how long the compass stays ignored. Stopping at a light for
 * a few seconds should not swing the arrow to wherever the handlebar mount points.
 */
export const COURSE_HOLD_MS = 6000;

/** True while a recent course should win over the compass. */
export function courseIsFresh(lastCourseAt: number | null, now: number): boolean {
  return lastCourseAt != null && now - lastCourseAt < COURSE_HOLD_MS;
}
