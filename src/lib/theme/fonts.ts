/**
 * The wordmark face.
 *
 * `AyosWordmark.ttf` is Archivo, pinned to the two axis values the design specifies:
 * width 115 (expanded) and weight 560. It was generated from the variable font rather
 * than shipped as one, because React Native has no way to set variable-font axes at
 * runtime — a variable file would render at its default instance, which is regular
 * weight and normal width, and the wordmark would look nothing like the design.
 *
 * Subset to basic Latin, so it is 14 KB rather than 200 KB. It rides along on every
 * over-the-air update, so its size is a recurring cost, not a one-off.
 *
 * NO REBUILD NEEDED to add this: `expo-font` is already compiled into the APK, and a
 * font file is an asset. Assets ship with `eas update`.
 */
export const WORDMARK = 'AyosWordmark';
