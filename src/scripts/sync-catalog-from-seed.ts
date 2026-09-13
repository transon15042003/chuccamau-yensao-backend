import * as path from "path";
import { ExecArgs } from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils";
import {
  createCollectionsWorkflow,
  createProductsWorkflow,
  updateProductsWorkflow,
} from "@medusajs/medusa/core-flows";
import { loadCatalog } from "../lib/seed/load-catalog";
import { mapSeedProductToMedusaInput } from "../lib/seed/map-product";

const FEATURED_HANDLE = "san-pham-noi-bat";
const FEATURED_LIMIT = 8;

/**
 * Upsert catalog from seed/data JSON (safe re-seed).
 * Does not wipe orders; updates title/description/images/metadata on existing handles.
 */
export default async function syncCatalogFromSeed({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const productModule = container.resolve(Modules.PRODUCT);
  const fulfillmentModule = container.resolve(Modules.FULFILLMENT);
  const salesChannelModule = container.resolve(Modules.SALES_CHANNEL);

  const storePublicUrl =
    process.env.STORE_PUBLIC_URL ||
    process.env.STORE_URL ||
    "http://localhost:3000";

  const shippingProfiles = await fulfillmentModule.listShippingProfiles({
    type: "default",
  });
  const shippingProfile = shippingProfiles[0];
  if (!shippingProfile) {
    throw new Error("No default shipping profile — run yarn seed first");
  }

  const channels = await salesChannelModule.listSalesChannels({}, { take: 1 });
  const salesChannelId = channels[0]?.id;
  if (!salesChannelId) {
    throw new Error("No sales channel — run yarn seed first");
  }

  const seedDataDir = path.join(process.cwd(), "seed", "data");
  const { categories, products } = loadCatalog(seedDataDir);

  const categoryIdByHandle = new Map<string, string>();
  for (const c of categories) {
    const existing = await productModule.listProductCategories(
      { handle: c.slug },
      { take: 1 }
    );
    if (existing[0]) {
      categoryIdByHandle.set(c.slug, existing[0].id);
      await productModule.updateProductCategories(existing[0].id, {
        name: c.name,
      });
    }
  }

  const mapCtx = {
    categoryIdByHandle,
    shippingProfileId: shippingProfile.id,
    salesChannelId,
    storePublicUrl,
  };

  let created = 0;
  let updated = 0;
  const productIds: string[] = [];

  for (const product of products) {
    const input = mapSeedProductToMedusaInput(product, mapCtx);
    const existing = await productModule.listProducts(
      { handle: product.slug },
      { take: 1, relations: ["variants"] }
    );

    if (!existing.length) {
      const { result } = await createProductsWorkflow(container).run({
        input: {
          products: [
            {
              ...input,
              status: ProductStatus.PUBLISHED,
            },
          ],
        },
      });
      productIds.push(result[0].id);
      created++;
      logger.info(`Created product ${product.slug}`);
      continue;
    }

    const medusaProduct = existing[0];
    await updateProductsWorkflow(container).run({
      input: {
        products: [
          {
            id: medusaProduct.id,
            title: input.title,
            description: input.description,
            images: input.images,
            metadata: input.metadata,
            category_ids: input.category_ids,
          },
        ],
      },
    });

    // Update variant prices by SKU when present
    for (const v of input.variants) {
      const match = (medusaProduct.variants || []).find(
        (mv: { sku?: string | null }) => mv.sku === v.sku
      );
      if (!match) continue;
      await productModule.updateProductVariants(match.id, {
        title: v.title,
      });
      // price update via pricing module — keep lean: Admin can adjust; stock via sync:inventory
    }

    productIds.push(medusaProduct.id);
    updated++;
    logger.info(`Updated product ${product.slug}`);
  }

  // Featured collection for homepage
  const { data: collections } = await query.graph({
    entity: "product_collection",
    fields: ["id", "handle"],
    filters: { handle: FEATURED_HANDLE },
  });
  let collectionId = collections?.[0]?.id as string | undefined;

  if (!collectionId) {
    const { result } = await createCollectionsWorkflow(container).run({
      input: {
        collections: [
          {
            title: "Sản phẩm nổi bật",
            handle: FEATURED_HANDLE,
          },
        ],
      },
    });
    collectionId = result[0].id;
    logger.info(`Created collection ${FEATURED_HANDLE}`);
  }

  const featured = [...products]
    .sort((a, b) => (b.totalSold || 0) - (a.totalSold || 0))
    .slice(0, FEATURED_LIMIT);

  const featuredIds: string[] = [];
  for (const p of featured) {
    const found = await productModule.listProducts(
      { handle: p.slug },
      { take: 1 }
    );
    if (found[0]) featuredIds.push(found[0].id);
  }

  if (collectionId && featuredIds.length) {
    await updateProductsWorkflow(container).run({
      input: {
        products: featuredIds.map((id) => ({
          id,
          collection_id: collectionId,
        })),
      },
    });
    logger.info(
      `Linked ${featuredIds.length} products to collection ${FEATURED_HANDLE}`
    );
  }

  logger.info(
    `Catalog sync done: created=${created} updated=${updated} storePublicUrl=${storePublicUrl}`
  );
}
