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
  /** Shops this rider opened lately, newest first, at most MAX_RECENT (see pushRecent). */
  recent: string[];
};

export const EMPTY_PERSONAL: PersonalData = { saved: [], visited: [], ratings: {}, recent: [] };

/**
 * RECENTLY VIEWED, as in Google Maps: the last few shops opened carry a "Recently viewed"
 * line on the map, so a rider can find again the shop they looked at a minute ago.
 * Ten is enough to cover one search session without tagging half the map.
 */
export const MAX_RECENT = 10;

/** Puts the id first, without a duplicate, and keeps only the newest MAX_RECENT. */
export function pushRecent(list: string[], id: string): string[] {
  return [id, ...list.filter((x) => x !== id)].slice(0, MAX_RECENT);
}

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
      recent: Array.isArray(v.recent) ? v.recent.filter((x) => typeof x === 'string').slice(0, MAX_RECENT) : [],
    };
  } catch {
    return EMPTY_PERSONAL;
  }
}
