/**
 * INVENTED PLACEHOLDER DATA. NOT REAL SHOPS. DRAFT SCREEN ONLY.
 *
 * These records are fabricated. They are NOT part of the field-collected dataset and
 * must never be inserted into the database, exported, or merged with real shop rows.
 * The real shops were collected on foot, shop by shop, and are the co-founder's work.
 *
 * This file lives under `lib/dev/` rather than `lib/shops/` on purpose. `lib/shops/`
 * is reserved for code that handles real shop data, so nothing fabricated shares a
 * namespace with it and no import can confuse the two.
 *
 * Every record here is self-evidently fake: ids prefixed `sample-`, placeholder street
 * names, and numbers in an unassigned 0999-000-000X range that dial nowhere.
 *
 * Deleted at build step 4, when the local store begins holding real synced shops.
 *
 * The shape deliberately matches the `shops` table in
 * docs/MOTO_APP_BUILD_SPEC.md section 5, so swapping this array for the real local
 * store later is a change of data source, not a rewrite of the screen.
 */

/** The four tags a shop can carry. Spec section 5: dealer | repair | parts | accessories. */
export type ShopTag = 'dealer' | 'repair' | 'parts' | 'accessories';

/**
 * One shop as the app reads it.
 *
 * This is the client-side view, so it is a subset of the database row. Columns the
 * screen never shows (collected_at, photo_source, status) are left out on purpose:
 * the app should not carry fields it has no use for.
 */
export type Shop = {
  id: string;
  name: string;
  address: string;
  /** Null is honest. A shop with no known number still belongs on the list. */
  phone: string | null;
  tags: ShopTag[];
  /**
   * Metres from the rider.
   *
   * Hardcoded here. At build step 5 this becomes a computed value, because distance
   * depends on where the rider is standing and cannot be a stored property of a shop.
   */
  distance_m: number;
};

/**
 * Intentionally NOT in distance order.
 *
 * The screen sorts these itself. Leaving them shuffled here means that if the sort
 * ever breaks, the screen visibly shows the wrong order instead of accidentally
 * looking correct because the source array happened to be sorted.
 */
export const SAMPLE_SHOPS: Shop[] = [
  {
    id: 'sample-1',
    name: 'Sample Moto Works',
    address: '1 Placeholder Street, Sample Barangay',
    phone: '0999-000-0001',
    tags: ['repair', 'parts'],
    distance_m: 1240,
  },
  {
    id: 'sample-2',
    name: 'Placeholder Parts Center',
    address: '2 Placeholder Street, Sample Barangay',
    phone: '0999-000-0002',
    tags: ['parts', 'accessories'],
    distance_m: 320,
  },
  {
    id: 'sample-3',
    name: 'Example Motorcycle Dealer',
    address: '3 Placeholder Avenue, Sample Barangay',
    phone: '0999-000-0003',
    tags: ['dealer', 'repair', 'parts', 'accessories'],
    distance_m: 780,
  },
  {
    id: 'sample-4',
    name: 'Draft Repair Shop',
    // Deliberately has no phone, so the screen has to handle a missing number.
    address: '4 Placeholder Avenue, Sample Barangay',
    phone: null,
    tags: ['repair'],
    distance_m: 145,
  },
  {
    id: 'sample-5',
    name: 'Test Accessories Supply',
    address: '5 Placeholder Road, Sample Barangay',
    phone: '0999-000-0005',
    tags: ['accessories'],
    distance_m: 2010,
  },
];
