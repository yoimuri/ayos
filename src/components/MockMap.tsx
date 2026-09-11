import { Pressable, StyleSheet, Text, View } from 'react-native';

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
 * Pin placement IS derived from the data: each shop's bearing decides direction and
 * its distance decides how far from the centre it sits, scaled to the furthest shop
 * on screen. So the picture rearranges correctly when the area or search changes.
 */

const BOX = 260;
const CENTER = BOX / 2;
const MAX_R = BOX * 0.38;

function positionFor(shop: Shop, maxDistance: number, index: number) {
  const ratio = maxDistance > 0 ? shop.distance_m / maxDistance : 0;
  const r = 26 + ratio * (MAX_R - 26);

  const base = { N: -90, E: 0, S: 90, W: 180 }[shop.bearing];
  /*
    Fan pins apart when several share a bearing. Without this, three shops due north
    stack into what looks like one pin, and the rider cannot tap the ones underneath.
  */
  const spread = ((index % 3) - 1) * 22;
  const rad = ((base + spread) * Math.PI) / 180;

  return { left: CENTER + r * Math.cos(rad) - 15, top: CENTER + r * Math.sin(rad) - 30 };
}

export function MockMap({
  shops,
  radiusLabel,
  onPressPin,
}: {
  shops: Shop[];
  radiusLabel: string;
  onPressPin: (shop: Shop) => void;
}) {
  const { theme, t } = useSettings();
  const s = styles(theme);
  const maxDistance = shops.reduce((max, shop) => Math.max(max, shop.distance_m), 0);

  return (
    <View style={s.wrap}>
      {/* Decorative streets. They mean nothing; they stop the box reading as an error. */}
      <View style={[s.street, s.streetH1]} />
      <View style={[s.street, s.streetH2]} />
      <View style={[s.street, s.streetV1]} />
      <View style={[s.arterial, s.arterialD]} />

      <View style={s.ring} />

      <View style={s.pill}>
        <Text style={s.pillRadius}>{radiusLabel}</Text>
        <Text style={s.pillCount}>{t.radiusPill('', shops.length).replace('· ', '')}</Text>
      </View>

      {shops.map((shop, index) => {
        const pos = positionFor(shop, maxDistance, index);
        return (
          <Pressable
            key={shop.id}
            onPress={() => onPressPin(shop)}
            style={[s.pin, pos]}
            hitSlop={6}
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

      <View style={s.you} />

      <View style={s.notReal}>
        <Text style={s.notRealText}>PLACEHOLDER MAP · REAL TILES AT STEP 6</Text>
      </View>
    </View>
  );
}

const styles = (theme: ReturnType<typeof useSettings>['theme']) =>
  StyleSheet.create({
    wrap: {
      height: BOX,
      backgroundColor: theme.mapBg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.line,
      overflow: 'hidden',
    },
    street: { position: 'absolute', backgroundColor: theme.mapLine },
    streetH1: { left: 0, right: 0, top: '28%', height: 2 },
    streetH2: { left: 0, right: 0, top: '68%', height: 2 },
    streetV1: { top: 0, bottom: 0, left: '66%', width: 2 },
    arterial: { position: 'absolute', backgroundColor: theme.mapLine },
    arterialD: { left: -40, right: -40, top: '46%', height: 7, transform: [{ rotate: '-8deg' }] },

    ring: {
      position: 'absolute',
      left: CENTER - MAX_R,
      top: CENTER - MAX_R,
      width: MAX_R * 2,
      height: MAX_R * 2,
      borderRadius: MAX_R,
      borderWidth: 2,
      borderColor: theme.accent,
      borderStyle: 'dashed',
    },

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

    pin: { position: 'absolute', width: 30, alignItems: 'center' },
    pinHead: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: theme.accent,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: theme.surface,
    },
    pinGlyph: { fontSize: 13, fontWeight: '700', color: theme.surface },
    pinTail: {
      width: 2,
      height: 8,
      backgroundColor: theme.accent,
      marginTop: -1,
    },

    you: {
      position: 'absolute',
      left: CENTER - 9,
      top: CENTER - 9,
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: '#1660C4',
      borderWidth: 3,
      borderColor: theme.surface,
    },

    notReal: { position: 'absolute', left: 0, right: 0, bottom: 8, alignItems: 'center' },
    notRealText: { fontSize: 9, letterSpacing: 0.8, color: theme.ink3, fontWeight: '700' },
  });
