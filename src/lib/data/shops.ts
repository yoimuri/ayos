import { useEffect, useMemo, useState } from 'react';

import {
  closedText,
  currentValues,
  parseClosed,
  parseLinks,
  parseLocation,
  parsePhones,
  parseTags,
  parseTime,
  timeText,
  type LogField,
  type FieldworkData,
  type NewShop,
} from '@/lib/fieldwork/model';
import { useFieldwork } from '@/lib/fieldwork/store';
import { AREA_CENTRES, AREA_LABELS, type Area } from '@/lib/settings/store';

import { statusAt, type Hours } from './hours';
import type { Shop, ShopLink, ShopTag } from './types';

import RAW from './shops.json';

/**
 * The shops surveyed in the field, as the screens draw them.
 *
 * `shops.json` is written by scripts/import_shops.py and nothing else. Two shapes are
 * read, because the file on disk changes shape only when someone runs `--apply`:
 *
 *   old  [ {id, name, address, lat, lng, tags, phone?}, ... ]
 *   new  { collected_at: "YYYY-MM-DD", shops: [ {id, name, address?, lat, lng, tags,
 *          phones?, links?, hours?}, ... ] }
 */

type RawShop = {
  id: string;
  name: string;
  address?: string;
  lat: number;
  lng: number;
  tags: string[];
  /** Old shape only. */
  phone?: string;
  phones?: string[];
  links?: string[];
  hours?: Hours;
  /** The city named in the address (scripts/import_shops.py). Absent in older files. */
  city?: string;
};

type RawFile = RawShop[] | { collected_at?: string; shops: RawShop[] };

const FILE = RAW as RawFile;
const ROWS: RawShop[] = Array.isArray(FILE) ? FILE : FILE.shops;

/**
 * The day the list was collected, "YYYY-MM-DD", or null for a file that does not say.
 * Shown to riders when offline ("showing the shop list from 29 Sep 2026"): a rider must
 * be able to tell that a phone number could be out of date.
 */
export const COLLECTED_AT: string | null = Array.isArray(FILE) ? null : (FILE.collected_at ?? null);

/** "2026-09-29" -> "29 Sep 2026". The list's age, as a rider reads a date. */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function readableDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return m && d ? `${d} ${MONTHS[m - 1]} ${y}` : iso;
}

const TAGS = new Set<string>(['dealer', 'repair', 'parts', 'accessories']);

/**
 * A shop's city: the one its ADDRESS names, as the import script recorded it.
 *
 * Guessing from which city centre the pin is nearest to was measured wrong for 800 of
 * 2,430 shops, so nearest-centre is only the fallback for a file written before the
 * import script recorded cities.
 */
function cityOf(raw: RawShop): Area {
  if (raw.city && raw.city in AREA_LABELS) return raw.city as Area;
  return areaFor(raw.lng, raw.lat);
}

function areaFor(lng: number, lat: number): Area {
  let best: Area = 'other';
  let bestD = Infinity;
  (Object.keys(AREA_CENTRES) as Area[]).forEach((area) => {
    if (area === 'other') return;
    const [alng, alat] = AREA_CENTRES[area];
    const d = (lng - alng) ** 2 + (lat - alat) ** 2;
    if (d < bestD) {
      bestD = d;
      best = area;
    }
  });
  return best;
}

function bearingFor(dLng: number, dLat: number): 'N' | 'S' | 'E' | 'W' {
  if (Math.abs(dLat) >= Math.abs(dLng)) return dLat >= 0 ? 'N' : 'S';
  return dLng >= 0 ? 'E' : 'W';
}

/** Metres between two coordinates. Equirectangular; exact enough across a city. */
export function metresBetween(a: [number, number], b: [number, number]) {
  const mLat = 111_320;
  const mLng = 111_320 * Math.cos((((a[1] + b[1]) / 2) * Math.PI) / 180);
  return Math.hypot((b[0] - a[0]) * mLng, (b[1] - a[1]) * mLat);
}

