import { ExecArgs } from "@medusajs/framework/types";
import { Modules } from "@medusajs/framework/utils";
import { ELASTICSEARCH_MODULE } from "../modules/elasticsearch";
import ElasticsearchModuleService from "../modules/elasticsearch/service";
import { embedProductWorkflow } from "../workflows/product-embedding/embed-product";

export default async function reindexAllEmbeddings({ container }: ExecArgs) {
  console.log(`\n🔄 Starting full reindexing process...\n`);

  const elasticsearchService: ElasticsearchModuleService = container.resolve(
    ELASTICSEARCH_MODULE
  );

  // Step 1: Delete existing index
  try {
    console.log(`🗑️  Deleting existing index...`);
    await elasticsearchService.deleteIndex();
    console.log(`✅ Index deleted successfully\n`);
  } catch (error: any) {
    console.error(`❌ Failed to delete index:`, error.message);
    throw error;
  }

  // Step 2: Recreate index with correct dimensions
  try {
    console.log(`🔨 Recreating index with current embedding dimensions...`);
    await elasticsearchService.initializeIndex();
    console.log(`✅ Index recreated successfully\n`);
  } catch (error: any) {
    console.error(`❌ Failed to recreate index:`, error.message);
    throw error;
  }

  // Step 3: Get all products and queue embeddings
  try {
    console.log(`📦 Fetching all products...`);
    
    const productModuleService = container.resolve(Modules.PRODUCT);
    const [products] = await productModuleService.listAndCountProducts({}, {});

    console.log(`✅ Found ${products.length} products\n`);

    if (products.length === 0) {
      console.log(`ℹ️  No products to embed. Exiting.`);
      return;
    }

    console.log(`🚀 Starting embedding workflow for ${products.length} products...\n`);

    let successCount = 0;
    let failCount = 0;

    for (const product of products) {
      try {
        console.log(`  ⏳ Embedding product ${product.id} (${product.title})...`);
        
        await embedProductWorkflow(container).run({
          input: { product_id: product.id },
        });

        successCount++;
        console.log(`  ✅ Queued successfully (${successCount}/${products.length})`);
      } catch (error: any) {
        failCount++;
        console.error(
          `  ❌ Failed to embed product ${product.id}: ${error.message}`
        );
      }
    }

    console.log(
      `\n📊 Reindexing complete:\n` +
      `  - Successfully queued: ${successCount}\n` +
      `  - Failed: ${failCount}\n` +
      `  - Total: ${products.length}\n`
    );

    if (failCount > 0) {
      console.log(
        `⚠️  Some products failed to embed. Check the worker logs for details.`
      );
    }

    console.log(
      `\nℹ️  Embeddings are processed asynchronously by the worker.\n` +
      `   Run 'npm run worker' if it's not already running.\n`
    );
  } catch (error: any) {
    console.error(`❌ Failed to reindex products:`, error.message);
    throw error;
  }
}