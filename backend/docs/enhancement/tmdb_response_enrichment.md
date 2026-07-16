# TMDB Response Enrichment — System-Wide

**Status:** Implemented (Phase 2 of the TMDB architecture enhancement)
**Phase 1 reference:** `docs/archeticutre_enhancement/` (the original architecture decision, matching diagrams, and Title Details implementation)
**Audience:** Backend engineers who need to understand, extend, or debug the enrichment pipeline without reading every service file first.

---

## 1. What this document covers

Phase 1 introduced TMDB as a second data source and enriched exactly one endpoint: `GET /api/titles/{title}`. That proved the architecture — Laravel orchestrating FastAPI (ranking) and TMDB (presentation), merged into one response, with TMDB never a hard dependency.

Phase 2 extends the **same** architecture, the **same** two services (`TmdbService`, `TmdbMappingService`), and the **same** caching/graceful-degradation philosophy to every other endpoint that returns movie/TV data: Recommendations, Home, Favorites, and Watch History. Search Autocomplete was deliberately left unenriched — see §7.

Nothing here is a redesign. If you've read the Phase 1 docs, the mental model doesn't change — only the number of callers does.

---

## 2. Architecture recap

```
Frontend
   │
   ▼
Laravel  (orchestration layer — the only thing the frontend talks to)
   │                    │
   ▼                    ▼
FastAPI (ML)         TMDB API
ranking, search,     posters, ratings, overview,
recommendations      cast, trailer, backdrop
   │                    │
   └────────┬───────────┘
            ▼
   Laravel Merge Layer
   (Resources: TitleDetailResource, RecommendationItemResource,
    FavoriteResource, WatchedTitleResource, HomeService)
            │
            ▼
    Final API Response
   (frontend never knows two services exist)
```

**Responsibilities (unchanged from Phase 1):**
- **FastAPI** — search, autocomplete, recommendation ranking, and the raw dataset fields (title, type, genres, rating, country, release_year, director, similarity_score). Never touched by this enhancement.
- **TMDB** — presentation-layer metadata only: poster/backdrop images, `vote_average`, `overview`, `cast`, `trailer_key`, `runtime`. Optional everywhere, never authoritative for ranking or search.
- **Laravel** — decides *which* fields each endpoint's UI actually needs, fetches them from the right layer(s), merges, and returns one clean response. This is the layer this document is about.

---

## 3. The two shared services (unchanged responsibilities, now more callers)

### `App\Services\TmdbService`
The only class that speaks HTTP to TMDB. No caching, no persistence — purely "ask TMDB a question, get a shaped answer or `null`."

| Method | Purpose | Used by |
|---|---|---|
| `findByTitle(title, year, type)` | Single search + year-tolerant match. Returns `{tmdb_id, poster_path, backdrop_path, vote_average}` or `null`. | `TmdbMappingService::findOrCreateMapping()` |
| `findManyByTitle(entries)` | Parallel batch search via `Http::pool()`. Same return shape per entry, keyed by caller-chosen key. | `TmdbMappingService::getCardMetadataForTitles()` |
| `getDetails(tmdbId, type)` | Single request (`append_to_response=credits,videos`) for overview, `vote_average`, `runtime`, cast (top 5), `trailer_key`. | `TmdbMappingService::resolve()` |
| `posterUrl()` / `backdropUrl()` | Build a full image URL from a stored path + configured size. | Everywhere a path needs to become a URL |

**New in Phase 2:** `findByTitle()`/`findManyByTitle()` now also extract `vote_average` from the TMDB search response — it was already present in that payload, so this added zero new HTTP requests.

### `App\Services\TmdbMappingService`
Decides *when* to bother calling TMDB, via the same hybrid Cache → DB → TMDB strategy from Phase 1.

| Method | Returns | Used by |
|---|---|---|
| `resolve(title, year, type)` | Full detail payload (poster, backdrop, overview, vote_average, runtime, cast, trailer_key, `tmdb_available`) | `TitleController::show()` only |
| `getCardMetadataForTitles(titles[])` | `array<string, {poster_url, vote_average}>` keyed by title | `TitleController::recommendations()`, `HomeService`, `FavoriteController`, `WatchedTitleController` |
| `unavailable()` | The safe all-null fallback shape `resolve()` returns on failure | `TitleController` (when ML's type label can't be mapped) |

