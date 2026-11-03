/**
 * Your ride: the choices a rider can make for their bike on the map.
 *
 * The same ids as the 3D source (docs/design/ride3d/catalog.py), which renders the pictures.
 * This build carries the choices that change the map picture: vehicle, paint and size.
 * Outfits, helmets and parts need live 3D in the app (one picture set per combination
 * would not fit), so they come later.
 *
 * DEMO: every choice is open to everyone, no account. When accounts exist, `paid` items
 * lock until unlocked (docs/BACKLOG.md, P21).
 */

export const DEMO = true;

export type VehicleId = 'scooter' | 'underbone' | 'standard';
export type PaintId = 'rust' | 'midnight' | 'pearl' | 'green' | 'gold' | 'matte';
export type SizeId = 's' | 'm' | 'l';

export type Ride = { vehicle: VehicleId; paint: PaintId; size: SizeId };

export const DEFAULT_RIDE: Ride = { vehicle: 'scooter', paint: 'rust', size: 'm' };

type Tier = 'free' | 'paid';

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

/** A saved ride from an older version or a removed option falls back to the default. */
export function cleanRide(saved: Partial<Ride> | undefined): Ride {
  const vehicle = VEHICLES.find((v) => v.id === saved?.vehicle)?.id ?? DEFAULT_RIDE.vehicle;
  const paint = PAINTS.find((p) => p.id === saved?.paint)?.id ?? DEFAULT_RIDE.paint;
  const size = SIZES.find((s) => s.id === saved?.size)?.id ?? DEFAULT_RIDE.size;
  return { vehicle, paint, size };
}

/**
 * Which of the 24 pictures to show in 3D. Picture i shows the bike turned i x 15 degrees
 * clockwise from "riding away from the camera". While riding the map turns with the rider,
 * so the difference is near zero: the bike is seen from behind.
 */
export function frameFor(heading: number | null, mapBearing: number): number {
  if (heading === null) return 0;
  const turn = (((heading - mapBearing) % 360) + 360) % 360;
  return Math.round(turn / 15) % 24;
}
