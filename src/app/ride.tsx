import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandBar } from '@/components/BrandBar';
import { PAINTS, SIZES, VEHICLES, VEHICLES_SOON, sizeScale, type Ride, type VehicleId } from '@/features/ride/catalog';
import { SPRITES } from '@/features/ride/sprites.generated';
import { RoadPreview } from '@/features/ride/RoadPreview';
import { Turntable } from '@/features/ride/Turntable';
import { TURNTABLE } from '@/features/ride/turntable.generated';
import { useSettings } from '@/lib/settings/store';
import type { Theme } from '@/lib/theme/tokens';

/** The side view of each bike, for its tile: picture 6 of 24 is the bike turned 90 degrees. */
const SIDE = 6;

/**
 * YOUR RIDE: the bike drawn on the map. Settings > Map and riding is the only way in, on
 * purpose: an optional extra, never pushed (no banners, badges or prompts anywhere else).
 *
 * Choices are a DRAFT on this screen. Nothing changes on the map until Save, and Save
 * keeps the rider here.
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
  const s = styles(theme);

  const tablet = width >= 600;
  const narrow = width < 380;
  /* Tall phones get a bigger turntable instead of an empty gap above Save. */
  const turnHeight = tablet
    ? Math.min(460, height - 260)
    : height < 700
      ? 170
      : Math.min(340, Math.round(height * (height >= 820 ? 0.34 : 0.28)));
  const look = SPRITES[draft.vehicle][draft.paint];
  /*
    Graphics: Light shows the small map pictures (whole 240 px squares, the bike standing
    168 px down) instead of the sharp turntable set: less to decode and hold in memory.
  */
  const light = settings.graphics === 'light';
  const sharp = TURNTABLE[draft.vehicle];
  const show = light
    ? { frames: look.angles, aspect: 1, ground: 0.7, floor: 0.3 }
    : { frames: sharp.frames[draft.paint], aspect: sharp.aspect, ground: sharp.ground, floor: sharp.floor };

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
          onPress={() => setDraft({ ...draft, vehicle: v.id })}
          style={[s.tile, narrow && s.tileFixed, on && s.tileOn]}
          accessibilityRole="radio"
          accessibilityState={{ selected: on }}
          accessibilityLabel={names[v.id]}
        >
          <Image source={SPRITES[v.id][draft.paint].angles[SIDE]} style={s.tileImg} resizeMode="contain" />
          <Text
            style={[s.tileLabel, on && s.tileLabelOn]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
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

  const options = (
    <View style={s.options}>
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
                  onPress={() => setDraft({ ...draft, size: size.id })}
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
        <RoadPreview bike={look.top} size={108 * sizeScale(draft.size)} theme={theme} light={light} />
      </View>

      <Text style={s.label}>{t.ridePaint.toUpperCase()}</Text>
      <View style={s.swatches}>
        {PAINTS.map((paint) => {
          const on = draft.paint === paint.id;
          return (
            <Pressable
              key={paint.id}
              onPress={() => setDraft({ ...draft, paint: paint.id })}
              style={[s.swatch, { backgroundColor: paint.hex }, on && s.swatchOn]}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={paint.id}
            >
              {on ? <Text style={[s.check, paint.id === 'pearl' && s.checkDark]}>✓</Text> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  /*
    SAVE KEEPS YOU HERE (Clint, 31 Oct): the rider may want to try another look straight
    away, and Back is one tap. The button says "Saved" while what is shown is what the map
    uses, and wakes up as "Save" as soon as anything changes.
  */
  const saved =
    draft.vehicle === settings.ride.vehicle && draft.paint === settings.ride.paint && draft.size === settings.ride.size;
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

  return (
    <SafeAreaView style={s.screen} edges={['top', 'bottom']}>
      <BrandBar title={t.yourRide} />
      {tablet ? (
        <View style={s.panes}>
          <View style={s.leftPane}>
            <Turntable
              frames={show.frames}
              aspect={show.aspect}
              ground={show.ground}
              floor={show.floor}
              height={turnHeight}
              light={light}
            />
          </View>
          <View style={s.rightPane}>
            <ScrollView contentContainerStyle={s.scrollBody} showsVerticalScrollIndicator={false}>
              {options}
            </ScrollView>
            {save}
          </View>
        </View>
      ) : (
        <View style={s.column}>
          <Turntable
            frames={show.frames}
            aspect={show.aspect}
            ground={show.ground}
            floor={show.floor}
            height={turnHeight}
            light={light}
          />
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
    column: {
      flex: 1,
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 12,
      gap: 12,
    },
    panes: {
      flex: 1,
      flexDirection: 'row',
      gap: 24,
      paddingHorizontal: 28,
      paddingTop: 8,
      paddingBottom: 16,
    },
    leftPane: { width: 380 },
    rightPane: { flex: 1, gap: 12 },
    flex: { flex: 1 },
    scrollBody: { paddingBottom: 8 },
    options: { gap: 10 },
    label: {
      fontSize: 11.5,
      fontWeight: '700',
      letterSpacing: 1,
      color: theme.ink3,
      marginTop: 6,
    },
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
    tileImg: { width: '100%', height: 48 },
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
    segment: {
      flexDirection: 'row',
      gap: 4,
      padding: 4,
      borderRadius: 14,
      backgroundColor: theme.surface,
    },
    seg: {
      flex: 1,
      height: 44,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    segOn: {
      backgroundColor: theme.bg,
      borderWidth: 1,
      borderColor: theme.line,
    },
    segText: { fontSize: 14, fontWeight: '600', color: theme.ink2 },
    segTextOn: { color: theme.ink, fontWeight: '700' },
    /* Spread across the full width, so the row lines up with the vehicle tiles above it. */
    swatches: { flexDirection: 'row', justifyContent: 'space-between' },
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
    check: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
    checkDark: { color: theme.ink },
    save: {
      height: 52,
      borderRadius: 14,
      backgroundColor: theme.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveText: { color: theme.onFilled, fontSize: 15.5, fontWeight: '800' },
    /* Saved: the same button, see-through, the way a disabled button looks (Clint, 31 Oct). */
    saveDone: { opacity: 0.45 },
    pressed: { opacity: 0.85 },
  });
