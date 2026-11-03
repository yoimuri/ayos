import assert from 'node:assert/strict';
import { test } from 'node:test';

import { insideCoverage } from '../src/lib/geo/coverage.ts';

test('inside Metro Manila, and outside it', () => {
  assert.equal(insideCoverage([121.0437, 14.676]), true); // Quezon City
  assert.equal(insideCoverage([120.9842, 14.5995]), true); // Manila
  assert.equal(insideCoverage([121.0244, 14.4081]), true); // Muntinlupa
  assert.equal(insideCoverage([121.1748, 14.1877]), false); // Calamba, Laguna
  assert.equal(insideCoverage([120.5931, 15.1394]), false); // Angeles, Pampanga
  assert.equal(insideCoverage([123.8854, 10.3157]), false); // Cebu City
});
