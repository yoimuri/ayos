import { unzlibSync, zlibSync } from 'fflate';

/**
 * BUILD ON SAVE: the pixel work. Puts a ride's parts together into finished pictures for the map.
 *
 * WHY THE PHONE DOES THIS. An over-the-air update may carry at most 1000 files, and the map
 * can only show a whole picture file, so shipping every part as 9 map pictures cost 1,035
 * files. Each part now ships as one sheet of its 9 pictures, and when the rider saves, this
 * paints their parts on top of each other and writes 9 PNG files the map can use. The map then
 * draws ONE layer for the rider instead of one per part.
 *
 * PLAIN JAVASCRIPT, NO DRAWING LIBRARY (5 Nov). Reading and writing a PNG is unzipping, a little
 * arithmetic per pixel, and zipping, and `fflate` was already in the app. react-native-skia
 * would have added a native library for something this small.
 *
 * NOTHING HERE TOUCHES THE PHONE, so tests/compose.test.ts runs it against the real sheets.
 */

/** Pictures in a map sheet: 8 views round the bike, then one from straight above. */
export const MAP_TILES = 9;
export const MAP_COLS = 3;
export const TILE_PX = 240;
/** The tile with the view from straight above. */
export const TOP_TILE = 8;

export type Pixels = { width: number; height: number; rgba: Uint8Array };
/** Where a layer sits per tile, in pixels. Only the shared helmet moves (stack.ts). */
export type Offsets = readonly (readonly [number, number])[];

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

function u32(b: Uint8Array, at: number): number {
  return ((b[at] << 24) | (b[at + 1] << 16) | (b[at + 2] << 8) | b[at + 3]) >>> 0;
}

/**
 * Any non-interlaced 8-bit-or-less PNG to straight RGBA.
 *
 * NOT ONLY THE PALETTE KIND app_export.py writes: a picture built into an APK can be
 * recompressed by the Android build ("crunching"), which is free to change the colour type and
 * the filters. In an over-the-air update it arrives untouched. Both must decode the same.
 */
