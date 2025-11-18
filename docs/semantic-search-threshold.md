# Semantic Search Confidence Threshold

This repo now gates semantic search results behind a normalized `confidence` score so gibberish queries don’t always return a hit. Both admin and storefront endpoints accept an optional `min_confidence` (0–1); if omitted, we fall back to `SEMANTIC_SEARCH_MIN_CONFIDENCE` from the environment (default `0.3`).

## How confidence is computed
- Vector score comes from Elasticsearch `cosineSimilarity + 1`, which is in `[0, 2]` and is normalized by dividing by 2.
- BM25 score is normalized per-query by dividing by the best BM25 score in that result set.
- Hybrid confidence is a weighted average of normalized vector and BM25 scores, reweighted to ignore the missing side if only one is present.
- Hits are filtered out if `confidence < min_confidence`; the API can return zero hits.

## What higher vs lower thresholds mean
- `min_confidence` closer to **1**: very strict. Only high-signal matches pass; gibberish and loose/typoed queries often return zero results. Useful to avoid irrelevant suggestions but may hide relevant long-tail matches.
- `min_confidence` closer to **0**: very lenient. Almost anything passes; gibberish still returns the top-ranked item. Useful for debugging and broad recall but risks noisy results.
- A mid value (e.g., **0.25–0.4**) is a practical starting point: filters obvious nonsense while keeping mildly off queries.

## Usage
- Admin: `POST /admin/embeddings/search` with body `{ query, min_confidence?: number, ... }`.
- Storefront: `POST /store/embeddings/search` with body `{ query, min_confidence?: number, ... }`.
- Env default: set `SEMANTIC_SEARCH_MIN_CONFIDENCE` (0–1) in `.env` to change the baseline without code changes.

## Tuning tips
- Sample real queries (clean, typos, and gibberish) and log top `confidence` values.
- Raise the threshold if irrelevant hits appear; lower it if relevant edge cases are being filtered out.
