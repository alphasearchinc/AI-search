# Quick Start Guide - Product Embedding System

## ✅ What's Been Created

Your product embedding system is now complete with:

1. **Database Model** - Stores embeddings with vectors and metadata
2. **Service Layer** - CRUD operations for embeddings
3. **Workflow** - Orchestrates embedding generation
4. **API Routes** - 3 endpoints to interact with embeddings
5. **Auto-subscriber** - Automatically embeds products on create/update

## 🚀 Getting Started

### Step 1: Build and Start Your Server

```bash
cd c:\Users\anlu\Desktop\Hovedopgave\my-medusa-store
npm run build
npm run dev
```

### Step 2: The database will automatically create the `product_embedding` table

The first time you start the server, Medusa will create the new table.

### Step 3: Test the Functionality

#### Option A: Automatic (Recommended)

Create or update any product through your admin panel - the embedding will be generated automatically!

#### Option B: Manual Trigger

```bash
# Replace {product_id} with an actual product ID
curl -X POST http://localhost:9000/admin/products/{product_id}/embed \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Step 4: View Embeddings

```bash
# Get all embeddings
curl http://localhost:9000/admin/embeddings \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Get specific product's embedding
curl http://localhost:9000/admin/embeddings/{product_id} \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

## 📁 Files Created

```
my-medusa-store/src/
├── modules/product-embedding/
│   ├── index.ts                          # Module definition
│   ├── service.ts                        # Service (create, get, update, delete)
│   ├── models/product-embedding.ts       # Database model
│   └── README.md                         # Detailed documentation
│
├── workflows/product-embedding/
│   ├── embed-product.ts                  # Main workflow
│   └── steps/
│       ├── get-product-data.ts           # Step 1: Get product info
│       ├── generate-embedding.ts         # Step 2: Generate vector
│       └── store-embedding.ts            # Step 3: Save to DB
│
├── api/admin/
│   ├── products/[product_id]/embed/
│   │   └── route.ts                      # POST: Manually embed a product
│   └── embeddings/
│       ├── route.ts                      # GET: All embeddings
│       └── [product_id]/route.ts         # GET: One embedding
│
└── subscribers/
    └── product-embedding.ts              # Auto-embed on product events
```

## 🔧 Current Implementation

**Embedding Generation**: Uses a simple placeholder algorithm (384-dimensional vector)

- ✅ Ready to use immediately
- ✅ Deterministic (same product = same embedding)
- ⚠️ Not suitable for production search (use AI service instead)

**What's Embedded**:

- Product title
- Product description
- Category names
- Tags

**Stored Metadata**:

- Product title and handle
- Category names
- Tag values
- Generation timestamp

## 🎯 Next Steps for Production

### 1. Integrate Real AI Embeddings

Replace the placeholder in `src/workflows/product-embedding/steps/generate-embedding.ts`:

**Option A: OpenAI** (Recommended)

```bash
npm install openai
```

```typescript
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const response = await openai.embeddings.create({
  model: "text-embedding-3-small", // 1536 dimensions
  input: text,
});

return response.data[0].embedding;
```

**Option B: Cohere**

```bash
npm install cohere-ai
```

```typescript
import { CohereClient } from "cohere-ai";

const cohere = new CohereClient({
  token: process.env.COHERE_API_KEY,
});

const response = await cohere.embed({
  texts: [text],
  model: "embed-english-v3.0", // 1024 dimensions
});

return response.embeddings[0];
```

### 2. Add Elasticsearch (Later in Your Project)

Once you have real embeddings, you can:

1. Install Elasticsearch
2. Create an index with vector fields
3. Sync embeddings to Elasticsearch
4. Build semantic search endpoints
5. Add search UI to your storefront

## 📊 Database Schema

The `product_embedding` table has:

| Field              | Type     | Description                     |
| ------------------ | -------- | ------------------------------- |
| `id`               | string   | Primary key                     |
| `product_id`       | string   | Reference to product            |
| `embedding_vector` | json     | The vector array                |
| `embedded_text`    | text     | Original text that was embedded |
| `metadata`         | json     | Additional product info         |
| `generated_at`     | datetime | When embedding was created      |

## 🔍 API Reference

### POST `/admin/products/{product_id}/embed`

Manually trigger embedding generation for a product.

### GET `/admin/embeddings`

Get all product embeddings with their vectors and metadata.

### GET `/admin/embeddings/{product_id}`

Get the embedding for a specific product.

## ⚠️ Important Notes

1. **Automatic Updates**: Embeddings are automatically regenerated when products are updated
2. **Vector Size**: Currently 384 dimensions (change when integrating AI service)
3. **No Search Yet**: This implementation only stores embeddings - search comes with Elasticsearch
4. **One Embedding Per Product**: Updating a product updates its embedding

## 🆘 Troubleshooting

**Build Errors?**

```bash
npm install
npm run build
```

**Database Issues?**
The module creates tables automatically. If issues persist, check your `DATABASE_URL` in `.env`

**Can't Access APIs?**
Make sure you're authenticated. Admin routes require an admin user token.

## 📖 More Information

See `src/modules/product-embedding/README.md` for detailed documentation.

## 🎉 You're Ready!

Your product embedding system is set up and ready to use. Products will automatically get embeddings when created or updated. Later, you can integrate Elasticsearch for powerful semantic search!
