import 'dotenv/config';
import { ELASTICSEARCH_MODULE } from "../modules/elasticsearch";
import ElasticsearchModuleService from "../modules/elasticsearch/services/main";

console.log("[INFO] Product Embedding Worker Starting...");

let elasticsearchService: ElasticsearchModuleService;

(async () => {
  try {
    // For standalone worker, we create the service directly
    // In a full Medusa app, this would be resolved from the container
    elasticsearchService = new ElasticsearchModuleService({}, {});
    
    // Initialize the index
    await elasticsearchService.initializeIndex();
    
    // Start the worker
    elasticsearchService.startWorker();
    
    console.log("[INFO] Worker initialized and running");
  } catch (error) {
    console.error("[ERROR] Failed to initialize worker:", error);
    process.exit(1);
  }
})();

const shutdown = async () => {
  console.log("[INFO] Shutting down worker...");
  if (elasticsearchService) {
    await elasticsearchService.stopWorker();
  }
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
