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
import type { RiderSurvey } from '@/lib/survey/questions';
import { PALETTES, type PaletteName, type Theme, type ThemeName } from '@/lib/theme/tokens';

/**
 * Everything the rider chose about the app itself, remembered between launches.
 *
 * "Remembered between launches" is the whole reason this file needs AsyncStorage,
 * which is a native module. That is why adding it cost a new build: JavaScript
 * alone cannot reach the phone's disk.
 *
 * Note what is NOT here: shop data. That needs its own on-device store (expo-sqlite or a
 * plain file, still open). Settings are a
 * handful of small values, so a simple key-value store is the right size.
 */

/** Coarse area, not coordinates: the rider's precise location is never stored. */
/**
 * Metro Manila's 17 cities. Each shop's city comes from its own address, written by
 * scripts/import_shops.py, not from guessing by map position.
 */
export type Area =
  | 'caloocan'
  | 'las-pinas'
  | 'makati'
  | 'malabon'
  | 'mandaluyong'
  | 'manila'
  | 'marikina'
  | 'muntinlupa'
  | 'navotas'
  | 'paranaque'
  | 'pasay'
  | 'pasig'
  | 'pateros'
  | 'quezon-city'
  | 'san-juan'
  | 'taguig'
  | 'valenzuela'
  | 'other';

/**
 * A city saved by an older version, translated to today's list. The old groups map to
 * their bigger city, so a rider who picked "Caloocan / Malabon" lands in Caloocan rather
 * than losing their choice.
 */
const OLD_AREAS: Record<string, Area> = {
  'makati-bgc': 'makati',
  'caloocan-malabon': 'caloocan',
  'pasig-mandaluyong': 'pasig',
  'paranaque-las-pinas': 'paranaque',
};

export type Settings = {
  language: Language;
  theme: ThemeName;
  area: Area | null;
  /**
   * The rider questions (lib/survey/questions.ts). On this phone only until usage
   * events exist.
   */
  survey: RiderSurvey;
  /** How far to search. Null means no limit. */
  radiusM: number | null;
  /** Draw the dashed search circle on the map. Some riders find it noise. */
  showRadiusRing: boolean;
  /** False until the first-run questions are answered or skipped. */
  onboarded: boolean;
  /**
   * True once the tutorial has STARTED, not finished. Set the moment it opens, so a rider
   * who closes the app halfway is never made to sit through it again ("never forced
   * again"). Replaying from the help button or Settings sets it back to false.
   */
  tourDone: boolean;
  /**
   * Which colour scheme. A REVIEW SWITCH while we compare the candidates; the others are
   * deleted once one is picked.
   */
  palette: PaletteName;
  /**
   * Where the rider is with the rider questions:
   *   unasked   the thank-you popup has not been shown yet
   *   later     they chose Later: a small reminder sits at the top of the list
   *   answered  they finished; nothing more is shown
   *   never     they chose "Don't ask again"
   */
  surveyState: 'unasked' | 'later' | 'answered' | 'never';
  /** The search box folded away with the chevron in the top bar. */
  searchHidden: boolean;
};

const DEFAULTS: Settings = {
  language: 'en',
  theme: 'light',
  area: null,
  survey: {},
  radiusM: 5000,
  showRadiusRing: true,
  onboarded: false,
  tourDone: false,
  palette: 'oxide',
  surveyState: 'unasked',
  searchHidden: false,
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
  /**
   * The colours for anything DRAWN ON THE MAP: always the light variant of the palette.
   *
   * The map style is light in both app modes (a dark map is deferred), so a pin coloured
   * from the dark palette is a light colour on a light map.
   * That is exactly how the selected pin became invisible in dark mode.
   */
  mapTheme: Theme;
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
        const saved = JSON.parse(raw) as Partial<Settings>;
        if (saved.area && !(saved.area in AREA_LABELS)) {
          saved.area = OLD_AREAS[saved.area] ?? null;
        }
        setSettings({ ...DEFAULTS, ...saved });
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
      /* `?? oxide` guards a saved palette name from a build that no longer has it. */
      theme: (PALETTES[settings.palette] ?? PALETTES.oxide)[settings.theme],
      mapTheme: (PALETTES[settings.palette] ?? PALETTES.oxide).light,
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

/** Alphabetical, which is how the picker lists them. */
export const AREA_LABELS: Record<Area, string> = {
  caloocan: 'Caloocan',
  'las-pinas': 'Las Piñas',
  makati: 'Makati',
  malabon: 'Malabon',
  mandaluyong: 'Mandaluyong',
  manila: 'Manila',
  marikina: 'Marikina',
  muntinlupa: 'Muntinlupa',
  navotas: 'Navotas',
  paranaque: 'Parañaque',
  pasay: 'Pasay',
  pasig: 'Pasig',
  pateros: 'Pateros',
  'quezon-city': 'Quezon City',
  'san-juan': 'San Juan',
  taguig: 'Taguig',
  valenzuela: 'Valenzuela',
  other: 'Somewhere else',
};

/**
 * Where each city's shops are, as [longitude, latitude]: the median of the shops whose
 * address names that city, measured from the 29 Sep 2026 sheet. "Where the shops are",
 * not the city hall, because it is only used to place the map when the rider has no
 * location yet, and there it should open over shops.
 *
 * Not anybody's position: the rule about never storing a precise location is about the
 * RIDER.
 */
export const AREA_CENTRES: Record<Area, [number, number]> = {
  caloocan: [121.0164, 14.7367],
  'las-pinas': [120.9921, 14.4506],
  makati: [121.022, 14.5586],
  malabon: [120.9605, 14.6613],
  mandaluyong: [121.033, 14.5803],
  manila: [120.9995, 14.6022],
  marikina: [121.1017, 14.6496],
  muntinlupa: [121.0462, 14.4015],
  navotas: [120.9463, 14.6584],
  paranaque: [121.0129, 14.4854],
  pasay: [120.9994, 14.5482],
  pasig: [121.0871, 14.5671],
  pateros: [121.0675, 14.5429],
  'quezon-city': [121.0579, 14.6892],
  'san-juan': [121.0268, 14.6042],
  taguig: [121.0573, 14.5155],
  valenzuela: [120.9863, 14.7101],
  /* Falls back to the middle of Metro Manila. */
  other: [120.9842, 14.5995],
};

