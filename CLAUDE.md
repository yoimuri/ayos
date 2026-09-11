# CLAUDE.md - Motorcycle Shop Locator

Project root context file. Claude Code loads this every session.

Scope lives in `docs/MOTO_APP_BUILD_SPEC.md`. That file wins on any scope question.
This file covers setup, locked stack, and how work runs.

Project location: `C:\Users\muri\Desktop\PROJECTS\moto-app`
Verified 11 Sep 2026: this Desktop is a real local folder, not redirected into OneDrive.
The OneDrive warning still applies to any other location.

---

## 0A. Team context (read before any decision that is not purely mechanical)

**Two people own this project. It is not solo.**

- **Clint** writes and reviews all code, and owns architecture, technical decisions and
  the build.
- **The co-founder** is non-technical and owns field data collection, shop relationships
  and community engagement. He mapped the shops, visits them, and collects the contacts,
  hours, tags and facade photos. He has no login and does not touch the repo.
- **Product decisions are joint.** Neither decides scope alone. On a deadlock, whoever does
  the work decides, and the decision is recorded in `docs/DECISIONS.md`.

**Scope is a contract between two people.** `docs/MOTO_APP_BUILD_SPEC.md` is that contract.
Do not add features, fields, screens or dependencies that are not in it, however trivial or
obviously useful. New ideas go on a list for the two of them to discuss, never into the code.
If something in the spec looks wrong, say so and stop. Do not route around it.

**Locked decisions, argued over, not to be quietly reversed:**
- Ordering is always by distance, never by rating
- No user accounts
- Map tiles are self-hosted, never rented
- The app reads from a local copy and works offline
- No verification badge exists
- Shop photos are only ever team-captured or permission-granted

**Write for a second reader.** The co-founder cannot read code, and Clint has to explain any
part of this system to him in plain language. Anything Clint could not explain to a
non-technical person is too clever. Every non-obvious decision gets its three lines in
`docs/DECISIONS.md`: what was chosen, what else was considered, why.

**The shop data is the co-founder's work, not test data.** Collected on foot, shop by shop.
Never generate fake shop records that could be mixed into the real set. Never bulk-edit or
delete shop rows without asking. Photo sourcing rules are hard requirements, not preferences.
Sample data must be clearly marked and kept in its own namespace: `src/lib/dev/`, never
`src/lib/shops/`.

**Bus factor.** If Clint disappears for a month, the co-founder must be able to hand this to
another developer. So: no undocumented setup steps, no configuration that exists only on
Clint's machine, and a README that gets a stranger running from a clean checkout. Assume a
future developer who is not Clint.

**Security baseline, non-negotiable.** Row level security on every table before any data is
inserted. The public key ships inside the app and is extractable, so access rules are the only
thing protecting stored email addresses. This is not deferrable. Nothing proceeds past the
schema step until Clint has queried the database with only the public key and confirmed no
email address comes back.

---

## 0. Working rules

- No scope additions. Anything not in section 3 of the build spec is out.
- Explain the cause before proposing a fix, and say what else that cause could affect.
- Smallest possible diffs. Never rewrite a whole file to fix one thing.
- Every non-obvious decision gets three lines in `docs/DECISIONS.md`: what, why, what was rejected.
- Every bug that gets fixed gets a test.
- Clint is a first-time mobile developer. Lead with what a thing does in plain words.
- Verify library versions and API shapes against current docs. Do not answer from memory.
- No automatic setup. Setup commands are explained first and run by Clint, so he can explain
  them later without help.

---

## 1. Environment (Windows, Android first)

| Tool | Why | Verify | Status 11 Sep 2026 |
|---|---|---|---|
| Node.js LTS | Runs every build tool | `node -v` | **v24.21.0 installed and verified** |
| Git for Windows | Version control | `git --version` | 2.52.0 installed |
| VS Code | Editor, Claude Code runs in its terminal | opens | installed |
| Expo account | Cloud builds | expo.dev | created |
| Supabase account | Database and storage | supabase.com | confirm |
| Android phone | Real test device, plus airplane mode testing | USB debugging on | pending |
| Expo Go app | Scans the dev QR for the plain-JS phase | Play Store | not installed yet |
| eas-cli | Cloud builds and the custom dev client | `eas --version` | not installed |

Node note: upgraded from v22.15.0 to v24.21.0 (Krypton, active LTS, supported to Apr 2028)
on 11 Sep 2026 and verified. npm came with it at 11.19.0, which is the bundled version and
the correct one to keep. Reasoning in `docs/DECISIONS.md`.

Skipped on purpose: Android Studio (emulator only, phone is better), WSL (breaks USB access),
Docker (only needed for local Supabase, use the hosted free project).

### First run

