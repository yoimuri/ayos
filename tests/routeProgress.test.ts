import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ARRIVED_M, advanceRoute, OFF_READINGS, startRoute, type Point } from '../src/lib/map/routeProgress.ts';

/* A straight road north, then east. One degree of latitude is about 111 km: 0.001 is 111 m. */
const LINE: Point[] = [
  [121, 14.6],
  [121, 14.61],
  [121.01, 14.61],
];
const north = (m: number): Point => [121, 14.6 + m / 111_320];
const east = (m: number): Point => [121 + m / (111_320 * Math.cos((14.61 * Math.PI) / 180)), 14.61];
/* `off` metres to the side of the northward road. */
const beside = (m: number, off: number): Point => [121 + off / (111_320 * Math.cos((14.6 * Math.PI) / 180)), 14.6 + m / 111_320];

test('the line behind the bike goes away as it rides', () => {
  let r = startRoute('s', LINE, north(0));
  r = advanceRoute(r, north(300), 10);
  assert.ok(Math.abs(r.remaining[0][1] - north(300)[1]) < 1e-6, 'the line starts at the bike');
  assert.deepEqual(r.remaining.slice(1), LINE.slice(1));
  r = advanceRoute(r, north(800), 10);
  assert.ok(r.remaining[0][1] > north(790)[1]);
  assert.equal(r.offRoute, false);
});

test('GPS wander beside the road is not leaving the road', () => {
  let r = startRoute('s', LINE, north(0));
  for (const [m, off] of [[100, 20], [130, -25], [160, 30], [190, -35], [220, 15]]) r = advanceRoute(r, beside(m, off), 12);
  assert.equal(r.offRoute, false);
  assert.equal(r.offCount, 0);
});

test('one wild reading does not throw the route away, but staying off the line does', () => {
  let r = startRoute('s', LINE, north(0));
  r = advanceRoute(r, north(200), 10);
  r = advanceRoute(r, beside(220, 300), 10);
  assert.equal(r.offRoute, false);
  r = advanceRoute(r, north(240), 10);
  assert.equal(r.offCount, 0);
  for (let i = 0; i < OFF_READINGS; i += 1) r = advanceRoute(r, beside(260, 120 + i * 20), 10);
  assert.equal(r.offRoute, true);
});

test('a rough GPS reading proves nothing about leaving the line', () => {
  let r = startRoute('s', LINE, north(0));
  for (let i = 0; i < 6; i += 1) r = advanceRoute(r, beside(300, 80), 120);
  assert.equal(r.offRoute, false);
});

test('standing indoors far from the first road is not being lost', () => {
  const house = beside(0, 90);
  let r = startRoute('s', LINE, house);
  for (let i = 0; i < 10; i += 1) r = advanceRoute(r, house, 15);
  assert.equal(r.offRoute, false);
});

test('coming back to the line clears the off-route state', () => {
  let r = startRoute('s', LINE, north(0));
  for (let i = 0; i < OFF_READINGS; i += 1) r = advanceRoute(r, beside(120, 150), 10);
  assert.equal(r.offRoute, true);
  r = { ...r, lost: true };
  r = advanceRoute(r, north(130), 10);
  assert.equal(r.offRoute, false);
  assert.equal(r.lost, false);
});

test('a line that doubles back does not jump the bike past the U-turn', () => {
  /* North 600 m, a U-turn, back south 25 m to the side: the way a divided road routes. */
  const uTurn: Point[] = [north(0), north(600), beside(600, 25), beside(0, 25)];
  let r = startRoute('s', uTurn, north(0));
  /* Riding north with GPS leaning to the far side, right over the way back. */
  for (const m of [100, 200, 300]) {
    r = advanceRoute(r, beside(m, 25), 10);
    assert.ok(Math.abs(r.along - m) < 20, `still on the way out at ${m} m, at ${r.along}`);
  }
  assert.equal(r.remaining.length, 4, 'the way back is still ahead');
});

test('regression: a wobble ahead on a winding road does not leave the rider looking lost', () => {
  /* A street that bends back on itself. One reading leaning onto the later bend must not stick there. */
  const bends: Point[] = [north(0), north(200), beside(200, 60), beside(100, 60), beside(100, 120), beside(300, 120)];
  let r = startRoute('s', bends, north(0));
  r = advanceRoute(r, north(100), 10);
  r = advanceRoute(r, beside(120, 55), 10);
  for (const m of [130, 150, 170, 190]) {
    r = advanceRoute(r, north(m), 10);
    assert.equal(r.offCount, 0, `at ${m} m`);
  }
  assert.ok(Math.abs(r.along - 190) < 30, `believed at ${r.along}`);
});

test('the drawn line never grows back, even when a reading wobbles behind', () => {
  let r = startRoute('s', LINE, north(0));
  r = advanceRoute(r, north(500), 10);
  const before = r.remaining;
  r = advanceRoute(r, north(460), 10);
  assert.equal(r.remaining, before);
  assert.ok(r.along < 500, 'the best guess may move back');
});

/** Rides the example road a reading every 50 m, returning the state at the end. */
function ride(r: ReturnType<typeof startRoute>) {
  for (let m = 50; m <= 1100; m += 50) {
    r = advanceRoute(r, north(m), 10);
    assert.equal(r.offRoute, false, `north ${m}`);
  }
  for (let m = 50; m <= 1000; m += 50) {
    r = advanceRoute(r, east(m), 10);
    assert.equal(r.offCount, 0, `east ${m}`);
  }
  return r;
}

test('regression: turning off a long straight road onto the next one is not leaving the line', () => {
  /* The look-ahead used to count from the far-behind start of the stretch, so it never saw the corner. */
  let r = startRoute('s', LINE, north(0));
  for (let m = 100; m <= 1100; m += 100) r = advanceRoute(r, north(m), 10);
  for (const m of [20, 60, 100, 150]) {
    r = advanceRoute(r, east(m), 10);
    assert.equal(r.offCount, 0, `${m} m past the corner`);
  }
  assert.ok(r.along > 1200, 'believed past the corner');
});

test('arriving ends the line', () => {
  let r = ride(startRoute('s', LINE, north(0)));
  assert.equal(r.arrived, false);
  r = advanceRoute(r, east(1078 - ARRIVED_M / 2), 10);
  assert.equal(r.arrived, true);
  const after = advanceRoute(r, north(0), 10);
  assert.equal(after, r, 'nothing more happens after arriving');
});

test('tiny moves do not redraw the line', () => {
  let r = startRoute('s', LINE, north(0));
  r = advanceRoute(r, north(300), 10);
  const before = r.remaining;
  r = advanceRoute(r, north(303), 10);
  assert.equal(r.remaining, before);
  r = advanceRoute(r, north(320), 10);
  assert.notEqual(r.remaining, before);
});
