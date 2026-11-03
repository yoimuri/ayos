import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Image, StyleSheet, View, type ImageSourcePropType } from 'react-native';

import type { Theme } from '@/lib/theme/tokens';

/** One dash plus the gap after it, in dp. The road moves by exactly this, then repeats. */
const PERIOD = 18;
const ROAD_H = 104;

/**
 * THE SIZE PREVIEW: the bike from above, riding up the right-hand lane of a two-lane road.
 *
 * The bike stays put and the centre line flows down past it, the way the road moves under
 * a rider, so it reads as riding without the bike ever leaving the box. The line is a
 * column of dashes slid down by one dash-and-gap and snapped back, looping; the snap is
 * invisible because the dashes then sit exactly where the previous ones were. Moved on
 * the native driver, so it costs the JavaScript thread nothing.
 *
 * Still for riders who turned on "Remove animations" in the phone's settings.
 */
export function RoadPreview({
  bike,
  size,
  theme,
  light = false,
}: {
  bike: ImageSourcePropType;
  size: number;
  theme: Theme;
  /** Graphics: Light. The road stays still. */
  light?: boolean;
}) {
  /* State, not a ref: made once, and read while drawing (the compiler forbids refs there). */
  const [flow] = useState(() => new Animated.Value(0));
  const [still, setStill] = useState(false);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((on) => alive && setStill(on))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (still || light) return;
    const loop = Animated.loop(
      Animated.timing(flow, { toValue: 1, duration: 320, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [flow, still, light]);

  const dashes = Array.from({ length: Math.ceil(ROAD_H / PERIOD) + 1 }, (_, i) => i);
  const s = styles(theme);
  return (
    <View style={s.road}>
      <View style={s.asphalt}>
        <Animated.View
          style={[
            s.line,
            { transform: [{ translateY: flow.interpolate({ inputRange: [0, 1], outputRange: [-PERIOD, 0] }) }] },
          ]}
        >
          {dashes.map((i) => (
            <View key={i} style={s.dash} />
          ))}
        </Animated.View>
        {/*
          Centred in the right lane. The road is 80 px wide (two 40 px lanes), so the right
          lane's middle is 60 px in; the picture is square and mostly empty around the bike.
        */}
        <Image
          source={bike}
          style={{ position: 'absolute', width: size, height: size, left: 60 - size / 2, top: (ROAD_H - size) / 2 }}
          resizeMode="contain"
        />
      </View>
    </View>
  );
}

const styles = (theme: Theme) =>
  StyleSheet.create({
    road: { width: 132, height: ROAD_H, borderRadius: 14, overflow: 'hidden', backgroundColor: theme.mapBg },
    asphalt: {
      position: 'absolute',
      left: 26,
      width: 80,
      top: 0,
      bottom: 0,
      overflow: 'hidden',
      backgroundColor: theme.mapLine,
      borderLeftWidth: 2,
      borderRightWidth: 2,
      borderColor: '#FFFFFF',
    },
    line: { position: 'absolute', left: 37, top: 0 },
    dash: { width: 2, height: PERIOD / 2, marginBottom: PERIOD / 2, backgroundColor: '#FFFFFF' },
  });
