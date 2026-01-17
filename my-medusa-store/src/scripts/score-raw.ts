import { Client } from "@elastic/elasticsearch";
import { loadEnv } from "@medusajs/framework/utils";
import { getFuzzyConfig, parseWeight } from "../modules/elasticsearch/utils/config";
import {
  buildBM25Query,
  buildVectorQuery,
} from "../modules/elasticsearch/services/search-engine/query-builder";
import { calculateScore } from "../modules/elasticsearch/utils/scoring";

const round = (value: number) => Math.round(value * 1000) / 1000;

const getArgValue = (flag: string) => {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
};

const summarizeScores = (label: string, scores: number[]) => {
  if (scores.length === 0) {
    console.log(`${label}: (no scores)`);
    return;
  }
  const max = Math.max(...scores);
  const min = Math.min(...scores);
  const mean = scores.reduce((sum, value) => sum + value, 0) / scores.length;
  console.log(
    `${label}: min=${round(min)} mean=${round(mean)} max=${round(max)}`
  );
};

const getIndexDimensions = async (
  client: Client,
  indexName: string
): Promise<number | null> => {
  const mapping = await client.indices.getMapping({ index: indexName });
  const indexMapping = (mapping as any)[indexName];
  const field = indexMapping?.mappings?.properties?.embedding_vector;
  if (field?.type === "dense_vector" && typeof field.dims === "number") {
    return field.dims;
  }
  return null;
};

