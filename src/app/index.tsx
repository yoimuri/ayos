import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SAMPLE_SHOPS, type Shop } from '@/lib/dev/sample-shops';

/**
 * DRAFT SCREEN.
 *
 * Reads a hardcoded array, not the network. Replaced at build step 6 by the real
 * map screen with this list as its bottom sheet. Kept deliberately plain: the point
 * is to prove the toolchain and rehearse the distance-ordering rule, not to design UI.
 */

/** Turns 320 into "320 m" and 1240 into "1.2 km", because nobody reads "1240 m". */
function formatDistance(metres: number): string {
  if (metres < 1000) {
    return `${metres} m`;
  }
  return `${(metres / 1000).toFixed(1)} km`;
}

/**
 * One row in the list.
 *
 * Split out as its own component because the real version grows a photo, an open/closed
 * state and a call button. A screen that renders rows inline gets messy the moment
 * a row does more than show text.
 */
function ShopRow({ shop }: { shop: Shop }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowHeader}>
        <Text style={styles.name} numberOfLines={1}>
          {shop.name}
        </Text>
        <Text style={styles.distance}>{formatDistance(shop.distance_m)}</Text>
      </View>

      <Text style={styles.address} numberOfLines={1}>
        {shop.address}
      </Text>

      <Text style={styles.tags}>{shop.tags.join(' · ')}</Text>

      {/*
        A missing phone number is a real state, not an error. Spec section 4.2 takes the
        same position about unknown opening hours: say "unknown" honestly rather than
        hiding the shop or inventing a value.
      */}
      <Text style={shop.phone ? styles.phone : styles.phoneMissing}>
        {shop.phone ?? 'No number on file'}
      </Text>
    </View>
  );
}

export default function NearbyShopsScreen() {
  /*
    Sorted by distance ascending. This is the locked rule from spec section 6, and it
    applies in every code path, on-device and in Postgres alike. Never sort by rating.

    The array is copied with [...] first because .sort() rewrites the array it is given.
    Sorting SAMPLE_SHOPS directly would quietly reorder the shared source array on every
    render, which is the kind of bug that only shows up once a second screen reads it.
  */
  const shopsByDistance = [...SAMPLE_SHOPS].sort((a, b) => a.distance_m - b.distance_m);

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <FlatList
        data={shopsByDistance}
        /*
          keyExtractor tells React which row is which across re-renders, so it can move
          rows instead of rebuilding them. Without a stable id it falls back to array
          position, and rows lose their state whenever the order changes.
        */
        keyExtractor={(shop) => shop.id}
        renderItem={({ item }) => <ShopRow shop={item} />}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <Text style={styles.notice}>Draft screen. Placeholder data, not real shops.</Text>
        }
      />
    </SafeAreaView>
  );
}

/*
  StyleSheet.create instead of plain objects: it validates the style names at build time,
  so a typo like "fontweight" is caught rather than silently ignored at runtime.
*/
const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  notice: {
    fontSize: 12,
    opacity: 0.6,
    marginBottom: 4,
  },
  row: {
    padding: 14,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#8888',
    gap: 4,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    flexShrink: 1,
  },
  distance: {
    fontSize: 14,
    fontVariant: ['tabular-nums'],
    opacity: 0.8,
  },
  address: {
    fontSize: 13,
    opacity: 0.7,
  },
  tags: {
    fontSize: 12,
    opacity: 0.6,
  },
  phone: {
    fontSize: 14,
    marginTop: 2,
  },
  phoneMissing: {
    fontSize: 14,
    marginTop: 2,
    opacity: 0.5,
    fontStyle: 'italic',
  },
});
