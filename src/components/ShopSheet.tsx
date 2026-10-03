import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { useTourTarget } from '@/components/Tour';
import { useSettings } from '@/lib/settings/store';

/**
 * The panel under the map: the shop list, or one shop. It rests in one of three places,
 * and the rider drags between them:
 *
 *   MAP     only the grab bar and the radius chips show; the map has the screen
 *   BOTH    the default: map above, list below
 *   LIST    the list has the screen, the map is hidden behind it
 *
 * There is no Map / Both / List switch: dragging does all three, and the tutorial
 * teaches it by pointing at the grab bar.
 *
 * TWO FIXES LIVE IN THIS FILE.
 *
 * 1. THE NAV-BUTTON OVERLAP. The panel is as tall as the whole area under the band and
 *    rests by sliding DOWN, so at "both" its bottom 30% hung below the usable screen,
 *    behind the phone's back/home buttons, still drawing rows and still taking taps. The
 *    home screen now clips that area (`overflow: hidden` on the stage), and the panel pads
 *    its content by however far it has slid, so the last row ends above the buttons.
 *
 * 2. SMOOTHNESS. The drag ran in JavaScript (PanResponder), which shares a thread with
 *    everything else the app does, so a busy moment made it stutter. It now runs on the
 *    phone's UI thread with Gesture Handler and Reanimated. Both were compiled into the
 *    1.1.0 APK from the start, so this ships over the air.
 *
 * CONTROLLED: the home screen owns which position the panel is in and passes it down;
 * the panel animates to it and reports drags back. One owner, so the two can never
 * disagree about where the panel is.
 *
 * SHARED VALUES USE get()/set(), NOT `.value`. This app compiles with the React Compiler
 * (`reactCompiler: true` in app.json), and Reanimated's documentation says `.value` is not
 * safe under it; get()/set() is the compiler-compliant form.
 *
 * THE DRAG AREA IS THE WHOLE HEADER, and still holds real buttons: the gesture only
 * claims a clearly VERTICAL move (more than 8 px), and gives up on a sideways one (the
 * radius chips scroll sideways). A tap never moves far enough to count.
 */

export type SheetPosition = 'list' | 'both' | 'map';

/**
 * The part of the panel still showing in Map mode: the grab bar and the radius chips. The
 * chips are worth keeping in view there, and a bare bar alone would be too thin to grab.
 */
export const STRIP_HEIGHT = 82;

/** How far down the panel's top edge sits, in pixels, for each position. */
export function sheetTop(position: SheetPosition, available: number): number {
  if (position === 'list') return 0;
  if (position === 'both') return Math.round(available * 0.3);
  return Math.max(available - STRIP_HEIGHT, 0);
}

/** Top to bottom, which is also the order of `sheetTop`. */
const ORDER: SheetPosition[] = ['list', 'both', 'map'];

/* Damped hard: a panel that bounces reads as a toy, not a tool. */
const SPRING = { damping: 26, stiffness: 240, mass: 0.8 };

export function ShopSheet({
  children,
  header,
  available,
  position,
  onPositionChange,
}: {
  children: ReactNode;
  /** Controls that sit above the list AND form part of the drag target. */
  header?: ReactNode;
  /** Height the panel can travel within: the area under the band. */
  available: number;
  /** Where the panel should be. Owned by the screen. */
  position: SheetPosition;
  /** A drag asked for a new position. */
  onPositionChange: (p: SheetPosition) => void;
}) {
  const { theme } = useSettings();
  const s = styles(theme);
  const grabRef = useTourTarget('sheet-grab');

  const y = useSharedValue(sheetTop(position, available));
  const start = useSharedValue(0);

  /* Whenever the wanted position (or the room available) changes, glide there. */
  useEffect(() => {
    y.set(withSpring(sheetTop(position, available), SPRING));
  }, [position, available, y]);

  const tops = ORDER.map((p) => sheetTop(p, available));

  /*
    `onStart`, `onUpdate` and `onEnd` run on the UI thread, which is why they only touch
    shared values and plain numbers, and hand the result back to React with `runOnJS`.
  */
  const pan = Gesture.Pan()
    .activeOffsetY([-8, 8])
    .failOffsetX([-12, 12])
    .onStart(() => {
      start.set(y.get());
    })
    .onUpdate((e) => {
      y.set(Math.min(Math.max(start.get() + e.translationY, tops[0]), tops[2]));
    })
    .onEnd((e) => {
      /* Otherwise: whichever resting place is nearest. */
      const now = y.get();
      const from = start.get();
      let i = 0;
      for (let k = 1; k < tops.length; k += 1) {
        if (Math.abs(tops[k] - now) < Math.abs(tops[i] - now)) i = k;
      }
      /*
        A fast flick beats proximity: throwing the panel means "the next place that way",
        even after a short move.
      */
      if (e.velocityY > 800) {
        i = tops.length - 1;
        for (let k = 0; k < tops.length; k += 1) {
          if (tops[k] > from + 1) {
            i = k;
            break;
          }
        }
      } else if (e.velocityY < -800) {
        i = 0;
        for (let k = tops.length - 1; k >= 0; k -= 1) {
          if (tops[k] < from - 1) {
            i = k;
            break;
          }
        }
      }
      y.set(withSpring(tops[i], SPRING));
      runOnJS(onPositionChange)(ORDER[i]);
    });

  const moving = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));

  return (
    <Animated.View style={[s.sheet, { height: available }, moving]}>
      <GestureDetector gesture={pan}>
        <View>
          <View ref={grabRef} style={s.grabArea} collapsable={false}>
            <View style={s.grabBar} />
          </View>

          {header}
        </View>
      </GestureDetector>

      {/*
        Padded by how far the panel has slid down, so its content ends where the screen
        does instead of below it (fix 1 above).
      */}
      <View style={[s.body, { paddingBottom: sheetTop(position, available) }]}>{children}</View>
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
      /* Lifts the panel off the map so the edge reads even where both are light. */
      shadowColor: '#000',
      shadowOpacity: 0.18,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: -3 },
      elevation: 12,
      overflow: 'hidden',
    },
    /* Taller than the bar needs, so a thumb finds it. */
    grabArea: { paddingTop: 10, paddingBottom: 10, alignItems: 'center' },
    grabBar: { width: 48, height: 5, borderRadius: 3, backgroundColor: theme.line },
    body: { flex: 1 },
  });
