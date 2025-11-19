# Elasticsearch Module

A custom Medusa module that provides semantic search functionality using Elasticsearch, with hybrid BM25 + vector search capabilities.

## Features

- **Hybrid Search**: Combines BM25 (keyword) and vector (semantic) search for better results
- **Fuzzy Matching**: Handles typos and variations in search queries
- **Queue-based Indexing**: Asynchronous embedding generation via BullMQ
- **Configurable**: All settings can be customized via module options or environment variables

## Configuration

### Module Options

Configure the module in `medusa-config.ts`:

```typescript
modules: [
  {
    resolve: "./src/modules/elasticsearch",
    options: {
      // Elasticsearch connection
      elasticsearch_url: process.env.ELASTICSEARCH_URL,

      // Index and queue names
      product_embeddings_index: "product-embeddings",
      product_embedding_queue: "product-embedding",

      // Search configuration
      search: {
        default_limit: 10,
        max_limit: 50,
        vector_weight: 0.7,
        bm25_weight: 0.3,
        overfetch_multiplier: 3,
        min_confidence: 0.3,
      },

      // Fuzzy search
      fuzzy: {
        enabled: true,
        fuzziness_level: "AUTO",
        prefix_length: 2,
        max_expansions: 50,
      },
    },
  },
],
```

### Environment Variables

All options support environment variable overrides:

#### Core Settings

- `ELASTICSEARCH_URL` - Elasticsearch server URL (default: `http://localhost:9200`)
- `PRODUCT_EMBEDDINGS_INDEX` - Index name (default: `product-embeddings`)
- `PRODUCT_EMBEDDING_QUEUE` - BullMQ queue name (default: `product-embedding`)

#### Search Configuration

- `SEARCH_DEFAULT_LIMIT` - Default number of results (default: `10`)
- `SEARCH_MAX_LIMIT` - Maximum allowed results (default: `50`)
- `HYBRID_VECTOR_WEIGHT` - Vector search weight in hybrid mode (default: `0.7`)
- `HYBRID_BM25_WEIGHT` - BM25 search weight in hybrid mode (default: `0.3`)
- `SEARCH_OVERFETCH_MULTIPLIER` - Internal fetch multiplier for re-ranking (default: `3`)
- `SEMANTIC_SEARCH_MIN_CONFIDENCE` - Minimum confidence threshold (default: `0.3`)

#### Fuzzy Search

- `SEARCH_FUZZY_ENABLED` - Enable fuzzy matching (default: `true`)
- `SEARCH_FUZZINESS_LEVEL` - Fuzziness level: `AUTO`, `0`, `1`, `2` (default: `AUTO`)
- `SEARCH_PREFIX_LENGTH` - Characters that must match exactly (default: `2`)
- `SEARCH_MAX_EXPANSIONS` - Maximum fuzzy term expansions (default: `50`)

## Usage

### Dependency Injection

The module service is available via dependency injection:

```typescript
import { ELASTICSEARCH_MODULE } from "../../modules/elasticsearch";
import ElasticsearchModuleService from "../../modules/elasticsearch/service";

// In a workflow step
const elasticsearchService: ElasticsearchModuleService =
  container.resolve(ELASTICSEARCH_MODULE);

// In an API route
const elasticsearchService: ElasticsearchModuleService =
  req.scope.resolve(ELASTICSEARCH_MODULE);
```

### Service Methods

#### `semanticSearch(options)`

Perform hybrid semantic search:

```typescript
const result = await elasticsearchService.semanticSearch({
  query: "laptop",
  embedding: { vectors: [...], dimensions: 384 },
  limit: 10,
  mode: "hybrid", // "hybrid", "bm25", or "vector"
  minConfidence: 0.3,
  filters: { product_ids: ["prod_123"] },
});
```

#### `queueEmbedding(data)`

Queue an embedding job for async processing:

```typescript
await elasticsearchService.queueEmbedding({
  product_id: "prod_123",
  embedded_text: "Product description",
  embedding: { vectors: [...], dimensions: 384 },
  metadata: { title: "Product Name" },
});
```

#### `startWorker()` / `stopWorker()`

Manage the background worker for processing embedding jobs:

```typescript
// Start worker (usually in worker script)
elasticsearchService.startWorker();

// Stop worker gracefully
await elasticsearchService.stopWorker();
```

#### `initializeIndex()`

Initialize or validate the Elasticsearch index:

```typescript
await elasticsearchService.initializeIndex();
```

#### `deleteIndex()`

Delete the Elasticsearch index:

```typescript
await elasticsearchService.deleteIndex();
```

## Architecture

### Module Structure

```
src/modules/elasticsearch/
├── index.ts       # Module definition
├── service.ts     # Main service class
├── types.ts       # TypeScript types
└── README.md      # This file
```

### Flow

1. **Product Created/Updated** → Subscriber triggers workflow
2. **Workflow** → Generates embedding and queues indexing job
3. **Worker** → Processes queue, indexes to Elasticsearch
4. **Search API** → Uses service to perform semantic search

## Troubleshooting

### Dimension Mismatch Error

If you see "Embedding dimension mismatch", the index was created with a different embedding model:

```bash
npm run reindex
```

This recreates the index with current model dimensions.

### Worker Not Processing Jobs

Ensure the worker is running:

```bash
npm run worker
```

Check Redis connection and queue configuration.

### No Search Results

- Verify Elasticsearch is running and accessible
- Check that products have been embedded (check queue/logs)
- Try lowering `min_confidence` threshold
- Use `mode: "bm25"` to test without embeddings

## Development

### Running Tests

```bash
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration
```

### Reindexing All Products

```bash
npm run reindex
```

This deletes and recreates the index, then queues all products for embedding.
