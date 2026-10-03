/**
 * Deciding whether a new position is actually an improvement on the one we have.
 *
 * WHY THIS IS NEEDED AT ALL. Android's fused provider does not hand out a steadily
 * improving stream of fixes. It mixes sources: a satellite fix accurate to 8 m can be
 * followed a second later by a WiFi or cell fix accurate to 200 m, because that is simply
 * the next thing that arrived. Taking every update as it comes means the newest reading
 * always wins, so a good fix gets thrown away for a bad one and the dot jumps to the
 * wrong street. Accepting everything was the bug; this is the gate that was missing.
 *
 * The shape of the rule is Android's own long-standing guidance for exactly this: trust a
 * newer fix when the old one has gone stale, trust a more accurate fix, and otherwise
 * refuse to trade away accuracy for freshness.
 */

/** Past this, the fix we are holding is old enough that almost anything beats it. */
const STALE_MS = 20_000;
/**
 * How much worse a new fix may be and still be accepted when it is merely newer.
 *
 * Not zero: accuracy figures fluctuate by a few metres between consecutive readings of
 * the same quality, and rejecting every one of those would freeze the dot in place while
 * the rider actually moves. Fifty metres is about the width of the road plus its
 * pavements — beyond that the reading is answering a different question.
 */
const TOLERABLE_WORSE_M = 50;

export type Fix = {
  /** Radius of uncertainty in metres. Null when the OS did not say. */
  accuracy: number | null;
  /** Milliseconds since epoch, from the OS. */
  timestamp: number;
};

export function isBetterFix(next: Fix, current: Fix | null, now: number): boolean {
  if (!current) return true;

  const age = next.timestamp - current.timestamp;

  /*
    The one we hold has gone stale. The rider has probably moved, so a fresh reading is
    worth more than an accurate memory of somewhere they no longer are.
  */
  if (now - current.timestamp > STALE_MS) return true;

  /* A reading older than the one we already have tells us nothing new. */
  if (age < 0) return false;

  /*
    No accuracy figure means no way to compare. Prefer the newer one rather than getting
    stuck on a fix that can never be beaten.
  */
  if (next.accuracy === null || current.accuracy === null) return true;

  const worseBy = next.accuracy - current.accuracy;

  /* Strictly better: always take it. */
  if (worseBy <= 0) return true;

  /*
    Worse, but only slightly, AND newer. This is the normal case while walking: successive
    satellite fixes wobble a few metres either way and the rider is genuinely moving.
  */
  if (worseBy <= TOLERABLE_WORSE_M && age > 0) return true;

  /*
    Significantly worse. This is the network fix arriving after a satellite one, and
    taking it is what puts the rider on the wrong street.
  */
  return false;
}
