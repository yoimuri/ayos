import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import type { Shop } from '@/lib/dev/sample-shops';
import { useSettings } from '@/lib/settings/store';

/**
 * A DRAWN PLACEHOLDER FOR THE MAP. NOT A REAL MAP.
 *
 * No tiles, no geography, no panning. Streets are decoration. It exists so the map
 * screen can be reviewed and demonstrated before build order step 6, when
 * `@maplibre/maplibre-react-native` goes in and replaces this file entirely.
 *
 * Why a fake instead of the real thing: MapLibre is a native module. Adding it costs
 * one of fifteen monthly builds and cannot reach an installed phone over the air.
 * This is plain React Native, so it ships as a free JavaScript update.
 *
 * IT MEASURES ITSELF. It used to be a fixed 260px box with the pin arithmetic derived
 * from that constant, which meant it could not fill a screen. Now it fills whatever it
 * is given and recomputes on layout, so the sheet above it can be dragged down and the
 * map simply becomes the screen.
 *
 * Pin placement IS derived from the data: each shop's bearing decides direction and its
 * distance decides how far from the centre it sits, scaled to the furthest shop shown.
 * The picture rearranges correctly when the area, radius or search changes.
 */

function positionFor(
  shop: Shop,
  maxDistance: number,
  index: number,
  cx: number,
  cy: number,
  maxR: number,
) {
  const ratio = maxDistance > 0 ? shop.distance_m / maxDistance : 0;
  const r = maxR * 0.22 + ratio * (maxR - maxR * 0.22);

  const base = { N: -90, E: 0, S: 90, W: 180 }[shop.bearing];
  /*
    Fan pins apart when several share a bearing. Without this, three shops due north
    stack into what looks like one pin and the rider cannot tap the ones underneath.
  */
  const spread = ((index % 3) - 1) * 20;
  const rad = ((base + spread) * Math.PI) / 180;

  return { left: cx + r * Math.cos(rad) - 14, top: cy + r * Math.sin(rad) - 28 };
}

export function MockMap({
  shops,
  radiusLabel,
  onPressPin,
  /** Where the visual centre sits vertically, 0 to 1. Lifted when a sheet covers the bottom. */
  centerBias = 0.5,
}: {
  shops: Shop[];
  radiusLabel: string;
  onPressPin: (shop: Shop) => void;
  centerBias?: number;
}) {
  const { theme, t, settings } = useSettings();
  const [box, setBox] = useState({ w: 0, h: 0 });
  const s = styles(theme);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setBox({ w: width, h: height });
  };

  const cx = box.w / 2;
  const cy = box.h * centerBias;
  /* Keep the whole ring on screen whichever dimension is tighter. */
  const maxR = Math.max(40, Math.min(box.w, box.h * centerBias * 2) * 0.36);
  const maxDistance = shops.reduce((max, shop) => Math.max(max, shop.distance_m), 0);
  const ready = box.w > 0 && box.h > 0;

  return (
    <View style={s.wrap} onLayout={onLayout}>
      {/* Decorative streets. They mean nothing; they stop the area reading as an error. */}
      <View style={[s.street, { top: '22%', left: 0, right: 0, height: 2 }]} />
      <View style={[s.street, { top: '54%', left: 0, right: 0, height: 2 }]} />
      <View style={[s.street, { top: '80%', left: 0, right: 0, height: 2 }]} />
      <View style={[s.street, { left: '28%', top: 0, bottom: 0, width: 2 }]} />
      <View style={[s.street, { left: '68%', top: 0, bottom: 0, width: 2 }]} />
      <View style={s.arterial} />

      {ready && settings.showRadiusRing && (
        <View
          style={[
            s.ring,
            { left: cx - maxR, top: cy - maxR, width: maxR * 2, height: maxR * 2, borderRadius: maxR },
          ]}
        />
      )}

      <View style={s.pill}>
        <Text style={s.pillRadius}>{radiusLabel}</Text>
        <Text style={s.pillCount}>{t.radiusPill('', shops.length).replace('· ', '')}</Text>
      </View>

      {ready &&
        shops.map((shop, index) => {
          const pos = positionFor(shop, maxDistance, index, cx, cy, maxR);
          return (
            <Pressable
              key={shop.id}
              onPress={() => onPressPin(shop)}
              style={[s.pin, pos]}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={shop.name}
            >
              <View style={s.pinHead}>
                <Text style={s.pinGlyph}>{index + 1}</Text>
              </View>
              <View style={s.pinTail} />
            </Pressable>
          );
        })}

      {ready && <View style={[s.you, { left: cx - 9, top: cy - 9 }]} />}

      <View style={[s.notReal, { top: cy + maxR + 14 }]}>
        <Text style={s.notRealText}>PLACEHOLDER MAP · REAL TILES AT STEP 6</Text>
      </View>
    </View>
  );
}

const styles = (theme: ReturnType<typeof useSettings>['theme']) =>
  StyleSheet.create({
    /* Fills whatever it is placed in, rather than a fixed height. */
    wrap: { flex: 1, backgroundColor: theme.mapBg, overflow: 'hidden' },
    street: { position: 'absolute', backgroundColor: theme.mapLine },
    arterial: {
      position: 'absolute',
      left: -60,
      right: -60,
      top: '40%',
      height: 8,
      backgroundColor: theme.mapLine,
      transform: [{ rotate: '-9deg' }],
    },

    ring: { position: 'absolute', borderWidth: 2, borderColor: theme.accent, borderStyle: 'dashed' },

    pill: {
      position: 'absolute',
      top: 12,
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 8,
      backgroundColor: theme.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.line,
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 7,
    },
    pillRadius: { fontSize: 13, fontWeight: '700', color: theme.ink },
    pillCount: { fontSize: 12.5, color: theme.ink3 },

    pin: { position: 'absolute', width: 28, alignItems: 'center' },
    pinHead: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: theme.accent,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: theme.mapBg,
    },
    pinGlyph: { fontSize: 13, fontWeight: '700', color: theme.onFilled },
    pinTail: { width: 2, height: 8, backgroundColor: theme.accent, marginTop: -1 },

    you: {
      position: 'absolute',
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: '#1660C4',
      borderWidth: 3,
      borderColor: theme.mapBg,
    },

    notReal: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
    notRealText: { fontSize: 9, letterSpacing: 0.8, color: theme.ink3, fontWeight: '700' },
  });
