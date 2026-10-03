import {
  Camera,
  GeoJSONSource,
  Images,
  Layer,
  /*
    ALIASED, because `Map` is also a JavaScript builtin. Imported under its own name it
    shadows it inside this file, and `new Map()` then tries to construct a React
    component — which fails in a way that names neither the cause nor the fix.
  */
  Map as MapView,
  type CameraRef,
  type GeoJSONSourceRef,
} from '@maplibre/maplibre-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { CrosshairIcon, InfoIcon, ZoomInIcon } from '@/components/icons';
import { useTour, useTourTarget } from '@/components/Tour';

import type { Shop } from '@/lib/data/types';
import { DETOUR_FACTOR } from '@/lib/geo/distance';
import { busyUntil, shouldFollow } from '@/lib/map/follow';
import { AREA_CENTRES, useSettings } from '@/lib/settings/store';

/**
 * THE MAP. Vector tiles, actual geography, panning and zooming.
 *
 * ALWAYS A LIGHT MAP, in both app modes, and so everything drawn ON it takes its colours
 * from `mapTheme` — the palette's light variant — never from `theme`. Mixing the two was
 * the dark-mode bug: the selected pin took dark mode's near-white ink and vanished at
 * 1.09:1 against the map. The buttons floating over the map are ordinary views on the
 * app's surface, so those keep `theme`.
 *
 * THIS FILE CANNOT RUN ON THE OLD APK. `@maplibre/maplibre-react-native` is native code,
 * so it only exists in builds from version 1.1.0 onward. That is why `version` in app.json
 * was bumped before this was written: `runtimeVersion` follows `appVersion`, so an update
 * carrying this file is only ever offered to a build that can run it.
 *
 * WHO MOVES THE CAMERA. Exactly three things, and nothing else:
 *
 *   - the first position fix, once, so the map opens where the rider actually is;
 *   - the recentre button;
 *   - tapping a shop, which flies to that shop.
 *
 * Everything else leaves it alone. An earlier version passed a fresh `initialViewState`
 * object on every render, and React Native re-sends a prop whose object identity changed
 * even when the values inside are the same — so every unrelated re-render, including
 * changing the radius, snapped the camera back. That is why the radius chips appeared to
 * be the focus control: they were the only thing moving the camera.
 */

/**
 * Free vector tiles, no API key, no request limit.
 *
 * `positron` is the muted grey style rather than the colourful one, because the map is a
 * background: the oxide pins have to be the loudest thing on it.
 */
const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';

/**
 * OpenStreetMap's licence requires visible credit, and this style ships no `attribution`
 * field in its sources, so MapLibre's own attribution control has nothing to display.
 * Drawing it here is a licence term, not decoration.
 */
const ATTRIBUTION = '© OpenStreetMap contributors · OpenFreeMap';
const OSM_COPYRIGHT = 'https://www.openstreetmap.org/copyright';

/**
 * The font for cluster counts MUST be one the tile style actually serves, because the
 * glyphs are fetched from the style's own endpoint. `positron` ships Noto Sans in
 * Regular, Italic and Bold; anything else renders as nothing at all.
 */
const LABEL_FONT = ['Noto Sans Bold'];

/**
 * Beyond this zoom, shops stop being grouped and each one is drawn separately.
 * 15 is roughly street level, which is the point at which "there are 12 shops around
 * here" stops being the useful answer and "that one, there" starts.
 */
const CLUSTER_MAX_ZOOM = 15;
/** Screen pixels. Two shops closer together than this on screen become one circle. */
const CLUSTER_RADIUS_PX = 58;

/**
 * The edge of the world, as far as this app is concerned: [west, south, east, north].
 *
 * Taken from the surveyed data's own extent (lat 14.35-14.78, lng 120.93-121.13) with
 * roughly six kilometres of margin, so a rider standing at the outermost shop can still
 * pan far enough to see where they are going.
 */
const METRO_MANILA: [number, number, number, number] = [120.87, 14.30, 121.19, 14.84];

/**
 * Everywhere that is not Metro Manila, as one polygon.
 *
 * The outer ring is the whole world; the inner ring is the region, and a second ring in a
 * GeoJSON polygon is a hole. Filling this covers every part of the map except the area
 * the app actually has data for.
 */
const OUTSIDE_METRO_MANILA: GeoJSON.Feature = {
  type: 'Feature',
  properties: {},
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [-180, -85],
        [180, -85],
        [180, 85],
        [-180, 85],
        [-180, -85],
      ],
      [
        [METRO_MANILA[0], METRO_MANILA[1]],
        [METRO_MANILA[2], METRO_MANILA[1]],
        [METRO_MANILA[2], METRO_MANILA[3]],
        [METRO_MANILA[0], METRO_MANILA[3]],
        [METRO_MANILA[0], METRO_MANILA[1]],
      ],
    ],
  },
};

/**
 * A circle of `radiusM` metres around a point, as GeoJSON.
 *
 * MAP GEOMETRY, NOT A SCREEN CIRCLE. Drawn as a view it would be a fixed number of pixels
 * and would claim a different real-world size at every zoom level, which for a search
 * radius is worse than drawing nothing. As a polygon in real coordinates it grows and
 * shrinks with the map on its own.
 */
