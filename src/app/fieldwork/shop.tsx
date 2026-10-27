import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, BackHandler, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandBar } from '@/components/BrandBar';
import { PinPicker } from '@/components/PinPicker';
import { useAppShops, useShops } from '@/lib/data/shops';
import {
  FIELDS,
  FIELD_LABEL,
  currentValues,
  locationText,
  parseLocation,
  sheetValues,
  type Field,
} from '@/lib/fieldwork/model';
import { useFieldwork } from '@/lib/fieldwork/store';
import { useLocationGate } from '@/lib/location/useLocationGate';
import { AREA_CENTRES, useSettings } from '@/lib/settings/store';

/**
 * UPDATE SHOP INFO (field survey mode, developer feature, removed before launch).
 *
 * Three uses, one form:
 *   - a shop on the list (`id`): corrections are recorded as edits in the log, each
 *     column showing its ORIGINAL value with a Restore button;
 *   - a shop this phone added (`id` starting "new-"): its values are edited directly;
 *   - no `id`: a new shop. The map opens first, so the pin goes on the shop before
 *     anything is typed.
 *
 * THE PIN gives the coordinates, which fill themselves in and go into the export, so
 * whoever reads the sheet can paste them into a maps app and find the spot. The address
 * is still typed by hand: coordinates find the place, the address describes it.
 *
 * Save sits in the top bar, where the keyboard never covers it, and leaving with
 * unsaved typing asks first.
 */

type Point = { lat: number; lng: number };

const HINT: Partial<Record<Field, string>> = {
  services: 'Any of: Dealer, Repair, Parts, Accessories (comma between)',
  contact: 'e.g. 0917 123 4567, 0918 765 4321',
  social: 'Full link, e.g. https://www.facebook.com/...',
  time: 'e.g. 9:00 - 20:00 (24-hour), or 0:00 - 24:00 for always open',
  closed: 'e.g. Sunday, Saturday and Sunday, Everyday Open',
};

