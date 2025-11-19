export type ElasticsearchModuleOptions = {
  elasticsearch_url?: string;
  product_embeddings_index?: string;
  product_embedding_queue?: string;
  search?: {
    default_limit?: number;
    max_limit?: number;
    vector_weight?: number;
    bm25_weight?: number;
    overfetch_multiplier?: number;
    min_confidence?: number;
  };
  fuzzy?: {
    enabled?: boolean;
    fuzziness_level?: string;
    prefix_length?: number;
    max_expansions?: number;
  };
};

export type SemanticSearchFilters = {
  product_ids?: string[];
};

export type SearchMode = "hybrid" | "bm25" | "vector";

export type EmbeddingInput = {
  vectors: number[];
  dimensions: number;
};

export type SemanticSearchOptions = {
  query: string;
  embedding?: EmbeddingInput;
  limit?: number;
  filters?: SemanticSearchFilters;
  includeEmbedding?: boolean;
  mode?: SearchMode;
  minConfidence?: number;
};

export type SemanticSearchHit = {
  id: string;
  product_id?: string;
  score: number;
  bm25_score?: number;
  vector_score?: number;
  embedded_text?: string;
  metadata?: Record<string, any>;
  generated_at?: string;
  embedding?: {
    vectors: number[];
    dimensions: number;
  };
  confidence?: number;
};

export type SemanticSearchResult = {
  hits: SemanticSearchHit[];
  count: number;
  took: number;
  mode: SearchMode | "bm25-only";
};

export type ProductEmbeddingJobData = {
  product_id: string;
  embedded_text: string;
  embedding: {
    vectors: number[];
    dimensions: number;
  };
  metadata?: Record<string, any>;
};