/** "https://www.facebook.com/x" -> "Facebook". The site's name, not the whole address. */
const SITE_NAMES: Record<string, string> = {
  'facebook.com': 'Facebook',
  'fb.com': 'Facebook',
  'shopee.ph': 'Shopee',
  'lazada.com.ph': 'Lazada',
  'tiktok.com': 'TikTok',
  'youtube.com': 'YouTube',
  'instagram.com': 'Instagram',
};

function linkFor(url: string): ShopLink {
  const host = (/^https?:\/\/([^/]+)/i.exec(url)?.[1] ?? url).toLowerCase().replace(/^(www|m|web)\./, '');
  return { label: SITE_NAMES[host] ?? host, url };
}

/**
 * One surveyed row, widened into the shape every screen expects.
 *
 * THE ABSENT FIELDS ARE ABSENT, NOT INVENTED. Status comes from collected hours and is
 * `unknown` without them, because "Unknown" is an honest state. Ratings are zero
 * until ratings are stored. No screen is told a shop is open, rated or photographed when
 * it is not.
 */
function widen(raw: RawShop, from: [number, number], now: Date): Shop {
  const phones = raw.phones ?? (raw.phone ? [raw.phone] : []);
  const { status, until } = statusAt(raw.hours, now);
  return {
    id: raw.id,
    name: raw.name,
    address: raw.address ?? '',
    phone: phones[0] ?? null,
    phones,
    tags: raw.tags.filter((t) => TAGS.has(t)) as ShopTag[],
    status,
    openUntil: until,
    hours: raw.hours,
    links: (raw.links ?? []).map(linkFor),
    distance_m: metresBetween(from, [raw.lng, raw.lat]),
    bearing: bearingFor(raw.lng - from[0], raw.lat - from[1]),
    lng: raw.lng,
    lat: raw.lat,
    area: cityOf(raw),
    ratingCount: 0,
    ratingAvg: null,
    ratings: [],
  };
}

/**
 * One shop by id.
 *
 * Needed because the rate screen is reached by a route parameter, not by being handed
 * the object.
 */
export function useShop(id: string, from: [number, number] | null, area: Area | null): Shop | undefined {
  const origin = from ?? AREA_CENTRES[area ?? 'other'];
  return useMemo(() => {
    const raw = ROWS.find((r) => r.id === id);
    return raw ? widen(raw, origin, new Date()) : undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, origin[0], origin[1]]);
}

/**
 * Every shop, with distances measured from wherever the rider actually is.
 *
 * DISTANCE IS COMPUTED, NOT STORED: how far away a shop is depends on where the rider is
 * standing, so it is recalculated when they move. `from` falls back to the chosen area's
 * centre while the first fix arrives, so the list is ordered sensibly rather than
 * arbitrarily.
 *
 * Open/closed is worked out at the same moment. It is not re-checked on a timer; the list
 * is rebuilt whenever the rider moves or the app is reopened, which is when it is looked at.
 */
/**
 * The current minute, ticking. Open/closed is worked out from the clock, so the list has to
 * be rebuilt as time passes: before this, a shop that closed while the app sat open still
 * read "Open" (and could still trigger a shop-ahead alert) until the rider moved.
 */
function useMinute(): number {
  const [minute, setMinute] = useState(() => Math.floor(Date.now() / 60_000));
  useEffect(() => {
    const timer = setInterval(() => setMinute(Math.floor(Date.now() / 60_000)), 15_000);
    return () => clearInterval(timer);
  }, []);
  return minute;
}

export function useShops(from: [number, number] | null, area: Area | null): Shop[] {
  const origin = from ?? AREA_CENTRES[area ?? 'other'];
  const [olng, olat] = origin;
  const minute = useMinute();

  return useMemo(() => {
    const now = new Date();
    return ROWS.map((raw) => widen(raw, [olng, olat], now));
    /*
      Rounded to about a hundred metres. Recomputing every distance on every GPS reading
      would be pointless work — the rider has to move a real distance before any ordering
      changes — and it would hand every consumer a brand new array each time.
      The linter cannot see that the rounding is the point, hence the two disables.
    */
    // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/use-memo
  }, [Math.round(olng * 1000), Math.round(olat * 1000), minute]);
}

