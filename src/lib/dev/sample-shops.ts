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
  /**
   * A short plain-language description of what the shop actually does.
   *
   * PROPOSED (P5 on the design canvas), not in spec section 5. Written by the team from
   * what they observe on the visit, NOT copied from anyone else's listing.
   */
  about: string;
  distance_m: number;
  bearing: 'N' | 'S' | 'E' | 'W';
  /** Which part of Metro Manila. Drives what the rider sees after picking an area. */
  area: Area;
  ratingCount: number;
  /**
   * Average of CONFIRMED ratings, held as a column rather than averaged on read.
   * Spec section 5: never computed with AVG() at read time.
   * Null when there are too few ratings to show one.
   */
  ratingAvg: number | null;
  ratings: Review[];
};

/**
 * One rider's rating.
 *
 * `photos` holds LABELS, not image files. The app has no bundled photography and
 * fetching real images would break the offline promise, so each entry renders as a
 * labelled tile. At build step 9 these become storage keys pointing at uploads.
 */
export type Review = {
  id: string;
  who: string;
  /** Half steps allowed: 4.5 is valid. */
  stars: number;
  body: string;
  when: string;
  photos: string[];
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
    socials: [fb('Sample Moto Works', 1)],
    about: 'General repair and parts for scooters and underbones. Walk-in service, no appointment needed.', distance_m: 1240, bearing: 'N', area: 'quezon-city',
    ratingCount: 7, ratingAvg: 4.5, ratings: [
      { id: 'rv-1', who: 'Marco D.', stars: 4, body: 'grabe ang bilis mag ayos ng chain, may stock pa na sprocket. slmt po boss', when: '2 days ago', photos: ['Chain and sprocket', 'Receipt'] },
      { id: 'rv-2', who: 'Jen', stars: 5, body: 'pasara na sila pero tinulungan p rin aq. ayos to', when: 'last week', photos: [] },
    ],
  },
  {
    id: 'sample-2', name: 'Placeholder Parts Center', address: '2 Placeholder St, Sample Barangay',
    phone: '0999-000-0002', tags: ['parts', 'accessories'], status: 'unknown',
    socials: [fb('Placeholder Parts', 2), mg('placeholderparts', 2)],
    about: 'Parts and accessories counter. Mirrors, lights, grips and bodywork, mostly for scooters.', distance_m: 320,
    bearing: 'E', area: 'quezon-city', ratingCount: 4, ratingAvg: null,
    ratings: [{ id: 'rv-3', who: 'Ryan', stars: 4, body: 'meron silang salamin n hnahanap ko', when: '3 weeks ago', photos: ['Before', 'After'] }],
  },
  {
    id: 'sample-3', name: 'Draft Repair Shop', address: '4 Placeholder Ave, Sample Barangay',
    phone: null, tags: ['repair'], status: 'closed', socials: [fb('Draft Repair', 3)],
    about: 'Small two-bay repair shop. Chain, brakes and routine servicing.',
    distance_m: 145, bearing: 'N', area: 'quezon-city', ratingCount: 4, ratingAvg: null,
    ratings: [{ id: 'rv-4', who: 'Paolo', stars: 3, body: 'maganda gwa nla ditoh kaso ang haba ng pila. mgtiis k lng', when: 'last month', photos: ['Shop front'] }],
  },
  {
    id: 'sample-4', name: 'Example Motorcycle Dealer', address: '3 Placeholder Ave, Sample Barangay',
    phone: '0999-000-0004', tags: ['dealer', 'repair', 'parts', 'accessories'], status: 'open',
    openUntil: '6 PM', socials: [],
    about: 'Authorised dealer with a full service bay. Sells new units, parts and accessories.', distance_m: 780, bearing: 'W', area: 'quezon-city',
    ratingCount: 0, ratingAvg: null, ratings: [],
  },

  // Manila
  {
    id: 'sample-5', name: 'Sample Vulcanizing Espana', address: '10 Placeholder Blvd, Sample District',
    phone: '0999-000-0005', tags: ['repair'], status: 'open', openUntil: '9 PM',
    socials: [fb('Sample Vulcanizing', 5)],
    about: 'Tyre and tube work, open late. Vulcanizing plus basic roadside repairs.', distance_m: 410, bearing: 'S', area: 'manila',
    ratingCount: 12, ratingAvg: 4.6, ratings: [
      { id: 'rv-33', who: 'Boss Jun', stars: 4, body: 'bukas sila ng 11pm. saan ka pa. minus 1 star lang kasi walang upuan', when: '2 days ago', photos: [] },
      { id: 'rv-5', who: 'Dennis', stars: 5, body: 'bukas p sila ng gabi, buti nlng. salamat', when: '2 months ago', photos: [] },
      { id: 'rv-6', who: 'Aldrin', stars: 4, body: 'sulit ang presyo sa palit ng tube. ok lng', when: '2 days ago', photos: ['Tyre fitted'] },
    ],
  },
  {
    id: 'sample-6', name: 'Placeholder Surplus Parts', address: '12 Placeholder St, Sample District',
    phone: '0999-000-0006', tags: ['parts'], status: 'unknown', socials: [mg('phsurplus', 6)],
    about: 'Surplus and second-hand parts. Good for older models that main dealers no longer stock.',
    distance_m: 950, bearing: 'E', area: 'manila', ratingCount: 1, ratingAvg: null, ratings: [],
  },
  {
    id: 'sample-7', name: 'Test Moto Electrical', address: '14 Placeholder Ave, Sample District',
    phone: null, tags: ['repair', 'parts'], status: 'closed', socials: [],
    about: 'Electrical specialist. Wiring faults, charging systems and lighting.',
    distance_m: 1680, bearing: 'W', area: 'manila', ratingCount: 4, ratingAvg: null,
    ratings: [{ id: 'rv-7', who: 'Kim', stars: 4, body: 'wala mkahanap ng problema sa wiring q, sila lng. astig', when: 'last week', photos: ['Chain and sprocket', 'Receipt'] }],
  },

  // Makati / BGC
  {
    id: 'sample-8', name: 'Example Rider Supply', address: '20 Placeholder Drive, Sample Village',
    phone: '0999-000-0008', tags: ['accessories', 'parts'], status: 'open', openUntil: '7 PM',
    socials: [fb('Example Rider Supply', 8), mg('exampleridersupply', 8)],
    about: 'Rider gear and accessories. Helmets, jackets, gloves, plus fitting advice.', distance_m: 260,
    bearing: 'N', area: 'makati-bgc', ratingCount: 19, ratingAvg: 4.7,
    ratings: [
      { id: 'rv-27', who: 'kenneth_2x', stars: 5, body: 'wala akong motor pero ang ganda ng shop nila. 5 stars', when: '2 days ago', photos: [] },
      { id: 'rv-28', who: 'iDoL', stars: 4, body: 'bumili ako ng helmet. ang mahal. pero pinasukat nila ako ng 6 na helmet at hindi sila nainis. sana all ganto', when: 'last week', photos: ['Helmet'] },
      { id: 'rv-8', who: 'Trish', stars: 5, body: 'dmi choice na helmet, pinasukat p ako ng marami. ganda', when: '3 weeks ago', photos: [] },
      { id: 'rv-9', who: 'Nico', stars: 4, body: 'mhal kesa banawe pero mlapit sa office ko kaya ok n', when: 'last month', photos: ['Before', 'After'] },
    ],
  },
  {
    id: 'sample-9', name: 'Placeholder Big Bike Service', address: '22 Placeholder Drive, Sample Village',
    phone: '0999-000-0009', tags: ['dealer', 'repair'], status: 'open', openUntil: '5 PM',
    socials: [fb('PH Big Bike Service', 9)],
    about: 'Big bike service and dealer. Works on 400cc and up, including twins.', distance_m: 1120, bearing: 'S', area: 'makati-bgc',
    ratingCount: 4, ratingAvg: null, ratings: [{ id: 'rv-10', who: 'Rob', stars: 5, body: 'alam nla tlga ang big bike. hnd basta basta', when: '2 months ago', photos: ['Shop front'] }],
  },

  // Pasig / Mandaluyong
  {
    id: 'sample-10', name: 'Sample Scooter Clinic', address: '30 Placeholder Rd, Sample Barangay',
    phone: '0999-000-0010', tags: ['repair'], status: 'open', openUntil: '8 PM',
    socials: [mg('samplescooterclinic', 10)],
    about: 'Scooter specialist. CVT overhauls, drive belts and rollers, same-day where possible.', distance_m: 180, bearing: 'E',
    area: 'pasig-mandaluyong', ratingCount: 15, ratingAvg: 4.8,
    ratings: [
      { id: 'rv-11', who: 'Grace', stars: 5, body: 'same day tapos ang cvt overhaul. bilis!!', when: '2 days ago', photos: [] },
      { id: 'rv-29', who: 'Lito', stars: 5, body: 'pinaupo pa ako at binigyan ng kape habang naghihintay. napaiyak ako. salamat po', when: 'last week', photos: [] },
      { id: 'rv-30', who: 'xX_rider_Xx', stars: 3, body: 'maayos naman. wala lang akong masabi. 3 stars. neutral ako sa buhay', when: '3 weeks ago', photos: [] },
    ],
  },
  {
    id: 'sample-11', name: 'Draft Tire and Battery', address: '32 Placeholder Rd, Sample Barangay',
    phone: '0999-000-0011', tags: ['parts', 'repair'], status: 'unknown', socials: [],
    about: 'Tyres and batteries, with basic fitting. Quick jobs rather than full servicing.',
    distance_m: 620, bearing: 'W', area: 'pasig-mandaluyong', ratingCount: 0, ratingAvg: null, ratings: [],
  },

  // Marikina
  {
    id: 'sample-12', name: 'Test Motorworks Marikina', address: '40 Placeholder St, Sample Barangay',
    phone: '0999-000-0012', tags: ['repair', 'parts'], status: 'open', openUntil: '6 PM',
    socials: [fb('Test Motorworks', 12)],
    about: 'General repair and parts. Family-run, known for saying when a part does not need replacing.', distance_m: 540, bearing: 'N', area: 'marikina',
    ratingCount: 5, ratingAvg: 4.2, ratings: [{ id: 'rv-12', who: 'Joel', stars: 4, body: 'hnd nla pinalitan ung hnd kelangan. tpt mgsalita. slmt', when: 'last week', photos: ['Tyre fitted'] }],
  },

  // Caloocan / Malabon
  {
    id: 'sample-13', name: 'Sample Motor Parts Grace Park', address: '50 Placeholder St, Sample Barangay',
    phone: '0999-000-0013', tags: ['parts', 'repair'], status: 'open', openUntil: '7 PM',
    socials: [fb('Sample Motor Parts', 13)],
    about: 'Parts counter plus a repair bay. Busy roadside spot, limited space to wait.', distance_m: 290, bearing: 'S', area: 'caloocan-malabon',
    ratingCount: 13, ratingAvg: 4.3, ratings: [
      { id: 'rv-29', who: 'Lito', stars: 5, body: 'pinaupo pa ako at binigyan ng kape habang naghihintay. napaiyak ako. salamat po', when: 'last week', photos: [] },
      { id: 'rv-30', who: 'xX_rider_Xx', stars: 3, body: 'maayos naman. wala lang akong masabi. 3 stars. neutral ako sa buhay', when: '3 weeks ago', photos: [] },
      { id: 'rv-13', who: 'Jhun', stars: 4.5, body: 'mura at mabilis. dto n ako palagi', when: '2 days ago', photos: ['Bagong gulong'] },
      { id: 'rv-14', who: 'aRieL', stars: 3, body: 'ok nmn kaso medyo masikip ang lugar', when: 'last week', photos: [] },
    ],
  },
  {
    id: 'sample-14', name: 'Placeholder Surplus Malabon', address: '52 Placeholder Rd, Sample Barangay',
    phone: '0999-000-0014', tags: ['parts'], status: 'unknown', socials: [mg('phsurplusmalabon', 14)],
    about: 'Surplus parts warehouse. Wide stock, condition varies, worth checking in person.',
    distance_m: 1340, bearing: 'W', area: 'caloocan-malabon', ratingCount: 4, ratingAvg: null,
    ratings: [{ id: 'rv-15', who: 'Bok', stars: 4, body: 'surplus pero maganda quality. worth it', when: '3 weeks ago', photos: ['Surplus parts'] }],
  },
  {
    id: 'sample-15', name: 'Draft Moto Wash and Service', address: '54 Placeholder Ave, Sample Barangay',
    phone: null, tags: ['repair'], status: 'closed', socials: [],
    about: 'Wash and light servicing. Not a full repair shop.', distance_m: 2210, bearing: 'N',
    area: 'caloocan-malabon', ratingCount: 1, ratingAvg: null, ratings: [],
  },

  // Paranaque / Las Pinas
  {
    id: 'sample-16', name: 'Test Rider Hub Sucat', address: '60 Placeholder Blvd, Sample Village',
    phone: '0999-000-0016', tags: ['accessories', 'parts'], status: 'open', openUntil: '8 PM',
    socials: [fb('Test Rider Hub', 16), mg('testriderhub', 16)],
    about: 'Rider hub with accessories and parts. Staff answer questions whether or not you buy.', distance_m: 340, bearing: 'E',
    area: 'paranaque-las-pinas', ratingCount: 26, ratingAvg: 4.9, ratings: [
      { id: 'rv-31', who: 'BRYAN', stars: 1, body: 'NAG 5 STARS AKO DATI PERO TINANGGAL NILA UNG TUBIG NA LIBRE. 1 STAR NA LANG', when: '2 days ago', photos: [] },
      { id: 'rv-32', who: 'shaira', stars: 5, body: 'ang bait ng kuya dito. tinulungan niya ako kahit hindi naman motor ko ang sira, sasakyan ko. thank you po kuya', when: 'last month', photos: [] },
      { id: 'rv-16', who: 'MaRk', stars: 5, body: 'sobrang bait ng may ari. libre pa ang tubig HAHA', when: '2 days ago', photos: ['Shop front', 'Helmet wall'] },
      { id: 'rv-17', who: 'jen_09', stars: 4.5, body: 'kmpleto gamit. pwd mgtanong kahit d ka bibili', when: 'last month', photos: [] },
    ],
  },
  {
    id: 'sample-17', name: 'Example Engine Rebuild', address: '62 Placeholder St, Sample Village',
    phone: '0999-000-0017', tags: ['repair'], status: 'open', openUntil: '6 PM',
    socials: [fb('Example Engine Rebuild', 17)],
    about: 'Engine rebuild and overhaul specialist. Longer jobs, not quick fixes.', distance_m: 880, bearing: 'S',
    area: 'paranaque-las-pinas', ratingCount: 6, ratingAvg: 4.6,
    ratings: [{ id: 'rv-18', who: 'Dodong', stars: 5, body: 'overhaul ng engine, parang bago ulit. galing tlga', when: 'last week', photos: ['Engine bago', 'Engine pagkatapos'] }],
  },
  {
    id: 'sample-18', name: 'Sample Tire Center BF', address: '64 Placeholder Rd, Sample Village',
    phone: '0999-000-0018', tags: ['parts', 'repair'], status: 'unknown', socials: [],
    about: 'Tyre centre with fitting. Can be slow at peak times.',
    distance_m: 1760, bearing: 'W', area: 'paranaque-las-pinas', ratingCount: 4, ratingAvg: null,
    ratings: [{ id: 'rv-19', who: 'kUyA bEn', stars: 2.5, body: 'ang tagal ng service. 3 oras aq naghintay sa gulong lng', when: '2 months ago', photos: [] }],
  },

  // extra Marikina + Pasig so every city has more than one
  {
    id: 'sample-19', name: 'Placeholder Riders Garage', address: '42 Placeholder Ave, Sample Barangay',
    phone: '0999-000-0019', tags: ['repair', 'accessories'], status: 'open', openUntil: '9 PM',
    socials: [mg('phridersgarage', 19)],
    about: 'Repair and accessories, open late into the evening. Useful for night-shift riders.', distance_m: 1130, bearing: 'E', area: 'marikina',
    ratingCount: 5, ratingAvg: 4.0, ratings: [
      { id: 'rv-20', who: 'Migz', stars: 4, body: 'bukas hanggang gabi, malaking tulong sa night shift', when: '2 days ago', photos: [] },
    ],
  },
  {
    id: 'sample-20', name: 'Draft Scooter Parts Ortigas', address: '34 Placeholder St, Sample Barangay',
    phone: '0999-000-0020', tags: ['parts', 'accessories'], status: 'open', openUntil: '7 PM',
    socials: [fb('Draft Scooter Parts', 20)],
    about: 'Scooter parts, strong on Nmax and Aerox. Accessories as well as service items.', distance_m: 1420, bearing: 'N',
    area: 'pasig-mandaluyong', ratingCount: 4, ratingAvg: null,
    ratings: [{ id: 'rv-21', who: 'aLdRiN', stars: 4.5, body: 'kmpleto sa nmax at aerox. presyo ok lng nmn', when: 'last week', photos: ['Parts display'] }],
  },

  // A deliberately badly-rated shop. The app lists shops, it does not hide them:
  // ordering is by distance, so a low score never pushes a shop down or off the list.
  {
    id: 'sample-21', name: 'Draft Quick Fix Motor Repair', address: '70 Placeholder St, Sample Barangay',
    phone: '0999-000-0021', tags: ['repair'], status: 'open', openUntil: '6 PM',
    socials: [fb('Draft Quick Fix', 21)],
    about: 'Roadside repair shop. Low ratings, listed anyway, because ordering is by distance and never by score.',
    distance_m: 660, bearing: 'S', area: 'quezon-city', ratingCount: 23, ratingAvg: 1.8,
    ratings: [
      { id: 'rv-22', who: 'RONALD C.', stars: 1, body: 'SINIRA NILA UNG CLUTCH KO TAPOS SINGIL PA NG 1800!!! WAG KAYO PAPUNTA DITO PROMISE', when: '2 days ago', photos: ['Resibo', 'Clutch'] },
      { id: 'rv-23', who: 'maRLon', stars: 1, body: 'sabi 1 oras lang. umuwi ako kinabukasan. 1 oras daw ULIT', when: 'last week', photos: [] },
      { id: 'rv-24', who: 'Anonymous Rider', stars: 5, body: 'ang galing po nila sobrang bait at mura po highly recommended po talaga sila po ang best sa lahat', when: 'last week', photos: [] },
      { id: 'rv-25', who: 'jayR', stars: 2, body: 'ok naman sana kaso ung aso nila tumatahol sa customer. 2 stars para sa aso', when: '3 weeks ago', photos: [] },
      { id: 'rv-26', who: 'Tita Baby', stars: 1, body: 'hindi ito ung lugawan. bakit ko ba nireview to', when: 'last month', photos: [] },
    ],
  },
];
/**
 * Always kilometres, two decimals. 145 m reads "0.15", 1240 m reads "1.20".
 *
 * One unit everywhere means the numbers in a list are directly comparable at a glance.
 * Mixing "320 METRES" with "1.2 KM" forced a rider to read the unit before they could
 * compare two rows, and the metre figures were visually much larger for no reason.
 * Two decimals rather than one: at one decimal, 145 m and 490 m both round to "0.1" /
 * "0.5" and become indistinguishable in the list. Never rounds below 0.01, because
 * "0.00 km away" reads as broken.
 */
