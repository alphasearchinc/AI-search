import ElasticsearchModuleService from "../src/modules/elasticsearch/services/main";

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

describe("semanticSearch - hybrid ranking", () => {
  let service: ElasticsearchModuleService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSearch.mockClear();
    
    // Create service with test options
    service = new ElasticsearchModuleService({}, {
      search: {
        vector_weight: 0.7,
        bm25_weight: 0.3,
      },
    });
  });

  it("combines BM25 and vector scores with default weights", async () => {
    mockSearch
      // BM25 query
      .mockResolvedValueOnce({
        hits: {
          total: { value: 2 },
          hits: [
            {
              _id: "prod-1",
              _score: 3,
              _source: {
                product_id: "prod-1",
                embedded_text: "Laptop with 4K display",
                metadata: {},
              },
            },
            {
              _id: "prod-2",
              _score: 2,
              _source: {
                product_id: "prod-2",
                embedded_text: "Wireless mouse",
                metadata: {},
              },
            },
          ],
        },
        took: 5,
      })
      // Vector query
      .mockResolvedValueOnce({
        hits: {
          total: { value: 2 },
          hits: [
            {
              _id: "prod-1",
              _score: 1.2, // cosineSimilarity + 1
              _source: {
                product_id: "prod-1",
                embedded_text: "Laptop with 4K display",
                metadata: {},
              },
            },
            {
              _id: "prod-3",
              _score: 1.3,
              _source: {
                product_id: "prod-3",
                embedded_text: "Mechanical keyboard",
                metadata: {},
              },
            },
          ],
        },
        took: 7,
      });

    const result = await service.semanticSearch({
      query: "laptop",
      embedding: {
        vectors: [0.1, 0.2],
        dimensions: 2,
      },
      limit: 3,
      mode: "hybrid",
    });

    expect(mockSearch).toHaveBeenCalledTimes(2);
    expect(result.mode).toBe("hybrid");
    expect(result.hits).toHaveLength(3);

    const [first, second, third] = result.hits;
    expect(first.id).toBe("prod-1");
    expect(first.vector_score).toBeCloseTo(1.2);
    expect(first.bm25_score).toBeCloseTo(3);
    expect(first.score).toBeCloseTo(1.74); // 1.2 * 0.7 + 3 * 0.3

    expect(second.id).toBe("prod-3");
    expect(second.vector_score).toBeCloseTo(1.3);
    expect(second.bm25_score).toBeUndefined();

    expect(third.id).toBe("prod-2");
    expect(third.bm25_score).toBeCloseTo(2);
    expect(third.vector_score).toBeUndefined();
  });

  it("runs BM25-only when requested without embeddings", async () => {
    mockSearch.mockResolvedValueOnce({
      hits: {
        total: { value: 1 },
        hits: [
          {
            _id: "prod-bm25",
            _score: 4,
            _source: {
              product_id: "prod-bm25",
              embedded_text: "Noise cancelling headphones",
              metadata: {},
            },
          },
        ],
      },
      took: 3,
    });

    const result = await service.semanticSearch({
      query: "headphones",
      limit: 1,
      mode: "bm25",
    });

    expect(mockSearch).toHaveBeenCalledTimes(1);
    expect(result.mode).toBe("bm25");
    expect(result.hits[0]?.id).toBe("prod-bm25");
    expect(result.hits[0]?.bm25_score).toBeCloseTo(4);
    expect(result.hits[0]?.vector_score).toBeUndefined();
  });
});