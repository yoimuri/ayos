import { useLocalSearchParams, useRouter } from 'expo-router';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ReviewList } from '@/components/ReviewList';
import { BrandBar } from '@/components/BrandBar';
import { ChatIcon, NavIcon, PhoneIcon } from '@/components/icons';
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
      <SafeAreaView style={s.screen} edges={['top', 'bottom']}>
        <BrandBar title={t.backToList} />
      </SafeAreaView>
    );
  }

  const { value } = splitDistance(shop.distance_m);
  const statusLabel =
    shop.status === 'open'
      ? shop.openUntil
        ? t.openUntil(shop.openUntil)
        : t.open
      : shop.status === 'closed'
        ? t.closed
        : t.unknown;

  return (
    <SafeAreaView style={s.screen} edges={['top', 'bottom']}>
      <BrandBar title={t.backToList} />

      <ScrollView
        contentContainerStyle={s.body}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.headRow}>
          <View>
            <View style={s.distRow}>
              <Text style={s.distApprox}>≈</Text>
              <Text style={s.distValue}>{value}</Text>
            </View>
            <Text style={s.distUnit}>{t.km}</Text>
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

        {/*
          Circular icon buttons with the label beneath, centred. A circle with a word
          under it reads as one control; a box with text inside reads as a slab, and
          three slabs took a third of the screen to say what three circles say.

          Only Call is filled, so the primary action is obvious without any of them
          shouting.

          WHEN THERE IS NO NUMBER the contact buttons are not rendered at all. A
          disabled button still looks like a control: a rider taps it, nothing happens,
          and they conclude the app is broken. An absence with an explanation beats a
          greyed-out promise.
        */}
        <View style={s.actions}>
          {shop.phone ? (
            <>
              <Pressable
                onPress={() => Linking.openURL(`tel:${shop.phone}`)}
                style={s.actWrap}
                accessibilityRole="button"
                accessibilityLabel={t.call}
              >
                <View style={[s.actCircle, s.actFilled]}>
                  {/* Plain handset here: this button only calls. The unified
                      phone-and-envelope mark belongs on the list row, where one tap
                      offers both. */}
                  <PhoneIcon size={23} color={theme.onFilled} />
                </View>
                <Text style={s.actLabel}>{t.call}</Text>
              </Pressable>

              <Pressable
                onPress={() => Linking.openURL(`sms:${shop.phone}`)}
                style={s.actWrap}
                accessibilityRole="button"
                accessibilityLabel={t.message}
              >
                <View style={[s.actCircle, s.actOutline]}>
                  <ChatIcon size={23} color={theme.ink} />
                </View>
                <Text style={s.actLabel}>{t.message}</Text>
              </Pressable>
            </>
          ) : null}

          <Pressable
            onPress={() =>
              Linking.openURL(`geo:0,0?q=${encodeURIComponent(`${shop.name}, ${shop.address}`)}`)
            }
            style={s.actWrap}
            accessibilityRole="button"
            accessibilityLabel={t.directions}
          >
            <View style={[s.actCircle, s.actOutline]}>
              <NavIcon size={23} color={theme.ink} />
            </View>
            <Text style={s.actLabel}>{t.directions}</Text>
          </Pressable>
        </View>

        {!shop.phone && (
          <View style={s.noticeBox}>
            <Text style={s.noticeTitle}>No phone number yet</Text>
            <Text style={s.noticeBody}>
              We have not collected one for this shop. You can still get directions, and the
              address below is correct as of the visit.
            </Text>
          </View>
        )}

        <View style={s.photo}>
          <Text style={s.photoNote}>FACADE PHOTO · TEAM CAPTURED</Text>
        </View>

        {/* What the shop actually does, in plain words, before the tag shorthand. */}
        <Text style={s.about}>{shop.about}</Text>

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

        <ReviewList reviews={shop.ratings} />

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
    distRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
    distApprox: { fontSize: 22, fontWeight: '600', color: theme.ink3 },
    distUnit: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, color: theme.ink3 },
    headText: { flex: 1, gap: 7 },
    name: { fontSize: 23, fontWeight: '700', color: theme.ink, letterSpacing: -0.5, lineHeight: 27 },
    pillWrap: { flexDirection: 'row' },

    pill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 6 },
    pillText: { fontSize: 13, fontWeight: '700' },
    pillOpen: { backgroundColor: theme.openFill },
    pillOpenText: { color: theme.open },
    pillClosed: { backgroundColor: theme.lineSoft },
    pillClosedText: { color: theme.ink3 },
    pillUnknown: { backgroundColor: theme.mapBg },
    pillUnknownText: { color: theme.ink2 },

    actions: { flexDirection: 'row', gap: 22, justifyContent: 'center' },
    actWrap: { alignItems: 'center', gap: 7, width: 74 },
    actCircle: {
      width: 54,
      height: 54,
      borderRadius: 27,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actFilled: { backgroundColor: theme.call },
    actOutline: { borderWidth: 1.5, borderColor: theme.line, backgroundColor: theme.surface },
    actLabel: { fontSize: 12, fontWeight: '600', color: theme.ink2 },
    noticeBox: {
      backgroundColor: theme.accentFill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.accent,
      borderRadius: 12,
      padding: 16,
      gap: 6,
    },
    noticeTitle: { fontSize: 15, fontWeight: '700', color: theme.accent },
    noticeBody: { fontSize: 14, color: theme.ink2, lineHeight: 20 },


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

    about: { fontSize: 15, color: theme.ink2, lineHeight: 22 },
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
