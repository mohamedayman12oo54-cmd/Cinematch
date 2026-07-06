# ENGINEERING_PLAYBOOK.md

> Reverse-engineered from the Brewtica repository (Laravel 13 / PHP 8.3 / JWT / Pest).
> This is not a description of Brewtica. It is a **reusable operating system** extracted from how it was built — commit by commit, layer by layer, decision by decision. Future projects should be executed against this document as the source of truth.

---

## 1. Core Engineering Philosophy

### 1.1 The prime directive
**Design before code. Bugs before hardening. Hardening after coverage, never before.**
Every feature in this repo followed the same shape: diagrams → validation → business logic → shape the response → wire it up → expose it → break it → fix it → prove it with tests. Security/consistency concerns (unified responses, global exception handling, rate limiting) were deliberately deferred to a **dedicated final phase**, applied horizontally across every feature at once, rather than reinvented per-feature. This is intentional: cross-cutting concerns are cheaper to build once, correctly, after the shape of the whole system is known.

### 1.2 What "clean code" means in this style
- **Explicit over magic.** Enums instead of raw strings for statuses (`OrderStatus`, `PaymentStatus`, `OrderSize`). Every enum exposes `values()` and `label()` — no guessing string casing at call sites.
- **Thin controllers, fat services.** Controllers never contain business rules. They: resolve the authenticated user, call one service method, map the result to a response. Nothing else.
- **Arrays as service contracts.** Services return plain `array` (`['success' => bool, 'reason' => ...]` / `['action' => 'removed'|'updated']`) instead of throwing exceptions for expected business outcomes (item not found in cart, size unavailable). Exceptions are reserved for truly exceptional states; expected alternate outcomes are values, checked with `if`.
- **Scoped queries as the authorization mechanism for ownership.** `$user->cart()->where(...)` is preferred over `Cart::find($id)` + manual ownership check. The query itself makes cross-user access structurally impossible, rather than relying on an `if ($cart->user_id !== $user->id)` guard that could be forgotten.
- **Readability over premature abstraction.** No repository pattern, no generic CRUD base classes, no query objects. Each service method is a plain, readable sequence of Eloquent calls. Three similar service methods across three services is preferred to one generic abstraction.
- **Section banners over sprawl.** Every file with more than ~2 responsibilities is broken into `// ======= Name =======` banner comments (services, ApiResponse, tests). This is the substitute for splitting into more files — it keeps navigation fast without fragmenting cohesive logic.

### 1.3 What is explicitly avoided
- No global exception suppression before global exception handling exists — the exception handler was purpose-built (`app/Exceptions/Handler.php`), not `try/catch`-everywhere.
- No premature security. Policies were scaffolded early (`php artisan make:model -a` era) but functional authorization logic was **not** written into them until it was actually needed — most `*Policy` classes still return `false` for every ability today, because real authorization is done via scoped queries and the `role` middleware, not the Policy layer, in this codebase. **Rule for future projects: decide up front whether Policies or scoped-queries+middleware own authorization — don't leave both half-wired.**
- No response-shape decisions made feature-by-feature. Early controllers returned raw `response()->json([...])` ad hoc; this was consciously unified later into `ApiResponse` in one refactor commit across all controllers at once, rather than each feature inventing its own shape.
- No "just in case" validation, columns, or abstractions. The `sub_sub_categories.image` column was *not* pre-added "for consistency" until the admin panel feature actually required it — then it was added via a small, explicitly-labeled follow-up migration.

### 1.4 Where explicitness beats DRY
Validation messages are always spelled out per-rule (`'menu_item_id.required' => 'The menu item is required.'`) rather than relying on Laravel's default. Every `FormRequest` in the repo declares its own literal rule set — none share rule traits — because the cost of one duplicated `required|integer` line is lower than the cost of hidden coupling between two unrelated request classes.

---

## 2. Global Development Lifecycle

The entire project moved through these ordered macro-phases. **This ordering is a rule, not an accident** — verified by commit timestamps across the whole history.

```
Phase 0  Bootstrap            → Initial commit, tooling install
Phase 1  System Design        → Architecture + ERD diagrams (docs/, no code)
Phase 2  Domain Foundation    → Migrations + Models + relationships (schema truth)
Phase 3  Auth Foundation      → JWT auth + auth diagrams + tests
Phase 4  Feature Loop         → Repeated N times, one per bounded feature:
                                  Menu Browsing → Profile → Favorites → Cart
                                  → Orders → Admin Panel
Phase 5  Security & Quality   → Horizontal hardening pass across ALL features
Phase 6  (ongoing) Refinement → Small fixes discovered during hardening/testing
```

### Rules
1. **No feature work starts before the domain schema (migrations + models + relationships) exists in full.** The commit `feat: set up database schema, core domain models and relationships` precedes every single feature branch of work.
2. **No feature is designed and built in the same commit.** A `docs(<feature>): add ... diagrams` commit always precedes the first `feat(<feature>): ...` commit for that feature.
3. **Security/consistency hardening (global exception handler, unified API response envelope, rate limiting) happens once, at the end, across all features simultaneously** — never re-derived per feature.
4. **Authentication is built immediately after the schema, before any business feature**, because every subsequent feature's authorization model depends on it.

---

## 3. Phase-by-Phase Workflow