export default function FieldShopScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { theme, settings } = useSettings();
  const router = useRouter();
  const navigation = useNavigation();
  const gate = useLocationGate();
  const fw = useFieldwork();
  /* The ORIGINAL list, without this phone's edits, for "before" and Restore. */
  const base = useShops(gate.position, settings.area);
  /* Everything on the map, edits included, for the picker's reference dots. */
  const everyShop = useAppShops(gate.position, settings.area);
  const s = styles(theme);

  const isAdded = !!id && id.startsWith('new-');
  const isListed = !!id && !isAdded;
  const added = isAdded ? fw.data.added.find((n) => n.id === id) : undefined;
  const original = useMemo(() => (isListed ? base.find((x) => x.id === id) : undefined), [base, id, isListed]);
  const originalText = useMemo(() => sheetValues(original), [original]);
  const edits = isListed ? currentValues(fw.data, id) : {};
  const current: Record<Field, string> = isAdded
    ? { ...sheetValues(undefined), ...(added?.values as Record<Field, string>) }
    : { ...originalText, ...edits };

  /* Where the shop is now, as text, before anything on this screen changes it. */
  const originalLoc = original ? locationText(original.lat, original.lng) : null;
  const currentLoc = added ? locationText(added.lat, added.lng) : isListed ? (edits.location ?? originalLoc) : null;

  const [form, setForm] = useState<Record<Field, string>>(current);
  const set = (f: Field) => (v: string) => setForm((x) => ({ ...x, [f]: v }));

  /* A new shop starts where the phone is; a listed one where it is drawn now. */
  const [pin, setPin] = useState<Point | null>(() => {
    const known = currentLoc ? parseLocation(currentLoc) : null;
    if (known) return known;
    return gate.position ? { lat: gate.position[1], lng: gate.position[0] } : null;
  });
  const pinText = pin ? locationText(pin.lat, pin.lng) : null;
  /* True once the surveyor placed the pin themselves, rather than leaving the GPS spot. */
  const [pinMoved, setPinMoved] = useState(false);
  /* A new shop opens on the map: the pin goes on the shop before anything is typed. */
  const [picking, setPicking] = useState(!id);

  const dirty = FIELDS.some((f) => form[f] !== current[f]) || pinMoved;

  /*
    LEAVING WITH UNSAVED WORK ASKS FIRST, whichever way out: the ‹ button or the phone's
    Back. `leaving` is set by Save and Delete, which leave on purpose.
  */
  const leaving = useRef(false);
  useEffect(() => {
    if (!dirty) return;
    return navigation.addListener('beforeRemove', (e) => {
      if (leaving.current) return;
      e.preventDefault();
      Alert.alert('Discard changes?', 'What you changed on this screen is not saved yet.', [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
      ]);
    });
  }, [dirty, navigation]);
  const leave = () => {
    leaving.current = true;
    router.back();
  };

  /* While the map is open, the phone's Back closes the map, not the screen. */
  useEffect(() => {
    if (!picking) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setPicking(false);
      return true;
    });
    return () => sub.remove();
  }, [picking]);

  if (isListed && !original) {
    return (
      <SafeAreaView style={s.screen} edges={['top', 'bottom']}>
        <BrandBar title="Update shop info" home={false} />
        <Text style={[s.help, s.pad]}>This shop is not in the list on this phone.</Text>
      </SafeAreaView>
    );
  }

  const save = () => {
    if (!form.name.trim()) {
      Alert.alert('Name needed', 'Type the shop name first.');
      return;
    }
    if (!id) {
      if (!pin) {
        Alert.alert('Place the pin first', 'Tap “Place pin” and put it on the shop.');
        return;
      }
      fw.addShop({ lat: pin.lat, lng: pin.lng, accuracy: pinMoved ? null : gate.accuracyM, values: form });
    } else if (isAdded) {
      fw.updateNewShop(id, form);
      if (pinMoved && pin) fw.moveNewShop(id, pin.lat, pin.lng);
    } else {
      for (const f of FIELDS) {
        if (form[f] !== current[f]) fw.edit(id, f, current[f], form[f]);
      }
      if (pinMoved && pinText && pinText !== currentLoc) fw.edit(id, 'location', currentLoc ?? '', pinText);
    }
    leave();
  };

  const title = !id ? 'Add a shop' : 'Update shop info';
  const locMoved = isListed && (edits.location !== undefined || (pinMoved && pinText !== originalLoc));

  if (picking) {
    const centre = AREA_CENTRES[settings.area ?? 'other'];
    return (
      <SafeAreaView style={s.screen} edges={['top', 'bottom']}>
        <BrandBar title="Put the pin on the shop" home={false} />
        <PinPicker
          initial={pin ?? { lat: centre[1], lng: centre[0] }}
          rider={gate.position}
          shops={everyShop.filter((x) => x.id !== id)}
          onCancel={() => setPicking(false)}
          onDone={(p) => {
            if (locationText(p.lat, p.lng) !== pinText) setPinMoved(true);
            setPin(p);
            setPicking(false);
          }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.screen} edges={['top', 'bottom']}>
      <BrandBar title={title} home={false} action={{ label: 'Save', onPress: save }} />
      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        {/*
          MAP LOCATION. Filled in from the pin, never typed. Selectable, so it can be
          copied straight into a maps app.
        */}
        <View style={s.field}>
          <Text style={s.label}>
            Map location{locMoved ? '  · moved' : ''}
            {!id && !pinMoved && gate.accuracyM != null ? `  · GPS, about ${Math.round(gate.accuracyM)} m` : ''}
          </Text>
          <View style={s.locBox}>
            <Text style={s.coords} selectable>
              {pinText ?? 'No pin yet'}
            </Text>
            <Pressable onPress={() => setPicking(true)} hitSlop={8} accessibilityRole="button">
              <Text style={s.restore}>{pin ? 'Move pin' : 'Place pin'}</Text>
            </Pressable>
          </View>
          {locMoved && originalLoc && (
            <View style={s.originalRow}>
              <Text style={s.original} numberOfLines={1}>
                Original: {originalLoc}
              </Text>
              <Pressable
                onPress={() => {
                  fw.restoreField(id!, 'location');
                  setPin(parseLocation(originalLoc));
                  setPinMoved(false);
                }}
                hitSlop={8}
                accessibilityRole="button"
              >
                <Text style={s.restore}>Restore</Text>
              </Pressable>
            </View>
          )}
          <Text style={s.original}>Paste these into a maps app to find the spot. Type the address below by hand.</Text>
        </View>

        {FIELDS.map((f) => {
          const edited = isListed && edits[f] !== undefined;
          return (
            <View key={f} style={s.field}>
              <Text style={s.label}>
                {FIELD_LABEL[f]}
                {edited ? '  · edited' : ''}
              </Text>
              <TextInput
                value={form[f]}
                onChangeText={set(f)}
                style={[s.input, f === 'note' && s.inputTall]}
                multiline={f === 'note' || f === 'address'}
                placeholder={HINT[f]}
                placeholderTextColor={theme.ink3}
                autoCapitalize={f === 'email' || f === 'social' ? 'none' : 'sentences'}
                keyboardType={f === 'email' ? 'email-address' : f === 'contact' ? 'phone-pad' : 'default'}
              />
              {edited && (
                <View style={s.originalRow}>
                  <Text style={s.original} numberOfLines={2}>
                    Original: {originalText[f] || '(blank)'}
                  </Text>
                  <Pressable
                    onPress={() => {
                      fw.restoreField(id!, f);
                      setForm((x) => ({ ...x, [f]: originalText[f] }));
                    }}
                    hitSlop={8}
                    accessibilityRole="button"
                  >
                    <Text style={s.restore}>Restore</Text>
                  </Pressable>
                </View>
              )}
            </View>
          );
        })}

        <Pressable onPress={save} style={({ pressed }) => [s.primary, pressed && s.pressed]} accessibilityRole="button">
          <Text style={s.primaryText}>Save</Text>
        </Pressable>

        {isListed && Object.keys(edits).length > 0 && (
          <Pressable
            onPress={() =>
              Alert.alert('Restore the original?', 'Every edit to this shop on this phone is removed.', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Restore',
                  style: 'destructive',
                  onPress: () => {
                    fw.restoreShop(id!);
                    leave();
                  },
                },
              ])
            }
            style={({ pressed }) => [s.secondary, pressed && s.pressed]}
            accessibilityRole="button"
          >
            <Text style={s.secondaryText}>Restore the whole shop to the original</Text>
          </Pressable>
        )}

        {isAdded && (
          <Pressable
            onPress={() =>
              Alert.alert('Delete this added shop?', 'It is removed from this phone.', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: () => {
                    fw.deleteNewShop(id!);
                    leave();
                  },
                },
              ])
            }
            style={({ pressed }) => [s.secondary, pressed && s.pressed]}
            accessibilityRole="button"
          >
            <Text style={s.secondaryText}>Delete this added shop</Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = (theme: ReturnType<typeof useSettings>['theme']) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.bg },
    body: { padding: 18, gap: 16, paddingBottom: 40 },
    pad: { padding: 18 },
    help: { fontSize: 14, color: theme.ink2, lineHeight: 20 },
    field: { gap: 6 },
    label: { fontSize: 14, fontWeight: '700', color: theme.ink2 },
    locBox: {
      minHeight: 50,
      borderRadius: 11,
      borderWidth: 1.5,
      borderColor: theme.line,
      backgroundColor: theme.surface,
      paddingHorizontal: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    coords: { flex: 1, fontSize: 15, fontWeight: '700', color: theme.ink, fontVariant: ['tabular-nums'] },
    input: {
      minHeight: 50,
      borderRadius: 11,
      borderWidth: 1.5,
      borderColor: theme.line,
      backgroundColor: theme.surface,
      paddingHorizontal: 14,
      fontSize: 15,
      color: theme.ink,
    },
    inputTall: { minHeight: 84, paddingTop: 12, textAlignVertical: 'top' },
    originalRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    original: { flex: 1, fontSize: 13, color: theme.ink3 },
    restore: { fontSize: 14, fontWeight: '700', color: theme.call },
    primary: {
      minHeight: 54,
      borderRadius: 13,
      backgroundColor: theme.call,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 4,
    },
    primaryText: { fontSize: 17, fontWeight: '700', color: theme.onFilled },
    secondary: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
    secondaryText: { fontSize: 15, fontWeight: '700', color: theme.alert },
    pressed: { opacity: 0.6 },
  });
