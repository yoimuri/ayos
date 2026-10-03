import * as Location from 'expo-location';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, Linking, Platform } from 'react-native';

import { isBetterFix, type Fix } from './betterFix';
import { createHeadingFilter } from './headingFilter';
import { createPositionFilter } from './positionFilter';
import { courseIfMoving, courseIsFresh } from './course';
import { isGoodFix, SETTLE_TIMEOUT_MS } from './settle';

/**
 * Whether the app can see where the rider is, and what to do about it if not.
 *
 * NOTHING HERE BLOCKS. A rider who does not want to share their location gets a working
 * app: the shop list, the search, the phone numbers and the last map they loaded are all
 * on the device already. Location makes the distances honest, it does not make the app
 * function. An app that holds itself hostage over a permission teaches people to
 * uninstall it, and this one is for someone standing next to a broken motorcycle.
 *
 * TWO DIFFERENT "OFF" STATES, TWO DIFFERENT REMEDIES, and confusing them is the usual
 * bug. The system location toggle being off is not the same as this app being refused
 * permission, and sending someone to the wrong settings screen is worse than sending
 * them nowhere — they look, find nothing that matches what they were told, and give up.
 *
 *   servicesOff   the phone's own location switch is off. Everything is denied it, not
 *                 just us. Fixed in Android's location settings.
 *   denied        the switch is on, we were refused, and we may ask again.
 *   blocked       refused permanently. The system dialog will not appear again, so the
 *                 only route left is this app's page in Android settings.
 *   ready         we have permission and the phone's switch is on.
 *
 * LAST KNOWN POSITION IS STILL A POSITION. When live updates are unavailable, Android
 * usually still holds the last fix any app obtained. Using it means a rider who has just
 * switched location off does not watch the map jump back to a city centroid.
 */

export type LocationStatus = 'checking' | 'ready' | 'servicesOff' | 'denied' | 'blocked';

export type LocationDebug = {
  /** Radius of uncertainty, metres, exactly as the OS reported it. */
  accuracyM: number | null;
  /** Uncertainty of the averaged estimate. Lower than the raw figure when it is working. */
  smoothedM: number | null;
  /** How old the displayed fix is, in seconds. */
  ageS: number | null;
  /** True when Android says the position was injected by another app. */
  mocked: boolean | null;
  gpsAvailable: boolean | null;
  networkAvailable: boolean | null;
  /** Fixes the OS offered that were refused for being much less accurate. */
  rejected: number;
  /** Fixes accepted since the watch started. */
  accepted: number;
};

export type LocationGate = {
  status: LocationStatus;
  /** [longitude, latitude], live where possible and last-known otherwise. Null if never known. */
  position: [number, number] | null;
  /** True when `position` is a remembered fix rather than a current one. */
  stale: boolean;
  /**
   * True from the moment the live watch starts until a reading is within 30 m, or 15 s
   * have passed (see settle.ts). The home screen shows "finding your location" and the
   * map holds its first camera move while this is true. Never blocks anything else.
   */
  finding: boolean;
  /**
   * The radius of uncertainty around `position`, in metres, straight from the OS.
   *
   * NOT drawn as a circle on the map. It drives the "rough fix" banner instead, which
   * says the same thing in words.
   */
  accuracyM: number | null;
  /**
   * Everything the OS will tell us about the fix, for diagnosing a wrong position.
   *
   * Shown in Settings → Developer. A rider reporting "it put me on the next street" is
   * describing a symptom with at least four possible causes, and these numbers separate
   * them: a 200-metre radius means the phone never used GPS, `gpsAvailable: false` means
   * the chip is off or unavailable, a large age means we are drawing a memory, and
   * `mocked` means something else is feeding the phone a position.
   */
  debug: LocationDebug;
  /**
   * Android only. Raises the system dialog asking to switch on high-accuracy location
   * mode. Worth offering when fixes stay poor: with the phone in battery-saving mode the
   * GPS chip is never consulted, so no amount of asking nicely improves the fix.
   */
  improveAccuracy: () => Promise<void>;
  /**
   * Which way the phone is pointing, in degrees clockwise from north.
   *
   * PLAIN STATE, and only because the FILTER earns it. The raw compass fires up to twenty
   * times a second, which is why this was once an Animated.Value mutated outside React.
   * `headingFilter` now emits at most once per 60 ms and only past a 1.5° deadband, and
   * almost never while the phone is still — so the re-render cost is
   * real but small, and in exchange the rider can be drawn by the MAP rather than by a
   * React view that lags a frame behind every drag.
   *
   * TWO SOURCES. While the bike moves faster than about 9 km/h it is the
   * GPS direction of travel, which is right however the phone is held. Standing still it
   * is the compass: where the phone points, which answers "which of these shops is in
   * front of me". See course.ts.
   */
  heading: number | null;
  /** Ask the system for permission. Does nothing useful when blocked or services are off. */
  request: () => Promise<void>;
  /** Demand one fresh high-accuracy reading rather than waiting for the watch. */
  refresh: () => Promise<void>;
  /** Send the rider to whichever settings screen actually fixes their particular state. */
  openSettings: () => void;
  /** Re-read the world. Runs automatically when the app returns to the foreground. */
  recheck: () => Promise<void>;
};

