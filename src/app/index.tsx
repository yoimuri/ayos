import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BackHandler,
  FlatList,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { BrandHeader, Wordmark } from '@/components/BrandBar';
import { ContactCard } from '@/components/ContactCard';
import { ShopSheet, sheetTop, type SheetPosition } from '@/components/ShopSheet';
import { ShopDetailsBody, ShopDetailsHeader } from '@/components/ShopDetails';
import { ContactIcon, ExpandIcon, GearIcon, NavIcon, SearchIcon } from '@/components/icons';
import { SurveyPrompt } from '@/components/SurveyPrompt';
import {
  AccuracyBanner,
  FindingBanner,
  LocationBanner,
  LocationCard,
  PreciseBanner,
} from '@/components/LocationNotice';
import { MapBoundary } from '@/components/MapBoundary';
import { RealMap } from '@/components/RealMap';
import { TourProvider, useTourController, type TourStep } from '@/components/Tour';
import { useOnline } from '@/lib/net/useOnline';
import { useLocationGate } from '@/lib/location/useLocationGate';
import { useShops } from '@/lib/data/shops';
import type { Shop } from '@/lib/data/types';
import { RADIUS_OPTIONS, shopsForArea, splitDistance } from '@/lib/geo/distance';
import { AREA_CENTRES, AREA_LABELS, useSettings, type Area } from '@/lib/settings/store';

/**
 * Home. Map on top, and underneath it one panel that shows EITHER the list of shops OR
 * the one shop the rider opened.
 *
 * The map stays in view unless the rider drags the panel all the way up. Opening a shop does not leave this
 * screen: the list is swapped for the details and the camera frames the shop and the
 * rider together, so distance and direction are visible while the rider reads.
 */



/**
 * The busiest square kilometre in a set of shops, as [longitude, latitude].
 *
 * Buckets every shop into a grid about a kilometre across, takes the fullest bucket, and
 * returns the average of what is in it. Linear, so it costs nothing even for the largest
 * area — the exact version, asking of every shop how many others are within a kilometre,
 * is quadratic and did not finish in a reasonable time on 727 shops.
 *
 * The approximation gives 390 of the exact method's 451, and more importantly it never
 * lands on an empty gap, which is the failure that matters.
 */
const HUB_CELL = 0.009; // about one kilometre of latitude

function hubOf(shops: Shop[]): [number, number] {
  const buckets = new Map<string, Shop[]>();
  let best: Shop[] = [];
  for (const shop of shops) {
    const key = `${Math.round(shop.lat / HUB_CELL)},${Math.round(shop.lng / HUB_CELL)}`;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.push(shop);
      if (bucket.length > best.length) best = bucket;
    } else {
      const made = [shop];
      buckets.set(key, made);
      if (made.length > best.length) best = made;
    }
  }
  const lng = best.reduce((sum, shop) => sum + shop.lng, 0) / best.length;
  const lat = best.reduce((sum, shop) => sum + shop.lat, 0) / best.length;
  return [lng, lat];
}

/** The smallest box containing every shop given, as [west, south, east, north]. */
function boundsOf(shops: Shop[]): [number, number, number, number] {
  let w = 180;
  let e = -180;
  let south = 90;
  let n = -90;
  for (const shop of shops) {
    if (shop.lng < w) w = shop.lng;
    if (shop.lng > e) e = shop.lng;
    if (shop.lat < south) south = shop.lat;
    if (shop.lat > n) n = shop.lat;
  }
  return [w, south, e, n];
}

