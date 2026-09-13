import * as path from "path";
import { CreateInventoryLevelInput, ExecArgs } from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils";
import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import {
  createApiKeysWorkflow,
  createInventoryLevelsWorkflow,
  createProductCategoriesWorkflow,
  createProductsWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createShippingOptionsWorkflow,
  createShippingProfilesWorkflow,
  createStockLocationsWorkflow,
  createTaxRegionsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updateStoresStep,
  updateStoresWorkflow,
} from "@medusajs/medusa/core-flows";
import { loadCatalog } from "../lib/seed/load-catalog";
import { mapSeedProductToMedusaInput } from "../lib/seed/map-product";

const updateStoreCurrencies = createWorkflow(
  "update-store-currencies",
  (input: {
    supported_currencies: { currency_code: string; is_default?: boolean }[];
    store_id: string;
  }) => {
    const normalizedInput = transform({ input }, (data) => ({
      selector: { id: data.input.store_id },
      update: {
        supported_currencies: data.input.supported_currencies.map((currency) => ({
          currency_code: currency.currency_code,
          is_default: currency.is_default ?? false,
        })),
      },
    }));
    const stores = updateStoresStep(normalizedInput);
    return new WorkflowResponse(stores);
  }
);

export default async function seed({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const link = container.resolve(ContainerRegistrationKeys.LINK);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT);
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL);
  const storeModuleService = container.resolve(Modules.STORE);
  const regionModuleService = container.resolve(Modules.REGION);
  const productModuleService = container.resolve(Modules.PRODUCT);

  const countries = ["vn"];

  logger.info("Seeding store / sales channel...");
  const [store] = await storeModuleService.listStores();
  let defaultSalesChannel = await salesChannelModuleService.listSalesChannels({
    name: "Default Sales Channel",
  });
  if (!defaultSalesChannel.length) {
    const { result } = await createSalesChannelsWorkflow(container).run({
      input: { salesChannelsData: [{ name: "Default Sales Channel" }] },
    });
    defaultSalesChannel = result;
  }

  await updateStoreCurrencies(container).run({
    input: {
      store_id: store.id,
      supported_currencies: [{ currency_code: "vnd", is_default: true }],
    },
  });

  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: { default_sales_channel_id: defaultSalesChannel[0].id },
    },
  });

  logger.info("Seeding Vietnam region...");
  let region = (await regionModuleService.listRegions({}, { take: 20 })).find(
    (r) => r.currency_code === "vnd" || r.name === "Vietnam"
  );
  if (!region) {
    const { result } = await createRegionsWorkflow(container).run({
      input: {
        regions: [
          {
            name: "Vietnam",
            currency_code: "vnd",
            countries,
            payment_providers: ["pp_system_default"],
          },
        ],
      },
    });
    region = result[0];
  } else {
    logger.info(`Skip region (exists): ${region.name}`);
  }

  try {
    await createTaxRegionsWorkflow(container).run({
      input: countries.map((country_code) => ({
        country_code,
        provider_id: "tp_system",
      })),
    });
  } catch (e) {
    logger.info(`Tax regions skipped/exist: ${(e as Error).message}`);
  }

  logger.info("Seeding stock location...");
  const stockLocationModule = container.resolve(Modules.STOCK_LOCATION);
  let stockLocations = await stockLocationModule.listStockLocations({
    name: "Kho Ca Mau",
  });
  if (!stockLocations.length) {
    const { result } = await createStockLocationsWorkflow(container).run({
      input: {
        locations: [
          {
            name: "Kho Ca Mau",
            address: {
              city: "Ca Mau",
              country_code: "vn",
              address_1: "Ca Mau",
            },
          },
        ],
      },
    });
    stockLocations = result;
  }
  const stockLocation = stockLocations[0];

  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: { default_location_id: stockLocation.id },
    },
  });

  try {
    await link.create({
      [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
      [Modules.FULFILLMENT]: { fulfillment_provider_id: "manual_manual" },
    });
  } catch {
    logger.info("Stock location ↔ fulfillment provider link exists");
  }

  logger.info("Seeding fulfillment / shipping...");
  const shippingProfiles = await fulfillmentModuleService.listShippingProfiles({
    type: "default",
  });
  let shippingProfile = shippingProfiles[0] ?? null;
  if (!shippingProfile) {
    const { result } = await createShippingProfilesWorkflow(container).run({
      input: {
        data: [{ name: "Default Shipping Profile", type: "default" }],
      },
    });
    shippingProfile = result[0];
  }

  let fulfillmentSets = await fulfillmentModuleService.listFulfillmentSets({
    name: "Ca Mau delivery",
  });
  if (!fulfillmentSets.length) {
    const created = await fulfillmentModuleService.createFulfillmentSets({
      name: "Ca Mau delivery",
      type: "shipping",
      service_zones: [
        {
          name: "Vietnam",
          geo_zones: [{ country_code: "vn", type: "country" }],
        },
      ],
    });
    fulfillmentSets = Array.isArray(created) ? created : [created];
  }
  const fulfillmentSet = fulfillmentSets[0];

  try {
    await link.create({
      [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
      [Modules.FULFILLMENT]: { fulfillment_set_id: fulfillmentSet.id },
    });
  } catch {
    logger.info("Stock location ↔ fulfillment set link exists");
  }

  const existingOptions = await fulfillmentModuleService.listShippingOptions({
    name: "Giao tiêu chuẩn",
  });
  if (!existingOptions.length) {
    const serviceZoneId =
      fulfillmentSet.service_zones?.[0]?.id ??
      (
        await fulfillmentModuleService.retrieveFulfillmentSet(fulfillmentSet.id, {
          relations: ["service_zones"],
        })
      ).service_zones[0].id;

    await createShippingOptionsWorkflow(container).run({
      input: [
        {
          name: "Giao tiêu chuẩn",
          price_type: "flat",
          provider_id: "manual_manual",
          service_zone_id: serviceZoneId,
          shipping_profile_id: shippingProfile.id,
          type: {
            label: "Standard",
            description: "Giao hàng tiêu chuẩn",
            code: "standard",
          },
          prices: [
            { currency_code: "vnd", amount: 0 },
            { region_id: region!.id, amount: 0 },
          ],
          rules: [
            { attribute: "enabled_in_store", value: "true", operator: "eq" },
            { attribute: "is_return", value: "false", operator: "eq" },
          ],
        },
      ],
    });
  } else {
    logger.info("Skip shipping option (exists)");
  }

  await linkSalesChannelsToStockLocationWorkflow(container).run({
    input: {
      id: stockLocation.id,
      add: [defaultSalesChannel[0].id],
    },
  });

  logger.info("Seeding publishable API key...");
  const { data: apiKeys } = await query.graph({
    entity: "api_key",
    fields: ["id", "token", "title"],
    filters: { type: "publishable" },
  });
  let publishableApiKey = apiKeys?.[0] as
    | { id: string; token?: string }
    | undefined;

  if (!publishableApiKey) {
    const {
      result: [createdKey],
    } = await createApiKeysWorkflow(container).run({
      input: {
        api_keys: [
          { title: "Webshop", type: "publishable", created_by: "" },
        ],
      },
    });
    publishableApiKey = createdKey as { id: string; token?: string };
  }

  await linkSalesChannelsToApiKeyWorkflow(container).run({
    input: {
      id: publishableApiKey!.id,
      add: [defaultSalesChannel[0].id],
    },
  });

  logger.info(
    `Publishable API key id=${publishableApiKey!.id} token=${publishableApiKey!.token ?? "(see Admin → Settings → Publishable API Keys)"}`
  );

  // --- Catalog from seed/data ---
  const seedDataDir = path.join(process.cwd(), "seed", "data");
  const { categories, products } = loadCatalog(seedDataDir);

  logger.info(`Seeding ${categories.length} categories...`);
  const categoryIdByHandle = new Map<string, string>();
  for (const c of categories) {
    const existing = await productModuleService.listProductCategories(
      { handle: c.slug },
      { take: 1 }
    );
    if (existing.length) {
      categoryIdByHandle.set(c.slug, existing[0].id);
      continue;
    }
    try {
      const { result } = await createProductCategoriesWorkflow(container).run({
        input: {
          product_categories: [
            { name: c.name, handle: c.slug, is_active: true },
          ],
        },
      });
      categoryIdByHandle.set(c.slug, result[0].id);
    } catch (e) {
      const again = await productModuleService.listProductCategories(
        { handle: c.slug },
        { take: 1 }
      );
      if (!again.length) throw e;
      categoryIdByHandle.set(c.slug, again[0].id);
      logger.info(`Category handle=${c.slug} already existed`);
    }
  }

  logger.info(`Seeding up to ${products.length} products...`);
  for (const product of products) {
    const existing = await productModuleService.listProducts(
      { handle: product.slug },
      { take: 1 }
    );
    if (existing.length) {
      logger.info(`Skip existing product ${product.slug}`);
      continue;
    }

    const input = mapSeedProductToMedusaInput(product, {
      categoryIdByHandle,
      shippingProfileId: shippingProfile!.id,
      salesChannelId: defaultSalesChannel[0].id,
    });

    await createProductsWorkflow(container).run({
      input: {
        products: [{ ...input, status: ProductStatus.PUBLISHED }],
      },
    });
  }

  // Inventory levels (createProductsWorkflow creates items; levels must be explicit)
  logger.info("Seeding inventory levels...");
  const { data: inventoryItems } = await query.graph({
    entity: "inventory_item",
    fields: ["id"],
  });
  const { data: existingLevels } = await query.graph({
    entity: "inventory_level",
    fields: ["inventory_item_id", "location_id"],
  });
  const haveLevel = new Set(
    (existingLevels || []).map(
      (l: { inventory_item_id: string; location_id: string }) =>
        `${l.inventory_item_id}:${l.location_id}`
    )
  );
  const inventoryLevels: CreateInventoryLevelInput[] = [];
  for (const item of inventoryItems || []) {
    const key = `${item.id}:${stockLocation.id}`;
    if (haveLevel.has(key)) continue;
    inventoryLevels.push({
      inventory_item_id: item.id,
      location_id: stockLocation.id,
      stocked_quantity: 100,
    });
  }
  if (inventoryLevels.length) {
    await createInventoryLevelsWorkflow(container).run({
      input: { inventory_levels: inventoryLevels },
    });
    logger.info(`Created ${inventoryLevels.length} inventory levels`);
  }

  logger.info("Seed completed.");
}
