import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';

import type { Review } from '@/lib/dev/sample-shops';
import { useSettings } from '@/lib/settings/store';

/**
 * Reviews on the shop screen, and the full view that opens when one is tapped.
 *
 * The pattern is the one riders already know from Shopee and Lazada: a compact card
 * with a photo strip, tapping opens the whole thing.
 *
 * Photos are LABELLED TILES, not images. Two reasons, both deliberate: the app bundles
 * no photography, and fetching real images on open would break the promise that the
 * list works with no signal. Real uploads arrive with the server at build step 9, and
 * only this component changes.
 */

function Stars({ value, size = 13 }: { value: number; size?: number }) {
  const { theme } = useSettings();
  return (
    <View style={{ flexDirection: 'row' }}>
      {Array.from({ length: 5 }, (_, i) => {
        const filled = Math.min(Math.max(value - i, 0), 1);
        return (
          <View key={i} style={{ width: size, height: size }}>
            <Text style={{ fontSize: size, lineHeight: size, color: theme.line }}>★</Text>
            {filled > 0 && (
              <View
                style={{ position: 'absolute', left: 0, top: 0, height: size, width: size * filled, overflow: 'hidden' }}
              >
                <Text style={{ fontSize: size, lineHeight: size, color: theme.star }}>★</Text>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

function PhotoTile({
  label,
  big,
  onPress,
}: {
  label: string;
  big?: boolean;
  onPress?: () => void;
}) {
  const { theme } = useSettings();
  const s = styles(theme);
  const body = (
    <>
      <Text style={[s.tileText, big && s.tileTextBig]} numberOfLines={2}>
        {label}
      </Text>
      <Text style={s.tileNote}>PLACEHOLDER</Text>
    </>
  );
  if (!onPress) return <View style={[s.tile, big && s.tileBig]}>{body}</View>;
  return (
    <Pressable
      onPress={onPress}
      style={[s.tile, big && s.tileBig]}
      accessibilityRole="imagebutton"
      accessibilityLabel={`${label}, tap to enlarge`}
    >
      {body}
    </Pressable>
  );
}

export function ReviewList({ reviews }: { reviews: Review[] }) {
  const { theme } = useSettings();
  const [open, setOpen] = useState<Review | null>(null);
  /* A photo opened full screen. Separate from `open` so closing it returns to the review. */
  const [zoom, setZoom] = useState<string | null>(null);
  const s = styles(theme);

  if (reviews.length === 0) return null;

  return (
    <View style={s.list}>
      {reviews.map((review) => (
        <Pressable
          key={review.id}
          onPress={() => setOpen(review)}
          style={s.card}
          accessibilityRole="button"
          accessibilityLabel={`Review by ${review.who}, ${review.stars} of 5`}
        >
          <View style={s.cardHead}>
            <Text style={s.who}>{review.who}</Text>
            <Stars value={review.stars} />
            <Text style={s.score}>{review.stars.toFixed(1)}</Text>
            <View style={s.grow} />
            <Text style={s.when}>{review.when}</Text>
          </View>

          <Text style={s.body} numberOfLines={2}>
            {review.body}
          </Text>

          {review.photos.length > 0 && (
            <View style={s.strip}>
              {review.photos.map((label) => (
                <PhotoTile key={label} label={label} />
              ))}
              <Text style={s.more}>Tap to view</Text>
            </View>
          )}
        </Pressable>
      ))}

      <Modal
        visible={open !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setOpen(null)}
        /* onRequestClose is what makes the Android back button close this. */
      >
        {/*
          A NESTED PROVIDER, and this is the fix for the Close button sitting under the
          navigation buttons.

          Insets are measured RELATIVE TO WHERE THE PROVIDER SITS. Expo Router mounts one
          around the main app window, but a React Native Modal renders in a SEPARATE
          native window that provider does not wrap. Reading insets from it inside the
          Modal gives the main window's numbers, which are not the Modal's.

          Mounting a provider inside the Modal makes it measure the Modal's own window,
          and `SafeAreaView edges={['bottom']}` then applies that padding natively — which
          the library documents as more reliable than the hook, and free of the flicker
          the hook can cause.
        */}
        <SafeAreaProvider>
          <View style={s.backdrop}>
            <SafeAreaView edges={['bottom']} style={s.sheet}>
            <View style={s.sheetHandle} />

            {open && (
              <ScrollView contentContainerStyle={s.sheetBody} showsVerticalScrollIndicator={false}>
                <View style={s.cardHead}>
                  <Text style={s.whoBig}>{open.who}</Text>
                  <View style={s.grow} />
                  <Text style={s.when}>{open.when}</Text>
                </View>

                <View style={s.starsBig}>
                  <Stars value={open.stars} size={22} />
                  <Text style={s.scoreBig}>{open.stars.toFixed(1)} of 5</Text>
                </View>

                <Text style={s.bodyBig}>{open.body}</Text>

                {open.photos.length > 0 && (
                  <View style={s.gallery}>
                    {open.photos.map((label) => (
                      <PhotoTile key={label} label={label} big onPress={() => setZoom(label)} />
                    ))}
                  </View>
                )}

                <Text style={s.disclaimer}>
                  Invented review. Photos are placeholders, not real uploads.
                </Text>
              </ScrollView>
            )}

              <Pressable onPress={() => setOpen(null)} style={s.close} accessibilityRole="button">
                <Text style={s.closeLabel}>Close</Text>
              </Pressable>
            </SafeAreaView>
          </View>
        </SafeAreaProvider>
      </Modal>

      {/*
        Full-screen photo view, layered above the review sheet.

        Its own Modal rather than a state inside the sheet, so the Android back button
        closes the photo first and the review second, which is the order the rider
        opened them in.
      */}
      <Modal
        visible={zoom !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setZoom(null)}
      >
        <Pressable style={s.zoomBackdrop} onPress={() => setZoom(null)}>
          <View style={s.zoomTile}>
            <Text style={s.zoomLabel}>{zoom}</Text>
            <Text style={s.zoomNote}>PLACEHOLDER IMAGE</Text>
          </View>
          <Text style={s.zoomHint}>Tap anywhere to close</Text>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = (theme: ReturnType<typeof useSettings>['theme']) =>
  StyleSheet.create({
    grow: { flex: 1 },
    list: { gap: 10 },

    card: {
      gap: 6,
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.lineSoft,
    },
    cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    who: { fontSize: 14, fontWeight: '700', color: theme.ink },
    whoBig: { fontSize: 18, fontWeight: '700', color: theme.ink },
    score: { fontSize: 13, fontWeight: '700', color: theme.star },
    when: { fontSize: 12.5, color: theme.ink3 },
    body: { fontSize: 14, color: theme.ink2, lineHeight: 20 },
    bodyBig: { fontSize: 16, color: theme.ink, lineHeight: 24 },

    strip: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
    more: { fontSize: 12, fontWeight: '600', color: theme.call },

    tile: {
      width: 62,
      height: 62,
      borderRadius: 8,
      backgroundColor: theme.mapBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.line,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 4,
      gap: 2,
    },
    tileBig: { width: '100%', height: 190, borderRadius: 12 },
    tileText: { fontSize: 9, fontWeight: '600', color: theme.ink3, textAlign: 'center' },
    tileTextBig: { fontSize: 15 },
    tileNote: { fontSize: 7, letterSpacing: 0.5, color: theme.ink3 },

    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: theme.bg,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '86%',
      paddingBottom: 18,
    },
    sheetHandle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.line,
      alignSelf: 'center',
      marginTop: 10,
      marginBottom: 6,
    },
    sheetBody: { padding: 20, gap: 14 },
    starsBig: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    scoreBig: { fontSize: 15, fontWeight: '700', color: theme.star },
    gallery: { gap: 10 },
    disclaimer: { fontSize: 12.5, color: theme.ink3, fontStyle: 'italic' },

    close: {
      height: 54,
      marginHorizontal: 20,
      borderRadius: 13,
      borderWidth: 2,
      borderColor: theme.ink,
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeLabel: { fontSize: 16, fontWeight: '700', color: theme.ink },

    zoomBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.9)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      gap: 18,
    },
    zoomTile: {
      width: '100%',
      aspectRatio: 3 / 4,
      maxHeight: '76%',
      borderRadius: 14,
      backgroundColor: theme.mapBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.line,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      padding: 20,
    },
    zoomLabel: { fontSize: 22, fontWeight: '700', color: theme.ink, textAlign: 'center' },
    zoomNote: { fontSize: 11, letterSpacing: 1, color: theme.ink3 },
    zoomHint: { fontSize: 13, color: '#FFFFFF', opacity: 0.8 },
  });