/*
  FIELD SURVEY MODE (developer feature): the surveyor's corrections and added shops, laid
  over the list on THEIR phone only. The original list is untouched; this only changes
  what this phone draws, so the surveyor sees what they typed straight away.
*/

function hoursFrom(time: string, closed: string): Hours | undefined {
  const t = parseTime(time);
  const c = parseClosed(closed);
  if (!t && c === null) return undefined;
  return { ...(t ?? {}), ...(c !== null ? { closed: c } : {}) };
}

function patched(shop: Shop, v: Partial<Record<LogField, string>>, from: [number, number], now: Date): Shop {
  const phones = v.contact !== undefined ? parsePhones(v.contact) : shop.phones;
  const hours =
    v.time !== undefined || v.closed !== undefined
      ? hoursFrom(v.time ?? timeText(shop.hours), v.closed ?? closedText(shop.hours?.closed))
      : shop.hours;
  const { status, until } = statusAt(hours, now);
  /* A pin moved on this phone: the shop is drawn there, and measured from there. */
  const moved = v.location !== undefined ? parseLocation(v.location) : null;
  const place = moved
    ? {
        lat: moved.lat,
        lng: moved.lng,
        distance_m: metresBetween(from, [moved.lng, moved.lat]),
        bearing: bearingFor(moved.lng - from[0], moved.lat - from[1]),
        area: areaFor(moved.lng, moved.lat),
      }
    : {};
  return {
    ...shop,
    ...place,
    name: v.name || shop.name,
    address: v.address ?? shop.address,
    phones,
    phone: phones[0] ?? null,
    links: v.social !== undefined ? parseLinks(v.social).map(linkFor) : shop.links,
    tags: v.services !== undefined ? (parseTags(v.services) as ShopTag[]) : shop.tags,
    hours,
    status,
    openUntil: until,
    edited: true,
  };
}

function fromNewShop(n: NewShop, from: [number, number], now: Date): Shop {
  const phones = parsePhones(n.values.contact ?? '');
  const hours = hoursFrom(n.values.time ?? '', n.values.closed ?? '');
  const { status, until } = statusAt(hours, now);
  return {
    id: n.id,
    name: n.values.name || 'New shop',
    address: n.values.address ?? '',
    phone: phones[0] ?? null,
    phones,
    tags: parseTags(n.values.services ?? '') as ShopTag[],
    status,
    openUntil: until,
    hours,
    links: parseLinks(n.values.social ?? '').map(linkFor),
    distance_m: metresBetween(from, [n.lng, n.lat]),
    bearing: bearingFor(n.lng - from[0], n.lat - from[1]),
    lng: n.lng,
    lat: n.lat,
    area: areaFor(n.lng, n.lat),
    ratingCount: 0,
    ratingAvg: null,
    ratings: [],
    isNew: true,
  };
}

/** The list with this phone's survey corrections and added shops applied. */
export function withFieldwork(base: Shop[], fw: FieldworkData, from: [number, number], now: Date): Shop[] {
  if (fw.log.length === 0 && fw.added.length === 0) return base;
  const edited = base.map((shop) => {
    const v = currentValues(fw, shop.id);
    return Object.keys(v).length ? patched(shop, v, from, now) : shop;
  });
  return [...edited, ...fw.added.map((n) => fromNewShop(n, from, now))];
}

/**
 * The shops every screen should draw: the surveyed list, plus this phone's survey work
 * when there is any. Screens use this rather than `useShops` directly.
 */
export function useAppShops(from: [number, number] | null, area: Area | null): Shop[] {
  const base = useShops(from, area);
  const { data } = useFieldwork();
  const origin = from ?? AREA_CENTRES[area ?? 'other'];
  return useMemo(
    () => withFieldwork(base, data, origin, new Date()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [base, data],
  );
}

/** One shop by id, from the same list. */
export function useAppShop(id: string, from: [number, number] | null, area: Area | null): Shop | undefined {
  const all = useAppShops(from, area);
  return useMemo(() => all.find((s) => s.id === id), [all, id]);
}
