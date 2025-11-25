# Embedding model comparison (python-embedder)

Quick guide to the three-way embedding comparison (384d local, 768d local, optional 1536d OpenAI) and how to run it inside the `python-embedder` Docker service.

## What it does
- `/embed`: same as before, uses the default 768d local model for single embedding requests.
- `/eval-summary`: runs a lightweight evaluation over mock product pairs and returns JSON per model:
  - Semantic quality (avg similar vs dissimilar cosine distances and the gap).
  - Latency stats (avg/median per embed call).
  - A combined score (70% quality, 30% latency).
  - Local 384d and 768d always run; OpenAI 1536d is included when `OPENAI_API_KEY` is set.
- Pytest suite mirrors the evaluation logic:
  - Local models always tested.
  - OpenAI is skipped if no API key or `openai` package is unavailable.

## Environment variables
- `OPENAI_API_KEY` (optional): enables the 1536d OpenAI model in tests and `/eval-summary`.

### Using a `.env` file
- Create `python-embedder/.env` (not committed) with:
  ```env
  OPENAI_API_KEY=sk-...
  ```
- You can point Docker Compose to this file by exporting it when running commands, e.g.:
  - `docker compose run --rm --env-file python-embedder/.env python-embedder pytest`
  - `docker compose up -d --env-file python-embedder/.env python-embedder`
- If you prefer, you can also set `OPENAI_API_KEY` directly in your shell when running commands.

## Running inside Docker
1) Build (picks up code + deps, including `openai`):
```
docker compose build python-embedder
```

2) Run tests (local models only):
```
docker compose run --rm python-embedder pytest
```

3) Run tests with OpenAI included (requires key):
```
docker compose run --rm \
  --env-file python-embedder/.env \
  python-embedder pytest
```

4) Start the service (with or without the env file):
```
docker compose up -d python-embedder
# or
docker compose up -d --env-file python-embedder/.env python-embedder
```

5) Hit the evaluation endpoint from the host:
```
curl http://localhost:1337/eval-summary
```
If `OPENAI_API_KEY` was provided, the OpenAI model appears with metrics; otherwise it is marked as skipped with a reason.

## Notes
- No Elasticsearch is involved; this is pure embedding-level comparison.
- The weighting for the combined score is fixed at quality 0.7, latency 0.3.
- Default `/embed` continues to use the 768d local model for compatibility.
