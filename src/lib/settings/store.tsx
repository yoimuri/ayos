import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { STRINGS, type Language, type Strings } from '@/lib/i18n/strings';
import { THEMES, type Theme, type ThemeName } from '@/lib/theme/tokens';

/**
 * Everything the rider chose about the app itself, remembered between launches.
 *
 * "Remembered between launches" is the whole reason this file needs AsyncStorage,
 * which is a native module. That is why adding it cost a new build: JavaScript
 * alone cannot reach the phone's disk.
 *
 * Note what is NOT here: shop data. That is the local store from build step 4 and
 * is a separate decision (expo-sqlite or a plain file, still open). Settings are a
 * handful of small values, so a simple key-value store is the right size.
 */

/** Coarse area, not coordinates. The spec forbids storing a precise location. */
export type Area =
  | 'manila'
  | 'quezon-city'
  | 'makati-bgc'
  | 'caloocan-malabon'
  | 'pasig-mandaluyong'
  | 'paranaque-las-pinas'
  | 'marikina'
  | 'other';

/** What the rider rides. Stored now, used once shops record what they service. */
export type BikeKind = 'scooter' | 'underbone' | 'big-bike' | 'any';

export type Settings = {
  language: Language;
  theme: ThemeName;
  area: Area | null;
  bike: BikeKind | null;
  /** How far to search. Null means no limit. */
  radiusM: number | null;
  /** Draw the dashed search circle on the map. Some riders find it noise. */
  showRadiusRing: boolean;
  /** False until the first-run questions are answered or skipped. */
  onboarded: boolean;
};

const DEFAULTS: Settings = {
  language: 'en',
  theme: 'light',
  area: null,
  bike: null,
  radiusM: 5000,
  showRadiusRing: true,
  onboarded: false,
};

/**
 * One key holding one JSON blob.
 *
 * Five separate keys would mean five reads on launch and five chances for them to
 * disagree with each other after a partial write. One blob is read once and is
 * always internally consistent.
 */
const STORAGE_KEY = 'ayos.settings.v1';

type SettingsContextValue = {
  settings: Settings;
  /** True until the saved settings have been read off disk. */
  loading: boolean;
  /** Merges a patch into the saved settings. Writes to disk in the background. */
  update: (patch: Partial<Settings>) => void;
  /** Resolved palette for the chosen theme. */
  theme: Theme;
  /** Resolved copy for the chosen language. */
  t: Strings;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (cancelled || !raw) return;
        /*
          Spread the defaults first so a blob written by an older version, missing a
          key added since, still produces a complete Settings object instead of
          leaving something undefined that a screen then tries to render.
        */
        setSettings({ ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) });
      })
      .catch(() => {
        // Unreadable or corrupt storage falls back to defaults rather than crashing
        // on launch. A rider with a broken preferences file still gets a working app.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch };
      /*
        The screen updates from state immediately and the disk write is not awaited.
        A toggle that waited on storage would feel sticky, and if the write fails the
        worst case is one preference forgotten on next launch.
      */
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo<SettingsContextValue>(
    () => ({
      settings,
      loading,
      update,
      theme: THEMES[settings.theme],
      t: STRINGS[settings.language],
    }),
    [settings, loading, update],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

/** Every screen reads settings, the palette and the copy through this one hook. */
export function useSettings(): SettingsContextValue {
  const value = useContext(SettingsContext);
  if (!value) {
    throw new Error('useSettings was called outside SettingsProvider. Check src/app/_layout.tsx.');
  }
  return value;
}

export const AREA_LABELS: Record<Area, string> = {
  manila: 'Manila',
  'quezon-city': 'Quezon City',
  'makati-bgc': 'Makati / BGC',
  'caloocan-malabon': 'Caloocan / Malabon',
  'pasig-mandaluyong': 'Pasig / Mandaluyong',
  'paranaque-las-pinas': 'Parañaque / Las Piñas',
  marikina: 'Marikina',
  other: 'Somewhere else',
};

export const BIKE_LABELS: Record<BikeKind, string> = {
  scooter: 'Scooter (Click, Nmax, Aerox)',
  underbone: 'Underbone (Sniper, Raider, XRM)',
  'big-bike': 'Big bike (400cc and up)',
  any: 'Prefer not to say',
};
