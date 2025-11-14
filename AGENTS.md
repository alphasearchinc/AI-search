# Project AGENT Guide

This document gives future agents the minimum context they need to work inside this monorepo without guessing. Read it fully before making changes.

## Project Snapshot
- **Goal**: Medusa-based commerce backend (`my-medusa-store`), a Next.js storefront, and auxiliary services (Python embedding API, MCP server) powering semantic product search.
- **Primary language**: TypeScript (backend + storefront). Python for the embedding service.
- **Entry points**:
  - `my-medusa-store` – Medusa backend (Node 20+, npm). Main place for workflows, modules, API routes, and subscribers.
  - `python-embedder` – Flask + SentenceTransformers service providing `/embed`.
  - `my-medusa-store-storefront` – Next.js 15 storefront (yarn). Runs the UI/search bar later.

## Directory Orientations
| Path | Purpose |
| --- | --- |
| `my-medusa-store/src/api` | Medusa API routes (`admin` & `store`). Use these for HTTP endpoints. |
| `my-medusa-store/src/workflows` | Workflow steps (bullMQ queues, Medusa workflows). Embedding workflows live here. |
| `my-medusa-store/src/modules` | Custom modules (e.g., `elasticsearch-client.ts`). |
| `my-medusa-store/src/lib` | Reusable helpers (`embedding-client`, `semantic-search`, redis/queue helpers). |
| `python-embedder/script.py` | Flask service for generating embeddings. Keep the model aligned with backend expectations (384 dims). |
| `docker-compose.yml` | Spins up Postgres, Redis, Elastic, etc. for local dev. |

## Key Workflows & Integrations
1. **Product embedding workflow** (`src/workflows/product-embedding`):
   - `get-product-data` → `generate-embedding` (calls Python service via `embedText`) → `store-embedding` (queues job).
   - `src/lib/elasticsearch-worker.ts` consumes jobs and indexes them into Elastic (`product-embeddings`).
2. **Semantic search**:
   - Helper: `src/lib/semantic-search.ts`.
   - Admin route: `POST /admin/embeddings/search` (`src/api/admin/embeddings/search/route.ts`).
   - Storefront endpoint doesn’t exist yet but should reuse the same helpers.

## Local Development Commands
- **Infra**: `docker compose up -d` (Postgres, Redis, Elastic).
- **Backend**: `cd my-medusa-store && npm ci && npm run dev`. Tests: `npm run test:unit`, `npm run test:integration:http`.
- **Worker**: `npm run start:worker` (if defined) or run `node dist/scripts/worker.js` after building.
- **Python embedder**: `cd python-embedder && pip install -r requirements.txt && python script.py` (or use Dockerfile).
- **Storefront**: `cd my-medusa-store-storefront && yarn && yarn dev`.

## Coding Standards & Guardrails
- Stick to TypeScript defaults. Avoid `any` unless unavoidable.
- Follow file-local style (imports grouping, quotes). Backend uses ESLint recommended—don’t run `npm run lint` unless requested.
- Keep edits minimal and scoped; never revert user changes.
- New helpers go under `src/lib` if shared, otherwise the closest module.
- The vector dimensions can vary depending on the model. Changing the model requires re-indexing.
- When touching workflows or routes that call external services, add clear error messages and timeouts.

## Testing Expectations
- Prefer unit tests for helpers (`embedText`, `semanticSearch`) and integration tests under `integration-tests/http`.
- Mock external calls (embedding service, Elasticsearch) inside tests.
- Don’t leave failing tests; run the relevant suite for the package you edit.

## Environment Notes
- Config templates: copy `.env.template` → `.env` for each package.
- Required services: Postgres, Redis, Elasticsearch, Python embedder. Most commands assume Docker containers are up.
- Medusa admin authentication uses either `x-medusa-access-token` header or session cookie/JWT (`Authorization: Bearer …`).

## API Cheat Sheet (current state)
- `POST /admin/embeddings/search` (requires admin auth):
  - Body: `{ query: string, limit?: number, filters?: { product_ids?: string[] }, include_product?: boolean, include_embedding?: boolean }`
  - Response: `{ hits: [...], count, took, embedding_dimensions }`
- `POST /admin/products/:product_id/embed` queues an embedding job.
- `POST /admin/embeddings/bulk` enqueues jobs for all products.
- `GET /admin/embeddings` lists embeddings; `GET /admin/embeddings/:product_id` fetches one.

## Agent Workflow Tips
1. Identify which package the change belongs to; never mix backend/storefront/embedding changes in one patch.
2. Prefer reusing helpers (e.g., `embedText`, `semanticSearch`) instead of duplicating fetch logic.
3. For new endpoints, keep route files thin—perform validation there, business logic in `src/lib`.
4. When modifying embedding logic, ensure the worker/index schema stays consistent with Elastic mappings in `src/modules/elasticsearch-client.ts`.
5. Always mention any commands/tests you couldn’t run due to environment limits in the final message.

Keep this document updated whenever major workflows or conventions change.
