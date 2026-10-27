import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  RESUME_IDLE_MS,
  bearingFor,
  busyUntil,
  checkResume,
  pauseAt,
  shouldFollow,
  type Pause,
} from '../src/lib/map/follow.ts';

const base = { following: true, busyUntil: 0, now: 10_000 };

test('follows when nothing else is moving the camera', () => {
  assert.equal(shouldFollow(base), true);
});

test('regression: a GPS reading during "zoom to me" must not cut the flight short', () => {
  /* The flight starts at t=10000 and lasts 800 ms; the fresh reading lands 120 ms in. */
  const until = busyUntil(10_000, 800);
  assert.equal(shouldFollow({ ...base, busyUntil: until, now: 10_120 }), false);
  /* Once it has landed, following resumes. */
  assert.equal(shouldFollow({ ...base, busyUntil: until, now: until }), true);
});

test('never follows while paused', () => {
  assert.equal(shouldFollow({ ...base, following: false }), false);
});

/** Feeds one reading a second from t=0; returns the second following came back, or null. */
function resumesAt(start: Pause, courses: (number | null)[]): number | null {
  let p = start;
  for (let i = 0; i < courses.length; i++) {
    const r = checkResume(p, courses[i], i * 1000);
    if (r.resume) return i;
    p = r.pause;
  }
  return null;
}

test('a turn brings following back: left, right or U-turn, confirmed on two readings', () => {
  const p = pauseAt(0, 0);
  assert.equal(resumesAt(p, [0, 0, 0, 0, 90, 90]), 5, 'right turn');
  assert.equal(resumesAt(p, [0, 0, 0, 0, 270, 270]), 5, 'left turn');
  assert.equal(resumesAt(p, [0, 0, 0, 0, 180, 180]), 5, 'U-turn');
  assert.equal(resumesAt(p, [0, 0, 0, 0, 90, 0, 0, 0]), null, 'one wobble is not a turn');
  assert.equal(resumesAt(p, [0, 0, 0, 0, 20, 25, 20, 25]), null, 'a gentle curve is not a turn');
});

test('riding straight, following comes back after a while without a touch', () => {
  const straight = Array.from({ length: 20 }, () => 90);
  assert.equal(resumesAt(pauseAt(0, 90), straight), RESUME_IDLE_MS / 1000);
});

test('never while stopped, and never right after a touch', () => {
  assert.equal(resumesAt(pauseAt(0, 0), Array.from({ length: 40 }, () => null)), null, 'parked rider browsing');
  assert.equal(resumesAt(pauseAt(0, 0), [90, 90, 90, 90]), 3, 'waits out the grace after the touch');
});

test('paused while stopped: the first direction ridden off in is the baseline', () => {
  assert.equal(resumesAt(pauseAt(0, null), [null, null, null, 0, 0, 0, 90, 90]), 7);
});

test('the map turns with the road while moving, holds at a light, then goes back to north', () => {
  assert.equal(bearingFor({ course: 120, lastMovingAt: 0, now: 0, current: 0 }), 120);
  assert.equal(bearingFor({ course: null, lastMovingAt: 0, now: 10_000, current: 120 }), 120);
  assert.equal(bearingFor({ course: null, lastMovingAt: 0, now: 25_000, current: 120 }), 0);
  assert.equal(bearingFor({ course: null, lastMovingAt: null, now: 0, current: 0 }), 0);
});
