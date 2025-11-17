import 'dotenv/config';
import worker from "../lib/elasticsearch-worker";
import { initializeProductEmbeddingIndex } from "../modules/elasticsearch-client";

console.log("🚀 Product Embedding Worker Starting...");

(async () => {
  try {
    await initializeProductEmbeddingIndex();
  } catch (error) {
    console.error("❌ Failed to initialize Elasticsearch:", error);
    process.exit(1);
  }
})();

const shutdown = async () => {
  console.log("👋 Shutting down worker...");
  await worker.close();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
