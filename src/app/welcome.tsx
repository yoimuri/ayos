import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LANGUAGE_LABELS, type Language } from '@/lib/i18n/strings';
import {
  AREA_LABELS,
  BIKE_LABELS,
  useSettings,
  type Area,
  type BikeKind,
} from '@/lib/settings/store';
import type { ThemeName } from '@/lib/theme/tokens';

/**
 * First run, once only.
 *
 * Four questions, each skippable, answered before the rider reaches the app. Saving
 * `onboarded: true` at the end is what stops this screen ever appearing again; the
 * root layout checks that flag on every launch. Everything asked here is changeable
 * afterwards in Settings, which is why none of it needs to be got right first time.
 *
 * Language is asked first and applied immediately, so the remaining questions are
 * already in the rider's language.
 */

type Step = 0 | 1 | 2 | 3;

export default function WelcomeScreen() {
  const { settings, update, theme, t } = useSettings();
  const router = useRouter();
  const [step, setStep] = useState<Step>(0);

  const finish = () => {
    update({ onboarded: true });
    router.replace('/');
  };

  const next = () => setStep((s) => (s < 3 ? ((s + 1) as Step) : s));
  const back = () => setStep((s) => (s > 0 ? ((s - 1) as Step) : s));

  const s = styles(theme);

  return (
    <SafeAreaView style={s.screen} edges={['top', 'bottom']}>
      <View style={s.progressRow}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={[s.progressBar, i <= step && s.progressBarDone]} />
        ))}
      </View>

      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        {step === 0 && (
          <View style={s.section}>
            <Text style={s.title}>{t.welcomeTitle}</Text>
            <Text style={s.lede}>{t.welcomeBody}</Text>

            <Text style={s.question}>{t.chooseLanguage}</Text>
            {(Object.keys(LANGUAGE_LABELS) as Language[]).map((code) => (
              <Choice
                key={code}
                label={LANGUAGE_LABELS[code]}
                selected={settings.language === code}
                onPress={() => update({ language: code })}
                theme={theme}
              />
            ))}
          </View>
        )}

        {step === 1 && (
          <View style={s.section}>
            <Text style={s.question}>{t.chooseArea}</Text>
            <Text style={s.help}>{t.chooseAreaHelp}</Text>
            {(Object.keys(AREA_LABELS) as Area[]).map((area) => (
              <Choice
                key={area}
                label={AREA_LABELS[area]}
                selected={settings.area === area}
                onPress={() => update({ area })}
                theme={theme}
              />
            ))}
          </View>
        )}

        {step === 2 && (
          <View style={s.section}>
            <Text style={s.question}>{t.chooseBike}</Text>
            <Text style={s.help}>{t.chooseBikeHelp}</Text>
            {(Object.keys(BIKE_LABELS) as BikeKind[]).map((bike) => (
              <Choice
                key={bike}
                label={BIKE_LABELS[bike]}
                selected={settings.bike === bike}
                onPress={() => update({ bike })}
                theme={theme}
              />
            ))}
          </View>
        )}

        {step === 3 && (
          <View style={s.section}>
            <Text style={s.question}>{t.chooseTheme}</Text>
            {(['light', 'dark'] as ThemeName[]).map((name) => (
              <Choice
                key={name}
                label={name === 'light' ? t.themeLight : t.themeDark}
                selected={settings.theme === name}
                onPress={() => update({ theme: name })}
                theme={theme}
              />
            ))}
            <Text style={s.help}>{t.changeLaterInSettings}</Text>
          </View>
        )}
      </ScrollView>

      <View style={s.footer}>
        {step > 0 ? (
          <Pressable onPress={back} style={s.secondaryBtn} accessibilityRole="button">
            <Text style={s.secondaryLabel}>{t.back}</Text>
          </Pressable>
        ) : (
          <Pressable onPress={finish} style={s.secondaryBtn} accessibilityRole="button">
            <Text style={s.secondaryLabel}>{t.skip}</Text>
          </Pressable>
        )}

        <Pressable
          onPress={step === 3 ? finish : next}
          style={s.primaryBtn}
          accessibilityRole="button"
        >
          <Text style={s.primaryLabel}>{step === 3 ? t.finish : t.continueLabel}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function Choice({
  label,
  selected,
  onPress,
  theme,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  theme: ReturnType<typeof useSettings>['theme'];
}) {
  const s = styles(theme);
  return (
    <Pressable
      onPress={onPress}
      style={[s.choice, selected && s.choiceOn]}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
    >
      <Text style={[s.choiceLabel, selected && s.choiceLabelOn]}>{label}</Text>
      {/*
        A tick as well as a colour change. Selection must never be carried by colour
        alone, both for colourblind riders and for glare on a bright street.
      */}
      <Text style={[s.tick, selected && s.tickOn]}>{selected ? '✓' : ''}</Text>
    </Pressable>
  );
}

const styles = (theme: ReturnType<typeof useSettings>['theme']) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.bg },
    progressRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 18, paddingTop: 12 },
    progressBar: { flex: 1, height: 4, borderRadius: 2, backgroundColor: theme.line },
    progressBarDone: { backgroundColor: theme.call },
    body: { padding: 18, paddingBottom: 28, gap: 18 },
    section: { gap: 12 },
    title: { fontSize: 28, fontWeight: '700', color: theme.ink, letterSpacing: -0.5, lineHeight: 33 },
    lede: { fontSize: 16, color: theme.ink2, lineHeight: 24 },
    question: { fontSize: 20, fontWeight: '700', color: theme.ink, marginTop: 8 },
    help: { fontSize: 14, color: theme.ink3, lineHeight: 20 },
    choice: {
      minHeight: 56,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: theme.line,
      backgroundColor: theme.surface,
      paddingHorizontal: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    choiceOn: { borderColor: theme.call, borderWidth: 2, backgroundColor: theme.callFill },
    choiceLabel: { fontSize: 16, color: theme.ink, flexShrink: 1 },
    choiceLabelOn: { fontWeight: '600', color: theme.call },
    tick: { fontSize: 18, color: 'transparent' },
    tickOn: { color: theme.call },
    footer: {
      flexDirection: 'row',
      gap: 12,
      padding: 18,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.line,
    },
    secondaryBtn: { height: 56, paddingHorizontal: 20, justifyContent: 'center' },
    secondaryLabel: { fontSize: 16, fontWeight: '600', color: theme.ink2 },
    primaryBtn: {
      flex: 1,
      height: 56,
      borderRadius: 13,
      backgroundColor: theme.ink,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryLabel: { fontSize: 17, fontWeight: '700', color: theme.bg },
  });
