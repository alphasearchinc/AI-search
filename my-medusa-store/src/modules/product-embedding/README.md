# Product Embedding Functionality

This custom module provides functionality to generate and store embeddings for products in your Medusa store. These embeddings can later be used with Elasticsearch for advanced search capabilities.

## Overview

The product embedding system consists of:

1. **Module**: Stores product embeddings with their vectors and metadata
2. **Service**: Provides methods to create, retrieve, and manage embeddings
3. **Workflow**: Orchestrates the process of generating and storing embeddings
4. **API Routes**: Exposes endpoints to interact with embeddings
5. **Subscriber**: Automatically generates embeddings when products are created/updated

## File Structure

```
src/
├── modules/
│   └── product-embedding/
│       ├── index.ts                    # Module definition
│       ├── service.ts                  # Service with CRUD operations
│       └── models/
│           └── product-embedding.ts    # Data model
├── workflows/
│   └── product-embedding/
│       ├── embed-product.ts            # Main workflow
│       └── steps/
│           ├── get-product-data.ts     # Fetch product details
│           ├── generate-embedding.ts   # Generate embedding vector
│           └── store-embedding.ts      # Store in database
├── api/
│   └── admin/
│       ├── products/
│       │   └── [product_id]/
│       │       └── embed/
│       │           └── route.ts        # POST: Embed a product
│       └── embeddings/
│           ├── route.ts                # GET: Get all embeddings
│           └── [product_id]/
│               └── route.ts            # GET: Get embedding by product
└── subscribers/
    └── product-embedding.ts            # Auto-embed on product events
```

## API Endpoints

### 1. Embed a Product (Manual Trigger)

```bash
POST /admin/products/{product_id}/embed
```

Manually triggers embedding generation for a specific product.

**Example:**

```bash
curl -X POST http://localhost:9000/admin/products/prod_123/embed \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**

```json
{
  "message": "Product embedded successfully",
  "embedding": {
    "id": "emb_123",
    "product_id": "prod_123",
    "embedding_vector": [0.1, 0.2, ...],
    "embedded_text": "Product Title. Product Description. Categories: ...",
    "metadata": {
      "title": "Product Title",
      "handle": "product-handle",
      "categories": ["Category 1"],
      "tags": ["tag1", "tag2"]
    },
    "generated_at": "2025-11-12T10:30:00Z"
  }
}
```

### 2. Get All Embeddings

```bash
GET /admin/embeddings
```

Retrieves all product embeddings.

**Example:**

```bash
curl http://localhost:9000/admin/embeddings \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**

```json
{
  "embeddings": [
    {
      "id": "emb_123",
      "product_id": "prod_123",
      "embedding_vector": [0.1, 0.2, ...],
      "embedded_text": "...",
      "metadata": {...},
      "generated_at": "2025-11-12T10:30:00Z"
    }
  ],
  "count": 1
}
```

### 3. Get Embedding by Product ID

```bash
GET /admin/embeddings/{product_id}
```

Retrieves the embedding for a specific product.

**Example:**

```bash
curl http://localhost:9000/admin/embeddings/prod_123 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**

```json
{
  "embedding": {
    "id": "emb_123",
    "product_id": "prod_123",
    "embedding_vector": [0.1, 0.2, ...],
    "embedded_text": "...",
    "metadata": {...},
    "generated_at": "2025-11-12T10:30:00Z"
  }
}
```

## Automatic Embedding Generation

The subscriber automatically generates embeddings when:

- A new product is created
- An existing product is updated

This ensures your embeddings are always up-to-date with your product data.

## How It Works

1. **Get Product Data**: Fetches product details including title, description, categories, and tags
2. **Generate Embedding**: Creates a vector representation of the product text
3. **Store Embedding**: Saves the embedding to the database with metadata

## Current Embedding Generation

The system currently uses a **simple placeholder embedding generator** for demonstration. The embedding is generated from:

- Product title
- Product description
- Category names

**Vector size**: 384 dimensions (common size for many embedding models)

## Integrating with AI Services (Future)

To use real embeddings, replace the `generateSimpleEmbedding` function in `src/workflows/product-embedding/steps/generate-embedding.ts` with calls to:

### OpenAI Example:

```typescript
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const response = await openai.embeddings.create({
  model: "text-embedding-3-small",
  input: text,
});

return response.data[0].embedding;
```

### Cohere Example:

```typescript
import { CohereClient } from "cohere-ai";

const cohere = new CohereClient({
  token: process.env.COHERE_API_KEY,
});

const response = await cohere.embed({
  texts: [text],
  model: "embed-english-v3.0",
});

return response.embeddings[0];
```

## Elasticsearch Integration (Future)

The embeddings are stored in a format ready for Elasticsearch integration:

1. **Vector Field**: The `embedding_vector` can be indexed as a `dense_vector` field
2. **Metadata**: Additional fields help with filtering and sorting
3. **Text Field**: The `embedded_text` can be used for hybrid search

Example Elasticsearch mapping:

```json
{
  "mappings": {
    "properties": {
      "product_id": { "type": "keyword" },
      "embedding_vector": {
        "type": "dense_vector",
        "dims": 384,
        "index": true,
        "similarity": "cosine"
      },
      "embedded_text": { "type": "text" },
      "metadata": { "type": "object" },
      "generated_at": { "type": "date" }
    }
  }
}
```

## Testing

After building and starting your Medusa server:

```bash
# Build the project
npm run build

# Start the server
npm run dev
```

1. Create a product through the admin panel or API
2. The embedding will be automatically generated
3. Check the embedding: `GET /admin/embeddings/{product_id}`
4. View all embeddings: `GET /admin/embeddings`

## Next Steps

1. ✅ **Set up embeddings** - Complete!
2. 🔄 **Integrate AI service** - Replace placeholder with OpenAI/Cohere
3. 🔄 **Add Elasticsearch** - Index embeddings for vector search
4. 🔄 **Build search API** - Create semantic search endpoints
5. 🔄 **Add to storefront** - Implement search UI

## Notes

- Embeddings are automatically updated when products change
- The placeholder embedding is deterministic (same text = same embedding)
- For production, always use a real embedding service
- Vector size should match your chosen embedding model


egen note
1. Product created/updated in Medusa
   ↓
2. Embedding generated (current system)
   ↓
3. Stored in PostgreSQL (current: complete ✅)
   ↓
4. Indexed in Elasticsearch (future: search optimization)
   ↓
5. User searches → Elasticsearch returns results
   ↓
6. Get details from PostgreSQL/Medusa



❌ Wrong Approaches
❌ Only in Elasticsearch
Problem: 
- No backup if ES goes down
- Hard to rebuild
- No source of truth
- Data consistency issues

❌ Only in PostgreSQL
Problem:
- No vector search optimization
- Slow for semantic search
- Can't use ES features (aggregations, analytics)
- Not scalable for millions of products