export default function HomeScreen() {
  const { theme, t, settings, update } = useSettings();
  const router = useRouter();

  const [query, setQuery] = useState('');
  /* The suggestion list under the search box: open while typing, closed once one is picked. */
  const [suggestOpen, setSuggestOpen] = useState(false);
  /* The thank-you popup asking the rider questions. */
  const [surveyAsk, setSurveyAsk] = useState(false);
  const [cityOpen, setCityOpen] = useState(false);
  /*
    NEAR ME. True from launch: a rider opening the app wants what is around
    them NOW, so the list is measured from their position and the band names the city they
    are standing in. Picking a city from the picker turns it off; "Current location" or the
    recentre button turns it back on. The city chosen on the welcome screen is only the
    fallback for when there is no location at all.

    The list is NOT cut off at the city's border in this mode. Standing in Quezon City
    near the Manila line, the nearest shops can be across it, and hiding them because of a
    municipal boundary would be exactly wrong for someone with a broken bike.
  */
  const [nearMe, setNearMe] = useState(true);
  /* The shop whose contact card is open, from the list's contact button. */
  const [contactShop, setContactShop] = useState<Shop | null>(null);
  /*
    The area below the brand band, measured rather than assumed. The sheet needs a
    real number to compute its resting positions against, and the band's height
    changes with the phone's status bar and the rider's font size.
  */
  const [stageH, setStageH] = useState(0);
  const [sheetAt, setSheetAt] = useState<SheetPosition>('both');
  /* Null while the first check is still running; treated as online until proven otherwise. */
  const online = useOnline();
  /*
    The shop the rider last tapped, so the map can fly to it.

    The `nonce` exists because tapping the SAME shop twice has to move the camera twice.
    Without it the second tap changes nothing React can see, the effect does not re-run,
    and the map sits still after the rider has panned away and tapped again.
  */
  /*
    Location, with exactly one owner. The map used to ask for permission itself, which
    meant two things could raise a dialog independently.
  */
  const gate = useLocationGate();
  /*
    The card shows once per app open while location is off, then never again until the
    next launch — dismissing it leaves the quiet banner instead. `useRef` rather than
    state for the "already shown" flag, because it must not itself cause a re-render.
  */
  const [cardOpen, setCardOpen] = useState(false);
  const cardShown = useRef(false);
  useEffect(() => {
    if (gate.status === 'checking' || gate.status === 'ready') return;
    if (cardShown.current) return;
    cardShown.current = true;
    setCardOpen(true);
  }, [gate.status]);

  const [focus, setFocus] = useState<{ shop: Shop; nonce: number } | null>(null);
  /*
    Bumped whenever the rider changes city, so the map re-frames. A nonce rather than the
    area name alone, because picking the same city twice is still a request to go back to
    it after panning away.
  */
  const [frameNonce, setFrameNonce] = useState(0);
  /** Bumped to ask the map to fly back to the rider. */
  const [recentreNonce, setRecentreNonce] = useState(0);
  /*
    OPENING A SHOP. One tap on a list row or a map pin: the panel shows that shop, the
    camera frames the shop and the rider (see RealMap's focus effect), and the pin is
    highlighted. `focus` is both the highlighted pin and the open shop, so the two can
    never disagree.
  */
  const openShop = useCallback((shop: Shop) => {
    setFocus((f) => ({ shop, nonce: (f?.nonce ?? 0) + 1 }));
    setSheetAt('both');
  }, []);
  const closeShop = () => setFocus(null);

  /*
    The phone's back button closes an open shop before it does anything else. Riders who
    are not confident with phones press Back to undo; leaving the app instead would lose
    their place.
  */
  useEffect(() => {
    if (!focus) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setFocus(null);
      return true;
    });
    return () => sub.remove();
  }, [focus]);
  /* Held so the wordmark can send a long list back to the top. */
  const listRef = useRef<FlatList<Shop>>(null);

  /*
    Whichever dataset the rider has selected, with distances measured from where they
    actually are. The draft set carries invented distances; the surveyed set has
    coordinates, so its distances are computed from the current position.
  */
  const allShops = useShops(gate.position, settings.area);
  /*
    The open shop as the LATEST list describes it. `focus` holds the object from the
    moment it was tapped; its distance and open/closed state go stale as the rider moves.
  */
  const openNow = focus ? (allShops.find((x) => x.id === focus.shop.id) ?? focus.shop) : null;

  /*
    WHERE "WITHIN 2 KM" IS MEASURED FROM.

    The rider, unless they have picked a city — in which case that city, because picking
    one means "show me that place" and a circle around the rider would exclude all of it.
    Standing in QC, five of seven cities returned nothing at any radius before this.
  */
  /** Which of the app's areas the rider is standing in, by nearest centroid. */
  /*
    WHICH CITY THE RIDER IS IN: the city of the NEAREST SHOP. Each shop's city
    comes from its own address, so this borrows the most local fact the app has. The old
    nearest-city-centre guess was wrong for a third of shops, and would have been as wrong
    for riders.
  */
  const riderArea: Area | null = useMemo(() => {
    if (!gate.position || allShops.length === 0) return null;
    let nearest = allShops[0];
    for (const shop of allShops) if (shop.distance_m < nearest.distance_m) nearest = shop;
    return nearest.area === 'other' ? null : nearest.area;
  }, [gate.position, allShops]);

  /* The city the list is limited to: none in near-me mode, when there is a position. */
  const activeArea: Area | null = nearMe && gate.position ? null : settings.area;
  /* What the band calls the place being shown. */
  const nearMeOn = nearMe && !!gate.position && settings.radiusM != null;
  const placeName = activeArea
    ? AREA_LABELS[activeArea]
    : nearMeOn
      ? riderArea
        ? AREA_LABELS[riderArea]
        : t.currentLocation
      : settings.radiusM != null
        ? t.currentLocation
        : t.allCities;

  const filterOrigin: [number, number] | null = useMemo(() => {
    if (!activeArea) return gate.position;
    /*
      IF THE RIDER IS STANDING IN THE CITY THEY PICKED, MEASURE FROM THEM.

      Otherwise the circle would sit at the city's middle while the rider stands at its
      edge, and "within 2 km" would mean two kilometres of somewhere they are not. The
      city centre is only the right origin for a city they are looking at from afar.
    */
    if (riderArea === activeArea && gate.position) return gate.position;
    /*
      WHERE THE SHOPS ACTUALLY ARE, WHICH IS NOT THE MIDDLE OF THE CITY.

      Averaging every shop was the first attempt and it was badly wrong at small radii:
      a city's mean position falls wherever its sprawl balances, which is often a gap
      between clusters. At 1 km, Makati, Caloocan and Parañaque all returned NOTHING,
      which is exactly the emptiness this was meant to cure.

      `hubOf` finds the busiest square kilometre instead. Across the seven areas that
      takes shops-within-1-km from 79 to 390.
    */
    const inArea = allShops.filter((shop) => shop.area === activeArea);
    if (inArea.length === 0) return AREA_CENTRES[activeArea];
    return hubOf(inArea);
  }, [allShops, activeArea, gate.position, riderArea]);

  /*
    What "near me" would show, for the picker. Uses the radius already chosen, falling
    back to 5 km, so the number beside the option is the number the rider will get.
  */
  const nearMeCount = useMemo(
    () =>
      gate.position
        ? shopsForArea(allShops, null, settings.radiusM ?? 5000, gate.position).length
        : 0,
    [allShops, settings.radiusM, gate.position],
  );

  /** Shops for the chosen area, already distance-sorted by the data layer. */
  const areaShops = useMemo(
    () => shopsForArea(allShops, activeArea, settings.radiusM, filterOrigin),
    [allShops, activeArea, settings.radiusM, filterOrigin],
  );
  /* Unfiltered count for the city chips, so a chip never reads 0 just because of radius. */
  const cityCounts = useMemo(() => {
    const counts: Partial<Record<Area, number>> = {};
    (Object.keys(AREA_LABELS) as Area[]).forEach((a) => {
      counts[a] = shopsForArea(allShops, a, null).length;
    });
    return counts;
  }, [allShops]);

  /*
    Filtering happens on every keystroke because `query` is state and this recomputes.
    There is no search button and no debounce: the whole list is already on the device,
    so matching a dozen names costs nothing. Pressing enter just dismisses the keyboard.
  */
  const shops = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return areaShops;
    return areaShops.filter(
      (shop) =>
        shop.name.toLowerCase().includes(needle) ||
        shop.tags.some((tag) => tag.includes(needle)),
    );
  }, [areaShops, query]);

  /* The nearest shop, for the tutorial step that needs a shop open to point at. */
  const shopsRef = useRef<Shop[]>([]);
  useEffect(() => {
    shopsRef.current = shops;
  }, [shops]);

  /*
    THE TUTORIAL'S STEPS, in the order a first-time rider needs them: find a shop, reach
    it, get back, look further, find yourself, and how to see this again. Each points at
    the real control. `before` puts a step's control on screen when it is not already.
  */
  /*
    SEARCH SUGGESTIONS: up to three shops whose name matches, nearest first,
    from ALL shops rather than only those inside the radius, because someone typing a name
    is looking for that shop wherever it is. Two letters before anything shows, so a single
    keystroke does not throw up three random shops.
  */
  const suggestions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle.length < 2) return [];
    return allShops
      .filter((shop) => shop.name.toLowerCase().includes(needle))
      .sort((a, b) => a.distance_m - b.distance_m)
      .slice(0, 3);
  }, [allShops, query]);
  /* Picking one opens it exactly as a list tap does: map frames shop and rider, panel shows it. */
  const pickSuggestion = (shop: Shop) => {
    setSuggestOpen(false);
    setQuery('');
    Keyboard.dismiss();
    openShop(shop);
  };
  /* The keyboard's search key and the magnifier both take the top suggestion. */
  const submitSearch = () => {
    if (suggestions[0]) pickSuggestion(suggestions[0]);
    else Keyboard.dismiss();
  };

  const tourSteps = useMemo<TourStep[]>(
    () => [
      {
        target: 'sheet-grab',
        text: t.tourDrag,
        advance: 'next',
        before: () => {
          setFocus(null);
          setSheetAt('both');
        },
      },
      {
        target: 'list-row',
        text: t.tourList,
        advance: 'tap',
        before: () => {
          setFocus(null);
          setSheetAt('both');
        },
      },
      {
        target: 'details-actions',
        text: t.tourActions,
        advance: 'next',
        before: () => {
          const nearest = shopsRef.current[0];
          if (nearest) openShop(nearest);
        },
      },
      { target: 'details-back', text: t.tourBackToList, advance: 'tap' },
      { target: 'radius', text: t.tourRadius, advance: 'tap', before: () => setFocus(null) },
      {
        target: 'recentre',
        text: t.tourRecentre,
        advance: 'tap',
        /* In List mode the map, and this button on it, are hidden behind the panel. */
        before: () => setSheetAt('both'),
      },
      { target: 'help', text: t.tourHelp, advance: 'next' },
    ],
    [t, openShop],
  );

  /*
    THE TUTORIAL starts by itself once, the first time this screen appears after the
    welcome questions. After that only the ? button or Settings -> "Show the tutorial
    again" starts it (both simply clear `tourDone`).

    `tourDone` is set the moment it STARTS, not when it finishes, so a rider who closes the
    app halfway through is never made to sit through it again.
  */
  const tour = useTourController(tourSteps);
  const { start: tourStart, register: tourRegister, notify: tourNotify, running: tourRunning } = tour;
  const startTour = useCallback(() => {
    update({ tourDone: true });
    tourStart();
  }, [update, tourStart]);
  useEffect(() => {
    if (!settings.onboarded || settings.tourDone) return;
    /* A moment for the list and map to lay out, so the first hole lands on a real row. */
    const timer = setTimeout(startTour, 900);
    return () => clearTimeout(timer);
  }, [settings.onboarded, settings.tourDone, startTour]);
  /*
    THE RIDER QUESTIONS POPUP. Once per rider, never on top of anything:
    not before the welcome screen is done, not while the tutorial runs (on first launch
    it appears as the tutorial ends), not over the location card. A rider who already
    answered on an older version is never asked again.
  */
  const alreadyAnswered = Object.keys(settings.survey ?? {}).length > 0;
  useEffect(() => {
    if (!settings.onboarded || !settings.tourDone || tourRunning || cardOpen) return;
    if (settings.surveyState !== 'unasked' || alreadyAnswered) return;
    const timer = setTimeout(() => setSurveyAsk(true), 700);
    return () => clearTimeout(timer);
  }, [settings.onboarded, settings.tourDone, settings.surveyState, tourRunning, cardOpen, alreadyAnswered]);

  /* Tour targets on this screen. Stable functions, so a re-render never re-registers. */
  const helpRef = useCallback((n: View | null) => tourRegister('help', n), [tourRegister]);
  const radiusRef = useCallback((n: View | null) => tourRegister('radius', n), [tourRegister]);
  const firstRowRef = useCallback((n: View | null) => tourRegister('list-row', n), [tourRegister]);
  const openFromTap = (shop: Shop) => {
    openShop(shop);
    tourNotify('list-row');
  };

  const s = styles(theme);

  return (
    <TourProvider tour={tour}>
    <SafeAreaView style={s.screen} edges={['top', 'bottom']}>
      {/*
        Everything that answers "where am I looking" lives in the band: the wordmark,
        search, the city and settings. Everything below it is results.
      */}
      <BrandHeader>
        <View style={s.bandTop}>
          <Wordmark size={25} />
          <Text style={s.bandArea} numberOfLines={1}>
            {activeArea || nearMeOn || settings.radiusM != null
              ? placeName.toUpperCase()
              : 'METRO MANILA'}
          </Text>
          <View style={s.grow} />
          {/*
            SHOW / HIDE SEARCH. Folding the box away gives the map more room;
            the choice is remembered. The arrow points the way the box will move.
          */}
          <Pressable
            onPress={() => {
              if (!settings.searchHidden) {
                setQuery('');
                Keyboard.dismiss();
              }
              update({ searchHidden: !settings.searchHidden });
            }}
            style={({ pressed }) => [s.bandIconBtn, pressed && s.pressed]}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={settings.searchHidden ? t.showSearch : t.hideSearch}
          >
            <ExpandIcon open={!settings.searchHidden} size={24} color={theme.bandInk} />
          </Pressable>
          {/*
            HELP, where it can always be found. Replays the tutorial. A question mark
            rather than a word: it is understood without reading, and it is the mark the
            tutorial's last step points at.
          */}
          <Pressable
            ref={helpRef}
            onPress={() => (tourRunning ? tourNotify('help') : startTour())}
            style={s.bandIconBtn}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t.help}
          >
            <Text style={s.helpGlyph}>?</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/settings')}
            style={s.bandIconBtn}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t.settings}
          >
            <GearIcon size={19} color={theme.bandInk} />
          </Pressable>
        </View>

        {!settings.searchHidden && (
          <View style={s.searchWrap}>
            <TextInput
              value={query}
              onChangeText={(text) => {
                setQuery(text);
                setSuggestOpen(true);
              }}
              onSubmitEditing={submitSearch}
              placeholder={t.findShop}
              placeholderTextColor={theme.ink3}
              style={s.search}
              returnKeyType="search"
              autoCorrect={false}
              accessibilityLabel={t.findShop}
            />
            {/* The magnifier is a button: it does what the keyboard's search key does. */}
            <Pressable
              onPress={submitSearch}
              style={s.searchIconBtn}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t.findShop}
            >
              <SearchIcon size={22} color={theme.ink3} />
            </Pressable>
            {query.length > 0 && (
              <Pressable onPress={() => setQuery('')} style={s.clearBtn} hitSlop={8}>
                <Text style={s.clearGlyph}>✕</Text>
              </Pressable>
            )}
          </View>
        )}

        {!settings.searchHidden && suggestOpen && suggestions.length > 0 && (
          <View style={s.suggestBox}>
            {suggestions.map((shop) => (
              <Pressable
                key={shop.id}
                onPress={() => pickSuggestion(shop)}
                style={({ pressed }) => [s.suggestRow, pressed && s.rowPressed]}
                accessibilityRole="button"
                accessibilityLabel={`Open ${shop.name}`}
              >
                <Text style={s.suggestName} numberOfLines={1}>
                  {shop.name}
                </Text>
                <Text style={s.suggestMeta} numberOfLines={1}>
                  ≈ {splitDistance(shop.distance_m).value} {t.km.toLowerCase()} · {AREA_LABELS[shop.area]}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        <View style={s.bandBottom}>
          <Pressable
            onPress={() => setCityOpen(true)}
            style={s.cityPill}
            accessibilityRole="button"
            accessibilityLabel="Change city"
          >
            {/* The pin says "measured from where you are", not "limited to this city". */}
            {nearMeOn && <NavIcon size={15} color={theme.bandInk} />}
            <Text style={s.cityPillText} numberOfLines={1}>
              {placeName}
            </Text>
            <ExpandIcon open={false} size={18} color={theme.bandInk2} />
          </Pressable>
          {/*
            The list's date is not shown here; it appears in the offline banner, the moment
            it matters (ConnectionBanner.tsx).
          */}
        </View>
      </BrandHeader>

      {/*
        The map is the screen now. It sits behind everything below the band and fills
        whatever space is left, and the list rides over it in a sheet the rider can
        drag down to get the map back.

        `centerBias` lifts the map's visual centre when the sheet is covering the
        bottom half, so the pins and the "you are here" dot stay in the part of the
        map that is actually visible instead of hiding under the list.
      */}
      <View style={s.stage} onLayout={(e: LayoutChangeEvent) => setStageH(e.nativeEvent.layout.height)}>
        {/*
          Two maps, one switch in Settings. The drawn one needs no network and no tile
          server; the real one needs data the first time and then keeps working from its
          own cache. Both take the same shops, so switching compares like with like.
        */}
        {/*
          The map is wrapped so a JavaScript error in it SHOWS ITSELF rather than taking
          the whole app down. Only the map: the list, search and phone numbers underneath
          are what a stranded rider actually needs, and they should survive a broken map.
        */}
        <MapBoundary>
            <RealMap
            shops={shops}
            focus={focus}
            /* A pin opens the shop in the panel, exactly as its list row does. */
            onPressPin={openFromTap}
            centerBias={sheetAt === 'map' ? 0.47 : 0.3}
            online={online !== false}
            rider={gate.position}
            riderLive={gate.status === 'ready' && !gate.stale}
            settling={gate.finding}
            onRecentre={() => {
              void gate.refresh();
              /*
                Recentring is "take me back to me", so the list follows too: back to near-me
                mode, measured from the rider, with their city named in the band.
              */
              setNearMe(true);
            }}
            radiusM={settings.radiusM}
            showRing={settings.showRadiusRing}
            /* The ring sits where the radius is measured from, so it explains itself. */
            ringCentre={filterOrigin}
            /*
              The bounds of whatever the rider just picked, so the map goes there. Null
              when no city is chosen: the camera should stay wherever they left it.
            */
            recentre={recentreNonce}
            frame={
              /*
                `frameNonce > 0` means the rider has actually picked a city from the
                picker. Without that guard, RECENTRE would re-frame: it sets the city to
                wherever the rider is standing, which would turn `frame` from null into a
                value, fire the effect, and fit the whole city — overriding the fly-to-me
                that recentring exists to do.
              */
              frameNonce > 0 && activeArea && areaShops.length > 0
                ? { bounds: boundsOf(areaShops), nonce: frameNonce }
                : null
            }
            /* Tapping empty map is "never mind": it closes the open shop. */
            onClearFocus={closeShop}
            heading={gate.heading}
            /* Everything below the sheet's top edge is hidden, so controls sit above it. */
            obscuredBottom={stageH - sheetTop(sheetAt, stageH)}
            mapHidden={sheetAt === 'list'}
            />
        </MapBoundary>

        {/*
          Stays until location is actually on. A rider who dismissed the card would
          otherwise have to relaunch the app to find the offer again.
        */}
        {gate.status !== 'checking' &&
          gate.status !== 'ready' &&
          !cardOpen && (
            <LocationBanner status={gate.status} onPress={() => setCardOpen(true)} />
          )}

        {/*
          Location is working, but not well enough to say which side of the road you are
          on. 50 metres is about one Metro Manila block, which is the point at which the
          dot stops answering the question the rider actually asked.
        */}
        {/*
          "Finding your location" first (a state, never an error), and only once
          that has settled or timed out, the rough-fix banner if the result is still poor.
          Never both at once.
        */}
        {/*
          Approximate location beats every other notice: with it on, nothing about where
          the rider is can be trusted, and the fix is one switch.
        */}
        {gate.status === 'ready' && gate.precise === false && (
          <PreciseBanner onPress={gate.openSettings} />
        )}
        {gate.precise !== false && gate.finding && <FindingBanner />}
        {gate.precise !== false &&
          !gate.finding &&
          gate.status === 'ready' &&
          gate.accuracyM !== null &&
          gate.accuracyM > 50 && (
            <AccuracyBanner accuracyM={gate.accuracyM} onPress={() => void gate.improveAccuracy()} />
          )}

        {stageH > 0 && (
          <ShopSheet
            available={stageH}
            position={sheetAt}
            onPositionChange={setSheetAt}
            /*
              The radius chips and the list heading are handed to the sheet rather than
              nested inside it, because the sheet makes its header the drag target. They
              still tap and still scroll sideways; what changes is that a downward swipe
              anywhere across them now moves the sheet, instead of only the thin bar.
            */
            header={
              openNow ? (
                <ShopDetailsHeader
                  shop={openNow}
                  onBack={() => {
                    closeShop();
                    tourNotify('details-back');
                  }}
                />
              ) : (
              <>
                {/* How far to look. Filters the map and the list together. */}
                <View ref={radiusRef} collapsable={false}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={s.chipRow}
                  keyboardShouldPersistTaps="handled"
                >
                  <Text style={s.chipRowLabel}>Within</Text>
                  {RADIUS_OPTIONS.map((option) => (
                    <Chip
                      key={option.label}
                      label={option.label}
                      on={settings.radiusM === option.value}
                      onPress={() => {
                        update({ radiusM: option.value });
                        tourNotify('radius');
                      }}
                    />
                  ))}
                </ScrollView>
                </View>

                <View style={s.listHead}>
                  <Text style={s.listTitle}>{t.nearestToYou}</Text>
                  <Text style={s.listSort}>{t.byDistance}</Text>
                </View>
              </>
              )
            }
          >
            {openNow ? (
              <ShopDetailsBody
                shop={openNow}
                onRate={() => router.push({ pathname: '/rate/[id]', params: { id: openNow.id } })}
              />
            ) : (
            <FlatList
              ref={listRef}
              data={shops}
              keyExtractor={(shop) => shop.id}
              renderItem={({ item, index }) => (
            <ShopRow
              shop={item}
              onOpen={openFromTap}
              onContact={setContactShop}
              /* The tutorial's first step points at the nearest shop. */
              tourRef={index === 0 ? firstRowRef : undefined}
            />
          )}
              ItemSeparatorComponent={() => <View style={s.sep} />}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={s.listContent}
              /*
                SMOOTHER SCROLLING through a long list: draw about a screen and a half of
                rows up front, keep a few screens around, and let Android skip drawing rows
                that are off screen.
              */
              initialNumToRender={12}
              windowSize={7}
              removeClippedSubviews
              /*
                THE SURVEY REMINDER, for a rider who chose Later. One quiet row at the top of
                the list, never another popup, gone once answered or "Don't ask again".
              */
              ListHeaderComponent={
                settings.surveyState === 'later' ? (
                  <View style={s.reminder}>
                    <Text style={s.reminderText}>{t.surveyReminder}</Text>
                    <View style={s.reminderButtons}>
                      <Pressable
                        onPress={() => router.push('/survey')}
                        style={({ pressed }) => [s.reminderPrimary, pressed && s.pressed]}
                        accessibilityRole="button"
                      >
                        <Text style={s.reminderPrimaryText}>{t.answerNow}</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => update({ surveyState: 'never' })}
                        style={({ pressed }) => [s.reminderSecondary, pressed && s.pressed]}
                        accessibilityRole="button"
                      >
                        <Text style={s.reminderSecondaryText}>{t.dontAskAgain}</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : null
              }
              ListEmptyComponent={
                <View style={s.empty}>
                  <Text style={s.emptyText}>
                    {query ? `No shop matches “${query}”.` : 'No shops in this area yet.'}
                  </Text>
                </View>
              }
            />
            )}
          </ShopSheet>
        )}
      </View>

      <ContactCard shop={contactShop} onClose={() => setContactShop(null)} />

      <SurveyPrompt
        visible={surveyAsk}
        onAnswer={() => {
          setSurveyAsk(false);
          update({ surveyState: 'later' });
          router.push('/survey');
        }}
        onLater={() => {
          setSurveyAsk(false);
          update({ surveyState: 'later' });
        }}
      />

      {cardOpen && gate.status !== 'checking' && gate.status !== 'ready' && (
        <LocationCard
          status={gate.status}
          online={online !== false}
          onDismiss={() => setCardOpen(false)}
          onAct={() => {
            setCardOpen(false);
            /*
              A refusable permission gets the system dialog; anything else needs a trip
              to settings, because the dialog either will not appear or would not help.
            */
            if (gate.status === 'denied') void gate.request();
            else gate.openSettings();
          }}
        />
      )}

      <Modal
        visible={cityOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCityOpen(false)}
      >
        <SafeAreaProvider>
          <Pressable style={s.backdrop} onPress={() => setCityOpen(false)}>
            <SafeAreaView edges={['bottom']} style={s.sheet}>
              <Text style={s.sheetTitle}>Choose a city</Text>
              <ScrollView>
                {/*
                  NEAR ME, AS ITS OWN CHOICE.

                  "All cities" already measured from the rider, but it reads as
                  "everywhere" — so the one thing this app is actually for had no name in
                  the list it belongs in. Both entries clear the city; they differ in the
                  radius, which is what decides whether the rider is asking "what is
                  around me" or "show me the whole region".

                  With no position yet, this opens the location card instead of silently
                  doing nothing, because a choice that needs a permission should be the
                  thing that offers it.
                */}
                <CityOption
                  label={riderArea ? `${t.currentLocation} · ${AREA_LABELS[riderArea]}` : t.currentLocation}
                  count={nearMeCount}
                  on={nearMeOn}
                  onPress={() => {
                    setCityOpen(false);
                    if (!gate.position) {
                      setCardOpen(true);
                      return;
                    }
                    setNearMe(true);
                    update({ radiusM: settings.radiusM ?? 5000 });
                    /*
                      And actually go there. Choosing "current location" while the map
                      stays over another city is the same failure as picking a city and
                      not moving — the list changes underneath a view of somewhere else.
                    */
                    setRecentreNonce((n) => n + 1);
                  }}
                />

                <CityOption
                  label={t.allCities}
                  count={allShops.length}
                  on={!nearMeOn && activeArea == null && settings.radiusM == null}
                  onPress={() => {
                    setNearMe(false);
                    update({ area: null, radiusM: null });
                    setFrameNonce((n) => n + 1);
                    setCityOpen(false);
                  }}
                />
                {(Object.keys(AREA_LABELS) as Area[]).filter((a) => a !== 'other').map((area) => (
                  <CityOption
                    key={area}
                    label={AREA_LABELS[area]}
                    count={cityCounts[area] ?? 0}
                    on={activeArea === area}
                    onPress={() => {
                      /*
                        THE RIDER'S RADIUS IS LEFT ALONE. It used to be forced to All,
                        because a 1 km circle on a mean-position centre landed in a gap
                        and showed nothing. Now the centre is the city's busiest square
                        kilometre, so every radius returns shops — and overriding a
                        setting the rider chose is no longer buying anything.

                        It also had a side effect neither of us wanted: All means no
                        limit, so there was no circle to draw, and the search ring
                        vanished every time a city was picked.
                      */
                      setNearMe(false);
                      update({ area });
                      setFrameNonce((n) => n + 1);
                      setCityOpen(false);
                    }}
                  />
                ))}
              </ScrollView>
            </SafeAreaView>
          </Pressable>
        </SafeAreaProvider>
      </Modal>
    </SafeAreaView>
    </TourProvider>
  );
}

function CityOption({
  label,
  count,
  on,
  onPress,
}: {
  label: string;
  count: number;
  on: boolean;
  onPress: () => void;
}) {
  const { theme } = useSettings();
  const s = styles(theme);
  return (
    <Pressable
      onPress={onPress}
      style={s.cityOption}
      accessibilityRole="radio"
      accessibilityState={{ selected: on }}
    >
      <Text style={[s.cityOptionLabel, on && s.cityOptionLabelOn]}>{label}</Text>
      <Text style={s.cityOptionCount}>{count}</Text>
      <Text style={[s.tick, on && s.tickOn]}>{on ? '✓' : ''}</Text>
    </Pressable>
  );
}

function MiniStars({ value }: { value: number }) {
  const { theme } = useSettings();
  const SIZE = 12;
  return (
    <View style={{ flexDirection: 'row' }}>
      {Array.from({ length: 5 }, (_, i) => {
        const filled = Math.min(Math.max(value - i, 0), 1);
        return (
          <View key={i} style={{ width: SIZE, height: SIZE }}>
            <Text style={{ fontSize: SIZE, lineHeight: SIZE, color: theme.line }}>★</Text>
            {filled > 0 && (
              <View style={{ position: 'absolute', left: 0, top: 0, height: SIZE, width: SIZE * filled, overflow: 'hidden' }}>
                <Text style={{ fontSize: SIZE, lineHeight: SIZE, color: theme.star }}>★</Text>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const { theme } = useSettings();
  const s = styles(theme);
  return (
    <Pressable
      onPress={onPress}
      style={[s.chip, on && s.chipOn]}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
    >
      <Text style={[s.chipText, on && s.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

function ShopRow({
  shop,
  onOpen,
  onContact,
  tourRef,
}: {
  shop: Shop;
  onOpen: (shop: Shop) => void;
  onContact: (shop: Shop) => void;
  tourRef?: (node: View | null) => void;
}) {
  const { theme, t } = useSettings();
  const s = styles(theme);
  const { value } = splitDistance(shop.distance_m);

  const label = shop.status === 'open' ? t.open : shop.status === 'closed' ? t.closed : t.unknown;
  const pill = shop.status === 'open' ? s.pillOpen : shop.status === 'closed' ? s.pillClosed : s.pillUnknown;
  const pillText =
    shop.status === 'open' ? s.pillOpenText : shop.status === 'closed' ? s.pillClosedText : s.pillUnknownText;

  /*
    ONE TAP OPENS THE SHOP, and the map shows it at the same time.

    The details open in this same panel with the map still visible above them, so one
    tap can both show the shop on the map and open it.
  */
  return (
    <Pressable
      ref={tourRef}
      style={({ pressed }) => [s.row, pressed && s.rowPressed]}
      accessibilityRole="button"
      accessibilityLabel={`Open ${shop.name}`}
      onPress={() => onOpen(shop)}
    >
      {/*
        NAME FIRST, AND BIGGER. A big distance column on the left took a fifth of the row
        and truncated the name; the name is what a rider reads first, so it gets the full
        width and two lines.
      */}
      <View style={s.rowBody}>
        <Text style={s.shopName} numberOfLines={2}>
          {shop.name}
        </Text>
        {/*
          Rating first, because it is what draws a rider to a shop, with the count
          directly beneath it so a high average from two friends cannot mislead.

          The average is WITHHELD below five ratings and the count shown alone. That
          is a fixed rule, and it is the reason the count sits with
          the stars rather than somewhere else.
        */}
        <View style={s.ratingRow}>
          {shop.ratingAvg != null ? (
            <>
              <MiniStars value={shop.ratingAvg} />
              <Text style={s.ratingAvg}>{shop.ratingAvg.toFixed(1)}</Text>
              <Text style={s.ratingCount}>({shop.ratingCount})</Text>
            </>
          ) : (
            <Text style={s.ratingCount}>
              {shop.ratingCount === 0 ? t.noRatingsYet : t.ratingCount(shop.ratingCount)}
            </Text>
          )}
        </View>

        <View style={s.metaRow}>
          <View style={[s.pill, pill]}>
            <Text style={[s.pillTextBase, pillText]}>
              {shop.status === 'open' && shop.openUntil ? t.openUntil(shop.openUntil) : label}
            </Text>
          </View>
          <Text style={s.tags} numberOfLines={1}>
            {shop.tags.join(', ')}
          </Text>
        </View>
        {/*
          Distance, small, bottom left. Still marked ≈ ON the number: it is a road estimate
          from a detour factor, not a measured route, and a bare figure would read as exact.
        */}
        <Text style={s.distSmall}>
          ≈ {value} {t.km.toLowerCase()}
        </Text>
      </View>

      {shop.phone ? (
        /*
          Contact, not Call. A rider beside a running engine, or riding pillion, often
          cannot hold a conversation but can send a text. Dialling straight from the
          list took that choice away and made a mis-tap phone a stranger.

          Opens the contact card, which shows the choices as big labelled
          buttons instead of the system pop-up's two plain words.
        */
        <Pressable
          onPress={() => onContact(shop)}
          style={({ pressed }) => [s.callBtn, pressed && s.pressed]}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`${t.contact} ${shop.name}`}
        >
          <ContactIcon size={26} color={theme.onFilled} bg={theme.call} />
        </Pressable>
      ) : (
        <View style={s.callBtnEmpty} />
      )}

    </Pressable>
  );
}

const styles = (theme: ReturnType<typeof useSettings>['theme']) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.bg },
    /* Everything under the band: the map fills it, the sheet floats over it. */
    /*
      `overflow: hidden` keeps the panel off the phone's nav buttons. The panel below slides down to
      rest, so part of it always sits below this area; unclipped, that part was drawn, and
      pressable, behind the phone's back/home buttons. Clipped, nothing exists there.
    */
    stage: { flex: 1, position: 'relative', overflow: 'hidden' },
    grow: { flex: 1 },

    bandTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    bandArea: { fontSize: 10.5, fontWeight: '700', letterSpacing: 1.2, color: theme.bandInk2, marginTop: 4 },
    helpGlyph: { fontSize: 18, fontWeight: '800', color: theme.bandInk, lineHeight: 22 },
    bandIconBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: theme.bandChip,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bandBottom: { flexDirection: 'row', alignItems: 'center', gap: 8 },



    /* Small on purpose: the app bar has to hold more controls later. */
    cityPill: {
      maxWidth: 170,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.bandChip,
      paddingHorizontal: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    cityPillText: { fontSize: 13, fontWeight: '700', color: theme.bandInk, flexShrink: 1 },


    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: theme.bg,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '70%',
      paddingTop: 18,
    },
    sheetTitle: { fontSize: 18, fontWeight: '700', color: theme.ink, paddingHorizontal: 20, paddingBottom: 10 },
    cityOption: {
      minHeight: 56,
      paddingHorizontal: 20,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.lineSoft,
    },
    cityOptionLabel: { fontSize: 16, color: theme.ink, flex: 1 },
    cityOptionLabelOn: { fontWeight: '700', color: theme.call },
    cityOptionCount: { fontSize: 13, color: theme.ink3 },
    tick: { fontSize: 17, color: 'transparent', width: 20, textAlign: 'right' },
    tickOn: { color: theme.call },

    chipRow: { paddingHorizontal: 18, paddingVertical: 10, gap: 8, alignItems: 'center' },
    chipRowLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6, color: theme.ink3 },
    chip: {
      minHeight: 38,
      justifyContent: 'center',
      paddingHorizontal: 14,
      borderRadius: 999,
      borderWidth: 1.5,
      borderColor: theme.line,
      backgroundColor: theme.surface,
    },
    chipOn: { borderColor: theme.call, backgroundColor: theme.callFill },
    chipText: { fontSize: 14, color: theme.ink2 },
    chipTextOn: { fontWeight: '700', color: theme.call },

    searchWrap: { justifyContent: 'center' },
    searchIconBtn: { position: 'absolute', left: 12, width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
    /* Sits directly under the search box, inside the band, so nothing floats over the map. */
    suggestBox: {
      backgroundColor: theme.surface,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.line,
      overflow: 'hidden',
    },
    suggestRow: {
      minHeight: 52,
      paddingHorizontal: 14,
      paddingVertical: 8,
      justifyContent: 'center',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.lineSoft,
    },
    suggestName: { fontSize: 16, fontWeight: '600', color: theme.ink },
    suggestMeta: { fontSize: 13, color: theme.ink3, marginTop: 2 },
    reminder: {
      margin: 14,
      marginBottom: 4,
      padding: 14,
      gap: 10,
      borderRadius: 12,
      backgroundColor: theme.callFill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.call,
    },
    reminderText: { fontSize: 15, fontWeight: '600', color: theme.ink },
    reminderButtons: { flexDirection: 'row', gap: 10, alignItems: 'center' },
    reminderPrimary: {
      minHeight: 44,
      paddingHorizontal: 16,
      borderRadius: 10,
      backgroundColor: theme.call,
      justifyContent: 'center',
    },
    reminderPrimaryText: { fontSize: 15, fontWeight: '700', color: theme.onFilled },
    reminderSecondary: { minHeight: 44, paddingHorizontal: 10, justifyContent: 'center' },
    reminderSecondaryText: { fontSize: 14, fontWeight: '600', color: theme.ink2 },
    /*
      THE OUTLINE IS NOT DECORATION IN DARK MODE. `surface` and `bandBg` are the same hex
      there, so the field was invisible against the band at 1.00:1 — no edge, no shape,
      nothing to tell a rider where to tap. Every other dark token sits within 1.11:1 of
      the band too, so no fill could rescue it; a border is the only thing that can draw
      that edge. In light mode it is a quiet 1.41:1 hairline on white.
    */
    search: {
      height: 46,
      borderRadius: 10,
      paddingLeft: 44,
      paddingRight: 42,
      fontSize: 15,
      color: theme.ink,
      backgroundColor: theme.searchBg,
      borderWidth: 1,
      borderColor: theme.line,
    },
    clearBtn: { position: 'absolute', right: 12, width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
    clearGlyph: { fontSize: 15, color: theme.ink3 },

    listHead: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      paddingHorizontal: 18,
      paddingTop: 16,
      paddingBottom: 8,
    },
    listTitle: { fontSize: 17, fontWeight: '700', color: theme.ink },
    listSort: { fontSize: 11, letterSpacing: 1, color: theme.ink3, fontWeight: '600' },

    listContent: { paddingBottom: 28 },
    sep: { height: StyleSheet.hairlineWidth, backgroundColor: theme.lineSoft, marginLeft: 18 },

    /*
      gap 10, not 14. A fourth target went into this row and the shop name is what pays
      for it: at 14 and a 48px contact button there were 136dp left for the name on a
      360dp phone, which truncates most real shop names. This buys back 16.
    */
    row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingVertical: 13 },
    /*
      Wider than it looks like it needs to be. The detour factor makes every number
      bigger, and with the All chip a shop can sit 12 km out, so the column has to
      hold the approximation mark plus five characters without clipping.
    */
    rowBody: { flex: 1, gap: 5 },
    shopName: { fontSize: 18, fontWeight: '700', color: theme.ink, lineHeight: 23 },
    distSmall: { fontSize: 13, fontWeight: '600', color: theme.ink2, fontVariant: ['tabular-nums'] },
    ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    ratingAvg: { fontSize: 13, fontWeight: '700', color: theme.ink },
    ratingCount: { fontSize: 12.5, color: theme.ink3 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    tags: { fontSize: 13, color: theme.ink3, flexShrink: 1 },

    pill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 5 },
    pillTextBase: { fontSize: 12, fontWeight: '700' },
    pillOpen: { backgroundColor: theme.openFill },
    pillOpenText: { color: theme.open },
    pillClosed: { backgroundColor: theme.lineSoft },
    pillClosedText: { color: theme.ink3 },
    pillUnknown: { backgroundColor: theme.mapBg },
    pillUnknownText: { color: theme.ink2 },

    callBtn: { width: 44, height: 44, borderRadius: 11, backgroundColor: theme.call, alignItems: 'center', justifyContent: 'center' },
    callBtnEmpty: { width: 44, height: 44 },
    /* Visible feedback the moment a finger lands, so a tap never feels ignored. */
    rowPressed: { backgroundColor: theme.lineSoft },
    pressed: { opacity: 0.6 },


    empty: { padding: 28, alignItems: 'center' },
    emptyText: { fontSize: 15, color: theme.ink3, textAlign: 'center' },
  });
