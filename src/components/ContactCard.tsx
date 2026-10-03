import { Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { ChatIcon, PhoneIcon } from '@/components/icons';
import type { Shop } from '@/lib/data/types';
import { useSettings } from '@/lib/settings/store';

/**
 * "How do you want to reach them?" A card that SHOWS the choices, instead of the plain
 * system pop-up with two words in it.
 *
 * Every number the shop gave gets its own row, with a big Call and a big Text button:
 * 99 shops gave more than one number, and the second is often the one that answers.
 * Choosing still hands over to the phone's own dialler or messages app, which is its
 * own confirmation, so nothing is ever dialled from this card by accident.
 *
 * Closes on Cancel, a tap outside, or the phone's back button.
 */
export function ContactCard({ shop, onClose }: { shop: Shop | null; onClose: () => void }) {
  const { theme, t } = useSettings();
  const s = styles(theme);

  const go = (url: string) => {
    onClose();
    void Linking.openURL(url);
  };

  return (
    <Modal visible={shop !== null} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel={t.cancel}>
        {/* An empty handler so a tap on the card itself does not close it. */}
        <Pressable style={s.card} onPress={() => {}}>
          {shop && (
            <>
              <Text style={s.title} numberOfLines={2}>
                {shop.name}
              </Text>
              <Text style={s.subtitle}>{t.contactHow}</Text>

              {shop.phones.map((phone) => (
                <View key={phone} style={s.numberBlock}>
                  <Text style={s.number}>{phone}</Text>
                  <View style={s.row}>
                    <Pressable
                      onPress={() => go(`tel:${phone}`)}
                      style={({ pressed }) => [s.btn, s.btnFilled, pressed && s.pressed]}
                      accessibilityRole="button"
                      accessibilityLabel={`${t.call} ${phone}`}
                    >
                      <PhoneIcon size={22} color={theme.onFilled} />
                      <Text style={[s.btnText, s.btnTextFilled]}>{t.call}</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => go(`sms:${phone}`)}
                      style={({ pressed }) => [s.btn, s.btnOutline, pressed && s.pressed]}
                      accessibilityRole="button"
                      accessibilityLabel={`${t.message} ${phone}`}
                    >
                      <ChatIcon size={22} color={theme.ink} />
                      <Text style={s.btnText}>{t.message}</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </>
          )}

          <Pressable
            onPress={onClose}
            style={({ pressed }) => [s.cancel, pressed && s.pressed]}
            accessibilityRole="button"
          >
            <Text style={s.cancelText}>{t.cancel}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = (theme: ReturnType<typeof useSettings>['theme']) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
    },
    card: {
      width: '100%',
      maxWidth: 420,
      backgroundColor: theme.bg,
      borderRadius: 18,
      padding: 20,
      gap: 14,
    },
    title: { fontSize: 20, fontWeight: '700', color: theme.ink, lineHeight: 25 },
    subtitle: { fontSize: 15, color: theme.ink2, marginTop: -8 },
    numberBlock: {
      gap: 10,
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.line,
    },
    number: { fontSize: 18, fontWeight: '700', color: theme.ink, fontVariant: ['tabular-nums'] },
    row: { flexDirection: 'row', gap: 12 },
    btn: {
      flex: 1,
      minHeight: 54,
      borderRadius: 13,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 9,
    },
    btnFilled: { backgroundColor: theme.call },
    btnOutline: { borderWidth: 1.5, borderColor: theme.line, backgroundColor: theme.surface },
    btnText: { fontSize: 17, fontWeight: '700', color: theme.ink },
    btnTextFilled: { color: theme.onFilled },
    cancel: {
      minHeight: 52,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 2,
    },
    cancelText: { fontSize: 16, fontWeight: '700', color: theme.ink2 },
    pressed: { opacity: 0.6 },
  });
