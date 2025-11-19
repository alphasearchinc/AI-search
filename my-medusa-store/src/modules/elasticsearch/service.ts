import { MedusaService } from "@medusajs/framework/utils";
import { Client } from "@elastic/elasticsearch";
import { Queue, Worker, Job } from "bullmq";
import { detectEmbeddingDimensions } from "../../lib/embedding-dimensions";
import { createRedisConnection } from "../../lib/redis-connection";
import type {
  ElasticsearchModuleOptions,
  SemanticSearchOptions,
  SemanticSearchResult,
  SemanticSearchHit,
  ProductEmbeddingJobData,
  SearchMode,
} from "./types";

export default class ElasticsearchModuleService extends MedusaService({}) {
  private client: Client;
  private queue: Queue<ProductEmbeddingJobData>;
  private worker: Worker<ProductEmbeddingJobData> | null = null;
  private options_: ElasticsearchModuleOptions;
  
  public readonly PRODUCT_EMBEDDINGS_INDEX: string;
  public readonly PRODUCT_EMBEDDING_QUEUE: string;

  constructor(container, options: ElasticsearchModuleOptions = {}) {
    super(...arguments);
    
    this.options_ = options;

    // Configuration with fallbacks
    const ELASTICSEARCH_URL =
      options.elasticsearch_url || 
      process.env.ELASTICSEARCH_URL || 
      "http://localhost:9200";

    this.PRODUCT_EMBEDDINGS_INDEX = 
      options.product_embeddings_index || "product-embeddings";
    this.PRODUCT_EMBEDDING_QUEUE = 
      options.product_embedding_queue || "product-embedding";

    this.client = new Client({
      node: ELASTICSEARCH_URL,
    });

    const queueConnection = createRedisConnection("QUEUE");
    this.queue = new Queue<ProductEmbeddingJobData>(
      this.PRODUCT_EMBEDDING_QUEUE,
      {
        connection: queueConnection,
        defaultJobOptions: {
          attempts: 3,
          removeOnComplete: true,
          removeOnFail: 100,
          backoff: {
            type: "exponential",
            delay: 2000,
          },
        },
      }
    );

    console.log(`[ELASTICSEARCH MODULE] 📦 Queue "${this.PRODUCT_EMBEDDING_QUEUE}" initialized`);
  }

  async onApplicationStart(): Promise<void> {
    await this.initializeIndex();
  }

  private getSearchConfig() {
    return {
      defaultLimit: this.options_.search?.default_limit || 10,
      maxLimit: this.options_.search?.max_limit || 50,
      vectorWeight: this.options_.search?.vector_weight || 0.7,
      bm25Weight: this.options_.search?.bm25_weight || 0.3,
      overfetchMultiplier: this.options_.search?.overfetch_multiplier || 3,
      minConfidence: this.options_.search?.min_confidence || 0.3,
    };
  }

  private getFuzzyConfig() {
    return {
      enabled: this.options_.fuzzy?.enabled ?? true,
      fuzzinessLevel: this.options_.fuzzy?.fuzziness_level || "AUTO",
      prefixLength: this.options_.fuzzy?.prefix_length || 2,
      maxExpansions: this.options_.fuzzy?.max_expansions || 50,
    };
  }

