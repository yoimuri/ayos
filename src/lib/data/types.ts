import type { Area } from '@/lib/settings/store';

import type { Hours, OpenStatus } from './hours';

/**
 * The shape every screen draws a shop from.
 */

export type { OpenStatus };

export type ShopTag = 'dealer' | 'repair' | 'parts' | 'accessories';

/** A web page for the shop: its Facebook page, a Shopee store and so on. */
export type ShopLink = {
  /** What to call it on screen, from the address: "Facebook", "Shopee", or the site name. */
  label: string;
  url: string;
};

export type Shop = {
  id: string;
  name: string;
  address: string;
  /** The first number collected, which the Call button dials. Null when none was. */
  phone: string | null;
  /** Every number collected, in the order the sheet lists them. */
  phones: string[];
  tags: ShopTag[];
  /** Worked out from `hours` when the shop list is built. `unknown` when not collected. */
  status: OpenStatus;
  /** Closing time for "Open now · until 8 PM". Absent for all-day shops. */
  openUntil?: string;
  hours?: Hours;
  links: ShopLink[];
  /** Straight-line metres from wherever distance is being measured from. */
  distance_m: number;
  bearing: 'N' | 'S' | 'E' | 'W';
  lng: number;
  lat: number;
  /** Which part of Metro Manila. Drives what the rider sees after picking an area. */
  area: Area;
  ratingCount: number;
  /**
   * Average of CONFIRMED ratings, held as a column rather than averaged on read.
   * Spec section 5: never computed with AVG() at read time.
   * Null when there are too few ratings to show one (see lib/ratings/rules.ts).
   */
  ratingAvg: number | null;
  ratings: Review[];
};

/** One rider's rating. Always empty until ratings are stored. */
export type Review = {
  id: string;
  who: string;
  /** Half steps allowed: 4.5 is valid. */
  stars: number;
  body: string;
  when: string;
  photos: string[];
};
