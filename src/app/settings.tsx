import { useState } from 'react';
import { useRouter } from 'expo-router';

import { BrandBar } from '@/components/BrandBar';
import { ExpandIcon } from '@/components/icons';
import * as Updates from 'expo-updates';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaFrame, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLocationGate } from '@/lib/location/useLocationGate';
import { LANGUAGE_FLAGS, LANGUAGE_LABELS, type Language } from '@/lib/i18n/strings';
import { RADIUS_OPTIONS } from '@/lib/geo/distance';
import { AREA_LABELS, useSettings, type Area } from '@/lib/settings/store';
import { PALETTE_LABELS, type PaletteName, type ThemeName } from '@/lib/theme/tokens';
import { askToRestart, checkNow, useUpdateReady } from '@/lib/updates';

/**
 * Everything the welcome screen asked, changeable afterwards.
 *
 * This is what makes the first run safe to answer quickly: nothing chosen there is
 * permanent. Each change is written to disk as it is made, so there is no save
 * button and nothing to lose by backing out.
 *
 * FOUR SECTIONS, not eleven headings. Each setting is one row: a choice opens in place,
 * an on/off is a switch flicked once, and a link goes somewhere.
 *
 * WHY IT ANIMATES. A choice used to snap open and shove every row below it down in one
 * frame, which read as the screen jumping. Now its options fade in and the rows below
 * glide to their new place (Reanimated layout transitions, which run on the native side,
 * so they ship over the air). Phones set to reduce motion get the plain version.
 */

/* One timing for every row, so the whole screen moves together. */
const GLIDE = LinearTransition.duration(220);

