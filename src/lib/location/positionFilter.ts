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
 *
 *   3. WHEN THE PHONE IS PROVABLY MOVING, DRAW EVERY READING. Rule 2 alone failed on a
 *      bike: at 30 km/h each reading lands about 8 m on, inside the noise threshold, so it
 *      was averaged with older readings and the dot dragged and stepped. Above walking
 *      pace every reading is drawn as it arrives. "Provably": indoors, signal bouncing off
 *      walls makes a STILL phone report brief bursts of 2.5-4 m/s, and trusting a single
 *      one made the dot jump to every raw reading (measured: a still phone's dot travelled
 *      about 1 km in 5 minutes). So it takes three fast readings in a row that also
 *      actually cover ground. A real ride passes that within three seconds.
 *
 *   4. A STILL PHONE DOES NOT SLIDE. The worst symptom: standing still, the dot drifts
 *      off in a slanted line, crosses buildings, and later snaps back. Two causes, both
 *      reproduced in tests/positionFilter.test.ts:
 *
 *      - The phone falls back to WiFi or cell-tower positions (+-45 m) that slide. They
 *        used to be averaged in, and once the last good satellite reading aged out of
 *        the 25 s window the dot followed them. Now, for 45 s after a good reading, a
 *        much worse one is ignored outright.
 *      - Signal bouncing off buildings makes the satellite position itself slide while
 *        still claiming +-10 m. Each new reading lands a metre or two from the last, so
 *        it never "disagrees" with the average; it is averaged in, and the average
 *        creeps along with it. But the phone's measured SPEED stays near zero. So while
 *        the phone says it is still, every reading is compared with WHERE IT STOPPED, not
 *        with the creeping average, and one that slides away from that spot is held back.
 *        Three safety valves, so a WRONG stopping spot cannot stick: a much better
 *        reading always wins; readings that sit STEADILY somewhere else for 10 s win (drift
 *        keeps sliding, a real position stays put, and that is the difference); and
 *        nothing is held back for more than 60 s.
 */

/**
 * About 9 km/h, the same line `course.ts` uses: above it the phone is genuinely moving
 * and its reported speed and direction can be trusted.
 */
export const MOVING_MPS = 2.5;
/** Rule 3 applies only to readings at least this good: satellite-grade, not WiFi. */
const MOVING_MAX_ACC_M = 30;
/** Fast readings in a row before rule 3 believes the phone is moving. */
const MOVING_RUN = 3;
/** ...and over those readings it must have covered at least this fraction of what the speed claims. */
const MOVING_PROOF = 0.4;
/**
 * Below this speed the phone is treated as still. Walking is about 1.4 m/s; a still phone
 * indoors commonly reports 0.5-1 m/s of pure noise.
 */
const STILL_MPS = 1.0;
/**
 * How far a still phone's reading may sit from where it stopped and still be averaged in.
 * Scaled by the estimate's uncertainty but capped: with +-45 m readings an uncapped margin
 * was about 54 m, which let vague readings drag the dot around a huge circle.
 */
const STILL_MARGIN_MIN_M = 10;
const STILL_MARGIN_MAX_M = 25;
/**
 * Readings at walking pace in a row before the stopping spot is forgotten. One is not
 * enough: indoor noise produces single readings of 1-1.5 m/s on a phone lying on a table.
 */
const WALK_RUN = 3;
/** Drift held back by rule 4 up to this far; beyond it, the normal rules decide. */
const DRIFT_LIMIT_M = 80;
/** Longest rule 4 holds the dot still against drift before giving the readings a say. */
const DRIFT_HOLD_MS = 60_000;
/** Held-back readings needed to judge whether they sit steadily somewhere else. */
const STEADY_COUNT = 10;
/** Over those readings, sliding less than this means steady, not drifting (0.3 m/s). */
const STEADY_SLIDE_M = 3;
/** A reading this good or better counts as "good" for rule 4. */
const GOOD_ACC_M = 25;
/** How long after a good reading much worse ones are ignored. */
const GOOD_HOLD_MS = 45_000;

/** How much worse than the last good reading counts as "much worse". */
function poorLimit(goodAccuracy: number) {
  return Math.max(goodAccuracy * 2, goodAccuracy + 20);
}

