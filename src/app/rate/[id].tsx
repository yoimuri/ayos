import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandBar } from '@/components/BrandBar';
import { StarRating } from '@/components/StarRating';
import { findShop } from '@/lib/dev/sample-shops';
import { useSettings } from '@/lib/settings/store';

/**
 * Rating a shop. MOCK SUBMIT.
 *
 * Everything on screen works: the stars respond, the fields hold text, validation
 * runs, and submitting shows the confirmation a rider would really see. What does NOT
 * happen is the part that needs a server: nothing is stored, no email is sent, no
 * rate limit is checked.
 *
 * That split is deliberate. It makes the flow demonstrable now, and it leaves the
 * three things that MUST be server-side (storage, the confirmation email, the rate
 * limits) missing rather than faked into something that looks finished.
 *
 * At build step 9 the submit handler calls a Supabase Edge Function and the rest of
 * this screen stays as it is.
 */

export default function RateScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme, t } = useSettings();
  const router = useRouter();
  const shop = findShop(String(id));

  const [stars, setStars] = useState(0);
  /*
    MOCK ATTACHMENTS. Choosing a real photo needs `expo-image-picker`, which is a
    native module: it cannot ship over the air and costs a build. These chips prove
    the flow and the layout; the picker is wired in the same build as MapLibre.
  */
  const [proof, setProof] = useState<{ kind: 'photo' | 'video'; label: string }[]>([]);
  const [body, setBody] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  /* Frozen while a star drag is in progress, so the page cannot slide underneath it. */
  const [scrollEnabled, setScrollEnabled] = useState(true);

  const s = styles(theme);

  if (!shop) return <SafeAreaView style={s.screen} edges={['top', 'bottom']} />;

  /*
    A rating needs a star value, a name and something email-shaped. The text is
    optional. Checking for "@" and a dot is not real validation, but real validation
    is the confirmation email itself: a wrong address simply never gets confirmed.
  */
  const emailLooksReal = email.includes('@') && email.split('@')[1]?.includes('.');
  const canSend = stars > 0 && name.trim().length > 0 && emailLooksReal;

  if (sent) {
    return (
      <SafeAreaView style={s.screen} edges={['top', 'bottom']}>
        <View style={s.doneWrap}>
          <View style={s.doneBadge}>
            <Text style={s.doneGlyph}>✓</Text>
          </View>
          <Text style={s.doneTitle}>Check your email</Text>
          <Text style={s.doneBody}>
            Your {stars.toFixed(1)}-star rating of {shop.name} is saved but hidden. It appears once you tap
            the link we sent to {email.trim()}.
          </Text>

          <View style={s.mockNote}>
            <Text style={s.mockNoteTitle}>This is a demonstration</Text>
            <Text style={s.mockNoteBody}>
              Nothing was stored and no email was sent. The screens and the rules are real; the
              server behind them arrives at build step 9.
            </Text>
          </View>

          <Pressable onPress={() => router.back()} style={s.doneBtn} accessibilityRole="button">
            <Text style={s.doneBtnLabel}>{t.backToList}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.screen} edges={['top', 'bottom']}>
      <BrandBar title={t.rateShop(shop.name)} close />

      <ScrollView
        contentContainerStyle={s.body}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={scrollEnabled}
      >
        <StarRating
          value={stars}
          onChange={setStars}
          onDragStart={() => setScrollEnabled(false)}
          onDragEnd={() => setScrollEnabled(true)}
        />

        <View style={s.field}>
          <Text style={s.label}>Add proof (optional)</Text>
          <View style={s.proofRow}>
            <Pressable
              onPress={() =>
                setProof((p) => [...p, { kind: 'photo', label: `Photo ${p.length + 1}` }])
              }
              style={s.proofBtn}
              accessibilityRole="button"
            >
              <Text style={s.proofBtnLabel}>+ Photo</Text>
            </Pressable>
            <Pressable
              onPress={() =>
                setProof((p) => [...p, { kind: 'video', label: `Video ${p.length + 1}` }])
              }
              style={s.proofBtn}
              accessibilityRole="button"
            >
              <Text style={s.proofBtnLabel}>+ Video</Text>
            </Pressable>
          </View>

          {proof.length > 0 && (
            <View style={s.chipRow}>
              {proof.map((item, i) => (
                <Pressable
                  key={`${item.label}-${i}`}
                  onPress={() => setProof((p) => p.filter((_, j) => j !== i))}
                  style={s.chip}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${item.label}`}
                >
                  <Text style={s.chipText}>{item.label}</Text>
                  <Text style={s.chipX}>✕</Text>
                </Pressable>
              ))}
            </View>
          )}

          <Text style={s.help}>
            Demonstration only. Picking a real file needs a native module that ships with the
            next build, so these are placeholders.
          </Text>
        </View>

        <View style={s.field}>
          <Text style={s.label}>{t.whatHappened}</Text>
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder={t.whatHappenedHint}
            placeholderTextColor={theme.ink3}
            style={[s.input, s.inputTall]}
            multiline
          />
        </View>

        <View style={s.field}>
          <Text style={s.label}>{t.yourName}</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            style={s.input}
            placeholderTextColor={theme.ink3}
            autoCapitalize="words"
          />
        </View>

        <View style={s.field}>
          <Text style={s.label}>{t.email}</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            style={s.input}
            placeholderTextColor={theme.ink3}
            /* Semantic type gives the rider the @ keyboard and stops autocapitalising. */
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={s.help}>{t.emailHelp}</Text>
        </View>

        <Pressable
          onPress={() => setSent(true)}
          disabled={!canSend}
          style={[s.submit, !canSend && s.submitOff]}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSend }}
        >
          <Text style={[s.submitLabel, !canSend && s.submitLabelOff]}>{t.send}</Text>
        </Pressable>

        {!canSend && (
          <Text style={s.help}>
            {stars === 0
              ? 'Pick a star rating to continue.'
              : !name.trim()
                ? 'Add your name to continue.'
                : 'Add an email address to continue.'}
          </Text>
        )}

        <View style={s.offline}>
          <Text style={s.offlineTitle}>{t.offlineTitle}</Text>
          <Text style={s.offlineBody}>{t.offlineBody}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = (theme: ReturnType<typeof useSettings>['theme']) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.bg },


    body: { padding: 18, gap: 17, paddingBottom: 40 },

    proofRow: { flexDirection: 'row', gap: 10 },
    proofBtn: {
      flex: 1,
      height: 48,
      borderRadius: 11,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: theme.line,
      alignItems: 'center',
      justifyContent: 'center',
    },
    proofBtnLabel: { fontSize: 15, fontWeight: '600', color: theme.ink2 },
    chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: theme.callFill,
    },
    chipText: { fontSize: 13, fontWeight: '600', color: theme.call },
    chipX: { fontSize: 13, color: theme.call },

    field: { gap: 7 },
    label: { fontSize: 14, fontWeight: '600', color: theme.ink2 },
    input: {
      minHeight: 52,
      borderRadius: 11,
      borderWidth: 1.5,
      borderColor: theme.line,
      paddingHorizontal: 14,
      fontSize: 15,
      color: theme.ink,
      backgroundColor: theme.surface,
    },
    inputTall: { minHeight: 84, paddingTop: 13, textAlignVertical: 'top' },
    help: { fontSize: 13, color: theme.ink3, lineHeight: 19 },

    submit: {
      height: 60,
      borderRadius: 13,
      backgroundColor: theme.call,
      alignItems: 'center',
      justifyContent: 'center',
    },
    /* Disabled is visibly different, not just unresponsive. */
    submitOff: { backgroundColor: theme.line },
    submitLabel: { fontSize: 18, fontWeight: '700', color: theme.onFilled },
    submitLabelOff: { color: theme.ink3 },

    offline: {
      backgroundColor: theme.alertFill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.alert,
      borderRadius: 11,
      padding: 14,
      gap: 5,
    },
    offlineTitle: { fontSize: 14, fontWeight: '700', color: theme.alert },
    offlineBody: { fontSize: 13.5, color: theme.ink, lineHeight: 20 },

    doneWrap: { flex: 1, padding: 24, gap: 16, alignItems: 'center', justifyContent: 'center' },
    doneBadge: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: theme.callFill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    doneGlyph: { fontSize: 36, color: theme.call, fontWeight: '700' },
    doneTitle: { fontSize: 24, fontWeight: '700', color: theme.ink },
    doneBody: { fontSize: 15, color: theme.ink2, textAlign: 'center', lineHeight: 22 },
    mockNote: {
      backgroundColor: theme.accentFill,
      borderRadius: 11,
      padding: 14,
      gap: 4,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.accent,
    },
    mockNoteTitle: { fontSize: 14, fontWeight: '700', color: theme.accent },
    mockNoteBody: { fontSize: 13.5, color: theme.ink, lineHeight: 20 },
    doneBtn: {
      height: 56,
      alignSelf: 'stretch',
      borderRadius: 13,
      borderWidth: 2,
      borderColor: theme.ink,
      alignItems: 'center',
      justifyContent: 'center',
    },
    doneBtnLabel: { fontSize: 17, fontWeight: '700', color: theme.ink },
  });
