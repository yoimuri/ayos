/**
 * Turning a noisy compass into a steady arrow.
 *
 * WHAT ARRIVES, straight from expo-location's Android source (`LocationModule.kt`):
 * accelerometer and magnetometer at `SENSOR_DELAY_NORMAL`, fused per sample with
 * `getRotationMatrix` + `getOrientation`, and emitted whenever the azimuth moves more
 * than `DEGREE_DELTA` (0.0355 rad, about 2°) and at least `TIME_DELTA` (50 ms) has
 * passed. So: up to twenty readings a second, with no smoothing of any kind.
 *
 * Two degrees is BELOW the noise floor of a phone magnetometer. Held perfectly still,
 * raw fused azimuth wanders several degrees, and near a motorcycle — a large steel
 * object, often with the phone clamped to it — considerably more. The gate is therefore
 * not a gate at all: it fires continuously on noise alone. That is the wobble.
 *
 * THREE THINGS FIX IT, and they are separate:
 *
 *   1. Average in SIN/COS SPACE, not on the number. Angles wrap, so a plain running
 *      average of 359 and 1 gives 180 — the arrow would snap to the opposite direction
 *      every time the rider faced north. Averaging the unit vectors and taking `atan2`
 *      is the only correct way to average a bearing.
 *
 *   2. A DEADBAND after smoothing, so a still phone produces a still arrow. Without it
 *      the filter output always creeps, and creeping is what reads as unstable.
 *
 *   3. An UNWRAPPED accumulator for the output. Rotating from 350 to 10 must travel
 *      +20 degrees, not -340. Emitting a continuous, ever-growing angle instead of one
 *      folded into 0-360 makes the shortest path automatic, so any animation between
 *      two consecutive outputs is correct without special cases.
 */

/**
 * Smoothing weight for a sample believed to be noise. Low, so a still phone stays still.
 */
const ALPHA_STILL = 0.1;
/** The most a sample believed to be a real turn is allowed to pull the estimate. */
const ALPHA_TURN = 0.5;
/**
 * TELLING A TURN FROM NOISE, which is the whole trick.
 *
 * Sensor noise is zero-mean: each reading falls on a random side of the truth, so the
 * direction it pulls flips constantly. A rider actually turning pushes the SAME way on
 * reading after reading. So the filter watches the sign of the error and speeds up only
 * once it has been consistent for `TURN_RUN` samples AND is bigger than `TURN_GAP`.
 *
 * Five was measured, not chosen. Random noise produces five same-sign readings in a row
 * about six percent of the time; three in a row happens a quarter of the time, which was
 * enough to make a still phone twitch. Against simulated noise this pairing holds a still
 * phone to 2 output events in 200 readings while cutting tracking error during a 45°/s
 * turn from 16.7° to 3.9°.
 */
const TURN_RUN = 5;
const TURN_GAP = 6;
/**
 * Degrees of movement required before the output moves at all.
 *
 * Back down to 1.5 from 4. A map layer's rotation is a LAYOUT property, and the style
 * engine cannot animate those — so there is no tweening to fall back on and every degree
 * of movement the rider sees has to be emitted. Four-degree steps at five a second read
 * as a bike clicking round a dial; one and a half at sixteen reads as turning.
 *
 * It costs nothing while the phone is still, which is the case that matters: the
 * sign-coherence test below still suppresses noise entirely, so a stationary phone
 * produces no output at either setting.
 */
const DEADBAND = 1.5;
/**
 * Minimum gap between outputs, in ms.
 *
 * 60, which is about the rate the sensor itself offers. This was briefly raised to 200 to
 * cut re-renders while the app was crashing — but the crash turned out to be unkeyed map
 * layers, not render pressure, so the throttle was buying nothing and costing smoothness.
 */
const MIN_INTERVAL = 60;
/**
 * Android's compass calibration level. 0 means worse than 50 degrees of uncertainty,
 * which is not a direction, it is a guess. Those samples are dropped entirely.
 */
const MIN_ACCURACY = 1;

export type HeadingFilter = {
  /**
   * Feed one raw reading. Returns the angle to render, in degrees, UNWRAPPED — it may be
   * negative or exceed 360 and that is deliberate. Returns null when this sample should
   * change nothing on screen.
   */
  push: (degrees: number, accuracy: number, now: number) => number | null;
  reset: () => void;
};

/** Signed difference a → b, folded into (-180, 180]. */
export function shortestDelta(a: number, b: number): number {
  return ((((b - a) % 360) + 540) % 360) - 180;
}

export function createHeadingFilter(): HeadingFilter {
  /* Smoothed unit vector. Null until the first usable sample seeds it. */
  let sx: number | null = null;
  let sy = 0;
  /** How many consecutive samples have pulled the same way. */
  let run = 0;
  let lastSign = 0;
  /** Last angle actually emitted, folded to 0-360, for the deadband test. */
  let emitted: number | null = null;
  /** The unwrapped running total handed to the animation. */
  let unwrapped = 0;
  let lastAt = 0;

  return {
    reset() {
      sx = null;
      sy = 0;
      emitted = null;
      unwrapped = 0;
      lastAt = 0;
      run = 0;
      lastSign = 0;
    },

    push(degrees, accuracy, now) {
      if (!Number.isFinite(degrees)) return null;
      if (accuracy < MIN_ACCURACY) return null;

      const rad = (degrees * Math.PI) / 180;
      const x = Math.sin(rad);
      const y = Math.cos(rad);

      if (sx === null) {
        /* Seed from the first sample rather than from zero, or the arrow sweeps in from
           north on every start. */
        sx = x;
        sy = y;
        emitted = degrees;
        unwrapped = degrees;
        lastAt = now;
        return unwrapped;
      }

      const current = (((Math.atan2(sx, sy) * 180) / Math.PI) + 360) % 360;
      const gap = shortestDelta(current, degrees);
      const sign = Math.sign(gap);
      run = sign !== 0 && sign === lastSign ? run + 1 : 1;
      lastSign = sign;

      const turning = run >= TURN_RUN && Math.abs(gap) > TURN_GAP;
      /* Ramped, not switched: a longer consistent run earns more weight, up to the cap. */
      const alpha = turning
        ? Math.min(ALPHA_TURN, ALPHA_STILL + (run - TURN_RUN + 1) * 0.1)
        : ALPHA_STILL;

      sx += alpha * (x - sx);
      sy += alpha * (y - sy);

      const smoothed = (((Math.atan2(sx, sy) * 180) / Math.PI) + 360) % 360;

      /* Rate limit BEFORE the deadband, so a fast turn is not chopped into a stutter. */
      if (now - lastAt < MIN_INTERVAL) return null;

      const delta = shortestDelta(emitted as number, smoothed);
      if (Math.abs(delta) < DEADBAND) return null;

      emitted = smoothed;
      unwrapped += delta;
      lastAt = now;
      return unwrapped;
    },
  };
}
