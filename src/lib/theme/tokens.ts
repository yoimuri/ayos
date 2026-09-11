/**
 * Colour tokens for Direction D, light and dark.
 *
 * Nothing in a screen file should ever write a raw hex value. Screens ask for
 * `theme.call` and get the right colour for whichever mode the rider chose, so a
 * palette change happens here once instead of in thirty places.
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
  /** The amber accent. Used for the radius ring and the staleness state, nothing else. */
  accent: string;
  accentFill: string;
  /** Green. Reserved for contact actions and the offline-ready line. */
  call: string;
  callFill: string;
  /** Red. Closed shops and blocked actions only. */
  alert: string;
  alertFill: string;
  /** Text drawn on top of a filled `call` or `ink` button. */
  onFilled: string;
};

export const LIGHT: Theme = {
  bg: '#FFFFFF',
  surface: '#FFFFFF',
  mapBg: '#F1F2EE',
  mapLine: '#E2E5DE',
  line: '#DADED5',
  lineSoft: '#E6E9E2',
  ink: '#12161C',
  ink2: '#555E64',
  ink3: '#7C858B',
  accent: '#C9700A',
  accentFill: '#FBEFDC',
  call: '#0B6E45',
  callFill: '#DFF0E7',
  alert: '#A82A21',
  alertFill: '#F7E3E1',
  onFilled: '#FFFFFF',
};

/**
 * Dark is not an inversion of light.
 *
 * The accent and the green are both lifted and desaturated, because a colour tuned
 * for white will vibrate against a dark ground and fail contrast in the other
 * direction. Each pair was chosen against its own background.
 */
export const DARK: Theme = {
  bg: '#101417',
  surface: '#191E22',
  mapBg: '#1A1F23',
  mapLine: '#272D31',
  line: '#2C3338',
  lineSoft: '#242A2F',
  ink: '#E9EDE6',
  ink2: '#9EA8A4',
  ink3: '#77817E',
  accent: '#F0A340',
  accentFill: '#33260F',
  call: '#3DB380',
  callFill: '#11301F',
  alert: '#E86B60',
  alertFill: '#351815',
  onFilled: '#101417',
};

export const THEMES: Record<ThemeName, Theme> = { light: LIGHT, dark: DARK };
