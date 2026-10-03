import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createPositionFilter, metresBetween, type Sample } from '../src/lib/location/positionFilter.ts';

const M = 1 / 111_320;
const HOME = { lng: 121, lat: 14.6 };
/** A point `east` and `north` metres from HOME. */
const at = (east: number, north: number) => ({ lng: HOME.lng + east * M, lat: HOME.lat + north * M });

/** Feeds readings one per second and returns how far the drawn dot was from `truth` each time. */
function play(readings: Omit<Sample, 'timestamp'>[], truth: (i: number) => { lng: number; lat: number }) {
  const f = createPositionFilter();
  return readings.map((r, i) => {
    const out = f.push({ ...r, timestamp: i * 1000 });
    return out ? metresBetween(out, truth(i)) : Infinity;
  });
}

test('regression: a moving bike is drawn at every reading once movement is proven', () => {
  /* 30 km/h north: 8.3 m a second. The first two readings are the proof of movement. */
  const readings = Array.from({ length: 10 }, (_, i) => ({ ...at(0, i * 8.3), accuracy: 10, speed: 8.3 }));
  const miss = play(readings, (i) => at(0, i * 8.3));
  assert.ok(Math.max(...miss.slice(2)) < 0.01, `behind by ${miss.map(Math.round)}`);
  assert.ok(Math.max(...miss) < 20, 'at most two readings of lag while pulling away');
});

test('regression: fake indoor speed bursts do not make a still dot jump', () => {
  /* Still phone; every 4th reading claims 3 m/s, and the readings jitter +-8 m. */
  const jitter = [5, -7, 3, 8, -4, -8, 6, -2];
  const readings = Array.from({ length: 60 }, (_, i) => ({
    ...at(jitter[i % 8], jitter[(i + 3) % 8]),
    accuracy: 12,
    speed: i % 4 === 3 ? 3 : 0.3,
  }));
  const miss = play(readings, () => HOME);
  assert.ok(Math.max(...miss.slice(5)) < 10, `jumped ${Math.round(Math.max(...miss.slice(5)))} m`);
});

test('regression: standing still, WiFi positions sliding away do not move the dot', () => {
  /* 20 s of good satellite fixes, then 40 s of +-45 m positions sliding north-east. */
  const readings = [
    ...Array.from({ length: 20 }, () => ({ ...HOME, accuracy: 8, speed: 0 })),
    ...Array.from({ length: 40 }, (_, s) => ({ ...at(s * 1.06, s * 1.06), accuracy: 45, speed: 0 })),
  ];
  const miss = play(readings, () => HOME);
  assert.ok(Math.max(...miss) < 5, `strayed ${Math.round(Math.max(...miss))} m`);
});

test('regression: standing still, satellite drift that claims +-10 m does not drag the dot', () => {
  const readings = [
    ...Array.from({ length: 20 }, () => ({ ...HOME, accuracy: 10, speed: 0 })),
    ...Array.from({ length: 40 }, (_, s) => ({ ...at(s * 1.06, s * 1.06), accuracy: 10, speed: 0.2 })),
  ];
  const miss = play(readings, () => HOME);
  assert.ok(Math.max(...miss) < 15, `strayed ${Math.round(Math.max(...miss))} m`);
});

test('walking still follows the rider', () => {
  /* 1.4 m/s north for 60 s with good fixes: must not be mistaken for drift. */
  const readings = Array.from({ length: 60 }, (_, i) => ({ ...at(0, i * 1.4), accuracy: 8, speed: 1.4 }));
  const miss = play(readings, (i) => at(0, i * 1.4));
  assert.ok(miss[miss.length - 1] < 15, `left ${Math.round(miss[miss.length - 1])} m behind`);
});

test('a wrong starting spot is corrected by much better readings', () => {
  /* First a +-40 m guess 40 m east, then good fixes at the real spot. */
  const readings = [
    { ...at(40, 0), accuracy: 40, speed: 0 },
    ...Array.from({ length: 10 }, () => ({ ...HOME, accuracy: 8, speed: 0 })),
  ];
  const miss = play(readings, () => HOME);
  assert.ok(miss[miss.length - 1] < 5, `stuck ${Math.round(miss[miss.length - 1])} m away`);
});

test('regression: a confident but wrong first spot lets go within 15 s, not 60', () => {
  /* Three +-15 m readings 45 m north, then the truth at +-10 m, phone standing still. */
  const readings = [
    ...Array.from({ length: 3 }, () => ({ ...at(0, 45), accuracy: 15, speed: 0 })),
    ...Array.from({ length: 30 }, () => ({ ...HOME, accuracy: 10, speed: 0 })),
  ];
  const miss = play(readings, () => HOME);
  const fixedBy = miss.findIndex((m, i) => i >= 3 && m < 5);
  assert.ok(fixedBy !== -1 && fixedBy - 3 <= 15, `still ${Math.round(miss[18])} m off after 15 s`);
});

test('a real move with only poor signal is followed, after a bounded wait', () => {
  /* Good fixes at HOME, then +-45 m readings 300 m away with no speed reported. */
  const readings = [
    ...Array.from({ length: 10 }, () => ({ ...HOME, accuracy: 8, speed: 0 })),
    ...Array.from({ length: 70 }, () => ({ ...at(300, 0), accuracy: 45, speed: 0 })),
  ];
  const miss = play(readings, () => at(300, 0));
  assert.ok(miss[miss.length - 1] < 50, 'eventually follows');
});

test('with no speed reported at all, real movement still breaks out after three readings', () => {
  const f = createPositionFilter();
  f.push({ ...HOME, accuracy: 10, timestamp: 0 });
  const far = { ...at(0, 200), accuracy: 10 };
  f.push({ ...far, timestamp: 1000 });
  f.push({ ...far, timestamp: 2000 });
  const out = f.push({ ...far, timestamp: 3000 })!;
  assert.ok(metresBetween(out, far) < 1);
});
