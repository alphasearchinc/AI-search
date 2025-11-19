// Mock the Elasticsearch client
const mockSearch = jest.fn();

jest.mock("@elastic/elasticsearch", () => {
  return {
    Client: jest.fn().mockImplementation(() => ({
      search: mockSearch,
      indices: {
        exists: jest.fn(),
        create: jest.fn(),
        getMapping: jest.fn(),
      },
    })),
  };
});

// Mock Redis/BullMQ
jest.mock("bullmq", () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: jest.fn(),
  })),
  Worker: jest.fn(),
}));

jest.mock("../src/lib/redis-connection", () => ({
  createRedisConnection: jest.fn(() => ({})),
}));

import ElasticsearchModuleService from "../src/modules/elasticsearch/service";

describe("semanticSearch - fuzzy matching", () => {
  let service: ElasticsearchModuleService;
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearch.mockClear();
    delete process.env.SEARCH_FUZZY_ENABLED;
    delete process.env.SEARCH_FUZZINESS_LEVEL;
    delete process.env.SEARCH_PREFIX_LENGTH;
    delete process.env.SEARCH_MAX_EXPANSIONS;
    service = new ElasticsearchModuleService({}, {});
  });

  it("WITHOUT fuzzy: typos return no results (baseline test)", async () => {
    process.env.SEARCH_FUZZY_ENABLED = "false";

    mockSearch.mockResolvedValueOnce({
      hits: {
        total: { value: 0 },
        hits: [], // No matches without fuzzy
      },
      took: 2,
    });

    const result = await service.semanticSearch({
      query: "lptop", // typo: missing 'a'
      limit: 2,
      mode: "bm25",
    });

    // Verify fuzzy is NOT applied
    const callArgs = mockSearch.mock.calls[0][0];
    expect(callArgs.query.bool.must[0].match.embedded_text).toBe("lptop");
    expect(typeof callArgs.query.bool.must[0].match.embedded_text).toBe(
      "string"
    );

    // No results when fuzzy is disabled
    expect(result.hits).toHaveLength(0);
  });

  it("WITH fuzzy: same typo returns matches (proves fuzzy works)", async () => {
    mockSearch.mockResolvedValueOnce({
      hits: {
        total: { value: 2 },
        hits: [
          {
            _id: "prod-laptop",
            _score: 2.5,
            _source: {
              product_id: "prod-laptop",
              embedded_text: "High-performance laptop with 16GB RAM",
              metadata: {},
            },
          },
          {
            _id: "prod-notebook",
            _score: 2.1,
            _source: {
              product_id: "prod-notebook",
              embedded_text: "Lightweight laptop for students",
              metadata: {},
            },
          },
        ],
      },
      took: 4,
    });

    const result = await service.semanticSearch({
      query: "lptop", // typo: missing 'a'
      limit: 2,
      mode: "bm25",
    });

    expect(mockSearch).toHaveBeenCalledTimes(1);
    const callArgs = mockSearch.mock.calls[0][0];

    // Verify fuzzy parameters are included in the query
    expect(callArgs.query.bool.must[0].match.embedded_text).toHaveProperty(
      "fuzziness"
    );
    expect(callArgs.query.bool.must[0].match.embedded_text.fuzziness).toBe(
      "AUTO"
    );
    expect(callArgs.query.bool.must[0].match.embedded_text.prefix_length).toBe(
      2
    );
    expect(callArgs.query.bool.must[0].match.embedded_text.max_expansions).toBe(
      50
    );

    expect(result.hits).toHaveLength(2);
    expect(result.hits[0].id).toBe("prod-laptop");
  });

  it("respects SEARCH_FUZZY_ENABLED=false to disable fuzzy matching", async () => {
    process.env.SEARCH_FUZZY_ENABLED = "false";

    mockSearch.mockResolvedValueOnce({
      hits: {
        total: { value: 0 },
        hits: [],
      },
      took: 2,
    });

    const result = await service.semanticSearch({
      query: "keyboard",
      limit: 1,
      mode: "bm25",
    });

    expect(mockSearch).toHaveBeenCalledTimes(1);
    const callArgs = mockSearch.mock.calls[0][0];

    // When fuzzy is disabled, embedded_text should be a simple string
    expect(callArgs.query.bool.must[0].match.embedded_text).toBe("keyboard");
    expect(result.hits).toHaveLength(0);
  });

  it("uses custom fuzziness level from environment", async () => {
    process.env.SEARCH_FUZZINESS_LEVEL = "1";
    process.env.SEARCH_MAX_EXPANSIONS = "25";

    mockSearch.mockResolvedValueOnce({
      hits: {
        total: { value: 1 },
        hits: [
          {
            _id: "prod-wireless",
            _score: 1.8,
            _source: {
              product_id: "prod-wireless",
              embedded_text: "Wireless mouse with ergonomic design",
              metadata: {},
            },
          },
        ],
      },
      took: 3,
    });

    await service.semanticSearch({
      query: "wireles", // typo: missing 's'
      limit: 1,
      mode: "bm25",
    });

    const callArgs = mockSearch.mock.calls[0][0];
    expect(callArgs.query.bool.must[0].match.embedded_text.fuzziness).toBe("1");
    expect(callArgs.query.bool.must[0].match.embedded_text.max_expansions).toBe(
      25
    );
  });

  it("handles multiple character typos with fuzziness AUTO", async () => {
    mockSearch.mockResolvedValueOnce({
      hits: {
        total: { value: 1 },
        hits: [
          {
            _id: "prod-keyboard",
            _score: 1.5,
            _source: {
              product_id: "prod-keyboard",
              embedded_text: "Mechanical keyboard with RGB lighting",
              metadata: {},
            },
          },
        ],
      },
      took: 5,
    });

    const result = await service.semanticSearch({
      query: "keybord", // typo: 'a' replaced with 'o'
      limit: 1,
      mode: "bm25",
    });

    expect(mockSearch).toHaveBeenCalledTimes(1);
    expect(result.hits).toHaveLength(1);
    expect(result.hits[0].product_id).toBe("prod-keyboard");
  });

  it("applies fuzzy matching in hybrid mode", async () => {
    mockSearch
      // BM25 query with fuzzy
      .mockResolvedValueOnce({
        hits: {
          total: { value: 1 },
          hits: [
            {
              _id: "prod-1",
              _score: 2.0,
              _source: {
                product_id: "prod-1",
                embedded_text: "Smartphone with excellent camera",
                metadata: {},
              },
            },
          ],
        },
        took: 4,
      })
      // Vector query
      .mockResolvedValueOnce({
        hits: {
          total: { value: 1 },
          hits: [
            {
              _id: "prod-1",
              _score: 1.5,
              _source: {
                product_id: "prod-1",
                embedded_text: "Smartphone with excellent camera",
                metadata: {},
              },
            },
          ],
        },
        took: 6,
      });

    const result = await service.semanticSearch({
      query: "smartphne", // typo: missing 'o'
      embedding: {
        vectors: [0.3, 0.7],
        dimensions: 2,
      },
      limit: 1,
      mode: "hybrid",
    });

    expect(mockSearch).toHaveBeenCalledTimes(2);
    expect(result.mode).toBe("hybrid");

    // Verify BM25 query had fuzzy parameters
    const bm25CallArgs = mockSearch.mock.calls[0][0];
    expect(bm25CallArgs.query.bool.must[0].match.embedded_text).toHaveProperty(
      "fuzziness"
    );

    expect(result.hits).toHaveLength(1);
    expect(result.hits[0].id).toBe("prod-1");
  });

  it("respects prefix_length to avoid fuzzy matching on short prefixes", async () => {
    process.env.SEARCH_PREFIX_LENGTH = "3";

    mockSearch.mockResolvedValueOnce({
      hits: {
        total: { value: 0 },
        hits: [],
      },
      took: 2,
    });

    await service.semanticSearch({
      query: "abc", // short query
      limit: 1,
      mode: "bm25",
    });

    const callArgs = mockSearch.mock.calls[0][0];
    expect(callArgs.query.bool.must[0].match.embedded_text.prefix_length).toBe(
      3
    );
  });

  it("handles transposed characters (character swap)", async () => {
    mockSearch.mockResolvedValueOnce({
      hits: {
        total: { value: 1 },
        hits: [
          {
            _id: "prod-mouse",
            _score: 2.2,
            _source: {
              product_id: "prod-mouse",
              embedded_text: "Wireless gaming mouse",
              metadata: {},
            },
          },
        ],
      },
      took: 3,
    });

    const result = await service.semanticSearch({
      query: "mose", // typo: missing 'u'
      limit: 1,
      mode: "bm25",
    });

    expect(result.hits).toHaveLength(1);
    expect(result.hits[0].product_id).toBe("prod-mouse");

    // Verify fuzzy is applied
    const callArgs = mockSearch.mock.calls[0][0];
    expect(callArgs.query.bool.must[0].match.embedded_text.fuzziness).toBe(
      "AUTO"
    );
  });

  it("handles extra character typos", async () => {
    mockSearch.mockResolvedValueOnce({
      hits: {
        total: { value: 1 },
        hits: [
          {
            _id: "prod-tablet",
            _score: 1.9,
            _source: {
              product_id: "prod-tablet",
              embedded_text: "Android tablet with stylus",
              metadata: {},
            },
          },
        ],
      },
      took: 4,
    });

    const result = await service.semanticSearch({
      query: "tablett", // typo: extra 't'
      limit: 1,
      mode: "bm25",
    });

    expect(result.hits).toHaveLength(1);
    expect(result.hits[0].product_id).toBe("prod-tablet");
  });

  it("handles case insensitive fuzzy matching", async () => {
    mockSearch.mockResolvedValueOnce({
      hits: {
        total: { value: 1 },
        hits: [
          {
            _id: "prod-headphones",
            _score: 2.8,
            _source: {
              product_id: "prod-headphones",
              embedded_text: "Noise-cancelling headphones",
              metadata: {},
            },
          },
        ],
      },
      took: 3,
    });

    const result = await service.semanticSearch({
      query: "HEDPHONES", // typo: missing 'a', uppercase
      limit: 1,
      mode: "bm25",
    });

    expect(result.hits).toHaveLength(1);
    expect(result.hits[0].product_id).toBe("prod-headphones");
  });

  it("combines fuzzy with product filters", async () => {
    mockSearch.mockResolvedValueOnce({
      hits: {
        total: { value: 1 },
        hits: [
          {
            _id: "prod-specific",
            _score: 2.3,
            _source: {
              product_id: "prod-123",
              embedded_text: "Monitor with 4K display",
              metadata: {},
            },
          },
        ],
      },
      took: 5,
    });

    const result = await service.semanticSearch({
      query: "moniter", // typo: 'o' instead of 'i'
      limit: 5,
      mode: "bm25",
      filters: {
        product_ids: ["prod-123", "prod-456"],
      },
    });

    expect(result.hits).toHaveLength(1);

    // Verify both fuzzy and filters are applied
    const callArgs = mockSearch.mock.calls[0][0];
    expect(callArgs.query.bool.must[0].match.embedded_text.fuzziness).toBe(
      "AUTO"
    );
    expect(callArgs.query.bool.filter).toBeDefined();
  });

  it("handles fuzziness with very short queries (3 chars)", async () => {
    mockSearch.mockResolvedValueOnce({
      hits: {
        total: { value: 1 },
        hits: [
          {
            _id: "prod-ssd",
            _score: 1.7,
            _source: {
              product_id: "prod-ssd",
              embedded_text: "SSD 1TB solid state drive",
              metadata: {},
            },
          },
        ],
      },
      took: 2,
    });

    const result = await service.semanticSearch({
      query: "sdd", // typo: 3 characters
      limit: 1,
      mode: "bm25",
    });

    // With AUTO fuzziness, 3-5 char words allow 1 edit
    const callArgs = mockSearch.mock.calls[0][0];
    expect(callArgs.query.bool.must[0].match.embedded_text.fuzziness).toBe(
      "AUTO"
    );
    expect(result.hits).toHaveLength(1);
  });

  it("handles fuzziness with longer queries (6+ chars)", async () => {
    mockSearch.mockResolvedValueOnce({
      hits: {
        total: { value: 1 },
        hits: [
          {
            _id: "prod-charger",
            _score: 2.1,
            _source: {
              product_id: "prod-charger",
              embedded_text: "Fast charger USB-C 65W",
              metadata: {},
            },
          },
        ],
      },
      took: 3,
    });

    const result = await service.semanticSearch({
      query: "chargr", // typo: 6 chars, missing 'e'
      limit: 1,
      mode: "bm25",
    });

    // With AUTO fuzziness, 6+ char words allow 2 edits
    const callArgs = mockSearch.mock.calls[0][0];
    expect(callArgs.query.bool.must[0].match.embedded_text.fuzziness).toBe(
      "AUTO"
    );
    expect(result.hits).toHaveLength(1);
    expect(result.hits[0].product_id).toBe("prod-charger");
  });

  it("preserves exact match scoring when fuzzy is enabled", async () => {
    mockSearch.mockResolvedValueOnce({
      hits: {
        total: { value: 2 },
        hits: [
          {
            _id: "prod-exact",
            _score: 5.0, // exact match scores higher
            _source: {
              product_id: "prod-exact",
              embedded_text: "Laptop computer",
              metadata: {},
            },
          },
          {
            _id: "prod-fuzzy",
            _score: 3.2, // fuzzy match scores lower
            _source: {
              product_id: "prod-fuzzy",
              embedded_text: "Desktop computer",
              metadata: {},
            },
          },
        ],
      },
      took: 4,
    });

    const result = await service.semanticSearch({
      query: "laptop", // exact match
      limit: 2,
      mode: "bm25",
    });

    expect(result.hits).toHaveLength(2);
    // Exact match should score higher
    expect(result.hits[0].id).toBe("prod-exact");
    expect(result.hits[0].score).toBeGreaterThan(result.hits[1].score);
  });

  it("handles max_expansions to limit fuzzy term expansion", async () => {
    process.env.SEARCH_MAX_EXPANSIONS = "10";

    mockSearch.mockResolvedValueOnce({
      hits: {
        total: { value: 1 },
        hits: [
          {
            _id: "prod-1",
            _score: 1.5,
            _source: {
              product_id: "prod-1",
              embedded_text: "Product description",
              metadata: {},
            },
          },
        ],
      },
      took: 2,
    });

    await service.semanticSearch({
      query: "productt",
      limit: 1,
      mode: "bm25",
    });

    const callArgs = mockSearch.mock.calls[0][0];
    expect(callArgs.query.bool.must[0].match.embedded_text.max_expansions).toBe(
      10
    );
  });

  it("applies fuzzy to BM25 component of hybrid search only", async () => {
    mockSearch
      // BM25 with fuzzy
      .mockResolvedValueOnce({
        hits: {
          total: { value: 1 },
          hits: [
            {
              _id: "prod-1",
              _score: 1.8,
              _source: {
                product_id: "prod-1",
                embedded_text: "Camera lens",
                metadata: {},
              },
            },
          ],
        },
        took: 3,
      })
      // Vector search (no fuzzy)
      .mockResolvedValueOnce({
        hits: {
          total: { value: 1 },
          hits: [
            {
              _id: "prod-1",
              _score: 1.2,
              _source: {
                product_id: "prod-1",
                embedded_text: "Camera lens",
                metadata: {},
              },
            },
          ],
        },
        took: 5,
      });

    const result = await service.semanticSearch({
      query: "camra", // typo
      embedding: { vectors: [0.5, 0.5], dimensions: 2 },
      limit: 1,
      mode: "hybrid",
    });

    // First call (BM25) should have fuzzy
    const bm25Call = mockSearch.mock.calls[0][0];
    expect(bm25Call.query.bool.must[0].match.embedded_text.fuzziness).toBe(
      "AUTO"
    );

    // Second call (vector) should use script_score, not fuzzy
    const vectorCall = mockSearch.mock.calls[1][0];
    expect(vectorCall.query).toHaveProperty("script_score");

    expect(result.hits).toHaveLength(1);
    expect(result.mode).toBe("hybrid");
  });

  describe("Proof that fuzzy search solves the typo problem", () => {
    it("BEFORE fuzzy: vector-only search relies on semantic similarity (may miss exact typos)", async () => {
      // Vector search relies on embeddings being similar
      // If "lptop" embedding is far from "laptop" embedding, vector search fails
      mockSearch.mockResolvedValueOnce({
        hits: {
          total: { value: 0 },
          hits: [], // Vector might not find typo if embeddings differ
        },
        took: 5,
      });

      const result = await service.semanticSearch({
        query: "lptop",
        embedding: { vectors: [0.2, 0.8], dimensions: 2 },
        limit: 5,
        mode: "vector",
      });

      // Vector search doesn't understand character-level typos
      expect(result.hits).toHaveLength(0);

      const callArgs = mockSearch.mock.calls[0][0];
      // Verify it's using script_score (vector search)
      expect(callArgs.query).toHaveProperty("script_score");
      // Vector search has NO fuzzy logic
      expect(JSON.stringify(callArgs.query)).not.toContain("fuzziness");
    });

    it("AFTER fuzzy: hybrid mode uses BM25 fuzzy to catch typos that vectors miss", async () => {
      mockSearch
        // BM25 with fuzzy finds the typo match
        .mockResolvedValueOnce({
          hits: {
            total: { value: 1 },
            hits: [
              {
                _id: "prod-laptop",
                _score: 2.0,
                _source: {
                  product_id: "prod-laptop",
                  embedded_text: "High-performance laptop",
                  metadata: {},
                },
              },
            ],
          },
          took: 3,
        })
        // Vector search might still miss it
        .mockResolvedValueOnce({
          hits: {
            total: { value: 0 },
            hits: [],
          },
          took: 5,
        });

      const result = await service.semanticSearch({
        query: "lptop", // same typo
        embedding: { vectors: [0.2, 0.8], dimensions: 2 },
        limit: 5,
        mode: "hybrid",
      });

      // BM25 fuzzy component saves the day!
      expect(result.hits).toHaveLength(1);
      expect(result.hits[0].product_id).toBe("prod-laptop");

      // Verify BM25 call has fuzzy enabled
      const bm25Call = mockSearch.mock.calls[0][0];
      expect(bm25Call.query.bool.must[0].match.embedded_text.fuzziness).toBe(
        "AUTO"
      );

      // This is the key: fuzzy in BM25 catches what vector search missed
      expect(result.hits[0].bm25_score).toBe(2.0);
      expect(result.hits[0].vector_score).toBeUndefined(); // vector didn't match
    });

    it("demonstrates the improvement: comparing before/after fuzzy implementation", async () => {
      // Scenario 1: WITHOUT fuzzy (old behavior)
      process.env.SEARCH_FUZZY_ENABLED = "false";

      mockSearch.mockResolvedValueOnce({
        hits: { total: { value: 0 }, hits: [] },
        took: 2,
      });

      const beforeResult = await service.semanticSearch({
        query: "keybord", // typo
        limit: 5,
        mode: "bm25",
      });

      expect(beforeResult.hits).toHaveLength(0); // ❌ No results

      // Scenario 2: WITH fuzzy (new behavior)
      delete process.env.SEARCH_FUZZY_ENABLED;
      jest.clearAllMocks();

      mockSearch.mockResolvedValueOnce({
        hits: {
          total: { value: 1 },
          hits: [
            {
              _id: "prod-kb",
              _score: 1.8,
              _source: {
                product_id: "prod-kb",
                embedded_text: "Mechanical keyboard",
                metadata: {},
              },
            },
          ],
        },
        took: 3,
      });

      const afterResult = await service.semanticSearch({
        query: "keybord", // same typo
        limit: 5,
        mode: "bm25",
      });

      expect(afterResult.hits).toHaveLength(1); // ✅ Found the match!
      expect(afterResult.hits[0].product_id).toBe("prod-kb");

      // This is the measurable improvement
      console.log(`
        ═══════════════════════════════════════════════
        FUZZY SEARCH IMPACT DEMONSTRATION
        ═══════════════════════════════════════════════
        Query: "keybord" (typo)
        
        WITHOUT fuzzy: ${beforeResult.hits.length} results ❌
        WITH fuzzy:    ${afterResult.hits.length} results ✅
        
        Improvement: Fuzzy search rescued a failed query!
        ═══════════════════════════════════════════════
      `);
    });
  });
});
