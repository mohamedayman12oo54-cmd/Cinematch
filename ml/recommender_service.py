"""
recommender_service.py — production-ready recommender service.

Your backend friend imports this into FastAPI like so:

    from recommender_service import RecommenderService

    rec_service = RecommenderService("model.pkl")   # loads once at startup

    @app.get("/api/recommend/{title}")
    def recommend(title: str, n: int = 10):
        return rec_service.get_recommendations(title, n)
"""
import pickle
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
from sklearn.metrics.pairwise import cosine_similarity


# ── Data shapes ───────────────────────────────────────────────────────────────

@dataclass
class RecommendationItem:
    rank        : int
    title       : str
    type        : str
    genres      : str
    rating      : str
    country     : str
    release_year: int
    director    : str
    similarity  : float

    def to_dict(self) -> dict:
        return {
            "rank"        : self.rank,
            "title"       : self.title,
            "type"        : self.type,
            "genres"      : self.genres,
            "rating"      : self.rating,
            "country"     : self.country,
            "release_year": self.release_year,
            "director"    : self.director,
            "similarity"  : self.similarity,
        }


@dataclass
class RecommendationResponse:
    query        : str          # the title that was looked up
    matched_title: str          # actual title matched (may differ if partial match)
    total        : int
    results      : list[RecommendationItem]

    def to_dict(self) -> dict:
        return {
            "query"        : self.query,
            "matched_title": self.matched_title,
            "total"        : self.total,
            "results"      : [r.to_dict() for r in self.results],
        }


# ── Service ───────────────────────────────────────────────────────────────────

class RecommenderService:
    """
    Loads a pre-trained model from disk and serves recommendations.
    Designed to be instantiated once at application startup.

    Parameters
    ----------
    model_path : str
        Path to the .pkl file produced by train.py.

    Raises
    ------
    FileNotFoundError
        If model_path does not exist.
    ValueError
        If the .pkl file is missing expected keys.
    """

    REQUIRED_KEYS = {"df", "vectorizer", "tfidf_matrix", "cosine_sim"}

    def init(self, model_path: str = "model.pkl"):
        path = Path(model_path)
        if not path.exists():
            raise FileNotFoundError(
                f"Model file not found: '{model_path}'. "
                "Run train.py first to generate it."
            )

        print(f"[RecommenderService] Loading model from '{model_path}' …")
        with open(path, "rb") as f:
            payload = pickle.load(f)

        missing = self.REQUIRED_KEYS - set(payload.keys())
        if missing:
            raise ValueError(f"Model file is missing keys: {missing}")

        self._df         : pd.DataFrame = payload["df"]
        self._cosine_sim : np.ndarray   = payload["cosine_sim"]

        # Title → DataFrame index lookup (lowercase, stripped)
        self._index = pd.Series(
            self._df.index,
            index=self._df["title_lower"]
        ).drop_duplicates()

        print(f"[RecommenderService] Ready — {len(self._df):,} titles indexed.")

    # ── Public API ────────────────────────────────────────────────────────────

    def get_recommendations(
        self,
        title: str,
        n    : int = 10,
    ) -> RecommendationResponse:
        """
        Return the top-n most similar titles.

        Parameters
        ----------
        title : str   Title to look up (case-insensitive, partial match supported).
        n     : int   Number of results (1–50, clamped internally).

        Returns
        -------
        RecommendationResponse
            Call .to_dict() to get a JSON-serialisable dict.

        Raises
        ------
        ValueError
            If no matching title is found.
        """
        n = max(1, min(n, 50))
        title_lower   = title.lower().strip()
        matched_lower = self._resolve_title(title_lower)

        if matched_lower is None:
            raise ValueError(f"No title matching '{title}' found in the dataset.")

        idx        = self._index[matched_lower]
        sim_scores = sorted(
            enumerate(self._cosine_sim[idx]),
            key=lambda x: x[1],
            reverse=True,
        )
        sim_scores = sim_scores[1 : n + 1]   # skip the title itself

        results = []
        for rank, (rec_idx, score) in enumerate(sim_scores, start=1):
            row = self._df.iloc[rec_idx]
            results.append(RecommendationItem(
                rank        = rank,
                title       = row["title"],
                type        = row["type"],
                genres      = row["listed_in"],
                rating      = row["rating"],
                country     = row["country"],
                release_year= int(row["release_year"]),
                director    = row["director"],
                similarity  = round(float(score), 4),
            ))

        matched_title = self._df.iloc[self._index[matched_lower]]["title"]

        return RecommendationResponse(
            query        = title,
            matched_title= matched_title,
            total        = len(results),
            results      = results,
        )

    def search_titles(self, query: str, limit: int = 12) -> list[dict]:
        """
        Autocomplete — return titles that match a partial query string.

        Parameters
        ----------
        query : str   Partial title string (min 2 chars).
        limit : int   Max results to return (default 12).

        Returns
        -------
        list[dict]    Each dict: { title, type, release_year }
        """
        if len(query) < 2:
            return []

        ql      = query.lower().strip()
        exact   = []
        starts  = []
        contains= []

        for t_lower in self._index.index:
            if t_lower == ql:
                exact.append(t_lower)
            elif t_lower.startswith(ql):
                starts.append(t_lower)
            elif ql in t_lower:
                contains.append(t_lower)
            if len(exact) + len(starts) + len(contains) >= limit * 3:
                break

        matched = (exact + starts + contains)[:limit]

        results = []
        for t_lower in matched:
            row = self._df.iloc[self._index[t_lower]]
            results.append({
                "title"       : row["title"],
                "type"        : row["type"],
                "release_year": int(row["release_year"]),
            })

        return results

    def get_title_detail(self, title: str) -> Optional[dict]:
        """
        Return full metadata for a single title, or None if not found.
        """
        title_lower   = title.lower().strip()
        matched_lower = self._resolve_title(title_lower)
        if matched_lower is None:
            return None

        row = self._df.iloc[self._index[matched_lower]]
        return {
            "title"       : row["title"],
            "type"        : row["type"],
            "genres"      : row["listed_in"],
            "rating"      : row["rating"],
            "country"     : row["country"],
            "release_year": int(row["release_year"]),
            "director"    : row["director"],
        }

    # ── Internal helpers ──────────────────────────────────────────────────────

    def resolvetitle(self, title_lower: str) -> Optional[str]:
        """
        Exact match → partial match → None.
        """
        if title_lower in self._index:
            return title_lower

        matches = [t for t in self._index.index if title_lower in t]
        return matches[0] if matches else None
