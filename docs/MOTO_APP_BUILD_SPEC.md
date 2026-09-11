# Motorcycle Shop Locator - Build Spec (v1 scope)

> Portable context file. Paste this as the first message in a fresh conversation to build the app.
> This file is the source of truth for scope. If a request contradicts this file, the file wins until it is amended here.
>
> Amended 11 Sep 2026: resolved the section 6 / section 4A contradiction, added offline behaviour
> decisions, updated the build order, pinned the stack.
>
> Amended 11 Sep 2026 (second pass): stack versions in section 10 re-verified against the npm
> registry. Expo stable is 57.0.21, `@maplibre/maplibre-react-native` is 11.3.10, eas-cli is
> 24.1.2. No scope changed. Details in `CLAUDE.md` section 2.

---

## 0. Context for the assistant

Solo developer, AI-assisted implementation, architecture and product decisions owned by the developer. Non-technical co-founder handles field data collection. First mobile app for this developer, so explain in plain words what a thing does before naming it.

Working rules for this build:
- No scope additions. Anything not in section 3 is out, no matter how easy it looks.
- Every non-obvious decision gets a three-line note in `DECISIONS.md`.
- Smallest possible diffs. Never rewrite a whole file to fix one thing.
- Explain the cause before proposing a fix, and say what else the same cause could affect.
- Every bug that gets fixed gets a test.
- Verify library versions and API shapes against current docs. Do not answer from memory.

---

## 1. What the app is

A mobile app that shows a rider the motorcycle shops nearest to them on a map, tagged by what each shop offers, with ratings left by other riders.

The app **locates**. It does not judge competence. Never use the words qualified, trusted, recommended, verified, or best anywhere in the UI or store listing.

Coverage: Metro Manila only. Android first.

## 2. Non-goals (do not build)

- Accounts, passwords, login sessions
- Shop owner dashboards or any shop-side controls
- Service history, maintenance log, reminders
- Correction reporting
- Booking, deposits, payments, subscriptions
- In-app messaging
- In-app turn-by-turn routing
- Web application (a static intro page only, separate from this build)
- Verification badges of any kind

## 3. In scope (v1)

1. Map view as the primary screen, markers for nearby shops
2. List view as a secondary toggle
3. Proximity search, default 500m radius, from GPS position or a user-pinned point
4. Auto-expand radius when fewer than 5 results, with a visible notice
5. Shop detail sheet
6. Rating submission with email confirmation
7. Anonymous usage measurement
8. Admin-only shop data editing (can be done directly in the DB console for v1)
9. **Offline-first operation** (see section 4A). Architecture decision, not a later feature
10. First-run walkthrough (once only, skippable) + language setting

---

## 4. Screens

### 4.0 First run
- Splash is fine. Walkthrough on first launch only, with a Skip button, never shown again.
- Neither may block a rider who opened the app because something broke.
- On first launch, download the full Metro Manila shop list to the device (see 4A).

### 4.1 Map (home)
- Map centred on user position, permission requested with a clear purpose string
- Fallback when permission denied: prompt to pin a location manually. Never a dead screen.
- Shop markers within radius
- Bottom sheet with the same shops as a scrollable list, ordered by distance ascending
- Toggle: use my location / pin a location
- Radius indicator showing the active radius

### 4.2 Shop detail
Order of content matters. Contact must never be more than one tap away.
1. Shop name
2. Operating status (Open / Closed / Unknown). "Unknown" is an acceptable and honest state
3. **Call button** and **Directions button** (side by side, large)
4. Facade photo
5. Service tags
6. Distance
7. Average rating **with rating count beside it**; hide the average if count < 5, show "X ratings" instead
8. Rating list
9. "Rate this shop" action

### 4.3 Rate flow
1. Star value (1 to 5)
2. Optional short text
3. Display name (free text)
4. Email address
5. Submit, rating stored as `pending`, confirmation email sent
6. Rating becomes `published` only after the confirmation link is clicked

Offline: the rate action is **blocked** with a plain message saying a connection is needed.
Rate limits are enforced server-side, so a queued rating could be rejected after the rider
believes it sent. Rating is not the stranded case, so this costs nothing real.

