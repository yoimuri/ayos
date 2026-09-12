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
  ink3: '#8A827B',

  bandBg: '#B4442A',
  bandInk: '#FFFFFF',
  bandInk2: '#F0C4B7',
  bandChip: 'rgba(255,255,255,0.18)',

  accent: '#B4442A',
  accentFill: '#F6E4DD',
  call: '#B4442A',
  callFill: '#F6E4DD',
  open: '#2F7A52',
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
  ink3: '#7E766D',

  /* The band goes dark and the wordmark takes the brand colour. See the type above. */
  bandBg: '#1C1A16',
  bandInk: '#D9694B',
  bandInk2: '#7E766D',
  bandChip: 'rgba(255,255,255,0.07)',

  accent: '#D9694B',
  accentFill: '#3A211A',
  call: '#D9694B',
  callFill: '#3A211A',
  open: '#4FAE7C',
  openFill: '#12301F',
  alert: '#E86B60',
  alertFill: '#351815',
  star: '#E8A72B',
  onFilled: '#14120F',
};

export const THEMES: Record<ThemeName, Theme> = { light: LIGHT, dark: DARK };
