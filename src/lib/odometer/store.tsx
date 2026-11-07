import AsyncStorage from '@react-native-async-storage/async-storage';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { useLocationGate } from '@/lib/location/useLocationGate';

import {
  addFix,
  EMPTY_ODOMETER,
  endRide,
  parseOdometer,
  setReading,
  startRide,
  type Fix,
  type OdometerData,
} from './model';

/**
 * The ride counter on this phone, under its own key. Inside the location provider, so it keeps
 * counting on whichever screen the rider is on, from the one GPS watch the whole app shares.
 *
 * While a ride runs the screen stays on, because a locked phone stops the readings.
 */
const KEY = 'ayos.odometer.v1';
/** A reading arrives about once a second; the disk does not need to hear about each one. */
const SAVE_EVERY_MS = 30_000;
const KEEP_AWAKE_TAG = 'ride-counter';

type OdometerApi = {
  data: OdometerData;
  start: () => void;
  end: () => void;
  type: (km: number) => void;
};

const OdometerContext = createContext<OdometerApi | null>(null);

export function OdometerProvider({ children }: { children: ReactNode }) {
  const gate = useLocationGate();
  const [data, setData] = useState<OdometerData>(EMPTY_ODOMETER);
  const lastPoint = useRef<Fix | null>(null);
  const lastSave = useRef(0);

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
  useEffect(() => {
    if (!riding) return;
    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
    return () => {
      deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
    };
  }, [riding]);

  /* Each live reading during a ride. A remembered position is not a reading. */
  const { position, fixAt, accuracyM, stale } = gate;
  useEffect(() => {
    if (!riding || !position || fixAt === null || stale) return;
    const r = addFix(lastPoint.current, { lng: position[0], lat: position[1], at: fixAt, accuracyM });
    lastPoint.current = r.from;
    if (r.km === 0) return;
    setData((d) => {
      if (!d.ride) return d;
      const next = { ...d, ride: { ...d.ride, km: d.ride.km + r.km } };
      if (Date.now() - lastSave.current > SAVE_EVERY_MS) save(next);
      return next;
    });
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
