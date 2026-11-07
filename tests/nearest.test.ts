import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Shop } from '../src/lib/data/types.ts';
import { bearingTo } from '../src/lib/geo/distance.ts';
import { nearestRepair } from '../src/lib/nearby/nearestRepair.ts';

const shop = (id: string, distance_m: number, status: Shop['status'], phone: string | null, tags: Shop['tags'] = ['repair']) =>
  ({ id, distance_m, status, phone, tags }) as Shop;

test('the nearest open repair shop, and the nearest with unknown hours that can be phoned', () => {
  const r = nearestRepair([
    shop('far-open', 2000, 'open', '1'),
    shop('near-open', 600, 'open', '1'),
    shop('near-unknown', 1200, 'unknown', '2'),
    shop('far-unknown', 3000, 'unknown', '3'),
  ]);
  assert.equal(r.open?.id, 'near-open');
  assert.equal(r.unknown?.id, 'near-unknown');
});

test('a shop with unknown hours and no number is left out, however close', () => {
  const r = nearestRepair([shop('no-number', 100, 'unknown', null), shop('has-number', 900, 'unknown', '2')]);
  assert.equal(r.unknown?.id, 'has-number');
});

test('an open shop counts even with no number: the rider can just go there', () => {
  assert.equal(nearestRepair([shop('open', 500, 'open', null)]).open?.id, 'open');
});

test('closed shops and shops that do not repair never appear', () => {
  const r = nearestRepair([shop('closed', 10, 'closed', '1'), shop('parts', 20, 'open', '1', ['parts'])]);
  assert.deepEqual(r, { open: null, unknown: null });
});

test('the arrow: north is 0, and it goes round clockwise', () => {
  const here: [number, number] = [121, 14.6];
  const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 0.5, `${a} vs ${b}`);
  close(bearingTo(here, [121, 14.7]), 0);
  close(bearingTo(here, [121.1, 14.6]), 90);
  close(bearingTo(here, [121, 14.5]), 180);
  close(bearingTo(here, [120.9, 14.6]), 270);
});

test('the arrow allows for a degree of longitude being shorter than one of latitude', () => {
  /* Equal degrees each way is not 45 at this latitude: east is worth about 0.97 of north. */
  const b = bearingTo([121, 14.6], [121.1, 14.7]);
  assert.ok(b > 43 && b < 45, String(b));
});
