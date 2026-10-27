/**
 * SHOP AHEAD: a heads-up when the rider is about to pass a shop. Not navigation: no
 * destination, no route, no tracking. Just "there is a shop on your left in 120 m".
 *
 * WHAT COUNTS AS AHEAD. Picture a corridor along the road in front of the rider:
 * AHEAD_M long and LATERAL_M either side of their line of travel. A shop inside it is
 * ahead. A shop behind them, or on a parallel street a block over, is not, which a plain
 * "within 150 m" circle would get wrong in both directions.
 *
 * WHY THE LIMITS. Some Metro Manila streets hold dozens of shops in one block. Alerting for
 * each would buzz without pause and get the alerts switched off. So:
 *   - only shops not known to be closed;
 *   - each shop alerts once, then not again for FORGET_MS;
 *   - at most one alert every ALERT_GAP_MS, and several shops ahead at once become ONE
 *     alert ("4 shops ahead");
 *   - only while moving (a course exists only above walking pace; see useLocationGate).
 *
 * Time comes from the GPS reading's own timestamp rather than the clock, so this is a
 * pure function of its inputs. Plain TypeScript, no imports: tests/ahead.test.ts runs it
 * with `node --test`.
 */

export const AHEAD_M = 150;
export const LATERAL_M = 35;
export const ALERT_GAP_MS = 45_000;
export const FORGET_MS = 30 * 60_000;
/** Closer to the line of travel than this, the shop is "ahead" rather than left or right. */
const CENTRE_M = 6;

export type Side = 'left' | 'right' | 'ahead';
export type Place = { id: string; lng: number; lat: number; status?: 'open' | 'closed' | 'unknown' };
export type AheadOf<T> = { shop: T; metres: number; side: Side };

/** Shops in the corridor in front of the rider, nearest first. */
export function shopsAhead<T extends Place>(rider: [number, number], course: number, shops: T[]): AheadOf<T>[] {
  const [lng0, lat0] = rider;
  const mPerDegLng = 111_320 * Math.cos((lat0 * Math.PI) / 180);
  const rad = (course * Math.PI) / 180;
  const sin = Math.sin(rad);
  const cos = Math.cos(rad);
  /* A cheap box first: nothing further than this in either axis can be in the corridor. */
  const reach = AHEAD_M + LATERAL_M;
  const out: AheadOf<T>[] = [];
  for (const shop of shops) {
    const north = (shop.lat - lat0) * 111_320;
    if (Math.abs(north) > reach) continue;
    const east = (shop.lng - lng0) * mPerDegLng;
    if (Math.abs(east) > reach) continue;
    const along = east * sin + north * cos;
    const across = east * cos - north * sin;
    if (along <= 0 || along > AHEAD_M || Math.abs(across) > LATERAL_M) continue;
    const side: Side = Math.abs(across) < CENTRE_M ? 'ahead' : across > 0 ? 'right' : 'left';
    out.push({ shop, metres: Math.round(along), side });
  }
  return out.sort((a, b) => a.metres - b.metres);
}

export type AlertMemory = {
  /** Shop id -> when it last alerted. */
  alerted: Record<string, number>;
  /** When the last alert went off, or null. */
  lastAt: number | null;
};

export const NO_ALERTS: AlertMemory = { alerted: {}, lastAt: null };

/** One step per GPS reading: the alert to show now (or null), and what to remember. */
export function nextAlert<T extends Place>(
  memory: AlertMemory,
  input: { rider: [number, number]; course: number | null; at: number; shops: T[] },
): { memory: AlertMemory; alert: AheadOf<T>[] | null } {
  if (input.course === null) return { memory, alert: null };
  if (memory.lastAt !== null && input.at - memory.lastAt < ALERT_GAP_MS) return { memory, alert: null };
  const fresh = shopsAhead(input.rider, input.course, input.shops).filter(
    (a) =>
      a.shop.status !== 'closed' &&
      !(memory.alerted[a.shop.id] !== undefined && input.at - memory.alerted[a.shop.id] < FORGET_MS),
  );
  if (fresh.length === 0) return { memory, alert: null };
  const alerted = { ...memory.alerted };
  for (const a of fresh) alerted[a.shop.id] = input.at;
  return { memory: { alerted, lastAt: input.at }, alert: fresh };
}
