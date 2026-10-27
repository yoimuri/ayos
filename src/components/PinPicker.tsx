import { Camera, GeoJSONSource, Layer, Map as MapView, ViewAnnotation, type CameraRef } from '@maplibre/maplibre-react-native';
import { useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { METRO_MANILA, STYLE_URL } from '@/components/RealMap';
import type { Shop } from '@/lib/data/types';
import { locationText } from '@/lib/fieldwork/model';
import { useSettings } from '@/lib/settings/store';

/**
 * PUT THE PIN ON THE SHOP (field survey mode).
 *
 * GPS near buildings is often 10 to 40 m out, which is the wrong side of the street. So
 * the pin starts where the phone thinks it is, and the surveyor corrects it by eye:
 * pinch to zoom in, then hold the pin and drag it onto the shop's entrance. Tapping the
 * map also moves the pin there, for when a drag is fiddly.
 *
 * The other shops are drawn with their names, so a shop that is already listed is
 * spotted before it is added twice.
 */

type Point = { lat: number; lng: number };

/* Close enough to tell one shopfront from the next. The tiles overzoom to 20. */
const START_ZOOM = 18;
/* Names only where they can be read, as on the main map. */
const NAMES_FROM_ZOOM = 16;

export function PinPicker({
  initial,
  rider,
  shops,
  onDone,
  onCancel,
}: {
  initial: Point;
  /** The phone's position, [longitude, latitude], drawn as a dot for reference. */
  rider: [number, number] | null;
  shops: Shop[];
  onDone: (p: Point) => void;
  onCancel: () => void;
}) {
  const { theme, mapTheme } = useSettings();
  const s = styles(theme);
  const camera = useRef<CameraRef>(null);
  const [pin, setPin] = useState<Point>(initial);
  /*
    Where the pin is DURING a drag, for the coordinate readout only. The pin's own
    position is set when the finger lifts: handing the map a new position on every
    movement would fight the drag the map itself is running.
  */
  const [live, setLive] = useState<Point | null>(null);
  const shown = live ?? pin;

  const shopPoints = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: shops.map((shop) => ({
        type: 'Feature' as const,
        properties: { name: shop.name },
        geometry: { type: 'Point' as const, coordinates: [shop.lng, shop.lat] },
      })),
    }),
    [shops],
  );
  const riderPoint = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: rider
        ? [{ type: 'Feature' as const, properties: {}, geometry: { type: 'Point' as const, coordinates: rider } }]
        : [],
    }),
    [rider],
  );

  return (
    <View style={s.wrap}>
      <MapView
        style={s.map}
        mapStyle={STYLE_URL}
        attribution={false}
        logo={false}
        touchRotate={false}
        /* A tap moves the pin there: the fallback when dragging is fiddly. */
        onPress={(e) => {
          const [lng, lat] = e.nativeEvent.lngLat;
          setPin({ lat, lng });
        }}
      >
        <Camera
          ref={camera}
          initialViewState={{ center: [initial.lng, initial.lat], zoom: START_ZOOM }}
          maxBounds={METRO_MANILA}
          minZoom={10}
          maxZoom={20}
        />

        <GeoJSONSource id="picker-shops" data={shopPoints}>
          <Layer
            key="picker-shop-dot"
            id="picker-shop-dot"
            type="circle"
            paint={{
              'circle-color': mapTheme.accent,
              'circle-radius': 6,
              'circle-stroke-width': 2,
              'circle-stroke-color': mapTheme.onFilled,
            }}
          />
          <Layer
            key="picker-shop-name"
            id="picker-shop-name"
            type="symbol"
            minzoom={NAMES_FROM_ZOOM}
            layout={{
              'text-field': ['get', 'name'],
              'text-font': ['Noto Sans Bold'],
              'text-size': 12,
              'text-offset': [0, 1.2],
              'text-anchor': 'top',
              'text-optional': true,
            }}
            paint={{ 'text-color': mapTheme.ink, 'text-halo-color': mapTheme.surface, 'text-halo-width': 1.5 }}
          />
        </GeoJSONSource>

        <GeoJSONSource id="picker-rider" data={riderPoint}>
          <Layer
            key="picker-rider-dot"
            id="picker-rider-dot"
            type="circle"
            paint={{
              'circle-color': mapTheme.ink,
              'circle-radius': 7,
              'circle-stroke-width': 3,
              'circle-stroke-color': mapTheme.onFilled,
            }}
          />
        </GeoJSONSource>

        {/*
          THE PIN. Hold it, then drag. `anchor="bottom"` puts the pin's tip, not its
          middle, on the coordinate, so the tip is what goes on the entrance.
        */}
        <ViewAnnotation
          id="survey-pin"
          lngLat={[pin.lng, pin.lat]}
          anchor="bottom"
          draggable
          onDrag={(e) => {
            const [lng, lat] = e.nativeEvent.lngLat;
            setLive({ lat, lng });
          }}
          onDragEnd={(e) => {
            const [lng, lat] = e.nativeEvent.lngLat;
            setLive(null);
            setPin({ lat, lng });
          }}
        >
          <View style={s.pin} collapsable={false}>
            <View style={[s.pinHead, { backgroundColor: mapTheme.call, borderColor: mapTheme.onFilled }]}>
              <View style={[s.pinDot, { backgroundColor: mapTheme.onFilled }]} />
            </View>
            <View style={[s.pinStem, { backgroundColor: mapTheme.call }]} />
          </View>
        </ViewAnnotation>
      </MapView>

      <View style={s.panel}>
        <Text style={s.hint}>
          Pinch to zoom in. Hold the pin and drag it onto the shop’s entrance, or tap the map to move it there.
        </Text>
        <Text style={s.coords} selectable>
          {locationText(shown.lat, shown.lng)}
        </Text>
        {rider && (
          <Pressable
            onPress={() => {
              setPin({ lat: rider[1], lng: rider[0] });
              camera.current?.flyTo({ center: rider, zoom: START_ZOOM, duration: 600 });
            }}
            hitSlop={8}
            accessibilityRole="button"
          >
            <Text style={s.link}>Put the pin where I am</Text>
          </Pressable>
        )}
        <View style={s.buttons}>
          <Pressable onPress={onCancel} style={({ pressed }) => [s.secondary, pressed && s.pressed]} accessibilityRole="button">
            <Text style={s.secondaryText}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={() => onDone(pin)}
            style={({ pressed }) => [s.primary, pressed && s.pressed]}
            accessibilityRole="button"
          >
            <Text style={s.primaryText}>Use this spot</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = (theme: ReturnType<typeof useSettings>['theme']) =>
  StyleSheet.create({
    wrap: { flex: 1, backgroundColor: theme.bg },
    map: { flex: 1 },
    pin: { alignItems: 'center', width: 44, height: 58 },
    pinHead: {
      width: 40,
      height: 40,
      borderRadius: 20,
      borderWidth: 3,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pinDot: { width: 12, height: 12, borderRadius: 6 },
    pinStem: { width: 4, height: 18, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 },
    panel: {
      padding: 16,
      gap: 10,
      backgroundColor: theme.surface,
      borderTopWidth: 1,
      borderTopColor: theme.line,
    },
    hint: { fontSize: 14, color: theme.ink2, lineHeight: 20 },
    coords: { fontSize: 16, fontWeight: '700', color: theme.ink, fontVariant: ['tabular-nums'] },
    link: { fontSize: 15, fontWeight: '700', color: theme.call },
    buttons: { flexDirection: 'row', gap: 10 },
    primary: {
      flex: 2,
      minHeight: 52,
      borderRadius: 13,
      backgroundColor: theme.call,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryText: { fontSize: 17, fontWeight: '700', color: theme.onFilled },
    secondary: {
      flex: 1,
      minHeight: 52,
      borderRadius: 13,
      borderWidth: 1.5,
      borderColor: theme.line,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryText: { fontSize: 16, fontWeight: '700', color: theme.ink },
    pressed: { opacity: 0.6 },
  });
