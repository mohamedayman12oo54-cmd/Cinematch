# Cinematch — System Understanding

> **Purpose of this document:** a single source that lets a new backend engineer (human or AI) fully understand Cinematch — the product, the business rules, the recommendation logic, and the code — before touching a single endpoint. It merges what is **written** (docs, contracts, story files), what is **built** (Laravel backend source), and what is **inferred** (marked explicitly as such). Where the written product narrative and the shipped code disagree, this document says so and defers to the code, since the code is what actually runs.
>
> **Scope note:** this repository contains two ML artifact sets: a legacy `ml/API_CONTRACT.md` (an early, aspirational spec — UUID users, PostgreSQL, `/api/user/favorites`-style routes — never implemented) and the real, currently-integrated contract described by `backend/docs/ml_contracts_document/*.md`, which matches the actual Laravel code exactly. **This document treats the `ml_contracts_document/` files and the Laravel source as ground truth.** The old `ml/API_CONTRACT.md` is noted only where relevant, as history.

---

## 1. Executive Summary

Cinematch is a **Netflix-style personalized discovery engine**: given a catalog of movies/TV shows (Kaggle "netflix1.csv"-derived dataset served by a Python ML microservice), it helps a user answer one recurring question — *"I liked X. What do I watch next?"* — and, over time, learns enough about that user to answer a harder question without being asked: *"What would this specific person want to watch tonight?"*

**What problem does it solve?** The gap between "I finished a show I loved" and "I have no idea what to watch next," which today is usually filled by scattered forum posts, inconsistent best-of lists, or generic un-personalized "Trending Now" rows. Cinematch instead treats every user action (Favorite, Watched, even the absence of the action after seeing a recommendation) as a signal about taste, and rebuilds that user's home feed from those signals on every visit.

**Who are the users?** Anyone browsing without an account (a "Stranger" — full search + generic Popular titles, nothing personalized, nothing saved), and registered users at increasing stages of relationship with the system (`stranger → explorer → regular → loyal`, see §5/§6). There is no admin/staff/multi-tenant role in this system — every account is a single "consumer" persona.

**Why does this project exist?** Per `docs/project_overview/Story_of_project.txt` (a 12-episode narrative business-analysis document written *before* any API/DB was designed — read in full for the product philosophy behind every rule in §4), the guiding insight is: **taste is discovered through action, never asked for directly.** The product deliberately has no "tell us your favorite genres" onboarding form. It has a search box and two buttons (`Add to Favorites`, `Mark as Watched`) and lets the user's own behavior build their profile.

**What makes it different?**
- **No explicit taste survey.** Favorites/Watched are the only two positive/neutral signals; opening a title page or seeing a recommendation and ignoring it carries **zero weight** (see §4).
- **Stage-aware Home feed**, not a single "Recommended For You" shelf — a brand-new visitor, a 3-signal dabbler, and a 40-signal power user see structurally different section layouts (§11).
- **Recency-weighted taste**, not a static profile — a Loyal user's oldest Favorite still counts, but less than their most recent five (§9, §7.2 of `home.md`).
- **The system never claims to be "done" learning** — every Home request recomputes stage and rankings live; nothing about personalization is precomputed/batched offline (there is no cron job, no nightly taste-rebuild — see §19).
- **ML failure tolerance is asymmetric by design:** the read-only Home feed **never** surfaces a 5xx because of an ML outage (degrades silently, section by section); the write paths (add Favorite/Watched) **do** hard-fail, because they need ML's authoritative title data to persist anything correctly (§9, §14).

---

## 2. Product Vision — The User Journey End to End

Cinematch's product vision (extracted from the 12-episode story document, `backend/docs/project_overview/Story_of_project.txt`) can be read as a single arc:

```
Guest visits, searches, sees similarity-based recommendations, leaves with nothing saved
        ↓ (friction: "I'll forget this by tomorrow")
Registers (email + password only — no profile form)
        ↓
Adds first Favorite / marks first Watched → system writes its first fact about them
        ↓
Home page evolves from generic "Popular" titles → genuinely personalized sections
        ↓
User's taste shifts over time (mood-based, seasonal, multi-genre) →
    system re-weights recent signals more heavily without discarding history
        ↓
User corrects the system (removes a bad Favorite/Watched entry, e.g. added by
    a sibling) → system re-derives taste from what remains (stage is recomputed
    live on every request, so correction is instant, not "eventually")
        ↓
User returns after a long absence → system doesn't reset to stranger,
    but also doesn't assume taste is frozen (inference — see §21)
        ↓
Home stops feeling like "search results" and starts feeling like a feed
    that already knows what the user wants before they ask
```

Two ideas recur throughout the narrative and shape almost every rule in §4:
1. **"Explain, don't impress."** Every recommendation should be traceable to a reason a non-technical user understands ("Because you loved X"), not a raw ML confidence score. *(Product narrative aspiration — the current API does surface `similarity_score`, a raw float, to the client; there is no natural-language "why" string in the shipped Home/Recommendations response. This is a gap between vision and implementation — flagged as inference/future work, not built.)*
2. **"Trust before intelligence."** A merely-decent recommendation the user understands beats a brilliant one they don't trust enough to click.

---

## 3. Complete Feature Map

