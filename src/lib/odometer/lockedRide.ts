import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import type { Fix } from './model';

/**
 * COUNTING WITH THE PHONE LOCKED (1.4.0 build, Clint 23 Nov).
 *
 * A locked phone stops the app's normal location watch, so a ride used to count only with the
 * screen on. While a ride runs, this keeps readings coming through a "foreground service": the
 * running app shows a notification ("Ayoos ride counter"), and Android keeps giving it positions
 * with the screen off. That needs only the normal while-using permission, never "allow all the
 * time" (LocationModule.kt, startLocationUpdatesAsync: a user-started foreground service does not
 * need background location), and the service ends with the ride.
 *
 * STILL ONLY NUMBERS. Each reading goes straight to the counter (model.ts) and is dropped; no
 * position or route is kept.
 *
 * NOT ON PHONES WITHOUT GOOGLE. This goes through expo-location, which reads only through
 * Google's location service, so on a Huawei the counter still needs the screen on (the main watch
 * falls back to Android's own location there: androidFallback.ts).
 */

export const RIDE_TASK = 'ayoos-ride-counter';

let listener: ((fix: Fix) => void) | null = null;

/*
  Defined when this file is first imported (the odometer store imports it at start-up), because
  Android delivers readings to the task by name and it must exist before the first one arrives.
*/
TaskManager.defineTask<{ locations: Location.LocationObject[] }>(RIDE_TASK, async ({ data, error }) => {
  if (error || !data) return;
  for (const l of data.locations) {
    listener?.({ lng: l.coords.longitude, lat: l.coords.latitude, at: l.timestamp, accuracyM: l.coords.accuracy ?? null });
  }
});

/** Receive each locked-screen reading. Returns a function that stops listening. */
export function onLockedReading(fn: (fix: Fix) => void): () => void {
  listener = fn;
  return () => {
    if (listener === fn) listener = null;
  };
}

/** Start the foreground service for a ride. Quietly does nothing if Android refuses it. */
export async function startLockedCounting(title: string, body: string): Promise<void> {
  try {
    if (await Location.hasStartedLocationUpdatesAsync(RIDE_TASK)) return;
    await Location.startLocationUpdatesAsync(RIDE_TASK, {
      accuracy: Location.Accuracy.High,
      distanceInterval: 5,
      timeInterval: 1000,
      /* Same reason as the main watch: never depend on Google's network-location switch. */
      mayShowUserSettingsDialog: false,
      foregroundService: { notificationTitle: title, notificationBody: body, killServiceOnDestroy: true },
    });
  } catch {
    /* Refused (no permission, app not in front): the counter keeps counting with the screen on. */
  }
}

export async function stopLockedCounting(): Promise<void> {
  try {
    if (await Location.hasStartedLocationUpdatesAsync(RIDE_TASK)) await Location.stopLocationUpdatesAsync(RIDE_TASK);
  } catch {
    /* Already stopped. */
  }
}
