import assert from 'node:assert/strict';
import { test } from 'node:test';

import { COURSE_HOLD_MS, courseIsFresh } from '../src/lib/location/course.ts';
import { createMotion } from '../src/lib/location/motion.ts';

test('a moving phone reports its direction of travel', () => {
  const m = createMotion();
  assert.equal(m.push({ lng: 121, lat: 14.6, accuracy: 8, timestamp: 0, speed: 8, heading: 135 }).course, 135);
  assert.equal(m.push({ lng: 121, lat: 14.6, accuracy: 8, timestamp: 1000, speed: 8, heading: 360 }).course, 0);
});

test('a slow or stopped phone has no usable course', () => {
  const m = createMotion();
  assert.equal(m.push({ lng: 121, lat: 14.6, accuracy: 8, timestamp: 0, speed: 1, heading: 135 }).course, null);
  /* Android reports bearing 0 with speed 0 when it has no bearing at all. */
  assert.equal(m.push({ lng: 121, lat: 14.6, accuracy: 8, timestamp: 1000, speed: 0, heading: 0 }).course, null);
});

test('the course keeps winning briefly after the bike stops', () => {
  assert.equal(courseIsFresh(1000, 1000 + COURSE_HOLD_MS - 1), true);
  assert.equal(courseIsFresh(1000, 1000 + COURSE_HOLD_MS), false);
  assert.equal(courseIsFresh(null, 5000), false);
});
