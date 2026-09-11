# Ayos

An Android app that shows motorcycle riders the repair shops nearest to them, and keeps
working when their phone has no signal.

Coverage is Metro Manila. The app locates shops, it does not rate their competence.

**Status: early development.** The database does not exist yet. What runs today is a draft
screen reading placeholder data, plus the build and release pipeline. See
[Current state](#current-state) for exactly what is and is not built.

---

## Why this exists

Philippine mobile data is unreliable, and a rider looking for a repair shop is often
precisely the person with no signal. An app that spins on a loading screen is useless at the
moment it is needed most.

So the app does not fetch shops when you open it. It holds a complete copy of the Metro
Manila shop list on the phone, roughly one megabyte for around two thousand shops, and reads
from that copy. The network is used for two things only: refreshing that copy in the
background, and submitting ratings. Everything else works in airplane mode.

This is an architectural decision rather than a feature, which is why the local store and the
on-device search are built before any screen exists.

---

## Requirements

| Tool | Version | Check |
|---|---|---|
| Node.js | 24 LTS (minimum 22.13) | `node -v` |
| npm | ships with Node | `npm -v` |
| Git | any recent | `git --version` |
| Android phone | for real testing, including airplane mode | |

Expo SDK 57 requires Node 22.13 or newer. This project is developed on 24.21.0.

An [expo.dev](https://expo.dev) account is needed only to produce builds, not to run the app
locally.

---

## Running it locally

```bash
git clone https://github.com/yoimuri/ayos.git
cd ayos
npm install
npx expo start
```

Then scan the QR code with Expo Go on an Android phone connected to the same network as the
computer.

On Windows, allow the firewall prompt on **private networks**. Denying it is the most common
setup failure: the QR code scans, but the phone never reaches the development server and
hangs without a useful error.

Over-the-air updates do not function inside Expo Go. That requires a real build, described
below.

---

## Project structure

```
src/
  app/                screens only, thin. Expo Router treats every file here as a route
    _layout.tsx       the shell every screen renders inside
    index.tsx         the "/" route, currently the draft shop list
  lib/
    dev/              placeholder data for development, never real shop records
docs/
  MOTO_APP_BUILD_SPEC.md    scope, and the contract between the two people building this
  DECISIONS.md              every non-obvious decision, with what was rejected and why
example/                    the Expo starter demo, kept as reference, excluded from typecheck
```

Business logic lives in `src/lib` and imports nothing from `react-native`. Screens stay thin.
This is what would make a future iOS or web version a port rather than a rewrite.

`tsconfig.json` maps `@/*` to `./src/*`, so imports read `@/lib/dev/sample-shops` rather than
counting relative path hops.

Anything under `src/lib/dev/` is fabricated placeholder data. Real shop records are collected
in the field, shop by shop, and must never be mixed with invented ones.

---

## Builds

Build recipes live in `eas.json`. Three profiles, for three different jobs:

| Profile | Produces | For |
|---|---|---|
| `development` | APK with a development client | Daily work once native libraries are added, keeps instant reload |
| `preview` | Standalone APK | Sharing with a teammate, runs with no developer machine involved |
| `production` | Android App Bundle | Google Play only, cannot be installed directly |

```bash
npm install -g eas-cli
eas login
eas build --platform android --profile preview
```

Builds run on Expo's servers, not locally, so no Android Studio or Java installation is
needed. The free plan allows 15 Android builds per month, and a build on the free queue
typically takes 20 to 40 minutes.

There is no `android/` directory in this repository. The native Android project is generated
from `app.json` at build time. This is why adding a native library means editing `app.json`
and producing a new build, while JavaScript changes never do.

### Updates without rebuilding

JavaScript changes reach existing installs over the air:

```bash
eas update --channel preview
```

An update only reaches builds whose `runtimeVersion` matches, which prevents JavaScript that
expects a native library from landing on a build that does not contain it. When native
dependencies change, the runtime version changes too, and older builds stop receiving updates
rather than crashing.

### Signing

The Android signing keystore is generated and held by EAS. Android only accepts an update
signed with the same key that signed the original install, so losing that key means the app
can no longer be updated at all. Back it up with `eas credentials` and store it somewhere
that is not a single laptop.

---

## Current state

Built and verified:

- Expo SDK 57 project with Expo Router, TypeScript, screens in `src/app`
- Draft list screen reading placeholder shops, ordered by distance
- Build pipeline: three EAS profiles, over-the-air updates configured

Not built yet:

- Database, schema, PostGIS, row level security policies
- Any real shop data
- The local store and the first sync
- On-device proximity search
- Map, markers, shop detail, ratings, usage events, walkthrough, legal pages

The full ordered plan is in [docs/MOTO_APP_BUILD_SPEC.md](docs/MOTO_APP_BUILD_SPEC.md)
section 11.

---

## Security

The key that ships inside the app is public by design and can be extracted from the APK by
anyone who installs it. Access rules in the database are therefore the only thing protecting
stored data, not the key.

Because of that, row level security is enabled on every table before any data is inserted,
and no screen is built until the database has been queried using only the public key and
confirmed to return no email address and no unconfirmed rating.

Ratings are inserted through a server-side function that enforces rate limits, never by
writing to the table directly.

---

## Conventions

- Shops are always ordered by distance, never by rating. Two implementations of "nearby"
  exist, one in Postgres and one in TypeScript, and the rule applies to both.
- Every non-obvious decision gets three lines in `docs/DECISIONS.md`: what was chosen, what
  else was considered, and why.
- Database changes are migration files committed to the repository, never typed into a web
  console.
- Scope is fixed by the build spec. New ideas are discussed before they are built.
