import { Platform, StyleSheet, Text, View, type TextStyle } from 'react-native';

/**
 * The icon set, drawn from a bundled icon font.
 *
 * THESE ARE THE SHAPES FROM THE DESIGN CANVAS, not approximations of them. The canvas
 * draws each icon as an SVG path — a curved telephone handset, a speech bubble, a map
 * pin, an envelope. React Native cannot render a path without `react-native-svg`, which
 * carries native code and therefore needs a new APK. An icon FONT reaches the same
 * shapes through a mechanism the build already has.
 *
 * WHERE THE GLYPHS COME FROM. `assets/fonts/AyosIcons.ttf` is Material Icons, subset to
 * the five glyphs this app uses. The full family is 348 KB; subset it is 1.6 KB. That
 * matters because the file rides along on every over-the-air update, so its size is a
 * recurring cost rather than a one-off — the same reasoning that took the wordmark from
 * about 200 KB to 14. Generated with fonttools, exactly as the wordmark was.
 *
 * TO ADD A GLYPH you must re-subset the font; a codepoint that is not in the file
 * renders as a blank box. The source family and the subset command are in
 * docs/DECISIONS.md.
 *
 * THIS IS NOT THE SAME THING AS TYPING ✆ OR ✉, and the distinction is the whole point.
 * Those resolve against whatever font the handset happens to ship, which is why ✆ arrived
 * ringed in a circle on the test device and ✉ arrived with a cross through it. This font
 * is bundled with the app, so every device renders the identical shape. Determinism is
 * what was missing, not drawing.
 */

/** Codepoints present in AyosIcons.ttf. Anything else renders as a blank box. */
const GLYPH = {
  /** Curved telephone handset, filled. The canvas uses this shape for Call. */
  call: '',
  /** Speech bubble, outlined. The canvas uses this shape for Message. */
  chat: '',
  /** Map pin with a hole. The canvas uses this shape for Directions. */
  pin: '',
  /** Envelope, outlined, with a V flap. */
  mail: '',
  /** Gear. */
  gear: '',
} as const;

/**
 * One glyph, sized and coloured.
 *
 * `includeFontPadding` is an Android-only property and must be switched off here: Android
 * reserves extra vertical room above and below a line for ascenders and descenders, which
 * on a square icon glyph shows up as the icon sitting slightly high inside its box.
 */
function Glyph({
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

export function PhoneIcon({ size = 24, color }: { size?: number; color: string }) {
  return <Glyph char={GLYPH.call} size={size} color={color} />;
}

export function MailIcon({ size = 24, color }: { size?: number; color: string }) {
  return <Glyph char={GLYPH.mail} size={size} color={color} />;
}

export function ChatIcon({ size = 24, color }: { size?: number; color: string }) {
  return <Glyph char={GLYPH.chat} size={size} color={color} />;
}

/**
 * A map pin. The canvas uses a pin for Directions, not an arrow.
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
 * ONE MARK, not two icons. This is the canvas construction, proportion for proportion:
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

/* Kept so a caller can align a glyph optically without reaching for magic numbers. */
export const iconStyles = StyleSheet.create({
  centred: { textAlign: 'center' },
});
