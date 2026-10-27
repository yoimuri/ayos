import assert from 'node:assert/strict';
import { test } from 'node:test';

import { angleBetween, bearing, createMotion } from '../src/lib/location/motion.ts';
import { createPositionFilter, metresBetween } from '../src/lib/location/positionFilter.ts';

const M = 1 / 111_320;
const HOME = { lng: 121, lat: 14.6 };
const at = (east: number, north = 0) => ({ lng: HOME.lng + east * M, lat: HOME.lat + north * M });

/**
 * The whole pipeline the app runs, one reading a second: motion (speed and course, measured
 * when the phone does not report them) feeding the position filter. Readings carry seeded
 * noise so a run is the same every time. Returns how far the drawn dot was from the truth,
 * after an 8 s warm-up.
 */
function ride(seconds: number, truth: (i: number) => { lng: number; lat: number }, accuracy: number, speed: number | null, noiseM: number) {
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 2;
  const motion = createMotion();
  const filter = createPositionFilter();
  const miss: number[] = [];
  for (let i = 0; i < seconds; i++) {
    const t = truth(i);
    const raw = { lng: t.lng + rnd() * noiseM * M, lat: t.lat + rnd() * noiseM * M, accuracy, timestamp: i * 1000, speed, heading: -1 };
    const m = motion.push(raw);
    const out = filter.push({ ...raw, speed: m.speed, course: m.course });
    miss.push(out ? metresBetween(out, t) : Infinity);
  }
  const tail = miss.slice(8);
  return { max: Math.max(...tail), avg: tail.reduce((a, b) => a + b, 0) / tail.length };
}

test('regression: a phone that reports speed 0 no longer leaves the dot 85 m behind a moving bike', () => {
  /* 36 km/h east. The old pipeline: average 17 m behind, worst 85 m. */
  const r = ride(60, (i) => at(i * 10), 15, 0, 8);
  assert.ok(r.max < 15 && r.avg < 8, `max ${r.max.toFixed(0)} m, avg ${r.avg.toFixed(1)} m`);
});

test('a phone that reports no speed at all tracks a ride as well', () => {
  const r = ride(60, (i) => at(i * 10), 15, null, 8);
  assert.ok(r.max < 15 && r.avg < 8, `max ${r.max.toFixed(0)} m, avg ${r.avg.toFixed(1)} m`);
});

test('regression: poor (40 m) GPS on the road follows within metres, not 90', () => {
  const r = ride(60, (i) => at(i * 10), 40, 0, 15);
  assert.ok(r.max < 25 && r.avg < 10, `max ${r.max.toFixed(0)} m, avg ${r.avg.toFixed(1)} m`);
});

test('a right turn does not leave the dot trailing', () => {
  const r = ride(60, (i) => (i < 30 ? at(0, i * 10) : at((i - 30) * 10, 300)), 15, null, 8);
  assert.ok(r.max < 15, `max ${r.max.toFixed(0)} m`);
});

test('a still phone is not mistaken for a moving one, even with no speed and noisy readings', () => {
  for (const [acc, noise] of [[15, 8], [15, 12], [40, 30]]) {
    const r = ride(120, () => HOME, acc, null, noise);
    assert.ok(r.max < 20, `${acc} m / +-${noise}: strayed ${r.max.toFixed(0)} m`);
  }
});

test('measured course points the way the rider is going; a still phone has none', () => {
  const m = createMotion();
  let last = { speed: null as number | null, course: null as number | null };
  for (let i = 0; i < 6; i++) last = m.push({ ...at(i * 8, i * 8), accuracy: 10, timestamp: i * 1000, speed: null });
  assert.ok(angleBetween(last.course!, 45) < 3, `course ${last.course}`);
  assert.ok(last.speed! > 10 && last.speed! < 12);

  const still = createMotion();
  for (let i = 0; i < 6; i++) last = still.push({ ...at(i % 2 ? 3 : -3), accuracy: 10, timestamp: i * 1000, speed: 0 });
  assert.equal(last.course, null);
});

test('bearings and angle differences wrap correctly', () => {
  assert.ok(Math.abs(bearing(HOME, at(0, 100))) < 0.01);
  assert.ok(Math.abs(bearing(HOME, at(100, 0)) - 90) < 0.01);
  assert.equal(angleBetween(350, 10), 20);
  assert.equal(angleBetween(90, 270), 180);
});
