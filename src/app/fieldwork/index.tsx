import { Directory, File } from 'expo-file-system';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandBar } from '@/components/BrandBar';
import { useShops } from '@/lib/data/shops';
import { FIELD_LABEL, changeRows, editedShopRows, newShopRows, stamp } from '@/lib/fieldwork/model';
import { useExportReminder, useFieldwork } from '@/lib/fieldwork/store';
import { SURVEY_WIDTHS, XLSX_MIME, writeXlsx } from '@/lib/fieldwork/xlsx';
import { useLocationGate } from '@/lib/location/useLocationGate';
import { useSettings } from '@/lib/settings/store';

/**
 * SURVEY LOG (field survey mode, developer feature, removed before launch).
 *
 * Everything the surveyor changed or added on this phone, newest first. Each change
 * can be corrected or deleted here, which is the safety net for a wrong entry.
 *
 * EXPORT writes two files into a folder the surveyor picks (Downloads works):
 *   - ONE SPREADSHEET (.xlsx) with three tabs: New shops, Edited shops (complete rows,
 *     changed cells marked), and Changes (every edit with its before and after). It goes
 *     to the shared Drive folder; scripts/import_shops.py --survey merges it into the
 *     field sheet, so nobody copies anything by hand;
 *   - a full backup, which RESTORE reads back on this or another phone.
 */

