import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { StoreSearchService } from "../../../../lib/store-search-service";

const MAX_LIMIT = 25;
const MAX_QUERY_LENGTH = 2000;

type StoreSemanticSearchBody = {
  query?: string;
  limit?: number;
  min_confidence?: number;
};

type StoreSemanticSearchProductSummary = {
  id: string;
  title?: string | null;
  subtitle?: string | null;
  description?: string | null;
  handle?: string | null;
  thumbnail?: string | null;
};

const sanitizeLimit = (rawLimit: unknown): number => {
  if (typeof rawLimit === "number" && Number.isFinite(rawLimit)) {
    const limit = Math.trunc(rawLimit);
    return Math.max(1, Math.min(limit, MAX_LIMIT));
  }

  return 10;
};

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const logger = req.scope.resolve("logger") as any;
  const body = (req.body || {}) as StoreSemanticSearchBody;
  const rawQuery = typeof body.query === "string" ? body.query : "";
  const query = rawQuery.trim();

  const requestStartTime = Date.now();

  if (!query) {
    return res
      .status(400)
      .json({ message: "Body must include a non-empty 'query' string" });
  }

  if (query.length > MAX_QUERY_LENGTH) {
    return res.status(400).json({
      message: `Query exceeds maximum allowed length of ${MAX_QUERY_LENGTH} characters`,
    });
  }

  const limit = sanitizeLimit(body.limit);
  let minConfidence: number | undefined = undefined;
  if (body.min_confidence !== undefined) {
    if (
      typeof body.min_confidence !== "number" ||
      !Number.isFinite(body.min_confidence)
    ) {
      return res.status(400).json({
        message: "min_confidence must be a number between 0 and 1",
      });
    }

    minConfidence = Math.min(Math.max(body.min_confidence, 0), 1);
  }

  try {
    // Execute search using service layer
    const storeSearchService = new StoreSearchService(req.scope);
    const result = await storeSearchService.executeStoreSearch({
      query,
      limit,
      minConfidence,
    });

    return res.json(result);
  } catch (error: any) {
    logger.error("[Store Semantic Search] Failed to execute search", error);
    const message = error?.message || "Semantic search failed";

    if (message.toLowerCase().includes("embedding service")) {
      return res.status(503).json({
        message: "Embedding service unavailable",
        detail: message,
      });
    }

    return res.status(500).json({
      message: "Failed to execute semantic search",
      detail: message,
    });
  }
};