### Phase 0 — Bootstrap
- **Purpose:** Get a working Laravel skeleton with the exact toolchain the project will use, before any domain thinking.
- **Entry condition:** Empty repo.
- **Actions:** `laravel new`, then a single `Add various tooling` commit that pins dev tooling (Pest, Pint, Rector, Laravel Boost, `.editorconfig`).
- **Exit condition:** `composer test`, `composer format` (`rector` then `pint`) both runnable.
- **Deliverable:** Buildable skeleton, no domain code.
- **Quality bar:** Toolchain decisions (test runner, formatter, static analysis) are made once, up front, and never revisited mid-project.

### Phase 1 — System Design (docs-only)
- **Purpose:** Force architectural thinking into an artifact before a single line of domain code exists.
- **Entry condition:** Phase 0 complete.
- **Actions:** Produce `docs/architecture/System_Architecture.png`, ERD (`docs/database/Brewtica_ERD.png`), table-mapping and dependency-tree diagrams. Commit as `docs: initial system design and architecture diagrams`.
- **Exit condition:** An ERD exists that every subsequent migration must match.
- **Deliverable:** Diagrams only, zero code changes in this commit.
- **Quality bar:** The ERD is treated as a contract — Phase 2 migrations must trace back to it 1:1.

### Phase 2 — Domain Foundation
- **Purpose:** Lay the entire relational schema and Eloquent model layer in one pass, before any endpoint exists, so every later feature builds on stable ground.
- **Entry condition:** ERD exists (Phase 1).
- **Actions (single large commit `feat: set up database schema, core domain models and relationships`):**
  - All core migrations (`main_categories`, `sub_categories`, `sub_sub_categories`, `menu_items`, `menu_item_size_prices`, `customers`, `staff_details`, `orders`, `order_details`, `carts`, `favorites`, `payments`, `deliveries`, `user_phones`).
  - All Eloquent models with typed relationship methods (`BelongsTo`/`HasMany`/`HasOne`), `casts()`, `$fillable`.
  - Backed string `enum`s at `App\` root namespace for every finite domain vocabulary (`OrderStatus`, `OrderSize`, `PaymentStatus`, `PaymentMethod`, `DeliveryStatus`, `UserRole`, `UserGender`, `Shift`, `ItemSize`).
  - Policies scaffolded for every model (even if left `return false` for now — see §5.10).
- **Exit condition:** `php artisan migrate` succeeds cleanly on a fresh database; every model has factories.
- **Deliverable:** Complete schema + models, zero HTTP surface yet.
- **Quality bar:** Foreign keys always declare an explicit delete behavior (`cascadeOnDelete()` vs `restrictOnDelete()`) — never left to default. This decision is made **at schema time**, not discovered later as a bug (though see §6.6, it *was* under-specified once and had to be patched).

### Phase 3 — Auth Foundation
- **Purpose:** Every other feature needs `auth('api')->user()`; build and prove it before anything depends on it.
- **Entry condition:** Domain foundation complete.
- **Sequence:**
  1. `docs: add authentication system and APIs security diagrams`
  2. `feat: implement authentication system and secure APIs` (JWT via `php-open-source-saver/jwt-auth`, `AuthController`, `LoginRequest`/`RegisterRequest`, `AuthService`)
  3. `test: add authentication and database test coverage`
- **Exit condition:** Login, register, refresh, logout, `me` all work and are tested.
- **Deliverable:** A `role`-aware, JWT-authenticated API guard usable by every future feature.
- **Quality bar:** Rate limiting on `login`/`register` is applied **at this phase**, immediately, because credential endpoints are the highest-risk surface in the app — this is the one security concern *not* deferred to Phase 5.

### Phase 4 — The Feature Loop (repeated per feature)
This is the core, most repeated workflow in the whole repository. Executed identically (with only minor local reordering) for: **Menu Browsing, Profile Management, Favorites, Cart, Orders, Admin Panel.**

**Entry condition for a feature:** Domain foundation + Auth foundation exist; the feature's data model already exists (was created in Phase 2).

**Steps, strictly in this order (verified across every feature's commit sequence):**

1. **`docs(<feature>): add <feature> management and api diagrams`** — feature analysis, endpoint design, request/response shape, request-flow diagram, implementation tree. Design is drawn, not coded, first.
2. **`feat(<feature>): add request validation for <feature> operations`** — `FormRequest` classes only. Validation rules are decided before a single line of business logic exists.
3. **`feat(<feature>): implement <feature> service business logic`** — the `Service` class. Pure business rules, no HTTP concerns. If the feature needs an async side effect (e.g. order confirmation email), the **Job** is added directly after the service, in its own commit, before the resource layer.
4. **`feat(<feature>): add <feature> API resource(s)`** — `JsonResource` classes that define exactly what the client is allowed to see.
5. **`feat(<feature>): add <feature> controller endpoints`** — thin orchestration: resolve user → call service → wrap in resource/ApiResponse.
6. **`feat(<feature>): register <feature> API routes`** — routes added last, with the appropriate middleware stack (`auth:api`, `role:...`, `throttle:...`) decided per route's sensitivity at the point of registration.
7. **`fix(<feature>): ...`** — bugs found while manually exercising or writing tests against the real database (enum coercion bugs, factory gaps, migration table-name typos, route path pluralization). These are typically **small, single-purpose commits**, one bug per commit.
8. **`test(<feature>): add feature tests for <scenario group>`** — tests are added **in scenario groups**, not all at once: happy path first, then edge cases (quantity=0, duplicate add, unavailable size), then cross-user authorization/ownership last. Each scenario group is its own commit.
9. *(Optional)* **`docs(<feature>): document missing requirements discovered during implementation`** — when implementation surfaces a gap between the design docs and the existing schema/business rules (see `docs/Features/Admin_Panel/05_missing_requirements.md`), it is written down as a first-class doc, not silently patched.

**Exit condition for a feature:** All designed endpoints are routed, tested, and any discovered gaps are both fixed **and** documented.

**Deliverable:** A vertically complete feature: docs → validation → service → resource → controller → route → tests, fully working end-to-end.

**Quality bar per feature:**
- Every mutating endpoint has at least one test proving cross-user isolation ("customer sees only their own cart", "cannot modify another user's cart/order").
- Every enum-typed input accepted from the client is validated with `in:` against the enum's value list, and internal comparisons cast to the enum type, never compared as raw strings (`9658b19 fix(orders): compare order status against OrderStatus enum instead of string` is exactly this class of bug, fixed as soon as found).

### Phase 5 — Security & Quality (horizontal hardening)
- **Purpose:** Once every feature works in isolation, unify how the *entire* API behaves under error and load conditions — a concern no single feature commit should own.
- **Entry condition:** All planned features functionally complete and individually tested.
- **Sequence (exact order, verified from git log):**
  1. `docs(security & quality): add security and code quality enhancement diagrams`
  2. `feat: add api response helper for exception handler` — build `ApiResponse` first, as a static helper, before anything consumes it.
  3. `feat: add exception handler for return consistent errors` — build `App\Exceptions\Handler` on top of `ApiResponse`.
  4. `feat: add rate limiting to routes` — throttle tuned per-route by sensitivity (auth < public read < authenticated write < admin).
  5. `fix(auth): return structured JSON for throttled API requests` — first pass fix once rate limiting exposed an inconsistency.
  6. `test: add rate limit tests`
  7. `fix(exceptions): wire up App\Exceptions\Handler as the active exception handler` — bootstrap registration is a **separate commit** from writing the handler; "written" and "wired up" are treated as two distinct, independently verifiable steps.
  8. `test: add tests for exception scenarios`
  9. `fix(api): allow ApiResponse::success/created to merge extra top-level fields` — the helper's API is refined once real call sites (e.g. cart returning `action`) needed it.
  10. `refactor(api): integrate ApiResponse helper across all controllers` — **one dedicated commit** retrofits every controller at once, only after the helper's shape has stabilized.
  11. `test(auth): update AuthTest assertions for ApiResponse data shape` — tests updated to match the new global shape immediately after the refactor.
  12. `fix(exceptions): always return JSON for api/* routes regardless of Accept header` — final content-negotiation edge case, found last.
- **Exit condition:** Every `api/*` response — success or failure — has one predictable envelope (`status`, `message`, `data`/`errors`), regardless of exception type or client `Accept` header.
- **Deliverable:** A single `ApiResponse` helper, a single `Handler`, tuned per-route throttles, and a passing test suite reflecting the new shape.
- **Quality bar:** No controller may construct a raw `response()->json([...])` after this phase — 100% of responses go through `ApiResponse`. Old raw-JSON code is not deleted immediately; see §6.7 for how this transition is tracked.

---

## 4. Feature Development Workflow

### 4.1 How to move feature-by-feature
Features are chosen and ordered by **dependency, not difficulty**: Menu Browsing (read-only, no auth needed beyond public throttle) → Profile → Favorites → Cart → Orders (depends on Cart + Menu) → Admin Panel (depends on every prior model existing) → Security & Quality (depends on every controller existing). Each feature is a **vertical slice** — one feature touches validation, service, resource, controller, routes, and tests, never leaving a layer half-built for later.

### 4.2 Definition of "feature complete"
A feature is done when:
- [ ] Design diagrams exist in `docs/Features/<Feature>/`.
- [ ] Every planned endpoint is routed with the correct middleware stack.
- [ ] Every endpoint has a `FormRequest` (even if `authorize()` trivially returns `true`).
- [ ] Business logic lives only in a `Service` class, not the controller.
- [ ] Output shape is defined by a `JsonResource` or an explicit array contract, not the raw model.
- [ ] Tests exist for: happy path, at least one business-rule edge case, and cross-user isolation.
- [ ] Any gap between design and implementation is either fixed or written down in a `05_missing_requirements.md`-style doc.

### 4.3 Transitioning to the next feature
The next feature's `docs(...)` commit is not started until the current feature's `test(...)` commits are in. **Tests are the checkpoint that closes a feature**, not a final cleanup pass — this repo never shows "add tests" for feature A appearing after feature B's implementation has started.

### 4.4 Reducing technical debt
- Debt discovered *while building* a feature (e.g. an empty factory blocking tests, a missing column) is fixed inline as a `fix(<feature>):` commit in the same feature loop — not deferred.
- Debt that is *systemic* (inconsistent response shapes across controllers) is deliberately **not** fixed feature-by-feature. It is explicitly deferred to Phase 5 and fixed once, everywhere, in a `refactor:` commit. **Rule: local bugs get fixed immediately; global inconsistencies get batched into one horizontal pass.**

### 4.5 Avoiding architecture breakage
New features never modify the shape of an existing service's public method signatures without a corresponding `fix:` commit and, ideally, a test proving the old callers still work. Enum types are introduced early (Phase 2) precisely so that later features (Orders, Admin) can consume the same vocabulary without redefining status strings.

---

## 5. Layer-by-Layer Implementation Rules

For each layer: purpose, when/why it's created, dependencies, and the exact conventions observed repeatedly enough to be treated as rules.

### 5.1 Database Design / ERD
- **Purpose:** Single source of truth for what data exists and how it relates.
- **When:** Phase 1, before any migration.
- **Why then:** You cannot write a correct migration or model relationship without first deciding cardinality and delete semantics on paper/diagram.
- **Dependencies:** None — this is the root artifact.
- **Rules:**
  - Every relationship in the ERD must have an explicit `cascadeOnDelete()` or `restrictOnDelete()` decision *at design time*, not left implicit. (Violating this caused a real bug — see §6.6.)
  - Composite/natural keys are used when they express the actual invariant (`carts` table primary key is `['user_id','menu_item_id','size']` — a user can only have one cart row per item+size combination, enforced at the schema level, not just in application code).

### 5.2 Migrations
- **Purpose:** Codify the ERD as executable schema.
- **When:** Immediately after ERD, in one batch during Phase 2 for the whole domain; individual follow-up migrations only when a feature discovers a genuine gap (Phase 4, `fix:` commits).
- **Dependencies:** ERD.
- **Conventions:**
  - `Schema::create` for new tables always paired with a symmetrical `Schema::dropIfExists` in `down()`.
  - `$table->foreignId(...)->constrained()->cascadeOnDelete()` / `restrictOnDelete()` — always chained, never a bare `foreignId`.
  - Follow-up column additions get their own narrowly-scoped migration file named for exactly what changed (`add_image_to_sub_sub_categories_table`), never folded into an unrelated migration.
  - Enum-like columns are stored as `string`, validated at the request layer, cast to PHP `enum` at the model layer — the DB itself does not enforce the enum (portable across DB engines, validated in one place: the FormRequest).

### 5.3 Models
- **Purpose:** Typed, relationship-aware representation of a table.
- **When:** Same commit as its migration (Phase 2), all at once for the whole domain.
- **Dependencies:** Migration must exist first.
- **Conventions:**
  - `use HasFactory;` with the `/** @use HasFactory<\Database\Factories\XFactory> */` docblock on every model — even when the factory is added later, the docblock and trait are added at model-creation time.
  - `protected $fillable` explicitly lists every mass-assignable column — never `$guarded = []`.
  - `protected function casts(): array` (method form, not the old `$casts` property) — used for enum casting (`'status' => OrderStatus::class`) and decimal precision (`'total_amount' => 'decimal:2'`).
  - Relationship methods are grouped under a `// ======= Relationships =======` banner, return-typed (`BelongsTo`, `HasMany`, `HasOne`), and named for the *related concept*, not the FK column.

