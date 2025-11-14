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
  ProductStatus,
} from "@medusajs/framework/utils";
import { faker } from "@faker-js/faker";

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

  logger.info("Seeding product data...");

  const {
    result: [collection],
  } = await createCollectionsWorkflow(container).run({
    input: {
      collections: [
        {
          title: "Featured",
          handle: "featured",
        },
      ],
    },
  });

  const { result: categoryResult } = await createProductCategoriesWorkflow(
    container
  ).run({
    input: {
      product_categories: [
        {
          name: "Laptops",
          is_active: true,
        },
        {
          name: "Accessories",
          is_active: true,
        },
        {
          name: "Phones",
          is_active: true,
        },
        {
          name: "Monitors",
          is_active: true,
        },
      ],
    },
  });

  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title:
            '16" Ultra-Slim AI Laptop | 3K OLED | 1.1cm Thin | 6-Speaker Audio',
          collection_id: collection.id,
          category_ids: [
            categoryResult.find((cat) => cat.name === "Laptops")?.id!,
          ],
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
          category_ids: [
            categoryResult.find((cat) => cat.name === "Accessories")?.id!,
          ],
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
          category_ids: [
            categoryResult.find((cat) => cat.name === "Phones")?.id!,
          ],
          description:
            'This premium smartphone is crafted from durable and lightweight aerospace-grade aluminum, featuring an expansive 6.5" Ultra-High Definition AMOLED display. It boasts exceptional durability with a cutting-edge nanocrystal glass front, offering three times the impact resistance of standard smartphone screens. The device combines sleek design with robust protection, setting a new standard for smartphone resilience and visual excellence. Copy',
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
          category_ids: [
            categoryResult.find((cat) => cat.name === "Monitors")?.id!,
          ],
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
          category_ids: [
            categoryResult.find((cat) => cat.name === "Accessories")?.id!,
          ],
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
          category_ids: [
            categoryResult.find((cat) => cat.name === "Accessories")?.id!,
          ],
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
          category_ids: [
            categoryResult.find((cat) => cat.name === "Accessories")?.id!,
          ],
          description: `This wireless keyboard offers a comfortable typing experience with a numeric keypad and Touch ID. It features navigation buttons, full-sized arrow keys, and is ideal for spreadsheets and gaming. The rechargeable battery lasts about a month. It pairs automatically with compatible computers and includes a USB-C to Lightning cable for charging and pairing.`,
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
          category_ids: [
            categoryResult.find((cat) => cat.name === "Accessories")?.id!,
          ],
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

  logger.info("Finished seeding product data.");

  // Generate additional random products with Faker
  logger.info("Generating random products with Faker...");
  const numberOfRandomProducts = 50; // Change this number to generate more/fewer products

  // Define realistic product components
  const brands = [
    "TechPro",
    "SmartLife",
    "Elite",
    "ProGear",
    "Digital",
    "Ultra",
    "Premium",
    "Essential",
    "NexGen",
    "Quantum",
    "Fusion",
    "Apex",
    "Infinity",
    "Velocity",
    "Zenith",
    "Omega",
  ];
  const features = [
    "Wireless",
    "Gaming",
    "Professional",
    "Ultra",
    "Smart",
    "HD",
    "Pro",
    "Advanced",
    "Ergonomic",
    "Portable",
    "Compact",
    "Premium",
    "Lite",
    "Max",
    "Plus",
    "Studio",
  ];
  const products = [
    "Laptop",
    "Monitor",
    "Keyboard",
    "Mouse",
    "Headset",
    "Webcam",
    "Speaker",
    "Tablet",
    "Phone",
    "Watch",
    "Charger",
    "Hub",
    "Dock",
    "Cable",
    "Stand",
    "Adapter",
    "Case",
    "Pad",
    "Drive",
    "Router",
  ];
  const specs = [
    "4K",
    "144Hz",
    "RGB",
    "Mechanical",
    "Bluetooth",
    "5G",
    "UHD",
    "Wireless",
    "Noise-Canceling",
    "USB-C",
    "Wi-Fi 6",
    "OLED",
    "Retina",
    "Touch",
    "Backlit",
    "Foldable",
    "8K",
    "HDR",
    "Dolby",
    "Fast-Charge",
  ];

  for (let i = 0; i < numberOfRandomProducts; i++) {
    const category = faker.helpers.arrayElement(categoryResult);
    const brand = faker.helpers.arrayElement(brands);
    const feature = faker.helpers.arrayElement(features);
    const productType = faker.helpers.arrayElement(products);
    const spec = faker.helpers.arrayElement(specs);

    // Generate two unique colors
    const colors = faker.helpers.uniqueArray(() => faker.color.human(), 2);
    const color1 = colors[0];
    const color2 = colors[1];

    // Generate random product images using faker (updated method)
    const imageCount = faker.number.int({ min: 2, max: 4 });
    const images = Array.from({ length: imageCount }, () => ({
      url: faker.image.url({ width: 800, height: 800 }),
    }));

    await createProductsWorkflow(container).run({
      input: {
        products: [
          {
            title: `${brand} ${feature} ${productType} | ${spec}`,
            category_ids: [category.id],
            description:
              faker.commerce.productDescription() +
              ". " +
              faker.lorem.paragraph(),
            weight: faker.number.int({ min: 100, max: 1000 }),
            status: ProductStatus.PUBLISHED,
            images: images,
            options: [
              {
                title: "Color",
                values: [color1, color2],
              },
            ],
            variants: [
              {
                title: `${productType} ${color1}`,
                sku: faker.string.alphanumeric(10).toUpperCase(),
                options: {
                  Color: color1,
                },
                manage_inventory: false,
                prices: [
                  {
                    amount: faker.number.int({ min: 29, max: 1999 }),
                    currency_code: "eur",
                  },
                  {
                    amount: faker.number.int({ min: 29, max: 1999 }),
                    currency_code: "usd",
                  },
                ],
              },
              {
                title: `${productType} ${color2}`,
                sku: faker.string.alphanumeric(10).toUpperCase(),
                options: {
                  Color: color2,
                },
                manage_inventory: false,
                prices: [
                  {
                    amount: faker.number.int({ min: 29, max: 1999 }),
                    currency_code: "eur",
                  },
                  {
                    amount: faker.number.int({ min: 29, max: 1999 }),
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

    if ((i + 1) % 10 === 0) {
      logger.info(
        `Generated ${i + 1}/${numberOfRandomProducts} random products...`
      );
    }
  }

  logger.info(
    `✅ Finished generating ${numberOfRandomProducts} random products!`
  );
}