### 4.4 Settings
Language: Taglish (default) / English / Filipino. Ship Taglish first; add the other two after wording stabilises, since every string then exists in triplicate.

### 4.5 Static
Privacy notice, terms, about, contact email. Plain language, English and Filipino.

---

## 4A. Offline-first (build this in from the start)

**There is no "offline mode".** The app reads from a local copy. The network only refreshes that copy and submits ratings.

Reason: PH mobile data is patchy everywhere, not just in emergencies. A map that spins for five
seconds on weak signal reads as broken even to a rider sitting at home. Instant open on every
launch is the point. The stranded rider is a bonus, not the justification.

### Shop data
- A shop row is ~300 bytes. 2,000 shops is under 1 MB. Smaller than one photo.
- On first launch, download **all** Metro Manila shops to local storage. Not just nearby ones.
- Run the proximity query **locally** against that copy. Normal use never needs the network.
- Background refresh on app open when a connection exists. Never block behind a loading screen for data already held.
- Store `last_synced_at`.

**Two implementations of "nearby" now exist.** Postgres has PostGIS and a spatial index.
The on-device store has neither, so it filters by a rough coordinate bounding box and computes
distance in TypeScript. At ~2,000 rows this is instant. Both must order by distance ascending.
If that rule ever changes, it changes in both places. Note this in `DECISIONS.md`.

### Map tiles
Two measures together:
1. Cache tiles on device as the user pans. Any area already viewed keeps working offline.
2. Bundle a **low-zoom Metro Manila layer** inside the app (a few MB). Enough to show approximate position and shop markers; not enough for street names.

### Degradation ladder
| Condition | Behaviour |
|---|---|
| Online | Map + list, fresh data |
| No data, tiles cached | Map + list from local copy |
| No data, no tiles | **List only**: name, distance, bearing, phone. Fully usable. |
| No GPS fix | User drags a pin (already built for pinned search) |

**The phone number is the product. The map is the nice part.** A list with a call button solves the stranded case with zero tiles.

### Positioning
GPS does not need internet. A fix without data may take 20 to 60s and be less precise. Show a "finding your location" state rather than an error. That accuracy is fine for "which shops are near me".

### Usage events offline
Queue locally and send on reconnect. Cap the queue at 200 events so it cannot grow without
bound. Nobody is waiting on this data, so delay costs nothing, and offline sessions are exactly
the ones worth measuring.

### Staleness honesty
When serving from the local copy, show a banner: offline, list updated `<date>`. The user must know a phone number could be stale.

### No session to check
There are no accounts, so there is nothing to verify on open, online or offline. Email is collected only at the moment of rating, as a one-off transaction.

### Accepted consequence
The full shop dataset is now downloadable by anyone who installs the app. It was always
extractable, since the publishable key ships inside the APK, but bulk download is now the
normal path rather than an anomaly. The field-collected dataset is therefore copyable. This is
accepted, not overlooked.

---

## 5. Data model

```
shops
  id                uuid pk
  name              text not null
  location          geography(Point, 4326) not null   -- PostGIS
  address           text
  phone             text
  tags              text[]        -- subset of: dealer, repair, parts, accessories
  hours             jsonb         -- nullable, treat as unreliable
  photo_url         text
  photo_source      text not null -- 'team_captured' | 'shop_permission'
  status            text not null default 'active'    -- active | delisted
  collected_at      date not null
  created_at        timestamptz default now()

ratings
  id                uuid pk
  shop_id           uuid fk -> shops.id
  user_id           uuid null      -- unused in v1, see "schema doors"
  stars             int not null check (stars between 1 and 5)
  body              text
  display_name      text not null
  email             text not null
  state             text not null default 'pending'   -- pending | published | removed
  confirm_token     text
  device_hash       text
  created_at        timestamptz default now()
  unique (shop_id, email)

users                   -- empty in v1, exists so a v2 is not a migration
  id                uuid pk
  role              text not null default 'user'
  created_at        timestamptz default now()

shop_audit
  id, shop_id, actor, action, before jsonb, after jsonb, created_at

usage_events            -- NO user identifier, NO precise coordinates
  id
  event_type        text    -- search | shop_view | call_tap | directions_tap | session
  tags_filter       text[]
  area_code         text    -- coarse geohash or barangay code, NOT a point
  occurred_at       timestamptz
  session_seconds   int
```

