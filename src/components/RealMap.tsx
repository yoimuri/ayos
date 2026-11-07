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

import { CompassIcon, CrosshairIcon, CubeIcon, InfoIcon, MapOnlyIcon, NeedleIcon, SquareIcon } from '@/components/icons';
import { frameFor, sizeScale } from '@/features/ride/catalog';
import { useRidePictures } from '@/features/ride/pictures';
import { useTour, useTourTarget } from '@/components/Tour';

import type { Shop } from '@/lib/data/types';
import { CITY_AREAS } from '@/lib/geo/cityAreas.generated';
import { METRO_MANILA } from '@/lib/geo/coverage';
import { bearingTo, DETOUR_FACTOR } from '@/lib/geo/distance';
import { bearingFor, busyUntil, checkResume, fitPadding, pauseAt, shouldFollow, type Pause } from '@/lib/map/follow';
import { fetchRoadLine } from '@/lib/map/roadLine';
import { AREA_CENTRES, useSettings, type Area } from '@/lib/settings/store';

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
export const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';
/** Dark mode gets OpenFreeMap's own dark style (checked 29 Oct 2026); it has no 3D buildings, we add ours. */
export const DARK_STYLE_URL = 'https://tiles.openfreemap.org/styles/dark';
/** Each style's first label layer: our buildings go just under it, so street names stay on top. */
const FIRST_LABEL = { light: 'waterway_line_label', dark: 'water_name' } as const;

/*
  3D BUILDINGS, KEPT QUIET. The rider and the pins carry the map; buildings only give it
  depth. Half their real height and a colour close to the ground (design canvas, 30 Oct).
  `render_height` comes from the same OpenMapTiles data the street map is drawn from.
*/
const BUILDING_HEIGHT = 0.5;
const BUILDING_COLOUR = { light: '#E6DFD4', dark: '#2A2621' } as const;

/** Camera tilt in 3D: a little steeper while following a moving rider. 2D is always 0. */
const TILT = 48;
const TILT_RIDING = 55;
/** Zoomed out past this, the map flattens itself even in 3D: a tilted city is unreadable. */
const FLAT_BELOW_ZOOM = 12.5;

/*
  ONE SWITCH FOR THE WHOLE MAP, at FLAT_BELOW_ZOOM (Charls, 5 Nov). Further out: a flat map of
  coloured cities, tap one to go in. Closer: groups and pins, tilted if 3D is on. The two never
  share the screen, so a coloured area can never sit under pins that are hard to read on it.
*/
/** The city colours fade out over this last stretch before the switch. */
const CITY_FADE_FROM = FLAT_BELOW_ZOOM - 0.5;
/** Tapping a city lands here: just past the switch, so its shops show at once. */
const CITY_ZOOM = 13;
/**
 * A box wider than this, in degrees (about 3 km), only fits on a phone below the switch, where
 * no shops are drawn. Going to such a place flies to its busiest spot at CITY_ZOOM instead.
 */
const FITS_AT_SHOP_ZOOM = 0.03;
/** Tones per city, neighbours differ (scripts/build_city_areas.py). See-through: the map stays readable. */
const CITY_TONES = ['#D9B779', '#E3A77F', '#B79BC2', '#9DBBA3', '#9FB6CE'];
/** The style's first layer above the land and water, in both styles: city colours go just under it. */
const FIRST_ABOVE_LAND = 'waterway';
const WATER_COLOUR = { light: 'rgb(194, 200, 202)', dark: 'rgb(27, 27, 29)' } as const;

/** No arrow closer than this: the rider is already there, and it would only spin. */
const ARROW_MIN_M = 30;

/** Metres between two [lng, lat] points; plenty accurate across a few hundred metres. */
function metresBetween(a: [number, number], b: [number, number]): number {
  const k = 111_320;
  const dx = (a[0] - b[0]) * k * Math.cos((a[1] * Math.PI) / 180);
  const dy = (a[1] - b[1]) * k;
  return Math.hypot(dx, dy);
}

/**
 * A STANDING rider's camera ignores moves smaller than this. Indoors or between buildings
 * a still phone's position wanders 5-20 m; re-centring on each wander swung the whole map,
 * and a tilted 3D view makes every swing look bigger (Clint, 30 Oct: "fluctuating HARD").
 * The dot itself still shows the latest filtered position; only the camera holds still.
 */
const STILL_CAMERA_DEADBAND_M = 12;
/** How long without movement before the rider counts as parked for the deadband above. */
const PARKED_AFTER_MS = 20_000;

/**
 * The pin picture for a shop: the most useful thing it offers a stranded rider, and whether
 * it is open. By priority, not by the sheet's tag order: 2,240 shops list accessories first,
 * which would have put a helmet on nearly every repair shop (checked 30 Oct 2026).
 */
const PIN_PRIORITY = ['repair', 'parts', 'dealer', 'accessories'] as const;
function pinKind(shop: Shop): { cat: string; st: string } {
  return { cat: PIN_PRIORITY.find((tag) => shop.tags.includes(tag)) ?? 'repair', st: shop.status };
}

/**
 * OpenStreetMap's licence requires visible credit, and this style ships no `attribution`
 * field in its sources, so MapLibre's own attribution control has nothing to display.
 * Drawing it here is a licence term, not decoration. The wording and the report-an-error link
 * are what the road line's server asks for (lib/map/roadLine.ts).
 */
const ATTRIBUTION = 'Data © OpenStreetMap contributors (ODbL), CC-BY-SA · Map: OpenFreeMap · Road line: Valhalla, FOSSGIS';
const OSM_COPYRIGHT = 'https://www.openstreetmap.org/copyright';
const OSM_FIX = 'https://www.openstreetmap.org/fixthemap';
/** Shown on the map when the app opens: the guidelines say nobody should have to tap to see it. */
const CREDIT_LINE = '© OpenStreetMap contributors';
/** They allow it to fade after this long, leaving the info button. */
const CREDIT_MS = 5000;

/**
 * Beyond this zoom, shops stop being grouped and each one is drawn separately.
 * 15 is roughly street level, which is the point at which "there are 12 shops around
 * here" stops being the useful answer and "that one, there" starts.
 */
const CLUSTER_MAX_ZOOM = 15;
/** Screen pixels. Two shops closer together than this on screen become one circle. */
const CLUSTER_RADIUS_PX = 58;

/** The edge of the world, as far as this app is concerned: lib/geo/coverage.ts. */
export { METRO_MANILA };

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
 * The pins and the heading wedge, defined once at module scope. The rider's bike is added
 * per look by `riderImages` below.
 *
 * The one marked `sdf` is a white silhouette, so the map treats them as shapes to colour
 * rather than pictures: one file each serves both themes, and symbol layers can give them
 * a halo, which React Native cannot do to a shape at all.
 */
