/**
 * Your ride: the choices a rider can make for their bike on the map.
 *
 * The same ids as the 3D source (docs/design/ride3d/catalog.py), which renders the pictures.
 * Since 3 Nov every part is its own stack of pictures (layers.generated.ts): bike in its paint,
 * the rider's outfit, the exhaust, the helmet, the top box and the add-ons, drawn on top of
 * each other, so any combination works without a picture for every combination.
 *
 * DEMO: every choice is open to everyone, no account. `paid` items show an open padlock;
 * when accounts exist they lock until unlocked (docs/BACKLOG.md, P21).
 */

export const DEMO = true;

export type VehicleId = 'scooter' | 'underbone' | 'standard';
export type PaintId = 'rust' | 'midnight' | 'pearl' | 'green' | 'gold' | 'matte';
export type SizeId = 's' | 'm' | 'l';
export type OutfitId = 'plain' | 'suit' | 'hoodie' | 'shorts' | 'gear' | 'raincoat';
export type HelmetId = 'full' | 'dual' | 'open' | 'nutshell' | 'none';
export type HelmetColourId = 'rust' | 'white' | 'black' | 'gold';
export type PipeId = 'stock' | 'dual' | 'open' | 'jbt';
export type TopboxId = 'none' | 'round' | 'smooth' | 'alloy' | 'classic' | 'leather' | 'lalakbay' | 'grub' | 'foodpandesal';
export type AddonId = 'mdl' | 'helmet_cam' | 'bar_cam';

export type Ride = {
  vehicle: VehicleId;
  paint: PaintId;
  size: SizeId;
  outfit: OutfitId;
  helmet: HelmetId;
  helmetColour: HelmetColourId;
  pipe: PipeId;
  topbox: TopboxId;
  addons: AddonId[];
};

export const DEFAULT_RIDE: Ride = {
  vehicle: 'scooter',
  paint: 'rust',
  size: 'm',
  outfit: 'plain',
  helmet: 'full',
  helmetColour: 'rust',
  pipe: 'stock',
  topbox: 'none',
  addons: [],
};

export type Tier = 'free' | 'paid';
type Option<T> = { id: T; label: string; tier: Tier };

export const VEHICLES: { id: VehicleId; tier: Tier }[] = [
  { id: 'scooter', tier: 'free' },
  { id: 'underbone', tier: 'free' },
  { id: 'standard', tier: 'free' },
];

/** Shown as "Soon": no 3D model yet. */
export const VEHICLES_SOON = ['tricycle', 'ebike'] as const;

export const PAINTS: { id: PaintId; hex: string; tier: Tier }[] = [
  { id: 'rust', hex: '#A63C24', tier: 'free' },
  { id: 'midnight', hex: '#1F2A44', tier: 'free' },
  { id: 'pearl', hex: '#E4DFD5', tier: 'free' },
  { id: 'green', hex: '#1E4D3A', tier: 'free' },
  { id: 'gold', hex: '#C9A24A', tier: 'paid' },
  { id: 'matte', hex: '#262422', tier: 'paid' },
];

/* Product and part names are the same in English and Taglish, as riders say them. */
export const OUTFITS: Option<OutfitId>[] = [
  { id: 'plain', label: 'Plain', tier: 'free' },
  { id: 'suit', label: 'Suit', tier: 'free' },
  { id: 'hoodie', label: 'Hoodie', tier: 'free' },
  { id: 'shorts', label: 'Shorts, tsinelas', tier: 'free' },
  { id: 'gear', label: 'Riding gear', tier: 'paid' },
  { id: 'raincoat', label: 'Raincoat', tier: 'paid' },
];

export const HELMETS: Option<HelmetId>[] = [
  { id: 'full', label: 'Full face', tier: 'free' },
  { id: 'dual', label: 'Dual sport', tier: 'paid' },
  { id: 'open', label: 'Open face', tier: 'paid' },
  { id: 'nutshell', label: 'Nutshell', tier: 'paid' },
  { id: 'none', label: 'No helmet', tier: 'paid' },
];

export const HELMET_COLOURS: { id: HelmetColourId; hex: string; tier: Tier }[] = [
  { id: 'rust', hex: '#A63C24', tier: 'free' },
  { id: 'white', hex: '#E9E6E0', tier: 'free' },
  { id: 'black', hex: '#1B1A19', tier: 'free' },
  { id: 'gold', hex: '#C9A24A', tier: 'paid' },
];