const fetchLocalEmbedding = async (embeddingUrl: string, text: string) => {
  const response = await fetch(`${embeddingUrl}/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    throw new Error(
      `Local embedder error: HTTP ${response.status} ${response.statusText}`
    );
  }

  const data = (await response.json()) as {
    embedding?: { vectors?: number[] };
  };
  const vectors = data?.embedding?.vectors;
  if (
    !Array.isArray(vectors) ||
    vectors.some((value) => typeof value !== "number")
  ) {
    throw new Error("Local embedder returned invalid vectors");
  }
  return vectors;
};

async function run() {
  loadEnv(process.env.NODE_ENV || "development", process.cwd());

  const query =
    getArgValue("--query") || process.argv[2] || process.env.SEARCH_QUERY || "gaming laptop";
  const size = Number.parseInt(getArgValue("--size") || "20", 10);

  const embeddingUrl =
    getArgValue("--embedding-url") || process.env.LOCAL_EMBEDDING_SERVICE_URL;
  if (!embeddingUrl) {
    throw new Error(
      "Provide --embedding-url (e.g. http://localhost:1337) to compute query vectors"
    );
  }

  const indexName =
    process.env.PRODUCT_EMBEDDINGS_INDEX || "product-embeddings";
  const elasticUrl =
    process.env.ELASTICSEARCH_URL || "http://localhost:9200";

  const client = new Client({ node: elasticUrl });

  const vectors = await fetchLocalEmbedding(embeddingUrl, query);
  const indexDims = await getIndexDimensions(client, indexName);
  if (indexDims && vectors.length !== indexDims) {
    throw new Error(
      `Embedding dims ${vectors.length} != index dims ${indexDims} (check embedder/model)`
    );
  }

  const fuzzyConfig = getFuzzyConfig({});
  const fuzzyEnabled = process.env.SEARCH_FUZZY_ENABLED !== "false";

  const bm25Query = buildBM25Query({
    query,
    fuzzyConfig: {
      enabled: fuzzyConfig.enabled,
      fuzzinessLevel:
        process.env.SEARCH_FUZZINESS_LEVEL || fuzzyConfig.fuzzinessLevel,
      prefixLength: parseWeight(
        process.env.SEARCH_PREFIX_LENGTH,
        fuzzyConfig.prefixLength
      ),
      maxExpansions: parseWeight(
        process.env.SEARCH_MAX_EXPANSIONS,
        fuzzyConfig.maxExpansions
      ),
    },
    fuzzyEnabled,
    filterClauses: [],
  });

  const vectorQuery = buildVectorQuery(vectors, []);

  const [bm25Response, vectorResponse] = await Promise.all([
    client.search({
      index: indexName,
      size,
      track_total_hits: true,
      query: bm25Query,
      _source: ["product_id", "metadata"],
    }),
    client.search({
      index: indexName,
      size,
      track_total_hits: true,
      query: vectorQuery,
      _source: ["product_id", "metadata"],
    }),
  ]);

  const bm25Hits = (bm25Response.hits.hits ?? [])
    .map((hit, idx) => {
      const id = hit._id;
      if (!id) return null;
      return {
        rank: idx + 1,
        id,
        title: (hit._source as any)?.metadata?.title as string | undefined,
        score: round(typeof hit._score === "number" ? hit._score : 0),
      };
    })
    .filter((hit): hit is NonNullable<typeof hit> => !!hit);

  const vectorHits = (vectorResponse.hits.hits ?? [])
    .map((hit, idx) => {
      const id = hit._id;
      if (!id) return null;
      return {
        rank: idx + 1,
        id,
        title: (hit._source as any)?.metadata?.title as string | undefined,
        score: round(typeof hit._score === "number" ? hit._score : 0),
      };
    })
    .filter((hit): hit is NonNullable<typeof hit> => !!hit);

  // Resolve weights the same way SearchEngine does (normalize to sum=1)
  const rawVectorWeight = parseWeight(process.env.HYBRID_VECTOR_WEIGHT, 0.7);
  const rawBm25Weight = parseWeight(process.env.HYBRID_BM25_WEIGHT, 0.3);
  const weightSum = rawVectorWeight + rawBm25Weight;
  const vectorWeight = weightSum > 0 ? rawVectorWeight / weightSum : 0.7;
  const bm25Weight = weightSum > 0 ? rawBm25Weight / weightSum : 0.3;

  const bm25ScoreList = bm25Hits.map((h) => h.score).filter((s) => s > 0);
  const vectorScoreList = vectorHits.map((h) => h.score).filter((s) => s > 0);

  const bm25Ranks = new Map<string, number>();
  const vectorRanks = new Map<string, number>();
  const bm25Scores = new Map<string, number>();
  const vectorScores = new Map<string, number>();
  const titles = new Map<string, string | undefined>();
  for (const h of bm25Hits) bm25Ranks.set(h.id, h.rank);
  for (const h of vectorHits) vectorRanks.set(h.id, h.rank);
  for (const h of bm25Hits) bm25Scores.set(h.id, h.score);
  for (const h of vectorHits) vectorScores.set(h.id, h.score);
  for (const h of bm25Hits) titles.set(h.id, h.title);
  for (const h of vectorHits) titles.set(h.id, titles.get(h.id) ?? h.title);

  const overlap = new Set<string>();
  for (const id of bm25Ranks.keys()) {
    if (vectorRanks.has(id)) overlap.add(id);
  }

  console.log(`\nQuery: "${query}"`);
  console.log(`Index: ${indexName}`);
  console.log(`Embedding source: ${embeddingUrl} (${vectors.length}D)`);
  console.log(`Top N: ${size}`);
  console.log(`Overlap (BM25 ∩ Vector): ${overlap.size}`);
  console.log(
    `Weights (normalized): vector=${round(vectorWeight)} bm25=${round(bm25Weight)}`
  );

  summarizeScores("BM25 raw _score", bm25ScoreList);
  summarizeScores("Vector raw _score", vectorScoreList);

  console.log("\nBM25 top hits (raw _score)");
  console.table(bm25Hits);

  console.log("\nVector top hits (raw _score)");
  console.table(vectorHits);

  const mergedIds = new Set<string>();
  for (const h of bm25Hits) mergedIds.add(h.id);
  for (const h of vectorHits) mergedIds.add(h.id);

  const maxBm25 = bm25ScoreList.length > 0 ? Math.max(...bm25ScoreList) : 0;
  const maxVector = vectorScoreList.length > 0 ? Math.max(...vectorScoreList) : 0;

  const merged = Array.from(mergedIds).map((id) => {
    const bm25_score = bm25Scores.get(id) ?? 0;
    const vector_score = vectorScores.get(id) ?? 0;
    const weighted_score = vector_score * vectorWeight + bm25_score * bm25Weight;
    const { confidence: normalized_weighted_score } = calculateScore(
      { bm25_score: bm25_score || undefined, vector_score: vector_score || undefined },
      maxBm25,
      maxVector,
      vectorWeight,
      bm25Weight
    );

    return {
      id,
      title: titles.get(id),
      bm25_score: round(bm25_score),
      vector_score: round(vector_score),
      bm25_rank: bm25Ranks.get(id),
      vector_rank: vectorRanks.get(id),
      weighted_score: round(weighted_score),
      normalized_weighted_score: round(normalized_weighted_score),
    };
  });

  console.log(
    "\nMerged + weighted (proof): weighted_score = vector_score*vectorWeight + bm25_score*bm25Weight"
  );
  console.table([...merged].sort((a, b) => b.weighted_score - a.weighted_score));

  console.log(
    "\nMerged + normalized weighted (how hybrid ranking works now): normalized_weighted_score = 0.7*(vector/maxVector) + 0.3*(bm25/maxBm25)"
  );
  console.table(
    [...merged].sort(
      (a, b) => b.normalized_weighted_score - a.normalized_weighted_score
    )
  );

  console.log("\nOverlap ranks (no weighting)");
  console.table(
    Array.from(overlap).map((id) => ({
      id,
      bm25_rank: bm25Ranks.get(id),
      vector_rank: vectorRanks.get(id),
    }))
  );
}

run().catch((error) => {
  const meta = (error as any)?.meta;
  const rootCause =
    meta?.body?.error?.root_cause
      ?.map((cause: any) => cause?.reason)
      .join("; ") || meta?.body?.error?.reason;
  if (rootCause) {
    console.error(`[score-raw] ${rootCause}`);
  } else {
    console.error(
      `[score-raw] ${error instanceof Error ? error.message : String(error)}`
    );
  }
  process.exit(1);
});