### 5.4 Enums
- **Purpose:** Make finite vocabularies (statuses, sizes, roles) type-safe and centrally documented.
- **When:** Phase 2, alongside the models that use them, even if not every feature needs them yet.
- **Convention:** Backed `string` enum at `App\` root namespace (not nested under `App\Enums\`, in this codebase — note for future projects: nesting under `App\Enums\` is the more conventional Laravel choice and is **recommended going forward** even though this repo kept them flat). Every enum implements `values(): array` (for validation rule generation) and `label(): string` (for display). Comparisons anywhere in services/controllers must use the enum, never the raw string — this was a real bug class here (`9658b19`, `27bc257`).

### 5.5 Factories
- **Purpose:** Deterministic-enough fake data generation for tests and seeding.
- **When:** Immediately after the model — a model without a working factory is treated as **incomplete**, because it silently blocks future test-writing (see §6.5, the empty `StaffDetailFactory` that blocked an entire feature's tests until caught).
- **Rule:** Every `NOT NULL` column without a DB default must have a value in `definition()`. An empty or partial factory is a defect, not a "fill in later" TODO.

### 5.6 Seeders
- **Purpose:** Reproducible local/staging data using the factories, in dependency order.
- **When:** Phase 2, once factories exist.
- **Convention:** `DatabaseSeeder` calls domain seeders in an order that respects foreign keys (categories → sub-categories → sub-sub-categories → menu items → prices, before carts/favorites/orders that reference them).

### 5.7 Services (`app/Services`)
- **Purpose:** The only place business rules live. Controllers and Resources must never contain a business decision.
- **When:** Right after the FormRequest for that feature, before the Resource/Controller — business logic is decided before you decide how to display or route it.
- **Dependencies:** Models, enums.
- **Conventions:**
  - Namespace declared as `App\Services` (capital S) — **but note: in this repo the actual folder on disk is `app/services` (lowercase), which only works because the local/dev filesystem is case-insensitive (Windows/macOS). This is a latent bug that will break on case-sensitive filesystems (Linux CI/production). Rule for future projects: folder casing must exactly match the PSR-4 namespace casing — always `app/Services`.**
  - One class per bounded feature (`CartService`, `OrderService`, `StaffOrderService`, `DeliveryService`, `Admin\CategoryService`, `Admin\DashboardService`, etc.) — never one giant `Service` god-class.
  - Methods take the authenticated `User` (or domain model) as an explicit first parameter and a plain array of validated data — never re-read `request()` inside a service.
  - Returns are either a hydrated model/array of data (for reads) or a small `['success' => bool, ...context]` array (for writes with expected alternate outcomes) — exceptions are not used for "not found in cart" or "size unavailable" style outcomes.
  - Ownership/scoping is enforced by chaining off the relationship (`$user->cart()->where(...)`), not by fetching globally and checking a foreign key.
  - Section banners (`// ======= Add To Cart =======`) divide each public method.

