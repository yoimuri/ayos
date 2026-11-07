import { useMemo } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { Shop } from '@/lib/data/types';
import { splitDistance } from '@/lib/geo/distance';
import { nearestRepair } from '@/lib/nearby/nearestRepair';
import { useSettings } from '@/lib/settings/store';
import type { Theme } from '@/lib/theme/tokens';

/**
 * The panel the Nearest repair button opens: at most two shops (lib/nearby/nearestRepair.ts) and
 * a 911 button. It sits over the shop panel, with the map still in view above it, so the rider
 * sees the arrow to whichever card they tapped.
 *
 * 911 opens the phone's dialler with the number filled in; the rider still presses call, so a
 * mis-tap never reaches the emergency line. Unified 911 is the Philippines' national hotline.
 */
export function NearestRepairPanel({
  shops,
  located,
  selectedId,
  onSelect,
  onClose,
  onHeight,
}: {
  /** Every shop, not the filtered list: a radius or a chip must not hide the nearest one. */
  shops: Shop[];
  /** False with no position, when "nearest" means nothing. */
  located: boolean;
  selectedId?: string;
  onSelect: (shop: Shop) => void;
  onClose: () => void;
  onHeight: (height: number) => void;
}) {
  const { theme, t } = useSettings();
  const s = styles(theme);
  const { open, unknown } = useMemo(() => (located ? nearestRepair(shops) : { open: null, unknown: null }), [located, shops]);

  const card = (shop: Shop, isOpen: boolean) => (
    <Pressable
      key={shop.id}
      onPress={() => onSelect(shop)}
      style={[s.card, selectedId === shop.id && s.cardOn]}
      accessibilityRole="button"
      accessibilityState={{ selected: selectedId === shop.id }}
      accessibilityLabel={shop.name}
    >
      <Text style={s.name} numberOfLines={2}>
        {shop.name}
      </Text>
      <View style={s.meta}>
        <View style={[s.pill, isOpen ? s.pillOpen : s.pillUnknown]}>
          <Text style={[s.pillText, isOpen ? s.pillOpenText : s.pillUnknownText]}>
            {isOpen ? (shop.openUntil ? t.openUntil(shop.openUntil) : t.open) : t.callFirst}
          </Text>
        </View>
        <Text style={s.distance}>
          ≈ {splitDistance(shop.distance_m).value} {t.km.toLowerCase()}
        </Text>
      </View>
      <View style={s.buttons}>
        {shop.phone ? (
          <Pressable
            onPress={() => Linking.openURL(`tel:${shop.phone}`)}
            style={({ pressed }) => [s.btn, s.btnMain, pressed && s.pressed]}
            accessibilityRole="button"
          >
            <Text style={s.btnMainText}>{t.call}</Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => Linking.openURL(`geo:0,0?q=${encodeURIComponent(`${shop.name}, ${shop.address}`)}`)}
          style={({ pressed }) => [s.btn, s.btnPlain, pressed && s.pressed]}
          accessibilityRole="button"
        >
          <Text style={s.btnPlainText}>{t.directions}</Text>
        </Pressable>
      </View>
    </Pressable>
  );

  return (
    <View style={s.panel} onLayout={(e) => onHeight(Math.round(e.nativeEvent.layout.height))}>
      <View style={s.head}>
        <Text style={s.title}>{t.nearestRepair}</Text>
        <Pressable onPress={onClose} style={s.close} hitSlop={8} accessibilityRole="button" accessibilityLabel={t.close}>
          <Text style={s.closeGlyph}>✕</Text>
        </Pressable>
      </View>
      <ScrollView style={s.scroll} contentContainerStyle={s.cards} showsVerticalScrollIndicator={false}>
        {open && card(open, true)}
        {unknown && card(unknown, false)}
        {!open && !unknown && <Text style={s.none}>{located ? t.noRepairFound : t.repairNeedsLocation}</Text>}
      </ScrollView>
      <Pressable
        onPress={() => Linking.openURL('tel:911')}
        style={({ pressed }) => [s.emergency, pressed && s.pressed]}
        accessibilityRole="button"
      >
        <Text style={s.emergencyText}>{t.call911}</Text>
      </Pressable>
    </View>
  );
}

const styles = (theme: Theme) =>
  StyleSheet.create({
    panel: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      maxHeight: '72%',
      backgroundColor: theme.bg,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      paddingHorizontal: 14,
      paddingTop: 14,
      paddingBottom: 14,
      gap: 10,
      zIndex: 20,
      elevation: 20,
    },
    head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    title: { fontSize: 19, fontWeight: '700', color: theme.ink },
    close: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center' },
    closeGlyph: { fontSize: 15, color: theme.ink2 },
    scroll: { flexGrow: 0 },
    cards: { gap: 10 },
    card: {
      backgroundColor: theme.surface,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: theme.line,
      padding: 14,
      gap: 8,
    },
    cardOn: { borderColor: theme.ink },
    name: { fontSize: 17, fontWeight: '700', color: theme.ink },
    meta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    pill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 5 },
    pillOpen: { backgroundColor: theme.openFill },
    pillUnknown: { backgroundColor: theme.mapBg },
    pillText: { fontSize: 12, fontWeight: '700' },
    pillOpenText: { color: theme.open },
    pillUnknownText: { color: theme.ink2 },
    distance: { fontSize: 14, color: theme.ink2 },
    buttons: { flexDirection: 'row', gap: 8, marginTop: 2 },
    btn: { flex: 1, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    btnMain: { backgroundColor: theme.call },
    btnMainText: { color: theme.onFilled, fontSize: 15, fontWeight: '700' },
    btnPlain: { backgroundColor: theme.surface, borderWidth: 1.5, borderColor: theme.line },
    btnPlainText: { color: theme.ink, fontSize: 15, fontWeight: '700' },
    none: { fontSize: 15, color: theme.ink2, paddingVertical: 12 },
    emergency: { height: 52, borderRadius: 14, backgroundColor: theme.accentFill, alignItems: 'center', justifyContent: 'center' },
    emergencyText: { color: theme.accent, fontSize: 16, fontWeight: '700' },
    pressed: { opacity: 0.7 },
  });
