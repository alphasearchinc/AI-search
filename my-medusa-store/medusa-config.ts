import { loadEnv, defineConfig } from "@medusajs/framework/utils";

loadEnv(process.env.NODE_ENV || "development", process.cwd());

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET || "supersecret",
      cookieSecret: process.env.COOKIE_SECRET || "supersecret",
    },
  },
  modules: [
    {
      resolve: "./src/modules/elasticsearch",
      options: {
        elasticsearch_url: process.env.ELASTICSEARCH_URL,
        product_embeddings_index: process.env.PRODUCT_EMBEDDINGS_INDEX,
        product_embedding_queue: process.env.PRODUCT_EMBEDDING_QUEUE,
        search: {
          default_limit: process.env.SEARCH_DEFAULT_LIMIT
            ? parseInt(process.env.SEARCH_DEFAULT_LIMIT, 10)
            : undefined,
          max_limit: process.env.SEARCH_MAX_LIMIT
            ? parseInt(process.env.SEARCH_MAX_LIMIT, 10)
            : undefined,
          vector_weight: process.env.HYBRID_VECTOR_WEIGHT
            ? parseFloat(process.env.HYBRID_VECTOR_WEIGHT)
            : undefined,
          bm25_weight: process.env.HYBRID_BM25_WEIGHT
            ? parseFloat(process.env.HYBRID_BM25_WEIGHT)
            : undefined,
          overfetch_multiplier: process.env.SEARCH_OVERFETCH_MULTIPLIER
            ? parseInt(process.env.SEARCH_OVERFETCH_MULTIPLIER, 10)
            : undefined,
          min_confidence: process.env.SEMANTIC_SEARCH_MIN_CONFIDENCE
            ? parseFloat(process.env.SEMANTIC_SEARCH_MIN_CONFIDENCE)
            : undefined,
        },
        fuzzy: {
          enabled:
            process.env.SEARCH_FUZZY_ENABLED !== undefined
              ? process.env.SEARCH_FUZZY_ENABLED === "true"
              : undefined,
          fuzziness_level: process.env.SEARCH_FUZZINESS_LEVEL,
          prefix_length: process.env.SEARCH_PREFIX_LENGTH
            ? parseInt(process.env.SEARCH_PREFIX_LENGTH, 10)
            : undefined,
          max_expansions: process.env.SEARCH_MAX_EXPANSIONS
            ? parseInt(process.env.SEARCH_MAX_EXPANSIONS, 10)
            : undefined,
        },
      },
    },
  ],
});
