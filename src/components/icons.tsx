import { Platform, Text, View, type TextStyle } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

/**
 * The icon set, drawn from a bundled icon font.
 *
 * WHY A FONT: the designs draw each icon as an SVG path (a curved telephone handset, a
 * speech bubble, a map pin, an envelope). React Native cannot render a path without
 * `react-native-svg`, which carries native code and therefore needs a new APK. An icon
 * FONT reaches the same shapes through a mechanism the build already has.
 *
 * WHERE THE GLYPHS COME FROM. `assets/fonts/AyosIcons.ttf` is Material Icons, subset to
 * the fifteen glyphs this app uses. The full family is 348 KB; subset it is about 2 KB. That
 * matters because the file rides along on every over-the-air update, so its size is a
 * recurring cost rather than a one-off — the same reasoning that took the wordmark from
 * about 200 KB to 14. Generated with fonttools, exactly as the wordmark was.
 *
 * TO ADD A GLYPH you must re-subset the font; a codepoint that is not in the file
 * renders as a blank box. Source: Google's Material Icons,
 * github.com/google/material-design-icons/raw/master/font/MaterialIcons-Regular.ttf.
 * Command (add the new code point to the list):
 *
 *   python -m fontTools.subset MaterialIcons-Regular.ttf --layout-features="" --no-hinting
 *     --unicodes="U+E0B0,U+E0CB,U+E0E1,U+E55C,U+E55F,U+E88F,U+E8B8,U+E8FF,U+E5CF,U+E5CE,U+E8B6,U+E866,U+E867,U+E86C,U+E3C9"
 *     --output-file=assets/fonts/AyosIcons.ttf
 *
 * THIS IS NOT THE SAME THING AS TYPING ✆ OR ✉, and the distinction is the whole point.
 * Those resolve against whatever font the handset happens to ship, which is why ✆ arrived
 * ringed in a circle on the test device and ✉ arrived with a cross through it. This font
 * is bundled with the app, so every device renders the identical shape. Determinism is
 * what was missing, not drawing.
 */

/**
 * Codepoints present in AyosIcons.ttf. Anything else renders as a blank box.
 *
 * Exported so a caller can name the mark it wants. These are private-use characters: in
 * source they are INVISIBLE, so pasting one into a file leaves something nobody can read,
 * search for, or safely edit. Referencing `GLYPH.pin` keeps it greppable.
 */
export const GLYPH = {
  /** Curved telephone handset, filled: Call. */
  call: '',
  /** Speech bubble, outlined: Message. */
  chat: '',
  /** Map pin with a hole: Directions. */
  pin: '',
  /** Envelope, outlined, with a V flap. */
  mail: '',
  /** Gear. */
  gear: '',
  /** Crosshair with a centre dot: "put me back in the middle". */
  crosshair: '',
  /** Outlined i in a circle: "there is small print behind this". */
  info: '',
  /** Magnifier with a plus: "show me closer". Written as an escape so it is readable here. */
  zoomIn: '\uE8FF',
  /** Down-pointing chevron: "this opens". Settings groups, the search toggle. */
  expandMore: '\uE5CF',
  /** Up-pointing chevron: "this closes". */
  expandLess: '\uE5CE',
  /** Magnifier: search. */
  search: '\uE8B6',
  /** Bookmark, filled: saved. */
  saved: '\uE866',
  /** Bookmark, outlined: not saved. */
  save: '\uE867',
  /** Check in a circle: visited. */
  visited: '\uE86C',
  /** Pencil: edit (field survey mode). */
  edit: '\uE3C9',
} as const;

/**
 * One glyph, sized and coloured.
 *
 * `includeFontPadding` is an Android-only property and must be switched off here: Android
 * reserves extra vertical room above and below a line for ascenders and descenders, which
 * on a square icon glyph shows up as the icon sitting slightly high inside its box.
 */
/**
 * Exported so the map can draw a glyph directly.
 *
 * The selected-shop pin needs the same mark twice at two sizes to fake an outline, which
 * the named wrappers below cannot express.
 */
export function Glyph({
  char,
  size,
  color,
  style,
}: {
  char: string;
  size: number;
  color: string;
  style?: TextStyle;
}) {
  return (
    <Text
      allowFontScaling={false}
      style={[
        {
          fontFamily: 'AyosIcons',
          fontSize: size,
          lineHeight: size,
          color,
          ...Platform.select({ android: { includeFontPadding: false } }),
        },
        style,
      ]}
    >
      {char}
    </Text>
  );
}

export function GearIcon({ size = 24, color }: { size?: number; color: string }) {
  return <Glyph char={GLYPH.gear} size={size} color={color} />;
}

/** Small print behind a small button. */
export function InfoIcon({ size = 24, color }: { size?: number; color: string }) {
  return <Glyph char={GLYPH.info} size={size} color={color} />;
}

/** Open (down) or close (up), for anything that folds away. */
export function ExpandIcon({ open, size = 24, color }: { open: boolean; size?: number; color: string }) {
  return <Glyph char={open ? GLYPH.expandLess : GLYPH.expandMore} size={size} color={color} />;
}

export function SavedIcon({ on, size = 24, color }: { on: boolean; size?: number; color: string }) {
  return <Glyph char={on ? GLYPH.saved : GLYPH.save} size={size} color={color} />;
}