The project folder already holds `CLAUDE.md`, `HANDOVER.md` and `docs/`. `create-expo-app`
refuses to scaffold into a folder containing loose files, so the two markdown files move out
and back. Verified 11 Sep 2026: it refuses cleanly and changes nothing, and it ignores
directories, so `docs/` can stay put.

`--no-agents-md` is required. Without it the scaffolder writes its own `CLAUDE.md`,
`AGENTS.md` and `.claude/settings.json`, and its `CLAUDE.md` is a one-line pointer that
would replace this file.

The two files park inside `docs/` rather than the parent folder, so nothing of this project
ever sits outside it, even if a step fails partway.

```bash
cd "C:\Users\muri\Desktop\PROJECTS\moto-app"
mv CLAUDE.md HANDOVER.md docs/
npx create-expo-app@latest . --no-agents-md
mv docs/CLAUDE.md docs/HANDOVER.md .
npm run reset-project      # moves the demo into example/, leaves a clean src/app
rm -rf .git                # the scaffolder commits; the first commit must be Clint's
git init
```

eas-cli is not needed until the custom dev client is built, which is the step after the map
package goes in:

```bash
npm install -g eas-cli
eas login
eas build:configure
```

The map package cannot run in Expo Go, so a custom dev client is required:

```bash
npx expo install @maplibre/maplibre-react-native
# add "@maplibre/maplibre-react-native" to the plugins array in app.json
eas build --profile development --platform android
```

Install that file on the phone once, then `npx expo start --dev-client` for daily work.
Free plan allows 15 Android builds per month. Only new native packages need a rebuild.

---

## 2. Locked stack (verified against the npm registry, 11 September 2026)

| Layer | Choice | Note |
|---|---|---|
| Language | TypeScript | plus SQL for the database |
| Framework | Expo SDK 57 | current stable is 57.0.21, SDK 58 is preview only, do not use |
| Navigation | Expo Router | file-based screens, 57.0.20 |
| Map | `@maplibre/maplibre-react-native` 11.3.x | 11.3.10, published 7 Sep 2026, not available in Expo Go |
| Tiles | PMTiles on Supabase Storage | Storage supports HTTP range requests |
| Bundled tiles | low-zoom Metro Manila layer inside the app | few MB, works with zero network |
| Local store | on-device copy of all shops | see section 3 |
| Database | Supabase Postgres + PostGIS | source of truth, not the read path |
| Server logic | Supabase Edge Functions | ratings insert goes here, never direct |
| Keys | `sb_publishable_` in app, `sb_secret_` server only | legacy anon / service_role deprecated end of 2026 |
| Builds | EAS Build, eas-cli 24.1.2 | 15 Android builds per month on free |
| Errors | Sentry, PII scrubbed | can wait until first external build |

MapLibre 11.3.10 declares peer support for `expo >= 54`, `react-native >= 0.80` and
`react >= 19.1`. SDK 57 ships React Native 0.86 and React 19.2, so the pin is inside range.
The package had three releases in the two weeks to 7 Sep 2026, so it is actively maintained.

Any tutorial using `anon` or `service_role` keys is out of date. Reject it.

---

## 2A. Known warnings that are NOT problems

Read this before diagnosing any of the following. Each one has already been investigated,
with the evidence recorded. Do not re-investigate from scratch, and do not "fix" one without
reading why it was left.

### `expo doctor` reports patch version mismatches on every build

```
✖ Check that packages match versions required by installed Expo SDK
   expo  expected ~57.0.22  found 57.0.21     (and ~13 more)
   Command "expo doctor" failed.
```

**This does not fail the build.** Doctor is a pre-flight advisory. Build 2 ran through this
exact failure and kept compiling.

**Cause, confirmed 12 Sep 2026 against the npm registry:** Expo publishes SDK 57 patch
releases roughly weekly. `expo` 57.0.21 shipped 8 Sep and 57.0.22 shipped 11 Sep;
`expo-router` 57.0.20 shipped 8 Sep and 57.0.21 shipped 11 Sep. The project was scaffolded on
11 Sep and `package-lock.json` pins what was current then. Nothing in this repo caused it.

**The list will grow.** By build order step 6 it may name twenty packages. Still normal.

**When to fix:** batched with the next native build, never as its own. All of these are native
modules, so updating them costs one of fifteen monthly builds, and patch releases are bug
fixes for bugs this project is not currently hitting.

```bash
npx expo install --check     # review and accept the bumps
npx tsc --noEmit             # confirm nothing broke
eas build --platform android --profile preview
```

**What WOULD be urgent:** a security advisory naming a specific package. That is a different
message from this one and should be acted on immediately.

### `npm audit` reports moderate vulnerabilities

