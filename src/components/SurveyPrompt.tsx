import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useSettings } from '@/lib/settings/store';

/**
 * The thank-you popup that asks for the rider questions.
 *
 * WHEN: once, after the tutorial on first use (never stacked on top of it), or on the
 * next opening for a rider who already had the tutorial. Never while another card is up.
 *
 * NEVER A GATE: Later, a tap outside, or the phone's back button all close it, and the
 * reminder that stays is one small row at the top of the list, not another popup. Someone
 * who opened the app because their bike broke down must be able to get past this in one
 * tap.
 */
export function SurveyPrompt({
  visible,
  onAnswer,
  onLater,
}: {
  visible: boolean;
  onAnswer: () => void;
  onLater: () => void;
}) {
  const { theme, t } = useSettings();
  const s = styles(theme);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onLater}>
      <Pressable style={s.backdrop} onPress={onLater} accessibilityLabel={t.later}>
        <Pressable style={s.card} onPress={() => {}}>
          <Text style={s.title}>{t.surveyThanksTitle}</Text>
          <Text style={s.body}>{t.surveyThanksBody}</Text>
          <View style={s.buttons}>
            <Pressable
              onPress={onAnswer}
              style={({ pressed }) => [s.primary, pressed && s.pressed]}
              accessibilityRole="button"
            >
              <Text style={s.primaryText}>{t.answerNow}</Text>
            </Pressable>
            <Pressable
              onPress={onLater}
              style={({ pressed }) => [s.secondary, pressed && s.pressed]}
              accessibilityRole="button"
            >
              <Text style={s.secondaryText}>{t.later}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = (theme: ReturnType<typeof useSettings>['theme']) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 22,
    },
    card: { width: '100%', maxWidth: 420, backgroundColor: theme.bg, borderRadius: 18, padding: 22, gap: 14 },
    title: { fontSize: 21, fontWeight: '700', color: theme.ink, lineHeight: 27 },
    body: { fontSize: 16, color: theme.ink2, lineHeight: 23 },
    buttons: { gap: 10, marginTop: 4 },
    primary: {
      minHeight: 54,
      borderRadius: 13,
      backgroundColor: theme.call,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryText: { fontSize: 17, fontWeight: '700', color: theme.onFilled },
    secondary: { minHeight: 50, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
    secondaryText: { fontSize: 16, fontWeight: '700', color: theme.ink2 },
    pressed: { opacity: 0.6 },
  });
