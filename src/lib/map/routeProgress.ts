/**
 * THE ROAD LINE WHILE RIDING (Clint, 7 Nov): it should behave like GPS. The part behind the bike goes
 * away, and missing a turn gets a new route. No voice, turn instructions or arrival time: the Directions
 * button hands those to Google Maps.
 *
 * Plain arithmetic, nothing here touches the phone, so tests/routeProgress.test.ts checks it, and it was
 * also ridden through real routes with simulated GPS wobble. `RealMap` feeds it each GPS reading and asks
 * the server for a new route when this says the rider has left the line.
 */

export type Point = [number, number];

export type RouteProgress = {
  shopId: string;
  line: Point[];
  /** Metres along the line at the start of each point. */
  upTo: number[];
  /** Best guess of how far along the line the rider is. It can wobble back a little. */
  along: number;
  /** How far along the drawn line starts. It only moves forward, so the line never grows back. */
  shown: number;
  /** What to draw: from the rider's spot on the line to the shop. */
  remaining: Point[];
  /** Where the rider was when this line was asked for. */
  from: Point;
  /** Readings in a row off the line. */
  offCount: number;
  /** Time to ask for a new route. */
  offRoute: boolean;
  /** Off the line and the server gave no new one: the map shows the straight arrow instead. */
  lost: boolean;
  arrived: boolean;
};

/** Further than this from the line counts as off it. About the width of a wide road plus GPS wander. */
export const OFF_ROUTE_M = 40;
/** Readings in a row before believing it: one wild GPS reading must not throw the route away. */
export const OFF_READINGS = 3;
/** How far along the line to look for the rider, ahead and behind. See `locate`. */
export const LOOK_AHEAD_M = 150;
export const LOOK_BEHIND_M = 80;
export const ARRIVED_M = 30;
/** A spot this much further along the line costs one metre more. See `locate`. */
const STAY_NEARBY = 0.2;
/** Smaller moves do not redraw the line: GPS wander would make it twitch. */
const MIN_REDRAW_M = 8;
/** How often a new route may be asked for while off the line. */
export const REROUTE_GAP_MS = 20_000;

const K = 111_320;

function metres(a: Point, b: Point): number {
  return Math.hypot((a[0] - b[0]) * K * Math.cos((a[1] * Math.PI) / 180), (a[1] - b[1]) * K);
}

/** The closest spot to `p` on the stretch from `a` to `b`, flat-ground arithmetic. */
function closestOn(a: Point, b: Point, p: Point): Point {
  const c = Math.cos((p[1] * Math.PI) / 180);
  const dx = (b[0] - a[0]) * c;
  const dy = b[1] - a[1];
  const len = dx * dx + dy * dy;
  if (len === 0) return a;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * c * dx + (p[1] - a[1]) * dy) / len));
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/**
 * Where the rider is on the line: near the last place, and preferring a spot close to it.
 *
 * NOT JUST THE CLOSEST ROAD. A route can double back: a U-turn on a divided road runs the line back past
 * itself about 20 m away (Clint's route at Luzon Avenue did), and side streets bend close to each other.
 * Taking the closest spot on one GPS wobble jumped the rider ahead, and with no way back they looked lost:
 * false re-routes on most simulated rides in slow traffic. So a spot further along has to be closer by
 * enough to be worth it, and looking a little way back lets a wrong guess correct itself.
 */
function locate(route: RouteProgress, rider: Point): { at: number; spot: Point; away: number; along: number } {
  const { line, upTo, along } = route;
  let best = { at: 0, spot: line[0], away: Infinity, along };
  let bestScore = Infinity;
  for (let i = 0; i < line.length - 1; i += 1) {
    if (upTo[i + 1] < along - LOOK_BEHIND_M) continue;
    if (upTo[i] > along + LOOK_AHEAD_M) break;
    const spot = closestOn(line[i], line[i + 1], rider);
    const away = metres(spot, rider);
    const here = upTo[i] + metres(line[i], spot);
    const score = away + STAY_NEARBY * Math.abs(here - along);
    if (score < bestScore) {
      bestScore = score;
      best = { at: i, spot, away, along: here };
    }
  }
  return best;
}

export function startRoute(shopId: string, line: Point[], rider: Point): RouteProgress {
  const upTo = [0];
  for (let i = 0; i < line.length - 1; i += 1) upTo.push(upTo[i] + metres(line[i], line[i + 1]));
  return { shopId, line, upTo, along: 0, shown: 0, remaining: line, from: rider, offCount: 0, offRoute: false, lost: false, arrived: false };
}

/** One GPS reading. `accuracyM` widens "on the line": a rough reading proves nothing. */
export function advanceRoute(route: RouteProgress, rider: Point, accuracyM: number | null): RouteProgress {
  if (route.arrived) return route;
  const here = locate(route, rider);
  if (here.away <= Math.max(OFF_ROUTE_M, accuracyM ?? 0)) {
    const ahead = here.along >= route.shown + MIN_REDRAW_M;
    const total = route.upTo[route.upTo.length - 1];
    return {
      ...route,
      along: here.along,
      shown: ahead ? here.along : route.shown,
      remaining: ahead ? [here.spot, ...route.line.slice(here.at + 1)] : route.remaining,
      offCount: 0,
      offRoute: false,
      lost: false,
      arrived: total - here.along <= ARRIVED_M,
    };
  }
  /*
    A rider indoors or down an alley can be far from the first road and not lost at all, so nothing
    counts until they have actually moved from where they asked.
  */
  if (metres(rider, route.from) < OFF_ROUTE_M) return route;
  const offCount = route.offCount + 1;
  return { ...route, offCount, offRoute: offCount >= OFF_READINGS };
}
