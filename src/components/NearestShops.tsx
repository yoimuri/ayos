import { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { Shop, ShopTag } from '@/lib/data/types';
import { splitDistance } from '@/lib/geo/distance';
import { fetchRoadKm } from '@/lib/map/roadLine';
import { rankByRoad, shortlist } from '@/lib/nearby/nearestShops';
import { useSettings } from '@/lib/settings/store';
import type { Theme } from '@/lib/theme/tokens';

const KINDS: ShopTag[] = ['repair', 'parts', 'dealer', 'accessories'];

/**
 * The panel the Nearest shop button opens: a choice of kind, up to 3 shops (lib/nearby/nearestShops.ts)
 * and a 911 button. It sits over the shop panel, with the map still in view above it, so the rider
 * sees the road line to whichever card they tapped.
 *
 * ESTIMATES FIRST, THEN THE REAL ROADS: the cards show at once from the straight-line estimate, so a
 * rider with no signal still gets an answer, and re-order when the road distances arrive. Once they
 * have, the first card is selected, unless the rider already tapped one.
 *
 * THE LIST IS TAKEN ONCE, when the panel opens or a kind is picked, not on every GPS reading: the
 * cards should not shuffle under a finger, and each list costs a request to a volunteer-run server.
 *
 * 911 opens the phone's dialler with the number filled in; the rider still presses call, so a
 * mis-tap never reaches the emergency line. Unified 911 is the Philippines' national hotline.
 */
export function NearestShopsPanel({
  shops,
  rider,
  selectedId,
  onSelect,
  onClose,
  onHeight,
}: {
  /** Every shop, not the filtered list: a radius or a chip must not hide the nearest one. */
  shops: Shop[];
  /** Null with no position, when "nearest" means nothing. */
  rider: [number, number] | null;
  selectedId?: string;
  onSelect: (shop: Shop) => void;
  onClose: () => void;
  onHeight: (height: number) => void;
}) {
  const { theme, t } = useSettings();
  const s = styles(theme);
  const [kind, setKind] = useState<ShopTag>('repair');
  const [list, setList] = useState<Shop[]>(() => (rider ? shortlist(shops, 'repair') : []));
  const [road, setRoad] = useState<(number | null)[] | null>(null);
  /* The rider tapped a card, so the road distances arriving must not move the selection. */
  const tapped = useRef(false);

  const pick = (next: ShopTag) => {
    if (next === kind) return;
    tapped.current = false;
    setKind(next);
    setRoad(null);
    setList(rider ? shortlist(shops, next) : []);
  };

  useEffect(() => {
    if (!rider || list.length === 0) return;
    const cancel = new AbortController();
    fetchRoadKm(rider, list.map((shop) => [shop.lng, shop.lat]), cancel.signal).then((km) => {
      if (cancel.signal.aborted) return;
      setRoad(km);
      const first = rankByRoad(list, km)[0];
      if (first && !tapped.current) onSelect(first.shop);
    });
    return () => cancel.abort();
    /* Once per list. `rider` moves with every GPS reading, and `onSelect` needs no new request. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list]);

  const label: Record<ShopTag, string> = {
    repair: t.kindRepair,
    parts: t.kindParts,
    dealer: t.kindDealer,
    accessories: t.kindAccessories,
  };
  const nearby = rankByRoad(list, road);

  const card = (shop: Shop, roadKm: number | null) => {
    const isOpen = shop.status === 'open';
    return (
      <Pressable
        key={shop.id}
        onPress={() => {
          tapped.current = true;
          onSelect(shop);
        }}
        style={[s.card, selectedId === shop.id && s.cardOn]}
        accessibilityRole="button"
        accessibilityState={{ selected: selectedId === shop.id }}
        accessibilityLabel={shop.name}
      >
        <Text style={s.name} numberOfLines={1}>
          {shop.name}
        </Text>
        <View style={s.meta}>
          <View style={[s.pill, isOpen ? s.pillOpen : s.pillUnknown]}>
            <Text style={[s.pillText, isOpen ? s.pillOpenText : s.pillUnknownText]}>
              {isOpen ? (shop.openUntil ? t.openUntil(shop.openUntil) : t.open) : t.callFirst}
            </Text>
          </View>
          {/* The ≈ marks an estimate, so a number without it is the real road. */}
          <Text style={s.distance}>
            {roadKm !== null ? roadKm.toFixed(2) : `≈ ${splitDistance(shop.distance_m).value}`} {t.km.toLowerCase()}
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
  };

  return (
    <View style={s.panel} onLayout={(e) => onHeight(Math.round(e.nativeEvent.layout.height))}>
      <View style={s.head}>
        <Text style={s.title}>{t.nearestShop}</Text>
        <Pressable onPress={onClose} style={s.close} hitSlop={8} accessibilityRole="button" accessibilityLabel={t.close}>
          <Text style={s.closeGlyph}>✕</Text>
        </Pressable>
      </View>
      <View style={s.kinds}>
        {KINDS.map((k) => (
          <Pressable
            key={k}
            onPress={() => pick(k)}
            style={[s.kind, kind === k && s.kindOn]}
            accessibilityRole="button"
            accessibilityState={{ selected: kind === k }}
          >
            <Text style={[s.kindText, kind === k && s.kindTextOn]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
              {label[k]}
            </Text>
          </Pressable>
        ))}
      </View>
      <ScrollView style={s.scroll} contentContainerStyle={s.cards} showsVerticalScrollIndicator={false}>
        {nearby.map((x) => card(x.shop, x.roadKm))}
        {nearby.length === 0 && <Text style={s.none}>{rider ? t.noShopFound : t.nearestNeedsLocation}</Text>}
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
      /* Three cards scroll inside this, so the road line above still has room. */
      maxHeight: '62%',
      backgroundColor: theme.bg,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      paddingHorizontal: 14,
      paddingTop: 10,
      paddingBottom: 12,
      gap: 8,
      zIndex: 20,
      elevation: 20,
    },
    head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    title: { fontSize: 18, fontWeight: '700', color: theme.ink },
    close: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center' },
    closeGlyph: { fontSize: 15, color: theme.ink2 },
    kinds: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 14, backgroundColor: theme.surface },
    kind: { flex: 1, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 },
    kindOn: { backgroundColor: theme.ink },
    kindText: { fontSize: 13, fontWeight: '600', color: theme.ink2 },
    kindTextOn: { color: theme.bg, fontWeight: '700' },
    scroll: { flexShrink: 1, flexGrow: 0 },
    cards: { gap: 8 },
    card: {
      backgroundColor: theme.surface,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: theme.line,
      padding: 12,
      gap: 6,
    },
    cardOn: { borderColor: theme.ink },
    name: { fontSize: 16, fontWeight: '700', color: theme.ink },
    meta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    pill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 5 },
    pillOpen: { backgroundColor: theme.openFill },
    pillUnknown: { backgroundColor: theme.mapBg },
    pillText: { fontSize: 12, fontWeight: '700' },
    pillOpenText: { color: theme.open },
    pillUnknownText: { color: theme.ink2 },
    distance: { fontSize: 14, color: theme.ink2 },
    buttons: { flexDirection: 'row', gap: 8, marginTop: 2 },
    btn: { flex: 1, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    btnMain: { backgroundColor: theme.call },
    btnMainText: { color: theme.onFilled, fontSize: 15, fontWeight: '700' },
    btnPlain: { backgroundColor: theme.surface, borderWidth: 1.5, borderColor: theme.line },
    btnPlainText: { color: theme.ink, fontSize: 15, fontWeight: '700' },
    none: { fontSize: 15, color: theme.ink2, paddingVertical: 12 },
    emergency: { height: 48, borderRadius: 14, backgroundColor: theme.accentFill, alignItems: 'center', justifyContent: 'center' },
    emergencyText: { color: theme.accent, fontSize: 16, fontWeight: '700' },
    pressed: { opacity: 0.7 },
  });
