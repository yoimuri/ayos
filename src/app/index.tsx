import { Link, useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { BrandHeader, Wordmark } from '@/components/BrandBar';
import { ShopSheet, type SheetPosition } from '@/components/ShopSheet';
import { ContactIcon, GearIcon } from '@/components/icons';
import { MockMap } from '@/components/MockMap';
import {
  RADIUS_OPTIONS,
  SAMPLE_SHOPS,
  roughMinutes,
  shopsForArea,
  splitDistance,
  type Shop,
} from '@/lib/dev/sample-shops';
import { AREA_LABELS, useSettings, type Area } from '@/lib/settings/store';

const SHOP_TOTAL = SAMPLE_SHOPS.length;

/**
 * Home. Map on top, list underneath.
 *
 * The map is a drawn placeholder (see components/MockMap) until build step 6. The list
 * below it is real: it filters by the rider's chosen area, filters again as they type,
 * and always orders by distance.
 */

export default function HomeScreen() {
  const { theme, t, settings, update } = useSettings();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [cityOpen, setCityOpen] = useState(false);
  /*
    The area below the brand band, measured rather than assumed. The sheet needs a
    real number to compute its resting positions against, and the band's height
    changes with the phone's status bar and the rider's font size.
  */
  const [stageH, setStageH] = useState(0);
  const [sheetAt, setSheetAt] = useState<SheetPosition>('half');
  /* Held so the wordmark can send a long list back to the top. */
  const listRef = useRef<FlatList<Shop>>(null);

  /** Shops for the chosen area, already distance-sorted by the data layer. */
  const areaShops = useMemo(
    () => shopsForArea(settings.area, settings.radiusM),
    [settings.area, settings.radiusM],
  );
  /* Unfiltered count for the city chips, so a chip never reads 0 just because of radius. */
  const cityCounts = useMemo(() => {
    const counts: Partial<Record<Area, number>> = {};
    (Object.keys(AREA_LABELS) as Area[]).forEach((a) => {
      counts[a] = shopsForArea(a, null).length;
    });
    return counts;
  }, []);

  /*
    Filtering happens on every keystroke because `query` is state and this recomputes.
    There is no search button and no debounce: the whole list is already on the device,
    so matching a dozen names costs nothing. Pressing enter just dismisses the keyboard.
  */
  const shops = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return areaShops;
    return areaShops.filter(
      (shop) =>
        shop.name.toLowerCase().includes(needle) ||
        shop.tags.some((tag) => tag.includes(needle)),
    );
  }, [areaShops, query]);

  const s = styles(theme);

  return (
    <SafeAreaView style={s.screen} edges={['top', 'bottom']}>
      {/*
        Everything that answers "where am I looking" lives in the band: the wordmark,
        search, the city and settings. Everything below it is results.
      */}
      <BrandHeader>
        <View style={s.bandTop}>
          <Wordmark size={25} />
          <Text style={s.bandArea} numberOfLines={1}>
            {settings.area ? AREA_LABELS[settings.area].toUpperCase() : 'METRO MANILA'}
          </Text>
          <View style={s.grow} />
          <Pressable
            onPress={() => router.push('/settings')}
            style={s.bandIconBtn}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t.settings}
          >
            <GearIcon size={19} color={theme.bandInk} />
          </Pressable>
        </View>

        <View style={s.searchWrap}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t.findShop}
            placeholderTextColor={theme.ink3}
            style={s.search}
            returnKeyType="search"
            autoCorrect={false}
            accessibilityLabel={t.findShop}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} style={s.clearBtn} hitSlop={8}>
              <Text style={s.clearGlyph}>✕</Text>
            </Pressable>
          )}
        </View>

        <View style={s.bandBottom}>
          <Pressable
            onPress={() => setCityOpen(true)}
            style={s.cityPill}
            accessibilityRole="button"
            accessibilityLabel="Change city"
          >
            <Text style={s.cityPillText} numberOfLines={1}>
              {settings.area ? AREA_LABELS[settings.area] : t.allCities}
            </Text>
            <Text style={s.caret}>▾</Text>
          </Pressable>
          <Text style={s.bandNote} numberOfLines={1}>
            {t.savedOnPhone(String(areaShops.length))} {t.updatedToday}
          </Text>
        </View>
      </BrandHeader>

      {/*
        The map is the screen now. It sits behind everything below the band and fills
        whatever space is left, and the list rides over it in a sheet the rider can
        drag down to get the map back.

        `centerBias` lifts the map's visual centre when the sheet is covering the
        bottom half, so the pins and the "you are here" dot stay in the part of the
        map that is actually visible instead of hiding under the list.
      */}
      <View style={s.stage} onLayout={(e: LayoutChangeEvent) => setStageH(e.nativeEvent.layout.height)}>
        <MockMap
          shops={shops}
          radiusLabel={RADIUS_OPTIONS.find((o) => o.value === settings.radiusM)?.label ?? "All"}
          onPressPin={(shop) => router.push(`/shop/${shop.id}`)}
          centerBias={sheetAt === "peek" ? 0.46 : sheetAt === "half" ? 0.3 : 0.24}
        />

        {stageH > 0 && (
          <ShopSheet
            available={stageH}
            initial="half"
            onPositionChange={setSheetAt}
          >
            {/* How far to look. Filters the map and the list together. */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.chipRow}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={s.chipRowLabel}>Within</Text>
              {RADIUS_OPTIONS.map((option) => (
                <Chip
                  key={option.label}
                  label={option.label}
                  on={settings.radiusM === option.value}
                  onPress={() => update({ radiusM: option.value })}
                />
              ))}
            </ScrollView>

            <View style={s.listHead}>
              <Text style={s.listTitle}>{t.nearestToYou}</Text>
              <Text style={s.listSort}>{t.byDistance}</Text>
            </View>
            <Text style={s.etaNote}>Times are rough estimates and do not include traffic.</Text>

            <FlatList
              ref={listRef}
              data={shops}
              keyExtractor={(shop) => shop.id}
              renderItem={({ item }) => <ShopRow shop={item} />}
              ItemSeparatorComponent={() => <View style={s.sep} />}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={s.listContent}
              ListEmptyComponent={
                <View style={s.empty}>
                  <Text style={s.emptyText}>
                    {query ? `No shop matches “${query}”.` : 'No shops in this area yet.'}
                  </Text>
                </View>
              }
            />
          </ShopSheet>
        )}
      </View>

      <Modal
        visible={cityOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCityOpen(false)}
      >
        <SafeAreaProvider>
          <Pressable style={s.backdrop} onPress={() => setCityOpen(false)}>
            <SafeAreaView edges={['bottom']} style={s.sheet}>
              <Text style={s.sheetTitle}>Choose a city</Text>
              <ScrollView>
                <CityOption
                  label={t.allCities}
                  count={SHOP_TOTAL}
                  on={settings.area == null}
                  onPress={() => {
                    update({ area: null });
                    setCityOpen(false);
                  }}
                />
                {(Object.keys(AREA_LABELS) as Area[]).map((area) => (
                  <CityOption
                    key={area}
                    label={AREA_LABELS[area]}
                    count={cityCounts[area] ?? 0}
                    on={settings.area === area}
                    onPress={() => {
                      update({ area });
                      setCityOpen(false);
                    }}
                  />
                ))}
              </ScrollView>
            </SafeAreaView>
          </Pressable>
        </SafeAreaProvider>
      </Modal>
    </SafeAreaView>
  );
}

