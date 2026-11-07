import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { crc32, deflateSync } from 'node:zlib';

import { blankTiles, decodePng, encodePng, paintLayer, TILE_PX, type Pixels } from '../src/features/ride/compose.ts';

const asset = (rel: string) => new Uint8Array(readFileSync(new URL(`../assets/ride/${rel}`, import.meta.url)));

/** The biggest difference in any colour or alpha, counting only pixels that can be seen. */
function worstDifference(a: Pixels, b: Pixels): number {
  let worst = 0;
  for (let i = 0; i < a.rgba.length; i += 4) {
    if (a.rgba[i + 3] === 0 && b.rgba[i + 3] === 0) continue;
    worst = Math.max(worst, Math.abs(a.rgba[i + 3] - b.rgba[i + 3]));
    if (a.rgba[i + 3] > 8) {
      for (let k = 0; k < 3; k += 1) worst = Math.max(worst, Math.abs(a.rgba[i + k] - b.rgba[i + k]));
    }
  }
  return worst;
}

test('the default ride put together here matches the one the export script put together', () => {
  const tiles = blankTiles();
  for (const part of ['scooter/paint_rust', 'scooter/outfit_plain', 'scooter/pipe_stock', 'helmet/full-rust']) {
    paintLayer(tiles, decodePng(asset(`${part}/map.png`)));
  }
  const names = ['m0', 'm1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'top'];
  names.forEach((name, i) => {
    const expected = decodePng(asset(`default/${name}.png`));
    /* Two programs round differently, by a step or two out of 255; a wrong picture is far off. */
    assert.ok(worstDifference(tiles[i], expected) <= 3, name);
  });
});

test('a finished picture survives being written to a PNG and read back, exactly', () => {
  const tiles = blankTiles();
  paintLayer(tiles, decodePng(asset('scooter/paint_gold/map.png')));
  const back = decodePng(encodePng(tiles[3]));
  assert.equal(back.width, TILE_PX);
  assert.deepEqual(back.rgba, tiles[3].rgba);
});

test('solid paint covers what is under it; see-through paint mixes', () => {
  const sheet = (r: number, a: number): Pixels => {
    const rgba = new Uint8Array(720 * 720 * 4);
    rgba[0] = r;
    rgba[3] = a;
    return { width: 720, height: 720, rgba };
  };
  const tiles = blankTiles();
  paintLayer(tiles, sheet(200, 255));
  assert.deepEqual([...tiles[0].rgba.subarray(0, 4)], [200, 0, 0, 255]);
  paintLayer(tiles, sheet(100, 128));
  assert.ok(Math.abs(tiles[0].rgba[0] - 150) <= 1);
  assert.equal(tiles[0].rgba[3], 255);
});

test('the helmet is moved by its offset, and what falls past the edge is cut off', () => {
  const rgba = new Uint8Array(720 * 720 * 4);
  rgba[(5 * 720 + 5) * 4 + 3] = 255;
  rgba[(0 * 720 + 0) * 4 + 3] = 255;
  const tiles = blankTiles();
  const offsets = Array.from({ length: 9 }, () => [3, -2] as const);
  paintLayer(tiles, { width: 720, height: 720, rgba }, offsets);
  assert.equal(tiles[0].rgba[(3 * TILE_PX + 8) * 4 + 3], 255);
  /* The pixel at the very top moved 2 up, out of the picture, and must not wrap round. */
  const painted = tiles[0].rgba.reduce((n, v, i) => (i % 4 === 3 && v > 0 ? n + 1 : n), 0);
  assert.equal(painted, 1);
});

/** A real PNG file from raw rows, each row already starting with its filter byte. */
function pngFile(width: number, height: number, depth: number, colour: number, rows: number[], palette?: number[]): Uint8Array {
  const chunk = (type: string, body: Buffer) => {
    const head = Buffer.alloc(4);
    head.writeUInt32BE(body.length);
    const typed = Buffer.concat([Buffer.from(type, 'latin1'), body]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(typed));
    return Buffer.concat([head, typed, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = depth;
  ihdr[9] = colour;
  return new Uint8Array(
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk('IHDR', ihdr),
      ...(palette ? [chunk('PLTE', Buffer.from(palette))] : []),
      chunk('IDAT', deflateSync(Buffer.from(rows))),
      chunk('IEND', Buffer.alloc(0)),
    ]),
  );
}

test('every PNG row filter decodes: the Android build can rewrite a picture to use them', () => {
  /* Two RGBA pixels per row, five rows, one per filter. Row 0 of the output is [10,20,30,40, 50,60,70,80]. */
  const want = [
    [10, 20, 30, 40, 50, 60, 70, 80],
    [11, 22, 33, 44, 55, 66, 77, 88],
    [12, 24, 36, 48, 60, 72, 84, 96],
    [13, 26, 39, 52, 65, 78, 91, 104],
    [14, 28, 42, 56, 70, 84, 98, 112],
  ];
  const paeth = (a: number, b: number, c: number) => {
    const p = a + b - c;
    const [pa, pb, pc] = [Math.abs(p - a), Math.abs(p - b), Math.abs(p - c)];
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  const rows: number[] = [];
  want.forEach((row, y) => {
    /* The filter number is the row number: none, Sub, Up, Average, Paeth. */
    rows.push(y);
    row.forEach((v, i) => {
      const a = i >= 4 ? row[i - 4] : 0;
      const b = y > 0 ? want[y - 1][i] : 0;
      const c = i >= 4 && y > 0 ? want[y - 1][i - 4] : 0;
      const guess = [0, a, b, (a + b) >> 1, paeth(a, b, c)][y];
      rows.push((v - guess + 256) & 255);
    });
  });
  const { rgba } = decodePng(pngFile(2, 5, 8, 6, rows));
  assert.deepEqual([...rgba], want.flat());
});

test('a small-palette PNG packs several pixels into a byte, and decodes', () => {
  /* Four pixels, 2 bits each: colours 0, 1, 2, 3 in one byte. */
  const { rgba } = decodePng(pngFile(4, 1, 2, 3, [0, 0b00011011], [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]));
  assert.deepEqual([...rgba], [1, 2, 3, 255, 4, 5, 6, 255, 7, 8, 9, 255, 10, 11, 12, 255]);
});

test('a broken file is refused rather than drawn as garbage', () => {
  assert.throws(() => decodePng(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9])));
});
