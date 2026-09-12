import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Dimensions, PanResponder, StyleSheet, View } from 'react-native';

import { useSettings } from '@/lib/settings/store';

/**
 * The shop list as a sheet that can be dragged over the map.
 *
 * THREE RESTING POSITIONS, not free-floating. A sheet that stops wherever the finger
 * lets go feels broken, because the rider has to aim. Snapping means a flick in either
 * direction always lands somewhere deliberate:
 *
 *   PEEK      the map owns the screen, a couple of rows visible underneath
 *   HALF      the default: map and list roughly even
 *   FULL      the list owns the screen, the map is a strip at the top
 *
 * WHY PanResponder AND NOT a gesture library: `react-native-gesture-handler` and
 * `react-native-reanimated` are both already in the build, and either could do this
 * with smoother physics. PanResponder is core React Native, needs nothing new, and the
 * same approach already survived the star-rating work — where the real bug turned out
 * to be handlers being rebuilt mid-gesture, not the API. That lesson is applied here:
 * the responder is created ONCE in a ref and reads everything through refs, so no
 * re-render can tear the drag apart while a finger is down.
 */

const SCREEN_H = Dimensions.get('window').height;

/** Distance from the top of the sheet area to each resting position, in pixels. */
function snapPoints(available: number) {
  return {
    full: 0,
    half: Math.round(available * 0.42),
    peek: Math.round(available * 0.74),
  };
}

export type SheetPosition = 'full' | 'half' | 'peek';

export function ShopSheet({
  children,
  available = SCREEN_H,
  initial = 'half',
  onPositionChange,
}: {
  children: ReactNode;
  /** Height the sheet can travel within: the screen minus the band above it. */
  available?: number;
  initial?: SheetPosition;
  onPositionChange?: (p: SheetPosition) => void;
}) {
  const { theme } = useSettings();
  const points = snapPoints(available);

  const translateY = useRef(new Animated.Value(points[initial])).current;
  /** Where the sheet sat when the current drag began. */
  const dragStart = useRef(points[initial]);
  /** Current resting position, read by the responder without causing a re-render. */
  const position = useRef<SheetPosition>(initial);
  const pointsRef = useRef(points);
  pointsRef.current = points;
  const notifyRef = useRef(onPositionChange);
  notifyRef.current = onPositionChange;

  const [, forceRender] = useState(0);

  const settle = useCallback((to: SheetPosition) => {
    position.current = to;
    notifyRef.current?.(to);
    Animated.spring(translateY, {
      toValue: pointsRef.current[to],
      useNativeDriver: true,
      /* Damped hard: a sheet that bounces reads as a toy, not a tool. */
      damping: 24,
      stiffness: 220,
      mass: 0.8,
    }).start();
    forceRender((n) => n + 1);
  }, [translateY]);

  /* Created once. Rebuilding this mid-drag is what broke the star rating. */
  const responder = useRef(
    PanResponder.create({
      /*
        Only the handle claims the gesture. If the whole sheet did, the list inside it
        could never be scrolled — every swipe would drag the sheet instead.
      */
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 4,
      onPanResponderTerminationRequest: () => false,

      onPanResponderGrant: () => {
        dragStart.current = pointsRef.current[position.current];
      },
      onPanResponderMove: (_e, g) => {
        const p = pointsRef.current;
        const next = Math.min(Math.max(dragStart.current + g.dy, p.full), p.peek);
        translateY.setValue(next);
      },
      onPanResponderRelease: (_e, g) => {
        const p = pointsRef.current;
        const landed = dragStart.current + g.dy;

        /*
          A fast flick beats proximity. Someone throwing the sheet downward means "show
          me the map" even if they only moved forty pixels, and snapping back to where
          they started would feel like the app ignored them.
        */
        if (g.vy > 0.6) {
          settleRef.current(position.current === 'full' ? 'half' : 'peek');
          return;
        }
        if (g.vy < -0.6) {
          settleRef.current(position.current === 'peek' ? 'half' : 'full');
          return;
        }

        /* Otherwise: whichever resting point the sheet was left nearest. */
        const nearest = (['full', 'half', 'peek'] as SheetPosition[]).reduce((best, key) =>
          Math.abs(p[key] - landed) < Math.abs(p[best] - landed) ? key : best,
        );
        settleRef.current(nearest);
      },
    }),
  ).current;

  /* The frozen responder reaches the current `settle` through this. */
  const settleRef = useRef(settle);
  settleRef.current = settle;

  useEffect(() => {
    translateY.setValue(pointsRef.current[position.current]);
  }, [available, translateY]);

  const s = styles(theme);

  return (
    <Animated.View style={[s.sheet, { height: available, transform: [{ translateY }] }]}>
      {/*
        The grab area is deliberately tall. A 4px bar is a visual cue, not a target —
        a thumb needs roughly ten times that to hit reliably.
      */}
      <View {...responder.panHandlers} style={s.grabArea}>
        <View style={s.grabBar} />
      </View>
      <View style={s.body}>{children}</View>
    </Animated.View>
  );
}

const styles = (theme: ReturnType<typeof useSettings>['theme']) =>
  StyleSheet.create({
    sheet: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      backgroundColor: theme.bg,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      /* Lifts the sheet off the map so the edge reads even where both are light. */
      shadowColor: '#000',
      shadowOpacity: 0.18,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: -3 },
      elevation: 12,
      overflow: 'hidden',
    },
    grabArea: { paddingTop: 10, paddingBottom: 8, alignItems: 'center' },
    grabBar: { width: 44, height: 5, borderRadius: 3, backgroundColor: theme.line },
    body: { flex: 1 },
  });
