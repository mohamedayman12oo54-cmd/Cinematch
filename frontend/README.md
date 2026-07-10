# CineMatch — Full Frontend (React)

A complete React frontend for the Netflix-style AI recommender, built
directly against the Laravel + FastAPI API contract: auth, search, title
detail with favorites/watched, personalized home (4 user stages), and
watch history. Runs fully standalone on mock data out of the box, and
switches to your real backend with one `.env` change.

## Run it

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173). No backend
required to try the whole app — see "Mock mode" below.

## Connect to your real backend

Copy `.env.example` to `.env` and set:

```
VITE_API_BASE_URL=http://localhost/api
```

Every file in `src/api/` checks this at runtime. Empty → mock mode
(everything works locally, no server). Set → every request goes through
`src/api/client.js`, which is already wired to your contract:

- `Authorization: Bearer {token}` header attached automatically once
  logged in (see the axios interceptor in `client.js`)
- Every endpoint, method, and response shape matches your API Contract
  doc exactly (see the mapping table below)

## Real movie posters (TMDB)

Your dataset (title/genres/rating/country/release_year/director) has no
poster field, so posters are fetched client-side from **TMDB**, the
official free movie database API — this is exactly what it's for, not
scraping. Get a free key in ~2 minutes:

1. https://www.themoviedb.org/settings/api → request an API key (instant, free)
2. Add it to `.env`: `VITE_TMDB_API_KEY=your_key_here`

Without a key, every poster gracefully falls back to genre-themed
placeholder photography (`src/api/tmdb.js` → `fallbackPoster()`), so the
app still looks right before you add one.

## New: AI-interactive Home hero (proof of concept)

`src/components/AiHero.jsx` replaces the old static hero with the
`react-three-fiber` / Framer Motion concept discussed: a mouse-reactive
3D particle sphere (red/purple/cyan blend, one draw call), a typed
"What do you want to watch today?" headline, and a glassmorphic search
panel with a scan-line sweep on focus and autocomplete results that fly
in (opacity + scale + rotateX + blur) via Framer Motion.

On a fresh login, the hero plays a short intro first: black screen →
logo emerges from blur → brief glitch → camera zooms out to reveal the
sphere and search. Clicking "Home" again later skips straight to the
final state (`skipIntro` prop) so it doesn't replay every visit.

**Be aware of the cost**: Three.js pulls in ~900KB (gzipped ~256KB) on
its own. It's lazy-loaded (`React.lazy` + `Suspense` in `HomePage.jsx`)
so it doesn't block the rest of the app, and fetches only when someone
reaches Home — but it's still meaningfully heavier than the rest of the
app combined. Test on the actual hardware you'll present on before
committing further effort to Three.js elsewhere (Similar Movies
carousel, dynamic poster-color extraction, etc. from the fuller brief);
if it stutters, dial back the particle count in `ParticleSphere.jsx`
(`COUNT` constant) or drop Three.js for a 2D canvas approximation.

## New: Splash Screen + Authentication Gate

Two new pages ahead of Sign In, matching the full-experience brief:

- **`SplashScreen.jsx`** (`/`) — black screen → quick red flash → cinema-reel
  mark scales in from fog → "WELCOME TO" types in letter by letter →
  "CINEMATCH" rises letter by letter with a brief glow → tagline fades up →
  a 0→100% loading bar (with a small logo pulse on each tick) → fade to
  black → auto-continues to `/welcome`. Runs once per page load, ~3.5s.
- **`AuthGatePage.jsx`** (`/welcome`) — a blurred, desaturated collage of
  cinema-themed placeholder photography behind an 85% black overlay. The
  headline types out letter by letter, then a red underline draws under
  it, followed by the description and the two actions (Sign In / Create
  Account) staggering in. Only plays that entrance once per browser
  session (`sessionStorage`) — coming back later shows it instantly.
  Both buttons hand off to `/signin` with the right tab pre-selected via
  `location.state.mode`.

## Roadmap — the rest of the brief

Since the note above, **Welcome Back** is now built too (`WelcomeBackPage.jsx`,
`/welcome-back`): the logo docks up top, "WELCOME BACK" + your name in
red, a terminal-style status line cycling through Initializing → Loading
→ Analyzing → Preparing → Ready, a progress bar, then Continue into
Discover. Login/Register also got the backdrop poster, OR + social
buttons, and success-checkmark treatment the brief describes.

**One real conflict worth knowing about:** the brief adds a `Username`
field to Register with live availability checking. Your API Contract
(BR11) explicitly says registration is email + password only — so
Register here still sends just those two fields. Adding a username means
updating the Laravel contract first; happy to wire the frontend field in
once that's confirmed so it doesn't silently break against the real
backend.

