import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandBar } from '@/components/BrandBar';
import { useAppShops } from '@/lib/data/shops';
import type { Shop } from '@/lib/data/types';
import { splitDistance } from '@/lib/geo/distance';
import { useLocationGate } from '@/lib/location/useLocationGate';
import { overall } from '@/lib/personal/model';
import { usePersonal } from '@/lib/personal/store';
import { AREA_LABELS, useSettings } from '@/lib/settings/store';

/**
 * MY SHOPS: the shops this rider saved, visited and rated, on this phone only.
 *
 * Tapping one goes back to the map with that shop open, exactly as a list tap would.
 */

type Tab = 'saved' | 'visited' | 'rated';

export default function MyShopsScreen() {
  const { theme, t, settings } = useSettings();
  const router = useRouter();
  const gate = useLocationGate();
  const personal = usePersonal();
  const all = useAppShops(gate.position, settings.area);
  const [tab, setTab] = useState<Tab>('saved');
  const s = styles(theme);

  const list = useMemo(() => {
    const ids =
      tab === 'saved'
        ? personal.data.saved
        : tab === 'visited'
          ? personal.data.visited
          : Object.keys(personal.data.ratings);
    const byId = new Map(all.map((shop) => [shop.id, shop]));
    return ids
      .map((id) => byId.get(id))
      .filter((shop): shop is Shop => !!shop)
      .sort((a, b) => a.distance_m - b.distance_m);
  }, [tab, personal.data, all]);

  const empty = tab === 'saved' ? t.emptySaved : tab === 'visited' ? t.emptyVisited : t.emptyRated;

  return (
    <SafeAreaView style={s.screen} edges={['top', 'bottom']}>
      <BrandBar title={t.myShops} />
      <View style={s.tabs} accessibilityRole="tablist">
        {(
          [
            ['saved', t.tabSaved, personal.data.saved.length],
            ['visited', t.tabVisited, personal.data.visited.length],
            ['rated', t.tabRated, Object.keys(personal.data.ratings).length],
          ] as [Tab, string, number][]
        ).map(([key, label, count]) => (
          <Pressable
            key={key}
            onPress={() => setTab(key)}
            style={({ pressed }) => [s.tab, tab === key && s.tabOn, pressed && s.pressed]}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === key }}
          >
            <Text style={[s.tabText, tab === key && s.tabTextOn]}>
              {label} ({count})
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={list}
        keyExtractor={(shop) => shop.id}
        contentContainerStyle={s.listContent}
        ItemSeparatorComponent={() => <View style={s.sep} />}
        ListEmptyComponent={<Text style={s.empty}>{empty}</Text>}
        renderItem={({ item }) => {
          const mine = personal.ratingOf(item.id);
          return (
            <Pressable
              /* `at` makes each tap a new request, so the same shop can be reopened. */
              onPress={() => router.navigate({ pathname: '/', params: { open: item.id, at: String(Date.now()) } })}
              style={({ pressed }) => [s.row, pressed && s.rowPressed]}
              accessibilityRole="button"
              accessibilityLabel={`Open ${item.name}`}
            >
              <Text style={s.name} numberOfLines={2}>
                {item.name}
              </Text>
              <Text style={s.meta}>
                ≈ {splitDistance(item.distance_m).value} {t.km.toLowerCase()} · {AREA_LABELS[item.area]}
                {tab === 'rated' && mine ? ` · ${t.yourRating} ${overall(mine).toFixed(1)} ★` : ''}
              </Text>
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = (theme: ReturnType<typeof useSettings>['theme']) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.bg },
    tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 18, paddingVertical: 12 },
    tab: {
      flex: 1,
      minHeight: 44,
      borderRadius: 11,
      borderWidth: 1.5,
      borderColor: theme.line,
      backgroundColor: theme.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tabOn: { borderColor: theme.call, backgroundColor: theme.callFill },
    tabText: { fontSize: 14, fontWeight: '600', color: theme.ink2 },
    tabTextOn: { color: theme.call, fontWeight: '700' },
    pressed: { opacity: 0.6 },
    listContent: { paddingBottom: 30 },
    sep: { height: StyleSheet.hairlineWidth, backgroundColor: theme.lineSoft, marginLeft: 18 },
    row: { paddingHorizontal: 18, paddingVertical: 14, gap: 4 },
    rowPressed: { backgroundColor: theme.lineSoft },
    name: { fontSize: 17, fontWeight: '700', color: theme.ink },
    meta: { fontSize: 14, color: theme.ink2 },
    empty: { padding: 28, textAlign: 'center', fontSize: 15, color: theme.ink3 },
  });
