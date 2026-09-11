import { useRouter } from 'expo-router';
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
 * Everything the welcome screen asked, changeable afterwards.
 *
 * This is what makes the first run safe to answer quickly: nothing chosen there is
 * permanent. Each change is written to disk as it is made, so there is no save
 * button and nothing to lose by backing out.
 */

export default function SettingsScreen() {
  const { settings, update, theme, t } = useSettings();
  const router = useRouter();
  const s = styles(theme);

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <Pressable onPress={() => router.back()} style={s.backRow} accessibilityRole="button">
        <Text style={s.backGlyph}>‹</Text>
        <Text style={s.backLabel}>{t.settings}</Text>
      </Pressable>

      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        <Group title={t.language}>
          {(Object.keys(LANGUAGE_LABELS) as Language[]).map((code) => (
            <Option
              key={code}
              label={LANGUAGE_LABELS[code]}
              selected={settings.language === code}
              onPress={() => update({ language: code })}
            />
          ))}
        </Group>

        <Group title={t.appearance}>
          {(['light', 'dark'] as ThemeName[]).map((name) => (
            <Option
              key={name}
              label={name === 'light' ? t.themeLight : t.themeDark}
              selected={settings.theme === name}
              onPress={() => update({ theme: name })}
            />
          ))}
        </Group>

        <Group title={t.area}>
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
          {(Object.keys(BIKE_LABELS) as BikeKind[]).map((bike) => (
            <Option
              key={bike}
              label={BIKE_LABELS[bike]}
              selected={settings.bike === bike}
              onPress={() => update({ bike })}
            />
          ))}
        </Group>

        <Group title={t.about}>
          <Text style={s.about}>{t.aboutBody}</Text>
        </Group>
      </ScrollView>
    </SafeAreaView>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  const { theme } = useSettings();
  const s = styles(theme);
  return (
    <View style={s.group}>
      <Text style={s.groupTitle}>{title}</Text>
      <View style={s.groupBody}>{children}</View>
    </View>
  );
}

function Option({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
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
      <Text style={[s.optionLabel, selected && s.optionLabelOn]}>{label}</Text>
      {/* Tick as well as colour: selection is never carried by colour alone. */}
      <Text style={[s.tick, selected && s.tickOn]}>{selected ? '✓' : ''}</Text>
    </Pressable>
  );
}

const styles = (theme: ReturnType<typeof useSettings>['theme']) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.bg },
    backRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.line,
    },
    backGlyph: { fontSize: 30, color: theme.ink, width: 30, textAlign: 'center', lineHeight: 34 },
    backLabel: { fontSize: 18, fontWeight: '700', color: theme.ink },

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
    optionLabel: { fontSize: 16, color: theme.ink, flexShrink: 1 },
    optionLabelOn: { fontWeight: '700', color: theme.call },
    tick: { fontSize: 18, color: 'transparent' },
    tickOn: { color: theme.call },

    about: { fontSize: 14, color: theme.ink2, lineHeight: 21, padding: 16 },
  });