export default function FieldworkScreen() {
  const { theme, settings } = useSettings();
  const router = useRouter();
  const gate = useLocationGate();
  const fw = useFieldwork();
  const base = useShops(gate.position, settings.area);
  const s = styles(theme);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const byId = useMemo(() => new Map(base.map((shop) => [shop.id, shop])), [base]);
  const nameOf = (id: string) => byId.get(id)?.name ?? id;

  const log = [...fw.data.log].sort((a, b) => b.at - a.at);
  const remind = useExportReminder();
  const nothing = fw.data.log.length === 0 && fw.data.added.length === 0;

  const exportAll = async () => {
    setBusy(true);
    try {
      const dir = await Directory.pickDirectoryAsync();
      const tag = stamp(Date.now()).replace(' ', '_').replace(':', '');
      const sheet = writeXlsx([
        { name: 'New shops', ...newShopRows(fw.data), widths: SURVEY_WIDTHS.newShops },
        { name: 'Edited shops', ...editedShopRows(fw.data, (id) => byId.get(id)), widths: SURVEY_WIDTHS.editedShops },
        { name: 'Changes', ...changeRows(fw.data, nameOf), widths: SURVEY_WIDTHS.changes },
      ]);
      dir.createFile(`ayos-survey-${tag}.xlsx`, XLSX_MIME).write(sheet);
      dir.createFile(`ayos-survey-backup-${tag}.json`, 'application/json').write(fw.backupText());
      fw.markExported();
      Alert.alert(
        'Exported',
        `Saved ayos-survey-${tag}.xlsx and a backup in the folder you picked. Upload the .xlsx to the shared Drive folder. Keep the backup on the phone.`,
      );
    } catch (e) {
      /* Backing out of the folder picker lands here too, which needs no message. */
      const msg = e instanceof Error ? e.message : String(e);
      if (!/cancel/i.test(msg)) Alert.alert('Could not export', msg);
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    try {
      const picked = await File.pickFileAsync({ mimeTypes: ['application/json', 'application/octet-stream', '*/*'] });
      if (picked.canceled) return;
      const text = await picked.result.text();
      Alert.alert('Restore this backup?', 'Everything in the survey log on this phone is replaced by the backup.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: () => {
            if (!fw.restoreBackup(text)) Alert.alert('Not a backup', 'Pick a file named ayos-survey-backup-….json.');
          },
        },
      ]);
    } catch (e) {
      Alert.alert('Could not open the file', e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <SafeAreaView style={s.screen} edges={['top', 'bottom']}>
      <BrandBar title="Survey log" />
      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        {remind && (
          <View style={s.remind}>
            <Text style={s.remindText}>
              Some of today’s work is not exported yet. Export it before you close the app for the day.
            </Text>
          </View>
        )}

        <View style={s.actions}>
          <Pressable
            onPress={exportAll}
            disabled={busy || nothing}
            style={({ pressed }) => [s.primary, (busy || nothing) && s.disabled, pressed && s.pressed]}
            accessibilityRole="button"
          >
            <Text style={s.primaryText}>{busy ? 'Exporting…' : 'Export survey'}</Text>
          </Pressable>
          <Pressable onPress={restore} style={({ pressed }) => [s.outline, pressed && s.pressed]} accessibilityRole="button">
            <Text style={s.outlineText}>Restore from backup</Text>
          </Pressable>
        </View>
        <Text style={s.help}>
          {fw.data.lastExportAt ? `Last exported ${stamp(fw.data.lastExportAt)}.` : 'Not exported yet.'}
        </Text>

        <Text style={s.heading}>Shops you added ({fw.data.added.length})</Text>
        {fw.data.added.length === 0 && <Text style={s.help}>None yet. Use “Add a shop” in Settings.</Text>}
        {fw.data.added.map((n) => (
          <Pressable
            key={n.id}
            onPress={() => router.push({ pathname: '/fieldwork/shop', params: { id: n.id } })}
            style={({ pressed }) => [s.card, pressed && s.pressed]}
            accessibilityRole="button"
          >
            <Text style={s.cardTitle}>{n.values.name || '(no name)'}</Text>
            <Text style={s.help}>
              {stamp(n.createdAt)} · {n.lat.toFixed(6)}, {n.lng.toFixed(6)}
              {n.accuracy != null ? ` · GPS ±${Math.round(n.accuracy)} m` : ' · pin placed by hand'}
            </Text>
          </Pressable>
        ))}

        <Text style={s.heading}>Changes ({log.length})</Text>
        {log.length === 0 && <Text style={s.help}>No changes yet. Open a shop and tap “Update shop info”.</Text>}
        {log.map((e) => (
          <View key={e.id} style={s.card}>
            <Text style={s.cardTitle}>
              {nameOf(e.shopId)} · {FIELD_LABEL[e.field]}
            </Text>
            <Text style={s.help}>{stamp(e.at)}</Text>
            <Text style={s.before}>Before: {e.before || '(blank)'}</Text>
            {editing?.id === e.id ? (
              <>
                <TextInput
                  value={editing.text}
                  onChangeText={(text) => setEditing({ id: e.id, text })}
                  style={s.input}
                  multiline
                  autoFocus
                />
                <View style={s.rowBtns}>
                  <Pressable onPress={() => setEditing(null)} hitSlop={8} accessibilityRole="button">
                    <Text style={s.link}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      fw.editEntry(e.id, editing.text);
                      setEditing(null);
                    }}
                    hitSlop={8}
                    accessibilityRole="button"
                  >
                    <Text style={s.link}>Save</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <Text style={s.after}>After: {e.after || '(blank)'}</Text>
                <View style={s.rowBtns}>
                  <Pressable onPress={() => setEditing({ id: e.id, text: e.after })} hitSlop={8} accessibilityRole="button">
                    <Text style={s.link}>Edit</Text>
                  </Pressable>
                  <Pressable
                    onPress={() =>
                      Alert.alert('Delete this change?', 'The shop goes back to the value before it.', [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Delete', style: 'destructive', onPress: () => fw.deleteEntry(e.id) },
                      ])
                    }
                    hitSlop={8}
                    accessibilityRole="button"
                  >
                    <Text style={s.danger}>Delete</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = (theme: ReturnType<typeof useSettings>['theme']) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.bg },
    body: { padding: 18, gap: 12, paddingBottom: 40 },
    remind: { borderRadius: 12, backgroundColor: theme.callFill, padding: 14 },
    remindText: { fontSize: 15, color: theme.ink, lineHeight: 21 },
    actions: { gap: 10 },
    primary: { minHeight: 54, borderRadius: 13, backgroundColor: theme.call, alignItems: 'center', justifyContent: 'center' },
    primaryText: { fontSize: 17, fontWeight: '700', color: theme.onFilled },
    outline: {
      minHeight: 50,
      borderRadius: 13,
      borderWidth: 1.5,
      borderColor: theme.line,
      backgroundColor: theme.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    outlineText: { fontSize: 16, fontWeight: '700', color: theme.ink },
    disabled: { opacity: 0.45 },
    pressed: { opacity: 0.6 },
    heading: { fontSize: 18, fontWeight: '700', color: theme.ink, marginTop: 12 },
    help: { fontSize: 14, color: theme.ink2, lineHeight: 20 },
    card: { borderRadius: 12, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.surface, padding: 14, gap: 4 },
    cardTitle: { fontSize: 16, fontWeight: '700', color: theme.ink },
    before: { fontSize: 14, color: theme.ink3 },
    after: { fontSize: 15, color: theme.ink },
    input: {
      minHeight: 50,
      borderRadius: 11,
      borderWidth: 1.5,
      borderColor: theme.call,
      backgroundColor: theme.bg,
      paddingHorizontal: 12,
      fontSize: 15,
      color: theme.ink,
    },
    rowBtns: { flexDirection: 'row', justifyContent: 'flex-end', gap: 24, marginTop: 6 },
    link: { fontSize: 15, fontWeight: '700', color: theme.call },
    danger: { fontSize: 15, fontWeight: '700', color: theme.alert },
  });
