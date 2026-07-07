"""
train.py — run once to build and save the recommendation model.

Usage:
    python train.py                      # uses netflix1.csv in current dir
    python train.py --data path/to.csv  # custom CSV path
    python train.py --output model.pkl  # custom output path

Output:
    model.pkl  — serialized dict containing the fitted vectorizer,
                 cosine similarity matrix, and cleaned DataFrame.
"""

import argparse
import pickle
import time
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


# ── Config ────────────────────────────────────────────────────────────────────

DEFAULT_CSV    = "netflix1.csv"
DEFAULT_OUTPUT = "model.pkl"

FILL_EMPTY = {
    "director" : "",
    "country"  : "",
    "listed_in": "",
    "rating"   : "",
    "type"     : "",
    "title"    : "",
}


# ── Feature engineering ───────────────────────────────────────────────────────

def build_soup(row: pd.Series) -> str:
    """
    Combine key columns into one text string per title.
    - listed_in (genres) is repeated twice to up-weight it in TF-IDF.
    - Multi-word proper nouns (director, country) are joined with '_'
      so they're treated as a single token.
    """
    genres   = row["listed_in"].replace(",", " ").replace("&", "")
    director = row["director"].replace(" ", "_")
    country  = row["country"].split(",")[0].strip().replace(" ", "_")
    c_type   = row["type"].replace(" ", "_")
    rating   = row["rating"]
    return f"{genres} {genres} {director} {country} {c_type} {rating}"


# ── Pipeline ──────────────────────────────────────────────────────────────────

def load_and_clean(csv_path: str) -> pd.DataFrame:
    df = pd.read_csv(csv_path)
    df = df.fillna(FILL_EMPTY)
    df["title_lower"] = df["title"].str.lower().str.strip()
    df = df.drop_duplicates(subset="title_lower").reset_index(drop=True)
    print(f"  Loaded {len(df):,} titles from '{csv_path}'")
    return df


def fit_model(df: pd.DataFrame):
    print("  Building feature soup …")
    df["soup"] = df.apply(build_soup, axis=1)

    print("  Fitting TF-IDF vectorizer …")
    vectorizer  = TfidfVectorizer(stop_words="english")
    tfidf_matrix = vectorizer.fit_transform(df["soup"])
    print(f"    → matrix shape: {tfidf_matrix.shape}")

    print("  Computing cosine similarity matrix …")
    cosine_sim = cosine_similarity(tfidf_matrix, tfidf_matrix)
    print(f"    → similarity shape: {cosine_sim.shape}")

    return vectorizer, tfidf_matrix, cosine_sim


def save_model(df, vectorizer, tfidf_matrix, cosine_sim, output_path: str):
    payload = {
        "df"           : df[["title", "title_lower", "type", "listed_in",
                              "rating", "country", "release_year", "director"]],
        "vectorizer"   : vectorizer,
        "tfidf_matrix" : tfidf_matrix,
        "cosine_sim"   : cosine_sim,
    }
    with open(output_path, "wb") as f:
        pickle.dump(payload, f, protocol=pickle.HIGHEST_PROTOCOL)

    size_mb = Path(output_path).stat().st_size / (1024 ** 2)
    print(f"  Saved model to '{output_path}' ({size_mb:.1f} MB)")


# ── Entry point ───────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Train the Netflix recommender model.")
    parser.add_argument("--data",   default=DEFAULT_CSV,    help="Path to netflix CSV")
    parser.add_argument("--output", default=DEFAULT_OUTPUT, help="Output .pkl path")
    args = parser.parse_args()

    t0 = time.time()
    print("\n── Netflix Recommender — Training ──────────────────────")

    df = load_and_clean(args.data)
    vectorizer, tfidf_matrix, cosine_sim = fit_model(df)
    save_model(df, vectorizer, tfidf_matrix, cosine_sim, args.output)

    print(f"\n  Done in {time.time() - t0:.1f}s")
    print("────────────────────────────────────────────────────────\n")


if __name__ == "__main__":
    main()
