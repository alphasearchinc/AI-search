# AI-Powered Semantic Search E-Commerce Platform

![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/alphasearchinc/AI-search?utm_source=oss&utm_medium=github&utm_campaign=alphasearchinc%2FAI-search&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)

A production-ready e-commerce platform built on **Medusa.js 2.x** with **semantic search capabilities** powered by vector embeddings and hybrid search algorithms. Replace traditional keyword matching with AI-driven product discovery that understands user intent.

## 🎯 Overview

This platform combines the power of traditional e-commerce with modern AI search technology:

- **Semantic Understanding**: Uses vector embeddings to understand the meaning behind search queries, not just keywords
- **Hybrid Search**: Combines BM25 keyword matching with kNN vector similarity for optimal results
- **Real-time Indexing**: Automatic embedding generation when products are created or updated
- **Advanced Filtering**: Dynamic faceted search with cascading filters (categories, brands, price, product options)
- **Scalable Architecture**: Queue-based async processing with BullMQ and Redis
- **Production Metrics**: Built-in performance monitoring with TimescaleDB and Grafana

## 🏗️ Architecture

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────┐
│   Next.js       │─────▶│   Medusa.js      │─────▶│  TimescaleDB    │
│   Storefront    │      │   Backend API    │      │  (PostgreSQL)   │
└─────────────────┘      └──────────────────┘      └─────────────────┘
                                  │
                                  │
                    ┌─────────────┼─────────────┐
                    │             │             │
                    ▼             ▼             ▼
          ┌──────────────┐  ┌─────────┐  ┌──────────────┐
          │ Elasticsearch│  │  Redis  │  │    Python    │
          │  (Vector +   │  │ (Queue) │  │   Embedder   │
          │    BM25)     │  └─────────┘  │   Service    │
          └──────────────┘               └──────────────┘
```

**Core Components:**

- **Backend**: Medusa.js 2.x with custom Elasticsearch module
- **Frontend**: Next.js 15 with React 19 RC
- **Search**: Elasticsearch 9.2 (hybrid vector + keyword search)
- **Embeddings**: Python Flask service with SentenceTransformers or OpenAI API
- **Queue**: BullMQ + Redis for async job processing
- **Database**: TimescaleDB for data + metrics storage
- **Monitoring**: Grafana dashboards

## ✨ Key Features

### Semantic Search
- **AI-powered understanding** of natural language queries
- **Hybrid scoring** with configurable weights (vector + BM25)
- **Fuzzy matching** for typo tolerance
- **Confidence thresholds** to filter low-quality results

### Smart Filtering
- **Cascading facets** - filter counts update based on other active filters
- **Multi-dimensional filtering** - category, brand, price range, product options
- **Real-time facet generation** from search results

### Product Discovery
- **Content-based recommendations** using semantic similarity
- **Vector-based similar products** via kNN search
- **Automatic re-indexing** on product updates

### Developer Experience
- **Type-safe** throughout with TypeScript
- **Event-driven architecture** with Medusa workflows
- **Comprehensive metrics** for monitoring performance
- **Modular design** with clear separation of concerns

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- Docker & Docker Compose
- Python 3.9+ (for embedding service)

### 1. Start Infrastructure

```bash
# Start all services (Postgres, Redis, Elasticsearch, Python embedder)
docker compose up -d

# Wait for services to be healthy
docker compose ps
```

### 2. Setup Backend

```bash
cd my-medusa-store
npm install
cp .env.template .env  # Configure your environment

# Run migrations and optionally seed data
npx medusa db:migrate

(optional)
npm run seed
npm run products # Mock products
npx medusa user --email <email> --password <password> # Admin user

# Start backend + worker
npm run dev
npm run worker  # In separate terminal
```

### 3. Setup Storefront

```bash
cd my-medusa-store-storefront
npm install
cp .env.template .env.local  # Configure backend URL

npm run dev
```

### 4. Access the Application

- **Storefront**: http://localhost:8000
- **Admin Panel**: http://localhost:9000/app
- **Elasticsearch**: http://localhost:9200
- **Grafana**: http://localhost:3000

## 📦 Project Structure

```
AI-search/
├── my-medusa-store/              # Medusa backend
│   ├── src/
│   │   ├── api/                  # HTTP routes (admin + store)
│   │   ├── modules/              # Custom modules (Elasticsearch)
│   │   ├── workflows/            # Medusa workflows
│   │   ├── subscribers/          # Event listeners
│   │   └── lib/                  # Shared utilities
│   └── integration-tests/        # API tests
│
├── my-medusa-store-storefront/   # Next.js frontend
│   └── src/
│       ├── app/                  # Next.js 15 app router
│       ├── components/           # UI components (SearchBar, etc.)
│       ├── lib/                  # API clients
│       └── modules/              # Feature modules
│
├── python-embedder/              # Embedding service
│   ├── embedder.py               # Flask API
│   └── evaluation.py             # Model comparison
│
├── docs/                         # Documentation
├── grafana/                      # Monitoring dashboards
└── docker-compose.yml            # Infrastructure setup
```

## 🔧 Configuration

### Embedding Service

Choose between local models or OpenAI:

```bash
# Local embedding service (default)
LOCAL_EMBEDDING_SERVICE_URL=http://localhost:1337

# Or use OpenAI
OPENAI_API_KEY=your-api-key
```

### Search Tuning

Adjust hybrid search weights:

```bash
# Environment variables
HYBRID_VECTOR_WEIGHT=0.5            # Semantic similarity weight
HYBRID_BM25_WEIGHT=0.5              # Keyword matching weight
SEARCH_FUZZY_ENABLED=true           # Enable fuzzy matching
SEMANTIC_SEARCH_MIN_CONFIDENCE=0.3  # Minimum result confidence
```

## 🧪 Testing

```bash
# Backend unit tests
cd my-medusa-store
npm run test:unit

# Integration tests
npm run test:integration

# Specific test suites
npm run test:fuzzy
```

## 📊 Monitoring

Access Grafana at `http://localhost:3000` to view:
- Search performance metrics
- Embedding generation stats
- Query latency percentiles
- Error rates and system health

## 📚 Documentation

- [Agent Guide](AGENTS.md) - Context for AI agents working on this codebase
- [Daily Scrum](docs/daily_scrum.md) - Development progress log
- [Knowledge Sharing](docs/knowledge-sharing/) - Technical deep-dives

## 🤝 Contributing

This is a project demonstrating semantic search in e-commerce. Contributions, suggestions, and feedback are welcome!

## 📝 License

MIT

---

**Built with:** Medusa.js • Next.js • Elasticsearch • Python • TypeScript
