# Netflix Recommender — API Contract

Hand this to your backend friend. These are the three endpoints the
RecommenderService exposes, plus the auth endpoints they need to build.

---

## Setup (FastAPI)

```python
# main.py
from contextlib import asynccontextmanager
from fastapi import FastAPI
from recommender_service import RecommenderService

rec_service: RecommenderService = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global rec_service
    rec_service = RecommenderService("model.pkl")  # loads once at startup
    yield

app = FastAPI(lifespan=lifespan)
```

---

## Recommender endpoints  (your ML code, wrapped by backend)

### GET /api/search?q={query}&limit={limit}
Autocomplete — returns titles matching a partial string.

**Query params**
| param | type | default | notes |
|-------|------|---------|-------|
| q     | str  | —       | min 2 chars |
| limit | int  | 12      | max 20 |

**Response 200**
```json
{
  "results": [
    { "title": "Stranger Things", "type": "TV Show", "release_year": 2016 },
    { "title": "Stray", "type": "Movie", "release_year": 2021 }
  ]
}
```

**Response 422** — q shorter than 2 chars

---

### GET /api/titles/{title}
Full metadata for a single title.

**Path param** — title (URL-encoded, e.g. `The%20Crown`)

**Response 200**
```json
{
  "title": "The Crown",
  "type": "TV Show",
  "genres": "British TV Shows, International TV Shows, TV Dramas",
  "rating": "TV-MA",
  "country": "United Kingdom",
  "release_year": 2020,
  "director": "Not Given"
}
```

**Response 404**
```json
{ "detail": "Title not found" }
```

---

### GET /api/recommend/{title}?n={n}
Top-n recommendations for a title.

**Path param** — title (URL-encoded)

**Query params**
| param | type | default | notes |
|-------|------|---------|-------|
| n     | int  | 10      | 1–50 |

**Response 200**
```json
{
  "query": "Stranger Things",
  "matched_title": "Stranger Things",
  "total": 10,
  "results": [
    {
      "rank": 1,
      "title": "Nightflyers",
      "type": "TV Show",
      "genres": "TV Horror, TV Mysteries, TV Sci-Fi & Fantasy",
      "rating": "TV-MA",
      "country": "United States",
      "release_year": 2018,
      "director": "",
      "similarity": 0.9901
    }
  ]
}
```

**Response 404**
```json
{ "detail": "No title matching '...' found" }
```

---

## Auth endpoints  (backend builds these)

### POST /api/auth/register
```json
// Request
{ "email": "user@example.com", "password": "••••••••" }

// Response 201
{ "id": "uuid", "email": "user@example.com", "created_at": "ISO8601" }

// Response 409
{ "detail": "Email already registered" }
```

### POST /api/auth/login
```json
// Request
{ "email": "user@example.com", "password": "••••••••" }

// Response 200
{ "access_token": "eyJ...", "token_type": "bearer" }

// Response 401
{ "detail": "Invalid credentials" }
```

---

## User endpoints  (backend builds these, JWT required)

All require header: `Authorization: Bearer <token>`

### GET /api/user/history
Returns the user's recent searches/views.
```json
{ "history": [ { "title": "Inception", "viewed_at": "ISO8601" } ] }
```

### POST /api/user/history
```json
// Request
{ "title": "Inception" }
// Response 201 — { "ok": true }
```

### GET /api/user/favorites
```json
{ "favorites": [ { "title": "Inception", "added_at": "ISO8601" } ] }
```

### POST /api/user/favorites
```json
// Request
{ "title": "Inception" }
// Response 201 — { "ok": true }
// Response 409 — already in favorites
```

### DELETE /api/user/favorites/{title}
```json
// Response 200 — { "ok": true }
// Response 404 — not in favorites
```

---

## Database schema (PostgreSQL)

```sql
CREATE TABLE users (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email        TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE watch_history (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
    title      TEXT NOT NULL,
    viewed_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE favorites (
    id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id  UUID REFERENCES users(id) ON DELETE CASCADE,
    title    TEXT NOT NULL,
    added_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, title)
);
```

---

## Error format (all endpoints)

```json
{ "detail": "Human-readable error message" }
```

HTTP codes used: 200, 201, 400, 401, 404, 409, 422, 500