export function splitDistance(metres: number): { value: string; unit: 'km' } {
  const km = metres / 1000;
  return { value: (km < 0.01 ? 0.01 : km).toFixed(2), unit: 'km' };
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
export function shopsForArea(area: Area | null, radiusM?: number | null): Shop[] {
  let pool = area ? SAMPLE_SHOPS.filter((shop) => shop.area === area) : SAMPLE_SHOPS;
  /* A null radius means "no limit", which is what the All chip selects. */
  if (radiusM != null) pool = pool.filter((shop) => shop.distance_m <= radiusM);
  /*
    Copy before sorting. .sort() rewrites the array it is given, which would quietly
    reorder the shared source array on every render.
  */
  return [...pool].sort((a, b) => a.distance_m - b.distance_m);
}

/** The radii a rider can pick. `null` is no limit. */
export const RADIUS_OPTIONS: { label: string; value: number | null }[] = [
  { label: '1 km', value: 1000 },
  { label: '2 km', value: 2000 },
  { label: '5 km', value: 5000 },
  { label: 'All', value: null },
];

/**
 * A rough travel time, deliberately rough.
 *
 * Straight-line distance x 1.3 for the fact that roads bend, divided by about 20 km/h,
 * which is a realistic Metro Manila motorcycle speed in traffic. It is arithmetic on a
 * number already held on the phone, so it costs nothing and works with no signal.
 *
 * What it is NOT is a traffic-aware ETA. That needs live speed data from millions of
 * phones, which is Waze's business and not something two people can bootstrap. The
 * caller must always render this with a tilde: "~9 min", never "9 min". A travel time
 * that looks precise but ignores traffic is worse than none at all, because it lies to
 * a rider at the moment they are already having a bad day.
 */
export function roughMinutes(metres: number): number {
  const km = metres / 1000;
  return Math.max(1, Math.round((km * 1.3) / 20 * 60));
}
