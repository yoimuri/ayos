/**
 * MY SHOPS: what one rider saved, visited and rated, kept on their own phone only.
 *
 * Personal on purpose: nobody else sees it, and it needs no account. It lives in
 * AsyncStorage (see store.tsx), so it survives app updates but not uninstalling.
 *
 * Plain TypeScript, no imports: tests/personal.test.ts runs it with `node --test`.
 */

/** The three things a rating scores, each 1-5 stars (half stars allowed). */
export type RatingParts = {
  /** Satisfaction with the repair or maintenance they did. */
  service: number;
  /** Whether the price charged was worth the service. */
  price: number;
  /** How the staff dealt with the rider's needs. */
  assistance: number;
};

export type MyRating = RatingParts & { at: number };

export type PersonalData = {
  saved: string[];
  visited: string[];
  /** Keyed by shop id: the rider's own rating of that shop. */
  ratings: Record<string, MyRating>;
};

export const EMPTY_PERSONAL: PersonalData = { saved: [], visited: [], ratings: {} };

/** Adds the id if it is missing, removes it if it is there. Never duplicates. */
export function toggleId(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

/**
 * The ONE number a shop shows: the average of the three parts, to one decimal.
 * Tapping a shop shows the three parts behind it.
 */
export function overall(r: RatingParts): number {
  return Math.round(((r.service + r.price + r.assistance) / 3) * 10) / 10;
}

/** All three parts given (each at least half a star): a rating can be sent. */
export function isComplete(r: Partial<RatingParts>): r is RatingParts {
  return [r.service, r.price, r.assistance].every((v) => typeof v === 'number' && v >= 0.5);
}

/**
 * Reads whatever was saved, tolerating a missing or damaged copy: anything unreadable
 * becomes empty rather than crashing the app on launch.
 */
export function parsePersonal(raw: string | null): PersonalData {
  if (!raw) return EMPTY_PERSONAL;
  try {
    const v = JSON.parse(raw) as Partial<PersonalData>;
    return {
      saved: Array.isArray(v.saved) ? v.saved.filter((x) => typeof x === 'string') : [],
      visited: Array.isArray(v.visited) ? v.visited.filter((x) => typeof x === 'string') : [],
      ratings: v.ratings && typeof v.ratings === 'object' ? v.ratings : {},
    };
  } catch {
    return EMPTY_PERSONAL;
  }
}
