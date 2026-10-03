/**
 * RUN:  npm test     (Node's own test runner; nothing to install)
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { clockLabel, statusAt } from '../src/lib/data/hours.ts';

/* 30 Sep 2026 is a Wednesday (day 3). Local time, which is what the app uses. */
const at = (h: number, m = 0, day = 30) => new Date(2026, 8, day, h, m);

test('no hours collected is unknown, never open', () => {
  assert.deepEqual(statusAt(undefined, at(12)), { status: 'unknown' });
  assert.deepEqual(statusAt({ closed: [0] }, at(12)), { status: 'unknown' });
});

test('inside the hours is open, with the closing time', () => {
  assert.deepEqual(statusAt({ open: '09:00', close: '20:00' }, at(19, 59)), {
    status: 'open',
    until: '8 PM',
  });
});

test('before opening and at closing time is closed', () => {
  const h = { open: '09:00', close: '20:00' };
  assert.equal(statusAt(h, at(8, 59)).status, 'closed');
  assert.equal(statusAt(h, at(20, 0)).status, 'closed');
});

test('a closed day wins over the hours', () => {
  /* 27 Sep 2026 is a Sunday. */
  assert.equal(statusAt({ open: '09:00', close: '20:00', closed: [0] }, at(12, 0, 27)).status, 'closed');
  assert.equal(statusAt({ open: '09:00', close: '20:00', closed: [0] }, at(12)).status, 'open');
});

test('open 24 hours has no closing time to show', () => {
  assert.deepEqual(statusAt({ open: '00:00', close: '24:00' }, at(3)), { status: 'open' });
});

test('hours past midnight', () => {
  const h = { open: '18:00', close: '02:00' };
  assert.equal(statusAt(h, at(23)).status, 'open');
  assert.equal(statusAt(h, at(1)).status, 'open');
  assert.equal(statusAt(h, at(12)).status, 'closed');
});

test('clock labels read like a shop sign', () => {
  assert.equal(clockLabel('07:30'), '7:30 AM');
  assert.equal(clockLabel('12:00'), '12 PM');
  assert.equal(clockLabel('00:00'), '12 AM');
});
