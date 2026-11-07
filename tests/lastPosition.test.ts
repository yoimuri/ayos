import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseSaved, SAVE_EVERY_MS, shouldSave } from '../src/lib/location/lastPosition.ts';

const here = { lng: 121, lat: 14.6, at: 1_000_000 };
const later = (metresNorth: number, ms: number) => ({ lng: 121, lat: 14.6 + metresNorth / 111_320, at: here.at + ms });

test('the first good reading is saved', () => {
  assert.equal(shouldSave(null, here, 15, false), true);
});

test('a rough reading or a faked GPS position is never saved', () => {
  assert.equal(shouldSave(null, here, 300, false), false);
  assert.equal(shouldSave(null, here, null, false), false);
  assert.equal(shouldSave(null, here, 10, true), false);
});

test('riding saves about every 30 seconds, not on every reading', () => {
  assert.equal(shouldSave(here, later(500, 5_000), 10, false), false);
  assert.equal(shouldSave(here, later(500, SAVE_EVERY_MS), 10, false), true);
});

test('standing still saves nothing new, however long', () => {
  assert.equal(shouldSave(here, later(10, 3_600_000), 10, false), false);
});

test('what comes off the disk is checked', () => {
  assert.deepEqual(parseSaved(JSON.stringify(here)), here);
  for (const bad of [null, '', 'not json', '{}', '{"lng":"121","lat":14,"at":1}', '{"lng":500,"lat":14,"at":1}']) {
    assert.equal(parseSaved(bad), null, String(bad));
  }
});

test('only the one spot is kept: nothing beyond a position and a time survives', () => {
  const saved = parseSaved(JSON.stringify({ ...here, name: 'x', trail: [1, 2] }));
  assert.deepEqual(Object.keys(saved ?? {}).sort(), ['at', 'lat', 'lng']);
});
