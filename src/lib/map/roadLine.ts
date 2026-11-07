/**
 * THE ROAD LINE, DEMO ONLY (Charls, 7 Nov): the roads from the rider to the selected shop, asked
 * for once per tap. Riders see the idea on about 5 phones; what production uses is decided later.
 *
 * THE SERVER is FOSSGIS's free public Valhalla, run by volunteers, on one machine they can switch
 * off at any time. Its rules (fossgis.de, read 7 Nov): one request a second, an app name on every
 * request, the OpenStreetMap credit with a report-an-error link (RealMap), a contact address (the
 * README), and no big commercial use. The rider's position goes to it on each tap, which is why the
 * location sentence on the welcome screen says so.
 *
 * WHEN THERE IS NO LINE, for any reason, this answers null and the map keeps the straight arrow.
 */

export const ROUTE_URL = 'https://valhalla1.openstreetmap.de/route';
const APP_SITE = 'https://github.com/yoimuri/ayos';
const MIN_GAP_MS = 1000;
const TIMEOUT_MS = 8000;

type Point = [number, number];

/**
 * Motorcycle mode, and as far from expressways, tolls and ferries as the server will go. On five
 * test routes through SLEX, NLEX, CAVITEX and the Skyway (7 Nov) this gave none of the three,
 * where the same routes without it took the expressway.
 */
export function routeRequest(from: Point, to: Point) {
  return {
    locations: [
      { lon: from[0], lat: from[1] },
      { lon: to[0], lat: to[1] },
    ],
    costing: 'motorcycle',
    costing_options: { motorcycle: { use_highways: 0, use_tolls: 0, use_ferry: 0 } },
    directions_type: 'none',
  };
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

let lastAskedAt = 0;

/** The road line for one tap. `signal` is how a newer tap cancels this one. */
export async function fetchRoadLine(from: Point, to: Point, signal: AbortSignal): Promise<Point[] | null> {
  const wait = lastAskedAt + MIN_GAP_MS - Date.now();
  if (wait > 0) await new Promise((done) => setTimeout(done, wait));
  if (signal.aborted) return null;
  lastAskedAt = Date.now();

  const stop = new AbortController();
  const onAbort = () => stop.abort();
  signal.addEventListener('abort', onAbort);
  const timer = setTimeout(onAbort, TIMEOUT_MS);
  try {
    const response = await fetch(ROUTE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': `Ayoos motorcycle shop finder demo (${APP_SITE})`,
        Referer: APP_SITE,
      },
      body: JSON.stringify(routeRequest(from, to)),
      signal: stop.signal,
    });
    return response.ok ? readRoute(await response.json()) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', onAbort);
  }
}
