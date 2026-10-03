# Ayos

An Android app that shows motorcycle riders the repair shops nearest to them, and keeps
working when their phone has no signal.

Coverage is Metro Manila. The app locates shops, it does not rate their competence.

**Status: in testing.** The map, the shop list and shop details run on a test phone. There is
no backend yet: the shop list ships inside the app, and ratings are not saved. See
[Current state](#current-state).

---

## Why this exists

Philippine mobile data is unreliable, and a rider looking for a repair shop is often
precisely the person with no signal. An app that spins on a loading screen is useless at the
moment it is needed most.

So the app does not fetch shops when you open it. It holds the whole Metro Manila shop list
on the phone, about 2,800 shops in well under a megabyte, and reads from that copy. Search,
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
  components/         the map, the panel, shop details, the tutorial
  lib/
    data/             the shop list (shops.json) and how screens read it
    geo/              distance and radius rules
    location/         permission, GPS smoothing, compass and direction of travel
    map/              when the camera follows the rider
    theme/            colour palettes and the contrast check
scripts/
  import_shops.py     field spreadsheet -> report -> shops.json
tests/
```

Logic that does not draw anything lives in `src/lib`, and most of it imports nothing from
React Native, which is what lets the tests run on plain Node.

The shop records are collected in the field, shop by shop, and reach the app only through
`scripts/import_shops.py`. It writes a report of every skipped, flagged or unreadable row
first, and changes the app's data only when run again with `--apply`.

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
- The map follows the rider while moving; "zoom to me" and recenter buttons
- Shop list ordered by distance, search with suggestions, radius and city filters
- Shop details under the map: call, text, directions, hours, open or closed
- About 2,800 shops across all 17 Metro Manila cities, on the phone, usable with no signal
- English and Taglish, light and dark, an interactive tutorial

Not built yet:

- A backend and database, so the shop list can be updated without a new app release
- Saving ratings (the screens exist, nothing is stored), legal pages
- Self-hosted map tiles (it uses OpenFreeMap's public tiles today)

---

## Design rules

- Shops are always ordered by distance, never by rating.
- Nothing blocks a rider who opened the app because their bike broke down: location, the
  tutorial and the rider questions can all be skipped in one tap.
- When the database is added, every table gets row level security before any data goes in,
  because the key inside the app is public and can be extracted from the APK.
