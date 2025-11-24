# Embedding Pipeline Verification Guide

This guide explains how to manually verify that product embeddings flow through Medusa → BullMQ → Elasticsearch after consolidating the queueing and embedding branches.

## Prerequisites
- Postgres, Redis, and Elasticsearch services running (Docker stack or local processes)
- Environment variables (`DATABASE_URL`, `REDIS_*`, `ELASTICSEARCH_URL`, etc.) exported for both the Medusa API and the worker
- Admin API access token for the Medusa backend

## 1. Launch the Services
1. Start the Medusa backend:
   ```bash
   npm run dev
   ```
   You should see logs when API routes or subscribers enqueue embedding jobs.
2. In a separate terminal, start the BullMQ worker:
   ```bash
   npm run worker
   ```
   Expected logs:
   - `🚀 Product Embedding Worker Starting...`
   - `[WORKER] ✅ Worker ready`
   - For each job: `[WORKER] ✅ Indexed embedding for product prod_...`

## 2. Single-Product Embedding Test
1. Pick a product ID (`prod_...`). You can list products via admin UI or:
   ```bash
   curl -H "Authorization: Bearer <API_TOKEN>" \
     http://localhost:9000/admin/products
   ```
2. Trigger embedding for that product:
   ```bash
   curl -X POST \
     -H "Authorization: Bearer <API_TOKEN>" \
     http://localhost:9000/admin/products/{product_id}/embed
   ```
3. Expected API response:
   ```json
   {"message":"Product embedding job enqueued","job_id":"<id>","product_id":"<prod>"}
   ```
4. Worker log should show the job being processed. Double-check Elasticsearch:
   ```bash
   curl http://localhost:9200/product-embeddings/_doc/{product_id}?pretty
   ```
   You should see the `embedded_text`, `embedding_vector`, metadata, and `generated_at` fields.

## 3. Bulk Embedding Test
1. Call the bulk endpoint to enqueue every product:
   ```bash
   curl -X POST \
     -H "Authorization: Bearer <API_TOKEN>" \
     http://localhost:9000/admin/embeddings/bulk
   ```
2. Response contains totals:
   - `results.total`: number of products discovered
   - `results.enqueued`: number of jobs queued
   - `results.failed`: failures (check logs if >0)
3. Monitor worker output to confirm a stream of jobs is processed.

## 4. Reading Embeddings via Medusa
- List embeddings (reads directly from Elasticsearch):
  ```bash
  curl -H "Authorization: Bearer <API_TOKEN>" \
    "http://localhost:9000/admin/embeddings?limit=10&offset=0"
  ```
- Retrieve a single embedding:
  ```bash
  curl -H "Authorization: Bearer <API_TOKEN>" \
    http://localhost:9000/admin/embeddings/{product_id}
  ```

## 5. Troubleshooting
- **No worker logs**: ensure `npm run worker` is pointed at the same Redis + ES hosts as the API.
- **Jobs stay pending**: check Redis connectivity and confirm the queue name matches (`product-embedding`).
- **Elasticsearch 404s**: run the worker once; it initializes the `product-embeddings` index automatically.
- **API errors**: confirm your admin token scopes and that the Medusa server trusts the provided CORS/host configuration.

Following these steps validates the full pipeline end-to-end.
