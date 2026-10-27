import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { EMPTY_PERSONAL, parsePersonal, toggleId, type PersonalData, type RatingParts } from './model';

/**
 * MY SHOPS, saved on this phone: the shops the rider saved, visited and rated.
 *
 * Same storage as the settings (AsyncStorage, already in the app), under its own key so
 * the two can never overwrite each other. Survives app updates; lost on uninstall.
 */

const KEY = 'ayos.personal.v1';

type PersonalApi = {
  data: PersonalData;
  isSaved: (shopId: string) => boolean;
  isVisited: (shopId: string) => boolean;
  toggleSaved: (shopId: string) => void;
  toggleVisited: (shopId: string) => void;
  /** The rider's own rating of a shop, or undefined. */
  ratingOf: (shopId: string) => (RatingParts & { at: number }) | undefined;
  rate: (shopId: string, parts: RatingParts) => void;
};

const PersonalContext = createContext<PersonalApi | null>(null);

export function PersonalProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<PersonalData>(EMPTY_PERSONAL);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => setData(parsePersonal(raw)))
      .catch(() => {});
  }, []);

  /* Every change is written straight away; a failed write loses only that one change. */
  const change = useCallback((fn: (d: PersonalData) => PersonalData) => {
    setData((d) => {
      const next = fn(d);
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const api = useMemo<PersonalApi>(
    () => ({
      data,
      isSaved: (id) => data.saved.includes(id),
      isVisited: (id) => data.visited.includes(id),
      toggleSaved: (id) => change((d) => ({ ...d, saved: toggleId(d.saved, id) })),
      toggleVisited: (id) => change((d) => ({ ...d, visited: toggleId(d.visited, id) })),
      ratingOf: (id) => data.ratings[id],
      rate: (id, parts) => change((d) => ({ ...d, ratings: { ...d.ratings, [id]: { ...parts, at: Date.now() } } })),
    }),
    [data, change],
  );

  return <PersonalContext.Provider value={api}>{children}</PersonalContext.Provider>;
}

export function usePersonal(): PersonalApi {
  const v = useContext(PersonalContext);
  if (!v) throw new Error('usePersonal must be used inside <PersonalProvider>');
  return v;
}
