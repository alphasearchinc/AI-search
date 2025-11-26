import { MedusaService } from "@medusajs/framework/utils";
import { Client } from "@elastic/elasticsearch";
import {
  ElasticsearchModuleOptions,
  SemanticSearchOptions,
  SemanticSearchResult,
  ProductEmbeddingJobData,
  RecommendationHit,
} from "../types";
import { ElasticsearchQueue } from "../jobs/queue";
import { ElasticsearchWorker } from "../jobs/worker";
import { IndexManager } from "./index-manager";
import { SearchEngine } from "./search-engine";
import { EmbeddingRetrievalService } from "./embedding-retrieval";

export default class ElasticsearchModuleService extends MedusaService({}) {
  private client: Client;
  private queue: ElasticsearchQueue;
  private worker: ElasticsearchWorker;
  private indexManager: IndexManager;
  private searchEngine: SearchEngine;
  private embeddingRetrieval: EmbeddingRetrievalService;
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

    this.indexManager = new IndexManager(
      this.client,
      this.PRODUCT_EMBEDDINGS_INDEX
    );
    this.searchEngine = new SearchEngine(
      this.client,
      this.PRODUCT_EMBEDDINGS_INDEX,
      this.options_
    );
    this.embeddingRetrieval = new EmbeddingRetrievalService(
      this.client,
      this.PRODUCT_EMBEDDINGS_INDEX
    );
    this.queue = new ElasticsearchQueue(this.PRODUCT_EMBEDDING_QUEUE);
    this.worker = new ElasticsearchWorker(
      this.PRODUCT_EMBEDDING_QUEUE,
      this.indexManager
    );
  }

  async onApplicationStart(): Promise<void> {
    await this.indexManager.initializeIndex();
  }

  async initializeIndex(): Promise<void> {
    await this.indexManager.initializeIndex();
  }

  async queueEmbedding(data: ProductEmbeddingJobData): Promise<void> {
    await this.queue.add(data);
  }

  async indexEmbedding(data: ProductEmbeddingJobData): Promise<void> {
    await this.indexManager.indexEmbedding(data);
  }

  startWorker(): void {
    this.worker.start();
  }

  async stopWorker(): Promise<void> {
    await this.worker.stop();
  }

  async semanticSearch(
    options: SemanticSearchOptions
  ): Promise<SemanticSearchResult> {
    return this.searchEngine.search(options);
  }

  async deleteIndex(): Promise<void> {
    await this.indexManager.deleteIndex();
  }

  async listEmbeddings(options: { limit?: number; offset?: number }): Promise<{
    embeddings: Array<{
      id: string;
      product_id: string;
      embedded_text: string;
      metadata?: any;
      generated_at?: string;
      embedding?: any;
    }>;
    count: number;
  }> {
    return this.embeddingRetrieval.listEmbeddings(options);
  }

  async getEmbeddingByProductId(productId: string): Promise<{
    id: string;
    product_id: string;
    embedded_text: string;
    embedding?: { vectors: number[]; dimensions: number };
    embedding_vector?: number[];
    metadata?: Record<string, any>;
    generated_at?: string;
  } | null> {
    return this.embeddingRetrieval.getEmbeddingByProductId(productId);
  }

  getClient(): Client {
    return this.client;
  }

  getQueue() {
    return this.queue.getQueue();
  }

  /**
   * Find similar products using kNN vector search
   */
  async findSimilarProducts(options: {
    queryVector: number[];
    limit: number;
    excludeProductId?: string;
  }): Promise<{
    hits: RecommendationHit[];
    took: number;
  }> {
    const searchResponse = await this.client.search({
      index: this.PRODUCT_EMBEDDINGS_INDEX,
      size: options.limit,
      knn: {
        field: "embedding",
        query_vector: options.queryVector,
        k: options.limit,
        num_candidates: Math.max(options.limit * 2, 50),
      },
      _source: ["product_id", "embedded_text", "metadata", "generated_at"],
    });

    const hits = searchResponse.hits.hits.map((hit) => {
      const source = hit._source as any;
      return {
        id: hit._id as string,
        product_id: source.product_id,
        score: hit._score || 0,
        vector_score: hit._score || 0,
        confidence: hit._score ? Math.min(hit._score, 1) : 0,
        embedded_text: source.embedded_text,
        metadata: source.metadata,
        generated_at: source.generated_at,
      };
    });

    return {
      hits,
      took: searchResponse.took || 0,
    };
  }
}
