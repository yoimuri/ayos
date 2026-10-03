/**
 * Holding the dot still when the phone cannot tell you where it is.
 *
 * THE PROBLEM IS THE PLACE, NOT THE CODE. In dense low-rise streets the phone sees few
 * satellites directly and a lot of signal bounced off roofs and walls, so every fix
 * carries 60 to 90 metres of uncertainty. Google Maps, on the same phone in the same
 * street, drifts a block southwest and back within one minute. That is not a bug anyone
 * can fix — the information simply is not there.
 *
 * What IS fixable is what the app does with it. Two readings 40 m apart, each with 60 m
 * of uncertainty, are not evidence that the rider moved 40 m. They are the same reading
 * with different noise. Drawing the dot at whichever arrived last turns unavoidable
 * uncertainty into visible jitter, and a dot that wanders while you stand still is worse
 * than a dot that is quietly 30 m off: the first tells you the app is lost, the second
 * lets you get on with finding a shop.
 *
 * SO, TWO RULES:
 *
 *   1. AVERAGE WHILE STILL. The random part of GPS error is roughly zero-mean, so
 *      averaging several fixes cancels some of it — genuinely more accurate than any
 *      single reading, not merely steadier. Weighted by 1/accuracy², so a confident fix
 *      counts for more than a vague one.
 *
 *   2. BREAK OUT ON REAL MOVEMENT. Averaging a rider who is actually moving would drag
 *      the dot along behind them. Movement is recognised the same way the compass filter
 *      recognises a turn: not by one big reading, which noise produces all the time, but
 *      by several consecutive readings that all agree the rider is somewhere new.
 */

export type Sample = {
  lng: number;
  lat: number;
  /** Radius of uncertainty in metres. Null is treated as "poor but usable". */
  accuracy: number | null;
  timestamp: number;
};

export type Fixed = { lng: number; lat: number; accuracy: number };

/** Samples older than this are no longer evidence of where the rider is now. */
const WINDOW_MS = 25_000;
/** More than this and the oldest stop contributing, so the average can still follow. */
const MAX_SAMPLES = 10;
/** Consecutive disagreeing readings before we accept that the rider has moved. */
const MOVE_RUN = 3;
/**
 * A reading must be this many times the current uncertainty away before it even counts
 * as disagreement. Inside that, it is noise by definition.
 */
const MOVE_FACTOR = 1.2;
/** Floor on uncertainty, so a wildly confident fix cannot make the threshold tiny. */
const MIN_ACCURACY_M = 8;
/** Used when the OS reports no accuracy at all. */
const ASSUMED_ACCURACY_M = 50;
/**
 * The drawn dot is not moved unless the estimate shifts by this fraction of its own
 * uncertainty. An estimate good to 30 m that moves 10 m has not learned anything worth
 * redrawing, and redrawing it anyway is the visible wandering.
 *
 * 0.6 measured best: against 70 m noise it cuts how far the dot travels while the rider
 * stands still from 2,869 m to 208 m, while still following a rider who walks. Higher
 * values park the dot harder but start lagging real movement.
 */
const REDRAW_FACTOR = 0.6;

/** Metres between two coordinates. Equirectangular; exact enough far below a kilometre. */
export function metresBetween(a: { lng: number; lat: number }, b: { lng: number; lat: number }) {
  const mPerDegLat = 111_320;
  const mPerDegLng = 111_320 * Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180);
  const dx = (b.lng - a.lng) * mPerDegLng;
  const dy = (b.lat - a.lat) * mPerDegLat;
  return Math.hypot(dx, dy);
}

export type PositionFilter = {
  /** Returns the position to draw, or null when nothing usable has arrived yet. */
  push: (s: Sample) => Fixed | null;
  reset: () => void;
};

export function createPositionFilter(): PositionFilter {
  let window: Sample[] = [];
  /** Consecutive samples that disagree with the current average. */
  let disagreeRun = 0;
  /** What the caller was last told to draw, so small changes can be withheld. */
  let shown: Fixed | null = null;

  const acc = (s: Sample) => Math.max(MIN_ACCURACY_M, s.accuracy ?? ASSUMED_ACCURACY_M);

  function average(): Fixed | null {
    if (window.length === 0) return null;
    let wSum = 0;
    let lng = 0;
    let lat = 0;
    for (const s of window) {
      /*
        Inverse VARIANCE, not inverse distance: a 10 m fix is a hundred times better
        evidence than a 100 m fix, not ten times. This is the standard way to combine
        measurements of different quality.
      */
      const w = 1 / (acc(s) * acc(s));
      wSum += w;
      lng += s.lng * w;
      lat += s.lat * w;
    }
    /*
      Combined uncertainty of a weighted mean. Reported so callers can still tell a good
      estimate from a poor one, even though several readings went into it.
    */
    return { lng: lng / wSum, lat: lat / wSum, accuracy: Math.sqrt(1 / wSum) };
  }

  return {
    reset() {
      window = [];
      disagreeRun = 0;
      shown = null;
    },

    push(s) {
      const now = s.timestamp;
      window = window.filter((w) => now - w.timestamp <= WINDOW_MS);

      const current = average();

      if (current) {
        const moved = metresBetween(current, s);
        const threshold = Math.max(current.accuracy, acc(s)) * MOVE_FACTOR;

        if (moved > threshold) {
          disagreeRun += 1;
          /*
            Enough readings in a row have insisted the rider is somewhere else. Throw the
            history away rather than letting the old position drag the average back — a
            rider who has walked down the street is not partly still where they were.
          */
          if (disagreeRun >= MOVE_RUN) {
            window = [s];
            disagreeRun = 0;
            shown = average();
            return shown;
          }
          /*
            Not yet convinced. Hold the average and do NOT add this sample: a single wild
            reading should not be allowed to pull the estimate toward itself while we wait
            to find out whether it was real.
          */
          return shown ?? current;
        }
        disagreeRun = 0;
      }

      window.push(s);
      if (window.length > MAX_SAMPLES) window.shift();

      const next = average();
      if (!next) return null;

      /*
        Withhold a redraw the estimate cannot justify. This is the same idea as the
        compass filter's deadband, and it is what actually stops the visible wandering:
        averaging alone still nudges the dot on every reading.
      */
      if (shown && metresBetween(shown, next) < next.accuracy * REDRAW_FACTOR) return shown;

      shown = next;
      return shown;
    },
  };
}