Still queued, at this same level of detail: **Recommend / AI Assistant**
(the standout differentiator in the brief — worth doing properly rather
than rushed), **Trending**, a reworked **My List** (shelf animation +
dynamic ambient lighting), a cinematic **Movie Details** page with
dynamic poster-color theming, and a **Dashboard/Profile** with a
"Cinema DNA" chart. Say which one to tackle next.

No emoji anywhere in any of this — every icon is an inline SVG.

## Latest adjustments

- **Discover hero now matches the reference screenshot**: "Find Your Next
  Obsession." types itself out with "Obsession." in red, the underline
  draws, then "8,790 titles. One search. Infinite recommendations."
  types out beneath it, then the wide search bar fades in.
- **Dimmed poster-grid backdrop** behind the whole Discover page
  (`components/DiscoverBackdrop.jsx`) — a faint, grayscale tile grid with
  a dark overlay on top, same idea as the screenshot. It uses CineMatch's
  own catalog titles rather than the real show names in the reference
  image, to keep the effect without borrowing anyone's actual IP.
- Header restructured into 3 zones: cinema-reel icon + CINEMATCH on the
  left, nav centered (Discover, Recommend, Trending, My List), search +
  avatar on the right (`components/Header.jsx`).
- Auth pages backdrop reverted to the simple no-photography version.
- Added minimal placeholder pages for `/recommend` and `/trending`.

## Latest adjustments (2)

- **No images anywhere in the app.** TMDB posters/backdrops are gone
  entirely — `TitleCard`, `TitleDetailPage`, and the Auth Gate's poster
  collage all now use pure color gradients derived from genre
  (`utils/palette.js`) instead of photos. `api/tmdb.js` is no longer
  called by anything live (only the still-unused `AiHero`/
  `GlassSearchPanel` proof-of-concept from earlier references it — those
  aren't rendered anywhere right now).
- **Discover hero is now full-screen** (`min-height: 100vh`), black
  background with a red radial gradient, content vertically centered.

## Recommend page — full build

`pages/RecommendPage.jsx` replaces the earlier placeholder with the real
conversational AI assistant flow from the brief:

- A large glass-effect textarea (not a plain input) for a free-text
  request, a decorative voice-search button, and suggestion chips that
  scale and turn red on hover.
- Pressing **Generate Recommendations** (or Enter) runs a loading
  sequence that cycles through "Analyzing your request...", "Searching
  movie database...", "Ranking best matches...", "Generating
  recommendations..." every 500ms with a red spinner.
- An **"AI Understood Your Request"** box parses the free-text query
  (`api/aiRecommend.js` → `analyzeRequest()`) into Genre / Mood / Ending /
  Release Preference — genuinely reads the words in the request (e.g.
  "without horror" excludes horror titles, "after 2015" sets a Modern
  Movies preference) rather than being static.
- Result cards fly in one after another (opacity → scale → blur →
  normal), each with an AI Match % badge, a "Recommended because"
  checklist, and Watch Trailer / Save / Details actions. A "no exact
  match" state and a "Recent AI Searches" history row (persisted per
  account) round it out.
- Posters here are the same genre-based color gradients as the rest of
  the app — no images, per the no-photography direction.

This is a mock NLP layer, obviously — swap `analyzeRequest()` for a real
call to your FastAPI/LLM endpoint once it exists; the shape it returns
(`understood` + `results`) is what the UI already expects.

## Trending page — full build

`pages/TrendingPage.jsx` replaces the placeholder with the brief's "Top
10 countdown" experience:

- A rapid on-load countdown overlay (10 → 1) before the page reveals,
  the "wow" touch called out in the brief.