export function decodePng(file: Uint8Array): Pixels {
  for (let i = 0; i < 8; i += 1) if (file[i] !== SIGNATURE[i]) throw new Error('not a PNG');
  let width = 0;
  let height = 0;
  let depth = 0;
  let colour = 0;
  let palette: Uint8Array | null = null;
  let alphas: Uint8Array | null = null;
  const parts: Uint8Array[] = [];
  let size = 0;
  for (let at = 8; at + 8 <= file.length; ) {
    const length = u32(file, at);
    const type = String.fromCharCode(file[at + 4], file[at + 5], file[at + 6], file[at + 7]);
    const body = at + 8;
    if (type === 'IHDR') {
      width = u32(file, body);
      height = u32(file, body + 4);
      depth = file[body + 8];
      colour = file[body + 9];
      if (file[body + 12] !== 0) throw new Error('interlaced PNG');
      if (depth > 8) throw new Error('16-bit PNG');
    } else if (type === 'PLTE') palette = file.subarray(body, body + length);
    else if (type === 'tRNS') alphas = file.subarray(body, body + length);
    else if (type === 'IDAT') {
      parts.push(file.subarray(body, body + length));
      size += length;
    } else if (type === 'IEND') break;
    at = body + length + 4;
  }
  const zipped = new Uint8Array(size);
  let filled = 0;
  for (const p of parts) {
    zipped.set(p, filled);
    filled += p.length;
  }

  const samples = colour === 2 ? 3 : colour === 4 ? 2 : colour === 6 ? 4 : 1;
  const bpp = Math.max(1, (samples * depth) >> 3);
  const stride = (width * samples * depth + 7) >> 3;
  const raw = unzlibSync(zipped, { out: new Uint8Array((stride + 1) * height) });

  /* Undo the PNG row filters, in place, so each row is its real bytes. */
  for (let y = 0; y < height; y += 1) {
    const row = y * (stride + 1) + 1;
    const up = row - stride - 1;
    const filter = raw[row - 1];
    if (filter === 0) continue;
    for (let i = 0; i < stride; i += 1) {
      const a = i >= bpp ? raw[row + i - bpp] : 0;
      const b = y > 0 ? raw[up + i] : 0;
      let add: number;
      if (filter === 1) add = a;
      else if (filter === 2) add = b;
      else if (filter === 3) add = (a + b) >> 1;
      else {
        const c = i >= bpp && y > 0 ? raw[up + i - bpp] : 0;
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        add = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      raw[row + i] = (raw[row + i] + add) & 255;
    }
  }

  const rgba = new Uint8Array(width * height * 4);
  const top = (1 << depth) - 1;
  const grey = 255 / top;
  for (let y = 0; y < height; y += 1) {
    const row = y * (stride + 1) + 1;
    for (let x = 0; x < width; x += 1) {
      const o = (y * width + x) * 4;
      if (colour === 3 || colour === 0) {
        const v = depth === 8 ? raw[row + x] : (raw[row + ((x * depth) >> 3)] >> (8 - depth - ((x * depth) & 7))) & top;
        if (colour === 3) {
          const k = v * 3;
          rgba[o] = palette ? palette[k] : 0;
          rgba[o + 1] = palette ? palette[k + 1] : 0;
          rgba[o + 2] = palette ? palette[k + 2] : 0;
          rgba[o + 3] = alphas && v < alphas.length ? alphas[v] : 255;
        } else {
          rgba[o] = rgba[o + 1] = rgba[o + 2] = v * grey;
          rgba[o + 3] = 255;
        }
      } else if (colour === 2) {
        const k = row + x * 3;
        rgba[o] = raw[k];
        rgba[o + 1] = raw[k + 1];
        rgba[o + 2] = raw[k + 2];
        rgba[o + 3] = 255;
      } else if (colour === 4) {
        const k = row + x * 2;
        rgba[o] = rgba[o + 1] = rgba[o + 2] = raw[k];
        rgba[o + 3] = raw[k + 1];
      } else {
        const k = row + x * 4;
        rgba[o] = raw[k];
        rgba[o + 1] = raw[k + 1];
        rgba[o + 2] = raw[k + 2];
        rgba[o + 3] = raw[k + 3];
      }
    }
  }
  return { width, height, rgba };
}

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function chunk(out: Uint8Array, at: number, type: string, body: Uint8Array): number {
  const put = (v: number, p: number) => {
    out[p] = v >>> 24;
    out[p + 1] = (v >>> 16) & 255;
    out[p + 2] = (v >>> 8) & 255;
    out[p + 3] = v & 255;
  };
  put(body.length, at);
  for (let i = 0; i < 4; i += 1) out[at + 4 + i] = type.charCodeAt(i);
  out.set(body, at + 8);
  let crc = -1;
  for (let i = at + 4; i < at + 8 + body.length; i += 1) crc = CRC_TABLE[(crc ^ out[i]) & 255] ^ (crc >>> 8);
  put((crc ^ -1) >>> 0, at + 8 + body.length);
  return at + 12 + body.length;
}

/**
 * Straight RGBA to a PNG file. No row filter and the fastest zip level: these are small and
 * mostly see-through, and packing was the slowest step of a build (timed 5 Nov).
 */
export function encodePng({ width, height, rgba }: Pixels): Uint8Array {
  const stride = width * 4;
  const raw = new Uint8Array((stride + 1) * height);
  for (let y = 0; y < height; y += 1) raw.set(rgba.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  const zipped = zlibSync(raw, { level: 1 });
  const head = new Uint8Array(13);
  head[0] = width >>> 24;
  head[1] = (width >>> 16) & 255;
  head[2] = (width >>> 8) & 255;
  head[3] = width & 255;
  head[4] = height >>> 24;
  head[5] = (height >>> 16) & 255;
  head[6] = (height >>> 8) & 255;
  head[7] = height & 255;
  head[8] = 8;
  head[9] = 6;
  const out = new Uint8Array(8 + 25 + 12 + zipped.length + 12);
  out.set(SIGNATURE, 0);
  let at = chunk(out, 8, 'IHDR', head);
  at = chunk(out, at, 'IDAT', zipped);
  chunk(out, at, 'IEND', new Uint8Array(0));
  return out;
}

/** Nine empty pictures to paint on. */
export function blankTiles(): Pixels[] {
  return Array.from({ length: MAP_TILES }, () => ({
    width: TILE_PX,
    height: TILE_PX,
    rgba: new Uint8Array(TILE_PX * TILE_PX * 4),
  }));
}

/**
 * Paints one layer's sheet over the pictures so far, tile by tile. `offsets` moves the layer
 * within each picture; anything moved past the picture's edge is cut off. "Over" is the
 * standard see-through sum, on colours that are not pre-multiplied by alpha.
 */
export function paintLayer(tiles: Pixels[], sheet: Pixels, offsets?: Offsets): void {
  const rows = Math.ceil(MAP_TILES / MAP_COLS);
  if (sheet.width !== TILE_PX * MAP_COLS || sheet.height !== TILE_PX * rows) throw new Error('unexpected sheet size');
  const src = sheet.rgba;
  for (let t = 0; t < MAP_TILES; t += 1) {
    const dest = tiles[t].rgba;
    const originX = (t % MAP_COLS) * TILE_PX;
    const originY = Math.floor(t / MAP_COLS) * TILE_PX;
    const dx = offsets ? offsets[t][0] : 0;
    const dy = offsets ? offsets[t][1] : 0;
    for (let y = 0; y < TILE_PX; y += 1) {
      const ty = y + dy;
      if (ty < 0 || ty >= TILE_PX) continue;
      let s = ((originY + y) * sheet.width + originX) * 4;
      let d = (ty * TILE_PX + dx) * 4;
      for (let x = 0; x < TILE_PX; x += 1, s += 4, d += 4) {
        const sa = src[s + 3];
        /* Most of a sheet is empty, so this is the line that makes it fast. */
        if (sa === 0) continue;
        const tx = x + dx;
        if (tx < 0 || tx >= TILE_PX) continue;
        const da = dest[d + 3];
        if (sa === 255 || da === 0) {
          dest[d] = src[s];
          dest[d + 1] = src[s + 1];
          dest[d + 2] = src[s + 2];
          dest[d + 3] = sa;
          continue;
        }
        const keep = (da * (255 - sa)) / 255;
        const out = sa + keep;
        dest[d] = (src[s] * sa + dest[d] * keep) / out + 0.5;
        dest[d + 1] = (src[s + 1] * sa + dest[d + 1] * keep) / out + 0.5;
        dest[d + 2] = (src[s + 2] * sa + dest[d + 2] * keep) / out + 0.5;
        dest[d + 3] = out + 0.5;
      }
    }
  }
}
