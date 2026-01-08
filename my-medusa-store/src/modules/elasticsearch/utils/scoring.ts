export const getTotal = (total: any, fallback: number): number => {
  if (typeof total === "number") {
    return total;
  }
  if (typeof total?.value === "number") {
    return total.value;
  }
  return fallback;
};

export const calculateScore = (
  data: { bm25_score?: number; vector_score?: number },
  maxBm25Score: number,
  maxVectorScore: number,
  vectorWeight: number,
  bm25Weight: number
) => {
  const normalizedBm25 =
    maxBm25Score > 0 ? (data.bm25_score ?? 0) / maxBm25Score : 0;
  const normalizedVector =
    maxVectorScore > 0
      ? Math.min((data.vector_score ?? 0) / maxVectorScore, 1)
      : 0;

  const availableVectorWeight =
    data.vector_score !== undefined ? vectorWeight : 0;
  const availableBm25Weight = data.bm25_score !== undefined ? bm25Weight : 0;
  const availableWeightSum = availableVectorWeight + availableBm25Weight || 1;

  const confidence =
    (normalizedVector * availableVectorWeight +
      normalizedBm25 * availableBm25Weight) /
    availableWeightSum;

  // DEBUG: Log score details
  console.log('[SCORING DEBUG]', {
    raw_bm25: data.bm25_score,
    raw_vector: data.vector_score,
    max_bm25: maxBm25Score,
    max_vector: maxVectorScore,
    normalized_bm25: normalizedBm25.toFixed(3),
    normalized_vector: normalizedVector.toFixed(3),
    confidence: confidence.toFixed(3),
    weights: `${vectorWeight}/${bm25Weight}`
  });

  return { confidence };
};
