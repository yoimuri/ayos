# BACKLOG

Everything deferred, promised or left open, gathered 12 September 2026.

Read with `docs/DECISIONS.md` (why things were chosen) and `CLAUDE.md` section 2A
(warnings that are not problems). This file is what has NOT happened yet.

Nothing here is agreed scope. Anything marked **joint** needs both Clint and the
co-founder, because it changes what has to be collected in the field.

---

## 1. The next native build

**These cannot ship over the air.** Each is native code, so they wait and go together in
one build. Budget so far: **2 of 15 used this month**.

| # | Package | For | Replaces |
|---|---|---|---|
| N1 | `@maplibre/maplibre-react-native` | The real map, build order step 6 | `src/components/MockMap.tsx` |
| N2 | `expo-location` | The rider's actual position | Hardcoded distances in sample data |
| N3 | `expo-image-picker` | Real photo and video on ratings | Placeholder chips in `src/app/rate/[id].tsx` |
| N4 | `@react-native-community/netinfo` | Proper offline detection from the OS | The polling probe in `src/lib/net/useOnline.ts` |
| N5 | `@expo/vector-icons` or `react-native-svg` | A real icon set | Hand-drawn `src/components/icons.tsx` |
| N6 | `expo-sqlite` **if chosen** | The on-device shop store, step 4 | Still an open decision, spec section 13 |
| N7 | Sentry, PII scrubbed | Crash reporting | Nothing |
| N8 | 14 Expo patch bumps | `npx expo install --check` | See CLAUDE.md 2A |

**Do them in one build, not eight.** Add the packages one at a time locally, confirm the
app still runs against Metro after each, then build once at the end.

### Also in that build, and easy to forget

- ~~The wordmark font.~~ **Done 12 Sep, over the air, no build.** Confirmed: `expo-font`
  was already compiled into the APK, and a font file is an asset, so `eas update` carried
  it. `assets/fonts/AyosWordmark.ttf` is Archivo instanced to wdth 115 / wght 560.

- **Bump `version` in app.json.** Both builds are `1.0.0`, and `runtimeVersion` uses the
  `appVersion` policy, so the two are treated as compatible when they are not. See §4.
- **Delete the build-info panel** in Settings once the navigation-bar inset is confirmed.
- **Delete `src/lib/dev/sample-shops.ts`** at step 4, when real synced shops arrive.

---

## 2. Feature proposals, not agreed

Numbering matches the design canvas Record page.

| # | Proposal | Cost | Lands on |
|---|---|---|---|
| ~~P1~~ | ~~Adjustable radius~~ | — | **Built 12 Sep** |
| ~~P2~~ | ~~Search a shop by name~~ | — | **Built 12 Sep** |
| P3 | Editable ratings, Shopee style | Medium | Clint. New flow, rate-limit rework, no new field data |
| P4 | Multi-criteria ratings: service, price, efficiency | High | **Joint.** Schema change, and it touches a locked decision |
| P5 | Shop specialisation and overview | High | **Joint.** Placeholder text exists; real text needs collecting |
| P6 | Filter by motorcycle type | High | **Joint.** Needs every shop to record what it services |
| P7 | Landmark line on each shop | **Low** | Co-founder already knows it on the visit |
| P8 | Address in the list row | None | Data already collected, pure layout |
| P10 | Real road distance via OSRM or Valhalla | High | Clint. Server-side breaks offline; on-device is serious work. **Partly answered 12 Sep** by the 1.3 detour factor — this is the measured version that replaces the assumed one, and calibrates it |
| P13 | Move the sheet drag onto the UI thread | Medium | **Ships over the air.** gesture-handler 2.32 and reanimated 4.5.1 are both compiled in already. PanResponder can only scrub from JavaScript, which is a ceiling on how smooth the drag can be. Needs a `GestureHandlerRootView` at the root |
| P11 | Live traffic, flood and accident reports | **Not viable** | Needs users at Waze scale, or a rented per-request feed |
| ~~P9~~ | ~~Street View~~ | — | **Rejected 12 Sep.** Breaks three locked rules |

**P7 is still the best value on this list.** One text column, negligible collection
effort, works offline, and it is the only item Google structurally cannot match.

### Unresolved inside P4

