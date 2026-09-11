import type { Area } from '@/lib/settings/store';

/**
 * INVENTED PLACEHOLDER DATA. NOT REAL SHOPS. DRAFT SCREENS ONLY.
 *
 * These records are fabricated. They are NOT part of the field-collected dataset and
 * must never be inserted into the database, exported, or merged with real shop rows.
 * The real shops were collected on foot, shop by shop, and are the co-founder's work.
 *
 * Every record here is self-evidently fake: ids prefixed `sample-`, placeholder street
 * names, numbers in an unassigned 0999-000-00XX range that dial nowhere, and social
 * links pointing at example.invalid, a domain reserved by standard to never resolve.
 *
 * Deleted at build step 4, when the local store begins holding real synced shops.
 *
 * SHAPE NOTE: `socials`, `status` and `area` are NOT in build spec section 5 yet.
 * They exist here so the screens can be reviewed. Adding them for real is a schema
 * change and a joint decision.
 */

export type ShopTag = 'dealer' | 'repair' | 'parts' | 'accessories';
export type OpenStatus = 'open' | 'closed' | 'unknown';

export type ShopContact = {
  label: string;
  handle: string;
  /** Placeholder. example.invalid is reserved by RFC 2606 and never resolves. */
  url: string;
};

export type Shop = {
  id: string;
  name: string;
  address: string;
  phone: string | null;
  tags: ShopTag[];
  status: OpenStatus;
  openUntil?: string;
  socials: ShopContact[];
  distance_m: number;
  bearing: 'N' | 'S' | 'E' | 'W';
  /** Which part of Metro Manila. Drives what the rider sees after picking an area. */
  area: Area;
  ratingCount: number;
  ratings: { who: string; stars: number; body: string }[];
};

const fb = (name: string, n: number): ShopContact => ({
  label: 'Facebook',
  handle: name,
  url: `https://example.invalid/fb/${n}`,
});

const mg = (handle: string, n: number): ShopContact => ({
  label: 'Messenger',
  handle,
  url: `https://example.invalid/m/${n}`,
});

/**
 * Intentionally NOT in distance order. The screens sort themselves, so a broken sort
 * shows as a wrong order rather than accidentally looking correct.
 */