### 5.8 Form Requests
- **Purpose:** Single source of truth for what input is acceptable, before it reaches any business logic.
- **When:** First implementation step of every feature (before the service) — validation rules are decided before the code that consumes the validated data.
- **Conventions:**
  - `authorize()` returns `true` when the `auth:api` middleware already gates the route (authorization is the middleware/policy's job, not repeated here) — kept as an explicit method, never omitted, even when trivial.
  - `rules()` always returns literal arrays of rule strings — no shared traits, no rule-building helpers.
  - `messages()` is present on every request with non-trivial rules, mapping `field.rule` to a specific, user-facing sentence — never left to Laravel's generic default message.
  - Split into `Store*Request`/`Update*Request` (or verb-specific, e.g. `AddToCartRequest`/`UpdateCartRequest`) per operation, not one shared request with conditional rules.

### 5.9 API Resources
- **Purpose:** Decouple the wire format from the Eloquent model; the client only ever sees what a Resource exposes.
- **When:** After the service exists (so you know exactly what data is available to shape) and before the controller (so the controller can just return it).
- **Convention:** One Resource per exposed shape, even if it's a thin wrapper (`FavoriteResource`, `MenuItemDetailResource` vs `MenuItemResource` — a *detail* view and a *list* view of the same model get separate Resources rather than one Resource with conditional fields).

### 5.10 Controllers
- **Purpose:** HTTP orchestration only — no business rules, no query building beyond `auth('api')->user()`.
- **When:** After validation, service, and resource all exist — the controller is the last piece that's *wired*, not designed.
- **Dependencies:** Constructor-injected service (`private readonly CartService $cartService`), Form Requests, Resources, `ApiResponse`.
- **Convention:** Every action method is preceded by an HTTP-verb + path comment (`// GET /api/cart`) directly above it, doubling as inline route documentation. Each action: resolve user → call exactly one service method → branch on success/failure if applicable → return via `ApiResponse`.

### 5.11 Routes
- **Purpose:** Expose controller actions with the correct middleware stack.
- **When:** Last step of the `feat` sequence for a feature — routes are the final wire-up after every layer beneath them exists and compiles.
- **Conventions:**
  - Routes grouped by access level with a `// ======= <Group> Routes =======` banner (`Public`, `Protected`, `Staff`, `Delivery`, `Admin`).
  - Middleware stack is chosen by sensitivity at registration time: `throttle:5,1` for login, `throttle:10,1` for register, `throttle:60,1` for public menu reads, `['auth:api','throttle:100,1']` for general authenticated writes, `['auth:api','role:staff,admin','throttle:100,1']` for staff, `['auth:api','role:admin','throttle:200,1']` for admin.
  - `role:...` middleware takes comma-separated roles as variadic route parameters — one middleware class serves every role-gated route in the app.

### 5.12 Policies / Authorization
- **Purpose (as originally scaffolded):** Model-level authorization via Laravel's Gate.
- **Reality in this codebase:** Scaffolded per-model at Phase 2 alongside the model, but **left denying-by-default (`return false`) for most abilities** because actual authorization ended up implemented via (a) scoped Eloquent queries in Services for row-level ownership, and (b) the `role` middleware for endpoint-level access.
- **Rule for future projects:** pick one mechanism deliberately at Phase 2 and commit to it everywhere — don't let Policies exist as unused scaffolding while real authorization logic lives elsewhere. If Policies are the chosen mechanism, wire `$this->authorize(...)` into every controller action that touches an owned model; if scoped-queries+middleware is chosen instead, delete or intentionally leave Policies as documented "not used, see Services" stubs rather than silent dead code.

### 5.13 Middleware
- **Purpose:** Cross-cutting request gating that doesn't belong in any one controller.
- **When:** Created the moment a role-gated route is first needed (introduced during the Orders/Staff feature loop, reused unchanged for Delivery and Admin).
- **Convention:** `EnsureUserHasRole` takes `string ...$roles`, checks `$request->user('api')->role->value` against the list with strict `in_array`, and returns a raw 403 JSON payload directly (this predates the Phase 5 `ApiResponse` helper and was **not** retrofitted to use it — a leftover inconsistency worth fixing in future projects: once `ApiResponse` exists, all middleware error responses should route through it too).

### 5.14 Validation
See §5.8. Validation is a Form Request responsibility exclusively; no `$request->validate([...])` inline in controllers anywhere in this codebase.

### 5.15 Exception Handling
- **Purpose:** One predictable JSON envelope for every failure mode on every `api/*` route, regardless of exception type.
- **When:** Phase 5, after every feature's happy/edge paths are already covered by tests (so the handler's behavior can be verified against real, already-passing scenarios rather than guessed at).
- **Convention:** `render()` branches on `$request->is('api/*')` first — non-API routes fall through to the framework default entirely. Inside the API branch, exceptions are handled in a fixed priority order: `ModelNotFoundException` → route `NotFoundHttpException` → `AuthenticationException` → `AuthorizationException` → `ValidationException` → `TooManyRequestsHttpException` → catch-all (environment-gated: sanitized in `production`, full trace in non-production).
- **Rule:** the catch-all must **never** leak file/line/message in production — this is enforced with `app()->environment('production')`, not a config flag that could be left on.

