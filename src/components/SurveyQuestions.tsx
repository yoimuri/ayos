import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useSettings } from '@/lib/settings/store';
import { BRANDS, SERVICES, VISITS, yearOptions, type RiderSurvey } from '@/lib/survey/questions';

/**
 * One rider question, drawn as big tappable choices. Used twice: one per step on the
 * welcome screen, and all four together on the Settings -> Rider questions screen.
 *
 * Every answer is saved the moment it is tapped, like every other setting, so backing
 * out loses nothing. Tapping a chosen answer again clears it: a rider who tapped by
 * mistake must be able to leave the question blank.
 */

export type SurveyKey = 'brand' | 'year' | 'visits' | 'services';
export const SURVEY_KEYS: SurveyKey[] = ['brand', 'year', 'visits', 'services'];

export function SurveyQuestion({ which }: { which: SurveyKey }) {
  const { settings, update, theme, t } = useSettings();
  const s = styles(theme);
  const answers = settings.survey ?? {};
  const set = (patch: Partial<RiderSurvey>) => update({ survey: { ...answers, ...patch } });

  /* One answer: tap to choose, tap again to clear. */
  const single = (field: 'brand' | 'year' | 'visits', options: string[]) => (
    <View style={s.grid}>
      {options.map((option) => (
        <Chip
          key={option}
          label={option}
          on={answers[field] === option}
          onPress={() => set({ [field]: answers[field] === option ? undefined : option })}
        />
      ))}
    </View>
  );

  if (which === 'brand') {
    return (
      <View style={s.section}>
        <Text style={s.question}>{t.qBrand}</Text>
        {single('brand', BRANDS)}
        <Text style={s.subQuestion}>{t.qModel}</Text>
        <TextInput
          value={answers.model ?? ''}
          onChangeText={(model) => set({ model: model.trim() ? model : undefined })}
          placeholder={t.qModelHint}
          placeholderTextColor={theme.ink3}
          style={s.input}
          maxLength={40}
          autoCorrect={false}
        />
      </View>
    );
  }

  if (which === 'year') {
    return (
      <View style={s.section}>
        <Text style={s.question}>{t.qYear}</Text>
        {single('year', yearOptions(new Date()))}
      </View>
    );
  }

  if (which === 'visits') {
    return (
      <View style={s.section}>
        <Text style={s.question}>{t.qVisits}</Text>
        {single('visits', VISITS)}
        <Text style={s.help}>{t.qVisitsUnit}</Text>
      </View>
    );
  }

  /* Services: pick as many as apply. */
  const chosen = answers.services ?? [];
  return (
    <View style={s.section}>
      <Text style={s.question}>{t.qServices}</Text>
      <Text style={s.help}>{t.qServicesHint}</Text>
      <View style={s.grid}>
        {SERVICES.map((option) => (
          <Chip
            key={option}
            label={option}
            on={chosen.includes(option)}
            onPress={() =>
              set({
                services: chosen.includes(option)
                  ? chosen.filter((x) => x !== option)
                  : [...chosen, option],
              })
            }
          />
        ))}
      </View>
    </View>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const { theme } = useSettings();
  const s = styles(theme);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [s.chip, on && s.chipOn, pressed && s.pressed]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
    >
      {/* A tick as well as colour: selection is never carried by colour alone. */}
      <Text style={[s.chipText, on && s.chipTextOn]}>
        {on ? '✓ ' : ''}
        {label}
      </Text>
    </Pressable>
  );
}

const styles = (theme: ReturnType<typeof useSettings>['theme']) =>
  StyleSheet.create({
    section: { gap: 12 },
    question: { fontSize: 20, fontWeight: '700', color: theme.ink, lineHeight: 26 },
    subQuestion: { fontSize: 17, fontWeight: '700', color: theme.ink, marginTop: 6 },
    help: { fontSize: 14, color: theme.ink3, lineHeight: 20 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    chip: {
      minHeight: 48,
      paddingHorizontal: 16,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: theme.line,
      backgroundColor: theme.surface,
      justifyContent: 'center',
    },
    chipOn: { borderColor: theme.call, borderWidth: 2, backgroundColor: theme.callFill },
    chipText: { fontSize: 16, color: theme.ink },
    chipTextOn: { fontWeight: '700', color: theme.call },
    pressed: { opacity: 0.6 },
    input: {
      height: 52,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: theme.line,
      backgroundColor: theme.surface,
      paddingHorizontal: 14,
      fontSize: 16,
      color: theme.ink,
    },
  });