export const SAMPLE_SHOPS: Shop[] = [
  // Quezon City
  {
    id: 'sample-1', name: 'Sample Moto Works', address: '1 Placeholder St, Sample Barangay',
    phone: '0999-000-0001', tags: ['repair', 'parts'], status: 'open', openUntil: '8 PM',
    socials: [fb('Sample Moto Works', 1)], distance_m: 1240, bearing: 'N', area: 'quezon-city',
    ratingCount: 6, ratings: [
      { who: 'Marco D.', stars: 4, body: 'Fixed my chain fast, had the sprocket in stock.' },
      { who: 'Jen', stars: 5, body: 'Helped me out even though they were about to close.' },
    ],
  },
  {
    id: 'sample-2', name: 'Placeholder Parts Center', address: '2 Placeholder St, Sample Barangay',
    phone: '0999-000-0002', tags: ['parts', 'accessories'], status: 'unknown',
    socials: [fb('Placeholder Parts', 2), mg('placeholderparts', 2)], distance_m: 320,
    bearing: 'E', area: 'quezon-city', ratingCount: 2,
    ratings: [{ who: 'Ryan', stars: 4, body: 'Had the mirror I needed.' }],
  },
  {
    id: 'sample-3', name: 'Draft Repair Shop', address: '4 Placeholder Ave, Sample Barangay',
    phone: null, tags: ['repair'], status: 'closed', socials: [fb('Draft Repair', 3)],
    distance_m: 145, bearing: 'N', area: 'quezon-city', ratingCount: 3,
    ratings: [{ who: 'Paolo', stars: 3, body: 'Good work but the queue was long.' }],
  },
  {
    id: 'sample-4', name: 'Example Motorcycle Dealer', address: '3 Placeholder Ave, Sample Barangay',
    phone: '0999-000-0004', tags: ['dealer', 'repair', 'parts', 'accessories'], status: 'open',
    openUntil: '6 PM', socials: [], distance_m: 780, bearing: 'W', area: 'quezon-city',
    ratingCount: 0, ratings: [],
  },

  // Manila
  {
    id: 'sample-5', name: 'Sample Vulcanizing Espana', address: '10 Placeholder Blvd, Sample District',
    phone: '0999-000-0005', tags: ['repair'], status: 'open', openUntil: '9 PM',
    socials: [fb('Sample Vulcanizing', 5)], distance_m: 410, bearing: 'S', area: 'manila',
    ratingCount: 8, ratings: [
      { who: 'Dennis', stars: 5, body: 'Open late, which saved me.' },
      { who: 'Aldrin', stars: 4, body: 'Fair price on a tube replacement.' },
    ],
  },
  {
    id: 'sample-6', name: 'Placeholder Surplus Parts', address: '12 Placeholder St, Sample District',
    phone: '0999-000-0006', tags: ['parts'], status: 'unknown', socials: [mg('phsurplus', 6)],
    distance_m: 950, bearing: 'E', area: 'manila', ratingCount: 1, ratings: [],
  },
  {
    id: 'sample-7', name: 'Test Moto Electrical', address: '14 Placeholder Ave, Sample District',
    phone: null, tags: ['repair', 'parts'], status: 'closed', socials: [],
    distance_m: 1680, bearing: 'W', area: 'manila', ratingCount: 4,
    ratings: [{ who: 'Kim', stars: 4, body: 'Sorted a wiring fault nobody else could find.' }],
  },

  // Makati / BGC
  {
    id: 'sample-8', name: 'Example Rider Supply', address: '20 Placeholder Drive, Sample Village',
    phone: '0999-000-0008', tags: ['accessories', 'parts'], status: 'open', openUntil: '7 PM',
    socials: [fb('Example Rider Supply', 8), mg('exampleridersupply', 8)], distance_m: 260,
    bearing: 'N', area: 'makati-bgc', ratingCount: 11,
    ratings: [
      { who: 'Trish', stars: 5, body: 'Good helmet range, staff let me try several.' },
      { who: 'Nico', stars: 4, body: 'Pricier than Banawe but close to the office.' },
    ],
  },
  {
    id: 'sample-9', name: 'Placeholder Big Bike Service', address: '22 Placeholder Drive, Sample Village',
    phone: '0999-000-0009', tags: ['dealer', 'repair'], status: 'open', openUntil: '5 PM',
    socials: [fb('PH Big Bike Service', 9)], distance_m: 1120, bearing: 'S', area: 'makati-bgc',
    ratingCount: 3, ratings: [{ who: 'Rob', stars: 5, body: 'They actually know 650cc twins.' }],
  },

  // Pasig / Mandaluyong
  {
    id: 'sample-10', name: 'Sample Scooter Clinic', address: '30 Placeholder Rd, Sample Barangay',
    phone: '0999-000-0010', tags: ['repair'], status: 'open', openUntil: '8 PM',
    socials: [mg('samplescooterclinic', 10)], distance_m: 180, bearing: 'E',
    area: 'pasig-mandaluyong', ratingCount: 7,
    ratings: [{ who: 'Grace', stars: 5, body: 'CVT overhaul done same day.' }],
  },
  {
    id: 'sample-11', name: 'Draft Tire and Battery', address: '32 Placeholder Rd, Sample Barangay',
    phone: '0999-000-0011', tags: ['parts', 'repair'], status: 'unknown', socials: [],
    distance_m: 620, bearing: 'W', area: 'pasig-mandaluyong', ratingCount: 0, ratings: [],
  },

  // Marikina
  {
    id: 'sample-12', name: 'Test Motorworks Marikina', address: '40 Placeholder St, Sample Barangay',
    phone: '0999-000-0012', tags: ['repair', 'parts'], status: 'open', openUntil: '6 PM',
    socials: [fb('Test Motorworks', 12)], distance_m: 540, bearing: 'N', area: 'marikina',
    ratingCount: 5, ratings: [{ who: 'Joel', stars: 4, body: 'Honest about what did not need replacing.' }],
  },
];

/** Turns 320 into "320" + metres, and 1240 into "1.2" + km. */
export function splitDistance(metres: number): { value: string; unit: 'metres' | 'km' } {
  if (metres < 1000) return { value: String(metres), unit: 'metres' };
  return { value: (metres / 1000).toFixed(1), unit: 'km' };
}

export function findShop(id: string): Shop | undefined {
  return SAMPLE_SHOPS.find((shop) => shop.id === id);
}

/**
 * Shops for the rider's chosen area, nearest first.
 *
 * With no area chosen, everything is returned. That is the honest default: a rider who
 * skipped the question should see more shops, not none.
 */
export function shopsForArea(area: Area | null): Shop[] {
  const pool = area ? SAMPLE_SHOPS.filter((shop) => shop.area === area) : SAMPLE_SHOPS;
  /*
    Copy before sorting. .sort() rewrites the array it is given, which would quietly
    reorder the shared source array on every render.
  */
  return [...pool].sort((a, b) => a.distance_m - b.distance_m);
}
