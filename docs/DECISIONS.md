# DECISIONS

Three lines per entry: what was decided, why, what was rejected.
Newest at the bottom. Only non-obvious decisions belong here.

---

## 2026-09-11 - Project lives at `Desktop\PROJECTS\moto-app`, not `C:\dev\`

**What:** The project root is `C:\Users\muri\Desktop\PROJECTS\moto-app`.
**Why:** The original `C:\dev\` instruction existed to keep `node_modules` out of OneDrive sync, which corrupts builds. Checked this machine: the Desktop shell folder resolves to a plain local `C:\Users\muri\Desktop` and the OneDrive folder holds only a `desktop.ini`, so nothing on Desktop is synced. The risk the rule guarded against does not exist here, and this path matches where the other projects already live.
**Rejected:** `C:\dev\moto-app`, which would have split this project away from every other repo on the machine for no active reason. Revisit if OneDrive folder backup is ever turned on for Desktop.

---

## 2026-09-11 - Node v24 LTS, upgrading from v22.15.0

**What:** Move the machine to Node v24.21.0 (Krypton, the active LTS) before `create-expo-app` runs. Installed via the x64 MSI from nodejs.org, which upgrades the existing `C:\Program Files\nodejs` install in place. Brings npm 10.9.2 to 12.0.2 as a side effect, since npm ships inside Node.
**Why:** The installed v22.15.0 dates from 22 Apr 2025 and the v22 line dropped to security-only maintenance on 21 Oct 2025, leaving it 16 patch releases behind with Node security releases in Mar, Jun and Jul 2026 all missed. Expo SDK 57 only requires v22.13, so this was not blocking, but the runtime sits under every other tool and a stale one turns into a suspected cause every time a native build misbehaves. Cheaper to fix at zero code than mid-project.
**Rejected:** Staying on v22.15.0, which leaves known security patches unapplied for no gain. Patching to v22.23.2, which buys the security fixes but keeps the project on a line that dies April 2027, forcing the same upgrade again later. Waiting for v26 LTS on 28 Oct 2026, rejected because v24 is supported to April 2028 and there is no reason to idle six weeks. Also rejected: nvm-windows for multiple parallel versions, since one project on one machine does not need version switching and it adds a layer to debug.

**Outcome:** installed and verified 11 Sep 2026. `node -v` reports v24.21.0, `npm -v` reports 11.19.0. Note the npm number: 11.19.0 is the version bundled inside that Node release, not the 12.0.2 currently newest on the registry. Bundled npm is the right one to keep.

---

## 2026-09-11 - `default` template, then `reset-project`

**What:** Scaffold with `npx create-expo-app@latest . --no-agents-md` using the `default` template, then run `npm run reset-project` to move the demo app into `example/` and leave a clean `src/app` holding `index.tsx` and `_layout.tsx`.
**Why:** The default template arrives with Expo Router already wired: `"main": "expo-router/entry"` in package.json, `"expo-router"` in the app.json plugins array, typed routes enabled, and a working `_layout.tsx`. Wiring that by hand is the single most error-prone part of starting an Expo project, and when it is wrong the symptom is an unhelpful "route not found" rather than a pointer to the broken link. `reset-project` then removes the demo, so the pre-wiring is kept without inheriting 20 files of themed-component boilerplate.
**Rejected:** `blank-typescript`, which produces only files Clint wrote but requires installing expo-router, changing the entry point, registering the plugin and authoring `_layout.tsx` by hand on a first mobile app. Also rejected: keeping the demo and deleting it piecemeal, since `reset-project` exists to do exactly that and preserves the demo under `example/` for reference.

---

## 2026-09-11 - Screens live in `src/app`, not root `app/`

**What:** Adopt the template's layout. Screens in `src/app`, plain TypeScript in `src/lib`. `CLAUDE.md` section 4 updated to match in the same turn.
**Why:** Expo SDK 57 generates `src/app` and its `tsconfig.json` maps `@/*` to `./src/*`, so every generated import and every current Expo doc assumes it. Expo Router supports a root `app/` equally well, but diverging means fighting the template forever for no functional gain. The rule the folder shape exists to enforce, business logic never inside a screen file, is untouched by where the folder sits.
**Rejected:** Root-level `app/` and `lib/` as originally written in CLAUDE.md, which would have left generated files and docs referencing `src/` paths that no longer exist.

---

## 2026-09-11 - The scaffolder's `Initial commit` is deleted

**What:** After scaffolding, `rm -rf .git`, then Clint runs `git init` and authors the first commit himself.
**Why:** `create-expo-app` runs `git init` and immediately commits as `Initial commit`. The project rule is that every commit is Clint's, and a tool-authored commit at the root of the history contradicts that on line one. The generated `.gitignore` is kept, since it correctly excludes `node_modules/` and `.expo/`.
**Rejected:** Keeping the automatic commit as a pristine template baseline for diffing. Real but minor value, and the same diff is available from the published template at any time.

---

## 2026-09-11 - `example/` excluded from tsconfig

**What:** Added `"exclude": ["node_modules", "example"]` to `tsconfig.json`.
**Why:** `reset-project` moves the demo into `example/` but does not update its imports, which still use the `@/*` alias now pointing at `src/*`. The result is 25+ `TS2307 Cannot find module` errors on every typecheck, none of them real. Left alone, this trains the habit of ignoring typecheck output, which is exactly how a real error gets missed later.
**Rejected:** Deleting `example/` outright, which loses a working reference for tab navigation and themed components before those are built. Also rejected: fixing the demo's imports, which is work spent on code that will be deleted.

---

## 2026-09-11 - Draft screen reads a hardcoded array, before build steps 1-5

**What:** `src/app/index.tsx` renders `SAMPLE_SHOPS` from `src/lib/dev/sample-shops.ts`. Fabricated shops, unroutable numbers, sorted by distance. Both files are deleted at build step 4. Moved out of `src/lib/shops/` the same day: that namespace is reserved for code handling real field-collected data, and fabricated records must not share it.
**Why:** Clint needed something on the phone to learn React Native against, before the database exists. The spec rule this appears to break, "screens built against the network get retrofitted badly", targets screens that *fetch*. This one reads a local array, which is the same shape the real screen has under an offline-first architecture, so it rehearses the final structure instead of a discarded one. The `Shop` type mirrors spec section 5 so the later swap changes the data source, not the screen.
**Rejected:** Waiting until after step 5 to render anything, which would have meant learning React Native and the database at the same time on a first mobile app. Also rejected: wiring the draft screen to Supabase for "realism", which is precisely what the spec rule forbids and what creates the retrofit.

---

## 2026-09-11 - Working cadence: weekly call plus an event trigger on data batches

**What:** A weekly 30-minute joint call on a fixed day, plus an event trigger: any shop batch the co-founder submits is validated within 24 hours, and his first three shops are reviewed the same day before a fourth is collected. Each cycle produces a shop count with flags, one session-log line naming the current build step, and any joint decision written here.
**Why:** The only failure mode a cadence actually prevents on this project is a large batch of field data collected in the wrong shape. Photo-sourcing errors cannot be fixed remotely and require physically revisiting the shop, so the cost of catching them late is measured in trips across Metro Manila. Development itself needs no calendar: the 13-step build order already supplies sequence and pass/fail criteria, which is what a sprint goal would otherwise provide.
**Rejected:** Two-day sprints, because steps 1 to 5 produce no user-visible deliverable and fixed timeboxes against pass/fail gates of unknown length teach the deadline to be ignored. Cadence tied to app updates or builds. Retrospectives, as ceremony for a two-person team that talks anyway. Shop count as the project progress metric, which would reward collection volume over correctness on exactly the data where correctness is expensive to fix.

**Correction to the reasoning as originally drafted:** it claimed "build quota is not a constraint because development runs on a dev client and consumes no builds." That is wrong. A dev client is itself a build, and a fresh one is required every time native dependencies change, which is why the step 6 batching amendment below exists at all. Preview builds shared with the co-founder also consume quota. What is free is JavaScript iteration once a dev client exists. The accurate statement: builds are consumed by the initial dev client, by each native dependency change, and by each preview build shared with the co-founder, totalling roughly 4 to 6 for all of v1 against a limit of 15 per month.

---

## OPEN - Amendment to build order step 1: synthetic seed data

Proposed, not settled. Needs a joint decision because it changes the schema.

**Proposal:** seed 20 clearly-marked synthetic shops (`TEST_SHOP_01` style) instead of blocking step 1 on real field data. Steps 2 to 5 run entirely on synthetic data. A gate before step 13 confirms all synthetic rows are removed.

**Why it is worth doing:** it removes the worst scheduling dependency in the project. Steps 2 to 5 need data, not real data, and blocking five build steps on field collection nobody controls is a bad trade.

**Three unresolved problems:**

1. **The marker is too weak.** A name prefix is a string convention. Cleanup by `LIKE 'TEST_SHOP%'` misses any row that was renamed, and nothing prevents a synthetic row being edited into looking real. This also contradicts the standing rule that fabricated shop records must never risk mixing with the field-collected set. A reliable marker means a nullable `is_synthetic boolean not null default false` column, which follows the same schema-door pattern the spec already blesses for `users.role` and `ratings.user_id`, and makes the step 13 gate a one-line count instead of a string match. Adding it is a schema change and therefore a joint decision.

2. **`photo_source` has no honest value for a fabricated row.** It is `not null` and allows only `team_captured` or `shop_permission`. Writing either onto a shop nobody visited puts a falsehood in the one column that encodes the project's photo-sourcing commitment. This also raises a question about the spec itself: a real shop recorded on Monday and photographed on Friday has no photo source in between, so `photo_source` may be more correct as nullable whenever `photo_url` is null.

3. **The step 3 security gate would pass vacuously.** The gate confirms no email address and no unpublished rating is readable with the public key. An empty `ratings` table returns nothing whether or not RLS is working, so the gate would record a pass having proven nothing, and retire the question. The synthetic seed must therefore include at least one rating in `pending` state carrying an email address, so that "nothing came back" means something came back was possible.

---

## OPEN - Amendment to step 6: batch native dependencies into one build

Proposed, not settled, but no objection to it.

**Proposal:** add the map library, location, local store and error tracking in a single build rather than incrementally.

**Why:** each native dependency change requires a fresh dev client build against a 15-per-month free limit. Batching four changes into one build costs one build instead of four. The only cost is a larger surface to debug if that build fails, which is mitigated by adding the packages one at a time locally and building once at the end.

---

## 2026-09-11 - App name: Ayos. Package identifier: io.github.yoimuri.ayos

**What:** The app is named **Ayos**. Android package identifier `io.github.yoimuri.ayos`, Expo slug `ayos`, deep-link scheme `ayos://`. Closes the "App name" item that was open in build spec section 13.
**Why:** Taglish-first is already the decided default for UI strings, and "ayos" is the word a rider actually uses for the outcome he wants. It describes the rider's result, being sorted out, rather than making a claim about any shop, so it stays inside the rule that the app locates and never judges competence. The package identifier uses reverse-DNS of `yoimuri.github.io`, a domain Clint genuinely controls, rather than a `com.` form implying ownership of a domain he does not have.
**Rejected:** `com.yoimuri.ayos`, which reads more like a product but asserts control of `yoimuri.com`. Deferring the identifier until the Play Store step, rejected because the co-founder needs an installable build now and the identifier stays freely changeable until first publication at step 13 anyway.

**Watch:** the identifier is permanent once the app is published to the Play Store. Revisit it deliberately at step 13, especially if the project acquires its own domain before then.

---

## 2026-09-11 - `expo-updates` added, so one build serves many changes

**What:** Installed `expo-updates ~57.0.21` and ran `eas update:configure` before the first preview build. This wrote `runtimeVersion: {policy: "appVersion"}` and `updates.url` into `app.json`, and created the `preview` channel and branch on EAS.
**Why:** The co-founder needs a build he can run on his own phone and connection while Clint is away. Without `expo-updates` compiled in, that APK can never receive an over-the-air update, so every change he needed to see would cost another build against the 15-per-month free limit. Installing it before the first build means one build now and free JavaScript updates thereafter. Installing it after would have wasted that build, since it is a native package and cannot be added over the air.
**Rejected:** Building without it and cutting a fresh preview build per change, which trades a free resource for a scarce one. The package is not listed in build spec section 10, so it was raised as a dependency decision rather than added silently; Clint approved by running the step.

**How the safety fence works:** `runtimeVersion` is set by the `appVersion` policy, so it tracks `version` in `app.json`, currently `1.0.0`. An update only reaches a build whose runtime version matches. When native dependencies change at step 6, that value must change too, so older builds stop receiving updates rather than receiving JavaScript that calls native code they do not contain.

---

## 2026-09-12 - AsyncStorage added, which costs one build

**What:** Installed `@react-native-async-storage/async-storage` at 2.2.0, the version Expo SDK 57 pins. One JSON blob under the key `ayos.settings.v1` holds language, theme, area, motorcycle and the onboarded flag.
**Why:** Theme persistence, language persistence and "ask the first-run questions once only" all require writing to the phone's disk, and every storage option in React Native is a native module. JavaScript alone cannot reach disk. One key holding one blob rather than five separate keys: five keys means five reads on launch and five chances to disagree after a partial write.
**Rejected:** `expo-sqlite`, which is the right size for the shop local store at build step 4 but far too much machinery for five preference values, and whose choice is still an open decision in spec section 13. Also rejected: keeping settings in memory only, which would have shipped over the air with no new build but would forget the rider's language every time they closed the app.

**Consequence, stated plainly:** this version cannot reach the existing APK over the air. Native code changed, so the phone needs a new install. Build budget: 2 of 15. Every JavaScript change after this one is free again.

---

## 2026-09-12 - Contact is two buttons: Call and Message

**What:** The shop screen offers Call and Message side by side instead of a single Call button. Both use `Linking` with `tel:` and `sms:`, so no extra native package was needed.
**Why:** A rider standing beside a running engine, or in traffic, often cannot hold a conversation but can send and read a text. Spec 4.2 says contact must never be more than one tap away; it does not say contact means voice. The list row still shows a single call affordance, because a row has no space for two and the shop screen is one tap away.
**Rejected:** `expo-sms`, which would have added a native module for something `Linking` already does. Also rejected: a single Contact button opening a chooser, which puts a decision between the rider and the phone number.

---

## 2026-09-12 - Scope additions accepted on Clint's instruction

**What:** Three things now in the code that are not in build spec section 3: social contact links on a shop (`socials`), dark mode, and first-run questions that ask area and motorcycle type.
**Why:** Requested directly on 12 Sep 2026 after the cost of each was stated. Recorded here rather than added silently, because the standing rule is that anything outside section 3 goes on a list for a joint decision. These are in the draft screens and the fabricated sample data only; none of them exist in the database schema, so nothing is committed until the schema is written at build step 1.
**Rejected:** Nothing yet. The spec has not been amended. If these stay, section 3 and section 5 both need updating, and the co-founder needs to agree, since `socials` is data he would have to collect from every shop.

**Open problem with the motorcycle question:** it stores an answer nothing can use. Matching a rider's bike against a shop requires shops to record what they service, which is P6 on the design canvas and does not exist. The question is built so the plumbing is ready; until P6 lands it is a preference with no consumer.

---

## 2026-09-12 - Expo patch mismatches are deferred to the next native build

**What:** `expo doctor` fails on every build with 14 patch version mismatches (`expo` 57.0.21 found, ~57.0.22 expected, and similar for 13 more). Leaving them until the step 6 build, when MapLibre goes in, and taking them in the same build. Recorded in `CLAUDE.md` section 2A so it is not re-diagnosed every session.
**Why:** Confirmed against the npm registry that Expo ships SDK 57 patches roughly weekly and these landed on 11 Sep, the day this project was scaffolded; `package-lock.json` correctly pins what was current at the time, so nothing in the repo caused it. Doctor is a pre-flight advisory and does not stop the build, verified by build 2 compiling through this exact failure. Every one of the 14 is a native module, so applying them costs one of fifteen monthly builds, and they are bug fixes for bugs this project is not hitting.
**Rejected:** Fixing them immediately, which spends a build on patch bumps alone. Also rejected: `npm audit fix --force`, which would move packages off the versions the SDK pins and is a larger risk than the moderate advisories it would silence. Also rejected: adding the packages to `expo.install.exclude` to silence doctor, which hides the signal that would matter if a real security advisory ever appeared in the same check.

**Re-check trigger:** a doctor or audit message naming a specific security advisory rather than a version mismatch. That is a different message and is acted on immediately, not deferred.

---

## 2026-09-12 - The motorcycle question is audience research, not a shop filter

**What:** The first-run and Settings question "what do you ride?" stays, and its purpose is recorded as measuring what Metro Manila riders actually ride. It is NOT waiting on shops to record which bikes they service.
**Why:** Clint's point, 12 Sep 2026. Earlier notes called it "storing an answer nothing consumes", which was wrong: the aggregate is the value. Knowing the split between scooters, underbones and big bikes tells the two of them who the app's audience really is, which shapes which shops are worth collecting, what the copy should sound like, and whether a bike filter is worth building at all. That is useful before any shop records anything.
**Rejected:** Removing the question until P6 lands, which would have thrown away the cheapest audience data the project can collect. Also rejected: putting the bike selector on the main screen, because as a *filter* it still matches against shop data that does not exist; as a *preference* it belongs in Settings.

**How it gets collected:** the answer is on the device only today. It reaches the team through `usage_events` at build order step 10, which stores no user identifier and no precise coordinate, so an aggregate count of bike types is compatible with the privacy position in spec section 9. Nothing about a single rider is learnable from it.

---

## 2026-09-12 - v2 visual identity: oxide palette and a brand band

**What:** Replaced the green-and-amber accent palette with oxide (`#B4442A` light, `#D9694B` dark) and gave every screen a brand band at the top carrying the wordmark. `src/components/BrandBar.tsx` provides it; `ScreenHeader.tsx` is deleted.
**Why:** The app read as generic because it was wearing two competitors' colours at once — a green close to Grab's `#00B14F` and an amber inside Lalamove's `#F26722`/`#FEA000` range. Verified against public brand references. Oxide is the primer that goes on bare metal, is unclaimed by any competitor in this market, and is on-subject. The band is the pattern Grab, Lalamove and JoyRide all share: the brand colour owns a whole surface with the logo inside it, rather than being sprinkled as accents.
**Rejected:** Petrol `#0C5C55`, safest but still green-family and still Grab-adjacent at a glance. Signal, near-black with hot yellow, most distinctive but yellow sits next to Lalamove's orange-peel and dark surfaces fight direct sunlight — the one condition this app must survive. Both remain drawn on the design canvas if oxide is reconsidered.

**Two tokens that do not simply lighten between themes:** `bandBg` and `bandInk`. In light the band IS oxide with white type; in dark the band becomes a dark surface and the brand colour moves to the WORDMARK. A bright band on a dark app glares, and lifting oxide far enough to survive on black turns it salmon. Every other colour is a straightforward pair.

---

## 2026-09-12 - Closed is grey, Open is green, red is for real problems

**What:** "Closed" now renders in `lineSoft`/`ink3` instead of the alert red. Green gets its own `open`/`openFill` tokens, separate from the brand. Stars get a `star` token, gold in both themes.
**Why:** A shop shut at 9 PM is a fact, not a failure, but it carried the same visual language as an error. The oxide palette forced the question, because red could no longer be both the brand and the error colour. Separating them exposed a small dishonesty that had been there since v1. Red is now reserved for things that are actually wrong: no connection, a blocked action.
**Rejected:** Keeping red for Closed and finding a different brand colour, which would have preserved the wrong signal. Also rejected: making stars oxide to match the brand, which confuses a rating with a brand mark — gold is semantic and belongs to the rating, not to Ayos.

---

## 2026-09-12 - A rough travel estimate, never a traffic-aware ETA

**What:** `roughMinutes()` in `src/lib/dev/sample-shops.ts`: straight-line distance x 1.3 for road bend, divided by 20 km/h. Rendered under the distance in every list row, always with a tilde, with a line under the list header stating that traffic is not included.
**Why:** A rider choosing between two shops wants a sense of time, and the distance is already on the phone, so this costs nothing and works with no signal. Live traffic is not a coding problem but a data problem: Waze infers it from millions of phones reporting their own speed, which needs users before it works and needs to work before it gets users. TomTom sells the feed the MMDA itself uses, but it is a rented per-request service requiring a live connection, breaking both the no-rented-services rule and the offline architecture at once.
**Rejected:** Showing a precise-looking ETA. A travel time that looks exact but ignores traffic is worse than none, because it lies to a rider at the moment they are already having a bad day. Also rejected, for now: a routing engine such as OSRM or Valhalla for true road distance — doable later, but OSRM's own maintainers describe it as not offline-first on mobile, and a server-side version stops working exactly when the app is supposed to.

**The strategic position, recorded so it is not re-litigated:** matching Google Maps on navigation is not the goal. Google has every road, live traffic from millions of Android phones, and a decade of Waze incident reports. What Google does not have is which shop will work on a Click at nine in the evening and which number gets answered. Handing navigation to Waze or Google Maps is the correct division of labour, costs nothing to run, and keeps the app small enough to work offline.

---

## 2026-09-12 - The wordmark font shipped over the air, no build

**What:** `assets/fonts/AyosWordmark.ttf` — Archivo, generated with fonttools by pinning the variable font's axes to wdth 115 and wght 560, then subset to basic Latin. 14 KB. Loaded in `_layout.tsx` with `useFonts`, applied in `BrandBar`.
**Why:** The wordmark was rendering in whatever font the phone ships, so the brand looked different on different handsets and nothing like the design. The question was whether adding a typeface needed a new APK. It does not: `expo-font` is already compiled into the build, and a font file is an asset, which `eas update` carries. Verified before shipping rather than assumed.
**Rejected:** Shipping the variable font directly. React Native has no way to set variable-font axes at runtime, so a variable file renders at its default instance — regular weight, normal width — which is not the design. Also rejected: the full character set at ~200 KB, since the asset rides along on every over-the-air update, making its size a recurring cost rather than a one-off.

**The gate matters:** the splash holds until both the settings read AND the font resolve, so the wordmark never flashes in the system face before swapping. If the file ever fails to load, `useFonts` returns an error and the app carries on in the fallback rather than hanging on a blank screen.

---

## 2026-09-12 - The map is the screen; the list is a draggable sheet

**What:** `src/components/ShopSheet.tsx`. The map fills everything below the brand band, and the shop list rides over it in a sheet with three resting positions: peek (map owns the screen), half (the default), full (list owns the screen). `MockMap` was rewritten to measure itself instead of being a fixed 260px box.
**Why:** The map was a small strip inside the list's header, which made a locator app look like a directory with a picture at the top. The map is the thing the rider is orienting by, so it should be the screen, with the list available on demand.
**Rejected:** Free-floating drag with no snap points, which makes the rider aim and feels broken. Also rejected: `react-native-gesture-handler` and `reanimated`, both already in the build and both capable of smoother physics — `PanResponder` is core, needs nothing new, and the star-rating work already proved the approach once its real bug was found.

**The lesson carried over from the star rating:** the responder is created ONCE in a ref and reads position, snap points and callbacks through refs. The earlier drag bug was not the API but handlers being rebuilt mid-gesture by re-renders. Two further details that matter: only the grab handle claims the gesture, or the list inside could never be scrolled; and a fast flick beats proximity, because someone throwing the sheet down means "show me the map" even if they only moved forty pixels.

**One consequence worth knowing:** the map's visual centre shifts with the sheet position (`centerBias`), so pins and the position dot stay in the part of the map still visible rather than hiding under the list.

---

## 2026-09-12 - The time estimate is gone; distance is a road approximation

**What:** `roughMinutes()` is deleted, along with the `~N min` line on every list row and the "Times are rough estimates" note under the list head. In its place, `roadDistance()` multiplies the straight-line metres by a `DETOUR_FACTOR` of 1.3, and both screens render the result with a leading `≈`.
**Why:** The co-founder's reading, and it is sharper than what was there: a straight line between two points is not a distance a rider can travel, so the number under-reported every shop. Roads bend. He also called the time estimate bloat, and he is right — it was distance divided by an invented average speed, so it carried the same error plus a second invented number on top, and a minute figure invites a rider to plan around it in a way a distance figure does not.
**Rejected:** Keeping the ETA with a bigger disclaimer. A disclaimer does not make a wrong number right, and the rider reads the number, not the note. Also rejected: a real routing engine now — that is P10, it is serious work, and the honest interim is an approximation that admits it is one.

**The factor is assumed, not measured.** Circuity — the ratio of road distance to straight-line distance — sits around 1.2 to 1.4 in a dense urban grid. 1.3 is the middle. It is a single named constant so that when P10 lands, calibrating it is one edit against real routed distances rather than a hunt through the screens.

**The filter moved with the display, and this changes what riders see.** `shopsForArea` now filters on `roadDistance(shop.distance_m)`, not the raw straight line. Had only the display changed, a shop at 780 m straight-line would pass the "within 1 km" chip and then render as ≈1.01 km — a visible contradiction that reads as a bug. Filtering the same number keeps the search a plain offline circle (mathematically, a circle of `radius / 1.3` in straight-line terms) while honouring what the co-founder asked for: radius stays the search basis. On the sample data the 1 km chip drops from 13 shops to 10 and the 2 km chip from 20 to 18. That is the correct answer, not a regression — those shops were never within a kilometre of riding.

---

## 2026-09-12 - The sheet was clunky because the target was 23 pixels tall

**What:** `ShopSheet` now takes a `header` prop, and the whole header drags the sheet: the grab bar, the radius chips and the list heading, about 116dp instead of 23. The responder no longer claims on touch-down, only on a move that is more vertical than horizontal.
**Why:** Only the little bar was draggable. A thumb is wider than that, so most downward swipes landed on the chips or the list and did nothing. That is not rough physics, it is the gesture never being claimed — the same root cause as the star-rating bug, which is exactly why it felt like the same problem.
**Rejected:** Making the bar merely taller. The rider aims at the controls, not at a hint, so the controls have to be the handle.

**Two rules make a drag area that still contains buttons.** It never claims on START, so a tap reaches the chip underneath. It claims only a vertical-dominant move, so the horizontal chip strip keeps its own scrolling. Both were needed: the first alone swallows taps, the second alone fights the chips.

**Two more faults fixed in the same pass.** A `forceRender` on every settle re-rendered the entire shop list at the moment the spring started, competing with it for the one thread they share — a hitch on every snap, doing no useful work, since nothing in the output depends on which point it landed on. And the drag scrubbed the value from JavaScript while the release spring ran on the native driver, which is a documented way to get a transform that stutters or stops updating. One owner now: `useNativeDriver: false` throughout.

**The ceiling, stated honestly:** PanResponder can only ever scrub from JavaScript. A drag that runs entirely on the UI thread needs gesture-handler and reanimated, which are both already compiled into this APK, so that switch would ship over the air. It is in the backlog rather than done, because the fault this time was the target, not the thread.

---

## 2026-09-12 - Snap points are measured against what fits, not chosen by eye

**What:** `half` moved from 0.42 to 0.30 of the sheet area and `peek` from 0.74 to 0.58.
**Why:** The sheet's own header costs about 116dp and a shop row about 85dp. At the old peek, what remained below the sheet top was less than the header alone needed, so "a couple of rows visible" showed none at all. At the old half it showed under two. The map being the main screen is right; taking the list down to two rows to pay for it is not, and that is what "the shop list became smaller" was describing.
**Rejected:** Shrinking the map. The map earns its space. The space actually being wasted is above it — the brand band is a fixed fifth of the screen and its "21 shops saved on this phone · upd…" line is already truncating, so it is not earning its row. Collapsing the band is the next lever and has not been taken yet.

---

## 2026-09-12 - No character ever stands in for an icon

**What:** `✆`, `✉` and `➤` are gone. `PhoneIcon`, `MailIcon` and `NavIcon` are drawn from Views, and `icons.tsx` gained a `bar()` helper that lays a bar between two points.
**Why:** A glyph renders in whatever font the handset ships. On the test device `✆` arrived ringed in a circle it was never meant to have and `✉` arrived with a cross through it, which reads as "no messages" rather than "message". The file already carried this rule in its own comment, for the gear, and then broke it three times.
**Rejected:** Nothing — this was a straightforward fault.

**The envelope's X was a rotation-origin bug, not a rendering quirk.** React Native rotates a view about its CENTRE. The flap bars were positioned by their top-left corner and then rotated, which swung one end above the envelope, where it was clipped, and the other past the middle, where it crossed its mirror. Hence an X. `bar()` now positions the MIDPOINT, which is the only way this works.

**Two limits are admitted in the code rather than hidden.** The curved desk handset cannot be built from rectangles; drawn as a shaft with a cup at each end it rendered as a dumbbell, so `PhoneIcon` is a mobile. And the overlapping contact mark had to be dropped: overlap needs the upper shape ringed in the background colour, and that ring is an opaque square that ate the phone. Four sets of proportions were rendered and every one left a bracket. The two shapes now sit clear of each other on a diagonal.

**Every shape was rendered to an image and looked at before shipping.** That is how the dumbbell and the bracket were caught. Geometry that typechecks still draws whatever it draws.

---

## 2026-09-12 - The icon set is the canvas set, reached through a subset font

**What:** `assets/fonts/AyosIcons.ttf` — Material Icons subset to five glyphs, 1.6 KB. `icons.tsx` now renders those glyphs. Call is a curved handset, Message a speech bubble, Directions a map pin, and the contact mark is a handset with an envelope over its upper right.
**Why:** The design canvas (artifact `bb645098`, artboards `OxShop.dc.html` and `OxHome.dc.html`) draws every icon as an SVG path. What shipped was `✆`, `✉` and `➤` — a telephone-location sign, an envelope and an arrowhead, none of which are the designed shapes, and all three resolved against whatever font the handset ships. The arrow was not even the right metaphor: the canvas uses a PIN for Directions, because an arrow points and a pin marks a place.
**Rejected:** `react-native-svg`, which would give path-for-path parity but carries native code and therefore needs a new APK. Also rejected: the full `@expo/vector-icons` package — it is pure JavaScript and would ship over the air, but it carries 19 font families and MaterialIcons alone is 348 KB, and the file rides along on every update.

**348 KB to 1.6 KB.** Subset with fonttools to exactly the five codepoints in use, the same treatment the wordmark got for the same reason: an asset that ships with every update is a recurring cost, not a one-off. Adding a sixth icon means re-subsetting — a codepoint that is not in the file renders as a blank box.

**A bundled icon font is not the thing that was banned.** The rule against typed characters was about glyphs resolving against the HANDSET's font, which is why `✆` arrived ringed in a circle and `✉` arrived with a cross through it. This font ships inside the app, so every device draws the identical shape. What was missing was determinism, not drawing.

**Why hand-drawing could never have got there.** Four attempts were rendered and looked at. The handset is a tapered curve and came out a dumbbell. The contact mark needs the envelope to sit on a block of the background colour so the two outlines stay separate, and that block is opaque: over a thin curved handset it covers empty space, but over the solid rounded rectangle that was standing in for a phone it covered the whole right side and left a bracket. The overlap was never the fragile part. A solid shape underneath it was.
