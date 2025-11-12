import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import { Modules } from "@medusajs/framework/utils";
import { embedProductWorkflow } from "../workflows/product-embedding/embed-product";

// Subscribe to product creation and update events
export default async function productEmbeddingSubscriber({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve("logger");

  try {
    // Execute the embedding workflow for the product
    await embedProductWorkflow(container).run({
      input: {
        product_id: data.id,
      },
    });

    logger.info(`Successfully generated embedding for product: ${data.id}`);
  } catch (error) {
    logger.error(`Failed to generate embedding for product: ${data.id}`, error);
  }
}

export const config: SubscriberConfig = {
  event: [
    `${Modules.PRODUCT}.product.created`,
    `${Modules.PRODUCT}.product.updated`,
  ],
};