function useLocationGateState(): LocationGate {
  const [status, setStatus] = useState<LocationStatus>('checking');
  const [position, setPosition] = useState<[number, number] | null>(null);
  const [stale, setStale] = useState(false);
  const [settled, setSettled] = useState(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [accuracyM, setAccuracyM] = useState<number | null>(null);
  const [debug, setDebug] = useState<LocationDebug>({
    accuracyM: null,
    smoothedM: null,
    ageS: null,
    mocked: null,
    gpsAvailable: null,
    networkAvailable: null,
    rejected: 0,
    accepted: 0,
  });
  /** The fix currently on screen, so a worse one can be refused. */
  const held = useRef<Fix | null>(null);
  const counts = useRef({ accepted: 0, rejected: 0 });
  const [heading, setHeading] = useState<number | null>(null);
  const filter = useRef(createHeadingFilter());
  /* Averages fixes while the rider is still, and refuses to redraw for noise. */
  const posFilter = useRef(createPositionFilter());
  /** When the GPS last gave a direction of travel. While recent, it beats the compass. */
  const lastCourseAt = useRef<number | null>(null);
  const watching = useRef<Location.LocationSubscription | null>(null);
  const compass = useRef<Location.LocationSubscription | null>(null);
  const mounted = useRef(true);

  const stopWatching = () => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = null;
    watching.current?.remove();
    watching.current = null;
    compass.current?.remove();
    compass.current = null;
    filter.current.reset();
    posFilter.current.reset();
    setHeading(null);
  };

  const readPosition = useCallback(async (live: boolean) => {
    /*
      The remembered fix first, always. It returns immediately, where a live fix can take
      several seconds outdoors and never arrive indoors. Showing the old position now and
      replacing it when the real one lands beats an empty map that resolves eventually.
    */
    try {
      /*
        BOUNDED, both ways. Unqualified, this returns whatever fix the phone last stored,
        which can be hours old and a city away — and the app would draw it confidently as
        "you". Five minutes and 500 metres is the widest that is still worth showing while
        a real fix arrives. Outside that, nothing is the honest answer.
      */
      const last = await Location.getLastKnownPositionAsync({
        maxAge: 5 * 60 * 1000,
        requiredAccuracy: 500,
      });
      if (last && mounted.current) {
        setPosition([last.coords.longitude, last.coords.latitude]);
        setAccuracyM(last.coords.accuracy ?? null);
        setStale(true);
        held.current = { accuracy: last.coords.accuracy ?? null, timestamp: last.timestamp };
        setDebug((d) => ({
          ...d,
          accuracyM: last.coords.accuracy ?? null,
          ageS: Math.round((Date.now() - last.timestamp) / 1000),
          mocked: last.mocked ?? null,
        }));
      }
    } catch {
      /* No remembered fix is a normal state on a fresh phone, not a failure. */
    }

    if (!live) return;
    stopWatching();
    /*
      A fresh search. The timer is the "or 15 seconds" half of the rule: whatever the GPS
      has managed by then is what the rider gets, with the rough-fix banner if it is poor.
    */
    setSettled(false);
    settleTimer.current = setTimeout(() => mounted.current && setSettled(true), SETTLE_TIMEOUT_MS);
    try {
      watching.current = await Location.watchPositionAsync(
        {
          /*
            HIGH, NOT BALANCED. This was the bug behind "it put me across the street".

            expo documents Balanced as "accurate to within one hundred meters", and
            `LocationHelpers.kt` maps it to Android's PRIORITY_BALANCED_POWER_ACCURACY,
            which resolves position from WiFi and cell towers and never consults the GPS
            chip. A hundred metres in Metro Manila is the next block. High maps to
            PRIORITY_HIGH_ACCURACY and is documented as "within ten meters".

            NOT BestForNavigation, which pulls in extra sensors for turn-by-turn and costs
            battery this app has no use for. A rider looking for a shop needs to be on the
            right side of the road, not on the right metre of it.
          */
          accuracy: Location.Accuracy.High,
          /*
            Five metres, and a time floor as well. Distance alone means a phone standing
            still never updates — so the first rough fix would stay on screen even as the
            GPS narrowed it down, which looks exactly like being stuck in the wrong place.
          */
          distanceInterval: 5,
          /*
            One second, not three. On a moving bike the map now follows
            the rider and the arrow follows the direction of travel, and a reading every
            three seconds made both move in visible jumps. The smoothing below still stops
            a still phone from redrawing for noise.
          */
          timeInterval: 1000,
        },
        (p) => {
          if (!mounted.current) return;

          /*
            DIRECTION OF TRAVEL, taken from EVERY fix, including ones the accuracy gate
            below refuses: a slightly rough position still knows which way it is moving.
            See course.ts for why this beats the compass while the bike is moving.
          */
          const course = courseIfMoving(p.coords.speed, p.coords.heading);
          if (course !== null) {
            lastCourseAt.current = Date.now();
            setHeading(course);
          }
          const next: Fix = { accuracy: p.coords.accuracy ?? null, timestamp: p.timestamp };

          /*
            THE GATE THAT WAS MISSING. Android's fused provider mixes sources: an 8-metre
            satellite fix can be followed a second later by a 200-metre WiFi fix, simply
            because that is what arrived next. Taking every update meant the newest always
            won, so a good fix was thrown away for a bad one and the dot moved to the next
            street. Refusing a much worse reading is the whole fix.
          */
          if (!isBetterFix(next, held.current, Date.now())) {
            counts.current.rejected += 1;
            setDebug((d) => ({ ...d, rejected: counts.current.rejected }));
            return;
          }

          held.current = next;
          counts.current.accepted += 1;

          /*
            SMOOTHED, NOT RAW. In dense streets every fix carries 60-90 m of uncertainty,
            and two readings 40 m apart are not evidence the rider moved — they are the
            same reading with different noise. Drawing whichever arrived last is what
            makes the dot wander across the block while someone stands still.
          */
          const fixed = posFilter.current.push({
            lng: p.coords.longitude,
            lat: p.coords.latitude,
            accuracy: p.coords.accuracy ?? null,
            timestamp: p.timestamp,
          });
          if (fixed) setPosition([fixed.lng, fixed.lat]);
          setAccuracyM(fixed ? fixed.accuracy : (p.coords.accuracy ?? null));
          setStale(false);
          if (isGoodFix(p.coords.accuracy)) setSettled(true);
          setDebug((d) => ({
            ...d,
            /* The raw figure, so the readout still reports what the OS actually said. */
            accuracyM: p.coords.accuracy ?? null,
            smoothedM: fixed ? Math.round(fixed.accuracy) : null,
            ageS: Math.round((Date.now() - p.timestamp) / 1000),
            mocked: p.mocked ?? null,
            accepted: counts.current.accepted,
          }));
        },
      );
    } catch {
      /* Watching can fail if the switch goes off between the check and the call. */
    }

    /*
      The compass, separately from position.

      `trueHeading` is north corrected for magnetic declination and is what a map wants,
      but it needs location permission and reports -1 without it. `magHeading` always
      works. Taking true when it is real and magnetic otherwise means the arrow points
      somewhere sensible in both cases rather than snapping to north.
    */
    try {
      compass.current = await Location.watchHeadingAsync((h) => {
        if (!mounted.current) return;
        /* Moving: the GPS course is already driving the arrow, and it is the better answer. */
        if (courseIsFresh(lastCourseAt.current, Date.now())) return;
        const deg = h.trueHeading >= 0 ? h.trueHeading : h.magHeading;
        const next = filter.current.push(deg, h.accuracy, Date.now());
        /* null means this reading changes nothing worth drawing. Most of them do not. */
        if (next === null) return;

        /*
          Folded back into 0-360. The filter emits an UNWRAPPED angle so that animating
          between two readings takes the short way round; nothing animates it now, and a
          map's icon rotation wants a plain bearing.
        */
        setHeading(((next % 360) + 360) % 360);
      });
    } catch {
      /* A device with no magnetometer simply never gets an arrow direction. */
    }
  }, []);

  const recheck = useCallback(async () => {
    /*
      Services BEFORE permission. If the phone's own switch is off, the permission answer
      is irrelevant — we could hold permission and still get nothing — and telling a rider
      to grant a permission they already granted is the wrong instruction.
    */
    const services = await Location.hasServicesEnabledAsync().catch(() => false);
    if (!services) {
      if (!mounted.current) return;
      stopWatching();
      setStatus('servicesOff');
      await readPosition(false);
      return;
    }

    /* `get`, not `request`: this must never raise a dialog on its own. */
    const perm = await Location.getForegroundPermissionsAsync().catch(() => null);
    if (!mounted.current) return;

    if (perm?.granted) {
      setStatus('ready');
      /*
        Which providers the phone is actually willing to use. `gpsAvailable: false` is the
        single most useful thing to know when a position is wrong: it means no amount of
        asking for high accuracy will help, because the chip is not in play.
      */
      Location.getProviderStatusAsync()
        .then((ps) =>
          mounted.current &&
          setDebug((d) => ({
            ...d,
            gpsAvailable: ps.gpsAvailable ?? null,
            networkAvailable: ps.networkAvailable ?? null,
          })),
        )
        .catch(() => {});
      await readPosition(true);
      return;
    }

    stopWatching();
    setStatus(perm?.canAskAgain === false ? 'blocked' : 'denied');
    await readPosition(false);
  }, [readPosition]);

  const request = useCallback(async () => {
    const services = await Location.hasServicesEnabledAsync().catch(() => false);
    if (!services) {
      /* Asking for permission while the phone's switch is off produces a granted
         permission and still no position, which looks like the app is broken. */
      setStatus('servicesOff');
      return;
    }
    await Location.requestForegroundPermissionsAsync().catch(() => null);
    await recheck();
  }, [recheck]);

  /**
   * Force one fresh high-accuracy reading, now.
   *
   * `watchPositionAsync` only reports when the rider moves five metres or three seconds
   * pass, so a phone sitting still can hold a coarse first fix for a while. Pressing
   * recentre is the rider saying "where am I, actually" — this asks the chip directly
   * rather than moving the camera to whatever is already on screen.
   */
  const refresh = useCallback(async () => {
    try {
      const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      if (!mounted.current) return;
      /* Deliberately bypasses the better-fix gate: the rider asked for THIS reading. */
      held.current = { accuracy: p.coords.accuracy ?? null, timestamp: p.timestamp };
      counts.current.accepted += 1;
      /* The rider asked for THIS reading, so the averaging history is discarded. */
      posFilter.current.reset();
      posFilter.current.push({
        lng: p.coords.longitude,
        lat: p.coords.latitude,
        accuracy: p.coords.accuracy ?? null,
        timestamp: p.timestamp,
      });
      setPosition([p.coords.longitude, p.coords.latitude]);
      setAccuracyM(p.coords.accuracy ?? null);
      setStale(false);
      if (isGoodFix(p.coords.accuracy)) setSettled(true);
      setDebug((d) => ({
        ...d,
        accuracyM: p.coords.accuracy ?? null,
        ageS: 0,
        mocked: p.mocked ?? null,
        accepted: counts.current.accepted,
      }));
    } catch {
      /* Nothing to do: the position already on screen stays. */
    }
  }, []);

  const improveAccuracy = useCallback(async () => {
    /* Rejects when the rider declines the dialog, which is not an error. */
    await Location.enableNetworkProviderAsync().catch(() => {});
    await recheck();
  }, [recheck]);

  const openSettings = useCallback(() => {
    if (status === 'servicesOff' && Platform.OS === 'android') {
      /*
        The phone's location screen, not this app's page. `sendIntent` is core React
        Native, so this needs no extra package. If the intent is unavailable the app
        settings page is a worse but non-broken fallback.
      */
      Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS').catch(() => {
        Linking.openSettings().catch(() => {});
      });
      return;
    }
    Linking.openSettings().catch(() => {});
  }, [status]);

  useEffect(() => {
    mounted.current = true;
    void recheck();

    /*
      Re-read on every return to the foreground. This is what makes the settings trip
      work: the rider leaves, flips the switch, comes back, and the app already knows —
      without them having to find and press anything to confirm it.
    */
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void recheck();
    });

    return () => {
      mounted.current = false;
      sub.remove();
      stopWatching();
    };
  }, [recheck]);

  return {
    status,
    position,
    stale,
    finding: status === 'ready' && !settled,
    accuracyM,
    debug,
    heading,
    request,
    refresh,
    improveAccuracy,
    openSettings,
    recheck,
  };
}

/**
 * ONE GATE FOR THE WHOLE APP.
 *
 * `useLocationGateState` starts a position watch, a compass watch and a permission check.
 * Calling it from three screens would start three of each: three subscriptions draining
 * the battery, three filters each holding their own idea of where the rider is, and — the
 * visible one — more than one permission dialog.
 *
 * So it runs exactly once, here, and every screen reads the same value. This is the same
 * rule that made `RealMap` take position as a prop instead of fetching its own; a
 * provider is how it holds once more than two screens need it.
 */
const LocationContext = createContext<LocationGate | null>(null);

export function LocationProvider({ children }: { children: ReactNode }) {
  const value = useLocationGateState();
  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocationGate(): LocationGate {
  const value = useContext(LocationContext);
  if (!value) {
    /*
      Loud on purpose. A silent fallback would start a second watch and reintroduce
      exactly the problem this provider exists to prevent, somewhere far from the cause.
    */
    throw new Error('useLocationGate must be used inside <LocationProvider>');
  }
  return value;
}