const MAP_IMAGES = {
  'shop-pin': { source: require('../../assets/images/shop-pin.png'), sdf: true },
  /* Full colour, not sdf: an sdf is one flat colour, and a beam is all fade (docs/design/headlight_beam.py). */
  'headlight-beam': { source: require('../../assets/images/map/headlight-beam.png') },
  /* 1.2.0: full-colour pictures (not sdf), drawn at 3x and shown at a third. */
  'pin-repair-open': { source: require('../../assets/images/map/pin-repair-open.png') },
  'pin-repair-open-v': { source: require('../../assets/images/map/pin-repair-open-v.png') },
  'pin-repair-closed': { source: require('../../assets/images/map/pin-repair-closed.png') },
  'pin-repair-closed-v': { source: require('../../assets/images/map/pin-repair-closed-v.png') },
  'pin-repair-unknown': { source: require('../../assets/images/map/pin-repair-unknown.png') },
  'pin-repair-unknown-v': { source: require('../../assets/images/map/pin-repair-unknown-v.png') },
  'pin-parts-open': { source: require('../../assets/images/map/pin-parts-open.png') },
  'pin-parts-open-v': { source: require('../../assets/images/map/pin-parts-open-v.png') },
  'pin-parts-closed': { source: require('../../assets/images/map/pin-parts-closed.png') },
  'pin-parts-closed-v': { source: require('../../assets/images/map/pin-parts-closed-v.png') },
  'pin-parts-unknown': { source: require('../../assets/images/map/pin-parts-unknown.png') },
  'pin-parts-unknown-v': { source: require('../../assets/images/map/pin-parts-unknown-v.png') },
  'pin-dealer-open': { source: require('../../assets/images/map/pin-dealer-open.png') },
  'pin-dealer-open-v': { source: require('../../assets/images/map/pin-dealer-open-v.png') },
  'pin-dealer-closed': { source: require('../../assets/images/map/pin-dealer-closed.png') },
  'pin-dealer-closed-v': { source: require('../../assets/images/map/pin-dealer-closed-v.png') },
  'pin-dealer-unknown': { source: require('../../assets/images/map/pin-dealer-unknown.png') },
  'pin-dealer-unknown-v': { source: require('../../assets/images/map/pin-dealer-unknown-v.png') },
  'pin-accessories-open': { source: require('../../assets/images/map/pin-accessories-open.png') },
  'pin-accessories-open-v': { source: require('../../assets/images/map/pin-accessories-open-v.png') },
  'pin-accessories-closed': { source: require('../../assets/images/map/pin-accessories-closed.png') },
  'pin-accessories-closed-v': { source: require('../../assets/images/map/pin-accessories-closed-v.png') },
  'pin-accessories-unknown': { source: require('../../assets/images/map/pin-accessories-unknown.png') },
  'pin-accessories-unknown-v': { source: require('../../assets/images/map/pin-accessories-unknown-v.png') },
  sphere: { source: require('../../assets/images/map/sphere.png') },
  'pin-ring': { source: require('../../assets/images/map/pin-ring.png') },
  'direction-arrow': { source: require('../../assets/images/map/direction-arrow.png') },
};

/**
 * GRAPHICS: LIGHT, THE CLASSIC LOOK (Clint, 1 Nov): the two pictures Light still needs.
 * Shops, groups of shops, the selected shop and the rider are drawn as plain circles by
 * the map itself, so none of the 24 pin pictures or the rider's 9 bike pictures are
 * loaded at all.
 */
const LIGHT_IMAGES = {
  'headlight-beam': { source: require('../../assets/images/map/headlight-beam.png') },
  'direction-arrow': { source: require('../../assets/images/map/direction-arrow.png') },
};

/** Stable hitboxes, for the same reason the images are stable. */
/**
 * How big the rider's bike is drawn, as a fraction of its 240 px picture, at size M.
 * Matched to build 1.2.0 on screen: about 45 px tall in 3D, about 33 px long in 2D.
 * Your ride's S / M / L multiplies these.
 */
const BIKE_3D_SIZE = 0.31;
const BIKE_2D_SIZE = 0.24;
/**
 * In the 3D pictures the point where the bike stands sits 48 px below the picture's centre
 * (the camera looks down at the map's tilt). Lifting the picture by that much puts the
 * bike's wheels on the rider's position instead of its middle.
 */
const BIKE_3D_LIFT = -48;

/**
 * SMALLER WHEN ZOOMED OUT (Clint, 1 Nov). The rider is sized in screen pixels, so it keeps
 * its size on screen while the map shrinks under it; at city zoom a 45 px bike covered the
 * shop groups around it. Full size from street level (zoom 15) in, easing down to 60% at
 * city level (zoom 11) and staying there, never smaller, so it is always easy to find.
 * `icon-offset` is scaled by `icon-size`, so the 3D bike's lift shrinks with it.
 */
const byZoom = (size: number): ['interpolate', ['linear'], ['zoom'], number, number, number, number] => [
  'interpolate',
  ['linear'],
  ['zoom'],
  11,
  size * 0.6,
  15,
  size,
];

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
 * Shop NAMES show from here in: one level past `CLUSTER_MAX_ZOOM`, the first zoom at which
 * the map stops grouping shops at all. About 800 m across on a phone.
 */
const MEET_ZOOM = CLUSTER_MAX_ZOOM + 1;

/**
 * The locate button's first tap lands here (never zooming OUT). It used to be MEET_ZOOM,
 * which Clint found too close next to Google Maps (31 Oct); this is about the zoom Google
 * Maps uses, roughly 1.5 km across on a phone, so a few blocks around the rider and the
 * main roads out of them are in view. Nearby shops still group into counts here.
 */
