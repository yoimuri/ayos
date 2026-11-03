/**
 * WHERE AYOOS HAS SHOPS: Metro Manila, as a box [west, south, east, north].
 *
 * Taken from the surveyed data's own extent (lat 14.35-14.78, lng 120.93-121.13) with
 * roughly six kilometres of margin, so a rider standing at the outermost shop can still
 * pan far enough to see where they are going. The map is held inside it (`maxBounds`),
 * shades everything outside it, and a rider standing outside it is told so (index.tsx).
 *
 * Plain TypeScript, no imports: tests/coverage.test.ts runs it with `node --test`.
 */
export const METRO_MANILA: [number, number, number, number] = [120.87, 14.3, 121.19, 14.84];

/** True when [lng, lat] is inside the covered box. */
export function insideCoverage([lng, lat]: [number, number]): boolean {
  const [w, s, e, n] = METRO_MANILA;
  return lng >= w && lng <= e && lat >= s && lat <= n;
}
