import { Link, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MockMap } from '@/components/MockMap';
import { shopsForArea, splitDistance, type Shop } from '@/lib/dev/sample-shops';
import { AREA_LABELS, useSettings } from '@/lib/settings/store';

/**
 * Home. Map on top, list underneath.
 *
 * The map is a drawn placeholder (see components/MockMap) until build step 6. The list
 * below it is real: it filters by the rider's chosen area, filters again as they type,
 * and always orders by distance.
 */

export default function HomeScreen() {
  const { theme, t, settings } = useSettings();
  const router = useRouter();
  const [query, setQuery] = useState('');

  /** Shops for the chosen area, already distance-sorted by the data layer. */
  const areaShops = useMemo(() => shopsForArea(settings.area), [settings.area]);

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
    <SafeAreaView style={s.screen} edges={['top']}>
      <View style={s.appbar}>
        <Text style={s.brand}>{t.appName}</Text>
        <View style={s.grow} />
        <Pressable
          onPress={() => router.push('/settings')}
          style={s.iconBtn}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t.settings}
        >
          <Text style={s.iconGlyph}>≡</Text>
        </Pressable>
      </View>

      <View style={s.savedRow}>
        <Text style={s.savedCount}>{t.savedOnPhone(String(areaShops.length))}</Text>
        <Text style={s.savedNote} numberOfLines={1}>
          {settings.area ? AREA_LABELS[settings.area] : t.updatedToday}
        </Text>
      </View>

      <FlatList
        data={shops}
        keyExtractor={(shop) => shop.id}
        renderItem={({ item }) => <ShopRow shop={item} />}
        ItemSeparatorComponent={() => <View style={s.sep} />}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.listContent}
        ListHeaderComponent={
          <View>
            <MockMap
              shops={shops}
              radiusLabel="500 m"
              onPressPin={(shop) => router.push(`/shop/${shop.id}`)}
            />

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

            <View style={s.listHead}>
              <Text style={s.listTitle}>{t.nearestToYou}</Text>
              <Text style={s.listSort}>{t.byDistance}</Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyText}>
              {query ? `No shop matches “${query}”.` : 'No shops in this area yet.'}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

function ShopRow({ shop }: { shop: Shop }) {
  const { theme, t } = useSettings();
  const s = styles(theme);
  const { value, unit } = splitDistance(shop.distance_m);

  const label = shop.status === 'open' ? t.open : shop.status === 'closed' ? t.closed : t.unknown;
  const pill = shop.status === 'open' ? s.pillOpen : shop.status === 'closed' ? s.pillClosed : s.pillUnknown;
  const pillText =
    shop.status === 'open' ? s.pillOpenText : shop.status === 'closed' ? s.pillClosedText : s.pillUnknownText;

  return (
    <Link href={`/shop/${shop.id}`} asChild>
      <Pressable style={s.row} accessibilityRole="button">
        <View style={s.distCol}>
          <Text style={s.distValue}>{value}</Text>
          <Text style={s.distUnit}>{unit === 'km' ? t.km : t.metres}</Text>
        </View>

        <View style={s.rowBody}>
          <Text style={s.shopName} numberOfLines={1}>
            {shop.name}
          </Text>
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
          <Pressable
            onPress={() => Linking.openURL(`tel:${shop.phone}`)}
            style={s.callBtn}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`${t.call} ${shop.name}`}
          >
            <Text style={s.callGlyph}>✆</Text>
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
    grow: { flex: 1 },

    appbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingTop: 6, paddingBottom: 10 },
    brand: { fontSize: 24, fontWeight: '700', color: theme.ink, letterSpacing: -0.7 },
    iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    iconGlyph: { fontSize: 24, color: theme.ink },

    savedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      paddingHorizontal: 18,
      paddingBottom: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.line,
    },
    savedCount: { fontSize: 13, fontWeight: '700', color: theme.call },
    savedNote: { fontSize: 12.5, color: theme.ink3, flexShrink: 1 },

    searchWrap: { paddingHorizontal: 18, paddingTop: 14, justifyContent: 'center' },
    search: {
      height: 48,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: theme.line,
      paddingHorizontal: 14,
      paddingRight: 42,
      fontSize: 15,
      color: theme.ink,
      backgroundColor: theme.surface,
    },
    clearBtn: { position: 'absolute', right: 30, top: 26, width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
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

    listContent: { paddingBottom: 28 },
    sep: { height: StyleSheet.hairlineWidth, backgroundColor: theme.lineSoft, marginLeft: 18 },

    row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18, paddingVertical: 13 },
    distCol: { width: 62 },
    distValue: { fontSize: 25, fontWeight: '700', color: theme.ink, letterSpacing: -0.8, fontVariant: ['tabular-nums'] },
    distUnit: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, color: theme.ink3 },

    rowBody: { flex: 1, gap: 4 },
    shopName: { fontSize: 16, fontWeight: '600', color: theme.ink },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    tags: { fontSize: 13, color: theme.ink3, flexShrink: 1 },

    pill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 5 },
    pillTextBase: { fontSize: 12, fontWeight: '700' },
    pillOpen: { backgroundColor: theme.callFill },
    pillOpenText: { color: theme.call },
    pillClosed: { backgroundColor: theme.alertFill },
    pillClosedText: { color: theme.alert },
    pillUnknown: { backgroundColor: theme.mapBg },
    pillUnknownText: { color: theme.ink2 },

    callBtn: { width: 48, height: 48, borderRadius: 12, backgroundColor: theme.call, alignItems: 'center', justifyContent: 'center' },
    callBtnEmpty: { width: 48, height: 48 },
    callGlyph: { fontSize: 22, color: theme.onFilled },

    empty: { padding: 28, alignItems: 'center' },
    emptyText: { fontSize: 15, color: theme.ink3, textAlign: 'center' },
  });
