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
  /** Follow mode is on (not paused by the rider touching the map or opening a shop). */
  following: boolean;
  /** The camera is busy with a deliberate flight until this time. */
  busyUntil: number;
  now: number;
}): boolean {
  return s.following && s.now >= s.busyUntil;
}

/*
  PAUSED, AND COMING BACK BY ITSELF.

  Touching the map, opening a shop or picking a city pauses following: that rider wants
  to look somewhere else. On a motorcycle nobody should have to find a button to get the
  map back, so following resumes on its own when either:

    - the rider TURNS: the direction of travel has moved RESUME_TURN_DEG or more from
      where it was when they paused (or, if they were stopped then, from the first
      direction they rode off in), on TURN_CONFIRM readings in a row so one wobble of
      the GPS is not a turn. Left, right, a U-turn: all clear 35 degrees;
    - or RESUME_IDLE_MS pass without a touch while they are moving. A long straight road
      has no turn, and the map must not stay parked on wherever they last looked.

  Nothing resumes within TOUCH_GRACE_MS of a touch, and nothing resumes while the rider
  is stopped: a parked rider browsing the map is left alone.
*/
export const RESUME_TURN_DEG = 35;
export const TURN_CONFIRM = 2;
export const RESUME_IDLE_MS = 15_000;
export const TOUCH_GRACE_MS = 3_000;

export type Pause = {
  /** The last time a finger moved the map (or the pause began). */
  lastTouchAt: number;
  /** Direction of travel to measure a turn from; null until one is known. */
  baseCourse: number | null;
  /** Consecutive readings that disagree with `baseCourse` by a turn's worth. */
  turnRun: number;
};

export function pauseAt(now: number, course: number | null): Pause {
  return { lastTouchAt: now, baseCourse: course, turnRun: 0 };
}

/** Called with each new reading while paused. */
export function checkResume(p: Pause, course: number | null, now: number): { resume: boolean; pause: Pause } {
  if (course === null) return { resume: false, pause: { ...p, turnRun: 0 } };
  const base = p.baseCourse ?? course;
  const settled = now - p.lastTouchAt >= TOUCH_GRACE_MS;
  const turned = Math.abs((((course - base) % 360) + 540) % 360 - 180) >= RESUME_TURN_DEG;
  const turnRun = turned ? p.turnRun + 1 : 0;
  const resume = settled && (turnRun >= TURN_CONFIRM || now - p.lastTouchAt >= RESUME_IDLE_MS);
  return { resume, pause: { ...p, baseCourse: base, turnRun } };
}

/*
  WHICH WAY UP. While following a moving rider the map turns so the road ahead points up,
  like a satnav. Stopped, it keeps its last turn for PARKED_MS (a red light should not
  spin the map) and then eases back to north, which is how a map reads best when someone
  is browsing it.
*/
export const PARKED_MS = 20_000;

export function bearingFor(s: { course: number | null; lastMovingAt: number | null; now: number; current: number }): number {
  if (s.course !== null) return s.course;
  if (s.lastMovingAt !== null && s.now - s.lastMovingAt < PARKED_MS) return s.current;
  return 0;
}
