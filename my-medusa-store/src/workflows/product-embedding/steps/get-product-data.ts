import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

type GetProductDataInput = {
  product_id: string;
};

export const getProductDataStep = createStep(
  "get-product-data-step",
  async (input: GetProductDataInput, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY);

    // Retrieve product with variants and prices using Query
    const { data: products } = await query.graph({
      entity: "product",
      fields: [
        "*",
        "variants.*",
        "variants.prices.*",
        "variants.options.*",
        "options.*",
        "options.values.*",
        "categories.*",
        "tags.*",
      ],
      filters: {
        id: [input.product_id],
      },
    });

    const product = products[0];
    if (!product) {
      throw new Error(`Product ${input.product_id} not found`);
    }

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
      metadata.category_ids = product.categories.map((cat: any) => cat.id);
    }

    if (product.tags && product.tags.length > 0) {
      metadata.tags = product.tags.map((tag: any) => tag.value);
    }

    // Extract price range from variants
    if (product.variants && product.variants.length > 0) {
      const prices: number[] = [];
      for (const variant of product.variants as any[]) {
        // Prices are now available via Query
        if (variant.prices && Array.isArray(variant.prices)) {
          for (const price of variant.prices) {
            if (typeof price.amount === "number") {
              prices.push(price.amount);
            }
          }
        }
      }
      if (prices.length > 0) {
        metadata.min_price = Math.min(...prices);
        metadata.max_price = Math.max(...prices);
      }
    }

    // Extract product options (e.g., Storage, Color) as a map of option_name -> [values]
    // This allows dynamic filtering by any product option
    if (product.options && product.options.length > 0) {
      const optionsMap: Record<string, string[]> = {};

      for (const option of product.options as any[]) {
        const optionTitle = option.title;
        if (!optionTitle) continue;

        const values: string[] = [];
        if (option.values && Array.isArray(option.values)) {
          for (const val of option.values) {
            if (val.value) {
              values.push(val.value);
            }
          }
        }

        if (values.length > 0) {
          optionsMap[optionTitle] = values;
        }
      }

      if (Object.keys(optionsMap).length > 0) {
        metadata.options = optionsMap;
      }
    }

    return new StepResponse({
      product_id: input.product_id,
      embedded_text: embeddedText,
      metadata,
    });
  }
);
