"""
main.py — FastAPI wrapper for the Netflix Recommender Service.

Startup:
    uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4

Environment variables (optional):
    MODEL_PATH   path to model.pkl  (default: ./model.pkl)
    ML_ENV       "development" | "production"  (default: development)

Endpoints exposed to the backend:
    GET /api/search?q={query}&limit={n}
    GET /api/titles/{title}
    GET /api/recommend/{title}?n={n}
    GET /health
"""

import os
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from recommender_service import RecommenderService


# ── Globals ───────────────────────────────────────────────────────────────────

MODEL_PATH   = os.getenv("MODEL_PATH", "model.pkl")
rec_service: Optional[RecommenderService] = None


# ── Lifespan — load model once at startup ─────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    global rec_service
    print(f"[startup] Loading model from '{MODEL_PATH}' …")
    rec_service = RecommenderService(MODEL_PATH)
    print("[startup] Model ready — API is live.")
    yield
    print("[shutdown] Shutting down.")


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title       = "CineMatch Recommender API",
    description = "Content-based Netflix title recommendation service. "
                  "TF-IDF + Cosine Similarity over 8,781 titles.",
    version     = "1.0.0",
    lifespan    = lifespan,
)

# Allow the backend (Laravel/FastAPI) to call this service
app.add_middleware(
    CORSMiddleware,
    allow_origins = ["*"],   # tighten this in production to your backend's domain
    allow_methods = ["GET"],
    allow_headers = ["*"],
)


# ── Health check ──────────────────────────────────────────────────────────────

@app.get("/health", tags=["health"])
def health():
    """
    Used by the backend to confirm the ML service is alive.
    Returns 200 when model is loaded, 503 before startup completes.
    """
    if rec_service is None:
        raise HTTPException(status_code=503, detail="Model not yet loaded.")
    return {
        "status" : "ok",
        "titles" : len(rec_service._df),
    }


# ── Endpoint A: Autocomplete search ──────────────────────────────────────────

@app.get("/api/search", tags=["search"])
def search(
    q     : str = Query(..., min_length=2, description="Partial title to autocomplete"),
    limit : int = Query(12, ge=1, le=20,  description="Max results (1–20)"),
):
    """
    GET /api/search?q=Break&limit=12

    Returns a list of titles matching the query string.
    Used by the frontend autocomplete input.

    Response shape (per search-discovery.md):
        { "results": [ { "title", "type", "release_year" }, ... ] }
    """
    results = rec_service.search_titles(query=q, limit=limit)
    return {"results": results}


# ── Endpoint B: Title detail ──────────────────────────────────────────────────

@app.get("/api/titles/{title}", tags=["titles"])
def title_detail(title: str):
    """
    GET /api/titles/Breaking Bad

    Returns full metadata for a single title.
    Used by Favorites, Watched Titles, and Search & Discovery features.

    Response shape (per favorites.md / watched-titles.md / search-discovery.md):
        {
            "title", "type", "genres", "rating",
            "country", "release_year", "director"
        }

    Returns 404 if the title is not found — never 200 with empty body.
    """
    detail = rec_service.get_title_detail(title)
    if detail is None:
        raise HTTPException(status_code=404, detail="Title not found")
    return detail


# ── Endpoint C: Recommendations ───────────────────────────────────────────────

@app.get("/api/recommend/{title}", tags=["recommendations"])
def recommend(
    title : str,
    n     : int = Query(10, ge=1, le=50, description="Number of recommendations (1–50)"),
):
    """
    GET /api/recommend/Breaking Bad?n=10

    Returns the top-n most similar titles to the given seed title.
    Used by Search & Discovery and the Home page personalization engine.

    Response shape (per search-discovery.md / home.md):
        {
            "query"        : str,
            "matched_title": str,
            "total"        : int,
            "results"      : [
                {
                    "rank", "title", "type", "genres",
                    "rating", "country", "release_year",
                    "director", "similarity"
                },
                ...
            ]
        }

    Returns 404 if the seed title is not found.
    Returns 200 with results:[] if the title exists but has no similar titles.
    """
    try:
        response = rec_service.get_recommendations(title, n=n)
        return response.to_dict()
    except ValueError:
        raise HTTPException(status_code=404, detail="Title not found")
