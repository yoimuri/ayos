import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandBar } from '@/components/BrandBar';
import { formatKm, parseReading, reading } from '@/lib/odometer/model';
import { useOdometer } from '@/lib/odometer/store';
import { useSettings } from '@/lib/settings/store';
import type { Theme } from '@/lib/theme/tokens';

/**
 * Odometer: Start ride / End ride, and the bike's reading typed by hand. Settings > Map and
 * riding is the way in; while a ride runs, a small chip on the map comes back here. The counting
 * itself is lib/odometer.
 */
export default function OdometerScreen() {
  const { theme, t } = useSettings();
  const { data, start, end, type } = useOdometer();
  const [text, setText] = useState('');
  const s = styles(theme);
  const now = reading(data);
  const typed = parseReading(text);
  const riding = data.ride !== null;

  return (
    <SafeAreaView style={s.screen} edges={['top', 'bottom']}>
      <BrandBar title={t.odometer} />
      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        <View style={s.numbers}>
          <Text style={s.label}>{(riding ? t.thisRide : t.lastRide).toUpperCase()}</Text>
          <Text style={s.big}>
            {riding ? formatKm(data.ride?.km ?? 0) : data.lastRideKm !== null ? formatKm(data.lastRideKm) : '-'}
            <Text style={s.unit}> {t.km.toLowerCase()}</Text>
          </Text>
          {now !== null && (
            <>
              <Text style={s.label}>{t.odometer.toUpperCase()}</Text>
              <Text style={s.medium}>
                {formatKm(now, 0)} <Text style={s.unit}>{t.km.toLowerCase()}</Text>
              </Text>
            </>
          )}
        </View>

        <Pressable
          onPress={riding ? end : start}
          style={({ pressed }) => [s.main, riding && s.mainEnd, pressed && s.pressed]}
          accessibilityRole="button"
        >
          <Text style={s.mainText}>{riding ? t.endRide : t.startRide}</Text>
        </Pressable>
        <Text style={s.note}>{t.countsWhileOpen}</Text>

        <Text style={s.label}>{t.odometerReading.toUpperCase()}</Text>
        <View style={s.typeRow}>
          <TextInput
            value={text}
            onChangeText={setText}
            keyboardType="decimal-pad"
            placeholder={t.km.toLowerCase()}
            placeholderTextColor={theme.ink3}
            style={s.input}
            accessibilityLabel={t.odometerReading}
          />
          <Pressable
            onPress={() => {
              if (typed === null) return;
              type(typed);
              setText('');
            }}
            disabled={typed === null}
            style={({ pressed }) => [s.save, typed === null && s.saveOff, pressed && s.pressed]}
            accessibilityRole="button"
            accessibilityState={{ disabled: typed === null }}
          >
            <Text style={s.saveText}>{t.rideSave}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.bg },
    body: { padding: 16, gap: 12 },
    numbers: { gap: 4, paddingVertical: 8 },
    label: { fontSize: 11.5, fontWeight: '700', letterSpacing: 1, color: theme.ink3, marginTop: 8 },
    big: { fontSize: 44, fontWeight: '800', color: theme.ink, fontVariant: ['tabular-nums'] },
    medium: { fontSize: 26, fontWeight: '700', color: theme.ink, fontVariant: ['tabular-nums'] },
    unit: { fontSize: 16, fontWeight: '600', color: theme.ink3 },
    main: { height: 56, borderRadius: 14, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center' },
    mainEnd: { backgroundColor: theme.ink },
    mainText: { color: theme.onFilled, fontSize: 17, fontWeight: '800' },
    note: { fontSize: 13, color: theme.ink3 },
    typeRow: { flexDirection: 'row', gap: 8 },
    input: {
      flex: 1,
      height: 50,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: theme.line,
      backgroundColor: theme.surface,
      paddingHorizontal: 14,
      fontSize: 16,
      color: theme.ink,
    },
    save: { height: 50, paddingHorizontal: 22, borderRadius: 12, backgroundColor: theme.ink, alignItems: 'center', justifyContent: 'center' },
    saveOff: { opacity: 0.4 },
    saveText: { color: theme.bg, fontSize: 15, fontWeight: '700' },
    pressed: { opacity: 0.8 },
  });