| Feature | Purpose | Entry Point | Auth | Depends On | Connects To | Business Goal |
|---|---|---|---|---|---|---|
| **Auth** | Identity + session (JWT) | `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me` | Register/Login public; refresh/logout/me protected | JWT guard (`php-open-source-saver/jwt-auth`), `users` table | Every protected feature | Let the system persist a user's signals across visits |
| **Search & Discovery** | Autocomplete + title detail + similarity recommendations | `GET /search`, `GET /titles/{title}`, `GET /recommendations/{title}` | Public (optional bearer enriches response) | ML service (`/api/search`, `/api/titles/{title}`, `/api/recommend/{title}`) | Favorites/Watched (as the write targets of what's discovered here) | The entry point into the catalog; ML is the sole source of title data |
| **Favorites** | Persist "I like this" signal | `GET/POST/DELETE /favorites` | Protected | ML (`getTitleDetail` on add only) | Home (as a ranking seed), Stage resolution | Strongest positive taste signal |
| **Watched Titles (History)** | Persist "I watched this" signal | `GET/POST/DELETE /history` | Protected | ML (`getTitleDetail` on add only) | Home (as a ranking seed, weaker than Favorites), Stage resolution | Secondary/consumption signal, independent of liking it |
| **Home** | Personalized landing feed | `GET /home` | Public (optional bearer fully personalizes) | Favorites + Watched (read), ML (`getManyRecommendations`, `getManyTitleDetails`, batched/cached) | All of the above | The feature that "proves" the product's promise — a feed unique per user |

**Not implemented, present only as scaffolding/aspiration:**
- `TasteProfile` model + `taste_profiles` migration exist (see §17) but **no service, controller, or route reads/writes it**. It is a designed-but-unbuilt persisted taste representation (`genre_weights` JSON + `last_calculated`). Stage/personalization today is computed **live**, per-request, directly from `favorites`/`watched_titles` rows — `TasteProfile` is dead schema, not a bug, but worth knowing before assuming it's used anywhere.
- "Why this recommendation?" natural-language explanations (§2) — narrated as a product ambition, never implemented as an API field.
- "Taste Reset" button (episode 3's proposed feature) — never implemented.

---

## 4. Complete Business Rules

Collected from the story document (`Story_of_project.txt`), the ML contracts (`docs/ml_contracts_document/*.md`), and verified against the actual service/controller code. Rules are grouped by feature; **[CODE]** = enforced today in the shipped implementation, **[NARRATIVE]** = stated as product philosophy in the story doc but not (yet) enforced by code — treat these as intentions, not guarantees, when testing.

### Authentication
- Registration requires only `email` + `password` (+ `password_confirmation`), min 8 characters. **[CODE]** (`RegisterRequest`)
- Email must be unique across `users`. **[CODE]**
- Login/register are rate-limited independently of every other route family (5/min, 10/min respectively) because credential endpoints are the highest-abuse-risk surface. **[CODE]** (`AppServiceProvider::configureRateLimiting()`)
- A JWT is issued on register and login; `stage` is embedded in the response payload (not the token itself) on every auth action. **[CODE]**
- `auth:api` guards every protected route; an expired/invalid/missing token on a protected route → `401 Unauthenticated`. On *public-but-personalizable* routes (Search/Title/Recommendations/Home), an invalid token degrades to guest silently rather than erroring — see `ResolvesOptionalAuthUser`. **[CODE]**

### Favorites
- Favorite = **"I liked this."** The strongest taste signal in the system — stronger than Watched, immeasurably stronger than merely viewing a title page or a recommendation. **[NARRATIVE, reflected in ranking weight choices — Favorites are always the seed for "personalized"/"handpicked" sections; Watched only seeds the weaker "Because You Watched" section]**
- Adding a Favorite is a **write-time snapshot**: `title_type`, `genres`, `release_year` are copied from the ML response at the moment of the request and never refreshed. If the ML dataset's metadata for that title later changes, the user's stored Favorite does not follow. **[CODE]**
- A title must exist in the ML dataset to be favorited — the Backend has no independent catalog and cannot validate a title if ML is down (write hard-fails, no fallback). **[CODE]**
- Duplicate favoriting of the same canonical title (by ML-resolved title string, not raw user input) is rejected with `422`. **[CODE]**
- A user can remove a Favorite at any time by title name; this is **not** a soft-delete — it's a real `DELETE`, and (per the story's episode 3/6) removing bad signals should let the system "re-learn" the user, which in this implementation happens automatically and instantly since stage/personalization are computed live, not cached per-user. **[CODE, incidentally satisfies the narrative rule]**
- Favorite and Watched are **independent, both-can-be-true** signals — marking watched does not imply liking, and vice versa. **[CODE — separate tables, separate uniqueness constraints, separate endpoints]**

### Watched History
- Watched = **"I consumed this,"** with no implication of enjoyment. **[NARRATIVE]**
- Same snapshot-at-write, same ML-existence requirement, same duplicate rejection, same independent removability as Favorites. **[CODE]**
- The story narrative (episode 3) treats History deletion as important specifically for *correcting* accidental signals (e.g., a sibling using the account) and expects the system to "re-learn" afterward — satisfied structurally because stage/Home have no persisted-and-stale profile to invalidate. **[CODE, structurally satisfies narrative intent]**

### Recommendation / Home / Cold Start
- **Stage is derived, never stored**, from `signalCount = favorites.count() + watched.count()`, computed fresh on every `GET /home` and every auth response (`me`/`login`/`register`/`refresh`). **[CODE]** (`HomeService::resolveStage()`, `AuthService::resolveStage()` — note: **two independent implementations of the same thresholds exist**, see §21).
- Stage thresholds: `stranger` (0), `explorer` (1–4), `regular` (5–19), `loyal` (20+). **[CODE]**
- A guest (no token) is always treated as `stranger`, regardless of any cookie/session state — there is no anonymous-session signal tracking. **[CODE]**
- Cold start (`stranger`/guest): exactly one section, "Popular on Netflix," built from a hardcoded 11-title list resolved via ML title-detail lookups — **never** from a live "trending" ML signal, because the ML service exposes no such endpoint. **[CODE]** (`HomeService::POPULAR_SEED_TITLES`)
- Favorites always outrank Watched Titles as a recommendation seed source; an `explorer`-stage user with zero Favorites (only Watched signals) gets **no personalized section at all** that stage — only Popular. **[CODE]** (`home.md` §2.2)
- Recommendations are never repeated across a section and a user's own history: every recommendation-driven section and the Popular section filter out anything already in the user's Favorites or Watched (case-insensitive title match). **[CODE]** (`HomeService::filterSeenTitles()`)
- Recency matters: a Loyal user's 5 most-recent Favorites are linearly weighted from 1.0 (newest) down to 0.5 (5th-newest) when merging/ranking recommendation candidates. **[CODE]** (`HomeService::recencyWeights()`)
- A title recommended by *more than one* seed always outranks a title recommended by only one seed, regardless of raw similarity score (appearance-count-first ranking). **[CODE]** (`mergeAndRankResults()`)
- Every section caps at 10 items, applied *after* seen-title filtering (so a section can legitimately return fewer than 10, never more). **[CODE]** (`SECTION_ITEM_LIMIT`)
- A recommendation-driven section that ends up empty (ML had nothing, or everything was already seen) is **omitted from the response entirely** — the client cannot distinguish "ML failed" from "nothing new to show" from "you've already seen everything." **[CODE]**
- The "Popular" section never appears for Loyal-stage users — the assumption is a Loyal user's Favorites/Watched history always yields enough personalized seeds that a generic fallback section adds no value. **[CODE]**
- A single user's taste is modeled as **multiple simultaneous preferences**, not one label — the story explicitly rejects `user.genre = Crime` in favor of a weighted map (episode 10). **[NARRATIVE — the shipped system does not build or expose an explicit weighted genre map (see `TasteProfile`, unused); it approximates multi-preference behavior implicitly by seeding recommendations from up-to-5 distinct recent Favorites and merging their results, which produces a similar effect without a persisted "profile" object.]**

### Search & Discovery
- Autocomplete requires `q` of at least 2 characters; `limit` optional, 1–20, default 12. **[CODE]** (`SearchRequest`)
- Search results are returned in whatever order ML provides — the Backend performs no re-ranking, filtering, or deduplication on this endpoint. **[CODE]**
- Opening a title's detail page, or viewing its recommendations, **carries zero weight** in taste modeling — only explicit Favorite/Watched actions do. **[NARRATIVE, confirmed by code: `TitleController::show()`/`recommendations()` never write anything to the database]**
- `n` (recommendation count) on `GET /recommendations/{title}` is client-controlled and **not validated** by the Backend (can be `0`, negative, non-numeric-casts-to-0) — the ML service is expected to defend its own bounds (1–50 per its contract). **[CODE — a known, accepted gap, not a bug to "fix" without checking with the team first]**

### Data Ownership & Authorization
- Every Favorites/Watched query is scoped through the authenticated user's own relationship (`$user->favorites()->where(...)`), never a global lookup + manual ownership check — this makes cross-user access structurally impossible rather than reliant on a forgotten `if`. **[CODE]**
- There is no admin role, no policy-based authorization layer in this codebase (unlike the reference `ENGINEERING_PLAYBOOK.md`'s Brewtica project, which scaffolds Policies) — authorization here is entirely `auth:api` + scoped queries. **[CODE — simpler than the playbook's general pattern because Cinematch has only one user role]**

### Cold Start / New vs. Returning User
- A brand-new registered user with zero signals is functionally identical, from Home's perspective, to a guest — both get exactly the Popular section. The *only* difference is that a registered stranger's `/auth/me` response includes their `stage` and identity; the Home feed itself doesn't know or care whether a `stranger`-stage request came from a guest or a freshly-registered account. **[CODE]**

---

## 5. Authentication Flow

### 5.1 Lifecycle

```
Guest (no token)
   │
   ├─► POST /auth/register {email, password, password_confirmation}
   │        └─► 201 { user, token, token_type: bearer, expires_in }
   │
   ├─► POST /auth/login {email, password}
   │        └─► 200 { user, token, ... } | 401 Invalid credentials
   │
   ▼
Holds JWT (Authorization: Bearer <token>)
   │
   ├─► GET  /auth/me        (auth:api)  → { user: { id, email, stage } }
   ├─► POST /auth/refresh   (auth:api)  → new token, same payload shape
   ├─► POST /auth/logout    (auth:api)  → invalidates current token
   │
   └─► Uses token as Bearer header on:
        favorites (all), history (all),
        and optionally on search/titles/recommendations/home for personalization
```

### 5.2 Token details
- Library: `php-open-source-saver/jwt-auth` (community fork of `tymon/jwt-auth`), guard name `api`, configured in `config/auth.php`/`config/jwt.php`.
- `JWT_TTL` env var controls expiry in minutes (`.env.example` default `60`); `expires_in` in the auth response is `ttl * 60` (seconds).
- `User` implements `JWTSubject` with no custom claims (`getJWTCustomClaims()` returns `[]`) — the token carries only the standard subject/expiry claims, nothing about stage or signals (stage is *always* recomputed server-side, never trusted from a stale token claim).
- Refresh issues a brand-new token via `$guard->refresh()` — this invalidates the old token's ability to be refreshed again (standard JWT rotation), consistent with `php-open-source-saver/jwt-auth` defaults.
- Logout calls `$guard->logout()`, blacklisting the current token (subject to the package's blacklist configuration).

### 5.3 Two authorization postures in this codebase
| Trait | Used by | Behavior on missing/invalid token |
|---|---|---|
| `ResolvesAuthUser` | Favorites, Watched, (implicitly `auth:api` middleware) | Route never reached — middleware returns `401` first |
| `ResolvesOptionalAuthUser` | Home, TitleController (`show`, `recommendations`) | Silently resolves to `null` (guest), **even for an expired/malformed token** — `JWTException` is caught and swallowed. The route is public; a bad token never breaks it. |

**Testing implication:** sending a garbage `Authorization` header to `/home` or `/titles/{x}` must never itself 401 — the request should behave exactly like no header was sent.

---

## 6. User Journey — Stage by Stage

| Stage | Signal Count | What Home Shows | Narrative Analogy (`Story_of_project.txt`) |
|---|---|---|---|
| **stranger** (incl. all guests) | 0 | 1 section: "Popular on Netflix" (fixed 11-title pool via ML, seen-filtered, capped at 10) | "The Stranger" — Ep. 7 |
| **explorer** | 1–4 | Up to 2 sections: "Based on Your Favorites" (seeded by single most-recent Favorite, only if ≥1 Favorite exists) + "Popular on Netflix" (always) | "The Explorer" — Ep. 7 |
| **regular** | 5–19 | Up to 3 sections: "Handpicked For You" (top 3 recent Favorites), "Because You Watched {title}" (most recent Watched), "Popular on Netflix" (always) | "The Regular" — Ep. 7 |
| **loyal** | 20+ | Up to 3 sections, **no Popular**: "Handpicked For You" (top 5 recent Favorites, recency-weighted), "Because You Loved {title}" (all-time *oldest* Favorite), "New For You" (6th–10th most recent Favorites, or fallback to first 3 Popular-pool titles if <6 Favorites exist) | "The Loyal User" — Ep. 7 |

Each section can independently vanish if its seed source is empty or ML returns nothing usable (§4). A user can therefore see anywhere from 0 to 3 sections in practice, though `stranger`/guest always gets exactly 1 (Popular, possibly with empty `items`).

---

## 7. Feature Dependency Tree

```
Auth (JWT identity)
  │
  ├── required by ──► Favorites (write + read)
  ├── required by ──► Watched Titles (write + read)
  └── optional for ──► Search & Discovery, Home (adds personalization when present)

Search & Discovery (ML: /api/search, /api/titles/{t}, /api/recommend/{t})
  │
  └── the primary write source for ──► Favorites, Watched Titles
        (a user finds a title via Search or a Recommendation, then Favorites/marks it Watched)

Favorites ─┐
           ├──► feed the Stage calculation (AuthService, HomeService)
Watched ───┘         │
                     ▼
                  Home (ML: /api/recommend/{t} batched, /api/titles/{t} batched)
                     │
                     └── reads Favorites + Watched directly (not via Search/Title endpoints)
                          to build seeds, and to filter out already-seen titles
```

Read as a request flow for a single new user:
```
Search "Breaking Bad" → Title Detail (confirm) → Recommendations (browse similar)
        │                                              │
        ▼                                              ▼
  POST /favorites  ◄── user decides they like one ──┘
        │
        ▼
  Stage recalculated (now explorer, if this is signal #1-4)
        │
        ▼
  Next GET /home → "Based on Your Favorites" section appears, seeded by this Favorite
```

---

## 8. API Architecture

All 12 routes live in `routes/api.php`. Every response — success or failure — goes through `App\Helpers\ApiResponse` (§15) for a single envelope shape: `{"status": "success"|"error", "message"?, "data"?, "errors"?}` plus any `extra` merged fields (e.g. `meta.total` on `GET /favorites`).

| Method | Path | Auth | Rate Limit | Controller | Purpose |
|---|---|---|---|---|---|
| `POST` | `/auth/register` | Public | `throttle:register` (10/min/IP) | `AuthController::register` | Create account, auto-login (returns token) |
| `POST` | `/auth/login` | Public | `throttle:login` (5/min/IP) | `AuthController::login` | Authenticate, issue token |
| `POST` | `/auth/logout` | Protected | `throttle:protected` (100/min/user) | `AuthController::logout` | Invalidate current token |
| `POST` | `/auth/refresh` | Protected | `throttle:protected` | `AuthController::refresh` | Rotate token |
| `GET` | `/auth/me` | Protected | `throttle:protected` | `AuthController::me` | Current identity + stage |
| `GET` | `/favorites` | Protected | `throttle:protected` | `FavoriteController::index` | List own favorites, newest-first |
| `POST` | `/favorites` | Protected | `throttle:protected` | `FavoriteController::store` | Add a favorite (validates via ML) |
| `DELETE` | `/favorites/{title_name}` | Protected | `throttle:protected` | `FavoriteController::destroy` | Remove by exact title name |
| `GET` | `/history` | Protected | `throttle:protected` | `WatchedTitleController::index` | List own watch history, newest-first |
| `POST` | `/history` | Protected | `throttle:protected` | `WatchedTitleController::store` | Mark as watched (validates via ML) |
| `DELETE` | `/history/{title_name}` | Protected | `throttle:protected` | `WatchedTitleController::destroy` | Remove by exact title name |
| `GET` | `/search` | Public | `throttle:public` (60/min/IP) | `SearchController` | Autocomplete titles |
| `GET` | `/titles/{title}` | Public (opt. auth) | `throttle:public` | `TitleController::show` | Full metadata + optional `user_signals` |
| `GET` | `/recommendations/{title}` | Public (opt. auth) | `throttle:public` | `TitleController::recommendations` | Similar titles + optional per-item `user_signals` |
| `GET` | `/home` | Public (opt. auth) | `throttle:public` | `HomeController` | Personalized landing feed |

**Frontend usage pattern (inferred from route shape + `frontend/src/pages` names — `HomePage`, `SearchResultsPage`, `TitleDetailPage`, `RecommendPage`, `FavoritesPage`, `HistoryPage`, `MyListPage`):**
1. Landing/`HomePage` calls `GET /home` on load (token attached if logged in).
2. `SearchBar`/`DiscoverSearch` component debounces keystrokes into `GET /search?q=...`.
3. Selecting a result routes to `TitleDetailPage`, which calls `GET /titles/{title}` (shows `user_signals` if logged in) and likely `GET /recommendations/{title}` for a "Similar Titles" row.
4. The title detail page's Favorite/Watched buttons call `POST /favorites` / `POST /history`.
5. `FavoritesPage`/`HistoryPage`/`MyListPage` call the respective `GET` list endpoints; removing an item calls the `DELETE` endpoint by title name.

---

## 9. Recommendation Engine — Deep Dive

This is the heart of the system. Full request/response contracts live in `backend/docs/ml_contracts_document/{home,search-discovery,favorites,watched-titles}.md` — read those in full before touching `HomeService` or `MLClientService`. Below is the synthesized model.

### 9.1 Division of responsibility
**The Backend has no independent notion of title similarity or popularity.** All content-based intelligence lives in the external ML microservice (`ml/recommender_service.py`, FastAPI-wrapped, 3 endpoints: `/api/search`, `/api/titles/{title}`, `/api/recommend/{title}`). The Backend's job is orchestration: decide *which* titles to ask ML about (seed selection, per user stage), *merge and rank* multiple ML responses when more than one seed is used, *filter* out what the user has already seen, and *degrade gracefully* when ML is slow or down.

### 9.2 Seed selection by stage (see §6 table + `home.md` §2 for exact rules)
- **stranger/guest** → no seeds; Popular pool only.
- **explorer** → 1 seed (most recent Favorite), if any exist.
- **regular** → up to 2 independent seed groups: top-3 recent Favorites (1 call), most-recent Watched (1 separate call).
- **loyal** → up to 3 independent seed groups: top-5 recent Favorites (recency-weighted), oldest Favorite ever, and 6th–10th recent Favorites (or 3 Popular-pool titles as fallback).

### 9.3 Merge & rank algorithm (`HomeService::mergeAndRankResults()`)
When a section is seeded by multiple titles, every ML result across all seeds is bucketed by lowercased title. A title appearing from 2 different seeds beats a title appearing from only 1, **regardless of raw similarity** — appearance count is the primary sort key, (weighted) average similarity is the tiebreaker. This means popularity-across-the-user's-own-taste is favored over any single seed's opinion.

### 9.4 Recency weighting (Loyal stage only)
The 5 Favorite seeds behind "Handpicked For You" are not equal: newest = weight 1.0, decreasing linearly to 0.5 for the 5th-oldest. This directly implements the story's episode-4/5 product decision: *"give more weight to recent activity while keeping some influence from older interests."* Every other stage/section uses uniform weight 1.0.

### 9.5 Filtering (`filterSeenTitles`)
After merge/rank, every candidate is checked against the union of the user's Favorites + Watched (fetched once per `GET /home` call, reused across every section — not refetched per-section). Anything already known to the user is dropped before capping at 10.

### 9.6 Capping and section presence
Every section caps at 10 items post-filter. A recommendation-driven section with zero surviving items is **omitted entirely** from the response (not returned as an empty-items object) — the client has no way to distinguish "ML gave nothing," "everything was already seen," or "the ML call failed." The Popular section is the one exception: it is always present (except for Loyal) even with `items: []`.

### 9.7 Fallbacks and failure modes
| Failure | Home's behavior | Write endpoints' (Favorites/Watched) behavior |
|---|---|---|
| ML fully unreachable | `200 OK`, affected sections omitted or empty — **never a 5xx** | `503 Service not available right now` |
| ML times out | Same silent degrade | `504 Service took too long` |
| ML returns 404 for one title in a batch | That title dropped silently from its section | N/A (single-item path; 404 → `not_found` business outcome, `404` to client) |
| ML returns malformed/non-2xx for one pooled title | That title dropped silently | N/A |

This asymmetry is intentional: Home is read-only and must always render *something*; Favorites/Watched are writes that must never silently create bad data, so they fail loudly instead.

### 9.8 Caching (Home only)
Every individual ML lookup used by Home is cached 24h, keyed by `ml:title:{title}` or `ml:recommendations:n=10:{title}` (case-sensitive, unnormalized keys — `"Breaking Bad"` and `"breaking bad"` are different cache entries). Only successful, valid-JSON `2xx` responses are cached; a failed lookup is retried on every subsequent request indefinitely. Search & Discovery and Favorites/Watched-write paths have **no caching at all** — every request is a live ML call.

### 9.9 What ML fields the Backend actually uses vs. discards
| ML field | Search & Discovery (`/recommendations`) | Home (batched) | Favorites/Watched (write) |
|---|---|---|---|
| `title` | kept | kept (merge key + display) | kept (canonical storage key) |
| `type` | kept | kept, **not enum-validated** | kept, **enum-validated, throws on bad value** |
| `genres` | discarded | discarded | kept, stored raw (unsplit) |
| `rating`, `country`, `director` | discarded | discarded | discarded |
| `release_year` | kept | kept | kept |
| `similarity` | kept, renamed `similarity_score`, **no rounding** | kept, recency-weighted, averaged, **rounded to 4 dp** | N/A |
| `rank` | discarded | discarded | N/A |

---

## 10. Search System

- **Autocomplete** (`GET /search?q=&limit=`): thin passthrough to ML's `/api/search`. No ranking, filtering, deduplication, or caching by the Backend — ML's ordering is final. Validation: `q` ≥ 2 chars (else `422` before ML is ever called), `limit` 1–20 (default 12).
- **Title Detail** (`GET /titles/{title}`): the only Search-family endpoint that transforms data — `genres` (comma-string from ML) is split into a trimmed array for the client. If a Bearer token is present, appends `user_signals: {is_favorite, is_watched}` (two `EXISTS`-style queries against the user's own tables, exact case-sensitive title match).
- **Recommendations** (`GET /recommendations/{title}?n=`): field-pruned passthrough (`genres`/`rating`/`country`/`director`/`rank` read but discarded); `similarity` → `similarity_score` verbatim, no rounding, no clamping. `n` is **not validated** by the Backend (§4). No seen-title filtering here — unlike Home, this endpoint returns titles the user may have already favorited/watched.
- **Matching strategy**: entirely delegated to ML — "fuzzy/partial title matching" is explicitly the ML layer's job per `search-discovery.md` §1; the Backend has no fallback matcher.
- **Caching**: none on any of the three Search & Discovery endpoints (contrast with Home).

---

## 11. Home Page Logic

See §6 (stage table) and §9 (algorithm) for the full mechanics. Summary of the exact request lifecycle:

```
GET /home (Bearer optional)
  │
  ├─ no user or user has 0 signals → stage = "stranger"
  │     → 1 section: Popular (ML title-detail batch, seen-filtered against nothing for guests)
  │
  └─ user has ≥1 signal → stage = explorer|regular|loyal (by count)
        → load ALL favorites (desc by added_at) + ALL watched (desc by watched_at) — 2 queries, once
        → build 1-3 sections per §6, each independently calling ML (batched, parallel, cached)
        → merge/rank/filter/cap each section
        → assemble { stage, sections: [...] }
```

Nothing here is precomputed or queued — every request is fully live. There is no per-user cache of the Home *response*; only individual ML title/recommendation lookups are cached (§9.8), so two different users requesting overlapping seed titles in the same 24h window benefit from shared cache entries, but the section-building logic itself always runs fresh.

---

## 12. Data Flow Diagrams

### 12.1 Add to Favorites (write path)
```
Frontend (TitleDetailPage "Add to Favorites" button)
   │  POST /favorites { title_name }  [Bearer token]
   ▼
FavoriteController::store()
   │  validates via StoreFavoriteRequest (title_name required, string)
   ▼
FavoriteService::addFavorite(user, title_name)
   │  1. MLClientService::getTitleDetail(title_name)  ──► ML GET /api/titles/{title}
   │       ├─ 404 → { success: false, reason: not_found }
   │       ├─ unreachable/timeout/5xx → throws Ml*Exception (uncaught here)
   │       └─ 200 → canonical detail array
   │  2. duplicate check: user->favorites()->where('title_name', detail.title)->exists()
   │  3. TitleType::fromLabel(detail.type)  — throws ValueError if not "Movie"/"TV Show"
   │  4. INSERT favorites row (snapshot)
   ▼
FavoriteController maps result → ApiResponse::created() | ::error()
   ▼
ApiExceptionRenderer catches any uncaught Ml*Exception centrally → 503/504
   ▼
Response to Frontend
```

### 12.2 Home feed (read path, regular-stage example)
```
Frontend (HomePage load)
   │  GET /home  [Bearer optional]
   ▼
HomeController::__invoke() → optionalUser() (null on bad/missing token, never errors)
   ▼
HomeService::getHome(user)
   │  load favorites + watched (2 queries)
   │  resolve stage = "regular"
   │  buildRegularSections():
   │     ├─ getPersonalizedSection(top-3 favorites)  ──► MLClientService::getManyRecommendations()
   │     │        ──► MLClientService::poolCached() ──► Cache::has()? / Http::pool() to ML (parallel)
   │     ├─ getBecauseYouWatchedSection(most recent watched)  ──► same pooled/cached path
   │     └─ getPopularSection()  ──► MLClientService::getManyTitleDetails() (pooled/cached)
   │  each section: mergeAndRank → filterSeenTitles → cap at 10
   ▼
ApiResponse::success({ stage, sections })
   ▼
Response to Frontend — ALWAYS 200 regardless of ML health
```

---

## 13. External Integrations

| Integration | Purpose | Config | Auth to it | Failure handling |
|---|---|---|---|---|
| **ML microservice** (`ml/recommender_service.py`, FastAPI) | Sole source of title data, search, similarity | `ML_BASE_URL` (default `http://localhost:8000`), `ML_TIMEOUT` (default `10`s) — `config/services.php` | None — trusted internal dependency, no token/key sent or expected | See §9.7; `MlConnectionException`/`MlTimeoutException` centrally rendered by `ApiExceptionRenderer` |
| **JWT (`php-open-source-saver/jwt-auth`)** | Stateless auth | `config/jwt.php`, `JWT_SECRET`, `JWT_TTL` | N/A (this *is* the auth mechanism) | Invalid/expired token → `401` (protected routes) or silent guest (optional-auth routes) |
| **MySQL** | Persistence for users/favorites/watched_titles/taste_profiles | `config/database.php`, `DB_*` env vars | Standard DB credentials | Not specially handled — a DB outage surfaces as an uncaught exception → generic `500` |
| **Cache store** | 24h ML response cache (Home only) | `config/cache.php`, `CACHE_STORE` (default `database` per `.env.example`; tests use `array`, per `RateLimitTest.php` comment) | N/A | Cache miss → live ML call, not an error |
| **CORS** | Browser access control | `config/cors.php`, `CORS_ALLOWED_ORIGINS` (default `http://localhost:5173`, the Vite dev server) | N/A — `supports_credentials: false` since auth is Bearer-token-based, not cookie-based | N/A |

---

## 14. Error Handling

Centralized in `App\Exceptions\ApiExceptionRenderer` (registered via `bootstrap/app.php`'s `withExceptions()`), which only intercepts requests matching `api/*` — everything else falls through to Laravel's default (HTML) error handling.

**Priority order (first match wins):**
1. `ModelNotFoundException` → `404 Resource not found`
2. `NotFoundHttpException` (unmatched route) → `404 Endpoint not found`
3. `AuthenticationException` → `401 Unauthenticated`
4. `AuthorizationException` → `403 This action is unauthorized`
5. `ValidationException` → `422 The given data was invalid.` + `errors` object (per-field messages)
6. `ThrottleRequestsException` → `429 Too many requests. Please try again later.` + `Retry-After` header
7. `MlConnectionException` → `503 Service not available right now`
8. `MlTimeoutException` → `504 Service took too long`
9. Catch-all `Throwable` → `500`, message = real exception message in non-production, `"Something went wrong"` in production (gated by `app()->environment('production')`, not a togglable config flag)

**Business-outcome errors that are *not* exceptions** (returned as plain `ApiResponse::error()` calls from within controllers, not via the renderer): `404 Title not found` (ML said the title doesn't exist), `422 Title already in your Favorites/Watch History` (duplicate), `401 Invalid credentials` (bad login).

**Home-specific rule (see §9.7):** ML failures never reach this renderer as visible errors for `GET /home` — they're caught one layer down inside `HomeService`/`MLClientService` and degrade to missing/empty sections instead.

---

## 15. Security

- **JWT** stateless auth, no session cookies (`supports_credentials: false` in CORS config) — nothing to leak cross-origin.
- **Rate limiting**, 4 named limiters (`AppServiceProvider::configureRateLimiting()`):
  - `login`: 5/min by IP
  - `register`: 10/min by IP
  - `public`: 60/min by IP (search, titles, recommendations, home)
  - `protected`: 100/min by authenticated user ID (falls back to IP if somehow unauthenticated, though the middleware stack should prevent that case)
- **Authorization = scoped queries only.** No Policy classes anywhere in this codebase — `$user->favorites()->where(...)` makes cross-user access structurally impossible rather than relying on a manually-written ownership check. This is a deliberate simplification vs. the reference `ENGINEERING_PLAYBOOK.md` pattern (Cinematch has one user role, no admin/staff split).
- **Input validation**: every mutating endpoint has a `FormRequest` with explicit `rules()` and (mostly) explicit `messages()`. No inline `$request->validate()` calls anywhere.
- **Sensitive operations**: no password reset flow, no email verification flow, no 2FA — the only "sensitive operation" surface is register/login/refresh/logout, all covered above. Password is hashed (`'password' => 'hashed'` cast on `User`), never returned (`#[Hidden(['password'])]` attribute).
- **No secrets sent to the ML service** — it's treated as a trusted internal dependency with no auth handshake, which is acceptable only if the ML service is not internet-exposed; this is an infrastructure assumption, not something the Backend code enforces.

---

## 16. Testing Strategy

Test suite: Pest v4 (functional `test()`/`it()` style — unlike the reference playbook's PHPUnit-class convention, this repo uses Pest's own idioms), located in `tests/Feature/Api/`.

| File | Covers |
|---|---|
| `AuthTest.php` | Register/login/logout/refresh/me happy paths + validation edges |
| `FavoriteTest.php` | Add/list/remove, duplicate rejection, ML-not-found, cross-user isolation (inferred from naming convention consistent with other suites) |
| `WatchedTitlesTest.php` | Same shape as Favorites |
| `SearchTest.php` | Autocomplete validation + ML passthrough |
| `TitleTest.php` | Title detail + recommendations, user-signal enrichment |
| `HomeTest.php` | Stage resolution, section composition per stage, ML mocking via helper functions (`homeTitleDetail()`, `homeMlItem()`, `homeMlRecommendation()`, `makeFavorite()`, `makeWatched()` — file-local, not a shared trait) |
| `ExceptionHandlerTest.php` | Verifies the exact envelope for 404/401/422/etc. — `assertExactJson` used for the most critical shape checks |
| `RateLimitTest.php` | Verifies each of the 4 named limiters trips at its documented threshold; `Cache::flush()` in `beforeEach` since rate-limiter state lives in the cache store and tests share a process |
| `CorsTest.php` | CORS header presence |

**ML mocking pattern**: `$this->mock(MLClientService::class, function ($mock) { $mock->shouldReceive('getManyTitleDetails')->andReturn([]); })` — tests never hit a real ML service; `MLClientService` is mocked at the service-container level.

**Notable testing details:**
- `phpunit.xml` sets `CACHE_STORE=array` for the test environment (per `RateLimitTest.php`'s own code comment) — cache-dependent tests (rate limiting, Home's ML caching) are process-local, not shared across parallel test runs.
- `TestCase.php` applies `RefreshDatabase` (standard Laravel/Pest convention).
- No dedicated `tests/Unit` coverage beyond the Laravel-generated `ExampleTest.php` stub — all real coverage is Feature-level, hitting real routes.

---

## 17. Important Models

| Model | Table | Key Columns | Relationships | Role |
|---|---|---|---|---|
| `User` | `users` | `email` (unique), `password` (hashed) | `hasMany(Favorite)`, `hasMany(WatchedTitle)`, `hasOne(TasteProfile)` | Identity; implements `JWTSubject` with no custom claims |
| `Favorite` | `favorites` | `user_id`, `title_name`, `title_type` (enum), `genres` (raw string), `release_year`, `added_at` | `belongsTo(User)` | Snapshot-at-write record of a liked title; unique on `[user_id, title_name]`; `#[WithoutTimestamps]` — uses `added_at` instead of Laravel's default `created_at`/`updated_at` |
| `WatchedTitle` | `watched_titles` | Same shape as `Favorite` but `watched_at` instead of `added_at` | `belongsTo(User)` | Snapshot-at-write record of a consumed title; unique on `[user_id, title_name]` |
| `TasteProfile` | `taste_profiles` | `user_id` (unique), `genre_weights` (JSON), `last_calculated` | `belongsTo(User)` | **Scaffolded, unused.** No service/controller reads or writes this table anywhere in the codebase (verified — no references outside the model file and its migration/factory). Represents a designed-but-not-built persisted taste representation; see §21. |

`TitleType` enum (`App\Enums\TitleType`, backed string: `movie`/`tv_show`) is the only finite vocabulary in the system. `fromLabel()` maps ML's human-readable `"Movie"`/`"TV Show"` strings to it and **throws `ValueError`** on anything else — this is the single most fragile point of contact between the Backend and ML data quality (§9.9, §21).

---

## 18. Important Services

| Service | Responsibilities | Called By | Depends On |
|---|---|---|---|
| `AuthService` | register/login/logout/refresh/me business logic; stage resolution | `AuthController` | `User` model, JWT guard |
| `MLClientService` | The **only** class that talks HTTP to the ML microservice. Single-item methods (`search`, `getTitleDetail`, `getRecommendations` — throw `Ml*Exception` on network failure) and batched/cached methods (`getManyTitleDetails`, `getManyRecommendations` — degrade to `null` per-title, never throw) | `SearchController`, `TitleController`, `FavoriteService`, `WatchedTitleService`, `HomeService` | `Http` facade, `Cache` facade, `config('services.ml.*')` |
| `FavoriteService` | Add/list/remove favorites; ML-backed canonicalization + duplicate detection | `FavoriteController` | `MLClientService`, `TitleType` enum |
| `WatchedTitleService` | Structurally identical to `FavoriteService` for watch history | `WatchedTitleController` | `MLClientService`, `TitleType` enum |
| `UserSignalService` | Resolves `is_favorite`/`is_watched` for one title or many, for the authenticated user | `TitleController` | `User`'s `favorites()`/`watchedTitles()` relations |
| `HomeService` | The most complex service in the system — stage resolution, section building per stage, ML seed selection, merge/rank/filter/cap pipeline, fail-safe ML wrappers | `HomeController` | `MLClientService`, `Favorite`/`WatchedTitle` models |

---

## 19. Folder Architecture

```
backend/
├── app/
│   ├── Enums/            — TitleType (the system's only finite vocabulary)
│   ├── Exceptions/        — ApiExceptionRenderer (central handler), Ml*Exception (ML-specific)
│   ├── Helpers/           — ApiResponse (the one response envelope)
│   ├── Http/
│   │   ├── Controllers/Api/       — thin, one per feature, some grouped (Auth/)
│   │   ├── Controllers/Concerns/  — ResolvesAuthUser / ResolvesOptionalAuthUser traits
│   │   ├── Requests/               — FormRequests, one per mutating input shape
│   │   └── Resources/              — JsonResource classes, incl. Search/ subnamespace
│   ├── Models/            — User, Favorite, WatchedTitle, TasteProfile (unused)
│   ├── Providers/         — AppServiceProvider (rate limiter definitions)
│   └── Services/          — all business logic; the only layer that talks to ML or does non-trivial computation
├── config/                — jwt.php, cors.php, services.php (ML base URL/timeout) are the feature-relevant ones
├── database/migrations/   — users, favorites, watched_titles, taste_profiles
├── docs/                  — the design record: ERDs, feature diagrams, ML contracts, security hardening docs, the product narrative (Story_of_project.txt)
├── routes/api.php         — all 15 endpoints, grouped by access level with banner comments
└── tests/Feature/Api/     — one file per feature + cross-cutting (Exceptions, RateLimit, CORS)

ml/
├── recommender_service.py — the actual ML logic
├── API_CONTRACT.md        — LEGACY/aspirational spec, not what's actually implemented (see header note)
├── train.py, netflix1.csv — model training artifacts

frontend/src/
├── api/                   — HTTP client layer to the Laravel backend
├── pages/                 — one per route (HomePage, SearchResultsPage, TitleDetailPage, FavoritesPage, HistoryPage, MyListPage, Auth*, ...)
├── components/            — shared UI (SearchBar, TitleCard, forms, animated backgrounds/particles — a heavily styled marketing-grade UI)
├── context/                — AuthContext, ProtectedRoute, ToastContext
└── hooks/, utils/, data/   — supporting code (not read in depth for this document — inferred structure only)
```

`app/Services` is the deliberate center of gravity: controllers are intentionally thin (§20), so understanding the system means reading this folder first.

---

## 20. Engineering Notes

- **Thin controllers, fat services** — every controller method is: resolve user → call exactly one service method → map result to `ApiResponse`. No business `if` lives in a controller.
- **Snapshot-at-write over live-refetch** — Favorites/Watched deliberately do not re-query ML for metadata on read; this trades staleness (a title's genre list changing in the ML dataset won't retroactively update a user's stored Favorite) for read-path simplicity and zero ML load on `GET /favorites`/`GET /history`.
- **Derived, not persisted, personalization state** — `stage` and all Home rankings are computed fresh on every request. This is a deliberate simplicity/correctness tradeoff: no cache-invalidation bugs are possible for "did stage update after this action," at the cost of doing real work (including ML calls) on every `GET /home`. The `TasteProfile` table exists as unused schema for a *future* persisted alternative (§21) — its presence without a consumer is worth flagging in any schema review, not a signal to build against it without confirming with the team.
- **Two authorization postures via traits, not one general-purpose resolver** — `ResolvesAuthUser` (hard-401) vs. `ResolvesOptionalAuthUser` (silent-guest-on-failure) are separate, intentionally, because a protected route and an optionally-personalized public route have genuinely different failure semantics.
- **Batched ML calls use `Http::pool()` + a hand-rolled cache-aside pattern (`poolCached()`)** rather than a queue/job system — appropriate given the synchronous, user-facing nature of `GET /home`, but means Home's latency is bounded by the slowest concurrent ML call in its largest pool (up to 5 titles) every time there's a cache miss.
- **Two independent stage-threshold implementations** (`AuthService::resolveStage()` and `HomeService::resolveStage()`) — functionally identical today (`stranger`/`explorer<5`/`regular<20`/`loyal`), but a future edit to one without the other would silently desync what `/auth/me` reports vs. what `/home` actually builds. Worth consolidating into one shared source if either is ever touched (see §21).
- **No queues/jobs, no scheduled commands relevant to personalization** — everything in this system is request-synchronous; there is no batch recomputation job for taste or trending titles.

---

## 21. Things That Are Easy To Miss

- **`TasteProfile` is fully scaffolded (migration + model + factory presumably) but has zero consumers.** Do not assume `genre_weights` reflects anything real — nothing populates it. If a future feature is asked to "read the user's taste profile," the honest answer today is "recompute it live from Favorites/Watched," not "read `taste_profiles`."
- **Stage thresholds are duplicated in two services** (`AuthService` and `HomeService`) with slightly different-looking but equivalent conditions (`$signalCount < 5` vs. `$signalCount <= 4`) — a boundary-condition edit in one place without the other is a realistic future bug source.
- **`n` on `GET /recommendations/{title}` is completely unvalidated by the Backend** — `?n=-5` or `?n=abc` (casts to `0`) are forwarded to ML as-is. This is documented as accepted behavior in `search-discovery.md`, not an oversight to silently "fix."
- **A malformed-but-`200` ML response is silently reinterpreted as "title not found"** on the single-item title-detail/recommendation paths (`$response->json()` returning `null` is treated identically to a real `404`). This means an ML-side bug that returns invalid JSON with a `200` status will present to end users as "Title not found," not as a server error — worth knowing when triaging a support report of "this obviously-real title says not found."
- **Home's batched path (`poolCached()`) treats *any* non-2xx as silent failure**, which is *stricter* than the single-item path (which only special-cases exactly `404`). A `422`/`400` from ML on a pooled request quietly drops that one title; the same status on a single-item Search/Favorites/Watched call gets *parsed as if it were valid data* (§9.9, §4) — these are two different failure philosophies in the same codebase, both intentional, both documented, easy to conflate when writing new ML-calling code.
- **Opening a title page or viewing recommendations never writes anything to the database** — only `POST /favorites` and `POST /history` are taste signals. Do not expect view-count-based personalization anywhere in this system.
- **The Popular section's 11 titles are hardcoded PHP constants**, not derived from any "trending" signal — if the ML dataset ever stops containing one of them, that title just silently disappears from Popular with no alerting.
- **Loyal-stage users never see a Popular section at all** — if you're testing Home and a Loyal-stage account unexpectedly shows fewer sections than a Regular-stage one, that's expected, not a bug.
- **`similarity_score` shown to the client for Loyal's "Handpicked For You" section is a recency-weighted average, not a raw ML value** — don't expect it to match what a direct `GET /recommendations/{title}` call for the same seed would show.
- **A guest and a signal-count-0 registered user are indistinguishable to `HomeService`** — both are `stranger` stage, both get the exact same Popular-only response shape.
- **CORS `supports_credentials` is deliberately `false`** — this system has no cookie/session-based auth path at all; don't design a feature assuming cookies will carry the session.
- **The `ml/API_CONTRACT.md` file describes a system that was never built** (UUID PKs, PostgreSQL, `/api/user/favorites` routes, a different auth response shape) — do not use it as a reference for how auth or favorites actually work today; use `docs/ml_contracts_document/` and the Laravel source instead.

---

## 22. Testing Notes for Postman Collection Building

General setup needed: two environment variables, `{{base_url}}` (e.g. `http://cinematch.test/api`) and `{{token}}` (populated from a login/register response, used as `Authorization: Bearer {{token}}` on protected calls). A second `{{token_other_user}}` is recommended for cross-user isolation testing.

### `POST /auth/register`
- **Happy path**: valid unique email, password ≥8 chars, matching `password_confirmation` → `201`, body has `data.user.stage === "stranger"`, `data.token`, `data.expires_in`.
- **Validation**: missing email/password → `422`; malformed email → `422`; password <8 chars → `422`; `password_confirmation` mismatch → `422`; duplicate email → `422` (`email.unique`).
- **Rate limit**: 11th register request within a minute from the same IP → `429` with `Retry-After` header.
- **Dependencies**: none (public, no data prerequisites).

### `POST /auth/login`
- **Happy path**: correct email/password of an existing user → `200`, same payload shape as register.
- **Failure**: wrong password or nonexistent email → `401 Invalid credentials` (note: **same message for both cases** — don't expect the API to reveal which field was wrong).
- **Rate limit**: 6th attempt within a minute (even failed ones count) → `429`.
- **Edge case**: missing email/password → `422` before the 401 path is ever reached.

### `POST /auth/logout`, `POST /auth/refresh`, `GET /auth/me`
- **Happy path** (all three): valid Bearer token → `200`.
- **Unauthorized**: missing/expired/malformed token → `401 Unauthenticated`.
- **`refresh` specific**: verify the returned token differs from the original, and that the *original* token is no longer usable afterward (standard JWT rotation) — worth an explicit Postman test since it's easy to assume the old token still works.
- **`logout` specific**: verify the just-logged-out token is rejected on a subsequent protected call.

### `GET/POST/DELETE /favorites`
- **Happy path GET**: token with ≥1 favorite → `200`, `data` array ordered newest-`added_at`-first, `meta.total` matches array length.
- **Happy path POST**: valid, existing (in ML dataset), never-before-favorited `title_name` → `201`, response has `title_name`, `title_type` (`"Movie"`/`"TV Show"` label form), `genres`, `release_year`, `added_at` (UTC ISO8601 `Z`-suffixed).
- **Duplicate**: POST the same title twice → 2nd call `422 Title already in your Favorites`.
- **Not found**: POST a `title_name` that doesn't exist in the ML dataset (e.g. `"zzz-not-a-real-title-zzz"`) → `404 Title not found`.
- **Validation**: missing `title_name`, or non-string (e.g. a number/array) → `422`.
- **Unauthorized**: any of the 3 endpoints without a token → `401`.
- **Cross-user isolation**: User A favorites a title; User B's `GET /favorites` must not include it; User B's `DELETE /favorites/{that_title}` must return `404 Title not in your Favorites` (not a 403 — ownership is enforced by scoping, so it looks like "doesn't exist" from B's perspective, not "exists but forbidden").
- **DELETE not-found**: deleting a title never favorited → `404 Title not in your Favorites`.
- **Case sensitivity to probe**: does `DELETE /favorites/breaking%20bad` remove a favorite stored as `"Breaking Bad"`? (Likely **not**, since the delete query is an exact string match — worth an explicit test given how easy this is to get wrong from a frontend.)
- **ML down scenario** (requires ability to point `ML_BASE_URL` at an unreachable host, or a mocked environment): POST while ML is down → `503`/`504`, not `500`, not silent success.

### `GET/POST/DELETE /history`
- Identical test matrix to Favorites, substituting `watched_at` for `added_at` and "Watch History" wording in messages. Confirm Favorites and Watched Titles are **independent** — favoriting a title does not appear in `GET /history` and vice versa.

### `GET /search`
- **Happy path**: `q` with ≥2 chars matching real titles → `200`, `data` array of `{title, type, release_year}`.
- **Validation**: `q` missing → `422 Enter at least 2 characters` (note the custom message, distinct from Laravel's default — good `assertExactJson`-style Postman test target); `q` = 1 char → same `422`; `limit` = 0, 21, or negative → `422`; `limit` = 21 boundary specifically worth testing (max is 20).
- **No results**: a `q` that matches nothing → `200` with `data: []`, not a `404`.
- **No auth signal enrichment**: confirm search results never include `user_signals` even with a token (only Title Detail / Recommendations do).
- **Rate limit**: 61st request/min/IP → `429`.

### `GET /titles/{title}`
- **Happy path, no auth**: existing title → `200`, `genres` is an **array** (not the ML raw comma-string), no `user_signals` key at all (not `null` — absent).
- **Happy path, with auth**: same title, valid token → response includes `user_signals: {is_favorite, is_watched}` reflecting the calling user's actual state for that exact title.
- **Not found**: nonexistent title → `404 Title not found`.
- **Optional-auth robustness**: a garbage/expired Bearer token on this endpoint → must still `200` as if no token was sent (never `401`) — an important negative test given `ResolvesOptionalAuthUser`'s swallow-and-guest behavior.
- **Case/partial matching**: test what happens with a partial title string vs. the ML service's own matching behavior (dataset-dependent; document actual behavior observed rather than assuming).

### `GET /recommendations/{title}`
- **Happy path**: existing seed title → `200`, `results` array of `{title, type, release_year, similarity_score}` — confirm `genres`/`rating`/`country`/`director`/`rank` are **absent**, not just empty.
- **Not found**: nonexistent seed → `404 Title not found`.
- **`n` boundary/abuse tests**: `?n=0`, `?n=-5`, `?n=999`, `?n=abc` — document what actually comes back (the Backend forwards these unvalidated; behavior is entirely ML-dependent, and per the ML contract ML itself should clamp to 1-50 — verify this holds).
- **Auth enrichment**: with a token, confirm each result item gets its own accurate `user_signals`, not a single top-level one.
- **No seen-title filtering here**: with a token, favorite/watch one of the titles this seed would recommend, then re-request — confirm it **still appears** (unlike Home, this endpoint does not filter against the user's own history — an easy false-bug report if testers assume Home's behavior applies here too).

### `GET /home`
- **Guest**: no token → `200`, `stage: "stranger"`, exactly 1 section (`type: "popular"`), `similarity_score: null` on every item.
- **New registered user, 0 signals**: token present, but same shape as guest.
- **Stage transition boundaries**: create exactly 4 signals (favorites+watched combined) → `stage: "explorer"`; create a 5th → `stage: "regular"`; create a 20th → `stage: "loyal"`. These exact boundary counts are the highest-value Postman tests for this endpoint.
- **Explorer with only Watched, zero Favorites**: confirm **no personalized section appears at all** — only Popular (a real, documented rule, not a bug).
- **Seen-title filtering**: favorite/watch a title that would otherwise be recommended, confirm it never appears in any section.
- **Section absence vs. empty items**: for a Loyal user, confirm the `popular` section type is **entirely absent** from `sections`, not present-with-empty-items.
- **ML down**: point `ML_BASE_URL` at an unreachable host (or otherwise simulate) and confirm `GET /home` still returns `200` with `sections` reduced/empty — this is the single most distinctive behavior of this endpoint and deserves its own dedicated Postman test, ideally run against a deliberately-broken ML URL in a scratch environment.
- **Rate limit**: 61st request/min/IP → `429`.

### Cross-cutting
- **Unmatched route**: `GET /api/this-does-not-exist` → `404 Endpoint not found` (exact envelope, no stack trace, even in non-production if you want to double check the `production`-gate specifically — test in an environment with `APP_ENV=production` if available).
- **CORS preflight**: `OPTIONS` request from an allowed vs. disallowed `Origin` header — confirm the disallowed origin gets no `Access-Control-Allow-Origin` header.
- **Every error envelope** should match `{"status": "error", "message": "...", "errors"?: {...}}` — never a bare Laravel default error page for any `api/*` path, in any Postman test.
