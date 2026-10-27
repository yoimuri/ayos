import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Shop } from '@/lib/data/types';
import { AHEAD_M, type AheadOf } from '@/lib/nearby/ahead';
import { useSettings } from '@/lib/settings/store';

/**
 * THE "SHOP AHEAD" BANNER, over the top of the map while riding.
 *
 * One shop: its distance and side, its name and whether it is open; tapping opens it.
 * Several at once: one line ("4 shops ahead within 150 m") that opens into a short list,
 * so a busy street is one tap rather than four buzzes.
 *
 * Big text and big targets: it is read at a glance on a handlebar mount. It goes away by
 * itself after a few seconds (the home screen times it) or with the close button.
 */
export function ShopAheadBanner({
  items,
  onOpen,
  onClose,
}: {
  items: AheadOf<Shop>[];
  onOpen: (shop: Shop) => void;
  onClose: () => void;
}) {
  const { theme, t } = useSettings();
  const s = styles(theme);
  const [expanded, setExpanded] = useState(false);
  const first = items[0];
  const many = items.length > 1;
  const statusText = (shop: Shop) =>
    shop.status === 'open' && shop.openUntil ? t.openUntil(shop.openUntil) : shop.status === 'open' ? t.open : t.unknown;

  return (
    <View style={s.wrap} pointerEvents="box-none">
      <View style={s.card}>
        <Pressable
          onPress={() => (many ? setExpanded((e) => !e) : onOpen(first.shop))}
          style={({ pressed }) => [s.main, pressed && s.pressed]}
          accessibilityRole="button"
          accessibilityLiveRegion="polite"
        >
          <Text style={s.icon}>🔧</Text>
          <View style={s.textCol}>
            <Text style={s.title} numberOfLines={1}>
              {many ? t.shopsAheadMany(items.length, AHEAD_M) : t.shopAheadOne(first.metres, first.side)}
            </Text>
            {!many && (
              <Text style={s.sub} numberOfLines={1}>
                {first.shop.name} · {statusText(first.shop)}
              </Text>
            )}
          </View>
        </Pressable>
        <Pressable onPress={onClose} hitSlop={10} style={s.close} accessibilityRole="button" accessibilityLabel={t.dismiss}>
          <Text style={s.closeText}>✕</Text>
        </Pressable>
      </View>

      {many && expanded && (
        <View style={s.list}>
          {items.slice(0, 4).map((a) => (
            <Pressable
              key={a.shop.id}
              onPress={() => onOpen(a.shop)}
              style={({ pressed }) => [s.row, pressed && s.pressed]}
              accessibilityRole="button"
            >
              <Text style={s.rowName} numberOfLines={1}>
                {a.shop.name}
              </Text>
              <Text style={s.rowMeta}>{t.aheadWhere(a.metres, a.side)}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = (theme: ReturnType<typeof useSettings>['theme']) =>
  StyleSheet.create({
    wrap: { position: 'absolute', top: 12, left: 12, right: 12, gap: 6, zIndex: 20, elevation: 20 },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 16,
      backgroundColor: theme.call,
      paddingLeft: 14,
      paddingRight: 8,
      minHeight: 64,
      shadowColor: '#000',
      shadowOpacity: 0.25,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
      elevation: 6,
    },
    main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
    icon: { fontSize: 24 },
    textCol: { flex: 1, gap: 2 },
    title: { fontSize: 17, fontWeight: '800', color: theme.onFilled },
    sub: { fontSize: 14, fontWeight: '600', color: theme.onFilled, opacity: 0.92 },
    close: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    closeText: { fontSize: 18, fontWeight: '700', color: theme.onFilled },
    list: {
      borderRadius: 14,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.line,
      overflow: 'hidden',
      elevation: 6,
    },
    row: {
      minHeight: 52,
      paddingHorizontal: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.lineSoft,
    },
    rowName: { flex: 1, fontSize: 16, fontWeight: '700', color: theme.ink },
    rowMeta: { fontSize: 14, color: theme.ink2 },
    pressed: { opacity: 0.6 },
  });
