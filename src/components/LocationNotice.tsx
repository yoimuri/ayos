import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Strings } from '@/lib/i18n/strings';
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

function copyFor(status: LocationStatus, online: boolean, t: Strings) {
  const cached = online ? t.mapCached : t.mapCachedOffline;

  switch (status) {
    case 'servicesOff':
      return { title: t.locOffTitle, body: `${t.locOffBody} ${cached}`, action: t.locOffAction };
    case 'blocked':
      return { title: t.locBlockedTitle, body: `${t.locBlockedBody} ${cached}`, action: t.locBlockedAction };
    default:
      return { title: t.locAskTitle, body: `${t.locAskBody} ${cached}`, action: t.locAskAction };
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
  const { theme, t } = useSettings();
  const s = styles(theme);
  const copy = copyFor(status, online, t);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onDismiss}>
      {/*
        Tapping the scrim closes it, and so does the phone's back button through
        `onRequestClose`. Both matter: a card that can only be dismissed by finding the
        right button IS a gate, whatever the button says.
      */}
      <Pressable style={s.scrim} onPress={onDismiss} accessibilityLabel={t.dismiss}>
        <Pressable style={s.card} onPress={() => {}}>
          <Text style={s.title}>{copy.title}</Text>
          <Text style={s.body}>{copy.body}</Text>

          <Pressable onPress={onAct} style={s.primary} accessibilityRole="button">
            <Text style={s.primaryText}>{copy.action}</Text>
          </Pressable>

          <Pressable onPress={onDismiss} style={s.secondary} accessibilityRole="button">
            <Text style={s.secondaryText}>{t.notNow}</Text>
          </Pressable>

          {/*
            Said plainly, because it is the thing that makes "Not now" a real choice
            rather than a trap the rider has to guess their way out of.
          */}
          <Text style={s.footnote}>{t.locWorksWithout}</Text>
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
  const { theme, t } = useSettings();
  const s = styles(theme);
  return (
    <Pressable
      onPress={onPress}
      style={s.banner}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={t.roughFixSpoken(Math.round(accuracyM))}
    >
      <View style={[s.dot, { backgroundColor: theme.star }]} />
      <Text style={s.bannerText} numberOfLines={1}>
        {t.roughFix(Math.round(accuracyM))}
      </Text>
      <Text style={s.bannerCta}>{t.improve}</Text>
    </Pressable>
  );
}

/**
 * Shown while the first fix settles (lib/location/settle.ts). Spec 4A: a fix with no data
 * can take 20-60 s, and the app must show "finding your location" rather than an error.
 * Not pressable: there is nothing for the rider to do but wait, and the list, search and
 * numbers all work meanwhile.
 */
/**
 * Location is on and allowed, the search has had its 15 s, and there is still no LIVE
 * reading (nothing at all, or only the faded "last known" spot). Before this banner the
 * app said nothing in this state, and riders concluded it was broken on their phone.
 * "Improve" offers Android's network-assisted location, which gets a fix indoors where the
 * GPS alone cannot; it is an offer, not a requirement.
 */
export function NoFixBanner({ onPress }: { onPress: () => void }) {
  const { theme, t } = useSettings();
  const s = styles(theme);
  return (
    <Pressable
      onPress={onPress}
      style={s.banner}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={`${t.noFixYet}. ${t.tapToImprove}`}
    >
      <View style={[s.dot, { backgroundColor: theme.star }]} />
      <Text style={s.bannerText} numberOfLines={1}>
        {t.noFixYet}
      </Text>
      <Text style={s.bannerCta}>{t.improve}</Text>
    </Pressable>
  );
}

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

/**
 * Shown when the rider allowed only APPROXIMATE location. Android then reports a spot
 * anywhere within about 3 km², which makes every distance in the app wrong. The fix is
 * one switch in this app's settings ("Use precise location"), so the banner opens them.
 */
export function PreciseBanner({ onPress }: { onPress: () => void }) {
  const { theme, t } = useSettings();
  const s = styles(theme);
  return (
    <Pressable
      onPress={onPress}
      style={s.banner}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={t.approxLocationSpoken}
    >
      <View style={s.dot} />
      <Text style={s.bannerText} numberOfLines={1}>
        {t.approxLocation}
      </Text>
      <Text style={s.bannerCta}>{t.fix}</Text>
    </Pressable>
  );
}

/**
 * The column every banner on the map sits in. Each banner used to pin itself to the same
 * spot, which was fine while at most one showed; the update banner can appear alongside a
 * location one, so they stack instead.
 */
export function NoticeStack({ children }: { children: React.ReactNode }) {
  const { theme } = useSettings();
  const s = styles(theme);
  return (
    <View style={s.stack} pointerEvents="box-none">
      {children}
    </View>
  );
}

/**
 * An update has downloaded in the background (lib/updates.ts). Lives with the location
 * banners because it is the same kind of quiet notice, in the same place. Tapping asks
 * before restarting; "Later" hides it until the app next opens.
 */
export function UpdateBanner({ onPress }: { onPress: () => void }) {
  const { theme, t } = useSettings();
  const s = styles(theme);
  return (
    <Pressable onPress={onPress} style={s.banner} hitSlop={6} accessibilityRole="button" accessibilityLabel={t.updateReady}>
      <View style={[s.dot, { backgroundColor: theme.open }]} />
      <Text style={s.bannerText} numberOfLines={1}>
        {t.updateReady}
      </Text>
      <Text style={s.bannerCta}>{t.restart}</Text>
    </Pressable>
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
  const { theme, t } = useSettings();
  const s = styles(theme);
  const label = status === 'servicesOff' ? t.locationOff : t.locationNotAllowed;

  return (
    <Pressable
      onPress={onPress}
      style={s.banner}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${t.tapToTurnOn}`}
    >
      <View style={s.dot} />
      <Text style={s.bannerText} numberOfLines={1}>
        {label} · {t.distancesFromArea}
      </Text>
      <Text style={s.bannerCta}>{t.turnOn}</Text>
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

    /* Clear of the map buttons on the right. Banners stack down from here, never overlap. */
    stack: { position: 'absolute', left: 10, right: 62, top: 12, gap: 6 },
    banner: {
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
