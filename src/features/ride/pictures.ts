import { Asset } from 'expo-asset';
import { Directory, File, Paths } from 'expo-file-system';
import { useEffect, useMemo, useState } from 'react';

import type { Ride } from './catalog';
import { blankTiles, decodePng, encodePng, MAP_TILES, paintLayer, TOP_TILE } from './compose';
import { DEFAULT_PICTURES } from './layers.generated';
import { lookKey, stackFor, type StackLayer } from './stack';

/**
 * BUILD ON SAVE: the map's rider pictures, on this phone.
 *
 * Saving a ride starts a build: each part's map sheet is read, painted on top of the others
 * (compose.ts), and the 9 finished pictures are saved under the ride's name. The map keeps
 * showing the last finished bike until the new one is ready, so a rider never waits or sees an
 * empty spot. On a later launch the saved pictures are simply used. The default ride ships
 * ready-made and needs no build.
 *
 * A DONE FILE IS WRITTEN LAST. An app killed halfway leaves a folder with no done file, which
 * counts as not built and is built again on the next launch. If a build fails, the bike the
 * map already has stays, and the next launch tries again.
 */

export type RidePictures = {
  /** The ride's name; each picture is `<key>-m<view>` or `<key>-top` on the map. */
  key: string;
  /** What to hand to the map's `Images`: a file address, or a picture in the app. */
  images: Record<string, string | number>;
};

const tileName = (key: string, tile: number) => (tile === TOP_TILE ? `${key}-top` : `${key}-m${tile}`);

const DEFAULT_KEY = 'ride-default';
const DEFAULT_SET: RidePictures = {
  key: DEFAULT_KEY,
  images: Object.fromEntries(DEFAULT_PICTURES.map((source, tile) => [tileName(DEFAULT_KEY, tile), source])),
};

const rootDir = () => new Directory(Paths.document, 'ride-pictures');

/** The finished pictures for this name, if a whole set is on the phone. */
function finished(key: string): RidePictures | null {
  if (key === DEFAULT_KEY) return DEFAULT_SET;
  try {
    const dir = new Directory(rootDir(), key);
    if (!new File(dir, 'done').exists) return null;
    const images: Record<string, string> = {};
    for (let tile = 0; tile < MAP_TILES; tile += 1) images[tileName(key, tile)] = new File(dir, `${tile}.png`).uri;
    return { key, images };
  } catch {
    return null;
  }
}

/** Lets the phone get on with touches and drawing between the heavy steps. */
const breather = () => new Promise<void>((done) => setTimeout(done, 0));

/** The helmet's place in each of the 9 pictures: 8 views, then from above. */
function offsetsOf(layer: StackLayer) {
  return layer.helmet ? [...layer.helmet.map, layer.helmet.top] : undefined;
}

/** Null if a newer ride was saved while this one was building. */
async function build(stack: StackLayer[], key: string, stopped: () => boolean): Promise<RidePictures | null> {
  const tiles = blankTiles();
  for (const layer of stack) {
    if (stopped()) return null;
    /* Works for a picture inside the APK and for one that came in an update: it gives a real file either way. */
    const asset = await Asset.fromModule(layer.pics.map).downloadAsync();
    if (!asset.localUri) throw new Error(`no file for ${layer.name}`);
    const bytes = await new File(asset.localUri).bytes();
    await breather();
    const sheet = decodePng(bytes);
    await breather();
    paintLayer(tiles, sheet, offsetsOf(layer));
    await breather();
  }
  const root = rootDir();
  const dir = new Directory(root, key);
  dir.create({ intermediates: true, idempotent: true });
  for (let tile = 0; tile < MAP_TILES; tile += 1) {
    if (stopped()) return null;
    new File(dir, `${tile}.png`).write(encodePng(tiles[tile]));
    await breather();
  }
  new File(dir, 'done').write('ok');
  /* One ride at a time on the phone: the others can be built again in seconds. */
  for (const entry of root.list()) {
    if (entry instanceof Directory && entry.name !== key) entry.delete();
  }
  return finished(key);
}

/**
 * The pictures to draw the rider with. `on` is false in Graphics: Light, where the rider is a
 * plain dot and nothing is built.
 */
export function useRidePictures(ride: Ride, on: boolean): RidePictures {
  const stack = useMemo(() => stackFor(ride), [ride]);
  const key = lookKey(stack);
  /* Already on the phone, so it can be used in this very frame. */
  const ready = useMemo(() => (on ? finished(key) : null), [key, on]);
  /* The last finished bike, shown while a new one builds. */
  const [last, setLast] = useState<RidePictures>(DEFAULT_SET);
  if (ready && ready.key !== last.key) setLast(ready);

  useEffect(() => {
    if (!on || ready) return;
    let stop = false;
    build(stack, key, () => stop)
      .then((made) => {
        if (made && !stop) setLast(made);
      })
      .catch((e) => console.warn('Could not build the ride pictures', e));
    return () => {
      stop = true;
    };
  }, [key, on, ready, stack]);

  return ready ?? last;
}
