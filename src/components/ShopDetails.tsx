import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ContactCard } from '@/components/ContactCard';
import { ReviewList } from '@/components/ReviewList';
import { ChatIcon, NavIcon, PhoneIcon } from '@/components/icons';
import { useTourTarget } from '@/components/Tour';
import { clockLabel, isAllDay, type Hours } from '@/lib/data/hours';
import type { Shop } from '@/lib/data/types';
import { splitDistance } from '@/lib/geo/distance';
import type { Strings } from '@/lib/i18n/strings';
import { MIN_RATINGS_FOR_AVERAGE } from '@/lib/ratings/rules';
import { useSettings } from '@/lib/settings/store';

/**
 * One shop, shown INSIDE the bottom panel rather than on a page of its own.
 *
 * Opening a shop swaps the list for these details in the same panel, and the map above frames the shop and the rider
 * together. The rider never
 * loses the map, so "how far, and which way" is answered while they read.
 *
 * Two parts, because the panel treats its header as the drag handle: the HEADER (back,
 * name, distance, status) drags the panel; the BODY scrolls.
 *
 * Contact sits above the photo, because a rider with a
 * broken bike needs to reach the shop before they need to recognise the building.
 */

function hoursLine(h: Hours | undefined, t: Strings): string | null {
  if (!h) return null;
  const parts: string[] = [];
  if (isAllDay(h)) parts.push(t.openAllDay);
  else if (h.open && h.close) parts.push(`${clockLabel(h.open)} – ${clockLabel(h.close)}`);
  if (h.closed && h.closed.length > 0) {
    parts.push(t.closedOn(h.closed.map((d) => t.dayNames[d]).join(', ')));
  }
  return parts.length ? parts.join(' · ') : null;
}