**Renamed in Phase 2:** `getPostersForTitles()` → `getCardMetadataForTitles()`, and its return type changed from a bare `?string` poster URL to `{poster_url, vote_average}`. This is the one shared method every list/card endpoint now calls.

### New in Phase 2: `App\Http\Controllers\Concerns\ResolvesPosterUrls`
A small controller trait shared by `FavoriteController` and `WatchedTitleController`. Both list a `Collection` of owned-title rows (`title_name`, `release_year`, `title_type` — already a validated `TitleType` enum, snapshotted from ML at add-time) and only need `poster_url` per item. The trait batches them into one `getCardMetadataForTitles()` call and plucks just `poster_url` back out, so neither controller duplicates the batching logic.

### New in Phase 2: `App\Enums\TmdbMediaType::tryFromLabel()`
`TitleController` and `HomeService` both need to turn ML's raw label (`"Movie"` / `"TV Show"`) into TMDB's vocabulary (`movie` / `tv`), gracefully degrading instead of throwing for an unrecognized label. Pulled onto the enum itself so the mapping logic isn't duplicated between the two callers.

---

## 4. Per-endpoint documentation

### 4.1 `GET /api/titles/{title}` — Title Details (Phase 1, unchanged)

- **Purpose:** Full detail page for one title.
- **Resource:** `TitleDetailResource`
- **ML fields:** `title, type, genres, rating, country, release_year, director`
- **TMDB fields:** `poster_url, backdrop_url, overview, vote_average, runtime, cast, trailer_key, tmdb_available`
- **Merged by:** `TitleController::show()` calls `MLClientService::getTitleDetail()` then `TmdbMappingService::resolve()` sequentially (the release year needed to disambiguate remakes is only known once ML responds — see the docblock on `TitleController::resolveTmdb()`), and `TitleDetailResource` merges both into one array.
- **Frontend:** `TitleDetailPage.jsx` (poster hero, backdrop background, overview, cast list, trailer embed, rating badge).
- **Graceful fallback:** `tmdb_available: false`, all TMDB fields `null`, ML fields unaffected.
- **Cache:** `tmdb:details:{title}:{year}`, 24h (positive) / 1h (negative).

This endpoint is unchanged by Phase 2 — documented here only for completeness, since every other endpoint below is a deliberately *smaller* version of the same idea.

### 4.2 `GET /api/recommendations/{title}` — Recommendations

**Purpose:** Up to `n` similar titles for a "You may also like" rail.
**Resource:** `RecommendationItemResource` (wrapped by `RecommendationResource`)

**Before (Phase 1):**
```json
{
  "title": "Better Call Saul",
  "type": "TV Show",
  "release_year": 2015,
  "similarity_score": 0.98,
  "poster_url": "https://image.tmdb.org/t/p/w500/....jpg",
  "user_signals": { "is_favorite": false, "is_watched": false }
}
```

**After (Phase 2):**
```json
{
  "title": "Better Call Saul",
  "type": "TV Show",
  "release_year": 2015,
  "similarity_score": 0.98,
  "poster_url": "https://image.tmdb.org/t/p/w500/....jpg",
  "vote_average": 8.7,
  "user_signals": { "is_favorite": false, "is_watched": false }
}
```

- **ML fields:** `title, type, release_year, similarity_score` (genres/rating/country/director/rank are in the raw ML payload but dropped by the Resource — not useful for a recommendation card).
- **TMDB fields:** `poster_url` (Phase 1), `vote_average` (**new**, Phase 2).
- **Why `vote_average` was added:** Recommendations is a *discovery* surface — the user is choosing between 10 unfamiliar titles, and a rating is a real decision signal. It cost nothing extra: `vote_average` is already present in the same TMDB search response `poster_url` was already extracted from.
- **Why not the full detail payload (overview/cast/trailer):** that would mean one `getDetails()` call per recommended item (10 extra TMDB requests) instead of one shared batched search. Full detail is reserved for when the user actually opens a title.
- **Merged by:** `TitleController::recommendations()` batches every result's `{title, release_year, type}` into one `TmdbMappingService::getCardMetadataForTitles()` call, then `RecommendationResource` distributes each title's `{poster_url, vote_average}` into its own `RecommendationItemResource`.
- **Frontend:** `TitleCard.jsx` — used on the Title Details "You May Also Like" rail. Note: `TitleCard.jsx` currently fetches its own poster client-side via `api/tmdb.js` rather than reading `title.poster_url` from this response — see §8.
- **Graceful fallback:** `poster_url: null, vote_average: null` per item TMDB has no match for — never removes the item, never fails the request.
- **Cache:** shares the same `tmdb:card:{title}:{year}` keyspace as Home/Favorites/History, 24h (positive) / 1h (negative).
- **Performance:** one batched call for the whole result set (not one per item); a Cache/DB hit for a title never triggers a TMDB request at all.

