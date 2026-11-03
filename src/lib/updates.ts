import * as Updates from 'expo-updates';
import { useEffect } from 'react';
import { Alert, AppState, Platform } from 'react-native';

import type { Strings } from '@/lib/i18n/strings';

/**
 * OVER-THE-AIR UPDATES, applied without closing the app.
 *
 * The APK holds the native parts; the screens and logic are a JavaScript bundle that EAS
 * Update replaces. On its own, the app checks when it opens, downloads in the background,
 * and only switches to the new bundle on the NEXT cold start, which is why testers had to
 * close and reopen it, sometimes twice.
 *
 * Three ways in, and the app never restarts by itself (a rider may be mid-ride):
 *   - `useUpdateReady`: true once an update has been DOWNLOADED, so home can offer a
 *     one-tap restart;
 *   - `useUpdateOnReturn`: checks again whenever the app comes back to the front, because
 *     Android mostly RESUMES an app rather than starting it, and the built-in check runs
 *     only on a fresh start. That was the "close and reopen twice" (Clint, 1 Nov);
 *   - `checkNow`: the Settings row, for "is there one yet?" without waiting.
 * Restarting is `Updates.reloadAsync()`: the new bundle loads in about a second, and the
 * rider's settings, saved shops and ratings are on disk, so nothing is lost.
 */

/* Development builds and the web have no update server. */
const updatesWork = Platform.OS !== 'web' && Updates.isEnabled;

/** At most one check per this long, so switching between apps does not fire a check each time. */
const RECHECK_MS = 5 * 60_000;
let lastCheck = Date.now();

/**
 * Every time the app comes back to the front: `onReturn` runs (home uses it to show the
 * update reminder again if the rider closed it, Clint, 1 Nov: "it should always pop up"),
 * then, at most every RECHECK_MS, the server is asked for a newer version, downloaded in
 * the background if there is one. A check is a small request; data is spent only when
 * something new was actually published.
 */
export function useUpdateOnReturn(onReturn: () => void) {
  useEffect(() => {
    if (!updatesWork) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      onReturn();
      const now = Date.now();
      if (now - lastCheck < RECHECK_MS) return;
      lastCheck = now;
      Updates.checkForUpdateAsync()
        .then((check) => (check.isAvailable ? Updates.fetchUpdateAsync() : undefined))
        .catch(() => {
          /* No signal or a server hiccup: the next return tries again. */
        });
    });
    return () => sub.remove();
  }, [onReturn]);
}

/** True when an update has been downloaded and is waiting for a restart. */
export function useUpdateReady(): boolean {
  const { isUpdatePending } = Updates.useUpdates();
  return updatesWork && isUpdatePending;
}

export function restartIntoUpdate() {
  return Updates.reloadAsync();
}

/**
 * Restarts the app as it is, for a change that takes full effect only on a fresh start
 * (Graphics: Standard / Light). Same mechanism as an update restart: about a second, and
 * nothing saved is lost. Where it cannot (a development build), asks the rider to reopen.
 */
export async function restartApp(t: Strings) {
  try {
    await Updates.reloadAsync();
  } catch {
    Alert.alert(t.reopenTitle, t.reopenBody);
  }
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
