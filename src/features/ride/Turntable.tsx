import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, PanResponder, StyleSheet, View, type ImageSourcePropType } from 'react-native';

import { useSettings } from '@/lib/settings/store';

/**
 * The bike on a turntable: 24 pictures, one every 15 degrees, from the same set the map uses.
 *
 * It turns slowly by itself so it is obvious that it turns. A finger dragging sideways takes
 * over (about 8 px per step, round and round); a moment after the finger lifts it carries on
 * by itself.
 *
 * All 24 pictures are mounted at once and only the current one is visible. Swapping one
 * Image's source instead flickers on Android while the next picture decodes; 24 pictures
 * held in memory (about 20 MB at this size) cost less than a flicker, and only while this
 * screen is open.
 *
 * ITS OWN SHARP PICTURES (turntable.generated.ts), not the map's: shown this big, the
 * map's 240 px, 256-colour pictures looked pixelated (Clint, 31 Oct). These are rendered at
 * three times the size, in full colour, cropped to the bike and centred on it, so every
 * angle is the same `aspect` box. They carry no shadow (storing a soft one cost too much,
 * see app_export.py), so a soft floor is drawn here where the bike stands.
 *
 * PLACED BY NUMBERS, NOT BY `contain`: left to `resizeMode="contain"` inside a wide box,
 * Android drew the picture against the box's left edge (Clint's phone, 1.3.0).
 */
export function Turntable({
  frames,
  aspect,
  ground,
  floor,
  height,
  light = false,
}: {
  frames: ImageSourcePropType[];
  aspect: number;
  /** Where the bike stands, as a part of the picture's height (from the top). */
  ground: number;
  /** How tall its floor is, as a part of the picture's height. */
  floor: number;
  height: number;
  /**
   * Graphics: Light. The turntable turns only under a finger, and keeps just the pictures
   * next to the one on show (about 4 MB instead of 20).
   */
  light?: boolean;
}) {
  const { theme, t } = useSettings();
  const [index, setIndex] = useState(0);
  const [width, setWidth] = useState(0);
  /* The frame on show, for timers and gestures (they outlive a render, so they read a ref). */
  const current = useRef(0);
  const auto = useRef(true);
  const resume = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef(0);
  const count = frames.length;

  useEffect(() => {
    const show = (k: number) => {
      current.current = ((k % count) + count) % count;
      setIndex(current.current);
    };
    const timer = setInterval(() => {
      if (auto.current && !light) show(current.current + 1);
    }, 160);
    return () => {
      clearInterval(timer);
      if (resume.current) clearTimeout(resume.current);
    };
  }, [count, light]);

  const pan = useMemo(
    () =>
      // eslint-disable-next-line react-hooks/refs -- PanResponder only stores these handlers; the refs are read when a finger moves, never while drawing
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 4,
        onPanResponderGrant: () => {
          auto.current = false;
          if (resume.current) clearTimeout(resume.current);
          start.current = current.current;
        },
        onPanResponderMove: (_, g) => {
          current.current = (((start.current - Math.round(g.dx / 8)) % count) + count) % count;
          setIndex(current.current);
        },
        onPanResponderRelease: () => {
          resume.current = setTimeout(() => {
            auto.current = true;
          }, 1200);
        },
        onPanResponderTerminate: () => {
          resume.current = setTimeout(() => {
            auto.current = true;
          }, 1200);
        },
      }),
    [count],
  );

  /* The picture fills most of the box without touching its edges. */
  const picH = width > 0 ? Math.min(height * 0.94, (width * 0.9) / aspect) : 0;
  const picW = picH * aspect;
  const picTop = (height - picH) / 2;
  const floorW = picW * 0.8;
  const floorH = picH * floor * 0.8;

  return (
    <View
      style={[s.box, { height, backgroundColor: theme.surface, borderColor: theme.lineSoft }]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessible
      accessibilityLabel={t.rideTurnHint}
      {...pan.panHandlers}
    >
      {picH > 0 && (
        <View
          style={[
            s.floor,
            {
              width: floorW,
              height: floorH,
              left: (width - floorW) / 2,
              top: picTop + picH * ground - floorH / 2,
            },
          ]}
        />
      )}
      {picH > 0 &&
        frames.map((src, i) =>
          light && Math.min((i - index + count) % count, (index - i + count) % count) > 2 ? null : (
            <Image
              key={i}
              source={src}
              style={[
                s.frame,
                {
                  width: picW,
                  height: picH,
                  top: picTop,
                  left: (width - picW) / 2,
                  opacity: i === index ? 1 : 0,
                },
              ]}
              fadeDuration={0}
            />
          ),
        )}
    </View>
  );
}

const s = StyleSheet.create({
  box: {
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
  },
  floor: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(40, 24, 12, 0.08)',
  },
  frame: {
    position: 'absolute',
  },
});