**Rules**
- `shops.rating_avg` and `shops.rating_count` are stored columns, updated by trigger on rating state change. Never computed with AVG() on read.
- GIST index on `shops.location`.
- Duplicate prevention: before insert, warn if a shop exists within 75m with a similar name.

### Schema doors
Leave doors for later features. Do not build the rooms. These cost nothing now and avoid a
painful data migration later:
- `users` table exists from the first migration, with a `role` column, even though nothing reads it.
- `ratings.user_id` is nullable and unused. Without it, adding accounts later means backfilling
  ratings that belong only to an email address.

---

## 6. Proximity query

**Normal use runs locally.** The client holds the full shop list (section 4A) and computes
proximity on-device. This is the default read path.

The server-side function below stays for two jobs: the initial sync, and as the reference to
verify the local implementation against for the same coordinates.

```sql
create or replace function nearby_shops(lat float, lng float, radius_m int, limit_n int default 30)
returns table (...) language sql stable as $$
  select s.*, st_distance(s.location, st_point(lng, lat)::geography) as distance_m
  from shops s
  where s.status = 'active'
    and st_dwithin(s.location, st_point(lng, lat)::geography, radius_m)
  order by distance_m asc
  limit limit_n;
$$;
```

**Ordering is always by distance. Never by rating.** This is a locked rule, not a default, and it
applies to the local implementation and the server function equally.

---

## 7. Map tiles

Do **not** use a paid tile provider. Self-host.

- Download an OpenStreetMap extract limited to Metro Manila / NCR
- Convert to a single vector tile file (PMTiles or equivalent)
- Host on object storage
- Render with MapLibre GL

Reason: the map is the primary screen, so tile requests multiply. Rented tiles bill per load and Google's 2025 pricing change removed pooled credits. A Metro Manila extract is small enough that self-hosting is effectively free forever.

Supabase Storage serves HTTP range requests, so the storage URL works directly as a PMTiles
source. Verified September 2026.

Directions button opens the device's navigation app via a geo/URL intent. No routing built in.

---

## 8. Security requirements (non-negotiable)

The key shipped inside the app is public by design. Anyone can extract it and query the database directly. Therefore:

- **Row Level Security enabled on every table before any data is inserted.** Default deny.
  - `shops`: public read where status = 'active'. No public write.
  - `ratings`: public read where state = 'published'. Insert only via a server function that enforces the limits below. No public update or delete.
  - `usage_events`: insert only, no read.
  - `shop_audit`: no public access.
  - `users`: no public access.
- Ratings insert goes through a server-side function, not a direct table insert.
- Emails are never exposed in any public read path.
- `role` column present on any account table from the first migration, even if unused.
- MFA enabled now on hosting, database, repo, and Play Console accounts.
- Strip EXIF from any uploaded image server-side.
- Service/secret key never in the app, never in the repo.
- Use the publishable / secret key scheme. Legacy `anon` and `service_role` keys are deprecated
  and are not issued to new projects. Reject any tutorial that uses them.

### Rate limiting (server-side, all three)
| Signal | Rule | Strength |
|---|---|---|
| Email | 1 rating per email per shop, permanent | Strongest |
| Device | Max ~3 ratings per day per device hash | Medium |
| IP | Loose ceiling only | Weakest, shared connections and airplane-mode resets |

Never block a device for a full day. Cap the count, not the day.

---

## 9. Privacy position

Collected: shop records, ratings, rater display name and email, anonymous usage events.

Not collected: plate numbers, passwords, service history, expenditure, **per-person location history**.

Usage events must not be joinable to a person. Store area codes, not coordinates. Store no user id.

Required before launch: privacy notice, terms of use with a content licence and a no-warranty clause, moderation and takedown policy, accurate Play Data Safety declaration, account/data deletion request path.

