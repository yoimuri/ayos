import Geolocation, { type GeolocationResponse } from '@react-native-community/geolocation';
import { Platform } from 'react-native';

/**
 * LOCATION ON PHONES WITHOUT GOOGLE (Huawei nova Y61 and every Huawei since 2019).
 *
 * expo-location reads every position through Google Play Services' fused location client
 * (LocationModule.kt: `LocationServices.getFusedLocationProviderClient`) and has no other path.
 * On a phone without Google's services those requests fail quietly: the watch reports itself
 * started, no reading ever arrives, and the app sits at the area centre. The map, the compass and
 * the permission checks do not need Google, which is why the rest of the app works there.
 *
 * This is the other path: Android's own location system (LocationManager), which every Android
 * phone has, through @react-native-community/geolocation set to `locationProvider: 'android'`.
 * It is slower to a first fix than Google's, so it is the FALLBACK, started only when Google's
 * path has given nothing (useLocationGate.tsx), never the first choice.
 *
 * TWO REQUESTS, because the Android mode watches ONE source: with high accuracy it is the GPS chip,
 * which can take a minute outdoors and never answers indoors. So it first asks once for a quick
 * rough fix from WiFi and cell towers (or the phone's own last one, up to 10 minutes old), then
 * watches the GPS for the real one. Both go through the same accuracy gate as Google's readings.
 */

/** The same shape useLocationGate reads from expo-location, so one handler serves both paths. */
export type Reading = {
  coords: { latitude: number; longitude: number; accuracy: number | null; speed: number | null; heading: number | null };
  timestamp: number;
  mocked?: boolean;
};

let configured = false;

function toReading(p: GeolocationResponse): Reading {
  return {
    coords: {
      latitude: p.coords.latitude,
      longitude: p.coords.longitude,
      accuracy: p.coords.accuracy ?? null,
      speed: p.coords.speed ?? null,
      heading: p.coords.heading ?? null,
    },
    timestamp: p.timestamp,
  };
}

/**
 * Start reading from Android's own location system. Returns a stop function. Does nothing on iOS.
 * Permission is never asked here: useLocationGate already holds it before this runs.
 */
export function startAndroidLocation(onReading: (r: Reading) => void, onError: (message: string) => void): () => void {
  if (Platform.OS !== 'android') return () => {};
  if (!configured) {
    Geolocation.setRNConfiguration({ skipPermissionRequests: true, locationProvider: 'android' });
    configured = true;
  }
  let stopped = false;
  const fail = (e: { message?: string }) => !stopped && onError(e?.message ?? 'Android location failed');

  Geolocation.getCurrentPosition(
    (p) => !stopped && onReading(toReading(p)),
    fail,
    { enableHighAccuracy: false, timeout: 15_000, maximumAge: 10 * 60 * 1000 },
  );
  const watchId = Geolocation.watchPosition((p) => !stopped && onReading(toReading(p)), fail, {
    enableHighAccuracy: true,
    distanceFilter: 5,
    interval: 1000,
    fastestInterval: 1000,
  });
  return () => {
    stopped = true;
    Geolocation.clearWatch(watchId);
  };
}