Splitting one score into three means roughly three times the rating volume before
anything displays, because the average is withheld below five ratings. On a new app most
shops would show nothing for months. Decide the criteria count and the threshold
together, not separately.

---

## 3. UI work promised but not built

| Item | Note |
|---|---|
| **Map fullscreen mode** | Clint's plan. The app bar was deliberately kept compact and the area below it left clear so the map has somewhere to expand into |
| **More app-bar controls** | Same reason. The city picker is a 34px pill rather than a full-width row to leave space |
| **Bike filter on the main screen** | Only once shops carry bike data, P6. As a filter over missing data it would visibly do nothing |
| **Average rating always visible** | Currently withheld below 5 ratings, per the locked rule. Showing it always is a spec amendment and a joint call |

---

## 4. Known gaps and unfinished checks

| Gap | Why it matters |
|---|---|
| **`runtimeVersion` never changes** | Both builds are `1.0.0` under the `appVersion` policy, so an update meant for new native code would still be offered to an older APK and could crash it. Either bump `version` on every native change, or switch the policy to `fingerprint`, which computes the fence from the native code itself instead of trusting memory |
| **Navigation-bar inset unconfirmed** | Three layout fixes have not resolved the overlap. Settings → Build info now prints the real numbers. If `bottom` reads 0 the cause is native config and no layout change will fix it; if it reads ~48 the layout is wrong. **Still unanswered** |
| **The brand band is a fixed fifth of the screen** | It never collapses, so the map and the list divide what is left. Its shop-count line already truncates, which means it is not earning its row. Collapsing it when the sheet is raised is the next lever on the cramped-list problem |
| **OxShop.dc.html disagrees with OxHome.dc.html on units** | The shop artboard shows `320 METRES`; the home artboard shows `0.32 KM`, which is what the code does. One of the two artboards is stale and the canvas needs a decision, not a guess |
| **README has no Supabase setup** | The bus-factor rule needs a stranger to run from a clean checkout. The part they cannot guess is the database, which does not exist yet |
| **Offline detection is a probe, not the OS** | Up to 15 seconds to notice a change, and a small request every 15s while open. Replaced by N4 |
| **`DETOUR_FACTOR` is assumed, never measured** | 1.3 is the middle of the published 1.2-1.4 range for dense urban grids, not a figure taken from Metro Manila roads. It shifts both the displayed distance and which shops pass a radius chip, so if it is wrong, it is wrong in both places at once. Calibrate against real routed distances when P10 lands |
| **Rating stores nothing** | Form, validation and confirmation are real. Storage, the confirmation email and the three rate limits are server-side and arrive at step 9 |

---

## 5. Spec amendments owed

The code now contains things `docs/MOTO_APP_BUILD_SPEC.md` does not. The spec is the
contract between two people, so it is stale until these are agreed and written in.

| In the code | Not in the spec |
|---|---|
| `socials` on a shop | Section 5 has `phone` only. New columns, and new field collection |
| Dark mode | Not mentioned anywhere |
| First-run questions for area and motorcycle | Section 4.0 describes a walkthrough, not questions |
| `status`, `area`, `about`, `ratingAvg` fields | Not in the section 5 schema |
| English first, Taglish second | Section 4.4 says Taglish first, then English and Filipino |
| Two languages, not three | Section 4.4 lists three |

---

## 6. Deferred deliberately, with reasons

| Thing | Why not now |
|---|---|
| **EAS Workflows** (build on every git push) | 15 builds a month against several pushes a day. Automate `eas update` after step 6, never `eas build` |
| **`npm audit fix --force`** | Would move packages off the versions the SDK pins. Larger risk than the advisories it silences |
| **Third language, straight Filipino** | Every string already exists twice. A third copy waits until the wording settles |
| **Accounts** | Locked non-goal. The schema doors are open, the rooms are not built |

---

## 7. The motorcycle question, restated

Recorded here because its purpose was wrong in earlier notes.

The first-run and Settings question is **audience research**, not a shop filter. The
aggregate answer tells the two of them what Metro Manila riders actually ride, which
shapes which shops are worth collecting and whether P6 is worth building at all. It is
useful before any shop records anything.

Today the answer lives on the device only. It reaches the team through `usage_events` at
build order step 10, which stores no user identifier and no precise coordinate, so an
aggregate count stays inside the privacy position in spec section 9.
