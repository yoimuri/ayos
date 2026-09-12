import { Text, View } from 'react-native';

/**
 * Icons drawn from plain Views and text glyphs.
 *
 * WHY NOT AN ICON LIBRARY: `@expo/vector-icons` and `react-native-svg` are both absent,
 * and adding either means a new APK rather than an over-the-air update. These are built
 * from primitives that already exist, so they ship free.
 *
 * Replace this file with a real icon set in the same build that adds MapLibre. Nothing
 * outside it needs to change.
 */

/**
 * A gear. A ring with eight teeth rotated around it.
 *
 * Drawn rather than typed: the ⚙ character renders as a colour emoji on many Android
 * builds, which cannot be tinted to match the theme and looks foreign next to the rest
 * of the interface.
 */
export function GearIcon({ size = 24, color }: { size?: number; color: string }) {
  const ring = size * 0.56;
  const toothW = size * 0.13;
  const toothH = size * 0.2;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {Array.from({ length: 8 }, (_, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            width: toothW,
            height: size * 0.92,
            transform: [{ rotate: `${i * 22.5}deg` }],
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View style={{ width: toothW, height: toothH, backgroundColor: color, borderRadius: 1 }} />
          <View style={{ width: toothW, height: toothH, backgroundColor: color, borderRadius: 1 }} />
        </View>
      ))}

      {/* The ring sits on top of the teeth, hiding their inner ends. */}
      <View
        style={{
          width: ring,
          height: ring,
          borderRadius: ring / 2,
          borderWidth: size * 0.11,
          borderColor: color,
        }}
      />
    </View>
  );
}

/**
 * Contact: a handset with an envelope tucked behind its upper right.
 *
 * ONE MARK, not two icons. The earlier version set a handset and an envelope apart with
 * a slash between them, which read as two separate buttons crammed into one circle. The
 * convention everywhere else — and in every reference for this — is that the two shapes
 * OVERLAP into a single silhouette, so the eye reads "contact" rather than "call, or,
 * message".
 *
 * `bg` is the colour behind the icon. The envelope is ringed in it so the overlap stays
 * legible: without that ring the envelope's outline merges into the handset beneath it
 * and the whole thing turns to mush at 20px.
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
  const handset = size * 0.66;

  const envW = size * 0.52;
  const envH = envW * 0.7;
  const ring = Math.max(1.5, size * 0.05);
  const border = Math.max(1.2, size * 0.045);

  /* Flap: two bars from the top corners meeting in the middle. */
  const half = envW / 2 - border;
  const drop = envH * 0.42;
  const flapLen = Math.sqrt(half * half + drop * drop);
  const flapAngle = (Math.atan2(drop, half) * 180) / Math.PI;

  return (
    <View style={{ width: size, height: size }}>
      {/* Handset, lower left, carrying most of the mark's weight. */}
      <Text
        style={{
          position: 'absolute',
          left: -size * 0.04,
          bottom: -size * 0.06,
          fontSize: handset,
          lineHeight: handset * 1.05,
          color,
        }}
      >
        ✆
      </Text>

      {/* Envelope, upper right, ringed in the background so the overlap reads. */}
      <View
        style={{
          position: 'absolute',
          right: -size * 0.02,
          top: -size * 0.02,
          width: envW + ring * 2,
          height: envH + ring * 2,
          borderRadius: size * 0.06,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            width: envW,
            height: envH,
            borderWidth: border,
            borderColor: color,
            borderRadius: size * 0.04,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              position: 'absolute',
              left: border,
              top: border * 0.4,
              width: flapLen,
              height: border,
              backgroundColor: color,
              transform: [{ rotate: `${flapAngle}deg` }],
            }}
          />
          <View
            style={{
              position: 'absolute',
              right: border,
              top: border * 0.4,
              width: flapLen,
              height: border,
              backgroundColor: color,
              transform: [{ rotate: `${-flapAngle}deg` }],
            }}
          />
        </View>
      </View>
    </View>
  );
}
