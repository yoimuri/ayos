import type { Shop, ShopTag } from '@/lib/data/types';

/**
 * NEAREST SHOP (Clint, 7 Nov): for a rider who needs a shop now, of whichever kind they pick.
 *
 * WHY NOT THE STRAIGHT-LINE NEAREST. A divided road can put a shop 150 m away in a straight line and
 * 1.3 km away by road (checked on Clint's phone at Luzon Avenue). So this has two steps: `shortlist`
 * picks who to ask the route server about, then `rankByRoad` orders them by the real road distance.
 *
 * WHO COUNTS:
 *   open     known to be open now, with or without a number: the rider can simply go there;
 *   unknown  hours never collected, but ONLY with a phone number. Nobody can say it is open, so the
 *            rider has to be able to ask first.
 * Known-closed shops never appear.
 *
 * OPEN SHOPS COME FIRST, so one that answers to "open" is never hidden behind a closer shop that may
 * not be. The old rule showed one open shop and one unknown one, which put a shop 5 km away on
 * screen ahead of open shops under 2 km.
 */

/** One request carries this many shops. */
const SHORTLIST = 10;
/** At most this many of them open, so unknown shops still get a place when open ones are plenty. */
const SHORTLIST_OPEN = 8;
/** How many the rider sees. */
const SHOWN = 3;

function byStraightLine(a: Shop, b: Shop): number {
  return a.distance_m - b.distance_m;
}

/** Who to ask about. The nearest open shop is always in it, however far: at 2 AM it may be the only one. */
export function shortlist(shops: Shop[], kind: ShopTag): Shop[] {
  const ofKind = shops.filter((shop) => shop.tags.includes(kind));
  const open = ofKind.filter((shop) => shop.status === 'open').sort(byStraightLine).slice(0, SHORTLIST_OPEN);
  const unknown = ofKind.filter((shop) => shop.status === 'unknown' && !!shop.phone).sort(byStraightLine);
  return [...open, ...unknown.slice(0, SHORTLIST - open.length)];
}

export type NearbyShop = { shop: Shop; /** Real road km, or null while only the estimate is known. */ roadKm: number | null };

/**
 * The shops to show, in order. `roadKm` lines up with `list`; null means no answer from the server,
 * so the order falls back to the straight line. A shop the server could not reach goes last.
 */
export function rankByRoad(list: Shop[], roadKm: (number | null)[] | null): NearbyShop[] {
  const open = (x: NearbyShop) => (x.shop.status === 'open' ? 0 : 1);
  const far = (x: NearbyShop) => x.roadKm ?? Infinity;
  return list
    .map((shop, i) => ({ shop, roadKm: roadKm?.[i] ?? null }))
    .sort((a, b) => open(a) - open(b) || (roadKm ? far(a) - far(b) : 0) || byStraightLine(a.shop, b.shop))
    .slice(0, SHOWN);
}

/** Moving at least this far gets new road distances while the panel is open. */
export const REFRESH_MOVED_M = 300;
/** And no more often than this, however fast the rider goes: a volunteer-run server answers these. */
export const REFRESH_EVERY_MS = 30_000;

export function shouldRefresh(lastFrom: [number, number], lastAt: number, rider: [number, number], now: number): boolean {
  if (now - lastAt < REFRESH_EVERY_MS) return false;
  const k = 111_320;
  const moved = Math.hypot((rider[0] - lastFrom[0]) * k * Math.cos((rider[1] * Math.PI) / 180), (rider[1] - lastFrom[1]) * k);
  return moved >= REFRESH_MOVED_M;
}

/**
 * The shop the rider has selected stays on screen when the list refreshes, even if it is no longer in
 * the nearest 3: it takes the last place, marked as an estimate. A different kind of shop does not
 * count, because the rider has just asked for another kind.
 */
export function withSelected(nearby: NearbyShop[], selected: Shop | undefined, kind: ShopTag): NearbyShop[] {
  if (!selected || !selected.tags.includes(kind) || nearby.some((x) => x.shop.id === selected.id)) return nearby;
  return [...nearby.slice(0, SHOWN - 1), { shop: selected, roadKm: null }];
}