Photos: `photo_source` must be `team_captured` or `shop_permission`. Never scraped, not even with attribution.

---

## 10. Stack (pinned September 2026)

| Layer | Choice | Note |
|---|---|---|
| Language | TypeScript, plus SQL | |
| App | Expo SDK 57, React Native, Android first | released 30 June 2026, stable 57.0.21 |
| Navigation | Expo Router | file-based screens |
| Map | `@maplibre/maplibre-react-native` 11.3.x | 11.3.10, cannot run in Expo Go, needs a dev build |
| Offline tiles | MapLibre `OfflineManager` packs + bundled low-zoom layer | packs are used automatically with no network |
| Tiles | PMTiles on Supabase Storage | range requests confirmed supported |
| Local store | on-device copy of all shops | format still open, see section 13 |
| Backend | Supabase (Postgres + PostGIS + RLS + Storage + Edge Functions) | |
| Keys | publishable / secret scheme, not legacy anon / service_role | |
| Builds | EAS Build | free plan allows 15 Android builds per month |
| Email | Any free-tier transactional email provider for confirmation links | still open |
| Errors | Sentry, PII scrubbed | can wait until the first build handed to someone else |

**Framework decision, settled.** React Native was chosen over Flutter, Jetpack Compose and Rust.
Rust has no mainstream mobile UI layer. Compose is Android only, so a future iOS version would
be a rewrite rather than a port. Flutter is the strongest alternative and its MapLibre plugin is
better documented for PMTiles and offline regions, but Dart plus a new UI model would be an
additional unknown on a first mobile app. The developer already works in TypeScript and React
daily, so the learning budget goes to Expo, PostGIS and offline sync instead. Do not re-open this.

---

## 11. Build order

1. Schema + PostGIS + RLS policies + seed 20 real shops
2. `nearby_shops` function, verified in SQL before any UI
3. **GATE:** query the database with only the publishable key. Confirm no email address and no
   unpublished rating is readable. Nothing proceeds until this passes.
4. Local store + first full sync. Verified with airplane mode before any screen exists.
5. Local proximity search, checked against `nearby_shops` for the same coordinates
6. Map screen + markers + list toggle
7. Radius logic including auto-expand
8. Shop detail sheet with call and directions
9. Rating flow + email confirmation + rate limits
10. Usage events with offline queue
11. First-run walkthrough, Taglish strings only
12. Legal pages
13. Play Store internal testing track

Steps 4 and 5 come before any screen on purpose. Screens built against the network get
retrofitted into offline badly, which is exactly what "architecture, not a feature" is meant to prevent.

---

## 12. Acceptance criteria for v1

- [ ] Public key alone cannot read any email address
- [ ] Empty result state is impossible; radius auto-expands with a visible notice
- [ ] Ordering is by distance in every code path, local and server
- [ ] Local and server proximity return the same shops in the same order for the same coordinates
- [ ] Average rating hidden below 5 ratings; count always shown
- [ ] Rating requires a clicked confirmation link before publishing
- [ ] All three rate limits enforced server-side
- [ ] Works on a low-end Android phone on mobile data
- [ ] Call and directions reachable in one tap from a shop marker
- [ ] No tile requests billed to any paid provider
- [ ] No usage event contains a user identifier or a precise coordinate
- [ ] Data Safety declaration matches actual behaviour
- [ ] With airplane mode on from a cold start, the app still shows nearby shops and the call button works
- [ ] Proximity search runs against the local copy, not the network, in normal use
- [ ] Staleness banner shows the sync date whenever data is served offline
- [ ] Rating while offline is blocked with a clear message, never silently queued
- [ ] Usage event queue is capped and flushes on reconnect
- [ ] Walkthrough appears once and never again after skip or completion

---

## 13. Still open

Developer's calls. The assistant must not decide these.

- ~~App name~~ **decided 11 Sep 2026: Ayos**
- Pilot area for the first 20 seeded shops
- Transactional email provider
- Local store format: `expo-sqlite` or a plain JSON file read into memory. Under 1 MB, a file is
  enough. SQLite is justified only if the queued usage events and sync state need it.
- Whether the separate intro website carries one indexable page per shop
