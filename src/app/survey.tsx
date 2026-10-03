import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandBar } from '@/components/BrandBar';
import { SURVEY_KEYS, SurveyQuestion } from '@/components/SurveyQuestions';
import { useSettings } from '@/lib/settings/store';

/**
 * The four rider questions on one page. Reached from the thank-you popup, the reminder
 * at the top of the shop list, and Settings -> Rider questions. Answers save as they are
 * tapped; Done marks the questions answered so the popup and reminder stop.
 */
export default function SurveyScreen() {
  const { theme, t, update } = useSettings();
  const router = useRouter();
  const s = styles(theme);

  return (
    <SafeAreaView style={s.screen} edges={['top', 'bottom']}>
      <BrandBar title={t.riderQuestions} />
      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        <Text style={s.help}>{t.surveyWhy}</Text>
        {SURVEY_KEYS.map((key) => (
          <SurveyQuestion key={key} which={key} />
        ))}
        <Pressable
          onPress={() => {
            /* Done means the popup and the reminder never come back. */
            update({ surveyState: 'answered' });
            router.back();
          }}
          style={({ pressed }) => [s.done, pressed && s.pressed]}
          accessibilityRole="button"
        >
          <Text style={s.doneText}>{t.done}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = (theme: ReturnType<typeof useSettings>['theme']) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.bg },
    body: { padding: 18, gap: 28, paddingBottom: 40 },
    help: { fontSize: 14, color: theme.ink3, lineHeight: 20 },
    done: {
      height: 56,
      borderRadius: 13,
      backgroundColor: theme.call,
      alignItems: 'center',
      justifyContent: 'center',
    },
    doneText: { fontSize: 17, fontWeight: '700', color: theme.onFilled },
    pressed: { opacity: 0.6 },
  });
