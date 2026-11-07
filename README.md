# Ayoos

An Android app that shows motorcycle riders the repair shops nearest to them, and keeps
working when their phone has no signal.

Coverage is Metro Manila. The app locates shops, it does not rate their competence.

**Status: in testing.** The map, the shop list and shop details run on a test phone. There is
no backend yet: the shop list ships inside the app, and a rating is kept only on the phone
that gave it. See [Current state](#current-state).

---

## Why this exists

Philippine mobile data is unreliable, and a rider looking for a repair shop is often
precisely the person with no signal. An app that spins on a loading screen is useless at the
moment it is needed most.

So the app does not fetch shops when you open it. It holds the whole Metro Manila shop list
on the phone, about 2,900 shops in well under a megabyte, and reads from that copy. Search,
distances, phone numbers and directions all work in airplane mode, and the map keeps working
for any area already viewed.

---

## Requirements

| Tool | Version | Check |
|---|---|---|
| Node.js | 24 LTS (minimum 22.13) | `node -v` |
| npm | ships with Node | `npm -v` |
| Git | any recent | `git --version` |
| Python 3 | for the shop import script and its tests (`pip install openpyxl`) | `python --version` |
| Android phone | for real testing, including airplane mode | |

An [expo.dev](https://expo.dev) account is needed only to produce builds.

---

## Running it locally

```bash
git clone https://github.com/yoimuri/ayos.git
cd ayos
npm install
npx expo start --dev-client
```

Expo Go cannot run this app. The map (`@maplibre/maplibre-react-native`) is native code, so
the phone needs the project's own development build installed once (see Builds below), then
scans the QR code with that app on the same network as the computer.

On Windows, allow the firewall prompt on private networks. Denying it is the most common
setup failure: the QR code scans, but the phone never reaches the development server.

### Tests

```bash
npm test              # TypeScript tests (node --test) and the shop import tests (unittest)
npx tsc --noEmit      # type-check the app
npx tsc -p tests      # type-check the tests
```

Nothing extra to install: Node runs the TypeScript tests directly, and Python's own
`unittest` runs the rest.

---

## Project structure

```
src/
  app/                screens. Expo Router treats every file here as a route
    index.tsx         the map, with a panel showing the shop list or one shop
    my-shops.tsx      the rider's saved, visited and rated shops
    fieldwork/        field survey mode: correct or add shops, export a spreadsheet
  components/         the map, the panel, shop details, the tutorial
  lib/
    data/             the shop list (shops.json) and how screens read it
    fieldwork/        survey edits kept as a change log over the original list
    personal/         saved, visited and own ratings, kept on the phone
    geo/              distance and radius rules
    location/         permission, GPS smoothing, compass and direction of travel
    map/              when the camera follows the rider
    theme/            colour palettes and the contrast check
scripts/
  import_shops.py     field spreadsheet -> report -> shops.json; merges survey exports
tests/
```

Logic that does not draw anything lives in `src/lib`, and most of it imports nothing from
React Native, which is what lets the tests run on plain Node.

The shop records are collected in the field, shop by shop, and reach the app only through
`scripts/import_shops.py`. It writes a report of every skipped, flagged or unreadable row
first, and changes the app's data only when run again with `--apply`.

Field survey exports from the app (one `.xlsx` each) are merged into a copy of the sheet
with `--survey <file>`. An edit is written only if the cell still holds what the surveyor
saw, so a cell someone changed since is listed as a conflict instead of overwritten. Every
written cell is coloured and carries a comment with its old value. The checked copy then
becomes the sheet and goes through the normal import.

---

## Builds

Build recipes live in `eas.json`:

| Profile | Produces | For |
|---|---|---|
| `development` | APK with a development client | daily work, keeps instant reload |
| `preview` | standalone APK | testers, no developer machine involved |
| `production` | Android App Bundle | Google Play |

```bash
npm install -g eas-cli
eas login
eas build --platform android --profile preview
```

Builds run on Expo's servers, so no Android Studio is needed. There is no `android/` folder:
the native project is generated from `app.json` at build time, which is why adding a native
library means a new build while JavaScript changes do not.

### Updates without rebuilding

```bash
eas update --channel preview --message "what changed"
```

An update only reaches builds with a matching `runtimeVersion`, so JavaScript that needs a
native library never lands on a build that does not have it.

### Signing

Android only accepts an update signed with the same key as the original install, so losing
the signing key means the app can never be updated again. Keep a backup (`eas credentials`)
somewhere other than one laptop, and never commit it.

---

## Current state

Working on a test phone:

- Map of Metro Manila with clustered shop markers, shop names when zoomed in, and the rider's
  position, heading and direction of travel
- The map follows the rider while moving, and a button to go back to the rider
- Shop list ordered by distance, search with suggestions, radius and city filters
- Shop details under the map: call, text, directions, hours, open or closed
- About 2,900 shops across all 17 Metro Manila cities, on the phone, usable with no signal
- English and Taglish, light and dark, an interactive tutorial

Built, not yet checked on the test phone:

- My shops: Save and Visited on every shop, a list of saved, visited and rated shops, and
  visited shops drawn green on the map
- Ratings in three parts (service, price, assistance), shown as one overall score with the
  parts one tap away
- Field survey mode, for the team surveying shops in person. Since 1 Nov it records exact
  locations only (the surveyors type each shop's details in the spreadsheet themselves):
  pin a listed shop where it really is, or pin a new shop with its name so it can be
  matched to its spreadsheet row; every pin is kept in an editable log with the original
  always restorable, and exported as one spreadsheet plus a backup. It is removed before
  release
- Riding mode: the map follows the rider and turns so the road ahead points up, pauses
  when the map is touched and comes back by itself on a turn or after 15 seconds, and the
  dot glides between GPS readings. Speed and direction are measured from the readings on
  phones that do not report them, which kept the dot up to 85 m behind on those phones
- Shop ahead alerts: while riding, a banner and a short buzz when an open shop is within
  150 m ahead, on whichever side; several at once become one alert. Can be switched off
- The screen stays on while riding
- Location works with the phone's network-assisted location ("Google Location Accuracy")
  switched off, as Google Maps does. If no live reading arrives, a banner says so and the
  last known position (up to 30 minutes old) is shown faded instead of an empty map
- Updates without closing the app: an "Update ready · Restart" banner once a new version
  has downloaded, and "Check for updates" in Settings
- Settings in four sections, with choices that open in place and switches for on/off

Version 1.2.0 preview build (30 Oct 2026), not yet checked on a phone:

- A 3D map: the camera tilts and buildings rise, kept low and pale so the shops and the
  rider stand out. A cube / square button switches between 3D and a flat 2D map, and the
  map flattens by itself when zoomed out to the whole city
- Pins instead of dots: each shows what the shop fixes, whether it is open (green dot),
  closed (grey) or visited (check). Groups of shops are small lit spheres with a count
- The rider as a 3D motorcycle seen from behind when the map turns with the ride, and
  from the front when riding toward the bottom of the screen; the flat bike otherwise
- Dark mode uses a dark map
- Search, My shops and Settings float over the map in one card; the city chip and help
  sit under it, and the panel stops below the card
- Shop rows as cards with a distance block, the address and a raised call button; shop
  details with raised Call, Text and Directions tiles and a photo strip (three photos and
  a "+N" tile; empty until photos are hosted)
- A short vibration tap for shop-ahead alerts; new app icon and splash

Version 1.3.0 preview build (31 Oct 2026), not yet checked on a phone:

- The map opens flat (2D) on every launch; the cube button turns on 3D for that session
- The rider is a 3D model of a motorcycle and rider, rendered in Blender: 24 pictures, one
  every 15 degrees, so in 3D the bike faces the way the rider is going relative to the map;
  in 2D the same bike is drawn from straight above and turned with the heading
- Your ride, in Settings > Map and riding: choose the bike (scooter, underbone or standard),
  its paint (six colours) and its size on the map (S, M, L, with a road beside it for scale).
  The bike turns on a turntable (drag to turn it); nothing changes on the map until Save.
  On a tablet the bike and the choices sit side by side
- The splash screen no longer cuts off the logo's first letter

Over-the-air update to 1.3.0 (31 Oct 2026), after the first look at the build, not yet
checked on a phone:

- Save in Your ride now changes the bike on the map. Before, the map kept the first bike it
  was given until the app restarted
- The bike stands in the middle of the turntable, zoomed to fill it; vehicle names shrink
  to fit instead of being cut; the paints spread across the row
- One location button instead of two, as in Google Maps: the first tap goes back to the
  rider at street level; the second turns the map with the phone so the headlight beam
  points up; the third goes back to north up. Dragging the map ends it
- Two fingers turn the map; a compass button appears while it is turned, and one tap puts
  north back up
- A new version shows as a card above the shop panel ("New app version available",
  Update app), which restarts into it in about a second
- The shop list from the 30 Oct survey sheet: 2,892 shops (44 new, 14 removed)

Second over-the-air update to 1.3.0 (31 Oct 2026), not yet checked on a phone:

- Shop-type chips under the search (Repair, Parts, Dealers, Accessories): one tap shows
  only that kind on the map and in the list, a second tap shows all again
- Recently viewed: the last ten shops opened carry a "Recently viewed" line under their
  name on the map, kept on the phone
- Share on every shop: name, address, number and a Google Maps link, through the phone's
  own share sheet
- The location and 2D/3D buttons moved to the bottom right, as in Google Maps; the map
  credit moved to the bottom left

Third over-the-air update to 1.3.0 (31 Oct 2026), not yet checked on a phone:

- Save in Your ride keeps you on the screen; the button reads "Saved ✓" until something
  changes
- The turntable uses its own sharp pictures, three times the size of the map's and in full
  colour, instead of stretching the small map pictures
- The size preview rides: the lane's centre line flows past the bike (still when the phone's
  "Remove animations" setting is on)

Fourth over-the-air update to 1.3.0 (31 Oct 2026), not yet checked on a phone:

- The direction the phone points is a headlight beam: a warm fan of light that fades with
  distance, lying on the road in 3D, instead of a flat red cone
- The update reminder is a small faded chip in the bottom-left corner instead of a card
  over the map
- Location notices show their whole text (two lines) instead of cutting it off
- Map only: a button on the map hides the search, chips, notices, shop panel and other
  buttons; the same button or Back brings them back. Shop-ahead alerts still show
- The Your ride Save button turns see-through, like a disabled button, while what is shown
  is already saved

Fifth over-the-air update to 1.3.0 (31 Oct 2026), not yet checked on a phone:

- Settings > Map and riding > Graphics: Standard, or Light for older phones. Light turns off
  the 3D map and its cube button, the bike gliding between GPS readings and the Your ride
  turntable's self-spin, and keeps fewer turntable pictures in memory
- Changing your ride now frees the old bike's map pictures instead of keeping every look
  tried in memory; three unused rider pictures were deleted

Sixth over-the-air update to 1.3.0 (31 Oct 2026), not yet checked on a phone:

- A steadier compass with the phone upright in a holder: the direction comes from where the
  phone's back faces, worked out from the raw tilt and magnetic sensors, instead of where its
  top edge points. Flat, tilted or upright give the same answer; the old compass takes over
  when the phone is on its side

Seventh over-the-air update to 1.3.0 (1 Nov 2026), not yet checked on a phone:

- The four rider questions are asked once, on first use, and are required before the app
  opens (testers who never answered them get them once on their next launch). A grey "How
  we use your answers" line explains what they are for. The "recorded" screen after them
  is a demo: the answers still stay on the phone until the database exists. They are no
  longer in Settings, and the reminder and popup are gone
- Graphics: Light is now a lighter app overall, with 2D only: one glow ring under the rider,
  Your ride with the small map pictures instead of the sharp set, and a still road preview.
  Switching to Light or to Standard asks to restart the app (about a second; Later still
  switches, the restart only finishes it)
- Field survey mode records exact shop locations only (see Current state)

Eighth over-the-air update to 1.3.0 (1 Nov 2026), not yet checked on a phone:

- The app also checks for a new version whenever it comes back to the front (at most every
  5 minutes), not only on a fresh start; the update reminder shows again each time until
  the phone is on the newest version, and can still be closed

Ninth over-the-air update to 1.3.0 (1 Nov 2026), not yet checked on a phone:

- Graphics: Light becomes the classic look, for almost any phone: basic functions only
  (map, list, search, call, text, directions, saved) in a plain UI. Shops, groups of shops,
  the selected shop and the rider are plain dots drawn by the map (no pin or bike pictures
  are loaded), the map is 2D only, cards and buttons are flat, and the shop-type chips, the
  map-only button and Your ride are not shown. Standard is unchanged

Tenth over-the-air update to 1.3.0 (1 Nov 2026), not yet checked on a phone:

- The rider (bike, headlight beam, Light's dot) eases down to 60% of its size between street
  and city zoom, so it no longer covers the shop groups around it when zoomed out

Eleventh over-the-air update to 1.3.0 (3 Nov 2026), not yet checked on a phone:

- Outside Metro Manila: a rider whose position is outside the area Ayoos covers is told
  once per session that Ayoos only has shops in Metro Manila for now, and a quiet banner
  stays while they are outside (tap it to see why again). The map itself stays held inside
  Metro Manila

Published over the air on 5 and 7 Nov 2026 (latest update 01a1b497), not yet checked on a phone:

- Your ride parts: four tabs (Bike, Rider, Helmet, Parts) with six outfits, five helmets in
  four colours, four exhausts, eight top boxes and three add-ons, on every vehicle. Each part
  is its own layer of pictures, rendered with whatever stands in front of it cut out, and the
  layers are stacked on the map and in Your ride; helmets are shared and placed on each
  vehicle's head. Paid items show a small open padlock (everything is open in the demo)
- The bike now has 8 views, one every 45 degrees, instead of 24: on the map it steps round
  like a navigation arrow, and the Your ride turntable steps with a short fade
- Build on Save: each part ships as two sheets of pictures, and saving a ride puts its parts
  together on the phone into 9 finished pictures, so the map draws one layer for the rider
  instead of one per part. The default ride ships ready-made. Plain JavaScript, no new native
  library. Brings an update from 1,035 files to 266, under the 1,000 limit
- Zoomed out, the map shows each city as a see-through colour, using city
  outlines from OpenStreetMap. Tapping a city goes there and shows how many shops it has.
  Zoomed in, groups of shops carry no numbers: a glossy ball in Standard, a hollow ring in Light
- Tapping a shop draws a line with arrows along the roads from the rider to the shop, once per
  tap, in motorcycle mode and avoiding expressways, tolls and ferries. Demo only: it uses a free
  public route server (FOSSGIS Valhalla), needs internet, and sends the rider's position to that
  server on each request. It only knows motorcycle bans marked in OpenStreetMap, so riders still follow
  road signs. With no line, a straight arrow points toward the shop
- The OpenStreetMap credit shows on the map for 5 seconds when the app opens, and the info button
  has the full credit and a link to report a map error
- Nearest shop button: pick Repair, Parts, Dealers or Accessories and get up to 3 shops, open
  ones first, ranked by real road distance from the same route server, with an estimate marked
  "≈" when there is no signal. A shop with unknown hours only appears if it can be phoned. A Call
  911 button opens the dialler
- Odometer, in Settings > Map and riding: Start ride and End ride add up kilometres while the
  app is open with the screen on, and the bike's reading can be typed by hand. Only the numbers
  are kept, on the phone, never a position or a route

Not built yet:

- Live 3D in Your ride (smooth turning, parts as 3D models); needs a new APK

- A backend and database, so the shop list can be updated without a new app release
- Saving ratings to a server (today a rating stays on the phone that gave it), legal pages
- A notification the moment a new version is published (planned with the database, for the
  beta build)
- Shop ahead alerts with the app in the background (needs background location and a new
  app build); road routes to a shop (Directions hands off to Google Maps)
- Self-hosted map tiles (it uses OpenFreeMap's public tiles today)

---

## Contact

dcharls801@gmail.com

## Design rules

- Shops are always ordered by distance, never by rating.
- Nothing blocks a rider who opened the app because their bike broke down: location and
  the tutorial can be skipped in one tap. The exception, by decision on 1 Nov, is the four
  rider questions on first use: they are required before the app opens.
- When the database is added, every table gets row level security before any data goes in,
  because the key inside the app is public and can be extracted from the APK.