export function ShopDetailsHeader({ shop, onBack }: { shop: Shop; onBack: () => void }) {
  const { theme, t } = useSettings();
  const s = styles(theme);
  const backRef = useTourTarget('details-back');
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
    <View style={s.head}>
      {/*
        Big and worded, not a bare arrow. The riders this is built for include people
        who do not read an arrow as "back"; a 48dp target that says where it goes is
        unmissable. The phone's own back button does the same thing (see app/index.tsx).
      */}
      <Pressable
        ref={backRef}
        onPress={onBack}
        style={s.back}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={t.backToList}
      >
        <Text style={s.backText}>‹ {t.backToList}</Text>
      </Pressable>

      <View style={s.headRow}>
        <View>
          {/* The approximation mark belongs ON the number: this is a road estimate. */}
          <View style={s.distRow}>
            <Text style={s.distApprox}>≈</Text>
            <Text style={s.distValue}>{value}</Text>
          </View>
          <Text style={s.distUnit}>{t.km}</Text>
        </View>
        <View style={s.headText}>
          <Text style={s.name} numberOfLines={2}>
            {shop.name}
          </Text>
          <View style={s.pillWrap}>
            <View
              style={[
                s.pill,
                shop.status === 'open' ? s.pillOpen : shop.status === 'closed' ? s.pillClosed : s.pillUnknown,
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
    </View>
  );
}

export function ShopDetailsBody({ shop, onRate }: { shop: Shop; onRate: () => void }) {
  const { theme, t } = useSettings();
  const s = styles(theme);
  const actionsRef = useTourTarget('details-actions');
  /*
    ONE NUMBER: Call and Message go straight to the phone's dialler or messages, which is
    its own confirmation (contact is never more than one tap away). SEVERAL
    NUMBERS: the card opens so the rider can see and choose which one.
  */
  const [choosing, setChoosing] = useState(false);
  const reach = (scheme: 'tel' | 'sms') =>
    shop.phones.length > 1 ? setChoosing(true) : Linking.openURL(`${scheme}:${shop.phone}`);
  const hours = hoursLine(shop.hours, t);
  const showAverage = shop.ratingAvg != null && shop.ratingCount >= MIN_RATINGS_FOR_AVERAGE;

  return (
    <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
      {/*
        Circles with the word beneath. Only Call is filled, so the primary action is
        obvious. With no number the contact buttons are not drawn at all: a disabled
        button still looks like a control, and a rider who taps it and gets nothing
        concludes the app is broken.
      */}
      <View ref={actionsRef} style={s.actions}>
        {shop.phone ? (
          <>
            <Pressable
              onPress={() => reach('tel')}
              style={({ pressed }) => [s.actWrap, pressed && s.pressed]}
              accessibilityRole="button"
              accessibilityLabel={t.call}
            >
              <View style={[s.actCircle, s.actFilled]}>
                <PhoneIcon size={23} color={theme.onFilled} />
              </View>
              <Text style={s.actLabel}>{t.call}</Text>
            </Pressable>

            <Pressable
              onPress={() => reach('sms')}
              style={({ pressed }) => [s.actWrap, pressed && s.pressed]}
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
            address below is the one recorded on the visit.
          </Text>
        </View>
      )}

      {/*
        NO PHOTO YET, SAID PLAINLY. This box used to read "FACADE PHOTO · TEAM CAPTURED"
        over nothing, which claimed a photo existed and where it came from. Photos come
        only from the team or with the shop's permission ; none have been
        taken, so the box says so.
      */}
      <View style={s.photo}>
        <Text style={s.photoNote}>{t.noPhotoYet}</Text>
      </View>

      {shop.tags.length > 0 && (
        <View style={s.tagRow}>
          {shop.tags.map((tag) => (
            <View key={tag} style={s.tag}>
              <Text style={s.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
      )}

      {shop.address ? <Row label={t.address} value={shop.address} /> : null}
      {hours ? <Row label={t.hours} value={hours} /> : null}

      {/*
        EVERY NUMBER, each one tappable. Ninety-nine shops gave more than one, and the
        second is often the one that answers. The Call button above dials the first.
      */}
      {shop.phones.length > 0 ? (
        shop.phones.map((phone) => (
          <Pressable
            key={phone}
            onPress={() => Linking.openURL(`tel:${phone}`)}
            accessibilityRole="button"
            accessibilityLabel={`${t.call} ${phone}`}
          >
            <Row label={t.phone} value={phone} emphasis />
          </Pressable>
        ))
      ) : (
        <Row label={t.phone} value={t.noNumber} />
      )}

      {shop.links.length > 0 && (
        <View style={s.block}>
          <Text style={s.blockTitle}>{t.otherContacts}</Text>
          {shop.links.map((link) => (
            /*
              Only the link is pressable, not the row: the row is mostly empty space, and a
              thumb scrolling past would open a browser by accident.
            */
            <View key={link.url} style={s.socialRow}>
              <Text style={s.socialLabel}>{link.label}</Text>
              <Pressable
                onPress={() => Linking.openURL(link.url)}
                hitSlop={10}
                accessibilityRole="link"
                accessibilityLabel={`${link.label}: ${shop.name}`}
              >
                <Text style={s.socialHandle} numberOfLines={1}>
                  Open
                </Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {/*
        The count always shows; the average is withheld below the threshold and the panel
        says why. Two five-star ratings from friends should not make a shop look established.
      */}
      <View style={s.block}>
        <Text style={s.blockTitle}>
          {shop.ratingCount === 0 ? t.noRatingsYet : t.ratingCount(shop.ratingCount)}
          {showAverage ? ` · ${shop.ratingAvg!.toFixed(1)} ★` : ''}
        </Text>
        {!showAverage && <Text style={s.help}>{t.averageHidden(MIN_RATINGS_FOR_AVERAGE)}</Text>}
      </View>

      <ReviewList reviews={shop.ratings} />

      <Pressable onPress={onRate} style={s.rateCta} accessibilityRole="button">
        <Text style={s.rateCtaText}>{t.rateThisShop}</Text>
      </Pressable>

      <ContactCard shop={choosing ? shop : null} onClose={() => setChoosing(false)} />
    </ScrollView>
  );
}

function Row({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  const { theme } = useSettings();
  const s = styles(theme);
  return (
    <View style={s.kv}>
      <Text style={s.kvKey}>{label}</Text>
      <Text style={[s.kvValue, emphasis && s.kvValueStrong]}>{value}</Text>
    </View>
  );
}

const styles = (theme: ReturnType<typeof useSettings>['theme']) =>
  StyleSheet.create({
    head: { paddingHorizontal: 18, paddingBottom: 12, gap: 10 },
    back: { minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start', paddingRight: 12 },
    backText: { fontSize: 17, fontWeight: '700', color: theme.call },

    headRow: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
    distRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
    distApprox: { fontSize: 20, fontWeight: '600', color: theme.ink3 },
    distValue: {
      fontSize: 32,
      fontWeight: '700',
      color: theme.ink,
      letterSpacing: -1.1,
      fontVariant: ['tabular-nums'],
      lineHeight: 34,
    },
    distUnit: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, color: theme.ink3 },
    headText: { flex: 1, gap: 7 },
    name: { fontSize: 21, fontWeight: '700', color: theme.ink, letterSpacing: -0.4, lineHeight: 25 },
    pillWrap: { flexDirection: 'row' },
    pill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 6 },
    pillText: { fontSize: 13, fontWeight: '700' },
    pillOpen: { backgroundColor: theme.openFill },
    pillOpenText: { color: theme.open },
    pillClosed: { backgroundColor: theme.lineSoft },
    pillClosedText: { color: theme.ink2 },
    pillUnknown: { backgroundColor: theme.mapBg },
    pillUnknownText: { color: theme.ink2 },

    body: { paddingHorizontal: 18, paddingTop: 4, gap: 15, paddingBottom: 40 },

    actions: { flexDirection: 'row', gap: 22, justifyContent: 'center', paddingVertical: 4 },
    actWrap: { alignItems: 'center', gap: 7, width: 74 },
    actCircle: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
    actFilled: { backgroundColor: theme.call },
    actOutline: { borderWidth: 1.5, borderColor: theme.line, backgroundColor: theme.surface },
    actLabel: { fontSize: 12, fontWeight: '600', color: theme.ink2 },
    pressed: { opacity: 0.6 },

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
      height: 64,
      borderRadius: 12,
      backgroundColor: theme.mapBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.line,
      alignItems: 'center',
      justifyContent: 'center',
    },
    photoNote: { fontSize: 13, color: theme.ink2 },

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
      gap: 16,
      paddingVertical: 11,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: theme.lineSoft,
    },
    kvKey: { fontSize: 14, color: theme.ink3 },
    kvValue: { fontSize: 15, color: theme.ink, flexShrink: 1, textAlign: 'right' },
    kvValueStrong: { fontWeight: '700', color: theme.call, fontVariant: ['tabular-nums'] },

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
    socialLabel: { fontSize: 15, color: theme.ink2 },
    socialHandle: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.call,
      textDecorationLine: 'underline',
    },

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
