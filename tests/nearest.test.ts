import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Shop, ShopTag } from '../src/lib/data/types.ts';
import { bearingTo } from '../src/lib/geo/distance.ts';
import { rankByRoad, shortlist } from '../src/lib/nearby/nearestShops.ts';

const shop = (id: string, distance_m: number, status: Shop['status'], phone: string | null, tags: ShopTag[] = ['repair']) =>
  ({ id, distance_m, status, phone, tags }) as Shop;
const ids = (list: { id: string }[]) => list.map((x) => x.id);

test('only the kind asked for: a parts search finds parts shops, a repair search does not', () => {
  const all = [shop('fixes', 100, 'open', '1'), shop('sells', 200, 'open', '1', ['parts']), shop('both', 300, 'open', '1', ['parts', 'repair'])];
  assert.deepEqual(ids(shortlist(all, 'repair')), ['fixes', 'both']);
  assert.deepEqual(ids(shortlist(all, 'parts')), ['sells', 'both']);
  assert.deepEqual(ids(shortlist(all, 'dealer')), []);
});

test('closed shops never count, and unknown hours only count with a phone number', () => {
  const all = [shop('closed', 10, 'closed', '1'), shop('no-number', 20, 'unknown', null), shop('has-number', 30, 'unknown', '2')];
  assert.deepEqual(ids(shortlist(all, 'repair')), ['has-number']);
});

test('an open shop counts even with no number: the rider can just go there', () => {
  assert.deepEqual(ids(shortlist([shop('open', 500, 'open', null)], 'repair')), ['open']);
});

test('the nearest open shop stays in the list however many closer shops have unknown hours', () => {
  const unknowns = Array.from({ length: 30 }, (_, i) => shop(`u${i}`, i * 10, 'unknown', '1'));
  const list = shortlist([...unknowns, shop('far-but-open', 9000, 'open', '1')], 'repair');
  assert.ok(ids(list).includes('far-but-open'));
  assert.equal(list.length, 10);
});

test('one request stays at 10 shops, keeping room for unknown ones when open ones are plenty', () => {
  const open = Array.from({ length: 20 }, (_, i) => shop(`o${i}`, i * 10, 'open', '1'));
  const unknown = Array.from({ length: 20 }, (_, i) => shop(`u${i}`, i * 10, 'unknown', '1'));
  const list = shortlist([...open, ...unknown], 'repair');
  assert.equal(list.length, 10);
  assert.equal(list.filter((x) => x.status === 'open').length, 8);
});

test('the screenshot bug: a shop 5 km away no longer shows ahead of open shops under 2 km', () => {
  /* Clint's phone at Luzon Avenue, 7 Nov: straight-line metres, then real road km from the route server. */
  const list = [
    shop('Motortrade', 147, 'open', '1'),
    shop('Chicas', 174, 'open', '1'),
    shop('D Best', 462, 'open', '1'),
    shop('RK', 523, 'open', '1'),
    shop('Charles WORKS', 1177, 'unknown', '1'),
  ];
  const shown = rankByRoad(list, [1.304, 1.944, 2.014, 1.781, 5.075]);
  assert.deepEqual(ids(shown.map((x) => x.shop)), ['Motortrade', 'RK', 'Chicas']);
  assert.equal(shown[1].roadKm, 1.781);
});

test('real roads can reverse the straight-line order', () => {
  const shown = rankByRoad([shop('looks-near', 100, 'open', '1'), shop('really-near', 500, 'open', '1')], [3, 0.8]);
  assert.deepEqual(ids(shown.map((x) => x.shop)), ['really-near', 'looks-near']);
});

test('unknown shops only fill what open shops leave', () => {
  const list = [shop('u-near', 10, 'unknown', '1'), shop('o-far', 900, 'open', '1'), shop('u-far', 20, 'unknown', '1')];
  assert.deepEqual(ids(rankByRoad(list, [0.1, 9, 0.2]).map((x) => x.shop)), ['o-far', 'u-near', 'u-far']);
});

test('with no answer from the server, the straight line decides and no road distance is claimed', () => {
  const shown = rankByRoad([shop('far', 900, 'open', '1'), shop('near', 100, 'open', '1')], null);
  assert.deepEqual(ids(shown.map((x) => x.shop)), ['near', 'far']);
  assert.equal(shown[0].roadKm, null);
});

test('a shop the server cannot reach by road goes last', () => {
  const shown = rankByRoad([shop('cut-off', 10, 'open', '1'), shop('reachable', 500, 'open', '1')], [null, 2]);
  assert.deepEqual(ids(shown.map((x) => x.shop)), ['reachable', 'cut-off']);
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
