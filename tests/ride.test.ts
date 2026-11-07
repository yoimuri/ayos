import assert from 'node:assert/strict';
import { test } from 'node:test';

import { cleanRide, DEFAULT_RIDE, frameFor, helmetKey, sameRide, sizeScale } from '../src/features/ride/catalog.ts';

test('the bike is seen from behind when the rider faces the way the map points', () => {
  assert.equal(frameFor(0, 0), 0);
  assert.equal(frameFor(90, 90), 0);
  /* Riding, the map turns with the rider: heading and bearing match, whatever the compass says. */
  assert.equal(frameFor(237, 237), 0);
});

test('turning right of the map picks the pictures clockwise, one every 45 degrees', () => {
  assert.equal(frameFor(45, 0), 1);
  assert.equal(frameFor(90, 0), 2);
  assert.equal(frameFor(180, 0), 4);
  assert.equal(frameFor(270, 0), 6);
});

test('angles wrap round, and the nearest picture wins', () => {
  assert.equal(frameFor(350, 0), 0);
  assert.equal(frameFor(330, 0), 7);
  assert.equal(frameFor(40, 350), 1);
  assert.equal(frameFor(22, 0), 0);
  assert.equal(frameFor(23, 0), 1);
});

test('no compass yet: the bike points up the screen', () => {
  assert.equal(frameFor(null, 120), 0);
});

test('a saved ride from an older version, or a removed option, falls back part by part', () => {
  assert.deepEqual(cleanRide(undefined), DEFAULT_RIDE);
  /* A 1.3.0 ride had only vehicle, paint and size: the parts come in as the defaults. */
  assert.deepEqual(cleanRide({ vehicle: 'underbone', paint: 'gold', size: 'l' }), {
    ...DEFAULT_RIDE,
    vehicle: 'underbone',
    paint: 'gold',
    size: 'l',
  });
  // @ts-expect-error: ids this build does not know
  const odd = cleanRide({ vehicle: 'tricycle', paint: 'chrome', size: 'xl', topbox: 'crate', addons: ['mdl', 'horn'] });
  assert.deepEqual(odd, { ...DEFAULT_RIDE, addons: ['mdl'] });
});

test('two rides are the same whatever order the add-ons were picked in', () => {
  const a = { ...DEFAULT_RIDE, addons: ['mdl', 'bar_cam'] as const };
  const b = { ...DEFAULT_RIDE, addons: ['bar_cam', 'mdl'] as const };
  assert.ok(sameRide({ ...a, addons: [...a.addons] }, { ...b, addons: [...b.addons] }));
  assert.ok(!sameRide(DEFAULT_RIDE, { ...DEFAULT_RIDE, pipe: 'jbt' }));
});

test('the helmet picture set: style and colour, or the bare head', () => {
  assert.equal(helmetKey({ helmet: 'nutshell', helmetColour: 'white' }), 'nutshell-white');
  assert.equal(helmetKey({ helmet: 'none', helmetColour: 'gold' }), 'none');
});

test('size M is the 1.2.0 size; S is smaller and L larger', () => {
  assert.equal(sizeScale('m'), 1);
  assert.ok(sizeScale('s') < 1);
  assert.ok(sizeScale('l') > 1);
});
