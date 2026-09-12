import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Dimensions, PanResponder, StyleSheet, View } from 'react-native';

import { useSettings } from '@/lib/settings/store';

/**
 * The shop list as a sheet that can be dragged over the map.
 *
 * THREE RESTING POSITIONS, not free-floating. A sheet that stops wherever the finger
 * lets go feels broken, because the rider has to aim. Snapping means a flick in either
 * direction always lands somewhere deliberate:
 *
 *   PEEK      the map owns the screen, the controls and one row still visible
 *   HALF      the default: map on top, about three rows underneath
 *   FULL      the list owns the screen, the map is a strip at the top
 *
 * THE GRAB AREA IS THE WHOLE HEADER, NOT THE LITTLE BAR. The first version made only
 * the bar draggable, which is 23 pixels tall. A thumb is wider than that, so most
 * downward swipes landed on the chips or the list and did nothing at all. That reads as
 * the app ignoring you, which is the same complaint the star rating drew, and for the
 * same underlying reason: the gesture was never claimed in the first place.
 *
 * So the caller passes its controls in as `header`, and everything from the bar down to
 * the bottom of that header drags the sheet.
 *
 * HOW THE HEADER STILL WORKS AS CONTROLS. Two rules let a drag area contain buttons:
 *
 *   - it never claims on START, so a tap always reaches the chip underneath;
 *   - it only claims a move that is clearly VERTICAL, so the horizontal chip strip
 *     keeps its own scrolling.
 *
 * WHY PanResponder AND NOT a gesture library: `react-native-gesture-handler` and
 * `react-native-reanimated` are both compiled into the build and would run this on the
 * UI thread instead of in JavaScript. That is the genuinely smoother answer and it is
 * written up in docs/BACKLOG.md. PanResponder is core React Native and needs nothing
 * new, and the fault here was never the API. It was a target too small to hit.
 *
 * The lesson from the star rating still holds: the responder is created ONCE in a ref
 * and reads everything through refs, so no re-render can tear a drag apart mid-gesture.
 */

const SCREEN_H = Dimensions.get('window').height;

/**
 * Distance from the top of the sheet area to each resting position, in pixels.
 *
 * These fractions are measured, not chosen by eye. The header inside the sheet costs
 * about 116dp and a shop row about 85dp, so a resting point only earns its name if what
 * is left below it can hold the rows that name implies. The previous peek at 0.74 left
 * less room than the header alone needed, so "a couple of rows visible" showed none.
 */
function snapPoints(available: number) {
  return {
    full: 0,
    half: Math.round(available * 0.3),
    peek: Math.round(available * 0.58),
  };
}

export type SheetPosition = 'full' | 'half' | 'peek';

export function ShopSheet({
  children,
  header,
  available = SCREEN_H,
  initial = 'half',
  onPositionChange,
}: {
  children: ReactNode;
  /** Controls that sit above the list AND form part of the drag target. */
  header?: ReactNode;
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

  /*
    This deliberately triggers no re-render of its own.

    The first version called a forceRender here. Nothing in this component's output
    depends on which point it settled at, so that re-render did no useful work. It just
    re-rendered the entire shop list at the exact moment the spring started, competing
    with the animation for the one thread both of them run on. That is felt as a hitch
    on every single snap.
  */
  const settle = (to: SheetPosition) => {
    position.current = to;
    notifyRef.current?.(to);
    Animated.spring(translateY, {
      toValue: pointsRef.current[to],
      /*
        FALSE, and it has to match the drag.

        A drag driven by PanResponder can only ever be scrubbed from JavaScript, with
        setValue on every move event. Handing the release spring to the native driver
        while JavaScript owns the drag leaves one value written from two sides, which is
        a documented source of a transform that stutters or stops updating. One owner
        for the whole gesture beats a faster half.
      */
      useNativeDriver: false,
      /* Damped hard: a sheet that bounces reads as a toy, not a tool. */
      damping: 24,
      stiffness: 220,
      mass: 0.8,
    }).start();
  };

  /* The frozen responder reaches the current `settle` through this. */
  const settleRef = useRef(settle);
  settleRef.current = settle;

  /* Created once. Rebuilding this mid-drag is what broke the star rating. */
  const responder = useRef(
    PanResponder.create({
      /*
        NEVER on start. The header holds real buttons, and claiming the gesture the
        instant a finger lands would swallow every tap on the radius chips. A drag does
        not need the gesture until the finger has actually moved.
      */
      onStartShouldSetPanResponder: () => false,
      /*
        Vertical-dominant moves only. Anything more sideways than downward belongs to
        the horizontal chip strip. Six pixels of slop keeps a slightly untidy tap from
        registering as a drag.
      */
      onMoveShouldSetPanResponder: (_e, g) =>
        Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx),
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

  useEffect(() => {
    translateY.setValue(pointsRef.current[position.current]);
  }, [available, translateY]);

  const s = styles(theme);

  return (
    <Animated.View style={[s.sheet, { height: available, transform: [{ translateY }] }]}>
      {/*
        Everything inside this View drags the sheet: the bar, the radius chips and the
        list heading. Roughly 116dp of target instead of 23.
      */}
      <View {...responder.panHandlers}>
        <View style={s.grabArea}>
          <View style={s.grabBar} />
        </View>
        {header}
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