export function VisitedIcon({ size = 24, color }: { size?: number; color: string }) {
  return <Glyph char={GLYPH.visited} size={size} color={color} />;
}

export function EditIcon({ size = 24, color }: { size?: number; color: string }) {
  return <Glyph char={GLYPH.edit} size={size} color={color} />;
}

export function SearchIcon({ size = 24, color }: { size?: number; color: string }) {
  return <Glyph char={GLYPH.search} size={size} color={color} />;
}

/** The locate button. A crosshair means "aim at me", which is exactly the request. */
export function CrosshairIcon({ size = 24, color }: { size?: number; color: string }) {
  return <Glyph char={GLYPH.crosshair} size={size} color={color} />;
}

export function PhoneIcon({ size = 24, color }: { size?: number; color: string }) {
  return <Glyph char={GLYPH.call} size={size} color={color} />;
}

export function ChatIcon({ size = 24, color }: { size?: number; color: string }) {
  return <Glyph char={GLYPH.chat} size={size} color={color} />;
}

/**
 * A map pin for Directions, not an arrow.
 *
 * The distinction is worth keeping: an arrow points, a pin marks a place. This button
 * hands the rider off to their map app to find somewhere, so a pin is the honest shape.
 */
export function NavIcon({ size = 24, color }: { size?: number; color: string }) {
  return <Glyph char={GLYPH.pin} size={size} color={color} />;
}

/**
 * Contact: a handset with an envelope tucked over its upper right.
 *
 * ONE MARK, not two icons:
 * the handset carries the weight from the lower left, and the envelope sits over its
 * upper right on a small block of the background colour, so the two outlines never merge
 * into mush at 26px.
 *
 * IT ONLY WORKS BECAUSE THE HANDSET IS A THIN CURVE. An earlier attempt drew the phone as
 * a solid rounded rectangle, and the background block then covered its whole right side
 * and left a bracket behind. The overlap is not the fragile part — a solid shape
 * underneath it is.
 *
 * `bg` is the colour behind the icon, which the block is painted in.
 */
export function ContactIcon({
  size = 40,
  color,
  bg,
}: {
  size?: number;
  color: string;
  bg: string;
}) {
  return (
    <View style={{ width: size, height: size }}>
      <Glyph
        char={GLYPH.call}
        size={size * 0.82}
        color={color}
        style={{ position: 'absolute', left: 0, bottom: 0 }}
      />
      <View
        style={{
          position: 'absolute',
          right: -size * 0.02,
          top: -size * 0.02,
          paddingHorizontal: size * 0.04,
          paddingVertical: size * 0.03,
          borderRadius: size * 0.1,
          backgroundColor: bg,
        }}
      >
        <Glyph char={GLYPH.mail} size={size * 0.5} color={color} />
      </View>
    </View>
  );
}

/*
  THE MAP MODE ICONS, drawn with react-native-svg (in the APK from 1.2.0, so these two are
  not font glyphs). A cube while the map is 3D; a flat square while it is 2D.
*/
export function CubeIcon({ size = 24, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round">
      <Path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" />
      <Path d="M4 7.5l8 4.5 8-4.5M12 12v9" />
    </Svg>
  );
}

/**
 * The locate button while the map turns with the phone (compass mode): a navigation arrow,
 * the shape Google Maps uses for the same mode, so riders already know it.
 */
export function CompassIcon({ size = 24, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke={color} strokeWidth={1.5} strokeLinejoin="round">
      <Path d="M12 3l7 17-7-4-7 4z" />
    </Svg>
  );
}

/**
 * The compass button's needle: red half to north, grey half to south, the mark Google Maps
 * uses. Drawn pointing up; the button turns it against the map's turn.
 */
export function NeedleIcon({ size = 24 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 2.5l4 9.5H8z" fill="#D93B2B" />
      <Path d="M12 21.5l-4-9.5h8z" fill="#B9B4AE" />
    </Svg>
  );
}

/** The update card's mark: two turning arrows around a tick, "new version, ready". */
export function UpdateIcon({ size = 24, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M20 11a8 8 0 0 0-14.3-4.6M4 13a8 8 0 0 0 14.3 4.6" />
      <Path d="M5.2 2.8v3.8H9M18.8 21.2v-3.8H15" />
      <Path d="M8.6 12.2l2.3 2.3 4.5-4.6" />
    </Svg>
  );
}

/** Share: three linked dots, Android's own share mark. */
export function ShareIcon({ size = 24, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
      <Path d="M8.6 10.7l6.8-3.9M8.6 13.3l6.8 3.9" />
      <Path d="M18 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM6 9.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM18 15.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z" />
    </Svg>
  );
}

/**
 * MAP ONLY: four corners pointing out ("show me the whole screen"), and pointing in while
 * the controls are hidden ("bring them back"). The marks phones use for full screen video.
 */
export function MapOnlyIcon({ on, size = 24, color }: { on: boolean; size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {on ? (
        <Path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
      ) : (
        <Path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
      )}
    </Svg>
  );
}

export function SquareIcon({ size = 24, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round">
      <Rect x={4.5} y={4.5} width={15} height={15} rx={2.2} />
    </Svg>
  );
}
