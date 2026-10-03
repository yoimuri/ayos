import assert from 'node:assert/strict';
import { test } from 'node:test';

import { busyUntil, shouldFollow } from '../src/lib/map/follow.ts';

const base = { following: true, hasFocus: false, busyUntil: 0, now: 10_000 };

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

test('never follows when switched off or while a shop is open', () => {
  assert.equal(shouldFollow({ ...base, following: false }), false);
  assert.equal(shouldFollow({ ...base, hasFocus: true }), false);
});
