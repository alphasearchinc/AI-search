import { ElasticsearchModuleOptions } from "../types";

export const parseWeight = (
  raw: string | undefined,
  fallback: number
): number => {
  const parsed = Number.parseFloat(raw ?? "");
  if (Number.isFinite(parsed) && parsed >= 0) {
    return parsed;
  }
  return fallback;
};

export const parseMinConfidence = (
  raw: string | undefined,
  fallback: number
): number => {
  const parsed = Number.parseFloat(raw ?? "");
  if (Number.isFinite(parsed)) {
    return Math.min(Math.max(parsed, 0), 1);
  }
  return fallback;
};

export const getSearchConfig = (options: ElasticsearchModuleOptions) => {
  return {
    defaultLimit: options.search?.default_limit || 10,
    maxLimit: options.search?.max_limit || 50,
    vectorWeight: options.search?.vector_weight || 0.7,
    bm25Weight: options.search?.bm25_weight || 0.3,
    overfetchMultiplier: options.search?.overfetch_multiplier || 3,
    minConfidence: options.search?.min_confidence || 0.3,
  };
};

export const getFuzzyConfig = (options: ElasticsearchModuleOptions) => {
  return {
    enabled: options.fuzzy?.enabled ?? true,
    fuzzinessLevel: options.fuzzy?.fuzziness_level || "AUTO",
    prefixLength: options.fuzzy?.prefix_length || 2,
    maxExpansions: options.fuzzy?.max_expansions || 50,
  };
};