- A hero banner for the #1 title (genre-color background, no photos)
  with an "#1 WORLDWIDE" badge, and glass stat cards for IMDb / Netflix
  Score / AI Score (`api/trending.js` fabricates stable per-title
  numbers — there's no real trending signal yet).
- Region tabs (Global / USA / Egypt / Korea / Japan) that reshuffle the
  ranking, a search box scoped to the trending list, a Top 10 list with
  large rank numerals, "Trending Movies" / "Trending TV Shows" rows
  (reusing `TitleCard`), a "Rising Fast" section, and a simple Weekly
  Chart showing last week's rank vs. this week's.
- `api/trending.js` is clearly a mock — wire it to a real trending
  endpoint (or compute it from watch/favorite counts) whenever that
  exists; every consumer already expects the same shape.

## My List page — full build

`pages/MyListPage.jsx` (still served at `/favorites`) replaces the plain
list with the brief's "personal cinema collection":

- Hero with a live saved-title count badge, search-inside-collection,
  a sort dropdown (Newest Added / Oldest / Alphabetical / Year), and
  All / Movies / TV Shows tabs.
- A 5-column grid where cards "shelve in" staggered on load, each with a
  Saved badge and four hover actions (Play, Details, Rate, Remove) via
  the new `components/MyListCard.jsx`. Remove dissolves the card
  (scale + blur + fade) instead of just vanishing.
- **Dynamic ambient lighting**: hovering a card tints the whole page's
  background glow to that title's genre color
  (`utils/palette.js` → `genreAccent()`) — the closest thing to the
  brief's "extract colors from the poster" idea while staying entirely
  photo-free.
- A "Recently Added" row, four count-up Collection Stats (Movies Saved,
  TV Shows, Favorite Genre, Hours of Content — all computed from your
  actual saved titles, not fake numbers), and a proper empty state with
  an "Explore Movies" link back to Discover.

## Movie Details page — the cinematic upgrade

`pages/TitleDetailPage.jsx` is now the flagship page the brief describes
("the most premium page in the whole project"):

- Full-screen (100vh) hero with a subtle scroll parallax, IMDb / Rotten
  Tomatoes / AI Match badges, genre capsules, and Watch Trailer / Add to
  My List / Share / Mark as Watched actions — Favorite and Watched still
  work exactly as before, this is purely a visual upgrade.
- Overview, a Movie Information glass-card grid (release year, runtime,
  language, country, director, studio), an animated AI Match ring with
  "Why We Recommend It" reasons, a Cast section, a Trailer placeholder,
  a 4-tile Screenshot gallery, "You May Also Like" (the existing
  recommendations row), Reviews, and an AI Summary card.
- All of it — cast avatars, trailer/gallery tiles, review avatars, even
  the whole page's accent color — comes from `utils/enrich.js` and
  `utils/palette.js`'s genre-based color system, so it's fully populated
  and on-brand without a single photo or a real content API. Everything
  in `enrich.js` is seeded from the title so it's stable across reloads;
  swap each function for a real API call once your backend has cast,
  reviews, runtime, etc.

## What's new in this pass

- **All auth pages, not just login/register**: Forgot Password
  (`ForgotPasswordPage.jsx`, with an inline "check your email" success
  state) and Reset Password (`ResetPasswordPage.jsx`, reads `?token=`
  from the URL). Both use placeholder API calls in `api/auth.js`
  (`requestPasswordReset`, `resetPassword`) since these aren't in the
  current contract yet — clearly commented so it's obvious what to
  coordinate with the backend team.
- **Simplified auth background** (`components/AuthBackground.jsx`) — no
  photography at all now, just a dark base with two soft breathing red
  glows and fine grain. Calmer, and puts all the focus on the form.
- **Welcome → navbar morph on first arrival at Home**: right after
  login/register, a full-screen "Welcome, name" plays for a beat, then
  visually flies up and shrinks into the header logo's exact position
  while the real page fades in underneath — instead of a separate
  "Continue" screen. Only plays once per login (`HomePage.jsx`, driven by
  `location.state.justAuthenticated` from `AuthPage`'s `navigate()`).
- **Hero search section on Home**: animated "Find Your Next Obsession"
  headline with a drawn-on underline, a tagline, and the big centered
  search bar with a typewriter placeholder — sits above the personalized
  rows so the core product (search → 10 closest matches) is still the
  first thing people see, not buried under browsing.
- **Card polish**: a one-time shimmer sweep across each poster as it
  appears, and match-percentage counts up from 0 instead of just
  appearing, plus a red glow ring on hover.

## What's new in this pass (previous)

- **Command-palette search** — click the search pill or press `/` anywhere
  to open a centered overlay with live results, arrow-key navigation, and
  Enter to jump straight to a title (`components/Header.jsx`).
- **Global toast system** (`context/ToastContext.jsx`) — every
  favorite/watched/remove action gives consistent feedback app-wide,
  instead of each page rolling its own.
- **Automatic session handling** — a 401 from any API call fires
  `auth:unauthorized`; `App.jsx` catches it, signs the person out, shows a
  toast, and returns them to Sign In. No more silently-broken pages.
- **Skeleton loading states** everywhere (Home rows, Search grid, Title
  detail hero, Favorites/History rows) instead of plain "Loading…" text.
- **Staggered entrance + exit animation** on every card/row/list item, a
  route-change progress bar, and richer poster hover (lift + zoom).
- Mobile hamburger menu for the navbar.

## Project structure

```
src/
├── api/                     # one file per contract group, mock ↔ real switch inside each
│   ├── client.js             # axios instance + auto Bearer token header
│   ├── auth.js                # register / login / logout / me
│   ├── titles.js              # search / title detail / recommendations
│   ├── favorites.js
│   ├── history.js
│   ├── home.js                 # the 4-stage personalized home logic
│   └── tmdb.js                  # real poster lookup + themed fallback
├── context/
│   ├── AuthContext.jsx        # user + token state, login/register/logout
│   └── ProtectedRoute.jsx      # redirects to "/" if not authenticated
├── data/
│   ├── catalog.js              # mock catalog, shaped exactly like your API fields
│   └── mockSession.js           # mock users/favorites/history (localStorage-backed)
├── components/
│   ├── Header.jsx               # nav + live search + profile menu (used on every page after auth)
│   ├── TitleCard.jsx             # poster card: TMDB image, match %, reason, rank
│   ├── FormInput.jsx, LoginForm.jsx, RegisterForm.jsx, PasswordStrength.jsx
│   ├── PosterWall.jsx, WelcomeScreen.jsx
├── pages/
│   ├── AuthPage.jsx + AuthPage.css        # sign in / create account, curtain wipe, welcome moment
│   ├── HomePage.jsx                        # GET /home — stage-adaptive sections
│   ├── SearchResultsPage.jsx               # GET /search
│   ├── TitleDetailPage.jsx + .css          # GET /titles/:title + recommendations, favorite/watched actions
│   ├── FavoritesPage.jsx                   # GET /favorites + remove
│   ├── HistoryPage.jsx                     # GET /history + remove
│   └── BrowsePages.css, ListPages.css       # shared styles
├── App.jsx                    # routes
└── main.jsx                    # BrowserRouter + AuthProvider
```

## Routes

| Path | Page | Auth |
|---|---|---|
| `/` | Splash screen (plays once, then auto-continues) | Public |
| `/welcome` | Authentication Gate (poster collage, Sign In / Create Account) | Public |
| `/signin` | Sign in / Create account | Public |
| `/forgot-password` | Forgot password | Public |
| `/reset-password?token=` | Set new password | Public |
| `/home` | Personalized home (4 stages) + AI hero search | Protected |
| `/search?q=` | Search results | Protected |
| `/title/:title` | Detail + recommendations + favorite/watched | Protected |
| `/favorites` | My List | Protected |
| `/history` | Watch history | Protected |

Every protected route redirects to `/` if there's no logged-in user
(`ProtectedRoute.jsx`). Your contract technically allows guest browsing
via Optional Auth — if you want that here too, just remove the
`<ProtectedRoute>` wrapper around `/search` and `/title/:title` in
`App.jsx`; those pages already handle a logged-out user gracefully
(`is_favorite`/`is_watched` render as unavailable, `reason` stays null).

## API contract mapping

| Contract endpoint | Frontend call |
|---|---|
| `POST /auth/register` (BR11: email + password only) | `context/AuthContext.jsx` → `register()` |
| `POST /auth/login` | `AuthContext.jsx` → `login()` |
| `GET /search?q=&limit=` | `api/titles.js` → `search()` |
| `GET /titles/{title}` | `api/titles.js` → `getTitleDetail()` |
| `GET /titles/{title}/recommendations?n=` | `api/titles.js` → `getRecommendations()` |
| `POST /favorites` (toggle) | `api/favorites.js` → `toggleFavorite()` |
| `DELETE /favorites/{title}` | `api/favorites.js` → `removeFavorite()` |
| `POST /history` | `api/history.js` → `markWatched()` |
| `DELETE /history/{title}` | `api/history.js` → `removeHistoryEntry()` |
| `GET /home` (stage + sections) | `api/home.js` → `getHome()` |

## The 4 stages (from your diagram)

`HomePage.jsx` reads `stage` from the `/home` response and swaps the
eyebrow/heading copy accordingly (`STAGE_COPY` at the top of the file):
**stranger** (guest → Popular section only), **explorer** (new/registered,
few signals), **regular** (has a taste profile → Recommended For You +
Because You Watched + Based on Favorites), **loyal** (same sections, tone
shifts to "we know you well"). The mock `api/home.js` derives a stage
from favorites+history count so you can see all four just by adding/
removing favorites — swap that block for the real backend's `stage` once
it's live.

## Notes

- Favorite/mark-as-watched calls send full metadata
  (`title, type, genres, release_year`), matching BR6/BR7 — the backend
  never needs to re-query the ML service for it.
- `is_favorite` / `is_watched` render as unavailable for guests (`null`
  from the contract), not `false` — `TitleDetailPage.jsx` treats them as
  falsy for display but never claims "not favorited" for a guest.
- Password rule here is 8+ characters (a reasonable frontend default);
  adjust in `RegisterForm.jsx` to match whatever validation Laravel
  actually enforces.
