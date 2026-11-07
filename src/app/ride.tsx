import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandBar } from '@/components/BrandBar';
import { UnlockedIcon } from '@/components/icons';
import {
  ADDONS,
  HELMETS,
  HELMET_COLOURS,
  OUTFITS,
  PAINTS,
  PIPES,
  SIZES,
  TOPBOXES,
  VEHICLES,
  VEHICLES_SOON,
  sameRide,
  sizeScale,
  type Ride,
  type Tier,
  type VehicleId,
} from '@/features/ride/catalog';
import { LAYERS } from '@/features/ride/layers.generated';
import { MapTile } from '@/features/ride/MapTile';
import { RoadPreview } from '@/features/ride/RoadPreview';
import { stackFor } from '@/features/ride/stack';
import { Turntable } from '@/features/ride/Turntable';
import { useSettings } from '@/lib/settings/store';
import type { Theme } from '@/lib/theme/tokens';

/** The side view of each bike, for its tile: picture 2 of 8 is the bike turned 90 degrees. */
const SIDE = 2;

type Tab = 'bike' | 'rider' | 'helmet' | 'parts';

/**
 * YOUR RIDE: the bike drawn on the map. Settings > Map and riding is the only way in, on
 * purpose: an optional extra, never pushed (no banners, badges or prompts anywhere else).
 * Not in Graphics: Light, where the rider is a plain dot.
 *
 * Four tabs under the turntable (3 Nov): Bike (vehicle, size, paint), Rider (outfit), Helmet
 * (style and colour) and Parts (exhaust, top box, add-ons). Every part is its own layer of
 * pictures (features/ride/stack.ts), so every vehicle takes every part.
 *
 * PAID ITEMS stay low-key (Clint, 30 Oct): in the demo everything is open, and a paid item
 * shows only a small open padlock in its corner. No prices, badges or prompts.
 *
 * Choices are a DRAFT on this screen. Nothing changes on the map until Save, and Save
 * keeps the rider here. Save is what makes the map's finished pictures (pictures.ts): the bike
 * on the map changes by itself a moment later, with nothing to wait for on this screen.
 *
 * Layout by screen size (docs/BACKLOG.md, "Screen sizes"): phones are one column with Save
 * pinned at the bottom; a short phone shrinks the turntable and scrolls the options; a
 * narrow phone scrolls the vehicle row sideways instead of cutting the names; a tablet puts
 * the bike on the left and the options on the right.
 */
