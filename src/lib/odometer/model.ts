/**
 * THE RIDE COUNTER (Charls, 5 Nov): Start ride and End ride add up kilometres, and the rider can
 * type the bike's odometer reading so the total means something. Reminders are NOT here: Charls
 * will decide those later.
 *
 * ONLY NUMBERS ARE EVER KEPT: kilometres and times, on this phone. Never a position and never a
 * route. The last point exists only in memory, while a ride is running.
 *
 * COUNTS WHILE THE APP IS OPEN WITH THE SCREEN ON. Counting with the phone locked needs native
 * code (Clint, 5 Nov: test this first). A gap where nothing was read counts as a straight line
 * if the speed is believable, so it comes out low rather than high.
 */

export type OdometerData = {
  /** What the rider last typed, in km. Null until they do. */
  typedKm: number | null;
  /** Kilometres counted by finished rides since then. */
  countedKm: number;
  /** The ride running now. */
  ride: { startedAt: number; km: number } | null;
  /** How far the last finished ride went. */
  lastRideKm: number | null;
};

export const EMPTY_ODOMETER: OdometerData = { typedKm: null, countedKm: 0, ride: null, lastRideKm: null };

export type Fix = { lng: number; lat: number; at: number; accuracyM: number | null };

/** A phone's position wanders this much standing still (RealMap, 30 Oct), so smaller moves wait. */
export const MIN_MOVE_M = 25;
/** A reading this rough could be anywhere on the block. */
export const WORST_ACCURACY_M = 50;
/** Faster than any rider here: the position jumped. The jump is not counted. */
export const MAX_SPEED_MPS = 160 / 3.6;

const KM_LIMIT = 9_999_999;

function metres(a: Fix, b: Fix): number {
  const k = 111_320;
  return Math.hypot((a.lng - b.lng) * k * Math.cos((a.lat * Math.PI) / 180), (a.lat - b.lat) * k);
}

/**
 * One new reading during a ride. `from` is the last point counted. Returns where to measure from
 * next and how many km this reading adds.
 *
 * WHY A STEP AND NOT EVERY READING: adding every tiny move would count the wander of a parked
 * phone as riding. Waiting until the rider is clearly somewhere else adds the whole move then,
 * so slow traffic still counts in full and a red light adds nothing.
 */
export function addFix(from: Fix | null, fix: Fix): { from: Fix | null; km: number } {
  if (fix.accuracyM !== null && fix.accuracyM > WORST_ACCURACY_M) return { from, km: 0 };
  if (!from) return { from: fix, km: 0 };
  const m = metres(from, fix);
  if (m < MIN_MOVE_M) return { from, km: 0 };
  const seconds = (fix.at - from.at) / 1000;
  /* Start again from here: wherever the jump landed is the best guess of where the rider is. */
  if (seconds <= 0 || m / seconds > MAX_SPEED_MPS) return { from: fix, km: 0 };
  return { from: fix, km: m / 1000 };
}

export function startRide(d: OdometerData, now: number): OdometerData {
  return d.ride ? d : { ...d, ride: { startedAt: now, km: 0 } };
}

export function endRide(d: OdometerData): OdometerData {
  if (!d.ride) return d;
  return { ...d, ride: null, countedKm: d.countedKm + d.ride.km, lastRideKm: d.ride.km };
}

/** Typing a reading starts the count again from it. A ride running now carries on on top. */
export function setReading(d: OdometerData, km: number): OdometerData {
  return { ...d, typedKm: km, countedKm: 0 };
}

/** What the bike's odometer should say now, or null if the rider never typed one. */
export function reading(d: OdometerData): number | null {
  return d.typedKm === null ? null : d.typedKm + d.countedKm + (d.ride?.km ?? 0);
}

/** A typed reading, or null if it is not one: digits, one optional decimal point, no silliness. */
export function parseReading(text: string): number | null {
  const clean = text.trim().replace(/,/g, '');
  if (!/^\d+(\.\d+)?$/.test(clean)) return null;
  const km = Number(clean);
  return km <= KM_LIMIT ? km : null;
}

/** Tens of metres matter on a trip, not on a whole bike. */
export function formatKm(km: number, decimals = 1): string {
  return km.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** Whatever came off the disk: unreadable or wrong parts fall back, part by part. */
export function parseOdometer(raw: string | null): OdometerData {
  if (!raw) return EMPTY_ODOMETER;
  try {
    const v = JSON.parse(raw) as Partial<OdometerData>;
    const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x : null);
    const ride = v.ride && num(v.ride.km) !== null && num(v.ride.startedAt) !== null ? { startedAt: v.ride.startedAt, km: v.ride.km } : null;
    return { typedKm: num(v.typedKm), countedKm: num(v.countedKm) ?? 0, ride, lastRideKm: num(v.lastRideKm) };
  } catch {
    return EMPTY_ODOMETER;
  }
}