  private async getIndexDimensions(): Promise<number | null> {
    try {
      const mapping = await this.client.indices.getMapping({
        index: this.PRODUCT_EMBEDDINGS_INDEX,
      });

      const indexMapping = mapping[this.PRODUCT_EMBEDDINGS_INDEX];
      const embeddingVectorField =
        indexMapping?.mappings?.properties?.embedding_vector;

      if (
        embeddingVectorField?.type === "dense_vector" &&
        typeof embeddingVectorField.dims === "number"
      ) {
        return embeddingVectorField.dims;
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  async initializeIndex(): Promise<void> {
    try {
      const exists = await this.client.indices.exists({
        index: this.PRODUCT_EMBEDDINGS_INDEX,
      });

      const currentDims = await detectEmbeddingDimensions();
      console.log(
        `[ELASTICSEARCH MODULE] 🔍 Detected embedding dimensions: ${currentDims}`
      );

      if (!exists) {
        await this.client.indices.create({
          index: this.PRODUCT_EMBEDDINGS_INDEX,
          mappings: {
            properties: {
              product_id: { type: "keyword" },
              embedded_text: { type: "text" },
              embedding_vector: {
                type: "dense_vector",
                dims: currentDims,
              },
              metadata: { type: "object", dynamic: true },
              generated_at: { type: "date" },
            },
          },
        });

        console.log(
          `[ELASTICSEARCH MODULE] ✅ Index "${this.PRODUCT_EMBEDDINGS_INDEX}" created with ${currentDims} dimensions`
        );
      } else {
        const indexDims = await this.getIndexDimensions();

        if (indexDims === null) {
          console.warn(
            `[ELASTICSEARCH MODULE] ⚠️ Unable to determine index embedding dimensions for "${this.PRODUCT_EMBEDDINGS_INDEX}". ` +
            `Consider running 'npm run reindex' to recreate the index.`
          );
        } else if (indexDims !== currentDims) {
          console.error(
            `\n[ELASTICSEARCH MODULE] ❌ Dimension mismatch:\n` +
              `  - Index: ${indexDims}D\n` +
              `  - Current model: ${currentDims}D\n\n` +
              `Fix: npm run reindex\n`
          );

          throw new Error(
            `Embedding dimension mismatch (index=${indexDims}D, model=${currentDims}D). Run 'npm run reindex'.`
          );
        }

        if (indexDims !== null) {
          console.log(
            `[ELASTICSEARCH MODULE] ✅ Index exists with ${indexDims}D dimensions`
          );
        }
      }
    } catch (error) {
      console.error(`[ELASTICSEARCH MODULE] ❌ Failed to initialize index:`, error);
      throw error;
    }
  }

  async queueEmbedding(data: ProductEmbeddingJobData): Promise<void> {
    await this.queue.add("embed", data);
    console.log(`[ELASTICSEARCH MODULE] 📦 Queued embedding for product ${data.product_id}`);
  }

  async indexEmbedding(data: ProductEmbeddingJobData): Promise<void> {
    const { product_id, embedded_text, embedding, metadata } = data;

    await this.client.index({
      index: this.PRODUCT_EMBEDDINGS_INDEX,
      id: product_id,
      document: {
        product_id,
        embedded_text,
        embedding,
        embedding_vector: embedding.vectors,
        metadata: metadata || {},
        generated_at: new Date().toISOString(),
      },
    });

    console.log(
      `[ELASTICSEARCH MODULE] ✅ Indexed embedding for product ${product_id}`
    );
  }

  startWorker(): void {
    if (this.worker) {
      console.log(`[ELASTICSEARCH MODULE] ⚠️ Worker already running`);
      return;
    }

    const workerConnection = createRedisConnection("WORKER");

    this.worker = new Worker<ProductEmbeddingJobData>(
      this.PRODUCT_EMBEDDING_QUEUE,
      async (job: Job<ProductEmbeddingJobData>) => {
        const { product_id, embedded_text, embedding, metadata } = job.data;

        console.log(`[ELASTICSEARCH MODULE WORKER] 🔍 Processing job ${job.id} for product ${product_id}`);
        console.log(
          `[ELASTICSEARCH MODULE WORKER] 🔍 Embedding vector: ${
            embedding.vectors
              ? `Array of ${embedding.vectors.length} values`
              : "MISSING!"
          }`
        );

        await this.indexEmbedding(job.data);

        console.log(
          `[ELASTICSEARCH MODULE WORKER] ✅ Indexed embedding for product ${product_id} (job ${job.id})`
        );
      },
      {
        connection: workerConnection,
        concurrency: 5,
      }
    );

    this.worker.on("ready", () => {
      console.log(`[ELASTICSEARCH MODULE WORKER] ✅ Worker ready`);
    });

    this.worker.on("completed", (job) => {
      console.log(`[ELASTICSEARCH MODULE WORKER] ✅ Job ${job.id} completed`);
    });

    this.worker.on("failed", (job, err) => {
      console.error(`[ELASTICSEARCH MODULE WORKER] ❌ Job ${job?.id} failed: ${err.message}`);
    });

    console.log(`[ELASTICSEARCH MODULE] ✅ Worker started`);
  }

  async stopWorker(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
      console.log(`[ELASTICSEARCH MODULE] ✅ Worker stopped`);
    }
  }

  private parseWeight(raw: string | undefined, fallback: number): number {
    const parsed = Number.parseFloat(raw ?? "");
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
    return fallback;
  }

  private parseMinConfidence(raw: string | undefined, fallback: number): number {
    const parsed = Number.parseFloat(raw ?? "");
    if (Number.isFinite(parsed)) {
      return Math.min(Math.max(parsed, 0), 1);
    }
    return fallback;
  }

  private getTotal(total: any, fallback: number): number {
    if (typeof total === "number") {
      return total;
    }
    if (typeof total?.value === "number") {
      return total.value;
    }
    return fallback;
  }

  async semanticSearch(
    options: SemanticSearchOptions
  ): Promise<SemanticSearchResult> {
    const hasEmbedding =
      options.embedding &&
      Array.isArray(options.embedding.vectors) &&
      !options.embedding.vectors.some((value) => typeof value !== "number");

    const requestedMode: SearchMode = options.mode ?? "hybrid";
    if (
      (requestedMode === "hybrid" || requestedMode === "vector") &&
      !hasEmbedding
    ) {
      if (requestedMode === "vector") {
        throw new Error(
          "A numeric embedding vector is required for vector search"
        );
      }
    }

    const resolvedMode: SearchMode | "bm25-only" =
      hasEmbedding || requestedMode === "bm25" ? requestedMode : "bm25-only";

    const searchConfig = this.getSearchConfig();

    const size = Math.max(
      1,
      Math.min(options.limit ?? searchConfig.defaultLimit, searchConfig.maxLimit)
    );

    const sourceFields = [
      "product_id",
      "embedded_text",
      "metadata",
      "generated_at",
    ];

    if (options.includeEmbedding) {
      sourceFields.push("embedding");
    }

    const filterClauses: any[] = [];
    const productIds = options.filters?.product_ids?.filter(Boolean) ?? [];

    if (productIds.length) {
      filterClauses.push({
        terms: {
          product_id: productIds,
        },
      });
    }

    const boolFilter =
      filterClauses.length > 0 ? { bool: { filter: filterClauses } } : null;

    const rawVectorWeight = this.parseWeight(
      process.env.HYBRID_VECTOR_WEIGHT,
      searchConfig.vectorWeight
    );
    const rawBm25Weight = this.parseWeight(
      process.env.HYBRID_BM25_WEIGHT,
      searchConfig.bm25Weight
    );

    const weightSum = rawVectorWeight + rawBm25Weight;
    const vectorWeight =
      weightSum > 0 ? rawVectorWeight / weightSum : searchConfig.vectorWeight;
    const bm25Weight =
      weightSum > 0 ? rawBm25Weight / weightSum : searchConfig.bm25Weight;

    const fuzzyConfig = this.getFuzzyConfig();
    const fuzzyEnabled =
      process.env.SEARCH_FUZZY_ENABLED !== "false" && fuzzyConfig.enabled;
    const fuzzinessLevel =
      process.env.SEARCH_FUZZINESS_LEVEL || fuzzyConfig.fuzzinessLevel;
    const prefixLength = this.parseWeight(
      process.env.SEARCH_PREFIX_LENGTH,
      fuzzyConfig.prefixLength
    );
    const maxExpansions = this.parseWeight(
      process.env.SEARCH_MAX_EXPANSIONS,
      fuzzyConfig.maxExpansions
    );

    const minConfidence =
      typeof options.minConfidence === "number"
        ? this.parseMinConfidence(
            String(options.minConfidence),
            searchConfig.minConfidence
          )
        : this.parseMinConfidence(
            process.env.SEMANTIC_SEARCH_MIN_CONFIDENCE,
            searchConfig.minConfidence
          );

    const bm25Query = {
      bool: {
        must: [
          {
            match: {
              embedded_text: fuzzyEnabled
                ? {
                    query: options.query,
                    fuzziness: fuzzinessLevel,
                    prefix_length: prefixLength,
                    max_expansions: maxExpansions,
                  }
                : options.query,
            },
          },
        ],
        ...(boolFilter ? { filter: filterClauses } : {}),
      },
    };

    const baseVectorQuery = boolFilter
      ? { bool: { filter: filterClauses } }
      : { match_all: {} };

    const hitsMap = new Map<
      string,
      {
        source?: Record<string, any>;
        bm25_score?: number;
        vector_score?: number;
        combined?: number;
      }
    >();

    const tookParts: number[] = [];

    let bm25Total = 0;
    let vectorTotal = 0;
    let maxBm25Score = 0;
    let maxVectorScore = 0;

    if (resolvedMode !== "vector") {
      const bm25Response = await this.client.search({
        index: this.PRODUCT_EMBEDDINGS_INDEX,
        size: Math.max(size, size * searchConfig.overfetchMultiplier),
        track_total_hits: true,
        query: bm25Query,
        _source: sourceFields,
      });

      tookParts.push(bm25Response.took ?? 0);
      bm25Total = this.getTotal(bm25Response.hits.total, 0);

      for (const hit of bm25Response.hits.hits ?? []) {
        if (!hit._id) continue;
        const source = (hit._source || {}) as Record<string, any>;
        const current = hitsMap.get(hit._id) || {};
        current.source = current.source || source;
        current.bm25_score = typeof hit._score === "number" ? hit._score : 0;
        maxBm25Score = Math.max(maxBm25Score, current.bm25_score);
        hitsMap.set(hit._id, current);
      }
    }

    if (resolvedMode !== "bm25" && hasEmbedding && options.embedding) {
      const vectorResponse = await this.client.search({
        index: this.PRODUCT_EMBEDDINGS_INDEX,
        size: Math.max(size, size * searchConfig.overfetchMultiplier),
        track_total_hits: true,
        query: {
          script_score: {
            query: baseVectorQuery,
            script: {
              source: `
                if (doc['embedding_vector'].size() == 0) { return 0; }
                double vectorScore = cosineSimilarity(params.query_vector, 'embedding_vector') + 1.0;
                return Math.max(vectorScore, 0);
              `,
              params: {
                query_vector: options.embedding.vectors,
              },
            },
          },
        },
        _source: sourceFields,
      });

      tookParts.push(vectorResponse.took ?? 0);
      vectorTotal = this.getTotal(vectorResponse.hits.total, 0);

      for (const hit of vectorResponse.hits.hits ?? []) {
        if (!hit._id) continue;
        const source = (hit._source || {}) as Record<string, any>;
        const current = hitsMap.get(hit._id) || {};
        current.source = current.source || source;
        current.vector_score = typeof hit._score === "number" ? hit._score : 0;
        maxVectorScore = Math.max(maxVectorScore, current.vector_score);
        hitsMap.set(hit._id, current);
      }
    }

    const hits = Array.from(hitsMap.entries()).map(([id, data]) => {
      const normalizedBm25 =
        maxBm25Score > 0 ? (data.bm25_score ?? 0) / maxBm25Score : 0;
      const normalizedVector =
        maxVectorScore > 0
          ? Math.min((data.vector_score ?? 0) / maxVectorScore, 1)
          : 0;

      const availableVectorWeight =
        data.vector_score !== undefined ? vectorWeight : 0;
      const availableBm25Weight =
        data.bm25_score !== undefined ? bm25Weight : 0;
      const availableWeightSum = availableVectorWeight + availableBm25Weight || 1;

      const confidence =
        (normalizedVector * availableVectorWeight +
          normalizedBm25 * availableBm25Weight) /
        availableWeightSum;

      const combinedScore =
        (data.vector_score ?? 0) * vectorWeight +
        (data.bm25_score ?? 0) * bm25Weight;

      return {
        id,
        product_id: data.source?.product_id,
        score: combinedScore,
        bm25_score: data.bm25_score,
        vector_score: data.vector_score,
        confidence,
        embedded_text: data.source?.embedded_text,
        metadata: data.source?.metadata,
        generated_at: data.source?.generated_at,
        embedding:
          options.includeEmbedding && data.source?.embedding
            ? data.source.embedding
            : undefined,
      };
    });

    const filteredHits = hits.filter((hit) => hit.confidence >= minConfidence);

    filteredHits.sort((a, b) => b.score - a.score);

    const finalHits = filteredHits.slice(0, size);
    const count = filteredHits.length;
    const took = tookParts.reduce((sum, value) => sum + value, 0);

    return {
      hits: finalHits,
      count,
      took,
      mode: resolvedMode,
    };
  }

  async deleteIndex(): Promise<void> {
    const exists = await this.client.indices.exists({
      index: this.PRODUCT_EMBEDDINGS_INDEX,
    });

    if (exists) {
      await this.client.indices.delete({
        index: this.PRODUCT_EMBEDDINGS_INDEX,
      });
      console.log(
        `[ELASTICSEARCH MODULE] 🗑️ Index "${this.PRODUCT_EMBEDDINGS_INDEX}" deleted`
      );
    }
  }

  getClient(): Client {
    return this.client;
  }

  getQueue(): Queue<ProductEmbeddingJobData> {
    return this.queue;
  }
}