### 5.16 Tests
See §7 (dedicated section — testing is significant enough here to warrant its own).

### 5.17 Security Layers & Rate Limiting
- **Purpose:** Prevent abuse of authentication and expensive endpoints; independent of business-logic correctness.
- **When:** Rate limiting on **auth** endpoints is applied immediately in Phase 3 (highest risk, earliest). Rate limiting on **every other** endpoint is applied in Phase 5, tuned per route group.
- **Values used (as a starting default for future projects):** login `5/min`, register `10/min`, public read `60/min`, general authenticated `100/min`, admin `200/min` (admin endpoints get a *higher* ceiling because they're role-gated and lower-volume-but-legitimately-bursty, not a lower one — don't assume "privileged = throttle harder").

### 5.18 Final Hardening
The last commit in the Security & Quality phase is always the narrowest, most surgical fix — a single content-negotiation edge case (`ea53b3c`). **Rule: the very last commit before a phase is declared closed should be a small correctness fix discovered by re-reading the whole phase's diff, not a new feature.**

---

## 6. Git & Commit Strategy

### 6.1 Commit message grammar
`type(scope): imperative description`

**Types observed and their exact meaning:**
- `feat` — new capability added (validation, service, resource, controller, routes, jobs, middleware).
- `fix` — corrects a defect in already-committed code within the current feature loop.
- `test` — adds test coverage; never mixed with `feat`/`fix` in the same commit.
- `docs` — diagrams or written notes only; no application code changes.
- `refactor` — behavior-preserving restructuring across multiple files/controllers (reserved for horizontal changes, used exactly once in this repo: the `ApiResponse` integration).

