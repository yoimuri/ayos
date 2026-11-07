import type { Ride } from './catalog';
import { ADDONS, DEFAULT_RIDE, helmetKey } from './catalog';
import { HELMET_LAYERS, LAYERS, RIDE_ART_VERSION, type LayerPics } from './layers.generated';

/**
 * A RIDE AS A STACK OF PICTURES, bottom to top: the bike in its paint, the rider's outfit,
 * the exhaust, the top box, the helmet, then the add-ons. Each layer was rendered with
 * whatever can stand in front of it cut out (render.py, build_layer), so drawing them in
 * this order gives the same picture as one render of the whole ride. The helmet goes ABOVE
 * the top box: seen from the front the box sits just behind the head, and the head is the
 * highest thing on the bike, so nothing should ever be drawn over it but a camera on it.
 *
 * `name` is unique per picture set. The helmet is shared by every vehicle, so it says where it
 * goes on this one (`helmet`): `map[view]` or `top` picture pixels on the map's pictures, and
 * its small crop at `turn.at[view]` on the turntable.
 *
 * The turntable and the small previews draw this stack live. The map draws one finished picture
 * made from it when the rider saves (pictures.ts).
 */
export type StackLayer = {
  name: string;
  pics: LayerPics;
  helmet?: {
    map: [number, number][];
    top: [number, number];
    turn: { at: [number, number][]; w: number; h: number };
  };
};

export function stackFor(r: Ride): StackLayer[] {
  const v = LAYERS[r.vehicle];
  const hk = helmetKey(r);
  const out: StackLayer[] = [
    { name: `${r.vehicle}-paint-${r.paint}`, pics: v.paint[r.paint] },
    { name: `${r.vehicle}-outfit-${r.outfit}`, pics: v.outfit[r.outfit] },
    { name: `${r.vehicle}-pipe-${r.pipe}`, pics: v.pipe[r.pipe] },
  ];
  if (r.topbox !== 'none') out.push({ name: `${r.vehicle}-topbox-${r.topbox}`, pics: v.topbox[r.topbox] });
  out.push({
    name: `helmet-${hk}`,
    pics: HELMET_LAYERS[hk] ?? HELMET_LAYERS['full-rust'],
    helmet: { map: v.helmetMap, top: v.helmetTop, turn: v.helmetTurn },
  });
  /* In the catalog's order, not the order they were tapped, so the same parts are the same ride. */
  for (const a of ADDONS) if (r.addons.includes(a.id)) out.push({ name: `${r.vehicle}-addon-${a.id}`, pics: v.addon[a.id] });
  return out;
}

const DEFAULT_LOOK = stackFor(DEFAULT_RIDE)
  .map((l) => l.name)
  .join('.');

/**
 * What a ride's finished pictures are called. Same parts, same name. Size is not in it: S, M and
 * L are the same pictures drawn bigger or smaller. The art version is, so new art rebuilds them.
 * The default ride ships ready-made, so it has a fixed name.
 */
export function lookKey(stack: StackLayer[]): string {
  const look = stack.map((l) => l.name).join('.');
  return look === DEFAULT_LOOK ? 'ride-default' : `ride-${RIDE_ART_VERSION}-${look}`;
}