export type Sample = {
  lng: number;
  lat: number;
  /** Radius of uncertainty in metres. Null is treated as "poor but usable". */
  accuracy: number | null;
  timestamp: number;
  /** Metres per second as the phone reports it, or null when unknown. */
  speed?: number | null;
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
  /** The most recent good reading's accuracy and time (rule 4). */
  let lastGood: { accuracy: number; at: number } | null = null;
  /** Where the phone stopped, and since when (rule 4). Null while it is moving. */
  let anchor: { lng: number; lat: number; at: number } | null = null;
  /** Readings rule 4 has held back, most recent last, to spot a steady spot elsewhere. */
  let heldBack: Sample[] = [];
  /** The latest consecutive fast readings, for rule 3's proof of movement. */
  let fastRun: Sample[] = [];
  /** Consecutive readings above still speed, before the stopping spot is forgotten. */
  let walkRun = 0;

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
      lastGood = null;
      anchor = null;
      heldBack = [];
      fastRun = [];
      walkRun = 0;
    },

    push(s) {
      const a = acc(s);

      /*
        Rule 3: moving. Collect fast readings; once three in a row have actually covered
        ground, draw each one as it arrives, until the speed drops again.
      */
      const fast = s.speed != null && s.speed >= MOVING_MPS && a <= MOVING_MAX_ACC_M;
      if (fast) {
        fastRun.push(s);
        if (fastRun.length > MOVING_RUN) fastRun.shift();
      } else {
        fastRun = [];
      }
      const first = fastRun[0];
      const claimed = fastRun.length === MOVING_RUN
        ? fastRun.slice(1).reduce((sum, r, i) => sum + (r.speed ?? 0) * ((r.timestamp - fastRun[i].timestamp) / 1000), 0)
        : 0;
      const proven =
        fastRun.length === MOVING_RUN && metresBetween(first, s) >= claimed * MOVING_PROOF;
      if (proven) {
        window = [s];
        disagreeRun = 0;
        anchor = null;
        shown = { lng: s.lng, lat: s.lat, accuracy: a };
        lastGood = { accuracy: a, at: s.timestamp };
        return shown;
      }

      /* Rule 4a: a much worse reading soon after a good one is ignored. */
      if (
        shown &&
        lastGood &&
        s.timestamp - lastGood.at <= GOOD_HOLD_MS &&
        a > poorLimit(lastGood.accuracy)
      ) {
        return shown;
      }

      /*
        Rule 4b: the phone says it is still. Judge this reading against where it stopped.
      */
      const saysStill = s.speed != null && s.speed >= 0 && s.speed < STILL_MPS;
      walkRun = saysStill ? 0 : walkRun + 1;
      if (walkRun >= WALK_RUN) anchor = null;
      if ((saysStill || anchor) && shown) {
        const muchBetter = a <= GOOD_ACC_M && a * 2 <= shown.accuracy;
        if (!anchor || muchBetter || s.timestamp - anchor.at > DRIFT_HOLD_MS) {
          /* Start (or restart) judging from here. A much better reading resets the spot. */
          if (muchBetter) {
            window = [];
            disagreeRun = 0;
            shown = null;
          }
          anchor = { lng: s.lng, lat: s.lat, at: s.timestamp };
          if (shown) anchor = { lng: shown.lng, lat: shown.lat, at: s.timestamp };
        } else {
          const fromStop = metresBetween(anchor, s);
          const allowance = Math.min(
            Math.max(shown.accuracy * MOVE_FACTOR, STILL_MARGIN_MIN_M),
            STILL_MARGIN_MAX_M,
          );
          if (fromStop > allowance && fromStop <= DRIFT_LIMIT_M) {
            heldBack.push(s);
            if (heldBack.length > STEADY_COUNT) heldBack.shift();
            /*
              Steady somewhere else: the stopping spot was wrong, not the readings. Start
              over from them.
            */
            /*
              Only GOOD readings can prove a steady spot elsewhere. Vague (+-45 m) readings
              that happen to sit still are not evidence; they wait for the 60 s cap.
            */
            if (
              heldBack.length === STEADY_COUNT &&
              heldBack.every((h) => acc(h) <= GOOD_ACC_M) &&
              metresBetween(heldBack[0], heldBack[STEADY_COUNT - 1]) < STEADY_SLIDE_M
            ) {
              window = heldBack.slice();
              heldBack = [];
              disagreeRun = 0;
              shown = average();
              anchor = shown ? { lng: shown.lng, lat: shown.lat, at: s.timestamp } : null;
              return shown;
            }
            return shown;
          }
        }
      }
      heldBack = [];

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
      if (a <= GOOD_ACC_M) lastGood = { accuracy: a, at: s.timestamp };

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
