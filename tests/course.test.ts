import assert from 'node:assert/strict';
import { test } from 'node:test';

import { COURSE_HOLD_MS, courseIfMoving, courseIsFresh } from '../src/lib/location/course.ts';

test('a moving phone reports its direction of travel', () => {
  assert.equal(courseIfMoving(8, 135), 135);
  assert.equal(courseIfMoving(8, 360), 0);
});

test('a slow or stopped phone has no usable course', () => {
  assert.equal(courseIfMoving(1, 135), null);
  /* Android reports bearing 0 with speed 0 when it has no bearing at all. */
  assert.equal(courseIfMoving(0, 0), null);
  assert.equal(courseIfMoving(null, 90), null);
  assert.equal(courseIfMoving(8, null), null);
});

test('the course keeps winning briefly after the bike stops', () => {
  assert.equal(courseIsFresh(1000, 1000 + COURSE_HOLD_MS - 1), true);
  assert.equal(courseIsFresh(1000, 1000 + COURSE_HOLD_MS), false);
  assert.equal(courseIsFresh(null, 5000), false);
});