**Scope** is always the feature/domain name (`cart`, `favorites`, `orders`, `admin`, `auth`, `staff`, `categories`, `exceptions`, `api`, or the compound `security & quality`), never a file name or layer name.

### 6.2 One concern per commit
Every commit in the history does exactly one of: design, validate, implement-logic, shape-output, wire-controller, expose-route, fix-one-bug, or add-one-scenario-group-of-tests. Commits are never "feat: add cart feature" as a single monolith.

### 6.3 Fix commits are granular and honestly scoped
`fix(cart): accept OrderSize enum in CartService::getPrice`, `fix(cart): correct carts table name in migration`, `fix(favorites): use proper PHP open tag in FavoriteService` — each fix commit message names the *exact* defect, not a vague "bug fixes". This traceability is what makes the history usable as a design record, not just a log.

### 6.4 Test commits are grouped by scenario, not by file
Within one feature, tests land as multiple commits (`add feature tests for ADD TO CART operations`, then `... UPDATE CART operations`, then `... DELETE CART operations`, then `... preventing users from modifying others carts`) rather than one giant `test(cart): add tests` commit. This mirrors how the feature itself was built in layers, and means a reviewer can see *which* scenario class was being hardened at each step.

### 6.5 Documentation commits precede, and sometimes follow, implementation
Design docs (`docs(<feature>): add ... diagrams`) always come first. A second class of doc commit — `docs(<feature>): document missing requirements discovered during implementation` — comes **after** implementation, and exists specifically to record the delta between what was designed and what was actually found in the schema/business rules. **Both are required; neither replaces the other.**

### 6.6 Refactor commits are rare and horizontal only
`refactor` is used exactly once across the whole history, for a change that touched every controller for the same reason (adopting `ApiResponse`). Refactors are not used for local cleanup inside a single feature — local cleanup happens as part of the `feat`/`fix` commit that touches that code anyway.

### 6.7 Old code is not silently deleted during a shape change — track transitions explicitly
When `CartController` was refactored to use `ApiResponse`, the previous `response()->json([...])` blocks were **commented out and kept in place** under `// Before ApiResponse Integration` / `// After ApiResponse Integration` markers, rather than deleted outright in the same commit. **For future projects, prefer deleting old code immediately and relying on git history for the "before" version** — this repo's approach is acceptable for a learning/portfolio codebase where the diff itself is a teaching artifact, but it violates the general "no dead comments" rule and should not be treated as a house style to repeat in production codebases. Do note the underlying discipline this pattern reveals: **the person always double-checked they hadn't lost the old behavior before removing it** — replicate the discipline, not the commented-out code.

---

## 7. Testing Methodology

### 7.1 Stack
Pest is the installed runner (`pestphp/pest`, `pestphp/pest-plugin-laravel`), but tests are written as **PHPUnit-style classes** extending `Tests\TestCase`, with `/** @test */`-annotated `public function test_...(): void` methods — not Pest's functional `it()/test()` syntax. `Tests\TestCase` applies `RefreshDatabase` globally via the base class (not via `Pest.php`'s `->use()` chain, which is left commented out). **Rule: pick one test-authoring style (functional Pest or PHPUnit-class) and apply it project-wide — this repo is consistently PHPUnit-class style despite running on Pest.**

### 7.2 Structure
- One test class per feature, mirroring the controller namespace: `tests/Feature/Api/Cart/CartTest.php`, `tests/Feature/Api/Admin/CategoryTest.php`.
- `// ======= Helpers =======` banner at the top of the class holds **private, file-local** fixture builders (`createCustomer()`, `createMenuItem(array $prices = [])`) — reused only within that file, not extracted into a shared trait unless duplicated across many files.
- Tests below the helpers are grouped under `// === GET CART TESTS ===`, `// === ADD TO CART TESTS ===`, `// === UPDATE CART TESTS ===`, `// === DELETE TESTS ===` — one banner per HTTP-action/scenario group, matching the commit-grouping in §6.4.

### 7.3 What every feature's test suite must cover
1. **Happy path** for every endpoint.
2. **Computed-value correctness** (e.g. cart totals/subtotals math), asserted with exact expected numbers, not just "not null".
3. **Business-rule edge cases** discovered from the design docs (duplicate add increments instead of duplicating a row; different size creates a new row; unavailable size rejected with 422; quantity 0 removes the row).
4. **Cross-user isolation** — always present, always last in the file: one user must never see, modify, or delete another user's data. Asserted as a 404 (not found in *their* scope) rather than a 403 (forbidden) when ownership is enforced via scoped queries — this reflects that the resource "doesn't exist" from that user's point of view, which is a deliberate information-hiding choice, not an oversight.
5. **Authentication/authorization gating** for anything behind `auth:api`/`role:...`.

