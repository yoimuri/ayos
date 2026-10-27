import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ALERT_GAP_MS, FORGET_MS, NO_ALERTS, nextAlert, shopsAhead, type Place } from '../src/lib/nearby/ahead.ts';

const M = 1 / 111_320;
const RIDER: [number, number] = [121, 14.6];
/** A shop `east` and `north` metres from the rider. */
const shop = (id: string, east: number, north: number, status: Place['status'] = 'open'): Place => ({
  id,
  lng: RIDER[0] + (east * M) / Math.cos((RIDER[1] * Math.PI) / 180),
  lat: RIDER[1] + north * M,
  status,
});

test('ahead means in the corridor in front: not behind, not a parallel street', () => {
  const shops = [
    shop('front', 0, 100),
    shop('behind', 0, -50),
    shop('parallel', 80, 100),
    shop('far', 0, 400),
    shop('kerb-right', 15, 60),
    shop('kerb-left', -15, 120),
  ];
  const found = shopsAhead(RIDER, 0, shops); /* riding north */
  assert.deepEqual(
    found.map((a) => [a.shop.id, a.metres, a.side]),
    [['kerb-right', 60, 'right'], ['front', 100, 'ahead'], ['kerb-left', 120, 'left']],
  );
});

test('the corridor turns with the rider', () => {
  /* Riding east: the shop 100 m east is ahead, and one 15 m south of the road is on the right. */
  const found = shopsAhead(RIDER, 90, [shop('east', 100, 0), shop('south-side', 60, -15), shop('north', 0, 100)]);
  assert.deepEqual(found.map((a) => [a.shop.id, a.side]), [['south-side', 'right'], ['east', 'ahead']]);
});

test('alerts once per shop, never for closed shops, and groups shops ahead together', () => {
  const shops = [shop('a', 0, 50), shop('b', 10, 90), shop('shut', 0, 70, 'closed')];
  let r = nextAlert(NO_ALERTS, { rider: RIDER, course: 0, at: 0, shops });
  assert.deepEqual(r.alert!.map((a) => a.shop.id), ['a', 'b'], 'one alert for both, the closed one left out');

  /* Still ahead a minute later: already told, so nothing. */
  r = nextAlert(r.memory, { rider: RIDER, course: 0, at: ALERT_GAP_MS + 15_000, shops });
  assert.equal(r.alert, null);

  /* Back on the same road after half an hour: worth saying again. */
  r = nextAlert(r.memory, { rider: RIDER, course: 0, at: FORGET_MS + 1, shops });
  assert.equal(r.alert!.length, 2);
});

test('no more than one alert every 45 seconds, and none while stopped', () => {
  let r = nextAlert(NO_ALERTS, { rider: RIDER, course: 0, at: 0, shops: [shop('a', 0, 50)] });
  assert.ok(r.alert);
  r = nextAlert(r.memory, { rider: RIDER, course: 0, at: 10_000, shops: [shop('b', 0, 60)] });
  assert.equal(r.alert, null, 'too soon after the last one');
  r = nextAlert(r.memory, { rider: RIDER, course: 0, at: ALERT_GAP_MS + 1, shops: [shop('b', 0, 60)] });
  assert.deepEqual(r.alert!.map((a) => a.shop.id), ['b']);
  assert.equal(nextAlert(NO_ALERTS, { rider: RIDER, course: null, at: 0, shops: [shop('a', 0, 50)] }).alert, null);
});
