/**
 * Colour tokens, light and dark.
 *
 * Nothing in a screen file should ever write a raw hex value. Screens ask for
 * `theme.call` and get the right colour for whichever mode the rider chose, so a
 * palette change happens here once instead of in thirty places. This file is the
 * reason the whole brand could be swapped in one edit.
 *
 * PALETTE: oxide. The red-brown of the primer that goes on bare metal before anything
 * else — a colour every mechanic has seen on a frame. Chosen because Grab owns bright
 * green and Lalamove owns orange, and the previous palette used a green close to one
 * and an amber inside the other, so the app read as a mix of two apps the rider
 * already had rather than as itself.
 */

export type ThemeName = 'light' | 'dark';

export type Theme = {
  /** Page background. */
  bg: string;
  /** Cards, sheets, bars: anything sitting on top of `bg`. */
  surface: string;
  /** The map placeholder fill and its street lines. */
  mapBg: string;
  mapLine: string;
  /** Dividers. `line` separates sections, `lineSoft` separates list rows. */
  line: string;
  lineSoft: string;
  /** Text. ink is primary, ink2 secondary, ink3 the quietest label. */
  ink: string;
  ink2: string;
  ink3: string;

  /**
   * The brand band at the top of every screen, and the text that sits on it.
   *
   * These are the one pair that does NOT simply lighten between themes. In light, the
   * band IS the brand colour and its text is white. In dark, the band becomes a dark
   * surface and the BRAND COLOUR MOVES TO THE TEXT — because a bright band on a dark
   * app glares, and lifting oxide far enough to survive on black turns it salmon.
   */
  bandBg: string;
  bandInk: string;
  /** Quieter text on the band: the area label, the saved-count line. */
  bandInk2: string;
  /** Translucent chips sitting on the band. */
  bandChip: string;

  /** The oxide itself, for controls and emphasis. Brand colour on a control, always. */
  accent: string;
  accentFill: string;
  /**
   * The search field's fill.
   *
   * Its own token because it cannot be `surface`: in dark mode `surface` and `bandBg`
   * are the same hex, so the field disappeared into the band it sits on at 1.00:1.
   */
  searchBg: string;
  /** Primary actions: Call, Send. Same oxide, named for its job. */
  call: string;
  callFill: string;
  /** Green. ONLY for "Open". It is semantic, not brand. */
  open: string;
  openFill: string;
  /** Red. Real problems only — no connection, blocked action. Never "Closed". */
  alert: string;
  alertFill: string;
  /** Rating stars. Gold in both themes, because gold is semantic, not brand. */
  star: string;
  /** Text drawn on top of a filled `call` button. */
  onFilled: string;
};

export const LIGHT: Theme = {
  bg: '#FAF7F2',
  surface: '#FFFFFF',
  mapBg: '#F0EBE2',
  mapLine: '#E0D8CC',
  line: '#DFD8CE',
  lineSoft: '#EBE5DC',
  ink: '#191716',
  ink2: '#57514C',
  /* Was #8A827B at 3.53:1 on bg, under the 4.5 small text needs. */
  ink3: '#6E6760',

  bandBg: '#B4442A',
  bandInk: '#FFFFFF',
  /* Was #F0C4B7 at 3.50:1. */
  bandInk2: '#FBE3DB',
  bandChip: 'rgba(255,255,255,0.18)',

  accent: '#B4442A',
  /* Lightened from #F6E4DD so oxide text on it clears 4.5 (was 4.49). */
  accentFill: '#F9EDE8',
  /* White on oxide, 5.52:1. */
  searchBg: '#FFFFFF',
  call: '#B4442A',
  callFill: '#F9EDE8',
  /* Darkened from #2F7A52: "Open" on its pill was 4.35:1. */
  open: '#2A6E49',
  openFill: '#DCEFE3',
  alert: '#A8321F',
  alertFill: '#F7E3E1',
  star: '#D99100',
  onFilled: '#FFFFFF',
};

/**
 * Dark is not an inversion.
 *
 * The oxide is lifted and desaturated because a red tuned against bone vibrates
 * against near-black and loses contrast the other way. Each pair was picked against
 * its own background rather than derived from the light one.
 */
export const DARK: Theme = {
  bg: '#14120F',
  surface: '#1C1A16',
  mapBg: '#1F1C18',
  mapLine: '#2C2823',
  line: '#332F29',
  lineSoft: '#272320',
  ink: '#EDE8E0',
  ink2: '#A79E94',
  /* Was #7E766D at 3.89:1 on surface. */
  ink3: '#8C847A',

  /* The band goes dark and the wordmark takes the brand colour. See the type above. */
  bandBg: '#1C1A16',
  bandInk: '#D9694B',
  bandInk2: '#8C847A',
  bandChip: 'rgba(255,255,255,0.07)',

  accent: '#D9694B',
  /* Darkened from #3A211A: oxide text on it was 4.30:1. */
  accentFill: '#2E1A14',
  /* Darker than the band, so the field reads as a well cut into it. */
  searchBg: '#14120F',
  call: '#D9694B',
  callFill: '#2E1A14',
  open: '#4FAE7C',
  openFill: '#12301F',
  alert: '#E86B60',
  alertFill: '#351815',
  star: '#E8A72B',
  onFilled: '#14120F',
};

