// src/modules/elasticsearch-client.ts
// Elasticsearch client and index management

import { Client } from "@elastic/elasticsearch";

const ELASTICSEARCH_URL = process.env.ELASTICSEARCH_URL || "http://localhost:9200";
const PRODUCTS_INDEX = "products";

// Create Elasticsearch client
export const elasticsearchClient = new Client({
  node: ELASTICSEARCH_URL,
});

/**
 * Initializes the products index if it doesn't exist
 */
export async function initializeIndex(): Promise<void> {
  try {
    const exists = await elasticsearchClient.indices.exists({
      index: PRODUCTS_INDEX,
    });

    if (!exists) {
      await elasticsearchClient.indices.create({
        index: PRODUCTS_INDEX,
        mappings: {
          properties: {
            id: { type: "keyword" },
            title: { type: "text" },
            description: { type: "text" },
            price: { type: "integer" },
          },
        },
      });
      console.log(`[ELASTICSEARCH] ✅ Index "${PRODUCTS_INDEX}" created`);
    } else {
      console.log(`[ELASTICSEARCH] ✅ Index "${PRODUCTS_INDEX}" already exists`);
    }
  } catch (error) {
    console.error(`[ELASTICSEARCH] ❌ Failed to initialize index:`, error);
    throw error;
  }
}
