"""
Netflix Content-Based Recommendation System
Model: TF-IDF + Cosine Similarity
Dataset: netflix1.csv
"""

import pandas as pd
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import warnings
warnings.filterwarnings('ignore')


# ── 1. Load & clean data ─────────────────────────────────────────────────────

df = pd.read_csv(r"D:\studying\Machine learning course\projects\netflix_recomm\netflix1.csv")

df['director']  = df['director'].fillna('')
df['country']   = df['country'].fillna('')
df['listed_in'] = df['listed_in'].fillna('')
df['rating']    = df['rating'].fillna('')
df['type']      = df['type'].fillna('')


# ── 2. Feature engineering ───────────────────────────────────────────────────

def create_soup(row):
    """
    Combine key columns into a single text string per title.
    Genres are repeated twice to increase their weight in TF-IDF.
    Director name is joined without spaces so it's treated as one token.
    """
    genres       = row['listed_in'].replace(',', ' ').replace('&', '')
    director     = row['director'].replace(' ', '_')          # "John Doe" → "John_Doe"
    country      = row['country'].split(',')[0].strip().replace(' ', '_')
    content_type = row['type'].replace(' ', '_')
    rating       = row['rating']

    return f"{genres} {genres} {director} {country} {content_type} {rating}"

df['soup'] = df.apply(create_soup, axis=1)


# ── 3. Build TF-IDF matrix ───────────────────────────────────────────────────

tfidf        = TfidfVectorizer(stop_words='english')
tfidf_matrix = tfidf.fit_transform(df['soup'])

print(f"TF-IDF matrix: {tfidf_matrix.shape[0]} titles × {tfidf_matrix.shape[1]} terms")


# ── 4. Compute cosine similarity ─────────────────────────────────────────────

cosine_sim = cosine_similarity(tfidf_matrix, tfidf_matrix)

print(f"Similarity matrix: {cosine_sim.shape}")


# ── 5. Title → index lookup ──────────────────────────────────────────────────

indices = pd.Series(df.index, index=df['title'].str.lower()).drop_duplicates()


# ── 6. Recommendation function ───────────────────────────────────────────────

def get_recommendations(title: str, n: int = 10) -> pd.DataFrame:
    """
    Return the top-n most similar Netflix titles.

    Parameters
    ----------
    title : str   Title to look up (case-insensitive, partial match supported).
    n     : int   Number of recommendations to return (default 10).

    Returns
    -------
    pd.DataFrame  Ranked recommendations with similarity scores.
    """
    title_lower = title.lower().strip()

    # Exact match first, then partial
    if title_lower not in indices:
        matches = [t for t in indices.index if title_lower in t]
        if not matches:
            print(f"  ✗  '{title}' not found. Try a different spelling.")
            return pd.DataFrame()
        title_lower = matches[0]
        print(f"  ➜  Matched to: '{df.loc[indices[title_lower], 'title']}'")

    idx        = indices[title_lower]
    sim_scores = sorted(enumerate(cosine_sim[idx]), key=lambda x: x[1], reverse=True)
    sim_scores = sim_scores[1 : n + 1]          # exclude the title itself

    rec_indices = [i for i, _ in sim_scores]
    rec_scores  = [round(s, 4) for _, s in sim_scores]

    result = df.iloc[rec_indices][
        ['title', 'type', 'listed_in', 'rating', 'country', 'release_year']
    ].copy()
    result.insert(0, 'rank', range(1, len(result) + 1))
    result['similarity'] = rec_scores

    return result.reset_index(drop=True)


# ── 7. Demo ───────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    demo_titles = ['Stranger Things', 'Inception', 'The Crown', 'Narcos']

    for title in demo_titles:
        print(f"\n{'─'*60}")
        print(f"  Recommendations for: {title}")
        print(f"{'─'*60}")
        recs = get_recommendations(title, n=5)
        if not recs.empty:
            print(recs.to_string(index=False))

    # ── Interactive prompt (optional) ─────────────────────────────────────────
    print("\n" + "═"*60)
    print("  Interactive mode — press Ctrl+C to exit")
    print("═"*60)
    while True:
        try:
            query = input("\n  Enter a title: ").strip()
            if not query:
                continue
            n = input("  How many recommendations? [10]: ").strip()
            n = int(n) if n.isdigit() else 10
            recs = get_recommendations(query, n=n)
            if not recs.empty:
                print()
                print(recs.to_string(index=False))
        except KeyboardInterrupt:
            print("\n  Bye!")
            break
