import AsyncStorage from '@react-native-async-storage/async-storage';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { useLocationGate } from '@/lib/location/useLocationGate';
import { useSettings } from '@/lib/settings/store';

import { onLockedReading, startLockedCounting, stopLockedCounting } from './lockedRide';
import {
  addFix,
  EMPTY_ODOMETER,
  endRide,
  parseOdometer,
  resetOdometer,
  setReading,
  startRide,
  type Fix,
  type OdometerData,
} from './model';

/**
 * The ride counter on this phone, under its own key. Inside the location provider, so it keeps
 * counting on whichever screen the rider is on, from the one GPS watch the whole app shares.
 *
 * While a ride runs the screen stays on, and if the rider locks the phone anyway the ride service
 * keeps the readings coming (lockedRide.ts).
 */
const KEY = 'ayos.odometer.v1';
/** A reading arrives about once a second; the disk does not need to hear about each one. */
const SAVE_EVERY_MS = 30_000;
const KEEP_AWAKE_TAG = 'ride-counter';
/**
 * With the screen on, the ride service and the app's own watch both send readings. Counting both
 * would count the ride twice, so the app's watch is ignored while the service has sent one this
 * recently, and counts alone where the service sends nothing (phones without Google).
 */
const SERVICE_FRESH_MS = 5000;

type OdometerApi = {
  data: OdometerData;
  start: () => void;
  end: () => void;
  type: (km: number) => void;
  reset: () => void;
};

const OdometerContext = createContext<OdometerApi | null>(null);

export function OdometerProvider({ children }: { children: ReactNode }) {
  const gate = useLocationGate();
  const { t } = useSettings();
  const [data, setData] = useState<OdometerData>(EMPTY_ODOMETER);
  const lastPoint = useRef<Fix | null>(null);
  const lastSave = useRef(0);
  const serviceAt = useRef(0);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => setData(parseOdometer(raw)))
      .catch(() => {});
  }, []);

  const save = useCallback((d: OdometerData) => {
    lastSave.current = Date.now();
    AsyncStorage.setItem(KEY, JSON.stringify(d)).catch(() => {});
  }, []);

  const change = useCallback(
    (fn: (d: OdometerData) => OdometerData) => {
      setData((d) => {
        const next = fn(d);
        save(next);
        return next;
      });
    },
    [save],
  );

  const riding = data.ride !== null;
  const { rideCounterTitle, rideCounterBody } = t;
  useEffect(() => {
    if (!riding) return;
    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
    void startLockedCounting(rideCounterTitle, rideCounterBody);
    return () => {
      deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
      void stopLockedCounting();
    };
  }, [riding, rideCounterTitle, rideCounterBody]);

  /* One reading added to the ride running now. */
  const count = useCallback(
    (fix: Fix) => {
      const r = addFix(lastPoint.current, fix);
      lastPoint.current = r.from;
      if (r.km === 0) return;
      setData((d) => {
        if (!d.ride) return d;
        const next = { ...d, ride: { ...d.ride, km: d.ride.km + r.km } };
        if (Date.now() - lastSave.current > SAVE_EVERY_MS) save(next);
        return next;
      });
    },
    [save],
  );

  /* Readings from the ride service, screen on or locked. */
  useEffect(() => {
    if (!riding) return;
    return onLockedReading((fix) => {
      serviceAt.current = Date.now();
      count(fix);
    });
  }, [riding, count]);

  /* Each live reading from the app's own watch, unless the ride service is already counting. */
  const { position, fixAt, accuracyM, stale } = gate;
  useEffect(() => {
    if (!riding || !position || fixAt === null || stale) return;
    if (Date.now() - serviceAt.current < SERVICE_FRESH_MS) return;
    count({ lng: position[0], lat: position[1], at: fixAt, accuracyM });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixAt]);

  const api = useMemo<OdometerApi>(
    () => ({
      data,
      start: () => {
        lastPoint.current = null;
        change((d) => startRide(d, Date.now()));
      },
      end: () => {
        lastPoint.current = null;
        change(endRide);
      },
      type: (km) => change((d) => setReading(d, km)),
      /* Ending the ride here also stops the locked-screen counter (the riding effect). */
      reset: () => {
        lastPoint.current = null;
        change(resetOdometer);
      },
    }),
    [data, change],
  );

  return <OdometerContext.Provider value={api}>{children}</OdometerContext.Provider>;
}

export function useOdometer(): OdometerApi {
  const value = useContext(OdometerContext);
  if (!value) throw new Error('useOdometer was called outside OdometerProvider. Check src/app/_layout.tsx.');
  return value;
}