14 as of 12 Sep 2026, all inside `@expo/*` build tooling: the CLI, config plugins, Metro
config. Verified with `npm audit --omit=dev`. These run on the developer machine and are never
compiled into the APK, so nothing reaches a rider. Expo's dependency tree to fix, not this
project's. Do not run `npm audit fix --force`, which would move packages off the versions the
SDK pins and is a far bigger risk than the advisories.

### TypeScript errors after adding a screen

```
Argument of type '"/settings"' is not assignable to parameter of type ...
```

`app.json` sets `experiments.typedRoutes: true`, so Expo Router generates a union of every
route into `.expo/types/router.d.ts`. That file is only rewritten while Metro runs. A new
screen therefore produces confident-looking type errors in correct code.

**Fix:** start the dev server once (`npx expo start`), wait for it to regenerate, stop it.
Cost 23 seconds on 12 Sep 2026. Do not edit the generated file and do not change the code.

### The build takes 20 to 40 minutes

Free tier means a low-priority queue behind paying customers, then a fresh machine with no
cached `node_modules`, then Gradle compiling React Native's C++ and Kotlin plus seven native
modules. Build 1 took 21 minutes. Nothing is stuck. `Ctrl+C` stops the CLI watching, not the
build, which continues on Expo's servers.

---

## 3. Offline-first (architecture, not a feature)

The app reads from a local copy. The network refreshes that copy and submits ratings.
Nothing else. This is the default path, not a fallback.

- First launch downloads **all** Metro Manila shops. A row is ~300 bytes, 2,000 rows is under 1 MB.
- Proximity search runs **locally** against that copy in normal use.
- `nearby_shops` in Postgres stays for the initial sync and as the reference to verify the local version against.
- Background refresh on app open when a connection exists. Never block behind a loading screen for data already held.
- Store `last_synced_at`. Show a staleness banner with the sync date when serving offline.

**Two implementations of "nearby" now exist.** Postgres has PostGIS and a spatial index.
On-device does not, so it filters by a rough coordinate box and computes distance in TypeScript.
Both must order by distance ascending, never by rating. If that rule changes, it changes in both.

**Offline behaviour, decided:**
- Rating while offline is **blocked** with a plain message. Rate limits live on the server, so a
  queued rating could be rejected after the rider believes it sent.
- Usage events are **queued** and sent on reconnect, capped at 200 so the queue cannot grow forever.

Open: whether the local store is expo-sqlite or a plain JSON file read into memory.
SQLite wins only if the queued events and sync state justify it. Decide before step 3.

---

## 4. Folder shape

```
src/
  app/                screens only, thin. Expo Router treats every file here as a route
    _layout.tsx       the shell every screen renders inside
    index.tsx         the "/" route
  lib/                plain TypeScript, imports nothing from react-native
    db/               supabase client, sync, local store
    geo/              distance and radius rules, shared by both nearby paths
    ratings/          validation and limits
supabase/
  migrations/         every schema change, in git
  functions/          edge functions
docs/
  MOTO_APP_BUILD_SPEC.md
  DECISIONS.md
```

Decided 11 Sep 2026: screens live in `src/app`, not a root-level `app/`. This is what the
Expo SDK 57 template generates and what its docs assume. Expo Router supports both, and
fighting the template buys nothing.

`tsconfig.json` maps `@/*` to `./src/*`, so `import { x } from '@/lib/geo/distance'` works
from anywhere without counting `../` hops.

Business logic never lives inside a screen file. This is what makes a future iOS or web
version a port instead of a rewrite.

Database changes are migration files in git. Never typed into the web console.

---

## 5. Build order

1. Schema, PostGIS, RLS policies, seed 20 real shops
2. `nearby_shops` function, verified in SQL
3. **GATE:** query using only the publishable key. Confirm no email address and no unpublished
   rating is readable. Nothing proceeds until this passes.
4. Local store and first sync. Verify with airplane mode before any screen exists.
5. Local proximity search, checked against the server function for the same coordinates
6. Map screen, markers, list toggle
7. Radius logic including auto-expand
8. Shop detail with call and directions
9. Rating flow, email confirmation, rate limits
10. Usage events with offline queue
11. First-run walkthrough, Taglish strings only
12. Legal pages

Steps 4 and 5 come before any screen on purpose. Screens built against the network get
retrofitted badly.

---

## 6. Schema doors (decided, do not skip)

Leave doors for later features. Do not build the rooms.

- `role` column on any account table from the first migration, even unused.
- Nullable `user_id` on `ratings` from the first migration. Accounts are not in v1, but without
  this column, adding them later means a painful data migration.
- Empty `users` table created now.

---

## 7. Still open

- ~~App name~~ **decided 11 Sep 2026: Ayos**
- Pilot area for the first 20 seeded shops
- Transactional email provider
- Local store: SQLite or plain file
- Whether the intro website carries one indexable page per shop

Do not let Claude Code decide any of these. They are Clint's calls.
