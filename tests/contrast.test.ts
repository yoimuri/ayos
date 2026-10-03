/**
 * Every palette, both modes, measured. RUN:  npm test
 *
 * 4.5 is WCAG AA for normal text. 3 is AA for large text and for the edge of a control
 * or a map marker. A palette that fails here is unreadable for someone, somewhere, in
 * sunlight — which is where this app gets used.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { contrast } from '../src/lib/theme/contrast.ts';
import { MAP_LAND, MAP_WATER, PALETTES, type Theme } from '../src/lib/theme/tokens.ts';

/** [text, background] pairs as the screens actually draw them. */
const TEXT_PAIRS: [keyof Theme, keyof Theme][] = [
  ['ink', 'bg'],
  ['ink', 'surface'],
  ['ink2', 'bg'],
  ['ink2', 'surface'],
  ['ink3', 'bg'],
  ['ink3', 'surface'],
  ['bandInk', 'bandBg'],
  ['bandInk2', 'bandBg'],
  ['onFilled', 'call'],
  ['call', 'bg'],
  ['call', 'surface'],
  ['call', 'callFill'],
  ['accent', 'accentFill'],
  ['accent', 'surface'],
  ['open', 'openFill'],
  ['alert', 'alertFill'],
];

for (const [palette, modes] of Object.entries(PALETTES)) {
  for (const [mode, theme] of Object.entries(modes)) {
    test(`${palette} ${mode}: text is readable`, () => {
      for (const [fg, bg] of TEXT_PAIRS) {
        const ratio = contrast(theme[fg], theme[bg]);
        assert.ok(ratio >= 4.5, `${fg} on ${bg} is ${ratio.toFixed(2)}:1, needs 4.5`);
      }
    });
  }

  /*
    THE MAP IS ALWAYS THE LIGHT STYLE, so everything drawn on it uses the palette's LIGHT
    colours whatever mode the app is in. This test is the regression guard for a dark
    mode bug: the selected pin was drawn in dark mode's `ink` (#EDE8E0),
    which measured 1.09:1 against the map — invisible.
  */
  test(`${palette}: map markers stand out on the map`, () => {
    const t = modes.light;
    for (const ground of [MAP_LAND, MAP_WATER]) {
      assert.ok(contrast(t.accent, ground) >= 3, `pin ${t.accent} on ${ground}`);
      assert.ok(contrast(t.ink, ground) >= 3, `selected pin ${t.ink} on ${ground}`);
    }
    assert.ok(contrast(t.onFilled, t.accent) >= 4.5, 'cluster count on its circle');
  });
}