function CityOption({
  label,
  count,
  on,
  onPress,
}: {
  label: string;
  count: number;
  on: boolean;
  onPress: () => void;
}) {
  const { theme } = useSettings();
  const s = styles(theme);
  return (
    <Pressable
      onPress={onPress}
      style={s.cityOption}
      accessibilityRole="radio"
      accessibilityState={{ selected: on }}
    >
      <Text style={[s.cityOptionLabel, on && s.cityOptionLabelOn]}>{label}</Text>
      <Text style={s.cityOptionCount}>{count}</Text>
      <Text style={[s.tick, on && s.tickOn]}>{on ? '✓' : ''}</Text>
    </Pressable>
  );
}

function MiniStars({ value }: { value: number }) {
  const { theme } = useSettings();
  const SIZE = 12;
  return (
    <View style={{ flexDirection: 'row' }}>
      {Array.from({ length: 5 }, (_, i) => {
        const filled = Math.min(Math.max(value - i, 0), 1);
        return (
          <View key={i} style={{ width: SIZE, height: SIZE }}>
            <Text style={{ fontSize: SIZE, lineHeight: SIZE, color: theme.line }}>★</Text>
            {filled > 0 && (
              <View style={{ position: 'absolute', left: 0, top: 0, height: SIZE, width: SIZE * filled, overflow: 'hidden' }}>
                <Text style={{ fontSize: SIZE, lineHeight: SIZE, color: theme.star }}>★</Text>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const { theme } = useSettings();
  const s = styles(theme);
  return (
    <Pressable
      onPress={onPress}
      style={[s.chip, on && s.chipOn]}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
    >
      <Text style={[s.chipText, on && s.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

function ShopRow({ shop }: { shop: Shop }) {
  const { theme, t } = useSettings();
  const s = styles(theme);
  const { value } = splitDistance(shop.distance_m);

  const label = shop.status === 'open' ? t.open : shop.status === 'closed' ? t.closed : t.unknown;
  const pill = shop.status === 'open' ? s.pillOpen : shop.status === 'closed' ? s.pillClosed : s.pillUnknown;
  const pillText =
    shop.status === 'open' ? s.pillOpenText : shop.status === 'closed' ? s.pillClosedText : s.pillUnknownText;

  return (
    <Link href={`/shop/${shop.id}`} asChild>
      <Pressable style={s.row} accessibilityRole="button">
        <View style={s.distCol}>
          <Text style={s.distValue}>{value}</Text>
          <Text style={s.distUnit}>{t.km}</Text>
          {/* Always a tilde: the difference between an estimate and a promise. */}
          <Text style={s.distEta}>~{roughMinutes(shop.distance_m)} min</Text>
        </View>

        <View style={s.rowBody}>
          <Text style={s.shopName} numberOfLines={1}>
            {shop.name}
          </Text>
          {/*
            Rating first, because it is what draws a rider to a shop, with the count
            directly beneath it so a high average from two friends cannot mislead.

            The average is WITHHELD below five ratings and the count shown alone. That
            is the locked rule from the spec, and it is the reason the count sits with
            the stars rather than somewhere else.
          */}
          <View style={s.ratingRow}>
            {shop.ratingAvg != null ? (
              <>
                <MiniStars value={shop.ratingAvg} />
                <Text style={s.ratingAvg}>{shop.ratingAvg.toFixed(1)}</Text>
                <Text style={s.ratingCount}>({shop.ratingCount})</Text>
              </>
            ) : (
              <Text style={s.ratingCount}>
                {shop.ratingCount === 0 ? 'No ratings yet' : t.ratingCount(shop.ratingCount)}
              </Text>
            )}
          </View>

          <View style={s.metaRow}>
            <View style={[s.pill, pill]}>
              <Text style={[s.pillTextBase, pillText]}>{label}</Text>
            </View>
            <Text style={s.tags} numberOfLines={1}>
              {shop.tags.join(', ')}
            </Text>
          </View>
        </View>

        {shop.phone ? (
          /*
            Contact, not Call. A rider beside a running engine, or riding pillion, often
            cannot hold a conversation but can send a text. Dialling straight from the
            list took that choice away and made a mis-tap phone a stranger.
          */
          <Pressable
            onPress={() =>
              Alert.alert(shop.name, shop.phone ?? '', [
                { text: t.call, onPress: () => Linking.openURL(`tel:${shop.phone}`) },
                { text: t.message, onPress: () => Linking.openURL(`sms:${shop.phone}`) },
                { text: 'Cancel', style: 'cancel' },
              ])
            }
            style={s.callBtn}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`${t.contact} ${shop.name}`}
          >
            <ContactIcon size={26} color={theme.onFilled} bg={theme.call} />
          </Pressable>
        ) : (
          <View style={s.callBtnEmpty} />
        )}
      </Pressable>
    </Link>
  );
}

const styles = (theme: ReturnType<typeof useSettings>['theme']) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.bg },
    /* Everything under the band: the map fills it, the sheet floats over it. */
    stage: { flex: 1, position: 'relative' },
    grow: { flex: 1 },

    bandTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    bandArea: { fontSize: 10.5, fontWeight: '700', letterSpacing: 1.2, color: theme.bandInk2, marginTop: 4 },
    bandIconBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: theme.bandChip,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bandBottom: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    bandNote: { fontSize: 12, color: theme.bandInk2, flexShrink: 1 },


    /* Temporary. Deleted once OTA delivery is confirmed. */
    diag: {
      paddingHorizontal: 18,
      paddingVertical: 8,
      backgroundColor: theme.accentFill,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.accent,
      gap: 2,
    },
    diagText: { fontSize: 11, fontWeight: '700', color: theme.accent, letterSpacing: 0.3 },

    /* Small on purpose: the app bar has to hold more controls later. */
    cityPill: {
      maxWidth: 170,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.bandChip,
      paddingHorizontal: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    cityPillText: { fontSize: 13, fontWeight: '700', color: theme.bandInk, flexShrink: 1 },
    caret: { fontSize: 11, color: theme.bandInk2 },

    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: theme.bg,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '70%',
      paddingTop: 18,
    },
    sheetTitle: { fontSize: 18, fontWeight: '700', color: theme.ink, paddingHorizontal: 20, paddingBottom: 10 },
    cityOption: {
      minHeight: 56,
      paddingHorizontal: 20,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.lineSoft,
    },
    cityOptionLabel: { fontSize: 16, color: theme.ink, flex: 1 },
    cityOptionLabelOn: { fontWeight: '700', color: theme.call },
    cityOptionCount: { fontSize: 13, color: theme.ink3 },
    tick: { fontSize: 17, color: 'transparent', width: 20, textAlign: 'right' },
    tickOn: { color: theme.call },

    chipRow: { paddingHorizontal: 18, paddingVertical: 10, gap: 8, alignItems: 'center' },
    chipRowLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6, color: theme.ink3 },
    chip: {
      minHeight: 38,
      justifyContent: 'center',
      paddingHorizontal: 14,
      borderRadius: 999,
      borderWidth: 1.5,
      borderColor: theme.line,
      backgroundColor: theme.surface,
    },
    chipOn: { borderColor: theme.call, backgroundColor: theme.callFill },
    chipText: { fontSize: 14, color: theme.ink2 },
    chipTextOn: { fontWeight: '700', color: theme.call },

    searchWrap: { justifyContent: 'center' },
    search: {
      height: 46,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingRight: 42,
      fontSize: 15,
      color: theme.ink,
      backgroundColor: theme.surface,
    },
    clearBtn: { position: 'absolute', right: 12, width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
    clearGlyph: { fontSize: 15, color: theme.ink3 },

    listHead: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      paddingHorizontal: 18,
      paddingTop: 16,
      paddingBottom: 8,
    },
    listTitle: { fontSize: 17, fontWeight: '700', color: theme.ink },
    listSort: { fontSize: 11, letterSpacing: 1, color: theme.ink3, fontWeight: '600' },

    etaNote: { fontSize: 11.5, color: theme.ink3, paddingHorizontal: 18, paddingBottom: 8 },
    listContent: { paddingBottom: 28 },
    sep: { height: StyleSheet.hairlineWidth, backgroundColor: theme.lineSoft, marginLeft: 18 },

    row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18, paddingVertical: 13 },
    distCol: { width: 62 },
    distValue: { fontSize: 25, fontWeight: '700', color: theme.ink, letterSpacing: -0.8, fontVariant: ['tabular-nums'] },
    distUnit: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, color: theme.ink3 },
    distEta: { fontSize: 11, fontWeight: '600', color: theme.accent, marginTop: 3 },

    rowBody: { flex: 1, gap: 4 },
    shopName: { fontSize: 16, fontWeight: '600', color: theme.ink },
    ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    ratingAvg: { fontSize: 13, fontWeight: '700', color: theme.ink },
    ratingCount: { fontSize: 12.5, color: theme.ink3 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    tags: { fontSize: 13, color: theme.ink3, flexShrink: 1 },

    pill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 5 },
    pillTextBase: { fontSize: 12, fontWeight: '700' },
    pillOpen: { backgroundColor: theme.openFill },
    pillOpenText: { color: theme.open },
    pillClosed: { backgroundColor: theme.lineSoft },
    pillClosedText: { color: theme.ink3 },
    pillUnknown: { backgroundColor: theme.mapBg },
    pillUnknownText: { color: theme.ink2 },

    callBtn: { width: 48, height: 48, borderRadius: 12, backgroundColor: theme.call, alignItems: 'center', justifyContent: 'center' },
    callBtnEmpty: { width: 48, height: 48 },


    empty: { padding: 28, alignItems: 'center' },
    emptyText: { fontSize: 15, color: theme.ink3, textAlign: 'center' },
  });