const LOCATE_ZOOM = 15;



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
  course = null,
  /**
   * How many pixels at the BOTTOM of the map are hidden behind the shop sheet.
   *
   * The sheet overlays the map at every resting position, so anything anchored to the
   * map's bottom edge is behind it and invisible. Controls are lifted by this instead.
   */
  obscuredBottom = 0,
  /** Pixels at the TOP covered by the floating search card. */
  obscuredTop = 0,
  /** True in List mode, when the panel covers the whole map. */
  mapHidden = false,
  /** Map only: every control hidden but the button that brings them back. */
  bare = false,
  onToggleBare,
  visited,
  recent,
  onPressCity,
  selectedCity = null,
}: {
  shops: Shop[];
  /** A coloured city was tapped, on the zoomed-out map. */
  onPressCity?: (area: Area) => void;
  /** The city just tapped: its outline stays drawn after zooming in. */
  selectedCity?: Area | null;
  /** Ids of shops this rider marked Visited; their pins are drawn green. */
  visited?: string[];
  /** Ids of shops this rider opened lately; their names carry "Recently viewed". */
  recent?: string[];
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
  /** `centre`: where to go when the whole box only fits below the zoom where shops show. */
  frame?: { bounds: [number, number, number, number]; centre: [number, number] | null; nonce: number } | null;
  recentre?: number;
  heading?: number | null;
  /** Direction of travel while moving, else null (see useLocationGate). Turns the map. */
  course?: number | null;
  obscuredBottom?: number;
  obscuredTop?: number;
  mapHidden?: boolean;
  bare?: boolean;
  onToggleBare?: () => void;
}) {
  const { theme, mapTheme, settings, update, t } = useSettings();
  const light = settings.graphics === 'light';
  /*
    THE RIDER'S PICTURES: 9 finished ones made when the ride was saved (features/ride/pictures.ts).
    A new object only when a new ride is ready, never per render: see the note on `Images` below.

    THE NAME CARRIES THE RIDE, so a new ride is a new name. The map keeps the first picture it
    was given under a name and skips any later one with the same name (MLRNImages.kt: `if
    (hasImage(imageName, mapInstance)) continue`). With fixed names, Save in Your ride changed
    nothing on the map (Clint's phone, 1.3.0).
  */
  const ridePics = useRidePictures(settings.ride, !light);
  const dark = settings.theme === 'dark';
  /** The map's own turn, rounded, so the 3D bike knows which picture to show. */
  const [mapBearing, setMapBearing] = useState(0);
  /** Zoomed out past FLAT_BELOW_ZOOM: the map is flat there whatever the mode, so the button rests. */
  const [zoomedOut, setZoomedOut] = useState(false);
  const zoomedOutRef = useRef(false);
  /**
   * COMPASS MODE, the locate button's second tap: while stopped, the map turns with the
   * phone so the headlight beam points up (lib/map/follow.ts, bearingFor). State for the
   * button's look; the ref for the camera effects, which outlive a render.
   */
  const [compass, setCompassState] = useState(false);
  const compassOn = useRef(false);
  const setCompass = (on: boolean) => {
    compassOn.current = on;
    setCompassState(on);
  };
  /** Where the camera last followed to, for the standing-still deadband. */
  const lastFollow = useRef<[number, number] | null>(null);
  const tilt = (riding = false) => (settings.map3d ? (riding ? TILT_RIDING : TILT) : 0);
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
  /** While not following: when the map was last touched and which way the rider was going. */
  const pause = useRef<Pause | null>(null);
  /** The last time the rider was moving, and the map's current turn, for `bearingFor`. */
  const lastMovingAt = useRef<number | null>(null);
  const bearingNow = useRef(0);
  /** Stop following for now; it comes back by itself (lib/map/follow.ts). */
  const pauseFollow = () => {
    following.current = false;
    pause.current = pauseAt(Date.now(), course);
  };
  const resumeFollow = () => {
    following.current = true;
    pause.current = null;
  };
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

  /* The credit line on the map: 5 seconds from when the map has drawn, then the info button. */
  const [creditDone, setCreditDone] = useState(false);
  useEffect(() => {
    if (!everLoaded) return;
    const timer = setTimeout(() => setCreditDone(true), CREDIT_MS);
    return () => clearTimeout(timer);
  }, [everLoaded]);

  /*
    Where the map opens BEFORE the first fix arrives, and the value is frozen after the
    first render. Re-deriving it would hand the camera a new object and yank it back.
  */
  const initialCentre = useMemo(
    () => (settings.area ? AREA_CENTRES[settings.area] : AREA_CENTRES.other),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const inset = useMemo(
    () => ({ top: obscuredTop, bottom: Math.round(400 * (1 - centerBias)) }),
    [centerBias, obscuredTop],
  );

  /*
    Following: each new position eases the camera to it. Not while a shop is open, because
    then the camera is framing the shop and the rider together, and not before the
    opening flight has happened.
  */
  useEffect(() => {
    if (!rider || !everLoaded || !openedOnRider.current) return;
    const now = Date.now();
    if (course !== null) lastMovingAt.current = now;
    /* Paused: does this reading bring following back (a turn, or a while untouched)? */
    if (!following.current && pause.current) {
      const r = checkResume(pause.current, course, now);
      pause.current = r.pause;
      if (r.resume) resumeFollow();
    }
    if (!shouldFollow({ following: following.current, busyUntil: flyingUntil.current, now })) return;
    /*
      ROAD AHEAD UP while moving (see bearingFor). Linear, and as long as the glide of the
      rider's dot, so the two move together and the dot stays put on screen.
    */
    const bearing = bearingFor({
      course,
      compass: compassOn.current ? heading : null,
      lastMovingAt: lastMovingAt.current,
      now,
      current: bearingNow.current,
    });
    const turning = Math.abs(bearing - bearingNow.current) > 1;
    /*
      Only for a rider who has really stopped (no movement for 20 s). Crawling in traffic
      below the 9 km/h "moving" speed still follows every reading; holding the camera there
      would make the map lag and jump in exactly the place riders are slowest.
    */
    const parked = course === null && (lastMovingAt.current === null || now - lastMovingAt.current > PARKED_AFTER_MS);
    if (parked && !turning && lastFollow.current && metresBetween(lastFollow.current, rider) < STILL_CAMERA_DEADBAND_M) return;
    bearingNow.current = bearing;
    lastFollow.current = rider;
    camera.current?.easeTo({ center: rider, bearing, pitch: tilt(course !== null), duration: 900, easing: 'linear' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rider]);

  /*
    COMPASS MODE while stopped: the compass reports far more often than the GPS, so the map
    turns here, on each heading, rather than waiting for the next position. Turns under 3
    degrees are left alone, so a hand's tremor does not keep the map twitching.
  */
  useEffect(() => {
    if (!compassOn.current || heading === null || course !== null || !rider || !everLoaded) return;
    if (!shouldFollow({ following: following.current, busyUntil: flyingUntil.current, now: Date.now() })) return;
    if (Math.abs(((((heading - bearingNow.current) % 360) + 540) % 360) - 180) < 3) return;
    bearingNow.current = heading;
    camera.current?.easeTo({ center: rider, bearing: heading, duration: 250, easing: 'linear' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heading]);

  /* The first GOOD fix, once. The dot is drawn meanwhile; only the camera waits. */
  useEffect(() => {
    if (!rider || openedOnRider.current || !everLoaded || settling) return;
    openedOnRider.current = true;
    fly(900);
    camera.current?.flyTo({ center: rider, zoom: RIDER_ZOOM, pitch: tilt(), duration: 900 });
    /* Once, on the first good fix: the tilt is read then, not watched. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    /* Looking at a shop pauses following; riding on brings it back (lib/map/follow.ts). */
    pauseFollow();

    if (!rider) {
      fly(700);
      camera.current?.flyTo({ center: shop, zoom: SHOP_ZOOM, pitch: tilt(), duration: 700 });
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
        padding: fitPadding({ hiddenTop: obscuredTop, hiddenBottom: obscuredBottom, insetTop: inset.top, insetBottom: inset.bottom }),
        pitch: tilt(),
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
      { padding: fitPadding({ hiddenTop: obscuredTop, hiddenBottom: obscuredBottom, insetTop: inset.top, insetBottom: inset.bottom }), duration: 600 },
    );
    /* Once (framedAll): the card's height is read then, not watched. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.area, rider, everLoaded, shops]);

  /* An outside request to go back to the rider. Ignored on first render. */
  useEffect(() => {
    if (recentreSignal === 0 || !rider || !everLoaded) return;
    resumeFollow();
    /*
      NO ZOOM GIVEN, DELIBERATELY: go there, change nothing else. Forcing a zoom here once
      yanked a rider who had zoomed in on their street back out to city scale.
    */
    fly(700);
    camera.current?.flyTo({ center: rider, pitch: tilt(), duration: 700 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recentreSignal]);

  /* The cube / square button: tilt into 3D or lay the map flat, where it is now. */
  const firstMode = useRef(true);
  useEffect(() => {
    if (firstMode.current) {
      firstMode.current = false;
      return;
    }
    if (!everLoaded) return;
    /* zoomTo at the current zoom: the only camera call that changes the tilt and leaves the centre alone. */
    camera.current?.zoomTo(zoomNow.current, { pitch: settings.map3d && zoomNow.current >= FLAT_BELOW_ZOOM ? TILT : 0, duration: 500 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.map3d]);

  /* Go to the city the rider just picked, framed so the whole of it is visible. */
  useEffect(() => {
    if (!frame || !everLoaded) return;
    /* The rider asked to look at a city, so the camera stops chasing them, for now. */
    pauseFollow();
    fly(800);
    const [w, south, e, n] = frame.bounds;
    /*
      Most cities are bigger than one screen at the zoom where shops show. Fitting the whole
      city would stop short of that zoom and show only its colour, with no shops at all.
    */
    if (frame.centre && Math.max(e - w, n - south) > FITS_AT_SHOP_ZOOM) {
      camera.current?.flyTo({ center: frame.centre, zoom: CITY_ZOOM, pitch: tilt(), duration: 800 });
      return;
    }
    camera.current?.fitBounds(frame.bounds, {
      padding: fitPadding({ hiddenTop: obscuredTop, hiddenBottom: obscuredBottom, insetTop: inset.top, insetBottom: inset.bottom }),
      duration: 800,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame?.nonce, everLoaded]);

  /*
    THE SHOPS, AS MAP DATA RATHER THAN AS VIEWS.

    Every shop used to be a `<Marker>`, which is a real React view that JavaScript builds,
    measures and positions. That is fine for twenty-one. The collected dataset holds two
    thousand seven hundred, and at that count the JavaScript thread simply stops.

    Handed over as one GeoJSON collection instead, the map draws them itself in native
    code, and React renders nothing per shop at all.

    Only `id`, `name` and `visited` travel with each point. Everything else the screens need is
    already in the shops array on this side; sending it again would triple the size of
    something that crosses the bridge whenever the list changes.
  */
  const collection = useMemo(() => {
    const seen = new Set(visited ?? []);
    const lately = new Set(recent ?? []);
    return {
      type: 'FeatureCollection' as const,
      features: shops.map((shop) => ({
        type: 'Feature' as const,
        id: shop.id,
        properties: { id: shop.id, name: shop.name, visited: seen.has(shop.id), recent: lately.has(shop.id), ...pinKind(shop) },
        geometry: { type: 'Point' as const, coordinates: [shop.lng, shop.lat] },
      })),
    };
  }, [shops, visited, recent]);

  const byId = useMemo(() => new Map(shops.map((shop) => [shop.id, shop])), [shops]);

  /* Rebuilt only when the focused shop or its position changes, not on every `focus` object. */
  const focusId = focus?.shop.id;
  const focusLng = focus?.shop.lng;
  const focusLat = focus?.shop.lat;
  const focusPin = focus ? `pin-${pinKind(focus.shop).cat}-${pinKind(focus.shop).st}` : 'pin-repair-unknown';
  const focusFeature = useMemo(
    () =>
      focusId !== undefined && focusLng !== undefined && focusLat !== undefined
        ? ({
            type: 'Feature',
            properties: { id: focusId },
            geometry: { type: 'Point', coordinates: [focusLng, focusLat] },
          } as GeoJSON.Feature)
        : null,
    [focusId, focusLng, focusLat],
  );

  const ringFeature = useMemo(
    () =>
      showRing && radiusM !== null && ringCentre
        ? circleAround(ringCentre, radiusM / DETOUR_FACTOR)
        : null,
    [showRing, radiusM, ringCentre],
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
      /* Opening a cluster is exploring, like dragging: stop chasing the rider, for now. */
      pauseFollow();
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
    resumeFollow();
    fly(800);
    camera.current?.flyTo({ center: rider, zoom: Math.max(zoomNow.current, LOCATE_ZOOM), pitch: tilt(), duration: 800 });
    onRecentre?.();
  };

  /*
    THE COMPASS BUTTON, as in Google Maps: shown only while the map is turned away from
    north, its needle pointing at north. One tap turns the map back to north up and ends
    compass mode. While riding, following turns the map to the road again on the next
    reading, which is what Google Maps does too.
  */
  const northUp = () => {
    setCompass(false);
    bearingNow.current = 0;
    fly(400);
    /* zoomTo at the current zoom: turns the map and leaves the centre alone. */
    camera.current?.zoomTo(zoomNow.current, { bearing: 0, duration: 400 });
  };

  /*
    THE LOCATE BUTTON. "Zoom to me" and "recentre" were two buttons riders could not tell
    apart (Clint, 31 Oct), so they are one, working like Google Maps' location button:
      1st tap: back to me at street level (LOCATE_ZOOM), and following again
               (zoomToMe: never zooms out, so a rider already closer keeps their zoom);
      2nd tap: compass mode, the map turns with the phone;
      3rd tap: back to north up (road ahead up while moving).
    "Already on me" means following and zoomed in at least that far. Dragging or pinching
    the map pauses following, so the next tap is a first tap again.
  */
  const locate = () => {
    if (!rider) return;
    tour.notify('recentre');
    const onMe = following.current && zoomNow.current >= LOCATE_ZOOM - 0.5;
    if (!onMe) {
      setCompass(false);
      zoomToMe();
      return;
    }
    const turnWithPhone = !compassOn.current && heading !== null;
    setCompass(turnWithPhone);
    const bearing = turnWithPhone && heading !== null ? heading : (course ?? 0);
    bearingNow.current = bearing;
    fly(500);
    camera.current?.easeTo({ center: rider, bearing, pitch: tilt(course !== null), duration: 500 });
  };

  /*
    THE ARROW TO THE SELECTED SHOP (Charls, 5 Nov: direction only, no live time or distance).
    Worked out from the map's own two points, not the phone's compass, so it is right in 2D and
    in 3D, works offline, and can never disagree with what the map shows.
  */
  const straightArrow =
    rider && focusLng !== undefined && focusLat !== undefined && metresBetween(rider, [focusLng, focusLat]) >= ARROW_MIN_M
      ? bearingTo(rider, [focusLng, focusLat])
      : null;

  /*
    THE ROAD LINE (Charls, 7 Nov, demo only): asked for ONCE PER TAP, from where the rider is at
    that moment, so `nonce` is what triggers it and riding on does not. Tapping again redraws it.
    Until it arrives, and whenever it does not, the rider has the straight arrow above.
  */
  const [roadLine, setRoadLine] = useState<{ shopId: string; feature: GeoJSON.Feature } | null>(null);
  useEffect(() => {
    if (!rider || focusId === undefined || focusLng === undefined || focusLat === undefined || straightArrow === null) return;
    const cancel = new AbortController();
    const shopId = focusId;
    fetchRoadLine(rider, [focusLng, focusLat], cancel.signal).then((coordinates) => {
      if (cancel.signal.aborted) return;
      setRoadLine(
        coordinates
          ? { shopId, feature: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } } }
          : null,
      );
    });
    return () => cancel.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.nonce]);
  /* Only for the shop it was drawn to. Closing the shop, or opening another, takes it away. */
  const lineToShop = roadLine && roadLine.shopId === focusId ? roadLine.feature : null;

  const s = styles(theme);

  return (
    <View style={s.wrap}>
      <MapView
        style={s.map}
        mapStyle={dark ? DARK_STYLE_URL : STYLE_URL}
        /*
          Pushes the map's optical centre upward by however much the sheet covers, so a
          shop the camera flies to does not land underneath the list.
        */
        contentInset={inset}
        attribution={false}
        logo={false}
        /*
          TWO FINGERS TURN THE MAP, as in Google Maps (Clint, 31 Oct). It was switched off
          while nothing could turn it back; the compass button now does (it appears as soon
          as the map is turned, and one tap puts north up). Turning by hand pauses
          following like any other touch (lib/map/follow.ts).
        */
        touchRotate
        /*
          A press that reached the map rather than a pin means the rider tapped empty
          space, which is how every maps app says "never mind". Without it a selected
          shop could be moved but never dismissed.
        */
        onPress={() => onClearFocus?.()}
        onDidFinishLoadingMap={() => setEverLoaded(true)}
        /*
          `userInteraction` is true only when a finger moved the map, never for our own
          camera moves, so following pauses exactly when the rider takes over, and every
          further touch restarts the wait before it comes back.
        */
        onRegionWillChange={(e) => {
          if (!e.nativeEvent.userInteraction) return;
          /*
            Taking the map by hand ends compass mode, as in Google Maps. Opening a shop or
            picking a city only pauses it: the map turns with the phone again when
            following comes back.
          */
          if (compassOn.current) setCompass(false);
          if (following.current || !pause.current) pauseFollow();
          else pause.current = { ...pause.current, lastTouchAt: Date.now() };
        }}
        onRegionDidChange={(e) => {
          zoomNow.current = e.nativeEvent.zoom;
          bearingNow.current = e.nativeEvent.bearing;
          setMapBearing(Math.round(e.nativeEvent.bearing / 10) * 10);
          const out = e.nativeEvent.zoom < FLAT_BELOW_ZOOM;
          if (out && e.nativeEvent.pitch > 2) camera.current?.zoomTo(e.nativeEvent.zoom, { pitch: 0, duration: 400 });
          /* Back in from the whole-city view: 3D tilts again by itself, no tap needed. */
          if (!out && zoomedOutRef.current && settings.map3d && e.nativeEvent.pitch < 2) {
            camera.current?.zoomTo(e.nativeEvent.zoom, { pitch: TILT, duration: 450 });
          }
          if (out !== zoomedOutRef.current) {
            zoomedOutRef.current = out;
            setZoomedOut(out);
          }
          if (e.nativeEvent.userInteraction && pause.current) pause.current = { ...pause.current, lastTouchAt: Date.now() };
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
        <Images images={light ? LIGHT_IMAGES : MAP_IMAGES} />
        {/*
          The rider's pictures on their own, keyed by the ride: when a new one is ready the old
          set's component goes away, and with it its 9 pictures (MLRNImages removes its own
          images when it leaves the map), instead of every ride tried piling up in memory.
          None in Light: the rider is a plain dot there.
        */}
        {!light && <Images key={ridePics.key} images={ridePics.images} />}

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

        {/* Only once the style has loaded: this layer reads the style's own `openmaptiles` source. */}
        {settings.map3d && everLoaded && (
          <Layer
            key="ayoos-buildings"
            id="ayoos-buildings"
            type="fill-extrusion"
            source="openmaptiles"
            source-layer="building"
            minzoom={14}
            beforeId={dark ? FIRST_LABEL.dark : FIRST_LABEL.light}
            filter={['!', ['has', 'hide_3d']]}
            paint={{
              'fill-extrusion-color': dark ? BUILDING_COLOUR.dark : BUILDING_COLOUR.light,
              'fill-extrusion-height': ['*', ['coalesce', ['get', 'render_height'], 0], BUILDING_HEIGHT],
              'fill-extrusion-base': ['*', ['coalesce', ['get', 'render_min_height'], 0], BUILDING_HEIGHT],
              'fill-extrusion-opacity': 0.6,
            }}
          />
        )}

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
          THE CITIES, COLOURED (Charls, 5 Nov), only to tell them apart, on the zoomed-out map. No
          names of our own: the base map has them, and adding ours showed most cities twice.
          Under the roads and names, so those stay readable. City outlines run out over Manila
          Bay, so a copy of the style's water goes on top of the colour to take it back off the
          sea. Only once the style has loaded: `beforeId` and the water both read the style.
        */}
        {everLoaded && (
          <GeoJSONSource
            id="city-areas"
            data={CITY_AREAS}
            onPress={(e) => {
              e.stopPropagation?.();
              const area = e.nativeEvent.features?.[0]?.properties?.area;
              if (typeof area === 'string') onPressCity?.(area as Area);
            }}
          >
            <Layer
              key="city-fill"
              id="city-fill"
              type="fill"
              /* Named, not left to mount order: the sea would stay coloured if this landed on top. */
              beforeId="city-water"
              maxzoom={FLAT_BELOW_ZOOM}
              paint={{
                'fill-color': [
                  'match', ['get', 'tone'],
                  0, CITY_TONES[0],
                  1, CITY_TONES[1],
                  2, CITY_TONES[2],
                  3, CITY_TONES[3],
                  CITY_TONES[4],
                ],
                'fill-opacity': ['interpolate', ['linear'], ['zoom'], CITY_FADE_FROM, 0.5, FLAT_BELOW_ZOOM, 0],
              }}
            />
          </GeoJSONSource>
        )}
        {everLoaded && (
          <Layer
            key="city-water"
            id="city-water"
            type="fill"
            source="openmaptiles"
            source-layer="water"
            beforeId={FIRST_ABOVE_LAND}
            maxzoom={FLAT_BELOW_ZOOM}
            paint={{ 'fill-color': dark ? WATER_COLOUR.dark : WATER_COLOUR.light }}
          />
        )}
        {everLoaded && selectedCity && (
          <GeoJSONSource id="city-selected" data={CITY_AREAS}>
            <Layer
              key="city-selected-line"
              id="city-selected-line"
              type="line"
              beforeId={dark ? FIRST_LABEL.dark : FIRST_LABEL.light}
              filter={['==', ['get', 'area'], selectedCity]}
              paint={{ 'line-color': mapTheme.accent, 'line-width': 2, 'line-opacity': 0.7 }}
            />
          </GeoJSONSource>
        )}

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
          ONE SOURCE, THREE LAYERS, NO REACT VIEWS.

          `cluster` is the whole point: the map groups shops that are too close together
          to tell apart into a single circle, and splits them as the rider zooms in. Without
          it, two thousand seven hundred pins overlap into an unreadable mass AND overwhelm
          the thread that draws them.

          NO NUMBERS ON THE GROUPS (Charls, 5 Nov): tapping a city gives its count instead. And
          nothing here below the zoom switch, where the coloured cities have the map.
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
            Groups of shops, a little bigger for bigger groups. With no number to say so, a group
            has to look nothing like a single shop. Standard: a glossy ball against a pin. Light,
            where both are flat circles: a HOLLOW ring against a solid dot, stepped so the sizes
            read as a few classes. Hollow is white, not see-through, so a road never runs through it.
          */}
          {light ? (
            <Layer
              key="shop-cluster-dot"
              id="shop-cluster-dot"
              type="circle"
              minzoom={FLAT_BELOW_ZOOM}
              filter={['has', 'point_count']}
              paint={{
                'circle-radius': ['step', ['get', 'point_count'], 8, 20, 10, 100, 12],
                'circle-color': '#FFFFFF',
                'circle-stroke-color': mapTheme.accent,
                'circle-stroke-width': 4,
              }}
            />
          ) : (
          <Layer
            key="shop-cluster"
            id="shop-cluster"
            type="symbol"
            minzoom={FLAT_BELOW_ZOOM}
            filter={['has', 'point_count']}
            layout={{
              'icon-image': 'sphere',
              /*
                SMALL WHEN ZOOMED OUT (design canvas, 30 Oct): a group grows slowly with its
                count and the whole set shrinks as the map zooms out, so the city reads first.
                The sphere picture is 96 px across at 1x.
              */
              'icon-size': [
                'interpolate', ['linear'], ['zoom'],
                10, ['interpolate', ['linear'], ['get', 'point_count'], 2, 0.17, 100, 0.24, 500, 0.29],
                14, ['interpolate', ['linear'], ['get', 'point_count'], 2, 0.26, 100, 0.32, 500, 0.36],
              ],
              'icon-allow-overlap': true,
              'icon-ignore-placement': true,
            }}
          />
          )}

          {/* A single shop, once it is no longer part of a cluster. */}
          {light ? (
            /*
              Light: a dot. Green open, grey closed, pale when unknown; a green ring says this
              rider visited.
            */
            <Layer
              key="shop-dot"
              id="shop-dot"
              type="circle"
              minzoom={FLAT_BELOW_ZOOM}
              filter={['!', ['has', 'point_count']]}
              paint={{
                'circle-radius': 6.5,
                'circle-color': [
                  'match', ['get', 'st'],
                  'open', mapTheme.open,
                  'closed', mapTheme.ink3,
                  mapTheme.accent,
                ],
                'circle-stroke-color': ['case', ['==', ['get', 'visited'], true], mapTheme.open, '#FFFFFF'],
                'circle-stroke-width': ['case', ['==', ['get', 'visited'], true], 3, 1.5],
              }}
            />
          ) : (
          <Layer
            key="shop-point"
            id="shop-point"
            type="symbol"
            minzoom={FLAT_BELOW_ZOOM}
            filter={['!', ['has', 'point_count']]}
            layout={{
              /*
                PINS, NOT DOTS. The glyph says what the shop fixes; a green dot says open;
                grey says closed; a check says this rider visited. Pictures are pin-<kind>-
                <status>[-v], drawn at 3x; a third of that is the size on screen.
              */
              'icon-image': [
                'concat', 'pin-', ['get', 'cat'], '-', ['get', 'st'],
                ['case', ['==', ['get', 'visited'], true], '-v', ''],
              ],
              'icon-size': 0.34,
              /* The tip is the shop. The picture has 4 px of shadow under the tip. */
              'icon-anchor': 'bottom',
              'icon-offset': [0, 12],
              'icon-allow-overlap': true,
            }}
          />
          )}

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
              /* A shop opened lately gets a smaller second line, as in Google Maps. */
              'text-field': [
                'case',
                ['==', ['get', 'recent'], true],
                ['format', ['get', 'name'], {}, `\n${t.recentlyViewed}`, { 'font-scale': 0.85 }],
                ['get', 'name'],
              ],
              'text-font': ['Noto Sans Regular'],
              'text-size': 12,
              'text-anchor': 'top',
              'text-offset': [0, 0.5],
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

            {/* Light: a bigger dot with a thick white ring. Each layer a direct child of the
               source (no fragment), which is how the source hands its layers their data. */}
            {light && (
              <Layer
                key="selected-dot"
                id="selected-dot"
                type="circle"
                paint={{
                  'circle-radius': 10,
                  'circle-color': mapTheme.accent,
                  'circle-stroke-color': '#FFFFFF',
                  'circle-stroke-width': 3,
                }}
              />
            )}
            {!light && (
            <Layer
              key="selected-ring"
              id="selected-ring"
              type="symbol"
              layout={{
                'icon-image': 'pin-ring',
                'icon-size': 0.45,
                /* Lying on the road, under the pin. */
                'icon-pitch-alignment': 'map',
                'icon-allow-overlap': true,
                'icon-ignore-placement': true,
              }}
            />
            )}
            {!light && (
            <Layer
              key="selected-pin"
              id="selected-pin"
              type="symbol"
              layout={{
                'icon-image': focusPin,
                'icon-size': 0.46,
                /* Anchored at its point, which is where the shop actually is. */
                'icon-anchor': 'bottom',
                'icon-offset': [0, 12],
                /* Never dropped for overlapping: the whole job is to be seen. */
                'icon-allow-overlap': true,
                'icon-ignore-placement': true,
              }}
            />
            )}
          </GeoJSONSource>
        )}

        {/*
          THE ROAD LINE: a white edge, the oxide line, and the arrow picture repeated along it. Under
          the shops and the rider, by name, because a layer that appears later otherwise lands on
          top of everything. `symbol-placement: line` lays the picture's right-hand side along the
          way the line runs; the picture points up, so a quarter turn points it down the road.
        */}
        {lineToShop && (
          <GeoJSONSource id="road-line" data={lineToShop}>
            <Layer
              key="road-line-edge"
              id="road-line-edge"
              type="line"
              beforeId={light ? 'shop-cluster-dot' : 'shop-cluster'}
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{ 'line-color': '#FFFFFF', 'line-width': 8 }}
            />
            <Layer
              key="road-line-main"
              id="road-line-main"
              type="line"
              beforeId={light ? 'shop-cluster-dot' : 'shop-cluster'}
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{ 'line-color': mapTheme.accent, 'line-width': 5 }}
            />
            <Layer
              key="road-line-arrows"
              id="road-line-arrows"
              type="symbol"
              beforeId={light ? 'shop-cluster-dot' : 'shop-cluster'}
              layout={{
                'symbol-placement': 'line',
                'symbol-spacing': 90,
                'icon-image': 'direction-arrow',
                'icon-size': 0.24,
                'icon-rotate': 90,
                'icon-rotation-alignment': 'map',
                'icon-pitch-alignment': 'map',
                'icon-allow-overlap': true,
                'icon-ignore-placement': true,
              }}
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
          rider. The beam image has its apex at the centre of its own square for that
          reason: rotating it sweeps the wedge around the rider rather than orbiting it.

          `circle-radius` and icon sizes are SCREEN pixels, not metres, so the whole mark
          keeps its size as the rider zooms — which a geographic circle would not.
        */}

        {/*
          THE RIDER, drawn by its own component so that gliding it between readings
          (several redraws a second while riding) redraws only the rider, not the whole
          map with its two thousand shops.
        */}
        <RiderMark
          rider={rider}
          heading={heading}
          riderLive={riderLive}
          glide={course != null && !light}
          light={light}
          frame={settings.map3d && !zoomedOut ? frameFor(heading, mapBearing) : null}
          pictures={ridePics.key}
          scale={sizeScale(settings.ride.size)}
          arrow={lineToShop ? null : straightArrow}
        />

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
      {!mapHidden && !bare && !light && (
        <Pressable
          onPress={() => update({ map3d: !settings.map3d })}
          /*
            RESTING when zoomed out to the whole city: the map is flat there in either mode,
            so a tap changed nothing visible and read as broken (Clint, 30 Oct). It wakes as
            soon as the rider zooms back in.
          */
          disabled={zoomedOut}
          style={({ pressed }) => [s.locBtn, { bottom: obscuredBottom + (rider ? 68 : 14) }, pressed && s.pressed, zoomedOut && s.resting]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityState={{ disabled: zoomedOut }}
          accessibilityLabel={settings.map3d ? t.view2d : t.view3d}
        >
          {/* A cube while 3D; a flat square, on a filled button, while 2D. */}
          <View style={[s.locOuter, !settings.map3d && s.locOuterOn]}>
            {settings.map3d ? <CubeIcon size={21} color={theme.ink} /> : <SquareIcon size={20} color={theme.bg} />}
          </View>
        </Pressable>
      )}
      {/*
        MAP ONLY (Clint, 31 Oct): hides the search, the chips, the notices, the shop panel
        and the other map buttons, to look at the map alone; the same button, or Back,
        brings everything back. The map credit stays: the licence requires it visible.
      */}
      {!mapHidden && onToggleBare && !light && (
        <Pressable
          onPress={onToggleBare}
          style={({ pressed }) => [s.locBtn, { bottom: obscuredBottom + (bare ? 14 : rider ? 122 : 68) }, pressed && s.pressed]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={bare ? 'Show the controls again' : 'Show only the map'}
        >
          <View style={[s.locOuter, bare && s.locOuterOn]}>
            <MapOnlyIcon on={bare} size={21} color={bare ? theme.bg : theme.ink} />
          </View>
        </Pressable>
      )}
      {!mapHidden && !bare && mapBearing % 360 !== 0 && (
        <Pressable
          onPress={northUp}
          style={({ pressed }) => [s.compassBtn, light && s.flat, { top: obscuredTop + 18 }, pressed && s.pressed]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Turn the map to north up"
        >
          <View style={{ transform: [{ rotate: `${-mapBearing}deg` }] }}>
            <NeedleIcon size={22} />
          </View>
        </Pressable>
      )}
      {rider && !mapHidden && !bare && (
        <Pressable
          ref={recentreRef}
          onPress={locate}
          style={({ pressed }) => [s.locBtn, { bottom: obscuredBottom + 14 }, pressed && s.pressed]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityState={{ selected: compass }}
          accessibilityLabel={compass ? 'Turn the map back to north' : 'Go to my location'}
        >
          {/* A crosshair; a filled arrow while the map turns with the phone. */}
          <View style={[s.locOuter, light && s.flat, compass && s.locOuterOn]}>
            {compass ? <CompassIcon size={21} color={theme.bg} /> : <CrosshairIcon size={21} color={theme.ink} />}
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
            { text: 'Report a map error', onPress: () => Linking.openURL(OSM_FIX) },
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
      {everLoaded && !creditDone && !mapHidden && (
        <View style={[s.creditLine, { bottom: obscuredBottom + 10 }]} pointerEvents="none">
          <Text style={s.creditText}>{CREDIT_LINE}</Text>
        </View>
      )}
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
    /*
      Bottom RIGHT, as in Google Maps (Clint, 31 Oct): under a right thumb, and where
      riders who use Google Maps already reach for the locate button.
    */
    locBtn: { position: 'absolute', right: 14 },
    pressed: { opacity: 0.6 },
    /* Floating over the map: round, lifted by a soft shadow, no outline. */
    locOuter: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: theme.surface,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 5,
      shadowColor: '#28180C',
      shadowOpacity: 0.18,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
    },
    /* The 2D button is filled, so the non-default mode is obvious at a glance. */
    locOuterOn: { backgroundColor: theme.ink },
    /* Graphics: Light. No shadow (cheaper to draw), a thin outline instead. */
    flat: { elevation: 0, shadowOpacity: 0, borderWidth: 1, borderColor: theme.line },
    /* Under the help button, the same size, on the same right-hand edge (index.tsx floatTop). */
    compassBtn: {
      position: 'absolute',
      right: 14,
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.surface,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 5,
      shadowColor: '#28180C',
      shadowOpacity: 0.14,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
    },
    resting: { opacity: 0.4 },



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
      Bottom LEFT, opposite the locate button. The corner the rider presses often should
      not share a corner with the one they press never.
    */
    /* Beside the info button, for the first 5 seconds. */
    creditLine: {
      position: 'absolute',
      left: 42,
      height: 24,
      paddingHorizontal: 8,
      borderRadius: 12,
      backgroundColor: theme.surface,
      justifyContent: 'center',
      opacity: 0.9,
    },
    creditText: { fontSize: 11, color: theme.ink2 },
    attrib: {
      position: 'absolute',
      left: 12,
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: theme.surface,
      alignItems: 'center',
      justifyContent: 'center',
      opacity: 0.8,
    },
  });

/**
 * GLIDING BETWEEN READINGS. The GPS reports about once a second; drawing each reading as
 * it lands makes a moving bike hop. While the rider moves (`on`), the drawn point slides
 * from where it is to the new reading over the next second, in step with the camera,
 * which eases there over the same time. Stopped, it simply jumps: nothing is moving.
 */
const GLIDE_MS = 900;
const GLIDE_FRAME_MS = 60;

function useGlide(target: [number, number] | null, on: boolean): [number, number] | null {
  const [drawn, setDrawn] = useState<[number, number] | null>(target);
  const from = useRef<[number, number] | null>(target);
  useEffect(() => {
    if (!target) return;
    let frame = 0;
    if (!on || !from.current) {
      frame = requestAnimationFrame(() => {
        from.current = target;
        setDrawn(target);
      });
      return () => cancelAnimationFrame(frame);
    }
    const start = from.current;
    const t0 = Date.now();
    let last = 0;
    const tick = () => {
      const k = Math.min(1, (Date.now() - t0) / GLIDE_MS);
      const p: [number, number] = [start[0] + (target[0] - start[0]) * k, start[1] + (target[1] - start[1]) * k];
      from.current = p;
      if (k === 1 || Date.now() - last >= GLIDE_FRAME_MS) {
        last = Date.now();
        setDrawn(p);
      }
      if (k < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, on]);
  return target ? (drawn ?? target) : null;
}

function RiderMark({
  rider,
  heading,
  riderLive,
  glide,
  frame,
  pictures,
  scale,
  arrow,
  light = false,
}: {
  rider: [number, number] | null;
  heading: number | null;
  riderLive: boolean;
  glide: boolean;
  /** Which of the 8 pictures fits the map's turn in 3D, or null for the 2D bike from above. */
  frame: number | null;
  /** The ride's finished pictures on the map are named after this (features/ride/pictures.ts). */
  pictures: string;
  /** Your ride's size: S, M or L as a multiple of the default. */
  scale: number;
  /** Degrees clockwise from north to the selected shop, or null for no arrow. */
  arrow: number | null;
  /** Graphics: Light. One glow ring instead of five. */
  light?: boolean;
}) {
  const { mapTheme } = useSettings();
  const drawn = useGlide(rider, glide);
  /*
    MEMOISED: a native component re-reads a prop whose identity changed even when the
    values are the same.
  */
  const feature = useMemo(
    () =>
      drawn
        ? ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: drawn } } as GeoJSON.Feature)
        : null,
    [drawn],
  );
  if (!feature) return null;
  return (
      <GeoJSONSource id="rider" data={feature}>
        {/*
          The glow, as five stacked circles. React Native cannot blur a shape and
          neither can a style layer, so a soft edge is built by accumulating faint
          ones. Fewer, larger steps band into visible rings instead of glowing.
        */}
        {(light ? AURA.slice(2, 3) : AURA).map(({ size: ring, opacity }) => (
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

        {/*
          THE HEADLIGHT BEAM: which way the phone is pointing, drawn as a warm fan of light
          that fades with distance, not a flat cone (Clint, 31 Oct). Laid flat on the map
          (`pitch-alignment: map`), so in 3D it lies on the road ahead of the bike like real
          headlight on tarmac. Absent entirely until the compass reports.
        */}
        {heading !== null && (
          <Layer
            key="rider-beam"
            id="rider-beam"
            type="symbol"
            layout={{
              'icon-image': 'headlight-beam',
              'icon-size': byZoom(0.62),
              'icon-rotate': heading,
              'icon-rotation-alignment': 'map',
              'icon-pitch-alignment': 'map',
              'icon-allow-overlap': true,
              'icon-ignore-placement': true,
            }}
            paint={{ 'icon-opacity': riderLive ? 1 : 0.45 }}
          />
        )}


        {/*
          THE ARROW TO THE SELECTED SHOP, lying on the road like the beam, under the bike. Anchored
          at its tail and turned about it, so it swings round the rider; the offset leaves a gap
          for the bike and turns with it.
        */}
        {arrow !== null && (
          <Layer
            key="rider-arrow"
            id="rider-arrow"
            type="symbol"
            layout={{
              'icon-image': 'direction-arrow',
              'icon-size': byZoom(0.34),
              'icon-anchor': 'bottom',
              'icon-offset': [0, -46],
              'icon-rotate': arrow,
              'icon-rotation-alignment': 'map',
              'icon-pitch-alignment': 'map',
              'icon-allow-overlap': true,
              'icon-ignore-placement': true,
            }}
            paint={{ 'icon-opacity': riderLive ? 1 : 0.5 }}
          />
        )}

        {/*
          3D: the finished picture for the rider's direction relative to the map, standing up
          toward the camera. While riding the map turns with the rider, so this is the bike seen
          from behind. ONE layer, whatever the ride has on it: the parts were put together when
          it was saved.
        */}
        {frame !== null && (
          <Layer
            key="rider-3d"
            id="rider-3d"
            type="symbol"
            layout={{
              'icon-image': `${pictures}-m${frame}`,
              'icon-size': byZoom(BIKE_3D_SIZE * scale),
              'icon-offset': [0, BIKE_3D_LIFT],
              'icon-pitch-alignment': 'viewport',
              'icon-rotation-alignment': 'viewport',
              'icon-allow-overlap': true,
              'icon-ignore-placement': true,
            }}
            paint={{ 'icon-opacity': riderLive ? 1 : 0.5 }}
          />
        )}

        {/* Light: the rider is a plain dot with a white ring, the classic location mark. */}
        {light && (
          <Layer
            key="rider-dot"
            id="rider-dot"
            type="circle"
            paint={{
              'circle-radius': byZoom(8),
              'circle-color': mapTheme.accent,
              'circle-stroke-color': '#FFFFFF',
              'circle-stroke-width': 3,
              'circle-opacity': riderLive ? 1 : 0.5,
              'circle-stroke-opacity': riderLive ? 1 : 0.5,
            }}
          />
        )}

        {/* 2D: the same ride from straight above, turned with the heading. */}
        {frame === null && !light && (
          <Layer
            key="rider-2d"
            id="rider-2d"
            type="symbol"
            layout={{
              'icon-image': `${pictures}-top`,
              'icon-size': byZoom(BIKE_2D_SIZE * scale),
              /*
                Points north until the compass reports. A motorcycle has to point
                somewhere, and north is the one direction that is not a claim.
              */
              'icon-rotate': heading ?? 0,
              'icon-rotation-alignment': 'map',
              'icon-allow-overlap': true,
              'icon-ignore-placement': true,
            }}
            paint={{ 'icon-opacity': riderLive ? 1 : 0.5 }}
          />
        )}

      </GeoJSONSource>
  );
}
