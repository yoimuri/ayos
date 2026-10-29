import * as Updates from 'expo-updates';
import { Alert, Platform } from 'react-native';

import type { Strings } from '@/lib/i18n/strings';

/**
 * OVER-THE-AIR UPDATES, applied without closing the app.
 *
 * The APK holds the native parts; the screens and logic are a JavaScript bundle that EAS
 * Update replaces. On its own, the app checks when it opens, downloads in the background,
 * and only switches to the new bundle on the NEXT cold start, which is why testers had to
 * close and reopen it, sometimes twice.
 *
 * Two ways in, and the app never restarts by itself (a rider may be mid-ride):
 *   - `useUpdateReady`: true once the startup check has DOWNLOADED an update, so home can
 *     offer a one-tap restart;
 *   - `checkNow`: the Settings row, for "is there one yet?" without waiting.
 * Restarting is `Updates.reloadAsync()`: the new bundle loads in about a second, and the
 * rider's settings, saved shops and ratings are on disk, so nothing is lost.
 */

/* Development builds and the web have no update server. */
const updatesWork = Platform.OS !== 'web' && Updates.isEnabled;

/** True when an update has been downloaded and is waiting for a restart. */
export function useUpdateReady(): boolean {
  const { isUpdatePending } = Updates.useUpdates();
  return updatesWork && isUpdatePending;
}

export function restartIntoUpdate() {
  return Updates.reloadAsync();
}

/** Offers the restart. "Later" leaves it for the next time the app opens. */
export function askToRestart(t: Strings, onLater?: () => void) {
  Alert.alert(t.updateReady, t.updateReadyBody, [
    { text: t.later, style: 'cancel', onPress: onLater },
    { text: t.restart, onPress: () => void restartIntoUpdate() },
  ]);
}

/* Fetch failures read like these when the phone has no signal. */
const looksOffline = (msg: string) => /network|internet|offline|timed? ?out|fetch|connect|host|resolve|unreachable|socket/i.test(msg);

/** The Settings row: check, download if there is one, then ask to restart. */
export async function checkNow(t: Strings): Promise<void> {
  if (!updatesWork) return Alert.alert(t.checkUpdates, t.updatesOff);
  try {
    const check = await Updates.checkForUpdateAsync();
    if (!check.isAvailable) return Alert.alert(t.upToDate, t.upToDateBody);
    await Updates.fetchUpdateAsync();
    askToRestart(t);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (looksOffline(msg)) Alert.alert(t.noInternet, t.noInternetBody);
    else Alert.alert(t.updateFailed, msg);
  }
}
