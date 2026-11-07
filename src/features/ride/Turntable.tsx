import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, PanResponder, StyleSheet, View } from 'react-native';

import { ANGLES } from '@/features/ride/catalog';
import type { StackLayer } from '@/features/ride/stack';
import { useSettings } from '@/lib/settings/store';

/** How far a finger drags for one step round the bike. */
const DRAG_PER_STEP = 40;
/** The bike steps round by itself this often, until a finger takes over. */
const AUTO_STEP_MS = 1100;
const FADE_MS = 220;
/** How each layer's sheet of 8 views is laid out (docs/design/ride3d/app_export.py). */
const SHEET_COLS = 4;
const SHEET_ROWS = 2;

/**
 * The ride on a turntable: 8 views, one every 45 degrees, each a stack of layers (bike,
 * outfit, exhaust, helmet, top box, add-ons) drawn on top of each other (features/ride/stack.ts).
 *
 * IT STEPS, it does not spin (Clint, 1 Nov: 8 angles keep every part under the update's
 * picture limit). It steps round by itself so it is obvious that it turns; a finger dragging
 * sideways takes over (one step per 40 px), and a moment after the finger lifts it carries on.
 * Each step fades over the last in a fifth of a second, so it reads as turning, not jumping.
 *
 * Only the view on show and the one fading out are mounted. Both cut their tiles from the
 * same sheets, so the phone holds one sheet per layer in memory, whatever the ride.
 *
 * PLACED BY NUMBERS, NOT BY `contain`: left to `resizeMode="contain"` inside a wide box,
 * Android drew the picture against the box's left edge (Clint's phone, 1.3.0). Every layer
 * of a vehicle shares one crop box (`aspect`), so they stack exactly; the shared helmet is a
 * small crop placed on the head (`helmet.turn`). The pictures carry no shadow, so a soft
 * floor is drawn here where the bike stands.
 */
export function Turntable({
  stack,
  aspect,
  ground,
  floor,
  height,
}: {
  stack: StackLayer[];
  aspect: number;
  /** Where the bike stands, as a part of the picture's height (from the top). */
  ground: number;
  /** How tall its floor is, as a part of the picture's height. */
  floor: number;
  height: number;
}) {
  const { theme, t } = useSettings();
  const [index, setIndex] = useState(0);
  const [prev, setPrev] = useState<number | null>(null);
  const [width, setWidth] = useState(0);
  const [fade] = useState(() => new Animated.Value(1));
  const [fadeOut] = useState(() => fade.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }));
  const [solid] = useState(() => new Animated.Value(1));
  /* The view on show, for timers and gestures (they outlive a render, so they read a ref). */
  const current = useRef(0);
  const auto = useRef(true);
  const resume = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef(0);

  const show = useCallback(
    (k: number) => {
      const next = ((k % ANGLES) + ANGLES) % ANGLES;
      if (next === current.current) return;
      setPrev(current.current);
      current.current = next;
      setIndex(next);
      fade.setValue(0);
      Animated.timing(fade, { toValue: 1, duration: FADE_MS, useNativeDriver: true }).start(({ finished }) => {
        if (finished) setPrev(null);
      });
    },
    [fade],
  );

  useEffect(() => {
    const timer = setInterval(() => {
      if (auto.current) show(current.current + 1);
    }, AUTO_STEP_MS);
    return () => {
      clearInterval(timer);
      if (resume.current) clearTimeout(resume.current);
    };
  }, [show]);

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
        onPanResponderMove: (_, g) => show(start.current - Math.round(g.dx / DRAG_PER_STEP)),
        onPanResponderRelease: () => {
          resume.current = setTimeout(() => {
            auto.current = true;
          }, 1500);
        },
        onPanResponderTerminate: () => {
          resume.current = setTimeout(() => {
            auto.current = true;
          }, 1500);
        },
      }),
    [show],
  );

  /* The picture fills most of the box without touching its edges. */
  const picH = width > 0 ? Math.min(height * 0.94, (width * 0.9) / aspect) : 0;
  const picW = picH * aspect;
  const picTop = (height - picH) / 2;
  const picLeft = (width - picW) / 2;
  const floorW = picW * 0.8;
  const floorH = picH * floor * 0.8;

  /*
    One view of the ride: every layer's tile for angle `i`, stacked. Each layer's 8 views are
    ONE sheet, 4 across and 2 down (an update may carry at most 1000 files: app_export.py).
    The box is one tile big and clips; the whole sheet sits behind it, moved so tile `i`
    lands in the box.
  */
  const view = (i: number, opacity: Animated.AnimatedInterpolation<number> | Animated.Value) => (
    <Animated.View key={`view-${i}`} style={[StyleSheet.absoluteFill, { opacity }]} pointerEvents="none">
      {stack.map((layer) => {
        const h = layer.helmet?.turn;
        const box = h
          ? { left: picLeft + h.at[i][0] * picW, top: picTop + h.at[i][1] * picH, width: h.w * picW, height: h.h * picH }
          : { left: picLeft, top: picTop, width: picW, height: picH };
        const sheet = {
          left: -(i % SHEET_COLS) * box.width,
          top: -Math.floor(i / SHEET_COLS) * box.height,
          width: box.width * SHEET_COLS,
          height: box.height * SHEET_ROWS,
        };
        return (
          <View key={layer.name} style={[s.tile, box]}>
            <Image source={layer.pics.turn} style={[s.frame, sheet]} fadeDuration={0} />
          </View>
        );
      })}
    </Animated.View>
  );

  return (
    <View
      style={[s.box, { height, backgroundColor: theme.surface, borderColor: theme.lineSoft }]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessible
      accessibilityLabel={t.rideTurnHint}
      {...pan.panHandlers}
    >
      {picH > 0 && (
        <>
          <View
            style={[s.floor, { width: floorW, height: floorH, left: (width - floorW) / 2, top: picTop + picH * ground - floorH / 2 }]}
          />
          {prev !== null && view(prev, fadeOut)}
          {view(index, prev !== null ? fade : solid)}
        </>
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
  tile: {
    position: 'absolute',
    overflow: 'hidden',
  },
});