### 7.4 When tests are written relative to code
Tests are written **after** the controller/route exists for that specific scenario group, and are used as the mechanism that *surfaces* bugs — several `fix:` commits exist specifically because a test written immediately after an endpoint caught a real defect (enum comparison, query-builder vs model-instance update). **Tests are a bug-finding tool exercised continuously during the feature loop, not a coverage checkbox added at the very end.**

### 7.5 Assertions style
Prefer `assertJsonStructure` for shape, `assertJson` with exact expected values for computed business data (money totals, counts), and `assertDatabaseHas`/`assertDatabaseMissing` for state changes — never asserting only the HTTP status code alone when a state change is being tested.

---

## 8. Security Hardening Workflow

Executed as Phase 5, in this exact dependency order (build the tool before the consumer, always):

1. **Response envelope first** (`ApiResponse`) — nothing else can be consistent until the shape of "success" and "error" is fixed.
2. **Exception handler second**, built directly on top of the envelope helper — translates *every* framework/domain exception type into that envelope.
3. **Rate limiting third** — orthogonal to the envelope/handler, but sequenced after them so that a 429 response can also be normalized through the same envelope.
4. **Wire the handler into the framework's active exception pipeline as its own commit** — writing a class and activating it are two separate, separately-verifiable actions.
5. **Test the handler and the throttles** — with dedicated test files (`ExceptionHandlerTest`, `RateLimitTest`), proving every branch of the priority order in §5.15.
6. **Retrofit the helper's API** based on real call-site needs discovered during the horizontal refactor (e.g. `extra` merge parameter needed once a controller had to return `action` alongside `status`/`message`).
7. **Refactor every controller onto the helper in one commit.**
8. **Update tests to match the new global shape** immediately after the refactor, in the same breath — never leave tests red against the new shape.
9. **Sweep for edge cases** (`Accept` header content negotiation) as the final, narrowest commit.

**Non-negotiables extracted from this phase for future projects:**
- Production error responses never include `file`/`line`/raw exception `message` — gated by `app()->environment('production')`.
- Every `api/*` request gets a JSON response for every failure mode, including 404 on unmatched routes and 429 on throttling — never let a non-API route's error page render (Blade/HTML) leak through under `/api/*`.
- Password fields (`current_password`, `password`, `password_confirmation`) are explicitly excluded from exception flashing via `$dontFlash` — set at Phase 5 but should really be set at Phase 0/3 by default in future projects, since the risk exists from the first login form onward.
- Rate limits are tuned per route-sensitivity group, not applied as one blanket global throttle.

---

## 9. Coding Standards

### 9.1 PHP/Laravel conventions
- PHP 8.3, constructor property promotion with `private readonly` for injected dependencies.
- Method return types are always declared (`: JsonResponse`, `: array`, `: bool`, `: void`).
- `casts()` as a method (Laravel 11+ style), not the legacy `$casts` array property.
- Enums are `enum X: string` (backed), never pure/unbacked, so they always have a serializable `.value`.

### 9.2 Formatting & static analysis
- `rector.php` + Pint are both configured and run together via `composer format` (`rector` then `pint`, in that order — structural refactors before style formatting).
- `.editorconfig` present to keep whitespace/indentation consistent across editors from day one (Phase 0).

### 9.3 Comment conventions
- `// ======= Section Name =======` banners divide logical sections within any file that has more than one responsibility (services, helpers, tests, route files).
- HTTP-verb + path comments (`// GET /api/cart`) directly above every controller action, functioning as inline route docs.
- Inline comments explaining *why*, not *what* — e.g. "`← Scoped Query: بندور في cart الـ user بس مش في كل الـ cart`" next to a `where('user_id', ...)` clause explains the security property the query provides, not what the query syntactically does.
- **Bilingual commenting observed** (English section banners + Arabic inline rationale comments) — a personal-style choice; future projects should pick a single comment language deliberately for team-readability rather than mixing, unless the team itself is bilingual by design.

### 9.4 Naming
- Domain sub-namespaces under `Http/Controllers/Api/`, `Http/Requests/`, `Http/Resources/` mirror each other exactly per feature (`Cart/`, `Favorite/`, `Admin/`, `Order/`, `Profile/`, `Auth/`, `Staff/`, `Menu/`) — a controller in `Api/Cart/` always has a matching `Requests/Cart/` and, where needed, `Resources/Cart/` (or a shared `Menu`/`Admin` resource namespace when resources are reused across a controller group).
- Verb-specific request names: `AddToCartRequest`, `UpdateCartRequest` — never a shared `CartRequest` with conditional logic.
- Service class names always end in `Service` and are named for the bounded feature, not the model (`StaffOrderService` for staff-facing order operations, distinct from `OrderService` for customer-facing ones, even though both touch `Order`).

### 9.5 Known inconsistency to fix going forward
The `app/services` folder is lowercase on disk while the PSR-4 namespace is `App\Services` — works only due to case-insensitive filesystems in local dev. **Any new project must keep folder casing byte-identical to namespace casing.**

---

## 10. Definition of Done

A unit of work (feature, fix, or hardening pass) is **not done** until:

