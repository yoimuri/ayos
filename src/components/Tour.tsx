import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { BackHandler, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { useSettings } from '@/lib/settings/store';

/**
 * THE TUTORIAL. Points at the real app and asks the rider to use it.
 *
 * HOW IT DRAWS: four dark rectangles cover the screen everywhere EXCEPT a hole over the
 * control being taught. The rectangles swallow taps; the hole has nothing in it, so a tap
 * there lands on the real control underneath. The rider presses the actual button, not a
 * picture of one, which is what makes it interactive and why it can never drift out of
 * date with the screen it teaches.
 *
 * HOW IT ADVANCES: each step names a target. When the rider presses that target, the
 * screen calls `notify(id)` and the tour moves on. Steps where a tap would do something
 * real that must not happen during a lesson — dialling a stranger's shop — advance on the
 * Next button instead.
 *
 * WHY NOT A LIBRARY: every maintained React Native tour library draws its cut-out with
 * `react-native-svg`, which is native code this build does not contain, so any of them
 * would cost a new APK. Four rectangles need nothing and ship over the air. (Checked
 * 30 Sep 2026: react-native-copilot 3.3.3, react-native-spotlight-tour 4.0.0,
 * rn-tourguide 3.3.2.)
 *
 * THE RULES IT KEEPS:
 *   - runs once on first launch, never forced again (the flag is set when it STARTS)
 *   - Exit is always on screen, and the phone's back button exits too
 *   - large targets, plain Taglish, one idea per step
 *   - entirely on the phone, so it works with no signal
 *   - a step whose target is not on screen (no shops nearby, no location yet) is skipped
 *     rather than pointing at nothing
 */

export type TourStep = {
  /** Which registered target to highlight. */
  target: string;
  text: string;
  /** 'tap' waits for the rider to press the target. 'next' waits for the Next button. */
  advance: 'tap' | 'next';
  /**
   * Called when this step's target is not on screen, to put it there — e.g. opening the
   * nearest shop so "tap Back" has a Back button to point at. If the target still is not
   * there shortly after, the step is skipped.
   */
  before?: () => void;
};

type Rect = { x: number; y: number; w: number; h: number };

export type TourApi = {
  /** Attach to the View a step points at. */
  register: (id: string, node: View | null) => void;
  /** Tell the tour a target was pressed. Harmless when no tour is running. */
  notify: (id: string) => void;
  running: boolean;
};

const TourContext = createContext<TourApi | null>(null);

const NOOP: TourApi = { register: () => {}, notify: () => {}, running: false };

/** For any component that holds a tour target. A no-op outside the home screen. */
export function useTour(): TourApi {
  return useContext(TourContext) ?? NOOP;
}

/**
 * A ref callback that registers a View as a tour target.
 *
 * Memoised per id: a new function on every render would unregister and re-register the
 * View each time, and the overlay would lose its hole for a frame.
 */
export function useTourTarget(id: string) {
  const { register } = useTour();
  return useCallback((node: View | null) => register(id, node), [register, id]);
}

export type TourController = TourApi & {
  /** Start from the first step. */
  start: () => void;
  /** Internal to the provider below. */
  index: number | null;
  steps: TourStep[];
  layoutTick: number;
  nodeFor: (id: string) => View | null;
  go: (from: number, dir: 1 | -1) => void;
  end: () => void;
};

/**
 * THE TOUR'S STATE, owned by the screen that shows it.
 *
 * A hook rather than state hidden inside the provider, because the home screen needs to
 * call `notify` and `register` itself, and it sits ABOVE the provider it renders, so it
 * cannot read the provider's context. Holding the state here gives it those functions
 * directly.
 */
export function useTourController(steps: TourStep[]): TourController {
  const nodes = useRef(new Map<string, View>());
  const [index, setIndex] = useState<number | null>(null);
  /** Bumped whenever a target appears or goes, so the overlay re-measures. */
  const [layoutTick, setLayoutTick] = useState(0);

  const register = useCallback((id: string, node: View | null) => {
    const had = nodes.current.get(id);
    if (node) nodes.current.set(id, node);
    else nodes.current.delete(id);
    if (had !== node) setLayoutTick((n) => n + 1);
  }, []);

  const nodeFor = useCallback((id: string) => nodes.current.get(id) ?? null, []);

  const end = useCallback(() => setIndex(null), []);

  const go = useCallback(
    (from: number, dir: 1 | -1) => {
      /*
        Find the next step, in the direction of travel, whose target is on screen. A step
        that knows how to put its target on screen (`before`) gets one chance to do it.
        `budget` guarantees this ends even if nothing is ever on screen.
      */
      let budget = steps.length * 2 + 2;
      const attempt = (i: number, d: 1 | -1, primed: boolean) => {
        if (budget-- <= 0) return end();
        if (i < 0) return attempt(0, 1, false);
        if (i >= steps.length) return end();
        const step = steps[i];
        if (nodes.current.has(step.target)) return setIndex(i);
        if (step.before && !primed) {
          step.before();
          setTimeout(() => attempt(i, d, true), 400);
          return;
        }
        attempt(i + d, d, false);
      };
      attempt(from, dir, false);
    },
    [steps, end],
  );

  const start = useCallback(() => go(0, 1), [go]);

  /* Read by `notify`, which runs later from a press, never during render. */
  const indexRef = useRef(index);
  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  const notify = useCallback(
    (id: string) => {
      const i = indexRef.current;
      if (i === null || steps[i]?.target !== id) return;
      /*
        After the press has done its real job (opening a shop moves the sheet and the
        camera), so the next hole is measured where things have landed, not mid-move.
      */
      setTimeout(() => go(i + 1, 1), 450);
    },
    [steps, go],
  );

  /*
    The target went away mid-step, usually because the rider pressed it and it did its
    job (tapping a shop row replaces the list with the shop). Move on rather than point
    at nothing.
  */
  useEffect(() => {
    if (index === null) return;
    if (!nodes.current.has(steps[index].target)) go(index + 1, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutTick]);

  return {
    register,
    notify,
    running: index !== null,
    start,
    index,
    steps,
    layoutTick,
    nodeFor,
    go,
    end,
  };
}

/** Hands the tour to everything below it, and draws the overlay while it runs. */
export function TourProvider({ tour, children }: { tour: TourController; children: ReactNode }) {
  const { register, notify, running, index, steps, layoutTick, nodeFor, go, end } = tour;
  const api = useMemo<TourApi>(() => ({ register, notify, running }), [register, notify, running]);

  return (
    <TourContext.Provider value={api}>
      {children}
      {index !== null && (
        <Overlay
          step={steps[index]}
          stepNumber={index + 1}
          total={steps.length}
          nodeFor={nodeFor}
          layoutTick={layoutTick}
          onBack={index > 0 ? () => go(index - 1, -1) : undefined}
          onNext={() => go(index + 1, 1)}
          onExit={end}
        />
      )}
    </TourContext.Provider>
  );
}

const PAD = 6;

function Overlay({
  step,
  stepNumber,
  total,
  nodeFor,
  layoutTick,
  onBack,
  onNext,
  onExit,
}: {
  step: TourStep;
  stepNumber: number;
  total: number;
  nodeFor: (id: string) => View | null;
  layoutTick: number;
  onBack?: () => void;
  onNext: () => void;
  onExit: () => void;
}) {
  const { theme, t } = useSettings();
  const s = styles(theme);
  const win = useWindowDimensions();
  const root = useRef<View>(null);
  const [hole, setHole] = useState<Rect | null>(null);

  /*
    MEASURED IN WINDOW COORDINATES, BOTH SIDES. The target and this overlay can sit in
    different parents, so each reports where it is on the whole screen and the hole is the
    difference. Measured twice: once straight away, once after the sheet and camera have
    had time to finish moving.
  */
  useEffect(() => {
    let cancelled = false;
    const measure = () => {
      const node = nodeFor(step.target);
      if (!node || !root.current) return;
      root.current.measureInWindow((ox, oy) => {
        node.measureInWindow((x, y, w, h) => {
          if (!cancelled && w > 0 && h > 0) {
            setHole({ x: x - ox - PAD, y: y - oy - PAD, w: w + PAD * 2, h: h + PAD * 2 });
          }
        });
      });
    };
    const a = setTimeout(measure, 30);
    const b = setTimeout(measure, 480);
    return () => {
      cancelled = true;
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [nodeFor, step, layoutTick]);

  /* The phone's back button leaves the tour; it must never trap anyone. */
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onExit();
      return true;
    });
    return () => sub.remove();
  }, [onExit]);

  const H = win.height;
  const r = hole ?? { x: 0, y: 0, w: 0, h: 0 };
  /* The card goes on whichever side of the hole has more room. */
  const cardBelow = r.y + r.h / 2 < H / 2;

  return (
    <View ref={root} style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {hole ? (
        <>
          <Shade style={{ left: 0, right: 0, top: 0, height: Math.max(r.y, 0) }} />
          <Shade style={{ left: 0, right: 0, top: r.y + r.h, bottom: 0 }} />
          <Shade style={{ left: 0, width: Math.max(r.x, 0), top: r.y, height: r.h }} />
          <Shade style={{ left: r.x + r.w, right: 0, top: r.y, height: r.h }} />
          <View
            pointerEvents="none"
            style={[s.ring, { left: r.x, top: r.y, width: r.w, height: r.h }]}
          />
        </>
      ) : (
        <Shade style={StyleSheet.absoluteFill} />
      )}

      <View
        style={[
          s.card,
          cardBelow ? { top: Math.min(r.y + r.h + 12, H - 260) } : { bottom: Math.max(H - r.y + 12, 16) },
        ]}
      >
        <View style={s.cardHead}>
          <Text style={s.count}>
            {stepNumber} / {total}
          </Text>
          <Pressable
            onPress={onExit}
            style={s.exit}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t.tourExit}
          >
            <Text style={s.exitText}>{t.tourExit} ✕</Text>
          </Pressable>
        </View>
        <Text style={s.text}>{step.text}</Text>
        {step.advance === 'tap' && <Text style={s.hint}>{t.tourTapHint}</Text>}
        <View style={s.buttons}>
          {onBack ? (
            <Pressable onPress={onBack} style={s.secondary} accessibilityRole="button">
              <Text style={s.secondaryText}>{t.tourBack}</Text>
            </Pressable>
          ) : (
            <View style={s.spacer} />
          )}
          {/*
            Next is offered on EVERY step, tap steps included. A rider whose tap missed,
            or who does not want to, must never be stuck on a step with no way forward.
          */}
          <Pressable onPress={onNext} style={s.primary} accessibilityRole="button">
            <Text style={s.primaryText}>{stepNumber === total ? t.tourFinish : t.tourNext}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

/** One dark rectangle. Swallows touches so nothing outside the hole can be pressed. */
function Shade({ style }: { style: object }) {
  return (
    <View
      style={[{ position: 'absolute', backgroundColor: 'rgba(0,0,0,0.62)' }, style]}
      onStartShouldSetResponder={() => true}
    />
  );
}

const styles = (theme: ReturnType<typeof useSettings>['theme']) =>
  StyleSheet.create({
    ring: {
      position: 'absolute',
      borderRadius: 12,
      borderWidth: 3,
      borderColor: theme.star,
    },
    card: {
      position: 'absolute',
      left: 14,
      right: 14,
      backgroundColor: theme.surface,
      borderRadius: 16,
      padding: 18,
      gap: 10,
      elevation: 8,
      shadowColor: '#000',
      shadowOpacity: 0.25,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 3 },
    },
    cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    count: { fontSize: 13, fontWeight: '700', color: theme.ink3, letterSpacing: 0.5 },
    exit: { minHeight: 44, minWidth: 64, alignItems: 'flex-end', justifyContent: 'center' },
    exitText: { fontSize: 16, fontWeight: '700', color: theme.ink2 },
    text: { fontSize: 19, lineHeight: 27, color: theme.ink, fontWeight: '600' },
    hint: { fontSize: 15, color: theme.accent, fontWeight: '700' },
    buttons: { flexDirection: 'row', gap: 12, marginTop: 4 },
    spacer: { flex: 1 },
    secondary: {
      flex: 1,
      minHeight: 54,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: theme.line,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryText: { fontSize: 17, fontWeight: '700', color: theme.ink2 },
    primary: {
      flex: 1,
      minHeight: 54,
      borderRadius: 12,
      backgroundColor: theme.call,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryText: { fontSize: 17, fontWeight: '700', color: theme.onFilled },
  });
