import { useCallback, useRef } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import { useSettings } from '@/lib/settings/store';

/**
 * Five stars. Tap or drag, either direction, 0.5 steps, with a way back to nothing.
 *
 * WHY THE PREVIOUS VERSION JITTERED — the real cause, not the one I guessed twice:
 *
 * The responder callbacks were inline arrow functions. Every drag movement calls
 * `onChange`, which re-renders the parent, which creates NEW function identities, which
 * React re-attaches to the view MID-GESTURE. Tracking was being torn down and rebuilt
 * on every single move event. It felt worse dragging right-to-left because that path
 * crosses more star boundaries per pixel of travel early on.
 *
 * The fix is `PanResponder`, created ONCE in a ref and never recreated. Its handlers
 * read the current value and measurements out of refs, so the gesture keeps the same
 * handler objects from touch-down to release no matter how many times the screen
 * re-renders underneath it.
 *
 * `gestureState.moveX` and `x0` are ABSOLUTE screen coordinates, so direction of travel
 * is irrelevant — left-to-right and right-to-left are the same arithmetic.
 *
 * Still true from the earlier fixes: the touch BAND is full width and thumb-height
 * while the measured STRIP is only as wide as the stars, and the ScrollView is refused
 * the gesture once a drag begins.
 */

const STAR = 46;
const GAP = 10;
const COUNT = 5;

export function StarRating({
  value,
  onChange,
  onDragStart,
  onDragEnd,
}: {
  value: number;
  onChange: (value: number) => void;
  /** Called on touch-down and release so the parent can freeze its ScrollView. */
  onDragStart?: () => void;
  onDragEnd?: () => void;
}) {
  const { theme } = useSettings();
  const stripRef = useRef<View>(null);

  /** Live values the gesture reads. Refs, so the responder never needs rebuilding. */
  const originX = useRef(0);
  const width = useRef(0);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const dragStartRef = useRef<(() => void) | undefined>(undefined);
  const dragEndRef = useRef<(() => void) | undefined>(undefined);
  dragStartRef.current = onDragStart;
  dragEndRef.current = onDragEnd;

  const measure = useCallback(() => {
    stripRef.current?.measureInWindow((x, _y, w) => {
      if (w > 0) {
        originX.current = x;
        width.current = w;
      }
    });
  }, []);

  const onStripLayout = useCallback(
    (e: LayoutChangeEvent) => {
      width.current = e.nativeEvent.layout.width;
      measure();
    },
    [measure],
  );

  /* Created once. The empty-ish dependency list is the entire point of this component. */
  const responder = useRef(
    PanResponder.create({
      /*
        CAPTURE phase. The plain `onStartShouldSetPanResponder` asks on the way back UP
        the tree, by which point the ScrollView above has already had its chance to
        claim the touch. The capture variants ask on the way DOWN, so this view wins
        before the ScrollView is ever offered the gesture. This is the piece that was
        missing: a mostly-horizontal drag inside a vertical ScrollView is exactly the
        case the scroll container is built to grab.
      */
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      /* And never hand it back mid-drag. */
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,

      onPanResponderGrant: (_e, g) => {
        dragStartRef.current?.();
        applyRef.current(g.x0);
      },
      onPanResponderMove: (_e, g) => {
        applyRef.current(g.moveX);
      },
      onPanResponderRelease: () => dragEndRef.current?.(),
      onPanResponderTerminate: () => dragEndRef.current?.(),
    }),
  ).current;

  /*
    The responder above is frozen at first render, so it cannot close over `applyAt`
    directly. It calls through this ref, which always points at the current function.
  */
  const applyRef = useRef((pageX: number) => {});
  applyRef.current = (pageX: number) => {
    const w = width.current;
    if (w <= 0) return;
    const ratio = Math.min(Math.max((pageX - originX.current) / w, 0), 1);
    /* Round UP to the next half: the left half of star one is 0.5, its right half 1. */
    const stepped = Math.ceil(ratio * COUNT * 2) / 2;
    onChangeRef.current(Math.min(Math.max(stepped, 0.5), COUNT));
  };

  const s = styles(theme);

  return (
    <View style={s.wrap}>
      <View
        style={s.band}
        /* Re-measure on touch-down: the strip moves when the screen scrolls. */
        onTouchStart={measure}
        {...responder.panHandlers}
        accessibilityRole="adjustable"
        accessibilityLabel="Rating"
        accessibilityValue={{ min: 0, max: 5, now: value }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'increment') onChange(Math.min(value + 0.5, COUNT));
          if (e.nativeEvent.actionName === 'decrement') onChange(Math.max(value - 0.5, 0));
        }}
      >
        <View ref={stripRef} onLayout={onStripLayout} style={s.strip} pointerEvents="none">
          {Array.from({ length: COUNT }, (_, i) => {
            const filled = Math.min(Math.max(value - i, 0), 1);
            return (
              <View key={i} style={s.starBox}>
                <Text style={[s.star, s.starEmpty]}>★</Text>
                {filled > 0 && (
                  <View style={[s.clip, { width: STAR * filled }]}>
                    <Text style={[s.star, s.starFull]}>★</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </View>

      <View style={s.footer}>
        <Text style={s.hint}>
          {value === 0 ? 'Tap a star, or drag across them' : `${value.toFixed(1)} of 5`}
        </Text>

        {/*
          A way back to nothing. Without this, a mis-tap could only be undone by leaving
          the screen and returning, which is what happened before.
        */}
        {value > 0 && (
          <Pressable
            onPress={() => onChange(0)}
            hitSlop={12}
            style={s.clear}
            accessibilityRole="button"
            accessibilityLabel="Clear rating"
          >
            <Text style={s.clearLabel}>Clear</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = (theme: ReturnType<typeof useSettings>['theme']) =>
  StyleSheet.create({
    wrap: { gap: 2 },
    /* Listens. Full width, thumb-height. */
    band: {
      alignSelf: 'stretch',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 22,
    },
    /* Measured. Only as wide as the stars. */
    strip: { flexDirection: 'row', gap: GAP },
    starBox: { width: STAR, height: STAR },
    clip: { position: 'absolute', left: 0, top: 0, height: STAR, overflow: 'hidden' },
    star: { fontSize: STAR, lineHeight: STAR, width: STAR },
    starEmpty: { color: theme.line },
    starFull: { color: theme.star },

    footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14 },
    hint: { fontSize: 13, color: theme.ink3 },
    clear: { paddingVertical: 4, paddingHorizontal: 8 },
    clearLabel: { fontSize: 13, fontWeight: '700', color: theme.call },
  });
