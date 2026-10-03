/**
 * WCAG contrast ratio between two colours, from 1 (identical) to 21 (black on white).
 *
 * PLAIN TYPESCRIPT, NO IMPORTS, so tests/contrast.test.ts can run it with `node --test`.
 * That test is what "contrast-checked" means for the palettes: every text and control
 * pair in every palette, in both modes, measured rather than judged by eye.
 *
 * The thresholds the test holds them to are WCAG 2.2 AA: 4.5 for normal text, 3 for
 * large text and for the edges of controls and map markers.
 */

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** "#B4442A" or "rgb(242,243,240)" -> relative luminance, 0 (black) to 1 (white). */
export function luminance(colour: string): number {
  let r: number, g: number, b: number;
  const hex = /^#([0-9a-f]{6})$/i.exec(colour);
  const rgb = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/i.exec(colour);
  if (hex) {
    const n = parseInt(hex[1], 16);
    [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  } else if (rgb) {
    [r, g, b] = [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  } else {
    throw new Error(`Not a solid colour: ${colour}`);
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