- [ ] Design intent is captured in `docs/` (diagrams for features; nothing skips design).
- [ ] Every new/changed input path has a `FormRequest` with explicit rules and messages.
- [ ] Business logic lives in a `Service`, is unit-testable independent of HTTP, and returns explicit success/failure structures rather than throwing for expected alternate outcomes.
- [ ] Output shape is defined by a `Resource` or an explicit array — never a raw model/collection returned to the client.
- [ ] Routes carry the middleware stack appropriate to their sensitivity (`auth:api`, `role:...`, `throttle:...`).
- [ ] Cross-user isolation is tested for every mutating/ownership-scoped endpoint.
- [ ] Computed values (totals, counts, statuses) are asserted with exact expected results, not just "success".
- [ ] Every discovered gap between design and implementation is written down, not just silently patched.
- [ ] All responses (success and error) conform to the single global envelope once Phase 5 exists in the project.
- [ ] `composer format` (Rector → Pint) and `composer test` both pass clean before the work is considered merge-ready.

---

## 11. Non-Negotiable Rules

1. **Design artifact before code.** No feature's first commit is a `feat:` commit — it is always preceded by a `docs:` commit for that same scope.
2. **Schema and models are laid out completely before any endpoint is built.** Domain foundation is one phase, not incremental-per-feature.
3. **Auth exists before any feature that requires it, and rate-limits credential endpoints from the moment it exists.**
4. **Controllers do not contain business logic.** Any `if` that decides a business outcome (not just an HTTP branch) belongs in a Service.
5. **Ownership is enforced by query scoping (`$user->relation()->where(...)`), never by fetch-then-check-then-trust.**
6. **Enums, not raw strings, for every finite domain vocabulary — and always compared as enums, never as strings, anywhere past the request-validation boundary.**
7. **Every foreign key declares an explicit delete behavior at migration time.** No default-behavior FKs.
8. **Every model ships with a complete factory in the same unit of work that creates the model** — an empty/partial factory is a defect, not deferred work.
9. **One global response envelope and one global exception handler for the whole API**, built once, adopted everywhere, never re-invented per controller.
10. **Global hardening (response shape, exception handling, non-auth rate limiting) is a dedicated, final, horizontal phase** — it is not distributed piecemeal across feature commits, except for auth-endpoint throttling, which is intentionally immediate.
11. **Fix commits name the exact defect.** Vague fix messages are not acceptable.
12. **Tests are written in scenario groups during the feature loop, not bulk-added at the end**, and always include a cross-user-isolation case.
13. **Production error responses never leak stack traces, file paths, or raw exception messages.**
14. **Folder casing on disk must exactly match namespace casing** — do not rely on case-insensitive filesystems.
15. **Do not leave two competing authorization mechanisms (Policies + scoped-queries/middleware) half-implemented.** Choose one per project and apply it consistently.

---

## 12. Future Project Execution Protocol

When starting a new project (or a new bounded feature within an existing one built on this playbook), execute in this exact order:

### Step 1 — Bootstrap
Install framework + toolchain (test runner, formatter, static analysis) in one setup pass. Confirm `test` and `format` scripts run clean on the empty skeleton.

### Step 2 — System Design
Produce (or request from the user) an ERD and a high-level architecture diagram before writing any migration. Treat these as the contract for Step 3.

### Step 3 — Domain Foundation
In one batch: migrations (with explicit FK delete behavior), models (with typed relationships, `casts()`, `$fillable`), enums for every finite vocabulary, factories for every model (complete, not stubbed), and policy scaffolds if Policies are the chosen authorization mechanism for this project (decide explicitly — see Rule 15).

### Step 4 — Auth Foundation
Build auth end-to-end (register/login/refresh/logout/me + guard + role vocabulary) and rate-limit the credential endpoints immediately. Write tests before moving on.

### Step 5 — Feature Loop (repeat per feature, in dependency order)
For each feature:
1. Write/request design docs for this feature's endpoints and flows.
2. `FormRequest`s for every input.
3. `Service` with pure business logic (+ async `Job`s immediately after, if the feature has side effects).
4. `Resource`s for every distinct output shape.
5. Thin `Controller` wiring request → service → resource.
6. Routes with the sensitivity-appropriate middleware stack.
7. Fix any defect found immediately, in its own narrowly-scoped commit.
8. Tests in scenario groups: happy path → business-rule edges → cross-user isolation.
9. Record any design/implementation gap explicitly.
Do not start the next feature's design doc until this feature's tests are in.

### Step 6 — Security & Quality (horizontal pass, once ALL features are functionally complete)
1. Build a single response-envelope helper.
2. Build a single exception handler on top of it, with a fixed exception-priority order and environment-gated verbosity.
3. Tune rate limits per route-sensitivity group for every remaining unthrottled route.
4. Wire the handler into the framework's active pipeline as its own verifiable step.
5. Test the handler and throttles directly.
6. Refactor every controller onto the envelope helper in one commit; update tests in the same breath.
7. Sweep for edge cases (content negotiation, header handling) as the final, narrowest commit of the phase.

### Step 7 — Definition of Done Check
Run the full checklist in §10 before declaring the project (or feature) complete. Do not skip cross-user isolation tests or the production-error-leak check — these are the two most consequential omissions possible given this codebase's own history.

### Step 8 — Retrospective Corrections
Apply the fixes this playbook flags as "known inconsistencies to avoid repeating" (§5.7 folder-casing, §5.13 middleware bypassing the response helper, §6.7 dead code retention) **from the start** in new projects, rather than discovering them the same way this repository did.