function circleAround([lng, lat]: [number, number], radiusM: number): GeoJSON.Feature {
  const points = 64;
  const dLat = radiusM / 111320;
  const dLng = radiusM / (111320 * Math.cos((lat * Math.PI) / 180));
  const ring: [number, number][] = [];
  for (let i = 0; i <= points; i += 1) {
    const a = (i / points) * 2 * Math.PI;
    ring.push([lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)]);
  }
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } };
}

/**
 * The rider's glow, outermost first. Diameters in dp against cumulative opacity.
 *
 * Deliberately more rings than look necessary: fewer and larger steps band visibly into
 * rings rather than blending into a glow.
 */
const AURA = [
  { size: 68, opacity: 0.07 },
  { size: 58, opacity: 0.09 },
  { size: 49, opacity: 0.11 },
  { size: 41, opacity: 0.14 },
  { size: 34, opacity: 0.18 },
];

/**
 * Registered once, at module scope, and never rebuilt.
 *
 * All three are white silhouettes marked `sdf`, so the map treats them as shapes to
 * colour rather than pictures: one file each serves both themes, and symbol layers can
 * give them a halo, which React Native cannot do to a shape at all.
 */
const MAP_IMAGES = {
  'shop-pin': { source: require('../../assets/images/shop-pin.png'), sdf: true },
  'rider-moto': { source: require('../../assets/images/rider-moto.png'), sdf: true },
  'rider-detail': { source: require('../../assets/images/rider-detail.png'), sdf: true },
  'rider-cone': { source: require('../../assets/images/rider-cone.png'), sdf: true },
};

/** Stable hitboxes, for the same reason the images are stable. */
/**
 * How big the rider is drawn, as a fraction of the 256px source.
 *
 * ONE CONSTANT FOR BOTH LAYERS. The bike and the rider detail are separate images drawn
 * on top of one another; if their sizes drift apart the helmet slides off the shoulders.
 */
const RIDER_SIZE = 0.14;

const HITBOX_SMALL = { top: 12, bottom: 12, left: 12, right: 12 };
const HITBOX_LARGE = { top: 14, bottom: 14, left: 14, right: 14 };

/**
 * Close enough to read street names, wide enough to keep a few shops in frame.
 *
 * `RIDER_ZOOM` is used ONLY for the opening view, when the first position fix arrives and
 * there is no rider preference to preserve. Recentring afterwards deliberately sets no
 * zoom at all.
 */
const SHOP_ZOOM = 15.5;
const RIDER_ZOOM = 14.5;

/**
 * "Zoom to me" lands here: one level past `CLUSTER_MAX_ZOOM`, the first zoom at which the
 * map stops grouping shops at all, so every shop around the rider is its own pin instead
 * of a numbered circle. About 800 m across on a phone, which is a few blocks each way.
 */
const MEET_ZOOM = CLUSTER_MAX_ZOOM + 1;



