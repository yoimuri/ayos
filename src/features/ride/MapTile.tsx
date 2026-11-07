import { Image, View, type StyleProp, type ViewStyle } from 'react-native';

import { MAP_COLS } from '@/features/ride/compose';

/**
 * One picture out of a layer's map sheet (3 across, 3 down). The box is one tile big and clips;
 * the whole sheet sits behind it, moved so the wanted tile lands in the box.
 */
export function MapTile({
  sheet,
  tile,
  size,
  style,
}: {
  sheet: number;
  tile: number;
  size: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ width: size, height: size, overflow: 'hidden' }, style]}>
      <Image
        source={sheet}
        fadeDuration={0}
        style={{
          position: 'absolute',
          width: size * MAP_COLS,
          height: size * MAP_COLS,
          left: -(tile % MAP_COLS) * size,
          top: -Math.floor(tile / MAP_COLS) * size,
        }}
      />
    </View>
  );
}