export const PIPES: Option<PipeId>[] = [
  { id: 'stock', label: 'Stock', tier: 'free' },
  { id: 'dual', label: 'Dual tip', tier: 'paid' },
  { id: 'open', label: 'Open pipe', tier: 'paid' },
  /* A made-up name, not a real brand. */
  { id: 'jbt', label: 'JBT', tier: 'paid' },
];

export const TOPBOXES: Option<TopboxId>[] = [
  { id: 'none', label: 'None', tier: 'free' },
  { id: 'round', label: 'Round', tier: 'paid' },
  { id: 'smooth', label: 'Smooth', tier: 'paid' },
  { id: 'alloy', label: 'Alloy', tier: 'paid' },
  { id: 'classic', label: 'Classic', tier: 'paid' },
  { id: 'leather', label: 'Leather', tier: 'paid' },
  /* Delivery boxes: made-up names in the service colours, never a real logo. */
  { id: 'lalakbay', label: 'Lalakbay', tier: 'paid' },
  { id: 'grub', label: 'Grub', tier: 'paid' },
  { id: 'foodpandesal', label: 'Foodpandesal', tier: 'paid' },
];

export const ADDONS: Option<AddonId>[] = [
  { id: 'mdl', label: 'MDL', tier: 'paid' },
  { id: 'helmet_cam', label: 'Helmet cam', tier: 'paid' },
  { id: 'bar_cam', label: 'Handlebar cam', tier: 'paid' },
];

/**
 * How big the bike is drawn on the map, as a multiple of the default. M matches the size of
 * the bike in build 1.2.0, which riders already know.
 */
export const SIZES: { id: SizeId; scale: number }[] = [
  { id: 's', scale: 0.78 },
  { id: 'm', scale: 1 },
  { id: 'l', scale: 1.3 },
];

export function sizeScale(size: SizeId): number {
  return SIZES.find((s) => s.id === size)?.scale ?? 1;
}

const pick = <T,>(list: { id: T }[], value: unknown, fallback: T): T => list.find((o) => o.id === value)?.id ?? fallback;

/** A saved ride from an older version or a removed option falls back to the default, part by part. */
export function cleanRide(saved: Partial<Ride> | undefined): Ride {
  const d = DEFAULT_RIDE;
  return {
    vehicle: pick(VEHICLES, saved?.vehicle, d.vehicle),
    paint: pick(PAINTS, saved?.paint, d.paint),
    size: pick(SIZES, saved?.size, d.size),
    outfit: pick(OUTFITS, saved?.outfit, d.outfit),
    helmet: pick(HELMETS, saved?.helmet, d.helmet),
    helmetColour: pick(HELMET_COLOURS, saved?.helmetColour, d.helmetColour),
    pipe: pick(PIPES, saved?.pipe, d.pipe),
    topbox: pick(TOPBOXES, saved?.topbox, d.topbox),
    addons: Array.isArray(saved?.addons) ? ADDONS.filter((a) => saved.addons?.includes(a.id)).map((a) => a.id) : [],
  };
}

/** Same choices, part by part (Save is "Saved" while the draft equals what the map uses). */
export function sameRide(a: Ride, b: Ride): boolean {
  return (
    a.vehicle === b.vehicle &&
    a.paint === b.paint &&
    a.size === b.size &&
    a.outfit === b.outfit &&
    a.helmet === b.helmet &&
    a.helmetColour === b.helmetColour &&
    a.pipe === b.pipe &&
    a.topbox === b.topbox &&
    a.addons.length === b.addons.length &&
    a.addons.every((x) => b.addons.includes(x))
  );
}

/** The shared helmet picture set for a ride: `<style>-<colour>`, or `none`. */
export function helmetKey(r: Pick<Ride, 'helmet' | 'helmetColour'>): string {
  return r.helmet === 'none' ? 'none' : `${r.helmet}-${r.helmetColour}`;
}

/** How many pictures go round the bike: one every 45 degrees (3 Nov, was 24). */
export const ANGLES = 8;

/**
 * Which of the 8 pictures to show in 3D. Picture i shows the bike turned i x 45 degrees
 * clockwise from "riding away from the camera". While riding the map turns with the rider,
 * so the difference is near zero: the bike is seen from behind, and a turn shows as a step
 * to the next picture, the way a navigation arrow steps (Clint, 1 Nov).
 */
export function frameFor(heading: number | null, mapBearing: number): number {
  if (heading === null) return 0;
  const turn = (((heading - mapBearing) % 360) + 360) % 360;
  return Math.round(turn / (360 / ANGLES)) % ANGLES;
}
