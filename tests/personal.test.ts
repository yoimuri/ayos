import assert from 'node:assert/strict';
import { test } from 'node:test';

import { MAX_RECENT, parsePersonal, pushRecent } from '../src/lib/personal/model.ts';

test('recently viewed: newest first, no duplicates, at most MAX_RECENT', () => {
  assert.deepEqual(pushRecent([], 'a'), ['a']);
  assert.deepEqual(pushRecent(['a', 'b', 'c'], 'c'), ['c', 'a', 'b']);
  const full = Array.from({ length: MAX_RECENT }, (_, i) => `s${i}`);
  const next = pushRecent(full, 'new');
  assert.equal(next.length, MAX_RECENT);
  assert.equal(next[0], 'new');
  assert.ok(!next.includes(`s${MAX_RECENT - 1}`));
});

test('a copy saved before recently viewed existed still loads, with an empty list', () => {
  const old = parsePersonal(JSON.stringify({ saved: ['a'], visited: [], ratings: {} }));
  assert.deepEqual(old.recent, []);
  assert.deepEqual(old.saved, ['a']);
  assert.deepEqual(parsePersonal(JSON.stringify({ recent: ['x', 3, 'y'] })).recent, ['x', 'y']);
});
