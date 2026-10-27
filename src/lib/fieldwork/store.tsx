import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import {
  EMPTY_FIELDWORK,
  addShop,
  deleteEntry,
  deleteNewShop,
  moveNewShop,
  editEntry,
  parseBackup,
  recordEdit,
  restoreField,
  restoreShop,
  toBackup,
  updateNewShop,
  type LogField,
  type FieldworkData,
  type NewShop,
  needsExportReminder,
} from './model';

/**
 * FIELD SURVEY MODE's storage, on the surveyor's phone. DEVELOPER FEATURE, removed
 * before the official launch.
 *
 * Saved under its own key, written after every change. The phone copy alone is lost if
 * the app is uninstalled, which is why exporting (a full backup file) is part of the job.
 */

const KEY = 'ayos.fieldwork.v1';

type FieldworkApi = {
  data: FieldworkData;
  edit: (shopId: string, field: LogField, before: string, after: string) => void;
  editEntry: (entryId: string, after: string) => void;
  deleteEntry: (entryId: string) => void;
  restoreField: (shopId: string, field: LogField) => void;
  restoreShop: (shopId: string) => void;
  addShop: (s: Omit<NewShop, 'id' | 'createdAt'>) => void;
  updateNewShop: (id: string, values: NewShop['values']) => void;
  moveNewShop: (id: string, lat: number, lng: number) => void;
  deleteNewShop: (id: string) => void;
  markExported: () => void;
  /** Replace everything with a backup's contents. Returns false for a file that is not a backup. */
  restoreBackup: (text: string) => boolean;
  backupText: () => string;
};

const FieldworkContext = createContext<FieldworkApi | null>(null);

/** Unique enough for one surveyor's phone: time plus a random tail. */
const newId = (prefix: string) => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function FieldworkProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<FieldworkData>(EMPTY_FIELDWORK);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (!raw) return;
        const parsed = parseBackup(raw);
        if (parsed) setData(parsed);
      })
      .catch(() => {});
  }, []);

  const change = useCallback((fn: (d: FieldworkData) => FieldworkData) => {
    setData((d) => {
      const next = fn(d);
      /* Stored in the same shape as a backup file, so one reader handles both. */
      AsyncStorage.setItem(KEY, toBackup(next, Date.now())).catch(() => {});
      return next;
    });
  }, []);

  const api = useMemo<FieldworkApi>(
    () => ({
      data,
      edit: (shopId, field, before, after) =>
        change((d) => recordEdit(d, { id: newId('e'), shopId, field, before, after, at: Date.now() })),
      editEntry: (id, after) => change((d) => editEntry(d, id, after)),
      deleteEntry: (id) => change((d) => deleteEntry(d, id)),
      restoreField: (shopId, field) => change((d) => restoreField(d, shopId, field)),
      restoreShop: (shopId) => change((d) => restoreShop(d, shopId)),
      addShop: (s) => change((d) => addShop(d, { ...s, id: newId('new-'), createdAt: Date.now() })),
      updateNewShop: (id, values) => change((d) => updateNewShop(d, id, values)),
      moveNewShop: (id, lat, lng) => change((d) => moveNewShop(d, id, lat, lng)),
      deleteNewShop: (id) => change((d) => deleteNewShop(d, id)),
      markExported: () => change((d) => ({ ...d, lastExportAt: Date.now() })),
      restoreBackup: (text) => {
        const parsed = parseBackup(text);
        if (!parsed) return false;
        change(() => parsed);
        return true;
      },
      backupText: () => toBackup(data, Date.now()),
    }),
    [data, change],
  );

  return <FieldworkContext.Provider value={api}>{children}</FieldworkContext.Provider>;
}

export function useFieldwork(): FieldworkApi {
  const v = useContext(FieldworkContext);
  if (!v) throw new Error('useFieldwork must be used inside <FieldworkProvider>');
  return v;
}

/**
 * True when survey work has waited more than a day for an export. The clock is read
 * on mount and every five minutes after, not on every render, so the screen showing
 * the reminder stays a pure function of its state.
 */
export function useExportReminder(): boolean {
  const { data } = useFieldwork();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, []);
  return needsExportReminder(data, now);
}
