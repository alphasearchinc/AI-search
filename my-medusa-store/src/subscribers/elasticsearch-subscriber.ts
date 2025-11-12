// src/subscribers/elasticsearch-subscriber.ts
// Subscriber for product events that queues Elasticsearch indexing jobs

import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import { elasticsearchQueue } from "../lib/elasticsearch-queue";

/**
 * Fetches product data from Medusa service
 */
async function fetchProductData(container: any, productId: string): Promise<any> {
  const productModuleService = container.resolve("product");
  return await productModuleService.retrieveProduct(productId);
}

/**
 * Main subscriber function
 */
export default async function productElasticsearchSubscriber({
  event,
  container,
}: SubscriberArgs<any>) {
  const productId = event.data?.id;

  if (!productId) {
    return;
  }

  try {
    switch (event.name) {
      case "product.created":
      case "product.updated": {
        const product = await fetchProductData(container, productId);
        
        await elasticsearchQueue.add(event.name, {
          action: event.name === "product.created" ? "index" : "update",
          entity: "products",
          data: {
            id: product.id,
            title: product.title || "",
            description: product.description || "",
          },
        });
        break;
      }

      case "product.deleted": {
        await elasticsearchQueue.add("product.deleted", {
          action: "delete",
          entity: "products",
          data: { id: productId },
        });
        break;
      }
    }
  } catch (error) {
    console.error(`[SUBSCRIBER] ❌ Error:`, error);
  }
}

export const config: SubscriberConfig = {
  event: ["product.created", "product.updated", "product.deleted"],
};
