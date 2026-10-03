import assert from 'node:assert/strict';
import { test } from 'node:test';

import { GOOD_FIX_M, isGoodFix } from '../src/lib/location/settle.ts';

test('an unknown accuracy is never good enough', () => {
  assert.equal(isGoodFix(null), false);
  assert.equal(isGoodFix(undefined), false);
});

test('the threshold itself counts as good', () => {
  assert.equal(isGoodFix(GOOD_FIX_M), true);
  assert.equal(isGoodFix(GOOD_FIX_M + 0.1), false);
  assert.equal(isGoodFix(8), true);
});