### 4.3 `GET /api/home` — Home Feed

**Purpose:** Personalized sections (Popular, Handpicked, Because You Watched, etc.) — see `docs/features/04_feature-home`.
**Resource:** raw array, built directly by `HomeService` (no dedicated `JsonResource` class — this endpoint predates the Resource-per-shape convention and wasn't changed here).

**Before (Phase 1) — one item inside a section:**
```json
{ "title": "Narcos", "type": "TV Show", "release_year": 2015, "similarity_score": null, "poster_url": "https://image.tmdb.org/t/p/w500/....jpg" }
```

**After (Phase 2):**
```json
{ "title": "Narcos", "type": "TV Show", "release_year": 2015, "similarity_score": null, "poster_url": "https://image.tmdb.org/t/p/w500/....jpg", "vote_average": 8.8 }
```

- **ML fields:** `title, type, release_year, similarity_score` (per item, from `MLClientService::getManyTitleDetails()` / `getManyRecommendations()`).
- **TMDB fields:** `poster_url` (Phase 1), `vote_average` (**new**, Phase 2) — same rationale as Recommendations (Home is also a discovery surface).
- **Backdrop was deliberately not added** — no Home UI currently renders a backdrop per card; adding it would be pure response bloat with zero consumer.
- **Merged by:** `HomeService::attachCardMetadata()` (renamed from `attachPosters()`) runs **once per request**, after every section is built — it flattens every item across every section into a single `getCardMetadataForTitles()` call, so a title appearing in two sections is only looked up once, and the whole feed (which can be 3–4 sections × up to 10 items) never costs more than one batched TMDB round trip for whatever's left after Cache/DB.
- **Frontend:** `HomePage.jsx` via `TitleCard.jsx` (same caveat as §4.2 about the frontend not yet consuming `poster_url` — see §8).
- **Graceful fallback:** per-item `poster_url: null, vote_average: null`; a section itself never disappears because of a TMDB failure (only ML failures can empty a section, and that was already true pre-enhancement).
- **Cache:** same `tmdb:card:*` keyspace as Recommendations/Favorites/History.
- **Performance:** this was the primary target of the "avoid N+1" requirement — a naive per-section implementation would have made up to 4 separate batch calls; this makes exactly one.

### 4.4 `GET /api/favorites` + `POST /api/favorites` — Favorites

**Purpose:** The user's saved-titles list (`MyListPage.jsx` / `MyListCard.jsx`).
**Resource:** `FavoriteResource`

**Before (Phase 1 — Favorites had no TMDB enrichment at all):**
```json
{
  "id": 12,
  "title_name": "Breaking Bad",
  "title_type": "TV Show",
  "genres": "Crime, Drama, Thriller",
  "release_year": 2008,
  "added_at": "2026-07-01T10:00:00Z"
}
```

**After (Phase 2):**
```json
{
  "id": 12,
  "title_name": "Breaking Bad",
  "title_type": "TV Show",
  "genres": "Crime, Drama, Thriller",
  "release_year": 2008,
  "poster_url": "https://image.tmdb.org/t/p/w500/....jpg",
  "added_at": "2026-07-01T10:00:00Z"
}
```

- **ML fields:** `title_name` (`title`), `title_type` (`type`), `genres`, `release_year` — **not fetched fresh here**. They were snapshotted from ML *at the moment the favorite was added* (`FavoriteService::addFavorite()`) and never re-fetched on read, by original design (see `docs/features/02_feature-favorites`). This enhancement doesn't change that.
- **TMDB fields:** `poster_url` only.
- **Why `vote_average` was deliberately NOT added:** Favorites is not a discovery surface — it's a list of titles the user already chose. `MyListCard.jsx`/`TitleCard.jsx` don't render a rating anywhere for this list, and there's no obvious near-term UI need for one here the way there is for Recommendations/Home. Adding it would be response bloat with no current or clearly-anticipated consumer — the opposite of what this enhancement is for.
- **Merged by:** `FavoriteController::index()`/`store()`, via the shared `ResolvesPosterUrls` trait.
- **Frontend:** `MyListPage.jsx` → `MyListCard.jsx` (poster, title, genres, release_year — matches exactly).
- **Graceful fallback:** `poster_url: null` per item; the list itself is never affected by a TMDB failure.
- **Cache:** same `tmdb:card:*` keyspace.
- **Performance:** one batched call for the whole list on `index()`; a single-entry batched call (still going through the same method, for consistency) on `store()`.

### 4.5 `GET /api/history` + `POST /api/history` — Watch History

**Purpose:** The user's watched-titles list (`HistoryPage.jsx` via `TitleCard.jsx`).
**Resource:** `WatchedTitleResource`

Identical shape and reasoning to Favorites (§4.4) — same ML-snapshot-at-write-time design, same `poster_url`-only decision, same shared `ResolvesPosterUrls` trait, same graceful fallback and caching. The only difference is the timestamp field name (`watched_at` instead of `added_at`).

**Before → After** is the same diff as §4.4, with `added_at` replaced by `watched_at`.

### 4.6 `GET /api/search` — Search Autocomplete (deliberately unchanged)

**Not enriched, by design — and this was a deliberate re-confirmation of the Phase 1 decision, not an oversight.**

The Phase 1 architecture docs (`docs/archeticutre_enhancement/09_Q7_Enrichment.svg`, `11_Endpoints_Review.svg`, `17_API_Contracts_Impact.svg`) already decided against enriching this endpoint: it backs a real-time autocomplete dropdown where typing latency matters more than imagery, and posters were never part of its documented contract.

Re-inspecting the frontend for this phase surfaced a nuance worth recording: `GET /api/search` is actually called from **two** different UI contexts that share the same low-level API:
1. The instant-typeahead dropdown (`Header.jsx`'s `CommandPalette`, `DiscoverSearch.jsx` via `useDebouncedSearch`) — genuinely latency-sensitive, fires on every keystroke.
2. The full **Search Results page** (`SearchResultsPage.jsx`, navigated to once per search submission, not per keystroke) — renders a `TitleCard` grid and would visually benefit from posters the same way Recommendations does.

Because both contexts hit the exact same backend endpoint, enriching it would slow down the dropdown to benefit the results page, and leaving it alone under-serves the results page. This is a frontend API-usage question, not a backend one — see the recommendation in §8. The backend endpoint itself was left exactly as Phase 1 designed it: unenriched, `MLClientService` only, no `TmdbMappingService` dependency.

---

## 5. Failure handling (unchanged philosophy, now applies everywhere)

Every enrichment call in every endpoint above degrades the same way, because they all ultimately go through `TmdbService`'s `get()`/pool methods, which never throw:

| Failure | Behavior |
|---|---|
| `TMDB_API_TOKEN` not configured | `TmdbService` returns `null` immediately, no request attempted |
| Network/connection error | Logged as a warning, `null` returned |
| Timeout | Logged as a warning, `null` returned |
| TMDB responds with an error status | Logged as a warning, `null` returned |
| No matching search result | Treated as a miss, not an error |
| A matching result whose year is outside ±1 tolerance | Rejected as a wrong match, treated as a miss (see the "Wrong TMDB Match" edge case in Phase 1 docs) |

At every layer above `TmdbService`, a `null`/miss becomes a documented, typed fallback — `TmdbMappingService::unavailable()` for full detail, `{poster_url: null, vote_average: null}` for card metadata — never an exception, never a 5xx, never a missing field. The ML pipeline (search, recommendations, ranking) is completely unaffected by any TMDB failure mode, in every endpoint.

---

## 6. Caching strategy (unchanged strategy, one new keyspace)

Same hybrid Cache → DB → TMDB strategy as Phase 1, now serving two distinct payload shapes:

| Cache key prefix | Payload | TTL (positive / negative) | Used by |
|---|---|---|---|
| `tmdb:details:{title}:{year}` | Full `resolve()` payload | 24h / 1h | Title Details only |
| `tmdb:card:{title}:{year}` | `{poster_url, vote_average}` | 24h / 1h | Recommendations, Home, Favorites, History |

The DB table (`title_tmdb_mappings`) is shared by both keyspaces — it only ever stores the stable identity fields (`tmdb_id`, `tmdb_type`, `poster_path`, `backdrop_path`), never `vote_average` or `overview`, which live in cache only. This means a title's *identity* mapping, once resolved via either code path, is immediately available to the other — a title first seen via a Recommendations card lookup will skip the search step entirely the next time it's opened as a Title Details page (and vice versa), even though the two payload shapes are cached independently.

**Consequence worth knowing:** a card-metadata DB hit (mapping already known, so the search step is skipped) has no fresh source for `vote_average` and returns `null` for it, even though `poster_url` resolves normally from the stored `poster_path`. This is a deliberate tradeoff (see `TmdbMappingService::getCardMetadataForTitles()`'s docblock), not a bug — re-fetching `vote_average` would mean paying for a TMDB request on every DB hit, defeating the purpose of the DB layer.

---

## 7. Mapping strategy (unchanged)

Title + release_year (±1 year tolerance) + type, exactly as Phase 1 established. No director-based disambiguation was added in this phase either — see the Phase 1 report for why year+type is sufficient for the documented edge cases (remakes, duplicate titles, movie/TV conflicts).

One addition: `Favorite`/`WatchedTitle` rows already carry a validated `TitleType` enum (set at add-time from ML's label, cast on the model), so `FavoriteController`/`WatchedTitleController` map to `TmdbMediaType` via the non-fallible `TmdbMediaType::fromTitleType()` — unlike `TitleController`/`HomeService`, which only have ML's raw string label and must use the fallible `TmdbMediaType::tryFromLabel()`.

---

## 8. Recommended frontend improvements (not implemented — backend-only scope)

These are documented for coordination with the frontend team, not implemented here:

1. **`TitleCard.jsx` and `MyListCard.jsx` still fetch posters client-side.** Both components call `posterFor()` from `frontend/src/api/tmdb.js`, which does its own TMDB search directly from the browser using `VITE_TMDB_API_KEY` — independently of the `poster_url` this backend enhancement now returns on every endpoint that uses these components (Recommendations, Home, Favorites, History). This means:
   - Every card currently makes a *second*, redundant TMDB call from the browser, even though the backend already resolved and cached the same poster.
   - The backend's caching, batching, and rate-limit protection are being bypassed entirely for the actual rendered image.
   - Updating these two components to prefer `title.poster_url` (falling back to `posterFor()` only when it's `null`) would remove the redundant client-side TMDB dependency and let the backend's cache actually do its job.
2. **`vote_average` isn't rendered anywhere in the frontend yet.** It's now returned by Recommendations and Home; a rating badge on `TitleCard.jsx` (similar to the existing "Match %" badge) would be a natural, low-effort use of it.
3. **`GET /api/search` serves two different UI needs from one endpoint** (§4.6) — the autocomplete dropdown and the full Search Results grid. If posters are wanted on the Search Results page, consider either a separate endpoint/query flag for that page specifically, or having `SearchResultsPage.jsx` do its own batched enrichment client-side against a future bulk endpoint — but *not* by enriching `/api/search` itself, which would slow down every keystroke in the dropdown.
4. **Trending (`TrendingPage.jsx`) and AI Recommend (`RecommendPage.jsx`) are currently pure client-side mocks** — they don't call the backend at all (confirmed while reading the frontend for this phase). No backend enrichment applies to them until they're wired to real endpoints; that's a larger frontend/product decision outside this enhancement's scope.

---

## 9. Quick reference — what each endpoint returns

| Endpoint | `poster_url` | `backdrop_url` | `overview` | `vote_average` | `runtime` | `cast` | `trailer_key` |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `GET /titles/{title}` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `GET /recommendations/{title}` | ✅ | — | — | ✅ | — | — | — |
| `GET /home` | ✅ | — | — | ✅ | — | — | — |
| `GET /favorites` | ✅ | — | — | — | — | — | — |
| `GET /history` | ✅ | — | — | — | — | — | — |
| `GET /search` | — | — | — | — | — | — | — |
