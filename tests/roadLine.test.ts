import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { decodeShape, fetchRoadLine, readRoute, routeRequest } from '../src/lib/map/roadLine.ts';

/** The same encoding the server uses: 6 decimals, latitude first, each point relative to the last. */
function encode(points: [number, number][]): string {
  let out = '';
  const put = (delta: number) => {
    let v = delta < 0 ? ~(delta << 1) : delta << 1;
    while (v >= 32) {
      out += String.fromCharCode((32 | (v & 31)) + 63);
      v >>= 5;
    }
    out += String.fromCharCode(v + 63);
  };
  let lat = 0;
  let lng = 0;
  for (const [x, y] of points) {
    const a = Math.round(y * 1e6);
    const b = Math.round(x * 1e6);
    put(a - lat);
    put(b - lng);
    lat = a;
    lng = b;
  }
  return out;
}

const LINE: [number, number][] = [
  [121.053, 14.619],
  [121.0515, 14.6175],
  [121.036, 14.5995],
];
const clean = { has_highway: false, has_toll: false, has_ferry: false };

test('a route shape comes back as the same points, longitude first for the map', () => {
  assert.deepEqual(decodeShape(encode(LINE)), LINE);
});

test('a real answer gives the line', () => {
  assert.deepEqual(readRoute({ trip: { summary: clean, legs: [{ shape: encode(LINE) }] } }), LINE);
});

test('a route with an expressway, toll or ferry is refused, so riders get the straight arrow', () => {
  for (const bad of ['has_highway', 'has_toll', 'has_ferry']) {
    const answer = { trip: { summary: { ...clean, [bad]: true }, legs: [{ shape: encode(LINE) }] } };
    assert.equal(readRoute(answer), null, bad);
  }
});

test('anything unusable is no line, never a crash', () => {
  for (const bad of [null, {}, { trip: {} }, { trip: { summary: clean } }, { trip: { summary: clean, legs: [{ shape: 5 }] } }, { trip: { summary: clean, legs: [{ shape: encode([LINE[0]]) }] } }, { trip: { summary: clean, legs: [{ shape: '~' }] } }]) {
    assert.equal(readRoute(bad), null);
  }
});

test('the request asks for motorcycle mode and to stay off all three', () => {
  const r = routeRequest([121, 14.6], [121.1, 14.7]);
  assert.equal(r.costing, 'motorcycle');
  assert.deepEqual(r.costing_options.motorcycle, { use_highways: 0, use_tolls: 0, use_ferry: 0 });
  assert.deepEqual(r.locations[0], { lon: 121, lat: 14.6 });
});

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

test('requests name the app, and stay at least a second apart', async () => {
  const at: number[] = [];
  const agents: string[] = [];
  globalThis.fetch = (async (_url: string, init: { headers: Record<string, string> }) => {
    at.push(Date.now());
    agents.push(init.headers['User-Agent']);
    return { ok: true, json: async () => ({ trip: { summary: clean, legs: [{ shape: encode(LINE) }] } }) };
  }) as unknown as typeof fetch;
  const signal = new AbortController().signal;
  assert.deepEqual(await fetchRoadLine([121, 14.6], [121.1, 14.7], signal), LINE);
  await fetchRoadLine([121, 14.6], [121.1, 14.7], signal);
  assert.ok(at[1] - at[0] >= 990, `${at[1] - at[0]} ms apart`);
  assert.match(agents[0], /Ayoos/);
});

test('no connection, or a server error, is no line', async () => {
  const signal = new AbortController().signal;
  globalThis.fetch = (async () => {
    throw new Error('offline');
  }) as unknown as typeof fetch;
  assert.equal(await fetchRoadLine([121, 14.6], [121.1, 14.7], signal), null);
  globalThis.fetch = (async () => ({ ok: false })) as unknown as typeof fetch;
  assert.equal(await fetchRoadLine([121, 14.6], [121.1, 14.7], signal), null);
});

test('a tap cancelled before its turn never reaches the server', async () => {
  let asked = 0;
  globalThis.fetch = (async () => {
    asked += 1;
    return { ok: false };
  }) as unknown as typeof fetch;
  const c = new AbortController();
  const pending = fetchRoadLine([121, 14.6], [121.1, 14.7], c.signal);
  c.abort();
  assert.equal(await pending, null);
  assert.equal(asked, 0);
});
