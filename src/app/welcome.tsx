import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SURVEY_KEYS, SurveyQuestion } from '@/components/SurveyQuestions';
import { LANGUAGE_LABELS, type Language } from '@/lib/i18n/strings';
import { AREA_LABELS, useSettings, type Area } from '@/lib/settings/store';
import { surveyComplete } from '@/lib/survey/questions';
import type { ThemeName } from '@/lib/theme/tokens';

/**
 * First run, once only.
 *
 * Three optional steps (language, area, light or dark), then THE RIDER QUESTIONS, which are
 * REQUIRED (Clint, 1 Nov): the app opens only once they are answered (surveyComplete).
 * After them a confirmation says the answers are recorded. That is a DEMO stand-in: today
 * the answers stay on this phone (lib/survey/questions.ts); they are sent once the database
 * exists. They are not in Settings: asked once, here.
 *
 * Saving `onboarded: true` and `surveyState: 'answered'` at the very end is what stops this
 * screen appearing again; the root layout checks both on every launch. A rider from before
 * the questions were required (onboarded, not answered) starts straight at the questions.
 *
 * Language is asked first and applied immediately, so the rest is already in the rider's
 * language.
 */

/*
  0 language, 1 area, 2 light or dark: optional, Skip on the first jumps to the questions.
  3 the rider questions: required. 4 the confirmation.
*/
const QUESTIONS = 3;
const DONE = 4;
const LAST_OPTIONAL = 2;

export default function WelcomeScreen() {
  const { settings, update, theme, t } = useSettings();
  const router = useRouter();
  const [step, setStep] = useState(settings.onboarded ? QUESTIONS : 0);
  const [howUsed, setHowUsed] = useState(false);
  const complete = surveyComplete(settings.survey);

  const finish = () => {
    update({ onboarded: true, surveyState: 'answered' });
    router.replace('/');
  };

  const next = () => setStep((s) => Math.min(s + 1, DONE));
  const back = () => setStep((s) => Math.max(s - 1, settings.onboarded ? QUESTIONS : 0));

  const s = styles(theme);

  return (
    <SafeAreaView style={s.screen} edges={['top', 'bottom']}>
      <View style={s.progressRow}>
        {Array.from({ length: DONE + 1 }, (_, i) => (
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

        {step === LAST_OPTIONAL && (
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

        {step === QUESTIONS && (
          <View style={s.section}>
            <Text style={s.lede}>{t.qIntro}</Text>
            {/* Grey, tappable, opens in place: how the answers are used. */}
            <Pressable onPress={() => setHowUsed((v) => !v)} hitSlop={8} accessibilityRole="button" accessibilityState={{ expanded: howUsed }}>
              <Text style={s.howLink}>
                {t.qHowUsedLink} {howUsed ? '▴' : '▾'}
              </Text>
            </Pressable>
            {howUsed && <Text style={s.help}>{t.qHowUsed}</Text>}
            <View style={s.questions}>
              {SURVEY_KEYS.map((key) => (
                <SurveyQuestion key={key} which={key} />
              ))}
            </View>
            {!complete && <Text style={s.help}>{t.qNeedAll}</Text>}
          </View>
        )}

        {step === DONE && (
          <View style={[s.section, s.doneBox]}>
            <Text style={s.doneTick}>✓</Text>
            <Text style={s.title}>{t.qRecordedTitle}</Text>
            <Text style={s.lede}>{t.qRecordedBody}</Text>
          </View>
        )}
      </ScrollView>

      <View style={s.footer}>
        {step === 0 ? (
          /* Skips the optional preferences only; the questions still come. */
          <Pressable onPress={() => setStep(QUESTIONS)} style={s.secondaryBtn} accessibilityRole="button">
            <Text style={s.secondaryLabel}>{t.skip}</Text>
          </Pressable>
        ) : step < DONE && !(settings.onboarded && step === QUESTIONS) ? (
          <Pressable onPress={back} style={s.secondaryBtn} accessibilityRole="button">
            <Text style={s.secondaryLabel}>{t.back}</Text>
          </Pressable>
        ) : null}

        <Pressable
          onPress={step === DONE ? finish : next}
          disabled={step === QUESTIONS && !complete}
          style={[s.primaryBtn, step === QUESTIONS && !complete && s.primaryOff]}
          accessibilityRole="button"
          accessibilityState={{ disabled: step === QUESTIONS && !complete }}
        >
          <Text style={s.primaryLabel}>{step === DONE ? t.finish : step === QUESTIONS ? t.qSubmit : t.continueLabel}</Text>
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
    howLink: { fontSize: 14, color: theme.ink3, textDecorationLine: 'underline' },
    questions: { gap: 28, marginTop: 8 },
    doneBox: { alignItems: 'center', paddingTop: 48 },
    doneTick: { fontSize: 44, color: theme.call, fontWeight: '800' },
    primaryOff: { opacity: 0.4 },
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
