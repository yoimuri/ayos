import type { Shop } from '@/lib/data/types';

/**
 * NEAREST REPAIR (Charls, 5 Nov): for a rider who has just broken down, the fewest shops that
 * are worth their time.
 *
 *   open     the nearest repair shop known to be open now, with or without a number: the rider
 *            can simply ride or push there;
 *   unknown  the nearest repair shop whose hours were never collected, but ONLY if it has a phone
 *            number. Nobody can say it is open, so the rider has to be able to ask first. Sending
 *            a stranded rider to a shop nobody can confirm is the wrong kind of help.
 *
 * Known-closed shops never appear. Either can be missing: about a quarter of repair shops have
 * hours, so at 2 AM there may be no open one, and the screen still offers 911.
 */
export type NearestRepair = { open: Shop | null; unknown: Shop | null };

export function nearestRepair(shops: Shop[]): NearestRepair {
  let open: Shop | null = null;
  let unknown: Shop | null = null;
  for (const shop of shops) {
    if (!shop.tags.includes('repair')) continue;
    if (shop.status === 'open') {
      if (!open || shop.distance_m < open.distance_m) open = shop;
    } else if (shop.status === 'unknown' && shop.phone) {
      if (!unknown || shop.distance_m < unknown.distance_m) unknown = shop;
    }
  }
  return { open, unknown };
}
