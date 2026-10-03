import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

/**
 * Is the phone reachable right now?
 *
 * HOW: a tiny HTTPS request on a timer. If it completes, there is a connection. If it
 * fails or times out, there is not.
 *
 * WHY NOT THE PROPER WAY: the proper way is `@react-native-community/netinfo` or
 * `expo-network`, which read the operating system's own connectivity state. Both are
 * NATIVE modules, so adding either costs one of fifteen monthly builds and cannot
 * reach an already-installed phone over the air. This file is plain JavaScript, so the
 * banner ships free today.
 *
 * WHAT THE DIFFERENCE COSTS:
 *   - up to POLL_MS of delay before a change is noticed, where NetInfo is instant
 *   - a request every 15 seconds while the app is open, which NetInfo would not need
 *   - it measures "can reach the internet", not "wifi is on". Usually the more useful
 *     answer, since a connected wifi with no working uplink reads as offline here and
 *     that is what a rider actually cares about.
 *
 * Swap this for NetInfo in the same build that adds MapLibre. The component using it
 * does not change.
 */

const POLL_MS = 15_000;
const TIMEOUT_MS = 4_000;

/**
 * A 204 endpoint returns an empty body, so the check costs a few hundred bytes.
 * Expo's own CDN is used because the app already depends on reaching it for updates:
 * if this host is unreachable, over-the-air delivery is down too.
 */
const PROBE_URL = 'https://u.expo.dev/';

async function probe(): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    await fetch(PROBE_URL, { method: 'HEAD', signal: controller.signal, cache: 'no-store' });
    return true;
  } catch {
    /*
      Any failure counts as offline, including a non-2xx status, because the question
      is "did bytes move", not "was the response correct".
    */
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export function useOnline(): boolean | null {
  /* null means "not yet known", so the banner stays hidden on the very first frame. */
  const [online, setOnline] = useState<boolean | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;

    const check = async () => {
      const result = await probe();
      if (mounted.current) setOnline(result);
    };

    check();
    const interval = setInterval(check, POLL_MS);

    /*
      Check immediately when the rider returns to the app. Coming back from a dead
      spot is exactly when the answer is most likely to have changed, and waiting up
      to fifteen seconds to notice would feel broken.
    */
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });

    return () => {
      mounted.current = false;
      clearInterval(interval);
      sub.remove();
    };
  }, []);

  return online;
}
