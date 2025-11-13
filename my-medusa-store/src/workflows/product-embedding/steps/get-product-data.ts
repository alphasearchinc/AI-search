import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { Modules } from "@medusajs/framework/utils";

type GetProductDataInput = {
  product_id: string;
};

export const getProductDataStep = createStep(
  "get-product-data-step",
  async (input: GetProductDataInput, { container }) => {
    const productModuleService = container.resolve(Modules.PRODUCT);

    // Retrieve product details
    const product = await productModuleService.retrieveProduct(
      input.product_id,
      {
        relations: ["variants", "categories", "tags"],
      }
    );

    // Construct text to embed (title + description + category info)
    const textParts = [product.title];

    if (product.description) {
      textParts.push(product.description);
    }

    if (product.categories && product.categories.length > 0) {
      const categoryNames = product.categories
        .map((cat: any) => cat.name)
        .join(", ");
      textParts.push(`Categories: ${categoryNames}`);
    }

    const embeddedText = textParts.join(". ");

    // Prepare metadata
    const metadata: Record<string, any> = {
      title: product.title,
      handle: product.handle,
    };

    if (product.categories && product.categories.length > 0) {
      metadata.categories = product.categories.map((cat: any) => cat.name);
    }

    if (product.tags && product.tags.length > 0) {
      metadata.tags = product.tags.map((tag: any) => tag.value);
    }

    return new StepResponse({
      product_id: input.product_id,
      embedded_text: embeddedText,
      metadata,
    });
  }
);
