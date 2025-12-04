/**
 * ResultMerger - Merges BM25 and vector search results, calculates scores.
 * Extracted from SearchEngine to follow Single Responsibility Principle.
 */

import { calculateScore } from "../../utils/scoring";
import { SearchHit } from "./filter-pipeline";

export type RawHitData = {
  source?: Record<string, any>;
  bm25_score?: number;
  vector_score?: number;
};

export type MergeContext = {
  maxBm25Score: number;
  maxVectorScore: number;
  vectorWeight: number;
  bm25Weight: number;
  includeEmbedding: boolean;
};

/**
 * Process Elasticsearch response hits and update the hits map.
 */
export function processElasticsearchHits(
  hits: Array<{ _id?: string; _score?: number | null; _source?: any }>,
  hitsMap: Map<string, RawHitData>,
  scoreType: "bm25" | "vector"
): number {
  let maxScore = 0;

  for (const hit of hits) {
    if (!hit._id) continue;

    const source = (hit._source || {}) as Record<string, any>;
    const current = hitsMap.get(hit._id) || {};
    current.source = current.source || source;

    const score = typeof hit._score === "number" ? hit._score : 0;

    if (scoreType === "bm25") {
      current.bm25_score = score;
    } else {
      current.vector_score = score;
    }

    maxScore = Math.max(maxScore, score);
    hitsMap.set(hit._id, current);
  }

  return maxScore;
}

/**
 * Merge raw hits from BM25 and vector searches into scored SearchHit objects.
 */
export function mergeAndScoreHits(
  hitsMap: Map<string, RawHitData>,
  context: MergeContext
): SearchHit[] {
  const {
    maxBm25Score,
    maxVectorScore,
    vectorWeight,
    bm25Weight,
    includeEmbedding,
  } = context;

  return Array.from(hitsMap.entries()).map(([id, data]) => {
    const { confidence, combinedScore } = calculateScore(
      data,
      maxBm25Score,
      maxVectorScore,
      vectorWeight,
      bm25Weight
    );

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
        includeEmbedding && data.source?.embedding
          ? data.source.embedding
          : undefined,
    };
  });
}

/**
 * Filter hits by minimum confidence threshold.
 */
export function filterByConfidence(
  hits: SearchHit[],
  minConfidence: number
): SearchHit[] {
  return hits.filter((hit) => hit.confidence >= minConfidence);
}

/**
 * Filter hits by minimum combined score threshold.
 * Used to filter out low-relevance results.
 */
export function filterByMinScore(
  hits: SearchHit[],
  minScore: number
): SearchHit[] {
  return hits.filter((hit) => hit.score >= minScore);
}

/**
 * Sort hits by score in descending order.
 */
export function sortByScore(hits: SearchHit[]): SearchHit[] {
  return [...hits].sort((a, b) => b.score - a.score);
}

/**
 * Apply pagination to hits.
 */
export function paginateHits(
  hits: SearchHit[],
  offset: number,
  limit: number
): SearchHit[] {
  return hits.slice(offset, offset + limit);
}
