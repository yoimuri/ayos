import { useLocalSearchParams, useRouter } from 'expo-router';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { findShop, splitDistance } from '@/lib/dev/sample-shops';
import { useSettings } from '@/lib/settings/store';

/**
 * One shop.
 *
 * Content order is from spec 4.2 and is deliberate: contact sits above the photo,
 * because a rider with a broken bike needs to reach the shop before they need to
 * recognise the building.
 *
 * Contact is two buttons, not one. Call and Message. A rider in traffic, or standing
 * beside a running engine, often cannot hold a conversation but can send and read a
 * text. Anything that is not a phone number lives further down, under "other ways",
 * because those need data and the two buttons at the top do not.
 */

export default function ShopScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme, t } = useSettings();
  const router = useRouter();
  const shop = findShop(String(id));
  const s = styles(theme);

  if (!shop) {
    return (
      <SafeAreaView style={s.screen} edges={['top']}>
        <Pressable onPress={() => router.back()} style={s.backRow} accessibilityRole="button">
          <Text style={s.backGlyph}>‹</Text>
          <Text style={s.backLabel}>{t.backToList}</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const { value, unit } = splitDistance(shop.distance_m);
  const statusLabel =
    shop.status === 'open'
      ? shop.openUntil
        ? t.openUntil(shop.openUntil)
        : t.open
      : shop.status === 'closed'
        ? t.closed
        : t.unknown;

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <Pressable onPress={() => router.back()} style={s.backRow} accessibilityRole="button">
        <Text style={s.backGlyph}>‹</Text>
        <Text style={s.backLabel}>{t.backToList}</Text>
      </Pressable>

      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        <View style={s.headRow}>
          <View>
            <Text style={s.distValue}>{value}</Text>
            <Text style={s.distUnit}>{unit === 'km' ? t.km : t.metres}</Text>
          </View>
          <View style={s.headText}>
            <Text style={s.name}>{shop.name}</Text>
            <View style={s.pillWrap}>
              <View
                style={[
                  s.pill,
                  shop.status === 'open'
                    ? s.pillOpen
                    : shop.status === 'closed'
                      ? s.pillClosed
                      : s.pillUnknown,
                ]}
              >
                <Text
                  style={[
                    s.pillText,
                    shop.status === 'open'
                      ? s.pillOpenText
                      : shop.status === 'closed'
                        ? s.pillClosedText
                        : s.pillUnknownText,
                  ]}
                >
                  {statusLabel}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {shop.phone ? (
          <View style={s.actions}>
            <Pressable
              onPress={() => Linking.openURL(`tel:${shop.phone}`)}
              style={[s.btn, s.btnCall]}
              accessibilityRole="button"
            >
              <Text style={s.btnCallLabel}>{t.call}</Text>
            </Pressable>
            {/*
              `sms:` is handled by the phone's own messaging app through Linking, so
              this needs no extra native package and works with no data connection.
            */}
            <Pressable
              onPress={() => Linking.openURL(`sms:${shop.phone}`)}
              style={[s.btn, s.btnMessage]}
              accessibilityRole="button"
            >
              <Text style={s.btnMessageLabel}>{t.message}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={s.noNumber}>
            <Text style={s.noNumberText}>{t.noNumber}</Text>
          </View>
        )}

        <Pressable
          onPress={() =>
            Linking.openURL(`geo:0,0?q=${encodeURIComponent(`${shop.name}, ${shop.address}`)}`)
          }
          style={[s.btn, s.btnDirections]}
          accessibilityRole="button"
        >
          <Text style={s.btnDirectionsLabel}>{t.directions}</Text>
        </Pressable>

        <View style={s.photo}>
          <Text style={s.photoNote}>FACADE PHOTO · TEAM CAPTURED</Text>
        </View>

        <View style={s.tagRow}>
          {shop.tags.map((tag) => (
            <View key={tag} style={s.tag}>
              <Text style={s.tagText}>{tag}</Text>
            </View>
          ))}
        </View>

        <View style={s.kv}>
          <Text style={s.kvKey}>{t.phone}</Text>
          <Text style={s.kvValue}>{shop.phone ?? t.noNumber}</Text>
        </View>

        {shop.socials.length > 0 && (
          <View style={s.block}>
            <Text style={s.blockTitle}>{t.otherContacts}</Text>
            {shop.socials.map((contact) => (
              /*
                The ROW is not pressable. Only the handle is.

                A whole-row target here is worse than it looks: the row is mostly empty
                space, so a rider scrolling with a thumb opens a browser by accident.
                Call and Directions above are different — those are deliberate targets a
                rider aims at. This is a reference, so the tappable area is the link.
              */
              <View key={contact.url} style={s.socialRow}>
                <Text style={s.socialLabel}>{contact.label}</Text>
                <Pressable
                  onPress={() => Linking.openURL(contact.url)}
                  hitSlop={10}
                  accessibilityRole="link"
                  accessibilityLabel={`${contact.label}: ${contact.handle}`}
                >
                  <Text style={s.socialHandle} numberOfLines={1}>
                    {contact.handle}
                  </Text>
                </Pressable>
              </View>
            ))}
            {/*
              Honest about the data. These URLs point at example.invalid, a domain
              reserved by RFC 2606 that never resolves, so tapping opens a browser that
              fails. Real links arrive with real shop records.
            */}
            <Text style={s.help}>Placeholder links. Real pages come with real shop data.</Text>
          </View>
        )}

        {/*
          The count always shows; the average is withheld below five ratings and the
          screen says why. Two five-star reviews from friends should not be able to
          make a shop look established.
        */}
        <View style={s.block}>
          <Text style={s.blockTitle}>{t.ratingCount(shop.ratingCount)}</Text>
          {shop.ratingCount < 5 && <Text style={s.help}>{t.averageHidden}</Text>}
        </View>

        {shop.ratings.map((rating) => (
          <View key={rating.who} style={s.review}>
            <View style={s.reviewHead}>
              <Text style={s.reviewWho}>{rating.who}</Text>
              <Text style={s.reviewStars}>{rating.stars} / 5</Text>
            </View>
            <Text style={s.reviewBody}>{rating.body}</Text>
          </View>
        ))}

        <Pressable
          /*
            Object form, not a template string. A dynamic route is named by its file
            pattern and the value is passed as a param, which is type-safe regardless
            of what the generated route types happen to infer.
          */
          onPress={() => router.push({ pathname: '/rate/[id]', params: { id: shop.id } })}
          style={s.rateCta}
          accessibilityRole="button"
        >
          <Text style={s.rateCtaText}>{t.rateThisShop}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
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
    backLabel: { fontSize: 16, fontWeight: '600', color: theme.ink },

    body: { padding: 18, gap: 15, paddingBottom: 40 },

    headRow: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
    distValue: {
      fontSize: 38,
      fontWeight: '700',
      color: theme.ink,
      letterSpacing: -1.3,
      fontVariant: ['tabular-nums'],
      lineHeight: 40,
    },
    distUnit: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, color: theme.ink3 },
    headText: { flex: 1, gap: 7 },
    name: { fontSize: 23, fontWeight: '700', color: theme.ink, letterSpacing: -0.5, lineHeight: 27 },
    pillWrap: { flexDirection: 'row' },

    pill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 6 },
    pillText: { fontSize: 13, fontWeight: '700' },
    pillOpen: { backgroundColor: theme.callFill },
    pillOpenText: { color: theme.call },
    pillClosed: { backgroundColor: theme.alertFill },
    pillClosedText: { color: theme.alert },
    pillUnknown: { backgroundColor: theme.mapBg },
    pillUnknownText: { color: theme.ink2 },

    actions: { flexDirection: 'row', gap: 12 },
    btn: { height: 62, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
    btnCall: { flex: 1, backgroundColor: theme.call },
    btnCallLabel: { fontSize: 18, fontWeight: '700', color: theme.onFilled },
    btnMessage: { flex: 1, backgroundColor: theme.callFill, borderWidth: 2, borderColor: theme.call },
    btnMessageLabel: { fontSize: 18, fontWeight: '700', color: theme.call },
    btnDirections: { borderWidth: 2, borderColor: theme.ink, backgroundColor: theme.surface },
    btnDirectionsLabel: { fontSize: 18, fontWeight: '700', color: theme.ink },

    noNumber: {
      height: 62,
      borderRadius: 13,
      borderWidth: 2,
      borderStyle: 'dashed',
      borderColor: theme.line,
      alignItems: 'center',
      justifyContent: 'center',
    },
    noNumberText: { fontSize: 15, color: theme.ink3, fontStyle: 'italic' },

    photo: {
      height: 150,
      borderRadius: 12,
      backgroundColor: theme.mapBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.line,
      alignItems: 'center',
      justifyContent: 'center',
    },
    photoNote: { fontSize: 11, letterSpacing: 1, color: theme.ink3 },

    tagRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    tag: {
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: theme.mapBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.line,
    },
    tagText: { fontSize: 13, color: theme.ink2 },

    kv: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      paddingVertical: 11,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: theme.lineSoft,
    },
    kvKey: { fontSize: 14, color: theme.ink3 },
    kvValue: { fontSize: 16, fontWeight: '700', color: theme.ink, fontVariant: ['tabular-nums'] },

    block: { gap: 4 },
    blockTitle: { fontSize: 17, fontWeight: '700', color: theme.ink },
    help: { fontSize: 13, color: theme.ink3, lineHeight: 19 },

    socialRow: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.lineSoft,
    },
    /* Plain text. Not a target. */
    socialLabel: { fontSize: 15, color: theme.ink2 },
    /* The only tappable thing in the row, and it looks like it. */
    socialHandle: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.call,
      textDecorationLine: 'underline',
      flexShrink: 1,
    },

    review: {
      gap: 3,
      paddingTop: 11,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.lineSoft,
    },
    reviewHead: { flexDirection: 'row', alignItems: 'baseline', gap: 9 },
    reviewWho: { fontSize: 14, fontWeight: '700', color: theme.ink },
    reviewStars: { fontSize: 13, fontWeight: '700', color: theme.accent },
    reviewBody: { fontSize: 14, color: theme.ink2, lineHeight: 20 },

    rateCta: {
      height: 54,
      borderRadius: 12,
      borderWidth: 2,
      borderStyle: 'dashed',
      borderColor: theme.line,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 4,
    },
    rateCtaText: { fontSize: 15, fontWeight: '600', color: theme.ink2 },
  });
