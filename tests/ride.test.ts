import assert from 'node:assert/strict';
import { test } from 'node:test';

import { cleanRide, DEFAULT_RIDE, frameFor, sizeScale } from '../src/features/ride/catalog.ts';

test('the bike is seen from behind when the rider faces the way the map points', () => {
  assert.equal(frameFor(0, 0), 0);
  assert.equal(frameFor(90, 90), 0);
  /* Riding, the map turns with the rider: heading and bearing match, whatever the compass says. */
  assert.equal(frameFor(237, 237), 0);
});

test('turning right of the map picks the pictures clockwise, one every 15 degrees', () => {
  assert.equal(frameFor(15, 0), 1);
  assert.equal(frameFor(90, 0), 6);
  assert.equal(frameFor(180, 0), 12);
  assert.equal(frameFor(270, 0), 18);
});

test('angles wrap round, and the nearest picture wins', () => {
  assert.equal(frameFor(355, 0), 0);
  assert.equal(frameFor(352, 0), 23);
  assert.equal(frameFor(10, 350), 1);
  assert.equal(frameFor(7, 0), 0);
  assert.equal(frameFor(8, 0), 1);
});

test('no compass yet: the bike points up the screen', () => {
  assert.equal(frameFor(null, 120), 0);
});

test('a saved ride from an older version, or a removed option, falls back to the default', () => {
  assert.deepEqual(cleanRide(undefined), DEFAULT_RIDE);
  assert.deepEqual(cleanRide({ vehicle: 'underbone', paint: 'gold', size: 'l' }), { vehicle: 'underbone', paint: 'gold', size: 'l' });
  // @ts-expect-error: an id this build does not know
  assert.deepEqual(cleanRide({ vehicle: 'tricycle', paint: 'chrome', size: 'xl' }), DEFAULT_RIDE);
});

test('size M is the 1.2.0 size; S is smaller and L larger', () => {
  assert.equal(sizeScale('m'), 1);
  assert.ok(sizeScale('s') < 1);
  assert.ok(sizeScale('l') > 1);
});
