/**
 * WHEN IS THE FIRST FIX GOOD ENOUGH TO ACT ON?
 *
 * The first reading after the app opens is usually the worst one: a remembered fix, or a
 * WiFi-and-towers guess 60-150 m out, which the GPS then narrows over the next several
 * seconds. Flying the camera to that first guess shows the rider a confident map of the
 * wrong street, and then drifts.
 *
 * So the app says "finding your location" and holds the first camera move until either a
 * reading is inside `GOOD_FIX_M`, or `SETTLE_TIMEOUT_MS` has passed — at which point the
 * best reading so far is used, and the "rough fix" banner explains any remaining error.
 * The rider's dot is drawn the whole time; only the camera waits.
 *
 * WHAT THIS CANNOT FIX: the hardware. In dense streets and indoors a phone often never
 * gets below 30 m. That is why the wait is bounded and why nothing ever blocks on it.
 *
 * Plain TypeScript, no imports: tests/settle.test.ts runs it with `node --test`.
 */

/** About one side of a Metro Manila street. */
export const GOOD_FIX_M = 30;

/**
 * Long enough for a phone with a clear sky to settle; short enough that a rider indoors
 * is not left watching a banner. A fix with no mobile data at all can take 20-60 s;
 * past 15 s the banner changes to "rough fix", which is the honest description by then.
 */
export const SETTLE_TIMEOUT_MS = 15_000;

export function isGoodFix(accuracyM: number | null | undefined): boolean {
  return accuracyM != null && accuracyM <= GOOD_FIX_M;
}
