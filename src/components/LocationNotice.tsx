import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import type { LocationStatus } from '@/lib/location/useLocationGate';
import { useSettings } from '@/lib/settings/store';

/**
 * Tells the rider location is off, and never traps them.
 *
 * TWO LAYERS, ON PURPOSE.
 *
 *   The CARD appears once each time the app is opened with location off. It explains
 *   what they lose, offers to fix it, and dismisses. It is not a gate: "Not now" closes
 *   it and the app carries on working.
 *
 *   The BANNER stays after the card is dismissed, small and quiet at the top of the map.
 *   Without it, a rider who dismissed the card would have to relaunch the app to find
 *   the offer again, which is exactly the kind of dead end that makes people give up on
 *   a setting they actually wanted.
 *
 * WHY DISMISSING HAS TO WORK. A rider standing next to a broken motorcycle does not need
 * the map to have a working app: the shop list, the search, the phone numbers and the
 * last map they loaded are already on the phone. Holding any of that hostage over a
 * permission would be a lie about what the app needs, and people uninstall apps that lie
 * to them. Location makes the distances honest. It does not make the app function.
 */

function copyFor(status: LocationStatus, online: boolean) {
  const cached = online
    ? 'The map is showing the last area you loaded.'
    : 'You are offline, so the map is showing the last area you loaded.';

  switch (status) {
    case 'servicesOff':
      return {
        title: 'Location is off on this phone',
        body: `Ayos cannot tell how far each shop is from you, so distances are measured from the area you picked instead. ${cached}`,
        action: 'Open location settings',
      };
    case 'blocked':
      return {
        title: 'Ayos cannot use your location',
        body: `Permission was turned off for this app, and Android will not ask again from here. You can change it in the app settings. ${cached}`,
        action: 'Open app settings',
      };
    default:
      return {
        title: 'Turn on location?',
        body: `It is only used to work out how far each shop is from you. It stays on your phone and is never sent anywhere. ${cached}`,
        action: 'Turn on location',
      };
  }
}

export function LocationCard({
  status,
  online,
  onAct,
  onDismiss,
}: {
  status: LocationStatus;
  online: boolean;
  onAct: () => void;
  onDismiss: () => void;
}) {
  const { theme } = useSettings();
  const s = styles(theme);
  const copy = copyFor(status, online);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onDismiss}>
      {/*
        Tapping the scrim closes it, and so does the phone's back button through
        `onRequestClose`. Both matter: a card that can only be dismissed by finding the
        right button IS a gate, whatever the button says.
      */}
      <Pressable style={s.scrim} onPress={onDismiss} accessibilityLabel="Close">
        <Pressable style={s.card} onPress={() => {}}>
          <Text style={s.title}>{copy.title}</Text>
          <Text style={s.body}>{copy.body}</Text>

          <Pressable onPress={onAct} style={s.primary} accessibilityRole="button">
            <Text style={s.primaryText}>{copy.action}</Text>
          </Pressable>

          <Pressable onPress={onDismiss} style={s.secondary} accessibilityRole="button">
            <Text style={s.secondaryText}>Not now</Text>
          </Pressable>

          {/*
            Said plainly, because it is the thing that makes "Not now" a real choice
            rather than a trap the rider has to guess their way out of.
          */}
          <Text style={s.footnote}>
            Everything else works without it: the shop list, search and phone numbers are
            already saved on your phone.
          </Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/**
 * Offered when location works but the fix is poor.
 *
 * Android has a location MODE separate from the on/off switch. In battery-saving mode
 * the GPS chip is never consulted at all — position comes from WiFi and cell towers, and
 * lands the rider a block away. No amount of asking for high accuracy in code changes
 * that; only the rider can, through a system dialog. This is the button that raises it.
 */
export function AccuracyBanner({
  accuracyM,
  onPress,
}: {
  accuracyM: number;
  onPress: () => void;
}) {
  const { theme } = useSettings();
  const s = styles(theme);
  return (
    <Pressable
      onPress={onPress}
      style={s.banner}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={`Your position is accurate to about ${Math.round(accuracyM)} metres. Tap to improve it.`}
    >
      <View style={[s.dot, { backgroundColor: theme.star }]} />
      <Text style={s.bannerText} numberOfLines={1}>
        Rough fix · about {Math.round(accuracyM)} m out
      </Text>
      <Text style={s.bannerCta}>Improve</Text>
    </Pressable>
  );
}

/**
 * Shown while the first fix settles (lib/location/settle.ts). Spec 4A: a fix with no data
 * can take 20-60 s, and the app must show "finding your location" rather than an error.
 * Not pressable: there is nothing for the rider to do but wait, and the list, search and
 * numbers all work meanwhile.
 */
export function FindingBanner() {
  const { theme, t } = useSettings();
  const s = styles(theme);
  return (
    <View style={s.banner} accessibilityLiveRegion="polite">
      <ActivityIndicator size="small" color={theme.accent} />
      <Text style={s.bannerText} numberOfLines={1}>
        {t.findingLocation}
      </Text>
    </View>
  );
}

/** The quiet reminder that stays behind once the card is dismissed. */
export function LocationBanner({
  status,
  onPress,
}: {
  status: LocationStatus;
  onPress: () => void;
}) {
  const { theme } = useSettings();
  const s = styles(theme);
  const label = status === 'servicesOff' ? 'Location off' : 'Location not allowed';

  return (
    <Pressable
      onPress={onPress}
      style={s.banner}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={`${label}. Tap to turn it on.`}
    >
      <View style={s.dot} />
      <Text style={s.bannerText} numberOfLines={1}>
        {label} · distances are from your area
      </Text>
      <Text style={s.bannerCta}>Turn on</Text>
    </Pressable>
  );
}

const styles = (theme: ReturnType<typeof useSettings>['theme']) =>
  StyleSheet.create({
    scrim: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 26,
    },
    card: {
      width: '100%',
      maxWidth: 380,
      borderRadius: 18,
      backgroundColor: theme.surface,
      padding: 20,
      gap: 10,
    },
    title: { fontSize: 17, fontWeight: '800', color: theme.ink },
    body: { fontSize: 13.5, lineHeight: 20, color: theme.ink2 },

    primary: {
      marginTop: 6,
      backgroundColor: theme.accent,
      borderRadius: 12,
      paddingVertical: 13,
      alignItems: 'center',
    },
    primaryText: { color: theme.onFilled, fontSize: 14.5, fontWeight: '700' },

    secondary: { paddingVertical: 11, alignItems: 'center' },
    secondaryText: { color: theme.ink2, fontSize: 14, fontWeight: '600' },

    footnote: { fontSize: 11.5, lineHeight: 16, color: theme.ink3, textAlign: 'center' },

    banner: {
      position: 'absolute',
      left: 10,
      right: 62,
      top: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 11,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.line,
      elevation: 3,
      shadowColor: '#000',
      shadowOpacity: 0.14,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 1 },
    },
    dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: theme.alert },
    bannerText: { flex: 1, fontSize: 11.5, color: theme.ink2 },
    bannerCta: { fontSize: 11.5, fontWeight: '800', color: theme.accent },
  });
