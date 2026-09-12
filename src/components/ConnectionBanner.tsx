import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useOnline } from '@/lib/net/useOnline';
import { useSettings } from '@/lib/settings/store';

/**
 * Slides down when the connection drops, and stays. Slides down when it comes back,
 * then leaves after a moment.
 *
 * The asymmetry is the point. Offline is a state the rider needs to keep seeing,
 * because it changes what the app can do — ratings are blocked, the shop list is a
 * saved copy. Back online is an event: worth confirming once, then it is just the
 * normal state and should stop taking up the screen.
 */

const SLIDE_MS = 260;
const BACK_ONLINE_VISIBLE_MS = 2200;

export function ConnectionBanner() {
  const online = useOnline();
  const { theme } = useSettings();
  const insets = useSafeAreaInsets();

  const [visible, setVisible] = useState(false);
  const [mode, setMode] = useState<'offline' | 'online'>('offline');
  const slide = useRef(new Animated.Value(-120)).current;
  /* Remember the last known state so the first reading never claims "back online". */
  const previous = useRef<boolean | null>(null);

  useEffect(() => {
    if (online === null) return;

    const wasOnline = previous.current;
    previous.current = online;

    if (!online) {
      setMode('offline');
      setVisible(true);
      return;
    }

    /*
      Only announce a recovery if we actually saw a drop. Without this check, opening
      the app on a working connection would flash "Back online" at a rider who was
      never offline.
    */
    if (wasOnline === false) {
      setMode('online');
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), BACK_ONLINE_VISIBLE_MS);
      return () => clearTimeout(timer);
    }

    setVisible(false);
  }, [online]);

  useEffect(() => {
    Animated.timing(slide, {
      toValue: visible ? 0 : -120,
      duration: SLIDE_MS,
      /*
        Transform only, driven natively, so the slide stays smooth even while the list
        below is re-rendering.
      */
      useNativeDriver: true,
    }).start();
  }, [visible, slide]);

  const offline = mode === 'offline';
  const s = styles(theme);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        s.wrap,
        offline ? s.wrapOffline : s.wrapOnline,
        { paddingTop: insets.top + 10, transform: [{ translateY: slide }] },
      ]}
      accessibilityLiveRegion="polite"
    >
      <View style={s.row}>
        <View style={[s.dot, offline ? s.dotOffline : s.dotOnline]} />
        <Text style={[s.text, offline ? s.textOffline : s.textOnline]}>
          {offline
            ? 'No connection · showing saved shops'
            : 'Back online'}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = (theme: ReturnType<typeof useSettings>['theme']) =>
  StyleSheet.create({
    wrap: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      /* Above every screen, including anything a route pushes on top. */
      zIndex: 1000,
      elevation: 8,
      /*
        Deliberately slight. This is an ambient status line, not an alert: it should be
        noticed without being read, and never own the screen. Half the previous height,
        a translucent ground instead of a solid fill, and no border.
      */
      paddingBottom: 7,
      paddingHorizontal: 18,
    },
    /*
      Translucent, so the screen stays readable behind it and the strip reads as an
      overlay rather than a slab that pushed the app down.
    */
    wrapOffline: { backgroundColor: theme.alert, opacity: 0.86 },
    wrapOnline: { backgroundColor: theme.call, opacity: 0.86 },

    row: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    dot: { width: 6, height: 6, borderRadius: 3 },
    dotOffline: { backgroundColor: theme.onFilled, opacity: 0.85 },
    dotOnline: { backgroundColor: theme.onFilled, opacity: 0.85 },

    text: { fontSize: 12, fontWeight: '600', flexShrink: 1, color: theme.onFilled },
    textOffline: {},
    textOnline: {},
  });
