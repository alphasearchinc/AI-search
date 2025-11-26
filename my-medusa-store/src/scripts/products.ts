import {
  createCollectionsWorkflow,
  createProductCategoriesWorkflow,
  createProductsWorkflow,
} from "@medusajs/core-flows";
import {
  ExecArgs,
  ISalesChannelModuleService,
} from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  ModuleRegistrationName,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils";

export default async function seedDemoData({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const salesChannelModuleService: ISalesChannelModuleService =
    container.resolve(ModuleRegistrationName.SALES_CHANNEL);

  logger.info("Getting existing sales channel...");
  const defaultSalesChannel = await salesChannelModuleService.listSalesChannels(
    {
      name: "Default Sales Channel",
    }
  );

  if (!defaultSalesChannel.length) {
    logger.error(
      "Default Sales Channel not found. Please run the seed command first."
    );
    throw new Error("Default Sales Channel not found");
  }

  const productModuleService = container.resolve(Modules.PRODUCT);

  logger.info("Deleting existing products before seeding...");

  const productIds: string[] = [];
  const batchSize = 100;
  let offset = 0;

  while (true) {
    const [products, count] = await productModuleService.listAndCountProducts(
      {},
      { select: ["id"], take: batchSize, skip: offset }
    );

    if (!products.length) {
      break;
    }

    productIds.push(...products.map((product) => product.id));
    offset += products.length;

    if (offset >= count) {
      break;
    }
  }

  if (productIds.length) {
    await productModuleService.deleteProducts(productIds);
    logger.info(`Deleted ${productIds.length} existing products.`);
  } else {
    logger.info("No existing products to delete.");
  }

  logger.info("Seeding product data...");

  const existingCollections = await productModuleService.listProductCollections(
    { handle: ["featured"] },
    { take: 1, select: ["id", "handle", "title"] }
  );

  const collection =
    existingCollections[0] ??
    (
      await createCollectionsWorkflow(container).run({
        input: {
          collections: [
            {
              title: "Featured",
              handle: "featured",
            },
          ],
        },
      })
    ).result[0];

  const desiredCategories = [
    { name: "Laptops", handle: "laptops" },
    { name: "Smartphones", handle: "smartphones" },
    { name: "Monitors", handle: "monitors" },
    { name: "Headphones", handle: "headphones" },
    { name: "Speakers", handle: "speakers" },
    { name: "Keyboards", handle: "keyboards" },
    { name: "Mice", handle: "mice" },
    { name: "Webcams", handle: "webcams" },
  ];

  const existingCategories = await productModuleService.listProductCategories(
    { handle: desiredCategories.map((cat) => cat.handle) },
    { select: ["id", "name", "handle"] }
  );

  const existingCategoryMap = new Map(
    existingCategories.map((cat: any) => [cat.handle?.toLowerCase(), cat])
  );

  const missingCategories = desiredCategories.filter(
    (cat) => !existingCategoryMap.has(cat.handle.toLowerCase())
  );

  const createdCategories = missingCategories.length
    ? (
        await createProductCategoriesWorkflow(container).run({
          input: {
            product_categories: missingCategories.map((cat) => ({
              ...cat,
              is_active: true,
            })),
          },
        })
      ).result
    : [];

  const categoryResult = [...existingCategories, ...createdCategories];

  // Helper to find category ID by name
  const getCatId = (name: string) =>
    categoryResult.find((cat) => cat.name === name)?.id!;

  // 1. Create Hero Products
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title:
            '16" Ultra-Slim AI Laptop | 3K OLED | 1.1cm Thin | 6-Speaker Audio',
          collection_id: collection.id,
          category_ids: [getCatId("Laptops")],
          description:
            "This ultra-thin 16-inch laptop is a sophisticated, high-performance machine for the new era of artificial intelligence. It has been completely redesigned from the inside out. The cabinet features an exquisite new ceramic-aluminum composite material in a range of nature-inspired colors. This material provides durability while completing the ultra-slim design and resisting the test of time. This innovative computer utilizes the latest AI-enhanced processor with quiet ambient cooling. It's designed to enrich your lifestyle on the go with an astonishingly thin 1.1cm chassis that houses an advanced 16-inch 3K OLED display and immersive six-speaker audio.",
          weight: 400,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/laptop-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/laptop-side.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/laptop-top.png",
            },
          ],
          options: [
            {
              title: "Storage",
              values: ["256 GB", "512 GB"],
            },
            {
              title: "Color",
              values: ["Blue", "Red"],
            },
          ],
          variants: [
            {
              title: "256 GB / Blue",
              sku: "256-BLUE",
              options: {
                Storage: "256 GB",
                Color: "Blue",
              },
              manage_inventory: false,
              prices: [
                {
                  amount: 1299,
                  currency_code: "eur",
                },
                {
                  amount: 1299,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "512 GB / Red",
              sku: "512-RED",
              options: {
                Storage: "512 GB",
                Color: "Red",
              },
              manage_inventory: false,
              prices: [
                {
                  amount: 1259,
                  currency_code: "eur",
                },
                {
                  amount: 1259,
                  currency_code: "usd",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel[0].id,
            },
          ],
        },
      ],
    },
  });

  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "1080p HD Pro Webcam | Superior Video | Privacy enabled",
          category_ids: [getCatId("Webcams")],
          description:
            "High-quality 1080p HD webcam that elevates your work environment with superior video and audio that outperforms standard laptop cameras. Achieve top-tier video collaboration at a cost-effective price point, ideal for widespread deployment across your organization.",
          weight: 400,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/camera-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/camera-side.png",
            },
          ],
          options: [
            {
              title: "Color",
              values: ["Black", "White"],
            },
          ],
          variants: [
            {
              title: "Webcam Black",
              sku: "WEBCAM-BLACK",
              options: {
                Color: "Black",
              },
              manage_inventory: false,
              prices: [
                {
                  amount: 59,
                  currency_code: "eur",
                },
                {
                  amount: 59,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "Webcam White",
              sku: "WEBCAM-WHITE",
              options: {
                Color: "White",
              },
              manage_inventory: false,
              prices: [
                {
                  amount: 65,
                  currency_code: "eur",
                },
                {
                  amount: 65,
                  currency_code: "usd",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel[0].id,
            },
          ],
        },
      ],
    },
  });

  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: `6.5" Ultra HD Smartphone | 3x Impact-Resistant Screen`,
          collection_id: collection.id,
          category_ids: [getCatId("Smartphones")],
          description:
            'This premium smartphone is crafted from durable and lightweight aerospace-grade aluminum, featuring an expansive 6.5" Ultra-High Definition AMOLED display. It boasts exceptional durability with a cutting-edge nanocrystal glass front, offering three times the impact resistance of standard smartphone screens. The device combines sleek design with robust protection, setting a new standard for smartphone resilience and visual excellence.',
          weight: 400,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/phone-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/phone-side.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/phone-bottom.png",
            },
          ],
          options: [
            {
              title: "Memory",
              values: ["256 GB", "512 GB"],
            },
            {
              title: "Color",
              values: ["Purple", "Red"],
            },
          ],
          variants: [
            {
              title: "256 GB Purple",
              sku: "PHONE-256-PURPLE",
              options: {
                Memory: "256 GB",
                Color: "Purple",
              },
              manage_inventory: false,
              prices: [
                {
                  amount: 999,
                  currency_code: "eur",
                },
                {
                  amount: 999,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "256 GB Red",
              sku: "PHONE-256-RED",
              options: {
                Memory: "256 GB",
                Color: "Red",
              },
              manage_inventory: false,
              prices: [
                {
                  amount: 959,
                  currency_code: "eur",
                },
                {
                  amount: 959,
                  currency_code: "usd",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel[0].id,
            },
          ],
        },
      ],
    },
  });

  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: `34" QD-OLED Curved Gaming Monitor | Ultra-Wide | Infinite Contrast | 175Hz`,
          collection_id: collection.id,
          category_ids: [getCatId("Monitors")],
          description:
            "Experience the pinnacle of display technology with this 34-inch curved monitor. By merging OLED panels and Quantum Dot technology, this QD-OLED screen delivers exceptional contrast, deep blacks, unlimited viewing angles, and vivid colors. The curved design provides an immersive experience, allowing you to enjoy the best of both worlds in one cutting-edge display. This innovative monitor represents the ultimate fusion of visual performance and immersive design.",
          weight: 400,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/screen-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/screen-side.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/screen-top.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/screen-back.png",
            },
          ],
          options: [
            {
              title: "Color",
              values: ["White", "Black"],
            },
          ],
          variants: [
            {
              title: "ACME Monitor 4k White",
              sku: "ACME-MONITOR-WHITE",
              options: {
                Color: "White",
              },
              manage_inventory: false,
              prices: [
                {
                  amount: 599,
                  currency_code: "eur",
                },
                {
                  amount: 599,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "ACME Monitor 4k White",
              sku: "ACME-MONITOR-BLACK",
              options: {
                Color: "Black",
              },
              manage_inventory: false,
              prices: [
                {
                  amount: 599,
                  currency_code: "eur",
                },
                {
                  amount: 599,
                  currency_code: "usd",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel[0].id,
            },
          ],
        },
      ],
    },
  });

  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Hi-Fi Gaming Headset | Pro-Grade DAC | Hi-Res Certified",
          collection_id: collection.id,
          category_ids: [getCatId("Headphones")],
          description: `Experience studio-quality audio with this advanced acoustic system, which pairs premium hardware with high-fidelity sound and innovative audio software for an immersive listening experience. The integrated digital-to-analog converter (DAC) enhances the audio setup with high-resolution certification and a built-in amplifier, delivering exceptional sound clarity and depth. This comprehensive audio solution brings professional-grade sound to your personal environment, whether for gaming, music production, or general entertainment.`,
          weight: 400,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/headphone-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/headphone-side.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/headphone-top.png",
            },
          ],
          options: [
            {
              title: "Color",
              values: ["Black", "White"],
            },
          ],
          variants: [
            {
              title: "Headphone Black",
              sku: "HEADPHONE-BLACK",
              options: {
                Color: "Black",
              },
              manage_inventory: false,
              prices: [
                {
                  amount: 149,
                  currency_code: "eur",
                },
                {
                  amount: 149,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "Headphone White",
              sku: "HEADPHONE-WHITE",
              options: {
                Color: "White",
              },
              manage_inventory: false,
              prices: [
                {
                  amount: 149,
                  currency_code: "eur",
                },
                {
                  amount: 149,
                  currency_code: "usd",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel[0].id,
            },
          ],
        },
      ],
    },
  });

  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Wireless Keyboard | Touch ID | Numeric Keypad",
          category_ids: [getCatId("Keyboards")],
          description: `This wireless keyboard offers a comfortable typing experience with a numeric keypad and Touch ID. It features navigation buttons, full-sized arrow keys, and is ideal for spreadsheets and gaming. The rechargeable battery lasts about a month. It pairs automatically with compatible computers and includes a USB-C to Lightning cable for charging and pairing.`,
          weight: 400,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/keyboard-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/keyboard-side.png",
            },
          ],
          options: [
            {
              title: "Color",
              values: ["Black", "White"],
            },
          ],
          variants: [
            {
              title: "Keyboard Black",
              sku: "KEYBOARD-BLACK",
              options: {
                Color: "Black",
              },
              manage_inventory: false,
              prices: [
                {
                  amount: 99,
                  currency_code: "eur",
                },
                {
                  amount: 99,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "Keyboard White",
              sku: "KEYBOARD-WHITE",
              options: {
                Color: "White",
              },
              manage_inventory: false,
              prices: [
                {
                  amount: 99,
                  currency_code: "eur",
                },
                {
                  amount: 99,
                  currency_code: "usd",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel[0].id,
            },
          ],
        },
      ],
    },
  });

  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Wireless Rechargeable Mouse | Multi-Touch Surface",
          category_ids: [getCatId("Mice")],
          description: `This wireless mouse glides effortlessly with a low-friction base and precision laser sensor. The multi-touch surface supports smooth scrolling and intuitive gestures, and the rechargeable battery is designed to last for weeks on a single charge. Pair it over Bluetooth in seconds and top up quickly with the included USB-C cable.`,
          weight: 400,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/mouse-top.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/mouse-front.png",
            },
          ],
          options: [
            {
              title: "Color",
              values: ["Black", "White"],
            },
          ],
          variants: [
            {
              title: "Mouse Black",
              sku: "MOUSE-BLACK",
              options: {
                Color: "Black",
              },
              manage_inventory: false,
              prices: [
                {
                  amount: 79,
                  currency_code: "eur",
                },
                {
                  amount: 79,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "Mouse White",
              sku: "MOUSE-WHITE",
              options: {
                Color: "White",
              },
              manage_inventory: false,
              prices: [
                {
                  amount: 79,
                  currency_code: "eur",
                },
                {
                  amount: 79,
                  currency_code: "usd",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel[0].id,
            },
          ],
        },
      ],
    },
  });

  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Conference Speaker | High-Performance | Budget-Friendly",
          category_ids: [getCatId("Speakers")],
          description: `This compact, powerful conference speaker offers exceptional, high-performance features at a surprisingly affordable price. Packed with advanced productivity-enhancing technology, it delivers premium functionality without the premium price tag. Experience better meetings and improved communication, regardless of where your team members are calling from.`,
          weight: 400,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/speaker-top.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/speaker-front.png",
            },
          ],
          options: [
            {
              title: "Color",
              values: ["Black", "White"],
            },
          ],
          variants: [
            {
              title: "Speaker Black",
              sku: "SPEAKER-BLACK",
              options: {
                Color: "Black",
              },
              manage_inventory: false,
              prices: [
                {
                  amount: 79,
                  currency_code: "eur",
                },
                {
                  amount: 79,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "Speaker White",
              sku: "SPEAKER-WHITE",
              options: {
                Color: "White",
              },
              manage_inventory: false,
              prices: [
                {
                  amount: 55,
                  currency_code: "eur",
                },
                {
                  amount: 55,
                  currency_code: "usd",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel[0].id,
            },
          ],
        },
      ],
    },
  });

  // 2. Create Additional Products

  // Product 1: Gaming Laptop
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: '15.6" Gaming Laptop | RTX 4070 | 165Hz Display | 32GB RAM',
          category_ids: [getCatId("Laptops")],
          description:
            "Dominate the competition with this powerful 15.6-inch gaming laptop. Equipped with an NVIDIA RTX 4070 graphics card and a blazing-fast 165Hz refresh rate display, every frame is rendered with stunning clarity. The 32GB of DDR5 RAM ensures seamless multitasking, while the advanced cooling system keeps temperatures in check during intense gaming sessions. The RGB keyboard adds a personalized touch to your setup.",
          weight: 2500,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/laptop-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/laptop-side.png",
            },
          ],
          options: [
            { title: "Storage", values: ["512 GB", "1 TB"] },
            { title: "Color", values: ["Black", "Silver"] },
          ],
          variants: [
            {
              title: "512 GB / Black",
              sku: "GAMING-LAPTOP-512-BLK",
              options: { Storage: "512 GB", Color: "Black" },
              manage_inventory: false,
              prices: [
                { amount: 1899, currency_code: "eur" },
                { amount: 1899, currency_code: "usd" },
              ],
            },
            {
              title: "1 TB / Silver",
              sku: "GAMING-LAPTOP-1TB-SLV",
              options: { Storage: "1 TB", Color: "Silver" },
              manage_inventory: false,
              prices: [
                { amount: 2099, currency_code: "eur" },
                { amount: 2099, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // Product 2: Business Ultrabook
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title:
            '14" Business Ultrabook | Intel Core i7 | 16GB RAM | All-Day Battery',
          category_ids: [getCatId("Laptops")],
          description:
            "Designed for the modern professional, this 14-inch ultrabook combines portability with productivity. Powered by the latest Intel Core i7 processor and 16GB of RAM, it handles demanding workloads with ease. The all-day battery life ensures you stay productive on the go, while the lightweight magnesium chassis makes it easy to carry. Features a fingerprint reader and IR camera for secure Windows Hello login.",
          weight: 1400,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/laptop-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/laptop-top.png",
            },
          ],
          options: [
            { title: "Storage", values: ["256 GB", "512 GB"] },
            { title: "Color", values: ["Grey", "Black"] },
          ],
          variants: [
            {
              title: "256 GB / Grey",
              sku: "BIZ-ULTRA-256-GRY",
              options: { Storage: "256 GB", Color: "Grey" },
              manage_inventory: false,
              prices: [
                { amount: 1199, currency_code: "eur" },
                { amount: 1199, currency_code: "usd" },
              ],
            },
            {
              title: "512 GB / Black",
              sku: "BIZ-ULTRA-512-BLK",
              options: { Storage: "512 GB", Color: "Black" },
              manage_inventory: false,
              prices: [
                { amount: 1399, currency_code: "eur" },
                { amount: 1399, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // Product 3: Flagship Smartphone
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title:
            '6.7" Flagship Smartphone | 200MP Camera | 5G | Titanium Frame',
          category_ids: [getCatId("Smartphones")],
          description:
            "Capture every moment in stunning detail with the revolutionary 200MP main camera. This flagship smartphone features a gorgeous 6.7-inch Dynamic AMOLED display with 120Hz adaptive refresh rate. The titanium frame provides exceptional durability while maintaining a premium feel. With 5G connectivity and all-day battery life, you're always connected and ready for anything.",
          weight: 234,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/phone-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/phone-side.png",
            },
          ],
          options: [
            { title: "Storage", values: ["256 GB", "512 GB"] },
            { title: "Color", values: ["Titanium Black", "Titanium Silver"] },
          ],
          variants: [
            {
              title: "256 GB / Titanium Black",
              sku: "FLAG-PHONE-256-TBK",
              options: { Storage: "256 GB", Color: "Titanium Black" },
              manage_inventory: false,
              prices: [
                { amount: 1199, currency_code: "eur" },
                { amount: 1199, currency_code: "usd" },
              ],
            },
            {
              title: "512 GB / Titanium Silver",
              sku: "FLAG-PHONE-512-TSV",
              options: { Storage: "512 GB", Color: "Titanium Silver" },
              manage_inventory: false,
              prices: [
                { amount: 1349, currency_code: "eur" },
                { amount: 1349, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // Product 4: Budget Smartphone
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title:
            '6.4" Budget Smartphone | 5000mAh Battery | 48MP Triple Camera',
          category_ids: [getCatId("Smartphones")],
          description:
            "Get premium features without the premium price. This 6.4-inch smartphone delivers exceptional value with a 48MP triple camera system, massive 5000mAh battery, and smooth 90Hz display. Perfect for social media, streaming, and everyday tasks. The sleek design and vibrant color options make it stand out from the crowd.",
          weight: 195,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/phone-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/phone-bottom.png",
            },
          ],
          options: [
            { title: "Storage", values: ["64 GB", "128 GB"] },
            { title: "Color", values: ["Blue", "Green"] },
          ],
          variants: [
            {
              title: "64 GB / Blue",
              sku: "BUDGET-PHONE-64-BLU",
              options: { Storage: "64 GB", Color: "Blue" },
              manage_inventory: false,
              prices: [
                { amount: 249, currency_code: "eur" },
                { amount: 249, currency_code: "usd" },
              ],
            },
            {
              title: "128 GB / Green",
              sku: "BUDGET-PHONE-128-GRN",
              options: { Storage: "128 GB", Color: "Green" },
              manage_inventory: false,
              prices: [
                { amount: 299, currency_code: "eur" },
                { amount: 299, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // Product 5: 27" 4K Monitor
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: '27" 4K UHD Monitor | IPS Panel | 99% sRGB | USB-C Hub',
          category_ids: [getCatId("Monitors")],
          description:
            "Experience stunning visuals on this 27-inch 4K UHD monitor. The IPS panel delivers accurate colors with 99% sRGB coverage, perfect for creative professionals and content creators. The built-in USB-C hub with 65W power delivery simplifies your workspace by connecting and charging your laptop with a single cable. Ergonomic stand with height, tilt, and swivel adjustments.",
          weight: 5500,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/screen-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/screen-side.png",
            },
          ],
          options: [{ title: "Color", values: ["Black", "Silver"] }],
          variants: [
            {
              title: "4K Monitor Black",
              sku: "MON-4K-27-BLK",
              options: { Color: "Black" },
              manage_inventory: false,
              prices: [
                { amount: 449, currency_code: "eur" },
                { amount: 449, currency_code: "usd" },
              ],
            },
            {
              title: "4K Monitor Silver",
              sku: "MON-4K-27-SLV",
              options: { Color: "Silver" },
              manage_inventory: false,
              prices: [
                { amount: 469, currency_code: "eur" },
                { amount: 469, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // Product 6: Gaming Monitor
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: '32" Curved Gaming Monitor | 240Hz | 1ms Response | HDR600',
          category_ids: [getCatId("Monitors")],
          description:
            "Gain the competitive edge with this 32-inch curved gaming monitor. The 240Hz refresh rate and 1ms response time deliver buttery-smooth gameplay with zero ghosting. HDR600 support brings games to life with vivid colors and deep contrasts. The 1500R curvature provides an immersive experience that puts you in the center of the action. G-Sync and FreeSync compatible.",
          weight: 7200,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/screen-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/screen-back.png",
            },
          ],
          options: [{ title: "Color", values: ["Black", "White"] }],
          variants: [
            {
              title: "Gaming Monitor Black",
              sku: "MON-GAME-32-BLK",
              options: { Color: "Black" },
              manage_inventory: false,
              prices: [
                { amount: 549, currency_code: "eur" },
                { amount: 549, currency_code: "usd" },
              ],
            },
            {
              title: "Gaming Monitor White",
              sku: "MON-GAME-32-WHT",
              options: { Color: "White" },
              manage_inventory: false,
              prices: [
                { amount: 569, currency_code: "eur" },
                { amount: 569, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // Product 7: Wireless ANC Headphones
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title:
            "Premium Wireless Headphones | Active Noise Cancellation | 40hr Battery",
          category_ids: [getCatId("Headphones")],
          description:
            "Immerse yourself in pure audio bliss with these premium wireless headphones. Industry-leading active noise cancellation blocks out the world so you can focus on your music. The 40-hour battery life keeps you listening all week long, and quick charge gives you 5 hours of playback from just 10 minutes of charging. Memory foam ear cushions provide all-day comfort.",
          weight: 250,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/headphone-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/headphone-side.png",
            },
          ],
          options: [
            { title: "Color", values: ["Midnight Black", "Cloud White"] },
          ],
          variants: [
            {
              title: "ANC Headphones Midnight Black",
              sku: "HP-ANC-PRO-MBK",
              options: { Color: "Midnight Black" },
              manage_inventory: false,
              prices: [
                { amount: 299, currency_code: "eur" },
                { amount: 299, currency_code: "usd" },
              ],
            },
            {
              title: "ANC Headphones Cloud White",
              sku: "HP-ANC-PRO-CWH",
              options: { Color: "Cloud White" },
              manage_inventory: false,
              prices: [
                { amount: 299, currency_code: "eur" },
                { amount: 299, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // Product 8: Sports Earbuds
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title:
            "Sports Wireless Earbuds | IP67 Waterproof | Secure Fit | 8hr Battery",
          category_ids: [getCatId("Headphones")],
          description:
            "Designed for athletes and fitness enthusiasts, these wireless earbuds stay secure during the most intense workouts. IP67 waterproof rating protects against sweat and rain. The ergonomic design with flexible ear hooks ensures a comfortable, secure fit. Powerful bass and clear highs keep you motivated, while 8 hours of battery life outlasts your longest training sessions.",
          weight: 28,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/headphone-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/headphone-top.png",
            },
          ],
          options: [{ title: "Color", values: ["Black", "Neon Green"] }],
          variants: [
            {
              title: "Sports Earbuds Black",
              sku: "EB-SPORT-BLK",
              options: { Color: "Black" },
              manage_inventory: false,
              prices: [
                { amount: 89, currency_code: "eur" },
                { amount: 89, currency_code: "usd" },
              ],
            },
            {
              title: "Sports Earbuds Neon Green",
              sku: "EB-SPORT-NGR",
              options: { Color: "Neon Green" },
              manage_inventory: false,
              prices: [
                { amount: 89, currency_code: "eur" },
                { amount: 89, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // Product 9: Portable Bluetooth Speaker
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title:
            "Portable Bluetooth Speaker | 360° Sound | IP67 Waterproof | 20hr Battery",
          category_ids: [getCatId("Speakers")],
          description:
            "Take the party anywhere with this rugged portable Bluetooth speaker. The 360-degree sound design fills any space with rich, room-filling audio. IP67 waterproof rating means it can handle pool parties, beach trips, and unexpected rain. The 20-hour battery life keeps the music playing all day and night. Built-in microphone for hands-free calls.",
          weight: 680,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/speaker-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/speaker-top.png",
            },
          ],
          options: [{ title: "Color", values: ["Black", "Blue", "Red"] }],
          variants: [
            {
              title: "Portable Speaker Black",
              sku: "SPK-PORT-BLK",
              options: { Color: "Black" },
              manage_inventory: false,
              prices: [
                { amount: 129, currency_code: "eur" },
                { amount: 129, currency_code: "usd" },
              ],
            },
            {
              title: "Portable Speaker Blue",
              sku: "SPK-PORT-BLU",
              options: { Color: "Blue" },
              manage_inventory: false,
              prices: [
                { amount: 129, currency_code: "eur" },
                { amount: 129, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // Product 10: Smart Home Speaker
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title:
            "Smart Home Speaker | Voice Assistant | Multi-Room Audio | Hi-Fi Sound",
          category_ids: [getCatId("Speakers")],
          description:
            "Transform your home with this intelligent smart speaker. Built-in voice assistant responds to your commands for music, smart home control, and more. Link multiple speakers for synchronized multi-room audio throughout your home. Premium drivers deliver Hi-Fi sound quality that fills any room. Elegant fabric design complements any décor.",
          weight: 1100,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/speaker-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/speaker-top.png",
            },
          ],
          options: [{ title: "Color", values: ["Charcoal", "Sandstone"] }],
          variants: [
            {
              title: "Smart Speaker Charcoal",
              sku: "SPK-SMART-CHR",
              options: { Color: "Charcoal" },
              manage_inventory: false,
              prices: [
                { amount: 199, currency_code: "eur" },
                { amount: 199, currency_code: "usd" },
              ],
            },
            {
              title: "Smart Speaker Sandstone",
              sku: "SPK-SMART-SND",
              options: { Color: "Sandstone" },
              manage_inventory: false,
              prices: [
                { amount: 199, currency_code: "eur" },
                { amount: 199, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // Product 11: Mechanical Gaming Keyboard
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title:
            "Mechanical Gaming Keyboard | RGB Backlight | Hot-Swappable | Aluminum Frame",
          category_ids: [getCatId("Keyboards")],
          description:
            "Elevate your gaming experience with this premium mechanical keyboard. Hot-swappable switches let you customize the feel without soldering. Per-key RGB backlighting with 16.8 million colors creates stunning lighting effects. The aircraft-grade aluminum frame provides durability and a premium feel. Programmable macro keys give you the competitive edge.",
          weight: 950,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/keyboard-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/keyboard-side.png",
            },
          ],
          options: [
            { title: "Switch Type", values: ["Red Linear", "Blue Clicky"] },
            { title: "Color", values: ["Black", "White"] },
          ],
          variants: [
            {
              title: "Red Linear / Black",
              sku: "KB-MECH-RED-BLK",
              options: { "Switch Type": "Red Linear", Color: "Black" },
              manage_inventory: false,
              prices: [
                { amount: 149, currency_code: "eur" },
                { amount: 149, currency_code: "usd" },
              ],
            },
            {
              title: "Blue Clicky / White",
              sku: "KB-MECH-BLU-WHT",
              options: { "Switch Type": "Blue Clicky", Color: "White" },
              manage_inventory: false,
              prices: [
                { amount: 149, currency_code: "eur" },
                { amount: 149, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // Product 12: Compact Wireless Keyboard
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title:
            "Compact Wireless Keyboard | 65% Layout | Multi-Device | Rechargeable",
          category_ids: [getCatId("Keyboards")],
          description:
            "Maximize desk space with this compact 65% layout wireless keyboard. Connect up to 3 devices via Bluetooth and switch between them instantly. The slim, minimalist design looks great in any setup. Rechargeable battery lasts up to 2 months on a single charge. Quiet, low-profile keys provide comfortable typing for extended sessions.",
          weight: 420,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/keyboard-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/keyboard-side.png",
            },
          ],
          options: [{ title: "Color", values: ["Space Grey", "Rose Gold"] }],
          variants: [
            {
              title: "Compact Keyboard Space Grey",
              sku: "KB-COMP-SGR",
              options: { Color: "Space Grey" },
              manage_inventory: false,
              prices: [
                { amount: 79, currency_code: "eur" },
                { amount: 79, currency_code: "usd" },
              ],
            },
            {
              title: "Compact Keyboard Rose Gold",
              sku: "KB-COMP-RGD",
              options: { Color: "Rose Gold" },
              manage_inventory: false,
              prices: [
                { amount: 79, currency_code: "eur" },
                { amount: 79, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // Product 13: Gaming Mouse
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Pro Gaming Mouse | 25000 DPI | Lightweight | RGB Lighting",
          category_ids: [getCatId("Mice")],
          description:
            "Achieve pixel-perfect accuracy with this professional gaming mouse. The 25000 DPI optical sensor tracks on any surface with zero smoothing or acceleration. Weighing just 58 grams, it glides effortlessly for lightning-fast flicks. Customizable RGB lighting syncs with your setup. 6 programmable buttons for your most-used commands.",
          weight: 58,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/mouse-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/mouse-top.png",
            },
          ],
          options: [{ title: "Color", values: ["Black", "White"] }],
          variants: [
            {
              title: "Gaming Mouse Black",
              sku: "MS-GAME-PRO-BLK",
              options: { Color: "Black" },
              manage_inventory: false,
              prices: [
                { amount: 69, currency_code: "eur" },
                { amount: 69, currency_code: "usd" },
              ],
            },
            {
              title: "Gaming Mouse White",
              sku: "MS-GAME-PRO-WHT",
              options: { Color: "White" },
              manage_inventory: false,
              prices: [
                { amount: 69, currency_code: "eur" },
                { amount: 69, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // Product 14: Ergonomic Vertical Mouse
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title:
            "Ergonomic Vertical Mouse | Reduces Wrist Strain | Wireless | Silent Clicks",
          category_ids: [getCatId("Mice")],
          description:
            "Say goodbye to wrist pain with this ergonomic vertical mouse. The natural handshake position reduces muscle strain and prevents repetitive stress injuries. Silent click buttons let you work without disturbing others. Wireless 2.4GHz connection provides reliable performance up to 10 meters. Adjustable DPI settings for precision control.",
          weight: 85,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/mouse-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/mouse-top.png",
            },
          ],
          options: [{ title: "Color", values: ["Black", "Grey"] }],
          variants: [
            {
              title: "Ergonomic Mouse Black",
              sku: "MS-ERGO-BLK",
              options: { Color: "Black" },
              manage_inventory: false,
              prices: [
                { amount: 49, currency_code: "eur" },
                { amount: 49, currency_code: "usd" },
              ],
            },
            {
              title: "Ergonomic Mouse Grey",
              sku: "MS-ERGO-GRY",
              options: { Color: "Grey" },
              manage_inventory: false,
              prices: [
                { amount: 49, currency_code: "eur" },
                { amount: 49, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // Product 15: 4K Streaming Webcam
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title:
            "4K Streaming Webcam | AI Auto-Focus | Dual Microphones | Low Light Correction",
          category_ids: [getCatId("Webcams")],
          description:
            "Look your best on every video call with this professional 4K streaming webcam. AI-powered auto-focus keeps you sharp even when moving. Dual noise-canceling microphones capture clear audio. Advanced low-light correction ensures you look great in any lighting condition. Built-in privacy shutter for peace of mind when not in use.",
          weight: 165,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/camera-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/camera-side.png",
            },
          ],
          options: [{ title: "Color", values: ["Black", "White"] }],
          variants: [
            {
              title: "4K Webcam Black",
              sku: "CAM-4K-STR-BLK",
              options: { Color: "Black" },
              manage_inventory: false,
              prices: [
                { amount: 149, currency_code: "eur" },
                { amount: 149, currency_code: "usd" },
              ],
            },
            {
              title: "4K Webcam White",
              sku: "CAM-4K-STR-WHT",
              options: { Color: "White" },
              manage_inventory: false,
              prices: [
                { amount: 149, currency_code: "eur" },
                { amount: 149, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // Product 16: Compact Conference Webcam
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Compact Conference Webcam | 1080p60 | Wide Angle 90° | USB-C",
          category_ids: [getCatId("Webcams")],
          description:
            "The perfect webcam for remote work and video conferencing. 1080p at 60fps delivers smooth, professional video quality. The 90-degree wide-angle lens captures more of your background, perfect for group calls. USB-C connectivity works with all modern laptops. Compact design with flexible mount fits any monitor or tripod.",
          weight: 110,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/camera-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/camera-side.png",
            },
          ],
          options: [{ title: "Color", values: ["Black", "Silver"] }],
          variants: [
            {
              title: "Conference Webcam Black",
              sku: "CAM-CONF-BLK",
              options: { Color: "Black" },
              manage_inventory: false,
              prices: [
                { amount: 89, currency_code: "eur" },
                { amount: 89, currency_code: "usd" },
              ],
            },
            {
              title: "Conference Webcam Silver",
              sku: "CAM-CONF-SLV",
              options: { Color: "Silver" },
              manage_inventory: false,
              prices: [
                { amount: 89, currency_code: "eur" },
                { amount: 89, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // Product 17: Creative Laptop
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title:
            '17" Creator Laptop | 4K OLED | 64GB RAM | RTX 4080 | Color Accurate',
          category_ids: [getCatId("Laptops")],
          description:
            "Unleash your creativity with this powerhouse 17-inch creator laptop. The stunning 4K OLED display covers 100% of DCI-P3 for color-accurate work. 64GB of RAM handles the most demanding creative applications, while the RTX 4080 accelerates rendering and 3D work. Thunderbolt 4 ports connect to all your professional peripherals. Built for video editors, 3D artists, and photographers.",
          weight: 2800,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/laptop-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/laptop-side.png",
            },
          ],
          options: [
            { title: "Storage", values: ["1 TB", "2 TB"] },
            { title: "Color", values: ["Space Black", "Platinum"] },
          ],
          variants: [
            {
              title: "1 TB / Space Black",
              sku: "CREATOR-1TB-SBK",
              options: { Storage: "1 TB", Color: "Space Black" },
              manage_inventory: false,
              prices: [
                { amount: 2999, currency_code: "eur" },
                { amount: 2999, currency_code: "usd" },
              ],
            },
            {
              title: "2 TB / Platinum",
              sku: "CREATOR-2TB-PLT",
              options: { Storage: "2 TB", Color: "Platinum" },
              manage_inventory: false,
              prices: [
                { amount: 3299, currency_code: "eur" },
                { amount: 3299, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // Product 18: Compact Smartphone
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title:
            '5.8" Compact Smartphone | Flagship Performance | One-Hand Friendly',
          category_ids: [getCatId("Smartphones")],
          description:
            "Big performance in a compact package. This 5.8-inch smartphone fits comfortably in one hand while packing flagship-level specs. The same powerful processor as larger models ensures smooth performance for any task. The 12MP triple camera system captures stunning photos. Perfect for those who prefer a smaller phone without compromising on features.",
          weight: 168,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/phone-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/phone-side.png",
            },
          ],
          options: [
            { title: "Storage", values: ["128 GB", "256 GB"] },
            { title: "Color", values: ["Midnight", "Starlight"] },
          ],
          variants: [
            {
              title: "128 GB / Midnight",
              sku: "COMPACT-128-MID",
              options: { Storage: "128 GB", Color: "Midnight" },
              manage_inventory: false,
              prices: [
                { amount: 799, currency_code: "eur" },
                { amount: 799, currency_code: "usd" },
              ],
            },
            {
              title: "256 GB / Starlight",
              sku: "COMPACT-256-STR",
              options: { Storage: "256 GB", Color: "Starlight" },
              manage_inventory: false,
              prices: [
                { amount: 899, currency_code: "eur" },
                { amount: 899, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // Product 19: Ultrawide Monitor
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title:
            '49" Super Ultrawide Monitor | 5120x1440 | 120Hz | Picture-by-Picture',
          category_ids: [getCatId("Monitors")],
          description:
            "Replace your dual monitor setup with this incredible 49-inch super ultrawide display. The 5120x1440 resolution provides the equivalent of two 27-inch monitors side by side. Picture-by-picture mode lets you connect two computers simultaneously. The 1000R curve wraps around your field of view for an immersive experience. Perfect for productivity, trading, and simulation gaming.",
          weight: 13500,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/screen-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/screen-side.png",
            },
          ],
          options: [{ title: "Color", values: ["Black", "White"] }],
          variants: [
            {
              title: "Ultrawide Monitor Black",
              sku: "MON-UW-49-BLK",
              options: { Color: "Black" },
              manage_inventory: false,
              prices: [
                { amount: 1199, currency_code: "eur" },
                { amount: 1199, currency_code: "usd" },
              ],
            },
            {
              title: "Ultrawide Monitor White",
              sku: "MON-UW-49-WHT",
              options: { Color: "White" },
              manage_inventory: false,
              prices: [
                { amount: 1249, currency_code: "eur" },
                { amount: 1249, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // Product 20: Studio Headphones
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title:
            "Studio Reference Headphones | Open-Back | Audiophile Grade | Detachable Cable",
          category_ids: [getCatId("Headphones")],
          description:
            "Experience music the way artists intended with these studio reference headphones. The open-back design delivers a spacious, natural soundstage preferred by audio professionals. Hand-matched drivers ensure consistent frequency response. Velour ear pads provide comfort during long mixing sessions. Detachable cable with both 3.5mm and 6.35mm options included.",
          weight: 285,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/headphone-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/headphone-side.png",
            },
          ],
          options: [{ title: "Color", values: ["Black", "Silver"] }],
          variants: [
            {
              title: "Studio Headphones Black",
              sku: "HP-STUDIO-BLK",
              options: { Color: "Black" },
              manage_inventory: false,
              prices: [
                { amount: 249, currency_code: "eur" },
                { amount: 249, currency_code: "usd" },
              ],
            },
            {
              title: "Studio Headphones Silver",
              sku: "HP-STUDIO-SLV",
              options: { Color: "Silver" },
              manage_inventory: false,
              prices: [
                { amount: 249, currency_code: "eur" },
                { amount: 249, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 1. Apple MacBook Air 13" M2
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: `Apple MacBook Air 13" (M2, 2022) | Fanless | 13.6" Liquid Retina`,
          collection_id: collection.id,
          category_ids: [getCatId("Laptops")],
          description:
            "The 13-inch MacBook Air with M2 combines a silent fanless design with a bright 13.6-inch Liquid Retina display that is easy to carry all day. The M2 chip delivers snappy performance for productivity, light content creation, and study work while keeping power consumption low. With up to 18 hours of battery life, fast Wi-Fi, and a responsive Magic Keyboard, it is a strong choice for students and mobile professionals who prioritize portability.",
          weight: 1250,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/laptop-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/laptop-side.png",
            },
          ],
          options: [
            { title: "Storage", values: ["256 GB", "512 GB"] },
            { title: "Color", values: ["Midnight", "Starlight"] },
          ],
          variants: [
            {
              title: "256 GB / Midnight",
              sku: "MBAIR-M2-256-MIDNIGHT",
              options: { Storage: "256 GB", Color: "Midnight" },
              manage_inventory: false,
              prices: [
                { amount: 1299, currency_code: "eur" },
                { amount: 1299, currency_code: "usd" },
              ],
            },
            {
              title: "512 GB / Starlight",
              sku: "MBAIR-M2-512-STARLIGHT",
              options: { Storage: "512 GB", Color: "Starlight" },
              manage_inventory: false,
              prices: [
                { amount: 1599, currency_code: "eur" },
                { amount: 1599, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 2. Apple MacBook Pro 14" M3 Pro
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: `Apple MacBook Pro 14" (M3 Pro) | Mini-LED | Pro Apps Ready`,
          collection_id: collection.id,
          category_ids: [getCatId("Laptops")],
          description:
            "The 14-inch MacBook Pro with M3 Pro is built for demanding workflows such as software development, 4K video editing, and RAW photo processing. Its mini-LED display offers deep contrast, high brightness, and excellent color accuracy for creative tasks. The M3 Pro chip handles multiple pro apps at once while remaining efficient enough for long unplugged sessions. With a robust port selection and solid aluminum body, it is a reliable mobile workstation.",
          weight: 1600,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/laptop-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/laptop-top.png",
            },
          ],
          options: [
            { title: "Storage", values: ["512 GB", "1 TB"] },
            { title: "Color", values: ["Silver", "Space Gray"] },
          ],
          variants: [
            {
              title: "512 GB / Silver",
              sku: "MBP14-M3PRO-512-SILVER",
              options: { Storage: "512 GB", Color: "Silver" },
              manage_inventory: false,
              prices: [
                { amount: 2199, currency_code: "eur" },
                { amount: 2199, currency_code: "usd" },
              ],
            },
            {
              title: "1 TB / Space Gray",
              sku: "MBP14-M3PRO-1TB-SG",
              options: { Storage: "1 TB", Color: "Space Gray" },
              manage_inventory: false,
              prices: [
                { amount: 2499, currency_code: "eur" },
                { amount: 2499, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 3. Dell XPS 13 9315
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Dell XPS 13 9315 | InfinityEdge | Ultraportable",
          collection_id: collection.id,
          category_ids: [getCatId("Laptops")],
          description:
            "The Dell XPS 13 9315 is an ultra-portable Windows laptop with a compact 13-inch InfinityEdge display that minimizes bezels. Its aluminum and glass design feels premium while remaining light enough to carry in a small backpack. Efficient Intel processors provide enough performance for office work, browsing, and light creative tasks. Long battery life and modern connectivity make it a solid everyday ultrabook for commuters and students.",
          weight: 1200,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/laptop-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/laptop-side.png",
            },
          ],
          options: [
            { title: "Storage", values: ["512 GB"] },
            { title: "Color", values: ["Platinum Silver"] },
          ],
          variants: [
            {
              title: "512 GB / Platinum Silver",
              sku: "XPS13-9315-512-SILVER",
              options: { Storage: "512 GB", Color: "Platinum Silver" },
              manage_inventory: false,
              prices: [
                { amount: 1399, currency_code: "eur" },
                { amount: 1399, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 4. Lenovo ThinkPad X1 Carbon Gen 11
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Lenovo ThinkPad X1 Carbon Gen 11 | Business Ultrabook",
          collection_id: collection.id,
          category_ids: [getCatId("Laptops")],
          description:
            "The ThinkPad X1 Carbon Gen 11 is a classic business ultrabook with a lightweight carbon-fiber chassis and a keyboard that is comfortable for long typing sessions. It offers strong Intel processors, enterprise security features, and a matte display suitable for brightly lit offices. With multiple USB-C and Thunderbolt ports, quiet cooling, and support for docking solutions, it fits well into modern hybrid work environments.",
          weight: 1150,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/laptop-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/laptop-top.png",
            },
          ],
          options: [{ title: "Storage", values: ["512 GB", "1 TB"] }],
          variants: [
            {
              title: "512 GB",
              sku: "X1CARBON-G11-512",
              options: { Storage: "512 GB" },
              manage_inventory: false,
              prices: [
                { amount: 1699, currency_code: "eur" },
                { amount: 1699, currency_code: "usd" },
              ],
            },
            {
              title: "1 TB",
              sku: "X1CARBON-G11-1TB",
              options: { Storage: "1 TB" },
              manage_inventory: false,
              prices: [
                { amount: 1899, currency_code: "eur" },
                { amount: 1899, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 5. ASUS ROG Zephyrus G14 (gaming laptop)
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: 'ASUS ROG Zephyrus G14 (2023) | 14" Gaming Laptop',
          collection_id: collection.id,
          category_ids: [getCatId("Laptops")],
          description:
            "The ROG Zephyrus G14 packs serious gaming performance into a compact 14-inch chassis. Fast AMD processors and dedicated graphics make it capable of high-frame-rate gaming and 3D workloads. The high-refresh display keeps motion smooth, while the cooling system balances performance and fan noise. Its small size and relatively low weight make it a rare gaming laptop that is genuinely easy to travel with.",
          weight: 1650,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/laptop-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/laptop-side.png",
            },
          ],
          options: [
            { title: "Storage", values: ["1 TB"] },
            { title: "Color", values: ["Moonlight White"] },
          ],
          variants: [
            {
              title: "1 TB / Moonlight White",
              sku: "ZEPPHYRUS-G14-1TB-WHITE",
              options: { Storage: "1 TB", Color: "Moonlight White" },
              manage_inventory: false,
              prices: [
                { amount: 1899, currency_code: "eur" },
                { amount: 1899, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 6. HP Spectre x360 14
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: 'HP Spectre x360 14" | 2-in-1 OLED Convertible',
          collection_id: collection.id,
          category_ids: [getCatId("Laptops")],
          description:
            "The HP Spectre x360 14 is a premium 2-in-1 convertible with a vivid OLED touch display and a slim metal design. It rotates into tablet, tent, or stand mode, making it flexible for note-taking, drawing, and media. Intel processors and fast SSD storage keep Windows responsive, while the included pen support makes it attractive for creative users who sketch or annotate documents.",
          weight: 1450,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/laptop-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/laptop-top.png",
            },
          ],
          options: [
            { title: "Storage", values: ["512 GB"] },
            { title: "Color", values: ["Nightfall Black"] },
          ],
          variants: [
            {
              title: "512 GB / Nightfall Black",
              sku: "SPECTRE-X360-14-512-BLACK",
              options: { Storage: "512 GB", Color: "Nightfall Black" },
              manage_inventory: false,
              prices: [
                { amount: 1599, currency_code: "eur" },
                { amount: 1599, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 7. Apple iPhone 15 Pro
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Apple iPhone 15 Pro | A17 Pro | Pro Camera System",
          collection_id: collection.id,
          category_ids: [getCatId("Smartphones")],
          description:
            "The iPhone 15 Pro brings a titanium frame, USB-C connectivity, and the A17 Pro chip for fluid gaming and demanding mobile apps. Its triple camera system captures detailed photos and stabilized 4K video in a compact body. The high-brightness display stays readable outdoors, while iOS and the Apple ecosystem make it especially appealing for users with other Apple devices.",
          weight: 187,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/phone-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/phone-side.png",
            },
          ],
          options: [
            { title: "Memory", values: ["256 GB", "512 GB"] },
            { title: "Color", values: ["Natural Titanium", "Blue Titanium"] },
          ],
          variants: [
            {
              title: "256 GB / Natural Titanium",
              sku: "IP15PRO-256-NAT",
              options: { Memory: "256 GB", Color: "Natural Titanium" },
              manage_inventory: false,
              prices: [
                { amount: 1199, currency_code: "eur" },
                { amount: 1199, currency_code: "usd" },
              ],
            },
            {
              title: "512 GB / Blue Titanium",
              sku: "IP15PRO-512-BLUE",
              options: { Memory: "512 GB", Color: "Blue Titanium" },
              manage_inventory: false,
              prices: [
                { amount: 1399, currency_code: "eur" },
                { amount: 1399, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 8. Samsung Galaxy S24 Ultra
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Samsung Galaxy S24 Ultra | S Pen | 200MP Camera",
          collection_id: collection.id,
          category_ids: [getCatId("Smartphones")],
          description:
            "The Galaxy S24 Ultra is a large Android flagship with a built-in S Pen for note-taking and sketching directly on its expansive display. Its 200MP main camera and advanced zoom system are designed for detailed photos at both close and long distances. A powerful processor, large battery, and bright screen make it suitable for heavy multitasking, gaming, and outdoor use.",
          weight: 232,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/phone-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/phone-bottom.png",
            },
          ],
          options: [
            { title: "Memory", values: ["256 GB", "512 GB"] },
            { title: "Color", values: ["Titanium Black", "Titanium Gray"] },
          ],
          variants: [
            {
              title: "256 GB / Titanium Black",
              sku: "S24U-256-BLACK",
              options: { Memory: "256 GB", Color: "Titanium Black" },
              manage_inventory: false,
              prices: [
                { amount: 1299, currency_code: "eur" },
                { amount: 1299, currency_code: "usd" },
              ],
            },
            {
              title: "512 GB / Titanium Gray",
              sku: "S24U-512-GRAY",
              options: { Memory: "512 GB", Color: "Titanium Gray" },
              manage_inventory: false,
              prices: [
                { amount: 1499, currency_code: "eur" },
                { amount: 1499, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 9. Google Pixel 8 Pro
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Google Pixel 8 Pro | Tensor G3 | Computational Camera",
          collection_id: collection.id,
          category_ids: [getCatId("Smartphones")],
          description:
            "The Google Pixel 8 Pro focuses on camera quality and clean Android software. Its Tensor G3 chip powers AI-driven photo and audio tools that can remove distractions from images or clean up recorded speech. The triple rear camera setup handles wide, ultra-wide, and telephoto shots with natural color reproduction. Long software support and fast security updates make it attractive for users who like a simple, Google-centric experience.",
          weight: 213,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/phone-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/phone-side.png",
            },
          ],
          options: [{ title: "Memory", values: ["128 GB", "256 GB"] }],
          variants: [
            {
              title: "128 GB",
              sku: "PIXEL8PRO-128",
              options: { Memory: "128 GB" },
              manage_inventory: false,
              prices: [
                { amount: 999, currency_code: "eur" },
                { amount: 999, currency_code: "usd" },
              ],
            },
            {
              title: "256 GB",
              sku: "PIXEL8PRO-256",
              options: { Memory: "256 GB" },
              manage_inventory: false,
              prices: [
                { amount: 1099, currency_code: "eur" },
                { amount: 1099, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 10. OnePlus 12
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "OnePlus 12 | Fast Charging | Fluid AMOLED",
          collection_id: collection.id,
          category_ids: [getCatId("Smartphones")],
          description:
            "The OnePlus 12 combines a fast high-refresh AMOLED display with extremely quick wired charging for users who value speed. Its Snapdragon-class processor keeps Android responsive, even when switching between multiple apps and games. A versatile camera setup covers everyday scenes with balanced colors, while OxygenOS adds useful tweaks on top of a clean interface.",
          weight: 220,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/phone-front.png",
            },
          ],
          options: [
            { title: "Memory", values: ["256 GB"] },
            { title: "Color", values: ["Flowy Emerald"] },
          ],
          variants: [
            {
              title: "256 GB / Flowy Emerald",
              sku: "ONEPLUS12-256-GREEN",
              options: { Memory: "256 GB", Color: "Flowy Emerald" },
              manage_inventory: false,
              prices: [
                { amount: 949, currency_code: "eur" },
                { amount: 949, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 11. Samsung Galaxy A54 5G
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Samsung Galaxy A54 5G | Midrange | Long Battery",
          collection_id: collection.id,
          category_ids: [getCatId("Smartphones")],
          description:
            "The Galaxy A54 5G is a midrange smartphone that focuses on value, offering a bright AMOLED panel, solid battery life, and a versatile camera at a lower price than flagship devices. It supports 5G networks for quick downloads and streaming when coverage is available. The plastic frame keeps weight down, while One UI adds extra features that many Galaxy users already recognize.",
          weight: 202,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/phone-front.png",
            },
          ],
          options: [
            { title: "Memory", values: ["128 GB"] },
            { title: "Color", values: ["Awesome Lime"] },
          ],
          variants: [
            {
              title: "128 GB / Awesome Lime",
              sku: "A54-128-LIME",
              options: { Memory: "128 GB", Color: "Awesome Lime" },
              manage_inventory: false,
              prices: [
                { amount: 449, currency_code: "eur" },
                { amount: 449, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 12. Nothing Phone (2)
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Nothing Phone (2) | Glyph Interface | Transparent Back",
          collection_id: collection.id,
          category_ids: [getCatId("Smartphones")],
          description:
            "The Nothing Phone (2) stands out with its transparent back and glyph light interface that can signal calls and notifications using subtle patterns. Its OLED display, smooth refresh rate, and clean software create a modern feel that emphasizes design. Cameras capture detailed photos in everyday conditions, while the mid-to-high-end chipset keeps performance responsive without pushing power consumption too far.",
          weight: 201,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/phone-front.png",
            },
          ],
          options: [{ title: "Memory", values: ["256 GB"] }],
          variants: [
            {
              title: "256 GB",
              sku: "NOTHING2-256",
              options: { Memory: "256 GB" },
              manage_inventory: false,
              prices: [
                { amount: 799, currency_code: "eur" },
                { amount: 799, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 13. LG UltraGear 27GP850-B
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: 'LG UltraGear 27GP850-B | 27" QHD | 165Hz Nano IPS',
          collection_id: collection.id,
          category_ids: [getCatId("Monitors")],
          description:
            "The LG UltraGear 27GP850-B is a 27-inch gaming monitor with a 2560×1440 Nano IPS panel and a refresh rate that can reach 165 Hz. Its fast response time and support for variable refresh-rate technologies help reduce tearing and ghosting in fast games. Good color reproduction and viewing angles also make it usable for everyday work and media, not just gaming sessions.",
          weight: 5500,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/screen-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/screen-side.png",
            },
          ],
          options: [{ title: "Color", values: ["Black"] }],
          variants: [
            {
              title: "Standard / Black",
              sku: "LG27GP850-BLACK",
              options: { Color: "Black" },
              manage_inventory: false,
              prices: [
                { amount: 449, currency_code: "eur" },
                { amount: 449, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 14. Dell UltraSharp U2723QE
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: 'Dell UltraSharp U2723QE | 27" 4K | USB-C Hub Monitor',
          collection_id: collection.id,
          category_ids: [getCatId("Monitors")],
          description:
            "The Dell UltraSharp U2723QE is a 27-inch 4K monitor aimed at productivity and creative work. It includes a USB-C hub that can supply power to a laptop while connecting peripherals through a single cable. The IPS panel focuses on color accuracy and consistent brightness, which is useful for photo editing and design tasks. An ergonomic stand allows height, tilt, and swivel adjustments for comfortable long-term use.",
          weight: 6000,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/screen-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/screen-top.png",
            },
          ],
          options: [{ title: "Color", values: ["Black"] }],
          variants: [
            {
              title: "Standard / Black",
              sku: "U2723QE-BLACK",
              options: { Color: "Black" },
              manage_inventory: false,
              prices: [
                { amount: 629, currency_code: "eur" },
                { amount: 629, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 15. Samsung Odyssey G7 27"
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: 'Samsung Odyssey G7 27" | 240Hz Curved QHD',
          collection_id: collection.id,
          category_ids: [getCatId("Monitors")],
          description:
            "The Samsung Odyssey G7 27-inch is a curved QHD gaming monitor with a very high refresh rate of up to 240 Hz. Its VA panel offers deep contrast for dark scenes and strong immersion in story-driven games. The aggressive curve pulls the edges of the screen closer to your field of view, while adaptive sync technologies help keep motion smooth when frame rates change.",
          weight: 6200,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/screen-front.png",
            },
          ],
          options: [{ title: "Color", values: ["Black"] }],
          variants: [
            {
              title: "Standard / Black",
              sku: "ODYSSEY-G7-27",
              options: { Color: "Black" },
              manage_inventory: false,
              prices: [
                { amount: 599, currency_code: "eur" },
                { amount: 599, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 16. ASUS ProArt PA278QV
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: 'ASUS ProArt PA278QV | 27" QHD | Color-Focused',
          collection_id: collection.id,
          category_ids: [getCatId("Monitors")],
          description:
            "The ASUS ProArt PA278QV is a 27-inch QHD monitor tuned for creators who care about accurate color. Factory calibration targets reliable sRGB coverage, making it suitable for web design, illustration, and photo work. Numerous connectivity options and an ergonomic stand help it slot into a studio or home office without much fuss.",
          weight: 5800,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/screen-front.png",
            },
          ],
          options: [{ title: "Color", values: ["Black"] }],
          variants: [
            {
              title: "Standard / Black",
              sku: "PA278QV-BLACK",
              options: { Color: "Black" },
              manage_inventory: false,
              prices: [
                { amount: 379, currency_code: "eur" },
                { amount: 379, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 17. Logitech MX Master 3S (mouse)
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Logitech MX Master 3S Wireless Mouse | 8K DPI | Quiet Clicks",
          collection_id: collection.id,
          category_ids: [getCatId("Mice")],
          description:
            "The Logitech MX Master 3S is a productivity mouse with an ergonomic shape that supports the hand during long sessions. Its MagSpeed scroll wheel can quickly move through long documents or switch into precise mode for careful scrolling. With 8K DPI tracking that works on many surfaces and quiet main buttons, it suits both office and home environments where comfort and flexibility matter.",
          weight: 200,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/mouse-top.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/mouse-front.png",
            },
          ],
          options: [{ title: "Color", values: ["Graphite"] }],
          variants: [
            {
              title: "Graphite",
              sku: "MXM3S-GRAPHITE",
              options: { Color: "Graphite" },
              manage_inventory: false,
              prices: [
                { amount: 99, currency_code: "eur" },
                { amount: 99, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 18. Logitech MX Keys S (keyboard)
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Logitech MX Keys S Wireless Keyboard | Low-Profile | Backlit",
          collection_id: collection.id,
          category_ids: [getCatId("Keyboards")],
          description:
            "The Logitech MX Keys S is a low-profile wireless keyboard designed for comfortable typing on multiple devices. Its backlit keys automatically adjust brightness based on ambient light, and the layout will feel familiar to laptop users. With support for easy device switching and USB-C charging, it targets people who move between desktops, laptops, and tablets while wanting a single main keyboard.",
          weight: 800,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/keyboard-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/keyboard-side.png",
            },
          ],
          options: [{ title: "Color", values: ["Graphite"] }],
          variants: [
            {
              title: "Graphite",
              sku: "MXKEYS-S-GRAPHITE",
              options: { Color: "Graphite" },
              manage_inventory: false,
              prices: [
                { amount: 129, currency_code: "eur" },
                { amount: 129, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 19. SteelSeries Arctis Nova Pro Wireless (headset)
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title:
            "SteelSeries Arctis Nova Pro Wireless | Multi-System Gaming Headset",
          collection_id: collection.id,
          category_ids: [getCatId("Headphones")],
          description:
            "The SteelSeries Arctis Nova Pro Wireless is a gaming headset designed for people who switch between PC, console, and other devices. Its base station manages wireless connections and includes hot-swappable batteries so the headset can stay powered for long sessions. The sound profile aims for a detailed but enjoyable presentation, while the retractable microphone provides clear voice chat in games and online meetings.",
          weight: 320,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/headphone-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/headphone-side.png",
            },
          ],
          options: [{ title: "Color", values: ["Black"] }],
          variants: [
            {
              title: "Black",
              sku: "NOVA-PRO-WL-BLACK",
              options: { Color: "Black" },
              manage_inventory: false,
              prices: [
                { amount: 349, currency_code: "eur" },
                { amount: 349, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 20. Jabra Speak 710 UC (speakerphone)
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Jabra Speak 710 UC Speakerphone | Portable Conference Audio",
          collection_id: collection.id,
          category_ids: [getCatId("Speakers")],
          description:
            "The Jabra Speak 710 is a compact conference speakerphone built for small meeting rooms and home offices. Its 360-degree microphone pick-up allows people around a table to be heard clearly during calls. The unit connects over USB or Bluetooth, making it easy to pair with laptops and phones. A simple control layout on the top surface keeps muting and volume adjustments straightforward during busy meetings.",
          weight: 298,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/speaker-top.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/speaker-front.png",
            },
          ],
          options: [{ title: "Color", values: ["Black"] }],
          variants: [
            {
              title: "Black",
              sku: "SPEAK710-UC-BLACK",
              options: { Color: "Black" },
              manage_inventory: false,
              prices: [
                { amount: 199, currency_code: "eur" },
                { amount: 199, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 21. Razer DeathAdder V3 Pro Gaming Mouse
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title:
            "Razer DeathAdder V3 Pro | Ultra-Light | 30K DPI | Wireless Esports",
          category_ids: [getCatId("Mice")],
          description:
            "The Razer DeathAdder V3 Pro is an ultra-lightweight wireless gaming mouse designed for esports professionals. At just 63 grams, it features the Focus Pro 30K optical sensor for precise tracking on any surface. The ergonomic shape has been refined through pro feedback for comfortable grip during long gaming sessions. HyperSpeed Wireless technology ensures lag-free connectivity with up to 90 hours of battery life.",
          weight: 63,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/mouse-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/mouse-top.png",
            },
          ],
          options: [{ title: "Color", values: ["Black", "White"] }],
          variants: [
            {
              title: "DeathAdder V3 Pro Black",
              sku: "DA-V3PRO-BLK",
              options: { Color: "Black" },
              manage_inventory: false,
              prices: [
                { amount: 149, currency_code: "eur" },
                { amount: 149, currency_code: "usd" },
              ],
            },
            {
              title: "DeathAdder V3 Pro White",
              sku: "DA-V3PRO-WHT",
              options: { Color: "White" },
              manage_inventory: false,
              prices: [
                { amount: 149, currency_code: "eur" },
                { amount: 149, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 22. Keychron Q1 Pro Mechanical Keyboard
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Keychron Q1 Pro | 75% Wireless | QMK/VIA | Gasket Mount",
          category_ids: [getCatId("Keyboards")],
          description:
            "The Keychron Q1 Pro is a premium 75% wireless mechanical keyboard with a CNC aluminum body and gasket mount design for a soft, cushioned typing feel. Fully programmable via QMK and VIA, it supports Bluetooth, 2.4GHz wireless, and wired modes. Hot-swappable south-facing RGB switches let you customize your typing experience without soldering. The included sound-dampening foam reduces noise and improves acoustics.",
          weight: 1600,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/keyboard-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/keyboard-side.png",
            },
          ],
          options: [
            { title: "Switch Type", values: ["Gateron Brown", "Gateron Red"] },
            { title: "Color", values: ["Carbon Black", "Shell White"] },
          ],
          variants: [
            {
              title: "Gateron Brown / Carbon Black",
              sku: "Q1PRO-BROWN-BLACK",
              options: {
                "Switch Type": "Gateron Brown",
                Color: "Carbon Black",
              },
              manage_inventory: false,
              prices: [
                { amount: 199, currency_code: "eur" },
                { amount: 199, currency_code: "usd" },
              ],
            },
            {
              title: "Gateron Red / Shell White",
              sku: "Q1PRO-RED-WHITE",
              options: { "Switch Type": "Gateron Red", Color: "Shell White" },
              manage_inventory: false,
              prices: [
                { amount: 199, currency_code: "eur" },
                { amount: 199, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 23. Sony WH-1000XM5 Headphones
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Sony WH-1000XM5 | Industry-Leading ANC | 30hr Battery",
          category_ids: [getCatId("Headphones")],
          description:
            "The Sony WH-1000XM5 sets the benchmark for wireless noise-canceling headphones. Eight microphones and two processors create industry-leading ANC that adapts to your environment in real-time. The new lightweight design with soft-fit leather reduces pressure during long listening sessions. LDAC codec support delivers Hi-Res Audio wirelessly, while Speak-to-Chat automatically pauses music when you talk.",
          weight: 250,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/headphone-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/headphone-side.png",
            },
          ],
          options: [{ title: "Color", values: ["Black", "Platinum Silver"] }],
          variants: [
            {
              title: "WH-1000XM5 Black",
              sku: "SONY-XM5-BLKS",
              options: { Color: "Black" },
              manage_inventory: false,
              prices: [
                { amount: 379, currency_code: "eur" },
                { amount: 379, currency_code: "usd" },
              ],
            },
            {
              title: "WH-1000XM5 Platinum Silver",
              sku: "SONY-XM5-SLVS",
              options: { Color: "Platinum Silver" },
              manage_inventory: false,
              prices: [
                { amount: 379, currency_code: "eur" },
                { amount: 379, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 24. Apple AirPods Pro 2
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Apple AirPods Pro (2nd Gen) | USB-C | Adaptive Audio",
          category_ids: [getCatId("Headphones")],
          description:
            "The second-generation AirPods Pro with USB-C charging case delivers powerful Active Noise Cancellation and Transparency mode with the new Adaptive Audio feature that intelligently blends both. The H2 chip enables computational audio processing for immersive Spatial Audio with dynamic head tracking. Conversation Awareness automatically lowers media volume when you speak, and touch controls on the stems adjust volume with a simple swipe.",
          weight: 51,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/headphone-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/headphone-top.png",
            },
          ],
          options: [{ title: "Color", values: ["White"] }],
          variants: [
            {
              title: "AirPods Pro 2",
              sku: "APP2-USBC",
              options: { Color: "White" },
              manage_inventory: false,
              prices: [
                { amount: 279, currency_code: "eur" },
                { amount: 279, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 25. Sonos Era 300 Speaker
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Sonos Era 300 | Spatial Audio | Dolby Atmos | Voice Control",
          category_ids: [getCatId("Speakers")],
          description:
            "The Sonos Era 300 is designed for spatial audio, featuring six drivers oriented in multiple directions to create an immersive 3D sound experience. It supports Dolby Atmos Music tracks and uses advanced processing to fill your room with dimension. Connect via WiFi for multi-room audio, or use Bluetooth when guests want to share. Voice assistants are built in for hands-free control of music, smart home, and more.",
          weight: 4470,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/speaker-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/speaker-top.png",
            },
          ],
          options: [{ title: "Color", values: ["Black", "White"] }],
          variants: [
            {
              title: "Era 300 Black",
              sku: "SONOS-ERA300-BLK",
              options: { Color: "Black" },
              manage_inventory: false,
              prices: [
                { amount: 449, currency_code: "eur" },
                { amount: 449, currency_code: "usd" },
              ],
            },
            {
              title: "Era 300 White",
              sku: "SONOS-ERA300-WHT",
              options: { Color: "White" },
              manage_inventory: false,
              prices: [
                { amount: 449, currency_code: "eur" },
                { amount: 449, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 26. Elgato Facecam Pro 4K60
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Elgato Facecam Pro | 4K60 | Sony Sensor | Creator-Focused",
          category_ids: [getCatId("Webcams")],
          description:
            "The Elgato Facecam Pro is the first 4K60 webcam, capturing ultra-sharp video at 60fps for content creators who demand the best. The large Sony sensor excels in low light, while the uncompressed MJPEG output ensures maximum quality for streaming and recording. Companion software provides pro-grade controls for exposure, color, and field of view. A USB 3.0 connection is required for full 4K60 performance.",
          weight: 150,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/camera-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/camera-side.png",
            },
          ],
          options: [{ title: "Color", values: ["Black"] }],
          variants: [
            {
              title: "Facecam Pro",
              sku: "ELGATO-FC-PRO",
              options: { Color: "Black" },
              manage_inventory: false,
              prices: [
                { amount: 299, currency_code: "eur" },
                { amount: 299, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 27. BenQ ScreenBar Halo Monitor Light
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title:
            "BenQ ScreenBar Halo | Monitor Light | Wireless Controller | Backlight",
          category_ids: [getCatId("Monitors")],
          description:
            "The BenQ ScreenBar Halo is a monitor-mounted LED light bar that illuminates your desk without screen glare. The wireless controller allows quick adjustments to brightness and color temperature. The unique backlight feature also illuminates the wall behind your monitor, reducing eye strain in dark environments. Asymmetric optical design focuses light downward on your workspace rather than in your eyes.",
          weight: 530,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/screen-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/screen-top.png",
            },
          ],
          options: [{ title: "Color", values: ["Black", "Silver"] }],
          variants: [
            {
              title: "ScreenBar Halo Black",
              sku: "BENQ-HALO-BLK",
              options: { Color: "Black" },
              manage_inventory: false,
              prices: [
                { amount: 179, currency_code: "eur" },
                { amount: 179, currency_code: "usd" },
              ],
            },
            {
              title: "ScreenBar Halo Silver",
              sku: "BENQ-HALO-SLV",
              options: { Color: "Silver" },
              manage_inventory: false,
              prices: [
                { amount: 179, currency_code: "eur" },
                { amount: 179, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 28. Samsung Galaxy Buds3 Pro
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Samsung Galaxy Buds3 Pro | Intelligent ANC | 360 Audio",
          category_ids: [getCatId("Headphones")],
          description:
            "The Galaxy Buds3 Pro delivers exceptional sound with 2-way speakers that separate highs and lows for clearer audio. Intelligent ANC adapts to your environment using real-time analysis, while 360 Audio with head tracking creates an immersive theater-like experience for supported content. The blade-light design is both eye-catching and ergonomic, with up to 30 hours of total listening time with the case.",
          weight: 49,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/headphone-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/headphone-top.png",
            },
          ],
          options: [{ title: "Color", values: ["Silver", "White"] }],
          variants: [
            {
              title: "Buds3 Pro Silver",
              sku: "BUDS3PRO-SLV",
              options: { Color: "Silver" },
              manage_inventory: false,
              prices: [
                { amount: 249, currency_code: "eur" },
                { amount: 249, currency_code: "usd" },
              ],
            },
            {
              title: "Buds3 Pro White",
              sku: "BUDS3PRO-WHT",
              options: { Color: "White" },
              manage_inventory: false,
              prices: [
                { amount: 249, currency_code: "eur" },
                { amount: 249, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 29. Bose SoundLink Max Speaker
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Bose SoundLink Max | Powerful Portable | 20hr Battery | IP67",
          category_ids: [getCatId("Speakers")],
          description:
            "The Bose SoundLink Max is the most powerful portable Bluetooth speaker from Bose, delivering room-filling sound from a compact, rugged design. Two custom racetrack drivers and dual passive radiators create deep bass and clear highs. The IP67 rating protects against dust and water, while the 20-hour battery keeps music playing all day. A built-in strap makes it easy to carry anywhere.",
          weight: 1480,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/speaker-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/speaker-top.png",
            },
          ],
          options: [{ title: "Color", values: ["Black", "Blue"] }],
          variants: [
            {
              title: "SoundLink Max Black",
              sku: "BOSE-SLMAX-BLK",
              options: { Color: "Black" },
              manage_inventory: false,
              prices: [
                { amount: 399, currency_code: "eur" },
                { amount: 399, currency_code: "usd" },
              ],
            },
            {
              title: "SoundLink Max Blue",
              sku: "BOSE-SLMAX-BLU",
              options: { Color: "Blue" },
              manage_inventory: false,
              prices: [
                { amount: 399, currency_code: "eur" },
                { amount: 399, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 30. Corsair K100 RGB Keyboard
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Corsair K100 RGB | Optical-Mechanical | iCUE Control Wheel",
          category_ids: [getCatId("Keyboards")],
          description:
            "The Corsair K100 RGB is a flagship mechanical gaming keyboard featuring ultra-fast optical-mechanical switches with 1ms response time. The unique iCUE control wheel provides intuitive volume control, scrolling, and in-game commands. Per-key RGB backlighting powered by 44-zone LightEdge creates stunning lighting effects. The PBT double-shot keycaps and aircraft-grade aluminum frame ensure durability for years of gaming.",
          weight: 1280,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/keyboard-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/keyboard-side.png",
            },
          ],
          options: [{ title: "Color", values: ["Black"] }],
          variants: [
            {
              title: "K100 RGB Black",
              sku: "CORSAIR-K100-BLK",
              options: { Color: "Black" },
              manage_inventory: false,
              prices: [
                { amount: 229, currency_code: "eur" },
                { amount: 229, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 31. Xiaomi 14 Ultra Smartphone
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title:
            "Xiaomi 14 Ultra | Leica Optics | 1-inch Sensor | 90W Charging",
          category_ids: [getCatId("Smartphones")],
          description:
            "The Xiaomi 14 Ultra is a photography-focused flagship co-engineered with Leica. Its quad camera system includes a massive 1-inch main sensor and variable aperture from f/1.63 to f/4.0 for creative depth control. The 3.2x and 5x telephoto lenses cover portrait to long-range zoom. A stunning AMOLED display with 3200x1440 resolution and 120Hz refresh rate complements the Snapdragon 8 Gen 3 processor for smooth performance in any task.",
          weight: 220,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/phone-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/phone-side.png",
            },
          ],
          options: [
            { title: "Storage", values: ["256 GB", "512 GB"] },
            { title: "Color", values: ["Black", "White"] },
          ],
          variants: [
            {
              title: "256 GB / Black",
              sku: "MI14U-256-BLK",
              options: { Storage: "256 GB", Color: "Black" },
              manage_inventory: false,
              prices: [
                { amount: 1299, currency_code: "eur" },
                { amount: 1299, currency_code: "usd" },
              ],
            },
            {
              title: "512 GB / White",
              sku: "MI14U-512-WHT",
              options: { Storage: "512 GB", Color: "White" },
              manage_inventory: false,
              prices: [
                { amount: 1449, currency_code: "eur" },
                { amount: 1449, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 32. ASUS ROG Swift PG32UCDM Monitor
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title:
            'ASUS ROG Swift PG32UCDM | 32" 4K OLED | 240Hz | Gaming Excellence',
          category_ids: [getCatId("Monitors")],
          description:
            "The ASUS ROG Swift PG32UCDM is a cutting-edge 32-inch 4K OLED gaming monitor with an incredible 240Hz refresh rate and 0.03ms response time. The WOLED panel delivers perfect blacks and infinite contrast for stunning HDR gaming. Custom heatsink design prevents burn-in, while HDMI 2.1 and DisplayPort 2.1 support next-gen consoles and graphics cards at full capability. G-Sync and FreeSync Premium Pro ensure tear-free gameplay.",
          weight: 7500,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/screen-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/screen-back.png",
            },
          ],
          options: [{ title: "Color", values: ["Black"] }],
          variants: [
            {
              title: "PG32UCDM",
              sku: "ROG-PG32UCDM",
              options: { Color: "Black" },
              manage_inventory: false,
              prices: [
                { amount: 1299, currency_code: "eur" },
                { amount: 1299, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 33. Logitech G Pro X Superlight 2
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title:
            "Logitech G Pro X Superlight 2 | 60g | HERO 2 Sensor | Esports",
          category_ids: [getCatId("Mice")],
          description:
            "The G Pro X Superlight 2 builds on the legendary esports mouse with the new HERO 2 sensor delivering 32K DPI and 500 IPS tracking. At just 60 grams, it is one of the lightest wireless gaming mice available. The new LIGHTFORCE hybrid optical-mechanical switches provide crisp clicks with improved durability. Pro players trust it for its flawless wireless connection with under 1ms latency via LIGHTSPEED technology.",
          weight: 60,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/mouse-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/mouse-top.png",
            },
          ],
          options: [{ title: "Color", values: ["Black", "White", "Pink"] }],
          variants: [
            {
              title: "Superlight 2 Black",
              sku: "GPXSL2-BLK",
              options: { Color: "Black" },
              manage_inventory: false,
              prices: [
                { amount: 169, currency_code: "eur" },
                { amount: 169, currency_code: "usd" },
              ],
            },
            {
              title: "Superlight 2 White",
              sku: "GPXSL2-WHT",
              options: { Color: "White" },
              manage_inventory: false,
              prices: [
                { amount: 169, currency_code: "eur" },
                { amount: 169, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 34. Nuphy Air75 V2 Keyboard
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Nuphy Air75 V2 | Ultra-Slim | 75% Wireless | RGB",
          category_ids: [getCatId("Keyboards")],
          description:
            "The Nuphy Air75 V2 is an ultra-slim 75% wireless mechanical keyboard that combines portability with premium features. Its low-profile Gateron switches provide a satisfying typing experience in a compact package. Triple-mode connectivity (Bluetooth, 2.4GHz, wired) works seamlessly across Mac, Windows, and mobile devices. Per-key RGB with side-glow lighting creates a stunning visual effect. Perfect for hot-desking and travel.",
          weight: 520,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/keyboard-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/keyboard-side.png",
            },
          ],
          options: [
            { title: "Switch Type", values: ["Aloe", "Cowberry"] },
            { title: "Color", values: ["Black", "White"] },
          ],
          variants: [
            {
              title: "Aloe / Black",
              sku: "AIR75V2-ALOE-BLK",
              options: { "Switch Type": "Aloe", Color: "Black" },
              manage_inventory: false,
              prices: [
                { amount: 109, currency_code: "eur" },
                { amount: 109, currency_code: "usd" },
              ],
            },
            {
              title: "Cowberry / White",
              sku: "AIR75V2-COW-WHT",
              options: { "Switch Type": "Cowberry", Color: "White" },
              manage_inventory: false,
              prices: [
                { amount: 109, currency_code: "eur" },
                { amount: 109, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 35. Bose QuietComfort Ultra Headphones
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Bose QuietComfort Ultra | Immersive Audio | CustomTune",
          category_ids: [getCatId("Headphones")],
          description:
            "The Bose QuietComfort Ultra Headphones deliver world-class noise cancellation with the new Immersive Audio feature that creates a spacious, theater-like sound experience. CustomTune technology automatically analyzes your ear shape to optimize sound and ANC performance. The plush ear cushions and adjustable headband provide all-day comfort. Up to 24 hours of battery life keeps you listening, with just 15 minutes of charging adding 2.5 hours of playtime.",
          weight: 250,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/headphone-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/headphone-side.png",
            },
          ],
          options: [{ title: "Color", values: ["Black", "Sandstone"] }],
          variants: [
            {
              title: "QC Ultra Black",
              sku: "BOSE-QCU-BLKS",
              options: { Color: "Black" },
              manage_inventory: false,
              prices: [
                { amount: 449, currency_code: "eur" },
                { amount: 449, currency_code: "usd" },
              ],
            },
            {
              title: "QC Ultra Sandstone",
              sku: "BOSE-QCU-SND",
              options: { Color: "Sandstone" },
              manage_inventory: false,
              prices: [
                { amount: 449, currency_code: "eur" },
                { amount: 449, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 36. JBL Xtreme 4 Speaker
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "JBL Xtreme 4 | Party Boost | AI Sound | 24hr Battery",
          category_ids: [getCatId("Speakers")],
          description:
            "The JBL Xtreme 4 is a powerful portable Bluetooth speaker with AI Sound Boost that intelligently adjusts performance based on content and environment. Dual woofers and dual tweeters deliver deep bass and crisp highs that fill any space. IP67 waterproof and dustproof rating handles any outdoor adventure. PartyBoost allows you to connect multiple JBL speakers for an even bigger sound. The shoulder strap with built-in bottle opener makes it the ultimate party companion.",
          weight: 2100,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/speaker-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/speaker-top.png",
            },
          ],
          options: [
            { title: "Color", values: ["Black", "Blue", "Camouflage"] },
          ],
          variants: [
            {
              title: "Xtreme 4 Black",
              sku: "JBL-XT4-BLK",
              options: { Color: "Black" },
              manage_inventory: false,
              prices: [
                { amount: 379, currency_code: "eur" },
                { amount: 379, currency_code: "usd" },
              ],
            },
            {
              title: "Xtreme 4 Blue",
              sku: "JBL-XT4-BLU",
              options: { Color: "Blue" },
              manage_inventory: false,
              prices: [
                { amount: 379, currency_code: "eur" },
                { amount: 379, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 37. Insta360 Link 2 Webcam
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Insta360 Link 2 | AI Tracking | 4K30 | Gesture Control",
          category_ids: [getCatId("Webcams")],
          description:
            "The Insta360 Link 2 is an AI-powered webcam with 3-axis gimbal stabilization that automatically tracks your movement as you present, teach, or stream. Gesture controls let you zoom in, switch modes, or start recording with simple hand movements. The 4K sensor with AI noise reduction ensures professional video quality even in challenging lighting. DeskView mode lets you show documents or products on your desk in overhead perspective.",
          weight: 106,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/camera-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/camera-side.png",
            },
          ],
          options: [{ title: "Color", values: ["Black"] }],
          variants: [
            {
              title: "Link 2",
              sku: "I360-LINK2",
              options: { Color: "Black" },
              manage_inventory: false,
              prices: [
                { amount: 299, currency_code: "eur" },
                { amount: 299, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 38. Framework Laptop 16
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title:
            "Framework Laptop 16 | Modular | Upgradeable | User-Repairable",
          category_ids: [getCatId("Laptops")],
          description:
            "The Framework Laptop 16 redefines what a laptop can be with a fully modular and user-upgradeable design. Swap expansion cards to customize your ports, upgrade the CPU, GPU, RAM, and storage yourself, and choose from multiple keyboard layouts. The expansion bay system lets you add a dedicated graphics module or additional batteries. Built for longevity and sustainability, it is designed to last and evolve with your needs over years of use.",
          weight: 2100,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/laptop-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/laptop-side.png",
            },
          ],
          options: [
            { title: "GPU Module", values: ["Integrated", "Radeon RX 7700S"] },
          ],
          variants: [
            {
              title: "Integrated Graphics",
              sku: "FW16-INT",
              options: { "GPU Module": "Integrated" },
              manage_inventory: false,
              prices: [
                { amount: 1399, currency_code: "eur" },
                { amount: 1399, currency_code: "usd" },
              ],
            },
            {
              title: "Radeon RX 7700S",
              sku: "FW16-7700S",
              options: { "GPU Module": "Radeon RX 7700S" },
              manage_inventory: false,
              prices: [
                { amount: 1899, currency_code: "eur" },
                { amount: 1899, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 39. ASUS Zenbook Duo 14 OLED
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "ASUS Zenbook Duo 14 | Dual OLED Screens | Intel Core Ultra",
          category_ids: [getCatId("Laptops")],
          description:
            "The ASUS Zenbook Duo 14 features two full-size OLED touchscreens for unprecedented multitasking capability. Both 14-inch displays offer 120Hz refresh rate and 3K resolution for stunning visuals. Detachable Bluetooth keyboard allows flexible usage modes from laptop to dual-monitor desktop. Powered by Intel Core Ultra processors with NPU for AI-enhanced workflows. Perfect for creative professionals, developers, and productivity enthusiasts who need maximum screen real estate.",
          weight: 1650,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/laptop-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/laptop-top.png",
            },
          ],
          options: [
            { title: "Storage", values: ["512 GB", "1 TB"] },
            { title: "Color", values: ["Inkwell Gray"] },
          ],
          variants: [
            {
              title: "512 GB / Inkwell Gray",
              sku: "ZBDUO14-512",
              options: { Storage: "512 GB", Color: "Inkwell Gray" },
              manage_inventory: false,
              prices: [
                { amount: 1899, currency_code: "eur" },
                { amount: 1899, currency_code: "usd" },
              ],
            },
            {
              title: "1 TB / Inkwell Gray",
              sku: "ZBDUO14-1TB",
              options: { Storage: "1 TB", Color: "Inkwell Gray" },
              manage_inventory: false,
              prices: [
                { amount: 2199, currency_code: "eur" },
                { amount: 2199, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 40. Marshall Emberton III Speaker
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title:
            "Marshall Emberton III | Iconic Design | 360° Sound | 32hr Battery",
          category_ids: [getCatId("Speakers")],
          description:
            "The Marshall Emberton III brings iconic rock-and-roll design to a portable Bluetooth speaker. True Stereophonic technology creates 360-degree immersive sound that fills any room. The rugged build with IP67 dust and water resistance handles outdoor adventures. An incredible 32 hours of playtime means your music keeps playing through any event. Stacked charging allows quick 20-minute charge for 5 hours of playback.",
          weight: 750,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/speaker-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/speaker-top.png",
            },
          ],
          options: [{ title: "Color", values: ["Black and Brass", "Cream"] }],
          variants: [
            {
              title: "Emberton III Black and Brass",
              sku: "MARSHALL-EMIII-BLK",
              options: { Color: "Black and Brass" },
              manage_inventory: false,
              prices: [
                { amount: 169, currency_code: "eur" },
                { amount: 169, currency_code: "usd" },
              ],
            },
            {
              title: "Emberton III Cream",
              sku: "MARSHALL-EMIII-CRM",
              options: { Color: "Cream" },
              manage_inventory: false,
              prices: [
                { amount: 169, currency_code: "eur" },
                { amount: 169, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });
  // 51. Logitech G Pro X 2 Lightspeed Headset
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Logitech G Pro X 2 Lightspeed | Wireless Esports Headset",
          collection_id: collection.id,
          category_ids: [getCatId("Headphones")],
          description:
            "The Logitech G Pro X 2 Lightspeed is a wireless gaming headset designed with esports players in mind. It combines a lightweight frame with a firm but comfortable fit that stays secure during long practice sessions. The tuned drivers focus on clear footsteps and positional audio, while the detachable boom mic is built to keep team comms intelligible even in noisy rooms.",
          weight: 345,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/headphone-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/headphone-side.png",
            },
          ],
          options: [{ title: "Color", values: ["Black", "White"] }],
          variants: [
            {
              title: "G Pro X 2 Black",
              sku: "LOGI-GPROX2-BLK",
              options: { Color: "Black" },
              manage_inventory: false,
              prices: [
                { amount: 279, currency_code: "eur" },
                { amount: 279, currency_code: "usd" },
              ],
            },
            {
              title: "G Pro X 2 White",
              sku: "LOGI-GPROX2-WHT",
              options: { Color: "White" },
              manage_inventory: false,
              prices: [
                { amount: 279, currency_code: "eur" },
                { amount: 279, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 52. Razer Kraken V3 X
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Razer Kraken V3 X | Lightweight 7.1 Gaming Headset",
          collection_id: collection.id,
          category_ids: [getCatId("Headphones")],
          description:
            "The Razer Kraken V3 X is a wired gaming headset that emphasizes comfort and clear game audio at a mid-range price. Its light frame and soft ear cushions reduce pressure during marathon sessions, while virtual 7.1 surround sound helps highlight directional effects in shooters and action titles. The flexible cardioid microphone focuses on your voice and reduces background noise.",
          weight: 285,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/headphone-front.png",
            },
          ],
          options: [{ title: "Color", values: ["Black"] }],
          variants: [
            {
              title: "Kraken V3 X Black",
              sku: "RAZER-KRAKENV3X-BLK",
              options: { Color: "Black" },
              manage_inventory: false,
              prices: [
                { amount: 79, currency_code: "eur" },
                { amount: 79, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 53. Logitech G435 Lightspeed
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Logitech G435 Lightspeed | Ultra-Light Wireless Headset",
          collection_id: collection.id,
          category_ids: [getCatId("Headphones")],
          description:
            "The Logitech G435 Lightspeed is a very light wireless headset aimed at younger players and anyone who prefers a minimal feel. It supports both Lightspeed dongle and Bluetooth connections, so it can swap between PC, console, and mobile. The drivers deliver a bright, energetic sound that works well for casual gaming and streaming, and the dual beamforming microphones remove the need for a protruding boom arm.",
          weight: 165,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/headphone-front.png",
            },
          ],
          options: [
            { title: "Color", values: ["Black/Neon Yellow", "Blue/Raspberry"] },
          ],
          variants: [
            {
              title: "G435 Black / Neon Yellow",
              sku: "G435-BLK-YEL",
              options: { Color: "Black/Neon Yellow" },
              manage_inventory: false,
              prices: [
                { amount: 69, currency_code: "eur" },
                { amount: 69, currency_code: "usd" },
              ],
            },
            {
              title: "G435 Blue / Raspberry",
              sku: "G435-BLU-RASP",
              options: { Color: "Blue/Raspberry" },
              manage_inventory: false,
              prices: [
                { amount: 69, currency_code: "eur" },
                { amount: 69, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 54. EPOS H6PRO Open
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "EPOS H6PRO Open | Open Acoustic Gaming Headset",
          collection_id: collection.id,
          category_ids: [getCatId("Headphones")],
          description:
            "The EPOS H6PRO Open is a wired gaming headset with an open-back design for players who want more natural sound and awareness of their surroundings. Its tuning aims for clarity in voices and game effects, while the detachable boom microphone captures speech cleanly for squad chat. The open cups reduce heat buildup during long play sessions at home.",
          weight: 309,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/headphone-front.png",
            },
          ],
          options: [
            { title: "Color", values: ["Racing Green", "Ghost White"] },
          ],
          variants: [
            {
              title: "H6PRO Open Racing Green",
              sku: "EPOS-H6PRO-OPEN-GRN",
              options: { Color: "Racing Green" },
              manage_inventory: false,
              prices: [
                { amount: 179, currency_code: "eur" },
                { amount: 179, currency_code: "usd" },
              ],
            },
            {
              title: "H6PRO Open Ghost White",
              sku: "EPOS-H6PRO-OPEN-WHT",
              options: { Color: "Ghost White" },
              manage_inventory: false,
              prices: [
                { amount: 179, currency_code: "eur" },
                { amount: 179, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 55. SteelSeries Rival 5 Gaming Mouse
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "SteelSeries Rival 5 | FPS & MOBA Gaming Mouse",
          collection_id: collection.id,
          category_ids: [getCatId("Mice")],
          description:
            "The SteelSeries Rival 5 is a wired gaming mouse with multiple side buttons configured for FPS, battle royale, and MOBA titles. Its sensor tracks quickly and accurately across a wide DPI range, while the shape supports palm and claw grips. Customizable RGB zones let players match it to the rest of their setup using software.",
          weight: 85,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/mouse-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/mouse-top.png",
            },
          ],
          options: [{ title: "Color", values: ["Black"] }],
          variants: [
            {
              title: "Rival 5 Black",
              sku: "RIVAL5-BLK",
              options: { Color: "Black" },
              manage_inventory: false,
              prices: [
                { amount: 69, currency_code: "eur" },
                { amount: 69, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 56. Logitech G305 Lightspeed
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Logitech G305 Lightspeed | Wireless Budget Gaming Mouse",
          collection_id: collection.id,
          category_ids: [getCatId("Mice")],
          description:
            "The Logitech G305 Lightspeed is a compact wireless gaming mouse that brings low-latency performance to a lower price range. It uses a single AA battery but still achieves long runtime, making it simple to maintain. The HERO sensor tracks accurately for casual and competitive games, and the symmetrical shell works for both fingertip and claw grips.",
          weight: 99,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/mouse-top.png",
            },
          ],
          options: [{ title: "Color", values: ["Black", "White", "Lilac"] }],
          variants: [
            {
              title: "G305 Black",
              sku: "G305-BLK",
              options: { Color: "Black" },
              manage_inventory: false,
              prices: [
                { amount: 49, currency_code: "eur" },
                { amount: 49, currency_code: "usd" },
              ],
            },
            {
              title: "G305 White",
              sku: "G305-WHT",
              options: { Color: "White" },
              manage_inventory: false,
              prices: [
                { amount: 49, currency_code: "eur" },
                { amount: 49, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 57. Glorious Model O Wireless
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Glorious Model O Wireless | Honeycomb Ultra-Light Mouse",
          collection_id: collection.id,
          category_ids: [getCatId("Mice")],
          description:
            "The Glorious Model O Wireless is an ultra-light gaming mouse with a honeycomb shell that reduces weight while maintaining rigidity. Its low-latency wireless connection and high-end sensor aim squarely at competitive players. The PTFE feet are tuned for smooth glide on cloth and hard pads, and RGB lighting accents the otherwise simple design.",
          weight: 69,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/mouse-front.png",
            },
          ],
          options: [{ title: "Color", values: ["Matte Black", "Matte White"] }],
          variants: [
            {
              title: "Model O Wireless Matte Black",
              sku: "MODEL-O-WL-BLK",
              options: { Color: "Matte Black" },
              manage_inventory: false,
              prices: [
                { amount: 99, currency_code: "eur" },
                { amount: 99, currency_code: "usd" },
              ],
            },
            {
              title: "Model O Wireless Matte White",
              sku: "MODEL-O-WL-WHT",
              options: { Color: "Matte White" },
              manage_inventory: false,
              prices: [
                { amount: 99, currency_code: "eur" },
                { amount: 99, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 58. Logitech Lift Vertical Ergonomic Mouse
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Logitech Lift | Vertical Ergonomic Mouse | Wireless",
          collection_id: collection.id,
          category_ids: [getCatId("Mice")],
          description:
            "The Logitech Lift is a compact vertical ergonomic mouse designed to reduce wrist twisting by placing the hand in a more natural handshake position. It connects via Bluetooth or Logi Bolt receiver and supports Easy-Switch for three devices, which is useful for multi-computer desk setups. The quiet buttons and smooth scroll wheel make it suitable for shared workspaces.",
          weight: 125,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/mouse-front.png",
            },
          ],
          options: [{ title: "Color", values: ["Graphite", "Rose"] }],
          variants: [
            {
              title: "Lift Graphite",
              sku: "LIFT-GRAPHITE",
              options: { Color: "Graphite" },
              manage_inventory: false,
              prices: [
                { amount: 79, currency_code: "eur" },
                { amount: 79, currency_code: "usd" },
              ],
            },
            {
              title: "Lift Rose",
              sku: "LIFT-ROSE",
              options: { Color: "Rose" },
              manage_inventory: false,
              prices: [
                { amount: 79, currency_code: "eur" },
                { amount: 79, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 59. Ducky One 3 TKL
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Ducky One 3 TKL | Mechanical Keyboard | Hot-Swap",
          collection_id: collection.id,
          category_ids: [getCatId("Keyboards")],
          description:
            "The Ducky One 3 TKL is a tenkeyless mechanical keyboard built for enthusiasts who like a solid typing feel and customization. Its hot-swappable PCB allows users to change switches without soldering, and the thick keycaps contribute to a deeper sound profile. The compact layout saves desk space while preserving dedicated arrow keys and navigation.",
          weight: 908,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/keyboard-front.png",
            },
          ],
          options: [
            { title: "Switch Type", values: ["Red Linear", "Brown Tactile"] },
            { title: "Color", values: ["Black"] },
          ],
          variants: [
            {
              title: "One 3 TKL Red / Black",
              sku: "DUCKY-ONE3TKL-RED-BLK",
              options: { "Switch Type": "Red Linear", Color: "Black" },
              manage_inventory: false,
              prices: [
                { amount: 139, currency_code: "eur" },
                { amount: 139, currency_code: "usd" },
              ],
            },
            {
              title: "One 3 TKL Brown / Black",
              sku: "DUCKY-ONE3TKL-BRN-BLK",
              options: { "Switch Type": "Brown Tactile", Color: "Black" },
              manage_inventory: false,
              prices: [
                { amount: 139, currency_code: "eur" },
                { amount: 139, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 60. Logitech G915 TKL Lightspeed
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Logitech G915 TKL | Wireless Low-Profile Gaming Keyboard",
          collection_id: collection.id,
          category_ids: [getCatId("Keyboards")],
          description:
            "The Logitech G915 TKL is a wireless low-profile mechanical keyboard that targets players who want a clean desk without cables. Its slim switches provide a laptop-like travel with a more defined actuation point, and the TKL form factor frees up space for mouse movement. Lightspeed wireless keeps latency low while Bluetooth offers easier pairing with secondary devices.",
          weight: 810,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/keyboard-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/keyboard-side.png",
            },
          ],
          options: [
            { title: "Switch Type", values: ["Linear", "Clicky"] },
            { title: "Color", values: ["Black"] },
          ],
          variants: [
            {
              title: "G915 TKL Linear / Black",
              sku: "G915-TKL-LIN-BLK",
              options: { "Switch Type": "Linear", Color: "Black" },
              manage_inventory: false,
              prices: [
                { amount: 229, currency_code: "eur" },
                { amount: 229, currency_code: "usd" },
              ],
            },
            {
              title: "G915 TKL Clicky / Black",
              sku: "G915-TKL-CLK-BLK",
              options: { "Switch Type": "Clicky", Color: "Black" },
              manage_inventory: false,
              prices: [
                { amount: 229, currency_code: "eur" },
                { amount: 229, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 61. Razer Huntsman Mini 60%
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Razer Huntsman Mini | 60% Optical Gaming Keyboard",
          collection_id: collection.id,
          category_ids: [getCatId("Keyboards")],
          description:
            "The Razer Huntsman Mini is a 60% mechanical keyboard that removes the function row and navigation cluster to maximize mouse space. It uses optical switches that rely on light for actuation, giving a fast and consistent key feel. Onboard memory allows storing custom lighting profiles and keymaps, so it works the same way on different PCs once configured.",
          weight: 522,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/keyboard-front.png",
            },
          ],
          options: [
            {
              title: "Switch Type",
              values: ["Clicky Optical", "Linear Optical"],
            },
            { title: "Color", values: ["Black", "Mercury White"] },
          ],
          variants: [
            {
              title: "Huntsman Mini Clicky / Black",
              sku: "HUNTSMAN-MINI-CLK-BLK",
              options: { "Switch Type": "Clicky Optical", Color: "Black" },
              manage_inventory: false,
              prices: [
                { amount: 129, currency_code: "eur" },
                { amount: 129, currency_code: "usd" },
              ],
            },
            {
              title: "Huntsman Mini Linear / Mercury White",
              sku: "HUNTSMAN-MINI-LIN-WHT",
              options: {
                "Switch Type": "Linear Optical",
                Color: "Mercury White",
              },
              manage_inventory: false,
              prices: [
                { amount: 129, currency_code: "eur" },
                { amount: 129, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 62. Logitech K780 Multi-Device Keyboard
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Logitech K780 | Multi-Device Wireless Keyboard with Cradle",
          collection_id: collection.id,
          category_ids: [getCatId("Keyboards")],
          description:
            "The Logitech K780 is a full-size wireless keyboard built for people who work across phones, tablets, and computers. A built-in rubber cradle holds mobile devices upright, while three Easy-Switch keys let you jump between paired systems. The rounded keycaps have a soft feel suited for long typing blocks, and the battery life stretches into years under typical use.",
          weight: 875,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/keyboard-front.png",
            },
          ],
          options: [{ title: "Color", values: ["Black"] }],
          variants: [
            {
              title: "K780 Black",
              sku: "K780-MULTI-BLK",
              options: { Color: "Black" },
              manage_inventory: false,
              prices: [
                { amount: 99, currency_code: "eur" },
                { amount: 99, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 63. Razer Seiren Mini USB Microphone (for camera/audio setups)
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Razer Seiren Mini | Compact USB Streaming Microphone",
          collection_id: collection.id,
          category_ids: [getCatId("Speakers")],
          description:
            "The Razer Seiren Mini is a compact USB condenser microphone designed to upgrade voice quality for calls and streams without taking over your desk. Its tight pickup pattern focuses on your voice while reducing keyboard and mouse noise. The simple stand can be angled to match your seating position, and the plug-and-play design works with common streaming and conferencing apps.",
          weight: 383,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/speaker-front.png",
            },
          ],
          options: [{ title: "Color", values: ["Black", "Quartz Pink"] }],
          variants: [
            {
              title: "Seiren Mini Black",
              sku: "SEIREN-MINI-BLK",
              options: { Color: "Black" },
              manage_inventory: false,
              prices: [
                { amount: 59, currency_code: "eur" },
                { amount: 59, currency_code: "usd" },
              ],
            },
            {
              title: "Seiren Mini Quartz Pink",
              sku: "SEIREN-MINI-PNK",
              options: { Color: "Quartz Pink" },
              manage_inventory: false,
              prices: [
                { amount: 59, currency_code: "eur" },
                { amount: 59, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 64. Creative Pebble V3 Desktop Speakers
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Creative Pebble V3 | Compact USB-C Desktop Speakers",
          collection_id: collection.id,
          category_ids: [getCatId("Speakers")],
          description:
            "Creative Pebble V3 speakers are small desktop speakers that use USB-C for both power and audio, simplifying cable management. They are angled slightly upward to direct sound toward the listener’s ears and provide a noticeable upgrade over typical laptop speakers. Bluetooth support allows quick pairing with a phone when the PC is off.",
          weight: 900,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/speaker-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/speaker-top.png",
            },
          ],
          options: [{ title: "Color", values: ["Black", "White"] }],
          variants: [
            {
              title: "Pebble V3 Black",
              sku: "PEBBLE-V3-BLK",
              options: { Color: "Black" },
              manage_inventory: false,
              prices: [
                { amount: 49, currency_code: "eur" },
                { amount: 49, currency_code: "usd" },
              ],
            },
            {
              title: "Pebble V3 White",
              sku: "PEBBLE-V3-WHT",
              options: { Color: "White" },
              manage_inventory: false,
              prices: [
                { amount: 49, currency_code: "eur" },
                { amount: 49, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 65. Sonos Roam Portable Speaker
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Sonos Roam | Portable Smart Speaker | Wi-Fi & Bluetooth",
          collection_id: collection.id,
          category_ids: [getCatId("Speakers")],
          description:
            "The Sonos Roam is a compact portable speaker that joins an existing Sonos multi-room system over Wi-Fi but can also work as a standalone Bluetooth speaker outdoors. Automatic Trueplay tuning adjusts sound based on the environment, and the rugged, water-resistant housing makes it suitable for use around the house and on trips.",
          weight: 430,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/speaker-front.png",
            },
          ],
          options: [
            { title: "Color", values: ["Shadow Black", "Lunar White"] },
          ],
          variants: [
            {
              title: "Roam Shadow Black",
              sku: "SONOS-ROAM-BLK",
              options: { Color: "Shadow Black" },
              manage_inventory: false,
              prices: [
                { amount: 199, currency_code: "eur" },
                { amount: 199, currency_code: "usd" },
              ],
            },
            {
              title: "Roam Lunar White",
              sku: "SONOS-ROAM-WHT",
              options: { Color: "Lunar White" },
              manage_inventory: false,
              prices: [
                { amount: 199, currency_code: "eur" },
                { amount: 199, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 66. Logitech Z407 Bluetooth Speakers with Subwoofer
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Logitech Z407 | 2.1 Bluetooth Speakers with Wireless Dial",
          collection_id: collection.id,
          category_ids: [getCatId("Speakers")],
          description:
            "The Logitech Z407 is a compact 2.1 speaker system with a small subwoofer for added low-end presence at the desk. It supports Bluetooth, USB, and 3.5mm connections, so it can serve as audio output for PCs and mobile devices. A wireless control dial lets you adjust volume and playback from across the desk without touching the computer.",
          weight: 3900,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/speaker-front.png",
            },
          ],
          options: [{ title: "Color", values: ["Dark Gray"] }],
          variants: [
            {
              title: "Z407 Dark Gray",
              sku: "Z407-DK-GRY",
              options: { Color: "Dark Gray" },
              manage_inventory: false,
              prices: [
                { amount: 119, currency_code: "eur" },
                { amount: 119, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 67. Anker PowerConf S3 Speakerphone
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Anker PowerConf S3 | Portable Bluetooth Speakerphone",
          collection_id: collection.id,
          category_ids: [getCatId("Speakers")],
          description:
            "The Anker PowerConf S3 is a compact Bluetooth speakerphone aimed at remote workers who frequently join conference calls. Six microphones arranged around the unit help pick up voices from different positions, while built-in processing reduces echo and background noise. It connects quickly to laptops and phones and runs for many hours on a single charge.",
          weight: 340,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/speaker-top.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/speaker-front.png",
            },
          ],
          options: [{ title: "Color", values: ["Black"] }],
          variants: [
            {
              title: "PowerConf S3 Black",
              sku: "ANKER-PCONF-S3-BLK",
              options: { Color: "Black" },
              manage_inventory: false,
              prices: [
                { amount: 129, currency_code: "eur" },
                { amount: 129, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 68. Razer Kiyo Pro Streaming Webcam
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Razer Kiyo Pro | USB Streaming Webcam with Wide Sensor",
          collection_id: collection.id,
          category_ids: [getCatId("Webcams")],
          description:
            "The Razer Kiyo Pro is a USB webcam aimed at streamers and professionals who want flexible framing and better low-light handling. Its wide-angle sensor can switch between several fields of view, and HDR mode is available for situations with mixed lighting. The camera works with standard conferencing apps and can be fine-tuned using Razer’s software.",
          weight: 200,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/camera-front.png",
            },
          ],
          options: [{ title: "Color", values: ["Black"] }],
          variants: [
            {
              title: "Kiyo Pro Black",
              sku: "RAZER-KIYO-PRO-BLK",
              options: { Color: "Black" },
              manage_inventory: false,
              prices: [
                { amount: 199, currency_code: "eur" },
                { amount: 199, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 69. Anker PowerConf C200 2K Webcam
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Anker PowerConf C200 | 2K Webcam with Adjustable FoV",
          collection_id: collection.id,
          category_ids: [getCatId("Webcams")],
          description:
            "The Anker PowerConf C200 is a compact 2K webcam that offers an adjustable field of view and dual microphones. It is designed to improve clarity over built-in laptop cameras without requiring complex setup. A physical privacy shutter covers the lens when the call is over, and the bundled software lets users tweak framing and picture settings.",
          weight: 120,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/camera-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/camera-side.png",
            },
          ],
          options: [{ title: "Color", values: ["Black"] }],
          variants: [
            {
              title: "PowerConf C200 Black",
              sku: "ANKER-C200-BLK",
              options: { Color: "Black" },
              manage_inventory: false,
              prices: [
                { amount: 79, currency_code: "eur" },
                { amount: 79, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 70. NexiGo N930AF 1080p Webcam
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "NexiGo N930AF | 1080p Autofocus USB Webcam",
          collection_id: collection.id,
          category_ids: [getCatId("Webcams")],
          description:
            "The NexiGo N930AF is a budget-friendly 1080p USB webcam with autofocus, aimed at users who want a clearer picture than typical integrated laptop cameras. It clips onto most monitors and folds for storage when not in use. A slide cover helps protect the lens and offers privacy between meetings.",
          weight: 150,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/camera-front.png",
            },
          ],
          options: [{ title: "Color", values: ["Black"] }],
          variants: [
            {
              title: "N930AF Black",
              sku: "NEXIGO-N930AF-BLK",
              options: { Color: "Black" },
              manage_inventory: false,
              prices: [
                { amount: 39, currency_code: "eur" },
                { amount: 39, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: 'Dell XPS 15 9530 | 15.6" OLED | Creator Laptop',
          collection_id: collection.id,
          category_ids: [getCatId("Laptops")],
          description:
            "The Dell XPS 15 9530 is a 15.6-inch Windows laptop aimed at creators who want a larger canvas without carrying a full desktop replacement. Its OLED display option provides deep blacks and vivid color that help photo and video work stand out. Intel Core processors and dedicated graphics give enough performance for editing timelines and rendering exports, while the slim aluminum chassis makes it more portable than many traditional workstations.",
          weight: 1850,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/laptop-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/laptop-side.png",
            },
          ],
          options: [
            { title: "Storage", values: ["512 GB", "1 TB"] },
            { title: "Color", values: ["Platinum Silver"] },
          ],
          variants: [
            {
              title: "512 GB / Platinum Silver",
              sku: "XPS15-9530-512-SILVER",
              options: { Storage: "512 GB", Color: "Platinum Silver" },
              manage_inventory: false,
              prices: [
                { amount: 1899, currency_code: "eur" },
                { amount: 1899, currency_code: "usd" },
              ],
            },
            {
              title: "1 TB / Platinum Silver",
              sku: "XPS15-9530-1TB-SILVER",
              options: { Storage: "1 TB", Color: "Platinum Silver" },
              manage_inventory: false,
              prices: [
                { amount: 2149, currency_code: "eur" },
                { amount: 2149, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 22. Lenovo IdeaPad Slim 5 14"
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: 'Lenovo IdeaPad Slim 5 14" | Everyday Ultrabook',
          collection_id: collection.id,
          category_ids: [getCatId("Laptops")],
          description:
            "The Lenovo IdeaPad Slim 5 14-inch is a balanced everyday laptop that focuses on comfort and value. It combines modern AMD or Intel processors with a crisp 14-inch display that is easy on the eyes for long study or office sessions. The slim chassis is light enough for commuting, and the quiet cooling system keeps noise low in classrooms or meeting rooms. It suits users who want a sensible, reliable notebook without paying a premium for flagship features.",
          weight: 1450,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/laptop-front.png",
            },
          ],
          options: [
            { title: "Storage", values: ["512 GB"] },
            { title: "Color", values: ["Abyss Blue"] },
          ],
          variants: [
            {
              title: "512 GB / Abyss Blue",
              sku: "IDEAPAD-SLIM5-14-512-ABYSS",
              options: { Storage: "512 GB", Color: "Abyss Blue" },
              manage_inventory: false,
              prices: [
                { amount: 899, currency_code: "eur" },
                { amount: 899, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 23. ASUS Zenbook 14 OLED
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "ASUS Zenbook 14 OLED | Lightweight | All-Day Battery",
          collection_id: collection.id,
          category_ids: [getCatId("Laptops")],
          description:
            "The ASUS Zenbook 14 OLED pairs a sharp 14-inch OLED display with a lightweight metal chassis, making it a strong option for people who travel frequently with a laptop. The display’s deep blacks and rich color help both movies and presentations look more engaging. Modern processors and fast SSD storage provide responsive performance, while the large battery and efficient components stretch runtime through a full workday.",
          weight: 1300,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/laptop-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/laptop-top.png",
            },
          ],
          options: [
            { title: "Storage", values: ["512 GB", "1 TB"] },
            { title: "Color", values: ["Ponder Blue"] },
          ],
          variants: [
            {
              title: "512 GB / Ponder Blue",
              sku: "ZENBOOK14-OLED-512-BLUE",
              options: { Storage: "512 GB", Color: "Ponder Blue" },
              manage_inventory: false,
              prices: [
                { amount: 1199, currency_code: "eur" },
                { amount: 1199, currency_code: "usd" },
              ],
            },
            {
              title: "1 TB / Ponder Blue",
              sku: "ZENBOOK14-OLED-1TB-BLUE",
              options: { Storage: "1 TB", Color: "Ponder Blue" },
              manage_inventory: false,
              prices: [
                { amount: 1349, currency_code: "eur" },
                { amount: 1349, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 24. Acer Swift 3 14"
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: 'Acer Swift 3 14" | Thin & Light | Wi-Fi 6',
          collection_id: collection.id,
          category_ids: [getCatId("Laptops")],
          description:
            "The Acer Swift 3 14-inch is a thin-and-light notebook intended for students and office workers who want a simple, modern machine. It offers a matte Full HD display, a comfortable keyboard, and a trackpad that works well for everyday gestures. Wi-Fi 6 support and USB-C charging keep it up to date with current connectivity standards, while the metal lid adds a bit of rigidity compared to plastic-only designs.",
          weight: 1350,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/laptop-front.png",
            },
          ],
          options: [
            { title: "Storage", values: ["512 GB"] },
            { title: "Color", values: ["Steel Gray"] },
          ],
          variants: [
            {
              title: "512 GB / Steel Gray",
              sku: "SWIFT3-14-512-GREY",
              options: { Storage: "512 GB", Color: "Steel Gray" },
              manage_inventory: false,
              prices: [
                { amount: 899, currency_code: "eur" },
                { amount: 899, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 25. Razer Blade 15 (2023)
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Razer Blade 15 (2023) | RTX Graphics | 240Hz QHD",
          collection_id: collection.id,
          category_ids: [getCatId("Laptops")],
          description:
            "The Razer Blade 15 is a premium gaming laptop that blends strong performance with a minimalist design. A high-refresh QHD display keeps fast shooters and competitive games feeling smooth, while NVIDIA RTX graphics accelerate both games and GPU-heavy creative apps. The CNC-milled aluminum chassis feels solid in the hand, and per-key RGB lighting lets players tune the keyboard to match their setup.",
          weight: 2000,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/laptop-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/laptop-side.png",
            },
          ],
          options: [
            { title: "Storage", values: ["1 TB"] },
            { title: "Color", values: ["Black"] },
          ],
          variants: [
            {
              title: "1 TB / Black",
              sku: "RAZER-BLADE15-1TB-BLK",
              options: { Storage: "1 TB", Color: "Black" },
              manage_inventory: false,
              prices: [
                { amount: 2699, currency_code: "eur" },
                { amount: 2699, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 26. Apple iPhone 15
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Apple iPhone 15 | Dynamic Island | USB-C",
          collection_id: collection.id,
          category_ids: [getCatId("Smartphones")],
          description:
            "The iPhone 15 brings the Dynamic Island interface and USB-C charging to Apple’s standard flagship line. Its bright OLED screen, improved main camera, and efficient chipset are designed for people who want a smooth everyday experience without the price of the Pro models. The updated design is light in the hand and available in several soft color finishes that appeal to a wide range of users.",
          weight: 171,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/phone-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/phone-side.png",
            },
          ],
          options: [
            { title: "Memory", values: ["128 GB", "256 GB"] },
            { title: "Color", values: ["Black", "Pink"] },
          ],
          variants: [
            {
              title: "128 GB / Black",
              sku: "IP15-128-BLK",
              options: { Memory: "128 GB", Color: "Black" },
              manage_inventory: false,
              prices: [
                { amount: 949, currency_code: "eur" },
                { amount: 949, currency_code: "usd" },
              ],
            },
            {
              title: "256 GB / Pink",
              sku: "IP15-256-PNK",
              options: { Memory: "256 GB", Color: "Pink" },
              manage_inventory: false,
              prices: [
                { amount: 1049, currency_code: "eur" },
                { amount: 1049, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 27. Apple iPhone 15 Plus
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Apple iPhone 15 Plus | Large Display | Long Battery Life",
          collection_id: collection.id,
          category_ids: [getCatId("Smartphones")],
          description:
            "The iPhone 15 Plus offers a larger display and extended battery life compared to the standard model, aimed at users who enjoy watching video and browsing on a big screen. It shares the same camera system and core performance as the smaller iPhone 15, but the bigger battery gives it more endurance over a full day. The interface and app support remain the same, so it fits smoothly into the Apple ecosystem.",
          weight: 201,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/phone-front.png",
            },
          ],
          options: [
            { title: "Memory", values: ["128 GB", "256 GB"] },
            { title: "Color", values: ["Blue", "Yellow"] },
          ],
          variants: [
            {
              title: "128 GB / Blue",
              sku: "IP15PLUS-128-BLU",
              options: { Memory: "128 GB", Color: "Blue" },
              manage_inventory: false,
              prices: [
                { amount: 1049, currency_code: "eur" },
                { amount: 1049, currency_code: "usd" },
              ],
            },
            {
              title: "256 GB / Yellow",
              sku: "IP15PLUS-256-YEL",
              options: { Memory: "256 GB", Color: "Yellow" },
              manage_inventory: false,
              prices: [
                { amount: 1149, currency_code: "eur" },
                { amount: 1149, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 28. Samsung Galaxy S23 FE
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Samsung Galaxy S23 FE | Fan Edition | Balanced Performance",
          collection_id: collection.id,
          category_ids: [getCatId("Smartphones")],
          description:
            'The Galaxy S23 FE is a "Fan Edition" device that inherits many strengths of Samsung’s flagship line while targeting a lower price point. It includes a bright AMOLED display, solid cameras, and a capable processor that can handle gaming and multitasking without major slowdowns. The design follows the S23 family look, making it suitable for users who want a premium feel without paying for the top-tier Ultra model.',
          weight: 209,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/phone-front.png",
            },
          ],
          options: [
            { title: "Memory", values: ["128 GB"] },
            { title: "Color", values: ["Mint"] },
          ],
          variants: [
            {
              title: "128 GB / Mint",
              sku: "S23FE-128-MINT",
              options: { Memory: "128 GB", Color: "Mint" },
              manage_inventory: false,
              prices: [
                { amount: 699, currency_code: "eur" },
                { amount: 699, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 29. Google Pixel 8
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Google Pixel 8 | Compact Flagship | AI Features",
          collection_id: collection.id,
          category_ids: [getCatId("Smartphones")],
          description:
            "The Google Pixel 8 is a compact Android flagship that focuses on smart software and strong core features rather than chasing the largest screen. Its camera system leans on Google’s computational photography to deliver pleasing images that are ready to share. The Tensor chip powers AI tools such as call screening and voice editing, while the small size makes it easy to use one-handed.",
          weight: 187,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/phone-front.png",
            },
          ],
          options: [{ title: "Memory", values: ["128 GB", "256 GB"] }],
          variants: [
            {
              title: "128 GB",
              sku: "PIXEL8-128",
              options: { Memory: "128 GB" },
              manage_inventory: false,
              prices: [
                { amount: 799, currency_code: "eur" },
                { amount: 799, currency_code: "usd" },
              ],
            },
            {
              title: "256 GB",
              sku: "PIXEL8-256",
              options: { Memory: "256 GB" },
              manage_inventory: false,
              prices: [
                { amount: 899, currency_code: "eur" },
                { amount: 899, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 30. OnePlus Nord 3 5G
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "OnePlus Nord 3 5G | Smooth Display | Fast Charging",
          collection_id: collection.id,
          category_ids: [getCatId("Smartphones")],
          description:
            "The OnePlus Nord 3 5G is a midrange phone that focuses on fluid performance and a responsive display. Its high-refresh panel keeps scrolling and animations feeling fast, and the Dimensity chipset offers enough power for common games and social apps. Fast charging quickly tops up the battery during the day, which is convenient for users who are often away from a power outlet.",
          weight: 193,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/phone-front.png",
            },
          ],
          options: [
            { title: "Memory", values: ["256 GB"] },
            { title: "Color", values: ["Misty Green"] },
          ],
          variants: [
            {
              title: "256 GB / Misty Green",
              sku: "NORD3-256-GREEN",
              options: { Memory: "256 GB", Color: "Misty Green" },
              manage_inventory: false,
              prices: [
                { amount: 599, currency_code: "eur" },
                { amount: 599, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 31. Xiaomi Redmi Note 13 Pro
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Xiaomi Redmi Note 13 Pro | Value Phone | 200MP Camera",
          collection_id: collection.id,
          category_ids: [getCatId("Smartphones")],
          description:
            "The Xiaomi Redmi Note 13 Pro aims to bring eye-catching hardware to the midrange segment. Its high-resolution 200MP camera is designed to capture detailed images in good light, while the large display and stereo speakers make video and games more enjoyable. A sizable battery and efficient chipset help the phone last through a full day of mixed use.",
          weight: 190,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/phone-front.png",
            },
          ],
          options: [{ title: "Memory", values: ["256 GB"] }],
          variants: [
            {
              title: "256 GB",
              sku: "REDMI13PRO-256",
              options: { Memory: "256 GB" },
              manage_inventory: false,
              prices: [
                { amount: 449, currency_code: "eur" },
                { amount: 449, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 32. Samsung Smart Monitor M8 32"
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: 'Samsung Smart Monitor M8 32" | 4K | Built-in Apps',
          collection_id: collection.id,
          category_ids: [getCatId("Monitors")],
          description:
            "The Samsung Smart Monitor M8 is a 32-inch 4K screen that doubles as a small smart TV. It can run streaming apps directly over Wi-Fi without needing a PC attached, making it suitable for compact living spaces. When connected to a computer, it works as a standard 4K monitor for productivity and web use. A slim design and included remote make it easy to place almost anywhere.",
          weight: 6100,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/screen-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/screen-side.png",
            },
          ],
          options: [{ title: "Color", values: ["Warm White"] }],
          variants: [
            {
              title: "Warm White",
              sku: "M8-32-4K-WHITE",
              options: { Color: "Warm White" },
              manage_inventory: false,
              prices: [
                { amount: 699, currency_code: "eur" },
                { amount: 699, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 33. Gigabyte M27Q
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: 'Gigabyte M27Q | 27" QHD | 170Hz Gaming Monitor',
          collection_id: collection.id,
          category_ids: [getCatId("Monitors")],
          description:
            "The Gigabyte M27Q is a 27-inch QHD gaming monitor that targets players who want smooth motion without giving up resolution. Its high refresh rate and low response time help minimize blur in fast-paced titles, while the IPS panel retains good color and viewing angles. A built-in KVM switch allows one keyboard and mouse to control two devices through the monitor.",
          weight: 5800,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/screen-front.png",
            },
          ],
          options: [{ title: "Color", values: ["Black"] }],
          variants: [
            {
              title: "Standard / Black",
              sku: "GIGABYTE-M27Q-BLK",
              options: { Color: "Black" },
              manage_inventory: false,
              prices: [
                { amount: 399, currency_code: "eur" },
                { amount: 399, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 34. BenQ PD2705U
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: 'BenQ PD2705U | 27" 4K | Designer Monitor',
          collection_id: collection.id,
          category_ids: [getCatId("Monitors")],
          description:
            "The BenQ PD2705U is a 27-inch 4K monitor intended for designers and content creators who value color accuracy. Factory presets focus on sRGB and Rec.709 spaces, making it suitable for web and broadcast work. The stand supports portrait rotation and full ergonomic adjustment, while the integrated USB-C port can power and connect a compatible laptop with a single cable.",
          weight: 6200,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/screen-front.png",
            },
          ],
          options: [{ title: "Color", values: ["Black"] }],
          variants: [
            {
              title: "Standard / Black",
              sku: "BENQ-PD2705U-BLK",
              options: { Color: "Black" },
              manage_inventory: false,
              prices: [
                { amount: 549, currency_code: "eur" },
                { amount: 549, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 35. MSI Optix MAG274QRF
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: 'MSI Optix MAG274QRF | 27" QHD | 165Hz',
          collection_id: collection.id,
          category_ids: [getCatId("Monitors")],
          description:
            "The MSI Optix MAG274QRF is a 27-inch QHD monitor built for competitive gaming. Its 165 Hz refresh rate and quick response help keep up with high frame-rate gameplay. The stand offers height, tilt, and pivot adjustments, and the array of video inputs makes it easy to connect to both PC and console. RGB lighting on the back adds a bit of flair for themed setups.",
          weight: 5700,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/screen-front.png",
            },
          ],
          options: [{ title: "Color", values: ["Black"] }],
          variants: [
            {
              title: "Standard / Black",
              sku: "MSI-MAG274QRF-BLK",
              options: { Color: "Black" },
              manage_inventory: false,
              prices: [
                { amount: 429, currency_code: "eur" },
                { amount: 429, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 36. Philips 346E2CUAE 34"
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: 'Philips 346E2CUAE | 34" Ultrawide | USB-C Dock',
          collection_id: collection.id,
          category_ids: [getCatId("Monitors")],
          description:
            "The Philips 346E2CUAE is a 34-inch ultrawide monitor aimed at multitaskers who like to keep several windows open side by side. Its 3440×1440 resolution gives more horizontal space than standard 16:9 screens, while the USB-C dock can power a laptop and connect peripherals. The slight curve helps keep the edges of the screen within your field of view during long work sessions.",
          weight: 7800,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/screen-front.png",
            },
          ],
          options: [{ title: "Color", values: ["Black"] }],
          variants: [
            {
              title: "Standard / Black",
              sku: "PHILIPS-346E2-BLK",
              options: { Color: "Black" },
              manage_inventory: false,
              prices: [
                { amount: 499, currency_code: "eur" },
                { amount: 499, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 37. HP X27q
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: 'HP X27q | 27" QHD | 165Hz Gaming Monitor',
          collection_id: collection.id,
          category_ids: [getCatId("Monitors")],
          description:
            "The HP X27q is a straightforward 27-inch gaming monitor that offers QHD resolution and a 165 Hz refresh rate at a relatively accessible price. It targets players who are upgrading from 60 Hz panels and want smoother motion in fast titles. The design is simple and compact, making it easy to fit on smaller desks.",
          weight: 5400,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/screen-front.png",
            },
          ],
          options: [{ title: "Color", values: ["Black"] }],
          variants: [
            {
              title: "Standard / Black",
              sku: "HP-X27Q-BLK",
              options: { Color: "Black" },
              manage_inventory: false,
              prices: [
                { amount: 329, currency_code: "eur" },
                { amount: 329, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 38. Sony WH-1000XM5
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Sony WH-1000XM5 | Wireless ANC Headphones | Travel Friendly",
          collection_id: collection.id,
          category_ids: [getCatId("Headphones")],
          description:
            "The Sony WH-1000XM5 are over-ear wireless headphones known for strong active noise cancellation and a comfortable fit. They are designed for travelers and commuters who want to block out engine drone and background chatter. The sound profile is tuned for everyday listening, and the companion app allows fine adjustment of both sound and noise reduction to personal taste.",
          weight: 249,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/headphone-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/headphone-side.png",
            },
          ],
          options: [{ title: "Color", values: ["Black", "Silver"] }],
          variants: [
            {
              title: "WH-1000XM5 Black",
              sku: "SONY-XM5-BLK",
              options: { Color: "Black" },
              manage_inventory: false,
              prices: [
                { amount: 379, currency_code: "eur" },
                { amount: 379, currency_code: "usd" },
              ],
            },
            {
              title: "WH-1000XM5 Silver",
              sku: "SONY-XM5-SLV",
              options: { Color: "Silver" },
              manage_inventory: false,
              prices: [
                { amount: 379, currency_code: "eur" },
                { amount: 379, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 39. Bose QuietComfort Ultra Headphones
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Bose QuietComfort Ultra | Wireless ANC Headphones",
          collection_id: collection.id,
          category_ids: [getCatId("Headphones")],
          description:
            "Bose QuietComfort Ultra headphones focus on delivering strong noise cancellation with a relaxed, comfortable listening experience. They are tuned with a warm, easy-going sound that works well for long flights or office use. The ear cups and headband padding are soft, and the foldable design makes them straightforward to pack in a small bag.",
          weight: 250,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/headphone-front.png",
            },
          ],
          options: [{ title: "Color", values: ["Black", "White Smoke"] }],
          variants: [
            {
              title: "QuietComfort Ultra Black",
              sku: "BOSE-QCU-BLK",
              options: { Color: "Black" },
              manage_inventory: false,
              prices: [
                { amount: 399, currency_code: "eur" },
                { amount: 399, currency_code: "usd" },
              ],
            },
            {
              title: "QuietComfort Ultra White Smoke",
              sku: "BOSE-QCU-WHT",
              options: { Color: "White Smoke" },
              manage_inventory: false,
              prices: [
                { amount: 399, currency_code: "eur" },
                { amount: 399, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 40. Apple AirPods Pro (2nd generation)
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Apple AirPods Pro (2nd Gen) | ANC | Spatial Audio",
          collection_id: collection.id,
          category_ids: [getCatId("Headphones")],
          description:
            "AirPods Pro (2nd generation) are in-ear true wireless earphones with active noise cancellation and tight integration into the Apple ecosystem. They support personalized spatial audio for compatible content and can switch between Apple devices automatically. The compact case adds multiple extra charges, making them easy to carry in a pocket for regular use.",
          weight: 56,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/headphone-front.png",
            },
          ],
          options: [{ title: "Color", values: ["White"] }],
          variants: [
            {
              title: "AirPods Pro (2nd Gen)",
              sku: "AIRPODS-PRO-2-WHT",
              options: { Color: "White" },
              manage_inventory: false,
              prices: [
                { amount: 279, currency_code: "eur" },
                { amount: 279, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 41. HyperX Cloud III
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "HyperX Cloud III | Gaming Headset | Detachable Mic",
          collection_id: collection.id,
          category_ids: [getCatId("Headphones")],
          description:
            "The HyperX Cloud III is a wired gaming headset that builds on the comfort of earlier Cloud models. Its padded headband and memory foam ear cushions are designed for longer sessions at the PC or console. The detachable microphone makes it easy to switch between gaming and casual listening, while the tuned drivers focus on clear voice and punchy effects in competitive titles.",
          weight: 320,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/headphone-front.png",
            },
          ],
          options: [{ title: "Color", values: ["Black/Red"] }],
          variants: [
            {
              title: "Cloud III Black/Red",
              sku: "HYPERX-CLOUD3-BR",
              options: { Color: "Black/Red" },
              manage_inventory: false,
              prices: [
                { amount: 129, currency_code: "eur" },
                { amount: 129, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 42. Razer BlackShark V2 Pro Wireless (2023)
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Razer BlackShark V2 Pro (2023) | Wireless Esports Headset",
          collection_id: collection.id,
          category_ids: [getCatId("Headphones")],
          description:
            "The Razer BlackShark V2 Pro is a wireless gaming headset tuned for competitive play. Its closed-back cups and strong clamp help isolate crowd noise in tournament environments, while the lightweight frame keeps it manageable over long practice sessions. The detachable microphone and on-headset controls make it easy to adjust volume and mute quickly.",
          weight: 320,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/headphone-front.png",
            },
          ],
          options: [{ title: "Color", values: ["Black"] }],
          variants: [
            {
              title: "BlackShark V2 Pro Black",
              sku: "RAZER-BSV2PRO-BLK",
              options: { Color: "Black" },
              manage_inventory: false,
              prices: [
                { amount: 229, currency_code: "eur" },
                { amount: 229, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 43. Sennheiser HD 560S
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Sennheiser HD 560S | Open-Back Hi-Fi Headphones",
          collection_id: collection.id,
          category_ids: [getCatId("Headphones")],
          description:
            "The Sennheiser HD 560S are open-back headphones aimed at listeners who value a neutral, detailed sound for long sessions at home. Their design allows air to move freely through the ear cups, creating a wide, natural soundstage that many closed-back models cannot match. They pair well with hi-fi amplifiers and interfaces for serious music listening or mixing practice.",
          weight: 240,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/headphone-front.png",
            },
          ],
          options: [{ title: "Color", values: ["Black"] }],
          variants: [
            {
              title: "HD 560S Black",
              sku: "SENN-HD560S-BLK",
              options: { Color: "Black" },
              manage_inventory: false,
              prices: [
                { amount: 229, currency_code: "eur" },
                { amount: 229, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 44. Corsair K70 RGB Pro Keyboard
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Corsair K70 RGB Pro | Mechanical Gaming Keyboard | Full Size",
          collection_id: collection.id,
          category_ids: [getCatId("Keyboards")],
          description:
            "The Corsair K70 RGB Pro is a full-size mechanical keyboard with a metal top plate and per-key RGB lighting. It is designed for gamers who like a solid, desk-filling board with dedicated media controls. The onboard memory allows saving lighting and macro profiles directly to the keyboard, so they travel with you between different machines.",
          weight: 1150,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/keyboard-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/keyboard-side.png",
            },
          ],
          options: [
            { title: "Switch Type", values: ["Red Linear", "Brown Tactile"] },
            { title: "Color", values: ["Black"] },
          ],
          variants: [
            {
              title: "Red Linear / Black",
              sku: "K70PRO-RED-BLK",
              options: { "Switch Type": "Red Linear", Color: "Black" },
              manage_inventory: false,
              prices: [
                { amount: 189, currency_code: "eur" },
                { amount: 189, currency_code: "usd" },
              ],
            },
            {
              title: "Brown Tactile / Black",
              sku: "K70PRO-BROWN-BLK",
              options: { "Switch Type": "Brown Tactile", Color: "Black" },
              manage_inventory: false,
              prices: [
                { amount: 189, currency_code: "eur" },
                { amount: 189, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 45. Keychron K2 V2 Wireless Keyboard
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Keychron K2 V2 | 75% Wireless Mechanical Keyboard",
          collection_id: collection.id,
          category_ids: [getCatId("Keyboards")],
          description:
            "The Keychron K2 V2 is a compact 75% mechanical keyboard that keeps the important keys while saving desk space. It supports both Bluetooth and wired connections and includes switchable keycaps for Windows and macOS layouts. Hot-swappable variants allow users to experiment with different switch types over time without soldering.",
          weight: 820,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/keyboard-front.png",
            },
          ],
          options: [
            { title: "Switch Type", values: ["Red Linear", "Brown Tactile"] },
            { title: "Color", values: ["Dark Grey"] },
          ],
          variants: [
            {
              title: "Red Linear / Dark Grey",
              sku: "K2V2-RED-DGREY",
              options: { "Switch Type": "Red Linear", Color: "Dark Grey" },
              manage_inventory: false,
              prices: [
                { amount: 99, currency_code: "eur" },
                { amount: 99, currency_code: "usd" },
              ],
            },
            {
              title: "Brown Tactile / Dark Grey",
              sku: "K2V2-BROWN-DGREY",
              options: { "Switch Type": "Brown Tactile", Color: "Dark Grey" },
              manage_inventory: false,
              prices: [
                { amount: 109, currency_code: "eur" },
                { amount: 109, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 46. Razer DeathAdder V3 Pro
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Razer DeathAdder V3 Pro | Ultra-Light Wireless Gaming Mouse",
          collection_id: collection.id,
          category_ids: [getCatId("Mice")],
          description:
            "The Razer DeathAdder V3 Pro is an ultra-light wireless gaming mouse designed for competitive play. Its refined ergonomic shape supports a range of grip styles, while the high-end optical sensor delivers precise tracking. The low weight helps reduce fatigue in fast-paced games where quick flicks and repeated movements are common.",
          weight: 63,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/mouse-top.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/mouse-front.png",
            },
          ],
          options: [{ title: "Color", values: ["Black", "White"] }],
          variants: [
            {
              title: "DeathAdder V3 Pro Black",
              sku: "DA-V3PRO-BLKO",
              options: { Color: "Black" },
              manage_inventory: false,
              prices: [
                { amount: 169, currency_code: "eur" },
                { amount: 169, currency_code: "usd" },
              ],
            },
            {
              title: "DeathAdder V3 Pro White",
              sku: "DA-V3PRO-WHTO",
              options: { Color: "White" },
              manage_inventory: false,
              prices: [
                { amount: 169, currency_code: "eur" },
                { amount: 169, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 47. Logitech G502 X Lightspeed
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Logitech G502 X Lightspeed | Wireless Gaming Mouse",
          collection_id: collection.id,
          category_ids: [getCatId("Mice")],
          description:
            "The Logitech G502 X Lightspeed updates a popular mouse shape with wireless connectivity and improved switches. It is aimed at gamers who like many programmable buttons for macros, abilities, and quick actions. The adjustable weight system lets users tweak the feel to their preference, and the Hero sensor delivers efficient, accurate tracking.",
          weight: 99,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/mouse-front.png",
            },
          ],
          options: [{ title: "Color", values: ["Black", "White"] }],
          variants: [
            {
              title: "G502 X Lightspeed Black",
              sku: "G502X-LS-BLK",
              options: { Color: "Black" },
              manage_inventory: false,
              prices: [
                { amount: 149, currency_code: "eur" },
                { amount: 149, currency_code: "usd" },
              ],
            },
            {
              title: "G502 X Lightspeed White",
              sku: "G502X-LS-WHT",
              options: { Color: "White" },
              manage_inventory: false,
              prices: [
                { amount: 149, currency_code: "eur" },
                { amount: 149, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 48. Logitech Brio 4K Webcam
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Logitech Brio 4K Webcam | HDR | Windows Hello",
          collection_id: collection.id,
          category_ids: [getCatId("Webcams")],
          description:
            "The Logitech Brio 4K is a premium webcam aimed at professionals who want sharper video for calls and content. It can capture 4K footage at lower frame rates or 1080p at smoother settings and supports HDR to better handle tricky lighting. Windows Hello support allows it to double as a secure face login device on compatible machines.",
          weight: 120,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/camera-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/camera-side.png",
            },
          ],
          options: [{ title: "Color", values: ["Black"] }],
          variants: [
            {
              title: "Brio 4K Black",
              sku: "LOGI-BRIO-4K-BLK",
              options: { Color: "Black" },
              manage_inventory: false,
              prices: [
                { amount: 229, currency_code: "eur" },
                { amount: 229, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 49. Elgato Facecam Pro
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Elgato Facecam Pro | 4K60 Streaming Webcam",
          collection_id: collection.id,
          category_ids: [getCatId("Webcams")],
          description:
            'The Elgato Facecam Pro is a 4K60 webcam designed for streamers and content creators who want sharp, fluid video from a simple USB device. It offers manual controls for exposure, white balance, and other settings through software, allowing a more "camera-like" workflow. The wide field of view and good lens make it suitable for desk setups and small studios.',
          weight: 125,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/camera-front.png",
            },
          ],
          options: [{ title: "Color", values: ["Black"] }],
          variants: [
            {
              title: "Facecam Pro Black",
              sku: "ELGATO-FACECAM-PRO",
              options: { Color: "Black" },
              manage_inventory: false,
              prices: [
                { amount: 299, currency_code: "eur" },
                { amount: 299, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 50. JBL Quantum Duo PC Speakers
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "JBL Quantum Duo | PC Gaming Speakers | RGB Lighting",
          collection_id: collection.id,
          category_ids: [getCatId("Speakers")],
          description:
            "JBL Quantum Duo speakers are compact desktop speakers aimed at gamers who want more punch than typical monitor audio. They provide directional stereo sound with emphasized effects for games and include RGB lighting that can sync with on-screen action. Their small footprint makes them easy to squeeze onto busy desks alongside a keyboard and monitor.",
          weight: 2500,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/speaker-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/speaker-top.png",
            },
          ],
          options: [{ title: "Color", values: ["Black"] }],
          variants: [
            {
              title: "Quantum Duo Black",
              sku: "JBL-QUANTUM-DUO-BLKO",
              options: { Color: "Black" },
              manage_inventory: false,
              prices: [
                { amount: 179, currency_code: "eur" },
                { amount: 179, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 71. Anker 737 Power Bank (24K)
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Anker 737 Power Bank (24K) | 140W USB-C PD | PowerCore",
          collection_id: collection.id,
          category_ids: [getCatId("Smartphones")],
          description:
            "The Anker 737 Power Bank (24K) is a high-capacity portable battery designed to fast-charge phones, tablets, and modern laptops over USB-C Power Delivery. Its digital display shows real-time input and output wattage along with remaining capacity, which makes planning top-ups on trips easier. Three ports allow charging several devices at once without carrying multiple smaller power banks.",
          weight: 630,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/speaker-front.png",
            },
          ],
          options: [{ title: "Color", values: ["Black"] }],
          variants: [
            {
              title: "Anker 737 Power Bank Black",
              sku: "ANKER-737-24K-BLK",
              options: { Color: "Black" },
              manage_inventory: false,
              prices: [
                { amount: 169, currency_code: "eur" },
                { amount: 169, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 72. Belkin BoostCharge Pro 3-in-1 Wireless Charger
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title:
            "Belkin BoostCharge Pro | 3-in-1 MagSafe Wireless Charging Dock",
          collection_id: collection.id,
          category_ids: [getCatId("Smartphones")],
          description:
            "The Belkin BoostCharge Pro 3-in-1 dock offers a single stand for charging a MagSafe-compatible iPhone, Apple Watch, and wireless earbuds at the same time. Its weighted base keeps it steady when you tap the phone, and the upright magnetic pad holds the screen at a comfortable angle for glancing at notifications. It helps tidy nightstands and desks by replacing multiple separate chargers and cables.",
          weight: 480,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/speaker-top.png",
            },
          ],
          options: [{ title: "Color", values: ["Black", "White"] }],
          variants: [
            {
              title: "BoostCharge Pro Black",
              sku: "BELKIN-BCPRO-3IN1-BLK",
              options: { Color: "Black" },
              manage_inventory: false,
              prices: [
                { amount: 179, currency_code: "eur" },
                { amount: 179, currency_code: "usd" },
              ],
            },
            {
              title: "BoostCharge Pro White",
              sku: "BELKIN-BCPRO-3IN1-WHT",
              options: { Color: "White" },
              manage_inventory: false,
              prices: [
                { amount: 179, currency_code: "eur" },
                { amount: 179, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 73. Samsung Wireless Charger Trio
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Samsung Wireless Charger Trio | Multi-Device Pad",
          collection_id: collection.id,
          category_ids: [getCatId("Smartphones")],
          description:
            "The Samsung Wireless Charger Trio is a flat charging pad that can power a phone, wireless earbuds, and a compatible smartwatch at the same time. It is designed for users who keep several Galaxy devices on their desk or nightstand and want a single surface for all of them. Subtle LEDs indicate charging status without being overly bright in dark rooms.",
          weight: 320,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/mouse-top.png",
            },
          ],
          options: [{ title: "Color", values: ["Black"] }],
          variants: [
            {
              title: "Wireless Charger Trio Black",
              sku: "SAMSUNG-TRIO-CHG-BLK",
              options: { Color: "Black" },
              manage_inventory: false,
              prices: [
                { amount: 99, currency_code: "eur" },
                { amount: 99, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 74. Satechi USB-C Slim Multi-Port Hub
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title:
            "Satechi USB-C Slim Multi-Port Hub | HDMI | USB-A | Card Reader",
          collection_id: collection.id,
          category_ids: [getCatId("Laptops")],
          description:
            "The Satechi USB-C Slim Multi-Port Hub is a compact adapter that adds HDMI, USB-A, and memory card slots to modern laptops that only include USB-C ports. It is well suited for students and office workers who still rely on older peripherals such as flash drives or projectors. The low-profile aluminum housing matches many ultrabook designs and slips easily into a laptop sleeve.",
          weight: 80,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/speaker-front.png",
            },
          ],
          options: [{ title: "Color", values: ["Space Gray", "Silver"] }],
          variants: [
            {
              title: "Slim Hub Space Gray",
              sku: "SATECHI-HUB-SGRY",
              options: { Color: "Space Gray" },
              manage_inventory: false,
              prices: [
                { amount: 69, currency_code: "eur" },
                { amount: 69, currency_code: "usd" },
              ],
            },
            {
              title: "Slim Hub Silver",
              sku: "SATECHI-HUB-SLV",
              options: { Color: "Silver" },
              manage_inventory: false,
              prices: [
                { amount: 69, currency_code: "eur" },
                { amount: 69, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 75. CalDigit Thunderbolt 4 Element Hub
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "CalDigit Thunderbolt 4 Element Hub | High-Speed Dock",
          collection_id: collection.id,
          category_ids: [getCatId("Laptops")],
          description:
            "The CalDigit Thunderbolt 4 Element Hub is a compact docking solution for laptops that need more high-speed ports. It provides multiple Thunderbolt 4 / USB4 connections for external drives, monitors, and audio interfaces, while a single cable to the notebook carries data and power. This setup is ideal for users who move between a mobile workspace and a more fully equipped desk.",
          weight: 220,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/screen-front.png",
            },
          ],
          options: [{ title: "Color", values: ["Dark Gray"] }],
          variants: [
            {
              title: "Element Hub Dark Gray",
              sku: "CALDIGIT-ELEMENT-HUB-GRY",
              options: { Color: "Dark Gray" },
              manage_inventory: false,
              prices: [
                { amount: 259, currency_code: "eur" },
                { amount: 259, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 76. Twelve South Curve Flex Laptop Stand
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Twelve South Curve Flex | Adjustable Laptop Stand",
          collection_id: collection.id,
          category_ids: [getCatId("Laptops")],
          description:
            "The Twelve South Curve Flex is an adjustable laptop stand that raises screens closer to eye level while freeing space underneath for keyboards and accessories. Its folding frame can change both height and angle, making it easier to dial in a comfortable posture at different desks. The metal construction supports modern ultrabooks while maintaining a clean, minimal look.",
          weight: 750,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/laptop-side.png",
            },
          ],
          options: [{ title: "Color", values: ["Matte White", "Matte Black"] }],
          variants: [
            {
              title: "Curve Flex Matte White",
              sku: "CURVE-FLEX-WHT",
              options: { Color: "Matte White" },
              manage_inventory: false,
              prices: [
                { amount: 99, currency_code: "eur" },
                { amount: 99, currency_code: "usd" },
              ],
            },
            {
              title: "Curve Flex Matte Black",
              sku: "CURVE-FLEX-BLK",
              options: { Color: "Matte Black" },
              manage_inventory: false,
              prices: [
                { amount: 99, currency_code: "eur" },
                { amount: 99, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 77. Elgato Stream Deck MK.2
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Elgato Stream Deck MK.2 | Customizable Control Pad",
          collection_id: collection.id,
          category_ids: [getCatId("Keyboards")],
          description:
            "The Elgato Stream Deck MK.2 is a small control pad with LCD keys that can trigger macros, app shortcuts, and streaming actions. Each key displays a custom icon, allowing users to label scene changes, audio controls, or editing tools clearly. It suits streamers, video editors, and productivity-focused users who want quick, tactile access to complex workflows.",
          weight: 270,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/keyboard-front.png",
            },
          ],
          options: [{ title: "Color", values: ["Black"] }],
          variants: [
            {
              title: "Stream Deck MK.2 Black",
              sku: "ELGATO-STREAM-DECK-MK2",
              options: { Color: "Black" },
              manage_inventory: false,
              prices: [
                { amount: 179, currency_code: "eur" },
                { amount: 179, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 78. MX Keys Mini Wireless Keyboard
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title:
            "Logitech MX Keys Mini | Compact Wireless Productivity Keyboard",
          collection_id: collection.id,
          category_ids: [getCatId("Keyboards")],
          description:
            "The Logitech MX Keys Mini is a compact wireless keyboard designed for productivity setups where desk space is limited. Its low-profile keys use a scissor mechanism similar to quality laptop keyboards, with subtle indentations that help fingers center on each key. Backlighting adjusts automatically based on ambient light, and multi-device pairing lets users switch between computer, tablet, and phone with one button row.",
          weight: 506,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/keyboard-front.png",
            },
          ],
          options: [{ title: "Color", values: ["Graphite", "Pale Gray"] }],
          variants: [
            {
              title: "MX Keys Mini Graphite",
              sku: "MXKEYS-MINI-GRAPHITE",
              options: { Color: "Graphite" },
              manage_inventory: false,
              prices: [
                { amount: 129, currency_code: "eur" },
                { amount: 129, currency_code: "usd" },
              ],
            },
            {
              title: "MX Keys Mini Pale Gray",
              sku: "MXKEYS-MINI-GRAY",
              options: { Color: "Pale Gray" },
              manage_inventory: false,
              prices: [
                { amount: 129, currency_code: "eur" },
                { amount: 129, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 79. Satechi Slim X2 Bluetooth Keypad
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title:
            "Satechi Slim X2 | Bluetooth Numeric Keypad with Function Keys",
          collection_id: collection.id,
          category_ids: [getCatId("Keyboards")],
          description:
            "The Satechi Slim X2 is a wireless numeric keypad that adds a number pad and navigation cluster to compact laptops and smaller desktop keyboards. It connects over Bluetooth and can pair with multiple devices, which is convenient for users who regularly move between a notebook and a desktop. The low-profile keys mirror the feel of many modern ultrabooks.",
          weight: 210,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/keyboard-side.png",
            },
          ],
          options: [{ title: "Color", values: ["Space Gray"] }],
          variants: [
            {
              title: "Slim X2 Space Gray",
              sku: "SATECHI-X2-SGRY",
              options: { Color: "Space Gray" },
              manage_inventory: false,
              prices: [
                { amount: 59, currency_code: "eur" },
                { amount: 59, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 80. Logitech MX Master 3S Mouse
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Logitech MX Master 3S | Wireless Productivity Mouse",
          collection_id: collection.id,
          category_ids: [getCatId("Mice")],
          description:
            "The Logitech MX Master 3S is a wireless mouse designed for productivity-focused users who spend long days in front of multiple monitors. Its sculpted shell supports the hand in a relaxed grip, while the electromagnetic scroll wheel can switch between precise steps and free-spin scrolling. Side buttons and a thumb wheel can be customized per app for faster navigation in creative and office software.",
          weight: 141,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/mouse-top.png",
            },
          ],
          options: [{ title: "Color", values: ["Graphite", "Pale Gray"] }],
          variants: [
            {
              title: "MX Master 3S Graphite",
              sku: "MXMASTER3S-GRAPHITE",
              options: { Color: "Graphite" },
              manage_inventory: false,
              prices: [
                { amount: 129, currency_code: "eur" },
                { amount: 129, currency_code: "usd" },
              ],
            },
            {
              title: "MX Master 3S Pale Gray",
              sku: "MXMASTER3S-GRAY",
              options: { Color: "Pale Gray" },
              manage_inventory: false,
              prices: [
                { amount: 129, currency_code: "eur" },
                { amount: 129, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 81. Google Chromecast with Google TV (4K)
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title:
            "Google Chromecast with Google TV (4K) | Streaming Media Stick",
          collection_id: collection.id,
          category_ids: [getCatId("Monitors")],
          description:
            "Chromecast with Google TV (4K) is a small HDMI streaming device that turns existing monitors and TVs into smart displays. It comes with a remote and on-screen interface that aggregates content from several streaming services, making it easy to continue shows and discover new ones in one place. It suits users who want streaming apps on an older screen without replacing the display.",
          weight: 55,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/screen-side.png",
            },
          ],
          options: [{ title: "Color", values: ["Snow", "Sunrise"] }],
          variants: [
            {
              title: "Chromecast 4K Snow",
              sku: "CHROMECAST-GTV4K-SNOW",
              options: { Color: "Snow" },
              manage_inventory: false,
              prices: [
                { amount: 69, currency_code: "eur" },
                { amount: 69, currency_code: "usd" },
              ],
            },
            {
              title: "Chromecast 4K Sunrise",
              sku: "CHROMECAST-GTV4K-SUN",
              options: { Color: "Sunrise" },
              manage_inventory: false,
              prices: [
                { amount: 69, currency_code: "eur" },
                { amount: 69, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 82. Amazon Fire TV Stick 4K Max
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Amazon Fire TV Stick 4K Max | Wi-Fi 6 Streaming Stick",
          collection_id: collection.id,
          category_ids: [getCatId("Monitors")],
          description:
            "The Fire TV Stick 4K Max is a compact streaming stick that plugs into an HDMI port and adds Amazon’s Fire TV interface to any compatible screen. It supports Wi-Fi 6 for more stable streaming on busy networks and handles popular HDR formats for supported content. The bundled voice remote can control basic TV functions along with streaming apps.",
          weight: 48,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/screen-front.png",
            },
          ],
          options: [{ title: "Color", values: ["Black"] }],
          variants: [
            {
              title: "Fire TV Stick 4K Max",
              sku: "FIRETV-4KMAX-BLK",
              options: { Color: "Black" },
              manage_inventory: false,
              prices: [
                { amount: 69, currency_code: "eur" },
                { amount: 69, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 83. Logitech Litra Glow Streaming Light
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Logitech Litra Glow | USB Streaming Light for Webcams",
          collection_id: collection.id,
          category_ids: [getCatId("Webcams")],
          description:
            "The Logitech Litra Glow is a small LED panel that clips to monitors and laptops to provide more flattering light for webcams. It offers adjustable brightness and color temperature to match room conditions, helping faces look more natural on camera. The soft-edged diffuser reduces harsh shadows, which can be helpful for streamers and remote workers who appear on video frequently.",
          weight: 177,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/camera-front.png",
            },
          ],
          options: [{ title: "Color", values: ["White"] }],
          variants: [
            {
              title: "Litra Glow White",
              sku: "LITRA-GLOW-WHT",
              options: { Color: "White" },
              manage_inventory: false,
              prices: [
                { amount: 69, currency_code: "eur" },
                { amount: 69, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 84. Blue Yeti X USB Microphone
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Blue Yeti X | USB Condenser Microphone | Multi-Pattern",
          collection_id: collection.id,
          category_ids: [getCatId("Speakers")],
          description:
            "The Blue Yeti X is a USB condenser microphone designed for streamers, podcasters, and remote workers who want clearer voice capture than built-in laptop mics. It includes several pickup patterns for solo recording, interviews, or small roundtable discussions. Front-panel metering and gain controls make it easier to avoid clipping without opening software each time.",
          weight: 519,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/speaker-front.png",
            },
          ],
          options: [{ title: "Color", values: ["Blackout"] }],
          variants: [
            {
              title: "Yeti X Blackout",
              sku: "BLUE-YETI-X-BLK",
              options: { Color: "Blackout" },
              manage_inventory: false,
              prices: [
                { amount: 189, currency_code: "eur" },
                { amount: 189, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 85. Rode Wireless GO II Microphone System
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Rode Wireless GO II | Dual Channel Wireless Mic System",
          collection_id: collection.id,
          category_ids: [getCatId("Webcams")],
          description:
            "The Rode Wireless GO II is a compact wireless microphone system that pairs two transmitters with a single receiver. It is well suited for creators who record interviews or talking-head videos with mirrorless cameras, smartphones, or computers. Built-in recording on the transmitters provides a backup track in case wireless signals drop in crowded environments.",
          weight: 120,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/camera-side.png",
            },
          ],
          options: [{ title: "Color", values: ["Black"] }],
          variants: [
            {
              title: "Wireless GO II Black",
              sku: "RODE-WIRELESS-GO2-BLK",
              options: { Color: "Black" },
              manage_inventory: false,
              prices: [
                { amount: 299, currency_code: "eur" },
                { amount: 299, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 86. SanDisk Extreme Portable SSD V2 1TB
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "SanDisk Extreme Portable SSD V2 | 1TB USB-C External Drive",
          collection_id: collection.id,
          category_ids: [getCatId("Laptops")],
          description:
            "The SanDisk Extreme Portable SSD V2 is a small, rugged external solid-state drive built for moving large files quickly between laptops and desktops. Its USB-C interface supports high transfer rates for photo and video libraries, while the rubberized shell and IP55 rating help protect against drops and light rain. A built-in loop makes it easy to clip to a bag or strap.",
          weight: 63,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/laptop-top.png",
            },
          ],
          options: [{ title: "Capacity", values: ["1 TB"] }],
          variants: [
            {
              title: "Extreme Portable SSD 1 TB",
              sku: "SANDISK-EXT-SSD-1TB",
              options: { Capacity: "1 TB" },
              manage_inventory: false,
              prices: [
                { amount: 149, currency_code: "eur" },
                { amount: 149, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 87. UGREEN 9-in-1 USB-C Hub
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "UGREEN 9-in-1 USB-C Hub | Ethernet | HDMI | SD Reader",
          collection_id: collection.id,
          category_ids: [getCatId("Laptops")],
          description:
            "The UGREEN 9-in-1 USB-C Hub expands a single laptop port into wired Ethernet, HDMI, USB-A, and card readers, making it easier to connect to office projectors and networks. It is useful for thin notebooks that omit legacy connections but still need to work with older conference room gear. The integrated cable tucks into the body when packed into a bag.",
          weight: 110,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/speaker-front.png",
            },
          ],
          options: [{ title: "Color", values: ["Gray"] }],
          variants: [
            {
              title: "UGREEN 9-in-1 Hub Gray",
              sku: "UGREEN-9IN1-HUB-GRY",
              options: { Color: "Gray" },
              manage_inventory: false,
              prices: [
                { amount: 89, currency_code: "eur" },
                { amount: 89, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 88. Anker 737 USB-C GaN Wall Charger
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Anker 737 GaNPrime | 120W USB-C Wall Charger",
          collection_id: collection.id,
          category_ids: [getCatId("Smartphones")],
          description:
            "The Anker 737 GaNPrime wall charger uses GaN components to deliver up to 120W of power through a compact housing. Three ports share power intelligently between phones, tablets, and lightweight laptops, reducing the need to carry multiple bricks while traveling. Foldable prongs and a simple design make it easy to throw into a backpack or tech pouch.",
          weight: 210,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/mouse-front.png",
            },
          ],
          options: [{ title: "Color", values: ["Black"] }],
          variants: [
            {
              title: "Anker 737 GaNPrime Black",
              sku: "ANKER-737-GANPRIME-BLK",
              options: { Color: "Black" },
              manage_inventory: false,
              prices: [
                { amount: 119, currency_code: "eur" },
                { amount: 119, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 89. Samsung T7 Shield Portable SSD 2TB
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Samsung T7 Shield | 2TB Rugged Portable SSD",
          collection_id: collection.id,
          category_ids: [getCatId("Laptops")],
          description:
            "The Samsung T7 Shield is a ruggedized version of the company’s portable SSD line, offering rubberized protection and IP65 resistance to dust and water. It is aimed at creators and field workers who need to shuttle large media projects between machines without babying their storage. USB-C connectivity keeps transfers quick on modern laptops and desktops.",
          weight: 98,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/laptop-front.png",
            },
          ],
          options: [{ title: "Capacity", values: ["2 TB"] }],
          variants: [
            {
              title: "T7 Shield 2 TB",
              sku: "SAMSUNG-T7SHIELD-2TB",
              options: { Capacity: "2 TB" },
              manage_inventory: false,
              prices: [
                { amount: 229, currency_code: "eur" },
                { amount: 229, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // 90. Tile Pro Bluetooth Tracker (2024)
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Tile Pro (2024) | Long-Range Bluetooth Item Tracker",
          collection_id: collection.id,
          category_ids: [getCatId("Smartphones")],
          description:
            "The Tile Pro (2024) is a Bluetooth tracker designed to help users locate bags, keys, and other important items from a phone. It features a louder ring and longer range than smaller Tile models, along with a replaceable battery for multi-year use. The shared network of Tile users can help locate items that end up outside normal Bluetooth distance.",
          weight: 34,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/phone-bottom.png",
            },
          ],
          options: [{ title: "Color", values: ["Black", "White"] }],
          variants: [
            {
              title: "Tile Pro Black",
              sku: "TILE-PRO-2024-BLK",
              options: { Color: "Black" },
              manage_inventory: false,
              prices: [
                { amount: 39, currency_code: "eur" },
                { amount: 39, currency_code: "usd" },
              ],
            },
            {
              title: "Tile Pro White",
              sku: "TILE-PRO-2024-WHT",
              options: { Color: "White" },
              manage_inventory: false,
              prices: [
                { amount: 39, currency_code: "eur" },
                { amount: 39, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });
  // Product 91: UniFi Dream Router
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Ubiquiti UniFi Dream Router | WiFi 6 | All-in-One Gateway",
          collection_id: collection.id,
          category_ids: [getCatId("Smartphones")],
          description:
            "The Ubiquiti UniFi Dream Router is an all-in-one gateway for small homes and offices that want simple access to UniFi network management. It includes a WiFi 6 radio, integrated security gateway, and basic controller functions in a single chassis. The built-in display shows connection status at a glance, and UniFi Network app access makes it easier to monitor devices remotely.",
          weight: 1100,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/speaker-front.png",
            },
          ],
          options: [{ title: "Region", values: ["EU", "US"] }],
          variants: [
            {
              title: "UniFi Dream Router EU",
              sku: "UBNT-UDR-EU",
              options: { Region: "EU" },
              manage_inventory: false,
              prices: [
                { amount: 199, currency_code: "eur" },
                { amount: 199, currency_code: "usd" },
              ],
            },
            {
              title: "UniFi Dream Router US",
              sku: "UBNT-UDR-US",
              options: { Region: "US" },
              manage_inventory: false,
              prices: [
                { amount: 199, currency_code: "eur" },
                { amount: 199, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // Product 92: TP-Link Deco XE75 Mesh WiFi
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "TP-Link Deco XE75 | Tri-Band WiFi 6E Mesh System (3-Pack)",
          collection_id: collection.id,
          category_ids: [getCatId("Smartphones")],
          description:
            "The TP-Link Deco XE75 is a tri-band WiFi 6E mesh kit designed to cover medium and larger homes with more consistent wireless performance. Each node can be placed in a different room to help reduce dead zones, while the 6 GHz band reduces congestion from older devices. The Deco app guides setup and offers simple parental controls for families.",
          weight: 2600,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/speaker-top.png",
            },
          ],
          options: [{ title: "Pack Size", values: ["2-Pack", "3-Pack"] }],
          variants: [
            {
              title: "Deco XE75 2-Pack",
              sku: "DECO-XE75-2PK",
              options: { "Pack Size": "2-Pack" },
              manage_inventory: false,
              prices: [
                { amount: 279, currency_code: "eur" },
                { amount: 279, currency_code: "usd" },
              ],
            },
            {
              title: "Deco XE75 3-Pack",
              sku: "DECO-XE75-3PK",
              options: { "Pack Size": "3-Pack" },
              manage_inventory: false,
              prices: [
                { amount: 399, currency_code: "eur" },
                { amount: 399, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // Product 93: Netgear Nighthawk AX5400 Router
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Netgear Nighthawk AX5400 | Dual-Band WiFi 6 Gaming Router",
          collection_id: collection.id,
          category_ids: [getCatId("Smartphones")],
          description:
            "The Netgear Nighthawk AX5400 is a dual-band WiFi 6 router designed for households that combine gaming, streaming, and remote work. Its QoS and traffic prioritization tools help reduce latency for game consoles and PCs, while multiple Ethernet ports support wired desktops. The companion app makes initial setup and firmware updates straightforward for non-technical users.",
          weight: 1300,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/mouse-top.png",
            },
          ],
          options: [{ title: "Region", values: ["EU", "US"] }],
          variants: [
            {
              title: "Nighthawk AX5400 EU",
              sku: "NIGHTHAWK-AX5400-EU",
              options: { Region: "EU" },
              manage_inventory: false,
              prices: [
                { amount: 229, currency_code: "eur" },
                { amount: 229, currency_code: "usd" },
              ],
            },
            {
              title: "Nighthawk AX5400 US",
              sku: "NIGHTHAWK-AX5400-US",
              options: { Region: "US" },
              manage_inventory: false,
              prices: [
                { amount: 229, currency_code: "eur" },
                { amount: 229, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // Product 94: Synology DS923+ NAS
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Synology DiskStation DS923+ | 4-Bay NAS for Home and Office",
          collection_id: collection.id,
          category_ids: [getCatId("Laptops")],
          description:
            "The Synology DiskStation DS923+ is a 4-bay network-attached storage enclosure built for users who want local file sharing, backup, and light virtualization. Its operating system provides simple tools for automated PC backups, media streaming, and private cloud sync. Expansion options allow the unit to grow with additional drives or faster networking as storage needs increase.",
          weight: 2300,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/laptop-front.png",
            },
          ],
          options: [{ title: "Drive Bays Populated", values: ["Diskless"] }],
          variants: [
            {
              title: "DS923+ Diskless",
              sku: "SYNOLOGY-DS923-DISKLESS",
              options: { "Drive Bays Populated": "Diskless" },
              manage_inventory: false,
              prices: [
                { amount: 599, currency_code: "eur" },
                { amount: 599, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // Product 95: QNAP TS-464 NAS
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "QNAP TS-464 | 4-Bay NAS with 2.5GbE",
          collection_id: collection.id,
          category_ids: [getCatId("Laptops")],
          description:
            "The QNAP TS-464 is a small 4-bay NAS that targets power users and small teams who need a central location for projects and backups. Dual 2.5 GbE ports make it easier to saturate faster network links or configure link aggregation. A built-in HDMI port allows it to double as a basic media player or lightweight desktop when connected to a monitor and peripherals.",
          weight: 2500,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/screen-front.png",
            },
          ],
          options: [{ title: "Drive Bays Populated", values: ["Diskless"] }],
          variants: [
            {
              title: "TS-464 Diskless",
              sku: "QNAP-TS464-DISKLESS",
              options: { "Drive Bays Populated": "Diskless" },
              manage_inventory: false,
              prices: [
                { amount: 549, currency_code: "eur" },
                { amount: 549, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // Product 96: Meta Quest 3 VR Headset
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Meta Quest 3 | Standalone VR Headset with Mixed Reality",
          collection_id: collection.id,
          category_ids: [getCatId("Monitors")],
          description:
            "Meta Quest 3 is a standalone VR headset that runs games and experiences without a PC while still supporting wired or wireless PC VR streaming. Its mixed reality passthrough lets users blend virtual elements with their room, which can make fitness and productivity apps feel more grounded. Adjustable straps and a slimmer visor improve comfort compared to earlier models.",
          weight: 515,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/screen-side.png",
            },
          ],
          options: [{ title: "Storage", values: ["128 GB", "512 GB"] }],
          variants: [
            {
              title: "Quest 3 128 GB",
              sku: "QUEST3-128",
              options: { Storage: "128 GB" },
              manage_inventory: false,
              prices: [
                { amount: 549, currency_code: "eur" },
                { amount: 549, currency_code: "usd" },
              ],
            },
            {
              title: "Quest 3 512 GB",
              sku: "QUEST3-512",
              options: { Storage: "512 GB" },
              manage_inventory: false,
              prices: [
                { amount: 699, currency_code: "eur" },
                { amount: 699, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // Product 97: Valve Index VR Kit
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Valve Index VR Kit | PC VR Headset with Base Stations",
          collection_id: collection.id,
          category_ids: [getCatId("Monitors")],
          description:
            "The Valve Index VR Kit is a room-scale PC VR package that includes a headset, controllers, and base stations. It targets players who want precise tracking and wide field-of-view on powerful desktop systems. The off-ear speakers provide an open soundstage without pressing on the ears, and the controllers detect finger positions for more natural hand gestures in supported games.",
          weight: 2800,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/screen-top.png",
            },
          ],
          options: [{ title: "Package", values: ["Full Kit"] }],
          variants: [
            {
              title: "Valve Index Full Kit",
              sku: "VALVE-INDEX-FULL",
              options: { Package: "Full Kit" },
              manage_inventory: false,
              prices: [
                { amount: 1079, currency_code: "eur" },
                { amount: 1079, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // Product 98: Elgato HD60 X Capture Card
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Elgato HD60 X | External Game Capture Card",
          collection_id: collection.id,
          category_ids: [getCatId("Monitors")],
          description:
            "The Elgato HD60 X is an external capture card designed to connect modern consoles and PCs to streaming or recording software over USB. It supports high refresh passthrough so players can still enjoy 4K or high frame rate gameplay on their main monitor while sending a clean 1080p feed to capture. Compact dimensions help it disappear behind a TV or under a desk.",
          weight: 90,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/screen-back.png",
            },
          ],
          options: [{ title: "Color", values: ["Black"] }],
          variants: [
            {
              title: "HD60 X Black",
              sku: "ELGATO-HD60X-BLK",
              options: { Color: "Black" },
              manage_inventory: false,
              prices: [
                { amount: 189, currency_code: "eur" },
                { amount: 189, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // Product 99: ASUS ZenScreen Portable Monitor
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "ASUS ZenScreen 15.6 Portable Monitor | USB-C Powered",
          collection_id: collection.id,
          category_ids: [getCatId("Monitors")],
          description:
            "The ASUS ZenScreen 15.6 is a portable monitor that adds a second screen to laptops with a single USB-C cable. It is aimed at traveling professionals and students who want extra workspace in hotel rooms, classrooms, and cafes. The folding cover doubles as a stand, and the slim profile allows it to slide into the same backpack compartment as a notebook.",
          weight: 780,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/screen-front.png",
            },
          ],
          options: [
            { title: "Orientation", values: ["Landscape", "Portrait"] },
          ],
          variants: [
            {
              title: "ZenScreen Landscape",
              sku: "ZENSCREEN-15-LAND",
              options: { Orientation: "Landscape" },
              manage_inventory: false,
              prices: [
                { amount: 249, currency_code: "eur" },
                { amount: 249, currency_code: "usd" },
              ],
            },
            {
              title: "ZenScreen Portrait",
              sku: "ZENSCREEN-15-PORT",
              options: { Orientation: "Portrait" },
              manage_inventory: false,
              prices: [
                { amount: 249, currency_code: "eur" },
                { amount: 249, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // Product 100: Wacom Intuos Pro Medium
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Wacom Intuos Pro Medium | Pen Tablet for Creatives",
          collection_id: collection.id,
          category_ids: [getCatId("Laptops")],
          description:
            "The Wacom Intuos Pro Medium is a pen tablet aimed at illustrators, photo editors, and designers who prefer drawing directly with a stylus. The active area balances room for broad strokes with a footprint that still fits on crowded desks. Shortcut keys and a touch ring can be assigned to common actions in creative suites to reduce keyboard reliance.",
          weight: 700,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/laptop-top.png",
            },
          ],
          options: [{ title: "Size", values: ["Medium"] }],
          variants: [
            {
              title: "Intuos Pro Medium",
              sku: "WACOM-INTUOSPRO-M",
              options: { Size: "Medium" },
              manage_inventory: false,
              prices: [
                { amount: 379, currency_code: "eur" },
                { amount: 379, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // Product 101: Huion Kamvas 13 Pen Display
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Huion Kamvas 13 | 13-Inch Pen Display Tablet",
          collection_id: collection.id,
          category_ids: [getCatId("Monitors")],
          description:
            "The Huion Kamvas 13 is a pen display that combines a compact drawing screen with pen input for digital art and note-taking. It connects to laptops over USB-C or HDMI and provides a laminated surface to reduce parallax between pen tip and cursor. Programmable buttons along the side offer quick access to favorite tools in creative software.",
          weight: 980,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/screen-front.png",
            },
          ],
          options: [
            { title: "Color", values: ["Cosmo Black", "Midnight Green"] },
          ],
          variants: [
            {
              title: "Kamvas 13 Cosmo Black",
              sku: "KAMVAS13-BLK",
              options: { Color: "Cosmo Black" },
              manage_inventory: false,
              prices: [
                { amount: 279, currency_code: "eur" },
                { amount: 279, currency_code: "usd" },
              ],
            },
            {
              title: "Kamvas 13 Midnight Green",
              sku: "KAMVAS13-GRN",
              options: { Color: "Midnight Green" },
              manage_inventory: false,
              prices: [
                { amount: 279, currency_code: "eur" },
                { amount: 279, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // Product 102: Logitech Brio 500 Webcam
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Logitech Brio 500 | 1080p Business Webcam with Auto-Framing",
          collection_id: collection.id,
          category_ids: [getCatId("Webcams")],
          description:
            "The Logitech Brio 500 is a business-focused 1080p webcam designed for remote work and hybrid offices. It includes automatic framing features that keep you centered as you shift in your chair, plus a simple way to tilt the camera down to show documents on your desk. A physical shutter slides over the lens at the end of a call for added privacy.",
          weight: 122,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/camera-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/camera-side.png",
            },
          ],
          options: [{ title: "Color", values: ["Graphite", "Off-White"] }],
          variants: [
            {
              title: "Brio 500 Graphite",
              sku: "BRIO500-GRAPHITE",
              options: { Color: "Graphite" },
              manage_inventory: false,
              prices: [
                { amount: 139, currency_code: "eur" },
                { amount: 139, currency_code: "usd" },
              ],
            },
            {
              title: "Brio 500 Off-White",
              sku: "BRIO500-OFFWHITE",
              options: { Color: "Off-White" },
              manage_inventory: false,
              prices: [
                { amount: 139, currency_code: "eur" },
                { amount: 139, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // Product 103: Insta360 Link 4K PTZ Webcam
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Insta360 Link | 4K PTZ AI Webcam",
          collection_id: collection.id,
          category_ids: [getCatId("Webcams")],
          description:
            "The Insta360 Link is a 4K webcam mounted on a small gimbal that can pan, tilt, and zoom automatically to follow the speaker. It also supports desk view and overhead modes for whiteboards and demonstrations, making it attractive to educators and presenters. AI framing features help maintain a natural shot without needing manual camera adjustments during calls.",
          weight: 106,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/camera-front.png",
            },
          ],
          options: [{ title: "Color", values: ["Black"] }],
          variants: [
            {
              title: "Insta360 Link Black",
              sku: "INSTA360-LINK-BLK",
              options: { Color: "Black" },
              manage_inventory: false,
              prices: [
                { amount: 329, currency_code: "eur" },
                { amount: 329, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // Product 104: JBL Quantum Duo PC Speakers
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "JBL Quantum Duo | RGB PC Gaming Speakers",
          collection_id: collection.id,
          category_ids: [getCatId("Speakers")],
          description:
            "The JBL Quantum Duo is a compact 2.0 speaker set built for desktop gaming setups. It combines directional sound with customizable RGB lighting that can pulse to game audio or stay on a static color. Front-facing controls make it easy to adjust volume or lighting without reaching behind a monitor, and Bluetooth support lets it double as a simple music system.",
          weight: 2500,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/speaker-front.png",
            },
          ],
          options: [{ title: "Color", values: ["Black"] }],
          variants: [
            {
              title: "Quantum Duo Black",
              sku: "JBL-QUANTUM-DUO-BLK",
              options: { Color: "Black" },
              manage_inventory: false,
              prices: [
                { amount: 169, currency_code: "eur" },
                { amount: 169, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // Product 105: Bose Companion 2 Series III
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Bose Companion 2 Series III | Multimedia Desktop Speakers",
          collection_id: collection.id,
          category_ids: [getCatId("Speakers")],
          description:
            "The Bose Companion 2 Series III is a small stereo speaker system for desks that need better audio than built-in monitor speakers. It emphasizes clear dialogue and balanced sound at moderate volumes, which suits office work, video calls, and casual music listening. A front-mounted volume knob and headphone jack keep everyday control within easy reach.",
          weight: 1400,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/speaker-front.png",
            },
          ],
          options: [{ title: "Color", values: ["Black"] }],
          variants: [
            {
              title: "Companion 2 Black",
              sku: "BOSE-COMP2-III-BLK",
              options: { Color: "Black" },
              manage_inventory: false,
              prices: [
                { amount: 119, currency_code: "eur" },
                { amount: 119, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // Product 106: APC Back-UPS Pro 900
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "APC Back-UPS Pro 900 | Line-Interactive UPS",
          collection_id: collection.id,
          category_ids: [getCatId("Laptops")],
          description:
            "The APC Back-UPS Pro 900 is a compact uninterruptible power supply intended for desktop PCs, small network gear, and work-from-home setups. It offers battery-backed outlets to keep systems running through brief power cuts and to give time for safe shutdowns during longer outages. The front display shows load level and estimated runtime, which helps plan what to plug in.",
          weight: 10000,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/speaker-top.png",
            },
          ],
          options: [{ title: "Region Plug Type", values: ["EU", "UK"] }],
          variants: [
            {
              title: "Back-UPS Pro 900 EU",
              sku: "APC-BUPSPRO900-EU",
              options: { "Region Plug Type": "EU" },
              manage_inventory: false,
              prices: [
                { amount: 189, currency_code: "eur" },
                { amount: 189, currency_code: "usd" },
              ],
            },
            {
              title: "Back-UPS Pro 900 UK",
              sku: "APC-BUPSPRO900-UK",
              options: { "Region Plug Type": "UK" },
              manage_inventory: false,
              prices: [
                { amount: 189, currency_code: "eur" },
                { amount: 189, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // Product 107: Elgato Wave XLR Audio Interface
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Elgato Wave XLR | USB Audio Interface for XLR Microphones",
          collection_id: collection.id,
          category_ids: [getCatId("Speakers")],
          description:
            "The Elgato Wave XLR is a compact USB audio interface that connects XLR microphones to streaming and recording setups. It combines clean preamps with a capacitive mute button and headphone monitoring in a single desktop-friendly unit. Integration with Wave Link software provides per-app mixing, so streamers can balance game, chat, and music levels independently.",
          weight: 466,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/speaker-front.png",
            },
          ],
          options: [{ title: "Color", values: ["Black"] }],
          variants: [
            {
              title: "Wave XLR Black",
              sku: "ELGATO-WAVE-XLR-BLK",
              options: { Color: "Black" },
              manage_inventory: false,
              prices: [
                { amount: 169, currency_code: "eur" },
                { amount: 169, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // Product 108: Corsair iCUE LT100 Smart Lighting Towers
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Corsair iCUE LT100 | Smart Lighting Towers Starter Kit",
          collection_id: collection.id,
          category_ids: [getCatId("Speakers")],
          description:
            "The Corsair iCUE LT100 is a pair of LED lighting towers designed to sit behind monitors or speakers and add ambient light to gaming and productivity setups. Each tower offers individually addressable zones that can sync with on-screen content, music, or static color themes through iCUE software. They are meant for users who want a more immersive or personalized desk environment.",
          weight: 1700,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/speaker-top.png",
            },
          ],
          options: [{ title: "Kit Type", values: ["Starter Kit"] }],
          variants: [
            {
              title: "LT100 Starter Kit",
              sku: "CORSAIR-LT100-START",
              options: { "Kit Type": "Starter Kit" },
              manage_inventory: false,
              prices: [
                { amount: 149, currency_code: "eur" },
                { amount: 149, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // Product 109: Razer Kishi V2 Mobile Controller
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Razer Kishi V2 | Universal Mobile Gaming Controller",
          collection_id: collection.id,
          category_ids: [getCatId("Smartphones")],
          description:
            "The Razer Kishi V2 is a mobile controller that clamps around compatible smartphones to create a more console-like layout for cloud and mobile games. Its low-latency wired connection helps avoid input lag, and dedicated app launcher buttons make it easier to jump into supported services. The adjustable bridge fits a range of device sizes without needing separate cases.",
          weight: 284,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/phone-side.png",
            },
          ],
          options: [{ title: "Platform", values: ["Android", "iPhone"] }],
          variants: [
            {
              title: "Kishi V2 Android",
              sku: "RAZER-KISHI-V2-AND",
              options: { Platform: "Android" },
              manage_inventory: false,
              prices: [
                { amount: 119, currency_code: "eur" },
                { amount: 119, currency_code: "usd" },
              ],
            },
            {
              title: "Kishi V2 iPhone",
              sku: "RAZER-KISHI-V2-IOS",
              options: { Platform: "iPhone" },
              manage_inventory: false,
              prices: [
                { amount: 119, currency_code: "eur" },
                { amount: 119, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // Product 110: Backbone One PlayStation Edition
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title:
            "Backbone One PlayStation Edition | Mobile Controller for iPhone",
          collection_id: collection.id,
          category_ids: [getCatId("Smartphones")],
          description:
            "The Backbone One PlayStation Edition is a mobile game controller styled after the DualSense design and built for iPhones. It connects over Lightning or USB-C depending on the phone model and adds precise analog sticks, triggers, and face buttons for cloud and remote-play titles. The Backbone app organizes installed games and streaming services in a single launcher view.",
          weight: 138,
          status: ProductStatus.PUBLISHED,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/phone-front.png",
            },
          ],
          options: [{ title: "Connector", values: ["Lightning", "USB-C"] }],
          variants: [
            {
              title: "Backbone One PS Edition Lightning",
              sku: "BACKBONE-PS-LIGHTNING",
              options: { Connector: "Lightning" },
              manage_inventory: false,
              prices: [
                { amount: 119, currency_code: "eur" },
                { amount: 119, currency_code: "usd" },
              ],
            },
            {
              title: "Backbone One PS Edition USB-C",
              sku: "BACKBONE-PS-USBC",
              options: { Connector: "USB-C" },
              manage_inventory: false,
              prices: [
                { amount: 119, currency_code: "eur" },
                { amount: 119, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  logger.info("✅ Finished seeding products products.");
}