export default function YourRide() {
  const { settings, update, theme, t } = useSettings();
  const { width, height } = useWindowDimensions();
  const [draft, setDraft] = useState<Ride>(settings.ride);
  const [tab, setTab] = useState<Tab>('bike');
  const s = styles(theme);
  const set = (patch: Partial<Ride>) => setDraft((d) => ({ ...d, ...patch }));

  const tablet = width >= 600;
  const narrow = width < 380;
  /* Tall phones get a bigger turntable instead of an empty gap above Save. */
  const turnHeight = tablet
    ? Math.min(460, height - 260)
    : height < 700
      ? 170
      : Math.min(320, Math.round(height * (height >= 820 ? 0.32 : 0.26)));
  const stack = useMemo(() => stackFor(draft), [draft]);
  const box = LAYERS[draft.vehicle].turn;

  const names: Record<VehicleId | (typeof VEHICLES_SOON)[number], string> = {
    scooter: t.vehicleScooter,
    underbone: t.vehicleUnderbone,
    standard: t.vehicleStandard,
    tricycle: t.vehicleTricycle,
    ebike: t.vehicleEbike,
  };

  const tiles = [
    ...VEHICLES.map((v) => {
      const on = draft.vehicle === v.id;
      return (
        <Pressable
          key={v.id}
          onPress={() => set({ vehicle: v.id })}
          style={[s.tile, narrow && s.tileFixed, on && s.tileOn]}
          accessibilityRole="radio"
          accessibilityState={{ selected: on }}
          accessibilityLabel={names[v.id]}
        >
          <MapTile sheet={LAYERS[v.id].paint[draft.paint].map} tile={SIDE} size={48} />
          <Text style={[s.tileLabel, on && s.tileLabelOn]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {names[v.id]}
          </Text>
        </Pressable>
      );
    }),
    ...VEHICLES_SOON.map((id) => (
      <View key={id} style={[s.tile, narrow && s.tileFixed]}>
        <View style={s.soonWrap}>
          <Text style={s.soon}>{t.rideSoon.toUpperCase()}</Text>
        </View>
        <Text style={[s.tileLabel, s.tileLabelSoon]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
          {names[id]}
        </Text>
      </View>
    )),
  ];

  /* A text choice; a paid one carries the small open padlock (demo: everything open). */
  const chip = (key: string, label: string, tier: Tier, on: boolean, onPress: () => void, multi = false) => (
    <Pressable
      key={key}
      onPress={onPress}
      style={[s.chip, on && s.chipOn]}
      accessibilityRole={multi ? 'checkbox' : 'radio'}
      accessibilityState={multi ? { checked: on } : { selected: on }}
      accessibilityLabel={tier === 'paid' ? `${label}, ${t.rideUnlocked}` : label}
    >
      <Text style={[s.chipText, on && s.chipTextOn]}>{label}</Text>
      {tier === 'paid' && (
        <View style={s.lockBadge} pointerEvents="none">
          <UnlockedIcon size={11} color={theme.ink3} />
        </View>
      )}
    </Pressable>
  );

  const swatch = (key: string, hex: string, tier: Tier, on: boolean, light: boolean, onPress: () => void, label: string) => (
    <Pressable
      key={key}
      onPress={onPress}
      style={[s.swatch, { backgroundColor: hex }, on && s.swatchOn]}
      accessibilityRole="radio"
      accessibilityState={{ selected: on }}
      accessibilityLabel={tier === 'paid' ? `${label}, ${t.rideUnlocked}` : label}
    >
      {on ? <Text style={[s.check, light && s.checkDark]}>✓</Text> : null}
      {tier === 'paid' && (
        <View style={s.swatchLock} pointerEvents="none">
          <UnlockedIcon size={10} color={theme.ink3} />
        </View>
      )}
    </Pressable>
  );

  const bikeTab = (
    <>
      <Text style={s.label}>{t.rideVehicle.toUpperCase()}</Text>
      {narrow ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tileRow} style={s.bleed}>
          {tiles}
        </ScrollView>
      ) : (
        <View style={s.tileRow}>{tiles}</View>
      )}

      <Text style={s.label}>{t.rideSize.toUpperCase()}</Text>
      <View style={s.sizeRow}>
        <View style={s.sizeLeft}>
          <View style={s.segment}>
            {SIZES.map((size) => {
              const on = draft.size === size.id;
              return (
                <Pressable
                  key={size.id}
                  onPress={() => set({ size: size.id })}
                  style={[s.seg, on && s.segOn]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[s.segText, on && s.segTextOn]}>{size.id.toUpperCase()}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        {/* The chosen size against two lanes of road, seen from above, riding. */}
        <RoadPreview stack={stack} size={108 * sizeScale(draft.size)} theme={theme} />
      </View>

      <Text style={s.label}>{t.ridePaint.toUpperCase()}</Text>
      <View style={s.swatches}>
        {PAINTS.map((p) =>
          swatch(p.id, p.hex, p.tier, draft.paint === p.id, p.id === 'pearl', () => set({ paint: p.id }), p.id),
        )}
      </View>
    </>
  );

  const riderTab = (
    <>
      <Text style={s.label}>{t.rideOutfit.toUpperCase()}</Text>
      <View style={s.chips}>
        {OUTFITS.map((o) => chip(o.id, o.label, o.tier, draft.outfit === o.id, () => set({ outfit: o.id })))}
      </View>
    </>
  );

  const helmetTab = (
    <>
      <Text style={s.label}>{t.rideHelmetStyle.toUpperCase()}</Text>
      <View style={s.chips}>
        {HELMETS.map((h) => chip(h.id, h.label, h.tier, draft.helmet === h.id, () => set({ helmet: h.id })))}
      </View>
      {/* No colour to pick without a helmet. */}
      {draft.helmet !== 'none' && (
        <>
          <Text style={s.label}>{t.rideHelmetColour.toUpperCase()}</Text>
          <View style={s.swatchRow}>
            {HELMET_COLOURS.map((c) =>
              swatch(c.id, c.hex, c.tier, draft.helmetColour === c.id, c.id === 'white', () => set({ helmetColour: c.id }), c.id),
            )}
          </View>
        </>
      )}
    </>
  );

  const partsTab = (
    <>
      <Text style={s.label}>{t.ridePipe.toUpperCase()}</Text>
      <View style={s.chips}>
        {PIPES.map((p) => chip(p.id, p.label, p.tier, draft.pipe === p.id, () => set({ pipe: p.id })))}
      </View>
      <Text style={s.label}>{t.rideTopbox.toUpperCase()}</Text>
      <View style={s.chips}>
        {TOPBOXES.map((b) => chip(b.id, b.label, b.tier, draft.topbox === b.id, () => set({ topbox: b.id })))}
      </View>
      <Text style={s.label}>{t.rideAddons.toUpperCase()}</Text>
      <View style={s.chips}>
        {ADDONS.map((a) => {
          const on = draft.addons.includes(a.id);
          return chip(
            a.id,
            a.label,
            a.tier,
            on,
            () => set({ addons: on ? draft.addons.filter((x) => x !== a.id) : [...draft.addons, a.id] }),
            true,
          );
        })}
      </View>
    </>
  );

  const TABS: { id: Tab; label: string }[] = [
    { id: 'bike', label: t.rideTabBike },
    { id: 'rider', label: t.rideTabRider },
    { id: 'helmet', label: t.rideTabHelmet },
    { id: 'parts', label: t.rideTabParts },
  ];

  const options = (
    <View style={s.options}>
      <View style={s.tabs}>
        {TABS.map((x) => {
          const on = tab === x.id;
          return (
            <Pressable
              key={x.id}
              onPress={() => setTab(x.id)}
              style={[s.tab, on && s.tabOn]}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
            >
              <Text style={[s.tabText, on && s.tabTextOn]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                {x.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {tab === 'bike' ? bikeTab : tab === 'rider' ? riderTab : tab === 'helmet' ? helmetTab : partsTab}
    </View>
  );

  /*
    SAVE KEEPS YOU HERE (Clint, 31 Oct): the rider may want to try another look straight
    away, and Back is one tap. The button says "Saved" while what is shown is what the map
    uses, and wakes up as "Save" as soon as anything changes.
  */
  const saved = sameRide(draft, settings.ride);
  const save = (
    <Pressable
      onPress={() => update({ ride: draft })}
      disabled={saved}
      style={({ pressed }) => [s.save, saved && s.saveDone, pressed && s.pressed]}
      accessibilityRole="button"
      accessibilityState={{ disabled: saved }}
    >
      <Text style={s.saveText}>{saved ? `${t.rideSaved} ✓` : t.rideSave}</Text>
    </Pressable>
  );

  const turntable = (
    <Turntable stack={stack} aspect={box.aspect} ground={box.ground} floor={box.floor} height={turnHeight} />
  );

  return (
    <SafeAreaView style={s.screen} edges={['top', 'bottom']}>
      <BrandBar title={t.yourRide} />
      {tablet ? (
        <View style={s.panes}>
          <View style={s.leftPane}>{turntable}</View>
          <View style={s.rightPane}>
            <ScrollView contentContainerStyle={s.scrollBody} showsVerticalScrollIndicator={false}>
              {options}
            </ScrollView>
            {save}
          </View>
        </View>
      ) : (
        <View style={s.column}>
          {turntable}
          <ScrollView style={s.flex} contentContainerStyle={s.scrollBody} showsVerticalScrollIndicator={false}>
            {options}
          </ScrollView>
          {save}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.bg },
    column: { flex: 1, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, gap: 12 },
    panes: { flex: 1, flexDirection: 'row', gap: 24, paddingHorizontal: 28, paddingTop: 8, paddingBottom: 16 },
    leftPane: { width: 380 },
    rightPane: { flex: 1, gap: 12 },
    flex: { flex: 1 },
    scrollBody: { paddingBottom: 8 },
    options: { gap: 10 },
    tabs: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 14, backgroundColor: theme.surface },
    tab: { flex: 1, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
    tabOn: { backgroundColor: theme.ink },
    tabText: { fontSize: 13.5, fontWeight: '600', color: theme.ink2 },
    tabTextOn: { color: theme.bg, fontWeight: '700' },
    label: { fontSize: 11.5, fontWeight: '700', letterSpacing: 1, color: theme.ink3, marginTop: 6 },
    bleed: { marginRight: -16 },
    tileRow: { flexDirection: 'row', gap: 8 },
    tile: {
      flex: 1,
      minHeight: 80,
      borderRadius: 14,
      backgroundColor: theme.surface,
      borderWidth: 2,
      borderColor: 'transparent',
      alignItems: 'center',
      justifyContent: 'flex-end',
      paddingBottom: 6,
      gap: 2,
    },
    tileFixed: { flex: 0, width: 84 },
    tileOn: { borderColor: theme.ink },
    tileLabel: { fontSize: 12, fontWeight: '600', color: theme.ink2 },
    tileLabelOn: { color: theme.ink, fontWeight: '700' },
    tileLabelSoon: { color: theme.ink3 },
    soonWrap: { height: 48, justifyContent: 'center' },
    soon: {
      fontSize: 10.5,
      fontWeight: '700',
      letterSpacing: 0.6,
      color: theme.ink3,
      backgroundColor: theme.lineSoft,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      overflow: 'hidden',
    },
    sizeRow: { flexDirection: 'row', gap: 12, alignItems: 'stretch' },
    sizeLeft: { flex: 1, justifyContent: 'center' },
    segment: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 14, backgroundColor: theme.surface },
    seg: { flex: 1, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    segOn: { backgroundColor: theme.bg, borderWidth: 1, borderColor: theme.line },
    segText: { fontSize: 14, fontWeight: '600', color: theme.ink2 },
    segTextOn: { color: theme.ink, fontWeight: '700' },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      minHeight: 44,
      paddingHorizontal: 14,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: theme.line,
      backgroundColor: theme.surface,
      justifyContent: 'center',
    },
    chipOn: { borderColor: theme.ink, borderWidth: 2 },
    chipText: { fontSize: 14, fontWeight: '600', color: theme.ink2 },
    chipTextOn: { color: theme.ink, fontWeight: '700' },
    /* The open padlock: small, in the corner, never louder than the choice itself. */
    lockBadge: { position: 'absolute', top: 3, right: 4 },
    /* Spread across the full width, so the row lines up with the vehicle tiles above it. */
    swatches: { flexDirection: 'row', justifyContent: 'space-between' },
    swatchRow: { flexDirection: 'row', gap: 16 },
    swatch: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.lineSoft,
    },
    swatchOn: { borderWidth: 3, borderColor: theme.ink },
    swatchLock: {
      position: 'absolute',
      top: -4,
      right: -4,
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: theme.surface,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.lineSoft,
    },
    check: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
    checkDark: { color: theme.ink },
    save: { height: 52, borderRadius: 14, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center' },
    saveText: { color: theme.onFilled, fontSize: 15.5, fontWeight: '800' },
    /* Saved: the same button, see-through, the way a disabled button looks (Clint, 31 Oct). */
    saveDone: { opacity: 0.45 },
    pressed: { opacity: 0.85 },
  });
