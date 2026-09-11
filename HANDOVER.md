# HANDOVER - Motorcycle Shop Locator

Read this first, then `CLAUDE.md`, then `docs/MOTO_APP_BUILD_SPEC.md`.
Update the "Current state" section at the end of every working session. Delete this file
when the project is past initial setup.

Owner: Clint (yoimuri). First mobile app. Windows PC, Android first.

Project location: `C:\Users\muri\Desktop\PROJECTS\moto-app`

---

## Current state (as of 11 Sep 2026)

**Planning is done. Part of the toolchain is already installed. No project code exists yet.**

Verified on the machine, 11 Sep 2026:

| Item | State |
|---|---|
| Node.js | **v24.21.0 installed and verified 11 Sep 2026.** Binary dated 8 Sep 2026. |
| npm | 11.19.0, the version bundled with that Node release. Correct, leave it. |
| Global npm packages | none |
| Git | 2.52.0 installed |
| VS Code | installed, Claude Code runs in its terminal |
| Expo account | created at expo.dev |
| eas-cli | not installed |
| Expo Go on phone | not installed, Clint will pull it from the Play Store |
| Supabase account | assumed from other projects, confirm before step 1 |
| Project folder | exists and is empty |

Decided: framework, stack, offline architecture, build order, folder shape.
Not decided: app name, pilot area, email provider, local store format.

---

## Immediate next action

Environment setup, in this order. Do not skip verification.
Clint runs every command himself. Nothing here is automated.

1. ~~Install Node v24.21.0.~~ **Done 11 Sep 2026.**
2. Expo Go from the Play Store, phone on the same WiFi as the PC.
3. Scaffold. The folder is no longer empty, so the two markdown files move out and back.
   `--no-agents-md` stops the scaffolder writing over `CLAUDE.md`. Full walkthrough and the
   reasoning for each flag live in `CLAUDE.md` section 1.
   ```
   cd "C:\Users\muri\Desktop\PROJECTS\moto-app"
   mv CLAUDE.md HANDOVER.md docs/
   npx create-expo-app@latest . --no-agents-md
   mv docs/CLAUDE.md docs/HANDOVER.md .
   npm run reset-project
   rm -rf .git
   git init
   npx expo start
   ```
4. Allow the Windows Firewall prompt on **private networks**. Denying it is the most common
   first-day failure: the QR scans but the phone never connects.
5. Scan with Expo Go, edit `src/app/index.tsx`, save, confirm the phone updates.

Goal of session one is only step 5. No map, no Supabase, no database. Prove the chain works.

Decided 11 Sep 2026: `default` template (Expo Router pre-wired) followed by `reset-project`
to strip the demo, screens in `src/app`, and the scaffolder's automatic `Initial commit`
deleted so the first commit in the history is Clint's.

`eas-cli` is not needed until the custom dev client is built, which is the step after the map
package goes in. Installing it early buys nothing.

---

## Path note (corrected 11 Sep 2026)