export function RealMap({
  shops,
  onPressPin,
  /**
   * The shop the rider just tapped in the list. The map flies to it.
   * Carries a `nonce` so tapping the SAME shop twice still moves the camera back.
   */
  focus,
  /** Where the visual centre sits vertically, 0 to 1. Lifted when the sheet covers the bottom. */
  centerBias = 0.5,
  /** False when the device has no connection, so a map that never loaded can say why. */
  online = true,
  /**
   * Where the rider is, [longitude, latitude], or null if that is genuinely unknown.
   *
   * PASSED IN, NOT FETCHED HERE. Permission has exactly one owner — `useLocationGate` on
   * the home screen — because two things asking independently means two dialogs, and a
   * map that requests a permission the rider already declined on the screen above it.
   */
  rider = null,
  /** False when `rider` is a remembered fix rather than a live one. */
  riderLive = false,
  /**
   * True while the first fix is still settling (see lib/location/settle.ts). The opening
   * flight to the rider waits for it, so the camera lands once, on a good reading, rather
   * than on a rough guess and then drifting.
   */
  settling = false,
  /** Asks for a fresh reading when the rider presses recentre. */
  onRecentre,
  /** The chosen search radius in metres. Null is the All chip: no limit, no ring. */
  radiusM = null,
  /** Settings → Map → show search circle. */
  showRing = true,
  /** Clears the selected shop. Called when the rider taps empty map. */
  onClearFocus,
  /** Where the search circle is centred: the rider, or the city they picked. */
  ringCentre = null,
  /**
   * A region to bring into view, with a nonce so re-picking the same city re-frames.
   *
   * Picking a city used to change the list and the circle while leaving the camera where
   * it was, so a rider could select Manila and go on looking at Quezon City.
   */
  frame = null,
  /**
   * Bumped by the caller to ask the map to fly back to the rider.
   *
   * A counter rather than a callback, because the request can come from two places —
   * the recentre button and the "current location" entry in the city picker — and both
   * mean the same thing to the map.
   */
  recentre: recentreSignal = 0,
  /** Degrees clockwise from north, already smoothed. Null hides the bike's direction. */
  heading = null,
  /**
   * How many pixels at the BOTTOM of the map are hidden behind the shop sheet.
   *
   * The sheet overlays the map at every resting position, so anything anchored to the
   * map's bottom edge is behind it and invisible. Controls are lifted by this instead.
   */
  obscuredBottom = 0,
  /** True in List mode, when the panel covers the whole map. */
  mapHidden = false,
}: {
  shops: Shop[];
  onPressPin: (shop: Shop) => void;
  focus?: { shop: Shop; nonce: number } | null;
  centerBias?: number;
  online?: boolean;
  rider?: [number, number] | null;
  riderLive?: boolean;
  settling?: boolean;
  onRecentre?: () => void;
  radiusM?: number | null;
  showRing?: boolean;
  onClearFocus?: () => void;
  ringCentre?: [number, number] | null;
  frame?: { bounds: [number, number, number, number]; nonce: number } | null;
  recentre?: number;
  heading?: number | null;
  obscuredBottom?: number;
  mapHidden?: boolean;
}) {
  const { theme, mapTheme, settings } = useSettings();
  /* The recentre button is a step in the tutorial. */
  const recentreRef = useTourTarget('recentre');
  const tour = useTour();
  const camera = useRef<CameraRef>(null);
  const source = useRef<GeoJSONSourceRef>(null);
  const [everLoaded, setEverLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  /** The first fix opens the map on the rider. After that the camera is theirs. */
  const openedOnRider = useRef(false);
  /** The opening "show me everything" fit, which must happen at most once. */
  const framedAll = useRef(false);
  /**
   * FOLLOW MODE. While true, the camera glides after the rider as they move,
   * so a moving bike stays in the middle of the map. A finger dragging the map switches it
   * off, because that rider wants to look somewhere else; recentre switches it back on.
   * A ref, not state: nothing on screen is drawn from it, so changing it must not re-render.
   */
  const following = useRef(true);
  /** The map's current zoom, kept from its own events so "zoom to me" never zooms OUT. */
  const zoomNow = useRef(12);
  /**
   * Until when a deliberate camera move (zoom to me, recentre, opening a shop, picking a
   * city) is still flying. Following waits for it: see lib/map/follow.ts for the bug this
   * prevents. `fly` records it at the same moment the move is started.
   */
  const flyingUntil = useRef(0);
  const fly = (durationMs: number) => {
    flyingUntil.current = busyUntil(Date.now(), durationMs);
  };

  /*
    Where the map opens BEFORE the first fix arrives, and the value is frozen after the
    first render. Re-deriving it would hand the camera a new object and yank it back.
  */
  const initialCentre = useMemo(
    () => (settings.area ? AREA_CENTRES[settings.area] : AREA_CENTRES.other),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  /*
    Following: each new position eases the camera to it. Not while a shop is open, because
    then the camera is framing the shop and the rider together, and not before the
    opening flight has happened.
  */
  useEffect(() => {
    if (!rider || !everLoaded || !openedOnRider.current) return;
    if (
      !shouldFollow({
        following: following.current,
        hasFocus: !!focus,
        busyUntil: flyingUntil.current,
        now: Date.now(),
      })
    ) {
      return;
    }
    camera.current?.easeTo({ center: rider, duration: 900 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rider]);

  /* The first GOOD fix, once. The dot is drawn meanwhile; only the camera waits. */
  useEffect(() => {
    if (!rider || openedOnRider.current || !everLoaded || settling) return;
    openedOnRider.current = true;
    fly(900);
    camera.current?.flyTo({ center: rider, zoom: RIDER_ZOOM, duration: 900 });
  }, [rider, everLoaded, settling]);

  /*
    A tap in the list. `nonce` makes a repeat tap on the same shop still count.

    BOTH POINTS IN FRAME when the rider's position is known, the way a maps app previews
    a journey. A shop pin alone answers "where is it"; the shop AND the rider together
    answer "how far is it and which way", which is the question someone scanning a list
    of shops is actually asking. Seeing the gap is the distance figure made visual.

    `fitBounds` takes the two corners of the box containing both, so the zoom is computed
    from how far apart they are rather than guessed. The padding keeps neither point
    against an edge, and the bottom padding also clears the sheet.

    With no position we fall back to flying to the shop, because a box needs two corners.
  */
  useEffect(() => {
    if (!focus || !everLoaded) return;
    const shop: [number, number] = [focus.shop.lng, focus.shop.lat];

    if (!rider) {
      fly(700);
      camera.current?.flyTo({ center: shop, zoom: SHOP_ZOOM, duration: 700 });
      return;
    }

    fly(800);
    camera.current?.fitBounds(
      [
        Math.min(rider[0], shop[0]),
        Math.min(rider[1], shop[1]),
        Math.max(rider[0], shop[0]),
        Math.max(rider[1], shop[1]),
      ],
      {
        padding: { top: 70, left: 60, right: 60, bottom: Math.max(80, obscuredBottom * 0.25) },
        duration: 800,
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.nonce, everLoaded]);

  /*
    With no area chosen the rider is asking to see everything, and the shops are spread
    right across Metro Manila. Opening at one city's zoom would hide most of them, so the
    camera is fitted to the whole set instead. Only when the rider has no position of
    their own — theirs wins.
  */
  useEffect(() => {
    if (settings.area || rider || !everLoaded || shops.length === 0) return;
    if (openedOnRider.current || framedAll.current) return;
    /*
      ONCE. `shops` is in the dependency list and changes on every keystroke of the search
      and every radius tap, so without this the camera would jump back to the whole
      region each time — fighting a rider who has no GPS and is trying to pan or tap.
    */
    framedAll.current = true;
    const lngs = shops.map((s) => s.lng);
    const lats = shops.map((s) => s.lat);
    camera.current?.fitBounds(
      [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)],
      { padding: { top: 60, left: 50, right: 50, bottom: 80 }, duration: 600 },
    );
  }, [settings.area, rider, everLoaded, shops]);

  /* An outside request to go back to the rider. Ignored on first render. */
  useEffect(() => {
    if (recentreSignal === 0 || !rider || !everLoaded) return;
    following.current = true;
    /* Same rule as the button: go there, change nothing else. */
    fly(700);
    camera.current?.flyTo({ center: rider, duration: 700 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recentreSignal]);

  /* Go to the city the rider just picked, framed so the whole of it is visible. */
  useEffect(() => {
    if (!frame || !everLoaded) return;
    /* The rider asked to look at a city, so the camera stops chasing them. */
    following.current = false;
    fly(800);
    camera.current?.fitBounds(frame.bounds, {
      padding: { top: 70, left: 50, right: 50, bottom: Math.max(80, obscuredBottom * 0.25) },
      duration: 800,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame?.nonce, everLoaded]);

  const recentre = () => {
    if (!rider) return;
    /*
      NO ZOOM GIVEN, DELIBERATELY. `flyTo` leaves out what it is not told, so the map
      keeps whatever scale the rider had set.

      Forcing RIDER_ZOOM here meant someone who had zoomed right in on their street was
      yanked back out to city scale by a button whose entire job is "put me back in the
      middle" — it answered WHERE and then silently changed HOW CLOSE as well.
    */
    fly(700);
    camera.current?.flyTo({ center: rider, duration: 700 });
    following.current = true;
    /*
      And ask for a fresh reading while the camera is moving. The rider pressing this is
      asking where they actually are, not merely to be shown the last answer again.
    */
    onRecentre?.();
    tour.notify('recentre');
  };

  /*
    THE SHOPS, AS MAP DATA RATHER THAN AS VIEWS.

    Every shop used to be a `<Marker>`, which is a real React view that JavaScript builds,
    measures and positions. That is fine for twenty-one. The collected dataset holds two
    thousand seven hundred, and at that count the JavaScript thread simply stops.

    Handed over as one GeoJSON collection instead, the map draws them itself in native
    code, and React renders nothing per shop at all.

    Only `id` and `name` travel with each point. Everything else the screens need is
    already in the shops array on this side; sending it again would triple the size of
    something that crosses the bridge whenever the list changes.
  */
  const collection = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: shops.map((shop) => ({
        type: 'Feature' as const,
        id: shop.id,
        properties: { id: shop.id, name: shop.name },
        geometry: { type: 'Point' as const, coordinates: [shop.lng, shop.lat] },
      })),
    }),
    [shops],
  );

  const byId = useMemo(() => new Map(shops.map((shop) => [shop.id, shop])), [shops]);

  /*
    MEMOISED, for the same reason the images are. Everything below is handed straight to
    a native component, and a native component re-reads a prop whose identity changed
    even when the values inside are the same. Built inline they were rebuilt on every
    render — which, now that heading is state, means roughly ten times a second while the
    rider turns.
  */
  const riderFeature = useMemo(
    () =>
      rider
        ? ({
            type: 'Feature',
            properties: {},
            geometry: { type: 'Point', coordinates: rider },
          } as GeoJSON.Feature)
        : null,
    [rider],
  );

  const focusFeature = useMemo(
    () =>
      focus
        ? ({
            type: 'Feature',
            properties: { id: focus.shop.id },
            geometry: { type: 'Point', coordinates: [focus.shop.lng, focus.shop.lat] },
          } as GeoJSON.Feature)
        : null,
    [focus?.shop.id, focus?.shop.lng, focus?.shop.lat],
  );

  const ringFeature = useMemo(
    () =>
      showRing && radiusM !== null && ringCentre
        ? circleAround(ringCentre, radiusM / DETOUR_FACTOR)
        : null,
    [showRing, radiusM, ringCentre],
  );

  const inset = useMemo(
    () => ({ bottom: Math.round(400 * (1 - centerBias)) }),
    [centerBias],
  );

  /*
    One tap handler for both kinds of thing on the layer, because they are the same layer.
    A feature carrying `point_count` is a cluster the map itself invented; anything else
    is a real shop.
  */
  const handlePress = (e: {
    nativeEvent: { features?: GeoJSON.Feature[] };
    stopPropagation?: () => void;
  }) => {
    /*
      A press on a source ALSO reaches the map unless it is stopped here. Without this,
      tapping a shop would select it and then immediately clear it again, because the map
      handler below treats any press as "the rider tapped empty space".
    */
    e.stopPropagation?.();
    const feature = e.nativeEvent.features?.[0];
    if (!feature) return;
    const props = (feature.properties ?? {}) as Record<string, unknown>;

    if (typeof props.cluster_id === 'number') {
      /*
        Zoom to exactly where this cluster breaks apart. The map knows that number; we
        ask rather than guess, because guessing either falls short and re-clusters or
        overshoots past the shops the rider was reaching for.
      */
      const coords = (feature.geometry as GeoJSON.Point).coordinates as [number, number];
      /* Opening a cluster is exploring, like dragging: stop chasing the rider. */
      following.current = false;
      source.current
        ?.getClusterExpansionZoom(props.cluster_id as number)
        .then((zoom) => camera.current?.flyTo({ center: coords, zoom, duration: 600 }))
        .catch(() => camera.current?.flyTo({ center: coords, zoom: CLUSTER_MAX_ZOOM, duration: 600 }));
      return;
    }

    const shop = byId.get(String(props.id));
    if (shop) onPressPin(shop);
  };

  /*
    ZOOM TO ME. Recentre deliberately keeps the rider's zoom; this answers the other
    question, "what is right around me?". Same place, but close
    enough that clusters open into single shops. Never zooms out: a rider already closer
    keeps their zoom. Turns following back on, like recentre.
  */
  const zoomToMe = () => {
    if (!rider) return;
    following.current = true;
    fly(800);
    camera.current?.flyTo({ center: rider, zoom: Math.max(zoomNow.current, MEET_ZOOM), duration: 800 });
    onRecentre?.();
  };

  const s = styles(theme);

  return (
    <View style={s.wrap}>
      <MapView
        style={s.map}
        mapStyle={STYLE_URL}
        /*
          Pushes the map's optical centre upward by however much the sheet covers, so a
          shop the camera flies to does not land underneath the list.
        */
        contentInset={inset}
        attribution={false}
        logo={false}
        /*
          NORTH IS ALWAYS UP, and that is load-bearing for the heading cone.

          Markers are view annotations: they sit on top of the map and do NOT turn with
          it. If the rider could rotate the map, the cone would keep pointing at screen
          north while the streets underneath turned, and it would be silently wrong by
          exactly the map's bearing. Locking rotation makes the cone correct by
          construction instead of by arithmetic that has to be kept in sync.

          North-up is also the right default for a shop finder. This is not turn-by-turn
          navigation; the rider is scanning what is around them, and a map that spins
          while they turn makes that harder, not easier. The compass control goes with
          it — a compass that can only ever read north is furniture.
        */
        touchRotate={false}
        /*
          A press that reached the map rather than a pin means the rider tapped empty
          space, which is how every maps app says "never mind". Without it a selected
          shop could be moved but never dismissed.
        */
        onPress={() => onClearFocus?.()}
        onDidFinishLoadingMap={() => setEverLoaded(true)}
        /*
          `userInteraction` is true only when a finger moved the map, never for our own
          camera moves, so following stops exactly when the rider takes over.
        */
        onRegionWillChange={(e) => {
          if (e.nativeEvent.userInteraction) following.current = false;
        }}
        onRegionDidChange={(e) => {
          zoomNow.current = e.nativeEvent.zoom;
        }}
        /* A style that will not load leaves the spinner forever otherwise. */
        onDidFailLoadingMap={() => setFailed(true)}
      >
        {/*
          EVERY IMAGE THE MAP USES, REGISTERED ONCE.

          `MAP_IMAGES` is a module constant, not an inline object, and that distinction
          was a crash. `Images` memoises on the identity of what it is given, so an object
          literal written in JSX is a new one on every render and re-registers every image
          natively each time. That was survivable while this component re-rendered rarely;
          the moment heading became React state it happened about ten times a second.

          One component rather than two for the same reason — two registries writing to
          one style is a race nobody needs.
        */}
        <Images images={MAP_IMAGES} />

        {/*
          EVERY LAYER CARRIES A KEY, AND THAT IS A CRASH FIX, NOT TIDINESS.

          `Layer` freezes its `id` on first render and throws `id cannot be changed` if it
          ever sees a different one. With no keys React matches siblings BY POSITION — so
          when the conditional heading cone appeared between the aura and the bike, every
          layer after it shifted up one, the bike's component was handed the cone's id,
          and the map died.

          It only happened when the compass reported AFTER the map had already drawn,
          which is why it looked intermittent and why a screenshot could show it working.

          LAYER ORDER IS JSX ORDER, and it is load-bearing here. Anything declared later
          is drawn on top. The mask has to come first or it paints over the shops it is
          meant to sit behind; the selected pin has to come last or the two thousand
          cluster circles are drawn over the one thing the rider is looking for.
        */}
        <Camera
          ref={camera}
          initialViewState={{ center: initialCentre, zoom: 12 }}
          /*
            METRO MANILA ONLY. The dataset stops at the region's edge, so everything
            beyond it is tiles with nothing on them — scrolling into it is how a rider
            gets lost in an empty map and concludes the app is broken. `maxBounds` keeps
            the map's centre inside the box; `minZoom` stops them zooming out to a view
            where the region is a speck.
          */
          maxBounds={METRO_MANILA}
          minZoom={10}
          /*
            20, not 18. The tiles themselves stop around 14 and the map overzooms beyond
            that, so the extra levels cost nothing to serve and let a rider get close
            enough to tell one shopfront from its neighbour.
          */
          maxZoom={20}
        />

        {/*
          OUR OWN PUCK, not MapLibre's `UserLocation`.

          Theirs is three circle layers hardcoded to #33B5E5 — it cannot take the oxide
          palette, and its heading indicator is a small symbol rather than the cone that
          actually answers "which of these shops is in front of me".

          Faded when the fix is remembered rather than live. Drawing a confident arrow on
          a stale position claims a certainty that is not there, and it would sit still
          while the rider moves, which reads as the arrow being broken.
        */}

        {/*
          EVERYTHING OUTSIDE METRO MANILA, PAINTED OUT.

          `maxBounds` already stops the map's CENTRE leaving the region, but the edges of
          the screen still show whatever is beyond it — tiles with no shops on them, which
          is how a rider ends up staring at an empty map wondering what broke.

          One polygon with two rings does it. In GeoJSON the first ring is the outline and
          every ring after it is a HOLE, so an outline the size of the world with Metro
          Manila punched out of it is exactly "everywhere else". Unlocking a region later
          means widening the hole, nothing more.
        */}
        <GeoJSONSource id="outside" data={OUTSIDE_METRO_MANILA}>
          <Layer
              key="outside-fill"
              id="outside-fill"
            type="fill"
            paint={{ 'fill-color': mapTheme.mapBg, 'fill-opacity': 0.94 }}
          />
          <Layer
              key="outside-edge"
              id="outside-edge"
            type="line"
            paint={{ 'line-color': mapTheme.line, 'line-width': 1.5, 'line-opacity': 0.9 }}
          />
        </GeoJSONSource>

        {/*
          HOW FAR THE RIDER ASKED TO LOOK.

          This setting existed with nothing behind it: the ring was only ever drawn on the
          placeholder map, so Show and Hide did nothing once the real map was in use.

          DRAWN AT radius / 1.3, NOT AT radius. The radius chips filter on the ROAD
          estimate — straight line times the detour factor — so a shop inside a literal
          one-kilometre circle can still be more than a kilometre of riding away. Drawing
          the literal circle would put pins outside the ring that the list includes, and
          pins inside it that the list drops. This circle is exactly the set of shops the
          rider is being shown.
        */}
        {ringFeature && (
          <GeoJSONSource id="radius-ring" data={ringFeature}>
            <Layer
              key="radius-ring-fill"
              id="radius-ring-fill"
              type="fill"
              paint={{ 'fill-color': mapTheme.accent, 'fill-opacity': 0.05 }}
            />
            <Layer
              key="radius-ring-line"
              id="radius-ring-line"
              type="line"
              paint={{
                'line-color': mapTheme.accent,
                'line-opacity': 0.5,
                'line-width': 1.5,
                /* Dashed, so it reads as a boundary the rider chose rather than a road. */
                'line-dasharray': [3, 2],
              }}
            />
          </GeoJSONSource>
        )}

        {/*
          ONE SOURCE, FOUR LAYERS, NO REACT VIEWS.

          `cluster` is the whole point: the map groups shops that are too close together
          to tell apart into a single numbered circle, and splits them as the rider zooms
          in. Without it, two thousand seven hundred pins overlap into an unreadable mass
          AND overwhelm the thread that draws them.
        */}
        <GeoJSONSource
          id="shops"
          ref={source}
          data={collection}
          cluster
          clusterRadius={CLUSTER_RADIUS_PX}
          clusterMaxZoom={CLUSTER_MAX_ZOOM}
          onPress={handlePress}
          /* A finger is wider than a 7px circle; this pads the tap target. */
          hitbox={HITBOX_SMALL}
        >
          {/*
            Cluster circles, sized by how many shops they hold. Stepped rather than
            continuous, so the sizes read as a few distinct classes instead of a smear
            where every circle is slightly different from its neighbour.
          */}
          <Layer
              key="shop-cluster"
              id="shop-cluster"
            type="circle"
            filter={['has', 'point_count']}
            paint={{
              'circle-color': mapTheme.accent,
              'circle-opacity': 0.92,
              'circle-radius': ['step', ['get', 'point_count'], 15, 10, 20, 50, 26, 200, 32],
              'circle-stroke-width': 2,
              'circle-stroke-color': mapTheme.onFilled,
            }}
          />

          <Layer
              key="shop-cluster-count"
              id="shop-cluster-count"
            type="symbol"
            filter={['has', 'point_count']}
            layout={{
              /* `_abbreviated` turns 1,240 into "1.2k" so a big cluster still fits. */
              'text-field': ['get', 'point_count_abbreviated'],
              'text-font': LABEL_FONT,
              'text-size': 12,
              /* Counts must never be dropped for overlapping: a circle with no number
                 on it looks like a shop, which is exactly the wrong reading. */
              'text-allow-overlap': true,
              'text-ignore-placement': true,
            }}
            paint={{ 'text-color': mapTheme.onFilled }}
          />

          {/* A single shop, once it is no longer part of a cluster. */}
          <Layer
              key="shop-point"
              id="shop-point"
            type="circle"
            filter={['!', ['has', 'point_count']]}
            paint={{
              'circle-color': mapTheme.accent,
              'circle-radius': 7,
              'circle-stroke-width': 2,
              'circle-stroke-color': mapTheme.onFilled,
            }}
          />

          {/*
            SHOP NAMES, ONLY WHEN ZOOMED IN. From
            `MEET_ZOOM`, the zoom where shops stop clustering; further out, names on two
            thousand pins would be an unreadable mat. `text-optional` lets the map drop a
            name that would collide with another rather than pile them up; the dot always
            stays. Noto Sans Regular is one of the three fonts the positron style serves
            (checked 3 Oct 2026); any other renders as nothing.
          */}
          <Layer
            key="shop-label"
            id="shop-label"
            type="symbol"
            minzoom={MEET_ZOOM}
            filter={['!', ['has', 'point_count']]}
            layout={{
              'text-field': ['get', 'name'],
              'text-font': ['Noto Sans Regular'],
              'text-size': 12,
              'text-anchor': 'top',
              'text-offset': [0, 0.9],
              'text-max-width': 9,
              'text-optional': true,
            }}
            paint={{
              'text-color': mapTheme.ink,
              'text-halo-color': mapTheme.surface,
              'text-halo-width': 1.5,
            }}
          />
        </GeoJSONSource>
        {/*
          THE SELECTED SHOP, DRAWN NATIVELY AND NEVER CLUSTERED.

          Two separate problems forced this shape, and only this shape solves both.

          IT CANNOT LIVE IN THE CLUSTERED SOURCE. Once the map groups a shop into a
          cluster that shop stops existing as an individual point, so a filter matching
          its id matches nothing — and the highlight vanished exactly when it was needed,
          because tapping a distant shop zooms out, and zooming out is what makes
          clusters. So it gets its own source with clustering off.

          IT CANNOT BE A `Marker` EITHER. A Marker is a React view positioned from
          JavaScript, so during a drag it is repositioned a frame behind the map it sits
          on — the wobble. Everything drawn by a layer moves with the map because the map
          itself draws it. One shop is cheap either way; only one of them is steady.
        */}
        {focus && (
          <GeoJSONSource
            id="selected"
            data={focusFeature!}
            onPress={(e) => {
              e.stopPropagation?.();
              onPressPin(focus.shop);
            }}
            hitbox={HITBOX_LARGE}
          >

            <Layer
              key="selected-pin"
              id="selected-pin"
              type="symbol"
              layout={{
                'icon-image': 'shop-pin',
                'icon-size': 0.42,
                /* Anchored at its point, which is where the shop actually is. */
                'icon-anchor': 'bottom',
                /* Never dropped for overlapping: the whole job is to be seen. */
                'icon-allow-overlap': true,
                'icon-ignore-placement': true,
              }}
              paint={{ 'icon-color': mapTheme.ink }}
            />
          </GeoJSONSource>
        )}

        {/*
          THE RIDER, DRAWN BY THE MAP.

          This was a `Marker` — a React view positioned from JavaScript, which means it is
          repositioned a frame behind the map it sits on, and wobbles on every drag. The
          shop pin had the same fault and was fixed the same way; this is the last piece
          that lagged.

          Everything here rotates together because everything reads the same `heading`,
          and `icon-rotate` turns an icon about its own anchor — which sits exactly on the
          rider. The cone image has its apex at the centre of its own square for that
          reason: rotating it sweeps the wedge around the rider rather than orbiting it.

          `circle-radius` and icon sizes are SCREEN pixels, not metres, so the whole mark
          keeps its size as the rider zooms — which a geographic circle would not.
        */}

        {rider && (
          <GeoJSONSource id="rider" data={riderFeature!}>
            {/*
              The glow, as five stacked circles. React Native cannot blur a shape and
              neither can a style layer, so a soft edge is built by accumulating faint
              ones. Fewer, larger steps band into visible rings instead of glowing.
            */}
            {AURA.map(({ size: ring, opacity }) => (
              <Layer
                key={ring}
                id={`rider-aura-${ring}`}
                type="circle"
                paint={{
                  'circle-radius': ring / 2,
                  'circle-color': mapTheme.accent,
                  'circle-opacity': riderLive ? opacity : opacity * 0.45,
                }}
              />
            ))}

            {/* Which way the phone is pointing. Absent entirely until the compass reports. */}
            {heading !== null && (
              <Layer
              key="rider-cone"
              id="rider-cone"
                type="symbol"
                layout={{
                  'icon-image': 'rider-cone',
                  'icon-size': 0.42,
                  'icon-rotate': heading,
                  'icon-rotation-alignment': 'map',
                  'icon-allow-overlap': true,
                  'icon-ignore-placement': true,
                }}
                paint={{ 'icon-color': mapTheme.accent, 'icon-opacity': riderLive ? 0.26 : 0.12 }}
              />
            )}


            <Layer
              key="rider-moto"
              id="rider-moto"
              type="symbol"
              layout={{
                'icon-image': 'rider-moto',
                'icon-size': RIDER_SIZE,
                /*
                  Points north until the compass reports. A motorcycle has to point
                  somewhere, and north is the one direction that is not a claim.
                */
                'icon-rotate': heading ?? 0,
                'icon-rotation-alignment': 'map',
                'icon-allow-overlap': true,
                'icon-ignore-placement': true,
              }}
              paint={{ 'icon-color': mapTheme.accent, 'icon-opacity': riderLive ? 1 : 0.5 }}
            />

            {/*
              THE RIDER, PICKED OUT OF THE MACHINE.

              One flat silhouette made the helmet and shoulders merge into the tank, so it
              read as a shape rather than a person on a bike. A second image in the light
              colour — a ring around the helmet and a line under the shoulders — separates
              them without adding a third colour to the map.

              Same size and same rotation as the bike, from the same constants, because
              two images stacked on each other must agree exactly or the helmet drifts.
            */}
            <Layer
              key="rider-detail"
              id="rider-detail"
              type="symbol"
              layout={{
                'icon-image': 'rider-detail',
                'icon-size': RIDER_SIZE,
                'icon-rotate': heading ?? 0,
                'icon-rotation-alignment': 'map',
                'icon-allow-overlap': true,
                'icon-ignore-placement': true,
              }}
              paint={{ 'icon-color': mapTheme.onFilled, 'icon-opacity': riderLive ? 1 : 0.5 }}
            />
          </GeoJSONSource>
        )}

      </MapView>

      {/*
        RECENTRE. Hidden entirely when there is no position to go to, because a button
        that does nothing when pressed is worse than no button: the rider concludes the
        app is broken rather than that they declined a permission.
      */}
      {/*
        Also absent while the map is hidden behind the list, so nothing (the tutorial
        included) can point at a button nobody can see.
      */}
      {rider && !mapHidden && (
        <Pressable
          onPress={zoomToMe}
          style={({ pressed }) => [s.locBtn, { bottom: obscuredBottom + 64 }, pressed && s.pressed]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Zoom in on my location"
        >
          <View style={s.locOuter}>
            <ZoomInIcon size={22} color={theme.ink} />
          </View>
        </Pressable>
      )}
      {rider && !mapHidden && (
        <Pressable
          ref={recentreRef}
          onPress={recentre}
          style={[s.locBtn, { bottom: obscuredBottom + 14 }]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Centre the map on my location"
        >
          <View style={s.locOuter}>
            <CrosshairIcon size={21} color={theme.ink} />
          </View>
        </Pressable>
      )}

      {/*
        Only when the map has NEVER drawn AND there is no connection. If it drew earlier
        the ambient cache is showing the last tiles, and an overlay on top of a perfectly
        readable map would be a lie.
      */}
      {!everLoaded && !online && (
        <View style={s.cover}>
          <Text style={s.coverTitle}>The map needs data the first time</Text>
          <Text style={s.coverBody}>
            Once it has loaded here, it keeps working offline. Everything else already
            does: the shop list, the search and the call buttons are all on your phone.
          </Text>
        </View>
      )}

      {!everLoaded && online && !failed && (
        <View style={s.cover}>
          <ActivityIndicator color={theme.accent} />
        </View>
      )}

      {!everLoaded && online && failed && (
        <View style={s.cover}>
          <Text style={s.coverTitle}>The map could not load</Text>
          <Text style={s.coverBody}>
            The tile service did not answer. The shop list below still works, and so do
            the call and directions buttons.
          </Text>
        </View>
      )}

      {/*
        ATTRIBUTION, AS A BUTTON RATHER THAN A STRIP ACROSS THE MAP.

        It cannot simply go. OpenStreetMap's licence requires visible credit, and
        OpenFreeMap serves the tiles on the same condition — that credit is what makes
        the map free and key-less, so removing it would mean paying a tile host instead.

        But a line of text sitting over the streets is the wrong way to satisfy it. Every
        maps app resolves this the same way: a small mark that names itself and opens the
        full credit on a tap. Twenty-four pixels in a corner instead of a strip.
      */}
      <Pressable
        onPress={() =>
          Alert.alert('Map data', ATTRIBUTION, [
            { text: 'Open licence', onPress: () => Linking.openURL(OSM_COPYRIGHT) },
            { text: 'Close', style: 'cancel' },
          ])
        }
        style={[s.attrib, { bottom: obscuredBottom + 10 }]}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Map data credits"
      >
        <InfoIcon size={15} color={theme.ink3} />
      </Pressable>
    </View>
  );
}

const styles = (theme: ReturnType<typeof useSettings>['theme']) =>
  StyleSheet.create({
    /*
      `overflow: hidden` is load-bearing, not tidiness. The controls are positioned by
      subtracting the sheet's coverage from the bottom, and at the sheet's tallest
      position that pushes them past the map's top edge. Android Views do not clip by
      default, so without this they would float up over the brand band.
    */
    wrap: { flex: 1, backgroundColor: theme.mapBg, overflow: 'hidden' },
    map: { flex: 1 },


    /*
      LOWER LEFT. A thumb reaches the bottom corners of a phone without the hand
      shifting grip, and the top right is where the notice banner lives. Above the
      attribution, which is a licence term and must not be covered.
    */
    locBtn: { position: 'absolute', left: 12 },
    pressed: { opacity: 0.6 },
    locOuter: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.surface,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.line,
      elevation: 3,
      shadowColor: '#000',
      shadowOpacity: 0.16,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 1 },
    },



    cover: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: theme.mapBg,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 34,
      gap: 8,
    },
    coverTitle: { fontSize: 15, fontWeight: '700', color: theme.ink, textAlign: 'center' },
    coverBody: { fontSize: 12.5, lineHeight: 18, color: theme.ink2, textAlign: 'center' },

    /*
      Lifted clear of the sheet like the button. This one is not a preference: the
      OpenStreetMap licence requires the credit to be VISIBLE, and a credit permanently
      hidden behind a panel is not visible.
    */
    /*
      Bottom RIGHT, opposite the recentre button. Both corners are reachable, and the one
      the rider presses often should not share a corner with the one they press never.
    */
    attrib: {
      position: 'absolute',
      right: 12,
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: theme.surface,
      alignItems: 'center',
      justifyContent: 'center',
      opacity: 0.8,
    },
  });
