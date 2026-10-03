import type { Shop } from '@/lib/data/types';
import type { Area } from '@/lib/settings/store';

/**
 * Distance and radius rules, shared by every screen that shows or filters by distance.
 */

/**
 * DETOUR FACTOR.
 *
 * Roads bend, so the distance a rider actually travels is always longer than the
 * straight line between two points. The ratio between the two is called circuity, and
 * in a dense city grid it sits somewhere around 1.2 to 1.4. 1.3 is the middle of that.
 *
 * This is an ASSUMED constant, not a measured one. The honest version is a routing
 * engine answering "how far along actual streets". Until that
 * exists, this gets the displayed number closer to the truth than a straight line does,
 * and everything that shows it marks it approximate so it is never read as exact.
 */
export const DETOUR_FACTOR = 1.3;

/**
 * Straight-line metres in, approximate ROAD metres out.
 *
 * One function, used for BOTH the radius filter and the displayed number, so a shop can
 * never pass a "within 1 km" filter and then render as 1.04 km.
 */
export function roadDistance(metres: number): number {
  return metres * DETOUR_FACTOR;
}

/**
 * Always kilometres, two decimals, always marked approximate by the caller.
 * Never rounds below 0.01, because "0.00 km away" reads as broken.
 */
export function splitDistance(metres: number): { value: string; unit: 'km' } {
  const km = roadDistance(metres) / 1000;
  return { value: (km < 0.01 ? 0.01 : km).toFixed(2), unit: 'km' };
}

/**
 * Shops for the rider's chosen area and radius, nearest first.
 *
 * `from` is where the radius is measured from: the rider, or the picked city's busiest
 * square kilometre (see `hubOf` in app/index.tsx). With no
 * area chosen, everything is returned — a rider who skipped the question should see more
 * shops, not none.
 */
export function shopsForArea(
  all: Shop[],
  area: Area | null,
  radiusM?: number | null,
  from?: [number, number] | null,
): Shop[] {
  let pool = area ? all.filter((shop) => shop.area === area) : all;
  /*
    A null radius means "no limit", which is what the All chip selects. Otherwise filter
    on the SAME road estimate the list displays, so the circle drawn on the map and the
    rows in the list always agree about which shops are inside it.
  */
  if (radiusM != null) {
    pool = pool.filter((shop) => {
      const straight = from
        ? Math.hypot(
            (shop.lng - from[0]) * 111320 * Math.cos((from[1] * Math.PI) / 180),
            (shop.lat - from[1]) * 111320,
          )
        : shop.distance_m;
      return roadDistance(straight) <= radiusM;
    });
  }
  /* Copy before sorting: .sort() rewrites the array it is given. */
  return [...pool].sort((a, b) => a.distance_m - b.distance_m);
}

/** The radii a rider can pick. `null` is no limit. */
export const RADIUS_OPTIONS: { label: string; value: number | null }[] = [
  { label: '1 km', value: 1000 },
  { label: '2 km', value: 2000 },
  { label: '5 km', value: 5000 },
  /*
    Measured from a city's own centre, the furthest shop assigned to it is 18 km away and
    the median city needs about 9 km, so there had to be a step between 5 km and no limit.
  */
  { label: '10 km', value: 10000 },
  { label: 'All', value: null },
];
