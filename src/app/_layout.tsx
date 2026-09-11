import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';

import { SettingsProvider, useSettings } from '@/lib/settings/store';

/**
 * The shell every screen renders inside.
 *
 * Two jobs: hand the whole app its settings (theme, language, what the rider told us
 * on first run), and send a first-time rider to the welcome questions before they can
 * reach anything else.
 */

function RootNavigator() {
  const { settings, loading, theme } = useSettings();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    /*
      Wait for the saved settings to come off disk before deciding anything. Without
      this, a returning rider gets a flash of the welcome screen on every launch,
      because `onboarded` is false for the instant before storage answers.
    */
    if (loading) return;

    const onWelcome = segments[0] === 'welcome';

    if (!settings.onboarded && !onWelcome) {
      router.replace('/welcome');
    } else if (settings.onboarded && onWelcome) {
      router.replace('/');
    }
  }, [loading, settings.onboarded, segments, router]);

  /*
    A plain themed rectangle while storage is read. It is a few milliseconds, and it
    is the right colour, so it reads as the app starting rather than as a blank frame.
  */
  if (loading) {
    return <View style={{ flex: 1, backgroundColor: theme.bg }} />;
  }

  return (
    <>
      {/*
        The phone's own clock and battery row sits on top of our layout. Telling it
        which way to colour itself is the one thing we control, and getting it wrong
        gives dark icons on a dark bar.
      */}
      <StatusBar style={settings.theme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.bg },
          animation: 'slide_from_right',
        }}
      />
    </>
  );
}

export default function RootLayout() {
  return (
    <SettingsProvider>
      <RootNavigator />
    </SettingsProvider>
  );
}
