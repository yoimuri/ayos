import { useState } from 'react';
import { useRouter } from 'expo-router';

import { BrandBar } from '@/components/BrandBar';
import { ExpandIcon } from '@/components/icons';
import * as Updates from 'expo-updates';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaFrame, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLocationGate } from '@/lib/location/useLocationGate';
import { LANGUAGE_FLAGS, LANGUAGE_LABELS, type Language } from '@/lib/i18n/strings';
import { RADIUS_OPTIONS } from '@/lib/geo/distance';
import { AREA_LABELS, useSettings, type Area } from '@/lib/settings/store';
import { PALETTE_LABELS, type PaletteName, type ThemeName } from '@/lib/theme/tokens';

/**
 * Everything the welcome screen asked, changeable afterwards.
 *
 * This is what makes the first run safe to answer quickly: nothing chosen there is
 * permanent. Each change is written to disk as it is made, so there is no save
 * button and nothing to lose by backing out.
 */

export default function SettingsScreen() {
  const [aboutOpen, setAboutOpen] = useState(false);
  const { settings, update, theme, t } = useSettings();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  /* Read-only here: the home screen owns the permission flow. */
  const gate = useLocationGate();
  const frame = useSafeAreaFrame();
  const s = styles(theme);

  return (
    <SafeAreaView style={s.screen} edges={['top', 'bottom']}>
      <BrandBar title={t.settings} />

      <ScrollView
        contentContainerStyle={s.body}
        showsVerticalScrollIndicator={false}
      >
        {/*
          FOLDED BY DEFAULT: each group is one row showing
          what is chosen, with a down arrow; tapping it opens the full list. Seventeen
          cities and five radii no longer fill the screen before anything else is visible.
        */}
        <Group title={t.language} summary={LANGUAGE_LABELS[settings.language]}>
          {(Object.keys(LANGUAGE_LABELS) as Language[]).map((code) => (
            <Option
              key={code}
              label={LANGUAGE_LABELS[code]}
              flag={LANGUAGE_FLAGS[code]}
              selected={settings.language === code}
              onPress={() => update({ language: code })}
            />
          ))}
        </Group>

        <Group title={t.appearance} summary={settings.theme === 'light' ? t.themeLight : t.themeDark}>
          {(['light', 'dark'] as ThemeName[]).map((name) => (
            <Option
              key={name}
              label={name === 'light' ? t.themeLight : t.themeDark}
              selected={settings.theme === name}
              onPress={() => update({ theme: name })}
            />
          ))}
        </Group>

        {/*
          A REVIEW SWITCH while we compare the candidate colour schemes on a real phone.
          Once one is picked, the others and this group are deleted.
        */}
        <Group title={t.colours} summary={PALETTE_LABELS[settings.palette]}>
          {(Object.keys(PALETTE_LABELS) as PaletteName[]).map((name) => (
            <Option
              key={name}
              label={PALETTE_LABELS[name]}
              selected={settings.palette === name}
              onPress={() => update({ palette: name })}
            />
          ))}
        </Group>

        <Group title={t.area} summary={settings.area ? AREA_LABELS[settings.area] : t.notSet}>
          {(Object.keys(AREA_LABELS) as Area[]).map((area) => (
            <Option
              key={area}
              label={AREA_LABELS[area]}
              selected={settings.area === area}
              onPress={() => update({ area })}
            />
          ))}
        </Group>

        <Group title={t.motorcycle}>
          {/* The four rider questions, on their own page (app/survey.tsx). */}
          <Pressable
            onPress={() => router.push('/survey')}
            style={s.option}
            accessibilityRole="button"
          >
            <Text style={s.optionLabel}>{t.riderQuestions}</Text>
            <Text style={s.chevron}>›</Text>
          </Pressable>
        </Group>

        <Group
          title={t.searchRadius}
          summary={RADIUS_OPTIONS.find((o) => o.value === settings.radiusM)?.label.replace('All', 'No limit') ?? t.notSet}
        >
          {RADIUS_OPTIONS.map((option) => (
            <Option
              key={option.label}
              label={option.label === 'All' ? 'No limit' : option.label}
              selected={settings.radiusM === option.value}
              onPress={() => update({ radiusM: option.value })}
            />
          ))}
        </Group>

        <Group title="Map" summary={settings.showRadiusRing ? 'Show search circle' : 'Hide search circle'}>
          <Option
            label="Show search circle"
            selected={settings.showRadiusRing}
            onPress={() => update({ showRadiusRing: true })}
          />
          <Option
            label="Hide search circle"
            selected={!settings.showRadiusRing}
            onPress={() => update({ showRadiusRing: false })}
          />
        </Group>

        <Group title={t.about}>
          <Pressable onPress={() => setAboutOpen(true)} style={s.option} accessibilityRole="button">
            <Text style={s.optionLabel}>{t.about}</Text>
            <Text style={s.chevron}>›</Text>
          </Pressable>
          {/*
            The second way back into the tutorial, beside the ? on the home screen.
            Clearing the flag and going home is all it takes: home starts it whenever the
            flag is clear.
          */}
          <Pressable
            onPress={() => {
              update({ tourDone: false });
              router.back();
            }}
            style={s.option}
            accessibilityRole="button"
          >
            <Text style={s.optionLabel}>{t.replayTutorial}</Text>
            <Text style={s.chevron}>›</Text>
          </Pressable>
        </Group>

        {/*
          The OTA diagnostic lives HERE now, not on the home screen.

          It is a developer readout, and a permanent amber strip across the main screen
          is wrong in front of anyone being shown the app. Settings is where someone
          goes looking for build information, and it is one tap away when a number is
          needed.
        */}
        <Group title={t.developer} summary={t.developer}>
          <View style={s.buildBox}>
            <Text style={s.buildLine}>
              {Updates.isEmbeddedLaunch ? 'Bundle: embedded (from the APK)' : 'Bundle: over-the-air update'}
            </Text>
            <Text style={s.buildLine}>
              Channel {Updates.channel ?? '—'} · runtime {Updates.runtimeVersion ?? '—'}
            </Text>
            <Text style={s.buildLine}>
              Update {Updates.updateId ? Updates.updateId.slice(0, 8) : '—'}
            </Text>
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
              {' · '}{gate.stale ? 'remembered' : 'live'}
            </Text>
            <Text style={s.buildLine}>
              GPS {gate.debug.gpsAvailable === null ? '—' : gate.debug.gpsAvailable ? 'yes' : 'NO'}
              {' · '}network{' '}
              {gate.debug.networkAvailable === null ? '—' : gate.debug.networkAvailable ? 'yes' : 'no'}
              {' · '}mocked {gate.debug.mocked === null ? '—' : gate.debug.mocked ? 'YES' : 'no'}
            </Text>
            <Text style={s.buildLine}>
              Fixes accepted {gate.debug.accepted} · rejected as worse {gate.debug.rejected}
            </Text>
          </View>
        </Group>
      </ScrollView>

      <Modal
        visible={aboutOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setAboutOpen(false)}
      >
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
            <Pressable
              onPress={() => setAboutOpen(false)}
              style={s.close}
              accessibilityRole="button"
            >
              <Text style={s.closeLabel}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

/**
 * One settings group. Given a `summary`, it is FOLDED: a single row showing the current
 * choice and a down arrow, opening to the full list when tapped. Without one (About,
 * Motorcycle) it simply shows its rows.
 */
function Group({
  title,
  summary,
  children,
}: {
  title: string;
  summary?: string;
  children: React.ReactNode;
}) {
  const { theme } = useSettings();
  const s = styles(theme);
  const [open, setOpen] = useState(false);
  return (
    <View style={s.group}>
      <Text style={s.groupTitle}>{title}</Text>
      <View style={s.groupBody}>
        {summary !== undefined && (
          <Pressable
            onPress={() => setOpen((o) => !o)}
            style={({ pressed }) => [s.option, pressed && s.pressed]}
            accessibilityRole="button"
            accessibilityState={{ expanded: open }}
            accessibilityLabel={`${title}: ${summary}`}
          >
            <Text style={[s.optionLabel, s.summary]} numberOfLines={1}>
              {summary}
            </Text>
            <ExpandIcon open={open} size={24} color={theme.ink3} />
          </Pressable>
        )}
        {(summary === undefined || open) && children}
      </View>
    </View>
  );
}

function Option({
  label,
  selected,
  onPress,
  flag,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** Optional leading glyph. Used for language flags. */
  flag?: string;
}) {
  const { theme } = useSettings();
  const s = styles(theme);
  return (
    <Pressable
      onPress={onPress}
      style={s.option}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
    >
      {flag ? <Text style={s.flag}>{flag}</Text> : null}
      <Text style={[s.optionLabel, selected && s.optionLabelOn]}>{label}</Text>
      {/* Tick as well as colour: selection is never carried by colour alone. */}
      <Text style={[s.tick, selected && s.tickOn]}>{selected ? '✓' : ''}</Text>
    </Pressable>
  );
}

const styles = (theme: ReturnType<typeof useSettings>['theme']) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.bg },

    body: { padding: 18, gap: 24, paddingBottom: 40 },
    group: { gap: 8 },
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
    option: {
      minHeight: 52,
      paddingHorizontal: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.lineSoft,
    },
    flag: { fontSize: 22 },
    optionLabel: { fontSize: 16, color: theme.ink, flexShrink: 1, flexGrow: 1 },
    optionLabelOn: { fontWeight: '700', color: theme.call },
    summary: { fontWeight: '600' },
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
      height: 50, borderRadius: 12,
      borderWidth: 2, borderColor: theme.ink, alignItems: 'center', justifyContent: 'center',
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
    buildBox: { padding: 16, gap: 4 },
    buildLine: { fontSize: 12.5, color: theme.ink3 },
  });
