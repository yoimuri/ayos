import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useSettings } from '@/lib/settings/store';
import { WORDMARK } from '@/lib/theme/fonts';

/**
 * The brand band at the top of every screen.
 *
 * This is the single biggest thing separating Ayos from a generic directory app. Grab,
 * Lalamove and JoyRide all do the same thing: the brand colour OWNS a surface at the
 * top and the wordmark lives inside it. Sprinkling the colour on small accents, which
 * is what the app did before, reads as no brand at all.
 *
 * It changes shape between themes rather than just changing shade. In light the band is
 * oxide with white type. In dark the band is a dark surface and the WORDMARK carries
 * the oxide instead, because a bright band on a dark app glares. Both come from
 * `theme.bandBg` and `theme.bandInk`, so neither screen file knows the difference.
 */

export function Wordmark({ size = 19 }: { size?: number }) {
  const { theme, t } = useSettings();
  return (
    <Text
      style={{
        fontSize: size,
        /*
          The weight and width are baked into the file itself (Archivo at wdth 115,
          wght 560), so no fontWeight is set here. Setting one would make Android
          synthesise a fake bold on top of a face that is already the right weight.
        */
        fontFamily: WORDMARK,
        letterSpacing: -0.3,
        color: theme.bandInk,
      }}
    >
      {t.appName}
    </Text>
  );
}

/**
 * The compact band: a back control, a title, and the wordmark as a home button.
 * Used on every screen that is not home.
 */
export function BrandBar({ title, close }: { title: string; close?: boolean }) {
  const { theme, t } = useSettings();
  const router = useRouter();
  const s = styles(theme);

  return (
    <View style={s.bar}>
      <Pressable
        onPress={() => router.back()}
        style={s.circleBtn}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t.backToList}
      >
        <Text style={close ? s.closeGlyph : s.backGlyph}>{close ? '✕' : '‹'}</Text>
      </Pressable>

      <Text style={s.title} numberOfLines={1}>
        {title}
      </Text>

      {/*
        `dismissTo` unwinds the stack back to the list rather than pushing another copy
        of it on top, so the Android back button still behaves afterwards.
      */}
      <Pressable
        onPress={() => router.dismissTo('/')}
        hitSlop={10}
        style={s.brandBtn}
        accessibilityRole="button"
        accessibilityLabel="Ayos, back to the shop list"
      >
        <Wordmark />
      </Pressable>
    </View>
  );
}

/** The tall band on home, holding whatever controls the screen needs. */
export function BrandHeader({ children }: { children: ReactNode }) {
  const { theme } = useSettings();
  const s = styles(theme);
  return <View style={s.header}>{children}</View>;
}

const styles = (theme: ReturnType<typeof useSettings>['theme']) =>
  StyleSheet.create({
    bar: {
      backgroundColor: theme.bandBg,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      /*
        A hairline edge only matters in dark, where the band and the page beneath it are
        both dark surfaces and would otherwise merge. In light it is invisible against
        the oxide, so one rule covers both.
      */
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.line,
    },
    header: {
      backgroundColor: theme.bandBg,
      paddingHorizontal: 18,
      paddingTop: 8,
      paddingBottom: 14,
      gap: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.line,
    },
    circleBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.bandChip,
      alignItems: 'center',
      justifyContent: 'center',
    },
    backGlyph: { fontSize: 26, lineHeight: 30, color: theme.bandInk },
    closeGlyph: { fontSize: 17, lineHeight: 20, color: theme.bandInk },
    title: { flex: 1, fontSize: 16, fontWeight: '700', color: theme.bandInk },
    brandBtn: { paddingHorizontal: 6, paddingVertical: 6 },
  });
