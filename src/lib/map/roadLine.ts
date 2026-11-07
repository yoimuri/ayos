/**
 * THE ROUTE SERVER, DEMO ONLY (Charls, 7 Nov): the road line to a selected shop, and real road
 * distances for Nearest shop. Riders see the idea on about 5 phones; what production uses is decided
 * later.
 *
 * THE SERVER is FOSSGIS's free public Valhalla, run by volunteers, on one machine they can switch
 * off at any time. Its rules (fossgis.de, read 7 Nov): one request a second, an app name on every
 * request, the OpenStreetMap credit with a report-an-error link (RealMap), a contact address (the
 * README), and no big commercial use. The rider's position goes to it on each request, which is why
 * the location sentence on the welcome screen says so.
 *
 * WHEN THERE IS NO ANSWER, for any reason, these give null: the map keeps the straight arrow, and
 * Nearest shop keeps its estimates.
 */

const SERVER = 'https://valhalla1.openstreetmap.de';
const APP_SITE = 'https://github.com/yoimuri/ayos';
const MIN_GAP_MS = 1000;
const TIMEOUT_MS = 8000;

type Point = [number, number];

/**
 * Motorcycle mode, and as far from expressways, tolls and ferries as the server will go. On five
 * test routes through SLEX, NLEX, CAVITEX and the Skyway (7 Nov) this gave none of the three,
 * where the same routes without it took the expressway.
 */
const MOTORCYCLE = {
  costing: 'motorcycle',
  costing_options: { motorcycle: { use_highways: 0, use_tolls: 0, use_ferry: 0 } },
};

const place = ([lon, lat]: Point) => ({ lon, lat });

/**
 * `heading`: the way the bike is going, degrees from north, so a route asked for while moving starts
 * that way when it can. On test routes the server took it and only sometimes changed the route, so a
 * route can still begin with a U-turn.
 */
export function routeRequest(from: Point, to: Point, heading: number | null = null) {
  const start = heading === null ? place(from) : { ...place(from), heading: Math.round(heading) };
  return { locations: [start, place(to)], ...MOTORCYCLE, directions_type: 'none' };
}

/** One request for many shops, so the one-a-second rule holds however many are asked about. */
export function distancesRequest(from: Point, to: Point[]) {
  return { sources: [place(from)], targets: to.map(place), ...MOTORCYCLE, units: 'km' };
}

/** Valhalla's route shape: an encoded polyline, 6 decimal places, latitude first. */
export function decodeShape(shape: string): Point[] {
  const out: Point[] = [];
  let at = 0;
  let lat = 0;
  let lng = 0;
  const next = () => {
    let shift = 0;
    let value = 0;
    let byte: number;
    do {
      if (at >= shape.length) throw new Error('cut off');
      byte = shape.charCodeAt(at) - 63;
      at += 1;
      value |= (byte & 31) << shift;
      shift += 5;
    } while (byte >= 32);
    return value & 1 ? ~(value >> 1) : value >> 1;
  };
  while (at < shape.length) {
    lat += next();
    lng += next();
    out.push([lng / 1e6, lat / 1e6]);
  }
  return out;
}

/**
 * The server's answer as [lng, lat] points, or null if there is nothing usable. "Avoid" is the
 * server's best effort, so a route it says uses an expressway, toll or ferry is refused here:
 * riders get the straight arrow rather than a line onto a road they may not be allowed on.
 */
export function readRoute(answer: unknown): Point[] | null {
  const trip = (answer as { trip?: { summary?: Record<string, unknown>; legs?: { shape?: unknown }[] } } | null)?.trip;
  const summary = trip?.summary;
  if (!summary || summary.has_highway || summary.has_toll || summary.has_ferry) return null;
  const shape = trip?.legs?.[0]?.shape;
  if (typeof shape !== 'string') return null;
  try {
    const points = decodeShape(shape);
    return points.length >= 2 ? points : null;
  } catch {
    return null;
  }
}

/** Road km per shop, in the order asked; null for a shop the server cannot reach by road. */
export function readDistances(answer: unknown, count: number): (number | null)[] | null {
  const row = (answer as { sources_to_targets?: unknown[][] } | null)?.sources_to_targets?.[0];
  if (!Array.isArray(row) || row.length !== count) return null;
  return row.map((cell) => {
    const km = (cell as { distance?: unknown } | null)?.distance;
    return typeof km === 'number' ? km : null;
  });
}

let lastAskedAt = 0;

async function ask(path: string, body: unknown, signal: AbortSignal): Promise<unknown> {
  const wait = lastAskedAt + MIN_GAP_MS - Date.now();
  if (wait > 0) await new Promise((done) => setTimeout(done, wait));
  /*
    A second request can wake from the same wait; going round again keeps them a second apart.
    Null, not a throw: a cancelled tap is an ordinary thing.
  */
  if (signal.aborted) return null;
  if (lastAskedAt + MIN_GAP_MS - Date.now() > 0) return ask(path, body, signal);
  lastAskedAt = Date.now();

  const stop = new AbortController();
  const onAbort = () => stop.abort();
  signal.addEventListener('abort', onAbort);
  const timer = setTimeout(onAbort, TIMEOUT_MS);
  try {
    const response = await fetch(SERVER + path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': `Ayoos motorcycle shop finder demo (${APP_SITE})`,
        Referer: APP_SITE,
      },
      body: JSON.stringify(body),
      signal: stop.signal,
    });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', onAbort);
  }
}

/** The road line for one tap. `signal` is how a newer tap cancels this one. */
export async function fetchRoadLine(from: Point, to: Point, signal: AbortSignal, heading: number | null = null): Promise<Point[] | null> {
  return readRoute(await ask('/route', routeRequest(from, to, heading), signal));
}

/** Real road km from the rider to each shop, with one request. */
export async function fetchRoadKm(from: Point, to: Point[], signal: AbortSignal): Promise<(number | null)[] | null> {
  if (to.length === 0) return null;
  return readDistances(await ask('/sources_to_targets', distancesRequest(from, to), signal), to.length);
}