/**
 * TWO CANDIDATE PALETTES, to compare on a real phone.
 *
 * Blue is the brand in both: the band and the Call button. The second colour is the
 * accent — the map pins, the rider, the search circle, highlighted rows.
 *
 * Every pair here is held to WCAG AA by tests/contrast.test.ts, which is the difference
 * between "looks fine on my screen" and "readable in glare on a cheap phone".
 *
 * GOLD HAS A COST IN LIGHT MODE. Bright gold on white measures about 2:1 as text, which
 * nobody can read in sunlight. So light-mode "gold" is a deep bronze (#8A6100, 4.97:1 on
 * the map); the bright gold appears in dark mode, where it has the contrast to earn it.
 */
export const BLUE_BROWN_LIGHT: Theme = {
  bg: '#F7F5F1',
  surface: '#FFFFFF',
  mapBg: '#EEEAE4',
  mapLine: '#DDD6CC',
  line: '#DCD5CB',
  lineSoft: '#E9E4DC',
  ink: '#1A1714',
  ink2: '#524A43',
  ink3: '#6B625A',
  bandBg: '#1E4A85',
  bandInk: '#FFFFFF',
  bandInk2: '#D3DFF0',
  bandChip: 'rgba(255,255,255,0.18)',
  accent: '#7A4A24',
  accentFill: '#F3E9E0',
  searchBg: '#FFFFFF',
  call: '#1E4A85',
  callFill: '#E6EDF7',
  open: '#2A6E49',
  openFill: '#DCEFE3',
  alert: '#A8321F',
  alertFill: '#F7E3E1',
  star: '#D99100',
  onFilled: '#FFFFFF',
};

export const BLUE_BROWN_DARK: Theme = {
  bg: '#111418',
  surface: '#191D23',
  mapBg: '#1C2027',
  mapLine: '#2A3039',
  line: '#2E343D',
  lineSoft: '#232830',
  ink: '#E8ECF1',
  ink2: '#A3ACB8',
  ink3: '#8A93A0',
  bandBg: '#191D23',
  bandInk: '#86ABE3',
  bandInk2: '#8A93A0',
  bandChip: 'rgba(255,255,255,0.07)',
  accent: '#CD9A6C',
  accentFill: '#2E2219',
  searchBg: '#111418',
  call: '#86ABE3',
  callFill: '#1A2638',
  open: '#4FAE7C',
  openFill: '#12301F',
  alert: '#E86B60',
  alertFill: '#351815',
  star: '#E8A72B',
  onFilled: '#111418',
};

export const BLUE_GOLD_LIGHT: Theme = {
  bg: '#F6F6F3',
  surface: '#FFFFFF',
  mapBg: '#ECEDE8',
  mapLine: '#DADCD5',
  line: '#D9DBD4',
  lineSoft: '#E7E8E3',
  ink: '#16181B',
  ink2: '#4B5058',
  ink3: '#646A73',
  bandBg: '#1E4A85',
  bandInk: '#FFFFFF',
  bandInk2: '#D3DFF0',
  bandChip: 'rgba(255,255,255,0.18)',
  accent: '#8A6100',
  accentFill: '#FBF2DC',
  searchBg: '#FFFFFF',
  call: '#1E4A85',
  callFill: '#E6EDF7',
  open: '#2A6E49',
  openFill: '#DCEFE3',
  alert: '#A8321F',
  alertFill: '#F7E3E1',
  star: '#D99100',
  onFilled: '#FFFFFF',
};

export const BLUE_GOLD_DARK: Theme = {
  bg: '#101317',
  surface: '#181C22',
  mapBg: '#1B1F26',
  mapLine: '#293038',
  line: '#2D333C',
  lineSoft: '#22272E',
  ink: '#E9ECF0',
  ink2: '#A4ACB7',
  ink3: '#8A929E',
  bandBg: '#181C22',
  bandInk: '#E3B341',
  bandInk2: '#8A929E',
  bandChip: 'rgba(255,255,255,0.07)',
  accent: '#E3B341',
  accentFill: '#302610',
  searchBg: '#101317',
  call: '#86ABE3',
  callFill: '#1A2638',
  open: '#4FAE7C',
  openFill: '#12301F',
  alert: '#E86B60',
  alertFill: '#351815',
  star: '#E8A72B',
  onFilled: '#101317',
};

export type PaletteName = 'oxide' | 'blue-brown' | 'blue-gold';

export const PALETTES: Record<PaletteName, Record<ThemeName, Theme>> = {
  oxide: { light: LIGHT, dark: DARK },
  'blue-brown': { light: BLUE_BROWN_LIGHT, dark: BLUE_BROWN_DARK },
  'blue-gold': { light: BLUE_GOLD_LIGHT, dark: BLUE_GOLD_DARK },
};

export const PALETTE_LABELS: Record<PaletteName, string> = {
  oxide: 'Oxide (current)',
  'blue-brown': 'Blue + brown',
  'blue-gold': 'Blue + gold',
};

/**
 * The map's own background, read from the OpenFreeMap `positron` style on 30 Sep 2026.
 * Land is rgb(242,243,240); water, the darkest large area, is rgb(194,200,202).
 * Anything drawn on the map must stand out against both — see tests/contrast.test.ts.
 */
export const MAP_LAND = '#F2F3F0';
export const MAP_WATER = '#C2C8CA';
