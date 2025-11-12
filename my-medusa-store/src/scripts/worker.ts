// src/scripts/worker.ts
// Entry point for the Elasticsearch indexing worker

import worker from "../lib/elasticsearch-worker";
import { initializeIndex } from "../modules/elasticsearch-client";

console.log("🚀 Elasticsearch Worker Starting...");

// Initialize Elasticsearch index
initializeIndex().catch((error) => {
  console.error("❌ Failed to initialize Elasticsearch:", error);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  await worker.close();
  process.exit(0);
});

process.on("SIGINT", async () => {
  await worker.close();
  process.exit(0);
});
