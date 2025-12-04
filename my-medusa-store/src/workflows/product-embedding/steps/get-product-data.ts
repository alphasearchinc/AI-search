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

    // Construct text to embed (title + brand + description + categories + options)
    const textParts = [product.title];

    // Add brand prominently after title for better brand-based search
    if (product.metadata?.brand) {
      textParts.push(`Brand: ${product.metadata.brand}`);
    }

    if (product.description) {
      textParts.push(product.description);
    }

    if (product.categories && product.categories.length > 0) {
      const categoryNames = product.categories
        .map((cat: any) => cat.name)
        .join(", ");
      textParts.push(`Categories: ${categoryNames}`);
    }

    // Add product tags for use case and feature-based searches
    if (product.tags && product.tags.length > 0) {
      const tagValues = product.tags
        .map((tag: any) => tag.value)
        .filter(Boolean)
        .join(", ");
      if (tagValues) {
        textParts.push(`Tags: ${tagValues}`);
      }
    }

    // Add product options for variant-specific searches (e.g., "256GB laptop", "blue color")
    if (product.options && product.options.length > 0) {
      const optionDescriptions: string[] = [];
      
      for (const option of product.options as any[]) {
        if (!option.title) continue;
        
        const values: string[] = [];
        if (option.values && Array.isArray(option.values)) {
          for (const val of option.values) {
            if (val.value) {
              values.push(val.value);
            }
          }
        }
        
        if (values.length > 0) {
          optionDescriptions.push(`${option.title}: ${values.join(", ")}`);
        }
      }
      
      if (optionDescriptions.length > 0) {
        textParts.push(`Available options: ${optionDescriptions.join("; ")}`);
      }
    }

    const embeddedText = textParts.join(". ");

    // Prepare metadata
    const metadata: Record<string, any> = {
      title: product.title,
      handle: product.handle,
    };

    // Extract brand from product metadata if available
    if (product.metadata?.brand) {
      metadata.brand = product.metadata.brand;
    }

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