An earlier draft of this file said the project must live in `C:\dev\`, with the reason being
that OneDrive syncs `node_modules` and breaks builds. The reason is sound, the path was not
the point.

Checked on this machine: `HKCU\...\User Shell Folders\Desktop` resolves to `C:\Users\muri\Desktop`,
and `C:\Users\muri\OneDrive` contains nothing but a `desktop.ini`. The Desktop is not
redirected into OneDrive, so `C:\Users\muri\Desktop\PROJECTS\moto-app` is safe and matches
where Clint's other projects already live. If OneDrive folder backup is ever switched on for
Desktop, this decision has to be revisited.

---

## Framework decision (settled, do not re-open)

**React Native + Expo SDK 57, TypeScript.**

Rejected, with reasons:

- **Rust** - no mainstream mobile UI framework. Rust appears in mobile as a shared logic
  library called from Kotlin or Swift, not as an app layer.
- **Jetpack Compose** - best raw performance and a clean MapLibre offline API, but Android
  only. A future iOS version would be a rewrite, not a port. Kotlin is also a new language here.
- **Flutter** - the strongest alternative and better on map tooling specifically. Its MapLibre
  plugin documents PMTiles and offline regions across Android, iOS and web. Larger market
  share (~46% vs ~35%). Rejected only because Dart plus a new UI model would be a fourth
  simultaneous unknown on a first mobile app.

**Deciding factor:** Clint already works in TypeScript and React daily (Next.js on other
projects). React Native reuses that. The learning budget goes to Expo, Supabase/PostGIS and
offline sync instead of to the language he touches on every line.

Map capability was checked, not assumed. `@maplibre/maplibre-react-native` has an
`OfflineManager` that downloads tile packs by bounding box and zoom range; once downloaded
the map uses them with no network. Flutter's equivalent is better documented, not more capable.

---

## Non-negotiables

- **Offline-first is architecture, not a feature.** The app reads from a local copy of all
  Metro Manila shops. Network only refreshes that copy and submits ratings.
- **Ordering is always by distance, never by rating.** Two implementations of "nearby" exist
  (Postgres/PostGIS for sync and verification, TypeScript for on-device). The rule applies to both.
- **RLS before data.** Do not build any screen until the database has been queried with only
  the publishable key and confirmed to leak no email address and no unpublished rating.
- **Local store and sync come before any screen.** Screens built against the network get
  retrofitted badly.
- Rating while offline is blocked with a message. Usage events queue, capped at 200.
- `sb_publishable_` in the app, `sb_secret_` server only. Legacy `anon` / `service_role`
  are deprecated end of 2026. Reject any tutorial using them.
- The app locates. It never judges competence. The words qualified, trusted, recommended,
  verified and best appear nowhere in the UI or store listing.

---

## Working agreement

- Clint is a first-time mobile developer. Explain in plain words what a thing does before naming it.
- No scope additions. Section 3 of the build spec is the boundary.
- Explain the cause before proposing a fix, and say what else that cause could affect.
- Smallest possible diffs.
- Every non-obvious decision gets three lines in `docs/DECISIONS.md`.
- Every bug fixed gets a test.
- Verify versions and API shapes against current docs. Do not answer from memory.
- Do not decide anything in the "Still open" list. Those are Clint's calls.
- No automatic setup. Clint runs the setup commands himself so he can explain them later.

---

## Session log

Append one line per session. Newest at the bottom.

- `2026-09-11` - Planning complete. Framework chosen, offline-first amended into the spec,
  CLAUDE.md written. No code, no installs yet.
- `2026-09-11` - Docs moved onto disk at `Desktop\PROJECTS\moto-app`. Corrected the stale
  "nothing is installed" state and the `C:\dev\` path instruction. Verified stack versions
  against the npm registry: Expo 57.0.21 stable, MapLibre RN 11.3.10, eas-cli 24.1.2, and
  flagged Node v22.15.0 as 16 patch releases behind on a maintenance line. No installs run.
- `2026-09-11` - Node decision made: move to v24.21.0 LTS. Recorded in `docs/DECISIONS.md`.
  Confirmed winget is not on this machine and there are no global npm packages, so the MSI
  upgrades in place with nothing to reinstall. Install itself still pending, Clint runs it.
- `2026-09-11` - Node v24.21.0 installed and verified. Scaffolder behaviour tested in a
  scratch folder before touching the project: `create-expo-app` 4.0.0 refuses to run against
  a folder with loose files (refuses cleanly, changes nothing, ignores directories), writes
  its own CLAUDE.md/AGENTS.md unless `--no-agents-md` is passed, generates `src/app` rather
  than root `app/`, and makes an automatic `Initial commit`. Three decisions recorded in
  `docs/DECISIONS.md` and CLAUDE.md section 4 updated to `src/app` + `src/lib`. No scaffold
  run yet, Clint runs it.
- `2026-09-11` - Scaffold run by Clint, `expo start` confirmed working. Draft screen added:
  `src/app/index.tsx` renders placeholder shops from `src/lib/shops/sample-data.ts`, sorted
  by distance, no network. Both files are deleted at build step 4. `tsconfig.json` now
  excludes `example/`, which was producing 25+ false type errors. `npx tsc --noEmit` is clean.
  Cadence question (2-day sprints) raised and being planned separately before it is adopted.
- `2026-09-11` - Team context written into `CLAUDE.md` section 0A: two-person project, joint
  product decisions, locked spec decisions, shop data is the co-founder's field work, bus
  factor requirements. Sample data moved from `src/lib/shops/` to `src/lib/dev/` so nothing
  fabricated shares a namespace with real shop code.

- `2026-09-11` - Working cadence decided and recorded: weekly joint call plus a 24-hour
  validation trigger on shop batches, first three shops reviewed same-day. Two proposed
  amendments to the build order are held OPEN in `docs/DECISIONS.md` pending a joint
  decision: the synthetic seed needs a schema-level marker rather than a name prefix, needs
  an answer for `photo_source` on fabricated rows, and must include a `pending` rating or
  the step 3 security gate passes vacuously against an empty table.

**Blocking build step 1:** the three open questions on the synthetic seed above. Step 1
cannot start until they are answered, because two of them are schema decisions and the third
determines whether the step 3 gate is a real test.

- `2026-09-11` - App named **Ayos**, package `io.github.yoimuri.ayos`, EAS project created as
  `@blundered-project/ayos`. `expo-updates` installed, `preview` channel and branch created,
  Android keystore generated on Expo's servers. First preview build submitted.

- `2026-09-11` - README rewritten from the Expo template default to a real one: requirements,
  clean-checkout run instructions, project structure, the three build profiles, over-the-air
  updates, keystore warning, and an honest built/not-built list. Satisfies the bus-factor
  rule for everything that currently exists.

- `2026-09-11` - First preview build FINISHED, 21 minutes on the free queue. Profile
  `preview`, internal distribution, channel `preview`, runtime version 1.0.0, versionCode 1.
  APK: https://expo.dev/artifacts/eas/obgRNFJDQAOuvR9nTyrNb-4KMhmu1-XUneh8fg1NUMk.apk
  Build budget used: 1 of 15 this month. Keystore is held by EAS and is NOT yet backed up.

**Owed:** the README's Security and Current state sections need updating the moment Supabase
exists, since environment variables and migrations are the part a stranger cannot guess.
