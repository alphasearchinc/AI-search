import { ExecArgs } from "@medusajs/framework/types";
import { Modules } from "@medusajs/framework/utils";
import { ELASTICSEARCH_MODULE } from "../modules/elasticsearch";
import ElasticsearchModuleService from "../modules/elasticsearch/services/main";
import { embedProductWorkflow } from "../workflows/product-embedding/embed-product";

export default async function reindexAllEmbeddings({ container }: ExecArgs) {
  console.log(`\n[INFO] Starting full reindexing process...\n`);

  const elasticsearchService: ElasticsearchModuleService = container.resolve(
    ELASTICSEARCH_MODULE
  );

  // Step 1: Delete existing index
  try {
    console.log(`[INFO] Deleting existing index...`);
    await elasticsearchService.deleteIndex();
    console.log(`[INFO] Index deleted successfully\n`);
  } catch (error: any) {
    console.error(`[ERROR] Failed to delete index:`, error.message);
    throw error;
  }

  // Step 2: Recreate index with correct dimensions
  try {
    console.log(`[INFO] Recreating index with current embedding dimensions...`);
    await elasticsearchService.initializeIndex();
    console.log(`[INFO] Index recreated successfully\n`);
  } catch (error: any) {
    console.error(`[ERROR] Failed to recreate index:`, error.message);
    throw error;
  }

  // Step 3: Get all products and queue embeddings
  try {
    console.log(`[INFO] Fetching all products...`);
    
    const productModuleService = container.resolve(Modules.PRODUCT);
    const [products] = await productModuleService.listAndCountProducts({}, {});

    console.log(`[INFO] Found ${products.length} products\n`);

    if (products.length === 0) {
      console.log(`[INFO] No products to embed. Exiting.`);
      return;
    }

    console.log(`[INFO] Starting embedding workflow for ${products.length} products...\n`);

    let successCount = 0;
    let failCount = 0;

    for (const product of products) {
      try {
        console.log(`  [INFO] Embedding product ${product.id} (${product.title})...`);
        
        await embedProductWorkflow(container).run({
          input: { product_id: product.id },
        });

        successCount++;
        console.log(`  [INFO] Queued successfully (${successCount}/${products.length})`);
      } catch (error: any) {
        failCount++;
        console.error(
          `  [ERROR] Failed to embed product ${product.id}: ${error.message}`
        );
      }
    }

    console.log(
      `\n[INFO] Reindexing complete:\n` +
      `  - Successfully queued: ${successCount}\n` +
      `  - Failed: ${failCount}\n` +
      `  - Total: ${products.length}\n`
    );

    if (failCount > 0) {
      console.log(
        `[WARN] Some products failed to embed. Check the worker logs for details.`
      );
    }

    console.log(
      `\n[INFO] Embeddings are processed asynchronously by the worker.\n` +
      `   Run 'npm run worker' if it's not already running.\n`
    );
  } catch (error: any) {
    console.error(`[ERROR] Failed to reindex products:`, error.message);
    throw error;
  }
}