export default function SettingsScreen() {
  const [aboutOpen, setAboutOpen] = useState(false);
  const [buildOpen, setBuildOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const { settings, update, theme, t } = useSettings();
  const router = useRouter();
  const updateReady = useUpdateReady();
  const s = styles(theme);

  const onCheckUpdates = async () => {
    if (updateReady) return askToRestart(t);
    setChecking(true);
    await checkNow(t);
    setChecking(false);
  };

  return (
    <SafeAreaView style={s.screen} edges={['top', 'bottom']}>
      <BrandBar title={t.settings} />

      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        <Section title={t.sectionMap}>
          <Choice
            label={t.area}
            value={settings.area ? AREA_LABELS[settings.area] : t.notSet}
            options={(Object.keys(AREA_LABELS) as Area[]).map((area) => ({
              key: area,
              label: AREA_LABELS[area],
              selected: settings.area === area,
              onPress: () => update({ area }),
            }))}
          />
          <Choice
            label={t.searchRadius}
            value={
              settings.radiusM === null
                ? t.noLimit
                : RADIUS_OPTIONS.find((o) => o.value === settings.radiusM)?.label ?? t.notSet
            }
            options={RADIUS_OPTIONS.map((option) => ({
              key: option.label,
              label: option.value === null ? t.noLimit : option.label,
              selected: settings.radiusM === option.value,
              onPress: () => update({ radiusM: option.value }),
            }))}
          />
          <Toggle
            label={t.searchCircle}
            value={settings.showRadiusRing}
            onChange={(on) => update({ showRadiusRing: on })}
          />
          {/* A heads-up while riding when a shop is just ahead. On unless switched off. */}
          <Toggle label={t.shopAlerts} value={settings.shopAlerts} onChange={(on) => update({ shopAlerts: on })} />
        </Section>

        <Section title={t.sectionApp}>
          <Choice
            label={t.language}
            value={LANGUAGE_LABELS[settings.language]}
            options={(Object.keys(LANGUAGE_LABELS) as Language[]).map((code) => ({
              key: code,
              label: LANGUAGE_LABELS[code],
              flag: LANGUAGE_FLAGS[code],
              selected: settings.language === code,
              onPress: () => update({ language: code }),
            }))}
          />
          <Choice
            label={t.appearance}
            value={settings.theme === 'light' ? t.themeLight : t.themeDark}
            options={(['light', 'dark'] as ThemeName[]).map((name) => ({
              key: name,
              label: name === 'light' ? t.themeLight : t.themeDark,
              selected: settings.theme === name,
              onPress: () => update({ theme: name }),
            }))}
          />
          {/*
            A REVIEW SWITCH while we compare the candidate colour schemes on a real phone.
            Once one is picked, the others and this row are deleted.
          */}
          <Choice
            label={t.colours}
            value={PALETTE_LABELS[settings.palette]}
            options={(Object.keys(PALETTE_LABELS) as PaletteName[]).map((name) => ({
              key: name,
              label: PALETTE_LABELS[name],
              selected: settings.palette === name,
              onPress: () => update({ palette: name }),
            }))}
          />
        </Section>

        <Section title={t.sectionHelp}>
          {/* The four rider questions, on their own page (app/survey.tsx). */}
          <Link label={t.riderQuestions} onPress={() => router.push('/survey')} />
          {/*
            The second way back into the tutorial, beside the ? on the home screen.
            Clearing the flag and going home is all it takes: home starts it whenever the
            flag is clear.
          */}
          <Link
            label={t.replayTutorial}
            onPress={() => {
              update({ tourDone: false });
              router.back();
            }}
          />
          <Link label={t.about} onPress={() => setAboutOpen(true)} />
          {/* Gets a new update without closing the app (lib/updates.ts). */}
          <Link
            label={t.checkUpdates}
            value={checking ? t.updateChecking : updateReady ? t.updateReady : undefined}
            onPress={() => void onCheckUpdates()}
            disabled={checking}
          />
        </Section>

        {/*
          DEVELOPER. Field survey mode is for the people surveying shops in person and is
          removed before launch; with it on, every shop gets an "Update shop info" button
          and the two rows below appear. Build info is the GPS and update readout, behind
          one row so nobody being shown the app meets a wall of numbers.
        */}
        <Section title={t.developer}>
          <Toggle
            label={t.fieldMode}
            value={settings.fieldMode}
            onChange={(on) => update({ fieldMode: on })}
            info={() => Alert.alert(t.fieldMode, t.fieldModeInfo)}
          />
          {settings.fieldMode && (
            <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)} layout={GLIDE}>
              <Link label="Add a shop" onPress={() => router.push('/fieldwork/shop')} />
              <Link label="Survey log, export and backup" onPress={() => router.push('/fieldwork')} />
            </Animated.View>
          )}
          <Link label={t.buildInfo} onPress={() => setBuildOpen(true)} />
        </Section>
      </ScrollView>

      <Modal visible={aboutOpen} transparent animationType="fade" onRequestClose={() => setAboutOpen(false)}>
        {/*
          A CENTRED DIALOG, not a bottom sheet.

          A sheet slides up from the edge and claims a fixed share of the screen whatever
          it holds. This is three short paragraphs, so it sits in the middle, sized to its
          own content, with the screen dimmed behind it. Tapping outside dismisses.
        */}
        <Pressable style={s.dialogBackdrop} onPress={() => setAboutOpen(false)}>
          <Pressable style={s.dialog} onPress={() => {}}>
            <Text style={s.dialogTitle}>{t.about}</Text>
            <Text style={s.about}>{t.aboutBody}</Text>
            <View style={s.draft}>
              <Text style={s.draftText}>{t.draftNotice}</Text>
            </View>
            <Pressable onPress={() => setAboutOpen(false)} style={s.close} accessibilityRole="button">
              <Text style={s.closeLabel}>{t.close}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={buildOpen} transparent animationType="fade" onRequestClose={() => setBuildOpen(false)}>
        <Pressable style={s.dialogBackdrop} onPress={() => setBuildOpen(false)}>
          <Pressable style={s.dialog} onPress={() => {}}>
            <Text style={s.dialogTitle}>{t.buildInfo}</Text>
            {/* Mounted only while open, so the live GPS numbers are not computed otherwise. */}
            {buildOpen && <BuildInfo />}
            <Pressable onPress={() => setBuildOpen(false)} style={s.close} accessibilityRole="button">
              <Text style={s.closeLabel}>{t.close}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

/**
 * The OTA and GPS readout. It used to sit open at the bottom of Settings; it is a
 * developer tool, so it lives behind the Build info row now.
 */
function BuildInfo() {
  const { theme } = useSettings();
  const s = styles(theme);
  /* Read-only here: the home screen owns the permission flow. */
  const gate = useLocationGate();
  const insets = useSafeAreaInsets();
  const frame = useSafeAreaFrame();
  return (
    <View style={s.buildBox}>
      <Text style={s.buildLine}>
        {Updates.isEmbeddedLaunch ? 'Bundle: embedded (from the APK)' : 'Bundle: over-the-air update'}
      </Text>
      <Text style={s.buildLine}>
        Channel {Updates.channel ?? '—'} · runtime {Updates.runtimeVersion ?? '—'}
      </Text>
      <Text style={s.buildLine}>Update {Updates.updateId ? Updates.updateId.slice(0, 8) : '—'}</Text>
      <Text style={s.buildLine}>
        Insets top {Math.round(insets.top)} · bottom {Math.round(insets.bottom)} · screen{' '}
        {Math.round(frame.width)}×{Math.round(frame.height)}
      </Text>

      {/*
        WHAT THE GPS IS ACTUALLY DOING.

        "It put me on the next street" has at least four different causes, and they
        need different fixes. These numbers separate them:

          radius 100m+   the phone never used satellites, only WiFi and towers
          GPS no         the chip is unavailable, so accuracy settings change nothing
          age 60s+       the position on screen is a memory, not a reading
          mocked yes     another app is feeding the phone a position
          rejected 0     the fused provider is not mixing sources, so look elsewhere
      */}
      <Text style={s.buildLine}>
        Fix radius {gate.debug.accuracyM === null ? '—' : `${Math.round(gate.debug.accuracyM)} m`}
        {gate.debug.smoothedM === null ? '' : ` → ${gate.debug.smoothedM} m smoothed`}
        {' · '}age {gate.debug.ageS === null ? '—' : `${gate.debug.ageS} s`}
        {' · '}
        {gate.stale ? 'remembered' : 'live'}
      </Text>
      <Text style={s.buildLine}>
        GPS {gate.debug.gpsAvailable === null ? '—' : gate.debug.gpsAvailable ? 'yes' : 'NO'}
        {' · '}network {gate.debug.networkAvailable === null ? '—' : gate.debug.networkAvailable ? 'yes' : 'no'}
        {' · '}mocked {gate.debug.mocked === null ? '—' : gate.debug.mocked ? 'YES' : 'no'}
      </Text>
      <Text style={s.buildLine}>
        Fixes accepted {gate.debug.accepted} · rejected as worse {gate.debug.rejected}
      </Text>
      {/* Why the live watch failed, word for word. Blank while it runs. */}
      <Text style={s.buildLine} selectable>
        Watch {gate.debug.watchError ? `FAILED: ${gate.debug.watchError}` : gate.status === 'ready' ? 'running' : '—'}
      </Text>
      {/*
        COMPARE WITH GOOGLE MAPS. If these numbers match Google's within about 10 m but
        the dots sit in different places, the two MAPS draw the street differently;
        if the numbers differ, the position does.
      */}
      <Text style={s.buildLine} selectable>
        Drawn {gate.position ? `${gate.position[1].toFixed(6)}, ${gate.position[0].toFixed(6)}` : '—'}
      </Text>
      <Text style={s.buildLine} selectable>
        Phone {gate.debug.raw ? `${gate.debug.raw[1].toFixed(6)}, ${gate.debug.raw[0].toFixed(6)}` : '—'}
        {' · '}speed {gate.debug.speed === null ? '—' : `${gate.debug.speed.toFixed(1)} m/s`}
        {' · '}precise {gate.precise === null ? '—' : gate.precise ? 'yes' : 'NO'}
      </Text>
    </View>
  );
}

/** A titled card of rows. It glides when a section above it grows or shrinks. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { theme } = useSettings();
  const s = styles(theme);
  return (
    <Animated.View style={s.group} layout={GLIDE}>
      <Text style={s.groupTitle}>{title}</Text>
      <Animated.View style={s.groupBody} layout={GLIDE}>
        {children}
      </Animated.View>
    </Animated.View>
  );
}

type ChoiceOption = { key: string; label: string; selected: boolean; onPress: () => void; flag?: string };

/**
 * One setting with several answers. The row shows the current answer; tapping it opens
 * the answers in place, and picking one closes it again.
 */
function Choice({ label, value, options }: { label: string; value: string; options: ChoiceOption[] }) {
  const { theme } = useSettings();
  const s = styles(theme);
  const [open, setOpen] = useState(false);
  return (
    <Animated.View layout={GLIDE}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        style={({ pressed }) => [s.row, pressed && s.pressed]}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${label}: ${value}`}
      >
        <Text style={s.rowLabel}>{label}</Text>
        <Text style={s.rowValue} numberOfLines={1}>
          {value}
        </Text>
        <ExpandIcon open={open} size={22} color={theme.ink3} />
      </Pressable>
      {open && (
        <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)} style={s.options}>
          {options.map((option) => (
            <Pressable
              key={option.key}
              onPress={() => {
                option.onPress();
                setOpen(false);
              }}
              style={({ pressed }) => [s.option, pressed && s.pressed]}
              accessibilityRole="radio"
              accessibilityState={{ selected: option.selected }}
            >
              {option.flag ? <Text style={s.flag}>{option.flag}</Text> : null}
              <Text style={[s.optionLabel, option.selected && s.optionLabelOn]}>{option.label}</Text>
              {/* Tick as well as colour: selection is never carried by colour alone. */}
              <Text style={[s.tick, option.selected && s.tickOn]}>{option.selected ? '✓' : ''}</Text>
            </Pressable>
          ))}
        </Animated.View>
      )}
    </Animated.View>
  );
}

/** An on/off setting: the phone's own switch, one tap. */
function Toggle({
  label,
  value,
  onChange,
  info,
}: {
  label: string;
  value: boolean;
  onChange: (on: boolean) => void;
  /** Optional ⓘ beside the label, for a setting that needs a sentence of explanation. */
  info?: () => void;
}) {
  const { theme } = useSettings();
  const s = styles(theme);
  return (
    <Animated.View layout={GLIDE} style={s.row}>
      <View style={s.toggleLabel}>
        <Text style={s.rowLabelFixed}>{label}</Text>
        {info && (
          <Pressable onPress={info} hitSlop={12} accessibilityRole="button" accessibilityLabel={`About ${label}`}>
            <Text style={s.infoGlyph}>ⓘ</Text>
          </Pressable>
        )}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: theme.call, false: theme.line }}
        accessibilityLabel={label}
      />
    </Animated.View>
  );
}

/** A row that goes somewhere or does something, with an optional status on the right. */
function Link({
  label,
  value,
  onPress,
  disabled,
}: {
  label: string;
  value?: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { theme } = useSettings();
  const s = styles(theme);
  return (
    <Animated.View layout={GLIDE}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        style={({ pressed }) => [s.row, pressed && s.pressed]}
        accessibilityRole="button"
      >
        <Text style={s.rowLabel}>{label}</Text>
        {value ? (
          <Text style={s.rowValue} numberOfLines={1}>
            {value}
          </Text>
        ) : null}
        <Text style={s.chevron}>›</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = (theme: ReturnType<typeof useSettings>['theme']) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.bg },

    body: { padding: 18, gap: 24, paddingBottom: 40 },
    group: { gap: 8 },
    infoGlyph: { fontSize: 18, color: theme.call, fontWeight: '700' },
    groupTitle: {
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 1,
      color: theme.ink3,
      textTransform: 'uppercase',
    },
    groupBody: {
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.line,
      backgroundColor: theme.surface,
      overflow: 'hidden',
    },
    row: {
      minHeight: 52,
      paddingHorizontal: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.lineSoft,
    },
    rowLabel: { fontSize: 16, color: theme.ink, flexGrow: 1, flexShrink: 1 },
    rowLabelFixed: { fontSize: 16, color: theme.ink, flexShrink: 1 },
    rowValue: { fontSize: 15, color: theme.ink2, fontWeight: '600', flexShrink: 1, maxWidth: '55%' },
    toggleLabel: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },

    /* The opened answers, set in slightly so they read as belonging to the row above. */
    options: { backgroundColor: theme.bg, paddingLeft: 12 },
    option: {
      minHeight: 48,
      paddingHorizontal: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.lineSoft,
    },
    flag: { fontSize: 22 },
    optionLabel: { fontSize: 15.5, color: theme.ink, flexShrink: 1, flexGrow: 1 },
    optionLabelOn: { fontWeight: '700', color: theme.call },
    pressed: { opacity: 0.6 },
    tick: { fontSize: 18, color: 'transparent' },
    tickOn: { color: theme.call },

    chevron: { fontSize: 22, color: theme.ink3 },
    dialogBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    dialog: {
      width: '100%',
      maxWidth: 400,
      backgroundColor: theme.bg,
      borderRadius: 18,
      padding: 22,
      gap: 14,
    },
    dialogTitle: { fontSize: 20, fontWeight: '700', color: theme.ink },
    close: {
      height: 50,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: theme.ink,
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeLabel: { fontSize: 16, fontWeight: '700', color: theme.ink },
    about: { fontSize: 15, color: theme.ink2, lineHeight: 22 },
    draft: {
      padding: 14,
      borderRadius: 10,
      backgroundColor: theme.accentFill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.accent,
    },
    draftText: { fontSize: 13.5, color: theme.ink, lineHeight: 20, fontWeight: '600' },
    buildBox: { gap: 4 },
    buildLine: { fontSize: 12.5, color: theme.ink3 },
  });
