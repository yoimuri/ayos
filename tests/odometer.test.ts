import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  addFix,
  EMPTY_ODOMETER,
  endRide,
  formatKm,
  parseOdometer,
  parseReading,
  reading,
  setReading,
  startRide,
  type Fix,
} from '../src/lib/odometer/model.ts';

/* Moving north: 0.0001 degrees of latitude is about 11 m. */
const at = (metresNorth: number, seconds: number, accuracyM: number | null = 8): Fix => ({
  lng: 121,
  lat: 14.6 + metresNorth / 111_320,
  at: seconds * 1000,
  accuracyM,
});

function ride(fixes: Fix[]): number {
  let from: Fix | null = null;
  let km = 0;
  for (const f of fixes) {
    const r = addFix(from, f);
    from = r.from;
    km += r.km;
  }
  return km;
}

test('a steady ride adds up to the distance ridden', () => {
  const fixes = Array.from({ length: 101 }, (_, i) => at(i * 10, i));
  assert.ok(Math.abs(ride(fixes) - 1) < 0.03);
});

test('a parked phone wandering around one spot counts nothing', () => {
  const wander = [0, 12, -8, 15, -14, 6, 18, -5, 9, -18, 3].map((m, i) => at(m, i * 5));
  assert.equal(ride(wander), 0);
});

test('crawling in traffic still counts in full', () => {
  const crawl = Array.from({ length: 201 }, (_, i) => at(i * 2, i));
  assert.ok(Math.abs(ride(crawl) - 0.4) < 0.03);
});

test('a jump no rider could make is not counted, and counting carries on from there', () => {
  assert.equal(ride([at(0, 0), at(5000, 2)]), 0);
  const km = ride([at(0, 0), at(5000, 2), at(5100, 12)]);
  assert.ok(Math.abs(km - 0.1) < 0.01);
});

test('a very rough reading is skipped', () => {
  assert.equal(ride([at(0, 0), at(500, 60, 200)]), 0);
});

test('a gap with a believable speed counts as the straight line between its ends', () => {
  /* Screen off for ten minutes, 5 km further on: comes out low if the road bent, never high. */
  assert.ok(Math.abs(ride([at(0, 0), at(5000, 600)]) - 5) < 0.01);
});

test('Start and End move a ride into the total; typing a reading restarts the count from it', () => {
  let d = startRide(EMPTY_ODOMETER, 1000);
  assert.equal(reading(d), null);
  d = { ...d, ride: { startedAt: 1000, km: 12.5 } };
  d = endRide(d);
  assert.equal(d.ride, null);
  assert.equal(d.lastRideKm, 12.5);
  assert.equal(d.countedKm, 12.5);
  d = setReading(d, 15000);
  assert.equal(reading(d), 15000);
  d = { ...startRide(d, 2000), ride: { startedAt: 2000, km: 3 } };
  assert.equal(reading(d), 15003);
});

test('pressing Start twice does not lose a ride', () => {
  const d = { ...EMPTY_ODOMETER, ride: { startedAt: 1, km: 4 } };
  assert.deepEqual(startRide(d, 99).ride, { startedAt: 1, km: 4 });
});

test('a typed reading is digits and one decimal point, and commas are forgiven', () => {
  assert.equal(parseReading('15,230'), 15230);
  assert.equal(parseReading(' 88.5 '), 88.5);
  for (const bad of ['', '-5', 'abc', '1.2.3', '99999999']) assert.equal(parseReading(bad), null, bad);
});

test('what comes off the disk is checked, and no position is ever part of it', () => {
  assert.deepEqual(parseOdometer(null), EMPTY_ODOMETER);
  assert.deepEqual(parseOdometer('not json'), EMPTY_ODOMETER);
  assert.deepEqual(parseOdometer('{"typedKm":-4,"countedKm":"x"}'), EMPTY_ODOMETER);
  const kept = parseOdometer('{"typedKm":100,"countedKm":2,"ride":{"startedAt":5,"km":1,"lat":14},"lastRideKm":3}');
  assert.deepEqual(kept, { typedKm: 100, countedKm: 2, ride: { startedAt: 5, km: 1 }, lastRideKm: 3 });
});

test('kilometres read the same on every phone', () => {
  assert.equal(formatKm(1234.56), '1,234.6');
  assert.equal(formatKm(15230, 0), '15,230');
});
