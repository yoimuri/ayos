import assert from 'node:assert/strict';
import { test } from 'node:test';

import { forwardHeading, type Vec3 } from '../src/lib/location/tiltHeading.ts';

/* The Earth's field near Manila, roughly: northward and a little downward (east, north, up). */
const FIELD = { x: 0, y: 38, z: -12 };
const UP = { x: 0, y: 0, z: 1 };
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const rad = (d: number) => (d * Math.PI) / 180;

/**
 * What the sensors read on a phone facing `heading` (degrees from north), tilted `tilt`
 * degrees from lying flat (0) to standing upright in a holder (90), screen toward the rider.
 */
function readings(heading: number, tilt: number) {
  const h = rad(heading);
  const t = rad(tilt);
  const fwd = { x: Math.sin(h), y: Math.cos(h), z: 0 };
  const right = { x: Math.cos(h), y: -Math.sin(h), z: 0 };
  /* top edge: forward when flat, up when upright; screen normal: up when flat, toward the rider when upright */
  const top = { x: fwd.x * Math.cos(t), y: fwd.y * Math.cos(t), z: Math.sin(t) };
  const screen = { x: -fwd.x * Math.sin(t), y: -fwd.y * Math.sin(t), z: Math.cos(t) };
  const inPhone = (v: Vec3) => ({ x: dot(right, v), y: dot(top, v), z: dot(screen, v) });
  return { g: inPhone(UP), e: inPhone(FIELD) };
}

const near = (got: number | null, want: number) => {
  assert.notEqual(got, null);
  const d = Math.abs(((((got as number) - want) % 360) + 540) % 360 - 180);
  assert.ok(d < 0.5, `got ${got}, wanted ${want}`);
};

test('flat on a table: the direction of the top edge', () => {
  for (const h of [0, 45, 90, 180, 270, 333]) {
    const { g, e } = readings(h, 0);
    near(forwardHeading(g, e), h);
  }
});

test('upright in a handlebar holder: the direction the back faces', () => {
  for (const h of [0, 60, 135, 200, 315]) {
    const { g, e } = readings(h, 90);
    near(forwardHeading(g, e), h);
  }
});

test('tilted anywhere in between, the same answer', () => {
  for (const t of [20, 45, 60, 75, 85]) {
    const { g, e } = readings(110, t);
    near(forwardHeading(g, e), 110);
  }
});

test('on its side, or with no field, there is no direction', () => {
  assert.equal(forwardHeading({ x: 1, y: 0, z: 0.05 }, { x: 0, y: 30, z: -10 }), null);
  assert.equal(forwardHeading({ x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 0 }), null);
});
